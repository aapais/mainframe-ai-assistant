/**
 * ServiceManager for Electron Main Process
 * Handles service lifecycle management, initialization order, error recovery, and health monitoring
 */

import { EventEmitter } from 'events';
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import {
  Service,
  ServiceContext,
  ServiceManagerConfig,
  ServiceManagerEvents,
  ServiceStatus,
  ServiceHealth,
  ServiceLogger,
  ServiceMetrics,
  InitializationOptions,
  InitializationResult,
  ServiceRegistry,
  ServiceProxy,
  FallbackService,
  DependencyValidationResult,
  DEFAULT_SERVICE_MANAGER_CONFIG
} from './types';

// ========================
// Service Registry Implementation
// ========================

class DefaultServiceRegistry implements ServiceRegistry {
  private services = new Map<string, Service>();

  register(service: Service): void {
    if (this.services.has(service.name)) {
      throw new Error(`Service ${service.name} is already registered`);
    }
    this.services.set(service.name, service);
  }

  unregister(name: string): boolean {
    return this.services.delete(name);
  }

  get<T extends Service>(name: string): T | null {
    return (this.services.get(name) as T) || null;
  }

  getAll(): Service[] {
    return Array.from(this.services.values());
  }

  getByDependency(dependency: string): Service[] {
    return Array.from(this.services.values())
      .filter(service => service.dependencies.includes(dependency));
  }

  getDependencyOrder(): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: string[] = [];

    const visit = (serviceName: string): void => {
      if (visiting.has(serviceName)) {
        throw new Error(`Circular dependency detected involving ${serviceName}`);
      }
      if (visited.has(serviceName)) {
        return;
      }

      visiting.add(serviceName);

      const service = this.services.get(serviceName);
      if (service) {
        for (const dep of service.dependencies) {
          visit(dep);
        }
      }

      visiting.delete(serviceName);
      visited.add(serviceName);
      result.push(serviceName);
    };

    // Sort services by priority first, then resolve dependencies
    const sortedServices = Array.from(this.services.values())
      .sort((a, b) => a.priority - b.priority);

    for (const service of sortedServices) {
      if (!visited.has(service.name)) {
        visit(service.name);
      }
    }

    return result;
  }

  validateDependencies(): DependencyValidationResult {
    const result: DependencyValidationResult = {
      valid: true,
      circularDependencies: [],
      missingDependencies: []
    };

    // Check for missing dependencies
    for (const service of this.services.values()) {
      const missing = service.dependencies.filter(dep => !this.services.has(dep));
      if (missing.length > 0) {
        result.valid = false;
        result.missingDependencies.push({
          service: service.name,
          missing
        });
      }
    }

    // Check for circular dependencies
    try {
      this.getDependencyOrder();
    } catch (error) {
      result.valid = false;
      // Extract circular dependency information from error
      const match = error.message.match(/Circular dependency detected involving (.+)/);
      if (match) {
        result.circularDependencies.push([match[1]]);
      }
    }

    return result;
  }
}

// ========================
// Service Proxy Implementation
// ========================

class DefaultServiceProxy<T extends Service> implements ServiceProxy<T> {
  public lastHealthCheck: Date | null = null;
  private _isHealthy: boolean = true;

  constructor(
    public readonly service: T,
    private readonly logger: ServiceLogger,
    private readonly metrics: ServiceMetrics
  ) {}

  get isHealthy(): boolean {
    return this._isHealthy;
  }

  async call<R>(method: keyof T, ...args: any[]): Promise<R> {
    const startTime = Date.now();
    
    try {
      const result = await (this.service[method] as any)(...args);
      this.metrics.histogram('service.call.duration', Date.now() - startTime, {
        service: this.service.name,
        method: method.toString()
      });
      return result;
    } catch (error) {
      this.metrics.increment('service.call.error', {
        service: this.service.name,
        method: method.toString()
      });
      throw error;
    }
  }

  async getHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      const health = this.service.healthCheck
        ? await this.service.healthCheck()
        : { healthy: true, lastCheck: new Date() };
      
      this._isHealthy = health.healthy;
      this.lastHealthCheck = new Date();
      
      this.metrics.gauge('service.health.response_time', Date.now() - startTime, {
        service: this.service.name
      });
      
      this.metrics.gauge('service.health.status', health.healthy ? 1 : 0, {
        service: this.service.name
      });

      return health;
    } catch (error) {
      this._isHealthy = false;
      this.lastHealthCheck = new Date();
      
      this.logger.error(`Health check failed for ${this.service.name}`, error);
      
      return {
        healthy: false,
        error: error.message,
        lastCheck: new Date(),
        responseTime: Date.now() - startTime
      };
    }
  }

  async restart(): Promise<void> {
    this.logger.info(`Restarting service: ${this.service.name}`);
    
    try {
      await this.service.shutdown();
      await this.service.initialize({} as ServiceContext); // Context would be provided by ServiceManager
      this.logger.info(`Successfully restarted service: ${this.service.name}`);
    } catch (error) {
      this.logger.error(`Failed to restart service: ${this.service.name}`, error);
      throw error;
    }
  }
}

// ========================
// Default Logger Implementation
// ========================

class DefaultServiceLogger implements ServiceLogger {
  constructor(
    private readonly config: ServiceManagerConfig['logging'],
    private readonly serviceName: string = 'ServiceManager'
  ) {}

  debug(message: string, ...args: any[]): void {
    if (this.config.level === 'debug') {
      this.log('DEBUG', message, args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (['debug', 'info'].includes(this.config.level)) {
      this.log('INFO', message, args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (['debug', 'info', 'warn'].includes(this.config.level)) {
      this.log('WARN', message, args);
    }
  }

  error(message: string, error?: Error, ...args: any[]): void {
    const errorDetails = error ? `\nError: ${error.message}\nStack: ${error.stack}` : '';
    this.log('ERROR', `${message}${errorDetails}`, args);
  }

  private log(level: string, message: string, args: any[]): void {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] [${level}] [${this.serviceName}] ${message}`;
    
    if (this.config.console) {
      console.log(formatted, ...args);
    }

    if (this.config.file?.enabled) {
      this.writeToFile(formatted);
    }
  }

  private writeToFile(message: string): void {
    try {
      const logDir = path.dirname(this.config.file!.path);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      fs.appendFileSync(this.config.file!.path, message + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }
}

// ========================
// Default Metrics Implementation
// ========================

class DefaultServiceMetrics implements ServiceMetrics {
  private metrics = new Map<string, number>();

  increment(metric: string, tags?: Record<string, string>): void {
    const key = this.buildKey(metric, tags);
    this.metrics.set(key, (this.metrics.get(key) || 0) + 1);
  }

  gauge(metric: string, value: number, tags?: Record<string, string>): void {
    const key = this.buildKey(metric, tags);
    this.metrics.set(key, value);
  }

  histogram(metric: string, value: number, tags?: Record<string, string>): void {
    const key = this.buildKey(metric, tags);
    // Simple histogram implementation - in production, you'd want proper bucketing
    this.metrics.set(key, value);
  }

  timer(metric: string): () => void {
    const start = Date.now();
    return () => {
      this.histogram(metric, Date.now() - start);
    };
  }

  private buildKey(metric: string, tags?: Record<string, string>): string {
    if (!tags || Object.keys(tags).length === 0) {
      return metric;
    }
    
    const tagString = Object.entries(tags)
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join(',');
    
    return `${metric}{${tagString}}`;
  }

  getMetrics(): Map<string, number> {
    return new Map(this.metrics);
  }
}

// ========================
// Main Service Manager Implementation
// ========================

export class ServiceManager extends EventEmitter implements ServiceManagerEvents {
  private readonly registry: ServiceRegistry;
  private readonly proxies = new Map<string, ServiceProxy<any>>();
  private readonly serviceStatuses = new Map<string, ServiceStatus>();
  private readonly fallbackServices = new Map<string, FallbackService>();
  private readonly logger: ServiceLogger;
  private readonly metrics: ServiceMetrics;
  private readonly context: ServiceContext;
  
  private healthCheckInterval?: ReturnType<typeof setTimeout>;
  private isShuttingDown = false;
  private initializationPromise?: Promise<InitializationResult>;

  constructor(
    private readonly config: ServiceManagerConfig = DEFAULT_SERVICE_MANAGER_CONFIG
  ) {
    super();
    
    this.registry = new DefaultServiceRegistry();
    this.logger = new DefaultServiceLogger(config.logging);
    this.metrics = new DefaultServiceMetrics();
    
    this.context = {
      app,
      dataPath: app.getPath('userData'),
      isDevelopment: process.env.NODE_ENV !== 'production',
      config: this.config,
      logger: this.logger,
      metrics: this.metrics,
      getService: <T extends Service>(name: string): T | null => {
        const proxy = this.proxies.get(name);
        return proxy ? proxy.service as T : null;
      }
    };

    this.setupEventHandlers();
  }

  // ========================
  // Service Registration
  // ========================

  registerService(service: Service): void {
    this.logger.info(`Registering service: ${service.name} v${service.version}`);
    
    this.registry.register(service);
    
    // Initialize status
    this.serviceStatuses.set(service.name, {
      status: 'stopped',
      restartCount: 0,
      uptime: 0
    });

    // Create proxy
    const proxy = new DefaultServiceProxy(service, this.logger, this.metrics);
    this.proxies.set(service.name, proxy);
    
    this.logger.info(`Successfully registered service: ${service.name}`);
  }

  registerFallbackService(fallbackService: FallbackService): void {
    this.logger.info(`Registering fallback service: ${fallbackService.name} for ${fallbackService.fallbackFor}`);
    
    this.registerService(fallbackService);
    this.fallbackServices.set(fallbackService.fallbackFor, fallbackService);
    
    this.logger.info(`Successfully registered fallback service: ${fallbackService.name}`);
  }

  unregisterService(name: string): boolean {
    this.logger.info(`Unregistering service: ${name}`);
    
    // Stop service if running
    const status = this.serviceStatuses.get(name);
    if (status && status.status === 'running') {
      this.logger.warn(`Service ${name} is still running during unregistration`);
    }

    const removed = this.registry.unregister(name);
    if (removed) {
      this.proxies.delete(name);
      this.serviceStatuses.delete(name);
      this.fallbackServices.delete(name);
    }

    return removed;
  }

  // ========================
  // Service Initialization
  // ========================

  async initialize(options: InitializationOptions = {
    parallelInitialization: true,
    failFast: false,
    enableRetries: true,
    retryAttempts: 3,
    retryDelay: 2000
  }): Promise<InitializationResult> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.doInitialization(options);
    return this.initializationPromise;
  }

  private async doInitialization(options: InitializationOptions): Promise<InitializationResult> {
    const startTime = Date.now();
    this.emit('initialization:started');
    this.logger.info('Starting service initialization...');

    // Validate dependencies
    const validation = this.registry.validateDependencies();
    if (!validation.valid) {
      const error = new Error(`Dependency validation failed: ${JSON.stringify(validation)}`);
      this.emit('initialization:failed', error, []);
      throw error;
    }

    const services = this.registry.getAll();
    const dependencyOrder = this.registry.getDependencyOrder();
    const initialized: string[] = [];
    const failed: Array<{ name: string; error: Error }> = [];
    const fallbacks: Array<{ original: string; fallback: string }> = [];

    this.logger.info(`Initializing ${services.length} services in dependency order: ${dependencyOrder.join(', ')}`);

    try {
      if (options.parallelInitialization) {
        // Group services by dependency level for parallel initialization
        const levels = this.groupServicesByLevel(dependencyOrder);
        
        for (const level of levels) {
          await this.initializeServiceLevel(level, options, initialized, failed, fallbacks);
          
          if (options.failFast && failed.length > 0) {
            break;
          }
        }
      } else {
        // Sequential initialization
        for (const serviceName of dependencyOrder) {
          await this.initializeService(serviceName, options, initialized, failed, fallbacks);
          
          if (options.failFast && failed.length > 0) {
            break;
          }
        }
      }

      // Start health checks if enabled
      if (this.config.enableHealthChecks) {
        this.startHealthChecks();
      }

      const duration = Date.now() - startTime;
      const success = failed.length === 0;
      
      if (success) {
        this.emit('initialization:completed', duration, initialized);
        this.logger.info(`Service initialization completed successfully in ${duration}ms`);
      } else {
        this.emit('initialization:failed', new Error(`${failed.length} services failed to initialize`), failed.map(f => f.name));
        this.logger.error(`Service initialization completed with ${failed.length} failures in ${duration}ms`);
      }

      return {
        success,
        duration,
        initialized,
        failed,
        fallbacks
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.emit('initialization:failed', error, []);
      this.logger.error('Service initialization failed', error);
      
      return {
        success: false,
        duration,
        initialized,
        failed: [{ name: 'ServiceManager', error }],
        fallbacks
      };
    }
  }

  private groupServicesByLevel(dependencyOrder: string[]): string[][] {
    const levels: string[][] = [];
    const processed = new Set<string>();

    for (const serviceName of dependencyOrder) {
      const service = this.registry.get(serviceName);
      if (!service) continue;

      // Find the appropriate level
      let levelIndex = 0;
      for (const dep of service.dependencies) {
        const depIndex = dependencyOrder.indexOf(dep);
        if (depIndex !== -1) {
          const depLevel = levels.findIndex(level => level.includes(dep));
          if (depLevel !== -1) {
            levelIndex = Math.max(levelIndex, depLevel + 1);
          }
        }
      }

      // Ensure we have enough levels
      while (levels.length <= levelIndex) {
        levels.push([]);
      }

      levels[levelIndex].push(serviceName);
      processed.add(serviceName);
    }

    return levels;
  }

  private async initializeServiceLevel(
    serviceNames: string[],
    options: InitializationOptions,
    initialized: string[],
    failed: Array<{ name: string; error: Error }>,
    fallbacks: Array<{ original: string; fallback: string }>
  ): Promise<void> {
    const promises = serviceNames.map(name => 
      this.initializeService(name, options, initialized, failed, fallbacks)
    );

    await Promise.allSettled(promises);
  }

  private async initializeService(
    serviceName: string,
    options: InitializationOptions,
    initialized: string[],
    failed: Array<{ name: string; error: Error }>,
    fallbacks: Array<{ original: string; fallback: string }>
  ): Promise<void> {
    const service = this.registry.get(serviceName);
    if (!service) {
      const error = new Error(`Service ${serviceName} not found`);
      failed.push({ name: serviceName, error });
      return;
    }

    let attempts = 0;
    const maxAttempts = options.enableRetries ? options.retryAttempts : 1;

    while (attempts < maxAttempts) {
      try {
        this.logger.info(`Initializing service: ${serviceName} (attempt ${attempts + 1}/${maxAttempts})`);
        this.emit('service:initializing', serviceName);
        
        const startTime = Date.now();
        
        // Update status
        this.serviceStatuses.set(serviceName, {
          status: 'initializing',
          startTime: new Date(),
          restartCount: 0,
          uptime: 0
        });

        // Initialize service
        await service.initialize(this.context);
        
        const duration = Date.now() - startTime;
        
        // Update status
        this.serviceStatuses.set(serviceName, {
          status: 'running',
          startTime: new Date(),
          restartCount: 0,
          uptime: 0
        });

        this.emit('service:initialized', serviceName, duration);
        this.logger.info(`Successfully initialized service: ${serviceName} in ${duration}ms`);
        
        initialized.push(serviceName);
        
        if (options.progressCallback) {
          options.progressCallback(serviceName, 100);
        }
        
        return;
      } catch (error) {
        attempts++;
        
        this.serviceStatuses.set(serviceName, {
          status: 'error',
          lastError: error,
          restartCount: attempts,
          uptime: 0
        });

        this.emit('service:failed', serviceName, error);
        this.logger.error(`Failed to initialize service: ${serviceName} (attempt ${attempts}/${maxAttempts})`, error);

        if (attempts < maxAttempts) {
          this.logger.info(`Retrying service initialization: ${serviceName} in ${options.retryDelay}ms`);
          await this.sleep(options.retryDelay);
        }
      }
    }

    // All attempts failed, try fallback
    const fallbackService = this.fallbackServices.get(serviceName);
    if (fallbackService && service.critical) {
      try {
        this.logger.info(`Initializing fallback service: ${fallbackService.name} for failed service: ${serviceName}`);
        await fallbackService.initialize(this.context);
        await fallbackService.activate();
        
        fallbacks.push({
          original: serviceName,
          fallback: fallbackService.name
        });
        
        this.logger.info(`Successfully initialized fallback service: ${fallbackService.name}`);
        return;
      } catch (fallbackError) {
        this.logger.error(`Fallback service also failed: ${fallbackService.name}`, fallbackError);
      }
    }

    // Final failure
    const finalError = new Error(`Service ${serviceName} failed to initialize after ${maxAttempts} attempts`);
    failed.push({ name: serviceName, error: finalError });

    // If critical service failed and no fallback, this is a critical error
    if (service.critical) {
      this.emit('error:critical', serviceName, finalError);
    } else {
      this.emit('error:recoverable', serviceName, finalError);
    }
  }

  // ========================
  // Health Monitoring
  // ========================

  private startHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheckInterval);

    this.logger.info(`Started health checks with interval: ${this.config.healthCheckInterval}ms`);
  }

  private async performHealthChecks(): Promise<void> {
    if (this.isShuttingDown) return;

    const unhealthyServices: string[] = [];
    const recoveredServices: string[] = [];

    for (const [name, proxy] of this.proxies) {
      try {
        const wasHealthy = proxy.isHealthy;
        const health = await proxy.getHealth();
        
        if (!health.healthy && wasHealthy) {
          unhealthyServices.push(name);
          this.logger.warn(`Service became unhealthy: ${name} - ${health.error}`);
        } else if (health.healthy && !wasHealthy) {
          recoveredServices.push(name);
          this.logger.info(`Service recovered: ${name}`);
        }
      } catch (error) {
        this.logger.error(`Health check failed for service: ${name}`, error);
        unhealthyServices.push(name);
      }
    }

    if (unhealthyServices.length > 0) {
      this.emit('health:degraded', unhealthyServices);
    }

    if (recoveredServices.length > 0) {
      this.emit('health:recovered', recoveredServices);
    }
  }

  // ========================
  // Service Access
  // ========================

  getService<T extends Service>(name: string): T | null {
    const proxy = this.proxies.get(name);
    return proxy ? proxy.service as T : null;
  }

  getServiceProxy<T extends Service>(name: string): ServiceProxy<T> | null {
    return this.proxies.get(name) as ServiceProxy<T> || null;
  }

  getServiceStatus(name: string): ServiceStatus | null {
    return this.serviceStatuses.get(name) || null;
  }

  getAllServices(): Service[] {
    return this.registry.getAll();
  }

  getHealthyServices(): string[] {
    return Array.from(this.proxies.entries())
      .filter(([_, proxy]) => proxy.isHealthy)
      .map(([name]) => name);
  }

  getUnhealthyServices(): string[] {
    return Array.from(this.proxies.entries())
      .filter(([_, proxy]) => !proxy.isHealthy)
      .map(([name]) => name);
  }

  // ========================
  // Service Control
  // ========================

  async restartService(name: string): Promise<void> {
    const proxy = this.proxies.get(name);
    if (!proxy) {
      throw new Error(`Service ${name} not found`);
    }

    const status = this.serviceStatuses.get(name);
    if (status) {
      this.serviceStatuses.set(name, {
        ...status,
        restartCount: status.restartCount + 1
      });
    }

    this.emit('service:restarted', name, status?.restartCount || 1);
    await proxy.restart();
  }

  // ========================
  // Graceful Shutdown
  // ========================

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.warn('Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    const startTime = Date.now();
    
    this.emit('shutdown:started');
    this.logger.info('Starting graceful shutdown...');

    // Stop health checks
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    // Get services in reverse dependency order
    const services = this.registry.getAll();
    const shutdownOrder = this.registry.getDependencyOrder().reverse();

    const shutdownPromises = shutdownOrder.map(async (serviceName) => {
      const service = this.registry.get(serviceName);
      if (!service) return;

      try {
        this.logger.info(`Shutting down service: ${serviceName}`);
        
        const shutdownTimeout = this.config.serviceTimeouts[serviceName] || this.config.gracefulShutdownTimeout;
        
        await Promise.race([
          service.shutdown(),
          this.createTimeoutPromise(shutdownTimeout, `Service ${serviceName} shutdown timeout`)
        ]);

        this.serviceStatuses.set(serviceName, {
          ...this.serviceStatuses.get(serviceName)!,
          status: 'stopped'
        });

        this.emit('service:shutdown', serviceName);
        this.logger.info(`Successfully shut down service: ${serviceName}`);
      } catch (error) {
        this.logger.error(`Error shutting down service: ${serviceName}`, error);
        // Continue with other services
      }
    });

    try {
      await Promise.allSettled(shutdownPromises);
      
      const duration = Date.now() - startTime;
      this.emit('shutdown:completed', duration);
      this.logger.info(`Graceful shutdown completed in ${duration}ms`);
    } catch (error) {
      this.logger.error('Error during shutdown', error);
      throw error;
    }
  }

  // ========================
  // Utility Methods
  // ========================

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private createTimeoutPromise<T>(timeout: number, message: string): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeout);
    });
  }

  private setupEventHandlers(): void {
    // Handle app shutdown
    app.on('before-quit', async (event) => {
      if (!this.isShuttingDown) {
        event.preventDefault();
        await this.shutdown();
        app.quit();
      }
    });

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception in service manager', error);
      this.emit('error:critical', 'ServiceManager', error);
    });

    process.on('unhandledRejection', (reason, promise) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      this.logger.error('Unhandled promise rejection in service manager', error);
      this.emit('error:critical', 'ServiceManager', error);
    });
  }
}

// ========================
// Singleton Instance
// ========================

let serviceManagerInstance: ServiceManager | null = null;

export function getServiceManager(config?: ServiceManagerConfig): ServiceManager {
  if (!serviceManagerInstance) {
    serviceManagerInstance = new ServiceManager(config);
  }
  return serviceManagerInstance;
}

export function resetServiceManager(): void {
  serviceManagerInstance = null;
}

// Export types and classes
export * from './types';
export { DefaultServiceLogger, DefaultServiceMetrics };