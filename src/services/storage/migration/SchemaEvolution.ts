import Database from 'better-sqlite3';
import crypto from 'crypto';

export interface SchemaVersion {
  version: number;
  mvp: number;
  timestamp: Date;
  description: string;
  changes: SchemaChange[];
  compatibility: CompatibilityInfo;
}

export interface SchemaChange {
  type: 'table' | 'column' | 'index' | 'constraint' | 'trigger';
  operation: 'create' | 'alter' | 'drop';
  target: string;
  details: any;
  reversible: boolean;
  breakingChange: boolean;
}

export interface CompatibilityInfo {
  backwardCompatible: boolean;
  forwardCompatible: boolean;
  minimumClientVersion: string;
  deprecatedFeatures: string[];
  newFeatures: string[];
}

export interface SchemaEvolutionPlan {
  currentSchema: SchemaSnapshot;
  targetSchema: SchemaSnapshot;
  evolutionSteps: SchemaEvolutionStep[];
  compatibilityMatrix: CompatibilityMatrix;
  riskAssessment: SchemaRiskAssessment;
}

export interface SchemaSnapshot {
  version: number;
  mvp: number;
  timestamp: Date;
  tables: TableDefinition[];
  indexes: IndexDefinition[];
  constraints: ConstraintDefinition[];
  triggers: TriggerDefinition[];
  checksum: string;
}

export interface SchemaEvolutionStep {
  step: number;
  description: string;
  sql: string;
  reversible: boolean;
  estimatedDuration: number;
  dataImpact: 'none' | 'minimal' | 'moderate' | 'significant';
  dependencies: number[];
}

export interface CompatibilityMatrix {
  versions: number[];
  compatibility: {
    [fromVersion: number]: {
      [toVersion: number]: 'compatible' | 'degraded' | 'incompatible';
    };
  };
}

export interface SchemaRiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: Array<{
    factor: string;
    severity: 'low' | 'medium' | 'high';
    impact: string;
    mitigation: string;
  }>;
  recommendations: string[];
}

export class SchemaEvolution {
  private db: Database.Database;
  private mvpSchemaDefinitions: Map<number, MVPSchemaDefinition> = new Map();

  constructor(db: Database.Database) {
    this.db = db;
    this.initializeSchemaTracking();
    this.loadMVPSchemaDefinitions();
  }

  /**
   * Detect current MVP version based on schema analysis
   */
  detectCurrentMVP(version?: number): number {
    if (version) {
      return Math.floor(version / 10);
    }

    // Analyze current schema to detect MVP
    const currentSchema = this.captureCurrentSchema();

    // Check for MVP5 features (enterprise)
    if (this.hasTable('ml_models') && this.hasTable('auto_resolutions')) {
      return 5;
    }

    // Check for MVP4 features (IDZ integration)
    if (this.hasTable('projects') && this.hasTable('templates')) {
      return 4;
    }

    // Check for MVP3 features (code analysis)
    if (this.hasTable('code_files') && this.hasTable('kb_code_links')) {
      return 3;
    }

    // Check for MVP2 features (pattern detection)
    if (this.hasTable('incidents') && this.hasTable('patterns')) {
      return 2;
    }

    // Check for MVP1 features (basic KB)
    if (this.hasTable('kb_entries')) {
      return 1;
    }

    return 0;
  }

  /**
   * Create comprehensive schema evolution plan
   */
  async createEvolutionPlan(targetMVP: number): Promise<SchemaEvolutionPlan> {
    const currentMVP = this.detectCurrentMVP();
    const currentSchema = this.captureCurrentSchema();
    const targetSchema = await this.generateTargetSchema(targetMVP);

    const evolutionSteps = await this.calculateEvolutionSteps(currentSchema, targetSchema);
    const compatibilityMatrix = this.generateCompatibilityMatrix(currentMVP, targetMVP);
    const riskAssessment = this.assessEvolutionRisk(evolutionSteps);

    return {
      currentSchema,
      targetSchema,
      evolutionSteps,
      compatibilityMatrix,
      riskAssessment,
    };
  }

  /**
   * Record successful MVP upgrade
   */
  async recordMVPUpgrade(mvp: number): Promise<void> {
    const schema = this.captureCurrentSchema();
    schema.mvp = mvp;

    this.db
      .prepare(
        `
      INSERT INTO schema_evolution_log (
        mvp, schema_version, timestamp, schema_snapshot, changes_applied
      ) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)
    `
      )
      .run(mvp, schema.version, JSON.stringify(schema), JSON.stringify(this.getRecentChanges()));

    this.emit('mvpUpgradeRecorded', { mvp, schema });
  }

  /**
   * Analyze schema compatibility between versions
   */
  async analyzeCompatibility(
    fromVersion: number,
    toVersion: number
  ): Promise<{
    compatible: boolean;
    issues: Array<{
      type: 'breaking' | 'warning' | 'info';
      description: string;
      impact: string;
      resolution: string;
    }>;
    migrationRequired: boolean;
    autoMigratable: boolean;
  }> {
    const fromSchema = await this.getSchemaAtVersion(fromVersion);
    const toSchema = await this.getSchemaAtVersion(toVersion);

    const issues = this.compareSchemas(fromSchema, toSchema);
    const breakingChanges = issues.filter(i => i.type === 'breaking');

    return {
      compatible: breakingChanges.length === 0,
      issues,
      migrationRequired: issues.length > 0,
      autoMigratable: breakingChanges.length === 0,
    };
  }

  /**
   * Generate schema diff between versions
   */
  generateSchemaDiff(
    fromVersion: number,
    toVersion: number
  ): {
    tablesAdded: string[];
    tablesRemoved: string[];
    tablesModified: Array<{
      table: string;
      columnsAdded: string[];
      columnsRemoved: string[];
      columnsModified: string[];
    }>;
    indexesAdded: string[];
    indexesRemoved: string[];
    constraintsChanged: string[];
  } {
    const fromSchema = this.getSchemaAtVersion(fromVersion);
    const toSchema = this.getSchemaAtVersion(toVersion);

    return this.calculateSchemaDiff(fromSchema, toSchema);
  }

  /**
   * Validate schema integrity and consistency
   */
  async validateSchemaIntegrity(): Promise<{
    valid: boolean;
    issues: Array<{
      severity: 'error' | 'warning';
      category: 'structure' | 'data' | 'reference' | 'index';
      description: string;
      location: string;
      suggestion: string;
    }>;
    statistics: {
      totalTables: number;
      totalIndexes: number;
      totalConstraints: number;
      orphanedRecords: number;
      integrityViolations: number;
    };
  }> {
    const issues: any[] = [];

    // Check table structure integrity
    const structureIssues = await this.validateTableStructures();
    issues.push(...structureIssues);

    // Check referential integrity
    const referenceIssues = await this.validateReferentialIntegrity();
    issues.push(...referenceIssues);

    // Check index integrity
    const indexIssues = await this.validateIndexIntegrity();
    issues.push(...indexIssues);

    // Gather statistics
    const statistics = await this.gatherSchemaStatistics();

    return {
      valid: issues.filter(i => i.severity === 'error').length === 0,
      issues,
      statistics,
    };
  }

  /**
   * Backup current schema structure
   */
  async backupSchema(): Promise<string> {
    const schema = this.captureCurrentSchema();
    const backupId = this.generateBackupId();
    const backupPath = `schema_backup_${backupId}.json`;

    this.db
      .prepare(
        `
      INSERT INTO schema_backups (
        backup_id, timestamp, schema_snapshot, backup_path
      ) VALUES (?, CURRENT_TIMESTAMP, ?, ?)
    `
      )
      .run(backupId, JSON.stringify(schema), backupPath);

    return backupId;
  }

  /**
   * Restore schema from backup
   */
  async restoreSchemaFromBackup(backupId: string): Promise<void> {
    const backup = this.db
      .prepare(
        `
      SELECT schema_snapshot FROM schema_backups WHERE backup_id = ?
    `
      )
      .get(backupId) as { schema_snapshot: string } | undefined;

    if (!backup) {
      throw new Error(`Schema backup ${backupId} not found`);
    }

    const schema = JSON.parse(backup.schema_snapshot) as SchemaSnapshot;
    await this.restoreSchemaStructure(schema);
  }

  // Private implementation methods

  private initializeSchemaTracking(): void {
    // Create schema evolution tracking tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_evolution_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mvp INTEGER NOT NULL,
        schema_version INTEGER NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        schema_snapshot TEXT NOT NULL,
        changes_applied TEXT,
        success BOOLEAN DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS schema_backups (
        backup_id TEXT PRIMARY KEY,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        schema_snapshot TEXT NOT NULL,
        backup_path TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS schema_compatibility (
        from_version INTEGER NOT NULL,
        to_version INTEGER NOT NULL,
        compatible BOOLEAN NOT NULL,
        issues TEXT,
        last_checked DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (from_version, to_version)
      );
    `);
  }

  private loadMVPSchemaDefinitions(): void {
    this.mvpSchemaDefinitions.set(1, {
      mvp: 1,
      name: 'Knowledge Base Core',
      requiredTables: [
        {
          name: 'kb_entries',
          columns: ['id', 'title', 'problem', 'solution', 'category', 'created_at'],
          primaryKey: 'id',
          indexes: ['category', 'created_at'],
        },
        {
          name: 'kb_tags',
          columns: ['entry_id', 'tag'],
          primaryKey: ['entry_id', 'tag'],
          foreignKeys: [{ column: 'entry_id', references: 'kb_entries(id)' }],
        },
      ],
      features: ['basic_search', 'categorization', 'tagging'],
    });

    this.mvpSchemaDefinitions.set(2, {
      mvp: 2,
      name: 'Pattern Detection',
      requiredTables: [
        {
          name: 'incidents',
          columns: ['id', 'ticket_id', 'timestamp', 'description', 'component'],
          primaryKey: 'id',
          indexes: ['timestamp', 'component'],
        },
        {
          name: 'patterns',
          columns: ['id', 'type', 'confidence', 'first_seen', 'last_seen'],
          primaryKey: 'id',
          indexes: ['type', 'confidence'],
        },
      ],
      features: ['incident_tracking', 'pattern_detection', 'alerting'],
    });

    // Continue for MVP 3, 4, 5...
  }

  private captureCurrentSchema(): SchemaSnapshot {
    const tables = this.getCurrentTables();
    const indexes = this.getCurrentIndexes();
    const constraints = this.getCurrentConstraints();
    const triggers = this.getCurrentTriggers();

    const snapshot: SchemaSnapshot = {
      version: this.getCurrentSchemaVersion(),
      mvp: this.detectCurrentMVP(),
      timestamp: new Date(),
      tables,
      indexes,
      constraints,
      triggers,
      checksum: this.calculateSchemaChecksum(tables, indexes, constraints, triggers),
    };

    return snapshot;
  }

  private getCurrentTables(): TableDefinition[] {
    const tables = this.db
      .prepare(
        `
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `
      )
      .all() as { name: string }[];

    return tables.map(table => {
      const columns = this.db.prepare(`PRAGMA table_info(${table.name})`).all();
      const foreignKeys = this.db.prepare(`PRAGMA foreign_key_list(${table.name})`).all();

      return {
        name: table.name,
        columns: columns.map((col: any) => ({
          name: col.name,
          type: col.type,
          nullable: !col.notnull,
          defaultValue: col.dflt_value,
          primaryKey: col.pk > 0,
        })),
        foreignKeys: foreignKeys.map((fk: any) => ({
          column: fk.from,
          references: `${fk.table}(${fk.to})`,
        })),
      };
    });
  }

  private getCurrentIndexes(): IndexDefinition[] {
    const indexes = this.db
      .prepare(
        `
      SELECT name, sql FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'
    `
      )
      .all() as { name: string; sql: string }[];

    return indexes.map(index => ({
      name: index.name,
      table: this.extractTableFromIndexSql(index.sql),
      columns: this.extractColumnsFromIndexSql(index.sql),
      unique: index.sql?.includes('UNIQUE') || false,
      sql: index.sql,
    }));
  }

  private getCurrentConstraints(): ConstraintDefinition[] {
    // SQLite doesn't have separate constraint tables,
    // constraints are part of table definitions
    return [];
  }

  private getCurrentTriggers(): TriggerDefinition[] {
    const triggers = this.db
      .prepare(
        `
      SELECT name, sql FROM sqlite_master WHERE type='trigger'
    `
      )
      .all() as { name: string; sql: string }[];

    return triggers.map(trigger => ({
      name: trigger.name,
      table: this.extractTableFromTriggerSql(trigger.sql),
      event: this.extractEventFromTriggerSql(trigger.sql),
      sql: trigger.sql,
    }));
  }

  private hasTable(tableName: string): boolean {
    const result = this.db
      .prepare(
        `
      SELECT name FROM sqlite_master WHERE type='table' AND name = ?
    `
      )
      .get(tableName);
    return !!result;
  }

  private getCurrentSchemaVersion(): number {
    try {
      const result = this.db
        .prepare(
          `
        SELECT COALESCE(MAX(version), 0) as version FROM schema_migrations
      `
        )
        .get() as { version: number };
      return result.version;
    } catch {
      return 0;
    }
  }

  private calculateSchemaChecksum(
    tables: TableDefinition[],
    indexes: IndexDefinition[],
    constraints: ConstraintDefinition[],
    triggers: TriggerDefinition[]
  ): string {
    const schemaString = JSON.stringify({
      tables: tables.sort((a, b) => a.name.localeCompare(b.name)),
      indexes: indexes.sort((a, b) => a.name.localeCompare(b.name)),
      constraints: constraints.sort((a, b) => a.name.localeCompare(b.name)),
      triggers: triggers.sort((a, b) => a.name.localeCompare(b.name)),
    });

    return crypto.createHash('sha256').update(schemaString).digest('hex');
  }

  private async generateTargetSchema(targetMVP: number): Promise<SchemaSnapshot> {
    const mvpDef = this.mvpSchemaDefinitions.get(targetMVP);
    if (!mvpDef) {
      throw new Error(`MVP ${targetMVP} schema definition not found`);
    }

    // Build cumulative schema including all previous MVPs
    const allTables: TableDefinition[] = [];
    const allIndexes: IndexDefinition[] = [];

    for (let mvp = 1; mvp <= targetMVP; mvp++) {
      const mvpSchema = this.mvpSchemaDefinitions.get(mvp);
      if (mvpSchema) {
        allTables.push(...mvpSchema.requiredTables);
      }
    }

    return {
      version: targetMVP * 10,
      mvp: targetMVP,
      timestamp: new Date(),
      tables: allTables,
      indexes: allIndexes,
      constraints: [],
      triggers: [],
      checksum: this.calculateSchemaChecksum(allTables, allIndexes, [], []),
    };
  }

  private async calculateEvolutionSteps(
    currentSchema: SchemaSnapshot,
    targetSchema: SchemaSnapshot
  ): Promise<SchemaEvolutionStep[]> {
    const steps: SchemaEvolutionStep[] = [];
    const diff = this.calculateSchemaDiff(currentSchema, targetSchema);

    let stepNumber = 1;

    // Add new tables
    for (const tableName of diff.tablesAdded) {
      const tableDefÂ = targetSchema.tables.find(t => t.name === tableName);
      if (tableDef) {
        steps.push({
          step: stepNumber++,
          description: `Create table ${tableName}`,
          sql: this.generateCreateTableSql(tableDef),
          reversible: true,
          estimatedDuration: 30, // 30 seconds
          dataImpact: 'none',
          dependencies: [],
        });
      }
    }

    // Add new indexes
    for (const indexName of diff.indexesAdded) {
      const indexDef = targetSchema.indexes.find(i => i.name === indexName);
      if (indexDef) {
        steps.push({
          step: stepNumber++,
          description: `Create index ${indexName}`,
          sql: indexDef.sql,
          reversible: true,
          estimatedDuration: 60, // 1 minute
          dataImpact: 'minimal',
          dependencies: [],
        });
      }
    }

    return steps;
  }

  private generateCompatibilityMatrix(currentMVP: number, targetMVP: number): CompatibilityMatrix {
    const versions = Array.from({ length: targetMVP - currentMVP + 1 }, (_, i) => currentMVP + i);
    const compatibility: any = {};

    for (const fromVersion of versions) {
      compatibility[fromVersion] = {};
      for (const toVersion of versions) {
        if (fromVersion === toVersion) {
          compatibility[fromVersion][toVersion] = 'compatible';
        } else if (toVersion > fromVersion) {
          // Forward compatibility (older client with newer schema)
          compatibility[fromVersion][toVersion] =
            toVersion - fromVersion <= 1 ? 'compatible' : 'degraded';
        } else {
          // Backward compatibility (newer client with older schema)
          compatibility[fromVersion][toVersion] = 'incompatible';
        }
      }
    }

    return { versions, compatibility };
  }

  private assessEvolutionRisk(steps: SchemaEvolutionStep[]): SchemaRiskAssessment {
    const riskFactors: any[] = [];
    let overallRiskScore = 0;

    for (const step of steps) {
      if (step.sql.includes('DROP TABLE')) {
        riskFactors.push({
          factor: 'Table deletion detected',
          severity: 'high',
          impact: 'Permanent data loss possible',
          mitigation: 'Ensure complete backup before proceeding',
        });
        overallRiskScore += 10;
      }

      if (step.sql.includes('ALTER TABLE') && step.sql.includes('DROP COLUMN')) {
        riskFactors.push({
          factor: 'Column deletion detected',
          severity: 'medium',
          impact: 'Data loss in specific columns',
          mitigation: 'Backup affected data separately',
        });
        overallRiskScore += 5;
      }

      if (step.dataImpact === 'significant') {
        overallRiskScore += 3;
      }
    }

    let overallRisk: 'low' | 'medium' | 'high' | 'critical';
    if (overallRiskScore >= 15) overallRisk = 'critical';
    else if (overallRiskScore >= 10) overallRisk = 'high';
    else if (overallRiskScore >= 5) overallRisk = 'medium';
    else overallRisk = 'low';

    return {
      overallRisk,
      riskFactors,
      recommendations: this.generateRiskRecommendations(overallRisk, riskFactors),
    };
  }

  private generateRiskRecommendations(risk: string, factors: any[]): string[] {
    const recommendations = ['Complete database backup before starting'];

    if (risk === 'critical' || risk === 'high') {
      recommendations.push('Plan for extended maintenance window');
      recommendations.push('Have rollback plan ready');
      recommendations.push('Test migration on copy of production data');
    }

    if (factors.some(f => f.factor.includes('deletion'))) {
      recommendations.push('Export affected data to external files');
      recommendations.push('Verify data recovery procedures');
    }

    return recommendations;
  }

  // Helper methods for SQL parsing and generation
  private extractTableFromIndexSql(sql: string): string {
    const match = sql?.match(/ON\s+(\w+)\s*\(/i);
    return match ? match[1] : '';
  }

  private extractColumnsFromIndexSql(sql: string): string[] {
    const match = sql?.match(/\(([^)]+)\)/);
    return match ? match[1].split(',').map(col => col.trim()) : [];
  }

  private extractTableFromTriggerSql(sql: string): string {
    const match = sql?.match(/ON\s+(\w+)/i);
    return match ? match[1] : '';
  }

  private extractEventFromTriggerSql(sql: string): string {
    const match = sql?.match(/(BEFORE|AFTER)\s+(INSERT|UPDATE|DELETE)/i);
    return match ? `${match[1]} ${match[2]}` : '';
  }

  private generateCreateTableSql(tableDef: TableDefinition): string {
    let sql = `CREATE TABLE ${tableDef.name} (\n`;

    const columnDefs = tableDef.columns.map(col => {
      let colDef = `  ${col.name} ${col.type}`;
      if (!col.nullable) colDef += ' NOT NULL';
      if (col.defaultValue) colDef += ` DEFAULT ${col.defaultValue}`;
      if (col.primaryKey) colDef += ' PRIMARY KEY';
      return colDef;
    });

    sql += columnDefs.join(',\n');

    if (tableDef.foreignKeys && tableDef.foreignKeys.length > 0) {
      const fkDefs = tableDef.foreignKeys.map(
        fk => `  FOREIGN KEY (${fk.column}) REFERENCES ${fk.references}`
      );
      sql += ',\n' + fkDefs.join(',\n');
    }

    sql += '\n)';
    return sql;
  }

  private emit(event: string, data: any): void {
    // Event emission would be handled by EventEmitter if this class extended it
    console.log(`Schema event: ${event}`, data);
  }

  // Placeholder implementations for complex methods
  private compareSchemas(schema1: SchemaSnapshot, schema2: SchemaSnapshot): any[] {
    return [];
  }

  private calculateSchemaDiff(schema1: SchemaSnapshot, schema2: SchemaSnapshot): any {
    return {
      tablesAdded: [],
      tablesRemoved: [],
      tablesModified: [],
      indexesAdded: [],
      indexesRemoved: [],
      constraintsChanged: [],
    };
  }

  private getSchemaAtVersion(version: number): SchemaSnapshot {
    return this.captureCurrentSchema();
  }

  private getRecentChanges(): any[] {
    return [];
  }

  private async validateTableStructures(): Promise<any[]> {
    return [];
  }

  private async validateReferentialIntegrity(): Promise<any[]> {
    return [];
  }

  private async validateIndexIntegrity(): Promise<any[]> {
    return [];
  }

  private async gatherSchemaStatistics(): Promise<any> {
    return {
      totalTables: 0,
      totalIndexes: 0,
      totalConstraints: 0,
      orphanedRecords: 0,
      integrityViolations: 0,
    };
  }

  private generateBackupId(): string {
    return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async restoreSchemaStructure(schema: SchemaSnapshot): Promise<void> {
    // Implementation for schema restoration
  }
}

// Supporting interfaces
interface TableDefinition {
  name: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    defaultValue?: string;
    primaryKey?: boolean;
  }>;
  foreignKeys?: Array<{
    column: string;
    references: string;
  }>;
}

interface IndexDefinition {
  name: string;
  table: string;
  columns: string[];
  unique: boolean;
  sql: string;
}

interface ConstraintDefinition {
  name: string;
  type: string;
  table: string;
  sql: string;
}

interface TriggerDefinition {
  name: string;
  table: string;
  event: string;
  sql: string;
}

interface MVPSchemaDefinition {
  mvp: number;
  name: string;
  requiredTables: TableDefinition[];
  features: string[];
}
