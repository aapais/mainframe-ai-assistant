"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationService = void 0;
const services_1 = require("../types/services");
class ValidationService {
    config;
    customValidators = new Map();
    constructor(config) {
        this.config = config;
    }
    validateEntry(entry) {
        const errors = [];
        const warnings = [];
        if (!entry.title || entry.title.trim().length === 0) {
            errors.push({
                field: 'title',
                code: 'REQUIRED',
                message: 'Title is required',
                value: entry.title,
                severity: 'error'
            });
        }
        if (!entry.problem || entry.problem.trim().length === 0) {
            errors.push({
                field: 'problem',
                code: 'REQUIRED',
                message: 'Problem description is required',
                value: entry.problem,
                severity: 'error'
            });
        }
        if (!entry.solution || entry.solution.trim().length === 0) {
            errors.push({
                field: 'solution',
                code: 'REQUIRED',
                message: 'Solution description is required',
                value: entry.solution,
                severity: 'error'
            });
        }
        if (!entry.category) {
            errors.push({
                field: 'category',
                code: 'REQUIRED',
                message: 'Category is required',
                value: entry.category,
                severity: 'error'
            });
        }
        if (entry.title && entry.title.length > this.config.maxLength.title) {
            errors.push({
                field: 'title',
                code: 'MAX_LENGTH',
                message: `Title exceeds maximum length of ${this.config.maxLength.title} characters`,
                value: entry.title.length,
                severity: 'error'
            });
        }
        if (entry.title && entry.title.trim().length < this.config.minLength.title) {
            if (this.config.strict) {
                errors.push({
                    field: 'title',
                    code: 'MIN_LENGTH',
                    message: `Title must be at least ${this.config.minLength.title} characters`,
                    value: entry.title.trim().length,
                    severity: 'error'
                });
            }
            else {
                warnings.push({
                    field: 'title',
                    code: 'MIN_LENGTH',
                    message: `Title should be at least ${this.config.minLength.title} characters`,
                    suggestion: 'Consider providing a more descriptive title',
                    severity: 'warning'
                });
            }
        }
        if (entry.problem && entry.problem.length > this.config.maxLength.problem) {
            errors.push({
                field: 'problem',
                code: 'MAX_LENGTH',
                message: `Problem description exceeds maximum length of ${this.config.maxLength.problem} characters`,
                value: entry.problem.length,
                severity: 'error'
            });
        }
        if (entry.problem && entry.problem.trim().length < this.config.minLength.problem) {
            if (this.config.strict) {
                errors.push({
                    field: 'problem',
                    code: 'MIN_LENGTH',
                    message: `Problem description must be at least ${this.config.minLength.problem} characters`,
                    value: entry.problem.trim().length,
                    severity: 'error'
                });
            }
            else {
                warnings.push({
                    field: 'problem',
                    code: 'MIN_LENGTH',
                    message: `Problem description should be at least ${this.config.minLength.problem} characters`,
                    suggestion: 'Consider providing more details about the problem',
                    severity: 'warning'
                });
            }
        }
        if (entry.solution && entry.solution.length > this.config.maxLength.solution) {
            errors.push({
                field: 'solution',
                code: 'MAX_LENGTH',
                message: `Solution description exceeds maximum length of ${this.config.maxLength.solution} characters`,
                value: entry.solution.length,
                severity: 'error'
            });
        }
        if (entry.solution && entry.solution.trim().length < this.config.minLength.solution) {
            if (this.config.strict) {
                errors.push({
                    field: 'solution',
                    code: 'MIN_LENGTH',
                    message: `Solution description must be at least ${this.config.minLength.solution} characters`,
                    value: entry.solution.trim().length,
                    severity: 'error'
                });
            }
            else {
                warnings.push({
                    field: 'solution',
                    code: 'MIN_LENGTH',
                    message: `Solution description should be at least ${this.config.minLength.solution} characters`,
                    suggestion: 'Consider providing step-by-step instructions',
                    severity: 'warning'
                });
            }
        }
        if (entry.category && !this.config.patterns.category.includes(entry.category)) {
            errors.push({
                field: 'category',
                code: 'INVALID_CATEGORY',
                message: `Category must be one of: ${this.config.patterns.category.join(', ')}`,
                value: entry.category,
                severity: 'error'
            });
        }
        if (entry.tags) {
            if (!Array.isArray(entry.tags)) {
                errors.push({
                    field: 'tags',
                    code: 'INVALID_TYPE',
                    message: 'Tags must be an array of strings',
                    value: entry.tags,
                    severity: 'error'
                });
            }
            else {
                entry.tags.forEach((tag, index) => {
                    if (typeof tag !== 'string') {
                        errors.push({
                            field: `tags[${index}]`,
                            code: 'INVALID_TYPE',
                            message: 'Each tag must be a string',
                            value: tag,
                            severity: 'error'
                        });
                    }
                    else if (tag.length > this.config.maxLength.tags) {
                        errors.push({
                            field: `tags[${index}]`,
                            code: 'MAX_LENGTH',
                            message: `Tag exceeds maximum length of ${this.config.maxLength.tags} characters`,
                            value: tag.length,
                            severity: 'error'
                        });
                    }
                    else if (!this.config.patterns.tag.test(tag)) {
                        errors.push({
                            field: `tags[${index}]`,
                            code: 'INVALID_FORMAT',
                            message: 'Tag contains invalid characters (only alphanumeric, hyphens, and underscores allowed)',
                            value: tag,
                            severity: 'error'
                        });
                    }
                });
                const uniqueTags = new Set(entry.tags.map(tag => tag.toLowerCase()));
                if (uniqueTags.size !== entry.tags.length) {
                    warnings.push({
                        field: 'tags',
                        code: 'DUPLICATE_TAGS',
                        message: 'Duplicate tags detected',
                        suggestion: 'Remove duplicate tags to avoid redundancy',
                        severity: 'warning'
                    });
                }
                if (entry.tags.length > 10) {
                    warnings.push({
                        field: 'tags',
                        code: 'TOO_MANY_TAGS',
                        message: 'Consider using fewer tags for better organization',
                        suggestion: 'Limit tags to the most relevant ones (recommended: 3-7 tags)',
                        severity: 'warning'
                    });
                }
            }
        }
        if (entry.created_by) {
            if (typeof entry.created_by !== 'string' || entry.created_by.trim().length === 0) {
                errors.push({
                    field: 'created_by',
                    code: 'INVALID_FORMAT',
                    message: 'Created by must be a non-empty string',
                    value: entry.created_by,
                    severity: 'error'
                });
            }
            else if (entry.created_by.length > 100) {
                errors.push({
                    field: 'created_by',
                    code: 'MAX_LENGTH',
                    message: 'Created by exceeds maximum length of 100 characters',
                    value: entry.created_by.length,
                    severity: 'error'
                });
            }
        }
        this.performContentQualityChecks(entry, warnings);
        this.performSecurityChecks(entry, errors, warnings);
        this.runCustomValidators('entry', entry, errors, warnings);
        return {
            valid: errors.length === 0,
            errors,
            warnings,
            score: this.calculateQualityScore(entry, errors, warnings)
        };
    }
    validateUpdate(updates) {
        const errors = [];
        const warnings = [];
        const updatableFields = ['title', 'problem', 'solution', 'category', 'tags'];
        const hasUpdates = updatableFields.some(field => updates[field] !== undefined);
        if (!hasUpdates) {
            warnings.push({
                field: 'general',
                code: 'NO_UPDATES',
                message: 'No fields are being updated',
                suggestion: 'Provide at least one field to update',
                severity: 'warning'
            });
        }
        if (updates.title !== undefined) {
            if (!updates.title || updates.title.trim().length === 0) {
                errors.push({
                    field: 'title',
                    code: 'INVALID_VALUE',
                    message: 'Title cannot be empty',
                    value: updates.title,
                    severity: 'error'
                });
            }
            else {
                if (updates.title.length > this.config.maxLength.title) {
                    errors.push({
                        field: 'title',
                        code: 'MAX_LENGTH',
                        message: `Title exceeds maximum length of ${this.config.maxLength.title} characters`,
                        value: updates.title.length,
                        severity: 'error'
                    });
                }
                if (updates.title.trim().length < this.config.minLength.title) {
                    if (this.config.strict) {
                        errors.push({
                            field: 'title',
                            code: 'MIN_LENGTH',
                            message: `Title must be at least ${this.config.minLength.title} characters`,
                            value: updates.title.trim().length,
                            severity: 'error'
                        });
                    }
                    else {
                        warnings.push({
                            field: 'title',
                            code: 'MIN_LENGTH',
                            message: `Title should be at least ${this.config.minLength.title} characters`,
                            suggestion: 'Consider providing a more descriptive title',
                            severity: 'warning'
                        });
                    }
                }
            }
        }
        if (updates.problem !== undefined) {
            if (!updates.problem || updates.problem.trim().length === 0) {
                errors.push({
                    field: 'problem',
                    code: 'INVALID_VALUE',
                    message: 'Problem description cannot be empty',
                    value: updates.problem,
                    severity: 'error'
                });
            }
            else {
                if (updates.problem.length > this.config.maxLength.problem) {
                    errors.push({
                        field: 'problem',
                        code: 'MAX_LENGTH',
                        message: `Problem description exceeds maximum length of ${this.config.maxLength.problem} characters`,
                        value: updates.problem.length,
                        severity: 'error'
                    });
                }
                if (updates.problem.trim().length < this.config.minLength.problem) {
                    if (this.config.strict) {
                        errors.push({
                            field: 'problem',
                            code: 'MIN_LENGTH',
                            message: `Problem description must be at least ${this.config.minLength.problem} characters`,
                            value: updates.problem.trim().length,
                            severity: 'error'
                        });
                    }
                }
            }
        }
        if (updates.solution !== undefined) {
            if (!updates.solution || updates.solution.trim().length === 0) {
                errors.push({
                    field: 'solution',
                    code: 'INVALID_VALUE',
                    message: 'Solution description cannot be empty',
                    value: updates.solution,
                    severity: 'error'
                });
            }
            else {
                if (updates.solution.length > this.config.maxLength.solution) {
                    errors.push({
                        field: 'solution',
                        code: 'MAX_LENGTH',
                        message: `Solution description exceeds maximum length of ${this.config.maxLength.solution} characters`,
                        value: updates.solution.length,
                        severity: 'error'
                    });
                }
                if (updates.solution.trim().length < this.config.minLength.solution) {
                    if (this.config.strict) {
                        errors.push({
                            field: 'solution',
                            code: 'MIN_LENGTH',
                            message: `Solution description must be at least ${this.config.minLength.solution} characters`,
                            value: updates.solution.trim().length,
                            severity: 'error'
                        });
                    }
                }
            }
        }
        if (updates.category !== undefined) {
            if (!this.config.patterns.category.includes(updates.category)) {
                errors.push({
                    field: 'category',
                    code: 'INVALID_CATEGORY',
                    message: `Category must be one of: ${this.config.patterns.category.join(', ')}`,
                    value: updates.category,
                    severity: 'error'
                });
            }
        }
        if (updates.tags !== undefined) {
            if (!Array.isArray(updates.tags)) {
                errors.push({
                    field: 'tags',
                    code: 'INVALID_TYPE',
                    message: 'Tags must be an array of strings',
                    value: updates.tags,
                    severity: 'error'
                });
            }
            else {
                updates.tags.forEach((tag, index) => {
                    if (typeof tag !== 'string') {
                        errors.push({
                            field: `tags[${index}]`,
                            code: 'INVALID_TYPE',
                            message: 'Each tag must be a string',
                            value: tag,
                            severity: 'error'
                        });
                    }
                    else if (tag.length > this.config.maxLength.tags) {
                        errors.push({
                            field: `tags[${index}]`,
                            code: 'MAX_LENGTH',
                            message: `Tag exceeds maximum length of ${this.config.maxLength.tags} characters`,
                            value: tag.length,
                            severity: 'error'
                        });
                    }
                    else if (!this.config.patterns.tag.test(tag)) {
                        errors.push({
                            field: `tags[${index}]`,
                            code: 'INVALID_FORMAT',
                            message: 'Tag contains invalid characters',
                            value: tag,
                            severity: 'error'
                        });
                    }
                });
            }
        }
        if (updates.updated_by !== undefined) {
            if (typeof updates.updated_by !== 'string' || updates.updated_by.trim().length === 0) {
                errors.push({
                    field: 'updated_by',
                    code: 'INVALID_FORMAT',
                    message: 'Updated by must be a non-empty string',
                    value: updates.updated_by,
                    severity: 'error'
                });
            }
        }
        this.performSecurityChecks(updates, errors, warnings);
        this.runCustomValidators('update', updates, errors, warnings);
        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }
    validateSearch(query, options = {}) {
        const errors = [];
        const warnings = [];
        if (!query || typeof query !== 'string') {
            errors.push({
                field: 'query',
                code: 'REQUIRED',
                message: 'Search query is required',
                value: query,
                severity: 'error'
            });
        }
        else {
            if (query.trim().length === 0) {
                errors.push({
                    field: 'query',
                    code: 'EMPTY',
                    message: 'Search query cannot be empty',
                    value: query,
                    severity: 'error'
                });
            }
            if (query.length > 500) {
                errors.push({
                    field: 'query',
                    code: 'MAX_LENGTH',
                    message: 'Search query is too long (max 500 characters)',
                    value: query.length,
                    severity: 'error'
                });
            }
            if (query.trim().length < 2) {
                warnings.push({
                    field: 'query',
                    code: 'MIN_LENGTH',
                    message: 'Search query is very short',
                    suggestion: 'Use at least 2 characters for better search results',
                    severity: 'warning'
                });
            }
            const sqlInjectionPatterns = [
                /(['"])\s*(;|--|\*|\/\*)/i,
                /(union|select|insert|update|delete|drop|create|alter)\s+/i,
                /(\b(or|and)\b\s*\d+\s*=\s*\d+)/i
            ];
            if (sqlInjectionPatterns.some(pattern => pattern.test(query))) {
                errors.push({
                    field: 'query',
                    code: 'SECURITY_RISK',
                    message: 'Query contains potentially malicious content',
                    value: query,
                    severity: 'error'
                });
            }
        }
        if (options.limit !== undefined) {
            if (!Number.isInteger(options.limit) || options.limit < 1) {
                errors.push({
                    field: 'limit',
                    code: 'INVALID_VALUE',
                    message: 'Limit must be a positive integer',
                    value: options.limit,
                    severity: 'error'
                });
            }
            else if (options.limit > 1000) {
                warnings.push({
                    field: 'limit',
                    code: 'HIGH_VALUE',
                    message: 'Large limit may impact performance',
                    suggestion: 'Consider using pagination for better performance',
                    severity: 'warning'
                });
            }
        }
        if (options.offset !== undefined) {
            if (!Number.isInteger(options.offset) || options.offset < 0) {
                errors.push({
                    field: 'offset',
                    code: 'INVALID_VALUE',
                    message: 'Offset must be a non-negative integer',
                    value: options.offset,
                    severity: 'error'
                });
            }
        }
        if (options.category !== undefined) {
            if (!this.config.patterns.category.includes(options.category)) {
                errors.push({
                    field: 'category',
                    code: 'INVALID_CATEGORY',
                    message: `Category must be one of: ${this.config.patterns.category.join(', ')}`,
                    value: options.category,
                    severity: 'error'
                });
            }
        }
        if (options.tags !== undefined) {
            if (!Array.isArray(options.tags)) {
                errors.push({
                    field: 'tags',
                    code: 'INVALID_TYPE',
                    message: 'Tags must be an array of strings',
                    value: options.tags,
                    severity: 'error'
                });
            }
            else {
                options.tags.forEach((tag, index) => {
                    if (typeof tag !== 'string') {
                        errors.push({
                            field: `tags[${index}]`,
                            code: 'INVALID_TYPE',
                            message: 'Each tag must be a string',
                            value: tag,
                            severity: 'error'
                        });
                    }
                });
            }
        }
        if (options.sortBy !== undefined) {
            const validSortFields = ['relevance', 'usage', 'recent', 'success_rate', 'score'];
            if (!validSortFields.includes(options.sortBy)) {
                errors.push({
                    field: 'sortBy',
                    code: 'INVALID_VALUE',
                    message: `Sort field must be one of: ${validSortFields.join(', ')}`,
                    value: options.sortBy,
                    severity: 'error'
                });
            }
        }
        if (options.sortOrder !== undefined) {
            if (!['asc', 'desc'].includes(options.sortOrder)) {
                errors.push({
                    field: 'sortOrder',
                    code: 'INVALID_VALUE',
                    message: 'Sort order must be "asc" or "desc"',
                    value: options.sortOrder,
                    severity: 'error'
                });
            }
        }
        if (options.threshold !== undefined) {
            if (typeof options.threshold !== 'number' || options.threshold < 0 || options.threshold > 1) {
                errors.push({
                    field: 'threshold',
                    code: 'INVALID_VALUE',
                    message: 'Threshold must be a number between 0 and 1',
                    value: options.threshold,
                    severity: 'error'
                });
            }
        }
        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }
    validateBatch(entries) {
        if (!Array.isArray(entries)) {
            throw new services_1.ServiceError('Entries must be an array', 'INVALID_INPUT');
        }
        return entries.map((entry, index) => {
            try {
                const result = this.validateEntry(entry);
                result.errors.forEach(error => {
                    error.field = `entry[${index}].${error.field}`;
                });
                result.warnings.forEach(warning => {
                    warning.field = `entry[${index}].${warning.field}`;
                });
                return result;
            }
            catch (error) {
                return {
                    valid: false,
                    errors: [{
                            field: `entry[${index}]`,
                            code: 'VALIDATION_ERROR',
                            message: `Validation failed: ${error.message}`,
                            severity: 'error'
                        }],
                    warnings: []
                };
            }
        });
    }
    sanitizeEntry(entry) {
        if (!this.config.sanitize) {
            return entry;
        }
        const sanitized = { ...entry };
        if (sanitized.title) {
            sanitized.title = this.sanitizeString(sanitized.title);
        }
        if (sanitized.problem) {
            sanitized.problem = this.sanitizeString(sanitized.problem);
        }
        if (sanitized.solution) {
            sanitized.solution = this.sanitizeString(sanitized.solution);
        }
        if (sanitized.created_by) {
            sanitized.created_by = this.sanitizeString(sanitized.created_by);
        }
        if (sanitized.tags && Array.isArray(sanitized.tags)) {
            sanitized.tags = sanitized.tags
                .map(tag => this.sanitizeTag(tag))
                .filter(tag => tag.length > 0)
                .slice(0, 10);
        }
        return sanitized;
    }
    sanitizeUpdate(updates) {
        if (!this.config.sanitize) {
            return updates;
        }
        const sanitized = { ...updates };
        Object.keys(sanitized).forEach(key => {
            if (typeof sanitized[key] === 'string' && key !== 'category') {
                sanitized[key] = this.sanitizeString(sanitized[key]);
            }
        });
        if (sanitized.tags && Array.isArray(sanitized.tags)) {
            sanitized.tags = sanitized.tags
                .map(tag => this.sanitizeTag(tag))
                .filter(tag => tag.length > 0)
                .slice(0, 10);
        }
        return sanitized;
    }
    sanitizeBatch(entries) {
        if (!Array.isArray(entries)) {
            throw new services_1.ServiceError('Entries must be an array', 'INVALID_INPUT');
        }
        return entries.map(entry => this.sanitizeEntry(entry));
    }
    addCustomValidator(field, validator) {
        if (!this.customValidators.has(field)) {
            this.customValidators.set(field, []);
        }
        this.customValidators.get(field).push(validator);
    }
    removeCustomValidator(field) {
        this.customValidators.delete(field);
    }
    sanitizeString(str) {
        if (!str)
            return str;
        return str
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
            .replace(/<script[^>]*>.*?<\/script>/gi, '')
            .replace(/<[^>]*>/g, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '');
    }
    sanitizeTag(tag) {
        if (!tag || typeof tag !== 'string')
            return '';
        return tag
            .trim()
            .toLowerCase()
            .replace(/[^a-zA-Z0-9-_]/g, '')
            .replace(/^[-_]+|[-_]+$/g, '')
            .substring(0, this.config.maxLength.tags);
    }
    performContentQualityChecks(entry, warnings) {
        if (entry.problem && entry.problem.split(' ').length < 5) {
            warnings.push({
                field: 'problem',
                code: 'CONTENT_QUALITY',
                message: 'Problem description seems too brief',
                suggestion: 'Consider providing more context about the problem',
                severity: 'warning'
            });
        }
        if (entry.solution && entry.solution.split(' ').length < 10) {
            warnings.push({
                field: 'solution',
                code: 'CONTENT_QUALITY',
                message: 'Solution description seems too brief',
                suggestion: 'Consider providing step-by-step instructions',
                severity: 'warning'
            });
        }
        if (entry.problem || entry.solution) {
            const text = `${entry.problem || ''} ${entry.solution || ''}`.toLowerCase();
            const mainframeTerms = ['jcl', 'cobol', 'vsam', 'db2', 'cics', 'ims', 'mvs', 'tso', 'ispf'];
            if (!mainframeTerms.some(term => text.includes(term))) {
                warnings.push({
                    field: 'general',
                    code: 'CONTENT_RELEVANCE',
                    message: 'Content may not be mainframe-related',
                    suggestion: 'Verify this entry is relevant to mainframe systems',
                    severity: 'info'
                });
            }
        }
        if (entry.solution) {
            const actionWords = ['check', 'verify', 'run', 'execute', 'modify', 'update', 'add', 'remove'];
            const hasActionWords = actionWords.some(word => entry.solution.toLowerCase().includes(word));
            if (!hasActionWords) {
                warnings.push({
                    field: 'solution',
                    code: 'CONTENT_QUALITY',
                    message: 'Solution may lack actionable steps',
                    suggestion: 'Consider adding specific action steps (check, run, modify, etc.)',
                    severity: 'info'
                });
            }
        }
    }
    performSecurityChecks(entry, errors, warnings) {
        const sensitivePatterns = [
            /password\s*[:=]\s*\S+/i,
            /api[_-]?key\s*[:=]\s*\S+/i,
            /secret\s*[:=]\s*\S+/i,
            /token\s*[:=]\s*\S+/i,
            /\b\d{16,}\b/,
            /\b\d{3}-\d{2}-\d{4}\b/,
        ];
        const checkText = (text, fieldName) => {
            sensitivePatterns.forEach((pattern, index) => {
                if (pattern.test(text)) {
                    warnings.push({
                        field: fieldName,
                        code: 'SENSITIVE_DATA',
                        message: 'Potentially sensitive information detected',
                        suggestion: 'Remove passwords, API keys, or personal information',
                        severity: 'warning'
                    });
                }
            });
            const urlPattern = /https?:\/\/[^\s]+/gi;
            const urls = text.match(urlPattern);
            if (urls) {
                urls.forEach(url => {
                    if (url.includes('password') || url.includes('token') || url.includes('key')) {
                        warnings.push({
                            field: fieldName,
                            code: 'SENSITIVE_URL',
                            message: 'URL may contain sensitive parameters',
                            suggestion: 'Remove sensitive parameters from URLs',
                            severity: 'warning'
                        });
                    }
                });
            }
        };
        if (entry.problem)
            checkText(entry.problem, 'problem');
        if (entry.solution)
            checkText(entry.solution, 'solution');
        if (entry.title)
            checkText(entry.title, 'title');
    }
    runCustomValidators(context, data, errors, warnings) {
        this.customValidators.forEach((validators, field) => {
            if (data[field] !== undefined) {
                validators.forEach(validator => {
                    try {
                        if (!validator.validate(data[field])) {
                            errors.push({
                                field,
                                code: validator.code,
                                message: validator.message,
                                value: data[field],
                                severity: 'error'
                            });
                        }
                    }
                    catch (error) {
                        console.warn(`Custom validator error for field ${field}:`, error);
                    }
                });
            }
        });
    }
    calculateQualityScore(entry, errors, warnings) {
        let score = 100;
        score -= errors.length * 20;
        score -= warnings.length * 5;
        if (entry.tags && entry.tags.length >= 3 && entry.tags.length <= 7) {
            score += 5;
        }
        if (entry.problem && entry.problem.split(' ').length >= 20) {
            score += 5;
        }
        if (entry.solution && entry.solution.split(' ').length >= 30) {
            score += 5;
        }
        if (entry.solution && /\d+\./.test(entry.solution)) {
            score += 5;
        }
        const mainframeTerms = ['jcl', 'cobol', 'vsam', 'db2', 'cics', 'ims'];
        const text = `${entry.problem || ''} ${entry.solution || ''}`.toLowerCase();
        const termCount = mainframeTerms.filter(term => text.includes(term)).length;
        score += Math.min(termCount * 2, 10);
        return Math.max(0, Math.min(100, score));
    }
}
exports.ValidationService = ValidationService;
exports.default = ValidationService;
//# sourceMappingURL=ValidationService.js.map