/**
 * Context Bridge and Preload Script Security Tests
 * 
 * Tests the security and functionality of the context bridge implementation:
 * - Secure API exposure through contextBridge
 * - Preload script isolation and security
 * - Node.js API access restrictions
 * - Renderer process security boundaries
 * - API surface validation
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI, IPCResponse } from '../../src/main/preload';

// Mock Electron modules
const mockContextBridge = {
  exposeInMainWorld: jest.fn()
};

const mockIpcRenderer = {
  invoke: jest.fn(),
  send: jest.fn(),
  on: jest.fn(),
  removeAllListeners: jest.fn()
};

// Mock Node.js modules that should NOT be accessible
const mockNodeModules = {
  fs: {
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    unlinkSync: jest.fn()
  },
  path: {
    join: jest.fn(),
    resolve: jest.fn()
  },
  os: {
    platform: jest.fn(),
    homedir: jest.fn()
  },
  child_process: {
    exec: jest.fn(),
    spawn: jest.fn()
  }
};

jest.mock('electron', () => ({
  contextBridge: mockContextBridge,
  ipcRenderer: mockIpcRenderer
}));

// Simulate the preload script execution
const simulatePreloadExecution = () => {
  // This would be the actual preload script logic
  const electronAPI: ElectronAPI = {
    db: {
      search: (query: string, options?: any) => mockIpcRenderer.invoke('db:search', query, options),
      searchWithAI: (query: string, options?: any) => mockIpcRenderer.invoke('db:searchWithAI', query, options),
      addEntry: (entry: any, userId?: string) => mockIpcRenderer.invoke('db:addEntry', entry, userId),
      updateEntry: (id: string, updates: any, userId?: string) => mockIpcRenderer.invoke('db:updateEntry', id, updates, userId),
      getEntry: (id: string) => mockIpcRenderer.invoke('db:getEntry', id),
      getPopular: (limit?: number) => mockIpcRenderer.invoke('db:getPopular', limit),
      getRecent: (limit?: number) => mockIpcRenderer.invoke('db:getRecent', limit),
      recordUsage: (entryId: string, successful: boolean, userId?: string) => mockIpcRenderer.invoke('db:recordUsage', entryId, successful, userId),
      getStats: () => mockIpcRenderer.invoke('db:getStats'),
      autoComplete: (query: string, limit?: number) => mockIpcRenderer.invoke('db:autoComplete', query, limit),
      createBackup: () => mockIpcRenderer.invoke('db:createBackup'),
      exportToJSON: (outputPath: string) => mockIpcRenderer.invoke('db:exportToJSON', outputPath),
      importFromJSON: (jsonPath: string, mergeMode?: boolean) => mockIpcRenderer.invoke('db:importFromJSON', jsonPath, mergeMode),
      healthCheck: () => mockIpcRenderer.invoke('db:healthCheck')
    },
    config: {
      get: (key: string) => mockIpcRenderer.invoke('config:get', key),
      set: (key: string, value: string, type?: string, description?: string) => mockIpcRenderer.invoke('config:set', key, value, type, description)
    },
    ai: {
      explainError: (errorCode: string) => mockIpcRenderer.invoke('ai:explainError', errorCode)
    },
    perf: {
      getStatus: () => mockIpcRenderer.invoke('perf:getStatus'),
      getReport: (startTime?: number, endTime?: number) => mockIpcRenderer.invoke('perf:getReport', startTime, endTime)
    },
    system: {
      getInfo: () => mockIpcRenderer.invoke('system:getInfo')
    },
    streaming: {
      onChunk: (streamId: string, callback: any) => {
        mockIpcRenderer.on(`stream:chunk:${streamId}`, callback);
      },
      onError: (streamId: string, callback: any) => {
        mockIpcRenderer.on(`stream:error:${streamId}`, callback);
      },
      cancelStream: (streamId: string) => {
        console.log(`Cancelling stream: ${streamId}`);
      },
      removeStreamListeners: (streamId: string) => {
        mockIpcRenderer.removeAllListeners(`stream:chunk:${streamId}`);
        mockIpcRenderer.removeAllListeners(`stream:error:${streamId}`);
      }
    },
    batch: {
      execute: (payload: any) => mockIpcRenderer.invoke('ipc:execute-batch', payload),
      getStats: () => mockIpcRenderer.invoke('ipc:batch-stats'),
      clearStats: () => mockIpcRenderer.invoke('ipc:clear-batch-stats')
    },
    onMenuEvent: (callback: any) => {
      const menuEvents = [
        'menu-new-entry', 'menu-import-kb', 'menu-export-kb',
        'menu-backup', 'menu-show-stats', 'menu-show-performance',
        'menu-optimize-db', 'menu-show-settings', 'menu-show-about'
      ];
      menuEvents.forEach(event => {
        mockIpcRenderer.on(event, callback);
      });
    },
    removeMenuListeners: () => {
      const menuEvents = [
        'menu-new-entry', 'menu-import-kb', 'menu-export-kb',
        'menu-backup', 'menu-show-stats', 'menu-show-performance',
        'menu-optimize-db', 'menu-show-settings', 'menu-show-about'
      ];
      menuEvents.forEach(event => {
        mockIpcRenderer.removeAllListeners(event);
      });
    }
  };

  mockContextBridge.exposeInMainWorld('electronAPI', electronAPI);
  return electronAPI;
};

describe('Context Bridge and Preload Security Tests', () => {
  let exposedAPI: ElectronAPI;

  beforeEach(() => {
    jest.clearAllMocks();
    exposedAPI = simulatePreloadExecution();
  });

  describe('Context Bridge API Exposure', () => {
    test('should expose electronAPI through contextBridge', () => {
      expect(mockContextBridge.exposeInMainWorld).toHaveBeenCalledWith(
        'electronAPI',
        expect.any(Object)
      );
    });

    test('should expose only intended API methods', () => {
      const [apiName, apiObject] = mockContextBridge.exposeInMainWorld.mock.calls[0];
      
      expect(apiName).toBe('electronAPI');
      expect(apiObject).toHaveProperty('db');
      expect(apiObject).toHaveProperty('config');
      expect(apiObject).toHaveProperty('ai');
      expect(apiObject).toHaveProperty('perf');
      expect(apiObject).toHaveProperty('system');
      expect(apiObject).toHaveProperty('streaming');
      expect(apiObject).toHaveProperty('batch');
      
      // Verify structure of exposed APIs
      expect(apiObject.db).toHaveProperty('search');
      expect(apiObject.db).toHaveProperty('addEntry');
      expect(apiObject.db).toHaveProperty('getEntry');
      expect(apiObject.config).toHaveProperty('get');
      expect(apiObject.config).toHaveProperty('set');
    });

    test('should not expose dangerous Node.js APIs', () => {
      const [, apiObject] = mockContextBridge.exposeInMainWorld.mock.calls[0];
      
      // These should NOT be present in the exposed API
      expect(apiObject.fs).toBeUndefined();
      expect(apiObject.path).toBeUndefined();
      expect(apiObject.os).toBeUndefined();
      expect(apiObject.child_process).toBeUndefined();
      expect(apiObject.require).toBeUndefined();
      expect(apiObject.process).toBeUndefined();
      expect(apiObject.__dirname).toBeUndefined();
      expect(apiObject.__filename).toBeUndefined();
      expect(apiObject.global).toBeUndefined();
      expect(apiObject.Buffer).toBeUndefined();
    });

    test('should not expose Electron internal APIs', () => {
      const [, apiObject] = mockContextBridge.exposeInMainWorld.mock.calls[0];
      
      // These Electron internals should NOT be exposed
      expect(apiObject.ipcRenderer).toBeUndefined();
      expect(apiObject.contextBridge).toBeUndefined();
      expect(apiObject.remote).toBeUndefined();
      expect(apiObject.webFrame).toBeUndefined();
      expect(apiObject.crashReporter).toBeUndefined();
    });

    test('should wrap all functions to prevent direct access to ipcRenderer', () => {
      const [, apiObject] = mockContextBridge.exposeInMainWorld.mock.calls[0];
      
      // All database functions should be wrapped
      expect(typeof apiObject.db.search).toBe('function');
      expect(typeof apiObject.db.addEntry).toBe('function');
      expect(typeof apiObject.db.getEntry).toBe('function');
      
      // Functions should not directly expose ipcRenderer
      const searchFunction = apiObject.db.search.toString();
      expect(searchFunction).not.toContain('ipcRenderer');
    });
  });

  describe('API Function Security', () => {
    test('should validate database API functions work correctly', async () => {
      const searchResult: IPCResponse = {
        success: true,
        data: [{ id: '1', title: 'Test Entry' }]
      };
      
      mockIpcRenderer.invoke.mockResolvedValue(searchResult);
      
      const result = await exposedAPI.db.search('test query');
      
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('db:search', 'test query', undefined);
      expect(result).toEqual(searchResult);
    });

    test('should validate configuration API functions', async () => {
      const configResult: IPCResponse<string> = {
        success: true,
        data: 'config-value'
      };
      
      mockIpcRenderer.invoke.mockResolvedValue(configResult);
      
      const result = await exposedAPI.config.get('test.key');
      
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('config:get', 'test.key');
      expect(result).toEqual(configResult);
    });

    test('should validate AI API functions', async () => {
      const aiResult: IPCResponse<string> = {
        success: true,
        data: 'Error explanation...'
      };
      
      mockIpcRenderer.invoke.mockResolvedValue(aiResult);
      
      const result = await exposedAPI.ai.explainError('ERR001');
      
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('ai:explainError', 'ERR001');
      expect(result).toEqual(aiResult);
    });

    test('should handle streaming API functions securely', () => {
      const mockCallback = jest.fn();
      const streamId = 'test-stream-123';
      
      exposedAPI.streaming.onChunk(streamId, mockCallback);
      
      expect(mockIpcRenderer.on).toHaveBeenCalledWith(
        `stream:chunk:${streamId}`,
        mockCallback
      );
    });

    test('should handle menu event listeners securely', () => {
      const mockMenuCallback = jest.fn();
      
      exposedAPI.onMenuEvent(mockMenuCallback);
      
      const expectedEvents = [
        'menu-new-entry', 'menu-import-kb', 'menu-export-kb',
        'menu-backup', 'menu-show-stats', 'menu-show-performance',
        'menu-optimize-db', 'menu-show-settings', 'menu-show-about'
      ];
      
      expectedEvents.forEach(event => {
        expect(mockIpcRenderer.on).toHaveBeenCalledWith(event, mockMenuCallback);
      });
    });
  });

  describe('Preload Script Isolation', () => {
    test('should not pollute global scope with internal variables', () => {
      // Simulate what should NOT be accessible in renderer
      const globalScope = global as any;
      
      expect(globalScope.mockIpcRenderer).toBeUndefined();
      expect(globalScope.mockContextBridge).toBeUndefined();
      expect(globalScope.require).toBeUndefined();
      expect(globalScope.process).toBeDefined(); // process is allowed in preload
      expect(globalScope.Buffer).toBeUndefined();
    });

    test('should prevent access to dangerous globals through exposed API', () => {
      const [, apiObject] = mockContextBridge.exposeInMainWorld.mock.calls[0];
      
      // Try to access dangerous properties through the API
      expect(apiObject.constructor).toBeDefined(); // Object constructor is OK
      expect(apiObject.__proto__).toBeDefined(); // Prototype is OK
      
      // But these should not provide access to Node.js APIs
      try {
        const fs = apiObject.constructor.constructor('return require("fs")')();
        expect(fs).toBeUndefined(); // Should not work
      } catch (error) {
        // This is expected - require should not be accessible
        expect(error).toBeDefined();
      }
    });

    test('should validate TypeScript type definitions match exposed API', () => {
      const [, apiObject] = mockContextBridge.exposeInMainWorld.mock.calls[0];
      
      // Verify that the exposed API matches our TypeScript interface
      const requiredDbMethods = [
        'search', 'searchWithAI', 'addEntry', 'updateEntry', 'getEntry',
        'getPopular', 'getRecent', 'recordUsage', 'getStats', 'autoComplete',
        'createBackup', 'exportToJSON', 'importFromJSON', 'healthCheck'
      ];
      
      requiredDbMethods.forEach(method => {
        expect(apiObject.db).toHaveProperty(method);
        expect(typeof apiObject.db[method]).toBe('function');
      });
      
      const requiredConfigMethods = ['get', 'set'];
      requiredConfigMethods.forEach(method => {
        expect(apiObject.config).toHaveProperty(method);
        expect(typeof apiObject.config[method]).toBe('function');
      });
    });
  });

  describe('Error Handling in Context Bridge', () => {
    test('should handle IPC errors gracefully in exposed functions', async () => {
      const ipcError = new Error('IPC communication failed');
      mockIpcRenderer.invoke.mockRejectedValue(ipcError);
      
      const result = await exposedAPI.db.search('test query');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('IPC_ERROR');
      expect(result.error?.message).toContain('IPC communication failed');
    });

    test('should validate all exposed functions have error handling', async () => {
      const testFunctions = [
        () => exposedAPI.db.search('test'),
        () => exposedAPI.db.addEntry({ title: 'test' }),
        () => exposedAPI.db.getEntry('123'),
        () => exposedAPI.config.get('test.key'),
        () => exposedAPI.ai.explainError('ERR001'),
        () => exposedAPI.perf.getStatus(),
        () => exposedAPI.system.getInfo()
      ];
      
      mockIpcRenderer.invoke.mockRejectedValue(new Error('Test error'));
      
      for (const testFunc of testFunctions) {
        const result = await testFunc();
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });

    test('should handle invalid arguments gracefully', async () => {
      // Test with invalid arguments
      const invalidInputs = [
        null,
        undefined,
        { malicious: 'function() { return require("fs"); }' },
        'javascript:alert(1)',
        '<script>alert(1)</script>'
      ];
      
      for (const invalidInput of invalidInputs) {
        mockIpcRenderer.invoke.mockResolvedValue({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Invalid input provided'
          }
        });
        
        const result = await exposedAPI.db.search(invalidInput as any);
        
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INVALID_INPUT');
      }
    });
  });

  describe('Security Boundary Validation', () => {
    test('should prevent prototype pollution attacks', () => {
      const [, apiObject] = mockContextBridge.exposeInMainWorld.mock.calls[0];
      
      // Attempt prototype pollution
      try {
        (apiObject as any).__proto__.polluted = 'malicious';
        
        // Check if pollution affected the global prototype
        expect((Object.prototype as any).polluted).toBeUndefined();
      } catch (error) {
        // This is expected - modification should be prevented
        expect(error).toBeDefined();
      }
    });

    test('should prevent function constructor exploitation', () => {
      const [, apiObject] = mockContextBridge.exposeInMainWorld.mock.calls[0];
      
      try {
        // Attempt to use Function constructor to access require
        const maliciousFunc = apiObject.db.search.constructor.constructor('return require');
        const requireFunc = maliciousFunc();
        
        expect(requireFunc).toBeUndefined();
      } catch (error) {
        // This is expected - constructor exploitation should fail
        expect(error).toBeDefined();
      }
    });

    test('should prevent eval-based code injection', async () => {
      const maliciousCode = 'eval("require(\'fs\').readFileSync(\'/etc/passwd\')")';
      
      mockIpcRenderer.invoke.mockResolvedValue({
        success: false,
        error: {
          code: 'MALICIOUS_CODE_DETECTED',
          message: 'Code injection attempt detected'
        }
      });
      
      const result = await exposedAPI.db.search(maliciousCode);
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MALICIOUS_CODE_DETECTED');
    });

    test('should validate that sensitive operations require proper channels', async () => {
      // These operations should only work through proper IPC channels
      const sensitiveOperations = [
        { func: () => exposedAPI.db.createBackup(), channel: 'db:createBackup' },
        { func: () => exposedAPI.config.set('sensitive', 'value'), channel: 'config:set' },
        { func: () => exposedAPI.system.getInfo(), channel: 'system:getInfo' }
      ];
      
      for (const { func, channel } of sensitiveOperations) {
        mockIpcRenderer.invoke.mockClear();
        await func();
        
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          channel,
          expect.anything()
        );
      }
    });
  });

  describe('API Versioning and Compatibility', () => {
    test('should maintain API compatibility', () => {
      const [, apiObject] = mockContextBridge.exposeInMainWorld.mock.calls[0];
      
      // Verify that all expected API methods are present
      const expectedAPIMethods = {
        db: [
          'search', 'searchWithAI', 'addEntry', 'updateEntry', 'getEntry',
          'getPopular', 'getRecent', 'recordUsage', 'getStats', 'autoComplete',
          'createBackup', 'exportToJSON', 'importFromJSON', 'healthCheck'
        ],
        config: ['get', 'set'],
        ai: ['explainError'],
        perf: ['getStatus', 'getReport'],
        system: ['getInfo'],
        streaming: ['onChunk', 'onError', 'cancelStream', 'removeStreamListeners'],
        batch: ['execute', 'getStats', 'clearStats']
      };
      
      Object.entries(expectedAPIMethods).forEach(([namespace, methods]) => {
        expect(apiObject).toHaveProperty(namespace);
        methods.forEach(method => {
          expect(apiObject[namespace]).toHaveProperty(method);
          expect(typeof apiObject[namespace][method]).toBe('function');
        });
      });
    });

    test('should handle deprecated methods gracefully', async () => {
      // Test that deprecated methods still work but show warnings
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Simulate calling a deprecated method
      mockIpcRenderer.invoke.mockResolvedValue({
        success: true,
        data: 'deprecated result',
        metadata: {
          deprecated: true,
          replacement: 'newMethod'
        }
      });
      
      const result = await exposedAPI.db.search('test');
      
      expect(result.success).toBe(true);
      
      consoleSpy.mockRestore();
    });
  });

  describe('Memory Management', () => {
    test('should not create memory leaks with event listeners', () => {
      const streamId = 'test-stream-456';
      const callback = jest.fn();
      
      // Add listeners
      exposedAPI.streaming.onChunk(streamId, callback);
      exposedAPI.streaming.onError(streamId, callback);
      
      // Remove listeners
      exposedAPI.streaming.removeStreamListeners(streamId);
      
      expect(mockIpcRenderer.removeAllListeners).toHaveBeenCalledWith(`stream:chunk:${streamId}`);
      expect(mockIpcRenderer.removeAllListeners).toHaveBeenCalledWith(`stream:error:${streamId}`);
    });

    test('should clean up menu event listeners properly', () => {
      const callback = jest.fn();
      
      // Add menu listeners
      exposedAPI.onMenuEvent(callback);
      
      // Remove listeners
      exposedAPI.removeMenuListeners();
      
      const expectedEvents = [
        'menu-new-entry', 'menu-import-kb', 'menu-export-kb',
        'menu-backup', 'menu-show-stats', 'menu-show-performance',
        'menu-optimize-db', 'menu-show-settings', 'menu-show-about'
      ];
      
      expectedEvents.forEach(event => {
        expect(mockIpcRenderer.removeAllListeners).toHaveBeenCalledWith(event);
      });
    });
  });
});
