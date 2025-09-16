/**
 * Database Connection Pool for SQLite
 * Manages connection lifecycle, health checking, and metrics
 */

import Database from 'better-sqlite3';
import { EventEmitter } from 'events';
import * as path from 'path';

export interface ConnectionConfig {
  database?: string;
  readonly?: boolean;
  timeout?: number;
  verbose?: boolean;
}

export interface PoolConfig {
  maxConnections: number;
  minConnections?: number;
  idleTimeout: number; // ms
  checkInterval: number; // ms
  connectionTimeout?: number; // ms
  enableMetrics?: boolean;
  defaultDatabase?: string;
}

export interface Connection {
  id: string;
  db: Database.Database;
  created: Date;
  lastUsed: Date;
  inUse: boolean;
  queryCount: number;
  config: ConnectionConfig;
}

export interface PoolMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  totalQueries: number;
  avgQueryTime: number;
  connectionErrors: number;
  lastCleanup: Date;
}

export interface PoolHealth {
  healthy: boolean;
  connections: {
    total: number;
    healthy: number;
    unhealthy: number;
  };
  errors: string[];
}

const DEFAULT_POOL_CONFIG: PoolConfig = {
  maxConnections: 10,
  minConnections: 2,
  idleTimeout: 300000, // 5 minutes
  checkInterval: 60000, // 1 minute
  connectionTimeout: 30000, // 30 seconds
  enableMetrics: true,
  defaultDatabase: ':memory:'
};

export class ConnectionPool extends EventEmitter {
  private config: PoolConfig;
  private connections = new Map<string, Connection>();
  private waitingQueue: Array<{
    resolve: (connection: Connection) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = [];
  
  private cleanupInterval?: NodeJS.Timeout;
  private metrics: PoolMetrics = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    totalQueries: 0,
    avgQueryTime: 0,
    connectionErrors: 0,
    lastCleanup: new Date()
  };
  
  private queryTimes: number[] = [];
  private isInitialized = false;
  private isShuttingDown = false;

  constructor(config: Partial<PoolConfig> = {}) {
    super();
    this.config = { ...DEFAULT_POOL_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Create minimum connections
    const minConnections = this.config.minConnections || 0;
    for (let i = 0; i < minConnections; i++) {
      try {
        await this.createConnection();
      } catch (error) {
        console.error('Failed to create initial connection:', error);
      }
    }

    // Start cleanup interval
    this.startCleanup();
    
    this.isInitialized = true;
    this.emit('pool:initialized', {
      connections: this.connections.size,
      config: this.config
    });
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    
    this.isShuttingDown = true;
    
    // Stop cleanup
    this.stopCleanup();
    
    // Reject all waiting requests
    this.waitingQueue.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error('Connection pool is shutting down'));
    });
    this.waitingQueue.length = 0;
    
    // Close all connections
    const closePromises = Array.from(this.connections.values()).map(conn => 
      this.closeConnection(conn.id)
    );
    
    await Promise.allSettled(closePromises);
    
    this.connections.clear();
    this.emit('pool:shutdown');
  }

  // ========================
  // Connection Management
  // ========================

  async getConnection(config: ConnectionConfig = {}): Promise<Connection> {
    if (this.isShuttingDown) {
      throw new Error('Connection pool is shutting down');
    }

    // Try to get an available connection
    const availableConnection = this.findAvailableConnection(config);
    if (availableConnection) {
      this.markConnectionInUse(availableConnection);
      return availableConnection;
    }

    // Create new connection if under limit
    if (this.connections.size < this.config.maxConnections) {
      try {
        const newConnection = await this.createConnection(config);
        this.markConnectionInUse(newConnection);
        return newConnection;
      } catch (error) {
        this.metrics.connectionErrors++;
        throw error;
      }
    }

    // Wait for an available connection
    return this.waitForConnection(config);
  }

  releaseConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.inUse = false;
    connection.lastUsed = new Date();
    this.updateMetrics();

    // Process waiting queue
    this.processWaitingQueue();
    
    this.emit('connection:released', { connectionId, queryCount: connection.queryCount });
  }

  async executeQuery<T = any>(
    query: string, 
    params: any[] = [], 
    config: ConnectionConfig = {}
  ): Promise<T> {
    const startTime = Date.now();
    let connection: Connection | null = null;

    try {
      connection = await this.getConnection(config);
      
      // Execute query
      let result;
      if (query.trim().toUpperCase().startsWith('SELECT')) {
        result = connection.db.prepare(query).all(...params);
      } else {
        result = connection.db.prepare(query).run(...params);
      }
      
      // Update metrics
      connection.queryCount++;
      this.metrics.totalQueries++;
      
      const queryTime = Date.now() - startTime;
      this.recordQueryTime(queryTime);
      
      return result as T;
      
    } catch (error) {
      this.metrics.connectionErrors++;
      throw error;
    } finally {
      if (connection) {
        this.releaseConnection(connection.id);
      }
    }
  }

  private async createConnection(config: ConnectionConfig = {}): Promise<Connection> {
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const dbPath = config.database || this.config.defaultDatabase || ':memory:';
      const options = {
        readonly: config.readonly || false,
        timeout: config.timeout || this.config.connectionTimeout || 30000,
        verbose: config.verbose
      };
      
      const db = new Database(dbPath, options);
      
      // Configure database
      db.pragma('journal_mode = WAL');
      db.pragma('synchronous = NORMAL');
      db.pragma('cache_size = 1000');
      db.pragma('temp_store = MEMORY');
      
      const connection: Connection = {
        id: connectionId,
        db,
        created: new Date(),
        lastUsed: new Date(),
        inUse: false,
        queryCount: 0,
        config: { ...config }
      };
      
      this.connections.set(connectionId, connection);
      this.updateMetrics();
      
      this.emit('connection:created', { connectionId, database: dbPath });
      
      return connection;
      
    } catch (error) {
      this.emit('connection:error', { connectionId, error });
      throw new Error(`Failed to create database connection: ${error.message}`);
    }
  }

  private findAvailableConnection(config: ConnectionConfig): Connection | null {
    for (const connection of this.connections.values()) {
      if (!connection.inUse && this.isConnectionCompatible(connection, config)) {
        return connection;
      }
    }
    return null;
  }

  private isConnectionCompatible(connection: Connection, config: ConnectionConfig): boolean {
    // Check if connection config matches requested config
    if (config.database && connection.config.database !== config.database) {
      return false;
    }
    
    if (config.readonly !== undefined && connection.config.readonly !== config.readonly) {
      return false;
    }
    
    return true;
  }

  private markConnectionInUse(connection: Connection): void {
    connection.inUse = true;
    connection.lastUsed = new Date();
    this.updateMetrics();
  }

  private async waitForConnection(config: ConnectionConfig): Promise<Connection> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitingQueue.findIndex(item => item.resolve === resolve);
        if (index !== -1) {
          this.waitingQueue.splice(index, 1);
        }
        reject(new Error('Connection timeout'));
      }, this.config.connectionTimeout || 30000);
      
      this.waitingQueue.push({ resolve, reject, timeout });
    });
  }

  private processWaitingQueue(): void {
    while (this.waitingQueue.length > 0) {
      const availableConnection = this.findAvailableConnection({});
      if (!availableConnection) break;
      
      const waiting = this.waitingQueue.shift()!;
      clearTimeout(waiting.timeout);
      
      this.markConnectionInUse(availableConnection);
      waiting.resolve(availableConnection);
    }
  }

  private async closeConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      connection.db.close();
      this.connections.delete(connectionId);
      this.updateMetrics();
      
      this.emit('connection:closed', { connectionId, queryCount: connection.queryCount });
    } catch (error) {
      this.emit('connection:error', { connectionId, error });
    }
  }

  // ========================
  // Connection Health & Cleanup
  // ========================

  private startCleanup(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.config.checkInterval);
  }

  private stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  private performCleanup(): void {
    if (this.isShuttingDown) return;

    const now = Date.now();
    const connectionsToClose: string[] = [];
    
    // Find idle connections to close
    for (const [id, connection] of this.connections.entries()) {
      if (!connection.inUse) {
        const idleTime = now - connection.lastUsed.getTime();
        
        if (idleTime > this.config.idleTimeout) {
          // Keep minimum connections
          const minConnections = this.config.minConnections || 0;
          if (this.connections.size - connectionsToClose.length > minConnections) {
            connectionsToClose.push(id);
          }
        }
      }
    }
    
    // Close idle connections
    connectionsToClose.forEach(id => {
      this.closeConnection(id);
    });
    
    // Update cleanup metrics
    this.metrics.lastCleanup = new Date();
    
    if (connectionsToClose.length > 0) {
      this.emit('pool:cleanup', { 
        closed: connectionsToClose.length, 
        remaining: this.connections.size 
      });
    }
  }

  closeIdleConnections(): void {
    this.performCleanup();
  }

  closeAllIdleConnections(): void {
    const idleConnections = Array.from(this.connections.entries())
      .filter(([_, conn]) => !conn.inUse)
      .map(([id]) => id);
    
    idleConnections.forEach(id => {
      this.closeConnection(id);
    });
  }

  async testConnection(connectionId: string): Promise<boolean> {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    try {
      // Simple test query
      connection.db.prepare('SELECT 1').get();
      return true;
    } catch (error) {
      return false;
    }
  }

  getHealth(): PoolHealth {
    const connections = Array.from(this.connections.values());
    const healthyConnections = connections.filter(conn => !conn.inUse);
    const errors: string[] = [];
    
    // Check for issues
    if (connections.length === 0) {
      errors.push('No connections available');
    }
    
    if (this.waitingQueue.length > 0) {
      errors.push(`${this.waitingQueue.length} requests waiting for connections`);
    }
    
    if (this.metrics.connectionErrors > 0) {
      errors.push(`${this.metrics.connectionErrors} connection errors recorded`);
    }
    
    return {
      healthy: errors.length === 0,
      connections: {
        total: connections.length,
        healthy: healthyConnections.length,
        unhealthy: connections.length - healthyConnections.length
      },
      errors
    };
  }

  // ========================
  // Metrics & Monitoring
  // ========================

  private updateMetrics(): void {
    const connections = Array.from(this.connections.values());
    
    this.metrics.totalConnections = connections.length;
    this.metrics.activeConnections = connections.filter(c => c.inUse).length;
    this.metrics.idleConnections = connections.filter(c => !c.inUse).length;
  }

  private recordQueryTime(duration: number): void {
    if (!this.config.enableMetrics) return;
    
    this.queryTimes.push(duration);
    
    // Keep only last 1000 query times
    if (this.queryTimes.length > 1000) {
      this.queryTimes = this.queryTimes.slice(-1000);
    }
    
    // Calculate average
    this.metrics.avgQueryTime = this.queryTimes.reduce((a, b) => a + b, 0) / this.queryTimes.length;
  }

  getMetrics(): PoolMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  getDetailedMetrics() {
    const connections = Array.from(this.connections.values());
    
    return {
      pool: this.getMetrics(),
      connections: connections.map(conn => ({
        id: conn.id,
        database: conn.config.database || 'default',
        created: conn.created,
        lastUsed: conn.lastUsed,
        inUse: conn.inUse,
        queryCount: conn.queryCount,
        ageMinutes: (Date.now() - conn.created.getTime()) / 60000,
        idleMinutes: conn.inUse ? 0 : (Date.now() - conn.lastUsed.getTime()) / 60000
      })),
      waitingQueue: {
        length: this.waitingQueue.length,
        requests: this.waitingQueue.map((_, index) => ({ index, waiting: true }))
      },
      queryTimes: {
        recent: this.queryTimes.slice(-10),
        avg: this.metrics.avgQueryTime,
        min: this.queryTimes.length > 0 ? Math.min(...this.queryTimes) : 0,
        max: this.queryTimes.length > 0 ? Math.max(...this.queryTimes) : 0
      }
    };
  }

  // ========================
  // Transaction Support
  // ========================

  async executeTransaction<T>(
    queries: Array<{ sql: string; params?: any[] }>,
    config: ConnectionConfig = {}
  ): Promise<T[]> {
    let connection: Connection | null = null;
    
    try {
      connection = await this.getConnection(config);
      
      const transaction = connection.db.transaction(() => {
        const results: T[] = [];
        
        for (const { sql, params = [] } of queries) {
          const result = sql.trim().toUpperCase().startsWith('SELECT')
            ? connection!.db.prepare(sql).all(...params)
            : connection!.db.prepare(sql).run(...params);
          
          results.push(result as T);
          connection!.queryCount++;
        }
        
        return results;
      });
      
      const results = transaction();
      this.metrics.totalQueries += queries.length;
      
      return results;
      
    } catch (error) {
      this.metrics.connectionErrors++;
      throw error;
    } finally {
      if (connection) {
        this.releaseConnection(connection.id);
      }
    }
  }

  // ========================
  // Utility Methods
  // ========================

  isHealthy(): boolean {
    return this.getHealth().healthy;
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  getActiveConnectionCount(): number {
    return Array.from(this.connections.values()).filter(c => c.inUse).length;
  }

  getWaitingCount(): number {
    return this.waitingQueue.length;
  }
}

export default ConnectionPool;