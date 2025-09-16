/**
 * Mock Electron API for UI Integration Tests
 * Provides consistent IPC mocking across all test files
 */

export const mockElectronAPI = {
  // IPC Communication
  invoke: jest.fn(),
  on: jest.fn(),
  removeAllListeners: jest.fn(),
  send: jest.fn(),

  // Test utilities
  _callLog: [] as Array<{
    channel: string;
    args: any[];
    timestamp: number;
  }>,
  _listeners: new Map<string, Function[]>(),

  // AI Authorization channels
  'ai:authorization-request': jest.fn(),
  'ai:authorization-result': jest.fn(),
  'ai:cost-estimation': jest.fn(),

  // Transparency channels
  'transparency:get-usage-data': jest.fn(),
  'transparency:get-cost-data': jest.fn(),
  'transparency:get-auth-data': jest.fn(),
  'transparency:get-trends-data': jest.fn(),
  'transparency:get-logs-data': jest.fn(),
  'transparency:export-logs': jest.fn(),

  // API Settings channels
  'api-settings:get-all': jest.fn(),
  'api-settings:save': jest.fn(),
  'api-settings:test-connection': jest.fn(),
  'api-settings:encrypt-key': jest.fn(),
  'api-settings:decrypt-key': jest.fn(),

  // KB Management channels
  'kb:get-entry': jest.fn(),
  'kb:update-entry': jest.fn(),
  'kb:delete-entry': jest.fn(),
  'kb:save-draft': jest.fn(),
  'kb:get-attachments': jest.fn(),

  // Security channels
  'security:log-event': jest.fn(),

  // System channels
  'system:get-info': jest.fn(),
  'system:check-updates': jest.fn(),
};

// Default mock responses
export const defaultMockResponses = {
  // AI Authorization
  'ai:authorization-result': { success: true },
  'ai:cost-estimation': {
    estimatedCost: 2.45,
    tokensToUse: 5000,
    confidence: 'high',
  },

  // Transparency data
  'transparency:get-usage-data': {
    totalQueries: 1247,
    totalTokens: 2847392,
    avgResponseTime: 1.2,
    successRate: 98.5,
    lastUpdated: new Date().toISOString(),
  },
  'transparency:get-cost-data': {
    currentMonth: 45.67,
    lastMonth: 38.92,
    yearToDate: 523.45,
    breakdown: [
      { service: 'OpenAI GPT-4', cost: 25.40, percentage: 55.6 },
      { service: 'Claude-3', cost: 15.20, percentage: 33.3 },
      { service: 'Embedding API', cost: 5.07, percentage: 11.1 },
    ],
  },
  'transparency:get-auth-data': {
    pendingRequests: 3,
    approvedToday: 15,
    rejectedToday: 2,
    avgApprovalTime: 45,
    recentAuthorizations: [
      {
        id: '1',
        operation: 'Document Analysis',
        cost: 2.45,
        status: 'approved',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
      },
    ],
  },
  'transparency:get-trends-data': {
    dailyUsage: [
      { date: '2024-01-01', queries: 45, cost: 12.34 },
      { date: '2024-01-02', queries: 52, cost: 15.67 },
      { date: '2024-01-03', queries: 38, cost: 9.87 },
    ],
    topOperations: [
      { operation: 'Search', count: 456, avgCost: 0.15 },
      { operation: 'Analysis', count: 234, avgCost: 2.45 },
    ],
  },
  'transparency:get-logs-data': {
    entries: [
      {
        id: '1',
        timestamp: new Date().toISOString(),
        level: 'info',
        operation: 'Search Query',
        message: 'Successful search completed',
        cost: 0.15,
        tokens: 750,
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 300000).toISOString(),
        level: 'warning',
        operation: 'High Cost Operation',
        message: 'Operation exceeded cost threshold',
        cost: 25.67,
        tokens: 15000,
      },
    ],
  },

  // API Settings
  'api-settings:get-all': {
    openai: {
      apiKey: 'sk-encrypted-key-12345',
      model: 'gpt-4',
      maxTokens: 4000,
      temperature: 0.7,
      isEncrypted: true,
      lastUpdated: new Date().toISOString(),
    },
    anthropic: {
      apiKey: 'claude-encrypted-key-67890',
      model: 'claude-3-opus',
      maxTokens: 8000,
      temperature: 0.5,
      isEncrypted: true,
      lastUpdated: new Date().toISOString(),
    },
  },
  'api-settings:save': { success: true },
  'api-settings:test-connection': { success: true, responseTime: 245 },
  'api-settings:encrypt-key': 'encrypted-test-key',
  'api-settings:decrypt-key': 'decrypted-test-key',

  // KB Management
  'kb:get-entry': {
    id: 'kb-entry-123',
    title: 'Mainframe COBOL Best Practices',
    content: 'This document outlines the best practices for COBOL development...',
    summary: 'Guidelines for effective COBOL programming',
    tags: ['COBOL', 'Mainframe', 'Best Practices'],
    category: 'Development',
    author: 'John Smith',
    lastModified: '2024-01-15T10:30:00Z',
    version: 2,
    status: 'published',
    metadata: {
      wordCount: 1250,
      readingTime: 5,
      difficulty: 'intermediate',
    },
    attachments: [
      { id: 'att-1', name: 'example.cbl', size: 2048, type: 'text/plain' },
      { id: 'att-2', name: 'diagram.png', size: 102400, type: 'image/png' },
    ],
  },
  'kb:update-entry': { success: true },
  'kb:delete-entry': { success: true },
  'kb:save-draft': { success: true },

  // Security
  'security:log-event': { success: true },
};

// Setup mock implementation
export const setupElectronAPIMock = (customResponses: Partial<typeof defaultMockResponses> = {}) => {
  const responses = { ...defaultMockResponses, ...customResponses };

  mockElectronAPI.invoke.mockImplementation(async (channel: string, ...args: any[]) => {
    // Log the call
    const call = { channel, args, timestamp: Date.now() };
    mockElectronAPI._callLog.push(call);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 10));

    // Return response or throw error
    if (channel.startsWith('error:')) {
      throw new Error(`Simulated error for ${channel}`);
    }

    return responses[channel as keyof typeof responses] || {};
  });

  mockElectronAPI.on.mockImplementation((channel: string, callback: Function) => {
    if (!mockElectronAPI._listeners.has(channel)) {
      mockElectronAPI._listeners.set(channel, []);
    }
    mockElectronAPI._listeners.get(channel)?.push(callback);
    return mockElectronAPI;
  });

  mockElectronAPI.removeAllListeners.mockImplementation((channel?: string) => {
    if (channel) {
      mockElectronAPI._listeners.delete(channel);
    } else {
      mockElectronAPI._listeners.clear();
    }
    return mockElectronAPI;
  });

  // Setup window.electronAPI
  Object.defineProperty(window, 'electronAPI', {
    value: mockElectronAPI,
    writable: true,
  });

  return mockElectronAPI;
};

// Reset mock state
export const resetElectronAPIMock = () => {
  jest.clearAllMocks();
  mockElectronAPI._callLog = [];
  mockElectronAPI._listeners.clear();
};

// Simulate real-time updates
export const simulateRealtimeUpdate = (channel: string, data: any) => {
  const listeners = mockElectronAPI._listeners.get(channel) || [];
  listeners.forEach(listener => listener(data));
};

// Error simulation helpers
export const simulateIPCError = (channel: string, error: Error) => {
  mockElectronAPI.invoke.mockImplementation(async (callChannel: string) => {
    if (callChannel === channel) {
      throw error;
    }
    return defaultMockResponses[callChannel as keyof typeof defaultMockResponses] || {};
  });
};

// Wait for specific IPC call
export const waitForIPCCall = async (
  channel: string,
  timeout = 5000
): Promise<{ channel: string; args: any[]; timestamp: number }> => {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const call = mockElectronAPI._callLog.find(call => call.channel === channel);
    if (call) return call;
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  throw new Error(`IPC call to ${channel} not found within ${timeout}ms`);
};

// Get all IPC calls for a channel
export const getIPCCalls = (channel: string) => {
  return mockElectronAPI._callLog.filter(call => call.channel === channel);
};

// Clear call log
export const clearIPCCallLog = () => {
  mockElectronAPI._callLog = [];
};

export default mockElectronAPI;