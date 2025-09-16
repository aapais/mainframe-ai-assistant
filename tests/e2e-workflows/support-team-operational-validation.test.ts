/**
 * End-to-End Workflow Validation for Support Team Operations
 * Validates complete user journeys from incident to resolution
 *
 * Test Categories:
 * 1. Complete incident resolution workflows
 * 2. Performance under realistic load
 * 3. Error handling and recovery scenarios
 * 4. Data integrity and consistency
 * 5. Integration points and fallbacks
 * 6. Support team specific operational requirements
 */

import { test, expect } from '@playwright/test';
import { KnowledgeBaseService } from '../../src/services/KnowledgeBaseService';
import { GeminiService } from '../../src/services/GeminiService';
import { SearchService } from '../../src/services/SearchService';
import { KBEntry, SearchResult, KBCategory } from '../../src/types/index';
import { WorkflowTestHelper } from '../helpers/WorkflowTestHelper';
import { PerformanceMonitor } from '../helpers/PerformanceMonitor';
import { DataIntegrityChecker } from '../helpers/DataIntegrityChecker';

/**
 * Test Configuration for Support Team Operations
 */
const SUPPORT_TEAM_CONFIG = {
  // Performance Requirements from MVP1 specifications
  searchResponseTime: 1000, // <1s as per requirements
  geminiResponseTime: 2000, // <2s with fallback
  maxConcurrentUsers: 10,    // Initial team size

  // Operational Requirements
  minKBEntries: 50,          // Initial knowledge base size
  dailySearchVolume: 100,    // Expected daily searches
  peakHourConcurrency: 5,    // Peak concurrent usage

  // Quality Requirements
  searchAccuracy: 0.70,      // 70% relevance threshold
  uiResponseTime: 100,       // UI interactions <100ms
  dataConsistency: 1.0,      // 100% data integrity

  // Error Handling
  aiFailureRecovery: 500,    // Fallback within 500ms
  offlineMode: true,         // Must work offline
  maxRetries: 3,             // Error recovery attempts
};

/**
 * Sample KB entries representing real mainframe issues
 */
const REALISTIC_KB_ENTRIES: KBEntry[] = [
  {
    id: 'kb-001',
    title: 'VSAM Status 35 - File Not Found',
    problem: 'Job abends with VSAM status code 35. Program cannot open the VSAM file during execution.',
    solution: '1. Verify dataset exists using ISPF 3.4\n2. Check DD statement DSN\n3. Verify file is cataloged\n4. Check RACF permissions\n5. Ensure correct catalog usage',
    category: 'VSAM' as KBCategory,
    tags: ['vsam', 'status-35', 'file-not-found', 'catalog'],
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-15'),
    created_by: 'system',
    usage_count: 25,
    success_count: 22,
    failure_count: 3,
    version: 1
  },
  {
    id: 'kb-002',
    title: 'S0C7 Data Exception in COBOL Program',
    problem: 'Program abends with S0C7 data exception during arithmetic operations or MOVE statements.',
    solution: '1. Check for non-numeric data in numeric fields\n2. Initialize COMP-3 fields properly\n3. Use NUMERIC test before arithmetic\n4. Add CEDF debugging\n5. Check compile listing for data definitions',
    category: 'Batch' as KBCategory,
    tags: ['s0c7', 'data-exception', 'cobol', 'numeric', 'abend'],
    created_at: new Date('2024-01-02'),
    updated_at: new Date('2024-01-20'),
    created_by: 'analyst-1',
    usage_count: 18,
    success_count: 16,
    failure_count: 2,
    version: 1
  },
  {
    id: 'kb-003',
    title: 'JCL Error - Dataset Not Found IEF212I',
    problem: 'JCL job fails with IEF212I dataset not found error during job execution.',
    solution: '1. Verify dataset name spelling\n2. Check if dataset exists with LISTD\n3. For GDG verify generation\n4. Check expiration date\n5. Verify UNIT and VOL if uncataloged',
    category: 'JCL' as KBCategory,
    tags: ['jcl', 'dataset', 'not-found', 'ief212i'],
    created_at: new Date('2024-01-03'),
    updated_at: new Date('2024-01-25'),
    created_by: 'analyst-2',
    usage_count: 32,
    success_count: 28,
    failure_count: 4,
    version: 1
  }
];

let workflowHelper: WorkflowTestHelper;
let performanceMonitor: PerformanceMonitor;
let dataIntegrityChecker: DataIntegrityChecker;
let kbService: KnowledgeBaseService;

test.beforeAll(async () => {
  workflowHelper = new WorkflowTestHelper();
  performanceMonitor = new PerformanceMonitor();
  dataIntegrityChecker = new DataIntegrityChecker();

  // Initialize services
  kbService = new KnowledgeBaseService();
  await kbService.initialize();

  // Populate test data
  for (const entry of REALISTIC_KB_ENTRIES) {
    await kbService.addEntry(entry);
  }
});

test.afterAll(async () => {
  await kbService?.cleanup();
  await performanceMonitor?.generateReport();
});

/**
 * WORKFLOW CATEGORY 1: COMPLETE INCIDENT RESOLUTION WORKFLOWS
 * Tests the complete journey from incident occurrence to resolution
 */
test.describe('Complete Incident Resolution Workflows', () => {

  test('WF-001: Basic incident search and resolution workflow', async ({ page }) => {
    await test.step('Support analyst receives incident report', async () => {
      // Simulate incident: VSAM Status 35 error
      const incident = {
        id: 'INC-001',
        description: 'Job PAYROLL failed with VSAM status 35',
        severity: 'high',
        component: 'PAYROLL-SYSTEM',
        timestamp: new Date()
      };

      expect(incident).toBeDefined();
      expect(incident.severity).toBe('high');
    });

    await test.step('Analyst opens KB interface and searches for solution', async () => {
      const searchStartTime = Date.now();

      // Navigate to search interface
      await page.goto('/');
      await page.waitForSelector('[data-testid="search-interface"]');

      // Perform search
      await page.fill('[data-testid="search-input"]', 'VSAM status 35');
      await page.click('[data-testid="search-button"]');

      // Wait for results
      await page.waitForSelector('[data-testid="search-results"]');

      const searchTime = Date.now() - searchStartTime;
      expect(searchTime).toBeLessThan(SUPPORT_TEAM_CONFIG.searchResponseTime);

      // Verify results are relevant
      const resultTitles = await page.$$eval(
        '[data-testid="result-title"]',
        elements => elements.map(el => el.textContent)
      );

      expect(resultTitles.some(title => title?.includes('VSAM Status 35'))).toBe(true);
    });

    await test.step('Analyst selects and views detailed solution', async () => {
      // Click on first result
      await page.click('[data-testid="result-item"]:first-child');

      // Wait for detail view
      await page.waitForSelector('[data-testid="entry-detail"]');

      // Verify solution content is displayed
      const solutionText = await page.textContent('[data-testid="solution-content"]');
      expect(solutionText).toContain('Verify dataset exists');
      expect(solutionText).toContain('Check DD statement');
    });

    await test.step('Analyst applies solution and provides feedback', async () => {
      // Simulate solution application (mock external system)
      await workflowHelper.simulateSolutionApplication('kb-001', true);

      // Provide feedback in UI
      await page.click('[data-testid="feedback-success"]');

      // Optional comment
      await page.fill('[data-testid="feedback-comment"]', 'Solution worked perfectly. Issue resolved in 5 minutes.');
      await page.click('[data-testid="submit-feedback"]');

      // Verify feedback submission
      await page.waitForSelector('[data-testid="feedback-success-message"]');
    });

    await test.step('System updates usage metrics', async () => {
      const metrics = await kbService.getMetrics();
      expect(metrics.total_entries).toBeGreaterThanOrEqual(SUPPORT_TEAM_CONFIG.minKBEntries);

      // Verify specific entry usage was updated
      const entry = await kbService.getEntryById('kb-001');
      expect(entry.usage_count).toBeGreaterThan(0);
      expect(entry.success_count).toBeGreaterThan(0);
    });
  });

  test('WF-002: Complex incident requiring multiple KB searches', async ({ page }) => {
    await test.step('Multi-step incident resolution workflow', async () => {
      const complexIncident = {
        id: 'INC-002',
        description: 'Job chain failure: S0C7 in COBOL followed by JCL dataset not found',
        severity: 'critical',
        components: ['COBOL-PROG-001', 'JCL-STEP-CLEANUP'],
        timestamp: new Date()
      };

      // First search: S0C7 error
      await page.goto('/');
      await page.fill('[data-testid="search-input"]', 'S0C7 data exception');
      await page.click('[data-testid="search-button"]');
      await page.waitForSelector('[data-testid="search-results"]');

      // Verify COBOL-related results
      const firstResults = await page.$$eval(
        '[data-testid="result-title"]',
        elements => elements.map(el => el.textContent)
      );
      expect(firstResults.some(title => title?.includes('S0C7'))).toBe(true);

      // Second search: JCL dataset issue
      await page.fill('[data-testid="search-input"]', 'JCL dataset not found');
      await page.click('[data-testid="search-button"]');
      await page.waitForSelector('[data-testid="search-results"]');

      // Verify JCL-related results
      const secondResults = await page.$$eval(
        '[data-testid="result-title"]',
        elements => elements.map(el => el.textContent)
      );
      expect(secondResults.some(title => title?.includes('Dataset Not Found'))).toBe(true);
    });
  });

  test('WF-003: New incident requiring KB entry creation', async ({ page }) => {
    await test.step('Handle novel incident and create knowledge', async () => {
      // New incident not in KB
      const novelIncident = {
        id: 'INC-003',
        description: 'CICS transaction ABCD abends with ASRA after recent upgrade',
        severity: 'medium',
        component: 'CICS-REGION-A'
      };

      // Search returns no good results
      await page.goto('/');
      await page.fill('[data-testid="search-input"]', 'CICS ABCD ASRA upgrade');
      await page.click('[data-testid="search-button"]');
      await page.waitForSelector('[data-testid="search-results"]');

      const noResults = await page.textContent('[data-testid="no-results-message"]');
      expect(noResults).toContain('No matching entries found');

      // Create new KB entry
      await page.click('[data-testid="add-entry-button"]');
      await page.waitForSelector('[data-testid="add-entry-modal"]');

      await page.fill('[data-testid="entry-title"]', 'CICS Transaction ASRA After Upgrade');
      await page.fill('[data-testid="entry-problem"]', 'CICS transaction fails with ASRA after system upgrade');
      await page.fill('[data-testid="entry-solution"]', '1. Check transaction definition\n2. Verify program recompilation\n3. Check CICS resource definitions');
      await page.selectOption('[data-testid="entry-category"]', 'System');
      await page.fill('[data-testid="entry-tags"]', 'cics,asra,upgrade,transaction');

      await page.click('[data-testid="save-entry"]');
      await page.waitForSelector('[data-testid="entry-saved-message"]');

      // Verify entry was created
      const newEntry = await kbService.searchEntries('CICS ABCD ASRA');
      expect(newEntry.results.length).toBeGreaterThan(0);
    });
  });
});

/**
 * WORKFLOW CATEGORY 2: PERFORMANCE UNDER REALISTIC LOAD
 * Tests system performance under conditions matching support team operations
 */
test.describe('Performance Under Realistic Load Conditions', () => {

  test('WF-004: Concurrent user search performance', async ({ browser }) => {
    await test.step('Simulate peak hour concurrent usage', async () => {
      const contexts = await Promise.all(
        Array.from({ length: SUPPORT_TEAM_CONFIG.peakHourConcurrency }, () =>
          browser.newContext()
        )
      );

      const pages = await Promise.all(
        contexts.map(context => context.newPage())
      );

      // Concurrent searches
      const searchPromises = pages.map(async (page, index) => {
        const searchQuery = index % 2 === 0 ? 'VSAM error' : 'JCL problem';
        const startTime = Date.now();

        await page.goto('/');
        await page.fill('[data-testid="search-input"]', searchQuery);
        await page.click('[data-testid="search-button"]');
        await page.waitForSelector('[data-testid="search-results"]');

        const responseTime = Date.now() - startTime;
        return { user: index, query: searchQuery, responseTime };
      });

      const results = await Promise.all(searchPromises);

      // Verify all searches completed within acceptable time
      results.forEach(result => {
        expect(result.responseTime).toBeLessThan(SUPPORT_TEAM_CONFIG.searchResponseTime * 1.5);
      });

      // Calculate average response time
      const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
      expect(avgResponseTime).toBeLessThan(SUPPORT_TEAM_CONFIG.searchResponseTime);

      // Cleanup
      await Promise.all(contexts.map(context => context.close()));
    });
  });

  test('WF-005: Daily search volume simulation', async ({ page }) => {
    await test.step('Simulate daily search patterns', async () => {
      const searchQueries = [
        'VSAM status error', 'JCL dataset problem', 'COBOL abend',
        'DB2 connection issue', 'batch job failure', 'IMS database',
        'CICS transaction', 'system error', 'performance issue'
      ];

      const searchResults = [];

      for (let i = 0; i < 20; i++) { // Simulate 20 searches (subset of daily volume)
        const query = searchQueries[i % searchQueries.length];
        const startTime = Date.now();

        await page.goto('/');
        await page.fill('[data-testid="search-input"]', query);
        await page.click('[data-testid="search-button"]');
        await page.waitForSelector('[data-testid="search-results"]');

        const responseTime = Date.now() - startTime;
        searchResults.push({ query, responseTime, timestamp: new Date() });

        // Small delay to simulate realistic usage
        await page.waitForTimeout(100);
      }

      // Analyze performance trends
      const avgResponseTime = searchResults.reduce((sum, r) => sum + r.responseTime, 0) / searchResults.length;
      const maxResponseTime = Math.max(...searchResults.map(r => r.responseTime));

      expect(avgResponseTime).toBeLessThan(SUPPORT_TEAM_CONFIG.searchResponseTime);
      expect(maxResponseTime).toBeLessThan(SUPPORT_TEAM_CONFIG.searchResponseTime * 2);

      // Performance should not degrade over time
      const firstHalf = searchResults.slice(0, 10);
      const secondHalf = searchResults.slice(10);

      const firstHalfAvg = firstHalf.reduce((sum, r) => sum + r.responseTime, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, r) => sum + r.responseTime, 0) / secondHalf.length;

      // Allow 20% performance degradation tolerance
      expect(secondHalfAvg).toBeLessThan(firstHalfAvg * 1.2);
    });
  });

  test('WF-006: Memory usage and resource management', async ({ page }) => {
    await test.step('Monitor resource usage during extended session', async () => {
      const initialMetrics = await performanceMonitor.getResourceMetrics();

      // Perform intensive operations
      for (let i = 0; i < 50; i++) {
        await page.goto('/');
        await page.fill('[data-testid="search-input"]', `test query ${i}`);
        await page.click('[data-testid="search-button"]');
        await page.waitForSelector('[data-testid="search-results"]');

        if (i % 10 === 0) {
          const currentMetrics = await performanceMonitor.getResourceMetrics();
          expect(currentMetrics.memoryUsage).toBeLessThan(initialMetrics.memoryUsage * 2);
        }
      }

      const finalMetrics = await performanceMonitor.getResourceMetrics();

      // Memory should not grow excessively
      expect(finalMetrics.memoryUsage).toBeLessThan(initialMetrics.memoryUsage * 1.5);

      // CPU usage should be reasonable
      expect(finalMetrics.cpuUsage).toBeLessThan(80); // 80% max CPU
    });
  });
});

/**
 * WORKFLOW CATEGORY 3: ERROR HANDLING AND RECOVERY SCENARIOS
 * Tests system resilience and fallback mechanisms
 */
test.describe('Error Handling and Recovery Scenarios', () => {

  test('WF-007: Gemini API failure with local fallback', async ({ page }) => {
    await test.step('Test AI service failure graceful degradation', async () => {
      // Mock Gemini API failure
      await workflowHelper.mockGeminiServiceFailure();

      const searchStartTime = Date.now();

      await page.goto('/');
      await page.fill('[data-testid="search-input"]', 'VSAM error status');
      await page.click('[data-testid="search-button-ai"]'); // Specifically request AI search

      // Should fallback to local search
      await page.waitForSelector('[data-testid="search-results"]');
      await page.waitForSelector('[data-testid="fallback-notice"]');

      const fallbackTime = Date.now() - searchStartTime;
      expect(fallbackTime).toBeLessThan(SUPPORT_TEAM_CONFIG.aiFailureRecovery);

      // Verify results are still returned
      const resultCount = await page.$$eval(
        '[data-testid="result-item"]',
        elements => elements.length
      );
      expect(resultCount).toBeGreaterThan(0);

      // Verify fallback notice is displayed
      const notice = await page.textContent('[data-testid="fallback-notice"]');
      expect(notice).toContain('AI search unavailable');
    });
  });

  test('WF-008: Database connection recovery', async ({ page }) => {
    await test.step('Test database connection resilience', async () => {
      // Simulate database connection issue
      await workflowHelper.simulateDatabaseDisconnection();

      // Attempt search during disconnection
      await page.goto('/');
      await page.fill('[data-testid="search-input"]', 'test query');
      await page.click('[data-testid="search-button"]');

      // Should show appropriate error message
      await page.waitForSelector('[data-testid="connection-error"]');

      // Restore connection
      await workflowHelper.restoreDatabaseConnection();

      // Retry should work
      await page.click('[data-testid="retry-search"]');
      await page.waitForSelector('[data-testid="search-results"]');

      // Verify successful recovery
      const results = await page.$$eval(
        '[data-testid="result-item"]',
        elements => elements.length
      );
      expect(results).toBeGreaterThan(0);
    });
  });

  test('WF-009: Offline mode operation', async ({ page, context }) => {
    await test.step('Test offline functionality', async () => {
      // Go offline
      await context.setOffline(true);

      await page.goto('/');

      // Should show offline indicator
      await page.waitForSelector('[data-testid="offline-indicator"]');

      // Local search should still work
      await page.fill('[data-testid="search-input"]', 'VSAM status');
      await page.click('[data-testid="search-button"]');
      await page.waitForSelector('[data-testid="search-results"]');

      // Verify offline search results
      const offlineResults = await page.$$eval(
        '[data-testid="result-item"]',
        elements => elements.length
      );
      expect(offlineResults).toBeGreaterThan(0);

      // AI search should be disabled
      expect(await page.isVisible('[data-testid="search-button-ai"]')).toBe(false);

      // Go back online
      await context.setOffline(false);
      await page.reload();

      // AI search should be available again
      await page.waitForSelector('[data-testid="search-button-ai"]');
    });
  });

  test('WF-010: Data corruption recovery', async ({ page }) => {
    await test.step('Test data integrity validation and recovery', async () => {
      // Simulate data corruption
      await workflowHelper.simulateDataCorruption();

      // System should detect and handle corruption
      await page.goto('/');

      // May show data integrity warning
      const hasIntegrityWarning = await page.isVisible('[data-testid="integrity-warning"]');

      if (hasIntegrityWarning) {
        // Trigger data repair
        await page.click('[data-testid="repair-data"]');
        await page.waitForSelector('[data-testid="repair-complete"]');
      }

      // Verify system functionality after recovery
      await page.fill('[data-testid="search-input"]', 'test search');
      await page.click('[data-testid="search-button"]');
      await page.waitForSelector('[data-testid="search-results"]');

      // Verify data integrity
      const integrityCheck = await dataIntegrityChecker.validateDatabase();
      expect(integrityCheck.isValid).toBe(true);
    });
  });
});

/**
 * WORKFLOW CATEGORY 4: DATA INTEGRITY AND CONSISTENCY
 * Tests data reliability and consistency across operations
 */
test.describe('Data Integrity and Consistency Validation', () => {

  test('WF-011: CRUD operations data consistency', async ({ page }) => {
    await test.step('Validate data consistency across operations', async () => {
      const testEntry = {
        title: 'Test Data Consistency Entry',
        problem: 'Test problem for consistency validation',
        solution: 'Test solution with specific markers: CONSISTENCY_TEST_123',
        category: 'Other' as KBCategory,
        tags: ['consistency', 'test', 'validation']
      };

      // Create entry
      await page.goto('/');
      await page.click('[data-testid="add-entry-button"]');
      await page.waitForSelector('[data-testid="add-entry-modal"]');

      await page.fill('[data-testid="entry-title"]', testEntry.title);
      await page.fill('[data-testid="entry-problem"]', testEntry.problem);
      await page.fill('[data-testid="entry-solution"]', testEntry.solution);
      await page.selectOption('[data-testid="entry-category"]', testEntry.category);
      await page.fill('[data-testid="entry-tags"]', testEntry.tags.join(', '));

      await page.click('[data-testid="save-entry"]');
      await page.waitForSelector('[data-testid="entry-saved-message"]');

      // Verify creation in database
      const createdEntry = await kbService.searchEntries('CONSISTENCY_TEST_123');
      expect(createdEntry.results.length).toBe(1);
      const entry = createdEntry.results[0].entry;

      // Search for created entry
      await page.fill('[data-testid="search-input"]', 'CONSISTENCY_TEST_123');
      await page.click('[data-testid="search-button"]');
      await page.waitForSelector('[data-testid="search-results"]');

      // Verify search finds the entry
      const searchResults = await page.$$eval(
        '[data-testid="result-title"]',
        elements => elements.map(el => el.textContent)
      );
      expect(searchResults.some(title => title?.includes(testEntry.title))).toBe(true);

      // Update entry
      await page.click('[data-testid="result-item"]:first-child');
      await page.waitForSelector('[data-testid="entry-detail"]');
      await page.click('[data-testid="edit-entry"]');

      const updatedSolution = testEntry.solution + ' - UPDATED';
      await page.fill('[data-testid="entry-solution"]', updatedSolution);
      await page.click('[data-testid="save-changes"]');
      await page.waitForSelector('[data-testid="changes-saved-message"]');

      // Verify update in database
      const updatedEntry = await kbService.getEntryById(entry.id);
      expect(updatedEntry.solution).toContain('UPDATED');

      // Delete entry
      await page.click('[data-testid="delete-entry"]');
      await page.click('[data-testid="confirm-delete"]');
      await page.waitForSelector('[data-testid="entry-deleted-message"]');

      // Verify deletion
      const deletedEntry = await kbService.searchEntries('CONSISTENCY_TEST_123');
      expect(deletedEntry.results.length).toBe(0);
    });
  });

  test('WF-012: Concurrent modification handling', async ({ browser }) => {
    await test.step('Test concurrent data modifications', async () => {
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      // Both users open same entry for editing
      const entryId = 'kb-001'; // Use existing VSAM entry

      await page1.goto('/');
      await page1.fill('[data-testid="search-input"]', 'VSAM Status 35');
      await page1.click('[data-testid="search-button"]');
      await page1.waitForSelector('[data-testid="search-results"]');
      await page1.click('[data-testid="result-item"]:first-child');
      await page1.waitForSelector('[data-testid="entry-detail"]');
      await page1.click('[data-testid="edit-entry"]');

      await page2.goto('/');
      await page2.fill('[data-testid="search-input"]', 'VSAM Status 35');
      await page2.click('[data-testid="search-button"]');
      await page2.waitForSelector('[data-testid="search-results"]');
      await page2.click('[data-testid="result-item"]:first-child');
      await page2.waitForSelector('[data-testid="entry-detail"]');
      await page2.click('[data-testid="edit-entry"]');

      // User 1 makes changes and saves
      await page1.fill('[data-testid="entry-solution"]', 'Updated solution by user 1');
      await page1.click('[data-testid="save-changes"]');
      await page1.waitForSelector('[data-testid="changes-saved-message"]');

      // User 2 tries to save changes
      await page2.fill('[data-testid="entry-solution"]', 'Updated solution by user 2');
      await page2.click('[data-testid="save-changes"]');

      // Should show conflict resolution dialog
      await page2.waitForSelector('[data-testid="conflict-dialog"]');

      // Handle conflict (merge changes)
      await page2.click('[data-testid="merge-changes"]');
      await page2.waitForSelector('[data-testid="merge-complete-message"]');

      // Verify final state maintains data integrity
      const finalEntry = await kbService.getEntryById(entryId);
      expect(finalEntry.solution).toBeDefined();
      expect(finalEntry.version).toBeGreaterThan(1); // Version should increment

      await context1.close();
      await context2.close();
    });
  });

  test('WF-013: Search index consistency', async ({ page }) => {
    await test.step('Validate search index remains consistent', async () => {
      // Add entry and immediately search
      const testEntry = {
        title: 'Search Index Test Entry',
        problem: 'Testing search index consistency',
        solution: 'Search indexing verification solution',
        category: 'Other' as KBCategory,
        tags: ['search', 'index', 'consistency', 'immediate-test-marker']
      };

      await page.goto('/');
      await page.click('[data-testid="add-entry-button"]');
      await page.waitForSelector('[data-testid="add-entry-modal"]');

      await page.fill('[data-testid="entry-title"]', testEntry.title);
      await page.fill('[data-testid="entry-problem"]', testEntry.problem);
      await page.fill('[data-testid="entry-solution"]', testEntry.solution);
      await page.selectOption('[data-testid="entry-category"]', testEntry.category);
      await page.fill('[data-testid="entry-tags"]', testEntry.tags.join(', '));

      await page.click('[data-testid="save-entry"]');
      await page.waitForSelector('[data-testid="entry-saved-message"]');

      // Immediately search for new entry
      await page.fill('[data-testid="search-input"]', 'immediate-test-marker');
      await page.click('[data-testid="search-button"]');
      await page.waitForSelector('[data-testid="search-results"]');

      // New entry should be immediately searchable
      const immediateResults = await page.$$eval(
        '[data-testid="result-title"]',
        elements => elements.map(el => el.textContent)
      );
      expect(immediateResults.some(title => title?.includes('Search Index Test'))).toBe(true);

      // Update entry and verify search index updates
      await page.click('[data-testid="result-item"]:first-child');
      await page.waitForSelector('[data-testid="entry-detail"]');
      await page.click('[data-testid="edit-entry"]');

      await page.fill('[data-testid="entry-title"]', 'Updated Search Index Test Entry');
      await page.click('[data-testid="save-changes"]');
      await page.waitForSelector('[data-testid="changes-saved-message"]');

      // Search with updated terms
      await page.fill('[data-testid="search-input"]', 'Updated Search Index');
      await page.click('[data-testid="search-button"]');
      await page.waitForSelector('[data-testid="search-results"]');

      // Updated content should be findable
      const updatedResults = await page.$$eval(
        '[data-testid="result-title"]',
        elements => elements.map(el => el.textContent)
      );
      expect(updatedResults.some(title => title?.includes('Updated Search Index'))).toBe(true);
    });
  });
});

/**
 * WORKFLOW CATEGORY 5: INTEGRATION POINTS AND FALLBACK MECHANISMS
 * Tests external system integrations and their fallback behaviors
 */
test.describe('Integration Points and Fallback Mechanisms', () => {

  test('WF-014: AI service integration with graceful degradation', async ({ page }) => {
    await test.step('Test AI integration and fallback chain', async () => {
      // Test normal AI operation
      await page.goto('/');
      await page.fill('[data-testid="search-input"]', 'complex mainframe issue');
      await page.click('[data-testid="search-button-ai"]');
      await page.waitForSelector('[data-testid="search-results"]');

      // Should show AI-enhanced results
      const aiIndicator = await page.isVisible('[data-testid="ai-enhanced-results"]');

      if (aiIndicator) {
        // AI is working normally
        const aiResults = await page.$$eval(
          '[data-testid="result-item"]',
          elements => elements.length
        );
        expect(aiResults).toBeGreaterThan(0);
      }

      // Simulate AI service degradation
      await workflowHelper.simulateAIServiceDegradation();

      // Retry search
      await page.fill('[data-testid="search-input"]', 'another mainframe problem');
      await page.click('[data-testid="search-button-ai"]');

      // Should fallback to local search with notice
      await page.waitForSelector('[data-testid="search-results"]');
      await page.waitForSelector('[data-testid="ai-fallback-notice"]');

      const fallbackResults = await page.$$eval(
        '[data-testid="result-item"]',
        elements => elements.length
      );
      expect(fallbackResults).toBeGreaterThan(0);

      // Verify user can still continue workflow
      await page.click('[data-testid="result-item"]:first-child');
      await page.waitForSelector('[data-testid="entry-detail"]');
    });
  });

  test('WF-015: Export/Import functionality integration', async ({ page }) => {
    await test.step('Test data export/import workflow', async () => {
      // Export current KB
      await page.goto('/');
      await page.click('[data-testid="menu-button"]');
      await page.click('[data-testid="export-kb"]');

      // Configure export
      await page.waitForSelector('[data-testid="export-dialog"]');
      await page.check('[data-testid="include-usage-stats"]');
      await page.click('[data-testid="start-export"]');

      // Wait for export completion
      await page.waitForSelector('[data-testid="export-complete"]');
      const exportPath = await page.textContent('[data-testid="export-path"]');
      expect(exportPath).toContain('.json');

      // Verify export file integrity
      const exportData = await workflowHelper.validateExportFile(exportPath);
      expect(exportData.version).toBeDefined();
      expect(exportData.entries.length).toBeGreaterThanOrEqual(REALISTIC_KB_ENTRIES.length);

      // Test import functionality
      await page.click('[data-testid="import-kb"]');
      await page.waitForSelector('[data-testid="import-dialog"]');

      // Upload export file
      await page.setInputFiles('[data-testid="import-file"]', exportPath);
      await page.click('[data-testid="start-import"]');

      // Should show import preview
      await page.waitForSelector('[data-testid="import-preview"]');
      const importCount = await page.textContent('[data-testid="import-count"]');
      expect(parseInt(importCount)).toBeGreaterThan(0);

      await page.click('[data-testid="confirm-import"]');
      await page.waitForSelector('[data-testid="import-complete"]');
    });
  });

  test('WF-016: System monitoring and health checks', async ({ page }) => {
    await test.step('Validate system health monitoring', async () => {
      await page.goto('/');
      await page.click('[data-testid="menu-button"]');
      await page.click('[data-testid="system-health"]');

      await page.waitForSelector('[data-testid="health-dashboard"]');

      // Verify key health metrics
      const dbStatus = await page.textContent('[data-testid="database-status"]');
      expect(dbStatus).toBe('Healthy');

      const searchPerformance = await page.textContent('[data-testid="search-performance"]');
      const avgTime = parseFloat(searchPerformance.match(/(\d+\.?\d*)/)?.[1] || '0');
      expect(avgTime).toBeLessThan(SUPPORT_TEAM_CONFIG.searchResponseTime);

      const memoryUsage = await page.textContent('[data-testid="memory-usage"]');
      const memUsagePercent = parseFloat(memoryUsage.match(/(\d+)/)?.[1] || '0');
      expect(memUsagePercent).toBeLessThan(80); // 80% threshold

      // Test health check alerts
      const alerts = await page.$$('[data-testid="health-alert"]');
      alerts.forEach(async (alert) => {
        const severity = await alert.getAttribute('data-severity');
        expect(['info', 'warning', 'error']).toContain(severity);
      });
    });
  });
});

/**
 * WORKFLOW CATEGORY 6: SUPPORT TEAM SPECIFIC OPERATIONAL REQUIREMENTS
 * Tests workflows specific to support team daily operations
 */
test.describe('Support Team Specific Operations', () => {

  test('WF-017: Daily support team workflow simulation', async ({ page }) => {
    await test.step('Simulate complete daily support operations', async () => {
      const dailyIncidents = [
        { type: 'VSAM', query: 'VSAM status 35', priority: 'high' },
        { type: 'JCL', query: 'JCL dataset not found', priority: 'medium' },
        { type: 'COBOL', query: 'S0C7 abend', priority: 'high' },
        { type: 'DB2', query: 'DB2 connection failed', priority: 'low' },
        { type: 'Batch', query: 'batch job hanging', priority: 'medium' }
      ];

      const sessionMetrics = {
        searches: 0,
        resolutions: 0,
        newEntries: 0,
        feedbacks: 0,
        totalTime: 0
      };

      for (const incident of dailyIncidents) {
        const incidentStartTime = Date.now();

        // Search for solution
        await page.goto('/');
        await page.fill('[data-testid="search-input"]', incident.query);
        await page.click('[data-testid="search-button"]');
        await page.waitForSelector('[data-testid="search-results"]');
        sessionMetrics.searches++;

        const hasResults = await page.isVisible('[data-testid="result-item"]');

        if (hasResults) {
          // Found solution - view and provide feedback
          await page.click('[data-testid="result-item"]:first-child');
          await page.waitForSelector('[data-testid="entry-detail"]');

          // Simulate reading solution
          await page.waitForTimeout(2000);

          // Provide feedback
          const successful = Math.random() > 0.2; // 80% success rate
          if (successful) {
            await page.click('[data-testid="feedback-success"]');
            sessionMetrics.resolutions++;
          } else {
            await page.click('[data-testid="feedback-failure"]');
            await page.fill('[data-testid="feedback-comment"]', 'Solution needs additional steps');
          }
          sessionMetrics.feedbacks++;
        } else {
          // No solution found - create new entry
          await page.click('[data-testid="add-entry-button"]');
          await page.waitForSelector('[data-testid="add-entry-modal"]');

          await page.fill('[data-testid="entry-title"]', `${incident.type} - ${incident.query}`);
          await page.fill('[data-testid="entry-problem"]', `Issue with ${incident.query}`);
          await page.fill('[data-testid="entry-solution"]', 'Research and document solution here');
          await page.selectOption('[data-testid="entry-category"]', incident.type);

          await page.click('[data-testid="save-entry"]');
          await page.waitForSelector('[data-testid="entry-saved-message"]');
          sessionMetrics.newEntries++;
        }

        const incidentTime = Date.now() - incidentStartTime;
        sessionMetrics.totalTime += incidentTime;
      }

      // Validate session performance
      expect(sessionMetrics.searches).toBe(dailyIncidents.length);
      expect(sessionMetrics.resolutions).toBeGreaterThan(0);
      expect(sessionMetrics.totalTime / sessionMetrics.searches).toBeLessThan(30000); // 30s avg per incident

      // Generate and validate daily report
      await page.goto('/');
      await page.click('[data-testid="menu-button"]');
      await page.click('[data-testid="daily-report"]');
      await page.waitForSelector('[data-testid="daily-metrics"]');

      const dailySearches = await page.textContent('[data-testid="daily-search-count"]');
      expect(parseInt(dailySearches)).toBeGreaterThanOrEqual(sessionMetrics.searches);
    });
  });

  test('WF-018: Knowledge base maintenance workflow', async ({ page }) => {
    await test.step('Test KB maintenance operations', async () => {
      await page.goto('/');
      await page.click('[data-testid="menu-button"]');
      await page.click('[data-testid="kb-maintenance"]');

      await page.waitForSelector('[data-testid="maintenance-panel"]');

      // Review low-performing entries
      await page.click('[data-testid="low-performance-entries"]');
      await page.waitForSelector('[data-testid="performance-list"]');

      const lowPerformanceEntries = await page.$$('[data-testid="low-performance-item"]');

      for (const entry of lowPerformanceEntries.slice(0, 2)) { // Review first 2
        await entry.click();
        await page.waitForSelector('[data-testid="entry-performance-detail"]');

        // Check entry statistics
        const successRate = await page.textContent('[data-testid="success-rate"]');
        const usageCount = await page.textContent('[data-testid="usage-count"]');

        // Decide on action based on performance
        const successRateNum = parseFloat(successRate.replace('%', ''));

        if (successRateNum < 50) {
          // Update entry for improvement
          await page.click('[data-testid="improve-entry"]');
          await page.waitForSelector('[data-testid="entry-edit-form"]');

          // Add improvement note
          const currentSolution = await page.inputValue('[data-testid="entry-solution"]');
          await page.fill('[data-testid="entry-solution"]',
            currentSolution + '\n\nNote: Updated for improved accuracy based on user feedback.'
          );

          await page.click('[data-testid="save-improvements"]');
          await page.waitForSelector('[data-testid="improvements-saved"]');
        }
      }

      // Check for duplicate entries
      await page.click('[data-testid="find-duplicates"]');
      await page.waitForSelector('[data-testid="duplicate-analysis"]');

      const duplicateGroups = await page.$$('[data-testid="duplicate-group"]');

      if (duplicateGroups.length > 0) {
        // Handle first duplicate group
        await duplicateGroups[0].click();
        await page.waitForSelector('[data-testid="duplicate-resolution"]');

        // Choose to merge entries
        await page.click('[data-testid="merge-entries"]');
        await page.waitForSelector('[data-testid="merge-preview"]');
        await page.click('[data-testid="confirm-merge"]');
        await page.waitForSelector('[data-testid="merge-complete"]');
      }

      // Generate maintenance report
      await page.click('[data-testid="generate-maintenance-report"]');
      await page.waitForSelector('[data-testid="maintenance-report"]');

      const reportData = await page.textContent('[data-testid="report-summary"]');
      expect(reportData).toContain('maintenance');
    });
  });

  test('WF-019: Emergency incident response workflow', async ({ page }) => {
    await test.step('Test high-priority emergency incident handling', async () => {
      const emergencyIncident = {
        id: 'EMRG-001',
        description: 'Critical production system down - multiple VSAM files unavailable',
        severity: 'critical',
        components: ['PROD-VSAM-CLUSTER-1', 'PAYROLL-SYSTEM', 'FINANCIAL-REPORTING'],
        impact: 'Business operations halted',
        timestamp: new Date()
      };

      // Emergency search workflow
      await page.goto('/');

      // Quick access to emergency procedures
      await page.click('[data-testid="emergency-mode"]');
      await page.waitForSelector('[data-testid="emergency-interface"]');

      // Emergency search with priority handling
      await page.fill('[data-testid="emergency-search"]', 'VSAM cluster unavailable production');
      await page.click('[data-testid="emergency-search-button"]');

      // Should prioritize high-impact solutions
      await page.waitForSelector('[data-testid="emergency-results"]');

      const prioritizedResults = await page.$$eval(
        '[data-testid="priority-result"]',
        elements => elements.map(el => el.getAttribute('data-priority'))
      );

      expect(prioritizedResults.some(priority => priority === 'critical')).toBe(true);

      // Quick solution access
      await page.click('[data-testid="priority-result"]:first-child');
      await page.waitForSelector('[data-testid="emergency-solution"]');

      // Should show condensed, action-focused solution
      const solutionSteps = await page.$$('[data-testid="solution-step"]');
      expect(solutionSteps.length).toBeGreaterThan(0);

      // Emergency escalation if needed
      const escalateButton = await page.isVisible('[data-testid="escalate-emergency"]');
      if (escalateButton) {
        // Test escalation workflow
        await page.click('[data-testid="escalate-emergency"]');
        await page.waitForSelector('[data-testid="escalation-form"]');

        await page.fill('[data-testid="escalation-details"]', 'Unable to resolve VSAM cluster issue with current KB solutions');
        await page.selectOption('[data-testid="escalation-level"]', 'L3-EXPERT');
        await page.click('[data-testid="submit-escalation"]');

        await page.waitForSelector('[data-testid="escalation-confirmed"]');
      }

      // Track emergency resolution time
      const resolutionTime = Date.now() - emergencyIncident.timestamp.getTime();
      expect(resolutionTime).toBeLessThan(300000); // 5 minutes max for emergency discovery
    });
  });

  test('WF-020: Team collaboration and knowledge sharing', async ({ browser }) => {
    await test.step('Test multi-user knowledge sharing workflow', async () => {
      const analyst1Context = await browser.newContext();
      const analyst2Context = await browser.newContext();
      const analyst1Page = await analyst1Context.newPage();
      const analyst2Page = await analyst2Context.newPage();

      // Analyst 1 encounters new issue and documents it
      await analyst1Page.goto('/');
      await analyst1Page.click('[data-testid="add-entry-button"]');
      await analyst1Page.waitForSelector('[data-testid="add-entry-modal"]');

      const sharedKnowledge = {
        title: 'New IMS Database Locking Issue',
        problem: 'IMS database locks not released after abnormal termination',
        solution: '1. Check DL/I status\n2. Run database recovery\n3. Restart dependent regions',
        category: 'IMS',
        tags: ['ims', 'locking', 'recovery', 'database']
      };

      await analyst1Page.fill('[data-testid="entry-title"]', sharedKnowledge.title);
      await analyst1Page.fill('[data-testid="entry-problem"]', sharedKnowledge.problem);
      await analyst1Page.fill('[data-testid="entry-solution"]', sharedKnowledge.solution);
      await analyst1Page.selectOption('[data-testid="entry-category"]', sharedKnowledge.category);
      await analyst1Page.fill('[data-testid="entry-tags"]', sharedKnowledge.tags.join(', '));

      await analyst1Page.click('[data-testid="save-entry"]');
      await analyst1Page.waitForSelector('[data-testid="entry-saved-message"]');

      // Analyst 2 encounters similar issue and finds the shared knowledge
      await analyst2Page.goto('/');
      await analyst2Page.fill('[data-testid="search-input"]', 'IMS database locking');
      await analyst2Page.click('[data-testid="search-button"]');
      await analyst2Page.waitForSelector('[data-testid="search-results"]');

      // Should find the entry created by analyst 1
      const sharedResults = await analyst2Page.$$eval(
        '[data-testid="result-title"]',
        elements => elements.map(el => el.textContent)
      );
      expect(sharedResults.some(title => title?.includes('IMS Database Locking'))).toBe(true);

      // Analyst 2 uses the solution and provides enhancement feedback
      await analyst2Page.click('[data-testid="result-item"]:first-child');
      await analyst2Page.waitForSelector('[data-testid="entry-detail"]');

      // Provide feedback with enhancement suggestion
      await analyst2Page.click('[data-testid="feedback-success"]');
      await analyst2Page.fill('[data-testid="feedback-comment"]',
        'Solution worked well. Suggestion: Add step to check for dependent batch jobs before restart.'
      );
      await analyst2Page.click('[data-testid="submit-feedback"]');
      await analyst2Page.waitForSelector('[data-testid="feedback-submitted"]');

      // Verify feedback integration
      const entry = await kbService.searchEntries('IMS database locking');
      expect(entry.results[0].entry.success_count).toBeGreaterThan(0);

      // Test real-time collaboration features
      await analyst1Page.reload();
      await analyst1Page.fill('[data-testid="search-input"]', 'IMS database locking');
      await analyst1Page.click('[data-testid="search-button"]');
      await analyst1Page.waitForSelector('[data-testid="search-results"]');
      await analyst1Page.click('[data-testid="result-item"]:first-child');
      await analyst1Page.waitForSelector('[data-testid="entry-detail"]');

      // Should see feedback from analyst 2
      const feedbackSection = await analyst1Page.isVisible('[data-testid="user-feedback-section"]');
      if (feedbackSection) {
        const feedbacks = await analyst1Page.$$eval(
          '[data-testid="feedback-item"]',
          elements => elements.map(el => el.textContent)
        );
        expect(feedbacks.some(feedback => feedback?.includes('dependent batch jobs'))).toBe(true);
      }

      await analyst1Context.close();
      await analyst2Context.close();
    });
  });
});

/**
 * COMPREHENSIVE TEST SUITE METRICS AND VALIDATION
 */
test.afterAll(async () => {
  await test.step('Generate comprehensive validation report', async () => {
    const testResults = await performanceMonitor.getTestResults();
    const integrityResults = await dataIntegrityChecker.getFinalReport();

    // Validate overall test suite success criteria
    expect(testResults.totalTests).toBeGreaterThan(15);
    expect(testResults.successRate).toBeGreaterThan(0.95); // 95% success rate
    expect(testResults.averageResponseTime).toBeLessThan(SUPPORT_TEAM_CONFIG.searchResponseTime);

    // Validate data integrity maintained throughout tests
    expect(integrityResults.dataCorruption).toBe(0);
    expect(integrityResults.consistencyViolations).toBe(0);

    // Generate final validation report
    const report = {
      timestamp: new Date(),
      testSuite: 'Support Team Operational Validation',
      totalWorkflows: 20,
      performanceMetrics: testResults,
      integrityValidation: integrityResults,
      supportTeamReadiness: {
        searchPerformance: testResults.averageResponseTime < SUPPORT_TEAM_CONFIG.searchResponseTime,
        concurrentUserSupport: testResults.concurrentUsers >= SUPPORT_TEAM_CONFIG.peakHourConcurrency,
        errorRecovery: testResults.errorRecoveryTime < SUPPORT_TEAM_CONFIG.aiFailureRecovery,
        dataIntegrity: integrityResults.overallHealth > 0.99,
        offlineCapability: testResults.offlineFunctional,
        knowledgeSharing: testResults.collaborationFeatures
      },
      recommendations: [
        testResults.averageResponseTime > 800 ? 'Consider search optimization' : null,
        integrityResults.warnings > 0 ? 'Review data integrity warnings' : null,
        testResults.errorRate > 0.02 ? 'Improve error handling' : null
      ].filter(Boolean)
    };

    console.log('=== SUPPORT TEAM OPERATIONAL VALIDATION REPORT ===');
    console.log(JSON.stringify(report, null, 2));

    // Save report to file for review
    await workflowHelper.saveValidationReport(report);
  });
});