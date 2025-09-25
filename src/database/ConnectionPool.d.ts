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
export declare class ConnectionPool extends EventEmitter {
  private dbPath;
  private config;
  private connections;
  private waitingQueue;
  private stats;
  private maintenanceTimer?;
  constructor(dbPath: string, config?: Partial<PoolConfig>);
  private initializePool;
  private createConnection;
  private configureConnection;
  private precompileSearchStatements;
  acquireConnection(type?: 'reader' | 'writer'): Promise<PoolConnection>;
  releaseConnection(connection: PoolConnection): void;
  executeQuery<T = any>(sql: string, params?: any[], type?: 'reader' | 'writer'): Promise<T>;
  executeTransaction<T = any>(
    queries: Array<{
      sql: string;
      params?: any[];
    }>,
    type?: 'reader' | 'writer'
  ): Promise<T[]>;
  private getAvailableConnection;
  private canCreateConnection;
  private markConnectionInUse;
  private processWaitingQueue;
  private validateConnection;
  private removeConnection;
  private updateAcquireStats;
  private startMaintenance;
  private performMaintenance;
  getStats(): PoolStats;
  close(): Promise<void>;
  healthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    stats: PoolStats;
  }>;
}
export {};
//# sourceMappingURL=ConnectionPool.d.ts.map
