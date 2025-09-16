/**
 * Comprehensive CRUD Workflow E2E Tests
 *
 * Tests complete Create, Read, Update, Delete operations for knowledge base entries:
 * - Entry creation with validation
 * - Entry reading and display
 * - Entry modification workflows
 * - Entry deletion with confirmation
 * - Bulk operations
 * - Data integrity validation
 * - Concurrent access handling
 * - Version control and history
 */

import { test, expect, Page } from '@playwright/test';

interface KBEntry {
  id?: string;
  title: string;
  problem: string;
  solution: string;
  category: string;
  tags: string[];
  priority?: 'Low' | 'Medium' | 'High';
  status?: 'Draft' | 'Published' | 'Archived';
  createdBy?: string;
  modifiedBy?: string;
  created?: string;
  modified?: string;
}

interface CRUDTestMetrics {
  operationTimes: {
    create: number;
    read: number;
    update: number;
    delete: number;
  };
  validationErrors: string[];
  dataIntegrityChecks: boolean[];
  concurrencyIssues: string[];
}

class CRUDWorkflowTester {
  private page: Page;
  private metrics: CRUDTestMetrics;
  private testEntries: KBEntry[] = [];

  constructor(page: Page) {
    this.page = page;
    this.metrics = {
      operationTimes: { create: 0, read: 0, update: 0, delete: 0 },
      validationErrors: [],
      dataIntegrityChecks: [],
      concurrencyIssues: []
    };
  }

  async createEntry(entry: KBEntry): Promise<string> {
    const startTime = Date.now();

    try {
      // Navigate to create entry form
      await this.page.click('[data-testid="add-entry-button"]');
      await this.page.waitForSelector('[data-testid="entry-form"]', { timeout: 5000 });

      // Fill basic information
      await this.page.fill('[data-testid="entry-title-input"]', entry.title);
      await this.page.fill('[data-testid="entry-problem-input"]', entry.problem);
      await this.page.fill('[data-testid="entry-solution-input"]', entry.solution);

      // Select category
      await this.page.selectOption('[data-testid="entry-category-select"]', entry.category);

      // Add tags
      if (entry.tags && entry.tags.length > 0) {
        const tagsInput = this.page.locator('[data-testid="entry-tags-input"]');
        await tagsInput.fill(entry.tags.join(', '));
      }

      // Set priority if provided
      if (entry.priority) {
        await this.page.selectOption('[data-testid="entry-priority-select"]', entry.priority);
      }

      // Set status if provided
      if (entry.status) {
        await this.page.selectOption('[data-testid="entry-status-select"]', entry.status);
      }

      // Submit the form
      await this.page.click('[data-testid="save-entry-button"]');

      // Wait for success confirmation
      await this.page.waitForSelector('[data-testid="entry-saved-success"]', { timeout: 10000 });

      // Get the created entry ID
      const entryId = await this.page.locator('[data-testid="created-entry-id"]').textContent();

      this.metrics.operationTimes.create = Date.now() - startTime;
      return entryId || '';
    } catch (error) {
      this.metrics.validationErrors.push(`Create operation failed: ${error.message}`);
      throw error;
    }
  }

  async readEntry(entryId: string): Promise<KBEntry> {
    const startTime = Date.now();

    try {
      // Navigate directly to entry
      await this.page.goto(`#/entry/${entryId}`);
      await this.page.waitForSelector('[data-testid="entry-detail"]', { timeout: 5000 });

      // Extract entry data
      const entry: KBEntry = {
        id: entryId,
        title: await this.page.locator('[data-testid="entry-title"]').textContent() || '',
        problem: await this.page.locator('[data-testid="entry-problem"]').textContent() || '',
        solution: await this.page.locator('[data-testid="entry-solution"]').textContent() || '',
        category: await this.page.locator('[data-testid="entry-category"]').textContent() || '',
        tags: [],
        priority: await this.page.locator('[data-testid="entry-priority"]').textContent() as any,
        status: await this.page.locator('[data-testid="entry-status"]').textContent() as any,
        created: await this.page.locator('[data-testid="entry-created"]').textContent() || '',
        modified: await this.page.locator('[data-testid="entry-modified"]').textContent() || ''
      };

      // Extract tags
      const tagElements = await this.page.locator('[data-testid="entry-tag"]').all();
      entry.tags = await Promise.all(tagElements.map(tag => tag.textContent().then(text => text || '')));

      this.metrics.operationTimes.read = Date.now() - startTime;
      return entry;
    } catch (error) {
      this.metrics.validationErrors.push(`Read operation failed: ${error.message}`);
      throw error;
    }
  }

  async updateEntry(entryId: string, updates: Partial<KBEntry>): Promise<void> {
    const startTime = Date.now();

    try {
      // Navigate to entry and start editing
      await this.page.goto(`#/entry/${entryId}`);
      await this.page.waitForSelector('[data-testid="entry-detail"]', { timeout: 5000 });
      await this.page.click('[data-testid="edit-entry-button"]');
      await this.page.waitForSelector('[data-testid="entry-form"]', { timeout: 5000 });

      // Apply updates
      if (updates.title !== undefined) {
        await this.page.fill('[data-testid="entry-title-input"]', updates.title);
      }

      if (updates.problem !== undefined) {
        await this.page.fill('[data-testid="entry-problem-input"]', updates.problem);
      }

      if (updates.solution !== undefined) {
        await this.page.fill('[data-testid="entry-solution-input"]', updates.solution);
      }

      if (updates.category !== undefined) {
        await this.page.selectOption('[data-testid="entry-category-select"]', updates.category);
      }

      if (updates.tags !== undefined) {
        await this.page.fill('[data-testid="entry-tags-input"]', updates.tags.join(', '));
      }

      if (updates.priority !== undefined) {
        await this.page.selectOption('[data-testid="entry-priority-select"]', updates.priority);
      }

      if (updates.status !== undefined) {
        await this.page.selectOption('[data-testid="entry-status-select"]', updates.status);
      }

      // Save changes
      await this.page.click('[data-testid="save-entry-button"]');
      await this.page.waitForSelector('[data-testid="entry-updated-success"]', { timeout: 10000 });

      this.metrics.operationTimes.update = Date.now() - startTime;
    } catch (error) {
      this.metrics.validationErrors.push(`Update operation failed: ${error.message}`);
      throw error;
    }
  }

  async deleteEntry(entryId: string, confirmDeletion: boolean = true): Promise<void> {
    const startTime = Date.now();

    try {
      // Navigate to entry
      await this.page.goto(`#/entry/${entryId}`);
      await this.page.waitForSelector('[data-testid="entry-detail"]', { timeout: 5000 });

      // Click delete button
      await this.page.click('[data-testid="delete-entry-button"]');

      // Handle confirmation dialog
      await this.page.waitForSelector('[data-testid="delete-confirmation-dialog"]', { timeout: 5000 });

      if (confirmDeletion) {
        await this.page.click('[data-testid="confirm-delete-button"]');
        await this.page.waitForSelector('[data-testid="entry-deleted-success"]', { timeout: 10000 });
      } else {
        await this.page.click('[data-testid="cancel-delete-button"]');
      }

      this.metrics.operationTimes.delete = Date.now() - startTime;
    } catch (error) {
      this.metrics.validationErrors.push(`Delete operation failed: ${error.message}`);
      throw error;
    }
  }

  async searchEntry(searchTerm: string): Promise<string[]> {
    await this.page.goto('#/search');
    await this.page.fill('[data-testid="search-input"]', searchTerm);
    await this.page.click('[data-testid="search-button"]');

    await Promise.race([
      this.page.waitForSelector('[data-testid="search-results"]', { timeout: 5000 }),
      this.page.waitForSelector('[data-testid="no-results"]', { timeout: 5000 })
    ]);

    const resultElements = await this.page.locator('[data-testid^="search-result-"]').all();
    const entryIds = await Promise.all(
      resultElements.map(element => element.getAttribute('data-entry-id').then(id => id || ''))
    );

    return entryIds.filter(id => id !== '');
  }

  async validateEntryIntegrity(entry: KBEntry): Promise<boolean> {
    try {
      // Check required fields
      if (!entry.title || !entry.problem || !entry.solution || !entry.category) {
        this.metrics.dataIntegrityChecks.push(false);
        return false;
      }

      // Check field lengths
      if (entry.title.length > 200 || entry.problem.length > 2000 || entry.solution.length > 5000) {
        this.metrics.dataIntegrityChecks.push(false);
        return false;
      }

      // Check category validity
      const validCategories = ['VSAM', 'JCL', 'DB2', 'COBOL', 'System', 'Performance', 'Security', 'Other'];
      if (!validCategories.includes(entry.category)) {
        this.metrics.dataIntegrityChecks.push(false);
        return false;
      }

      this.metrics.dataIntegrityChecks.push(true);
      return true;
    } catch (error) {
      this.metrics.validationErrors.push(`Integrity validation failed: ${error.message}`);
      this.metrics.dataIntegrityChecks.push(false);
      return false;
    }
  }

  async performBulkCreate(entries: KBEntry[]): Promise<string[]> {
    const createdIds: string[] = [];

    // Check if bulk create UI is available
    await this.page.click('[data-testid="bulk-operations-button"]');
    await this.page.click('[data-testid="bulk-create-entries"]');
    await this.page.waitForSelector('[data-testid="bulk-create-form"]', { timeout: 5000 });

    // Upload entries as JSON or CSV
    const entriesJson = JSON.stringify(entries);
    await this.page.fill('[data-testid="bulk-data-input"]', entriesJson);

    // Submit bulk create
    await this.page.click('[data-testid="submit-bulk-create"]');
    await this.page.waitForSelector('[data-testid="bulk-create-results"]', { timeout: 30000 });

    // Extract created entry IDs
    const resultElements = await this.page.locator('[data-testid^="created-entry-"]').all();
    for (const element of resultElements) {
      const entryId = await element.getAttribute('data-entry-id');
      if (entryId) createdIds.push(entryId);
    }

    return createdIds;
  }

  async performBulkUpdate(entryIds: string[], updates: Partial<KBEntry>): Promise<void> {
    await this.page.click('[data-testid="bulk-operations-button"]');
    await this.page.click('[data-testid="bulk-update-entries"]');
    await this.page.waitForSelector('[data-testid="bulk-update-form"]', { timeout: 5000 });

    // Select entries for bulk update
    for (const entryId of entryIds) {
      await this.page.check(`[data-testid="select-entry-${entryId}"]`);
    }

    // Apply updates
    if (updates.category) {
      await this.page.selectOption('[data-testid="bulk-category-select"]', updates.category);
    }

    if (updates.priority) {
      await this.page.selectOption('[data-testid="bulk-priority-select"]', updates.priority);
    }

    if (updates.status) {
      await this.page.selectOption('[data-testid="bulk-status-select"]', updates.status);
    }

    if (updates.tags) {
      await this.page.fill('[data-testid="bulk-tags-input"]', updates.tags.join(', '));
    }

    // Submit bulk update
    await this.page.click('[data-testid="submit-bulk-update"]');
    await this.page.waitForSelector('[data-testid="bulk-update-success"]', { timeout: 30000 });
  }

  async performBulkDelete(entryIds: string[]): Promise<void> {
    await this.page.click('[data-testid="bulk-operations-button"]');
    await this.page.click('[data-testid="bulk-delete-entries"]');
    await this.page.waitForSelector('[data-testid="bulk-delete-form"]', { timeout: 5000 });

    // Select entries for bulk delete
    for (const entryId of entryIds) {
      await this.page.check(`[data-testid="select-entry-${entryId}"]`);
    }

    // Confirm bulk delete
    await this.page.click('[data-testid="submit-bulk-delete"]');
    await this.page.waitForSelector('[data-testid="bulk-delete-confirmation"]', { timeout: 5000 });
    await this.page.click('[data-testid="confirm-bulk-delete"]');
    await this.page.waitForSelector('[data-testid="bulk-delete-success"]', { timeout: 30000 });
  }

  async testConcurrentAccess(entryId: string): Promise<void> {
    // Simulate concurrent access by opening multiple windows/tabs
    const context = this.page.context();
    const page2 = await context.newPage();

    try {
      // Both pages navigate to the same entry
      await Promise.all([
        this.page.goto(`#/entry/${entryId}`),
        page2.goto(`#/entry/${entryId}`)
      ]);

      // Both start editing simultaneously
      await Promise.all([
        this.page.click('[data-testid="edit-entry-button"]'),
        page2.click('[data-testid="edit-entry-button"]')
      ]);

      // Make different changes
      await this.page.fill('[data-testid="entry-title-input"]', 'Concurrent Edit 1');
      await page2.fill('[data-testid="entry-title-input"]', 'Concurrent Edit 2');

      // Try to save - should handle conflicts
      await Promise.all([
        this.page.click('[data-testid="save-entry-button"]'),
        page2.click('[data-testid="save-entry-button"]')
      ]);

      // Check for conflict resolution UI
      const conflictDialog = this.page.locator('[data-testid="edit-conflict-dialog"]');
      if (await conflictDialog.isVisible()) {
        // Handle conflict resolution
        await this.page.click('[data-testid="resolve-conflict-keep-mine"]');
      }

    } catch (error) {
      this.metrics.concurrencyIssues.push(`Concurrent access test failed: ${error.message}`);
    } finally {
      await page2.close();
    }
  }

  getMetrics(): CRUDTestMetrics {
    return { ...this.metrics };
  }
}

test.describe('Comprehensive CRUD Workflow Tests', () => {
  let crudTester: CRUDWorkflowTester;

  test.beforeEach(async ({ page }) => {
    crudTester = new CRUDWorkflowTester(page);

    // Setup test environment
    await page.goto('/');
    await page.waitForSelector('[data-testid="app-root"]', { timeout: 10000 });
  });

  test('Complete CRUD lifecycle for single entry', async () => {
    const testEntry: KBEntry = {
      title: 'CRUD Test Entry - Complete Lifecycle',
      problem: 'This is a test problem to validate CRUD operations work correctly across the entire lifecycle',
      solution: 'Step-by-step solution:\n1. Create the entry\n2. Read and verify\n3. Update fields\n4. Delete safely',
      category: 'Testing',
      tags: ['crud', 'test', 'lifecycle'],
      priority: 'Medium',
      status: 'Draft'
    };

    // CREATE: Create new entry
    const entryId = await crudTester.createEntry(testEntry);
    expect(entryId).toBeTruthy();

    // READ: Verify entry was created correctly
    const createdEntry = await crudTester.readEntry(entryId);
    expect(createdEntry.title).toBe(testEntry.title);
    expect(createdEntry.problem).toBe(testEntry.problem);
    expect(createdEntry.solution).toBe(testEntry.solution);
    expect(createdEntry.category).toBe(testEntry.category);
    expect(createdEntry.priority).toBe(testEntry.priority);
    expect(createdEntry.status).toBe(testEntry.status);

    // Validate data integrity
    const isValid = await crudTester.validateEntryIntegrity(createdEntry);
    expect(isValid).toBe(true);

    // UPDATE: Modify the entry
    const updates: Partial<KBEntry> = {
      title: 'CRUD Test Entry - Updated',
      priority: 'High',
      status: 'Published',
      tags: ['crud', 'test', 'lifecycle', 'updated']
    };

    await crudTester.updateEntry(entryId, updates);

    // READ: Verify updates were applied
    const updatedEntry = await crudTester.readEntry(entryId);
    expect(updatedEntry.title).toBe(updates.title);
    expect(updatedEntry.priority).toBe(updates.priority);
    expect(updatedEntry.status).toBe(updates.status);
    expect(updatedEntry.tags).toContain('updated');

    // DELETE: Remove the entry
    await crudTester.deleteEntry(entryId, true);

    // Verify entry is no longer accessible
    try {
      await crudTester.readEntry(entryId);
      fail('Entry should not be accessible after deletion');
    } catch (error) {
      expect(error.message).toContain('not found');
    }

    const metrics = crudTester.getMetrics();
    console.log('CRUD Lifecycle Metrics:', metrics);

    expect(metrics.operationTimes.create).toBeLessThan(10000);
    expect(metrics.operationTimes.read).toBeLessThan(3000);
    expect(metrics.operationTimes.update).toBeLessThan(8000);
    expect(metrics.operationTimes.delete).toBeLessThan(5000);
  });

  test('Entry creation with validation testing', async () => {
    const invalidEntries: Partial<KBEntry>[] = [
      { title: '', problem: 'Valid problem', solution: 'Valid solution', category: 'VSAM' },
      { title: 'Valid title', problem: '', solution: 'Valid solution', category: 'VSAM' },
      { title: 'Valid title', problem: 'Valid problem', solution: '', category: 'VSAM' },
      { title: 'Valid title', problem: 'Valid problem', solution: 'Valid solution', category: '' },
      { title: 'x'.repeat(201), problem: 'Valid problem', solution: 'Valid solution', category: 'VSAM' }
    ];

    for (const invalidEntry of invalidEntries) {
      try {
        await crudTester.createEntry(invalidEntry as KBEntry);
        fail('Should have failed validation');
      } catch (error) {
        expect(error.message).toContain('validation');
      }
    }

    // Test valid entry creation
    const validEntry: KBEntry = {
      title: 'Valid Test Entry',
      problem: 'Valid problem description',
      solution: 'Valid solution description',
      category: 'VSAM',
      tags: ['valid', 'test'],
      priority: 'Low',
      status: 'Draft'
    };

    const entryId = await crudTester.createEntry(validEntry);
    expect(entryId).toBeTruthy();

    // Cleanup
    await crudTester.deleteEntry(entryId, true);
  });

  test('Bulk operations workflow', async () => {
    const bulkEntries: KBEntry[] = [
      {
        title: 'Bulk Entry 1',
        problem: 'Bulk problem 1',
        solution: 'Bulk solution 1',
        category: 'VSAM',
        tags: ['bulk', 'test1'],
        priority: 'Low',
        status: 'Draft'
      },
      {
        title: 'Bulk Entry 2',
        problem: 'Bulk problem 2',
        solution: 'Bulk solution 2',
        category: 'JCL',
        tags: ['bulk', 'test2'],
        priority: 'Medium',
        status: 'Draft'
      },
      {
        title: 'Bulk Entry 3',
        problem: 'Bulk problem 3',
        solution: 'Bulk solution 3',
        category: 'DB2',
        tags: ['bulk', 'test3'],
        priority: 'High',
        status: 'Draft'
      }
    ];

    // Bulk create
    const createdIds = await crudTester.performBulkCreate(bulkEntries);
    expect(createdIds).toHaveLength(3);

    // Verify all entries were created
    for (const entryId of createdIds) {
      const entry = await crudTester.readEntry(entryId);
      expect(entry.tags).toContain('bulk');
    }

    // Bulk update
    await crudTester.performBulkUpdate(createdIds, {
      status: 'Published',
      tags: ['bulk', 'updated']
    });

    // Verify bulk updates
    for (const entryId of createdIds) {
      const entry = await crudTester.readEntry(entryId);
      expect(entry.status).toBe('Published');
      expect(entry.tags).toContain('updated');
    }

    // Bulk delete
    await crudTester.performBulkDelete(createdIds);

    // Verify all entries were deleted
    for (const entryId of createdIds) {
      try {
        await crudTester.readEntry(entryId);
        fail(`Entry ${entryId} should have been deleted`);
      } catch (error) {
        expect(error.message).toContain('not found');
      }
    }
  });

  test('Entry search and retrieval workflow', async () => {
    const searchTestEntry: KBEntry = {
      title: 'VSAM File Status 35 Error',
      problem: 'VSAM dataset returns status code 35 when trying to open',
      solution: 'Check dataset catalog and verify file allocation',
      category: 'VSAM',
      tags: ['vsam', 'status-35', 'file-error'],
      priority: 'High',
      status: 'Published'
    };

    // Create entry for searching
    const entryId = await crudTester.createEntry(searchTestEntry);

    // Test various search scenarios
    const searchTests = [
      { term: 'VSAM', expectedResults: 1 },
      { term: 'status 35', expectedResults: 1 },
      { term: 'file error', expectedResults: 1 },
      { term: searchTestEntry.title, expectedResults: 1 },
      { term: 'nonexistent term xyz123', expectedResults: 0 }
    ];

    for (const searchTest of searchTests) {
      const foundIds = await crudTester.searchEntry(searchTest.term);

      if (searchTest.expectedResults > 0) {
        expect(foundIds).toContain(entryId);
      } else {
        expect(foundIds).toHaveLength(0);
      }
    }

    // Cleanup
    await crudTester.deleteEntry(entryId, true);
  });

  test('Concurrent access and conflict resolution', async () => {
    const concurrentTestEntry: KBEntry = {
      title: 'Concurrent Access Test Entry',
      problem: 'Testing concurrent modification scenarios',
      solution: 'This entry will be modified by multiple users simultaneously',
      category: 'Testing',
      tags: ['concurrent', 'test'],
      priority: 'Medium',
      status: 'Draft'
    };

    // Create entry for concurrent testing
    const entryId = await crudTester.createEntry(concurrentTestEntry);

    // Test concurrent access
    await crudTester.testConcurrentAccess(entryId);

    // Verify entry still exists and is consistent
    const finalEntry = await crudTester.readEntry(entryId);
    expect(finalEntry.id).toBe(entryId);

    const isValid = await crudTester.validateEntryIntegrity(finalEntry);
    expect(isValid).toBe(true);

    // Cleanup
    await crudTester.deleteEntry(entryId, true);

    const metrics = crudTester.getMetrics();
    console.log('Concurrent Access Metrics:', metrics);
  });

  test('Entry versioning and history workflow', async ({ page }) => {
    const versionTestEntry: KBEntry = {
      title: 'Version Control Test Entry',
      problem: 'Testing entry versioning capabilities',
      solution: 'Initial solution version',
      category: 'Testing',
      tags: ['version', 'test'],
      priority: 'Low',
      status: 'Draft'
    };

    // Create initial entry
    const entryId = await crudTester.createEntry(versionTestEntry);

    // Make multiple updates to create version history
    const versions = [
      { solution: 'Updated solution version 1', priority: 'Medium' },
      { solution: 'Updated solution version 2', status: 'Published' },
      { solution: 'Final solution version 3', priority: 'High' }
    ];

    for (const [index, update] of versions.entries()) {
      await crudTester.updateEntry(entryId, update);

      // Check if version history is recorded
      await page.goto(`#/entry/${entryId}/history`);

      const versionElements = await page.locator('[data-testid^="version-"]').count();
      expect(versionElements).toBeGreaterThanOrEqual(index + 1);
    }

    // Test version comparison
    await page.click('[data-testid="compare-versions"]');
    await page.selectOption('[data-testid="version-from-select"]', '1');
    await page.selectOption('[data-testid="version-to-select"]', '3');
    await page.click('[data-testid="show-diff"]');

    await expect(page.locator('[data-testid="version-diff"]')).toBeVisible();

    // Test version restoration
    await page.click('[data-testid="restore-version-1"]');
    await page.click('[data-testid="confirm-restore"]');

    const restoredEntry = await crudTester.readEntry(entryId);
    expect(restoredEntry.solution).toBe('Updated solution version 1');

    // Cleanup
    await crudTester.deleteEntry(entryId, true);
  });

  test('Data validation and integrity checks', async () => {
    const testCases = [
      // XSS prevention
      {
        title: '<script>alert("xss")</script>Title',
        problem: 'Normal problem',
        solution: 'Normal solution',
        category: 'Security',
        tags: ['xss', 'test'],
        expectSanitized: true
      },
      // SQL injection prevention
      {
        title: "'; DROP TABLE entries; --",
        problem: 'Normal problem',
        solution: 'Normal solution',
        category: 'Security',
        tags: ['sql', 'test'],
        expectSanitized: true
      },
      // Unicode handling
      {
        title: 'Unicode Test Entry 中文 Ñoñó 🚀',
        problem: 'Unicode in problem field äöü',
        solution: 'Unicode solution ñáéíóú',
        category: 'Testing',
        tags: ['unicode', 'test'],
        expectSanitized: false
      }
    ];

    for (const testCase of testCases) {
      const entryId = await crudTester.createEntry(testCase as KBEntry);
      const createdEntry = await crudTester.readEntry(entryId);

      if (testCase.expectSanitized) {
        expect(createdEntry.title).not.toContain('<script>');
        expect(createdEntry.title).not.toContain('DROP TABLE');
      } else {
        expect(createdEntry.title).toBe(testCase.title);
        expect(createdEntry.problem).toBe(testCase.problem);
        expect(createdEntry.solution).toBe(testCase.solution);
      }

      const isValid = await crudTester.validateEntryIntegrity(createdEntry);
      expect(isValid).toBe(true);

      await crudTester.deleteEntry(entryId, true);
    }

    const metrics = crudTester.getMetrics();
    expect(metrics.dataIntegrityChecks.every(check => check)).toBe(true);
  });

  test('Performance validation for CRUD operations', async () => {
    const performanceTestEntries: KBEntry[] = Array.from({ length: 10 }, (_, i) => ({
      title: `Performance Test Entry ${i + 1}`,
      problem: `Performance test problem ${i + 1}`,
      solution: `Performance test solution ${i + 1}`,
      category: 'Performance',
      tags: ['performance', 'test', `batch-${i + 1}`],
      priority: 'Medium',
      status: 'Draft'
    }));

    const startTime = Date.now();

    // Create multiple entries
    const entryIds: string[] = [];
    for (const entry of performanceTestEntries) {
      const entryId = await crudTester.createEntry(entry);
      entryIds.push(entryId);
    }

    const createTime = Date.now() - startTime;

    // Read all entries
    const readStartTime = Date.now();
    for (const entryId of entryIds) {
      await crudTester.readEntry(entryId);
    }
    const readTime = Date.now() - readStartTime;

    // Update all entries
    const updateStartTime = Date.now();
    for (const entryId of entryIds) {
      await crudTester.updateEntry(entryId, { priority: 'High' });
    }
    const updateTime = Date.now() - updateStartTime;

    // Delete all entries
    const deleteStartTime = Date.now();
    for (const entryId of entryIds) {
      await crudTester.deleteEntry(entryId, true);
    }
    const deleteTime = Date.now() - deleteStartTime;

    // Performance assertions
    expect(createTime / entryIds.length).toBeLessThan(5000); // <5s per create
    expect(readTime / entryIds.length).toBeLessThan(2000);   // <2s per read
    expect(updateTime / entryIds.length).toBeLessThan(4000); // <4s per update
    expect(deleteTime / entryIds.length).toBeLessThan(3000); // <3s per delete

    const metrics = crudTester.getMetrics();
    console.log('Performance Test Metrics:', {
      avgCreateTime: createTime / entryIds.length,
      avgReadTime: readTime / entryIds.length,
      avgUpdateTime: updateTime / entryIds.length,
      avgDeleteTime: deleteTime / entryIds.length,
      ...metrics
    });
  });
});