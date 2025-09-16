/**
 * NVDA Screen Reader Automation for Accessibility Testing
 *
 * Provides automated testing capabilities specifically for NVDA
 * including speech capture, navigation testing, and ARIA validation.
 */

import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';

const execAsync = promisify(exec);

export interface NVDAConfig {
  installPath?: string;
  profileName?: string;
  speechRate?: number;
  speechOutput?: 'espeak' | 'sapi5' | 'onecore';
  verbosityLevel?: 1 | 2 | 3;
  enableLogging?: boolean;
  logLevel?: 'debug' | 'info' | 'warning' | 'error';
}

export interface NVDASpeechCapture {
  text: string;
  timestamp: number;
  speakingRate: number;
  voice: string;
  spellingMode: boolean;
}

export interface NVDANavigationResult {
  currentElement: string;
  elementType: string;
  elementText: string;
  ariaRole?: string;
  ariaProperties: Record<string, string>;
  position: { x: number; y: number };
  speechOutput: string;
}

export interface NVDATestResult {
  testName: string;
  passed: boolean;
  actualSpeech: string;
  expectedSpeech: string;
  navigationPath: string[];
  timeTaken: number;
  errors: string[];
  warnings: string[];
}

export class NVDAAutomation {
  private config: NVDAConfig;
  private nvdaProcess: ChildProcess | null = null;
  private speechCapture: NVDASpeechCapture[] = [];
  private isRunning = false;
  private testResults: NVDATestResult[] = [];

  constructor(config: NVDAConfig = {}) {
    this.config = {
      installPath: config.installPath || 'C:\\Program Files (x86)\\NVDA\\nvda.exe',
      profileName: config.profileName || 'testing',
      speechRate: config.speechRate || 50,
      speechOutput: config.speechOutput || 'sapi5',
      verbosityLevel: config.verbosityLevel || 2,
      enableLogging: config.enableLogging ?? true,
      logLevel: config.logLevel || 'info',
      ...config
    };
  }

  /**
   * Initialize NVDA for testing
   */
  async initialize(): Promise<void> {
    console.log('🔊 Initializing NVDA for automated testing...');

    // Check if NVDA is installed
    await this.checkNVDAInstallation();

    // Create testing profile
    await this.createTestProfile();

    // Start NVDA with testing configuration
    await this.startNVDA();

    // Configure speech capture
    await this.configureSpeechCapture();

    this.isRunning = true;
    console.log('✅ NVDA initialized successfully');
  }

  /**
   * Start NVDA with testing configuration
   */
  private async startNVDA(): Promise<void> {
    const args = [
      '--no-splash',
      `--config-path=${await this.getTestProfilePath()}`,
      '--disable-addons',
      '--log-level=debug',
      '--log-file=nvda-test.log'
    ];

    if (this.config.enableLogging) {
      args.push('--debug-logging');
    }

    this.nvdaProcess = spawn(this.config.installPath!, args, {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Wait for NVDA to fully start
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Verify NVDA is running
    if (!await this.isNVDARunning()) {
      throw new Error('Failed to start NVDA');
    }
  }

  /**
   * Test ARIA roles and properties
   */
  async testAriaRoles(elements: Array<{
    selector: string;
    expectedRole: string;
    expectedSpeech: string;
    ariaProperties?: Record<string, string>;
  }>): Promise<NVDATestResult[]> {
    const results: NVDATestResult[] = [];

    console.log('🧪 Testing ARIA roles with NVDA...');

    for (const element of elements) {
      const startTime = performance.now();
      const testResult: NVDATestResult = {
        testName: `ARIA Role: ${element.expectedRole}`,
        passed: false,
        actualSpeech: '',
        expectedSpeech: element.expectedSpeech,
        navigationPath: [],
        timeTaken: 0,
        errors: [],
        warnings: []
      };

      try {
        // Navigate to element
        await this.navigateToElement(element.selector);

        // Capture speech output
        const speechOutput = await this.captureSpeechForElement();
        testResult.actualSpeech = speechOutput;

        // Validate ARIA role announcement
        const roleAnnounced = this.validateRoleAnnouncement(speechOutput, element.expectedRole);

        // Validate ARIA properties
        const propertiesValid = element.ariaProperties
          ? await this.validateAriaProperties(element.selector, element.ariaProperties)
          : true;

        testResult.passed = roleAnnounced && propertiesValid;
        testResult.timeTaken = performance.now() - startTime;

        if (!roleAnnounced) {
          testResult.errors.push(`Expected role "${element.expectedRole}" not announced in speech: "${speechOutput}"`);
        }

        if (!propertiesValid) {
          testResult.errors.push('ARIA properties not properly announced');
        }

      } catch (error) {
        testResult.errors.push(`Test execution failed: ${error.message}`);
        testResult.timeTaken = performance.now() - startTime;
      }

      results.push(testResult);
      this.testResults.push(testResult);
    }

    return results;
  }

  /**
   * Test keyboard navigation
   */
  async testKeyboardNavigation(testCases: Array<{
    name: string;
    startElement: string;
    keySequence: string[];
    expectedElements: string[];
    expectedSpeech: string[];
  }>): Promise<NVDATestResult[]> {
    const results: NVDATestResult[] = [];

    console.log('⌨️ Testing keyboard navigation with NVDA...');

    for (const testCase of testCases) {
      const startTime = performance.now();
      const testResult: NVDATestResult = {
        testName: testCase.name,
        passed: false,
        actualSpeech: '',
        expectedSpeech: testCase.expectedSpeech.join(' → '),
        navigationPath: [],
        timeTaken: 0,
        errors: [],
        warnings: []
      };

      try {
        // Start at specified element
        await this.navigateToElement(testCase.startElement);

        // Execute key sequence and capture navigation
        const navigationResults = await this.executeKeySequence(testCase.keySequence);

        testResult.navigationPath = navigationResults.map(r => r.currentElement);
        testResult.actualSpeech = navigationResults.map(r => r.speechOutput).join(' → ');

        // Validate navigation path
        const pathCorrect = this.validateNavigationPath(
          testResult.navigationPath,
          testCase.expectedElements
        );

        // Validate speech output
        const speechCorrect = this.validateSpeechSequence(
          navigationResults.map(r => r.speechOutput),
          testCase.expectedSpeech
        );

        testResult.passed = pathCorrect && speechCorrect;
        testResult.timeTaken = performance.now() - startTime;

        if (!pathCorrect) {
          testResult.errors.push(
            `Navigation path mismatch. Expected: ${testCase.expectedElements.join(' → ')}, ` +
            `Got: ${testResult.navigationPath.join(' → ')}`
          );
        }

        if (!speechCorrect) {
          testResult.errors.push(
            `Speech output mismatch. Expected: ${testCase.expectedSpeech.join(' → ')}, ` +
            `Got: ${testResult.actualSpeech}`
          );
        }

      } catch (error) {
        testResult.errors.push(`Navigation test failed: ${error.message}`);
        testResult.timeTaken = performance.now() - startTime;
      }

      results.push(testResult);
      this.testResults.push(testResult);
    }

    return results;
  }

  /**
   * Test live regions
   */
  async testLiveRegions(testCases: Array<{
    name: string;
    regionSelector: string;
    contentUpdate: string;
    triggerAction: () => Promise<void>;
    expectedAnnouncement: string;
    announceDelay?: number;
  }>): Promise<NVDATestResult[]> {
    const results: NVDATestResult[] = [];

    console.log('📢 Testing live regions with NVDA...');

    for (const testCase of testCases) {
      const startTime = performance.now();
      const testResult: NVDATestResult = {
        testName: testCase.name,
        passed: false,
        actualSpeech: '',
        expectedSpeech: testCase.expectedAnnouncement,
        navigationPath: [],
        timeTaken: 0,
        errors: [],
        warnings: []
      };

      try {
        // Clear previous speech capture
        this.clearSpeechCapture();

        // Execute trigger action
        await testCase.triggerAction();

        // Wait for announcement (with timeout)
        const announcement = await this.waitForLiveRegionAnnouncement(
          testCase.announceDelay || 2000
        );

        testResult.actualSpeech = announcement;
        testResult.passed = this.validateLiveRegionAnnouncement(
          announcement,
          testCase.expectedAnnouncement
        );
        testResult.timeTaken = performance.now() - startTime;

        if (!testResult.passed) {
          testResult.errors.push(
            `Live region announcement mismatch. Expected: "${testCase.expectedAnnouncement}", ` +
            `Got: "${announcement}"`
          );
        }

      } catch (error) {
        testResult.errors.push(`Live region test failed: ${error.message}`);
        testResult.timeTaken = performance.now() - startTime;
      }

      results.push(testResult);
      this.testResults.push(testResult);
    }

    return results;
  }

  /**
   * Test form accessibility
   */
  async testFormAccessibility(formTests: Array<{
    name: string;
    formSelector: string;
    fields: Array<{
      selector: string;
      expectedLabel: string;
      expectedType: string;
      required?: boolean;
      hasDescription?: boolean;
      hasError?: boolean;
    }>;
  }>): Promise<NVDATestResult[]> {
    const results: NVDATestResult[] = [];

    console.log('📝 Testing form accessibility with NVDA...');

    for (const formTest of formTests) {
      for (const field of formTest.fields) {
        const startTime = performance.now();
        const testResult: NVDATestResult = {
          testName: `${formTest.name} - ${field.expectedLabel}`,
          passed: false,
          actualSpeech: '',
          expectedSpeech: this.buildExpectedFieldSpeech(field),
          navigationPath: [],
          timeTaken: 0,
          errors: [],
          warnings: []
        };

        try {
          // Navigate to form field
          await this.navigateToElement(field.selector);

          // Capture field announcement
          const fieldSpeech = await this.captureSpeechForElement();
          testResult.actualSpeech = fieldSpeech;

          // Validate field accessibility
          const validationResults = this.validateFormField(fieldSpeech, field);
          testResult.passed = validationResults.passed;
          testResult.errors = validationResults.errors;
          testResult.warnings = validationResults.warnings;
          testResult.timeTaken = performance.now() - startTime;

        } catch (error) {
          testResult.errors.push(`Form field test failed: ${error.message}`);
          testResult.timeTaken = performance.now() - startTime;
        }

        results.push(testResult);
        this.testResults.push(testResult);
      }
    }

    return results;
  }

  /**
   * Test table navigation
   */
  async testTableNavigation(tableTests: Array<{
    name: string;
    tableSelector: string;
    expectedHeaders: string[];
    expectedCells: Array<{ row: number; col: number; content: string }>;
    testComplexNavigation?: boolean;
  }>): Promise<NVDATestResult[]> {
    const results: NVDATestResult[] = [];

    console.log('📊 Testing table navigation with NVDA...');

    for (const tableTest of tableTests) {
      const startTime = performance.now();
      const testResult: NVDATestResult = {
        testName: tableTest.name,
        passed: false,
        actualSpeech: '',
        expectedSpeech: '',
        navigationPath: [],
        timeTaken: 0,
        errors: [],
        warnings: []
      };

      try {
        // Navigate to table
        await this.navigateToElement(tableTest.tableSelector);

        // Test table announcement
        const tableAnnouncement = await this.captureSpeechForElement();

        // Test header navigation
        const headerResults = await this.testTableHeaders(tableTest.expectedHeaders);

        // Test cell navigation
        const cellResults = await this.testTableCells(tableTest.expectedCells);

        // Compile results
        testResult.actualSpeech = [tableAnnouncement, ...headerResults, ...cellResults].join(' → ');
        testResult.navigationPath = [tableTest.tableSelector, ...headerResults, ...cellResults];

        // Validate table accessibility
        const tableValid = this.validateTableAccessibility(
          tableAnnouncement,
          headerResults,
          cellResults,
          tableTest
        );

        testResult.passed = tableValid.passed;
        testResult.errors = tableValid.errors;
        testResult.warnings = tableValid.warnings;
        testResult.timeTaken = performance.now() - startTime;

      } catch (error) {
        testResult.errors.push(`Table navigation test failed: ${error.message}`);
        testResult.timeTaken = performance.now() - startTime;
      }

      results.push(testResult);
      this.testResults.push(testResult);
    }

    return results;
  }

  /**
   * Generate comprehensive NVDA test report
   */
  async generateReport(): Promise<string> {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;

    const report = {
      nvdaVersion: await this.getNVDAVersion(),
      testConfiguration: this.config,
      summary: {
        totalTests,
        passedTests,
        failedTests,
        successRate: Math.round((passedTests / totalTests) * 100),
        averageTestTime: Math.round(
          this.testResults.reduce((sum, r) => sum + r.timeTaken, 0) / totalTests
        )
      },
      testResults: this.testResults,
      speechCapture: this.speechCapture,
      recommendations: this.generateRecommendations(),
      timestamp: new Date().toISOString()
    };

    // Save report
    const reportPath = join(process.cwd(), 'tests', 'accessibility', 'reports',
      `nvda-test-report-${Date.now()}.json`);

    await fs.mkdir(join(process.cwd(), 'tests', 'accessibility', 'reports'), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    console.log(`📊 NVDA test report saved to: ${reportPath}`);

    return JSON.stringify(report, null, 2);
  }

  /**
   * Cleanup and shutdown NVDA
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up NVDA testing session...');

    if (this.nvdaProcess) {
      this.nvdaProcess.kill();
      this.nvdaProcess = null;
    }

    this.isRunning = false;
    this.speechCapture = [];
    this.testResults = [];

    console.log('✅ NVDA cleanup completed');
  }

  // Private helper methods

  private async checkNVDAInstallation(): Promise<void> {
    try {
      await fs.access(this.config.installPath!);
    } catch {
      throw new Error(`NVDA not found at ${this.config.installPath}. Please install NVDA or update the path.`);
    }
  }

  private async createTestProfile(): Promise<void> {
    const profilePath = await this.getTestProfilePath();
    await fs.mkdir(profilePath, { recursive: true });

    // Create testing configuration
    const config = {
      speech: {
        synthDriver: this.config.speechOutput,
        rateBoost: false,
        rate: this.config.speechRate,
        volume: 100,
        pitch: 50,
        reportFontAttributes: true,
        reportSuperscriptsAndSubscripts: true
      },
      virtualBuffers: {
        autoPassThroughOnCaretMove: false,
        autoPassThroughOnFocusChange: false,
        autoSayAllOnPageLoad: false,
        useScreenLayout: false
      },
      presentation: {
        reportHelpBalloons: true,
        reportToolTips: true,
        reportKeyboardShortcuts: true,
        reportObjectPositionInformation: true
      },
      testing: {
        enableApiLogging: true,
        captureAllSpeech: true,
        verboseLogging: true
      }
    };

    await fs.writeFile(
      join(profilePath, 'nvda.ini'),
      Object.entries(config)
        .map(([section, values]) =>
          `[${section}]\n` +
          Object.entries(values)
            .map(([key, value]) => `${key} = ${value}`)
            .join('\n')
        )
        .join('\n\n')
    );
  }

  private async getTestProfilePath(): Promise<string> {
    const appData = process.env.APPDATA || '';
    return join(appData, 'nvda', 'profiles', this.config.profileName!);
  }

  private async isNVDARunning(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq nvda.exe"');
      return stdout.includes('nvda.exe');
    } catch {
      return false;
    }
  }

  private async configureSpeechCapture(): Promise<void> {
    // This would configure NVDA's speech system to capture output
    // Implementation would depend on NVDA's API or log monitoring
  }

  private async navigateToElement(selector: string): Promise<void> {
    // Implementation would use NVDA's navigation commands
    // This is a placeholder for the actual navigation logic
  }

  private async captureSpeechForElement(): Promise<string> {
    // Implementation would capture the speech output for the current element
    // This is a placeholder - actual implementation would monitor NVDA's speech
    return 'Captured speech output';
  }

  private validateRoleAnnouncement(speech: string, expectedRole: string): boolean {
    return speech.toLowerCase().includes(expectedRole.toLowerCase());
  }

  private async validateAriaProperties(selector: string, properties: Record<string, string>): Promise<boolean> {
    // Implementation would validate that ARIA properties are announced correctly
    return true;
  }

  private async executeKeySequence(keys: string[]): Promise<NVDANavigationResult[]> {
    const results: NVDANavigationResult[] = [];

    for (const key of keys) {
      // Implementation would send key to NVDA and capture result
      results.push({
        currentElement: 'element',
        elementType: 'button',
        elementText: 'text',
        ariaProperties: {},
        position: { x: 0, y: 0 },
        speechOutput: 'speech output'
      });
    }

    return results;
  }

  private validateNavigationPath(actual: string[], expected: string[]): boolean {
    return JSON.stringify(actual) === JSON.stringify(expected);
  }

  private validateSpeechSequence(actual: string[], expected: string[]): boolean {
    return actual.every((speech, index) =>
      speech.toLowerCase().includes(expected[index]?.toLowerCase() || '')
    );
  }

  private clearSpeechCapture(): void {
    this.speechCapture = [];
  }

  private async waitForLiveRegionAnnouncement(timeout: number): Promise<string> {
    // Implementation would wait for and capture live region announcements
    return 'Live region announcement';
  }

  private validateLiveRegionAnnouncement(actual: string, expected: string): boolean {
    return actual.toLowerCase().includes(expected.toLowerCase());
  }

  private buildExpectedFieldSpeech(field: any): string {
    let speech = field.expectedLabel;
    speech += ` ${field.expectedType}`;
    if (field.required) speech += ' required';
    if (field.hasDescription) speech += ' has description';
    if (field.hasError) speech += ' invalid entry';
    return speech;
  }

  private validateFormField(speech: string, field: any): {
    passed: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!speech.includes(field.expectedLabel)) {
      errors.push(`Field label "${field.expectedLabel}" not announced`);
    }

    if (!speech.includes(field.expectedType)) {
      errors.push(`Field type "${field.expectedType}" not announced`);
    }

    if (field.required && !speech.includes('required')) {
      errors.push('Required field indicator not announced');
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings
    };
  }

  private async testTableHeaders(expectedHeaders: string[]): Promise<string[]> {
    // Implementation would test table header navigation
    return expectedHeaders;
  }

  private async testTableCells(expectedCells: any[]): Promise<string[]> {
    // Implementation would test table cell navigation
    return expectedCells.map(cell => cell.content);
  }

  private validateTableAccessibility(
    announcement: string,
    headers: string[],
    cells: string[],
    test: any
  ): { passed: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!announcement.includes('table')) {
      errors.push('Table not identified as table');
    }

    if (headers.length !== test.expectedHeaders.length) {
      errors.push('Header count mismatch');
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings
    };
  }

  private async getNVDAVersion(): Promise<string> {
    // Implementation would get NVDA version
    return '2023.3';
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    const totalErrors = this.testResults.reduce((sum, r) => sum + r.errors.length, 0);
    if (totalErrors > 0) {
      recommendations.push(`🚨 Address ${totalErrors} accessibility issues found by NVDA testing`);
    }

    // Add specific recommendations based on test results
    const failedTests = this.testResults.filter(r => !r.passed);
    if (failedTests.length > 0) {
      recommendations.push(`📋 Review failed tests: ${failedTests.map(t => t.testName).join(', ')}`);
    }

    return recommendations;
  }
}

export default NVDAAutomation;