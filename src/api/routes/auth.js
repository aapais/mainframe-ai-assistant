const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../middleware/auth');
const { authRateLimit } = require('../middleware/rateLimit');
const { Logger } = require('../../utils/Logger');

const router = express.Router();
const logger = new Logger('AuthAPI');

// Rate limiting específico para autenticação
router.use(authRateLimit);

/**
 * @route POST /api/auth/login
 * @desc Autenticar usuário
 * @access Public
 */
router.post('/login',
    [
        body('email')
            .isEmail()
            .withMessage('Email inválido')
            .normalizeEmail(),
        body('password')
            .isLength({ min: 6 })
            .withMessage('Senha deve ter pelo menos 6 caracteres')
    ],
    async (req, res) => {
        try {
            // Validar entrada
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const { email, password } = req.body;

            logger.info(`Tentativa de login para: ${email}`);

            // Buscar usuário (integrar com banco de dados real)
            const user = await getUserByEmail(email);

            if (!user) {
                logger.warn(`Login falhou - usuário não encontrado: ${email}`);
                return res.status(401).json({
                    success: false,
                    message: 'Credenciais inválidas'
                });
            }

            // Verificar senha
            const isValidPassword = await bcrypt.compare(password, user.passwordHash);

            if (!isValidPassword) {
                logger.warn(`Login falhou - senha incorreta: ${email}`);
                return res.status(401).json({
                    success: false,
                    message: 'Credenciais inválidas'
                });
            }

            // Verificar se usuário está ativo
            if (!user.active) {
                logger.warn(`Login falhou - usuário inativo: ${email}`);
                return res.status(401).json({
                    success: false,
                    message: 'Conta desativada'
                });
            }

            // Gerar token
            const token = generateToken(user.id);

            // Atualizar último login
            await updateLastLogin(user.id);

            // Resposta de sucesso
            const userData = {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                permissions: user.permissions
            };

            logger.info(`Login bem-sucedido: ${email}`);

            res.json({
                success: true,
                message: 'Login realizado com sucesso',
                user: userData,
                token
            });

        } catch (error) {
            logger.error('Erro no login:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
);

/**
 * @route POST /api/auth/register
 * @desc Registrar novo usuário (apenas admins)
 * @access Private (Admin)
 */
router.post('/register',
    [
        body('email')
            .isEmail()
            .withMessage('Email inválido')
            .normalizeEmail(),
        body('password')
            .isLength({ min: 8 })
            .withMessage('Senha deve ter pelo menos 8 caracteres')
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
            .withMessage('Senha deve conter pelo menos: 1 minúscula, 1 maiúscula, 1 número e 1 caractere especial'),
        body('name')
            .isLength({ min: 2, max: 100 })
            .withMessage('Nome deve ter entre 2 e 100 caracteres'),
        body('role')
            .isIn(['user', 'analyst', 'admin'])
            .withMessage('Role inválido')
    ],
    async (req, res) => {
        try {
            // Validar entrada
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const { email, password, name, role } = req.body;

            // Verificar se usuário já existe
            const existingUser = await getUserByEmail(email);
            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: 'Email já está em uso'
                });
            }

            // Hash da senha
            const saltRounds = 12;
            const passwordHash = await bcrypt.hash(password, saltRounds);

            // Criar usuário
            const newUser = await createUser({
                email,
                passwordHash,
                name,
                role,
                active: true,
                createdAt: new Date().toISOString(),
                permissions: getDefaultPermissions(role)
            });

            logger.info(`Usuário criado: ${email} (${role})`);

            res.status(201).json({
                success: true,
                message: 'Usuário criado com sucesso',
                user: {
                    id: newUser.id,
                    email: newUser.email,
                    name: newUser.name,
                    role: newUser.role
                }
            });

        } catch (error) {
            logger.error('Erro no registro:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
);

/**
 * @route POST /api/auth/change-password
 * @desc Alterar senha do usuário
 * @access Private
 */
router.post('/change-password',
    [
        body('currentPassword')
            .isLength({ min: 6 })
            .withMessage('Senha atual é obrigatória'),
        body('newPassword')
            .isLength({ min: 8 })
            .withMessage('Nova senha deve ter pelo menos 8 caracteres')
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
            .withMessage('Nova senha deve conter pelo menos: 1 minúscula, 1 maiúscula, 1 número e 1 caractere especial')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            // Este endpoint requer autenticação (implementar middleware)
            // Por ora, simular autenticação
            const userId = req.headers['x-user-id']; // Placeholder
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Autenticação requerida'
                });
            }

            const { currentPassword, newPassword } = req.body;

            // Buscar usuário
            const user = await getUserById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'Usuário não encontrado'
                });
            }

            // Verificar senha atual
            const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
            if (!isValidPassword) {
                return res.status(401).json({
                    success: false,
                    message: 'Senha atual incorreta'
                });
            }

            // Hash da nova senha
            const saltRounds = 12;
            const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

            // Atualizar senha
            await updateUserPassword(userId, newPasswordHash);

            logger.info(`Senha alterada para usuário: ${user.email}`);

            res.json({
                success: true,
                message: 'Senha alterada com sucesso'
            });

        } catch (error) {
            logger.error('Erro ao alterar senha:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
);

/**
 * @route POST /api/auth/logout
 * @desc Logout do usuário
 * @access Private
 */
router.post('/logout', (req, res) => {
    try {
        // Em implementação com JWT stateless, o logout é feito no cliente
        // Aqui podemos invalidar o token se tivermos blacklist

        logger.info('Logout realizado');

        res.json({
            success: true,
            message: 'Logout realizado com sucesso'
        });

    } catch (error) {
        logger.error('Erro no logout:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

/**
 * @route GET /api/auth/me
 * @desc Obter dados do usuário autenticado
 * @access Private
 */
router.get('/me', async (req, res) => {
    try {
        // Placeholder - implementar middleware de autenticação
        const userId = req.headers['x-user-id'];
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Autenticação requerida'
            });
        }

        const user = await getUserById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Usuário não encontrado'
            });
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                permissions: user.permissions,
                lastLogin: user.lastLogin
            }
        });

    } catch (error) {
        logger.error('Erro ao buscar dados do usuário:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Funções auxiliares (integrar com banco de dados real)
async function getUserByEmail(email) {
    // Simulação - implementar com banco real
    const users = {
        'admin@banco.com': {
            id: '1',
            email: 'admin@banco.com',
            passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj0gPi.F4VZi', // password123
            name: 'Admin Sistema',
            role: 'admin',
            active: true,
            permissions: ['read', 'write', 'admin']
        },
        'analista@banco.com': {
            id: '2',
            email: 'analista@banco.com',
            passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj0gPi.F4VZi',
            name: 'Analista Incidentes',
            role: 'analyst',
            active: true,
            permissions: ['read', 'write']
        }
    };

    return users[email] || null;
}

async function getUserById(id) {
    // Simulação - implementar com banco real
    const user = await getUserByEmail('admin@banco.com');
    return user && user.id === id ? user : null;
}

async function createUser(userData) {
    // Simulação - implementar com banco real
    return {
        id: Math.random().toString(36).substr(2, 9),
        ...userData
    };
}

async function updateLastLogin(userId) {
    // Simulação - implementar com banco real
    logger.info(`Último login atualizado para usuário ${userId}`);
}

async function updateUserPassword(userId, passwordHash) {
    // Simulação - implementar com banco real
    logger.info(`Senha atualizada para usuário ${userId}`);
}

function getDefaultPermissions(role) {
    const permissionsByRole = {
        'user': ['read'],
        'analyst': ['read', 'write'],
        'admin': ['read', 'write', 'admin']
    };

    return permissionsByRole[role] || ['read'];
}

module.exports = router;