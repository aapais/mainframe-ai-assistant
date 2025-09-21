/**
 * ElectronAPI Type Definitions
 * Defines the interface exposed to the renderer process via contextBridge
 */

import { 
  KBEntry, 
  KBEntryInput, 
  KBEntryUpdate, 
  SearchResult, 
  SearchQuery, 
  DatabaseMetrics,
  KBCategory 
} from './index';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    api: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
    };
  }
}

/**
 * Main ElectronAPI interface exposed to renderer processes
 * All methods are async and return promises for security and performance
 */
export interface ElectronAPI {
  // ===========================
  // Knowledge Base Operations
  // ===========================
  
  /**
   * Retrieve knowledge base entries with optional search query
   * @param query - Optional search parameters
   * @returns Promise of search results
   */
  getKBEntries: (query?: SearchQuery) => Promise<SearchResult[]>;
  
  /**
   * Add a new knowledge base entry
   * @param entry - Entry data (without id, timestamps, usage stats)
   * @returns Promise of the created entry ID
   */
  addKBEntry: (entry: KBEntryInput) => Promise<string>;
  
  /**
   * Update an existing knowledge base entry
   * @param id - Entry ID to update
   * @param updates - Partial entry data to update
   * @returns Promise that resolves when update is complete
   */
  updateKBEntry: (id: string, updates: KBEntryUpdate) => Promise<void>;
  
  /**
   * Delete a knowledge base entry
   * @param id - Entry ID to delete
   * @returns Promise that resolves when deletion is complete
   */
  deleteKBEntry: (id: string) => Promise<void>;
  
  /**
   * Get a single knowledge base entry by ID
   * @param id - Entry ID
   * @returns Promise of the entry or null if not found
   */
  getEntry: (id: string) => Promise<KBEntry | null>;

  // ===========================
  // Search Operations
  // ===========================
  
  /**
   * Perform local search using SQLite FTS
   * @param query - Search query string
   * @param options - Optional search parameters
   * @returns Promise of search results
   */
  searchLocal: (query: string, options?: SearchQuery) => Promise<SearchResult[]>;
  
  /**
   * Perform AI-enhanced search using Gemini
   * Falls back to local search if AI service is unavailable
   * @param query - Search query string
   * @param options - Optional search parameters
   * @returns Promise of search results
   */
  searchWithAI: (query: string, options?: SearchQuery) => Promise<SearchResult[]>;

  // ===========================
  // Feedback and Analytics
  // ===========================
  
  /**
   * Rate the usefulness of a knowledge base entry
   * @param id - Entry ID
   * @param successful - Whether the entry was helpful
   * @param comment - Optional user comment
   * @returns Promise that resolves when rating is recorded
   */
  rateEntry: (id: string, successful: boolean, comment?: string) => Promise<void>;
  
  /**
   * Record that a user viewed an entry (for analytics)
   * @param id - Entry ID
   * @returns Promise that resolves when view is recorded
   */
  recordEntryView?: (id: string) => Promise<void>;

  // ===========================
  // System Operations
  // ===========================
  
  /**
   * Get system metrics and statistics
   * @returns Promise of database metrics
   */
  getMetrics: () => Promise<DatabaseMetrics>;
  
  /**
   * Export knowledge base to JSON file
   * @param path - Optional suggested file path
   * @returns Promise of the export file path
   */
  exportKB?: (path?: string) => Promise<string>;
  
  /**
   * Import knowledge base from JSON file
   * @param path - Optional file path to import
   * @returns Promise of the number of entries imported
   */
  importKB?: (path?: string) => Promise<number>;
  
  /**
   * Check database connection and status
   * @returns Promise of database status
   */
  checkDatabase?: () => Promise<{ connected: boolean; isEmpty: boolean }>;
  
  /**
   * Load initial knowledge base templates
   * @returns Promise that resolves when templates are loaded
   */
  loadInitialTemplates?: () => Promise<void>;
  
  /**
   * Check AI service availability
   * @returns Promise of AI service status
   */
  checkAIService?: () => Promise<{ available: boolean; model?: string }>;

  // ===========================
  // Application Lifecycle
  // ===========================
  
  /**
   * Close the application
   * @returns Promise that resolves when close is initiated
   */
  closeApplication?: () => Promise<void>;
  
  /**
   * Get the application version
   * @returns Promise of version string
   */
  getAppVersion?: () => Promise<string>;
  
  /**
   * Check for application updates
   * @returns Promise of whether updates are available
   */
  checkForUpdates?: () => Promise<boolean>;

  // ===========================
  // Window Management
  // ===========================
  
  /**
   * Minimize a window
   * @param windowId - Window identifier
   * @returns Promise that resolves when window is minimized
   */
  minimizeWindow?: (windowId: string) => Promise<void>;
  
  /**
   * Maximize or restore a window
   * @param windowId - Window identifier
   * @returns Promise that resolves when window state changes
   */
  maximizeWindow?: (windowId: string) => Promise<void>;
  
  /**
   * Restore a minimized or maximized window
   * @param windowId - Window identifier
   * @returns Promise that resolves when window is restored
   */
  restoreWindow?: (windowId: string) => Promise<void>;
  
  /**
   * Focus a window
   * @param windowId - Window identifier
   * @returns Promise that resolves when window is focused
   */
  focusWindow?: (windowId: string) => Promise<void>;
  
  /**
   * Close a window
   * @param windowId - Window identifier
   * @returns Promise that resolves when window is closed
   */
  closeWindow?: (windowId: string) => Promise<void>;
  
  /**
   * Get window state information
   * @param windowId - Window identifier
   * @returns Promise of window state object
   */
  getWindowState?: (windowId: string) => Promise<WindowState | null>;
  
  /**
   * Update window state
   * @param windowId - Window identifier
   * @param state - State updates to apply
   * @returns Promise that resolves when state is updated
   */
  updateWindowState?: (windowId: string, state: Partial<WindowState>) => Promise<void>;

  // ===========================
  // Theme Management
  // ===========================
  
  /**
   * Get the current application theme
   * @returns Promise of current theme ('light' or 'dark')
   */
  getTheme?: () => Promise<'light' | 'dark'>;
  
  /**
   * Set the application theme
   * @param theme - Theme to set ('light' or 'dark')
   * @returns Promise that resolves when theme is set
   */
  setTheme?: (theme: 'light' | 'dark') => Promise<void>;

  // ===========================
  // Development Tools
  // ===========================
  
  /**
   * Open developer tools for debugging
   */
  openDevTools?: () => void;
}

/**
 * Window state interface for window management
 */
export interface WindowState {
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  isMaximized: boolean;
  isMinimized: boolean;
  isFocused: boolean;
  isVisible: boolean;
}

/**
 * Event listener types for IPC communication
 */
export interface ElectronAPIEvents {
  /**
   * Listen for theme changes
   * @param callback - Function to call when theme changes
   */
  onThemeChanged?: (callback: (theme: 'light' | 'dark') => void) => void;
  
  /**
   * Listen for window state changes
   * @param callback - Function to call when window state changes
   */
  onWindowStateChanged?: (callback: (state: WindowState) => void) => void;
  
  /**
   * Listen for knowledge base updates
   * @param callback - Function to call when KB is updated
   */
  onKBUpdated?: (callback: (data: { type: string; payload: any }) => void) => void;
  
  /**
   * Remove all event listeners for a channel
   * @param channel - IPC channel name
   */
  removeAllListeners?: (channel: string) => void;
}

/**
 * Combined interface including events
 */
export interface ElectronAPIWithEvents extends ElectronAPI, ElectronAPIEvents {}

/**
 * Error types that can be returned from ElectronAPI calls
 */
export interface ElectronAPIError {
  code: string;
  message: string;
  details?: any;
}

/**
 * API response wrapper for consistent error handling
 */
export interface ElectronAPIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ElectronAPIError;
}

/**
 * Configuration for ElectronAPI behavior
 */
export interface ElectronAPIConfig {
  /**
   * Timeout for API calls in milliseconds
   */
  timeout?: number;
  
  /**
   * Whether to enable detailed logging
   */
  enableLogging?: boolean;
  
  /**
   * Whether to enable offline mode (disable AI features)
   */
  offlineMode?: boolean;
}

/**
 * Utility type for making all ElectronAPI methods optional
 * Useful for testing or partial implementations
 */
export type PartialElectronAPI = Partial<ElectronAPI>;

/**
 * Type guard to check if ElectronAPI is available
 */
export function isElectronAPIAvailable(): boolean {
  return typeof window !== 'undefined' && 
         typeof window.electronAPI === 'object' && 
         window.electronAPI !== null;
}

/**
 * Helper function to safely call ElectronAPI methods
 */
export async function safeElectronAPICall<T>(
  method: () => Promise<T>,
  fallback: T,
  errorMessage?: string
): Promise<T> {
  try {
    if (!isElectronAPIAvailable()) {
      console.warn('ElectronAPI not available, using fallback');
      return fallback;
    }
    return await method();
  } catch (error) {
    console.error(errorMessage || 'ElectronAPI call failed:', error);
    return fallback;
  }
}

export default ElectronAPI;