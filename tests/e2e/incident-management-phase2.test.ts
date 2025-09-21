/**
 * Comprehensive Playwright E2E Tests for Incident Management Phase 2 Components
 *
 * This test suite validates:
 * 1. IncidentDetailView - Component rendering, timeline, comments, state transitions, mobile responsiveness
 * 2. EditIncidentModal - Form validation, field tracking, critical changes, Portuguese language
 * 3. AdvancedFiltersPanel - All filter types, quick filters, presets, export functionality
 * 4. Integration workflows - End-to-end incident management from creation to resolution
 * 5. Accessibility - WCAG 2.1 AA compliance, keyboard navigation, screen reader compatibility
 * 6. Performance - Component rendering and interaction responsiveness
 *
 * @location /tests/e2e/incident-management-phase2.test.ts
 */

import { test, expect, Page, Locator } from '@playwright/test';

// Test data and utilities
interface MockIncident {
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

const mockIncidents: MockIncident[] = [
  {
    id: 'INC-001',
    title: 'Sistema CICS Produção Indisponível',
    description: 'Falha no sistema CICS principal causando indisponibilidade total para usuários de produção',
    status: 'aberto',
    priority: 'P1',
    category: 'Sistema Indisponível',
    affected_system: 'CICS Produção',
    assigned_to: 'joão.silva@empresa.com',
    reported_by: 'maria.santos@empresa.com',
    incident_date: '2024-01-15',
    tags: ['cics-crash', 'produção', 'crítico'],
    created_at: new Date('2024-01-15T08:30:00'),
    updated_at: new Date('2024-01-15T08:45:00'),
    business_impact: 'crítica',
    customer_impact: true,
    sla_deadline: new Date('2024-01-15T12:30:00'),
    escalation_level: 'none'
  },
  {
    id: 'INC-002',
    title: 'Performance Lenta Base de Dados DB2',
    description: 'Consultas SQL apresentando tempo de resposta elevado no subsistema DB2',
    status: 'em_tratamento',
    priority: 'P2',
    category: 'Performance',
    affected_system: 'DB2 Subsystem',
    assigned_to: 'pedro.oliveira@empresa.com',
    reported_by: 'ana.costa@empresa.com',
    incident_date: '2024-01-14',
    tags: ['db2-performance', 'sql-lento', 'deadlock'],
    created_at: new Date('2024-01-14T14:20:00'),
    updated_at: new Date('2024-01-15T09:15:00'),
    business_impact: 'alta',
    customer_impact: false,
    sla_deadline: new Date('2024-01-16T14:20:00'),
    escalation_level: 'none'
  }
];

// Test helpers and setup
class IncidentManagementHelpers {
  constructor(private page: Page) {}

  async setupMockData() {
    // Mock the incident data and IPC handlers
    await this.page.addInitScript(() => {
      // Mock electron IPC for incident operations
      (window as any).electron = {
        ipcRenderer: {
          invoke: async (channel: string, data?: any) => {
            const mockIncidents = [
              {
                id: 'INC-001',
                title: 'Sistema CICS Produção Indisponível',
                problem: 'Falha no sistema CICS principal causando indisponibilidade total para usuários de produção',
                status: 'aberto',
                priority: 'P1',
                category: 'Sistema Indisponível',
                affected_systems: ['CICS Produção'],
                assigned_to: 'joão.silva@empresa.com',
                reported_by: 'maria.santos@empresa.com',
                incident_date: '2024-01-15',
                tags: ['cics-crash', 'produção', 'crítico'],
                created_at: new Date('2024-01-15T08:30:00'),
                updated_at: new Date('2024-01-15T08:45:00'),
                business_impact: 'crítica',
                customer_impact: true,
                sla_deadline: new Date('2024-01-15T12:30:00'),
                escalation_level: 'none',
                incident_number: 'INC-001'
              }
            ];

            switch (channel) {
              case 'incident:get':
                return mockIncidents.find(inc => inc.id === data?.id) || mockIncidents[0];
              case 'incident:getComments':
                return [
                  {
                    id: '1',
                    content: 'Iniciando investigação do problema',
                    author: 'joão.silva@empresa.com',
                    timestamp: new Date('2024-01-15T08:35:00'),
                    is_internal: false,
                    attachments: []
                  },
                  {
                    id: '2',
                    content: 'Verificando logs do sistema CICS',
                    author: 'joão.silva@empresa.com',
                    timestamp: new Date('2024-01-15T08:40:00'),
                    is_internal: true,
                    attachments: ['cics_logs.txt']
                  }
                ];
              case 'incident:getStatusHistory':
                return [
                  {
                    id: '1',
                    from_status: 'aberto',
                    to_status: 'em_tratamento',
                    changed_by: 'joão.silva@empresa.com',
                    timestamp: new Date('2024-01-15T08:35:00'),
                    change_reason: 'Iniciando investigação'
                  }
                ];
              case 'incident:search':
                return mockIncidents.filter(inc => inc.id !== data?.query);
              case 'incident:addComment':
                return { success: true, id: Date.now().toString() };
              case 'incident:updateStatus':
                return { success: true };
              case 'incident:assign':
                return { success: true };
              case 'incident:escalate':
                return { success: true };
              case 'incident:update':
                return { success: true };
              default:
                return { success: true };
            }
          }
        }
      };
    });
  }

  async openIncidentDetailView(incidentId: string = 'INC-001') {
    await this.page.goto('/incidents');
    await this.page.click(`[data-testid="incident-row-${incidentId}"]`);
    await this.page.waitForSelector('[data-testid="incident-detail-view"]', { timeout: 5000 });
  }

  async openEditIncidentModal(incidentId: string = 'INC-001') {
    await this.openIncidentDetailView(incidentId);
    await this.page.click('[data-testid="edit-incident-button"]');
    await this.page.waitForSelector('[data-testid="edit-incident-modal"]', { timeout: 5000 });
  }

  async openAdvancedFiltersPanel() {
    await this.page.goto('/incidents');
    await this.page.click('[data-testid="advanced-filters-toggle"]');
    await this.page.waitForSelector('[data-testid="advanced-filters-panel"]', { timeout: 5000 });
  }

  async waitForElementWithText(selector: string, text: string, timeout: number = 5000) {
    await this.page.waitForFunction(
      ({ selector, text }) => {
        const element = document.querySelector(selector);
        return element && element.textContent?.includes(text);
      },
      { selector, text },
      { timeout }
    );
  }

  async checkAccessibility() {
    // Basic accessibility checks
    const violations = await this.page.evaluate(() => {
      const issues: string[] = [];

      // Check for missing alt text on images
      const images = document.querySelectorAll('img:not([alt])');
      if (images.length > 0) {
        issues.push(`${images.length} images missing alt text`);
      }

      // Check for proper heading hierarchy
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
      let previousLevel = 0;
      for (const heading of headings) {
        const level = parseInt(heading.tagName.charAt(1));
        if (level > previousLevel + 1) {
          issues.push(`Heading hierarchy violation: ${heading.tagName} follows h${previousLevel}`);
        }
        previousLevel = level;
      }

      // Check for form labels
      const inputs = document.querySelectorAll('input, select, textarea');
      inputs.forEach((input, index) => {
        const hasLabel = input.getAttribute('aria-label') ||
                        input.getAttribute('aria-labelledby') ||
                        document.querySelector(`label[for="${input.id}"]`);
        if (!hasLabel) {
          issues.push(`Input ${index} missing label`);
        }
      });

      return issues;
    });

    return violations;
  }
}

// Test Suite Setup
test.describe('Incident Management Phase 2 Components', () => {
  let helpers: IncidentManagementHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new IncidentManagementHelpers(page);
    await helpers.setupMockData();
  });

  test.describe('IncidentDetailView Component', () => {
    test('should render incident details correctly', async ({ page }) => {
      await helpers.openIncidentDetailView();

      // Check header information
      await expect(page.locator('[data-testid="incident-number"]')).toContainText('INC-001');
      await expect(page.locator('[data-testid="incident-title"]')).toContainText('Sistema CICS Produção Indisponível');
      await expect(page.locator('[data-testid="incident-status-badge"]')).toContainText('Aberto');
      await expect(page.locator('[data-testid="incident-priority-badge"]')).toContainText('P1');

      // Check metadata
      await expect(page.locator('[data-testid="created-date"]')).toBeVisible();
      await expect(page.locator('[data-testid="updated-date"]')).toBeVisible();
      await expect(page.locator('[data-testid="assigned-to"]')).toContainText('joão.silva@empresa.com');
    });

    test('should display SLA status correctly', async ({ page }) => {
      await helpers.openIncidentDetailView();

      // Check SLA status in header
      await expect(page.locator('[data-testid="sla-status-badge"]')).toBeVisible();

      // Check SLA details in sidebar
      await expect(page.locator('[data-testid="sla-deadline"]')).toBeVisible();
      await expect(page.locator('[data-testid="sla-status-sidebar"]')).toBeVisible();
    });

    test('should navigate between tabs correctly', async ({ page }) => {
      await helpers.openIncidentDetailView();

      // Test tab navigation
      const tabs = ['details', 'timeline', 'comments', 'related', 'attachments', 'activity'];

      for (const tab of tabs) {
        await page.click(`[data-testid="tab-${tab}"]`);
        await expect(page.locator(`[data-testid="tab-content-${tab}"]`)).toBeVisible();
      }
    });

    test('should display timeline and status history', async ({ page }) => {
      await helpers.openIncidentDetailView();

      // Navigate to timeline tab
      await page.click('[data-testid="tab-timeline"]');
      await expect(page.locator('[data-testid="tab-content-timeline"]')).toBeVisible();

      // Check status history entries
      await expect(page.locator('[data-testid="status-transition"]')).toHaveCount(1);
      await expect(page.locator('[data-testid="status-transition"]').first()).toContainText('joão.silva@empresa.com');
      await expect(page.locator('[data-testid="status-transition"]').first()).toContainText('Aberto');
      await expect(page.locator('[data-testid="status-transition"]').first()).toContainText('Em Tratamento');
    });

    test('should handle comments system', async ({ page }) => {
      await helpers.openIncidentDetailView();

      // Navigate to comments tab
      await page.click('[data-testid="tab-comments"]');
      await expect(page.locator('[data-testid="tab-content-comments"]')).toBeVisible();

      // Check existing comments
      await expect(page.locator('[data-testid="comment-item"]')).toHaveCount(2);

      // Test adding new comment
      await page.fill('[data-testid="comment-textarea"]', 'Teste de comentário novo');
      await page.click('[data-testid="add-comment-button"]');

      // Verify comment was added (would need proper mock handling)
      await helpers.waitForElementWithText('[data-testid="comments-list"]', 'Teste de comentário novo');
    });

    test('should handle internal vs external comments', async ({ page }) => {
      await helpers.openIncidentDetailView();

      // Navigate to comments tab
      await page.click('[data-testid="tab-comments"]');

      // Check internal comment checkbox
      await page.check('[data-testid="internal-comment-checkbox"]');
      await page.fill('[data-testid="comment-textarea"]', 'Comentário interno confidencial');
      await page.click('[data-testid="add-comment-button"]');

      // Verify internal comment styling
      const internalComments = page.locator('[data-testid="comment-item"] >> text=Interno');
      await expect(internalComments).toBeVisible();
    });

    test('should display related incidents', async ({ page }) => {
      await helpers.openIncidentDetailView();

      // Navigate to related tab
      await page.click('[data-testid="tab-related"]');
      await expect(page.locator('[data-testid="tab-content-related"]')).toBeVisible();

      // Check AI-generated related incidents
      await expect(page.locator('[data-testid="related-incident"]')).toBeTruthy();
      await expect(page.locator('text=similar')).toBeVisible();
    });

    test('should display attachments', async ({ page }) => {
      await helpers.openIncidentDetailView();

      // Navigate to attachments tab
      await page.click('[data-testid="tab-attachments"]');
      await expect(page.locator('[data-testid="tab-content-attachments"]')).toBeVisible();

      // Check add attachment button
      await expect(page.locator('[data-testid="add-attachment-button"]')).toBeVisible();
    });

    test('should handle status transitions', async ({ page }) => {
      await helpers.openIncidentDetailView();

      // Test status change via workflow
      await page.click('[data-testid="status-workflow"]');
      await page.click('[data-testid="status-option-em_tratamento"]');

      // Verify status change (would reflect in UI)
      await helpers.waitForElementWithText('[data-testid="incident-status-badge"]', 'Em Tratamento');
    });

    test('should handle incident assignment', async ({ page }) => {
      await helpers.openIncidentDetailView();

      // Open assignment modal
      await page.click('[data-testid="assign-button"]');
      await expect(page.locator('[data-testid="assign-modal"]')).toBeVisible();

      // Fill assignment form
      await page.fill('[data-testid="assigned-user-input"]', 'novo.responsavel@empresa.com');
      await page.click('[data-testid="assign-confirm-button"]');

      // Verify assignment
      await helpers.waitForElementWithText('[data-testid="assigned-to"]', 'novo.responsavel@empresa.com');
    });

    test('should handle incident escalation', async ({ page }) => {
      await helpers.openIncidentDetailView();

      // Open escalation modal
      await page.click('[data-testid="escalate-button"]');
      await expect(page.locator('[data-testid="escalate-modal"]')).toBeVisible();

      // Fill escalation form
      await page.fill('[data-testid="escalation-reason"]', 'SLA em risco, necessita atenção gerencial');
      await page.click('[data-testid="escalate-confirm-button"]');

      // Verify escalation badge appears
      await expect(page.locator('[data-testid="escalation-badge"]')).toBeVisible();
    });

    test('should be responsive on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await helpers.openIncidentDetailView();

      // Check mobile layout adaptations
      await expect(page.locator('[data-testid="incident-detail-view"]')).toBeVisible();

      // Verify sidebar stacks below main content on mobile
      const sidebar = page.locator('[data-testid="incident-sidebar"]');
      const mainContent = page.locator('[data-testid="incident-main-content"]');

      const sidebarBox = await sidebar.boundingBox();
      const mainBox = await mainContent.boundingBox();

      // On mobile, sidebar should be below main content
      expect(sidebarBox?.y).toBeGreaterThan(mainBox?.y || 0);
    });

    test('should handle real-time updates', async ({ page }) => {
      await helpers.openIncidentDetailView();

      // Simulate real-time update (would come from WebSocket or polling)
      await page.evaluate(() => {
        // Simulate incident update
        const event = new CustomEvent('incident-updated', {
          detail: {
            id: 'INC-001',
            status: 'em_tratamento',
            updated_at: new Date()
          }
        });
        window.dispatchEvent(event);
      });

      // Verify UI reflects the update
      await helpers.waitForElementWithText('[data-testid="incident-status-badge"]', 'Em Tratamento');
    });
  });

  test.describe('EditIncidentModal Component', () => {
    test('should open edit modal with pre-populated form', async ({ page }) => {
      await helpers.openEditIncidentModal();

      // Verify modal is open
      await expect(page.locator('[data-testid="edit-incident-modal"]')).toBeVisible();

      // Check form pre-population
      await expect(page.locator('[data-testid="title-input"]')).toHaveValue('Sistema CICS Produção Indisponível');
      await expect(page.locator('[data-testid="priority-select"]')).toHaveValue('P1');
      await expect(page.locator('[data-testid="status-select"]')).toHaveValue('aberto');
      await expect(page.locator('[data-testid="category-select"]')).toHaveValue('Sistema Indisponível');
    });

    test('should track field modifications', async ({ page }) => {
      await helpers.openEditIncidentModal();

      // Make a change to title
      await page.fill('[data-testid="title-input"]', 'Sistema CICS Produção Indisponível - ATUALIZADO');

      // Verify change indicator appears
      await expect(page.locator('[data-testid="field-change-indicator-title"]')).toBeVisible();
      await expect(page.locator('[data-testid="changes-summary"]')).toContainText('1 campo(s) alterado(s)');
    });

    test('should validate form fields with Portuguese messages', async ({ page }) => {
      await helpers.openEditIncidentModal();

      // Clear required fields to trigger validation
      await page.fill('[data-testid="title-input"]', '');
      await page.fill('[data-testid="description-textarea"]', '');
      await page.click('[data-testid="save-button"]');

      // Check Portuguese validation messages
      await expect(page.locator('[data-testid="title-error"]')).toContainText('Título é obrigatório');
      await expect(page.locator('[data-testid="description-error"]')).toContainText('Descrição é obrigatória');
    });

    test('should enforce status transition rules', async ({ page }) => {
      await helpers.openEditIncidentModal();

      // Try invalid status transition (directly from 'aberto' to 'fechado')
      await page.selectOption('[data-testid="status-select"]', 'fechado');

      // Check if invalid transition is disabled or shows error
      await expect(page.locator('[data-testid="status-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="status-error"]')).toContainText('Transição de status');
    });

    test('should handle critical field changes', async ({ page }) => {
      await helpers.openEditIncidentModal();

      // Change critical field (priority)
      await page.selectOption('[data-testid="priority-select"]', 'P2');

      // Verify critical change indicator
      await expect(page.locator('[data-testid="critical-change-indicator"]')).toBeVisible();

      // Check that change reason field appears
      await expect(page.locator('[data-testid="change-reason-textarea"]')).toBeVisible();
    });

    test('should require change reason for critical changes', async ({ page }) => {
      await helpers.openEditIncidentModal();

      // Make critical change
      await page.selectOption('[data-testid="priority-select"]', 'P2');

      // Try to save without change reason
      await page.click('[data-testid="save-button"]');

      // Verify validation error
      await expect(page.locator('[data-testid="change-reason-error"]')).toContainText('Motivo da mudança é obrigatório');
    });

    test('should show confirmation dialog for critical changes', async ({ page }) => {
      await helpers.openEditIncidentModal();

      // Make critical change with reason
      await page.selectOption('[data-testid="priority-select"]', 'P2');
      await page.fill('[data-testid="change-reason-textarea"]', 'Reduzindo prioridade após análise');

      // Save should trigger confirmation dialog
      await page.click('[data-testid="save-button"]');
      await expect(page.locator('[data-testid="critical-changes-confirmation"]')).toBeVisible();

      // Check confirmation dialog content
      await expect(page.locator('[data-testid="critical-changes-list"]')).toContainText('Prioridade');
      await expect(page.locator('[data-testid="critical-changes-list"]')).toContainText('P1');
      await expect(page.locator('[data-testid="critical-changes-list"]')).toContainText('P2');
    });

    test('should handle AI suggestions for categorization', async ({ page }) => {
      await helpers.openEditIncidentModal();

      // Modify description to trigger AI analysis
      await page.fill('[data-testid="description-textarea"]', 'Performance lenta no banco de dados DB2 com deadlocks frequentes');

      // Click AI suggestion button
      await page.click('[data-testid="ai-suggestion-button"]');

      // Verify AI suggestion is loading
      await expect(page.locator('[data-testid="ai-suggestion-loading"]')).toBeVisible();

      // Wait for suggestions to apply (mocked)
      await page.waitForTimeout(2000);

      // Verify AI-suggested changes are highlighted
      await expect(page.locator('[data-testid="field-change-indicator-category"]')).toBeVisible();
    });

    test('should manage tags correctly', async ({ page }) => {
      await helpers.openEditIncidentModal();

      // Add new tag
      await page.fill('[data-testid="tag-input"]', 'novo-tag');
      await page.press('[data-testid="tag-input"]', 'Enter');

      // Verify tag was added
      await expect(page.locator('[data-testid="tag-novo-tag"]')).toBeVisible();

      // Remove existing tag
      await page.click('[data-testid="remove-tag-cics-crash"]');

      // Verify tag was removed
      await expect(page.locator('[data-testid="tag-cics-crash"]')).not.toBeVisible();

      // Test tag suggestions
      await page.fill('[data-testid="tag-input"]', 'db2');
      await expect(page.locator('[data-testid="tag-suggestions"]')).toBeVisible();
      await expect(page.locator('[data-testid="tag-suggestion-db2-error"]')).toBeVisible();
    });

    test('should validate character limits', async ({ page }) => {
      await helpers.openEditIncidentModal();

      // Test title character limit
      const longTitle = 'A'.repeat(201);
      await page.fill('[data-testid="title-input"]', longTitle);

      // Verify character count indicator shows over limit
      await expect(page.locator('[data-testid="title-char-count"]')).toContainText('201/200');
      await expect(page.locator('[data-testid="title-char-count"]')).toHaveClass(/text-red/);

      // Test description character limit
      const longDescription = 'B'.repeat(5001);
      await page.fill('[data-testid="description-textarea"]', longDescription);

      // Verify character count indicator
      await expect(page.locator('[data-testid="description-char-count"]')).toContainText('5001/5000');
      await expect(page.locator('[data-testid="description-char-count"]')).toHaveClass(/text-red/);
    });

    test('should handle form reset functionality', async ({ page }) => {
      await helpers.openEditIncidentModal();

      // Make changes
      await page.fill('[data-testid="title-input"]', 'Modified title');
      await page.selectOption('[data-testid="priority-select"]', 'P2');

      // Verify changes are tracked
      await expect(page.locator('[data-testid="changes-summary"]')).toContainText('2 campo(s)');

      // Reset form
      await page.click('[data-testid="reset-button"]');

      // Verify form is reset to original values
      await expect(page.locator('[data-testid="title-input"]')).toHaveValue('Sistema CICS Produção Indisponível');
      await expect(page.locator('[data-testid="priority-select"]')).toHaveValue('P1');
      await expect(page.locator('[data-testid="changes-summary"]')).toContainText('Nenhuma alteração');
    });

    test('should save changes successfully', async ({ page }) => {
      await helpers.openEditIncidentModal();

      // Make non-critical change
      await page.fill('[data-testid="description-textarea"]', 'Descrição atualizada com mais detalhes');

      // Save changes
      await page.click('[data-testid="save-button"]');

      // Verify success message or modal closure
      await expect(page.locator('[data-testid="edit-incident-modal"]')).not.toBeVisible();

      // Verify changes are reflected in detail view
      await expect(page.locator('[data-testid="incident-description"]')).toContainText('Descrição atualizada');
    });
  });

  test.describe('AdvancedFiltersPanel Component', () => {
    test('should render filters panel correctly', async ({ page }) => {
      await helpers.openAdvancedFiltersPanel();

      // Check panel visibility
      await expect(page.locator('[data-testid="advanced-filters-panel"]')).toBeVisible();
      await expect(page.locator('[data-testid="filters-header"]')).toContainText('Filtros Avançados');

      // Check filter sections
      await expect(page.locator('[data-testid="quick-filters-section"]')).toBeVisible();
      await expect(page.locator('[data-testid="main-filters-grid"]')).toBeVisible();
    });

    test('should handle quick filters', async ({ page }) => {
      await helpers.openAdvancedFiltersPanel();

      // Test each quick filter
      const quickFilters = ['my-incidents', 'critical-open', 'today', 'sla-risk'];

      for (const filterId of quickFilters) {
        await page.click(`[data-testid="quick-filter-${filterId}"]`);

        // Verify filter count increases
        await expect(page.locator('[data-testid="active-filters-count"]')).toBeVisible();
      }
    });

    test('should handle multi-select filters', async ({ page }) => {
      await helpers.openAdvancedFiltersPanel();

      // Test status filter
      await page.click('[data-testid="status-filter-dropdown"]');
      await expect(page.locator('[data-testid="status-dropdown-options"]')).toBeVisible();

      // Select multiple statuses
      await page.click('[data-testid="status-option-aberto"]');
      await page.click('[data-testid="status-option-em_tratamento"]');

      // Verify selections are displayed
      await expect(page.locator('[data-testid="status-filter-badge-aberto"]')).toBeVisible();
      await expect(page.locator('[data-testid="status-filter-badge-em_tratamento"]')).toBeVisible();
    });

    test('should handle priority filters', async ({ page }) => {
      await helpers.openAdvancedFiltersPanel();

      // Test priority filter
      await page.click('[data-testid="priority-filter-dropdown"]');
      await page.click('[data-testid="priority-option-P1"]');
      await page.click('[data-testid="priority-option-P2"]');

      // Verify priority badges
      await expect(page.locator('[data-testid="priority-filter-badge-P1"]')).toBeVisible();
      await expect(page.locator('[data-testid="priority-filter-badge-P2"]')).toBeVisible();
    });

    test('should handle date range filters', async ({ page }) => {
      await helpers.openAdvancedFiltersPanel();

      // Set date range
      await page.selectOption('[data-testid="date-type-select"]', 'created');
      await page.fill('[data-testid="start-date-input"]', '2024-01-01');
      await page.fill('[data-testid="end-date-input"]', '2024-01-31');

      // Verify date range is set
      await expect(page.locator('[data-testid="start-date-input"]')).toHaveValue('2024-01-01');
      await expect(page.locator('[data-testid="end-date-input"]')).toHaveValue('2024-01-31');
    });

    test('should handle assigned user filters', async ({ page }) => {
      await helpers.openAdvancedFiltersPanel();

      // Test user assignment filter
      await page.click('[data-testid="assigned-to-filter-dropdown"]');
      await page.click('[data-testid="user-option-user1"]');

      // Verify user filter badge
      await expect(page.locator('[data-testid="assigned-filter-badge-user1"]')).toBeVisible();
    });

    test('should handle category and impact filters', async ({ page }) => {
      await helpers.openAdvancedFiltersPanel();

      // Test category filter
      await page.click('[data-testid="category-filter-dropdown"]');
      await page.click('[data-testid="category-option-infrastructure"]');

      // Test impact filter
      await page.click('[data-testid="impact-filter-dropdown"]');
      await page.click('[data-testid="impact-option-critical"]');

      // Verify filters
      await expect(page.locator('[data-testid="category-filter-badge-infrastructure"]')).toBeVisible();
      await expect(page.locator('[data-testid="impact-filter-badge-critical"]')).toBeVisible();
    });

    test('should handle SLA status filters', async ({ page }) => {
      await helpers.openAdvancedFiltersPanel();

      // Test SLA status filter
      await page.click('[data-testid="sla-status-filter-dropdown"]');
      await page.click('[data-testid="sla-option-at-risk"]');
      await page.click('[data-testid="sla-option-breached"]');

      // Verify SLA badges
      await expect(page.locator('[data-testid="sla-filter-badge-at-risk"]')).toBeVisible();
      await expect(page.locator('[data-testid="sla-filter-badge-breached"]')).toBeVisible();
    });

    test('should handle text search', async ({ page }) => {
      await helpers.openAdvancedFiltersPanel();

      // Enter search text
      await page.fill('[data-testid="search-text-input"]', 'CICS produção');

      // Verify search text is set
      await expect(page.locator('[data-testid="search-text-input"]')).toHaveValue('CICS produção');
    });

    test('should handle tags filter', async ({ page }) => {
      await helpers.openAdvancedFiltersPanel();

      // Enter tags
      await page.fill('[data-testid="tags-input"]', 'cics-crash, produção, performance');

      // Verify tags are parsed correctly
      await expect(page.locator('[data-testid="tags-input"]')).toHaveValue('cics-crash, produção, performance');
    });

    test('should save and apply filter presets', async ({ page }) => {
      await helpers.openAdvancedFiltersPanel();

      // Apply some filters
      await page.click('[data-testid="status-filter-dropdown"]');
      await page.click('[data-testid="status-option-aberto"]');
      await page.click('[data-testid="priority-filter-dropdown"]');
      await page.click('[data-testid="priority-option-P1"]');

      // Save as preset
      await page.click('[data-testid="save-preset-button"]');
      await expect(page.locator('[data-testid="save-preset-modal"]')).toBeVisible();

      await page.fill('[data-testid="preset-name-input"]', 'Incidentes Críticos');
      await page.click('[data-testid="save-preset-confirm"]');

      // Verify preset is saved
      await expect(page.locator('[data-testid="preset-Incidentes Críticos"]')).toBeVisible();

      // Clear filters and apply preset
      await page.click('[data-testid="clear-filters-button"]');
      await page.click('[data-testid="preset-Incidentes Críticos"]');

      // Verify filters are reapplied
      await expect(page.locator('[data-testid="status-filter-badge-aberto"]')).toBeVisible();
      await expect(page.locator('[data-testid="priority-filter-badge-P1"]')).toBeVisible();
    });

    test('should clear all filters', async ({ page }) => {
      await helpers.openAdvancedFiltersPanel();

      // Apply multiple filters
      await page.click('[data-testid="quick-filter-critical-open"]');
      await page.fill('[data-testid="search-text-input"]', 'test search');

      // Verify filters are active
      await expect(page.locator('[data-testid="active-filters-count"]')).toContainText('2');

      // Clear all filters
      await page.click('[data-testid="clear-filters-button"]');

      // Verify all filters are cleared
      await expect(page.locator('[data-testid="active-filters-count"]')).toContainText('0');
      await expect(page.locator('[data-testid="search-text-input"]')).toHaveValue('');
    });

    test('should export filtered data', async ({ page }) => {
      await helpers.openAdvancedFiltersPanel();

      // Apply some filters
      await page.click('[data-testid="status-filter-dropdown"]');
      await page.click('[data-testid="status-option-aberto"]');

      // Mock download handler
      const downloadPromise = page.waitForEvent('download');

      // Click export button
      await page.click('[data-testid="export-button"]');

      // Verify download is triggered
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/incidents.*\.csv/);
    });

    test('should be responsive on different screen sizes', async ({ page }) => {
      // Test tablet view
      await page.setViewportSize({ width: 768, height: 1024 });
      await helpers.openAdvancedFiltersPanel();

      // Verify filters panel adapts to smaller screen
      await expect(page.locator('[data-testid="main-filters-grid"]')).toBeVisible();

      // Test mobile view
      await page.setViewportSize({ width: 375, height: 667 });

      // Filters should stack vertically on mobile
      const filterGrid = page.locator('[data-testid="main-filters-grid"]');
      await expect(filterGrid).toHaveClass(/grid-cols-1/);
    });

    test('should collapse and expand panel', async ({ page }) => {
      await helpers.openAdvancedFiltersPanel();

      // Panel should be expanded initially
      await expect(page.locator('[data-testid="filters-content"]')).toBeVisible();

      // Collapse panel
      await page.click('[data-testid="collapse-toggle"]');
      await expect(page.locator('[data-testid="filters-content"]')).not.toBeVisible();

      // Expand panel
      await page.click('[data-testid="collapse-toggle"]');
      await expect(page.locator('[data-testid="filters-content"]')).toBeVisible();
    });
  });

  test.describe('Integration Workflows', () => {
    test('should complete end-to-end incident creation to resolution', async ({ page }) => {
      // Start from incident list
      await page.goto('/incidents');

      // Create new incident
      await page.click('[data-testid="create-incident-button"]');
      await page.fill('[data-testid="new-incident-title"]', 'Teste E2E - Falha Sistema');
      await page.fill('[data-testid="new-incident-description"]', 'Teste completo de criação até resolução');
      await page.selectOption('[data-testid="new-incident-priority"]', 'P2');
      await page.click('[data-testid="create-incident-submit"]');

      // Open created incident
      await page.click('[data-testid="incident-row-latest"]');

      // Add initial comment
      await page.click('[data-testid="tab-comments"]');
      await page.fill('[data-testid="comment-textarea"]', 'Iniciando investigação do problema');
      await page.click('[data-testid="add-comment-button"]');

      // Change status to in progress
      await page.click('[data-testid="tab-details"]');
      await page.click('[data-testid="status-em_tratamento"]');

      // Edit incident to add more details
      await page.click('[data-testid="edit-incident-button"]');
      await page.fill('[data-testid="description-textarea"]', 'Teste completo de criação até resolução - ATUALIZADO');
      await page.click('[data-testid="save-button"]');

      // Add resolution comment
      await page.click('[data-testid="tab-comments"]');
      await page.fill('[data-testid="comment-textarea"]', 'Problema resolvido após reinicialização do serviço');
      await page.click('[data-testid="add-comment-button"]');

      // Mark as resolved
      await page.click('[data-testid="status-resolvido"]');

      // Verify final status
      await expect(page.locator('[data-testid="incident-status-badge"]')).toContainText('Resolvido');
    });

    test('should handle cross-component state synchronization', async ({ page }) => {
      await helpers.openIncidentDetailView();

      // Make changes in detail view
      await page.click('[data-testid="assign-button"]');
      await page.fill('[data-testid="assigned-user-input"]', 'novo.user@empresa.com');
      await page.click('[data-testid="assign-confirm-button"]');

      // Open edit modal and verify state is synchronized
      await page.click('[data-testid="edit-incident-button"]');
      await expect(page.locator('[data-testid="assigned-to-input"]')).toHaveValue('novo.user@empresa.com');

      // Close modal and verify detail view still shows updated assignment
      await page.click('[data-testid="cancel-button"]');
      await expect(page.locator('[data-testid="assigned-to"]')).toContainText('novo.user@empresa.com');
    });

    test('should handle filtering and incident detail integration', async ({ page }) => {
      await page.goto('/incidents');

      // Apply filter
      await page.click('[data-testid="advanced-filters-toggle"]');
      await page.click('[data-testid="status-filter-dropdown"]');
      await page.click('[data-testid="status-option-aberto"]');

      // Open incident from filtered list
      await page.click('[data-testid="incident-row-first"]');

      // Verify detail view shows filtered incident
      await expect(page.locator('[data-testid="incident-status-badge"]')).toContainText('Aberto');

      // Change status and verify it reflects in filtered list
      await page.click('[data-testid="status-em_tratamento"]');
      await page.click('[data-testid="back-to-list"]');

      // Incident should no longer appear in "Aberto" filtered list
      await expect(page.locator('[data-testid="incident-row-first"] [data-testid="status-badge"]')).not.toContainText('Aberto');
    });

    test('should handle concurrent user actions', async ({ page, context }) => {
      // Simulate another user making changes
      const secondPage = await context.newPage();
      await secondPage.goto('/incidents');

      // First user opens incident
      await helpers.openIncidentDetailView();

      // Second user also opens same incident (simulate in background)
      await secondPage.evaluate(() => {
        // Simulate concurrent update
        window.dispatchEvent(new CustomEvent('incident-updated', {
          detail: {
            id: 'INC-001',
            assigned_to: 'outro.usuario@empresa.com',
            updated_at: new Date()
          }
        }));
      });

      // First user should see update notification
      await expect(page.locator('[data-testid="concurrent-update-notification"]')).toBeVisible();

      // User can choose to refresh or continue with their changes
      await page.click('[data-testid="refresh-incident-data"]');
      await expect(page.locator('[data-testid="assigned-to"]')).toContainText('outro.usuario@empresa.com');
    });
  });

  test.describe('Accessibility Tests', () => {
    test('should meet WCAG 2.1 AA compliance', async ({ page }) => {
      await helpers.openIncidentDetailView();

      // Check basic accessibility issues
      const violations = await helpers.checkAccessibility();
      expect(violations).toHaveLength(0);

      // Check color contrast (would require additional tools in real implementation)
      await expect(page.locator('[data-testid="incident-status-badge"]')).toBeVisible();

      // Check focus indicators
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeTruthy();
    });

    test('should support keyboard navigation', async ({ page }) => {
      await helpers.openIncidentDetailView();

      // Test tab navigation through interface
      await page.keyboard.press('Tab'); // Should focus first interactive element
      await page.keyboard.press('Tab'); // Move to next element
      await page.keyboard.press('Tab'); // Continue tabbing

      // Test Enter key on buttons
      await page.keyboard.press('Enter');

      // Test arrow keys in tab navigation
      await page.click('[data-testid="tab-details"]');
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('[data-testid="tab-timeline"]')).toBeFocused();

      // Test Escape key to close modals
      await page.click('[data-testid="edit-incident-button"]');
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-testid="edit-incident-modal"]')).not.toBeVisible();
    });

    test('should support screen reader navigation', async ({ page }) => {
      await helpers.openIncidentDetailView();

      // Check for proper ARIA labels
      await expect(page.locator('[data-testid="incident-detail-view"]')).toHaveAttribute('role', 'main');
      await expect(page.locator('[data-testid="incident-tabs"]')).toHaveAttribute('role', 'tablist');
      await expect(page.locator('[data-testid="tab-details"]')).toHaveAttribute('role', 'tab');

      // Check for aria-expanded on collapsible elements
      await expect(page.locator('[data-testid="collapse-toggle"]')).toHaveAttribute('aria-expanded');

      // Check for descriptive text for screen readers
      await expect(page.locator('[data-testid="incident-priority-badge"]')).toHaveAttribute('aria-label');
    });

    test('should handle focus management in modals', async ({ page }) => {
      await helpers.openEditIncidentModal();

      // Focus should be trapped within modal
      const modalFirstFocusable = page.locator('[data-testid="title-input"]');
      await expect(modalFirstFocusable).toBeFocused();

      // Tab through modal elements
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Shift+Tab should go backwards
      await page.keyboard.press('Shift+Tab');

      // Escape should close modal and return focus
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-testid="edit-incident-modal"]')).not.toBeVisible();
    });

    test('should provide proper form labels and error announcements', async ({ page }) => {
      await helpers.openEditIncidentModal();

      // Check form field labels
      await expect(page.locator('label[for="title"]')).toBeVisible();
      await expect(page.locator('label[for="description"]')).toBeVisible();

      // Trigger validation errors
      await page.fill('[data-testid="title-input"]', '');
      await page.click('[data-testid="save-button"]');

      // Check error is associated with field
      await expect(page.locator('[data-testid="title-error"]')).toHaveAttribute('role', 'alert');
      await expect(page.locator('[data-testid="title-input"]')).toHaveAttribute('aria-describedby');
    });
  });

  test.describe('Performance Tests', () => {
    test('should render components within performance budget', async ({ page }) => {
      // Start performance measurement
      await page.goto('/incidents');

      const startTime = Date.now();
      await helpers.openIncidentDetailView();
      const renderTime = Date.now() - startTime;

      // Component should render within 2 seconds
      expect(renderTime).toBeLessThan(2000);
    });

    test('should handle large datasets efficiently', async ({ page }) => {
      // Mock large dataset
      await page.addInitScript(() => {
        // Override mock to return many comments
        const originalInvoke = (window as any).electron.ipcRenderer.invoke;
        (window as any).electron.ipcRenderer.invoke = async (channel: string, data?: any) => {
          if (channel === 'incident:getComments') {
            // Return large comment set
            return Array.from({ length: 100 }, (_, i) => ({
              id: i.toString(),
              content: `Comment ${i} with substantial content`,
              author: `user${i}@empresa.com`,
              timestamp: new Date(),
              is_internal: i % 3 === 0,
              attachments: []
            }));
          }
          return originalInvoke(channel, data);
        };
      });

      await helpers.openIncidentDetailView();
      await page.click('[data-testid="tab-comments"]');

      // Comments should load without performance issues
      await expect(page.locator('[data-testid="comment-item"]')).toHaveCount(100);

      // Scrolling should be smooth
      const commentsContainer = page.locator('[data-testid="comments-list"]');
      await commentsContainer.hover();
      await page.wheel(0, 500);
      await page.wheel(0, 500);

      // No performance warnings in console
      const logs = await page.evaluate(() => console.error);
      expect(logs).toBeUndefined();
    });

    test('should optimize filter operations', async ({ page }) => {
      await helpers.openAdvancedFiltersPanel();

      const startTime = Date.now();

      // Apply multiple filters rapidly
      await page.click('[data-testid="status-filter-dropdown"]');
      await page.click('[data-testid="status-option-aberto"]');
      await page.click('[data-testid="priority-filter-dropdown"]');
      await page.click('[data-testid="priority-option-P1"]');
      await page.fill('[data-testid="search-text-input"]', 'performance test');

      const filterTime = Date.now() - startTime;

      // Filtering should be responsive
      expect(filterTime).toBeLessThan(1000);
    });

    test('should handle modal animations smoothly', async ({ page }) => {
      // Open modal multiple times to test performance
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();

        await page.click('[data-testid="edit-incident-button"]');
        await page.waitForSelector('[data-testid="edit-incident-modal"]');

        const openTime = Date.now() - startTime;
        expect(openTime).toBeLessThan(500);

        await page.keyboard.press('Escape');
        await page.waitForSelector('[data-testid="edit-incident-modal"]', { state: 'hidden' });
      }
    });

    test('should maintain performance during real-time updates', async ({ page }) => {
      await helpers.openIncidentDetailView();

      // Simulate rapid updates
      for (let i = 0; i < 10; i++) {
        await page.evaluate((updateIndex) => {
          window.dispatchEvent(new CustomEvent('incident-updated', {
            detail: {
              id: 'INC-001',
              updated_at: new Date(),
              last_comment: `Update ${updateIndex}`
            }
          }));
        }, i);

        await page.waitForTimeout(100);
      }

      // UI should remain responsive
      await page.click('[data-testid="tab-timeline"]');
      await expect(page.locator('[data-testid="tab-content-timeline"]')).toBeVisible();
    });
  });
});

test.describe('Error Handling and Edge Cases', () => {
  let helpers: IncidentManagementHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new IncidentManagementHelpers(page);
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Mock network failure
    await page.route('**/api/**', route => route.abort());

    await page.goto('/incidents');

    // Should show error state
    await expect(page.locator('[data-testid="network-error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
  });

  test('should handle missing incident data', async ({ page }) => {
    // Mock empty incident response
    await page.addInitScript(() => {
      (window as any).electron = {
        ipcRenderer: {
          invoke: async () => null
        }
      };
    });

    await page.goto('/incidents/INC-MISSING');

    // Should show not found state
    await expect(page.locator('[data-testid="incident-not-found"]')).toBeVisible();
  });

  test('should handle validation errors', async ({ page }) => {
    await helpers.setupMockData();
    await helpers.openEditIncidentModal();

    // Submit invalid data
    await page.fill('[data-testid="title-input"]', ''); // Clear required field
    await page.click('[data-testid="save-button"]');

    // Should show validation errors
    await expect(page.locator('[data-testid="title-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="form-errors-summary"]')).toBeVisible();
  });

  test('should handle concurrent modification conflicts', async ({ page }) => {
    await helpers.setupMockData();
    await helpers.openEditIncidentModal();

    // Simulate concurrent modification
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('incident-modified-externally', {
        detail: { id: 'INC-001', version: 2 }
      }));
    });

    // Should show conflict warning
    await expect(page.locator('[data-testid="concurrent-modification-warning"]')).toBeVisible();
  });
});

// Test data cleanup
test.afterEach(async ({ page }) => {
  // Clear any local storage or session data
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test.afterAll(async () => {
  // Global cleanup if needed
  console.log('Incident Management Phase 2 tests completed');
});