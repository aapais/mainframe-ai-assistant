"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchemaEvolution = void 0;
const tslib_1 = require("tslib");
const crypto_1 = tslib_1.__importDefault(require("crypto"));
class SchemaEvolution {
    db;
    mvpSchemaDefinitions = new Map();
    constructor(db) {
        this.db = db;
        this.initializeSchemaTracking();
        this.loadMVPSchemaDefinitions();
    }
    detectCurrentMVP(version) {
        if (version) {
            return Math.floor(version / 10);
        }
        const currentSchema = this.captureCurrentSchema();
        if (this.hasTable('ml_models') && this.hasTable('auto_resolutions')) {
            return 5;
        }
        if (this.hasTable('projects') && this.hasTable('templates')) {
            return 4;
        }
        if (this.hasTable('code_files') && this.hasTable('kb_code_links')) {
            return 3;
        }
        if (this.hasTable('incidents') && this.hasTable('patterns')) {
            return 2;
        }
        if (this.hasTable('kb_entries')) {
            return 1;
        }
        return 0;
    }
    async createEvolutionPlan(targetMVP) {
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
            riskAssessment
        };
    }
    async recordMVPUpgrade(mvp) {
        const schema = this.captureCurrentSchema();
        schema.mvp = mvp;
        this.db.prepare(`
      INSERT INTO schema_evolution_log (
        mvp, schema_version, timestamp, schema_snapshot, changes_applied
      ) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)
    `).run(mvp, schema.version, JSON.stringify(schema), JSON.stringify(this.getRecentChanges()));
        this.emit('mvpUpgradeRecorded', { mvp, schema });
    }
    async analyzeCompatibility(fromVersion, toVersion) {
        const fromSchema = await this.getSchemaAtVersion(fromVersion);
        const toSchema = await this.getSchemaAtVersion(toVersion);
        const issues = this.compareSchemas(fromSchema, toSchema);
        const breakingChanges = issues.filter(i => i.type === 'breaking');
        return {
            compatible: breakingChanges.length === 0,
            issues,
            migrationRequired: issues.length > 0,
            autoMigratable: breakingChanges.length === 0
        };
    }
    generateSchemaDiff(fromVersion, toVersion) {
        const fromSchema = this.getSchemaAtVersion(fromVersion);
        const toSchema = this.getSchemaAtVersion(toVersion);
        return this.calculateSchemaDiff(fromSchema, toSchema);
    }
    async validateSchemaIntegrity() {
        const issues = [];
        const structureIssues = await this.validateTableStructures();
        issues.push(...structureIssues);
        const referenceIssues = await this.validateReferentialIntegrity();
        issues.push(...referenceIssues);
        const indexIssues = await this.validateIndexIntegrity();
        issues.push(...indexIssues);
        const statistics = await this.gatherSchemaStatistics();
        return {
            valid: issues.filter(i => i.severity === 'error').length === 0,
            issues,
            statistics
        };
    }
    async backupSchema() {
        const schema = this.captureCurrentSchema();
        const backupId = this.generateBackupId();
        const backupPath = `schema_backup_${backupId}.json`;
        this.db.prepare(`
      INSERT INTO schema_backups (
        backup_id, timestamp, schema_snapshot, backup_path
      ) VALUES (?, CURRENT_TIMESTAMP, ?, ?)
    `).run(backupId, JSON.stringify(schema), backupPath);
        return backupId;
    }
    async restoreSchemaFromBackup(backupId) {
        const backup = this.db.prepare(`
      SELECT schema_snapshot FROM schema_backups WHERE backup_id = ?
    `).get(backupId);
        if (!backup) {
            throw new Error(`Schema backup ${backupId} not found`);
        }
        const schema = JSON.parse(backup.schema_snapshot);
        await this.restoreSchemaStructure(schema);
    }
    initializeSchemaTracking() {
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
    loadMVPSchemaDefinitions() {
        this.mvpSchemaDefinitions.set(1, {
            mvp: 1,
            name: 'Knowledge Base Core',
            requiredTables: [
                {
                    name: 'kb_entries',
                    columns: ['id', 'title', 'problem', 'solution', 'category', 'created_at'],
                    primaryKey: 'id',
                    indexes: ['category', 'created_at']
                },
                {
                    name: 'kb_tags',
                    columns: ['entry_id', 'tag'],
                    primaryKey: ['entry_id', 'tag'],
                    foreignKeys: [{ column: 'entry_id', references: 'kb_entries(id)' }]
                }
            ],
            features: ['basic_search', 'categorization', 'tagging']
        });
        this.mvpSchemaDefinitions.set(2, {
            mvp: 2,
            name: 'Pattern Detection',
            requiredTables: [
                {
                    name: 'incidents',
                    columns: ['id', 'ticket_id', 'timestamp', 'description', 'component'],
                    primaryKey: 'id',
                    indexes: ['timestamp', 'component']
                },
                {
                    name: 'patterns',
                    columns: ['id', 'type', 'confidence', 'first_seen', 'last_seen'],
                    primaryKey: 'id',
                    indexes: ['type', 'confidence']
                }
            ],
            features: ['incident_tracking', 'pattern_detection', 'alerting']
        });
    }
    captureCurrentSchema() {
        const tables = this.getCurrentTables();
        const indexes = this.getCurrentIndexes();
        const constraints = this.getCurrentConstraints();
        const triggers = this.getCurrentTriggers();
        const snapshot = {
            version: this.getCurrentSchemaVersion(),
            mvp: this.detectCurrentMVP(),
            timestamp: new Date(),
            tables,
            indexes,
            constraints,
            triggers,
            checksum: this.calculateSchemaChecksum(tables, indexes, constraints, triggers)
        };
        return snapshot;
    }
    getCurrentTables() {
        const tables = this.db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all();
        return tables.map(table => {
            const columns = this.db.prepare(`PRAGMA table_info(${table.name})`).all();
            const foreignKeys = this.db.prepare(`PRAGMA foreign_key_list(${table.name})`).all();
            return {
                name: table.name,
                columns: columns.map((col) => ({
                    name: col.name,
                    type: col.type,
                    nullable: !col.notnull,
                    defaultValue: col.dflt_value,
                    primaryKey: col.pk > 0
                })),
                foreignKeys: foreignKeys.map((fk) => ({
                    column: fk.from,
                    references: `${fk.table}(${fk.to})`
                }))
            };
        });
    }
    getCurrentIndexes() {
        const indexes = this.db.prepare(`
      SELECT name, sql FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'
    `).all();
        return indexes.map(index => ({
            name: index.name,
            table: this.extractTableFromIndexSql(index.sql),
            columns: this.extractColumnsFromIndexSql(index.sql),
            unique: index.sql?.includes('UNIQUE') || false,
            sql: index.sql
        }));
    }
    getCurrentConstraints() {
        return [];
    }
    getCurrentTriggers() {
        const triggers = this.db.prepare(`
      SELECT name, sql FROM sqlite_master WHERE type='trigger'
    `).all();
        return triggers.map(trigger => ({
            name: trigger.name,
            table: this.extractTableFromTriggerSql(trigger.sql),
            event: this.extractEventFromTriggerSql(trigger.sql),
            sql: trigger.sql
        }));
    }
    hasTable(tableName) {
        const result = this.db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name = ?
    `).get(tableName);
        return !!result;
    }
    getCurrentSchemaVersion() {
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
    calculateSchemaChecksum(tables, indexes, constraints, triggers) {
        const schemaString = JSON.stringify({
            tables: tables.sort((a, b) => a.name.localeCompare(b.name)),
            indexes: indexes.sort((a, b) => a.name.localeCompare(b.name)),
            constraints: constraints.sort((a, b) => a.name.localeCompare(b.name)),
            triggers: triggers.sort((a, b) => a.name.localeCompare(b.name))
        });
        return crypto_1.default.createHash('sha256').update(schemaString).digest('hex');
    }
    async generateTargetSchema(targetMVP) {
        const mvpDef = this.mvpSchemaDefinitions.get(targetMVP);
        if (!mvpDef) {
            throw new Error(`MVP ${targetMVP} schema definition not found`);
        }
        const allTables = [];
        const allIndexes = [];
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
            checksum: this.calculateSchemaChecksum(allTables, allIndexes, [], [])
        };
    }
    async calculateEvolutionSteps(currentSchema, targetSchema) {
        const steps = [];
        const diff = this.calculateSchemaDiff(currentSchema, targetSchema);
        let stepNumber = 1;
        for (const tableName of diff.tablesAdded) {
            const tableDefÂ = targetSchema.tables.find(t => t.name === tableName);
            if (tableDef) {
                steps.push({
                    step: stepNumber++,
                    description: `Create table ${tableName}`,
                    sql: this.generateCreateTableSql(tableDef),
                    reversible: true,
                    estimatedDuration: 30,
                    dataImpact: 'none',
                    dependencies: []
                });
            }
        }
        for (const indexName of diff.indexesAdded) {
            const indexDef = targetSchema.indexes.find(i => i.name === indexName);
            if (indexDef) {
                steps.push({
                    step: stepNumber++,
                    description: `Create index ${indexName}`,
                    sql: indexDef.sql,
                    reversible: true,
                    estimatedDuration: 60,
                    dataImpact: 'minimal',
                    dependencies: []
                });
            }
        }
        return steps;
    }
    generateCompatibilityMatrix(currentMVP, targetMVP) {
        const versions = Array.from({ length: targetMVP - currentMVP + 1 }, (_, i) => currentMVP + i);
        const compatibility = {};
        for (const fromVersion of versions) {
            compatibility[fromVersion] = {};
            for (const toVersion of versions) {
                if (fromVersion === toVersion) {
                    compatibility[fromVersion][toVersion] = 'compatible';
                }
                else if (toVersion > fromVersion) {
                    compatibility[fromVersion][toVersion] = toVersion - fromVersion <= 1 ? 'compatible' : 'degraded';
                }
                else {
                    compatibility[fromVersion][toVersion] = 'incompatible';
                }
            }
        }
        return { versions, compatibility };
    }
    assessEvolutionRisk(steps) {
        const riskFactors = [];
        let overallRiskScore = 0;
        for (const step of steps) {
            if (step.sql.includes('DROP TABLE')) {
                riskFactors.push({
                    factor: 'Table deletion detected',
                    severity: 'high',
                    impact: 'Permanent data loss possible',
                    mitigation: 'Ensure complete backup before proceeding'
                });
                overallRiskScore += 10;
            }
            if (step.sql.includes('ALTER TABLE') && step.sql.includes('DROP COLUMN')) {
                riskFactors.push({
                    factor: 'Column deletion detected',
                    severity: 'medium',
                    impact: 'Data loss in specific columns',
                    mitigation: 'Backup affected data separately'
                });
                overallRiskScore += 5;
            }
            if (step.dataImpact === 'significant') {
                overallRiskScore += 3;
            }
        }
        let overallRisk;
        if (overallRiskScore >= 15)
            overallRisk = 'critical';
        else if (overallRiskScore >= 10)
            overallRisk = 'high';
        else if (overallRiskScore >= 5)
            overallRisk = 'medium';
        else
            overallRisk = 'low';
        return {
            overallRisk,
            riskFactors,
            recommendations: this.generateRiskRecommendations(overallRisk, riskFactors)
        };
    }
    generateRiskRecommendations(risk, factors) {
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
    extractTableFromIndexSql(sql) {
        const match = sql?.match(/ON\s+(\w+)\s*\(/i);
        return match ? match[1] : '';
    }
    extractColumnsFromIndexSql(sql) {
        const match = sql?.match(/\(([^)]+)\)/);
        return match ? match[1].split(',').map(col => col.trim()) : [];
    }
    extractTableFromTriggerSql(sql) {
        const match = sql?.match(/ON\s+(\w+)/i);
        return match ? match[1] : '';
    }
    extractEventFromTriggerSql(sql) {
        const match = sql?.match(/(BEFORE|AFTER)\s+(INSERT|UPDATE|DELETE)/i);
        return match ? `${match[1]} ${match[2]}` : '';
    }
    generateCreateTableSql(tableDef) {
        let sql = `CREATE TABLE ${tableDef.name} (\n`;
        const columnDefs = tableDef.columns.map(col => {
            let colDef = `  ${col.name} ${col.type}`;
            if (!col.nullable)
                colDef += ' NOT NULL';
            if (col.defaultValue)
                colDef += ` DEFAULT ${col.defaultValue}`;
            if (col.primaryKey)
                colDef += ' PRIMARY KEY';
            return colDef;
        });
        sql += columnDefs.join(',\n');
        if (tableDef.foreignKeys && tableDef.foreignKeys.length > 0) {
            const fkDefs = tableDef.foreignKeys.map(fk => `  FOREIGN KEY (${fk.column}) REFERENCES ${fk.references}`);
            sql += ',\n' + fkDefs.join(',\n');
        }
        sql += '\n)';
        return sql;
    }
    emit(event, data) {
        console.log(`Schema event: ${event}`, data);
    }
    compareSchemas(schema1, schema2) {
        return [];
    }
    calculateSchemaDiff(schema1, schema2) {
        return {
            tablesAdded: [],
            tablesRemoved: [],
            tablesModified: [],
            indexesAdded: [],
            indexesRemoved: [],
            constraintsChanged: []
        };
    }
    getSchemaAtVersion(version) {
        return this.captureCurrentSchema();
    }
    getRecentChanges() {
        return [];
    }
    async validateTableStructures() {
        return [];
    }
    async validateReferentialIntegrity() {
        return [];
    }
    async validateIndexIntegrity() {
        return [];
    }
    async gatherSchemaStatistics() {
        return {
            totalTables: 0,
            totalIndexes: 0,
            totalConstraints: 0,
            orphanedRecords: 0,
            integrityViolations: 0
        };
    }
    generateBackupId() {
        return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    async restoreSchemaStructure(schema) {
    }
}
exports.SchemaEvolution = SchemaEvolution;
//# sourceMappingURL=SchemaEvolution.js.map