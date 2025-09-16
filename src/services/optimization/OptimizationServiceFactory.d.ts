import { OptimizationEngine, OptimizationConfig } from './OptimizationEngine';
import { OptimizationDashboard } from './OptimizationDashboard';
import { OptimizationMetricsAggregator } from './OptimizationMetricsAggregator';
export interface OptimizationServices {
    engine: OptimizationEngine;
    dashboard: OptimizationDashboard;
    metricsAggregator: OptimizationMetricsAggregator;
}
export interface OptimizationFactoryConfig {
    optimization?: Partial<OptimizationConfig>;
    enableDashboard?: boolean;
    enableMetricsAggregation?: boolean;
    autoStart?: boolean;
}
export declare class OptimizationServiceFactory {
    private static instance;
    private services;
    private initialized;
    private constructor();
    static getInstance(): OptimizationServiceFactory;
    createServices(config?: OptimizationFactoryConfig): Promise<OptimizationServices>;
    initializeServices(): Promise<void>;
    getServices(): OptimizationServices;
    getEngine(): OptimizationEngine;
    getDashboard(): OptimizationDashboard;
    getMetricsAggregator(): OptimizationMetricsAggregator;
    isInitialized(): boolean;
    destroyServices(): Promise<void>;
    static createDefaultServices(): Promise<OptimizationServices>;
    static createProductionServices(): Promise<OptimizationServices>;
    static createDevelopmentServices(): Promise<OptimizationServices>;
    static createMinimalServices(): Promise<OptimizationServices>;
    static reset(): void;
}
export default OptimizationServiceFactory;
//# sourceMappingURL=OptimizationServiceFactory.d.ts.map