/**
 * Type-safe IPC Client for Renderer Process
 * Provides strongly typed interface for all IPC operations with error handling and retry logic
 */

import type {
  KBEntry,
  KBEntryInput,
  KBEntryUpdate,
  SearchResult,
  SearchQuery,
  DatabaseMetrics,
  ElectronAPI,
  AppError,
  AppErrorType
} from '../../types';

// IPC Error types
export interface IPCError extends Error {
  code: string;
  type: AppErrorType;
  retry?: boolean;
  timestamp: Date;
}

// IPC Operation Options
export interface IPCOptions {
  timeout?: number;
  retries?: number;
  fallback?: boolean;
}

// IPC Response wrapper
export interface IPCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: IPCError;
  cached?: boolean;
  timing?: {
    start: number;
    end: number;
    duration: number;
  };
}

/**
 * Type-safe IPC Client with error handling and retry logic
 */
export class IPCClient {
  private api: ElectronAPI;
  private defaultTimeout = 5000;
  private defaultRetries = 2;
  
  constructor() {
    // Check if we're in the correct context
    if (typeof window === 'undefined' || !window.electronAPI) {
      throw new Error('IPCClient can only be used in the renderer process with ElectronAPI available');
    }
    
    this.api = window.electronAPI;
  }

  /**
   * Execute IPC call with error handling and retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: IPCOptions = {}
  ): Promise<IPCResponse<T>> {
    const { timeout = this.defaultTimeout, retries = this.defaultRetries } = options;
    const startTime = performance.now();

    let lastError: IPCError | null = null;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Add timeout wrapper
        const result = await Promise.race([
          operation(),
          new Promise<never>((_, reject) => {
            setTimeout(() => {
              reject(this.createIPCError('IPC_TIMEOUT', `Operation timed out after ${timeout}ms`, 'NETWORK_ERROR'));
            }, timeout);
          })
        ]);

        const endTime = performance.now();
        
        return {
          success: true,
          data: result,
          timing: {
            start: startTime,
            end: endTime,
            duration: endTime - startTime
          }
        };
        
      } catch (error) {
        lastError = this.normalizeError(error);
        
        // Don't retry on certain error types
        if (lastError.type === 'VALIDATION_ERROR' || lastError.type === 'PERMISSION_ERROR') {
          break;
        }
        
        // Wait before retry (exponential backoff)
        if (attempt < retries) {
          await this.delay(Math.pow(2, attempt) * 100);
        }
      }
    }

    const endTime = performance.now();
    
    return {
      success: false,
      error: lastError!,
      timing: {
        start: startTime,
        end: endTime,
        duration: endTime - startTime
      }
    };
  }

  /**
   * Knowledge Base Operations
   */
  async getKBEntries(query?: SearchQuery, options?: IPCOptions): Promise<IPCResponse<SearchResult[]>> {
    return this.executeWithRetry(() => this.api.getKBEntries(query), options);
  }

  async addKBEntry(entry: KBEntryInput, options?: IPCOptions): Promise<IPCResponse<string>> {
    // Validate entry before sending
    this.validateKBEntry(entry);
    return this.executeWithRetry(() => this.api.addKBEntry(entry), options);
  }

  async updateKBEntry(id: string, updates: KBEntryUpdate, options?: IPCOptions): Promise<IPCResponse<void>> {
    if (!id) throw this.createIPCError('INVALID_ID', 'Entry ID is required', 'VALIDATION_ERROR');
    return this.executeWithRetry(() => this.api.updateKBEntry(id, updates), options);
  }

  async deleteKBEntry(id: string, options?: IPCOptions): Promise<IPCResponse<void>> {
    if (!id) throw this.createIPCError('INVALID_ID', 'Entry ID is required', 'VALIDATION_ERROR');
    return this.executeWithRetry(() => this.api.deleteKBEntry(id), options);
  }

  async getEntry(id: string, options?: IPCOptions): Promise<IPCResponse<KBEntry | null>> {
    if (!id) throw this.createIPCError('INVALID_ID', 'Entry ID is required', 'VALIDATION_ERROR');
    return this.executeWithRetry(() => this.api.getEntry(id), options);
  }

  /**
   * Search Operations
   */
  async searchLocal(query: string, searchOptions?: SearchQuery, ipcOptions?: IPCOptions): Promise<IPCResponse<SearchResult[]>> {
    if (!query.trim()) throw this.createIPCError('EMPTY_QUERY', 'Search query cannot be empty', 'VALIDATION_ERROR');
    return this.executeWithRetry(() => this.api.searchLocal(query, searchOptions), ipcOptions);
  }

  async searchWithAI(query: string, searchOptions?: SearchQuery, ipcOptions?: IPCOptions): Promise<IPCResponse<SearchResult[]>> {
    if (!query.trim()) throw this.createIPCError('EMPTY_QUERY', 'Search query cannot be empty', 'VALIDATION_ERROR');
    
    const result = await this.executeWithRetry(() => this.api.searchWithAI(query, searchOptions), ipcOptions);
    
    // If AI search fails and fallback is enabled, try local search
    if (!result.success && ipcOptions?.fallback !== false) {
      console.warn('AI search failed, falling back to local search:', result.error);
      return this.searchLocal(query, searchOptions, ipcOptions);
    }
    
    return result;
  }

  /**
   * Rating and Feedback Operations
   */
  async rateEntry(id: string, successful: boolean, comment?: string, options?: IPCOptions): Promise<IPCResponse<void>> {
    if (!id) throw this.createIPCError('INVALID_ID', 'Entry ID is required', 'VALIDATION_ERROR');
    return this.executeWithRetry(() => this.api.rateEntry(id, successful, comment), options);
  }

  async recordEntryView(id: string, options?: IPCOptions): Promise<IPCResponse<void>> {
    if (!id) throw this.createIPCError('INVALID_ID', 'Entry ID is required', 'VALIDATION_ERROR');
    return this.executeWithRetry(() => this.api.recordEntryView(id), options);
  }

  /**
   * System Operations
   */
  async getMetrics(options?: IPCOptions): Promise<IPCResponse<DatabaseMetrics>> {
    return this.executeWithRetry(() => this.api.getMetrics(), options);
  }

  async exportKB(path?: string, options?: IPCOptions): Promise<IPCResponse<string>> {
    return this.executeWithRetry(() => this.api.exportKB(path), options);
  }

  async importKB(path?: string, options?: IPCOptions): Promise<IPCResponse<number>> {
    return this.executeWithRetry(() => this.api.importKB(path), options);
  }

  async checkDatabase(options?: IPCOptions): Promise<IPCResponse<{ connected: boolean; isEmpty: boolean }>> {
    return this.executeWithRetry(() => this.api.checkDatabase(), options);
  }

  async checkAIService(options?: IPCOptions): Promise<IPCResponse<{ available: boolean; model?: string }>> {
    return this.executeWithRetry(() => this.api.checkAIService(), options);
  }

  /**
   * Theme and UI Operations
   */
  async getTheme(options?: IPCOptions): Promise<IPCResponse<'light' | 'dark'>> {
    return this.executeWithRetry(() => this.api.getTheme(), options);
  }

  async setTheme(theme: 'light' | 'dark', options?: IPCOptions): Promise<IPCResponse<void>> {
    return this.executeWithRetry(() => this.api.setTheme(theme), options);
  }

  /**
   * Application Operations
   */
  async getAppVersion(options?: IPCOptions): Promise<IPCResponse<string>> {
    return this.executeWithRetry(() => this.api.getAppVersion(), options);
  }

  /**
   * Event Listeners
   */
  onThemeChanged(callback: (theme: 'light' | 'dark') => void): void {
    this.api.onThemeChanged(callback);
  }

  onWindowStateChanged(callback: (state: any) => void): void {
    this.api.onWindowStateChanged(callback);
  }

  onKBUpdated(callback: (data: any) => void): void {
    this.api.onKBUpdated(callback);
  }

  removeAllListeners(channel: string): void {
    this.api.removeAllListeners(channel);
  }

  /**
   * Utility Methods
   */
  private validateKBEntry(entry: KBEntryInput): void {
    if (!entry.title?.trim()) {
      throw this.createIPCError('INVALID_TITLE', 'Entry title is required', 'VALIDATION_ERROR');
    }
    
    if (!entry.problem?.trim()) {
      throw this.createIPCError('INVALID_PROBLEM', 'Entry problem description is required', 'VALIDATION_ERROR');
    }
    
    if (!entry.solution?.trim()) {
      throw this.createIPCError('INVALID_SOLUTION', 'Entry solution is required', 'VALIDATION_ERROR');
    }
    
    if (!entry.category) {
      throw this.createIPCError('INVALID_CATEGORY', 'Entry category is required', 'VALIDATION_ERROR');
    }

    // Validate title length
    if (entry.title.length > 200) {
      throw this.createIPCError('TITLE_TOO_LONG', 'Title must be 200 characters or less', 'VALIDATION_ERROR');
    }

    // Validate problem and solution length
    if (entry.problem.length > 5000) {
      throw this.createIPCError('PROBLEM_TOO_LONG', 'Problem description must be 5000 characters or less', 'VALIDATION_ERROR');
    }

    if (entry.solution.length > 5000) {
      throw this.createIPCError('SOLUTION_TOO_LONG', 'Solution must be 5000 characters or less', 'VALIDATION_ERROR');
    }
  }

  private createIPCError(code: string, message: string, type: AppErrorType): IPCError {
    const error = new Error(message) as IPCError;
    error.code = code;
    error.type = type;
    error.timestamp = new Date();
    error.retry = type !== 'VALIDATION_ERROR' && type !== 'PERMISSION_ERROR';
    return error;
  }

  private normalizeError(error: any): IPCError {
    if (error.type && error.code) {
      return error as IPCError;
    }

    // Convert generic errors to IPCError
    const ipcError = this.createIPCError(
      error.code || 'UNKNOWN_ERROR',
      error.message || 'An unknown error occurred',
      this.inferErrorType(error)
    );

    return ipcError;
  }

  private inferErrorType(error: any): AppErrorType {
    if (error.message?.includes('timeout')) return 'NETWORK_ERROR';
    if (error.message?.includes('database') || error.message?.includes('sql')) return 'DATABASE_ERROR';
    if (error.message?.includes('ai') || error.message?.includes('gemini')) return 'AI_SERVICE_ERROR';
    if (error.message?.includes('permission') || error.message?.includes('access')) return 'PERMISSION_ERROR';
    if (error.message?.includes('validation') || error.message?.includes('invalid')) return 'VALIDATION_ERROR';
    
    return 'UNKNOWN_ERROR';
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Health check for IPC connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.executeWithRetry(() => this.api.getAppVersion(), { timeout: 1000, retries: 0 });
      return response.success;
    } catch {
      return false;
    }
  }

  /**
   * Get IPC performance stats
   */
  getPerformanceStats(): Record<string, number> {
    // This would be populated by tracking timing data from operations
    return {};
  }
}

// Export singleton instance
export const ipcClient = new IPCClient();
export default ipcClient;