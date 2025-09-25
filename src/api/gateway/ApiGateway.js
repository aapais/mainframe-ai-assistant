const express = require('express');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const cors = require('cors');
const helmet = require('helmet');
const { Logger } = require('../../utils/Logger');
const { MetricsService } = require('../../services/MetricsService');
const { RedisCache } = require('../../services/cache/RedisCache');
const { CircuitBreaker } = require('./CircuitBreaker');

const logger = new Logger('ApiGateway');

/**
 * API Gateway com rate limiting, circuit breaker e roteamento
 * Centralizador de todas as requisições HTTP para os microserviços
 */
class ApiGateway {
  constructor(options = {}) {
    this.options = {
      port: options.port || 3000,
      rateLimitWindow: options.rateLimitWindow || 15 * 60 * 1000, // 15 minutos
      rateLimitMax: options.rateLimitMax || 100, // requests por window
      corsOrigins: options.corsOrigins || ['http://localhost:3000'],
      enableMetrics: options.enableMetrics !== false,
      enableCompression: options.enableCompression !== false,
      enableCircuitBreaker: options.enableCircuitBreaker !== false,
      ...options,
    };

    this.app = express();
    this.server = null;
    this.metricsService = new MetricsService();
    this.cache = new RedisCache();
    this.circuitBreakers = new Map();
    this.routes = new Map();
    this.middleware = new Map();
    this.initialized = false;
  }

  /**
   * Inicializar API Gateway
   */
  async initialize() {
    try {
      if (this.initialized) {
        return;
      }

      logger.info('Inicializando API Gateway...');

      // Configurar middleware base
      await this.setupBaseMiddleware();

      // Configurar rate limiting
      this.setupRateLimiting();

      // Configurar circuit breakers
      if (this.options.enableCircuitBreaker) {
        this.setupCircuitBreakers();
      }

      // Configurar métricas
      if (this.options.enableMetrics) {
        this.setupMetrics();
      }

      // Configurar rotas
      this.setupRoutes();

      // Configurar error handling
      this.setupErrorHandling();

      this.initialized = true;
      logger.info('API Gateway inicializado com sucesso');
    } catch (error) {
      logger.error('Erro ao inicializar API Gateway:', error);
      throw error;
    }
  }

  /**
   * Configurar middleware base
   */
  async setupBaseMiddleware() {
    // Middleware de request ID único
    this.app.use((req, res, next) => {
      req.requestId = this.generateRequestId();
      res.setHeader('X-Request-ID', req.requestId);
      req.startTime = Date.now();
      next();
    });

    // Segurança com Helmet
    this.app.use(
      helmet({
        crossOriginEmbedderPolicy: false,
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'", 'ws:', 'wss:'],
            fontSrc: ["'self'", 'https:', 'data:'],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
          },
        },
      })
    );

    // CORS
    this.app.use(
      cors({
        origin: this.options.corsOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'X-Requested-With',
          'X-Request-ID',
          'Accept',
          'Cache-Control',
        ],
        exposedHeaders: [
          'X-Request-ID',
          'X-Rate-Limit-Limit',
          'X-Rate-Limit-Remaining',
          'X-Rate-Limit-Reset',
          'X-New-Token',
          'X-Token-Expires',
        ],
      })
    );

    // Compressão de resposta
    if (this.options.enableCompression) {
      this.app.use(
        compression({
          filter: (req, res) => {
            if (req.headers['x-no-compression']) {
              return false;
            }
            return compression.filter(req, res);
          },
          threshold: 1024, // Comprimir apenas responses > 1KB
        })
      );
    }

    // Parsing de body
    this.app.use(
      express.json({
        limit: '10mb',
        strict: false,
      })
    );

    this.app.use(
      express.urlencoded({
        extended: true,
        limit: '10mb',
      })
    );

    // Log de requisições
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.url} - ${req.ip} - ${req.headers['user-agent']}`);
      next();
    });
  }

  /**
   * Configurar rate limiting
   */
  setupRateLimiting() {
    // Rate limiting global
    const globalLimiter = rateLimit({
      windowMs: this.options.rateLimitWindow,
      max: this.options.rateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: req => {
        return req.user?.id || req.ip;
      },
      message: {
        success: false,
        message: 'Muitas requisições. Tente novamente mais tarde.',
        code: 'RATE_LIMIT_EXCEEDED',
      },
      onLimitReached: (req, res) => {
        logger.warn(`Rate limit atingido para ${req.user?.id || req.ip}: ${req.method} ${req.url}`);
        this.recordMetric('rate_limit_exceeded', {
          userId: req.user?.id,
          ip: req.ip,
          endpoint: req.url,
          method: req.method,
        });
      },
    });

    this.app.use('/api/', globalLimiter);

    // Rate limiters específicos
    this.addRateLimiter('auth', {
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 5, // 5 tentativas de login por IP
      skipSuccessfulRequests: true,
    });

    this.addRateLimiter('search', {
      windowMs: 60 * 1000, // 1 minuto
      max: 20, // 20 buscas por minuto por usuário
      keyGenerator: req => req.user?.id || req.ip,
    });

    this.addRateLimiter('upload', {
      windowMs: 60 * 60 * 1000, // 1 hora
      max: 10, // 10 uploads por hora
      keyGenerator: req => req.user?.id || req.ip,
    });
  }

  /**
   * Adicionar rate limiter específico
   */
  addRateLimiter(name, options) {
    const limiter = rateLimit({
      ...options,
      message: {
        success: false,
        message: `Rate limit exceeded for ${name}`,
        code: 'RATE_LIMIT_EXCEEDED',
        type: name,
      },
    });

    this.middleware.set(`rateLimit:${name}`, limiter);
    return limiter;
  }

  /**
   * Configurar circuit breakers
   */
  setupCircuitBreakers() {
    // Circuit breaker para serviços externos
    this.addCircuitBreaker('database', {
      failureThreshold: 5,
      timeout: 30000,
      resetTimeout: 60000,
    });

    this.addCircuitBreaker('cache', {
      failureThreshold: 3,
      timeout: 10000,
      resetTimeout: 30000,
    });

    this.addCircuitBreaker('search_service', {
      failureThreshold: 5,
      timeout: 20000,
      resetTimeout: 45000,
    });
  }

  /**
   * Adicionar circuit breaker
   */
  addCircuitBreaker(name, options) {
    const circuitBreaker = new CircuitBreaker(options);
    this.circuitBreakers.set(name, circuitBreaker);

    circuitBreaker.on('open', () => {
      logger.warn(`Circuit breaker '${name}' opened`);
      this.recordMetric('circuit_breaker_opened', { service: name });
    });

    circuitBreaker.on('halfOpen', () => {
      logger.info(`Circuit breaker '${name}' half-open`);
    });

    circuitBreaker.on('close', () => {
      logger.info(`Circuit breaker '${name}' closed`);
      this.recordMetric('circuit_breaker_closed', { service: name });
    });

    return circuitBreaker;
  }

  /**
   * Configurar métricas
   */
  setupMetrics() {
    // Middleware de métricas
    this.app.use((req, res, next) => {
      res.on('finish', () => {
        const duration = Date.now() - req.startTime;

        this.recordMetric('http_request', {
          method: req.method,
          path: req.route?.path || req.url,
          statusCode: res.statusCode,
          duration,
          userId: req.user?.id,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
      });

      next();
    });

    // Endpoint de métricas (protegido)
    this.app.get('/api/gateway/metrics', this.requireAdmin(), async (req, res) => {
      try {
        const metrics = await this.getMetrics();
        res.json({
          success: true,
          data: metrics,
        });
      } catch (error) {
        logger.error('Erro ao obter métricas:', error);
        res.status(500).json({
          success: false,
          message: 'Erro ao obter métricas',
        });
      }
    });
  }

  /**
   * Configurar rotas
   */
  setupRoutes() {
    // Health check
    this.app.get('/api/gateway/health', async (req, res) => {
      try {
        const health = await this.performHealthCheck();
        const statusCode = health.status === 'healthy' ? 200 : 503;

        res.status(statusCode).json({
          success: health.status === 'healthy',
          data: health,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Health check failed',
        });
      }
    });

    // Status do gateway
    this.app.get('/api/gateway/status', this.requireAdmin(), (req, res) => {
      res.json({
        success: true,
        data: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          circuitBreakers: this.getCircuitBreakerStatus(),
          rateLimiters: this.getRateLimiterStatus(),
          routes: this.getRouteStatus(),
          timestamp: new Date().toISOString(),
        },
      });
    });

    // Rota para reconfiguração dinâmica (admin apenas)
    this.app.post('/api/gateway/reconfigure', this.requireAdmin(), async (req, res) => {
      try {
        await this.reconfigure(req.body);
        res.json({
          success: true,
          message: 'Gateway reconfigurado com sucesso',
        });
      } catch (error) {
        logger.error('Erro na reconfiguração:', error);
        res.status(500).json({
          success: false,
          message: 'Erro na reconfiguração',
        });
      }
    });
  }

  /**
   * Configurar error handling
   */
  setupErrorHandling() {
    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        message: 'Endpoint não encontrado',
        code: 'ENDPOINT_NOT_FOUND',
        path: req.originalUrl,
        method: req.method,
        requestId: req.requestId,
      });
    });

    // Error handler global
    // eslint-disable-next-line no-unused-vars
    this.app.use((error, req, res, next) => {
      const statusCode = error.statusCode || error.status || 500;

      logger.error(`Erro na requisição ${req.requestId}:`, {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        user: req.user?.id,
      });

      // Registrar erro nas métricas
      this.recordMetric('http_error', {
        statusCode,
        path: req.url,
        method: req.method,
        userId: req.user?.id,
        error: error.name || 'UnknownError',
      });

      res.status(statusCode).json({
        success: false,
        message: statusCode === 500 ? 'Erro interno do servidor' : error.message,
        code: error.code || 'INTERNAL_ERROR',
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
      });
    });
  }

  /**
   * Adicionar rota com middleware personalizado
   */
  addRoute(path, router, middlewares = []) {
    const routeMiddlewares = [...middlewares, this.createRouteHandler(router)];

    this.app.use(path, ...routeMiddlewares);
    this.routes.set(path, {
      router,
      middlewares: middlewares.map(m => m.name || 'anonymous'),
      registeredAt: new Date().toISOString(),
    });

    logger.info(`Rota registrada: ${path}`);
  }

  /**
   * Criar handler de rota com circuit breaker
   */
  createRouteHandler(router) {
    return async (req, res, next) => {
      try {
        // Executar com circuit breaker se disponível
        const serviceName = this.getServiceNameFromPath(req.baseUrl);
        const circuitBreaker = this.circuitBreakers.get(serviceName);

        if (circuitBreaker) {
          await circuitBreaker.call(async () => {
            return new Promise((resolve, reject) => {
              router(req, res, err => {
                if (err) reject(err);
                else resolve();
              });
            });
          });
        } else {
          router(req, res, next);
        }
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Middleware para verificar se usuário é admin
   */
  requireAdmin() {
    return (req, res, next) => {
      if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Acesso negado. Privilégios de administrador necessários.',
          code: 'ADMIN_REQUIRED',
        });
      }
      next();
    };
  }

  /**
   * Iniciar servidor
   */
  async start() {
    try {
      await this.initialize();

      this.server = this.app.listen(this.options.port, () => {
        logger.info(`API Gateway rodando na porta ${this.options.port}`);
        logger.info(
          `Rate limiting: ${this.options.rateLimitMax} req/${this.options.rateLimitWindow}ms`
        );
        logger.info(`CORS origins: ${this.options.corsOrigins.join(', ')}`);
      });

      this.server.on('error', error => {
        logger.error('Erro no servidor do Gateway:', error);
        throw error;
      });

      return this.server;
    } catch (error) {
      logger.error('Erro ao iniciar API Gateway:', error);
      throw error;
    }
  }

  /**
   * Parar servidor gracefully
   */
  async stop() {
    try {
      logger.info('Parando API Gateway...');

      if (this.server) {
        await new Promise((resolve, reject) => {
          this.server.close(error => {
            if (error) reject(error);
            else resolve();
          });
        });
      }

      // Fechar circuit breakers
      // eslint-disable-next-line no-unused-vars
      for (const [name, cb] of this.circuitBreakers) {
        await cb.shutdown();
      }

      logger.info('API Gateway parado com sucesso');
    } catch (error) {
      logger.error('Erro ao parar API Gateway:', error);
      throw error;
    }
  }

  // ==================== MÉTODOS AUXILIARES ====================

  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  getServiceNameFromPath(path) {
    const parts = path.split('/');
    return parts[2] || 'unknown'; // /api/incidents -> incidents
  }

  async recordMetric(type, data) {
    try {
      if (this.options.enableMetrics) {
        await this.metricsService.record(type, {
          ...data,
          timestamp: new Date().toISOString(),
          source: 'api_gateway',
        });
      }
    } catch (error) {
      logger.error('Erro ao registrar métrica:', error);
    }
  }

  async getMetrics() {
    return await this.metricsService.getGatewayMetrics();
  }

  getCircuitBreakerStatus() {
    const status = {};
    for (const [name, cb] of this.circuitBreakers) {
      status[name] = cb.getStatus();
    }
    return status;
  }

  getRateLimiterStatus() {
    // TODO: Implementar status dos rate limiters
    return {};
  }

  getRouteStatus() {
    const status = {};
    for (const [path, route] of this.routes) {
      status[path] = {
        middlewares: route.middlewares,
        registeredAt: route.registeredAt,
      };
    }
    return status;
  }

  async performHealthCheck() {
    const checks = [];

    // Verificar circuit breakers
    for (const [name, cb] of this.circuitBreakers) {
      checks.push({
        component: `circuitBreaker:${name}`,
        status: cb.getStatus().state === 'CLOSED' ? 'healthy' : 'degraded',
      });
    }

    // Verificar memória
    const memUsage = process.memoryUsage();
    const memThreshold = 512 * 1024 * 1024; // 512MB
    checks.push({
      component: 'memory',
      status: memUsage.heapUsed < memThreshold ? 'healthy' : 'degraded',
      details: memUsage,
    });

    // Status geral
    const unhealthyCount = checks.filter(c => c.status === 'unhealthy').length;
    const degradedCount = checks.filter(c => c.status === 'degraded').length;

    let overall = 'healthy';
    if (unhealthyCount > 0) {
      overall = 'unhealthy';
    } else if (degradedCount > 0) {
      overall = 'degraded';
    }

    return {
      status: overall,
      components: checks,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  async reconfigure(config) {
    // TODO: Implementar reconfiguração dinâmica
    logger.info('Reconfiguração solicitada:', config);
  }
}

module.exports = { ApiGateway };
