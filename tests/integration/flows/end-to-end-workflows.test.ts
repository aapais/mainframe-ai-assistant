/**
 * End-to-End Workflow Integration Tests
 * Tests complete user scenarios and business workflows from start to finish
 */

import { KnowledgeBaseService } from '../../../src/services/KnowledgeBaseService';
import { GeminiService } from '../../../src/services/GeminiService';
import { MetricsService } from '../../../src/services/MetricsService';
import { CacheService } from '../../../src/services/CacheService';
import { KBEntry, KBEntryInput, SearchResult, ServiceConfig } from '../../../src/types/services';
import { EventEmitter } from 'events';

// Test configuration for E2E scenarios
const E2E_CONFIG: ServiceConfig = {
  database: {
    path: ':memory:',
    pragmas: {
      journal_mode: 'WAL',
      synchronous: 'NORMAL',
      cache_size: -4000,
      temp_store: 'memory'
    },
    backup: {
      enabled: false,
      interval: 60000,
      retention: 7,
      path: './test-backups'
    },
    performance: {
      connectionPool: 1,
      busyTimeout: 10000,
      cacheSize: 4000
    }
  },
  search: {
    fts: {
      tokenize: 'porter',
      remove_diacritics: 1,
      categories: 'JCL,VSAM,DB2,Batch,Functional,CICS,IMS,System,Other'
    },
    ai: {
      enabled: true,
      fallback: true,
      timeout: 15000,
      retries: 3,
      batchSize: 30
    },
    cache: {
      enabled: true,
      ttl: 600000,
      maxSize: 200
    }
  },
  cache: {
    maxSize: 2000,
    ttl: 600000,
    checkPeriod: 60000,
    strategy: 'lru' as const,
    persistent: false
  },
  metrics: {
    enabled: true,
    retention: 172800000, // 48 hours
    aggregation: {
      enabled: true,
      interval: 10000,
      batch: 50
    },
    alerts: {
      enabled: true,
      thresholds: {
        search_response_time: 3000,
        error_rate: 0.1,
        low_success_rate: 0.5
      }
    }
  },
  validation: {
    strict: true,
    sanitize: true,
    maxLength: {
      title: 200,
      problem: 5000,
      solution: 10000,
      tags: 50
    },
    minLength: {
      title: 5,
      problem: 10,
      solution: 10
    },
    patterns: {
      tag: /^[a-zA-Z0-9_-]+$/,
      category: ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'CICS', 'IMS', 'System', 'Other']
    }
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || 'test-key',
    model: 'gemini-pro',
    temperature: 0.3,
    maxTokens: 2048,
    timeout: 15000,
    rateLimit: {
      requests: 100,
      window: 60000
    }
  },
  logging: {
    level: 'warn' as const,
    file: {
      enabled: false,
      path: './logs/e2e-test.log',
      maxSize: 10485760,
      maxFiles: 5
    },
    console: false,
    structured: false
  }
};

// Comprehensive test data representing real mainframe scenarios
const createMainframeKnowledgeBase = (): KBEntryInput[] => [
  // VSAM Issues
  {
    title: 'VSAM Status 35 - Dataset Not Found',
    problem: 'Job DAILY001 fails with VSAM status code 35 when trying to open CUST.MASTER.FILE. Error occurs during batch processing at 02:00 AM.',
    solution: '1. Check if dataset exists using LISTCAT ENTRIES(\'CUST.MASTER.FILE\')\n2. Verify DD statement points to correct dataset name\n3. Check if file was accidentally deleted by cleanup job\n4. Verify catalog integrity with DIAGNOSE command\n5. If uncataloged, recatalog using DEFINE CLUSTER\n6. Check RACF permissions with LISTDSD command',
    category: 'VSAM',
    tags: ['vsam', 'status-35', 'dataset-not-found', 'batch', 'catalog'],
    created_by: 'support-team'
  },
  {
    title: 'VSAM Status 37 - Out of Space',
    problem: 'CUSTOMER.UPDATE job abends with VSAM status 37. File appears to be full during high-volume processing periods.',
    solution: '1. Check space allocation: LISTCAT ENTRIES(\'datasetname\') ALL\n2. Extend primary/secondary space using ALTER command\n3. Add volumes if needed: ALTER CLUSTER(name) ADDVOLUMES(vol001)\n4. Monitor space usage with IDCAMS PRINT\n5. Consider reorganization if fragmented\n6. Review space management policies',
    category: 'VSAM',
    tags: ['vsam', 'status-37', 'out-of-space', 'extend', 'volume'],
    created_by: 'storage-admin'
  },

  // JCL Problems
  {
    title: 'JCL Error IEF212I - Dataset Not Found',
    problem: 'Production job PAYROLL fails with IEF212I error. Dataset PAYROLL.MASTER.G0001V00 cannot be found during step STEP01.',
    solution: '1. Verify GDG base exists: LISTCAT ENTRIES(\'PAYROLL.MASTER\')\n2. Check if generation exists: LISTCAT ENTRIES(\'PAYROLL.MASTER.G****V00\')\n3. Verify GDG limit not exceeded\n4. Check if previous job created the generation\n5. Review DISP parameters in JCL\n6. Validate UNIT and VOL parameters if uncataloged',
    category: 'JCL',
    tags: ['jcl', 'ief212i', 'gdg', 'payroll', 'dataset'],
    created_by: 'operations'
  },
  {
    title: 'JCL ABEND S806 - Program Not Found',
    problem: 'Job fails immediately with S806 abend. Program CUSTUPDT cannot be found in any library.',
    solution: '1. Check STEPLIB concatenation in JCL\n2. Verify program exists: LISTDS \'loadlib.name\' MEMBERS\n3. Check JOBLIB if no STEPLIB specified\n4. Verify program name spelling (case sensitive)\n5. Check if program was recently moved or deleted\n6. Review linklist if no explicit libraries specified\n7. Ensure proper APF authorization if required',
    category: 'JCL',
    tags: ['jcl', 's806', 'program-not-found', 'steplib', 'load-library'],
    created_by: 'systems-programmer'
  },

  // COBOL/Batch Abends
  {
    title: 'S0C7 Data Exception in COBOL Program',
    problem: 'COBOL program ACCT001 abends with S0C7 data exception at offset X\'00012A4\'. Occurs during arithmetic operations with customer balance fields.',
    solution: '1. Check compile listing for offset X\'00012A4\' to identify statement\n2. Examine numeric fields involved in arithmetic:\n   - Initialize all COMP-3/PACKED fields properly\n   - Use INITIALIZE or VALUE clauses\n3. Add NUMERIC test before arithmetic operations\n4. Check input data for invalid packed decimal\n5. Use NUMPROC(NOPFD) compiler option to prevent abend\n6. Add ON SIZE ERROR clause to arithmetic statements\n7. Display field contents before arithmetic for debugging',
    category: 'Batch',
    tags: ['s0c7', 'data-exception', 'cobol', 'arithmetic', 'packed-decimal'],
    created_by: 'developer'
  },
  {
    title: 'S0C4 Protection Exception - Array Bounds',
    problem: 'Program REPT001 gets S0C4 protection violation when processing large customer files. Error occurs in table lookup routine.',
    solution: '1. Check array subscript bounds in compile listing\n2. Verify OCCURS clause matches actual usage\n3. Add bounds checking before table references\n4. Use SEARCH/SEARCH ALL for table lookups\n5. Initialize table indexes properly\n6. Check for REDEFINES overlay issues\n7. Verify working storage not corrupted\n8. Use runtime bounds checking option',
    category: 'Batch',
    tags: ['s0c4', 'protection-exception', 'array-bounds', 'table-lookup', 'cobol'],
    created_by: 'developer'
  },

  // DB2 Issues
  {
    title: 'DB2 SQLCODE -904 Resource Unavailable',
    problem: 'Online application receives SQLCODE -904 during peak hours. CUSTOMER_TBL appears unavailable for queries.',
    solution: '1. Check tablespace status: -DIS DATABASE(CUSTDB) SPACE(*)\n2. Resolve pending states:\n   - COPY pending: Run IMAGE COPY utility\n   - REORG pending: Run REORG utility\n   - RECOVER pending: Run RECOVER utility\n3. Check for locks: -DIS DATABASE(CUSTDB) LOCKS\n4. Monitor buffer pool usage: -DIS BUFFERPOOL(*)\n5. Check for utility jobs running\n6. Review exception messages in MSTR log',
    category: 'DB2',
    tags: ['db2', 'sqlcode-904', 'resource-unavailable', 'tablespace', 'pending'],
    created_by: 'dba'
  },
  {
    title: 'DB2 SQLCODE -818 Plan/Package Mismatch',
    problem: 'CICS transaction CUST fails with SQLCODE -818. Application was recently recompiled and relinked.',
    solution: '1. Rebind package: BIND PACKAGE(collection.package) MEMBER(source)\n2. Rebind plan: BIND PLAN(planname) PKLIST(collection.*)\n3. Verify DBRM timestamp matches load module\n4. Check bind options match original\n5. Ensure package collection is correct\n6. Refresh plan in CICS: CEMT S PLAN(name) NEW\n7. Verify precompiler options consistency',
    category: 'DB2',
    tags: ['db2', 'sqlcode-818', 'plan-package', 'bind', 'cics'],
    created_by: 'dba'
  },

  // System Issues
  {
    title: 'High CPU Usage During Peak Hours',
    problem: 'System experiences 90%+ CPU utilization between 9AM-11AM. Response times degrade significantly affecting online users.',
    solution: '1. Identify top CPU consumers: RMF reports, SYSVIEW\n2. Check for CPU-intensive batch jobs running\n3. Review WLM service class definitions\n4. Analyze SMF records for resource usage patterns\n5. Consider workload scheduling adjustments\n6. Review system parameters (IEASYSxx)\n7. Check for infinite loops in applications\n8. Consider capacity planning recommendations',
    category: 'System',
    tags: ['cpu', 'performance', 'peak-hours', 'rmf', 'wlm'],
    created_by: 'performance-analyst'
  },
  {
    title: 'Storage Shortage ABEND 80A',
    problem: 'Jobs failing with ABEND 80A during month-end processing. Region sizes appear insufficient for large volume processing.',
    solution: '1. Increase REGION parameter: REGION=0M for unlimited\n2. Review storage usage in job output\n3. Check for storage leaks in programs\n4. Use IEFBR14 step to verify syntax before increasing\n5. Consider MEMLIMIT for above-the-bar storage\n6. Review virtual storage usage patterns\n7. Split large jobs into smaller steps\n8. Optimize program storage usage',
    category: 'System',
    tags: ['storage', 'abend-80a', 'region', 'month-end', 'memory'],
    created_by: 'systems-programmer'
  },

  // CICS Issues
  {
    title: 'CICS ASRA Abend 0C4 in Transaction',
    problem: 'CICS transaction INVQ abends with ASRA 0C4. Error occurs when accessing customer inventory data. Transaction dump shows storage violation.',
    solution: '1. Review transaction dump at offset shown\n2. Check WORKING-STORAGE initialization\n3. Verify COMMAREA length matches calling program\n4. Check for uninitialized pointers or addresses\n5. Review CICS storage violations with CEDF\n6. Validate DFHCOMMAREA usage\n7. Check copybook alignment issues\n8. Use CEMT I TASK to monitor active tasks',
    category: 'CICS',
    tags: ['cics', 'asra', '0c4', 'storage-violation', 'commarea'],
    created_by: 'cics-admin'
  }
];

// Mock implementations for comprehensive testing
class EnhancedMockValidation {
  validateEntry(entry: KBEntryInput) {
    const errors: Array<{field: string, message: string}> = [];
    
    if (!entry.title || entry.title.length < 5) {
      errors.push({ field: 'title', message: 'Title must be at least 5 characters' });
    }
    
    if (!entry.problem || entry.problem.length < 10) {
      errors.push({ field: 'problem', message: 'Problem must be at least 10 characters' });
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  validateUpdate(updates: any) {
    return { valid: true, errors: [] };
  }

  validateBatch(entries: KBEntryInput[]) {
    return entries.map(entry => this.validateEntry(entry));
  }
}

class EnhancedMockSearchService {
  private eventEmitter = new EventEmitter();

  async search(query: string, entries: KBEntry[], options?: any): Promise<SearchResult[]> {
    const startTime = Date.now();
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 10));
    
    const queryLower = query.toLowerCase();
    const keywords = queryLower.split(/\s+/).filter(k => k.length > 2);
    
    const results = entries
      .map(entry => {
        const text = `${entry.title} ${entry.problem} ${entry.solution} ${entry.tags?.join(' ')}`.toLowerCase();
        let score = 0;
        
        // Exact phrase match
        if (text.includes(queryLower)) {
          score += 60;
        }
        
        // Individual keyword matches
        keywords.forEach(keyword => {
          if (entry.title.toLowerCase().includes(keyword)) score += 25;
          if (entry.problem.toLowerCase().includes(keyword)) score += 15;
          if (entry.solution.toLowerCase().includes(keyword)) score += 10;
          if (entry.category.toLowerCase().includes(keyword)) score += 20;
          if (entry.tags?.some(tag => tag.toLowerCase().includes(keyword))) score += 15;
        });
        
        // Error code specific matching
        const errorCodePattern = /[SA-Z]\d{3,4}[A-Z]?/g;
        const queryErrorCodes = queryLower.match(errorCodePattern) || [];
        const entryErrorCodes = text.match(errorCodePattern) || [];
        
        queryErrorCodes.forEach(code => {
          if (entryErrorCodes.includes(code)) {
            score += 80; // High score for exact error code match
          }
        });
        
        // Success rate boost
        const successRate = entry.success_count && (entry.success_count + (entry.failure_count || 0)) > 0
          ? entry.success_count / (entry.success_count + (entry.failure_count || 0))
          : 0.5;
        score *= (0.5 + successRate);
        
        const processingTime = Date.now() - startTime;
        
        return score > 10 ? {
          entry,
          score: Math.round(score),
          matchType: score > 60 ? 'exact' : 'fuzzy' as const,
          highlights: this.extractHighlights(entry, keywords),
          metadata: { 
            processingTime,
            matchedKeywords: keywords.filter(k => text.includes(k)),
            errorCodes: entryErrorCodes
          }
        } : null;
      })
      .filter(Boolean) as SearchResult[];

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, options?.limit || 20);
  }

  private extractHighlights(entry: KBEntry, keywords: string[]): string[] {
    const highlights: string[] = [];
    
    keywords.forEach(keyword => {
      if (entry.title.toLowerCase().includes(keyword)) {
        highlights.push(`Title: ${entry.title}`);
      }
      if (entry.problem.toLowerCase().includes(keyword) && highlights.length < 3) {
        const sentence = this.extractSentence(entry.problem, keyword);
        if (sentence) highlights.push(`Problem: ${sentence}`);
      }
    });
    
    return highlights.slice(0, 3);
  }

  private extractSentence(text: string, keyword: string): string | null {
    const sentences = text.split(/[.!?]+/);
    const matchingSentence = sentences.find(s => 
      s.toLowerCase().includes(keyword.toLowerCase())
    );
    return matchingSentence ? matchingSentence.trim() + '.' : null;
  }

  async searchWithAI(query: string, entries: KBEntry[], options?: any): Promise<SearchResult[]> {
    // Simulate AI enhancement with better semantic matching
    const basicResults = await this.search(query, entries, options);
    
    // Enhance results with AI-like semantic improvements
    const enhancedResults = basicResults.map(result => ({
      ...result,
      score: Math.min(100, result.score + 5), // Slight boost for AI
      matchType: 'ai' as const,
      highlights: [
        ...(result.highlights || []),
        `AI Enhancement: High relevance for "${query}"`
      ].slice(0, 3)
    }));
    
    return enhancedResults;
  }
}

describe('End-to-End Workflow Integration Tests', () => {
  let kbService: KnowledgeBaseService;
  let geminiService: GeminiService;
  let metricsService: MetricsService;
  let cacheService: CacheService;
  let mockValidation: EnhancedMockValidation;
  let mockSearch: EnhancedMockSearchService;
  let knowledgeBase: KBEntry[];

  beforeAll(async () => {
    // Initialize all services
    mockValidation = new EnhancedMockValidation();
    mockSearch = new EnhancedMockSearchService();
    cacheService = new CacheService(E2E_CONFIG.cache);
    metricsService = new MetricsService(E2E_CONFIG.metrics, ':memory:');
    
    if (E2E_CONFIG.gemini) {
      geminiService = new GeminiService(E2E_CONFIG.gemini);
    }

    kbService = new KnowledgeBaseService(
      E2E_CONFIG,
      mockValidation as any,
      mockSearch as any,
      cacheService,
      metricsService,
      undefined
    );

    await kbService.initialize();
    
    // Load comprehensive knowledge base
    const kbData = createMainframeKnowledgeBase();
    const ids = await kbService.createBatch(kbData);
    knowledgeBase = await kbService.readBatch(ids);
    
    console.log(`Loaded ${knowledgeBase.length} entries for E2E testing`);
  });

  afterAll(async () => {
    await kbService?.close();
    await cacheService?.clear();
    await metricsService?.close();
  });

  describe('Complete Support Workflow: Problem → Search → Solution → Feedback', () => {
    test('Scenario 1: Support analyst resolves VSAM error', async () => {
      const userId = 'analyst-001';
      const sessionId = `session-${Date.now()}`;
      
      // 1. Analyst receives problem report
      const problemReport = 'Customer job failing with VSAM status 35 error, cannot open file';
      
      // 2. Analyst searches for solution
      const searchResults = await kbService.search(problemReport, {
        userId,
        sessionId,
        useAI: true
      });
      
      expect(searchResults.length).toBeGreaterThan(0);
      
      // Should find VSAM status 35 entry as top result
      const topResult = searchResults[0];
      expect(topResult.entry.title).toContain('VSAM Status 35');
      expect(topResult.score).toBeGreaterThan(50);
      
      // 3. Analyst views detailed solution
      const detailedEntry = await kbService.read(topResult.entry.id);
      expect(detailedEntry).toBeTruthy();
      expect(detailedEntry!.solution).toContain('LISTCAT');
      
      // 4. Solution is applied successfully
      await kbService.recordUsage(topResult.entry.id, true, userId);
      
      // 5. Verify metrics were recorded
      const metrics = await metricsService.getMetrics('1h');
      expect(metrics.searches.totalSearches).toBeGreaterThan(0);
      
      // 6. Check entry statistics updated
      const updatedEntry = await kbService.read(topResult.entry.id);
      expect(updatedEntry!.usage_count).toBeGreaterThan(0);
      expect(updatedEntry!.success_count).toBeGreaterThan(0);
    });

    test('Scenario 2: Complex multi-step problem resolution', async () => {
      const userId = 'senior-analyst-002';
      const sessionId = `session-${Date.now()}`;
      
      // 1. Complex problem: S0C7 in batch job affecting payroll
      const complexProblem = 'Payroll batch job ABEND S0C7 data exception during customer balance calculation';
      
      // 2. Initial search
      let searchResults = await kbService.search(complexProblem, {
        userId,
        sessionId,
        category: 'Batch'
      });
      
      expect(searchResults.length).toBeGreaterThan(0);
      
      // Should find S0C7 entry
      const s0c7Entry = searchResults.find(r => 
        r.entry.title.includes('S0C7') || r.entry.problem.includes('S0C7')
      );
      expect(s0c7Entry).toBeTruthy();
      
      // 3. Analyst needs more specific information
      const refinedSearch = await kbService.search('S0C7 arithmetic operations COBOL', {
        userId,
        sessionId,
        useAI: true
      });
      
      expect(refinedSearch.length).toBeGreaterThan(0);
      
      // 4. First solution attempt fails
      if (s0c7Entry) {
        await kbService.recordUsage(s0c7Entry.entry.id, false, userId);
      }
      
      // 5. Search for related issues
      const relatedSearch = await kbService.search('packed decimal data exception', {
        userId,
        sessionId
      });
      
      // 6. Find working solution and apply successfully  
      if (relatedSearch.length > 0) {
        await kbService.recordUsage(relatedSearch[0].entry.id, true, userId);
      }
      
      // 7. Analyst adds note about specific fix (simulated by updating entry)
      if (s0c7Entry) {
        await kbService.update(s0c7Entry.entry.id, {
          solution: s0c7Entry.entry.solution + '\n8. For payroll calculations, verify customer balance field initialization',
          updated_by: userId
        });
      }
      
      // 8. Verify learning and improvement cycle
      const updatedEntry = s0c7Entry ? await kbService.read(s0c7Entry.entry.id) : null;
      if (updatedEntry) {
        expect(updatedEntry.solution).toContain('payroll calculations');
        expect(updatedEntry.version).toBeGreaterThan(s0c7Entry!.entry.version);
      }
    });
  });

  describe('Knowledge Base Evolution Workflow', () => {
    test('Scenario: New knowledge entry creation and validation', async () => {
      const userId = 'expert-003';
      
      // 1. Expert encounters new type of error
      const newProblem = 'DB2 SQLCODE -922 Authorization Failure';
      
      // 2. Search existing knowledge base
      const existingResults = await kbService.search(newProblem, { userId });
      
      // Should not find specific match
      const exactMatch = existingResults.find(r => 
        r.entry.problem.includes('-922') || r.entry.title.includes('-922')
      );
      expect(exactMatch).toBeFalsy();
      
      // 3. Expert creates new knowledge entry
      const newEntry: KBEntryInput = {
        title: 'DB2 SQLCODE -922 Authorization Failure',
        problem: 'Application receives SQLCODE -922 when attempting to access sensitive customer data. Error occurs after recent security policy updates.',
        solution: '1. Check user/plan authorization: -DIS THREAD(*) TYPE(ACTIVE)\n2. Grant proper privileges: GRANT SELECT ON table TO user\n3. Verify RACF profile access\n4. Check package binding authorization\n5. Review recent security changes\n6. Contact security administrator if needed',
        category: 'DB2',
        tags: ['db2', 'sqlcode-922', 'authorization', 'security', 'racf'],
        created_by: userId
      };
      
      const newEntryId = await kbService.create(newEntry);
      expect(newEntryId).toBeTruthy();
      
      // 4. Other team members can now find this solution
      const verificationSearch = await kbService.search('DB2 authorization error 922', {
        userId: 'other-analyst'
      });
      
      const newlyCreated = verificationSearch.find(r => r.entry.id === newEntryId);
      expect(newlyCreated).toBeTruthy();
      expect(newlyCreated!.score).toBeGreaterThan(60);
    });

    test('Scenario: Knowledge base maintenance and improvement', async () => {
      const adminUserId = 'kb-admin';
      
      // 1. Administrator reviews low-performing entries
      const allEntries = await kbService.list({
        sortBy: 'usage_count',
        sortOrder: 'asc',
        limit: 100
      });
      
      expect(allEntries.data.length).toBeGreaterThan(0);
      
      // 2. Find entries with low success rates
      const lowSuccessEntries = allEntries.data.filter(entry => {
        const totalUsage = (entry.success_count || 0) + (entry.failure_count || 0);
        if (totalUsage === 0) return false;
        return (entry.success_count || 0) / totalUsage < 0.5;
      });
      
      // 3. Update problematic entries
      if (lowSuccessEntries.length > 0) {
        const entryToImprove = lowSuccessEntries[0];
        const success = await kbService.update(entryToImprove.id, {
          solution: entryToImprove.solution + '\n\n--- Updated Solution ---\nAdditional troubleshooting steps based on user feedback.',
          updated_by: adminUserId
        });
        
        expect(success).toBe(true);
      }
      
      // 4. Add trending tags to popular entries
      const popularEntries = await kbService.list({
        sortBy: 'usage_count',
        sortOrder: 'desc',
        limit: 5
      });
      
      if (popularEntries.data.length > 0) {
        const topEntry = popularEntries.data[0];
        const currentTags = topEntry.tags || [];
        
        await kbService.update(topEntry.id, {
          tags: [...currentTags, 'frequently-used'],
          updated_by: adminUserId
        });
        
        // Verify update
        const updatedEntry = await kbService.read(topEntry.id);
        expect(updatedEntry?.tags).toContain('frequently-used');
      }
    });
  });

  describe('Peak Load and Performance Scenarios', () => {
    test('Scenario: High-volume concurrent usage simulation', async () => {
      const concurrentUsers = 20;
      const searchesPerUser = 5;
      const startTime = Date.now();
      
      // Simulate multiple analysts working simultaneously
      const userSessions = Array.from({ length: concurrentUsers }, (_, i) => ({
        userId: `analyst-${i.toString().padStart(3, '0')}`,
        sessionId: `session-${Date.now()}-${i}`
      }));
      
      // Create concurrent search operations
      const searchPromises: Promise<any>[] = [];
      
      const searchQueries = [
        'VSAM error',
        'JCL dataset not found',
        'S0C7 data exception',
        'DB2 SQLCODE -904',
        'CICS ASRA abend',
        'storage shortage',
        'CPU high utilization',
        'batch job failure'
      ];
      
      userSessions.forEach(session => {
        for (let i = 0; i < searchesPerUser; i++) {
          const query = searchQueries[i % searchQueries.length];
          searchPromises.push(
            kbService.search(query, {
              userId: session.userId,
              sessionId: session.sessionId,
              useAI: Math.random() > 0.5 // 50% use AI enhancement
            })
          );
        }
      });
      
      // Execute all searches concurrently
      const results = await Promise.allSettled(searchPromises);
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');
      
      const totalTime = Date.now() - startTime;
      
      // Verify performance expectations
      expect(successful.length).toBeGreaterThan(searchPromises.length * 0.95); // 95% success rate
      expect(failed.length).toBeLessThan(searchPromises.length * 0.05); // Less than 5% failure
      expect(totalTime).toBeLessThan(30000); // Complete within 30 seconds
      
      // Check system stability
      const finalMetrics = await metricsService.getMetrics('1h');
      expect(finalMetrics.performance.errorRate).toBeLessThan(0.1); // Less than 10% error rate
    });

    test('Scenario: System recovery and resilience testing', async () => {
      const userId = 'resilience-test';
      
      // 1. Simulate cache failures
      jest.spyOn(cacheService, 'get').mockRejectedValueOnce(new Error('Cache unavailable'));
      
      // System should continue working
      const entry = await kbService.read(knowledgeBase[0].id);
      expect(entry).toBeTruthy();
      
      // 2. Simulate metrics service errors
      jest.spyOn(metricsService, 'recordSearch').mockRejectedValueOnce(new Error('Metrics error'));
      
      // Search should still work
      const searchResults = await kbService.search('test resilience', { userId });
      expect(searchResults).toBeDefined();
      
      // 3. Simulate validation service issues  
      jest.spyOn(mockValidation, 'validateEntry').mockImplementationOnce(() => {
        throw new Error('Validation service error');
      });
      
      // Should handle validation errors gracefully
      try {
        await kbService.create({
          title: 'Test Entry',
          problem: 'Test problem',
          solution: 'Test solution',
          category: 'Other',
          tags: ['test'],
          created_by: userId
        });
      } catch (error) {
        expect(error).toBeDefined();
      }
      
      // 4. System should recover normal operation
      const normalSearch = await kbService.search('normal operation test', { userId });
      expect(normalSearch).toBeDefined();
    });
  });

  describe('Analytics and Reporting Workflows', () => {
    test('Scenario: Generate comprehensive system reports', async () => {
      // Generate some activity first
      const reportUserId = 'report-generator';
      
      // Perform various operations to create data
      for (let i = 0; i < 10; i++) {
        await kbService.search(`test query ${i}`, { userId: reportUserId });
        if (i < knowledgeBase.length) {
          await kbService.recordUsage(
            knowledgeBase[i].id, 
            Math.random() > 0.3, // 70% success rate
            reportUserId
          );
        }
      }
      
      // Allow time for metrics aggregation
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // 1. Get comprehensive metrics
      const metrics = await metricsService.getMetrics('24h');
      
      expect(metrics).toBeDefined();
      expect(metrics.overview).toBeDefined();
      expect(metrics.searches).toBeDefined();
      expect(metrics.usage).toBeDefined();
      expect(metrics.performance).toBeDefined();
      
      // 2. Generate trend analysis
      const trends = await metricsService.getTrends('24h');
      
      expect(trends).toBeDefined();
      expect(trends.searches).toBeDefined();
      expect(Array.isArray(trends.searches)).toBe(true);
      
      // 3. Export metrics in different formats
      const jsonExport = await metricsService.exportMetrics('json');
      expect(jsonExport).toBeTruthy();
      expect(() => JSON.parse(jsonExport)).not.toThrow();
      
      const csvExport = await metricsService.exportMetrics('csv');
      expect(csvExport).toBeTruthy();
      expect(csvExport).toContain('Metric,Value,Timestamp');
      
      // 4. Check for any alerts generated
      const alerts = await metricsService.getAlerts();
      expect(Array.isArray(alerts)).toBe(true);
    });
  });

  describe('Data Integrity and Consistency Workflows', () => {
    test('Scenario: Batch operations maintain consistency', async () => {
      const batchUserId = 'batch-processor';
      
      // 1. Create batch of related entries
      const batchEntries: KBEntryInput[] = [
        {
          title: 'Network Issue Part 1 - Detection',
          problem: 'Network connectivity issues affecting mainframe access',
          solution: 'Step 1: Network diagnostics and detection procedures',
          category: 'System',
          tags: ['network', 'connectivity', 'part-1'],
          created_by: batchUserId
        },
        {
          title: 'Network Issue Part 2 - Analysis',
          problem: 'Deep analysis of network connectivity problems',
          solution: 'Step 2: Network analysis and troubleshooting procedures',
          category: 'System',
          tags: ['network', 'analysis', 'part-2'],
          created_by: batchUserId
        },
        {
          title: 'Network Issue Part 3 - Resolution',
          problem: 'Final steps to resolve network connectivity',
          solution: 'Step 3: Network resolution and verification procedures',
          category: 'System',
          tags: ['network', 'resolution', 'part-3'],
          created_by: batchUserId
        }
      ];
      
      const batchIds = await kbService.createBatch(batchEntries);
      expect(batchIds).toHaveLength(batchEntries.length);
      
      // 2. Verify all entries were created consistently
      const createdEntries = await kbService.readBatch(batchIds);
      expect(createdEntries).toHaveLength(batchIds.length);
      
      createdEntries.forEach((entry, index) => {
        expect(entry.title).toBe(batchEntries[index].title);
        expect(entry.category).toBe('System');
        expect(entry.created_by).toBe(batchUserId);
        expect(entry.tags).toContain('network');
      });
      
      // 3. Batch update operations
      const updates = batchIds.map((id, index) => ({
        id,
        updates: {
          tags: [...(batchEntries[index].tags || []), 'updated-batch'],
          updated_by: batchUserId
        }
      }));
      
      const updateResults = await kbService.updateBatch(updates);
      expect(updateResults.every(result => result === true)).toBe(true);
      
      // 4. Verify batch updates maintained consistency
      const updatedEntries = await kbService.readBatch(batchIds);
      updatedEntries.forEach(entry => {
        expect(entry.tags).toContain('updated-batch');
        expect(entry.version).toBeGreaterThan(1);
      });
      
      // 5. Search should find all related entries
      const networkSearch = await kbService.search('network connectivity issue', {
        userId: batchUserId
      });
      
      const batchResults = networkSearch.filter(result => 
        batchIds.includes(result.entry.id)
      );
      expect(batchResults.length).toBe(batchEntries.length);
    });
  });
});