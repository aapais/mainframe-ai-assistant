/**
 * Security Logger for SSO Integration
 * Centralized logging for security events and audit trail
 */

const winston = require('winston');
const path = require('path');

class SecurityLogger {
  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'sso-security' },
      transports: [
        new winston.transports.File({
          filename: path.join(process.cwd(), 'logs', 'security-error.log'),
          level: 'error'
        }),
        new winston.transports.File({
          filename: path.join(process.cwd(), 'logs', 'security-combined.log')
        })
      ]
    });

    // Add console transport in development
    if (process.env.NODE_ENV !== 'production') {
      this.logger.add(new winston.transports.Console({
        format: winston.format.simple()
      }));
    }
  }

  info(message, meta = {}) {
    this.logger.info(message, meta);
  }

  warn(message, meta = {}) {
    this.logger.warn(message, meta);
  }

  error(message, meta = {}) {
    this.logger.error(message, meta);
  }

  debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }

  // Security-specific logging methods
  logLoginAttempt(email, success, ip, userAgent) {
    const message = success ? 'Successful login' : 'Failed login attempt';
    const level = success ? 'info' : 'warn';

    this.logger.log(level, message, {
      event_type: 'login_attempt',
      email,
      success,
      ip,
      userAgent,
      timestamp: new Date().toISOString()
    });
  }

  logSSOEvent(provider, event, userId, details = {}) {
    this.logger.info('SSO Event', {
      event_type: 'sso_event',
      provider,
      event,
      userId,
      ...details,
      timestamp: new Date().toISOString()
    });
  }

  logSecurityViolation(type, details, severity = 'medium') {
    this.logger.error('Security Violation', {
      event_type: 'security_violation',
      violation_type: type,
      severity,
      ...details,
      timestamp: new Date().toISOString()
    });
  }

  logAuditEvent(action, userId, resource, details = {}) {
    this.logger.info('Audit Event', {
      event_type: 'audit',
      action,
      userId,
      resource,
      ...details,
      timestamp: new Date().toISOString()
    });
  }

  end() {
    this.logger.end();
  }
}

// Singleton instance
let instance = null;

module.exports = {
  SecurityLogger,
  getInstance: () => {
    if (!instance) {
      instance = new SecurityLogger();
    }
    return instance;
  }
};
