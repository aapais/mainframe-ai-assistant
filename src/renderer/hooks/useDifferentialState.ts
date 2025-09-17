/**
 * Differential State Hook
 *
 * React hook for managing state with differential updates.
 * Integrates with the DifferentialStateManager to provide minimal data transfer.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { differentialStateManager, StateChange, StateVersion } from '../../shared/utils/DifferentialStateManager';
import { batchedIPC } from '../utils/BatchedIPCManager';

export interface UseDifferentialStateOptions<T> {
  stateKey: string;
  initialData?: T;
  enableBatching?: boolean;
  batchKey?: string;
  syncInterval?: number;
  enableCompression?: boolean;
  maxHistoryVersions?: number;
  onError?: (error: Error) => void;
  onStateChange?: (change: StateChange<T>) => void;
  transformData?: (data: any) => T;
  enableMetrics?: boolean;
}

export interface DifferentialStateMetrics {
  totalUpdates: number;
  differentialUpdates: number;
  fullUpdates: number;
  averageCompressionRatio: number;
  totalBytesSaved: number;
  lastUpdateTime: number;
  currentVersion: number;
}

export interface DifferentialStateResult<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  version: number;
  metrics: DifferentialStateMetrics;
  actions: {
    refresh: () => Promise<void>;
    updateState: (newData: T) => Promise<void>;
    clearState: () => void;
    getHistory: (versions?: number) => StateVersion<T>[];
    rollbackTo: (version: number) => Promise<boolean>;
  };
}

/**
 * Hook for managing differential state updates
 */
export function useDifferentialState<T = any>(
  options: UseDifferentialStateOptions<T>
): DifferentialStateResult<T> {
  const {
    stateKey,
    initialData,
    enableBatching = true,
    batchKey,
    syncInterval = 0, // 0 = no auto-sync
    enableCompression = true,
    maxHistoryVersions = 5,
    onError,
    onStateChange,
    transformData,
    enableMetrics = true
  } = options;

  // State management
  const [data, setData] = useState<T | null>(initialData || null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [version, setVersion] = useState<number>(0);
  const [metrics, setMetrics] = useState<DifferentialStateMetrics>({
    totalUpdates: 0,
    differentialUpdates: 0,
    fullUpdates: 0,
    averageCompressionRatio: 0,
    totalBytesSaved: 0,
    lastUpdateTime: 0,
    currentVersion: 0
  });

  // Refs for stable references
  const subscriptionRef = useRef<string | null>(null);
  const syncIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const metricsRef = useRef<DifferentialStateMetrics>(metrics);

  // Update metrics ref when metrics change
  useEffect(() => {
    metricsRef.current = metrics;
  }, [metrics]);

  // Memoized batch configuration
  const batchConfig = useMemo(() => {
    if (!enableBatching) return undefined;
    return {
      batchKey: batchKey || `differential-${stateKey}`,
      priority: 'medium' as const,
      timeout: 10000
    };
  }, [enableBatching, batchKey, stateKey]);

  // Handle state changes from the differential manager
  const handleStateChange = useCallback((change: StateChange<T>) => {
    try {
      let newData: T;

      // Check if this is a full replacement or differential update
      if (change.patches.length === 1 &&
          change.patches[0].op === 'replace' &&
          change.patches[0].path === '') {
        // Full replacement
        newData = transformData ? transformData(change.patches[0].value) : change.patches[0].value;

        if (enableMetrics) {
          setMetrics(prev => ({
            ...prev,
            totalUpdates: prev.totalUpdates + 1,
            fullUpdates: prev.fullUpdates + 1,
            lastUpdateTime: Date.now(),
            currentVersion: change.currentVersion
          }));
        }
      } else {
        // Differential update - apply patches to current data
        if (!data) {
          console.warn('Received differential update but no base data available');
          return;
        }

        // This would normally apply patches, but since we're working with React state,
        // we'll request the full updated data from the differential manager
        const currentState = differentialStateManager.getState<T>(stateKey);
        if (currentState) {
          newData = transformData ? transformData(currentState.data) : currentState.data;
        } else {
          return;
        }

        if (enableMetrics) {
          setMetrics(prev => {
            const newMetrics = {
              ...prev,
              totalUpdates: prev.totalUpdates + 1,
              differentialUpdates: prev.differentialUpdates + 1,
              lastUpdateTime: Date.now(),
              currentVersion: change.currentVersion,
              totalBytesSaved: prev.totalBytesSaved + (change.metadata.estimatedSavings || 0),
            };

            // Update average compression ratio
            const totalDifferential = newMetrics.differentialUpdates;
            if (totalDifferential > 0) {
              const oldAvg = prev.averageCompressionRatio * (totalDifferential - 1);
              newMetrics.averageCompressionRatio =
                (oldAvg + change.compressionRatio) / totalDifferential;
            }

            return newMetrics;
          });
        }
      }

      setData(newData);
      setVersion(change.currentVersion);
      setError(null);

      // Call user-defined change handler
      onStateChange?.(change);

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to apply state change');
      setError(error);
      onError?.(error);
    }
  }, [data, stateKey, transformData, onStateChange, onError, enableMetrics]);

  // Initialize subscription
  useEffect(() => {
    const subscriptionId = differentialStateManager.subscribe<T>(
      stateKey,
      handleStateChange,
      {
        immediate: true,
        throttleMs: 50, // Throttle rapid updates
        maxDiffSize: 100 * 1024, // 100KB max diff size
        fallbackToFull: true
      }
    );

    subscriptionRef.current = subscriptionId;

    // Setup auto-sync if enabled
    if (syncInterval > 0) {
      syncIntervalRef.current = setInterval(() => {
        refresh();
      }, syncInterval);
    }

    return () => {
      if (subscriptionRef.current) {
        differentialStateManager.unsubscribe(subscriptionRef.current);
      }
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [stateKey, handleStateChange, syncInterval]);

  // Refresh data from server
  const refresh = useCallback(async () => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      let newData: T;

      if (enableBatching && batchConfig) {
        // Use batched IPC for better performance
        newData = await batchedIPC.executeRequest<T>(
          `state:get-${stateKey}`,
          [],
          batchConfig
        );
      } else {
        // Direct IPC call
        if (!window.electronAPI?.state?.get) {
          throw new Error('State API not available');
        }
        const response = await window.electronAPI.state.get(stateKey);
        newData = response.success ? response.data : Promise.reject(response.error);
      }

      // Apply data transformation if provided
      if (transformData) {
        newData = transformData(newData);
      }

      // Update differential state manager
      const stateChange = await differentialStateManager.setState(
        stateKey,
        newData,
        {
          enableCompression,
          maxHistoryVersions
        }
      );

      // The handleStateChange will be called automatically if there were changes
      if (!stateChange) {
        // No changes, but update our local state to ensure consistency
        setData(newData);
        const currentState = differentialStateManager.getState<T>(stateKey);
        if (currentState) {
          setVersion(currentState.version);
        }
      }

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to refresh state');
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [stateKey, isLoading, enableBatching, batchConfig, transformData,
      enableCompression, maxHistoryVersions, onError]);

  // Update state locally and sync to server
  const updateState = useCallback(async (newData: T) => {
    try {
      // Update differential state manager first
      const stateChange = await differentialStateManager.setState(
        stateKey,
        newData,
        {
          enableCompression,
          maxHistoryVersions
        }
      );

      // Send update to server if batching is enabled
      if (enableBatching && batchConfig && stateChange) {
        try {
          await batchedIPC.executeRequest(
            `state:update-${stateKey}`,
            [stateChange],
            { ...batchConfig, priority: 'high' }
          );
        } catch (err) {
          console.warn('Failed to sync state change to server:', err);
          // Continue with local update even if server sync fails
        }
      }

      // The handleStateChange will be called automatically

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update state');
      setError(error);
      onError?.(error);
    }
  }, [stateKey, enableBatching, batchConfig, enableCompression, maxHistoryVersions, onError]);

  // Clear state
  const clearState = useCallback(() => {
    differentialStateManager.clearState(stateKey);
    setData(null);
    setVersion(0);
    setError(null);
    setMetrics({
      totalUpdates: 0,
      differentialUpdates: 0,
      fullUpdates: 0,
      averageCompressionRatio: 0,
      totalBytesSaved: 0,
      lastUpdateTime: 0,
      currentVersion: 0
    });
  }, [stateKey]);

  // Get state history
  const getHistory = useCallback((versions?: number): StateVersion<T>[] => {
    const currentState = differentialStateManager.getState<T>(stateKey);
    if (!currentState) return [];

    // For now, return just the current state
    // In a full implementation, you'd access the version history
    return [currentState];
  }, [stateKey]);

  // Rollback to specific version
  const rollbackTo = useCallback(async (targetVersion: number): Promise<boolean> => {
    try {
      const targetState = differentialStateManager.getStateVersion<T>(stateKey, targetVersion);
      if (!targetState) {
        return false;
      }

      await updateState(targetState.data);
      return true;
    } catch (error) {
      console.error('Failed to rollback state:', error);
      return false;
    }
  }, [stateKey, updateState]);

  // Auto-refresh on mount if no initial data
  useEffect(() => {
    if (!data && !isLoading && !error) {
      refresh();
    }
  }, [data, isLoading, error, refresh]);

  return {
    data,
    isLoading,
    error,
    version,
    metrics,
    actions: {
      refresh,
      updateState,
      clearState,
      getHistory,
      rollbackTo
    }
  };
}

/**
 * Hook for multiple differential states
 */
export function useMultipleDifferentialStates<T extends Record<string, any>>(
  stateConfigs: Array<{
    key: keyof T;
    stateKey: string;
    options?: Partial<UseDifferentialStateOptions<T[keyof T]>>;
  }>
): Record<keyof T, DifferentialStateResult<T[keyof T]>> {
  const results = {} as Record<keyof T, DifferentialStateResult<T[keyof T]>>;

  stateConfigs.forEach(({ key, stateKey, options = {} }) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    results[key] = useDifferentialState({
      stateKey,
      enableBatching: true,
      ...options
    });
  });

  return results;
}

/**
 * Hook for aggregated differential state metrics
 */
export function useDifferentialStateMetrics(): {
  globalMetrics: any;
  isLoading: boolean;
  refresh: () => void;
} {
  const [globalMetrics, setGlobalMetrics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const refresh = useCallback(() => {
    setIsLoading(true);
    try {
      const metrics = differentialStateManager.getMetrics();
      setGlobalMetrics(metrics);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [refresh]);

  return {
    globalMetrics,
    isLoading,
    refresh
  };
}