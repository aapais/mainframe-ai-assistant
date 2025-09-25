export interface CacheEntry<T = any> {
  key: string;
  value: T;
  ttl: number;
  created: number;
  accessed: number;
  accessCount: number;
  size: number;
  metadata?: Record<string, any>;
}
export interface CacheStats {
  hitCount: number;
  missCount: number;
  hitRate: number;
  size: number;
  maxSize: number;
  memoryUsage: number;
  evictions: number;
  averageAge: number;
  oldestEntry: Date;
  newestEntry: Date;
}
export interface CacheConfiguration {
  maxSize: number;
  defaultTTL: number;
  checkPeriod: number;
  evictionStrategy: 'lru' | 'lfu' | 'ttl' | 'adaptive';
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  persistenceEnabled: boolean;
}
export interface CachePerformanceMetrics {
  responseTime: number;
  cacheHitRatio: number;
  memoryPressure: number;
  evictionRate: number;
  storageUtilization: number;
  networkSavings: number;
}
export interface PredictiveCacheEntry {
  pattern: string;
  probability: number;
  lastUsed: number;
  frequency: number;
  context: Record<string, any>;
}
export interface IncrementalResult<T = any> {
  id: string;
  data: T;
  partial: boolean;
  progress: number;
  estimated_total: number;
  cache_source: 'memory' | 'disk' | 'network' | 'predicted';
  timestamp: number;
}
export interface CacheInvalidationRule {
  pattern: string;
  triggers: ('time' | 'data_change' | 'user_action' | 'external_event')[];
  conditions: Record<string, any>;
  cascade: boolean;
}
//# sourceMappingURL=CacheTypes.d.ts.map
