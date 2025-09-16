"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupValidator = exports.StandardValidationRules = void 0;
exports.createDefaultValidationConfig = createDefaultValidationConfig;
exports.createQuickValidationConfig = createQuickValidationConfig;
exports.formatValidationReport = formatValidationReport;
const tslib_1 = require("tslib");
const events_1 = require("events");
const fs_1 = tslib_1.__importDefault(require("fs"));
const path_1 = tslib_1.__importDefault(require("path"));
const crypto_1 = require("crypto");
const util_1 = require("util");
const zlib_1 = require("zlib");
const better_sqlite3_1 = tslib_1.__importDefault(require("better-sqlite3"));
const gunzipAsync = (0, util_1.promisify)(zlib_1.gunzip);
class StandardValidationRules {
    static createChecksumRule() {
        return {
            id: 'checksum-validation',
            name: 'Checksum Integrity Check',
            type: 'checksum',
            severity: 'critical',
            enabled: true,
            config: {},
            validator: async (context) => {
                const startTime = Date.now();
                try {
                    if (!context.expectedChecksum) {
                        return {
                            ruleId: 'checksum-validation',
                            ruleName: 'Checksum Integrity Check',
                            status: 'skipped',
                            severity: 'critical',
                            duration: Date.now() - startTime,
                            details: 'No expected checksum provided'
                        };
                    }
                    let data = fs_1.default.readFileSync(context.backupPath);
                    if (context.backupPath.endsWith('.gz')) {
                        data = await gunzipAsync(data);
                    }
                    const actualChecksum = (0, crypto_1.createHash)('sha256').update(data).digest('hex');
                    const match = actualChecksum === context.expectedChecksum;
                    return {
                        ruleId: 'checksum-validation',
                        ruleName: 'Checksum Integrity Check',
                        status: match ? 'pass' : 'fail',
                        severity: 'critical',
                        duration: Date.now() - startTime,
                        details: match ? 'Checksum verification passed' :
                            `Checksum mismatch: expected ${context.expectedChecksum}, got ${actualChecksum}`,
                        evidence: {
                            expected: context.expectedChecksum,
                            actual: actualChecksum
                        },
                        metrics: {
                            dataSize: data.length,
                            checksumTime: Date.now() - startTime
                        }
                    };
                }
                catch (error) {
                    return {
                        ruleId: 'checksum-validation',
                        ruleName: 'Checksum Integrity Check',
                        status: 'error',
                        severity: 'critical',
                        duration: Date.now() - startTime,
                        details: `Checksum validation failed: ${error.message}`
                    };
                }
            }
        };
    }
    static createFileSizeRule() {
        return {
            id: 'file-size-validation',
            name: 'File Size Verification',
            type: 'size',
            severity: 'medium',
            enabled: true,
            config: {
                tolerancePercent: 5
            },
            validator: async (context) => {
                const startTime = Date.now();
                try {
                    const stats = fs_1.default.statSync(context.backupPath);
                    const actualSize = stats.size;
                    if (!context.expectedSize) {
                        return {
                            ruleId: 'file-size-validation',
                            ruleName: 'File Size Verification',
                            status: 'warning',
                            severity: 'medium',
                            duration: Date.now() - startTime,
                            details: `Backup size: ${actualSize} bytes (no expected size provided)`,
                            metrics: { actualSize }
                        };
                    }
                    const tolerancePercent = context.validationConfig.rules
                        .find(r => r.id === 'file-size-validation')?.config?.tolerancePercent || 5;
                    const variance = Math.abs(actualSize - context.expectedSize) / context.expectedSize * 100;
                    const withinTolerance = variance <= tolerancePercent;
                    return {
                        ruleId: 'file-size-validation',
                        ruleName: 'File Size Verification',
                        status: withinTolerance ? 'pass' : 'warning',
                        severity: 'medium',
                        duration: Date.now() - startTime,
                        details: withinTolerance ?
                            `File size within tolerance: ${actualSize} bytes` :
                            `File size variance: ${variance.toFixed(2)}% (${actualSize} vs ${context.expectedSize} bytes)`,
                        evidence: {
                            expected: context.expectedSize,
                            actual: actualSize,
                            variance: variance.toFixed(2)
                        },
                        metrics: {
                            actualSize,
                            expectedSize: context.expectedSize,
                            variancePercent: variance
                        }
                    };
                }
                catch (error) {
                    return {
                        ruleId: 'file-size-validation',
                        ruleName: 'File Size Verification',
                        status: 'error',
                        severity: 'medium',
                        duration: Date.now() - startTime,
                        details: `File size validation failed: ${error.message}`
                    };
                }
            }
        };
    }
    static createDatabaseIntegrityRule() {
        return {
            id: 'database-integrity',
            name: 'Database Integrity Check',
            type: 'data',
            severity: 'critical',
            enabled: true,
            config: {},
            validator: async (context) => {
                const startTime = Date.now();
                try {
                    const tempDbPath = path_1.default.join(context.tempDirectory, `temp-${Date.now()}.db`);
                    let data = fs_1.default.readFileSync(context.backupPath);
                    if (context.backupPath.endsWith('.gz')) {
                        data = await gunzipAsync(data);
                    }
                    const content = data.toString('utf-8');
                    if (content.includes('---BACKUP-DATA-SEPARATOR---')) {
                        const parts = content.split('---BACKUP-DATA-SEPARATOR---');
                        if (parts.length === 2) {
                            data = Buffer.from(parts[1], 'binary');
                        }
                    }
                    fs_1.default.writeFileSync(tempDbPath, data);
                    const db = new better_sqlite3_1.default(tempDbPath, { readonly: true });
                    try {
                        const result = db.prepare('PRAGMA integrity_check').get();
                        const isOk = result.integrity_check === 'ok';
                        const tableCount = db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'").get();
                        let recordCount = 0;
                        if (tableCount.count > 0) {
                            try {
                                const kbCount = db.prepare('SELECT COUNT(*) as count FROM kb_entries').get();
                                recordCount = kbCount.count;
                            }
                            catch {
                            }
                        }
                        return {
                            ruleId: 'database-integrity',
                            ruleName: 'Database Integrity Check',
                            status: isOk ? 'pass' : 'fail',
                            severity: 'critical',
                            duration: Date.now() - startTime,
                            details: isOk ?
                                `Database integrity check passed (${tableCount.count} tables, ${recordCount} records)` :
                                `Database integrity check failed: ${result.integrity_check}`,
                            evidence: {
                                integrityResult: result.integrity_check,
                                tableCount: tableCount.count,
                                recordCount
                            },
                            metrics: {
                                tableCount: tableCount.count,
                                recordCount,
                                integrityCheckTime: Date.now() - startTime
                            }
                        };
                    }
                    finally {
                        db.close();
                        if (fs_1.default.existsSync(tempDbPath)) {
                            fs_1.default.unlinkSync(tempDbPath);
                        }
                    }
                }
                catch (error) {
                    return {
                        ruleId: 'database-integrity',
                        ruleName: 'Database Integrity Check',
                        status: 'error',
                        severity: 'critical',
                        duration: Date.now() - startTime,
                        details: `Database integrity check failed: ${error.message}`
                    };
                }
            }
        };
    }
    static createSchemaValidationRule() {
        return {
            id: 'schema-validation',
            name: 'Database Schema Validation',
            type: 'schema',
            severity: 'high',
            enabled: true,
            config: {
                requiredTables: ['kb_entries'],
                requiredColumns: {
                    'kb_entries': ['id', 'title', 'problem', 'solution', 'category']
                }
            },
            validator: async (context) => {
                const startTime = Date.now();
                try {
                    const config = context.validationConfig.rules
                        .find(r => r.id === 'schema-validation')?.config || {};
                    const tempDbPath = path_1.default.join(context.tempDirectory, `schema-check-${Date.now()}.db`);
                    let data = fs_1.default.readFileSync(context.backupPath);
                    if (context.backupPath.endsWith('.gz')) {
                        data = await gunzipAsync(data);
                    }
                    const content = data.toString('utf-8');
                    if (content.includes('---BACKUP-DATA-SEPARATOR---')) {
                        const parts = content.split('---BACKUP-DATA-SEPARATOR---');
                        if (parts.length === 2) {
                            data = Buffer.from(parts[1], 'binary');
                        }
                    }
                    fs_1.default.writeFileSync(tempDbPath, data);
                    const db = new better_sqlite3_1.default(tempDbPath, { readonly: true });
                    const issues = [];
                    const validationDetails = {};
                    try {
                        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
                        const tableNames = tables.map(t => t.name);
                        validationDetails.foundTables = tableNames;
                        for (const requiredTable of config.requiredTables || []) {
                            if (!tableNames.includes(requiredTable)) {
                                issues.push(`Required table missing: ${requiredTable}`);
                            }
                        }
                        for (const [tableName, requiredColumns] of Object.entries(config.requiredColumns || {})) {
                            if (tableNames.includes(tableName)) {
                                const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
                                const columnNames = columns.map(c => c.name);
                                validationDetails[`${tableName}_columns`] = columnNames;
                                for (const requiredColumn of requiredColumns) {
                                    if (!columnNames.includes(requiredColumn)) {
                                        issues.push(`Required column missing in ${tableName}: ${requiredColumn}`);
                                    }
                                }
                            }
                        }
                        const isValid = issues.length === 0;
                        return {
                            ruleId: 'schema-validation',
                            ruleName: 'Database Schema Validation',
                            status: isValid ? 'pass' : 'fail',
                            severity: 'high',
                            duration: Date.now() - startTime,
                            details: isValid ?
                                `Schema validation passed (${tableNames.length} tables found)` :
                                `Schema validation failed: ${issues.join(', ')}`,
                            evidence: validationDetails,
                            metrics: {
                                tableCount: tableNames.length,
                                issueCount: issues.length
                            }
                        };
                    }
                    finally {
                        db.close();
                        if (fs_1.default.existsSync(tempDbPath)) {
                            fs_1.default.unlinkSync(tempDbPath);
                        }
                    }
                }
                catch (error) {
                    return {
                        ruleId: 'schema-validation',
                        ruleName: 'Database Schema Validation',
                        status: 'error',
                        severity: 'high',
                        duration: Date.now() - startTime,
                        details: `Schema validation failed: ${error.message}`
                    };
                }
            }
        };
    }
    static createPerformanceRule() {
        return {
            id: 'performance-validation',
            name: 'Backup Performance Check',
            type: 'performance',
            severity: 'low',
            enabled: true,
            config: {
                maxValidationTimeSeconds: 300,
                minCompressionRatio: 0.1
            },
            validator: async (context) => {
                const startTime = Date.now();
                try {
                    const config = context.validationConfig.rules
                        .find(r => r.id === 'performance-validation')?.config || {};
                    const stats = fs_1.default.statSync(context.backupPath);
                    const fileSize = stats.size;
                    const isCompressed = context.backupPath.endsWith('.gz');
                    let compressionRatio = 0;
                    if (isCompressed) {
                        const compressedData = fs_1.default.readFileSync(context.backupPath);
                        const uncompressedData = await gunzipAsync(compressedData);
                        compressionRatio = (compressedData.length - uncompressedData.length) / uncompressedData.length;
                    }
                    const issues = [];
                    const metrics = {
                        fileSize,
                        compressionRatio: compressionRatio * 100
                    };
                    if (isCompressed && compressionRatio < config.minCompressionRatio) {
                        issues.push(`Low compression ratio: ${(compressionRatio * 100).toFixed(1)}%`);
                    }
                    if (fileSize < 1024) {
                        issues.push('Backup file suspiciously small');
                    }
                    else if (fileSize > 10 * 1024 * 1024 * 1024) {
                        issues.push('Backup file very large, consider compression');
                    }
                    const status = issues.length === 0 ? 'pass' : 'warning';
                    return {
                        ruleId: 'performance-validation',
                        ruleName: 'Backup Performance Check',
                        status,
                        severity: 'low',
                        duration: Date.now() - startTime,
                        details: status === 'pass' ?
                            `Performance check passed (${fileSize} bytes${isCompressed ? `, ${(compressionRatio * 100).toFixed(1)}% compression` : ''})` :
                            `Performance issues: ${issues.join(', ')}`,
                        evidence: {
                            fileSize,
                            isCompressed,
                            compressionRatio: compressionRatio * 100,
                            issues
                        },
                        metrics
                    };
                }
                catch (error) {
                    return {
                        ruleId: 'performance-validation',
                        ruleName: 'Backup Performance Check',
                        status: 'error',
                        severity: 'low',
                        duration: Date.now() - startTime,
                        details: `Performance validation failed: ${error.message}`
                    };
                }
            }
        };
    }
    static getAllStandardRules() {
        return [
            this.createChecksumRule(),
            this.createFileSizeRule(),
            this.createDatabaseIntegrityRule(),
            this.createSchemaValidationRule(),
            this.createPerformanceRule()
        ];
    }
}
exports.StandardValidationRules = StandardValidationRules;
class BackupValidator extends events_1.EventEmitter {
    config;
    activeValidations = new Map();
    constructor(config) {
        super();
        this.config = {
            ...config,
            rules: [...config.rules, ...StandardValidationRules.getAllStandardRules()]
        };
    }
    async validate(backupPath, expectedChecksum, options = {}) {
        const validationId = this.generateValidationId();
        const startTime = Date.now();
        try {
            const tempDirectory = this.createTempDirectory();
            const progress = {
                phase: 'initializing',
                percentage: 0,
                currentRule: undefined,
                rulesCompleted: 0,
                totalRules: this.config.rules.filter(r => r.enabled).length,
                issuesFound: 0
            };
            this.activeValidations.set(validationId, progress);
            if (options.progressCallback) {
                options.progressCallback(progress);
            }
            const context = {
                backupPath,
                expectedChecksum,
                expectedSize: options.expectedSize,
                backupMetadata: options.backupMetadata,
                tempDirectory,
                validationConfig: this.config,
                progress
            };
            const ruleResults = [];
            const enabledRules = this.config.rules.filter(r => r.enabled);
            for (let i = 0; i < enabledRules.length; i++) {
                const rule = enabledRules[i];
                progress.phase = 'running_rules';
                progress.currentRule = rule.name;
                progress.percentage = (i / enabledRules.length) * 90;
                if (options.progressCallback) {
                    options.progressCallback(progress);
                }
                this.emit('rule:started', { validationId, rule: rule.name });
                try {
                    const result = await rule.validator(context);
                    ruleResults.push(result);
                    if (result.status === 'fail' || result.status === 'error') {
                        progress.issuesFound++;
                    }
                    this.emit('rule:completed', { validationId, rule: rule.name, result });
                }
                catch (error) {
                    const errorResult = {
                        ruleId: rule.id,
                        ruleName: rule.name,
                        status: 'error',
                        severity: rule.severity,
                        duration: 0,
                        details: `Rule execution failed: ${error.message}`
                    };
                    ruleResults.push(errorResult);
                    progress.issuesFound++;
                    this.emit('rule:error', { validationId, rule: rule.name, error });
                }
                progress.rulesCompleted++;
            }
            progress.phase = 'finalizing';
            progress.percentage = 95;
            if (options.progressCallback) {
                options.progressCallback(progress);
            }
            const result = this.generateValidationResult(ruleResults, startTime, backupPath, options);
            progress.phase = 'completed';
            progress.percentage = 100;
            if (options.progressCallback) {
                options.progressCallback(progress);
            }
            this.cleanupTempDirectory(tempDirectory);
            this.activeValidations.delete(validationId);
            this.emit('validation:completed', { validationId, result });
            return result;
        }
        catch (error) {
            this.activeValidations.delete(validationId);
            this.emit('validation:failed', { validationId, error });
            throw error;
        }
    }
    async quickValidate(backupPath, expectedChecksum) {
        try {
            const quickRules = this.config.rules.filter(r => r.enabled && (r.type === 'checksum' || r.severity === 'critical'));
            const tempDirectory = this.createTempDirectory();
            const context = {
                backupPath,
                expectedChecksum,
                tempDirectory,
                validationConfig: { ...this.config, rules: quickRules }
            };
            const issues = [];
            let valid = true;
            for (const rule of quickRules) {
                try {
                    const result = await rule.validator(context);
                    if (result.status === 'fail' || result.status === 'error') {
                        valid = false;
                        issues.push(`${rule.name}: ${result.details}`);
                    }
                }
                catch (error) {
                    valid = false;
                    issues.push(`${rule.name}: ${error.message}`);
                }
            }
            this.cleanupTempDirectory(tempDirectory);
            return { valid, issues };
        }
        catch (error) {
            return { valid: false, issues: [`Quick validation failed: ${error.message}`] };
        }
    }
    getActiveValidations() {
        return Array.from(this.activeValidations.keys());
    }
    getValidationProgress(validationId) {
        return this.activeValidations.get(validationId) || null;
    }
    async cancelValidation(validationId) {
        const progress = this.activeValidations.get(validationId);
        if (!progress) {
            return false;
        }
        this.activeValidations.delete(validationId);
        this.emit('validation:cancelled', { validationId });
        return true;
    }
    updateConfig(updates) {
        this.config = { ...this.config, ...updates };
        this.emit('config:updated', this.config);
    }
    addCustomRule(rule) {
        const existingIndex = this.config.rules.findIndex(r => r.id === rule.id);
        if (existingIndex >= 0) {
            this.config.rules[existingIndex] = rule;
        }
        else {
            this.config.rules.push(rule);
        }
        this.emit('rule:added', rule);
    }
    removeRule(ruleId) {
        const index = this.config.rules.findIndex(r => r.id === ruleId);
        if (index >= 0) {
            const rule = this.config.rules.splice(index, 1)[0];
            this.emit('rule:removed', rule);
            return true;
        }
        return false;
    }
    getRules() {
        return [...this.config.rules];
    }
    generateValidationId() {
        return (0, crypto_1.createHash)('sha256')
            .update(`${Date.now()}-${Math.random()}-validation`)
            .digest('hex')
            .substring(0, 16);
    }
    createTempDirectory() {
        const tempDir = path_1.default.join(process.cwd(), 'temp', `validation-${Date.now()}`);
        if (!fs_1.default.existsSync(tempDir)) {
            fs_1.default.mkdirSync(tempDir, { recursive: true });
        }
        return tempDir;
    }
    cleanupTempDirectory(tempDir) {
        try {
            if (fs_1.default.existsSync(tempDir)) {
                const files = fs_1.default.readdirSync(tempDir);
                for (const file of files) {
                    fs_1.default.unlinkSync(path_1.default.join(tempDir, file));
                }
                fs_1.default.rmdirSync(tempDir);
            }
        }
        catch (error) {
            console.warn(`Failed to cleanup temp directory ${tempDir}:`, error);
        }
    }
    generateValidationResult(ruleResults, startTime, backupPath, options) {
        const totalDuration = Date.now() - startTime;
        const summary = {
            totalChecks: ruleResults.length,
            passedChecks: ruleResults.filter(r => r.status === 'pass').length,
            warningChecks: ruleResults.filter(r => r.status === 'warning').length,
            failedChecks: ruleResults.filter(r => r.status === 'fail' || r.status === 'error').length,
            criticalIssues: ruleResults.filter(r => (r.status === 'fail' || r.status === 'error') && r.severity === 'critical').length,
            timeToValidate: totalDuration,
            dataIntegrityScore: this.calculateIntegrityScore(ruleResults),
            reliabilityScore: this.calculateReliabilityScore(ruleResults)
        };
        let overall;
        if (summary.criticalIssues > 0) {
            overall = 'fail';
        }
        else if (summary.failedChecks > 0 || summary.warningChecks > 0) {
            overall = 'warning';
        }
        else {
            overall = 'pass';
        }
        const performance = {
            totalDuration,
            ruleExecutionTimes: {},
            resourceUsage: {
                peakMemoryMb: process.memoryUsage().heapUsed / 1024 / 1024,
                avgCpuPercent: 0,
                diskIoMb: 0
            },
            bottlenecks: this.identifyBottlenecks(ruleResults)
        };
        ruleResults.forEach(result => {
            performance.ruleExecutionTimes[result.ruleId] = result.duration;
        });
        const issues = ruleResults
            .filter(r => r.status === 'fail' || r.status === 'error')
            .map(r => this.createValidationIssue(r));
        const recommendations = this.generateRecommendations(ruleResults, summary);
        const report = {
            timestamp: new Date(),
            backupInfo: {
                path: backupPath,
                size: fs_1.default.statSync(backupPath).size,
                checksum: options.expectedChecksum || 'unknown',
                strategy: options.backupMetadata?.strategy
            },
            validationConfig: this.config,
            issues,
            passedRules: ruleResults.filter(r => r.status === 'pass').map(r => r.ruleName),
            warnings: ruleResults.filter(r => r.status === 'warning').map(r => r.details),
            errors: ruleResults.filter(r => r.status === 'fail' || r.status === 'error').map(r => r.details),
            recommendations
        };
        return {
            success: overall !== 'fail',
            overall,
            summary,
            ruleResults,
            performance,
            recommendations,
            report
        };
    }
    calculateIntegrityScore(results) {
        const integrityRules = results.filter(r => r.ruleId.includes('integrity') || r.ruleId.includes('checksum') || r.ruleId.includes('database'));
        if (integrityRules.length === 0)
            return 100;
        const passed = integrityRules.filter(r => r.status === 'pass').length;
        return Math.round((passed / integrityRules.length) * 100);
    }
    calculateReliabilityScore(results) {
        const totalRules = results.length;
        if (totalRules === 0)
            return 100;
        const passed = results.filter(r => r.status === 'pass').length;
        const warnings = results.filter(r => r.status === 'warning').length;
        const score = (passed + warnings * 0.5) / totalRules * 100;
        return Math.round(score);
    }
    identifyBottlenecks(results) {
        const bottlenecks = [];
        const avgTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
        results.forEach(result => {
            if (result.duration > avgTime * 3) {
                bottlenecks.push(`${result.ruleName} (${result.duration}ms)`);
            }
        });
        return bottlenecks;
    }
    createValidationIssue(result) {
        return {
            id: `issue-${result.ruleId}-${Date.now()}`,
            ruleId: result.ruleId,
            severity: result.severity,
            category: this.categorizeRule(result.ruleId),
            description: result.details,
            impact: this.getImpactDescription(result.severity),
            resolution: result.recommendations?.join('; ') || 'Manual investigation required',
            evidence: result.evidence,
            detectedAt: new Date()
        };
    }
    categorizeRule(ruleId) {
        if (ruleId.includes('integrity') || ruleId.includes('checksum') || ruleId.includes('database')) {
            return 'integrity';
        }
        if (ruleId.includes('performance') || ruleId.includes('size')) {
            return 'performance';
        }
        if (ruleId.includes('schema') || ruleId.includes('compatibility')) {
            return 'compatibility';
        }
        return 'security';
    }
    getImpactDescription(severity) {
        switch (severity) {
            case 'critical': return 'May cause data loss or corruption during restore';
            case 'high': return 'May cause restore failures or data inconsistencies';
            case 'medium': return 'May cause performance issues or minor data problems';
            case 'low': return 'May cause minor performance or usability issues';
            default: return 'Unknown impact';
        }
    }
    generateRecommendations(results, summary) {
        const recommendations = [];
        if (summary.criticalIssues > 0) {
            recommendations.push('Address all critical issues before using this backup for restore operations');
        }
        if (summary.failedChecks > summary.passedChecks) {
            recommendations.push('Consider recreating this backup due to multiple validation failures');
        }
        if (summary.timeToValidate > 300000) {
            recommendations.push('Validation time is excessive - consider optimizing backup size or validation rules');
        }
        if (summary.dataIntegrityScore < 80) {
            recommendations.push('Data integrity score is low - verify backup creation process');
        }
        results.forEach(result => {
            if (result.recommendations) {
                recommendations.push(...result.recommendations);
            }
        });
        return [...new Set(recommendations)];
    }
}
exports.BackupValidator = BackupValidator;
function createDefaultValidationConfig() {
    return {
        enableIntegrityChecks: true,
        enableChecksumValidation: true,
        enableRestoreValidation: false,
        validationSamplePercent: 100,
        performance: {
            maxValidationTime: 300,
            enableParallelValidation: false,
            maxConcurrentValidations: 1
        },
        rules: StandardValidationRules.getAllStandardRules()
    };
}
function createQuickValidationConfig() {
    const config = createDefaultValidationConfig();
    config.rules = config.rules.filter(r => r.type === 'checksum' || r.type === 'size' || r.severity === 'critical');
    config.performance.maxValidationTime = 60;
    config.validationSamplePercent = 10;
    return config;
}
function formatValidationReport(result) {
    const { summary, report } = result;
    const lines = [
        '='.repeat(60),
        `BACKUP VALIDATION REPORT`,
        '='.repeat(60),
        ``,
        `Backup: ${report.backupInfo.path}`,
        `Size: ${(report.backupInfo.size / 1024 / 1024).toFixed(2)} MB`,
        `Validation Time: ${(summary.timeToValidate / 1000).toFixed(2)}s`,
        `Overall Status: ${result.overall.toUpperCase()}`,
        ``,
        `SUMMARY:`,
        `  Total Checks: ${summary.totalChecks}`,
        `  Passed: ${summary.passedChecks}`,
        `  Warnings: ${summary.warningChecks}`,
        `  Failed: ${summary.failedChecks}`,
        `  Critical Issues: ${summary.criticalIssues}`,
        `  Data Integrity Score: ${summary.dataIntegrityScore}%`,
        `  Reliability Score: ${summary.reliabilityScore}%`,
        ``
    ];
    if (report.errors.length > 0) {
        lines.push(`ERRORS:`);
        report.errors.forEach(error => lines.push(`  ❌ ${error}`));
        lines.push(``);
    }
    if (report.warnings.length > 0) {
        lines.push(`WARNINGS:`);
        report.warnings.forEach(warning => lines.push(`  ⚠️ ${warning}`));
        lines.push(``);
    }
    if (result.recommendations.length > 0) {
        lines.push(`RECOMMENDATIONS:`);
        result.recommendations.forEach(rec => lines.push(`  💡 ${rec}`));
        lines.push(``);
    }
    lines.push('='.repeat(60));
    return lines.join('\n');
}
//# sourceMappingURL=BackupValidator.js.map