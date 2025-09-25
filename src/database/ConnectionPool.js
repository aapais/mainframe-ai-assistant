'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.ConnectionPool = void 0;
const tslib_1 = require('tslib');
const better_sqlite3_1 = tslib_1.__importDefault(require('better-sqlite3'));
const events_1 = require('events');
class ConnectionPool extends events_1.EventEmitter {
  dbPath;
  config;
  connections = new Map();
  waitingQueue = [];
  stats = {
    totalAcquired: 0,
    totalReleased: 0,
    totalAcquireTime: 0,
    peakConnections: 0,
  };
  maintenanceTimer;
  constructor(dbPath, config) {
    super();
    this.dbPath = dbPath;
    this.config = {
      maxReaders: 5,
      maxWriters: 1,
      acquireTimeout: 30000,
      idleTimeout: 300000,
      maxLifetime: 3600000,
      validateConnection: true,
      enableWAL: true,
      ...config,
    };
    this.initializePool();
    this.startMaintenance();
  }
  initializePool() {
    console.log('🏊 Initializing SQLite connection pool...');
    try {
      this.createConnection('writer');
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
  createConnection(type) {
    const connectionId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    try {
      const db = new better_sqlite3_1.default(this.dbPath, {
        readonly: type === 'reader',
        fileMustExist: true,
      });
      this.configureConnection(db, type);
      const connection = {
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
  configureConnection(db, type) {
    try {
      if (this.config.enableWAL && type === 'writer') {
        db.pragma('journal_mode = WAL');
        db.pragma('wal_autocheckpoint = 100');
        db.pragma('wal_checkpoint(TRUNCATE)');
      }
      if (type === 'reader') {
        db.pragma('query_only = ON');
        db.pragma('cache_size = -64000');
        db.pragma('temp_store = MEMORY');
        db.pragma('mmap_size = 268435456');
        db.pragma('cache_spill = OFF');
        db.pragma('page_size = 4096');
        db.pragma('lookaside = 1024,128');
        db.pragma('secure_delete = OFF');
        db.pragma('auto_vacuum = INCREMENTAL');
      } else {
        db.pragma('cache_size = -128000');
        db.pragma('synchronous = NORMAL');
        db.pragma('temp_store = MEMORY');
        db.pragma('foreign_keys = ON');
        db.pragma('busy_timeout = 30000');
        db.pragma('journal_size_limit = 67108864');
      }
      db.pragma('threads = 4');
      db.pragma('analysis_limit = 1000');
      db.function('log', Math.log);
      db.function('pow', Math.pow);
      this.precompileSearchStatements(db, type);
      db.pragma('optimize');
      console.log(`✅ Optimized ${type} connection for search performance`);
    } catch (error) {
      console.error('Error configuring connection:', error);
    }
  }
  precompileSearchStatements(db, type) {
    if (type !== 'reader') return;
    try {
      const commonStatements = [
        `SELECT e.id, e.title, e.category, e.usage_count 
         FROM kb_entries e WHERE e.category = ? AND e.archived = FALSE 
         ORDER BY e.usage_count DESC LIMIT ?`,
        `SELECT e.id, e.title, bm25(kb_fts) as score 
         FROM kb_fts f JOIN kb_entries e ON f.id = e.id 
         WHERE kb_fts MATCH ? AND e.archived = FALSE 
         ORDER BY score LIMIT ?`,
        `SELECT e.id, e.title, e.usage_count 
         FROM kb_entries e WHERE e.archived = FALSE 
         ORDER BY e.usage_count DESC, e.success_count DESC LIMIT ?`,
        `SELECT e.id, e.title, e.created_at 
         FROM kb_entries e WHERE e.archived = FALSE 
         ORDER BY e.created_at DESC LIMIT ?`,
      ];
      commonStatements.forEach((sql, index) => {
        try {
          const stmt = db.prepare(sql);
          db[`_precompiled_${index}`] = stmt;
        } catch (error) {
          console.warn(`Failed to precompile statement ${index}:`, error);
        }
      });
    } catch (error) {
      console.error('Error precompiling search statements:', error);
    }
  }
  async acquireConnection(type = 'reader') {
    const startTime = Date.now();
    return new Promise((resolve, reject) => {
      const connection = this.getAvailableConnection(type);
      if (connection) {
        this.markConnectionInUse(connection);
        this.updateAcquireStats(Date.now() - startTime);
        resolve(connection);
        return;
      }
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
  releaseConnection(connection) {
    if (!this.connections.has(connection.id)) {
      console.warn('Attempting to release unknown connection:', connection.id);
      return;
    }
    connection.inUse = false;
    connection.lastUsed = Date.now();
    connection.transactionDepth = 0;
    this.stats.totalReleased++;
    this.processWaitingQueue();
    this.emit('connectionReleased', { id: connection.id, type: connection.type });
  }
  async executeQuery(sql, params = [], type = 'reader') {
    const connection = await this.acquireConnection(type);
    try {
      connection.queryCount++;
      if (this.config.validateConnection) {
        this.validateConnection(connection);
      }
      let result;
      if (sql.trim().toLowerCase().startsWith('select')) {
        const stmt = connection.db.prepare(sql);
        result = params.length > 0 ? stmt.all(...params) : stmt.all();
      } else {
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
  async executeTransaction(queries, type = 'writer') {
    const connection = await this.acquireConnection(type);
    try {
      const results = [];
      connection.db.exec('BEGIN TRANSACTION');
      connection.transactionDepth++;
      for (const query of queries) {
        const stmt = connection.db.prepare(query.sql);
        const result = query.params ? stmt.run(...query.params) : stmt.run();
        results.push(result);
        connection.queryCount++;
      }
      connection.db.exec('COMMIT');
      connection.transactionDepth--;
      return results;
    } catch (error) {
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
  getAvailableConnection(type) {
    for (const connection of this.connections.values()) {
      if (connection.type === type && !connection.inUse) {
        return connection;
      }
    }
    return null;
  }
  canCreateConnection(type) {
    const currentConnections = Array.from(this.connections.values());
    const currentTypeCount = currentConnections.filter(c => c.type === type).length;
    const maxAllowed = type === 'reader' ? this.config.maxReaders : this.config.maxWriters;
    return currentTypeCount < maxAllowed;
  }
  markConnectionInUse(connection) {
    connection.inUse = true;
    connection.lastUsed = Date.now();
    this.stats.totalAcquired++;
  }
  processWaitingQueue() {
    while (this.waitingQueue.length > 0) {
      const request = this.waitingQueue[0];
      const connection = this.getAvailableConnection(request.type);
      if (!connection && !this.canCreateConnection(request.type)) {
        break;
      }
      this.waitingQueue.shift();
      clearTimeout(request.timeout);
      try {
        let connectionToUse;
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
  validateConnection(connection) {
    try {
      connection.db.prepare('SELECT 1').get();
    } catch (error) {
      console.error(`Connection ${connection.id} validation failed:`, error);
      this.removeConnection(connection.id);
      throw new Error('Connection validation failed');
    }
  }
  removeConnection(connectionId) {
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
  updateAcquireStats(acquireTime) {
    this.stats.totalAcquireTime += acquireTime;
  }
  startMaintenance() {
    this.maintenanceTimer = setInterval(() => {
      this.performMaintenance();
    }, 60000);
    console.log('⏰ Connection pool maintenance started');
  }
  performMaintenance() {
    const now = Date.now();
    const connectionsToRemove = [];
    for (const [id, connection] of this.connections) {
      const age = now - connection.createdAt;
      const idleTime = now - connection.lastUsed;
      if (age > this.config.maxLifetime) {
        if (!connection.inUse) {
          connectionsToRemove.push(id);
          console.log(`🕒 Removing aged connection: ${id} (age: ${age}ms)`);
        }
        continue;
      }
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
    connectionsToRemove.forEach(id => this.removeConnection(id));
    if (connectionsToRemove.length > 0) {
      console.log(`🧹 Pool maintenance: removed ${connectionsToRemove.length} connections`);
    }
  }
  getStats() {
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
  async close() {
    console.log('🔌 Closing connection pool...');
    if (this.maintenanceTimer) {
      clearInterval(this.maintenanceTimer);
    }
    this.waitingQueue.forEach(request => {
      clearTimeout(request.timeout);
      request.reject(new Error('Connection pool is closing'));
    });
    this.waitingQueue.length = 0;
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
  async healthCheck() {
    const issues = [];
    const stats = this.getStats();
    if (stats.totalConnections === 0) {
      issues.push('No connections available');
    }
    if (stats.averageAcquireTime > 1000) {
      issues.push(`High average acquire time: ${stats.averageAcquireTime}ms`);
    }
    if (stats.waitingRequests > 10) {
      issues.push(`High number of waiting requests: ${stats.waitingRequests}`);
    }
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
exports.ConnectionPool = ConnectionPool;
//# sourceMappingURL=ConnectionPool.js.map
