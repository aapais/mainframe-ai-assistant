/**
 * Comprehensive Accessibility Testing Suite - Entry Point
 * WCAG 2.1 AA Compliance Validation for Mainframe KB Assistant
 *
 * This module exports all accessibility testing tools and utilities
 * for comprehensive WCAG compliance validation.
 */

// Core testing framework
export {
  ComprehensiveAccessibilityTestRunner,
  type AccessibilityTestConfig,
  type AccessibilityTestResults,
  COMPREHENSIVE_ACCESSIBILITY_CONFIG
} from './AccessibilityTestSuite';

// Specialized validators
export {
  KeyboardNavigationValidator,
  type KeyboardTestResult,
  type FocusableElement,
  type FocusIndicatorResult,
  type KeyboardShortcutResult,
  type SkipLinkResult,
  type FocusTrapResult,
  type KeyboardIssue
} from './KeyboardNavigationValidator';

export {
  ScreenReaderValidator,
  type ScreenReaderTestResult,
  type AriaImplementationResult,
  type LandmarkStructureResult,
  type HeadingHierarchyResult,
  type LiveRegionResult,
  type TableAccessibilityResult,
  type FormLabelingResult,
  type AlternativeTextResult,
  type ScreenReaderIssue
} from './ScreenReaderValidator';

export {
  ColorContrastValidator,
  type ColorContrastTestResult,
  type TextContrastResult,
  type FocusIndicatorContrastResult,
  type InteractiveElementContrastResult,
  type BackgroundImageContrastResult,
  type HighContrastModeResult,
  type ColorContrastIssue
} from './ColorContrastValidator';

// Report generation
export {
  AccessibilityAuditReportGenerator,
  type AccessibilityAuditReport,
  type ExecutiveSummary,
  type ComponentAuditResult,
  type WCAGComplianceReport,
  type DetailedFindings,
  type RemediationPlan,
  type Recommendation
} from './AccessibilityAuditReport';

// Testing utilities and helpers
export { AccessibilityTestingUtilities } from './AccessibilityValidationSuite.test';

/**
 * Quick accessibility validation function
 * For rapid component testing during development
 */
export async function quickAccessibilityCheck(
  component: React.ReactElement,
  componentName?: string
): Promise<AccessibilityTestResults> {
  const testRunner = new ComprehensiveAccessibilityTestRunner();
  return await testRunner.runComprehensiveTest(component, componentName || 'Component');
}

/**
 * Generate full accessibility audit report
 * For comprehensive application assessment
 */
export async function generateAccessibilityAuditReport(
  components: Array<{ component: React.ReactElement; name: string }>,
  metadata: Partial<any> = {}
): Promise<AccessibilityAuditReport> {
  const testRunner = new ComprehensiveAccessibilityTestRunner();
  const results: AccessibilityTestResults[] = [];

  console.log('🔍 Starting comprehensive accessibility audit...');

  for (const { component, name } of components) {
    console.log(`  Testing ${name}...`);
    const result = await testRunner.runComprehensiveTest(component, name);
    results.push(result);
  }

  console.log('📊 Generating audit report...');
  const reportGenerator = new AccessibilityAuditReportGenerator(results, metadata);
  const report = reportGenerator.generateReport();

  console.log('✅ Accessibility audit completed');
  console.log(`   Overall Score: ${report.executiveSummary.overallComplianceScore}%`);
  console.log(`   Total Issues: ${report.executiveSummary.totalIssues}`);
  console.log(`   Critical Issues: ${report.executiveSummary.criticalIssues}`);

  return report;
}

/**
 * Validate keyboard accessibility only
 * For focused keyboard testing
 */
export async function validateKeyboardAccessibility(
  container: HTMLElement
): Promise<KeyboardTestResult> {
  const validator = new KeyboardNavigationValidator(container);
  return await validator.validateKeyboardNavigation();
}

/**
 * Validate screen reader support only
 * For focused screen reader testing
 */
export async function validateScreenReaderSupport(
  container: HTMLElement
): Promise<ScreenReaderTestResult> {
  const validator = new ScreenReaderValidator(container);
  return await validator.validateScreenReaderSupport();
}

/**
 * Validate color contrast only
 * For focused color contrast testing
 */
export async function validateColorContrast(
  container: HTMLElement
): Promise<ColorContrastTestResult> {
  const validator = new ColorContrastValidator(container);
  return await validator.validateColorContrast();
}

/**
 * WCAG 2.1 AA Compliance checker
 * Returns true if component meets WCAG 2.1 AA requirements
 */
export async function isWCAGCompliant(
  component: React.ReactElement,
  level: 'A' | 'AA' | 'AAA' = 'AA'
): Promise<boolean> {
  const result = await quickAccessibilityCheck(component);

  if (level === 'AA') {
    return result.summary.criticalIssues === 0 && result.summary.overallScore >= 85;
  } else if (level === 'A') {
    return result.summary.criticalIssues === 0 && result.summary.overallScore >= 75;
  } else { // AAA
    return result.summary.criticalIssues === 0 &&
           result.summary.warningIssues === 0 &&
           result.summary.overallScore >= 95;
  }
}

/**
 * Accessibility testing configuration
 */
export const accessibilityTestingConfig = {
  wcagLevel: 'AA' as const,
  colorContrastRatio: 4.5,
  focusTimeout: 1000,
  keyboardDelay: 100,
  screenReaderDelay: 500,

  // Test coverage requirements
  minCoverageThreshold: 85,
  criticalIssuesThreshold: 0,
  warningIssuesThreshold: 5,

  // Component test requirements
  requiredTests: [
    'keyboard',
    'screenReader',
    'colorContrast',
    'focusManagement',
    'errorHandling'
  ] as const,

  // WCAG criteria to validate
  wcagCriteria: [
    '1.1.1', // Non-text Content
    '1.3.1', // Info and Relationships
    '1.4.3', // Contrast (Minimum)
    '1.4.11', // Non-text Contrast
    '2.1.1', // Keyboard
    '2.1.2', // No Keyboard Trap
    '2.4.3', // Focus Order
    '2.4.7', // Focus Visible
    '3.3.1', // Error Identification
    '3.3.2', // Labels or Instructions
    '4.1.2', // Name, Role, Value
    '4.1.3' // Status Messages
  ] as const
};

/**
 * Export all validators for advanced usage
 */
import { ComprehensiveAccessibilityTestRunner } from './AccessibilityTestSuite';
import { KeyboardNavigationValidator } from './KeyboardNavigationValidator';
import { ScreenReaderValidator } from './ScreenReaderValidator';
import { ColorContrastValidator } from './ColorContrastValidator';
import { AccessibilityAuditReportGenerator } from './AccessibilityAuditReport';

export const AccessibilityValidators = {
  ComprehensiveAccessibilityTestRunner,
  KeyboardNavigationValidator,
  ScreenReaderValidator,
  ColorContrastValidator,
  AccessibilityAuditReportGenerator
};

/**
 * Default export for convenience
 */
export default {
  quickAccessibilityCheck,
  generateAccessibilityAuditReport,
  validateKeyboardAccessibility,
  validateScreenReaderSupport,
  validateColorContrast,
  isWCAGCompliant,
  config: accessibilityTestingConfig,
  validators: AccessibilityValidators
};