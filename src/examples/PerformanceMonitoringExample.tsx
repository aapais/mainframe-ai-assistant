/**
 * Performance Monitoring Example
 *
 * Comprehensive example showing how to implement and use the React performance
 * monitoring system with React DevTools Profiler API integration
 */

import React, { useState, useEffect, useMemo, useCallback, Profiler } from 'react';
import { useReactProfiler, usePerformanceStore } from '../hooks/useReactProfiler';
import { useComponentHealth, useInteractionTracking, useMemoryTracking } from '../hooks/usePerformanceMonitoring';
import { PerformanceDashboard } from '../components/performance/PerformanceDashboard';
import { PerformanceAlerts } from '../components/performance/PerformanceAlerts';
import { bottleneckAnalyzer, BottleneckIdentification } from '../utils/performanceBottlenecks';

// =========================
// SAMPLE COMPONENTS FOR TESTING
// =========================

/**
 * Intentionally slow component for testing slow renders
 */
const SlowComponent: React.FC<{ intensity?: number; data?: any[] }> = ({
  intensity = 1000000,
  data = []
}) => {
  const { onRenderCallback, ProfilerWrapper } = useReactProfiler({
    componentName: 'SlowComponent',
    enableLogging: true,
    thresholds: {
      critical: 16,
      warning: 10,
      good: 5
    }
  });

  const { trackClick } = useInteractionTracking('SlowComponent');
  const health = useComponentHealth('SlowComponent');

  // Intentionally expensive computation
  const expensiveValue = useMemo(() => {
    let result = 0;
    for (let i = 0; i < intensity; i++) {
      result += Math.random();
    }
    return result;
  }, [intensity, data]); // Adding data as dependency to trigger re-calculations

  const handleClick = useCallback((event: React.MouseEvent) => {
    trackClick(event);

    // Simulate slow operation
    const start = performance.now();
    while (performance.now() - start < 50) {
      // Blocking operation
    }
  }, [trackClick]);

  return (
    <ProfilerWrapper id="slow-component">
      <div className="p-4 border rounded bg-red-50">
        <h3 className="text-lg font-bold mb-2">Slow Component</h3>
        <p className="text-sm mb-2">Expensive calculation result: {expensiveValue.toFixed(2)}</p>
        <p className="text-xs mb-2">Health Grade: {health.grade} (Score: {health.score}/100)</p>
        <p className="text-xs mb-3">Renders: {data.length} items processed</p>

        <button
          onClick={handleClick}
          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 mr-2"
        >
          Trigger Slow Operation
        </button>

        <div className="mt-2 text-xs">
          {health.issues.length > 0 && (
            <div className="text-red-600">
              Issues: {health.issues.slice(0, 2).join(', ')}
            </div>
          )}
        </div>
      </div>
    </ProfilerWrapper>
  );
};

/**
 * Component with memory leak for testing
 */
const MemoryLeakComponent: React.FC<{ active?: boolean }> = ({ active = false }) => {
  const { ProfilerWrapper } = useReactProfiler({
    componentName: 'MemoryLeakComponent',
    trackMemory: true,
    enableLogging: true
  });

  const { memoryMetrics, hasMemoryLeak } = useMemoryTracking('MemoryLeakComponent');
  const [leakedObjects, setLeakedObjects] = useState<any[]>([]);

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;

    if (active) {
      // Intentionally create memory leak
      interval = setInterval(() => {
        const bigArray = new Array(100000).fill(Math.random());
        setLeakedObjects(prev => [...prev, bigArray]); // Never cleared!
      }, 1000);
    }

    // Intentionally missing cleanup to create leak
    // return () => clearInterval(interval); // This should be uncommented to fix the leak
  }, [active]);

  return (
    <ProfilerWrapper id="memory-leak-component">
      <div className="p-4 border rounded bg-orange-50">
        <h3 className="text-lg font-bold mb-2">Memory Leak Component</h3>
        <p className="text-sm mb-2">
          Active: {active ? 'Yes' : 'No'} |
          Objects: {leakedObjects.length} |
          Memory Leak: {hasMemoryLeak ? 'DETECTED' : 'None'}
        </p>
        <p className="text-xs">
          Current Memory: {memoryMetrics[0] ?
            `${(memoryMetrics[0].usedJSMemory / 1024 / 1024).toFixed(2)}MB` :
            'Unknown'
          }
        </p>
      </div>
    </ProfilerWrapper>
  );
};

/**
 * Component with excessive re-renders
 */
const ExcessiveRerenderComponent: React.FC<{ triggerRerenders?: boolean }> = ({
  triggerRerenders = false
}) => {
  const { ProfilerWrapper } = useReactProfiler({
    componentName: 'ExcessiveRerenderComponent',
    enableLogging: true
  });

  const [counter, setCounter] = useState(0);
  const [randomValue, setRandomValue] = useState(0);

  // Intentionally create excessive re-renders
  useEffect(() => {
    if (triggerRerenders) {
      const interval = setInterval(() => {
        setCounter(prev => prev + 1);
        setRandomValue(Math.random());
      }, 100); // Very frequent updates

      return () => clearInterval(interval);
    }
  }, [triggerRerenders]);

  // Intentionally recreate objects on every render (bad practice)
  const badObject = { value: randomValue, timestamp: Date.now() };
  const badArray = [1, 2, 3, randomValue];

  return (
    <ProfilerWrapper id="excessive-rerender-component">
      <div className="p-4 border rounded bg-yellow-50">
        <h3 className="text-lg font-bold mb-2">Excessive Re-render Component</h3>
        <p className="text-sm mb-2">Counter: {counter}</p>
        <p className="text-xs mb-2">Random: {randomValue.toFixed(4)}</p>
        <p className="text-xs">Object hash: {JSON.stringify(badObject).slice(0, 50)}...</p>
        <p className="text-xs">Array: [{badArray.slice(0, 3).join(', ')}...]</p>
      </div>
    </ProfilerWrapper>
  );
};

/**
 * Well-optimized component for comparison
 */
const OptimizedComponent = React.memo<{ data?: string[]; onAction?: () => void }>(({
  data = [],
  onAction
}) => {
  const { ProfilerWrapper } = useReactProfiler({
    componentName: 'OptimizedComponent',
    enableLogging: true
  });

  const health = useComponentHealth('OptimizedComponent');
  const { trackClick } = useInteractionTracking('OptimizedComponent');

  // Proper memoization
  const processedData = useMemo(() => {
    return data.map(item => item.toUpperCase()).slice(0, 10);
  }, [data]);

  // Stable callback
  const handleClick = useCallback((event: React.MouseEvent) => {
    trackClick(event);
    onAction?.();
  }, [trackClick, onAction]);

  return (
    <ProfilerWrapper id="optimized-component">
      <div className="p-4 border rounded bg-green-50">
        <h3 className="text-lg font-bold mb-2">Optimized Component</h3>
        <p className="text-sm mb-2">Health Grade: {health.grade} (Score: {health.score}/100)</p>
        <p className="text-xs mb-2">Processed items: {processedData.length}</p>
        <p className="text-xs mb-3">Data: {processedData.slice(0, 3).join(', ')}</p>

        <button
          onClick={handleClick}
          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Optimized Action
        </button>

        {health.recommendations.length > 0 && (
          <div className="mt-2 text-xs text-green-600">
            💡 {health.recommendations[0]}
          </div>
        )}
      </div>
    </ProfilerWrapper>
  );
});

OptimizedComponent.displayName = 'OptimizedComponent';

// =========================
// MAIN EXAMPLE COMPONENT
// =========================

export const PerformanceMonitoringExample: React.FC = () => {
  const [activeScenario, setActiveScenario] = useState<string>('none');
  const [testData, setTestData] = useState<any[]>([]);
  const [bottlenecks, setBottlenecks] = useState<BottleneckIdentification[]>([]);
  const { store } = usePerformanceStore();

  // Generate test data periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setTestData(prev => [...prev.slice(-20), { id: Date.now(), value: Math.random() }]);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Run bottleneck analysis periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const detectedBottlenecks = bottleneckAnalyzer.analyzeStore(store);
      setBottlenecks(detectedBottlenecks);
    }, 5000);

    return () => clearInterval(interval);
  }, [store]);

  const scenarios = [
    { id: 'none', label: 'None (Baseline)', description: 'Normal performance' },
    { id: 'slow', label: 'Slow Renders', description: 'Components with >16ms render times' },
    { id: 'memory', label: 'Memory Leak', description: 'Continuously growing memory usage' },
    { id: 'excessive', label: 'Excessive Re-renders', description: 'High frequency component updates' },
    { id: 'all', label: 'All Issues', description: 'Simulate multiple performance problems' }
  ];

  const handleExportReport = useCallback(() => {
    const report = {
      timestamp: new Date().toISOString(),
      store,
      bottlenecks,
      scenarios: {
        active: activeScenario,
        testData: testData.length
      }
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `performance-analysis-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [store, bottlenecks, activeScenario, testData]);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">⚡ React Performance Monitoring Example</h1>
          <p className="text-gray-600 mb-4">
            Comprehensive example demonstrating React DevTools Profiler API integration
            with real-time performance monitoring, bottleneck detection, and optimization recommendations.
          </p>

          {/* Controls */}
          <div className="bg-white p-4 rounded-lg shadow mb-6">
            <h3 className="font-medium mb-3">Test Scenarios</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {scenarios.map(scenario => (
                <button
                  key={scenario.id}
                  onClick={() => setActiveScenario(scenario.id)}
                  className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                    activeScenario === scenario.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  title={scenario.description}
                >
                  {scenario.label}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Current scenario: <strong>{scenarios.find(s => s.id === activeScenario)?.label}</strong>
                {' | '}
                Test data points: <strong>{testData.length}</strong>
                {' | '}
                Detected bottlenecks: <strong>{bottlenecks.length}</strong>
              </div>

              <button
                onClick={handleExportReport}
                className="px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700"
              >
                📊 Export Report
              </button>
            </div>
          </div>
        </div>

        {/* Performance Alerts */}
        <PerformanceAlerts
          enableDesktopNotifications={false}
          position="top-right"
          maxAlerts={10}
        />

        {/* Performance Dashboard */}
        <div className="mb-8">
          <PerformanceDashboard
            title="Real-time Performance Dashboard"
            showDetails={true}
            realTime={true}
            updateInterval={1000}
            enableExport={true}
          />
        </div>

        {/* Test Components */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 mb-8">
          {(activeScenario === 'slow' || activeScenario === 'all') && (
            <SlowComponent
              intensity={2000000}
              data={testData}
            />
          )}

          {(activeScenario === 'memory' || activeScenario === 'all') && (
            <MemoryLeakComponent
              active={true}
            />
          )}

          {(activeScenario === 'excessive' || activeScenario === 'all') && (
            <ExcessiveRerenderComponent
              triggerRerenders={true}
            />
          )}

          <OptimizedComponent
            data={testData.map(d => d.value?.toString() || '')}
            onAction={() => console.log('Optimized action triggered')}
          />
        </div>

        {/* Bottleneck Analysis */}
        {bottlenecks.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-bold mb-4">🔍 Detected Performance Bottlenecks</h3>

            <div className="space-y-4">
              {bottlenecks.slice(0, 5).map(bottleneck => (
                <div key={bottleneck.id} className="border-l-4 border-red-500 bg-red-50 p-4 rounded">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium text-lg">{bottleneck.description}</h4>
                      <p className="text-sm text-gray-600">
                        Component: <strong>{bottleneck.componentName}</strong> |
                        Severity: <strong className={`${
                          bottleneck.severity === 'critical' ? 'text-red-600' :
                          bottleneck.severity === 'high' ? 'text-orange-600' :
                          bottleneck.severity === 'medium' ? 'text-yellow-600' :
                          'text-blue-600'
                        }`}>
                          {bottleneck.severity.toUpperCase()}
                        </strong> |
                        Confidence: <strong>{bottleneck.confidence}%</strong>
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">Impact Score</div>
                      <div className="text-2xl font-bold">{bottleneck.impactScore}/100</div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <h5 className="font-medium text-sm mb-1">Root Cause:</h5>
                    <p className="text-sm">{bottleneck.rootCause.primary}</p>
                    <p className="text-xs text-gray-600 mt-1">{bottleneck.rootCause.technicalExplanation}</p>
                  </div>

                  <div className="mb-3">
                    <h5 className="font-medium text-sm mb-1">Evidence:</h5>
                    <ul className="text-xs space-y-1">
                      {bottleneck.evidence.slice(0, 3).map((evidence, index) => (
                        <li key={index} className="flex justify-between">
                          <span>{evidence.description}</span>
                          <span className="font-mono">{evidence.value}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h5 className="font-medium text-sm mb-1">Top Recommendation:</h5>
                    <div className="text-sm bg-white p-2 rounded border">
                      <strong>{bottleneck.recommendations[0]?.action}</strong>
                      <br />
                      <span className="text-xs text-gray-600">
                        {bottleneck.recommendations[0]?.implementation}
                        {' '}
                        (Estimated impact: {bottleneck.recommendations[0]?.estimatedImpact}%)
                      </span>
                    </div>
                  </div>

                  {bottleneck.trends.isGettingWorse && (
                    <div className="mt-2 text-xs text-red-600 bg-red-100 p-2 rounded">
                      ⚠️ This bottleneck is getting worse over time
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Usage Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-8">
          <h3 className="text-lg font-bold mb-3">📚 How to Use This Performance Monitoring System</h3>

          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-medium">1. Integration</h4>
              <p>Wrap components with the ProfilerWrapper from useReactProfiler hook:</p>
              <code className="block bg-gray-800 text-white p-2 rounded mt-1 text-xs">
                {`const { ProfilerWrapper } = useReactProfiler({ componentName: 'MyComponent' });`}
              </code>
            </div>

            <div>
              <h4 className="font-medium">2. Real-time Monitoring</h4>
              <p>Add the PerformanceDashboard component to see live performance metrics and alerts.</p>
            </div>

            <div>
              <h4 className="font-medium">3. Bottleneck Analysis</h4>
              <p>Use bottleneckAnalyzer.analyzeStore() to identify performance issues automatically.</p>
            </div>

            <div>
              <h4 className="font-medium">4. Optimization</h4>
              <p>Follow the recommendations provided by the system to optimize your components.</p>
            </div>

            <div>
              <h4 className="font-medium">5. Testing Scenarios</h4>
              <p>Use the scenario buttons above to simulate different performance problems and see how the system detects and reports them.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceMonitoringExample;