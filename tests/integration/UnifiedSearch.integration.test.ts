/**
 * Integration Tests for UnifiedSearch Component with Puppeteer
 */

import { Page, Browser } from 'puppeteer';
import { startServer, stopServer } from '../helpers/testServer';

describe('UnifiedSearch Integration Tests', () => {
  let browser: Browser;
  let page: Page;
  let serverUrl: string;

  beforeAll(async () => {
    const puppeteer = require('puppeteer');
    browser = await puppeteer.launch({
      headless: process.env.CI === 'true',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    serverUrl = await startServer();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });
    await page.goto(`${serverUrl}/search-test`);

    // Wait for search component to load
    await page.waitForSelector('#main-unified-search', { timeout: 10000 });
  });

  afterEach(async () => {
    await page.close();
  });

  afterAll(async () => {
    await browser.close();
    await stopServer();
  });

  describe('Basic Functionality', () => {
    it('should render search input and be focusable', async () => {
      const searchInput = await page.$('input[type=\"search\"]');
      expect(searchInput).toBeTruthy();

      // Test focus
      await searchInput!.focus();
      const focused = await page.evaluate(() => document.activeElement?.tagName);
      expect(focused).toBe('INPUT');
    });

    it('should show suggestions when typing', async () => {
      const searchInput = await page.$('input[type=\"search\"]');

      await searchInput!.type('S0C4');

      // Wait for suggestions to appear
      await page.waitForSelector('[role=\"listbox\"]', { timeout: 5000 });

      const suggestions = await page.$$('[role=\"option\"]');
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should close suggestions when clicking outside', async () => {
      const searchInput = await page.$('input[type=\"search\"]');

      // Open suggestions
      await searchInput!.type('test');
      await page.waitForSelector('[role=\"listbox\"]');

      // Click outside
      await page.click('body');

      // Wait for suggestions to close
      await page.waitForSelector('[role=\"listbox\"]', { hidden: true, timeout: 5000 });

      const suggestionsVisible = await page.$('[role=\"listbox\"]');
      expect(suggestionsVisible).toBeFalsy();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should navigate suggestions with arrow keys', async () => {
      const searchInput = await page.$('input[type=\"search\"]');

      await searchInput!.type('S0C');
      await page.waitForSelector('[role=\"listbox\"]');

      // Press arrow down
      await page.keyboard.press('ArrowDown');

      // Check if first suggestion is selected
      const selectedOption = await page.$('[aria-selected=\"true\"]');
      expect(selectedOption).toBeTruthy();

      // Press arrow down again
      await page.keyboard.press('ArrowDown');

      // Check if selection moved
      const newSelectedOption = await page.$('[aria-selected=\"true\"]');
      expect(newSelectedOption).toBeTruthy();
    });

    it('should select suggestion with Enter key', async () => {
      const searchInput = await page.$('input[type=\"search\"]');

      await searchInput!.type('S0C4');
      await page.waitForSelector('[role=\"listbox\"]');

      // Navigate to first suggestion and press Enter
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');

      // Check if input value changed
      const inputValue = await page.$eval('input[type=\"search\"]', el => (el as HTMLInputElement).value);
      expect(inputValue).toContain('S0C4');
    });

    it('should close suggestions with Escape key', async () => {
      const searchInput = await page.$('input[type=\"search\"]');

      await searchInput!.type('test');
      await page.waitForSelector('[role=\"listbox\"]');

      await page.keyboard.press('Escape');

      await page.waitForSelector('[role=\"listbox\"]', { hidden: true, timeout: 5000 });
      const suggestionsVisible = await page.$('[role=\"listbox\"]');
      expect(suggestionsVisible).toBeFalsy();
    });

    it('should focus search with Ctrl+K shortcut', async () => {
      // Focus somewhere else first
      await page.click('body');

      // Press Ctrl+K
      await page.keyboard.down('Control');
      await page.keyboard.press('k');
      await page.keyboard.up('Control');

      // Check if search input is focused
      const focused = await page.evaluate(() => {
        const activeElement = document.activeElement as HTMLElement;
        return activeElement?.tagName === 'INPUT' && activeElement?.type === 'search';
      });
      expect(focused).toBe(true);
    });

    it('should focus search with / shortcut', async () => {
      // Focus somewhere else first
      await page.click('body');

      // Press /
      await page.keyboard.press('/');

      // Check if search input is focused
      const focused = await page.evaluate(() => {
        const activeElement = document.activeElement as HTMLElement;
        return activeElement?.tagName === 'INPUT' && activeElement?.type === 'search';
      });
      expect(focused).toBe(true);
    });
  });

  describe('AI Toggle', () => {
    it('should toggle AI mode when clicked', async () => {
      const aiToggle = await page.$('[aria-label*=\"AI-enhanced search\"]');
      expect(aiToggle).toBeTruthy();

      // Get initial state
      const initialState = await page.$eval('[aria-label*=\"AI-enhanced search\"]',
        el => el.getAttribute('aria-label'));

      // Click toggle
      await aiToggle!.click();

      // Check if state changed
      const newState = await page.$eval('[aria-label*=\"AI-enhanced search\"]',
        el => el.getAttribute('aria-label'));

      expect(newState).not.toBe(initialState);
    });

    it('should show correct indicator text for AI mode', async () => {
      // Check for AI indicator
      const aiIndicator = await page.waitForSelector('text/AI-enhanced search enabled');
      expect(aiIndicator).toBeTruthy();

      // Toggle AI off
      const aiToggle = await page.$('[aria-label*=\"Disable AI-enhanced search\"]');
      await aiToggle!.click();

      // Check for local indicator
      const localIndicator = await page.waitForSelector('text/Local search only');
      expect(localIndicator).toBeTruthy();
    });
  });

  describe('Filters', () => {
    it('should open filters dropdown when clicked', async () => {
      const filtersButton = await page.$('[aria-label=\"Search filters\"]');
      await filtersButton!.click();

      // Wait for filters dropdown to appear
      const filtersDropdown = await page.waitForSelector('text/Search Filters');
      expect(filtersDropdown).toBeTruthy();
    });

    it('should select category filters', async () => {
      const filtersButton = await page.$('[aria-label=\"Search filters\"]');
      await filtersButton!.click();

      await page.waitForSelector('text/Search Filters');

      // Click on COBOL category
      const cobolButton = await page.waitForSelector('text/COBOL');
      await cobolButton!.click();

      // Verify category is selected (visual feedback)
      const selectedCategory = await page.$eval('text/COBOL',
        el => window.getComputedStyle(el.closest('button')!).backgroundColor);

      // Should have different background when selected
      expect(selectedCategory).not.toBe('rgba(0, 0, 0, 0)');
    });

    it('should clear all filters', async () => {
      const filtersButton = await page.$('[aria-label=\"Search filters\"]');
      await filtersButton!.click();

      await page.waitForSelector('text/Search Filters');

      // Select a category first
      const cobolButton = await page.waitForSelector('text/COBOL');
      await cobolButton!.click();

      // Clear all filters
      const clearButton = await page.waitForSelector('text/Clear All');
      await clearButton!.click();

      // Verify filters are cleared (All Categories should be selected)
      const allCategoriesButton = await page.$('text/All Categories');
      const isSelected = await page.evaluate(el => {
        return window.getComputedStyle(el.closest('button')!).backgroundColor !== 'rgba(0, 0, 0, 0)';
      }, allCategoriesButton);

      expect(isSelected).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should render suggestions within 500ms', async () => {
      const searchInput = await page.$('input[type=\"search\"]');

      const startTime = Date.now();
      await searchInput!.type('S0C4');
      await page.waitForSelector('[role=\"listbox\"]');
      const endTime = Date.now();

      const renderTime = endTime - startTime;
      expect(renderTime).toBeLessThan(500);
    });

    it('should handle rapid typing without performance degradation', async () => {
      const searchInput = await page.$('input[type=\"search\"]');

      // Type rapidly
      const testString = 'rapid typing test query';
      await searchInput!.type(testString, { delay: 10 });

      // Should still show suggestions
      await page.waitForSelector('[role=\"listbox\"]', { timeout: 1000 });

      const finalValue = await page.$eval('input[type=\"search\"]',
        el => (el as HTMLInputElement).value);
      expect(finalValue).toBe(testString);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', async () => {
      // Check main search input
      const searchInput = await page.$('input[type=\"search\"]');
      const ariaLabel = await searchInput!.evaluate(el => el.getAttribute('aria-label'));
      expect(ariaLabel).toBeTruthy();

      // Check suggestions listbox
      await searchInput!.type('test');
      await page.waitForSelector('[role=\"listbox\"]');

      const listbox = await page.$('[role=\"listbox\"]');
      const listboxLabel = await listbox!.evaluate(el => el.getAttribute('aria-label'));
      expect(listboxLabel).toBeTruthy();
    });

    it('should maintain focus management correctly', async () => {
      const searchInput = await page.$('input[type=\"search\"]');

      // Focus input
      await searchInput!.focus();

      // Open suggestions
      await searchInput!.type('test');
      await page.waitForSelector('[role=\"listbox\"]');

      // Navigate with keyboard
      await page.keyboard.press('ArrowDown');

      // Input should still be focused
      const activeElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(activeElement).toBe('INPUT');
    });

    it('should support screen reader announcements', async () => {
      const searchInput = await page.$('input[type=\"search\"]');

      // Type to trigger suggestions
      await searchInput!.type('S0C4');
      await page.waitForSelector('[role=\"listbox\"]');

      // Check aria-expanded attribute
      const ariaExpanded = await searchInput!.evaluate(el => el.getAttribute('aria-expanded'));
      expect(ariaExpanded).toBe('true');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // Simulate network failure
      await page.setOfflineMode(true);

      const searchInput = await page.$('input[type=\"search\"]');
      await searchInput!.type('test query');

      const searchButton = await page.$('text/Search');
      await searchButton!.click();

      // Should not crash the component
      const searchContainer = await page.$('#main-unified-search');
      expect(searchContainer).toBeTruthy();

      // Reset network
      await page.setOfflineMode(false);
    });

    it('should handle invalid input gracefully', async () => {
      const searchInput = await page.$('input[type=\"search\"]');

      // Type various special characters
      await searchInput!.type('!@#$%^&*()');

      // Should not crash
      const searchContainer = await page.$('#main-unified-search');
      expect(searchContainer).toBeTruthy();

      // Input should contain the typed text
      const inputValue = await page.$eval('input[type=\"search\"]',
        el => (el as HTMLInputElement).value);
      expect(inputValue).toBe('!@#$%^&*()');
    });
  });
});