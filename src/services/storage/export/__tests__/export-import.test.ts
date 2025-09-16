/**
 * Enhanced Export/Import Services Tests
 * Tests the comprehensive export/import functionality
 */

import { ExportImportServiceFactory } from '../index';
import { ExportService } from '../ExportService';
import { ImportService } from '../ImportService';
import { FormatConverter } from '../FormatConverter';
import { DataTransformer } from '../DataTransformer';
import { ValidationService } from '../ValidationService';
import { BatchProcessor } from '../BatchProcessor';

// Mock Knowledge Base Service
class MockKnowledgeBaseService {
  private entries = [
    {
      id: '1',
      title: 'VSAM Status 35 - File Not Found',
      problem: 'Job abends with VSAM status code 35',
      solution: 'Verify dataset exists and check DD statement',
      category: 'VSAM',
      tags: ['vsam', 'status-35', 'file-not-found'],
      created_at: new Date('2024-01-01'),
      updated_at: new Date('2024-01-01'),
      created_by: 'system',
      usage_count: 45,
      success_count: 40,
      failure_count: 5,
      version: 1
    },
    {
      id: '2',
      title: 'S0C7 Data Exception in COBOL',
      problem: 'Program abends with S0C7 data exception',
      solution: 'Check for non-numeric data in numeric fields',
      category: 'Batch',
      tags: ['s0c7', 'data-exception', 'numeric'],
      created_at: new Date('2024-01-02'),
      updated_at: new Date('2024-01-02'),
      created_by: 'developer',
      usage_count: 32,
      success_count: 28,
      failure_count: 4,
      version: 1
    }
  ];

  async list(options: any = {}) {
    return {
      data: this.entries.slice(0, options.limit || 10)
    };
  }

  async search(query: string) {
    return this.entries
      .filter(entry => entry.title.toLowerCase().includes(query.toLowerCase()))
      .map(entry => ({ entry, score: 0.9, matchType: 'fuzzy' as const }));
  }

  async create(entry: any) {
    const id = Math.random().toString(36).substr(2, 9);
    this.entries.push({ ...entry, id, version: 1 });
    return id;
  }

  async update(id: string, updates: any) {
    const index = this.entries.findIndex(e => e.id === id);
    if (index >= 0) {
      this.entries[index] = { ...this.entries[index], ...updates };
      return true;
    }
    return false;
  }
}

describe('Enhanced Export/Import Services', () => {
  let kbService: MockKnowledgeBaseService;
  let services: ReturnType<typeof ExportImportServiceFactory.createCompleteService>;

  beforeEach(() => {
    kbService = new MockKnowledgeBaseService();
    services = ExportImportServiceFactory.createCompleteService(kbService);
  });

  describe('ExportService', () => {
    test('should create export service', () => {
      expect(services.export).toBeInstanceOf(ExportService);
    });

    test('should get supported formats', () => {
      const formats = services.export.getSupportedFormats();
      expect(formats).toContain('json');
      expect(formats).toContain('csv');
      expect(formats).toContain('xml');
    });

    test('should validate export options', () => {
      const validation = services.export.validateOptions('json', {
        includeMetrics: true,
        format: 'full'
      });

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should handle Avro format requirement for schema', () => {
      const validation = services.export.validateOptions('avro', {});
      
      // Should warn about missing schema
      expect(validation.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('ImportService', () => {
    test('should create import service', () => {
      expect(services.import).toBeInstanceOf(ImportService);
    });

    test('should get supported formats', () => {
      const formats = services.import.getSupportedFormats();
      expect(formats).toContain('json');
      expect(formats).toContain('csv');
      expect(formats).toContain('xml');
    });
  });

  describe('FormatConverter', () => {
    test('should create format converter', () => {
      expect(services.converter).toBeInstanceOf(FormatConverter);
    });

    test('should convert data to JSON', async () => {
      const data = await kbService.list();
      const result = await services.converter.convert(data.data, 'json');
      
      expect(typeof result).toBe('string');
      const parsed = JSON.parse(result as string);
      expect(parsed).toHaveProperty('metadata');
      expect(parsed).toHaveProperty('data');
    });

    test('should convert data to CSV', async () => {
      const data = await kbService.list();
      const result = await services.converter.convert(data.data, 'csv');
      
      expect(typeof result).toBe('string');
      expect(result).toContain('id,title,problem');
    });

    test('should convert data to XML', async () => {
      const data = await kbService.list();
      const result = await services.converter.convert(data.data, 'xml');
      
      expect(typeof result).toBe('string');
      expect(result).toContain('<?xml version="1.0"');
      expect(result).toContain('<knowledgebase');
    });

    test('should validate format conversion compatibility', () => {
      const compatibility = services.converter.validateConversion('json', 'csv', 1000);
      
      expect(compatibility.compatible).toBe(true);
      expect(Array.isArray(compatibility.warnings)).toBe(true);
      expect(Array.isArray(compatibility.limitations)).toBe(true);
    });

    test('should support compression', () => {
      expect(services.converter.supportsCompression('json')).toBe(true);
      expect(services.converter.supportsCompression('csv')).toBe(true);
    });

    test('should support streaming', () => {
      expect(services.converter.supportsStreaming('json')).toBe(true);
      expect(services.converter.supportsStreaming('csv')).toBe(true);
    });
  });

  describe('DataTransformer', () => {
    test('should create data transformer', () => {
      expect(services.transformer).toBeInstanceOf(DataTransformer);
    });

    test('should transform data for export', async () => {
      const data = await kbService.list();
      const transformed = await services.transformer.transform(data.data, {
        format: 'minimal',
        includeMetrics: false
      });

      expect(Array.isArray(transformed)).toBe(true);
      expect(transformed.length).toBe(data.data.length);
      
      // Should remove metrics in minimal format
      if (transformed.length > 0) {
        expect(transformed[0]).not.toHaveProperty('usage_count');
        expect(transformed[0]).not.toHaveProperty('success_count');
        expect(transformed[0]).not.toHaveProperty('failure_count');
      }
    });

    test('should transform data for import', async () => {
      const importData = [
        {
          summary: 'Test Problem',
          description: 'Test problem description',
          resolution: 'Test solution',
          issuetype: 'Bug'
        }
      ];

      const transformed = await services.transformer.transformForImport(importData, {
        fieldMappings: {
          'summary': 'title',
          'description': 'problem',
          'resolution': 'solution',
          'issuetype': 'category'
        }
      });

      expect(Array.isArray(transformed)).toBe(true);
      expect(transformed.length).toBe(1);
      
      const entry = transformed[0];
      expect(entry).toHaveProperty('title', 'Test Problem');
      expect(entry).toHaveProperty('problem', 'Test problem description');
      expect(entry).toHaveProperty('solution', 'Test solution');
    });

    test('should validate transformation compatibility', () => {
      const sampleData = [
        {
          title: 'Sample Entry',
          problem: 'Sample problem',
          solution: 'Sample solution',
          category: 'VSAM'
        }
      ];

      const compatibility = services.transformer.validateTransformation(sampleData, {
        fieldMappings: {
          'title': 'summary'
        }
      });

      expect(compatibility.compatible).toBe(true);
      expect(Array.isArray(compatibility.issues)).toBe(true);
      expect(Array.isArray(compatibility.suggestions)).toBe(true);
    });

    test('should get available pipelines', () => {
      const pipelines = services.transformer.getAvailablePipelines();
      
      expect(Array.isArray(pipelines)).toBe(true);
      expect(pipelines.length).toBeGreaterThan(0);
      
      pipelines.forEach(pipeline => {
        expect(pipeline).toHaveProperty('id');
        expect(pipeline).toHaveProperty('name');
        expect(pipeline).toHaveProperty('description');
      });
    });
  });

  describe('ValidationService', () => {
    test('should create validation service', () => {
      expect(services.validator).toBeInstanceOf(ValidationService);
    });

    test('should validate valid record', async () => {
      const validRecord = {
        title: 'Valid Test Entry',
        problem: 'This is a valid problem description with sufficient detail',
        solution: 'This is a valid solution with clear steps',
        category: 'VSAM',
        tags: ['valid', 'test']
      };

      const validation = await services.validator.validateRecord(validRecord, 0);
      
      expect(validation.valid).toBe(true);
      expect(validation.issues.filter(i => i.level === 'error')).toHaveLength(0);
    });

    test('should validate invalid record', async () => {
      const invalidRecord = {
        title: 'Bad', // Too short
        problem: 'Short', // Too short
        solution: '', // Empty
        category: 'InvalidCategory', // Invalid
        tags: 'not-an-array' // Wrong type
      };

      const validation = await services.validator.validateRecord(invalidRecord, 0);
      
      expect(validation.valid).toBe(false);
      expect(validation.issues.filter(i => i.level === 'error').length).toBeGreaterThan(0);
    });

    test('should validate import data', async () => {
      const testData = [
        {
          title: 'Valid Entry',
          problem: 'Valid problem description',
          solution: 'Valid solution',
          category: 'VSAM'
        },
        {
          title: 'Invalid', // Issues
          problem: 'Short',
          solution: '',
          category: 'BadCategory'
        }
      ];

      const validation = await services.validator.validateImportData(testData);
      
      expect(validation).toHaveProperty('valid');
      expect(validation).toHaveProperty('errors');
      expect(validation).toHaveProperty('warnings');
      expect(validation).toHaveProperty('stats');
      
      expect(validation.stats?.totalRecords).toBe(2);
      expect(validation.stats?.validRecords).toBe(1);
      expect(validation.stats?.invalidRecords).toBe(1);
    });

    test('should get data quality metrics', async () => {
      const testData = [
        {
          title: 'Complete Entry',
          problem: 'Complete problem',
          solution: 'Complete solution',
          category: 'VSAM',
          created_at: new Date()
        },
        {
          title: 'Incomplete Entry',
          problem: '',
          solution: 'Solution only',
          category: 'DB2'
        }
      ];

      const metrics = await services.validator.getDataQualityMetrics(testData);
      
      expect(metrics).toHaveProperty('completeness');
      expect(metrics).toHaveProperty('accuracy');
      expect(metrics).toHaveProperty('consistency');
      expect(metrics).toHaveProperty('uniqueness');
      expect(metrics).toHaveProperty('timeliness');
      expect(metrics).toHaveProperty('validity');
      
      expect(metrics.completeness).toBeGreaterThan(0);
      expect(metrics.completeness).toBeLessThanOrEqual(100);
    });

    test('should provide validation suggestions', () => {
      const suggestions = services.validator.getValidationSuggestions(
        'title',
        'Bad',
        'Title too short'
      );
      
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toContain('5-200 characters');
    });
  });

  describe('BatchProcessor', () => {
    test('should create batch processor', () => {
      expect(services.batchProcessor).toBeInstanceOf(BatchProcessor);
    });

    test('should process batch data', async () => {
      const testData = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        data: `item-${i + 1}`
      }));

      const result = await services.batchProcessor.processBatch(
        testData,
        async (batch) => {
          // Simulate processing
          return batch.map(item => ({ ...item, processed: true }));
        }
      );

      expect(result.data).toHaveLength(10);
      expect(result.totalProcessed).toBe(10);
      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
    });

    test('should handle batch errors gracefully', async () => {
      const testData = [
        { id: 1, valid: true },
        { id: 2, valid: false }, // This will cause an error
        { id: 3, valid: true }
      ];

      const result = await services.batchProcessor.processBatch(
        testData,
        async (batch) => {
          return batch.map(item => {
            if (!item.valid) {
              throw new Error('Invalid item');
            }
            return { ...item, processed: true };
          });
        },
        undefined, // no progress callback
        (error) => {
          expect(error.error).toContain('Invalid item');
          expect(error.recoverable).toBe(true);
        }
      );

      // Should complete despite errors
      expect(result.totalProcessed).toBe(3);
    });

    test('should get processor statistics', () => {
      const stats = services.batchProcessor.getStatistics();
      
      expect(stats).toHaveProperty('isProcessing');
      expect(stats).toHaveProperty('activeWorkers');
      expect(stats).toHaveProperty('checkpointCount');
      expect(stats).toHaveProperty('memoryUsage');
      
      expect(typeof stats.isProcessing).toBe('boolean');
      expect(typeof stats.activeWorkers).toBe('number');
      expect(typeof stats.checkpointCount).toBe('number');
    });
  });

  describe('ServiceFactory', () => {
    test('should create complete service set', () => {
      const services = ExportImportServiceFactory.createCompleteService(kbService);
      
      expect(services).toHaveProperty('export');
      expect(services).toHaveProperty('import');
      expect(services).toHaveProperty('converter');
      expect(services).toHaveProperty('transformer');
      expect(services).toHaveProperty('validator');
      expect(services).toHaveProperty('batchProcessor');
    });

    test('should create individual services', () => {
      const exportService = ExportImportServiceFactory.createExportService(kbService);
      const importService = ExportImportServiceFactory.createImportService(kbService);
      const converter = ExportImportServiceFactory.createFormatConverter();
      const transformer = ExportImportServiceFactory.createDataTransformer();
      const validator = ExportImportServiceFactory.createValidationService();
      const batchProcessor = ExportImportServiceFactory.createBatchProcessor();
      
      expect(exportService).toBeInstanceOf(ExportService);
      expect(importService).toBeInstanceOf(ImportService);
      expect(converter).toBeInstanceOf(FormatConverter);
      expect(transformer).toBeInstanceOf(DataTransformer);
      expect(validator).toBeInstanceOf(ValidationService);
      expect(batchProcessor).toBeInstanceOf(BatchProcessor);
    });
  });

  describe('Integration Tests', () => {
    test('should perform complete export-import cycle', async () => {
      // This would require actual file operations
      // For now, we'll test the data flow
      
      const data = await kbService.list();
      
      // Transform for export
      const exportData = await services.transformer.transform(data.data, {
        format: 'full',
        includeMetrics: true
      });
      
      // Convert to JSON
      const jsonData = await services.converter.convert(exportData, 'json');
      
      // Parse back from JSON
      const parsedData = await services.converter.parse(jsonData, 'json');
      
      // Transform for import
      const importData = await services.transformer.transformForImport(parsedData);
      
      expect(importData).toHaveLength(data.data.length);
      expect(importData[0]).toHaveProperty('title');
      expect(importData[0]).toHaveProperty('problem');
      expect(importData[0]).toHaveProperty('solution');
    });

    test('should handle format conversion pipeline', async () => {
      const data = await kbService.list();
      
      // JSON -> CSV -> JSON conversion
      const jsonData = await services.converter.convert(data.data, 'json');
      const csvData = await services.converter.convert(data.data, 'csv');
      
      expect(typeof jsonData).toBe('string');
      expect(typeof csvData).toBe('string');
      expect(csvData).toContain('id,title,problem');
      
      // Parse back
      const parsedJson = await services.converter.parse(jsonData, 'json');
      const parsedCsv = await services.converter.parse(csvData, 'csv');
      
      expect(Array.isArray(parsedJson)).toBe(true);
      expect(Array.isArray(parsedCsv)).toBe(true);
    });
  });
});

export default {};