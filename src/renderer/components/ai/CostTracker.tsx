import React, { useState, useEffect, useCallback } from 'react';
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, Calendar, Zap, Clock } from 'lucide-react';
import { CostTrackerProps, BudgetStatus, AIUsageSummary, DailyAICosts, AIBudgetAlert } from '../../types/ai';

interface CostTrackerState {
  budgetStatus: BudgetStatus[];
  usageSummary: AIUsageSummary | null;
  dailyCosts: DailyAICosts[];
  alerts: AIBudgetAlert[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

const CostTracker: React.FC<CostTrackerProps> = ({
  userId,
  compact = false,
  showBudgetAlerts = true,
  refreshIntervalMs = 30000, // 30 seconds
}) => {
  const [state, setState] = useState<CostTrackerState>({
    budgetStatus: [],
    usageSummary: null,
    dailyCosts: [],
    alerts: [],
    isLoading: true,
    error: null,
    lastUpdated: null,
  });

  // Mock API calls - replace with actual service calls
  const fetchBudgetStatus = useCallback(async () => {
    // Mock implementation - replace with actual API call
    return [
      {
        budgetId: 1,
        userId,
        budgetType: 'monthly' as const,
        budgetAmount: 50.0,
        currentUsage: 32.45,
        usagePercentage: 64.9,
        remainingBudget: 17.55,
        status: 'caution' as const,
        resetDate: '2024-10-01',
        updatedAt: new Date().toISOString(),
      },
      {
        budgetId: 2,
        userId,
        budgetType: 'daily' as const,
        budgetAmount: 5.0,
        currentUsage: 4.25,
        usagePercentage: 85.0,
        remainingBudget: 0.75,
        status: 'warning' as const,
        resetDate: new Date().toDateString(),
        updatedAt: new Date().toISOString(),
      }
    ];
  }, [userId]);

  const fetchUsageSummary = useCallback(async () => {
    // Mock implementation - replace with actual API call
    return {
      userId,
      totalOperations: 1247,
      approvedOperations: 1180,
      deniedOperations: 67,
      totalCost: 156.78,
      avgCostPerOperation: 0.1258,
      totalInputTokens: 125000,
      totalOutputTokens: 89000,
      avgExecutionTime: 2340,
      lastOperation: new Date().toISOString(),
    };
  }, [userId]);

  const fetchDailyCosts = useCallback(async () => {
    // Mock implementation - replace with actual API call
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      last7Days.push({
        userId,
        operationDate: date.toISOString().split('T')[0],
        provider: 'openai' as const,
        operationType: 'search' as const,
        operationCount: Math.floor(Math.random() * 50) + 10,
        dailyCost: Math.random() * 10 + 1,
        dailyInputTokens: Math.floor(Math.random() * 5000) + 1000,
        dailyOutputTokens: Math.floor(Math.random() * 3000) + 500,
      });
    }
    return last7Days;
  }, [userId]);

  const fetchAlerts = useCallback(async () => {
    // Mock implementation - replace with actual API call
    return [
      {
        id: 1,
        userId,
        budgetId: 2,
        alertType: '80_percent' as const,
        currentUsage: 4.25,
        budgetAmount: 5.0,
        percentageUsed: 85.0,
        acknowledged: false,
        createdAt: new Date().toISOString(),
      }
    ];
  }, [userId]);

  const loadData = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const [budgetStatus, usageSummary, dailyCosts, alerts] = await Promise.all([
        fetchBudgetStatus(),
        fetchUsageSummary(),
        fetchDailyCosts(),
        fetchAlerts(),
      ]);

      setState(prev => ({
        ...prev,
        budgetStatus,
        usageSummary,
        dailyCosts,
        alerts,
        isLoading: false,
        lastUpdated: new Date(),
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load cost data',
        isLoading: false,
      }));
    }
  }, [fetchBudgetStatus, fetchUsageSummary, fetchDailyCosts, fetchAlerts]);

  // Load data on mount and set up refresh interval
  useEffect(() => {
    loadData();

    const interval = setInterval(loadData, refreshIntervalMs);
    return () => clearInterval(interval);
  }, [loadData, refreshIntervalMs]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(amount);
  };

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  const getBudgetStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'text-green-600 bg-green-100';
      case 'caution': return 'text-yellow-600 bg-yellow-100';
      case 'warning': return 'text-orange-600 bg-orange-100';
      case 'critical': return 'text-red-600 bg-red-100';
      case 'exceeded': return 'text-red-800 bg-red-200';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const acknowledgeAlert = async (alertId: number) => {
    // Mock implementation - replace with actual API call
    setState(prev => ({
      ...prev,
      alerts: prev.alerts.filter(alert => alert.id !== alertId),
    }));
  };

  if (state.isLoading && !state.lastUpdated) {
    return (
      <div className="bg-white rounded-lg border p-4 animate-pulse">
        <div className="h-6 bg-gray-200 rounded mb-4" />
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center space-x-2 text-red-800">
          <AlertTriangle className="w-5 h-5" />
          <span className="font-medium">Error loading cost data</span>
        </div>
        <p className="text-red-600 text-sm mt-1">{state.error}</p>
        <button
          onClick={loadData}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="bg-white rounded-lg border p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm flex items-center space-x-1">
            <DollarSign className="w-4 h-4" />
            <span>AI Costs</span>
          </h3>
          {state.alerts.length > 0 && (
            <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
              {state.alerts.length} alert{state.alerts.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="space-y-2 text-sm">
          {state.budgetStatus.map((budget) => (
            <div key={budget.budgetId} className="flex items-center justify-between">
              <span className="capitalize">{budget.budgetType}:</span>
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 rounded text-xs ${getBudgetStatusColor(budget.status)}`}>
                  {formatPercentage(budget.usagePercentage)}
                </span>
                <span className="font-mono text-xs">
                  {formatCurrency(budget.currentUsage)} / {formatCurrency(budget.budgetAmount)}
                </span>
              </div>
            </div>
          ))}

          {state.usageSummary && (
            <div className="pt-2 border-t flex items-center justify-between">
              <span>Total Operations:</span>
              <span className="font-medium">{state.usageSummary.totalOperations}</span>
            </div>
          )}
        </div>

        {state.lastUpdated && (
          <div className="text-xs text-gray-500 mt-2 flex items-center space-x-1">
            <Clock className="w-3 h-3" />
            <span>Updated {state.lastUpdated.toLocaleTimeString()}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Budget Alerts */}
      {showBudgetAlerts && state.alerts.length > 0 && (
        <div className="space-y-2">
          {state.alerts.map((alert) => (
            <div key={alert.id} className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <div>
                    <h4 className="font-medium text-red-800">Budget Alert</h4>
                    <p className="text-sm text-red-600">
                      {alert.alertType.replace('_', ' ').replace('percent', '%')} threshold reached
                      ({formatPercentage(alert.percentageUsed)} of budget used)
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => acknowledgeAlert(alert.id)}
                  className="text-sm text-red-600 hover:text-red-800 px-3 py-1 border border-red-300 rounded"
                >
                  Acknowledge
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Budget Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {state.budgetStatus.map((budget) => (
          <div key={budget.budgetId} className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold capitalize flex items-center space-x-2">
                <Calendar className="w-4 h-4" />
                <span>{budget.budgetType} Budget</span>
              </h3>
              <span className={`px-2 py-1 rounded text-sm ${getBudgetStatusColor(budget.status)}`}>
                {budget.status}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Used:</span>
                <span className="font-mono">{formatCurrency(budget.currentUsage)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Budget:</span>
                <span className="font-mono">{formatCurrency(budget.budgetAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Remaining:</span>
                <span className="font-mono">{formatCurrency(budget.remainingBudget)}</span>
              </div>

              {/* Progress Bar */}
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>0%</span>
                  <span>{formatPercentage(budget.usagePercentage)}</span>
                  <span>100%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      budget.usagePercentage >= 95 ? 'bg-red-500' :
                      budget.usagePercentage >= 80 ? 'bg-orange-500' :
                      budget.usagePercentage >= 50 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(budget.usagePercentage, 100)}%` }}
                  />
                </div>
              </div>

              <div className="text-xs text-gray-500 mt-2">
                Resets on {new Date(budget.resetDate).toLocaleDateString()}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Usage Summary */}
      {state.usageSummary && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-semibold mb-4 flex items-center space-x-2">
            <Zap className="w-4 h-4" />
            <span>Usage Summary</span>
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {state.usageSummary.totalOperations}
              </div>
              <div className="text-sm text-gray-600">Total Operations</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(state.usageSummary.totalCost)}
              </div>
              <div className="text-sm text-gray-600">Total Cost</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency(state.usageSummary.avgCostPerOperation)}
              </div>
              <div className="text-sm text-gray-600">Avg Cost/Op</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {Math.round(state.usageSummary.avgExecutionTime)}ms
              </div>
              <div className="text-sm text-gray-600">Avg Time</div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between">
              <span>Approved Operations:</span>
              <span className="font-medium text-green-600">
                {state.usageSummary.approvedOperations}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Denied Operations:</span>
              <span className="font-medium text-red-600">
                {state.usageSummary.deniedOperations}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Input Tokens:</span>
              <span className="font-mono">
                {state.usageSummary.totalInputTokens.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Output Tokens:</span>
              <span className="font-mono">
                {state.usageSummary.totalOutputTokens.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Daily Costs Chart */}
      {state.dailyCosts.length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-semibold mb-4 flex items-center space-x-2">
            <TrendingUp className="w-4 h-4" />
            <span>Daily Costs (Last 7 Days)</span>
          </h3>

          <div className="space-y-2">
            {state.dailyCosts.map((day, index) => {
              const maxCost = Math.max(...state.dailyCosts.map(d => d.dailyCost));
              const percentage = (day.dailyCost / maxCost) * 100;

              return (
                <div key={index} className="flex items-center space-x-3">
                  <div className="w-20 text-sm text-gray-600">
                    {new Date(day.operationDate).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>
                  <div className="flex-1">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-16 text-sm font-mono text-right">
                    {formatCurrency(day.dailyCost)}
                  </div>
                  <div className="w-12 text-xs text-gray-500 text-right">
                    {day.operationCount} ops
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Last Updated */}
      {state.lastUpdated && (
        <div className="text-center text-sm text-gray-500 flex items-center justify-center space-x-1">
          <Clock className="w-4 h-4" />
          <span>Last updated: {state.lastUpdated.toLocaleString()}</span>
          <button
            onClick={loadData}
            className="ml-2 text-blue-600 hover:text-blue-800 underline"
            disabled={state.isLoading}
          >
            {state.isLoading ? 'Updating...' : 'Refresh'}
          </button>
        </div>
      )}
    </div>
  );
};

export default CostTracker;

