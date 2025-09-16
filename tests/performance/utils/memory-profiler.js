/**
 * Memory Profiler Utility
 * Monitors memory usage and detects leaks
 */

const { performance } = require('perf_hooks');
const v8 = require('v8');

class MemoryProfiler {
  constructor() {
    this.reset();
    this.componentSimulations = new Map();
  }

  reset() {
    this.snapshots = [];
    this.leakDetectionData = [];
    this.componentMemoryData = new Map();
    this.startTime = performance.now();
    this.baselineMemory = null;
  }

  async getMemoryUsage() {
    const memUsage = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();
    
    return {
      timestamp: performance.now(),
      rss: memUsage.rss,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
      heapSizeLimit: heapStats.heap_size_limit,
      totalHeapSize: heapStats.total_heap_size,
      usedHeapSize: heapStats.used_heap_size,
      mallocedMemory: heapStats.malloced_memory,
      numberOfNativeContexts: heapStats.number_of_native_contexts,
      numberOfDetachedContexts: heapStats.number_of_detached_contexts
    };
  }

  async takeSnapshot(label = '') {
    const memoryUsage = await this.getMemoryUsage();
    const snapshot = {
      ...memoryUsage,
      label,
      relativeTime: memoryUsage.timestamp - this.startTime
    };
    
    this.snapshots.push(snapshot);
    
    if (!this.baselineMemory) {
      this.baselineMemory = snapshot;
    }
    
    return snapshot;
  }

  async simulateComponentMount(componentName, props = {}) {
    const beforeMount = await this.takeSnapshot(`${componentName}_before_mount`);
    
    // Simulate component memory allocation
    const componentData = this.createComponentSimulation(componentName, props);
    
    // Store component in memory to simulate mounting
    this.componentSimulations.set(componentName, componentData);
    
    const afterMount = await this.takeSnapshot(`${componentName}_after_mount`);
    
    const memoryOverhead = {
      heapIncrease: afterMount.heapUsed - beforeMount.heapUsed,
      rssIncrease: afterMount.rss - beforeMount.rss,
      externalIncrease: afterMount.external - beforeMount.external
    };
    
    this.componentMemoryData.set(componentName, {
      mountTime: afterMount.timestamp,
      beforeMount,
      afterMount,
      memoryOverhead,
      props: this.calculatePropsSize(props)
    });
    
    return memoryOverhead;
  }

  createComponentSimulation(componentName, props) {
    // Simulate different component types with realistic memory patterns
    const componentTypes = {
      SearchInput: () => this.simulateSearchInputComponent(props),
      SearchResults: () => this.simulateSearchResultsComponent(props),
      SearchFilters: () => this.simulateSearchFiltersComponent(props),
      SearchPagination: () => this.simulateSearchPaginationComponent(props),
      SearchSuggestions: () => this.simulateSearchSuggestionsComponent(props)
    };
    
    const simulator = componentTypes[componentName] || (() => this.simulateGenericComponent(props));
    return simulator();
  }

  simulateSearchInputComponent(props) {
    // SearchInput: lightweight component with event handlers
    return {
      state: {
        value: '',
        focused: false,
        suggestions: props.suggestions || []
      },
      eventHandlers: new Array(5).fill(null).map(() => () => {}),
      domRefs: new Array(3).fill(null).map(() => ({ current: {} })),
      cache: new Map()
    };
  }

  simulateSearchResultsComponent(props) {
    // SearchResults: heavy component with large data sets
    const results = props.results || [];
    return {
      state: {
        results: results.map(r => ({ ...r, rendered: true })),
        selectedItems: new Set(),
        sortOrder: 'relevance',
        viewType: 'list'
      },
      virtualizedData: {
        visibleItems: results.slice(0, 50),
        totalHeight: results.length * 100,
        scrollPosition: 0
      },
      renderedComponents: new Array(Math.min(results.length, 50))
        .fill(null)
        .map((_, i) => ({ id: i, element: {}, handlers: {} })),
      cacheData: new Map(results.map((r, i) => [i, r]))
    };
  }

  simulateSearchFiltersComponent(props) {
    // SearchFilters: medium component with form state
    const filters = props.filters || {};
    return {
      state: {
        activeFilters: new Map(),
        availableFilters: filters,
        expandedSections: new Set(['category']),
        filterCounts: new Map()
      },
      formData: {
        categories: filters.categories || [],
        tags: filters.tags || [],
        dateRanges: filters.dateRanges || []
      },
      eventHandlers: new Array(10).fill(null).map(() => () => {})
    };
  }

  simulateSearchPaginationComponent(props) {
    // SearchPagination: lightweight component
    return {
      state: {
        currentPage: 1,
        totalPages: props.totalPages || 10,
        pageSize: props.pageSize || 20
      },
      pageNumbers: new Array(props.totalPages || 10).fill(0).map((_, i) => i + 1)
    };
  }

  simulateSearchSuggestionsComponent(props) {
    // SearchSuggestions: medium component with dynamic data
    const suggestions = props.suggestions || [];
    return {
      state: {
        suggestions: suggestions.map(s => ({ text: s, highlighted: false })),
        selectedIndex: -1,
        visible: true
      },
      suggestionCache: new Map(suggestions.map((s, i) => [s, { index: i, score: Math.random() }])),
      eventHandlers: new Array(suggestions.length).fill(null).map(() => () => {})
    };
  }

  simulateGenericComponent(props) {
    return {
      state: { ...props },
      genericData: new Array(100).fill(null).map((_, i) => ({ id: i, data: `item_${i}` }))
    };
  }

  calculatePropsSize(props) {
    // Rough estimation of props memory size
    const jsonString = JSON.stringify(props);
    return {
      estimatedBytes: jsonString.length * 2, // UTF-16 encoding
      propCount: Object.keys(props).length,
      nestedObjectCount: this.countNestedObjects(props)
    };
  }

  countNestedObjects(obj, depth = 0) {
    if (depth > 10 || typeof obj !== 'object' || obj === null) return 0;
    
    let count = 1;
    for (const value of Object.values(obj)) {
      if (typeof value === 'object' && value !== null) {
        count += this.countNestedObjects(value, depth + 1);
      }
    }
    return count;
  }

  async simulateUserInteraction(componentName) {
    const component = this.componentSimulations.get(componentName);
    if (!component) return;
    
    // Simulate different interaction patterns
    const interactions = {
      SearchInput: () => this.simulateSearchInputInteraction(component),
      SearchResults: () => this.simulateSearchResultsInteraction(component),
      SearchFilters: () => this.simulateSearchFiltersInteraction(component),
      SearchPagination: () => this.simulateSearchPaginationInteraction(component),
      SearchSuggestions: () => this.simulateSearchSuggestionsInteraction(component)
    };
    
    const interactionFn = interactions[componentName] || (() => {});
    interactionFn();
    
    // Small delay to simulate real interaction
    await new Promise(resolve => setTimeout(resolve, 1));
  }

  simulateSearchInputInteraction(component) {
    // Simulate typing and suggestion updates
    component.state.value = 'test query ' + Math.random();
    component.state.suggestions = new Array(10).fill(null)
      .map((_, i) => `suggestion ${i} for ${component.state.value}`);
  }

  simulateSearchResultsInteraction(component) {
    // Simulate scrolling and item selection
    const newSelectedItem = Math.floor(Math.random() * component.state.results.length);
    component.state.selectedItems.add(newSelectedItem);
    
    // Simulate virtual scrolling
    const newScrollPosition = Math.random() * component.virtualizedData.totalHeight;
    component.virtualizedData.scrollPosition = newScrollPosition;
  }

  simulateSearchFiltersInteraction(component) {
    // Simulate filter selection
    const filterKey = `filter_${Math.floor(Math.random() * 10)}`;
    component.state.activeFilters.set(filterKey, true);
  }

  simulateSearchPaginationInteraction(component) {
    // Simulate page navigation
    component.state.currentPage = Math.min(
      component.state.totalPages,
      Math.max(1, Math.floor(Math.random() * component.state.totalPages) + 1)
    );
  }

  simulateSearchSuggestionsInteraction(component) {
    // Simulate suggestion selection
    component.state.selectedIndex = Math.floor(Math.random() * component.state.suggestions.length);
  }

  async simulateComponentUnmount(componentName) {
    const beforeUnmount = await this.takeSnapshot(`${componentName}_before_unmount`);
    
    // Remove component simulation
    this.componentSimulations.delete(componentName);
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const afterUnmount = await this.takeSnapshot(`${componentName}_after_unmount`);
    
    const componentData = this.componentMemoryData.get(componentName);
    if (componentData) {
      componentData.beforeUnmount = beforeUnmount;
      componentData.afterUnmount = afterUnmount;
      componentData.memoryReleased = {
        heapReleased: beforeUnmount.heapUsed - afterUnmount.heapUsed,
        rssReleased: beforeUnmount.rss - afterUnmount.rss
      };
    }
    
    return afterUnmount;
  }

  async simulateUIUpdate() {
    // Simulate a UI update cycle affecting multiple components
    for (const [componentName, component] of this.componentSimulations.entries()) {
      await this.simulateUserInteraction(componentName);
    }
    
    // Add some temporary objects to simulate framework overhead
    const tempObjects = new Array(100).fill(null).map((_, i) => ({
      id: i,
      timestamp: Date.now(),
      data: `temp_${i}`,
      handlers: [() => {}, () => {}]
    }));
    
    // Brief pause to simulate processing
    await new Promise(resolve => setTimeout(resolve, 5));
    
    // Clear temp objects
    tempObjects.length = 0;
  }

  analyzeMemoryLeaks() {
    if (this.snapshots.length < 3) {
      return { status: 'insufficient_data', snapshots: this.snapshots.length };
    }
    
    // Analyze trend in memory usage
    const recentSnapshots = this.snapshots.slice(-10);
    const heapTrend = this.calculateMemoryTrend(recentSnapshots.map(s => s.heapUsed));
    const rssTrend = this.calculateMemoryTrend(recentSnapshots.map(s => s.rss));
    
    // Calculate memory growth rate
    const firstSnapshot = this.snapshots[0];
    const lastSnapshot = this.snapshots[this.snapshots.length - 1];
    const timeElapsed = lastSnapshot.timestamp - firstSnapshot.timestamp;
    
    const heapGrowthRate = (lastSnapshot.heapUsed - firstSnapshot.heapUsed) / timeElapsed; // bytes per ms
    const rssGrowthRate = (lastSnapshot.rss - firstSnapshot.rss) / timeElapsed;
    
    // Detect potential leaks
    const heapLeakSuspected = heapGrowthRate > 1024; // > 1KB per ms
    const rssLeakSuspected = rssGrowthRate > 2048; // > 2KB per ms
    
    return {
      status: heapLeakSuspected || rssLeakSuspected ? 'leak_suspected' : 'normal',
      heapTrend,
      rssTrend,
      growthRates: {
        heapGrowthRate: heapGrowthRate * 1000, // Convert to bytes per second
        rssGrowthRate: rssGrowthRate * 1000
      },
      leakIndicators: {
        heapLeakSuspected,
        rssLeakSuspected,
        continuousGrowth: heapTrend.direction === 'increasing' && heapTrend.confidence > 0.8
      },
      snapshots: this.snapshots.length,
      timeElapsed
    };
  }

  calculateMemoryTrend(values) {
    if (values.length < 2) {
      return { direction: 'unknown', confidence: 0 };
    }
    
    // Calculate linear regression to determine trend
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    // Calculate R-squared for confidence
    const yMean = sumY / n;
    const totalSumSquares = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const residualSumSquares = y.reduce((sum, yi, i) => {
      const predicted = slope * x[i] + (sumY - slope * sumX) / n;
      return sum + Math.pow(yi - predicted, 2);
    }, 0);
    
    const rSquared = 1 - (residualSumSquares / totalSumSquares);
    
    return {
      direction: slope > 100 ? 'increasing' : slope < -100 ? 'decreasing' : 'stable',
      slope,
      confidence: Math.max(0, Math.min(1, rSquared))
    };
  }

  getComponentMemoryReport() {
    const report = {
      components: {},
      summary: {
        totalComponents: this.componentMemoryData.size,
        totalMemoryOverhead: 0,
        averageComponentSize: 0,
        componentsPassingLimit: 0
      }
    };
    
    for (const [componentName, data] of this.componentMemoryData.entries()) {
      const memoryMB = data.memoryOverhead.heapIncrease / (1024 * 1024);
      const passed = memoryMB < 50;
      
      report.components[componentName] = {
        memoryUsageMB: memoryMB,
        memoryOverhead: data.memoryOverhead,
        propsSize: data.props,
        passed,
        mountTime: data.mountTime,
        memoryReleased: data.memoryReleased || null
      };
      
      report.summary.totalMemoryOverhead += data.memoryOverhead.heapIncrease;
      if (passed) report.summary.componentsPassingLimit++;
    }
    
    report.summary.averageComponentSize = report.summary.totalMemoryOverhead / 
      (report.summary.totalComponents * 1024 * 1024);
    
    return report;
  }

  generateMemoryReport() {
    const componentReport = this.getComponentMemoryReport();
    const leakAnalysis = this.analyzeMemoryLeaks();
    
    return {
      timestamp: new Date().toISOString(),
      testDuration: performance.now() - this.startTime,
      
      summary: {
        totalSnapshots: this.snapshots.length,
        baselineMemory: this.baselineMemory,
        currentMemory: this.snapshots[this.snapshots.length - 1] || null,
        memoryGrowth: this.baselineMemory && this.snapshots.length > 0 ? 
          this.snapshots[this.snapshots.length - 1].heapUsed - this.baselineMemory.heapUsed : 0
      },
      
      componentAnalysis: componentReport,
      leakAnalysis,
      
      performance: {
        snapshots: this.snapshots.slice(-20), // Last 20 snapshots
        componentSimulations: this.componentSimulations.size
      },
      
      validation: {
        allComponentsUnder50MB: componentReport.summary.componentsPassingLimit === componentReport.summary.totalComponents,
        noMemoryLeaksDetected: leakAnalysis.status !== 'leak_suspected',
        overallPassed: this.validateMemoryRequirements(componentReport, leakAnalysis)
      }
    };
  }

  validateMemoryRequirements(componentReport, leakAnalysis) {
    const componentsPass = componentReport.summary.componentsPassingLimit === componentReport.summary.totalComponents;
    const noLeaks = leakAnalysis.status !== 'leak_suspected';
    const totalMemoryReasonable = componentReport.summary.totalMemoryOverhead < 200 * 1024 * 1024; // 200MB total
    
    return componentsPass && noLeaks && totalMemoryReasonable;
  }
}

module.exports = MemoryProfiler;
