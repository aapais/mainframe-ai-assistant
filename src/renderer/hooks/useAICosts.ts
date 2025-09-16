import { useState, useEffect, useCallback } from 'react';
import { AICostsHookReturn, CostData, DailyCostSummary, CostAlert, CostLimit } from '../../types/cost';

declare global {
  interface Window {
    electronAPI?: {
      getCostData: () => Promise<CostData>;
      getDailySummary: () => Promise<DailyCostSummary>;
      getCostAlerts: () => Promise<CostAlert[]>;
      getCostLimits: () => Promise<CostLimit[]>;
      dismissAlert: (alertId: string) => Promise<void>;
      updateCostLimit: (type: 'daily' | 'monthly', amount: number) => Promise<void>;
      onCostUpdate: (callback: (data: CostData) => void) => () => void;
    };
  }
}

export const useAICosts = (): AICostsHookReturn => {
  const [costData, setCostData] = useState<CostData | null>(null);
  const [dailySummary, setDailySummary] = useState<DailyCostSummary | null>(null);
  const [alerts, setAlerts] = useState<CostAlert[]>([]);
  const [limits, setLimits] = useState<CostLimit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshCosts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (!window.electronAPI) {
        // Fallback to mock data for development
        const mockCostData: CostData = {
          sessionCost: 2.45,
          dailyCost: 15.67,
          monthlyCost: 234.89,
          trend: 'up',
          trendPercentage: 12.5
        };

        const mockDailySummary: DailyCostSummary = {
          today: [
            { operationType: 'Text Generation', count: 45, totalCost: 8.90, averageCost: 0.198 },
            { operationType: 'Code Analysis', count: 12, totalCost: 3.24, averageCost: 0.270 },
            { operationType: 'Search Queries', count: 23, totalCost: 2.53, averageCost: 0.110 },
            { operationType: 'Data Processing', count: 8, totalCost: 1.00, averageCost: 0.125 }
          ],
          yesterday: [
            { operationType: 'Text Generation', count: 38, totalCost: 7.60, averageCost: 0.200 },
            { operationType: 'Code Analysis', count: 15, totalCost: 4.05, averageCost: 0.270 },
            { operationType: 'Search Queries', count: 19, totalCost: 2.09, averageCost: 0.110 },
            { operationType: 'Data Processing', count: 6, totalCost: 0.75, averageCost: 0.125 }
          ],
          totalToday: 15.67,
          totalYesterday: 14.49,
          comparison: 8.1
        };

        const mockAlerts: CostAlert[] = [
          {
            id: 'alert-1',
            severity: 'warning',
            message: 'Daily cost limit 80% reached',
            percentage: 82,
            dismissed: false,
            timestamp: new Date()
          }
        ];

        const mockLimits: CostLimit[] = [
          { daily: 20, monthly: 300, current: 15.67, type: 'daily' },
          { daily: 20, monthly: 300, current: 234.89, type: 'monthly' }
        ];

        setCostData(mockCostData);
        setDailySummary(mockDailySummary);
        setAlerts(mockAlerts);
        setLimits(mockLimits);
        return;
      }

      const [costDataResponse, summaryResponse, alertsResponse, limitsResponse] = await Promise.all([
        window.electronAPI.getCostData(),
        window.electronAPI.getDailySummary(),
        window.electronAPI.getCostAlerts(),
        window.electronAPI.getCostLimits()
      ]);

      setCostData(costDataResponse);
      setDailySummary(summaryResponse);
      setAlerts(alertsResponse);
      setLimits(limitsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch cost data');
    } finally {
      setLoading(false);
    }
  }, []);

  const dismissAlert = useCallback(async (alertId: string) => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.dismissAlert(alertId);
      }
      setAlerts(prev => prev.map(alert =>
        alert.id === alertId ? { ...alert, dismissed: true } : alert
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to dismiss alert');
    }
  }, []);

  const updateLimit = useCallback(async (type: 'daily' | 'monthly', amount: number) => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.updateCostLimit(type, amount);
      }
      setLimits(prev => prev.map(limit =>
        limit.type === type ? { ...limit, [type]: amount } : limit
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update limit');
    }
  }, []);

  useEffect(() => {
    refreshCosts();

    // Set up real-time cost updates
    if (window.electronAPI?.onCostUpdate) {
      const unsubscribe = window.electronAPI.onCostUpdate((data: CostData) => {
        setCostData(data);
      });

      return unsubscribe;
    }
  }, [refreshCosts]);

  return {
    costData,
    dailySummary,
    alerts,
    limits,
    loading,
    error,
    refreshCosts,
    dismissAlert,
    updateLimit
  };
};