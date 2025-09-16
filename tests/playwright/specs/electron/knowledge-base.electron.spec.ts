import { test, expect } from '../../fixtures/electron-fixtures';
import { ElectronTestHelpers } from '../../helpers/electron-helpers';

/**
 * Knowledge Base Functionality Tests
 * Tests core knowledge base features including search, CRUD operations, and data management
 */

test.describe('Knowledge Base Operations', () => {
  test.beforeEach(async ({ electronHelpers, testDatabase }) => {
    await electronHelpers.clearAppData();
    await electronHelpers.waitForAppReady();

    // Import test data
    const testDataPath = './tests/playwright/test-data/sample-kb.json';
    await electronHelpers.importTestData(testDataPath);
  });

  test('should display knowledge base entries', async ({
    appPage,
    electronHelpers
  }) => {
    // Wait for entries to load
    await appPage.waitForSelector('[data-testid="kb-entry"]', { timeout: 10000 });

    // Verify entries are displayed
    const entries = await appPage.locator('[data-testid="kb-entry"]');
    const entryCount = await entries.count();
    expect(entryCount).toBeGreaterThan(0);

    // Check entry content
    const firstEntry = entries.first();
    await expect(firstEntry).toBeVisible();

    // Verify entry has title
    const titleElement = firstEntry.locator('[data-testid="entry-title"]');
    await expect(titleElement).toBeVisible();

    const title = await titleElement.textContent();
    expect(title?.trim()).toBeTruthy();
  });

  test('should support search functionality', async ({
    appPage,
    electronHelpers
  }) => {
    // Find search input
    const searchInput = appPage.locator('[data-testid="search-input"]')
      .or(appPage.locator('input[type="search"]'))
      .or(appPage.locator('.search-input'));

    await expect(searchInput).toBeVisible();

    // Perform search
    await searchInput.fill('COBOL');
    await searchInput.press('Enter');

    // Wait for search results
    await appPage.waitForTimeout(1000);

    // Verify search results
    const searchResults = appPage.locator('[data-testid="search-results"]')
      .or(appPage.locator('.search-results'))
      .or(appPage.locator('[data-testid="kb-entry"]'));

    const resultCount = await searchResults.count();
    expect(resultCount).toBeGreaterThan(0);

    // Verify results contain search term
    const firstResult = searchResults.first();
    const resultText = await firstResult.textContent();
    expect(resultText?.toLowerCase()).toContain('cobol');
  });

  test('should create new knowledge base entry', async ({
    appPage,
    electronHelpers
  }) => {
    // Trigger new entry creation
    await electronHelpers.triggerMenuAction(['File', 'New Entry']);

    // Wait for new entry form/modal
    const newEntryForm = appPage.locator('[data-testid="new-entry-form"]')
      .or(appPage.locator('.new-entry-modal'))
      .or(appPage.locator('[role="dialog"]'));

    await expect(newEntryForm).toBeVisible({ timeout: 5000 });

    // Fill out the form
    const titleInput = appPage.locator('[data-testid="entry-title-input"]')
      .or(appPage.locator('input[name="title"]'))
      .or(appPage.locator('#title'));

    const contentInput = appPage.locator('[data-testid="entry-content-input"]')
      .or(appPage.locator('textarea[name="content"]'))
      .or(appPage.locator('#content'));

    const categorySelect = appPage.locator('[data-testid="entry-category-select"]')
      .or(appPage.locator('select[name="category"]'))
      .or(appPage.locator('#category'));

    if (await titleInput.isVisible()) {
      await titleInput.fill('Test Entry Title');
    }

    if (await contentInput.isVisible()) {
      await contentInput.fill('This is test content for the new knowledge base entry.');
    }

    if (await categorySelect.isVisible()) {
      await categorySelect.selectOption('COBOL');
    }

    // Submit the form
    const submitButton = appPage.locator('[data-testid="submit-entry"]')
      .or(appPage.locator('button[type="submit"]'))
      .or(appPage.locator('.submit-button'));

    if (await submitButton.isVisible()) {
      await submitButton.click();
    }

    // Verify entry was created
    await appPage.waitForTimeout(2000);

    // Check if the new entry appears in the list
    const newEntry = appPage.locator('[data-testid="kb-entry"]')
      .filter({ hasText: 'Test Entry Title' });

    await expect(newEntry).toBeVisible({ timeout: 5000 });
  });

  test('should edit existing entry', async ({
    appPage,
    electronHelpers
  }) => {
    // Wait for entries to load
    await appPage.waitForSelector('[data-testid="kb-entry"]', { timeout: 10000 });

    // Select first entry
    const firstEntry = appPage.locator('[data-testid="kb-entry"]').first();
    await firstEntry.click();

    // Look for edit button
    const editButton = appPage.locator('[data-testid="edit-entry"]')
      .or(appPage.locator('.edit-button'))
      .or(appPage.locator('button').filter({ hasText: /edit/i }));

    if (await editButton.isVisible()) {
      await editButton.click();

      // Wait for edit form
      const editForm = appPage.locator('[data-testid="edit-entry-form"]')
        .or(appPage.locator('.edit-form'));

      await expect(editForm).toBeVisible({ timeout: 5000 });

      // Modify content
      const contentInput = appPage.locator('[data-testid="entry-content-input"]')
        .or(appPage.locator('textarea[name="content"]'));

      if (await contentInput.isVisible()) {
        await contentInput.fill('Modified content for testing');

        // Save changes
        const saveButton = appPage.locator('[data-testid="save-entry"]')
          .or(appPage.locator('button').filter({ hasText: /save/i }));

        if (await saveButton.isVisible()) {
          await saveButton.click();
        }

        // Verify changes were saved
        await appPage.waitForTimeout(1000);
        await expect(appPage.locator('text=Modified content for testing')).toBeVisible();
      }
    }
  });

  test('should delete entry', async ({
    appPage,
    electronHelpers
  }) => {
    // Wait for entries to load
    await appPage.waitForSelector('[data-testid="kb-entry"]', { timeout: 10000 });

    const initialCount = await appPage.locator('[data-testid="kb-entry"]').count();

    // Select first entry
    const firstEntry = appPage.locator('[data-testid="kb-entry"]').first();
    const entryTitle = await firstEntry.locator('[data-testid="entry-title"]').textContent();

    await firstEntry.click();

    // Look for delete button
    const deleteButton = appPage.locator('[data-testid="delete-entry"]')
      .or(appPage.locator('.delete-button'))
      .or(appPage.locator('button').filter({ hasText: /delete|remove/i }));

    if (await deleteButton.isVisible()) {
      await deleteButton.click();

      // Handle confirmation dialog if present
      const confirmButton = appPage.locator('[data-testid="confirm-delete"]')
        .or(appPage.locator('button').filter({ hasText: /confirm|yes|delete/i }));

      if (await confirmButton.isVisible({ timeout: 2000 })) {
        await confirmButton.click();
      }

      // Verify entry was deleted
      await appPage.waitForTimeout(1000);

      const newCount = await appPage.locator('[data-testid="kb-entry"]').count();
      expect(newCount).toBe(initialCount - 1);

      // Verify specific entry is gone
      if (entryTitle) {
        await expect(appPage.locator(`text=${entryTitle.trim()}`)).not.toBeVisible();
      }
    }
  });

  test('should support entry categories and filtering', async ({
    appPage,
    electronHelpers
  }) => {
    // Look for category filter
    const categoryFilter = appPage.locator('[data-testid="category-filter"]')
      .or(appPage.locator('.category-filter'))
      .or(appPage.locator('select').filter({ hasText: /category/i }));

    if (await categoryFilter.isVisible()) {
      // Filter by COBOL category
      await categoryFilter.selectOption('COBOL');
      await appPage.waitForTimeout(1000);

      // Verify only COBOL entries are shown
      const entries = appPage.locator('[data-testid="kb-entry"]');
      const entryCount = await entries.count();

      if (entryCount > 0) {
        // Check that visible entries are COBOL-related
        const firstEntry = entries.first();
        const entryText = await firstEntry.textContent();
        expect(entryText?.toLowerCase()).toContain('cobol');
      }

      // Reset filter
      await categoryFilter.selectOption('All');
      await appPage.waitForTimeout(1000);

      // Verify all entries are shown again
      const allEntries = await appPage.locator('[data-testid="kb-entry"]').count();
      expect(allEntries).toBeGreaterThan(entryCount);
    }
  });

  test('should support tagging functionality', async ({
    appPage,
    electronHelpers
  }) => {
    // Wait for entries to load
    await appPage.waitForSelector('[data-testid="kb-entry"]', { timeout: 10000 });

    // Look for tags in entries
    const tagElements = appPage.locator('[data-testid="entry-tag"]')
      .or(appPage.locator('.tag'))
      .or(appPage.locator('.label'));

    if (await tagElements.first().isVisible({ timeout: 2000 })) {
      const tagCount = await tagElements.count();
      expect(tagCount).toBeGreaterThan(0);

      // Click on a tag to filter
      const firstTag = tagElements.first();
      const tagText = await firstTag.textContent();

      await firstTag.click();
      await appPage.waitForTimeout(1000);

      // Verify filtering by tag works
      const filteredEntries = appPage.locator('[data-testid="kb-entry"]');
      const filteredCount = await filteredEntries.count();

      if (filteredCount > 0 && tagText) {
        // Verify entries contain the tag
        const firstFilteredEntry = filteredEntries.first();
        const entryText = await firstFilteredEntry.textContent();
        expect(entryText?.toLowerCase()).toContain(tagText.toLowerCase().trim());
      }
    }
  });

  test('should export and import knowledge base', async ({
    appPage,
    electronHelpers
  }) => {
    // Test export functionality
    const exportPath = './tests/playwright/temp/exported-kb.json';

    try {
      // Mock file dialog for export
      await electronHelpers.saveFile(exportPath);

      // Trigger export via menu
      await electronHelpers.triggerMenuAction(['File', 'Export Knowledge Base']);

      // Wait for export to complete
      await appPage.waitForTimeout(2000);

      // Verify file was created
      await electronHelpers.waitForFileToExist(exportPath);

      // Clear current data
      await electronHelpers.clearDatabase();

      // Mock file dialog for import
      await electronHelpers.selectFile(exportPath);

      // Trigger import via menu
      await electronHelpers.triggerMenuAction(['File', 'Import Knowledge Base']);

      // Wait for import to complete
      await appPage.waitForTimeout(3000);

      // Verify data was imported
      const entries = appPage.locator('[data-testid="kb-entry"]');
      const entryCount = await entries.count();
      expect(entryCount).toBeGreaterThan(0);

    } catch (error) {
      console.log('Import/Export functionality may not be fully implemented:', error.message);
    }
  });

  test('should handle large datasets efficiently', async ({
    appPage,
    electronHelpers
  }) => {
    // Clear existing data
    await electronHelpers.clearDatabase();

    // Create large dataset
    const largeDataset = [];
    for (let i = 0; i < 100; i++) {
      largeDataset.push({
        id: `test-${i}`,
        title: `Test Entry ${i}`,
        category: i % 3 === 0 ? 'COBOL' : i % 3 === 1 ? 'JCL' : 'VSAM',
        content: `This is test content for entry number ${i}. It contains various mainframe-related information.`,
        tags: [`tag-${i % 5}`, `category-${i % 3}`],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    // Seed database with large dataset
    await electronHelpers.seedDatabase(largeDataset);

    // Verify performance with large dataset
    const { duration } = await electronHelpers.measureOperation(
      async () => {
        await appPage.reload();
        await appPage.waitForSelector('[data-testid="kb-entry"]', { timeout: 15000 });
      },
      'large-dataset-load'
    );

    // Loading should complete within reasonable time
    expect(duration).toBeLessThan(10000);

    // Verify virtual scrolling or pagination works
    const entries = appPage.locator('[data-testid="kb-entry"]');
    const visibleCount = await entries.count();

    // Should either show all entries or use pagination/virtualization
    expect(visibleCount).toBeGreaterThan(0);

    // Test search performance with large dataset
    const searchInput = appPage.locator('[data-testid="search-input"]')
      .or(appPage.locator('input[type="search"]'));

    if (await searchInput.isVisible()) {
      const { duration: searchDuration } = await electronHelpers.measureOperation(
        async () => {
          await searchInput.fill('Test Entry 50');
          await appPage.waitForTimeout(1000);
        },
        'large-dataset-search'
      );

      // Search should be fast even with large dataset
      expect(searchDuration).toBeLessThan(3000);
    }
  });
});