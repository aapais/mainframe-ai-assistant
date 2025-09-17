/**
 * Cost Summary Dashboard Widget - TASK-005 Implementation
 *
 * Compact dashboard widget showing essential cost metrics with expandable modal functionality:
 * 1. Compact view with current usage and budget status
 * 2. Visual budget indicator (progress bar/gauge)
 * 3. Click to expand to full CostManagementSettings modal
 * 4. Alert status indicator for threshold breaches
 * 5. Quick actions (pause AI, view details)
 * 6. Real-time updates integration
 * 7. Integration with SettingsContext for data consistency
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Pause,
  Play,
  Eye,
  Settings,
  Maximize2,
  RefreshCw,
  Zap,
  Target,
  Activity,
  Clock,
  X
} from 'lucide-react';

import { useCostTracking, useSettingsActions, useSettingsLoading } from '../../contexts/SettingsContext';
import CostManagementSettings from '../settings/CostManagementSettings';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface CostSummaryWidgetProps {
  /** User ID for cost tracking */
  userId?: string;
  /** Compact mode for smaller dashboard layouts */
  compact?: boolean;
  /** Enable/disable real-time updates */
  realTimeUpdates?: boolean;
  /** Update interval in milliseconds */
  updateInterval?: number;
  /** Show detailed metrics in compact view */
  showDetailedMetrics?: boolean;
  /** Allow quick actions */
  enableQuickActions?: boolean;
  /** Custom CSS classes */
  className?: string;
  /** Callback when AI operations are paused/resumed */
  onAIToggle?: (enabled: boolean) => void;
  /** Callback when modal opens */
  onModalOpen?: () => void;
  /** Callback when modal closes */
  onModalClose?: () => void;
}

interface CostMetrics {
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

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  enabled: boolean;
  destructive?: boolean;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const CostSummaryWidget: React.FC<CostSummaryWidgetProps> = ({
  userId = 'current_user',
  compact = false,
  realTimeUpdates = true,
  updateInterval = 30000, // 30 seconds
  showDetailedMetrics = true,
  enableQuickActions = true,
  className = '',
  onAIToggle,
  onModalOpen,
  onModalClose
}) => {
  // ============================================================================
  // HOOKS AND STATE
  // ============================================================================

  const { costTracking, updateCostTracking } = useCostTracking();
  const { saveSettings } = useSettingsActions();
  const { isSaving } = useSettingsLoading();

  // Widget state
  const [isExpanded, setIsExpanded] = useState(false);
  const [aiOperationsEnabled, setAIOperationsEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [hoverEffect, setHoverEffect] = useState(false);

  // Mock real-time cost data (in production, this would come from API)
  const [mockCostData, setMockCostData] = useState<CostMetrics>({
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
  });

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

  const getAlertStatusColor = useCallback((status: CostMetrics['alertStatus']) => {
    switch (status) {
      case 'normal': return 'text-green-600 bg-green-50 border-green-200';
      case 'caution': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'warning': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'exceeded': return 'text-red-800 bg-red-100 border-red-300';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  }, []);

  const getAlertIcon = useCallback((status: CostMetrics['alertStatus']) => {
    switch (status) {
      case 'normal': return <CheckCircle className="w-4 h-4" />;
      case 'caution': return <AlertCircle className="w-4 h-4" />;
      case 'warning': return <AlertTriangle className="w-4 h-4" />;
      case 'critical': return <AlertTriangle className="w-4 h-4" />;
      case 'exceeded': return <AlertTriangle className="w-4 h-4 animate-pulse" />;
      default: return <Activity className="w-4 h-4" />;
    }
  }, []);

  const getTrendIcon = useCallback((trend: CostMetrics['trend']) => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-3 h-3 text-red-500" />;
      case 'down': return <TrendingDown className="w-3 h-3 text-green-500" />;
      default: return <Activity className="w-3 h-3 text-gray-500" />;
    }
  }, []);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleAIToggle = useCallback(async () => {
    const newState = !aiOperationsEnabled;
    setAIOperationsEnabled(newState);

    // Update settings to reflect AI pause state
    await updateCostTracking({
      autoStopAtLimit: !newState
    });

    onAIToggle?.(newState);
  }, [aiOperationsEnabled, updateCostTracking, onAIToggle]);

  const handleExpandWidget = useCallback(() => {
    setIsExpanded(true);
    onModalOpen?.();
  }, [onModalOpen]);

  const handleCloseModal = useCallback(() => {
    setIsExpanded(false);
    onModalClose?.();
  }, [onModalClose]);

  const handleRefreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Simulate API call to refresh data
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Update mock data with new values
      setMockCostData(prev => ({
        ...prev,
        currentSpend: prev.currentSpend + (Math.random() - 0.5) * 2,
        dailySpend: prev.dailySpend + (Math.random() - 0.5) * 0.2,
        operationsToday: prev.operationsToday + Math.floor(Math.random() * 3),
        operationsThisMonth: prev.operationsThisMonth + Math.floor(Math.random() * 3),
        lastUpdated: new Date()
      }));

      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to refresh cost data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ============================================================================
  // QUICK ACTIONS
  // ============================================================================

  const quickActions: QuickAction[] = useMemo(() => [
    {
      id: 'ai-toggle',
      label: aiOperationsEnabled ? 'Pause AI' : 'Resume AI',
      icon: aiOperationsEnabled ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />,
      action: handleAIToggle,
      enabled: enableQuickActions,
      destructive: aiOperationsEnabled
    },
    {
      id: 'view-details',
      label: 'View Details',
      icon: <Eye className="w-3 h-3" />,
      action: handleExpandWidget,
      enabled: true
    },
    {
      id: 'refresh',
      label: 'Refresh',
      icon: isLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />,
      action: handleRefreshData,
      enabled: !isLoading
    }
  ], [aiOperationsEnabled, enableQuickActions, handleAIToggle, handleExpandWidget, handleRefreshData, isLoading]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const budgetUtilization = useMemo(() => {
    return mockCostData.monthlyBudget > 0
      ? (mockCostData.currentSpend / mockCostData.monthlyBudget) * 100
      : 0;
  }, [mockCostData.currentSpend, mockCostData.monthlyBudget]);

  const dailyBudgetUtilization = useMemo(() => {
    return mockCostData.dailyBudget > 0
      ? (mockCostData.dailySpend / mockCostData.dailyBudget) * 100
      : 0;
  }, [mockCostData.dailySpend, mockCostData.dailyBudget]);

  const progressBarColor = useMemo(() => {
    if (budgetUtilization >= 100) return 'bg-red-500';
    if (budgetUtilization >= 80) return 'bg-orange-500';
    if (budgetUtilization >= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  }, [budgetUtilization]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Real-time updates
  useEffect(() => {
    if (!realTimeUpdates) return;

    const interval = setInterval(() => {
      handleRefreshData();
    }, updateInterval);

    return () => clearInterval(interval);
  }, [realTimeUpdates, updateInterval, handleRefreshData]);

  // Sync with cost tracking settings
  useEffect(() => {
    setMockCostData(prev => ({
      ...prev,
      monthlyBudget: costTracking.monthlyBudget || 100,
      dailyBudget: costTracking.dailyBudget || 5
    }));
  }, [costTracking.monthlyBudget, costTracking.dailyBudget]);

  // ============================================================================
  // COMPACT VIEW COMPONENT
  // ============================================================================

  const CompactView = () => (
    <div
      className={`bg-white rounded-lg border shadow-sm p-4 cursor-pointer transition-all duration-200 ${
        hoverEffect ? 'shadow-md scale-[1.02]' : ''
      } ${className}`}
      onClick={handleExpandWidget}
      onMouseEnter={() => setHoverEffect(true)}
      onMouseLeave={() => setHoverEffect(false)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <DollarSign className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-800">Cost Summary</h3>
        </div>

        <div className="flex items-center space-x-2">
          {/* Alert Status */}
          <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getAlertStatusColor(mockCostData.alertStatus)}`}>
            <div className="flex items-center space-x-1">
              {getAlertIcon(mockCostData.alertStatus)}
              <span className="capitalize">{mockCostData.alertStatus}</span>
            </div>
          </div>

          <Maximize2 className="w-4 h-4 text-gray-400" />
        </div>
      </div>

      {/* Current Spend */}
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <div className="text-2xl font-bold text-gray-900">
            {formatCurrency(mockCostData.currentSpend)}
          </div>
          <div className="text-sm text-gray-500">
            of {formatCurrency(mockCostData.monthlyBudget)} budget
          </div>
        </div>

        <div className="flex items-center space-x-1 text-sm">
          {getTrendIcon(mockCostData.trend)}
          <span className={`font-medium ${
            mockCostData.trend === 'up' ? 'text-red-600' :
            mockCostData.trend === 'down' ? 'text-green-600' : 'text-gray-600'
          }`}>
            {mockCostData.trend === 'stable' ? '±' : (mockCostData.trend === 'up' ? '+' : '')}
            {mockCostData.trendPercentage.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Budget Progress Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>Budget Utilization</span>
          <span>{formatPercentage(budgetUtilization)}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 relative">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${progressBarColor}`}
            style={{ width: `${Math.min(budgetUtilization, 100)}%` }}
          />
          {/* Warning markers */}
          <div className="absolute top-0 left-1/2 w-0.5 h-2 bg-yellow-400 opacity-50" />
          <div className="absolute top-0 left-4/5 w-0.5 h-2 bg-orange-400 opacity-50" />
        </div>
      </div>

      {/* Detailed Metrics */}
      {showDetailedMetrics && (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-gray-600">Today</div>
            <div className="font-semibold">
              {formatCurrency(mockCostData.dailySpend)}
              <span className="text-xs text-gray-500 ml-1">
                ({mockCostData.operationsToday} ops)
              </span>
            </div>
          </div>
          <div>
            <div className="text-gray-600">Projected</div>
            <div className="font-semibold">
              {formatCurrency(mockCostData.projectedMonthlySpend)}
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {enableQuickActions && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
          <div className="flex space-x-2">
            {quickActions.slice(0, 2).map((action) => (
              <button
                key={action.id}
                onClick={(e) => {
                  e.stopPropagation();
                  action.action();
                }}
                disabled={!action.enabled}
                className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                  action.destructive
                    ? 'text-red-600 border-red-200 hover:bg-red-50'
                    : 'text-gray-600 border-gray-200 hover:bg-gray-50'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="flex items-center space-x-1">
                  {action.icon}
                  <span>{action.label}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-1 text-xs text-gray-500">
            <Clock className="w-3 h-3" />
            <span>{lastRefresh.toLocaleTimeString()}</span>
          </div>
        </div>
      )}

      {/* AI Status Indicator */}
      {!aiOperationsEnabled && (
        <div className="mt-2 px-2 py-1 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center space-x-2 text-xs text-red-700">
            <Pause className="w-3 h-3" />
            <span>AI Operations Paused</span>
          </div>
        </div>
      )}
    </div>
  );

  // ============================================================================
  // EXPANDED VIEW COMPONENT (MODAL)
  // ============================================================================

  const ExpandedView = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <DollarSign className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Cost Management</h2>
            <div className={`px-3 py-1 rounded-full text-sm font-medium border ${getAlertStatusColor(mockCostData.alertStatus)}`}>
              <div className="flex items-center space-x-1">
                {getAlertIcon(mockCostData.alertStatus)}
                <span className="capitalize">{mockCostData.alertStatus}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Quick Actions in Modal */}
            {enableQuickActions && (
              <div className="flex space-x-2">
                {quickActions.map((action) => (
                  <button
                    key={action.id}
                    onClick={action.action}
                    disabled={!action.enabled}
                    className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                      action.destructive
                        ? 'text-red-600 border-red-200 hover:bg-red-50'
                        : 'text-gray-600 border-gray-200 hover:bg-gray-50'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <div className="flex items-center space-x-2">
                      {action.icon}
                      <span>{action.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={handleCloseModal}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <CostManagementSettings
            userId={userId}
            onSettingsChange={(settings) => {
              // Update local state when settings change
              setMockCostData(prev => ({
                ...prev,
                monthlyBudget: settings.monthlyBudget || prev.monthlyBudget,
                dailyBudget: settings.dailyBudget || prev.dailyBudget
              }));
            }}
            showAdvanced={true}
            allowExport={true}
          />
        </div>
      </div>
    </div>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      {compact ? (
        <CompactView />
      ) : (
        <div className={`bg-white rounded-lg border shadow-sm p-6 ${className}`}>
          <CompactView />
        </div>
      )}

      {/* Expanded Modal */}
      {isExpanded && <ExpandedView />}
    </>
  );
};

export default CostSummaryWidget;