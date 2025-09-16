import { Request, Response } from 'express';
import { CacheService } from '../../services/cache/CacheService';
import { CacheMiddleware } from '../../backend/middleware/CacheMiddleware';
import { CachedSearchService } from '../../services/search/CachedSearchService';
import { CacheWarmer } from '../../services/cache/CacheWarmer';
import { ServiceError } from '../../utils/errors';

interface CacheHealthCheck {
  status: 'healthy' | 'degraded' | 'critical';
  timestamp: Date;
  services: {
    searchCache: {
      status: string;
      hitRate: number;
      responseTime: number;
    };
    httpCache: {
      status: string;
      hitRate: number;
      entries: number;
    };
    cacheWarmer: {
      status: string;
      lastRun: Date;
      successRate: number;
    };
  };
  performance: {
    overallHitRate: number;
    avgResponseTime: number;
    memoryUsage: number;
    throughput: number;
  };
  recommendations: string[];
  issues: string[];
}

interface CacheControllerDependencies {
  cacheService: CacheService;
  cacheMiddleware: CacheMiddleware;
  cachedSearchService: CachedSearchService;
  cacheWarmer: CacheWarmer;
}

class CacheController {
  private dependencies: CacheControllerDependencies;

  constructor(dependencies: CacheControllerDependencies) {
    this.dependencies = dependencies;
  }

  /**
   * GET /api/cache/health - Get comprehensive cache health status
   */
  async getHealth(req: Request, res: Response): Promise<void> {
    try {
      const healthCheck = await this.performHealthCheck();

      const statusCode = healthCheck.status === 'healthy' ? 200 :
                        healthCheck.status === 'degraded' ? 206 : 503;

      res.status(statusCode).json({
        success: true,
        data: healthCheck,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.handleError(res, error, 'Failed to get cache health');
    }
  }

  /**
   * GET /api/cache/metrics - Get detailed cache metrics
   */
  async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      const searchMetrics = this.dependencies.cachedSearchService.getMetrics();
      const httpMetrics = this.dependencies.cacheMiddleware.getMetrics();
      const cacheStats = this.dependencies.cacheService.stats();
      const warmingStats = this.dependencies.cacheWarmer.getWarmingStats();

      const metrics = {
        search: searchMetrics,
        http: httpMetrics,
        storage: cacheStats,
        warming: warmingStats,
        aggregated: {
          totalRequests: searchMetrics.operations.totalQueries + httpMetrics.requests.total,
          overallHitRate: this.calculateOverallHitRate(searchMetrics, httpMetrics),
          avgResponseTime: this.calculateAvgResponseTime(searchMetrics, httpMetrics),
          totalMemoryUsage: searchMetrics.storage.totalSize + (cacheStats.memoryUsage || 0),
          cacheSizeDistribution: {
            searchCache: searchMetrics.storage.totalSize,
            httpCache: httpMetrics.storage.totalSize,
            generalCache: cacheStats.memoryUsage || 0
          }
        }
      };

      res.json({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.handleError(res, error, 'Failed to get cache metrics');
    }
  }

  // =========================
  // Private Helper Methods
  // =========================

  private async performHealthCheck(): Promise<CacheHealthCheck> {
    try {
      const searchHealth = this.dependencies.cachedSearchService.getHealthStatus();
      const searchMetrics = this.dependencies.cachedSearchService.getMetrics();
      const httpMetrics = this.dependencies.cacheMiddleware.getMetrics();
      const warmingStats = this.dependencies.cacheWarmer.getWarmingStats();

      const overallHitRate = this.calculateOverallHitRate(searchMetrics, httpMetrics);
      const avgResponseTime = this.calculateAvgResponseTime(searchMetrics, httpMetrics);

      const health: CacheHealthCheck = {
        status: searchHealth.status,
        timestamp: new Date(),
        services: {
          searchCache: {
            status: searchHealth.status,
            hitRate: searchMetrics.hitRates.overall,
            responseTime: searchMetrics.performance.avgResponseTime
          },
          httpCache: {
            status: httpMetrics.requests.total > 0 ? 'healthy' : 'idle',
            hitRate: httpMetrics.requests.total > 0 ?
               httpMetrics.requests.hits / httpMetrics.requests.total : 0,
            entries: httpMetrics.storage.entries
          },
          cacheWarmer: {
            status: warmingStats.totalWarmed > 0 ? 'active' : 'idle',
            lastRun: new Date(),
            successRate: warmingStats.successRate
          }
        },
        performance: {
          overallHitRate,
          avgResponseTime,
          memoryUsage: searchMetrics.storage.totalSize + httpMetrics.storage.totalSize,
          throughput: searchMetrics.performance.throughput
        },
        recommendations: searchHealth.recommendations,
        issues: searchHealth.issues
      };

      return health;
    } catch (error) {
      return {
        status: 'critical',
        timestamp: new Date(),
        services: {
          searchCache: { status: 'error', hitRate: 0, responseTime: 0 },
          httpCache: { status: 'error', hitRate: 0, entries: 0 },
          cacheWarmer: { status: 'error', lastRun: new Date(), successRate: 0 }
        },
        performance: {
          overallHitRate: 0,
          avgResponseTime: 0,
          memoryUsage: 0,
          throughput: 0
        },
        recommendations: ['System health check failed - investigate immediately'],
        issues: [`Health check failed: ${error.message}`]
      };
    }
  }

  private calculateOverallHitRate(searchMetrics: any, httpMetrics: any): number {
    const totalHits = searchMetrics.operations.cacheHits + httpMetrics.requests.hits;
    const totalRequests = searchMetrics.operations.totalQueries + httpMetrics.requests.total;

    return totalRequests > 0 ? totalHits / totalRequests : 0;
  }

  private calculateAvgResponseTime(searchMetrics: any, httpMetrics: any): number {
    const searchWeight = searchMetrics.operations.totalQueries;
    const httpWeight = httpMetrics.requests.total;
    const totalWeight = searchWeight + httpWeight;

    if (totalWeight === 0) return 0;

    const weightedAvg = (
      (searchMetrics.performance.avgResponseTime * searchWeight) +
      (httpMetrics.performance.avgHitTime * httpWeight)
    ) / totalWeight;

    return weightedAvg;
  }

  private handleError(res: Response, error: any, message: string): void {
    console.error(`${message}:`, error);

    const statusCode = error instanceof ServiceError ? error.statusCode : 500;

    res.status(statusCode).json({
      success: false,
      error: message,
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

export default CacheController;