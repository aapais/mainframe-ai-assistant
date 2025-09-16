/**
 * Performance Module - Exports for application performance monitoring
 */

export { PerformanceMonitor } from './PerformanceMonitor';

// Re-export types for convenience
export type {
  PerformanceMetrics,
  StartupMetrics,
  MemoryMetrics,
  CpuMetrics,
  DiskMetrics,
  NetworkMetrics,
  PerformanceAlert,
  PerformanceThresholds
} from './PerformanceMonitor';