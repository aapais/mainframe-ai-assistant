/**
 * Base Service Abstract Class
 * Provides common functionality for all API services with error handling,
 * caching, and IPC abstraction
 */

import { EventEmitter } from 'events';

export interface ServiceResponse<T = any> {
  data?: T;
  error?: string;
  success: boolean;
  metadata?: {
    timestamp: Date;
    source: 'cache' | 'ipc' | 'fallback';
    processingTime: number;
  };
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  key?: string; // Custom cache key
  skipCache?: boolean;
  refreshCache?: boolean;
}

export interface ServiceOptions {
  timeout?: number;
  retries?: number;
  cacheOptions?: CacheOptions;
}

export abstract class BaseService extends EventEmitter {
  protected cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  protected defaultTimeout = 10000; // 10 seconds
  protected defaultRetries = 3;
  protected serviceName: string;

  constructor(serviceName: string) {
    super();
    this.serviceName = serviceName;
    this.setupCacheCleanup();
  }

  /**
   * Execute IPC call with error handling, caching, and retries
   */
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: ServiceOptions = {}
  ): Promise<ServiceResponse<T>> {
    const startTime = Date.now();
    const { timeout = this.defaultTimeout, retries = this.defaultRetries } = options;
    
    let lastError: Error | undefined;
    let attempts = 0;

    while (attempts <= retries) {
      try {
        // Check cache first
        if (options.cacheOptions && !options.cacheOptions.skipCache) {
          const cached = this.getCachedData<T>(options.cacheOptions.key || 'default');
          if (cached) {
            this.emit('cache-hit', { service: this.serviceName, key: options.cacheOptions.key });
            return {
              data: cached,
              success: true,
              metadata: {
                timestamp: new Date(),
                source: 'cache',
                processingTime: Date.now() - startTime,
              },
            };
          }
        }

        // Execute operation with timeout
        const data = await this.withTimeout(operation(), timeout);
        
        // Cache successful results
        if (options.cacheOptions && data) {
          this.setCachedData(
            options.cacheOptions.key || 'default',
            data,
            options.cacheOptions.ttl || 300000 // 5 minutes default
          );
        }

        this.emit('operation-success', { 
          service: this.serviceName, 
          attempts: attempts + 1,
          processingTime: Date.now() - startTime,
        });

        return {
          data,
          success: true,
          metadata: {
            timestamp: new Date(),
            source: 'ipc',
            processingTime: Date.now() - startTime,
          },
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempts++;
        
        this.emit('operation-error', {
          service: this.serviceName,
          attempt: attempts,
          error: lastError.message,
        });

        // Don't retry on certain errors
        if (this.isNonRetryableError(lastError) || attempts > retries) {
          break;
        }

        // Wait before retry (exponential backoff)
        await this.delay(Math.pow(2, attempts - 1) * 1000);
      }
    }

    // Return error response
    return {
      error: lastError?.message || 'Operation failed',
      success: false,
      metadata: {
        timestamp: new Date(),
        source: 'fallback',
        processingTime: Date.now() - startTime,
      },
    };
  }

  /**
   * Wrap promise with timeout
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  /**
   * Determine if error should not trigger retry
   */
  private isNonRetryableError(error: Error): boolean {
    const nonRetryableMessages = [
      'validation',
      'unauthorized',
      'forbidden',
      'not found',
      'bad request',
    ];
    
    return nonRetryableMessages.some(msg => 
      error.message.toLowerCase().includes(msg)
    );
  }

  /**
   * Cache management
   */
  protected getCachedData<T>(key: string): T | null {
    const cached = this.cache.get(`${this.serviceName}:${key}`);
    
    if (!cached) {
      return null;
    }
    
    if (Date.now() > cached.timestamp + cached.ttl) {
      this.cache.delete(`${this.serviceName}:${key}`);
      return null;
    }
    
    return cached.data as T;
  }

  protected setCachedData<T>(key: string, data: T, ttl: number): void {
    this.cache.set(`${this.serviceName}:${key}`, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Clear cache for this service
   */
  public clearCache(): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${this.serviceName}:`)) {
        this.cache.delete(key);
      }
    }
    this.emit('cache-cleared', { service: this.serviceName });
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; keys: string[] } {
    const keys = Array.from(this.cache.keys())
      .filter(key => key.startsWith(`${this.serviceName}:`));
    
    return {
      size: keys.length,
      keys: keys.map(key => key.substring(this.serviceName.length + 1)),
    };
  }

  /**
   * Setup automatic cache cleanup
   */
  private setupCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.cache.entries()) {
        if (key.startsWith(`${this.serviceName}:`) && now > value.timestamp + value.ttl) {
          this.cache.delete(key);
        }
      }
    }, 60000); // Cleanup every minute
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if Electron API is available
   */
  protected isElectronAPIAvailable(): boolean {
    return typeof window !== 'undefined' && 
           window.electronAPI !== undefined;
  }

  /**
   * Get Electron API with type safety
   */
  protected getElectronAPI() {
    if (!this.isElectronAPIAvailable()) {
      throw new Error('Electron API not available');
    }
    return window.electronAPI;
  }

  /**
   * Abstract method for health check
   */
  public abstract healthCheck(): Promise<ServiceResponse<{ healthy: boolean; message?: string }>>;

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.clearCache();
    this.removeAllListeners();
  }
}