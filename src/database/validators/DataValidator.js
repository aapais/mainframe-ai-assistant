"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InputSanitizer = exports.DataValidator = exports.UserInputSchema = exports.SearchQuerySchema = exports.KBEntrySchema = void 0;
const zod_1 = require("zod");
exports.KBEntrySchema = zod_1.z.object({
    id: zod_1.z.string().uuid().optional(),
    title: zod_1.z.string()
        .min(5, 'Title must be at least 5 characters long')
        .max(200, 'Title cannot exceed 200 characters')
        .regex(/^[a-zA-Z0-9\s\-_:()/.]+$/, 'Title contains invalid characters'),
    problem: zod_1.z.string()
        .min(20, 'Problem description must be at least 20 characters long')
        .max(5000, 'Problem description cannot exceed 5000 characters'),
    solution: zod_1.z.string()
        .min(20, 'Solution must be at least 20 characters long')
        .max(10000, 'Solution cannot exceed 10000 characters'),
    category: zod_1.z.enum(['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'IMS', 'CICS', 'TSO', 'Other'])
        .refine(val => val !== undefined, 'Category is required'),
    severity: zod_1.z.enum(['critical', 'high', 'medium', 'low']).optional(),
    tags: zod_1.z.array(zod_1.z.string().min(2).max(30))
        .max(10, 'Maximum 10 tags allowed')
        .optional()
        .transform(tags => tags?.map(tag => tag.toLowerCase().trim()))
        .refine(tags => {
        if (!tags)
            return true;
        const unique = new Set(tags);
        return unique.size === tags.length;
    }, 'Duplicate tags are not allowed'),
    created_at: zod_1.z.date().optional(),
    updated_at: zod_1.z.date().optional(),
    created_by: zod_1.z.string().max(100).optional(),
    usage_count: zod_1.z.number().int().min(0).optional(),
    success_count: zod_1.z.number().int().min(0).optional(),
    failure_count: zod_1.z.number().int().min(0).optional(),
});
exports.SearchQuerySchema = zod_1.z.object({
    query: zod_1.z.string()
        .min(2, 'Search query must be at least 2 characters long')
        .max(1000, 'Search query cannot exceed 1000 characters'),
    category: zod_1.z.string().optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    severity: zod_1.z.enum(['critical', 'high', 'medium', 'low']).optional(),
    limit: zod_1.z.number().int().min(1).max(100).optional(),
    offset: zod_1.z.number().int().min(0).optional(),
});
exports.UserInputSchema = zod_1.z.object({
    userId: zod_1.z.string().min(1).max(100),
    sessionId: zod_1.z.string().min(1).max(200).optional(),
    action: zod_1.z.enum(['search', 'view', 'rate', 'create', 'update', 'delete']),
    timestamp: zod_1.z.date().optional(),
});
class DataValidator {
    customRules = [];
    sanitizationOptions = {
        trimStrings: true,
        normalizeWhitespace: true,
        removeHtmlTags: true,
        maxLength: {
            title: 200,
            problem: 5000,
            solution: 10000
        }
    };
    constructor(options) {
        if (options?.customRules) {
            this.customRules = options.customRules;
        }
        if (options?.sanitizationOptions) {
            this.sanitizationOptions = { ...this.sanitizationOptions, ...options.sanitizationOptions };
        }
        this.initializeDefaultRules();
    }
    async validateKBEntry(data) {
        try {
            const sanitizedData = this.sanitizeData(data, [
                'title', 'problem', 'solution', 'category', 'created_by'
            ]);
            const validatedData = exports.KBEntrySchema.parse(sanitizedData);
            const businessValidation = await this.validateBusinessRules(validatedData, 'kb_entry');
            return {
                valid: businessValidation.errors.length === 0,
                errors: businessValidation.errors,
                warnings: businessValidation.warnings,
                sanitizedData: validatedData
            };
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                return {
                    valid: false,
                    errors: this.formatZodErrors(error),
                    warnings: []
                };
            }
            return {
                valid: false,
                errors: [{
                        field: 'unknown',
                        code: 'VALIDATION_ERROR',
                        message: error.message || 'Unknown validation error'
                    }],
                warnings: []
            };
        }
    }
    async validateSearchQuery(data) {
        try {
            const sanitizedData = this.sanitizeData(data, ['query', 'category']);
            const validatedData = exports.SearchQuerySchema.parse(sanitizedData);
            const warnings = [];
            if (validatedData.query.length < 3) {
                warnings.push({
                    field: 'query',
                    code: 'SHORT_QUERY',
                    message: 'Short queries may return too many results',
                    value: validatedData.query
                });
            }
            const suspiciousPatterns = [';', '--', '/*', '*/', 'DROP', 'DELETE', 'UPDATE'];
            const hasSuspiciousContent = suspiciousPatterns.some(pattern => validatedData.query.toUpperCase().includes(pattern.toUpperCase()));
            if (hasSuspiciousContent) {
                return {
                    valid: false,
                    errors: [{
                            field: 'query',
                            code: 'SUSPICIOUS_CONTENT',
                            message: 'Query contains potentially unsafe content'
                        }],
                    warnings: []
                };
            }
            return {
                valid: true,
                errors: [],
                warnings,
                sanitizedData: validatedData
            };
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                return {
                    valid: false,
                    errors: this.formatZodErrors(error),
                    warnings: []
                };
            }
            return {
                valid: false,
                errors: [{
                        field: 'unknown',
                        code: 'VALIDATION_ERROR',
                        message: error.message || 'Unknown validation error'
                    }],
                warnings: []
            };
        }
    }
    async validateUserInput(data) {
        try {
            const sanitizedData = this.sanitizeData(data, ['userId', 'sessionId']);
            const validatedData = exports.UserInputSchema.parse(sanitizedData);
            return {
                valid: true,
                errors: [],
                warnings: [],
                sanitizedData: validatedData
            };
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                return {
                    valid: false,
                    errors: this.formatZodErrors(error),
                    warnings: []
                };
            }
            return {
                valid: false,
                errors: [{
                        field: 'unknown',
                        code: 'VALIDATION_ERROR',
                        message: error.message || 'Unknown validation error'
                    }],
                warnings: []
            };
        }
    }
    sanitizeData(data, stringFields) {
        const sanitized = { ...data };
        for (const field of stringFields) {
            if (sanitized[field] && typeof sanitized[field] === 'string') {
                let value = sanitized[field];
                if (this.sanitizationOptions.trimStrings) {
                    value = value.trim();
                }
                if (this.sanitizationOptions.normalizeWhitespace) {
                    value = value.replace(/\s+/g, ' ');
                }
                if (this.sanitizationOptions.removeHtmlTags) {
                    value = this.stripHtmlTags(value);
                }
                const maxLength = this.sanitizationOptions.maxLength?.[field];
                if (maxLength && value.length > maxLength) {
                    value = value.substring(0, maxLength);
                }
                sanitized[field] = value;
            }
        }
        return sanitized;
    }
    stripHtmlTags(input) {
        if (!input)
            return input;
        const withoutScripts = input.replace(/<(script|style)[^>]*>.*?<\/\1>/gis, '');
        const withoutTags = withoutScripts.replace(/<[^>]*>/g, '');
        return withoutTags
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
    }
    async validateBusinessRules(data, context) {
        const errors = [];
        const warnings = [];
        for (const rule of this.customRules) {
            if (data[rule.field] !== undefined) {
                const result = rule.validator(data[rule.field], data);
                if (result === false || (typeof result === 'string' && result.length > 0)) {
                    const error = {
                        field: rule.field,
                        code: 'BUSINESS_RULE_VIOLATION',
                        message: typeof result === 'string' ? result : rule.message,
                        value: data[rule.field]
                    };
                    if (rule.level === 'error') {
                        errors.push(error);
                    }
                    else {
                        warnings.push(error);
                    }
                }
            }
        }
        if (context === 'kb_entry') {
            if (data.category === 'DB2' && data.solution && !data.solution.includes('SQL')) {
                warnings.push({
                    field: 'solution',
                    code: 'CATEGORY_MISMATCH',
                    message: 'DB2 solutions typically include SQL commands'
                });
            }
            if (data.problem && data.category === 'JCL') {
                const jclKeywords = ['JOB', 'EXEC', 'DD', 'DSN'];
                const hasJclKeywords = jclKeywords.some(keyword => data.problem.toUpperCase().includes(keyword));
                if (!hasJclKeywords) {
                    warnings.push({
                        field: 'problem',
                        code: 'MISSING_KEYWORDS',
                        message: 'JCL problems typically mention JOB, EXEC, DD, or DSN'
                    });
                }
            }
        }
        return { errors, warnings };
    }
    formatZodErrors(zodError) {
        return zodError.errors.map(error => ({
            field: error.path.join('.'),
            code: error.code,
            message: error.message,
            value: error.received
        }));
    }
    initializeDefaultRules() {
        this.customRules.push({
            field: 'tags',
            validator: (tags) => {
                if (!tags)
                    return true;
                const offensiveWords = ['damn', 'shit'];
                const hasOffensive = tags.some(tag => offensiveWords.some(word => tag.toLowerCase().includes(word)));
                return !hasOffensive;
            },
            message: 'Tags contain inappropriate content',
            level: 'error'
        }, {
            field: 'solution',
            validator: (solution) => {
                if (!solution)
                    return true;
                const actionWords = ['check', 'verify', 'run', 'execute', 'modify', 'update'];
                const hasActionWords = actionWords.some(word => solution.toLowerCase().includes(word));
                return hasActionWords || 'Solution should contain actionable steps';
            },
            message: 'Solution should include actionable steps',
            level: 'warning'
        }, {
            field: 'problem',
            validator: (problem) => {
                if (!problem)
                    return true;
                const errorPatterns = [
                    /S0C\d/i,
                    /U\d{4}/i,
                    /IEF\d{3}[A-Z]/i,
                    /SQLCODE/i,
                    /status \d+/i
                ];
                const hasErrorPattern = errorPatterns.some(pattern => pattern.test(problem));
                return hasErrorPattern || 'Consider including specific error codes or messages';
            },
            message: 'Problems with specific error codes are more useful',
            level: 'warning'
        });
    }
    addRule(rule) {
        this.customRules.push(rule);
    }
    removeRule(field, code) {
        this.customRules = this.customRules.filter(rule => {
            if (code) {
                return !(rule.field === field && rule.message.includes(code));
            }
            return rule.field !== field;
        });
    }
    setSanitizationOptions(options) {
        this.sanitizationOptions = { ...this.sanitizationOptions, ...options };
    }
    getValidationStats() {
        return {
            totalRules: this.customRules.length,
            errorRules: this.customRules.filter(r => r.level === 'error').length,
            warningRules: this.customRules.filter(r => r.level === 'warning').length,
            customRules: this.customRules.length
        };
    }
}
exports.DataValidator = DataValidator;
class InputSanitizer {
    static sanitizeSqlIdentifier(identifier) {
        if (!identifier)
            throw new Error('Identifier cannot be empty');
        const cleaned = identifier.replace(/[^a-zA-Z0-9_-]/g, '');
        if (cleaned.length === 0) {
            throw new Error('Identifier contains no valid characters');
        }
        if (cleaned.length > 64) {
            throw new Error('Identifier too long (max 64 characters)');
        }
        if (/^\d/.test(cleaned)) {
            throw new Error('Identifier cannot start with a number');
        }
        return cleaned;
    }
    static sanitizeFilePath(filePath) {
        if (!filePath)
            throw new Error('File path cannot be empty');
        let cleaned = filePath.replace(/[<>:"|?*]/g, '');
        cleaned = cleaned.replace(/\.\./g, '');
        cleaned = cleaned.replace(/[/\\]+/g, '/');
        return cleaned;
    }
    static sanitizeEmail(email) {
        if (!email)
            throw new Error('Email cannot be empty');
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const trimmed = email.trim().toLowerCase();
        if (!emailRegex.test(trimmed)) {
            throw new Error('Invalid email format');
        }
        return trimmed;
    }
    static sanitizeTextContent(content, options = {}) {
        if (!content)
            return '';
        let sanitized = content.trim();
        if (!options.allowHtml) {
            sanitized = sanitized.replace(/<[^>]*>/g, '');
        }
        if (options.preserveLineBreaks) {
            sanitized = sanitized.replace(/[ \t]+/g, ' ');
        }
        else {
            sanitized = sanitized.replace(/\s+/g, ' ');
        }
        if (options.maxLength && sanitized.length > options.maxLength) {
            sanitized = sanitized.substring(0, options.maxLength);
        }
        return sanitized;
    }
}
exports.InputSanitizer = InputSanitizer;
//# sourceMappingURL=DataValidator.js.map