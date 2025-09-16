/**
 * Alerts Panel
 * Displays active alerts and violations
 */

import React, { useState } from 'react';

interface Violation {
  type: string;
  timestamp: number;
  severity: 'warning' | 'critical';
  message: string;
}

interface AlertsPanelProps {
  violations: Violation[];
}

export const AlertsPanel: React.FC<AlertsPanelProps> = ({ violations }) => {
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning'>('all');
  const [isExpanded, setIsExpanded] = useState(true);

  const filteredViolations = violations.filter(v =>
    filter === 'all' || v.severity === filter
  );

  const criticalCount = violations.filter(v => v.severity === 'critical').length;
  const warningCount = violations.filter(v => v.severity === 'warning').length;

  const getAlertIcon = (severity: string) => {
    return severity === 'critical' ? '🚨' : '⚠️';
  };

  const getAlertBadge = (severity: string) => {
    return severity === 'critical'
      ? 'bg-red-100 text-red-800 border-red-200'
      : 'bg-yellow-100 text-yellow-800 border-yellow-200';
  };

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  if (violations.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-red-200">
      <div
        className="p-4 border-b border-red-200 bg-red-50 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <span className="text-lg">🚨</span>
              <h2 className="text-lg font-semibold text-red-900">Active Alerts</h2>
            </div>

            <div className="flex items-center space-x-2">
              {criticalCount > 0 && (
                <span className="bg-red-200 text-red-800 px-2 py-1 rounded-full text-xs font-medium">
                  {criticalCount} Critical
                </span>
              )}
              {warningCount > 0 && (
                <span className="bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
                  {warningCount} Warning
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-sm text-red-700">
              {violations.length} total alert{violations.length !== 1 ? 's' : ''}
            </span>
            <button className="text-red-600 hover:text-red-800">
              {isExpanded ? '−' : '+'}
            </button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4">
          {/* Filter Controls */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">Filter:</span>
              <div className="flex space-x-1">
                {[
                  { id: 'all', label: 'All', count: violations.length },
                  { id: 'critical', label: 'Critical', count: criticalCount },
                  { id: 'warning', label: 'Warning', count: warningCount }
                ].map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setFilter(option.id as any)}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      filter === option.id
                        ? 'bg-red-100 text-red-800 border border-red-300'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {option.label} ({option.count})
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button className="text-sm text-blue-600 hover:text-blue-800">
                Mark all as read
              </button>
              <button className="text-sm text-gray-600 hover:text-gray-800">
                Export
              </button>
            </div>
          </div>

          {/* Alerts List */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredViolations.map((violation, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border-l-4 transition-all hover:shadow-sm ${
                  violation.severity === 'critical'
                    ? 'bg-red-50 border-red-400'
                    : 'bg-yellow-50 border-yellow-400'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="text-xl">{getAlertIcon(violation.severity)}</span>

                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getAlertBadge(violation.severity)}`}>
                          {violation.severity.toUpperCase()}
                        </span>

                        <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                          {violation.type.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <p className="text-sm text-gray-900 mb-2 leading-relaxed">
                      {violation.message}
                    </p>

                    <div className="flex items-center space-x-4 text-xs text-gray-600">
                      <span>📅 {formatTimeAgo(violation.timestamp)}</span>
                      <span>🕒 {new Date(violation.timestamp).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col space-y-1 ml-4">
                    <button className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded bg-blue-50 hover:bg-blue-100">
                      Investigate
                    </button>
                    <button className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1 rounded bg-gray-50 hover:bg-gray-100">
                      Acknowledge
                    </button>
                    {violation.severity === 'critical' && (
                      <button className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded bg-red-50 hover:bg-red-100">
                        Escalate
                      </button>
                    )}
                  </div>
                </div>

                {/* Additional Context for Critical Alerts */}
                {violation.severity === 'critical' && (
                  <div className="mt-3 p-3 bg-red-100 rounded-md">
                    <div className="flex items-start space-x-2">
                      <span className="text-red-600 text-sm">💡</span>
                      <div className="text-sm text-red-800">
                        <p className="font-medium mb-1">Immediate Action Required</p>
                        <ul className="text-xs space-y-1">
                          {violation.type === 'response_time' && (
                            <>
                              <li>• Check database connection pool</li>
                              <li>• Review slow query log</li>
                              <li>• Monitor server resources</li>
                            </>
                          )}
                          {violation.type === 'error_rate' && (
                            <>
                              <li>• Check application logs for errors</li>
                              <li>• Verify external service dependencies</li>
                              <li>• Review recent deployments</li>
                            </>
                          )}
                          {violation.type === 'throughput' && (
                            <>
                              <li>• Check load balancer configuration</li>
                              <li>• Monitor auto-scaling triggers</li>
                              <li>• Review traffic patterns</li>
                            </>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* No Filtered Results */}
          {filteredViolations.length === 0 && (
            <div className="text-center py-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-gray-900">No {filter} alerts</h3>
              <p className="text-xs text-gray-600">
                {filter === 'all'
                  ? 'All alerts have been resolved'
                  : `No ${filter} alerts at this time`}
              </p>
            </div>
          )}

          {/* Action Bar */}
          {filteredViolations.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing {filteredViolations.length} of {violations.length} alerts
                </div>

                <div className="flex items-center space-x-2">
                  <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
                    Refresh Alerts
                  </button>
                  <button className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
                    Configure Notifications
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};