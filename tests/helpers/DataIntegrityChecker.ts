/**
 * DataIntegrityChecker - Validates data consistency and integrity across the KB system
 * Ensures data reliability throughout all operations and workflows
 */

import Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { KBEntry, SearchResult } from '../../src/types/index';

export interface IntegrityViolation {
  type: 'missing_data' | 'corrupt_data' | 'inconsistent_state' | 'constraint_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedRecords: string[];
  suggestedFix: string;
  timestamp: Date;
}

export interface IntegrityReport {
  timestamp: Date;
  isValid: boolean;
  overallHealth: number; // 0-1 score
  violations: IntegrityViolation[];
  warnings: string[];
  statistics: {
    totalEntries: number;
    orphanedTags: number;
    duplicateIds: number;
    corruptEntries: number;
    indexInconsistencies: number;
  };
  recommendations: string[];
}

export interface ChecksumResult {
  expected: string;
  actual: string;
  match: boolean;
  timestamp: Date;
}

export class DataIntegrityChecker {
  private violations: IntegrityViolation[] = [];
  private warnings: string[] = [];
  private checksums: Map<string, string> = new Map();

  constructor(private dbPath?: string) {
    this.initializeBaseline();
  }

  /**
   * Initialize integrity checking baseline
   */
  private initializeBaseline(): void {
    console.log('🔍 Data integrity checker initialized');
  }

  /**
   * Perform comprehensive database validation
   */
  async validateDatabase(dbPath?: string): Promise<IntegrityReport> {
    const startTime = Date.now();
    this.violations = [];
    this.warnings = [];

    const database = dbPath || this.dbPath || './knowledge.db';

    try {
      const db = new Database(database, { readonly: true });

      console.log('🔍 Starting comprehensive data integrity validation...');

      // Core integrity checks
      await this.checkTableStructure(db);
      await this.checkDataConsistency(db);
      await this.checkReferentialIntegrity(db);
      await this.checkSearchIndexIntegrity(db);
      await this.checkDataCorruption(db);
      await this.checkConstraintViolations(db);

      // Additional validations
      await this.validateKBEntryIntegrity(db);
      await this.validateTagRelationships(db);
      await this.validateUsageStatistics(db);
      await this.validateTimestamps(db);

      db.close();

      const statistics = await this.generateStatistics(database);
      const report = this.generateReport(statistics);

      const duration = Date.now() - startTime;
      console.log(`✅ Data integrity validation completed in ${duration}ms`);

      return report;
    } catch (error) {
      console.error('❌ Database validation failed:', error);

      this.violations.push({
        type: 'corrupt_data',
        severity: 'critical',
        description: `Database validation failed: ${error.message}`,
        affectedRecords: [],
        suggestedFix: 'Check database file integrity and restore from backup if necessary',
        timestamp: new Date()
      });

      return this.generateReport({
        totalEntries: 0,
        orphanedTags: 0,
        duplicateIds: 0,
        corruptEntries: 1,
        indexInconsistencies: 0
      });
    }
  }

  /**
   * Check database table structure integrity
   */
  private async checkTableStructure(db: Database.Database): Promise<void> {
    console.log('  🔎 Checking table structure...');

    const expectedTables = [
      'kb_entries',
      'kb_tags',
      'search_history',
      'usage_metrics',
      'kb_fts'
    ];

    // Check if all required tables exist
    const existingTables = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all().map((row: any) => row.name);

    const missingTables = expectedTables.filter(table => !existingTables.includes(table));

    if (missingTables.length > 0) {
      this.violations.push({
        type: 'missing_data',
        severity: 'critical',
        description: `Missing required tables: ${missingTables.join(', ')}`,
        affectedRecords: missingTables,
        suggestedFix: 'Recreate missing tables using schema migration',
        timestamp: new Date()
      });
    }

    // Check table schemas
    for (const table of existingTables.filter(t => expectedTables.includes(t))) {
      try {
        const schema = db.prepare(`PRAGMA table_info(${table})`).all();
        await this.validateTableSchema(table, schema);
      } catch (error) {
        this.violations.push({
          type: 'corrupt_data',
          severity: 'high',
          description: `Cannot read schema for table ${table}: ${error.message}`,
          affectedRecords: [table],
          suggestedFix: 'Check table integrity and repair if necessary',
          timestamp: new Date()
        });
      }
    }
  }

  /**
   * Validate individual table schema
   */
  private async validateTableSchema(tableName: string, schema: any[]): Promise<void> {
    const expectedColumns = {
      kb_entries: ['id', 'title', 'problem', 'solution', 'category', 'created_at', 'updated_at'],
      kb_tags: ['entry_id', 'tag'],
      search_history: ['id', 'query', 'timestamp', 'results_count'],
      usage_metrics: ['id', 'entry_id', 'action', 'timestamp']
    };

    const expected = expectedColumns[tableName as keyof typeof expectedColumns];
    if (!expected) return;

    const actualColumns = schema.map(col => col.name);
    const missingColumns = expected.filter(col => !actualColumns.includes(col));

    if (missingColumns.length > 0) {
      this.violations.push({
        type: 'missing_data',
        severity: 'high',
        description: `Table ${tableName} missing columns: ${missingColumns.join(', ')}`,
        affectedRecords: [tableName],
        suggestedFix: `Add missing columns to ${tableName} table`,
        timestamp: new Date()
      });
    }
  }

  /**
   * Check data consistency across tables
   */
  private async checkDataConsistency(db: Database.Database): Promise<void> {
    console.log('  🔎 Checking data consistency...');

    try {
      // Check for entries without any content
      const emptyEntries = db.prepare(`
        SELECT id, title FROM kb_entries
        WHERE title IS NULL OR title = ''
        OR problem IS NULL OR problem = ''
        OR solution IS NULL OR solution = ''
      `).all();

      if (emptyEntries.length > 0) {
        this.violations.push({
          type: 'missing_data',
          severity: 'medium',
          description: `Found ${emptyEntries.length} KB entries with missing required content`,
          affectedRecords: emptyEntries.map((e: any) => e.id),
          suggestedFix: 'Review and complete missing KB entry content',
          timestamp: new Date()
        });
      }

      // Check for duplicate IDs
      const duplicateIds = db.prepare(`
        SELECT id, COUNT(*) as count
        FROM kb_entries
        GROUP BY id
        HAVING COUNT(*) > 1
      `).all();

      if (duplicateIds.length > 0) {
        this.violations.push({
          type: 'inconsistent_state',
          severity: 'critical',
          description: `Found ${duplicateIds.length} duplicate KB entry IDs`,
          affectedRecords: duplicateIds.map((d: any) => d.id),
          suggestedFix: 'Remove or merge duplicate entries with unique ID assignment',
          timestamp: new Date()
        });
      }

      // Check usage statistics consistency
      const negativeStats = db.prepare(`
        SELECT id FROM kb_entries
        WHERE usage_count < 0 OR success_count < 0 OR failure_count < 0
      `).all();

      if (negativeStats.length > 0) {
        this.violations.push({
          type: 'inconsistent_state',
          severity: 'medium',
          description: `Found ${negativeStats.length} entries with negative usage statistics`,
          affectedRecords: negativeStats.map((s: any) => s.id),
          suggestedFix: 'Reset negative usage statistics to zero',
          timestamp: new Date()
        });
      }

    } catch (error) {
      this.violations.push({
        type: 'corrupt_data',
        severity: 'high',
        description: `Data consistency check failed: ${error.message}`,
        affectedRecords: [],
        suggestedFix: 'Investigate database corruption and restore from backup',
        timestamp: new Date()
      });
    }
  }

  /**
   * Check referential integrity between tables
   */
  private async checkReferentialIntegrity(db: Database.Database): Promise<void> {
    console.log('  🔎 Checking referential integrity...');

    try {
      // Check for orphaned tags
      const orphanedTags = db.prepare(`
        SELECT t.entry_id, t.tag
        FROM kb_tags t
        LEFT JOIN kb_entries e ON t.entry_id = e.id
        WHERE e.id IS NULL
      `).all();

      if (orphanedTags.length > 0) {
        this.violations.push({
          type: 'inconsistent_state',
          severity: 'medium',
          description: `Found ${orphanedTags.length} orphaned tags without corresponding KB entries`,
          affectedRecords: orphanedTags.map((t: any) => `${t.entry_id}:${t.tag}`),
          suggestedFix: 'Remove orphaned tags or restore missing KB entries',
          timestamp: new Date()
        });
      }

      // Check for orphaned usage metrics
      const orphanedMetrics = db.prepare(`
        SELECT m.id, m.entry_id
        FROM usage_metrics m
        LEFT JOIN kb_entries e ON m.entry_id = e.id
        WHERE e.id IS NULL AND m.entry_id IS NOT NULL
      `).all();

      if (orphanedMetrics.length > 0) {
        this.violations.push({
          type: 'inconsistent_state',
          severity: 'low',
          description: `Found ${orphanedMetrics.length} orphaned usage metrics`,
          affectedRecords: orphanedMetrics.map((m: any) => m.entry_id),
          suggestedFix: 'Clean up orphaned usage metrics records',
          timestamp: new Date()
        });
      }

    } catch (error) {
      this.violations.push({
        type: 'corrupt_data',
        severity: 'high',
        description: `Referential integrity check failed: ${error.message}`,
        affectedRecords: [],
        suggestedFix: 'Investigate database relationships and repair inconsistencies',
        timestamp: new Date()
      });
    }
  }

  /**
   * Check search index integrity
   */
  private async checkSearchIndexIntegrity(db: Database.Database): Promise<void> {
    console.log('  🔎 Checking search index integrity...');

    try {
      // Check FTS table exists and has correct structure
      const ftsCheck = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='kb_fts'
      `).get();

      if (!ftsCheck) {
        this.violations.push({
          type: 'missing_data',
          severity: 'high',
          description: 'Full-text search index table is missing',
          affectedRecords: ['kb_fts'],
          suggestedFix: 'Recreate FTS index table',
          timestamp: new Date()
        });
        return;
      }

      // Check if FTS index is in sync with main table
      const mainTableCount = db.prepare('SELECT COUNT(*) as count FROM kb_entries').get() as any;
      const ftsTableCount = db.prepare('SELECT COUNT(*) as count FROM kb_fts').get() as any;

      if (mainTableCount.count !== ftsTableCount.count) {
        this.violations.push({
          type: 'inconsistent_state',
          severity: 'high',
          description: `Search index out of sync: ${mainTableCount.count} entries vs ${ftsTableCount.count} indexed`,
          affectedRecords: ['kb_fts'],
          suggestedFix: 'Rebuild full-text search index',
          timestamp: new Date()
        });
      }

      // Test basic FTS functionality
      try {
        const testQuery = db.prepare(`SELECT COUNT(*) as count FROM kb_fts WHERE kb_fts MATCH 'test'`).get();
        // If this doesn't throw, FTS is working
      } catch (ftsError) {
        this.violations.push({
          type: 'corrupt_data',
          severity: 'high',
          description: `FTS index is corrupted: ${ftsError.message}`,
          affectedRecords: ['kb_fts'],
          suggestedFix: 'Drop and recreate FTS index',
          timestamp: new Date()
        });
      }

    } catch (error) {
      this.violations.push({
        type: 'corrupt_data',
        severity: 'high',
        description: `Search index integrity check failed: ${error.message}`,
        affectedRecords: ['kb_fts'],
        suggestedFix: 'Investigate and repair search index',
        timestamp: new Date()
      });
    }
  }

  /**
   * Check for data corruption using checksums
   */
  private async checkDataCorruption(db: Database.Database): Promise<void> {
    console.log('  🔎 Checking for data corruption...');

    try {
      // Check for obviously corrupted data
      const entries = db.prepare(`
        SELECT id, title, problem, solution, category
        FROM kb_entries
        LIMIT 100
      `).all();

      for (const entry of entries) {
        const entryData = entry as any;

        // Check for null bytes or invalid characters
        const fields = ['title', 'problem', 'solution'];
        for (const field of fields) {
          const value = entryData[field];
          if (typeof value === 'string') {
            if (value.includes('\0')) {
              this.violations.push({
                type: 'corrupt_data',
                severity: 'high',
                description: `Entry ${entryData.id} has null bytes in ${field}`,
                affectedRecords: [entryData.id],
                suggestedFix: `Clean null bytes from ${field} field`,
                timestamp: new Date()
              });
            }

            // Check for extremely long fields (potential corruption)
            if (value.length > 50000) {
              this.warnings.push(`Entry ${entryData.id} has unusually long ${field} (${value.length} chars)`);
            }
          }
        }

        // Validate category values
        const validCategories = ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'IMS', 'CICS', 'System', 'Other'];
        if (!validCategories.includes(entryData.category)) {
          this.violations.push({
            type: 'constraint_violation',
            severity: 'medium',
            description: `Entry ${entryData.id} has invalid category: ${entryData.category}`,
            affectedRecords: [entryData.id],
            suggestedFix: 'Update category to valid value',
            timestamp: new Date()
          });
        }
      }

    } catch (error) {
      this.violations.push({
        type: 'corrupt_data',
        severity: 'critical',
        description: `Data corruption check failed: ${error.message}`,
        affectedRecords: [],
        suggestedFix: 'Investigate severe database corruption',
        timestamp: new Date()
      });
    }
  }

  /**
   * Check constraint violations
   */
  private async checkConstraintViolations(db: Database.Database): Promise<void> {
    console.log('  🔎 Checking constraint violations...');

    try {
      // Check timestamp consistency
      const invalidTimestamps = db.prepare(`
        SELECT id FROM kb_entries
        WHERE created_at > updated_at
        OR created_at > datetime('now')
        OR updated_at > datetime('now')
      `).all();

      if (invalidTimestamps.length > 0) {
        this.violations.push({
          type: 'constraint_violation',
          severity: 'medium',
          description: `Found ${invalidTimestamps.length} entries with invalid timestamps`,
          affectedRecords: invalidTimestamps.map((t: any) => t.id),
          suggestedFix: 'Correct invalid timestamp values',
          timestamp: new Date()
        });
      }

      // Check for extremely old or future timestamps
      const suspiciousTimestamps = db.prepare(`
        SELECT id, created_at FROM kb_entries
        WHERE created_at < datetime('2020-01-01')
        OR created_at > datetime('now', '+1 year')
      `).all();

      if (suspiciousTimestamps.length > 0) {
        this.warnings.push(`Found ${suspiciousTimestamps.length} entries with suspicious timestamps`);
      }

    } catch (error) {
      this.violations.push({
        type: 'corrupt_data',
        severity: 'medium',
        description: `Constraint violation check failed: ${error.message}`,
        affectedRecords: [],
        suggestedFix: 'Review database constraints and data consistency',
        timestamp: new Date()
      });
    }
  }

  /**
   * Validate KB entry content integrity
   */
  private async validateKBEntryIntegrity(db: Database.Database): Promise<void> {
    console.log('  🔎 Validating KB entry content...');

    try {
      const entries = db.prepare(`
        SELECT id, title, problem, solution, usage_count, success_count, failure_count
        FROM kb_entries
      `).all();

      for (const entry of entries) {
        const e = entry as any;

        // Check for suspicious success rates
        const totalRatings = e.success_count + e.failure_count;
        if (totalRatings > 0) {
          const successRate = e.success_count / totalRatings;

          if (successRate > 1) {
            this.violations.push({
              type: 'inconsistent_state',
              severity: 'medium',
              description: `Entry ${e.id} has impossible success rate: ${successRate}`,
              affectedRecords: [e.id],
              suggestedFix: 'Correct usage statistics',
              timestamp: new Date()
            });
          }
        }

        // Check for unrealistic usage counts
        if (e.usage_count > 10000) {
          this.warnings.push(`Entry ${e.id} has very high usage count: ${e.usage_count}`);
        }

        // Validate content completeness
        if (!e.title?.trim() || !e.problem?.trim() || !e.solution?.trim()) {
          this.violations.push({
            type: 'missing_data',
            severity: 'medium',
            description: `Entry ${e.id} has incomplete content`,
            affectedRecords: [e.id],
            suggestedFix: 'Complete missing entry content',
            timestamp: new Date()
          });
        }
      }

    } catch (error) {
      this.violations.push({
        type: 'corrupt_data',
        severity: 'medium',
        description: `KB entry validation failed: ${error.message}`,
        affectedRecords: [],
        suggestedFix: 'Investigate KB entry data integrity',
        timestamp: new Date()
      });
    }
  }

  /**
   * Validate tag relationships
   */
  private async validateTagRelationships(db: Database.Database): Promise<void> {
    console.log('  🔎 Validating tag relationships...');

    try {
      // Check for tags with invalid characters
      const invalidTags = db.prepare(`
        SELECT DISTINCT tag FROM kb_tags
        WHERE tag LIKE '% %'
        OR tag LIKE '%\t%'
        OR tag LIKE '%\n%'
        OR length(tag) > 50
      `).all();

      if (invalidTags.length > 0) {
        this.violations.push({
          type: 'constraint_violation',
          severity: 'low',
          description: `Found ${invalidTags.length} tags with invalid format`,
          affectedRecords: invalidTags.map((t: any) => t.tag),
          suggestedFix: 'Clean up tag formatting',
          timestamp: new Date()
        });
      }

      // Check for empty tags
      const emptyTags = db.prepare(`
        SELECT entry_id FROM kb_tags
        WHERE tag IS NULL OR tag = '' OR trim(tag) = ''
      `).all();

      if (emptyTags.length > 0) {
        this.violations.push({
          type: 'missing_data',
          severity: 'low',
          description: `Found ${emptyTags.length} empty tags`,
          affectedRecords: emptyTags.map((t: any) => t.entry_id),
          suggestedFix: 'Remove empty tags',
          timestamp: new Date()
        });
      }

    } catch (error) {
      this.violations.push({
        type: 'corrupt_data',
        severity: 'low',
        description: `Tag validation failed: ${error.message}`,
        affectedRecords: [],
        suggestedFix: 'Review tag data integrity',
        timestamp: new Date()
      });
    }
  }

  /**
   * Validate usage statistics
   */
  private async validateUsageStatistics(db: Database.Database): Promise<void> {
    console.log('  🔎 Validating usage statistics...');

    try {
      // Check for inconsistent usage metrics
      const inconsistentMetrics = db.prepare(`
        SELECT e.id, e.usage_count,
               (SELECT COUNT(*) FROM usage_metrics m WHERE m.entry_id = e.id) as metric_count
        FROM kb_entries e
        HAVING abs(e.usage_count - metric_count) > 5
      `).all();

      if (inconsistentMetrics.length > 0) {
        this.warnings.push(`Found ${inconsistentMetrics.length} entries with inconsistent usage metrics`);
      }

      // Check for invalid metric actions
      const invalidActions = db.prepare(`
        SELECT DISTINCT action FROM usage_metrics
        WHERE action NOT IN ('view', 'copy', 'rate_success', 'rate_failure')
      `).all();

      if (invalidActions.length > 0) {
        this.violations.push({
          type: 'constraint_violation',
          severity: 'low',
          description: `Found ${invalidActions.length} invalid usage metric actions`,
          affectedRecords: invalidActions.map((a: any) => a.action),
          suggestedFix: 'Correct invalid metric action values',
          timestamp: new Date()
        });
      }

    } catch (error) {
      this.violations.push({
        type: 'corrupt_data',
        severity: 'low',
        description: `Usage statistics validation failed: ${error.message}`,
        affectedRecords: [],
        suggestedFix: 'Review usage statistics data',
        timestamp: new Date()
      });
    }
  }

  /**
   * Validate timestamps for consistency
   */
  private async validateTimestamps(db: Database.Database): Promise<void> {
    console.log('  🔎 Validating timestamps...');

    try {
      // Check for entries where created_at is after updated_at
      const invalidTimestampOrder = db.prepare(`
        SELECT id FROM kb_entries
        WHERE datetime(created_at) > datetime(updated_at)
      `).all();

      if (invalidTimestampOrder.length > 0) {
        this.violations.push({
          type: 'inconsistent_state',
          severity: 'medium',
          description: `Found ${invalidTimestampOrder.length} entries where created_at > updated_at`,
          affectedRecords: invalidTimestampOrder.map((t: any) => t.id),
          suggestedFix: 'Correct timestamp ordering',
          timestamp: new Date()
        });
      }

    } catch (error) {
      this.violations.push({
        type: 'corrupt_data',
        severity: 'medium',
        description: `Timestamp validation failed: ${error.message}`,
        affectedRecords: [],
        suggestedFix: 'Investigate timestamp data integrity',
        timestamp: new Date()
      });
    }
  }

  /**
   * Generate database statistics
   */
  private async generateStatistics(dbPath: string): Promise<IntegrityReport['statistics']> {
    try {
      const db = new Database(dbPath, { readonly: true });

      const stats = {
        totalEntries: (db.prepare('SELECT COUNT(*) as count FROM kb_entries').get() as any).count,
        orphanedTags: (db.prepare(`
          SELECT COUNT(*) as count FROM kb_tags t
          LEFT JOIN kb_entries e ON t.entry_id = e.id
          WHERE e.id IS NULL
        `).get() as any).count,
        duplicateIds: (db.prepare(`
          SELECT COUNT(*) as count FROM (
            SELECT id FROM kb_entries GROUP BY id HAVING COUNT(*) > 1
          )
        `).get() as any).count,
        corruptEntries: this.violations.filter(v => v.type === 'corrupt_data').length,
        indexInconsistencies: this.violations.filter(v =>
          v.description.toLowerCase().includes('index')
        ).length
      };

      db.close();
      return stats;
    } catch (error) {
      return {
        totalEntries: 0,
        orphanedTags: 0,
        duplicateIds: 0,
        corruptEntries: 1,
        indexInconsistencies: 0
      };
    }
  }

  /**
   * Generate integrity report
   */
  private generateReport(statistics: IntegrityReport['statistics']): IntegrityReport {
    const criticalViolations = this.violations.filter(v => v.severity === 'critical').length;
    const highViolations = this.violations.filter(v => v.severity === 'high').length;

    // Calculate overall health score (0-1)
    let healthScore = 1.0;
    healthScore -= criticalViolations * 0.2;  // -20% per critical violation
    healthScore -= highViolations * 0.1;     // -10% per high violation
    healthScore -= this.violations.filter(v => v.severity === 'medium').length * 0.05; // -5% per medium
    healthScore -= this.violations.filter(v => v.severity === 'low').length * 0.01;    // -1% per low

    healthScore = Math.max(0, healthScore);

    const isValid = criticalViolations === 0 && highViolations === 0;

    const recommendations: string[] = [];

    if (criticalViolations > 0) {
      recommendations.push('Address critical integrity violations immediately');
    }
    if (statistics.duplicateIds > 0) {
      recommendations.push('Resolve duplicate ID conflicts');
    }
    if (statistics.orphanedTags > 10) {
      recommendations.push('Clean up orphaned tag relationships');
    }
    if (statistics.indexInconsistencies > 0) {
      recommendations.push('Rebuild search indexes for consistency');
    }
    if (this.warnings.length > 5) {
      recommendations.push('Review and address data quality warnings');
    }
    if (recommendations.length === 0 && isValid) {
      recommendations.push('Data integrity is excellent - maintain current practices');
    }

    return {
      timestamp: new Date(),
      isValid,
      overallHealth: healthScore,
      violations: this.violations,
      warnings: this.warnings,
      statistics,
      recommendations
    };
  }

  /**
   * Generate checksum for data validation
   */
  async generateChecksum(data: any): Promise<string> {
    const serialized = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  /**
   * Validate data against stored checksum
   */
  async validateChecksum(key: string, data: any): Promise<ChecksumResult> {
    const currentChecksum = await this.generateChecksum(data);
    const expectedChecksum = this.checksums.get(key);

    return {
      expected: expectedChecksum || '',
      actual: currentChecksum,
      match: expectedChecksum === currentChecksum,
      timestamp: new Date()
    };
  }

  /**
   * Store checksum for future validation
   */
  async storeChecksum(key: string, data: any): Promise<void> {
    const checksum = await this.generateChecksum(data);
    this.checksums.set(key, checksum);
  }

  /**
   * Get final report with all validation results
   */
  async getFinalReport(): Promise<{
    overallHealth: number;
    dataCorruption: number;
    consistencyViolations: number;
    warnings: number;
  }> {
    return {
      overallHealth: this.violations.length === 0 ? 1.0 : Math.max(0, 1.0 - (this.violations.length * 0.1)),
      dataCorruption: this.violations.filter(v => v.type === 'corrupt_data').length,
      consistencyViolations: this.violations.filter(v => v.type === 'inconsistent_state').length,
      warnings: this.warnings.length
    };
  }

  /**
   * Export integrity report to file
   */
  async exportReport(report: IntegrityReport, filePath?: string): Promise<string> {
    const reportPath = filePath || path.join(
      process.cwd(),
      'tests/reports',
      `integrity-report-${Date.now()}.json`
    );

    try {
      await fs.mkdir(path.dirname(reportPath), { recursive: true });
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

      console.log(`📊 Integrity report exported: ${reportPath}`);
      return reportPath;
    } catch (error) {
      console.error(`❌ Failed to export integrity report: ${error}`);
      throw error;
    }
  }

  /**
   * Cleanup checker resources
   */
  async cleanup(): Promise<void> {
    this.violations = [];
    this.warnings = [];
    this.checksums.clear();
    console.log('🧹 Data integrity checker cleaned up');
  }
}