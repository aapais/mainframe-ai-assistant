const jwt = require('jsonwebtoken');
const { Logger } = require('../../utils/Logger');

const logger = new Logger('AuthMiddleware');

/**
 * Middleware de autenticação JWT
 */
const authMiddleware = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token de acesso requerido',
      });
    }

    // Verificar e decodificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');

    // Buscar informações do usuário (integrar com banco de dados)
    const user = await getUserById(decoded.userId);

    if (!user || !user.active) {
      return res.status(401).json({
        success: false,
        message: 'Usuário inválido ou inativo',
      });
    }

    // Adicionar informações do usuário à requisição
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isAdmin: user.role === 'admin',
      permissions: user.permissions || [],
      lastLogin: user.lastLogin,
    };

    // Log de acesso
    logger.info(`Usuário autenticado: ${user.email} (${user.role})`);

    next();
  } catch (error) {
    logger.error('Erro na autenticação:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido',
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Erro interno de autenticação',
    });
  }
};

/**
 * Extrair token do header ou query
 */
function extractToken(req) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Fallback para query parameter (não recomendado para produção)
  return req.query.token;
}

/**
 * Buscar usuário por ID (integrar com banco de dados)
 */
async function getUserById(userId) {
  // Simulação - implementar com banco real
  const users = {
    1: {
      id: '1',
      email: 'admin@banco.com',
      name: 'Admin Sistema',
      role: 'admin',
      active: true,
      permissions: ['read', 'write', 'admin'],
      lastLogin: new Date().toISOString(),
    },
    2: {
      id: '2',
      email: 'analista@banco.com',
      name: 'Analista Incidentes',
      role: 'analyst',
      active: true,
      permissions: ['read', 'write'],
      lastLogin: new Date().toISOString(),
    },
    3: {
      id: '3',
      email: 'usuario@banco.com',
      name: 'Usuário Final',
      role: 'user',
      active: true,
      permissions: ['read'],
      lastLogin: new Date().toISOString(),
    },
  };

  return users[userId] || null;
}

/**
 * Middleware opcional de autenticação
 */
const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
      const user = await getUserById(decoded.userId);

      if (user && user.active) {
        req.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isAdmin: user.role === 'admin',
          permissions: user.permissions || [],
        };
      }
    }

    next();
  } catch (error) {
    // Em middleware opcional, erros de token não impedem o acesso
    logger.warn('Token inválido em middleware opcional:', error.message);
    next();
  }
};

/**
 * Gerar token JWT
 */
function generateToken(userId, options = {}) {
  const payload = {
    userId,
    iat: Math.floor(Date.now() / 1000),
  };

  const defaultOptions = {
    expiresIn: '24h',
    issuer: 'banking-incident-system',
  };

  return jwt.sign(payload, process.env.JWT_SECRET || 'default_secret', {
    ...defaultOptions,
    ...options,
  });
}

/**
 * Middleware para refresh de token
 */
const refreshTokenMiddleware = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado',
      });
    }

    // Verificar se o token precisa ser renovado (menos de 2 horas para expirar)
    const token = extractToken(req);
    const decoded = jwt.decode(token);
    const timeToExpiry = decoded.exp - Math.floor(Date.now() / 1000);

    if (timeToExpiry < 7200) {
      // 2 horas
      const newToken = generateToken(req.user.id);

      res.setHeader('X-New-Token', newToken);
      logger.info(`Token renovado para usuário ${req.user.id}`);
    }

    next();
  } catch (error) {
    logger.error('Erro no refresh de token:', error);
    next(); // Não bloqueia a requisição
  }
};

module.exports = {
  authMiddleware,
  optionalAuthMiddleware,
  refreshTokenMiddleware,
  generateToken,
};
