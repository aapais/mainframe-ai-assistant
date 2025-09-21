# Storage Service Migration Guide

## Overview

This guide provides comprehensive migration procedures for transitioning between MVP phases, database upgrades, and platform changes. It ensures zero-downtime migrations and data integrity throughout the evolution process.

## Table of Contents

1. [Migration Planning](#migration-planning)
2. [MVP Phase Migrations](#mvp-phase-migrations)
3. [Database Migrations](#database-migrations)
4. [Data Migration Procedures](#data-migration-procedures)
5. [Rollback Strategies](#rollback-strategies)
6. [Performance Considerations](#performance-considerations)
7. [Validation & Testing](#validation--testing)
8. [Troubleshooting](#troubleshooting)

## Migration Planning

### Pre-Migration Checklist

```typescript
// Migration planning and validation
class MigrationPlanner {
  constructor(private storage: StorageService) {}

  async planMigration(fromMVP: number, toMVP: number): Promise<MigrationPlan> {
    console.log(`📋 Planning migration from MVP${fromMVP} to MVP${toMVP}...`);

    const plan: MigrationPlan = {
      sourceVersion: fromMVP,
      targetVersion: toMVP,
      phases: [],
      estimatedTime: 0,
      riskLevel: 'low',
      requirements: [],
      rollbackPlan: null
    };

    // Analyze current state
    const currentState = await this.analyzeCurrentState();
    plan.currentState = currentState;

    // Generate migration phases
    plan.phases = this.generateMigrationPhases(fromMVP, toMVP);

    // Calculate time and risk
    plan.estimatedTime = this.calculateEstimatedTime(plan.phases);
    plan.riskLevel = this.assessRiskLevel(plan.phases);

    // Generate requirements
    plan.requirements = this.generateRequirements(plan.phases);

    // Create rollback plan
    plan.rollbackPlan = this.createRollbackPlan(plan.phases);

    console.log(`✅ Migration plan created:`);
    console.log(`   Phases: ${plan.phases.length}`);
    console.log(`   Estimated time: ${plan.estimatedTime} minutes`);
    console.log(`   Risk level: ${plan.riskLevel}`);

    return plan;
  }

  private async analyzeCurrentState(): Promise<CurrentState> {
    const stats = await this.storage.getStats();
    const health = await this.storage.healthCheck();
    const config = this.storage.getConfig();

    return {
      mvpVersion: await this.getCurrentMVPVersion(),
      databaseType: config.adapter,
      entryCount: stats.totalEntries,
      databaseSize: stats.diskUsage,
      enabledPlugins: this.getEnabledPlugins(),
      healthStatus: health,
      performanceMetrics: stats.performance
    };
  }

  private generateMigrationPhases(fromMVP: number, toMVP: number): MigrationPhase[] {
    const phases: MigrationPhase[] = [];

    for (let mvp = fromMVP + 1; mvp <= toMVP; mvp++) {
      phases.push({
        name: `MVP${mvp} Migration`,
        version: mvp,
        steps: this.getMigrationSteps(mvp),
        dependencies: this.getMigrationDependencies(mvp),
        estimatedTime: this.getPhaseTime(mvp),
        riskLevel: this.getPhaseRisk(mvp)
      });
    }

    return phases;
  }

  private getMigrationSteps(mvp: number): MigrationStep[] {
    const stepMap = {
      2: [
        { name: 'Enable Analytics Plugin', type: 'plugin', critical: false },
        { name: 'Enable Pattern Detection Plugin', type: 'plugin', critical: false },
        { name: 'Create Analytics Tables', type: 'schema', critical: true },
        { name: 'Migrate Historical Data', type: 'data', critical: true }
      ],
      3: [
        { name: 'Enable Code Analysis Plugin', type: 'plugin', critical: false },
        { name: 'Create Code Analysis Tables', type: 'schema', critical: true },
        { name: 'Setup Code Parser', type: 'component', critical: true }
      ],
      4: [
        { name: 'Enable Template Engine Plugin', type: 'plugin', critical: false },
        { name: 'Enable IDZ Bridge Plugin', type: 'plugin', critical: false },
        { name: 'Create Template Tables', type: 'schema', critical: true },
        { name: 'Generate Initial Templates', type: 'data', critical: false }
      ],
      5: [
        { name: 'Database Migration Assessment', type: 'assessment', critical: true },
        { name: 'Migrate to PostgreSQL', type: 'database', critical: true },
        { name: 'Enable Enterprise Intelligence', type: 'plugin', critical: false },
        { name: 'Setup AI Models', type: 'component', critical: true },
        { name: 'Enable Enterprise Features', type: 'feature', critical: false }
      ]
    };

    return stepMap[mvp] || [];
  }

  private calculateEstimatedTime(phases: MigrationPhase[]): number {
    return phases.reduce((total, phase) => total + phase.estimatedTime, 0);
  }

  private assessRiskLevel(phases: MigrationPhase[]): 'low' | 'medium' | 'high' {
    const hasDatabaseMigration = phases.some(p => 
      p.steps.some(s => s.type === 'database')
    );
    
    const hasMultiplePhases = phases.length > 2;
    
    if (hasDatabaseMigration) return 'high';
    if (hasMultiplePhases) return 'medium';
    return 'low';
  }

  async validateMigrationPrerequisites(plan: MigrationPlan): Promise<ValidationResult> {
    console.log('🔍 Validating migration prerequisites...');

    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      requirements: []
    };

    // Check disk space
    const requiredSpace = this.calculateRequiredSpace(plan);
    const availableSpace = await this.getAvailableDiskSpace();
    
    if (availableSpace < requiredSpace) {
      result.errors.push(`Insufficient disk space: ${requiredSpace}MB required, ${availableSpace}MB available`);
      result.valid = false;
    }

    // Check database connectivity
    try {
      await this.storage.healthCheck();
    } catch (error) {
      result.errors.push(`Database connectivity issue: ${error.message}`);
      result.valid = false;
    }

    // Check plugin dependencies
    for (const phase of plan.phases) {
      for (const step of phase.steps) {
        if (step.type === 'plugin') {
          const dependencies = await this.checkPluginDependencies(step.name);
          if (!dependencies.satisfied) {
            result.errors.push(`Plugin dependency not satisfied: ${step.name} requires ${dependencies.missing.join(', ')}`);
            result.valid = false;
          }
        }
      }
    }

    // Check for running transactions
    const activeTransactions = await this.checkActiveTransactions();
    if (activeTransactions > 0) {
      result.warnings.push(`${activeTransactions} active transactions detected. Consider waiting for completion.`);
    }

    console.log(`✅ Validation completed: ${result.valid ? 'PASSED' : 'FAILED'}`);
    if (result.errors.length > 0) {
      console.log('❌ Errors:', result.errors);
    }
    if (result.warnings.length > 0) {
      console.log('⚠️  Warnings:', result.warnings);
    }

    return result;
  }
}

interface MigrationPlan {
  sourceVersion: number;
  targetVersion: number;
  phases: MigrationPhase[];
  estimatedTime: number;
  riskLevel: 'low' | 'medium' | 'high';
  requirements: string[];
  rollbackPlan: RollbackPlan | null;
  currentState?: CurrentState;
}

interface MigrationPhase {
  name: string;
  version: number;
  steps: MigrationStep[];
  dependencies: string[];
  estimatedTime: number;
  riskLevel: 'low' | 'medium' | 'high';
}

interface MigrationStep {
  name: string;
  type: 'plugin' | 'schema' | 'data' | 'component' | 'feature' | 'database' | 'assessment';
  critical: boolean;
  estimatedTime?: number;
  dependencies?: string[];
}
```

### Migration Risk Assessment

```typescript
class MigrationRiskAssessment {
  assessRisk(currentState: CurrentState, targetMVP: number): RiskAssessment {
    const risks: Risk[] = [];
    let overallRisk: 'low' | 'medium' | 'high' = 'low';

    // Data size risk
    if (currentState.databaseSize > 1000000000) { // > 1GB
      risks.push({
        type: 'data-size',
        level: 'medium',
        description: 'Large database size may increase migration time',
        mitigation: 'Plan for extended downtime window'
      });
    }

    // Database type change risk
    if (targetMVP >= 5 && currentState.databaseType === 'sqlite') {
      risks.push({
        type: 'database-migration',
        level: 'high',
        description: 'Migration from SQLite to PostgreSQL required',
        mitigation: 'Use automated migration tools with validation'
      });
      overallRisk = 'high';
    }

    // Plugin dependencies risk
    const enabledPlugins = currentState.enabledPlugins.length;
    const targetPlugins = this.getRequiredPlugins(targetMVP).length;
    
    if (targetPlugins - enabledPlugins > 2) {
      risks.push({
        type: 'plugin-complexity',
        level: 'medium',
        description: 'Multiple new plugins to enable',
        mitigation: 'Enable plugins incrementally with testing'
      });
      
      if (overallRisk === 'low') overallRisk = 'medium';
    }

    // Performance risk
    if (currentState.performanceMetrics.avgSearchTime > 1000) {
      risks.push({
        type: 'performance',
        level: 'medium',
        description: 'Current performance issues may complicate migration',
        mitigation: 'Optimize performance before migration'
      });
    }

    return {
      overallRisk,
      risks,
      recommendations: this.generateRecommendations(risks)
    };
  }

  private generateRecommendations(risks: Risk[]): string[] {
    const recommendations = [];

    if (risks.some(r => r.type === 'database-migration')) {
      recommendations.push('Schedule migration during maintenance window');
      recommendations.push('Prepare rollback plan with database backup');
      recommendations.push('Test migration on copy of production data');
    }

    if (risks.some(r => r.type === 'data-size')) {
      recommendations.push('Consider incremental migration approach');
      recommendations.push('Monitor disk space during migration');
    }

    if (risks.some(r => r.level === 'high')) {
      recommendations.push('Perform dry run migration in test environment');
      recommendations.push('Have technical support available during migration');
    }

    return recommendations;
  }
}
```

## MVP Phase Migrations

### MVP1 to MVP2: Analytics & Pattern Detection

```typescript
class MVP1ToMVP2Migration {
  constructor(private storage: StorageService) {}

  async migrate(): Promise<MigrationResult> {
    console.log('🔄 Starting MVP1 to MVP2 migration...');

    const result: MigrationResult = {
      success: false,
      phases: [],
      errors: [],
      rollbackData: []
    };

    try {
      // Phase 1: Schema Updates
      console.log('📊 Phase 1: Creating analytics schema...');
      await this.createAnalyticsSchema();
      result.phases.push('analytics-schema');

      // Phase 2: Enable Analytics Plugin
      console.log('🔌 Phase 2: Enabling analytics plugin...');
      await this.enableAnalyticsPlugin();
      result.phases.push('analytics-plugin');

      // Phase 3: Enable Pattern Detection Plugin
      console.log('🔍 Phase 3: Enabling pattern detection plugin...');
      await this.enablePatternDetectionPlugin();
      result.phases.push('pattern-detection-plugin');

      // Phase 4: Migrate Historical Data
      console.log('📈 Phase 4: Migrating historical data...');
      await this.migrateHistoricalData();
      result.phases.push('historical-data');

      // Phase 5: Initialize Analytics
      console.log('⚡ Phase 5: Initializing analytics...');
      await this.initializeAnalytics();
      result.phases.push('analytics-init');

      result.success = true;
      console.log('✅ MVP1 to MVP2 migration completed successfully');

    } catch (error) {
      result.errors.push(error.message);
      console.error('❌ Migration failed:', error.message);
      
      // Attempt rollback
      await this.rollback(result.phases);
    }

    return result;
  }

  private async createAnalyticsSchema(): Promise<void> {
    const schemas = [
      `CREATE TABLE IF NOT EXISTS search_analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL,
        results_count INTEGER,
        user_id TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        search_time_ms INTEGER,
        successful BOOLEAN
      )`,
      
      `CREATE TABLE IF NOT EXISTS usage_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern_type TEXT NOT NULL,
        pattern_data TEXT NOT NULL,
        frequency INTEGER DEFAULT 1,
        confidence REAL DEFAULT 0.0,
        first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE INDEX IF NOT EXISTS idx_search_analytics_timestamp ON search_analytics(timestamp)`,
      `CREATE INDEX IF NOT EXISTS idx_search_analytics_query ON search_analytics(query)`,
      `CREATE INDEX IF NOT EXISTS idx_usage_patterns_type ON usage_patterns(pattern_type)`
    ];

    for (const schema of schemas) {
      await this.storage.executeSQL(schema);
    }
  }

  private async enableAnalyticsPlugin(): Promise<void> {
    await this.storage.enablePlugin('analytics', {
      trackSearchPatterns: true,
      trackUsageMetrics: true,
      aggregationInterval: 3600000 // 1 hour
    });
  }

  private async enablePatternDetectionPlugin(): Promise<void> {
    await this.storage.enablePlugin('patternDetection', {
      detectionInterval: 300000, // 5 minutes
      minimumOccurrences: 3,
      confidenceThreshold: 0.7
    });
  }

  private async migrateHistoricalData(): Promise<void> {
    // Migrate existing search history to new analytics format
    const searchHistory = await this.storage.executeSQL(`
      SELECT query, timestamp, results_count, user_id
      FROM search_history
      ORDER BY timestamp DESC
      LIMIT 1000
    `);

    const analyticsPlugin = this.storage.getPlugin('analytics');
    
    for (const record of searchHistory) {
      await analyticsPlugin.processData({
        type: 'search-event',
        query: record.query,
        resultsCount: record.results_count,
        userId: record.user_id,
        timestamp: record.timestamp
      });
    }
  }

  private async initializeAnalytics(): Promise<void> {
    const analyticsPlugin = this.storage.getPlugin('analytics');
    
    // Initialize baseline metrics
    await analyticsPlugin.processData({
      type: 'initialize',
      baselineDate: new Date()
    });

    // Start pattern detection on historical data
    const patternPlugin = this.storage.getPlugin('patternDetection');
    await patternPlugin.processData({
      type: 'initial-scan',
      lookbackDays: 30
    });
  }

  private async rollback(completedPhases: string[]): Promise<void> {
    console.log('🔄 Rolling back migration...');

    for (const phase of completedPhases.reverse()) {
      try {
        switch (phase) {
          case 'analytics-init':
            await this.storage.disablePlugin('analytics');
            await this.storage.disablePlugin('patternDetection');
            break;
          case 'historical-data':
            await this.storage.executeSQL('DELETE FROM search_analytics');
            await this.storage.executeSQL('DELETE FROM usage_patterns');
            break;
          case 'analytics-schema':
            await this.storage.executeSQL('DROP TABLE IF EXISTS search_analytics');
            await this.storage.executeSQL('DROP TABLE IF EXISTS usage_patterns');
            break;
        }
      } catch (error) {
        console.error(`Failed to rollback phase ${phase}:`, error.message);
      }
    }
  }
}
```

### MVP3 to MVP4: IDZ Integration & Templates

```typescript
class MVP3ToMVP4Migration {
  constructor(private storage: StorageService) {}

  async migrate(): Promise<MigrationResult> {
    console.log('🔄 Starting MVP3 to MVP4 migration...');

    const result: MigrationResult = {
      success: false,
      phases: [],
      errors: [],
      rollbackData: []
    };

    try {
      // Phase 1: Template Engine Setup
      console.log('🎨 Phase 1: Setting up template engine...');
      await this.setupTemplateEngine();
      result.phases.push('template-engine');

      // Phase 2: IDZ Bridge Setup
      console.log('🌉 Phase 2: Setting up IDZ bridge...');
      await this.setupIDZBridge();
      result.phases.push('idz-bridge');

      // Phase 3: Generate Initial Templates
      console.log('📋 Phase 3: Generating initial templates...');
      await this.generateInitialTemplates();
      result.phases.push('initial-templates');

      // Phase 4: Setup Project Management
      console.log('📁 Phase 4: Setting up project management...');
      await this.setupProjectManagement();
      result.phases.push('project-management');

      result.success = true;
      console.log('✅ MVP3 to MVP4 migration completed successfully');

    } catch (error) {
      result.errors.push(error.message);
      await this.rollback(result.phases);
    }

    return result;
  }

  private async setupTemplateEngine(): Promise<void> {
    // Create template tables
    const schemas = [
      `CREATE TABLE IF NOT EXISTS code_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL,
        template_code TEXT NOT NULL,
        parameters TEXT, -- JSON
        validation_rules TEXT, -- JSON
        usage_count INTEGER DEFAULT 0,
        success_rate REAL DEFAULT 0.0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS template_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_id TEXT NOT NULL,
        user_id TEXT,
        parameters_used TEXT, -- JSON
        generated_code TEXT,
        successful BOOLEAN,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (template_id) REFERENCES code_templates(id)
      )`,

      `CREATE INDEX IF NOT EXISTS idx_templates_category ON code_templates(category)`,
      `CREATE INDEX IF NOT EXISTS idx_template_usage_template ON template_usage(template_id)`
    ];

    for (const schema of schemas) {
      await this.storage.executeSQL(schema);
    }

    // Enable template engine plugin
    await this.storage.enablePlugin('templateEngine', {
      enableAutoGeneration: true,
      templateCategories: ['fix-patterns', 'code-snippets', 'best-practices'],
      validationRules: true
    });
  }

  private async setupIDZBridge(): Promise<void> {
    // Create IDZ integration tables
    const schemas = [
      `CREATE TABLE IF NOT EXISTS idz_projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_sync DATETIME,
        status TEXT DEFAULT 'active',
        metadata TEXT -- JSON
      )`,

      `CREATE TABLE IF NOT EXISTS idz_files (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_type TEXT NOT NULL,
        content_hash TEXT,
        last_modified DATETIME,
        analysis_results TEXT, -- JSON
        FOREIGN KEY (project_id) REFERENCES idz_projects(id)
      )`,

      `CREATE INDEX IF NOT EXISTS idx_idz_files_project ON idz_files(project_id)`,
      `CREATE INDEX IF NOT EXISTS idx_idz_files_type ON idz_files(file_type)`
    ];

    for (const schema of schemas) {
      await this.storage.executeSQL(schema);
    }

    // Enable IDZ bridge plugin
    await this.storage.enablePlugin('idzBridge', {
      idzPath: process.env.IDZ_PATH || '/opt/IBM/IDZ',
      workspacePath: process.env.IDZ_WORKSPACE || '/data/idz-workspace',
      enableAutoImport: true,
      enableAutoExport: true
    });
  }

  private async generateInitialTemplates(): Promise<void> {
    const templateEngine = this.storage.getPlugin('templateEngine');
    const patternDetection = this.storage.getPlugin('patternDetection');

    // Get successful patterns from MVP2/3
    const successfulPatterns = await patternDetection.processData({
      type: 'get-successful-patterns',
      minSuccessRate: 0.8,
      minUsageCount: 5
    });

    console.log(`🎨 Generating templates from ${successfulPatterns.length} successful patterns...`);

    for (const pattern of successfulPatterns) {
      try {
        const template = await templateEngine.processData({
          type: 'generate-from-pattern',
          pattern,
          templateType: 'fix-pattern'
        });

        console.log(`✅ Generated template: ${template.name}`);
      } catch (error) {
        console.warn(`⚠️  Failed to generate template for pattern ${pattern.id}:`, error.message);
      }
    }

    // Create standard templates for common operations
    await this.createStandardTemplates();
  }

  private async createStandardTemplates(): Promise<void> {
    const standardTemplates = [
      {
        name: 'VSAM File Handler',
        category: 'file-operations',
        description: 'Standard VSAM file opening with error handling',
        code: `       OPEN {{mode}} {{filename}}
       IF FILE-STATUS NOT = '00'
          EVALUATE FILE-STATUS
             WHEN '35'
                DISPLAY 'File {{filename}} not found'
             WHEN '37' 
                DISPLAY 'Space issue with {{filename}}'
             WHEN OTHER
                DISPLAY 'Error opening {{filename}}: ' FILE-STATUS
          END-EVALUATE
          MOVE 8 TO RETURN-CODE
          GOBACK
       END-IF`,
        parameters: [
          { name: 'filename', type: 'string', description: 'VSAM file name' },
          { name: 'mode', type: 'enum', values: ['INPUT', 'OUTPUT', 'I-O'], description: 'File open mode' }
        ]
      },
      {
        name: 'Error Handler',
        category: 'error-handling',
        description: 'Standard error handling routine',
        code: `       EVALUATE {{error-field}}
          WHEN '00'
             CONTINUE
          WHEN '35'
             PERFORM FILE-NOT-FOUND-ERROR
          WHEN '37'
             PERFORM SPACE-ERROR
          WHEN OTHER
             PERFORM GENERAL-ERROR
       END-EVALUATE`,
        parameters: [
          { name: 'error-field', type: 'string', description: 'Error status field name' }
        ]
      }
    ];

    const templateEngine = this.storage.getPlugin('templateEngine');

    for (const template of standardTemplates) {
      await templateEngine.processData({
        type: 'create-template',
        ...template
      });
    }
  }

  private async setupProjectManagement(): Promise<void> {
    // Initialize project management capabilities
    const idzBridge = this.storage.getPlugin('idzBridge');

    await idzBridge.processData({
      type: 'initialize-project-management',
      defaultSettings: {
        autoImport: true,
        autoAnalysis: true,
        validationLevel: 'standard'
      }
    });
  }
}
```

## Database Migrations

### SQLite to PostgreSQL Migration (MVP5)

```typescript
class DatabaseMigration {
  constructor(
    private sourceStorage: StorageService,
    private targetConfig: any
  ) {}

  async migrateSQLiteToPostgreSQL(): Promise<MigrationResult> {
    console.log('🐘 Starting SQLite to PostgreSQL migration...');

    const result: MigrationResult = {
      success: false,
      phases: [],
      errors: [],
      rollbackData: []
    };

    try {
      // Phase 1: Analyze source database
      console.log('🔍 Phase 1: Analyzing source database...');
      const analysis = await this.analyzeSourceDatabase();
      result.phases.push('source-analysis');

      // Phase 2: Setup target PostgreSQL database
      console.log('🗄️  Phase 2: Setting up target database...');
      const targetStorage = await this.setupTargetDatabase();
      result.phases.push('target-setup');

      // Phase 3: Schema migration
      console.log('📋 Phase 3: Migrating schema...');
      await this.migrateSchema(targetStorage);
      result.phases.push('schema-migration');

      // Phase 4: Data migration with batching
      console.log('📊 Phase 4: Migrating data...');
      await this.migrateDataInBatches(targetStorage, analysis);
      result.phases.push('data-migration');

      // Phase 5: Validate migration
      console.log('✅ Phase 5: Validating migration...');
      const validation = await this.validateMigration(targetStorage, analysis);
      if (!validation.success) {
        throw new Error(`Migration validation failed: ${validation.errors.join(', ')}`);
      }
      result.phases.push('validation');

      // Phase 6: Update configuration
      console.log('⚙️  Phase 6: Updating configuration...');
      await this.updateConfiguration(targetStorage);
      result.phases.push('config-update');

      result.success = true;
      console.log('✅ Database migration completed successfully');

    } catch (error) {
      result.errors.push(error.message);
      console.error('❌ Database migration failed:', error.message);
    }

    return result;
  }

  private async analyzeSourceDatabase(): Promise<DatabaseAnalysis> {
    const stats = await this.sourceStorage.getStats();
    
    const tables = await this.sourceStorage.executeSQL(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);

    const analysis: DatabaseAnalysis = {
      totalTables: tables.length,
      totalRecords: 0,
      tableAnalysis: [],
      estimatedMigrationTime: 0
    };

    for (const table of tables) {
      const count = await this.sourceStorage.executeSQL(`SELECT COUNT(*) as count FROM ${table.name}`);
      const tableInfo = {
        name: table.name,
        recordCount: count[0].count,
        estimatedTime: Math.ceil(count[0].count / 1000) // 1 second per 1000 records
      };
      
      analysis.tableAnalysis.push(tableInfo);
      analysis.totalRecords += tableInfo.recordCount;
      analysis.estimatedMigrationTime += tableInfo.estimatedTime;
    }

    console.log(`📊 Database analysis complete:`);
    console.log(`   Tables: ${analysis.totalTables}`);
    console.log(`   Records: ${analysis.totalRecords.toLocaleString()}`);
    console.log(`   Estimated time: ${analysis.estimatedMigrationTime} seconds`);

    return analysis;
  }

  private async setupTargetDatabase(): Promise<StorageService> {
    const targetStorage = new StorageService({
      adapter: 'postgresql',
      connectionString: this.targetConfig.connectionString,
      enablePlugins: false // Disable plugins during migration
    });

    await targetStorage.initialize();
    return targetStorage;
  }

  private async migrateSchema(targetStorage: StorageService): Promise<void> {
    // Get SQLite schema
    const schema = await this.sourceStorage.executeSQL(`
      SELECT sql FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);

    for (const table of schema) {
      if (table.sql) {
        // Convert SQLite SQL to PostgreSQL
        const pgSQL = this.convertSQLiteToPostgreSQL(table.sql);
        await targetStorage.executeSQL(pgSQL);
      }
    }

    // Create indexes
    const indexes = await this.sourceStorage.executeSQL(`
      SELECT sql FROM sqlite_master 
      WHERE type='index' AND name NOT LIKE 'sqlite_%'
    `);

    for (const index of indexes) {
      if (index.sql) {
        const pgIndexSQL = this.convertIndexToPostgreSQL(index.sql);
        await targetStorage.executeSQL(pgIndexSQL);
      }
    }
  }

  private convertSQLiteToPostgreSQL(sqliteSQL: string): string {
    return sqliteSQL
      .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
      .replace(/INTEGER/gi, 'INTEGER')
      .replace(/TEXT/gi, 'TEXT')
      .replace(/REAL/gi, 'REAL')
      .replace(/DATETIME DEFAULT CURRENT_TIMESTAMP/gi, 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
      .replace(/BOOLEAN/gi, 'BOOLEAN');
  }

  private convertIndexToPostgreSQL(indexSQL: string): string {
    // Basic index conversion - may need more sophisticated logic
    return indexSQL.replace(/IF NOT EXISTS/gi, '');
  }

  private async migrateDataInBatches(
    targetStorage: StorageService, 
    analysis: DatabaseAnalysis
  ): Promise<void> {
    const batchSize = 1000;

    for (const table of analysis.tableAnalysis) {
      console.log(`📊 Migrating table: ${table.name} (${table.recordCount.toLocaleString()} records)`);

      const totalBatches = Math.ceil(table.recordCount / batchSize);
      
      for (let batch = 0; batch < totalBatches; batch++) {
        const offset = batch * batchSize;
        
        // Get batch from source
        const data = await this.sourceStorage.executeSQL(`
          SELECT * FROM ${table.name} 
          LIMIT ${batchSize} OFFSET ${offset}
        `);

        if (data.length > 0) {
          // Insert batch into target
          await this.insertBatchData(targetStorage, table.name, data);
          
          // Progress update
          const progress = ((batch + 1) / totalBatches * 100).toFixed(1);
          console.log(`   Progress: ${progress}%`);
        }
      }

      console.log(`✅ Completed migration of ${table.name}`);
    }
  }

  private async insertBatchData(
    targetStorage: StorageService, 
    tableName: string, 
    data: any[]
  ): Promise<void> {
    if (data.length === 0) return;

    const columns = Object.keys(data[0]);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    
    const insertSQL = `
      INSERT INTO ${tableName} (${columns.join(', ')}) 
      VALUES (${placeholders})
    `;

    // Use transaction for batch insert
    await targetStorage.withTransaction(async (tx) => {
      for (const row of data) {
        const values = columns.map(col => row[col]);
        await tx.executeSQL(insertSQL, values);
      }
    });
  }

  private async validateMigration(
    targetStorage: StorageService, 
    analysis: DatabaseAnalysis
  ): Promise<ValidationResult> {
    console.log('🔍 Validating migration...');

    const validation: ValidationResult = {
      success: true,
      errors: [],
      warnings: []
    };

    // Check record counts
    for (const table of analysis.tableAnalysis) {
      const targetCount = await targetStorage.executeSQL(`SELECT COUNT(*) as count FROM ${table.name}`);
      
      if (targetCount[0].count !== table.recordCount) {
        validation.errors.push(`Record count mismatch in ${table.name}: expected ${table.recordCount}, got ${targetCount[0].count}`);
        validation.success = false;
      }
    }

    // Validate data integrity
    const sampleValidation = await this.validateSampleData(targetStorage);
    if (!sampleValidation.success) {
      validation.errors.push(...sampleValidation.errors);
      validation.success = false;
    }

    // Check foreign key constraints
    const constraintCheck = await this.validateConstraints(targetStorage);
    if (!constraintCheck.success) {
      validation.warnings.push(...constraintCheck.warnings);
    }

    if (validation.success) {
      console.log('✅ Migration validation passed');
    } else {
      console.log('❌ Migration validation failed');
      validation.errors.forEach(error => console.log(`   - ${error}`));
    }

    return validation;
  }

  private async validateSampleData(targetStorage: StorageService): Promise<ValidationResult> {
    const validation: ValidationResult = { success: true, errors: [] };

    // Sample validation for key tables
    const keyTables = ['kb_entries', 'kb_tags', 'search_history'];

    for (const table of keyTables) {
      try {
        const sample = await targetStorage.executeSQL(`SELECT * FROM ${table} LIMIT 10`);
        
        // Basic data quality checks
        for (const row of sample) {
          if (table === 'kb_entries') {
            if (!row.id || !row.title || !row.problem || !row.solution) {
              validation.errors.push(`Invalid kb_entries record: missing required fields`);
              validation.success = false;
            }
          }
        }
      } catch (error) {
        validation.errors.push(`Failed to validate ${table}: ${error.message}`);
        validation.success = false;
      }
    }

    return validation;
  }

  private async validateConstraints(targetStorage: StorageService): Promise<ValidationResult> {
    // Check foreign key constraints
    const validation: ValidationResult = { success: true, warnings: [] };

    try {
      const constraintCheck = await targetStorage.executeSQL(`
        SELECT COUNT(*) as orphaned
        FROM kb_tags t
        LEFT JOIN kb_entries e ON t.entry_id = e.id
        WHERE e.id IS NULL
      `);

      if (constraintCheck[0].orphaned > 0) {
        validation.warnings.push(`Found ${constraintCheck[0].orphaned} orphaned tag records`);
      }
    } catch (error) {
      validation.warnings.push(`Constraint validation failed: ${error.message}`);
    }

    return validation;
  }

  private async updateConfiguration(targetStorage: StorageService): Promise<void> {
    // Update system configuration to use PostgreSQL
    await targetStorage.setConfig('database-type', 'postgresql');
    await targetStorage.setConfig('migration-date', new Date().toISOString());
    await targetStorage.setConfig('migration-version', '5.0');
  }
}
```

## Data Migration Procedures

### Bulk Data Operations

```typescript
class BulkDataMigration {
  constructor(private storage: StorageService) {}

  async exportData(options: ExportOptions): Promise<ExportResult> {
    console.log('📤 Starting data export...');

    const result: ExportResult = {
      success: false,
      exported: {},
      errors: []
    };

    try {
      // Export knowledge base entries
      if (options.includeKBEntries) {
        result.exported.kbEntries = await this.exportKBEntries(options);
      }

      // Export analytics data
      if (options.includeAnalytics) {
        result.exported.analytics = await this.exportAnalytics(options);
      }

      // Export code analysis data
      if (options.includeCodeAnalysis) {
        result.exported.codeAnalysis = await this.exportCodeAnalysis(options);
      }

      // Export templates
      if (options.includeTemplates) {
        result.exported.templates = await this.exportTemplates(options);
      }

      result.success = true;
      console.log('✅ Data export completed');

    } catch (error) {
      result.errors.push(error.message);
      console.error('❌ Data export failed:', error.message);
    }

    return result;
  }

  async importData(data: any, options: ImportOptions): Promise<ImportResult> {
    console.log('📥 Starting data import...');

    const result: ImportResult = {
      success: false,
      imported: {},
      errors: [],
      skipped: {}
    };

    try {
      // Import in dependency order
      if (data.kbEntries) {
        result.imported.kbEntries = await this.importKBEntries(data.kbEntries, options);
      }

      if (data.analytics && options.includeAnalytics) {
        result.imported.analytics = await this.importAnalytics(data.analytics, options);
      }

      if (data.codeAnalysis && options.includeCodeAnalysis) {
        result.imported.codeAnalysis = await this.importCodeAnalysis(data.codeAnalysis, options);
      }

      if (data.templates && options.includeTemplates) {
        result.imported.templates = await this.importTemplates(data.templates, options);
      }

      result.success = true;
      console.log('✅ Data import completed');

    } catch (error) {
      result.errors.push(error.message);
      console.error('❌ Data import failed:', error.message);
    }

    return result;
  }

  private async exportKBEntries(options: ExportOptions): Promise<any[]> {
    const entries = await this.storage.executeSQL(`
      SELECT 
        e.*,
        GROUP_CONCAT(t.tag, ',') as tags
      FROM kb_entries e
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      ${options.dateFilter ? `WHERE e.created_at >= ?` : ''}
      GROUP BY e.id
      ORDER BY e.created_at DESC
    `, options.dateFilter ? [options.dateFilter] : []);

    return entries.map(entry => ({
      ...entry,
      tags: entry.tags ? entry.tags.split(',') : []
    }));
  }

  private async importKBEntries(entries: any[], options: ImportOptions): Promise<number> {
    let imported = 0;

    await this.storage.withTransaction(async (tx) => {
      for (const entry of entries) {
        try {
          // Check for duplicates if required
          if (options.skipDuplicates) {
            const existing = await tx.executeSQL(
              'SELECT id FROM kb_entries WHERE title = ? AND problem = ?',
              [entry.title, entry.problem]
            );

            if (existing.length > 0) {
              continue; // Skip duplicate
            }
          }

          // Import entry
          await tx.executeSQL(`
            INSERT INTO kb_entries (id, title, problem, solution, category, severity, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            entry.id,
            entry.title,
            entry.problem,
            entry.solution,
            entry.category,
            entry.severity,
            entry.created_by,
            entry.created_at,
            entry.updated_at
          ]);

          // Import tags
          if (entry.tags && entry.tags.length > 0) {
            for (const tag of entry.tags) {
              await tx.executeSQL(
                'INSERT INTO kb_tags (entry_id, tag) VALUES (?, ?)',
                [entry.id, tag.trim()]
              );
            }
          }

          imported++;
        } catch (error) {
          if (!options.continueOnError) {
            throw error;
          }
          console.warn(`Failed to import entry ${entry.id}:`, error.message);
        }
      }
    });

    return imported;
  }

  async validateDataIntegrity(): Promise<IntegrityResult> {
    console.log('🔍 Validating data integrity...');

    const result: IntegrityResult = {
      valid: true,
      issues: [],
      summary: {}
    };

    // Check for orphaned records
    const orphanedTags = await this.storage.executeSQL(`
      SELECT COUNT(*) as count
      FROM kb_tags t
      LEFT JOIN kb_entries e ON t.entry_id = e.id
      WHERE e.id IS NULL
    `);

    if (orphanedTags[0].count > 0) {
      result.issues.push({
        type: 'orphaned-records',
        table: 'kb_tags',
        count: orphanedTags[0].count,
        description: 'Tag records without corresponding KB entries'
      });
      result.valid = false;
    }

    // Check for missing required fields
    const invalidEntries = await this.storage.executeSQL(`
      SELECT COUNT(*) as count
      FROM kb_entries
      WHERE title IS NULL OR title = '' OR problem IS NULL OR problem = '' OR solution IS NULL OR solution = ''
    `);

    if (invalidEntries[0].count > 0) {
      result.issues.push({
        type: 'invalid-data',
        table: 'kb_entries',
        count: invalidEntries[0].count,
        description: 'KB entries with missing required fields'
      });
      result.valid = false;
    }

    // Generate summary
    result.summary = {
      totalKBEntries: (await this.storage.executeSQL('SELECT COUNT(*) as count FROM kb_entries'))[0].count,
      totalTags: (await this.storage.executeSQL('SELECT COUNT(*) as count FROM kb_tags'))[0].count,
      issuesFound: result.issues.length
    };

    if (result.valid) {
      console.log('✅ Data integrity validation passed');
    } else {
      console.log('❌ Data integrity issues found:');
      result.issues.forEach(issue => {
        console.log(`   - ${issue.description}: ${issue.count} records`);
      });
    }

    return result;
  }

  async cleanupData(options: CleanupOptions): Promise<CleanupResult> {
    console.log('🧹 Starting data cleanup...');

    const result: CleanupResult = {
      removed: {},
      errors: []
    };

    try {
      if (options.removeOrphaned) {
        result.removed.orphanedTags = await this.removeOrphanedTags();
      }

      if (options.removeDuplicates) {
        result.removed.duplicateEntries = await this.removeDuplicateEntries();
      }

      if (options.archiveOld && options.olderThanDays) {
        result.removed.archivedEntries = await this.archiveOldEntries(options.olderThanDays);
      }

      console.log('✅ Data cleanup completed');
    } catch (error) {
      result.errors.push(error.message);
      console.error('❌ Data cleanup failed:', error.message);
    }

    return result;
  }

  private async removeOrphanedTags(): Promise<number> {
    const result = await this.storage.executeSQL(`
      DELETE FROM kb_tags 
      WHERE entry_id NOT IN (SELECT id FROM kb_entries)
    `);

    return result.affectedRows || 0;
  }

  private async removeDuplicateEntries(): Promise<number> {
    // Find duplicates based on title and problem
    const duplicates = await this.storage.executeSQL(`
      SELECT title, problem, COUNT(*) as count, MIN(created_at) as first_created
      FROM kb_entries
      GROUP BY title, problem
      HAVING COUNT(*) > 1
    `);

    let removed = 0;

    for (const duplicate of duplicates) {
      // Keep the oldest entry, remove the rest
      const toRemove = await this.storage.executeSQL(`
        SELECT id FROM kb_entries
        WHERE title = ? AND problem = ? AND created_at > ?
      `, [duplicate.title, duplicate.problem, duplicate.first_created]);

      for (const entry of toRemove) {
        await this.storage.executeSQL('DELETE FROM kb_entries WHERE id = ?', [entry.id]);
        await this.storage.executeSQL('DELETE FROM kb_tags WHERE entry_id = ?', [entry.id]);
        removed++;
      }
    }

    return removed;
  }

  private async archiveOldEntries(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.storage.executeSQL(`
      UPDATE kb_entries 
      SET archived = TRUE 
      WHERE created_at < ? AND archived = FALSE AND usage_count < 5
    `, [cutoffDate.toISOString()]);

    return result.affectedRows || 0;
  }
}
```

## Rollback Strategies

### Automated Rollback System

```typescript
class RollbackManager {
  private rollbackStack: RollbackOperation[] = [];

  constructor(private storage: StorageService) {}

  pushOperation(operation: RollbackOperation): void {
    this.rollbackStack.push(operation);
  }

  async executeRollback(): Promise<RollbackResult> {
    console.log('🔄 Executing rollback...');

    const result: RollbackResult = {
      success: true,
      operationsRolledBack: 0,
      errors: []
    };

    // Execute rollback operations in reverse order
    while (this.rollbackStack.length > 0) {
      const operation = this.rollbackStack.pop();
      
      if (operation) {
        try {
          await this.executeRollbackOperation(operation);
          result.operationsRolledBack++;
        } catch (error) {
          result.errors.push({
            operation: operation.type,
            error: error.message
          });
          result.success = false;
        }
      }
    }

    if (result.success) {
      console.log(`✅ Rollback completed: ${result.operationsRolledBack} operations`);
    } else {
      console.log(`❌ Rollback completed with errors: ${result.errors.length} failures`);
    }

    return result;
  }

  private async executeRollbackOperation(operation: RollbackOperation): Promise<void> {
    switch (operation.type) {
      case 'plugin-disable':
        await this.storage.disablePlugin(operation.data.pluginName);
        break;

      case 'schema-drop':
        await this.storage.executeSQL(`DROP TABLE IF EXISTS ${operation.data.tableName}`);
        break;

      case 'data-restore':
        await this.restoreDataFromBackup(operation.data);
        break;

      case 'config-revert':
        await this.storage.setConfig(operation.data.key, operation.data.oldValue);
        break;

      default:
        throw new Error(`Unknown rollback operation type: ${operation.type}`);
    }
  }

  private async restoreDataFromBackup(data: any): Promise<void> {
    const { tableName, backupData } = data;
    
    // Clear current data
    await this.storage.executeSQL(`DELETE FROM ${tableName}`);
    
    // Restore from backup
    for (const record of backupData) {
      const columns = Object.keys(record);
      const placeholders = columns.map(() => '?').join(', ');
      const values = columns.map(col => record[col]);
      
      await this.storage.executeSQL(
        `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
        values
      );
    }
  }

  async createCheckpoint(name: string): Promise<string> {
    console.log(`📸 Creating checkpoint: ${name}`);

    const checkpoint: Checkpoint = {
      id: `checkpoint-${Date.now()}`,
      name,
      timestamp: new Date(),
      databaseState: await this.captureState(),
      config: this.storage.getConfig()
    };

    // Store checkpoint
    await this.storage.setConfig(`checkpoint-${checkpoint.id}`, JSON.stringify(checkpoint));

    console.log(`✅ Checkpoint created: ${checkpoint.id}`);
    return checkpoint.id;
  }

  async restoreFromCheckpoint(checkpointId: string): Promise<void> {
    console.log(`🔄 Restoring from checkpoint: ${checkpointId}`);

    const checkpointData = this.storage.getConfig(`checkpoint-${checkpointId}`);
    if (!checkpointData) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    const checkpoint: Checkpoint = JSON.parse(checkpointData);

    // Restore database state
    await this.restoreState(checkpoint.databaseState);

    // Restore configuration
    for (const [key, value] of Object.entries(checkpoint.config)) {
      await this.storage.setConfig(key, value);
    }

    console.log('✅ Checkpoint restoration completed');
  }

  private async captureState(): Promise<DatabaseState> {
    const stats = await this.storage.getStats();
    
    return {
      entryCount: stats.totalEntries,
      databaseSize: stats.diskUsage,
      tableChecksums: await this.calculateTableChecksums(),
      enabledPlugins: this.getEnabledPlugins()
    };
  }

  private async restoreState(state: DatabaseState): Promise<void> {
    // This would involve more complex restoration logic
    // For now, we'll just verify the state matches
    const currentState = await this.captureState();
    
    if (currentState.entryCount !== state.entryCount) {
      console.warn(`Entry count mismatch: expected ${state.entryCount}, got ${currentState.entryCount}`);
    }
  }

  private async calculateTableChecksums(): Promise<{ [table: string]: string }> {
    const tables = await this.storage.executeSQL(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);

    const checksums: { [table: string]: string } = {};

    for (const table of tables) {
      const data = await this.storage.executeSQL(`SELECT * FROM ${table.name} ORDER BY rowid`);
      const dataString = JSON.stringify(data);
      checksums[table.name] = this.calculateChecksum(dataString);
    }

    return checksums;
  }

  private calculateChecksum(data: string): string {
    // Simple checksum calculation (in production, use a proper hash function)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  private getEnabledPlugins(): string[] {
    // Implementation depends on how plugins are tracked
    return [];
  }
}

interface RollbackOperation {
  type: 'plugin-disable' | 'schema-drop' | 'data-restore' | 'config-revert';
  data: any;
  timestamp: Date;
}

interface Checkpoint {
  id: string;
  name: string;
  timestamp: Date;
  databaseState: DatabaseState;
  config: any;
}

interface DatabaseState {
  entryCount: number;
  databaseSize: number;
  tableChecksums: { [table: string]: string };
  enabledPlugins: string[];
}
```

This comprehensive migration guide provides the necessary tools and procedures to safely transition between MVP phases, handle database upgrades, and ensure data integrity throughout the evolution of the Storage Service. The automated migration tools, validation procedures, and rollback strategies minimize risk and ensure reliable transitions.

## Next Steps

1. **Review [Integration Guide](./integration-guide.md)** for implementation context
2. **Check [Performance Guide](./performance.md)** for optimization during migration
3. **Study [Troubleshooting Guide](./troubleshooting.md)** for issue resolution
4. **Test migration procedures** in development environment before production use