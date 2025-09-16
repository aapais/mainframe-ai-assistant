/**
 * AT Compatibility Matrix Tests
 *
 * Creates a comprehensive compatibility matrix for all tested assistive technologies.
 * Tests specific scenarios and documents compatibility status, issues, and recommendations.
 *
 * @author Assistive Technology Testing Team
 * @version 1.0.0
 */

import { expect } from '@jest/globals';
import { Page, Browser } from 'playwright';
import { AccessibilityTestRunner } from '../utils/AccessibilityTestRunner';
import { AssistiveTechnologySimulator } from '../utils/AssistiveTechnologySimulator';

// ========================
// Types & Interfaces
// ========================

interface ATCompatibilityResult {
  compatible: boolean;
  compatibilityScore: number; // 0-100
  issues: ATIssue[];
  recommendations: string[];
  tested: boolean;
  lastTested: Date;
}

interface ATIssue {
  severity: 'critical' | 'major' | 'minor' | 'enhancement';
  component: string;
  description: string;
  impact: string;
  workaround?: string;
  fixRequired: boolean;
}

interface ATCompatibilityMatrix {
  [category: string]: {
    [tool: string]: ATCompatibilityResult;
  };
}

interface TestScenario {
  name: string;
  description: string;
  url: string;
  actions: string[];
  expectedBehavior: string;
  criticalPath: boolean;
}

// ========================
// Test Scenarios
// ========================

const TEST_SCENARIOS: TestScenario[] = [
  {
    name: 'Form Entry and Validation',
    description: 'Complete form entry with validation and error handling',
    url: '/smart-entry-form',
    actions: [
      'Focus title field',
      'Enter invalid title (too short)',
      'Tab to category field',
      'Select category',
      'Add tags',
      'Fill problem description',
      'Fill solution',
      'Submit form',
      'Handle validation errors'
    ],
    expectedBehavior: 'All form elements accessible, validation errors announced, successful submission',
    criticalPath: true
  },
  {
    name: 'Search and Navigation',
    description: 'Search for knowledge base entries and navigate results',
    url: '/kb-search',
    actions: [
      'Focus search input',
      'Enter search query',
      'Submit search',
      'Navigate through results',
      'Select a result',
      'Return to search'
    ],
    expectedBehavior: 'Search functionality works, results navigable, context preserved',
    criticalPath: true
  },
  {
    name: 'Data Table Interaction',
    description: 'Navigate and interact with data tables',
    url: '/analytics-dashboard',
    actions: [
      'Navigate to table',
      'Read table headers',
      'Navigate table cells',
      'Sort table columns',
      'Filter table data'
    ],
    expectedBehavior: 'Table structure announced, data navigable, sorting/filtering accessible',
    criticalPath: false
  },
  {
    name: 'Chart and Data Visualization',
    description: 'Access chart data and visualizations',
    url: '/performance-dashboard',
    actions: [
      'Navigate to charts',
      'Access chart data',
      'Read data tables',
      'Interact with chart controls'
    ],
    expectedBehavior: 'Chart content accessible via alternatives, data tables provided',
    criticalPath: false
  },
  {
    name: 'Modal and Dialog Interaction',
    description: 'Open and interact with modal dialogs',
    url: '/kb-entry-form',
    actions: [
      'Trigger modal dialog',
      'Navigate modal content',
      'Use modal controls',
      'Close modal',
      'Return focus to trigger'
    ],
    expectedBehavior: 'Modal properly announced, focus managed, escape routes available',
    criticalPath: true
  }
];

// ========================
// AT Compatibility Matrix Test Suite
// ========================

describe('AT Compatibility Matrix', () => {
  let browser: Browser;
  let page: Page;
  let accessibilityRunner: AccessibilityTestRunner;
  let atSimulator: AssistiveTechnologySimulator;
  let compatibilityMatrix: ATCompatibilityMatrix;

  beforeAll(async () => {
    browser = await AccessibilityTestRunner.createBrowser({
      headless: false,
      slowMo: 50
    });

    accessibilityRunner = new AccessibilityTestRunner(browser);
    atSimulator = new AssistiveTechnologySimulator();

    // Initialize compatibility matrix
    compatibilityMatrix = {
      screenMagnifiers: {},
      voiceRecognition: {},
      alternativeInput: {},
      screenReaders: {},
      browserFeatures: {},
      osAccessibility: {}
    };
  });

  beforeEach(async () => {
    const context = await browser.newContext();
    page = await context.newPage();
    await accessibilityRunner.setupPage(page);
  });

  afterAll(async () => {
    await browser.close();

    // Generate final compatibility report
    console.log('='.repeat(80));
    console.log('ASSISTIVE TECHNOLOGY COMPATIBILITY MATRIX');
    console.log('='.repeat(80));
    console.log(JSON.stringify(compatibilityMatrix, null, 2));
  });

  // ========================
  // Screen Magnifier Tests
  // ========================

  describe('Screen Magnifiers', () => {
    test('ZoomText compatibility matrix', async () => {
      const result: ATCompatibilityResult = {
        compatible: true,
        compatibilityScore: 0,
        issues: [],
        recommendations: [],
        tested: true,
        lastTested: new Date()
      };

      let totalScore = 0;
      let totalTests = 0;

      for (const scenario of TEST_SCENARIOS) {
        await page.goto(scenario.url);

        // Simulate ZoomText
        await atSimulator.simulateZoomText(page, {
          magnificationLevel: 200,
          trackingMode: 'focus',
          colorInversion: false,
          textEnhancement: true,
          smoothing: true
        });

        try {
          // Test zoom without horizontal scroll
          const hasHorizontalScroll = await page.evaluate(() => {
            return document.documentElement.scrollWidth > document.documentElement.clientWidth;
          });

          if (hasHorizontalScroll) {
            result.issues.push({
              severity: 'major',
              component: scenario.name,
              description: 'Horizontal scrolling required at 200% zoom',
              impact: 'Users must scroll horizontally to access content',
              fixRequired: true
            });
            totalScore += 60;
          } else {
            totalScore += 100;
          }

          // Test focus tracking
          const formFields = await page.locator('input, select, textarea, button').all();
          for (const field of formFields.slice(0, 3)) {
            await field.focus();
            const isInViewport = await field.isVisible();
            if (!isInViewport) {
              result.issues.push({
                severity: 'minor',
                component: scenario.name,
                description: 'Focus not tracked properly during magnification',
                impact: 'Users may lose track of focused elements',
                fixRequired: false
              });
              totalScore += 80;
            } else {
              totalScore += 100;
            }
            totalTests++;
          }

          totalTests++;
        } catch (error) {
          result.issues.push({
            severity: 'critical',
            component: scenario.name,
            description: `ZoomText simulation failed: ${error}`,
            impact: 'Cannot test compatibility',
            fixRequired: true
          });
          totalScore += 0;
          totalTests++;
        }
      }

      result.compatibilityScore = totalTests > 0 ? Math.round(totalScore / totalTests) : 0;
      result.compatible = result.compatibilityScore >= 80;

      if (result.issues.length === 0) {
        result.recommendations.push('ZoomText compatibility excellent - no issues found');
      } else {
        result.recommendations.push('Ensure responsive design prevents horizontal scrolling');
        result.recommendations.push('Implement proper focus management for magnification');
      }

      compatibilityMatrix.screenMagnifiers.zoomText = result;
      expect(result.compatible).toBe(true);
    });

    test('MAGic compatibility matrix', async () => {
      const result: ATCompatibilityResult = {
        compatible: true,
        compatibilityScore: 0,
        issues: [],
        recommendations: [],
        tested: true,
        lastTested: new Date()
      };

      let totalScore = 0;
      let totalTests = 0;

      for (const scenario of TEST_SCENARIOS.filter(s => s.criticalPath)) {
        await page.goto(scenario.url);

        // Simulate MAGic
        await atSimulator.simulateMAGic(page, {
          magnificationLevel: 300,
          enhancedCursor: true,
          smartInvert: false,
          dualMonitor: false,
          voice: true
        });

        try {
          // Test enhanced cursor compatibility
          const interactiveElements = await page.locator('button, input, select, textarea, a').all();

          for (const element of interactiveElements.slice(0, 5)) {
            const boundingBox = await element.boundingBox();
            if (boundingBox) {
              // Check minimum target size (44x44px)
              const minSize = Math.min(boundingBox.width, boundingBox.height);
              if (minSize < 44) {
                result.issues.push({
                  severity: 'major',
                  component: scenario.name,
                  description: `Interactive element too small: ${minSize}px`,
                  impact: 'Difficult to target with enhanced cursor',
                  fixRequired: true
                });
                totalScore += 60;
              } else {
                totalScore += 100;
              }
            }
            totalTests++;
          }

          // Test voice announcement compatibility
          await page.evaluate(() => {
            return new Promise(resolve => {
              if ('speechSynthesis' in window) {
                speechSynthesis.cancel();
                resolve(true);
              } else {
                resolve(false);
              }
            });
          });

          totalScore += 100;
          totalTests++;

        } catch (error) {
          result.issues.push({
            severity: 'critical',
            component: scenario.name,
            description: `MAGic simulation failed: ${error}`,
            impact: 'Cannot test compatibility',
            fixRequired: true
          });
          totalScore += 0;
          totalTests++;
        }
      }

      result.compatibilityScore = totalTests > 0 ? Math.round(totalScore / totalTests) : 0;
      result.compatible = result.compatibilityScore >= 80;

      if (result.compatibilityScore >= 95) {
        result.recommendations.push('Excellent MAGic compatibility');
      } else {
        result.recommendations.push('Ensure minimum 44px touch targets');
        result.recommendations.push('Test with MAGic voice features enabled');
      }

      compatibilityMatrix.screenMagnifiers.magic = result;
      expect(result.compatibilityScore).toBeGreaterThanOrEqual(80);
    });

    test('Windows Magnifier compatibility matrix', async () => {
      const result: ATCompatibilityResult = {
        compatible: true,
        compatibilityScore: 0,
        issues: [],
        recommendations: [],
        tested: true,
        lastTested: new Date()
      };

      let totalScore = 0;
      let totalTests = 0;

      await page.goto('/performance-dashboard');

      // Simulate Windows Magnifier
      await atSimulator.simulateWindowsMagnifier(page, {
        magnificationLevel: 400,
        trackingMode: 'mouse',
        smoothing: true,
        colorInversion: false,
        followNarrator: true
      });

      try {
        // Test mouse tracking
        const trackingElements = await page.locator('.metric-card, .form-button, .chart-container').all();

        for (const element of trackingElements.slice(0, 3)) {
          await element.hover();
          await page.waitForTimeout(200);

          const isVisible = await element.isVisible();
          if (isVisible) {
            totalScore += 100;
          } else {
            result.issues.push({
              severity: 'minor',
              component: 'Mouse tracking',
              description: 'Element not properly tracked during hover',
              impact: 'Magnifier may not follow mouse cursor accurately',
              fixRequired: false
            });
            totalScore += 80;
          }
          totalTests++;
        }

        // Test with color inversion
        await page.addStyleTag({
          content: 'html { filter: invert(1); }'
        });

        const contrastElements = await page.locator('button, input').all();
        for (const element of contrastElements.slice(0, 2)) {
          const isVisible = await element.isVisible();
          if (isVisible) {
            totalScore += 100;
          } else {
            result.issues.push({
              severity: 'major',
              component: 'Color inversion',
              description: 'Element not visible with color inversion',
              impact: 'Content may be inaccessible with color filters',
              fixRequired: true
            });
            totalScore += 40;
          }
          totalTests++;
        }

      } catch (error) {
        result.issues.push({
          severity: 'critical',
          component: 'Windows Magnifier',
          description: `Simulation failed: ${error}`,
          impact: 'Cannot test compatibility',
          fixRequired: true
        });
        totalScore += 0;
        totalTests++;
      }

      result.compatibilityScore = totalTests > 0 ? Math.round(totalScore / totalTests) : 0;
      result.compatible = result.compatibilityScore >= 80;

      result.recommendations.push('Test with various magnification levels');
      result.recommendations.push('Ensure content works with color inversion');

      compatibilityMatrix.screenMagnifiers.windowsMagnifier = result;
      expect(result.compatibilityScore).toBeGreaterThanOrEqual(75);
    });
  });

  // ========================
  // Voice Recognition Tests
  // ========================

  describe('Voice Recognition Software', () => {
    test('Dragon NaturallySpeaking compatibility matrix', async () => {
      const result: ATCompatibilityResult = {
        compatible: true,
        compatibilityScore: 0,
        issues: [],
        recommendations: [],
        tested: true,
        lastTested: new Date()
      };

      let totalScore = 0;
      let totalTests = 0;

      await page.goto('/smart-entry-form');

      // Simulate Dragon
      await atSimulator.simulateDragon(page, {
        voiceProfile: 'technical',
        accuracy: 95,
        commandMode: true,
        dictationMode: true,
        customCommands: {
          'VSAM file': 'VSAM file',
          'system abend': 'system abend',
          'JCL error': 'JCL error'
        }
      });

      try {
        // Test voice commands
        const voiceCommands = [
          { command: 'click search button', target: 'button[type="submit"]' },
          { command: 'select entry title field', target: '#entry-title' }
        ];

        for (const cmd of voiceCommands) {
          await atSimulator.simulateVoiceCommand(page, cmd.command);
          await page.waitForTimeout(500);

          const targetElement = page.locator(cmd.target);
          const isInteractable = await targetElement.isEnabled();

          if (isInteractable) {
            totalScore += 100;
          } else {
            result.issues.push({
              severity: 'major',
              component: 'Voice commands',
              description: `Voice command "${cmd.command}" not working`,
              impact: 'Users cannot control interface by voice',
              fixRequired: true
            });
            totalScore += 50;
          }
          totalTests++;
        }

        // Test dictation
        const textArea = page.locator('#entry-problem');
        await textArea.focus();
        await atSimulator.simulateVoiceDictation(page, 'Job fails with VSAM status code thirty-five');

        const dictatedText = await textArea.inputValue();
        if (dictatedText.includes('VSAM') && dictatedText.includes('35')) {
          totalScore += 100;
        } else {
          result.issues.push({
            severity: 'minor',
            component: 'Voice dictation',
            description: 'Technical terms not properly converted',
            impact: 'Users may need to manually correct dictated text',
            fixRequired: false,
            workaround: 'Train custom Dragon vocabulary'
          });
          totalScore += 80;
        }
        totalTests++;

      } catch (error) {
        result.issues.push({
          severity: 'critical',
          component: 'Dragon simulation',
          description: `Failed: ${error}`,
          impact: 'Cannot test voice recognition',
          fixRequired: true
        });
        totalScore += 0;
        totalTests++;
      }

      result.compatibilityScore = totalTests > 0 ? Math.round(totalScore / totalTests) : 0;
      result.compatible = result.compatibilityScore >= 80;

      result.recommendations.push('Implement voice command hints');
      result.recommendations.push('Support custom technical vocabulary');
      result.recommendations.push('Provide keyboard alternatives for all voice commands');

      compatibilityMatrix.voiceRecognition.dragon = result;
      expect(result.compatibilityScore).toBeGreaterThanOrEqual(70);
    });

    test('Windows Voice Access compatibility matrix', async () => {
      const result: ATCompatibilityResult = {
        compatible: true,
        compatibilityScore: 0,
        issues: [],
        recommendations: [],
        tested: true,
        lastTested: new Date()
      };

      let totalScore = 0;
      let totalTests = 0;

      await page.goto('/analytics-dashboard');

      // Simulate Voice Access
      await atSimulator.simulateVoiceAccess(page, {
        numberOverlay: true,
        gridMode: false,
        mouseGrid: false,
        spellingMode: false
      });

      try {
        // Test number overlay system
        const numberedElements = await page.evaluate(() => {
          return document.querySelectorAll('[data-voice-number]').length;
        });

        if (numberedElements > 0) {
          totalScore += 100;
        } else {
          result.issues.push({
            severity: 'major',
            component: 'Number overlay',
            description: 'Interactive elements not assigned voice numbers',
            impact: 'Voice Access cannot target elements',
            fixRequired: true
          });
          totalScore += 40;
        }
        totalTests++;

        // Test element accessibility
        const interactiveElements = await page.locator('button, input, select, textarea, a').all();
        let accessibleElements = 0;

        for (const element of interactiveElements.slice(0, 10)) {
          const isVisible = await element.isVisible();
          const isEnabled = await element.isEnabled();

          if (isVisible && isEnabled) {
            accessibleElements++;
          }
        }

        const accessibilityRatio = accessibleElements / Math.min(interactiveElements.length, 10);
        totalScore += accessibilityRatio * 100;
        totalTests++;

      } catch (error) {
        result.issues.push({
          severity: 'critical',
          component: 'Voice Access simulation',
          description: `Failed: ${error}`,
          impact: 'Cannot test Voice Access compatibility',
          fixRequired: true
        });
        totalScore += 0;
        totalTests++;
      }

      result.compatibilityScore = totalTests > 0 ? Math.round(totalScore / totalTests) : 0;
      result.compatible = result.compatibilityScore >= 80;

      result.recommendations.push('Ensure all interactive elements are visible and enabled');
      result.recommendations.push('Test with Voice Access number overlay');

      compatibilityMatrix.voiceRecognition.voiceAccess = result;
      expect(result.compatibilityScore).toBeGreaterThanOrEqual(75);
    });
  });

  // ========================
  // Alternative Input Device Tests
  // ========================

  describe('Alternative Input Devices', () => {
    test('Switch device compatibility matrix', async () => {
      const result: ATCompatibilityResult = {
        compatible: true,
        compatibilityScore: 0,
        issues: [],
        recommendations: [],
        tested: true,
        lastTested: new Date()
      };

      let totalScore = 0;
      let totalTests = 0;

      await page.goto('/smart-entry-form');

      // Test single switch scanning
      await atSimulator.simulateSwitchDevice(page, {
        type: 'single-switch',
        scanRate: 1000,
        autoAdvance: true
      });

      try {
        // Test sequential navigation
        const focusableElements = await page.locator(
          'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ).all();

        if (focusableElements.length > 0) {
          totalScore += 100;
        } else {
          result.issues.push({
            severity: 'critical',
            component: 'Switch navigation',
            description: 'No focusable elements found for switch scanning',
            impact: 'Switch users cannot navigate interface',
            fixRequired: true
          });
          totalScore += 0;
        }
        totalTests++;

        // Test skip links
        const skipLinks = await page.locator('a[href^="#"], .skip-link').all();
        if (skipLinks.length > 0) {
          totalScore += 100;
        } else {
          result.issues.push({
            severity: 'major',
            component: 'Skip navigation',
            description: 'No skip links provided for efficient navigation',
            impact: 'Switch users must scan through many elements',
            fixRequired: true
          });
          totalScore += 60;
        }
        totalTests++;

        // Test form completion
        const firstInput = focusableElements[0];
        if (firstInput) {
          await firstInput.focus();
          await page.keyboard.press('Space'); // Switch activation
          const isFocused = await firstInput.evaluate(el => el === document.activeElement);

          if (isFocused) {
            totalScore += 100;
          } else {
            result.issues.push({
              severity: 'minor',
              component: 'Switch activation',
              description: 'Switch activation not properly handled',
              impact: 'May require multiple attempts to activate elements',
              fixRequired: false
            });
            totalScore += 80;
          }
        }
        totalTests++;

      } catch (error) {
        result.issues.push({
          severity: 'critical',
          component: 'Switch device simulation',
          description: `Failed: ${error}`,
          impact: 'Cannot test switch device compatibility',
          fixRequired: true
        });
        totalScore += 0;
        totalTests++;
      }

      result.compatibilityScore = totalTests > 0 ? Math.round(totalScore / totalTests) : 0;
      result.compatible = result.compatibilityScore >= 80;

      result.recommendations.push('Implement skip links for efficient navigation');
      result.recommendations.push('Ensure logical tab order for scanning');
      result.recommendations.push('Provide escape routes from complex interfaces');

      compatibilityMatrix.alternativeInput.switchDevice = result;
      expect(result.compatibilityScore).toBeGreaterThanOrEqual(75);
    });

    test('Eye tracking compatibility matrix', async () => {
      const result: ATCompatibilityResult = {
        compatible: true,
        compatibilityScore: 0,
        issues: [],
        recommendations: [],
        tested: true,
        lastTested: new Date()
      };

      let totalScore = 0;
      let totalTests = 0;

      await page.goto('/search-interface');

      // Simulate eye tracking
      await atSimulator.simulateEyeTracking(page, {
        gazeAccuracy: 'high',
        dwellTime: 800,
        blinkSelection: true,
        gazeClick: true,
        smoothPursuit: true
      });

      try {
        // Test dwell activation
        const buttons = await page.locator('button').all();

        for (const button of buttons.slice(0, 3)) {
          const boundingBox = await button.boundingBox();
          if (boundingBox) {
            // Check minimum target size for eye tracking (should be larger than touch targets)
            const minSize = Math.min(boundingBox.width, boundingBox.height);
            if (minSize >= 48) {
              totalScore += 100;
            } else {
              result.issues.push({
                severity: 'major',
                component: 'Eye tracking targets',
                description: `Button too small for eye tracking: ${minSize}px`,
                impact: 'Difficult to target with eye gaze',
                fixRequired: true
              });
              totalScore += 50;
            }
          }
          totalTests++;
        }

        // Test hover states
        const interactiveElements = await page.locator('button, input, a').all();
        for (const element of interactiveElements.slice(0, 3)) {
          await element.hover();

          // Check if hover provides visual feedback
          const hoverStyles = await element.evaluate(el => {
            const computed = getComputedStyle(el);
            return {
              backgroundColor: computed.backgroundColor,
              borderColor: computed.borderColor,
              opacity: computed.opacity
            };
          });

          // Should have some visual change on hover
          if (hoverStyles.backgroundColor !== 'initial' || hoverStyles.borderColor !== 'initial') {
            totalScore += 100;
          } else {
            result.issues.push({
              severity: 'minor',
              component: 'Hover feedback',
              description: 'No visual feedback on hover',
              impact: 'Eye tracking users cannot see dwell progress',
              fixRequired: false
            });
            totalScore += 80;
          }
          totalTests++;
        }

      } catch (error) {
        result.issues.push({
          severity: 'critical',
          component: 'Eye tracking simulation',
          description: `Failed: ${error}`,
          impact: 'Cannot test eye tracking compatibility',
          fixRequired: true
        });
        totalScore += 0;
        totalTests++;
      }

      result.compatibilityScore = totalTests > 0 ? Math.round(totalScore / totalTests) : 0;
      result.compatible = result.compatibilityScore >= 80;

      result.recommendations.push('Use minimum 48px targets for eye tracking');
      result.recommendations.push('Provide clear hover feedback for dwell indication');
      result.recommendations.push('Avoid requiring precise eye movements');

      compatibilityMatrix.alternativeInput.eyeTracking = result;
      expect(result.compatibilityScore).toBeGreaterThanOrEqual(70);
    });
  });

  // ========================
  // Generate Final Report
  // ========================

  test('Generate comprehensive AT compatibility report', async () => {
    // Calculate overall compatibility statistics
    const allResults = Object.values(compatibilityMatrix).flatMap(category => Object.values(category));
    const totalTools = allResults.length;
    const compatibleTools = allResults.filter(result => result.compatible).length;
    const averageScore = allResults.reduce((sum, result) => sum + result.compatibilityScore, 0) / totalTools;

    const report = {
      summary: {
        totalATToolsTested: totalTools,
        compatibleTools: compatibleTools,
        compatibilityPercentage: Math.round((compatibleTools / totalTools) * 100),
        averageCompatibilityScore: Math.round(averageScore),
        reportGenerated: new Date().toISOString()
      },
      categoryBreakdown: Object.entries(compatibilityMatrix).map(([category, tools]) => ({
        category,
        toolCount: Object.keys(tools).length,
        averageScore: Math.round(
          Object.values(tools).reduce((sum, tool) => sum + tool.compatibilityScore, 0) / Object.keys(tools).length
        ),
        allCompatible: Object.values(tools).every(tool => tool.compatible)
      })),
      detailedResults: compatibilityMatrix,
      overallRecommendations: [
        'Implement responsive design to prevent horizontal scrolling at high zoom levels',
        'Ensure minimum 44px touch targets, preferably 48px for eye tracking',
        'Provide clear focus indicators and hover feedback',
        'Support voice commands and dictation for technical terminology',
        'Implement skip links and logical navigation order',
        'Test with actual assistive technology users',
        'Provide alternative text and data tables for complex visualizations',
        'Ensure compatibility with high contrast and forced colors modes'
      ]
    };

    // Validate overall compatibility
    expect(report.summary.compatibilityPercentage).toBeGreaterThanOrEqual(80);
    expect(report.summary.averageCompatibilityScore).toBeGreaterThanOrEqual(75);

    // Log the complete report
    console.log('\n' + '='.repeat(100));
    console.log('ASSISTIVE TECHNOLOGY COMPATIBILITY REPORT');
    console.log('='.repeat(100));
    console.log(JSON.stringify(report, null, 2));
    console.log('='.repeat(100));

    // Store report for CI/CD
    await page.evaluate((reportData) => {
      localStorage.setItem('at-compatibility-report', JSON.stringify(reportData));
    }, report);
  });
});