/**
 * Cost Management Settings Component - TASK-003 Implementation
 *
 * Comprehensive cost management settings for the Mainframe AI Assistant including:
 * 1. Monthly/Daily budget limits configuration
 * 2. Alert thresholds (50%, 80%, 95%) with customization
 * 3. Currency selection with international support
 * 4. Cost breakdown by provider analysis
 * 5. Historical data view with trends
 * 6. Export cost reports functionality
 * 7. Integration with existing CostTracker component
 * 8. Migrated cost tracker configuration from AITransparencyPage
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Settings,
  Download,
  Calendar,
  PieChart,
  BarChart3,
  Clock,
  Bell,
  Save,
  RotateCcw,
  Eye,
  EyeOff,
  Plus,
  Minus,
  Filter,
  RefreshCw,
  Info,
  CheckCircle,
  AlertCircle,
  Target,
  Zap
} from 'lucide-react';

import { useCostTracking, useSettingsActions, useSettingsLoading, useSettingsError } from '../../contexts/SettingsContext';
import CostTracker from '../ai/CostTracker';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface CostBreakdown {
  provider: 'openai' | 'claude' | 'gemini' | 'local';
  monthlySpend: number;
  operationCount: number;
  avgCostPerOperation: number;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
}

interface HistoricalData {
  date: string;
  totalCost: number;
  dailyBudget: number;
  operationCount: number;
  providers: Record<string, number>;
}

interface AlertThreshold {
  id: string;
  percentage: number;
  amount: number;
  enabled: boolean;
  notificationTypes: {
    email: boolean;
    inApp: boolean;
    sound: boolean;
    webhook: boolean;
  };
}

interface CostReport {
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  startDate: string;
  endDate: string;
  totalCost: number;
  operationCount: number;
  avgCostPerOperation: number;
  budgetUtilization: number;
  topProviders: CostBreakdown[];
  historicalData: HistoricalData[];
}

// ============================================================================
// COMPONENT PROPS
// ============================================================================

export interface CostManagementSettingsProps {
  userId?: string;
  onSettingsChange?: (settings: any) => void;
  showAdvanced?: boolean;
  allowExport?: boolean;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const CostManagementSettings: React.FC<CostManagementSettingsProps> = ({
  userId = 'current_user',
  onSettingsChange,
  showAdvanced = true,
  allowExport = true
}) => {
  // ============================================================================
  // HOOKS AND STATE
  // ============================================================================

  const { costTracking, updateCostTracking } = useCostTracking();
  const { saveSettings } = useSettingsActions();
  const { isSaving } = useSettingsLoading();
  const { error, clearError } = useSettingsError();

  // Local state for UI management
  const [activeTab, setActiveTab] = useState<'budgets' | 'alerts' | 'providers' | 'history' | 'reports'>('budgets');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(showAdvanced);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [lastExportDate, setLastExportDate] = useState<Date | null>(null);

  // Mock data for demonstration (in real app, this would come from API)
  const [mockCostBreakdown] = useState<CostBreakdown[]>([
    {
      provider: 'openai',
      monthlySpend: 45.67,
      operationCount: 1247,
      avgCostPerOperation: 0.0366,
      trend: 'up',
      trendPercentage: 12.5
    },
    {
      provider: 'claude',
      monthlySpend: 23.45,
      operationCount: 532,
      avgCostPerOperation: 0.0441,
      trend: 'down',
      trendPercentage: -5.2
    },
    {
      provider: 'gemini',
      monthlySpend: 8.92,
      operationCount: 156,
      avgCostPerOperation: 0.0572,
      trend: 'stable',
      trendPercentage: 0.8
    },
    {
      provider: 'local',
      monthlySpend: 0.00,
      operationCount: 89,
      avgCostPerOperation: 0.0000,
      trend: 'stable',
      trendPercentage: 0.0
    }
  ]);

  const [mockHistoricalData] = useState<HistoricalData[]>(() => {
    const data: HistoricalData[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      data.push({
        date: date.toISOString().split('T')[0],
        totalCost: Math.random() * 8 + 1,
        dailyBudget: costTracking.dailyBudget || 10,
        operationCount: Math.floor(Math.random() * 50) + 5,
        providers: {
          openai: Math.random() * 4,
          claude: Math.random() * 2,
          gemini: Math.random() * 1,
          local: 0
        }
      });
    }
    return data;
  });

  // Custom alert thresholds state
  const [customAlertThresholds, setCustomAlertThresholds] = useState<AlertThreshold[]>(() =>
    costTracking.alertThresholds.map((threshold, index) => ({
      id: `threshold-${index}`,
      percentage: threshold.percentage,
      amount: threshold.amount,
      enabled: true,
      notificationTypes: {
        email: costTracking.notifications.email,
        inApp: costTracking.notifications.inApp,
        sound: false,
        webhook: !!costTracking.notifications.webhook
      }
    }))
  );

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const formatCurrency = useCallback((amount: number, currency = costTracking.currency): string => {
    const locale = currency === 'USD' ? 'en-US' : currency === 'EUR' ? 'en-EU' : 'en-GB';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(amount);
  }, [costTracking.currency]);

  const formatPercentage = useCallback((value: number): string => {
    return `${value.toFixed(1)}%`;
  }, []);

  const getCurrencySymbol = useCallback((currency: string): string => {
    switch (currency) {
      case 'USD': return '$';
      case 'EUR': return '€';
      case 'GBP': return '£';
      default: return '$';
    }
  }, []);

  const getTrendIcon = useCallback((trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-4 h-4 text-red-500" />;
      case 'down': return <TrendingDown className="w-4 h-4 text-green-500" />;
      default: return <BarChart3 className="w-4 h-4 text-gray-500" />;
    }
  }, []);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleSettingsUpdate = useCallback(async (updates: any) => {
    try {
      await updateCostTracking(updates);
      setUnsavedChanges(false);
      onSettingsChange?.(updates);
      clearError();
    } catch (error) {
      console.error('Failed to update cost tracking settings:', error);
    }
  }, [updateCostTracking, onSettingsChange, clearError]);

  const handleBudgetChange = useCallback((field: 'monthlyBudget' | 'dailyBudget', value: number) => {
    setUnsavedChanges(true);
    handleSettingsUpdate({ [field]: value });
  }, [handleSettingsUpdate]);

  const handleCurrencyChange = useCallback((currency: 'USD' | 'EUR' | 'GBP') => {
    setUnsavedChanges(true);
    handleSettingsUpdate({ currency });
  }, [handleSettingsUpdate]);

  const handleAlertThresholdUpdate = useCallback((thresholds: AlertThreshold[]) => {
    setCustomAlertThresholds(thresholds);
    setUnsavedChanges(true);

    const alertThresholds = thresholds.map(t => ({
      percentage: t.percentage,
      amount: t.amount
    }));

    handleSettingsUpdate({ alertThresholds });
  }, [handleSettingsUpdate]);

  const addAlertThreshold = useCallback(() => {
    const newThreshold: AlertThreshold = {
      id: `threshold-${Date.now()}`,
      percentage: 90,
      amount: (costTracking.monthlyBudget || 100) * 0.9,
      enabled: true,
      notificationTypes: {
        email: false,
        inApp: true,
        sound: false,
        webhook: false
      }
    };

    const updatedThresholds = [...customAlertThresholds, newThreshold];
    handleAlertThresholdUpdate(updatedThresholds);
  }, [customAlertThresholds, costTracking.monthlyBudget, handleAlertThresholdUpdate]);

  const removeAlertThreshold = useCallback((id: string) => {
    const updatedThresholds = customAlertThresholds.filter(t => t.id !== id);
    handleAlertThresholdUpdate(updatedThresholds);
  }, [customAlertThresholds, handleAlertThresholdUpdate]);

  const exportCostReport = useCallback(async (format: 'json' | 'csv' | 'pdf' = 'json') => {
    setExportLoading(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      const report: CostReport = {
        period: 'monthly',
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
        endDate: new Date().toISOString(),
        totalCost: mockCostBreakdown.reduce((sum, provider) => sum + provider.monthlySpend, 0),
        operationCount: mockCostBreakdown.reduce((sum, provider) => sum + provider.operationCount, 0),
        avgCostPerOperation: mockCostBreakdown.reduce((sum, provider) => sum + provider.avgCostPerOperation, 0) / mockCostBreakdown.length,
        budgetUtilization: ((mockCostBreakdown.reduce((sum, provider) => sum + provider.monthlySpend, 0) / (costTracking.monthlyBudget || 100)) * 100),
        topProviders: mockCostBreakdown,
        historicalData: mockHistoricalData
      };

      // Create and download file
      const dataStr = format === 'json'
        ? JSON.stringify(report, null, 2)
        : convertToCSV(report);

      const dataBlob = new Blob([dataStr], { type: format === 'json' ? 'application/json' : 'text/csv' });
      const url = URL.createObjectURL(dataBlob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `cost-report-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
      setLastExportDate(new Date());
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExportLoading(false);
    }
  }, [mockCostBreakdown, mockHistoricalData, costTracking.monthlyBudget]);

  // Simple CSV conversion helper
  const convertToCSV = useCallback((report: CostReport): string => {
    const headers = ['Date', 'Total Cost', 'Operations', 'Budget Utilization'];
    const rows = report.historicalData.map(day => [
      day.date,
      day.totalCost.toFixed(4),
      day.operationCount.toString(),
      ((day.totalCost / day.dailyBudget) * 100).toFixed(2) + '%'
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }, []);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const totalMonthlySpend = useMemo(() =>
    mockCostBreakdown.reduce((sum, provider) => sum + provider.monthlySpend, 0)
  , [mockCostBreakdown]);

  const budgetUtilization = useMemo(() =>
    costTracking.monthlyBudget ? (totalMonthlySpend / costTracking.monthlyBudget) * 100 : 0
  , [totalMonthlySpend, costTracking.monthlyBudget]);

  const projectedMonthlySpend = useMemo(() => {
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const dayOfMonth = new Date().getDate();
    return totalMonthlySpend * (daysInMonth / dayOfMonth);
  }, [totalMonthlySpend]);

  // ============================================================================
  // TAB COMPONENTS
  // ============================================================================

  const BudgetConfigurationTab = () => (
    <div className="space-y-6">
      {/* Budget Limits */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
          <Target className="w-5 h-5 text-blue-600" />
          <span>Budget Limits</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Monthly Budget Limit
            </label>
            <div className="flex items-center space-x-2">
              <span className="text-gray-500">{getCurrencySymbol(costTracking.currency)}</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={costTracking.monthlyBudget || ''}
                onChange={(e) => handleBudgetChange('monthlyBudget', parseFloat(e.target.value) || 0)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="100.00"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Current utilization: {formatPercentage(budgetUtilization)}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Daily Budget Limit
            </label>
            <div className="flex items-center space-x-2">
              <span className="text-gray-500">{getCurrencySymbol(costTracking.currency)}</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={costTracking.dailyBudget || ''}
                onChange={(e) => handleBudgetChange('dailyBudget', parseFloat(e.target.value) || 0)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="10.00"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Recommended: {formatCurrency((costTracking.monthlyBudget || 100) / 30)}
            </p>
          </div>
        </div>

        {/* Currency Selection */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Currency
          </label>
          <select
            value={costTracking.currency}
            onChange={(e) => handleCurrencyChange(e.target.value as 'USD' | 'EUR' | 'GBP')}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="USD">US Dollar (USD)</option>
            <option value="EUR">Euro (EUR)</option>
            <option value="GBP">British Pound (GBP)</option>
          </select>
        </div>

        {/* Budget Projections */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-blue-800 mb-2">Budget Projections</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-blue-600">Projected Monthly Spend:</span>
              <div className="font-semibold text-blue-800">{formatCurrency(projectedMonthlySpend)}</div>
            </div>
            <div>
              <span className="text-blue-600">Remaining Budget:</span>
              <div className="font-semibold text-blue-800">
                {formatCurrency(Math.max(0, (costTracking.monthlyBudget || 100) - totalMonthlySpend))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Budget Controls */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
          <Settings className="w-5 h-5 text-gray-600" />
          <span>Budget Controls</span>
        </h3>

        <div className="space-y-4">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={costTracking.autoStopAtLimit}
              onChange={(e) => handleSettingsUpdate({ autoStopAtLimit: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">
                Auto-stop at budget limit
              </span>
              <p className="text-xs text-gray-500">
                Automatically prevent AI operations when budget is exceeded
              </p>
            </div>
          </label>

          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={costTracking.trackByProvider}
              onChange={(e) => handleSettingsUpdate({ trackByProvider: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">
                Track costs by provider
              </span>
              <p className="text-xs text-gray-500">
                Enable detailed tracking and reporting by AI provider
              </p>
            </div>
          </label>

          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={costTracking.includeDataTransfer}
              onChange={(e) => handleSettingsUpdate({ includeDataTransfer: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">
                Include data transfer costs
              </span>
              <p className="text-xs text-gray-500">
                Include API data transfer and bandwidth costs in tracking
              </p>
            </div>
          </label>
        </div>
      </div>
    </div>
  );

  const AlertThresholdsTab = () => (
    <div className="space-y-6">
      {/* Alert Configuration */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center space-x-2">
            <Bell className="w-5 h-5 text-orange-600" />
            <span>Alert Thresholds</span>
          </h3>
          <button
            onClick={addAlertThreshold}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-1"
          >
            <Plus className="w-4 h-4" />
            <span>Add Threshold</span>
          </button>
        </div>

        <div className="space-y-4">
          {customAlertThresholds.map((threshold, index) => (
            <div key={threshold.id} className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={threshold.enabled}
                    onChange={(e) => {
                      const updated = customAlertThresholds.map(t =>
                        t.id === threshold.id ? { ...t, enabled: e.target.checked } : t
                      );
                      handleAlertThresholdUpdate(updated);
                    }}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="font-medium text-gray-700">
                    Alert #{index + 1}
                  </span>
                </div>
                <button
                  onClick={() => removeAlertThreshold(threshold.id)}
                  className="text-red-600 hover:text-red-800"
                  disabled={customAlertThresholds.length <= 1}
                >
                  <Minus className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Percentage Threshold
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={threshold.percentage}
                      onChange={(e) => {
                        const percentage = parseFloat(e.target.value) || 0;
                        const amount = (costTracking.monthlyBudget || 100) * (percentage / 100);
                        const updated = customAlertThresholds.map(t =>
                          t.id === threshold.id ? { ...t, percentage, amount } : t
                        );
                        handleAlertThresholdUpdate(updated);
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <span className="text-gray-500">%</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Amount Threshold
                  </label>
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-500">{getCurrencySymbol(costTracking.currency)}</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={threshold.amount}
                      onChange={(e) => {
                        const amount = parseFloat(e.target.value) || 0;
                        const percentage = costTracking.monthlyBudget ? (amount / costTracking.monthlyBudget) * 100 : 0;
                        const updated = customAlertThresholds.map(t =>
                          t.id === threshold.id ? { ...t, amount, percentage } : t
                        );
                        handleAlertThresholdUpdate(updated);
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Notification Types */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  Notification Types
                </label>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(threshold.notificationTypes).map(([type, enabled]) => (
                    <label key={type} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => {
                          const updated = customAlertThresholds.map(t =>
                            t.id === threshold.id
                              ? {
                                  ...t,
                                  notificationTypes: {
                                    ...t.notificationTypes,
                                    [type]: e.target.checked
                                  }
                                }
                              : t
                          );
                          handleAlertThresholdUpdate(updated);
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 capitalize">{type}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Global Alert Settings */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
          <Settings className="w-5 h-5 text-gray-600" />
          <span>Global Alert Settings</span>
        </h3>

        <div className="space-y-4">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={costTracking.notifications.inApp}
              onChange={(e) => handleSettingsUpdate({
                notifications: {
                  ...costTracking.notifications,
                  inApp: e.target.checked
                }
              })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">
                In-app notifications
              </span>
              <p className="text-xs text-gray-500">
                Show alert notifications within the application
              </p>
            </div>
          </label>

          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={costTracking.notifications.email}
              onChange={(e) => handleSettingsUpdate({
                notifications: {
                  ...costTracking.notifications,
                  email: e.target.checked
                }
              })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">
                Email notifications
              </span>
              <p className="text-xs text-gray-500">
                Send alert notifications via email
              </p>
            </div>
          </label>

          {costTracking.notifications.email && (
            <div className="ml-7">
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Email Address
              </label>
              <input
                type="email"
                placeholder="alerts@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const ProviderBreakdownTab = () => (
    <div className="space-y-6">
      {/* Provider Cost Breakdown */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
          <PieChart className="w-5 h-5 text-purple-600" />
          <span>Cost Breakdown by Provider</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {mockCostBreakdown.map((provider) => (
            <div key={provider.provider} className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-700 capitalize">
                  {provider.provider}
                </h4>
                {getTrendIcon(provider.trend)}
              </div>

              <div className="space-y-2">
                <div>
                  <span className="text-sm text-gray-600">Monthly Spend:</span>
                  <div className="font-semibold text-lg">
                    {formatCurrency(provider.monthlySpend)}
                  </div>
                </div>

                <div>
                  <span className="text-sm text-gray-600">Operations:</span>
                  <div className="font-medium">
                    {provider.operationCount.toLocaleString()}
                  </div>
                </div>

                <div>
                  <span className="text-sm text-gray-600">Avg Cost/Op:</span>
                  <div className="font-medium">
                    {formatCurrency(provider.avgCostPerOperation)}
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  <span className="text-sm text-gray-600">Trend:</span>
                  <span className={`text-sm font-medium ${
                    provider.trend === 'up' ? 'text-red-600' :
                    provider.trend === 'down' ? 'text-green-600' : 'text-gray-600'
                  }`}>
                    {provider.trend === 'stable' ? '±' : (provider.trend === 'up' ? '+' : '')}
                    {formatPercentage(provider.trendPercentage)}
                  </span>
                </div>
              </div>

              {/* Usage percentage bar */}
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Budget Share</span>
                  <span>
                    {formatPercentage((provider.monthlySpend / totalMonthlySpend) * 100)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      provider.provider === 'openai' ? 'bg-blue-500' :
                      provider.provider === 'claude' ? 'bg-orange-500' :
                      provider.provider === 'gemini' ? 'bg-green-500' : 'bg-gray-500'
                    }`}
                    style={{
                      width: `${(provider.monthlySpend / totalMonthlySpend) * 100}%`
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Provider Comparison Chart */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          <span>Provider Comparison</span>
        </h3>

        <div className="space-y-4">
          {mockCostBreakdown.map((provider) => {
            const maxSpend = Math.max(...mockCostBreakdown.map(p => p.monthlySpend));
            const percentage = (provider.monthlySpend / maxSpend) * 100;

            return (
              <div key={provider.provider} className="flex items-center space-x-4">
                <div className="w-20 text-sm font-medium text-gray-700 capitalize">
                  {provider.provider}
                </div>
                <div className="flex-1">
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                      className={`h-4 rounded-full transition-all duration-300 ${
                        provider.provider === 'openai' ? 'bg-blue-500' :
                        provider.provider === 'claude' ? 'bg-orange-500' :
                        provider.provider === 'gemini' ? 'bg-green-500' : 'bg-gray-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
                <div className="w-20 text-sm font-mono text-right">
                  {formatCurrency(provider.monthlySpend)}
                </div>
                <div className="w-16 text-xs text-gray-500 text-right">
                  {provider.operationCount} ops
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const HistoricalDataTab = () => (
    <div className="space-y-6">
      {/* Historical Cost Chart */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
          <TrendingUp className="w-5 h-5 text-green-600" />
          <span>30-Day Cost History</span>
        </h3>

        <div className="space-y-2">
          {mockHistoricalData.slice(-10).map((day, index) => {
            const maxCost = Math.max(...mockHistoricalData.map(d => d.totalCost));
            const percentage = (day.totalCost / maxCost) * 100;
            const budgetPercentage = (day.totalCost / day.dailyBudget) * 100;

            return (
              <div key={index} className="flex items-center space-x-3">
                <div className="w-20 text-sm text-gray-600">
                  {new Date(day.date).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric'
                  })}
                </div>
                <div className="flex-1">
                  <div className="w-full bg-gray-200 rounded-full h-3 relative">
                    <div
                      className={`h-3 rounded-full transition-all duration-300 ${
                        budgetPercentage >= 100 ? 'bg-red-500' :
                        budgetPercentage >= 80 ? 'bg-orange-500' :
                        budgetPercentage >= 50 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                    {budgetPercentage >= 100 && (
                      <div className="absolute right-0 top-0 h-3 w-1 bg-red-700 rounded-r-full" />
                    )}
                  </div>
                </div>
                <div className="w-16 text-sm font-mono text-right">
                  {formatCurrency(day.totalCost)}
                </div>
                <div className="w-12 text-xs text-gray-500 text-right">
                  {day.operationCount} ops
                </div>
                <div className="w-16 text-xs text-right">
                  <span className={`${
                    budgetPercentage >= 100 ? 'text-red-600' :
                    budgetPercentage >= 80 ? 'text-orange-600' :
                    'text-gray-600'
                  }`}>
                    {formatPercentage(budgetPercentage)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">30-Day Average:</span>
              <div className="font-semibold">
                {formatCurrency(mockHistoricalData.reduce((sum, day) => sum + day.totalCost, 0) / mockHistoricalData.length)}
              </div>
            </div>
            <div>
              <span className="text-gray-600">Highest Day:</span>
              <div className="font-semibold">
                {formatCurrency(Math.max(...mockHistoricalData.map(d => d.totalCost)))}
              </div>
            </div>
            <div>
              <span className="text-gray-600">Lowest Day:</span>
              <div className="font-semibold">
                {formatCurrency(Math.min(...mockHistoricalData.map(d => d.totalCost)))}
              </div>
            </div>
            <div>
              <span className="text-gray-600">Total Operations:</span>
              <div className="font-semibold">
                {mockHistoricalData.reduce((sum, day) => sum + day.operationCount, 0).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Usage Patterns */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
          <Clock className="w-5 h-5 text-blue-600" />
          <span>Usage Patterns</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Weekly Pattern */}
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Weekly Pattern</h4>
            <div className="space-y-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => {
                const usage = Math.random() * 100;
                return (
                  <div key={day} className="flex items-center space-x-3">
                    <div className="w-8 text-xs text-gray-600">{day}</div>
                    <div className="flex-1">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${usage}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-12 text-xs text-gray-500 text-right">
                      {usage.toFixed(0)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hourly Pattern */}
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Peak Hours</h4>
            <div className="space-y-2">
              {[
                { hour: '9-10 AM', usage: 85 },
                { hour: '2-3 PM', usage: 92 },
                { hour: '4-5 PM', usage: 78 },
                { hour: '10-11 AM', usage: 65 }
              ].map((slot, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div className="w-16 text-xs text-gray-600">{slot.hour}</div>
                  <div className="flex-1">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${slot.usage}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-12 text-xs text-gray-500 text-right">
                    {slot.usage}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const ReportsTab = () => (
    <div className="space-y-6">
      {/* Export Options */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
          <Download className="w-5 h-5 text-blue-600" />
          <span>Export Cost Reports</span>
        </h3>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => exportCostReport('json')}
              disabled={exportLoading}
              className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center space-x-2 mb-2">
                <Download className="w-4 h-4 text-blue-600" />
                <h4 className="font-medium">JSON Export</h4>
              </div>
              <p className="text-sm text-gray-600">
                Complete data export in JSON format for programmatic use
              </p>
            </button>

            <button
              onClick={() => exportCostReport('csv')}
              disabled={exportLoading}
              className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center space-x-2 mb-2">
                <Download className="w-4 h-4 text-green-600" />
                <h4 className="font-medium">CSV Export</h4>
              </div>
              <p className="text-sm text-gray-600">
                Spreadsheet-friendly format for analysis in Excel
              </p>
            </button>

            <button
              onClick={() => exportCostReport('pdf')}
              disabled={exportLoading}
              className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center space-x-2 mb-2">
                <Download className="w-4 h-4 text-red-600" />
                <h4 className="font-medium">PDF Report</h4>
              </div>
              <p className="text-sm text-gray-600">
                Formatted report for sharing and archival
              </p>
            </button>
          </div>

          {exportLoading && (
            <div className="text-center py-4">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
              <p className="text-sm text-gray-600">Generating report...</p>
            </div>
          )}

          {lastExportDate && (
            <div className="text-sm text-gray-500 text-center">
              Last exported: {lastExportDate.toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {/* Report Schedule */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
          <Calendar className="w-5 h-5 text-purple-600" />
          <span>Scheduled Reports</span>
        </h3>

        <div className="space-y-4">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">
                Weekly cost summary
              </span>
              <p className="text-xs text-gray-500">
                Email weekly cost reports every Monday
              </p>
            </div>
          </label>

          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">
                Monthly detailed report
              </span>
              <p className="text-xs text-gray-500">
                Comprehensive monthly report on the 1st of each month
              </p>
            </div>
          </label>

          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">
                Budget alerts report
              </span>
              <p className="text-xs text-gray-500">
                Weekly summary of all budget alerts and threshold breaches
              </p>
            </div>
          </label>
        </div>
      </div>
    </div>
  );

  // ============================================================================
  // TAB NAVIGATION
  // ============================================================================

  const TabButton: React.FC<{
    id: string;
    label: string;
    icon: React.ReactNode;
    isActive: boolean;
    onClick: () => void;
  }> = ({ id, label, icon, isActive, onClick }) => (
    <button
      onClick={onClick}
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
        isActive
          ? 'bg-blue-600 text-white'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
            <DollarSign className="w-7 h-7 text-blue-600" />
            <span>Cost Management</span>
          </h2>
          <p className="text-gray-600 mt-1">
            Configure budgets, alerts, and track AI operation costs
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
          >
            {showAdvancedSettings ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>

          {unsavedChanges && (
            <button
              onClick={() => saveSettings()}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
            >
              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 text-red-800">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">Error</span>
          </div>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={clearError}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Current Cost Summary */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(totalMonthlySpend)}
            </div>
            <div className="text-sm text-gray-600">Monthly Spend</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {formatPercentage(budgetUtilization)}
            </div>
            <div className="text-sm text-gray-600">Budget Used</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {mockCostBreakdown.reduce((sum, provider) => sum + provider.operationCount, 0).toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Operations</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(projectedMonthlySpend)}
            </div>
            <div className="text-sm text-gray-600">Projected</div>
          </div>
        </div>
      </div>

      {/* CostTracker Integration */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
          <Zap className="w-5 h-5 text-yellow-600" />
          <span>Live Cost Monitor</span>
        </h3>
        <CostTracker
          userId={userId}
          compact={false}
          showBudgetAlerts={true}
          refreshIntervalMs={30000}
        />
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b">
        <div className="flex space-x-4 p-4">
          <TabButton
            id="budgets"
            label="Budget Configuration"
            icon={<Target className="w-4 h-4" />}
            isActive={activeTab === 'budgets'}
            onClick={() => setActiveTab('budgets')}
          />
          <TabButton
            id="alerts"
            label="Alert Thresholds"
            icon={<Bell className="w-4 h-4" />}
            isActive={activeTab === 'alerts'}
            onClick={() => setActiveTab('alerts')}
          />
          <TabButton
            id="providers"
            label="Provider Breakdown"
            icon={<PieChart className="w-4 h-4" />}
            isActive={activeTab === 'providers'}
            onClick={() => setActiveTab('providers')}
          />
          <TabButton
            id="history"
            label="Historical Data"
            icon={<TrendingUp className="w-4 h-4" />}
            isActive={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
          />
          {allowExport && (
            <TabButton
              id="reports"
              label="Reports & Export"
              icon={<Download className="w-4 h-4" />}
              isActive={activeTab === 'reports'}
              onClick={() => setActiveTab('reports')}
            />
          )}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'budgets' && <BudgetConfigurationTab />}
        {activeTab === 'alerts' && <AlertThresholdsTab />}
        {activeTab === 'providers' && <ProviderBreakdownTab />}
        {activeTab === 'history' && <HistoricalDataTab />}
        {activeTab === 'reports' && <ReportsTab />}
      </div>

      {/* Information Panel */}
      <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
        <div className="flex items-start space-x-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-800">Cost Management Information</h3>
            <p className="text-blue-600 text-sm mt-1">
              This cost management system provides comprehensive tracking and control over AI operation expenses.
              All costs are tracked in real-time with configurable budgets and alert thresholds to help you
              maintain control over spending.
            </p>
            <div className="mt-3 text-sm text-blue-600 space-y-1">
              <p><strong>Real-time tracking:</strong> Costs are updated after each AI operation</p>
              <p><strong>Budget enforcement:</strong> Operations can be automatically blocked when limits are reached</p>
              <p><strong>Provider insights:</strong> Detailed breakdown of costs by AI provider and operation type</p>
              <p><strong>Historical analysis:</strong> 30-day cost history and usage pattern analysis</p>
              <p><strong>Export capabilities:</strong> Generate detailed cost reports in multiple formats</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CostManagementSettings;