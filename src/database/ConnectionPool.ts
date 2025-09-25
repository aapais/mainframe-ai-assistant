/**
 * SQLite Connection Pool for High-Performance Concurrent Access
 *
 * Manages multiple SQLite connections for read operations while maintaining
 * single-writer semantics for data consistency.
 */

import Database from 'better-sqlite3';
import { EventEmitter } from 'events';

export interface PoolConfig {
  maxReaders: number;
  maxWriters: number;
  acquireTimeout: number;
  idleTimeout: number;
  maxLifetime: number;
  validateConnection: boolean;
  enableWAL: boolean;
}

export interface PoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  totalAcquired: number;
  totalReleased: number;
  averageAcquireTime: number;
  peakConnections: number;
}

interface PoolConnection {
  db: Database.Database;
  id: string;
  type: 'reader' | 'writer';
  createdAt: number;
  lastUsed: number;
  inUse: boolean;
  transactionDepth: number;
  queryCount: number;
}

interface WaitingRequest {
  type: 'reader' | 'writer';
  resolve: (connection: PoolConnection) => void;
  reject: (error: Error) => void;
  requestTime: number;
  timeout: ReturnType<typeof setTimeout>;
}

export class ConnectionPool extends EventEmitter {
  private dbPath: string;
  private config: PoolConfig;
  private connections: Map<string, PoolConnection> = new Map();
  private waitingQueue: WaitingRequest[] = [];
  private stats = {
    totalAcquired: 0,
    totalReleased: 0,
    totalAcquireTime: 0,
    peakConnections: 0,
  };
  private maintenanceTimer?: ReturnType<typeof setTimeout>;

  constructor(dbPath: string, config?: Partial<PoolConfig>) {
    super();

    this.dbPath = dbPath;
    this.config = {
      maxReaders: 5,
      maxWriters: 1,
      acquireTimeout: 30000, // 30 seconds
      idleTimeout: 300000, // 5 minutes
      maxLifetime: 3600000, // 1 hour
      validateConnection: true,
      enableWAL: true,
      ...config,
    };

    this.initializePool();
    this.startMaintenance();
  }

  /**
   * Initialize the connection pool
   */
  private initializePool(): void {
    console.log('🏊 Initializing SQLite connection pool...');

    try {
      // Create initial writer connection
      this.createConnection('writer');

      // Create initial reader connections
      const initialReaders = Math.min(2, this.config.maxReaders);
      for (let i = 0; i < initialReaders; i++) {
        this.createConnection('reader');
      }

      console.log(`✅ Connection pool initialized with ${this.connections.size} connections`);
      console.log(
        `📊 Pool config: ${this.config.maxReaders} readers, ${this.config.maxWriters} writers`
      );
    } catch (error) {
      console.error('❌ Failed to initialize connection pool:', error);
      throw error;
    }
  }

  /**
   * Create a new connection with optimized settings
   */
  private createConnection(type: 'reader' | 'writer'): PoolConnection {
    const connectionId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      const db = new Database(this.dbPath, {
        readonly: type === 'reader',
        fileMustExist: true,
      });

      // Apply optimized pragmas
      this.configureConnection(db, type);

      const connection: PoolConnection = {
        db,
        id: connectionId,
        type,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        inUse: false,
        transactionDepth: 0,
        queryCount: 0,
      };

      this.connections.set(connectionId, connection);

      // Update peak connections stat
      if (this.connections.size > this.stats.peakConnections) {
        this.stats.peakConnections = this.connections.size;
      }

      console.log(`✅ Created ${type} connection: ${connectionId}`);
      this.emit('connectionCreated', { type, id: connectionId });

      return connection;
    } catch (error) {
      console.error(`❌ Failed to create ${type} connection:`, error);
      throw error;
    }
  }

  /**
   * Configure connection with optimal settings for search performance
   * Enhanced for 1000+ entries with sophisticated caching and memory management
   */
  private configureConnection(db: Database.Database, type: 'reader' | 'writer'): void {
    try {
      // Enable WAL mode for better concurrency
      if (this.config.enableWAL && type === 'writer') {
        db.pragma('journal_mode = WAL');
        db.pragma('wal_autocheckpoint = 100'); // Checkpoint every 100 pages
        db.pragma('wal_checkpoint(TRUNCATE)'); // Aggressive checkpointing
      }

      // Optimize for read performance (search-focused)
      if (type === 'reader') {
        db.pragma('query_only = ON');
        db.pragma('cache_size = -64000'); // 64MB cache per reader (increased for large datasets)
        db.pragma('temp_store = MEMORY');
        db.pragma('mmap_size = 268435456'); // 256MB mmap (doubled for better I/O)

        // Search-specific optimizations
        db.pragma('cache_spill = OFF'); // Keep everything in memory cache
        db.pragma('page_size = 4096'); // Optimal page size for search workloads
        db.pragma('lookaside = 1024,128'); // Larger lookaside buffer for frequent allocations

        // FTS optimizations
        db.pragma('secure_delete = OFF'); // Faster deletes for FTS maintenance
        db.pragma('auto_vacuum = INCREMENTAL'); // Better space management
      } else {
        // Writer configuration
        db.pragma('cache_size = -128000'); // 128MB cache for writer (supports bulk operations)
        db.pragma('synchronous = NORMAL');
        db.pragma('temp_store = MEMORY');
        db.pragma('foreign_keys = ON');

        // Write performance optimizations
        db.pragma('busy_timeout = 30000'); // 30 second busy timeout
        db.pragma('journal_size_limit = 67108864'); // 64MB journal limit
      }

      // Advanced shared optimizations for large datasets
      db.pragma('threads = 4'); // Enable multi-threading for complex queries
      db.pragma('analysis_limit = 1000'); // Limit analysis for better performance

      // Memory optimizations for 1000+ entries
      db.function('log', Math.log); // Register math functions for calculated indexes
      db.function('pow', Math.pow);

      // Pre-compile frequently used prepared statements
      this.precompileSearchStatements(db, type);

      // Run optimization
      db.pragma('optimize');

      console.log(`✅ Optimized ${type} connection for search performance`);
    } catch (error) {
      console.error('Error configuring connection:', error);
    }
  }

  /**
   * Pre-compile frequently used search statements for better performance
   */
  private precompileSearchStatements(db: Database.Database, type: 'reader' | 'writer'): void {
    if (type !== 'reader') return;

    try {
      // Pre-compile common search patterns to avoid compilation overhead
      const commonStatements = [
        // Category search
        `SELECT e.id, e.title, e.category, e.usage_count 
         FROM kb_entries e WHERE e.category = ? AND e.archived = FALSE 
         ORDER BY e.usage_count DESC LIMIT ?`,

        // FTS search
        `SELECT e.id, e.title, bm25(kb_fts) as score 
         FROM kb_fts f JOIN kb_entries e ON f.id = e.id 
         WHERE kb_fts MATCH ? AND e.archived = FALSE 
         ORDER BY score LIMIT ?`,

        // Popular entries
        `SELECT e.id, e.title, e.usage_count 
         FROM kb_entries e WHERE e.archived = FALSE 
         ORDER BY e.usage_count DESC, e.success_count DESC LIMIT ?`,

        // Recent entries
        `SELECT e.id, e.title, e.created_at 
         FROM kb_entries e WHERE e.archived = FALSE 
         ORDER BY e.created_at DESC LIMIT ?`,
      ];

      // Prepare and cache statements
      commonStatements.forEach((sql, index) => {
        try {
          const stmt = db.prepare(sql);
          // Store reference for potential reuse
          (db as any)[`_precompiled_${index}`] = stmt;
        } catch (error) {
          console.warn(`Failed to precompile statement ${index}:`, error);
        }
      });
    } catch (error) {
      console.error('Error precompiling search statements:', error);
    }
  }

  /**
   * Acquire a connection from the pool
   */
  async acquireConnection(type: 'reader' | 'writer' = 'reader'): Promise<PoolConnection> {
    const startTime = Date.now();

    return new Promise<PoolConnection>((resolve, reject) => {
      // Try to get an available connection immediately
      const connection = this.getAvailableConnection(type);
      if (connection) {
        this.markConnectionInUse(connection);
        this.updateAcquireStats(Date.now() - startTime);
        resolve(connection);
        return;
      }

      // Try to create a new connection if under limits
      if (this.canCreateConnection(type)) {
        try {
          const newConnection = this.createConnection(type);
          this.markConnectionInUse(newConnection);
          this.updateAcquireStats(Date.now() - startTime);
          resolve(newConnection);
          return;
        } catch (error) {
          reject(error);
          return;
        }
      }

      // Queue the request
      const timeout = setTimeout(() => {
        const index = this.waitingQueue.findIndex(req => req.resolve === resolve);
        if (index !== -1) {
          this.waitingQueue.splice(index, 1);
          reject(new Error(`Connection acquire timeout after ${this.config.acquireTimeout}ms`));
        }
      }, this.config.acquireTimeout);

      this.waitingQueue.push({
        type,
        resolve,
        reject,
        requestTime: startTime,
        timeout,
      });

      this.emit('connectionWaiting', { type, queueLength: this.waitingQueue.length });
    });
  }

  /**
   * Release a connection back to the pool
   */
  releaseConnection(connection: PoolConnection): void {
    if (!this.connections.has(connection.id)) {
      console.warn('Attempting to release unknown connection:', connection.id);
      return;
    }

    // Reset connection state
    connection.inUse = false;
    connection.lastUsed = Date.now();
    connection.transactionDepth = 0;

    this.stats.totalReleased++;

    // Process waiting requests
    this.processWaitingQueue();

    this.emit('connectionReleased', { id: connection.id, type: connection.type });
  }

  /**
   * Execute a query with automatic connection management
   */
  async executeQuery<T = any>(
    sql: string,
    params: any[] = [],
    type: 'reader' | 'writer' = 'reader'
  ): Promise<T> {
    const connection = await this.acquireConnection(type);

    try {
      connection.queryCount++;

      // Validate connection if enabled
      if (this.config.validateConnection) {
        this.validateConnection(connection);
      }

      // Execute query based on expected result type
      let result: any;

      if (sql.trim().toLowerCase().startsWith('select')) {
        // For SELECT queries, use .all() or .get() based on expected results
        const stmt = connection.db.prepare(sql);
        result = params.length > 0 ? stmt.all(...params) : stmt.all();
      } else {
        // For INSERT/UPDATE/DELETE, use .run()
        const stmt = connection.db.prepare(sql);
        result = params.length > 0 ? stmt.run(...params) : stmt.run();
      }

      return result;
    } catch (error) {
      console.error('Query execution error:', error);
      throw error;
    } finally {
      this.releaseConnection(connection);
    }
  }

  /**
   * Execute multiple queries in a transaction
   */
  async executeTransaction<T = any>(
    queries: Array<{ sql: string; params?: any[] }>,
    type: 'reader' | 'writer' = 'writer'
  ): Promise<T[]> {
    const connection = await this.acquireConnection(type);

    try {
      const results: T[] = [];

      // Begin transaction
      connection.db.exec('BEGIN TRANSACTION');
      connection.transactionDepth++;

      for (const query of queries) {
        const stmt = connection.db.prepare(query.sql);
        const result = query.params ? stmt.run(...query.params) : stmt.run();
        results.push(result as T);
        connection.queryCount++;
      }

      // Commit transaction
      connection.db.exec('COMMIT');
      connection.transactionDepth--;

      return results;
    } catch (error) {
      // Rollback on error
      try {
        connection.db.exec('ROLLBACK');
        connection.transactionDepth--;
      } catch (rollbackError) {
        console.error('Rollback error:', rollbackError);
      }

      console.error('Transaction error:', error);
      throw error;
    } finally {
      this.releaseConnection(connection);
    }
  }

  /**
   * Get an available connection of the specified type
   */
  private getAvailableConnection(type: 'reader' | 'writer'): PoolConnection | null {
    for (const connection of this.connections.values()) {
      if (connection.type === type && !connection.inUse) {
        return connection;
      }
    }
    return null;
  }

  /**
   * Check if we can create a new connection
   */
  private canCreateConnection(type: 'reader' | 'writer'): boolean {
    const currentConnections = Array.from(this.connections.values());
    const currentTypeCount = currentConnections.filter(c => c.type === type).length;

    const maxAllowed = type === 'reader' ? this.config.maxReaders : this.config.maxWriters;

    return currentTypeCount < maxAllowed;
  }

  /**
   * Mark connection as in use
   */
  private markConnectionInUse(connection: PoolConnection): void {
    connection.inUse = true;
    connection.lastUsed = Date.now();
    this.stats.totalAcquired++;
  }

  /**
   * Process the waiting queue
   */
  private processWaitingQueue(): void {
    while (this.waitingQueue.length > 0) {
      const request = this.waitingQueue[0];
      const connection = this.getAvailableConnection(request.type);

      if (!connection && !this.canCreateConnection(request.type)) {
        break; // No available connections and can't create new ones
      }

      // Remove request from queue
      this.waitingQueue.shift();
      clearTimeout(request.timeout);

      try {
        let connectionToUse: PoolConnection;

        if (connection) {
          connectionToUse = connection;
        } else {
          connectionToUse = this.createConnection(request.type);
        }

        this.markConnectionInUse(connectionToUse);
        this.updateAcquireStats(Date.now() - request.requestTime);
        request.resolve(connectionToUse);
      } catch (error) {
        request.reject(error);
      }
    }
  }

  /**
   * Validate connection is still working
   */
  private validateConnection(connection: PoolConnection): void {
    try {
      connection.db.prepare('SELECT 1').get();
    } catch (error) {
      console.error(`Connection ${connection.id} validation failed:`, error);
      this.removeConnection(connection.id);
      throw new Error('Connection validation failed');
    }
  }

  /**
   * Remove a connection from the pool
   */
  private removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      try {
        connection.db.close();
      } catch (error) {
        console.error(`Error closing connection ${connectionId}:`, error);
      }

      this.connections.delete(connectionId);
      this.emit('connectionRemoved', { id: connectionId, type: connection.type });

      console.log(`🗑️ Removed connection: ${connectionId}`);
    }
  }

  /**
   * Update acquire time statistics
   */
  private updateAcquireStats(acquireTime: number): void {
    this.stats.totalAcquireTime += acquireTime;
  }

  /**
   * Start maintenance tasks
   */
  private startMaintenance(): void {
    this.maintenanceTimer = setInterval(() => {
      this.performMaintenance();
    }, 60000); // Every minute

    console.log('⏰ Connection pool maintenance started');
  }

  /**
   * Perform connection pool maintenance
   */
  private performMaintenance(): void {
    const now = Date.now();
    const connectionsToRemove: string[] = [];

    for (const [id, connection] of this.connections) {
      const age = now - connection.createdAt;
      const idleTime = now - connection.lastUsed;

      // Remove connections that are too old
      if (age > this.config.maxLifetime) {
        if (!connection.inUse) {
          connectionsToRemove.push(id);
          console.log(`🕒 Removing aged connection: ${id} (age: ${age}ms)`);
        }
        continue;
      }

      // Remove idle connections (but keep minimum)
      if (idleTime > this.config.idleTimeout && !connection.inUse) {
        const sameTypeConnections = Array.from(this.connections.values()).filter(
          c => c.type === connection.type && c.id !== id
        );

        const minConnections = connection.type === 'reader' ? 1 : 1;

        if (sameTypeConnections.length >= minConnections) {
          connectionsToRemove.push(id);
          console.log(`💤 Removing idle connection: ${id} (idle: ${idleTime}ms)`);
        }
      }
    }

    // Remove identified connections
    connectionsToRemove.forEach(id => this.removeConnection(id));

    // Log maintenance summary
    if (connectionsToRemove.length > 0) {
      console.log(`🧹 Pool maintenance: removed ${connectionsToRemove.length} connections`);
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    const connections = Array.from(this.connections.values());
    const activeConnections = connections.filter(c => c.inUse).length;
    const idleConnections = connections.filter(c => !c.inUse).length;

    const totalOperations = this.stats.totalAcquired;
    const avgAcquireTime = totalOperations > 0 ? this.stats.totalAcquireTime / totalOperations : 0;

    return {
      totalConnections: this.connections.size,
      activeConnections,
      idleConnections,
      waitingRequests: this.waitingQueue.length,
      totalAcquired: this.stats.totalAcquired,
      totalReleased: this.stats.totalReleased,
      averageAcquireTime: Math.round(avgAcquireTime),
      peakConnections: this.stats.peakConnections,
    };
  }

  /**
   * Gracefully close all connections
   */
  async close(): Promise<void> {
    console.log('🔌 Closing connection pool...');

    // Clear maintenance timer
    if (this.maintenanceTimer) {
      clearInterval(this.maintenanceTimer);
    }

    // Reject all waiting requests
    this.waitingQueue.forEach(request => {
      clearTimeout(request.timeout);
      request.reject(new Error('Connection pool is closing'));
    });
    this.waitingQueue.length = 0;

    // Close all connections
    const closePromises = Array.from(this.connections.values()).map(async connection => {
      try {
        if (connection.inUse) {
          console.warn(`Forcibly closing in-use connection: ${connection.id}`);
        }
        connection.db.close();
      } catch (error) {
        console.error(`Error closing connection ${connection.id}:`, error);
      }
    });

    await Promise.all(closePromises);
    this.connections.clear();

    console.log('✅ Connection pool closed');
  }

  /**
   * Health check for the pool
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    stats: PoolStats;
  }> {
    const issues: string[] = [];
    const stats = this.getStats();

    // Check if we have minimum connections
    if (stats.totalConnections === 0) {
      issues.push('No connections available');
    }

    // Check for high wait times
    if (stats.averageAcquireTime > 1000) {
      issues.push(`High average acquire time: ${stats.averageAcquireTime}ms`);
    }

    // Check for many waiting requests
    if (stats.waitingRequests > 10) {
      issues.push(`High number of waiting requests: ${stats.waitingRequests}`);
    }

    // Test connection functionality
    try {
      const connection = await this.acquireConnection('reader');
      try {
        connection.db.prepare('SELECT 1 as test').get();
      } finally {
        this.releaseConnection(connection);
      }
    } catch (error) {
      issues.push(`Connection test failed: ${error.message}`);
    }

    return {
      healthy: issues.length === 0,
      issues,
      stats,
    };
  }
}
