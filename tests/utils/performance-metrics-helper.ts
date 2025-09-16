import { Page } from '@playwright/test';

interface CoreWebVitals {
  fcp?: number; // First Contentful Paint
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  ttfb?: number; // Time to First Byte
  tti?: number; // Time to Interactive
}

interface ResourceMetrics {
  totalRequests: number;
  totalSize: number;
  slowestRequest: number;
  resourceTypes: {
    [type: string]: {
      count: number;
      totalSize: number;
      averageSize: number;
      slowest: number;
    };
  };
}

interface MemoryMetrics {
  heapUsed: number;
  heapTotal: number;
  heapLimit: number;
  external: number;
}

interface JavaScriptMetrics {
  scriptDuration: number;
  longTasks: number;
  mainThreadBlocking: number;
}

interface LayoutMetrics {
  layoutShifts: number;
  cumulativeScore: number;
  largestShift: number;
}

export class PerformanceMetricsHelper {
  private page: Page;
  private performanceObserver?: any;
  
  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Start performance monitoring
   */
  async startPerformanceMonitoring(): Promise<void> {
    await this.page.evaluate(() => {
      // Initialize performance tracking
      (window as any).performanceMetrics = {
        paintTimings: {},
        layoutShifts: [],
        longTasks: [],
        resourceTimings: [],
        navigationTiming: performance.timing
      };
      
      // Track paint timings
      if ('PerformanceObserver' in window) {
        // Paint timings
        const paintObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            (window as any).performanceMetrics.paintTimings[entry.name] = entry.startTime;
          }
        });
        paintObserver.observe({ entryTypes: ['paint'] });
        
        // Layout shift tracking
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
              (window as any).performanceMetrics.layoutShifts.push({
                value: (entry as any).value,
                startTime: entry.startTime
              });
            }
          }
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
        
        // Long task tracking
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            (window as any).performanceMetrics.longTasks.push({
              duration: entry.duration,
              startTime: entry.startTime
            });
          }
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        
        // Resource timing
        const resourceObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const resource = entry as PerformanceResourceTiming;
            (window as any).performanceMetrics.resourceTimings.push({
              name: resource.name,
              duration: resource.responseEnd - resource.requestStart,
              size: resource.transferSize || 0,
              type: resource.initiatorType
            });
          }
        });
        resourceObserver.observe({ entryTypes: ['resource'] });
        
        // LCP tracking
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          (window as any).performanceMetrics.paintTimings['largest-contentful-paint'] = lastEntry.startTime;
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        
        // Store observers for cleanup
        (window as any).performanceObservers = {
          paint: paintObserver,
          cls: clsObserver,
          longTask: longTaskObserver,
          resource: resourceObserver,
          lcp: lcpObserver
        };
      }
    });
  }

  /**
   * Get Core Web Vitals
   */
  async getCoreWebVitals(): Promise<CoreWebVitals> {
    return this.page.evaluate(() => {
      const metrics = (window as any).performanceMetrics;
      const navigation = performance.timing;
      
      const vitals: CoreWebVitals = {};
      
      // First Contentful Paint
      if (metrics.paintTimings['first-contentful-paint']) {
        vitals.fcp = metrics.paintTimings['first-contentful-paint'];
      }
      
      // Largest Contentful Paint
      if (metrics.paintTimings['largest-contentful-paint']) {
        vitals.lcp = metrics.paintTimings['largest-contentful-paint'];
      }
      
      // Cumulative Layout Shift
      if (metrics.layoutShifts.length > 0) {
        vitals.cls = metrics.layoutShifts.reduce((sum: number, shift: any) => sum + shift.value, 0);
      }
      
      // Time to First Byte
      if (navigation.responseStart && navigation.requestStart) {
        vitals.ttfb = navigation.responseStart - navigation.requestStart;
      }
      
      // First Input Delay (approximated)
      if (metrics.longTasks.length > 0) {
        const firstLongTask = metrics.longTasks[0];
        vitals.fid = firstLongTask ? firstLongTask.duration : 0;
      }
      
      // Time to Interactive (simplified calculation)
      const loadTime = navigation.loadEventEnd - navigation.navigationStart;
      const longTaskTime = metrics.longTasks.reduce((sum: number, task: any) => sum + task.duration, 0);
      vitals.tti = loadTime + longTaskTime;
      
      return vitals;
    });
  }

  /**
   * Monitor resource loading
   */
  async monitorResourceLoading(): Promise<{ getMetrics: () => Promise<ResourceMetrics> }> {
    const resourceData: any[] = [];
    
    // Listen to all requests
    this.page.on('request', (request) => {
      resourceData.push({
        url: request.url(),
        resourceType: request.resourceType(),
        startTime: Date.now()
      });
    });
    
    this.page.on('response', (response) => {
      const request = resourceData.find(r => r.url === response.url());
      if (request) {
        request.endTime = Date.now();
        request.status = response.status();
        request.size = parseInt(response.headers()['content-length'] || '0');
      }
    });
    
    return {
      getMetrics: async (): Promise<ResourceMetrics> => {
        const completedRequests = resourceData.filter(r => r.endTime);
        
        const resourceTypes: { [type: string]: any } = {};
        
        completedRequests.forEach(request => {
          const type = request.resourceType;
          if (!resourceTypes[type]) {
            resourceTypes[type] = {
              count: 0,
              totalSize: 0,
              durations: []
            };
          }
          
          resourceTypes[type].count++;
          resourceTypes[type].totalSize += request.size || 0;
          resourceTypes[type].durations.push(request.endTime - request.startTime);
        });
        
        // Calculate averages and slowest
        Object.keys(resourceTypes).forEach(type => {
          const typeData = resourceTypes[type];
          typeData.averageSize = typeData.totalSize / typeData.count;
          typeData.slowest = Math.max(...typeData.durations);
          delete typeData.durations;
        });
        
        return {
          totalRequests: completedRequests.length,
          totalSize: completedRequests.reduce((sum, r) => sum + (r.size || 0), 0),
          slowestRequest: Math.max(...completedRequests.map(r => r.endTime - r.startTime)),
          resourceTypes
        };
      }
    };
  }

  /**
   * Measure layout shift
   */
  async measureLayoutShift(): Promise<number> {
    return new Promise((resolve) => {
      this.page.evaluate(() => {
        let cumulativeScore = 0;
        
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
              cumulativeScore += (entry as any).value;
            }
          }
        });
        
        observer.observe({ entryTypes: ['layout-shift'] });
        
        // Return cumulative score after 3 seconds
        setTimeout(() => {
          observer.disconnect();
          (window as any).finalCLS = cumulativeScore;
        }, 3000);
      });
      
      // Wait for measurement to complete
      setTimeout(async () => {
        const score = await this.page.evaluate(() => (window as any).finalCLS || 0);
        resolve(score);
      }, 3500);
    });
  }

  /**
   * Start memory monitoring
   */
  async startMemoryMonitoring(): Promise<void> {
    await this.page.evaluate(() => {
      (window as any).memoryStats = [];
      
      const collectMemory = () => {
        if ('memory' in performance) {
          (window as any).memoryStats.push({
            timestamp: Date.now(),
            ...(performance as any).memory
          });
        }
      };
      
      // Collect memory stats every second
      (window as any).memoryInterval = setInterval(collectMemory, 1000);
      collectMemory(); // Initial collection
    });
  }

  /**
   * Get memory metrics
   */
  async getMemoryMetrics(): Promise<MemoryMetrics> {
    return this.page.evaluate(() => {
      if ((window as any).memoryInterval) {
        clearInterval((window as any).memoryInterval);
      }
      
      const stats = (window as any).memoryStats || [];
      
      if (stats.length === 0) {
        return {
          heapUsed: 0,
          heapTotal: 0,
          heapLimit: 0,
          external: 0
        };
      }
      
      // Get latest memory stats
      const latest = stats[stats.length - 1];
      
      return {
        heapUsed: latest.usedJSHeapSize || 0,
        heapTotal: latest.totalJSHeapSize || 0,
        heapLimit: latest.jsHeapSizeLimit || 0,
        external: 0 // Not available in standard API
      };
    });
  }

  /**
   * Measure JavaScript performance
   */
  async measureJavaScriptPerformance(): Promise<{ getMetrics: () => Promise<JavaScriptMetrics> }> {
    await this.page.evaluate(() => {
      (window as any).jsMetrics = {
        scriptStart: performance.now(),
        longTasks: 0,
        totalBlockingTime: 0
      };
      
      // Track long tasks
      if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            (window as any).jsMetrics.longTasks++;
            // Tasks over 50ms are considered blocking
            if (entry.duration > 50) {
              (window as any).jsMetrics.totalBlockingTime += entry.duration - 50;
            }
          }
        });
        observer.observe({ entryTypes: ['longtask'] });
        (window as any).longTaskObserver = observer;
      }
    });
    
    return {
      getMetrics: async (): Promise<JavaScriptMetrics> => {
        return this.page.evaluate(() => {
          const metrics = (window as any).jsMetrics;
          
          if ((window as any).longTaskObserver) {
            (window as any).longTaskObserver.disconnect();
          }
          
          return {
            scriptDuration: performance.now() - metrics.scriptStart,
            longTasks: metrics.longTasks,
            mainThreadBlocking: metrics.totalBlockingTime
          };
        });
      }
    };
  }

  /**
   * Measure layout shift during viewport resize
   */
  async measureLayoutShiftDuringResize(
    fromViewport: { width: number; height: number },
    toViewport: { width: number; height: number }
  ): Promise<number> {
    await this.page.setViewportSize(fromViewport);
    await this.page.waitForTimeout(100);
    
    // Start measuring layout shifts
    const measurementPromise = this.page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let cumulativeScore = 0;
        
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'layout-shift') {
              cumulativeScore += (entry as any).value;
            }
          }
        });
        
        observer.observe({ entryTypes: ['layout-shift'] });
        
        // Stop measuring after 1 second
        setTimeout(() => {
          observer.disconnect();
          resolve(cumulativeScore);
        }, 1000);
      });
    });
    
    // Trigger resize
    await this.page.setViewportSize(toViewport);
    
    return measurementPromise;
  }

  /**
   * Get paint timing metrics
   */
  async getPaintTimings(): Promise<{ [key: string]: number }> {
    return this.page.evaluate(() => {
      const paintTimings: { [key: string]: number } = {};
      
      if ('performance' in window && 'getEntriesByType' in performance) {
        const paintEntries = performance.getEntriesByType('paint');
        paintEntries.forEach((entry) => {
          paintTimings[entry.name] = entry.startTime;
        });
      }
      
      return paintTimings;
    });
  }

  /**
   * Measure Time to Interactive (TTI)
   */
  async measureTimeToInteractive(): Promise<number> {
    return this.page.evaluate(() => {
      return new Promise<number>((resolve) => {
        const startTime = performance.timing.navigationStart;
        let tti = 0;
        
        // Simple TTI calculation: when no long tasks occur for 5 seconds
        let lastLongTaskTime = 0;
        
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            lastLongTaskTime = entry.startTime + entry.duration;
          }
        });
        
        observer.observe({ entryTypes: ['longtask'] });
        
        // Check for 5 seconds of inactivity
        const checkTTI = () => {
          const now = performance.now();
          if (now - lastLongTaskTime > 5000) {
            tti = lastLongTaskTime || now;
            observer.disconnect();
            resolve(tti);
          } else {
            setTimeout(checkTTI, 1000);
          }
        };
        
        setTimeout(checkTTI, 1000);
        
        // Fallback timeout
        setTimeout(() => {
          observer.disconnect();
          resolve(performance.now());
        }, 30000);
      });
    });
  }

  /**
   * Measure frame rate
   */
  async measureFrameRate(duration: number = 3000): Promise<number> {
    return this.page.evaluate((testDuration) => {
      return new Promise<number>((resolve) => {
        let frames = 0;
        const startTime = performance.now();
        
        const countFrame = () => {
          frames++;
          if (performance.now() - startTime < testDuration) {
            requestAnimationFrame(countFrame);
          } else {
            const fps = frames / (testDuration / 1000);
            resolve(fps);
          }
        };
        
        requestAnimationFrame(countFrame);
      });
    }, duration);
  }

  /**
   * Stop all performance monitoring
   */
  async stopMonitoring(): Promise<void> {
    await this.page.evaluate(() => {
      // Disconnect all observers
      if ((window as any).performanceObservers) {
        Object.values((window as any).performanceObservers).forEach((observer: any) => {
          if (observer && observer.disconnect) {
            observer.disconnect();
          }
        });
      }
      
      // Clear intervals
      if ((window as any).memoryInterval) {
        clearInterval((window as any).memoryInterval);
      }
    });
  }

  /**
   * Generate comprehensive performance report
   */
  async generatePerformanceReport(): Promise<{
    vitals: CoreWebVitals;
    memory: MemoryMetrics;
    javascript: JavaScriptMetrics;
    paintTimings: { [key: string]: number };
    frameRate: number;
  }> {
    const vitals = await this.getCoreWebVitals();
    const memory = await this.getMemoryMetrics();
    const jsMetrics = await this.measureJavaScriptPerformance();
    const javascript = await jsMetrics.getMetrics();
    const paintTimings = await this.getPaintTimings();
    const frameRate = await this.measureFrameRate();
    
    return {
      vitals,
      memory,
      javascript,
      paintTimings,
      frameRate
    };
  }
}
