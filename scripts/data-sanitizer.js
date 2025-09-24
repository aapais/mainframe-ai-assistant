/**
 * DataSanitizer Service
 *
 * Comprehensive data sanitization service for handling sensitive information
 * in accordance with Brazilian data protection regulations (LGPD) and
 * international standards.
 *
 * Features:
 * - Pattern-based sensitive data detection
 * - Token-based sanitization with reversible mapping
 * - Audit logging for compliance
 * - Memory storage for token mappings
 * - Validation and integrity checks
 *
 * @author AI Assistant
 * @version 2.0.0
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class DataSanitizer {
    constructor() {
        this.patterns = {
            // Brazilian CPF pattern: 123.456.789-01
            cpf: {
                regex: /\d{3}\.\d{3}\.\d{3}-\d{2}/g,
                type: 'CPF',
                maskChar: '*',
                tokenPrefix: 'CPF_TOKEN_'
            },

            // Bank account pattern: 12345-6 or 123456-1
            bankAccount: {
                regex: /\d{4,6}-\d{1}/g,
                type: 'BANK_ACCOUNT',
                maskChar: '*',
                tokenPrefix: 'BANK_TOKEN_'
            },

            // Credit card pattern: 1234 5678 9012 3456 or 1234-5678-9012-3456
            creditCard: {
                regex: /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g,
                type: 'CREDIT_CARD',
                maskChar: '*',
                tokenPrefix: 'CC_TOKEN_'
            },

            // Email pattern: user@domain.com
            email: {
                regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
                type: 'EMAIL',
                maskChar: '*',
                tokenPrefix: 'EMAIL_TOKEN_'
            },

            // Phone pattern: international format +55 11 99999-9999
            phone: {
                regex: /\+?[1-9]\d{1,14}/g,
                type: 'PHONE',
                maskChar: '*',
                tokenPrefix: 'PHONE_TOKEN_'
            },

            // Additional Brazilian patterns
            cnpj: {
                regex: /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g,
                type: 'CNPJ',
                maskChar: '*',
                tokenPrefix: 'CNPJ_TOKEN_'
            },

            // RG pattern: 12.345.678-9
            rg: {
                regex: /\d{2}\.\d{3}\.\d{3}-\d{1}/g,
                type: 'RG',
                maskChar: '*',
                tokenPrefix: 'RG_TOKEN_'
            }
        };

        this.tokenMappings = new Map();
        this.auditLog = [];
        this.sessionId = this.generateSessionId();

        // Create audit directory
        this.auditDir = path.join(__dirname, '../logs/audit');
        this.ensureAuditDirectory();
    }

    /**
     * Generate a unique session ID for tracking operations
     * @returns {string} Session ID
     */
    generateSessionId() {
        return `DSESSION_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }

    /**
     * Ensure audit directory exists
     */
    ensureAuditDirectory() {
        try {
            if (!fs.existsSync(this.auditDir)) {
                fs.mkdirSync(this.auditDir, { recursive: true });
            }
        } catch (error) {
            console.warn('Could not create audit directory:', error.message);
        }
    }

    /**
     * Generate a unique token for a sensitive value
     * @param {string} value - Original sensitive value
     * @param {string} type - Type of sensitive data
     * @returns {string} Generated token
     */
    generateToken(value, type) {
        const hash = crypto.createHash('sha256').update(value + this.sessionId).digest('hex').substring(0, 8);
        return `${this.patterns[type].tokenPrefix}${hash}`;
    }

    /**
     * Sanitize data by replacing sensitive information with tokens
     * @param {string|object} data - Data to sanitize
     * @param {object} options - Sanitization options
     * @returns {object} Sanitized data and mapping
     */
    sanitize(data, options = {}) {
        const startTime = Date.now();
        const operationId = crypto.randomBytes(8).toString('hex');

        try {
            let sanitizedData;
            const mapping = new Map();
            const detectedPatterns = [];

            // Handle different data types
            if (typeof data === 'string') {
                sanitizedData = this.sanitizeString(data, mapping, detectedPatterns);
            } else if (typeof data === 'object' && data !== null) {
                sanitizedData = this.sanitizeObject(data, mapping, detectedPatterns);
            } else {
                sanitizedData = data;
            }

            // Store mapping in memory
            const mappingKey = `sanitization_${operationId}`;
            this.tokenMappings.set(mappingKey, {
                mapping: Object.fromEntries(mapping),
                timestamp: Date.now(),
                sessionId: this.sessionId,
                detectedPatterns
            });

            // Log audit information
            this.logAuditEvent('SANITIZE', {
                operationId,
                patternsDetected: detectedPatterns.length,
                detectedTypes: [...new Set(detectedPatterns.map(p => p.type))],
                dataSize: JSON.stringify(data).length,
                processingTime: Date.now() - startTime
            });

            return {
                data: sanitizedData,
                mappingKey,
                operationId,
                metadata: {
                    patternsDetected: detectedPatterns.length,
                    detectedTypes: [...new Set(detectedPatterns.map(p => p.type))],
                    timestamp: Date.now(),
                    sessionId: this.sessionId
                }
            };

        } catch (error) {
            this.logAuditEvent('SANITIZE_ERROR', {
                operationId,
                error: error.message,
                processingTime: Date.now() - startTime
            });
            throw new Error(`Sanitization failed: ${error.message}`);
        }
    }

    /**
     * Sanitize a string by replacing sensitive patterns
     * @param {string} str - String to sanitize
     * @param {Map} mapping - Token mapping storage
     * @param {Array} detectedPatterns - Array to store detected patterns
     * @returns {string} Sanitized string
     */
    sanitizeString(str, mapping, detectedPatterns) {
        let sanitized = str;

        Object.entries(this.patterns).forEach(([patternName, pattern]) => {
            const matches = str.match(pattern.regex);
            if (matches) {
                matches.forEach(match => {
                    const token = this.generateToken(match, patternName);
                    mapping.set(token, match);
                    sanitized = sanitized.replace(match, token);

                    detectedPatterns.push({
                        type: pattern.type,
                        pattern: patternName,
                        originalLength: match.length,
                        position: str.indexOf(match)
                    });
                });
            }
        });

        return sanitized;
    }

    /**
     * Sanitize an object recursively
     * @param {object} obj - Object to sanitize
     * @param {Map} mapping - Token mapping storage
     * @param {Array} detectedPatterns - Array to store detected patterns
     * @returns {object} Sanitized object
     */
    sanitizeObject(obj, mapping, detectedPatterns) {
        if (Array.isArray(obj)) {
            return obj.map(item => this.sanitizeObject(item, mapping, detectedPatterns));
        }

        if (typeof obj === 'object' && obj !== null) {
            const sanitized = {};
            Object.entries(obj).forEach(([key, value]) => {
                if (typeof value === 'string') {
                    sanitized[key] = this.sanitizeString(value, mapping, detectedPatterns);
                } else if (typeof value === 'object') {
                    sanitized[key] = this.sanitizeObject(value, mapping, detectedPatterns);
                } else {
                    sanitized[key] = value;
                }
            });
            return sanitized;
        }

        return obj;
    }

    /**
     * Restore sanitized data using token mappings
     * @param {string|object} data - Sanitized data to restore
     * @param {string} mappingKey - Key to retrieve mapping
     * @returns {object} Restored data and validation results
     */
    restore(data, mappingKey) {
        const startTime = Date.now();
        const operationId = crypto.randomBytes(8).toString('hex');

        try {
            const mappingData = this.tokenMappings.get(mappingKey);
            if (!mappingData) {
                throw new Error(`Mapping not found for key: ${mappingKey}`);
            }

            const { mapping, timestamp, sessionId } = mappingData;

            // Validate mapping integrity
            const validationResult = this.validateMapping(mapping, sessionId);
            if (!validationResult.isValid) {
                throw new Error(`Mapping validation failed: ${validationResult.reason}`);
            }

            let restoredData;
            if (typeof data === 'string') {
                restoredData = this.restoreString(data, mapping);
            } else if (typeof data === 'object' && data !== null) {
                restoredData = this.restoreObject(data, mapping);
            } else {
                restoredData = data;
            }

            // Log audit information
            this.logAuditEvent('RESTORE', {
                operationId,
                mappingKey,
                originalTimestamp: timestamp,
                tokensRestored: Object.keys(mapping).length,
                processingTime: Date.now() - startTime
            });

            return {
                data: restoredData,
                operationId,
                validation: validationResult,
                metadata: {
                    tokensRestored: Object.keys(mapping).length,
                    originalTimestamp: timestamp,
                    processingTime: Date.now() - startTime
                }
            };

        } catch (error) {
            this.logAuditEvent('RESTORE_ERROR', {
                operationId,
                mappingKey,
                error: error.message,
                processingTime: Date.now() - startTime
            });
            throw new Error(`Restoration failed: ${error.message}`);
        }
    }

    /**
     * Restore tokens in a string
     * @param {string} str - String with tokens
     * @param {object} mapping - Token to value mapping
     * @returns {string} Restored string
     */
    restoreString(str, mapping) {
        let restored = str;
        Object.entries(mapping).forEach(([token, originalValue]) => {
            restored = restored.replace(new RegExp(token, 'g'), originalValue);
        });
        return restored;
    }

    /**
     * Restore tokens in an object recursively
     * @param {object} obj - Object with tokens
     * @param {object} mapping - Token to value mapping
     * @returns {object} Restored object
     */
    restoreObject(obj, mapping) {
        if (Array.isArray(obj)) {
            return obj.map(item => this.restoreObject(item, mapping));
        }

        if (typeof obj === 'object' && obj !== null) {
            const restored = {};
            Object.entries(obj).forEach(([key, value]) => {
                if (typeof value === 'string') {
                    restored[key] = this.restoreString(value, mapping);
                } else if (typeof value === 'object') {
                    restored[key] = this.restoreObject(value, mapping);
                } else {
                    restored[key] = value;
                }
            });
            return restored;
        }

        return obj;
    }

    /**
     * Validate mapping integrity
     * @param {object} mapping - Token mapping to validate
     * @param {string} sessionId - Session ID for validation
     * @returns {object} Validation result
     */
    validateMapping(mapping, sessionId) {
        try {
            // Check if mapping exists and is not empty
            if (!mapping || Object.keys(mapping).length === 0) {
                return { isValid: false, reason: 'Empty or null mapping' };
            }

            // Validate session ID
            if (sessionId !== this.sessionId) {
                return { isValid: false, reason: 'Session ID mismatch' };
            }

            // Validate token format
            for (const [token, value] of Object.entries(mapping)) {
                if (!this.isValidToken(token)) {
                    return { isValid: false, reason: `Invalid token format: ${token}` };
                }
            }

            return { isValid: true, reason: 'Validation passed' };

        } catch (error) {
            return { isValid: false, reason: `Validation error: ${error.message}` };
        }
    }

    /**
     * Check if a token has valid format
     * @param {string} token - Token to validate
     * @returns {boolean} True if valid
     */
    isValidToken(token) {
        const tokenPrefixes = Object.values(this.patterns).map(p => p.tokenPrefix);
        return tokenPrefixes.some(prefix => token.startsWith(prefix));
    }

    /**
     * Log audit events for compliance
     * @param {string} action - Action performed
     * @param {object} details - Event details
     */
    logAuditEvent(action, details) {
        const auditEntry = {
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId,
            action,
            details,
            userId: process.env.USER || 'system',
            ipAddress: this.getClientIP()
        };

        this.auditLog.push(auditEntry);

        // Write to file for persistence
        try {
            const auditFile = path.join(this.auditDir, `sanitizer_audit_${new Date().toISOString().split('T')[0]}.log`);
            fs.appendFileSync(auditFile, JSON.stringify(auditEntry) + '\n');
        } catch (error) {
            console.warn('Could not write to audit log:', error.message);
        }
    }

    /**
     * Get client IP address (placeholder for actual implementation)
     * @returns {string} IP address
     */
    getClientIP() {
        return process.env.CLIENT_IP || '127.0.0.1';
    }

    /**
     * Clear expired mappings from memory
     * @param {number} maxAge - Maximum age in milliseconds (default: 24 hours)
     */
    clearExpiredMappings(maxAge = 24 * 60 * 60 * 1000) {
        const now = Date.now();
        let clearedCount = 0;

        for (const [key, value] of this.tokenMappings.entries()) {
            if (now - value.timestamp > maxAge) {
                this.tokenMappings.delete(key);
                clearedCount++;
            }
        }

        this.logAuditEvent('CLEANUP', {
            clearedMappings: clearedCount,
            remainingMappings: this.tokenMappings.size
        });

        return clearedCount;
    }

    /**
     * Get sanitization statistics
     * @returns {object} Statistics
     */
    getStatistics() {
        return {
            activeMappings: this.tokenMappings.size,
            auditLogEntries: this.auditLog.length,
            sessionId: this.sessionId,
            patterns: Object.keys(this.patterns),
            uptime: Date.now() - parseInt(this.sessionId.split('_')[1])
        };
    }

    /**
     * Export audit log
     * @param {string} format - Export format ('json' or 'csv')
     * @returns {string} Exported data
     */
    exportAuditLog(format = 'json') {
        if (format === 'json') {
            return JSON.stringify(this.auditLog, null, 2);
        } else if (format === 'csv') {
            if (this.auditLog.length === 0) return '';

            const headers = Object.keys(this.auditLog[0]);
            const csvRows = [headers.join(',')];

            this.auditLog.forEach(entry => {
                const row = headers.map(header => {
                    const value = entry[header];
                    return typeof value === 'object' ? JSON.stringify(value) : value;
                });
                csvRows.push(row.join(','));
            });

            return csvRows.join('\n');
        }

        throw new Error(`Unsupported export format: ${format}`);
    }
}

module.exports = DataSanitizer;