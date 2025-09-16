/**
 * ResponsiveDashboard Example
 *
 * Comprehensive metrics dashboard demonstrating:
 * - Auto-fit grid layouts for cards
 * - Real-time data visualization
 * - Responsive chart containers
 * - Progressive information density
 * - Performance monitoring widgets
 * - Interactive metric panels
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { ResponsiveGrid, GridItem, AutoFitGrid } from '../components/Layout/ResponsiveGrid';
import { useResponsive } from '../hooks/useResponsive';
import { useResizeObserver } from '../hooks/useResizeObserver';
import { Button } from '../components/foundation/Button';

// =========================
// TYPE DEFINITIONS
// =========================

interface MetricCard {
  id: string;
  title: string;
  value: string | number;
  previousValue?: string | number;
  change?: number;
  changeType: 'increase' | 'decrease' | 'neutral';
  icon: string;
  color: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'indigo';
  description?: string;
  trend?: number[];
}

interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color: string;
  }[];
}

interface ActivityItem {
  id: string;
  type: 'search' | 'view' | 'rate' | 'add' | 'edit';
  title: string;
  user: string;
  timestamp: string;
  category?: string;
}

interface DashboardProps {
  dateRange?: '24h' | '7d' | '30d' | '1y';
  autoRefresh?: boolean;
  refreshInterval?: number;
}

// =========================
// MOCK DATA
// =========================

const MOCK_METRICS: MetricCard[] = [
  {
    id: 'total-entries',
    title: 'Total KB Entries',
    value: 1247,
    previousValue: 1189,
    change: 4.9,
    changeType: 'increase',
    icon: '📚',
    color: 'blue',
    description: 'Total knowledge base entries',
    trend: [1100, 1120, 1145, 1189, 1205, 1230, 1247]
  },
  {
    id: 'searches-today',
    title: 'Searches Today',
    value: 342,
    previousValue: 298,
    change: 14.8,
    changeType: 'increase',
    icon: '🔍',
    color: 'green',
    description: 'Search queries performed today',
    trend: [250, 275, 290, 298, 315, 328, 342]
  },
  {
    id: 'avg-resolution-time',
    title: 'Avg Resolution Time',
    value: '8.5 min',
    previousValue: '12.3 min',
    change: -30.9,
    changeType: 'decrease',
    icon: '⏱️',
    color: 'green',
    description: 'Average time to resolve incidents',
    trend: [15.2, 14.1, 13.5, 12.3, 11.8, 9.2, 8.5]
  },
  {
    id: 'success-rate',
    title: 'Success Rate',
    value: '94.2%',
    previousValue: '91.8%',
    change: 2.6,
    changeType: 'increase',
    icon: '✅',
    color: 'green',
    description: 'Percentage of successful resolutions',
    trend: [89.5, 90.2, 91.1, 91.8, 92.5, 93.8, 94.2]
  },
  {
    id: 'active-users',
    title: 'Active Users',
    value: 156,
    previousValue: 142,
    change: 9.9,
    changeType: 'increase',
    icon: '👥',
    color: 'purple',
    description: 'Users active in last 24 hours',
    trend: [120, 125, 135, 142, 148, 152, 156]
  },
  {
    id: 'pending-reviews',
    title: 'Pending Reviews',
    value: 23,
    previousValue: 31,
    change: -25.8,
    changeType: 'decrease',
    icon: '📝',
    color: 'yellow',
    description: 'Entries awaiting review',
    trend: [45, 42, 38, 31, 28, 25, 23]
  },
  {
    id: 'critical-issues',
    title: 'Critical Issues',
    value: 3,
    previousValue: 7,
    change: -57.1,
    changeType: 'decrease',
    icon: '🚨',
    color: 'red',
    description: 'Unresolved critical issues',
    trend: [12, 10, 8, 7, 5, 4, 3]
  },
  {
    id: 'knowledge-score',
    title: 'Knowledge Score',
    value: 8.7,
    previousValue: 8.4,
    change: 3.6,
    changeType: 'increase',
    icon: '🎯',
    color: 'indigo',
    description: 'Overall knowledge base quality score',
    trend: [7.8, 8.0, 8.1, 8.4, 8.5, 8.6, 8.7]
  }
];

const MOCK_CHART_DATA: ChartData = {
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  datasets: [
    {
      label: 'Searches',
      data: [145, 189, 167, 234, 189, 156, 98],
      color: '#3B82F6'
    },
    {
      label: 'Resolutions',
      data: [132, 178, 154, 221, 176, 145, 89],
      color: '#10B981'
    }
  ]
};

const MOCK_CATEGORY_DATA = [
  { name: 'VSAM', value: 345, percentage: 28, color: '#10B981' },
  { name: 'JCL', value: 298, percentage: 24, color: '#3B82F6' },
  { name: 'DB2', value: 234, percentage: 19, color: '#8B5CF6' },
  { name: 'Batch', value: 189, percentage: 15, color: '#F59E0B' },
  { name: 'CICS', value: 112, percentage: 9, color: '#EF4444' },
  { name: 'Other', value: 69, percentage: 5, color: '#6B7280' }
];

const MOCK_ACTIVITIES: ActivityItem[] = [
  {
    id: 'act1',
    type: 'search',
    title: 'Searched for "VSAM status 35"',
    user: 'john.developer',
    timestamp: '2025-01-15T14:30:00Z',
    category: 'VSAM'
  },
  {
    id: 'act2',
    type: 'add',
    title: 'Added new entry: DB2 Lock Timeout Resolution',
    user: 'sarah.dba',
    timestamp: '2025-01-15T14:15:00Z',
    category: 'DB2'
  },
  {
    id: 'act3',
    type: 'rate',
    title: 'Rated "S0C7 Quick Fix" as helpful',
    user: 'mike.analyst',
    timestamp: '2025-01-15T14:00:00Z',
    category: 'Batch'
  },
  {
    id: 'act4',
    type: 'view',
    title: 'Viewed "JCL Dataset Allocation Guide"',
    user: 'lisa.support',
    timestamp: '2025-01-15T13:45:00Z',
    category: 'JCL'
  },
  {
    id: 'act5',
    type: 'edit',
    title: 'Updated "CICS Transaction Debug Steps"',
    user: 'admin.user',
    timestamp: '2025-01-15T13:30:00Z',
    category: 'CICS'
  }
];

// =========================
// SUB-COMPONENTS
// =========================

/**
 * Metric Card Component
 * Individual metric display with trend indicators
 */
const MetricCard: React.FC<{
  metric: MetricCard;
  size?: 'sm' | 'md' | 'lg';
}> = ({ metric, size = 'md' }) => {
  const { device } = useResponsive();

  const getColorClasses = useCallback((color: string) => {
    const colors = {
      blue: 'bg-blue-500 text-white',
      green: 'bg-green-500 text-white',
      red: 'bg-red-500 text-white',
      yellow: 'bg-yellow-500 text-white',
      purple: 'bg-purple-500 text-white',
      indigo: 'bg-indigo-500 text-white'
    };
    return colors[color] || 'bg-gray-500 text-white';
  }, []);

  const getChangeColor = useCallback((changeType: string) => {
    switch (changeType) {
      case 'increase':
        return 'text-green-600';
      case 'decrease':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  }, []);

  const formatChange = useCallback((change: number, changeType: string) => {
    const sign = changeType === 'increase' ? '+' : '';
    return `${sign}${change.toFixed(1)}%`;
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center">
          <div className={`p-3 rounded-lg ${getColorClasses(metric.color)} mr-4`}>
            <span className="text-2xl">{metric.icon}</span>
          </div>
          <div>
            <h3 className={`font-semibold text-gray-900 ${
              size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-lg' : 'text-base'
            }`}>
              {metric.title}
            </h3>
            {metric.description && !device.isMobile && (
              <p className="text-sm text-gray-600 mt-1">{metric.description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <div className={`font-bold text-gray-900 ${
            size === 'sm' ? 'text-xl' : size === 'lg' ? 'text-4xl' : 'text-3xl'
          }`}>
            {metric.value}
          </div>
          {metric.change !== undefined && (
            <div className="flex items-center mt-2">
              <span className={`text-sm font-medium ${getChangeColor(metric.changeType)}`}>
                {formatChange(metric.change, metric.changeType)}
              </span>
              <span className="text-sm text-gray-500 ml-2">vs last period</span>
            </div>
          )}
        </div>

        {/* Mini Trend Chart */}
        {metric.trend && !device.isMobile && (
          <div className="flex items-end space-x-1 h-8">
            {metric.trend.map((value, index) => {
              const maxValue = Math.max(...metric.trend!);
              const height = (value / maxValue) * 32; // 32px max height
              return (
                <div
                  key={index}
                  className={`w-1 bg-${metric.color}-200 rounded-t`}
                  style={{ height: `${height}px` }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Simple Chart Component
 * Basic chart visualization
 */
const SimpleChart: React.FC<{
  data: ChartData;
  type: 'line' | 'bar';
  height?: number;
}> = ({ data, type, height = 200 }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const dimensions = useResizeObserver(chartRef);

  const maxValue = useMemo(() => {
    return Math.max(...data.datasets.flatMap(d => d.data));
  }, [data]);

  return (
    <div ref={chartRef} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Activity</h3>

      <div className="relative" style={{ height }}>
        {/* Chart Area */}
        <div className="absolute inset-0 flex items-end justify-between">
          {data.labels.map((label, index) => (
            <div key={label} className="flex-1 flex flex-col items-center">
              {/* Bars/Lines */}
              <div className="flex-1 flex items-end justify-center space-x-1 w-full">
                {data.datasets.map((dataset, datasetIndex) => {
                  const value = dataset.data[index];
                  const heightPercent = (value / maxValue) * 100;

                  return (
                    <div
                      key={dataset.label}
                      className="flex-1 rounded-t"
                      style={{
                        height: `${heightPercent}%`,
                        backgroundColor: dataset.color,
                        maxWidth: '20px'
                      }}
                      title={`${dataset.label}: ${value}`}
                    />
                  );
                })}
              </div>

              {/* Label */}
              <div className="text-xs text-gray-600 mt-2">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center space-x-4 mt-4">
        {data.datasets.map((dataset) => (
          <div key={dataset.label} className="flex items-center">
            <div
              className="w-3 h-3 rounded mr-2"
              style={{ backgroundColor: dataset.color }}
            />
            <span className="text-sm text-gray-600">{dataset.label}</span>
          </div>
        ))}
      </div>

      {/* Chart dimensions info */}
      <div className="text-xs text-gray-400 mt-2 text-center">
        Chart: {dimensions?.width || 0}×{dimensions?.height || 0}px
      </div>
    </div>
  );
};

/**
 * Category Distribution Component
 * Shows breakdown by category
 */
const CategoryDistribution: React.FC = () => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Entry Distribution</h3>

      <div className="space-y-4">
        {MOCK_CATEGORY_DATA.map((category) => (
          <div key={category.name} className="flex items-center">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-900">{category.name}</span>
                <span className="text-sm text-gray-600">{category.value}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: `${category.percentage}%`,
                    backgroundColor: category.color
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-600 text-center">
          Total: {MOCK_CATEGORY_DATA.reduce((sum, cat) => sum + cat.value, 0)} entries
        </div>
      </div>
    </div>
  );
};

/**
 * Recent Activity Component
 * Shows recent user activities
 */
const RecentActivity: React.FC = () => {
  const getActivityIcon = useCallback((type: string) => {
    const icons = {
      search: '🔍',
      view: '👁️',
      rate: '⭐',
      add: '➕',
      edit: '✏️'
    };
    return icons[type] || '📝';
  }, []);

  const getActivityColor = useCallback((type: string) => {
    const colors = {
      search: 'bg-blue-100 text-blue-800',
      view: 'bg-green-100 text-green-800',
      rate: 'bg-yellow-100 text-yellow-800',
      add: 'bg-purple-100 text-purple-800',
      edit: 'bg-indigo-100 text-indigo-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  }, []);

  const formatTime = useCallback((timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>

      <div className="space-y-4">
        {MOCK_ACTIVITIES.map((activity) => (
          <div key={activity.id} className="flex items-start space-x-3">
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${getActivityColor(activity.type)}`}>
              <span className="text-sm">{getActivityIcon(activity.type)}</span>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 truncate">{activity.title}</p>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-xs text-gray-500">{activity.user}</span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-500">{formatTime(activity.timestamp)}</span>
                {activity.category && (
                  <>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-blue-600">{activity.category}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <Button variant="ghost" size="sm" className="w-full">
          View All Activity
        </Button>
      </div>
    </div>
  );
};

/**
 * Quick Actions Panel
 * Common dashboard actions
 */
const QuickActions: React.FC = () => {
  const actions = [
    { id: 'add-entry', label: 'Add Entry', icon: '➕', color: 'bg-blue-500' },
    { id: 'export-data', label: 'Export Data', icon: '📥', color: 'bg-green-500' },
    { id: 'view-reports', label: 'View Reports', icon: '📊', color: 'bg-purple-500' },
    { id: 'manage-users', label: 'Manage Users', icon: '👥', color: 'bg-indigo-500' }
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>

      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <button
            key={action.id}
            className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className={`w-10 h-10 rounded-lg ${action.color} flex items-center justify-center text-white text-lg mb-2`}>
              {action.icon}
            </div>
            <span className="text-sm font-medium text-gray-900">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

// =========================
// MAIN COMPONENT
// =========================

/**
 * ResponsiveDashboard Example
 *
 * Comprehensive dashboard with auto-fitting metric cards and responsive layouts
 */
export const ResponsiveDashboard: React.FC<DashboardProps> = ({
  dateRange = '7d',
  autoRefresh = true,
  refreshInterval = 30000
}) => {
  const [selectedDateRange, setSelectedDateRange] = useState(dateRange);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { device, breakpoint } = useResponsive();
  const containerRef = useRef<HTMLDivElement>(null);
  const dimensions = useResizeObserver(containerRef);

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      setIsRefreshing(true);
      // Simulate data refresh
      setTimeout(() => setIsRefreshing(false), 1000);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    // Simulate data refresh
    setTimeout(() => setIsRefreshing(false), 1000);
  }, []);

  const dateRangeOptions = [
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '1y', label: 'Last Year' }
  ];

  return (
    <div ref={containerRef} className="space-y-6" data-testid="responsive-dashboard">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Knowledge Base Dashboard</h1>
          <p className="text-sm text-gray-600 mt-1">
            {device.isMobile ? 'Mobile' : device.isTablet ? 'Tablet' : 'Desktop'} View •
            {breakpoint.toUpperCase()} • Last updated: {new Date().toLocaleTimeString()}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <select
            value={selectedDateRange}
            onChange={(e) => setSelectedDateRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            {dateRangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center"
          >
            <svg
              className={`w-4 h-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Metrics Grid - Auto-fit layout */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Key Metrics</h2>
        <AutoFitGrid
          minItemWidth="280px"
          gap="md"
          className={isRefreshing ? 'opacity-75 transition-opacity' : ''}
        >
          {MOCK_METRICS.map((metric) => (
            <MetricCard
              key={metric.id}
              metric={metric}
              size={device.isMobile ? 'sm' : 'md'}
            />
          ))}
        </AutoFitGrid>
      </div>

      {/* Charts and Details Grid */}
      <ResponsiveGrid
        cols={{ xs: 1, lg: 2 }}
        gap="lg"
        className="items-start"
      >
        {/* Chart Section */}
        <GridItem>
          <SimpleChart
            data={MOCK_CHART_DATA}
            type="bar"
            height={device.isMobile ? 150 : 200}
          />
        </GridItem>

        {/* Category Distribution */}
        <GridItem>
          <CategoryDistribution />
        </GridItem>
      </ResponsiveGrid>

      {/* Activity and Actions Grid */}
      <ResponsiveGrid
        cols={{ xs: 1, md: 2, lg: 3 }}
        gap="lg"
        className="items-start"
      >
        {/* Recent Activity */}
        <GridItem colSpan={{ xs: 1, md: 2, lg: 2 }}>
          <RecentActivity />
        </GridItem>

        {/* Quick Actions */}
        <GridItem>
          <QuickActions />
        </GridItem>
      </ResponsiveGrid>

      {/* Performance Info */}
      <div className="text-xs text-gray-500 p-4 bg-gray-50 rounded-lg">
        <ResponsiveGrid cols={{ xs: 2, sm: 4, lg: 6 }} gap="sm">
          <GridItem>
            <strong>Container Size:</strong> {dimensions?.width || 0}×{dimensions?.height || 0}px
          </GridItem>
          <GridItem>
            <strong>Device Type:</strong> {device.isMobile ? 'Mobile' : device.isTablet ? 'Tablet' : 'Desktop'}
          </GridItem>
          <GridItem>
            <strong>Breakpoint:</strong> {breakpoint}
          </GridItem>
          <GridItem>
            <strong>Date Range:</strong> {selectedDateRange}
          </GridItem>
          <GridItem>
            <strong>Auto Refresh:</strong> {autoRefresh ? 'On' : 'Off'}
          </GridItem>
          <GridItem>
            <strong>Cards Count:</strong> {MOCK_METRICS.length}
          </GridItem>
        </ResponsiveGrid>
      </div>
    </div>
  );
};

export default ResponsiveDashboard;