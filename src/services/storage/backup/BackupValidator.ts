/**
 * Backup Validator
 * 
 * Comprehensive validation and integrity checking for backups with support for
 * multiple validation strategies, performance monitoring, and detailed reporting.
 */

import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { promisify } from 'util';
import { gunzip } from 'zlib';
import Database from 'better-sqlite3';

const gunzipAsync = promisify(gunzip);

// ===========================
// Types and Interfaces
// ===========================

export interface ValidationConfig {
  enableIntegrityChecks: boolean;
  enableChecksumValidation: boolean;
  enableRestoreValidation: boolean;
  validationSamplePercent: number;
  performance: {
    maxValidationTime: number;  // in seconds
    enableParallelValidation: boolean;
    maxConcurrentValidations: number;
  };
  rules: ValidationRule[];
}

export interface ValidationRule {
  id: string;
  name: string;
  type: 'checksum' | 'size' | 'schema' | 'data' | 'performance' | 'custom';
  severity: 'critical' | 'high' | 'medium' | 'low';
  enabled: boolean;
  config: Record<string, any>;
  validator: (context: ValidationContext) => Promise<ValidationRuleResult>;
}

export interface ValidationContext {
  backupPath: string;
  expectedChecksum?: string;
  expectedSize?: number;
  backupMetadata?: any;
  tempDirectory: string;
  validationConfig: ValidationConfig;
  progress?: ValidationProgress;
}

export interface ValidationProgress {
  phase: string;
  percentage: number;
  currentRule?: string;
  rulesCompleted: number;
  totalRules: number;
  issuesFound: number;
  estimatedTimeRemaining?: number;
}

export interface ValidationResult {
  success: boolean;
  overall: 'pass' | 'warning' | 'fail';
  summary: ValidationSummary;
  ruleResults: ValidationRuleResult[];
  performance: ValidationPerformance;
  recommendations: string[];
  report: ValidationReport;
}

export interface ValidationSummary {
  totalChecks: number;
  passedChecks: number;
  warningChecks: number;
  failedChecks: number;
  criticalIssues: number;
  timeToValidate: number;
  dataIntegrityScore: number; // 0-100
  reliabilityScore: number;   // 0-100
}

export interface ValidationRuleResult {
  ruleId: string;
  ruleName: string;
  status: 'pass' | 'warning' | 'fail' | 'skipped' | 'error';
  severity: 'critical' | 'high' | 'medium' | 'low';
  duration: number;
  details: string;
  evidence?: any;
  recommendations?: string[];
  metrics?: Record<string, number>;
}

export interface ValidationPerformance {
  totalDuration: number;
  ruleExecutionTimes: Record<string, number>;
  resourceUsage: {
    peakMemoryMb: number;
    avgCpuPercent: number;
    diskIoMb: number;
  };
  bottlenecks: string[];
}

export interface ValidationReport {
  timestamp: Date;
  backupInfo: {
    path: string;
    size: number;
    checksum: string;
    strategy?: string;
  };
  validationConfig: ValidationConfig;
  issues: ValidationIssue[];
  passedRules: string[];
  warnings: string[];
  errors: string[];
  recommendations: string[];
  nextValidationSuggested?: Date;
}

export interface ValidationIssue {
  id: string;
  ruleId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'integrity' | 'performance' | 'compatibility' | 'security';
  description: string;
  impact: string;
  resolution: string;
  evidence?: any;
  detectedAt: Date;
}

// ===========================
// Built-in Validation Rules
// ===========================

export class StandardValidationRules {
  static createChecksumRule(): ValidationRule {
    return {
      id: 'checksum-validation',
      name: 'Checksum Integrity Check',
      type: 'checksum',
      severity: 'critical',
      enabled: true,
      config: {},
      validator: async (context: ValidationContext): Promise<ValidationRuleResult> => {
        const startTime = Date.now();
        
        try {
          if (!context.expectedChecksum) {
            return {
              ruleId: 'checksum-validation',
              ruleName: 'Checksum Integrity Check',
              status: 'skipped',
              severity: 'critical',
              duration: Date.now() - startTime,
              details: 'No expected checksum provided'
            };
          }

          // Read and calculate checksum
          let data = fs.readFileSync(context.backupPath);
          
          // Handle compressed files
          if (context.backupPath.endsWith('.gz')) {
            data = await gunzipAsync(data);
          }

          const actualChecksum = createHash('sha256').update(data).digest('hex');
          const match = actualChecksum === context.expectedChecksum;

          return {
            ruleId: 'checksum-validation',
            ruleName: 'Checksum Integrity Check',
            status: match ? 'pass' : 'fail',
            severity: 'critical',
            duration: Date.now() - startTime,
            details: match ? 'Checksum verification passed' : 
              `Checksum mismatch: expected ${context.expectedChecksum}, got ${actualChecksum}`,
            evidence: {
              expected: context.expectedChecksum,
              actual: actualChecksum
            },
            metrics: {
              dataSize: data.length,
              checksumTime: Date.now() - startTime
            }
          };

        } catch (error) {
          return {
            ruleId: 'checksum-validation',
            ruleName: 'Checksum Integrity Check',
            status: 'error',
            severity: 'critical',
            duration: Date.now() - startTime,
            details: `Checksum validation failed: ${error.message}`
          };
        }
      }
    };
  }

  static createFileSizeRule(): ValidationRule {
    return {
      id: 'file-size-validation',
      name: 'File Size Verification',
      type: 'size',
      severity: 'medium',
      enabled: true,
      config: {
        tolerancePercent: 5 // Allow 5% variance
      },
      validator: async (context: ValidationContext): Promise<ValidationRuleResult> => {
        const startTime = Date.now();

        try {
          const stats = fs.statSync(context.backupPath);
          const actualSize = stats.size;

          if (!context.expectedSize) {
            return {
              ruleId: 'file-size-validation',
              ruleName: 'File Size Verification',
              status: 'warning',
              severity: 'medium',
              duration: Date.now() - startTime,
              details: `Backup size: ${actualSize} bytes (no expected size provided)`,
              metrics: { actualSize }
            };
          }

          const tolerancePercent = context.validationConfig.rules
            .find(r => r.id === 'file-size-validation')?.config?.tolerancePercent || 5;

          const variance = Math.abs(actualSize - context.expectedSize) / context.expectedSize * 100;
          const withinTolerance = variance <= tolerancePercent;

          return {
            ruleId: 'file-size-validation',
            ruleName: 'File Size Verification',
            status: withinTolerance ? 'pass' : 'warning',
            severity: 'medium',
            duration: Date.now() - startTime,
            details: withinTolerance ? 
              `File size within tolerance: ${actualSize} bytes` :
              `File size variance: ${variance.toFixed(2)}% (${actualSize} vs ${context.expectedSize} bytes)`,
            evidence: {
              expected: context.expectedSize,
              actual: actualSize,
              variance: variance.toFixed(2)
            },
            metrics: {
              actualSize,
              expectedSize: context.expectedSize,
              variancePercent: variance
            }
          };

        } catch (error) {
          return {
            ruleId: 'file-size-validation',
            ruleName: 'File Size Verification',
            status: 'error',
            severity: 'medium',
            duration: Date.now() - startTime,
            details: `File size validation failed: ${error.message}`
          };
        }
      }
    };
  }

  static createDatabaseIntegrityRule(): ValidationRule {
    return {
      id: 'database-integrity',
      name: 'Database Integrity Check',
      type: 'data',
      severity: 'critical',
      enabled: true,
      config: {},
      validator: async (context: ValidationContext): Promise<ValidationRuleResult> => {
        const startTime = Date.now();

        try {
          // Extract database from backup
          const tempDbPath = path.join(context.tempDirectory, `temp-${Date.now()}.db`);
          
          let data = fs.readFileSync(context.backupPath);
          
          // Handle compressed and packaged formats
          if (context.backupPath.endsWith('.gz')) {
            data = await gunzipAsync(data);
          }

          // Handle packaged backups
          const content = data.toString('utf-8');
          if (content.includes('---BACKUP-DATA-SEPARATOR---')) {
            const parts = content.split('---BACKUP-DATA-SEPARATOR---');
            if (parts.length === 2) {
              data = Buffer.from(parts[1], 'binary');
            }
          }

          // Write temp database
          fs.writeFileSync(tempDbPath, data);

          // Open and check database
          const db = new Database(tempDbPath, { readonly: true });
          
          try {
            // Run SQLite integrity check
            const result = db.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
            const isOk = result.integrity_check === 'ok';

            // Additional checks
            const tableCount = db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'").get() as { count: number };
            
            let recordCount = 0;
            if (tableCount.count > 0) {
              try {
                const kbCount = db.prepare('SELECT COUNT(*) as count FROM kb_entries').get() as { count: number };
                recordCount = kbCount.count;
              } catch {
                // kb_entries table might not exist
              }
            }

            return {
              ruleId: 'database-integrity',
              ruleName: 'Database Integrity Check',
              status: isOk ? 'pass' : 'fail',
              severity: 'critical',
              duration: Date.now() - startTime,
              details: isOk ? 
                `Database integrity check passed (${tableCount.count} tables, ${recordCount} records)` :
                `Database integrity check failed: ${result.integrity_check}`,
              evidence: {
                integrityResult: result.integrity_check,
                tableCount: tableCount.count,
                recordCount
              },
              metrics: {
                tableCount: tableCount.count,
                recordCount,
                integrityCheckTime: Date.now() - startTime
              }
            };

          } finally {
            db.close();
            // Cleanup temp file
            if (fs.existsSync(tempDbPath)) {
              fs.unlinkSync(tempDbPath);
            }
          }

        } catch (error) {
          return {
            ruleId: 'database-integrity',
            ruleName: 'Database Integrity Check',
            status: 'error',
            severity: 'critical',
            duration: Date.now() - startTime,
            details: `Database integrity check failed: ${error.message}`
          };
        }
      }
    };
  }

  static createSchemaValidationRule(): ValidationRule {
    return {
      id: 'schema-validation',
      name: 'Database Schema Validation',
      type: 'schema',
      severity: 'high',
      enabled: true,
      config: {
        requiredTables: ['kb_entries'],
        requiredColumns: {
          'kb_entries': ['id', 'title', 'problem', 'solution', 'category']
        }
      },
      validator: async (context: ValidationContext): Promise<ValidationRuleResult> => {
        const startTime = Date.now();

        try {
          const config = context.validationConfig.rules
            .find(r => r.id === 'schema-validation')?.config || {};

          // Extract and open database
          const tempDbPath = path.join(context.tempDirectory, `schema-check-${Date.now()}.db`);
          
          let data = fs.readFileSync(context.backupPath);
          
          if (context.backupPath.endsWith('.gz')) {
            data = await gunzipAsync(data);
          }

          const content = data.toString('utf-8');
          if (content.includes('---BACKUP-DATA-SEPARATOR---')) {
            const parts = content.split('---BACKUP-DATA-SEPARATOR---');
            if (parts.length === 2) {
              data = Buffer.from(parts[1], 'binary');
            }
          }

          fs.writeFileSync(tempDbPath, data);

          const db = new Database(tempDbPath, { readonly: true });
          const issues: string[] = [];
          const validationDetails: any = {};

          try {
            // Check required tables
            const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
            const tableNames = tables.map(t => t.name);
            
            validationDetails.foundTables = tableNames;

            for (const requiredTable of config.requiredTables || []) {
              if (!tableNames.includes(requiredTable)) {
                issues.push(`Required table missing: ${requiredTable}`);
              }
            }

            // Check required columns
            for (const [tableName, requiredColumns] of Object.entries(config.requiredColumns || {})) {
              if (tableNames.includes(tableName)) {
                const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[];
                const columnNames = columns.map(c => c.name);
                
                validationDetails[`${tableName}_columns`] = columnNames;

                for (const requiredColumn of requiredColumns as string[]) {
                  if (!columnNames.includes(requiredColumn)) {
                    issues.push(`Required column missing in ${tableName}: ${requiredColumn}`);
                  }
                }
              }
            }

            const isValid = issues.length === 0;

            return {
              ruleId: 'schema-validation',
              ruleName: 'Database Schema Validation',
              status: isValid ? 'pass' : 'fail',
              severity: 'high',
              duration: Date.now() - startTime,
              details: isValid ? 
                `Schema validation passed (${tableNames.length} tables found)` :
                `Schema validation failed: ${issues.join(', ')}`,
              evidence: validationDetails,
              metrics: {
                tableCount: tableNames.length,
                issueCount: issues.length
              }
            };

          } finally {
            db.close();
            if (fs.existsSync(tempDbPath)) {
              fs.unlinkSync(tempDbPath);
            }
          }

        } catch (error) {
          return {
            ruleId: 'schema-validation',
            ruleName: 'Database Schema Validation',
            status: 'error',
            severity: 'high',
            duration: Date.now() - startTime,
            details: `Schema validation failed: ${error.message}`
          };
        }
      }
    };
  }

  static createPerformanceRule(): ValidationRule {
    return {
      id: 'performance-validation',
      name: 'Backup Performance Check',
      type: 'performance',
      severity: 'low',
      enabled: true,
      config: {
        maxValidationTimeSeconds: 300,
        minCompressionRatio: 0.1
      },
      validator: async (context: ValidationContext): Promise<ValidationRuleResult> => {
        const startTime = Date.now();

        try {
          const config = context.validationConfig.rules
            .find(r => r.id === 'performance-validation')?.config || {};

          const stats = fs.statSync(context.backupPath);
          const fileSize = stats.size;

          // Check if this is a compressed backup
          const isCompressed = context.backupPath.endsWith('.gz');
          let compressionRatio = 0;

          if (isCompressed) {
            // Estimate compression ratio by comparing compressed vs uncompressed size
            const compressedData = fs.readFileSync(context.backupPath);
            const uncompressedData = await gunzipAsync(compressedData);
            compressionRatio = (compressedData.length - uncompressedData.length) / uncompressedData.length;
          }

          const issues: string[] = [];
          const metrics: Record<string, number> = {
            fileSize,
            compressionRatio: compressionRatio * 100
          };

          // Check compression efficiency
          if (isCompressed && compressionRatio < config.minCompressionRatio) {
            issues.push(`Low compression ratio: ${(compressionRatio * 100).toFixed(1)}%`);
          }

          // Check file size reasonableness
          if (fileSize < 1024) { // < 1KB
            issues.push('Backup file suspiciously small');
          } else if (fileSize > 10 * 1024 * 1024 * 1024) { // > 10GB
            issues.push('Backup file very large, consider compression');
          }

          const status = issues.length === 0 ? 'pass' : 'warning';

          return {
            ruleId: 'performance-validation',
            ruleName: 'Backup Performance Check',
            status,
            severity: 'low',
            duration: Date.now() - startTime,
            details: status === 'pass' ? 
              `Performance check passed (${fileSize} bytes${isCompressed ? `, ${(compressionRatio * 100).toFixed(1)}% compression` : ''})` :
              `Performance issues: ${issues.join(', ')}`,
            evidence: {
              fileSize,
              isCompressed,
              compressionRatio: compressionRatio * 100,
              issues
            },
            metrics
          };

        } catch (error) {
          return {
            ruleId: 'performance-validation',
            ruleName: 'Backup Performance Check',
            status: 'error',
            severity: 'low',
            duration: Date.now() - startTime,
            details: `Performance validation failed: ${error.message}`
          };
        }
      }
    };
  }

  static getAllStandardRules(): ValidationRule[] {
    return [
      this.createChecksumRule(),
      this.createFileSizeRule(),
      this.createDatabaseIntegrityRule(),
      this.createSchemaValidationRule(),
      this.createPerformanceRule()
    ];
  }
}

// ===========================
// Main Backup Validator
// ===========================

export class BackupValidator extends EventEmitter {
  private config: ValidationConfig;
  private activeValidations: Map<string, ValidationProgress> = new Map();

  constructor(config: ValidationConfig) {
    super();
    this.config = {
      ...config,
      rules: [...config.rules, ...StandardValidationRules.getAllStandardRules()]
    };
  }

  // ===========================
  // Main Validation Methods
  // ===========================

  async validate(
    backupPath: string, 
    expectedChecksum?: string,
    options: {
      expectedSize?: number;
      backupMetadata?: any;
      progressCallback?: (progress: ValidationProgress) => void;
    } = {}
  ): Promise<ValidationResult> {
    const validationId = this.generateValidationId();
    const startTime = Date.now();

    try {
      // Create temporary directory for validation work
      const tempDirectory = this.createTempDirectory();

      // Initialize progress tracking
      const progress: ValidationProgress = {
        phase: 'initializing',
        percentage: 0,
        currentRule: undefined,
        rulesCompleted: 0,
        totalRules: this.config.rules.filter(r => r.enabled).length,
        issuesFound: 0
      };

      this.activeValidations.set(validationId, progress);

      if (options.progressCallback) {
        options.progressCallback(progress);
      }

      // Create validation context
      const context: ValidationContext = {
        backupPath,
        expectedChecksum,
        expectedSize: options.expectedSize,
        backupMetadata: options.backupMetadata,
        tempDirectory,
        validationConfig: this.config,
        progress
      };

      // Run all enabled validation rules
      const ruleResults: ValidationRuleResult[] = [];
      const enabledRules = this.config.rules.filter(r => r.enabled);

      for (let i = 0; i < enabledRules.length; i++) {
        const rule = enabledRules[i];
        
        progress.phase = 'running_rules';
        progress.currentRule = rule.name;
        progress.percentage = (i / enabledRules.length) * 90; // Save 10% for finalization
        
        if (options.progressCallback) {
          options.progressCallback(progress);
        }

        this.emit('rule:started', { validationId, rule: rule.name });

        try {
          const result = await rule.validator(context);
          ruleResults.push(result);

          if (result.status === 'fail' || result.status === 'error') {
            progress.issuesFound++;
          }

          this.emit('rule:completed', { validationId, rule: rule.name, result });

        } catch (error) {
          const errorResult: ValidationRuleResult = {
            ruleId: rule.id,
            ruleName: rule.name,
            status: 'error',
            severity: rule.severity,
            duration: 0,
            details: `Rule execution failed: ${error.message}`
          };
          ruleResults.push(errorResult);
          progress.issuesFound++;

          this.emit('rule:error', { validationId, rule: rule.name, error });
        }

        progress.rulesCompleted++;
      }

      // Finalize validation
      progress.phase = 'finalizing';
      progress.percentage = 95;
      
      if (options.progressCallback) {
        options.progressCallback(progress);
      }

      // Generate final result
      const result = this.generateValidationResult(ruleResults, startTime, backupPath, options);

      progress.phase = 'completed';
      progress.percentage = 100;
      
      if (options.progressCallback) {
        options.progressCallback(progress);
      }

      // Cleanup
      this.cleanupTempDirectory(tempDirectory);
      this.activeValidations.delete(validationId);

      this.emit('validation:completed', { validationId, result });

      return result;

    } catch (error) {
      this.activeValidations.delete(validationId);
      this.emit('validation:failed', { validationId, error });
      throw error;
    }
  }

  async quickValidate(backupPath: string, expectedChecksum?: string): Promise<{ valid: boolean; issues: string[] }> {
    try {
      // Run only critical checks
      const quickRules = this.config.rules.filter(r => 
        r.enabled && (r.type === 'checksum' || r.severity === 'critical')
      );

      const tempDirectory = this.createTempDirectory();
      const context: ValidationContext = {
        backupPath,
        expectedChecksum,
        tempDirectory,
        validationConfig: { ...this.config, rules: quickRules }
      };

      const issues: string[] = [];
      let valid = true;

      for (const rule of quickRules) {
        try {
          const result = await rule.validator(context);
          if (result.status === 'fail' || result.status === 'error') {
            valid = false;
            issues.push(`${rule.name}: ${result.details}`);
          }
        } catch (error) {
          valid = false;
          issues.push(`${rule.name}: ${error.message}`);
        }
      }

      this.cleanupTempDirectory(tempDirectory);

      return { valid, issues };

    } catch (error) {
      return { valid: false, issues: [`Quick validation failed: ${error.message}`] };
    }
  }

  // ===========================
  // Validation Management
  // ===========================

  getActiveValidations(): string[] {
    return Array.from(this.activeValidations.keys());
  }

  getValidationProgress(validationId: string): ValidationProgress | null {
    return this.activeValidations.get(validationId) || null;
  }

  async cancelValidation(validationId: string): Promise<boolean> {
    const progress = this.activeValidations.get(validationId);
    if (!progress) {
      return false;
    }

    // Mark as cancelled (actual cancellation would need more complex implementation)
    this.activeValidations.delete(validationId);
    this.emit('validation:cancelled', { validationId });

    return true;
  }

  // ===========================
  // Configuration Management
  // ===========================

  updateConfig(updates: Partial<ValidationConfig>): void {
    this.config = { ...this.config, ...updates };
    this.emit('config:updated', this.config);
  }

  addCustomRule(rule: ValidationRule): void {
    const existingIndex = this.config.rules.findIndex(r => r.id === rule.id);
    if (existingIndex >= 0) {
      this.config.rules[existingIndex] = rule;
    } else {
      this.config.rules.push(rule);
    }
    this.emit('rule:added', rule);
  }

  removeRule(ruleId: string): boolean {
    const index = this.config.rules.findIndex(r => r.id === ruleId);
    if (index >= 0) {
      const rule = this.config.rules.splice(index, 1)[0];
      this.emit('rule:removed', rule);
      return true;
    }
    return false;
  }

  getRules(): ValidationRule[] {
    return [...this.config.rules];
  }

  // ===========================
  // Helper Methods
  // ===========================

  private generateValidationId(): string {
    return createHash('sha256')
      .update(`${Date.now()}-${Math.random()}-validation`)
      .digest('hex')
      .substring(0, 16);
  }

  private createTempDirectory(): string {
    const tempDir = path.join(process.cwd(), 'temp', `validation-${Date.now()}`);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    return tempDir;
  }

  private cleanupTempDirectory(tempDir: string): void {
    try {
      if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        for (const file of files) {
          fs.unlinkSync(path.join(tempDir, file));
        }
        fs.rmdirSync(tempDir);
      }
    } catch (error) {
      console.warn(`Failed to cleanup temp directory ${tempDir}:`, error);
    }
  }

  private generateValidationResult(
    ruleResults: ValidationRuleResult[],
    startTime: number,
    backupPath: string,
    options: any
  ): ValidationResult {
    const totalDuration = Date.now() - startTime;

    // Calculate summary
    const summary: ValidationSummary = {
      totalChecks: ruleResults.length,
      passedChecks: ruleResults.filter(r => r.status === 'pass').length,
      warningChecks: ruleResults.filter(r => r.status === 'warning').length,
      failedChecks: ruleResults.filter(r => r.status === 'fail' || r.status === 'error').length,
      criticalIssues: ruleResults.filter(r => (r.status === 'fail' || r.status === 'error') && r.severity === 'critical').length,
      timeToValidate: totalDuration,
      dataIntegrityScore: this.calculateIntegrityScore(ruleResults),
      reliabilityScore: this.calculateReliabilityScore(ruleResults)
    };

    // Determine overall status
    let overall: 'pass' | 'warning' | 'fail';
    if (summary.criticalIssues > 0) {
      overall = 'fail';
    } else if (summary.failedChecks > 0 || summary.warningChecks > 0) {
      overall = 'warning';
    } else {
      overall = 'pass';
    }

    // Generate performance metrics
    const performance: ValidationPerformance = {
      totalDuration,
      ruleExecutionTimes: {},
      resourceUsage: {
        peakMemoryMb: process.memoryUsage().heapUsed / 1024 / 1024,
        avgCpuPercent: 0, // Would need process monitoring
        diskIoMb: 0       // Would need I/O monitoring
      },
      bottlenecks: this.identifyBottlenecks(ruleResults)
    };

    ruleResults.forEach(result => {
      performance.ruleExecutionTimes[result.ruleId] = result.duration;
    });

    // Generate issues
    const issues: ValidationIssue[] = ruleResults
      .filter(r => r.status === 'fail' || r.status === 'error')
      .map(r => this.createValidationIssue(r));

    // Generate recommendations
    const recommendations = this.generateRecommendations(ruleResults, summary);

    // Generate report
    const report: ValidationReport = {
      timestamp: new Date(),
      backupInfo: {
        path: backupPath,
        size: fs.statSync(backupPath).size,
        checksum: options.expectedChecksum || 'unknown',
        strategy: options.backupMetadata?.strategy
      },
      validationConfig: this.config,
      issues,
      passedRules: ruleResults.filter(r => r.status === 'pass').map(r => r.ruleName),
      warnings: ruleResults.filter(r => r.status === 'warning').map(r => r.details),
      errors: ruleResults.filter(r => r.status === 'fail' || r.status === 'error').map(r => r.details),
      recommendations
    };

    return {
      success: overall !== 'fail',
      overall,
      summary,
      ruleResults,
      performance,
      recommendations,
      report
    };
  }

  private calculateIntegrityScore(results: ValidationRuleResult[]): number {
    const integrityRules = results.filter(r => 
      r.ruleId.includes('integrity') || r.ruleId.includes('checksum') || r.ruleId.includes('database')
    );

    if (integrityRules.length === 0) return 100;

    const passed = integrityRules.filter(r => r.status === 'pass').length;
    return Math.round((passed / integrityRules.length) * 100);
  }

  private calculateReliabilityScore(results: ValidationRuleResult[]): number {
    const totalRules = results.length;
    if (totalRules === 0) return 100;

    const passed = results.filter(r => r.status === 'pass').length;
    const warnings = results.filter(r => r.status === 'warning').length;
    
    // Full points for pass, half points for warnings, zero for failures
    const score = (passed + warnings * 0.5) / totalRules * 100;
    return Math.round(score);
  }

  private identifyBottlenecks(results: ValidationRuleResult[]): string[] {
    const bottlenecks: string[] = [];
    const avgTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length;

    // Rules taking more than 3x average time are bottlenecks
    results.forEach(result => {
      if (result.duration > avgTime * 3) {
        bottlenecks.push(`${result.ruleName} (${result.duration}ms)`);
      }
    });

    return bottlenecks;
  }

  private createValidationIssue(result: ValidationRuleResult): ValidationIssue {
    return {
      id: `issue-${result.ruleId}-${Date.now()}`,
      ruleId: result.ruleId,
      severity: result.severity,
      category: this.categorizeRule(result.ruleId),
      description: result.details,
      impact: this.getImpactDescription(result.severity),
      resolution: result.recommendations?.join('; ') || 'Manual investigation required',
      evidence: result.evidence,
      detectedAt: new Date()
    };
  }

  private categorizeRule(ruleId: string): 'integrity' | 'performance' | 'compatibility' | 'security' {
    if (ruleId.includes('integrity') || ruleId.includes('checksum') || ruleId.includes('database')) {
      return 'integrity';
    }
    if (ruleId.includes('performance') || ruleId.includes('size')) {
      return 'performance';
    }
    if (ruleId.includes('schema') || ruleId.includes('compatibility')) {
      return 'compatibility';
    }
    return 'security';
  }

  private getImpactDescription(severity: string): string {
    switch (severity) {
      case 'critical': return 'May cause data loss or corruption during restore';
      case 'high': return 'May cause restore failures or data inconsistencies';
      case 'medium': return 'May cause performance issues or minor data problems';
      case 'low': return 'May cause minor performance or usability issues';
      default: return 'Unknown impact';
    }
  }

  private generateRecommendations(results: ValidationRuleResult[], summary: ValidationSummary): string[] {
    const recommendations: string[] = [];

    if (summary.criticalIssues > 0) {
      recommendations.push('Address all critical issues before using this backup for restore operations');
    }

    if (summary.failedChecks > summary.passedChecks) {
      recommendations.push('Consider recreating this backup due to multiple validation failures');
    }

    if (summary.timeToValidate > 300000) { // > 5 minutes
      recommendations.push('Validation time is excessive - consider optimizing backup size or validation rules');
    }

    if (summary.dataIntegrityScore < 80) {
      recommendations.push('Data integrity score is low - verify backup creation process');
    }

    // Rule-specific recommendations
    results.forEach(result => {
      if (result.recommendations) {
        recommendations.push(...result.recommendations);
      }
    });

    return [...new Set(recommendations)]; // Remove duplicates
  }
}

// ===========================
// Utility Functions
// ===========================

export function createDefaultValidationConfig(): ValidationConfig {
  return {
    enableIntegrityChecks: true,
    enableChecksumValidation: true,
    enableRestoreValidation: false, // Expensive, enable only when needed
    validationSamplePercent: 100,   // Validate everything by default
    performance: {
      maxValidationTime: 300,       // 5 minutes
      enableParallelValidation: false,
      maxConcurrentValidations: 1
    },
    rules: StandardValidationRules.getAllStandardRules()
  };
}

export function createQuickValidationConfig(): ValidationConfig {
  const config = createDefaultValidationConfig();
  
  // Disable expensive checks for quick validation
  config.rules = config.rules.filter(r => 
    r.type === 'checksum' || r.type === 'size' || r.severity === 'critical'
  );
  
  config.performance.maxValidationTime = 60; // 1 minute
  config.validationSamplePercent = 10;       // Sample only
  
  return config;
}

export function formatValidationReport(result: ValidationResult): string {
  const { summary, report } = result;
  
  const lines = [
    '='.repeat(60),
    `BACKUP VALIDATION REPORT`,
    '='.repeat(60),
    ``,
    `Backup: ${report.backupInfo.path}`,
    `Size: ${(report.backupInfo.size / 1024 / 1024).toFixed(2)} MB`,
    `Validation Time: ${(summary.timeToValidate / 1000).toFixed(2)}s`,
    `Overall Status: ${result.overall.toUpperCase()}`,
    ``,
    `SUMMARY:`,
    `  Total Checks: ${summary.totalChecks}`,
    `  Passed: ${summary.passedChecks}`,
    `  Warnings: ${summary.warningChecks}`,
    `  Failed: ${summary.failedChecks}`,
    `  Critical Issues: ${summary.criticalIssues}`,
    `  Data Integrity Score: ${summary.dataIntegrityScore}%`,
    `  Reliability Score: ${summary.reliabilityScore}%`,
    ``
  ];

  if (report.errors.length > 0) {
    lines.push(`ERRORS:`);
    report.errors.forEach(error => lines.push(`  ❌ ${error}`));
    lines.push(``);
  }

  if (report.warnings.length > 0) {
    lines.push(`WARNINGS:`);
    report.warnings.forEach(warning => lines.push(`  ⚠️ ${warning}`));
    lines.push(``);
  }

  if (result.recommendations.length > 0) {
    lines.push(`RECOMMENDATIONS:`);
    result.recommendations.forEach(rec => lines.push(`  💡 ${rec}`));
    lines.push(``);
  }

  lines.push('='.repeat(60));

  return lines.join('\n');
}