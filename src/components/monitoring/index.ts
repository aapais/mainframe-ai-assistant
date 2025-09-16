/**
 * Monitoring Components Index
 * Exports all monitoring-related components and services
 */

// Dashboard Components
export { PerformanceDashboard } from './PerformanceDashboard';
export { MetricsChart } from './MetricsChart';
export { QueryPerformancePanel } from './QueryPerformancePanel';
export { CacheMonitorPanel } from './CacheMonitorPanel';
export { SLAStatusPanel } from './SLAStatusPanel';
export { AlertsPanel } from './AlertsPanel';

// Services
export {
  MetricsCollector,
  metricsCollector,
  type PerformanceMetric,
  type PercentileMetrics,
  type CacheMetrics,
  type QueryMetrics,
  type SLAMetrics
} from '../../services/metrics/MetricsCollector';

export {
  PerformanceReportGenerator,
  type PerformanceReport,
  type ExecutiveSummary,
  type PerformanceAnalysis,
  type AvailabilityReport,
  type CacheReport,
  type QueryReport,
  type SLAReport,
  type TrendAnalysis,
  type Recommendation
} from '../../services/metrics/PerformanceReportGenerator';

export {
  WebSocketMonitoring,
  webSocketMonitoring,
  type WebSocketClient,
  type MonitoringMessage
} from '../../services/metrics/WebSocketMonitoring';

export {
  PerformanceBenchmark,
  performanceBenchmark,
  type BenchmarkConfig,
  type BenchmarkResult,
  type BenchmarkTestResult,
  type BenchmarkOperation
} from '../../services/metrics/PerformanceBenchmark';

// API
export { MonitoringAPI } from '../../api/monitoring/MonitoringAPI';