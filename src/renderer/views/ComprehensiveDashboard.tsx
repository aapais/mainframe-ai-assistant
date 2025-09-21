/**
 * Comprehensive Dashboard - Integrates ALL existing dashboard components
 *
 * This dashboard provides a unified view of:
 * - Incident statistics and trends (from IncidentDashboard)
 * - Knowledge base metrics (from KBMetricsPanel & MetricsDashboard)
 * - Search analytics (from SearchResults components)
 * - Performance monitoring (from performance components)
 * - System health indicators (from monitoring components)
 * - Cost and usage tracking (from dashboard components)
 * - Recent activity feed (from various sources)
 * - Quick actions panel (from existing interfaces)
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Activity, BarChart3, TrendingUp, TrendingDown, AlertTriangle,
  Clock, Users, Database, Zap, DollarSign, Search, FileText,
  Settings, RefreshCw, Filter, Calendar, Eye, Target
} from 'lucide-react';

// Import existing dashboard components
import { KBMetricsPanel } from '../components/metrics/KBMetricsPanel';
import { MetricsDashboard } from '../components/metrics/MetricsDashboard';
import IncidentManagementDashboard from '../components/incident/IncidentManagementDashboard';
import IncidentQueue from '../components/incident/IncidentQueue';
import StatusBadge from '../components/incident/StatusBadge';
import PriorityBadge from '../components/incident/PriorityBadge';

// Import dashboard-specific components
import CostSummaryWidget from '../components/dashboard/CostSummaryWidget';
import UsageMetrics from '../components/dashboard/UsageMetrics';
import AIUsageBreakdown from '../components/dashboard/AIUsageBreakdown';
import CostChart from '../components/dashboard/CostChart';
import DecisionHistory from '../components/dashboard/DecisionHistory';
import OperationTimeline from '../components/dashboard/OperationTimeline';

// Import UI components
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui';

// Types
interface DashboardStats {
  incidents: {
    total: number;
    open: number;
    critical: number;
    resolved_today: number;
    avg_resolution_time: number;
    sla_compliance: number;
  };
  knowledge_base: {
    total_entries: number;
    searches_today: number;
    success_rate: number;
    avg_response_time: number;
    popular_categories: Array<{ name: string; count: number }>;
  };
  system: {
    uptime: number;
    memory_usage: number;
    cpu_usage: number;
    cache_hit_rate: number;
    active_users: number;
  };
  costs: {
    monthly_spend: number;
    daily_spend: number;
    budget_utilization: number;
    operations_today: number;
  };
}

interface RecentActivity {
  id: string;
  type: 'incident' | 'kb_entry' | 'search' | 'system';
  title: string;
  description: string;
  timestamp: Date;
  user?: string;
  status?: string;
  priority?: string;
}

type DashboardView = 'overview' | 'incidents' | 'knowledge' | 'performance' | 'costs' | 'analytics';

const ComprehensiveDashboard: React.FC = () => {
  // State management
  const [currentView, setCurrentView] = useState<DashboardView>('overview');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
    end: new Date()
  });

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Simulate API calls to gather all dashboard data
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock comprehensive dashboard statistics
      const mockStats: DashboardStats = {
        incidents: {
          total: 1247,
          open: 89,
          critical: 12,
          resolved_today: 23,
          avg_resolution_time: 145, // minutes
          sla_compliance: 87.2
        },
        knowledge_base: {
          total_entries: 456,
          searches_today: 234,
          success_rate: 94.3,
          avg_response_time: 187, // milliseconds
          popular_categories: [
            { name: 'JCL', count: 89 },
            { name: 'DB2', count: 67 },
            { name: 'COBOL', count: 45 },
            { name: 'CICS', count: 34 },
            { name: 'VSAM', count: 28 }
          ]
        },
        system: {
          uptime: 99.8,
          memory_usage: 68.5,
          cpu_usage: 34.2,
          cache_hit_rate: 89.7,
          active_users: 24
        },
        costs: {
          monthly_spend: 1247.85,
          daily_spend: 45.67,
          budget_utilization: 62.3,
          operations_today: 1458
        }
      };

      // Mock recent activity
      const mockActivity: RecentActivity[] = [
        {
          id: '1',
          type: 'incident',
          title: 'INC-2024-001',
          description: 'JCL Job Failing with S0C4 ABEND',
          timestamp: new Date(Date.now() - 5 * 60 * 1000),
          user: 'ops.team@company.com',
          status: 'open',
          priority: 'P1'
        },
        {
          id: '2',
          type: 'kb_entry',
          title: 'KB Entry Viewed',
          description: 'DB2 Connection Pool Solutions accessed',
          timestamp: new Date(Date.now() - 12 * 60 * 1000),
          user: 'john.doe@company.com'
        },
        {
          id: '3',
          type: 'search',
          title: 'Knowledge Search',
          description: 'Search: "VSAM file corruption recovery"',
          timestamp: new Date(Date.now() - 18 * 60 * 1000),
          user: 'jane.smith@company.com'
        },
        {
          id: '4',
          type: 'incident',
          title: 'INC-2024-002',
          description: 'DB2 Connection Pool Exhausted - Resolved',
          timestamp: new Date(Date.now() - 25 * 60 * 1000),
          user: 'dba.team@company.com',
          status: 'resolved',
          priority: 'P2'
        },
        {
          id: '5',
          type: 'system',
          title: 'System Alert',
          description: 'Cache hit rate improved to 89.7%',
          timestamp: new Date(Date.now() - 35 * 60 * 1000)
        }
      ];

      setStats(mockStats);
      setRecentActivity(mockActivity);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load and auto-refresh setup
  useEffect(() => {
    loadDashboardData();

    if (autoRefresh) {
      const interval = setInterval(loadDashboardData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [loadDashboardData, autoRefresh]);

  // Utility functions
  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }, []);

  const formatPercentage = useCallback((value: number) => {
    return `${value.toFixed(1)}%`;
  }, []);

  const formatTimeAgo = useCallback((date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  }, []);

  const getActivityIcon = useCallback((type: RecentActivity['type']) => {
    switch (type) {
      case 'incident': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'kb_entry': return <FileText className="h-4 w-4 text-blue-600" />;
      case 'search': return <Search className="h-4 w-4 text-green-600" />;
      case 'system': return <Activity className="h-4 w-4 text-purple-600" />;
      default: return <Activity className="h-4 w-4 text-gray-600" />;
    }
  }, []);

  // Usage metrics data for the UsageMetrics component
  const usageMetricsData = useMemo(() => ({
    operations: stats?.costs.operations_today || 0,
    successRate: stats?.knowledge_base.success_rate || 0,
    avgResponseTime: stats?.knowledge_base.avg_response_time || 0,
    tokensUsed: Math.floor((stats?.costs.operations_today || 0) * 1.5 * 1000), // Estimated
    costPerOperation: stats?.costs.daily_spend ? stats.costs.daily_spend / stats.costs.operations_today : 0,
    totalCost: stats?.costs.daily_spend || 0
  }), [stats]);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600 text-lg">Loading comprehensive dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-600" />
          <p className="text-red-600 text-lg font-semibold">Error loading dashboard</p>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={loadDashboardData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Comprehensive Dashboard</h1>
              <p className="text-gray-600 mt-1">
                Unified view of incidents, knowledge base, performance, and system health
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <label className="flex items-center text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Auto-refresh
              </label>
              <span className="text-sm text-gray-500">
                Last updated: {lastRefresh.toLocaleTimeString()}
              </span>
              <button
                onClick={loadDashboardData}
                disabled={loading}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'incidents', label: 'Incidents', icon: AlertTriangle },
              { id: 'knowledge', label: 'Knowledge Base', icon: FileText },
              { id: 'performance', label: 'Performance', icon: Activity },
              { id: 'costs', label: 'Costs & Usage', icon: DollarSign },
              { id: 'analytics', label: 'Analytics', icon: TrendingUp }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setCurrentView(id as DashboardView)}
                className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                  currentView === id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 py-6">
        {currentView === 'overview' && (
          <div className="space-y-6">
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Incidents Overview */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Open Incidents</p>
                      <p className="text-2xl font-bold text-gray-900">{stats?.incidents.open}</p>
                      <p className="text-sm text-gray-500">
                        {stats?.incidents.critical} critical
                      </p>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-red-600" />
                  </div>
                </CardContent>
              </Card>

              {/* Knowledge Base Metrics */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">KB Entries</p>
                      <p className="text-2xl font-bold text-gray-900">{stats?.knowledge_base.total_entries}</p>
                      <p className="text-sm text-gray-500">
                        {stats?.knowledge_base.searches_today} searches today
                      </p>
                    </div>
                    <FileText className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>

              {/* System Performance */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">System Health</p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatPercentage(stats?.system.uptime || 0)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {stats?.system.active_users} active users
                      </p>
                    </div>
                    <Activity className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              {/* Costs */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Daily Spend</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatCurrency(stats?.costs.daily_spend || 0)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {stats?.costs.operations_today} operations
                      </p>
                    </div>
                    <DollarSign className="h-8 w-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts and Widgets Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Cost Summary Widget */}
              <CostSummaryWidget
                compact={false}
                showDetailedMetrics={true}
                enableQuickActions={true}
              />

              {/* Usage Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle>Today's Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <UsageMetrics data={usageMetricsData} />
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity and Quick Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Recent Activity */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Activity className="h-5 w-5 mr-2" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentActivity.slice(0, 8).map((activity) => (
                      <div key={activity.id} className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getActivityIcon(activity.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900">
                              {activity.title}
                            </p>
                            <span className="text-xs text-gray-500">
                              {formatTimeAgo(activity.timestamp)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 truncate">
                            {activity.description}
                          </p>
                          <div className="flex items-center space-x-2 mt-1">
                            {activity.user && (
                              <span className="text-xs text-gray-500">
                                by {activity.user}
                              </span>
                            )}
                            {activity.status && (
                              <StatusBadge status={activity.status as any} size="xs" />
                            )}
                            {activity.priority && (
                              <PriorityBadge priority={activity.priority as any} size="xs" showLabel={false} />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Quick Statistics */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">SLA Compliance</span>
                      <span className="text-sm font-semibold text-green-600">
                        {formatPercentage(stats?.incidents.sla_compliance || 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Search Success Rate</span>
                      <span className="text-sm font-semibold text-blue-600">
                        {formatPercentage(stats?.knowledge_base.success_rate || 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Cache Hit Rate</span>
                      <span className="text-sm font-semibold text-purple-600">
                        {formatPercentage(stats?.system.cache_hit_rate || 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Budget Utilization</span>
                      <span className="text-sm font-semibold text-yellow-600">
                        {formatPercentage(stats?.costs.budget_utilization || 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Avg Resolution Time</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {Math.floor((stats?.incidents.avg_resolution_time || 0) / 60)}h {(stats?.incidents.avg_resolution_time || 0) % 60}m
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Popular Categories */}
            <Card>
              <CardHeader>
                <CardTitle>Popular Knowledge Base Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {stats?.knowledge_base.popular_categories.map((category, index) => (
                    <div key={category.name} className="text-center p-4 bg-gray-50 rounded-lg">
                      <p className="text-lg font-bold text-gray-900">{category.count}</p>
                      <p className="text-sm text-gray-600">{category.name}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {currentView === 'incidents' && (
          <div className="space-y-6">
            <IncidentManagementDashboard />
            <IncidentQueue
              height={600}
              onIncidentSelect={(incident) => console.log('Selected incident:', incident)}
            />
          </div>
        )}

        {currentView === 'knowledge' && (
          <div className="space-y-6">
            <KBMetricsPanel
              showAdvanced={true}
              refreshInterval={30000}
            />
            <MetricsDashboard
              refreshInterval={30000}
            />
          </div>
        )}

        {currentView === 'performance' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>System Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>CPU Usage</span>
                        <span>{formatPercentage(stats?.system.cpu_usage || 0)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${stats?.system.cpu_usage || 0}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Memory Usage</span>
                        <span>{formatPercentage(stats?.system.memory_usage || 0)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${stats?.system.memory_usage || 0}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Cache Hit Rate</span>
                        <span>{formatPercentage(stats?.system.cache_hit_rate || 0)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${stats?.system.cache_hit_rate || 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Response Times</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">KB Search Avg</span>
                      <span className="text-lg font-semibold text-gray-900">
                        {stats?.knowledge_base.avg_response_time}ms
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Incident Avg Resolution</span>
                      <span className="text-lg font-semibold text-gray-900">
                        {Math.floor((stats?.incidents.avg_resolution_time || 0) / 60)}h {(stats?.incidents.avg_resolution_time || 0) % 60}m
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">System Uptime</span>
                      <span className="text-lg font-semibold text-green-600">
                        {formatPercentage(stats?.system.uptime || 0)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <OperationTimeline dateRange={dateRange} />
          </div>
        )}

        {currentView === 'costs' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CostSummaryWidget
                compact={false}
                showDetailedMetrics={true}
                enableQuickActions={true}
                realTimeUpdates={true}
              />
              <CostChart
                dateRange={dateRange}
                detailed={true}
              />
            </div>

            <UsageMetrics data={usageMetricsData} />

            <AIUsageBreakdown
              dateRange={dateRange}
              detailed={true}
            />
          </div>
        )}

        {currentView === 'analytics' && (
          <div className="space-y-6">
            <DecisionHistory dateRange={dateRange} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Trend Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-green-800">Incident Resolution</p>
                        <p className="text-xs text-green-600">Improving trend</p>
                      </div>
                      <TrendingUp className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-blue-800">Knowledge Base Usage</p>
                        <p className="text-xs text-blue-600">Steady growth</p>
                      </div>
                      <TrendingUp className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-yellow-800">Cost Optimization</p>
                        <p className="text-xs text-yellow-600">Needs attention</p>
                      </div>
                      <TrendingDown className="h-6 w-6 text-yellow-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Key Performance Indicators</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Mean Time to Resolution</span>
                      <div className="flex items-center">
                        <span className="text-sm font-semibold text-gray-900 mr-2">
                          {Math.floor((stats?.incidents.avg_resolution_time || 0) / 60)}h {(stats?.incidents.avg_resolution_time || 0) % 60}m
                        </span>
                        <Target className="h-4 w-4 text-green-600" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">First Call Resolution</span>
                      <div className="flex items-center">
                        <span className="text-sm font-semibold text-gray-900 mr-2">78%</span>
                        <Target className="h-4 w-4 text-yellow-600" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Customer Satisfaction</span>
                      <div className="flex items-center">
                        <span className="text-sm font-semibold text-gray-900 mr-2">4.2/5</span>
                        <Target className="h-4 w-4 text-green-600" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComprehensiveDashboard;