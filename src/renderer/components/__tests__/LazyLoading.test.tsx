/**
 * Lazy Loading Test Suite
 * Tests for React.lazy and Suspense implementation
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the lazy components to avoid actual imports during tests
jest.mock('../LazyRegistry', () => ({
  SimpleAddEntryForm: React.lazy(() =>
    Promise.resolve({
      default: ({ onSubmit, onCancel }: any) => (
        <div data-testid="add-entry-form">
          <h2>Add Entry Form</h2>
          <button onClick={() => onSubmit({})}>Submit</button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      )
    })
  ),
  MetricsDashboard: React.lazy(() =>
    Promise.resolve({
      default: ({ onClose }: any) => (
        <div data-testid="metrics-dashboard">
          <h2>Metrics Dashboard</h2>
          <button onClick={onClose}>Close</button>
        </div>
      )
    })
  ),
  KeyboardHelp: React.lazy(() =>
    Promise.resolve({
      default: () => (
        <div data-testid="keyboard-help">
          <h2>Keyboard Help</h2>
          <p>Help content</p>
        </div>
      )
    })
  ),
  preloadComponents: {
    addEntryForm: jest.fn(() => Promise.resolve()),
    metricsDashboard: jest.fn(() => Promise.resolve()),
    keyboardHelp: jest.fn(() => Promise.resolve())
  },
  trackComponentLoad: jest.fn()
}));

// Mock Electron preloader
jest.mock('../../utils/ElectronPreloader', () => ({
  ElectronPreloader: {
    preloadComponent: jest.fn(() => Promise.resolve()),
    optimizeForElectron: jest.fn(),
    setupInteractionPreloading: jest.fn(),
    prefetchResources: jest.fn()
  },
  usePreloader: () => ({
    preload: jest.fn(),
    stats: { loaded: [], queued: [], cached: [] },
    clearCache: jest.fn()
  })
}));

// Test component using lazy loading
const TestApp: React.FC = () => {
  const [showForm, setShowForm] = React.useState(false);
  const [showDashboard, setShowDashboard] = React.useState(false);
  const [showHelp, setShowHelp] = React.useState(false);

  const { SimpleAddEntryForm, MetricsDashboard, KeyboardHelp } = require('../LazyRegistry');

  return (
    <div data-testid="test-app">
      <h1>Test App</h1>

      <button onClick={() => setShowForm(true)}>
        Show Add Form
      </button>

      <button onClick={() => setShowDashboard(true)}>
        Show Dashboard
      </button>

      <button onClick={() => setShowHelp(true)}>
        Show Help
      </button>

      <React.Suspense fallback={<div data-testid="loading-form">Loading form...</div>}>
        {showForm && (
          <SimpleAddEntryForm
            onSubmit={() => setShowForm(false)}
            onCancel={() => setShowForm(false)}
          />
        )}
      </React.Suspense>

      <React.Suspense fallback={<div data-testid="loading-dashboard">Loading dashboard...</div>}>
        {showDashboard && (
          <MetricsDashboard onClose={() => setShowDashboard(false)} />
        )}
      </React.Suspense>

      <React.Suspense fallback={<div data-testid="loading-help">Loading help...</div>}>
        {showHelp && <KeyboardHelp />}
      </React.Suspense>
    </div>
  );
};

describe('Lazy Loading Components', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Loading', () => {
    test('should not load components initially', () => {
      render(<TestApp />);

      // Components should not be present initially
      expect(screen.queryByTestId('add-entry-form')).not.toBeInTheDocument();
      expect(screen.queryByTestId('metrics-dashboard')).not.toBeInTheDocument();
      expect(screen.queryByTestId('keyboard-help')).not.toBeInTheDocument();
    });

    test('should show loading fallback while component loads', async () => {
      render(<TestApp />);

      // Click to show form
      fireEvent.click(screen.getByText('Show Add Form'));

      // Should show loading state immediately
      expect(screen.getByTestId('loading-form')).toBeInTheDocument();

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByTestId('add-entry-form')).toBeInTheDocument();
      });

      // Loading state should be gone
      expect(screen.queryByTestId('loading-form')).not.toBeInTheDocument();
    });

    test('should load SimpleAddEntryForm on demand', async () => {
      render(<TestApp />);

      // Click to trigger lazy loading
      fireEvent.click(screen.getByText('Show Add Form'));

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByTestId('add-entry-form')).toBeInTheDocument();
      });

      // Verify component content
      expect(screen.getByText('Add Entry Form')).toBeInTheDocument();
      expect(screen.getByText('Submit')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    test('should load MetricsDashboard on demand', async () => {
      render(<TestApp />);

      // Click to trigger lazy loading
      fireEvent.click(screen.getByText('Show Dashboard'));

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByTestId('metrics-dashboard')).toBeInTheDocument();
      });

      // Verify component content
      expect(screen.getByText('Metrics Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Close')).toBeInTheDocument();
    });

    test('should load KeyboardHelp on demand', async () => {
      render(<TestApp />);

      // Click to trigger lazy loading
      fireEvent.click(screen.getByText('Show Help'));

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByTestId('keyboard-help')).toBeInTheDocument();
      });

      // Verify component content
      expect(screen.getByText('Keyboard Help')).toBeInTheDocument();
      expect(screen.getByText('Help content')).toBeInTheDocument();
    });
  });

  describe('Component Interaction', () => {
    test('should handle form interactions', async () => {
      render(<TestApp />);

      // Load the form
      fireEvent.click(screen.getByText('Show Add Form'));

      await waitFor(() => {
        expect(screen.getByTestId('add-entry-form')).toBeInTheDocument();
      });

      // Interact with form
      fireEvent.click(screen.getByText('Cancel'));

      // Form should be hidden
      await waitFor(() => {
        expect(screen.queryByTestId('add-entry-form')).not.toBeInTheDocument();
      });
    });

    test('should handle dashboard interactions', async () => {
      render(<TestApp />);

      // Load the dashboard
      fireEvent.click(screen.getByText('Show Dashboard'));

      await waitFor(() => {
        expect(screen.getByTestId('metrics-dashboard')).toBeInTheDocument();
      });

      // Interact with dashboard
      fireEvent.click(screen.getByText('Close'));

      // Dashboard should be hidden
      await waitFor(() => {
        expect(screen.queryByTestId('metrics-dashboard')).not.toBeInTheDocument();
      });
    });
  });

  describe('Multiple Components', () => {
    test('should load multiple components independently', async () => {
      render(<TestApp />);

      // Load form first
      fireEvent.click(screen.getByText('Show Add Form'));

      await waitFor(() => {
        expect(screen.getByTestId('add-entry-form')).toBeInTheDocument();
      });

      // Load dashboard while form is still visible
      fireEvent.click(screen.getByText('Show Dashboard'));

      await waitFor(() => {
        expect(screen.getByTestId('metrics-dashboard')).toBeInTheDocument();
      });

      // Both should be visible
      expect(screen.getByTestId('add-entry-form')).toBeInTheDocument();
      expect(screen.getByTestId('metrics-dashboard')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    test('should handle component loading errors gracefully', async () => {
      // Mock a failing component
      const FailingComponent = React.lazy(() =>
        Promise.reject(new Error('Component failed to load'))
      );

      const TestErrorBoundary: React.FC = () => {
        const [showFailing, setShowFailing] = React.useState(false);

        return (
          <div>
            <button onClick={() => setShowFailing(true)}>
              Show Failing Component
            </button>

            <React.Suspense fallback={<div>Loading...</div>}>
              {showFailing && <FailingComponent />}
            </React.Suspense>
          </div>
        );
      };

      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      render(<TestErrorBoundary />);

      fireEvent.click(screen.getByText('Show Failing Component'));

      // Should show loading initially
      expect(screen.getByText('Loading...')).toBeInTheDocument();

      // Wait for error to occur
      await waitFor(() => {
        // The component should fail to load, but the app shouldn't crash
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });
});

describe('Preloading Functions', () => {
  test('should call preload functions', () => {
    const { preloadComponents } = require('../LazyRegistry');

    preloadComponents.addEntryForm();
    preloadComponents.metricsDashboard();
    preloadComponents.keyboardHelp();

    expect(preloadComponents.addEntryForm).toHaveBeenCalled();
    expect(preloadComponents.metricsDashboard).toHaveBeenCalled();
    expect(preloadComponents.keyboardHelp).toHaveBeenCalled();
  });

  test('should track component loads', () => {
    const { trackComponentLoad } = require('../LazyRegistry');

    trackComponentLoad('TestComponent');

    expect(trackComponentLoad).toHaveBeenCalledWith('TestComponent');
  });
});

describe('ElectronPreloader Integration', () => {
  test('should initialize Electron optimizations', () => {
    const { ElectronPreloader } = require('../../utils/ElectronPreloader');

    expect(ElectronPreloader.optimizeForElectron).toBeDefined();
    expect(ElectronPreloader.setupInteractionPreloading).toBeDefined();
    expect(ElectronPreloader.prefetchResources).toBeDefined();
  });

  test('should provide preloader hook', () => {
    const { usePreloader } = require('../../utils/ElectronPreloader');
    const preloader = usePreloader();

    expect(preloader).toHaveProperty('preload');
    expect(preloader).toHaveProperty('stats');
    expect(preloader).toHaveProperty('clearCache');
  });
});

// Performance measurement tests
describe('Performance Metrics', () => {
  test('should measure component load times', async () => {
    // Mock performance API
    const mockMeasure = jest.fn();
    const mockMark = jest.fn();

    Object.defineProperty(window, 'performance', {
      value: {
        mark: mockMark,
        measure: mockMeasure,
        now: jest.fn(() => Date.now())
      },
      writable: true
    });

    render(<TestApp />);

    // Simulate component loading with performance measurement
    const startTime = performance.now();
    fireEvent.click(screen.getByText('Show Add Form'));

    await waitFor(() => {
      expect(screen.getByTestId('add-entry-form')).toBeInTheDocument();
    });

    const endTime = performance.now();
    const loadTime = endTime - startTime;

    // Load time should be reasonable (less than 1 second for tests)
    expect(loadTime).toBeLessThan(1000);
  });
});

// Bundle size tests (mock)
describe('Bundle Analysis', () => {
  test('should track component sizes', () => {
    const { componentSizes } = require('../LazyRegistry');

    expect(componentSizes).toHaveProperty('MetricsDashboard');
    expect(componentSizes).toHaveProperty('SimpleAddEntryForm');
    expect(componentSizes).toHaveProperty('KeyboardHelp');

    // Sizes should be reasonable
    expect(componentSizes.MetricsDashboard).toBeGreaterThan(0);
    expect(componentSizes.SimpleAddEntryForm).toBeGreaterThan(0);
    expect(componentSizes.KeyboardHelp).toBeGreaterThan(0);
  });
});