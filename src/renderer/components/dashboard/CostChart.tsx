import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart
} from 'recharts';
import { CalendarIcon, TrendingUpIcon, TrendingDownIcon } from '@heroicons/react/24/outline';

interface CostData {
  date: string;
  cost: number;
  operations: number;
  tokens: number;
  prediction?: number;
}

interface CostChartProps {
  dateRange: {
    start: Date;
    end: Date;
  };
  detailed?: boolean;
}

type TimeView = 'day' | 'week' | 'month';

const CostChart: React.FC<CostChartProps> = ({ dateRange, detailed = false }) => {
  const [data, setData] = useState<CostData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeView, setTimeView] = useState<TimeView>('day');
  const [showPrediction, setShowPrediction] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCostData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const costData = await window.electron.ipcRenderer.invoke('dashboard:getCostData', {
          startDate: dateRange.start.toISOString(),
          endDate: dateRange.end.toISOString(),
          granularity: timeView
        });

        setData(costData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load cost data');
        console.error('Cost data loading error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadCostData();
  }, [dateRange, timeView]);

  const chartData = useMemo(() => {
    if (!data.length) return [];

    // Generate predictions based on trend
    const actualData = data.filter(d => !d.prediction);
    if (actualData.length < 2) return data;

    // Simple linear regression for trend prediction
    const n = actualData.length;
    const sumX = actualData.reduce((sum, _, i) => sum + i, 0);
    const sumY = actualData.reduce((sum, d) => sum + d.cost, 0);
    const sumXY = actualData.reduce((sum, d, i) => sum + i * d.cost, 0);
    const sumXX = actualData.reduce((sum, _, i) => sum + i * i, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Add prediction data points
    const predictionData = [...data];
    if (showPrediction) {
      const lastIndex = actualData.length - 1;
      const predictionDays = Math.min(7, Math.ceil(actualData.length * 0.3));

      for (let i = 1; i <= predictionDays; i++) {
        const predictionIndex = lastIndex + i;
        const predictedCost = Math.max(0, slope * predictionIndex + intercept);
        const predictionDate = new Date(dateRange.end);
        predictionDate.setDate(predictionDate.getDate() + i);

        predictionData.push({
          date: predictionDate.toISOString().split('T')[0],
          cost: 0,
          operations: 0,
          tokens: 0,
          prediction: predictedCost
        });
      }
    }

    return predictionData;
  }, [data, showPrediction, dateRange.end]);

  const statistics = useMemo(() => {
    if (!data.length) return { total: 0, average: 0, trend: 0, maxDay: 0 };

    const actualData = data.filter(d => !d.prediction);
    const total = actualData.reduce((sum, d) => sum + d.cost, 0);
    const average = total / actualData.length;

    // Calculate trend (percentage change from first to last week)
    const firstWeekAvg = actualData.slice(0, 7).reduce((sum, d) => sum + d.cost, 0) / Math.min(7, actualData.length);
    const lastWeekAvg = actualData.slice(-7).reduce((sum, d) => sum + d.cost, 0) / Math.min(7, actualData.length);
    const trend = firstWeekAvg > 0 ? ((lastWeekAvg - firstWeekAvg) / firstWeekAvg) * 100 : 0;

    const maxDay = Math.max(...actualData.map(d => d.cost));

    return { total, average, trend, maxDay };
  }, [data]);

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(value);
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    switch (timeView) {
      case 'day':
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      case 'week':
        return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      case 'month':
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      default:
        return dateStr;
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900">{formatDate(label)}</p>
          {data.prediction ? (
            <p className="text-purple-600">
              Predicted: {formatCurrency(data.prediction)}
            </p>
          ) : (
            <>
              <p className="text-purple-600">
                Cost: {formatCurrency(data.cost)}
              </p>
              <p className="text-gray-600">
                Operations: {data.operations?.toLocaleString() || 0}
              </p>
              <p className="text-gray-600">
                Tokens: {data.tokens?.toLocaleString() || 0}
              </p>
            </>
          )}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-4">
            <div className="h-6 bg-gray-200 rounded w-32"></div>
            <div className="flex space-x-2">
              <div className="h-8 bg-gray-200 rounded w-16"></div>
              <div className="h-8 bg-gray-200 rounded w-16"></div>
              <div className="h-8 bg-gray-200 rounded w-16"></div>
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
          <p className="font-semibold">Error loading cost data</p>
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
          <h3 className="text-lg font-semibold text-gray-900">Cost Analysis</h3>
          <p className="text-sm text-gray-600">
            Track spending patterns and trends over time
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {['day', 'week', 'month'].map((view) => (
            <button
              key={view}
              onClick={() => setTimeView(view as TimeView)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                timeView === view
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {view.charAt(0).toUpperCase() + view.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Statistics Cards */}
      {detailed && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-purple-50 p-4 rounded-lg">
            <p className="text-sm text-purple-600 font-medium">Total Cost</p>
            <p className="text-2xl font-bold text-purple-900">
              {formatCurrency(statistics.total)}
            </p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-600 font-medium">Daily Average</p>
            <p className="text-2xl font-bold text-blue-900">
              {formatCurrency(statistics.average)}
            </p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center">
              <p className="text-sm text-green-600 font-medium">Trend</p>
              {statistics.trend > 0 ? (
                <TrendingUpIcon className="h-4 w-4 text-red-500 ml-1" />
              ) : (
                <TrendingDownIcon className="h-4 w-4 text-green-500 ml-1" />
              )}
            </div>
            <p className={`text-2xl font-bold ${
              statistics.trend > 0 ? 'text-red-600' : 'text-green-600'
            }`}>
              {statistics.trend > 0 ? '+' : ''}{statistics.trend.toFixed(1)}%
            </p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <p className="text-sm text-orange-600 font-medium">Peak Day</p>
            <p className="text-2xl font-bold text-orange-900">
              {formatCurrency(statistics.maxDay)}
            </p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <CalendarIcon className="h-4 w-4" />
          <span>
            {dateRange.start.toLocaleDateString()} - {dateRange.end.toLocaleDateString()}
          </span>
        </div>

        <label className="flex items-center space-x-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showPrediction}
            onChange={(e) => setShowPrediction(e.target.checked)}
            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
          />
          <span>Show predictions</span>
        </label>
      </div>

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              tickFormatter={formatDate}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => formatCurrency(value)}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Actual cost line */}
            <Line
              type="monotone"
              dataKey="cost"
              stroke="#7c3aed"
              strokeWidth={2}
              dot={{ fill: '#7c3aed', strokeWidth: 2, r: 4 }}
              connectNulls={false}
            />

            {/* Prediction line */}
            {showPrediction && (
              <Line
                type="monotone"
                dataKey="prediction"
                stroke="#7c3aed"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: '#a855f7', strokeWidth: 2, r: 3 }}
                connectNulls={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart Footer */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center space-x-4 text-sm text-gray-600">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-purple-600 rounded-full"></div>
            <span>Actual Cost</span>
          </div>
          {showPrediction && (
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 border-2 border-purple-600 border-dashed rounded-full"></div>
              <span>Predicted</span>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-500">
          Data updates in real-time via IPC
        </p>
      </div>
    </div>
  );
};

export default CostChart;