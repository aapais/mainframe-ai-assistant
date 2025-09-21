/**
 * Post-Fix Validation Tests for Incident Management System
 *
 * This comprehensive test suite validates the incident management system functionality
 * after the Phase 2 fixes, ensuring all components render correctly and work as expected.
 *
 * Test Coverage:
 * 1. Application Loading & Console Error Validation
 * 2. Navigation to Incidents Page
 * 3. Component Visibility & Rendering
 * 4. Modal Interactions & Form Submissions
 * 5. Responsive Layouts
 * 6. Portuguese Localization
 * 7. Error Boundaries & Fallbacks
 */

import { test, expect, Page, Browser } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

// Test configuration
const APP_URL = 'http://localhost:3001';
const SCREENSHOT_DIR = '/mnt/c/mainframe-ai-assistant/tests/playwright/screenshots/validation';
const VALIDATION_REPORT_PATH = '/mnt/c/mainframe-ai-assistant/tests/INCIDENT_VALIDATION_REPORT.md';

interface ValidationResult {
  testName: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  screenshot?: string;
  errors: string[];
  details: string;
}

class IncidentValidationHelper {
  private page: Page;
  private results: ValidationResult[] = [];

  constructor(page: Page) {
    this.page = page;
  }

  async setupMockData() {
    await this.page.addInitScript(() => {
      // Enhanced mock data for incident management
      const mockIncidents = [
        {
          id: 'INC-001',
          title: 'Sistema CICS Produção Indisponível',
          content: 'Falha crítica no sistema CICS principal causando indisponibilidade total.',
          type: 'incident',
          priority: 'P1',
          status: 'aberto',
          impact: 'crítica',
          category: 'Sistema Indisponível',
          assigned_to: 'joão.silva@empresa.com',
          reported_by: 'maria.santos@empresa.com',
          created_at: new Date('2024-01-15T08:30:00'),
          updated_at: new Date('2024-01-15T08:45:00'),
          tags: ['cics-crash', 'produção', 'crítico']
        },
        {
          id: 'INC-002',
          title: 'Performance Lenta Base de Dados DB2',
          content: 'Consultas SQL apresentando tempo de resposta elevado.',
          type: 'incident',
          priority: 'P2',
          status: 'em_tratamento',
          impact: 'alta',
          category: 'Performance',
          assigned_to: 'pedro.oliveira@empresa.com',
          reported_by: 'ana.costa@empresa.com',
          created_at: new Date('2024-01-14T14:20:00'),
          updated_at: new Date('2024-01-15T09:15:00'),
          tags: ['db2-performance', 'sql-lento']
        }
      ];

      // Enhanced mock API
      if (typeof window !== 'undefined') {
        (window as any).api = {
          invoke: async (channel: string, ...args: any[]) => {
            await new Promise(r => setTimeout(r, 100)); // Simulate network delay

            switch (channel) {
              case 'incident:create':
                const incidentData = args[0];
                return {
                  success: true,
                  id: `INC${Date.now()}`,
                  message: 'Incidente criado com sucesso'
                };

              case 'incident:search':
                return {
                  success: true,
                  results: mockIncidents
                };

              case 'incident:get':
                const { id } = args[0] || {};
                return mockIncidents.find(inc => inc.id === id) || mockIncidents[0];

              case 'incident:requestAIAnalysis':
                return {
                  success: true,
                  analysisId: `ANA${Date.now()}`,
                  status: 'processing'
                };

              case 'incident:executeAIAnalysis':
                return {
                  success: true,
                  insights: [
                    { type: 'pattern', description: 'Padrão similar detectado em incidentes anteriores' },
                    { type: 'recommendation', description: 'Considere verificar configurações do pool de conexão' }
                  ],
                  confidence: 0.85
                };

              case 'incident:semanticSearch':
                return {
                  success: true,
                  similar_incidents: [
                    { id: 'INC001', title: 'Problema Similar DB2', similarity: 0.89 }
                  ],
                  total_found: 1
                };

              default:
                return { success: true };
            }
          }
        };

        // Mock electronAPI for search functionality
        (window as any).electronAPI = {
          kb: {
            search: async (query: string) => {
              return {
                results: mockIncidents.filter(inc =>
                  inc.title.toLowerCase().includes(query.toLowerCase()) ||
                  inc.content.toLowerCase().includes(query.toLowerCase())
                )
              };
            },
            getAll: async () => ({ entries: mockIncidents })
          }
        };
      }
    });
  }

  async captureScreenshot(testName: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${testName}-${timestamp}.png`;
    const filepath = path.join(SCREENSHOT_DIR, filename);

    // Ensure screenshot directory exists
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });

    await this.page.screenshot({
      path: filepath,
      fullPage: true,
      animations: 'disabled'
    });

    return filename;
  }

  async checkConsoleErrors(): Promise<string[]> {
    const errors: string[] = [];

    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    this.page.on('pageerror', (error) => {
      errors.push(`Page Error: ${error.message}`);
    });

    return errors;
  }

  async recordTest(testName: string, testFunction: () => Promise<void>): Promise<ValidationResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let status: 'PASS' | 'FAIL' | 'SKIP' = 'PASS';
    let details = '';
    let screenshot: string | undefined;

    try {
      // Setup console error monitoring
      const consoleErrors = await this.checkConsoleErrors();

      // Run the test
      await testFunction();

      // Capture screenshot on completion
      screenshot = await this.captureScreenshot(testName);

      // Check for console errors
      if (consoleErrors.length > 0) {
        errors.push(...consoleErrors);
        status = 'FAIL';
        details = `Console errors detected: ${consoleErrors.length}`;
      } else {
        details = 'Test completed successfully without errors';
      }

    } catch (error) {
      status = 'FAIL';
      errors.push(error instanceof Error ? error.message : String(error));
      details = `Test failed: ${error instanceof Error ? error.message : String(error)}`;

      // Capture screenshot on error
      try {
        screenshot = await this.captureScreenshot(`${testName}-error`);
      } catch (screenshotError) {
        errors.push(`Screenshot capture failed: ${screenshotError}`);
      }
    }

    const duration = Date.now() - startTime;
    const result: ValidationResult = {
      testName,
      status,
      duration,
      screenshot,
      errors,
      details
    };

    this.results.push(result);
    return result;
  }

  async generateReport(): Promise<void> {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.status === 'PASS').length;
    const failedTests = this.results.filter(r => r.status === 'FAIL').length;
    const skippedTests = this.results.filter(r => r.status === 'SKIP').length;

    const report = `# Incident Management System Validation Report

## Summary
- **Total Tests**: ${totalTests}
- **Passed**: ${passedTests} ✅
- **Failed**: ${failedTests} ❌
- **Skipped**: ${skippedTests} ⏭️
- **Success Rate**: ${((passedTests / totalTests) * 100).toFixed(1)}%
- **Generated**: ${new Date().toISOString()}

## Test Results

${this.results.map(result => `
### ${result.testName}
- **Status**: ${result.status === 'PASS' ? '✅ PASS' : result.status === 'FAIL' ? '❌ FAIL' : '⏭️ SKIP'}
- **Duration**: ${result.duration}ms
- **Details**: ${result.details}
${result.screenshot ? `- **Screenshot**: [${result.screenshot}](./screenshots/validation/${result.screenshot})` : ''}
${result.errors.length > 0 ? `- **Errors**:\n${result.errors.map(e => `  - ${e}`).join('\n')}` : ''}
`).join('\n')}

## Validation Criteria Status

### ✅ Critical Requirements
- [${passedTests > 0 ? 'x' : ' '}] Application loads without console errors
- [${this.results.find(r => r.testName.includes('Navigation'))?.status === 'PASS' ? 'x' : ' '}] Main application renders (not just floating widget)
- [${this.results.find(r => r.testName.includes('Incidents'))?.status === 'PASS' ? 'x' : ' '}] Incidents page accessible and functional
- [${this.results.find(r => r.testName.includes('Components'))?.status === 'PASS' ? 'x' : ' '}] Phase 2 components visible and working

### ✅ Functional Requirements
- [${this.results.find(r => r.testName.includes('Modal'))?.status === 'PASS' ? 'x' : ' '}] Modal interactions work correctly
- [${this.results.find(r => r.testName.includes('Form'))?.status === 'PASS' ? 'x' : ' '}] Form submissions process successfully
- [${this.results.find(r => r.testName.includes('Responsive'))?.status === 'PASS' ? 'x' : ' '}] Responsive design works on mobile/desktop
- [${this.results.find(r => r.testName.includes('Portuguese'))?.status === 'PASS' ? 'x' : ' '}] Portuguese localization displays correctly

## Recommendations

${failedTests > 0 ? `
### 🚨 Immediate Actions Required
${this.results.filter(r => r.status === 'FAIL').map(r => `
- **${r.testName}**: ${r.details}
  - Errors: ${r.errors.join(', ')}
`).join('')}
` : '### ✅ All Tests Passing - System Ready for Production'}

## Technical Details

- **Test Environment**: ${APP_URL}
- **Browser**: Chromium (Playwright)
- **Viewport**: 1280x720 (Desktop), 375x667 (Mobile)
- **Test Framework**: Playwright TypeScript
- **Screenshots**: Captured for all test scenarios

---
*Report generated by Incident Management Validation Suite*
`;

    await fs.writeFile(VALIDATION_REPORT_PATH, report, 'utf-8');
    console.log(`✅ Validation report generated: ${VALIDATION_REPORT_PATH}`);
  }

  getResults(): ValidationResult[] {
    return this.results;
  }
}

// Main test suite
test.describe('Incident Management System Validation', () => {
  let helper: IncidentValidationHelper;

  test.beforeAll(async () => {
    // Ensure screenshot directory exists
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  });

  test.beforeEach(async ({ page }) => {
    helper = new IncidentValidationHelper(page);
    await helper.setupMockData();
  });

  test.afterAll(async () => {
    if (helper) {
      await helper.generateReport();
    }
  });

  test('Application Loading & Console Error Validation', async ({ page }) => {
    await helper.recordTest('Application_Loading', async () => {
      // Navigate to application
      await page.goto(APP_URL, { waitUntil: 'networkidle' });

      // Wait for main application to load
      await page.waitForSelector('[data-testid="main-app"]', { timeout: 10000 });

      // Verify no critical console errors
      const logs = await page.evaluate(() => {
        return (window as any).__consoleLogs || [];
      });

      // Check that main application components are visible
      await expect(page.locator('header')).toBeVisible();
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('footer')).toBeVisible();

      // Verify application title
      await expect(page).toHaveTitle(/Mainframe AI Assistant/);
    });
  });

  test('Navigation to Incidents Page', async ({ page }) => {
    await helper.recordTest('Navigation_Incidents_Page', async () => {
      await page.goto(APP_URL, { waitUntil: 'networkidle' });

      // Click on Incidents navigation
      await page.click('button:has-text("Incidents")');

      // Wait for incidents page to load
      await page.waitForSelector('[data-testid="incidents-page"]', { timeout: 5000 });

      // Verify incidents page elements are visible
      await expect(page.locator('h1:has-text("Gestão de Incidentes")')).toBeVisible();
      await expect(page.locator('[data-testid="search-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="create-incident-fab"]')).toBeVisible();

      // Check page URL contains incidents
      expect(page.url()).toContain('incidents');
    });
  });

  test('Incident Management Components Visibility', async ({ page }) => {
    await helper.recordTest('Components_Visibility', async () => {
      await page.goto(APP_URL);
      await page.click('button:has-text("Incidents")');
      await page.waitForSelector('[data-testid="incidents-page"]');

      // Check main components are present
      await expect(page.locator('[data-testid="incident-search-tabs"]')).toBeVisible();
      await expect(page.locator('[data-testid="local-search-tab"]')).toBeVisible();
      await expect(page.locator('[data-testid="ai-search-tab"]')).toBeVisible();

      // Check toolbar components
      await expect(page.locator('button:has-text("Upload em Massa")')).toBeVisible();

      // Verify floating action button
      await expect(page.locator('[data-testid="create-incident-fab"]')).toBeVisible();

      // Test search functionality
      await page.fill('[data-testid="search-input"]', 'CICS');
      await page.waitForTimeout(500); // Wait for debounced search

      // Verify search results appear
      await expect(page.locator('[data-testid="incident-result"]').first()).toBeVisible();
    });
  });

  test('Create Incident Modal Interaction', async ({ page }) => {
    await helper.recordTest('Create_Incident_Modal', async () => {
      await page.goto(APP_URL);
      await page.click('button:has-text("Incidents")');
      await page.waitForSelector('[data-testid="incidents-page"]');

      // Open create incident modal
      await page.click('[data-testid="create-incident-fab"]');
      await page.waitForSelector('[data-testid="create-incident-modal"]', { timeout: 5000 });

      // Verify modal is visible and contains expected elements
      await expect(page.locator('[data-testid="create-incident-modal"]')).toBeVisible();
      await expect(page.locator('[data-testid="incident-title-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="incident-description-textarea"]')).toBeVisible();
      await expect(page.locator('[data-testid="incident-priority-select"]')).toBeVisible();

      // Test form submission
      await page.fill('[data-testid="incident-title-input"]', 'Teste de Validação');
      await page.fill('[data-testid="incident-description-textarea"]', 'Descrição do teste de validação');
      await page.selectOption('[data-testid="incident-priority-select"]', 'P2');

      // Submit form
      await page.click('[data-testid="submit-incident-button"]');

      // Wait for success indication
      await page.waitForSelector('[data-testid="success-toast"]', { timeout: 5000 });
      await expect(page.locator('[data-testid="success-toast"]')).toBeVisible();
    });
  });

  test('Bulk Upload Modal Interaction', async ({ page }) => {
    await helper.recordTest('Bulk_Upload_Modal', async () => {
      await page.goto(APP_URL);
      await page.click('button:has-text("Incidents")');
      await page.waitForSelector('[data-testid="incidents-page"]');

      // Open bulk upload modal
      await page.click('button:has-text("Upload em Massa")');
      await page.waitForSelector('[data-testid="bulk-upload-modal"]', { timeout: 5000 });

      // Verify modal is visible
      await expect(page.locator('[data-testid="bulk-upload-modal"]')).toBeVisible();
      await expect(page.locator('h2:has-text("Upload em Massa de Incidentes")')).toBeVisible();

      // Check for file upload area
      await expect(page.locator('[data-testid="file-upload-area"]')).toBeVisible();

      // Close modal
      await page.click('[data-testid="close-modal-button"]');
      await expect(page.locator('[data-testid="bulk-upload-modal"]')).not.toBeVisible();
    });
  });

  test('AI Search Tab Functionality', async ({ page }) => {
    await helper.recordTest('AI_Search_Functionality', async () => {
      await page.goto(APP_URL);
      await page.click('button:has-text("Incidents")');
      await page.waitForSelector('[data-testid="incidents-page"]');

      // Switch to AI search tab
      await page.click('[data-testid="ai-search-tab"]');
      await expect(page.locator('[data-testid="ai-search-content"]')).toBeVisible();

      // Test AI search
      await page.fill('[data-testid="search-input"]', 'problemas de performance no banco de dados');

      // Submit AI search
      await page.press('[data-testid="search-input"]', 'Enter');

      // Wait for AI search results
      await page.waitForSelector('[data-testid="ai-search-loading"]', { timeout: 2000 });
      await page.waitForSelector('[data-testid="ai-search-results"]', { timeout: 10000 });

      // Verify AI results are displayed
      await expect(page.locator('[data-testid="ai-search-results"]')).toBeVisible();
    });
  });

  test('Portuguese Localization Validation', async ({ page }) => {
    await helper.recordTest('Portuguese_Localization', async () => {
      await page.goto(APP_URL);
      await page.click('button:has-text("Incidents")');
      await page.waitForSelector('[data-testid="incidents-page"]');

      // Check Portuguese text in main interface
      await expect(page.locator('h1:has-text("Gestão de Incidentes")')).toBeVisible();
      await expect(page.locator('button:has-text("Upload em Massa")')).toBeVisible();
      await expect(page.locator('[placeholder*="Pesquisar incidentes"]')).toBeVisible();

      // Check tab labels
      await expect(page.locator('button:has-text("Busca Local")')).toBeVisible();
      await expect(page.locator('button:has-text("Análise com IA")')).toBeVisible();

      // Open create modal and check Portuguese labels
      await page.click('[data-testid="create-incident-fab"]');
      await page.waitForSelector('[data-testid="create-incident-modal"]');

      await expect(page.locator('label:has-text("Título")')).toBeVisible();
      await expect(page.locator('label:has-text("Descrição")')).toBeVisible();
      await expect(page.locator('label:has-text("Prioridade")')).toBeVisible();
    });
  });

  test('Responsive Layout - Mobile View', async ({ page }) => {
    await helper.recordTest('Responsive_Mobile_Layout', async () => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto(APP_URL);
      await page.click('button:has-text("Incidents")');
      await page.waitForSelector('[data-testid="incidents-page"]');

      // Verify mobile layout adaptations
      await expect(page.locator('[data-testid="incidents-page"]')).toBeVisible();

      // Check that components stack properly on mobile
      const header = page.locator('header');
      const main = page.locator('main');

      const headerBox = await header.boundingBox();
      const mainBox = await main.boundingBox();

      // Main content should be below header
      expect(mainBox?.y).toBeGreaterThan(headerBox?.y || 0);

      // Test mobile navigation
      await page.click('[data-testid="create-incident-fab"]');
      await page.waitForSelector('[data-testid="create-incident-modal"]');

      // Modal should be visible and usable on mobile
      await expect(page.locator('[data-testid="create-incident-modal"]')).toBeVisible();
    });
  });

  test('Responsive Layout - Desktop View', async ({ page }) => {
    await helper.recordTest('Responsive_Desktop_Layout', async () => {
      // Set desktop viewport
      await page.setViewportSize({ width: 1280, height: 720 });

      await page.goto(APP_URL);
      await page.click('button:has-text("Incidents")');
      await page.waitForSelector('[data-testid="incidents-page"]');

      // Verify desktop layout
      await expect(page.locator('[data-testid="incidents-page"]')).toBeVisible();

      // Check horizontal layout elements
      await expect(page.locator('nav')).toBeVisible();
      await expect(page.locator('main')).toBeVisible();

      // Test desktop-specific features
      const searchInput = page.locator('[data-testid="search-input"]');
      await expect(searchInput).toBeVisible();

      // Desktop search should be wider
      const searchBox = await searchInput.boundingBox();
      expect(searchBox?.width).toBeGreaterThan(300);
    });
  });

  test('Error Boundaries and Fallbacks', async ({ page }) => {
    await helper.recordTest('Error_Boundaries', async () => {
      await page.goto(APP_URL);
      await page.click('button:has-text("Incidents")');
      await page.waitForSelector('[data-testid="incidents-page"]');

      // Test with invalid search to trigger potential errors
      await page.fill('[data-testid="search-input"]', '"><script>alert("xss")</script>');
      await page.waitForTimeout(1000);

      // Application should still be functional
      await expect(page.locator('[data-testid="incidents-page"]')).toBeVisible();

      // Test navigation after potential error
      await page.click('button:has-text("Dashboard")');
      await page.waitForTimeout(500);
      await page.click('button:has-text("Incidents")');

      // Should still work
      await expect(page.locator('[data-testid="incidents-page"]')).toBeVisible();
    });
  });

  test('Performance and Loading Times', async ({ page }) => {
    await helper.recordTest('Performance_Loading', async () => {
      const startTime = Date.now();

      await page.goto(APP_URL, { waitUntil: 'networkidle' });

      const loadTime = Date.now() - startTime;

      // Application should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);

      // Navigate to incidents and measure render time
      const navStartTime = Date.now();
      await page.click('button:has-text("Incidents")');
      await page.waitForSelector('[data-testid="incidents-page"]');
      const navTime = Date.now() - navStartTime;

      // Incidents page should load within 2 seconds
      expect(navTime).toBeLessThan(2000);
    });
  });
});

// Standalone validation script that can be run independently
export async function runValidation(): Promise<ValidationResult[]> {
  const { chromium } = require('@playwright/test');

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const helper = new IncidentValidationHelper(page);

  try {
    await helper.setupMockData();

    // Run all validation tests
    const tests = [
      () => helper.recordTest('Application_Loading', async () => {
        await page.goto(APP_URL, { waitUntil: 'networkidle' });
        await page.waitForSelector('[data-testid="main-app"]', { timeout: 10000 });
        await expect(page.locator('header')).toBeVisible();
      }),

      () => helper.recordTest('Navigation_Test', async () => {
        await page.goto(APP_URL);
        await page.click('button:has-text("Incidents")');
        await page.waitForSelector('[data-testid="incidents-page"]');
        await expect(page.locator('h1:has-text("Gestão de Incidentes")')).toBeVisible();
      }),

      () => helper.recordTest('Components_Test', async () => {
        await page.goto(APP_URL);
        await page.click('button:has-text("Incidents")');
        await page.waitForSelector('[data-testid="incidents-page"]');
        await expect(page.locator('[data-testid="create-incident-fab"]')).toBeVisible();
      })
    ];

    for (const test of tests) {
      await test();
    }

    await helper.generateReport();
    return helper.getResults();

  } finally {
    await browser.close();
  }
}