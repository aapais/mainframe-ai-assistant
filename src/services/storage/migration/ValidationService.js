"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationService = void 0;
const events_1 = require("events");
class ValidationService extends events_1.EventEmitter {
    db;
    validationHistory = new Map();
    mvpValidationRules = new Map();
    constructor(db) {
        super();
        this.db = db;
        this.initializeValidationTracking();
        this.setupMVPValidationRules();
    }
    async performComprehensiveValidation() {
        const startTime = Date.now();
        this.emit('validationStarted', { type: 'comprehensive' });
        const results = await Promise.all([
            this.validateSchemaConsistency(),
            this.validateDataIntegrity(),
            this.validateReferentialIntegrity(),
            this.validateIndexIntegrity(),
            this.validateConstraints(),
            this.validatePerformance(),
            this.validateMVPCompliance()
        ]);
        const [schemaConsistency, dataIntegrity, referentialIntegrity, indexIntegrity, constraintValidation, performanceValidation, mvpCompliance] = results;
        const summary = this.generateValidationSummary(results);
        const report = {
            schemaConsistency,
            dataIntegrity,
            referentialIntegrity,
            indexIntegrity,
            constraintValidation,
            performanceValidation,
            mvpCompliance,
            summary
        };
        const validationTime = Date.now() - startTime;
        this.emit('validationCompleted', {
            type: 'comprehensive',
            duration: validationTime,
            overallHealth: summary.overallHealth,
            criticalIssues: summary.criticalIssues
        });
        this.storeValidationResult('comprehensive', report, validationTime);
        return report;
    }
    async validateMigrationPlan(plan) {
        const errors = [];
        const warnings = [];
        const recommendations = [];
        await this.validateMigrationSequence(plan.migrations, errors);
        await this.validateMigrationsSQL(plan.migrations, errors);
        await this.checkDangerousOperations(plan.migrations, warnings);
        await this.validateMigrationDependencies(plan.migrations, errors);
        await this.assessDataImpact(plan.migrations, warnings, recommendations);
        await this.assessPerformanceImpact(plan.migrations, warnings, recommendations);
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            performance: {
                queryTime: 0,
                tablesScanned: plan.migrations.length,
                rowsValidated: 0,
                indexUtilization: 0,
                memoryUsage: 0
            },
            recommendations
        };
    }
    async validateMigrationSql(migration) {
        const errors = [];
        const warnings = [];
        const recommendations = [];
        try {
            this.validateSqlSyntax(migration.up, errors);
            this.validateSqlSyntax(migration.down, errors);
            this.checkCommonSqlIssues(migration.up, warnings);
            this.checkCommonSqlIssues(migration.down, warnings);
            this.validateRollbackCompleteness(migration, warnings);
            this.validateBestPractices(migration, warnings, recommendations);
        }
        catch (error) {
            errors.push({
                type: 'syntax',
                severity: 'critical',
                code: 'SQL_SYNTAX_ERROR',
                message: error.message,
                suggestion: 'Fix SQL syntax errors before proceeding'
            });
        }
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            performance: {
                queryTime: 0,
                tablesScanned: 0,
                rowsValidated: 0,
                indexUtilization: 0,
                memoryUsage: 0
            },
            recommendations
        };
    }
    async validatePreMigrationState() {
        const errors = [];
        const warnings = [];
        const recommendations = [];
        try {
            this.db.prepare('SELECT 1').get();
        }
        catch (error) {
            errors.push({
                type: 'schema',
                severity: 'critical',
                code: 'DB_CONNECTION_ERROR',
                message: 'Database connection failed',
                suggestion: 'Ensure database is accessible and not corrupted'
            });
        }
        const diskSpace = await this.checkDiskSpace();
        if (diskSpace.available < diskSpace.required * 2) {
            warnings.push({
                type: 'performance',
                message: 'Low disk space detected',
                impact: 'high',
                suggestion: 'Free up disk space before migration'
            });
        }
        const activeTransactions = await this.checkActiveTransactions();
        if (activeTransactions > 0) {
            warnings.push({
                type: 'compatibility',
                message: `${activeTransactions} active transactions detected`,
                impact: 'medium',
                suggestion: 'Wait for transactions to complete or restart application'
            });
        }
        const schemaValidation = await this.validateCurrentSchema();
        errors.push(...schemaValidation.errors);
        warnings.push(...schemaValidation.warnings);
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            performance: {
                queryTime: 0,
                tablesScanned: 0,
                rowsValidated: 0,
                indexUtilization: 0,
                memoryUsage: 0
            },
            recommendations
        };
    }
    async validatePostMigration(migration) {
        const errors = [];
        const warnings = [];
        const recommendations = [];
        const migrationExists = this.db.prepare(`
      SELECT COUNT(*) as count FROM schema_migrations WHERE version = ?
    `).get(migration.version);
        if (migrationExists.count === 0) {
            errors.push({
                type: 'schema',
                severity: 'critical',
                code: 'MIGRATION_NOT_RECORDED',
                message: `Migration ${migration.version} not found in schema_migrations`,
                suggestion: 'Verify migration was applied correctly'
            });
        }
        await this.validateExpectedChanges(migration, errors, warnings);
        await this.validateDataConsistencyAfterMigration(migration, errors, warnings);
        await this.validatePerformanceAfterMigration(migration, warnings, recommendations);
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            performance: {
                queryTime: 0,
                tablesScanned: 0,
                rowsValidated: 0,
                indexUtilization: 0,
                memoryUsage: 0
            },
            recommendations
        };
    }
    async validateRollbackResult(targetVersion) {
        const errors = [];
        const warnings = [];
        const recommendations = [];
        const currentVersion = this.getCurrentVersion();
        if (currentVersion !== targetVersion) {
            errors.push({
                type: 'schema',
                severity: 'critical',
                code: 'ROLLBACK_VERSION_MISMATCH',
                message: `Expected version ${targetVersion}, found ${currentVersion}`,
                suggestion: 'Rollback may have failed, investigate and retry'
            });
        }
        const schemaValidation = await this.validateSchemaAtVersion(targetVersion);
        errors.push(...schemaValidation.errors);
        warnings.push(...schemaValidation.warnings);
        await this.validateNoUnexpectedDataLoss(targetVersion, warnings);
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            performance: {
                queryTime: 0,
                tablesScanned: 0,
                rowsValidated: 0,
                indexUtilization: 0,
                memoryUsage: 0
            },
            recommendations
        };
    }
    async validateSqlSyntax(sql) {
        try {
            const statements = sql.split(';').filter(stmt => stmt.trim());
            for (const statement of statements) {
                if (statement.trim()) {
                    this.db.prepare(statement.trim());
                }
            }
        }
        catch (error) {
            throw new Error(`SQL syntax error: ${error.message}`);
        }
    }
    initializeValidationTracking() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS validation_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        validation_type TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        result TEXT NOT NULL,
        duration_ms INTEGER NOT NULL,
        overall_health TEXT NOT NULL,
        critical_issues INTEGER NOT NULL,
        warnings INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS validation_errors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        validation_id INTEGER NOT NULL,
        error_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        code TEXT NOT NULL,
        message TEXT NOT NULL,
        location TEXT,
        suggestion TEXT NOT NULL,
        FOREIGN KEY (validation_id) REFERENCES validation_history(id)
      );
    `);
    }
    setupMVPValidationRules() {
        this.mvpValidationRules.set(1, {
            requiredTables: ['kb_entries', 'kb_tags', 'search_history'],
            requiredIndexes: ['idx_category', 'idx_created_at'],
            requiredFeatures: ['basic_search', 'categorization'],
            constraints: [
                'kb_entries.id should be primary key',
                'kb_tags should have foreign key to kb_entries'
            ]
        });
        this.mvpValidationRules.set(2, {
            requiredTables: ['incidents', 'patterns', 'alerts'],
            requiredIndexes: ['idx_timestamp', 'idx_component'],
            requiredFeatures: ['pattern_detection', 'incident_tracking'],
            constraints: [
                'incidents should have valid timestamps',
                'patterns should link to incidents'
            ]
        });
    }
    async validateSchemaConsistency() {
        const issues = [];
        const tables = this.getAllTables();
        const expectedTables = this.getExpectedTables();
        const missingTables = expectedTables.filter(t => !tables.includes(t));
        const unexpectedTables = tables.filter(t => !expectedTables.includes(t) && !t.startsWith('sqlite_'));
        missingTables.forEach(table => {
            issues.push({
                type: 'schema',
                severity: 'critical',
                code: 'MISSING_TABLE',
                message: `Required table ${table} is missing`,
                suggestion: `Create table ${table} or run missing migrations`
            });
        });
        const structuralIssues = await this.checkTableStructures(tables);
        return {
            valid: issues.length === 0,
            issues,
            tableCount: tables.length,
            columnCount: await this.getTotalColumnCount(),
            indexCount: await this.getTotalIndexCount(),
            missingTables,
            unexpectedTables,
            structuralIssues
        };
    }
    async validateDataIntegrity() {
        const issues = [];
        let totalRows = 0;
        const corruptedRows = 0;
        let duplicateRows = 0;
        let orphanedRecords = 0;
        let nullConstraintViolations = 0;
        const tables = this.getAllTables();
        for (const table of tables) {
            const tableRows = this.getTableRowCount(table);
            totalRows += tableRows;
            const duplicates = await this.findDuplicateRows(table);
            duplicateRows += duplicates;
            const nullViolations = await this.findNullConstraintViolations(table);
            nullConstraintViolations += nullViolations;
            const orphaned = await this.findOrphanedRecords(table);
            orphanedRecords += orphaned;
        }
        return {
            valid: issues.length === 0,
            issues,
            totalRows,
            corruptedRows,
            duplicateRows,
            orphanedRecords,
            nullConstraintViolations
        };
    }
    async validateReferentialIntegrity() {
        const issues = [];
        let foreignKeyViolations = 0;
        const brokenReferences = 0;
        const circularReferences = 0;
        const missingParentRecords = 0;
        const foreignKeys = await this.getAllForeignKeys();
        for (const fk of foreignKeys) {
            const violations = await this.checkForeignKeyViolations(fk);
            foreignKeyViolations += violations;
            if (violations > 0) {
                issues.push({
                    type: 'reference',
                    severity: 'high',
                    code: 'FOREIGN_KEY_VIOLATION',
                    message: `Foreign key constraint violated in ${fk.table}.${fk.column}`,
                    suggestion: 'Fix referential integrity by updating or removing invalid references'
                });
            }
        }
        return {
            valid: issues.length === 0,
            issues,
            foreignKeyViolations,
            brokenReferences,
            circularReferences,
            missingParentRecords
        };
    }
    async validateIndexIntegrity() {
        const issues = [];
        const indexes = await this.getAllIndexes();
        let corruptedIndexes = 0;
        const unusedIndexes = 0;
        const missingRecommendedIndexes = [];
        const duplicateIndexes = [];
        for (const index of indexes) {
            try {
                await this.testIndexUsage(index);
            }
            catch (error) {
                corruptedIndexes++;
                issues.push({
                    type: 'schema',
                    severity: 'medium',
                    code: 'CORRUPTED_INDEX',
                    message: `Index ${index.name} appears to be corrupted`,
                    suggestion: 'Rebuild the index'
                });
            }
        }
        return {
            valid: issues.length === 0,
            issues,
            totalIndexes: indexes.length,
            corruptedIndexes,
            unusedIndexes,
            missingRecommendedIndexes,
            duplicateIndexes
        };
    }
    async validateConstraints() {
        const issues = [];
        const constraintViolations = 0;
        const checkConstraintFailures = 0;
        let uniqueConstraintViolations = 0;
        const tables = this.getAllTables();
        for (const table of tables) {
            const uniqueViolations = await this.checkUniqueConstraints(table);
            uniqueConstraintViolations += uniqueViolations;
            if (uniqueViolations > 0) {
                issues.push({
                    type: 'constraint',
                    severity: 'high',
                    code: 'UNIQUE_CONSTRAINT_VIOLATION',
                    message: `Unique constraint violations found in table ${table}`,
                    suggestion: 'Remove duplicate records to fix unique constraint violations'
                });
            }
        }
        return {
            valid: issues.length === 0,
            issues,
            constraintViolations,
            checkConstraintFailures,
            uniqueConstraintViolations
        };
    }
    async validatePerformance() {
        const issues = [];
        const slowQueries = [];
        const recommendedOptimizations = [];
        const largeTables = await this.findLargeTables();
        for (const table of largeTables) {
            const missingIndexes = await this.findMissingIndexes(table);
            if (missingIndexes.length > 0) {
                recommendedOptimizations.push(`Add indexes to table ${table}: ${missingIndexes.join(', ')}`);
            }
        }
        const commonQueries = this.getCommonQueries();
        for (const query of commonQueries) {
            const performance = await this.measureQueryPerformance(query);
            if (performance.time > 1000) {
                slowQueries.push(query);
                issues.push({
                    type: 'performance',
                    message: `Slow query detected: ${query.substring(0, 50)}...`,
                    impact: 'medium',
                    suggestion: 'Optimize query or add appropriate indexes'
                });
            }
        }
        return {
            acceptable: issues.filter(i => i.impact === 'high').length === 0,
            issues,
            slowQueries,
            recommendedOptimizations,
            resourceUtilization: {
                cpu: 0,
                memory: process.memoryUsage().heapUsed,
                disk: 0
            }
        };
    }
    async validateMVPCompliance() {
        const currentMVP = this.detectCurrentMVP();
        const rules = this.mvpValidationRules.get(currentMVP);
        if (!rules) {
            return {
                compliant: false,
                currentMVP,
                expectedFeatures: [],
                missingFeatures: ['MVP validation rules not defined'],
                deprecatedFeatures: [],
                migrationRequired: true
            };
        }
        const missingFeatures = [];
        const tables = this.getAllTables();
        for (const requiredTable of rules.requiredTables) {
            if (!tables.includes(requiredTable)) {
                missingFeatures.push(`Missing table: ${requiredTable}`);
            }
        }
        const indexes = await this.getAllIndexes();
        const indexNames = indexes.map(i => i.name);
        for (const requiredIndex of rules.requiredIndexes) {
            if (!indexNames.includes(requiredIndex)) {
                missingFeatures.push(`Missing index: ${requiredIndex}`);
            }
        }
        return {
            compliant: missingFeatures.length === 0,
            currentMVP,
            expectedFeatures: rules.requiredFeatures,
            missingFeatures,
            deprecatedFeatures: [],
            migrationRequired: missingFeatures.length > 0
        };
    }
    generateValidationSummary(results) {
        let criticalIssues = 0;
        let warnings = 0;
        const recommendationsCount = 0;
        results.forEach(result => {
            if (result.issues) {
                criticalIssues += result.issues.filter((i) => i.severity === 'critical').length;
                warnings += result.issues.filter((i) => i.severity !== 'critical').length;
            }
        });
        let overallHealth;
        if (criticalIssues === 0 && warnings === 0)
            overallHealth = 'excellent';
        else if (criticalIssues === 0 && warnings <= 3)
            overallHealth = 'good';
        else if (criticalIssues <= 1 && warnings <= 10)
            overallHealth = 'fair';
        else if (criticalIssues <= 3)
            overallHealth = 'poor';
        else
            overallHealth = 'critical';
        let migrationSafety;
        if (criticalIssues === 0)
            migrationSafety = 'safe';
        else if (criticalIssues <= 1)
            migrationSafety = 'caution';
        else if (criticalIssues <= 3)
            migrationSafety = 'risky';
        else
            migrationSafety = 'dangerous';
        return {
            overallHealth,
            criticalIssues,
            warnings,
            recommendationsCount,
            migrationSafety,
            estimatedFixTime: criticalIssues * 30 + warnings * 5
        };
    }
    storeValidationResult(type, result, duration) {
        const summary = result.summary || this.generateValidationSummary([result]);
        const validationId = this.db.prepare(`
      INSERT INTO validation_history (
        validation_type, result, duration_ms, overall_health, critical_issues, warnings
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(type, JSON.stringify(result), duration, summary.overallHealth, summary.criticalIssues, summary.warnings).lastInsertRowid;
        if (result.errors) {
            for (const error of result.errors) {
                this.db.prepare(`
          INSERT INTO validation_errors (
            validation_id, error_type, severity, code, message, location, suggestion
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(validationId, error.type, error.severity, error.code, error.message, error.location || null, error.suggestion);
            }
        }
    }
    getCurrentVersion() {
        try {
            const result = this.db.prepare(`
        SELECT COALESCE(MAX(version), 0) as version FROM schema_migrations
      `).get();
            return result.version;
        }
        catch {
            return 0;
        }
    }
    detectCurrentMVP() {
        const version = this.getCurrentVersion();
        return Math.floor(version / 10);
    }
    getAllTables() {
        const result = this.db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all();
        return result.map(r => r.name);
    }
    getTableRowCount(tableName) {
        try {
            const result = this.db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
            return result.count;
        }
        catch {
            return 0;
        }
    }
    getExpectedTables() { return ['kb_entries', 'kb_tags']; }
    async getTotalColumnCount() { return 0; }
    async getTotalIndexCount() { return 0; }
    async checkTableStructures(tables) { return []; }
    async findDuplicateRows(table) { return 0; }
    async findNullConstraintViolations(table) { return 0; }
    async findOrphanedRecords(table) { return 0; }
    async getAllForeignKeys() { return []; }
    async checkForeignKeyViolations(fk) { return 0; }
    async getAllIndexes() { return []; }
    async testIndexUsage(index) { }
    async checkUniqueConstraints(table) { return 0; }
    async findLargeTables() { return []; }
    async findMissingIndexes(table) { return []; }
    getCommonQueries() { return []; }
    async measureQueryPerformance(query) { return { time: 0 }; }
    async validateMigrationSequence(migrations, errors) { }
    async validateMigrationsSQL(migrations, errors) { }
    async checkDangerousOperations(migrations, warnings) { }
    async validateMigrationDependencies(migrations, errors) { }
    async assessDataImpact(migrations, warnings, recommendations) { }
    async assessPerformanceImpact(migrations, warnings, recommendations) { }
    validateSqlSyntax(sql, errors) { }
    checkCommonSqlIssues(sql, warnings) { }
    validateRollbackCompleteness(migration, warnings) { }
    validateBestPractices(migration, warnings, recommendations) { }
    async checkDiskSpace() { return { available: 1000, required: 100 }; }
    async checkActiveTransactions() { return 0; }
    async validateCurrentSchema() { return { errors: [], warnings: [] }; }
    async validateExpectedChanges(migration, errors, warnings) { }
    async validateDataConsistencyAfterMigration(migration, errors, warnings) { }
    async validatePerformanceAfterMigration(migration, warnings, recommendations) { }
    async validateSchemaAtVersion(version) { return { errors: [], warnings: [] }; }
    async validateNoUnexpectedDataLoss(version, warnings) { }
}
exports.ValidationService = ValidationService;
//# sourceMappingURL=ValidationService.js.map