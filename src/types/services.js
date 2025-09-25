'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.DEFAULT_SERVICE_CONFIG =
  exports.AIServiceError =
  exports.CacheError =
  exports.SearchError =
  exports.DatabaseError =
  exports.ValidationError =
  exports.ServiceError =
    void 0;
class ServiceError extends Error {
  code;
  statusCode;
  details;
  recoverable;
  constructor(message, code, statusCode = 500, details, recoverable = false) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.recoverable = recoverable;
    this.name = 'ServiceError';
  }
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      recoverable: this.recoverable,
      stack: this.stack,
    };
  }
}
exports.ServiceError = ServiceError;
class ValidationError extends ServiceError {
  field;
  value;
  constructor(message, field, value) {
    super(message, 'VALIDATION_ERROR', 400, { field, value }, true);
    this.field = field;
    this.value = value;
    this.name = 'ValidationError';
  }
}
exports.ValidationError = ValidationError;
class DatabaseError extends ServiceError {
  operation;
  details;
  constructor(message, operation, details) {
    super(message, 'DATABASE_ERROR', 500, { operation, ...details }, false);
    this.operation = operation;
    this.details = details;
    this.name = 'DatabaseError';
  }
}
exports.DatabaseError = DatabaseError;
class SearchError extends ServiceError {
  query;
  details;
  constructor(message, query, details) {
    super(message, 'SEARCH_ERROR', 500, { query, ...details }, true);
    this.query = query;
    this.details = details;
    this.name = 'SearchError';
  }
}
exports.SearchError = SearchError;
class CacheError extends ServiceError {
  operation;
  details;
  constructor(message, operation, details) {
    super(message, 'CACHE_ERROR', 500, { operation, ...details }, true);
    this.operation = operation;
    this.details = details;
    this.name = 'CacheError';
  }
}
exports.CacheError = CacheError;
class AIServiceError extends ServiceError {
  provider;
  details;
  constructor(message, provider, details) {
    super(message, 'AI_SERVICE_ERROR', 503, { provider, ...details }, true);
    this.provider = provider;
    this.details = details;
    this.name = 'AIServiceError';
  }
}
exports.AIServiceError = AIServiceError;
exports.DEFAULT_SERVICE_CONFIG = {
  database: {
    path: './knowledge.db',
    pragmas: {
      journal_mode: 'WAL',
      synchronous: 'NORMAL',
      cache_size: -64000,
      foreign_keys: 'ON',
      temp_store: 'MEMORY',
      mmap_size: 268435456,
    },
    backup: {
      enabled: true,
      interval: 3600000,
      retention: 7,
      path: './backups',
    },
    performance: {
      connectionPool: 5,
      busyTimeout: 10000,
      cacheSize: 64000,
    },
  },
  search: {
    fts: {
      tokenize: 'porter',
      remove_diacritics: 1,
      categories: 'simple',
    },
    ai: {
      enabled: true,
      fallback: true,
      timeout: 5000,
      retries: 2,
      batchSize: 10,
    },
    cache: {
      enabled: true,
      ttl: 300000,
      maxSize: 1000,
    },
  },
  cache: {
    maxSize: 10000,
    ttl: 300000,
    checkPeriod: 600000,
    strategy: 'lru',
    persistent: false,
  },
  metrics: {
    enabled: true,
    retention: 2592000000,
    aggregation: {
      enabled: true,
      interval: 3600000,
      batch: 1000,
    },
    alerts: {
      enabled: true,
      thresholds: {
        searchTime: 1000,
        errorRate: 0.05,
        cacheHitRate: 0.8,
      },
    },
  },
  validation: {
    strict: false,
    sanitize: true,
    maxLength: {
      title: 200,
      problem: 5000,
      solution: 10000,
      tags: 50,
    },
    minLength: {
      title: 5,
      problem: 10,
      solution: 10,
    },
    patterns: {
      tag: /^[a-zA-Z0-9-_]+$/,
      category: ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'IMS', 'CICS', 'System', 'Other'],
    },
  },
  logging: {
    level: 'info',
    file: {
      enabled: true,
      path: './logs',
      maxSize: 10485760,
      maxFiles: 5,
    },
    console: true,
    structured: true,
  },
};
//# sourceMappingURL=services.js.map
