/**
 * End-to-End IPC Tests
 * 
 * Complete end-to-end testing of IPC communication between main and renderer
 * processes, including real Electron environment simulation and user workflows.
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import { IPCMainProcess } from '../../src/main/ipc/IPCMainProcess';
import path from 'path';

import {
  validSearchRequest,
  validCreateRequest,
  validMetricsRequest,
  testScenarios,
  edgeCaseData
} from '../fixtures/ipc-test-data';

import {
  assertValidIPCResponse,
  createTestCleanup,
  delay,
  PerformanceTracker
} from '../helpers/ipc-test-utils';

import {
  IPCChannel,
  BaseIPCRequest,
  BaseIPCResponse
} from '../../src/types/ipc';

// Mock Electron environment for testing
jest.mock('electron', () => ({
  app: {
    isReady: jest.fn(() => true),
    whenReady: jest.fn(() => Promise.resolve()),
    quit: jest.fn(),
    on: jest.fn(),
    removeAllListeners: jest.fn()
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadFile: jest.fn(),
    on: jest.fn(),
    webContents: {
      send: jest.fn(),
      on: jest.fn()
    },
    isDestroyed: jest.fn(() => false),
    close: jest.fn(),
    show: jest.fn()
  })),
  ipcMain: {
    handle: jest.fn(),
    removeHandler: jest.fn(),
    removeAllListeners: jest.fn(),
    on: jest.fn(),
    emit: jest.fn()
  }
}));

describe('IPC End-to-End Tests', () => {
  let ipcMainProcess: IPCMainProcess;
  let mockWindow: any;
  let cleanup = createTestCleanup();

  beforeAll(async () => {
    // Initialize main process with E2E configuration
    ipcMainProcess = new IPCMainProcess({
      databasePath: ':memory:',
      enablePerformanceMonitoring: true,
      enableSecurityValidation: true,
      enableRequestLogging: true,
      geminiApiKey: process.env.GEMINI_API_KEY || 'test-key',
      maxConcurrentRequests: 100,
      requestTimeoutMs: 10000
    });

    await ipcMainProcess.initialize();

    // Create mock browser window
    mockWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../fixtures/preload-mock.js')
      }
    });

    cleanup.add(async () => {
      await ipcMainProcess.shutdown();
      if (mockWindow && !mockWindow.isDestroyed()) {
        mockWindow.close();
      }
    });
  });

  afterAll(async () => {
    await cleanup.cleanup();
  });

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('User Workflow Scenarios', () => {
    it('should handle complete knowledge management workflow', async () => {
      const tracker = new PerformanceTracker();
      const workflow = [];

      // Step 1: User opens application and searches for existing knowledge
      const searchId = tracker.start('initial-search');
      const initialSearch = await simulateUserAction('search', {
        ...validSearchRequest,
        query: 'VSAM error'
      });
      tracker.end(searchId);
      
      workflow.push({ step: 'initial-search', success: initialSearch.success });
      expect(initialSearch.success).toBe(true);

      // Step 2: User doesn't find what they need, creates new entry
      const createId = tracker.start('create-new-entry');
      const createEntry = await simulateUserAction('create', {
        ...validCreateRequest,
        entry: {
          title: 'New VSAM Error E2E Test',
          problem: 'Encountered a new VSAM error during E2E testing',
          solution: '1. Check configuration\n2. Verify access\n3. Restart service',
          category: 'VSAM',
          tags: ['e2e', 'vsam', 'error']
        }
      });
      tracker.end(createId);
      
      const newEntryId = createEntry.data.id;
      workflow.push({ step: 'create-entry', success: createEntry.success, entryId: newEntryId });
      expect(createEntry.success).toBe(true);

      // Step 3: User searches again to verify the new entry appears
      const verifyId = tracker.start('verify-creation');
      const verifySearch = await simulateUserAction('search', {
        ...validSearchRequest,
        query: 'New VSAM Error E2E Test'
      });
      tracker.end(verifyId);
      
      workflow.push({ step: 'verify-search', success: verifySearch.success });
      expect(verifySearch.success).toBe(true);
      expect(verifySearch.data.results.some((r: any) => r.id === newEntryId)).toBe(true);

      // Step 4: User views the specific entry
      const viewId = tracker.start('view-entry');
      const viewEntry = await simulateUserAction('get', {
        ...validSearchRequest,
        channel: IPCChannel.KB_GET,
        entryId: newEntryId
      });
      tracker.end(viewId);
      
      workflow.push({ step: 'view-entry', success: viewEntry.success });
      expect(viewEntry.success).toBe(true);

      // Step 5: User tries the solution and provides positive feedback
      const feedbackId = tracker.start('provide-feedback');
      const feedback = await simulateUserAction('feedback', {
        ...validSearchRequest,
        channel: IPCChannel.KB_FEEDBACK,
        entryId: newEntryId,
        successful: true,
        comment: 'Solution worked perfectly in E2E test!'
      });
      tracker.end(feedbackId);
      
      workflow.push({ step: 'feedback', success: feedback.success });
      expect(feedback.success).toBe(true);

      // Step 6: User checks application metrics
      const metricsId = tracker.start('check-metrics');
      const metrics = await simulateUserAction('metrics', validMetricsRequest);
      tracker.end(metricsId);
      
      workflow.push({ step: 'metrics', success: metrics.success });
      expect(metrics.success).toBe(true);

      // Verify complete workflow
      expect(workflow.every(step => step.success)).toBe(true);
      
      console.log('Complete Workflow Results:', {
        steps: workflow.length,
        allSuccessful: workflow.every(step => step.success),
        totalTime: tracker.getStats().total.toFixed(2) + 'ms',
        averageStepTime: tracker.getStats().avg.toFixed(2) + 'ms'
      });
    });

    it('should handle multi-user concurrent usage scenario', async () => {
      const users = ['user1', 'user2', 'user3', 'user4'];
      const userWorkflows = await Promise.all(
        users.map(async (userId, index) => {
          const userTracker = new PerformanceTracker();
          const userActions = [];

          // Each user performs a series of actions
          const actions = [
            // Search for different things
            {
              type: 'search',
              request: {
                ...validSearchRequest,
                userId,
                requestId: `${userId}-search-${index}`,
                query: `search query for ${userId}`
              }
            },
            // Create user-specific content
            {
              type: 'create',
              request: {
                ...validCreateRequest,
                userId,
                requestId: `${userId}-create-${index}`,
                entry: {
                  ...validCreateRequest.entry,
                  title: `Entry by ${userId}`,
                  problem: `Problem identified by ${userId}`,
                  solution: `Solution provided by ${userId}`
                }
              }
            },
            // Check metrics
            {
              type: 'metrics',
              request: {
                ...validMetricsRequest,
                userId,
                requestId: `${userId}-metrics-${index}`
              }
            }
          ];

          for (const action of actions) {
            const actionId = userTracker.start(`${userId}-${action.type}`);
            const result = await simulateUserAction(action.type, action.request);
            userTracker.end(actionId);
            
            userActions.push({
              user: userId,
              action: action.type,
              success: result.success,
              duration: userTracker.getResults().slice(-1)[0].duration
            });
          }

          return {
            userId,
            actions: userActions,
            stats: userTracker.getStats()
          };
        })
      );

      // Verify all user workflows succeeded
      userWorkflows.forEach(workflow => {
        expect(workflow.actions.every(action => action.success)).toBe(true);
      });

      // Verify reasonable performance for concurrent users
      const allActions = userWorkflows.flatMap(w => w.actions);
      const avgDuration = allActions.reduce((sum, a) => sum + a.duration, 0) / allActions.length;
      
      expect(avgDuration).toBeLessThan(1000); // < 1 second average

      console.log('Multi-User Workflow Results:', {
        users: userWorkflows.length,
        totalActions: allActions.length,
        allSuccessful: allActions.every(a => a.success),
        avgDurationMs: avgDuration.toFixed(2)
      });
    });

    it('should handle application lifecycle events', async () => {
      const lifecycle = [];

      // Simulate application startup
      lifecycle.push({ event: 'startup', timestamp: Date.now() });
      
      // Initial health check
      const healthCheck1 = await simulateUserAction('search', {
        ...validSearchRequest,
        query: 'health check'
      });
      
      lifecycle.push({ 
        event: 'health-check-1', 
        success: healthCheck1.success, 
        timestamp: Date.now() 
      });

      // Simulate heavy usage period
      lifecycle.push({ event: 'heavy-usage-start', timestamp: Date.now() });
      
      const heavyUsageRequests = Array.from({ length: 50 }, (_, i) => 
        simulateUserAction('search', {
          ...validSearchRequest,
          requestId: `heavy-usage-${i}`,
          query: `heavy usage query ${i % 10}`
        })
      );

      const heavyUsageResults = await Promise.all(heavyUsageRequests);
      const heavyUsageSuccess = heavyUsageResults.every(r => r.success);
      
      lifecycle.push({ 
        event: 'heavy-usage-complete', 
        success: heavyUsageSuccess,
        timestamp: Date.now() 
      });

      // Health check after heavy usage
      const healthCheck2 = await simulateUserAction('search', {
        ...validSearchRequest,
        query: 'health check after heavy usage'
      });
      
      lifecycle.push({ 
        event: 'health-check-2', 
        success: healthCheck2.success,
        timestamp: Date.now() 
      });

      // Simulate graceful shutdown preparation
      lifecycle.push({ event: 'shutdown-prep', timestamp: Date.now() });
      
      // Final health check
      const finalHealthCheck = await simulateUserAction('metrics', validMetricsRequest);
      
      lifecycle.push({ 
        event: 'final-health-check', 
        success: finalHealthCheck.success,
        timestamp: Date.now() 
      });

      // Verify application remained healthy throughout lifecycle
      const healthEvents = lifecycle.filter(e => e.hasOwnProperty('success'));
      expect(healthEvents.every(e => e.success)).toBe(true);

      console.log('Application Lifecycle Results:', {
        events: lifecycle.length,
        duration: (lifecycle[lifecycle.length - 1].timestamp - lifecycle[0].timestamp),
        healthChecks: healthEvents.length,
        allHealthy: healthEvents.every(e => e.success)
      });
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should recover from network-related AI service failures', async () => {
      // Simulate AI service failure
      const failureScenarios = [
        {
          name: 'AI Timeout',
          request: {
            ...validSearchRequest,
            query: '__SIMULATE_AI_TIMEOUT__',
            useAI: true
          }
        },
        {
          name: 'AI Service Unavailable',
          request: {
            ...validSearchRequest,
            query: '__SIMULATE_AI_ERROR__',
            useAI: true
          }
        }
      ];

      for (const scenario of failureScenarios) {
        const response = await simulateUserAction('search', scenario.request);
        
        // Should either succeed with fallback or fail gracefully
        if (response.success) {
          expect(response.metadata?.fallbackUsed).toBe(true);
        } else {
          expect(response.error).toBeDefined();
          expect(response.error.retryable).toBe(true);
        }

        // Verify system still works with normal requests
        const normalResponse = await simulateUserAction('search', validSearchRequest);
        expect(normalResponse.success).toBe(true);
      }
    });

    it('should handle data consistency during failures', async () => {
      // Start creating an entry
      const createResponse = await simulateUserAction('create', validCreateRequest);
      expect(createResponse.success).toBe(true);
      const entryId = createResponse.data.id;

      // Simulate various failure scenarios while maintaining data consistency
      const scenarios = [
        // Update failure
        {
          action: 'update',
          request: {
            ...validCreateRequest,
            channel: IPCChannel.KB_UPDATE,
            entryId,
            updates: { title: 'Updated during failure test' }
          }
        },
        // Feedback failure
        {
          action: 'feedback',
          request: {
            ...validCreateRequest,
            channel: IPCChannel.KB_FEEDBACK,
            entryId,
            successful: true,
            comment: 'Feedback during failure test'
          }
        }
      ];

      for (const scenario of scenarios) {
        const response = await simulateUserAction(scenario.action, scenario.request);
        
        // Whether it succeeds or fails, verify data consistency
        const verifyResponse = await simulateUserAction('get', {
          ...validCreateRequest,
          channel: IPCChannel.KB_GET,
          entryId
        });

        expect(verifyResponse.success).toBe(true);
        expect(verifyResponse.data.entry).toBeDefined();
      }
    });

    it('should maintain security during error conditions', async () => {
      const maliciousRequests = [
        {
          name: 'SQL Injection during error',
          request: {
            ...validSearchRequest,
            query: "'; DROP TABLE kb_entries; SELECT * FROM users WHERE 1=1; --"
          }
        },
        {
          name: 'XSS during create',
          request: {
            ...validCreateRequest,
            entry: {
              ...validCreateRequest.entry,
              title: '<script>alert("xss during error")</script>'
            }
          }
        }
      ];

      for (const attack of maliciousRequests) {
        const response = await simulateUserAction(
          attack.request.entry ? 'create' : 'search', 
          attack.request
        );

        // Should be blocked or sanitized
        if (response.success && response.data.entry) {
          expect(response.data.entry.title).not.toContain('<script>');
        } else if (!response.success) {
          expect(response.error?.code).toMatch(/VALIDATION|SECURITY/);
        }

        // Verify system still functions normally
        const normalResponse = await simulateUserAction('search', validSearchRequest);
        expect(normalResponse.success).toBe(true);
      }
    });
  });

  describe('Performance in Real-World Scenarios', () => {
    it('should maintain performance during typical user sessions', async () => {
      const sessionTracker = new PerformanceTracker();
      
      // Simulate a typical 30-minute user session
      const sessionActions = [
        // User starts with searches
        ...Array.from({ length: 20 }, (_, i) => ({
          type: 'search',
          request: {
            ...validSearchRequest,
            requestId: `session-search-${i}`,
            query: `typical search ${i % 5}`
          }
        })),
        // User creates some new entries
        ...Array.from({ length: 5 }, (_, i) => ({
          type: 'create',
          request: {
            ...validCreateRequest,
            requestId: `session-create-${i}`,
            entry: {
              ...validCreateRequest.entry,
              title: `Session Entry ${i}`,
              problem: `Problem ${i} from session`
            }
          }
        })),
        // User provides feedback
        ...Array.from({ length: 10 }, (_, i) => ({
          type: 'feedback',
          request: {
            ...validCreateRequest,
            channel: IPCChannel.KB_FEEDBACK,
            requestId: `session-feedback-${i}`,
            entryId: 'mock-entry-id', // Would be real ID in practice
            successful: i % 3 !== 0, // Mix of positive and negative feedback
            comment: `Session feedback ${i}`
          }
        })),
        // User checks metrics periodically
        ...Array.from({ length: 3 }, (_, i) => ({
          type: 'metrics',
          request: {
            ...validMetricsRequest,
            requestId: `session-metrics-${i}`
          }
        }))
      ];

      // Execute session with realistic timing
      let successCount = 0;
      for (let i = 0; i < sessionActions.length; i++) {
        const action = sessionActions[i];
        const actionId = sessionTracker.start(`session-${action.type}-${i}`);
        
        const response = await simulateUserAction(action.type, action.request);
        sessionTracker.end(actionId);
        
        if (response.success) successCount++;

        // Realistic user pauses between actions (1-3 seconds)
        if (i < sessionActions.length - 1) {
          await delay(Math.random() * 2000 + 1000);
        }
      }

      const sessionStats = sessionTracker.getStats();
      const successRate = successCount / sessionActions.length;

      expect(successRate).toBeGreaterThan(0.95); // > 95% success rate
      expect(sessionStats.avg).toBeLessThan(500); // < 500ms average response
      expect(sessionStats.max).toBeLessThan(2000); // No operation > 2s

      console.log('User Session Performance:', {
        actions: sessionActions.length,
        successRate: (successRate * 100).toFixed(1) + '%',
        avgResponseTime: sessionStats.avg.toFixed(2) + 'ms',
        maxResponseTime: sessionStats.max.toFixed(2) + 'ms',
        totalSessionTime: sessionStats.total.toFixed(2) + 'ms'
      });
    });

    it('should handle peak usage periods effectively', async () => {
      const peakTracker = new PerformanceTracker();
      
      // Simulate peak usage: multiple concurrent users
      const peakUsers = Array.from({ length: 10 }, (_, userId) => ({
        userId: `peak-user-${userId}`,
        actions: Array.from({ length: 20 }, (_, actionId) => ({
          type: actionId % 3 === 0 ? 'create' : 'search',
          request: {
            ...(actionId % 3 === 0 ? validCreateRequest : validSearchRequest),
            requestId: `peak-${userId}-${actionId}`,
            userId: `peak-user-${userId}`,
            ...(actionId % 3 === 0 ? {
              entry: {
                ...validCreateRequest.entry,
                title: `Peak Entry ${userId}-${actionId}`
              }
            } : {
              query: `peak search ${userId} ${actionId % 5}`
            })
          }
        }))
      }));

      // Execute all user actions concurrently
      const peakId = peakTracker.start('peak-usage');
      
      const allActions = peakUsers.flatMap(user => 
        user.actions.map(action => ({
          ...action,
          userId: user.userId
        }))
      );

      const peakResults = await Promise.all(
        allActions.map(async (action) => {
          return simulateUserAction(action.type, action.request);
        })
      );

      peakTracker.end(peakId);

      const successfulActions = peakResults.filter(r => r.success).length;
      const successRate = successfulActions / peakResults.length;

      expect(successRate).toBeGreaterThan(0.90); // > 90% success during peak
      expect(peakTracker.getResults()[0].duration).toBeLessThan(10000); // Peak period < 10s

      console.log('Peak Usage Performance:', {
        concurrentUsers: peakUsers.length,
        totalActions: allActions.length,
        successRate: (successRate * 100).toFixed(1) + '%',
        peakDuration: peakTracker.getResults()[0].duration.toFixed(2) + 'ms'
      });
    });
  });

  // Helper function to simulate user actions through IPC
  async function simulateUserAction(actionType: string, request: BaseIPCRequest): Promise<BaseIPCResponse> {
    // Simulate the IPC call that would come from the renderer process
    const channels = {
      search: IPCChannel.KB_SEARCH,
      create: IPCChannel.KB_CREATE,
      get: IPCChannel.KB_GET,
      update: IPCChannel.KB_UPDATE,
      delete: IPCChannel.KB_DELETE,
      feedback: IPCChannel.KB_FEEDBACK,
      metrics: IPCChannel.METRICS_GET
    };

    const channel = request.channel || channels[actionType] || actionType;
    
    // Add realistic request metadata
    const fullRequest = {
      ...request,
      channel,
      timestamp: Date.now(),
      requestId: request.requestId || `e2e-${actionType}-${Date.now()}`
    };

    try {
      // This simulates the actual IPC communication
      const response = await ipcMainProcess.handleRequest(fullRequest);
      
      // Simulate renderer process receiving response
      if (mockWindow && !mockWindow.isDestroyed()) {
        mockWindow.webContents.send('ipc-response', response);
      }
      
      return response;
    } catch (error) {
      console.error(`E2E action failed: ${actionType}`, error);
      return {
        success: false,
        requestId: fullRequest.requestId,
        timestamp: Date.now(),
        executionTime: 0,
        error: {
          code: 'E2E_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          severity: 'high',
          retryable: false
        }
      };
    }
  }
});