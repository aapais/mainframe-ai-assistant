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
export type IntegrationType = 'service-adapter' | 'state-management' | 'caching-layer' | 'monitoring' | 'websocket' | 'analytics' | 'export' | 'pagination' | 'search-engine';
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
export declare class IntegrationMemoryStore extends EventEmitter {
    private integrationMappings;
    private serviceConnections;
    private configurations;
    private runtimeStates;
    private performanceMetrics;
    private messageQueue;
    private config;
    private cleanupTimer;
    constructor(config?: Partial<MemoryStoreConfig>);
    storeIntegrationMapping(mapping: Omit<IntegrationMapping, 'id' | 'metadata'>): string;
    getIntegrationMapping(id: string): IntegrationMapping | null;
    updateIntegrationMapping(id: string, updates: Partial<IntegrationMapping>): boolean;
    getMappingsByType(type: IntegrationType): IntegrationMapping[];
    removeIntegrationMapping(id: string): boolean;
    registerServiceConnection(connection: ServiceConnection): void;
    getServiceConnection(serviceId: string): ServiceConnection | null;
    updateServiceMetrics(serviceId: string, metrics: Partial<ServiceConnection['metrics']>): boolean;
    getAllServiceConnections(): ServiceConnection[];
    setConfig(key: string, value: any, options?: {
        type?: ConfigurationEntry['type'];
        source?: ConfigurationEntry['source'];
        encrypted?: boolean;
        validators?: ConfigurationEntry['validators'];
    }): void;
    getConfig<T = any>(key: string, defaultValue?: T): T;
    getAllConfigurations(): Record<string, any>;
    removeConfig(key: string): boolean;
    storeRuntimeState(componentId: string, state: any): void;
    getRuntimeState(componentId: string): any;
    subscribeToState(componentId: string, subscriberId: string): () => void;
    clearRuntimeState(componentId: string): boolean;
    storeMetric(metric: PerformanceMetric): void;
    getMetrics(name: string, timeRange?: {
        from: number;
        to: number;
    }): PerformanceMetric[];
    getAggregatedMetrics(name: string, aggregation: 'sum' | 'average' | 'min' | 'max' | 'count'): number;
    sendMessage(message: Omit<CrossComponentMessage, 'id' | 'timestamp'>): string;
    receiveMessages(componentId: string, limit?: number): CrossComponentMessage[];
    getMessageCount(componentId: string): number;
    updateIntegrationHealth(integrationId: string, health: IntegrationMapping['metadata']['healthCheck']): boolean;
    getIntegrationHealth(integrationId: string): IntegrationMapping['metadata']['healthCheck'] | null;
    getSystemHealth(): {
        totalIntegrations: number;
        healthyIntegrations: number;
        degradedIntegrations: number;
        unhealthyIntegrations: number;
        averageLatency: number;
        totalErrors: number;
    };
    getMemoryUsage(): {
        integrationMappings: number;
        serviceConnections: number;
        configurations: number;
        runtimeStates: number;
        performanceMetrics: number;
        messageQueue: number;
        totalSize: number;
    };
    clearExpiredData(): void;
    exportData(): {
        integrationMappings: Array<[string, IntegrationMapping]>;
        serviceConnections: Array<[string, ServiceConnection]>;
        configurations: Array<[string, ConfigurationEntry]>;
        runtimeStates: Array<[string, RuntimeState]>;
        performanceMetrics: Array<[string, PerformanceMetric[]]>;
        messageQueue: Array<[string, CrossComponentMessage[]]>;
        timestamp: number;
    };
    importData(data: ReturnType<typeof this.exportData>): void;
    private startCleanupTimer;
    private enforceMapLimit;
    private notifyStateSubscribers;
    private validateConfig;
    private inferType;
    private encrypt;
    private decrypt;
    private persistData;
    private loadPersistedData;
    private generateId;
    destroy(): void;
}
export default IntegrationMemoryStore;
//# sourceMappingURL=IntegrationMemoryStore.d.ts.map