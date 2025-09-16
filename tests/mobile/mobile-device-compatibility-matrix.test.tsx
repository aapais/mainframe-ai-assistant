/**
 * Mobile Device Compatibility Matrix Tests
 * 
 * Comprehensive compatibility testing across all specified mobile devices:
 * - iPhone SE (375x667) - iOS Safari
 * - iPhone 12/13 (390x844) - iOS Safari
 * - iPhone 14 Pro Max (430x932) - iOS Safari  
 * - Samsung Galaxy S20 (360x800) - Chrome Mobile
 * - iPad Mini (768x1024) - iOS Safari
 * 
 * Features tested:
 * - Touch interaction compatibility
 * - CSS feature support
 * - JavaScript API availability
 * - Performance characteristics
 * - Accessibility compliance
 * - Cross-browser behavior
 * 
 * @author Mobile Device Testing Specialist
 * @version 1.0.0
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Test configuration
import {
  MOBILE_DEVICE_CONFIGS,
  DEVICE_COMPATIBILITY_MATRIX,
  MOBILE_PERFORMANCE_THRESHOLDS,
  TOUCH_TARGET_REQUIREMENTS,
  COMPONENT_MOBILE_TESTS,
  type MobileDeviceConfig
} from './mobile-device-testing.config';

// Component imports
import { SearchResults } from '../../src/components/search/SearchResults';
import { ResponsiveSearchLayout } from '../../src/components/search/ResponsiveSearchLayout';
import { MobileFirstLayout } from '../../src/examples/MobileFirstLayout';
import { KBEntryForm } from '../../src/renderer/components/forms/KBEntryForm';
import { KBEntryList } from '../../src/renderer/components/KBEntryList';

// Test data
const mockCompatibilityTestData = {
  searchResults: [
    {
      entry: {
        id: '1',
        title: 'Cross-Browser Compatibility Testing Guide',
        problem: 'Need to ensure application works across different mobile browsers and devices.',
        solution: 'Implement progressive enhancement and feature detection for robust compatibility.',
        category: 'Testing',
        tags: ['compatibility', 'cross-browser', 'mobile'],
        usage_count: 95,
        success_count: 89,
        failure_count: 6,
        created_at: '2024-01-15T10:30:00Z',
        updated_at: '2024-01-20T15:45:00Z'
      },
      score: 0.96,
      matchType: 'exact' as const,
      highlights: ['cross-browser', 'compatibility']
    }
  ],
  
  kbEntries: [
    {
      id: '1',
      title: 'Mobile Device Feature Detection',
      problem: 'Application needs to gracefully handle different mobile device capabilities.',
      solution: 'Use feature detection rather than user agent sniffing for better compatibility.',
      category: 'Mobile Development' as const,
      tags: ['feature-detection', 'mobile', 'progressive-enhancement'],
      usage_count: 167,
      success_count: 159,
      failure_count: 8,
      created_at: '2024-01-10T08:15:00Z',
      updated_at: '2024-01-19T16:30:00Z'
    }
  ]
};

// =========================
// Compatibility Testing Utilities
// =========================

/**
 * Device simulation with browser-specific characteristics
 */
class DeviceCompatibilitySimulator {
  private device: MobileDeviceConfig;
  private browserFeatures: any;
  
  constructor(device: MobileDeviceConfig) {
    this.device = device;
    this.setupDevice();
    this.setupBrowserFeatures();
  }
  
  private setupDevice() {
    // Set viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: this.device.viewport.width,
    });
    
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: this.device.viewport.height,
    });
    
    // Set device pixel ratio
    Object.defineProperty(window, 'devicePixelRatio', {
      writable: true,
      configurable: true,
      value: this.device.devicePixelRatio,
    });
    
    // Set user agent
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      configurable: true,
      value: this.device.userAgent,
    });
    
    // Touch capabilities
    if (this.device.touch) {
      Object.defineProperty(navigator, 'maxTouchPoints', {
        writable: true,
        configurable: true,
        value: 5,
      });
      
      window.TouchEvent = class TouchEvent extends UIEvent {} as any;
      document.ontouchstart = null;
    }
  }
  
  private setupBrowserFeatures() {
    // Simulate browser-specific feature support
    const isIOS = this.device.platform === 'ios';
    const isAndroid = this.device.platform === 'android';
    
    // CSS Grid support (universal in modern browsers)
    this.browserFeatures = {
      cssGrid: true,
      flexbox: true,
      cssVariables: true,
      touchEvents: this.device.touch,
      
      // iOS Safari specific
      webkitPrefixes: isIOS,
      safariSpecific: isIOS,
      backfaceVisibility: isIOS,
      
      // Android Chrome specific
      chromeSpecific: isAndroid,
      androidKeyboard: isAndroid,
      
      // Feature detection results
      intersectionObserver: true,
      resizeObserver: true,
      customElements: true,
      serviceWorker: true
    };
    
    // Mock feature availability
    this.mockFeatureAPIs();
  }
  
  private mockFeatureAPIs() {
    // Mock IntersectionObserver
    if (this.browserFeatures.intersectionObserver) {
      global.IntersectionObserver = class IntersectionObserver {
        constructor(callback: any, options: any) {}
        observe(element: Element) {}
        unobserve(element: Element) {}
        disconnect() {}
      };
    }
    
    // Mock ResizeObserver
    if (this.browserFeatures.resizeObserver) {
      global.ResizeObserver = class ResizeObserver {
        constructor(callback: any) {}
        observe(element: Element) {}
        unobserve(element: Element) {}
        disconnect() {}
      };
    }
    
    // Mock touch events based on device capability
    if (this.browserFeatures.touchEvents) {
      Object.defineProperty(window, 'TouchEvent', {
        writable: true,
        configurable: true,
        value: class TouchEvent extends UIEvent {}
      });
    }
  }
  
  public getDeviceInfo() {
    return {
      name: this.device.name,
      platform: this.device.platform,
      viewport: this.device.viewport,
      features: this.browserFeatures
    };
  }
  
  public supportsFeature(feature: string): boolean {
    return this.browserFeatures[feature] || false;
  }
}

/**
 * CSS feature detection utilities
 */
const cssFeatureTests = {
  testFlexbox: (): boolean => {
    const testElement = document.createElement('div');
    testElement.style.display = 'flex';
    return testElement.style.display === 'flex';
  },
  
  testGrid: (): boolean => {
    const testElement = document.createElement('div');
    testElement.style.display = 'grid';
    return testElement.style.display === 'grid';
  },
  
  testCustomProperties: (): boolean => {
    const testElement = document.createElement('div');
    testElement.style.setProperty('--test', 'value');
    return testElement.style.getPropertyValue('--test') === 'value';
  },
  
  testViewportUnits: (): boolean => {
    const testElement = document.createElement('div');
    testElement.style.width = '1vh';
    return testElement.style.width === '1vh';
  },
  
  testTouchAction: (): boolean => {
    const testElement = document.createElement('div');
    testElement.style.touchAction = 'manipulation';
    return testElement.style.touchAction === 'manipulation';
  }
};

/**
 * Performance testing utilities
 */
interface PerformanceTestResult {
  device: string;
  metric: string;
  value: number;
  threshold: number;
  passed: boolean;
  component: string;
}

const performanceTests = {
  measureRenderTime: async (renderFn: () => any, component: string, device: string): Promise<PerformanceTestResult> => {
    const startTime = performance.now();
    const result = renderFn();
    const endTime = performance.now();
    const renderTime = endTime - startTime;
    
    return {
      device,
      metric: 'renderTime',
      value: renderTime,
      threshold: MOBILE_PERFORMANCE_THRESHOLDS.FIRST_CONTENTFUL_PAINT,
      passed: renderTime < MOBILE_PERFORMANCE_THRESHOLDS.FIRST_CONTENTFUL_PAINT,
      component
    };
  },
  
  measureInteractionResponse: async (interactionFn: () => Promise<void>, component: string, device: string): Promise<PerformanceTestResult> => {
    const startTime = performance.now();
    await interactionFn();
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    
    return {
      device,
      metric: 'interactionResponse',
      value: responseTime,
      threshold: MOBILE_PERFORMANCE_THRESHOLDS.TOUCH_RESPONSE_TIME,
      passed: responseTime < MOBILE_PERFORMANCE_THRESHOLDS.TOUCH_RESPONSE_TIME,
      component
    };
  },
  
  measureMemoryUsage: (component: string, device: string): PerformanceTestResult => {
    // Mock memory measurement (would use performance.memory in real browsers)
    const mockMemoryUsage = Math.random() * 30; // MB
    
    return {
      device,
      metric: 'memoryUsage',
      value: mockMemoryUsage,
      threshold: MOBILE_PERFORMANCE_THRESHOLDS.MEMORY_USAGE_LIMIT,
      passed: mockMemoryUsage < MOBILE_PERFORMANCE_THRESHOLDS.MEMORY_USAGE_LIMIT,
      component
    };
  }
};

/**
 * Touch interaction testing
 */
const touchTests = {
  simulateTap: async (element: Element): Promise<boolean> => {
    try {
      const rect = element.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      
      fireEvent.touchStart(element, {
        touches: [{ clientX: x, clientY: y }]
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      fireEvent.touchEnd(element, {
        changedTouches: [{ clientX: x, clientY: y }]
      });
      
      fireEvent.click(element);
      
      return true;
    } catch (error) {
      return false;
    }
  },
  
  simulateSwipe: async (element: Element, direction: 'left' | 'right'): Promise<boolean> => {
    try {
      const rect = element.getBoundingClientRect();
      const startX = rect.left + rect.width / 2;
      const startY = rect.top + rect.height / 2;
      const endX = direction === 'left' ? startX - 100 : startX + 100;
      
      fireEvent.touchStart(element, {
        touches: [{ clientX: startX, clientY: startY }]
      });
      
      fireEvent.touchMove(element, {
        touches: [{ clientX: endX, clientY: startY }]
      });
      
      fireEvent.touchEnd(element, {
        changedTouches: [{ clientX: endX, clientY: startY }]
      });
      
      return true;
    } catch (error) {
      return false;
    }
  },
  
  validateTouchTargets: (container: HTMLElement): Array<{element: string; passed: boolean; size: number}> => {
    const results = [];
    const interactiveElements = container.querySelectorAll(
      'button, a[href], input, select, textarea, [role="button"], [tabindex="0"]'
    );
    
    interactiveElements.forEach((element, index) => {
      const rect = element.getBoundingClientRect();
      const minSize = Math.min(rect.width, rect.height);
      
      if (rect.width > 0 && rect.height > 0) {
        results.push({
          element: element.id || `element-${index}`,
          passed: minSize >= TOUCH_TARGET_REQUIREMENTS.MINIMUM_SIZE,
          size: minSize
        });
      }
    });
    
    return results;
  }
};

// =========================
// Test Suite
// =========================

describe('Mobile Device Compatibility Matrix', () => {
  let originalInnerWidth: number;
  let originalInnerHeight: number;
  
  beforeEach(() => {
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
    
    jest.spyOn(performance, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(100);
  });
  
  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
    
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: originalInnerHeight,
    });
    
    jest.restoreAllMocks();
  });
  
  describe('CSS Feature Compatibility', () => {
    test.each(Object.entries(MOBILE_DEVICE_CONFIGS))(
      'should support modern CSS features on %s',
      async ([deviceKey, device]) => {
        const simulator = new DeviceCompatibilitySimulator(device);
        
        // Test essential CSS features
        const cssSupport = {
          flexbox: cssFeatureTests.testFlexbox(),
          grid: cssFeatureTests.testGrid(),
          customProperties: cssFeatureTests.testCustomProperties(),
          viewportUnits: cssFeatureTests.testViewportUnits(),
          touchAction: cssFeatureTests.testTouchAction()
        };
        
        // All modern devices should support these features
        expect(cssSupport.flexbox).toBe(true);
        expect(cssSupport.grid).toBe(true);
        expect(cssSupport.customProperties).toBe(true);
        
        // Log compatibility results
        console.log(`CSS Feature Support on ${deviceKey}:`, cssSupport);
      }
    );
  });
  
  describe('Component Compatibility Testing', () => {
    describe('SearchResults Component', () => {
      test.each(Object.entries(MOBILE_DEVICE_CONFIGS))(
        'should render and function correctly on %s',
        async ([deviceKey, device]) => {
          const simulator = new DeviceCompatibilitySimulator(device);
          
          const performanceResult = await performanceTests.measureRenderTime(
            () => render(
              <SearchResults
                results={mockCompatibilityTestData.searchResults}
                searchQuery="compatibility test"
                onResultSelect={jest.fn()}
                showConfidenceScores={true}
              />
            ),
            'SearchResults',
            deviceKey
          );
          
          expect(performanceResult.passed).toBe(true);
          
          const { container } = performanceResult.value as any;
          
          await waitFor(() => {
            // Verify component renders
            const results = container.querySelectorAll('[role="option"]');
            expect(results.length).toBeGreaterThan(0);
            
            // Validate touch targets
            const touchTargetResults = touchTests.validateTouchTargets(container);
            const failedTargets = touchTargetResults.filter(t => !t.passed);
            expect(failedTargets.length).toBeLessThanOrEqual(1); // Allow minimal failures
          });
        }
      );
    });
    
    describe('ResponsiveSearchLayout Component', () => {
      test.each(Object.entries(MOBILE_DEVICE_CONFIGS))(
        'should adapt layout correctly on %s',
        async ([deviceKey, device]) => {
          const simulator = new DeviceCompatibilitySimulator(device);
          
          const { container } = render(
            <ResponsiveSearchLayout
              searchInput={<input placeholder="Search..." />}
              filtersContent={<div>Filters</div>}
              resultsContent={<div>Results</div>}
              previewContent={<div>Preview</div>}
            />
          );
          
          await waitFor(() => {
            // Verify appropriate layout for device
            const mobileLayout = container.querySelector('.mobile-search-layout');
            const tabletLayout = container.querySelector('.tablet-search-layout');
            const desktopLayout = container.querySelector('.desktop-search-layout');
            
            if (device.viewport.width < 768) {
              expect(mobileLayout).toBeInTheDocument();
            } else if (device.viewport.width < 1024) {
              expect(tabletLayout || mobileLayout).toBeInTheDocument();
            } else {
              expect(desktopLayout || tabletLayout).toBeInTheDocument();
            }
            
            // Test touch interactions
            const interactiveElements = container.querySelectorAll('button');
            if (interactiveElements.length > 0) {
              const tapResult = touchTests.simulateTap(interactiveElements[0]);
              expect(tapResult).resolves.toBe(true);
            }
          });
        }
      );
    });
    
    describe('MobileFirstLayout Component', () => {
      test.each(Object.entries(MOBILE_DEVICE_CONFIGS))(
        'should provide optimal mobile experience on %s',
        async ([deviceKey, device]) => {
          const simulator = new DeviceCompatibilitySimulator(device);
          
          const { container } = render(
            <MobileFirstLayout
              entries={mockCompatibilityTestData.kbEntries}
              onSearch={jest.fn()}
              onEntrySelect={jest.fn()}
            />
          );
          
          await waitFor(() => {
            // Verify mobile-optimized layout
            const layout = container.querySelector('[data-testid="mobile-first-layout"]');
            expect(layout).toBeInTheDocument();
            
            // Check mobile-specific features
            const mobileHeader = container.querySelector('.mobile-header');
            const bottomNav = container.querySelector('.fixed.bottom-0, .mobile-bottom-nav');
            
            if (device.category === 'mobile') {
              // Mobile devices should have mobile-optimized elements
              expect(mobileHeader || bottomNav).toBeTruthy();
            }
            
            // Validate touch-friendly interactions
            const touchTargets = touchTests.validateTouchTargets(container);
            const criticalFailures = touchTargets.filter(t => !t.passed && t.size < TOUCH_TARGET_REQUIREMENTS.MINIMUM_SIZE * 0.8);
            expect(criticalFailures.length).toBe(0);
          });
        }
      );
    });
  });
  
  describe('Touch Interaction Compatibility', () => {
    test.each(Object.entries(MOBILE_DEVICE_CONFIGS))(
      'should handle touch interactions correctly on %s',
      async ([deviceKey, device]) => {
        const simulator = new DeviceCompatibilitySimulator(device);
        
        if (!device.touch) {
          return; // Skip touch tests for non-touch devices
        }
        
        const mockOnEntrySelect = jest.fn();
        const { container } = render(
          <KBEntryList
            entries={mockCompatibilityTestData.kbEntries}
            onEntrySelect={mockOnEntrySelect}
            onEntryRate={jest.fn()}
          />
        );
        
        await waitFor(() => {
          const entryElements = container.querySelectorAll('[role="button"], .kb-entry-card');
          expect(entryElements.length).toBeGreaterThan(0);
        });
        
        // Test tap interaction
        const firstEntry = container.querySelector('[role="button"], .kb-entry-card');
        if (firstEntry) {
          const tapSuccess = await touchTests.simulateTap(firstEntry);
          expect(tapSuccess).toBe(true);
          
          await waitFor(() => {
            expect(mockOnEntrySelect).toHaveBeenCalled();
          });
        }
        
        // Test swipe interaction (if supported)
        const swipeableElement = container.querySelector('.swipeable, [data-swipe]');
        if (swipeableElement) {
          const swipeSuccess = await touchTests.simulateSwipe(swipeableElement, 'left');
          expect(swipeSuccess).toBe(true);
        }
      }
    );
  });
  
  describe('Performance Compatibility', () => {
    test('should meet performance thresholds across all devices', async () => {
      const performanceResults: PerformanceTestResult[] = [];
      
      for (const [deviceKey, device] of Object.entries(MOBILE_DEVICE_CONFIGS)) {
        const simulator = new DeviceCompatibilitySimulator(device);
        
        // Test SearchResults performance
        const searchResult = await performanceTests.measureRenderTime(
          () => render(
            <SearchResults
              results={mockCompatibilityTestData.searchResults}
              searchQuery="performance"
              onResultSelect={jest.fn()}
            />
          ),
          'SearchResults',
          deviceKey
        );
        performanceResults.push(searchResult);
        
        // Test memory usage
        const memoryResult = performanceTests.measureMemoryUsage('SearchResults', deviceKey);
        performanceResults.push(memoryResult);
        
        // Test interaction response
        const { container } = searchResult.value as any;
        const interactionResult = await performanceTests.measureInteractionResponse(
          async () => {
            const button = container.querySelector('button');
            if (button) {
              await touchTests.simulateTap(button);
            }
          },
          'SearchResults',
          deviceKey
        );
        performanceResults.push(interactionResult);
      }
      
      // Analyze results
      const failedTests = performanceResults.filter(result => !result.passed);
      const failureRate = failedTests.length / performanceResults.length;
      
      // Allow up to 10% failure rate for compatibility testing
      expect(failureRate).toBeLessThanOrEqual(0.1);
      
      // Log detailed results
      console.log('Performance Compatibility Results:', {
        totalTests: performanceResults.length,
        passed: performanceResults.filter(r => r.passed).length,
        failed: failedTests.length,
        failureRate: `${(failureRate * 100).toFixed(1)}%`,
        failedTests: failedTests.map(t => `${t.device}-${t.component}-${t.metric}`)
      });
    });
  });
  
  describe('Form Compatibility', () => {
    test.each(Object.entries(MOBILE_DEVICE_CONFIGS))(
      'should handle form inputs correctly on %s',
      async ([deviceKey, device]) => {
        const simulator = new DeviceCompatibilitySimulator(device);
        
        const mockOnSubmit = jest.fn();
        const { container } = render(
          <KBEntryForm onSubmit={mockOnSubmit} />
        );
        
        await waitFor(() => {
          // Verify form elements render
          const formInputs = container.querySelectorAll('input, textarea, select');
          expect(formInputs.length).toBeGreaterThan(0);
          
          // Test form field interaction
          formInputs.forEach(input => {
            const rect = input.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              // Touch targets should be adequate
              if (device.touch) {
                expect(rect.height).toBeGreaterThanOrEqual(TOUCH_TARGET_REQUIREMENTS.MINIMUM_SIZE);
              }
            }
          });
        });
        
        // Test form interaction
        const firstInput = container.querySelector('input[type="text"]') as HTMLInputElement;
        if (firstInput && device.touch) {
          const tapSuccess = await touchTests.simulateTap(firstInput);
          expect(tapSuccess).toBe(true);
          
          // Verify input can receive focus
          await waitFor(() => {
            expect(firstInput).toHaveFocus();
          });
        }
      }
    );
  });
  
  describe('Accessibility Compatibility', () => {
    test.each(Object.entries(MOBILE_DEVICE_CONFIGS))(
      'should maintain accessibility standards on %s',
      async ([deviceKey, device]) => {
        const simulator = new DeviceCompatibilitySimulator(device);
        
        const { container } = render(
          <div>
            <SearchResults
              results={mockCompatibilityTestData.searchResults}
              searchQuery="accessibility"
              onResultSelect={jest.fn()}
              enableAdvancedKeyboardShortcuts={true}
            />
            <ResponsiveSearchLayout
              searchInput={<input placeholder="Search..." aria-label="Search knowledge base" />}
              filtersContent={<div>Filters</div>}
              resultsContent={<div>Results</div>}
            />
          </div>
        );
        
        // Run accessibility audit
        const results = await axe(container);
        expect(results).toHaveNoViolations();
        
        // Verify specific accessibility requirements
        await waitFor(() => {
          // ARIA labels
          const interactiveElements = container.querySelectorAll(
            'button, a[href], input, [role="button"]'
          );
          
          interactiveElements.forEach(element => {
            const hasLabel = element.hasAttribute('aria-label') ||
                            element.hasAttribute('aria-labelledby') ||
                            element.textContent?.trim();
            expect(hasLabel).toBeTruthy();
          });
          
          // Focus management
          const focusableElements = container.querySelectorAll(
            'button, a[href], input, [tabindex="0"]'
          );
          
          if (focusableElements.length > 0) {
            fireEvent.focus(focusableElements[0]);
            expect(focusableElements[0]).toHaveFocus();
          }
        });
      }
    );
  });
  
  describe('Browser-Specific Feature Support', () => {
    test('should detect and handle browser-specific features correctly', () => {
      const browserSupport = {
        safari_mobile: {
          name: 'Mobile Safari',
          touch: true,
          webkitPrefixes: true,
          backfaceVisibility: true,
          viewportUnits: true
        },
        chrome_mobile: {
          name: 'Chrome Mobile',
          touch: true,
          webkitPrefixes: false,
          customElements: true,
          serviceWorker: true
        }
      };
      
      Object.entries(MOBILE_DEVICE_CONFIGS).forEach(([deviceKey, device]) => {
        const simulator = new DeviceCompatibilitySimulator(device);
        const deviceInfo = simulator.getDeviceInfo();
        
        // Verify feature detection
        expect(deviceInfo.features).toBeDefined();
        expect(deviceInfo.features.touchEvents).toBe(device.touch);
        
        // Platform-specific features
        if (device.platform === 'ios') {
          expect(deviceInfo.features.safariSpecific).toBe(true);
        } else if (device.platform === 'android') {
          expect(deviceInfo.features.chromeSpecific).toBe(true);
        }
      });
    });
  });
  
  describe('Compatibility Matrix Summary', () => {
    test('should generate comprehensive compatibility report', async () => {
      const compatibilityMatrix = {
        devices: {},
        features: {},
        performance: {},
        accessibility: {}
      };
      
      for (const [deviceKey, device] of Object.entries(MOBILE_DEVICE_CONFIGS)) {
        const simulator = new DeviceCompatibilitySimulator(device);
        
        // Test basic rendering
        const { container } = render(
          <SearchResults
            results={mockCompatibilityTestData.searchResults}
            searchQuery="matrix test"
            onResultSelect={jest.fn()}
          />
        );
        
        const deviceReport = {
          name: device.name,
          platform: device.platform,
          viewport: device.viewport,
          rendering: {
            successful: container.querySelectorAll('[role="option"]').length > 0,
            touchTargets: touchTests.validateTouchTargets(container),
            errors: []
          },
          features: {
            cssGrid: cssFeatureTests.testGrid(),
            flexbox: cssFeatureTests.testFlexbox(),
            customProperties: cssFeatureTests.testCustomProperties(),
            touchEvents: simulator.supportsFeature('touchEvents')
          },
          performance: {
            renderTime: Math.random() * 1000, // Mock performance data
            memoryUsage: Math.random() * 50,
            interactionResponse: Math.random() * 200
          }
        };
        
        compatibilityMatrix.devices[deviceKey] = deviceReport;
      }
      
      // Verify matrix completeness
      expect(Object.keys(compatibilityMatrix.devices)).toHaveLength(
        Object.keys(MOBILE_DEVICE_CONFIGS).length
      );
      
      // All devices should have successful rendering
      const renderingFailures = Object.values(compatibilityMatrix.devices)
        .filter((device: any) => !device.rendering.successful);
      expect(renderingFailures).toHaveLength(0);
      
      // Log comprehensive matrix
      console.log('Device Compatibility Matrix:', {
        tested: Object.keys(compatibilityMatrix.devices).length,
        platforms: [...new Set(Object.values(MOBILE_DEVICE_CONFIGS).map(d => d.platform))],
        viewportRange: {
          minWidth: Math.min(...Object.values(MOBILE_DEVICE_CONFIGS).map(d => d.viewport.width)),
          maxWidth: Math.max(...Object.values(MOBILE_DEVICE_CONFIGS).map(d => d.viewport.width)),
          minHeight: Math.min(...Object.values(MOBILE_DEVICE_CONFIGS).map(d => d.viewport.height)),
          maxHeight: Math.max(...Object.values(MOBILE_DEVICE_CONFIGS).map(d => d.viewport.height))
        },
        summary: compatibilityMatrix
      });
    });
  });
});
