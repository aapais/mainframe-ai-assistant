import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Treemap, Cell, ScatterChart, Scatter, LineChart, Line } from 'recharts';
import { Search, Filter, ChevronDown, ChevronUp, Clock, TrendingUp, Users, Eye, AlertTriangle, CheckCircle } from 'lucide-react';

interface QueryAnalyticsPanelProps {
  analyticsData: {
    popularSearches: Array<{ query: string; count: number; avgTime: number }>;
    timeSeriesData: Array<{ timestamp: string; queries: number; responseTime: number; errors: number }>;
    performanceMetrics: {
      p95ResponseTime: number;
      p99ResponseTime: number;
      throughput: number;
    };
  };
  className?: string;
}

interface QueryPattern {
  pattern: string;
  frequency: number;
  avgResponseTime: number;
  successRate: number;
  complexity: 'low' | 'medium' | 'high';
  category: string;
}

interface QueryInsight {
  id: string;
  type: 'performance' | 'pattern' | 'error' | 'optimization';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  impact: string;
  recommendation: string;
}

const COMPLEXITY_COLORS = {
  low: '#22C55E',
  medium: '#F59E0B',
  high: '#EF4444'
};

export const QueryAnalyticsPanel: React.FC<QueryAnalyticsPanelProps> = ({
  analyticsData,
  className = ''
}) => {
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'frequency' | 'responseTime' | 'complexity'>('frequency');
  const [expandedInsights, setExpandedInsights] = useState<Set<string>>(new Set());
  const [showAdvancedMetrics, setShowAdvancedMetrics] = useState(false);

  // Generate mock query patterns
  const queryPatterns = useMemo((): QueryPattern[] => {
    const patterns = [
      {
        pattern: 'SELECT * FROM {table} WHERE {condition}',
        frequency: 1247,
        avgResponseTime: 89,
        successRate: 98.5,
        complexity: 'low' as const,
        category: 'Database'
      },
      {
        pattern: 'COBOL program analysis',
        frequency: 956,
        avgResponseTime: 167,
        successRate: 96.2,
        complexity: 'medium' as const,
        category: 'Programming'
      },
      {
        pattern: 'JCL job {jobname} execution',
        frequency: 743,
        avgResponseTime: 134,
        successRate: 97.8,
        complexity: 'medium' as const,
        category: 'Job Control'
      },
      {
        pattern: 'Complex JOIN queries with {tables}',
        frequency: 421,
        avgResponseTime: 298,
        successRate: 92.3,
        complexity: 'high' as const,
        category: 'Database'
      },
      {
        pattern: 'VSAM file operations',
        frequency: 389,
        avgResponseTime: 156,
        successRate: 95.7,
        complexity: 'medium' as const,
        category: 'File System'
      },
      {
        pattern: 'System performance debugging',
        frequency: 267,
        avgResponseTime: 445,
        successRate: 89.4,
        complexity: 'high' as const,
        category: 'Debugging'
      }
    ];

    // Apply filtering
    if (selectedFilter !== 'all') {
      return patterns.filter(p => p.category.toLowerCase() === selectedFilter.toLowerCase());
    }

    // Apply sorting
    return [...patterns].sort((a, b) => {
      switch (sortBy) {
        case 'frequency':
          return b.frequency - a.frequency;
        case 'responseTime':
          return b.avgResponseTime - a.avgResponseTime;
        case 'complexity':
          const complexityOrder = { low: 1, medium: 2, high: 3 };
          return complexityOrder[b.complexity] - complexityOrder[a.complexity];
        default:
          return 0;
      }
    });
  }, [selectedFilter, sortBy]);

  // Generate query insights
  const queryInsights = useMemo((): QueryInsight[] => {
    return [
      {
        id: 'insight-1',
        type: 'performance',
        title: 'Slow Complex JOIN Queries',
        description: 'Complex JOIN queries are taking 3x longer than average response time',
        severity: 'high',
        impact: '15% of total response time overhead',
        recommendation: 'Consider adding indexes on frequently joined columns or optimizing query structure'
      },
      {
        id: 'insight-2',
        type: 'pattern',
        title: 'Emerging COBOL Analysis Trend',
        description: 'COBOL analysis queries have increased 23% in the last week',
        severity: 'medium',
        impact: 'Increased load on programming knowledge base',
        recommendation: 'Consider pre-caching common COBOL patterns or expanding COBOL documentation'
      },
      {
        id: 'insight-3',
        type: 'error',
        title: 'System Debugging Query Failures',
        description: 'System performance debugging queries have 10.6% failure rate',
        severity: 'high',
        impact: 'Users may not get complete debugging information',
        recommendation: 'Review debugging knowledge base completeness and query parsing logic'
      },
      {
        id: 'insight-4',
        type: 'optimization',
        title: 'Cache Optimization Opportunity',
        description: 'Database-related queries show high repetition patterns suitable for caching',
        severity: 'low',
        impact: 'Potential 25% response time improvement',
        recommendation: 'Implement intelligent caching for database query patterns'
      }
    ];
  }, []);

  // Prepare data for visualization
  const patternChartData = useMemo(() => {
    return queryPatterns.map(pattern => ({
      name: pattern.pattern.length > 30 ? pattern.pattern.substring(0, 30) + '...' : pattern.pattern,
      frequency: pattern.frequency,
      responseTime: pattern.avgResponseTime,
      successRate: pattern.successRate,
      complexity: pattern.complexity
    }));
  }, [queryPatterns]);

  const responseTimeDistribution = useMemo(() => {
    const buckets = [
      { range: '0-50ms', count: 3245, percentage: 45.2 },
      { range: '50-100ms', count: 2156, percentage: 30.1 },
      { range: '100-200ms', count: 1234, percentage: 17.2 },
      { range: '200-500ms', count: 432, percentage: 6.0 },
      { range: '500ms+', count: 108, percentage: 1.5 }
    ];
    return buckets;
  }, []);

  const toggleInsight = (insightId: string) => {
    const newExpanded = new Set(expandedInsights);
    if (newExpanded.has(insightId)) {
      newExpanded.delete(insightId);
    } else {
      newExpanded.add(insightId);
    }
    setExpandedInsights(newExpanded);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'performance': return Clock;
      case 'pattern': return TrendingUp;
      case 'error': return AlertTriangle;
      case 'optimization': return CheckCircle;
      default: return Search;
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Query Analytics</h2>
          <p className="text-gray-600 text-sm mt-1">Detailed insights into search query patterns and performance</p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={selectedFilter}
            onChange={(e) => setSelectedFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Categories</option>
            <option value="database">Database</option>
            <option value="programming">Programming</option>
            <option value="job control">Job Control</option>
            <option value="file system">File System</option>
            <option value="debugging">Debugging</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="frequency">Sort by Frequency</option>
            <option value="responseTime">Sort by Response Time</option>
            <option value="complexity">Sort by Complexity</option>
          </select>
        </div>
      </div>

      {/* Query Patterns Chart */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Query Pattern Analysis</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={patternChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
            <XAxis 
              dataKey="name" 
              angle={-45}
              textAnchor="end"
              height={80}
              interval={0}
              fontSize={12}
            />
            <YAxis yAxisId="left" stroke="#6366f1" />
            <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" />
            <Tooltip
              formatter={(value, name) => {
                if (name === 'frequency') return [value, 'Query Count'];
                if (name === 'responseTime') return [`${value}ms`, 'Avg Response Time'];
                if (name === 'successRate') return [`${value}%`, 'Success Rate'];
                return [value, name];
              }}
              labelStyle={{ color: '#374151' }}
              contentStyle={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}
            />
            <Bar yAxisId="left" dataKey="frequency" fill="#6366f1" name="frequency" />
            <Bar yAxisId="right" dataKey="responseTime" fill="#f59e0b" name="responseTime" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Response Time Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Response Time Distribution</h3>
          <div className="space-y-3">
            {responseTimeDistribution.map((bucket, index) => (
              <div key={bucket.range} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">{bucket.range}</span>
                <div className="flex items-center space-x-3">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${bucket.percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 w-12 text-right">{bucket.percentage}%</span>
                  <span className="text-xs text-gray-500 w-16 text-right">({bucket.count.toLocaleString()})</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Query Pattern Table */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Top Query Patterns</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {queryPatterns.slice(0, 8).map((pattern, index) => (
              <div key={pattern.pattern} className="flex items-center justify-between p-3 bg-white rounded border">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-medium text-gray-500">#{index + 1}</span>
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {pattern.pattern.length > 40 ? pattern.pattern.substring(0, 40) + '...' : pattern.pattern}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 mt-1">
                    <span className="text-xs text-gray-500">{pattern.frequency} queries</span>
                    <span className="text-xs text-gray-500">{pattern.avgResponseTime}ms avg</span>
                    <span 
                      className="text-xs px-2 py-1 rounded-full font-medium"
                      style={{ 
                        backgroundColor: `${COMPLEXITY_COLORS[pattern.complexity]}20`,
                        color: COMPLEXITY_COLORS[pattern.complexity]
                      }}
                    >
                      {pattern.complexity}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">{pattern.successRate}%</div>
                  <div className="text-xs text-gray-500">success</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Advanced Metrics Toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Advanced Query Insights</h3>
        <button
          onClick={() => setShowAdvancedMetrics(!showAdvancedMetrics)}
          className="flex items-center space-x-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
        >
          <span>{showAdvancedMetrics ? 'Hide' : 'Show'} Advanced Metrics</span>
          {showAdvancedMetrics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Advanced Metrics */}
      {showAdvancedMetrics && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-gray-50 rounded-lg p-6">
            <h4 className="font-medium text-gray-900 mb-3">Performance Percentiles</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">P50 (Median)</span>
                <span className="text-sm font-medium">89ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">P95</span>
                <span className="text-sm font-medium">{analyticsData.performanceMetrics.p95ResponseTime}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">P99</span>
                <span className="text-sm font-medium">{analyticsData.performanceMetrics.p99ResponseTime}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Throughput</span>
                <span className="text-sm font-medium">{analyticsData.performanceMetrics.throughput} q/s</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-6">
            <h4 className="font-medium text-gray-900 mb-3">Query Complexity Distribution</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Low Complexity</span>
                <div className="flex items-center space-x-2">
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: '65%' }} />
                  </div>
                  <span className="text-sm font-medium">65%</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Medium Complexity</span>
                <div className="flex items-center space-x-2">
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '25%' }} />
                  </div>
                  <span className="text-sm font-medium">25%</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">High Complexity</span>
                <div className="flex items-center space-x-2">
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div className="bg-red-500 h-2 rounded-full" style={{ width: '10%' }} />
                  </div>
                  <span className="text-sm font-medium">10%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-6">
            <h4 className="font-medium text-gray-900 mb-3">Category Performance</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Database</span>
                <span className="text-sm font-medium text-green-600">98.5%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Programming</span>
                <span className="text-sm font-medium text-green-600">96.2%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Job Control</span>
                <span className="text-sm font-medium text-green-600">97.8%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Debugging</span>
                <span className="text-sm font-medium text-yellow-600">89.4%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Query Insights */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Query Insights & Recommendations</h3>
        <div className="space-y-4">
          {queryInsights.map((insight) => {
            const Icon = getTypeIcon(insight.type);
            const isExpanded = expandedInsights.has(insight.id);
            
            return (
              <div key={insight.id} className={`border rounded-lg ${getSeverityColor(insight.severity)}`}>
                <button
                  onClick={() => toggleInsight(insight.id)}
                  className="w-full p-4 text-left hover:bg-opacity-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Icon className="w-5 h-5" />
                      <div>
                        <h4 className="font-medium">{insight.title}</h4>
                        <p className="text-sm opacity-80 mt-1">{insight.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs px-2 py-1 rounded-full bg-white bg-opacity-50 font-medium">
                        {insight.severity.toUpperCase()}
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </button>
                
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-current border-opacity-20">
                    <div className="pt-3 space-y-3">
                      <div>
                        <h5 className="font-medium text-sm mb-1">Impact</h5>
                        <p className="text-sm opacity-80">{insight.impact}</p>
                      </div>
                      <div>
                        <h5 className="font-medium text-sm mb-1">Recommendation</h5>
                        <p className="text-sm opacity-80">{insight.recommendation}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};