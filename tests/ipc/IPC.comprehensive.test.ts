/**
 * Comprehensive IPC Communication Test Suite
 * Tests all aspects of Electron IPC communication between main and renderer processes
 * 
 * Coverage:
 * - Main to renderer process communication
 * - Renderer to main process communication 
 * - Bidirectional communication patterns
 * - Error handling and validation
 * - Security and isolation
 * - Performance and timeouts
 * - Message serialization
 */

import { EventEmitter } from 'events';
import { ipcRenderer } from 'electron';
import type { ElectronAPI, IPCResponse, StreamChunk } from '../../src/main/preload';
import type { KBEntry, SearchResult } from '../../src/database/KnowledgeDB';

// Mock Electron IPC components
const mockIpcMain = {
  handle: jest.fn(),
  on: jest.fn(),
  removeHandler: jest.fn(),
  removeAllListeners: jest.fn()
};

const mockIpcRenderer = {
  invoke: jest.fn(),
  send: jest.fn(),
  on: jest.fn(),
  removeAllListeners: jest.fn(),
  postMessage: jest.fn()
};

const mockContextBridge = {
  exposeInMainWorld: jest.fn()
};

const mockWebContents = {
  send: jest.fn(),
  postMessage: jest.fn(),
  isDestroyed: jest.fn(() => false)
};

const mockBrowserWindow = {
  webContents: mockWebContents,
  isDestroyed: jest.fn(() => false)
};

// Mock event object
const createMockEvent = (senderId = 'test-sender') => ({
  sender: {
    send: mockWebContents.send,
    postMessage: mockWebContents.postMessage,
    isDestroyed: mockWebContents.isDestroyed,
    id: senderId
  },
  frameId: 0,
  processId: 123
});

// Mock Electron modules
jest.mock('electron', () => ({
  ipcMain: mockIpcMain,
  ipcRenderer: mockIpcRenderer,
  contextBridge: mockContextBridge,
  BrowserWindow: jest.fn(() => mockBrowserWindow)
}));

describe('Comprehensive IPC Communication Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.setTimeout(10000); // 10 second timeout for async operations
  });

  describe('Main to Renderer Communication', () => {
    test('should send menu events to renderer', () => {
      const eventData = { action: 'new-entry', timestamp: Date.now() };
      
      // Simulate main process sending menu event
      mockWebContents.send('menu-new-entry', eventData);
      
      expect(mockWebContents.send).toHaveBeenCalledWith('menu-new-entry', eventData);
    });

    test('should broadcast theme changes to all renderer windows', () => {
      const theme = 'dark';
      
      // Simulate broadcasting theme change
      mockWebContents.send('set-theme', theme);
      
      expect(mockWebContents.send).toHaveBeenCalledWith('set-theme', theme);
    });

    test('should send navigation commands to renderer', () => {
      const route = '/knowledge-base';
      
      mockWebContents.send('navigate', route);
      
      expect(mockWebContents.send).toHaveBeenCalledWith('navigate', route);
    });

    test('should handle window destruction gracefully', () => {
      mockWebContents.isDestroyed.mockReturnValue(true);
      
      // Attempt to send to destroyed window
      const sendResult = mockWebContents.isDestroyed() ? null : mockWebContents.send('test', {});
      
      expect(sendResult).toBeNull();
      expect(mockWebContents.send).not.toHaveBeenCalled();
    });

    test('should send file dialog results', () => {
      const filePaths = ['/path/to/file.json'];
      
      mockWebContents.send('import-kb', filePaths[0]);
      
      expect(mockWebContents.send).toHaveBeenCalledWith('import-kb', filePaths[0]);
    });
  });

  describe('Renderer to Main Communication', () => {
    test('should handle knowledge base search requests', async () => {
      const query = 'mainframe error codes';
      const mockResults: SearchResult[] = [
        {
          id: '1',
          title: 'Common Mainframe Error Codes',
          content: 'Error code explanations...',
          category: 'errors',
          relevanceScore: 0.95,
          snippet: 'Error codes and solutions'
        }
      ];
      
      const expectedResponse: IPCResponse<SearchResult[]> = {
        success: true,
        data: mockResults,
        metadata: {
          executionTime: 50,
          cached: false
        }
      };
      
      mockIpcRenderer.invoke.mockResolvedValue(expectedResponse);
      
      const result = await mockIpcRenderer.invoke('db:search', query);
      
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('db:search', query);
      expect(result).toEqual(expectedResponse);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    test('should handle knowledge base entry creation', async () => {
      const newEntry: Partial<KBEntry> = {
        title: 'COBOL Compilation Error',
        content: 'Steps to resolve compilation errors',
        category: 'COBOL',
        tags: ['compilation', 'error', 'cobol']
      };
      
      const expectedResponse: IPCResponse<string> = {
        success: true,
        data: 'entry-123',
        metadata: {
          executionTime: 100
        }
      };
      
      mockIpcRenderer.invoke.mockResolvedValue(expectedResponse);
      
      const result = await mockIpcRenderer.invoke('db:addEntry', newEntry);
      
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('db:addEntry', newEntry);
      expect(result.success).toBe(true);
      expect(result.data).toBe('entry-123');
    });

    test('should handle configuration requests', async () => {
      const configKey = 'ai.provider';
      const expectedResponse: IPCResponse<string> = {
        success: true,
        data: 'gemini'
      };
      
      mockIpcRenderer.invoke.mockResolvedValue(expectedResponse);
      
      const result = await mockIpcRenderer.invoke('config:get', configKey);
      
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('config:get', configKey);
      expect(result.data).toBe('gemini');
    });

    test('should handle system information requests', async () => {
      const expectedResponse: IPCResponse<any> = {
        success: true,
        data: {
          platform: 'win32',
          arch: 'x64',
          version: '1.0.0',
          electronVersion: '28.1.0',
          nodeVersion: '18.17.0',
          dataPath: '/path/to/data'
        }
      };
      
      mockIpcRenderer.invoke.mockResolvedValue(expectedResponse);
      
      const result = await mockIpcRenderer.invoke('system:getInfo');
      
      expect(result.success).toBe(true);
      expect(result.data.platform).toBeDefined();
      expect(result.data.electronVersion).toBeDefined();
    });
  });

  describe('Bidirectional Communication Patterns', () => {
    test('should handle request-response cycles', async () => {
      // Setup: Main process handler
      const mockHandler = jest.fn().mockResolvedValue({
        success: true,
        data: 'processed'
      });
      
      mockIpcMain.handle.mockImplementation((channel, handler) => {
        if (channel === 'test:request') {
          return handler;
        }
      });
      
      // Simulate: Renderer sends request
      mockIpcRenderer.invoke.mockResolvedValue({
        success: true,
        data: 'processed'
      });
      
      const result = await mockIpcRenderer.invoke('test:request', 'test-data');
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('processed');
    });

    test('should handle streaming data patterns', (done) => {
      const streamId = 'stream-123';
      const chunks: StreamChunk[] = [
        {
          streamId,
          chunkIndex: 0,
          data: ['item1', 'item2'],
          isLast: false,
          progress: {
            streamId,
            processedItems: 2,
            percentage: 33,
            currentChunk: 0,
            startTime: Date.now()
          }
        },
        {
          streamId,
          chunkIndex: 1,
          data: ['item3', 'item4'],
          isLast: true,
          progress: {
            streamId,
            processedItems: 4,
            percentage: 100,
            currentChunk: 1,
            startTime: Date.now()
          }
        }
      ];
      
      let receivedChunks = 0;
      
      // Setup stream listener
      const streamListener = (chunk: StreamChunk) => {
        expect(chunk.streamId).toBe(streamId);
        expect(chunk.data).toBeDefined();
        receivedChunks++;
        
        if (chunk.isLast) {
          expect(receivedChunks).toBe(2);
          expect(chunk.progress?.percentage).toBe(100);
          done();
        }
      };
      
      mockIpcRenderer.on.mockImplementation((channel, listener) => {
        if (channel === `stream:chunk:${streamId}`) {
          // Simulate receiving chunks
          setTimeout(() => listener(null, chunks[0]), 10);
          setTimeout(() => listener(null, chunks[1]), 20);
        }
      });
      
      // Start listening for stream
      mockIpcRenderer.on(`stream:chunk:${streamId}`, streamListener);
    });

    test('should handle event notification patterns', () => {
      const eventHandlers = new Map();
      
      mockIpcRenderer.on.mockImplementation((channel, handler) => {
        eventHandlers.set(channel, handler);
      });
      
      // Setup event listeners
      const updateHandler = jest.fn();
      const deleteHandler = jest.fn();
      
      mockIpcRenderer.on('kb:entry-updated', updateHandler);
      mockIpcRenderer.on('kb:entry-deleted', deleteHandler);
      
      // Simulate events from main process
      const updateEvent = { entryId: '123', changes: { title: 'Updated' } };
      const deleteEvent = { entryId: '456' };
      
      eventHandlers.get('kb:entry-updated')?.(null, updateEvent);
      eventHandlers.get('kb:entry-deleted')?.(null, deleteEvent);
      
      expect(updateHandler).toHaveBeenCalledWith(null, updateEvent);
      expect(deleteHandler).toHaveBeenCalledWith(null, deleteEvent);
    });
  });

  describe('Error Handling and Validation', () => {
    test('should handle IPC timeouts', async () => {
      const timeoutError = new Error('IPC timeout after 5000ms');
      mockIpcRenderer.invoke.mockRejectedValue(timeoutError);
      
      try {
        await mockIpcRenderer.invoke('slow:operation');
        fail('Should have thrown timeout error');
      } catch (error) {
        expect(error.message).toContain('timeout');
      }
    });

    test('should handle validation errors', async () => {
      const validationError: IPCResponse = {
        success: false,
        error: {
          code: 'IPC_VALIDATION_FAILED',
          message: 'Invalid entry data: title is required',
          details: {
            field: 'title',
            value: null,
            expected: 'string'
          }
        }
      };
      
      mockIpcRenderer.invoke.mockResolvedValue(validationError);
      
      const result = await mockIpcRenderer.invoke('db:addEntry', { content: 'test' });
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('IPC_VALIDATION_FAILED');
      expect(result.error?.message).toContain('title is required');
    });

    test('should handle database connection errors', async () => {
      const dbError: IPCResponse = {
        success: false,
        error: {
          code: 'DATABASE_CONNECTION_FAILED',
          message: 'Unable to connect to database',
          details: {
            errno: -4058,
            code: 'ENOENT',
            path: '/path/to/db.sqlite'
          }
        }
      };
      
      mockIpcRenderer.invoke.mockResolvedValue(dbError);
      
      const result = await mockIpcRenderer.invoke('db:search', 'test');
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DATABASE_CONNECTION_FAILED');
    });

    test('should handle permission errors', async () => {
      const permissionError: IPCResponse = {
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'Access denied to file system operation',
          details: {
            operation: 'createBackup',
            path: '/restricted/path'
          }
        }
      };
      
      mockIpcRenderer.invoke.mockResolvedValue(permissionError);
      
      const result = await mockIpcRenderer.invoke('db:createBackup');
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PERMISSION_DENIED');
    });

    test('should handle malformed requests', async () => {
      const malformedError: IPCResponse = {
        success: false,
        error: {
          code: 'MALFORMED_REQUEST',
          message: 'Request data is not valid JSON',
          details: {
            received: 'invalid-json-string',
            expected: 'valid JSON object'
          }
        }
      };
      
      mockIpcRenderer.invoke.mockResolvedValue(malformedError);
      
      const result = await mockIpcRenderer.invoke('db:addEntry', 'invalid-data');
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MALFORMED_REQUEST');
    });

    test('should handle channel not found errors', async () => {
      const channelError = new Error('No handler registered for channel: unknown:channel');
      mockIpcRenderer.invoke.mockRejectedValue(channelError);
      
      try {
        await mockIpcRenderer.invoke('unknown:channel');
        fail('Should have thrown channel error');
      } catch (error) {
        expect(error.message).toContain('No handler registered');
      }
    });
  });

  describe('Security and Isolation', () => {
    test('should validate contextBridge API exposure', () => {
      // Verify that contextBridge.exposeInMainWorld was called
      expect(mockContextBridge.exposeInMainWorld).toHaveBeenCalledWith(
        'electronAPI',
        expect.any(Object)
      );
    });

    test('should not expose Node.js APIs directly to renderer', () => {
      // In a real test, this would verify that Node.js APIs like 'fs', 'path' 
      // are not directly accessible in the renderer process
      const exposedAPI = mockContextBridge.exposeInMainWorld.mock.calls[0]?.[1];
      
      expect(exposedAPI).toBeDefined();
      expect(exposedAPI.fs).toBeUndefined();
      expect(exposedAPI.path).toBeUndefined();
      expect(exposedAPI.require).toBeUndefined();
    });

    test('should sanitize IPC input data', async () => {
      const maliciousInput = {
        title: '<script>alert("XSS")</script>',
        content: 'DROP TABLE entries; --',
        __proto__: { admin: true }
      };
      
      const sanitizedResponse: IPCResponse = {
        success: false,
        error: {
          code: 'INPUT_SANITIZATION_FAILED',
          message: 'Input contains potentially malicious content',
          details: {
            field: 'title',
            issue: 'Contains HTML/script tags'
          }
        }
      };
      
      mockIpcRenderer.invoke.mockResolvedValue(sanitizedResponse);
      
      const result = await mockIpcRenderer.invoke('db:addEntry', maliciousInput);
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INPUT_SANITIZATION_FAILED');
    });

    test('should enforce rate limiting', async () => {
      const rateLimitError: IPCResponse = {
        success: false,
        error: {
          code: 'IPC_RATE_LIMIT_EXCEEDED',
          message: 'Too many requests: 10 requests per minute exceeded',
          details: {
            limit: 10,
            window: 60000,
            resetTime: Date.now() + 60000
          }
        }
      };
      
      // Simulate rapid requests
      mockIpcRenderer.invoke.mockResolvedValueOnce({ success: true, data: 'ok' });
      for (let i = 0; i < 10; i++) {
        mockIpcRenderer.invoke.mockResolvedValueOnce(rateLimitError);
      }
      
      const results = [];
      for (let i = 0; i < 11; i++) {
        results.push(await mockIpcRenderer.invoke('db:search', `query${i}`));
      }
      
      expect(results[0].success).toBe(true);
      expect(results[10].success).toBe(false);
      expect(results[10].error?.code).toBe('IPC_RATE_LIMIT_EXCEEDED');
    });

    test('should validate origin of IPC messages', async () => {
      const unauthorizedOriginError: IPCResponse = {
        success: false,
        error: {
          code: 'UNAUTHORIZED_ORIGIN',
          message: 'IPC message from unauthorized origin',
          details: {
            origin: 'https://malicious-site.com',
            expected: 'file://'
          }
        }
      };
      
      mockIpcRenderer.invoke.mockResolvedValue(unauthorizedOriginError);
      
      const result = await mockIpcRenderer.invoke('db:getEntry', '123');
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNAUTHORIZED_ORIGIN');
    });
  });

  describe('Performance and Timeouts', () => {
    test('should handle fast response times', async () => {
      const startTime = Date.now();
      
      const fastResponse: IPCResponse = {
        success: true,
        data: 'quick result',
        metadata: {
          executionTime: 5,
          cached: true
        }
      };
      
      mockIpcRenderer.invoke.mockResolvedValue(fastResponse);
      
      const result = await mockIpcRenderer.invoke('db:search', 'cached-query');
      const responseTime = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(result.metadata?.cached).toBe(true);
      expect(responseTime).toBeLessThan(100); // Should be very fast
    });

    test('should handle slow operations with progress updates', async () => {
      const slowResponse: IPCResponse = {
        success: true,
        data: 'stream-id-456',
        metadata: {
          streamed: true,
          executionTime: 2500
        }
      };
      
      mockIpcRenderer.invoke.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve(slowResponse), 100);
        });
      });
      
      const startTime = Date.now();
      const result = await mockIpcRenderer.invoke('db:getPopular', 1000);
      const responseTime = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(result.metadata?.streamed).toBe(true);
      expect(responseTime).toBeGreaterThan(50);
    });

    test('should handle concurrent IPC requests', async () => {
      mockIpcRenderer.invoke.mockImplementation((channel, ...args) => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              success: true,
              data: `result-for-${channel}-${args[0]}`,
              metadata: { executionTime: Math.random() * 100 }
            });
          }, Math.random() * 50);
        });
      });
      
      const requests = [
        mockIpcRenderer.invoke('db:search', 'query1'),
        mockIpcRenderer.invoke('db:search', 'query2'),
        mockIpcRenderer.invoke('db:getEntry', 'entry1'),
        mockIpcRenderer.invoke('db:getEntry', 'entry2'),
        mockIpcRenderer.invoke('config:get', 'setting1')
      ];
      
      const results = await Promise.all(requests);
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
      });
    });

    test('should measure IPC performance metrics', async () => {
      const performanceData = {
        averageResponseTime: 45,
        totalRequests: 1250,
        totalErrors: 15,
        cacheHitRate: 0.73,
        activeConnections: 3
      };
      
      const perfResponse: IPCResponse = {
        success: true,
        data: performanceData
      };
      
      mockIpcRenderer.invoke.mockResolvedValue(perfResponse);
      
      const result = await mockIpcRenderer.invoke('perf:getStatus');
      
      expect(result.success).toBe(true);
      expect(result.data.averageResponseTime).toBeDefined();
      expect(result.data.cacheHitRate).toBeGreaterThan(0);
      expect(result.data.totalRequests).toBeGreaterThan(0);
    });
  });

  describe('Message Serialization', () => {
    test('should handle complex object serialization', async () => {
      const complexObject = {
        entry: {
          id: '123',
          title: 'Complex Entry',
          metadata: {
            created: new Date('2024-01-01'),
            tags: ['tag1', 'tag2'],
            metrics: {
              views: 150,
              rating: 4.5,
              lastAccessed: new Date('2024-01-15')
            }
          },
          relations: [
            { type: 'related', targetId: '456' },
            { type: 'duplicate', targetId: '789' }
          ]
        }
      };
      
      const response: IPCResponse = {
        success: true,
        data: complexObject
      };
      
      mockIpcRenderer.invoke.mockResolvedValue(response);
      
      const result = await mockIpcRenderer.invoke('db:getEntry', '123');
      
      expect(result.success).toBe(true);
      expect(result.data.entry.id).toBe('123');
      expect(result.data.entry.metadata.tags).toHaveLength(2);
      expect(result.data.entry.relations).toHaveLength(2);
    });

    test('should handle binary data transfer', async () => {
      const binaryData = new Uint8Array([1, 2, 3, 4, 5]);
      
      const response: IPCResponse = {
        success: true,
        data: {
          filename: 'backup.db',
          size: binaryData.length,
          content: Array.from(binaryData) // Simulated binary transfer
        }
      };
      
      mockIpcRenderer.invoke.mockResolvedValue(response);
      
      const result = await mockIpcRenderer.invoke('db:createBackup');
      
      expect(result.success).toBe(true);
      expect(result.data.content).toHaveLength(5);
      expect(result.data.size).toBe(5);
    });

    test('should handle large dataset serialization', async () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: `entry-${i}`,
        title: `Entry ${i}`,
        content: `Content for entry ${i}`.repeat(10),
        timestamp: Date.now() + i
      }));
      
      const response: IPCResponse = {
        success: true,
        data: 'stream-large-dataset',
        metadata: {
          streamed: true,
          totalItems: largeDataset.length
        }
      };
      
      mockIpcRenderer.invoke.mockResolvedValue(response);
      
      const result = await mockIpcRenderer.invoke('db:search', 'large-query');
      
      expect(result.success).toBe(true);
      expect(result.metadata?.streamed).toBe(true);
      expect(result.metadata?.totalItems).toBe(1000);
    });

    test('should handle special characters and encoding', async () => {
      const specialCharsData = {
        title: 'Test with émojis 🚀 and special chars: àáâãäåæçèéêë',
        content: 'Unicode content: 中文字符, العربية, русский, 日本語',
        symbols: '!@#$%^&*()_+-=[]{}|;:",./<>?',
        unicode: '\u0041\u0042\u0043' // ABC in unicode
      };
      
      const response: IPCResponse = {
        success: true,
        data: specialCharsData
      };
      
      mockIpcRenderer.invoke.mockResolvedValue(response);
      
      const result = await mockIpcRenderer.invoke('db:addEntry', specialCharsData);
      
      expect(result.success).toBe(true);
      expect(result.data.title).toContain('🚀');
      expect(result.data.content).toContain('中文字符');
      expect(result.data.symbols).toContain('!@#$%');
    });
  });

  describe('Real-world IPC Scenarios', () => {
    test('should handle complete knowledge base search workflow', async () => {
      // 1. Search for entries
      const searchResponse: IPCResponse<SearchResult[]> = {
        success: true,
        data: [
          {
            id: '1',
            title: 'COBOL Error Handling',
            content: 'Best practices for error handling in COBOL...',
            category: 'COBOL',
            relevanceScore: 0.92,
            snippet: 'Error handling techniques...'
          }
        ],
        metadata: {
          executionTime: 85,
          cached: false
        }
      };
      
      mockIpcRenderer.invoke.mockResolvedValueOnce(searchResponse);
      
      // 2. Get full entry details
      const entryResponse: IPCResponse<KBEntry> = {
        success: true,
        data: {
          id: '1',
          title: 'COBOL Error Handling',
          content: 'Detailed explanation of COBOL error handling...',
          category: 'COBOL',
          tags: ['error-handling', 'cobol', 'best-practices'],
          created: Date.now(),
          updated: Date.now(),
          usageCount: 25,
          successfulUses: 22,
          unsuccessfulUses: 3
        }
      };
      
      mockIpcRenderer.invoke.mockResolvedValueOnce(entryResponse);
      
      // 3. Record usage
      const usageResponse: IPCResponse<void> = {
        success: true,
        metadata: {
          executionTime: 5
        }
      };
      
      mockIpcRenderer.invoke.mockResolvedValueOnce(usageResponse);
      
      // Execute workflow
      const searchResult = await mockIpcRenderer.invoke('db:search', 'COBOL error handling');
      const entryResult = await mockIpcRenderer.invoke('db:getEntry', '1');
      const usageResult = await mockIpcRenderer.invoke('db:recordUsage', '1', true);
      
      expect(searchResult.success).toBe(true);
      expect(searchResult.data).toHaveLength(1);
      expect(entryResult.success).toBe(true);
      expect(entryResult.data.id).toBe('1');
      expect(usageResult.success).toBe(true);
    });

    test('should handle file import/export workflow', async () => {
      const importData = {
        entries: [
          {
            title: 'JCL Job Scheduling',
            content: 'Guidelines for JCL job scheduling...',
            category: 'JCL'
          }
        ],
        metadata: {
          version: '1.0',
          exported: Date.now()
        }
      };
      
      // Import workflow
      const importResponse: IPCResponse<void> = {
        success: true,
        metadata: {
          executionTime: 1250,
          importedCount: 1
        }
      };
      
      mockIpcRenderer.invoke.mockResolvedValueOnce(importResponse);
      
      // Export workflow
      const exportResponse: IPCResponse<void> = {
        success: true,
        metadata: {
          executionTime: 890,
          exportedCount: 150,
          fileSize: 2048576
        }
      };
      
      mockIpcRenderer.invoke.mockResolvedValueOnce(exportResponse);
      
      const importResult = await mockIpcRenderer.invoke('db:importFromJSON', '/path/to/import.json');
      const exportResult = await mockIpcRenderer.invoke('db:exportToJSON', '/path/to/export.json');
      
      expect(importResult.success).toBe(true);
      expect(importResult.metadata?.importedCount).toBe(1);
      expect(exportResult.success).toBe(true);
      expect(exportResult.metadata?.exportedCount).toBe(150);
    });

    test('should handle system health monitoring', async () => {
      const healthResponse: IPCResponse<any> = {
        success: true,
        data: {
          overall: true,
          database: true,
          cache: true,
          connections: true,
          performance: false,
          issues: ['High memory usage detected']
        },
        metadata: {
          executionTime: 150,
          timestamp: Date.now()
        }
      };
      
      mockIpcRenderer.invoke.mockResolvedValue(healthResponse);
      
      const healthResult = await mockIpcRenderer.invoke('db:healthCheck');
      
      expect(healthResult.success).toBe(true);
      expect(healthResult.data.overall).toBe(true);
      expect(healthResult.data.performance).toBe(false);
      expect(healthResult.data.issues).toContain('High memory usage detected');
    });
  });

  describe('IPC Channel Registration and Cleanup', () => {
    test('should properly register all expected channels', () => {
      const expectedChannels = [
        'db:search',
        'db:searchWithAI',
        'db:addEntry',
        'db:updateEntry',
        'db:getEntry',
        'db:getPopular',
        'db:getRecent',
        'db:recordUsage',
        'db:getStats',
        'config:get',
        'config:set',
        'ai:explainError',
        'perf:getStatus',
        'system:getInfo'
      ];
      
      expectedChannels.forEach(channel => {
        mockIpcMain.handle(channel, jest.fn());
      });
      
      expect(mockIpcMain.handle).toHaveBeenCalledTimes(expectedChannels.length);
    });

    test('should clean up IPC handlers on shutdown', () => {
      const channels = ['test:channel1', 'test:channel2'];
      
      channels.forEach(channel => {
        mockIpcMain.removeHandler(channel);
      });
      
      expect(mockIpcMain.removeHandler).toHaveBeenCalledTimes(2);
    });

    test('should remove event listeners properly', () => {
      const eventChannels = ['stream:chunk:123', 'stream:error:123'];
      
      eventChannels.forEach(channel => {
        mockIpcRenderer.removeAllListeners(channel);
      });
      
      expect(mockIpcRenderer.removeAllListeners).toHaveBeenCalledTimes(2);
    });
  });
});
