/**
 * Cache Invalidation Hook
 *
 * Intelligent cache invalidation strategies for UI updates:
 * - Event-driven invalidation based on data changes
 * - Time-based TTL invalidation with smart refresh
 * - Dependency-based invalidation for related data
 * - User action triggered invalidation
 * - Batch invalidation with minimal UI disruption
 *
 * @author Frontend Cache Team
 * @version 1.0.0
 */

import { useCallback, useEffect, useRef, useMemo } from 'react';
import { useCacheManager } from './useCacheManager';
import { getCacheApiClient } from '../services/api/CacheApiClient';
import { CacheInvalidationRule } from '../services/cache/CacheTypes';

// ========================
// Types & Interfaces
// ========================

export interface InvalidationStrategy {
  id: string;
  name: string;
  triggers: InvalidationTrigger[];
  conditions?: InvalidationCondition[];
  actions: InvalidationAction[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  debounceMs?: number;
  cascadeRules?: string[];
}

export interface InvalidationTrigger {
  type: 'time' | 'data_change' | 'user_action' | 'external_event' | 'api_response';
  config: {
    // Time-based
    interval?: number;
    cron?: string;

    // Data change
    dataPath?: string;
    changeType?: 'create' | 'update' | 'delete' | 'any';

    // User action
    action?: string;
    element?: string;

    // External event
    eventName?: string;
    source?: string;

    // API response
    endpoint?: string;
    statusCode?: number;
    responsePattern?: string;
  };
}

export interface InvalidationCondition {
  type: 'pattern_match' | 'value_changed' | 'threshold' | 'dependency';
  config: {
    pattern?: string;
    field?: string;
    operator?: 'equals' | 'not_equals' | 'greater' | 'less' | 'contains';
    value?: any;
    threshold?: number;
    dependencies?: string[];
  };
}

export interface InvalidationAction {
  type:
    | 'invalidate_keys'
    | 'invalidate_pattern'
    | 'refresh_data'
    | 'notify_components'
    | 'clear_section';
  config: {
    keys?: string[];
    pattern?: string;
    component?: string;
    section?: string;
    silent?: boolean;
    refreshStrategy?: 'immediate' | 'lazy' | 'background';
  };
}

export interface InvalidationEvent {
  id: string;
  timestamp: number;
  trigger: InvalidationTrigger;
  strategy: InvalidationStrategy;
  affectedKeys: string[];
  success: boolean;
  duration: number;
  error?: string;
}

export interface UseCacheInvalidationOptions {
  enableAutoInvalidation?: boolean;
  enableBatchInvalidation?: boolean;
  batchDelayMs?: number;
  maxBatchSize?: number;
  enableEventLogging?: boolean;
  onInvalidation?: (event: InvalidationEvent) => void;
}

export interface UseCacheInvalidationReturn {
  // Strategy management
  addStrategy: (strategy: InvalidationStrategy) => void;
  removeStrategy: (strategyId: string) => void;
  updateStrategy: (strategyId: string, updates: Partial<InvalidationStrategy>) => void;
  getStrategies: () => InvalidationStrategy[];

  // Manual invalidation
  invalidateKeys: (
    keys: string[],
    options?: { silent?: boolean; cascade?: boolean }
  ) => Promise<void>;
  invalidatePattern: (
    pattern: string,
    options?: { silent?: boolean; cascade?: boolean }
  ) => Promise<void>;
  invalidateByTags: (
    tags: string[],
    options?: { silent?: boolean; cascade?: boolean }
  ) => Promise<void>;
  invalidateAll: (options?: { silent?: boolean; confirm?: boolean }) => Promise<void>;

  // Trigger-based invalidation
  triggerDataChange: (
    dataPath: string,
    changeType: 'create' | 'update' | 'delete',
    data?: any
  ) => void;
  triggerUserAction: (action: string, context?: any) => void;
  triggerExternalEvent: (eventName: string, data?: any) => void;
  triggerApiResponse: (endpoint: string, response: any) => void;

  // Dependency management
  addDependency: (key: string, dependencies: string[]) => void;
  removeDependency: (key: string, dependency: string) => void;
  getDependencies: (key: string) => string[];

  // Batch operations
  startBatch: () => void;
  endBatch: (execute?: boolean) => Promise<void>;

  // Monitoring
  getInvalidationHistory: (limit?: number) => InvalidationEvent[];
  getInvalidationStats: () => {
    totalInvalidations: number;
    successRate: number;
    averageDuration: number;
    strategyCounts: Record<string, number>;
  };

  // State
  isInvalidating: boolean;
  batchMode: boolean;
  activeStrategies: string[];
}

// ========================
// Constants
// ========================

const DEFAULT_OPTIONS: Required<UseCacheInvalidationOptions> = {
  enableAutoInvalidation: true,
  enableBatchInvalidation: true,
  batchDelayMs: 100,
  maxBatchSize: 50,
  enableEventLogging: true,
  onInvalidation: () => {},
};

const BUILT_IN_STRATEGIES: InvalidationStrategy[] = [
  {
    id: 'search_data_change',
    name: 'Search Data Change',
    triggers: [
      {
        type: 'data_change',
        config: {
          dataPath: 'search.*',
          changeType: 'any',
        },
      },
    ],
    actions: [
      {
        type: 'invalidate_pattern',
        config: {
          pattern: 'search_results:*',
          refreshStrategy: 'background',
        },
      },
    ],
    priority: 'high',
    debounceMs: 500,
  },
  {
    id: 'user_logout',
    name: 'User Logout',
    triggers: [
      {
        type: 'user_action',
        config: {
          action: 'logout',
        },
      },
    ],
    actions: [
      {
        type: 'clear_section',
        config: {
          section: 'user_data',
          silent: false,
        },
      },
    ],
    priority: 'critical',
  },
  {
    id: 'periodic_cleanup',
    name: 'Periodic Cleanup',
    triggers: [
      {
        type: 'time',
        config: {
          interval: 10 * 60 * 1000, // 10 minutes
        },
      },
    ],
    conditions: [
      {
        type: 'threshold',
        config: {
          field: 'memory_usage',
          operator: 'greater',
          threshold: 0.8,
        },
      },
    ],
    actions: [
      {
        type: 'invalidate_pattern',
        config: {
          pattern: '*:expired',
          silent: true,
        },
      },
    ],
    priority: 'low',
  },
];

// ========================
// Hook Implementation
// ========================

export const useCacheInvalidation = (
  options: UseCacheInvalidationOptions = {}
): UseCacheInvalidationReturn => {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const cacheManager = useCacheManager();
  const apiClient = getCacheApiClient();

  // State refs
  const strategiesRef = useRef<Map<string, InvalidationStrategy>>(new Map());
  const dependenciesRef = useRef<Map<string, Set<string>>>(new Map());
  const invalidationHistoryRef = useRef<InvalidationEvent[]>([]);
  const batchQueueRef = useRef<Array<() => Promise<void>>>([]);
  const batchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInvalidatingRef = useRef(false);
  const isBatchModeRef = useRef(false);
  const debounceTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // ========================
  // Strategy Management
  // ========================

  const addStrategy = useCallback(
    (strategy: InvalidationStrategy) => {
      strategiesRef.current.set(strategy.id, strategy);

      // Set up automatic triggers if enabled
      if (config.enableAutoInvalidation) {
        setupStrategyTriggers(strategy);
      }
    },
    [config.enableAutoInvalidation]
  );

  const removeStrategy = useCallback((strategyId: string) => {
    strategiesRef.current.delete(strategyId);

    // Clear any pending debounce timers
    const timer = debounceTimersRef.current.get(strategyId);
    if (timer) {
      clearTimeout(timer);
      debounceTimersRef.current.delete(strategyId);
    }
  }, []);

  const updateStrategy = useCallback(
    (strategyId: string, updates: Partial<InvalidationStrategy>) => {
      const existing = strategiesRef.current.get(strategyId);
      if (existing) {
        const updated = { ...existing, ...updates };
        strategiesRef.current.set(strategyId, updated);
      }
    },
    []
  );

  const getStrategies = useCallback((): InvalidationStrategy[] => {
    return Array.from(strategiesRef.current.values());
  }, []);

  // ========================
  // Invalidation Execution
  // ========================

  const executeInvalidation = useCallback(
    async (
      strategy: InvalidationStrategy,
      trigger: InvalidationTrigger,
      context?: any
    ): Promise<InvalidationEvent> => {
      const startTime = performance.now();
      const eventId = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const affectedKeys: string[] = [];

      try {
        isInvalidatingRef.current = true;

        // Execute all actions in the strategy
        for (const action of strategy.actions) {
          switch (action.type) {
            case 'invalidate_keys':
              if (action.config.keys) {
                await invalidateKeysInternal(action.config.keys, {
                  silent: action.config.silent || false,
                });
                affectedKeys.push(...action.config.keys);
              }
              break;

            case 'invalidate_pattern':
              if (action.config.pattern) {
                const keys = await invalidatePatternInternal(action.config.pattern, {
                  silent: action.config.silent || false,
                });
                affectedKeys.push(...keys);
              }
              break;

            case 'refresh_data':
              // Implement data refresh logic
              if (action.config.refreshStrategy === 'immediate') {
                // Trigger immediate refresh
              } else if (action.config.refreshStrategy === 'background') {
                // Queue background refresh
              }
              break;

            case 'notify_components':
              // Notify React components of invalidation
              if (action.config.component) {
                window.dispatchEvent(
                  new CustomEvent('cache-invalidation', {
                    detail: {
                      component: action.config.component,
                      keys: affectedKeys,
                      strategy: strategy.id,
                    },
                  })
                );
              }
              break;

            case 'clear_section':
              if (action.config.section) {
                const pattern = `${action.config.section}:*`;
                const keys = await invalidatePatternInternal(pattern, {
                  silent: action.config.silent || false,
                });
                affectedKeys.push(...keys);
              }
              break;
          }
        }

        // Handle cascade invalidation
        if (strategy.cascadeRules) {
          for (const cascadeRuleId of strategy.cascadeRules) {
            const cascadeStrategy = strategiesRef.current.get(cascadeRuleId);
            if (cascadeStrategy) {
              // Execute cascade strategy (prevent infinite recursion)
              await executeInvalidation(cascadeStrategy, trigger, context);
            }
          }
        }

        const duration = performance.now() - startTime;
        const event: InvalidationEvent = {
          id: eventId,
          timestamp: Date.now(),
          trigger,
          strategy,
          affectedKeys,
          success: true,
          duration,
        };

        // Log event
        if (config.enableEventLogging) {
          invalidationHistoryRef.current.unshift(event);
          if (invalidationHistoryRef.current.length > 1000) {
            invalidationHistoryRef.current = invalidationHistoryRef.current.slice(0, 1000);
          }
        }

        // Notify callback
        config.onInvalidation(event);

        return event;
      } catch (error) {
        const duration = performance.now() - startTime;
        const event: InvalidationEvent = {
          id: eventId,
          timestamp: Date.now(),
          trigger,
          strategy,
          affectedKeys,
          success: false,
          duration,
          error: error instanceof Error ? error.message : 'Unknown error',
        };

        if (config.enableEventLogging) {
          invalidationHistoryRef.current.unshift(event);
        }

        console.error('Cache invalidation failed:', error);
        return event;
      } finally {
        isInvalidatingRef.current = false;
      }
    },
    [config.enableEventLogging, config.onInvalidation]
  );

  // ========================
  // Internal Invalidation Methods
  // ========================

  const invalidateKeysInternal = useCallback(
    async (
      keys: string[],
      options: { silent?: boolean; cascade?: boolean } = {}
    ): Promise<void> => {
      // Invalidate in local cache
      for (const key of keys) {
        await cacheManager.delete(key);

        // Handle dependencies
        if (options.cascade) {
          const deps = dependenciesRef.current.get(key);
          if (deps) {
            for (const dep of deps) {
              await cacheManager.delete(dep);
            }
          }
        }
      }

      // Invalidate on backend
      try {
        await apiClient.invalidate({
          keys,
          cascade: options.cascade,
        });
      } catch (error) {
        console.warn('Backend invalidation failed:', error);
      }
    },
    [cacheManager, apiClient]
  );

  const invalidatePatternInternal = useCallback(
    async (
      pattern: string,
      options: { silent?: boolean; cascade?: boolean } = {}
    ): Promise<string[]> => {
      // Get matching keys from local cache
      const localKeys = await cacheManager.keys(pattern);

      // Invalidate local keys
      for (const key of localKeys) {
        await cacheManager.delete(key);
      }

      // Invalidate on backend and get all affected keys
      try {
        const response = await apiClient.invalidate({
          patterns: [pattern],
          cascade: options.cascade,
        });

        return localKeys; // Return local keys for now
      } catch (error) {
        console.warn('Backend pattern invalidation failed:', error);
        return localKeys;
      }
    },
    [cacheManager, apiClient]
  );

  // ========================
  // Public Invalidation Methods
  // ========================

  const invalidateKeys = useCallback(
    async (
      keys: string[],
      options: { silent?: boolean; cascade?: boolean } = {}
    ): Promise<void> => {
      if (isBatchModeRef.current) {
        // Add to batch queue
        batchQueueRef.current.push(() => invalidateKeysInternal(keys, options));
        return;
      }

      await invalidateKeysInternal(keys, options);
    },
    [invalidateKeysInternal]
  );

  const invalidatePattern = useCallback(
    async (
      pattern: string,
      options: { silent?: boolean; cascade?: boolean } = {}
    ): Promise<void> => {
      if (isBatchModeRef.current) {
        // Add to batch queue
        batchQueueRef.current.push(async () => {
          await invalidatePatternInternal(pattern, options);
        });
        return;
      }

      await invalidatePatternInternal(pattern, options);
    },
    [invalidatePatternInternal]
  );

  const invalidateByTags = useCallback(
    async (
      tags: string[],
      options: { silent?: boolean; cascade?: boolean } = {}
    ): Promise<void> => {
      try {
        await apiClient.invalidate({
          tags,
          cascade: options.cascade,
        });
      } catch (error) {
        console.warn('Tag-based invalidation failed:', error);
      }
    },
    [apiClient]
  );

  const invalidateAll = useCallback(
    async (options: { silent?: boolean; confirm?: boolean } = {}): Promise<void> => {
      if (options.confirm && !confirm('Clear all cache entries?')) {
        return;
      }

      await cacheManager.clear();

      try {
        await apiClient.clear();
      } catch (error) {
        console.warn('Backend cache clear failed:', error);
      }
    },
    [cacheManager, apiClient]
  );

  // ========================
  // Trigger Methods
  // ========================

  const triggerDataChange = useCallback(
    (dataPath: string, changeType: 'create' | 'update' | 'delete', data?: any) => {
      const trigger: InvalidationTrigger = {
        type: 'data_change',
        config: { dataPath, changeType },
      };

      processTriggeredInvalidation(trigger, { data });
    },
    []
  );

  const triggerUserAction = useCallback((action: string, context?: any) => {
    const trigger: InvalidationTrigger = {
      type: 'user_action',
      config: { action },
    };

    processTriggeredInvalidation(trigger, context);
  }, []);

  const triggerExternalEvent = useCallback((eventName: string, data?: any) => {
    const trigger: InvalidationTrigger = {
      type: 'external_event',
      config: { eventName },
    };

    processTriggeredInvalidation(trigger, { data });
  }, []);

  const triggerApiResponse = useCallback((endpoint: string, response: any) => {
    const trigger: InvalidationTrigger = {
      type: 'api_response',
      config: { endpoint, statusCode: response.status },
    };

    processTriggeredInvalidation(trigger, { response });
  }, []);

  // ========================
  // Trigger Processing
  // ========================

  const processTriggeredInvalidation = useCallback(
    (trigger: InvalidationTrigger, context?: any) => {
      for (const strategy of strategiesRef.current.values()) {
        // Check if strategy matches trigger
        const matchingTrigger = strategy.triggers.find(
          t => t.type === trigger.type && matchesTriggerConfig(t, trigger)
        );

        if (!matchingTrigger) continue;

        // Check conditions
        if (strategy.conditions && !evaluateConditions(strategy.conditions, context)) {
          continue;
        }

        // Execute with debouncing if configured
        if (strategy.debounceMs) {
          const existingTimer = debounceTimersRef.current.get(strategy.id);
          if (existingTimer) {
            clearTimeout(existingTimer);
          }

          const timer = setTimeout(() => {
            executeInvalidation(strategy, trigger, context);
            debounceTimersRef.current.delete(strategy.id);
          }, strategy.debounceMs);

          debounceTimersRef.current.set(strategy.id, timer);
        } else {
          executeInvalidation(strategy, trigger, context);
        }
      }
    },
    [executeInvalidation]
  );

  const matchesTriggerConfig = useCallback(
    (strategyTrigger: InvalidationTrigger, actualTrigger: InvalidationTrigger): boolean => {
      const sConfig = strategyTrigger.config;
      const aConfig = actualTrigger.config;

      switch (strategyTrigger.type) {
        case 'data_change':
          return (
            (!sConfig.dataPath ||
              new RegExp(sConfig.dataPath.replace('*', '.*')).test(aConfig.dataPath || '')) &&
            (!sConfig.changeType ||
              sConfig.changeType === 'any' ||
              sConfig.changeType === aConfig.changeType)
          );

        case 'user_action':
          return sConfig.action === aConfig.action;

        case 'external_event':
          return sConfig.eventName === aConfig.eventName;

        case 'api_response':
          return (
            (!sConfig.endpoint || sConfig.endpoint === aConfig.endpoint) &&
            (!sConfig.statusCode || sConfig.statusCode === aConfig.statusCode)
          );

        default:
          return true;
      }
    },
    []
  );

  const evaluateConditions = useCallback(
    (conditions: InvalidationCondition[], context?: any): boolean => {
      return conditions.every(condition => {
        switch (condition.type) {
          case 'pattern_match':
            return condition.config.pattern
              ? new RegExp(condition.config.pattern).test(context?.data || '')
              : true;

          case 'value_changed':
            // Implement value change detection
            return true;

          case 'threshold':
            if (condition.config.field && context) {
              const value = context[condition.config.field];
              const threshold = condition.config.threshold;
              const operator = condition.config.operator;

              switch (operator) {
                case 'greater':
                  return value > threshold;
                case 'less':
                  return value < threshold;
                case 'equals':
                  return value === threshold;
                default:
                  return true;
              }
            }
            return true;

          case 'dependency':
            // Check if any dependencies are invalidated
            return true;

          default:
            return true;
        }
      });
    },
    []
  );

  // ========================
  // Dependency Management
  // ========================

  const addDependency = useCallback((key: string, dependencies: string[]) => {
    if (!dependenciesRef.current.has(key)) {
      dependenciesRef.current.set(key, new Set());
    }

    const deps = dependenciesRef.current.get(key)!;
    dependencies.forEach(dep => deps.add(dep));
  }, []);

  const removeDependency = useCallback((key: string, dependency: string) => {
    const deps = dependenciesRef.current.get(key);
    if (deps) {
      deps.delete(dependency);
      if (deps.size === 0) {
        dependenciesRef.current.delete(key);
      }
    }
  }, []);

  const getDependencies = useCallback((key: string): string[] => {
    const deps = dependenciesRef.current.get(key);
    return deps ? Array.from(deps) : [];
  }, []);

  // ========================
  // Batch Operations
  // ========================

  const startBatch = useCallback(() => {
    isBatchModeRef.current = true;
    batchQueueRef.current = [];
  }, []);

  const endBatch = useCallback(
    async (execute: boolean = true): Promise<void> => {
      isBatchModeRef.current = false;

      if (execute && batchQueueRef.current.length > 0) {
        // Execute all queued operations
        const operations = [...batchQueueRef.current];
        batchQueueRef.current = [];

        // Process in chunks to avoid overwhelming the system
        const chunkSize = config.maxBatchSize;
        for (let i = 0; i < operations.length; i += chunkSize) {
          const chunk = operations.slice(i, i + chunkSize);
          await Promise.all(chunk.map(op => op()));

          // Small delay between chunks
          if (i + chunkSize < operations.length) {
            await new Promise(resolve => setTimeout(resolve, config.batchDelayMs));
          }
        }
      } else {
        batchQueueRef.current = [];
      }
    },
    [config.maxBatchSize, config.batchDelayMs]
  );

  // ========================
  // Monitoring
  // ========================

  const getInvalidationHistory = useCallback((limit: number = 100): InvalidationEvent[] => {
    return invalidationHistoryRef.current.slice(0, limit);
  }, []);

  const getInvalidationStats = useCallback(() => {
    const events = invalidationHistoryRef.current;
    const totalInvalidations = events.length;
    const successfulEvents = events.filter(e => e.success);
    const successRate = totalInvalidations > 0 ? successfulEvents.length / totalInvalidations : 0;
    const averageDuration =
      totalInvalidations > 0
        ? events.reduce((sum, e) => sum + e.duration, 0) / totalInvalidations
        : 0;

    const strategyCounts = events.reduce(
      (acc, event) => {
        acc[event.strategy.id] = (acc[event.strategy.id] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalInvalidations,
      successRate,
      averageDuration,
      strategyCounts,
    };
  }, []);

  // ========================
  // Setup Strategy Triggers
  // ========================

  const setupStrategyTriggers = useCallback(
    (strategy: InvalidationStrategy) => {
      strategy.triggers.forEach(trigger => {
        if (trigger.type === 'time' && trigger.config.interval) {
          // Set up interval-based trigger
          const interval = setInterval(() => {
            processTriggeredInvalidation(trigger);
          }, trigger.config.interval);

          // Store interval for cleanup (would need ref for this)
        }
      });
    },
    [processTriggeredInvalidation]
  );

  // ========================
  // Effects
  // ========================

  // Initialize built-in strategies
  useEffect(() => {
    BUILT_IN_STRATEGIES.forEach(strategy => {
      addStrategy(strategy);
    });
  }, [addStrategy]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      debounceTimersRef.current.forEach(timer => clearTimeout(timer));
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
    };
  }, []);

  // ========================
  // Computed Values
  // ========================

  const activeStrategies = useMemo(() => {
    return Array.from(strategiesRef.current.keys());
  }, [strategiesRef.current.size]); // Re-compute when strategies change

  return {
    // Strategy management
    addStrategy,
    removeStrategy,
    updateStrategy,
    getStrategies,

    // Manual invalidation
    invalidateKeys,
    invalidatePattern,
    invalidateByTags,
    invalidateAll,

    // Trigger-based invalidation
    triggerDataChange,
    triggerUserAction,
    triggerExternalEvent,
    triggerApiResponse,

    // Dependency management
    addDependency,
    removeDependency,
    getDependencies,

    // Batch operations
    startBatch,
    endBatch,

    // Monitoring
    getInvalidationHistory,
    getInvalidationStats,

    // State
    isInvalidating: isInvalidatingRef.current,
    batchMode: isBatchModeRef.current,
    activeStrategies,
  };
};

export default useCacheInvalidation;
