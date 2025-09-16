"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseStoragePlugin = void 0;
const events_1 = require("events");
class BaseStoragePlugin extends events_1.EventEmitter {
    adapter;
    config;
    metadata;
    status = 'inactive';
    errorCount = 0;
    maxErrors = 10;
    constructor(adapter, config = {}) {
        super();
        this.adapter = adapter;
        this.config = this.mergeWithDefaults(config);
        this.metadata = this.initializeMetadata();
    }
    async initialize() {
        try {
            this.status = 'initializing';
            this.emit('status-change', this.status);
            await this.validateDependencies();
            this.validateConfiguration();
            await this.initializePlugin();
            this.status = 'active';
            this.metadata.initialized_at = new Date();
            this.emit('status-change', this.status);
            this.emit('initialized', this.metadata);
            console.log(`✅ Plugin ${this.getName()} v${this.getVersion()} initialized successfully`);
        }
        catch (error) {
            this.status = 'error';
            this.handleError(error);
            throw error;
        }
    }
    async shutdown() {
        try {
            this.status = 'shutting-down';
            this.emit('status-change', this.status);
            await this.cleanupPlugin();
            this.status = 'inactive';
            this.emit('status-change', this.status);
            this.emit('shutdown', this.metadata);
            console.log(`✅ Plugin ${this.getName()} shutdown successfully`);
        }
        catch (error) {
            this.handleError(error);
            throw error;
        }
    }
    isActive() {
        return this.status === 'active';
    }
    getStatus() {
        return this.status;
    }
    getConfig() {
        return { ...this.config };
    }
    async updateConfig(newConfig) {
        const oldConfig = { ...this.config };
        this.config = { ...this.config, ...newConfig };
        try {
            this.validateConfiguration();
            this.emit('config-updated', { old: oldConfig, new: this.config });
        }
        catch (error) {
            this.config = oldConfig;
            throw error;
        }
    }
    getMetadata() {
        return {
            ...this.metadata,
            status: this.status,
            error_count: this.errorCount
        };
    }
    async process(data, context) {
        if (!this.isActive()) {
            throw new Error(`Plugin ${this.getName()} is not active`);
        }
        const startTime = Date.now();
        try {
            this.metadata.operations_count = (this.metadata.operations_count || 0) + 1;
            const result = await this.processData(data, context);
            const processingTime = Date.now() - startTime;
            this.metadata.total_processing_time = (this.metadata.total_processing_time || 0) + processingTime;
            this.metadata.last_operation_at = new Date();
            this.emit('data-processed', {
                plugin: this.getName(),
                processing_time: processingTime,
                success: true,
                data_size: this.getDataSize(data)
            });
            return result;
        }
        catch (error) {
            this.handleError(error);
            this.emit('data-processed', {
                plugin: this.getName(),
                processing_time: Date.now() - startTime,
                success: false,
                error: error.message
            });
            throw error;
        }
    }
    async healthCheck() {
        try {
            const details = {
                status: this.status,
                error_count: this.errorCount,
                operations_count: this.metadata.operations_count || 0,
                last_operation: this.metadata.last_operation_at,
                config_valid: this.isConfigurationValid(),
                dependencies_satisfied: await this.checkDependencies()
            };
            const healthy = this.status === 'active' &&
                this.errorCount < this.maxErrors &&
                details.config_valid &&
                details.dependencies_satisfied;
            return { healthy, details };
        }
        catch (error) {
            return {
                healthy: false,
                details: { error: error.message }
            };
        }
    }
    getMetrics() {
        const avgProcessingTime = this.metadata.operations_count > 0
            ? (this.metadata.total_processing_time || 0) / this.metadata.operations_count
            : 0;
        return {
            plugin_name: this.getName(),
            version: this.getVersion(),
            status: this.status,
            operations_count: this.metadata.operations_count || 0,
            error_count: this.errorCount,
            error_rate: this.metadata.operations_count > 0
                ? this.errorCount / this.metadata.operations_count
                : 0,
            average_processing_time: avgProcessingTime,
            total_processing_time: this.metadata.total_processing_time || 0,
            uptime: this.metadata.initialized_at
                ? Date.now() - this.metadata.initialized_at.getTime()
                : 0,
            last_operation_at: this.metadata.last_operation_at
        };
    }
    mergeWithDefaults(userConfig) {
        const defaults = this.getDefaultConfig();
        return {
            ...defaults,
            ...userConfig,
            ...(defaults.options && userConfig.options && {
                options: { ...defaults.options, ...userConfig.options }
            })
        };
    }
    initializeMetadata() {
        return {
            name: this.getName(),
            version: this.getVersion(),
            description: this.getDescription(),
            mvp_version: this.getMVPVersion(),
            dependencies: this.getDependencies(),
            operations_count: 0,
            total_processing_time: 0,
            error_count: 0
        };
    }
    validateConfiguration() {
        if (!this.config) {
            throw new Error('Plugin configuration is required');
        }
        if (this.config.enabled === false) {
            throw new Error('Plugin is disabled in configuration');
        }
    }
    isConfigurationValid() {
        try {
            this.validateConfiguration();
            return true;
        }
        catch {
            return false;
        }
    }
    async validateDependencies() {
        const dependencies = this.getDependencies();
        for (const dependency of dependencies) {
            const satisfied = await this.checkDependency(dependency);
            if (!satisfied) {
                throw new Error(`Dependency not satisfied: ${dependency}`);
            }
        }
    }
    async checkDependencies() {
        try {
            await this.validateDependencies();
            return true;
        }
        catch {
            return false;
        }
    }
    async checkDependency(dependency) {
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
    handleError(error) {
        this.errorCount++;
        this.emit('error', {
            plugin: this.getName(),
            error: error.message,
            error_count: this.errorCount,
            timestamp: new Date()
        });
        if (this.errorCount >= this.maxErrors) {
            this.status = 'error';
            this.emit('status-change', this.status);
            console.error(`❌ Plugin ${this.getName()} disabled due to excessive errors`);
        }
        console.error(`Plugin ${this.getName()} error:`, error.message);
    }
    getDataSize(data) {
        if (typeof data === 'string') {
            return data.length;
        }
        if (typeof data === 'object') {
            return JSON.stringify(data).length;
        }
        return 0;
    }
    async executeWithErrorHandling(operation, operationName) {
        try {
            return await operation();
        }
        catch (error) {
            const pluginError = new Error(`Plugin ${this.getName()} failed during ${operationName}: ${error.message}`);
            this.handleError(pluginError);
            throw pluginError;
        }
    }
    validateInput(data, schema) {
        return data !== null && data !== undefined;
    }
    log(level, message, data) {
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
            timestamp: new Date()
        });
    }
}
exports.BaseStoragePlugin = BaseStoragePlugin;
//# sourceMappingURL=BaseStoragePlugin.js.map