/**
 * SLA Status Panel
 * Displays SLA compliance metrics and violations
 */

import React, { useState } from 'react';

interface SLAMetrics {
  availability: number;
  responseTimeTarget: number;
  responseTimeActual: number;
  errorRateTarget: number;
  errorRateActual: number;
  throughputTarget: number;
  throughputActual: number;
  violations: Array<{
    type: string;
    timestamp: number;
    severity: 'warning' | 'critical';
    message: string;
  }>;
}

interface SLAStatusPanelProps {
  slaMetrics: SLAMetrics;
}

export const SLAStatusPanel: React.FC<SLAStatusPanelProps> = ({
  slaMetrics
}) => {
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  const calculateCompliance = (actual: number, target: number, isErrorRate: boolean = false) => {
    if (isErrorRate) {
      return actual <= target ? 100 : Math.max(0, 100 - ((actual - target) / target) * 100);
    }

    if (target === 0) return 100;

    // For response time and throughput, being under target is good
    const ratio = actual / target;
    if (ratio <= 1) return 100;
    return Math.max(0, 100 - ((ratio - 1) * 100));
  };

  const getComplianceStatus = (compliance: number) => {
    if (compliance >= 95) return { status: 'excellent', color: 'text-green-600', bg: 'bg-green-100', border: 'border-green-200' };
    if (compliance >= 90) return { status: 'good', color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200' };
    if (compliance >= 80) return { status: 'warning', color: 'text-yellow-600', bg: 'bg-yellow-100', border: 'border-yellow-200' };
    return { status: 'critical', color: 'text-red-600', bg: 'bg-red-100', border: 'border-red-200' };
  };

  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;
  const formatDuration = (ms: number) => ms < 1000 ? `${ms.toFixed(0)}ms` : `${(ms / 1000).toFixed(2)}s`;

  // Calculate compliance for each metric
  const availabilityCompliance = slaMetrics.availability * 100;
  const responseTimeCompliance = calculateCompliance(slaMetrics.responseTimeActual, slaMetrics.responseTimeTarget);
  const errorRateCompliance = calculateCompliance(slaMetrics.errorRateActual, slaMetrics.errorRateTarget, true);
  const throughputCompliance = slaMetrics.throughputActual >= slaMetrics.throughputTarget ? 100 :
    (slaMetrics.throughputActual / slaMetrics.throughputTarget) * 100;

  const overallCompliance = (availabilityCompliance + responseTimeCompliance + errorRateCompliance + throughputCompliance) / 4;
  const overallStatus = getComplianceStatus(overallCompliance);

  const slaMetricsData = [
    {
      id: 'availability',
      name: 'Availability',
      actual: slaMetrics.availability * 100,
      target: 99.9,
      unit: '%',
      compliance: availabilityCompliance,
      icon: '🔄',
      description: 'System uptime percentage'
    },
    {
      id: 'response_time',
      name: 'Response Time',
      actual: slaMetrics.responseTimeActual,
      target: slaMetrics.responseTimeTarget,
      unit: 'ms',
      compliance: responseTimeCompliance,
      icon: '⚡',
      description: 'P95 response time'
    },
    {
      id: 'error_rate',
      name: 'Error Rate',
      actual: slaMetrics.errorRateActual * 100,
      target: slaMetrics.errorRateTarget * 100,
      unit: '%',
      compliance: errorRateCompliance,
      icon: '⚠️',
      description: 'Percentage of failed requests'
    },
    {
      id: 'throughput',
      name: 'Throughput',
      actual: slaMetrics.throughputActual,
      target: slaMetrics.throughputTarget,
      unit: '/min',
      compliance: throughputCompliance,
      icon: '📊',
      description: 'Requests processed per minute'
    }
  ];

  const criticalViolations = slaMetrics.violations.filter(v => v.severity === 'critical').length;
  const warningViolations = slaMetrics.violations.filter(v => v.severity === 'warning').length;

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">SLA Compliance Status</h2>
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${overallStatus.bg} ${overallStatus.color} ${overallStatus.border} border`}>
            <div className={`w-2 h-2 rounded-full ${
              overallCompliance >= 95 ? 'bg-green-500' :
              overallCompliance >= 90 ? 'bg-blue-500' :
              overallCompliance >= 80 ? 'bg-yellow-500' : 'bg-red-500'
            }`} />
            <span>{formatPercentage(overallCompliance)} Compliant</span>
          </div>
        </div>

        {/* Violations Summary */}
        {slaMetrics.violations.length > 0 && (
          <div className="mt-3 flex items-center space-x-4 text-sm">
            {criticalViolations > 0 && (
              <div className="flex items-center space-x-1 text-red-600">
                <span className="w-2 h-2 bg-red-500 rounded-full" />
                <span>{criticalViolations} Critical</span>
              </div>
            )}
            {warningViolations > 0 && (
              <div className="flex items-center space-x-1 text-yellow-600">
                <span className="w-2 h-2 bg-yellow-500 rounded-full" />
                <span>{warningViolations} Warning</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-4">
        {/* SLA Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {slaMetricsData.map((metric) => {
            const status = getComplianceStatus(metric.compliance);
            const isSelected = selectedMetric === metric.id;

            return (
              <div
                key={metric.id}
                onClick={() => setSelectedMetric(isSelected ? null : metric.id)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  isSelected ? `${status.border} ${status.bg}` : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg">{metric.icon}</span>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${status.bg} ${status.color}`}>
                    {formatPercentage(metric.compliance)}
                  </div>
                </div>

                <h3 className="font-medium text-gray-900 mb-1">{metric.name}</h3>
                <p className="text-xs text-gray-600 mb-2">{metric.description}</p>

                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Actual:</span>
                    <span className="font-medium">
                      {metric.unit === 'ms' ? formatDuration(metric.actual) :
                       metric.actual.toFixed(1) + metric.unit}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Target:</span>
                    <span className="font-medium">
                      {metric.unit === 'ms' ? formatDuration(metric.target) :
                       metric.target.toFixed(1) + metric.unit}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-3">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        metric.compliance >= 95 ? 'bg-green-500' :
                        metric.compliance >= 90 ? 'bg-blue-500' :
                        metric.compliance >= 80 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(metric.compliance, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detailed Metric View */}
        {selectedMetric && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            {(() => {
              const metric = slaMetricsData.find(m => m.id === selectedMetric)!;
              const status = getComplianceStatus(metric.compliance);

              return (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                      <span>{metric.icon}</span>
                      <span>{metric.name} Details</span>
                    </h3>
                    <button
                      onClick={() => setSelectedMetric(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <h4 className="font-medium text-gray-700">Current Status</h4>
                      <div className={`p-3 rounded-lg ${status.bg} ${status.color}`}>
                        <div className="text-lg font-bold">
                          {formatPercentage(metric.compliance)} Compliant
                        </div>
                        <div className="text-sm opacity-80">{status.status}</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium text-gray-700">Performance</h4>
                      <div className="bg-white p-3 rounded-lg">
                        <div className="text-sm space-y-1">
                          <div className="flex justify-between">
                            <span>Current:</span>
                            <span className="font-medium">
                              {metric.unit === 'ms' ? formatDuration(metric.actual) :
                               metric.actual.toFixed(1) + metric.unit}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Target:</span>
                            <span className="font-medium">
                              {metric.unit === 'ms' ? formatDuration(metric.target) :
                               metric.target.toFixed(1) + metric.unit}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Variance:</span>
                            <span className={`font-medium ${
                              metric.id === 'error_rate'
                                ? (metric.actual <= metric.target ? 'text-green-600' : 'text-red-600')
                                : (metric.actual <= metric.target ? 'text-green-600' : 'text-red-600')
                            }`}>
                              {metric.id === 'error_rate'
                                ? (metric.actual <= metric.target ? '✓' : `+${(metric.actual - metric.target).toFixed(2)}${metric.unit}`)
                                : (metric.actual <= metric.target ? '✓' : `+${(metric.actual - metric.target).toFixed(1)}${metric.unit}`)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium text-gray-700">Recommendations</h4>
                      <div className="bg-white p-3 rounded-lg text-sm">
                        {metric.compliance >= 95 ? (
                          <div className="text-green-600">✅ Performing excellently</div>
                        ) : metric.compliance >= 90 ? (
                          <div className="text-blue-600">📈 Good performance, monitor closely</div>
                        ) : metric.compliance >= 80 ? (
                          <div className="text-yellow-600">⚠️ Improvement needed</div>
                        ) : (
                          <div className="text-red-600">🚨 Immediate attention required</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Recent Violations */}
        {slaMetrics.violations.length > 0 && (
          <div>
            <h3 className="text-md font-semibold text-gray-900 mb-3 flex items-center space-x-2">
              <span>Recent SLA Violations</span>
              <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs">
                {slaMetrics.violations.length}
              </span>
            </h3>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {slaMetrics.violations.slice(0, 10).map((violation, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border-l-4 ${
                    violation.severity === 'critical'
                      ? 'bg-red-50 border-red-400'
                      : 'bg-yellow-50 border-yellow-400'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          violation.severity === 'critical'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {violation.severity.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-600">
                          {violation.type.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-900">{violation.message}</p>
                    </div>
                    <div className="text-xs text-gray-500 ml-4">
                      {new Date(violation.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {slaMetrics.violations.length > 10 && (
              <div className="text-center mt-3">
                <button className="text-sm text-blue-600 hover:text-blue-800">
                  View all {slaMetrics.violations.length} violations
                </button>
              </div>
            )}
          </div>
        )}

        {/* No Violations State */}
        {slaMetrics.violations.length === 0 && (
          <div className="text-center py-6">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900">No SLA Violations</h3>
            <p className="text-gray-600">All metrics are within acceptable limits</p>
          </div>
        )}
      </div>
    </div>
  );
};