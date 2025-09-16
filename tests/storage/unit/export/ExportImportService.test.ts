/**
 * Unit Tests for Export and Import Services
 * Tests data export/import functionality across different formats
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ExportService } from '../../../../src/services/storage/export/ExportService';
import { ImportService } from '../../../../src/services/storage/export/ImportService';
import { MockStorageAdapter } from '../../mocks/MockStorageAdapter';
import { createTestKBEntry, TestData, SAMPLE_KB_ENTRIES } from '../../fixtures/testData';
import * as fs from 'fs';
import * as path from 'path';

describe('Export and Import Services', () => {
  let exportService: ExportService;
  let importService: ImportService;
  let mockAdapter: MockStorageAdapter;
  let testDir: string;

  beforeEach(() => {
    testDir = path.join(__dirname, '..', '..', 'temp', 'export-import-test');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    mockAdapter = new MockStorageAdapter();
    exportService = new ExportService(mockAdapter as any);
    importService = new ImportService(mockAdapter as any);
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    jest.clearAllMocks();
  });

  describe('JSON Export/Import', () => {
    it('should export entries to JSON format', async () => {
      // Setup test data
      const testEntries = SAMPLE_KB_ENTRIES.map((entry, index) => ({
        ...entry,
        id: `test-id-${index}`,
        created_at: new Date(),
        updated_at: new Date(),
        usage_count: 0,
        success_count: 0,
        failure_count: 0,
        created_by: 'test'
      }));

      mockAdapter.setEntries(testEntries as any);

      const exportPath = path.join(testDir, 'export.json');
      await exportService.exportToFile(exportPath, 'json');

      expect(fs.existsSync(exportPath)).toBe(true);

      const exportedData = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
      expect(exportedData.entries).toHaveLength(testEntries.length);
      expect(exportedData.metadata).toBeDefined();
      expect(exportedData.metadata.version).toBeDefined();
      expect(exportedData.metadata.exportedAt).toBeDefined();
    });

    it('should import entries from JSON format', async () => {
      const importData = {
        version: '1.0',
        metadata: {
          exportedAt: new Date().toISOString(),
          source: 'test'
        },
        entries: SAMPLE_KB_ENTRIES
      };

      const importPath = path.join(testDir, 'import.json');
      fs.writeFileSync(importPath, JSON.stringify(importData));

      const result = await importService.importFromFile(importPath, 'json');

      expect(result.success).toBe(true);
      expect(result.entriesImported).toBe(SAMPLE_KB_ENTRIES.length);
      expect(result.errors).toHaveLength(0);
      expect(mockAdapter.getEntryCount()).toBe(SAMPLE_KB_ENTRIES.length);
    });

    it('should handle malformed JSON gracefully', async () => {
      const malformedPath = path.join(testDir, 'malformed.json');
      fs.writeFileSync(malformedPath, '{ invalid json content');

      const result = await importService.importFromFile(malformedPath, 'json');

      expect(result.success).toBe(false);
      expect(result.entriesImported).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Invalid JSON');
    });

    it('should validate JSON structure during import', async () => {
      const invalidStructure = {
        // Missing required fields
        data: ['not', 'an', 'object']
      };

      const invalidPath = path.join(testDir, 'invalid-structure.json');
      fs.writeFileSync(invalidPath, JSON.stringify(invalidStructure));

      const result = await importService.importFromFile(invalidPath, 'json');

      expect(result.success).toBe(false);
      expect(result.errors.some(error => error.includes('Invalid file structure'))).toBe(true);
    });

    it('should handle partial import failures in JSON', async () => {
      const mixedData = {
        version: '1.0',
        metadata: { source: 'test' },
        entries: [
          createTestKBEntry(), // Valid
          { ...createTestKBEntry(), title: '' }, // Invalid - empty title
          createTestKBEntry(), // Valid
          { ...createTestKBEntry(), category: 'INVALID' } // Invalid - bad category
        ]
      };

      const importPath = path.join(testDir, 'mixed-data.json');
      fs.writeFileSync(importPath, JSON.stringify(mixedData));

      const result = await importService.importFromFile(importPath, 'json');

      expect(result.success).toBe(false); // Overall failure due to some invalid entries
      expect(result.entriesImported).toBe(2); // Only valid entries imported
      expect(result.errors.length).toBe(2); // Two validation errors
    });
  });

  describe('CSV Export/Import', () => {
    it('should export entries to CSV format', async () => {
      const testEntries = SAMPLE_KB_ENTRIES.slice(0, 3).map((entry, index) => ({
        ...entry,
        id: `csv-test-id-${index}`,
        created_at: new Date(),
        updated_at: new Date(),
        usage_count: index + 1,
        success_count: index,
        failure_count: 0,
        created_by: 'test'
      }));

      mockAdapter.setEntries(testEntries as any);

      const exportPath = path.join(testDir, 'export.csv');
      await exportService.exportToFile(exportPath, 'csv');

      expect(fs.existsSync(exportPath)).toBe(true);

      const csvContent = fs.readFileSync(exportPath, 'utf8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      expect(lines.length).toBe(4); // Header + 3 data rows
      expect(lines[0]).toContain('title,problem,solution,category,tags');
    });

    it('should import entries from CSV format', async () => {
      const csvContent = `title,problem,solution,category,tags
"CSV Test Entry 1","Test problem 1","Test solution 1","JCL","tag1,tag2"
"CSV Test Entry 2","Test problem 2","Test solution 2","VSAM","tag3,tag4"
"CSV Test Entry 3","Test problem 3","Test solution 3","DB2","tag5"`;

      const importPath = path.join(testDir, 'import.csv');
      fs.writeFileSync(importPath, csvContent);

      const result = await importService.importFromFile(importPath, 'csv');

      expect(result.success).toBe(true);
      expect(result.entriesImported).toBe(3);
      expect(result.errors).toHaveLength(0);
      expect(mockAdapter.getEntryCount()).toBe(3);
    });

    it('should handle CSV with escaped characters', async () => {
      const csvWithEscapes = `title,problem,solution,category,tags
"Entry with ""quotes""","Problem with, comma","Solution with
newline","JCL","tag1"
"Entry with semicolon;","Problem text","Solution text","VSAM","tag2,tag3"`;

      const importPath = path.join(testDir, 'escaped.csv');
      fs.writeFileSync(importPath, csvWithEscapes);

      const result = await importService.importFromFile(importPath, 'csv');

      expect(result.success).toBe(true);
      expect(result.entriesImported).toBe(2);
      
      const entries = mockAdapter.getAllEntries();
      expect(entries[0].title).toBe('Entry with "quotes"');
      expect(entries[0].problem).toBe('Problem with, comma');
    });

    it('should validate CSV headers', async () => {
      const invalidHeaders = `invalid,headers,here
"Entry 1","Problem 1","Solution 1"`;

      const importPath = path.join(testDir, 'invalid-headers.csv');
      fs.writeFileSync(importPath, invalidHeaders);

      const result = await importService.importFromFile(importPath, 'csv');

      expect(result.success).toBe(false);
      expect(result.errors.some(error => error.includes('Invalid CSV headers'))).toBe(true);
    });

    it('should handle malformed CSV rows', async () => {
      const malformedCsv = `title,problem,solution,category,tags
"Valid Entry","Valid Problem","Valid Solution","JCL","tag1"
"Missing Fields","Only Two Fields"
"Valid Entry 2","Valid Problem 2","Valid Solution 2","VSAM","tag2"`;

      const importPath = path.join(testDir, 'malformed.csv');
      fs.writeFileSync(importPath, malformedCsv);

      const result = await importService.importFromFile(importPath, 'csv');

      expect(result.success).toBe(false); // Overall failure due to malformed row
      expect(result.entriesImported).toBe(2); // Valid rows imported
      expect(result.errors.length).toBe(1); // One malformed row error
    });
  });

  describe('XML Export/Import', () => {
    it('should export entries to XML format', async () => {
      const testEntries = SAMPLE_KB_ENTRIES.slice(0, 2).map((entry, index) => ({
        ...entry,
        id: `xml-test-id-${index}`,
        created_at: new Date(),
        updated_at: new Date(),
        usage_count: 0,
        success_count: 0,
        failure_count: 0,
        created_by: 'test'
      }));

      mockAdapter.setEntries(testEntries as any);

      const exportPath = path.join(testDir, 'export.xml');
      await exportService.exportToFile(exportPath, 'xml');

      expect(fs.existsSync(exportPath)).toBe(true);

      const xmlContent = fs.readFileSync(exportPath, 'utf8');
      expect(xmlContent).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xmlContent).toContain('<knowledgebase>');
      expect(xmlContent).toContain('<entry>');
      expect(xmlContent).toContain('<title>');
      expect(xmlContent).toContain('</knowledgebase>');
    });

    it('should import entries from XML format', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<knowledgebase>
  <metadata>
    <version>1.0</version>
    <exportedAt>2023-01-01T00:00:00.000Z</exportedAt>
  </metadata>
  <entries>
    <entry>
      <title>XML Test Entry</title>
      <problem>XML test problem</problem>
      <solution>XML test solution</solution>
      <category>JCL</category>
      <tags>
        <tag>xml</tag>
        <tag>test</tag>
      </tags>
    </entry>
  </entries>
</knowledgebase>`;

      const importPath = path.join(testDir, 'import.xml');
      fs.writeFileSync(importPath, xmlContent);

      const result = await importService.importFromFile(importPath, 'xml');

      expect(result.success).toBe(true);
      expect(result.entriesImported).toBe(1);
      expect(result.errors).toHaveLength(0);
      
      const entries = mockAdapter.getAllEntries();
      expect(entries[0].title).toBe('XML Test Entry');
      expect(entries[0].tags).toEqual(['xml', 'test']);
    });

    it('should handle malformed XML', async () => {
      const malformedXml = `<?xml version="1.0"?>
<knowledgebase>
  <entry>
    <title>Unclosed tag
  </entry>
</knowledgebase>`;

      const importPath = path.join(testDir, 'malformed.xml');
      fs.writeFileSync(importPath, malformedXml);

      const result = await importService.importFromFile(importPath, 'xml');

      expect(result.success).toBe(false);
      expect(result.errors.some(error => error.includes('XML parsing error'))).toBe(true);
    });

    it('should handle XML with CDATA sections', async () => {
      const xmlWithCData = `<?xml version="1.0" encoding="UTF-8"?>
<knowledgebase>
  <metadata>
    <version>1.0</version>
  </metadata>
  <entries>
    <entry>
      <title>CDATA Test Entry</title>
      <problem><![CDATA[Problem with <special> characters & symbols]]></problem>
      <solution><![CDATA[Solution with "quotes" and 'apostrophes']]></solution>
      <category>JCL</category>
      <tags>
        <tag>cdata</tag>
      </tags>
    </entry>
  </entries>
</knowledgebase>`;

      const importPath = path.join(testDir, 'cdata.xml');
      fs.writeFileSync(importPath, xmlWithCData);

      const result = await importService.importFromFile(importPath, 'xml');

      expect(result.success).toBe(true);
      expect(result.entriesImported).toBe(1);
      
      const entries = mockAdapter.getAllEntries();
      expect(entries[0].problem).toBe('Problem with <special> characters & symbols');
      expect(entries[0].solution).toBe('Solution with "quotes" and \'apostrophes\'');
    });
  });

  describe('Export Options and Filtering', () => {
    beforeEach(() => {
      const testEntries = [
        { ...createTestKBEntry(), id: '1', category: 'JCL', tags: ['jcl', 'batch'] },
        { ...createTestKBEntry(), id: '2', category: 'VSAM', tags: ['vsam', 'file'] },
        { ...createTestKBEntry(), id: '3', category: 'DB2', tags: ['db2', 'database'] },
        { ...createTestKBEntry(), id: '4', category: 'JCL', tags: ['jcl', 'error'] }
      ].map(entry => ({
        ...entry,
        created_at: new Date(),
        updated_at: new Date(),
        usage_count: 0,
        success_count: 0,
        failure_count: 0,
        created_by: 'test'
      }));

      mockAdapter.setEntries(testEntries as any);
    });

    it('should export with category filter', async () => {
      const exportPath = path.join(testDir, 'filtered-category.json');
      
      await exportService.exportToFile(exportPath, 'json', {
        filters: { category: 'JCL' }
      });

      const exportedData = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
      expect(exportedData.entries).toHaveLength(2); // Only JCL entries
      expect(exportedData.entries.every((e: any) => e.category === 'JCL')).toBe(true);
    });

    it('should export with tag filter', async () => {
      const exportPath = path.join(testDir, 'filtered-tags.json');
      
      await exportService.exportToFile(exportPath, 'json', {
        filters: { tags: ['database'] }
      });

      const exportedData = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
      expect(exportedData.entries).toHaveLength(1); // Only DB2 entry
      expect(exportedData.entries[0].category).toBe('DB2');
    });

    it('should export with date range filter', async () => {
      const exportPath = path.join(testDir, 'filtered-date.json');
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      await exportService.exportToFile(exportPath, 'json', {
        dateRange: {
          start: yesterday,
          end: tomorrow
        }
      });

      const exportedData = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
      expect(exportedData.entries.length).toBeGreaterThan(0); // All entries within range
    });

    it('should export with field selection', async () => {
      const exportPath = path.join(testDir, 'selected-fields.json');
      
      await exportService.exportToFile(exportPath, 'json', {
        includeFields: ['title', 'category', 'tags']
      });

      const exportedData = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
      expect(exportedData.entries[0]).toHaveProperty('title');
      expect(exportedData.entries[0]).toHaveProperty('category');
      expect(exportedData.entries[0]).toHaveProperty('tags');
      expect(exportedData.entries[0]).not.toHaveProperty('problem');
      expect(exportedData.entries[0]).not.toHaveProperty('solution');
    });

    it('should export with metadata inclusion', async () => {
      const exportPath = path.join(testDir, 'with-metadata.json');
      
      await exportService.exportToFile(exportPath, 'json', {
        includeMetadata: true
      });

      const exportedData = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
      expect(exportedData.metadata).toBeDefined();
      expect(exportedData.metadata.totalEntries).toBeDefined();
      expect(exportedData.metadata.filters).toBeDefined();
      expect(exportedData.metadata.exportOptions).toBeDefined();
    });
  });

  describe('Batch Operations', () => {
    it('should handle large export operations efficiently', async () => {
      const largeDataset = TestData.createPerformanceTestData(1000);
      const testEntries = largeDataset.map((entry, index) => ({
        ...entry,
        id: `large-${index}`,
        created_at: new Date(),
        updated_at: new Date(),
        usage_count: 0,
        success_count: 0,
        failure_count: 0,
        created_by: 'test'
      }));

      mockAdapter.setEntries(testEntries as any);

      const exportPath = path.join(testDir, 'large-export.json');
      
      const startTime = Date.now();
      await exportService.exportToFile(exportPath, 'json');
      const exportTime = Date.now() - startTime;

      expect(fs.existsSync(exportPath)).toBe(true);
      expect(exportTime).toBeLessThan(10000); // Should complete within 10 seconds

      const exportedData = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
      expect(exportedData.entries).toHaveLength(1000);
    });

    it('should handle large import operations with progress tracking', async () => {
      const largeDataset = TestData.createBatchKBEntries(500);
      const importData = {
        version: '1.0',
        metadata: { source: 'large-test' },
        entries: largeDataset
      };

      const importPath = path.join(testDir, 'large-import.json');
      fs.writeFileSync(importPath, JSON.stringify(importData));

      const progressUpdates: number[] = [];
      const result = await importService.importFromFile(importPath, 'json', {
        onProgress: (progress) => progressUpdates.push(progress)
      });

      expect(result.success).toBe(true);
      expect(result.entriesImported).toBe(500);
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100); // Final progress should be 100%
    });

    it('should handle batch import with validation', async () => {
      const mixedDataset = [
        ...TestData.createBatchKBEntries(10), // Valid entries
        { title: '', problem: 'Invalid', solution: 'Invalid', category: 'JCL' }, // Invalid
        ...TestData.createBatchKBEntries(5) // More valid entries
      ];

      const importData = {
        version: '1.0',
        metadata: { source: 'validation-test' },
        entries: mixedDataset
      };

      const importPath = path.join(testDir, 'validation-test.json');
      fs.writeFileSync(importPath, JSON.stringify(importData));

      const result = await importService.importFromFile(importPath, 'json', {
        continueOnError: true,
        validateEntries: true
      });

      expect(result.success).toBe(false); // Overall failure due to invalid entry
      expect(result.entriesImported).toBe(15); // Valid entries still imported
      expect(result.errors.length).toBe(1); // One validation error
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle file permission errors', async () => {
      const restrictedPath = path.join(testDir, 'restricted');
      
      // Create restricted directory (this might not work on all systems)
      try {
        fs.mkdirSync(restrictedPath, { mode: 0o000 });
        
        const exportPath = path.join(restrictedPath, 'export.json');
        
        await expect(exportService.exportToFile(exportPath, 'json'))
          .rejects.toThrow();
      } catch (error) {
        // If we can't create restricted directory, skip this test
        console.log('Skipping permission test - unable to create restricted directory');
      }
    });

    it('should handle disk space errors gracefully', async () => {
      // Mock filesystem to simulate disk full
      const originalWriteFileSync = fs.writeFileSync;
      fs.writeFileSync = jest.fn().mockImplementation(() => {
        throw new Error('ENOSPC: no space left on device');
      });

      try {
        const exportPath = path.join(testDir, 'export.json');
        await expect(exportService.exportToFile(exportPath, 'json'))
          .rejects.toThrow('ENOSPC');
      } finally {
        fs.writeFileSync = originalWriteFileSync;
      }
    });

    it('should handle database errors during export', async () => {
      mockAdapter.search = jest.fn().mockRejectedValue(new Error('Database connection lost'));

      const exportPath = path.join(testDir, 'export.json');
      
      await expect(exportService.exportToFile(exportPath, 'json'))
        .rejects.toThrow('Database connection lost');
    });

    it('should provide detailed error information', async () => {
      const invalidData = {
        version: '1.0',
        entries: [
          { title: 'Valid', problem: 'Valid', solution: 'Valid', category: 'JCL' },
          { title: '', problem: 'Invalid title', solution: 'Solution', category: 'VSAM' },
          { title: 'Valid', problem: 'Valid', solution: '', category: 'DB2' }
        ]
      };

      const importPath = path.join(testDir, 'error-details.json');
      fs.writeFileSync(importPath, JSON.stringify(invalidData));

      const result = await importService.importFromFile(importPath, 'json');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBe(2);
      expect(result.errors[0]).toContain('Entry 2'); // Error should reference entry number
      expect(result.errors[1]).toContain('Entry 3');
    });
  });

  describe('Format Conversion', () => {
    it('should convert between formats via export/import', async () => {
      // Setup test data
      const testEntries = SAMPLE_KB_ENTRIES.slice(0, 3).map((entry, index) => ({
        ...entry,
        id: `convert-${index}`,
        created_at: new Date(),
        updated_at: new Date(),
        usage_count: 0,
        success_count: 0,
        failure_count: 0,
        created_by: 'test'
      }));

      mockAdapter.setEntries(testEntries as any);

      // Export to JSON
      const jsonPath = path.join(testDir, 'convert.json');
      await exportService.exportToFile(jsonPath, 'json');

      // Clear data
      mockAdapter.setEntries([]);

      // Import from JSON
      await importService.importFromFile(jsonPath, 'json');

      // Export to CSV
      const csvPath = path.join(testDir, 'converted.csv');
      await exportService.exportToFile(csvPath, 'csv');

      // Verify CSV file was created and has content
      expect(fs.existsSync(csvPath)).toBe(true);
      const csvContent = fs.readFileSync(csvPath, 'utf8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      expect(lines.length).toBe(4); // Header + 3 entries
    });

    it('should preserve data integrity across format conversions', async () => {
      const originalEntry = {
        ...createTestKBEntry(),
        id: 'integrity-test',
        title: 'Special chars: "quotes", commas, and\nnewlines',
        problem: 'Problem with <xml> & special chars',
        solution: 'Solution with various symbols: @#$%^&*()',
        tags: ['special-chars', 'integrity-test', 'conversion'],
        created_at: new Date(),
        updated_at: new Date(),
        usage_count: 42,
        success_count: 38,
        failure_count: 4,
        created_by: 'integrity-tester'
      };

      mockAdapter.setEntries([originalEntry] as any);

      // Export to JSON
      const jsonPath = path.join(testDir, 'integrity.json');
      await exportService.exportToFile(jsonPath, 'json');

      // Clear and import
      mockAdapter.setEntries([]);
      await importService.importFromFile(jsonPath, 'json');

      // Verify data integrity
      const importedEntries = mockAdapter.getAllEntries();
      expect(importedEntries).toHaveLength(1);
      
      const imported = importedEntries[0];
      expect(imported.title).toBe(originalEntry.title);
      expect(imported.problem).toBe(originalEntry.problem);
      expect(imported.solution).toBe(originalEntry.solution);
      expect(imported.tags).toEqual(originalEntry.tags);
    });
  });
});