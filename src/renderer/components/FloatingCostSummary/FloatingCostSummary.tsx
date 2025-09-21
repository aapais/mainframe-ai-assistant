/**
 * Floating Cost Summary Widget - Advanced Implementation
 *
 * A draggable, floating widget that provides quick access to cost metrics:
 * 1. Fixed positioning with draggable functionality
 * 2. Collapsible/expandable states with smooth animations
 * 3. Glassmorphism design with modern UI elements
 * 4. Integration with settings context for preferences
 * 5. Responsive design and accessibility features
 * 6. Real-time cost tracking and alerts
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  DollarSign,
  Minimize2,
  Maximize2,
  X,
  Settings,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Move,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Activity,
  Zap,
  Target
} from 'lucide-react';

import { useCostTracking, useFloatingCostWidget, useSettingsActions } from '../../contexts/SettingsContext';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface FloatingCostSummaryProps {
  /** Initial position of the widget */
  initialPosition?: { x: number; y: number };
  /** Enable drag functionality */
  draggable?: boolean;
  /** Auto-hide after period of inactivity */
  autoHide?: boolean;
  /** Auto-hide timeout in milliseconds */
  autoHideTimeout?: number;
  /** Enable real-time updates */
  realTimeUpdates?: boolean;
  /** Update interval in milliseconds */
  updateInterval?: number;
  /** Show widget by default */
  defaultVisible?: boolean;
  /** Callback when widget is closed */
  onClose?: () => void;
  /** Callback when settings button is clicked */
  onSettingsClick?: () => void;
  /** Custom CSS classes */
  className?: string;
}

interface Position {
  x: number;
  y: number;
}

interface CostData {
  currentSpend: number;
  monthlyBudget: number;
  dailySpend: number;
  budgetUtilization: number;
  operationsToday: number;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
  alertStatus: 'normal' | 'warning' | 'critical' | 'exceeded';
  lastUpdated: Date;
}

interface DragState {
  isDragging: boolean;
  startPosition: Position;
  offset: Position;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const WIDGET_WIDTH = 280;
const WIDGET_HEIGHT_COLLAPSED = 80;
const WIDGET_HEIGHT_EXPANDED = 200;
const STORAGE_KEY = 'floating-cost-widget-position';
const STORAGE_VISIBILITY_KEY = 'floating-cost-widget-visible';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const FloatingCostSummary: React.FC<FloatingCostSummaryProps> = ({
  initialPosition = { x: window.innerWidth - WIDGET_WIDTH - 20, y: 20 },
  draggable = true,
  autoHide = false,
  autoHideTimeout = 10000,
  realTimeUpdates = true,
  updateInterval = 30000,
  defaultVisible = true,
  onClose,
  onSettingsClick,
  className = ''
}) => {
  // ============================================================================
  // HOOKS AND STATE
  // ============================================================================

  const { costTracking } = useCostTracking();
  const { floatingCostWidget, updateFloatingCostWidget } = useFloatingCostWidget();
  const { saveSettings } = useSettingsActions();

  // Widget state
  const [isVisible, setIsVisible] = useState(defaultVisible);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isDimmed, setIsDimmed] = useState(false);
  const [position, setPosition] = useState<Position>(initialPosition);
  const [isLoading, setIsLoading] = useState(false);

  // Drag state
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    startPosition: { x: 0, y: 0 },
    offset: { x: 0, y: 0 }
  });

  // Refs
  const widgetRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  const autoHideTimeoutRef = useRef<NodeJS.Timeout>();

  // Mock cost data (in production, this would come from API)
  const [costData, setCostData] = useState<CostData>({
    currentSpend: 78.45,
    monthlyBudget: costTracking.monthlyBudget || 100,
    dailySpend: 2.35,
    budgetUtilization: 78.45,
    operationsToday: 24,
    trend: 'up',
    trendPercentage: 8.3,
    alertStatus: 'warning',
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

  const getAlertColor = useCallback((status: CostData['alertStatus']) => {
    switch (status) {
      case 'normal': return 'text-green-500';
      case 'warning': return 'text-yellow-500';
      case 'critical': return 'text-orange-500';
      case 'exceeded': return 'text-red-500';
      default: return 'text-gray-500';
    }
  }, []);

  const getProgressBarColor = useCallback((utilization: number) => {
    if (utilization >= 100) return 'bg-red-500';
    if (utilization >= 80) return 'bg-orange-500';
    if (utilization >= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  }, []);

  // ============================================================================
  // PERSISTENCE FUNCTIONS
  // ============================================================================

  const savePosition = useCallback((pos: Position) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
      updateFloatingCostWidget({ position: pos });
    } catch (error) {
      console.warn('Failed to save widget position:', error);
    }
  }, [updateFloatingCostWidget]);

  const loadPosition = useCallback((): Position => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure position is within viewport bounds
        return {
          x: Math.max(0, Math.min(parsed.x, window.innerWidth - WIDGET_WIDTH)),
          y: Math.max(0, Math.min(parsed.y, window.innerHeight - WIDGET_HEIGHT_COLLAPSED))
        };
      }
    } catch (error) {
      console.warn('Failed to load widget position:', error);
    }
    return initialPosition;
  }, [initialPosition]);

  const saveVisibility = useCallback((visible: boolean) => {
    try {
      localStorage.setItem(STORAGE_VISIBILITY_KEY, JSON.stringify(visible));
      updateFloatingCostWidget({ enabled: visible });
    } catch (error) {
      console.warn('Failed to save widget visibility:', error);
    }
  }, [updateFloatingCostWidget]);

  const loadVisibility = useCallback((): boolean => {
    try {
      const saved = localStorage.getItem(STORAGE_VISIBILITY_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load widget visibility:', error);
    }
    return defaultVisible;
  }, [defaultVisible]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!draggable) return;

    e.preventDefault();
    const rect = widgetRef.current?.getBoundingClientRect();
    if (!rect) return;

    setDragState({
      isDragging: true,
      startPosition: { x: e.clientX, y: e.clientY },
      offset: {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      }
    });

    // Clear auto-hide timeout during drag
    if (autoHideTimeoutRef.current) {
      clearTimeout(autoHideTimeoutRef.current);
    }
  }, [draggable]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState.isDragging) return;

    const newPosition = {
      x: Math.max(0, Math.min(e.clientX - dragState.offset.x, window.innerWidth - WIDGET_WIDTH)),
      y: Math.max(0, Math.min(e.clientY - dragState.offset.y, window.innerHeight - (isExpanded ? WIDGET_HEIGHT_EXPANDED : WIDGET_HEIGHT_COLLAPSED)))
    };

    setPosition(newPosition);
  }, [dragState, isExpanded]);

  const handleMouseUp = useCallback(() => {
    if (dragState.isDragging) {
      setDragState(prev => ({ ...prev, isDragging: false }));
      savePosition(position);

      // Restart auto-hide timeout
      if (autoHide && !isHovered) {
        startAutoHideTimeout();
      }
    }
  }, [dragState.isDragging, position, savePosition, autoHide, isHovered]);

  const handleToggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    saveVisibility(false);
    onClose?.();
  }, [onClose, saveVisibility]);

  const handleSettingsClick = useCallback(() => {
    onSettingsClick?.();
  }, [onSettingsClick]);

  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));

      // Update mock data
      setCostData(prev => ({
        ...prev,
        currentSpend: prev.currentSpend + (Math.random() - 0.5) * 2,
        dailySpend: prev.dailySpend + (Math.random() - 0.5) * 0.2,
        operationsToday: prev.operationsToday + Math.floor(Math.random() * 3),
        lastUpdated: new Date()
      }));
    } catch (error) {
      console.error('Failed to refresh cost data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ============================================================================
  // AUTO-HIDE FUNCTIONALITY
  // ============================================================================

  const startAutoHideTimeout = useCallback(() => {
    if (!autoHide) return;

    if (autoHideTimeoutRef.current) {
      clearTimeout(autoHideTimeoutRef.current);
    }

    autoHideTimeoutRef.current = setTimeout(() => {
      if (!isHovered && !dragState.isDragging) {
        setIsDimmed(true);
      }
    }, autoHideTimeout);
  }, [autoHide, autoHideTimeout, isHovered, dragState.isDragging]);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    setIsDimmed(false);

    if (autoHideTimeoutRef.current) {
      clearTimeout(autoHideTimeoutRef.current);
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);

    if (autoHide && !dragState.isDragging) {
      startAutoHideTimeout();
    }
  }, [autoHide, dragState.isDragging, startAutoHideTimeout]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Load saved position and visibility on mount - prioritize settings context over localStorage
  useEffect(() => {
    setIsVisible(floatingCostWidget.enabled || loadVisibility());
    setPosition(floatingCostWidget.position || loadPosition());
    setIsExpanded(floatingCostWidget.defaultExpanded);
  }, [floatingCostWidget, loadPosition, loadVisibility]);

  // Setup global mouse event listeners for dragging
  useEffect(() => {
    if (dragState.isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [dragState.isDragging, handleMouseMove, handleMouseUp]);

  // Real-time updates
  useEffect(() => {
    if (!realTimeUpdates) return;

    const interval = setInterval(() => {
      handleRefresh();
    }, updateInterval);

    return () => clearInterval(interval);
  }, [realTimeUpdates, updateInterval, handleRefresh]);

  // Start auto-hide timeout on mount
  useEffect(() => {
    if (autoHide) {
      startAutoHideTimeout();
    }

    return () => {
      if (autoHideTimeoutRef.current) {
        clearTimeout(autoHideTimeoutRef.current);
      }
    };
  }, [autoHide, startAutoHideTimeout]);

  // Sync with cost tracking settings
  useEffect(() => {
    setCostData(prev => ({
      ...prev,
      monthlyBudget: costTracking.monthlyBudget || 100
    }));
  }, [costTracking.monthlyBudget]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const budgetUtilization = useMemo(() => {
    return costData.monthlyBudget > 0
      ? (costData.currentSpend / costData.monthlyBudget) * 100
      : 0;
  }, [costData.currentSpend, costData.monthlyBudget]);

  const widgetStyle = useMemo(() => ({
    position: 'fixed' as const,
    left: `${position.x}px`,
    top: `${position.y}px`,
    width: `${WIDGET_WIDTH}px`,
    height: isExpanded ? `${WIDGET_HEIGHT_EXPANDED}px` : `${WIDGET_HEIGHT_COLLAPSED}px`,
    zIndex: 1000,
    opacity: isDimmed ? 0.3 : 1,
    transform: dragState.isDragging ? 'scale(1.02)' : 'scale(1)',
    transition: dragState.isDragging ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
  }), [position, isExpanded, isDimmed, dragState.isDragging]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderCollapsedView = () => (
    <div className="flex items-center justify-between h-full px-4">
      <div className="flex items-center space-x-3 flex-1 min-w-0">
        <DollarSign className={`w-5 h-5 flex-shrink-0 ${getAlertColor(costData.alertStatus)}`} />
        <div className="flex-1 min-w-0">
          <div className="text-lg font-bold text-white truncate">
            {formatCurrency(costData.currentSpend)}
          </div>
          <div className="text-xs text-gray-300 truncate">
            {formatPercentage(budgetUtilization)} of budget
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-1 flex-shrink-0">
        {costData.trend === 'up' ? (
          <TrendingUp className="w-4 h-4 text-red-400" />
        ) : costData.trend === 'down' ? (
          <TrendingDown className="w-4 h-4 text-green-400" />
        ) : (
          <Activity className="w-4 h-4 text-gray-400" />
        )}

        <button
          onClick={handleToggleExpand}
          className="p-1 text-gray-300 hover:text-white transition-colors"
          title="Expand widget"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const renderExpandedView = () => (
    <div className="p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <DollarSign className={`w-5 h-5 ${getAlertColor(costData.alertStatus)}`} />
          <h3 className="text-sm font-semibold text-white">Cost Summary</h3>
        </div>

        <div className="flex items-center space-x-1">
          {costData.alertStatus !== 'normal' && (
            <AlertTriangle className={`w-4 h-4 ${getAlertColor(costData.alertStatus)}`} />
          )}
          <button
            onClick={handleToggleExpand}
            className="p-1 text-gray-300 hover:text-white transition-colors"
            title="Collapse widget"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Cost Metrics */}
      <div className="flex-1 space-y-3">
        {/* Current Spend */}
        <div>
          <div className="flex items-baseline justify-between">
            <div className="text-xl font-bold text-white">
              {formatCurrency(costData.currentSpend)}
            </div>
            <div className="flex items-center space-x-1 text-sm">
              {costData.trend === 'up' ? (
                <TrendingUp className="w-3 h-3 text-red-400" />
              ) : costData.trend === 'down' ? (
                <TrendingDown className="w-3 h-3 text-green-400" />
              ) : (
                <Activity className="w-3 h-3 text-gray-400" />
              )}
              <span className={`font-medium ${
                costData.trend === 'up' ? 'text-red-400' :
                costData.trend === 'down' ? 'text-green-400' : 'text-gray-400'
              }`}>
                {costData.trend === 'stable' ? '±' : (costData.trend === 'up' ? '+' : '')}
                {costData.trendPercentage.toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="text-xs text-gray-300">
            of {formatCurrency(costData.monthlyBudget)} monthly budget
          </div>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="flex justify-between text-xs text-gray-300 mb-1">
            <span>Budget Utilization</span>
            <span>{formatPercentage(budgetUtilization)}</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${getProgressBarColor(budgetUtilization)}`}
              style={{ width: `${Math.min(budgetUtilization, 100)}%` }}
            />
          </div>
        </div>

        {/* Daily Stats */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-gray-400">Today</div>
            <div className="font-semibold text-white">
              {formatCurrency(costData.dailySpend)}
            </div>
          </div>
          <div>
            <div className="text-gray-400">Operations</div>
            <div className="font-semibold text-white">
              {costData.operationsToday}
            </div>
          </div>
        </div>

        {/* Last Updated */}
        <div className="text-xs text-gray-400">
          Updated: {costData.lastUpdated.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );

  const renderControls = () => (
    <div className="absolute top-2 right-2 flex items-center space-x-1">
      <button
        onClick={handleRefresh}
        disabled={isLoading}
        className="p-1 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
        title="Refresh data"
      >
        <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
      </button>

      {onSettingsClick && (
        <button
          onClick={handleSettingsClick}
          className="p-1 text-gray-300 hover:text-white transition-colors"
          title="Open settings"
        >
          <Settings className="w-3 h-3" />
        </button>
      )}

      <button
        onClick={handleClose}
        className="p-1 text-gray-300 hover:text-white transition-colors"
        title="Close widget"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!isVisible) {
    return null;
  }

  return (
    <div
      ref={widgetRef}
      style={widgetStyle}
      className={`bg-gray-900/90 backdrop-blur-md border border-gray-700 rounded-lg shadow-2xl overflow-hidden cursor-grab active:cursor-grabbing ${className}`}
      onMouseDown={handleMouseDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Glassmorphism overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

      {/* Drag handle */}
      {draggable && (
        <div
          ref={dragHandleRef}
          className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500/50 to-purple-500/50 cursor-grab active:cursor-grabbing"
        />
      )}

      {/* Content */}
      <div className="relative h-full">
        {isExpanded ? renderExpandedView() : renderCollapsedView()}
        {renderControls()}
      </div>

      {/* Resize indicator */}
      {isExpanded && (
        <div className="absolute bottom-1 right-1">
          <div className="w-2 h-2 border-r border-b border-gray-600 opacity-50" />
        </div>
      )}
    </div>
  );
};

export default FloatingCostSummary;