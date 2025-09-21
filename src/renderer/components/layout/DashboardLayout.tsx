/**
 * Dashboard Layout Component - Card-based Information Architecture
 * Implements progressive disclosure and improved visual hierarchy
 */

import React, { useState, ReactNode } from 'react';
import { ChevronDown, ChevronUp, BarChart3, Clock, Users, TrendingUp, AlertCircle } from 'lucide-react';
import { Tooltip, MainframeTooltip } from '../common/Tooltip';

interface CardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  variant?: 'default' | 'info' | 'warning' | 'success';
  className?: string;
  headerActions?: ReactNode;
  loading?: boolean;
}

interface QuickStatsProps {
  totalIncidents: number;
  resolvedToday: number;
  avgResolutionTime: string;
  successRate: number;
}

interface RecentActivityProps {
  activities: Array<{
    id: string;
    type: 'search' | 'resolution' | 'report';
    description: string;
    timestamp: Date;
    category?: string;
  }>;
}

// Collapsible Card Component
const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  children,
  collapsible = false,
  defaultExpanded = true,
  variant = 'default',
  className = '',
  headerActions,
  loading = false
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const variantClasses = {
    default: 'bg-white border-gray-200',
    info: 'bg-blue-50 border-blue-200',
    warning: 'bg-yellow-50 border-yellow-200',
    success: 'bg-green-50 border-green-200'
  };

  const handleToggle = () => {
    if (collapsible) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div className={`rounded-xl border shadow-sm ${variantClasses[variant]} ${className}`}>
      <div
        className={`flex items-center justify-between p-6 ${
          collapsible ? 'cursor-pointer hover:bg-gray-50/50 transition-colors' : ''
        } ${isExpanded && children ? 'border-b border-gray-200' : ''}`}
        onClick={handleToggle}
      >
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            {title}
            {loading && (
              <div className="ml-2 w-4 h-4 border-2 border-gray-300 border-t-purple-600 rounded-full animate-spin" />
            )}
          </h3>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-600">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {headerActions}
          {collapsible && (
            <button
              className="p-1 rounded-md hover:bg-gray-100 transition-colors"
              aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
            >
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              )}
            </button>
          )}
        </div>
      </div>

      {isExpanded && children && (
        <div className="p-6 pt-0">
          {children}
        </div>
      )}
    </div>
  );
};

// Quick Stats Widget
const QuickStats: React.FC<QuickStatsProps> = ({
  totalIncidents,
  resolvedToday,
  avgResolutionTime,
  successRate
}) => {
  const stats = [
    {
      label: 'Total Incidents',
      value: totalIncidents,
      icon: BarChart3,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      label: 'Resolved Today',
      value: resolvedToday,
      icon: Clock,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      label: 'Avg Resolution Time',
      value: avgResolutionTime,
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    {
      label: 'Success Rate',
      value: `${successRate}%`,
      icon: Users,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => {
        const IconComponent = stat.icon;
        return (
          <div
            key={index}
            className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center">
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <IconComponent className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div className="ml-3">
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-600">{stat.label}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Recent Activity Feed
const RecentActivity: React.FC<RecentActivityProps> = ({ activities }) => {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'search':
        return '🔍';
      case 'resolution':
        return '✅';
      case 'report':
        return '📝';
      default:
        return '📋';
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'search':
        return 'text-blue-600';
      case 'resolution':
        return 'text-green-600';
      case 'report':
        return 'text-orange-600';
      default:
        return 'text-gray-600';
    }
  };

  const formatTime = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return timestamp.toLocaleDateString();
  };

  return (
    <div className="space-y-3">
      {activities.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p>No recent activity</p>
        </div>
      ) : (
        activities.map((activity) => (
          <div
            key={activity.id}
            className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <span className="text-xl" role="img" aria-label={activity.type}>
              {getActivityIcon(activity.type)}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900">
                {activity.description}
              </p>
              <div className="flex items-center mt-1 space-x-2">
                <span className="text-xs text-gray-500">
                  {formatTime(activity.timestamp)}
                </span>
                {activity.category && (
                  <MainframeTooltip term={activity.category}>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                      {activity.category}
                    </span>
                  </MainframeTooltip>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

// Main Dashboard Layout
interface DashboardLayoutProps {
  quickStats?: QuickStatsProps;
  recentActivities?: Array<{
    id: string;
    type: 'search' | 'resolution' | 'report';
    description: string;
    timestamp: Date;
    category?: string;
  }>;
  children?: ReactNode;
  className?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  quickStats,
  recentActivities = [],
  children,
  className = ''
}) => {
  const [showAdvancedStats, setShowAdvancedStats] = useState(false);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Quick Stats */}
      {quickStats && (
        <Card
          title="System Overview"
          subtitle="Key performance indicators and statistics"
        >
          <QuickStats {...quickStats} />
        </Card>
      )}

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Primary Content */}
        <div className="lg:col-span-2 space-y-6">
          {children}

          {/* Advanced Analytics - Progressive Disclosure */}
          <Card
            title="Advanced Analytics"
            subtitle="Detailed performance metrics and trends"
            collapsible={true}
            defaultExpanded={false}
            headerActions={
              <Tooltip content="Click to view detailed analytics and performance trends">
                <button
                  onClick={() => setShowAdvancedStats(!showAdvancedStats)}
                  className="text-sm text-purple-600 hover:text-purple-800 transition-colors"
                >
                  {showAdvancedStats ? 'Hide Details' : 'View Details'}
                </button>
              </Tooltip>
            }
          >
            {showAdvancedStats && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Category Breakdown</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <MainframeTooltip term="COBOL">
                          <span className="text-sm text-gray-600">COBOL Issues</span>
                        </MainframeTooltip>
                        <span className="text-sm font-medium">45%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <MainframeTooltip term="DB2">
                          <span className="text-sm text-gray-600">DB2 Issues</span>
                        </MainframeTooltip>
                        <span className="text-sm font-medium">28%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <MainframeTooltip term="VSAM">
                          <span className="text-sm text-gray-600">VSAM Issues</span>
                        </MainframeTooltip>
                        <span className="text-sm font-medium">18%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Other</span>
                        <span className="text-sm font-medium">9%</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Resolution Trends</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">This Week</span>
                        <span className="text-sm font-medium text-green-600">↑ 12%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">This Month</span>
                        <span className="text-sm font-medium text-green-600">↑ 8%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Avg Time</span>
                        <span className="text-sm font-medium text-blue-600">2.3h</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Recent Activity */}
          <Card
            title="Recent Activity"
            subtitle="Latest searches, resolutions, and reports"
            collapsible={true}
            defaultExpanded={true}
          >
            <RecentActivity activities={recentActivities} />
          </Card>

          {/* Quick Actions */}
          <Card
            title="Quick Actions"
            subtitle="Common tasks and shortcuts"
          >
            <div className="space-y-3">
              <button className="w-full p-3 text-left bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors border border-purple-200">
                <div className="flex items-center">
                  <span className="text-lg mr-3">🚨</span>
                  <div>
                    <div className="font-medium text-purple-900">Report New Incident</div>
                    <div className="text-sm text-purple-700">Submit a new mainframe issue</div>
                  </div>
                </div>
              </button>

              <button className="w-full p-3 text-left bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200">
                <div className="flex items-center">
                  <span className="text-lg mr-3">📊</span>
                  <div>
                    <div className="font-medium text-blue-900">View Analytics</div>
                    <div className="text-sm text-blue-700">System performance insights</div>
                  </div>
                </div>
              </button>

              <button className="w-full p-3 text-left bg-green-50 hover:bg-green-100 rounded-lg transition-colors border border-green-200">
                <div className="flex items-center">
                  <span className="text-lg mr-3">📚</span>
                  <div>
                    <div className="font-medium text-green-900">Browse Knowledge Base</div>
                    <div className="text-sm text-green-700">Explore solutions and guides</div>
                  </div>
                </div>
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export { Card };
export default DashboardLayout;