import { KnowledgeDB } from '../../../src/services/database/KnowledgeDB';
import { SearchService } from '../../../src/services/SearchService';
import { PerformanceMonitor } from './benchmark-runner';
import { promises as fs } from 'fs';
import path from 'path';

interface SearchPerformanceResult {
  operation: string;
  totalTime: number;
  avgTime: number;
  p95Time: number;
  p99Time: number;
  throughput: number;
  memoryUsage: number;
  errorRate: number;
}

describe('Search Performance Benchmarks', () => {
  let db: KnowledgeDB;
  let searchService: SearchService;
  let perfMonitor: PerformanceMonitor;
  let testDataPath: string;

  beforeAll(async () => {
    testDataPath = path.join(__dirname, '../../fixtures/performance-kb.db');
    
    // Clean slate for performance testing
    try {
      await fs.unlink(testDataPath);
    } catch {}
    
    db = new KnowledgeDB(testDataPath);
    searchService = new SearchService(db);
    perfMonitor = new PerformanceMonitor();
    
    // Seed with performance test data
    await seedPerformanceData();
  });

  afterAll(async () => {
    db.close();
    // Keep test DB for analysis if needed
  });

  describe('Search Response Time Requirements', () => {
    test('should search 1000+ entries in <1 second', async () => {
      const query = 'VSAM error status';
      const iterations = 100;
      const results: number[] = [];
      
      // Warm up
      await searchService.searchLocal(query);
      
      perfMonitor.startMemoryMonitoring();
      
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        const searchResults = await searchService.searchLocal(query);
        const endTime = performance.now();
        
        const responseTime = endTime - startTime;
        results.push(responseTime);
        
        expect(searchResults.length).toBeGreaterThan(0);
        expect(responseTime).toBeLessThan(1000); // <1s requirement
      }
      
      const perfResult = analyzePerformanceResults('search_1000_entries', results);
      expect(perfResult.p95Time).toBeLessThan(800); // P95 should be well under 1s
      expect(perfResult.avgTime).toBeLessThan(500); // Average should be <500ms
      
      perfMonitor.stopMemoryMonitoring();
      
      await logPerformanceResult(perfResult);
    });

    test('should handle fuzzy search with acceptable performance', async () => {
      const queries = [
        'S0C7 data exception',
        'JCL dataset not found',
        'DB2 SQL error -904',
        'VSAM file open failure',
        'CICS ASRA abend'
      ];
      
      const results: number[] = [];
      
      perfMonitor.startResourceMonitoring();
      
      for (const query of queries) {
        for (let i = 0; i < 20; i++) {
          const startTime = performance.now();
          await searchService.searchLocal(query);
          const endTime = performance.now();
          
          results.push(endTime - startTime);
        }
      }
      
      const perfResult = analyzePerformanceResults('fuzzy_search', results);
      expect(perfResult.p99Time).toBeLessThan(1500); // P99 <1.5s for fuzzy search
      expect(perfResult.avgTime).toBeLessThan(600);
      
      const resourceUsage = perfMonitor.stopResourceMonitoring();
      expect(resourceUsage.maxMemoryMB).toBeLessThan(256); // Memory constraint
      
      await logPerformanceResult(perfResult);
    });

    test('should maintain performance with category filtering', async () => {
      const categories = ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional'];
      const results: number[] = [];
      
      for (const category of categories) {
        for (let i = 0; i < 30; i++) {
          const startTime = performance.now();
          await searchService.searchByCategory(category);
          const endTime = performance.now();
          
          results.push(endTime - startTime);
        }
      }
      
      const perfResult = analyzePerformanceResults('category_search', results);
      expect(perfResult.avgTime).toBeLessThan(200); // Category search should be very fast
      expect(perfResult.p95Time).toBeLessThan(400);
      
      await logPerformanceResult(perfResult);
    });

    test('should handle tag-based search efficiently', async () => {
      const tags = ['vsam', 'abend', 'error', 'file', 'sql', 'jcl', 'batch'];
      const results: number[] = [];
      
      for (const tag of tags) {
        for (let i = 0; i < 20; i++) {
          const startTime = performance.now();
          await searchService.searchByTag(tag);
          const endTime = performance.now();
          
          results.push(endTime - startTime);
        }
      }
      
      const perfResult = analyzePerformanceResults('tag_search', results);
      expect(perfResult.avgTime).toBeLessThan(300);
      expect(perfResult.p95Time).toBeLessThan(500);
      
      await logPerformanceResult(perfResult);
    });
  });

  describe('Index Performance', () => {
    test('should build FTS index within time limits', async () => {
      const startTime = performance.now();
      
      // Trigger index rebuild
      await db.rebuildSearchIndex();
      
      const indexBuildTime = performance.now() - startTime;
      
      // Should build index for 1000+ entries in under 5 seconds
      expect(indexBuildTime).toBeLessThan(5000);
      
      await logPerformanceResult({
        operation: 'index_build',
        totalTime: indexBuildTime,
        avgTime: indexBuildTime,
        p95Time: indexBuildTime,
        p99Time: indexBuildTime,
        throughput: 1000 / (indexBuildTime / 1000),
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
        errorRate: 0
      });
    });

    test('should maintain search performance after index updates', async () => {
      const baselineResults: number[] = [];
      const postUpdateResults: number[] = [];
      
      // Baseline performance
      for (let i = 0; i < 50; i++) {
        const startTime = performance.now();
        await searchService.searchLocal('VSAM error');
        baselineResults.push(performance.now() - startTime);
      }
      
      // Add new entries
      for (let i = 0; i < 100; i++) {
        await db.addEntry({
          title: `New Test Entry ${i}`,
          problem: `Test problem ${i} with VSAM error patterns`,
          solution: `Test solution ${i}`,
          category: 'VSAM',
          tags: ['test', 'performance', 'vsam']
        });
      }
      
      // Post-update performance
      for (let i = 0; i < 50; i++) {
        const startTime = performance.now();
        await searchService.searchLocal('VSAM error');
        postUpdateResults.push(performance.now() - startTime);
      }
      
      const baseline = analyzePerformanceResults('baseline_search', baselineResults);
      const postUpdate = analyzePerformanceResults('post_update_search', postUpdateResults);
      
      // Performance should not degrade by more than 20%
      expect(postUpdate.avgTime).toBeLessThan(baseline.avgTime * 1.2);
      expect(postUpdate.p95Time).toBeLessThan(baseline.p95Time * 1.2);
    });
  });

  describe('Memory Usage Under Load', () => {
    test('should not exceed memory limits with large result sets', async () => {
      perfMonitor.startMemoryMonitoring();
      
      // Search queries that return many results
      const broadQueries = ['error', 'file', 'problem', 'solution', 'data'];
      
      for (const query of broadQueries) {
        const results = await searchService.searchLocal(query, 500); // Large limit
        expect(results.length).toBeGreaterThan(10);
      }
      
      const memoryStats = perfMonitor.stopMemoryMonitoring();
      
      // Should not exceed 512MB for 10k+ entries
      expect(memoryStats.maxMemoryMB).toBeLessThan(512);
      expect(memoryStats.memoryGrowthMB).toBeLessThan(100); // Minimal growth during search
    });

    test('should handle memory efficiently with concurrent searches', async () => {
      const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      
      // Simulate concurrent search load
      const concurrentSearches = Array.from({ length: 20 }, (_, i) => 
        searchService.searchLocal(`concurrent test ${i % 5}`)
      );
      
      await Promise.all(concurrentSearches);
      
      const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(50); // <50MB increase
    });
  });

  describe('Scalability Testing', () => {
    test('should scale linearly with dataset size', async () => {
      const dataSizes = [100, 500, 1000, 2000];
      const scaleResults: Array<{ size: number; avgTime: number }> = [];
      
      for (const size of dataSizes) {
        // Create dataset of specific size
        const testDb = new KnowledgeDB(':memory:');
        await seedDataset(testDb, size);
        const testSearchService = new SearchService(testDb);
        
        // Measure search performance
        const results: number[] = [];
        for (let i = 0; i < 20; i++) {
          const startTime = performance.now();
          await testSearchService.searchLocal('test query');
          results.push(performance.now() - startTime);
        }
        
        const perfResult = analyzePerformanceResults(`scale_${size}`, results);
        scaleResults.push({ size, avgTime: perfResult.avgTime });
        
        testDb.close();
      }
      
      // Check that performance scales reasonably (not exponentially)
      const ratio2000to100 = scaleResults[3].avgTime / scaleResults[0].avgTime;
      expect(ratio2000to100).toBeLessThan(5); // Should not be more than 5x slower for 20x data
      
      await logScalabilityResults(scaleResults);
    });
  });

  // Helper functions
  async function seedPerformanceData(): Promise<void> {
    const sampleEntries = [
      {
        title: 'VSAM Status 35 - File Not Found',
        problem: 'Job abends with VSAM status code 35. The program cannot open the VSAM file.',
        solution: 'Verify the dataset exists and is cataloged properly',
        category: 'VSAM',
        tags: ['vsam', 'status-35', 'file-not-found']
      },
      {
        title: 'S0C7 - Data Exception in COBOL',
        problem: 'Program abends with S0C7 data exception during arithmetic operations',
        solution: 'Check for non-numeric data in numeric fields',
        category: 'Batch',
        tags: ['s0c7', 'data-exception', 'numeric', 'abend']
      },
      {
        title: 'JCL Error - Dataset Not Found',
        problem: 'JCL fails with dataset not found error',
        solution: 'Verify dataset name and allocation',
        category: 'JCL',
        tags: ['jcl', 'dataset', 'not-found']
      }
    ];

    // Create 1000+ entries for performance testing
    for (let i = 0; i < 1000; i++) {
      const baseEntry = sampleEntries[i % sampleEntries.length];
      await db.addEntry({
        ...baseEntry,
        title: `${baseEntry.title} - Variation ${i}`,
        problem: `${baseEntry.problem} Additional details for entry ${i}`,
        tags: [...baseEntry.tags, `perf-test-${i}`]
      });
    }
  }

  async function seedDataset(database: KnowledgeDB, size: number): Promise<void> {
    for (let i = 0; i < size; i++) {
      await database.addEntry({
        title: `Test Entry ${i}`,
        problem: `Test problem ${i}`,
        solution: `Test solution ${i}`,
        category: ['JCL', 'VSAM', 'DB2', 'Batch'][i % 4],
        tags: [`test-${i}`, 'performance']
      });
    }
  }

  function analyzePerformanceResults(operation: string, times: number[]): SearchPerformanceResult {
    times.sort((a, b) => a - b);
    
    const totalTime = times.reduce((sum, time) => sum + time, 0);
    const avgTime = totalTime / times.length;
    const p95Index = Math.floor(times.length * 0.95);
    const p99Index = Math.floor(times.length * 0.99);
    
    return {
      operation,
      totalTime,
      avgTime,
      p95Time: times[p95Index],
      p99Time: times[p99Index],
      throughput: 1000 / avgTime, // operations per second
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
      errorRate: 0
    };
  }

  async function logPerformanceResult(result: SearchPerformanceResult): Promise<void> {
    const logPath = path.join(__dirname, '../../../performance-results.json');
    let existingResults: SearchPerformanceResult[] = [];
    
    try {
      const data = await fs.readFile(logPath, 'utf8');
      existingResults = JSON.parse(data);
    } catch {
      // File doesn't exist yet
    }
    
    existingResults.push({
      ...result,
      timestamp: new Date().toISOString()
    } as any);
    
    await fs.writeFile(logPath, JSON.stringify(existingResults, null, 2));
  }

  async function logScalabilityResults(results: Array<{ size: number; avgTime: number }>): Promise<void> {
    const logPath = path.join(__dirname, '../../../scalability-results.json');
    const data = {
      timestamp: new Date().toISOString(),
      results
    };
    
    await fs.writeFile(logPath, JSON.stringify(data, null, 2));
  }
});