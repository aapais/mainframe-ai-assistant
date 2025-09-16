"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MigrationValidator = void 0;
class MigrationValidator {
    db;
    constructor(db) {
        this.db = db;
    }
    async validateMigrationPlan(plan) {
        const result = {
            isValid: true,
            errors: [],
            warnings: [],
            suggestions: []
        };
        for (const migration of plan.migrations) {
            const migrationValidation = await this.validateMigration(migration);
            result.errors.push(...migrationValidation.errors);
            result.warnings.push(...migrationValidation.warnings);
            result.suggestions.push(...migrationValidation.suggestions);
        }
        const sequenceValidation = this.validateMigrationSequence(plan.migrations);
        result.errors.push(...sequenceValidation.errors);
        result.warnings.push(...sequenceValidation.warnings);
        const conflictValidation = this.validateMigrationConflicts(plan.migrations);
        result.errors.push(...conflictValidation.errors);
        result.warnings.push(...conflictValidation.warnings);
        const resourceValidation = await this.validateResourceRequirements(plan);
        result.warnings.push(...resourceValidation.warnings);
        result.suggestions.push(...resourceValidation.suggestions);
        result.isValid = result.errors.length === 0;
        return result;
    }
    async validatePreMigration(migration) {
        const result = {
            isValid: true,
            errors: [],
            warnings: [],
            suggestions: []
        };
        const syntaxValidation = await this.validateSqlSyntax(migration.up);
        result.errors.push(...syntaxValidation.errors);
        result.warnings.push(...syntaxValidation.warnings);
        const dependencyValidation = this.validateDependencies(migration);
        result.errors.push(...dependencyValidation.errors);
        result.warnings.push(...dependencyValidation.warnings);
        if (migration.down) {
            const rollbackValidation = await this.validateSqlSyntax(migration.down);
            if (rollbackValidation.errors.length > 0) {
                result.warnings.push(`Rollback SQL has syntax errors: ${rollbackValidation.errors.join(', ')}`);
            }
        }
        else {
            result.warnings.push(`Migration ${migration.version} has no rollback SQL`);
        }
        const destructiveValidation = this.validateDestructiveOperations(migration.up);
        result.warnings.push(...destructiveValidation.warnings);
        result.suggestions.push(...destructiveValidation.suggestions);
        result.isValid = result.errors.length === 0;
        return result;
    }
    async validatePostMigration(migration) {
        const result = {
            isValid: true,
            errors: [],
            warnings: [],
            suggestions: []
        };
        try {
            const schemaValidation = await this.validateSchemaChanges(migration);
            result.errors.push(...schemaValidation.errors);
            result.warnings.push(...schemaValidation.warnings);
            const integrityValidation = await this.validateDataIntegrity(migration);
            result.errors.push(...integrityValidation.errors);
            result.warnings.push(...integrityValidation.warnings);
            const constraintValidation = await this.validateConstraints();
            result.errors.push(...constraintValidation.errors);
            result.warnings.push(...constraintValidation.warnings);
            const indexValidation = await this.validateIndexes(migration);
            result.warnings.push(...indexValidation.warnings);
        }
        catch (error) {
            result.errors.push(`Post-migration validation failed: ${error.message}`);
        }
        result.isValid = result.errors.length === 0;
        return result;
    }
    async validateSqlSyntax(sql) {
        const result = {
            isValid: true,
            errors: [],
            warnings: [],
            suggestions: []
        };
        try {
            const statements = this.splitSqlStatements(sql);
            for (const statement of statements) {
                if (statement.trim().length === 0)
                    continue;
                try {
                    if (statement.trim().toUpperCase().startsWith('SELECT')) {
                        this.db.prepare(`EXPLAIN QUERY PLAN ${statement}`).all();
                    }
                    else {
                        this.db.prepare(statement);
                    }
                }
                catch (error) {
                    result.errors.push(`SQL syntax error: ${error.message} in statement: ${statement.substring(0, 100)}...`);
                }
            }
            const commonIssues = this.checkCommonSqlIssues(sql);
            result.warnings.push(...commonIssues.warnings);
            result.suggestions.push(...commonIssues.suggestions);
        }
        catch (error) {
            result.errors.push(`Failed to validate SQL syntax: ${error.message}`);
        }
        result.isValid = result.errors.length === 0;
        return result;
    }
    async getSchemaSnapshot() {
        const tables = [];
        const tableList = this.db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all();
        for (const tableRow of tableList) {
            const tableName = tableRow.name;
            const columns = this.db.prepare(`PRAGMA table_info(${tableName})`).all();
            const indexes = this.db.prepare(`PRAGMA index_list(${tableName})`).all();
            const indexDetails = [];
            for (const index of indexes) {
                const indexInfo = this.db.prepare(`PRAGMA index_info(${index.name})`).all();
                indexDetails.push({
                    name: index.name,
                    columns: indexInfo.map((info) => info.name),
                    unique: index.unique === 1
                });
            }
            const foreignKeys = this.db.prepare(`PRAGMA foreign_key_list(${tableName})`).all();
            const constraints = foreignKeys.map((fk) => `FOREIGN KEY (${fk.from}) REFERENCES ${fk.table}(${fk.to})`);
            tables.push({
                name: tableName,
                exists: true,
                columns: columns.map(col => ({
                    name: col.name,
                    type: col.type,
                    nullable: col.notnull === 0,
                    defaultValue: col.dflt_value
                })),
                indexes: indexDetails,
                constraints
            });
        }
        return { tables };
    }
    compareSchemas(before, after) {
        const beforeTableNames = new Set(before.tables.map(t => t.name));
        const afterTableNames = new Set(after.tables.map(t => t.name));
        const tablesAdded = Array.from(afterTableNames).filter(name => !beforeTableNames.has(name));
        const tablesDropped = Array.from(beforeTableNames).filter(name => !afterTableNames.has(name));
        const tablesModified = [];
        const commonTables = Array.from(beforeTableNames).filter(name => afterTableNames.has(name));
        for (const tableName of commonTables) {
            const beforeTable = before.tables.find(t => t.name === tableName);
            const afterTable = after.tables.find(t => t.name === tableName);
            const beforeColumns = new Set(beforeTable.columns.map(c => c.name));
            const afterColumns = new Set(afterTable.columns.map(c => c.name));
            const columnsAdded = Array.from(afterColumns).filter(name => !beforeColumns.has(name));
            const columnsDropped = Array.from(beforeColumns).filter(name => !afterColumns.has(name));
            const columnsModified = [];
            const commonColumns = Array.from(beforeColumns).filter(name => afterColumns.has(name));
            for (const columnName of commonColumns) {
                const beforeColumn = beforeTable.columns.find(c => c.name === columnName);
                const afterColumn = afterTable.columns.find(c => c.name === columnName);
                if (beforeColumn.type !== afterColumn.type ||
                    beforeColumn.nullable !== afterColumn.nullable) {
                    columnsModified.push(columnName);
                }
            }
            const beforeIndexes = new Set(beforeTable.indexes.map(i => i.name));
            const afterIndexes = new Set(afterTable.indexes.map(i => i.name));
            const indexesAdded = Array.from(afterIndexes).filter(name => !beforeIndexes.has(name));
            const indexesDropped = Array.from(beforeIndexes).filter(name => !afterIndexes.has(name));
            if (columnsAdded.length > 0 || columnsDropped.length > 0 || columnsModified.length > 0 ||
                indexesAdded.length > 0 || indexesDropped.length > 0) {
                tablesModified.push({
                    name: tableName,
                    columnsAdded,
                    columnsDropped,
                    columnsModified,
                    indexesAdded,
                    indexesDropped
                });
            }
        }
        return {
            tablesAdded,
            tablesDropped,
            tablesModified
        };
    }
    validateMigrationSequence(migrations) {
        const result = {
            isValid: true,
            errors: [],
            warnings: [],
            suggestions: []
        };
        const versions = migrations.map(m => m.version).sort((a, b) => a - b);
        for (let i = 1; i < versions.length; i++) {
            if (versions[i] - versions[i - 1] > 1) {
                result.warnings.push(`Version gap detected: ${versions[i - 1]} -> ${versions[i]}`);
            }
        }
        const duplicates = versions.filter((version, index) => versions.indexOf(version) !== index);
        if (duplicates.length > 0) {
            result.errors.push(`Duplicate migration versions found: ${duplicates.join(', ')}`);
        }
        result.isValid = result.errors.length === 0;
        return result;
    }
    validateMigrationConflicts(migrations) {
        const result = {
            isValid: true,
            errors: [],
            warnings: [],
            suggestions: []
        };
        const tableOperations = new Map();
        for (const migration of migrations) {
            const operations = this.extractTableOperations(migration.up);
            for (const [table, ops] of Object.entries(operations)) {
                if (!tableOperations.has(table)) {
                    tableOperations.set(table, { created: [], dropped: [], modified: [] });
                }
                const tableOps = tableOperations.get(table);
                if (ops.includes('CREATE')) {
                    tableOps.created.push(migration.version);
                }
                if (ops.includes('DROP')) {
                    tableOps.dropped.push(migration.version);
                }
                if (ops.includes('ALTER')) {
                    tableOps.modified.push(migration.version);
                }
            }
        }
        for (const [table, ops] of tableOperations.entries()) {
            if (ops.created.length > 0 && ops.dropped.length > 0) {
                result.warnings.push(`Table ${table} is both created and dropped in migration sequence`);
            }
            if (ops.created.length > 1) {
                result.errors.push(`Table ${table} is created multiple times in migrations: ${ops.created.join(', ')}`);
            }
            const earliestCreate = Math.min(...(ops.created.length > 0 ? ops.created : [Infinity]));
            const earlyModifications = ops.modified.filter(v => v < earliestCreate);
            if (earlyModifications.length > 0) {
                result.warnings.push(`Table ${table} is modified before creation in migrations: ${earlyModifications.join(', ')}`);
            }
        }
        result.isValid = result.errors.length === 0;
        return result;
    }
    async validateResourceRequirements(plan) {
        const result = {
            isValid: true,
            errors: [],
            warnings: [],
            suggestions: []
        };
        try {
            const dbSize = this.getDatabaseSize();
            const estimatedGrowth = this.estimateDatabaseGrowth(plan.migrations);
            if (estimatedGrowth > dbSize * 0.5) {
                result.warnings.push(`Migration may significantly increase database size by ~${Math.round(estimatedGrowth / 1024 / 1024)}MB`);
            }
            const memoryIntensiveOps = plan.migrations.filter(m => m.up.includes('CREATE INDEX') ||
                m.up.includes('ALTER TABLE') ||
                m.up.includes('INSERT INTO') && m.up.includes('SELECT'));
            if (memoryIntensiveOps.length > 0) {
                result.suggestions.push(`${memoryIntensiveOps.length} migrations contain memory-intensive operations - consider running during low-usage periods`);
            }
            const longRunningOps = plan.migrations.filter(m => m.up.includes('CREATE INDEX ON') && m.up.includes('('));
            if (longRunningOps.length > 0) {
                result.suggestions.push(`${longRunningOps.length} migrations may take extended time - ensure adequate timeout settings`);
            }
        }
        catch (error) {
            result.warnings.push(`Could not validate resource requirements: ${error.message}`);
        }
        return result;
    }
    validateDependencies(migration) {
        const result = {
            isValid: true,
            errors: [],
            warnings: [],
            suggestions: []
        };
        const referencedTables = this.extractReferencedTables(migration.up);
        const existingTables = this.getExistingTables();
        for (const table of referencedTables) {
            if (!existingTables.includes(table)) {
                if (!migration.up.includes(`CREATE TABLE ${table}`) &&
                    !migration.up.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) {
                    result.errors.push(`Migration references non-existent table: ${table}`);
                }
            }
        }
        return result;
    }
    validateDestructiveOperations(sql) {
        const result = {
            isValid: true,
            errors: [],
            warnings: [],
            suggestions: []
        };
        const destructivePatterns = [
            { pattern: /DROP\s+TABLE/i, message: 'Contains DROP TABLE operation' },
            { pattern: /DROP\s+COLUMN/i, message: 'Contains DROP COLUMN operation' },
            { pattern: /DELETE\s+FROM/i, message: 'Contains DELETE operation' },
            { pattern: /UPDATE.*SET.*WHERE/i, message: 'Contains UPDATE operation' },
            { pattern: /TRUNCATE/i, message: 'Contains TRUNCATE operation' }
        ];
        for (const { pattern, message } of destructivePatterns) {
            if (pattern.test(sql)) {
                result.warnings.push(message);
                result.suggestions.push('Ensure adequate backup before proceeding');
            }
        }
        return result;
    }
    async validateSchemaChanges(migration) {
        const result = {
            isValid: true,
            errors: [],
            warnings: [],
            suggestions: []
        };
        return result;
    }
    async validateDataIntegrity(migration) {
        const result = {
            isValid: true,
            errors: [],
            warnings: [],
            suggestions: []
        };
        try {
            const constraintCheck = this.db.prepare('PRAGMA foreign_key_check').all();
            if (constraintCheck.length > 0) {
                result.errors.push(`Foreign key constraint violations found: ${constraintCheck.length} rows`);
            }
        }
        catch (error) {
            result.warnings.push(`Could not validate data integrity: ${error.message}`);
        }
        return result;
    }
    async validateConstraints() {
        const result = {
            isValid: true,
            errors: [],
            warnings: [],
            suggestions: []
        };
        try {
            this.db.exec('PRAGMA foreign_keys = ON');
            const violations = this.db.prepare('PRAGMA foreign_key_check').all();
            if (violations.length > 0) {
                result.errors.push(`${violations.length} foreign key constraint violations`);
            }
        }
        catch (error) {
            result.warnings.push(`Could not validate constraints: ${error.message}`);
        }
        return result;
    }
    async validateIndexes(migration) {
        const result = {
            isValid: true,
            errors: [],
            warnings: [],
            suggestions: []
        };
        if (migration.up.includes('CREATE INDEX')) {
            const indexNames = this.extractIndexNames(migration.up);
            for (const indexName of indexNames) {
                const exists = this.db.prepare(`
          SELECT name FROM sqlite_master 
          WHERE type = 'index' AND name = ?
        `).get(indexName);
                if (!exists) {
                    result.warnings.push(`Expected index ${indexName} was not created`);
                }
            }
        }
        return result;
    }
    splitSqlStatements(sql) {
        return sql.split(';').filter(stmt => stmt.trim().length > 0);
    }
    checkCommonSqlIssues(sql) {
        const result = {
            isValid: true,
            errors: [],
            warnings: [],
            suggestions: []
        };
        if (sql.includes('CREATE TABLE') && !sql.includes('IF NOT EXISTS')) {
            result.suggestions.push('Consider using IF NOT EXISTS for CREATE TABLE statements');
        }
        if (sql.includes("'2025-") || sql.includes('"2025-')) {
            result.warnings.push('Migration contains hardcoded dates');
        }
        return result;
    }
    extractTableOperations(sql) {
        const operations = {};
        const createMatches = sql.match(/CREATE\s+TABLE\s+(\w+)/gi);
        const alterMatches = sql.match(/ALTER\s+TABLE\s+(\w+)/gi);
        const dropMatches = sql.match(/DROP\s+TABLE\s+(\w+)/gi);
        if (createMatches) {
            for (const match of createMatches) {
                const table = match.split(/\s+/)[2];
                if (!operations[table])
                    operations[table] = [];
                operations[table].push('CREATE');
            }
        }
        if (alterMatches) {
            for (const match of alterMatches) {
                const table = match.split(/\s+/)[2];
                if (!operations[table])
                    operations[table] = [];
                operations[table].push('ALTER');
            }
        }
        if (dropMatches) {
            for (const match of dropMatches) {
                const table = match.split(/\s+/)[2];
                if (!operations[table])
                    operations[table] = [];
                operations[table].push('DROP');
            }
        }
        return operations;
    }
    extractReferencedTables(sql) {
        const tables = new Set();
        const patterns = [
            /FROM\s+(\w+)/gi,
            /JOIN\s+(\w+)/gi,
            /INTO\s+(\w+)/gi,
            /UPDATE\s+(\w+)/gi,
            /REFERENCES\s+(\w+)/gi
        ];
        for (const pattern of patterns) {
            const matches = sql.match(pattern);
            if (matches) {
                for (const match of matches) {
                    const table = match.split(/\s+/)[1];
                    if (table && !table.match(/^\d+$/)) {
                        tables.add(table);
                    }
                }
            }
        }
        return Array.from(tables);
    }
    extractIndexNames(sql) {
        const indexes = [];
        const matches = sql.match(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(\w+)/gi);
        if (matches) {
            for (const match of matches) {
                const parts = match.split(/\s+/);
                const indexName = parts[parts.length - 1];
                indexes.push(indexName);
            }
        }
        return indexes;
    }
    getExistingTables() {
        const tables = this.db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    `).all();
        return tables.map(t => t.name);
    }
    getDatabaseSize() {
        try {
            const fs = require('fs');
            const stats = fs.statSync(this.db.name);
            return stats.size;
        }
        catch {
            return 0;
        }
    }
    estimateDatabaseGrowth(migrations) {
        let estimatedGrowth = 0;
        for (const migration of migrations) {
            const createTableCount = (migration.up.match(/CREATE TABLE/gi) || []).length;
            estimatedGrowth += createTableCount * 1024 * 1024;
            const createIndexCount = (migration.up.match(/CREATE INDEX/gi) || []).length;
            estimatedGrowth += createIndexCount * 512 * 1024;
            const insertCount = (migration.up.match(/INSERT INTO/gi) || []).length;
            estimatedGrowth += insertCount * 1024;
        }
        return estimatedGrowth;
    }
}
exports.MigrationValidator = MigrationValidator;
//# sourceMappingURL=MigrationValidator.js.map