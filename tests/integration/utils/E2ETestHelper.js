/**
 * E2E Test Helper Utilities
 * Provides common functionality for end-to-end testing
 */
class E2ETestHelper {
  constructor(page) {
    this.page = page;
  }

  /**
   * Login with specific user credentials
   */
  async loginAs(userType) {
    const credentials = {
      admin: { email: 'admin@test.com', password: 'AdminPassword123!' },
      user: { email: 'user@test.com', password: 'UserPassword123!' },
      readonly: { email: 'user2@test.com', password: 'ReadOnlyPassword123!' }
    };

    const creds = credentials[userType];
    if (!creds) throw new Error(`Unknown user type: ${userType}`);

    await this.page.goto('/login');
    await this.page.fill('[data-testid="email"]', creds.email);
    await this.page.fill('[data-testid="password"]', creds.password);
    await this.page.click('[data-testid="login-button"]');
    await this.page.waitForURL('**/dashboard');
  }

  /**
   * Perform AI search with budget confirmation
   */
  async performAISearch(query, confirmBudget = true) {
    await this.page.click('[data-testid="search-tab"]');
    await this.page.fill('[data-testid="search-input"]', query);
    await this.page.check('[data-testid="ai-search-toggle"]');
    await this.page.click('[data-testid="search-button"]');

    if (confirmBudget) {
      const budgetDialog = this.page.locator('[data-testid="budget-confirmation-dialog"]');
      if (await budgetDialog.isVisible()) {
        await this.page.click('[data-testid="confirm-ai-search"]');
      }
    }

    return this.page.waitForSelector('[data-testid="search-results"]', { timeout: 30000 });
  }

  /**
   * Create knowledge base entry
   */
  async createKBEntry(title, content, category = 'General', tags = []) {
    await this.page.goto('/knowledge-base');
    await this.page.click('[data-testid="create-kb-entry"]');
    await this.page.fill('[data-testid="entry-title"]', title);
    await this.page.fill('[data-testid="entry-content"]', content);
    await this.page.selectOption('[data-testid="entry-category"]', category);

    if (tags.length > 0) {
      await this.page.fill('[data-testid="entry-tags"]', tags.join(','));
    }

    await this.page.click('[data-testid="save-entry"]');
    return this.page.waitForSelector('[data-testid="success-message"]');
  }

  /**
   * Check budget status
   */
  async getBudgetStatus() {
    await this.page.goto('/budget-status');

    const daily = await this.page.locator('[data-testid="daily-remaining"]').textContent();
    const weekly = await this.page.locator('[data-testid="weekly-remaining"]').textContent();
    const monthly = await this.page.locator('[data-testid="monthly-remaining"]').textContent();

    return {
      daily: parseFloat(daily?.replace(/[^0-9.]/g, '') || '0'),
      weekly: parseFloat(weekly?.replace(/[^0-9.]/g, '') || '0'),
      monthly: parseFloat(monthly?.replace(/[^0-9.]/g, '') || '0')
    };
  }

  /**
   * Wait for element with custom timeout
   */
  async waitForElement(selector, timeout = 10000) {
    return this.page.waitForSelector(selector, { timeout });
  }

  /**
   * Take screenshot with timestamp
   */
  async takeScreenshot(name) {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    return this.page.screenshot({
      path: `./tests/integration/e2e/screenshots/${name}-${timestamp}.png`,
      fullPage: true
    });
  }

  /**
   * Simulate network conditions
   */
  async setNetworkConditions(condition) {
    const conditions = {
      offline: { offline: true },
      slow: { downloadThroughput: 50000, uploadThroughput: 50000, latency: 2000 },
      normal: { offline: false }
    };

    if (condition === 'offline') {
      await this.page.context().setOffline(true);
    } else {
      await this.page.context().setOffline(false);
    }
  }

  /**
   * Monitor performance metrics
   */
  async getPerformanceMetrics() {
    return this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      return {
        loadTime: navigation.loadEventEnd - navigation.loadEventStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
      };
    });
  }

  /**
   * Verify accessibility compliance
   */
  async checkAccessibility() {
    // Check for basic accessibility features
    const hasAltText = await this.page.$$eval('img', imgs =>
      imgs.every(img => img.alt || img.getAttribute('aria-label'))
    );

    const hasAriaLabels = await this.page.$$eval('button, input, select', elements =>
      elements.every(el => el.getAttribute('aria-label') || el.textContent?.trim())
    );

    const hasProperHeadings = await this.page.$$eval('h1, h2, h3, h4, h5, h6', headings =>
      headings.length > 0
    );

    return {
      hasAltText,
      hasAriaLabels,
      hasProperHeadings,
      score: (hasAltText && hasAriaLabels && hasProperHeadings) ? 100 : 75
    };
  }

  /**
   * Export data in specified format
   */
  async exportData(format = 'csv') {
    await this.page.click('[data-testid="export-dropdown"]');
    await this.page.click(`[data-testid="export-${format}"]`);

    const downloadPromise = this.page.waitForEvent('download');
    await this.page.click('[data-testid="confirm-export"]');
    return downloadPromise;
  }

  /**
   * Verify audit trail entry
   */
  async verifyAuditTrail(action, resourceId = null) {
    await this.page.goto('/admin/audit-log');

    const auditEntry = this.page.locator('[data-testid="audit-entries"]').first();
    await expect(auditEntry).toContainText(action);

    if (resourceId) {
      await expect(auditEntry).toContainText(resourceId);
    }

    return true;
  }

  /**
   * Cleanup test data
   */
  async cleanup() {
    // Clear browser storage
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Clear cookies
    await this.page.context().clearCookies();
  }
}

module.exports = { E2ETestHelper };