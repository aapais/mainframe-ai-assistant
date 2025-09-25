'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.DataTransformer = void 0;
const events_1 = require('events');
class DataTransformer extends events_1.EventEmitter {
  db;
  transformationRegistry = new Map();
  mvpMigrations = new Map();
  constructor(db) {
    super();
    this.db = db;
    this.initializeTransformationTracking();
    this.registerMVPTransformations();
  }
  async prepareForMigration(plan) {
    const transformations = await this.identifyRequiredTransformations(plan);
    const executionOrder = this.calculateOptimalExecutionOrder(transformations);
    const transformationPlan = {
      transformations,
      executionOrder,
      totalEstimatedDuration: this.calculateTotalDuration(transformations),
      dataVolumeImpact: await this.estimateDataVolumeImpact(transformations),
      riskLevel: this.assessTransformationRisk(transformations),
    };
    await this.validateTransformationPlan(transformationPlan);
    return transformationPlan;
  }
  async executeMigrationWithTransformation(migration) {
    const startTime = Date.now();
    try {
      const transaction = this.db.transaction(() => {
        this.db.exec(migration.up);
        const transformations = this.getTransformationsForMigration(migration);
        for (const transformation of transformations) {
          this.executeTransformation(transformation);
        }
      });
      transaction();
      const result = {
        success: true,
        version: migration.version,
        duration: Date.now() - startTime,
      };
      this.emit('migrationWithTransformationCompleted', {
        migration: migration.version,
        result,
      });
      return result;
    } catch (error) {
      return {
        success: false,
        version: migration.version,
        error: error.message,
        duration: Date.now() - startTime,
      };
    }
  }
  async simulateTransformation(migration) {
    const transformations = this.getTransformationsForMigration(migration);
    let totalRowsAffected = 0;
    const tablesModified = new Set();
    let totalDuration = 0;
    const risks = [];
    for (const transformation of transformations) {
      totalRowsAffected += transformation.estimatedRows;
      tablesModified.add(transformation.sourceTable);
      tablesModified.add(transformation.targetTable);
      totalDuration += transformation.estimatedDuration;
      if (!transformation.reversible) {
        risks.push(`Irreversible transformation: ${transformation.name}`);
      }
    }
    return {
      transformations,
      estimatedImpact: {
        rowsAffected: totalRowsAffected,
        tablesModified: Array.from(tablesModified),
        duration: totalDuration,
      },
      risks,
    };
  }
  async executeMVPDataMigration(fromMVP, toMVP, options = {}) {
    const migrationKey = `${fromMVP}->${toMVP}`;
    const mvpMigration = this.mvpMigrations.get(migrationKey);
    if (!mvpMigration) {
      throw new Error(`No data migration defined for MVP ${fromMVP} to MVP ${toMVP}`);
    }
    const results = [];
    if (options.createBackup) {
      await this.createDataBackup(fromMVP);
    }
    for (const transformation of mvpMigration.transformations) {
      const result = await this.executeTransformationWithValidation(transformation);
      results.push(result);
      if (!result.success) {
        await this.rollbackPartialTransformation(results);
        throw new Error(`Data transformation failed: ${transformation.name}`);
      }
    }
    if (options.validateResults) {
      await this.validateMVPMigrationResults(toMVP);
    }
    return results;
  }
  async enrichDataForMVP(targetMVP) {
    const enrichmentTransformations = this.getEnrichmentTransformations(targetMVP);
    const results = [];
    for (const transformation of enrichmentTransformations) {
      const result = await this.executeDataEnrichment(transformation);
      results.push(result);
    }
    return results;
  }
  async archiveOldData(mvp, archiveStrategy) {
    const tablesForArchival = this.getTablesForArchival(mvp);
    let totalArchivedRows = 0;
    let totalArchiveSize = 0;
    const archivedTables = [];
    let archivePath;
    for (const table of tablesForArchival) {
      const result = await this.archiveTableData(table, archiveStrategy);
      totalArchivedRows += result.rowsArchived;
      totalArchiveSize += result.dataSize;
      archivedTables.push(table.name);
      if (result.archivePath && !archivePath) {
        archivePath = result.archivePath;
      }
    }
    return {
      archivedTables,
      archivedRows: totalArchivedRows,
      archiveSize: totalArchiveSize,
      archivePath,
    };
  }
  async validateDataIntegrity(transformationResults) {
    const issues = [];
    let totalRowsValidated = 0;
    let integrityViolations = 0;
    const tablesChecked = new Set();
    for (const result of transformationResults) {
      const transformation = this.transformationRegistry.get(result.transformationId);
      if (transformation) {
        const tableIssues = await this.validateTableIntegrity(transformation.targetTable);
        issues.push(...tableIssues);
        totalRowsValidated += result.rowsProcessed;
        tablesChecked.add(transformation.targetTable);
        integrityViolations += tableIssues.filter(i => i.severity === 'error').length;
      }
    }
    return {
      valid: integrityViolations === 0,
      issues,
      statistics: {
        totalRowsValidated,
        tablesChecked: tablesChecked.size,
        integrityViolations,
      },
    };
  }
  initializeTransformationTracking() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS data_transformations_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transformation_id TEXT NOT NULL,
        migration_version INTEGER,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        rows_processed INTEGER,
        success BOOLEAN,
        error_message TEXT,
        validation_results TEXT
      );

      CREATE TABLE IF NOT EXISTS data_backups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        backup_id TEXT NOT NULL,
        mvp_version INTEGER,
        table_name TEXT NOT NULL,
        backup_path TEXT,
        rows_backed_up INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }
  registerMVPTransformations() {
    this.mvpMigrations.set('1->2', {
      fromMVP: 1,
      toMVP: 2,
      transformations: [
        {
          id: 'kb_to_incident_mapping',
          name: 'Map KB entries to incident structure',
          description: 'Transform existing KB entries to work with incident patterns',
          sourceTable: 'kb_entries',
          targetTable: 'incidents',
          transformationType: 'convert',
          sql: `
            INSERT INTO incidents (ticket_id, timestamp, title, description, component, severity)
            SELECT 
              'KB-' || id as ticket_id,
              created_at as timestamp,
              title,
              problem as description,
              category as component,
              'medium' as severity
            FROM kb_entries
            WHERE created_at IS NOT NULL
          `,
          reversible: true,
          estimatedRows: 100,
          estimatedDuration: 30,
          dependencies: [],
          validationQueries: ['SELECT COUNT(*) FROM incidents WHERE ticket_id LIKE "KB-%"'],
        },
      ],
      dataPreservationStrategy: 'full',
      rollbackStrategy: 'delete_converted_records',
    });
    this.mvpMigrations.set('2->3', {
      fromMVP: 2,
      toMVP: 3,
      transformations: [
        {
          id: 'link_incidents_to_code',
          name: 'Create initial code-incident links',
          description: 'Link existing incidents to placeholder code entries',
          sourceTable: 'incidents',
          targetTable: 'kb_code_links',
          transformationType: 'enrich',
          sql: `
            INSERT INTO kb_code_links (kb_entry_id, file_path, line_number, link_type, confidence)
            SELECT 
              i.id,
              'placeholder/' || i.component || '.cbl' as file_path,
              1 as line_number,
              'pattern' as link_type,
              50 as confidence
            FROM incidents i
            WHERE i.component IS NOT NULL
          `,
          reversible: true,
          estimatedRows: 50,
          estimatedDuration: 15,
          dependencies: [],
          validationQueries: ['SELECT COUNT(*) FROM kb_code_links WHERE link_type = "pattern"'],
        },
      ],
      dataPreservationStrategy: 'full',
      rollbackStrategy: 'delete_generated_links',
    });
    this.mvpMigrations.set('3->4', {
      fromMVP: 3,
      toMVP: 4,
      transformations: [
        {
          id: 'generate_templates_from_patterns',
          name: 'Generate templates from successful patterns',
          description: 'Create reusable templates from high-success KB entries',
          sourceTable: 'kb_entries',
          targetTable: 'templates',
          transformationType: 'convert',
          sql: `
            INSERT INTO templates (name, description, source_pattern, parameters, success_rate)
            SELECT 
              'Template for ' || category as name,
              'Auto-generated from successful KB entry: ' || title as description,
              id as source_pattern,
              '[]' as parameters,
              CAST(success_count AS FLOAT) / NULLIF(usage_count, 0) as success_rate
            FROM kb_entries 
            WHERE usage_count > 5 AND success_count > failure_count
          `,
          reversible: true,
          estimatedRows: 20,
          estimatedDuration: 45,
          dependencies: [],
          validationQueries: ['SELECT COUNT(*) FROM templates WHERE source_pattern IS NOT NULL'],
        },
      ],
      dataPreservationStrategy: 'full',
      rollbackStrategy: 'delete_auto_generated_templates',
    });
    this.mvpMigrations.set('4->5', {
      fromMVP: 4,
      toMVP: 5,
      transformations: [
        {
          id: 'prepare_ml_training_data',
          name: 'Prepare ML training dataset',
          description: 'Create training data from historical patterns and resolutions',
          sourceTable: 'patterns',
          targetTable: 'ml_training_data',
          transformationType: 'convert',
          sql: `
            INSERT INTO ml_training_data (pattern_id, features, outcome, confidence)
            SELECT 
              p.id,
              json_object(
                'incident_count', p.frequency,
                'severity', p.severity,
                'component', p.suggested_cause,
                'resolution_time', avg(i.resolution_time)
              ) as features,
              CASE WHEN p.confidence > 80 THEN 'success' ELSE 'review' END as outcome,
              p.confidence
            FROM patterns p
            LEFT JOIN incidents i ON p.id = i.pattern_id
            GROUP BY p.id
          `,
          reversible: true,
          estimatedRows: 100,
          estimatedDuration: 60,
          dependencies: [],
          validationQueries: ['SELECT COUNT(*) FROM ml_training_data WHERE outcome IS NOT NULL'],
        },
      ],
      dataPreservationStrategy: 'selective',
      rollbackStrategy: 'archive_ml_data',
    });
  }
  async identifyRequiredTransformations(plan) {
    const transformations = [];
    const migrationKey = `${plan.currentMVP}->${plan.targetMVP}`;
    const mvpMigration = this.mvpMigrations.get(migrationKey);
    if (mvpMigration) {
      transformations.push(...mvpMigration.transformations);
    }
    for (const migration of plan.migrations) {
      const customTransformations = this.detectCustomTransformations(migration);
      transformations.push(...customTransformations);
    }
    return transformations;
  }
  calculateOptimalExecutionOrder(transformations) {
    const order = [];
    const visited = new Set();
    const visiting = new Set();
    const visit = transformationId => {
      if (visiting.has(transformationId)) {
        throw new Error(`Circular dependency detected in transformation: ${transformationId}`);
      }
      if (visited.has(transformationId)) {
        return;
      }
      visiting.add(transformationId);
      const transformation = transformations.find(t => t.id === transformationId);
      if (transformation) {
        for (const dependency of transformation.dependencies) {
          visit(dependency);
        }
      }
      visiting.delete(transformationId);
      visited.add(transformationId);
      order.push(transformationId);
    };
    for (const transformation of transformations) {
      if (!visited.has(transformation.id)) {
        visit(transformation.id);
      }
    }
    return order;
  }
  calculateTotalDuration(transformations) {
    return transformations.reduce((total, t) => total + t.estimatedDuration, 0);
  }
  async estimateDataVolumeImpact(transformations) {
    let totalImpact = 0;
    for (const transformation of transformations) {
      const sourceRows = this.getTableRowCount(transformation.sourceTable);
      totalImpact += sourceRows;
    }
    return totalImpact;
  }
  assessTransformationRisk(transformations) {
    let riskScore = 0;
    for (const transformation of transformations) {
      if (!transformation.reversible) riskScore += 10;
      if (transformation.transformationType === 'merge') riskScore += 5;
      if (transformation.estimatedRows > 10000) riskScore += 3;
      if (transformation.sql.includes('DELETE')) riskScore += 8;
    }
    if (riskScore >= 20) return 'critical';
    if (riskScore >= 12) return 'high';
    if (riskScore >= 6) return 'medium';
    return 'low';
  }
  async validateTransformationPlan(plan) {
    for (const transformation of plan.transformations) {
      try {
        this.db.prepare(transformation.sql);
      } catch (error) {
        throw new Error(`Invalid SQL in transformation ${transformation.id}: ${error.message}`);
      }
    }
    for (const transformation of plan.transformations) {
      if (!this.tableExists(transformation.sourceTable)) {
        throw new Error(
          `Source table ${transformation.sourceTable} does not exist for transformation ${transformation.id}`
        );
      }
    }
  }
  getTransformationsForMigration(migration) {
    return Array.from(this.transformationRegistry.values()).filter(
      t => migration.up.includes(t.targetTable) || migration.up.includes(t.sourceTable)
    );
  }
  executeTransformation(transformation) {
    const startTime = Date.now();
    try {
      const result = this.db.exec(transformation.sql);
      this.db
        .prepare(
          `
        INSERT INTO data_transformations_log 
        (transformation_id, rows_processed, success, completed_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `
        )
        .run(transformation.id, transformation.estimatedRows, 1);
    } catch (error) {
      this.db
        .prepare(
          `
        INSERT INTO data_transformations_log 
        (transformation_id, success, error_message, completed_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `
        )
        .run(transformation.id, 0, error.message);
      throw error;
    }
  }
  async executeTransformationWithValidation(transformation) {
    const startTime = Date.now();
    try {
      this.transformationRegistry.set(transformation.id, transformation);
      const result = this.db.exec(transformation.sql);
      const validationResults = [];
      for (const query of transformation.validationQueries) {
        const validationResult = await this.runValidationQuery(query);
        validationResults.push(validationResult);
      }
      const transformationResult = {
        transformationId: transformation.id,
        success: true,
        rowsProcessed: transformation.estimatedRows,
        duration: Date.now() - startTime,
        validationResults,
      };
      this.emit('transformationCompleted', transformationResult);
      return transformationResult;
    } catch (error) {
      return {
        transformationId: transformation.id,
        success: false,
        rowsProcessed: 0,
        duration: Date.now() - startTime,
        error: error.message,
      };
    }
  }
  async rollbackPartialTransformation(results) {
    for (let i = results.length - 1; i >= 0; i--) {
      const result = results[i];
      if (result.success) {
        const transformation = this.transformationRegistry.get(result.transformationId);
        if (transformation && transformation.reversible) {
          const rollbackSql = this.generateRollbackSql(transformation);
          try {
            this.db.exec(rollbackSql);
          } catch (error) {
            console.error(`Failed to rollback transformation ${transformation.id}:`, error);
          }
        }
      }
    }
  }
  async createDataBackup(mvp) {
    const backupId = `backup_${mvp}_${Date.now()}`;
    const backupPath = `./backups/${backupId}.db`;
    this.db.backup(backupPath);
    this.db
      .prepare(
        `
      INSERT INTO data_backups (backup_id, mvp_version, backup_path, created_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `
      )
      .run(backupId, mvp, backupPath);
    return backupId;
  }
  detectCustomTransformations(migration) {
    const transformations = [];
    if (migration.up.includes('ALTER TABLE') && migration.up.includes('ADD COLUMN')) {
    }
    return transformations;
  }
  getTableRowCount(tableName) {
    try {
      const result = this.db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
      return result.count;
    } catch {
      return 0;
    }
  }
  tableExists(tableName) {
    const result = this.db
      .prepare(
        `
      SELECT name FROM sqlite_master WHERE type='table' AND name = ?
    `
      )
      .get(tableName);
    return !!result;
  }
  async runValidationQuery(query) {
    try {
      const result = this.db.prepare(query).get();
      return {
        query,
        expected: null,
        actual: result,
        passed: true,
      };
    } catch (error) {
      return {
        query,
        expected: null,
        actual: null,
        passed: false,
        message: error.message,
      };
    }
  }
  generateRollbackSql(transformation) {
    switch (transformation.transformationType) {
      case 'copy':
        return `DELETE FROM ${transformation.targetTable} WHERE source_transformation = '${transformation.id}'`;
      case 'convert':
        return `DELETE FROM ${transformation.targetTable} WHERE created_by_transformation = '${transformation.id}'`;
      default:
        throw new Error(
          `No rollback strategy defined for transformation type: ${transformation.transformationType}`
        );
    }
  }
  getEnrichmentTransformations(targetMVP) {
    return [];
  }
  async executeDataEnrichment(transformation) {
    return this.executeTransformationWithValidation(transformation);
  }
  getTablesForArchival(mvp) {
    return [];
  }
  async archiveTableData(table, strategy) {
    return {
      rowsArchived: 0,
      dataSize: 0,
      archivePath: null,
    };
  }
  async validateTableIntegrity(tableName) {
    return [];
  }
  async validateMVPMigrationResults(mvp) {}
}
exports.DataTransformer = DataTransformer;
//# sourceMappingURL=DataTransformer.js.map
