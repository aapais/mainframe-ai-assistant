/**
 * Knowledge Base Service
 * Handles all KB-related API operations with caching and error handling
 */

import { BaseService, ServiceResponse, ServiceOptions } from './BaseService';
import { KBEntry, SearchResult, SearchOptions, KBCategory } from '../../../types/services';

export interface KBEntryInput
  extends Omit<
    KBEntry,
    'id' | 'created_at' | 'updated_at' | 'usage_count' | 'success_count' | 'failure_count'
  > {
  id?: string;
}

export interface KBFilters {
  category?: KBCategory;
  search?: string;
  tags?: string[];
  page?: number;
  pageSize?: number;
}

export interface KBEntriesResponse {
  entries: KBEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export interface KBHealthStatus {
  healthy: boolean;
  entryCount: number;
  databaseConnected: boolean;
  lastIndexed?: Date;
  message?: string;
}

export class KBService extends BaseService {
  constructor() {
    super('KBService');
  }

  /**
   * Get KB entries with filtering and pagination
   */
  async getEntries(
    filters: KBFilters = {},
    options: ServiceOptions = {}
  ): Promise<ServiceResponse<KBEntriesResponse>> {
    const cacheKey = `entries:${JSON.stringify(filters)}`;

    return this.executeWithRetry(
      async () => {
        const electronAPI = this.getElectronAPI();

        if (!electronAPI.getKBEntries) {
          throw new Error('getKBEntries method not available');
        }

        const response = await electronAPI.getKBEntries(filters);

        // Normalize response format
        if (Array.isArray(response)) {
          return {
            entries: response,
            total: response.length,
            page: filters.page || 1,
            pageSize: filters.pageSize || response.length,
          };
        }

        return response;
      },
      {
        ...options,
        cacheOptions: {
          key: cacheKey,
          ttl: 30000, // 30 seconds cache for entry lists
          ...options.cacheOptions,
        },
      }
    );
  }

  /**
   * Get a single KB entry by ID
   */
  async getEntryById(id: string, options: ServiceOptions = {}): Promise<ServiceResponse<KBEntry>> {
    const cacheKey = `entry:${id}`;

    return this.executeWithRetry(
      async () => {
        const electronAPI = this.getElectronAPI();

        if (!electronAPI.getKBEntry) {
          throw new Error('getKBEntry method not available');
        }

        const entry = await electronAPI.getKBEntry(id);
        if (!entry) {
          throw new Error(`Entry with ID ${id} not found`);
        }

        return entry;
      },
      {
        ...options,
        cacheOptions: {
          key: cacheKey,
          ttl: 300000, // 5 minutes cache for individual entries
          ...options.cacheOptions,
        },
      }
    );
  }

  /**
   * Add a new KB entry
   */
  async addEntry(
    entry: KBEntryInput,
    options: ServiceOptions = {}
  ): Promise<ServiceResponse<KBEntry>> {
    return this.executeWithRetry(
      async () => {
        const electronAPI = this.getElectronAPI();

        if (!electronAPI.addKBEntry) {
          throw new Error('addKBEntry method not available');
        }

        // Validate required fields
        if (!entry.title?.trim()) {
          throw new Error('Entry title is required');
        }
        if (!entry.problem?.trim()) {
          throw new Error('Problem description is required');
        }
        if (!entry.solution?.trim()) {
          throw new Error('Solution is required');
        }
        if (!entry.category) {
          throw new Error('Category is required');
        }

        const newEntry = await electronAPI.addKBEntry(entry);

        // Clear related cache entries
        this.clearRelatedCache();

        return newEntry;
      },
      {
        ...options,
        cacheOptions: { skipCache: true }, // Don't cache write operations
      }
    );
  }

  /**
   * Update an existing KB entry
   */
  async updateEntry(
    id: string,
    updates: Partial<KBEntryInput>,
    options: ServiceOptions = {}
  ): Promise<ServiceResponse<KBEntry>> {
    return this.executeWithRetry(
      async () => {
        const electronAPI = this.getElectronAPI();

        if (!electronAPI.updateKBEntry) {
          throw new Error('updateKBEntry method not available');
        }

        // Validate updates
        if (updates.title !== undefined && !updates.title.trim()) {
          throw new Error('Entry title cannot be empty');
        }
        if (updates.problem !== undefined && !updates.problem.trim()) {
          throw new Error('Problem description cannot be empty');
        }
        if (updates.solution !== undefined && !updates.solution.trim()) {
          throw new Error('Solution cannot be empty');
        }

        const updatedEntry = await electronAPI.updateKBEntry(id, updates);

        // Clear related cache entries
        this.clearRelatedCache();
        this.cache.delete(`${this.serviceName}:entry:${id}`);

        return updatedEntry;
      },
      {
        ...options,
        cacheOptions: { skipCache: true },
      }
    );
  }

  /**
   * Delete a KB entry
   */
  async deleteEntry(id: string, options: ServiceOptions = {}): Promise<ServiceResponse<void>> {
    return this.executeWithRetry(
      async () => {
        const electronAPI = this.getElectronAPI();

        if (!electronAPI.deleteKBEntry) {
          throw new Error('deleteKBEntry method not available');
        }

        await electronAPI.deleteKBEntry(id);

        // Clear related cache entries
        this.clearRelatedCache();
        this.cache.delete(`${this.serviceName}:entry:${id}`);
      },
      {
        ...options,
        cacheOptions: { skipCache: true },
      }
    );
  }

  /**
   * Rate a KB entry
   */
  async rateEntry(
    id: string,
    successful: boolean,
    comment?: string,
    options: ServiceOptions = {}
  ): Promise<ServiceResponse<void>> {
    return this.executeWithRetry(
      async () => {
        const electronAPI = this.getElectronAPI();

        if (!electronAPI.rateKBEntry) {
          throw new Error('rateKBEntry method not available');
        }

        await electronAPI.rateKBEntry(id, successful, comment);

        // Clear entry cache to reflect updated stats
        this.cache.delete(`${this.serviceName}:entry:${id}`);
        this.clearRelatedCache();
      },
      {
        ...options,
        cacheOptions: { skipCache: true },
      }
    );
  }

  /**
   * Record entry view
   */
  async recordEntryView(id: string, options: ServiceOptions = {}): Promise<ServiceResponse<void>> {
    return this.executeWithRetry(
      async () => {
        const electronAPI = this.getElectronAPI();

        if (!electronAPI.recordEntryView) {
          // This is optional functionality, don't throw
          return;
        }

        await electronAPI.recordEntryView(id);

        // Update cache to reflect new view count
        this.cache.delete(`${this.serviceName}:entry:${id}`);
      },
      {
        ...options,
        cacheOptions: { skipCache: true },
        retries: 1, // Don't retry view recording extensively
      }
    );
  }

  /**
   * Get KB categories
   */
  async getCategories(options: ServiceOptions = {}): Promise<ServiceResponse<KBCategory[]>> {
    const cacheKey = 'categories';

    return this.executeWithRetry(
      async () => {
        const electronAPI = this.getElectronAPI();

        // Use default categories if API method not available
        const defaultCategories: KBCategory[] = [
          'JCL',
          'VSAM',
          'DB2',
          'Batch',
          'Functional',
          'Other',
        ];

        if (!electronAPI.getKBCategories) {
          return defaultCategories;
        }

        const categories = await electronAPI.getKBCategories();
        return categories || defaultCategories;
      },
      {
        ...options,
        cacheOptions: {
          key: cacheKey,
          ttl: 3600000, // 1 hour cache for categories
          ...options.cacheOptions,
        },
      }
    );
  }

  /**
   * Get KB statistics
   */
  async getStatistics(options: ServiceOptions = {}): Promise<
    ServiceResponse<{
      totalEntries: number;
      entriesByCategory: Record<KBCategory, number>;
      searchesToday: number;
      mostUsedEntries: KBEntry[];
      recentlyAdded: KBEntry[];
    }>
  > {
    const cacheKey = 'statistics';

    return this.executeWithRetry(
      async () => {
        const electronAPI = this.getElectronAPI();

        if (!electronAPI.getKBStatistics) {
          throw new Error('getKBStatistics method not available');
        }

        return await electronAPI.getKBStatistics();
      },
      {
        ...options,
        cacheOptions: {
          key: cacheKey,
          ttl: 60000, // 1 minute cache for statistics
          ...options.cacheOptions,
        },
      }
    );
  }

  /**
   * Export KB entries
   */
  async exportEntries(
    format: 'json' | 'csv' = 'json',
    filters?: KBFilters,
    options: ServiceOptions = {}
  ): Promise<ServiceResponse<{ data: string; filename: string }>> {
    return this.executeWithRetry(
      async () => {
        const electronAPI = this.getElectronAPI();

        if (!electronAPI.exportKBEntries) {
          throw new Error('exportKBEntries method not available');
        }

        return await electronAPI.exportKBEntries(format, filters);
      },
      {
        ...options,
        timeout: 30000, // Longer timeout for export operations
        cacheOptions: { skipCache: true },
      }
    );
  }

  /**
   * Import KB entries
   */
  async importEntries(
    data: string,
    format: 'json' | 'csv' = 'json',
    options: ServiceOptions = {}
  ): Promise<ServiceResponse<{ imported: number; failed: number; errors?: string[] }>> {
    return this.executeWithRetry(
      async () => {
        const electronAPI = this.getElectronAPI();

        if (!electronAPI.importKBEntries) {
          throw new Error('importKBEntries method not available');
        }

        const result = await electronAPI.importKBEntries(data, format);

        // Clear all cache after import
        this.clearCache();

        return result;
      },
      {
        ...options,
        timeout: 60000, // Long timeout for import operations
        cacheOptions: { skipCache: true },
      }
    );
  }

  /**
   * Health check for KB service
   */
  async healthCheck(): Promise<ServiceResponse<KBHealthStatus>> {
    return this.executeWithRetry(
      async () => {
        if (!this.isElectronAPIAvailable()) {
          return {
            healthy: false,
            entryCount: 0,
            databaseConnected: false,
            message: 'Electron API not available',
          };
        }

        const electronAPI = this.getElectronAPI();

        // Basic health check
        const healthStatus: KBHealthStatus = {
          healthy: true,
          entryCount: 0,
          databaseConnected: false,
        };

        try {
          // Check database connection
          if (electronAPI.checkDatabaseConnection) {
            healthStatus.databaseConnected = await electronAPI.checkDatabaseConnection();
          }

          // Get entry count
          if (electronAPI.getKBEntryCount) {
            healthStatus.entryCount = await electronAPI.getKBEntryCount();
          }

          // Check if we can perform a basic operation
          if (electronAPI.getKBEntries) {
            await electronAPI.getKBEntries({ pageSize: 1 });
          }

          healthStatus.healthy = healthStatus.databaseConnected;
          healthStatus.message = healthStatus.healthy
            ? 'All systems operational'
            : 'Database connection issues';
        } catch (error) {
          healthStatus.healthy = false;
          healthStatus.message = error instanceof Error ? error.message : 'Health check failed';
        }

        return healthStatus;
      },
      {
        timeout: 5000,
        retries: 1,
        cacheOptions: { skipCache: true },
      }
    );
  }

  /**
   * Clear cache entries related to KB data
   */
  private clearRelatedCache(): void {
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (
        key.startsWith(`${this.serviceName}:entries`) ||
        key.startsWith(`${this.serviceName}:statistics`)
      ) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Preload frequently accessed data
   */
  async preloadData(): Promise<void> {
    try {
      // Preload categories
      await this.getCategories({ cacheOptions: { refreshCache: true } });

      // Preload recent entries
      await this.getEntries({ pageSize: 20 }, { cacheOptions: { refreshCache: true } });

      this.emit('preload-complete', { service: this.serviceName });
    } catch (error) {
      this.emit('preload-error', { service: this.serviceName, error });
    }
  }
}
