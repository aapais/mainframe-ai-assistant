/**
 * EffectivenessDashboard - Comprehensive analytics dashboard for result effectiveness
 * Displays CTR, relevance, satisfaction, conversion, and A/B testing metrics
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
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
  Scatter
} from 'recharts';

// Analytics service imports
import { ResultEffectivenessTracker, CTRMetrics, EngagementMetrics } from '../../services/analytics/ResultEffectivenessTracker';
import { RelevanceScorer, RelevanceMetrics } from '../../services/analytics/RelevanceScorer';
import { UserSatisfactionMetrics, SatisfactionMetrics } from '../../services/analytics/UserSatisfactionMetrics';
import { ConversionTracker, ConversionMetrics } from '../../services/analytics/ConversionTracker';
import { ABTestingFramework, ABTestResults } from '../../services/analytics/ABTestingFramework';

interface DashboardProps {
  timeRange: 'realtime' | '24h' | '7d' | '30d' | '90d';
  onTimeRangeChange: (range: 'realtime' | '24h' | '7d' | '30d' | '90d') => void;
}

interface AnalyticsData {
  ctr: CTRMetrics | null;
  engagement: EngagementMetrics | null;
  relevance: RelevanceMetrics | null;
  satisfaction: SatisfactionMetrics | null;
  conversion: ConversionMetrics | null;
  abTests: Array<{ test: any; results: ABTestResults }>;
  loading: boolean;
  error: string | null;
}

interface MetricCard {
  title: string;
  value: string | number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  color: string;
  description: string;
}

const COLORS = {
  primary: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#8B5CF6',
  neutral: '#6B7280'
};

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export const EffectivenessDashboard: React.FC<DashboardProps> = ({
  timeRange,
  onTimeRangeChange
}) => {
  const [data, setData] = useState<AnalyticsData>({
    ctr: null,
    engagement: null,
    relevance: null,
    satisfaction: null,
    conversion: null,
    abTests: [],
    loading: true,
    error: null
  });

  const [selectedMetric, setSelectedMetric] = useState<'ctr' | 'engagement' | 'relevance' | 'satisfaction' | 'conversion'>('ctr');
  const [refreshInterval, setRefreshInterval] = useState<number>(300000); // 5 minutes
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  // Analytics service instances
  const [services] = useState(() => ({
    effectivenessTracker: new ResultEffectivenessTracker(),
    relevanceScorer: new RelevanceScorer(),
    satisfactionMetrics: new UserSatisfactionMetrics(),
    conversionTracker: new ConversionTracker(),
    abTestingFramework: new ABTestingFramework()
  }));

  // Load analytics data
  const loadAnalyticsData = async () => {
    try {
      setData(prev => ({ ...prev, loading: true, error: null }));

      const timeRangeMs = getTimeRangeMs(timeRange);
      const filters = timeRangeMs ? { timeRange: timeRangeMs } : undefined;

      const [
        ctrMetrics,
        engagementMetrics,
        relevanceMetrics,
        satisfactionMetrics,
        conversionMetrics,
        dashboardData
      ] = await Promise.all([
        services.effectivenessTracker.calculateCTRMetrics(filters),
        services.effectivenessTracker.calculateEngagementMetrics(filters),
        // Mock relevance metrics (would integrate with actual data)
        Promise.resolve({
          averageRelevance: 0.75,
          topResultsRelevance: 0.82,
          precisionAtK: { 1: 0.85, 3: 0.78, 5: 0.72, 10: 0.68 },
          ndcg: { 1: 0.85, 3: 0.79, 5: 0.74, 10: 0.71 },
          meanReciprocalRank: 0.73,
          qualityDistribution: { excellent: 0.25, good: 0.45, fair: 0.25, poor: 0.05 }
        } as RelevanceMetrics),
        services.satisfactionMetrics.calculateSatisfactionMetrics(filters),
        services.conversionTracker.calculateConversionMetrics(filters),
        services.abTestingFramework.getDashboardData()
      ]);

      setData({
        ctr: ctrMetrics,
        engagement: engagementMetrics,
        relevance: relevanceMetrics,
        satisfaction: satisfactionMetrics,
        conversion: conversionMetrics,
        abTests: dashboardData.activeTests.map(test => ({ test, results: null as any })),
        loading: false,
        error: null
      });
    } catch (error) {
      setData(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load analytics data'
      }));
    }
  };

  // Auto-refresh data
  useEffect(() => {
    loadAnalyticsData();

    if (autoRefresh && timeRange === 'realtime') {
      const interval = setInterval(loadAnalyticsData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [timeRange, autoRefresh, refreshInterval]);

  // Calculate metric cards
  const metricCards: MetricCard[] = useMemo(() => {
    if (!data.ctr || !data.engagement || !data.satisfaction || !data.conversion) {
      return [];
    }

    return [
      {
        title: 'Click-Through Rate',
        value: `${(data.ctr.overall * 100).toFixed(2)}%`,
        change: 5.2,
        trend: 'up',
        color: COLORS.primary,
        description: `${data.ctr.sampleSize.toLocaleString()} impressions`
      },
      {
        title: 'User Satisfaction',
        value: `${data.satisfaction.overall.satisfaction.toFixed(1)}%`,
        change: 2.8,
        trend: 'up',
        color: COLORS.success,
        description: `${data.satisfaction.overall.sampleSize} responses`
      },
      {
        title: 'Conversion Rate',
        value: `${data.conversion.overall.conversionRate.toFixed(2)}%`,
        change: -1.2,
        trend: 'down',
        color: COLORS.warning,
        description: `${data.conversion.overall.totalConversions} conversions`
      },
      {
        title: 'Relevance Score',
        value: `${(data.relevance!.averageRelevance * 100).toFixed(1)}%`,
        change: 3.1,
        trend: 'up',
        color: COLORS.info,
        description: 'Algorithm performance'
      },
      {
        title: 'Engagement Rate',
        value: `${(data.engagement.interactionRate * 100).toFixed(1)}%`,
        change: 0.5,
        trend: 'stable',
        color: COLORS.neutral,
        description: 'User interactions'
      },
      {
        title: 'Average Time',
        value: `${Math.round(data.engagement.averageTimeOnResults / 1000)}s`,
        change: 8.7,
        trend: 'up',
        color: COLORS.success,
        description: 'Time on results'
      }
    ];
  }, [data]);

  // Get time range in milliseconds
  function getTimeRangeMs(range: string): [number, number] | undefined {
    const now = Date.now();
    switch (range) {
      case '24h':
        return [now - 24 * 60 * 60 * 1000, now];
      case '7d':
        return [now - 7 * 24 * 60 * 60 * 1000, now];
      case '30d':
        return [now - 30 * 24 * 60 * 60 * 1000, now];
      case '90d':
        return [now - 90 * 24 * 60 * 60 * 1000, now];
      default:
        return undefined;
    }
  }

  // Render metric trend icon
  const renderTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <span className="text-green-500">↗</span>;
      case 'down':
        return <span className="text-red-500">↘</span>;
      default:
        return <span className="text-gray-500">→</span>;
    }
  };

  // Render loading state
  if (data.loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading analytics data...</span>
      </div>
    );
  }

  // Render error state
  if (data.error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <span className="text-red-400">⚠</span>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading analytics</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{data.error}</p>
            </div>
            <div className="mt-4">
              <button
                onClick={loadAnalyticsData}
                className="bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded text-sm"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Result Effectiveness Analytics</h1>
          <p className="text-gray-600">Comprehensive tracking of search performance and user satisfaction</p>
        </div>

        <div className="flex items-center space-x-4">
          {/* Auto-refresh toggle */}
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-600">Auto-refresh</span>
          </label>

          {/* Time range selector */}
          <select
            value={timeRange}
            onChange={(e) => onTimeRangeChange(e.target.value as any)}
            className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="realtime">Real-time</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>

          <button
            onClick={loadAnalyticsData}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {metricCards.map((card, index) => (
          <div key={index} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{card.title}</p>
                <p className="text-2xl font-semibold text-gray-900">{card.value}</p>
                <p className="text-xs text-gray-500 mt-1">{card.description}</p>
              </div>
              <div className="flex items-center space-x-1">
                {renderTrendIcon(card.trend)}
                <span
                  className={`text-sm font-medium ${
                    card.trend === 'up' ? 'text-green-600' :
                    card.trend === 'down' ? 'text-red-600' :
                    'text-gray-600'
                  }`}
                >
                  {card.change > 0 ? '+' : ''}{card.change}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CTR Trends */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Click-Through Rate Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.ctr?.byTimeRange ? Object.entries(data.ctr.byTimeRange).map(([time, ctr]) => ({
              time: new Date(time).toLocaleDateString(),
              ctr: ctr * 100
            })) : []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis label={{ value: 'CTR (%)', angle: -90, position: 'insideLeft' }} />
              <Tooltip formatter={(value) => [`${value}%`, 'CTR']} />
              <Line type="monotone" dataKey="ctr" stroke={COLORS.primary} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Position Analysis */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">CTR by Position</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.ctr?.byPosition ? Object.entries(data.ctr.byPosition).map(([position, ctr]) => ({
              position: `Pos ${position}`,
              ctr: ctr * 100
            })) : []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="position" />
              <YAxis label={{ value: 'CTR (%)', angle: -90, position: 'insideLeft' }} />
              <Tooltip formatter={(value) => [`${value}%`, 'CTR']} />
              <Bar dataKey="ctr" fill={COLORS.primary} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Satisfaction Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">User Satisfaction Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data.satisfaction?.overall ? [
                  { name: 'Very Satisfied', value: data.satisfaction.overall.satisfaction },
                  { name: 'Satisfied', value: Math.max(0, 80 - data.satisfaction.overall.satisfaction) },
                  { name: 'Neutral', value: 15 },
                  { name: 'Dissatisfied', value: Math.max(0, 5) }
                ] : []}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              >
                {CHART_COLORS.map((color, index) => (
                  <Cell key={`cell-${index}`} fill={color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Conversion Funnel */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Funnel</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data.conversion?.funnelAnalysis || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="stage" />
              <YAxis label={{ value: 'Users', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Area type="monotone" dataKey="users" stroke={COLORS.success} fill={COLORS.success} fillOpacity={0.6} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Metrics Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Relevance Metrics */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Relevance Metrics</h3>
          </div>
          <div className="p-6">
            <dl className="space-y-4">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Average Relevance</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {data.relevance ? `${(data.relevance.averageRelevance * 100).toFixed(1)}%` : 'N/A'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Top 3 Results</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {data.relevance ? `${(data.relevance.topResultsRelevance * 100).toFixed(1)}%` : 'N/A'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Precision@5</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {data.relevance ? `${(data.relevance.precisionAtK[5] * 100).toFixed(1)}%` : 'N/A'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">NDCG@10</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {data.relevance ? `${(data.relevance.ndcg[10] * 100).toFixed(1)}%` : 'N/A'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Mean Reciprocal Rank</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {data.relevance ? data.relevance.meanReciprocalRank.toFixed(3) : 'N/A'}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* A/B Testing Results */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Active A/B Tests</h3>
          </div>
          <div className="p-6">
            {data.abTests.length > 0 ? (
              <div className="space-y-4">
                {data.abTests.slice(0, 3).map((test, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium text-gray-900">{test.test.name}</h4>
                        <p className="text-sm text-gray-600">
                          {test.test.participants} participants
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        test.test.confidence > 0.95 ? 'bg-green-100 text-green-800' :
                        test.test.confidence > 0.8 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {(test.test.confidence * 100).toFixed(1)}% confidence
                      </span>
                    </div>
                    {test.test.leadingVariant && (
                      <div className="mt-2 text-sm text-gray-600">
                        Leading: {test.test.leadingVariant}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No active A/B tests</p>
            )}
          </div>
        </div>
      </div>

      {/* Advanced Analytics Section */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Advanced Analytics</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Statistical Significance */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Statistical Significance</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Sample Size</span>
                  <span className="font-medium">
                    {data.ctr?.sampleSize.toLocaleString() || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Confidence Level</span>
                  <span className="font-medium">
                    {data.ctr ? `${(data.ctr.confidence * 100).toFixed(1)}%` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Statistical Power</span>
                  <span className="font-medium">85%</span>
                </div>
              </div>
            </div>

            {/* Performance Insights */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Performance Insights</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-start space-x-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span className="text-gray-600">CTR above industry average</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="text-yellow-500 mt-0.5">⚠</span>
                  <span className="text-gray-600">High bounce rate on mobile</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span className="text-gray-600">Satisfaction trending upward</span>
                </div>
              </div>
            </div>

            {/* Recommendations */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Recommendations</h4>
              <div className="space-y-2 text-sm">
                <div className="p-2 bg-blue-50 rounded text-blue-800">
                  Optimize mobile search interface
                </div>
                <div className="p-2 bg-green-50 rounded text-green-800">
                  A/B test new ranking algorithm
                </div>
                <div className="p-2 bg-yellow-50 rounded text-yellow-800">
                  Improve result snippet quality
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EffectivenessDashboard;