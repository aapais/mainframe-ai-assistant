/**
 * Enhanced Knowledge Base Services
 *
 * Comprehensive backend services for KB entry management with advanced features:
 * - Batch operations for bulk management
 * - Version control and change tracking
 * - Smart search with caching and optimization
 * - Duplicate detection and management
 * - Performance monitoring and analytics
 */

export { BatchOperationsService } from '../BatchOperationsService';
export type {
  BatchOperationType,
  BatchOperation,
  BatchOperationResult,
  BatchExecutionResult,
  BatchProgress,
  ExportOptions,
  ImportOptions
} from '../BatchOperationsService';

export { VersionControlService } from '../VersionControlService';
export type {
  ChangeType,
  FieldChange,
  ChangeRecord,
  EntryVersion,
  VersionDiff,
  HistoryQuery,
  RollbackResult,
  MergeConflict
} from '../VersionControlService';

export { SmartSearchService } from '../SmartSearchService';
export type {
  SearchStrategy,
  SearchSuggestion,
  SearchAnalytics,
  SearchPerformanceMetrics
} from '../SmartSearchService';

export { DuplicateDetectionService } from '../DuplicateDetectionService';
export type {
  DuplicateAlgorithm,
  DuplicateMatch,
  DuplicateDetectionOptions,
  MergeSuggestion,
  DuplicateDetectionResult,
  DetectionProgress
} from '../DuplicateDetectionService';

export { EnhancedKnowledgeDBService } from '../EnhancedKnowledgeDBService';
export type {
  VirtualScrollData,
  ValidationResult,
  EnhancedSearchOptions,
  EntryRelationship,
  KBAnalytics
} from '../EnhancedKnowledgeDBService';

// Service factory for easy initialization
export async function createEnhancedKnowledgeDB(
  dbPath?: string,
  options?: {
    enableVersionControl?: boolean;
    enableDuplicateDetection?: boolean;
    enableSmartSearch?: boolean;
    enableBatchOperations?: boolean;
    autoOptimizeEnabled?: boolean;
  }
): Promise<EnhancedKnowledgeDBService> {
  return new EnhancedKnowledgeDBService(dbPath, options);
}

// Performance monitoring utilities
export class ServicePerformanceMonitor {
  private metrics = new Map<string, { calls: number; totalTime: number; errors: number }>();

  recordCall(serviceName: string, executionTime: number, success: boolean = true): void {
    const current = this.metrics.get(serviceName) || { calls: 0, totalTime: 0, errors: 0 };

    current.calls++;
    current.totalTime += executionTime;

    if (!success) {
      current.errors++;
    }

    this.metrics.set(serviceName, current);
  }

  getMetrics(serviceName?: string): Record<string, {
    averageTime: number;
    totalCalls: number;
    errorRate: number;
    totalTime: number;
  }> {
    const result: Record<string, any> = {};

    const entries = serviceName
      ? [[serviceName, this.metrics.get(serviceName)]]
      : Array.from(this.metrics.entries());

    entries.forEach(([name, data]) => {
      if (data) {
        result[name] = {
          averageTime: data.calls > 0 ? data.totalTime / data.calls : 0,
          totalCalls: data.calls,
          errorRate: data.calls > 0 ? (data.errors / data.calls) * 100 : 0,
          totalTime: data.totalTime
        };
      }
    });

    return result;
  }

  reset(serviceName?: string): void {
    if (serviceName) {
      this.metrics.delete(serviceName);
    } else {
      this.metrics.clear();
    }
  }
}

// Configuration helper
export interface EnhancedKBConfig {
  database: {
    path: string;
    backupEnabled: boolean;
    backupInterval: number; // hours
  };
  features: {
    versionControl: boolean;
    duplicateDetection: boolean;
    smartSearch: boolean;
    batchOperations: boolean;
    autoOptimization: boolean;
  };
  performance: {
    cacheSize: number;
    cacheTTL: number; // milliseconds
    batchSize: number;
    maxVirtualScrollItems: number;
  };
  thresholds: {
    duplicateDetection: number; // 0-1
    qualityScore: number; // 0-100
    autoMergeConfidence: number; // 0-1
  };
}

export const DEFAULT_CONFIG: EnhancedKBConfig = {
  database: {
    path: './knowledge.db',
    backupEnabled: true,
    backupInterval: 24
  },
  features: {
    versionControl: true,
    duplicateDetection: true,
    smartSearch: true,
    batchOperations: true,
    autoOptimization: true
  },
  performance: {
    cacheSize: 1000,
    cacheTTL: 300000, // 5 minutes
    batchSize: 100,
    maxVirtualScrollItems: 50
  },
  thresholds: {
    duplicateDetection: 0.8,
    qualityScore: 70,
    autoMergeConfidence: 0.95
  }
};

export function createConfigFromOptions(
  overrides: Partial<EnhancedKBConfig> = {}
): EnhancedKBConfig {
  return {
    database: { ...DEFAULT_CONFIG.database, ...overrides.database },
    features: { ...DEFAULT_CONFIG.features, ...overrides.features },
    performance: { ...DEFAULT_CONFIG.performance, ...overrides.performance },
    thresholds: { ...DEFAULT_CONFIG.thresholds, ...overrides.thresholds }
  };
}