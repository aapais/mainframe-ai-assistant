# Plugin Development Guide

## Overview

The Storage Service plugin system enables MVP-specific functionality through a modular, extensible architecture. This guide covers creating custom plugins, from basic implementations to advanced enterprise features.

## Table of Contents

1. [Plugin Architecture](#plugin-architecture)
2. [Creating Your First Plugin](#creating-your-first-plugin)
3. [Plugin Lifecycle](#plugin-lifecycle)
4. [Advanced Plugin Features](#advanced-plugin-features)
5. [Plugin Testing](#plugin-testing)
6. [Best Practices](#best-practices)
7. [Examples](#examples)
8. [Troubleshooting](#troubleshooting)

## Plugin Architecture

### Plugin Interface

```typescript
interface IStoragePlugin {
  // Identification
  getName(): string;
  getVersion(): string;
  getDescription(): string;
  getMVPVersion(): number;
  getDependencies(): string[];

  // Lifecycle
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  isActive(): boolean;
  getStatus(): PluginStatus;

  // Configuration
  getConfig(): PluginConfig;
  updateConfig(config: Partial<PluginConfig>): Promise<void>;
  getMetadata(): PluginMetadata;

  // Data Processing
  processData(data: any, context?: any): Promise<any>;

  // Health & Monitoring
  healthCheck(): Promise<{ healthy: boolean; details: any }>;
  getMetrics(): any;
}
```

### Plugin Types by MVP

```typescript
// MVP Classification
type PluginMVPLevel = 1 | 2 | 3 | 4 | 5;

interface PluginClassification {
  mvp1: 'Foundation' // Basic KB operations
  mvp2: 'Analytics' | 'PatternDetection' // Incident analysis
  mvp3: 'CodeAnalysis' | 'Integration' // Code integration
  mvp4: 'TemplateEngine' | 'IDZBridge' // Development tools
  mvp5: 'EnterpriseIntelligence' | 'AutoResolution' // AI/ML features
}
```

## Creating Your First Plugin

### Step 1: Basic Plugin Structure

```typescript
// src/services/storage/plugins/MyFirstPlugin.ts
import { BaseStoragePlugin } from './BaseStoragePlugin';
import { IStorageAdapter } from '../adapters/IStorageAdapter';
import { PluginConfig } from '../IStorageService';

export class MyFirstPlugin extends BaseStoragePlugin {
  constructor(adapter: IStorageAdapter, config: PluginConfig = {}) {
    super(adapter, config);
  }

  // Required implementations
  getName(): string {
    return 'MyFirstPlugin';
  }

  getVersion(): string {
    return '1.0.0';
  }

  getDescription(): string {
    return 'My first custom storage plugin';
  }

  getMVPVersion(): number {
    return 1; // Available from MVP1
  }

  getDependencies(): string[] {
    return []; // No dependencies
  }

  protected async initializePlugin(): Promise<void> {
    this.log('info', 'Initializing MyFirstPlugin');
    // Custom initialization logic here
  }

  protected async cleanupPlugin(): Promise<void> {
    this.log('info', 'Cleaning up MyFirstPlugin');
    // Custom cleanup logic here
  }

  async processData(data: any, context?: any): Promise<any> {
    // Process and transform data
    this.log('info', 'Processing data', { dataType: typeof data });
    
    // Example: Add timestamp to all data
    return {
      ...data,
      processedAt: new Date(),
      processedBy: this.getName()
    };
  }

  protected getDefaultConfig(): PluginConfig {
    return {
      enabled: true,
      options: {
        logLevel: 'info',
        processingTimeout: 5000
      }
    };
  }
}
```

### Step 2: Register Your Plugin

```typescript
// In your application initialization
import { StorageService } from './services/storage/StorageService';
import { MyFirstPlugin } from './services/storage/plugins/MyFirstPlugin';

const storage = new StorageService({
  adapter: 'sqlite',
  enablePlugins: true
});

// Register the plugin
await storage.registerPlugin('myFirst', new MyFirstPlugin(storage.getAdapter()));

// Initialize storage (which will initialize all plugins)
await storage.initialize();
```

### Step 3: Use Your Plugin

```typescript
// Access your plugin
const myPlugin = storage.getPlugin('myFirst');

// Process data through your plugin
const result = await myPlugin.processData({
  title: 'Test Entry',
  category: 'Test'
});

console.log(result);
// Output: {
//   title: 'Test Entry',
//   category: 'Test',
//   processedAt: 2025-01-11T10:30:00.000Z,
//   processedBy: 'MyFirstPlugin'
// }
```

## Plugin Lifecycle

### Lifecycle Events

```typescript
class AdvancedPlugin extends BaseStoragePlugin {
  protected async initializePlugin(): Promise<void> {
    // 1. Validate dependencies
    await this.validateDependencies();
    
    // 2. Setup database tables/indexes if needed
    await this.setupDatabase();
    
    // 3. Initialize external connections
    await this.initializeConnections();
    
    // 4. Start background processes
    this.startBackgroundTasks();
    
    // 5. Register event listeners
    this.setupEventListeners();
    
    this.log('info', 'Advanced plugin initialized successfully');
  }

  protected async cleanupPlugin(): Promise<void> {
    // 1. Stop background processes
    this.stopBackgroundTasks();
    
    // 2. Close external connections
    await this.closeConnections();
    
    // 3. Cleanup temporary resources
    await this.cleanupTemporaryData();
    
    // 4. Remove event listeners
    this.removeEventListeners();
    
    this.log('info', 'Advanced plugin cleaned up successfully');
  }

  private async setupDatabase(): Promise<void> {
    // Create plugin-specific tables
    await this.adapter.executeSQL(`
      CREATE TABLE IF NOT EXISTS plugin_data (
        id TEXT PRIMARY KEY,
        plugin_name TEXT NOT NULL,
        data_type TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for performance
    await this.adapter.executeSQL(`
      CREATE INDEX IF NOT EXISTS idx_plugin_data_name 
      ON plugin_data(plugin_name)
    `);
  }

  private startBackgroundTasks(): void {
    // Example: Periodic data processing
    this.backgroundInterval = setInterval(async () => {
      try {
        await this.processBackgroundData();
      } catch (error) {
        this.handleError(error as Error);
      }
    }, 60000); // Every minute
  }

  private stopBackgroundTasks(): void {
    if (this.backgroundInterval) {
      clearInterval(this.backgroundInterval);
      this.backgroundInterval = null;
    }
  }
}
```

### Status Management

```typescript
class StatusAwarePlugin extends BaseStoragePlugin {
  async processData(data: any, context?: any): Promise<any> {
    // Check if plugin is ready
    if (this.getStatus() !== 'active') {
      throw new Error(`Plugin ${this.getName()} is not active (status: ${this.getStatus()})`);
    }

    // Update processing metrics
    const startTime = Date.now();
    
    try {
      const result = await this.doProcessing(data, context);
      
      // Update success metrics
      this.updateSuccessMetrics(Date.now() - startTime);
      
      return result;
    } catch (error) {
      // Handle error and update metrics
      this.updateErrorMetrics(error as Error);
      throw error;
    }
  }

  private updateSuccessMetrics(processingTime: number): void {
    this.metadata.operations_count = (this.metadata.operations_count || 0) + 1;
    this.metadata.total_processing_time = (this.metadata.total_processing_time || 0) + processingTime;
    this.metadata.last_operation_at = new Date();
  }

  private updateErrorMetrics(error: Error): void {
    this.errorCount++;
    this.emit('processing-error', {
      plugin: this.getName(),
      error: error.message,
      timestamp: new Date()
    });
  }
}
```

## Advanced Plugin Features

### Database Integration

```typescript
class DatabaseIntegratedPlugin extends BaseStoragePlugin {
  protected async initializePlugin(): Promise<void> {
    // Create plugin-specific schema
    await this.createSchema();
    
    // Migrate existing data if needed
    await this.migrateData();
  }

  private async createSchema(): Promise<void> {
    const migrations = [
      `CREATE TABLE IF NOT EXISTS analytics_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        event_data TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        processed BOOLEAN DEFAULT FALSE
      )`,
      
      `CREATE INDEX IF NOT EXISTS idx_analytics_events_type 
       ON analytics_events(event_type)`,
       
      `CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp 
       ON analytics_events(timestamp)`,
       
      `CREATE INDEX IF NOT EXISTS idx_analytics_events_processed 
       ON analytics_events(processed)`
    ];

    for (const migration of migrations) {
      await this.adapter.executeSQL(migration);
    }
  }

  async processData(data: any, context?: any): Promise<any> {
    // Store event in database
    await this.storeEvent(data);
    
    // Process asynchronously
    setImmediate(() => this.processEventAsync(data));
    
    return { stored: true, eventId: data.id };
  }

  private async storeEvent(data: any): Promise<void> {
    await this.adapter.executeSQL(`
      INSERT INTO analytics_events (id, event_type, event_data)
      VALUES (?, ?, ?)
    `, [data.id, data.type, JSON.stringify(data)]);
  }

  private async processEventAsync(data: any): Promise<void> {
    try {
      // Complex processing logic
      const result = await this.performAnalysis(data);
      
      // Mark as processed
      await this.adapter.executeSQL(`
        UPDATE analytics_events 
        SET processed = TRUE 
        WHERE id = ?
      `, [data.id]);
      
      this.emit('event-processed', result);
    } catch (error) {
      this.handleError(error as Error);
    }
  }
}
```

### External API Integration

```typescript
class ExternalAPIPlugin extends BaseStoragePlugin {
  private apiClient: any;
  private rateLimiter: any;

  protected async initializePlugin(): Promise<void> {
    // Initialize API client
    this.apiClient = new ExternalAPIClient({
      apiKey: this.config.options?.apiKey,
      baseUrl: this.config.options?.baseUrl,
      timeout: this.config.options?.timeout || 30000
    });

    // Setup rate limiting
    this.rateLimiter = new RateLimiter({
      tokensPerInterval: 100,
      interval: 'minute'
    });

    // Test connection
    await this.testConnection();
  }

  private async testConnection(): Promise<void> {
    try {
      await this.apiClient.ping();
      this.log('info', 'External API connection established');
    } catch (error) {
      throw new Error(`Failed to connect to external API: ${error.message}`);
    }
  }

  async processData(data: any, context?: any): Promise<any> {
    // Check rate limits
    if (!this.rateLimiter.tryRemoveTokens(1)) {
      throw new Error('Rate limit exceeded for external API');
    }

    try {
      // Make API call
      const response = await this.apiClient.analyze(data);
      
      // Store result locally for caching
      await this.cacheResult(data.id, response);
      
      return {
        original: data,
        analysis: response,
        cached: true
      };
    } catch (error) {
      // Fallback to local processing
      this.log('warn', 'External API failed, using fallback', { error: error.message });
      return await this.fallbackProcessing(data);
    }
  }

  private async cacheResult(id: string, result: any): Promise<void> {
    await this.adapter.executeSQL(`
      INSERT OR REPLACE INTO api_cache (id, result, cached_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `, [id, JSON.stringify(result)]);
  }

  private async fallbackProcessing(data: any): Promise<any> {
    // Implement local fallback logic
    return {
      original: data,
      analysis: { type: 'local', confidence: 0.5 },
      cached: false
    };
  }
}
```

### Event-Driven Architecture

```typescript
class EventDrivenPlugin extends BaseStoragePlugin {
  private eventQueue: any[] = [];
  private processing = false;

  protected async initializePlugin(): Promise<void> {
    // Setup event listeners
    this.setupEventListeners();
    
    // Start event processor
    this.startEventProcessor();
  }

  private setupEventListeners(): void {
    // Listen to storage service events
    this.adapter.on?.('entry-added', (entry) => {
      this.queueEvent('entry-added', entry);
    });

    this.adapter.on?.('entry-updated', (entry) => {
      this.queueEvent('entry-updated', entry);
    });

    this.adapter.on?.('search-performed', (searchData) => {
      this.queueEvent('search-performed', searchData);
    });
  }

  private queueEvent(type: string, data: any): void {
    this.eventQueue.push({
      id: this.generateEventId(),
      type,
      data,
      timestamp: new Date()
    });

    // Trigger processing if not already running
    if (!this.processing) {
      setImmediate(() => this.processEventQueue());
    }
  }

  private async processEventQueue(): Promise<void> {
    if (this.processing || this.eventQueue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift();
        await this.processEvent(event);
      }
    } catch (error) {
      this.handleError(error as Error);
    } finally {
      this.processing = false;
    }
  }

  private async processEvent(event: any): Promise<void> {
    switch (event.type) {
      case 'entry-added':
        await this.handleEntryAdded(event.data);
        break;
      case 'entry-updated':
        await this.handleEntryUpdated(event.data);
        break;
      case 'search-performed':
        await this.handleSearchPerformed(event.data);
        break;
      default:
        this.log('warn', `Unknown event type: ${event.type}`);
    }
  }

  async processData(data: any, context?: any): Promise<any> {
    // This plugin doesn't process data directly,
    // it reacts to events
    return data;
  }
}
```

## Plugin Testing

### Unit Testing

```typescript
// test/plugins/MyPlugin.test.ts
import { MyFirstPlugin } from '../../src/services/storage/plugins/MyFirstPlugin';
import { MemoryAdapter } from '../../src/services/storage/adapters/MemoryAdapter';

describe('MyFirstPlugin', () => {
  let plugin: MyFirstPlugin;
  let adapter: MemoryAdapter;

  beforeEach(() => {
    adapter = new MemoryAdapter();
    plugin = new MyFirstPlugin(adapter, {
      enabled: true,
      options: { logLevel: 'error' } // Suppress logs in tests
    });
  });

  afterEach(async () => {
    if (plugin.isActive()) {
      await plugin.shutdown();
    }
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      await plugin.initialize();
      expect(plugin.isActive()).toBe(true);
      expect(plugin.getStatus()).toBe('active');
    });

    test('should have correct metadata', () => {
      const metadata = plugin.getMetadata();
      expect(metadata.name).toBe('MyFirstPlugin');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.mvp_version).toBe(1);
    });
  });

  describe('Data Processing', () => {
    beforeEach(async () => {
      await plugin.initialize();
    });

    test('should process data correctly', async () => {
      const input = { title: 'Test', category: 'Test' };
      const result = await plugin.processData(input);

      expect(result.title).toBe('Test');
      expect(result.category).toBe('Test');
      expect(result.processedAt).toBeInstanceOf(Date);
      expect(result.processedBy).toBe('MyFirstPlugin');
    });

    test('should handle null data', async () => {
      const result = await plugin.processData(null);
      expect(result.processedAt).toBeInstanceOf(Date);
      expect(result.processedBy).toBe('MyFirstPlugin');
    });

    test('should update metrics after processing', async () => {
      await plugin.processData({ test: true });
      
      const metrics = plugin.getMetrics();
      expect(metrics.operations_count).toBe(1);
      expect(metrics.total_processing_time).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle processing errors', async () => {
      await plugin.initialize();
      
      // Mock a processing error
      jest.spyOn(plugin, 'processData').mockRejectedValue(new Error('Test error'));
      
      await expect(plugin.processData({})).rejects.toThrow('Test error');
      
      const metrics = plugin.getMetrics();
      expect(metrics.error_count).toBe(1);
    });
  });

  describe('Health Checks', () => {
    test('should report healthy when active', async () => {
      await plugin.initialize();
      
      const health = await plugin.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.details.status).toBe('active');
    });

    test('should report unhealthy when inactive', async () => {
      const health = await plugin.healthCheck();
      expect(health.healthy).toBe(false);
    });
  });
});
```

### Integration Testing

```typescript
// test/integration/plugin-integration.test.ts
import { StorageService } from '../../src/services/storage/StorageService';
import { MyFirstPlugin } from '../../src/services/storage/plugins/MyFirstPlugin';

describe('Plugin Integration', () => {
  let storage: StorageService;

  beforeEach(async () => {
    storage = new StorageService({
      adapter: 'memory',
      enablePlugins: true
    });

    await storage.registerPlugin('myFirst', new MyFirstPlugin(
      storage.getAdapter(),
      { enabled: true }
    ));

    await storage.initialize();
  });

  afterEach(async () => {
    await storage.close();
  });

  test('should integrate with storage service', async () => {
    const plugin = storage.getPlugin('myFirst');
    expect(plugin).toBeDefined();
    expect(plugin.isActive()).toBe(true);
  });

  test('should process data through plugin', async () => {
    const plugin = storage.getPlugin('myFirst');
    const result = await plugin.processData({ test: 'integration' });
    
    expect(result.test).toBe('integration');
    expect(result.processedBy).toBe('MyFirstPlugin');
  });

  test('should handle plugin lifecycle with storage', async () => {
    // Verify plugin is active
    expect(storage.getPlugin('myFirst').isActive()).toBe(true);
    
    // Shutdown storage (should shutdown plugins)
    await storage.close();
    
    // Plugin should be inactive
    expect(storage.getPlugin('myFirst').isActive()).toBe(false);
  });
});
```

### Performance Testing

```typescript
// test/performance/plugin-performance.test.ts
describe('Plugin Performance', () => {
  let plugin: MyFirstPlugin;

  beforeEach(async () => {
    plugin = new MyFirstPlugin(new MemoryAdapter());
    await plugin.initialize();
  });

  test('should process data within performance limits', async () => {
    const data = { large: 'x'.repeat(10000) };
    const iterations = 1000;

    const startTime = Date.now();
    
    for (let i = 0; i < iterations; i++) {
      await plugin.processData(data);
    }
    
    const totalTime = Date.now() - startTime;
    const avgTime = totalTime / iterations;

    expect(avgTime).toBeLessThan(10); // Less than 10ms per operation
  });

  test('should handle concurrent processing', async () => {
    const promises = [];
    
    for (let i = 0; i < 100; i++) {
      promises.push(plugin.processData({ id: i }));
    }
    
    const startTime = Date.now();
    const results = await Promise.all(promises);
    const totalTime = Date.now() - startTime;

    expect(results).toHaveLength(100);
    expect(totalTime).toBeLessThan(1000); // Less than 1 second for 100 operations
  });
});
```

## Best Practices

### Plugin Design Principles

```typescript
// ✅ Good: Single Responsibility
class SearchAnalyticsPlugin extends BaseStoragePlugin {
  // Only handles search analytics
  async processData(searchEvent: SearchEvent): Promise<SearchAnalytics> {
    return this.analyzeSearch(searchEvent);
  }
}

// ❌ Bad: Multiple Responsibilities
class EverythingPlugin extends BaseStoragePlugin {
  // Handles search, patterns, code analysis, backups...
  async processData(data: any): Promise<any> {
    // Too much logic in one plugin
  }
}
```

### Configuration Management

```typescript
class WellConfiguredPlugin extends BaseStoragePlugin {
  protected getDefaultConfig(): PluginConfig {
    return {
      enabled: true,
      options: {
        // Provide sensible defaults
        batchSize: 100,
        timeoutMs: 5000,
        retryAttempts: 3,
        logLevel: 'info',
        
        // Environment-specific overrides
        ...(process.env.NODE_ENV === 'production' && {
          logLevel: 'warn',
          timeoutMs: 10000
        }),
        
        ...(process.env.NODE_ENV === 'test' && {
          logLevel: 'error',
          timeoutMs: 1000
        })
      }
    };
  }

  protected validateConfiguration(): void {
    super.validateConfiguration();

    const { batchSize, timeoutMs, retryAttempts } = this.config.options || {};

    if (batchSize && (batchSize < 1 || batchSize > 1000)) {
      throw new Error('batchSize must be between 1 and 1000');
    }

    if (timeoutMs && (timeoutMs < 100 || timeoutMs > 60000)) {
      throw new Error('timeoutMs must be between 100 and 60000');
    }

    if (retryAttempts && (retryAttempts < 0 || retryAttempts > 10)) {
      throw new Error('retryAttempts must be between 0 and 10');
    }
  }
}
```

### Error Handling

```typescript
class RobustPlugin extends BaseStoragePlugin {
  async processData(data: any, context?: any): Promise<any> {
    try {
      // Validate input
      this.validateInput(data);
      
      // Process with timeout
      return await this.processWithTimeout(data, context);
    } catch (error) {
      // Classify error
      if (error instanceof ValidationError) {
        this.log('warn', 'Input validation failed', { error: error.message });
        throw error; // Re-throw validation errors
      } else if (error instanceof TimeoutError) {
        this.log('error', 'Processing timeout', { timeout: this.config.options?.timeoutMs });
        // Return partial result or default
        return this.getDefaultResult(data);
      } else {
        // Unexpected error
        this.handleError(error as Error);
        throw new Error(`Plugin processing failed: ${error.message}`);
      }
    }
  }

  private async processWithTimeout(data: any, context?: any): Promise<any> {
    const timeout = this.config.options?.timeoutMs || 5000;
    
    return Promise.race([
      this.doProcessing(data, context),
      new Promise((_, reject) => {
        setTimeout(() => reject(new TimeoutError(`Processing timeout after ${timeout}ms`)), timeout);
      })
    ]);
  }

  private validateInput(data: any): void {
    if (!data) {
      throw new ValidationError('Data is required');
    }
    
    if (typeof data !== 'object') {
      throw new ValidationError('Data must be an object');
    }
    
    // Additional validation logic...
  }
}
```

### Resource Management

```typescript
class ResourceAwarePlugin extends BaseStoragePlugin {
  private connections: Set<any> = new Set();
  private timers: Set<NodeJS.Timeout> = new Set();
  private intervals: Set<NodeJS.Timeout> = new Set();

  protected async initializePlugin(): Promise<void> {
    // Track all resources for proper cleanup
    const connection = await this.createConnection();
    this.connections.add(connection);

    const timer = setTimeout(() => this.performMaintenance(), 60000);
    this.timers.add(timer);

    const interval = setInterval(() => this.collectMetrics(), 10000);
    this.intervals.add(interval);
  }

  protected async cleanupPlugin(): Promise<void> {
    // Clean up all resources
    for (const connection of this.connections) {
      await this.closeConnection(connection);
    }
    this.connections.clear();

    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();

    for (const interval of this.intervals) {
      clearInterval(interval);
    }
    this.intervals.clear();
  }

  // Helper method to create managed timers
  private createManagedTimer(callback: () => void, delay: number): NodeJS.Timeout {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      callback();
    }, delay);
    
    this.timers.add(timer);
    return timer;
  }
}
```

### Logging and Monitoring

```typescript
class ObservablePlugin extends BaseStoragePlugin {
  async processData(data: any, context?: any): Promise<any> {
    const operationId = this.generateOperationId();
    const startTime = Date.now();

    this.log('info', 'Processing started', {
      operationId,
      dataSize: this.getDataSize(data),
      context
    });

    try {
      const result = await this.doProcessing(data, context);
      
      const duration = Date.now() - startTime;
      this.log('info', 'Processing completed', {
        operationId,
        duration,
        resultSize: this.getDataSize(result)
      });

      // Emit metrics
      this.emit('processing-completed', {
        operationId,
        duration,
        success: true,
        inputSize: this.getDataSize(data),
        outputSize: this.getDataSize(result)
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.log('error', 'Processing failed', {
        operationId,
        duration,
        error: error.message
      });

      this.emit('processing-failed', {
        operationId,
        duration,
        error: error.message
      });

      throw error;
    }
  }

  private generateOperationId(): string {
    return `${this.getName()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

## Examples

### MVP2: Pattern Detection Plugin

```typescript
// src/services/storage/plugins/PatternDetectionPlugin.ts
import { BaseStoragePlugin } from './BaseStoragePlugin';

export class PatternDetectionPlugin extends BaseStoragePlugin {
  private detectionInterval: NodeJS.Timeout | null = null;
  private patterns: Map<string, Pattern> = new Map();

  getName(): string { return 'PatternDetectionPlugin'; }
  getVersion(): string { return '2.0.0'; }
  getDescription(): string { return 'Detects recurring incident patterns'; }
  getMVPVersion(): number { return 2; }
  getDependencies(): string[] { return ['full-text-search']; }

  protected async initializePlugin(): Promise<void> {
    // Create pattern detection tables
    await this.createPatternTables();
    
    // Start pattern detection process
    this.startPatternDetection();
  }

  protected async cleanupPlugin(): Promise<void> {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
  }

  async processData(incident: Incident): Promise<PatternAnalysis> {
    // Store incident for pattern analysis
    await this.storeIncident(incident);
    
    // Check for immediate patterns
    const patterns = await this.detectPatternsForIncident(incident);
    
    return {
      incident,
      patterns,
      recommendations: this.generateRecommendations(patterns)
    };
  }

  private async createPatternTables(): Promise<void> {
    await this.adapter.executeSQL(`
      CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        component TEXT,
        severity TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        pattern_id TEXT
      )
    `);

    await this.adapter.executeSQL(`
      CREATE TABLE IF NOT EXISTS patterns (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        frequency INTEGER DEFAULT 1,
        first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        confidence REAL DEFAULT 0.0
      )
    `);
  }

  private startPatternDetection(): void {
    const interval = this.config.options?.detectionInterval || 300000; // 5 minutes
    
    this.detectionInterval = setInterval(async () => {
      try {
        await this.runPatternDetection();
      } catch (error) {
        this.handleError(error as Error);
      }
    }, interval);
  }

  protected getDefaultConfig(): PluginConfig {
    return {
      enabled: true,
      options: {
        detectionInterval: 300000, // 5 minutes
        minimumOccurrences: 3,
        confidenceThreshold: 0.7,
        timeWindow: 86400000 // 24 hours
      }
    };
  }
}
```

### MVP3: Code Analysis Plugin

```typescript
// src/services/storage/plugins/CodeAnalysisPlugin.ts
export class CodeAnalysisPlugin extends BaseStoragePlugin {
  private codeParser: COBOLParser;
  
  getName(): string { return 'CodeAnalysisPlugin'; }
  getVersion(): string { return '3.0.0'; }
  getDescription(): string { return 'Analyzes COBOL code and links to KB entries'; }
  getMVPVersion(): number { return 3; }
  getDependencies(): string[] { return ['full-text-search', 'transactions']; }

  protected async initializePlugin(): Promise<void> {
    this.codeParser = new COBOLParser();
    await this.createCodeTables();
  }

  async processData(codeFile: CodeFile): Promise<CodeAnalysis> {
    // Parse COBOL code
    const parsed = this.codeParser.parse(codeFile.content);
    
    // Analyze for potential issues
    const issues = await this.analyzeForIssues(parsed);
    
    // Link to existing KB entries
    const linkedEntries = await this.linkToKBEntries(issues);
    
    // Store analysis results
    await this.storeAnalysis(codeFile.id, parsed, issues, linkedEntries);
    
    return {
      file: codeFile,
      parsed,
      issues,
      linkedEntries,
      metrics: this.calculateComplexityMetrics(parsed)
    };
  }

  private async analyzeForIssues(parsed: ParsedProgram): Promise<CodeIssue[]> {
    const issues: CodeIssue[] = [];
    
    // Check for common COBOL issues
    issues.push(...this.checkForDataExceptions(parsed));
    issues.push(...this.checkForFileHandling(parsed));
    issues.push(...this.checkForPerformanceIssues(parsed));
    
    return issues;
  }

  private async linkToKBEntries(issues: CodeIssue[]): Promise<KBEntryLink[]> {
    const links: KBEntryLink[] = [];
    
    for (const issue of issues) {
      const relatedEntries = await this.adapter.searchEntries(issue.description);
      
      for (const entry of relatedEntries) {
        if (entry.score > 0.8) { // High confidence match
          links.push({
            issueId: issue.id,
            kbEntryId: entry.entry.id,
            confidence: entry.score,
            matchType: entry.matchType
          });
        }
      }
    }
    
    return links;
  }

  protected getDefaultConfig(): PluginConfig {
    return {
      enabled: true,
      options: {
        supportedLanguages: ['COBOL'],
        enableSyntaxAnalysis: true,
        enableComplexityAnalysis: true,
        enableErrorMapping: true,
        confidenceThreshold: 0.8
      }
    };
  }
}
```

## Troubleshooting

### Common Issues

#### Plugin Not Loading

```typescript
// Check plugin registration
const plugins = storage.getRegisteredPlugins();
console.log('Registered plugins:', plugins);

// Check plugin status
const plugin = storage.getPlugin('myPlugin');
console.log('Plugin status:', plugin?.getStatus());

// Check plugin health
const health = await plugin?.healthCheck();
console.log('Plugin health:', health);
```

#### Plugin Initialization Failures

```typescript
// Add detailed logging
class DebuggablePlugin extends BaseStoragePlugin {
  protected async initializePlugin(): Promise<void> {
    try {
      this.log('info', 'Starting initialization...');
      
      // Step 1
      this.log('info', 'Validating dependencies...');
      await this.validateDependencies();
      
      // Step 2
      this.log('info', 'Setting up database...');
      await this.setupDatabase();
      
      // Step 3
      this.log('info', 'Initializing resources...');
      await this.initializeResources();
      
      this.log('info', 'Initialization completed successfully');
    } catch (error) {
      this.log('error', 'Initialization failed', { error: error.message });
      throw error;
    }
  }
}
```

#### Performance Issues

```typescript
// Monitor plugin performance
class PerformanceMonitoredPlugin extends BaseStoragePlugin {
  async processData(data: any, context?: any): Promise<any> {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();
    
    try {
      const result = await super.processData(data, context);
      
      const endTime = process.hrtime.bigint();
      const endMemory = process.memoryUsage();
      
      const duration = Number(endTime - startTime) / 1000000; // Convert to ms
      const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;
      
      if (duration > 1000) { // Slow operation
        this.log('warn', 'Slow operation detected', {
          duration,
          memoryDelta,
          dataSize: this.getDataSize(data)
        });
      }
      
      return result;
    } catch (error) {
      this.log('error', 'Processing failed', { error: error.message });
      throw error;
    }
  }
}
```

### Debugging Tools

```typescript
// Plugin debugging utilities
export class PluginDebugger {
  static async diagnosePlugin(plugin: IStoragePlugin): Promise<PluginDiagnostics> {
    const diagnostics: PluginDiagnostics = {
      name: plugin.getName(),
      version: plugin.getVersion(),
      status: plugin.getStatus(),
      config: plugin.getConfig(),
      metadata: plugin.getMetadata(),
      health: await plugin.healthCheck(),
      metrics: plugin.getMetrics(),
      dependencies: await this.checkDependencies(plugin),
      resources: await this.checkResources(plugin)
    };
    
    return diagnostics;
  }

  static async checkDependencies(plugin: IStoragePlugin): Promise<DependencyStatus[]> {
    const dependencies = plugin.getDependencies();
    const status: DependencyStatus[] = [];
    
    for (const dep of dependencies) {
      const satisfied = await this.checkDependency(plugin, dep);
      status.push({ name: dep, satisfied });
    }
    
    return status;
  }

  static generateReport(diagnostics: PluginDiagnostics): string {
    return `
Plugin Diagnostics Report
========================
Name: ${diagnostics.name}
Version: ${diagnostics.version}
Status: ${diagnostics.status}
Health: ${diagnostics.health.healthy ? 'Healthy' : 'Unhealthy'}

Configuration:
${JSON.stringify(diagnostics.config, null, 2)}

Metrics:
${JSON.stringify(diagnostics.metrics, null, 2)}

Dependencies:
${diagnostics.dependencies.map(d => `  ${d.name}: ${d.satisfied ? 'OK' : 'FAILED'}`).join('\n')}

Issues:
${diagnostics.health.healthy ? 'None' : JSON.stringify(diagnostics.health.details, null, 2)}
    `;
  }
}
```

## Next Steps

1. **Review [MVP Scenarios](./mvp-scenarios.md)** for specific plugin use cases
2. **Check [API Reference](./api-reference.md)** for detailed interface documentation
3. **See [Performance Guide](./performance.md)** for optimization strategies
4. **Study existing plugins** in `/src/services/storage/plugins/`
5. **Run plugin tests** to understand expected behavior

## Resources

- **Plugin Examples**: `/examples/plugins/`
- **Plugin Tests**: `/src/tests/plugins/`
- **Base Plugin Class**: `/src/services/storage/plugins/BaseStoragePlugin.ts`
- **Plugin Interfaces**: `/src/services/storage/IStorageService.ts`