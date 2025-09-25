const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const { Logger } = require('../../utils/Logger');

const logger = new Logger('RateLimitMiddleware');

/**
 * Rate limiting básico
 */
const basicRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por IP
  message: {
    success: false,
    message: 'Muitas requisições. Tente novamente em 15 minutos.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  onLimitReached: req => {
    logger.warn(`Rate limit atingido para IP: ${req.ip}`);
  },
});

/**
 * Rate limiting para APIs críticas
 */
const strictRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 50, // máximo 50 requests por IP
  message: {
    success: false,
    message: 'Limite de requisições excedido para esta API crítica.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  onLimitReached: req => {
    logger.warn(`Rate limit strict atingido para IP: ${req.ip}`);
  },
});

/**
 * Rate limiting para autenticação
 */
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máximo 10 tentativas de login
  message: {
    success: false,
    message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // não contar requests bem-sucedidos
  onLimitReached: req => {
    logger.warn(`Rate limit de autenticação atingido para IP: ${req.ip}`);
  },
});

/**
 * Slow down progressivo
 */
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutos
  delayAfter: 50, // começar a adicionar delay após 50 requests
  delayMs: 500, // delay inicial de 500ms
  maxDelayMs: 5000, // delay máximo de 5 segundos
  onLimitReached: req => {
    logger.info(`Speed limiter ativado para IP: ${req.ip}`);
  },
});

/**
 * Rate limiting baseado em usuário autenticado
 */
const createUserRateLimit = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000,
    max = 200,
    message = 'Limite de requisições por usuário excedido',
  } = options;

  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message,
    },
    keyGenerator: req => {
      // Usar ID do usuário se autenticado, senão IP
      return req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
    },
    onLimitReached: req => {
      const identifier = req.user ? `usuário ${req.user.id}` : `IP ${req.ip}`;
      logger.warn(`Rate limit por usuário atingido para ${identifier}`);
    },
  });
};

/**
 * Rate limiting diferenciado por role
 */
const createRoleBasedRateLimit = () => {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: req => {
      if (!req.user) return 50; // Usuários não autenticados

      switch (req.user.role) {
        case 'admin':
          return 500; // Admins têm limite maior
        case 'analyst':
          return 300; // Analistas têm limite médio
        case 'user':
        default:
          return 100; // Usuários normais
      }
    },
    message: req => ({
      success: false,
      message: `Limite de requisições excedido para role ${req.user?.role || 'não autenticado'}`,
    }),
    keyGenerator: req => {
      return req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
    },
    onLimitReached: req => {
      const role = req.user?.role || 'não autenticado';
      logger.warn(`Rate limit baseado em role atingido: ${role}`);
    },
  });
};

/**
 * Rate limiting para endpoints de busca
 */
const searchRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30, // máximo 30 buscas por minuto
  message: {
    success: false,
    message: 'Muitas buscas realizadas. Aguarde um momento.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  onLimitReached: req => {
    logger.warn(`Rate limit de busca atingido para IP: ${req.ip}`);
  },
});

/**
 * Rate limiting para upload de arquivos
 */
const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10, // máximo 10 uploads por hora
  message: {
    success: false,
    message: 'Limite de uploads excedido. Tente novamente em 1 hora.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  onLimitReached: req => {
    logger.warn(`Rate limit de upload atingido para IP: ${req.ip}`);
  },
});

/**
 * Rate limiting dinâmico baseado em métricas do sistema
 */
const createDynamicRateLimit = () => {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: req => {
      // Ajustar limite baseado na carga do sistema
      const systemLoad = process.cpuUsage();
      const memoryUsage = process.memoryUsage();

      // Calcular fator de carga (0-1)
      const loadFactor = Math.min(1, systemLoad.user / 1000000 / 100); // Simplificado
      const memoryFactor = memoryUsage.used / memoryUsage.total;

      const systemStress = Math.max(loadFactor, memoryFactor);

      // Reduzir limite quando sistema está sob stress
      const baseLimit = 100;
      const adjustedLimit = Math.floor(baseLimit * (1 - systemStress * 0.5));

      return Math.max(adjustedLimit, 10); // Mínimo de 10 requests
    },
    message: {
      success: false,
      message: 'Sistema sob alta carga. Limite de requisições reduzido temporariamente.',
    },
    onLimitReached: req => {
      logger.warn(`Rate limit dinâmico atingido para IP: ${req.ip}`);
    },
  });
};

/**
 * Middleware para monitoramento de uso
 */
const usageMonitoringMiddleware = (req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;

    // Log de métricas de uso
    logger.info('Request metrics', {
      ip: req.ip,
      user: req.user?.id,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
    });

    // Alertar sobre requests muito lentos
    if (duration > 5000) {
      logger.warn(`Request lento detectado: ${duration}ms para ${req.originalUrl}`);
    }
  });

  next();
};

/**
 * Configuração de rate limiting principal
 */
const rateLimitMiddleware = (req, res, next) => {
  // Aplicar diferentes limiters baseado na rota
  const path = req.path;

  if (path.includes('/auth/')) {
    return authRateLimit(req, res, next);
  }

  if (path.includes('/search')) {
    return searchRateLimit(req, res, next);
  }

  if (path.includes('/upload')) {
    return uploadRateLimit(req, res, next);
  }

  if (path.includes('/admin/')) {
    return strictRateLimit(req, res, next);
  }

  // Rate limiting padrão
  return basicRateLimit(req, res, next);
};

module.exports = {
  rateLimitMiddleware,
  basicRateLimit,
  strictRateLimit,
  authRateLimit,
  searchRateLimit,
  uploadRateLimit,
  speedLimiter,
  createUserRateLimit,
  createRoleBasedRateLimit,
  createDynamicRateLimit,
  usageMonitoringMiddleware,
};
