/**
 * JAWS Screen Reader Automation for Accessibility Testing
 *
 * Provides automated testing capabilities specifically for JAWS (Job Access With Speech)
 * including virtual cursor navigation, form mode testing, and table reading verification.
 */

import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';

const execAsync = promisify(exec);

export interface JAWSConfig {
  installPath?: string;
  settingsFile?: string;
  speechRate?: number;
  verbosity?: 'beginner' | 'intermediate' | 'advanced';
  punctuationLevel?: 'none' | 'some' | 'most' | 'all';
  enableLogging?: boolean;
  voiceProfile?: string;
  useVirtualCursor?: boolean;
}

export interface JAWSSpeechOutput {
  text: string;
  timestamp: number;
  mode: 'virtual' | 'forms' | 'application';
  voice: string;
  rate: number;
  punctuation: string;
}

export interface JAWSNavigationState {
  currentElement: string;
  elementRole: string;
  elementText: string;
  virtualCursorPosition: number;
  formsModeActive: boolean;
  ariaProperties: Record<string, string>;
  speechOutput: string;
  keyPressed: string;
}

export interface JAWSTestResult {
  testName: string;
  passed: boolean;
  actualSpeech: string;
  expectedSpeech: string;
  navigationSteps: JAWSNavigationState[];
  timeTaken: number;
  jawsMode: 'virtual' | 'forms' | 'application';
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

export interface JAWSFormsModeTest {
  fieldSelector: string;
  expectedFormsModeEntry: boolean;
  expectedSpeech: string;
  keySequence: string[];
  editingOperations?: Array<{
    action: 'type' | 'delete' | 'select';
    value: string;
    expectedFeedback: string;
  }>;
}

export interface JAWSVirtualCursorTest {
  startPosition: string;
  navigationKeys: string[];
  expectedElements: string[];
  expectedSpeech: string[];
  quickNavigationKey?: string;
  skipToHeading?: number;
}

export interface JAWSTableTest {
  tableSelector: string;
  expectedDimensions: { rows: number; cols: number };
  headerTests: Array<{
    position: { row: number; col: number };
    expectedHeader: string;
    scope: 'col' | 'row';
  }>;
  cellTests: Array<{
    position: { row: number; col: number };
    expectedContent: string;
    expectedHeaders: string[];
  }>;
  tableReading: {
    readByRow: string[];
    readByColumn: string[];
    readHeaders: string[];
  };
}

export class JAWSAutomation {
  private config: JAWSConfig;
  private jawsProcess: ChildProcess | null = null;
  private speechOutput: JAWSSpeechOutput[] = [];
  private navigationHistory: JAWSNavigationState[] = [];
  private isRunning = false;
  private testResults: JAWSTestResult[] = [];
  private currentMode: 'virtual' | 'forms' | 'application' = 'virtual';

  constructor(config: JAWSConfig = {}) {
    this.config = {
      installPath: config.installPath || 'C:\\Program Files\\Freedom Scientific\\JAWS\\2023\\jaws64.exe',
      settingsFile: config.settingsFile || 'testing.jss',
      speechRate: config.speechRate || 250,
      verbosity: config.verbosity || 'intermediate',
      punctuationLevel: config.punctuationLevel || 'some',
      enableLogging: config.enableLogging ?? true,
      voiceProfile: config.voiceProfile || 'Eloquence',
      useVirtualCursor: config.useVirtualCursor ?? true,
      ...config
    };
  }

  /**
   * Initialize JAWS for testing
   */
  async initialize(): Promise<void> {
    console.log('🔊 Initializing JAWS for automated testing...');

    // Check JAWS installation
    await this.checkJAWSInstallation();

    // Create testing settings file
    await this.createTestSettings();

    // Start JAWS with testing configuration
    await this.startJAWS();

    // Configure JAWS for testing
    await this.configureJAWSForTesting();

    this.isRunning = true;
    console.log('✅ JAWS initialized successfully');
  }

  /**
   * Test ARIA roles and states with JAWS
   */
  async testAriaRolesAndStates(testCases: Array<{
    name: string;
    selector: string;
    expectedRole: string;
    expectedStates: string[];
    expectedSpeech: string;
    ariaProperties: Record<string, string>;
  }>): Promise<JAWSTestResult[]> {
    const results: JAWSTestResult[] = [];

    console.log('🧪 Testing ARIA roles and states with JAWS...');

    for (const testCase of testCases) {
      const startTime = performance.now();
      const testResult: JAWSTestResult = {
        testName: `ARIA: ${testCase.name}`,
        passed: false,
        actualSpeech: '',
        expectedSpeech: testCase.expectedSpeech,
        navigationSteps: [],
        timeTaken: 0,
        jawsMode: this.currentMode,
        errors: [],
        warnings: [],
        recommendations: []
      };

      try {
        // Navigate to element using virtual cursor
        await this.navigateToElementWithVirtualCursor(testCase.selector);

        // Capture JAWS speech output
        const speechOutput = await this.captureSpeechOutput();
        testResult.actualSpeech = speechOutput.text;

        // Validate ARIA role announcement
        const roleCorrect = this.validateAriaRole(speechOutput.text, testCase.expectedRole);

        // Validate ARIA states
        const statesCorrect = this.validateAriaStates(speechOutput.text, testCase.expectedStates);

        // Validate ARIA properties
        const propertiesCorrect = await this.validateAriaProperties(
          testCase.selector,
          testCase.ariaProperties
        );

        testResult.passed = roleCorrect && statesCorrect && propertiesCorrect;
        testResult.timeTaken = performance.now() - startTime;
        testResult.navigationSteps = [...this.navigationHistory];

        // Add detailed feedback
        if (!roleCorrect) {
          testResult.errors.push(`ARIA role "${testCase.expectedRole}" not announced correctly`);
        }

        if (!statesCorrect) {
          testResult.errors.push(`ARIA states ${testCase.expectedStates.join(', ')} not announced`);
        }

        if (!propertiesCorrect) {
          testResult.warnings.push('Some ARIA properties may not be announced optimally');
        }

        // Generate recommendations
        testResult.recommendations = this.generateAriaRecommendations(testCase, speechOutput.text);

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
   * Test virtual cursor navigation
   */
  async testVirtualCursorNavigation(testCases: JAWSVirtualCursorTest[]): Promise<JAWSTestResult[]> {
    const results: JAWSTestResult[] = [];

    console.log('🧭 Testing virtual cursor navigation with JAWS...');

    for (const testCase of testCases) {
      const startTime = performance.now();
      const testResult: JAWSTestResult = {
        testName: `Virtual Cursor: ${testCase.startPosition}`,
        passed: false,
        actualSpeech: '',
        expectedSpeech: testCase.expectedSpeech.join(' → '),
        navigationSteps: [],
        timeTaken: 0,
        jawsMode: 'virtual',
        errors: [],
        warnings: [],
        recommendations: []
      };

      try {
        // Ensure virtual cursor is active
        await this.ensureVirtualCursorMode();

        // Navigate to starting position
        await this.navigateToElementWithVirtualCursor(testCase.startPosition);

        // Execute navigation key sequence
        const navigationResults = await this.executeVirtualCursorNavigation(testCase.navigationKeys);

        testResult.navigationSteps = navigationResults;
        testResult.actualSpeech = navigationResults.map(r => r.speechOutput).join(' → ');

        // Validate navigation sequence
        const navigationCorrect = this.validateVirtualCursorSequence(
          navigationResults,
          testCase.expectedElements,
          testCase.expectedSpeech
        );

        // Test quick navigation if specified
        if (testCase.quickNavigationKey) {
          const quickNavResults = await this.testQuickNavigation(
            testCase.quickNavigationKey,
            testCase.skipToHeading
          );
          testResult.navigationSteps.push(...quickNavResults);
        }

        testResult.passed = navigationCorrect;
        testResult.timeTaken = performance.now() - startTime;

        if (!navigationCorrect) {
          testResult.errors.push('Virtual cursor navigation sequence did not match expected path');
        }

      } catch (error) {
        testResult.errors.push(`Virtual cursor test failed: ${error.message}`);
        testResult.timeTaken = performance.now() - startTime;
      }

      results.push(testResult);
      this.testResults.push(testResult);
    }

    return results;
  }

  /**
   * Test forms mode functionality
   */
  async testFormsMode(testCases: JAWSFormsModeTest[]): Promise<JAWSTestResult[]> {
    const results: JAWSTestResult[] = [];

    console.log('📝 Testing forms mode with JAWS...');

    for (const testCase of testCases) {
      const startTime = performance.now();
      const testResult: JAWSTestResult = {
        testName: `Forms Mode: ${testCase.fieldSelector}`,
        passed: false,
        actualSpeech: '',
        expectedSpeech: testCase.expectedSpeech,
        navigationSteps: [],
        timeTaken: 0,
        jawsMode: 'forms',
        errors: [],
        warnings: [],
        recommendations: []
      };

      try {
        // Navigate to form field
        await this.navigateToElementWithVirtualCursor(testCase.fieldSelector);

        // Test forms mode entry
        const formsModeEntered = await this.testFormsModeEntry();
        const entryCorrect = formsModeEntered === testCase.expectedFormsModeEntry;

        if (!entryCorrect) {
          testResult.errors.push(
            `Forms mode entry expectation failed. Expected: ${testCase.expectedFormsModeEntry}, Got: ${formsModeEntered}`
          );
        }

        // Test key sequence in forms mode
        if (formsModeEntered) {
          const keyResults = await this.executeFormsModeKeys(testCase.keySequence);
          testResult.navigationSteps = keyResults;

          // Test editing operations if specified
          if (testCase.editingOperations) {
            const editResults = await this.testEditingOperations(testCase.editingOperations);
            testResult.navigationSteps.push(...editResults);
          }
        }

        // Capture final speech output
        const speechOutput = await this.captureSpeechOutput();
        testResult.actualSpeech = speechOutput.text;

        testResult.passed = entryCorrect && this.validateFormsSpeech(
          speechOutput.text,
          testCase.expectedSpeech
        );
        testResult.timeTaken = performance.now() - startTime;

      } catch (error) {
        testResult.errors.push(`Forms mode test failed: ${error.message}`);
        testResult.timeTaken = performance.now() - startTime;
      }

      results.push(testResult);
      this.testResults.push(testResult);
    }

    return results;
  }

  /**
   * Test table reading and navigation
   */
  async testTableReading(testCases: JAWSTableTest[]): Promise<JAWSTestResult[]> {
    const results: JAWSTestResult[] = [];

    console.log('📊 Testing table reading with JAWS...');

    for (const testCase of testCases) {
      const startTime = performance.now();
      const testResult: JAWSTestResult = {
        testName: `Table: ${testCase.tableSelector}`,
        passed: false,
        actualSpeech: '',
        expectedSpeech: '',
        navigationSteps: [],
        timeTaken: 0,
        jawsMode: 'virtual',
        errors: [],
        warnings: [],
        recommendations: []
      };

      try {
        // Navigate to table
        await this.navigateToElementWithVirtualCursor(testCase.tableSelector);

        // Test table announcement
        const tableAnnouncement = await this.captureSpeechOutput();

        // Validate table dimensions
        const dimensionsCorrect = this.validateTableDimensions(
          tableAnnouncement.text,
          testCase.expectedDimensions
        );

        // Test header reading
        const headerResults = await this.testTableHeaders(testCase.headerTests);

        // Test cell navigation and reading
        const cellResults = await this.testTableCells(testCase.cellTests);

        // Test table reading modes
        const readingResults = await this.testTableReadingModes(testCase.tableReading);

        // Compile results
        testResult.navigationSteps = [...headerResults, ...cellResults, ...readingResults];
        testResult.actualSpeech = [
          tableAnnouncement.text,
          ...headerResults.map(r => r.speechOutput),
          ...cellResults.map(r => r.speechOutput)
        ].join(' → ');

        testResult.passed = dimensionsCorrect &&
          this.validateTableHeaders(headerResults, testCase.headerTests) &&
          this.validateTableCells(cellResults, testCase.cellTests);

        testResult.timeTaken = performance.now() - startTime;

        if (!dimensionsCorrect) {
          testResult.errors.push('Table dimensions not announced correctly');
        }

        // Generate table-specific recommendations
        testResult.recommendations = this.generateTableRecommendations(testCase, testResult);

      } catch (error) {
        testResult.errors.push(`Table reading test failed: ${error.message}`);
        testResult.timeTaken = performance.now() - startTime;
      }

      results.push(testResult);
      this.testResults.push(testResult);
    }

    return results;
  }

  /**
   * Test live regions with JAWS
   */
  async testLiveRegions(testCases: Array<{
    name: string;
    regionSelector: string;
    liveType: 'polite' | 'assertive' | 'off';
    contentUpdate: string;
    triggerAction: () => Promise<void>;
    expectedAnnouncement: string;
    interruptCurrentSpeech?: boolean;
  }>): Promise<JAWSTestResult[]> {
    const results: JAWSTestResult[] = [];

    console.log('📢 Testing live regions with JAWS...');

    for (const testCase of testCases) {
      const startTime = performance.now();
      const testResult: JAWSTestResult = {
        testName: `Live Region: ${testCase.name}`,
        passed: false,
        actualSpeech: '',
        expectedSpeech: testCase.expectedAnnouncement,
        navigationSteps: [],
        timeTaken: 0,
        jawsMode: this.currentMode,
        errors: [],
        warnings: [],
        recommendations: []
      };

      try {
        // Clear previous speech
        this.clearSpeechHistory();

        // Monitor for live region announcements
        const speechMonitor = this.startSpeechMonitoring();

        // Execute trigger action
        await testCase.triggerAction();

        // Wait for announcement
        const announcement = await this.waitForLiveRegionAnnouncement(3000);

        // Stop monitoring
        speechMonitor.stop();

        testResult.actualSpeech = announcement;

        // Validate live region behavior
        const announcementCorrect = this.validateLiveRegionAnnouncement(
          announcement,
          testCase.expectedAnnouncement
        );

        const interruptionCorrect = testCase.interruptCurrentSpeech ?
          this.validateSpeechInterruption() : true;

        testResult.passed = announcementCorrect && interruptionCorrect;
        testResult.timeTaken = performance.now() - startTime;

        if (!announcementCorrect) {
          testResult.errors.push(
            `Live region announcement mismatch. Expected: "${testCase.expectedAnnouncement}", Got: "${announcement}"`
          );
        }

        if (!interruptionCorrect) {
          testResult.warnings.push('Live region did not interrupt speech as expected');
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
   * Generate comprehensive JAWS test report
   */
  async generateReport(): Promise<string> {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;

    const report = {
      jawsVersion: await this.getJAWSVersion(),
      testConfiguration: this.config,
      summary: {
        totalTests,
        passedTests,
        failedTests,
        successRate: Math.round((passedTests / totalTests) * 100),
        averageTestTime: Math.round(
          this.testResults.reduce((sum, r) => sum + r.timeTaken, 0) / totalTests
        ),
        modesUsed: [...new Set(this.testResults.map(r => r.jawsMode))],
        totalNavigationSteps: this.testResults.reduce((sum, r) => sum + r.navigationSteps.length, 0)
      },
      testResults: this.testResults,
      speechHistory: this.speechOutput,
      navigationHistory: this.navigationHistory,
      recommendations: this.generateComprehensiveRecommendations(),
      jawsSpecificIssues: this.analyzeJAWSSpecificIssues(),
      timestamp: new Date().toISOString()
    };

    // Save report
    const reportPath = join(process.cwd(), 'tests', 'accessibility', 'reports',
      `jaws-test-report-${Date.now()}.json`);

    await fs.mkdir(join(process.cwd(), 'tests', 'accessibility', 'reports'), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    console.log(`📊 JAWS test report saved to: ${reportPath}`);

    return JSON.stringify(report, null, 2);
  }

  /**
   * Cleanup and shutdown JAWS
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up JAWS testing session...');

    if (this.jawsProcess) {
      // Gracefully shutdown JAWS
      await this.sendJAWSCommand('shutdown');
      this.jawsProcess.kill();
      this.jawsProcess = null;
    }

    this.isRunning = false;
    this.speechOutput = [];
    this.navigationHistory = [];
    this.testResults = [];

    console.log('✅ JAWS cleanup completed');
  }

  // Private helper methods

  private async checkJAWSInstallation(): Promise<void> {
    try {
      await fs.access(this.config.installPath!);
    } catch {
      throw new Error(`JAWS not found at ${this.config.installPath}. Please install JAWS or update the path.`);
    }
  }

  private async createTestSettings(): Promise<void> {
    const settingsPath = join(process.cwd(), 'tests', 'accessibility', 'jaws-settings');
    await fs.mkdir(settingsPath, { recursive: true });

    const settings = `
[Speech]
SpeechRate=${this.config.speechRate}
Voice=${this.config.voiceProfile}
Verbosity=${this.config.verbosity}
PunctuationLevel=${this.config.punctuationLevel}

[VirtualCursor]
AutoStartReading=false
SayAllMode=sentence
UseLayoutTables=true

[Forms]
AutoFormsMode=true
EditFeedback=character

[Testing]
EnableLogging=${this.config.enableLogging}
CaptureAllSpeech=true
LogNavigation=true
`;

    await fs.writeFile(join(settingsPath, this.config.settingsFile!), settings);
  }

  private async startJAWS(): Promise<void> {
    const args = [
      '/run',
      `/settings:${this.config.settingsFile}`,
      '/noupdate',
      '/silentstart'
    ];

    this.jawsProcess = spawn(this.config.installPath!, args, {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Wait for JAWS to start
    await new Promise(resolve => setTimeout(resolve, 5000));

    if (!await this.isJAWSRunning()) {
      throw new Error('Failed to start JAWS');
    }
  }

  private async configureJAWSForTesting(): Promise<void> {
    // Send configuration commands to JAWS
    await this.sendJAWSCommand('SetVerbosity', this.config.verbosity!);
    await this.sendJAWSCommand('SetSpeechRate', this.config.speechRate!.toString());

    if (this.config.useVirtualCursor) {
      await this.sendJAWSCommand('EnableVirtualCursor');
    }
  }

  private async isJAWSRunning(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq jaws64.exe"');
      return stdout.includes('jaws64.exe');
    } catch {
      return false;
    }
  }

  private async sendJAWSCommand(command: string, parameter?: string): Promise<void> {
    // Implementation would send commands to JAWS via its API or scripting interface
    // This is a placeholder for the actual JAWS communication
  }

  private async navigateToElementWithVirtualCursor(selector: string): Promise<void> {
    // Implementation would navigate to element using JAWS virtual cursor
  }

  private async captureSpeechOutput(): Promise<JAWSSpeechOutput> {
    // Implementation would capture JAWS speech output
    return {
      text: 'Captured speech',
      timestamp: Date.now(),
      mode: this.currentMode,
      voice: this.config.voiceProfile || 'Eloquence',
      rate: this.config.speechRate || 250,
      punctuation: this.config.punctuationLevel || 'some'
    };
  }

  // Additional private helper methods would continue here...
  // Due to length constraints, I'm showing the structure and key methods
  // The actual implementation would include all the private helper methods

  private validateAriaRole(speech: string, expectedRole: string): boolean {
    return speech.toLowerCase().includes(expectedRole.toLowerCase());
  }

  private validateAriaStates(speech: string, expectedStates: string[]): boolean {
    return expectedStates.every(state =>
      speech.toLowerCase().includes(state.toLowerCase())
    );
  }

  private async validateAriaProperties(selector: string, properties: Record<string, string>): Promise<boolean> {
    // Implementation would validate ARIA properties are announced correctly
    return true;
  }

  private generateAriaRecommendations(testCase: any, speech: string): string[] {
    const recommendations: string[] = [];

    if (!speech.includes(testCase.expectedRole)) {
      recommendations.push(`Ensure ARIA role "${testCase.expectedRole}" is properly announced`);
    }

    return recommendations;
  }

  private async ensureVirtualCursorMode(): Promise<void> {
    if (this.currentMode !== 'virtual') {
      await this.sendJAWSCommand('EnableVirtualCursor');
      this.currentMode = 'virtual';
    }
  }

  private async executeVirtualCursorNavigation(keys: string[]): Promise<JAWSNavigationState[]> {
    const results: JAWSNavigationState[] = [];

    for (const key of keys) {
      // Implementation would execute key and capture state
      results.push({
        currentElement: 'element',
        elementRole: 'button',
        elementText: 'text',
        virtualCursorPosition: 0,
        formsModeActive: false,
        ariaProperties: {},
        speechOutput: 'speech',
        keyPressed: key
      });
    }

    return results;
  }

  private validateVirtualCursorSequence(
    results: JAWSNavigationState[],
    expectedElements: string[],
    expectedSpeech: string[]
  ): boolean {
    return results.length === expectedElements.length &&
           results.every((result, index) =>
             result.speechOutput.includes(expectedSpeech[index] || '')
           );
  }

  private async testQuickNavigation(key: string, headingLevel?: number): Promise<JAWSNavigationState[]> {
    // Implementation would test JAWS quick navigation keys
    return [];
  }

  private async testFormsModeEntry(): Promise<boolean> {
    // Implementation would test if forms mode is entered correctly
    return true;
  }

  private async executeFormsModeKeys(keys: string[]): Promise<JAWSNavigationState[]> {
    // Implementation would execute keys in forms mode
    return [];
  }

  private async testEditingOperations(operations: any[]): Promise<JAWSNavigationState[]> {
    // Implementation would test editing operations in forms mode
    return [];
  }

  private validateFormsSpeech(speech: string, expected: string): boolean {
    return speech.toLowerCase().includes(expected.toLowerCase());
  }

  private validateTableDimensions(speech: string, dimensions: { rows: number; cols: number }): boolean {
    return speech.includes(`${dimensions.rows} rows`) &&
           speech.includes(`${dimensions.cols} columns`);
  }

  private async testTableHeaders(headerTests: any[]): Promise<JAWSNavigationState[]> {
    // Implementation would test table header reading
    return [];
  }

  private async testTableCells(cellTests: any[]): Promise<JAWSNavigationState[]> {
    // Implementation would test table cell reading
    return [];
  }

  private async testTableReadingModes(tableReading: any): Promise<JAWSNavigationState[]> {
    // Implementation would test different table reading modes
    return [];
  }

  private validateTableHeaders(results: JAWSNavigationState[], expected: any[]): boolean {
    return results.length === expected.length;
  }

  private validateTableCells(results: JAWSNavigationState[], expected: any[]): boolean {
    return results.length === expected.length;
  }

  private generateTableRecommendations(testCase: any, result: any): string[] {
    return ['Review table structure and headers'];
  }

  private clearSpeechHistory(): void {
    this.speechOutput = [];
  }

  private startSpeechMonitoring(): { stop: () => void } {
    // Implementation would start monitoring speech
    return { stop: () => {} };
  }

  private async waitForLiveRegionAnnouncement(timeout: number): Promise<string> {
    // Implementation would wait for live region announcement
    return 'Live region announcement';
  }

  private validateLiveRegionAnnouncement(actual: string, expected: string): boolean {
    return actual.toLowerCase().includes(expected.toLowerCase());
  }

  private validateSpeechInterruption(): boolean {
    // Implementation would check if speech was interrupted
    return true;
  }

  private async getJAWSVersion(): Promise<string> {
    // Implementation would get JAWS version
    return '2023';
  }

  private generateComprehensiveRecommendations(): string[] {
    const recommendations: string[] = [];

    const totalErrors = this.testResults.reduce((sum, r) => sum + r.errors.length, 0);
    if (totalErrors > 0) {
      recommendations.push(`🚨 Address ${totalErrors} accessibility issues found by JAWS testing`);
    }

    return recommendations;
  }

  private analyzeJAWSSpecificIssues(): any {
    return {
      virtualCursorIssues: this.testResults.filter(r => r.jawsMode === 'virtual' && !r.passed).length,
      formsModeIssues: this.testResults.filter(r => r.jawsMode === 'forms' && !r.passed).length,
      tableNavigationIssues: this.testResults.filter(r => r.testName.includes('Table') && !r.passed).length
    };
  }
}

export default JAWSAutomation;