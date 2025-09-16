/**
 * Database Service Implementation
 * Wraps KnowledgeDB functionality as a managed service
 */

import { join } from 'path';
import { createKnowledgeDB, KnowledgeDB } from '../../database/KnowledgeDB';
import { Service, ServiceContext, ServiceHealth, ServiceStatus } from './ServiceManager';

export class DatabaseService implements Service {
  public readonly name = 'DatabaseService';
  public readonly version = '1.0.0';
  public readonly dependencies: string[] = [];
  public readonly priority = 1; // High priority - core service
  public readonly critical = true;

  private knowledgeDB: KnowledgeDB | null = null;
  private status: ServiceStatus = {
    status: 'stopped',
    restartCount: 0,
    uptime: 0
  };
  private startTime?: Date;

  async initialize(context: ServiceContext): Promise<void> {
    context.logger.info('Initializing Database Service...');
    this.startTime = new Date();
    
    try {
      // Get app data directory
      const appDataPath = context.dataPath;
      const dbPath = join(appDataPath, 'knowledge.db');
      const backupDir = join(appDataPath, 'backups');

      // Create knowledge database
      this.knowledgeDB = await createKnowledgeDB(dbPath, {
        backupDir,
        maxBackups: 10,
        autoBackup: true,
        backupInterval: 24 // hours
      });

      this.status = {
        status: 'running',
        startTime: this.startTime,
        restartCount: 0,
        uptime: 0
      };

      context.logger.info('Database Service initialized successfully');
      context.metrics.increment('service.database.initialized');
    } catch (error) {
      this.status = {
        status: 'error',
        lastError: error,
        restartCount: 0,
        uptime: 0
      };
      
      context.logger.error('Database Service initialization failed', error);
      context.metrics.increment('service.database.initialization_failed');
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (this.knowledgeDB) {
      this.knowledgeDB.close();
      this.knowledgeDB = null;
    }

    this.status = {
      ...this.status,
      status: 'stopped'
    };
  }

  getStatus(): ServiceStatus {
    if (this.startTime && this.status.status === 'running') {
      this.status.uptime = Date.now() - this.startTime.getTime();
    }
    return { ...this.status };
  }

  async healthCheck(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      if (!this.knowledgeDB) {
        return {
          healthy: false,
          error: 'Database instance not available',
          lastCheck: new Date(),
          responseTime: Date.now() - startTime
        };
      }

      // Perform a simple health check
      const healthResult = await this.knowledgeDB.healthCheck();
      
      return {
        healthy: healthResult.healthy,
        error: healthResult.error,
        details: {
          database: healthResult,
          connections: this.knowledgeDB.getConnectionCount?.() || 'N/A'
        },
        lastCheck: new Date(),
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        lastCheck: new Date(),
        responseTime: Date.now() - startTime
      };
    }
  }

  // Public interface for accessing the database
  getDatabase(): KnowledgeDB | null {
    return this.knowledgeDB;
  }

  // Convenience methods for common database operations
  async search(query: string, options?: any): Promise<any> {
    if (!this.knowledgeDB) {
      throw new Error('Database service not initialized');
    }
    return this.knowledgeDB.search(query, options);
  }

  async addEntry(entry: any, userId?: string): Promise<string> {
    if (!this.knowledgeDB) {
      throw new Error('Database service not initialized');
    }
    return this.knowledgeDB.addEntry(entry, userId);
  }

  async getEntry(id: string): Promise<any> {
    if (!this.knowledgeDB) {
      throw new Error('Database service not initialized');
    }
    return this.knowledgeDB.getEntry(id);
  }

  async getStats(): Promise<any> {
    if (!this.knowledgeDB) {
      throw new Error('Database service not initialized');
    }
    return this.knowledgeDB.getStats();
  }
}