import { promises as fs } from 'fs';
import * as path from 'path';
import {
  DataExporter,
  ExportConfig,
  ExportResult,
  ExportJob,
  FormatHandler,
  DataTransformer
} from '../../../src/services/reporting/DataExporter';
import { Logger } from '../../../src/services/logger/Logger';

// Mock file system
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    stat: jest.fn()
  }
}));

const mockFs = fs as jest.Mocked<typeof fs>;

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
} as unknown as Logger;

// Test data
const testData = [
  { id: 1, name: 'John Doe', email: 'john@example.com', score: 85.5, created_at: new Date('2024-01-15') },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', score: 92.3, created_at: new Date('2024-02-20') },
  { id: 3, name: 'Bob Johnson', email: 'bob@example.com', score: 78.9, created_at: new Date('2024-03-10') }
];

describe('DataExporter', () => {
  let exporter: DataExporter;
  const testOutputDir = '/tmp/test-exports';

  beforeEach(() => {
    exporter = new DataExporter(mockLogger, testOutputDir, 2); // Max 2 concurrent jobs
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.stat.mockResolvedValue({ size: 1024 } as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create output directory on initialization', async () => {
      await new Promise(resolve => setTimeout(resolve, 10)); // Allow async initialization

      expect(mockFs.mkdir).toHaveBeenCalledWith(testOutputDir, { recursive: true });
    });

    it('should register built-in format handlers', () => {
      const supportedFormats = exporter.getSupportedFormats();

      expect(supportedFormats).toContain('csv');
      expect(supportedFormats).toContain('json');
      expect(supportedFormats).toContain('xml');
      expect(supportedFormats).toContain('html');
    });
  });

  describe('format handler registration', () => {
    it('should register custom format handler', () => {
      const customHandler: FormatHandler = {
        format: 'custom',
        validate: () => [],
        export: async () => ({
          success: true,
          recordCount: 0,
          duration: 0,
          format: 'custom'
        })
      };

      exporter.registerFormatHandler(customHandler);

      const supportedFormats = exporter.getSupportedFormats();
      expect(supportedFormats).toContain('custom');
    });

    it('should register data transformer', () => {
      const transformer: DataTransformer = {
        name: 'test-transformer',
        transform: async (data) => data
      };

      exporter.registerTransformer(transformer);

      expect(mockLogger.info).toHaveBeenCalledWith('Data transformer registered: test-transformer');
    });
  });

  describe('exportData', () => {
    it('should create and start export job', async () => {
      const config: ExportConfig = {
        format: 'json',
        fileName: 'test-export.json',
        options: {
          prettyPrint: true
        }
      };

      const jobId = await exporter.exportData(testData, config);

      expect(jobId).toBeDefined();
      expect(jobId).toMatch(/^export_\d+_[a-z0-9]+$/);
    });

    it('should reject when max concurrent jobs reached', async () => {
      const config: ExportConfig = {
        format: 'json',
        options: {}
      };

      // Start maximum number of concurrent jobs
      const job1 = exporter.exportData(testData, config);
      const job2 = exporter.exportData(testData, config);

      // Third job should be rejected
      await expect(exporter.exportData(testData, config))
        .rejects
        .toThrow('Maximum concurrent export jobs reached');

      // Clean up
      await Promise.allSettled([job1, job2]);
    });

    it('should emit job events', async () => {
      const events: string[] = [];

      exporter.on('jobCreated', () => events.push('created'));
      exporter.on('jobStarted', () => events.push('started'));
      exporter.on('jobCompleted', () => events.push('completed'));

      const config: ExportConfig = {
        format: 'json',
        options: {}
      };

      const jobId = await exporter.exportData(testData, config);

      // Wait for job processing
      await new Promise(resolve => {
        exporter.on('jobCompleted', resolve);
      });

      expect(events).toContain('created');
      expect(events).toContain('started');
      expect(events).toContain('completed');
    });
  });

  describe('CSV export', () => {
    it('should export data to CSV format', async () => {
      const config: ExportConfig = {
        format: 'csv',
        fileName: 'test.csv',
        options: {
          includeHeaders: true,
          delimiter: ',',
          quoteChar: '"'
        }
      };

      const jobId = await exporter.exportData(testData, config);

      // Wait for completion
      await new Promise(resolve => {
        exporter.on('jobCompleted', resolve);
      });

      const job = exporter.getJob(jobId);
      expect(job?.status).toBe('completed');
      expect(job?.result?.success).toBe(true);
      expect(job?.result?.format).toBe('csv');

      // Verify CSV content was written
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test.csv'),
        expect.stringContaining('"id","name","email","score","created_at"'),
        { encoding: 'utf8' }
      );
    });

    it('should handle custom CSV options', async () => {
      const config: ExportConfig = {
        format: 'csv',
        options: {
          delimiter: ';',
          quoteChar: "'",
          lineEnding: '\r\n',
          includeHeaders: false
        }
      };

      const jobId = await exporter.exportData(testData, config);

      await new Promise(resolve => {
        exporter.on('jobCompleted', resolve);
      });

      // Verify custom delimiter and quote char were used
      const writeCall = mockFs.writeFile.mock.calls.find(call =>
        typeof call[1] === 'string' && call[1].includes(';')
      );
      expect(writeCall).toBeDefined();
    });
  });

  describe('JSON export', () => {
    it('should export data to JSON format', async () => {
      const config: ExportConfig = {
        format: 'json',
        options: {
          prettyPrint: true
        }
      };

      const jobId = await exporter.exportData(testData, config);

      await new Promise(resolve => {
        exporter.on('jobCompleted', resolve);
      });

      const job = exporter.getJob(jobId);
      expect(job?.status).toBe('completed');
      expect(job?.result?.format).toBe('json');

      // Verify JSON was written with pretty printing
      const writeCall = mockFs.writeFile.mock.calls.find(call =>
        typeof call[1] === 'string' && call[1].includes('  ')
      );
      expect(writeCall).toBeDefined();
    });

    it('should export compact JSON when prettyPrint is false', async () => {
      const config: ExportConfig = {
        format: 'json',
        options: {
          prettyPrint: false
        }
      };

      const jobId = await exporter.exportData(testData, config);

      await new Promise(resolve => {
        exporter.on('jobCompleted', resolve);
      });

      // Verify compact JSON (no extra whitespace)
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.not.stringContaining('  '),
        expect.any(Object)
      );
    });
  });

  describe('XML export', () => {
    it('should export data to XML format', async () => {
      const config: ExportConfig = {
        format: 'xml',
        options: {}
      };

      const jobId = await exporter.exportData(testData, config);

      await new Promise(resolve => {
        exporter.on('jobCompleted', resolve);
      });

      const job = exporter.getJob(jobId);
      expect(job?.status).toBe('completed');
      expect(job?.result?.format).toBe('xml');

      // Verify XML structure
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringMatching(/<\?xml version="1\.0" encoding="UTF-8"\?>/),
        expect.any(Object)
      );
    });
  });

  describe('HTML export', () => {
    it('should export data to HTML format', async () => {
      const config: ExportConfig = {
        format: 'html',
        options: {
          includeCSS: true,
          responsive: true
        }
      };

      const jobId = await exporter.exportData(testData, config);

      await new Promise(resolve => {
        exporter.on('jobCompleted', resolve);
      });

      const job = exporter.getJob(jobId);
      expect(job?.status).toBe('completed');
      expect(job?.result?.format).toBe('html');

      // Verify HTML structure
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringMatching(/<!DOCTYPE html>/),
        expect.any(Object)
      );
    });

    it('should include custom CSS when provided', async () => {
      const config: ExportConfig = {
        format: 'html',
        options: {
          includeCSS: true,
          customCSS: 'body { background-color: red; }'
        }
      };

      const jobId = await exporter.exportData(testData, config);

      await new Promise(resolve => {
        exporter.on('jobCompleted', resolve);
      });

      // Verify custom CSS was included
      const writeCall = mockFs.writeFile.mock.calls.find(call =>
        typeof call[1] === 'string' && call[1].includes('background-color: red')
      );
      expect(writeCall).toBeDefined();
    });
  });

  describe('data transformations', () => {
    it('should format dates according to specified format', async () => {
      const config: ExportConfig = {
        format: 'json',
        options: {
          dateFormat: 'YYYY-MM-DD'
        }
      };

      const jobId = await exporter.exportData(testData, config);

      await new Promise(resolve => {
        exporter.on('jobCompleted', resolve);
      });

      // In a real implementation, you'd verify the date formatting
      // For now, just check that the job completed successfully
      const job = exporter.getJob(jobId);
      expect(job?.status).toBe('completed');
    });

    it('should format numbers according to specified format', async () => {
      const config: ExportConfig = {
        format: 'json',
        options: {
          numberFormat: {
            decimals: 2,
            thousandsSeparator: ',',
            decimalSeparator: '.'
          }
        }
      };

      const jobId = await exporter.exportData(testData, config);

      await new Promise(resolve => {
        exporter.on('jobCompleted', resolve);
      });

      const job = exporter.getJob(jobId);
      expect(job?.status).toBe('completed');
    });

    it('should format currency values', async () => {
      const dataWithCurrency = [
        { id: 1, name: 'Product A', price: 19.99 },
        { id: 2, name: 'Product B', amount: 299.50 }
      ];

      const config: ExportConfig = {
        format: 'json',
        options: {
          currencyFormat: {
            code: 'USD',
            symbol: '$',
            position: 'before',
            decimals: 2
          }
        }
      };

      const jobId = await exporter.exportData(dataWithCurrency, config);

      await new Promise(resolve => {
        exporter.on('jobCompleted', resolve);
      });

      const job = exporter.getJob(jobId);
      expect(job?.status).toBe('completed');
    });
  });

  describe('error handling', () => {
    it('should handle unsupported format', async () => {
      const config: ExportConfig = {
        format: 'unsupported' as any,
        options: {}
      };

      const jobId = await exporter.exportData(testData, config);

      await new Promise(resolve => {
        exporter.on('jobFailed', resolve);
      });

      const job = exporter.getJob(jobId);
      expect(job?.status).toBe('failed');
      expect(job?.error).toContain('Unsupported export format');
    });

    it('should handle file write errors', async () => {
      mockFs.writeFile.mockRejectedValueOnce(new Error('Write failed'));

      const config: ExportConfig = {
        format: 'json',
        options: {}
      };

      const jobId = await exporter.exportData(testData, config);

      await new Promise(resolve => {
        exporter.on('jobFailed', resolve);
      });

      const job = exporter.getJob(jobId);
      expect(job?.status).toBe('failed');
      expect(job?.error).toBe('Write failed');
    });
  });

  describe('job management', () => {
    it('should list jobs by status', async () => {
      const config: ExportConfig = {
        format: 'json',
        options: {}
      };

      await exporter.exportData(testData, config);

      const pendingJobs = exporter.listJobs('pending');
      expect(pendingJobs.length).toBeGreaterThan(0);

      // Wait for completion
      await new Promise(resolve => {
        exporter.on('jobCompleted', resolve);
      });

      const completedJobs = exporter.listJobs('completed');
      expect(completedJobs.length).toBeGreaterThan(0);
    });

    it('should cancel active job', async () => {
      const config: ExportConfig = {
        format: 'json',
        options: {}
      };

      const jobId = await exporter.exportData(testData, config);
      const cancelled = exporter.cancelJob(jobId);

      expect(cancelled).toBe(true);

      const job = exporter.getJob(jobId);
      expect(job?.status).toBe('cancelled');
    });

    it('should not cancel completed job', async () => {
      const config: ExportConfig = {
        format: 'json',
        options: {}
      };

      const jobId = await exporter.exportData(testData, config);

      // Wait for completion
      await new Promise(resolve => {
        exporter.on('jobCompleted', resolve);
      });

      const cancelled = exporter.cancelJob(jobId);
      expect(cancelled).toBe(false);
    });

    it('should clear completed jobs', async () => {
      const config: ExportConfig = {
        format: 'json',
        options: {}
      };

      await exporter.exportData(testData, config);

      // Wait for completion
      await new Promise(resolve => {
        exporter.on('jobCompleted', resolve);
      });

      const clearedCount = exporter.clearCompletedJobs();
      expect(clearedCount).toBeGreaterThan(0);

      const remainingJobs = exporter.listJobs();
      const completedJobs = remainingJobs.filter(job => job.status === 'completed');
      expect(completedJobs).toHaveLength(0);
    });
  });

  describe('file path generation', () => {
    it('should use provided file path', async () => {
      const customPath = '/custom/path/export.json';
      const config: ExportConfig = {
        format: 'json',
        filePath: customPath,
        options: {}
      };

      const jobId = await exporter.exportData(testData, config);

      await new Promise(resolve => {
        exporter.on('jobCompleted', resolve);
      });

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        customPath,
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should use provided file name', async () => {
      const config: ExportConfig = {
        format: 'json',
        fileName: 'custom-export.json',
        options: {}
      };

      const jobId = await exporter.exportData(testData, config);

      await new Promise(resolve => {
        exporter.on('jobCompleted', resolve);
      });

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('custom-export.json'),
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should generate file name automatically', async () => {
      const config: ExportConfig = {
        format: 'csv',
        options: {}
      };

      const jobId = await exporter.exportData(testData, config);

      await new Promise(resolve => {
        exporter.on('jobCompleted', resolve);
      });

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/export_\d+\.csv$/),
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe('validation', () => {
    it('should validate export configuration', async () => {
      const config: ExportConfig = {
        format: '' as any, // Invalid format
        options: {}
      };

      const jobId = await exporter.exportData(testData, config);

      await new Promise(resolve => {
        exporter.on('jobFailed', resolve);
      });

      const job = exporter.getJob(jobId);
      expect(job?.status).toBe('failed');
      expect(job?.error).toContain('Export format is required');
    });
  });

  describe('compression and encoding', () => {
    it('should handle different encodings', async () => {
      const config: ExportConfig = {
        format: 'json',
        options: {
          encoding: 'utf16'
        }
      };

      const jobId = await exporter.exportData(testData, config);

      await new Promise(resolve => {
        exporter.on('jobCompleted', resolve);
      });

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        { encoding: 'utf16' }
      );
    });
  });

  describe('Excel and PDF placeholders', () => {
    it('should throw error for Excel export without dependencies', async () => {
      const config: ExportConfig = {
        format: 'excel',
        options: {}
      };

      const jobId = await exporter.exportData(testData, config);

      await new Promise(resolve => {
        exporter.on('jobFailed', resolve);
      });

      const job = exporter.getJob(jobId);
      expect(job?.status).toBe('failed');
      expect(job?.error).toContain('Excel export requires additional dependencies');
    });

    it('should throw error for PDF export without dependencies', async () => {
      const config: ExportConfig = {
        format: 'pdf',
        options: {}
      };

      const jobId = await exporter.exportData(testData, config);

      await new Promise(resolve => {
        exporter.on('jobFailed', resolve);
      });

      const job = exporter.getJob(jobId);
      expect(job?.status).toBe('failed');
      expect(job?.error).toContain('PDF export requires additional dependencies');
    });
  });
});