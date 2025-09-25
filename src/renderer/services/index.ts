/**
 * Service Layer Index - Unified Service Architecture
 * Exports all services with backward compatibility for existing components
 */

// ===========================
// UNIFIED SERVICE (Primary)
// ===========================

// Import the unified service as the primary export
import {
  unifiedService,
  knowledgeBaseService,
  incidentService,
  UnifiedEntry,
  CreateUnifiedEntry,
  UpdateUnifiedEntry,
  UnifiedEntryWithAccessors,
  EntryType,
  UnifiedStatistics,
} from './UnifiedService';

// Export unified service as default
export { unifiedService as default };
export { unifiedService };

// Export unified types
export type {
  UnifiedEntry,
  CreateUnifiedEntry,
  UpdateUnifiedEntry,
  UnifiedEntryWithAccessors,
  EntryType,
  UnifiedStatistics,
};

// ===========================
// BACKWARD COMPATIBLE EXPORTS
// ===========================

// Knowledge Base Service (backward compatible)
export { knowledgeBaseService };
export { knowledgeBaseService as KnowledgeBaseService };

// Incident Service (backward compatible)
export { incidentService };
export { incidentService as IncidentService };

// Legacy default exports for backward compatibility
export { knowledgeBaseService as default } from './KnowledgeBaseService';

// ===========================
// OTHER SERVICES
// ===========================

// AI Service
export { default as aiService } from './aiService';
export type { AIServiceConfig, AIServiceResponse } from './aiService';

// Search Service
export { default as searchService } from './searchService';
export type { SearchServiceOptions, SearchServiceResult } from './searchService';

// Hybrid Search Service
export { default as hybridSearchService } from './hybridSearchService';
export type { HybridSearchOptions, HybridSearchResult } from './hybridSearchService';

// Optimized IPC Service
export { default as optimizedIPCService } from './OptimizedIPCService';
export type { IPCServiceConfig, IPCServiceResponse } from './OptimizedIPCService';

// Settings Performance Cache
export { default as settingsPerformanceCache } from './SettingsPerformanceCache';
export type { CacheConfig, CacheStats } from './SettingsPerformanceCache';

// Search Analytics
export { default as searchAnalytics } from './SearchAnalytics';
export type { SearchAnalyticsData, SearchAnalyticsConfig } from './SearchAnalytics';

// ===========================
// SERVICE FACTORY PATTERN
// ===========================

/**
 * Service factory for creating service instances with proper configuration
 */
export class ServiceFactory {
  private static instances = new Map<string, any>();

  /**
   * Get or create a service instance
   */
  static getService<T>(serviceName: string, config?: any): T {
    if (!this.instances.has(serviceName)) {
      let service: any;

      switch (serviceName) {
        case 'unified':
          service = unifiedService;
          break;
        case 'knowledgeBase':
        case 'kb':
          service = knowledgeBaseService;
          break;
        case 'incident':
          service = incidentService;
          break;
        case 'ai':
          service = require('./aiService').default;
          break;
        case 'search':
          service = require('./searchService').default;
          break;
        case 'hybridSearch':
          service = require('./hybridSearchService').default;
          break;
        case 'ipc':
          service = require('./OptimizedIPCService').default;
          break;
        case 'cache':
          service = require('./SettingsPerformanceCache').default;
          break;
        case 'analytics':
          service = require('./SearchAnalytics').default;
          break;
        default:
          throw new Error(`Unknown service: ${serviceName}`);
      }

      this.instances.set(serviceName, service);
    }

    return this.instances.get(serviceName);
  }

  /**
   * Clear service instances (useful for testing)
   */
  static clearInstances(): void {
    this.instances.clear();
  }

  /**
   * Check if service is available
   */
  static hasService(serviceName: string): boolean {
    return this.instances.has(serviceName);
  }
}

// ===========================
// CONVENIENCE EXPORTS
// ===========================

/**
 * Convenience function to get the unified service
 */
export const getUnifiedService = () => unifiedService;

/**
 * Convenience function to get knowledge base service (backward compatible)
 */
export const getKnowledgeBaseService = () => knowledgeBaseService;

/**
 * Convenience function to get incident service (backward compatible)
 */
export const getIncidentService = () => incidentService;

/**
 * Convenience function to get any service by name
 */
export const getService = <T>(serviceName: string, config?: any): T => {
  return ServiceFactory.getService<T>(serviceName, config);
};

// ===========================
// SERVICE HEALTH CHECK
// ===========================

/**
 * Health check for all services
 */
export interface ServiceHealthStatus {
  serviceName: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  error?: string;
  lastCheck: Date;
}

/**
 * Check health of all services
 */
export const checkServiceHealth = async (): Promise<ServiceHealthStatus[]> => {
  const services = ['unified', 'knowledgeBase', 'incident', 'ai', 'search', 'hybridSearch'];

  const healthChecks = services.map(async serviceName => {
    const startTime = Date.now();
    try {
      const service = ServiceFactory.getService(serviceName);

      // Basic health check - try to call a simple method
      if (service && typeof service.getStatistics === 'function') {
        await service.getStatistics();
      }

      return {
        serviceName,
        status: 'healthy' as const,
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
      };
    } catch (error) {
      return {
        serviceName,
        status: 'unhealthy' as const,
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
      };
    }
  });

  return Promise.all(healthChecks);
};

// ===========================
// MIGRATION HELPERS
// ===========================

/**
 * Migration helper for components using the old KB service
 */
export const migrateFromKBService = (component: any) => {
  console.warn('Component is using deprecated KB service. Consider migrating to unified service.');
  return knowledgeBaseService;
};

/**
 * Migration helper for components using the old incident service
 */
export const migrateFromIncidentService = (component: any) => {
  console.warn(
    'Component is using deprecated incident service. Consider migrating to unified service.'
  );
  return incidentService;
};

// ===========================
// TYPE GUARDS AND UTILITIES
// ===========================

/**
 * Type guard to check if an entry is a knowledge base entry
 */
export const isKnowledgeBaseEntry = (
  entry: UnifiedEntry
): entry is UnifiedEntry & { entry_type: 'knowledge_base' } => {
  return entry.entry_type === 'knowledge_base';
};

/**
 * Type guard to check if an entry is an incident entry
 */
export const isIncidentEntry = (
  entry: UnifiedEntry
): entry is UnifiedEntry & { entry_type: 'incident' } => {
  return entry.entry_type === 'incident';
};

/**
 * Utility to convert unified entry to KB entry
 */
export const toKBEntry = (entry: UnifiedEntry): any => {
  if (!isKnowledgeBaseEntry(entry)) {
    throw new Error('Entry is not a knowledge base entry');
  }

  const {
    entry_type,
    status,
    priority,
    assigned_to,
    escalation_level,
    resolution_time,
    sla_deadline,
    last_status_change,
    affected_systems,
    business_impact,
    customer_impact,
    reporter,
    resolver,
    incident_number,
    external_ticket_id,
    ...kbEntry
  } = entry;

  return kbEntry;
};

/**
 * Utility to convert unified entry to incident entry
 */
export const toIncidentEntry = (entry: UnifiedEntry): any => {
  if (!isIncidentEntry(entry)) {
    throw new Error('Entry is not an incident entry');
  }

  return entry;
};

// ===========================
// EXPORTS FOR COMPATIBILITY
// ===========================

// Ensure existing imports continue to work
export * from './aiService';
export * from './searchService';
export * from './hybridSearchService';
export * from './OptimizedIPCService';
export * from './SettingsPerformanceCache';
export * from './SearchAnalytics';

// Legacy exports - these will be deprecated in future versions
export { knowledgeBaseService as legacyKBService };
export { incidentService as legacyIncidentService };
