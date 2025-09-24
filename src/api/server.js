const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const { Logger } = require('../utils/Logger');

// API Gateway
const { ApiGateway } = require('./gateway/ApiGateway');

// Routes
const incidentsRouter = require('./routes/incidents');
const knowledgeRouter = require('./routes/knowledge');
const searchRouter = require('./routes/search');
const authRouter = require('./routes/auth');

// Middleware
const { usageMonitoringMiddleware, rateLimitMiddleware } = require('./middleware/rateLimit');
const { refreshTokenMiddleware, enhancedAuthMiddleware } = require('./middleware/enhanced-auth');
const { validationMiddleware } = require('./middleware/validation');

// WebSocket
const { WebSocketNotifier } = require('./websocket/notifications');

// Services
const { IncidentResolutionEngine } = require('../controllers/IncidentResolutionEngine');

const logger = new Logger('APIServer');

/**
 * Servidor principal da API com API Gateway e WebSocket
 */
class APIServer {
    constructor(config = {}) {
        this.config = {
            port: process.env.PORT || 3000,
            wsPort: process.env.WS_PORT || 8080,
            env: process.env.NODE_ENV || 'development',
            corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000'],
            enableGateway: config.enableGateway !== false,
            enableWebSocket: config.enableWebSocket !== false,
            ...config
        };

        this.app = express();
        this.server = null;
        this.resolutionEngine = null;
        this.apiGateway = null;
        this.wsNotifier = null;
    }

    /**
     * Configurar API Gateway ou middleware tradicional
     */
    async setupGatewayOrMiddleware() {
        if (this.config.enableGateway) {
            // Usar API Gateway
            this.apiGateway = new ApiGateway({
                port: this.config.port,
                corsOrigins: this.config.corsOrigins,
                rateLimitWindow: 15 * 60 * 1000, // 15 minutos
                rateLimitMax: 100 // requests por window
            });

            await this.apiGateway.initialize();
            this.app = this.apiGateway.app;

            logger.info('API Gateway configurado');
        } else {
            // Middleware tradicional
            this.setupTraditionalMiddleware();
        }
    }

    /**
     * Configurar middleware tradicional (fallback)
     */
    setupTraditionalMiddleware() {
        // Security
        this.app.use(helmet({
            crossOriginEmbedderPolicy: false,
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'", "ws:", "wss:"],
                },
            },
        }));

        // CORS
        this.app.use(cors({
            origin: this.config.corsOrigins,
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-ID']
        }));

        // Compression
        this.app.use(compression());

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Monitoring
        this.app.use(usageMonitoringMiddleware);

        // Refresh token middleware para rotas autenticadas
        this.app.use('/api', refreshTokenMiddleware);

        // Static files (React build)
        if (this.config.env === 'production') {
            this.app.use(express.static(path.join(__dirname, '../../build')));
        }
    }

    /**
     * Configurar rotas no API Gateway ou app tradicional
     */
    setupRoutes() {
        if (this.config.enableGateway && this.apiGateway) {
            // Registrar rotas no API Gateway
            this.apiGateway.addRoute('/api/auth', authRouter);
            this.apiGateway.addRoute('/api/incidents', incidentsRouter, [enhancedAuthMiddleware]);
            this.apiGateway.addRoute('/api/knowledge', knowledgeRouter, [enhancedAuthMiddleware]);
            this.apiGateway.addRoute('/api/search', searchRouter, [enhancedAuthMiddleware]);

            logger.info('Rotas registradas no API Gateway');
        } else {
            // Configuração tradicional de rotas
            this.setupTraditionalRoutes();
        }
    }

    /**
     * Configurar rotas tradicionais (fallback)
     */
    setupTraditionalRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                version: process.env.npm_package_version || '2.0.0'
            });
        });

        // API routes
        this.app.use('/api/auth', authRouter);
        this.app.use('/api/incidents', incidentsRouter);
        this.app.use('/api/knowledge', knowledgeRouter);
        this.app.use('/api/search', searchRouter);

        // Catch all para React Router (apenas em produção)
        if (this.config.env === 'production') {
            this.app.get('*', (req, res) => {
                res.sendFile(path.join(__dirname, '../../build/index.html'));
            });
        }

        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({
                success: false,
                message: 'Endpoint não encontrado',
                path: req.originalUrl
            });
        });
    }

    /**
     * Configurar error handling
     */
    setupErrorHandling() {
        // Error handler global
        this.app.use((error, req, res, next) => {
            logger.error('Erro não tratado na API:', error);

            // Não vazar detalhes em produção
            const message = this.config.env === 'production' ?
                'Erro interno do servidor' :
                error.message;

            res.status(error.status || 500).json({
                success: false,
                message,
                ...(this.config.env !== 'production' && { stack: error.stack })
            });
        });

        // Capturar erros não tratados
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception:', error);
            process.exit(1);
        });

        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
            process.exit(1);
        });
    }

    /**
     * Inicializar servidor
     */
    async initialize() {
        try {
            logger.info('Inicializando servidor API v2.0...');

            // Configurar API Gateway ou middleware tradicional
            await this.setupGatewayOrMiddleware();

            // Configurar rotas
            this.setupRoutes();

            // Configurar error handling
            this.setupErrorHandling();

            // Inicializar WebSocket se habilitado
            if (this.config.enableWebSocket) {
                this.wsNotifier = new WebSocketNotifier({
                    port: this.config.wsPort
                });
                await this.wsNotifier.initialize();
                logger.info(`WebSocket server inicializado na porta ${this.config.wsPort}`);
            }

            // Inicializar engine de resolução
            this.resolutionEngine = new IncidentResolutionEngine();
            await this.resolutionEngine.initialize();

            logger.info('Servidor API configurado com sucesso');

        } catch (error) {
            logger.error('Erro ao inicializar servidor:', error);
            throw error;
        }
    }

    /**
     * Iniciar servidor
     */
    async start() {
        try {
            await this.initialize();

            if (this.config.enableGateway && this.apiGateway) {
                // Iniciar via API Gateway
                this.server = await this.apiGateway.start();
            } else {
                // Iniciar servidor tradicional
                this.server = this.app.listen(this.config.port, () => {
                    logger.info(`Servidor API tradicional rodando na porta ${this.config.port}`);
                    logger.info(`Ambiente: ${this.config.env}`);
                    logger.info(`CORS origins: ${this.config.corsOrigins.join(', ')}`);
                });

                this.server.on('error', (error) => {
                    if (error.code === 'EADDRINUSE') {
                        logger.error(`Porta ${this.config.port} já está em uso`);
                    } else {
                        logger.error('Erro no servidor:', error);
                    }
                    process.exit(1);
                });
            }

            // Log de inicialização completa
            logger.info('='.repeat(60));
            logger.info('🚀 SISTEMA DE RESOLUÇÃO DE INCIDENTES v2.0');
            logger.info('='.repeat(60));
            logger.info(`📡 API Server: http://localhost:${this.config.port}`);
            if (this.config.enableWebSocket) {
                logger.info(`🔌 WebSocket: ws://localhost:${this.config.wsPort}`);
            }
            logger.info(`🌍 Ambiente: ${this.config.env}`);
            logger.info(`🛡️  API Gateway: ${this.config.enableGateway ? 'Habilitado' : 'Desabilitado'}`);
            logger.info(`📨 WebSocket: ${this.config.enableWebSocket ? 'Habilitado' : 'Desabilitado'}`);
            logger.info('='.repeat(60));

            return this.server;

        } catch (error) {
            logger.error('Erro ao iniciar servidor:', error);
            throw error;
        }
    }

    /**
     * Parar servidor gracefully
     */
    async stop() {
        try {
            logger.info('Parando servidor...');

            // Parar WebSocket
            if (this.wsNotifier) {
                await this.wsNotifier.shutdown();
                logger.info('WebSocket server parado');
            }

            // Parar API Gateway
            if (this.apiGateway) {
                await this.apiGateway.stop();
                logger.info('API Gateway parado');
            }

            // Parar engine de resolução
            if (this.resolutionEngine) {
                await this.resolutionEngine.shutdown();
            }

            // Fechar servidor HTTP
            if (this.server && !this.apiGateway) {
                await new Promise((resolve, reject) => {
                    this.server.close((error) => {
                        if (error) {
                            reject(error);
                        } else {
                            resolve();
                        }
                    });
                });
            }

            logger.info('Servidor parado com sucesso');

        } catch (error) {
            logger.error('Erro ao parar servidor:', error);
            throw error;
        }
    }

    /**
     * Getters para componentes (para testes e integração)
     */
    getApp() {
        return this.app;
    }

    getApiGateway() {
        return this.apiGateway;
    }

    getWebSocketNotifier() {
        return this.wsNotifier;
    }

    getResolutionEngine() {
        return this.resolutionEngine;
    }

    /**
     * Obter status do servidor
     */
    getStatus() {
        return {
            running: !!this.server,
            port: this.config.port,
            wsPort: this.config.wsPort,
            environment: this.config.env,
            gatewayEnabled: this.config.enableGateway,
            webSocketEnabled: this.config.enableWebSocket,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            version: '2.0.0'
        };
    }
}

// Executar servidor se chamado diretamente
if (require.main === module) {
    const server = new APIServer();

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
        logger.info(`Recebido sinal ${signal}, iniciando shutdown graceful...`);

        try {
            await server.stop();
            process.exit(0);
        } catch (error) {
            logger.error('Erro no shutdown:', error);
            process.exit(1);
        }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Iniciar servidor
    server.start().catch((error) => {
        logger.error('Falha ao iniciar servidor:', error);
        process.exit(1);
    });
}

module.exports = { APIServer };