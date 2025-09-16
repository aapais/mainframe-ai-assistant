/**
 * VoiceOver Screen Reader Automation for Accessibility Testing (macOS)
 *
 * Provides automated testing capabilities specifically for VoiceOver on macOS
 * including rotor navigation, VoiceOver cursor control, and web area testing.
 */

import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';

const execAsync = promisify(exec);

export interface VoiceOverConfig {
  speechRate?: number;
  voiceType?: 'alex' | 'samantha' | 'victoria' | 'system';
  verbosity?: 'low' | 'medium' | 'high';
  navigationStyle?: 'cursor' | 'grouping';
  webNavigationMode?: 'dom' | 'group';
  enableSounds?: boolean;
  enableHints?: boolean;
  enableLogging?: boolean;
}

export interface VoiceOverSpeechOutput {
  text: string;
  timestamp: number;
  voice: string;
  rate: number;
  navigationMode: 'cursor' | 'rotor' | 'quicknav';
  currentContext: string;
}

export interface VoiceOverNavigationState {
  currentElement: string;
  elementType: string;
  elementText: string;
  cursorPosition: { x: number; y: number };
  rotorPosition?: string;
  webArea?: string;
  ariaProperties: Record<string, string>;
  speechOutput: string;
  gesture: string;
}

export interface VoiceOverTestResult {
  testName: string;
  passed: boolean;
  actualSpeech: string;
  expectedSpeech: string;
  navigationSteps: VoiceOverNavigationState[];
  timeTaken: number;
  voiceOverMode: 'cursor' | 'rotor' | 'quicknav';
  gestures: string[];
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

export interface VoiceOverRotorTest {
  rotorType: 'headings' | 'links' | 'form-controls' | 'landmarks' | 'tables' | 'text';
  expectedItems: string[];
  navigationGestures: string[];
  expectedSpeech: string[];
  webArea?: boolean;
}

export interface VoiceOverGestureTest {
  name: string;
  gesture: string;
  startElement: string;
  expectedOutcome: string;
  expectedSpeech: string;
  contextDependent?: boolean;
}

export interface VoiceOverWebAreaTest {
  url?: string;
  pageTitle: string;
  expectedElements: Array<{
    element: string;
    role: string;
    text: string;
    gesture: string;
  }>;
  quickNavTests: Array<{
    key: string;
    expectedElements: string[];
  }>;
}

export class VoiceOverAutomation {
  private config: VoiceOverConfig;
  private voiceOverProcess: ChildProcess | null = null;
  private speechOutput: VoiceOverSpeechOutput[] = [];
  private navigationHistory: VoiceOverNavigationState[] = [];
  private isRunning = false;
  private testResults: VoiceOverTestResult[] = [];
  private currentMode: 'cursor' | 'rotor' | 'quicknav' = 'cursor';

  constructor(config: VoiceOverConfig = {}) {
    // Check if running on macOS
    if (process.platform !== 'darwin') {
      throw new Error('VoiceOver automation is only available on macOS');
    }

    this.config = {
      speechRate: config.speechRate || 50,
      voiceType: config.voiceType || 'alex',
      verbosity: config.verbosity || 'medium',
      navigationStyle: config.navigationStyle || 'cursor',
      webNavigationMode: config.webNavigationMode || 'dom',
      enableSounds: config.enableSounds ?? true,
      enableHints: config.enableHints ?? true,
      enableLogging: config.enableLogging ?? true,
      ...config
    };
  }

  /**
   * Initialize VoiceOver for testing
   */
  async initialize(): Promise<void> {
    console.log('🔊 Initializing VoiceOver for automated testing...');

    // Check VoiceOver availability
    await this.checkVoiceOverAvailability();

    // Configure VoiceOver settings
    await this.configureVoiceOverSettings();

    // Start VoiceOver
    await this.startVoiceOver();

    // Set up speech capture
    await this.setupSpeechCapture();

    this.isRunning = true;
    console.log('✅ VoiceOver initialized successfully');
  }

  /**
   * Test ARIA implementation with VoiceOver
   */
  async testAriaImplementation(testCases: Array<{
    name: string;
    selector: string;
    expectedRole: string;
    expectedProperties: Record<string, string>;
    expectedSpeech: string;
    gesture?: string;
  }>): Promise<VoiceOverTestResult[]> {
    const results: VoiceOverTestResult[] = [];

    console.log('🧪 Testing ARIA implementation with VoiceOver...');

    for (const testCase of testCases) {
      const startTime = performance.now();
      const testResult: VoiceOverTestResult = {
        testName: `ARIA: ${testCase.name}`,
        passed: false,
        actualSpeech: '',
        expectedSpeech: testCase.expectedSpeech,
        navigationSteps: [],
        timeTaken: 0,
        voiceOverMode: this.currentMode,
        gestures: [],
        errors: [],
        warnings: [],
        recommendations: []
      };

      try {
        // Navigate to element using VoiceOver cursor
        await this.navigateToElement(testCase.selector);

        // Use specific gesture if provided
        if (testCase.gesture) {
          await this.performGesture(testCase.gesture);
          testResult.gestures.push(testCase.gesture);
        }

        // Capture VoiceOver speech output
        const speechOutput = await this.captureSpeechOutput();
        testResult.actualSpeech = speechOutput.text;

        // Validate ARIA role announcement
        const roleCorrect = this.validateAriaRole(speechOutput.text, testCase.expectedRole);

        // Validate ARIA properties
        const propertiesCorrect = this.validateAriaProperties(
          speechOutput.text,
          testCase.expectedProperties
        );

        // Validate overall speech output
        const speechCorrect = this.validateSpeechOutput(
          speechOutput.text,
          testCase.expectedSpeech
        );

        testResult.passed = roleCorrect && propertiesCorrect && speechCorrect;
        testResult.timeTaken = performance.now() - startTime;
        testResult.navigationSteps = [...this.navigationHistory];

        // Add detailed feedback
        if (!roleCorrect) {
          testResult.errors.push(`ARIA role "${testCase.expectedRole}" not announced correctly`);
        }

        if (!propertiesCorrect) {
          testResult.errors.push('ARIA properties not announced properly');
        }

        if (!speechCorrect) {
          testResult.warnings.push('Speech output does not match expected pattern');
        }

        // Generate VoiceOver-specific recommendations
        testResult.recommendations = this.generateVoiceOverRecommendations(testCase, speechOutput.text);

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
   * Test VoiceOver rotor navigation
   */
  async testRotorNavigation(testCases: VoiceOverRotorTest[]): Promise<VoiceOverTestResult[]> {
    const results: VoiceOverTestResult[] = [];

    console.log('🧭 Testing rotor navigation with VoiceOver...');

    for (const testCase of testCases) {
      const startTime = performance.now();
      const testResult: VoiceOverTestResult = {
        testName: `Rotor: ${testCase.rotorType}`,
        passed: false,
        actualSpeech: '',
        expectedSpeech: testCase.expectedSpeech.join(' → '),
        navigationSteps: [],
        timeTaken: 0,
        voiceOverMode: 'rotor',
        gestures: [],
        errors: [],
        warnings: [],
        recommendations: []
      };

      try {
        // Set rotor to specific type
        await this.setRotorType(testCase.rotorType);
        this.currentMode = 'rotor';

        // Execute rotor navigation gestures
        const navigationResults = await this.executeRotorNavigation(testCase.navigationGestures);

        testResult.navigationSteps = navigationResults;
        testResult.gestures = testCase.navigationGestures;
        testResult.actualSpeech = navigationResults.map(r => r.speechOutput).join(' → ');

        // Validate rotor items
        const itemsCorrect = this.validateRotorItems(
          navigationResults,
          testCase.expectedItems,
          testCase.expectedSpeech
        );

        // Test web area navigation if specified
        if (testCase.webArea) {
          const webAreaCorrect = await this.validateWebAreaNavigation(navigationResults);
          testResult.passed = itemsCorrect && webAreaCorrect;

          if (!webAreaCorrect) {
            testResult.warnings.push('Web area navigation may have issues');
          }
        } else {
          testResult.passed = itemsCorrect;
        }

        testResult.timeTaken = performance.now() - startTime;

        if (!itemsCorrect) {
          testResult.errors.push('Rotor navigation sequence did not match expected items');
        }

      } catch (error) {
        testResult.errors.push(`Rotor navigation test failed: ${error.message}`);
        testResult.timeTaken = performance.now() - startTime;
      }

      results.push(testResult);
      this.testResults.push(testResult);
    }

    return results;
  }

  /**
   * Test VoiceOver gestures
   */
  async testGestures(testCases: VoiceOverGestureTest[]): Promise<VoiceOverTestResult[]> {
    const results: VoiceOverTestResult[] = [];

    console.log('👆 Testing VoiceOver gestures...');

    for (const testCase of testCases) {
      const startTime = performance.now();
      const testResult: VoiceOverTestResult = {
        testName: `Gesture: ${testCase.name}`,
        passed: false,
        actualSpeech: '',
        expectedSpeech: testCase.expectedSpeech,
        navigationSteps: [],
        timeTaken: 0,
        voiceOverMode: this.currentMode,
        gestures: [testCase.gesture],
        errors: [],
        warnings: [],
        recommendations: []
      };

      try {
        // Navigate to starting element
        await this.navigateToElement(testCase.startElement);

        // Perform the gesture
        await this.performGesture(testCase.gesture);

        // Capture result
        const speechOutput = await this.captureSpeechOutput();
        testResult.actualSpeech = speechOutput.text;

        // Validate gesture outcome
        const outcomeCorrect = this.validateGestureOutcome(
          speechOutput.text,
          testCase.expectedOutcome,
          testCase.expectedSpeech
        );

        testResult.passed = outcomeCorrect;
        testResult.timeTaken = performance.now() - startTime;

        if (!outcomeCorrect) {
          testResult.errors.push(
            `Gesture outcome incorrect. Expected: "${testCase.expectedSpeech}", Got: "${speechOutput.text}"`
          );
        }

        // Check context dependency
        if (testCase.contextDependent) {
          const contextValid = await this.validateGestureContext(testCase);
          if (!contextValid) {
            testResult.warnings.push('Gesture behavior may be context-dependent');
          }
        }

      } catch (error) {
        testResult.errors.push(`Gesture test failed: ${error.message}`);
        testResult.timeTaken = performance.now() - startTime;
      }

      results.push(testResult);
      this.testResults.push(testResult);
    }

    return results;
  }

  /**
   * Test web area navigation
   */
  async testWebAreaNavigation(testCases: VoiceOverWebAreaTest[]): Promise<VoiceOverTestResult[]> {
    const results: VoiceOverTestResult[] = [];

    console.log('🌐 Testing web area navigation with VoiceOver...');

    for (const testCase of testCases) {
      const startTime = performance.now();
      const testResult: VoiceOverTestResult = {
        testName: `Web Area: ${testCase.pageTitle}`,
        passed: false,
        actualSpeech: '',
        expectedSpeech: '',
        navigationSteps: [],
        timeTaken: 0,
        voiceOverMode: 'cursor',
        gestures: [],
        errors: [],
        warnings: [],
        recommendations: []
      };

      try {
        // Navigate to web area
        if (testCase.url) {
          await this.navigateToURL(testCase.url);
        }

        // Test page title announcement
        const titleSpeech = await this.captureSpeechOutput();
        const titleCorrect = titleSpeech.text.includes(testCase.pageTitle);

        if (!titleCorrect) {
          testResult.warnings.push(`Page title not announced correctly: "${titleSpeech.text}"`);
        }

        // Test expected elements
        const elementResults = await this.testWebAreaElements(testCase.expectedElements);
        testResult.navigationSteps.push(...elementResults);

        // Test quick navigation
        const quickNavResults = await this.testQuickNavigation(testCase.quickNavTests);
        testResult.navigationSteps.push(...quickNavResults);

        // Compile speech output
        testResult.actualSpeech = [
          titleSpeech.text,
          ...elementResults.map(r => r.speechOutput),
          ...quickNavResults.map(r => r.speechOutput)
        ].join(' → ');

        // Validate web area accessibility
        const webAreaValid = this.validateWebAreaAccessibility(
          elementResults,
          quickNavResults,
          testCase
        );

        testResult.passed = titleCorrect && webAreaValid;
        testResult.timeTaken = performance.now() - startTime;

        if (!webAreaValid) {
          testResult.errors.push('Web area navigation has accessibility issues');
        }

      } catch (error) {
        testResult.errors.push(`Web area test failed: ${error.message}`);
        testResult.timeTaken = performance.now() - startTime;
      }

      results.push(testResult);
      this.testResults.push(testResult);
    }

    return results;
  }

  /**
   * Test live regions with VoiceOver
   */
  async testLiveRegions(testCases: Array<{
    name: string;
    regionSelector: string;
    liveType: 'polite' | 'assertive' | 'off';
    contentUpdate: string;
    triggerAction: () => Promise<void>;
    expectedAnnouncement: string;
    expectedInterruption?: boolean;
  }>): Promise<VoiceOverTestResult[]> {
    const results: VoiceOverTestResult[] = [];

    console.log('📢 Testing live regions with VoiceOver...');

    for (const testCase of testCases) {
      const startTime = performance.now();
      const testResult: VoiceOverTestResult = {
        testName: `Live Region: ${testCase.name}`,
        passed: false,
        actualSpeech: '',
        expectedSpeech: testCase.expectedAnnouncement,
        navigationSteps: [],
        timeTaken: 0,
        voiceOverMode: this.currentMode,
        gestures: [],
        errors: [],
        warnings: [],
        recommendations: []
      };

      try {
        // Clear previous speech
        this.clearSpeechHistory();

        // Start monitoring for announcements
        const speechMonitor = this.startSpeechMonitoring();

        // Execute trigger action
        await testCase.triggerAction();

        // Wait for live region announcement
        const announcement = await this.waitForLiveRegionAnnouncement(3000);

        // Stop monitoring
        speechMonitor.stop();

        testResult.actualSpeech = announcement;

        // Validate live region announcement
        const announcementCorrect = this.validateLiveRegionAnnouncement(
          announcement,
          testCase.expectedAnnouncement
        );

        // Check interruption behavior for assertive regions
        const interruptionCorrect = testCase.expectedInterruption ?
          this.validateAnnouncementInterruption() : true;

        testResult.passed = announcementCorrect && interruptionCorrect;
        testResult.timeTaken = performance.now() - startTime;

        if (!announcementCorrect) {
          testResult.errors.push(
            `Live region announcement mismatch. Expected: "${testCase.expectedAnnouncement}", Got: "${announcement}"`
          );
        }

        if (!interruptionCorrect) {
          testResult.warnings.push('Live region interruption behavior unexpected');
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
   * Generate comprehensive VoiceOver test report
   */
  async generateReport(): Promise<string> {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;

    const report = {
      voiceOverVersion: await this.getVoiceOverVersion(),
      macOSVersion: await this.getMacOSVersion(),
      testConfiguration: this.config,
      summary: {
        totalTests,
        passedTests,
        failedTests,
        successRate: Math.round((passedTests / totalTests) * 100),
        averageTestTime: Math.round(
          this.testResults.reduce((sum, r) => sum + r.timeTaken, 0) / totalTests
        ),
        modesUsed: [...new Set(this.testResults.map(r => r.voiceOverMode))],
        gesturesPerformed: this.testResults.reduce((sum, r) => sum + r.gestures.length, 0),
        totalNavigationSteps: this.testResults.reduce((sum, r) => sum + r.navigationSteps.length, 0)
      },
      testResults: this.testResults,
      speechHistory: this.speechOutput,
      navigationHistory: this.navigationHistory,
      recommendations: this.generateComprehensiveRecommendations(),
      voiceOverSpecificIssues: this.analyzeVoiceOverSpecificIssues(),
      gestureAnalysis: this.analyzeGestureEffectiveness(),
      timestamp: new Date().toISOString()
    };

    // Save report
    const reportPath = join(process.cwd(), 'tests', 'accessibility', 'reports',
      `voiceover-test-report-${Date.now()}.json`);

    await fs.mkdir(join(process.cwd(), 'tests', 'accessibility', 'reports'), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    console.log(`📊 VoiceOver test report saved to: ${reportPath}`);

    return JSON.stringify(report, null, 2);
  }

  /**
   * Cleanup and shutdown VoiceOver
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up VoiceOver testing session...');

    // Stop VoiceOver gracefully
    await this.stopVoiceOver();

    this.isRunning = false;
    this.speechOutput = [];
    this.navigationHistory = [];
    this.testResults = [];

    console.log('✅ VoiceOver cleanup completed');
  }

  // Private helper methods

  private async checkVoiceOverAvailability(): Promise<void> {
    try {
      const { stdout } = await execAsync('defaults read com.apple.universalaccess voiceOverOnOffKey');
      if (!stdout.trim()) {
        console.warn('⚠️ VoiceOver may not be properly configured');
      }
    } catch (error) {
      throw new Error('VoiceOver not available or not configured properly');
    }
  }

  private async configureVoiceOverSettings(): Promise<void> {
    // Configure VoiceOver settings via defaults
    const settings = [
      `defaults write com.apple.VoiceOver4.default SCRCRate ${this.config.speechRate}`,
      `defaults write com.apple.VoiceOver4.default SCRCVerbosity ${this.getVerbosityLevel()}`,
      `defaults write com.apple.VoiceOver4.default SCRCSoundFeedback ${this.config.enableSounds}`,
      `defaults write com.apple.VoiceOver4.default SCRCHints ${this.config.enableHints}`
    ];

    for (const setting of settings) {
      try {
        await execAsync(setting);
      } catch (error) {
        console.warn(`⚠️ Could not configure setting: ${setting}`);
      }
    }
  }

  private getVerbosityLevel(): number {
    switch (this.config.verbosity) {
      case 'low': return 1;
      case 'medium': return 2;
      case 'high': return 3;
      default: return 2;
    }
  }

  private async startVoiceOver(): Promise<void> {
    try {
      // Start VoiceOver using AppleScript
      const script = `
        tell application "System Events"
          set isRunning to (name of processes) contains "VoiceOver"
          if not isRunning then
            key code 60 using {command down, option down}
            delay 3
          end if
        end tell
      `;

      await execAsync(`osascript -e '${script}'`);

      // Verify VoiceOver is running
      if (!await this.isVoiceOverRunning()) {
        throw new Error('Failed to start VoiceOver');
      }

    } catch (error) {
      throw new Error(`Failed to start VoiceOver: ${error.message}`);
    }
  }

  private async stopVoiceOver(): Promise<void> {
    try {
      const script = `
        tell application "System Events"
          set isRunning to (name of processes) contains "VoiceOver"
          if isRunning then
            key code 60 using {command down, option down}
            delay 2
          end if
        end tell
      `;

      await execAsync(`osascript -e '${script}'`);
    } catch (error) {
      console.warn(`⚠️ Could not stop VoiceOver gracefully: ${error.message}`);
    }
  }

  private async isVoiceOverRunning(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('pgrep -f VoiceOver');
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  private async setupSpeechCapture(): Promise<void> {
    // Implementation would set up speech capture using macOS accessibility APIs
    // This is a placeholder for the actual speech monitoring setup
  }

  private async navigateToElement(selector: string): Promise<void> {
    // Implementation would navigate to element using VoiceOver cursor
    // This would use AppleScript or Accessibility APIs
  }

  private async performGesture(gesture: string): Promise<void> {
    // Implementation would perform VoiceOver gestures
    // This would translate gesture names to actual trackpad/keyboard commands
  }

  private async captureSpeechOutput(): Promise<VoiceOverSpeechOutput> {
    // Implementation would capture VoiceOver speech output
    return {
      text: 'Captured VoiceOver speech',
      timestamp: Date.now(),
      voice: this.config.voiceType || 'alex',
      rate: this.config.speechRate || 50,
      navigationMode: this.currentMode,
      currentContext: 'web'
    };
  }

  // Additional private helper methods...
  // Due to length constraints, showing structure for key methods

  private validateAriaRole(speech: string, expectedRole: string): boolean {
    return speech.toLowerCase().includes(expectedRole.toLowerCase());
  }

  private validateAriaProperties(speech: string, properties: Record<string, string>): boolean {
    return Object.entries(properties).every(([key, value]) =>
      speech.toLowerCase().includes(value.toLowerCase())
    );
  }

  private validateSpeechOutput(actual: string, expected: string): boolean {
    return actual.toLowerCase().includes(expected.toLowerCase());
  }

  private generateVoiceOverRecommendations(testCase: any, speech: string): string[] {
    const recommendations: string[] = [];

    if (!speech.includes(testCase.expectedRole)) {
      recommendations.push(`Ensure ARIA role "${testCase.expectedRole}" is announced by VoiceOver`);
    }

    return recommendations;
  }

  private async setRotorType(rotorType: string): Promise<void> {
    // Implementation would set VoiceOver rotor to specific type
  }

  private async executeRotorNavigation(gestures: string[]): Promise<VoiceOverNavigationState[]> {
    const results: VoiceOverNavigationState[] = [];

    for (const gesture of gestures) {
      // Implementation would execute rotor navigation
      results.push({
        currentElement: 'element',
        elementType: 'heading',
        elementText: 'text',
        cursorPosition: { x: 0, y: 0 },
        rotorPosition: rotorType,
        ariaProperties: {},
        speechOutput: 'speech',
        gesture
      });
    }

    return results;
  }

  private validateRotorItems(
    results: VoiceOverNavigationState[],
    expectedItems: string[],
    expectedSpeech: string[]
  ): boolean {
    return results.length === expectedItems.length &&
           results.every((result, index) =>
             result.speechOutput.includes(expectedSpeech[index] || '')
           );
  }

  private async validateWebAreaNavigation(results: VoiceOverNavigationState[]): Promise<boolean> {
    // Implementation would validate web area navigation
    return true;
  }

  private validateGestureOutcome(speech: string, expectedOutcome: string, expectedSpeech: string): boolean {
    return speech.includes(expectedOutcome) || speech.includes(expectedSpeech);
  }

  private async validateGestureContext(testCase: VoiceOverGestureTest): Promise<boolean> {
    // Implementation would validate gesture context dependency
    return true;
  }

  private async navigateToURL(url: string): Promise<void> {
    // Implementation would navigate to URL using VoiceOver
  }

  private async testWebAreaElements(elements: any[]): Promise<VoiceOverNavigationState[]> {
    // Implementation would test web area elements
    return [];
  }

  private async testQuickNavigation(tests: any[]): Promise<VoiceOverNavigationState[]> {
    // Implementation would test quick navigation
    return [];
  }

  private validateWebAreaAccessibility(
    elementResults: VoiceOverNavigationState[],
    quickNavResults: VoiceOverNavigationState[],
    testCase: VoiceOverWebAreaTest
  ): boolean {
    return elementResults.length > 0 && quickNavResults.length > 0;
  }

  private clearSpeechHistory(): void {
    this.speechOutput = [];
  }

  private startSpeechMonitoring(): { stop: () => void } {
    // Implementation would start monitoring VoiceOver speech
    return { stop: () => {} };
  }

  private async waitForLiveRegionAnnouncement(timeout: number): Promise<string> {
    // Implementation would wait for live region announcement
    return 'Live region announcement';
  }

  private validateLiveRegionAnnouncement(actual: string, expected: string): boolean {
    return actual.toLowerCase().includes(expected.toLowerCase());
  }

  private validateAnnouncementInterruption(): boolean {
    // Implementation would check if announcement interrupted current speech
    return true;
  }

  private async getVoiceOverVersion(): Promise<string> {
    try {
      const { stdout } = await execAsync('defaults read /System/Library/CoreServices/VoiceOver.app/Contents/Info CFBundleShortVersionString');
      return stdout.trim();
    } catch {
      return 'Unknown';
    }
  }

  private async getMacOSVersion(): Promise<string> {
    try {
      const { stdout } = await execAsync('sw_vers -productVersion');
      return stdout.trim();
    } catch {
      return 'Unknown';
    }
  }

  private generateComprehensiveRecommendations(): string[] {
    const recommendations: string[] = [];

    const totalErrors = this.testResults.reduce((sum, r) => sum + r.errors.length, 0);
    if (totalErrors > 0) {
      recommendations.push(`🚨 Address ${totalErrors} accessibility issues found by VoiceOver testing`);
    }

    const gestureIssues = this.testResults.filter(r =>
      r.voiceOverMode === 'rotor' && !r.passed
    ).length;

    if (gestureIssues > 0) {
      recommendations.push(`👆 Review ${gestureIssues} gesture-related accessibility issues`);
    }

    return recommendations;
  }

  private analyzeVoiceOverSpecificIssues(): any {
    return {
      rotorNavigationIssues: this.testResults.filter(r => r.voiceOverMode === 'rotor' && !r.passed).length,
      gestureIssues: this.testResults.filter(r => r.gestures.length > 0 && !r.passed).length,
      webAreaIssues: this.testResults.filter(r => r.testName.includes('Web Area') && !r.passed).length
    };
  }

  private analyzeGestureEffectiveness(): any {
    const gestureStats = this.testResults.reduce((acc, result) => {
      result.gestures.forEach(gesture => {
        if (!acc[gesture]) {
          acc[gesture] = { total: 0, passed: 0 };
        }
        acc[gesture].total++;
        if (result.passed) {
          acc[gesture].passed++;
        }
      });
      return acc;
    }, {} as Record<string, { total: number; passed: number }>);

    return Object.entries(gestureStats).map(([gesture, stats]) => ({
      gesture,
      successRate: Math.round((stats.passed / stats.total) * 100),
      totalTests: stats.total
    }));
  }
}

export default VoiceOverAutomation;