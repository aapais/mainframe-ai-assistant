import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar, Cell } from 'recharts';
import { Target, Users, ThumbsUp, ThumbsDown, Star, Clock, Eye, RotateCcw, TrendingUp, AlertCircle, CheckCircle, Award } from 'lucide-react';

interface EffectivenessMetricsPanelProps {
  analyticsData: {
    successRate: number;
    avgResponseTime: number;
    timeSeriesData: Array<{ timestamp: string; queries: number; responseTime: number; errors: number }>;
  };
  className?: string;
}

interface UserSatisfactionMetric {
  metric: string;
  score: number;
  trend: 'up' | 'down' | 'stable';
  target: number;
  category: 'usability' | 'accuracy' | 'speed' | 'relevance';
}

interface QualityMetric {
  name: string;
  current: number;
  target: number;
  benchmark: number;
  unit: string;
  color: string;
}

interface UserFeedback {
  rating: number;
  category: string;
  feedback: string;
  timestamp: string;
  resolved: boolean;
}

const SATISFACTION_COLORS = {
  excellent: '#22C55E',
  good: '#84CC16',
  average: '#F59E0B',
  poor: '#EF4444'
};

export const EffectivenessMetricsPanel: React.FC<EffectivenessMetricsPanelProps> = ({
  analyticsData,
  className = ''
}) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState('7d');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showDetailedFeedback, setShowDetailedFeedback] = useState(false);

  // Generate user satisfaction metrics
  const satisfactionMetrics = useMemo((): UserSatisfactionMetric[] => {
    return [
      {
        metric: 'Result Relevance',
        score: 8.7,
        trend: 'up',
        target: 8.5,
        category: 'relevance'
      },
      {
        metric: 'Search Accuracy',
        score: 9.1,
        trend: 'up',
        target: 9.0,
        category: 'accuracy'
      },
      {
        metric: 'Response Speed',
        score: 7.8,
        trend: 'stable',
        target: 8.0,
        category: 'speed'
      },
      {
        metric: 'User Interface',
        score: 8.4,
        trend: 'up',
        target: 8.2,
        category: 'usability'
      },
      {
        metric: 'Documentation Quality',
        score: 8.9,
        trend: 'up',
        target: 8.5,
        category: 'accuracy'
      },
      {
        metric: 'Search Suggestions',
        score: 7.6,
        trend: 'down',
        target: 8.0,
        category: 'usability'
      }
    ];
  }, []);

  // Generate quality metrics
  const qualityMetrics = useMemo((): QualityMetric[] => {
    return [
      {
        name: 'Result Precision',
        current: 91.3,
        target: 90.0,
        benchmark: 85.0,
        unit: '%',
        color: '#22C55E'
      },
      {
        name: 'Result Recall',
        current: 87.6,
        target: 88.0,
        benchmark: 82.0,
        unit: '%',
        color: '#F59E0B'
      },
      {
        name: 'Query Understanding',
        current: 94.2,
        target: 92.0,
        benchmark: 88.0,
        unit: '%',
        color: '#22C55E'
      },
      {
        name: 'Zero Results Rate',
        current: 3.1,
        target: 5.0,
        benchmark: 8.0,
        unit: '%',
        color: '#22C55E'
      },
      {
        name: 'Click-Through Rate',
        current: 76.8,
        target: 75.0,
        benchmark: 70.0,
        unit: '%',
        color: '#22C55E'
      },
      {
        name: 'User Retention',
        current: 89.4,
        target: 85.0,
        benchmark: 80.0,
        unit: '%',
        color: '#22C55E'
      }
    ];
  }, []);

  // Generate user feedback data
  const userFeedback = useMemo((): UserFeedback[] => {
    return [
      {
        rating: 5,
        category: 'Search Accuracy',
        feedback: 'Found exactly what I needed for COBOL debugging. Very helpful!',
        timestamp: '2025-09-15T08:30:00Z',
        resolved: true
      },
      {
        rating: 4,
        category: 'Response Speed',
        feedback: 'Good results but could be faster for complex queries.',
        timestamp: '2025-09-15T07:45:00Z',
        resolved: false
      },
      {
        rating: 5,
        category: 'Documentation Quality',
        feedback: 'JCL examples were comprehensive and well-explained.',
        timestamp: '2025-09-15T06:20:00Z',
        resolved: true
      },
      {
        rating: 3,
        category: 'Search Suggestions',
        feedback: 'Search suggestions could be more relevant to mainframe context.',
        timestamp: '2025-09-15T05:15:00Z',
        resolved: false
      },
      {
        rating: 5,
        category: 'User Interface',
        feedback: 'Clean interface, easy to navigate and find information.',
        timestamp: '2025-09-15T04:30:00Z',
        resolved: true
      }
    ];
  }, []);

  // Prepare radar chart data
  const radarData = useMemo(() => {
    return satisfactionMetrics.map(metric => ({
      metric: metric.metric,
      score: metric.score,
      target: metric.target,
      fullMark: 10
    }));
  }, [satisfactionMetrics]);

  // Calculate satisfaction distribution
  const satisfactionDistribution = useMemo(() => {
    const ratings = userFeedback.map(f => f.rating);
    const distribution = {
      excellent: ratings.filter(r => r === 5).length,
      good: ratings.filter(r => r === 4).length,
      average: ratings.filter(r => r === 3).length,
      poor: ratings.filter(r => r <= 2).length
    };
    
    const total = ratings.length;
    return Object.entries(distribution).map(([key, value]) => ({
      name: key,
      value: Math.round((value / total) * 100),
      count: value,
      color: SATISFACTION_COLORS[key as keyof typeof SATISFACTION_COLORS]
    }));
  }, [userFeedback]);

  // Calculate trending metrics
  const trendingMetrics = useMemo(() => {
    return [
      {
        metric: 'User Engagement',
        value: 94.2,
        change: +12.5,
        period: 'vs last week',
        trend: 'up' as const
      },
      {
        metric: 'Query Success Rate',
        value: analyticsData.successRate,
        change: +2.1,
        period: 'vs last week',
        trend: 'up' as const
      },
      {
        metric: 'Time to Result',
        value: analyticsData.avgResponseTime,
        change: -15.3,
        period: 'ms improvement',
        trend: 'up' as const
      },
      {
        metric: 'User Satisfaction',
        value: 8.6,
        change: +0.3,
        period: 'vs last month',
        trend: 'up' as const
      }
    ];
  }, [analyticsData]);

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'down': return <TrendingUp className="w-4 h-4 text-red-600 rotate-180" />;
      case 'stable': return <Target className="w-4 h-4 text-gray-600" />;
    }
  };

  const getScoreColor = (score: number, target: number) => {
    if (score >= target) return 'text-green-600';
    if (score >= target * 0.9) return 'text-yellow-600';
    return 'text-red-600';
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
        }`}
      />
    ));
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Effectiveness Metrics</h2>
          <p className="text-gray-600 text-sm mt-1">Result quality, user satisfaction, and engagement metrics</p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={selectedTimeframe}
            onChange={(e) => setSelectedTimeframe(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Categories</option>
            <option value="usability">Usability</option>
            <option value="accuracy">Accuracy</option>
            <option value="speed">Speed</option>
            <option value="relevance">Relevance</option>
          </select>
        </div>
      </div>

      {/* Trending Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {trendingMetrics.map((metric, index) => (
          <div key={metric.metric} className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-100">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                {index === 0 && <Users className="w-5 h-5 text-white" />}
                {index === 1 && <CheckCircle className="w-5 h-5 text-white" />}
                {index === 2 && <Clock className="w-5 h-5 text-white" />}
                {index === 3 && <Award className="w-5 h-5 text-white" />}
              </div>
              {getTrendIcon(metric.trend)}
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">{metric.metric}</h3>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-gray-900">
                {typeof metric.value === 'number' ? 
                  (metric.value < 10 ? metric.value.toFixed(1) : Math.round(metric.value)) : 
                  metric.value
                }
              </span>
              {index === 2 && <span className="text-sm text-gray-600">ms</span>}
              {(index === 0 || index === 1) && index !== 2 && metric.value < 100 && <span className="text-sm text-gray-600">%</span>}
            </div>
            <div className="text-sm text-green-600 mt-1">
              {metric.change > 0 ? '+' : ''}{metric.change}{index === 2 ? 'ms' : '%'} {metric.period}
            </div>
          </div>
        ))}
      </div>

      {/* User Satisfaction Radar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">User Satisfaction Metrics</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
              <PolarRadiusAxis 
                angle={90} 
                domain={[0, 10]} 
                tick={{ fontSize: 10 }}
                tickCount={6}
              />
              <Radar
                name="Current Score"
                dataKey="score"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.3}
                strokeWidth={2}
              />
              <Radar
                name="Target"
                dataKey="target"
                stroke="#10b981"
                fill="transparent"
                strokeWidth={2}
                strokeDasharray="5 5"
              />
              <Tooltip
                formatter={(value, name) => [
                  `${value}/10`,
                  name === 'score' ? 'Current Score' : 'Target'
                ]}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Satisfaction Distribution */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">User Rating Distribution</h3>
          <div className="space-y-4">
            {satisfactionDistribution.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm font-medium text-gray-700 capitalize">{item.name}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div 
                      className="h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${item.value}%`,
                        backgroundColor: item.color
                      }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 w-12 text-right">{item.value}%</span>
                  <span className="text-xs text-gray-500 w-12 text-right">({item.count})</span>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Overall Rating</span>
              <div className="flex items-center space-x-2">
                <div className="flex">{renderStars(4)}</div>
                <span className="font-medium text-gray-900">4.2/5</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quality Metrics Grid */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Quality & Performance Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {qualityMetrics.map((metric) => (
            <div key={metric.name} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900">{metric.name}</h4>
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: metric.color }}
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-gray-900">
                    {metric.current}{metric.unit}
                  </span>
                  <span className={`text-sm font-medium ${
                    metric.current >= metric.target ? 'text-green-600' : 'text-yellow-600'
                  }`}>
                    Target: {metric.target}{metric.unit}
                  </span>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${Math.min((metric.current / Math.max(metric.target, metric.benchmark)) * 100, 100)}%`,
                      backgroundColor: metric.color
                    }}
                  />
                </div>
                
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Benchmark: {metric.benchmark}{metric.unit}</span>
                  <span>
                    {metric.current >= metric.target ? 
                      `+${(metric.current - metric.target).toFixed(1)}${metric.unit} above target` :
                      `${(metric.target - metric.current).toFixed(1)}${metric.unit} below target`
                    }
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* User Feedback Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Recent User Feedback</h3>
          <button
            onClick={() => setShowDetailedFeedback(!showDetailedFeedback)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            {showDetailedFeedback ? 'Show Less' : 'Show All Feedback'}
          </button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {userFeedback.slice(0, showDetailedFeedback ? userFeedback.length : 4).map((feedback, index) => (
            <div key={index} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <div className="flex">{renderStars(feedback.rating)}</div>
                  <span className="text-sm font-medium text-gray-600">{feedback.category}</span>
                </div>
                <div className="flex items-center space-x-2">
                  {feedback.resolved ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-yellow-600" />
                  )}
                  <span className="text-xs text-gray-500">
                    {new Date(feedback.timestamp).toLocaleDateString()}
                  </span>
                </div>
              </div>
              
              <p className="text-sm text-gray-700 leading-relaxed">{feedback.feedback}</p>
              
              {!feedback.resolved && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full">
                    Action Required
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Detailed Satisfaction Metrics */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Detailed Satisfaction Breakdown</h3>
        <div className="space-y-4">
          {satisfactionMetrics
            .filter(metric => selectedCategory === 'all' || metric.category === selectedCategory)
            .map((metric) => (
            <div key={metric.metric} className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  {getTrendIcon(metric.trend)}
                  <span className="font-medium text-gray-900">{metric.metric}</span>
                </div>
                <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full capitalize">
                  {metric.category}
                </span>
              </div>
              
              <div className="flex items-center space-x-6">
                <div className="text-right">
                  <div className={`text-lg font-bold ${getScoreColor(metric.score, metric.target)}`}>
                    {metric.score}/10
                  </div>
                  <div className="text-xs text-gray-500">Target: {metric.target}/10</div>
                </div>
                
                <div className="w-24 bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      metric.score >= metric.target ? 'bg-green-500' : 'bg-yellow-500'
                    }`}
                    style={{ width: `${(metric.score / 10) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};