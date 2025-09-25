/**
 * Base Storage Plugin
 * Abstract base class for all storage service plugins
 *
 * This class provides the foundation for MVP-specific functionality extensions,
 * implementing the Plugin pattern for modular feature additions.
 */

import { EventEmitter } from 'events';
import { IStoragePlugin, PluginConfig, PluginMetadata, PluginStatus } from '../IStorageService';
import { IStorageAdapter } from '../adapters/IStorageAdapter';

export abstract class BaseStoragePlugin extends EventEmitter implements IStoragePlugin {
  protected adapter: IStorageAdapter;
  protected config: PluginConfig;
  protected metadata: PluginMetadata;
  protected status: PluginStatus = 'inactive';
  protected errorCount: number = 0;
  protected maxErrors: number = 10;

  constructor(adapter: IStorageAdapter, config: PluginConfig = {}) {
    super();
    this.adapter = adapter;
    this.config = this.mergeWithDefaults(config);
    this.metadata = this.initializeMetadata();
  }

  // ========================
  // Abstract Methods (Must be implemented by concrete plugins)
  // ========================

  /**
   * Get plugin name
   */
  abstract getName(): string;

  /**
   * Get plugin version
   */
  abstract getVersion(): string;

  /**
   * Get plugin description
   */
  abstract getDescription(): string;

  /**
   * Get MVP version when this plugin becomes available
   */
  abstract getMVPVersion(): number;

  /**
   * Get plugin dependencies
   */
  abstract getDependencies(): string[];

  /**
   * Initialize plugin-specific resources
   */
  protected abstract initializePlugin(): Promise<void>;

  /**
   * Cleanup plugin-specific resources
   */
  protected abstract cleanupPlugin(): Promise<void>;

  /**
   * Process plugin-specific data
   */
  abstract processData(data: any, context?: any): Promise<any>;

  /**
   * Get default configuration for this plugin
   */
  protected abstract getDefaultConfig(): PluginConfig;

  // ========================
  // Lifecycle Management
  // ========================

  /**
   * Initialize the plugin
   */
  async initialize(): Promise<void> {
    try {
      this.status = 'initializing';
      this.emit('status-change', this.status);

      // Validate dependencies
      await this.validateDependencies();

      // Validate configuration
      this.validateConfiguration();

      // Initialize plugin-specific resources
      await this.initializePlugin();

      // Update status
      this.status = 'active';
      this.metadata.initialized_at = new Date();
      this.emit('status-change', this.status);
      this.emit('initialized', this.metadata);

      console.log(`✅ Plugin ${this.getName()} v${this.getVersion()} initialized successfully`);
    } catch (error) {
      this.status = 'error';
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Shutdown the plugin
   */
  async shutdown(): Promise<void> {
    try {
      this.status = 'shutting-down';
      this.emit('status-change', this.status);

      // Cleanup plugin-specific resources
      await this.cleanupPlugin();

      // Update status
      this.status = 'inactive';
      this.emit('status-change', this.status);
      this.emit('shutdown', this.metadata);

      console.log(`✅ Plugin ${this.getName()} shutdown successfully`);
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Check if plugin is active
   */
  isActive(): boolean {
    return this.status === 'active';
  }

  /**
   * Get plugin status
   */
  getStatus(): PluginStatus {
    return this.status;
  }

  // ========================
  // Configuration Management
  // ========================

  /**
   * Get plugin configuration
   */
  getConfig(): PluginConfig {
    return { ...this.config };
  }

  /**
   * Update plugin configuration
   */
  async updateConfig(newConfig: Partial<PluginConfig>): Promise<void> {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    try {
      this.validateConfiguration();
      this.emit('config-updated', { old: oldConfig, new: this.config });
    } catch (error) {
      // Revert on validation failure
      this.config = oldConfig;
      throw error;
    }
  }

  /**
   * Get plugin metadata
   */
  getMetadata(): PluginMetadata {
    return {
      ...this.metadata,
      status: this.status,
      error_count: this.errorCount,
    };
  }

  // ========================
  // Data Processing
  // ========================

  /**
   * Process data with error handling and metrics
   */
  async process(data: any, context?: any): Promise<any> {
    if (!this.isActive()) {
      throw new Error(`Plugin ${this.getName()} is not active`);
    }

    const startTime = Date.now();

    try {
      // Update processing metrics
      this.metadata.operations_count = (this.metadata.operations_count || 0) + 1;

      // Process data
      const result = await this.processData(data, context);

      // Update success metrics
      const processingTime = Date.now() - startTime;
      this.metadata.total_processing_time =
        (this.metadata.total_processing_time || 0) + processingTime;
      this.metadata.last_operation_at = new Date();

      this.emit('data-processed', {
        plugin: this.getName(),
        processing_time: processingTime,
        success: true,
        data_size: this.getDataSize(data),
      });

      return result;
    } catch (error) {
      this.handleError(error as Error);
      this.emit('data-processed', {
        plugin: this.getName(),
        processing_time: Date.now() - startTime,
        success: false,
        error: error.message,
      });
      throw error;
    }
  }

  // ========================
  // Health Monitoring
  // ========================

  /**
   * Perform health check
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      const details = {
        status: this.status,
        error_count: this.errorCount,
        operations_count: this.metadata.operations_count || 0,
        last_operation: this.metadata.last_operation_at,
        config_valid: this.isConfigurationValid(),
        dependencies_satisfied: await this.checkDependencies(),
      };

      const healthy =
        this.status === 'active' &&
        this.errorCount < this.maxErrors &&
        details.config_valid &&
        details.dependencies_satisfied;

      return { healthy, details };
    } catch (error) {
      return {
        healthy: false,
        details: { error: error.message },
      };
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics(): any {
    const avgProcessingTime =
      this.metadata.operations_count > 0
        ? (this.metadata.total_processing_time || 0) / this.metadata.operations_count
        : 0;

    return {
      plugin_name: this.getName(),
      version: this.getVersion(),
      status: this.status,
      operations_count: this.metadata.operations_count || 0,
      error_count: this.errorCount,
      error_rate:
        this.metadata.operations_count > 0 ? this.errorCount / this.metadata.operations_count : 0,
      average_processing_time: avgProcessingTime,
      total_processing_time: this.metadata.total_processing_time || 0,
      uptime: this.metadata.initialized_at
        ? Date.now() - this.metadata.initialized_at.getTime()
        : 0,
      last_operation_at: this.metadata.last_operation_at,
    };
  }

  // ========================
  // Protected Helper Methods
  // ========================

  /**
   * Merge user config with defaults
   */
  protected mergeWithDefaults(userConfig: PluginConfig): PluginConfig {
    const defaults = this.getDefaultConfig();
    return {
      ...defaults,
      ...userConfig,
      // Merge nested objects
      ...(defaults.options &&
        userConfig.options && {
          options: { ...defaults.options, ...userConfig.options },
        }),
    };
  }

  /**
   * Initialize plugin metadata
   */
  protected initializeMetadata(): PluginMetadata {
    return {
      name: this.getName(),
      version: this.getVersion(),
      description: this.getDescription(),
      mvp_version: this.getMVPVersion(),
      dependencies: this.getDependencies(),
      operations_count: 0,
      total_processing_time: 0,
      error_count: 0,
    };
  }

  /**
   * Validate plugin configuration
   */
  protected validateConfiguration(): void {
    // Basic validation - can be overridden by concrete plugins
    if (!this.config) {
      throw new Error('Plugin configuration is required');
    }

    if (this.config.enabled === false) {
      throw new Error('Plugin is disabled in configuration');
    }
  }

  /**
   * Check if configuration is valid
   */
  protected isConfigurationValid(): boolean {
    try {
      this.validateConfiguration();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate plugin dependencies
   */
  protected async validateDependencies(): Promise<void> {
    const dependencies = this.getDependencies();

    for (const dependency of dependencies) {
      const satisfied = await this.checkDependency(dependency);
      if (!satisfied) {
        throw new Error(`Dependency not satisfied: ${dependency}`);
      }
    }
  }

  /**
   * Check if dependencies are satisfied
   */
  protected async checkDependencies(): Promise<boolean> {
    try {
      await this.validateDependencies();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check individual dependency
   */
  protected async checkDependency(dependency: string): Promise<boolean> {
    // Basic implementation - can be overridden
    // Check if adapter supports required operations
    if (dependency === 'full-text-search') {
      return typeof this.adapter.searchEntries === 'function';
    }

    if (dependency === 'transactions') {
      return typeof this.adapter.beginTransaction === 'function';
    }

    if (dependency === 'raw-sql') {
      return typeof this.adapter.executeSQL === 'function';
    }

    return true;
  }

  /**
   * Handle plugin errors
   */
  protected handleError(error: Error): void {
    this.errorCount++;

    this.emit('error', {
      plugin: this.getName(),
      error: error.message,
      error_count: this.errorCount,
      timestamp: new Date(),
    });

    // Auto-disable plugin if too many errors
    if (this.errorCount >= this.maxErrors) {
      this.status = 'error';
      this.emit('status-change', this.status);
      console.error(`❌ Plugin ${this.getName()} disabled due to excessive errors`);
    }

    console.error(`Plugin ${this.getName()} error:`, error.message);
  }

  /**
   * Calculate data size for metrics
   */
  protected getDataSize(data: any): number {
    if (typeof data === 'string') {
      return data.length;
    }

    if (typeof data === 'object') {
      return JSON.stringify(data).length;
    }

    return 0;
  }

  /**
   * Execute database operation with error handling
   */
  protected async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const pluginError = new Error(
        `Plugin ${this.getName()} failed during ${operationName}: ${error.message}`
      );
      this.handleError(pluginError);
      throw pluginError;
    }
  }

  /**
   * Validate input data
   */
  protected validateInput(data: any, schema?: any): boolean {
    // Basic validation - can be enhanced with schema validation
    return data !== null && data !== undefined;
  }

  /**
   * Log plugin activity
   */
  protected log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    const logMessage = `[${this.getName()}] ${message}`;

    switch (level) {
      case 'info':
        console.log(logMessage, data || '');
        break;
      case 'warn':
        console.warn(logMessage, data || '');
        break;
      case 'error':
        console.error(logMessage, data || '');
        break;
    }

    this.emit('log', {
      plugin: this.getName(),
      level,
      message,
      data,
      timestamp: new Date(),
    });
  }
}
