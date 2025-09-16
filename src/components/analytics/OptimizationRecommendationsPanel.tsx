import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Area, AreaChart } from 'recharts';
import { Zap, TrendingUp, Clock, Database, Search, AlertTriangle, CheckCircle, Target, Lightbulb, ArrowRight, ChevronDown, ChevronUp, Star, Users, Activity } from 'lucide-react';

interface OptimizationRecommendationsPanelProps {
  analyticsData: {
    avgResponseTime: number;
    cacheHitRate: number;
    errorRate: number;
    performanceMetrics: {
      p95ResponseTime: number;
      p99ResponseTime: number;
      throughput: number;
      memoryUsage: number;
      cpuUsage: number;
    };
  };
  className?: string;
}

interface OptimizationRecommendation {
  id: string;
  title: string;
  category: 'performance' | 'caching' | 'indexing' | 'infrastructure' | 'user-experience';
  priority: 'critical' | 'high' | 'medium' | 'low';
  impact: {
    responseTime?: number; // percentage improvement
    throughput?: number;
    userSatisfaction?: number;
    costSavings?: number;
  };
  effort: 'low' | 'medium' | 'high';
  description: string;
  technicalDetails: string;
  implementation: {
    steps: string[];
    estimatedTime: string;
    resources: string[];
    risks: string[];
  };
  metrics: {
    current: number;
    target: number;
    unit: string;
  };
  status: 'not-started' | 'in-progress' | 'completed' | 'on-hold';
}

interface PerformanceBottleneck {
  component: string;
  impact: number;
  description: string;
  solution: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

const PRIORITY_COLORS = {
  critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', dot: 'bg-red-500' },
  high: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', dot: 'bg-orange-500' },
  medium: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  low: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', dot: 'bg-green-500' }
};

const EFFORT_COLORS = {
  low: 'text-green-600',
  medium: 'text-yellow-600',
  high: 'text-red-600'
};

export const OptimizationRecommendationsPanel: React.FC<OptimizationRecommendationsPanelProps> = ({
  analyticsData,
  className = ''
}) => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [expandedRecommendations, setExpandedRecommendations] = useState<Set<string>>(new Set());
  const [showImplementationDetails, setShowImplementationDetails] = useState(false);

  // Generate optimization recommendations
  const recommendations = useMemo((): OptimizationRecommendation[] => {
    return [
      {
        id: 'rec-1',
        title: 'Implement Intelligent Query Caching',
        category: 'caching',
        priority: 'high',
        impact: {
          responseTime: 35,
          throughput: 28,
          userSatisfaction: 15
        },
        effort: 'medium',
        description: 'Deploy advanced caching layer with semantic query analysis to reduce database load and improve response times.',
        technicalDetails: 'Implement Redis-based caching with query fingerprinting, semantic similarity matching, and TTL optimization based on query patterns.',
        implementation: {
          steps: [
            'Set up Redis cluster for cache storage',
            'Implement query fingerprinting algorithm',
            'Create semantic similarity matching engine',
            'Deploy cache warming strategies',
            'Monitor cache hit rates and performance'
          ],
          estimatedTime: '2-3 weeks',
          resources: ['Backend Developer', 'DevOps Engineer', 'Performance Analyst'],
          risks: ['Cache invalidation complexity', 'Memory usage increase', 'Initial setup complexity']
        },
        metrics: {
          current: analyticsData.cacheHitRate,
          target: 92,
          unit: '%'
        },
        status: 'not-started'
      },
      {
        id: 'rec-2',
        title: 'Optimize Database Indexing Strategy',
        category: 'indexing',
        priority: 'critical',
        impact: {
          responseTime: 45,
          throughput: 40,
          costSavings: 20
        },
        effort: 'high',
        description: 'Redesign database indexes based on actual query patterns to dramatically improve search performance.',
        technicalDetails: 'Analyze query execution plans, create composite indexes for common search patterns, implement partial indexes for filtered queries.',
        implementation: {
          steps: [
            'Analyze current query patterns and execution plans',
            'Identify missing or suboptimal indexes',
            'Design new indexing strategy',
            'Create database migration scripts',
            'Deploy indexes during maintenance window',
            'Monitor performance improvements'
          ],
          estimatedTime: '3-4 weeks',
          resources: ['Database Administrator', 'Backend Developer', 'Performance Analyst'],
          risks: ['Storage space increase', 'Write performance impact', 'Migration downtime']
        },
        metrics: {
          current: analyticsData.avgResponseTime,
          target: 85,
          unit: 'ms'
        },
        status: 'in-progress'
      },
      {
        id: 'rec-3',
        title: 'Implement Search Result Preloading',
        category: 'performance',
        priority: 'medium',
        impact: {
          responseTime: 25,
          userSatisfaction: 20
        },
        effort: 'medium',
        description: 'Preload popular search results and use predictive loading based on user behavior patterns.',
        technicalDetails: 'Machine learning model to predict next searches, background preloading of popular content, intelligent prefetching based on user session patterns.',
        implementation: {
          steps: [
            'Implement user behavior tracking',
            'Train ML model for search prediction',
            'Create background preloading service',
            'Implement client-side prefetching',
            'Monitor prediction accuracy and performance'
          ],
          estimatedTime: '4-5 weeks',
          resources: ['ML Engineer', 'Frontend Developer', 'Backend Developer'],
          risks: ['Model accuracy concerns', 'Increased bandwidth usage', 'Complexity in implementation']
        },
        metrics: {
          current: 0,
          target: 25,
          unit: '% faster'
        },
        status: 'not-started'
      },
      {
        id: 'rec-4',
        title: 'Upgrade Infrastructure Scaling',
        category: 'infrastructure',
        priority: 'high',
        impact: {
          throughput: 60,
          responseTime: 30,
          costSavings: 15
        },
        effort: 'high',
        description: 'Implement auto-scaling infrastructure to handle peak loads efficiently and reduce costs during low usage.',
        technicalDetails: 'Container orchestration with Kubernetes, auto-scaling based on CPU/memory/request metrics, load balancing optimization.',
        implementation: {
          steps: [
            'Containerize application components',
            'Set up Kubernetes cluster',
            'Configure auto-scaling policies',
            'Implement advanced load balancing',
            'Monitor resource utilization and costs'
          ],
          estimatedTime: '5-6 weeks',
          resources: ['DevOps Engineer', 'Infrastructure Architect', 'Backend Developer'],
          risks: ['Migration complexity', 'Initial cost increase', 'Learning curve for team']
        },
        metrics: {
          current: analyticsData.performanceMetrics.throughput,
          target: 250,
          unit: 'req/s'
        },
        status: 'not-started'
      },
      {
        id: 'rec-5',
        title: 'Enhance Search UI Responsiveness',
        category: 'user-experience',
        priority: 'medium',
        impact: {
          userSatisfaction: 30,
          responseTime: 15
        },
        effort: 'low',
        description: 'Improve search interface with instant feedback, progressive loading, and optimistic updates.',
        technicalDetails: 'Implement debounced search suggestions, skeleton loading states, virtual scrolling for large result sets, optimistic UI updates.',
        implementation: {
          steps: [
            'Implement debounced search input',
            'Add skeleton loading components',
            'Create progressive result loading',
            'Optimize re-rendering performance',
            'Add optimistic UI updates'
          ],
          estimatedTime: '1-2 weeks',
          resources: ['Frontend Developer', 'UX Designer'],
          risks: ['UI/UX complexity', 'Browser compatibility', 'Performance on low-end devices']
        },
        metrics: {
          current: 2.1,
          target: 1.5,
          unit: 's to first result'
        },
        status: 'completed'
      }
    ];
  }, [analyticsData]);

  // Generate performance bottlenecks
  const performanceBottlenecks = useMemo((): PerformanceBottleneck[] => {
    return [
      {
        component: 'Database Query Execution',
        impact: 45,
        description: 'Complex JOIN operations and missing indexes causing slow query execution',
        solution: 'Optimize indexes and query structure',
        priority: 'critical'
      },
      {
        component: 'Search Algorithm Processing',
        impact: 25,
        description: 'Text processing and similarity calculations taking excessive time',
        solution: 'Implement parallel processing and caching',
        priority: 'high'
      },
      {
        component: 'Memory Management',
        impact: 15,
        description: 'Inefficient memory allocation causing garbage collection pauses',
        solution: 'Optimize object pooling and memory allocation patterns',
        priority: 'medium'
      },
      {
        component: 'Network Latency',
        impact: 10,
        description: 'High latency in data retrieval from external services',
        solution: 'Implement connection pooling and reduce payload sizes',
        priority: 'medium'
      },
      {
        component: 'Cache Miss Penalty',
        impact: 5,
        description: 'Low cache hit rate resulting in frequent database queries',
        solution: 'Improve cache warming and retention strategies',
        priority: 'low'
      }
    ];
  }, []);

  // Filter recommendations
  const filteredRecommendations = useMemo(() => {
    return recommendations.filter(rec => {
      const categoryMatch = selectedCategory === 'all' || rec.category === selectedCategory;
      const priorityMatch = selectedPriority === 'all' || rec.priority === selectedPriority;
      return categoryMatch && priorityMatch;
    });
  }, [recommendations, selectedCategory, selectedPriority]);

  // Calculate potential impact
  const totalImpact = useMemo(() => {
    const activeRecs = recommendations.filter(r => r.status !== 'completed');
    return {
      responseTime: activeRecs.reduce((sum, rec) => sum + (rec.impact.responseTime || 0), 0) / activeRecs.length,
      throughput: activeRecs.reduce((sum, rec) => sum + (rec.impact.throughput || 0), 0) / activeRecs.length,
      userSatisfaction: activeRecs.reduce((sum, rec) => sum + (rec.impact.userSatisfaction || 0), 0) / activeRecs.length,
      costSavings: activeRecs.reduce((sum, rec) => sum + (rec.impact.costSavings || 0), 0)
    };
  }, [recommendations]);

  const toggleRecommendation = (id: string) => {
    const newExpanded = new Set(expandedRecommendations);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRecommendations(newExpanded);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'performance': return Activity;
      case 'caching': return Database;
      case 'indexing': return Search;
      case 'infrastructure': return Target;
      case 'user-experience': return Users;
      default: return Lightbulb;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">Completed</span>;
      case 'in-progress':
        return <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">In Progress</span>;
      case 'on-hold':
        return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">On Hold</span>;
      default:
        return <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">Not Started</span>;
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Optimization Recommendations</h2>
          <p className="text-gray-600 text-sm mt-1">Performance improvements and optimization opportunities</p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Categories</option>
            <option value="performance">Performance</option>
            <option value="caching">Caching</option>
            <option value="indexing">Indexing</option>
            <option value="infrastructure">Infrastructure</option>
            <option value="user-experience">User Experience</option>
          </select>
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Impact Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-6 border border-green-100">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-green-600 rounded-lg">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <TrendingUp className="w-4 h-4 text-green-600" />
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Response Time</h3>
          <div className="text-2xl font-bold text-gray-900">{totalImpact.responseTime.toFixed(0)}%</div>
          <div className="text-sm text-green-600 mt-1">Potential improvement</div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-100">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Throughput</h3>
          <div className="text-2xl font-bold text-gray-900">{totalImpact.throughput.toFixed(0)}%</div>
          <div className="text-sm text-blue-600 mt-1">Potential increase</div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg p-6 border border-purple-100">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-purple-600 rounded-lg">
              <Star className="w-5 h-5 text-white" />
            </div>
            <TrendingUp className="w-4 h-4 text-purple-600" />
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">User Satisfaction</h3>
          <div className="text-2xl font-bold text-gray-900">{totalImpact.userSatisfaction.toFixed(0)}%</div>
          <div className="text-sm text-purple-600 mt-1">Expected increase</div>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg p-6 border border-yellow-100">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-yellow-600 rounded-lg">
              <Target className="w-5 h-5 text-white" />
            </div>
            <TrendingUp className="w-4 h-4 text-yellow-600" />
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Cost Savings</h3>
          <div className="text-2xl font-bold text-gray-900">{totalImpact.costSavings.toFixed(0)}%</div>
          <div className="text-sm text-yellow-600 mt-1">Projected savings</div>
        </div>
      </div>

      {/* Performance Bottlenecks */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Bottlenecks Analysis</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={performanceBottlenecks} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="component" 
              angle={-45}
              textAnchor="end"
              height={80}
              interval={0}
              fontSize={12}
            />
            <YAxis label={{ value: 'Impact (%)', angle: -90, position: 'insideLeft' }} />
            <Tooltip
              formatter={(value) => [`${value}%`, 'Performance Impact']}
              labelFormatter={(label) => `Component: ${label}`}
            />
            <Bar dataKey="impact" fill="#ef4444" name="impact" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recommendations List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Optimization Recommendations</h3>
          <button
            onClick={() => setShowImplementationDetails(!showImplementationDetails)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            {showImplementationDetails ? 'Hide' : 'Show'} Implementation Details
          </button>
        </div>
        
        <div className="space-y-4">
          {filteredRecommendations.map((recommendation) => {
            const Icon = getCategoryIcon(recommendation.category);
            const isExpanded = expandedRecommendations.has(recommendation.id);
            const priorityStyle = PRIORITY_COLORS[recommendation.priority];
            
            return (
              <div key={recommendation.id} className={`border rounded-lg ${priorityStyle.border} ${priorityStyle.bg}`}>
                <button
                  onClick={() => toggleRecommendation(recommendation.id)}
                  className="w-full p-6 text-left hover:bg-opacity-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className={`p-2 rounded-lg bg-white`}>
                        <Icon className={`w-5 h-5 ${priorityStyle.text}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h4 className="font-semibold text-gray-900">{recommendation.title}</h4>
                          <span className={`w-2 h-2 rounded-full ${priorityStyle.dot}`} />
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${priorityStyle.text} bg-white`}>
                            {recommendation.priority.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mb-3">{recommendation.description}</p>
                        
                        <div className="flex items-center space-x-6 text-sm">
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-600">Impact:</span>
                            {recommendation.impact.responseTime && (
                              <span className="text-green-600 font-medium">-{recommendation.impact.responseTime}% response time</span>
                            )}
                            {recommendation.impact.throughput && (
                              <span className="text-blue-600 font-medium">+{recommendation.impact.throughput}% throughput</span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-600">Effort:</span>
                            <span className={`font-medium ${EFFORT_COLORS[recommendation.effort]}`}>
                              {recommendation.effort}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      {getStatusBadge(recommendation.status)}
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </button>
                
                {isExpanded && (
                  <div className="px-6 pb-6 border-t border-current border-opacity-20">
                    <div className="pt-4 space-y-4">
                      <div>
                        <h5 className="font-medium text-sm mb-2">Technical Details</h5>
                        <p className="text-sm text-gray-700">{recommendation.technicalDetails}</p>
                      </div>
                      
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                          <h5 className="font-medium text-sm mb-2">Current vs Target Metrics</h5>
                          <div className="bg-white rounded-lg p-3 border">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm text-gray-600">Current</span>
                              <span className="font-medium">{recommendation.metrics.current}{recommendation.metrics.unit}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Target</span>
                              <span className="font-medium text-green-600">{recommendation.metrics.target}{recommendation.metrics.unit}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <h5 className="font-medium text-sm mb-2">Expected Impact</h5>
                          <div className="bg-white rounded-lg p-3 border space-y-1">
                            {Object.entries(recommendation.impact).map(([key, value]) => (
                              <div key={key} className="flex justify-between items-center text-sm">
                                <span className="text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                                <span className="font-medium text-green-600">+{value}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      {showImplementationDetails && (
                        <div className="space-y-4">
                          <div>
                            <h5 className="font-medium text-sm mb-2">Implementation Steps</h5>
                            <ol className="list-decimal list-inside space-y-1">
                              {recommendation.implementation.steps.map((step, index) => (
                                <li key={index} className="text-sm text-gray-700">{step}</li>
                              ))}
                            </ol>
                          </div>
                          
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div>
                              <h5 className="font-medium text-sm mb-2">Resources Needed</h5>
                              <ul className="space-y-1">
                                {recommendation.implementation.resources.map((resource, index) => (
                                  <li key={index} className="text-sm text-gray-700 flex items-center space-x-2">
                                    <Users className="w-3 h-3" />
                                    <span>{resource}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                            
                            <div>
                              <h5 className="font-medium text-sm mb-2">Timeline</h5>
                              <div className="flex items-center space-x-2 text-sm text-gray-700">
                                <Clock className="w-3 h-3" />
                                <span>{recommendation.implementation.estimatedTime}</span>
                              </div>
                            </div>
                            
                            <div>
                              <h5 className="font-medium text-sm mb-2">Risks</h5>
                              <ul className="space-y-1">
                                {recommendation.implementation.risks.map((risk, index) => (
                                  <li key={index} className="text-sm text-red-600 flex items-center space-x-2">
                                    <AlertTriangle className="w-3 h-3" />
                                    <span>{risk}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Implementation Roadmap */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Implementation Roadmap</h3>
        <div className="space-y-3">
          {recommendations
            .filter(r => r.status !== 'completed')
            .sort((a, b) => {
              const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
              return priorityOrder[b.priority] - priorityOrder[a.priority];
            })
            .map((rec, index) => {
              const Icon = getCategoryIcon(rec.category);
              const priorityStyle = PRIORITY_COLORS[rec.priority];
              
              return (
                <div key={rec.id} className="flex items-center space-x-4 p-4 bg-white rounded-lg border border-gray-200">
                  <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full font-medium text-sm">
                    {index + 1}
                  </div>
                  <div className={`p-2 rounded-lg ${priorityStyle.bg}`}>
                    <Icon className={`w-4 h-4 ${priorityStyle.text}`} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{rec.title}</h4>
                    <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                      <span>Priority: <span className={priorityStyle.text}>{rec.priority}</span></span>
                      <span>Effort: <span className={EFFORT_COLORS[rec.effort]}>{rec.effort}</span></span>
                      <span>Timeline: {rec.implementation.estimatedTime}</span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                </div>
              );
            })
          }
        </div>
      </div>
    </div>
  );
};