"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresMigrator = void 0;
const pg_1 = require("pg");
const events_1 = require("events");
class PostgresMigrator extends events_1.EventEmitter {
    sourceDb;
    targetPool;
    config;
    migrationPlan;
    isRunning = false;
    constructor(config) {
        super();
        this.config = config;
        this.sourceDb = config.sourceDb;
        this.targetPool = new pg_1.Pool({
            host: config.targetConfig.host,
            port: config.targetConfig.port,
            database: config.targetConfig.database,
            user: config.targetConfig.username,
            password: config.targetConfig.password,
            ssl: config.targetConfig.ssl,
            max: config.targetConfig.maxConnections || 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000
        });
    }
    async analyzeMigration() {
        const schemaMapping = await this.analyzeSchemaMigration();
        const dataMapping = await this.analyzeDataMigration();
        const indexMapping = await this.analyzeIndexMigration();
        const triggerMapping = await this.analyzeTriggerMigration();
        this.migrationPlan = {
            schemaMapping,
            dataMapping,
            indexMapping,
            triggerMapping,
            estimatedDuration: this.estimateMigrationDuration(dataMapping),
            estimatedSize: this.estimateDataSize(dataMapping),
            compatibility: this.analyzeCompatibility(schemaMapping, triggerMapping)
        };
        return this.migrationPlan;
    }
    async executeMigration(plan) {
        if (this.isRunning) {
            throw new Error('Migration already in progress');
        }
        const migrationPlan = plan || this.migrationPlan;
        if (!migrationPlan) {
            throw new Error('No migration plan available. Run analyzeMigration() first.');
        }
        this.isRunning = true;
        const startTime = Date.now();
        const result = {
            success: false,
            migratedTables: [],
            errors: [],
            warnings: [],
            duration: 0
        };
        try {
            this.emit('migrationStarted', { plan: migrationPlan });
            await this.createPostgresSchema(migrationPlan.schemaMapping);
            const dataMigrationResult = await this.migrateData(migrationPlan.dataMapping);
            result.migratedTables = dataMigrationResult.migratedTables;
            result.warnings.push(...dataMigrationResult.warnings);
            if (this.config.options.createIndexesLast) {
                await this.createIndexes(migrationPlan.indexMapping);
            }
            await this.createTriggersAndFunctions(migrationPlan.triggerMapping);
            if (this.config.options.validateData) {
                const validationResult = await this.validateMigratedData(migrationPlan.dataMapping);
                result.warnings.push(...validationResult.warnings);
                if (!validationResult.isValid) {
                    result.errors.push(...validationResult.errors);
                    throw new Error('Data validation failed');
                }
            }
            result.success = true;
            result.duration = Date.now() - startTime;
            this.emit('migrationCompleted', result);
        }
        catch (error) {
            result.errors.push(error.message);
            result.success = false;
            result.duration = Date.now() - startTime;
            this.emit('migrationFailed', { error: error.message, result });
            if (!this.config.options.dryRun) {
                await this.cleanupFailedMigration(result.migratedTables);
            }
            throw error;
        }
        finally {
            this.isRunning = false;
        }
        return result;
    }
    async generatePostgresSchema() {
        const migrationPlan = this.migrationPlan || await this.analyzeMigration();
        let schema = '';
        schema += '-- PostgreSQL Schema Generated from SQLite\n';
        schema += '-- Generated on: ' + new Date().toISOString() + '\n\n';
        schema += 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";\n';
        schema += 'CREATE EXTENSION IF NOT EXISTS "pg_trgm";\n\n';
        for (const tableMapping of migrationPlan.schemaMapping) {
            schema += this.generateTableSchema(tableMapping) + '\n\n';
        }
        for (const indexMapping of migrationPlan.indexMapping) {
            schema += this.generateIndexSchema(indexMapping) + '\n';
        }
        for (const triggerMapping of migrationPlan.triggerMapping) {
            schema += this.generateTriggerSchema(triggerMapping) + '\n\n';
        }
        return schema;
    }
    async testConnection() {
        try {
            const client = await this.targetPool.connect();
            const result = await client.query('SELECT version()');
            client.release();
            this.emit('connectionTest', {
                success: true,
                version: result.rows[0].version
            });
            return true;
        }
        catch (error) {
            this.emit('connectionTest', {
                success: false,
                error: error.message
            });
            return false;
        }
    }
    async analyzeSchemaMigration() {
        const mappings = [];
        const tables = this.sourceDb.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type = 'table' 
      AND name NOT LIKE 'sqlite_%'
    `).all();
        for (const table of tables) {
            const columnMappings = await this.analyzeTableColumns(table.name);
            const constraintMappings = await this.analyzeTableConstraints(table.name);
            mappings.push({
                sqliteTable: table.name,
                postgresTable: this.convertTableName(table.name),
                columns: columnMappings,
                constraints: constraintMappings
            });
        }
        return mappings;
    }
    async analyzeTableColumns(tableName) {
        const columns = this.sourceDb.prepare(`PRAGMA table_info(${tableName})`).all();
        return columns.map(col => ({
            sqliteName: col.name,
            postgresName: col.name,
            sqliteType: col.type,
            postgresType: this.mapSqliteTypeToPostgres(col.type),
            requiresTransformation: this.requiresTypeTransformation(col.type),
            transformFunction: this.getTypeTransformFunction(col.type)
        }));
    }
    async analyzeTableConstraints(tableName) {
        const constraints = [];
        const foreignKeys = this.sourceDb.prepare(`PRAGMA foreign_key_list(${tableName})`).all();
        for (const fk of foreignKeys) {
            constraints.push({
                type: 'foreign_key',
                sqliteDefinition: `FOREIGN KEY (${fk.from}) REFERENCES ${fk.table}(${fk.to})`,
                postgresDefinition: `CONSTRAINT fk_${tableName}_${fk.from} FOREIGN KEY (${fk.from}) REFERENCES ${fk.table}(${fk.to})`
            });
        }
        const indexes = this.sourceDb.prepare(`PRAGMA index_list(${tableName})`).all();
        for (const index of indexes) {
            if (index.unique) {
                const indexInfo = this.sourceDb.prepare(`PRAGMA index_info(${index.name})`).all();
                const columns = indexInfo.map((info) => info.name).join(', ');
                constraints.push({
                    type: 'unique',
                    sqliteDefinition: `UNIQUE (${columns})`,
                    postgresDefinition: `CONSTRAINT uk_${tableName}_${index.name} UNIQUE (${columns})`
                });
            }
        }
        return constraints;
    }
    async analyzeDataMigration() {
        const mappings = [];
        const tables = this.sourceDb.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type = 'table' 
      AND name NOT LIKE 'sqlite_%'
    `).all();
        for (const table of tables) {
            const rowCount = this.sourceDb.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
            mappings.push({
                sourceTable: table.name,
                targetTable: this.convertTableName(table.name),
                rowCount: rowCount.count,
                transformationRequired: this.requiresDataTransformation(table.name),
                dependencies: this.getTableDependencies(table.name)
            });
        }
        return this.sortByDependencies(mappings);
    }
    async analyzeIndexMigration() {
        const mappings = [];
        const indexes = this.sourceDb.prepare(`
      SELECT name, tbl_name, sql 
      FROM sqlite_master 
      WHERE type = 'index' 
      AND name NOT LIKE 'sqlite_%'
    `).all();
        for (const index of indexes) {
            const indexInfo = this.sourceDb.prepare(`PRAGMA index_info(${index.name})`).all();
            const columns = indexInfo.map((info) => info.name);
            mappings.push({
                sqliteIndex: index.name,
                postgresIndex: this.convertIndexName(index.name),
                indexType: this.determineIndexType(index.sql),
                columns,
                isUnique: index.sql?.includes('UNIQUE') || false,
                createAfterData: this.config.options.createIndexesLast || false
            });
        }
        return mappings;
    }
    async analyzeTriggerMigration() {
        const mappings = [];
        const triggers = this.sourceDb.prepare(`
      SELECT name, tbl_name, sql 
      FROM sqlite_master 
      WHERE type = 'trigger'
    `).all();
        for (const trigger of triggers) {
            const postgresFunction = this.convertTriggerToFunction(trigger.sql);
            const postgresTrigger = this.convertTriggerSyntax(trigger.sql);
            mappings.push({
                sqliteTrigger: trigger.name,
                postgresFunction: `${trigger.name}_func`,
                postgresTrigger: this.convertTriggerName(trigger.name),
                requiresRewrite: this.requiresTriggerRewrite(trigger.sql)
            });
        }
        return mappings;
    }
    mapSqliteTypeToPostgres(sqliteType) {
        const typeMap = {
            'INTEGER': 'INTEGER',
            'TEXT': 'TEXT',
            'REAL': 'REAL',
            'BLOB': 'BYTEA',
            'BOOLEAN': 'BOOLEAN',
            'DATETIME': 'TIMESTAMP',
            'DATE': 'DATE',
            'TIME': 'TIME'
        };
        const baseType = sqliteType.split(' ')[0].toUpperCase();
        return typeMap[baseType] || 'TEXT';
    }
    requiresTypeTransformation(sqliteType) {
        const transformTypes = ['DATETIME', 'BOOLEAN', 'BLOB'];
        return transformTypes.some(type => sqliteType.toUpperCase().includes(type));
    }
    getTypeTransformFunction(sqliteType) {
        const baseType = sqliteType.split(' ')[0].toUpperCase();
        switch (baseType) {
            case 'DATETIME':
                return (value) => value ? new Date(value).toISOString() : null;
            case 'BOOLEAN':
                return (value) => value === 1 || value === '1' || value === true;
            case 'BLOB':
                return (value) => value ? Buffer.from(value, 'hex') : null;
            default:
                return undefined;
        }
    }
    generateTableSchema(mapping) {
        let schema = `-- Table: ${mapping.postgresTable}\n`;
        schema += `CREATE TABLE ${mapping.postgresTable} (\n`;
        const columnDefs = mapping.columns.map(col => {
            let def = `  ${col.postgresName} ${col.postgresType}`;
            const originalColumn = this.getOriginalColumnInfo(mapping.sqliteTable, col.sqliteName);
            if (originalColumn?.notnull) {
                def += ' NOT NULL';
            }
            if (originalColumn?.pk) {
                def += ' PRIMARY KEY';
            }
            if (originalColumn?.dflt_value) {
                def += ` DEFAULT ${originalColumn.dflt_value}`;
            }
            return def;
        });
        schema += columnDefs.join(',\n');
        for (const constraint of mapping.constraints) {
            schema += `,\n  ${constraint.postgresDefinition}`;
        }
        schema += '\n);';
        schema += `\n\nCOMMENT ON TABLE ${mapping.postgresTable} IS 'Migrated from SQLite table ${mapping.sqliteTable}';`;
        return schema;
    }
    generateIndexSchema(mapping) {
        const unique = mapping.isUnique ? 'UNIQUE ' : '';
        const columns = mapping.columns.join(', ');
        return `CREATE ${unique}INDEX ${mapping.postgresIndex} ON ${this.getTableForIndex(mapping.sqliteIndex)} (${columns});`;
    }
    generateTriggerSchema(mapping) {
        return `-- TODO: Convert trigger ${mapping.sqliteTrigger} to PostgreSQL`;
    }
    async migrateData(dataMappings) {
        const migratedTables = [];
        const warnings = [];
        for (const mapping of dataMappings) {
            this.emit('tableStarted', { table: mapping.sourceTable, rows: mapping.rowCount });
            try {
                if (this.config.options.dryRun) {
                    this.emit('dryRunTable', { table: mapping.sourceTable });
                }
                else {
                    await this.migrateTableData(mapping);
                }
                migratedTables.push(mapping.targetTable);
                this.emit('tableCompleted', { table: mapping.sourceTable });
            }
            catch (error) {
                warnings.push(`Failed to migrate table ${mapping.sourceTable}: ${error.message}`);
                this.emit('tableError', { table: mapping.sourceTable, error: error.message });
                if (!this.config.options.continueOnError) {
                    throw error;
                }
            }
        }
        return { migratedTables, warnings };
    }
    async migrateTableData(mapping) {
        const batchSize = this.config.options.batchSize || 1000;
        const totalRows = mapping.rowCount;
        let processedRows = 0;
        const schemaMapping = this.migrationPlan?.schemaMapping.find(sm => sm.sqliteTable === mapping.sourceTable);
        if (!schemaMapping) {
            throw new Error(`Schema mapping not found for table ${mapping.sourceTable}`);
        }
        while (processedRows < totalRows) {
            const rows = this.sourceDb.prepare(`
        SELECT * FROM ${mapping.sourceTable} 
        LIMIT ? OFFSET ?
      `).all(batchSize, processedRows);
            if (rows.length === 0)
                break;
            await this.insertBatchToPostgres(mapping.targetTable, rows, schemaMapping.columns);
            processedRows += rows.length;
            this.emit('batchCompleted', {
                table: mapping.sourceTable,
                processed: processedRows,
                total: totalRows,
                percentage: Math.round((processedRows / totalRows) * 100)
            });
        }
    }
    async insertBatchToPostgres(tableName, rows, columnMappings) {
        if (rows.length === 0)
            return;
        const client = await this.targetPool.connect();
        try {
            if (this.config.options.useTransactions) {
                await client.query('BEGIN');
            }
            const columnNames = columnMappings.map(cm => cm.postgresName).join(', ');
            const placeholders = columnMappings.map((_, i) => `$${i + 1}`).join(', ');
            const insertQuery = `
        INSERT INTO ${tableName} (${columnNames}) 
        VALUES (${placeholders})
      `;
            for (const row of rows) {
                const values = columnMappings.map(cm => {
                    let value = row[cm.sqliteName];
                    if (cm.transformFunction && value !== null && value !== undefined) {
                        value = cm.transformFunction(value);
                    }
                    return value;
                });
                await client.query(insertQuery, values);
            }
            if (this.config.options.useTransactions) {
                await client.query('COMMIT');
            }
        }
        catch (error) {
            if (this.config.options.useTransactions) {
                await client.query('ROLLBACK');
            }
            throw error;
        }
        finally {
            client.release();
        }
    }
    convertTableName(sqliteName) {
        return sqliteName.toLowerCase();
    }
    convertIndexName(sqliteName) {
        return sqliteName.toLowerCase() + '_pg';
    }
    convertTriggerName(sqliteName) {
        return sqliteName.toLowerCase() + '_pg';
    }
    estimateMigrationDuration(dataMappings) {
        const totalRows = dataMappings.reduce((sum, dm) => sum + dm.rowCount, 0);
        return Math.ceil(totalRows / 10000);
    }
    estimateDataSize(dataMappings) {
        const totalRows = dataMappings.reduce((sum, dm) => sum + dm.rowCount, 0);
        return Math.ceil(totalRows / 1024);
    }
    analyzeCompatibility(schemaMappings, triggerMappings) {
        const fullyCompatible = [];
        const requiresTransformation = [];
        const unsupported = [];
        for (const mapping of schemaMappings) {
            const hasTransformations = mapping.columns.some(cm => cm.requiresTransformation);
            if (hasTransformations) {
                requiresTransformation.push(mapping.sqliteTable);
            }
            else {
                fullyCompatible.push(mapping.sqliteTable);
            }
        }
        for (const mapping of triggerMappings) {
            if (mapping.requiresRewrite) {
                if (!requiresTransformation.includes(mapping.sqliteTrigger)) {
                    requiresTransformation.push(mapping.sqliteTrigger);
                }
            }
        }
        return { fullyCompatible, requiresTransformation, unsupported };
    }
    getOriginalColumnInfo(tableName, columnName) {
        const columns = this.sourceDb.prepare(`PRAGMA table_info(${tableName})`).all();
        return columns.find((col) => col.name === columnName);
    }
    getTableForIndex(indexName) {
        const indexInfo = this.sourceDb.prepare(`
      SELECT tbl_name FROM sqlite_master WHERE name = ? AND type = 'index'
    `).get(indexName);
        return this.convertTableName(indexInfo?.tbl_name || 'unknown');
    }
    requiresDataTransformation(tableName) {
        return false;
    }
    getTableDependencies(tableName) {
        return [];
    }
    sortByDependencies(mappings) {
        return mappings;
    }
    determineIndexType(sql) {
        return 'btree';
    }
    convertTriggerToFunction(sql) {
        return '-- Function conversion placeholder';
    }
    convertTriggerSyntax(sql) {
        return '-- Trigger conversion placeholder';
    }
    requiresTriggerRewrite(sql) {
        return true;
    }
    async createPostgresSchema(schemaMappings) {
    }
    async createIndexes(indexMappings) {
    }
    async createTriggersAndFunctions(triggerMappings) {
    }
    async validateMigratedData(dataMappings) {
        return { isValid: true, errors: [], warnings: [] };
    }
    async cleanupFailedMigration(migratedTables) {
    }
    async close() {
        await this.targetPool.end();
    }
}
exports.PostgresMigrator = PostgresMigrator;
//# sourceMappingURL=PostgresMigrator.js.map