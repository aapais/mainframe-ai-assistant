/**
 * Service Provider Component
 * Provides service instances to the React application with proper lifecycle management
 */

import React, { createContext, useContext, useEffect, ReactNode, useRef } from 'react';
import { KBService } from './api/KBService';
import { SearchService } from './api/SearchService';
import { BaseService } from './api/BaseService';

// Service instances interface
export interface Services {
  kbService: KBService;
  searchService: SearchService;
}

// Service context
const ServiceContext = createContext<Services | null>(null);

// Service provider props
export interface ServiceProviderProps {
  children: ReactNode;
}

export const ServiceProvider: React.FC<ServiceProviderProps> = ({ children }) => {
  const servicesRef = useRef<Services | null>(null);

  // Initialize services once
  if (!servicesRef.current) {
    servicesRef.current = {
      kbService: new KBService(),
      searchService: new SearchService(),
    };

    // Setup service event listeners for debugging/monitoring
    if (process.env.NODE_ENV === 'development') {
      const { kbService, searchService } = servicesRef.current;

      // KB Service events
      kbService.on('operation-success', event => {
        console.log('✅ KB Service Success:', event);
      });

      kbService.on('operation-error', event => {
        console.warn('❌ KB Service Error:', event);
      });

      kbService.on('cache-hit', event => {
        console.log('💾 KB Cache Hit:', event);
      });

      // Search Service events
      searchService.on('search-completed', event => {
        console.log('🔍 Search Completed:', event);
      });

      searchService.on('ai-search-failed', event => {
        console.warn('🤖❌ AI Search Failed:', event);
      });

      searchService.on('cache-hit', event => {
        console.log('💾 Search Cache Hit:', event);
      });
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (servicesRef.current) {
        Object.values(servicesRef.current).forEach(service => {
          if (service instanceof BaseService) {
            service.cleanup();
          }
        });
      }
    };
  }, []);

  // Preload data on mount
  useEffect(() => {
    if (servicesRef.current) {
      const { kbService, searchService } = servicesRef.current;

      // Preload frequently used data
      Promise.all([
        kbService.preloadData(),
        // Search service doesn't need preloading as history is loaded automatically
      ]).catch(error => {
        console.warn('Service preload failed:', error);
      });

      // Health check all services
      Promise.all([kbService.healthCheck(), searchService.healthCheck()])
        .then(results => {
          console.log('Service Health Check:', results);
        })
        .catch(error => {
          console.error('Service health check failed:', error);
        });
    }
  }, []);

  return <ServiceContext.Provider value={servicesRef.current}>{children}</ServiceContext.Provider>;
};

// Hook to access services
export const useServices = (): Services => {
  const context = useContext(ServiceContext);
  if (!context) {
    throw new Error('useServices must be used within a ServiceProvider');
  }
  return context;
};

// Individual service hooks for convenience
export const useKBService = () => {
  const { kbService } = useServices();
  return kbService;
};

export const useSearchService = () => {
  const { searchService } = useServices();
  return searchService;
};

// Service health monitoring hook
export const useServiceHealth = () => {
  const { kbService, searchService } = useServices();
  const [healthStatus, setHealthStatus] = React.useState<{
    kb: any;
    search: any;
    overall: 'healthy' | 'degraded' | 'unhealthy';
  }>({
    kb: null,
    search: null,
    overall: 'unhealthy',
  });

  const checkHealth = React.useCallback(async () => {
    try {
      const [kbHealth, searchHealth] = await Promise.all([
        kbService.healthCheck(),
        searchService.healthCheck(),
      ]);

      const kbHealthy = kbHealth.success && kbHealth.data?.healthy;
      const searchHealthy = searchHealth.success && searchHealth.data?.healthy;

      let overall: 'healthy' | 'degraded' | 'unhealthy';
      if (kbHealthy && searchHealthy) {
        overall = 'healthy';
      } else if (kbHealthy || searchHealthy) {
        overall = 'degraded';
      } else {
        overall = 'unhealthy';
      }

      setHealthStatus({
        kb: kbHealth.data,
        search: searchHealth.data,
        overall,
      });
    } catch (error) {
      console.error('Health check failed:', error);
      setHealthStatus(prev => ({ ...prev, overall: 'unhealthy' }));
    }
  }, [kbService, searchService]);

  React.useEffect(() => {
    // Initial health check
    checkHealth();

    // Periodic health checks
    const interval = setInterval(checkHealth, 60000); // Every minute

    return () => clearInterval(interval);
  }, [checkHealth]);

  return { healthStatus, checkHealth };
};

export default ServiceProvider;
