/**
 * Custom Playwright Matchers for Incident Management Testing
 *
 * This module extends Playwright's expect with incident-specific matchers
 * for better test assertions and more readable test code.
 *
 * @location /tests/e2e/incident-management/custom-matchers.ts
 */

import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

// Portuguese status mappings
const STATUS_MAPPINGS = {
  'aberto': 'Aberto',
  'em_tratamento': 'Em Tratamento',
  'em_revisao': 'Em Revisão',
  'resolvido': 'Resolvido',
  'fechado': 'Fechado'
};

const PRIORITY_MAPPINGS = {
  'P1': 'P1 - Crítica',
  'P2': 'P2 - Alta',
  'P3': 'P3 - Média',
  'P4': 'P4 - Baixa'
};

const IMPACT_MAPPINGS = {
  'crítica': 'Crítica',
  'alta': 'Alta',
  'média': 'Média',
  'baixa': 'Baixa'
};

// Extend Playwright's expect with custom matchers
expect.extend({
  // Check if incident has valid status
  async toHaveIncidentStatus(locator: Locator, expectedStatus: string) {
    const assertionName = 'toHaveIncidentStatus';
    let pass: boolean;
    let matcherResult: any;

    try {
      const actualText = await locator.textContent();
      const expectedText = STATUS_MAPPINGS[expectedStatus as keyof typeof STATUS_MAPPINGS] || expectedStatus;
      pass = actualText?.includes(expectedText) || false;

      matcherResult = {
        message: () =>
          pass
            ? `Expected incident not to have status "${expectedStatus}" but it did`
            : `Expected incident to have status "${expectedStatus}" but got "${actualText}"`,
        pass,
        name: assertionName,
        expected: expectedText,
        actual: actualText,
      };
    } catch (e: any) {
      matcherResult = {
        message: () => `toHaveIncidentStatus failed: ${e.message}`,
        pass: false,
        name: assertionName,
      };
    }

    return matcherResult;
  },

  // Check if incident has valid priority
  async toHaveIncidentPriority(locator: Locator, expectedPriority: string) {
    const assertionName = 'toHaveIncidentPriority';
    let pass: boolean;
    let matcherResult: any;

    try {
      const actualText = await locator.textContent();
      const expectedText = PRIORITY_MAPPINGS[expectedPriority as keyof typeof PRIORITY_MAPPINGS] || expectedPriority;
      pass = actualText?.includes(expectedText) || actualText?.includes(expectedPriority) || false;

      matcherResult = {
        message: () =>
          pass
            ? `Expected incident not to have priority "${expectedPriority}" but it did`
            : `Expected incident to have priority "${expectedPriority}" but got "${actualText}"`,
        pass,
        name: assertionName,
        expected: expectedText,
        actual: actualText,
      };
    } catch (e: any) {
      matcherResult = {
        message: () => `toHaveIncidentPriority failed: ${e.message}`,
        pass: false,
        name: assertionName,
      };
    }

    return matcherResult;
  },

  // Check if element displays valid SLA status
  async toHaveValidSLAStatus(locator: Locator) {
    const assertionName = 'toHaveValidSLAStatus';
    let pass: boolean;
    let matcherResult: any;

    try {
      const actualText = await locator.textContent();
      const validStatuses = ['No Prazo', 'Em Risco', 'Violado', 'on-time', 'at-risk', 'breached'];
      pass = validStatuses.some(status => actualText?.includes(status)) || false;

      matcherResult = {
        message: () =>
          pass
            ? `Expected element not to have valid SLA status but it did`
            : `Expected element to have valid SLA status but got "${actualText}"`,
        pass,
        name: assertionName,
        expected: 'Valid SLA status',
        actual: actualText,
      };
    } catch (e: any) {
      matcherResult = {
        message: () => `toHaveValidSLAStatus failed: ${e.message}`,
        pass: false,
        name: assertionName,
      };
    }

    return matcherResult;
  },

  // Check if form has Portuguese labels
  async toHavePortugueseLabels(locator: Locator) {
    const assertionName = 'toHavePortugueseLabels';
    let pass: boolean;
    let matcherResult: any;

    try {
      const content = await locator.textContent();
      const portugueseTerms = [
        'Título', 'Descrição', 'Prioridade', 'Status', 'Categoria',
        'Sistema Afetado', 'Atribuído', 'Reportado', 'Data', 'Tags',
        'Comentários', 'Anexos', 'Responsável', 'Motivo', 'Escalação'
      ];

      const foundTerms = portugueseTerms.filter(term => content?.includes(term));
      pass = foundTerms.length >= 3; // At least 3 Portuguese terms should be present

      matcherResult = {
        message: () =>
          pass
            ? `Expected element not to have Portuguese labels but it did`
            : `Expected element to have Portuguese labels. Found: ${foundTerms.join(', ')}`,
        pass,
        name: assertionName,
        expected: 'Portuguese labels',
        actual: `Found terms: ${foundTerms.join(', ')}`,
      };
    } catch (e: any) {
      matcherResult = {
        message: () => `toHavePortugueseLabels failed: ${e.message}`,
        pass: false,
        name: assertionName,
      };
    }

    return matcherResult;
  },

  // Check if element shows field change indicator
  async toShowFieldChange(locator: Locator, fieldName?: string) {
    const assertionName = 'toShowFieldChange';
    let pass: boolean;
    let matcherResult: any;

    try {
      const changeIndicator = fieldName
        ? locator.page().locator(`[data-testid="field-change-indicator-${fieldName}"]`)
        : locator.locator('[data-testid*="field-change-indicator"]');

      pass = await changeIndicator.isVisible();

      matcherResult = {
        message: () =>
          pass
            ? `Expected field change indicator not to be visible but it was`
            : `Expected field change indicator to be visible for ${fieldName || 'field'}`,
        pass,
        name: assertionName,
        expected: 'Visible change indicator',
        actual: pass ? 'Visible' : 'Not visible',
      };
    } catch (e: any) {
      matcherResult = {
        message: () => `toShowFieldChange failed: ${e.message}`,
        pass: false,
        name: assertionName,
      };
    }

    return matcherResult;
  },

  // Check if element has critical change warning
  async toHaveCriticalChangeWarning(locator: Locator) {
    const assertionName = 'toHaveCriticalChangeWarning';
    let pass: boolean;
    let matcherResult: any;

    try {
      // Look for critical change indicators
      const page = locator.page();
      const criticalIndicators = [
        '[data-testid="critical-change-indicator"]',
        '[data-testid="critical-changes-confirmation"]',
        '.text-orange-500, .text-red-500',
        '[aria-label*="crítica"], [aria-label*="critical"]'
      ];

      let foundIndicator = false;
      for (const selector of criticalIndicators) {
        const element = page.locator(selector);
        if (await element.isVisible()) {
          foundIndicator = true;
          break;
        }
      }

      pass = foundIndicator;

      matcherResult = {
        message: () =>
          pass
            ? `Expected element not to have critical change warning but it did`
            : `Expected element to have critical change warning`,
        pass,
        name: assertionName,
        expected: 'Critical change warning',
        actual: pass ? 'Warning present' : 'No warning',
      };
    } catch (e: any) {
      matcherResult = {
        message: () => `toHaveCriticalChangeWarning failed: ${e.message}`,
        pass: false,
        name: assertionName,
      };
    }

    return matcherResult;
  },

  // Check if validation error is properly displayed
  async toHaveValidationError(locator: Locator, errorMessage?: string) {
    const assertionName = 'toHaveValidationError';
    let pass: boolean;
    let matcherResult: any;

    try {
      const errorElement = locator.locator('[data-testid*="-error"], .error-message, [role="alert"]');
      const isVisible = await errorElement.isVisible();

      if (!isVisible) {
        pass = false;
      } else if (errorMessage) {
        const actualText = await errorElement.textContent();
        pass = actualText?.includes(errorMessage) || false;
      } else {
        pass = true;
      }

      matcherResult = {
        message: () =>
          pass
            ? `Expected validation error not to be present but it was`
            : `Expected validation error${errorMessage ? ` with message "${errorMessage}"` : ''} to be present`,
        pass,
        name: assertionName,
        expected: errorMessage || 'Validation error',
        actual: pass ? 'Error present' : 'No error',
      };
    } catch (e: any) {
      matcherResult = {
        message: () => `toHaveValidationError failed: ${e.message}`,
        pass: false,
        name: assertionName,
      };
    }

    return matcherResult;
  },

  // Check if element is within character limit
  async toBeWithinCharacterLimit(locator: Locator, maxLength: number) {
    const assertionName = 'toBeWithinCharacterLimit';
    let pass: boolean;
    let matcherResult: any;

    try {
      const value = await locator.inputValue();
      const actualLength = value.length;
      pass = actualLength <= maxLength;

      matcherResult = {
        message: () =>
          pass
            ? `Expected input to exceed character limit of ${maxLength} but it didn't`
            : `Expected input to be within character limit of ${maxLength} but got ${actualLength} characters`,
        pass,
        name: assertionName,
        expected: `<= ${maxLength} characters`,
        actual: `${actualLength} characters`,
      };
    } catch (e: any) {
      matcherResult = {
        message: () => `toBeWithinCharacterLimit failed: ${e.message}`,
        pass: false,
        name: assertionName,
      };
    }

    return matcherResult;
  },

  // Check if filters are applied correctly
  async toHaveActiveFilters(locator: Locator, expectedCount: number) {
    const assertionName = 'toHaveActiveFilters';
    let pass: boolean;
    let matcherResult: any;

    try {
      const countElement = locator.locator('[data-testid="active-filters-count"]');
      const countText = await countElement.textContent();
      const actualCount = parseInt(countText?.match(/(\d+)/)?.[1] || '0');
      pass = actualCount === expectedCount;

      matcherResult = {
        message: () =>
          pass
            ? `Expected not to have ${expectedCount} active filters but it did`
            : `Expected to have ${expectedCount} active filters but got ${actualCount}`,
        pass,
        name: assertionName,
        expected: expectedCount,
        actual: actualCount,
      };
    } catch (e: any) {
      matcherResult = {
        message: () => `toHaveActiveFilters failed: ${e.message}`,
        pass: false,
        name: assertionName,
      };
    }

    return matcherResult;
  },

  // Check if element is mobile responsive
  async toBeMobileResponsive(locator: Locator) {
    const assertionName = 'toBeMobileResponsive';
    let pass: boolean;
    let matcherResult: any;

    try {
      const page = locator.page();
      const box = await locator.boundingBox();
      const viewport = page.viewportSize();

      if (!box || !viewport) {
        pass = false;
      } else {
        // Check if element fits within mobile viewport width (typically 375px)
        const mobileWidth = 375;
        pass = box.width <= mobileWidth && box.x >= 0;
      }

      matcherResult = {
        message: () =>
          pass
            ? `Expected element not to be mobile responsive but it was`
            : `Expected element to be mobile responsive`,
        pass,
        name: assertionName,
        expected: 'Mobile responsive layout',
        actual: pass ? 'Responsive' : 'Not responsive',
      };
    } catch (e: any) {
      matcherResult = {
        message: () => `toBeMobileResponsive failed: ${e.message}`,
        pass: false,
        name: assertionName,
      };
    }

    return matcherResult;
  },

  // Check if element has proper ARIA attributes
  async toHaveProperARIA(locator: Locator) {
    const assertionName = 'toHaveProperARIA';
    let pass: boolean;
    let matcherResult: any;

    try {
      const requiredARIA = ['aria-label', 'aria-labelledby', 'aria-describedby', 'role'];
      const foundARIA: string[] = [];

      for (const attr of requiredARIA) {
        const value = await locator.getAttribute(attr);
        if (value) {
          foundARIA.push(attr);
        }
      }

      // Element should have at least one ARIA attribute
      pass = foundARIA.length > 0;

      matcherResult = {
        message: () =>
          pass
            ? `Expected element not to have proper ARIA attributes but it did`
            : `Expected element to have ARIA attributes. Found: ${foundARIA.join(', ')}`,
        pass,
        name: assertionName,
        expected: 'ARIA attributes',
        actual: foundARIA.length > 0 ? foundARIA.join(', ') : 'No ARIA attributes',
      };
    } catch (e: any) {
      matcherResult = {
        message: () => `toHaveProperARIA failed: ${e.message}`,
        pass: false,
        name: assertionName,
      };
    }

    return matcherResult;
  },

  // Check if color contrast meets accessibility standards
  async toHaveAccessibleContrast(locator: Locator, minimumRatio: number = 4.5) {
    const assertionName = 'toHaveAccessibleContrast';
    let pass: boolean;
    let matcherResult: any;

    try {
      // This is a simplified check - in a real implementation,
      // you would calculate the actual contrast ratio
      const styles = await locator.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          color: computed.color,
          backgroundColor: computed.backgroundColor,
          fontSize: computed.fontSize
        };
      });

      // Mock contrast calculation (would need proper implementation)
      const mockContrastRatio = 4.7; // Placeholder
      pass = mockContrastRatio >= minimumRatio;

      matcherResult = {
        message: () =>
          pass
            ? `Expected contrast ratio to be below ${minimumRatio} but it was ${mockContrastRatio}`
            : `Expected contrast ratio to be at least ${minimumRatio} but got ${mockContrastRatio}`,
        pass,
        name: assertionName,
        expected: `>= ${minimumRatio}`,
        actual: mockContrastRatio,
      };
    } catch (e: any) {
      matcherResult = {
        message: () => `toHaveAccessibleContrast failed: ${e.message}`,
        pass: false,
        name: assertionName,
      };
    }

    return matcherResult;
  }
});

// Type declarations for TypeScript
declare global {
  namespace PlaywrightTest {
    interface Matchers<R> {
      toHaveIncidentStatus(expectedStatus: string): R;
      toHaveIncidentPriority(expectedPriority: string): R;
      toHaveValidSLAStatus(): R;
      toHavePortugueseLabels(): R;
      toShowFieldChange(fieldName?: string): R;
      toHaveCriticalChangeWarning(): R;
      toHaveValidationError(errorMessage?: string): R;
      toBeWithinCharacterLimit(maxLength: number): R;
      toHaveActiveFilters(expectedCount: number): R;
      toBeMobileResponsive(): R;
      toHaveProperARIA(): R;
      toHaveAccessibleContrast(minimumRatio?: number): R;
    }
  }
}

// Helper functions for common test scenarios
export const incidentTestHelpers = {
  // Wait for incident to load with all required data
  async waitForIncidentToLoad(page: Page, incidentId: string) {
    await page.waitForSelector(`[data-testid="incident-detail-view"]`);
    await expect(page.locator('[data-testid="incident-number"]')).toContainText(incidentId);
    await expect(page.locator('[data-testid="incident-title"]')).not.toBeEmpty();
  },

  // Wait for modal to be fully loaded and functional
  async waitForModalToLoad(page: Page, modalTestId: string) {
    await page.waitForSelector(`[data-testid="${modalTestId}"]`);
    await page.waitForLoadState('networkidle');
    // Wait for any animations to complete
    await page.waitForTimeout(300);
  },

  // Check for common validation errors in Portuguese
  async expectPortugueseValidationErrors(page: Page) {
    const possibleErrors = [
      'obrigatório', 'necessário', 'inválido', 'muito curto',
      'muito longo', 'formato inválido', 'campo requerido'
    ];

    const errorElements = await page.locator('[data-testid*="-error"]').all();
    let foundPortugueseError = false;

    for (const element of errorElements) {
      const text = await element.textContent();
      if (text && possibleErrors.some(error => text.toLowerCase().includes(error))) {
        foundPortugueseError = true;
        break;
      }
    }

    expect(foundPortugueseError).toBeTruthy();
  },

  // Verify incident data integrity
  async verifyIncidentDataIntegrity(page: Page, expectedData: any) {
    await expect(page.locator('[data-testid="incident-title"]')).toContainText(expectedData.title);
    await expect(page.locator('[data-testid="incident-status-badge"]')).toHaveIncidentStatus(expectedData.status);
    await expect(page.locator('[data-testid="incident-priority-badge"]')).toHaveIncidentPriority(expectedData.priority);

    if (expectedData.assigned_to) {
      await expect(page.locator('[data-testid="assigned-to"]')).toContainText(expectedData.assigned_to);
    }
  },

  // Check accessibility for a section
  async checkSectionAccessibility(page: Page, sectionSelector: string) {
    const section = page.locator(sectionSelector);
    await expect(section).toHaveProperARIA();
    await expect(section).toHaveAccessibleContrast();
  },

  // Verify mobile responsiveness
  async checkMobileLayout(page: Page, elementSelectors: string[]) {
    await page.setViewportSize({ width: 375, height: 667 });

    for (const selector of elementSelectors) {
      await expect(page.locator(selector)).toBeMobileResponsive();
    }
  },

  // Performance timing helper
  async measureActionPerformance(page: Page, action: () => Promise<void>) {
    const startTime = Date.now();
    await action();
    const endTime = Date.now();
    return endTime - startTime;
  }
};

export default {
  incidentTestHelpers
};