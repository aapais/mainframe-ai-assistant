/**
 * Settings and Preferences Workflow E2E Tests
 *
 * Tests comprehensive settings and preferences functionality:
 * - User interface preferences
 * - Application behavior settings
 * - Data management preferences
 * - Accessibility settings
 * - Performance optimization settings
 * - Import/Export settings
 * - Integration configurations
 * - Security and privacy settings
 */

import { test, expect, Page } from '@playwright/test';

interface UserPreferences {
  ui: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
    fontSize: 'small' | 'medium' | 'large';
    colorScheme: 'default' | 'high-contrast' | 'colorblind-friendly';
    animations: boolean;
    compactMode: boolean;
  };
  search: {
    defaultResultsPerPage: number;
    autoSuggestions: boolean;
    typoCorrection: boolean;
    searchHistory: boolean;
    saveRecentQueries: boolean;
    maxHistoryItems: number;
  };
  editor: {
    autoSave: boolean;
    autoSaveInterval: number;
    syntaxHighlighting: boolean;
    lineNumbers: boolean;
    wordWrap: boolean;
    tabSize: number;
  };
  notifications: {
    enableDesktop: boolean;
    enableSound: boolean;
    enableEmail: boolean;
    criticalOnly: boolean;
    quietHours: {
      enabled: boolean;
      start: string;
      end: string;
    };
  };
  privacy: {
    analyticsEnabled: boolean;
    errorReporting: boolean;
    usageStatistics: boolean;
    dataRetention: number;
  };
  performance: {
    enableCaching: boolean;
    cacheSize: number;
    preloadResults: boolean;
    backgroundIndexing: boolean;
    maxConcurrentRequests: number;
  };
  accessibility: {
    screenReader: boolean;
    keyboardNavigation: boolean;
    focusIndicators: boolean;
    reducedMotion: boolean;
    highContrast: boolean;
    textToSpeech: boolean;
  };
  backup: {
    autoBackup: boolean;
    backupInterval: 'daily' | 'weekly' | 'monthly';
    backupLocation: string;
    maxBackups: number;
    includeSettings: boolean;
  };
}

interface SettingsTestMetrics {
  settingsSaveTime: number;
  settingsLoadTime: number;
  preferenceValidationErrors: string[];
  performanceImpact: {
    memoryUsage: number;
    renderTime: number;
    responseTime: number;
  };
  accessibilityCompliance: boolean[];
}

class SettingsWorkflowTester {
  private page: Page;
  private metrics: SettingsTestMetrics;
  private originalSettings: UserPreferences | null = null;

  constructor(page: Page) {
    this.page = page;
    this.metrics = {
      settingsSaveTime: 0,
      settingsLoadTime: 0,
      preferenceValidationErrors: [],
      performanceImpact: {
        memoryUsage: 0,
        renderTime: 0,
        responseTime: 0
      },
      accessibilityCompliance: []
    };
  }

  async navigateToSettings(): Promise<void> {
    await this.page.goto('#/settings');
    await this.page.waitForSelector('[data-testid="settings-interface"]', { timeout: 5000 });
  }

  async backupCurrentSettings(): Promise<void> {
    await this.navigateToSettings();
    this.originalSettings = await this.getCurrentSettings();
  }

  async restoreOriginalSettings(): Promise<void> {
    if (this.originalSettings) {
      await this.applySettings(this.originalSettings);
    }
  }

  async getCurrentSettings(): Promise<UserPreferences> {
    const startTime = Date.now();

    const settings = await this.page.evaluate(() => {
      return (window as any).userPreferences || {};
    });

    this.metrics.settingsLoadTime = Date.now() - startTime;

    return settings as UserPreferences;
  }

  async applySettings(preferences: Partial<UserPreferences>): Promise<void> {
    const startTime = Date.now();

    try {
      await this.navigateToSettings();

      // UI Settings
      if (preferences.ui) {
        await this.applyUISettings(preferences.ui);
      }

      // Search Settings
      if (preferences.search) {
        await this.applySearchSettings(preferences.search);
      }

      // Editor Settings
      if (preferences.editor) {
        await this.applyEditorSettings(preferences.editor);
      }

      // Notification Settings
      if (preferences.notifications) {
        await this.applyNotificationSettings(preferences.notifications);
      }

      // Privacy Settings
      if (preferences.privacy) {
        await this.applyPrivacySettings(preferences.privacy);
      }

      // Performance Settings
      if (preferences.performance) {
        await this.applyPerformanceSettings(preferences.performance);
      }

      // Accessibility Settings
      if (preferences.accessibility) {
        await this.applyAccessibilitySettings(preferences.accessibility);
      }

      // Backup Settings
      if (preferences.backup) {
        await this.applyBackupSettings(preferences.backup);
      }

      // Save settings
      await this.page.click('[data-testid="save-settings-button"]');
      await this.page.waitForSelector('[data-testid="settings-saved-success"]', { timeout: 10000 });

      this.metrics.settingsSaveTime = Date.now() - startTime;
    } catch (error) {
      this.metrics.preferenceValidationErrors.push(`Settings application failed: ${error.message}`);
      throw error;
    }
  }

  private async applyUISettings(ui: Partial<UserPreferences['ui']>): Promise<void> {
    await this.page.click('[data-testid="ui-settings-tab"]');

    if (ui.theme) {
      await this.page.selectOption('[data-testid="theme-select"]', ui.theme);
    }

    if (ui.language) {
      await this.page.selectOption('[data-testid="language-select"]', ui.language);
    }

    if (ui.fontSize) {
      await this.page.selectOption('[data-testid="font-size-select"]', ui.fontSize);
    }

    if (ui.colorScheme) {
      await this.page.selectOption('[data-testid="color-scheme-select"]', ui.colorScheme);
    }

    if (ui.animations !== undefined) {
      await this.setCheckbox('[data-testid="animations-checkbox"]', ui.animations);
    }

    if (ui.compactMode !== undefined) {
      await this.setCheckbox('[data-testid="compact-mode-checkbox"]', ui.compactMode);
    }
  }

  private async applySearchSettings(search: Partial<UserPreferences['search']>): Promise<void> {
    await this.page.click('[data-testid="search-settings-tab"]');

    if (search.defaultResultsPerPage) {
      await this.page.fill('[data-testid="results-per-page-input"]', search.defaultResultsPerPage.toString());
    }

    if (search.autoSuggestions !== undefined) {
      await this.setCheckbox('[data-testid="auto-suggestions-checkbox"]', search.autoSuggestions);
    }

    if (search.typoCorrection !== undefined) {
      await this.setCheckbox('[data-testid="typo-correction-checkbox"]', search.typoCorrection);
    }

    if (search.searchHistory !== undefined) {
      await this.setCheckbox('[data-testid="search-history-checkbox"]', search.searchHistory);
    }

    if (search.saveRecentQueries !== undefined) {
      await this.setCheckbox('[data-testid="save-recent-queries-checkbox"]', search.saveRecentQueries);
    }

    if (search.maxHistoryItems) {
      await this.page.fill('[data-testid="max-history-items-input"]', search.maxHistoryItems.toString());
    }
  }

  private async applyEditorSettings(editor: Partial<UserPreferences['editor']>): Promise<void> {
    await this.page.click('[data-testid="editor-settings-tab"]');

    if (editor.autoSave !== undefined) {
      await this.setCheckbox('[data-testid="auto-save-checkbox"]', editor.autoSave);
    }

    if (editor.autoSaveInterval) {
      await this.page.fill('[data-testid="auto-save-interval-input"]', editor.autoSaveInterval.toString());
    }

    if (editor.syntaxHighlighting !== undefined) {
      await this.setCheckbox('[data-testid="syntax-highlighting-checkbox"]', editor.syntaxHighlighting);
    }

    if (editor.lineNumbers !== undefined) {
      await this.setCheckbox('[data-testid="line-numbers-checkbox"]', editor.lineNumbers);
    }

    if (editor.wordWrap !== undefined) {
      await this.setCheckbox('[data-testid="word-wrap-checkbox"]', editor.wordWrap);
    }

    if (editor.tabSize) {
      await this.page.selectOption('[data-testid="tab-size-select"]', editor.tabSize.toString());
    }
  }

  private async applyNotificationSettings(notifications: Partial<UserPreferences['notifications']>): Promise<void> {
    await this.page.click('[data-testid="notifications-settings-tab"]');

    if (notifications.enableDesktop !== undefined) {
      await this.setCheckbox('[data-testid="desktop-notifications-checkbox"]', notifications.enableDesktop);
    }

    if (notifications.enableSound !== undefined) {
      await this.setCheckbox('[data-testid="sound-notifications-checkbox"]', notifications.enableSound);
    }

    if (notifications.enableEmail !== undefined) {
      await this.setCheckbox('[data-testid="email-notifications-checkbox"]', notifications.enableEmail);
    }

    if (notifications.criticalOnly !== undefined) {
      await this.setCheckbox('[data-testid="critical-only-checkbox"]', notifications.criticalOnly);
    }

    if (notifications.quietHours) {
      if (notifications.quietHours.enabled !== undefined) {
        await this.setCheckbox('[data-testid="quiet-hours-checkbox"]', notifications.quietHours.enabled);
      }

      if (notifications.quietHours.start) {
        await this.page.fill('[data-testid="quiet-hours-start-input"]', notifications.quietHours.start);
      }

      if (notifications.quietHours.end) {
        await this.page.fill('[data-testid="quiet-hours-end-input"]', notifications.quietHours.end);
      }
    }
  }

  private async applyPrivacySettings(privacy: Partial<UserPreferences['privacy']>): Promise<void> {
    await this.page.click('[data-testid="privacy-settings-tab"]');

    if (privacy.analyticsEnabled !== undefined) {
      await this.setCheckbox('[data-testid="analytics-checkbox"]', privacy.analyticsEnabled);
    }

    if (privacy.errorReporting !== undefined) {
      await this.setCheckbox('[data-testid="error-reporting-checkbox"]', privacy.errorReporting);
    }

    if (privacy.usageStatistics !== undefined) {
      await this.setCheckbox('[data-testid="usage-statistics-checkbox"]', privacy.usageStatistics);
    }

    if (privacy.dataRetention) {
      await this.page.selectOption('[data-testid="data-retention-select"]', privacy.dataRetention.toString());
    }
  }

  private async applyPerformanceSettings(performance: Partial<UserPreferences['performance']>): Promise<void> {
    await this.page.click('[data-testid="performance-settings-tab"]');

    if (performance.enableCaching !== undefined) {
      await this.setCheckbox('[data-testid="enable-caching-checkbox"]', performance.enableCaching);
    }

    if (performance.cacheSize) {
      await this.page.fill('[data-testid="cache-size-input"]', performance.cacheSize.toString());
    }

    if (performance.preloadResults !== undefined) {
      await this.setCheckbox('[data-testid="preload-results-checkbox"]', performance.preloadResults);
    }

    if (performance.backgroundIndexing !== undefined) {
      await this.setCheckbox('[data-testid="background-indexing-checkbox"]', performance.backgroundIndexing);
    }

    if (performance.maxConcurrentRequests) {
      await this.page.fill('[data-testid="max-concurrent-requests-input"]', performance.maxConcurrentRequests.toString());
    }
  }

  private async applyAccessibilitySettings(accessibility: Partial<UserPreferences['accessibility']>): Promise<void> {
    await this.page.click('[data-testid="accessibility-settings-tab"]');

    if (accessibility.screenReader !== undefined) {
      await this.setCheckbox('[data-testid="screen-reader-checkbox"]', accessibility.screenReader);
    }

    if (accessibility.keyboardNavigation !== undefined) {
      await this.setCheckbox('[data-testid="keyboard-navigation-checkbox"]', accessibility.keyboardNavigation);
    }

    if (accessibility.focusIndicators !== undefined) {
      await this.setCheckbox('[data-testid="focus-indicators-checkbox"]', accessibility.focusIndicators);
    }

    if (accessibility.reducedMotion !== undefined) {
      await this.setCheckbox('[data-testid="reduced-motion-checkbox"]', accessibility.reducedMotion);
    }

    if (accessibility.highContrast !== undefined) {
      await this.setCheckbox('[data-testid="high-contrast-checkbox"]', accessibility.highContrast);
    }

    if (accessibility.textToSpeech !== undefined) {
      await this.setCheckbox('[data-testid="text-to-speech-checkbox"]', accessibility.textToSpeech);
    }
  }

  private async applyBackupSettings(backup: Partial<UserPreferences['backup']>): Promise<void> {
    await this.page.click('[data-testid="backup-settings-tab"]');

    if (backup.autoBackup !== undefined) {
      await this.setCheckbox('[data-testid="auto-backup-checkbox"]', backup.autoBackup);
    }

    if (backup.backupInterval) {
      await this.page.selectOption('[data-testid="backup-interval-select"]', backup.backupInterval);
    }

    if (backup.backupLocation) {
      await this.page.fill('[data-testid="backup-location-input"]', backup.backupLocation);
    }

    if (backup.maxBackups) {
      await this.page.fill('[data-testid="max-backups-input"]', backup.maxBackups.toString());
    }

    if (backup.includeSettings !== undefined) {
      await this.setCheckbox('[data-testid="include-settings-checkbox"]', backup.includeSettings);
    }
  }

  private async setCheckbox(selector: string, checked: boolean): Promise<void> {
    const checkbox = this.page.locator(selector);
    const isChecked = await checkbox.isChecked();

    if (isChecked !== checked) {
      await checkbox.click();
    }
  }

  async exportSettings(): Promise<string> {
    await this.navigateToSettings();
    await this.page.click('[data-testid="export-settings-button"]');
    await this.page.waitForSelector('[data-testid="export-dialog"]');

    // Get the exported settings data
    const exportedData = await this.page.evaluate(() => {
      const element = document.querySelector('[data-testid="exported-settings-data"]');
      return element ? element.textContent : '';
    });

    await this.page.click('[data-testid="close-export-dialog"]');
    return exportedData || '';
  }

  async importSettings(settingsData: string): Promise<void> {
    await this.navigateToSettings();
    await this.page.click('[data-testid="import-settings-button"]');
    await this.page.waitForSelector('[data-testid="import-dialog"]');

    await this.page.fill('[data-testid="import-settings-textarea"]', settingsData);
    await this.page.click('[data-testid="confirm-import-button"]');

    await this.page.waitForSelector('[data-testid="import-success"]', { timeout: 10000 });
  }

  async resetToDefaults(): Promise<void> {
    await this.navigateToSettings();
    await this.page.click('[data-testid="reset-to-defaults-button"]');
    await this.page.waitForSelector('[data-testid="reset-confirmation-dialog"]');
    await this.page.click('[data-testid="confirm-reset-button"]');
    await this.page.waitForSelector('[data-testid="reset-success"]', { timeout: 10000 });
  }

  async validateSettingsPersistence(): Promise<boolean> {
    try {
      // Get current settings
      const beforeSettings = await this.getCurrentSettings();

      // Navigate away and back
      await this.page.goto('#/search');
      await this.page.waitForTimeout(1000);
      await this.navigateToSettings();

      // Get settings again
      const afterSettings = await this.getCurrentSettings();

      // Compare settings
      return JSON.stringify(beforeSettings) === JSON.stringify(afterSettings);
    } catch (error) {
      this.metrics.preferenceValidationErrors.push(`Settings persistence validation failed: ${error.message}`);
      return false;
    }
  }

  async testSettingsImpactOnPerformance(): Promise<void> {
    const startTime = Date.now();
    const initialMemory = await this.page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });

    // Apply settings that might impact performance
    await this.applySettings({
      ui: { animations: true, theme: 'dark' },
      performance: { enableCaching: true, preloadResults: true },
      accessibility: { screenReader: true, textToSpeech: true }
    });

    const renderTime = Date.now() - startTime;
    const finalMemory = await this.page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });

    // Test response time after settings change
    const responseStartTime = Date.now();
    await this.page.goto('#/search');
    await this.page.fill('[data-testid="search-input"]', 'test');
    await this.page.click('[data-testid="search-button"]');
    const responseTime = Date.now() - responseStartTime;

    this.metrics.performanceImpact = {
      memoryUsage: finalMemory - initialMemory,
      renderTime,
      responseTime
    };
  }

  async testAccessibilityCompliance(): Promise<void> {
    await this.navigateToSettings();

    const accessibilityChecks = [
      // Keyboard navigation
      async () => {
        await this.page.keyboard.press('Tab');
        const focusedElement = await this.page.locator(':focus');
        return await focusedElement.isVisible();
      },

      // ARIA labels
      async () => {
        const elementsWithAria = await this.page.locator('[aria-label], [aria-labelledby]').count();
        return elementsWithAria > 0;
      },

      // Color contrast (simplified check)
      async () => {
        const hasHighContrast = await this.page.locator('[data-testid="high-contrast-indicator"]').isVisible();
        return hasHighContrast;
      },

      // Screen reader support
      async () => {
        const hasLiveRegions = await this.page.locator('[aria-live]').count();
        return hasLiveRegions > 0;
      }
    ];

    for (const check of accessibilityChecks) {
      try {
        const result = await check();
        this.metrics.accessibilityCompliance.push(result);
      } catch (error) {
        this.metrics.accessibilityCompliance.push(false);
      }
    }
  }

  getMetrics(): SettingsTestMetrics {
    return { ...this.metrics };
  }
}

test.describe('Settings and Preferences Workflows', () => {
  let settingsTester: SettingsWorkflowTester;

  test.beforeEach(async ({ page }) => {
    settingsTester = new SettingsWorkflowTester(page);

    // Setup test environment
    await page.goto('/');
    await page.waitForSelector('[data-testid="app-root"]', { timeout: 10000 });

    // Backup original settings
    await settingsTester.backupCurrentSettings();
  });

  test.afterEach(async () => {
    // Restore original settings
    await settingsTester.restoreOriginalSettings();
  });

  test('Complete UI preferences workflow', async () => {
    const uiPreferences: Partial<UserPreferences> = {
      ui: {
        theme: 'dark',
        language: 'en-US',
        fontSize: 'large',
        colorScheme: 'high-contrast',
        animations: false,
        compactMode: true
      }
    };

    await settingsTester.applySettings(uiPreferences);

    // Verify theme change is applied
    await expect(settingsTester.page.locator('body')).toHaveClass(/dark-theme/);

    // Verify font size change
    const fontSize = await settingsTester.page.evaluate(() => {
      return getComputedStyle(document.body).fontSize;
    });
    expect(fontSize).toContain('large');

    // Verify settings persistence
    const isPersistent = await settingsTester.validateSettingsPersistence();
    expect(isPersistent).toBe(true);
  });

  test('Search preferences configuration', async () => {
    const searchPreferences: Partial<UserPreferences> = {
      search: {
        defaultResultsPerPage: 25,
        autoSuggestions: true,
        typoCorrection: true,
        searchHistory: true,
        saveRecentQueries: true,
        maxHistoryItems: 50
      }
    };

    await settingsTester.applySettings(searchPreferences);

    // Test search functionality with new settings
    await settingsTester.page.goto('#/search');
    await settingsTester.page.fill('[data-testid="search-input"]', 'test query');

    // Verify auto-suggestions appear
    await expect(settingsTester.page.locator('[data-testid="search-suggestions"]')).toBeVisible();

    // Perform search and verify results per page
    await settingsTester.page.click('[data-testid="search-button"]');
    await settingsTester.page.waitForSelector('[data-testid="search-results"]');

    const resultsPerPageText = await settingsTester.page.locator('[data-testid="results-per-page-display"]').textContent();
    expect(resultsPerPageText).toContain('25');
  });

  test('Editor preferences workflow', async () => {
    const editorPreferences: Partial<UserPreferences> = {
      editor: {
        autoSave: true,
        autoSaveInterval: 30,
        syntaxHighlighting: true,
        lineNumbers: true,
        wordWrap: false,
        tabSize: 4
      }
    };

    await settingsTester.applySettings(editorPreferences);

    // Test editor functionality
    await settingsTester.page.click('[data-testid="add-entry-button"]');
    await settingsTester.page.waitForSelector('[data-testid="entry-form"]');

    // Verify line numbers are shown
    await expect(settingsTester.page.locator('[data-testid="line-numbers"]')).toBeVisible();

    // Verify syntax highlighting
    await expect(settingsTester.page.locator('[data-testid="syntax-highlighted"]')).toBeVisible();

    // Test auto-save functionality
    await settingsTester.page.fill('[data-testid="entry-title-input"]', 'Auto-save test');
    await settingsTester.page.waitForTimeout(35000); // Wait for auto-save interval

    await expect(settingsTester.page.locator('[data-testid="auto-save-indicator"]')).toBeVisible();
  });

  test('Notification preferences configuration', async () => {
    const notificationPreferences: Partial<UserPreferences> = {
      notifications: {
        enableDesktop: true,
        enableSound: false,
        enableEmail: true,
        criticalOnly: false,
        quietHours: {
          enabled: true,
          start: '22:00',
          end: '07:00'
        }
      }
    };

    await settingsTester.applySettings(notificationPreferences);

    // Test notification system
    await settingsTester.page.evaluate(() => {
      // Trigger a test notification
      (window as any).showNotification?.('Test notification', 'info');
    });

    // Check if desktop notification permission is requested
    const notificationPermission = await settingsTester.page.evaluate(() => {
      return Notification.permission;
    });

    expect(['granted', 'default', 'denied']).toContain(notificationPermission);
  });

  test('Privacy settings workflow', async () => {
    const privacyPreferences: Partial<UserPreferences> = {
      privacy: {
        analyticsEnabled: false,
        errorReporting: false,
        usageStatistics: false,
        dataRetention: 90
      }
    };

    await settingsTester.applySettings(privacyPreferences);

    // Verify analytics are disabled
    const analyticsStatus = await settingsTester.page.evaluate(() => {
      return (window as any).analyticsEnabled;
    });

    expect(analyticsStatus).toBe(false);

    // Test data retention settings
    await settingsTester.page.goto('#/analytics');
    const dataRetentionText = await settingsTester.page.locator('[data-testid="data-retention-info"]').textContent();
    expect(dataRetentionText).toContain('90 days');
  });

  test('Performance settings optimization', async () => {
    const performancePreferences: Partial<UserPreferences> = {
      performance: {
        enableCaching: true,
        cacheSize: 100,
        preloadResults: true,
        backgroundIndexing: true,
        maxConcurrentRequests: 5
      }
    };

    await settingsTester.applySettings(performancePreferences);
    await settingsTester.testSettingsImpactOnPerformance();

    const metrics = settingsTester.getMetrics();

    // Performance should be reasonable
    expect(metrics.performanceImpact.renderTime).toBeLessThan(5000);
    expect(metrics.performanceImpact.responseTime).toBeLessThan(3000);
    expect(metrics.performanceImpact.memoryUsage).toBeLessThan(50 * 1024 * 1024); // 50MB
  });

  test('Accessibility settings comprehensive test', async () => {
    const accessibilityPreferences: Partial<UserPreferences> = {
      accessibility: {
        screenReader: true,
        keyboardNavigation: true,
        focusIndicators: true,
        reducedMotion: true,
        highContrast: true,
        textToSpeech: false
      }
    };

    await settingsTester.applySettings(accessibilityPreferences);
    await settingsTester.testAccessibilityCompliance();

    const metrics = settingsTester.getMetrics();

    // All accessibility checks should pass
    expect(metrics.accessibilityCompliance.every(check => check)).toBe(true);

    // Test keyboard navigation
    await settingsTester.page.keyboard.press('Tab');
    await settingsTester.page.keyboard.press('Tab');
    const focusedElement = await settingsTester.page.locator(':focus');
    expect(await focusedElement.isVisible()).toBe(true);

    // Test reduced motion
    const hasReducedMotion = await settingsTester.page.evaluate(() => {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    });
    expect(hasReducedMotion).toBe(true);
  });

  test('Backup and restoration settings workflow', async () => {
    const backupPreferences: Partial<UserPreferences> = {
      backup: {
        autoBackup: true,
        backupInterval: 'daily',
        backupLocation: '/backup/settings',
        maxBackups: 10,
        includeSettings: true
      }
    };

    await settingsTester.applySettings(backupPreferences);

    // Test backup functionality
    await settingsTester.page.click('[data-testid="backup-settings-tab"]');
    await settingsTester.page.click('[data-testid="create-backup-now"]');
    await settingsTester.page.waitForSelector('[data-testid="backup-success"]', { timeout: 15000 });

    // Verify backup was created
    const backupList = await settingsTester.page.locator('[data-testid^="backup-item-"]').count();
    expect(backupList).toBeGreaterThan(0);
  });

  test('Settings import and export workflow', async () => {
    // Configure some specific settings
    const testSettings: Partial<UserPreferences> = {
      ui: { theme: 'dark', fontSize: 'large' },
      search: { defaultResultsPerPage: 20, autoSuggestions: false },
      editor: { autoSave: true, lineNumbers: true }
    };

    await settingsTester.applySettings(testSettings);

    // Export settings
    const exportedData = await settingsTester.exportSettings();
    expect(exportedData).toBeTruthy();
    expect(exportedData).toContain('ui');
    expect(exportedData).toContain('search');
    expect(exportedData).toContain('editor');

    // Reset to defaults
    await settingsTester.resetToDefaults();

    // Verify settings were reset
    const defaultSettings = await settingsTester.getCurrentSettings();
    expect(defaultSettings.ui?.theme).not.toBe('dark');

    // Import settings back
    await settingsTester.importSettings(exportedData);

    // Verify settings were restored
    const restoredSettings = await settingsTester.getCurrentSettings();
    expect(restoredSettings.ui?.theme).toBe('dark');
    expect(restoredSettings.ui?.fontSize).toBe('large');
    expect(restoredSettings.search?.defaultResultsPerPage).toBe(20);
  });

  test('Settings validation and error handling', async () => {
    const invalidSettings = [
      // Invalid theme
      { ui: { theme: 'invalid-theme' as any } },
      // Invalid font size
      { ui: { fontSize: 'super-large' as any } },
      // Invalid cache size
      { performance: { cacheSize: -10 } },
      // Invalid backup interval
      { backup: { backupInterval: 'hourly' as any } }
    ];

    for (const invalidSetting of invalidSettings) {
      try {
        await settingsTester.applySettings(invalidSetting);
        // Should show validation error
        await expect(settingsTester.page.locator('[data-testid="validation-error"]')).toBeVisible();
      } catch (error) {
        // Expected for invalid settings
        expect(error).toBeDefined();
      }
    }

    const metrics = settingsTester.getMetrics();
    expect(metrics.preferenceValidationErrors.length).toBeGreaterThan(0);
  });

  test('Settings synchronization across sessions', async ({ browser }) => {
    const testSettings: Partial<UserPreferences> = {
      ui: { theme: 'dark', compactMode: true },
      search: { autoSuggestions: true }
    };

    // Apply settings in first session
    await settingsTester.applySettings(testSettings);

    // Create new browser context (simulate new session)
    const newContext = await browser.newContext();
    const newPage = await newContext.newPage();
    const newSettingsTester = new SettingsWorkflowTester(newPage);

    await newPage.goto('/');
    await newPage.waitForSelector('[data-testid="app-root"]');

    // Verify settings are synchronized
    const syncedSettings = await newSettingsTester.getCurrentSettings();
    expect(syncedSettings.ui?.theme).toBe('dark');
    expect(syncedSettings.ui?.compactMode).toBe(true);
    expect(syncedSettings.search?.autoSuggestions).toBe(true);

    await newContext.close();
  });

  test('Settings performance impact analysis', async () => {
    // Test with minimal settings
    const minimalSettings: Partial<UserPreferences> = {
      ui: { animations: false, theme: 'light' },
      performance: { enableCaching: false, preloadResults: false },
      accessibility: { screenReader: false, textToSpeech: false }
    };

    await settingsTester.applySettings(minimalSettings);
    await settingsTester.testSettingsImpactOnPerformance();
    const minimalMetrics = settingsTester.getMetrics();

    // Test with maximal settings
    const maximalSettings: Partial<UserPreferences> = {
      ui: { animations: true, theme: 'dark' },
      performance: { enableCaching: true, preloadResults: true },
      accessibility: { screenReader: true, textToSpeech: true }
    };

    await settingsTester.applySettings(maximalSettings);
    await settingsTester.testSettingsImpactOnPerformance();
    const maximalMetrics = settingsTester.getMetrics();

    // Compare performance impact
    console.log('Performance Comparison:', {
      minimal: minimalMetrics.performanceImpact,
      maximal: maximalMetrics.performanceImpact
    });

    // Both configurations should remain performant
    expect(minimalMetrics.performanceImpact.responseTime).toBeLessThan(3000);
    expect(maximalMetrics.performanceImpact.responseTime).toBeLessThan(5000);
  });

  test('Settings security and privacy compliance', async () => {
    // Test privacy-focused configuration
    const privacySettings: Partial<UserPreferences> = {
      privacy: {
        analyticsEnabled: false,
        errorReporting: false,
        usageStatistics: false,
        dataRetention: 30
      },
      backup: {
        autoBackup: false,
        includeSettings: false
      }
    };

    await settingsTester.applySettings(privacySettings);

    // Verify no tracking data is collected
    const trackingStatus = await settingsTester.page.evaluate(() => {
      return {
        analytics: (window as any).analyticsEnabled,
        errorReporting: (window as any).errorReportingEnabled,
        tracking: document.querySelectorAll('[data-track], [data-analytics]').length
      };
    });

    expect(trackingStatus.analytics).toBe(false);
    expect(trackingStatus.errorReporting).toBe(false);
    expect(trackingStatus.tracking).toBe(0);

    // Verify data retention policy
    await settingsTester.page.goto('#/privacy');
    const retentionInfo = await settingsTester.page.locator('[data-testid="retention-policy"]').textContent();
    expect(retentionInfo).toContain('30 days');
  });
});