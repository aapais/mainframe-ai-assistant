/**
 * Comprehensive Backup Service
 * 
 * Advanced backup service that extends the existing BackupSystem with enterprise-grade features
 * including multiple backup strategies, destinations, retention policies, and comprehensive
 * monitoring and recovery capabilities.
 */

import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { promisify } from 'util';
import { gzip, gunzip } from 'zlib';
import { IStorageAdapter } from '../adapters/IStorageAdapter';
import { BackupStrategy, BackupStrategyType } from './BackupStrategy';
import { BackupScheduler } from './BackupScheduler';
import { RestoreService } from './RestoreService';
import { BackupValidator } from './BackupValidator';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

// ===========================
// Interfaces and Types
// ===========================

export interface BackupDestination {
  id: string;
  name: string;
  type: 'local' | 'cloud' | 'network';
  path: string;
  credentials?: Record<string, any>;
  priority: number;
  enabled: boolean;
  config: {
    maxRetentionDays: number;
    maxBackupCount: number;
    compressionLevel: number;
    encryptionEnabled: boolean;
    encryptionKey?: string;
  };
}

export interface BackupConfig {
  destinations: BackupDestination[];
  defaultStrategy: BackupStrategyType;
  globalRetentionPolicy: {
    keepDaily: number;
    keepWeekly: number;
    keepMonthly: number;
    keepYearly: number;
  };
  performance: {
    maxConcurrentBackups: number;
    maxParallelDestinations: number;
    progressReportingInterval: number;
    timeoutMinutes: number;
  };
  validation: {
    enableIntegrityChecks: boolean;
    enableChecksumValidation: boolean;
    enableRestoreValidation: boolean;
    validationSamplePercent: number;
  };
  monitoring: {
    enableMetrics: boolean;
    enableAlerting: boolean;
    alertThresholds: {
      failureRate: number;
      responseTime: number;
      storageUsage: number;
    };
  };
}

export interface BackupRequest {
  id?: string;
  name?: string;
  description?: string;
  strategy: BackupStrategyType;
  destinations?: string[]; // destination IDs
  metadata?: Record<string, any>;
  tags?: string[];
  priority?: 'low' | 'normal' | 'high' | 'critical';
  validateAfterBackup?: boolean;
  notifyOnCompletion?: boolean;
}

export interface BackupJob {
  id: string;
  request: BackupRequest;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  strategy: BackupStrategy;
  destinations: BackupDestination[];
  startTime?: Date;
  endTime?: Date;
  progress: {
    phase: string;
    percentage: number;
    currentDestination?: string;
    bytesProcessed: number;
    totalBytes: number;
    estimatedTimeRemaining?: number;
  };
  results: BackupJobResult[];
  error?: string;
  metrics?: BackupMetrics;
}

export interface BackupJobResult {
  destinationId: string;
  success: boolean;
  backupPath: string;
  size: number;
  compressedSize?: number;
  checksums: {
    original: string;
    backup: string;
  };
  duration: number;
  error?: string;
  validationResult?: ValidationResult;
}

export interface BackupMetrics {
  totalDuration: number;
  dataSize: number;
  compressionRatio: number;
  transferRate: number;
  validationTime?: number;
  destinationMetrics: Array<{
    destinationId: string;
    uploadTime: number;
    transferRate: number;
    retryCount: number;
  }>;
}

export interface ValidationResult {
  success: boolean;
  checksumMatch: boolean;
  integrityCheck: boolean;
  restoreTest?: boolean;
  errors: string[];
}

export interface RestoreRequest {
  backupId: string;
  destinationPath: string;
  strategy?: 'fastest' | 'most_reliable' | 'specific_destination';
  destinationId?: string;
  pointInTime?: Date;
  includeValidation?: boolean;
  preservePermissions?: boolean;
  overwriteExisting?: boolean;
}

export interface BackupInventory {
  totalBackups: number;
  totalSize: number;
  byStrategy: Record<BackupStrategyType, number>;
  byDestination: Record<string, {
    count: number;
    size: number;
    oldestBackup: Date;
    newestBackup: Date;
  }>;
  retentionStatus: {
    expiredBackups: number;
    orphanedBackups: number;
    corruptedBackups: number;
  };
}

// ===========================
// Main Backup Service
// ===========================

export class BackupService extends EventEmitter {
  private adapter: IStorageAdapter;
  private config: BackupConfig;
  private scheduler: BackupScheduler;
  private restoreService: RestoreService;
  private validator: BackupValidator;
  private strategies: Map<BackupStrategyType, BackupStrategy> = new Map();
  private activeJobs: Map<string, BackupJob> = new Map();
  private initialized: boolean = false;

  constructor(adapter: IStorageAdapter, config: BackupConfig) {
    super();
    this.adapter = adapter;
    this.config = config;
    this.setMaxListeners(100); // Support many concurrent operations
  }

  // ===========================
  // Lifecycle Management
  // ===========================

  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing Backup Service...');

      // Initialize core components
      this.scheduler = new BackupScheduler(this, this.config.performance);
      this.restoreService = new RestoreService(this.adapter, this.config);
      this.validator = new BackupValidator(this.config.validation);

      // Initialize backup strategies
      await this.initializeStrategies();

      // Validate and prepare destinations
      await this.validateDestinations();

      // Initialize metadata storage
      await this.initializeMetadataStorage();

      // Start background services
      await this.scheduler.initialize();
      
      // Start cleanup scheduler
      this.startRetentionPolicyEnforcement();

      this.initialized = true;
      this.emit('backup-service:initialized', this.config);

      console.log('✅ Backup Service initialized successfully');
      await this.logServiceStats();

    } catch (error) {
      console.error('❌ Backup Service initialization failed:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.initialized) return;

    console.log('🔄 Stopping Backup Service...');

    // Cancel all active jobs
    for (const job of this.activeJobs.values()) {
      if (job.status === 'running') {
        await this.cancelBackup(job.id);
      }
    }

    // Stop scheduler
    if (this.scheduler) {
      await this.scheduler.stop();
    }

    this.initialized = false;
    this.emit('backup-service:stopped');
    console.log('✅ Backup Service stopped');
  }

  // ===========================
  // Backup Operations
  // ===========================

  async createBackup(request: BackupRequest): Promise<string> {
    this.ensureInitialized();

    const jobId = request.id || this.generateJobId();
    
    try {
      // Create backup job
      const job = await this.createBackupJob(jobId, request);
      this.activeJobs.set(jobId, job);

      // Start backup execution
      this.executeBackupJob(job).catch(error => {
        job.status = 'failed';
        job.error = error.message;
        job.endTime = new Date();
        this.emit('backup:failed', job);
      });

      this.emit('backup:started', job);
      return jobId;

    } catch (error) {
      console.error(`❌ Failed to create backup ${jobId}:`, error);
      this.emit('backup:failed', { id: jobId, error: error.message });
      throw error;
    }
  }

  async getBackupJob(jobId: string): Promise<BackupJob | null> {
    this.ensureInitialized();

    // Check active jobs first
    if (this.activeJobs.has(jobId)) {
      return this.activeJobs.get(jobId)!;
    }

    // Check completed jobs in metadata storage
    return this.getCompletedJob(jobId);
  }

  async listBackups(filter?: {
    strategy?: BackupStrategyType;
    destination?: string;
    status?: string;
    fromDate?: Date;
    toDate?: Date;
    tags?: string[];
    limit?: number;
  }): Promise<BackupJob[]> {
    this.ensureInitialized();

    // Combine active and completed jobs
    const activeJobs = Array.from(this.activeJobs.values());
    const completedJobs = await this.getCompletedJobs(filter);

    const allJobs = [...activeJobs, ...completedJobs];

    // Apply filters
    let filteredJobs = allJobs;

    if (filter?.strategy) {
      filteredJobs = filteredJobs.filter(job => job.request.strategy === filter.strategy);
    }

    if (filter?.status) {
      filteredJobs = filteredJobs.filter(job => job.status === filter.status);
    }

    if (filter?.destination) {
      filteredJobs = filteredJobs.filter(job => 
        job.destinations.some(dest => dest.id === filter.destination)
      );
    }

    if (filter?.fromDate) {
      filteredJobs = filteredJobs.filter(job => 
        job.startTime && job.startTime >= filter.fromDate!
      );
    }

    if (filter?.toDate) {
      filteredJobs = filteredJobs.filter(job => 
        job.startTime && job.startTime <= filter.toDate!
      );
    }

    if (filter?.tags && filter.tags.length > 0) {
      filteredJobs = filteredJobs.filter(job => 
        job.request.tags && job.request.tags.some(tag => filter.tags!.includes(tag))
      );
    }

    // Sort by start time (newest first)
    filteredJobs.sort((a, b) => {
      const aTime = a.startTime?.getTime() || 0;
      const bTime = b.startTime?.getTime() || 0;
      return bTime - aTime;
    });

    // Apply limit
    if (filter?.limit) {
      filteredJobs = filteredJobs.slice(0, filter.limit);
    }

    return filteredJobs;
  }

  async cancelBackup(jobId: string): Promise<boolean> {
    this.ensureInitialized();

    const job = this.activeJobs.get(jobId);
    if (!job) {
      throw new Error(`Backup job not found: ${jobId}`);
    }

    if (job.status !== 'running') {
      throw new Error(`Cannot cancel backup in ${job.status} state`);
    }

    try {
      job.status = 'cancelled';
      job.endTime = new Date();

      // Cleanup partial backups
      await this.cleanupPartialBackups(job);

      this.activeJobs.delete(jobId);
      this.emit('backup:cancelled', job);

      console.log(`🚫 Backup cancelled: ${jobId}`);
      return true;

    } catch (error) {
      console.error(`❌ Failed to cancel backup ${jobId}:`, error);
      return false;
    }
  }

  // ===========================
  // Restore Operations
  // ===========================

  async restore(request: RestoreRequest): Promise<string> {
    this.ensureInitialized();
    return this.restoreService.restore(request);
  }

  async listRestorePoints(backupId?: string): Promise<any[]> {
    this.ensureInitialized();
    return this.restoreService.listRestorePoints(backupId);
  }

  // ===========================
  // Backup Strategies
  // ===========================

  async scheduleBackup(
    cronExpression: string,
    request: BackupRequest,
    options?: { enabled?: boolean; name?: string }
  ): Promise<string> {
    this.ensureInitialized();
    return this.scheduler.scheduleBackup(cronExpression, request, options);
  }

  async unscheduleBackup(scheduleId: string): Promise<boolean> {
    this.ensureInitialized();
    return this.scheduler.unscheduleBackup(scheduleId);
  }

  async listSchedules(): Promise<any[]> {
    this.ensureInitialized();
    return this.scheduler.listSchedules();
  }

  // ===========================
  // Monitoring and Metrics
  // ===========================

  async getMetrics(): Promise<{
    service: any;
    destinations: any[];
    strategies: any[];
    performance: any;
  }> {
    this.ensureInitialized();

    const activeJobCount = this.activeJobs.size;
    const totalJobs = await this.getTotalJobCount();
    const successRate = await this.calculateSuccessRate();

    return {
      service: {
        initialized: this.initialized,
        activeJobs: activeJobCount,
        totalJobs,
        successRate,
        uptime: process.uptime()
      },
      destinations: await this.getDestinationMetrics(),
      strategies: await this.getStrategyMetrics(),
      performance: await this.getPerformanceMetrics()
    };
  }

  async getInventory(): Promise<BackupInventory> {
    this.ensureInitialized();

    const jobs = await this.listBackups();
    const completedJobs = jobs.filter(job => job.status === 'completed');

    const inventory: BackupInventory = {
      totalBackups: completedJobs.length,
      totalSize: 0,
      byStrategy: {} as Record<BackupStrategyType, number>,
      byDestination: {},
      retentionStatus: {
        expiredBackups: 0,
        orphanedBackups: 0,
        corruptedBackups: 0
      }
    };

    // Calculate totals and groupings
    for (const job of completedJobs) {
      // Strategy grouping
      inventory.byStrategy[job.request.strategy] = 
        (inventory.byStrategy[job.request.strategy] || 0) + 1;

      // Destination grouping and size calculation
      for (const result of job.results) {
        if (result.success) {
          inventory.totalSize += result.size;

          if (!inventory.byDestination[result.destinationId]) {
            inventory.byDestination[result.destinationId] = {
              count: 0,
              size: 0,
              oldestBackup: job.startTime!,
              newestBackup: job.startTime!
            };
          }

          const destStats = inventory.byDestination[result.destinationId];
          destStats.count++;
          destStats.size += result.size;

          if (job.startTime! < destStats.oldestBackup) {
            destStats.oldestBackup = job.startTime!;
          }
          if (job.startTime! > destStats.newestBackup) {
            destStats.newestBackup = job.startTime!;
          }
        }
      }
    }

    // Calculate retention status
    inventory.retentionStatus = await this.calculateRetentionStatus();

    return inventory;
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    destinations: Array<{ id: string; status: string; message?: string }>;
    performance: any;
  }> {
    this.ensureInitialized();

    const issues: string[] = [];
    const destinationHealth = await this.checkDestinationHealth();
    const performance = await this.getPerformanceMetrics();

    // Check for critical issues
    const failedDestinations = destinationHealth.filter(d => d.status === 'failed');
    if (failedDestinations.length > 0) {
      issues.push(`${failedDestinations.length} destination(s) are failing`);
    }

    // Check backup success rate
    const successRate = await this.calculateSuccessRate();
    if (successRate < this.config.monitoring.alertThresholds.failureRate) {
      issues.push(`Backup success rate (${successRate}%) below threshold`);
    }

    // Check performance
    if (performance.averageBackupTime > this.config.monitoring.alertThresholds.responseTime) {
      issues.push(`Average backup time exceeds threshold`);
    }

    const status = failedDestinations.length > 0 ? 'critical' :
                   issues.length > 0 ? 'warning' : 'healthy';

    return {
      status,
      issues,
      destinations: destinationHealth,
      performance
    };
  }

  // ===========================
  // Destination Management
  // ===========================

  async addDestination(destination: BackupDestination): Promise<void> {
    this.ensureInitialized();

    // Validate destination
    await this.validateDestination(destination);

    // Add to config
    this.config.destinations.push(destination);

    // Test connectivity
    const testResult = await this.testDestination(destination.id);
    if (!testResult.success) {
      throw new Error(`Destination test failed: ${testResult.error}`);
    }

    this.emit('destination:added', destination);
    console.log(`✅ Backup destination added: ${destination.name}`);
  }

  async removeDestination(destinationId: string): Promise<void> {
    this.ensureInitialized();

    const index = this.config.destinations.findIndex(d => d.id === destinationId);
    if (index === -1) {
      throw new Error(`Destination not found: ${destinationId}`);
    }

    // Check if destination has active backups
    const hasActiveBackups = await this.destinationHasActiveBackups(destinationId);
    if (hasActiveBackups) {
      throw new Error(`Cannot remove destination with active backups: ${destinationId}`);
    }

    this.config.destinations.splice(index, 1);

    this.emit('destination:removed', destinationId);
    console.log(`🗑️ Backup destination removed: ${destinationId}`);
  }

  async testDestination(destinationId: string): Promise<{
    success: boolean;
    responseTime?: number;
    error?: string;
  }> {
    this.ensureInitialized();

    const destination = this.config.destinations.find(d => d.id === destinationId);
    if (!destination) {
      throw new Error(`Destination not found: ${destinationId}`);
    }

    const startTime = Date.now();

    try {
      // Test basic connectivity and write permissions
      const testData = Buffer.from('backup-service-test');
      const testPath = path.join(destination.path, `test-${Date.now()}.tmp`);

      // Write test file
      fs.writeFileSync(testPath, testData);

      // Read back and verify
      const readData = fs.readFileSync(testPath);
      if (!testData.equals(readData)) {
        throw new Error('Data integrity test failed');
      }

      // Cleanup test file
      fs.unlinkSync(testPath);

      const responseTime = Date.now() - startTime;

      return {
        success: true,
        responseTime
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ===========================
  // Private Implementation
  // ===========================

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Backup Service not initialized. Call initialize() first.');
    }
  }

  private async initializeStrategies(): Promise<void> {
    const { BackupStrategy } = await import('./BackupStrategy');
    
    this.strategies.set('full', new BackupStrategy('full'));
    this.strategies.set('incremental', new BackupStrategy('incremental'));
    this.strategies.set('differential', new BackupStrategy('differential'));
    
    console.log(`📋 Initialized ${this.strategies.size} backup strategies`);
  }

  private async validateDestinations(): Promise<void> {
    for (const destination of this.config.destinations) {
      await this.validateDestination(destination);
      
      // Ensure destination directory exists
      if (!fs.existsSync(destination.path)) {
        fs.mkdirSync(destination.path, { recursive: true });
      }
    }
    
    console.log(`📁 Validated ${this.config.destinations.length} backup destinations`);
  }

  private async validateDestination(destination: BackupDestination): Promise<void> {
    if (!destination.id || !destination.name || !destination.path) {
      throw new Error('Destination must have id, name, and path');
    }

    // Additional validation based on destination type
    switch (destination.type) {
      case 'local':
        if (!path.isAbsolute(destination.path)) {
          throw new Error('Local destination path must be absolute');
        }
        break;
      case 'cloud':
        if (!destination.credentials) {
          throw new Error('Cloud destination requires credentials');
        }
        break;
      case 'network':
        // Add network-specific validation
        break;
    }
  }

  private async initializeMetadataStorage(): Promise<void> {
    // Initialize backup metadata tables in the adapter
    await this.adapter.executeSQL(`
      CREATE TABLE IF NOT EXISTS backup_jobs (
        id TEXT PRIMARY KEY,
        request_data TEXT NOT NULL,
        status TEXT NOT NULL,
        start_time TEXT,
        end_time TEXT,
        progress_data TEXT,
        results_data TEXT,
        error_message TEXT,
        metrics_data TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.adapter.executeSQL(`
      CREATE TABLE IF NOT EXISTS backup_schedules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        cron_expression TEXT NOT NULL,
        request_data TEXT NOT NULL,
        enabled BOOLEAN DEFAULT 1,
        last_run TEXT,
        next_run TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.adapter.executeSQL(`
      CREATE INDEX IF NOT EXISTS idx_backup_jobs_status ON backup_jobs(status)
    `);

    await this.adapter.executeSQL(`
      CREATE INDEX IF NOT EXISTS idx_backup_jobs_start_time ON backup_jobs(start_time)
    `);

    console.log('📊 Backup metadata storage initialized');
  }

  private generateJobId(): string {
    return createHash('sha256')
      .update(`${Date.now()}-${Math.random()}-${process.pid}`)
      .digest('hex')
      .substring(0, 16);
  }

  private async createBackupJob(jobId: string, request: BackupRequest): Promise<BackupJob> {
    // Determine destinations
    let destinations: BackupDestination[];
    if (request.destinations && request.destinations.length > 0) {
      destinations = this.config.destinations.filter(d => 
        request.destinations!.includes(d.id) && d.enabled
      );
    } else {
      destinations = this.config.destinations.filter(d => d.enabled);
    }

    if (destinations.length === 0) {
      throw new Error('No enabled destinations available for backup');
    }

    // Get strategy
    const strategy = this.strategies.get(request.strategy);
    if (!strategy) {
      throw new Error(`Unknown backup strategy: ${request.strategy}`);
    }

    const job: BackupJob = {
      id: jobId,
      request,
      status: 'pending',
      strategy,
      destinations,
      progress: {
        phase: 'initializing',
        percentage: 0,
        bytesProcessed: 0,
        totalBytes: 0
      },
      results: []
    };

    return job;
  }

  private async executeBackupJob(job: BackupJob): Promise<void> {
    try {
      job.status = 'running';
      job.startTime = new Date();
      
      this.emit('backup:progress', job);

      // Get source data information
      const sourceInfo = await this.adapter.getMetrics();
      job.progress.totalBytes = sourceInfo.size || 0;
      job.progress.phase = 'preparing';
      
      this.emit('backup:progress', job);

      // Execute backup strategy
      const backupData = await job.strategy.execute(this.adapter, job.progress);

      job.progress.phase = 'uploading';
      job.progress.percentage = 25;
      this.emit('backup:progress', job);

      // Upload to all destinations in parallel (with concurrency limit)
      const uploadPromises = job.destinations.map(dest => 
        this.uploadToDestination(dest, backupData, job)
      );

      const results = await Promise.allSettled(uploadPromises);
      
      // Process results
      results.forEach((result, index) => {
        const destination = job.destinations[index];
        
        if (result.status === 'fulfilled') {
          job.results.push(result.value);
        } else {
          job.results.push({
            destinationId: destination.id,
            success: false,
            backupPath: '',
            size: 0,
            checksums: { original: '', backup: '' },
            duration: 0,
            error: result.reason?.message || 'Upload failed'
          });
        }
      });

      // Validation phase
      if (job.request.validateAfterBackup) {
        job.progress.phase = 'validating';
        job.progress.percentage = 90;
        this.emit('backup:progress', job);

        await this.validateBackupResults(job);
      }

      // Calculate metrics
      job.metrics = this.calculateBackupMetrics(job);

      // Determine final status
      const successfulResults = job.results.filter(r => r.success);
      job.status = successfulResults.length > 0 ? 'completed' : 'failed';
      
      if (job.status === 'failed') {
        job.error = 'All backup destinations failed';
      }

      job.progress.phase = 'completed';
      job.progress.percentage = 100;
      job.endTime = new Date();

      // Store job metadata
      await this.storeJobMetadata(job);

      // Remove from active jobs
      this.activeJobs.delete(job.id);

      this.emit(job.status === 'completed' ? 'backup:completed' : 'backup:failed', job);

      console.log(`${job.status === 'completed' ? '✅' : '❌'} Backup ${job.status}: ${job.id}`);

    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      job.endTime = new Date();
      
      this.activeJobs.delete(job.id);
      this.emit('backup:failed', job);
      
      console.error(`❌ Backup execution failed: ${job.id}`, error);
      throw error;
    }
  }

  private async uploadToDestination(
    destination: BackupDestination, 
    data: Buffer, 
    job: BackupJob
  ): Promise<BackupJobResult> {
    const startTime = Date.now();
    
    try {
      // Generate backup filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `backup-${job.id}-${timestamp}.db${destination.config.compressionLevel > 0 ? '.gz' : ''}`;
      const backupPath = path.join(destination.path, filename);

      // Compress if enabled
      let finalData = data;
      if (destination.config.compressionLevel > 0) {
        finalData = await gzipAsync(data, { level: destination.config.compressionLevel });
      }

      // Encrypt if enabled
      if (destination.config.encryptionEnabled && destination.config.encryptionKey) {
        finalData = await this.encryptData(finalData, destination.config.encryptionKey);
      }

      // Write to destination
      fs.writeFileSync(backupPath, finalData);

      // Calculate checksums
      const originalChecksum = createHash('sha256').update(data).digest('hex');
      const backupChecksum = createHash('sha256').update(finalData).digest('hex');

      const duration = Date.now() - startTime;

      const result: BackupJobResult = {
        destinationId: destination.id,
        success: true,
        backupPath,
        size: data.length,
        compressedSize: finalData.length,
        checksums: {
          original: originalChecksum,
          backup: backupChecksum
        },
        duration
      };

      // Validate if requested
      if (job.request.validateAfterBackup) {
        result.validationResult = await this.validator.validate(backupPath, originalChecksum);
      }

      return result;

    } catch (error) {
      return {
        destinationId: destination.id,
        success: false,
        backupPath: '',
        size: 0,
        checksums: { original: '', backup: '' },
        duration: Date.now() - startTime,
        error: error.message
      };
    }
  }

  private async validateBackupResults(job: BackupJob): Promise<void> {
    for (const result of job.results) {
      if (result.success && !result.validationResult) {
        result.validationResult = await this.validator.validate(
          result.backupPath, 
          result.checksums.original
        );
      }
    }
  }

  private calculateBackupMetrics(job: BackupJob): BackupMetrics {
    const totalDuration = (job.endTime!.getTime() - job.startTime!.getTime()) / 1000;
    const successfulResults = job.results.filter(r => r.success);
    
    const totalSize = successfulResults.reduce((sum, r) => sum + r.size, 0);
    const totalCompressedSize = successfulResults.reduce((sum, r) => sum + (r.compressedSize || r.size), 0);
    
    const compressionRatio = totalSize > 0 ? (totalSize - totalCompressedSize) / totalSize : 0;
    const transferRate = totalDuration > 0 ? totalSize / totalDuration : 0;

    return {
      totalDuration,
      dataSize: totalSize,
      compressionRatio,
      transferRate,
      destinationMetrics: job.results.map(result => ({
        destinationId: result.destinationId,
        uploadTime: result.duration / 1000,
        transferRate: result.duration > 0 ? result.size / (result.duration / 1000) : 0,
        retryCount: 0 // TODO: Track retries
      }))
    };
  }

  private async storeJobMetadata(job: BackupJob): Promise<void> {
    await this.adapter.executeSQL(
      `INSERT INTO backup_jobs (
        id, request_data, status, start_time, end_time, 
        progress_data, results_data, error_message, metrics_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        job.id,
        JSON.stringify(job.request),
        job.status,
        job.startTime?.toISOString(),
        job.endTime?.toISOString(),
        JSON.stringify(job.progress),
        JSON.stringify(job.results),
        job.error,
        JSON.stringify(job.metrics)
      ]
    );
  }

  private async getCompletedJob(jobId: string): Promise<BackupJob | null> {
    const rows = await this.adapter.executeSQL(
      'SELECT * FROM backup_jobs WHERE id = ?',
      [jobId]
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return this.hydrateJobFromRow(row);
  }

  private async getCompletedJobs(filter?: any): Promise<BackupJob[]> {
    // Build query based on filter
    let query = 'SELECT * FROM backup_jobs WHERE 1=1';
    const params: any[] = [];

    if (filter?.status) {
      query += ' AND status = ?';
      params.push(filter.status);
    }

    if (filter?.fromDate) {
      query += ' AND start_time >= ?';
      params.push(filter.fromDate.toISOString());
    }

    if (filter?.toDate) {
      query += ' AND start_time <= ?';
      params.push(filter.toDate.toISOString());
    }

    query += ' ORDER BY start_time DESC';

    if (filter?.limit) {
      query += ' LIMIT ?';
      params.push(filter.limit);
    }

    const rows = await this.adapter.executeSQL(query, params);
    return rows.map(row => this.hydrateJobFromRow(row));
  }

  private hydrateJobFromRow(row: any): BackupJob {
    return {
      id: row.id,
      request: JSON.parse(row.request_data),
      status: row.status,
      strategy: this.strategies.get(JSON.parse(row.request_data).strategy)!,
      destinations: this.config.destinations.filter(d => 
        JSON.parse(row.request_data).destinations?.includes(d.id) || 
        !JSON.parse(row.request_data).destinations
      ),
      startTime: row.start_time ? new Date(row.start_time) : undefined,
      endTime: row.end_time ? new Date(row.end_time) : undefined,
      progress: JSON.parse(row.progress_data),
      results: JSON.parse(row.results_data),
      error: row.error_message,
      metrics: row.metrics_data ? JSON.parse(row.metrics_data) : undefined
    };
  }

  private async cleanupPartialBackups(job: BackupJob): Promise<void> {
    for (const result of job.results) {
      if (result.backupPath && fs.existsSync(result.backupPath)) {
        try {
          fs.unlinkSync(result.backupPath);
          console.log(`🧹 Cleaned up partial backup: ${result.backupPath}`);
        } catch (error) {
          console.warn(`⚠️ Failed to cleanup partial backup: ${result.backupPath}`, error);
        }
      }
    }
  }

  private async encryptData(data: Buffer, key: string): Promise<Buffer> {
    // TODO: Implement encryption using crypto module
    // For now, return data as-is
    return data;
  }

  private async getTotalJobCount(): Promise<number> {
    const result = await this.adapter.executeSQL('SELECT COUNT(*) as count FROM backup_jobs');
    return result[0]?.count || 0;
  }

  private async calculateSuccessRate(): Promise<number> {
    const result = await this.adapter.executeSQL(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful
      FROM backup_jobs
    `);

    const { total, successful } = result[0] || { total: 0, successful: 0 };
    return total > 0 ? (successful / total) * 100 : 100;
  }

  private async getDestinationMetrics(): Promise<any[]> {
    return Promise.all(
      this.config.destinations.map(async (dest) => {
        const testResult = await this.testDestination(dest.id);
        return {
          id: dest.id,
          name: dest.name,
          type: dest.type,
          enabled: dest.enabled,
          healthy: testResult.success,
          responseTime: testResult.responseTime,
          error: testResult.error
        };
      })
    );
  }

  private async getStrategyMetrics(): Promise<any[]> {
    const strategyStats = await this.adapter.executeSQL(`
      SELECT 
        JSON_EXTRACT(request_data, '$.strategy') as strategy,
        COUNT(*) as total_jobs,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_jobs,
        AVG(CASE WHEN end_time IS NOT NULL AND start_time IS NOT NULL 
            THEN (julianday(end_time) - julianday(start_time)) * 86400 
            ELSE NULL END) as avg_duration
      FROM backup_jobs
      GROUP BY JSON_EXTRACT(request_data, '$.strategy')
    `);

    return strategyStats.map(stat => ({
      strategy: stat.strategy,
      totalJobs: stat.total_jobs,
      successfulJobs: stat.successful_jobs,
      successRate: stat.total_jobs > 0 ? (stat.successful_jobs / stat.total_jobs) * 100 : 0,
      averageDuration: stat.avg_duration || 0
    }));
  }

  private async getPerformanceMetrics(): Promise<any> {
    const result = await this.adapter.executeSQL(`
      SELECT 
        AVG(CASE WHEN end_time IS NOT NULL AND start_time IS NOT NULL 
            THEN (julianday(end_time) - julianday(start_time)) * 86400 
            ELSE NULL END) as avg_backup_time,
        MAX(CASE WHEN end_time IS NOT NULL AND start_time IS NOT NULL 
            THEN (julianday(end_time) - julianday(start_time)) * 86400 
            ELSE NULL END) as max_backup_time,
        MIN(CASE WHEN end_time IS NOT NULL AND start_time IS NOT NULL 
            THEN (julianday(end_time) - julianday(start_time)) * 86400 
            ELSE NULL END) as min_backup_time
      FROM backup_jobs 
      WHERE status = 'completed'
    `);

    const stats = result[0] || {};
    
    return {
      averageBackupTime: stats.avg_backup_time || 0,
      maxBackupTime: stats.max_backup_time || 0,
      minBackupTime: stats.min_backup_time || 0,
      activeJobs: this.activeJobs.size
    };
  }

  private async calculateRetentionStatus(): Promise<{
    expiredBackups: number;
    orphanedBackups: number;
    corruptedBackups: number;
  }> {
    // Check for expired backups based on retention policy
    const expiredBackups = await this.adapter.executeSQL(`
      SELECT COUNT(*) as count FROM backup_jobs 
      WHERE status = 'completed' 
      AND start_time < datetime('now', '-${this.config.globalRetentionPolicy.keepDaily} days')
    `);

    // TODO: Implement logic for orphaned and corrupted backup detection
    
    return {
      expiredBackups: expiredBackups[0]?.count || 0,
      orphanedBackups: 0,
      corruptedBackups: 0
    };
  }

  private async checkDestinationHealth(): Promise<Array<{
    id: string;
    status: string;
    message?: string;
  }>> {
    return Promise.all(
      this.config.destinations.map(async (dest) => {
        const testResult = await this.testDestination(dest.id);
        return {
          id: dest.id,
          status: testResult.success ? 'healthy' : 'failed',
          message: testResult.error
        };
      })
    );
  }

  private async destinationHasActiveBackups(destinationId: string): Promise<boolean> {
    // Check active jobs
    for (const job of this.activeJobs.values()) {
      if (job.destinations.some(d => d.id === destinationId)) {
        return true;
      }
    }

    // Check if there are any successful backups in this destination
    const result = await this.adapter.executeSQL(`
      SELECT COUNT(*) as count FROM backup_jobs 
      WHERE status = 'completed' 
      AND results_data LIKE '%"destinationId":"${destinationId}"%'
    `);

    return (result[0]?.count || 0) > 0;
  }

  private startRetentionPolicyEnforcement(): void {
    // Run retention policy enforcement every hour
    setInterval(async () => {
      try {
        await this.enforceRetentionPolicy();
      } catch (error) {
        console.error('❌ Retention policy enforcement failed:', error);
      }
    }, 60 * 60 * 1000); // 1 hour
  }

  private async enforceRetentionPolicy(): Promise<void> {
    const policy = this.config.globalRetentionPolicy;
    const now = new Date();

    // Calculate cutoff dates
    const dailyCutoff = new Date(now.getTime() - (policy.keepDaily * 24 * 60 * 60 * 1000));
    const weeklyCutoff = new Date(now.getTime() - (policy.keepWeekly * 7 * 24 * 60 * 60 * 1000));
    const monthlyCutoff = new Date(now.getTime() - (policy.keepMonthly * 30 * 24 * 60 * 60 * 1000));
    const yearlyCutoff = new Date(now.getTime() - (policy.keepYearly * 365 * 24 * 60 * 60 * 1000));

    // Find expired backups
    const expiredJobs = await this.adapter.executeSQL(`
      SELECT id, results_data FROM backup_jobs 
      WHERE status = 'completed' 
      AND start_time < ?
    `, [yearlyCutoff.toISOString()]);

    let deletedCount = 0;

    for (const job of expiredJobs) {
      try {
        const results = JSON.parse(job.results_data);
        
        // Delete backup files
        for (const result of results) {
          if (result.success && result.backupPath && fs.existsSync(result.backupPath)) {
            fs.unlinkSync(result.backupPath);
          }
        }

        // Delete job metadata
        await this.adapter.executeSQL('DELETE FROM backup_jobs WHERE id = ?', [job.id]);
        deletedCount++;

      } catch (error) {
        console.warn(`⚠️ Failed to delete expired backup ${job.id}:`, error);
      }
    }

    if (deletedCount > 0) {
      console.log(`🧹 Retention policy enforcement: deleted ${deletedCount} expired backups`);
      this.emit('retention:enforced', { deletedCount });
    }
  }

  private async logServiceStats(): Promise<void> {
    try {
      const metrics = await this.getMetrics();
      console.log(`📊 Backup Service Statistics:`);
      console.log(`   Destinations: ${this.config.destinations.length} configured`);
      console.log(`   Strategies: ${this.strategies.size} available`);
      console.log(`   Active Jobs: ${metrics.service.activeJobs}`);
      console.log(`   Success Rate: ${metrics.service.successRate.toFixed(1)}%`);
    } catch (error) {
      console.warn('Could not log service stats:', error);
    }
  }
}