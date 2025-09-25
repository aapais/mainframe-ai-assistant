/**
 * Monitoring API
 * REST API endpoints for monitoring system
 */

import { Request, Response } from 'express';
import { metricsCollector } from '@/services/metrics/MetricsCollector';
import { PerformanceReportGenerator } from '@/services/metrics/PerformanceReportGenerator';

export class MonitoringAPI {
  private reportGenerator: PerformanceReportGenerator;

  constructor() {
    this.reportGenerator = new PerformanceReportGenerator(metricsCollector);
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics = async (req: Request, res: Response) => {
    try {
      const metrics = metricsCollector.getCurrentMetrics();
      res.json({
        success: true,
        data: metrics,
        timestamp: Date.now(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * Get query performance metrics
   */
  getQueryMetrics = async (req: Request, res: Response) => {
    try {
      const queryMetrics = metricsCollector.getQueryMetrics();
      res.json({
        success: true,
        data: queryMetrics,
        timestamp: Date.now(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve query metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * Get cache performance metrics
   */
  getCacheMetrics = async (req: Request, res: Response) => {
    try {
      const cacheMetrics = metricsCollector.getCacheMetrics();
      res.json({
        success: true,
        data: cacheMetrics,
        timestamp: Date.now(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve cache metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * Get response time metrics with percentiles
   */
  getResponseTimeMetrics = async (req: Request, res: Response) => {
    try {
      const responseMetrics = metricsCollector.getResponseTimeMetrics();
      res.json({
        success: true,
        data: responseMetrics,
        timestamp: Date.now(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve response time metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * Get SLA compliance metrics
   */
  getSLAMetrics = async (req: Request, res: Response) => {
    try {
      const { responseTime = 500, errorRate = 0.01, throughput = 100 } = req.query;

      const slaMetrics = metricsCollector.getSLAMetrics({
        responseTime: Number(responseTime),
        errorRate: Number(errorRate),
        throughput: Number(throughput),
      });

      res.json({
        success: true,
        data: slaMetrics,
        timestamp: Date.now(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve SLA metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * Record a query performance metric
   */
  recordQuery = async (req: Request, res: Response) => {
    try {
      const { query, duration, success, metadata = {} } = req.body;

      if (!query || duration === undefined || success === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: query, duration, success',
        });
      }

      metricsCollector.recordQuery(query, duration, success, metadata);

      res.json({
        success: true,
        message: 'Query metric recorded successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to record query metric',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * Record a cache event (hit/miss)
   */
  recordCacheEvent = async (req: Request, res: Response) => {
    try {
      const { key, hit, retrievalTime } = req.body;

      if (!key || hit === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: key, hit',
        });
      }

      metricsCollector.recordCacheEvent(key, hit, retrievalTime);

      res.json({
        success: true,
        message: 'Cache event recorded successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to record cache event',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * Record a response time metric
   */
  recordResponseTime = async (req: Request, res: Response) => {
    try {
      const { endpoint, method, duration, statusCode } = req.body;

      if (!endpoint || !method || duration === undefined || !statusCode) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: endpoint, method, duration, statusCode',
        });
      }

      metricsCollector.recordResponseTime(endpoint, method, duration, statusCode);

      res.json({
        success: true,
        message: 'Response time metric recorded successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to record response time metric',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * Generate performance report
   */
  generateReport = async (req: Request, res: Response) => {
    try {
      const { type = 'daily', format = 'json', customPeriod } = req.query;

      const reportType = type as 'hourly' | 'daily' | 'weekly' | 'monthly';
      const exportFormat = format as 'json' | 'csv' | 'html' | 'pdf';

      let period;
      if (customPeriod && typeof customPeriod === 'string') {
        try {
          period = JSON.parse(customPeriod);
        } catch {
          return res.status(400).json({
            success: false,
            error: 'Invalid customPeriod format',
          });
        }
      }

      const report = await this.reportGenerator.generateReport(reportType, period);

      if (exportFormat === 'json') {
        res.json({
          success: true,
          data: report,
        });
      } else {
        const exportedReport = await this.reportGenerator.exportReport(report, exportFormat);

        const contentTypes = {
          csv: 'text/csv',
          html: 'text/html',
          pdf: 'application/pdf',
        };

        res.setHeader('Content-Type', contentTypes[exportFormat]);
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="performance-report-${report.id}.${exportFormat}"`
        );
        res.send(exportedReport);
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to generate report',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * Get system health status
   */
  getHealthStatus = async (req: Request, res: Response) => {
    try {
      const currentMetrics = metricsCollector.getCurrentMetrics();

      const health = {
        status: 'healthy',
        timestamp: Date.now(),
        checks: {
          responseTime: {
            status: currentMetrics.responseTime.p95 <= 500 ? 'healthy' : 'unhealthy',
            value: `${currentMetrics.responseTime.p95.toFixed(0)}ms`,
            threshold: '500ms',
          },
          errorRate: {
            status: currentMetrics.query.errorRate <= 0.01 ? 'healthy' : 'unhealthy',
            value: `${(currentMetrics.query.errorRate * 100).toFixed(2)}%`,
            threshold: '1%',
          },
          cacheHitRate: {
            status: currentMetrics.cache.hitRate >= 0.8 ? 'healthy' : 'degraded',
            value: `${(currentMetrics.cache.hitRate * 100).toFixed(1)}%`,
            threshold: '80%',
          },
          availability: {
            status: currentMetrics.sla.availability >= 0.99 ? 'healthy' : 'unhealthy',
            value: `${(currentMetrics.sla.availability * 100).toFixed(2)}%`,
            threshold: '99%',
          },
        },
        violations: currentMetrics.sla.violations,
      };

      // Determine overall status
      const unhealthyChecks = Object.values(health.checks).filter(
        check => check.status === 'unhealthy'
      );
      const degradedChecks = Object.values(health.checks).filter(
        check => check.status === 'degraded'
      );

      if (unhealthyChecks.length > 0) {
        health.status = 'unhealthy';
      } else if (degradedChecks.length > 0) {
        health.status = 'degraded';
      }

      res.json({
        success: true,
        data: health,
      });
    } catch (error) {
      res.status(503).json({
        success: false,
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * Get monitoring statistics
   */
  getMonitoringStats = async (req: Request, res: Response) => {
    try {
      const stats = {
        metricsCollected: {
          total: 0, // Would need to track this
          lastHour: 0,
          lastDay: 0,
        },
        activeSubscriptions: 0, // Would track WebSocket connections
        reportGeneration: {
          totalReports: 0,
          lastGenerated: null,
        },
        systemUptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
      };

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve monitoring statistics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
}
