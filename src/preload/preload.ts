/**
 * Electron Preload Script - ElectronAPI Bridge
 * Exposes secure IPC methods to the renderer process
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { 
  KBEntry, 
  KBEntryInput, 
  KBEntryUpdate, 
  SearchResult, 
  SearchQuery, 
  DatabaseMetrics,
  KBCategory
} from '../types';

// Define the ElectronAPI interface exposed to renderer
export interface ElectronAPI {
  // Knowledge Base operations
  getKBEntries: (query?: SearchQuery) => Promise<SearchResult[]>;
  addKBEntry: (entry: KBEntryInput) => Promise<string>;
  updateKBEntry: (id: string, updates: KBEntryUpdate) => Promise<void>;
  deleteKBEntry: (id: string) => Promise<void>;
  getEntry: (id: string) => Promise<KBEntry | null>;
  
  // Search operations
  searchLocal: (query: string, options?: SearchQuery) => Promise<SearchResult[]>;
  searchWithAI: (query: string, options?: SearchQuery) => Promise<SearchResult[]>;
  
  // Rating and feedback
  rateEntry: (id: string, successful: boolean, comment?: string) => Promise<void>;
  recordEntryView: (id: string) => Promise<void>;
  
  // System operations
  getMetrics: () => Promise<DatabaseMetrics>;
  exportKB: (path?: string) => Promise<string>;
  importKB: (path?: string) => Promise<number>;
  
  // Database operations
  checkDatabase: () => Promise<{ connected: boolean; isEmpty: boolean }>;
  loadInitialTemplates: () => Promise<void>;
  checkAIService: () => Promise<{ available: boolean; model?: string }>;
  
  // Application lifecycle
  closeApplication: () => Promise<void>;
  minimizeWindow: (windowId: string) => Promise<void>;
  maximizeWindow: (windowId: string) => Promise<void>;
  restoreWindow: (windowId: string) => Promise<void>;
  focusWindow: (windowId: string) => Promise<void>;
  closeWindow: (windowId: string) => Promise<void>;
  
  // Window management
  getWindowState: (windowId: string) => Promise<any>;
  updateWindowState: (windowId: string, state: any) => Promise<void>;
  
  // Theme operations
  getTheme: () => Promise<'light' | 'dark'>;
  setTheme: (theme: 'light' | 'dark') => Promise<void>;
  
  // Development tools
  openDevTools: () => void;
  getAppVersion: () => Promise<string>;
  checkForUpdates: () => Promise<boolean>;
  
  // Event listeners
  onThemeChanged: (callback: (theme: 'light' | 'dark') => void) => void;
  onWindowStateChanged: (callback: (state: any) => void) => void;
  onKBUpdated: (callback: (data: any) => void) => void;
  
  // Remove listeners
  removeAllListeners: (channel: string) => void;
}

// Knowledge Base API methods
const kbAPI = {
  getKBEntries: async (query?: SearchQuery): Promise<SearchResult[]> => {
    try {
      if (query?.query) {
        // If there's a search query, use search
        return await ipcRenderer.invoke('db:search', query.query, query);
      } else {
        // Otherwise get recent entries
        const recentResults = await ipcRenderer.invoke('db:getRecent', query?.limit || 20);
        // Convert to SearchResult format
        return recentResults.map((entry: KBEntry) => ({
          entry,
          score: 100,
          matchType: 'exact' as const,
          highlights: []
        }));
      }
    } catch (error) {
      console.error('Failed to get KB entries:', error);
      return [];
    }
  },

  addKBEntry: async (entry: KBEntryInput): Promise<string> => {
    return await ipcRenderer.invoke('db:addEntry', entry);
  },

  updateKBEntry: async (id: string, updates: KBEntryUpdate): Promise<void> => {
    await ipcRenderer.invoke('db:updateEntry', id, updates);
  },

  deleteKBEntry: async (id: string): Promise<void> => {
    // Note: Delete functionality may need to be added to IPCService
    console.warn('Delete functionality not yet implemented in IPCService');
    return Promise.resolve();
  },

  getEntry: async (id: string): Promise<KBEntry | null> => {
    return await ipcRenderer.invoke('db:getEntry', id);
  }
};

// Search API methods
const searchAPI = {
  searchLocal: async (query: string, options?: SearchQuery): Promise<SearchResult[]> => {
    try {
      return await ipcRenderer.invoke('db:search', query, options);
    } catch (error) {
      console.error('Local search failed:', error);
      return [];
    }
  },

  searchWithAI: async (query: string, options?: SearchQuery): Promise<SearchResult[]> => {
    try {
      return await ipcRenderer.invoke('db:searchWithAI', query, options);
    } catch (error) {
      console.error('AI search failed, falling back to local:', error);
      // Fallback to local search
      return await ipcRenderer.invoke('db:search', query, options);
    }
  }
};

// Rating and feedback API
const feedbackAPI = {
  rateEntry: async (id: string, successful: boolean, comment?: string): Promise<void> => {
    await ipcRenderer.invoke('db:recordUsage', id, successful);
  },

  recordEntryView: async (id: string): Promise<void> => {
    await ipcRenderer.invoke('db:recordUsage', id, true);
  }
};

// System operations API
const systemAPI = {
  getMetrics: async (): Promise<DatabaseMetrics> => {
    try {
      return await ipcRenderer.invoke('db:getStats');
    } catch (error) {
      console.error('Failed to get metrics:', error);
      return {
        total_entries: 0,
        searches_today: 0,
        avg_response_time: 0,
        cache_hit_rate: 0,
        storage_used_mb: 0
      };
    }
  },

  exportKB: async (path?: string): Promise<string> => {
    if (path) {
      return await ipcRenderer.invoke('db:exportToJSON', path);
    } else {
      // For backward compatibility, if no path provided, create a default one
      const defaultPath = `./knowledge-base-export-${new Date().toISOString().split('T')[0]}.json`;
      return await ipcRenderer.invoke('db:exportToJSON', defaultPath);
    }
  },

  importKB: async (path?: string): Promise<number> => {
    if (path) {
      const result = await ipcRenderer.invoke('db:importFromJSON', path, false);
      return result.restored || 0;
    } else {
      console.warn('Import path not provided');
      return 0;
    }
  },

  checkDatabase: async (): Promise<{ connected: boolean; isEmpty: boolean }> => {
    try {
      const healthCheck = await ipcRenderer.invoke('db:healthCheck');
      const stats = await ipcRenderer.invoke('db:getStats');
      return {
        connected: healthCheck.healthy,
        isEmpty: stats.total_entries === 0
      };
    } catch (error) {
      console.error('Database check failed:', error);
      return { connected: false, isEmpty: true };
    }
  },

  loadInitialTemplates: async (): Promise<void> => {
    // This functionality may need to be implemented in IPCService
    console.warn('Load initial templates functionality not yet implemented in IPCService');
    return Promise.resolve();
  },

  checkAIService: async (): Promise<{ available: boolean; model?: string }> => {
    try {
      // Try to use AI explain function to test availability
      await ipcRenderer.invoke('ai:explainError', 'test');
      return { available: true, model: 'gemini-pro' };
    } catch (error) {
      console.log('AI service not available:', error);
      return { available: false };
    }
  }
};

// Application lifecycle API
const appAPI = {
  closeApplication: async (): Promise<void> => {
    // Use electron's app.quit through window manager
    try {
      await ipcRenderer.invoke('window-manager:close-window', 'main-window');
    } catch (error) {
      console.error('Failed to close application:', error);
    }
  },

  minimizeWindow: async (windowId: string): Promise<void> => {
    // These functionalities need to be added to window management service
    console.warn('Window minimize functionality needs to be implemented in window management service');
    return Promise.resolve();
  },

  maximizeWindow: async (windowId: string): Promise<void> => {
    console.warn('Window maximize functionality needs to be implemented in window management service');
    return Promise.resolve();
  },

  restoreWindow: async (windowId: string): Promise<void> => {
    console.warn('Window restore functionality needs to be implemented in window management service');
    return Promise.resolve();
  },

  focusWindow: async (windowId: string): Promise<void> => {
    await ipcRenderer.invoke('window-manager:focus-window', windowId);
  },

  closeWindow: async (windowId: string): Promise<void> => {
    await ipcRenderer.invoke('window-manager:close-window', windowId);
  }
};

// Window management API
const windowAPI = {
  getWindowState: async (windowId: string): Promise<any> => {
    try {
      // Use window integration service stats which might contain state info
      return await ipcRenderer.invoke('window-integration:get-stats');
    } catch (error) {
      console.error('Failed to get window state:', error);
      return null;
    }
  },

  updateWindowState: async (windowId: string, state: any): Promise<void> => {
    console.warn('Update window state functionality needs to be implemented');
    return Promise.resolve();
  }
};

// Theme API
const themeAPI = {
  getTheme: async (): Promise<'light' | 'dark'> => {
    try {
      // Use config system to get theme preference
      const theme = await ipcRenderer.invoke('config:get', 'theme');
      return theme || 'light';
    } catch (error) {
      console.error('Failed to get theme:', error);
      return 'light';
    }
  },

  setTheme: async (theme: 'light' | 'dark'): Promise<void> => {
    try {
      await ipcRenderer.invoke('config:set', 'theme', theme, 'string', 'Application theme preference');
    } catch (error) {
      console.error('Failed to set theme:', error);
    }
  }
};

// Development tools API
const devAPI = {
  openDevTools: (): void => {
    // Use a simple channel since this is a development only feature
    ipcRenderer.send('dev:open-devtools');
  },

  getAppVersion: async (): Promise<string> => {
    try {
      // Get version from config or use a default
      const version = await ipcRenderer.invoke('config:get', 'app_version');
      return version || '1.0.0-mvp1';
    } catch (error) {
      console.error('Failed to get app version:', error);
      return '1.0.0-mvp1';
    }
  },

  checkForUpdates: async (): Promise<boolean> => {
    // For MVP1, updates are not implemented
    console.warn('Update checking not implemented in MVP1');
    return Promise.resolve(false);
  }
};

// Event listener API
const eventAPI = {
  onThemeChanged: (callback: (theme: 'light' | 'dark') => void): void => {
    ipcRenderer.on('theme:changed', (_, theme) => callback(theme));
  },

  onWindowStateChanged: (callback: (state: any) => void): void => {
    ipcRenderer.on('window:state-changed', (_, state) => callback(state));
  },

  onKBUpdated: (callback: (data: any) => void): void => {
    ipcRenderer.on('kb:updated', (_, data) => callback(data));
  },

  removeAllListeners: (channel: string): void => {
    ipcRenderer.removeAllListeners(channel);
  }
};

// Combine all APIs into the complete ElectronAPI
const electronAPI: ElectronAPI = {
  // Knowledge Base operations
  ...kbAPI,
  
  // Search operations
  ...searchAPI,
  
  // Rating and feedback
  ...feedbackAPI,
  
  // System operations
  ...systemAPI,
  
  // Application lifecycle
  ...appAPI,
  
  // Window management
  ...windowAPI,
  
  // Theme operations
  ...themeAPI,
  
  // Development tools
  ...devAPI,
  
  // Event listeners
  ...eventAPI
};

// Security: Only expose the API if we're in the correct context
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', electronAPI);
    console.log('ElectronAPI exposed successfully');
  } catch (error) {
    console.error('Failed to expose ElectronAPI:', error);
  }
} else {
  // Fallback for development (context isolation disabled)
  (window as any).electronAPI = electronAPI;
  console.warn('Context isolation is disabled - ElectronAPI attached to window (development only)');
}

// Error handling for IPC communication
ipcRenderer.on('api:error', (_, error) => {
  console.error('ElectronAPI Error:', error);
});

// Handle uncaught errors in preload
process.on('uncaughtException', (error) => {
  console.error('Preload uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Preload unhandled rejection:', reason);
});

export default electronAPI;