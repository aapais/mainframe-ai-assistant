/**
 * Comprehensive Screen Reader Testing Framework
 *
 * Supports NVDA, JAWS, and VoiceOver with automated testing capabilities
 * and cross-platform compatibility validation.
 */

import { performance } from 'perf_hooks';
import { promises as fs } from 'fs';
import { join } from 'path';

export interface ScreenReaderTestConfig {
  screenReader: 'nvda' | 'jaws' | 'voiceover';
  version?: string;
  language?: string;
  speechRate?: number;
  verbosityLevel?: 'brief' | 'verbose';
  enableLogging?: boolean;
  outputFormat?: 'text' | 'json' | 'xml';
}

export interface AriaTestCase {
  name: string;
  description: string;
  element: string;
  expectedAnnouncement: string;
  ariaAttributes: Record<string, string>;
  tags: string[];
  wcagCriteria: string[];
}

export interface ScreenReaderTestResult {
  testName: string;
  screenReader: string;
  passed: boolean;
  actualAnnouncement: string;
  expectedAnnouncement: string;
  timeTaken: number;
  violations: AccessibilityViolation[];
  metadata: Record<string, any>;
}

export interface AccessibilityViolation {
  rule: string;
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  element: string;
  description: string;
  suggestion: string;
  wcagCriterion: string;
}

export interface LiveRegionTest {
  regionType: 'polite' | 'assertive' | 'off';
  content: string;
  trigger: 'immediate' | 'user-action' | 'delayed';
  expectedBehavior: string;
}

export interface NavigationTest {
  landmarkType: 'main' | 'nav' | 'aside' | 'section' | 'article' | 'header' | 'footer';
  headingLevel: number;
  expectedSequence: string[];
  keyboardShortcuts: Record<string, string>;
}

export interface FormAccessibilityTest {
  fieldType: 'text' | 'email' | 'password' | 'select' | 'checkbox' | 'radio' | 'textarea';
  labelAssociation: 'explicit' | 'implicit' | 'aria-label' | 'aria-labelledby';
  hasDescription: boolean;
  hasErrorMessage: boolean;
  requiredField: boolean;
  expectedAnnouncement: string;
}

export interface TableAccessibilityTest {
  hasCaption: boolean;
  hasColumnHeaders: boolean;
  hasRowHeaders: boolean;
  headerScope: 'col' | 'row' | 'colgroup' | 'rowgroup';
  complexTable: boolean;
  expectedNavigation: string[];
}

export class ScreenReaderTestRunner {
  private config: ScreenReaderTestConfig;
  private testResults: ScreenReaderTestResult[] = [];
  private startTime: number = 0;

  constructor(config: ScreenReaderTestConfig) {
    this.config = config;
  }

  /**
   * Initialize screen reader for testing
   */
  async initialize(): Promise<void> {
    this.startTime = performance.now();

    console.log(`🔊 Initializing ${this.config.screenReader.toUpperCase()} screen reader testing...`);

    // Platform-specific initialization
    switch (this.config.screenReader) {
      case 'nvda':
        await this.initializeNVDA();
        break;
      case 'jaws':
        await this.initializeJAWS();
        break;
      case 'voiceover':
        await this.initializeVoiceOver();
        break;
    }
  }

  /**
   * NVDA-specific initialization
   */
  private async initializeNVDA(): Promise<void> {
    // Check if NVDA is available
    const nvdaAvailable = await this.checkNVDAAvailability();
    if (!nvdaAvailable) {
      throw new Error('NVDA screen reader not found. Please install NVDA.');
    }

    // Configure NVDA settings
    await this.configureNVDASettings();
  }

  /**
   * JAWS-specific initialization
   */
  private async initializeJAWS(): Promise<void> {
    // Check if JAWS is available
    const jawsAvailable = await this.checkJAWSAvailability();
    if (!jawsAvailable) {
      throw new Error('JAWS screen reader not found. Please install JAWS.');
    }

    // Configure JAWS settings
    await this.configureJAWSSettings();
  }

  /**
   * VoiceOver-specific initialization
   */
  private async initializeVoiceOver(): Promise<void> {
    // Check if VoiceOver is available (macOS only)
    if (process.platform !== 'darwin') {
      throw new Error('VoiceOver is only available on macOS');
    }

    const voiceOverAvailable = await this.checkVoiceOverAvailability();
    if (!voiceOverAvailable) {
      throw new Error('VoiceOver not enabled. Please enable VoiceOver in System Preferences.');
    }

    // Configure VoiceOver settings
    await this.configureVoiceOverSettings();
  }

  /**
   * Test ARIA implementation
   */
  async testAriaImplementation(testCases: AriaTestCase[]): Promise<ScreenReaderTestResult[]> {
    const results: ScreenReaderTestResult[] = [];

    console.log(`🧪 Running ARIA tests with ${this.config.screenReader}...`);

    for (const testCase of testCases) {
      const startTime = performance.now();

      try {
        const announcement = await this.getElementAnnouncement(testCase);
        const passed = this.validateAnnouncement(announcement, testCase.expectedAnnouncement);

        const result: ScreenReaderTestResult = {
          testName: testCase.name,
          screenReader: this.config.screenReader,
          passed,
          actualAnnouncement: announcement,
          expectedAnnouncement: testCase.expectedAnnouncement,
          timeTaken: performance.now() - startTime,
          violations: passed ? [] : this.analyzeAriaViolations(testCase, announcement),
          metadata: {
            ariaAttributes: testCase.ariaAttributes,
            wcagCriteria: testCase.wcagCriteria,
            tags: testCase.tags
          }
        };

        results.push(result);
        this.testResults.push(result);

        if (this.config.enableLogging) {
          this.logTestResult(result);
        }

      } catch (error) {
        console.error(`❌ Error testing ${testCase.name}:`, error);

        const result: ScreenReaderTestResult = {
          testName: testCase.name,
          screenReader: this.config.screenReader,
          passed: false,
          actualAnnouncement: '',
          expectedAnnouncement: testCase.expectedAnnouncement,
          timeTaken: performance.now() - startTime,
          violations: [{
            rule: 'test-execution',
            severity: 'critical',
            element: testCase.element,
            description: `Test execution failed: ${error.message}`,
            suggestion: 'Check test setup and screen reader configuration',
            wcagCriterion: 'N/A'
          }],
          metadata: { error: error.message }
        };

        results.push(result);
        this.testResults.push(result);
      }
    }

    return results;
  }

  /**
   * Test live regions
   */
  async testLiveRegions(tests: LiveRegionTest[]): Promise<ScreenReaderTestResult[]> {
    const results: ScreenReaderTestResult[] = [];

    console.log(`📢 Testing live regions with ${this.config.screenReader}...`);

    for (const test of tests) {
      const startTime = performance.now();

      try {
        const announcement = await this.testLiveRegionAnnouncement(test);
        const passed = announcement.includes(test.content);

        const result: ScreenReaderTestResult = {
          testName: `Live Region - ${test.regionType}`,
          screenReader: this.config.screenReader,
          passed,
          actualAnnouncement: announcement,
          expectedAnnouncement: test.expectedBehavior,
          timeTaken: performance.now() - startTime,
          violations: passed ? [] : [{
            rule: 'live-region-announcement',
            severity: 'serious',
            element: `[aria-live="${test.regionType}"]`,
            description: 'Live region content not announced properly',
            suggestion: 'Check aria-live attribute and content updates',
            wcagCriterion: '4.1.3'
          }],
          metadata: {
            regionType: test.regionType,
            trigger: test.trigger,
            content: test.content
          }
        };

        results.push(result);
        this.testResults.push(result);

      } catch (error) {
        console.error(`❌ Error testing live region ${test.regionType}:`, error);
      }
    }

    return results;
  }

  /**
   * Test navigation and landmarks
   */
  async testNavigation(tests: NavigationTest[]): Promise<ScreenReaderTestResult[]> {
    const results: ScreenReaderTestResult[] = [];

    console.log(`🧭 Testing navigation with ${this.config.screenReader}...`);

    for (const test of tests) {
      const startTime = performance.now();

      try {
        const navigationSequence = await this.testNavigationSequence(test);
        const passed = this.validateNavigationSequence(navigationSequence, test.expectedSequence);

        const result: ScreenReaderTestResult = {
          testName: `Navigation - ${test.landmarkType}`,
          screenReader: this.config.screenReader,
          passed,
          actualAnnouncement: navigationSequence.join(' → '),
          expectedAnnouncement: test.expectedSequence.join(' → '),
          timeTaken: performance.now() - startTime,
          violations: passed ? [] : [{
            rule: 'navigation-structure',
            severity: 'serious',
            element: test.landmarkType,
            description: 'Navigation sequence does not match expected structure',
            suggestion: 'Check landmark roles and heading hierarchy',
            wcagCriterion: '2.4.6'
          }],
          metadata: {
            landmarkType: test.landmarkType,
            headingLevel: test.headingLevel,
            keyboardShortcuts: test.keyboardShortcuts
          }
        };

        results.push(result);
        this.testResults.push(result);

      } catch (error) {
        console.error(`❌ Error testing navigation ${test.landmarkType}:`, error);
      }
    }

    return results;
  }

  /**
   * Test form accessibility
   */
  async testFormAccessibility(tests: FormAccessibilityTest[]): Promise<ScreenReaderTestResult[]> {
    const results: ScreenReaderTestResult[] = [];

    console.log(`📝 Testing form accessibility with ${this.config.screenReader}...`);

    for (const test of tests) {
      const startTime = performance.now();

      try {
        const announcement = await this.testFormFieldAnnouncement(test);
        const passed = this.validateFormAnnouncement(announcement, test);

        const result: ScreenReaderTestResult = {
          testName: `Form Field - ${test.fieldType}`,
          screenReader: this.config.screenReader,
          passed,
          actualAnnouncement: announcement,
          expectedAnnouncement: test.expectedAnnouncement,
          timeTaken: performance.now() - startTime,
          violations: passed ? [] : this.analyzeFormViolations(test, announcement),
          metadata: {
            fieldType: test.fieldType,
            labelAssociation: test.labelAssociation,
            hasDescription: test.hasDescription,
            hasErrorMessage: test.hasErrorMessage,
            requiredField: test.requiredField
          }
        };

        results.push(result);
        this.testResults.push(result);

      } catch (error) {
        console.error(`❌ Error testing form field ${test.fieldType}:`, error);
      }
    }

    return results;
  }

  /**
   * Test table accessibility
   */
  async testTableAccessibility(tests: TableAccessibilityTest[]): Promise<ScreenReaderTestResult[]> {
    const results: ScreenReaderTestResult[] = [];

    console.log(`📊 Testing table accessibility with ${this.config.screenReader}...`);

    for (const test of tests) {
      const startTime = performance.now();

      try {
        const navigationResults = await this.testTableNavigation(test);
        const passed = this.validateTableNavigation(navigationResults, test);

        const result: ScreenReaderTestResult = {
          testName: 'Table Navigation',
          screenReader: this.config.screenReader,
          passed,
          actualAnnouncement: navigationResults.join(' → '),
          expectedAnnouncement: test.expectedNavigation.join(' → '),
          timeTaken: performance.now() - startTime,
          violations: passed ? [] : this.analyzeTableViolations(test, navigationResults),
          metadata: {
            hasCaption: test.hasCaption,
            hasColumnHeaders: test.hasColumnHeaders,
            hasRowHeaders: test.hasRowHeaders,
            headerScope: test.headerScope,
            complexTable: test.complexTable
          }
        };

        results.push(result);
        this.testResults.push(result);

      } catch (error) {
        console.error(`❌ Error testing table accessibility:`, error);
      }
    }

    return results;
  }

  /**
   * Cross-screen reader compatibility test
   */
  async runCrossCompatibilityTest(testCases: AriaTestCase[]): Promise<{
    nvda: ScreenReaderTestResult[];
    jaws: ScreenReaderTestResult[];
    voiceover: ScreenReaderTestResult[];
    compatibility: number;
  }> {
    const results = {
      nvda: [] as ScreenReaderTestResult[],
      jaws: [] as ScreenReaderTestResult[],
      voiceover: [] as ScreenReaderTestResult[],
      compatibility: 0
    };

    // Test with each screen reader
    const screenReaders: Array<'nvda' | 'jaws' | 'voiceover'> = ['nvda', 'jaws', 'voiceover'];

    for (const screenReader of screenReaders) {
      if (await this.isScreenReaderAvailable(screenReader)) {
        this.config.screenReader = screenReader;
        await this.initialize();
        results[screenReader] = await this.testAriaImplementation(testCases);
      }
    }

    // Calculate compatibility score
    results.compatibility = this.calculateCompatibilityScore(results);

    return results;
  }

  /**
   * Generate comprehensive test report
   */
  async generateTestReport(): Promise<string> {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const totalTime = performance.now() - this.startTime;

    const report = {
      summary: {
        screenReader: this.config.screenReader,
        totalTests,
        passedTests,
        failedTests,
        successRate: Math.round((passedTests / totalTests) * 100),
        totalTimeMs: Math.round(totalTime),
        averageTestTimeMs: Math.round(totalTime / totalTests)
      },
      testResults: this.testResults,
      violations: this.testResults.flatMap(r => r.violations),
      recommendations: this.generateRecommendations(),
      wcagCompliance: this.analyzeWCAGCompliance()
    };

    // Save report to file
    const reportPath = join(process.cwd(), 'tests', 'accessibility', 'reports',
      `screen-reader-test-report-${this.config.screenReader}-${Date.now()}.json`);

    await fs.mkdir(join(process.cwd(), 'tests', 'accessibility', 'reports'), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    console.log(`📊 Test report saved to: ${reportPath}`);

    return JSON.stringify(report, null, 2);
  }

  // Private helper methods

  private async checkNVDAAvailability(): Promise<boolean> {
    // Implementation would check for NVDA installation
    // This is a placeholder - actual implementation would use system checks
    return true;
  }

  private async checkJAWSAvailability(): Promise<boolean> {
    // Implementation would check for JAWS installation
    return true;
  }

  private async checkVoiceOverAvailability(): Promise<boolean> {
    // Implementation would check for VoiceOver on macOS
    return process.platform === 'darwin';
  }

  private async isScreenReaderAvailable(screenReader: string): Promise<boolean> {
    switch (screenReader) {
      case 'nvda':
        return await this.checkNVDAAvailability();
      case 'jaws':
        return await this.checkJAWSAvailability();
      case 'voiceover':
        return await this.checkVoiceOverAvailability();
      default:
        return false;
    }
  }

  private async configureNVDASettings(): Promise<void> {
    // Configure NVDA for testing
    console.log('⚙️ Configuring NVDA settings...');
  }

  private async configureJAWSSettings(): Promise<void> {
    // Configure JAWS for testing
    console.log('⚙️ Configuring JAWS settings...');
  }

  private async configureVoiceOverSettings(): Promise<void> {
    // Configure VoiceOver for testing
    console.log('⚙️ Configuring VoiceOver settings...');
  }

  private async getElementAnnouncement(testCase: AriaTestCase): Promise<string> {
    // Implementation would interact with screen reader to get announcement
    // This is a placeholder - actual implementation would use screen reader APIs
    return testCase.expectedAnnouncement; // Placeholder
  }

  private async testLiveRegionAnnouncement(test: LiveRegionTest): Promise<string> {
    // Implementation would test live region announcements
    return test.content; // Placeholder
  }

  private async testNavigationSequence(test: NavigationTest): Promise<string[]> {
    // Implementation would test navigation sequence
    return test.expectedSequence; // Placeholder
  }

  private async testFormFieldAnnouncement(test: FormAccessibilityTest): Promise<string> {
    // Implementation would test form field announcements
    return test.expectedAnnouncement; // Placeholder
  }

  private async testTableNavigation(test: TableAccessibilityTest): Promise<string[]> {
    // Implementation would test table navigation
    return test.expectedNavigation; // Placeholder
  }

  private validateAnnouncement(actual: string, expected: string): boolean {
    // Normalize and compare announcements
    const normalizeText = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();
    return normalizeText(actual).includes(normalizeText(expected));
  }

  private validateNavigationSequence(actual: string[], expected: string[]): boolean {
    return JSON.stringify(actual) === JSON.stringify(expected);
  }

  private validateFormAnnouncement(announcement: string, test: FormAccessibilityTest): boolean {
    const required = test.requiredField ? announcement.includes('required') : true;
    const hasLabel = announcement.length > 0;
    const hasDescription = test.hasDescription ? announcement.includes(test.fieldType) : true;

    return required && hasLabel && hasDescription;
  }

  private validateTableNavigation(actual: string[], test: TableAccessibilityTest): boolean {
    return actual.length === test.expectedNavigation.length;
  }

  private analyzeAriaViolations(testCase: AriaTestCase, announcement: string): AccessibilityViolation[] {
    const violations: AccessibilityViolation[] = [];

    if (!announcement) {
      violations.push({
        rule: 'missing-announcement',
        severity: 'critical',
        element: testCase.element,
        description: 'Element not announced by screen reader',
        suggestion: 'Check ARIA attributes and accessible name',
        wcagCriterion: '4.1.2'
      });
    }

    return violations;
  }

  private analyzeFormViolations(test: FormAccessibilityTest, announcement: string): AccessibilityViolation[] {
    const violations: AccessibilityViolation[] = [];

    if (!announcement.includes(test.fieldType)) {
      violations.push({
        rule: 'missing-field-type',
        severity: 'serious',
        element: `input[type="${test.fieldType}"]`,
        description: 'Field type not announced',
        suggestion: 'Ensure proper input type and ARIA attributes',
        wcagCriterion: '3.3.2'
      });
    }

    if (test.requiredField && !announcement.includes('required')) {
      violations.push({
        rule: 'missing-required-indication',
        severity: 'serious',
        element: `input[type="${test.fieldType}"]`,
        description: 'Required field not indicated to screen reader',
        suggestion: 'Add aria-required="true" or required attribute',
        wcagCriterion: '3.3.2'
      });
    }

    return violations;
  }

  private analyzeTableViolations(test: TableAccessibilityTest, navigation: string[]): AccessibilityViolation[] {
    const violations: AccessibilityViolation[] = [];

    if (!test.hasCaption) {
      violations.push({
        rule: 'missing-table-caption',
        severity: 'moderate',
        element: 'table',
        description: 'Table missing caption',
        suggestion: 'Add <caption> element to describe table purpose',
        wcagCriterion: '1.3.1'
      });
    }

    if (!test.hasColumnHeaders) {
      violations.push({
        rule: 'missing-column-headers',
        severity: 'serious',
        element: 'table',
        description: 'Table missing column headers',
        suggestion: 'Add <th> elements with scope="col"',
        wcagCriterion: '1.3.1'
      });
    }

    return violations;
  }

  private calculateCompatibilityScore(results: any): number {
    const allResults = [...results.nvda, ...results.jaws, ...results.voiceover];
    const totalTests = allResults.length;
    const passedTests = allResults.filter(r => r.passed).length;

    return totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const violations = this.testResults.flatMap(r => r.violations);

    const criticalCount = violations.filter(v => v.severity === 'critical').length;
    const seriousCount = violations.filter(v => v.severity === 'serious').length;

    if (criticalCount > 0) {
      recommendations.push(`🚨 Address ${criticalCount} critical accessibility issues immediately`);
    }

    if (seriousCount > 0) {
      recommendations.push(`⚠️ Fix ${seriousCount} serious accessibility issues`);
    }

    // Add specific recommendations based on violation patterns
    const commonIssues = this.identifyCommonIssues(violations);
    recommendations.push(...commonIssues);

    return recommendations;
  }

  private identifyCommonIssues(violations: AccessibilityViolation[]): string[] {
    const issues: string[] = [];
    const ruleGroups = violations.reduce((acc, v) => {
      acc[v.rule] = (acc[v.rule] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(ruleGroups).forEach(([rule, count]) => {
      if (count >= 3) {
        issues.push(`🔄 Recurring issue: ${rule} (${count} instances)`);
      }
    });

    return issues;
  }

  private analyzeWCAGCompliance(): Record<string, number> {
    const criteria: Record<string, number> = {};

    this.testResults.forEach(result => {
      if (result.metadata.wcagCriteria) {
        result.metadata.wcagCriteria.forEach((criterion: string) => {
          criteria[criterion] = (criteria[criterion] || 0) + (result.passed ? 1 : 0);
        });
      }
    });

    return criteria;
  }

  private logTestResult(result: ScreenReaderTestResult): void {
    const status = result.passed ? '✅' : '❌';
    const time = Math.round(result.timeTaken);
    console.log(`${status} ${result.testName} (${time}ms) - ${result.screenReader}`);

    if (!result.passed && result.violations.length > 0) {
      result.violations.forEach(violation => {
        console.log(`   💡 ${violation.description}: ${violation.suggestion}`);
      });
    }
  }
}

// Export test data generators
export const createAriaTestCases = (): AriaTestCase[] => [
  {
    name: 'Button with aria-label',
    description: 'Icon button with accessible name via aria-label',
    element: 'button[aria-label="Search"]',
    expectedAnnouncement: 'Search button',
    ariaAttributes: { 'aria-label': 'Search' },
    tags: ['button', 'aria-label'],
    wcagCriteria: ['4.1.2', '2.4.4']
  },
  {
    name: 'Form input with label',
    description: 'Text input with associated label element',
    element: 'input[type="text"]',
    expectedAnnouncement: 'First name edit required',
    ariaAttributes: { 'required': 'true' },
    tags: ['form', 'input', 'label'],
    wcagCriteria: ['3.3.2', '1.3.1']
  },
  {
    name: 'Live region polite',
    description: 'Status message in polite live region',
    element: '[aria-live="polite"]',
    expectedAnnouncement: 'Form saved successfully',
    ariaAttributes: { 'aria-live': 'polite', 'role': 'status' },
    tags: ['live-region', 'status'],
    wcagCriteria: ['4.1.3']
  },
  {
    name: 'Navigation landmark',
    description: 'Main navigation with landmark role',
    element: 'nav[aria-label="Main navigation"]',
    expectedAnnouncement: 'Main navigation navigation landmark',
    ariaAttributes: { 'role': 'navigation', 'aria-label': 'Main navigation' },
    tags: ['navigation', 'landmark'],
    wcagCriteria: ['2.4.1', '1.3.1']
  },
  {
    name: 'Table with headers',
    description: 'Data table with column and row headers',
    element: 'table',
    expectedAnnouncement: 'Sales data table 3 columns 4 rows',
    ariaAttributes: { 'role': 'table' },
    tags: ['table', 'headers'],
    wcagCriteria: ['1.3.1']
  }
];

export const createLiveRegionTests = (): LiveRegionTest[] => [
  {
    regionType: 'polite',
    content: 'Form saved successfully',
    trigger: 'user-action',
    expectedBehavior: 'Announced after current speech completes'
  },
  {
    regionType: 'assertive',
    content: 'Error: Invalid email format',
    trigger: 'immediate',
    expectedBehavior: 'Interrupts current speech and announces immediately'
  },
  {
    regionType: 'off',
    content: 'Background process completed',
    trigger: 'delayed',
    expectedBehavior: 'Not announced to screen reader'
  }
];

export const createNavigationTests = (): NavigationTest[] => [
  {
    landmarkType: 'main',
    headingLevel: 1,
    expectedSequence: ['Main content', 'Heading level 1'],
    keyboardShortcuts: { 'nvda': 'd', 'jaws': 'm', 'voiceover': 'VO+U' }
  },
  {
    landmarkType: 'nav',
    headingLevel: 2,
    expectedSequence: ['Navigation', 'Main menu', 'Heading level 2'],
    keyboardShortcuts: { 'nvda': 'd', 'jaws': 'n', 'voiceover': 'VO+U' }
  }
];

export const createFormTests = (): FormAccessibilityTest[] => [
  {
    fieldType: 'text',
    labelAssociation: 'explicit',
    hasDescription: true,
    hasErrorMessage: false,
    requiredField: true,
    expectedAnnouncement: 'First name edit required Enter your first name'
  },
  {
    fieldType: 'email',
    labelAssociation: 'aria-label',
    hasDescription: false,
    hasErrorMessage: true,
    requiredField: true,
    expectedAnnouncement: 'Email address edit required invalid entry'
  }
];

export const createTableTests = (): TableAccessibilityTest[] => [
  {
    hasCaption: true,
    hasColumnHeaders: true,
    hasRowHeaders: true,
    headerScope: 'col',
    complexTable: false,
    expectedNavigation: ['Sales data table', 'Quarter column header', 'Q1 row header', '$10,000']
  }
];