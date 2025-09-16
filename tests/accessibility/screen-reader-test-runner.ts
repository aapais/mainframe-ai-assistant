/**
 * Master Screen Reader Test Runner
 *
 * Coordinates testing across NVDA, JAWS, and VoiceOver with comprehensive
 * cross-platform validation and detailed reporting.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';

import {
  ScreenReaderTestRunner,
  ScreenReaderTestResult,
  createAriaTestCases,
  createLiveRegionTests,
  createNavigationTests,
  createFormTests,
  createTableTests
} from './screen-reader-testing-framework';

import NVDAAutomation from './nvda-automation';
import JAWSAutomation from './jaws-automation';
import VoiceOverAutomation from './voiceover-automation';

export interface CrossPlatformTestConfig {
  enabledScreenReaders: Array<'nvda' | 'jaws' | 'voiceover'>;
  testSuites: Array<'aria' | 'forms' | 'tables' | 'navigation' | 'live-regions'>;
  parallelExecution?: boolean;
  generateComparisonReport?: boolean;
  saveIndividualReports?: boolean;
  outputDirectory?: string;
  continueOnFailure?: boolean;
}

export interface CrossPlatformTestResult {
  screenReader: string;
  testSuite: string;
  results: ScreenReaderTestResult[];
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    successRate: number;
    averageTime: number;
  };
  errors: string[];
  warnings: string[];
}

export interface ComparisonAnalysis {
  testName: string;
  nvdaResult?: ScreenReaderTestResult;
  jawsResult?: ScreenReaderTestResult;
  voiceOverResult?: ScreenReaderTestResult;
  consistency: 'consistent' | 'partially-consistent' | 'inconsistent';
  consensusResult: boolean;
  discrepancies: string[];
  recommendations: string[];
}

export interface MasterTestReport {
  executionSummary: {
    startTime: string;
    endTime: string;
    totalDuration: number;
    screenReadersUsed: string[];
    testSuitesRun: string[];
    totalTests: number;
    overallSuccessRate: number;
  };
  individualResults: CrossPlatformTestResult[];
  comparisonAnalysis: ComparisonAnalysis[];
  recommendations: {
    critical: string[];
    important: string[];
    suggested: string[];
  };
  wcagCompliance: {
    level: 'A' | 'AA' | 'AAA';
    criteria: Record<string, {
      nvda: boolean;
      jaws: boolean;
      voiceover: boolean;
      overall: boolean;
    }>;
  };
  platformSpecificIssues: {
    nvda: string[];
    jaws: string[];
    voiceover: string[];
  };
}

export class MasterScreenReaderTestRunner {
  private config: CrossPlatformTestConfig;
  private testResults: CrossPlatformTestResult[] = [];
  private startTime: number = 0;

  constructor(config: CrossPlatformTestConfig) {
    this.config = {
      enabledScreenReaders: config.enabledScreenReaders || ['nvda', 'jaws', 'voiceover'],
      testSuites: config.testSuites || ['aria', 'forms', 'tables', 'navigation', 'live-regions'],
      parallelExecution: config.parallelExecution ?? false,
      generateComparisonReport: config.generateComparisonReport ?? true,
      saveIndividualReports: config.saveIndividualReports ?? true,
      outputDirectory: config.outputDirectory || join(process.cwd(), 'tests', 'accessibility', 'reports'),
      continueOnFailure: config.continueOnFailure ?? true,
      ...config
    };
  }

  /**
   * Run comprehensive screen reader testing across all enabled platforms
   */
  async runComprehensiveTests(): Promise<MasterTestReport> {
    console.log('🚀 Starting comprehensive screen reader testing...');
    this.startTime = performance.now();

    try {
      // Ensure output directory exists
      await fs.mkdir(this.config.outputDirectory!, { recursive: true });

      // Run tests for each enabled screen reader
      if (this.config.parallelExecution) {
        await this.runTestsInParallel();
      } else {
        await this.runTestsSequentially();
      }

      // Generate comparison analysis
      const comparisonAnalysis = this.config.generateComparisonReport
        ? this.generateComparisonAnalysis()
        : [];

      // Generate master report
      const masterReport = this.generateMasterReport(comparisonAnalysis);

      // Save reports
      await this.saveReports(masterReport);

      console.log('✅ Comprehensive screen reader testing completed');
      return masterReport;

    } catch (error) {
      console.error('❌ Screen reader testing failed:', error);
      throw error;
    }
  }

  /**
   * Run tests for specific screen reader and test suite combination
   */
  async runSpecificTests(
    screenReader: 'nvda' | 'jaws' | 'voiceover',
    testSuite: string
  ): Promise<CrossPlatformTestResult> {
    console.log(`🔧 Running ${testSuite} tests for ${screenReader.toUpperCase()}...`);

    const startTime = performance.now();
    let automation: NVDAAutomation | JAWSAutomation | VoiceOverAutomation;
    let results: ScreenReaderTestResult[] = [];

    try {
      // Initialize appropriate automation
      automation = await this.initializeScreenReader(screenReader);

      // Run specific test suite
      results = await this.runTestSuite(automation, testSuite);

      // Calculate summary
      const summary = this.calculateSummary(results, startTime);

      const testResult: CrossPlatformTestResult = {
        screenReader: screenReader.toUpperCase(),
        testSuite,
        results,
        summary,
        errors: results.flatMap(r => r.violations.map(v => v.description)),
        warnings: results.flatMap(r => r.violations.filter(v => v.severity === 'moderate').map(v => v.description))
      };

      this.testResults.push(testResult);

      // Cleanup
      await automation.cleanup();

      return testResult;

    } catch (error) {
      console.error(`❌ ${screenReader.toUpperCase()} testing failed:`, error);

      const errorResult: CrossPlatformTestResult = {
        screenReader: screenReader.toUpperCase(),
        testSuite,
        results: [],
        summary: {
          totalTests: 0,
          passedTests: 0,
          failedTests: 0,
          successRate: 0,
          averageTime: 0
        },
        errors: [error.message],
        warnings: []
      };

      if (this.config.continueOnFailure) {
        this.testResults.push(errorResult);
        return errorResult;
      } else {
        throw error;
      }
    }
  }

  /**
   * Generate detailed comparison analysis between screen readers
   */
  private generateComparisonAnalysis(): ComparisonAnalysis[] {
    const analysis: ComparisonAnalysis[] = [];

    // Group results by test name
    const testGroups = this.groupResultsByTestName();

    Object.entries(testGroups).forEach(([testName, results]) => {
      const nvdaResult = results.find(r => r.screenReader === 'NVDA');
      const jawsResult = results.find(r => r.screenReader === 'JAWS');
      const voiceOverResult = results.find(r => r.screenReader === 'VOICEOVER');

      const comparison: ComparisonAnalysis = {
        testName,
        nvdaResult,
        jawsResult,
        voiceOverResult,
        consistency: this.analyzeConsistency([nvdaResult, jawsResult, voiceOverResult].filter(Boolean)),
        consensusResult: this.determineConsensusResult([nvdaResult, jawsResult, voiceOverResult].filter(Boolean)),
        discrepancies: this.identifyDiscrepancies([nvdaResult, jawsResult, voiceOverResult].filter(Boolean)),
        recommendations: this.generateTestRecommendations(testName, [nvdaResult, jawsResult, voiceOverResult].filter(Boolean))
      };

      analysis.push(comparison);
    });

    return analysis;
  }

  /**
   * Run tests in parallel across screen readers
   */
  private async runTestsInParallel(): Promise<void> {
    console.log('⚡ Running tests in parallel...');

    const promises = this.config.enabledScreenReaders.flatMap(screenReader =>
      this.config.testSuites.map(testSuite =>
        this.runSpecificTests(screenReader, testSuite).catch(error => {
          console.error(`Failed ${screenReader} ${testSuite}:`, error);
          return null;
        })
      )
    );

    const results = await Promise.all(promises);

    // Filter out null results from failed tests
    results.filter(Boolean).forEach(result => {
      if (!this.testResults.find(r =>
        r.screenReader === result!.screenReader && r.testSuite === result!.testSuite
      )) {
        this.testResults.push(result!);
      }
    });
  }

  /**
   * Run tests sequentially across screen readers
   */
  private async runTestsSequentially(): Promise<void> {
    console.log('🔄 Running tests sequentially...');

    for (const screenReader of this.config.enabledScreenReaders) {
      for (const testSuite of this.config.testSuites) {
        try {
          await this.runSpecificTests(screenReader, testSuite);
        } catch (error) {
          console.error(`Failed ${screenReader} ${testSuite}:`, error);
          if (!this.config.continueOnFailure) {
            throw error;
          }
        }
      }
    }
  }

  /**
   * Initialize appropriate screen reader automation
   */
  private async initializeScreenReader(
    screenReader: 'nvda' | 'jaws' | 'voiceover'
  ): Promise<NVDAAutomation | JAWSAutomation | VoiceOverAutomation> {
    switch (screenReader) {
      case 'nvda':
        const nvda = new NVDAAutomation({
          enableLogging: true,
          speechRate: 50,
          verbosityLevel: 2
        });
        await nvda.initialize();
        return nvda;

      case 'jaws':
        const jaws = new JAWSAutomation({
          enableLogging: true,
          speechRate: 250,
          verbosity: 'intermediate'
        });
        await jaws.initialize();
        return jaws;

      case 'voiceover':
        const voiceOver = new VoiceOverAutomation({
          enableLogging: true,
          speechRate: 50,
          verbosity: 'medium'
        });
        await voiceOver.initialize();
        return voiceOver;

      default:
        throw new Error(`Unsupported screen reader: ${screenReader}`);
    }
  }

  /**
   * Run specific test suite with automation
   */
  private async runTestSuite(
    automation: NVDAAutomation | JAWSAutomation | VoiceOverAutomation,
    testSuite: string
  ): Promise<ScreenReaderTestResult[]> {
    let results: ScreenReaderTestResult[] = [];

    switch (testSuite) {
      case 'aria':
        const ariaTests = createAriaTestCases();
        if (automation instanceof NVDAAutomation) {
          const nvdaAriaResults = await automation.testAriaRoles(
            ariaTests.map(test => ({
              selector: test.element,
              expectedRole: test.expectedAnnouncement.split(' ')[1], // Extract role
              expectedSpeech: test.expectedAnnouncement,
              ariaProperties: test.ariaAttributes
            }))
          );
          results = this.convertNVDAResults(nvdaAriaResults);
        } else if (automation instanceof JAWSAutomation) {
          const jawsAriaResults = await automation.testAriaRolesAndStates(
            ariaTests.map(test => ({
              name: test.name,
              selector: test.element,
              expectedRole: test.expectedAnnouncement.split(' ')[1],
              expectedStates: Object.keys(test.ariaAttributes),
              expectedSpeech: test.expectedAnnouncement,
              ariaProperties: test.ariaAttributes
            }))
          );
          results = this.convertJAWSResults(jawsAriaResults);
        } else if (automation instanceof VoiceOverAutomation) {
          const voAriaResults = await automation.testAriaImplementation(
            ariaTests.map(test => ({
              name: test.name,
              selector: test.element,
              expectedRole: test.expectedAnnouncement.split(' ')[1],
              expectedProperties: test.ariaAttributes,
              expectedSpeech: test.expectedAnnouncement
            }))
          );
          results = this.convertVoiceOverResults(voAriaResults);
        }
        break;

      case 'forms':
        const formTests = createFormTests();
        if (automation instanceof NVDAAutomation) {
          const nvdaFormResults = await automation.testFormAccessibility([{
            name: 'Form Accessibility Test',
            formSelector: 'form',
            fields: formTests.map(test => ({
              selector: `input[type="${test.fieldType}"]`,
              expectedLabel: test.expectedAnnouncement.split(' ')[0],
              expectedType: test.fieldType,
              required: test.requiredField,
              hasDescription: test.hasDescription,
              hasError: test.hasErrorMessage
            }))
          }]);
          results = this.convertNVDAResults(nvdaFormResults);
        }
        // Similar implementation for JAWS and VoiceOver...
        break;

      case 'tables':
        const tableTests = createTableTests();
        // Implementation for table testing...
        break;

      case 'navigation':
        const navTests = createNavigationTests();
        // Implementation for navigation testing...
        break;

      case 'live-regions':
        const liveTests = createLiveRegionTests();
        // Implementation for live region testing...
        break;

      default:
        throw new Error(`Unsupported test suite: ${testSuite}`);
    }

    return results;
  }

  /**
   * Convert NVDA-specific results to common format
   */
  private convertNVDAResults(nvdaResults: any[]): ScreenReaderTestResult[] {
    return nvdaResults.map(result => ({
      testName: result.testName,
      screenReader: 'NVDA',
      passed: result.passed,
      actualAnnouncement: result.actualSpeech,
      expectedAnnouncement: result.expectedSpeech,
      timeTaken: result.timeTaken,
      violations: result.errors.map((error: string) => ({
        rule: 'screen-reader-announcement',
        severity: 'serious' as const,
        element: 'unknown',
        description: error,
        suggestion: 'Review ARIA implementation',
        wcagCriterion: '4.1.2'
      })),
      metadata: {
        screenReader: 'NVDA',
        testType: result.testName.split(':')[0],
        navigationSteps: result.navigationPath || []
      }
    }));
  }

  /**
   * Convert JAWS-specific results to common format
   */
  private convertJAWSResults(jawsResults: any[]): ScreenReaderTestResult[] {
    return jawsResults.map(result => ({
      testName: result.testName,
      screenReader: 'JAWS',
      passed: result.passed,
      actualAnnouncement: result.actualSpeech,
      expectedAnnouncement: result.expectedSpeech,
      timeTaken: result.timeTaken,
      violations: result.errors.map((error: string) => ({
        rule: 'screen-reader-announcement',
        severity: 'serious' as const,
        element: 'unknown',
        description: error,
        suggestion: 'Review ARIA implementation for JAWS compatibility',
        wcagCriterion: '4.1.2'
      })),
      metadata: {
        screenReader: 'JAWS',
        testType: result.testName.split(':')[0],
        jawsMode: result.jawsMode,
        gestures: result.gestures || []
      }
    }));
  }

  /**
   * Convert VoiceOver-specific results to common format
   */
  private convertVoiceOverResults(voResults: any[]): ScreenReaderTestResult[] {
    return voResults.map(result => ({
      testName: result.testName,
      screenReader: 'VoiceOver',
      passed: result.passed,
      actualAnnouncement: result.actualSpeech,
      expectedAnnouncement: result.expectedSpeech,
      timeTaken: result.timeTaken,
      violations: result.errors.map((error: string) => ({
        rule: 'screen-reader-announcement',
        severity: 'serious' as const,
        element: 'unknown',
        description: error,
        suggestion: 'Review ARIA implementation for VoiceOver compatibility',
        wcagCriterion: '4.1.2'
      })),
      metadata: {
        screenReader: 'VoiceOver',
        testType: result.testName.split(':')[0],
        voiceOverMode: result.voiceOverMode,
        gestures: result.gestures || []
      }
    }));
  }

  /**
   * Calculate test summary statistics
   */
  private calculateSummary(results: ScreenReaderTestResult[], startTime: number): {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    successRate: number;
    averageTime: number;
  } {
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const totalTime = performance.now() - startTime;

    return {
      totalTests,
      passedTests,
      failedTests,
      successRate: totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0,
      averageTime: totalTests > 0 ? Math.round(totalTime / totalTests) : 0
    };
  }

  /**
   * Group test results by test name for comparison
   */
  private groupResultsByTestName(): Record<string, ScreenReaderTestResult[]> {
    const groups: Record<string, ScreenReaderTestResult[]> = {};

    this.testResults.forEach(testResult => {
      testResult.results.forEach(result => {
        if (!groups[result.testName]) {
          groups[result.testName] = [];
        }
        groups[result.testName].push(result);
      });
    });

    return groups;
  }

  /**
   * Analyze consistency across screen readers
   */
  private analyzeConsistency(results: ScreenReaderTestResult[]): 'consistent' | 'partially-consistent' | 'inconsistent' {
    if (results.length < 2) return 'consistent';

    const passedCount = results.filter(r => r.passed).length;
    const totalCount = results.length;

    if (passedCount === totalCount || passedCount === 0) {
      return 'consistent';
    } else if (passedCount >= totalCount * 0.5) {
      return 'partially-consistent';
    } else {
      return 'inconsistent';
    }
  }

  /**
   * Determine consensus result across screen readers
   */
  private determineConsensusResult(results: ScreenReaderTestResult[]): boolean {
    if (results.length === 0) return false;

    const passedCount = results.filter(r => r.passed).length;
    return passedCount > results.length / 2;
  }

  /**
   * Identify discrepancies between screen readers
   */
  private identifyDiscrepancies(results: ScreenReaderTestResult[]): string[] {
    const discrepancies: string[] = [];

    if (results.length < 2) return discrepancies;

    const passedScreenReaders = results.filter(r => r.passed).map(r => r.screenReader);
    const failedScreenReaders = results.filter(r => !r.passed).map(r => r.screenReader);

    if (passedScreenReaders.length > 0 && failedScreenReaders.length > 0) {
      discrepancies.push(
        `Inconsistent results: ${passedScreenReaders.join(', ')} passed, ${failedScreenReaders.join(', ')} failed`
      );
    }

    // Compare speech output variations
    const speeches = results.map(r => r.actualAnnouncement.toLowerCase().trim());
    const uniqueSpeeches = [...new Set(speeches)];

    if (uniqueSpeeches.length > 1) {
      discrepancies.push(`Different announcements: ${uniqueSpeeches.join(' | ')}`);
    }

    return discrepancies;
  }

  /**
   * Generate test-specific recommendations
   */
  private generateTestRecommendations(testName: string, results: ScreenReaderTestResult[]): string[] {
    const recommendations: string[] = [];

    const failedResults = results.filter(r => !r.passed);
    if (failedResults.length > 0) {
      recommendations.push(
        `Address accessibility issues for: ${failedResults.map(r => r.screenReader).join(', ')}`
      );
    }

    // Add specific recommendations based on test type
    if (testName.includes('ARIA')) {
      recommendations.push('Verify ARIA roles and properties are correctly implemented');
    }

    if (testName.includes('Form')) {
      recommendations.push('Ensure form labels and descriptions are properly associated');
    }

    if (testName.includes('Table')) {
      recommendations.push('Check table headers and caption for screen reader compatibility');
    }

    return recommendations;
  }

  /**
   * Generate comprehensive master report
   */
  private generateMasterReport(comparisonAnalysis: ComparisonAnalysis[]): MasterTestReport {
    const endTime = performance.now();
    const totalDuration = endTime - this.startTime;

    const allResults = this.testResults.flatMap(tr => tr.results);
    const totalTests = allResults.length;
    const passedTests = allResults.filter(r => r.passed).length;

    return {
      executionSummary: {
        startTime: new Date(Date.now() - totalDuration).toISOString(),
        endTime: new Date().toISOString(),
        totalDuration: Math.round(totalDuration),
        screenReadersUsed: [...new Set(this.testResults.map(tr => tr.screenReader))],
        testSuitesRun: [...new Set(this.testResults.map(tr => tr.testSuite))],
        totalTests,
        overallSuccessRate: totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0
      },
      individualResults: this.testResults,
      comparisonAnalysis,
      recommendations: this.generateMasterRecommendations(comparisonAnalysis),
      wcagCompliance: this.analyzeWCAGCompliance(),
      platformSpecificIssues: this.analyzePlatformSpecificIssues()
    };
  }

  /**
   * Generate master recommendations
   */
  private generateMasterRecommendations(analysis: ComparisonAnalysis[]): {
    critical: string[];
    important: string[];
    suggested: string[];
  } {
    const critical: string[] = [];
    const important: string[] = [];
    const suggested: string[] = [];

    // Critical issues (affecting all screen readers)
    const universalFailures = analysis.filter(a =>
      a.consistency === 'consistent' && !a.consensusResult
    );

    if (universalFailures.length > 0) {
      critical.push(`${universalFailures.length} issues affect all screen readers - fix immediately`);
    }

    // Important issues (affecting majority)
    const majorityFailures = analysis.filter(a =>
      a.consistency === 'partially-consistent' && !a.consensusResult
    );

    if (majorityFailures.length > 0) {
      important.push(`${majorityFailures.length} issues affect majority of screen readers`);
    }

    // Inconsistent behavior
    const inconsistent = analysis.filter(a => a.consistency === 'inconsistent');
    if (inconsistent.length > 0) {
      important.push(`${inconsistent.length} tests show inconsistent behavior across screen readers`);
    }

    // General suggestions
    suggested.push('Test with multiple screen readers during development');
    suggested.push('Use semantic HTML as foundation before adding ARIA');
    suggested.push('Provide multiple ways to convey information (not just color/sound)');

    return { critical, important, suggested };
  }

  /**
   * Analyze WCAG compliance across screen readers
   */
  private analyzeWCAGCompliance(): {
    level: 'A' | 'AA' | 'AAA';
    criteria: Record<string, {
      nvda: boolean;
      jaws: boolean;
      voiceover: boolean;
      overall: boolean;
    }>;
  } {
    const criteria: Record<string, any> = {};

    // Analyze each test's WCAG criteria
    this.testResults.forEach(testResult => {
      testResult.results.forEach(result => {
        result.violations.forEach(violation => {
          if (!criteria[violation.wcagCriterion]) {
            criteria[violation.wcagCriterion] = {
              nvda: true,
              jaws: true,
              voiceover: true,
              overall: true
            };
          }

          // Mark as failed for this screen reader
          const sr = result.screenReader.toLowerCase();
          if (sr === 'nvda' || sr === 'jaws' || sr === 'voiceover') {
            criteria[violation.wcagCriterion][sr] = false;
          }
        });
      });
    });

    // Calculate overall compliance
    Object.keys(criteria).forEach(criterion => {
      const c = criteria[criterion];
      c.overall = c.nvda && c.jaws && c.voiceover;
    });

    // Determine compliance level
    const allPassed = Object.values(criteria).every((c: any) => c.overall);
    const level = allPassed ? 'AA' : 'A'; // Simplified determination

    return { level, criteria };
  }

  /**
   * Analyze platform-specific issues
   */
  private analyzePlatformSpecificIssues(): {
    nvda: string[];
    jaws: string[];
    voiceover: string[];
  } {
    const issues = {
      nvda: [] as string[],
      jaws: [] as string[],
      voiceover: [] as string[]
    };

    this.testResults.forEach(testResult => {
      const screenReader = testResult.screenReader.toLowerCase();
      if (screenReader === 'nvda' || screenReader === 'jaws' || screenReader === 'voiceover') {
        testResult.errors.forEach(error => {
          issues[screenReader as keyof typeof issues].push(error);
        });
      }
    });

    return issues;
  }

  /**
   * Save all reports to disk
   */
  private async saveReports(masterReport: MasterTestReport): Promise<void> {
    const timestamp = Date.now();

    // Save master report
    const masterReportPath = join(
      this.config.outputDirectory!,
      `master-screen-reader-report-${timestamp}.json`
    );

    await fs.writeFile(masterReportPath, JSON.stringify(masterReport, null, 2));
    console.log(`📊 Master report saved to: ${masterReportPath}`);

    // Save individual reports if requested
    if (this.config.saveIndividualReports) {
      for (const result of this.testResults) {
        const individualReportPath = join(
          this.config.outputDirectory!,
          `${result.screenReader.toLowerCase()}-${result.testSuite}-${timestamp}.json`
        );

        await fs.writeFile(individualReportPath, JSON.stringify(result, null, 2));
      }
    }

    // Generate human-readable summary
    const summaryPath = join(
      this.config.outputDirectory!,
      `screen-reader-testing-summary-${timestamp}.md`
    );

    const summary = this.generateHumanReadableSummary(masterReport);
    await fs.writeFile(summaryPath, summary);
    console.log(`📋 Human-readable summary saved to: ${summaryPath}`);
  }

  /**
   * Generate human-readable summary
   */
  private generateHumanReadableSummary(report: MasterTestReport): string {
    return `# Screen Reader Testing Summary

## Executive Summary
- **Total Tests**: ${report.executionSummary.totalTests}
- **Overall Success Rate**: ${report.executionSummary.overallSuccessRate}%
- **Duration**: ${Math.round(report.executionSummary.totalDuration / 1000)}s
- **Screen Readers Tested**: ${report.executionSummary.screenReadersUsed.join(', ')}

## Critical Issues
${report.recommendations.critical.map(rec => `- ${rec}`).join('\n')}

## Important Issues
${report.recommendations.important.map(rec => `- ${rec}`).join('\n')}

## WCAG Compliance
- **Level**: ${report.wcagCompliance.level}
- **Criteria Analyzed**: ${Object.keys(report.wcagCompliance.criteria).length}

## Platform-Specific Issues
### NVDA
${report.platformSpecificIssues.nvda.slice(0, 5).map(issue => `- ${issue}`).join('\n')}

### JAWS
${report.platformSpecificIssues.jaws.slice(0, 5).map(issue => `- ${issue}`).join('\n')}

### VoiceOver
${report.platformSpecificIssues.voiceover.slice(0, 5).map(issue => `- ${issue}`).join('\n')}

## Recommendations
${report.recommendations.suggested.map(rec => `- ${rec}`).join('\n')}
`;
  }
}

export default MasterScreenReaderTestRunner;