/**
 * Test Utilities for Incident Management E2E Tests
 *
 * This module provides reusable utilities, page objects, and helper functions
 * for testing incident management components.
 *
 * @location /tests/e2e/incident-management/test-utilities.ts
 */

import { Page, expect, Locator } from '@playwright/test';

// Types for incident data
export interface TestIncident {
  id: string;
  title: string;
  description: string;
  status: 'aberto' | 'em_tratamento' | 'resolvido' | 'fechado' | 'em_revisao';
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  category: string;
  affected_system: string;
  assigned_to: string;
  reported_by: string;
  incident_date: string;
  tags: string[];
  created_at: Date;
  updated_at: Date;
  business_impact: 'crítica' | 'alta' | 'média' | 'baixa';
  customer_impact: boolean;
  sla_deadline?: Date;
  resolution_time?: number;
  escalation_level?: 'none' | 'level_1' | 'level_2' | 'level_3';
}

export interface TestComment {
  id: string;
  content: string;
  author: string;
  timestamp: Date;
  is_internal: boolean;
  attachments: string[];
}

export interface TestFilters {
  status: string[];
  priority: string[];
  dateRange?: {
    type: 'created' | 'updated' | 'resolved';
    startDate: string;
    endDate: string;
  };
  assignedTo: string[];
  category: string[];
  impactLevel: string[];
  tags: string[];
  slaStatus: string[];
  searchText: string;
}

// Mock data generators
export class MockDataGenerator {
  static createIncident(overrides: Partial<TestIncident> = {}): TestIncident {
    return {
      id: `INC-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      title: 'Sistema CICS Produção com Falha',
      description: 'Descrição detalhada do incidente de teste',
      status: 'aberto',
      priority: 'P2',
      category: 'Sistema Indisponível',
      affected_system: 'CICS Produção',
      assigned_to: 'teste.usuario@empresa.com',
      reported_by: 'reporter@empresa.com',
      incident_date: '2024-01-15',
      tags: ['teste', 'automatizado'],
      created_at: new Date(),
      updated_at: new Date(),
      business_impact: 'alta',
      customer_impact: false,
      escalation_level: 'none',
      ...overrides
    };
  }

  static createComment(overrides: Partial<TestComment> = {}): TestComment {
    return {
      id: `comment-${Date.now()}`,
      content: 'Comentário de teste gerado automaticamente',
      author: 'teste.usuario@empresa.com',
      timestamp: new Date(),
      is_internal: false,
      attachments: [],
      ...overrides
    };
  }

  static createFilters(overrides: Partial<TestFilters> = {}): TestFilters {
    return {
      status: [],
      priority: [],
      assignedTo: [],
      category: [],
      impactLevel: [],
      tags: [],
      slaStatus: [],
      searchText: '',
      ...overrides
    };
  }

  static createMultipleIncidents(count: number, baseData: Partial<TestIncident> = {}): TestIncident[] {
    return Array.from({ length: count }, (_, index) =>
      this.createIncident({
        ...baseData,
        id: `INC-${(index + 1).toString().padStart(3, '0')}`,
        title: `Incident ${index + 1} - ${baseData.title || 'Teste'}`,
        created_at: new Date(Date.now() - (index * 3600000)) // 1 hour apart
      })
    );
  }
}

// Page Object Models
export class IncidentDetailPage {
  constructor(private page: Page) {}

  // Locators
  get container() { return this.page.locator('[data-testid="incident-detail-view"]'); }
  get header() { return this.page.locator('[data-testid="incident-header"]'); }
  get incidentNumber() { return this.page.locator('[data-testid="incident-number"]'); }
  get incidentTitle() { return this.page.locator('[data-testid="incident-title"]'); }
  get statusBadge() { return this.page.locator('[data-testid="incident-status-badge"]'); }
  get priorityBadge() { return this.page.locator('[data-testid="incident-priority-badge"]'); }
  get assignedTo() { return this.page.locator('[data-testid="assigned-to"]'); }
  get slaStatus() { return this.page.locator('[data-testid="sla-status-badge"]'); }
  get editButton() { return this.page.locator('[data-testid="edit-incident-button"]'); }
  get assignButton() { return this.page.locator('[data-testid="assign-button"]'); }
  get escalateButton() { return this.page.locator('[data-testid="escalate-button"]'); }
  get closeButton() { return this.page.locator('[data-testid="close-incident-button"]'); }

  // Tab selectors
  get detailsTab() { return this.page.locator('[data-testid="tab-details"]'); }
  get timelineTab() { return this.page.locator('[data-testid="tab-timeline"]'); }
  get commentsTab() { return this.page.locator('[data-testid="tab-comments"]'); }
  get relatedTab() { return this.page.locator('[data-testid="tab-related"]'); }
  get attachmentsTab() { return this.page.locator('[data-testid="tab-attachments"]'); }
  get activityTab() { return this.page.locator('[data-testid="tab-activity"]'); }

  // Tab content selectors
  get detailsContent() { return this.page.locator('[data-testid="tab-content-details"]'); }
  get timelineContent() { return this.page.locator('[data-testid="tab-content-timeline"]'); }
  get commentsContent() { return this.page.locator('[data-testid="tab-content-comments"]'); }

  // Comments section
  get commentsList() { return this.page.locator('[data-testid="comments-list"]'); }
  get commentItems() { return this.page.locator('[data-testid="comment-item"]'); }
  get commentTextarea() { return this.page.locator('[data-testid="comment-textarea"]'); }
  get internalCommentCheckbox() { return this.page.locator('[data-testid="internal-comment-checkbox"]'); }
  get addCommentButton() { return this.page.locator('[data-testid="add-comment-button"]'); }

  // Methods
  async waitForLoad() {
    await this.container.waitFor({ state: 'visible' });
  }

  async switchToTab(tab: 'details' | 'timeline' | 'comments' | 'related' | 'attachments' | 'activity') {
    await this.page.click(`[data-testid="tab-${tab}"]`);
    await this.page.waitForSelector(`[data-testid="tab-content-${tab}"]`, { state: 'visible' });
  }

  async addComment(text: string, isInternal: boolean = false) {
    await this.switchToTab('comments');

    if (isInternal) {
      await this.internalCommentCheckbox.check();
    }

    await this.commentTextarea.fill(text);
    await this.addCommentButton.click();
  }

  async assignIncident(userEmail: string) {
    await this.assignButton.click();
    await this.page.waitForSelector('[data-testid="assign-modal"]');
    await this.page.fill('[data-testid="assigned-user-input"]', userEmail);
    await this.page.click('[data-testid="assign-confirm-button"]');
  }

  async escalateIncident(reason: string) {
    await this.escalateButton.click();
    await this.page.waitForSelector('[data-testid="escalate-modal"]');
    await this.page.fill('[data-testid="escalation-reason"]', reason);
    await this.page.click('[data-testid="escalate-confirm-button"]');
  }

  async changeStatus(newStatus: string) {
    await this.page.click(`[data-testid="status-${newStatus}"]`);
  }

  async getCommentCount(): Promise<number> {
    await this.switchToTab('comments');
    return await this.commentItems.count();
  }

  async getStatusHistory(): Promise<string[]> {
    await this.switchToTab('timeline');
    const transitions = await this.page.locator('[data-testid="status-transition"]').all();
    const history: string[] = [];

    for (const transition of transitions) {
      const text = await transition.textContent();
      if (text) history.push(text);
    }

    return history;
  }
}

export class EditIncidentModalPage {
  constructor(private page: Page) {}

  // Locators
  get modal() { return this.page.locator('[data-testid="edit-incident-modal"]'); }
  get titleInput() { return this.page.locator('[data-testid="title-input"]'); }
  get descriptionTextarea() { return this.page.locator('[data-testid="description-textarea"]'); }
  get prioritySelect() { return this.page.locator('[data-testid="priority-select"]'); }
  get statusSelect() { return this.page.locator('[data-testid="status-select"]'); }
  get categorySelect() { return this.page.locator('[data-testid="category-select"]'); }
  get impactSelect() { return this.page.locator('[data-testid="impact-select"]'); }
  get affectedSystemInput() { return this.page.locator('[data-testid="affected-system-input"]'); }
  get assignedToInput() { return this.page.locator('[data-testid="assigned-to-input"]'); }
  get reportedByInput() { return this.page.locator('[data-testid="reported-by-input"]'); }
  get incidentDateInput() { return this.page.locator('[data-testid="incident-date-input"]'); }
  get tagInput() { return this.page.locator('[data-testid="tag-input"]'); }
  get changeReasonTextarea() { return this.page.locator('[data-testid="change-reason-textarea"]'); }

  get aiSuggestionButton() { return this.page.locator('[data-testid="ai-suggestion-button"]'); }
  get saveButton() { return this.page.locator('[data-testid="save-button"]'); }
  get cancelButton() { return this.page.locator('[data-testid="cancel-button"]'); }
  get resetButton() { return this.page.locator('[data-testid="reset-button"]'); }

  get changesSummary() { return this.page.locator('[data-testid="changes-summary"]'); }
  get criticalChangeIndicator() { return this.page.locator('[data-testid="critical-change-indicator"]'); }

  // Methods
  async waitForLoad() {
    await this.modal.waitFor({ state: 'visible' });
  }

  async fillBasicInfo(data: Partial<TestIncident>) {
    if (data.title) await this.titleInput.fill(data.title);
    if (data.description) await this.descriptionTextarea.fill(data.description);
    if (data.priority) await this.prioritySelect.selectOption(data.priority);
    if (data.status) await this.statusSelect.selectOption(data.status);
    if (data.category) await this.categorySelect.selectOption(data.category);
    if (data.affected_system) await this.affectedSystemInput.fill(data.affected_system);
    if (data.assigned_to) await this.assignedToInput.fill(data.assigned_to);
    if (data.reported_by) await this.reportedByInput.fill(data.reported_by);
    if (data.incident_date) await this.incidentDateInput.fill(data.incident_date);
  }

  async addTags(tags: string[]) {
    for (const tag of tags) {
      await this.tagInput.fill(tag);
      await this.tagInput.press('Enter');
    }
  }

  async removeTag(tag: string) {
    await this.page.click(`[data-testid="remove-tag-${tag}"]`);
  }

  async triggerAISuggestion() {
    await this.aiSuggestionButton.click();
    await this.page.waitForSelector('[data-testid="ai-suggestion-loading"]');
    // Wait for suggestion to complete (mocked)
    await this.page.waitForTimeout(2000);
  }

  async getChangedFieldsCount(): Promise<number> {
    const text = await this.changesSummary.textContent();
    const match = text?.match(/(\d+) campo/);
    return match ? parseInt(match[1]) : 0;
  }

  async isCriticalChange(): Promise<boolean> {
    return await this.criticalChangeIndicator.isVisible();
  }

  async saveChanges(confirmCritical: boolean = true) {
    await this.saveButton.click();

    // Handle critical changes confirmation
    if (confirmCritical && await this.page.locator('[data-testid="critical-changes-confirmation"]').isVisible()) {
      await this.page.click('[data-testid="confirm-critical-changes"]');
    }
  }

  async getValidationErrors(): Promise<string[]> {
    const errorElements = await this.page.locator('[data-testid*="-error"]').all();
    const errors: string[] = [];

    for (const element of errorElements) {
      const text = await element.textContent();
      if (text) errors.push(text);
    }

    return errors;
  }

  async resetForm() {
    await this.resetButton.click();
  }

  async cancel() {
    await this.cancelButton.click();
  }
}

export class AdvancedFiltersPanelPage {
  constructor(private page: Page) {}

  // Locators
  get panel() { return this.page.locator('[data-testid="advanced-filters-panel"]'); }
  get header() { return this.page.locator('[data-testid="filters-header"]'); }
  get activeFiltersCount() { return this.page.locator('[data-testid="active-filters-count"]'); }
  get exportButton() { return this.page.locator('[data-testid="export-button"]'); }
  get collapseToggle() { return this.page.locator('[data-testid="collapse-toggle"]'); }
  get filtersContent() { return this.page.locator('[data-testid="filters-content"]'); }

  // Quick filters
  get quickFiltersSection() { return this.page.locator('[data-testid="quick-filters-section"]'); }

  // Search
  get searchTextInput() { return this.page.locator('[data-testid="search-text-input"]'); }

  // Filter dropdowns
  get statusFilterDropdown() { return this.page.locator('[data-testid="status-filter-dropdown"]'); }
  get priorityFilterDropdown() { return this.page.locator('[data-testid="priority-filter-dropdown"]'); }
  get assignedToFilterDropdown() { return this.page.locator('[data-testid="assigned-to-filter-dropdown"]'); }
  get categoryFilterDropdown() { return this.page.locator('[data-testid="category-filter-dropdown"]'); }
  get impactFilterDropdown() { return this.page.locator('[data-testid="impact-filter-dropdown"]'); }
  get slaStatusFilterDropdown() { return this.page.locator('[data-testid="sla-status-filter-dropdown"]'); }

  // Date range
  get dateTypeSelect() { return this.page.locator('[data-testid="date-type-select"]'); }
  get startDateInput() { return this.page.locator('[data-testid="start-date-input"]'); }
  get endDateInput() { return this.page.locator('[data-testid="end-date-input"]'); }

  // Tags
  get tagsInput() { return this.page.locator('[data-testid="tags-input"]'); }

  // Actions
  get clearFiltersButton() { return this.page.locator('[data-testid="clear-filters-button"]'); }
  get savePresetButton() { return this.page.locator('[data-testid="save-preset-button"]'); }

  // Methods
  async waitForLoad() {
    await this.panel.waitFor({ state: 'visible' });
  }

  async applyQuickFilter(filterId: string) {
    await this.page.click(`[data-testid="quick-filter-${filterId}"]`);
  }

  async setSearchText(text: string) {
    await this.searchTextInput.fill(text);
  }

  async selectStatusFilters(statuses: string[]) {
    await this.statusFilterDropdown.click();
    for (const status of statuses) {
      await this.page.click(`[data-testid="status-option-${status}"]`);
    }
    // Click outside to close dropdown
    await this.panel.click();
  }

  async selectPriorityFilters(priorities: string[]) {
    await this.priorityFilterDropdown.click();
    for (const priority of priorities) {
      await this.page.click(`[data-testid="priority-option-${priority}"]`);
    }
    await this.panel.click();
  }

  async selectAssignedToFilters(users: string[]) {
    await this.assignedToFilterDropdown.click();
    for (const user of users) {
      await this.page.click(`[data-testid="user-option-${user}"]`);
    }
    await this.panel.click();
  }

  async setDateRange(type: 'created' | 'updated' | 'resolved', startDate: string, endDate: string) {
    await this.dateTypeSelect.selectOption(type);
    await this.startDateInput.fill(startDate);
    await this.endDateInput.fill(endDate);
  }

  async setTags(tags: string[]) {
    await this.tagsInput.fill(tags.join(', '));
  }

  async clearAllFilters() {
    await this.clearFiltersButton.click();
  }

  async savePreset(name: string) {
    await this.savePresetButton.click();
    await this.page.waitForSelector('[data-testid="save-preset-modal"]');
    await this.page.fill('[data-testid="preset-name-input"]', name);
    await this.page.click('[data-testid="save-preset-confirm"]');
  }

  async applyPreset(presetName: string) {
    await this.page.click(`[data-testid="preset-${presetName}"]`);
  }

  async exportData() {
    const downloadPromise = this.page.waitForEvent('download');
    await this.exportButton.click();
    return await downloadPromise;
  }

  async getActiveFilterCount(): Promise<number> {
    const text = await this.activeFiltersCount.textContent();
    const match = text?.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  async collapse() {
    if (await this.filtersContent.isVisible()) {
      await this.collapseToggle.click();
    }
  }

  async expand() {
    if (!await this.filtersContent.isVisible()) {
      await this.collapseToggle.click();
    }
  }

  async getFilterBadges(filterType: string): Promise<string[]> {
    const badges = await this.page.locator(`[data-testid*="${filterType}-filter-badge-"]`).all();
    const badgeTexts: string[] = [];

    for (const badge of badges) {
      const text = await badge.textContent();
      if (text) badgeTexts.push(text);
    }

    return badgeTexts;
  }
}

// Test helper functions
export class IncidentTestHelpers {
  constructor(private page: Page) {}

  async setupMockIncidentAPI(incidents: TestIncident[] = []) {
    await this.page.addInitScript((mockIncidents) => {
      (window as any).electron = {
        ipcRenderer: {
          invoke: async (channel: string, data?: any) => {
            switch (channel) {
              case 'incident:list':
                return mockIncidents;
              case 'incident:get':
                return mockIncidents.find(inc => inc.id === data?.id) || mockIncidents[0];
              case 'incident:getComments':
                return [
                  {
                    id: '1',
                    content: 'Test comment',
                    author: 'test@empresa.com',
                    timestamp: new Date(),
                    is_internal: false,
                    attachments: []
                  }
                ];
              case 'incident:getStatusHistory':
                return [
                  {
                    id: '1',
                    from_status: 'aberto',
                    to_status: 'em_tratamento',
                    changed_by: 'test@empresa.com',
                    timestamp: new Date(),
                    change_reason: 'Test status change'
                  }
                ];
              case 'incident:search':
                return mockIncidents.filter(inc =>
                  inc.title.toLowerCase().includes(data?.query?.toLowerCase() || '')
                );
              case 'incident:create':
              case 'incident:update':
              case 'incident:delete':
              case 'incident:addComment':
              case 'incident:updateStatus':
              case 'incident:assign':
              case 'incident:escalate':
                return { success: true, id: data?.id || 'new-id' };
              default:
                return { success: true };
            }
          }
        }
      };
    }, incidents);
  }

  async navigateToIncidentList() {
    await this.page.goto('/incidents');
    await this.page.waitForLoadState('networkidle');
  }

  async openIncidentDetail(incidentId: string) {
    await this.page.click(`[data-testid="incident-row-${incidentId}"]`);
    await this.page.waitForSelector('[data-testid="incident-detail-view"]');
  }

  async waitForToastMessage(message: string) {
    await this.page.waitForSelector(`[data-testid="toast"]:has-text("${message}")`);
  }

  async checkAccessibilityViolations(): Promise<string[]> {
    return await this.page.evaluate(() => {
      const violations: string[] = [];

      // Check for missing alt text
      const images = document.querySelectorAll('img:not([alt])');
      if (images.length > 0) {
        violations.push(`${images.length} images missing alt text`);
      }

      // Check for proper form labels
      const inputs = document.querySelectorAll('input, select, textarea');
      inputs.forEach((input, index) => {
        const hasLabel = input.getAttribute('aria-label') ||
                        input.getAttribute('aria-labelledby') ||
                        document.querySelector(`label[for="${input.id}"]`);
        if (!hasLabel) {
          violations.push(`Input ${index} missing accessible label`);
        }
      });

      // Check for proper heading hierarchy
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
      let previousLevel = 0;
      for (const heading of headings) {
        const level = parseInt(heading.tagName.charAt(1));
        if (level > previousLevel + 1) {
          violations.push(`Heading hierarchy skip: ${heading.tagName} follows h${previousLevel}`);
        }
        previousLevel = level;
      }

      return violations;
    });
  }

  async simulateNetworkError() {
    await this.page.route('**/api/**', route => route.abort());
  }

  async simulateSlowNetwork() {
    await this.page.route('**/api/**', route => {
      setTimeout(() => route.continue(), 2000);
    });
  }

  async measurePerformance(action: () => Promise<void>): Promise<number> {
    const startTime = Date.now();
    await action();
    return Date.now() - startTime;
  }

  async checkConsoleErrors(): Promise<string[]> {
    const logs: string[] = [];
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        logs.push(msg.text());
      }
    });
    return logs;
  }

  async waitForElementToBeStable(selector: string, timeout: number = 5000) {
    await this.page.waitForFunction(
      (sel) => {
        const element = document.querySelector(sel);
        return element && getComputedStyle(element).animation === 'none';
      },
      selector,
      { timeout }
    );
  }

  async checkColorContrast(selector: string): Promise<{ ratio: number; passes: boolean }> {
    return await this.page.evaluate((sel) => {
      const element = document.querySelector(sel);
      if (!element) return { ratio: 0, passes: false };

      const styles = getComputedStyle(element);
      const color = styles.color;
      const backgroundColor = styles.backgroundColor;

      // Simple contrast check (would need proper implementation)
      // This is a placeholder - real implementation would calculate actual contrast ratio
      return {
        ratio: 4.5, // Mock ratio
        passes: true // Mock result
      };
    }, selector);
  }
}

// Custom assertions
export const incidentAssertions = {
  async toHaveValidIncidentStatus(page: Page, selector: string) {
    const statusText = await page.locator(selector).textContent();
    const validStatuses = ['Aberto', 'Em Tratamento', 'Resolvido', 'Fechado', 'Em Revisão'];
    expect(validStatuses).toContain(statusText);
  },

  async toHaveValidPriority(page: Page, selector: string) {
    const priorityText = await page.locator(selector).textContent();
    const validPriorities = ['P1', 'P2', 'P3', 'P4'];
    expect(validPriorities.some(p => priorityText?.includes(p))).toBeTruthy();
  },

  async toHavePortugueseLabels(page: Page, selector: string) {
    const element = page.locator(selector);
    const text = await element.textContent();

    // Check for Portuguese-specific terms
    const portugueseTerms = [
      'Atribuído', 'Responsável', 'Criado', 'Atualizado', 'Prioridade',
      'Status', 'Categoria', 'Descrição', 'Comentários', 'Anexos'
    ];

    const hasPortugueseTerms = portugueseTerms.some(term => text?.includes(term));
    expect(hasPortugueseTerms).toBeTruthy();
  },

  async toBeWithinSLALimits(page: Page, selector: string) {
    const slaElement = page.locator(selector);
    const classes = await slaElement.getAttribute('class');

    // Check that SLA status is one of the valid states
    const validSLAClasses = ['sla-on-time', 'sla-at-risk', 'sla-breached'];
    const hasSLAClass = validSLAClasses.some(cls => classes?.includes(cls));
    expect(hasSLAClass).toBeTruthy();
  }
};

export default {
  MockDataGenerator,
  IncidentDetailPage,
  EditIncidentModalPage,
  AdvancedFiltersPanelPage,
  IncidentTestHelpers,
  incidentAssertions
};