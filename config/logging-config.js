/**
 * Comprehensive Logging Configuration for SSO Application
 * Implements structured logging with security event tracking, audit trails, and monitoring
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

class LoggingConfiguration {
    constructor() {
        this.logDir = process.env.LOG_DIR || './logs';
        this.logLevel = process.env.LOG_LEVEL || 'info';
        this.logFormat = process.env.LOG_FORMAT || 'json';
        this.maxSize = process.env.LOG_MAX_SIZE || '10m';
        this.maxFiles = parseInt(process.env.LOG_MAX_FILES) || 5;
        this.datePattern = process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD';

        this.ensureLogDirectory();
        this.initializeLoggers();
    }

    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }

        // Create subdirectories for different log types
        const subDirs = ['security', 'audit', 'performance', 'errors'];
        subDirs.forEach(dir => {
            const fullPath = path.join(this.logDir, dir);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
            }
        });
    }

    getLogFormat() {
        const baseFormat = winston.format.combine(
            winston.format.timestamp({
                format: 'YYYY-MM-DD HH:mm:ss.SSS'
            }),
            winston.format.errors({ stack: true }),
            winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] })
        );

        if (this.logFormat === 'json') {
            return winston.format.combine(
                baseFormat,
                winston.format.json()
            );
        } else {
            return winston.format.combine(
                baseFormat,
                winston.format.printf(info => {
                    const { timestamp, level, message, metadata } = info;
                    const meta = Object.keys(metadata).length ? JSON.stringify(metadata) : '';
                    return `${timestamp} [${level.toUpperCase()}] ${message} ${meta}`;
                })
            );
        }
    }

    initializeLoggers() {
        // Main application logger
        this.appLogger = winston.createLogger({
            level: this.logLevel,
            format: this.getLogFormat(),
            transports: [
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    )
                }),
                new winston.transports.File({
                    filename: path.join(this.logDir, 'app.log'),
                    maxsize: this.parseSize(this.maxSize),
                    maxFiles: this.maxFiles
                }),
                new winston.transports.File({
                    filename: path.join(this.logDir, 'errors', 'error.log'),
                    level: 'error',
                    maxsize: this.parseSize(this.maxSize),
                    maxFiles: this.maxFiles
                })
            ]
        });

        // Security event logger
        this.securityLogger = winston.createLogger({
            level: 'info',
            format: this.getLogFormat(),
            transports: [
                new winston.transports.File({
                    filename: path.join(this.logDir, 'security', 'security.log'),
                    maxsize: this.parseSize(this.maxSize),
                    maxFiles: this.maxFiles * 2 // Keep more security logs
                }),
                new winston.transports.File({
                    filename: path.join(this.logDir, 'security', 'security-alerts.log'),
                    level: 'warn',
                    maxsize: this.parseSize(this.maxSize),
                    maxFiles: this.maxFiles
                })
            ]
        });

        // Audit logger for compliance
        this.auditLogger = winston.createLogger({
            level: 'info',
            format: this.getLogFormat(),
            transports: [
                new winston.transports.File({
                    filename: path.join(this.logDir, 'audit', 'audit.log'),
                    maxsize: this.parseSize(this.maxSize),
                    maxFiles: this.maxFiles * 3 // Keep audit logs longer
                })
            ]
        });

        // Performance logger
        this.performanceLogger = winston.createLogger({
            level: 'info',
            format: this.getLogFormat(),
            transports: [
                new winston.transports.File({
                    filename: path.join(this.logDir, 'performance', 'performance.log'),
                    maxsize: this.parseSize(this.maxSize),
                    maxFiles: this.maxFiles
                })
            ]
        });

        // SSO-specific logger
        this.ssoLogger = winston.createLogger({
            level: 'info',
            format: this.getLogFormat(),
            transports: [
                new winston.transports.File({
                    filename: path.join(this.logDir, 'sso.log'),
                    maxsize: this.parseSize(this.maxSize),
                    maxFiles: this.maxFiles
                })
            ]
        });
    }

    parseSize(sizeStr) {
        const units = { 'b': 1, 'k': 1024, 'm': 1024 * 1024, 'g': 1024 * 1024 * 1024 };
        const match = sizeStr.toLowerCase().match(/^(\d+)([bkmg]?)$/);
        if (match) {
            return parseInt(match[1]) * (units[match[2]] || 1);
        }
        return 10 * 1024 * 1024; // Default 10MB
    }

    // Application logging methods
    log(level, message, meta = {}) {
        this.appLogger.log(level, message, {
            ...meta,
            service: 'mainframe-ai',
            environment: process.env.NODE_ENV,
            timestamp: new Date().toISOString(),
            correlationId: meta.correlationId || this.generateCorrelationId()
        });
    }

    info(message, meta = {}) {
        this.log('info', message, meta);
    }

    warn(message, meta = {}) {
        this.log('warn', message, meta);
    }

    error(message, meta = {}) {
        this.log('error', message, meta);
    }

    debug(message, meta = {}) {
        this.log('debug', message, meta);
    }

    // Security event logging
    logSecurityEvent(eventType, details = {}) {
        const securityEvent = {
            eventType,
            timestamp: new Date().toISOString(),
            severity: this.getSecuritySeverity(eventType),
            details,
            environment: process.env.NODE_ENV,
            correlationId: details.correlationId || this.generateCorrelationId()
        };

        this.securityLogger.info('Security Event', securityEvent);

        // Also log to main logger if severity is high
        if (securityEvent.severity === 'HIGH' || securityEvent.severity === 'CRITICAL') {
            this.appLogger.warn(`Security Alert: ${eventType}`, securityEvent);
        }
    }

    // Audit logging for compliance
    logAuditEvent(action, resource, user, details = {}) {
        const auditEvent = {
            action,
            resource,
            user: {
                id: user?.id,
                email: user?.email,
                role: user?.role
            },
            timestamp: new Date().toISOString(),
            details,
            environment: process.env.NODE_ENV,
            correlationId: details.correlationId || this.generateCorrelationId()
        };

        this.auditLogger.info('Audit Event', auditEvent);
    }

    // Performance logging
    logPerformanceMetric(metric, value, details = {}) {
        const performanceEvent = {
            metric,
            value,
            timestamp: new Date().toISOString(),
            details,
            environment: process.env.NODE_ENV
        };

        this.performanceLogger.info('Performance Metric', performanceEvent);
    }

    // SSO-specific logging
    logSSOEvent(provider, eventType, user, details = {}) {
        const ssoEvent = {
            provider,
            eventType,
            user: user ? {
                id: user.id,
                email: user.email
            } : null,
            timestamp: new Date().toISOString(),
            details,
            environment: process.env.NODE_ENV,
            correlationId: details.correlationId || this.generateCorrelationId()
        };

        this.ssoLogger.info(`SSO ${eventType}`, ssoEvent);

        // Also log to security logger for authentication events
        if (['LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'TOKEN_REFRESH'].includes(eventType)) {
            this.logSecurityEvent(`SSO_${eventType}`, ssoEvent);
        }
    }

    // HTTP request logging middleware
    createRequestLogger() {
        return (req, res, next) => {
            const startTime = Date.now();
            const correlationId = req.headers['x-correlation-id'] || this.generateCorrelationId();

            // Add correlation ID to request for downstream use
            req.correlationId = correlationId;
            res.setHeader('X-Correlation-ID', correlationId);

            // Log request
            this.info('HTTP Request', {
                method: req.method,
                url: req.originalUrl,
                userAgent: req.get('User-Agent'),
                ip: req.ip,
                correlationId
            });

            // Override res.end to log response
            const originalEnd = res.end;
            res.end = function(chunk, encoding) {
                const duration = Date.now() - startTime;

                // Log response
                const responseLog = {
                    method: req.method,
                    url: req.originalUrl,
                    statusCode: res.statusCode,
                    duration,
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    correlationId
                };

                if (res.statusCode >= 400) {
                    this.warn('HTTP Error Response', responseLog);
                } else {
                    this.info('HTTP Response', responseLog);
                }

                // Log performance metrics for slow requests
                if (duration > 1000) {
                    this.logPerformanceMetric('slow_request', duration, {
                        method: req.method,
                        url: req.originalUrl,
                        statusCode: res.statusCode
                    });
                }

                originalEnd.call(this, chunk, encoding);
            }.bind(this);

            next();
        };
    }

    // Error logging middleware
    createErrorLogger() {
        return (error, req, res, next) => {
            const errorDetails = {
                name: error.name,
                message: error.message,
                stack: error.stack,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                correlationId: req.correlationId
            };

            this.error('Unhandled Application Error', errorDetails);

            // Log as security event if it's authentication-related
            if (req.originalUrl.includes('/auth/') || error.name === 'UnauthorizedError') {
                this.logSecurityEvent('APPLICATION_ERROR', errorDetails);
            }

            next(error);
        };
    }

    // Utility methods
    generateCorrelationId() {
        return Math.random().toString(36).substring(2, 15) +
               Math.random().toString(36).substring(2, 15);
    }

    getSecuritySeverity(eventType) {
        const severityMap = {
            'LOGIN_FAILED': 'MEDIUM',
            'RATE_LIMIT_EXCEEDED': 'MEDIUM',
            'CSRF_TOKEN_INVALID': 'HIGH',
            'SESSION_HIJACK_ATTEMPT': 'CRITICAL',
            'BRUTE_FORCE_ATTACK': 'HIGH',
            'SQL_INJECTION_ATTEMPT': 'CRITICAL',
            'XSS_ATTEMPT': 'HIGH',
            'UNAUTHORIZED_ACCESS': 'HIGH',
            'PRIVILEGE_ESCALATION': 'CRITICAL',
            'DATA_BREACH': 'CRITICAL',
            'CONFIG_CHANGE': 'MEDIUM',
            'USER_CREATED': 'LOW',
            'USER_DELETED': 'MEDIUM',
            'PASSWORD_CHANGED': 'MEDIUM',
            'MFA_DISABLED': 'HIGH'
        };

        return severityMap[eventType] || 'LOW';
    }

    // Log rotation and cleanup
    async cleanupOldLogs() {
        const retentionDays = parseInt(process.env.LOG_RETENTION_DAYS) || 30;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        const logFiles = await this.getLogFiles();

        for (const logFile of logFiles) {
            try {
                const stats = fs.statSync(logFile);
                if (stats.mtime < cutoffDate) {
                    fs.unlinkSync(logFile);
                    this.info(`Deleted old log file: ${logFile}`);
                }
            } catch (error) {
                this.error(`Error cleaning up log file ${logFile}`, { error: error.message });
            }
        }
    }

    async getLogFiles() {
        const files = [];
        const scan = (dir) => {
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                    scan(fullPath);
                } else if (item.endsWith('.log')) {
                    files.push(fullPath);
                }
            }
        };
        scan(this.logDir);
        return files;
    }

    // Health check for logging system
    healthCheck() {
        try {
            // Test write to each logger
            this.info('Logging health check');
            this.securityLogger.info('Security logging health check');
            this.auditLogger.info('Audit logging health check');
            this.performanceLogger.info('Performance logging health check');

            return {
                status: 'healthy',
                logDirectory: this.logDir,
                logLevel: this.logLevel,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // Graceful shutdown
    async shutdown() {
        this.info('Shutting down logging system');

        const loggers = [
            this.appLogger,
            this.securityLogger,
            this.auditLogger,
            this.performanceLogger,
            this.ssoLogger
        ];

        await Promise.all(loggers.map(logger => {
            return new Promise((resolve) => {
                logger.end(() => resolve());
            });
        }));
    }
}

module.exports = LoggingConfiguration;