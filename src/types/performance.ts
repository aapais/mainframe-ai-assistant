/**
 * @deprecated Use types from '@/types/shared/performance' instead
 * This file is maintained for backward compatibility only.
 */

// Re-export from the centralized location
export type {
  BasePerformanceMetric as PerformanceMetric,
  PerformanceAlert,
  PerformanceBudget,
  PerformanceData,
  TrendData,
  RegressionData,
  TeamNotification,
  DashboardConfig,
  ChartConfig,
  PerformanceValidationResult,
  WindowPerformanceSummary,
  PerformanceReport,
} from './shared/performance';
