"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OptimizationServiceFactory = void 0;
const OptimizationEngine_1 = require("./OptimizationEngine");
const OptimizationDashboard_1 = require("./OptimizationDashboard");
const OptimizationMetricsAggregator_1 = require("./OptimizationMetricsAggregator");
class OptimizationServiceFactory {
    static instance;
    services = null;
    initialized = false;
    constructor() { }
    static getInstance() {
        if (!OptimizationServiceFactory.instance) {
            OptimizationServiceFactory.instance = new OptimizationServiceFactory();
        }
        return OptimizationServiceFactory.instance;
    }
    async createServices(config = {}) {
        if (this.services && this.initialized) {
            return this.services;
        }
        console.log('Creating optimization services...');
        const engine = new OptimizationEngine_1.OptimizationEngine(config.optimization);
        let dashboard = null;
        if (config.enableDashboard !== false) {
            dashboard = new OptimizationDashboard_1.OptimizationDashboard(engine);
        }
        let metricsAggregator = null;
        if (config.enableMetricsAggregation !== false) {
            metricsAggregator = new OptimizationMetricsAggregator_1.OptimizationMetricsAggregator(engine);
        }
        this.services = {
            engine,
            dashboard,
            metricsAggregator
        };
        if (config.autoStart !== false) {
            await this.initializeServices();
        }
        console.log('Optimization services created successfully');
        return this.services;
    }
    async initializeServices() {
        if (!this.services) {
            throw new Error('Services must be created before initialization');
        }
        if (this.initialized) {
            return;
        }
        console.log('Initializing optimization services...');
        await this.services.engine.initialize();
        if (this.services.dashboard) {
            await this.services.dashboard.initialize();
        }
        if (this.services.metricsAggregator) {
            await this.services.metricsAggregator.initialize();
        }
        this.initialized = true;
        console.log('Optimization services initialized successfully');
    }
    getServices() {
        if (!this.services) {
            throw new Error('Services have not been created. Call createServices() first.');
        }
        return this.services;
    }
    getEngine() {
        return this.getServices().engine;
    }
    getDashboard() {
        const services = this.getServices();
        if (!services.dashboard) {
            throw new Error('Dashboard is not enabled');
        }
        return services.dashboard;
    }
    getMetricsAggregator() {
        const services = this.getServices();
        if (!services.metricsAggregator) {
            throw new Error('Metrics aggregator is not enabled');
        }
        return services.metricsAggregator;
    }
    isInitialized() {
        return this.initialized;
    }
    async destroyServices() {
        if (!this.services) {
            return;
        }
        console.log('Destroying optimization services...');
        if (this.services.metricsAggregator) {
            await this.services.metricsAggregator.destroy();
        }
        if (this.services.dashboard) {
            await this.services.dashboard.destroy();
        }
        await this.services.engine.destroy();
        this.services = null;
        this.initialized = false;
        console.log('Optimization services destroyed');
    }
    static async createDefaultServices() {
        const factory = OptimizationServiceFactory.getInstance();
        return factory.createServices({
            enableDashboard: true,
            enableMetricsAggregation: true,
            autoStart: true,
            optimization: {
                enableAutoRecommendations: true,
                monitoringInterval: 15,
                minROI: 20,
                maxRecommendations: 10
            }
        });
    }
    static async createProductionServices() {
        const factory = OptimizationServiceFactory.getInstance();
        return factory.createServices({
            enableDashboard: true,
            enableMetricsAggregation: true,
            autoStart: true,
            optimization: {
                enableAutoRecommendations: true,
                monitoringInterval: 5,
                minROI: 30,
                maxRecommendations: 15,
                thresholds: {
                    performanceWarning: 500,
                    performanceCritical: 1000,
                    cacheHitRatio: 0.9,
                    queryResponseTime: 300,
                    memoryUsage: 0.7
                }
            }
        });
    }
    static async createDevelopmentServices() {
        const factory = OptimizationServiceFactory.getInstance();
        return factory.createServices({
            enableDashboard: true,
            enableMetricsAggregation: true,
            autoStart: true,
            optimization: {
                enableAutoRecommendations: true,
                monitoringInterval: 30,
                minROI: 10,
                maxRecommendations: 20,
                thresholds: {
                    performanceWarning: 2000,
                    performanceCritical: 5000,
                    cacheHitRatio: 0.7,
                    queryResponseTime: 1000,
                    memoryUsage: 0.9
                }
            }
        });
    }
    static async createMinimalServices() {
        const factory = OptimizationServiceFactory.getInstance();
        return factory.createServices({
            enableDashboard: false,
            enableMetricsAggregation: false,
            autoStart: true,
            optimization: {
                enableAutoRecommendations: false,
                minROI: 50,
                maxRecommendations: 5
            }
        });
    }
    static reset() {
        if (OptimizationServiceFactory.instance) {
            OptimizationServiceFactory.instance.destroyServices();
            OptimizationServiceFactory.instance = undefined;
        }
    }
}
exports.OptimizationServiceFactory = OptimizationServiceFactory;
exports.default = OptimizationServiceFactory;
//# sourceMappingURL=OptimizationServiceFactory.js.map