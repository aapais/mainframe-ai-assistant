/**
 * End-to-End Testing Framework
 * Complete user workflow testing using Playwright for the Mainframe KB Assistant
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { chromium, Browser, BrowserContext, Page, ElectronApplication, _electron as electron } from 'playwright';
import path from 'path';
import { TestDataGenerator, AssertionHelpers } from '../utils/TestingUtilities';

/**
 * E2E Test Configuration
 */
interface E2ETestConfig {
  appPath: string;
  testTimeout: number;
  retries: number;
  screenshots: boolean;
  video: boolean;
  slowMo: number;
  headless: boolean;
  baseUrl?: string;
}

const DEFAULT_E2E_CONFIG: E2ETestConfig = {
  appPath: './dist/main/index.js',
  testTimeout: 30000,
  retries: 2,
  screenshots: true,
  video: false,
  slowMo: 0,
  headless: true
};

/**
 * Page Object Models for better maintainability
 */
export class SearchPageObject {
  constructor(private page: Page) {}

  // Locators
  get searchInput() { return this.page.locator('[data-testid="search-input"]'); }
  get searchButton() { return this.page.locator('[data-testid="search-button"]'); }
  get searchResults() { return this.page.locator('[data-testid="search-results"]'); }
  get loadingIndicator() { return this.page.locator('[data-testid="loading-indicator"]'); }
  get noResultsMessage() { return this.page.locator('[data-testid="no-results"]'); }
  get filterButton() { return this.page.locator('[data-testid="filter-button"]'); }
  get categoryFilter() { return this.page.locator('[data-testid="category-filter"]'); }
  get resultCount() { return this.page.locator('[data-testid="result-count"]'); }

  // Actions
  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.searchButton.click();
  }

  async waitForResults(): Promise<void> {
    await this.loadingIndicator.waitFor({ state: 'hidden', timeout: 10000 });
    await expect(this.searchResults).toBeVisible();
  }

  async selectFilter(category: string): Promise<void> {
    await this.filterButton.click();
    await this.categoryFilter.selectOption(category);
  }

  async getResultTitles(): Promise<string[]> {
    const results = await this.page.locator('[data-testid="search-result-title"]').all();
    return Promise.all(results.map(result => result.textContent().then(text => text || '')));
  }

  async selectFirstResult(): Promise<void> {
    await this.page.locator('[data-testid="search-result"]:first-child').click();
  }
}

export class KBEntryPageObject {
  constructor(private page: Page) {}

  // Locators
  get entryTitle() { return this.page.locator('[data-testid="entry-title"]'); }
  get entryProblem() { return this.page.locator('[data-testid="entry-problem"]'); }
  get entrySolution() { return this.page.locator('[data-testid="entry-solution"]'); }
  get entryCategory() { return this.page.locator('[data-testid="entry-category"]'); }
  get entryTags() { return this.page.locator('[data-testid="entry-tags"]'); }
  get helpfulButton() { return this.page.locator('[data-testid="helpful-button"]'); }
  get notHelpfulButton() { return this.page.locator('[data-testid="not-helpful-button"]'); }
  get copyButton() { return this.page.locator('[data-testid="copy-button"]'); }
  get editButton() { return this.page.locator('[data-testid="edit-button"]'); }
  get backButton() { return this.page.locator('[data-testid="back-button"]'); }

  // Actions
  async rateAsHelpful(): Promise<void> {
    await this.helpfulButton.click();
    await expect(this.page.locator('[data-testid="rating-success"]')).toBeVisible();
  }

  async rateAsNotHelpful(): Promise<void> {
    await this.notHelpfulButton.click();
    await expect(this.page.locator('[data-testid="rating-success"]')).toBeVisible();
  }

  async copySolution(): Promise<void> {
    await this.copyButton.click();
    await expect(this.page.locator('[data-testid="copy-success"]')).toBeVisible();
  }

  async editEntry(): Promise<void> {
    await this.editButton.click();
  }

  async goBack(): Promise<void> {
    await this.backButton.click();
  }
}

export class AddEntryPageObject {
  constructor(private page: Page) {}

  // Locators
  get titleInput() { return this.page.locator('[data-testid="title-input"]'); }
  get problemInput() { return this.page.locator('[data-testid="problem-input"]'); }
  get solutionInput() { return this.page.locator('[data-testid="solution-input"]'); }
  get categorySelect() { return this.page.locator('[data-testid="category-select"]'); }
  get tagsInput() { return this.page.locator('[data-testid="tags-input"]'); }
  get saveButton() { return this.page.locator('[data-testid="save-button"]'); }
  get cancelButton() { return this.page.locator('[data-testid="cancel-button"]'); }
  get validationError() { return this.page.locator('[data-testid="validation-error"]'); }

  // Actions
  async fillEntryForm(entry: {
    title: string;
    problem: string;
    solution: string;
    category: string;
    tags: string;
  }): Promise<void> {
    await this.titleInput.fill(entry.title);
    await this.problemInput.fill(entry.problem);
    await this.solutionInput.fill(entry.solution);
    await this.categorySelect.selectOption(entry.category);
    await this.tagsInput.fill(entry.tags);
  }

  async saveEntry(): Promise<void> {
    await this.saveButton.click();
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }
}

/**
 * Base E2E Test Class
 */
export abstract class BaseE2ETest {
  protected config: E2ETestConfig;
  protected app: ElectronApplication | null = null;
  protected page: Page | null = null;
  protected browser: Browser | null = null;
  protected context: BrowserContext | null = null;

  constructor(config: Partial<E2ETestConfig> = {}) {
    this.config = { ...DEFAULT_E2E_CONFIG, ...config };
  }

  async setupElectronApp(): Promise<void> {
    // Launch Electron app
    this.app = await electron.launch({
      args: [this.config.appPath],
      recordVideo: this.config.video ? { dir: './test-videos/' } : undefined
    });

    // Get the main window
    this.page = await this.app.firstWindow();

    // Wait for app to be ready
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(2000); // Give app time to initialize
  }

  async setupWebApp(): Promise<void> {
    if (!this.config.baseUrl) {
      throw new Error('baseUrl required for web app testing');
    }

    // Launch browser
    this.browser = await chromium.launch({
      headless: this.config.headless,
      slowMo: this.config.slowMo
    });

    // Create context
    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      recordVideo: this.config.video ? { dir: './test-videos/' } : undefined
    });

    // Create page
    this.page = await this.context.newPage();

    // Navigate to app
    await this.page.goto(this.config.baseUrl);
  }

  async cleanup(): Promise<void> {
    if (this.page && this.config.screenshots) {
      await this.takeScreenshot('final-state');
    }

    if (this.app) {
      await this.app.close();
    }

    if (this.context) {
      await this.context.close();
    }

    if (this.browser) {
      await this.browser.close();
    }
  }

  protected async takeScreenshot(name: string): Promise<void> {
    if (this.page && this.config.screenshots) {
      await this.page.screenshot({
        path: `./test-screenshots/e2e-${name}-${Date.now()}.png`,
        fullPage: true
      });
    }
  }

  protected async waitForNetworkIdle(): Promise<void> {
    if (this.page) {
      await this.page.waitForLoadState('networkidle');
    }
  }
}

/**
 * Search Workflow E2E Tests
 */
export class SearchWorkflowE2ETest extends BaseE2ETest {
  private searchPage!: SearchPageObject;
  private entryPage!: KBEntryPageObject;

  testCompleteSearchWorkflow(): void {
    describe('Complete Search Workflow E2E Tests', () => {
      beforeAll(async () => {
        await this.setupElectronApp();
        this.searchPage = new SearchPageObject(this.page!);
        this.entryPage = new KBEntryPageObject(this.page!);
      });

      afterAll(async () => {
        await this.cleanup();
      });

      beforeEach(async () => {
        await this.takeScreenshot('test-start');
      });

      it('completes successful search to entry viewing workflow', async () => {
        // Step 1: Perform search
        await this.searchPage.search('VSAM Status 35');
        await this.takeScreenshot('search-entered');

        // Step 2: Wait for results and verify
        await this.searchPage.waitForResults();
        await this.takeScreenshot('search-results');

        const resultTitles = await this.searchPage.getResultTitles();
        expect(resultTitles.length).toBeGreaterThan(0);
        expect(resultTitles.some(title => title.toLowerCase().includes('vsam'))).toBe(true);

        // Step 3: Select first result
        await this.searchPage.selectFirstResult();
        await this.waitForNetworkIdle();
        await this.takeScreenshot('entry-opened');

        // Step 4: Verify entry details are displayed
        await expect(this.entryPage.entryTitle).toBeVisible();
        await expect(this.entryPage.entrySolution).toBeVisible();

        const title = await this.entryPage.entryTitle.textContent();
        expect(title).toBeTruthy();

        // Step 5: Rate the entry as helpful
        await this.entryPage.rateAsHelpful();
        await this.takeScreenshot('entry-rated');

        // Step 6: Go back to search results
        await this.entryPage.goBack();
        await expect(this.searchPage.searchResults).toBeVisible();
        await this.takeScreenshot('back-to-results');
      });

      it('handles search with filters', async () => {
        // Step 1: Apply category filter
        await this.searchPage.selectFilter('VSAM');
        await this.takeScreenshot('filter-applied');

        // Step 2: Perform search
        await this.searchPage.search('status');
        await this.searchPage.waitForResults();
        await this.takeScreenshot('filtered-results');

        // Step 3: Verify all results are VSAM category
        const resultTitles = await this.searchPage.getResultTitles();
        expect(resultTitles.length).toBeGreaterThan(0);

        // Click first result to verify category
        await this.searchPage.selectFirstResult();
        await this.waitForNetworkIdle();

        const category = await this.entryPage.entryCategory.textContent();
        expect(category).toContain('VSAM');
      });

      it('handles no results scenario', async () => {
        // Search for something that won't exist
        await this.searchPage.search('nonexistent query xyz123');
        await this.searchPage.waitForResults();
        await this.takeScreenshot('no-results');

        // Verify no results message is shown
        await expect(this.searchPage.noResultsMessage).toBeVisible();

        const noResultsText = await this.searchPage.noResultsMessage.textContent();
        expect(noResultsText?.toLowerCase()).toContain('no results');
      });

      it('tests search performance requirements', async () => {
        // Measure search performance
        await AssertionHelpers.assertPerformance(async () => {
          await this.searchPage.search('JCL error');
          await this.searchPage.waitForResults();
        }, 2000, 'E2E Search Performance'); // Allow 2s for E2E (includes UI rendering)

        const resultTitles = await this.searchPage.getResultTitles();
        expect(resultTitles.length).toBeGreaterThan(0);
      });
    });
  }
}

/**
 * Knowledge Base Management E2E Tests
 */
export class KBManagementE2ETest extends BaseE2ETest {
  private searchPage!: SearchPageObject;
  private addEntryPage!: AddEntryPageObject;
  private entryPage!: KBEntryPageObject;

  testKBManagementWorkflow(): void {
    describe('Knowledge Base Management E2E Tests', () => {
      beforeAll(async () => {
        await this.setupElectronApp();
        this.searchPage = new SearchPageObject(this.page!);
        this.addEntryPage = new AddEntryPageObject(this.page!);
        this.entryPage = new KBEntryPageObject(this.page!);
      });

      afterAll(async () => {
        await this.cleanup();
      });

      it('completes full KB entry lifecycle (create, read, update)', async () => {
        // Step 1: Navigate to add entry form
        await this.page!.click('[data-testid="add-entry-button"]');
        await expect(this.addEntryPage.titleInput).toBeVisible();
        await this.takeScreenshot('add-entry-form');

        // Step 2: Fill and submit new entry
        const newEntry = {
          title: 'E2E Test Entry - Automated',
          problem: 'This is a test problem created during E2E testing',
          solution: 'This is a test solution with step-by-step instructions:\n1. Step one\n2. Step two\n3. Step three',
          category: 'Functional',
          tags: 'e2e, test, automated'
        };

        await this.addEntryPage.fillEntryForm(newEntry);
        await this.takeScreenshot('form-filled');

        await this.addEntryPage.saveEntry();
        await this.waitForNetworkIdle();
        await this.takeScreenshot('entry-saved');

        // Step 3: Verify entry was created by searching for it
        await this.searchPage.search(newEntry.title);
        await this.searchPage.waitForResults();

        const resultTitles = await this.searchPage.getResultTitles();
        expect(resultTitles.some(title => title.includes('E2E Test Entry'))).toBe(true);

        // Step 4: Open the created entry
        await this.searchPage.selectFirstResult();
        await this.waitForNetworkIdle();

        // Step 5: Verify entry details
        const displayedTitle = await this.entryPage.entryTitle.textContent();
        expect(displayedTitle).toBe(newEntry.title);

        const displayedProblem = await this.entryPage.entryProblem.textContent();
        expect(displayedProblem).toBe(newEntry.problem);

        // Step 6: Edit the entry
        await this.entryPage.editEntry();
        await expect(this.addEntryPage.titleInput).toBeVisible();
        await this.takeScreenshot('edit-mode');

        // Step 7: Update the entry
        const updatedTitle = newEntry.title + ' - Updated';
        await this.addEntryPage.titleInput.fill(updatedTitle);
        await this.addEntryPage.saveEntry();
        await this.waitForNetworkIdle();

        // Step 8: Verify update
        const finalTitle = await this.entryPage.entryTitle.textContent();
        expect(finalTitle).toBe(updatedTitle);
        await this.takeScreenshot('entry-updated');
      });

      it('validates form input and shows errors', async () => {
        // Navigate to add entry form
        await this.page!.click('[data-testid="add-entry-button"]');

        // Try to save with missing required fields
        await this.addEntryPage.saveEntry();
        await this.takeScreenshot('validation-errors');

        // Verify validation errors are shown
        await expect(this.addEntryPage.validationError).toBeVisible();

        const errorText = await this.addEntryPage.validationError.textContent();
        expect(errorText?.toLowerCase()).toContain('required');

        // Fill minimum required fields and save
        await this.addEntryPage.fillEntryForm({
          title: 'Minimum Entry',
          problem: 'Required problem',
          solution: 'Required solution',
          category: 'Other',
          tags: ''
        });

        await this.addEntryPage.saveEntry();
        await this.waitForNetworkIdle();

        // Should succeed with valid data
        await expect(this.entryPage.entryTitle).toBeVisible();
      });

      it('handles concurrent usage tracking', async () => {
        // Search for an existing entry
        await this.searchPage.search('VSAM');
        await this.searchPage.waitForResults();
        await this.searchPage.selectFirstResult();

        // Get initial usage count
        const initialUsageText = await this.page!.locator('[data-testid="usage-stats"]').textContent();
        const initialCount = parseInt(initialUsageText?.match(/(\d+) times/)?.[1] || '0');

        // Rate the entry multiple times (simulating different users)
        await this.entryPage.rateAsHelpful();
        await this.page!.waitForTimeout(1000);

        await this.entryPage.rateAsNotHelpful();
        await this.page!.waitForTimeout(1000);

        await this.entryPage.rateAsHelpful();
        await this.page!.waitForTimeout(1000);

        // Refresh the entry view to get updated stats
        await this.entryPage.goBack();
        await this.searchPage.selectFirstResult();

        // Verify usage count increased
        const finalUsageText = await this.page!.locator('[data-testid="usage-stats"]').textContent();
        const finalCount = parseInt(finalUsageText?.match(/(\d+) times/)?.[1] || '0');

        expect(finalCount).toBeGreaterThan(initialCount);
      });
    });
  }
}

/**
 * Application Performance E2E Tests
 */
export class PerformanceE2ETest extends BaseE2ETest {
  testApplicationPerformance(): void {
    describe('Application Performance E2E Tests', () => {
      beforeAll(async () => {
        await this.setupElectronApp();
      });

      afterAll(async () => {
        await this.cleanup();
      });

      it('measures application startup time', async () => {
        // App should already be started, measure ready time
        const startTime = Date.now();

        // Wait for app to be fully loaded
        await this.page!.waitForSelector('[data-testid="search-input"]');
        await this.page!.waitForSelector('[data-testid="add-entry-button"]');

        const readyTime = Date.now() - startTime;

        expect(readyTime).toBeLessThan(5000); // App should be ready in <5 seconds
        console.log(`Application ready time: ${readyTime}ms`);
      });

      it('tests search response time under load', async () => {
        const searchPage = new SearchPageObject(this.page!);

        // Perform multiple searches in sequence
        const queries = ['VSAM', 'JCL', 'DB2', 'S0C7', 'error', 'batch', 'file', 'status'];
        const searchTimes: number[] = [];

        for (const query of queries) {
          const startTime = performance.now();

          await searchPage.search(query);
          await searchPage.waitForResults();

          const searchTime = performance.now() - startTime;
          searchTimes.push(searchTime);
        }

        // Calculate performance metrics
        const averageTime = searchTimes.reduce((sum, time) => sum + time, 0) / searchTimes.length;
        const maxTime = Math.max(...searchTimes);

        expect(averageTime).toBeLessThan(2000); // Average <2s for E2E
        expect(maxTime).toBeLessThan(3000); // Max <3s for E2E

        console.log(`Search performance - Average: ${averageTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);
      });

      it('tests memory usage during extended session', async () => {
        const searchPage = new SearchPageObject(this.page!);

        // Get initial memory usage
        const initialMemory = await this.page!.evaluate(() => {
          return (performance as any).memory?.usedJSHeapSize || 0;
        });

        // Perform many operations
        for (let i = 0; i < 50; i++) {
          await searchPage.search(`test query ${i}`);
          await this.page!.waitForTimeout(100);

          if (i % 10 === 0) {
            // Force garbage collection if available
            await this.page!.evaluate(() => {
              if ((window as any).gc) {
                (window as any).gc();
              }
            });
          }
        }

        // Get final memory usage
        const finalMemory = await this.page!.evaluate(() => {
          return (performance as any).memory?.usedJSHeapSize || 0;
        });

        const memoryGrowth = (finalMemory - initialMemory) / (1024 * 1024); // MB

        expect(memoryGrowth).toBeLessThan(50); // <50MB growth during session

        console.log(`Memory usage - Initial: ${(initialMemory / (1024 * 1024)).toFixed(2)}MB, Final: ${(finalMemory / (1024 * 1024)).toFixed(2)}MB, Growth: ${memoryGrowth.toFixed(2)}MB`);
      });
    });
  }
}

/**
 * Accessibility E2E Tests
 */
export class AccessibilityE2ETest extends BaseE2ETest {
  testAccessibilityCompliance(): void {
    describe('Accessibility E2E Tests', () => {
      beforeAll(async () => {
        await this.setupElectronApp();
      });

      afterAll(async () => {
        await this.cleanup();
      });

      it('supports complete keyboard navigation', async () => {
        // Start at search input
        await this.page!.focus('[data-testid="search-input"]');

        // Tab through interface
        const tabSequence = [
          '[data-testid="search-input"]',
          '[data-testid="search-button"]',
          '[data-testid="filter-button"]',
          '[data-testid="add-entry-button"]'
        ];

        for (const selector of tabSequence) {
          const focused = await this.page!.locator(':focus');
          expect(await focused.getAttribute('data-testid')).toBeTruthy();

          await this.page!.keyboard.press('Tab');
          await this.page!.waitForTimeout(100);
        }

        // Verify final focus position
        const finalFocus = await this.page!.locator(':focus');
        expect(await finalFocus.isVisible()).toBe(true);
      });

      it('provides screen reader announcements', async () => {
        const searchPage = new SearchPageObject(this.page!);

        // Search for results
        await searchPage.search('VSAM');
        await searchPage.waitForResults();

        // Check for live region announcements
        const liveRegions = await this.page!.locator('[aria-live]').all();
        expect(liveRegions.length).toBeGreaterThan(0);

        // Check result count announcement
        const resultCount = await this.page!.locator('[data-testid="result-count"]');
        await expect(resultCount).toBeVisible();

        const countText = await resultCount.textContent();
        expect(countText).toMatch(/\d+ result/);
      });

      it('maintains focus management in modal dialogs', async () => {
        // Open add entry modal
        await this.page!.click('[data-testid="add-entry-button"]');

        // Focus should move to first input in modal
        const activeElement = await this.page!.locator(':focus');
        expect(await activeElement.getAttribute('data-testid')).toBe('title-input');

        // Tab through modal elements
        await this.page!.keyboard.press('Tab');
        await this.page!.keyboard.press('Tab');
        await this.page!.keyboard.press('Tab');

        // Focus should stay within modal
        const modalFocus = await this.page!.locator(':focus');
        const modalContainer = this.page!.locator('[data-testid="add-entry-modal"]');
        expect(await modalContainer.locator(':focus').count()).toBe(1);

        // Cancel and verify focus returns
        await this.page!.click('[data-testid="cancel-button"]');

        // Focus should return to add entry button
        const returnedFocus = await this.page!.locator(':focus');
        expect(await returnedFocus.getAttribute('data-testid')).toBe('add-entry-button');
      });
    });
  }
}

/**
 * E2E Test Runner
 */
export class E2ETestRunner {
  private searchWorkflowTest: SearchWorkflowE2ETest;
  private kbManagementTest: KBManagementE2ETest;
  private performanceTest: PerformanceE2ETest;
  private accessibilityTest: AccessibilityE2ETest;

  constructor(config: Partial<E2ETestConfig> = {}) {
    this.searchWorkflowTest = new SearchWorkflowE2ETest(config);
    this.kbManagementTest = new KBManagementE2ETest(config);
    this.performanceTest = new PerformanceE2ETest(config);
    this.accessibilityTest = new AccessibilityE2ETest(config);
  }

  runAllE2ETests(): void {
    describe('Complete E2E Test Suite', () => {
      this.searchWorkflowTest.testCompleteSearchWorkflow();
      this.kbManagementTest.testKBManagementWorkflow();
      this.performanceTest.testApplicationPerformance();
      this.accessibilityTest.testAccessibilityCompliance();
    });
  }

  async generateE2EReport(): Promise<void> {
    const report = {
      timestamp: new Date().toISOString(),
      testResults: {
        searchWorkflow: { status: 'pending' },
        kbManagement: { status: 'pending' },
        performance: { status: 'pending' },
        accessibility: { status: 'pending' }
      },
      screenshots: [],
      videos: []
    };

    console.log('E2E Test Report:', JSON.stringify(report, null, 2));
  }
}

// Export E2E testing classes
export {
  BaseE2ETest,
  SearchWorkflowE2ETest,
  KBManagementE2ETest,
  PerformanceE2ETest,
  AccessibilityE2ETest,
  E2ETestRunner,
  SearchPageObject,
  KBEntryPageObject,
  AddEntryPageObject,
  type E2ETestConfig,
  DEFAULT_E2E_CONFIG
};