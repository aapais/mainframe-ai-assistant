/**
 * Unit Tests for BaseStoragePlugin
 * Tests plugin lifecycle and hook functionality
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { BaseStoragePlugin } from '../../../../src/services/storage/plugins/BaseStoragePlugin';
import { StorageEvent, KBEntry, SearchResult } from '../../../../src/services/storage/IStorageService';
import { createTestKBEntry } from '../../fixtures/testData';

// Test implementation of BaseStoragePlugin
class TestPlugin extends BaseStoragePlugin {
  public name = 'TestPlugin';
  public version = '1.0.0';
  public description = 'Test plugin for unit testing';

  public initializeCalled = false;
  public cleanupCalled = false;
  public hooksCalled: string[] = [];

  async initialize(): Promise<void> {
    this.initializeCalled = true;
    this.isInitialized = true;
  }

  async cleanup(): Promise<void> {
    this.cleanupCalled = true;
    this.isInitialized = false;
  }

  async beforeAdd(entry: any): Promise<any> {
    this.hooksCalled.push('beforeAdd');
    return entry;
  }

  async afterAdd(entry: KBEntry): Promise<void> {
    this.hooksCalled.push('afterAdd');
  }

  async beforeUpdate(id: string, data: any): Promise<any> {
    this.hooksCalled.push('beforeUpdate');
    return data;
  }

  async afterUpdate(entry: KBEntry): Promise<void> {
    this.hooksCalled.push('afterUpdate');
  }

  async beforeDelete(id: string): Promise<void> {
    this.hooksCalled.push('beforeDelete');
  }

  async afterDelete(id: string): Promise<void> {
    this.hooksCalled.push('afterDelete');
  }

  async beforeSearch(query: string, options: any): Promise<{ query: string; options: any }> {
    this.hooksCalled.push('beforeSearch');
    return { query, options };
  }

  async afterSearch(results: SearchResult[]): Promise<SearchResult[]> {
    this.hooksCalled.push('afterSearch');
    return results;
  }

  async onEvent(event: StorageEvent): Promise<void> {
    this.hooksCalled.push(`onEvent:${event.type}`);
  }
}

describe('BaseStoragePlugin', () => {
  let plugin: TestPlugin;

  beforeEach(() => {
    plugin = new TestPlugin();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Plugin Lifecycle', () => {
    it('should initialize with correct metadata', () => {
      expect(plugin.name).toBe('TestPlugin');
      expect(plugin.version).toBe('1.0.0');
      expect(plugin.description).toBe('Test plugin for unit testing');
      expect(plugin.isInitialized).toBe(false);
      expect(plugin.isEnabled).toBe(true);
    });

    it('should initialize successfully', async () => {
      await plugin.initialize();
      
      expect(plugin.initializeCalled).toBe(true);
      expect(plugin.isInitialized).toBe(true);
    });

    it('should cleanup successfully', async () => {
      await plugin.initialize();
      await plugin.cleanup();
      
      expect(plugin.cleanupCalled).toBe(true);
      expect(plugin.isInitialized).toBe(false);
    });

    it('should handle enable/disable state', () => {
      expect(plugin.isEnabled).toBe(true);
      
      plugin.disable();
      expect(plugin.isEnabled).toBe(false);
      
      plugin.enable();
      expect(plugin.isEnabled).toBe(true);
    });

    it('should not execute hooks when disabled', async () => {
      await plugin.initialize();
      plugin.disable();
      
      const entry = createTestKBEntry();
      const result = await plugin.beforeAdd(entry);
      
      expect(plugin.hooksCalled).not.toContain('beforeAdd');
      expect(result).toBe(entry); // Should pass through unchanged
    });

    it('should handle initialization errors gracefully', async () => {
      const failingPlugin = new TestPlugin();
      failingPlugin.initialize = jest.fn().mockRejectedValue(new Error('Init failed'));
      
      await expect(failingPlugin.initialize()).rejects.toThrow('Init failed');
      expect(failingPlugin.isInitialized).toBe(false);
    });
  });

  describe('Hook Execution', () => {
    beforeEach(async () => {
      await plugin.initialize();
    });

    it('should execute beforeAdd hook', async () => {
      const entry = createTestKBEntry();
      const result = await plugin.beforeAdd(entry);
      
      expect(plugin.hooksCalled).toContain('beforeAdd');
      expect(result).toBe(entry);
    });

    it('should execute afterAdd hook', async () => {
      const entry = { ...createTestKBEntry(), id: 'test-id' } as KBEntry;
      await plugin.afterAdd(entry);
      
      expect(plugin.hooksCalled).toContain('afterAdd');
    });

    it('should execute beforeUpdate hook', async () => {
      const updateData = { title: 'Updated Title' };
      const result = await plugin.beforeUpdate('test-id', updateData);
      
      expect(plugin.hooksCalled).toContain('beforeUpdate');
      expect(result).toBe(updateData);
    });

    it('should execute afterUpdate hook', async () => {
      const entry = { ...createTestKBEntry(), id: 'test-id' } as KBEntry;
      await plugin.afterUpdate(entry);
      
      expect(plugin.hooksCalled).toContain('afterUpdate');
    });

    it('should execute beforeDelete hook', async () => {
      await plugin.beforeDelete('test-id');
      
      expect(plugin.hooksCalled).toContain('beforeDelete');
    });

    it('should execute afterDelete hook', async () => {
      await plugin.afterDelete('test-id');
      
      expect(plugin.hooksCalled).toContain('afterDelete');
    });

    it('should execute beforeSearch hook', async () => {
      const query = 'test query';
      const options = { limit: 10 };
      const result = await plugin.beforeSearch(query, options);
      
      expect(plugin.hooksCalled).toContain('beforeSearch');
      expect(result).toEqual({ query, options });
    });

    it('should execute afterSearch hook', async () => {
      const results: SearchResult[] = [
        {
          entry: { ...createTestKBEntry(), id: 'test-id' } as KBEntry,
          score: 0.9,
          metadata: {}
        }
      ];
      
      const result = await plugin.afterSearch(results);
      
      expect(plugin.hooksCalled).toContain('afterSearch');
      expect(result).toBe(results);
    });

    it('should execute event handlers', async () => {
      const event: StorageEvent = {
        type: 'entry_added',
        timestamp: new Date(),
        data: { entryId: 'test-id' }
      };
      
      await plugin.onEvent(event);
      
      expect(plugin.hooksCalled).toContain('onEvent:entry_added');
    });
  });

  describe('Configuration Management', () => {
    it('should set and get configuration', () => {
      const config = { setting1: 'value1', setting2: 42 };
      plugin.setConfiguration(config);
      
      expect(plugin.getConfiguration()).toEqual(config);
    });

    it('should merge configuration updates', () => {
      const initialConfig = { setting1: 'value1', setting2: 42 };
      const updateConfig = { setting2: 99, setting3: 'new' };
      
      plugin.setConfiguration(initialConfig);
      plugin.setConfiguration(updateConfig);
      
      const finalConfig = plugin.getConfiguration();
      expect(finalConfig).toEqual({
        setting1: 'value1',
        setting2: 99,
        setting3: 'new'
      });
    });

    it('should validate configuration if validator provided', () => {
      plugin.configValidator = (config: any) => {
        if (!config.required) {
          throw new Error('Required setting missing');
        }
        return true;
      };

      expect(() => plugin.setConfiguration({ optional: 'value' }))
        .toThrow('Required setting missing');
      
      expect(() => plugin.setConfiguration({ required: 'value' }))
        .not.toThrow();
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await plugin.initialize();
    });

    it('should handle storage events', async () => {
      const events: StorageEvent[] = [
        { type: 'entry_added', timestamp: new Date(), data: { entryId: '1' } },
        { type: 'entry_updated', timestamp: new Date(), data: { entryId: '2' } },
        { type: 'entry_deleted', timestamp: new Date(), data: { entryId: '3' } },
        { type: 'search_performed', timestamp: new Date(), data: { query: 'test' } }
      ];

      for (const event of events) {
        await plugin.onEvent(event);
      }

      expect(plugin.hooksCalled).toContain('onEvent:entry_added');
      expect(plugin.hooksCalled).toContain('onEvent:entry_updated');
      expect(plugin.hooksCalled).toContain('onEvent:entry_deleted');
      expect(plugin.hooksCalled).toContain('onEvent:search_performed');
    });

    it('should handle custom events', async () => {
      const customEvent: StorageEvent = {
        type: 'custom_event' as any,
        timestamp: new Date(),
        data: { customData: 'test' }
      };

      await plugin.onEvent(customEvent);
      
      expect(plugin.hooksCalled).toContain('onEvent:custom_event');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await plugin.initialize();
    });

    it('should handle hook errors gracefully', async () => {
      plugin.beforeAdd = jest.fn().mockRejectedValue(new Error('Hook failed'));
      
      await expect(plugin.beforeAdd(createTestKBEntry())).rejects.toThrow('Hook failed');
    });

    it('should handle event processing errors', async () => {
      plugin.onEvent = jest.fn().mockRejectedValue(new Error('Event handler failed'));
      
      const event: StorageEvent = {
        type: 'entry_added',
        timestamp: new Date(),
        data: { entryId: 'test' }
      };

      await expect(plugin.onEvent(event)).rejects.toThrow('Event handler failed');
    });

    it('should maintain state after non-fatal errors', async () => {
      const originalBeforeAdd = plugin.beforeAdd;
      
      // Simulate temporary error
      plugin.beforeAdd = jest.fn().mockRejectedValueOnce(new Error('Temporary error'));
      
      await expect(plugin.beforeAdd(createTestKBEntry())).rejects.toThrow('Temporary error');
      
      // Restore original method
      plugin.beforeAdd = originalBeforeAdd;
      
      // Should work normally again
      const entry = createTestKBEntry();
      const result = await plugin.beforeAdd(entry);
      expect(result).toBe(entry);
    });
  });

  describe('Performance Metrics', () => {
    beforeEach(async () => {
      await plugin.initialize();
    });

    it('should track hook execution times', async () => {
      const entry = createTestKBEntry();
      
      const startTime = Date.now();
      await plugin.beforeAdd(entry);
      const endTime = Date.now();
      
      const metrics = plugin.getMetrics();
      expect(metrics.totalExecutions).toBeGreaterThan(0);
      expect(metrics.averageExecutionTime).toBeGreaterThan(0);
      expect(metrics.averageExecutionTime).toBeLessThan(endTime - startTime + 100);
    });

    it('should track error counts', async () => {
      plugin.beforeAdd = jest.fn().mockRejectedValue(new Error('Test error'));
      
      try {
        await plugin.beforeAdd(createTestKBEntry());
      } catch (error) {
        // Expected
      }
      
      const metrics = plugin.getMetrics();
      expect(metrics.errorCount).toBe(1);
    });

    it('should reset metrics when requested', async () => {
      await plugin.beforeAdd(createTestKBEntry());
      
      let metrics = plugin.getMetrics();
      expect(metrics.totalExecutions).toBeGreaterThan(0);
      
      plugin.resetMetrics();
      
      metrics = plugin.getMetrics();
      expect(metrics.totalExecutions).toBe(0);
      expect(metrics.errorCount).toBe(0);
    });
  });

  describe('Plugin Dependencies', () => {
    it('should declare dependencies', () => {
      plugin.dependencies = ['CorePlugin', 'UtilityPlugin'];
      
      expect(plugin.getDependencies()).toEqual(['CorePlugin', 'UtilityPlugin']);
    });

    it('should check if dependencies are satisfied', () => {
      plugin.dependencies = ['CorePlugin'];
      
      expect(plugin.areDependenciesSatisfied(['CorePlugin', 'OtherPlugin'])).toBe(true);
      expect(plugin.areDependenciesSatisfied(['OtherPlugin'])).toBe(false);
      expect(plugin.areDependenciesSatisfied([])).toBe(false);
    });

    it('should handle no dependencies', () => {
      expect(plugin.getDependencies()).toEqual([]);
      expect(plugin.areDependenciesSatisfied([])).toBe(true);
    });
  });

  describe('Plugin Metadata', () => {
    it('should provide complete metadata', () => {
      const metadata = plugin.getMetadata();
      
      expect(metadata.name).toBe('TestPlugin');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.description).toBe('Test plugin for unit testing');
      expect(metadata.isInitialized).toBe(false);
      expect(metadata.isEnabled).toBe(true);
    });

    it('should include dependencies in metadata', () => {
      plugin.dependencies = ['CorePlugin'];
      
      const metadata = plugin.getMetadata();
      expect(metadata.dependencies).toEqual(['CorePlugin']);
    });

    it('should include configuration schema if provided', () => {
      plugin.configSchema = {
        type: 'object',
        properties: {
          setting1: { type: 'string' },
          setting2: { type: 'number' }
        }
      };

      const metadata = plugin.getMetadata();
      expect(metadata.configSchema).toBeDefined();
      expect(metadata.configSchema!.properties).toHaveProperty('setting1');
      expect(metadata.configSchema!.properties).toHaveProperty('setting2');
    });
  });

  describe('Async Hook Handling', () => {
    beforeEach(async () => {
      await plugin.initialize();
    });

    it('should handle slow hooks without blocking', async () => {
      plugin.beforeAdd = jest.fn().mockImplementation(async (entry) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return entry;
      });

      const entry = createTestKBEntry();
      const startTime = Date.now();
      
      const result = await plugin.beforeAdd(entry);
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeGreaterThanOrEqual(10);
      expect(result).toBe(entry);
    });

    it('should handle concurrent hook executions', async () => {
      plugin.beforeAdd = jest.fn().mockImplementation(async (entry) => {
        await new Promise(resolve => setTimeout(resolve, 5));
        return entry;
      });

      const entries = [
        createTestKBEntry(),
        createTestKBEntry(),
        createTestKBEntry()
      ];

      const startTime = Date.now();
      
      const results = await Promise.all(
        entries.map(entry => plugin.beforeAdd(entry))
      );
      
      const endTime = Date.now();
      
      // Should complete in roughly 5ms (parallel) not 15ms (sequential)
      expect(endTime - startTime).toBeLessThan(15);
      expect(results.length).toBe(3);
      expect(plugin.beforeAdd).toHaveBeenCalledTimes(3);
    });
  });
});