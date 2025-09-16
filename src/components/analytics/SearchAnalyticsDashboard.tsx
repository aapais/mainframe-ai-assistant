import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Area, AreaChart } from 'recharts';
import { Activity, Search, TrendingUp, Clock, Database, Users, AlertCircle, CheckCircle, Zap, Target } from 'lucide-react';
import { QueryAnalyticsPanel } from './QueryAnalyticsPanel';
import { EffectivenessMetricsPanel } from './EffectivenessMetricsPanel';
import { OptimizationRecommendationsPanel } from './OptimizationRecommendationsPanel';
import { TrendAnalysisPanel } from './TrendAnalysisPanel';

interface SearchAnalyticsData {
  totalQueries: number;
  avgResponseTime: number;
  successRate: number;
  activeUsers: number;
  cacheHitRate: number;
  errorRate: number;
  popularSearches: Array<{ query: string; count: number; avgTime: number }>;
  timeSeriesData: Array<{ timestamp: string; queries: number; responseTime: number; errors: number }>;
  categoryBreakdown: Array<{ name: string; value: number; color: string }>;
  performanceMetrics: {
    p95ResponseTime: number;
    p99ResponseTime: number;
    throughput: number;
    memoryUsage: number;
    cpuUsage: number;
  };
}

interface SearchAnalyticsDashboardProps {
  className?: string;
  refreshInterval?: number;
  enableRealTimeUpdates?: boolean;
  onMetricClick?: (metric: string, value: any) => void;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export const SearchAnalyticsDashboard: React.FC<SearchAnalyticsDashboardProps> = ({
  className = '',
  refreshInterval = 30000,
  enableRealTimeUpdates = true,
  onMetricClick
}) => {
  const [analyticsData, setAnalyticsData] = useState<SearchAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');
  const [selectedPanel, setSelectedPanel] = useState<string | null>(null);
  const [isRealTime, setIsRealTime] = useState(enableRealTimeUpdates);

  // Mock data generator for demonstration
  const generateMockData = useCallback((): SearchAnalyticsData => {
    const now = Date.now();
    const timeSeriesData = Array.from({ length: 24 }, (_, i) => {
      const timestamp = new Date(now - (23 - i) * 60 * 60 * 1000).toISOString();
      return {
        timestamp,
        queries: Math.floor(Math.random() * 1000) + 100,
        responseTime: Math.floor(Math.random() * 200) + 50,
        errors: Math.floor(Math.random() * 20)
      };
    });

    return {
      totalQueries: 15847,
      avgResponseTime: 127,
      successRate: 98.2,
      activeUsers: 342,
      cacheHitRate: 87.5,
      errorRate: 1.8,
      popularSearches: [
        { query: 'COBOL examples', count: 1234, avgTime: 89 },
        { query: 'JCL job submission', count: 987, avgTime: 145 },
        { query: 'DB2 procedures', count: 756, avgTime: 203 },
        { query: 'VSAM file handling', count: 643, avgTime: 167 },
        { query: 'mainframe debugging', count: 521, avgTime: 98 }
      ],
      timeSeriesData,
      categoryBreakdown: [
        { name: 'COBOL', value: 35, color: COLORS[0] },
        { name: 'JCL', value: 28, color: COLORS[1] },
        { name: 'DB2', value: 22, color: COLORS[2] },
        { name: 'VSAM', value: 10, color: COLORS[3] },
        { name: 'Other', value: 5, color: COLORS[4] }
      ],
      performanceMetrics: {
        p95ResponseTime: 245,
        p99ResponseTime: 387,
        throughput: 156.7,
        memoryUsage: 67.3,
        cpuUsage: 42.1
      }
    };
  }, []);

  const fetchAnalyticsData = useCallback(async () => {
    try {
      setLoading(true);
      // In a real implementation, this would be an API call
      const data = generateMockData();
      setAnalyticsData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  }, [generateMockData]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  useEffect(() => {
    if (!isRealTime) return;

    const interval = setInterval(fetchAnalyticsData, refreshInterval);
    return () => clearInterval(interval);
  }, [isRealTime, refreshInterval, fetchAnalyticsData]);

  const metricCards = useMemo(() => {
    if (!analyticsData) return [];

    return [
      {
        title: 'Total Queries',
        value: analyticsData.totalQueries.toLocaleString(),
        icon: Search,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        change: '+12.5%',
        changeType: 'positive' as const
      },
      {
        title: 'Avg Response Time',
        value: `${analyticsData.avgResponseTime}ms`,
        icon: Clock,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        change: '-8.3%',
        changeType: 'positive' as const
      },
      {
        title: 'Success Rate',
        value: `${analyticsData.successRate}%`,
        icon: CheckCircle,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
        change: '+2.1%',
        changeType: 'positive' as const
      },
      {
        title: 'Active Users',
        value: analyticsData.activeUsers.toString(),
        icon: Users,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
        change: '+15.7%',
        changeType: 'positive' as const
      },
      {
        title: 'Cache Hit Rate',
        value: `${analyticsData.cacheHitRate}%`,
        icon: Database,
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-50',
        change: '+5.2%',
        changeType: 'positive' as const
      },
      {
        title: 'Error Rate',
        value: `${analyticsData.errorRate}%`,
        icon: AlertCircle,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        change: '-24.6%',
        changeType: 'positive' as const
      }
    ];
  }, [analyticsData]);

  const handleMetricClick = useCallback((metric: string, value: any) => {
    onMetricClick?.(metric, value);
  }, [onMetricClick]);

  const handlePanelSelect = useCallback((panelId: string) => {
    setSelectedPanel(selectedPanel === panelId ? null : panelId);
  }, [selectedPanel]);

  if (loading && !analyticsData) {
    return (
      <div className={`p-6 bg-white rounded-lg shadow-sm ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 animate-spin" />
            <span>Loading analytics data...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 bg-white rounded-lg shadow-sm ${className}`}>
        <div className="flex items-center justify-center h-64 text-red-600">
          <div className="text-center">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            <p className="font-medium">Failed to load analytics</p>
            <p className="text-sm text-gray-500 mt-1">{error}</p>
            <button
              onClick={fetchAnalyticsData}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!analyticsData) return null;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Search Analytics Dashboard</h1>
          <p className="text-gray-600 mt-1">Real-time insights into search performance and usage</p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <button
            onClick={() => setIsRealTime(!isRealTime)}
            className={`px-3 py-2 rounded-md transition-colors ${
              isRealTime
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {isRealTime ? 'Live' : 'Paused'}
          </button>
          <button
            onClick={fetchAnalyticsData}
            disabled={loading}
            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {metricCards.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.title}
              className="p-6 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleMetricClick(metric.title.toLowerCase().replace(/\s+/g, '_'), metric.value)}
            >
              <div className="flex items-center justify-between">
                <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                  <Icon className={`w-5 h-5 ${metric.color}`} />
                </div>
                <div className={`text-sm font-medium ${
                  metric.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {metric.change}
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-500">{metric.title}</h3>
                <p className="text-2xl font-bold text-gray-900 mt-1">{metric.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Time Series Chart */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Query Volume & Response Time Trends</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={analyticsData.timeSeriesData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              stroke="#666"
            />
            <YAxis yAxisId="left" stroke="#666" />
            <YAxis yAxisId="right" orientation="right" stroke="#666" />
            <Tooltip
              labelFormatter={(value) => new Date(value).toLocaleString()}
              formatter={(value, name) => [
                typeof value === 'number' ? value.toLocaleString() : value,
                name === 'queries' ? 'Queries' : name === 'responseTime' ? 'Response Time (ms)' : 'Errors'
              ]}
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="queries"
              stackId="1"
              stroke="#0088FE"
              fill="#0088FE"
              fillOpacity={0.6}
            />
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="responseTime"
              stackId="2"
              stroke="#00C49F"
              fill="#00C49F"
              fillOpacity={0.6}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Secondary Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Popular Searches */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Popular Searches</h3>
          <div className="space-y-3">
            {analyticsData.popularSearches.map((search, index) => (
              <div key={search.query} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-medium text-gray-500 w-6">#{index + 1}</span>
                  <span className="font-medium text-gray-900">{search.query}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">{search.count.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">{search.avgTime}ms avg</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Search Categories</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={analyticsData.categoryBreakdown}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {analyticsData.categoryBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${value}%`, 'Percentage']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        <button
          onClick={() => handlePanelSelect('query-analytics')}
          className={`p-4 rounded-lg border-2 transition-all ${
            selectedPanel === 'query-analytics'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <Search className="w-6 h-6 text-blue-600 mb-2" />
          <h4 className="font-medium text-gray-900">Query Analytics</h4>
          <p className="text-sm text-gray-600 mt-1">Detailed query patterns and insights</p>
        </button>

        <button
          onClick={() => handlePanelSelect('effectiveness-metrics')}
          className={`p-4 rounded-lg border-2 transition-all ${
            selectedPanel === 'effectiveness-metrics'
              ? 'border-green-500 bg-green-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <Target className="w-6 h-6 text-green-600 mb-2" />
          <h4 className="font-medium text-gray-900">Effectiveness Metrics</h4>
          <p className="text-sm text-gray-600 mt-1">Result quality and user satisfaction</p>
        </button>

        <button
          onClick={() => handlePanelSelect('optimization-recommendations')}
          className={`p-4 rounded-lg border-2 transition-all ${
            selectedPanel === 'optimization-recommendations'
              ? 'border-yellow-500 bg-yellow-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <Zap className="w-6 h-6 text-yellow-600 mb-2" />
          <h4 className="font-medium text-gray-900">Optimization</h4>
          <p className="text-sm text-gray-600 mt-1">Performance improvement suggestions</p>
        </button>

        <button
          onClick={() => handlePanelSelect('trend-analysis')}
          className={`p-4 rounded-lg border-2 transition-all ${
            selectedPanel === 'trend-analysis'
              ? 'border-purple-500 bg-purple-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <TrendingUp className="w-6 h-6 text-purple-600 mb-2" />
          <h4 className="font-medium text-gray-900">Trend Analysis</h4>
          <p className="text-sm text-gray-600 mt-1">Historical patterns and forecasts</p>
        </button>
      </div>

      {/* Selected Panel Content */}
      {selectedPanel && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {selectedPanel === 'query-analytics' && (
            <QueryAnalyticsPanel analyticsData={analyticsData} />
          )}
          {selectedPanel === 'effectiveness-metrics' && (
            <EffectivenessMetricsPanel analyticsData={analyticsData} />
          )}
          {selectedPanel === 'optimization-recommendations' && (
            <OptimizationRecommendationsPanel analyticsData={analyticsData} />
          )}
          {selectedPanel === 'trend-analysis' && (
            <TrendAnalysisPanel analyticsData={analyticsData} />
          )}
        </div>
      )}
    </div>
  );
};