"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationMemoryStore = void 0;
const events_1 = require("events");
class IntegrationMemoryStore extends events_1.EventEmitter {
    integrationMappings = new Map();
    serviceConnections = new Map();
    configurations = new Map();
    runtimeStates = new Map();
    performanceMetrics = new Map();
    messageQueue = new Map();
    config;
    cleanupTimer = null;
    constructor(config = {}) {
        super();
        this.config = {
            maxMappings: 1000,
            maxConfigurations: 500,
            maxStates: 100,
            maxMetrics: 10000,
            maxMessages: 1000,
            cleanupInterval: 5 * 60 * 1000,
            persistenceEnabled: true,
            encryptionEnabled: false,
            compressionEnabled: true,
            ...config
        };
        this.startCleanupTimer();
        this.loadPersistedData();
        console.log('IntegrationMemoryStore initialized');
    }
    storeIntegrationMapping(mapping) {
        const id = this.generateId();
        const fullMapping = {
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
    getIntegrationMapping(id) {
        return this.integrationMappings.get(id) || null;
    }
    updateIntegrationMapping(id, updates) {
        const existing = this.integrationMappings.get(id);
        if (!existing)
            return false;
        const updated = {
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
    getMappingsByType(type) {
        return Array.from(this.integrationMappings.values())
            .filter(mapping => mapping.type === type);
    }
    removeIntegrationMapping(id) {
        const deleted = this.integrationMappings.delete(id);
        if (deleted) {
            this.emit('mappingRemoved', { id });
            this.persistData('integrationMappings');
        }
        return deleted;
    }
    registerServiceConnection(connection) {
        this.serviceConnections.set(connection.serviceId, connection);
        this.emit('serviceRegistered', connection);
        this.persistData('serviceConnections');
    }
    getServiceConnection(serviceId) {
        return this.serviceConnections.get(serviceId) || null;
    }
    updateServiceMetrics(serviceId, metrics) {
        const connection = this.serviceConnections.get(serviceId);
        if (!connection)
            return false;
        connection.metrics = { ...connection.metrics, ...metrics };
        this.emit('serviceMetricsUpdated', { serviceId, metrics: connection.metrics });
        return true;
    }
    getAllServiceConnections() {
        return Array.from(this.serviceConnections.values());
    }
    setConfig(key, value, options = {}) {
        const config = {
            key,
            value: options.encrypted ? this.encrypt(value) : value,
            type: options.type || this.inferType(value),
            source: options.source || 'runtime',
            encrypted: options.encrypted || false,
            lastModified: Date.now(),
            validators: options.validators
        };
        if (config.validators && !this.validateConfig(config)) {
            throw new Error(`Configuration validation failed for key: ${key}`);
        }
        this.configurations.set(key, config);
        this.enforceMapLimit('configurations', this.configurations, this.config.maxConfigurations);
        this.emit('configChanged', { key, value });
        this.persistData('configurations');
    }
    getConfig(key, defaultValue) {
        const config = this.configurations.get(key);
        if (!config)
            return defaultValue;
        const value = config.encrypted ? this.decrypt(config.value) : config.value;
        return value;
    }
    getAllConfigurations() {
        const result = {};
        for (const [key, config] of this.configurations) {
            result[key] = config.encrypted ? this.decrypt(config.value) : config.value;
        }
        return result;
    }
    removeConfig(key) {
        const deleted = this.configurations.delete(key);
        if (deleted) {
            this.emit('configRemoved', { key });
            this.persistData('configurations');
        }
        return deleted;
    }
    storeRuntimeState(componentId, state) {
        const existing = this.runtimeStates.get(componentId);
        const runtimeState = {
            componentId,
            state,
            timestamp: Date.now(),
            version: existing ? existing.version + 1 : 1,
            subscribers: existing?.subscribers || [],
            dirty: true
        };
        this.runtimeStates.set(componentId, runtimeState);
        this.enforceMapLimit('states', this.runtimeStates, this.config.maxStates);
        this.notifyStateSubscribers(componentId, state);
        this.emit('stateChanged', { componentId, state, version: runtimeState.version });
        this.persistData('runtimeStates');
    }
    getRuntimeState(componentId) {
        const state = this.runtimeStates.get(componentId);
        return state?.state || null;
    }
    subscribeToState(componentId, subscriberId) {
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
    clearRuntimeState(componentId) {
        const deleted = this.runtimeStates.delete(componentId);
        if (deleted) {
            this.emit('stateCleared', { componentId });
            this.persistData('runtimeStates');
        }
        return deleted;
    }
    storeMetric(metric) {
        const metrics = this.performanceMetrics.get(metric.name) || [];
        metrics.push(metric);
        if (metrics.length > 1000) {
            metrics.shift();
        }
        this.performanceMetrics.set(metric.name, metrics);
        this.emit('metricStored', metric);
    }
    getMetrics(name, timeRange) {
        const metrics = this.performanceMetrics.get(name) || [];
        if (!timeRange)
            return metrics;
        return metrics.filter(m => m.timestamp >= timeRange.from && m.timestamp <= timeRange.to);
    }
    getAggregatedMetrics(name, aggregation) {
        const metrics = this.performanceMetrics.get(name) || [];
        if (metrics.length === 0)
            return 0;
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
    sendMessage(message) {
        const fullMessage = {
            ...message,
            id: this.generateId(),
            timestamp: Date.now()
        };
        const messages = this.messageQueue.get(message.to) || [];
        messages.push(fullMessage);
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
    receiveMessages(componentId, limit) {
        const messages = this.messageQueue.get(componentId) || [];
        const result = limit ? messages.splice(0, limit) : messages.splice(0);
        if (result.length > 0) {
            this.emit('messagesReceived', { componentId, count: result.length });
        }
        return result;
    }
    getMessageCount(componentId) {
        const messages = this.messageQueue.get(componentId) || [];
        return messages.length;
    }
    updateIntegrationHealth(integrationId, health) {
        const mapping = this.integrationMappings.get(integrationId);
        if (!mapping)
            return false;
        mapping.metadata.healthCheck = health;
        mapping.metadata.updatedAt = Date.now();
        this.emit('healthUpdated', { integrationId, health });
        return true;
    }
    getIntegrationHealth(integrationId) {
        const mapping = this.integrationMappings.get(integrationId);
        return mapping?.metadata.healthCheck || null;
    }
    getSystemHealth() {
        const integrations = Array.from(this.integrationMappings.values());
        const healthChecks = integrations
            .map(i => i.metadata.healthCheck)
            .filter(Boolean);
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
    getMemoryUsage() {
        const stats = {
            integrationMappings: this.integrationMappings.size,
            serviceConnections: this.serviceConnections.size,
            configurations: this.configurations.size,
            runtimeStates: this.runtimeStates.size,
            performanceMetrics: Array.from(this.performanceMetrics.values()).reduce((sum, arr) => sum + arr.length, 0),
            messageQueue: Array.from(this.messageQueue.values()).reduce((sum, arr) => sum + arr.length, 0),
            totalSize: 0
        };
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
    clearExpiredData() {
        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        for (const [name, metrics] of this.performanceMetrics) {
            const recent = metrics.filter(m => m.timestamp > oneDayAgo);
            this.performanceMetrics.set(name, recent);
        }
        for (const [componentId, messages] of this.messageQueue) {
            const valid = messages.filter(m => !m.expiry || m.expiry > now);
            this.messageQueue.set(componentId, valid);
        }
        this.emit('dataCleared', { timestamp: now });
    }
    exportData() {
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
    importData(data) {
        this.integrationMappings = new Map(data.integrationMappings);
        this.serviceConnections = new Map(data.serviceConnections);
        this.configurations = new Map(data.configurations);
        this.runtimeStates = new Map(data.runtimeStates);
        this.performanceMetrics = new Map(data.performanceMetrics);
        this.messageQueue = new Map(data.messageQueue);
        this.emit('dataImported', { timestamp: data.timestamp });
    }
    startCleanupTimer() {
        this.cleanupTimer = setInterval(() => {
            this.clearExpiredData();
        }, this.config.cleanupInterval);
    }
    enforceMapLimit(name, map, limit) {
        if (map.size > limit) {
            const excess = map.size - limit;
            const keys = Array.from(map.keys()).slice(0, excess);
            keys.forEach(key => map.delete(key));
            console.warn(`Enforced limit on ${name}: removed ${excess} entries`);
        }
    }
    notifyStateSubscribers(componentId, state) {
        const stateInfo = this.runtimeStates.get(componentId);
        if (!stateInfo)
            return;
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
    validateConfig(config) {
        if (!config.validators)
            return true;
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
    inferType(value) {
        if (Array.isArray(value))
            return 'array';
        if (typeof value === 'object' && value !== null)
            return 'object';
        if (typeof value === 'boolean')
            return 'boolean';
        if (typeof value === 'number')
            return 'number';
        return 'string';
    }
    encrypt(value) {
        if (!this.config.encryptionEnabled)
            return value;
        return btoa(JSON.stringify(value));
    }
    decrypt(value) {
        if (!this.config.encryptionEnabled)
            return value;
        try {
            return JSON.parse(atob(value));
        }
        catch {
            return value;
        }
    }
    persistData(dataType) {
        if (!this.config.persistenceEnabled)
            return;
        try {
            const key = `integration-memory-store-${dataType}`;
            let data;
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
        }
        catch (error) {
            console.warn(`Failed to persist ${dataType}:`, error);
        }
    }
    loadPersistedData() {
        if (!this.config.persistenceEnabled)
            return;
        try {
            const mappingsData = localStorage.getItem('integration-memory-store-integrationMappings');
            if (mappingsData) {
                this.integrationMappings = new Map(JSON.parse(mappingsData));
            }
            const connectionsData = localStorage.getItem('integration-memory-store-serviceConnections');
            if (connectionsData) {
                this.serviceConnections = new Map(JSON.parse(connectionsData));
            }
            const configsData = localStorage.getItem('integration-memory-store-configurations');
            if (configsData) {
                this.configurations = new Map(JSON.parse(configsData));
            }
            const statesData = localStorage.getItem('integration-memory-store-runtimeStates');
            if (statesData) {
                this.runtimeStates = new Map(JSON.parse(statesData));
            }
            console.log('Persisted data loaded successfully');
        }
        catch (error) {
            console.warn('Failed to load persisted data:', error);
        }
    }
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    destroy() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        if (this.config.persistenceEnabled) {
            this.persistData('integrationMappings');
            this.persistData('serviceConnections');
            this.persistData('configurations');
            this.persistData('runtimeStates');
        }
        this.removeAllListeners();
    }
}
exports.IntegrationMemoryStore = IntegrationMemoryStore;
exports.default = IntegrationMemoryStore;
//# sourceMappingURL=IntegrationMemoryStore.js.map