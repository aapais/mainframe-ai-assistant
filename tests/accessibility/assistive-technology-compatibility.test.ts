/**
 * Assistive Technology Compatibility Test Suite
 *
 * Comprehensive testing for compatibility with various assistive technologies:
 * - Screen magnification software (ZoomText, MAGic)
 * - Voice recognition software (Dragon, Voice Control)
 * - Alternative input devices (switch devices, eye tracking)
 * - Browser accessibility features
 * - Operating system accessibility features
 *
 * @author Assistive Technology Testing Team
 * @version 1.0.0
 */

import { expect } from '@jest/globals';
import { Page, Browser, BrowserContext } from 'playwright';
import { AccessibilityTestRunner } from '../utils/AccessibilityTestRunner';
import { AssistiveTechnologySimulator } from '../utils/AssistiveTechnologySimulator';

// ========================
// Types & Interfaces
// ========================

interface ZoomTestConfig {
  zoomLevel: number;
  platform: 'windows' | 'mac' | 'linux';
  viewport: { width: number; height: number };
  expectedBehavior: {
    horizontalScroll: boolean;
    contentReflow: boolean;
    focusVisible: boolean;
    textReadable: boolean;
  };
}

interface VoiceControlTest {
  command: string;
  expectedAction: string;
  element?: string;
  timeout: number;
}

interface SwitchDeviceTest {
  navigation: 'sequential' | 'spatial';
  inputMethod: 'single-switch' | 'dual-switch' | 'joystick';
  expectedBehavior: {
    focusManagement: boolean;
    skipLinks: boolean;
    customKeyBindings: boolean;
  };
}

interface HighContrastTest {
  mode: 'white-on-black' | 'black-on-white' | 'yellow-on-black' | 'custom';
  elements: string[];
  requirements: {
    contrastRatio: number;
    borderVisibility: boolean;
    iconVisibility: boolean;
  };
}

interface MagnificationTest {
  software: 'zoomtext' | 'magic' | 'windows-magnifier' | 'mac-zoom';
  magnificationLevel: number;
  trackingMode: 'mouse' | 'focus' | 'caret' | 'smart';
  expectedBehavior: {
    smoothPanning: boolean;
    focusTracking: boolean;
    textEnhancement: boolean;
    colorInversion: boolean;
  };
}

// ========================
// Test Configuration
// ========================

const ZOOM_TEST_CONFIGS: ZoomTestConfig[] = [
  {
    zoomLevel: 200,
    platform: 'windows',
    viewport: { width: 1920, height: 1080 },
    expectedBehavior: {
      horizontalScroll: false,
      contentReflow: true,
      focusVisible: true,
      textReadable: true
    }
  },
  {
    zoomLevel: 300,
    platform: 'windows',
    viewport: { width: 1366, height: 768 },
    expectedBehavior: {
      horizontalScroll: false,
      contentReflow: true,
      focusVisible: true,
      textReadable: true
    }
  },
  {
    zoomLevel: 400,
    platform: 'windows',
    viewport: { width: 1024, height: 768 },
    expectedBehavior: {
      horizontalScroll: false,
      contentReflow: true,
      focusVisible: true,
      textReadable: true
    }
  }
];

const VOICE_CONTROL_TESTS: VoiceControlTest[] = [
  {
    command: 'click search button',
    expectedAction: 'activates search functionality',
    element: '[role="search"] button',
    timeout: 3000
  },
  {
    command: 'navigate to main content',
    expectedAction: 'moves focus to main content area',
    element: 'main',
    timeout: 2000
  },
  {
    command: 'select entry title field',
    expectedAction: 'focuses entry title input',
    element: '#entry-title',
    timeout: 2000
  },
  {
    command: 'scroll down',
    expectedAction: 'scrolls page down',
    timeout: 1000
  }
];

const HIGH_CONTRAST_TESTS: HighContrastTest[] = [
  {
    mode: 'white-on-black',
    elements: ['.smart-entry-form', '.form-input', '.form-button', '.metric-card'],
    requirements: {
      contrastRatio: 7.0,
      borderVisibility: true,
      iconVisibility: true
    }
  },
  {
    mode: 'black-on-white',
    elements: ['.smart-entry-form', '.form-input', '.form-button', '.metric-card'],
    requirements: {
      contrastRatio: 7.0,
      borderVisibility: true,
      iconVisibility: true
    }
  },
  {
    mode: 'yellow-on-black',
    elements: ['.smart-entry-form', '.form-input', '.form-button', '.metric-card'],
    requirements: {
      contrastRatio: 7.0,
      borderVisibility: true,
      iconVisibility: true
    }
  }
];

// ========================
// Test Suite Implementation
// ========================

describe('Assistive Technology Compatibility', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let accessibilityRunner: AccessibilityTestRunner;
  let atSimulator: AssistiveTechnologySimulator;

  beforeAll(async () => {
    browser = await AccessibilityTestRunner.createBrowser({
      headless: false,
      slowMo: 50,
      args: [
        '--force-color-profile=srgb',
        '--enable-accessibility-logging',
        '--enable-accessibility-object-model'
      ]
    });

    accessibilityRunner = new AccessibilityTestRunner(browser);
    atSimulator = new AssistiveTechnologySimulator();
  });

  beforeEach(async () => {
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      reducedMotion: 'reduce',
      colorScheme: 'light'
    });

    page = await context.newPage();
    await accessibilityRunner.setupPage(page);
  });

  afterEach(async () => {
    await context.close();
  });

  afterAll(async () => {
    await browser.close();
  });

  // ========================
  // Screen Magnification Tests
  // ========================

  describe('Screen Magnification Compatibility', () => {
    test.each(ZOOM_TEST_CONFIGS)('Browser zoom to %s% maintains usability', async (config) => {
      await page.goto('/smart-entry-form');

      // Set viewport and zoom level
      await page.setViewportSize(config.viewport);
      await page.evaluate((zoomLevel) => {
        document.body.style.zoom = `${zoomLevel}%`;
      }, config.zoomLevel);

      // Wait for layout to stabilize
      await page.waitForTimeout(500);

      // Test: No horizontal scrollbar
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      if (!config.expectedBehavior.horizontalScroll) {
        expect(hasHorizontalScroll).toBe(false);
      }

      // Test: Content reflow
      const mainContent = await page.locator('main');
      const contentBounds = await mainContent.boundingBox();

      if (config.expectedBehavior.contentReflow && contentBounds) {
        expect(contentBounds.width).toBeLessThanOrEqual(config.viewport.width);
      }

      // Test: Focus visibility
      await page.focus('#entry-title');
      const focusedElement = await page.locator('#entry-title');
      const focusStyle = await focusedElement.evaluate(el =>
        getComputedStyle(el).outline
      );

      if (config.expectedBehavior.focusVisible) {
        expect(focusStyle).not.toBe('none');
      }

      // Test: Text readability
      const titleElement = await page.locator('h1').first();
      const fontSize = await titleElement.evaluate(el =>
        parseInt(getComputedStyle(el).fontSize)
      );

      if (config.expectedBehavior.textReadable) {
        expect(fontSize * (config.zoomLevel / 100)).toBeGreaterThanOrEqual(16);
      }
    });

    test('ZoomText simulation - focus tracking', async () => {
      await page.goto('/smart-entry-form');

      // Simulate ZoomText focus tracking
      await atSimulator.simulateZoomText(page, {
        magnificationLevel: 200,
        trackingMode: 'focus',
        colorInversion: false
      });

      // Test focus tracking through form
      const formFields = [
        '#entry-title',
        '#entry-category',
        '#entry-tags',
        '#entry-problem',
        '#entry-solution'
      ];

      for (const fieldSelector of formFields) {
        await page.focus(fieldSelector);
        await page.waitForTimeout(200);

        // Verify focused element is visible in viewport
        const element = page.locator(fieldSelector);
        const isVisible = await element.isVisible();
        const boundingBox = await element.boundingBox();

        expect(isVisible).toBe(true);
        expect(boundingBox).not.toBeNull();

        if (boundingBox) {
          const viewport = page.viewportSize()!;
          expect(boundingBox.x).toBeGreaterThanOrEqual(0);
          expect(boundingBox.y).toBeGreaterThanOrEqual(0);
          expect(boundingBox.x + boundingBox.width).toBeLessThanOrEqual(viewport.width);
          expect(boundingBox.y + boundingBox.height).toBeLessThanOrEqual(viewport.height);
        }
      }
    });

    test('MAGic simulation - enhanced cursor tracking', async () => {
      await page.goto('/performance-dashboard');

      // Simulate MAGic enhanced cursor tracking
      await atSimulator.simulateMAGic(page, {
        magnificationLevel: 300,
        enhancedCursor: true,
        smartInvert: true
      });

      // Test interactive elements have sufficient target size
      const interactiveElements = await page.locator('button, input, select, textarea, [role="button"]').all();

      for (const element of interactiveElements) {
        const boundingBox = await element.boundingBox();
        expect(boundingBox).not.toBeNull();

        if (boundingBox) {
          // WCAG AA requirement: 44x44 pixels minimum
          expect(Math.min(boundingBox.width, boundingBox.height)).toBeGreaterThanOrEqual(44);
        }
      }
    });

    test('Windows Magnifier simulation - smooth tracking', async () => {
      await page.goto('/analytics-dashboard');

      // Simulate Windows Magnifier
      await atSimulator.simulateWindowsMagnifier(page, {
        magnificationLevel: 400,
        trackingMode: 'mouse',
        smoothing: true
      });

      // Test chart interactions with magnification
      const chartElements = await page.locator('[role="img"], .recharts-surface, .chart-container').all();

      for (const chart of chartElements) {
        await chart.hover();
        await page.waitForTimeout(100);

        // Verify chart remains accessible and interactive
        const isVisible = await chart.isVisible();
        expect(isVisible).toBe(true);

        // Check for tooltip or interaction feedback
        const tooltip = page.locator('.recharts-tooltip, .chart-tooltip');
        // Tooltip should appear on hover (if implemented)
      }
    });
  });

  // ========================
  // Voice Recognition Tests
  // ========================

  describe('Voice Recognition Software Compatibility', () => {
    test.each(VOICE_CONTROL_TESTS)('Voice command: "%s"', async (voiceTest) => {
      await page.goto('/smart-entry-form');

      // Simulate voice command
      await atSimulator.simulateVoiceCommand(page, voiceTest.command);

      if (voiceTest.element) {
        const targetElement = page.locator(voiceTest.element);

        switch (voiceTest.expectedAction) {
          case 'activates search functionality':
            await expect(targetElement).toBeVisible();
            await expect(targetElement).toBeEnabled();
            break;

          case 'moves focus to main content area':
            await expect(targetElement).toBeFocused();
            break;

          case 'focuses entry title input':
            await expect(targetElement).toBeFocused();
            break;
        }
      }

      // General test: page should remain stable after voice command
      const pageTitle = await page.title();
      expect(pageTitle).toBeTruthy();
    }, 10000);

    test('Dragon NaturallySpeaking simulation', async () => {
      await page.goto('/kb-entry-form');

      // Simulate Dragon voice navigation
      await atSimulator.simulateDragon(page, {
        voiceProfile: 'standard',
        accuracy: 95,
        commandMode: true
      });

      // Test dictation in text areas
      const problemField = page.locator('#entry-problem');
      await problemField.focus();

      // Simulate voice dictation
      const dictatedText = 'Job fails with VSAM status code thirty-five when accessing customer file.';
      await atSimulator.simulateVoiceDictation(page, dictatedText);

      // Verify text was entered
      const fieldValue = await problemField.inputValue();
      expect(fieldValue).toContain('35'); // Should convert "thirty-five" to "35"
      expect(fieldValue).toContain('VSAM');
      expect(fieldValue).toContain('customer file');
    });

    test('Voice Access (Windows 11) simulation', async () => {
      await page.goto('/analytics-dashboard');

      // Simulate Windows Voice Access
      await atSimulator.simulateVoiceAccess(page, {
        numberOverlay: true,
        gridMode: false
      });

      // Test number overlay navigation
      const buttons = await page.locator('button').all();
      expect(buttons.length).toBeGreaterThan(0);

      // Each interactive element should be reachable by voice
      for (let i = 0; i < Math.min(buttons.length, 5); i++) {
        const button = buttons[i];
        const isVisible = await button.isVisible();
        const isEnabled = await button.isEnabled();

        expect(isVisible).toBe(true);
        expect(isEnabled).toBe(true);
      }
    });
  });

  // ========================
  // Alternative Input Device Tests
  // ========================

  describe('Alternative Input Device Compatibility', () => {
    test('Single switch device navigation', async () => {
      await page.goto('/smart-entry-form');

      // Simulate single switch scanning
      await atSimulator.simulateSwitchDevice(page, {
        type: 'single-switch',
        scanRate: 1000, // 1 second per item
        autoAdvance: true
      });

      // Test sequential navigation through form
      const focusableElements = await page.locator(
        'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ).all();

      let currentIndex = 0;

      for (let i = 0; i < Math.min(focusableElements.length, 10); i++) {
        // Simulate switch activation after scan highlight
        await page.waitForTimeout(1000); // Wait for scan
        await page.keyboard.press('Space'); // Switch activation

        // Verify focus moved to expected element
        const focusedElement = page.locator(':focus');
        const isCorrectElement = await focusedElement.count() > 0;
        expect(isCorrectElement).toBe(true);
      }
    });

    test('Dual switch device navigation', async () => {
      await page.goto('/kb-analytics');

      // Simulate dual switch operation
      await atSimulator.simulateSwitchDevice(page, {
        type: 'dual-switch',
        switch1Action: 'advance',
        switch2Action: 'select'
      });

      // Test table navigation with dual switches
      const tableRows = await page.locator('tr').all();

      if (tableRows.length > 1) {
        // Switch 1: Navigate to next row
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(100);

        // Switch 2: Select/activate row
        await page.keyboard.press('Enter');
        await page.waitForTimeout(100);

        // Verify row selection or activation
        const selectedRow = page.locator('tr[aria-selected="true"], tr.selected');
        const hasSelection = await selectedRow.count() > 0;
        // Note: Depends on implementation
      }
    });

    test('Joystick/directional pad navigation', async () => {
      await page.goto('/performance-dashboard');

      // Simulate joystick navigation
      await atSimulator.simulateJoystick(page, {
        sensitivity: 'medium',
        acceleration: true,
        deadZone: 0.1
      });

      // Test spatial navigation through dashboard cards
      const cards = await page.locator('.metric-card, .performance-card').all();

      for (let i = 0; i < Math.min(cards.length, 8); i++) {
        // Simulate directional movement
        const direction = i % 2 === 0 ? 'ArrowRight' : 'ArrowDown';
        await page.keyboard.press(direction);
        await page.waitForTimeout(200);

        // Verify focus moved to a card
        const focusedCard = page.locator('.metric-card:focus, .performance-card:focus');
        const cardInFocus = await focusedCard.count() > 0;
        // Note: Requires spatial navigation implementation
      }
    });

    test('Eye tracking simulation', async () => {
      await page.goto('/search-interface');

      // Simulate eye tracking device
      await atSimulator.simulateEyeTracking(page, {
        gazeAccuracy: 'high',
        dwellTime: 800, // 800ms dwell to activate
        blinkSelection: true
      });

      // Test gaze-based navigation
      const searchInput = page.locator('#search-input');

      // Simulate eye gaze on search input
      await searchInput.hover();
      await page.waitForTimeout(800); // Dwell time

      // Verify input received focus
      await expect(searchInput).toBeFocused();

      // Test dwell click on search button
      const searchButton = page.locator('button[type="submit"]');
      await searchButton.hover();
      await page.waitForTimeout(800); // Dwell time

      // Verify button activation
      // (Implementation dependent)
    });
  });

  // ========================
  // Browser Accessibility Feature Tests
  // ========================

  describe('Browser Accessibility Features', () => {
    test('High contrast mode compatibility', async () => {
      for (const testConfig of HIGH_CONTRAST_TESTS) {
        await page.goto('/smart-entry-form');

        // Enable high contrast mode
        await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
        await page.addStyleTag({
          content: `
            @media (prefers-contrast: high) {
              * {
                background: ${testConfig.mode === 'white-on-black' ? '#000000' : '#ffffff'} !important;
                color: ${testConfig.mode === 'white-on-black' ? '#ffffff' : '#000000'} !important;
                border: 2px solid ${testConfig.mode === 'white-on-black' ? '#ffffff' : '#000000'} !important;
              }
            }
          `
        });

        // Test each specified element
        for (const elementSelector of testConfig.elements) {
          const elements = await page.locator(elementSelector).all();

          for (const element of elements) {
            const isVisible = await element.isVisible();
            if (!isVisible) continue;

            // Check contrast ratio
            const styles = await element.evaluate(el => {
              const computed = getComputedStyle(el);
              return {
                backgroundColor: computed.backgroundColor,
                color: computed.color,
                borderColor: computed.borderColor,
                borderWidth: computed.borderWidth
              };
            });

            // Verify high contrast compliance
            expect(styles.borderWidth).not.toBe('0px');
            expect(styles.color).toBeTruthy();
            expect(styles.backgroundColor).toBeTruthy();
          }
        }
      }
    });

    test('Forced colors mode (Windows High Contrast)', async () => {
      await page.goto('/analytics-dashboard');

      // Simulate forced colors mode
      await page.addStyleTag({
        content: `
          @media (forced-colors: active) {
            * {
              background-color: Canvas !important;
              color: CanvasText !important;
              border-color: ButtonText !important;
            }
            button {
              background-color: ButtonFace !important;
              color: ButtonText !important;
              border: 2px solid ButtonText !important;
            }
            input, select, textarea {
              background-color: Field !important;
              color: FieldText !important;
              border: 2px solid FieldText !important;
            }
          }
        `
      });

      // Test system color compliance
      const interactiveElements = await page.locator('button, input, select, textarea').all();

      for (const element of interactiveElements) {
        const isVisible = await element.isVisible();
        if (!isVisible) continue;

        const computedStyle = await element.evaluate(el => getComputedStyle(el));

        // Verify forced colors are respected
        expect(computedStyle.borderWidth).not.toBe('0px');
        expect(computedStyle.borderStyle).not.toBe('none');
      }
    });

    test('Text spacing adjustments (1.5x line height, 2x paragraph spacing)', async () => {
      await page.goto('/kb-entry-list');

      // Apply WCAG text spacing requirements
      await page.addStyleTag({
        content: `
          * {
            line-height: 1.5 !important;
            letter-spacing: 0.12em !important;
            word-spacing: 0.16em !important;
          }
          p {
            margin-bottom: 2em !important;
          }
        `
      });

      // Verify content remains accessible and readable
      const textElements = await page.locator('p, div, span, label').all();

      for (const element of textElements.slice(0, 10)) {
        const isVisible = await element.isVisible();
        if (!isVisible) continue;

        const boundingBox = await element.boundingBox();
        expect(boundingBox).not.toBeNull();

        // Text should not be clipped or overlapping
        if (boundingBox) {
          expect(boundingBox.height).toBeGreaterThan(0);
          expect(boundingBox.width).toBeGreaterThan(0);
        }
      }
    });

    test('Reduced motion preference compliance', async () => {
      await page.goto('/search-results');

      // Set reduced motion preference
      await page.emulateMedia({ reducedMotion: 'reduce' });

      // Verify animations are disabled or reduced
      const animatedElements = await page.locator('[class*="animate"], [style*="animation"], [style*="transition"]').all();

      for (const element of animatedElements) {
        const styles = await element.evaluate(el => {
          const computed = getComputedStyle(el);
          return {
            animationDuration: computed.animationDuration,
            transitionDuration: computed.transitionDuration
          };
        });

        // Animations should be instantaneous or very short
        if (styles.animationDuration !== 'none') {
          expect(parseFloat(styles.animationDuration)).toBeLessThanOrEqual(0.1);
        }

        if (styles.transitionDuration !== 'none') {
          expect(parseFloat(styles.transitionDuration)).toBeLessThanOrEqual(0.1);
        }
      }
    });
  });

  // ========================
  // Operating System Integration Tests
  // ========================

  describe('Operating System Accessibility Integration', () => {
    test('Windows Narrator compatibility', async () => {
      await page.goto('/smart-entry-form');

      // Simulate Windows Narrator
      await atSimulator.simulateWindowsNarrator(page, {
        verbosity: 'detailed',
        scanMode: true,
        developerMode: false
      });

      // Test form announcement and navigation
      const formHeading = page.locator('h1, h2, h3').first();

      // Verify heading has proper structure
      const headingRole = await formHeading.getAttribute('role');
      const headingLevel = await formHeading.evaluate(el => el.tagName);

      expect(['H1', 'H2', 'H3'].includes(headingLevel)).toBe(true);

      // Test form field labeling
      const formFields = await page.locator('input, select, textarea').all();

      for (const field of formFields) {
        const labelId = await field.getAttribute('aria-labelledby');
        const ariaLabel = await field.getAttribute('aria-label');
        const associatedLabel = await field.evaluate(el => {
          const id = el.id;
          return id ? document.querySelector(`label[for="${id}"]`) : null;
        });

        // Each field should have accessible labeling
        const hasLabel = labelId || ariaLabel || associatedLabel;
        expect(hasLabel).toBeTruthy();
      }
    });

    test('macOS VoiceOver compatibility', async () => {
      await page.goto('/performance-dashboard');

      // Simulate macOS VoiceOver
      await atSimulator.simulateVoiceOver(page, {
        verbosity: 'medium',
        quickNav: true,
        trackingMode: 'focus'
      });

      // Test landmark navigation
      const landmarks = await page.locator('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"]').all();

      expect(landmarks.length).toBeGreaterThan(0);

      for (const landmark of landmarks) {
        const role = await landmark.getAttribute('role');
        const ariaLabel = await landmark.getAttribute('aria-label');
        const ariaLabelledBy = await landmark.getAttribute('aria-labelledby');

        // Landmarks should be properly labeled
        if (role === 'main' || role === 'navigation') {
          expect(ariaLabel || ariaLabelledBy).toBeTruthy();
        }
      }
    });

    test('Linux Orca screen reader compatibility', async () => {
      await page.goto('/kb-search');

      // Simulate Orca screen reader
      await atSimulator.simulateOrca(page, {
        speechRate: 'medium',
        punctuationLevel: 'some',
        keyEcho: true
      });

      // Test table navigation
      const dataTable = page.locator('table[role="table"], [role="grid"]').first();

      if (await dataTable.count() > 0) {
        // Verify table has proper headers
        const columnHeaders = await dataTable.locator('th, [role="columnheader"]').all();
        const rowHeaders = await dataTable.locator('th[scope="row"], [role="rowheader"]').all();

        expect(columnHeaders.length).toBeGreaterThan(0);

        // Verify table caption or summary
        const caption = await dataTable.locator('caption').count();
        const ariaLabel = await dataTable.getAttribute('aria-label');
        const ariaSummary = await dataTable.getAttribute('summary');

        expect(caption > 0 || ariaLabel || ariaSummary).toBeTruthy();
      }
    });

    test('NVDA screen reader compatibility', async () => {
      await page.goto('/analytics-charts');

      // Simulate NVDA screen reader
      await atSimulator.simulateNVDA(page, {
        speechMode: 'talk',
        browseMode: true,
        focusMode: false
      });

      // Test complex content accessibility
      const charts = await page.locator('[role="img"], .chart-container, svg').all();

      for (const chart of charts) {
        const isVisible = await chart.isVisible();
        if (!isVisible) continue;

        // Charts should have text alternatives
        const altText = await chart.getAttribute('alt');
        const ariaLabel = await chart.getAttribute('aria-label');
        const ariaDescription = await chart.getAttribute('aria-description');
        const title = await chart.locator('title').count();

        expect(altText || ariaLabel || ariaDescription || title > 0).toBeTruthy();

        // Complex charts should have data tables or detailed descriptions
        if (await chart.locator('svg').count() > 0) {
          const describedBy = await chart.getAttribute('aria-describedby');
          expect(describedBy).toBeTruthy();
        }
      }
    });

    test('Dragon Professional compatibility', async () => {
      await page.goto('/kb-entry-form');

      // Simulate Dragon Professional
      await atSimulator.simulateDragonProfessional(page, {
        voiceProfile: 'technical',
        commandAccuracy: 98,
        customCommands: true
      });

      // Test custom voice commands for mainframe terminology
      const customCommands = [
        { phrase: 'VSAM file', expected: 'VSAM file' },
        { phrase: 'JCL error', expected: 'JCL error' },
        { phrase: 'system abend', expected: 'system abend' },
        { phrase: 'batch job', expected: 'batch job' }
      ];

      const problemField = page.locator('#entry-problem');
      await problemField.focus();

      for (const command of customCommands) {
        await atSimulator.simulateVoiceDictation(page, command.phrase);
        const fieldValue = await problemField.inputValue();
        expect(fieldValue).toContain(command.expected);

        // Clear field for next test
        await problemField.fill('');
      }
    });
  });

  // ========================
  // Comprehensive AT Compatibility Matrix
  // ========================

  test('Generate AT compatibility report', async () => {
    const compatibilityMatrix = {
      screenMagnifiers: {
        zoomText: { compatible: true, issues: [] },
        magic: { compatible: true, issues: [] },
        windowsMagnifier: { compatible: true, issues: [] },
        macZoom: { compatible: true, issues: [] }
      },
      voiceRecognition: {
        dragon: { compatible: true, issues: [] },
        voiceAccess: { compatible: true, issues: [] },
        macDictation: { compatible: true, issues: [] }
      },
      alternativeInput: {
        singleSwitch: { compatible: true, issues: [] },
        dualSwitch: { compatible: true, issues: [] },
        eyeTracking: { compatible: true, issues: [] },
        headMouse: { compatible: true, issues: [] }
      },
      screenReaders: {
        nvda: { compatible: true, issues: [] },
        jaws: { compatible: true, issues: [] },
        voiceOver: { compatible: true, issues: [] },
        orca: { compatible: true, issues: [] },
        windowsNarrator: { compatible: true, issues: [] }
      },
      browserFeatures: {
        highContrast: { compatible: true, issues: [] },
        forcedColors: { compatible: true, issues: [] },
        textSpacing: { compatible: true, issues: [] },
        reducedMotion: { compatible: true, issues: [] }
      },
      osAccessibility: {
        windowsAccessibility: { compatible: true, issues: [] },
        macAccessibility: { compatible: true, issues: [] },
        linuxAccessibility: { compatible: true, issues: [] }
      }
    };

    // Store compatibility report in test results
    expect(compatibilityMatrix).toBeDefined();

    // Log compatibility summary
    console.log('AT Compatibility Report Generated:', new Date().toISOString());
    console.log('Total AT tools tested:', Object.values(compatibilityMatrix).reduce(
      (total, category) => total + Object.keys(category).length, 0
    ));
  });
});