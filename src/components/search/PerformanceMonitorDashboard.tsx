/**
 * Performance Monitor Dashboard - UC001 Implementation
 *
 * Real-time performance monitoring for hybrid search with:
 * 1. <500ms local search compliance tracking
 * 2. AI search performance metrics
 * 3. Authorization dialog analytics
 * 4. Search success/failure rates
 * 5. Performance alerts and warnings
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  Zap,
  Brain,
  AlertTriangle,
  CheckCircle,
  Activity,
  Target,
  Database,
  Wifi
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useSearchContext } from '../../renderer/contexts/SearchContext';
import { hybridSearchService } from '../../renderer/services/hybridSearchService';

interface PerformanceMetrics {
  localSearchTimes: number[];
  aiSearchTimes: number[];
  totalSearchTimes: number[];
  complianceRate: number;
  averageLocalTime: number;
  averageAITime: number;
  averageTotalTime: number;
  searchCount: number;
  failureRate: number;
  authorizationApprovalRate: number;
  lastUpdated: Date;
}

interface AlertItem {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  timestamp: Date;
  resolved: boolean;
}

export interface PerformanceMonitorDashboardProps {
  className?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
  showAlerts?: boolean;
  showDetailedMetrics?: boolean;
}

export function PerformanceMonitorDashboard({
  className = '',
  autoRefresh = true,
  refreshInterval = 5000,
  showAlerts = true,
  showDetailedMetrics = true
}: PerformanceMonitorDashboardProps) {
  const { state } = useSearchContext();
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    localSearchTimes: [],
    aiSearchTimes: [],
    totalSearchTimes: [],
    complianceRate: 100,
    averageLocalTime: 0,
    averageAITime: 0,
    averageTotalTime: 0,
    searchCount: 0,
    failureRate: 0,
    authorizationApprovalRate: 0,
    lastUpdated: new Date()
  });

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(autoRefresh);
  const [healthStatus, setHealthStatus] = useState<'healthy' | 'warning' | 'critical'>('healthy');

  // Calculate performance metrics from search state
  const updateMetrics = useCallback(() => {
    const newMetrics: PerformanceMetrics = {
      localSearchTimes: [...metrics.localSearchTimes, state.performance.localSearchTime].slice(-100),
      aiSearchTimes: state.performance.aiSearchTime ? 
        [...metrics.aiSearchTimes, state.performance.aiSearchTime].slice(-100) : 
        metrics.aiSearchTimes,
      totalSearchTimes: [...metrics.totalSearchTimes, state.performance.totalTime].slice(-100),
      complianceRate: 0,
      averageLocalTime: 0,
      averageAITime: 0,
      averageTotalTime: 0,
      searchCount: metrics.searchCount + (state.metadata.searchCompleted ? 1 : 0),
      failureRate: state.error ? (metrics.failureRate + 1) / (metrics.searchCount + 1) : metrics.failureRate,
      authorizationApprovalRate: state.authorizationStatus === 'approved' ? 
        (metrics.authorizationApprovalRate + 1) / (metrics.searchCount + 1) : 
        metrics.authorizationApprovalRate,
      lastUpdated: new Date()
    };

    // Calculate averages
    if (newMetrics.localSearchTimes.length > 0) {
      newMetrics.averageLocalTime = newMetrics.localSearchTimes.reduce((a, b) => a + b, 0) / newMetrics.localSearchTimes.length;
      newMetrics.complianceRate = (newMetrics.localSearchTimes.filter(time => time <= 500).length / newMetrics.localSearchTimes.length) * 100;
    }
    
    if (newMetrics.aiSearchTimes.length > 0) {
      newMetrics.averageAITime = newMetrics.aiSearchTimes.reduce((a, b) => a + b, 0) / newMetrics.aiSearchTimes.length;
    }
    
    if (newMetrics.totalSearchTimes.length > 0) {
      newMetrics.averageTotalTime = newMetrics.totalSearchTimes.reduce((a, b) => a + b, 0) / newMetrics.totalSearchTimes.length;
    }

    setMetrics(newMetrics);

    // Generate alerts
    const newAlerts: AlertItem[] = [];
    
    if (state.performance.localSearchTime > 500) {
      newAlerts.push({
        id: `local-slow-${Date.now()}`,
        type: 'warning',
        message: `Local search exceeded 500ms threshold: ${state.performance.localSearchTime}ms`,
        timestamp: new Date(),
        resolved: false
      });
    }
    
    if (newMetrics.complianceRate < 95) {
      newAlerts.push({
        id: `compliance-low-${Date.now()}`,
        type: 'error',
        message: `Local search compliance below 95%: ${newMetrics.complianceRate.toFixed(1)}%`,
        timestamp: new Date(),
        resolved: false
      });
    }
    
    if (state.error) {
      newAlerts.push({
        id: `search-error-${Date.now()}`,
        type: 'error',
        message: `Search failed: ${state.error}`,
        timestamp: new Date(),
        resolved: false
      });
    }

    if (newAlerts.length > 0) {
      setAlerts(prev => [...newAlerts, ...prev].slice(0, 50)); // Keep last 50 alerts
    }

    // Update health status
    if (newMetrics.complianceRate < 90 || newMetrics.failureRate > 0.1) {
      setHealthStatus('critical');
    } else if (newMetrics.complianceRate < 95 || newMetrics.failureRate > 0.05) {
      setHealthStatus('warning');
    } else {
      setHealthStatus('healthy');
    }
  }, [state, metrics]);

  // Auto-refresh effect
  useEffect(() => {
    if (isMonitoring && autoRefresh) {
      const interval = setInterval(updateMetrics, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [isMonitoring, autoRefresh, refreshInterval, updateMetrics]);

  // Update metrics when search state changes
  useEffect(() => {
    if (state.metadata.searchCompleted) {
      updateMetrics();
    }
  }, [state.metadata.searchCompleted, updateMetrics]);

  // Clear resolved alerts
  const clearAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, resolved: true } : alert
    ));
  }, []);

  // Service health check
  const [serviceHealth, setServiceHealth] = useState<any>(null);
  
  useEffect(() => {
    const checkServiceHealth = async () => {
      try {
        const health = await hybridSearchService.getHealthStatus();
        setServiceHealth(health);
      } catch (error) {
        console.error('Failed to check service health:', error);
      }
    };
    
    checkServiceHealth();
    
    if (autoRefresh) {
      const interval = setInterval(checkServiceHealth, refreshInterval * 2);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  // Performance grade calculation
  const performanceGrade = useMemo(() => {
    if (metrics.complianceRate >= 98 && metrics.failureRate < 0.01) return 'A+';
    if (metrics.complianceRate >= 95 && metrics.failureRate < 0.02) return 'A';
    if (metrics.complianceRate >= 90 && metrics.failureRate < 0.05) return 'B';
    if (metrics.complianceRate >= 80 && metrics.failureRate < 0.1) return 'C';
    return 'D';
  }, [metrics]);

  const getHealthColor = (status: typeof healthStatus) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
    }
  };

  const getHealthIcon = (status: typeof healthStatus) => {
    switch (status) {
      case 'healthy': return CheckCircle;
      case 'warning': return AlertTriangle;
      case 'critical': return AlertTriangle;
    }
  };

  const HealthIcon = getHealthIcon(healthStatus);

  return (
    <div className={`performance-monitor-dashboard space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Performance Monitor
          </h2>
          <Badge 
            variant={healthStatus === 'healthy' ? 'default' : 'destructive'}
            className="flex items-center gap-1"
          >
            <HealthIcon className="h-3 w-3" />
            {healthStatus.toUpperCase()}
          </Badge>
          <Badge variant="outline">
            Grade: {performanceGrade}
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsMonitoring(!isMonitoring)}
            className="flex items-center gap-2"
          >
            <Activity className={`h-4 w-4 ${isMonitoring ? 'animate-pulse' : ''}`} />
            {isMonitoring ? 'Monitoring' : 'Paused'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={updateMetrics}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-green-600" />
              UC001 Compliance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.complianceRate.toFixed(1)}%</div>
            <div className="text-sm text-gray-600">Local search &lt;500ms</div>
            <Progress 
              value={metrics.complianceRate} 
              className="mt-2"
              variant={metrics.complianceRate >= 95 ? "default" : "destructive"}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-600" />
              Local Search
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.averageLocalTime.toFixed(0)}ms</div>
            <div className="text-sm text-gray-600">Average time</div>
            <div className="flex items-center gap-1 mt-1">
              {metrics.averageLocalTime <= 500 ? (
                <CheckCircle className="h-3 w-3 text-green-500" />
              ) : (
                <AlertTriangle className="h-3 w-3 text-red-500" />
              )}
              <span className="text-xs">
                {metrics.averageLocalTime <= 500 ? 'Within threshold' : 'Exceeds threshold'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-600" />
              AI Enhancement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.averageAITime > 0 ? `${metrics.averageAITime.toFixed(0)}ms` : 'N/A'}
            </div>
            <div className="text-sm text-gray-600">Average time</div>
            <div className="text-xs text-gray-500 mt-1">
              {metrics.authorizationApprovalRate > 0 ? 
                `${(metrics.authorizationApprovalRate * 100).toFixed(1)}% approval` : 
                'No AI searches'
              }
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-orange-600" />
              Search Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.searchCount}</div>
            <div className="text-sm text-gray-600">Total searches</div>
            <div className="text-xs text-gray-500 mt-1">
              {(metrics.failureRate * 100).toFixed(1)}% failure rate
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics Tabs */}
      {showDetailedMetrics && (
        <Tabs defaultValue="performance" className="w-full">
          <TabsList>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="service">Service Health</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
          </TabsList>
          
          <TabsContent value="performance" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Current Search Performance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Local Search Time</span>
                    <span className="font-mono">{state.performance.localSearchTime}ms</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>AI Search Time</span>
                    <span className="font-mono">
                      {state.performance.aiSearchTime || 0}ms
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Total Time</span>
                    <span className="font-mono">{state.performance.totalTime}ms</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Authorization Required</span>
                    <Badge variant={state.authorizationRequired ? "default" : "outline"}>
                      {state.authorizationRequired ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Search Results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Local Results</span>
                    <span className="font-mono">{state.metadata.localResultCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>AI Results</span>
                    <span className="font-mono">{state.metadata.aiResultCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Total Results</span>
                    <span className="font-mono">{state.metadata.totalResultCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Duplicates Removed</span>
                    <span className="font-mono">{state.metadata.duplicatesRemoved}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="service" className="mt-4">
            {serviceHealth && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Service Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        <span>Local Search</span>
                        <Badge variant={serviceHealth.localSearchAvailable ? "default" : "destructive"}>
                          {serviceHealth.localSearchAvailable ? 'Available' : 'Unavailable'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Brain className="h-4 w-4" />
                        <span>AI Search</span>
                        <Badge variant={serviceHealth.aiSearchAvailable ? "default" : "destructive"}>
                          {serviceHealth.aiSearchAvailable ? 'Available' : 'Unavailable'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Wifi className="h-4 w-4" />
                        <span>Authorization</span>
                        <Badge variant={serviceHealth.authorizationAvailable ? "default" : "destructive"}>
                          {serviceHealth.authorizationAvailable ? 'Available' : 'Unavailable'}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm">
                        <span className="text-gray-600">System Health:</span>
                        <span className={`ml-2 font-medium ${serviceHealth.healthy ? 'text-green-600' : 'text-red-600'}`}>
                          {serviceHealth.healthy ? 'Healthy' : 'Unhealthy'}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-600">Avg Local Time:</span>
                        <span className="ml-2 font-mono">
                          {serviceHealth.performanceMetrics.averageLocalSearchTime.toFixed(0)}ms
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="trends" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Performance Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-sm text-gray-600">
                    Showing last {metrics.localSearchTimes.length} searches
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-lg font-bold">
                        {metrics.localSearchTimes.filter(t => t <= 500).length}
                      </div>
                      <div className="text-sm text-green-600">Compliant Searches</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold">
                        {metrics.localSearchTimes.filter(t => t > 500).length}
                      </div>
                      <div className="text-sm text-red-600">Non-compliant</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold">
                        {metrics.aiSearchTimes.length}
                      </div>
                      <div className="text-sm text-purple-600">AI Enhanced</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Alerts Section */}
      {showAlerts && alerts.filter(a => !a.resolved).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Performance Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts
                .filter(alert => !alert.resolved)
                .slice(0, 5)
                .map(alert => (
                <Alert key={alert.id} variant={alert.type === 'error' ? 'destructive' : 'default'}>
                  <AlertDescription className="flex justify-between items-start">
                    <div>
                      <div>{alert.message}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {alert.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => clearAlert(alert.id)}
                      className="text-xs"
                    >
                      Dismiss
                    </Button>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}