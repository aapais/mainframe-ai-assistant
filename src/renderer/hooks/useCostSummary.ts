/**
 * Cost Summary Hook - TASK-005 Implementation
 *
 * Custom hook for managing cost summary data and real-time updates:
 * 1. Real-time cost data management
 * 2. Budget status calculations
 * 3. Alert threshold monitoring
 * 4. Mock data simulation for development
 * 5. Integration with SettingsContext
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useCostTracking } from '../contexts/SettingsContext';

// ============================================================================
// TYPES
// ============================================================================

export interface CostMetrics {
  currentSpend: number;
  monthlyBudget: number;
  dailySpend: number;
  dailyBudget: number;
  budgetUtilization: number;
  operationsToday: number;
  operationsThisMonth: number;
  projectedMonthlySpend: number;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
  alertStatus: 'normal' | 'caution' | 'warning' | 'critical' | 'exceeded';
  alertThreshold: number;
  lastUpdated: Date;
}

export interface UseCostSummaryOptions {
  /** Enable real-time updates */
  realTimeUpdates?: boolean;
  /** Update interval in milliseconds */
  updateInterval?: number;
  /** Use mock data for development */
  useMockData?: boolean;
  /** User ID for cost tracking */
  userId?: string;
}

export interface UseCostSummaryReturn {
  /** Current cost metrics */
  metrics: CostMetrics;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
  /** Refresh data manually */
  refreshData: () => Promise<void>;
  /** Get alert status for current metrics */
  getAlertStatus: () => CostMetrics['alertStatus'];
  /** Check if budget threshold is exceeded */
  isBudgetExceeded: (threshold?: number) => boolean;
  /** Format currency amount */
  formatCurrency: (amount: number) => string;
  /** Format percentage */
  formatPercentage: (value: number) => string;
  /** Calculate projected monthly spend */
  calculateProjectedSpend: () => number;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export const useCostSummary = ({
  realTimeUpdates = true,
  updateInterval = 30000,
  useMockData = true,
  userId = 'current_user'
}: UseCostSummaryOptions = {}): UseCostSummaryReturn => {
  // ============================================================================
  // STATE AND HOOKS
  // ============================================================================

  const { costTracking } = useCostTracking();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastApiCall, setLastApiCall] = useState<Date | null>(null);

  // Mock data state (in production, this would come from API)
  const [mockMetrics, setMockMetrics] = useState<CostMetrics>(() => ({
    currentSpend: 78.45,
    monthlyBudget: costTracking.monthlyBudget || 100,
    dailySpend: 2.35,
    dailyBudget: costTracking.dailyBudget || 5,
    budgetUtilization: 78.45,
    operationsToday: 24,
    operationsThisMonth: 547,
    projectedMonthlySpend: 96.2,
    trend: 'up',
    trendPercentage: 8.3,
    alertStatus: 'warning',
    alertThreshold: 80,
    lastUpdated: new Date()
  }));

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const formatCurrency = useCallback((amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: costTracking.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  }, [costTracking.currency]);

  const formatPercentage = useCallback((value: number): string => {
    return `${Math.round(value)}%`;
  }, []);

  const calculateProjectedSpend = useCallback(() => {
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const dayOfMonth = new Date().getDate();
    return mockMetrics.currentSpend * (daysInMonth / dayOfMonth);
  }, [mockMetrics.currentSpend]);

  const getAlertStatus = useCallback((): CostMetrics['alertStatus'] => {
    const budgetUtilization = mockMetrics.monthlyBudget > 0
      ? (mockMetrics.currentSpend / mockMetrics.monthlyBudget) * 100
      : 0;

    if (budgetUtilization >= 100) return 'exceeded';
    if (budgetUtilization >= 95) return 'critical';
    if (budgetUtilization >= 80) return 'warning';
    if (budgetUtilization >= 50) return 'caution';
    return 'normal';
  }, [mockMetrics.currentSpend, mockMetrics.monthlyBudget]);

  const isBudgetExceeded = useCallback((threshold: number = 100): boolean => {
    const budgetUtilization = mockMetrics.monthlyBudget > 0
      ? (mockMetrics.currentSpend / mockMetrics.monthlyBudget) * 100
      : 0;
    return budgetUtilization >= threshold;
  }, [mockMetrics.currentSpend, mockMetrics.monthlyBudget]);

  // ============================================================================
  // API FUNCTIONS
  // ============================================================================

  const fetchRealCostData = useCallback(async (): Promise<CostMetrics> => {
    // In production, this would make actual API calls
    // For now, simulate with mock data variations
    await new Promise(resolve => setTimeout(resolve, 1000));

    const variation = (Math.random() - 0.5) * 0.1; // ±5% variation
    const operationVariation = Math.floor(Math.random() * 5);

    return {
      ...mockMetrics,
      currentSpend: Math.max(0, mockMetrics.currentSpend + (mockMetrics.currentSpend * variation)),
      dailySpend: Math.max(0, mockMetrics.dailySpend + (mockMetrics.dailySpend * variation * 0.5)),
      operationsToday: mockMetrics.operationsToday + operationVariation,
      operationsThisMonth: mockMetrics.operationsThisMonth + operationVariation,
      lastUpdated: new Date()
    };
  }, [mockMetrics]);

  const refreshData = useCallback(async (): Promise<void> => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      let newMetrics: CostMetrics;

      if (useMockData) {
        // Use mock data with simulated updates
        newMetrics = await fetchRealCostData();
      } else {
        // In production, fetch from actual API
        // For now, fall back to mock data
        newMetrics = await fetchRealCostData();
      }

      // Update budget values from settings
      newMetrics.monthlyBudget = costTracking.monthlyBudget || 100;
      newMetrics.dailyBudget = costTracking.dailyBudget || 5;
      newMetrics.budgetUtilization = newMetrics.monthlyBudget > 0
        ? (newMetrics.currentSpend / newMetrics.monthlyBudget) * 100
        : 0;
      newMetrics.alertStatus = getAlertStatus();
      newMetrics.projectedMonthlySpend = calculateProjectedSpend();

      // Determine trend
      if (lastApiCall) {
        const timeDiff = newMetrics.lastUpdated.getTime() - lastApiCall.getTime();
        const spendDiff = newMetrics.currentSpend - mockMetrics.currentSpend;
        const trendThreshold = 0.01; // $0.01 threshold for trend detection

        if (Math.abs(spendDiff) < trendThreshold) {
          newMetrics.trend = 'stable';
          newMetrics.trendPercentage = 0;
        } else {
          newMetrics.trend = spendDiff > 0 ? 'up' : 'down';
          newMetrics.trendPercentage = mockMetrics.currentSpend > 0
            ? Math.abs((spendDiff / mockMetrics.currentSpend) * 100)
            : 0;
        }
      }

      setMockMetrics(newMetrics);
      setLastApiCall(newMetrics.lastUpdated);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh cost data');
      console.error('Error refreshing cost data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, useMockData, fetchRealCostData, costTracking, getAlertStatus, calculateProjectedSpend, lastApiCall, mockMetrics]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const metrics = useMemo(() => {
    // Always return up-to-date metrics with current settings
    const budgetUtilization = mockMetrics.monthlyBudget > 0
      ? (mockMetrics.currentSpend / mockMetrics.monthlyBudget) * 100
      : 0;

    return {
      ...mockMetrics,
      monthlyBudget: costTracking.monthlyBudget || 100,
      dailyBudget: costTracking.dailyBudget || 5,
      budgetUtilization,
      alertStatus: getAlertStatus(),
      projectedMonthlySpend: calculateProjectedSpend()
    };
  }, [mockMetrics, costTracking, getAlertStatus, calculateProjectedSpend]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Real-time updates
  useEffect(() => {
    if (!realTimeUpdates) return;

    const interval = setInterval(() => {
      refreshData();
    }, updateInterval);

    return () => clearInterval(interval);
  }, [realTimeUpdates, updateInterval, refreshData]);

  // Initial data fetch
  useEffect(() => {
    refreshData();
  }, []);

  // Update metrics when settings change
  useEffect(() => {
    setMockMetrics(prev => ({
      ...prev,
      monthlyBudget: costTracking.monthlyBudget || 100,
      dailyBudget: costTracking.dailyBudget || 5
    }));
  }, [costTracking.monthlyBudget, costTracking.dailyBudget]);

  // ============================================================================
  // RETURN VALUE
  // ============================================================================

  return {
    metrics,
    isLoading,
    error,
    refreshData,
    getAlertStatus,
    isBudgetExceeded,
    formatCurrency,
    formatPercentage,
    calculateProjectedSpend
  };
};