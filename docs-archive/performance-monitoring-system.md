# React Performance Monitoring System

## Overview

A comprehensive React performance monitoring system built using the React DevTools Profiler API that provides real-time performance tracking, bottleneck identification, and optimization recommendations. The system ensures smooth 60fps operation by detecting renders that exceed the 16ms threshold.

## Features

### ⚡ Core Performance Monitoring
- **React Profiler API Integration**: Seamless integration with React's built-in profiling capabilities
- **16ms Threshold Detection**: Automatic detection of renders exceeding 60fps threshold
- **Real-time Metrics**: Live performance data collection and analysis
- **Component Health Scoring**: A-F grading system for component performance

### 📊 Real-time Dashboard
- **Live Performance Metrics**: Total renders, average render time, slow renders, max render time
- **Interactive Charts**: Visual timeline of render performance with threshold indicators
- **Component Health Cards**: Individual component performance assessments
- **Alert Management**: Real-time notifications for performance issues

### 🚨 Intelligent Alerts System
- **Configurable Thresholds**: Customizable warning and critical thresholds
- **Multiple Alert Types**: Render, memory, interaction, and threshold alerts
- **Desktop Notifications**: Browser-based notifications for critical issues
- **Auto-resolution**: Intelligent alert lifecycle management

### 🔍 Advanced Bottleneck Detection
- **Automated Analysis**: ML-powered bottleneck identification
- **Root Cause Analysis**: Technical explanations and business impact assessment
- **Trend Analysis**: Performance degradation detection over time
- **Evidence-based Reporting**: Detailed evidence for each identified issue

### 💡 Optimization Recommendations
- **Priority-based Suggestions**: Critical, high, medium, and low priority recommendations
- **Implementation Guidance**: Detailed steps and code examples
- **Impact Estimation**: Predicted performance improvements
- **Difficulty Assessment**: Implementation complexity ratings

### 🧠 Memory & Interaction Tracking
- **Memory Leak Detection**: Automatic identification of memory leaks
- **Interaction Performance**: User interaction response time monitoring
- **Batch Analysis**: Performance analysis over time windows
- **Memory Trend Analysis**: Growing, stable, or decreasing memory usage patterns

## Installation

```bash
# The system is already integrated into the application
# No additional installation required
```

## Quick Start

### Basic Usage

```tsx
import React from 'react';
import { useReactProfiler } from '../hooks/useReactProfiler';

const MyComponent: React.FC = () => {
  const { ProfilerWrapper } = useReactProfiler({
    componentName: 'MyComponent',
    enableLogging: true,
    thresholds: {
      critical: 16, // 16ms for 60fps
      warning: 12,
      good: 8
    }
  });

  return (
    <ProfilerWrapper id="my-component">
      <div>
        {/* Your component content */}
      </div>
    </ProfilerWrapper>
  );
};
```

### Dashboard Integration

```tsx
import React from 'react';
import { PerformanceDashboard } from '../components/performance/PerformanceDashboard';
import { PerformanceAlerts } from '../components/performance/PerformanceAlerts';

const App: React.FC = () => {
  return (
    <div>
      {/* Your app content */}

      {/* Performance monitoring components */}
      <PerformanceAlerts
        enableDesktopNotifications={true}
        position="top-right"
      />

      <PerformanceDashboard
        title="Application Performance"
        realTime={true}
        enableExport={true}
      />
    </div>
  );
};
```

## API Reference

### Hooks

#### `useReactProfiler(options)`

Main hook for React Profiler API integration.

```tsx
interface ProfilerOptions {
  componentName?: string;
  thresholds?: Partial<PerformanceThresholds>;
  enableLogging?: boolean;
  sampleRate?: number; // 0-1
  trackMemory?: boolean;
  metadata?: Record<string, any>;
}
```

**Returns:**
- `onRenderCallback`: Profiler callback function
- `ProfilerWrapper`: Component wrapper with profiling

#### `usePerformanceStore()`

Hook to access the global performance store.

```tsx
const {
  store,           // Current performance metrics
  clearMetrics,    // Clear all metrics
  setThresholds,   // Update thresholds
  thresholds       // Current thresholds
} = usePerformanceStore();
```

#### `useComponentHealth(componentName)`

Get health assessment for a specific component.

```tsx
const health = useComponentHealth('MyComponent');
// Returns: ComponentHealthScore with grade, score, issues, recommendations
```

#### `useInteractionTracking(componentName)`

Track user interaction performance.

```tsx
const {
  interactions,        // List of tracked interactions
  trackClick,          // Track click interactions
  trackInput,          // Track input interactions
  clearInteractions    // Clear interaction history
} = useInteractionTracking('MyComponent');
```

#### `useMemoryTracking(componentName, interval?)`

Monitor memory usage and detect leaks.

```tsx
const {
  memoryMetrics,       // Memory usage history
  hasMemoryLeak,       // Boolean leak detection
  memoryTrend,         // 'increasing' | 'decreasing' | 'stable'
  currentMemoryUsage   // Current memory usage in bytes
} = useMemoryTracking('MyComponent', 5000);
```

### Components

#### `<PerformanceDashboard />`

Real-time performance monitoring dashboard.

```tsx
interface DashboardProps {
  title?: string;
  showDetails?: boolean;
  realTime?: boolean;
  updateInterval?: number;
  monitoredComponents?: string[];
  customThresholds?: Partial<PerformanceThresholds>;
  theme?: 'light' | 'dark';
  enableExport?: boolean;
}
```

#### `<PerformanceAlerts />`

Performance alerts management system.

```tsx
interface AlertManagerProps {
  rules?: AlertRule[];
  maxAlerts?: number;
  enableDesktopNotifications?: boolean;
  autoClearAfter?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  customAlertRenderer?: (alert: PerformanceAlert) => React.ReactNode;
}
```

### Utilities

#### `bottleneckAnalyzer`

Advanced bottleneck detection and analysis.

```tsx
import { bottleneckAnalyzer } from '../utils/performanceBottlenecks';

// Analyze performance store for bottlenecks
const bottlenecks = bottleneckAnalyzer.analyzeStore(store);

// Analyze batch performance data
const batchBottlenecks = bottleneckAnalyzer.analyzeBatches(batches);

// Get historical bottlenecks for component
const history = bottleneckAnalyzer.getComponentHistory('MyComponent');
```

## Performance Thresholds

### Default Thresholds

```tsx
const DEFAULT_THRESHOLDS = {
  critical: 16,  // 16ms for 60fps
  warning: 12,   // 12ms warning zone
  good: 8        // 8ms excellent performance
};
```

### Custom Thresholds

```tsx
const customThresholds = {
  critical: 20,  // Custom critical threshold
  warning: 15,   // Custom warning threshold
  good: 10       // Custom good performance threshold
};
```

## Alert Types

### Render Alerts
- **Slow Render**: Component exceeds critical threshold
- **Critical Render**: Component exceeds 2x critical threshold
- **Inconsistent Performance**: High variance in render times

### Memory Alerts
- **Memory Leak**: Continuous memory growth detected
- **High Memory Usage**: Memory usage above threshold

### Interaction Alerts
- **Slow Interaction**: User interaction takes >100ms
- **Blocking Interaction**: Main thread blocked during interaction

### System Alerts
- **Excessive Re-renders**: Component re-rendering too frequently
- **Performance Degradation**: Performance worsening over time

## Bottleneck Types

### Render Bottlenecks
1. **Slow Renders**: Consistently high render times
2. **Inconsistent Performance**: Variable render performance
3. **Excessive Re-renders**: Too many renders in short time
4. **Mount/Update Imbalance**: Updates slower than mounts

### Memory Bottlenecks
1. **Memory Leaks**: Growing memory usage
2. **High Memory Usage**: Above threshold memory consumption

### Interaction Bottlenecks
1. **Blocking Interactions**: Main thread blocking
2. **Slow Response**: Delayed interaction feedback

## Optimization Recommendations

### Common Recommendations

#### React.memo
```tsx
const MyComponent = React.memo(({ prop1, prop2 }) => {
  // Component logic
});

// Custom comparison
const MyComponent = React.memo(Component, (prevProps, nextProps) => {
  return prevProps.id === nextProps.id;
});
```

#### useMemo for Expensive Calculations
```tsx
const expensiveValue = useMemo(() => {
  return expensiveCalculation(data);
}, [data]);
```

#### useCallback for Stable References
```tsx
const handleClick = useCallback((event) => {
  // Handle click
}, [dependency]);
```

#### startTransition for Non-urgent Updates
```tsx
import { startTransition } from 'react';

const handleSearch = (query) => {
  startTransition(() => {
    setSearchResults(performSearch(query));
  });
};
```

## Best Practices

### Component Design
1. **Keep Components Small**: Smaller components are easier to optimize
2. **Minimize Props**: Reduce prop complexity and frequency of changes
3. **Use Proper Keys**: Ensure stable keys for list items
4. **Avoid Inline Objects**: Don't create objects in render

### State Management
1. **Normalize State**: Flat state structures perform better
2. **Colocate State**: Keep state close to where it's used
3. **Split State**: Separate frequently changing from stable state
4. **Use Reducers**: For complex state updates

### Memory Management
1. **Cleanup Effects**: Always cleanup in useEffect
2. **Remove Listeners**: Clean up event listeners and timers
3. **Avoid Closures**: Be careful with closure scope
4. **Clear Intervals**: Always clear timeouts and intervals

### Interaction Optimization
1. **Debounce Input**: Use debouncing for search inputs
2. **Throttle Events**: Throttle scroll and resize events
3. **Virtual Scrolling**: For large lists
4. **Code Splitting**: Lazy load components

## Troubleshooting

### Common Issues

#### High Memory Usage
```tsx
// ❌ Memory leak - missing cleanup
useEffect(() => {
  const interval = setInterval(callback, 1000);
  // Missing cleanup!
}, []);

// ✅ Proper cleanup
useEffect(() => {
  const interval = setInterval(callback, 1000);
  return () => clearInterval(interval);
}, []);
```

#### Excessive Re-renders
```tsx
// ❌ Creates new object every render
const config = { theme: 'dark', size: 'large' };

// ✅ Stable reference
const config = useMemo(() => ({
  theme: 'dark',
  size: 'large'
}), []);
```

#### Slow Renders
```tsx
// ❌ Expensive calculation in render
const result = expensiveCalculation(data);

// ✅ Memoized calculation
const result = useMemo(() =>
  expensiveCalculation(data), [data]
);
```

### Performance Debugging

1. **Enable Logging**: Set `enableLogging: true` in profiler options
2. **Check Console**: Monitor console for performance warnings
3. **Use Dashboard**: Monitor real-time metrics in dashboard
4. **Analyze Bottlenecks**: Review bottleneck analysis reports
5. **Export Data**: Export performance data for offline analysis

## Examples

### Complete Integration Example

See `/src/examples/PerformanceMonitoringExample.tsx` for a comprehensive example showing:

- Multiple component types with different performance characteristics
- Real-time dashboard integration
- Alert system demonstration
- Bottleneck detection scenarios
- Export functionality

### Test Scenarios

The example includes several test scenarios:

1. **Slow Renders**: Components exceeding 16ms threshold
2. **Memory Leaks**: Components with growing memory usage
3. **Excessive Re-renders**: High frequency component updates
4. **Optimized Components**: Well-optimized baseline components

## Configuration

### Environment Variables

```bash
# Enable development mode logging
NODE_ENV=development

# Disable performance monitoring in production
REACT_APP_DISABLE_PERFORMANCE_MONITORING=true
```

### Advanced Configuration

```tsx
// Custom performance thresholds
const customConfig = {
  thresholds: {
    critical: 20,
    warning: 15,
    good: 10
  },
  sampleRate: 0.1, // Sample 10% of renders
  enableLogging: process.env.NODE_ENV === 'development',
  trackMemory: true
};
```

## Browser Support

### Requirements
- Modern browsers supporting React 18+
- Performance API support
- Memory API (optional, for memory tracking)
- Notification API (optional, for desktop alerts)

### Fallbacks
- Graceful degradation when APIs not available
- Console-only alerts when notifications not supported
- Basic metrics when memory API unavailable

## Performance Impact

The monitoring system is designed to have minimal impact on application performance:

- **Sampling**: Configurable sample rate to reduce overhead
- **Lazy Loading**: Components loaded only when needed
- **Efficient Storage**: Automatic cleanup of old metrics
- **Conditional Logging**: Development-only detailed logging

## Contributing

When contributing to the performance monitoring system:

1. **Test Performance Impact**: Ensure changes don't degrade performance
2. **Update Documentation**: Keep documentation in sync with code
3. **Add Tests**: Include tests for new functionality
4. **Follow Patterns**: Use established patterns and conventions
5. **Consider Backwards Compatibility**: Maintain API compatibility

## License

This performance monitoring system is part of the Mainframe KB Assistant project and follows the same license terms.

---

## Support

For questions, issues, or contributions related to the performance monitoring system, please refer to the main project documentation or create an issue in the project repository.