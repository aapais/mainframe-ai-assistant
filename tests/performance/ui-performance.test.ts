import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { Application } from 'spectron';
import { PerformanceTestHelper } from '../../src/database/__tests__/test-utils/PerformanceTestHelper';
import path from 'path';
import { performance } from 'perf_hooks';
import puppeteer from 'puppeteer';
import { spawn, ChildProcess } from 'child_process';

describe('UI Performance Validation Tests', () => {
  let app: Application;
  let performanceHelper: PerformanceTestHelper;
  let electronProcess: ChildProcess;
  let devServerProcess: ChildProcess;
  let browser: puppeteer.Browser;
  let page: puppeteer.Page;

  beforeAll(async () => {
    performanceHelper = new PerformanceTestHelper();
    
    // Start development server
    devServerProcess = spawn('npm', ['run', 'dev:renderer'], {
      cwd: path.join(__dirname, '../..'),
      stdio: 'pipe'
    });
    
    // Wait for dev server to start
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Launch Puppeteer for browser-based tests
    browser = await puppeteer.launch({
      headless: true,
      args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
    });
  });

  beforeEach(async () => {
    // Create new page for each test
    page = await browser.newPage();
    
    // Enable performance monitoring
    await page.coverage.startJSCoverage();
    await page.coverage.startCSSCoverage();
    
    // Navigate to app
    await page.goto('http://localhost:3000', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  afterAll(async () => {
    performanceHelper.clearResults();
    
    if (browser) {
      await browser.close();
    }
    
    if (devServerProcess) {
      devServerProcess.kill();
    }
    
    if (electronProcess) {
      electronProcess.kill();
    }
  });

  describe('MVP1 Requirement: Application Startup < 5s', () => {
    it('should start the application within 5 seconds', async () => {
      const startTime = performance.now();
      
      // Launch Electron app
      app = new Application({
        path: require('electron'),
        args: [path.join(__dirname, '../../dist/main/index.js')],
        startTimeout: 10000,
        waitTimeout: 10000
      });

      await app.start();
      
      // Wait for main window to be ready
      await app.client.waitUntilWindowLoaded();
      const windowCount = await app.client.getWindowCount();
      expect(windowCount).toBe(1);

      const startupTime = performance.now() - startTime;
      
      await app.stop();
      
      expect(startupTime).toBeLessThan(5000); // Must start within 5 seconds
    }, 15000);

    it('should load main UI components within startup time', async () => {
      const componentLoadTimes = await page.evaluate(async () => {
        const startTime = performance.now();
        
        // Wait for main components to be rendered
        const components = [
          '.app-header',
          '.search-section',
          '.results-panel',
          '.detail-panel'
        ];
        
        const componentTimes: { [key: string]: number } = {};
        
        for (const selector of components) {
          const componentStart = performance.now();
          
          // Wait for component to appear
          while (!document.querySelector(selector)) {
            if (performance.now() - componentStart > 10000) {
              throw new Error(`Component ${selector} not found within 10s`);
            }
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          componentTimes[selector] = performance.now() - componentStart;
        }
        
        return {
          totalTime: performance.now() - startTime,
          components: componentTimes
        };
      });

      expect(componentLoadTimes.totalTime).toBeLessThan(3000); // Components within 3s
      
      // Each component should load quickly
      Object.values(componentLoadTimes.components).forEach(time => {
        expect(time).toBeLessThan(2000);
      });
    });

    it('should initialize database connection within startup time', async () => {
      const dbInitResult = await performanceHelper.measureOperation(
        'database-initialization',
        async () => {
          // Test database connection and schema creation
          await page.evaluate(async () => {
            // Simulate database operations that happen during startup
            const result = await (window as any).api?.initializeDatabase();
            return result;
          });
        }
      );

      expect(dbInitResult.success).toBe(true);
      expect(dbInitResult.metrics.executionTime).toBeLessThan(2000); // DB init < 2s
    });
  });

  describe('Component Rendering Benchmarks', () => {
    it('should render search results efficiently', async () => {
      const renderingResult = await performanceHelper.measureOperation(
        'search-results-rendering',
        async () => {
          // Simulate search with multiple results
          await page.type('#search-input', 'error system data');
          await page.click('#search-button');
          
          // Wait for results to be rendered
          await page.waitForSelector('.result-item', { timeout: 5000 });
          
          // Count rendered results
          const resultCount = await page.$$eval('.result-item', results => results.length);
          expect(resultCount).toBeGreaterThan(0);
        },
        10
      );

      expect(renderingResult.success).toBe(true);
      expect(renderingResult.metrics.executionTime / renderingResult.iterations).toBeLessThan(1000); // Render < 1s
      expect(renderingResult.metrics.operationsPerSecond).toBeGreaterThan(1);
    });

    it('should handle large result sets without performance degradation', async () => {
      const largeSetsResult = await performanceHelper.measureOperation(
        'large-result-set-rendering',
        async () => {
          // Trigger search that returns many results
          await page.evaluate(() => {
            (window as any).api?.search('', { limit: 100 });
          });
          
          await page.waitForFunction(
            () => document.querySelectorAll('.result-item').length >= 50,
            { timeout: 10000 }
          );
          
          // Verify scrolling performance
          await page.evaluate(() => {
            const resultsPanel = document.querySelector('.results-panel');
            if (resultsPanel) {
              resultsPanel.scrollTop = resultsPanel.scrollHeight;
            }
          });
          
          // Check if UI remains responsive
          const isResponsive = await page.evaluate(() => {
            const button = document.querySelector('#search-button');
            return button && !button.hasAttribute('disabled');
          });
          
          expect(isResponsive).toBe(true);
        },
        5
      );

      expect(largeSetsResult.success).toBe(true);
      expect(largeSetsResult.metrics.executionTime / largeSetsResult.iterations).toBeLessThan(3000); // Large sets < 3s
    });

    it('should maintain smooth scrolling performance', async () => {
      // Add multiple results to test scrolling
      await page.evaluate(async () => {
        // Simulate adding many search results
        const resultsContainer = document.querySelector('.results-list');
        if (resultsContainer) {
          for (let i = 0; i < 200; i++) {
            const item = document.createElement('div');
            item.className = 'result-item';
            item.innerHTML = `<h3>Test Result ${i}</h3><p>Description for result ${i}</p>`;
            resultsContainer.appendChild(item);
          }
        }
      });

      const scrollingResult = await performanceHelper.measureOperation(
        'scrolling-performance',
        async () => {
          // Perform smooth scrolling test
          await page.evaluate(async () => {
            const container = document.querySelector('.results-panel');
            if (container) {
              const scrollHeight = container.scrollHeight;
              const increment = scrollHeight / 20;
              
              for (let i = 0; i < 20; i++) {
                container.scrollTop = increment * i;
                await new Promise(resolve => requestAnimationFrame(resolve));
              }
            }
          });
          
          // Check frame rate during scrolling
          const fps = await page.evaluate(() => {
            return new Promise(resolve => {
              let frames = 0;
              const start = performance.now();
              
              function countFrame() {
                frames++;
                if (performance.now() - start < 1000) {
                  requestAnimationFrame(countFrame);
                } else {
                  resolve(frames);
                }
              }
              
              requestAnimationFrame(countFrame);
            });
          });
          
          expect(fps).toBeGreaterThan(30); // Should maintain at least 30fps
        },
        3
      );

      expect(scrollingResult.success).toBe(true);
    });

    it('should render modal dialogs promptly', async () => {
      const modalResult = await performanceHelper.measureOperation(
        'modal-dialog-rendering',
        async () => {
          // Click add entry button to open modal
          await page.click('button[data-testid="add-entry-button"]');
          
          // Wait for modal to appear
          await page.waitForSelector('.modal-overlay', { timeout: 2000 });
          
          // Verify modal is fully rendered
          const isModalComplete = await page.evaluate(() => {
            const modal = document.querySelector('.add-entry-modal');
            const inputs = modal?.querySelectorAll('input, textarea, select');
            return modal && inputs && inputs.length > 0;
          });
          
          expect(isModalComplete).toBe(true);
          
          // Close modal
          await page.click('.modal-overlay');
          await page.waitForSelector('.modal-overlay', { hidden: true, timeout: 2000 });
        },
        10
      );

      expect(modalResult.success).toBe(true);
      expect(modalResult.metrics.executionTime / modalResult.iterations).toBeLessThan(500); // Modal < 0.5s
    });
  });

  describe('Memory Usage Monitoring', () => {
    it('should maintain reasonable memory usage during normal operations', async () => {
      const memoryMetrics = await performanceHelper.testMemoryUsage(
        async () => {
          // Perform typical user operations
          await page.type('#search-input', 'memory test query');
          await page.click('#search-button');
          await page.waitForSelector('.result-item', { timeout: 2000 });
          
          // Clear search
          await page.evaluate(() => {
            const input = document.querySelector('#search-input') as HTMLInputElement;
            if (input) input.value = '';
          });
          
          // Add some delay to allow cleanup
          await page.waitForTimeout(100);
        },
        30000, // Test for 30 seconds
        2000   // Sample every 2 seconds
      );

      // Memory should not grow indefinitely
      const startMemory = memoryMetrics[0].memoryUsage.heapUsed;
      const endMemory = memoryMetrics[memoryMetrics.length - 1].memoryUsage.heapUsed;
      const memoryGrowth = (endMemory - startMemory) / startMemory;

      expect(memoryGrowth).toBeLessThan(2.0); // Memory shouldn't double during normal operations
    });

    it('should detect memory leaks in component lifecycle', async () => {
      const initialMemory = await page.evaluate(() => (performance as any).memory?.usedJSHeapSize || 0);
      
      // Perform operations that create and destroy components
      for (let i = 0; i < 50; i++) {
        // Open and close modal
        await page.click('button[data-testid="add-entry-button"]');
        await page.waitForSelector('.modal-overlay');
        await page.click('.modal-overlay');
        await page.waitForSelector('.modal-overlay', { hidden: true });
        
        // Search and clear
        await page.type('#search-input', `leak test ${i}`);
        await page.click('#search-button');
        await page.waitForSelector('.result-item');
        await page.evaluate(() => {
          const input = document.querySelector('#search-input') as HTMLInputElement;
          if (input) input.value = '';
        });
      }
      
      // Force garbage collection if available
      await page.evaluate(() => {
        if ((window as any).gc) {
          (window as any).gc();
        }
      });
      
      const finalMemory = await page.evaluate(() => (performance as any).memory?.usedJSHeapSize || 0);
      
      if (initialMemory > 0 && finalMemory > 0) {
        const memoryIncrease = (finalMemory - initialMemory) / initialMemory;
        expect(memoryIncrease).toBeLessThan(0.5); // Should not increase by more than 50%
      }
    });

    it('should handle browser tab switching without memory issues', async () => {
      // Create multiple tabs to test resource management
      const additionalPage = await browser.newPage();
      await additionalPage.goto('about:blank');
      
      const tabSwitchResult = await performanceHelper.measureOperation(
        'tab-switching-performance',
        async () => {
          // Switch between tabs and perform operations
          await page.bringToFront();
          await page.type('#search-input', 'tab switch test');
          await page.click('#search-button');
          await page.waitForSelector('.result-item');
          
          await additionalPage.bringToFront();
          await page.bringToFront();
          
          // Clear search
          await page.evaluate(() => {
            const input = document.querySelector('#search-input') as HTMLInputElement;
            if (input) input.value = '';
          });
        },
        20
      );

      expect(tabSwitchResult.success).toBe(true);
      expect(tabSwitchResult.metrics.operationsPerSecond).toBeGreaterThan(2);
      
      await additionalPage.close();
    });
  });

  describe('IPC Communication Latency', () => {
    it('should maintain low latency for main process communication', async () => {
      const ipcResults = await performanceHelper.compareImplementations([
        {
          name: 'search-ipc-call',
          fn: async () => {
            await page.evaluate(async () => {
              const start = performance.now();
              await (window as any).api?.search('IPC test query');
              return performance.now() - start;
            });
          }
        },
        {
          name: 'add-entry-ipc-call',
          fn: async () => {
            await page.evaluate(async () => {
              const start = performance.now();
              await (window as any).api?.addEntry({
                title: 'IPC Test Entry',
                problem: 'IPC Test Problem',
                solution: 'IPC Test Solution',
                category: 'Test'
              });
              return performance.now() - start;
            });
          }
        },
        {
          name: 'get-metrics-ipc-call',
          fn: async () => {
            await page.evaluate(async () => {
              const start = performance.now();
              await (window as any).api?.getMetrics();
              return performance.now() - start;
            });
          }
        }
      ], 10);

      Object.values(ipcResults).forEach(result => {
        expect(result.success).toBe(true);
        expect(result.metrics.executionTime / result.iterations).toBeLessThan(100); // IPC < 100ms
        expect(result.metrics.operationsPerSecond).toBeGreaterThan(10);
      });
    });

    it('should handle concurrent IPC requests efficiently', async () => {
      const concurrentIpcResult = await performanceHelper.measureOperation(
        'concurrent-ipc-calls',
        async () => {
          const promises = [];
          
          // Send multiple concurrent IPC requests
          for (let i = 0; i < 10; i++) {
            promises.push(
              page.evaluate(async (index) => {
                return await (window as any).api?.search(`concurrent test ${index}`);
              }, i)
            );
          }
          
          const results = await Promise.all(promises);
          expect(results.every(r => r !== undefined)).toBe(true);
        },
        5
      );

      expect(concurrentIpcResult.success).toBe(true);
      expect(concurrentIpcResult.metrics.executionTime / concurrentIpcResult.iterations).toBeLessThan(2000);
    });

    it('should validate IPC error handling performance', async () => {
      const errorHandlingResult = await performanceHelper.measureOperation(
        'ipc-error-handling',
        async () => {
          // Test IPC call that should fail gracefully
          const result = await page.evaluate(async () => {
            try {
              await (window as any).api?.search(null); // Invalid parameter
              return { success: false, error: 'Should have thrown' };
            } catch (error) {
              return { success: true, error: error.message };
            }
          });
          
          expect(result.success).toBe(true);
        },
        20
      );

      expect(errorHandlingResult.success).toBe(true);
      expect(errorHandlingResult.metrics.operationsPerSecond).toBeGreaterThan(10);
    });
  });

  describe('UI Responsiveness Under Load', () => {
    it('should maintain UI responsiveness during heavy operations', async () => {
      const responsivenessResult = await performanceHelper.measureOperation(
        'ui-responsiveness-under-load',
        async () => {
          // Start a heavy background operation
          const heavyOperationPromise = page.evaluate(async () => {
            // Simulate heavy computation
            for (let i = 0; i < 1000; i++) {
              await (window as any).api?.search(`heavy operation ${i}`);
            }
          });
          
          // While heavy operation runs, test UI responsiveness
          await page.type('#search-input', 'responsiveness test');
          
          const buttonClickTime = await page.evaluate(async () => {
            const start = performance.now();
            const button = document.querySelector('#search-button') as HTMLButtonElement;
            button?.click();
            return performance.now() - start;
          });
          
          expect(buttonClickTime).toBeLessThan(100); // UI should remain responsive
          
          // Wait for heavy operation to complete
          await heavyOperationPromise;
        }
      );

      expect(responsivenessResult.success).toBe(true);
    });

    it('should handle rapid user interactions smoothly', async () => {
      const rapidInteractionResult = await performanceHelper.measureOperation(
        'rapid-user-interactions',
        async () => {
          // Simulate rapid typing
          const searchText = 'rapid interaction test query';
          for (const char of searchText) {
            await page.type('#search-input', char, { delay: 10 }); // Fast typing
          }
          
          // Rapid button clicks
          for (let i = 0; i < 5; i++) {
            await page.click('#search-button');
            await page.waitForTimeout(50);
          }
          
          // Verify UI state remains consistent
          const inputValue = await page.$eval('#search-input', el => (el as HTMLInputElement).value);
          expect(inputValue).toContain(searchText);
        },
        10
      );

      expect(rapidInteractionResult.success).toBe(true);
      expect(rapidInteractionResult.metrics.operationsPerSecond).toBeGreaterThan(2);
    });

    it('should maintain performance during window resizing', async () => {
      const resizeResult = await performanceHelper.measureOperation(
        'window-resize-performance',
        async () => {
          // Perform resize operations
          const viewports = [
            { width: 1920, height: 1080 },
            { width: 1366, height: 768 },
            { width: 1024, height: 768 },
            { width: 800, height: 600 },
            { width: 1920, height: 1080 } // Back to original
          ];
          
          for (const viewport of viewports) {
            await page.setViewport(viewport);
            
            // Verify layout is maintained
            const isLayoutValid = await page.evaluate(() => {
              const header = document.querySelector('.app-header');
              const content = document.querySelector('.content-area');
              return header && content && 
                     header.getBoundingClientRect().width > 0 &&
                     content.getBoundingClientRect().width > 0;
            });
            
            expect(isLayoutValid).toBe(true);
            await page.waitForTimeout(100); // Allow layout to stabilize
          }
        },
        5
      );

      expect(resizeResult.success).toBe(true);
      expect(resizeResult.metrics.executionTime / resizeResult.iterations).toBeLessThan(2000);
    });
  });

  describe('Performance Regression Detection', () => {
    it('should detect UI performance regressions', async () => {
      // Establish baseline performance
      const baselineOperations = [
        { name: 'search-operation', fn: () => this.performSearch('baseline test') },
        { name: 'modal-operation', fn: () => this.openAndCloseModal() },
        { name: 'navigation-operation', fn: () => this.navigateInterface() }
      ];

      const baselineResults = await performanceHelper.compareImplementations(baselineOperations, 10);

      // Simulate system under different conditions (e.g., with background load)
      await this.simulateBackgroundLoad();

      // Run same operations under load
      const loadResults = await performanceHelper.compareImplementations(baselineOperations, 10);

      // Analyze regression
      const regressionAnalysis = performanceHelper.analyzeRegression(
        Object.values(baselineResults),
        Object.values(loadResults),
        0.3 // 30% degradation threshold
      );

      // Most operations should not show significant regression
      const regressions = regressionAnalysis.filter(r => r.isRegression);
      expect(regressions.length).toBeLessThan(baselineOperations.length * 0.5); // Less than 50% regression
    });

    private async performSearch(query: string): Promise<void> {
      await page.type('#search-input', query);
      await page.click('#search-button');
      await page.waitForSelector('.result-item', { timeout: 5000 });
      
      // Clear search
      await page.evaluate(() => {
        const input = document.querySelector('#search-input') as HTMLInputElement;
        if (input) input.value = '';
      });
    }

    private async openAndCloseModal(): Promise<void> {
      await page.click('button[data-testid="add-entry-button"]');
      await page.waitForSelector('.modal-overlay');
      await page.click('.modal-overlay');
      await page.waitForSelector('.modal-overlay', { hidden: true });
    }

    private async navigateInterface(): Promise<void> {
      // Navigate through different sections
      const tabs = await page.$$('[role="tab"]');
      for (const tab of tabs.slice(0, 3)) {
        await tab.click();
        await page.waitForTimeout(200);
      }
    }

    private async simulateBackgroundLoad(): Promise<void> {
      // Simulate background CPU load
      await page.evaluate(() => {
        const worker = new Worker(URL.createObjectURL(new Blob([`
          self.onmessage = function() {
            for (let i = 0; i < 10000000; i++) {
              Math.random();
            }
            self.postMessage('done');
          }
        `], { type: 'application/javascript' })));
        
        worker.postMessage('start');
      });
    }
  });
});