import React, { useState, useEffect, useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import {
  ChartPieIcon,
  ChartBarIcon,
  InformationCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon
} from '@heroicons/react/24/outline';

interface UsageData {
  operationType: string;
  count: number;
  cost: number;
  tokens: number;
  avgDuration: number;
  successRate: number;
}

interface AIUsageBreakdownProps {
  dateRange: {
    start: Date;
    end: Date;
  };
  detailed?: boolean;
}

type ViewMode = 'pie' | 'bar';
type MetricType = 'count' | 'cost' | 'tokens' | 'duration';

const OPERATION_COLORS = {
  kb_query: '#3B82F6',      // blue
  kb_create: '#10B981',     // emerald
  kb_update: '#F59E0B',     // amber
  kb_delete: '#EF4444',     // red
  analysis: '#8B5CF6',      // violet
  generation: '#6366F1',    // indigo
  search: '#06B6D4',        // cyan
  other: '#6B7280'          // gray
};

const OPERATION_LABELS = {
  kb_query: 'Knowledge Base Query',
  kb_create: 'Knowledge Base Create',
  kb_update: 'Knowledge Base Update',
  kb_delete: 'Knowledge Base Delete',
  analysis: 'Data Analysis',
  generation: 'Content Generation',
  search: 'Search Operations',
  other: 'Other Operations'
};

const AIUsageBreakdown: React.FC<AIUsageBreakdownProps> = ({ dateRange, detailed = false }) => {
  const [usageData, setUsageData] = useState<UsageData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('pie');
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('count');
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);

  useEffect(() => {
    const loadUsageData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const data = await window.electron.ipcRenderer.invoke('dashboard:getUsageBreakdown', {
          startDate: dateRange.start.toISOString(),
          endDate: dateRange.end.toISOString()
        });

        setUsageData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load usage breakdown');
        console.error('Usage breakdown loading error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadUsageData();
  }, [dateRange]);

  const chartData = useMemo(() => {
    return usageData.map(item => ({
      ...item,
      name: OPERATION_LABELS[item.operationType as keyof typeof OPERATION_LABELS] || item.operationType,
      color: OPERATION_COLORS[item.operationType as keyof typeof OPERATION_COLORS] || OPERATION_COLORS.other,
      value: item[selectedMetric]
    }));
  }, [usageData, selectedMetric]);

  const totals = useMemo(() => {
    return usageData.reduce(
      (acc, item) => ({
        count: acc.count + item.count,
        cost: acc.cost + item.cost,
        tokens: acc.tokens + item.tokens,
        avgDuration: acc.avgDuration + (item.avgDuration * item.count)
      }),
      { count: 0, cost: 0, tokens: 0, avgDuration: 0 }
    );
  }, [usageData]);

  const formatValue = (value: number, metric: MetricType): string => {
    switch (metric) {
      case 'count':
        return value.toLocaleString();
      case 'cost':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 4
        }).format(value);
      case 'tokens':
        return value.toLocaleString();
      case 'duration':
        return value < 1000 ? `${Math.round(value)}ms` : `${(value / 1000).toFixed(1)}s`;
      default:
        return value.toString();
    }
  };

  const getMetricLabel = (metric: MetricType): string => {
    switch (metric) {
      case 'count': return 'Operations';
      case 'cost': return 'Cost';
      case 'tokens': return 'Tokens';
      case 'duration': return 'Avg Duration';
      default: return metric;
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900">{data.name}</p>
          <div className="space-y-1 mt-2">
            <p className="text-sm text-gray-600">
              Operations: <span className="font-medium">{data.count.toLocaleString()}</span>
            </p>
            <p className="text-sm text-gray-600">
              Cost: <span className="font-medium">{formatValue(data.cost, 'cost')}</span>
            </p>
            <p className="text-sm text-gray-600">
              Tokens: <span className="font-medium">{data.tokens.toLocaleString()}</span>
            </p>
            <p className="text-sm text-gray-600">
              Avg Duration: <span className="font-medium">{formatValue(data.avgDuration, 'duration')}</span>
            </p>
            <p className="text-sm text-gray-600">
              Success Rate: <span className="font-medium">{data.successRate.toFixed(1)}%</span>
            </p>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              {((data.value / totals[selectedMetric]) * 100).toFixed(1)}% of total {getMetricLabel(selectedMetric).toLowerCase()}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const handleSegmentClick = (data: any) => {
    setSelectedSegment(selectedSegment === data.operationType ? null : data.operationType);
  };

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-6">
            <div className="h-6 bg-gray-200 rounded w-48"></div>
            <div className="flex space-x-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-8 bg-gray-200 rounded w-20"></div>
              ))}
            </div>
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg border border-red-200">
        <div className="text-center text-red-600">
          <InformationCircleIcon className="h-12 w-12 mx-auto mb-4" />
          <p className="font-semibold">Error loading usage breakdown</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">AI Usage Breakdown</h3>
          <p className="text-sm text-gray-600">
            Distribution of operations by type and usage metrics
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Metric Selection */}
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value as MetricType)}
            className="border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="count">Operations</option>
            <option value="cost">Cost</option>
            <option value="tokens">Tokens</option>
            <option value="duration">Duration</option>
          </select>

          {/* View Mode Buttons */}
          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('pie')}
              className={`px-3 py-1 text-sm ${
                viewMode === 'pie'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <ChartPieIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('bar')}
              className={`px-3 py-1 text-sm border-l border-gray-300 ${
                viewMode === 'bar'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <ChartBarIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          {viewMode === 'pie' ? (
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={detailed ? 40 : 0}
                dataKey="value"
                onMouseEnter={(_, index) => setHoveredSegment(chartData[index]?.operationType || null)}
                onMouseLeave={() => setHoveredSegment(null)}
                onClick={handleSegmentClick}
                className="cursor-pointer"
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    stroke={
                      selectedSegment === entry.operationType ? '#374151' :
                      hoveredSegment === entry.operationType ? '#6B7280' : 'none'
                    }
                    strokeWidth={
                      selectedSegment === entry.operationType ? 3 :
                      hoveredSegment === entry.operationType ? 2 : 0
                    }
                    className="transition-all duration-200"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              {detailed && (
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value, entry: any) => (
                    <span style={{ color: entry.color }}>{value}</span>
                  )}
                />
              )}
            </PieChart>
          ) : (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="value"
                radius={[4, 4, 0, 0]}
                className="cursor-pointer"
                onClick={handleSegmentClick}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { key: 'count', label: 'Total Operations', icon: ChartPieIcon },
          { key: 'cost', label: 'Total Cost', icon: ChartBarIcon },
          { key: 'tokens', label: 'Total Tokens', icon: InformationCircleIcon },
          { key: 'avgDuration', label: 'Avg Duration', icon: InformationCircleIcon }
        ].map(({ key, label, icon: Icon }) => (
          <div
            key={key}
            className={`p-4 rounded-lg border transition-all duration-200 cursor-pointer ${
              selectedMetric === key
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => setSelectedMetric(key as MetricType)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">{label}</p>
                <p className="text-lg font-bold text-gray-900">
                  {formatValue(totals[key as keyof typeof totals], key as MetricType)}
                </p>
              </div>
              <Icon className="h-6 w-6 text-gray-400" />
            </div>
          </div>
        ))}
      </div>

      {/* Detailed Statistics Table */}
      {detailed && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Operation Type</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Count</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Cost</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Tokens</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Avg Duration</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Success Rate</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {chartData.map((item, index) => (
                <tr
                  key={item.operationType}
                  className={`hover:bg-gray-50 transition-colors ${
                    selectedSegment === item.operationType ? 'bg-purple-50' : ''
                  }`}
                  onClick={() => handleSegmentClick(item)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      ></div>
                      <span className="font-medium text-gray-900">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {item.count.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {formatValue(item.cost, 'cost')}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {item.tokens.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {formatValue(item.avgDuration, 'duration')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end space-x-1">
                      <span className={`${
                        item.successRate >= 95 ? 'text-green-600' :
                        item.successRate >= 85 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {item.successRate.toFixed(1)}%
                      </span>
                      {item.successRate >= 95 ? (
                        <ArrowTrendingUpIcon className="h-4 w-4 text-green-500" />
                      ) : item.successRate < 85 ? (
                        <ArrowTrendingDownIcon className="h-4 w-4 text-red-500" />
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {((item.value / totals[selectedMetric]) * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Selected Segment Details */}
      {selectedSegment && (
        <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
          <h4 className="font-medium text-purple-900 mb-2">
            {OPERATION_LABELS[selectedSegment as keyof typeof OPERATION_LABELS]} Details
          </h4>
          <div className="text-sm text-purple-800">
            {(() => {
              const segment = usageData.find(item => item.operationType === selectedSegment);
              if (!segment) return null;

              return (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <span className="font-medium">Operations:</span> {segment.count.toLocaleString()}
                  </div>
                  <div>
                    <span className="font-medium">Cost:</span> {formatValue(segment.cost, 'cost')}
                  </div>
                  <div>
                    <span className="font-medium">Tokens:</span> {segment.tokens.toLocaleString()}
                  </div>
                  <div>
                    <span className="font-medium">Success Rate:</span> {segment.successRate.toFixed(1)}%
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIUsageBreakdown;