/**
 * Service Manager Types for Electron Main Process
 * Defines interfaces and types for service lifecycle management
 */

import { EventEmitter } from 'events';

// ========================
// Core Service Interfaces
// ========================

export interface Service {
  readonly name: string;
  readonly version: string;
  readonly dependencies: string[];
  readonly priority: number; // Lower numbers = higher priority
  readonly critical: boolean; // If true, service failure causes app shutdown
  readonly healthCheck?: () => Promise<ServiceHealth>;
  
  initialize(context: ServiceContext): Promise<void>;
  shutdown(): Promise<void>;
  getStatus(): ServiceStatus;
}

export interface ServiceHealth {
  healthy: boolean;
  responseTime?: number;
  error?: string;
  details?: Record<string, any>;
  lastCheck: Date;
}

export interface ServiceStatus {
  status: 'initializing' | 'running' | 'stopped' | 'error' | 'degraded';
  startTime?: Date;
  lastError?: Error;
  restartCount: number;
  uptime: number;
  metadata?: Record<string, any>;
}

export interface ServiceContext {
  app: Electron.App;
  dataPath: string;
  isDevelopment: boolean;
  config: ServiceManagerConfig;
  logger: ServiceLogger;
  metrics: ServiceMetrics;
  getService<T extends Service>(name: string): T | null;
}

export interface ServiceLogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, error?: Error, ...args: any[]): void;
}

export interface ServiceMetrics {
  increment(metric: string, tags?: Record<string, string>): void;
  gauge(metric: string, value: number, tags?: Record<string, string>): void;
  histogram(metric: string, value: number, tags?: Record<string, string>): void;
  timer(metric: string): () => void;
}

// ========================
// Service Manager Configuration
// ========================

export interface ServiceManagerConfig {
  gracefulShutdownTimeout: number;
  healthCheckInterval: number;
  maxRestartAttempts: number;
  restartDelay: number;
  enableMetrics: boolean;
  enableHealthChecks: boolean;
  fallbackServices: Record<string, string[]>;
  serviceTimeouts: Record<string, number>;
  logging: LoggingConfig;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  console: boolean;
  file?: {
    enabled: boolean;
    path: string;
    maxSize: number;
    maxFiles: number;
  };
}

// ========================
// Service Manager Events
// ========================

export interface ServiceManagerEvents {
  // Service lifecycle events
  'service:initializing': (serviceName: string) => void;
  'service:initialized': (serviceName: string, duration: number) => void;
  'service:failed': (serviceName: string, error: Error) => void;
  'service:restarted': (serviceName: string, attempt: number) => void;
  'service:shutdown': (serviceName: string) => void;
  
  // System events
  'initialization:started': () => void;
  'initialization:completed': (duration: number, services: string[]) => void;
  'initialization:failed': (error: Error, failedServices: string[]) => void;
  'shutdown:started': () => void;
  'shutdown:completed': (duration: number) => void;
  'health:degraded': (unhealthyServices: string[]) => void;
  'health:recovered': (recoveredServices: string[]) => void;
  
  // Error events
  'error:critical': (serviceName: string, error: Error) => void;
  'error:recoverable': (serviceName: string, error: Error) => void;
}

// ========================
// Initialization Options
// ========================

export interface InitializationOptions {
  parallelInitialization: boolean;
  failFast: boolean;
  enableRetries: boolean;
  retryAttempts: number;
  retryDelay: number;
  progressCallback?: (serviceName: string, progress: number) => void;
}

export interface InitializationResult {
  success: boolean;
  duration: number;
  initialized: string[];
  failed: Array<{
    name: string;
    error: Error;
  }>;
  fallbacks: Array<{
    original: string;
    fallback: string;
  }>;
}

// ========================
// Fallback Service Interface
// ========================

export interface FallbackService extends Service {
  readonly fallbackFor: string;
  isActive(): boolean;
  activate(): Promise<void>;
  deactivate(): Promise<void>;
}

// ========================
// Service Registry Interface
// ========================

export interface ServiceRegistry {
  register(service: Service): void;
  unregister(name: string): boolean;
  get<T extends Service>(name: string): T | null;
  getAll(): Service[];
  getByDependency(dependency: string): Service[];
  getDependencyOrder(): string[];
  validateDependencies(): DependencyValidationResult;
}

export interface DependencyValidationResult {
  valid: boolean;
  circularDependencies: string[][];
  missingDependencies: Array<{
    service: string;
    missing: string[];
  }>;
}

// ========================
// Service Proxy Interface
// ========================

export interface ServiceProxy<T extends Service> {
  readonly service: T;
  readonly isHealthy: boolean;
  readonly lastHealthCheck: Date | null;
  
  call<R>(method: keyof T, ...args: any[]): Promise<R>;
  getHealth(): Promise<ServiceHealth>;
  restart(): Promise<void>;
}

// ========================
// Default Configuration
// ========================

export const DEFAULT_SERVICE_MANAGER_CONFIG: ServiceManagerConfig = {
  gracefulShutdownTimeout: 30000, // 30 seconds
  healthCheckInterval: 60000, // 1 minute
  maxRestartAttempts: 3,
  restartDelay: 5000, // 5 seconds
  enableMetrics: true,
  enableHealthChecks: true,
  fallbackServices: {},
  serviceTimeouts: {},
  logging: {
    level: 'info',
    console: true,
    file: {
      enabled: true,
      path: './logs/service-manager.log',
      maxSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    }
  }
};