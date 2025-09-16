# ServiceManager for Electron Main Process

A robust service lifecycle management system for the Mainframe KB Assistant Electron application.

## Overview

The ServiceManager provides a comprehensive solution for managing services in the Electron main process with features including:

- **Service Lifecycle Management**: Initialize, start, stop, and restart services
- **Dependency Resolution**: Automatic ordering of service initialization based on dependencies
- **Health Monitoring**: Continuous health checks with alerting
- **Error Recovery**: Automatic restart attempts and fallback services
- **Graceful Shutdown**: Ordered shutdown in reverse dependency order
- **Performance Metrics**: Built-in metrics collection and monitoring
- **Parallel Initialization**: Efficient startup with dependency-aware parallelization

## Architecture

### Core Components

1. **ServiceManager**: Main orchestrator class that manages all services
2. **Service Interface**: Contract that all services must implement
3. **ServiceRegistry**: Internal registry for service discovery and dependency management
4. **ServiceProxy**: Wrapper around services for monitoring and control
5. **Health Monitoring**: Continuous health checking system
6. **Metrics Collection**: Performance and usage metrics tracking

### Service Lifecycle States

- `stopped` - Service is not running
- `initializing` - Service is starting up
- `running` - Service is operational
- `error` - Service encountered an error
- `degraded` - Service is running with limited functionality

## Usage

### Basic Setup

```typescript
import { getServiceManager, Service, ServiceContext } from './services/ServiceManager';

// Get the singleton ServiceManager instance
const serviceManager = getServiceManager();

// Create a custom service
class MyService implements Service {
  readonly name = 'MyService';
  readonly version = '1.0.0';
  readonly dependencies = ['DatabaseService'];
  readonly priority = 5;
  readonly critical = false;

  async initialize(context: ServiceContext): Promise<void> {
    // Service initialization logic
  }

  async shutdown(): Promise<void> {
    // Cleanup logic
  }

  getStatus(): ServiceStatus {
    // Return current service status
  }

  async healthCheck(): Promise<ServiceHealth> {
    // Health check logic
  }
}

// Register and initialize
serviceManager.registerService(new MyService());
await serviceManager.initialize();
```

### Service Implementation

Services must implement the `Service` interface:

```typescript
interface Service {
  readonly name: string;           // Unique service identifier
  readonly version: string;        // Service version
  readonly dependencies: string[]; // List of dependency service names
  readonly priority: number;       // Initialization priority (lower = higher priority)
  readonly critical: boolean;      // If true, service failure causes app shutdown
  readonly healthCheck?: () => Promise<ServiceHealth>;

  initialize(context: ServiceContext): Promise<void>;
  shutdown(): Promise<void>;
  getStatus(): ServiceStatus;
}
```

### Fallback Services

For critical services, you can register fallback services that activate when the primary service fails:

```typescript
class FallbackAIService implements FallbackService {
  readonly fallbackFor = 'AIService';
  
  isActive(): boolean { /* ... */ }
  async activate(): Promise<void> { /* ... */ }
  async deactivate(): Promise<void> { /* ... */ }
  // ... other Service interface methods
}

serviceManager.registerFallbackService(new FallbackAIService());
```

### Event Monitoring

The ServiceManager emits events for monitoring service health:

```typescript
serviceManager.on('service:failed', (serviceName, error) => {
  console.error(`Service ${serviceName} failed:`, error);
});

serviceManager.on('health:degraded', (unhealthyServices) => {
  console.warn(`Unhealthy services: ${unhealthyServices.join(', ')}`);
});

serviceManager.on('service:restarted', (serviceName, attempt) => {
  console.log(`Service ${serviceName} restarted (attempt ${attempt})`);
});
```

## Built-in Services

### DatabaseService
- Manages the SQLite knowledge database
- Priority: 1 (high)
- Critical: true
- Dependencies: none

### WindowService  
- Manages the main Electron window
- Priority: 2 (high)
- Critical: true
- Dependencies: none

### AIService
- Manages the Gemini AI integration
- Priority: 3 (medium)
- Critical: false
- Dependencies: DatabaseService
- Has fallback: FallbackAIService

### IPCService
- Manages IPC handlers for renderer communication
- Priority: 4 (low)
- Critical: true
- Dependencies: DatabaseService, WindowService

## Configuration

The ServiceManager accepts a configuration object:

```typescript
interface ServiceManagerConfig {
  gracefulShutdownTimeout: number;    // Max time to wait for graceful shutdown
  healthCheckInterval: number;        // Interval for health checks
  maxRestartAttempts: number;         // Max restart attempts for failed services
  restartDelay: number;              // Delay between restart attempts
  enableMetrics: boolean;            // Enable metrics collection
  enableHealthChecks: boolean;       // Enable continuous health monitoring
  fallbackServices: Record<string, string[]>; // Fallback mappings
  serviceTimeouts: Record<string, number>;    // Per-service timeout overrides
  logging: LoggingConfig;            // Logging configuration
}
```

## Health Monitoring

Services can implement health checks:

```typescript
async healthCheck(): Promise<ServiceHealth> {
  try {
    // Perform health check operations
    const responseTime = await this.pingDatabase();
    
    return {
      healthy: true,
      responseTime,
      details: { connections: 5 },
      lastCheck: new Date()
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      lastCheck: new Date()
    };
  }
}
```

## Metrics Collection

Built-in metrics collection tracks:

- Service initialization time
- Health check response times  
- Service restart counts
- Error rates
- Custom metrics via the metrics interface

```typescript
// In service initialization
context.metrics.increment('service.database.initialized');
context.metrics.histogram('service.search.duration', responseTime);
context.metrics.gauge('service.connections.active', connectionCount);
```

## Error Handling

The ServiceManager provides robust error handling:

### Restart Attempts
- Failed services are automatically restarted up to `maxRestartAttempts`
- Exponential backoff between restart attempts
- Fallback services activated for critical services

### Fallback Activation
- Fallback services automatically activate when primary services fail
- Graceful degradation of functionality
- Transparent switching for client code

### Graceful Degradation
- Non-critical services can fail without affecting the application
- Services can run in degraded mode with limited functionality
- Health monitoring detects and reports degraded states

## Best Practices

### Service Design
1. **Single Responsibility**: Each service should have one clear purpose
2. **Dependency Minimization**: Keep dependencies minimal and well-defined
3. **Graceful Degradation**: Design services to handle partial failures
4. **Health Checks**: Implement meaningful health checks
5. **Resource Cleanup**: Ensure proper cleanup in shutdown methods

### Error Handling
1. **Fail Fast**: Detect errors quickly during initialization
2. **Recovery**: Implement recovery mechanisms where possible
3. **Logging**: Provide detailed error information
4. **Fallbacks**: Use fallback services for critical functionality

### Performance
1. **Async Operations**: Use async/await for all I/O operations  
2. **Resource Management**: Monitor and limit resource usage
3. **Metrics**: Track performance metrics for optimization
4. **Health Monitoring**: Regular but lightweight health checks

## Integration with Main Process

The ServiceManager integrates seamlessly with the Electron main process:

```typescript
// main/index.ts
import { getServiceManager } from './services';

const serviceManager = getServiceManager();

app.whenReady().then(async () => {
  // Register services
  serviceManager.registerService(new DatabaseService());
  serviceManager.registerService(new WindowService());
  serviceManager.registerService(new AIService());
  serviceManager.registerService(new IPCService());

  // Initialize all services
  await serviceManager.initialize();
});

app.on('before-quit', async () => {
  await serviceManager.shutdown();
});
```

## Testing

Services can be easily unit tested:

```typescript
describe('MyService', () => {
  let service: MyService;
  let mockContext: ServiceContext;

  beforeEach(() => {
    service = new MyService();
    mockContext = {
      // Mock ServiceContext
    };
  });

  it('should initialize successfully', async () => {
    await expect(service.initialize(mockContext)).resolves.not.toThrow();
  });

  it('should report healthy status', async () => {
    await service.initialize(mockContext);
    const health = await service.healthCheck();
    expect(health.healthy).toBe(true);
  });
});
```

## Migration from Old Architecture

The ServiceManager maintains backward compatibility with the existing architecture:

```typescript
// Old way
let knowledgeDB: KnowledgeDB | null = null;
knowledgeDB = await createKnowledgeDB(dbPath, options);

// New way - same result, better managed
const dbService = serviceManager.getService('DatabaseService');
const knowledgeDB = dbService.getDatabase();
```

The main process exports both the ServiceManager and compatibility exports to ensure existing code continues to work.

## Troubleshooting

### Service Won't Start
1. Check dependencies are properly registered
2. Verify initialization order with `getDependencyOrder()`
3. Check logs for specific error messages
4. Verify all required resources are available

### Health Check Failures
1. Check service-specific health check implementation
2. Verify external dependencies (database, APIs) are available
3. Check resource limits and permissions
4. Review error logs for specific failure reasons

### Memory Leaks
1. Ensure proper cleanup in shutdown methods
2. Clear timers and intervals
3. Close database connections and file handles  
4. Remove event listeners

## Future Enhancements

Planned improvements include:

- **Service Discovery**: Automatic service discovery and registration
- **Load Balancing**: Multiple instances of services with load balancing
- **Circuit Breakers**: Automatic failure isolation
- **Distributed Services**: Support for services running in separate processes
- **Configuration Hot Reload**: Dynamic configuration updates
- **Advanced Metrics**: Integration with external monitoring systems