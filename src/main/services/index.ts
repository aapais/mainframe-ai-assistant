/**
 * Services Index
 * Main entry point for all service implementations
 */

export * from './types';
export * from './ServiceManager';
export * from './DatabaseService';
export * from './AIService';
export * from './AIAuthorizationService';
export * from './WindowService';
export * from './IPCService';
export * from './MonitoringService';

// KB Listing and Advanced Query Services
export * from './KBListingService';
export * from './CacheService';
export * from './QueryBuilder';

// API Layer
export * from '../api/KBListingAPI';

// Re-export commonly used items
export {
  getServiceManager,
  resetServiceManager,
  DEFAULT_SERVICE_MANAGER_CONFIG,
  DefaultServiceLogger,
  DefaultServiceMetrics
} from './ServiceManager';

// KB Listing specific exports
export type {
  ListingOptions,
  ListingResponse,
  PaginationInfo,
  SortingInfo,
  FilteringInfo,
  AggregationData,
  FilterCriteria,
  SavedSearch,
  SavedSearchCreate
} from './KBListingService';

export type {
  CacheConfig,
  CacheEntry,
  CacheStats,
  CachePriority,
  PreloadStrategy
} from './CacheService';

// Error handling
export { APIError, APIErrorCodes } from '../api/KBListingAPI';

// Utility classes
export { CacheKeyGenerator } from './CacheService';