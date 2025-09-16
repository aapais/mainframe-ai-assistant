/**
 * OptimizationServiceFactory - Factory for creating and managing optimization services
 * Provides centralized configuration and lifecycle management
 */

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

export class OptimizationServiceFactory {
  private static instance: OptimizationServiceFactory;
  private services: OptimizationServices | null = null;
  private initialized = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): OptimizationServiceFactory {
    if (!OptimizationServiceFactory.instance) {
      OptimizationServiceFactory.instance = new OptimizationServiceFactory();
    }
    return OptimizationServiceFactory.instance;
  }

  /**
   * Create and initialize optimization services
   */
  async createServices(config: OptimizationFactoryConfig = {}): Promise<OptimizationServices> {
    if (this.services && this.initialized) {
      return this.services;
    }

    console.log('Creating optimization services...');

    // Create optimization engine
    const engine = new OptimizationEngine(config.optimization);

    // Create dashboard if enabled
    let dashboard: OptimizationDashboard | null = null;
    if (config.enableDashboard !== false) {
      dashboard = new OptimizationDashboard(engine);
    }

    // Create metrics aggregator if enabled
    let metricsAggregator: OptimizationMetricsAggregator | null = null;
    if (config.enableMetricsAggregation !== false) {
      metricsAggregator = new OptimizationMetricsAggregator(engine);
    }

    this.services = {
      engine,
      dashboard: dashboard!,
      metricsAggregator: metricsAggregator!
    };

    // Initialize services if auto-start is enabled
    if (config.autoStart !== false) {
      await this.initializeServices();
    }

    console.log('Optimization services created successfully');
    return this.services;
  }

  /**
   * Initialize all services
   */
  async initializeServices(): Promise<void> {
    if (!this.services) {
      throw new Error('Services must be created before initialization');
    }

    if (this.initialized) {
      return;
    }

    console.log('Initializing optimization services...');

    // Initialize in dependency order
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

  /**
   * Get current services
   */
  getServices(): OptimizationServices {
    if (!this.services) {
      throw new Error('Services have not been created. Call createServices() first.');
    }
    return this.services;
  }

  /**
   * Get optimization engine
   */
  getEngine(): OptimizationEngine {
    return this.getServices().engine;
  }

  /**
   * Get dashboard
   */
  getDashboard(): OptimizationDashboard {
    const services = this.getServices();
    if (!services.dashboard) {
      throw new Error('Dashboard is not enabled');
    }
    return services.dashboard;
  }

  /**
   * Get metrics aggregator
   */
  getMetricsAggregator(): OptimizationMetricsAggregator {
    const services = this.getServices();
    if (!services.metricsAggregator) {
      throw new Error('Metrics aggregator is not enabled');
    }
    return services.metricsAggregator;
  }

  /**
   * Check if services are initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Destroy all services
   */
  async destroyServices(): Promise<void> {
    if (!this.services) {
      return;
    }

    console.log('Destroying optimization services...');

    // Destroy in reverse dependency order
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

  /**
   * Create services with common configurations
   */
  static async createDefaultServices(): Promise<OptimizationServices> {
    const factory = OptimizationServiceFactory.getInstance();
    return factory.createServices({
      enableDashboard: true,
      enableMetricsAggregation: true,
      autoStart: true,
      optimization: {
        enableAutoRecommendations: true,
        monitoringInterval: 15, // 15 minutes
        minROI: 20,
        maxRecommendations: 10
      }
    });
  }

  /**
   * Create services for production environment
   */
  static async createProductionServices(): Promise<OptimizationServices> {
    const factory = OptimizationServiceFactory.getInstance();
    return factory.createServices({
      enableDashboard: true,
      enableMetricsAggregation: true,
      autoStart: true,
      optimization: {
        enableAutoRecommendations: true,
        monitoringInterval: 5, // 5 minutes for production
        minROI: 30, // Higher ROI threshold for production
        maxRecommendations: 15,
        thresholds: {
          performanceWarning: 500, // Stricter thresholds
          performanceCritical: 1000,
          cacheHitRatio: 0.9,
          queryResponseTime: 300,
          memoryUsage: 0.7
        }
      }
    });
  }

  /**
   * Create services for development environment
   */
  static async createDevelopmentServices(): Promise<OptimizationServices> {
    const factory = OptimizationServiceFactory.getInstance();
    return factory.createServices({
      enableDashboard: true,
      enableMetricsAggregation: true,
      autoStart: true,
      optimization: {
        enableAutoRecommendations: true,
        monitoringInterval: 30, // 30 minutes for development
        minROI: 10, // Lower ROI threshold for development
        maxRecommendations: 20,
        thresholds: {
          performanceWarning: 2000, // More relaxed thresholds
          performanceCritical: 5000,
          cacheHitRatio: 0.7,
          queryResponseTime: 1000,
          memoryUsage: 0.9
        }
      }
    });
  }

  /**
   * Create minimal services (engine only)
   */
  static async createMinimalServices(): Promise<OptimizationServices> {
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

  /**
   * Reset factory state (useful for testing)
   */
  static reset(): void {
    if (OptimizationServiceFactory.instance) {
      OptimizationServiceFactory.instance.destroyServices();
      OptimizationServiceFactory.instance = undefined as any;
    }
  }
}

export default OptimizationServiceFactory;