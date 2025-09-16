/**
 * ServiceManager Tests
 * Unit tests for the ServiceManager implementation
 */

import { ServiceManager, Service, ServiceContext, ServiceHealth, ServiceStatus } from '../ServiceManager';

// Mock service for testing
class MockService implements Service {
  public readonly name: string;
  public readonly version = '1.0.0';
  public readonly dependencies: string[] = [];
  public readonly priority: number;
  public readonly critical: boolean;

  private initialized = false;
  private shouldFailHealthCheck = false;
  private shouldFailInitialization = false;

  constructor(
    name: string,
    priority = 1,
    critical = false,
    dependencies: string[] = []
  ) {
    this.name = name;
    this.priority = priority;
    this.critical = critical;
    this.dependencies = [...dependencies];
  }

  async initialize(context: ServiceContext): Promise<void> {
    if (this.shouldFailInitialization) {
      throw new Error(`${this.name} initialization failed`);
    }
    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    this.initialized = false;
  }

  getStatus(): ServiceStatus {
    return {
      status: this.initialized ? 'running' : 'stopped',
      restartCount: 0,
      uptime: this.initialized ? 1000 : 0
    };
  }

  async healthCheck(): Promise<ServiceHealth> {
    if (this.shouldFailHealthCheck) {
      return {
        healthy: false,
        error: 'Mock health check failure',
        lastCheck: new Date()
      };
    }

    return {
      healthy: this.initialized,
      lastCheck: new Date(),
      details: { mock: true }
    };
  }

  // Test helpers
  setFailHealthCheck(fail: boolean): void {
    this.shouldFailHealthCheck = fail;
  }

  setFailInitialization(fail: boolean): void {
    this.shouldFailInitialization = fail;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

describe('ServiceManager', () => {
  let serviceManager: ServiceManager;

  beforeEach(() => {
    serviceManager = new ServiceManager({
      gracefulShutdownTimeout: 1000,
      healthCheckInterval: 100,
      maxRestartAttempts: 2,
      restartDelay: 100,
      enableMetrics: false,
      enableHealthChecks: false,
      fallbackServices: {},
      serviceTimeouts: {},
      logging: {
        level: 'error',
        console: false
      }
    });
  });

  afterEach(async () => {
    await serviceManager.shutdown();
  });

  describe('Service Registration', () => {
    it('should register a service successfully', () => {
      const service = new MockService('TestService');
      
      expect(() => {
        serviceManager.registerService(service);
      }).not.toThrow();

      expect(serviceManager.getService('TestService')).toBe(service);
    });

    it('should throw error when registering duplicate service', () => {
      const service1 = new MockService('TestService');
      const service2 = new MockService('TestService');
      
      serviceManager.registerService(service1);
      
      expect(() => {
        serviceManager.registerService(service2);
      }).toThrow('Service TestService is already registered');
    });

    it('should unregister a service successfully', () => {
      const service = new MockService('TestService');
      serviceManager.registerService(service);
      
      expect(serviceManager.getService('TestService')).toBe(service);
      
      const removed = serviceManager.unregisterService('TestService');
      expect(removed).toBe(true);
      expect(serviceManager.getService('TestService')).toBeNull();
    });
  });

  describe('Service Initialization', () => {
    it('should initialize a single service successfully', async () => {
      const service = new MockService('TestService');
      serviceManager.registerService(service);
      
      const result = await serviceManager.initialize({
        parallelInitialization: false,
        failFast: false,
        enableRetries: false,
        retryAttempts: 0,
        retryDelay: 0
      });

      expect(result.success).toBe(true);
      expect(result.initialized).toContain('TestService');
      expect(result.failed).toHaveLength(0);
      expect(service.isInitialized()).toBe(true);
    });

    it('should initialize services in dependency order', async () => {
      const service1 = new MockService('Service1', 1);
      const service2 = new MockService('Service2', 2, false, ['Service1']);
      const service3 = new MockService('Service3', 3, false, ['Service2']);

      serviceManager.registerService(service3); // Register out of order
      serviceManager.registerService(service1);
      serviceManager.registerService(service2);
      
      const result = await serviceManager.initialize({
        parallelInitialization: false,
        failFast: false,
        enableRetries: false,
        retryAttempts: 0,
        retryDelay: 0
      });

      expect(result.success).toBe(true);
      expect(result.initialized).toEqual(['Service1', 'Service2', 'Service3']);
    });

    it('should handle service initialization failure', async () => {
      const service = new MockService('TestService');
      service.setFailInitialization(true);
      serviceManager.registerService(service);
      
      const result = await serviceManager.initialize({
        parallelInitialization: false,
        failFast: false,
        enableRetries: false,
        retryAttempts: 0,
        retryDelay: 0
      });

      expect(result.success).toBe(false);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].name).toBe('TestService');
      expect(service.isInitialized()).toBe(false);
    });

    it('should retry failed initialization', async () => {
      const service = new MockService('TestService');
      let attemptCount = 0;
      
      // Mock service that fails first time, succeeds second time
      service.setFailInitialization(true);
      const originalInitialize = service.initialize.bind(service);
      service.initialize = async (context) => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('First attempt fails');
        }
        return originalInitialize(context);
      };

      serviceManager.registerService(service);
      
      const result = await serviceManager.initialize({
        parallelInitialization: false,
        failFast: false,
        enableRetries: true,
        retryAttempts: 2,
        retryDelay: 10
      });

      expect(result.success).toBe(true);
      expect(result.initialized).toContain('TestService');
      expect(attemptCount).toBe(2);
    });
  });

  describe('Service Access', () => {
    it('should return correct service by name', () => {
      const service = new MockService('TestService');
      serviceManager.registerService(service);
      
      const retrieved = serviceManager.getService('TestService');
      expect(retrieved).toBe(service);
    });

    it('should return null for non-existent service', () => {
      const retrieved = serviceManager.getService('NonExistentService');
      expect(retrieved).toBeNull();
    });

    it('should return all registered services', () => {
      const service1 = new MockService('Service1');
      const service2 = new MockService('Service2');
      
      serviceManager.registerService(service1);
      serviceManager.registerService(service2);
      
      const allServices = serviceManager.getAllServices();
      expect(allServices).toHaveLength(2);
      expect(allServices).toContain(service1);
      expect(allServices).toContain(service2);
    });
  });

  describe('Service Status', () => {
    it('should return service status', async () => {
      const service = new MockService('TestService');
      serviceManager.registerService(service);
      
      await serviceManager.initialize({
        parallelInitialization: false,
        failFast: false,
        enableRetries: false,
        retryAttempts: 0,
        retryDelay: 0
      });
      
      const status = serviceManager.getServiceStatus('TestService');
      expect(status).toBeDefined();
      expect(status?.status).toBe('running');
    });

    it('should track healthy services', async () => {
      const service1 = new MockService('Service1');
      const service2 = new MockService('Service2');
      service2.setFailHealthCheck(true);
      
      serviceManager.registerService(service1);
      serviceManager.registerService(service2);
      
      await serviceManager.initialize({
        parallelInitialization: false,
        failFast: false,
        enableRetries: false,
        retryAttempts: 0,
        retryDelay: 0
      });
      
      // Manual health check since automatic health checks are disabled
      const proxy1 = serviceManager.getServiceProxy('Service1');
      const proxy2 = serviceManager.getServiceProxy('Service2');
      
      await proxy1?.getHealth();
      await proxy2?.getHealth();
      
      const healthyServices = serviceManager.getHealthyServices();
      const unhealthyServices = serviceManager.getUnhealthyServices();
      
      expect(healthyServices).toContain('Service1');
      expect(unhealthyServices).toContain('Service2');
    });
  });

  describe('Service Shutdown', () => {
    it('should shutdown all services', async () => {
      const service1 = new MockService('Service1', 1);
      const service2 = new MockService('Service2', 2);
      
      serviceManager.registerService(service1);
      serviceManager.registerService(service2);
      
      await serviceManager.initialize({
        parallelInitialization: false,
        failFast: false,
        enableRetries: false,
        retryAttempts: 0,
        retryDelay: 0
      });

      expect(service1.isInitialized()).toBe(true);
      expect(service2.isInitialized()).toBe(true);
      
      await serviceManager.shutdown();
      
      expect(service1.isInitialized()).toBe(false);
      expect(service2.isInitialized()).toBe(false);
    });

    it('should shutdown services in reverse dependency order', async () => {
      const shutdownOrder: string[] = [];
      
      const service1 = new MockService('Service1', 1);
      const service2 = new MockService('Service2', 2, false, ['Service1']);
      
      // Override shutdown to track order
      service1.shutdown = async () => {
        shutdownOrder.push('Service1');
      };
      
      service2.shutdown = async () => {
        shutdownOrder.push('Service2');
      };
      
      serviceManager.registerService(service1);
      serviceManager.registerService(service2);
      
      await serviceManager.initialize({
        parallelInitialization: false,
        failFast: false,
        enableRetries: false,
        retryAttempts: 0,
        retryDelay: 0
      });
      
      await serviceManager.shutdown();
      
      expect(shutdownOrder).toEqual(['Service2', 'Service1']);
    });
  });

  describe('Event Handling', () => {
    it('should emit service initialization events', async (done) => {
      const service = new MockService('TestService');
      serviceManager.registerService(service);
      
      let initializingEmitted = false;
      let initializedEmitted = false;
      
      serviceManager.on('service:initializing', (serviceName) => {
        expect(serviceName).toBe('TestService');
        initializingEmitted = true;
      });
      
      serviceManager.on('service:initialized', (serviceName, duration) => {
        expect(serviceName).toBe('TestService');
        expect(typeof duration).toBe('number');
        initializedEmitted = true;
        
        if (initializingEmitted && initializedEmitted) {
          done();
        }
      });
      
      await serviceManager.initialize({
        parallelInitialization: false,
        failFast: false,
        enableRetries: false,
        retryAttempts: 0,
        retryDelay: 0
      });
    });

    it('should emit service failure events', async (done) => {
      const service = new MockService('TestService');
      service.setFailInitialization(true);
      serviceManager.registerService(service);
      
      serviceManager.on('service:failed', (serviceName, error) => {
        expect(serviceName).toBe('TestService');
        expect(error).toBeInstanceOf(Error);
        done();
      });
      
      await serviceManager.initialize({
        parallelInitialization: false,
        failFast: false,
        enableRetries: false,
        retryAttempts: 0,
        retryDelay: 0
      });
    });
  });
});