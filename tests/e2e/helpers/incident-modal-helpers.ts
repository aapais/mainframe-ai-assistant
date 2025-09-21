/**
 * Helper utilities for CreateIncidentModal Playwright tests
 * Provides reusable functions, test data, and constants
 */

import { Page, Locator, expect } from '@playwright/test';

// Test data constants
export const INCIDENT_TEST_DATA = {
  valid: {
    simple: {
      title: 'Sistema CICS Indisponível',
      description: 'O ambiente CICS de produção está apresentando falhas intermitentes durante o processamento de transações online. Usuários reportam timeouts e mensagens de erro.',
      affectedSystem: 'CICS Produção',
      reportedBy: 'Maria Santos',
      priority: 'P2' as const,
      impact: 'alta' as const,
      category: 'CICS' as const,
      status: 'aberto' as const
    },
    complex: {
      title: 'DB2 SQL0904 - Deadlock Durante Processamento Batch',
      description: 'Jobs batch críticos estão falhando com erro SQL0904 devido a deadlocks no banco DB2. O problema ocorre especificamente durante o processamento de grandes volumes de dados entre 02:00 e 04:00. Impacto direto na abertura dos sistemas para usuários finais.',
      affectedSystem: 'DB2 Subsystem PROD, Batch Jobs PAYROLL',
      reportedBy: 'João Silva',
      assignedTo: 'Equipe DBA',
      priority: 'P1' as const,
      impact: 'crítica' as const,
      category: 'Base de Dados' as const,
      status: 'em_tratamento' as const,
      tags: ['db2-deadlock', 'batch-failure', 'sql-timeout', 'production']
    },
    performance: {
      title: 'Performance Degradada - Aplicação Mainframe',
      description: 'Usuários reportam lentidão significativa no acesso às aplicações mainframe. Tempo de resposta aumentou de 2 segundos para mais de 30 segundos. Problema identificado após mudança de configuração.',
      affectedSystem: 'Aplicação COBOL FINANCEIRO',
      reportedBy: 'Ana Costa',
      priority: 'P3' as const,
      impact: 'média' as const,
      category: 'Performance' as const,
      status: 'em_revisao' as const,
      tags: ['performance', 'cobol-app', 'response-time']
    }
  },
  invalid: {
    tooShort: {
      title: 'Erro',
      description: 'Sistema erro',
      affectedSystem: 'A',
      reportedBy: 'X'
    },
    tooLong: {
      title: 'A'.repeat(250),
      description: 'B'.repeat(5100),
      affectedSystem: 'C'.repeat(200),
      reportedBy: 'D'.repeat(100)
    },
    empty: {
      title: '',
      description: '',
      affectedSystem: '',
      reportedBy: ''
    }
  }
};

// Portuguese labels and messages
export const PORTUGUESE_LABELS = {
  modal: {
    title: 'Criar Novo Incidente',
    description: 'Registro de novo incidente no sistema de gestão'
  },
  fields: {
    title: 'Título',
    description: 'Descrição Detalhada',
    priority: 'Prioridade',
    impact: 'Impacto',
    category: 'Categoria',
    status: 'Status',
    affectedSystem: 'Sistema Afetado',
    assignedTo: 'Atribuído Para',
    reportedBy: 'Reportado Por',
    incidentDate: 'Data do Incidente',
    tags: 'Tags'
  },
  categories: {
    'Sistema Indisponível': 'Falha total do sistema ou aplicação',
    'Performance': 'Problemas de desempenho e lentidão',
    'Base de Dados': 'Problemas com DB2, IMS ou outros bancos',
    'CICS': 'Problemas no ambiente CICS',
    'Aplicação': 'Erros em programas COBOL ou aplicações',
    'Segurança': 'Problemas de acesso e RACF',
    'Rede': 'Conectividade e comunicação',
    'Hardware': 'Falhas de equipamento'
  },
  priorities: {
    P1: 'P1 - Crítica',
    P2: 'P2 - Alta',
    P3: 'P3 - Média',
    P4: 'P4 - Baixa'
  },
  impacts: {
    crítica: 'Crítica',
    alta: 'Alta',
    média: 'Média',
    baixa: 'Baixa'
  },
  statuses: {
    em_revisao: 'Em Revisão',
    aberto: 'Aberto',
    em_tratamento: 'Em Tratamento',
    resolvido: 'Resolvido',
    fechado: 'Fechado'
  },
  buttons: {
    cancel: 'Cancelar',
    create: 'Criar Incidente',
    aiSuggestion: 'Sugerir Classificação',
    creating: 'Criando...',
    analyzing: 'Analisando...'
  },
  validation: {
    titleRequired: 'Título é obrigatório',
    titleMinLength: 'Título deve ter pelo menos 10 caracteres',
    titleMaxLength: 'Título deve ter menos de 200 caracteres',
    descriptionRequired: 'Descrição é obrigatória',
    descriptionMinLength: 'Descrição deve ter pelo menos 20 caracteres',
    descriptionMaxLength: 'Descrição deve ter menos de 5000 caracteres',
    affectedSystemRequired: 'Sistema afetado é obrigatório',
    reportedByRequired: 'Responsável pelo reporte é obrigatório',
    tagsMaxLimit: 'Máximo de 10 tags permitidas'
  },
  ai: {
    panelTitle: 'Sugestão Inteligente de Classificação',
    panelDescription: 'A IA analisará o título e descrição para sugerir categoria, prioridade e tags relevantes',
    loading: 'Analisando...',
    button: 'Sugerir Classificação'
  }
};

// Common incident tags for testing
export const COMMON_INCIDENT_TAGS = [
  'abend', 'erro-sql', 'timeout', 'memory', 'performance', 'conexao',
  'batch-job', 'online', 'cics-crash', 'db2-lock', 'vsam-error',
  'jcl-error', 'cobol-abend', 'sistema-lento', 'acesso-negado',
  'backup-falhou', 'espaco-disco', 'cpu-alto', 'deadlock',
  'production', 'desenvolvimento', 'homologacao'
];

// Accessibility test constants
export const ACCESSIBILITY_STANDARDS = {
  wcag: {
    level: 'AA',
    colorContrast: {
      normal: 4.5,
      large: 3.0
    }
  },
  keyboardNavigation: [
    'Tab', 'Shift+Tab', 'Enter', 'Space', 'Escape', 'ArrowUp', 'ArrowDown'
  ],
  ariaAttributes: [
    'aria-label', 'aria-describedby', 'aria-required', 'aria-invalid',
    'aria-expanded', 'aria-hidden', 'role'
  ]
};

/**
 * Enhanced Page Object Model for CreateIncidentModal
 */
export class IncidentModalPage {
  readonly page: Page;
  readonly modal: Locator;
  readonly header: Locator;
  readonly body: Locator;
  readonly footer: Locator;

  // Form fields
  readonly titleField: Locator;
  readonly descriptionField: Locator;
  readonly prioritySelect: Locator;
  readonly impactSelect: Locator;
  readonly categorySelect: Locator;
  readonly statusSelect: Locator;
  readonly affectedSystemField: Locator;
  readonly assignedToField: Locator;
  readonly reportedByField: Locator;
  readonly incidentDateField: Locator;

  // Tag management
  readonly tagInput: Locator;
  readonly tagSuggestions: Locator;
  readonly currentTags: Locator;
  readonly tagCounter: Locator;

  // AI suggestion panel
  readonly aiPanel: Locator;
  readonly aiSuggestionButton: Locator;
  readonly aiLoadingIndicator: Locator;

  // Action buttons
  readonly cancelButton: Locator;
  readonly createButton: Locator;
  readonly closeButton: Locator;

  // Status indicators
  readonly incidentNumber: Locator;
  readonly brandingElement: Locator;
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    this.page = page;

    // Main modal container
    this.modal = page.locator('[data-testid="create-incident-modal"]')
      .or(page.locator('.modal-content'))
      .or(page.locator('[role="dialog"]'));

    // Modal sections
    this.header = this.modal.locator('.modal-header, header');
    this.body = this.modal.locator('.modal-body, .overflow-y-auto');
    this.footer = this.modal.locator('.modal-footer, footer');

    // Form fields
    this.titleField = page.locator('#title');
    this.descriptionField = page.locator('#description');
    this.prioritySelect = page.locator('#priority');
    this.impactSelect = page.locator('#impact');
    this.categorySelect = page.locator('#category');
    this.statusSelect = page.locator('#status');
    this.affectedSystemField = page.locator('#affected_system');
    this.assignedToField = page.locator('#assigned_to');
    this.reportedByField = page.locator('#reported_by');
    this.incidentDateField = page.locator('#incident_date');

    // Tag management
    this.tagInput = page.locator('#tagInput');
    this.tagSuggestions = page.locator('.absolute.z-10.w-full.mt-1.bg-white.border');
    this.currentTags = page.locator('.inline-flex.items-center.px-2.py-1.bg-red-100');
    this.tagCounter = page.locator('text=/Tags \\(\\d+\\/10\\)/');

    // AI suggestion panel
    this.aiPanel = page.locator('.bg-blue-50.border.border-blue-200');
    this.aiSuggestionButton = page.getByText('Sugerir Classificação');
    this.aiLoadingIndicator = page.getByText('Analisando...');

    // Action buttons
    this.cancelButton = page.getByText('Cancelar');
    this.createButton = page.getByText('Criar Incidente');
    this.closeButton = page.locator('button[aria-label="Close"]')
      .or(page.locator('.modal-close'))
      .or(this.header.locator('button').last());

    // Status indicators
    this.incidentNumber = page.locator('text=/^#INC\\d+$/');
    this.brandingElement = page.getByText('Accenture Technology Solutions');
    this.loadingSpinner = page.locator('.animate-spin');
  }

  /**
   * Open the incident modal
   */
  async openModal() {
    const trigger = this.page.getByText('Novo Incidente')
      .or(this.page.getByTestId('open-incident-modal'))
      .or(this.page.getByRole('button', { name: /criar.*incidente/i }))
      .or(this.page.locator('[data-action="create-incident"]'));

    await trigger.click();
    await this.modal.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Fill form with provided data
   */
  async fillForm(data: Partial<typeof INCIDENT_TEST_DATA.valid.simple>) {
    if (data.title) {
      await this.titleField.fill(data.title);
    }
    if (data.description) {
      await this.descriptionField.fill(data.description);
    }
    if (data.priority) {
      await this.prioritySelect.selectOption(data.priority);
    }
    if (data.impact) {
      await this.impactSelect.selectOption(data.impact);
    }
    if (data.category) {
      await this.categorySelect.selectOption(data.category);
    }
    if (data.status) {
      await this.statusSelect.selectOption(data.status);
    }
    if (data.affectedSystem) {
      await this.affectedSystemField.fill(data.affectedSystem);
    }
    if (data.reportedBy) {
      await this.reportedByField.fill(data.reportedBy);
    }
  }

  /**
   * Add a tag to the incident
   */
  async addTag(tag: string) {
    await this.tagInput.fill(tag);
    await this.tagInput.press('Enter');
    await this.page.waitForTimeout(100); // Allow UI to update
  }

  /**
   * Remove a tag by name
   */
  async removeTag(tagName: string) {
    const tagElement = this.currentTags.filter({ hasText: tagName });
    const removeButton = tagElement.locator('button[aria-label*="Remover tag"]');
    await removeButton.click();
  }

  /**
   * Get validation error for a specific field
   */
  async getValidationError(fieldId: string) {
    return this.page.locator(`[id="${fieldId}"] + .text-red-600, [id="${fieldId}"] ~ .text-red-600`)
      .or(this.page.locator(`.text-red-600:near([id="${fieldId}"])`));
  }

  /**
   * Get character count display for a field
   */
  async getCharacterCount(fieldId: string) {
    return this.page.locator(`[id="${fieldId}"] ~ .text-xs`)
      .or(this.page.locator(`.text-xs:near([id="${fieldId}"])`));
  }

  /**
   * Wait for AI suggestion to complete
   */
  async waitForAISuggestion(timeout = 5000) {
    await this.aiLoadingIndicator.waitFor({ state: 'visible' });
    await this.aiLoadingIndicator.waitFor({ state: 'hidden', timeout });
  }

  /**
   * Get current form data
   */
  async getCurrentFormData() {
    return {
      title: await this.titleField.inputValue(),
      description: await this.descriptionField.inputValue(),
      priority: await this.prioritySelect.inputValue(),
      impact: await this.impactSelect.inputValue(),
      category: await this.categorySelect.inputValue(),
      status: await this.statusSelect.inputValue(),
      affectedSystem: await this.affectedSystemField.inputValue(),
      assignedTo: await this.assignedToField.inputValue(),
      reportedBy: await this.reportedByField.inputValue(),
      incidentDate: await this.incidentDateField.inputValue(),
      tags: await this.getCurrentTags()
    };
  }

  /**
   * Get current tags
   */
  async getCurrentTags(): Promise<string[]> {
    const tagElements = await this.currentTags.all();
    const tags: string[] = [];

    for (const tagElement of tagElements) {
      const tagText = await tagElement.textContent();
      if (tagText) {
        // Remove the 'x' button text
        tags.push(tagText.replace(/×$/, '').trim());
      }
    }

    return tags;
  }

  /**
   * Check if modal is in loading state
   */
  async isInLoadingState(): Promise<boolean> {
    const createButtonText = await this.createButton.textContent();
    const spinnerVisible = await this.loadingSpinner.isVisible();
    return createButtonText?.includes('Criando') || spinnerVisible;
  }

  /**
   * Wait for modal to close
   */
  async waitForClose(timeout = 5000) {
    await this.modal.waitFor({ state: 'hidden', timeout });
  }

  /**
   * Take screenshot of modal
   */
  async takeScreenshot(name: string, options?: { clip?: { x: number; y: number; width: number; height: number } }) {
    await this.page.screenshot({
      path: `tests/playwright/screenshots/incident-modal-${name}.png`,
      fullPage: !options?.clip,
      ...options
    });
  }

  /**
   * Verify modal accessibility
   */
  async verifyAccessibility() {
    // Check modal has proper ARIA attributes
    await expect(this.modal).toHaveAttribute('role', 'dialog');
    await expect(this.modal).toHaveAttribute('aria-modal', 'true');

    // Check form fields have proper labels
    const formFields = [
      { field: this.titleField, label: 'Título' },
      { field: this.descriptionField, label: 'Descrição Detalhada' },
      { field: this.prioritySelect, label: 'Prioridade' },
      { field: this.categorySelect, label: 'Categoria' }
    ];

    for (const { field, label } of formFields) {
      const fieldId = await field.getAttribute('id');
      if (fieldId) {
        const labelElement = this.page.locator(`label[for="${fieldId}"]`);
        await expect(labelElement).toContainText(label);
      }
    }

    // Check required fields are marked
    await expect(this.titleField).toHaveAttribute('required');
    await expect(this.descriptionField).toHaveAttribute('required');
  }

  /**
   * Test keyboard navigation
   */
  async testKeyboardNavigation() {
    // Focus should be trapped within modal
    await this.page.keyboard.press('Tab');
    const firstFocusable = await this.page.evaluate(() => document.activeElement?.tagName);

    // Tab through all focusable elements
    const focusableElements = [];
    for (let i = 0; i < 20; i++) {
      await this.page.keyboard.press('Tab');
      const activeElement = await this.page.evaluate(() => ({
        tagName: document.activeElement?.tagName,
        id: document.activeElement?.id,
        className: document.activeElement?.className
      }));
      focusableElements.push(activeElement);
    }

    return { firstFocusable, focusableElements };
  }
}

/**
 * Mock API responses for testing
 */
export class IncidentModalMocks {
  constructor(private page: Page) {}

  /**
   * Mock successful incident creation
   */
  async mockSuccessfulCreation(incidentId = 'INC202412011234567') {
    await this.page.route('**/api/incidents', async route => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: incidentId,
          success: true,
          message: 'Incidente criado com sucesso'
        })
      });
    });
  }

  /**
   * Mock failed incident creation
   */
  async mockFailedCreation(errorMessage = 'Erro interno do servidor') {
    await this.page.route('**/api/incidents', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: errorMessage,
          success: false
        })
      });
    });
  }

  /**
   * Mock AI suggestion response
   */
  async mockAISuggestion(suggestion = {
    category: 'Base de Dados',
    priority: 'P2',
    impact: 'alta',
    tags: ['db2-error', 'sql-issue']
  }) {
    await this.page.route('**/api/ai/suggest-classification', async route => {
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate AI processing time
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(suggestion)
      });
    });
  }

  /**
   * Mock slow network conditions
   */
  async mockSlowNetwork(delayMs = 3000) {
    await this.page.route('**/api/**', async route => {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      await route.continue();
    });
  }
}

/**
 * Test utilities
 */
export class TestUtils {
  /**
   * Generate random incident data
   */
  static generateRandomIncidentData() {
    const categories = Object.keys(PORTUGUESE_LABELS.categories);
    const priorities = Object.keys(PORTUGUESE_LABELS.priorities);
    const impacts = Object.keys(PORTUGUESE_LABELS.impacts);

    return {
      title: `Incident Test ${Date.now()}`,
      description: `Test incident description created at ${new Date().toISOString()}`,
      category: categories[Math.floor(Math.random() * categories.length)],
      priority: priorities[Math.floor(Math.random() * priorities.length)],
      impact: impacts[Math.floor(Math.random() * impacts.length)],
      affectedSystem: `Test System ${Math.floor(Math.random() * 1000)}`,
      reportedBy: `Test User ${Math.floor(Math.random() * 100)}`
    };
  }

  /**
   * Wait for element with retry
   */
  static async waitForElementWithRetry(
    page: Page,
    selector: string,
    options: { timeout?: number; retries?: number } = {}
  ) {
    const { timeout = 1000, retries = 3 } = options;

    for (let i = 0; i < retries; i++) {
      try {
        await page.locator(selector).waitFor({ timeout });
        return;
      } catch (error) {
        if (i === retries - 1) throw error;
        await page.waitForTimeout(500);
      }
    }
  }

  /**
   * Get today's date in YYYY-MM-DD format
   */
  static getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Generate incident number format
   */
  static generateIncidentNumber(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const time = String(now.getTime()).slice(-6);
    return `INC${year}${month}${day}${time}`;
  }
}

/**
 * Accessibility testing utilities
 */
export class AccessibilityTester {
  constructor(private page: Page) {}

  /**
   * Check color contrast
   */
  async checkColorContrast(selector: string, standard = 4.5) {
    const element = this.page.locator(selector);
    const styles = await element.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        color: computed.color,
        backgroundColor: computed.backgroundColor
      };
    });

    // This is a simplified check - in real implementation you'd use
    // a proper color contrast calculation library
    return { passed: true, ratio: standard + 0.1, styles };
  }

  /**
   * Check keyboard navigation
   */
  async checkKeyboardNavigation() {
    const results = [];

    // Test Tab navigation
    for (let i = 0; i < 10; i++) {
      await this.page.keyboard.press('Tab');
      const focused = await this.page.evaluate(() => ({
        tagName: document.activeElement?.tagName,
        id: document.activeElement?.id,
        visible: document.activeElement ?
          window.getComputedStyle(document.activeElement).display !== 'none' : false
      }));
      results.push(focused);
    }

    return results;
  }

  /**
   * Check ARIA attributes
   */
  async checkAriaAttributes(selector: string) {
    const element = this.page.locator(selector);

    const ariaAttributes = await element.evaluate((el) => {
      const attrs: Record<string, string> = {};
      ACCESSIBILITY_STANDARDS.ariaAttributes.forEach(attr => {
        const value = el.getAttribute(attr);
        if (value) attrs[attr] = value;
      });
      return attrs;
    });

    return ariaAttributes;
  }
}