const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const { Logger } = require('../../utils/Logger');
const { MetricsService } = require('../../services/MetricsService');
const { RedisCache } = require('../../services/cache/RedisCache');

const logger = new Logger('EnhancedAuthMiddleware');
const metricsService = new MetricsService();
const cache = new RedisCache();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
const MAX_LOGIN_ATTEMPTS = process.env.MAX_LOGIN_ATTEMPTS || 5;
const LOCKOUT_TIME = process.env.LOCKOUT_TIME || 15 * 60 * 1000; // 15 minutos

/**
 * Middleware de autenticação JWT com recursos avançados
 */
const enhancedAuthMiddleware = async (req, res, next) => {
    try {
        const startTime = Date.now();
        const clientIp = getClientIp(req);
        const userAgent = req.headers['user-agent'] || 'unknown';

        const token = extractToken(req);

        if (!token) {
            await logAuthAttempt({
                ip: clientIp,
                userAgent,
                success: false,
                reason: 'no_token',
                timestamp: new Date().toISOString()
            });

            return res.status(401).json({
                success: false,
                message: 'Token de acesso obrigatório',
                code: 'NO_TOKEN'
            });
        }

        // Verificar se token está na blacklist
        const isBlacklisted = await cache.get(`blacklist:${token}`);
        if (isBlacklisted) {
            return res.status(401).json({
                success: false,
                message: 'Token revogado',
                code: 'TOKEN_REVOKED'
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET);

        // Verificar se o usuário ainda existe e está ativo
        const user = await getUserById(decoded.userId);
        if (!user || !user.active) {
            await logAuthAttempt({
                ip: clientIp,
                userAgent,
                userId: decoded.userId,
                success: false,
                reason: 'invalid_user',
                timestamp: new Date().toISOString()
            });

            return res.status(401).json({
                success: false,
                message: 'Usuário inválido ou inativo',
                code: 'INVALID_USER'
            });
        }

        // Verificar sessão ativa
        const sessionKey = `session:${user.id}:${decoded.sessionId}`;
        const sessionData = await cache.get(sessionKey);
        if (!sessionData) {
            return res.status(401).json({
                success: false,
                message: 'Sessão expirada ou inválida',
                code: 'SESSION_EXPIRED'
            });
        }

        // Verificar se IP mudou (opcional - configurável por usuário)
        if (user.settings?.strictIpValidation && sessionData.ip !== clientIp) {
            await logAuthAttempt({
                ip: clientIp,
                userAgent,
                userId: user.id,
                success: false,
                reason: 'ip_mismatch',
                timestamp: new Date().toISOString()
            });

            return res.status(401).json({
                success: false,
                message: 'Acesso de IP não autorizado',
                code: 'IP_MISMATCH'
            });
        }

        // Adicionar informações do usuário ao request
        req.user = {
            ...user,
            sessionId: decoded.sessionId,
            tokenIssuedAt: new Date(decoded.iat * 1000),
            tokenExpiresAt: new Date(decoded.exp * 1000)
        };

        // Atualizar última atividade da sessão
        await cache.set(sessionKey, {
            ...sessionData,
            lastActivity: new Date().toISOString(),
            lastEndpoint: `${req.method} ${req.path}`
        }, 24 * 60 * 60); // 24 horas

        // Registrar acesso
        const processingTime = Date.now() - startTime;
        await logAuthAttempt({
            ip: clientIp,
            userAgent,
            userId: user.id,
            success: true,
            endpoint: `${req.method} ${req.path}`,
            processingTime,
            timestamp: new Date().toISOString()
        });

        logger.debug(`Usuário autenticado: ${user.id} - ${req.method} ${req.path} (${processingTime}ms)`);

        next();

    } catch (error) {
        const clientIp = getClientIp(req);
        const userAgent = req.headers['user-agent'] || 'unknown';

        await logAuthAttempt({
            ip: clientIp,
            userAgent,
            success: false,
            reason: error.name || 'unknown_error',
            error: error.message,
            timestamp: new Date().toISOString()
        });

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expirado',
                code: 'TOKEN_EXPIRED',
                expiredAt: error.expiredAt
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Token inválido',
                code: 'INVALID_TOKEN'
            });
        }

        if (error.name === 'NotBeforeError') {
            return res.status(401).json({
                success: false,
                message: 'Token ainda não é válido',
                code: 'TOKEN_NOT_ACTIVE'
            });
        }

        logger.error('Erro na autenticação:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno de autenticação',
            code: 'AUTH_ERROR'
        });
    }
};

/**
 * Middleware de autorização baseada em roles
 */
const roleMiddleware = (requiredRoles) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Autenticação necessária',
                    code: 'AUTHENTICATION_REQUIRED'
                });
            }

            const userRoles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];
            const allowedRoles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

            const hasRequiredRole = allowedRoles.some(role =>
                userRoles.includes(role) || req.user.isAdmin
            );

            if (!hasRequiredRole) {
                logger.warn(`Acesso negado para usuário ${req.user.id}. Roles necessárias: ${allowedRoles.join(', ')}`);

                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado. Permissões insuficientes.',
                    code: 'INSUFFICIENT_PERMISSIONS',
                    requiredRoles: allowedRoles,
                    userRoles
                });
            }

            next();

        } catch (error) {
            logger.error('Erro no middleware de role:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno de autorização',
                code: 'AUTHORIZATION_ERROR'
            });
        }
    };
};

/**
 * Middleware de autorização baseada em permissões específicas
 */
const permissionMiddleware = (requiredPermissions) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Autenticação necessária',
                    code: 'AUTHENTICATION_REQUIRED'
                });
            }

            // Admin tem todas as permissões
            if (req.user.isAdmin) {
                return next();
            }

            const userPermissions = req.user.permissions || [];
            const neededPermissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

            const hasAllPermissions = neededPermissions.every(permission =>
                userPermissions.includes(permission)
            );

            if (!hasAllPermissions) {
                logger.warn(`Permissões insuficientes para usuário ${req.user.id}. Necessárias: ${neededPermissions.join(', ')}`);

                return res.status(403).json({
                    success: false,
                    message: 'Permissões insuficientes',
                    code: 'INSUFFICIENT_PERMISSIONS',
                    requiredPermissions: neededPermissions,
                    userPermissions
                });
            }

            next();

        } catch (error) {
            logger.error('Erro no middleware de permissão:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno de autorização',
                code: 'AUTHORIZATION_ERROR'
            });
        }
    };
};

/**
 * Rate limiting para tentativas de login
 */
const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // 5 tentativas por IP
    message: {
        success: false,
        message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
        code: 'TOO_MANY_LOGIN_ATTEMPTS'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return getClientIp(req);
    },
    skip: (req, res) => {
        // Pular rate limiting para IPs confiáveis (opcional)
        const trustedIPs = process.env.TRUSTED_IPS?.split(',') || [];
        return trustedIPs.includes(getClientIp(req));
    }
});

/**
 * Middleware para logout e invalidação de sessão
 */
const logoutMiddleware = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Não autenticado',
                code: 'NOT_AUTHENTICATED'
            });
        }

        const token = extractToken(req);
        const sessionId = req.user.sessionId;
        const userId = req.user.id;

        // Adicionar token à blacklist
        if (token) {
            const decoded = jwt.decode(token);
            const timeToExpiry = decoded.exp - Math.floor(Date.now() / 1000);

            if (timeToExpiry > 0) {
                await cache.set(`blacklist:${token}`, 'logged_out', timeToExpiry);
            }
        }

        // Remover sessão
        if (sessionId) {
            await cache.del(`session:${userId}:${sessionId}`);
        }

        // Log do logout
        await logAuthAttempt({
            ip: getClientIp(req),
            userAgent: req.headers['user-agent'] || 'unknown',
            userId,
            success: true,
            action: 'logout',
            timestamp: new Date().toISOString()
        });

        logger.info(`Usuário ${userId} fez logout`);

        res.json({
            success: true,
            message: 'Logout realizado com sucesso',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Erro no logout:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno no logout',
            code: 'LOGOUT_ERROR'
        });
    }
};

/**
 * Gerar token JWT com recursos avançados
 */
const generateToken = async (userData, options = {}) => {
    try {
        const sessionId = options.sessionId || generateSessionId();
        const issuedAt = Math.floor(Date.now() / 1000);
        const expiresIn = options.expiresIn || JWT_EXPIRES_IN;

        // Calcular tempo de expiração
        const expirationTime = jwt.decode(jwt.sign({}, JWT_SECRET, { expiresIn })).exp;

        const payload = {
            userId: userData.userId,
            sessionId,
            role: userData.role,
            permissions: userData.permissions || [],
            isAdmin: userData.isAdmin || false,
            iat: issuedAt,
            jti: generateJTI() // JWT ID único
        };

        const token = jwt.sign(payload, JWT_SECRET, {
            expiresIn,
            issuer: 'mainframe-assistant-api',
            audience: 'mainframe-users',
            algorithm: 'HS256'
        });

        // Salvar sessão no cache
        const sessionKey = `session:${userData.userId}:${sessionId}`;
        await cache.set(sessionKey, {
            userId: userData.userId,
            sessionId,
            token,
            issuedAt: new Date(issuedAt * 1000).toISOString(),
            expiresAt: new Date(expirationTime * 1000).toISOString(),
            ip: options.ip,
            userAgent: options.userAgent,
            createdAt: new Date().toISOString()
        }, Math.floor((expirationTime - issuedAt)));

        return {
            token,
            sessionId,
            expiresAt: new Date(expirationTime * 1000).toISOString(),
            issuedAt: new Date(issuedAt * 1000).toISOString()
        };

    } catch (error) {
        logger.error('Erro ao gerar token:', error);
        throw error;
    }
};

/**
 * Middleware para refresh automático de tokens
 */
const refreshTokenMiddleware = async (req, res, next) => {
    try {
        // Verificar se usuário está autenticado e tem token válido
        if (req.user && req.user.tokenExpiresAt) {
            const expirationTime = req.user.tokenExpiresAt.getTime();
            const currentTime = Date.now();
            const timeUntilExpiration = expirationTime - currentTime;

            // Se expira em menos de 15 minutos, gerar novo token
            if (timeUntilExpiration < 15 * 60 * 1000 && timeUntilExpiration > 0) {
                try {
                    const newTokenData = await generateToken({
                        userId: req.user.id,
                        sessionId: req.user.sessionId,
                        role: req.user.role,
                        permissions: req.user.permissions
                    });

                    // Adicionar novo token ao header da resposta
                    res.setHeader('X-New-Token', newTokenData.token);
                    res.setHeader('X-Token-Expires', newTokenData.expiresAt);

                    // Atualizar blacklist com token antigo
                    const oldToken = extractToken(req);
                    if (oldToken) {
                        await cache.set(
                            `blacklist:${oldToken}`,
                            'refreshed',
                            Math.ceil(timeUntilExpiration / 1000)
                        );
                    }

                    logger.info(`Token renovado automaticamente para usuário ${req.user.id}`);

                } catch (refreshError) {
                    logger.error('Erro ao renovar token:', refreshError);
                    // Não falhar a requisição, apenas logar o erro
                }
            }
        }

        next();

    } catch (error) {
        logger.error('Erro no middleware de refresh:', error);
        next(); // Continuar mesmo com erro no refresh
    }
};

// ==================== FUNÇÕES AUXILIARES ====================

/**
 * Extrair token do header Authorization
 */
function extractToken(req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }
    return null;
}

/**
 * Gerar ID de sessão único
 */
function generateSessionId() {
    return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Gerar JWT ID único
 */
function generateJTI() {
    return `jti_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Obter IP do cliente
 */
function getClientIp(req) {
    return req.headers['x-forwarded-for'] ||
           req.headers['x-real-ip'] ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           req.ip ||
           'unknown';
}

/**
 * Registrar tentativa de autenticação
 */
async function logAuthAttempt(data) {
    try {
        // Registrar em cache para analytics rápidas
        const logKey = `auth_log:${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        await cache.set(logKey, data, 24 * 60 * 60); // 24 horas

        // Registrar métricas
        await metricsService.recordAuthAttempt(data);

    } catch (error) {
        logger.error('Erro ao registrar tentativa de auth:', error);
    }
}

/**
 * Validar força da senha
 */
function validatePasswordStrength(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    const errors = [];

    if (password.length < minLength) {
        errors.push(`Senha deve ter pelo menos ${minLength} caracteres`);
    }
    if (!hasUpperCase) {
        errors.push('Senha deve conter pelo menos uma letra maiúscula');
    }
    if (!hasLowerCase) {
        errors.push('Senha deve conter pelo menos uma letra minúscula');
    }
    if (!hasNumbers) {
        errors.push('Senha deve conter pelo menos um número');
    }
    if (!hasSpecialChar) {
        errors.push('Senha deve conter pelo menos um caractere especial');
    }

    return {
        isValid: errors.length === 0,
        errors,
        score: [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar, password.length >= minLength]
            .filter(Boolean).length
    };
}

/**
 * Hash da senha
 */
async function hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
}

/**
 * Verificar senha
 */
async function verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
}

/**
 * Buscar usuário por ID (placeholder - implementar com banco real)
 */
async function getUserById(userId) {
    try {
        // TODO: Implementar busca real no banco de dados
        const user = {
            id: userId,
            email: 'user@example.com',
            name: 'Usuario Teste',
            role: 'user',
            permissions: ['incidents.read', 'incidents.create'],
            isAdmin: false,
            active: true,
            settings: {
                strictIpValidation: false,
                twoFactorEnabled: false
            },
            lastLogin: new Date().toISOString(),
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: new Date().toISOString()
        };

        return user;
    } catch (error) {
        logger.error('Erro ao buscar usuário:', error);
        return null;
    }
}

module.exports = {
    enhancedAuthMiddleware,
    roleMiddleware,
    permissionMiddleware,
    loginRateLimiter,
    logoutMiddleware,
    refreshTokenMiddleware,
    generateToken,
    extractToken,
    validatePasswordStrength,
    hashPassword,
    verifyPassword,
    getClientIp,
    generateSessionId,
    generateJTI
};