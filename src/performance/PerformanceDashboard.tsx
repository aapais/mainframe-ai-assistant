/**
 * Real-time Performance Dashboard
 * Displays all Electron performance metrics in a unified interface
 */

import React, { useState, useEffect, useRef } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface PerformanceMetrics {
  renderTime: number;
  frameRate: number;
  renderTargetMet: boolean;
  searchResponseTime: number;
  searchTargetMet: boolean;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    growthRate: number;
  };
  memoryTargetMet: boolean;
  ipcLatency: number;
  ipcTargetMet: boolean;
  windowOperationTime: number;
  windowTargetMet: boolean;
  timestamp: number;
  cpuUsage: NodeJS.CpuUsage;
}

interface AlertData {
  type: string;
  message: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export function PerformanceDashboard() {
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<PerformanceMetrics | null>(null);
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'render' | 'search' | 'memory' | 'ipc' | 'window'>('overview');

  const metricsRef = useRef<PerformanceMetrics[]>([]);
  const maxDataPoints = 50;

  useEffect(() => {
    if (isMonitoring) {
      startMonitoring();
    } else {
      stopMonitoring();
    }

    return () => stopMonitoring();
  }, [isMonitoring]);

  const startMonitoring = () => {
    const interval = setInterval(async () => {
      try {
        // Get metrics from main process
        const newMetrics = await window.electronAPI?.getPerformanceMetrics();
        if (newMetrics) {
          setCurrentMetrics(newMetrics);

          const updatedMetrics = [...metricsRef.current, newMetrics].slice(-maxDataPoints);
          metricsRef.current = updatedMetrics;
          setMetrics(updatedMetrics);

          // Check for alerts
          checkForAlerts(newMetrics);
        }
      } catch (error) {
        console.error('Failed to fetch performance metrics:', error);
      }
    }, 1000);

    return () => clearInterval(interval);
  };

  const stopMonitoring = () => {
    // Monitoring will be stopped by cleanup in useEffect
  };

  const checkForAlerts = (metrics: PerformanceMetrics) => {
    const newAlerts: AlertData[] = [];

    if (!metrics.renderTargetMet) {
      newAlerts.push({
        type: 'render-performance',
        message: `Render time ${metrics.renderTime.toFixed(2)}ms exceeds 16ms target`,
        timestamp: Date.now(),
        severity: metrics.renderTime > 32 ? 'high' : 'medium'
      });
    }

    if (!metrics.searchTargetMet) {
      newAlerts.push({
        type: 'search-performance',
        message: `Search response ${metrics.searchResponseTime.toFixed(2)}ms exceeds 1000ms target`,
        timestamp: Date.now(),
        severity: metrics.searchResponseTime > 2000 ? 'high' : 'medium'
      });
    }

    if (!metrics.memoryTargetMet) {
      newAlerts.push({
        type: 'memory-growth',
        message: `Memory growth ${metrics.memoryUsage.growthRate.toFixed(2)}MB/h exceeds 10MB/h target`,
        timestamp: Date.now(),
        severity: metrics.memoryUsage.growthRate > 50 ? 'critical' : 'high'
      });
    }

    if (!metrics.ipcTargetMet) {
      newAlerts.push({
        type: 'ipc-latency',
        message: `IPC latency ${metrics.ipcLatency.toFixed(2)}ms exceeds 5ms target`,
        timestamp: Date.now(),
        severity: metrics.ipcLatency > 20 ? 'high' : 'medium'
      });
    }

    if (!metrics.windowTargetMet) {
      newAlerts.push({
        type: 'window-operation',
        message: `Window operation ${metrics.windowOperationTime.toFixed(2)}ms exceeds 100ms target`,
        timestamp: Date.now(),
        severity: metrics.windowOperationTime > 500 ? 'high' : 'medium'
      });
    }

    if (newAlerts.length > 0) {
      setAlerts(prev => [...prev, ...newAlerts].slice(-20)); // Keep last 20 alerts
    }
  };

  const getStatusColor = (isTargetMet: boolean): string => {
    return isTargetMet ? 'text-green-600' : 'text-red-600';
  };

  const formatMemoryMB = (bytes: number): string => {
    return (bytes / 1024 / 1024).toFixed(1);
  };

  const renderOverviewTab = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Render Performance */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Render Performance</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Render Time:</span>
            <span className={getStatusColor(currentMetrics?.renderTargetMet || false)}>
              {currentMetrics?.renderTime.toFixed(2) || 0}ms
            </span>
          </div>
          <div className="flex justify-between">
            <span>Frame Rate:</span>
            <span>{currentMetrics?.frameRate.toFixed(1) || 0} FPS</span>
          </div>
          <div className="flex justify-between">
            <span>Target:</span>
            <span className={getStatusColor(currentMetrics?.renderTargetMet || false)}>
              {currentMetrics?.renderTargetMet ? '✅ Met' : '❌ Failed'}
            </span>
          </div>
        </div>
      </div>

      {/* Search Performance */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Search Performance</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Response Time:</span>
            <span className={getStatusColor(currentMetrics?.searchTargetMet || false)}>
              {currentMetrics?.searchResponseTime.toFixed(2) || 0}ms
            </span>
          </div>
          <div className="flex justify-between">
            <span>Target:</span>
            <span className={getStatusColor(currentMetrics?.searchTargetMet || false)}>
              {currentMetrics?.searchTargetMet ? '✅ Met' : '❌ Failed'}
            </span>
          </div>
        </div>
      </div>

      {/* Memory Usage */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Memory Usage</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Heap Used:</span>
            <span>{formatMemoryMB(currentMetrics?.memoryUsage.heapUsed || 0)}MB</span>
          </div>
          <div className="flex justify-between">
            <span>Growth Rate:</span>
            <span className={getStatusColor(currentMetrics?.memoryTargetMet || false)}>
              {currentMetrics?.memoryUsage.growthRate.toFixed(2) || 0}MB/h
            </span>
          </div>
          <div className="flex justify-between">
            <span>Target:</span>
            <span className={getStatusColor(currentMetrics?.memoryTargetMet || false)}>
              {currentMetrics?.memoryTargetMet ? '✅ Met' : '❌ Failed'}
            </span>
          </div>
        </div>
      </div>

      {/* IPC Performance */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">IPC Performance</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Latency:</span>
            <span className={getStatusColor(currentMetrics?.ipcTargetMet || false)}>
              {currentMetrics?.ipcLatency.toFixed(2) || 0}ms
            </span>
          </div>
          <div className="flex justify-between">
            <span>Target:</span>
            <span className={getStatusColor(currentMetrics?.ipcTargetMet || false)}>
              {currentMetrics?.ipcTargetMet ? '✅ Met' : '❌ Failed'}
            </span>
          </div>
        </div>
      </div>

      {/* Window Operations */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Window Operations</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Operation Time:</span>
            <span className={getStatusColor(currentMetrics?.windowTargetMet || false)}>
              {currentMetrics?.windowOperationTime.toFixed(2) || 0}ms
            </span>
          </div>
          <div className="flex justify-between">
            <span>Target:</span>
            <span className={getStatusColor(currentMetrics?.windowTargetMet || false)}>
              {currentMetrics?.windowTargetMet ? '✅ Met' : '❌ Failed'}
            </span>
          </div>
        </div>
      </div>

      {/* Recent Alerts */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Alerts</h3>
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {alerts.slice(-5).map((alert, index) => (
            <div key={index} className={`text-sm p-2 rounded ${
              alert.severity === 'critical' ? 'bg-red-100 text-red-800' :
              alert.severity === 'high' ? 'bg-orange-100 text-orange-800' :
              alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              <div className="font-medium">{alert.type}</div>
              <div className="text-xs">{alert.message}</div>
            </div>
          ))}
          {alerts.length === 0 && (
            <div className="text-gray-500 text-sm">No alerts</div>
          )}
        </div>
      </div>
    </div>
  );

  const renderChartTab = (dataKey: keyof PerformanceMetrics, title: string, target?: number) => {
    const chartData = {
      labels: metrics.map((_, index) => `${index + 1}`),
      datasets: [
        {
          label: title,
          data: metrics.map(m => {
            const value = m[dataKey];
            return typeof value === 'number' ? value : 0;
          }),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4
        },
        ...(target ? [{
          label: 'Target',
          data: new Array(metrics.length).fill(target),
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderDash: [5, 5],
          fill: false
        }] : [])
      ]
    };

    const chartOptions = {
      responsive: true,
      plugins: {
        legend: {
          position: 'top' as const
        },
        title: {
          display: true,
          text: title
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    };

    return (
      <div className="bg-white rounded-lg shadow p-6">
        <Line data={chartData} options={chartOptions} />
      </div>
    );
  };

  const renderTargetMetChart = () => {
    const targetData = {
      labels: ['Render', 'Search', 'Memory', 'IPC', 'Window'],
      datasets: [
        {
          label: 'Target Met',
          data: [
            currentMetrics?.renderTargetMet ? 1 : 0,
            currentMetrics?.searchTargetMet ? 1 : 0,
            currentMetrics?.memoryTargetMet ? 1 : 0,
            currentMetrics?.ipcTargetMet ? 1 : 0,
            currentMetrics?.windowTargetMet ? 1 : 0
          ],
          backgroundColor: [
            currentMetrics?.renderTargetMet ? '#10B981' : '#EF4444',
            currentMetrics?.searchTargetMet ? '#10B981' : '#EF4444',
            currentMetrics?.memoryTargetMet ? '#10B981' : '#EF4444',
            currentMetrics?.ipcTargetMet ? '#10B981' : '#EF4444',
            currentMetrics?.windowTargetMet ? '#10B981' : '#EF4444'
          ]
        }
      ]
    };

    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Performance Targets</h3>
        <Doughnut data={targetData} />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Performance Dashboard</h1>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsMonitoring(!isMonitoring)}
                className={`px-4 py-2 rounded-md font-medium ${
                  isMonitoring
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              {[
                { key: 'overview', label: 'Overview' },
                { key: 'render', label: 'Render' },
                { key: 'search', label: 'Search' },
                { key: 'memory', label: 'Memory' },
                { key: 'ipc', label: 'IPC' },
                { key: 'window', label: 'Window' }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setSelectedTab(tab.key as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    selectedTab === tab.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {selectedTab === 'overview' && renderOverviewTab()}
          {selectedTab === 'render' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {renderChartTab('renderTime', 'Render Time (ms)', 16)}
              {renderChartTab('frameRate', 'Frame Rate (FPS)')}
            </div>
          )}
          {selectedTab === 'search' && renderChartTab('searchResponseTime', 'Search Response Time (ms)', 1000)}
          {selectedTab === 'memory' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <Line
                  data={{
                    labels: metrics.map((_, index) => `${index + 1}`),
                    datasets: [
                      {
                        label: 'Heap Used (MB)',
                        data: metrics.map(m => formatMemoryMB(m.memoryUsage?.heapUsed || 0)),
                        borderColor: 'rgb(59, 130, 246)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        fill: true
                      },
                      {
                        label: 'Heap Total (MB)',
                        data: metrics.map(m => formatMemoryMB(m.memoryUsage?.heapTotal || 0)),
                        borderColor: 'rgb(16, 185, 129)',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        fill: false
                      }
                    ]
                  }}
                  options={{
                    responsive: true,
                    plugins: {
                      title: { display: true, text: 'Memory Usage' }
                    }
                  }}
                />
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <Line
                  data={{
                    labels: metrics.map((_, index) => `${index + 1}`),
                    datasets: [
                      {
                        label: 'Growth Rate (MB/h)',
                        data: metrics.map(m => m.memoryUsage?.growthRate || 0),
                        borderColor: 'rgb(239, 68, 68)',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        fill: true
                      },
                      {
                        label: 'Target (10 MB/h)',
                        data: new Array(metrics.length).fill(10),
                        borderColor: 'rgb(107, 114, 128)',
                        borderDash: [5, 5],
                        fill: false
                      }
                    ]
                  }}
                  options={{
                    responsive: true,
                    plugins: {
                      title: { display: true, text: 'Memory Growth Rate' }
                    }
                  }}
                />
              </div>
            </div>
          )}
          {selectedTab === 'ipc' && renderChartTab('ipcLatency', 'IPC Latency (ms)', 5)}
          {selectedTab === 'window' && renderChartTab('windowOperationTime', 'Window Operation Time (ms)', 100)}
        </div>

        {/* Target Overview */}
        {selectedTab === 'overview' && (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {renderTargetMetChart()}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Performance Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Total Alerts:</span>
                  <span className={alerts.length > 0 ? 'text-red-600' : 'text-green-600'}>
                    {alerts.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Monitoring Status:</span>
                  <span className={isMonitoring ? 'text-green-600' : 'text-gray-600'}>
                    {isMonitoring ? '✅ Active' : '⏸️ Paused'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Data Points:</span>
                  <span>{metrics.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Last Update:</span>
                  <span className="text-sm text-gray-600">
                    {currentMetrics ? new Date(currentMetrics.timestamp).toLocaleTimeString() : 'Never'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PerformanceDashboard;