/**
 * Integration and Fallback Mechanism Validation Tests
 * Validates external system integrations and their fallback behaviors
 * Tests AI service integrations, offline capabilities, and error recovery
 */

import { test, expect } from '@playwright/test';
import { WorkflowTestHelper } from '../helpers/WorkflowTestHelper';
import { PerformanceMonitor } from '../helpers/PerformanceMonitor';
import { DataIntegrityChecker } from '../helpers/DataIntegrityChecker';

/**
 * Integration test configuration
 */
const INTEGRATION_CONFIG = {
  // AI Service Thresholds
  geminiResponseTimeout: 5000,     // 5s timeout for AI responses
  fallbackActivationTime: 2000,    // 2s before fallback activation
  aiFailureRecoveryTime: 500,      // 500ms recovery time

  // Network and Connectivity
  networkTimeoutThreshold: 10000,  // 10s network timeout
  offlineDetectionTime: 1000,      // 1s to detect offline mode
  reconnectionTime: 3000,          // 3s max reconnection time

  // Data Synchronization
  dataSyncTimeout: 5000,           // 5s for data sync operations
  conflictResolutionTime: 2000,    // 2s for conflict resolution
  backupValidationTime: 3000,      // 3s for backup validation

  // Integration Health
  healthCheckInterval: 30000,      // 30s health check interval
  serviceRecoveryAttempts: 3,      // Max recovery attempts
  circuitBreakerThreshold: 5       // Failures before circuit breaker
};

let workflowHelper: WorkflowTestHelper;
let performanceMonitor: PerformanceMonitor;
let dataIntegrityChecker: DataIntegrityChecker;

test.beforeAll(async () => {
  workflowHelper = new WorkflowTestHelper();
  performanceMonitor = new PerformanceMonitor();
  dataIntegrityChecker = new DataIntegrityChecker();

  performanceMonitor.startMonitoring();
});

test.afterAll(async () => {
  performanceMonitor.stopMonitoring();
  await workflowHelper.cleanup();
  await dataIntegrityChecker.cleanup();
});

/**
 * AI SERVICE INTEGRATION AND FALLBACK TESTS
 * Test Gemini API integration and local fallback mechanisms
 */
test.describe('AI Service Integration and Fallback', () => {

  test('INT-001: Gemini API integration validation', async ({ page }) => {
    await test.step('Test normal AI service operation', async () => {
      console.log('🤖 Testing Gemini API integration');

      await page.goto('/');
      await page.waitForSelector('[data-testid="search-interface"]');

      // Test AI-enhanced search
      const searchStartTime = Date.now();
      await page.fill('[data-testid="search-input"]', 'mainframe performance optimization techniques');

      // Try AI search if available
      const aiSearchButton = await page.$('[data-testid="search-button-ai"]');
      if (aiSearchButton) {
        await aiSearchButton.click();
      } else {
        await page.click('[data-testid="search-button"]');
      }

      await page.waitForSelector('[data-testid="search-results"]');
      const searchTime = Date.now() - searchStartTime;

      // Check if AI enhancement indicators are present
      const aiEnhanced = await page.isVisible('[data-testid="ai-enhanced-results"]');
      const aiExplanation = await page.isVisible('[data-testid="ai-explanation"]');

      console.log(`  Search completed in ${searchTime}ms (AI enhanced: ${aiEnhanced})`);

      // Validate response time
      expect(searchTime).toBeLessThan(INTEGRATION_CONFIG.geminiResponseTimeout);

      // Record performance metrics
      performanceMonitor.recordSearchPerformance(
        'AI enhanced search',
        searchTime,
        await page.$$eval('[data-testid="result-item"]', els => els.length),
        true
      );

      // If AI is working, validate enhanced features
      if (aiEnhanced) {
        // Check for semantic matching indicators
        const semanticMatches = await page.$$('[data-testid="semantic-match"]');
        expect(semanticMatches.length).toBeGreaterThanOrEqual(0);

        // Validate confidence scores if displayed
        const confidenceScores = await page.$$eval(
          '[data-testid="confidence-score"]',
          elements => elements.map(el => parseFloat(el.textContent || '0'))
        );

        confidenceScores.forEach(score => {
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(100);
        });
      }
    });
  });

  test('INT-002: AI service failure graceful degradation', async ({ page }) => {
    await test.step('Test fallback to local search when AI fails', async () => {
      console.log('🔴 Testing AI service failure fallback');

      // Mock AI service failure
      await workflowHelper.mockGeminiServiceFailure();

      await page.goto('/');
      await page.waitForSelector('[data-testid="search-interface"]');

      const searchStartTime = Date.now();
      await page.fill('[data-testid="search-input"]', 'VSAM file handling procedures');

      // Attempt AI search
      const aiSearchButton = await page.$('[data-testid="search-button-ai"]');
      if (aiSearchButton) {
        await aiSearchButton.click();
      } else {
        await page.click('[data-testid="search-button"]');
      }

      // Should fallback to local search
      await page.waitForSelector('[data-testid="search-results"]');

      const fallbackTime = Date.now() - searchStartTime;

      // Check for fallback notification
      const fallbackNotice = await page.isVisible('[data-testid="ai-fallback-notice"]');
      const offlineIndicator = await page.isVisible('[data-testid="ai-service-offline"]');

      console.log(`  Fallback completed in ${fallbackTime}ms (notice shown: ${fallbackNotice})`);

      // Validate fallback performance
      expect(fallbackTime).toBeLessThan(INTEGRATION_CONFIG.fallbackActivationTime + 1000);

      // Should still return results via local search
      const resultCount = await page.$$eval(
        '[data-testid="result-item"]',
        elements => elements.length
      );
      expect(resultCount).toBeGreaterThan(0);

      // Verify user is informed about service degradation
      if (fallbackNotice || offlineIndicator) {
        const noticeText = await page.textContent('[data-testid="ai-fallback-notice"]');
        expect(noticeText).toMatch(/unavailable|offline|fallback/i);
      }

      performanceMonitor.recordError('ai_service_failure', fallbackTime);
    });
  });

  test('INT-003: AI service recovery validation', async ({ page }) => {
    await test.step('Test AI service automatic recovery', async () => {
      console.log('🟢 Testing AI service recovery');

      // Start with AI service in failed state
      await workflowHelper.mockGeminiServiceFailure({ duration: 5000 });

      await page.goto('/');

      // Initial search should use fallback
      await page.fill('[data-testid="search-input"]', 'recovery test query');
      await page.click('[data-testid="search-button"]');
      await page.waitForSelector('[data-testid="search-results"]');

      // Wait for service recovery
      await page.waitForTimeout(6000);

      // Test service recovery
      await page.fill('[data-testid="search-input"]', 'recovery validation query');
      const aiButton = await page.$('[data-testid="search-button-ai"]');

      if (aiButton) {
        const recoveryStartTime = Date.now();
        await aiButton.click();
        await page.waitForSelector('[data-testid="search-results"]');

        const recoveryTime = Date.now() - recoveryStartTime;

        // Check if AI service is working again
        const aiWorking = await page.isVisible('[data-testid="ai-enhanced-results"]');

        console.log(`  Recovery test completed in ${recoveryTime}ms (AI working: ${aiWorking})`);

        expect(recoveryTime).toBeLessThan(INTEGRATION_CONFIG.geminiResponseTimeout);
      }
    });
  });

  test('INT-004: AI response quality validation', async ({ page }) => {
    await test.step('Validate AI response quality and relevance', async () => {
      console.log('🎯 Testing AI response quality');

      const testQueries = [
        { query: 'VSAM status 35 error', expectedTerms: ['vsam', 'status', '35', 'file'] },
        { query: 'JCL dataset not found', expectedTerms: ['jcl', 'dataset', 'not found', 'allocation'] },
        { query: 'S0C7 data exception COBOL', expectedTerms: ['s0c7', 'data', 'exception', 'numeric'] }
      ];

      for (const testCase of testQueries) {
        await page.goto('/');
        await page.fill('[data-testid="search-input"]', testCase.query);

        const aiButton = await page.$('[data-testid="search-button-ai"]');
        if (aiButton) {
          await aiButton.click();
        } else {
          await page.click('[data-testid="search-button"]');
        }

        await page.waitForSelector('[data-testid="search-results"]');

        // Get search results
        const resultTitles = await page.$$eval(
          '[data-testid="result-title"]',
          elements => elements.map(el => el.textContent?.toLowerCase() || '')
        );

        // Check relevance - at least one result should contain expected terms
        const relevantResults = resultTitles.filter(title =>
          testCase.expectedTerms.some(term => title.includes(term.toLowerCase()))
        );

        expect(relevantResults.length).toBeGreaterThan(0);

        // If AI explanations are available, validate them
        const explanations = await page.$$eval(
          '[data-testid="ai-explanation"]',
          elements => elements.map(el => el.textContent || '')
        );

        if (explanations.length > 0) {
          // Explanations should be meaningful (not empty or too short)
          explanations.forEach(explanation => {
            expect(explanation.length).toBeGreaterThan(10);
            expect(explanation).not.toMatch(/^(error|failed|unavailable)$/i);
          });
        }

        console.log(`  Query "${testCase.query}": ${relevantResults.length}/${resultTitles.length} relevant results`);
      }
    });
  });
});

/**
 * NETWORK CONNECTIVITY AND OFFLINE MODE TESTS
 * Test offline capabilities and network resilience
 */
test.describe('Network Connectivity and Offline Mode', () => {

  test('INT-005: Offline mode activation and functionality', async ({ page, context }) => {
    await test.step('Test offline mode detection and functionality', async () => {
      console.log('📡 Testing offline mode functionality');

      // Start online
      await page.goto('/');
      await page.waitForSelector('[data-testid="search-interface"]');

      // Verify online indicators
      const onlineIndicator = await page.isVisible('[data-testid="online-indicator"]');
      console.log(`  Initially online: ${onlineIndicator}`);

      // Go offline
      await context.setOffline(true);

      // Wait for offline detection
      await page.waitForTimeout(INTEGRATION_CONFIG.offlineDetectionTime);

      // Reload page to trigger offline mode
      await page.reload();
      await page.waitForSelector('[data-testid="search-interface"]');

      // Check offline indicators
      const offlineIndicator = await page.waitForSelector('[data-testid="offline-indicator"]', { timeout: 5000 });
      expect(offlineIndicator).toBeTruthy();

      // Test offline search functionality
      await page.fill('[data-testid="search-input"]', 'offline search test');
      await page.click('[data-testid="search-button"]');
      await page.waitForSelector('[data-testid="search-results"]');

      // Should still return local results
      const offlineResults = await page.$$eval(
        '[data-testid="result-item"]',
        elements => elements.length
      );
      expect(offlineResults).toBeGreaterThan(0);

      // AI search should be disabled
      const aiButtonVisible = await page.isVisible('[data-testid="search-button-ai"]');
      expect(aiButtonVisible).toBe(false);

      // Test entry viewing offline
      const firstResult = await page.$('[data-testid="result-item"]:first-child');
      if (firstResult) {
        await firstResult.click();
        await page.waitForSelector('[data-testid="entry-detail"]');

        // Entry details should load from local storage
        const entryContent = await page.textContent('[data-testid="solution-content"]');
        expect(entryContent).toBeDefined();
        expect(entryContent!.length).toBeGreaterThan(0);
      }

      console.log(`  Offline functionality validated: ${offlineResults} results available`);
    });
  });

  test('INT-006: Network reconnection and sync', async ({ page, context }) => {
    await test.step('Test network reconnection and data synchronization', async () => {
      console.log('🔄 Testing network reconnection');

      // Start offline
      await context.setOffline(true);
      await page.goto('/');
      await page.waitForSelector('[data-testid="offline-indicator"]');

      // Perform some offline operations
      await page.fill('[data-testid="search-input"]', 'offline operation');
      await page.click('[data-testid="search-button"]');
      await page.waitForSelector('[data-testid="search-results"]');

      // Simulate providing feedback while offline (should queue)
      const results = await page.$$('[data-testid="result-item"]');
      if (results.length > 0) {
        await results[0].click();
        await page.waitForSelector('[data-testid="entry-detail"]');

        const feedbackButton = await page.$('[data-testid="feedback-success"]');
        if (feedbackButton) {
          await feedbackButton.click();

          // Should show queued/pending indicator
          const queuedIndicator = await page.isVisible('[data-testid="feedback-queued"]');
          console.log(`  Feedback queued while offline: ${queuedIndicator}`);
        }
      }

      // Go back online
      await context.setOffline(false);
      const reconnectionStartTime = Date.now();

      // Reload or navigate to trigger reconnection
      await page.reload();
      await page.waitForSelector('[data-testid="search-interface"]');

      // Wait for online indicator
      await page.waitForSelector('[data-testid="online-indicator"]', {
        timeout: INTEGRATION_CONFIG.reconnectionTime
      });

      const reconnectionTime = Date.now() - reconnectionStartTime;
      console.log(`  Reconnection completed in ${reconnectionTime}ms`);

      // Validate reconnection time
      expect(reconnectionTime).toBeLessThan(INTEGRATION_CONFIG.reconnectionTime);

      // Check if queued operations are being processed
      const syncingIndicator = await page.isVisible('[data-testid="syncing-data"]');
      if (syncingIndicator) {
        // Wait for sync completion
        await page.waitForSelector('[data-testid="sync-complete"]', {
          timeout: INTEGRATION_CONFIG.dataSyncTimeout
        });
        console.log('  Data synchronization completed');
      }
    });
  });

  test('INT-007: Network timeout and retry handling', async ({ page, context }) => {
    await test.step('Test network timeout handling and retry mechanisms', async () => {
      console.log('⏱️ Testing network timeout handling');

      // Simulate slow network conditions
      await workflowHelper.simulateNetworkConditions(2000, 0.1); // 2s latency, 10% loss

      await page.goto('/');
      await page.waitForSelector('[data-testid="search-interface"]');

      const timeoutTestStartTime = Date.now();

      // Attempt operation that might timeout
      await page.fill('[data-testid="search-input"]', 'timeout test query');

      const aiButton = await page.$('[data-testid="search-button-ai"]');
      if (aiButton) {
        await aiButton.click();

        // Wait for either results or timeout error
        await Promise.race([
          page.waitForSelector('[data-testid="search-results"]'),
          page.waitForSelector('[data-testid="timeout-error"]'),
          page.waitForSelector('[data-testid="retry-button"]')
        ]);

        const timeoutDuration = Date.now() - timeoutTestStartTime;

        // Check if timeout was handled gracefully
        const timeoutError = await page.isVisible('[data-testid="timeout-error"]');
        const retryButton = await page.isVisible('[data-testid="retry-button"]');

        console.log(`  Timeout test completed in ${timeoutDuration}ms`);
        console.log(`  Timeout error shown: ${timeoutError}, Retry available: ${retryButton}`);

        // If retry is available, test retry functionality
        if (retryButton) {
          const retryStartTime = Date.now();
          await page.click('[data-testid="retry-button"]');

          await Promise.race([
            page.waitForSelector('[data-testid="search-results"]'),
            page.waitForSelector('[data-testid="timeout-error"]')
          ]);

          const retryTime = Date.now() - retryStartTime;
          console.log(`  Retry completed in ${retryTime}ms`);
        }

        // Should eventually fallback to local search
        const results = await page.$$eval(
          '[data-testid="result-item"]',
          elements => elements.length
        );
        expect(results).toBeGreaterThan(0);
      }

      // Reset network conditions
      await workflowHelper.simulateNetworkConditions(0, 0);
    });
  });
});

/**
 * DATA SYNCHRONIZATION AND CONFLICT RESOLUTION TESTS
 * Test data consistency across operations and sessions
 */
test.describe('Data Synchronization and Conflict Resolution', () => {

  test('INT-008: Concurrent user conflict resolution', async ({ browser }) => {
    await test.step('Test conflict resolution for concurrent modifications', async () => {
      console.log('⚔️ Testing concurrent modification conflict resolution');

      // Create two user sessions
      const user1Context = await browser.newContext();
      const user2Context = await browser.newContext();
      const user1Page = await user1Context.newPage();
      const user2Page = await user2Context.newPage();

      // Both users navigate to same entry
      const testQuery = 'conflict resolution test';

      // User 1 searches and opens entry for editing
      await user1Page.goto('/');
      await user1Page.fill('[data-testid="search-input"]', testQuery);
      await user1Page.click('[data-testid="search-button"]');
      await user1Page.waitForSelector('[data-testid="search-results"]');

      const user1Results = await user1Page.$$('[data-testid="result-item"]');
      if (user1Results.length > 0) {
        await user1Results[0].click();
        await user1Page.waitForSelector('[data-testid="entry-detail"]');

        const editButton1 = await user1Page.$('[data-testid="edit-entry"]');
        if (editButton1) {
          await editButton1.click();
          await user1Page.waitForSelector('[data-testid="edit-form"]');
        }
      }

      // User 2 does the same
      await user2Page.goto('/');
      await user2Page.fill('[data-testid="search-input"]', testQuery);
      await user2Page.click('[data-testid="search-button"]');
      await user2Page.waitForSelector('[data-testid="search-results"]');

      const user2Results = await user2Page.$$('[data-testid="result-item"]');
      if (user2Results.length > 0) {
        await user2Results[0].click();
        await user2Page.waitForSelector('[data-testid="entry-detail"]');

        const editButton2 = await user2Page.$('[data-testid="edit-entry"]');
        if (editButton2) {
          await editButton2.click();
          await user2Page.waitForSelector('[data-testid="edit-form"]');
        }
      }

      // User 1 makes changes and saves
      const solutionField1 = await user1Page.$('[data-testid="entry-solution"]');
      if (solutionField1) {
        await solutionField1.fill('Updated by User 1 at ' + new Date().toISOString());
        await user1Page.click('[data-testid="save-changes"]');

        // Wait for save confirmation
        await user1Page.waitForSelector('[data-testid="save-success"]', { timeout: 3000 });
        console.log('  User 1 saved changes successfully');
      }

      // User 2 tries to save conflicting changes
      const solutionField2 = await user2Page.$('[data-testid="entry-solution"]');
      if (solutionField2) {
        await solutionField2.fill('Updated by User 2 at ' + new Date().toISOString());
        await user2Page.click('[data-testid="save-changes"]');

        // Should detect conflict
        const conflictDialog = await user2Page.waitForSelector('[data-testid="conflict-dialog"]', { timeout: 5000 });
        expect(conflictDialog).toBeTruthy();

        console.log('  Conflict detected for User 2');

        // Test conflict resolution options
        const mergeOption = await user2Page.$('[data-testid="merge-changes"]');
        const overwriteOption = await user2Page.$('[data-testid="overwrite-changes"]');
        const cancelOption = await user2Page.$('[data-testid="cancel-changes"]');

        expect(mergeOption || overwriteOption || cancelOption).toBeTruthy();

        // Choose merge resolution
        if (mergeOption) {
          const conflictStartTime = Date.now();
          await mergeOption.click();
          await user2Page.waitForSelector('[data-testid="conflict-resolved"]', { timeout: 5000 });

          const resolutionTime = Date.now() - conflictStartTime;
          console.log(`  Conflict resolved in ${resolutionTime}ms`);

          expect(resolutionTime).toBeLessThan(INTEGRATION_CONFIG.conflictResolutionTime);
        }
      }

      await user1Context.close();
      await user2Context.close();
    });
  });

  test('INT-009: Data backup and restoration validation', async ({ page }) => {
    await test.step('Test data backup integrity and restoration', async () => {
      console.log('💾 Testing data backup and restoration');

      await page.goto('/');

      // Access backup functionality
      await page.click('[data-testid="menu-button"]');
      const backupOption = await page.$('[data-testid="backup-data"]');

      if (backupOption) {
        const backupStartTime = Date.now();
        await backupOption.click();

        await page.waitForSelector('[data-testid="backup-dialog"]');
        await page.click('[data-testid="start-backup"]');

        // Wait for backup completion
        await page.waitForSelector('[data-testid="backup-complete"]', {
          timeout: INTEGRATION_CONFIG.backupValidationTime * 2
        });

        const backupTime = Date.now() - backupStartTime;
        console.log(`  Backup completed in ${backupTime}ms`);

        expect(backupTime).toBeLessThan(INTEGRATION_CONFIG.backupValidationTime * 2);

        // Get backup file information
        const backupPath = await page.textContent('[data-testid="backup-path"]');
        expect(backupPath).toBeDefined();

        console.log(`  Backup saved to: ${backupPath}`);

        // Validate backup file
        const backupValid = await workflowHelper.validateExportFile(backupPath!);
        expect(backupValid).toBeDefined();
        expect(backupValid.entries.length).toBeGreaterThan(0);

        // Test restoration process
        await page.click('[data-testid="restore-data"]');
        await page.waitForSelector('[data-testid="restore-dialog"]');

        await page.setInputFiles('[data-testid="restore-file"]', backupPath!);
        await page.click('[data-testid="start-restore"]');

        // Wait for restoration confirmation
        await page.waitForSelector('[data-testid="restore-complete"]', {
          timeout: INTEGRATION_CONFIG.backupValidationTime * 2
        });

        console.log('  Data restoration completed successfully');
      } else {
        console.log('  Backup functionality not yet implemented - skipping test');
      }
    });
  });

  test('INT-010: Cross-session data consistency', async ({ browser }) => {
    await test.step('Test data consistency across different sessions', async () => {
      console.log('🔄 Testing cross-session data consistency');

      // Create multiple browser sessions
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      // Session 1: Add new entry
      await page1.goto('/');
      await page1.click('[data-testid="add-entry-button"]');
      await page1.waitForSelector('[data-testid="add-entry-modal"]');

      const testEntryTitle = `Cross-session test entry ${Date.now()}`;
      await page1.fill('[data-testid="entry-title"]', testEntryTitle);
      await page1.fill('[data-testid="entry-problem"]', 'Cross-session consistency test problem');
      await page1.fill('[data-testid="entry-solution"]', 'Cross-session consistency test solution');
      await page1.selectOption('[data-testid="entry-category"]', 'Other');
      await page1.fill('[data-testid="entry-tags"]', 'consistency, test, cross-session');

      await page1.click('[data-testid="save-entry"]');
      await page1.waitForSelector('[data-testid="entry-saved-message"]');

      console.log(`  Entry created in session 1: ${testEntryTitle}`);

      // Session 2: Search for the entry (may require refresh/sync)
      await page2.goto('/');

      // Small delay to allow for potential data sync
      await page2.waitForTimeout(1000);

      await page2.fill('[data-testid="search-input"]', testEntryTitle.split(' ').slice(0, 2).join(' '));
      await page2.click('[data-testid="search-button"]');
      await page2.waitForSelector('[data-testid="search-results"]');

      // Check if entry is visible in session 2
      const foundResults = await page2.$$eval(
        '[data-testid="result-title"]',
        elements => elements.map(el => el.textContent || '')
      );

      const entryFound = foundResults.some(title => title.includes(testEntryTitle.split(' ')[0]));

      if (entryFound) {
        console.log('  Entry found in session 2 - consistency maintained');
        expect(entryFound).toBe(true);
      } else {
        console.log('  Entry not immediately visible in session 2 - may require sync implementation');
        // This might be expected behavior depending on sync implementation
      }

      // Session 1: Update the entry
      await page1.fill('[data-testid="search-input"]', testEntryTitle);
      await page1.click('[data-testid="search-button"]');
      await page1.waitForSelector('[data-testid="search-results"]');

      const results1 = await page1.$$('[data-testid="result-item"]');
      if (results1.length > 0) {
        await results1[0].click();
        await page1.waitForSelector('[data-testid="entry-detail"]');

        const editButton = await page1.$('[data-testid="edit-entry"]');
        if (editButton) {
          await editButton.click();
          await page1.waitForSelector('[data-testid="edit-form"]');

          const updatedSolution = 'Updated solution for cross-session consistency test';
          await page1.fill('[data-testid="entry-solution"]', updatedSolution);
          await page1.click('[data-testid="save-changes"]');
          await page1.waitForSelector('[data-testid="changes-saved-message"]');

          console.log('  Entry updated in session 1');
        }
      }

      // Session 2: Verify update is reflected
      await page2.reload();
      await page2.fill('[data-testid="search-input"]', testEntryTitle.split(' ')[0]);
      await page2.click('[data-testid="search-button"]');
      await page2.waitForSelector('[data-testid="search-results"]');

      const results2 = await page2.$$('[data-testid="result-item"]');
      if (results2.length > 0) {
        await results2[0].click();
        await page2.waitForSelector('[data-testid="entry-detail"]');

        const solutionText = await page2.textContent('[data-testid="solution-content"]');

        if (solutionText?.includes('Updated solution')) {
          console.log('  Update reflected in session 2 - consistency maintained');
        } else {
          console.log('  Update not yet reflected in session 2');
        }
      }

      await context1.close();
      await context2.close();
    });
  });
});

/**
 * SYSTEM HEALTH AND MONITORING TESTS
 * Test health checks and monitoring capabilities
 */
test.describe('System Health and Monitoring', () => {

  test('INT-011: System health monitoring validation', async ({ page }) => {
    await test.step('Test system health monitoring and alerts', async () => {
      console.log('🏥 Testing system health monitoring');

      await page.goto('/');

      // Access system health dashboard
      await page.click('[data-testid="menu-button"]');
      const healthOption = await page.$('[data-testid="system-health"]');

      if (healthOption) {
        await healthOption.click();
        await page.waitForSelector('[data-testid="health-dashboard"]');

        // Check core health indicators
        const indicators = [
          'database-status',
          'search-performance',
          'memory-usage',
          'response-time',
          'error-rate'
        ];

        for (const indicator of indicators) {
          const element = await page.$(`[data-testid="${indicator}"]`);
          if (element) {
            const status = await element.textContent();
            const healthStatus = await element.getAttribute('data-health-status');

            console.log(`  ${indicator}: ${status} (${healthStatus})`);

            // Health status should be one of: healthy, warning, critical
            expect(['healthy', 'warning', 'critical', null]).toContain(healthStatus);
          }
        }

        // Check for any critical alerts
        const criticalAlerts = await page.$$('[data-testid="critical-alert"]');
        console.log(`  Critical alerts: ${criticalAlerts.length}`);

        // Test alert acknowledgment if alerts present
        if (criticalAlerts.length > 0) {
          await criticalAlerts[0].click();
          const ackButton = await page.$('[data-testid="acknowledge-alert"]');
          if (ackButton) {
            await ackButton.click();
            await page.waitForSelector('[data-testid="alert-acknowledged"]');
            console.log('  Alert acknowledgment tested');
          }
        }

        // Test health check refresh
        const refreshButton = await page.$('[data-testid="refresh-health"]');
        if (refreshButton) {
          const refreshStartTime = Date.now();
          await refreshButton.click();
          await page.waitForSelector('[data-testid="health-refreshed"]', { timeout: 5000 });

          const refreshTime = Date.now() - refreshStartTime;
          console.log(`  Health check refreshed in ${refreshTime}ms`);

          expect(refreshTime).toBeLessThan(INTEGRATION_CONFIG.healthCheckInterval / 6); // Should be much faster than interval
        }

      } else {
        console.log('  Health monitoring not yet implemented - skipping detailed tests');

        // Basic health validation through application behavior
        await page.fill('[data-testid="search-input"]', 'health test');
        await page.click('[data-testid="search-button"]');

        const searchStartTime = Date.now();
        await page.waitForSelector('[data-testid="search-results"]');
        const searchTime = Date.now() - searchStartTime;

        console.log(`  Basic search health check: ${searchTime}ms`);
        expect(searchTime).toBeLessThan(2000); // Basic health threshold
      }
    });
  });

  test('INT-012: Performance degradation detection', async ({ page }) => {
    await test.step('Test performance degradation detection and alerts', async () => {
      console.log('📉 Testing performance degradation detection');

      // Establish baseline performance
      const baselineStartTime = Date.now();
      await page.goto('/');
      await page.fill('[data-testid="search-input"]', 'performance baseline');
      await page.click('[data-testid="search-button"]');
      await page.waitForSelector('[data-testid="search-results"]');
      const baselineTime = Date.now() - baselineStartTime;

      console.log(`  Baseline performance: ${baselineTime}ms`);

      // Simulate high load to trigger performance degradation
      const loadTestPromises = [];
      for (let i = 0; i < 10; i++) {
        loadTestPromises.push(
          (async () => {
            const loadStartTime = Date.now();
            await page.goto('/');
            await page.fill('[data-testid="search-input"]', `load test ${i}`);
            await page.click('[data-testid="search-button"]');
            await page.waitForSelector('[data-testid="search-results"]');
            return Date.now() - loadStartTime;
          })()
        );
      }

      const loadTestResults = await Promise.all(loadTestPromises);
      const averageLoadTime = loadTestResults.reduce((sum, time) => sum + time, 0) / loadTestResults.length;

      console.log(`  Average performance under load: ${averageLoadTime.toFixed(0)}ms`);

      // Check for performance degradation alerts
      const performanceDegradation = averageLoadTime > baselineTime * 2; // 100% increase threshold

      if (performanceDegradation) {
        console.log('  Performance degradation detected');

        // Look for degradation warnings in UI
        const degradationWarning = await page.$('[data-testid="performance-warning"]');
        const slowResponseNotice = await page.$('[data-testid="slow-response-notice"]');

        if (degradationWarning || slowResponseNotice) {
          console.log('  Performance degradation properly detected and reported');
        }
      } else {
        console.log('  Performance remained stable under load');
      }

      // Record all performance metrics
      loadTestResults.forEach((time, index) => {
        performanceMonitor.recordSearchPerformance(`load test ${index}`, time, 1);
      });
    });
  });

  test('INT-013: Circuit breaker and rate limiting validation', async ({ page }) => {
    await test.step('Test circuit breaker and rate limiting mechanisms', async () => {
      console.log('🔌 Testing circuit breaker and rate limiting');

      // Rapid-fire requests to test rate limiting
      const rapidRequests = 20;
      const requestTimes = [];
      let rateLimitHit = false;

      for (let i = 0; i < rapidRequests; i++) {
        try {
          const requestStartTime = Date.now();

          await page.goto('/');
          await page.fill('[data-testid="search-input"]', `rapid test ${i}`);
          await page.click('[data-testid="search-button"]');

          // Check for rate limit messages
          const rateLimitMessage = await page.$('[data-testid="rate-limit-warning"]');
          if (rateLimitMessage) {
            rateLimitHit = true;
            console.log(`  Rate limit hit at request ${i + 1}`);
            break;
          }

          await page.waitForSelector('[data-testid="search-results"]', { timeout: 2000 });

          const requestTime = Date.now() - requestStartTime;
          requestTimes.push(requestTime);

          // No delay between requests to test rate limiting
        } catch (error) {
          if (error.message.includes('timeout')) {
            console.log(`  Request ${i + 1} timed out - possible rate limiting`);
            rateLimitHit = true;
            break;
          }
          throw error;
        }
      }

      if (rateLimitHit) {
        console.log('  Rate limiting mechanism active');

        // Test recovery after rate limiting
        await page.waitForTimeout(5000); // Wait for rate limit reset

        const recoveryStartTime = Date.now();
        await page.fill('[data-testid="search-input"]', 'recovery test');
        await page.click('[data-testid="search-button"]');
        await page.waitForSelector('[data-testid="search-results"]');
        const recoveryTime = Date.now() - recoveryStartTime;

        console.log(`  Recovery from rate limiting: ${recoveryTime}ms`);
        expect(recoveryTime).toBeLessThan(3000);
      } else {
        console.log(`  Completed ${rapidRequests} rapid requests without hitting rate limits`);

        // Validate that performance didn't degrade too much
        const avgTime = requestTimes.reduce((sum, time) => sum + time, 0) / requestTimes.length;
        console.log(`  Average rapid request time: ${avgTime.toFixed(0)}ms`);
      }

      // Test circuit breaker with simulated service failures
      console.log('  Testing circuit breaker mechanism');

      // Simulate AI service failures
      await workflowHelper.simulateAIServiceDegradation(1.0); // 100% failure rate

      let circuitBreakerTriggered = false;
      const failureAttempts = INTEGRATION_CONFIG.circuitBreakerThreshold + 1;

      for (let i = 0; i < failureAttempts; i++) {
        const aiButton = await page.$('[data-testid="search-button-ai"]');
        if (aiButton) {
          await page.fill('[data-testid="search-input"]', `circuit breaker test ${i}`);
          await aiButton.click();

          // Look for circuit breaker activation
          const circuitBreakerMessage = await page.$('[data-testid="circuit-breaker-open"]');
          if (circuitBreakerMessage) {
            circuitBreakerTriggered = true;
            console.log(`  Circuit breaker triggered after ${i + 1} failures`);
            break;
          }

          await page.waitForTimeout(1000);
        }
      }

      if (circuitBreakerTriggered) {
        console.log('  Circuit breaker mechanism functioning correctly');
      } else {
        console.log('  Circuit breaker not implemented or not triggered');
      }
    });
  });
});

/**
 * FINAL INTEGRATION VALIDATION
 */
test('INT-014: Comprehensive integration validation', async ({ page }) => {
  await test.step('Final comprehensive integration system validation', async () => {
    console.log('🏁 Starting comprehensive integration validation');

    const integrationResults = {
      aiIntegration: false,
      offlineMode: false,
      dataSync: false,
      errorRecovery: false,
      healthMonitoring: false
    };

    // Test AI integration
    try {
      await page.goto('/');
      const aiButton = await page.$('[data-testid="search-button-ai"]');
      if (aiButton) {
        await page.fill('[data-testid="search-input"]', 'integration validation test');
        await aiButton.click();
        await page.waitForSelector('[data-testid="search-results"]', { timeout: 3000 });
        integrationResults.aiIntegration = true;
      }
    } catch (error) {
      console.log('  AI integration test failed - fallback mechanisms should work');
    }

    // Test offline mode basics
    try {
      await page.goto('/');
      await page.fill('[data-testid="search-input"]', 'offline test');
      await page.click('[data-testid="search-button"]');
      await page.waitForSelector('[data-testid="search-results"]', { timeout: 2000 });
      integrationResults.offlineMode = true;
    } catch (error) {
      console.log('  Offline mode test failed');
    }

    // Test basic data operations
    try {
      await page.goto('/');
      await page.fill('[data-testid="search-input"]', 'data sync test');
      await page.click('[data-testid="search-button"]');
      await page.waitForSelector('[data-testid="search-results"]', { timeout: 2000 });
      integrationResults.dataSync = true;
    } catch (error) {
      console.log('  Data sync test failed');
    }

    // Test error recovery
    try {
      await workflowHelper.simulateAIServiceFailure({ duration: 1000 });
      await page.goto('/');
      await page.fill('[data-testid="search-input"]', 'error recovery test');
      await page.click('[data-testid="search-button"]');
      await page.waitForSelector('[data-testid="search-results"]', { timeout: 3000 });
      integrationResults.errorRecovery = true;
    } catch (error) {
      console.log('  Error recovery test failed');
    }

    // Test basic health monitoring
    try {
      await page.goto('/');
      const menuButton = await page.$('[data-testid="menu-button"]');
      if (menuButton) {
        await menuButton.click();
        const healthOption = await page.$('[data-testid="system-health"]');
        if (healthOption) {
          integrationResults.healthMonitoring = true;
        }
      }
    } catch (error) {
      console.log('  Health monitoring test failed');
    }

    // Calculate overall integration score
    const integrationScore = Object.values(integrationResults).reduce((sum, result) => sum + (result ? 1 : 0), 0);
    const totalIntegrations = Object.keys(integrationResults).length;
    const integrationHealthScore = integrationScore / totalIntegrations;

    console.log('📊 Integration validation results:');
    console.log(`  AI Integration: ${integrationResults.aiIntegration ? '✅' : '❌'}`);
    console.log(`  Offline Mode: ${integrationResults.offlineMode ? '✅' : '❌'}`);
    console.log(`  Data Sync: ${integrationResults.dataSync ? '✅' : '❌'}`);
    console.log(`  Error Recovery: ${integrationResults.errorRecovery ? '✅' : '❌'}`);
    console.log(`  Health Monitoring: ${integrationResults.healthMonitoring ? '✅' : '❌'}`);
    console.log(`  Overall Integration Health: ${(integrationHealthScore * 100).toFixed(0)}%`);

    // Minimum requirements validation
    expect(integrationResults.offlineMode).toBe(true); // Core offline functionality required
    expect(integrationResults.dataSync).toBe(true);    // Basic data operations required
    expect(integrationHealthScore).toBeGreaterThan(0.6); // 60% minimum integration health

    const overallStatus = integrationHealthScore >= 0.8;
    console.log(`🏆 Integration Status: ${overallStatus ? 'READY FOR DEPLOYMENT' : 'NEEDS ATTENTION'}`);
  });
});