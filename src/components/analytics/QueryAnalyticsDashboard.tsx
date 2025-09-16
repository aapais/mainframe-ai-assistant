/**
 * QueryAnalyticsDashboard - Real-time analytics dashboard for query analysis
 * Provides comprehensive visualization of query patterns, intents, complexity, failures, and user behavior
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Target,
  Brain,
  Users,
  Search,
  Clock,
  BarChart3,
  Activity,
  Zap,
  Eye,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react';

// Types
interface QueryAnalyticsData {
  topPatterns: Array<{
    pattern: string;
    frequency: number;
    avgComplexity: number;
    successRate: number;
    trend: 'up' | 'down' | 'stable';
  }>;
  intentDistribution: Record<string, number>;
  averageComplexity: number;
  failureRate: number;
  mostCommonFailures: string[];
  behaviorPatterns: Array<{
    type: string;
    description: string;
    frequency: number;
    impact: 'high' | 'medium' | 'low';
  }>;
  realTimeMetrics: {
    queriesPerMinute: number;
    avgResponseTime: number;
    successRate: number;
    userSatisfaction: number;
  };
  trends: Array<{
    timestamp: number;
    queries: number;
    complexity: number;
    failures: number;
    satisfaction: number;
  }>;
}

interface DashboardProps {
  data: QueryAnalyticsData;
  refreshInterval?: number;
  onRefresh?: () => void;
  timeRange?: '1h' | '24h' | '7d' | '30d';
  onTimeRangeChange?: (range: '1h' | '24h' | '7d' | '30d') => void;
}

// Color schemes
const COLORS = {
  primary: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#06B6D4',
  gray: '#6B7280'
};

const INTENT_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#EC4899', '#84CC16', '#F97316', '#6366F1'
];

// Helper components
const MetricCard: React.FC<{
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  color: string;
  description?: string;
}> = ({ title, value, change, icon, color, description }) => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
      </div>
      <div className={`p-3 rounded-full`} style={{ backgroundColor: `${color}20` }}>
        <div style={{ color }}>{icon}</div>
      </div>
    </div>
    {change !== undefined && (
      <div className="mt-4 flex items-center">
        {change >= 0 ? (
          <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
        ) : (
          <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
        )}
        <span className={`text-sm font-medium ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {Math.abs(change)}%
        </span>
        <span className="text-sm text-gray-500 ml-1">vs last period</span>
      </div>
    )}
  </div>
);

const InsightCard: React.FC<{
  type: 'success' | 'warning' | 'danger' | 'info';
  title: string;
  description: string;
  action?: string;
}> = ({ type, title, description, action }) => {
  const config = {
    success: { icon: CheckCircle, color: COLORS.success, bg: 'bg-green-50', border: 'border-green-200' },
    warning: { icon: AlertTriangle, color: COLORS.warning, bg: 'bg-yellow-50', border: 'border-yellow-200' },
    danger: { icon: XCircle, color: COLORS.danger, bg: 'bg-red-50', border: 'border-red-200' },
    info: { icon: Info, color: COLORS.info, bg: 'bg-blue-50', border: 'border-blue-200' }
  };

  const { icon: Icon, color, bg, border } = config[type];

  return (
    <div className={`${bg} ${border} border rounded-lg p-4`}>
      <div className="flex items-start">
        <Icon className="w-5 h-5 mt-0.5 mr-3" style={{ color }} />
        <div className="flex-1">
          <h4 className="text-sm font-medium text-gray-900">{title}</h4>
          <p className="text-sm text-gray-600 mt-1">{description}</p>
          {action && (
            <button className="text-sm font-medium mt-2" style={{ color }}>
              {action} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Main component
const QueryAnalyticsDashboard: React.FC<DashboardProps> = ({
  data,
  refreshInterval = 30000,
  onRefresh,
  timeRange = '24h',
  onTimeRangeChange
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  // Auto-refresh logic
  useEffect(() => {
    if (!refreshInterval || !onRefresh) return;

    const interval = setInterval(() => {
      setIsLoading(true);
      onRefresh();
      setLastRefresh(Date.now());
      setTimeout(() => setIsLoading(false), 1000);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval, onRefresh]);

  // Manual refresh
  const handleRefresh = useCallback(() => {
    if (onRefresh) {
      setIsLoading(true);
      onRefresh();
      setLastRefresh(Date.now());
      setTimeout(() => setIsLoading(false), 1000);
    }
  }, [onRefresh]);

  // Data processing
  const processedData = useMemo(() => {
    const intentData = Object.entries(data.intentDistribution).map(([intent, count]) => ({
      name: intent.replace('_', ' ').toUpperCase(),
      value: count,
      percentage: (count / Object.values(data.intentDistribution).reduce((a, b) => a + b, 0) * 100).toFixed(1)
    }));

    const complexityDistribution = data.topPatterns.reduce((acc, pattern) => {
      const complexity = Math.floor(pattern.avgComplexity * 10) / 10;
      acc[complexity] = (acc[complexity] || 0) + pattern.frequency;
      return acc;
    }, {} as Record<number, number>);

    const complexityData = Object.entries(complexityDistribution).map(([complexity, frequency]) => ({
      complexity: parseFloat(complexity),
      frequency
    })).sort((a, b) => a.complexity - b.complexity);

    return {
      intentData,
      complexityData
    };
  }, [data]);

  // Generate insights
  const insights = useMemo(() => {
    const insights: Array<{ type: 'success' | 'warning' | 'danger' | 'info'; title: string; description: string; action?: string }> = [];

    if (data.failureRate > 0.15) {
      insights.push({
        type: 'danger',
        title: 'High Failure Rate',
        description: `${(data.failureRate * 100).toFixed(1)}% of queries are failing. Most common: ${data.mostCommonFailures[0]}`,
        action: 'Investigate patterns'
      });
    }

    if (data.averageComplexity > 0.8) {
      insights.push({
        type: 'warning',
        title: 'High Query Complexity',
        description: `Average complexity is ${(data.averageComplexity * 100).toFixed(1)}%. Users may need guidance.`,
        action: 'Review query assistance'
      });
    }

    if (data.realTimeMetrics.userSatisfaction > 0.85) {
      insights.push({
        type: 'success',
        title: 'High User Satisfaction',
        description: `${(data.realTimeMetrics.userSatisfaction * 100).toFixed(1)}% satisfaction rate. Keep up the good work!`
      });
    }

    if (data.behaviorPatterns.some(p => p.type === 'rapid_abandonment')) {
      insights.push({
        type: 'warning',
        title: 'User Abandonment Pattern',
        description: 'Users are abandoning searches quickly. Consider improving initial results.',
        action: 'Optimize ranking'
      });
    }

    return insights;
  }, [data]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Query Analytics Dashboard</h1>
            <p className="text-gray-600">Real-time insights into search patterns, intent, and user behavior</p>
          </div>
          <div className="flex items-center space-x-4 mt-4 sm:mt-0">
            {/* Time range selector */}
            <select
              value={timeRange}
              onChange={(e) => onTimeRangeChange?.(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>

            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              <Activity className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <div className="text-sm text-gray-500">
              Last updated: {new Date(lastRefresh).toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>

      {/* Real-time metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard
          title="Queries/Minute"
          value={data.realTimeMetrics.queriesPerMinute}
          change={12}
          icon={<Search className="w-6 h-6" />}
          color={COLORS.primary}
          description="Real-time query volume"
        />
        <MetricCard
          title="Avg Response Time"
          value={`${data.realTimeMetrics.avgResponseTime}ms`}
          change={-5}
          icon={<Clock className="w-6 h-6" />}
          color={COLORS.success}
          description="Search performance"
        />
        <MetricCard
          title="Success Rate"
          value={`${(data.realTimeMetrics.successRate * 100).toFixed(1)}%`}
          change={3}
          icon={<Target className="w-6 h-6" />}
          color={COLORS.success}
          description="Successful searches"
        />
        <MetricCard
          title="User Satisfaction"
          value={`${(data.realTimeMetrics.userSatisfaction * 100).toFixed(1)}%`}
          change={8}
          icon={<Users className="w-6 h-6" />}
          color={COLORS.info}
          description="Overall satisfaction"
        />
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Key Insights</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.map((insight, index) => (
              <InsightCard key={index} {...insight} />
            ))}
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Trends Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Query Trends</h3>
            <BarChart3 className="w-5 h-5 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.trends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(timestamp) => new Date(timestamp).toLocaleTimeString()}
              />
              <YAxis />
              <Tooltip
                labelFormatter={(timestamp) => new Date(timestamp).toLocaleString()}
              />
              <Legend />
              <Line type="monotone" dataKey="queries" stroke={COLORS.primary} name="Queries" />
              <Line type="monotone" dataKey="complexity" stroke={COLORS.warning} name="Avg Complexity" />
              <Line type="monotone" dataKey="failures" stroke={COLORS.danger} name="Failures" />
              <Line type="monotone" dataKey="satisfaction" stroke={COLORS.success} name="Satisfaction" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Intent Distribution */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Search Intent Distribution</h3>
            <Brain className="w-5 h-5 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={processedData.intentData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percentage }) => `${name} (${percentage}%)`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {processedData.intentData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={INTENT_COLORS[index % INTENT_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Query Patterns */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Top Query Patterns</h3>
            <Eye className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {data.topPatterns.slice(0, 5).map((pattern, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{pattern.pattern}</div>
                  <div className="text-sm text-gray-600">
                    {pattern.frequency} queries • {(pattern.avgComplexity * 100).toFixed(1)}% complexity
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    pattern.successRate > 0.8 ? 'bg-green-100 text-green-800' :
                    pattern.successRate > 0.6 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {(pattern.successRate * 100).toFixed(1)}% success
                  </div>
                  {pattern.trend === 'up' ? (
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  ) : pattern.trend === 'down' ? (
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  ) : (
                    <div className="w-4 h-4" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Complexity Distribution */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Query Complexity Distribution</h3>
            <Zap className="w-5 h-5 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={processedData.complexityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="complexity" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="frequency" fill={COLORS.warning} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Behavior Patterns and Failures */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Behavior Patterns */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">User Behavior Patterns</h3>
            <Users className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {data.behaviorPatterns.map((pattern, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-gray-900">{pattern.type.replace('_', ' ').toUpperCase()}</div>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    pattern.impact === 'high' ? 'bg-red-100 text-red-800' :
                    pattern.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {pattern.impact} impact
                  </div>
                </div>
                <div className="text-sm text-gray-600 mb-2">{pattern.description}</div>
                <div className="flex items-center">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${Math.min(pattern.frequency / 100, 1) * 100}%` }}
                    ></div>
                  </div>
                  <div className="ml-2 text-sm text-gray-600">{pattern.frequency} occurrences</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Common Failures */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Common Search Failures</h3>
            <AlertTriangle className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {data.mostCommonFailures.map((failure, index) => (
              <div key={index} className="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg">
                <XCircle className="w-5 h-5 text-red-500 mr-3" />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{failure.replace('_', ' ').toUpperCase()}</div>
                  <div className="text-sm text-gray-600">
                    Requires investigation and potential system improvements
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="text-sm font-medium text-gray-900 mb-2">Overall Failure Rate</div>
            <div className="flex items-center">
              <div className="flex-1 bg-gray-200 rounded-full h-3">
                <div
                  className="bg-red-500 h-3 rounded-full"
                  style={{ width: `${data.failureRate * 100}%` }}
                ></div>
              </div>
              <div className="ml-3 text-lg font-bold text-red-600">
                {(data.failureRate * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QueryAnalyticsDashboard;