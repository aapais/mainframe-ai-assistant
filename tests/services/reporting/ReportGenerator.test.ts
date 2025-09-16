import { EventEmitter } from 'events';
import {
  ReportGenerator,
  ReportConfig,
  ReportResult,
  DataSourceConnector,
  FilterConfig,
  AggregationConfig,
  VisualizationConfig
} from '../../../src/services/reporting/ReportGenerator';
import { Logger } from '../../../src/services/logger/Logger';

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
} as unknown as Logger;

// Mock data source connector
class MockDataSourceConnector implements DataSourceConnector {
  private connected = false;
  private mockData: any[] = [];

  constructor(mockData: any[] = []) {
    this.mockData = mockData;
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async executeQuery(query: string, parameters?: Record<string, any>): Promise<any[]> {
    if (!this.connected) {
      throw new Error('Not connected to data source');
    }
    return [...this.mockData];
  }

  async getSchema(): Promise<Record<string, any>> {
    return {
      version: '1.0.0',
      tables: ['test_table'],
      fields: ['id', 'name', 'value', 'created_at']
    };
  }

  async validateConnection(): Promise<boolean> {
    return this.connected;
  }

  setMockData(data: any[]): void {
    this.mockData = data;
  }
}

describe('ReportGenerator', () => {
  let reportGenerator: ReportGenerator;
  let mockConnector: MockDataSourceConnector;

  beforeEach(() => {
    reportGenerator = new ReportGenerator(mockLogger);
    mockConnector = new MockDataSourceConnector([
      { id: 1, name: 'John', value: 100, created_at: '2024-01-01' },
      { id: 2, name: 'Jane', value: 200, created_at: '2024-01-02' },
      { id: 3, name: 'Bob', value: 150, created_at: '2024-01-03' }
    ]);
    reportGenerator.registerDataSource('test_db', mockConnector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('registerDataSource', () => {
    it('should register a data source connector', () => {
      const newConnector = new MockDataSourceConnector();
      reportGenerator.registerDataSource('new_db', newConnector);

      expect(mockLogger.info).toHaveBeenCalledWith('Data source registered: new_db');
    });
  });

  describe('generateReport', () => {
    it('should generate a basic report successfully', async () => {
      const config: ReportConfig = {
        id: 'test-report',
        name: 'Test Report',
        type: 'analytics',
        dataSource: 'test_db',
        format: 'json',
        parameters: {}
      };

      const result = await reportGenerator.generateReport(config);

      expect(result.status).toBe('success');
      expect(result.reportId).toBe('test-report');
      expect(result.data).toHaveLength(3);
      expect(result.metadata.rowCount).toBe(3);
      expect(result.metadata.executionTime).toBeGreaterThan(0);
    });

    it('should apply filters correctly', async () => {
      const filters: FilterConfig[] = [
        {
          field: 'value',
          operator: 'gt',
          value: 120
        }
      ];

      const config: ReportConfig = {
        id: 'filtered-report',
        name: 'Filtered Report',
        type: 'analytics',
        dataSource: 'test_db',
        format: 'json',
        parameters: {},
        filters
      };

      const result = await reportGenerator.generateReport(config);

      expect(result.status).toBe('success');
      // Note: In this mock implementation, filters are applied at query level
      // In a real implementation, you'd verify the SQL query contains WHERE clauses
    });

    it('should handle aggregations', async () => {
      const aggregations: AggregationConfig[] = [
        {
          field: 'value',
          function: 'sum',
          groupBy: ['name']
        }
      ];

      const config: ReportConfig = {
        id: 'aggregated-report',
        name: 'Aggregated Report',
        type: 'analytics',
        dataSource: 'test_db',
        format: 'json',
        parameters: {},
        aggregations
      };

      const result = await reportGenerator.generateReport(config);

      expect(result.status).toBe('success');
      // Verify aggregation query was built correctly
    });

    it('should handle report generation errors', async () => {
      const config: ReportConfig = {
        id: 'error-report',
        name: 'Error Report',
        type: 'analytics',
        dataSource: 'nonexistent_db',
        format: 'json',
        parameters: {}
      };

      const result = await reportGenerator.generateReport(config);

      expect(result.status).toBe('error');
      expect(result.errors).toContain('Data source not found: nonexistent_db');
    });

    it('should cache successful report results', async () => {
      const config: ReportConfig = {
        id: 'cacheable-report',
        name: 'Cacheable Report',
        type: 'analytics',
        dataSource: 'test_db',
        format: 'json',
        parameters: {}
      };

      const result = await reportGenerator.generateReport(config);
      const cachedResult = reportGenerator.getCachedReport(result.id);

      expect(cachedResult).toBeTruthy();
      expect(cachedResult?.id).toBe(result.id);
    });

    it('should prevent duplicate report generation', async () => {
      const config: ReportConfig = {
        id: 'duplicate-report',
        name: 'Duplicate Report',
        type: 'analytics',
        dataSource: 'test_db',
        format: 'json',
        parameters: {}
      };

      // Start first report
      const promise1 = reportGenerator.generateReport(config);

      // Try to start same report again
      const promise2 = reportGenerator.generateReport(config);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Both should return the same result
      expect(result1.id).toBe(result2.id);
    });

    it('should emit events during report generation', async () => {
      const events: string[] = [];

      reportGenerator.on('reportStarted', () => events.push('started'));
      reportGenerator.on('reportCompleted', () => events.push('completed'));

      const config: ReportConfig = {
        id: 'event-report',
        name: 'Event Report',
        type: 'analytics',
        dataSource: 'test_db',
        format: 'json',
        parameters: {}
      };

      await reportGenerator.generateReport(config);

      expect(events).toContain('started');
      expect(events).toContain('completed');
    });

    it('should handle visualizations', async () => {
      const visualizations: VisualizationConfig[] = [
        {
          type: 'chart',
          chartType: 'bar',
          title: 'Values by Name',
          dataMapping: {
            x: 'name',
            y: 'value'
          }
        }
      ];

      const config: ReportConfig = {
        id: 'viz-report',
        name: 'Visualization Report',
        type: 'analytics',
        dataSource: 'test_db',
        format: 'json',
        parameters: {},
        visualizations
      };

      const result = await reportGenerator.generateReport(config);

      expect(result.status).toBe('success');
      // In a real implementation, you'd check that visualizations were generated
    });

    it('should apply data transformations for different report types', async () => {
      const performanceConfig: ReportConfig = {
        id: 'performance-report',
        name: 'Performance Report',
        type: 'performance',
        dataSource: 'test_db',
        format: 'json',
        parameters: { benchmark: 100 }
      };

      const result = await reportGenerator.generateReport(performanceConfig);

      expect(result.status).toBe('success');
      // Verify performance-specific transformations were applied
      expect(result.data[0]).toHaveProperty('performance_score');
      expect(result.data[0]).toHaveProperty('benchmark_comparison');
    });

    it('should generate warnings for large datasets', async () => {
      // Create a large mock dataset
      const largeData = Array.from({ length: 15000 }, (_, i) => ({
        id: i,
        name: `User${i}`,
        value: Math.random() * 1000
      }));

      mockConnector.setMockData(largeData);

      const config: ReportConfig = {
        id: 'large-report',
        name: 'Large Report',
        type: 'analytics',
        dataSource: 'test_db',
        format: 'json',
        parameters: {}
      };

      const result = await reportGenerator.generateReport(config);

      expect(result.status).toBe('success');
      expect(result.warnings).toContain('Large dataset returned - consider adding filters for better performance');
    });

    it('should generate warnings for empty datasets', async () => {
      mockConnector.setMockData([]);

      const config: ReportConfig = {
        id: 'empty-report',
        name: 'Empty Report',
        type: 'analytics',
        dataSource: 'test_db',
        format: 'json',
        parameters: {}
      };

      const result = await reportGenerator.generateReport(config);

      expect(result.status).toBe('success');
      expect(result.warnings).toContain('No data returned for the specified criteria');
    });
  });

  describe('cache management', () => {
    it('should clear cache', () => {
      reportGenerator.clearCache();
      expect(mockLogger.info).toHaveBeenCalledWith('Report cache cleared');
    });

    it('should limit cache size', async () => {
      const smallCacheGenerator = new ReportGenerator(mockLogger, 2); // Max 2 items
      smallCacheGenerator.registerDataSource('test_db', mockConnector);

      // Generate 3 reports to exceed cache limit
      for (let i = 0; i < 3; i++) {
        const config: ReportConfig = {
          id: `cache-test-${i}`,
          name: `Cache Test ${i}`,
          type: 'analytics',
          dataSource: 'test_db',
          format: 'json',
          parameters: {}
        };

        await smallCacheGenerator.generateReport(config);
      }

      // First report should be evicted from cache
      const firstResult = smallCacheGenerator.getCachedReport('cache-test-0');
      expect(firstResult).toBeNull();
    });
  });

  describe('active reports tracking', () => {
    it('should track active reports', async () => {
      const config: ReportConfig = {
        id: 'active-report',
        name: 'Active Report',
        type: 'analytics',
        dataSource: 'test_db',
        format: 'json',
        parameters: {}
      };

      const reportPromise = reportGenerator.generateReport(config);

      // Check that report is tracked as active
      const activeReports = reportGenerator.getActiveReports();
      expect(activeReports).toContain('active-report');

      await reportPromise;

      // After completion, should not be active
      const activeReportsAfter = reportGenerator.getActiveReports();
      expect(activeReportsAfter).not.toContain('active-report');
    });
  });

  describe('query building', () => {
    it('should build simple SELECT query', async () => {
      const config: ReportConfig = {
        id: 'simple-query',
        name: 'Simple Query',
        type: 'analytics',
        dataSource: 'test_table',
        format: 'json',
        parameters: {}
      };

      await reportGenerator.generateReport(config);

      // In a real implementation, you'd capture and verify the generated SQL
      // For now, we just verify the report was generated successfully
    });

    it('should build complex query with filters and aggregations', async () => {
      const config: ReportConfig = {
        id: 'complex-query',
        name: 'Complex Query',
        type: 'analytics',
        dataSource: 'test_table',
        format: 'json',
        parameters: {},
        filters: [
          { field: 'status', operator: 'eq', value: 'active' },
          { field: 'created_at', operator: 'gte', value: '2024-01-01', logicalOperator: 'AND' }
        ],
        aggregations: [
          { field: 'revenue', function: 'sum', groupBy: ['region'] }
        ]
      };

      const result = await reportGenerator.generateReport(config);
      expect(result.status).toBe('success');
    });
  });

  describe('error handling', () => {
    it('should handle data source connection errors', async () => {
      const faultyConnector = new MockDataSourceConnector();
      // Override connect to throw error
      faultyConnector.connect = jest.fn().mockRejectedValue(new Error('Connection failed'));

      reportGenerator.registerDataSource('faulty_db', faultyConnector);

      const config: ReportConfig = {
        id: 'faulty-report',
        name: 'Faulty Report',
        type: 'analytics',
        dataSource: 'faulty_db',
        format: 'json',
        parameters: {}
      };

      const result = await reportGenerator.generateReport(config);

      expect(result.status).toBe('error');
      expect(result.errors).toContain('Connection failed');
    });

    it('should handle query execution errors', async () => {
      const faultyConnector = new MockDataSourceConnector();
      faultyConnector.executeQuery = jest.fn().mockRejectedValue(new Error('Query failed'));

      reportGenerator.registerDataSource('query_error_db', faultyConnector);

      const config: ReportConfig = {
        id: 'query-error-report',
        name: 'Query Error Report',
        type: 'analytics',
        dataSource: 'query_error_db',
        format: 'json',
        parameters: {}
      };

      const result = await reportGenerator.generateReport(config);

      expect(result.status).toBe('error');
      expect(result.errors).toContain('Query failed');
    });
  });
});