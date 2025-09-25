/**
 * IPC Service Implementation
 * Manages IPC handlers for communication between main and renderer processes
 */

import { ipcMain } from 'electron';
import { Service, ServiceContext, ServiceHealth, ServiceStatus } from './ServiceManager';

export class IPCService implements Service {
  public readonly name = 'IPCService';
  public readonly version = '1.0.0';
  public readonly dependencies: string[] = ['DatabaseService', 'WindowService'];
  public readonly priority = 4; // Lower priority - depends on core services
  public readonly critical = true;

  private registeredHandlers: string[] = [];
  private status: ServiceStatus = {
    status: 'stopped',
    restartCount: 0,
    uptime: 0,
  };
  private startTime?: Date;

  async initialize(context: ServiceContext): Promise<void> {
    context.logger.info('Initializing IPC Service...');
    this.startTime = new Date();

    try {
      await this.setupIPCHandlers(context);

      this.status = {
        status: 'running',
        startTime: this.startTime,
        restartCount: 0,
        uptime: 0,
      };

      context.logger.info('IPC Service initialized successfully');
      context.metrics.increment('service.ipc.initialized');
    } catch (error) {
      this.status = {
        status: 'error',
        lastError: error,
        restartCount: 0,
        uptime: 0,
      };

      context.logger.error('IPC Service initialization failed', error);
      context.metrics.increment('service.ipc.initialization_failed');
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    // Remove all registered handlers
    for (const handler of this.registeredHandlers) {
      ipcMain.removeAllListeners(handler);
    }
    this.registeredHandlers = [];

    this.status = {
      ...this.status,
      status: 'stopped',
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
      return {
        healthy: true,
        details: {
          registeredHandlers: this.registeredHandlers.length,
          handlers: this.registeredHandlers,
        },
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
      };
    }
  }

  private async setupIPCHandlers(context: ServiceContext): Promise<void> {
    const dbService = context.getService('DatabaseService') as any;
    const aiService = context.getService('AIService') as any;
    const windowService = context.getService('WindowService') as any;

    // Database operations
    this.registerHandler('db:search', async (_, query: string, options?: any) => {
      if (!dbService || !dbService.getDatabase()) throw new Error('Database not initialized');
      return dbService.search(query, options);
    });

    this.registerHandler('db:searchWithAI', async (_, query: string, options?: any) => {
      if (!dbService || !dbService.getDatabase()) throw new Error('Database not initialized');

      // Try AI-enhanced search first
      if (aiService && aiService.isAvailable()) {
        try {
          const allEntries = await dbService.getDatabase().getRecent(50);
          const aiResults = await aiService.findSimilar(
            query,
            allEntries.map((r: any) => r.entry)
          );

          if (aiResults.length > 0) {
            context.metrics.increment('ipc.search.ai_success');
            return aiResults;
          }
        } catch (error) {
          context.logger.warn('AI search failed, falling back to local:', error);
          context.metrics.increment('ipc.search.ai_fallback');
        }
      }

      // Fallback to local search
      return dbService.search(query, options);
    });

    this.registerHandler('db:addEntry', async (_, entry: any, userId?: string) => {
      if (!dbService) throw new Error('Database not initialized');
      return dbService.addEntry(entry, userId);
    });

    this.registerHandler('db:updateEntry', async (_, id: string, updates: any, userId?: string) => {
      if (!dbService || !dbService.getDatabase()) throw new Error('Database not initialized');
      return dbService.getDatabase().updateEntry(id, updates, userId);
    });

    this.registerHandler('db:getEntry', async (_, id: string) => {
      if (!dbService) throw new Error('Database not initialized');
      return dbService.getEntry(id);
    });

    this.registerHandler('db:getPopular', async (_, limit: number = 10) => {
      if (!dbService || !dbService.getDatabase()) throw new Error('Database not initialized');
      return dbService.getDatabase().getPopular(limit);
    });

    this.registerHandler('db:getRecent', async (_, limit: number = 10) => {
      if (!dbService || !dbService.getDatabase()) throw new Error('Database not initialized');
      return dbService.getDatabase().getRecent(limit);
    });

    this.registerHandler(
      'db:recordUsage',
      async (_, entryId: string, successful: boolean, userId?: string) => {
        if (!dbService || !dbService.getDatabase()) throw new Error('Database not initialized');
        return dbService.getDatabase().recordUsage(entryId, successful, userId);
      }
    );

    this.registerHandler('db:getStats', async () => {
      if (!dbService) throw new Error('Database not initialized');
      return dbService.getStats();
    });

    this.registerHandler('db:autoComplete', async (_, query: string, limit: number = 5) => {
      if (!dbService || !dbService.getDatabase()) throw new Error('Database not initialized');
      return dbService.getDatabase().autoComplete(query, limit);
    });

    // Backup operations
    this.registerHandler('db:createBackup', async () => {
      if (!dbService || !dbService.getDatabase()) throw new Error('Database not initialized');
      return dbService.getDatabase().createBackup();
    });

    this.registerHandler('db:exportToJSON', async (_, outputPath: string) => {
      if (!dbService || !dbService.getDatabase()) throw new Error('Database not initialized');
      return dbService.getDatabase().exportToJSON(outputPath);
    });

    this.registerHandler(
      'db:importFromJSON',
      async (_, jsonPath: string, mergeMode: boolean = false) => {
        if (!dbService || !dbService.getDatabase()) throw new Error('Database not initialized');
        return dbService.getDatabase().importFromJSON(jsonPath, mergeMode);
      }
    );

    // Configuration
    this.registerHandler('config:get', async (_, key: string) => {
      if (!dbService || !dbService.getDatabase()) return null;
      return dbService.getDatabase().getConfig(key);
    });

    this.registerHandler(
      'config:set',
      async (_, key: string, value: string, type?: string, description?: string) => {
        if (!dbService || !dbService.getDatabase()) throw new Error('Database not initialized');
        return dbService.getDatabase().setConfig(key, value, type, description);
      }
    );

    // AI operations
    this.registerHandler('ai:explainError', async (_, errorCode: string) => {
      if (!aiService) {
        return 'AI service not available. Please configure Gemini API key in settings.';
      }
      return aiService.explainError(errorCode);
    });

    // Performance monitoring
    this.registerHandler('perf:getStatus', async () => {
      if (!dbService || !dbService.getDatabase()) throw new Error('Database not initialized');
      return dbService.getDatabase().getPerformanceStatus();
    });

    this.registerHandler('perf:getReport', async (_, startTime?: number, endTime?: number) => {
      if (!dbService || !dbService.getDatabase()) throw new Error('Database not initialized');
      return dbService.getDatabase().generatePerformanceReport(startTime, endTime);
    });

    this.registerHandler('db:healthCheck', async () => {
      if (!dbService || !dbService.getDatabase()) throw new Error('Database not initialized');
      return dbService.getDatabase().healthCheck();
    });

    // System info
    this.registerHandler('system:getInfo', async () => {
      const app = context.app;
      return {
        platform: process.platform,
        arch: process.arch,
        version: app.getVersion(),
        electronVersion: process.versions.electron,
        nodeVersion: process.versions.node,
        dataPath: app.getPath('userData'),
      };
    });

    // Service manager operations
    this.registerHandler('services:getStatus', async () => {
      const serviceManager = context.getService('ServiceManager');
      if (!serviceManager) return {};

      // Return status of all services (this would need to be implemented in ServiceManager)
      return {
        services: ['DatabaseService', 'WindowService', 'AIService', 'IPCService'].map(name => ({
          name,
          status: context.getService(name)?.getStatus?.() || { status: 'unknown' },
        })),
      };
    });

    this.registerHandler('services:healthCheck', async () => {
      const serviceManager = context.getService('ServiceManager');
      if (!serviceManager) return {};

      // Return health status of all services
      const services = ['DatabaseService', 'WindowService', 'AIService'];
      const healthChecks = await Promise.allSettled(
        services.map(async name => {
          const service = context.getService(name) as any;
          if (service && service.healthCheck) {
            return { name, health: await service.healthCheck() };
          }
          return { name, health: { healthy: false, error: 'Service not available' } };
        })
      );

      return healthChecks.reduce((acc, result) => {
        if (result.status === 'fulfilled') {
          acc[result.value.name] = result.value.health;
        }
        return acc;
      }, {} as any);
    });

    context.logger.info(`Registered ${this.registeredHandlers.length} IPC handlers`);
  }

  private registerHandler(channel: string, handler: Function): void {
    ipcMain.handle(channel, async (event, ...args) => {
      try {
        return await handler(event, ...args);
      } catch (error) {
        // Log error and re-throw for client handling
        console.error(`IPC Handler error for ${channel}:`, error);
        throw error;
      }
    });

    this.registeredHandlers.push(channel);
  }
}
