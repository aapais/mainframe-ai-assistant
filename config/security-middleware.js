/**
 * Security Middleware for SSO Authentication
 * Comprehensive security layer with rate limiting, CSRF protection, and session management
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const RedisStore = require('connect-redis')(session);
const redis = require('redis');
const crypto = require('crypto');
const winston = require('winston');

class SecurityMiddleware {
    constructor(app, config = {}) {
        this.app = app;
        this.config = {
            redis: {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                password: process.env.REDIS_PASSWORD,
                db: process.env.REDIS_SESSION_DB || 1
            },
            session: {
                secret: process.env.SESSION_SECRET,
                maxAge: parseInt(process.env.SESSION_MAX_AGE) || 86400000, // 24 hours
                secure: process.env.SESSION_COOKIE_SECURE === 'true',
                httpOnly: process.env.SESSION_COOKIE_HTTPONLY !== 'false',
                sameSite: process.env.SESSION_COOKIE_SAMESITE || 'strict'
            },
            rateLimit: {
                windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
                maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
                authWindowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 900000,
                authMaxAttempts: parseInt(process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS) || 5
            },
            security: {
                enableCSRF: process.env.FEATURE_CSRF_ENABLED === 'true',
                enableHSTS: process.env.HSTS_ENABLED !== 'false',
                hstsMaxAge: parseInt(process.env.HSTS_MAX_AGE) || 31536000,
                enableCSP: process.env.CSP_ENABLED === 'true',
                cspReportUri: process.env.CSP_REPORT_URI
            },
            ...config
        };

        this.logger = this.initializeLogger();
        this.redisClient = null;
        this.rateLimitStore = new Map(); // Fallback store
    }

    initializeLogger() {
        return winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({
                    filename: process.env.SECURITY_LOG_PATH || './logs/security.log'
                })
            ]
        });
    }

    async initialize() {
        try {
            // Initialize Redis client for sessions
            await this.initializeRedis();

            // Apply security headers
            this.applySecurityHeaders();

            // Setup rate limiting
            this.setupRateLimiting();

            // Configure session management
            this.configureSessionManagement();

            // Setup CSRF protection
            if (this.config.security.enableCSRF) {
                this.setupCSRFProtection();
            }

            // Apply additional security middleware
            this.applyAdditionalSecurity();

            this.logger.info('Security middleware initialized successfully');

        } catch (error) {
            this.logger.error('Failed to initialize security middleware', { error: error.message });
            throw error;
        }
    }

    async initializeRedis() {
        try {
            this.redisClient = redis.createClient({
                host: this.config.redis.host,
                port: this.config.redis.port,
                password: this.config.redis.password,
                db: this.config.redis.db,
                retry_unfulfilled_commands: true,
                retry_strategy: (options) => {
                    if (options.error && options.error.code === 'ECONNREFUSED') {
                        this.logger.error('Redis server connection refused');
                        return new Error('Redis server connection refused');
                    }
                    if (options.total_retry_time > 1000 * 60 * 60) {
                        this.logger.error('Redis retry time exhausted');
                        return new Error('Retry time exhausted');
                    }
                    if (options.attempt > 10) {
                        this.logger.error('Redis max retry attempts reached');
                        return undefined;
                    }
                    // Reconnect after
                    return Math.min(options.attempt * 100, 3000);
                }
            });

            this.redisClient.on('error', (err) => {
                this.logger.error('Redis client error', { error: err.message });
            });

            this.redisClient.on('connect', () => {
                this.logger.info('Redis client connected');
            });

        } catch (error) {
            this.logger.warn('Redis initialization failed, using memory fallback', { error: error.message });
            this.redisClient = null;
        }
    }

    applySecurityHeaders() {
        // Configure Helmet for security headers
        const helmetConfig = {
            contentSecurityPolicy: this.config.security.enableCSP ? {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
                    fontSrc: ["'self'", 'https://fonts.gstatic.com'],
                    imgSrc: ["'self'", 'data:', 'https:'],
                    scriptSrc: ["'self'"],
                    objectSrc: ["'none'"],
                    upgradeInsecureRequests: [],
                    reportUri: this.config.security.cspReportUri
                }
            } : false,
            hsts: this.config.security.enableHSTS ? {
                maxAge: this.config.security.hstsMaxAge,
                includeSubDomains: process.env.HSTS_INCLUDE_SUBDOMAINS === 'true',
                preload: process.env.HSTS_PRELOAD === 'true'
            } : false,
            noSniff: true,
            frameguard: { action: 'deny' },
            xssFilter: true,
            referrerPolicy: { policy: 'same-origin' }
        };

        this.app.use(helmet(helmetConfig));

        // Additional security headers
        this.app.use((req, res, next) => {
            res.setHeader('X-Powered-By', ''); // Remove Express signature
            res.setHeader('Server', ''); // Remove server signature
            res.setHeader('X-Frame-Options', 'DENY');
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-XSS-Protection', '1; mode=block');
            res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

            if (process.env.NODE_ENV === 'production') {
                res.setHeader('Strict-Transport-Security',
                    `max-age=${this.config.security.hstsMaxAge}; includeSubDomains; preload`);
            }

            next();
        });
    }

    setupRateLimiting() {
        // Create Redis store for rate limiting
        const createRateLimitStore = () => {
            if (this.redisClient) {
                const RedisRateLimitStore = require('rate-limit-redis');
                return new RedisRateLimitStore({
                    client: this.redisClient,
                    prefix: 'rl:'
                });
            }
            return undefined; // Use default memory store
        };

        // General API rate limiting
        const generalLimiter = rateLimit({
            store: createRateLimitStore(),
            windowMs: this.config.rateLimit.windowMs,
            max: this.config.rateLimit.maxRequests,
            message: {
                error: 'Too many requests from this IP',
                retryAfter: Math.ceil(this.config.rateLimit.windowMs / 1000)
            },
            standardHeaders: true,
            legacyHeaders: false,
            handler: (req, res) => {
                this.logger.warn('Rate limit exceeded', {
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    url: req.originalUrl
                });
                res.status(429).json({
                    error: 'Too many requests',
                    retryAfter: Math.ceil(this.config.rateLimit.windowMs / 1000)
                });
            },
            skip: (req) => {
                // Skip rate limiting for health checks
                return req.path === '/health' || req.path === '/ready';
            }
        });

        // Authentication-specific rate limiting
        const authLimiter = rateLimit({
            store: createRateLimitStore(),
            windowMs: this.config.rateLimit.authWindowMs,
            max: this.config.rateLimit.authMaxAttempts,
            message: {
                error: 'Too many authentication attempts',
                retryAfter: Math.ceil(this.config.rateLimit.authWindowMs / 1000)
            },
            standardHeaders: true,
            legacyHeaders: false,
            handler: (req, res) => {
                this.logger.error('Authentication rate limit exceeded', {
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    url: req.originalUrl,
                    timestamp: new Date().toISOString()
                });
                res.status(429).json({
                    error: 'Too many authentication attempts',
                    retryAfter: Math.ceil(this.config.rateLimit.authWindowMs / 1000)
                });
            },
            keyGenerator: (req) => {
                // Use IP + email/username if available for more specific limiting
                const identifier = req.body?.email || req.body?.username || req.ip;
                return `auth:${identifier}`;
            }
        });

        // Apply rate limiters
        this.app.use('/api/', generalLimiter);
        this.app.use('/auth/', authLimiter);
        this.app.use('/login', authLimiter);
        this.app.use('/register', authLimiter);
        this.app.use('/forgot-password', authLimiter);
    }

    configureSessionManagement() {
        const sessionConfig = {
            secret: this.config.session.secret,
            name: 'sessionId', // Don't use default session name
            resave: false,
            saveUninitialized: false,
            rolling: true, // Reset expiry on activity
            cookie: {
                secure: this.config.session.secure,
                httpOnly: this.config.session.httpOnly,
                maxAge: this.config.session.maxAge,
                sameSite: this.config.session.sameSite
            },
            genid: () => {
                // Generate cryptographically secure session IDs
                return crypto.randomBytes(32).toString('hex');
            }
        };

        // Use Redis store if available
        if (this.redisClient) {
            sessionConfig.store = new RedisStore({
                client: this.redisClient,
                prefix: 'sess:',
                ttl: Math.ceil(this.config.session.maxAge / 1000)
            });
        } else {
            this.logger.warn('Using memory store for sessions - not recommended for production');
        }

        this.app.use(session(sessionConfig));

        // Session security middleware
        this.app.use((req, res, next) => {
            // Regenerate session ID on login
            if (req.path.startsWith('/auth/') && req.method === 'POST') {
                req.session.regenerate((err) => {
                    if (err) {
                        this.logger.error('Session regeneration failed', { error: err.message });
                        return next(err);
                    }
                    next();
                });
            } else {
                next();
            }
        });

        // Track active sessions
        this.app.use((req, res, next) => {
            if (req.session && req.user) {
                req.session.lastActivity = new Date();
                req.session.userAgent = req.get('User-Agent');
                req.session.ipAddress = req.ip;
            }
            next();
        });
    }

    setupCSRFProtection() {
        const csrf = require('csurf');

        const csrfProtection = csrf({
            cookie: {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict'
            },
            ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
            value: (req) => {
                return req.body._csrf ||
                       req.query._csrf ||
                       req.headers['x-csrf-token'] ||
                       req.headers['x-xsrf-token'];
            }
        });

        // Apply CSRF protection to state-changing routes
        this.app.use('/auth/', csrfProtection);
        this.app.use('/api/', csrfProtection);

        // Provide CSRF token to views
        this.app.use((req, res, next) => {
            res.locals.csrfToken = req.csrfToken ? req.csrfToken() : null;
            next();
        });

        // CSRF error handler
        this.app.use((error, req, res, next) => {
            if (error.code === 'EBADCSRFTOKEN') {
                this.logger.warn('Invalid CSRF token', {
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    url: req.originalUrl
                });
                return res.status(403).json({
                    error: 'Invalid CSRF token'
                });
            }
            next(error);
        });
    }

    applyAdditionalSecurity() {
        // Request sanitization
        this.app.use((req, res, next) => {
            // Remove potentially dangerous headers
            delete req.headers['x-forwarded-host'];
            delete req.headers['x-original-url'];
            delete req.headers['x-rewrite-url'];

            // Validate Content-Type for POST requests
            if (req.method === 'POST' && req.path.startsWith('/api/')) {
                const contentType = req.get('Content-Type');
                if (!contentType || !contentType.includes('application/json')) {
                    return res.status(400).json({
                        error: 'Invalid Content-Type'
                    });
                }
            }

            next();
        });

        // Security logging middleware
        this.app.use((req, res, next) => {
            const startTime = Date.now();

            res.on('finish', () => {
                const duration = Date.now() - startTime;

                // Log security-relevant events
                if (res.statusCode >= 400 || req.path.startsWith('/auth/')) {
                    this.logger.info('HTTP Request', {
                        method: req.method,
                        url: req.originalUrl,
                        statusCode: res.statusCode,
                        duration,
                        ip: req.ip,
                        userAgent: req.get('User-Agent'),
                        referer: req.get('Referer'),
                        userId: req.user?.id,
                        sessionId: req.sessionID
                    });
                }

                // Log suspicious activities
                if (res.statusCode === 429 ||
                    res.statusCode === 403 ||
                    (res.statusCode === 401 && req.path.startsWith('/auth/'))) {

                    this.logger.warn('Security Event', {
                        event: this.getSecurityEventType(res.statusCode, req.path),
                        method: req.method,
                        url: req.originalUrl,
                        statusCode: res.statusCode,
                        ip: req.ip,
                        userAgent: req.get('User-Agent'),
                        timestamp: new Date().toISOString()
                    });
                }
            });

            next();
        });

        // Input validation middleware
        this.app.use((req, res, next) => {
            // Validate request size
            const contentLength = parseInt(req.get('Content-Length') || '0');
            const maxSize = parseInt(process.env.MAX_REQUEST_SIZE) || 1048576; // 1MB default

            if (contentLength > maxSize) {
                this.logger.warn('Request too large', {
                    contentLength,
                    maxSize,
                    ip: req.ip,
                    url: req.originalUrl
                });
                return res.status(413).json({
                    error: 'Request entity too large'
                });
            }

            next();
        });
    }

    getSecurityEventType(statusCode, path) {
        if (statusCode === 429) return 'RATE_LIMIT_EXCEEDED';
        if (statusCode === 403) return 'ACCESS_FORBIDDEN';
        if (statusCode === 401 && path.startsWith('/auth/')) return 'AUTH_FAILED';
        return 'SECURITY_EVENT';
    }

    // Session management utilities
    async destroyUserSessions(userId) {
        try {
            if (!this.redisClient) {
                this.logger.warn('Cannot destroy user sessions - Redis not available');
                return false;
            }

            // Find all sessions for the user
            const keys = await this.redisClient.keys('sess:*');

            for (const key of keys) {
                const sessionData = await this.redisClient.get(key);
                if (sessionData) {
                    const session = JSON.parse(sessionData);
                    if (session.userId === userId) {
                        await this.redisClient.del(key);
                    }
                }
            }

            this.logger.info('User sessions destroyed', { userId });
            return true;

        } catch (error) {
            this.logger.error('Failed to destroy user sessions', {
                userId,
                error: error.message
            });
            return false;
        }
    }

    async getActiveSessions(userId) {
        try {
            if (!this.redisClient) {
                return [];
            }

            const keys = await this.redisClient.keys('sess:*');
            const sessions = [];

            for (const key of keys) {
                const sessionData = await this.redisClient.get(key);
                if (sessionData) {
                    const session = JSON.parse(sessionData);
                    if (session.userId === userId) {
                        sessions.push({
                            sessionId: key.replace('sess:', ''),
                            lastActivity: session.lastActivity,
                            userAgent: session.userAgent,
                            ipAddress: session.ipAddress,
                            createdAt: session.createdAt
                        });
                    }
                }
            }

            return sessions;

        } catch (error) {
            this.logger.error('Failed to get active sessions', {
                userId,
                error: error.message
            });
            return [];
        }
    }

    // Health check for security middleware
    async healthCheck() {
        const health = {
            timestamp: new Date().toISOString(),
            status: 'ok',
            checks: {
                redis: 'unknown',
                rateLimit: 'ok',
                session: 'ok'
            }
        };

        try {
            if (this.redisClient) {
                await this.redisClient.ping();
                health.checks.redis = 'ok';
            } else {
                health.checks.redis = 'unavailable';
            }
        } catch (error) {
            health.checks.redis = 'error';
            health.status = 'degraded';
        }

        return health;
    }

    // Graceful shutdown
    async shutdown() {
        this.logger.info('Shutting down security middleware');

        if (this.redisClient) {
            await this.redisClient.quit();
        }

        this.logger.info('Security middleware shutdown complete');
    }
}

module.exports = SecurityMiddleware;