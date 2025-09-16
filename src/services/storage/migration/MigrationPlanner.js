"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MigrationPlanner = void 0;
const tslib_1 = require("tslib");
const fs_1 = tslib_1.__importDefault(require("fs"));
const path_1 = tslib_1.__importDefault(require("path"));
class MigrationPlanner {
    db;
    migrationsPath;
    mvpDefinitions = new Map();
    constructor(db, migrationsPath) {
        this.db = db;
        this.migrationsPath = migrationsPath;
        this.initializeMVPDefinitions();
    }
    async createComprehensiveMigrationPlan(targetMVP) {
        const currentVersion = this.getCurrentVersion();
        const currentMVP = this.detectCurrentMVP(currentVersion);
        if (targetMVP <= currentMVP) {
            throw new Error(`Target MVP ${targetMVP} must be greater than current MVP ${currentMVP}`);
        }
        const migrationPath = this.calculateOptimalMigrationPath(currentMVP, targetMVP);
        const migrations = await this.loadMigrationsForPath(migrationPath);
        const phases = this.organizeMigrationsIntoPhases(migrations, migrationPath);
        const plan = {
            id: this.generatePlanId(),
            currentVersion,
            targetVersion: Math.max(...migrations.map(m => m.version)),
            currentMVP,
            targetMVP,
            migrations,
            phases,
            estimatedDuration: this.calculateTotalEstimatedDuration(phases),
            riskLevel: this.assessOverallRiskLevel(migrations, migrationPath),
            requiresDowntime: this.assessDowntimeRequirement(migrations),
            dataBackupRequired: this.assessBackupRequirement(migrations),
            rollbackStrategy: this.selectRollbackStrategy(migrationPath),
            prerequisites: this.generatePrerequisites(migrationPath),
            postMigrationTasks: this.generatePostMigrationTasks(targetMVP),
            validationChecks: this.generateValidationChecks(migrations, targetMVP)
        };
        await this.validateMigrationPlan(plan);
        return plan;
    }
    async getMigrationsForMVPUpgrade(fromMVP, toMVP) {
        const migrationPath = this.calculateOptimalMigrationPath(fromMVP, toMVP);
        return await this.loadMigrationsForPath(migrationPath);
    }
    async analyzeMigrationPaths(targetMVP) {
        const currentMVP = this.detectCurrentMVP(this.getCurrentVersion());
        const allPaths = this.generateAllPossiblePaths(currentMVP, targetMVP);
        const pathAnalyses = await Promise.all(allPaths.map(path => this.analyzeSinglePath(path)));
        const recommendedPath = this.selectRecommendedPath(pathAnalyses);
        return {
            recommendedPath: recommendedPath.path,
            alternativePaths: allPaths.filter(p => p !== recommendedPath.path),
            pathAnalysis: pathAnalyses
        };
    }
    async createEmergencyRollbackPlan(fromVersion) {
        const appliedMigrations = this.getAppliedMigrationsSince(fromVersion);
        return {
            rollbackSteps: this.generateRollbackSteps(appliedMigrations),
            dataRecoverySteps: this.generateDataRecoverySteps(appliedMigrations),
            validationSteps: this.generateRollbackValidationSteps(appliedMigrations),
            emergencyContacts: this.getEmergencyContacts()
        };
    }
    async estimateResourceRequirements(plan) {
        const currentDbSize = this.getDatabaseSize();
        const migrationComplexity = this.calculateMigrationComplexity(plan.migrations);
        return {
            storage: {
                additionalSpaceRequired: currentDbSize * 0.2,
                temporarySpaceRequired: currentDbSize * 0.5,
                backupSpaceRequired: currentDbSize * 2
            },
            memory: {
                peakMemoryUsage: Math.max(512 * 1024 * 1024, currentDbSize * 0.1),
                recommendedMemory: Math.max(1024 * 1024 * 1024, currentDbSize * 0.2)
            },
            cpu: {
                estimatedCpuTime: plan.estimatedDuration * 60 * 1000,
                recommendedCores: migrationComplexity > 50 ? 4 : 2
            },
            network: {
                dataTransferRequired: 0,
                estimatedBandwidth: 0
            }
        };
    }
    generateMigrationTimeline(plan) {
        const startTime = new Date();
        let currentTime = new Date(startTime);
        const timeline = [];
        const criticalPath = [];
        timeline.push({
            milestone: 'Pre-migration backup and validation',
            estimatedTime: new Date(currentTime),
            duration: 30,
            phase: 'preparation',
            dependencies: [],
            criticalPath: true
        });
        currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
        for (const phase of plan.phases) {
            timeline.push({
                milestone: `Phase: ${phase.name}`,
                estimatedTime: new Date(currentTime),
                duration: phase.estimatedDuration,
                phase: phase.name,
                dependencies: phase.dependencies,
                criticalPath: phase.rollbackPoint
            });
            if (phase.rollbackPoint) {
                criticalPath.push(phase.name);
            }
            currentTime = new Date(currentTime.getTime() + phase.estimatedDuration * 60 * 1000);
        }
        timeline.push({
            milestone: 'Post-migration validation and cleanup',
            estimatedTime: new Date(currentTime),
            duration: 15,
            phase: 'validation',
            dependencies: ['all_migrations'],
            criticalPath: true
        });
        return {
            timeline,
            criticalPath,
            bufferTime: plan.estimatedDuration * 0.2,
            contingencyPlan: [
                'Immediate rollback if critical validation fails',
                'Emergency data recovery procedures',
                'Escalation to technical lead if rollback fails'
            ]
        };
    }
    initializeMVPDefinitions() {
        this.mvpDefinitions.set(1, {
            version: 1,
            name: 'Knowledge Base Assistant',
            features: ['basic_kb', 'search', 'gemini_integration'],
            requiredTables: ['kb_entries', 'kb_tags', 'search_history'],
            schemaVersion: 10
        });
        this.mvpDefinitions.set(2, {
            version: 2,
            name: 'Pattern Detection & Enrichment',
            features: ['incident_import', 'pattern_detection', 'alerts'],
            requiredTables: ['incidents', 'patterns', 'alerts'],
            schemaVersion: 20
        });
        this.mvpDefinitions.set(3, {
            version: 3,
            name: 'Code Analysis Integration',
            features: ['cobol_parsing', 'kb_code_linking', 'guided_debugging'],
            requiredTables: ['code_files', 'kb_code_links', 'code_analysis'],
            schemaVersion: 30
        });
        this.mvpDefinitions.set(4, {
            version: 4,
            name: 'IDZ Integration & Templates',
            features: ['idz_import', 'templates', 'workspace_management'],
            requiredTables: ['projects', 'templates', 'workspaces'],
            schemaVersion: 40
        });
        this.mvpDefinitions.set(5, {
            version: 5,
            name: 'Enterprise Intelligence Platform',
            features: ['auto_resolution', 'predictive_analytics', 'enterprise_features'],
            requiredTables: ['ml_models', 'auto_resolutions', 'analytics'],
            schemaVersion: 50
        });
    }
    getCurrentVersion() {
        try {
            const result = this.db.prepare(`
        SELECT COALESCE(MAX(version), 0) as version 
        FROM schema_migrations
      `).get();
            return result.version;
        }
        catch {
            return 0;
        }
    }
    detectCurrentMVP(version) {
        if (version >= 50)
            return 5;
        if (version >= 40)
            return 4;
        if (version >= 30)
            return 3;
        if (version >= 20)
            return 2;
        if (version >= 10)
            return 1;
        return 0;
    }
    calculateOptimalMigrationPath(fromMVP, toMVP) {
        const intermediateSteps = [];
        for (let mvp = fromMVP + 1; mvp <= toMVP; mvp++) {
            intermediateSteps.push(mvp);
        }
        return {
            from: fromMVP,
            to: toMVP,
            intermediateSteps,
            criticalPath: true,
            alternativeRoutes: []
        };
    }
    async loadMigrationsForPath(path) {
        const migrations = [];
        for (const mvp of path.intermediateSteps) {
            const mvpMigrations = await this.loadMigrationsForMVP(mvp);
            migrations.push(...mvpMigrations);
        }
        return migrations.sort((a, b) => a.version - b.version);
    }
    async loadMigrationsForMVP(mvp) {
        const mvpPath = path_1.default.join(this.migrationsPath, `mvp${mvp}`);
        const migrations = [];
        if (!fs_1.default.existsSync(mvpPath)) {
            return migrations;
        }
        const files = fs_1.default.readdirSync(mvpPath)
            .filter(file => file.endsWith('.sql'))
            .sort();
        for (const file of files) {
            const match = file.match(/^(\d+)_(.+)\.sql$/);
            if (!match)
                continue;
            const version = parseInt(match[1]);
            const description = match[2].replace(/_/g, ' ');
            const filePath = path_1.default.join(mvpPath, file);
            const content = fs_1.default.readFileSync(filePath, 'utf8');
            const sections = content.split('-- DOWN');
            const up = sections[0].replace(/^-- UP\s*\n?/m, '').trim();
            const down = sections[1]?.trim() || '';
            migrations.push({
                version,
                description,
                up,
                down
            });
        }
        return migrations;
    }
    organizeMigrationsIntoPhases(migrations, path) {
        const phases = [];
        for (const mvp of path.intermediateSteps) {
            const mvpMigrations = migrations.filter(m => this.getMVPForVersion(m.version) === mvp);
            if (mvpMigrations.length > 0) {
                const mvpDef = this.mvpDefinitions.get(mvp);
                phases.push({
                    name: `MVP${mvp} Upgrade`,
                    description: mvpDef?.name || `Upgrade to MVP ${mvp}`,
                    migrations: mvpMigrations.map(m => m.version),
                    estimatedDuration: this.estimatePhaseDuration(mvpMigrations),
                    canRunInParallel: false,
                    dependencies: mvp > 1 ? [`MVP${mvp - 1} Upgrade`] : [],
                    rollbackPoint: true
                });
            }
        }
        return phases;
    }
    getMVPForVersion(version) {
        return Math.floor(version / 10);
    }
    estimatePhaseDuration(migrations) {
        let duration = 0;
        for (const migration of migrations) {
            duration += 2;
            const lines = migration.up.split('\n').length;
            if (lines > 50)
                duration += 3;
            if (lines > 100)
                duration += 5;
            if (migration.up.includes('CREATE TABLE'))
                duration += 1;
            if (migration.up.includes('CREATE INDEX'))
                duration += 2;
            if (migration.up.includes('INSERT INTO'))
                duration += 3;
        }
        return duration;
    }
    calculateTotalEstimatedDuration(phases) {
        return phases.reduce((total, phase) => total + phase.estimatedDuration, 0);
    }
    assessOverallRiskLevel(migrations, path) {
        let riskScore = 0;
        riskScore += (path.to - path.from) * 2;
        for (const migration of migrations) {
            if (migration.up.includes('DROP TABLE'))
                riskScore += 10;
            if (migration.up.includes('DROP COLUMN'))
                riskScore += 8;
            if (migration.up.includes('DELETE FROM'))
                riskScore += 6;
            if (migration.description.toLowerCase().includes('breaking'))
                riskScore += 8;
        }
        if (riskScore >= 25)
            return 'critical';
        if (riskScore >= 15)
            return 'high';
        if (riskScore >= 8)
            return 'medium';
        return 'low';
    }
    assessDowntimeRequirement(migrations) {
        return migrations.some(m => m.up.includes('DROP TABLE') ||
            m.up.includes('ALTER TABLE') && m.up.includes('DROP') ||
            m.description.toLowerCase().includes('breaking'));
    }
    assessBackupRequirement(migrations) {
        return true;
    }
    selectRollbackStrategy(path) {
        if (path.to - path.from === 1) {
            return 'single_mvp_rollback';
        }
        else if (path.to - path.from <= 2) {
            return 'staged_rollback';
        }
        else {
            return 'full_restore_from_backup';
        }
    }
    generatePrerequisites(path) {
        const prerequisites = [
            'Database backup completed and verified',
            'Sufficient disk space available',
            'Application shutdown during migration window'
        ];
        if (path.to >= 4) {
            prerequisites.push('IDZ environment configured');
        }
        if (path.to >= 5) {
            prerequisites.push('Enterprise authentication configured');
            prerequisites.push('ML model storage prepared');
        }
        return prerequisites;
    }
    generatePostMigrationTasks(targetMVP) {
        const tasks = [
            'Verify all migrations applied successfully',
            'Run data integrity checks',
            'Test core application functionality'
        ];
        if (targetMVP >= 2) {
            tasks.push('Verify pattern detection engine');
        }
        if (targetMVP >= 3) {
            tasks.push('Test code analysis integration');
        }
        if (targetMVP >= 4) {
            tasks.push('Verify IDZ import/export functionality');
        }
        if (targetMVP >= 5) {
            tasks.push('Test auto-resolution system');
            tasks.push('Verify enterprise security features');
        }
        return tasks;
    }
    generateValidationChecks(migrations, targetMVP) {
        const checks = [
            {
                type: 'schema',
                description: 'Verify all required tables exist',
                critical: true,
                query: 'SELECT name FROM sqlite_master WHERE type="table" ORDER BY name'
            },
            {
                type: 'data',
                description: 'Verify data integrity',
                critical: true
            }
        ];
        const mvpDef = this.mvpDefinitions.get(targetMVP);
        if (mvpDef) {
            for (const table of mvpDef.requiredTables) {
                checks.push({
                    type: 'schema',
                    description: `Verify ${table} table exists`,
                    critical: true,
                    query: `SELECT name FROM sqlite_master WHERE type="table" AND name="${table}"`
                });
            }
        }
        return checks;
    }
    async validateMigrationPlan(plan) {
        const versions = plan.migrations.map(m => m.version).sort((a, b) => a - b);
        for (let i = 1; i < versions.length; i++) {
            if (versions[i] <= versions[i - 1]) {
                throw new Error(`Invalid migration sequence: ${versions[i - 1]} -> ${versions[i]}`);
            }
        }
        if (plan.targetMVP <= plan.currentMVP) {
            throw new Error(`Target MVP ${plan.targetMVP} must be greater than current MVP ${plan.currentMVP}`);
        }
    }
    generateAllPossiblePaths(fromMVP, toMVP) {
        return [this.calculateOptimalMigrationPath(fromMVP, toMVP)];
    }
    async analyzeSinglePath(path) {
        const migrations = await this.loadMigrationsForPath(path);
        return {
            path,
            pros: this.generatePathPros(path),
            cons: this.generatePathCons(path),
            riskLevel: this.assessOverallRiskLevel(migrations, path),
            estimatedDuration: this.estimatePhaseDuration(migrations)
        };
    }
    selectRecommendedPath(analyses) {
        return analyses[0];
    }
    generatePathPros(path) {
        return [
            'Sequential upgrade ensures compatibility',
            'Each MVP builds on previous features',
            'Rollback points at each MVP level'
        ];
    }
    generatePathCons(path) {
        const cons = [];
        if (path.to - path.from > 2) {
            cons.push('Multiple MVP upgrades increase overall risk');
            cons.push('Longer migration window required');
        }
        return cons;
    }
    generatePlanId() {
        return `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    getAppliedMigrationsSince(fromVersion) {
        return this.db.prepare(`
      SELECT * FROM schema_migrations 
      WHERE version > ? 
      ORDER BY version DESC
    `).all(fromVersion);
    }
    generateRollbackSteps(migrations) {
        return migrations.map((m, index) => ({
            step: index + 1,
            description: `Rollback migration ${m.version}: ${m.description}`,
            sql: m.rollback_sql,
            estimatedDuration: 2,
            riskLevel: 'medium'
        }));
    }
    generateDataRecoverySteps(migrations) {
        return [
            'Verify backup integrity before proceeding',
            'Stop all application processes',
            'Restore database from backup',
            'Verify data consistency after restore',
            'Restart application services'
        ];
    }
    generateRollbackValidationSteps(migrations) {
        return [
            'Verify schema version matches expected',
            'Run data integrity checks',
            'Test core application functionality',
            'Verify all features working as expected'
        ];
    }
    getEmergencyContacts() {
        return [
            'Database Administrator: dba@company.com',
            'Technical Lead: lead@company.com',
            'System Administrator: sysadmin@company.com'
        ];
    }
    getDatabaseSize() {
        try {
            const stats = fs_1.default.statSync(this.db.name);
            return stats.size;
        }
        catch {
            return 10 * 1024 * 1024;
        }
    }
    calculateMigrationComplexity(migrations) {
        let complexity = 0;
        for (const migration of migrations) {
            complexity += migration.up.split('\n').length;
            if (migration.up.includes('CREATE TABLE'))
                complexity += 10;
            if (migration.up.includes('CREATE INDEX'))
                complexity += 5;
            if (migration.up.includes('INSERT INTO'))
                complexity += 15;
        }
        return complexity;
    }
}
exports.MigrationPlanner = MigrationPlanner;
//# sourceMappingURL=MigrationPlanner.js.map