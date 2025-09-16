/**
 * Performance Monitoring for Visual Consistency
 *
 * Monitors layout performance, animation smoothness, and visual metrics
 * across different breakpoints and device types
 *
 * @version 1.0.0
 * @author Visual Consistency Specialist
 */

class VisualPerformanceMonitor {
  constructor() {
    this.metrics = {
      coreWebVitals: {},
      customMetrics: {},
      renderingMetrics: {},
      responsiveMetrics: {},
      animationMetrics: {}
    };

    this.thresholds = {
      lcp: 2.5, // Largest Contentful Paint (seconds)
      fid: 100, // First Input Delay (milliseconds)
      cls: 0.1, // Cumulative Layout Shift
      fcp: 1.8, // First Contentful Paint (seconds)
      inp: 200, // Interaction to Next Paint (milliseconds)
      animationFps: 55, // Minimum FPS for smooth animations
      resizeTime: 100, // Max time for layout adaptation (milliseconds)
      reflow: 5 // Max number of reflows during resize
    };

    this.observers = new Map();
    this.isMonitoring = false;
  }

  /**
   * Start comprehensive performance monitoring
   */
  startMonitoring(config = {}) {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.config = { ...this.getDefaultConfig(), ...config };

    this.initializeCoreWebVitals();
    this.initializeLayoutMonitoring();
    this.initializeAnimationMonitoring();
    this.initializeResponsiveMonitoring();
    this.initializeRenderingMonitoring();

    console.log('🚀 Visual performance monitoring started');
  }

  /**
   * Stop monitoring and return collected metrics
   */
  stopMonitoring() {
    if (!this.isMonitoring) return this.metrics;

    this.isMonitoring = false;

    // Disconnect all observers
    this.observers.forEach(observer => {
      if (observer && typeof observer.disconnect === 'function') {
        observer.disconnect();
      }
    });

    this.observers.clear();

    console.log('📊 Visual performance monitoring stopped');
    return this.getReport();
  }

  /**
   * Initialize Core Web Vitals monitoring
   */
  initializeCoreWebVitals() {
    // Largest Contentful Paint (LCP)
    this.observeMetric('largest-contentful-paint', (entry) => {
      this.metrics.coreWebVitals.lcp = {
        value: entry.renderTime || entry.loadTime,
        threshold: this.thresholds.lcp * 1000,
        rating: this.getRating(entry.renderTime || entry.loadTime, this.thresholds.lcp * 1000, 'lcp'),
        element: entry.element?.tagName || 'unknown',
        url: entry.url || ''
      };
    });

    // First Input Delay (FID)
    this.observeMetric('first-input', (entry) => {
      this.metrics.coreWebVitals.fid = {
        value: entry.processingStart - entry.startTime,
        threshold: this.thresholds.fid,
        rating: this.getRating(entry.processingStart - entry.startTime, this.thresholds.fid, 'fid'),
        inputType: entry.name,
        target: entry.target?.tagName || 'unknown'
      };
    });

    // Cumulative Layout Shift (CLS)
    let clsValue = 0;
    this.observeMetric('layout-shift', (entry) => {
      if (!entry.hadRecentInput) {
        clsValue += entry.value;
        this.metrics.coreWebVitals.cls = {
          value: clsValue,
          threshold: this.thresholds.cls,
          rating: this.getRating(clsValue, this.thresholds.cls, 'cls'),
          shifts: (this.metrics.coreWebVitals.cls?.shifts || 0) + 1
        };
      }
    });

    // First Contentful Paint (FCP)
    this.observeMetric('first-contentful-paint', (entry) => {
      this.metrics.coreWebVitals.fcp = {
        value: entry.startTime,
        threshold: this.thresholds.fcp * 1000,
        rating: this.getRating(entry.startTime, this.thresholds.fcp * 1000, 'fcp')
      };
    });
  }

  /**
   * Initialize layout monitoring for responsive changes
   */
  initializeLayoutMonitoring() {
    if (typeof ResizeObserver !== 'undefined') {
      const layoutMetrics = {
        resizeCount: 0,
        totalResizeTime: 0,
        avgResizeTime: 0,
        maxResizeTime: 0,
        reflowCount: 0
      };

      const resizeObserver = new ResizeObserver((entries) => {
        const startTime = performance.now();

        entries.forEach(entry => {
          const resizeTime = performance.now() - startTime;

          layoutMetrics.resizeCount++;
          layoutMetrics.totalResizeTime += resizeTime;
          layoutMetrics.avgResizeTime = layoutMetrics.totalResizeTime / layoutMetrics.resizeCount;
          layoutMetrics.maxResizeTime = Math.max(layoutMetrics.maxResizeTime, resizeTime);

          if (resizeTime > this.thresholds.resizeTime) {
            layoutMetrics.reflowCount++;
          }
        });

        this.metrics.responsiveMetrics = layoutMetrics;
      });

      // Observe the main content area
      const mainContent = document.querySelector('main, #root, .app, body');
      if (mainContent) {
        resizeObserver.observe(mainContent);
        this.observers.set('resize', resizeObserver);
      }
    }
  }

  /**
   * Initialize animation performance monitoring
   */
  initializeAnimationMonitoring() {
    const animationMetrics = {
      frameRate: [],
      droppedFrames: 0,
      jankFrames: 0,
      smoothFrames: 0,
      averageFps: 0,
      animations: []
    };

    let lastFrameTime = performance.now();
    let frameCount = 0;

    const measureFrame = (timestamp) => {
      if (!this.isMonitoring) return;

      const delta = timestamp - lastFrameTime;
      const fps = 1000 / delta;

      frameCount++;
      animationMetrics.frameRate.push(fps);

      if (fps < this.thresholds.animationFps) {
        if (fps < 30) {
          animationMetrics.jankFrames++;
        } else {
          animationMetrics.droppedFrames++;
        }
      } else {
        animationMetrics.smoothFrames++;
      }

      // Calculate rolling average FPS
      if (animationMetrics.frameRate.length > 60) {
        animationMetrics.frameRate.shift();
      }

      animationMetrics.averageFps = animationMetrics.frameRate.reduce((sum, fps) => sum + fps, 0) / animationMetrics.frameRate.length;

      lastFrameTime = timestamp;
      this.metrics.animationMetrics = animationMetrics;

      requestAnimationFrame(measureFrame);
    };

    requestAnimationFrame(measureFrame);

    // Monitor CSS animations and transitions
    this.monitorCSSAnimations(animationMetrics);
  }

  /**
   * Monitor CSS animations and transitions
   */
  monitorCSSAnimations(animationMetrics) {
    const animationElements = new Set();

    // Monitor animation events
    ['animationstart', 'animationend', 'transitionstart', 'transitionend'].forEach(event => {
      document.addEventListener(event, (e) => {
        const animation = {
          type: event.includes('animation') ? 'animation' : 'transition',
          element: e.target.tagName,
          property: e.propertyName || e.animationName,
          duration: e.elapsedTime * 1000,
          timestamp: performance.now()
        };

        if (event.includes('start')) {
          animationElements.add(e.target);
          animation.status = 'started';
        } else {
          animationElements.delete(e.target);
          animation.status = 'ended';
        }

        animationMetrics.animations.push(animation);

        // Keep only recent animations
        if (animationMetrics.animations.length > 100) {
          animationMetrics.animations.shift();
        }
      });
    });
  }

  /**
   * Initialize responsive design monitoring
   */
  initializeResponsiveMonitoring() {
    const responsiveMetrics = {
      breakpointChanges: 0,
      adaptationTime: [],
      currentBreakpoint: this.getCurrentBreakpoint(),
      breakpointHistory: []
    };

    let lastWidth = window.innerWidth;

    const handleResize = () => {
      const startTime = performance.now();
      const newWidth = window.innerWidth;
      const newBreakpoint = this.getCurrentBreakpoint();

      if (newBreakpoint !== responsiveMetrics.currentBreakpoint) {
        responsiveMetrics.breakpointChanges++;
        responsiveMetrics.currentBreakpoint = newBreakpoint;
        responsiveMetrics.breakpointHistory.push({
          breakpoint: newBreakpoint,
          timestamp: performance.now(),
          width: newWidth
        });

        // Measure adaptation time
        requestAnimationFrame(() => {
          const adaptationTime = performance.now() - startTime;
          responsiveMetrics.adaptationTime.push(adaptationTime);

          // Keep only recent measurements
          if (responsiveMetrics.adaptationTime.length > 20) {
            responsiveMetrics.adaptationTime.shift();
          }

          this.metrics.responsiveMetrics = {
            ...this.metrics.responsiveMetrics,
            ...responsiveMetrics
          };
        });
      }

      lastWidth = newWidth;
    };

    window.addEventListener('resize', handleResize);
    this.observers.set('resize-listener', { disconnect: () => window.removeEventListener('resize', handleResize) });
  }

  /**
   * Initialize rendering performance monitoring
   */
  initializeRenderingMonitoring() {
    const renderingMetrics = {
      paintTiming: {},
      renderBlocking: [],
      resourceLoading: {},
      memoryUsage: {}
    };

    // Monitor paint timing
    this.observeMetric('paint', (entry) => {
      renderingMetrics.paintTiming[entry.name] = entry.startTime;
    });

    // Monitor resource loading
    this.observeMetric('resource', (entry) => {
      if (entry.renderBlockingStatus) {
        renderingMetrics.renderBlocking.push({
          name: entry.name,
          status: entry.renderBlockingStatus,
          duration: entry.duration
        });
      }

      const resourceType = entry.initiatorType || 'unknown';
      if (!renderingMetrics.resourceLoading[resourceType]) {
        renderingMetrics.resourceLoading[resourceType] = {
          count: 0,
          totalTime: 0,
          avgTime: 0
        };
      }

      const resource = renderingMetrics.resourceLoading[resourceType];
      resource.count++;
      resource.totalTime += entry.duration;
      resource.avgTime = resource.totalTime / resource.count;
    });

    // Monitor memory usage (if available)
    if ('memory' in performance) {
      const updateMemoryUsage = () => {
        renderingMetrics.memoryUsage = {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit,
          usage: performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit
        };
      };

      updateMemoryUsage();
      const memoryInterval = setInterval(updateMemoryUsage, 5000);
      this.observers.set('memory', { disconnect: () => clearInterval(memoryInterval) });
    }

    this.metrics.renderingMetrics = renderingMetrics;
  }

  /**
   * Observe performance metrics
   */
  observeMetric(type, callback) {
    try {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach(callback);
      });
      observer.observe({ type, buffered: true });
      this.observers.set(type, observer);
    } catch (error) {
      console.warn(`Could not observe ${type} metrics:`, error);
    }
  }

  /**
   * Get current breakpoint based on viewport width
   */
  getCurrentBreakpoint() {
    const width = window.innerWidth;
    if (width < 640) return 'mobile';
    if (width < 768) return 'mobile-large';
    if (width < 1024) return 'tablet';
    if (width < 1280) return 'desktop';
    if (width < 1536) return 'desktop-large';
    return 'wide';
  }

  /**
   * Get performance rating based on thresholds
   */
  getRating(value, threshold, metric) {
    const ratios = {
      lcp: [2500, 4000],
      fid: [100, 300],
      cls: [0.1, 0.25],
      fcp: [1800, 3000],
      inp: [200, 500]
    };

    const [good, needsImprovement] = ratios[metric] || [threshold, threshold * 2];

    if (value <= good) return 'good';
    if (value <= needsImprovement) return 'needs-improvement';
    return 'poor';
  }

  /**
   * Get default configuration
   */
  getDefaultConfig() {
    return {
      enabledMetrics: ['cwv', 'layout', 'animation', 'responsive', 'rendering'],
      samplingRate: 1.0,
      reportingInterval: 30000,
      maxStoredEntries: 1000
    };
  }

  /**
   * Generate comprehensive performance report
   */
  getReport() {
    const report = {
      timestamp: new Date().toISOString(),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        breakpoint: this.getCurrentBreakpoint()
      },
      metrics: this.metrics,
      analysis: this.analyzeMetrics(),
      recommendations: this.generateRecommendations()
    };

    return report;
  }

  /**
   * Analyze collected metrics
   */
  analyzeMetrics() {
    const analysis = {
      overallScore: 0,
      categoryScores: {},
      issues: [],
      strengths: []
    };

    // Analyze Core Web Vitals
    const cwvScore = this.analyzeCoreWebVitals();
    analysis.categoryScores.coreWebVitals = cwvScore;

    // Analyze Animation Performance
    const animScore = this.analyzeAnimationPerformance();
    analysis.categoryScores.animations = animScore;

    // Analyze Responsive Performance
    const respScore = this.analyzeResponsivePerformance();
    analysis.categoryScores.responsive = respScore;

    // Calculate overall score
    const scores = Object.values(analysis.categoryScores);
    analysis.overallScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

    return analysis;
  }

  /**
   * Analyze Core Web Vitals performance
   */
  analyzeCoreWebVitals() {
    const cwv = this.metrics.coreWebVitals;
    let score = 100;
    const issues = [];

    if (cwv.lcp && cwv.lcp.rating === 'poor') {
      score -= 30;
      issues.push('Large Contentful Paint is too slow');
    }

    if (cwv.fid && cwv.fid.rating === 'poor') {
      score -= 25;
      issues.push('First Input Delay is too high');
    }

    if (cwv.cls && cwv.cls.rating === 'poor') {
      score -= 25;
      issues.push('Cumulative Layout Shift is too high');
    }

    if (cwv.fcp && cwv.fcp.rating === 'poor') {
      score -= 20;
      issues.push('First Contentful Paint is too slow');
    }

    return Math.max(0, score);
  }

  /**
   * Analyze animation performance
   */
  analyzeAnimationPerformance() {
    const anim = this.metrics.animationMetrics;
    let score = 100;

    if (anim.averageFps < this.thresholds.animationFps) {
      score -= 40;
    }

    if (anim.jankFrames > anim.smoothFrames * 0.1) {
      score -= 30;
    }

    if (anim.droppedFrames > anim.smoothFrames * 0.2) {
      score -= 30;
    }

    return Math.max(0, score);
  }

  /**
   * Analyze responsive performance
   */
  analyzeResponsivePerformance() {
    const resp = this.metrics.responsiveMetrics;
    let score = 100;

    if (resp.avgResizeTime > this.thresholds.resizeTime) {
      score -= 30;
    }

    if (resp.reflowCount > this.thresholds.reflow) {
      score -= 40;
    }

    if (resp.adaptationTime && resp.adaptationTime.length > 0) {
      const avgAdaptation = resp.adaptationTime.reduce((sum, time) => sum + time, 0) / resp.adaptationTime.length;
      if (avgAdaptation > this.thresholds.resizeTime) {
        score -= 30;
      }
    }

    return Math.max(0, score);
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    const cwv = this.metrics.coreWebVitals;
    const anim = this.metrics.animationMetrics;
    const resp = this.metrics.responsiveMetrics;

    // Core Web Vitals recommendations
    if (cwv.lcp && cwv.lcp.rating !== 'good') {
      recommendations.push({
        category: 'Core Web Vitals',
        issue: 'Slow Largest Contentful Paint',
        impact: 'high',
        suggestions: [
          'Optimize largest content element loading',
          'Implement image lazy loading',
          'Use efficient image formats (WebP, AVIF)',
          'Minimize render-blocking resources'
        ]
      });
    }

    if (cwv.cls && cwv.cls.rating !== 'good') {
      recommendations.push({
        category: 'Core Web Vitals',
        issue: 'High Cumulative Layout Shift',
        impact: 'high',
        suggestions: [
          'Set explicit dimensions for images and videos',
          'Avoid inserting content above existing content',
          'Use CSS transforms for animations',
          'Preload critical fonts'
        ]
      });
    }

    // Animation recommendations
    if (anim.averageFps < this.thresholds.animationFps) {
      recommendations.push({
        category: 'Animation Performance',
        issue: 'Low frame rate detected',
        impact: 'medium',
        suggestions: [
          'Use CSS transforms and opacity for animations',
          'Avoid animating layout properties',
          'Implement will-change property strategically',
          'Consider reducing animation complexity'
        ]
      });
    }

    // Responsive recommendations
    if (resp.avgResizeTime > this.thresholds.resizeTime) {
      recommendations.push({
        category: 'Responsive Performance',
        issue: 'Slow responsive adaptation',
        impact: 'medium',
        suggestions: [
          'Optimize CSS media queries',
          'Use container queries where appropriate',
          'Minimize layout recalculations',
          'Implement efficient grid systems'
        ]
      });
    }

    return recommendations;
  }
}

// Export for use in tests and monitoring
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VisualPerformanceMonitor;
}

// Auto-initialize in browser environment
if (typeof window !== 'undefined') {
  window.VisualPerformanceMonitor = VisualPerformanceMonitor;

  // Create global instance for easy access
  window.visualMonitor = new VisualPerformanceMonitor();

  // Expose control methods
  window.startVisualMonitoring = (config) => window.visualMonitor.startMonitoring(config);
  window.stopVisualMonitoring = () => window.visualMonitor.stopMonitoring();
  window.getVisualMetrics = () => window.visualMonitor.metrics;
}