import Database from 'better-sqlite3';
import { EventEmitter } from 'events';
import crypto from 'crypto';

export interface TransformationRule {
  id: string;
  description: string;
  sourceTable: string;
  targetTable?: string;
  condition?: string; // WHERE clause
  transformFunction: (row: any) => any | Promise<any>;
  validation?: (originalRow: any, transformedRow: any) => boolean;
  batchSize?: number;
  priority?: number;
}

export interface TransformationResult {
  ruleId: string;
  processed: number;
  successful: number;
  failed: number;
  errors: Array<{ row: any; error: string }>;
  duration: number;
}

export interface DataMigrationPlan {
  transformations: TransformationRule[];
  estimatedDuration: number;
  totalRecords: number;
  requiresDowntime: boolean;
}

export class DataTransformer extends EventEmitter {
  private db: Database.Database;
  private isRunning: boolean = false;
  private currentBatch: number = 0;
  private totalBatches: number = 0;

  constructor(db: Database.Database) {
    super();
    this.db = db;
  }

  /**
   * Create a data transformation plan for migration
   */
  async createTransformationPlan(rules: TransformationRule[]): Promise<DataMigrationPlan> {
    let totalRecords = 0;
    let estimatedDuration = 0;
    let requiresDowntime = false;

    // Sort rules by priority
    const sortedRules = rules.sort((a, b) => (a.priority || 100) - (b.priority || 100));

    for (const rule of sortedRules) {
      // Count records that will be transformed
      const countQuery = rule.condition 
        ? `SELECT COUNT(*) as count FROM ${rule.sourceTable} WHERE ${rule.condition}`
        : `SELECT COUNT(*) as count FROM ${rule.sourceTable}`;
      
      const result = this.db.prepare(countQuery).get() as { count: number };
      const recordCount = result.count;
      totalRecords += recordCount;

      // Estimate processing time (rough estimate: 1000 records per second)
      const batchSize = rule.batchSize || 1000;
      const batches = Math.ceil(recordCount / batchSize);
      estimatedDuration += batches * 0.1; // 0.1 seconds per batch

      // Check if transformation requires downtime
      if (rule.targetTable && rule.targetTable !== rule.sourceTable) {
        requiresDowntime = true;
      }
    }

    return {
      transformations: sortedRules,
      estimatedDuration: Math.ceil(estimatedDuration / 60), // Convert to minutes
      totalRecords,
      requiresDowntime
    };
  }

  /**
   * Execute data transformation plan
   */
  async executeTransformationPlan(
    plan: DataMigrationPlan,
    options: {
      continueOnError?: boolean;
      validateEach?: boolean;
      dryRun?: boolean;
      maxConcurrency?: number;
    } = {}
  ): Promise<TransformationResult[]> {
    
    if (this.isRunning) {
      throw new Error('Transformation already running');
    }

    this.isRunning = true;
    const results: TransformationResult[] = [];

    try {
      this.emit('transformationStarted', {
        totalRules: plan.transformations.length,
        estimatedRecords: plan.totalRecords,
        dryRun: options.dryRun || false
      });

      for (const rule of plan.transformations) {
        this.emit('ruleStarted', { ruleId: rule.id, description: rule.description });

        const result = await this.executeTransformationRule(
          rule,
          {
            ...options,
            dryRun: options.dryRun
          }
        );

        results.push(result);

        this.emit('ruleCompleted', {
          ruleId: rule.id,
          processed: result.processed,
          successful: result.successful,
          failed: result.failed,
          duration: result.duration
        });

        // Stop on critical errors if not continuing on error
        if (!options.continueOnError && result.failed > 0 && result.successful === 0) {
          throw new Error(`Transformation rule ${rule.id} failed completely`);
        }
      }

      this.emit('transformationCompleted', {
        totalResults: results.length,
        totalProcessed: results.reduce((sum, r) => sum + r.processed, 0),
        totalSuccessful: results.reduce((sum, r) => sum + r.successful, 0),
        totalFailed: results.reduce((sum, r) => sum + r.failed, 0)
      });

    } finally {
      this.isRunning = false;
      this.currentBatch = 0;
      this.totalBatches = 0;
    }

    return results;
  }

  /**
   * Execute a single transformation rule
   */
  private async executeTransformationRule(
    rule: TransformationRule,
    options: {
      continueOnError?: boolean;
      validateEach?: boolean;
      dryRun?: boolean;
    }
  ): Promise<TransformationResult> {
    
    const startTime = Date.now();
    const result: TransformationResult = {
      ruleId: rule.id,
      processed: 0,
      successful: 0,
      failed: 0,
      errors: [],
      duration: 0
    };

    try {
      // Get total record count
      const countQuery = rule.condition 
        ? `SELECT COUNT(*) as count FROM ${rule.sourceTable} WHERE ${rule.condition}`
        : `SELECT COUNT(*) as count FROM ${rule.sourceTable}`;
      
      const countResult = this.db.prepare(countQuery).get() as { count: number };
      const totalRecords = countResult.count;
      
      if (totalRecords === 0) {
        result.duration = Date.now() - startTime;
        return result;
      }

      const batchSize = rule.batchSize || 1000;
      this.totalBatches = Math.ceil(totalRecords / batchSize);
      this.currentBatch = 0;

      // Prepare queries
      const selectQuery = rule.condition
        ? `SELECT * FROM ${rule.sourceTable} WHERE ${rule.condition} LIMIT ? OFFSET ?`
        : `SELECT * FROM ${rule.sourceTable} LIMIT ? OFFSET ?`;
      
      const selectStmt = this.db.prepare(selectQuery);

      // Process in batches
      for (let offset = 0; offset < totalRecords; offset += batchSize) {
        this.currentBatch++;
        
        this.emit('batchStarted', {
          ruleId: rule.id,
          batch: this.currentBatch,
          totalBatches: this.totalBatches,
          offset,
          batchSize
        });

        const rows = selectStmt.all(batchSize, offset);
        
        if (options.dryRun) {
          // In dry run, just validate the transformation function
          for (const row of rows) {
            try {
              await rule.transformFunction(row);
              result.successful++;
            } catch (error) {
              result.failed++;
              result.errors.push({
                row,
                error: error.message
              });
            }
            result.processed++;
          }
        } else {
          // Execute actual transformation
          const batchResult = await this.processBatch(row, rule, options);
          result.processed += batchResult.processed;
          result.successful += batchResult.successful;
          result.failed += batchResult.failed;
          result.errors.push(...batchResult.errors);
        }

        this.emit('batchCompleted', {
          ruleId: rule.id,
          batch: this.currentBatch,
          processed: rows.length,
          successful: result.successful,
          failed: result.failed
        });
      }

    } catch (error) {
      this.emit('ruleError', {
        ruleId: rule.id,
        error: error.message
      });
      throw error;
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Process a batch of records
   */
  private async processBatch(
    rows: any[],
    rule: TransformationRule,
    options: {
      continueOnError?: boolean;
      validateEach?: boolean;
    }
  ): Promise<{
    processed: number;
    successful: number;
    failed: number;
    errors: Array<{ row: any; error: string }>;
  }> {
    
    const batchResult = {
      processed: 0,
      successful: 0,
      failed: 0,
      errors: [] as Array<{ row: any; error: string }>
    };

    const transaction = this.db.transaction((rows: any[]) => {
      for (const row of rows) {
        try {
          // Apply transformation
          const transformedRow = rule.transformFunction(row);
          
          // Validate transformation if required
          if (options.validateEach && rule.validation) {
            if (!rule.validation(row, transformedRow)) {
              throw new Error('Transformation validation failed');
            }
          }

          // Execute the actual data modification
          if (rule.targetTable && rule.targetTable !== rule.sourceTable) {
            // Insert into target table
            this.insertTransformedRow(rule.targetTable, transformedRow);
          } else {
            // Update source table
            this.updateTransformedRow(rule.sourceTable, row, transformedRow);
          }

          batchResult.successful++;
        } catch (error) {
          batchResult.failed++;
          batchResult.errors.push({
            row,
            error: error.message
          });

          if (!options.continueOnError) {
            throw error;
          }
        }
        batchResult.processed++;
      }
    });

    try {
      transaction(rows);
    } catch (error) {
      // If transaction fails, mark all as failed
      batchResult.failed = rows.length;
      batchResult.successful = 0;
      batchResult.errors = [{
        row: { batch: 'entire_batch' },
        error: error.message
      }];
    }

    return batchResult;
  }

  /**
   * Insert transformed row into target table
   */
  private insertTransformedRow(targetTable: string, transformedRow: any): void {
    const columns = Object.keys(transformedRow);
    const placeholders = columns.map(() => '?').join(', ');
    const values = columns.map(col => transformedRow[col]);

    const insertQuery = `
      INSERT INTO ${targetTable} (${columns.join(', ')})
      VALUES (${placeholders})
    `;

    this.db.prepare(insertQuery).run(...values);
  }

  /**
   * Update source table with transformed row
   */
  private updateTransformedRow(sourceTable: string, originalRow: any, transformedRow: any): void {
    const updates = Object.keys(transformedRow)
      .filter(col => col !== 'id') // Don't update primary key
      .map(col => `${col} = ?`)
      .join(', ');

    const values = Object.keys(transformedRow)
      .filter(col => col !== 'id')
      .map(col => transformedRow[col]);

    values.push(originalRow.id); // Add ID for WHERE clause

    const updateQuery = `
      UPDATE ${sourceTable}
      SET ${updates}
      WHERE id = ?
    `;

    this.db.prepare(updateQuery).run(...values);
  }

  /**
   * Create common transformation rules for MVP migrations
   */
  static createMVPTransformationRules(): {
    mvp2: TransformationRule[];
    mvp3: TransformationRule[];
    mvp4: TransformationRule[];
    mvp5: TransformationRule[];
  } {
    return {
      mvp2: [
        // Transform existing KB entries to link with incidents
        {
          id: 'mvp2_link_kb_incidents',
          description: 'Link existing KB entries with historical incidents',
          sourceTable: 'kb_entries',
          transformFunction: (row) => ({
            ...row,
            // Add any MVP2 specific transformations
            updated_at: new Date().toISOString()
          }),
          batchSize: 500,
          priority: 1
        }
      ],

      mvp3: [
        // Prepare KB entries for code linking
        {
          id: 'mvp3_prepare_code_links',
          description: 'Prepare KB entries for code analysis integration',
          sourceTable: 'kb_entries',
          transformFunction: (row) => ({
            ...row,
            // Extract potential error codes for auto-linking
            extracted_error_codes: this.extractErrorCodes(row.problem + ' ' + row.solution),
            updated_at: new Date().toISOString()
          }),
          validation: (original, transformed) => {
            return transformed.id === original.id;
          },
          batchSize: 200,
          priority: 1
        }
      ],

      mvp4: [
        // Transform code files for project integration
        {
          id: 'mvp4_enhance_code_metadata',
          description: 'Enhance code files with project metadata',
          sourceTable: 'code_files',
          transformFunction: (row) => ({
            ...row,
            // Add project classification
            potential_project_type: this.classifyCodeFile(row.filename, row.file_type),
            updated_at: new Date().toISOString()
          }),
          batchSize: 100,
          priority: 2
        }
      ],

      mvp5: [
        // Prepare data for ML training
        {
          id: 'mvp5_prepare_ml_features',
          description: 'Extract features from incidents for ML training',
          sourceTable: 'incidents',
          transformFunction: (row) => ({
            ...row,
            // Extract features for ML
            text_features: this.extractTextFeatures(row.description),
            temporal_features: this.extractTemporalFeatures(row.created_at),
            severity_numeric: this.mapSeverityToNumeric(row.severity)
          }),
          batchSize: 1000,
          priority: 1
        }
      ]
    };
  }

  /**
   * Validate data integrity after transformation
   */
  async validateDataIntegrity(
    sourceTable: string,
    targetTable?: string,
    validationRules?: Array<{
      name: string;
      query: string;
      expectedResult: any;
    }>
  ): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Basic row count validation
      const sourceCount = this.db.prepare(`SELECT COUNT(*) as count FROM ${sourceTable}`).get() as { count: number };
      
      if (targetTable && targetTable !== sourceTable) {
        const targetCount = this.db.prepare(`SELECT COUNT(*) as count FROM ${targetTable}`).get() as { count: number };
        
        if (sourceCount.count !== targetCount.count) {
          errors.push(`Row count mismatch: ${sourceTable}(${sourceCount.count}) vs ${targetTable}(${targetCount.count})`);
        }
      }

      // Custom validation rules
      if (validationRules) {
        for (const rule of validationRules) {
          try {
            const result = this.db.prepare(rule.query).get();
            
            if (JSON.stringify(result) !== JSON.stringify(rule.expectedResult)) {
              errors.push(`Validation rule '${rule.name}' failed: expected ${JSON.stringify(rule.expectedResult)}, got ${JSON.stringify(result)}`);
            }
          } catch (error) {
            warnings.push(`Validation rule '${rule.name}' could not be executed: ${error.message}`);
          }
        }
      }

      // Check for data type consistency
      const schemaInfo = this.db.prepare(`PRAGMA table_info(${sourceTable})`).all();
      for (const column of schemaInfo as any[]) {
        if (column.notnull === 1) {
          const nullCount = this.db.prepare(`
            SELECT COUNT(*) as count 
            FROM ${sourceTable} 
            WHERE ${column.name} IS NULL
          `).get() as { count: number };
          
          if (nullCount.count > 0) {
            errors.push(`Found ${nullCount.count} NULL values in NOT NULL column ${column.name}`);
          }
        }
      }

    } catch (error) {
      errors.push(`Validation failed: ${error.message}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Static helper methods for transformation rules
  private static extractErrorCodes(text: string): string[] {
    const patterns = [
      /S0C\d/g,
      /U\d{4}/g,
      /IEF\d{3}[A-Z]/g,
      /VSAM STATUS \d{2}/g,
      /SQLCODE -?\d+/g,
      /WER\d{3}[A-Z]/g
    ];

    const errorCodes: string[] = [];
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        errorCodes.push(...matches);
      }
    }

    return [...new Set(errorCodes)]; // Remove duplicates
  }

  private static classifyCodeFile(filename: string, fileType: string): string {
    const name = filename.toLowerCase();
    
    if (name.includes('batch') || name.includes('job')) return 'batch';
    if (name.includes('online') || name.includes('cics')) return 'online';
    if (name.includes('util') || name.includes('tool')) return 'utility';
    if (name.includes('copy') || fileType === 'copybook') return 'copybook';
    if (name.includes('jcl') || fileType === 'jcl') return 'jcl';
    
    return 'application';
  }

  private static extractTextFeatures(text: string): any {
    return {
      word_count: text.split(/\s+/).length,
      char_count: text.length,
      has_error_code: /[A-Z]\d{3,4}/.test(text),
      has_sql: /SQL/i.test(text),
      has_file_reference: /FILE|DSN|DATASET/i.test(text),
      urgency_keywords: (text.match(/urgent|critical|emergency|immediate/gi) || []).length
    };
  }

  private static extractTemporalFeatures(timestamp: string): any {
    const date = new Date(timestamp);
    return {
      hour_of_day: date.getHours(),
      day_of_week: date.getDay(),
      is_weekend: date.getDay() === 0 || date.getDay() === 6,
      is_business_hours: date.getHours() >= 8 && date.getHours() <= 18
    };
  }

  private static mapSeverityToNumeric(severity: string): number {
    const mapping: { [key: string]: number } = {
      'low': 1,
      'medium': 2,
      'high': 3,
      'critical': 4
    };
    return mapping[severity.toLowerCase()] || 0;
  }

  /**
   * Get current transformation progress
   */
  getProgress(): {
    isRunning: boolean;
    currentBatch: number;
    totalBatches: number;
    progressPercentage: number;
  } {
    return {
      isRunning: this.isRunning,
      currentBatch: this.currentBatch,
      totalBatches: this.totalBatches,
      progressPercentage: this.totalBatches > 0 ? (this.currentBatch / this.totalBatches) * 100 : 0
    };
  }

  /**
   * Cancel running transformation
   */
  cancel(): void {
    if (this.isRunning) {
      this.isRunning = false;
      this.emit('transformationCancelled');
    }
  }
}