# Category and Tag Migration Guide

## Overview

This guide provides step-by-step instructions for migrating existing categorization and tagging data, upgrading between system versions, and implementing new features while preserving data integrity and user workflows.

## Table of Contents

- [Pre-Migration Planning](#pre-migration-planning)
- [Data Assessment](#data-assessment)
- [Migration Strategies](#migration-strategies)
- [Schema Migrations](#schema-migrations)
- [Data Transformation](#data-transformation)
- [Testing Procedures](#testing-procedures)
- [Rollback Plans](#rollback-plans)
- [Post-Migration Tasks](#post-migration-tasks)
- [Common Migration Scenarios](#common-migration-scenarios)

## Pre-Migration Planning

### Migration Checklist

```typescript
interface MigrationPlan {
  assessment: {
    current_version: string;
    target_version: string;
    data_volume: DataVolumeMetrics;
    custom_extensions: string[];
    dependencies: string[];
  };

  timeline: {
    preparation_phase: string;
    migration_window: string;
    validation_phase: string;
    rollback_deadline: string;
  };

  resources: {
    technical_team: string[];
    business_stakeholders: string[];
    backup_systems: string[];
    rollback_procedures: string[];
  };

  risks: {
    data_loss_risk: 'low' | 'medium' | 'high';
    downtime_impact: 'minimal' | 'moderate' | 'significant';
    rollback_complexity: 'simple' | 'moderate' | 'complex';
    mitigation_strategies: string[];
  };
}
```

### Environment Preparation

1. **Backup Strategy**
   ```bash
   # Complete system backup
   mkdir -p backups/pre-migration-$(date +%Y%m%d_%H%M%S)

   # Database backup
   sqlite3 knowledge.db ".backup backups/knowledge-$(date +%Y%m%d_%H%M%S).db"

   # Configuration backup
   cp -r config/ backups/config-$(date +%Y%m%d_%H%M%S)/

   # User data backup
   tar -czf backups/userdata-$(date +%Y%m%d_%H%M%S).tar.gz userdata/
   ```

2. **Development Environment Setup**
   ```bash
   # Clone production data to development environment
   rsync -av --exclude='logs/' production/ development/

   # Test migration on development copy
   cd development
   npm run migration:test
   ```

3. **Dependency Verification**
   ```typescript
   // Check system dependencies
   const dependencyCheck = {
     nodejs: process.version,
     sqlite: await checkSQLiteVersion(),
     diskSpace: await checkDiskSpace(),
     permissions: await checkPermissions(),
     networkAccess: await checkNetworkAccess()
   };

   console.log('Dependency Check:', dependencyCheck);
   ```

## Data Assessment

### Current State Analysis

```typescript
export class MigrationAssessmentTool {
  async assessCurrentState(): Promise<AssessmentReport> {
    const [
      categoryMetrics,
      tagMetrics,
      relationshipMetrics,
      qualityMetrics
    ] = await Promise.all([
      this.analyzeCategoryData(),
      this.analyzeTagData(),
      this.analyzeRelationships(),
      this.assessDataQuality()
    ]);

    return {
      timestamp: new Date(),
      categories: categoryMetrics,
      tags: tagMetrics,
      relationships: relationshipMetrics,
      quality: qualityMetrics,
      recommendations: this.generateRecommendations({
        categoryMetrics,
        tagMetrics,
        relationshipMetrics,
        qualityMetrics
      })
    };
  }

  private async analyzeCategoryData(): Promise<CategoryMetrics> {
    const db = await this.getDatabase();

    const metrics = {
      total_categories: 0,
      active_categories: 0,
      hierarchy_depth: 0,
      orphaned_categories: 0,
      empty_categories: 0,
      duplicate_names: 0
    };

    // Count categories by status
    const counts = db.prepare(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active,
        MAX(level) as max_depth
      FROM categories
    `).get();

    metrics.total_categories = counts.total;
    metrics.active_categories = counts.active;
    metrics.hierarchy_depth = counts.max_depth;

    // Find orphaned categories
    const orphaned = db.prepare(`
      SELECT COUNT(*) as count
      FROM categories c1
      LEFT JOIN categories c2 ON c1.parent_id = c2.id
      WHERE c1.parent_id IS NOT NULL AND c2.id IS NULL
    `).get();

    metrics.orphaned_categories = orphaned.count;

    // Find empty categories
    const empty = db.prepare(`
      SELECT COUNT(*) as count
      FROM categories c
      LEFT JOIN kb_entries e ON c.id = e.category_id
      WHERE e.id IS NULL AND c.level > 0
    `).get();

    metrics.empty_categories = empty.count;

    // Find duplicate names
    const duplicates = db.prepare(`
      SELECT COUNT(*) - COUNT(DISTINCT LOWER(name)) as duplicates
      FROM categories
      WHERE is_active = TRUE
    `).get();

    metrics.duplicate_names = duplicates.duplicates;

    return metrics;
  }

  private async analyzeTagData(): Promise<TagMetrics> {
    const db = await this.getDatabase();

    return {
      total_tags: await this.getTagCount(),
      active_tags: await this.getActiveTagCount(),
      unused_tags: await this.getUnusedTagCount(),
      duplicate_tags: await this.getDuplicateTagCount(),
      average_tags_per_entry: await this.getAverageTagsPerEntry(),
      tag_categories: await this.getTagCategoryDistribution()
    };
  }

  private generateRecommendations(metrics: any): string[] {
    const recommendations: string[] = [];

    if (metrics.categoryMetrics.orphaned_categories > 0) {
      recommendations.push(
        `Fix ${metrics.categoryMetrics.orphaned_categories} orphaned categories before migration`
      );
    }

    if (metrics.categoryMetrics.duplicate_names > 0) {
      recommendations.push(
        `Resolve ${metrics.categoryMetrics.duplicate_names} duplicate category names`
      );
    }

    if (metrics.tagMetrics.unused_tags > 50) {
      recommendations.push(
        `Consider archiving ${metrics.tagMetrics.unused_tags} unused tags to improve performance`
      );
    }

    if (metrics.qualityMetrics.data_integrity_score < 0.8) {
      recommendations.push(
        'Run data integrity fixes before proceeding with migration'
      );
    }

    return recommendations;
  }
}
```

### Data Quality Issues

Common issues to identify before migration:

```typescript
interface DataQualityIssues {
  category_issues: {
    circular_references: CategoryReference[];
    orphaned_categories: string[];
    duplicate_names: DuplicateCategory[];
    invalid_hierarchy: string[];
  };

  tag_issues: {
    duplicate_tags: DuplicateTag[];
    malformed_names: string[];
    unused_tags: string[];
    invalid_associations: string[];
  };

  relationship_issues: {
    broken_associations: string[];
    invalid_parent_child: string[];
    missing_references: string[];
  };
}

export class DataQualityChecker {
  async checkDataQuality(): Promise<DataQualityIssues> {
    const issues: DataQualityIssues = {
      category_issues: {
        circular_references: await this.findCircularReferences(),
        orphaned_categories: await this.findOrphanedCategories(),
        duplicate_names: await this.findDuplicateCategoryNames(),
        invalid_hierarchy: await this.findInvalidHierarchy()
      },
      tag_issues: {
        duplicate_tags: await this.findDuplicateTags(),
        malformed_names: await this.findMalformedTagNames(),
        unused_tags: await this.findUnusedTags(),
        invalid_associations: await this.findInvalidAssociations()
      },
      relationship_issues: {
        broken_associations: await this.findBrokenAssociations(),
        invalid_parent_child: await this.findInvalidParentChild(),
        missing_references: await this.findMissingReferences()
      }
    };

    return issues;
  }

  async fixDataQuality(issues: DataQualityIssues): Promise<FixResult> {
    const fixes: FixResult = {
      categories_fixed: 0,
      tags_fixed: 0,
      associations_fixed: 0,
      errors: []
    };

    try {
      // Fix category issues
      fixes.categories_fixed += await this.fixOrphanedCategories(
        issues.category_issues.orphaned_categories
      );

      fixes.categories_fixed += await this.fixCircularReferences(
        issues.category_issues.circular_references
      );

      // Fix tag issues
      fixes.tags_fixed += await this.mergeDuplicateTags(
        issues.tag_issues.duplicate_tags
      );

      fixes.tags_fixed += await this.fixMalformedTagNames(
        issues.tag_issues.malformed_names
      );

      // Fix association issues
      fixes.associations_fixed += await this.fixBrokenAssociations(
        issues.relationship_issues.broken_associations
      );

    } catch (error) {
      fixes.errors.push(error.message);
    }

    return fixes;
  }
}
```

## Migration Strategies

### Strategy 1: In-Place Migration

Best for: Minor version upgrades, schema changes, small datasets

```typescript
export class InPlaceMigration {
  async execute(fromVersion: string, toVersion: string): Promise<MigrationResult> {
    const migrationSteps = this.getMigrationSteps(fromVersion, toVersion);
    const result: MigrationResult = {
      success: false,
      steps_completed: [],
      errors: [],
      rollback_available: true
    };

    // Create backup before starting
    const backupPath = await this.createBackup();
    result.backup_location = backupPath;

    try {
      for (const step of migrationSteps) {
        console.log(`Executing migration step: ${step.name}`);

        await step.execute();
        result.steps_completed.push({
          name: step.name,
          completed_at: new Date(),
          duration: step.executionTime
        });

        // Verify step completed successfully
        const verification = await step.verify();
        if (!verification.success) {
          throw new Error(`Step ${step.name} verification failed: ${verification.error}`);
        }
      }

      result.success = true;
      result.completed_at = new Date();

    } catch (error) {
      result.errors.push(error.message);

      // Attempt rollback
      const rollback = await this.rollback(backupPath);
      result.rollback_performed = rollback.success;
      result.rollback_errors = rollback.errors;
    }

    return result;
  }

  private getMigrationSteps(fromVersion: string, toVersion: string): MigrationStep[] {
    const allSteps: Record<string, MigrationStep[]> = {
      '1.0_to_1.1': [
        new AddTagColorColumnStep(),
        new UpdateTagIndexesStep(),
        new MigrateTagDisplayNamesStep()
      ],
      '1.1_to_2.0': [
        new CreateCategoryHierarchyStep(),
        new MigrateCategoryDataStep(),
        new UpdateSearchIndexesStep(),
        new CreateAnalyticsTablesStep()
      ]
    };

    const migrationKey = `${fromVersion}_to_${toVersion}`;
    return allSteps[migrationKey] || [];
  }
}
```

### Strategy 2: Parallel Migration

Best for: Major version upgrades, large datasets, high availability requirements

```typescript
export class ParallelMigration {
  async execute(config: ParallelMigrationConfig): Promise<MigrationResult> {
    // Set up parallel environment
    const parallelEnv = await this.setupParallelEnvironment(config);

    // Migrate data to parallel system
    const migrationResult = await this.migrateToParallel(parallelEnv);

    if (!migrationResult.success) {
      await this.cleanupParallelEnvironment(parallelEnv);
      return migrationResult;
    }

    // Sync ongoing changes during migration
    const syncResult = await this.syncOngoingChanges(parallelEnv);

    // Switch traffic to new system
    const switchResult = await this.switchTraffic(parallelEnv);

    // Cleanup old system after verification
    if (switchResult.success) {
      await this.cleanupOldSystem();
    }

    return {
      ...migrationResult,
      traffic_switched: switchResult.success,
      parallel_env_id: parallelEnv.id
    };
  }

  private async setupParallelEnvironment(
    config: ParallelMigrationConfig
  ): Promise<ParallelEnvironment> {
    // Create new database with target schema
    const newDb = await this.createTargetDatabase(config.target_schema);

    // Set up data sync mechanisms
    const syncManager = await this.setupSyncManager(config.source_db, newDb);

    // Deploy new application version
    const appDeployment = await this.deployNewVersion(config.target_version);

    return {
      id: uuidv4(),
      database: newDb,
      sync_manager: syncManager,
      application: appDeployment,
      created_at: new Date()
    };
  }
}
```

## Schema Migrations

### Version 1.0 to 2.0 Migration

```sql
-- Migration Script: v1.0 to v2.0
-- Adds hierarchical categories and enhanced tag features

BEGIN TRANSACTION;

-- Step 1: Add version tracking
CREATE TABLE IF NOT EXISTS schema_version (
  version TEXT PRIMARY KEY,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT
);

-- Step 2: Enhance tags table
ALTER TABLE tags ADD COLUMN display_name TEXT;
ALTER TABLE tags ADD COLUMN description TEXT;
ALTER TABLE tags ADD COLUMN category_id TEXT;
ALTER TABLE tags ADD COLUMN color TEXT;
ALTER TABLE tags ADD COLUMN is_system BOOLEAN DEFAULT FALSE;
ALTER TABLE tags ADD COLUMN is_suggested BOOLEAN DEFAULT FALSE;
ALTER TABLE tags ADD COLUMN usage_count INTEGER DEFAULT 0;
ALTER TABLE tags ADD COLUMN trending_score INTEGER DEFAULT 0;

-- Step 3: Create hierarchical categories
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  parent_id TEXT REFERENCES categories(id),
  level INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  icon TEXT,
  color TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  is_system BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT
);

-- Step 4: Create category hierarchy indexes
CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_level ON categories(level);
CREATE INDEX idx_categories_active ON categories(is_active);
CREATE INDEX idx_categories_slug ON categories(slug);

-- Step 5: Create tag associations table
CREATE TABLE tag_associations (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  relevance_score REAL,
  assigned_by TEXT CHECK(assigned_by IN ('user', 'system', 'ai')),
  confidence REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  FOREIGN KEY (entry_id) REFERENCES kb_entries(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
  UNIQUE(entry_id, tag_id)
);

-- Step 6: Create analytics tables
CREATE TABLE tag_analytics (
  tag_id TEXT PRIMARY KEY,
  usage_count INTEGER DEFAULT 0,
  entry_count INTEGER DEFAULT 0,
  success_rate REAL DEFAULT 0,
  avg_relevance REAL DEFAULT 0,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE category_analytics (
  category_id TEXT PRIMARY KEY,
  entry_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  search_count INTEGER DEFAULT 0,
  success_rate REAL DEFAULT 0,
  avg_resolution_time INTEGER,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- Step 7: Enhanced full-text search
DROP TABLE IF EXISTS tags_fts;
CREATE VIRTUAL TABLE tags_fts USING fts5(
  id UNINDEXED,
  name,
  display_name,
  description,
  content=tags,
  content_rowid=rowid
);

-- Step 8: Migrate existing data
-- Update display names for existing tags
UPDATE tags
SET display_name = CASE
  WHEN name LIKE '%-%' THEN
    REPLACE(
      REPLACE(UPPER(SUBSTR(name, 1, 1)) || SUBSTR(name, 2), '-', ' '),
      '_', ' '
    )
  ELSE
    UPPER(SUBSTR(name, 1, 1)) || SUBSTR(name, 2)
END
WHERE display_name IS NULL;

-- Create default categories
INSERT INTO categories (id, name, slug, description, level, sort_order, is_system) VALUES
('cat-jcl', 'JCL', 'jcl', 'Job Control Language', 0, 1, TRUE),
('cat-vsam', 'VSAM', 'vsam', 'Virtual Storage Access Method', 0, 2, TRUE),
('cat-db2', 'DB2', 'db2', 'Database Management', 0, 3, TRUE),
('cat-batch', 'Batch', 'batch', 'Batch Processing', 0, 4, TRUE),
('cat-cobol', 'COBOL', 'cobol', 'COBOL Programming', 0, 5, TRUE),
('cat-system', 'System', 'system', 'System-related issues', 0, 6, TRUE);

-- Assign tags to categories based on naming patterns
UPDATE tags SET category_id = 'cat-jcl'
WHERE LOWER(name) LIKE '%jcl%' OR LOWER(name) LIKE '%job%' OR LOWER(name) LIKE '%dd%';

UPDATE tags SET category_id = 'cat-vsam'
WHERE LOWER(name) LIKE '%vsam%' OR LOWER(name) LIKE '%ksds%' OR LOWER(name) LIKE '%esds%';

UPDATE tags SET category_id = 'cat-db2'
WHERE LOWER(name) LIKE '%db2%' OR LOWER(name) LIKE '%sql%' OR LOWER(name) LIKE '%table%';

UPDATE tags SET category_id = 'cat-batch'
WHERE LOWER(name) LIKE '%batch%' OR LOWER(name) LIKE '%abend%' OR LOWER(name) LIKE '%s0c%';

UPDATE tags SET category_id = 'cat-cobol'
WHERE LOWER(name) LIKE '%cobol%' OR LOWER(name) LIKE '%cbl%' OR LOWER(name) LIKE '%compile%';

-- Remaining tags go to system category
UPDATE tags SET category_id = 'cat-system' WHERE category_id IS NULL;

-- Step 9: Populate FTS index
INSERT INTO tags_fts(id, name, display_name, description)
SELECT id, name, display_name, description FROM tags;

-- Step 10: Update schema version
INSERT INTO schema_version (version, notes) VALUES
('2.0.0', 'Added hierarchical categories, enhanced tags, and analytics tables');

COMMIT;

-- Verify migration
PRAGMA integrity_check;
```

### Migration Verification

```typescript
export class MigrationVerifier {
  async verifyMigration(fromVersion: string, toVersion: string): Promise<VerificationResult> {
    const checks = [
      () => this.verifySchemaIntegrity(),
      () => this.verifyDataIntegrity(),
      () => this.verifyIndexes(),
      () => this.verifyFunctionality(),
      () => this.verifyPerformance()
    ];

    const results = await Promise.all(
      checks.map(async check => {
        try {
          return await check();
        } catch (error) {
          return {
            passed: false,
            error: error.message,
            check: check.name
          };
        }
      })
    );

    const failures = results.filter(r => !r.passed);

    return {
      overall_success: failures.length === 0,
      checks_passed: results.length - failures.length,
      total_checks: results.length,
      failures: failures,
      verification_time: new Date()
    };
  }

  private async verifySchemaIntegrity(): Promise<CheckResult> {
    const db = await this.getDatabase();

    // Check all required tables exist
    const requiredTables = [
      'categories', 'tags', 'tag_associations',
      'tag_analytics', 'category_analytics', 'tags_fts'
    ];

    const existingTables = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name IN (${requiredTables.map(() => '?').join(',')})
    `).all(...requiredTables);

    if (existingTables.length !== requiredTables.length) {
      const missing = requiredTables.filter(table =>
        !existingTables.some(existing => existing.name === table)
      );

      return {
        passed: false,
        error: `Missing tables: ${missing.join(', ')}`
      };
    }

    // Check foreign key constraints
    const fkCheck = db.prepare('PRAGMA foreign_key_check').all();
    if (fkCheck.length > 0) {
      return {
        passed: false,
        error: `Foreign key constraint violations: ${fkCheck.length}`
      };
    }

    return { passed: true };
  }

  private async verifyDataIntegrity(): Promise<CheckResult> {
    const db = await this.getDatabase();

    // Check for orphaned records
    const orphanedCategories = db.prepare(`
      SELECT COUNT(*) as count
      FROM categories c1
      LEFT JOIN categories c2 ON c1.parent_id = c2.id
      WHERE c1.parent_id IS NOT NULL AND c2.id IS NULL
    `).get();

    if (orphanedCategories.count > 0) {
      return {
        passed: false,
        error: `Found ${orphanedCategories.count} orphaned categories`
      };
    }

    // Check tag associations integrity
    const invalidAssociations = db.prepare(`
      SELECT COUNT(*) as count
      FROM tag_associations ta
      LEFT JOIN tags t ON ta.tag_id = t.id
      LEFT JOIN kb_entries e ON ta.entry_id = e.id
      WHERE t.id IS NULL OR e.id IS NULL
    `).get();

    if (invalidAssociations.count > 0) {
      return {
        passed: false,
        error: `Found ${invalidAssociations.count} invalid tag associations`
      };
    }

    return { passed: true };
  }
}
```

## Data Transformation

### Tag Data Migration

```typescript
export class TagDataTransformer {
  async transformV1ToV2(tags: TagV1[]): Promise<TagV2[]> {
    const transformed: TagV2[] = [];

    for (const oldTag of tags) {
      const newTag: TagV2 = {
        ...oldTag,
        display_name: this.generateDisplayName(oldTag.name),
        description: await this.generateDescription(oldTag.name),
        category_id: await this.inferCategory(oldTag.name),
        color: this.assignColor(oldTag.name),
        is_system: this.isSystemTag(oldTag.name),
        is_suggested: false,
        usage_count: await this.calculateUsageCount(oldTag.id),
        trending_score: 0
      };

      transformed.push(newTag);
    }

    return transformed;
  }

  private generateDisplayName(tagName: string): string {
    return tagName
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private async inferCategory(tagName: string): Promise<string> {
    const categoryPatterns = {
      'cat-jcl': /^(jcl|job|exec|dd|proc)/i,
      'cat-vsam': /^(vsam|ksds|esds|rrds)/i,
      'cat-db2': /^(db2|sql|table|index)/i,
      'cat-batch': /^(batch|abend|s0c|u\d+)/i,
      'cat-cobol': /^(cobol|cbl|compile)/i
    };

    for (const [categoryId, pattern] of Object.entries(categoryPatterns)) {
      if (pattern.test(tagName)) {
        return categoryId;
      }
    }

    return 'cat-system'; // Default category
  }

  private assignColor(tagName: string): string {
    const colorMap: Record<string, string> = {
      error: '#e74c3c',
      warning: '#f39c12',
      info: '#3498db',
      success: '#27ae60',
      critical: '#c0392b',
      performance: '#9b59b6'
    };

    for (const [keyword, color] of Object.entries(colorMap)) {
      if (tagName.toLowerCase().includes(keyword)) {
        return color;
      }
    }

    // Generate color based on tag name hash
    const hash = this.hashString(tagName);
    const hue = hash % 360;
    return `hsl(${hue}, 60%, 45%)`;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}
```

### Category Structure Migration

```typescript
export class CategoryStructureMigrator {
  async migrateToHierarchical(
    flatCategories: FlatCategory[]
  ): Promise<HierarchicalCategory[]> {
    // Analyze existing category names for hierarchical patterns
    const hierarchyMap = this.analyzeHierarchyPatterns(flatCategories);

    // Create root categories
    const rootCategories = this.createRootCategories(hierarchyMap);

    // Organize subcategories
    const organizedCategories = this.organizeSubcategories(
      flatCategories,
      hierarchyMap,
      rootCategories
    );

    // Validate hierarchy
    const validatedHierarchy = this.validateHierarchy(organizedCategories);

    return validatedHierarchy;
  }

  private analyzeHierarchyPatterns(categories: FlatCategory[]): HierarchyMap {
    const patterns: HierarchyMap = new Map();

    categories.forEach(category => {
      const parts = category.name.split(/[\/\->\|]/).map(p => p.trim());

      if (parts.length > 1) {
        const parent = parts[0];
        const child = parts.slice(1).join(' - ');

        if (!patterns.has(parent)) {
          patterns.set(parent, []);
        }
        patterns.get(parent)!.push({
          name: child,
          originalCategory: category
        });
      } else {
        // Standalone category - check if it should be a root
        const isRoot = this.isLikelyRootCategory(category.name);
        if (isRoot) {
          patterns.set(category.name, []);
        }
      }
    });

    return patterns;
  }

  private isLikelyRootCategory(name: string): boolean {
    const rootIndicators = [
      'jcl', 'vsam', 'db2', 'cobol', 'batch', 'cics', 'ims',
      'system', 'error', 'performance', 'security', 'network'
    ];

    return rootIndicators.some(indicator =>
      name.toLowerCase().includes(indicator)
    );
  }

  private createRootCategories(hierarchyMap: HierarchyMap): HierarchicalCategory[] {
    const roots: HierarchicalCategory[] = [];
    let sortOrder = 0;

    for (const [rootName] of hierarchyMap) {
      roots.push({
        id: uuidv4(),
        name: rootName,
        slug: this.generateSlug(rootName),
        description: `${rootName} related categories and content`,
        parent_id: null,
        level: 0,
        sort_order: sortOrder++,
        is_active: true,
        is_system: true,
        children: []
      });
    }

    return roots;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
```

## Testing Procedures

### Migration Testing Framework

```typescript
export class MigrationTestSuite {
  async runFullTestSuite(migrationPlan: MigrationPlan): Promise<TestResults> {
    const results: TestResults = {
      pre_migration_tests: await this.runPreMigrationTests(),
      migration_simulation: await this.simulateMigration(migrationPlan),
      data_validation: await this.validateMigratedData(),
      performance_tests: await this.runPerformanceTests(),
      rollback_tests: await this.testRollbackProcedure(),
      user_acceptance: await this.runUserAcceptanceTests()
    };

    results.overall_success = Object.values(results).every(test => test.success);

    return results;
  }

  private async simulateMigration(plan: MigrationPlan): Promise<TestResult> {
    // Create test copy of production data
    const testDb = await this.createTestDatabase();

    try {
      // Run migration on test data
      const migrator = new InPlaceMigration();
      const result = await migrator.execute(
        plan.assessment.current_version,
        plan.assessment.target_version
      );

      if (!result.success) {
        return {
          success: false,
          errors: result.errors,
          message: 'Migration simulation failed'
        };
      }

      // Verify test data integrity
      const verification = await this.verifyTestData(testDb);

      return {
        success: verification.passed,
        duration: result.total_time,
        message: verification.passed
          ? 'Migration simulation successful'
          : 'Data integrity issues found',
        details: verification.details
      };

    } finally {
      await this.cleanupTestDatabase(testDb);
    }
  }

  private async runPerformanceTests(): Promise<TestResult> {
    const tests = [
      () => this.testTagSearchPerformance(),
      () => this.testCategoryTreePerformance(),
      () => this.testBulkOperationsPerformance(),
      () => this.testAnalyticsPerformance()
    ];

    const results = await Promise.all(
      tests.map(async test => {
        const start = performance.now();
        const result = await test();
        return {
          ...result,
          duration: performance.now() - start
        };
      })
    );

    const failures = results.filter(r => !r.success);

    return {
      success: failures.length === 0,
      message: failures.length === 0
        ? 'All performance tests passed'
        : `${failures.length} performance tests failed`,
      details: results
    };
  }

  private async testTagSearchPerformance(): Promise<PerformanceTestResult> {
    const searchQueries = [
      'error',
      'vsam status',
      'jcl syntax',
      'db2 deadlock',
      'cobol compile'
    ];

    const results = await Promise.all(
      searchQueries.map(async query => {
        const start = performance.now();
        const searchResults = await TagService.search(query);
        const duration = performance.now() - start;

        return {
          query,
          duration,
          results_count: searchResults.length,
          passed: duration < 1000 // Should complete in under 1 second
        };
      })
    );

    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    const slowQueries = results.filter(r => !r.passed);

    return {
      success: slowQueries.length === 0,
      average_duration: avgDuration,
      slow_queries: slowQueries,
      message: slowQueries.length === 0
        ? `Tag search performance acceptable (avg: ${avgDuration.toFixed(2)}ms)`
        : `${slowQueries.length} queries exceeded 1s threshold`
    };
  }
}
```

## Rollback Plans

### Automatic Rollback System

```typescript
export class MigrationRollbackManager {
  async createRollbackPlan(migrationPlan: MigrationPlan): Promise<RollbackPlan> {
    const rollbackSteps = this.generateRollbackSteps(migrationPlan);

    return {
      id: uuidv4(),
      migration_id: migrationPlan.id,
      created_at: new Date(),
      rollback_steps: rollbackSteps,
      validation_checks: this.generateValidationChecks(),
      time_limit: this.calculateRollbackTimeLimit(migrationPlan),
      automation_level: this.determineAutomationLevel(migrationPlan)
    };
  }

  async executeRollback(rollbackPlan: RollbackPlan): Promise<RollbackResult> {
    const result: RollbackResult = {
      success: false,
      steps_completed: [],
      errors: [],
      data_recovered: false,
      service_restored: false
    };

    try {
      // Stop application services
      await this.stopServices();

      // Execute rollback steps in reverse order
      for (const step of rollbackPlan.rollback_steps.reverse()) {
        console.log(`Executing rollback step: ${step.name}`);

        const stepResult = await this.executeRollbackStep(step);
        result.steps_completed.push(stepResult);

        if (!stepResult.success) {
          throw new Error(`Rollback step failed: ${step.name}`);
        }
      }

      // Validate data integrity
      const validation = await this.validateRollbackData();
      result.data_recovered = validation.success;

      if (!validation.success) {
        throw new Error('Data validation failed after rollback');
      }

      // Restart services
      await this.startServices();
      result.service_restored = true;

      result.success = true;
      result.completed_at = new Date();

    } catch (error) {
      result.errors.push(error.message);

      // If rollback fails, we need manual intervention
      await this.escalateToManualRecovery(error);
    }

    return result;
  }

  private generateRollbackSteps(migrationPlan: MigrationPlan): RollbackStep[] {
    const steps: RollbackStep[] = [];

    // Database rollback
    steps.push({
      id: uuidv4(),
      name: 'restore_database',
      description: 'Restore database from pre-migration backup',
      type: 'database',
      execute: async () => {
        await this.restoreDatabase(migrationPlan.backup_path);
      },
      verify: async () => {
        return await this.verifyDatabaseIntegrity();
      }
    });

    // Configuration rollback
    steps.push({
      id: uuidv4(),
      name: 'restore_configuration',
      description: 'Restore application configuration files',
      type: 'configuration',
      execute: async () => {
        await this.restoreConfiguration(migrationPlan.config_backup_path);
      },
      verify: async () => {
        return await this.verifyConfiguration();
      }
    });

    // Index rebuilding
    steps.push({
      id: uuidv4(),
      name: 'rebuild_indexes',
      description: 'Rebuild search indexes',
      type: 'index',
      execute: async () => {
        await this.rebuildSearchIndexes();
      },
      verify: async () => {
        return await this.verifySearchFunctionality();
      }
    });

    return steps;
  }

  private async executeRollbackStep(step: RollbackStep): Promise<StepResult> {
    const start = Date.now();

    try {
      await step.execute();

      const verification = await step.verify();

      return {
        step_id: step.id,
        name: step.name,
        success: verification.success,
        duration: Date.now() - start,
        message: verification.success
          ? 'Step completed successfully'
          : `Verification failed: ${verification.error}`
      };
    } catch (error) {
      return {
        step_id: step.id,
        name: step.name,
        success: false,
        duration: Date.now() - start,
        error: error.message
      };
    }
  }
}
```

## Post-Migration Tasks

### Data Validation and Optimization

```typescript
export class PostMigrationManager {
  async executePostMigrationTasks(): Promise<PostMigrationReport> {
    const tasks = [
      () => this.validateDataIntegrity(),
      () => this.optimizePerformance(),
      () => this.updateAnalytics(),
      () => this.cleanupTempData(),
      () => this.notifyStakeholders(),
      () => this.scheduleMonitoring()
    ];

    const results: TaskResult[] = [];

    for (const task of tasks) {
      try {
        const result = await task();
        results.push({
          name: task.name,
          success: true,
          result: result,
          completed_at: new Date()
        });
      } catch (error) {
        results.push({
          name: task.name,
          success: false,
          error: error.message,
          completed_at: new Date()
        });
      }
    }

    return {
      migration_completed_at: new Date(),
      tasks_executed: results.length,
      tasks_successful: results.filter(r => r.success).length,
      task_results: results,
      next_steps: this.generateNextSteps(results)
    };
  }

  private async optimizePerformance(): Promise<OptimizationResult> {
    // Rebuild all indexes for optimal performance
    await this.rebuildOptimizedIndexes();

    // Update database statistics
    await this.updateDatabaseStatistics();

    // Warm up caches
    await this.warmUpCaches();

    // Run performance benchmarks
    const benchmarks = await this.runPerformanceBenchmarks();

    return {
      indexes_rebuilt: true,
      statistics_updated: true,
      caches_warmed: true,
      benchmark_results: benchmarks,
      performance_improvement: this.calculatePerformanceGain(benchmarks)
    };
  }

  private async scheduleMonitoring(): Promise<void> {
    // Set up monitoring for migration-related metrics
    const monitoringTasks = [
      {
        name: 'tag_search_performance',
        frequency: '5m',
        alert_threshold: 2000 // 2 seconds
      },
      {
        name: 'category_tree_load_time',
        frequency: '10m',
        alert_threshold: 1000 // 1 second
      },
      {
        name: 'database_integrity',
        frequency: '1h',
        alert_threshold: null // Any failure alerts
      }
    ];

    for (const task of monitoringTasks) {
      await this.createMonitoringTask(task);
    }
  }
}
```

## Common Migration Scenarios

### Scenario 1: Upgrading from Legacy Flat Categories

```typescript
export class LegacyFlatCategoryMigration {
  async migrateFlatToHierarchical(): Promise<MigrationResult> {
    // Step 1: Analyze existing flat categories
    const flatCategories = await this.analyzeFlatCategories();

    // Step 2: Design hierarchical structure
    const hierarchyDesign = await this.designHierarchy(flatCategories);

    // Step 3: Create new hierarchical categories
    const newCategories = await this.createHierarchicalCategories(hierarchyDesign);

    // Step 4: Migrate content assignments
    const contentMigration = await this.migrateContentAssignments(
      flatCategories,
      newCategories
    );

    // Step 5: Update search indexes and caches
    await this.updateSearchSystems();

    return {
      success: contentMigration.success,
      categories_migrated: newCategories.length,
      content_items_reassigned: contentMigration.items_processed,
      hierarchy_depth: Math.max(...newCategories.map(c => c.level))
    };
  }

  private async designHierarchy(
    flatCategories: FlatCategory[]
  ): Promise<HierarchyDesign> {
    const design: HierarchyDesign = {
      roots: [],
      mappings: new Map()
    };

    // Group categories by domain
    const domainGroups = this.groupByDomain(flatCategories);

    // Create root categories for each domain
    for (const [domain, categories] of domainGroups) {
      const root = {
        name: domain,
        slug: this.generateSlug(domain),
        children: this.organizeSubcategories(categories)
      };

      design.roots.push(root);

      // Create mappings from old to new categories
      this.createCategoryMappings(categories, root, design.mappings);
    }

    return design;
  }
}
```

### Scenario 2: Merging Multiple Tag Systems

```typescript
export class MultipleTagSystemMerger {
  async mergeTagSystems(systems: TagSystem[]): Promise<MergeResult> {
    const consolidatedTags = new Map<string, ConsolidatedTag>();
    const conflicts: TagConflict[] = [];

    // Step 1: Analyze all tag systems for conflicts
    for (const system of systems) {
      const analysis = await this.analyzeTagSystem(system);

      for (const tag of analysis.tags) {
        const normalizedName = this.normalizeTagName(tag.name);

        if (consolidatedTags.has(normalizedName)) {
          const existing = consolidatedTags.get(normalizedName)!;
          const conflict = this.detectConflict(existing, tag);

          if (conflict) {
            conflicts.push(conflict);
          } else {
            // Merge compatible tags
            const merged = this.mergeTags(existing, tag);
            consolidatedTags.set(normalizedName, merged);
          }
        } else {
          consolidatedTags.set(normalizedName, {
            name: normalizedName,
            display_name: tag.display_name,
            sources: [system.id],
            usage_count: tag.usage_count,
            categories: [tag.category]
          });
        }
      }
    }

    // Step 2: Resolve conflicts
    const conflictResolutions = await this.resolveConflicts(conflicts);

    // Step 3: Create consolidated tag system
    const finalTags = this.applyConflictResolutions(
      consolidatedTags,
      conflictResolutions
    );

    // Step 4: Migrate all associations
    const migrationResult = await this.migrateAllAssociations(
      systems,
      finalTags
    );

    return {
      success: migrationResult.success,
      systems_merged: systems.length,
      tags_consolidated: finalTags.size,
      conflicts_resolved: conflictResolutions.length,
      associations_migrated: migrationResult.associations_count
    };
  }

  private async resolveConflicts(conflicts: TagConflict[]): Promise<ConflictResolution[]> {
    const resolutions: ConflictResolution[] = [];

    for (const conflict of conflicts) {
      let resolution: ConflictResolution;

      switch (conflict.type) {
        case 'duplicate_name':
          resolution = await this.resolveDuplicateName(conflict);
          break;
        case 'category_mismatch':
          resolution = await this.resolveCategoryMismatch(conflict);
          break;
        case 'semantic_overlap':
          resolution = await this.resolveSemanticOverlap(conflict);
          break;
        default:
          resolution = await this.resolveGenericConflict(conflict);
      }

      resolutions.push(resolution);
    }

    return resolutions;
  }
}
```

This comprehensive migration guide provides teams with the tools and procedures needed to safely migrate their categorization and tagging systems while preserving data integrity and minimizing downtime.