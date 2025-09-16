import { contextBridge, ipcRenderer } from 'electron';
import type { KBEntry, SearchResult, DatabaseStats } from '../database/KnowledgeDB';

// Enhanced response type with metadata
export interface IPCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    cached?: boolean;
    streamed?: boolean;
    batched?: boolean;
    executionTime?: number;
  };
}

// Stream-related types
export interface StreamChunk<T = any> {
  streamId: string;
  chunkIndex: number;
  data: T[];
  isLast: boolean;
  progress?: {
    streamId: string;
    totalItems?: number;
    processedItems: number;
    percentage: number;
    currentChunk: number;
    totalChunks?: number;
    startTime: number;
    estimatedTimeRemaining?: number;
  };
  metadata?: {
    size: number;
    timestamp: number;
  };
}

// Simple API interface for basic functionality
interface SimpleElectronAPI {
  invoke: (channel: string, ...args: any[]) => Promise<any>;
}

// Define the API that will be exposed to the renderer process
export interface ElectronAPI extends SimpleElectronAPI {
  // Database operations with enhanced responses
  db: {
    search: (query: string, options?: any) => Promise<IPCResponse<SearchResult[]>>;
    searchWithAI: (query: string, options?: any) => Promise<IPCResponse<SearchResult[]>>;
    addEntry: (entry: KBEntry, userId?: string) => Promise<IPCResponse<string>>;
    updateEntry: (id: string, updates: Partial<KBEntry>, userId?: string) => Promise<IPCResponse<void>>;
    getEntry: (id: string) => Promise<IPCResponse<KBEntry | null>>;
    getPopular: (limit?: number) => Promise<IPCResponse<SearchResult[] | string>>; // Can return stream ID
    getRecent: (limit?: number) => Promise<IPCResponse<SearchResult[] | string>>; // Can return stream ID
    recordUsage: (entryId: string, successful: boolean, userId?: string) => Promise<IPCResponse<void>>;
    getStats: () => Promise<IPCResponse<DatabaseStats>>;
    autoComplete: (query: string, limit?: number) => Promise<IPCResponse<Array<{ suggestion: string; category: string; score: number }>>>;
    createBackup: () => Promise<IPCResponse<void>>;
    exportToJSON: (outputPath: string) => Promise<IPCResponse<void>>;
    importFromJSON: (jsonPath: string, mergeMode?: boolean) => Promise<IPCResponse<void>>;
    healthCheck: () => Promise<IPCResponse<{
      overall: boolean;
      database: boolean;
      cache: boolean;
      connections: boolean;
      performance: boolean;
      issues: string[];
    }>>;
  };

  // Configuration
  config: {
    get: (key: string) => Promise<IPCResponse<string | null>>;
    set: (key: string, value: string, type?: string, description?: string) => Promise<IPCResponse<void>>;
  };

  // AI operations
  ai: {
    explainError: (errorCode: string) => Promise<IPCResponse<string>>;
  };

  // Performance monitoring
  perf: {
    getStatus: () => Promise<IPCResponse<any>>;
    getReport: (startTime?: number, endTime?: number) => Promise<IPCResponse<any>>;
  };

  // System information
  system: {
    getInfo: () => Promise<IPCResponse<{
      platform: string;
      arch: string;
      version: string;
      electronVersion: string;
      nodeVersion: string;
      dataPath: string;
    }>>;
  };

  // Streaming support
  streaming: {
    onChunk: <T>(streamId: string, callback: (chunk: StreamChunk<T>) => void) => void;
    onError: (streamId: string, callback: (error: { error: string }) => void) => void;
    cancelStream: (streamId: string) => void;
    removeStreamListeners: (streamId: string) => void;
  };

  // Batch processing support
  batch: {
    execute: (payload: any) => Promise<any>;
    getStats: () => Promise<any>;
    clearStats: () => Promise<void>;
  };

  // Menu events
  onMenuEvent: (callback: (event: string, data?: any) => void) => void;
  removeMenuListeners: () => void;
}

// Helper function to handle IPC responses with error handling
const safeInvoke = async <T>(channel: string, ...args: any[]): Promise<IPCResponse<T>> => {
  try {
    const response = await ipcRenderer.invoke(channel, ...args);
    
    // Check if response follows the new enhanced format
    if (response && typeof response === 'object' && 'success' in response) {
      return response as IPCResponse<T>;
    }
    
    // For backward compatibility, wrap raw responses
    return {
      success: true,
      data: response,
      metadata: {}
    } as IPCResponse<T>;
  } catch (error) {
    console.error(`IPC Error in ${channel}:`, error);
    return {
      success: false,
      error: {
        code: 'IPC_ERROR',
        message: error instanceof Error ? error.message : 'Unknown IPC error',
        details: error
      }
    } as IPCResponse<T>;
  }
};

// Simple invoke function for direct IPC calls
const simpleInvoke = async (channel: string, ...args: any[]): Promise<any> => {
  const allowedChannels = [
    'search-kb', 'add-kb-entry', 'update-kb-entry', 'delete-kb-entry'
  ];

  if (!allowedChannels.includes(channel)) {
    throw new Error(`IPC channel '${channel}' not allowed`);
  }

  return ipcRenderer.invoke(channel, ...args);
};

// Expose the API to the renderer process
const electronAPI: ElectronAPI = {
  // Simple invoke for backwards compatibility
  invoke: simpleInvoke,

  db: {
    search: (query: string, options?: any) => safeInvoke('db:search', query, options),
    searchWithAI: (query: string, options?: any) => safeInvoke('db:searchWithAI', query, options),
    addEntry: (entry: KBEntry, userId?: string) => safeInvoke('db:addEntry', entry, userId),
    updateEntry: (id: string, updates: Partial<KBEntry>, userId?: string) => safeInvoke('db:updateEntry', id, updates, userId),
    getEntry: (id: string) => safeInvoke('db:getEntry', id),
    getPopular: (limit?: number) => safeInvoke('db:getPopular', limit),
    getRecent: (limit?: number) => safeInvoke('db:getRecent', limit),
    recordUsage: (entryId: string, successful: boolean, userId?: string) => safeInvoke('db:recordUsage', entryId, successful, userId),
    getStats: () => safeInvoke('db:getStats'),
    autoComplete: (query: string, limit?: number) => safeInvoke('db:autoComplete', query, limit),
    createBackup: () => safeInvoke('db:createBackup'),
    exportToJSON: (outputPath: string) => safeInvoke('db:exportToJSON', outputPath),
    importFromJSON: (jsonPath: string, mergeMode?: boolean) => safeInvoke('db:importFromJSON', jsonPath, mergeMode),
    healthCheck: () => safeInvoke('db:healthCheck')
  },

  config: {
    get: (key: string) => safeInvoke('config:get', key),
    set: (key: string, value: string, type?: string, description?: string) => 
      safeInvoke('config:set', key, value, type, description)
  },

  ai: {
    explainError: (errorCode: string) => safeInvoke('ai:explainError', errorCode)
  },

  perf: {
    getStatus: () => safeInvoke('perf:getStatus'),
    getReport: (startTime?: number, endTime?: number) => safeInvoke('perf:getReport', startTime, endTime)
  },

  system: {
    getInfo: () => safeInvoke('system:getInfo')
  },

  streaming: {
    onChunk: <T>(streamId: string, callback: (chunk: StreamChunk<T>) => void) => {
      const channel = `stream:chunk:${streamId}`;
      ipcRenderer.on(channel, (_, chunk) => callback(chunk));
    },

    onError: (streamId: string, callback: (error: { error: string }) => void) => {
      const channel = `stream:error:${streamId}`;
      ipcRenderer.on(channel, (_, error) => callback(error));
    },

    cancelStream: (streamId: string) => {
      // This could be implemented as an IPC call to cancel the stream
      console.log(`Cancelling stream: ${streamId}`);
    },

    removeStreamListeners: (streamId: string) => {
      ipcRenderer.removeAllListeners(`stream:chunk:${streamId}`);
      ipcRenderer.removeAllListeners(`stream:error:${streamId}`);
    }
  },

  batch: {
    execute: (payload: any) => safeInvoke('ipc:execute-batch', payload),
    getStats: () => safeInvoke('ipc:batch-stats'),
    clearStats: () => safeInvoke('ipc:clear-batch-stats')
  },

  onMenuEvent: (callback: (event: string, data?: any) => void) => {
    const menuEvents = [
      'menu-new-entry',
      'menu-import-kb',
      'menu-export-kb',
      'menu-backup',
      'menu-show-stats',
      'menu-show-performance',
      'menu-optimize-db',
      'menu-show-settings',
      'menu-show-about'
    ];

    menuEvents.forEach(event => {
      ipcRenderer.on(event, (_, data) => callback(event, data));
    });
  },

  removeMenuListeners: () => {
    ipcRenderer.removeAllListeners('menu-new-entry');
    ipcRenderer.removeAllListeners('menu-import-kb');
    ipcRenderer.removeAllListeners('menu-export-kb');
    ipcRenderer.removeAllListeners('menu-backup');
    ipcRenderer.removeAllListeners('menu-show-stats');
    ipcRenderer.removeAllListeners('menu-show-performance');
    ipcRenderer.removeAllListeners('menu-optimize-db');
    ipcRenderer.removeAllListeners('menu-show-settings');
    ipcRenderer.removeAllListeners('menu-show-about');
  }
};

// Expose the API securely
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Type declaration for the renderer process
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}