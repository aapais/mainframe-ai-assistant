/**
 * Test suite for Enhanced IPC System
 */

import { IPCManager } from '../IPCManager';
import { RequestBatcher } from '../RequestBatcher';
import { StreamingHandler } from '../StreamingHandler';
import { MultiLayerCacheManager } from '../../../caching/MultiLayerCacheManager';
import { EventEmitter } from 'events';

// Mock Electron IPC
const mockIpcMain = {
  handle: jest.fn(),
  removeHandler: jest.fn(),
};

const mockEvent = {
  sender: new EventEmitter(),
} as any;

// Mock cache manager
const mockCacheManager = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn(),
  close: jest.fn(),
} as any;

jest.mock('electron', () => ({
  ipcMain: mockIpcMain,
}));

describe('Enhanced IPC System', () => {
  describe('IPCManager', () => {
    let ipcManager: IPCManager;

    beforeEach(() => {
      jest.clearAllMocks();
      ipcManager = new IPCManager(mockCacheManager);
    });

    afterEach(() => {
      ipcManager.destroy();
    });

    test('should register handler with configuration', () => {
      const handler = jest.fn().mockResolvedValue('test result');

      ipcManager.registerHandler('test:handler', handler, {
        cacheable: true,
        cacheTTL: 60000,
        batchable: true,
        batchSize: 10,
      });

      expect(mockIpcMain.handle).toHaveBeenCalledWith('test:handler', expect.any(Function));
    });

    test('should handle validation errors', async () => {
      const handler = jest.fn();

      ipcManager.registerHandler('test:validated', handler, {
        validation: args => (args[0] ? true : 'Argument required'),
      });

      // Get the wrapped handler
      const wrappedHandler = mockIpcMain.handle.mock.calls[0][1];

      // Call with invalid args
      const response = await wrappedHandler(mockEvent);

      expect(response.success).toBe(false);
      expect(response.error.code).toBe('IPC_VALIDATION_FAILED');
      expect(handler).not.toHaveBeenCalled();
    });

    test('should cache responses when enabled', async () => {
      const handler = jest.fn().mockResolvedValue('cached result');
      mockCacheManager.get.mockResolvedValue(null);

      ipcManager.registerHandler('test:cached', handler, {
        cacheable: true,
        cacheTTL: 60000,
      });

      const wrappedHandler = mockIpcMain.handle.mock.calls[0][1];
      const response = await wrappedHandler(mockEvent, 'arg1');

      expect(response.success).toBe(true);
      expect(response.data).toBe('cached result');
      expect(mockCacheManager.set).toHaveBeenCalled();
    });

    test('should return cached responses', async () => {
      const handler = jest.fn();
      mockCacheManager.get.mockResolvedValue('cached data');

      ipcManager.registerHandler('test:cached', handler, {
        cacheable: true,
      });

      const wrappedHandler = mockIpcMain.handle.mock.calls[0][1];
      const response = await wrappedHandler(mockEvent, 'arg1');

      expect(response.success).toBe(true);
      expect(response.data).toBe('cached data');
      expect(response.metadata.cached).toBe(true);
      expect(handler).not.toHaveBeenCalled();
    });

    test('should enforce rate limits', async () => {
      const handler = jest.fn().mockResolvedValue('result');

      ipcManager.registerHandler('test:ratelimited', handler, {
        rateLimit: { requests: 1, window: 1000 },
      });

      const wrappedHandler = mockIpcMain.handle.mock.calls[0][1];

      // First request should succeed
      const response1 = await wrappedHandler(mockEvent);
      expect(response1.success).toBe(true);

      // Second request should be rate limited
      const response2 = await wrappedHandler(mockEvent);
      expect(response2.success).toBe(false);
      expect(response2.error.code).toBe('IPC_RATE_LIMIT_EXCEEDED');
    });

    test('should collect metrics', async () => {
      const handler = jest.fn().mockResolvedValue('result');

      ipcManager.registerHandler('test:metrics', handler);

      const wrappedHandler = mockIpcMain.handle.mock.calls[0][1];
      await wrappedHandler(mockEvent);

      const metrics = ipcManager.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.totalResponses).toBe(1);
      expect(metrics.totalErrors).toBe(0);
    });
  });

  describe('RequestBatcher', () => {
    let requestBatcher: RequestBatcher;
    let mockIpcManager: any;

    beforeEach(() => {
      mockIpcManager = new EventEmitter();
      requestBatcher = new RequestBatcher(mockIpcManager);
    });

    afterEach(() => {
      requestBatcher.destroy();
    });

    test('should batch similar requests', async () => {
      const handler = jest.fn().mockResolvedValueOnce('result1').mockResolvedValueOnce('result2');

      // Add multiple requests quickly
      const promises = [
        requestBatcher.addRequest(
          {
            id: 'req1',
            channel: 'db:search',
            data: ['query1'],
            timestamp: Date.now(),
          },
          handler,
          mockEvent
        ),
        requestBatcher.addRequest(
          {
            id: 'req2',
            channel: 'db:search',
            data: ['query1'], // Same query
            timestamp: Date.now(),
          },
          handler,
          mockEvent
        ),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(2);
      // Both should get the same result since they have the same query
      expect(handler).toHaveBeenCalledTimes(1);
    });

    test('should process batch when size limit reached', async () => {
      const handler = jest.fn().mockResolvedValue('result');

      // Configure small batch size for testing
      requestBatcher = new RequestBatcher(mockIpcManager, { maxBatchSize: 2 });

      // Add requests to reach batch size
      const promises = Array.from({ length: 3 }, (_, i) =>
        requestBatcher.addRequest(
          {
            id: `req${i}`,
            channel: 'db:getEntry',
            data: [`id${i}`],
            timestamp: Date.now(),
          },
          handler,
          mockEvent
        )
      );

      await Promise.all(promises);

      const metrics = requestBatcher.getMetrics();
      expect(metrics.totalBatches).toBeGreaterThan(0);
    });
  });

  describe('StreamingHandler', () => {
    let streamingHandler: StreamingHandler;

    beforeEach(() => {
      streamingHandler = new StreamingHandler({ chunkSize: 3 });
    });

    afterEach(() => {
      streamingHandler.destroy();
    });

    test('should handle array data streaming', async () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const handler = jest.fn().mockResolvedValue(data);

      const chunks: any[] = [];
      mockEvent.sender.send = jest.fn((channel, chunk) => {
        chunks.push(chunk);
      });

      const streamId = await streamingHandler.handleStream(handler, mockEvent, ['test-query']);

      // Wait for streaming to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(typeof streamId).toBe('string');
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[chunks.length - 1].isLast).toBe(true);
    });

    test('should handle async generator streaming', async () => {
      async function* generateData() {
        for (let i = 0; i < 10; i++) {
          yield { id: i, data: `item${i}` };
        }
      }

      const handler = jest.fn().mockResolvedValue(generateData());

      const chunks: any[] = [];
      mockEvent.sender.send = jest.fn((channel, chunk) => {
        chunks.push(chunk);
      });

      const streamId = await streamingHandler.handleStream(handler, mockEvent, ['test-query']);

      // Wait for streaming to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.some(chunk => chunk.isLast)).toBe(true);
    });

    test('should track streaming metrics', async () => {
      const data = [1, 2, 3];
      const handler = jest.fn().mockResolvedValue(data);

      mockEvent.sender.send = jest.fn();

      await streamingHandler.handleStream(handler, mockEvent, ['test']);

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 100));

      const metrics = streamingHandler.getMetrics();
      expect(metrics.totalStreams).toBe(1);
      expect(metrics.totalChunks).toBeGreaterThan(0);
    });
  });

  describe('Integration', () => {
    let ipcManager: IPCManager;

    beforeEach(() => {
      ipcManager = new IPCManager(mockCacheManager);
    });

    afterEach(() => {
      ipcManager.destroy();
    });

    test('should handle complex operation with all features', async () => {
      // Register handler with all features enabled
      const handler = jest.fn().mockImplementation(async (event, query) => {
        // Simulate database query
        return Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          title: `Entry ${i}`,
          query,
        }));
      });

      ipcManager.registerHandler('test:complex', handler, {
        batchable: true,
        batchSize: 5,
        streamable: true,
        streamChunkSize: 100,
        cacheable: true,
        cacheTTL: 60000,
        validation: args => (args[0] ? true : 'Query required'),
        rateLimit: { requests: 10, window: 60000 },
      });

      // Verify handler registration
      expect(mockIpcMain.handle).toHaveBeenCalledWith('test:complex', expect.any(Function));

      const handlerInfo = ipcManager.getHandlersInfo();
      expect(handlerInfo).toHaveLength(1);
      expect(handlerInfo[0].channel).toBe('test:complex');
      expect(handlerInfo[0].config.batchable).toBe(true);
      expect(handlerInfo[0].config.streamable).toBe(true);
      expect(handlerInfo[0].config.cacheable).toBe(true);
    });

    test('should provide comprehensive metrics', async () => {
      const handler = jest.fn().mockResolvedValue('result');

      ipcManager.registerHandler('test:metrics', handler, {
        batchable: true,
        cacheable: true,
      });

      // Simulate some requests
      const wrappedHandler = mockIpcMain.handle.mock.calls[0][1];
      await wrappedHandler(mockEvent, 'test');
      await wrappedHandler(mockEvent, 'test2');

      const metrics = ipcManager.getMetrics();
      expect(metrics).toMatchObject({
        totalRequests: expect.any(Number),
        totalResponses: expect.any(Number),
        totalErrors: expect.any(Number),
        averageResponseTime: expect.any(Number),
        cacheHitRate: expect.any(Number),
        batchedRequests: expect.any(Number),
        streamedRequests: expect.any(Number),
      });
    });
  });
});
