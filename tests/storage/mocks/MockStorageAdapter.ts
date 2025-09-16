/**
 * Mock Storage Adapter for Testing
 * Provides in-memory implementation of IStorageAdapter for unit tests
 */

import { IStorageAdapter, DatabaseConfig, DatabaseMetrics, OptimizationResult } from '../../../src/services/storage/IStorageService';
import { KBEntry, KBEntryInput, KBEntryUpdate, SearchResult, SearchOptions } from '../../../src/services/types';
import { v4 as uuidv4 } from 'uuid';

export class MockStorageAdapter implements IStorageAdapter {
  private entries: Map<string, KBEntry> = new Map();
  private isConnected = false;
  private operationDelay = 0;

  // Test control flags
  public shouldFailInitialize = false;
  public shouldFailBatch = false;
  public duplicateDetection = false;
  public returnNull = false;
  public emptyResults = false;
  public throwOnDelete = false;
  public throwOnNextOperation = false;
  public simulateSlowOperation = false;

  // Spy methods for testing
  public addEntry = jest.fn().mockImplementation(this._addEntry.bind(this));
  public getEntry = jest.fn().mockImplementation(this._getEntry.bind(this));
  public updateEntry = jest.fn().mockImplementation(this._updateEntry.bind(this));
  public deleteEntry = jest.fn().mockImplementation(this._deleteEntry.bind(this));
  public search = jest.fn().mockImplementation(this._search.bind(this));
  public searchSimilar = jest.fn().mockImplementation(this._searchSimilar.bind(this));
  public batchInsert = jest.fn().mockImplementation(this._batchInsert.bind(this));
  public batchUpdate = jest.fn().mockImplementation(this._batchUpdate.bind(this));
  public batchDelete = jest.fn().mockImplementation(this._batchDelete.bind(this));
  public query = jest.fn().mockImplementation(this._query.bind(this));
  public transaction = jest.fn().mockImplementation(this._transaction.bind(this));
  public vacuum = jest.fn().mockImplementation(this._vacuum.bind(this));
  public analyze = jest.fn().mockImplementation(this._analyze.bind(this));
  public rebuildIndexes = jest.fn().mockImplementation(this._rebuildIndexes.bind(this));
  public clearCache = jest.fn().mockImplementation(this._clearCache.bind(this));
  public getMetrics = jest.fn().mockImplementation(this._getMetrics.bind(this));
  public close = jest.fn().mockImplementation(this._close.bind(this));

  constructor(options?: { delay?: number }) {
    this.operationDelay = options?.delay || 0;
  }

  async initialize(config: DatabaseConfig): Promise<void> {
    if (this.shouldFailInitialize) {
      throw new Error('Mock adapter initialization failed');
    }
    
    await this.delay();
    this.isConnected = true;
  }

  // ========================
  // CRUD Operations
  // ========================

  private async _addEntry(entryInput: KBEntryInput): Promise<KBEntry> {
    await this.checkThrowOnNextOperation();
    await this.delay();

    if (this.duplicateDetection) {
      throw new Error('Duplicate entry detected');
    }

    const id = uuidv4();
    const now = new Date();
    
    const entry: KBEntry = {
      id,
      title: entryInput.title,
      problem: entryInput.problem,
      solution: entryInput.solution,
      category: entryInput.category,
      tags: entryInput.tags || [],
      created_at: now,
      updated_at: now,
      usage_count: 0,
      success_count: 0,
      failure_count: 0,
      created_by: 'test-user'
    };

    this.entries.set(id, entry);
    return entry;
  }

  private async _getEntry(id: string): Promise<KBEntry | null> {
    await this.checkThrowOnNextOperation();
    await this.delay();

    if (this.returnNull) {
      return null;
    }

    return this.entries.get(id) || null;
  }

  private async _updateEntry(id: string, updateData: KBEntryUpdate): Promise<KBEntry | null> {
    await this.checkThrowOnNextOperation();
    await this.delay();

    const existing = this.entries.get(id);
    if (!existing) {
      return null;
    }

    const updated: KBEntry = {
      ...existing,
      ...updateData,
      updated_at: new Date()
    };

    this.entries.set(id, updated);
    return updated;
  }

  private async _deleteEntry(id: string): Promise<void> {
    await this.checkThrowOnNextOperation();
    await this.delay();

    if (this.throwOnDelete) {
      throw new Error('Delete operation failed');
    }

    this.entries.delete(id);
  }

  // ========================
  // Search Operations
  // ========================

  private async _search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    await this.checkThrowOnNextOperation();
    await this.delay();

    if (this.emptyResults) {
      return [];
    }

    // Simple mock search implementation
    const results: SearchResult[] = [];
    const entries = Array.from(this.entries.values());

    for (const entry of entries) {
      let score = 0;
      const searchText = `${entry.title} ${entry.problem} ${entry.solution}`.toLowerCase();
      const queryLower = query.toLowerCase();

      // Simple text matching
      if (searchText.includes(queryLower)) {
        score = queryLower.length / searchText.length;
      }

      // Apply filters
      if (options.filters) {
        if (options.filters.category && entry.category !== options.filters.category) {
          continue;
        }
        if (options.filters.tags && !options.filters.tags.some(tag => entry.tags?.includes(tag))) {
          continue;
        }
      }

      if (score > 0) {
        results.push({
          entry,
          score,
          metadata: { method: 'mock' }
        });
      }
    }

    // Sort by score (descending)
    results.sort((a, b) => b.score - a.score);

    // Apply pagination
    const start = options.offset || 0;
    const end = start + (options.limit || 10);
    
    return results.slice(start, end);
  }

  private async _searchSimilar(entryId: string, options: any = {}): Promise<SearchResult[]> {
    await this.checkThrowOnNextOperation();
    await this.delay();

    const targetEntry = this.entries.get(entryId);
    if (!targetEntry) {
      return [];
    }

    // Simple similarity based on category and tags
    const results: SearchResult[] = [];
    const entries = Array.from(this.entries.values());

    for (const entry of entries) {
      if (entry.id === entryId) continue;

      let similarity = 0;
      
      // Category similarity
      if (entry.category === targetEntry.category) {
        similarity += 0.3;
      }

      // Tag similarity
      const commonTags = entry.tags?.filter(tag => targetEntry.tags?.includes(tag)) || [];
      similarity += (commonTags.length / Math.max(entry.tags?.length || 1, targetEntry.tags?.length || 1)) * 0.7;

      if (similarity >= (options.threshold || 0.1)) {
        results.push({
          entry,
          score: similarity,
          metadata: { method: 'similarity', commonTags }
        });
      }
    }

    // Sort by similarity (descending)
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, options.limit || 10);
  }

  // ========================
  // Batch Operations
  // ========================

  private async _batchInsert(entries: KBEntryInput[]): Promise<KBEntry[]> {
    await this.checkThrowOnNextOperation();
    await this.delay();

    if (this.shouldFailBatch) {
      throw new Error('Batch operation failed');
    }

    const results: KBEntry[] = [];
    for (const entryInput of entries) {
      const entry = await this._addEntry(entryInput);
      results.push(entry);
    }

    return results;
  }

  private async _batchUpdate(updates: Array<{ id: string; data: KBEntryUpdate }>): Promise<KBEntry[]> {
    await this.checkThrowOnNextOperation();
    await this.delay();

    const results: KBEntry[] = [];
    for (const update of updates) {
      const entry = await this._updateEntry(update.id, update.data);
      if (entry) {
        results.push(entry);
      }
    }

    return results;
  }

  private async _batchDelete(ids: string[]): Promise<void> {
    await this.checkThrowOnNextOperation();
    await this.delay();

    for (const id of ids) {
      await this._deleteEntry(id);
    }
  }

  // ========================
  // Database Operations
  // ========================

  private async _query(sql: string, params?: any[]): Promise<any[]> {
    await this.checkThrowOnNextOperation();
    await this.delay();

    // Mock query responses for common queries
    if (sql.includes('COUNT(*)')) {
      return [{ count: this.entries.size }];
    }

    if (sql.includes('sqlite_master')) {
      return [
        { name: 'kb_entries' },
        { name: 'kb_tags' },
        { name: 'usage_metrics' },
        { name: 'search_history' }
      ];
    }

    if (sql.includes('PRAGMA journal_mode')) {
      return [{ journal_mode: 'wal' }];
    }

    if (sql.includes('PRAGMA foreign_keys')) {
      return [{ foreign_keys: 1 }];
    }

    // Default response
    return [];
  }

  private async _transaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    await this.checkThrowOnNextOperation();
    await this.delay();

    // Simple transaction simulation - just execute the callback
    // In a real implementation, this would handle rollback on error
    return await callback(this);
  }

  // ========================
  // Maintenance Operations
  // ========================

  private async _vacuum(): Promise<void> {
    await this.delay();
    // Mock vacuum operation
  }

  private async _analyze(): Promise<OptimizationResult> {
    await this.delay();
    
    return {
      performance: {
        averageQueryTime: 10,
        slowQueries: [],
        indexUsage: {}
      },
      storage: {
        size: this.entries.size * 1000, // Mock size calculation
        fragmentation: 0.1,
        wastedSpace: 100
      },
      recommendations: [
        'Consider rebuilding indexes',
        'Database is in good health'
      ]
    };
  }

  private async _rebuildIndexes(): Promise<void> {
    await this.delay();
    // Mock index rebuild
  }

  private async _clearCache(): Promise<void> {
    await this.delay();
    // Mock cache clearing
  }

  private async _getMetrics(): Promise<DatabaseMetrics> {
    await this.delay();
    
    return {
      totalEntries: this.entries.size,
      totalTags: Array.from(this.entries.values()).reduce((sum, entry) => sum + (entry.tags?.length || 0), 0),
      averageEntriesPerCategory: this.entries.size / 5, // Assuming 5 categories
      searchesLastHour: 100,
      searchesLastDay: 1000,
      mostSearchedTerms: ['VSAM', 'JCL', 'DB2'],
      performance: {
        averageResponseTime: 50,
        slowestQueries: [],
        cacheHitRate: 0.85
      },
      storage: {
        size: this.entries.size * 1000,
        growth: 0.1,
        lastBackup: new Date()
      }
    };
  }

  private async _close(): Promise<void> {
    await this.delay();
    this.isConnected = false;
    this.entries.clear();
  }

  // ========================
  // Test Utilities
  // ========================

  private async delay(): Promise<void> {
    if (this.operationDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.operationDelay));
    }

    if (this.simulateSlowOperation) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private async checkThrowOnNextOperation(): Promise<void> {
    if (this.throwOnNextOperation) {
      this.throwOnNextOperation = false;
      throw new Error('Mock operation failed');
    }
  }

  // ========================
  // Test State Management
  // ========================

  public reset(): void {
    this.entries.clear();
    this.shouldFailInitialize = false;
    this.shouldFailBatch = false;
    this.duplicateDetection = false;
    this.returnNull = false;
    this.emptyResults = false;
    this.throwOnDelete = false;
    this.throwOnNextOperation = false;
    this.simulateSlowOperation = false;
    jest.clearAllMocks();
  }

  public getEntryCount(): number {
    return this.entries.size;
  }

  public hasEntry(id: string): boolean {
    return this.entries.has(id);
  }

  public getAllEntries(): KBEntry[] {
    return Array.from(this.entries.values());
  }

  public setEntries(entries: KBEntry[]): void {
    this.entries.clear();
    entries.forEach(entry => {
      if (entry.id) {
        this.entries.set(entry.id, entry);
      }
    });
  }
}

// Mock Jest implementation for environments where jest is not available
if (typeof jest === 'undefined') {
  (global as any).jest = {
    fn: () => ({
      mockImplementation: (impl: Function) => impl,
      mockReturnValue: (value: any) => () => value,
      mockRejectedValue: (error: Error) => () => Promise.reject(error),
      mockRejectedValueOnce: (error: Error) => () => Promise.reject(error)
    })
  };
}