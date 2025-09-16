/**
 * Integration Memory Store
 *
 * Centralized memory management for SearchResults integration mappings including:
 * - Service connection mappings
 * - Configuration management
 * - Runtime state tracking
 * - Performance metrics storage
 * - Cross-component communication
 * - Integration health monitoring
 *
 * @version 1.0.0
 */

import { EventEmitter } from 'events';

export interface IntegrationMapping {
  id: string;
  type: IntegrationType;
  source: string;
  target: string;
  status: 'active' | 'inactive' | 'error' | 'connecting';
  config: any;
  metadata: {
    createdAt: number;
    updatedAt: number;
    version: string;
    healthCheck?: {
      lastCheck: number;
      status: 'healthy' | 'degraded' | 'unhealthy';
      latency: number;
      errorRate: number;
    };
  };
}

export type IntegrationType =
  | 'service-adapter'
  | 'state-management'
  | 'caching-layer'
  | 'monitoring'
  | 'websocket'
  | 'analytics'
  | 'export'
  | 'pagination'
  | 'search-engine';

export interface ServiceConnection {
  serviceId: string;
  serviceName: string;
  serviceType: string;
  endpoint?: string;
  credentials?: any;
  configuration: any;
  connectionPool?: {
    active: number;
    idle: number;
    total: number;
  };
  metrics: {
    requestCount: number;
    errorCount: number;
    averageResponseTime: number;
    lastActivity: number;
  };
}

export interface ConfigurationEntry {
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  source: 'default' | 'environment' | 'runtime' | 'user';
  encrypted: boolean;
  lastModified: number;
  validators?: Array<{
    type: string;
    params: any;
    message: string;
  }>;
}

export interface RuntimeState {
  componentId: string;
  state: any;
  timestamp: number;
  version: number;
  subscribers: string[];
  dirty: boolean;
}

export interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  tags: Record<string, string>;
  aggregation?: 'sum' | 'average' | 'min' | 'max' | 'count';
}

export interface CrossComponentMessage {
  id: string;
  from: string;
  to: string;
  type: string;
  payload: any;
  timestamp: number;
  priority: 'low' | 'medium' | 'high';
  expiry?: number;
}

export interface MemoryStoreConfig {
  maxMappings: number;
  maxConfigurations: number;
  maxStates: number;
  maxMetrics: number;
  maxMessages: number;
  cleanupInterval: number;
  persistenceEnabled: boolean;
  encryptionEnabled: boolean;
  compressionEnabled: boolean;
}

/**
 * Centralized memory store for integration management
 */
export class IntegrationMemoryStore extends EventEmitter {
  private integrationMappings = new Map<string, IntegrationMapping>();
  private serviceConnections = new Map<string, ServiceConnection>();
  private configurations = new Map<string, ConfigurationEntry>();
  private runtimeStates = new Map<string, RuntimeState>();
  private performanceMetrics = new Map<string, PerformanceMetric[]>();
  private messageQueue = new Map<string, CrossComponentMessage[]>();

  private config: MemoryStoreConfig;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<MemoryStoreConfig> = {}) {
    super();

    this.config = {
      maxMappings: 1000,
      maxConfigurations: 500,
      maxStates: 100,
      maxMetrics: 10000,
      maxMessages: 1000,
      cleanupInterval: 5 * 60 * 1000, // 5 minutes
      persistenceEnabled: true,
      encryptionEnabled: false,
      compressionEnabled: true,
      ...config
    };

    this.startCleanupTimer();
    this.loadPersistedData();

    console.log('IntegrationMemoryStore initialized');
  }

  // ========================
  // Integration Mappings
  // ========================

  /**
   * Store integration mapping
   */
  storeIntegrationMapping(mapping: Omit<IntegrationMapping, 'id' | 'metadata'>): string {
    const id = this.generateId();
    const fullMapping: IntegrationMapping = {
      ...mapping,
      id,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: '1.0.0'
      }
    };

    this.integrationMappings.set(id, fullMapping);
    this.enforceMapLimit('integrations', this.integrationMappings, this.config.maxMappings);

    this.emit('mappingStored', { id, mapping: fullMapping });
    this.persistData('integrationMappings');

    return id;
  }

  /**
   * Get integration mapping
   */
  getIntegrationMapping(id: string): IntegrationMapping | null {
    return this.integrationMappings.get(id) || null;
  }

  /**
   * Update integration mapping
   */
  updateIntegrationMapping(id: string, updates: Partial<IntegrationMapping>): boolean {
    const existing = this.integrationMappings.get(id);
    if (!existing) return false;

    const updated: IntegrationMapping = {
      ...existing,
      ...updates,
      metadata: {
        ...existing.metadata,
        updatedAt: Date.now()
      }
    };

    this.integrationMappings.set(id, updated);
    this.emit('mappingUpdated', { id, mapping: updated });
    this.persistData('integrationMappings');

    return true;
  }

  /**
   * Get mappings by type
   */
  getMappingsByType(type: IntegrationType): IntegrationMapping[] {
    return Array.from(this.integrationMappings.values())
      .filter(mapping => mapping.type === type);
  }

  /**
   * Remove integration mapping
   */
  removeIntegrationMapping(id: string): boolean {
    const deleted = this.integrationMappings.delete(id);
    if (deleted) {
      this.emit('mappingRemoved', { id });
      this.persistData('integrationMappings');
    }
    return deleted;
  }

  // ========================
  // Service Connections
  // ========================

  /**
   * Register service connection
   */
  registerServiceConnection(connection: ServiceConnection): void {
    this.serviceConnections.set(connection.serviceId, connection);
    this.emit('serviceRegistered', connection);
    this.persistData('serviceConnections');
  }

  /**
   * Get service connection
   */
  getServiceConnection(serviceId: string): ServiceConnection | null {
    return this.serviceConnections.get(serviceId) || null;
  }

  /**
   * Update service metrics
   */
  updateServiceMetrics(serviceId: string, metrics: Partial<ServiceConnection['metrics']>): boolean {
    const connection = this.serviceConnections.get(serviceId);
    if (!connection) return false;

    connection.metrics = { ...connection.metrics, ...metrics };
    this.emit('serviceMetricsUpdated', { serviceId, metrics: connection.metrics });

    return true;
  }

  /**
   * Get all service connections
   */
  getAllServiceConnections(): ServiceConnection[] {
    return Array.from(this.serviceConnections.values());
  }

  // ========================
  // Configuration Management
  // ========================

  /**
   * Set configuration value
   */
  setConfig(key: string, value: any, options: {
    type?: ConfigurationEntry['type'];
    source?: ConfigurationEntry['source'];
    encrypted?: boolean;
    validators?: ConfigurationEntry['validators'];
  } = {}): void {
    const config: ConfigurationEntry = {
      key,
      value: options.encrypted ? this.encrypt(value) : value,
      type: options.type || this.inferType(value),
      source: options.source || 'runtime',
      encrypted: options.encrypted || false,
      lastModified: Date.now(),
      validators: options.validators
    };

    // Validate configuration
    if (config.validators && !this.validateConfig(config)) {
      throw new Error(`Configuration validation failed for key: ${key}`);
    }

    this.configurations.set(key, config);
    this.enforceMapLimit('configurations', this.configurations, this.config.maxConfigurations);

    this.emit('configChanged', { key, value });
    this.persistData('configurations');
  }

  /**
   * Get configuration value
   */
  getConfig<T = any>(key: string, defaultValue?: T): T {
    const config = this.configurations.get(key);
    if (!config) return defaultValue as T;

    const value = config.encrypted ? this.decrypt(config.value) : config.value;
    return value as T;
  }

  /**
   * Get all configurations
   */
  getAllConfigurations(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, config] of this.configurations) {
      result[key] = config.encrypted ? this.decrypt(config.value) : config.value;
    }
    return result;
  }

  /**
   * Remove configuration
   */
  removeConfig(key: string): boolean {
    const deleted = this.configurations.delete(key);
    if (deleted) {
      this.emit('configRemoved', { key });
      this.persistData('configurations');
    }
    return deleted;
  }

  // ========================
  // Runtime State Management
  // ========================

  /**
   * Store runtime state
   */
  storeRuntimeState(componentId: string, state: any): void {
    const existing = this.runtimeStates.get(componentId);
    const runtimeState: RuntimeState = {
      componentId,
      state,
      timestamp: Date.now(),
      version: existing ? existing.version + 1 : 1,
      subscribers: existing?.subscribers || [],
      dirty: true
    };

    this.runtimeStates.set(componentId, runtimeState);
    this.enforceMapLimit('states', this.runtimeStates, this.config.maxStates);

    // Notify subscribers
    this.notifyStateSubscribers(componentId, state);

    this.emit('stateChanged', { componentId, state, version: runtimeState.version });
    this.persistData('runtimeStates');
  }

  /**
   * Get runtime state
   */
  getRuntimeState(componentId: string): any {
    const state = this.runtimeStates.get(componentId);
    return state?.state || null;
  }

  /**
   * Subscribe to state changes
   */
  subscribeToState(componentId: string, subscriberId: string): () => void {
    const state = this.runtimeStates.get(componentId);
    if (state && !state.subscribers.includes(subscriberId)) {
      state.subscribers.push(subscriberId);
    }

    return () => {
      const currentState = this.runtimeStates.get(componentId);
      if (currentState) {
        currentState.subscribers = currentState.subscribers.filter(id => id !== subscriberId);
      }
    };
  }

  /**
   * Clear runtime state
   */
  clearRuntimeState(componentId: string): boolean {
    const deleted = this.runtimeStates.delete(componentId);
    if (deleted) {
      this.emit('stateCleared', { componentId });
      this.persistData('runtimeStates');
    }
    return deleted;
  }

  // ========================
  // Performance Metrics
  // ========================

  /**
   * Store performance metric
   */
  storeMetric(metric: PerformanceMetric): void {
    const metrics = this.performanceMetrics.get(metric.name) || [];
    metrics.push(metric);

    // Keep only recent metrics
    if (metrics.length > 1000) {
      metrics.shift();
    }

    this.performanceMetrics.set(metric.name, metrics);
    this.emit('metricStored', metric);
  }

  /**
   * Get performance metrics
   */
  getMetrics(name: string, timeRange?: { from: number; to: number }): PerformanceMetric[] {
    const metrics = this.performanceMetrics.get(name) || [];

    if (!timeRange) return metrics;

    return metrics.filter(m =>
      m.timestamp >= timeRange.from && m.timestamp <= timeRange.to
    );
  }

  /**
   * Get aggregated metrics
   */
  getAggregatedMetrics(name: string, aggregation: 'sum' | 'average' | 'min' | 'max' | 'count'): number {
    const metrics = this.performanceMetrics.get(name) || [];
    if (metrics.length === 0) return 0;

    const values = metrics.map(m => m.value);

    switch (aggregation) {
      case 'sum':
        return values.reduce((sum, val) => sum + val, 0);
      case 'average':
        return values.reduce((sum, val) => sum + val, 0) / values.length;
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      case 'count':
        return values.length;
      default:
        return 0;
    }
  }

  // ========================
  // Cross-Component Messaging
  // ========================

  /**
   * Send message between components
   */
  sendMessage(message: Omit<CrossComponentMessage, 'id' | 'timestamp'>): string {
    const fullMessage: CrossComponentMessage = {
      ...message,
      id: this.generateId(),
      timestamp: Date.now()
    };

    const messages = this.messageQueue.get(message.to) || [];
    messages.push(fullMessage);

    // Sort by priority and timestamp
    messages.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      return priorityDiff !== 0 ? priorityDiff : a.timestamp - b.timestamp;
    });

    this.messageQueue.set(message.to, messages);
    this.enforceMapLimit('messages', this.messageQueue, this.config.maxMessages);

    this.emit('messageSent', fullMessage);

    return fullMessage.id;
  }

  /**
   * Receive messages for component
   */
  receiveMessages(componentId: string, limit?: number): CrossComponentMessage[] {
    const messages = this.messageQueue.get(componentId) || [];
    const result = limit ? messages.splice(0, limit) : messages.splice(0);

    if (result.length > 0) {
      this.emit('messagesReceived', { componentId, count: result.length });
    }

    return result;
  }

  /**
   * Get message count for component
   */
  getMessageCount(componentId: string): number {
    const messages = this.messageQueue.get(componentId) || [];
    return messages.length;
  }

  // ========================
  // Health Monitoring
  // ========================

  /**
   * Update integration health
   */
  updateIntegrationHealth(
    integrationId: string,
    health: IntegrationMapping['metadata']['healthCheck']
  ): boolean {
    const mapping = this.integrationMappings.get(integrationId);
    if (!mapping) return false;

    mapping.metadata.healthCheck = health;
    mapping.metadata.updatedAt = Date.now();

    this.emit('healthUpdated', { integrationId, health });
    return true;
  }

  /**
   * Get integration health status
   */
  getIntegrationHealth(integrationId: string): IntegrationMapping['metadata']['healthCheck'] | null {
    const mapping = this.integrationMappings.get(integrationId);
    return mapping?.metadata.healthCheck || null;
  }

  /**
   * Get overall system health
   */
  getSystemHealth(): {
    totalIntegrations: number;
    healthyIntegrations: number;
    degradedIntegrations: number;
    unhealthyIntegrations: number;
    averageLatency: number;
    totalErrors: number;
  } {
    const integrations = Array.from(this.integrationMappings.values());
    const healthChecks = integrations
      .map(i => i.metadata.healthCheck)
      .filter(Boolean) as NonNullable<IntegrationMapping['metadata']['healthCheck']>[];

    const healthy = healthChecks.filter(h => h.status === 'healthy').length;
    const degraded = healthChecks.filter(h => h.status === 'degraded').length;
    const unhealthy = healthChecks.filter(h => h.status === 'unhealthy').length;

    const averageLatency = healthChecks.length > 0
      ? healthChecks.reduce((sum, h) => sum + h.latency, 0) / healthChecks.length
      : 0;

    const totalErrors = healthChecks.reduce((sum, h) => sum + h.errorRate, 0);

    return {
      totalIntegrations: integrations.length,
      healthyIntegrations: healthy,
      degradedIntegrations: degraded,
      unhealthyIntegrations: unhealthy,
      averageLatency,
      totalErrors
    };
  }

  // ========================
  // Memory Management
  // ========================

  /**
   * Get memory usage statistics
   */
  getMemoryUsage(): {
    integrationMappings: number;
    serviceConnections: number;
    configurations: number;
    runtimeStates: number;
    performanceMetrics: number;
    messageQueue: number;
    totalSize: number;
  } {
    const stats = {
      integrationMappings: this.integrationMappings.size,
      serviceConnections: this.serviceConnections.size,
      configurations: this.configurations.size,
      runtimeStates: this.runtimeStates.size,
      performanceMetrics: Array.from(this.performanceMetrics.values()).reduce((sum, arr) => sum + arr.length, 0),
      messageQueue: Array.from(this.messageQueue.values()).reduce((sum, arr) => sum + arr.length, 0),
      totalSize: 0
    };

    // Estimate total memory usage
    stats.totalSize = JSON.stringify({
      integrationMappings: Array.from(this.integrationMappings.entries()),
      serviceConnections: Array.from(this.serviceConnections.entries()),
      configurations: Array.from(this.configurations.entries()),
      runtimeStates: Array.from(this.runtimeStates.entries()),
      performanceMetrics: Array.from(this.performanceMetrics.entries()),
      messageQueue: Array.from(this.messageQueue.entries())
    }).length;

    return stats;
  }

  /**
   * Clear expired data
   */
  clearExpiredData(): void {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // Clear old performance metrics
    for (const [name, metrics] of this.performanceMetrics) {
      const recent = metrics.filter(m => m.timestamp > oneDayAgo);
      this.performanceMetrics.set(name, recent);
    }

    // Clear expired messages
    for (const [componentId, messages] of this.messageQueue) {
      const valid = messages.filter(m => !m.expiry || m.expiry > now);
      this.messageQueue.set(componentId, valid);
    }

    this.emit('dataCleared', { timestamp: now });
  }

  /**
   * Export all data
   */
  exportData(): {
    integrationMappings: Array<[string, IntegrationMapping]>;
    serviceConnections: Array<[string, ServiceConnection]>;
    configurations: Array<[string, ConfigurationEntry]>;
    runtimeStates: Array<[string, RuntimeState]>;
    performanceMetrics: Array<[string, PerformanceMetric[]]>;
    messageQueue: Array<[string, CrossComponentMessage[]]>;
    timestamp: number;
  } {
    return {
      integrationMappings: Array.from(this.integrationMappings.entries()),
      serviceConnections: Array.from(this.serviceConnections.entries()),
      configurations: Array.from(this.configurations.entries()),
      runtimeStates: Array.from(this.runtimeStates.entries()),
      performanceMetrics: Array.from(this.performanceMetrics.entries()),
      messageQueue: Array.from(this.messageQueue.entries()),
      timestamp: Date.now()
    };
  }

  /**
   * Import data
   */
  importData(data: ReturnType<typeof this.exportData>): void {
    this.integrationMappings = new Map(data.integrationMappings);
    this.serviceConnections = new Map(data.serviceConnections);
    this.configurations = new Map(data.configurations);
    this.runtimeStates = new Map(data.runtimeStates);
    this.performanceMetrics = new Map(data.performanceMetrics);
    this.messageQueue = new Map(data.messageQueue);

    this.emit('dataImported', { timestamp: data.timestamp });
  }

  // ========================
  // Private Methods
  // ========================

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.clearExpiredData();
    }, this.config.cleanupInterval);
  }

  private enforceMapLimit<T>(name: string, map: Map<string, T>, limit: number): void {
    if (map.size > limit) {
      const excess = map.size - limit;
      const keys = Array.from(map.keys()).slice(0, excess);
      keys.forEach(key => map.delete(key));

      console.warn(`Enforced limit on ${name}: removed ${excess} entries`);
    }
  }

  private notifyStateSubscribers(componentId: string, state: any): void {
    const stateInfo = this.runtimeStates.get(componentId);
    if (!stateInfo) return;

    stateInfo.subscribers.forEach(subscriberId => {
      this.sendMessage({
        from: 'memory-store',
        to: subscriberId,
        type: 'stateUpdate',
        payload: { componentId, state },
        priority: 'medium'
      });
    });
  }

  private validateConfig(config: ConfigurationEntry): boolean {
    if (!config.validators) return true;

    return config.validators.every(validator => {
      switch (validator.type) {
        case 'required':
          return config.value != null;
        case 'type':
          return typeof config.value === validator.params.expectedType;
        case 'range':
          return config.value >= validator.params.min && config.value <= validator.params.max;
        case 'pattern':
          return new RegExp(validator.params.pattern).test(String(config.value));
        default:
          return true;
      }
    });
  }

  private inferType(value: any): ConfigurationEntry['type'] {
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object' && value !== null) return 'object';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    return 'string';
  }

  private encrypt(value: any): any {
    if (!this.config.encryptionEnabled) return value;

    // Simple base64 encoding - in production, use proper encryption
    return btoa(JSON.stringify(value));
  }

  private decrypt(value: any): any {
    if (!this.config.encryptionEnabled) return value;

    try {
      return JSON.parse(atob(value));
    } catch {
      return value;
    }
  }

  private persistData(dataType: string): void {
    if (!this.config.persistenceEnabled) return;

    try {
      const key = `integration-memory-store-${dataType}`;
      let data: any;

      switch (dataType) {
        case 'integrationMappings':
          data = Array.from(this.integrationMappings.entries());
          break;
        case 'serviceConnections':
          data = Array.from(this.serviceConnections.entries());
          break;
        case 'configurations':
          data = Array.from(this.configurations.entries());
          break;
        case 'runtimeStates':
          data = Array.from(this.runtimeStates.entries());
          break;
        default:
          return;
      }

      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.warn(`Failed to persist ${dataType}:`, error);
    }
  }

  private loadPersistedData(): void {
    if (!this.config.persistenceEnabled) return;

    try {
      // Load integration mappings
      const mappingsData = localStorage.getItem('integration-memory-store-integrationMappings');
      if (mappingsData) {
        this.integrationMappings = new Map(JSON.parse(mappingsData));
      }

      // Load service connections
      const connectionsData = localStorage.getItem('integration-memory-store-serviceConnections');
      if (connectionsData) {
        this.serviceConnections = new Map(JSON.parse(connectionsData));
      }

      // Load configurations
      const configsData = localStorage.getItem('integration-memory-store-configurations');
      if (configsData) {
        this.configurations = new Map(JSON.parse(configsData));
      }

      // Load runtime states
      const statesData = localStorage.getItem('integration-memory-store-runtimeStates');
      if (statesData) {
        this.runtimeStates = new Map(JSON.parse(statesData));
      }

      console.log('Persisted data loaded successfully');

    } catch (error) {
      console.warn('Failed to load persisted data:', error);
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // Persist final state
    if (this.config.persistenceEnabled) {
      this.persistData('integrationMappings');
      this.persistData('serviceConnections');
      this.persistData('configurations');
      this.persistData('runtimeStates');
    }

    this.removeAllListeners();
  }
}

export default IntegrationMemoryStore;