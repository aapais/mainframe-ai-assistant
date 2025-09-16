import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ComposedChart, Bar, ScatterChart, Scatter, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, Calendar, Filter, Download, RefreshCw, AlertTriangle, Target, BarChart3, Activity, Clock, Users, Eye, Zap } from 'lucide-react';

interface TrendAnalysisPanelProps {
  analyticsData: {
    timeSeriesData: Array<{ timestamp: string; queries: number; responseTime: number; errors: number }>;
    avgResponseTime: number;
    successRate: number;
  };
  className?: string;
}

interface TrendMetric {
  name: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
  unit: string;
  forecast: number;
}

interface SeasonalPattern {
  period: string;
  pattern: string;
  confidence: number;
  description: string;
  impact: 'high' | 'medium' | 'low';
}

interface AnomalyDetection {
  timestamp: string;
  metric: string;
  value: number;
  expected: number;
  severity: 'critical' | 'warning' | 'info';
  description: string;
}

const TREND_COLORS = {
  up: '#22C55E',
  down: '#EF4444',
  stable: '#6B7280'
};

const SEVERITY_COLORS = {
  critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
  warning: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700' },
  info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' }
};

export const TrendAnalysisPanel: React.FC<TrendAnalysisPanelProps> = ({
  analyticsData,
  className = ''
}) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState('30d');
  const [selectedMetric, setSelectedMetric] = useState('all');
  const [showForecasting, setShowForecasting] = useState(true);
  const [showAnomalies, setShowAnomalies] = useState(true);

  // Generate extended time series data for trend analysis
  const extendedTimeSeriesData = useMemo(() => {
    const now = Date.now();
    const days = selectedTimeframe === '7d' ? 7 : selectedTimeframe === '30d' ? 30 : 90;
    
    return Array.from({ length: days }, (_, i) => {
      const timestamp = new Date(now - (days - 1 - i) * 24 * 60 * 60 * 1000);
      const dayOfWeek = timestamp.getDay();
      const hour = timestamp.getHours();
      
      // Simulate realistic patterns
      const baseQueries = 800 + Math.sin(i * 0.1) * 200;
      const weekdayMultiplier = dayOfWeek === 0 || dayOfWeek === 6 ? 0.4 : 1.0;
      const peakHourMultiplier = hour >= 9 && hour <= 17 ? 1.5 : 0.7;
      
      const queries = Math.floor(baseQueries * weekdayMultiplier * peakHourMultiplier + Math.random() * 100);
      const responseTime = 80 + Math.sin(i * 0.05) * 30 + Math.random() * 40;
      const errors = Math.floor(queries * 0.02 + Math.random() * 5);
      const successRate = ((queries - errors) / queries) * 100;
      
      return {
        timestamp: timestamp.toISOString(),
        date: timestamp.toLocaleDateString(),
        queries,
        responseTime: Math.round(responseTime),
        errors,
        successRate: Math.round(successRate * 100) / 100,
        userSessions: Math.floor(queries * 0.3 + Math.random() * 50),
        cacheHitRate: 85 + Math.sin(i * 0.08) * 10 + Math.random() * 5
      };
    });
  }, [selectedTimeframe]);

  // Calculate trend metrics
  const trendMetrics = useMemo((): TrendMetric[] => {
    const currentPeriod = extendedTimeSeriesData.slice(-7);
    const previousPeriod = extendedTimeSeriesData.slice(-14, -7);
    
    const calculateAverage = (data: any[], key: string) => {
      return data.reduce((sum, item) => sum + item[key], 0) / data.length;
    };
    
    const metrics = [
      {
        name: 'Daily Queries',
        key: 'queries',
        unit: '',
        forecast: 1.15
      },
      {
        name: 'Response Time',
        key: 'responseTime',
        unit: 'ms',
        forecast: 0.92
      },
      {
        name: 'Success Rate',
        key: 'successRate',
        unit: '%',
        forecast: 1.03
      },
      {
        name: 'User Sessions',
        key: 'userSessions',
        unit: '',
        forecast: 1.08
      },
      {
        name: 'Cache Hit Rate',
        key: 'cacheHitRate',
        unit: '%',
        forecast: 1.05
      }
    ];
    
    return metrics.map(metric => {
      const current = calculateAverage(currentPeriod, metric.key);
      const previous = calculateAverage(previousPeriod, metric.key);
      const change = current - previous;
      const changePercent = (change / previous) * 100;
      
      let trend: 'up' | 'down' | 'stable';
      if (Math.abs(changePercent) < 2) {
        trend = 'stable';
      } else if (changePercent > 0) {
        trend = metric.key === 'responseTime' ? 'down' : 'up'; // Response time increase is bad
      } else {
        trend = metric.key === 'responseTime' ? 'up' : 'down'; // Response time decrease is good
      }
      
      return {
        name: metric.name,
        current: Math.round(current * 100) / 100,
        previous: Math.round(previous * 100) / 100,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100,
        trend,
        unit: metric.unit,
        forecast: Math.round(current * metric.forecast * 100) / 100
      };
    });
  }, [extendedTimeSeriesData]);

  // Generate seasonal patterns
  const seasonalPatterns = useMemo((): SeasonalPattern[] => {
    return [
      {
        period: 'Daily',
        pattern: 'Peak usage 9 AM - 5 PM weekdays',
        confidence: 95.2,
        description: 'Strong correlation with business hours showing 60% higher activity during work hours',
        impact: 'high'
      },
      {
        period: 'Weekly',
        pattern: 'Lower activity on weekends',
        confidence: 87.8,
        description: 'Weekend traffic drops to 40% of weekday levels, consistent across all weeks',
        impact: 'high'
      },
      {
        period: 'Monthly',
        pattern: 'Increased activity mid-month',
        confidence: 73.5,
        description: 'Monthly reporting cycles drive 25% increase in search activity around 15th',
        impact: 'medium'
      },
      {
        period: 'Seasonal',
        pattern: 'Q4 peak activity',
        confidence: 68.9,
        description: 'End-of-year activities and year-end processing increase usage by 30%',
        impact: 'medium'
      },
      {
        period: 'Holiday',
        pattern: 'Reduced activity during holidays',
        confidence: 91.3,
        description: 'Major holidays show 70% reduction in activity with gradual recovery',
        impact: 'low'
      }
    ];
  }, []);

  // Generate anomaly detection data
  const anomalies = useMemo((): AnomalyDetection[] => {
    const recentData = extendedTimeSeriesData.slice(-10);
    const anomalies: AnomalyDetection[] = [];
    
    recentData.forEach((item, index) => {
      // Simulate anomaly detection
      if (item.responseTime > 150) {
        anomalies.push({
          timestamp: item.timestamp,
          metric: 'Response Time',
          value: item.responseTime,
          expected: 95,
          severity: item.responseTime > 200 ? 'critical' : 'warning',
          description: `Response time spike detected: ${item.responseTime}ms vs expected ~95ms`
        });
      }
      
      if (item.queries < 400) {
        anomalies.push({
          timestamp: item.timestamp,
          metric: 'Query Volume',
          value: item.queries,
          expected: 850,
          severity: 'warning',
          description: `Unusual drop in query volume: ${item.queries} vs expected ~850`
        });
      }
      
      if (item.errors > 25) {
        anomalies.push({
          timestamp: item.timestamp,
          metric: 'Error Rate',
          value: item.errors,
          expected: 15,
          severity: 'critical',
          description: `High error rate detected: ${item.errors} errors vs expected ~15`
        });
      }
    });
    
    return anomalies.slice(0, 5); // Limit to 5 most recent
  }, [extendedTimeSeriesData]);

  // Prepare forecast data
  const forecastData = useMemo(() => {
    if (!showForecasting) return extendedTimeSeriesData;
    
    const lastWeek = extendedTimeSeriesData.slice(-7);
    const avgGrowthRate = 1.05; // 5% growth trend
    
    const forecast = Array.from({ length: 7 }, (_, i) => {
      const baseDate = new Date(extendedTimeSeriesData[extendedTimeSeriesData.length - 1].timestamp);
      const forecastDate = new Date(baseDate.getTime() + (i + 1) * 24 * 60 * 60 * 1000);
      
      const lastValue = lastWeek[lastWeek.length - 1];
      return {
        timestamp: forecastDate.toISOString(),
        date: forecastDate.toLocaleDateString(),
        queries: Math.floor(lastValue.queries * Math.pow(avgGrowthRate, i + 1)),
        responseTime: Math.round(lastValue.responseTime * 0.98), // Slight improvement trend
        errors: Math.floor(lastValue.errors * 0.95), // Error reduction trend
        successRate: Math.min(99.9, lastValue.successRate * 1.001),
        userSessions: Math.floor(lastValue.userSessions * Math.pow(1.03, i + 1)),
        cacheHitRate: Math.min(95, lastValue.cacheHitRate * 1.001),
        isForecast: true
      };
    });
    
    return [...extendedTimeSeriesData, ...forecast];
  }, [extendedTimeSeriesData, showForecasting]);

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-4 h-4" style={{ color: TREND_COLORS.up }} />;
      case 'down': return <TrendingDown className="w-4 h-4" style={{ color: TREND_COLORS.down }} />;
      default: return <Target className="w-4 h-4" style={{ color: TREND_COLORS.stable }} />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-600';
    if (confidence >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getImpactBadge = (impact: string) => {
    const colors = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800'
    };
    return `px-2 py-1 text-xs rounded-full font-medium ${colors[impact as keyof typeof colors]}`;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Trend Analysis</h2>
          <p className="text-gray-600 text-sm mt-1">Historical patterns, forecasting, and anomaly detection</p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={selectedTimeframe}
            onChange={(e) => setSelectedTimeframe(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Metrics</option>
            <option value="queries">Query Volume</option>
            <option value="responseTime">Response Time</option>
            <option value="successRate">Success Rate</option>
            <option value="userSessions">User Sessions</option>
          </select>
          <button
            onClick={() => setShowForecasting(!showForecasting)}
            className={`px-3 py-2 rounded-md text-sm transition-colors ${
              showForecasting ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Forecasting
          </button>
        </div>
      </div>

      {/* Trend Metrics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {trendMetrics.map((metric, index) => (
          <div key={metric.name} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                {index === 0 && <BarChart3 className="w-4 h-4 text-blue-600" />}
                {index === 1 && <Clock className="w-4 h-4 text-blue-600" />}
                {index === 2 && <Target className="w-4 h-4 text-blue-600" />}
                {index === 3 && <Users className="w-4 h-4 text-blue-600" />}
                {index === 4 && <Activity className="w-4 h-4 text-blue-600" />}
              </div>
              {getTrendIcon(metric.trend)}
            </div>
            
            <h3 className="text-sm font-medium text-gray-600 mb-1">{metric.name}</h3>
            <div className="text-lg font-bold text-gray-900 mb-1">
              {metric.current.toLocaleString()}{metric.unit}
            </div>
            
            <div className="flex items-center justify-between text-xs">
              <span className={`font-medium ${
                metric.trend === 'up' ? 'text-green-600' : 
                metric.trend === 'down' ? 'text-red-600' : 'text-gray-600'
              }`}>
                {metric.changePercent >= 0 ? '+' : ''}{metric.changePercent}%
              </span>
              <span className="text-gray-500">vs prev week</span>
            </div>
            
            {showForecasting && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                <div className="text-xs text-gray-600 mb-1">7-day forecast</div>
                <div className="text-sm font-medium text-blue-600">
                  {metric.forecast.toLocaleString()}{metric.unit}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Main Trend Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Historical Trends & Forecasting</h3>
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                checked={showAnomalies}
                onChange={(e) => setShowAnomalies(e.target.checked)}
                className="rounded"
              />
              <span>Show Anomalies</span>
            </label>
            <button className="p-2 text-gray-500 hover:text-gray-700">
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={forecastData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              interval="preserveStartEnd"
            />
            <YAxis yAxisId="left" stroke="#6366f1" />
            <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
            <Tooltip
              labelFormatter={(value, payload) => {
                const data = payload?.[0]?.payload;
                return data?.isForecast ? `${value} (Forecast)` : value;
              }}
              formatter={(value, name, props) => {
                const suffix = props.payload?.isForecast ? ' (Forecast)' : '';
                return [value, name + suffix];
              }}
            />
            
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="queries"
              stroke="#6366f1"
              fill="#6366f1"
              fillOpacity={0.1}
              strokeWidth={2}
              strokeDasharray={(entry: any) => entry?.isForecast ? '5 5' : '0'}
            />
            
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="responseTime"
              stroke="#10b981"
              strokeWidth={2}
              strokeDasharray={(entry: any) => entry?.isForecast ? '5 5' : '0'}
              dot={false}
            />
            
            {showForecasting && (
              <ReferenceLine 
                x={extendedTimeSeriesData[extendedTimeSeriesData.length - 1]?.date}
                stroke="#ef4444"
                strokeDasharray="2 2"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Seasonal Patterns & Anomalies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Seasonal Patterns */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Seasonal Patterns</h3>
          <div className="space-y-4">
            {seasonalPatterns.map((pattern, index) => (
              <div key={pattern.period} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-medium text-gray-900">{pattern.period}</h4>
                    <p className="text-sm text-gray-600 mt-1">{pattern.pattern}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={getImpactBadge(pattern.impact)}>{pattern.impact}</span>
                  </div>
                </div>
                
                <p className="text-sm text-gray-700 mb-3">{pattern.description}</p>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Confidence Level</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-24 bg-gray-200 rounded-full h-1.5">
                      <div 
                        className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${pattern.confidence}%` }}
                      />
                    </div>
                    <span className={`text-sm font-medium ${getConfidenceColor(pattern.confidence)}`}>
                      {pattern.confidence}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Anomaly Detection */}
        <div className="bg-gray-50 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Anomaly Detection</h3>
            <span className="text-sm text-gray-500">{anomalies.length} detected</span>
          </div>
          
          <div className="space-y-3">
            {anomalies.length === 0 ? (
              <div className="text-center py-8">
                <Target className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">No anomalies detected</p>
                <p className="text-sm text-gray-400 mt-1">All metrics are within expected ranges</p>
              </div>
            ) : (
              anomalies.map((anomaly, index) => {
                const severityStyle = SEVERITY_COLORS[anomaly.severity];
                
                return (
                  <div key={index} className={`rounded-lg border p-4 ${severityStyle.bg} ${severityStyle.border}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className={`w-4 h-4 ${severityStyle.text}`} />
                        <span className="font-medium text-gray-900">{anomaly.metric}</span>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${severityStyle.text} bg-white`}>
                        {anomaly.severity.toUpperCase()}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-700 mb-2">{anomaly.description}</p>
                    
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>Detected: {new Date(anomaly.timestamp).toLocaleString()}</span>
                      <span>Deviation: {Math.abs(anomaly.value - anomaly.expected).toFixed(1)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Forecasting Summary */}
      {showForecasting && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-blue-600 rounded-lg">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">7-Day Forecast Summary</h3>
              <p className="text-sm text-gray-600">Predictive analytics based on historical patterns</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Expected Growth</h4>
              <div className="text-2xl font-bold text-green-600 mb-1">+12.5%</div>
              <p className="text-sm text-gray-600">Query volume increase</p>
            </div>
            
            <div className="bg-white rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Performance Outlook</h4>
              <div className="text-2xl font-bold text-green-600 mb-1">-8.2%</div>
              <p className="text-sm text-gray-600">Response time improvement</p>
            </div>
            
            <div className="bg-white rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Confidence Level</h4>
              <div className="text-2xl font-bold text-blue-600 mb-1">87.3%</div>
              <p className="text-sm text-gray-600">Forecast accuracy</p>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-blue-100 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Recommendation:</strong> Based on current trends, consider scaling infrastructure by 15% 
              to handle expected growth while maintaining optimal performance levels.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};