#!/usr/bin/env node

/**
 * Application Startup Script with SSO Configuration Validation
 * Performs comprehensive validation before starting the application
 */

const SSOConfigValidator = require('../config/sso-config-validator');
const SecurityMiddleware = require('../config/security-middleware');
const winston = require('winston');
const fs = require('fs').promises;
const path = require('path');

class ApplicationStarter {
    constructor() {
        this.logger = this.initializeLogger();
        this.validator = new SSOConfigValidator();
        this.startTime = Date.now();
    }

    initializeLogger() {
        // Ensure logs directory exists
        const logDir = path.dirname(process.env.LOG_FILE_PATH || './logs/app.log');
        require('fs').mkdirSync(logDir, { recursive: true });

        return winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.printf(info => {
                    return `${info.timestamp} [${info.level.toUpperCase()}] ${info.message} ${
                        info.meta ? JSON.stringify(info.meta) : ''
                    }`;
                })
            ),
            transports: [
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    )
                }),
                new winston.transports.File({
                    filename: process.env.LOG_FILE_PATH || './logs/app.log'
                }),
                new winston.transports.File({
                    filename: process.env.ERROR_LOG_PATH || './logs/error.log',
                    level: 'error'
                })
            ]
        });
    }

    async start() {
        try {
            this.logger.info('🚀 Starting Mainframe AI Assistant with SSO...');

            // Step 1: Environment validation
            await this.validateEnvironment();

            // Step 2: Configuration validation
            const validationResult = await this.validateConfiguration();

            // Step 3: Security check
            await this.performSecurityCheck();

            // Step 4: Database connectivity
            await this.checkDatabaseConnection();

            // Step 5: External services check
            await this.checkExternalServices();

            // Step 6: Initialize application
            const app = await this.initializeApplication(validationResult);

            // Step 7: Start server
            await this.startServer(app);

            // Step 8: Post-startup validation
            await this.postStartupValidation();

            const startupTime = Date.now() - this.startTime;
            this.logger.info(`✅ Application started successfully in ${startupTime}ms`);

        } catch (error) {
            this.logger.error('❌ Application startup failed', { error: error.message, stack: error.stack });
            process.exit(1);
        }
    }

    async validateEnvironment() {
        this.logger.info('🔍 Validating environment...');

        // Check Node.js version
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

        if (majorVersion < 16) {
            throw new Error(`Node.js 16 or higher required. Current version: ${nodeVersion}`);
        }

        // Check required directories
        const requiredDirs = [
            'logs',
            'data',
            'config',
            'uploads'
        ];

        for (const dir of requiredDirs) {
            try {
                await fs.access(dir);
            } catch (error) {
                this.logger.info(`Creating directory: ${dir}`);
                await fs.mkdir(dir, { recursive: true });
            }
        }

        // Check file permissions
        if (process.env.NODE_ENV === 'production') {
            await this.checkFilePermissions();
        }

        this.logger.info('✅ Environment validation completed');
    }

    async checkFilePermissions() {
        const sensitiveFiles = [
            '.env',
            '.env.production',
            'config/secrets.json'
        ];

        for (const file of sensitiveFiles) {
            try {
                const stats = await fs.stat(file);
                const mode = (stats.mode & 0o777).toString(8);

                if (mode !== '600') {
                    this.logger.warn(`Insecure permissions on ${file}: ${mode}. Recommended: 600`);
                    try {
                        await fs.chmod(file, 0o600);
                        this.logger.info(`Fixed permissions for ${file}`);
                    } catch (error) {
                        this.logger.warn(`Could not fix permissions for ${file}: ${error.message}`);
                    }
                }
            } catch (error) {
                // File doesn't exist, which is okay for optional files
                if (error.code !== 'ENOENT') {
                    this.logger.warn(`Could not check permissions for ${file}: ${error.message}`);
                }
            }
        }
    }

    async validateConfiguration() {
        this.logger.info('⚙️  Validating SSO configuration...');

        const validationResult = await this.validator.validateConfiguration();

        if (validationResult.warnings.length > 0) {
            this.logger.warn(`Configuration warnings (${validationResult.warnings.length}):`);
            validationResult.warnings.forEach(warning => {
                this.logger.warn(`  ⚠️  ${warning}`);
            });
        }

        // Apply secure fallbacks if needed
        const fallbacks = this.validator.generateSecureFallbacks();
        if (Object.keys(fallbacks).length > 0) {
            this.logger.info('Applying secure fallbacks for missing configuration');
            Object.assign(process.env, fallbacks);
        }

        // Log enabled SSO providers
        const enabledProviders = validationResult.config.enabledProviders || [];
        this.logger.info(`SSO Providers enabled: ${enabledProviders.join(', ') || 'none'}`);

        // Save validation report
        await this.saveValidationReport(validationResult.report);

        this.logger.info('✅ Configuration validation completed');
        return validationResult;
    }

    async performSecurityCheck() {
        this.logger.info('🔐 Performing security checks...');

        // Check for common security issues
        const securityIssues = [];

        // Check if running as root (not recommended)
        if (process.getuid && process.getuid() === 0) {
            securityIssues.push('Running as root user is not recommended');
        }

        // Check if debug mode is enabled in production
        if (process.env.NODE_ENV === 'production' && process.env.DEBUG_MODE === 'true') {
            securityIssues.push('Debug mode should be disabled in production');
        }

        // Check for weak JWT secrets
        const jwtSecret = process.env.JWT_SECRET;
        if (jwtSecret && jwtSecret.length < 32) {
            securityIssues.push('JWT_SECRET is too short for production use');
        }

        // Check HTTPS enforcement
        if (process.env.NODE_ENV === 'production' && process.env.FORCE_HTTPS !== 'true') {
            securityIssues.push('HTTPS should be enforced in production');
        }

        if (securityIssues.length > 0) {
            this.logger.warn('Security issues detected:');
            securityIssues.forEach(issue => {
                this.logger.warn(`  🔴 ${issue}`);
            });

            if (process.env.STRICT_SECURITY === 'true') {
                throw new Error('Security validation failed. Set STRICT_SECURITY=false to bypass.');
            }
        }

        this.logger.info('✅ Security check completed');
    }

    async checkDatabaseConnection() {
        this.logger.info('💾 Checking database connection...');

        try {
            // Check PostgreSQL connection if configured
            if (process.env.DATABASE_URL) {
                const { Pool } = require('pg');
                const pool = new Pool({
                    connectionString: process.env.DATABASE_URL,
                    connectionTimeoutMillis: 5000,
                    idleTimeoutMillis: 30000,
                    max: 1 // Just for testing
                });

                const client = await pool.connect();
                await client.query('SELECT NOW()');
                client.release();
                await pool.end();

                this.logger.info('✅ PostgreSQL connection successful');
            }

            // Check SQLite connection (fallback)
            if (process.env.DB_PATH) {
                const sqlite3 = require('sqlite3').verbose();
                const db = new sqlite3.Database(process.env.DB_PATH);

                await new Promise((resolve, reject) => {
                    db.run('SELECT 1', (err) => {
                        db.close();
                        if (err) reject(err);
                        else resolve();
                    });
                });

                this.logger.info('✅ SQLite connection successful');
            }

        } catch (error) {
            this.logger.error('❌ Database connection failed', { error: error.message });

            if (process.env.REQUIRE_DB === 'true') {
                throw new Error(`Database connection required: ${error.message}`);
            } else {
                this.logger.warn('Continuing without database connection');
            }
        }
    }

    async checkExternalServices() {
        this.logger.info('🌐 Checking external services...');

        const services = [
            { name: 'Redis', host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
        ];

        // Add SSO provider endpoints
        const ssoServices = [
            { name: 'Google OAuth', url: 'https://accounts.google.com', required: !!process.env.GOOGLE_CLIENT_ID },
            { name: 'Microsoft OAuth', url: 'https://login.microsoftonline.com', required: !!process.env.AZURE_CLIENT_ID },
            { name: 'Okta', url: process.env.OKTA_DOMAIN ? `https://${process.env.OKTA_DOMAIN}` : null, required: !!process.env.OKTA_CLIENT_ID },
        ];

        // Check Redis connection
        if (services[0].host && services[0].port) {
            try {
                const redis = require('redis');
                const client = redis.createClient({
                    host: services[0].host,
                    port: services[0].port,
                    password: process.env.REDIS_PASSWORD,
                    connect_timeout: 5000,
                    retry_unfulfilled_commands: false
                });

                await client.ping();
                client.quit();
                this.logger.info('✅ Redis connection successful');
            } catch (error) {
                this.logger.warn(`Redis connection failed: ${error.message}`);
            }
        }

        // Check SSO provider connectivity
        for (const service of ssoServices) {
            if (service.url && service.required) {
                try {
                    const https = require('https');
                    const url = require('url');

                    await new Promise((resolve, reject) => {
                        const parsedUrl = new URL(service.url);
                        const req = https.request({
                            hostname: parsedUrl.hostname,
                            port: parsedUrl.port || 443,
                            path: '/',
                            method: 'HEAD',
                            timeout: 5000
                        }, (res) => {
                            resolve(res);
                        });

                        req.on('error', reject);
                        req.on('timeout', () => reject(new Error('Timeout')));
                        req.end();
                    });

                    this.logger.info(`✅ ${service.name} connectivity check passed`);
                } catch (error) {
                    this.logger.warn(`${service.name} connectivity check failed: ${error.message}`);
                }
            }
        }

        this.logger.info('✅ External services check completed');
    }

    async initializeApplication(validationResult) {
        this.logger.info('🏗️  Initializing application...');

        const express = require('express');
        const app = express();

        // Basic middleware
        app.use(express.json({ limit: process.env.MAX_REQUEST_SIZE || '10mb' }));
        app.use(express.urlencoded({ extended: true, limit: process.env.MAX_REQUEST_SIZE || '10mb' }));

        // Initialize security middleware
        const securityMiddleware = new SecurityMiddleware(app);
        await securityMiddleware.initialize();

        // Health check endpoints
        app.get('/health', async (req, res) => {
            const health = {
                status: 'ok',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: process.env.npm_package_version || '1.0.0',
                environment: process.env.NODE_ENV,
                checks: {
                    security: await securityMiddleware.healthCheck()
                }
            };

            res.json(health);
        });

        app.get('/ready', (req, res) => {
            res.json({ status: 'ready', timestamp: new Date().toISOString() });
        });

        // Configuration info endpoint (secured)
        app.get('/config/info', (req, res) => {
            const configInfo = {
                environment: process.env.NODE_ENV,
                enabledProviders: validationResult.config.enabledProviders,
                features: {
                    sso: process.env.FEATURE_SSO_ENABLED === 'true',
                    mfa: process.env.FEATURE_MFA_ENABLED === 'true',
                    auditLogging: process.env.FEATURE_AUDIT_LOGGING === 'true',
                    rateLimiting: process.env.FEATURE_RATE_LIMITING === 'true'
                },
                timestamp: new Date().toISOString()
            };

            res.json(configInfo);
        });

        // Initialize your main application routes here
        // app.use('/api', require('./routes/api'));
        // app.use('/auth', require('./routes/auth'));

        // Error handling middleware
        app.use((error, req, res, next) => {
            this.logger.error('Unhandled error', {
                error: error.message,
                stack: error.stack,
                url: req.originalUrl,
                method: req.method,
                ip: req.ip
            });

            res.status(500).json({
                error: process.env.NODE_ENV === 'production'
                    ? 'Internal server error'
                    : error.message
            });
        });

        // 404 handler
        app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Not found',
                path: req.originalUrl
            });
        });

        this.logger.info('✅ Application initialized');
        return app;
    }

    async startServer(app) {
        this.logger.info('🌟 Starting server...');

        const port = process.env.PORT || 3000;
        const host = process.env.HOST || '0.0.0.0';

        return new Promise((resolve, reject) => {
            const server = app.listen(port, host, () => {
                this.logger.info(`🎉 Server listening on ${host}:${port}`);
                this.logger.info(`🔗 Application URL: ${process.env.APP_URL || `http://localhost:${port}`}`);
                resolve(server);
            });

            server.on('error', (error) => {
                this.logger.error('Server startup error', { error: error.message });
                reject(error);
            });

            // Graceful shutdown
            process.on('SIGTERM', () => {
                this.logger.info('SIGTERM received, shutting down gracefully');
                server.close(() => {
                    this.logger.info('Process terminated');
                    process.exit(0);
                });
            });

            process.on('SIGINT', () => {
                this.logger.info('SIGINT received, shutting down gracefully');
                server.close(() => {
                    this.logger.info('Process terminated');
                    process.exit(0);
                });
            });
        });
    }

    async postStartupValidation() {
        this.logger.info('🔄 Running post-startup validation...');

        try {
            // Check if server is responding
            const port = process.env.PORT || 3000;
            const http = require('http');

            await new Promise((resolve, reject) => {
                const req = http.request({
                    hostname: 'localhost',
                    port: port,
                    path: '/health',
                    method: 'GET',
                    timeout: 5000
                }, (res) => {
                    if (res.statusCode === 200) {
                        resolve(res);
                    } else {
                        reject(new Error(`Health check failed with status ${res.statusCode}`));
                    }
                });

                req.on('error', reject);
                req.on('timeout', () => reject(new Error('Health check timeout')));
                req.end();
            });

            this.logger.info('✅ Post-startup validation completed');

        } catch (error) {
            this.logger.warn(`Post-startup validation failed: ${error.message}`);
            // Don't fail startup for post-validation issues
        }
    }

    async saveValidationReport(report) {
        try {
            const reportPath = './logs/validation-report.json';
            await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
            this.logger.info(`Validation report saved to ${reportPath}`);
        } catch (error) {
            this.logger.warn(`Could not save validation report: ${error.message}`);
        }
    }
}

// Start the application if this script is run directly
if (require.main === module) {
    const starter = new ApplicationStarter();
    starter.start().catch((error) => {
        console.error('Failed to start application:', error);
        process.exit(1);
    });
}

module.exports = ApplicationStarter;