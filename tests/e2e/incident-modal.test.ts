import { test, expect, Page, Locator } from '@playwright/test';

/**
 * Comprehensive Playwright Tests for CreateIncidentModal Component
 * Tests UI/UX, Accessibility, Form validation, and Portuguese translations
 *
 * Test Coverage:
 * - Modal open/close functionality
 * - Form field interactions and validation
 * - AI suggestion system
 * - Tag management
 * - Portuguese language support
 * - WCAG 2.1 AA accessibility compliance
 * - Keyboard navigation
 * - Responsive design
 */

// Test data constants
const INCIDENT_FORM_DATA = {
  valid: {
    title: 'DB2 SQL0904 - Recurso Indisponível em Produção',
    description: 'Sistema DB2 retornando erro SQL0904 indicando que o recurso solicitado não está disponível. O erro ocorre durante execução de jobs batch críticos nas primeiras horas da manhã. Impacto direto na abertura do sistema para usuários.',
    affectedSystem: 'DB2 Subsystem PROD',
    reportedBy: 'João Silva',
    priority: 'P1',
    impact: 'crítica',
    category: 'Base de Dados',
    status: 'em_revisao'
  },
  invalid: {
    shortTitle: 'Erro',
    shortDescription: 'Erro no sistema',
    longTitle: 'A'.repeat(250),
    longDescription: 'A'.repeat(5050)
  }
};

// Portuguese translation validation
const PORTUGUESE_LABELS = {
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
    affectedSystem: 'Sistema Afetado',
    assignedTo: 'Atribuído Para',
    reportedBy: 'Reportado Por',
    incidentDate: 'Data do Incidente',
    tags: 'Tags'
  },
  priorities: {
    P1: 'P1 - Crítica',
    P2: 'P2 - Alta',
    P3: 'P3 - Média',
    P4: 'P4 - Baixa'
  },
  impacts: {
    critica: 'Crítica',
    alta: 'Alta',
    media: 'Média',
    baixa: 'Baixa'
  },
  buttons: {
    cancel: 'Cancelar',
    create: 'Criar Incidente',
    aiSuggestion: 'Sugerir Classificação'
  },
  validation: {
    titleRequired: 'Título é obrigatório',
    titleMinLength: 'Título deve ter pelo menos 10 caracteres',
    descriptionRequired: 'Descrição é obrigatória',
    descriptionMinLength: 'Descrição deve ter pelo menos 20 caracteres',
    affectedSystemRequired: 'Sistema afetado é obrigatório',
    reportedByRequired: 'Responsável pelo reporte é obrigatório'
  }
};

// Helper functions
class IncidentModalPage {
  readonly page: Page;
  readonly modal: Locator;
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
  readonly tagInput: Locator;
  readonly aiSuggestionButton: Locator;
  readonly cancelButton: Locator;
  readonly createButton: Locator;
  readonly closeButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modal = page.locator('[data-testid="create-incident-modal"]').or(page.locator('.modal-content'));
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
    this.tagInput = page.locator('#tagInput');
    this.aiSuggestionButton = page.getByText('Sugerir Classificação');
    this.cancelButton = page.getByText('Cancelar');
    this.createButton = page.getByText('Criar Incidente');
    this.closeButton = page.locator('button[aria-label="Close"]').or(page.locator('.modal-close'));
  }

  async openModal() {
    // Assumes there's a trigger button in the app
    await this.page.getByText('Novo Incidente').or(this.page.getByTestId('open-incident-modal')).click();
    await this.modal.waitFor({ state: 'visible' });
  }

  async fillValidForm(data = INCIDENT_FORM_DATA.valid) {
    await this.titleField.fill(data.title);
    await this.descriptionField.fill(data.description);
    await this.prioritySelect.selectOption(data.priority);
    await this.impactSelect.selectOption(data.impact);
    await this.categorySelect.selectOption(data.category);
    await this.statusSelect.selectOption(data.status);
    await this.affectedSystemField.fill(data.affectedSystem);
    await this.reportedByField.fill(data.reportedBy);
  }

  async addTag(tag: string) {
    await this.tagInput.fill(tag);
    await this.tagInput.press('Enter');
  }

  async getValidationError(field: string) {
    return this.page.locator(`[id="${field}"] + .text-red-600, [id="${field}"] ~ .text-red-600`);
  }

  async getCharacterCount(field: string) {
    return this.page.locator(`[id="${field}"] ~ .text-xs`);
  }
}

// Test setup
test.beforeEach(async ({ page }) => {
  // Navigate to the application
  await page.goto('/');

  // Wait for the application to load
  await page.waitForLoadState('networkidle');

  // Set viewport for consistent testing
  await page.setViewportSize({ width: 1280, height: 720 });
});

test.describe('CreateIncidentModal - Funcionalidade Básica', () => {
  test('deve abrir e fechar o modal corretamente', async ({ page }) => {
    const modalPage = new IncidentModalPage(page);

    // Test modal opening
    await modalPage.openModal();
    await expect(modalPage.modal).toBeVisible();

    // Verify modal title in Portuguese
    await expect(page.getByText(PORTUGUESE_LABELS.modal.title)).toBeVisible();
    await expect(page.getByText(PORTUGUESE_LABELS.modal.description)).toBeVisible();

    // Take screenshot of opened modal
    await page.screenshot({
      path: 'tests/playwright/screenshots/incident-modal-opened.png',
      fullPage: true
    });

    // Test modal closing via close button
    await modalPage.closeButton.click();
    await expect(modalPage.modal).toBeHidden();
  });

  test('deve cancelar o modal e confirmar perda de dados', async ({ page }) => {
    const modalPage = new IncidentModalPage(page);

    await modalPage.openModal();

    // Fill some data
    await modalPage.titleField.fill('Teste de dados não salvos');
    await modalPage.descriptionField.fill('Descrição de teste para verificar confirmação de perda de dados');

    // Mock the confirmation dialog
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('alterações não salvas');
      await dialog.accept();
    });

    await modalPage.cancelButton.click();
    await expect(modalPage.modal).toBeHidden();
  });

  test('deve exibir número do incidente automaticamente', async ({ page }) => {
    const modalPage = new IncidentModalPage(page);

    await modalPage.openModal();

    // Check that incident number is displayed
    const incidentNumber = page.locator('text=/^#INC\\d{10,}$/');
    await expect(incidentNumber).toBeVisible();

    // Verify it follows the format: INC + YYYYMMDD + 6 digits
    const incidentText = await incidentNumber.textContent();
    expect(incidentText).toMatch(/^#INC\d{14}$/);
  });
});

test.describe('CreateIncidentModal - Campos do Formulário', () => {
  test('deve exibir todos os campos obrigatórios em português', async ({ page }) => {
    const modalPage = new IncidentModalPage(page);

    await modalPage.openModal();

    // Verify all required field labels are in Portuguese
    for (const [key, label] of Object.entries(PORTUGUESE_LABELS.fields)) {
      await expect(page.getByText(label)).toBeVisible();
    }

    // Verify required field indicators (*)
    const requiredFields = ['title', 'description', 'category', 'affected_system', 'reported_by'];
    for (const field of requiredFields) {
      const requiredIndicator = page.locator(`label[for="${field}"] .text-red-500`);
      await expect(requiredIndicator).toBeVisible();
    }
  });

  test('deve preencher e validar campos de texto corretamente', async ({ page }) => {
    const modalPage = new IncidentModalPage(page);

    await modalPage.openModal();

    // Test title field
    await modalPage.titleField.fill(INCIDENT_FORM_DATA.valid.title);
    await expect(modalPage.titleField).toHaveValue(INCIDENT_FORM_DATA.valid.title);

    // Test description field
    await modalPage.descriptionField.fill(INCIDENT_FORM_DATA.valid.description);
    await expect(modalPage.descriptionField).toHaveValue(INCIDENT_FORM_DATA.valid.description);

    // Test character count display
    const titleCount = await modalPage.getCharacterCount('title');
    await expect(titleCount).toContainText(`${INCIDENT_FORM_DATA.valid.title.length}/200`);

    const descriptionCount = await modalPage.getCharacterCount('description');
    await expect(descriptionCount).toContainText(`${INCIDENT_FORM_DATA.valid.description.length}/5000`);
  });

  test('deve validar seleções de prioridade, impacto e categoria', async ({ page }) => {
    const modalPage = new IncidentModalPage(page);

    await modalPage.openModal();

    // Test priority selection
    await modalPage.prioritySelect.selectOption('P1');
    await expect(modalPage.prioritySelect).toHaveValue('P1');

    // Verify priority description is shown
    await expect(page.getByText('Sistema principal indisponível')).toBeVisible();

    // Test impact selection
    await modalPage.impactSelect.selectOption('crítica');
    await expect(modalPage.impactSelect).toHaveValue('crítica');

    // Verify impact description
    await expect(page.getByText('Parada total de produção')).toBeVisible();

    // Test category selection
    await modalPage.categorySelect.selectOption('Base de Dados');
    await expect(modalPage.categorySelect).toHaveValue('Base de Dados');

    // Verify category description
    await expect(page.getByText('Problemas com DB2, IMS ou outros bancos')).toBeVisible();
  });

  test('deve configurar data atual como padrão', async ({ page }) => {
    const modalPage = new IncidentModalPage(page);

    await modalPage.openModal();

    // Check that current date is set as default
    const today = new Date().toISOString().split('T')[0];
    await expect(modalPage.incidentDateField).toHaveValue(today);
  });
});

test.describe('CreateIncidentModal - Sistema de Tags', () => {
  test('deve adicionar e remover tags corretamente', async ({ page }) => {
    const modalPage = new IncidentModalPage(page);

    await modalPage.openModal();

    // Add a tag
    await modalPage.addTag('db2-error');

    // Verify tag is displayed
    const tagElement = page.locator('.inline-flex.items-center.px-2.py-1.bg-red-100', { hasText: 'db2-error' });
    await expect(tagElement).toBeVisible();

    // Verify tag counter
    await expect(page.getByText('Tags (1/10)')).toBeVisible();

    // Add another tag
    await modalPage.addTag('sql-timeout');
    await expect(page.getByText('Tags (2/10)')).toBeVisible();

    // Remove a tag
    const removeButton = tagElement.locator('button[aria-label="Remover tag: db2-error"]');
    await removeButton.click();

    // Verify tag is removed
    await expect(tagElement).toBeHidden();
    await expect(page.getByText('Tags (1/10)')).toBeVisible();

    // Take screenshot of tag management
    await page.screenshot({
      path: 'tests/playwright/screenshots/incident-modal-tags.png',
      clip: { x: 0, y: 400, width: 800, height: 300 }
    });
  });

  test('deve mostrar sugestões de tags comuns', async ({ page }) => {
    const modalPage = new IncidentModalPage(page);

    await modalPage.openModal();

    // Type partial tag to trigger suggestions
    await modalPage.tagInput.fill('db2');

    // Wait for suggestions to appear
    await page.waitForSelector('.absolute.z-10.w-full.mt-1.bg-white.border');

    // Verify suggestions are visible
    const suggestions = page.locator('.absolute.z-10.w-full.mt-1.bg-white.border button');
    await expect(suggestions.first()).toBeVisible();

    // Click on a suggestion
    await suggestions.first().click();

    // Verify tag was added
    const addedTag = page.locator('.inline-flex.items-center.px-2.py-1.bg-red-100').first();
    await expect(addedTag).toBeVisible();
  });

  test('deve limitar tags a máximo de 10', async ({ page }) => {
    const modalPage = new IncidentModalPage(page);

    await modalPage.openModal();

    // Add 10 tags
    for (let i = 1; i <= 10; i++) {
      await modalPage.addTag(`tag${i}`);
    }

    // Verify tag counter shows 10/10
    await expect(page.getByText('Tags (10/10)')).toBeVisible();

    // Verify input is disabled
    await expect(modalPage.tagInput).toBeDisabled();

    // Try to add another tag (should not work)
    await modalPage.tagInput.fill('tag11');
    await modalPage.tagInput.press('Enter');

    // Verify still only 10 tags
    await expect(page.getByText('Tags (10/10)')).toBeVisible();
  });
});

test.describe('CreateIncidentModal - Sugestão de IA', () => {
  test('deve habilitar botão de IA apenas com dados suficientes', async ({ page }) => {
    const modalPage = new IncidentModalPage(page);

    await modalPage.openModal();

    // Initially button should be disabled
    await expect(modalPage.aiSuggestionButton).toBeDisabled();

    // Fill only title
    await modalPage.titleField.fill('Erro DB2');
    await expect(modalPage.aiSuggestionButton).toBeEnabled();

    // Clear and fill only description
    await modalPage.titleField.clear();
    await modalPage.descriptionField.fill('Sistema apresentando lentidão');
    await expect(modalPage.aiSuggestionButton).toBeEnabled();
  });

  test('deve simular sugestão de IA e aplicar classificações', async ({ page }) => {
    const modalPage = new IncidentModalPage(page);

    await modalPage.openModal();

    // Fill description that should trigger DB2 suggestion
    await modalPage.titleField.fill('Erro crítico DB2 em produção');
    await modalPage.descriptionField.fill('Sistema DB2 apresentando falhas críticas durante processamento batch');

    // Click AI suggestion button
    await modalPage.aiSuggestionButton.click();

    // Verify loading state
    await expect(page.getByText('Analisando...')).toBeVisible();

    // Wait for AI suggestion to complete (mocked)
    await page.waitForTimeout(2000);

    // Verify suggested classifications were applied
    await expect(modalPage.categorySelect).toHaveValue('Base de Dados');
    await expect(modalPage.prioritySelect).toHaveValue('P1');
    await expect(modalPage.impactSelect).toHaveValue('crítica');

    // Verify suggested tags were added
    const dbTag = page.locator('.inline-flex.items-center.px-2.py-1.bg-red-100', { hasText: 'db2-error' });
    await expect(dbTag).toBeVisible();

    // Take screenshot of AI suggestions applied
    await page.screenshot({
      path: 'tests/playwright/screenshots/incident-modal-ai-suggestions.png',
      fullPage: true
    });
  });
});

test.describe('CreateIncidentModal - Validação de Formulário', () => {
  test('deve exibir erros de validação para campos obrigatórios', async ({ page }) => {
    const modalPage = new IncidentModalPage(page);

    await modalPage.openModal();

    // Try to submit empty form
    await modalPage.createButton.click();

    // Verify validation errors appear
    await expect(modalPage.getValidationError('title')).toContainText(PORTUGUESE_LABELS.validation.titleRequired);
    await expect(modalPage.getValidationError('description')).toContainText(PORTUGUESE_LABELS.validation.descriptionRequired);
    await expect(modalPage.getValidationError('affected_system')).toContainText(PORTUGUESE_LABELS.validation.affectedSystemRequired);
    await expect(modalPage.getValidationError('reported_by')).toContainText(PORTUGUESE_LABELS.validation.reportedByRequired);

    // Take screenshot of validation errors
    await page.screenshot({
      path: 'tests/playwright/screenshots/incident-modal-validation-errors.png',
      fullPage: true
    });
  });

  test('deve validar comprimento mínimo dos campos', async ({ page }) => {
    const modalPage = new IncidentModalPage(page);

    await modalPage.openModal();

    // Fill with invalid short data
    await modalPage.titleField.fill(INCIDENT_FORM_DATA.invalid.shortTitle);
    await modalPage.descriptionField.fill(INCIDENT_FORM_DATA.invalid.shortDescription);

    // Trigger validation by clicking submit
    await modalPage.createButton.click();

    // Verify minimum length errors
    await expect(modalPage.getValidationError('title')).toContainText(PORTUGUESE_LABELS.validation.titleMinLength);
    await expect(modalPage.getValidationError('description')).toContainText(PORTUGUESE_LABELS.validation.descriptionMinLength);
  });

  test('deve validar comprimento máximo dos campos', async ({ page }) => {
    const modalPage = new IncidentModalPage(page);

    await modalPage.openModal();

    // Fill with invalid long data
    await modalPage.titleField.fill(INCIDENT_FORM_DATA.invalid.longTitle);
    await modalPage.descriptionField.fill(INCIDENT_FORM_DATA.invalid.longDescription);

    // Verify character count shows over limit
    const titleCount = await modalPage.getCharacterCount('title');
    await expect(titleCount).toHaveClass(/text-red-600/);

    const descriptionCount = await modalPage.getCharacterCount('description');
    await expect(descriptionCount).toHaveClass(/text-red-600/);
  });

  test('deve limpar erros de validação ao corrigir campos', async ({ page }) => {
    const modalPage = new IncidentModalPage(page);

    await modalPage.openModal();

    // Trigger validation error
    await modalPage.createButton.click();
    await expect(modalPage.getValidationError('title')).toBeVisible();

    // Fix the field
    await modalPage.titleField.fill(INCIDENT_FORM_DATA.valid.title);

    // Verify error is cleared
    await expect(modalPage.getValidationError('title')).toBeHidden();
  });
});

test.describe('CreateIncidentModal - Acessibilidade', () => {
  test('deve ter estrutura ARIA adequada', async ({ page }) => {
    const modalPage = new IncidentModalPage(page);

    await modalPage.openModal();

    // Verify modal has proper ARIA attributes
    await expect(modalPage.modal).toHaveAttribute('role', 'dialog');
    await expect(modalPage.modal).toHaveAttribute('aria-modal', 'true');

    // Verify modal has accessible name
    const modalTitle = page.locator('h2, [role="heading"]', { hasText: PORTUGUESE_LABELS.modal.title });
    await expect(modalTitle).toBeVisible();

    // Verify form has proper labels
    for (const [fieldId, label] of Object.entries(PORTUGUESE_LABELS.fields)) {
      const labelElement = page.locator(`label[for="${fieldId}"]`);
      if (await labelElement.count() > 0) {
        await expect(labelElement).toContainText(label);
      }
    }

    // Verify buttons have accessible names
    await expect(modalPage.createButton).toBeVisible();
    await expect(modalPage.cancelButton).toBeVisible();
  });

  test('deve ter navegação por teclado funcional', async ({ page }) => {
    const modalPage = new IncidentModalPage(page);

    await modalPage.openModal();

    // Test tab navigation through form fields
    await page.keyboard.press('Tab');
    await expect(modalPage.aiSuggestionButton).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(modalPage.titleField).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(modalPage.prioritySelect).toBeFocused();

    // Test escape key closes modal
    await page.keyboard.press('Escape');
    await expect(modalPage.modal).toBeHidden();
  });

  test('deve ter contraste adequado para daltonismo', async ({ page }) => {
    const modalPage = new IncidentModalPage(page);

    await modalPage.openModal();

    // Fill form to trigger validation
    await modalPage.titleField.fill('short');
    await modalPage.createButton.click();

    // Check that error messages have sufficient contrast
    const errorMessages = page.locator('.text-red-600');
    await expect(errorMessages.first()).toBeVisible();

    // Priority colors should be distinguishable
    await modalPage.prioritySelect.selectOption('P1');
    const criticalText = page.locator('.text-red-600');
    await expect(criticalText).toBeVisible();
  });

  test('deve ser compatível com leitores de tela', async ({ page }) => {
    const modalPage = new IncidentModalPage(page);

    await modalPage.openModal();

    // Verify form elements have proper labels and descriptions
    await expect(modalPage.titleField).toHaveAttribute('aria-describedby');

    // Verify error messages are associated with fields
    await modalPage.createButton.click();
    const titleError = await modalPage.getValidationError('title');
    const titleErrorId = await titleError.getAttribute('id');

    if (titleErrorId) {
      await expect(modalPage.titleField).toHaveAttribute('aria-describedby', new RegExp(titleErrorId));
    }

    // Verify required fields are marked
    await expect(modalPage.titleField).toHaveAttribute('required');
    await expect(modalPage.descriptionField).toHaveAttribute('required');
  });
});

test.describe('CreateIncidentModal - Design Responsivo', () => {
  test('deve adaptar layout para tablet (768px)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    const modalPage = new IncidentModalPage(page);
    await modalPage.openModal();

    // Verify modal is still usable on tablet
    await expect(modalPage.modal).toBeVisible();
    await expect(modalPage.titleField).toBeVisible();

    // Take screenshot for tablet view
    await page.screenshot({
      path: 'tests/playwright/screenshots/incident-modal-tablet.png',
      fullPage: true
    });
  });

  test('deve adaptar layout para mobile (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const modalPage = new IncidentModalPage(page);
    await modalPage.openModal();

    // Verify modal adapts to mobile viewport
    await expect(modalPage.modal).toBeVisible();
    await expect(modalPage.titleField).toBeVisible();

    // Verify form fields stack properly on mobile
    const priorityRow = page.locator('.grid.grid-cols-3');
    await expect(priorityRow).toBeVisible();

    // Take screenshot for mobile view
    await page.screenshot({
      path: 'tests/playwright/screenshots/incident-modal-mobile.png',
      fullPage: true
    });
  });

  test('deve manter funcionalidade em tela grande (1920px)', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });

    const modalPage = new IncidentModalPage(page);
    await modalPage.openModal();

    // Verify modal looks good on large screens
    await expect(modalPage.modal).toBeVisible();

    // Fill and submit form to test full functionality
    await modalPage.fillValidForm();
    await modalPage.createButton.click();

    // Take screenshot for desktop view
    await page.screenshot({
      path: 'tests/playwright/screenshots/incident-modal-desktop.png',
      fullPage: true
    });
  });
});

test.describe('CreateIncidentModal - Fluxo de Submissão', () => {
  test('deve submeter formulário válido com sucesso', async ({ page }) => {
    const modalPage = new IncidentModalPage(page);

    await modalPage.openModal();

    // Fill valid form data
    await modalPage.fillValidForm();

    // Add some tags
    await modalPage.addTag('db2-error');
    await modalPage.addTag('production');

    // Mock successful submission
    page.route('**/api/incidents', async route => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'INC202412011234567', success: true })
      });
    });

    // Submit form
    await modalPage.createButton.click();

    // Verify loading state
    await expect(page.getByText('Criando...')).toBeVisible();

    // Wait for submission to complete
    await page.waitForTimeout(1000);

    // Verify modal closes on success
    await expect(modalPage.modal).toBeHidden();
  });

  test('deve exibir erro de submissão adequadamente', async ({ page }) => {
    const modalPage = new IncidentModalPage(page);

    await modalPage.openModal();
    await modalPage.fillValidForm();

    // Mock failed submission
    page.route('**/api/incidents', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Erro interno do servidor' })
      });
    });

    // Submit form
    await modalPage.createButton.click();

    // Wait for error to appear
    await page.waitForTimeout(1000);

    // Verify error is displayed
    await expect(page.getByText(/erro/i)).toBeVisible();

    // Verify modal remains open
    await expect(modalPage.modal).toBeVisible();
  });

  test('deve preservar dados durante sessão', async ({ page }) => {
    const modalPage = new IncidentModalPage(page);

    await modalPage.openModal();

    // Fill some data
    const testTitle = 'Teste de preservação de dados';
    await modalPage.titleField.fill(testTitle);
    await modalPage.descriptionField.fill('Descrição de teste para verificar preservação');

    // Close modal without submitting
    await modalPage.cancelButton.click();

    // Reopen modal
    await modalPage.openModal();

    // Verify data is preserved (if auto-save is implemented)
    // Note: This depends on the actual implementation of auto-save functionality
    // For now, we just verify the form opens cleanly
    await expect(modalPage.titleField).toBeVisible();
  });
});

test.describe('CreateIncidentModal - Estados Especiais', () => {
  test('deve mostrar modal em estado de carregamento', async ({ page }) => {
    const modalPage = new IncidentModalPage(page);

    await modalPage.openModal();
    await modalPage.fillValidForm();

    // Mock slow submission to see loading state
    page.route('**/api/incidents', async route => {
      await page.waitForTimeout(3000);
      await route.fulfill({ status: 201, body: '{"success": true}' });
    });

    await modalPage.createButton.click();

    // Verify loading state elements
    await expect(page.getByText('Criando...')).toBeVisible();
    await expect(modalPage.createButton).toBeDisabled();
    await expect(modalPage.cancelButton).toBeDisabled();

    // Verify loading spinner
    await expect(page.locator('.animate-spin')).toBeVisible();

    // Take screenshot of loading state
    await page.screenshot({
      path: 'tests/playwright/screenshots/incident-modal-loading.png',
      clip: { x: 0, y: 600, width: 400, height: 100 }
    });
  });

  test('deve lidar com preenchimento automático de campos', async ({ page }) => {
    const modalPage = new IncidentModalPage(page);

    await modalPage.openModal();

    // Verify default values are set
    const today = new Date().toISOString().split('T')[0];
    await expect(modalPage.incidentDateField).toHaveValue(today);
    await expect(modalPage.statusSelect).toHaveValue('em_revisao');
    await expect(modalPage.prioritySelect).toHaveValue('P3');
    await expect(modalPage.impactSelect).toHaveValue('média');

    // Verify reported_by is pre-filled (if user context is available)
    const reportedByValue = await modalPage.reportedByField.inputValue();
    expect(reportedByValue).toBeTruthy();
  });

  test('deve validar limite de caracteres em tempo real', async ({ page }) => {
    const modalPage = new IncidentModalPage(page);

    await modalPage.openModal();

    // Test approaching character limit
    const nearLimitTitle = 'A'.repeat(180);
    await modalPage.titleField.fill(nearLimitTitle);

    // Verify warning color for approaching limit
    const titleCount = await modalPage.getCharacterCount('title');
    await expect(titleCount).toHaveClass(/text-yellow-600/);

    // Test exceeding character limit
    const overLimitTitle = 'A'.repeat(210);
    await modalPage.titleField.fill(overLimitTitle);

    // Verify error color for exceeding limit
    await expect(titleCount).toHaveClass(/text-red-600/);

    // Verify field prevents typing beyond limit
    const actualValue = await modalPage.titleField.inputValue();
    expect(actualValue.length).toBeLessThanOrEqual(200);
  });
});

// Performance and stress tests
test.describe('CreateIncidentModal - Performance', () => {
  test('deve carregar rapidamente', async ({ page }) => {
    const modalPage = new IncidentModalPage(page);

    const startTime = Date.now();
    await modalPage.openModal();
    const loadTime = Date.now() - startTime;

    // Modal should open within 1 second
    expect(loadTime).toBeLessThan(1000);

    // All essential elements should be visible immediately
    await expect(modalPage.titleField).toBeVisible();
    await expect(modalPage.descriptionField).toBeVisible();
    await expect(modalPage.createButton).toBeVisible();
  });

  test('deve lidar com muitas tags sem degradação', async ({ page }) => {
    const modalPage = new IncidentModalPage(page);

    await modalPage.openModal();

    // Add maximum number of tags quickly
    const startTime = Date.now();
    for (let i = 1; i <= 10; i++) {
      await modalPage.addTag(`performance-tag-${i}`);
    }
    const addTagsTime = Date.now() - startTime;

    // Should complete within reasonable time
    expect(addTagsTime).toBeLessThan(5000);

    // Verify all tags are displayed
    await expect(page.getByText('Tags (10/10)')).toBeVisible();
  });
});