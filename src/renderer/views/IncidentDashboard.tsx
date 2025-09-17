/**
 * Incident Dashboard View
 * Displays key metrics, charts, and recent incidents overview
 */

import React, { useState, useEffect } from 'react';
import PriorityBadge from '../components/incident/PriorityBadge';
import StatusBadge from '../components/incident/StatusBadge';
import {
  IncidentDashboardProps,
  IncidentMetrics,
  IncidentKBEntry,
  PriorityDistributionData
} from '../../types/incident';

const IncidentDashboard: React.FC<IncidentDashboardProps> = ({
  timeframe = '24h',
  auto_refresh = true,
  refresh_interval = 30
}) => {
  const [metrics, setMetrics] = useState<IncidentMetrics | null>(null);
  const [recentIncidents, setRecentIncidents] = useState<IncidentKBEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Mock data for demonstration
  useEffect(() => {
    const fetchData = () => {
      setTimeout(() => {
        const mockMetrics: IncidentMetrics = {
          total_open: 12,
          total_assigned: 8,
          total_in_progress: 5,
          total_resolved_today: 23,
          avg_resolution_time: 145, // minutes
          sla_breaches: 2,
          priority_distribution: {
            P1: 3,
            P2: 7,
            P3: 15,
            P4: 8
          },
          status_distribution: {
            open: 12,
            assigned: 8,
            in_progress: 5,
            pending_review: 3,
            resolved: 23,
            closed: 45,
            reopened: 1
          },
          recent_incidents: []
        };

        const mockRecentIncidents: IncidentKBEntry[] = [
          {
            id: '1',
            title: 'JCL Job Failing with S0C4 ABEND',
            problem: 'Production JCL job failing with system completion code S0C4',
            solution: 'Check program for array bounds violation and recompile',
            category: 'JCL',
            tags: ['production', 'abend', 's0c4'],
            created_at: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
            updated_at: new Date(),
            created_by: 'system',
            usage_count: 5,
            success_count: 4,
            failure_count: 1,
            version: 1,
            status: 'open',
            priority: 'P1',
            escalation_level: 'none',
            assigned_to: undefined,
            business_impact: 'critical',
            customer_impact: true,
            incident_number: 'INC-2024-001'
          },
          {
            id: '2',
            title: 'DB2 Connection Pool Exhausted',
            problem: 'Application unable to connect to DB2',
            solution: 'Increase connection pool size',
            category: 'DB2',
            tags: ['database', 'connections'],
            created_at: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
            updated_at: new Date(),
            created_by: 'dba.team',
            usage_count: 3,
            success_count: 3,
            failure_count: 0,
            version: 1,
            status: 'in_progress',
            priority: 'P2',
            escalation_level: 'none',
            assigned_to: 'john.doe@company.com',
            business_impact: 'high',
            customer_impact: false,
            incident_number: 'INC-2024-002'
          },
          {
            id: '3',
            title: 'VSAM File Corruption Detected',
            problem: 'VSAM dataset showing logical record length inconsistencies',
            solution: 'Run IDCAMS VERIFY and rebuild indexes',
            category: 'VSAM',
            tags: ['vsam', 'corruption'],
            created_at: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
            updated_at: new Date(),
            created_by: 'system',
            usage_count: 2,
            success_count: 2,
            failure_count: 0,
            version: 1,
            status: 'resolved',
            priority: 'P3',
            escalation_level: 'none',
            assigned_to: 'jane.smith@company.com',
            business_impact: 'medium',
            customer_impact: false,
            incident_number: 'INC-2024-003',
            resolution_time: 30
          }
        ];

        setMetrics(mockMetrics);
        setRecentIncidents(mockRecentIncidents);
        setLoading(false);
        setLastRefresh(new Date());
      }, 1000);
    };

    fetchData();

    // Set up auto-refresh
    if (auto_refresh) {
      const interval = setInterval(fetchData, refresh_interval * 1000);
      return () => clearInterval(interval);
    }
  }, [timeframe, auto_refresh, refresh_interval]);

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  const calculatePriorityDistribution = (): PriorityDistributionData => {
    if (!metrics) return { P1: { count: 0, percentage: 0, color: '' }, P2: { count: 0, percentage: 0, color: '' }, P3: { count: 0, percentage: 0, color: '' }, P4: { count: 0, percentage: 0, color: '' } };
    
    const total = Object.values(metrics.priority_distribution).reduce((sum, count) => sum + count, 0);
    
    return {
      P1: {
        count: metrics.priority_distribution.P1,
        percentage: total > 0 ? Math.round((metrics.priority_distribution.P1 / total) * 100) : 0,
        color: '#ef4444'
      },
      P2: {
        count: metrics.priority_distribution.P2,
        percentage: total > 0 ? Math.round((metrics.priority_distribution.P2 / total) * 100) : 0,
        color: '#f97316'
      },
      P3: {
        count: metrics.priority_distribution.P3,
        percentage: total > 0 ? Math.round((metrics.priority_distribution.P3 / total) * 100) : 0,
        color: '#eab308'
      },
      P4: {
        count: metrics.priority_distribution.P4,
        percentage: total > 0 ? Math.round((metrics.priority_distribution.P4 / total) * 100) : 0,
        color: '#22c55e'
      }
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const priorityData = calculatePriorityDistribution();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Incident Dashboard</h1>
          <p className="text-sm text-gray-500">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <select 
            value={timeframe}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">
            Refresh
          </button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Open Incidents</p>
              <p className="text-2xl font-bold text-gray-900">{metrics?.total_open}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">In Progress</p>
              <p className="text-2xl font-bold text-gray-900">{metrics?.total_in_progress}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Resolved Today</p>
              <p className="text-2xl font-bold text-gray-900">{metrics?.total_resolved_today}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg Resolution Time</p>
              <p className="text-2xl font-bold text-gray-900">{formatDuration(metrics?.avg_resolution_time || 0)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Distribution Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Priority Distribution</h3>
          <div className="space-y-4">
            {Object.entries(priorityData).map(([priority, data]) => (
              <div key={priority} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <PriorityBadge priority={priority as any} size="sm" showLabel={false} />
                  <span className="text-sm font-medium text-gray-700">
                    {priority} - {data.count} incidents
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${data.percentage}%`,
                        backgroundColor: data.color
                      }}
                    />
                  </div>
                  <span className="text-sm text-gray-500 w-8">{data.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SLA Performance */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">SLA Performance</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-red-800">SLA Breaches</p>
                <p className="text-xs text-red-600">Incidents exceeding SLA targets</p>
              </div>
              <div className="text-2xl font-bold text-red-600">{metrics?.sla_breaches}</div>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-yellow-800">At Risk</p>
                <p className="text-xs text-yellow-600">Within 80% of SLA deadline</p>
              </div>
              <div className="text-2xl font-bold text-yellow-600">5</div>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <p className="text-sm font-medium text-green-800">SLA Compliance Rate</p>
              <div className="text-2xl font-bold text-green-600">94%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Incidents */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Incidents</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {recentIncidents.map((incident) => (
            <div key={incident.id} className="p-6 hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <PriorityBadge priority={incident.priority} size="sm" showLabel={false} />
                    <StatusBadge status={incident.status} size="sm" />
                    <span className="text-sm font-medium text-gray-900">
                      {incident.incident_number}
                    </span>
                  </div>
                  <h4 className="text-sm font-medium text-gray-900 mb-1">
                    {incident.title}
                  </h4>
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                    {incident.problem}
                  </p>
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <span>Category: {incident.category}</span>
                    <span>Impact: {incident.business_impact}</span>
                    {incident.assigned_to && (
                      <span>Assigned: {incident.assigned_to}</span>
                    )}
                  </div>
                </div>
                <div className="text-right text-xs text-gray-500">
                  <div>{formatTimeAgo(incident.created_at)}</div>
                  {incident.resolution_time && (
                    <div className="text-green-600 mt-1">
                      Resolved in {formatDuration(incident.resolution_time)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="px-6 py-3 border-t border-gray-200">
          <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
            View All Incidents →
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncidentDashboard;
