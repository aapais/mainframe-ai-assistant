import { Pool, Client, PoolClient } from 'pg';
import Database from 'better-sqlite3';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';

export interface PostgresMigrationConfig {
  sourceDb: Database.Database;
  targetConfig: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl?: boolean;
    maxConnections?: number;
  };
  options: {
    batchSize?: number;
    maxConcurrency?: number;
    validateData?: boolean;
    createIndexesLast?: boolean;
    useTransactions?: boolean;
    continueOnError?: boolean;
    dryRun?: boolean;
  };
}

export interface PostgresMigrationPlan {
  schemaMapping: SchemaMapping[];
  dataMapping: DataMapping[];
  indexMapping: IndexMapping[];
  triggerMapping: TriggerMapping[];
  estimatedDuration: number;
  estimatedSize: number;
  compatibility: {
    fullyCompatible: string[];
    requiresTransformation: string[];
    unsupported: string[];
  };
}

interface SchemaMapping {
  sqliteTable: string;
  postgresTable: string;
  columns: ColumnMapping[];
  constraints: ConstraintMapping[];
}

interface ColumnMapping {
  sqliteName: string;
  postgresName: string;
  sqliteType: string;
  postgresType: string;
  requiresTransformation: boolean;
  transformFunction?: (value: any) => any;
}

interface DataMapping {
  sourceTable: string;
  targetTable: string;
  rowCount: number;
  transformationRequired: boolean;
  dependencies: string[];
}

interface IndexMapping {
  sqliteIndex: string;
  postgresIndex: string;
  indexType: string;
  columns: string[];
  isUnique: boolean;
  createAfterData: boolean;
}

interface TriggerMapping {
  sqliteTrigger: string;
  postgresFunction: string;
  postgresTrigger: string;
  requiresRewrite: boolean;
}

export class PostgresMigrator extends EventEmitter {
  private sourceDb: Database.Database;
  private targetPool: Pool;
  private config: PostgresMigrationConfig;
  private migrationPlan?: PostgresMigrationPlan;
  private isRunning: boolean = false;

  constructor(config: PostgresMigrationConfig) {
    super();
    this.config = config;
    this.sourceDb = config.sourceDb;

    this.targetPool = new Pool({
      host: config.targetConfig.host,
      port: config.targetConfig.port,
      database: config.targetConfig.database,
      user: config.targetConfig.username,
      password: config.targetConfig.password,
      ssl: config.targetConfig.ssl,
      max: config.targetConfig.maxConnections || 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }

  /**
   * Analyze SQLite database and create PostgreSQL migration plan
   */
  async analyzeMigration(): Promise<PostgresMigrationPlan> {
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
      compatibility: this.analyzeCompatibility(schemaMapping, triggerMapping),
    };

    return this.migrationPlan;
  }

  /**
   * Execute the full migration to PostgreSQL
   */
  async executeMigration(plan?: PostgresMigrationPlan): Promise<{
    success: boolean;
    migratedTables: string[];
    errors: string[];
    warnings: string[];
    duration: number;
  }> {
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
      migratedTables: [] as string[],
      errors: [] as string[],
      warnings: [] as string[],
      duration: 0,
    };

    try {
      this.emit('migrationStarted', { plan: migrationPlan });

      // Step 1: Create target database schema
      await this.createPostgresSchema(migrationPlan.schemaMapping);

      // Step 2: Migrate data
      const dataMigrationResult = await this.migrateData(migrationPlan.dataMapping);
      result.migratedTables = dataMigrationResult.migratedTables;
      result.warnings.push(...dataMigrationResult.warnings);

      // Step 3: Create indexes (if not created with schema)
      if (this.config.options.createIndexesLast) {
        await this.createIndexes(migrationPlan.indexMapping);
      }

      // Step 4: Create triggers and functions
      await this.createTriggersAndFunctions(migrationPlan.triggerMapping);

      // Step 5: Validate migrated data
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
    } catch (error) {
      result.errors.push(error.message);
      result.success = false;
      result.duration = Date.now() - startTime;

      this.emit('migrationFailed', { error: error.message, result });

      // Attempt cleanup on failure
      if (!this.config.options.dryRun) {
        await this.cleanupFailedMigration(result.migratedTables);
      }

      throw error;
    } finally {
      this.isRunning = false;
    }

    return result;
  }

  /**
   * Generate PostgreSQL schema from SQLite schema
   */
  async generatePostgresSchema(): Promise<string> {
    const migrationPlan = this.migrationPlan || (await this.analyzeMigration());
    let schema = '';

    schema += '-- PostgreSQL Schema Generated from SQLite\n';
    schema += '-- Generated on: ' + new Date().toISOString() + '\n\n';

    // Add extensions
    schema += 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";\n';
    schema += 'CREATE EXTENSION IF NOT EXISTS "pg_trgm";\n\n';

    // Generate tables
    for (const tableMapping of migrationPlan.schemaMapping) {
      schema += this.generateTableSchema(tableMapping) + '\n\n';
    }

    // Generate indexes
    for (const indexMapping of migrationPlan.indexMapping) {
      schema += this.generateIndexSchema(indexMapping) + '\n';
    }

    // Generate triggers and functions
    for (const triggerMapping of migrationPlan.triggerMapping) {
      schema += this.generateTriggerSchema(triggerMapping) + '\n\n';
    }

    return schema;
  }

  /**
   * Test connection to PostgreSQL database
   */
  async testConnection(): Promise<boolean> {
    try {
      const client = await this.targetPool.connect();
      const result = await client.query('SELECT version()');
      client.release();

      this.emit('connectionTest', {
        success: true,
        version: result.rows[0].version,
      });

      return true;
    } catch (error) {
      this.emit('connectionTest', {
        success: false,
        error: error.message,
      });
      return false;
    }
  }

  // Private methods for migration analysis

  private async analyzeSchemaMigration(): Promise<SchemaMapping[]> {
    const mappings: SchemaMapping[] = [];

    // Get all tables from SQLite
    const tables = this.sourceDb
      .prepare(
        `
      SELECT name FROM sqlite_master 
      WHERE type = 'table' 
      AND name NOT LIKE 'sqlite_%'
    `
      )
      .all() as Array<{ name: string }>;

    for (const table of tables) {
      const columnMappings = await this.analyzeTableColumns(table.name);
      const constraintMappings = await this.analyzeTableConstraints(table.name);

      mappings.push({
        sqliteTable: table.name,
        postgresTable: this.convertTableName(table.name),
        columns: columnMappings,
        constraints: constraintMappings,
      });
    }

    return mappings;
  }

  private async analyzeTableColumns(tableName: string): Promise<ColumnMapping[]> {
    const columns = this.sourceDb.prepare(`PRAGMA table_info(${tableName})`).all() as any[];

    return columns.map(col => ({
      sqliteName: col.name,
      postgresName: col.name,
      sqliteType: col.type,
      postgresType: this.mapSqliteTypeToPostgres(col.type),
      requiresTransformation: this.requiresTypeTransformation(col.type),
      transformFunction: this.getTypeTransformFunction(col.type),
    }));
  }

  private async analyzeTableConstraints(tableName: string): Promise<ConstraintMapping[]> {
    const constraints: ConstraintMapping[] = [];

    // Get foreign key constraints
    const foreignKeys = this.sourceDb
      .prepare(`PRAGMA foreign_key_list(${tableName})`)
      .all() as any[];

    for (const fk of foreignKeys) {
      constraints.push({
        type: 'foreign_key',
        sqliteDefinition: `FOREIGN KEY (${fk.from}) REFERENCES ${fk.table}(${fk.to})`,
        postgresDefinition: `CONSTRAINT fk_${tableName}_${fk.from} FOREIGN KEY (${fk.from}) REFERENCES ${fk.table}(${fk.to})`,
      });
    }

    // Get unique constraints from indexes
    const indexes = this.sourceDb.prepare(`PRAGMA index_list(${tableName})`).all() as any[];

    for (const index of indexes) {
      if (index.unique) {
        const indexInfo = this.sourceDb.prepare(`PRAGMA index_info(${index.name})`).all() as any[];
        const columns = indexInfo.map((info: any) => info.name).join(', ');

        constraints.push({
          type: 'unique',
          sqliteDefinition: `UNIQUE (${columns})`,
          postgresDefinition: `CONSTRAINT uk_${tableName}_${index.name} UNIQUE (${columns})`,
        });
      }
    }

    return constraints;
  }

  private async analyzeDataMigration(): Promise<DataMapping[]> {
    const mappings: DataMapping[] = [];

    const tables = this.sourceDb
      .prepare(
        `
      SELECT name FROM sqlite_master 
      WHERE type = 'table' 
      AND name NOT LIKE 'sqlite_%'
    `
      )
      .all() as Array<{ name: string }>;

    for (const table of tables) {
      const rowCount = this.sourceDb
        .prepare(`SELECT COUNT(*) as count FROM ${table.name}`)
        .get() as { count: number };

      mappings.push({
        sourceTable: table.name,
        targetTable: this.convertTableName(table.name),
        rowCount: rowCount.count,
        transformationRequired: this.requiresDataTransformation(table.name),
        dependencies: this.getTableDependencies(table.name),
      });
    }

    // Sort by dependencies
    return this.sortByDependencies(mappings);
  }

  private async analyzeIndexMigration(): Promise<IndexMapping[]> {
    const mappings: IndexMapping[] = [];

    const indexes = this.sourceDb
      .prepare(
        `
      SELECT name, tbl_name, sql 
      FROM sqlite_master 
      WHERE type = 'index' 
      AND name NOT LIKE 'sqlite_%'
    `
      )
      .all() as Array<{ name: string; tbl_name: string; sql: string }>;

    for (const index of indexes) {
      const indexInfo = this.sourceDb.prepare(`PRAGMA index_info(${index.name})`).all() as any[];
      const columns = indexInfo.map((info: any) => info.name);

      mappings.push({
        sqliteIndex: index.name,
        postgresIndex: this.convertIndexName(index.name),
        indexType: this.determineIndexType(index.sql),
        columns,
        isUnique: index.sql?.includes('UNIQUE') || false,
        createAfterData: this.config.options.createIndexesLast || false,
      });
    }

    return mappings;
  }

  private async analyzeTriggerMigration(): Promise<TriggerMapping[]> {
    const mappings: TriggerMapping[] = [];

    const triggers = this.sourceDb
      .prepare(
        `
      SELECT name, tbl_name, sql 
      FROM sqlite_master 
      WHERE type = 'trigger'
    `
      )
      .all() as Array<{ name: string; tbl_name: string; sql: string }>;

    for (const trigger of triggers) {
      const postgresFunction = this.convertTriggerToFunction(trigger.sql);
      const postgresTrigger = this.convertTriggerSyntax(trigger.sql);

      mappings.push({
        sqliteTrigger: trigger.name,
        postgresFunction: `${trigger.name}_func`,
        postgresTrigger: this.convertTriggerName(trigger.name),
        requiresRewrite: this.requiresTriggerRewrite(trigger.sql),
      });
    }

    return mappings;
  }

  // Private methods for schema conversion

  private mapSqliteTypeToPostgres(sqliteType: string): string {
    const typeMap: { [key: string]: string } = {
      INTEGER: 'INTEGER',
      TEXT: 'TEXT',
      REAL: 'REAL',
      BLOB: 'BYTEA',
      BOOLEAN: 'BOOLEAN',
      DATETIME: 'TIMESTAMP',
      DATE: 'DATE',
      TIME: 'TIME',
    };

    // Handle type with constraints (e.g., "TEXT NOT NULL")
    const baseType = sqliteType.split(' ')[0].toUpperCase();
    return typeMap[baseType] || 'TEXT';
  }

  private requiresTypeTransformation(sqliteType: string): boolean {
    const transformTypes = ['DATETIME', 'BOOLEAN', 'BLOB'];
    return transformTypes.some(type => sqliteType.toUpperCase().includes(type));
  }

  private getTypeTransformFunction(sqliteType: string): ((value: any) => any) | undefined {
    const baseType = sqliteType.split(' ')[0].toUpperCase();

    switch (baseType) {
      case 'DATETIME':
        return value => (value ? new Date(value).toISOString() : null);
      case 'BOOLEAN':
        return value => value === 1 || value === '1' || value === true;
      case 'BLOB':
        return value => (value ? Buffer.from(value, 'hex') : null);
      default:
        return undefined;
    }
  }

  private generateTableSchema(mapping: SchemaMapping): string {
    let schema = `-- Table: ${mapping.postgresTable}\n`;
    schema += `CREATE TABLE ${mapping.postgresTable} (\n`;

    const columnDefs = mapping.columns.map(col => {
      let def = `  ${col.postgresName} ${col.postgresType}`;

      // Add constraints based on original SQLite schema
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

    // Add table constraints
    for (const constraint of mapping.constraints) {
      schema += `,\n  ${constraint.postgresDefinition}`;
    }

    schema += '\n);';

    // Add comments
    schema += `\n\nCOMMENT ON TABLE ${mapping.postgresTable} IS 'Migrated from SQLite table ${mapping.sqliteTable}';`;

    return schema;
  }

  private generateIndexSchema(mapping: IndexMapping): string {
    const unique = mapping.isUnique ? 'UNIQUE ' : '';
    const columns = mapping.columns.join(', ');

    return `CREATE ${unique}INDEX ${mapping.postgresIndex} ON ${this.getTableForIndex(mapping.sqliteIndex)} (${columns});`;
  }

  private generateTriggerSchema(mapping: TriggerMapping): string {
    // This is a simplified version - actual implementation would need
    // sophisticated SQLite to PostgreSQL trigger conversion
    return `-- TODO: Convert trigger ${mapping.sqliteTrigger} to PostgreSQL`;
  }

  // Private methods for data migration

  private async migrateData(dataMappings: DataMapping[]): Promise<{
    migratedTables: string[];
    warnings: string[];
  }> {
    const migratedTables: string[] = [];
    const warnings: string[] = [];

    for (const mapping of dataMappings) {
      this.emit('tableStarted', { table: mapping.sourceTable, rows: mapping.rowCount });

      try {
        if (this.config.options.dryRun) {
          this.emit('dryRunTable', { table: mapping.sourceTable });
        } else {
          await this.migrateTableData(mapping);
        }

        migratedTables.push(mapping.targetTable);
        this.emit('tableCompleted', { table: mapping.sourceTable });
      } catch (error) {
        warnings.push(`Failed to migrate table ${mapping.sourceTable}: ${error.message}`);
        this.emit('tableError', { table: mapping.sourceTable, error: error.message });

        if (!this.config.options.continueOnError) {
          throw error;
        }
      }
    }

    return { migratedTables, warnings };
  }

  private async migrateTableData(mapping: DataMapping): Promise<void> {
    const batchSize = this.config.options.batchSize || 1000;
    const totalRows = mapping.rowCount;
    let processedRows = 0;

    // Get column mappings for this table
    const schemaMapping = this.migrationPlan?.schemaMapping.find(
      sm => sm.sqliteTable === mapping.sourceTable
    );

    if (!schemaMapping) {
      throw new Error(`Schema mapping not found for table ${mapping.sourceTable}`);
    }

    while (processedRows < totalRows) {
      const rows = this.sourceDb
        .prepare(
          `
        SELECT * FROM ${mapping.sourceTable} 
        LIMIT ? OFFSET ?
      `
        )
        .all(batchSize, processedRows);

      if (rows.length === 0) break;

      await this.insertBatchToPostgres(mapping.targetTable, rows, schemaMapping.columns);

      processedRows += rows.length;
      this.emit('batchCompleted', {
        table: mapping.sourceTable,
        processed: processedRows,
        total: totalRows,
        percentage: Math.round((processedRows / totalRows) * 100),
      });
    }
  }

  private async insertBatchToPostgres(
    tableName: string,
    rows: any[],
    columnMappings: ColumnMapping[]
  ): Promise<void> {
    if (rows.length === 0) return;

    const client = await this.targetPool.connect();

    try {
      if (this.config.options.useTransactions) {
        await client.query('BEGIN');
      }

      // Prepare column names and placeholders
      const columnNames = columnMappings.map(cm => cm.postgresName).join(', ');
      const placeholders = columnMappings.map((_, i) => `$${i + 1}`).join(', ');

      const insertQuery = `
        INSERT INTO ${tableName} (${columnNames}) 
        VALUES (${placeholders})
      `;

      // Insert each row
      for (const row of rows) {
        const values = columnMappings.map(cm => {
          let value = row[cm.sqliteName];

          // Apply transformation if needed
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
    } catch (error) {
      if (this.config.options.useTransactions) {
        await client.query('ROLLBACK');
      }
      throw error;
    } finally {
      client.release();
    }
  }

  // Utility methods

  private convertTableName(sqliteName: string): string {
    // Convert to PostgreSQL naming convention
    return sqliteName.toLowerCase();
  }

  private convertIndexName(sqliteName: string): string {
    return sqliteName.toLowerCase() + '_pg';
  }

  private convertTriggerName(sqliteName: string): string {
    return sqliteName.toLowerCase() + '_pg';
  }

  private estimateMigrationDuration(dataMappings: DataMapping[]): number {
    const totalRows = dataMappings.reduce((sum, dm) => sum + dm.rowCount, 0);
    // Estimate: 10,000 rows per minute
    return Math.ceil(totalRows / 10000);
  }

  private estimateDataSize(dataMappings: DataMapping[]): number {
    // Rough estimate: 1KB per row average
    const totalRows = dataMappings.reduce((sum, dm) => sum + dm.rowCount, 0);
    return Math.ceil(totalRows / 1024); // Size in MB
  }

  private analyzeCompatibility(
    schemaMappings: SchemaMapping[],
    triggerMappings: TriggerMapping[]
  ): {
    fullyCompatible: string[];
    requiresTransformation: string[];
    unsupported: string[];
  } {
    const fullyCompatible: string[] = [];
    const requiresTransformation: string[] = [];
    const unsupported: string[] = [];

    // Analyze schema compatibility
    for (const mapping of schemaMappings) {
      const hasTransformations = mapping.columns.some(cm => cm.requiresTransformation);

      if (hasTransformations) {
        requiresTransformation.push(mapping.sqliteTable);
      } else {
        fullyCompatible.push(mapping.sqliteTable);
      }
    }

    // Analyze trigger compatibility
    for (const mapping of triggerMappings) {
      if (mapping.requiresRewrite) {
        if (!requiresTransformation.includes(mapping.sqliteTrigger)) {
          requiresTransformation.push(mapping.sqliteTrigger);
        }
      }
    }

    return { fullyCompatible, requiresTransformation, unsupported };
  }

  // Helper methods (stubs - would need full implementation)
  private getOriginalColumnInfo(tableName: string, columnName: string): any {
    const columns = this.sourceDb.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
    return columns.find((col: any) => col.name === columnName);
  }

  private getTableForIndex(indexName: string): string {
    const indexInfo = this.sourceDb
      .prepare(
        `
      SELECT tbl_name FROM sqlite_master WHERE name = ? AND type = 'index'
    `
      )
      .get(indexName) as any;

    return this.convertTableName(indexInfo?.tbl_name || 'unknown');
  }

  private requiresDataTransformation(tableName: string): boolean {
    return false; // Placeholder
  }

  private getTableDependencies(tableName: string): string[] {
    return []; // Placeholder
  }

  private sortByDependencies(mappings: DataMapping[]): DataMapping[] {
    return mappings; // Placeholder - would implement topological sort
  }

  private determineIndexType(sql: string): string {
    return 'btree'; // Placeholder
  }

  private convertTriggerToFunction(sql: string): string {
    return '-- Function conversion placeholder';
  }

  private convertTriggerSyntax(sql: string): string {
    return '-- Trigger conversion placeholder';
  }

  private requiresTriggerRewrite(sql: string): boolean {
    return true; // Most SQLite triggers need rewriting for PostgreSQL
  }

  private async createPostgresSchema(schemaMappings: SchemaMapping[]): Promise<void> {
    // Implementation placeholder
  }

  private async createIndexes(indexMappings: IndexMapping[]): Promise<void> {
    // Implementation placeholder
  }

  private async createTriggersAndFunctions(triggerMappings: TriggerMapping[]): Promise<void> {
    // Implementation placeholder
  }

  private async validateMigratedData(dataMappings: DataMapping[]): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    return { isValid: true, errors: [], warnings: [] };
  }

  private async cleanupFailedMigration(migratedTables: string[]): Promise<void> {
    // Implementation placeholder
  }

  /**
   * Close connections and cleanup
   */
  async close(): Promise<void> {
    await this.targetPool.end();
  }
}

interface ConstraintMapping {
  type: 'foreign_key' | 'unique' | 'check' | 'primary_key';
  sqliteDefinition: string;
  postgresDefinition: string;
}
