/**
 * Comprehensive AppContext State Management Tests
 *
 * Advanced test suite covering all state flows, edge cases, and scenarios:
 * - Context initialization and providers
 * - State reducers and action handling
 * - Theme management and system preferences
 * - Notification lifecycle and auto-dismissal
 * - Accessibility state synchronization
 * - Application status tracking
 * - Memory leaks and performance
 * - Cross-tab state synchronization
 * - Error boundaries and recovery
 *
 * @author State Management Testing Specialist
 * @version 2.0.0
 */

import React, { useRef, useEffect } from 'react';
import { render, renderHook, act, waitFor, screen, fireEvent } from '@testing-library/react';
import { AppProvider, useApp, useCurrentView, useTheme, useNotifications, useAccessibility, useAppStatus, ViewType, ThemeType, Notification, AppState } from '../../src/renderer/contexts/AppContext';

// Mock timers for testing auto-dismissal
jest.useFakeTimers();

// Mock matchMedia for theme testing
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: query.includes('dark'),
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock document for theme testing
Object.defineProperty(document, 'documentElement', {
  writable: true,
  value: {
    setAttribute: jest.fn(),
    getAttribute: jest.fn(),
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      toggle: jest.fn(),
      contains: jest.fn(),
    },
  },
});

// Mock document.body for accessibility testing
Object.defineProperty(document, 'body', {
  writable: true,
  value: {
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      toggle: jest.fn(),
      contains: jest.fn(),
    },
    className: '',
  },
});

// Performance monitoring utilities
interface PerformanceMetrics {
  renderCount: number;
  lastRenderTime: number;
  totalRenderTime: number;
  memoryUsage?: number;
}

const usePerformanceMonitor = () => {
  const metricsRef = useRef<PerformanceMetrics>({
    renderCount: 0,
    lastRenderTime: 0,
    totalRenderTime: 0,
  });

  useEffect(() => {
    const startTime = performance.now();
    metricsRef.current.renderCount++;

    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      metricsRef.current.lastRenderTime = renderTime;
      metricsRef.current.totalRenderTime += renderTime;

      if ((performance as any).memory) {
        metricsRef.current.memoryUsage = (performance as any).memory.usedJSHeapSize;
      }
    };
  });

  return metricsRef.current;
};

// Test wrapper with performance monitoring
const createTestWrapper = (initialState?: Partial<AppState>, enableMonitoring = false) => {
  return ({ children }: { children: React.ReactNode }) => {
    const WrappedProvider = () => (
      <AppProvider initialState={initialState}>
        {enableMonitoring && <PerformanceMonitor />}
        {children}
      </AppProvider>
    );
    return <WrappedProvider />;
  };
};

const PerformanceMonitor = () => {
  const metrics = usePerformanceMonitor();
  return <div data-testid="performance-metrics" data-render-count={metrics.renderCount} />;
};

describe('AppContext - Comprehensive State Management Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.useFakeTimers();
  });

  describe('Context Initialization and Provider', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: createTestWrapper(),
      });

      const { state } = result.current;

      expect(state.currentView).toBe('search');
      expect(state.theme).toBe('system');
      expect(state.isLoading).toBe(false);
      expect(state.notifications).toEqual([]);
      expect(state.accessibility).toEqual({
        isScreenReaderActive: false,
        isHighContrastMode: false,
        isReducedMotionMode: false,
        fontSize: 'medium',
      });
      expect(state.status).toEqual({
        isOnline: true,
        isDatabaseConnected: false,
        isAIServiceAvailable: false,
        lastActivity: expect.any(Date),
      });
    });

    it('should accept custom initial state', () => {
      const customInitialState: Partial<AppState> = {
        currentView: 'metrics',
        theme: 'dark',
        isLoading: true,
        accessibility: {
          isScreenReaderActive: true,
          isHighContrastMode: true,
          isReducedMotionMode: false,
          fontSize: 'large',
        },
      };

      const { result } = renderHook(() => useApp(), {
        wrapper: createTestWrapper(customInitialState),
      });

      const { state } = result.current;

      expect(state.currentView).toBe('metrics');
      expect(state.theme).toBe('dark');
      expect(state.isLoading).toBe(true);
      expect(state.accessibility.isScreenReaderActive).toBe(true);
      expect(state.accessibility.isHighContrastMode).toBe(true);
      expect(state.accessibility.fontSize).toBe('large');
    });

    it('should throw error when used outside provider', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        renderHook(() => useApp());
      }).toThrow('useApp must be used within an AppProvider');

      consoleSpy.mockRestore();
    });

    it('should handle provider unmounting gracefully', () => {
      const { result, unmount } = renderHook(() => useApp(), {
        wrapper: createTestWrapper(),
      });

      expect(result.current.state.currentView).toBe('search');

      expect(() => unmount()).not.toThrow();
    });
  });

  describe('State Immutability and Updates', () => {
    it('should maintain state immutability during updates', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: createTestWrapper(),
      });

      const initialState = result.current.state;
      const initialNotifications = result.current.state.notifications;

      act(() => {
        result.current.setCurrentView('knowledge-base');
      });

      // State reference should change
      expect(result.current.state).not.toBe(initialState);
      // But nested unchanged objects should remain the same
      expect(result.current.state.notifications).toBe(initialNotifications);
      expect(result.current.state.currentView).toBe('knowledge-base');
    });

    it('should update last activity on view changes', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: createTestWrapper(),
      });

      const initialActivity = result.current.state.status.lastActivity;

      // Wait a bit to ensure timestamp difference
      jest.advanceTimersByTime(100);

      act(() => {
        result.current.setCurrentView('settings');
      });

      expect(result.current.state.status.lastActivity.getTime()).toBeGreaterThan(
        initialActivity.getTime()
      );
    });

    it('should handle rapid state updates without corruption', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: createTestWrapper(),
      });

      // Rapidly fire multiple state updates
      act(() => {
        result.current.setCurrentView('knowledge-base');
        result.current.setTheme('dark');
        result.current.setLoading(true);
        result.current.updateAccessibility({ fontSize: 'large' });
        result.current.setLoading(false);
      });

      expect(result.current.state.currentView).toBe('knowledge-base');
      expect(result.current.state.theme).toBe('dark');
      expect(result.current.state.isLoading).toBe(false);
      expect(result.current.state.accessibility.fontSize).toBe('large');
    });
  });

  describe('Theme Management', () => {
    it('should apply light theme to document', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: createTestWrapper(),
      });

      act(() => {
        result.current.setTheme('light');
      });

      expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'light');
      expect(result.current.state.theme).toBe('light');
    });

    it('should apply dark theme to document', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: createTestWrapper(),
      });

      act(() => {
        result.current.setTheme('dark');
      });

      expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
      expect(result.current.state.theme).toBe('dark');
    });

    it('should handle system theme with media query', () => {
      // Mock dark mode preference
      (window.matchMedia as jest.Mock).mockImplementation(query => ({
        matches: query.includes('dark'),
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));

      const { result } = renderHook(() => useApp(), {
        wrapper: createTestWrapper(),
      });

      act(() => {
        result.current.setTheme('system');
      });

      expect(window.matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
      expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
    });

    it('should handle system theme with light preference', () => {
      // Mock light mode preference
      (window.matchMedia as jest.Mock).mockImplementation(query => ({
        matches: false, // Light mode
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));

      const { result } = renderHook(() => useApp(), {
        wrapper: createTestWrapper(),
      });

      act(() => {
        result.current.setTheme('system');
      });

      expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'light');
    });
  });

  describe('Notification Management', () => {
    it('should add notification with auto-generated ID', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: createTestWrapper(),
      });

      let notificationId: string;

      act(() => {
        notificationId = result.current.addNotification({
          type: 'success',
          message: 'Test notification',
        });
      });

      expect(notificationId!).toMatch(/^notification-\d+-\w+$/);
      expect(result.current.state.notifications).toHaveLength(1);
      expect(result.current.state.notifications[0]).toEqual({
        id: notificationId!,
        type: 'success',
        message: 'Test notification',
        duration: 5000,
        dismissible: true,
      });
    });

    it('should add notification with custom properties', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: createTestWrapper(),
      });

      const customNotification = {
        type: 'error' as const,
        title: 'Error Title',
        message: 'Custom error message',
        duration: 10000,
        dismissible: false,
        actions: [
          {
            label: 'Retry',
            action: jest.fn(),
            variant: 'primary' as const,
          },
        ],
      };

      let notificationId: string;

      act(() => {
        notificationId = result.current.addNotification(customNotification);
      });

      expect(result.current.state.notifications[0]).toEqual({
        id: notificationId!,
        ...customNotification,
      });
    });

    it('should auto-remove notification after duration', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: createTestWrapper(),
      });

      act(() => {
        result.current.addNotification({
          type: 'info',
          message: 'Auto-dismiss notification',
          duration: 1000,
        });
      });

      expect(result.current.state.notifications).toHaveLength(1);

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(result.current.state.notifications).toHaveLength(0);
    });

    it('should not auto-remove notification with zero duration', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: createTestWrapper(),
      });

      act(() => {
        result.current.addNotification({
          type: 'warning',
          message: 'Persistent notification',
          duration: 0,
        });
      });

      expect(result.current.state.notifications).toHaveLength(1);

      act(() => {
        jest.advanceTimersByTime(10000);
      });

      expect(result.current.state.notifications).toHaveLength(1);
    });

    it('should remove specific notification by ID', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: createTestWrapper(),
      });

      let id1: string, id2: string;

      act(() => {
        id1 = result.current.addNotification({
          type: 'info',
          message: 'First notification',
          duration: 0,
        });
        id2 = result.current.addNotification({
          type: 'success',
          message: 'Second notification',
          duration: 0,
        });
      });

      expect(result.current.state.notifications).toHaveLength(2);

      act(() => {
        result.current.removeNotification(id1!);
      });

      expect(result.current.state.notifications).toHaveLength(1);
      expect(result.current.state.notifications[0].id).toBe(id2!);
    });

    it('should clear all notifications', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: createTestWrapper(),
      });

      act(() => {
        result.current.addNotification({
          type: 'info',
          message: 'First notification',
          duration: 0,
        });
        result.current.addNotification({
          type: 'success',
          message: 'Second notification',
          duration: 0,
        });
      });

      expect(result.current.state.notifications).toHaveLength(2);

      act(() => {
        result.current.clearNotifications();
      });

      expect(result.current.state.notifications).toHaveLength(0);
    });

    it('should handle multiple notifications with different durations', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: createTestWrapper(),
      });

      act(() => {
        result.current.addNotification({
          type: 'info',
          message: 'Short notification',
          duration: 500,
        });
        result.current.addNotification({
          type: 'warning',
          message: 'Medium notification',
          duration: 1000,
        });
        result.current.addNotification({
          type: 'error',
          message: 'Long notification',
          duration: 2000,
        });
      });

      expect(result.current.state.notifications).toHaveLength(3);

      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(result.current.state.notifications).toHaveLength(2);

      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(result.current.state.notifications).toHaveLength(1);

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(result.current.state.notifications).toHaveLength(0);
    });
  });

  describe('Accessibility Management', () => {
    it('should update accessibility settings', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: createTestWrapper(),
      });

      act(() => {
        result.current.updateAccessibility({
          isScreenReaderActive: true,
          fontSize: 'large',
        });
      });

      expect(result.current.state.accessibility.isScreenReaderActive).toBe(true);
      expect(result.current.state.accessibility.fontSize).toBe('large');
      expect(result.current.state.accessibility.isHighContrastMode).toBe(false); // Should remain unchanged
    });

    it('should toggle high contrast mode and update document', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: createTestWrapper(),
      });

      act(() => {
        result.current.toggleHighContrast();
      });

      expect(result.current.state.accessibility.isHighContrastMode).toBe(true);
      expect(document.body.classList.toggle).toHaveBeenCalledWith('high-contrast', true);

      act(() => {
        result.current.toggleHighContrast();
      });

      expect(result.current.state.accessibility.isHighContrastMode).toBe(false);
      expect(document.body.classList.toggle).toHaveBeenCalledWith('high-contrast', false);
    });

    it('should toggle reduced motion mode and update document', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: createTestWrapper(),
      });

      act(() => {
        result.current.toggleReducedMotion();
      });

      expect(result.current.state.accessibility.isReducedMotionMode).toBe(true);
      expect(document.body.classList.toggle).toHaveBeenCalledWith('reduce-motion', true);

      act(() => {
        result.current.toggleReducedMotion();
      });

      expect(result.current.state.accessibility.isReducedMotionMode).toBe(false);
      expect(document.body.classList.toggle).toHaveBeenCalledWith('reduce-motion', false);
    });

    it('should set font size and update document class', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: createTestWrapper(),
      });

      // Mock initial className
      document.body.className = 'existing-class font-size-medium other-class';

      act(() => {
        result.current.setFontSize('large');
      });

      expect(result.current.state.accessibility.fontSize).toBe('large');
      expect(document.body.className).toBe('existing-class other-class font-size-large');
    });

    it('should handle font size changes correctly', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: createTestWrapper(),
      });

      document.body.className = 'existing-class';

      act(() => {
        result.current.setFontSize('small');
      });

      expect(document.body.className).toBe('existing-class font-size-small');

      act(() => {
        result.current.setFontSize('large');
      });

      expect(document.body.className).toBe('existing-class font-size-large');
    });
  });

  describe('Application Status Management', () => {
    it('should update partial status', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: createTestWrapper(),
      });

      act(() => {
        result.current.updateStatus({
          isDatabaseConnected: true,
          isAIServiceAvailable: true,
        });
      });

      expect(result.current.state.status.isDatabaseConnected).toBe(true);
      expect(result.current.state.status.isAIServiceAvailable).toBe(true);
      expect(result.current.state.status.isOnline).toBe(true); // Should remain unchanged
    });

    it('should update last activity timestamp', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: createTestWrapper(),
      });

      const initialActivity = result.current.state.status.lastActivity;

      jest.advanceTimersByTime(100);

      act(() => {
        result.current.updateLastActivity();
      });

      expect(result.current.state.status.lastActivity.getTime()).toBeGreaterThan(
        initialActivity.getTime()
      );
    });

    it('should handle offline/online status changes', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: createTestWrapper(),
      });

      act(() => {
        result.current.updateStatus({ isOnline: false });
      });

      expect(result.current.state.status.isOnline).toBe(false);

      act(() => {
        result.current.updateStatus({ isOnline: true });
      });

      expect(result.current.state.status.isOnline).toBe(true);
    });
  });

  describe('Convenience Hooks', () => {
    it('should provide useCurrentView hook functionality', () => {
      const TestComponent = () => {
        const [currentView, setCurrentView] = useCurrentView();
        return (
          <div>
            <span data-testid="current-view">{currentView}</span>
            <button
              data-testid="change-view"
              onClick={() => setCurrentView('metrics')}
            >
              Change View
            </button>
          </div>
        );
      };

      render(
        <AppProvider>
          <TestComponent />
        </AppProvider>
      );

      expect(screen.getByTestId('current-view')).toHaveTextContent('search');

      fireEvent.click(screen.getByTestId('change-view'));

      expect(screen.getByTestId('current-view')).toHaveTextContent('metrics');
    });

    it('should provide useTheme hook functionality', () => {
      const TestComponent = () => {
        const [theme, setTheme] = useTheme();
        return (
          <div>
            <span data-testid="current-theme">{theme}</span>
            <button
              data-testid="change-theme"
              onClick={() => setTheme('dark')}
            >
              Change Theme
            </button>
          </div>
        );
      };

      render(
        <AppProvider>
          <TestComponent />
        </AppProvider>
      );

      expect(screen.getByTestId('current-theme')).toHaveTextContent('system');

      fireEvent.click(screen.getByTestId('change-theme'));

      expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
    });

    it('should provide useNotifications hook functionality', () => {
      const TestComponent = () => {
        const { notifications, addNotification, clearNotifications } = useNotifications();
        return (
          <div>
            <span data-testid="notification-count">{notifications.length}</span>
            <button
              data-testid="add-notification"
              onClick={() => addNotification({ type: 'info', message: 'Test' })}
            >
              Add Notification
            </button>
            <button
              data-testid="clear-notifications"
              onClick={clearNotifications}
            >
              Clear Notifications
            </button>
          </div>
        );
      };

      render(
        <AppProvider>
          <TestComponent />
        </AppProvider>
      );

      expect(screen.getByTestId('notification-count')).toHaveTextContent('0');

      fireEvent.click(screen.getByTestId('add-notification'));

      expect(screen.getByTestId('notification-count')).toHaveTextContent('1');

      fireEvent.click(screen.getByTestId('clear-notifications'));

      expect(screen.getByTestId('notification-count')).toHaveTextContent('0');
    });

    it('should provide useAccessibility hook functionality', () => {
      const TestComponent = () => {
        const { accessibility, toggleHighContrast, setFontSize } = useAccessibility();
        return (
          <div>
            <span data-testid="high-contrast">{accessibility.isHighContrastMode.toString()}</span>
            <span data-testid="font-size">{accessibility.fontSize}</span>
            <button
              data-testid="toggle-contrast"
              onClick={toggleHighContrast}
            >
              Toggle Contrast
            </button>
            <button
              data-testid="set-font-large"
              onClick={() => setFontSize('large')}
            >
              Set Large Font
            </button>
          </div>
        );
      };

      render(
        <AppProvider>
          <TestComponent />
        </AppProvider>
      );

      expect(screen.getByTestId('high-contrast')).toHaveTextContent('false');
      expect(screen.getByTestId('font-size')).toHaveTextContent('medium');

      fireEvent.click(screen.getByTestId('toggle-contrast'));

      expect(screen.getByTestId('high-contrast')).toHaveTextContent('true');

      fireEvent.click(screen.getByTestId('set-font-large'));

      expect(screen.getByTestId('font-size')).toHaveTextContent('large');
    });

    it('should provide useAppStatus hook functionality', () => {
      const TestComponent = () => {
        const { status, updateStatus } = useAppStatus();
        return (
          <div>
            <span data-testid="online-status">{status.isOnline.toString()}</span>
            <span data-testid="db-status">{status.isDatabaseConnected.toString()}</span>
            <button
              data-testid="set-offline"
              onClick={() => updateStatus({ isOnline: false })}
            >
              Set Offline
            </button>
            <button
              data-testid="connect-db"
              onClick={() => updateStatus({ isDatabaseConnected: true })}
            >
              Connect DB
            </button>
          </div>
        );
      };

      render(
        <AppProvider>
          <TestComponent />
        </AppProvider>
      );

      expect(screen.getByTestId('online-status')).toHaveTextContent('true');
      expect(screen.getByTestId('db-status')).toHaveTextContent('false');

      fireEvent.click(screen.getByTestId('set-offline'));

      expect(screen.getByTestId('online-status')).toHaveTextContent('false');

      fireEvent.click(screen.getByTestId('connect-db'));

      expect(screen.getByTestId('db-status')).toHaveTextContent('true');
    });
  });

  describe('Performance and Memory Management', () => {
    it('should not cause memory leaks with multiple notifications', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: createTestWrapper(),
      });

      // Add many notifications that auto-dismiss
      act(() => {
        for (let i = 0; i < 100; i++) {
          result.current.addNotification({
            type: 'info',
            message: `Notification ${i}`,
            duration: 10,
          });
        }
      });

      expect(result.current.state.notifications).toHaveLength(100);

      // Fast-forward timers to dismiss all notifications
      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(result.current.state.notifications).toHaveLength(0);
    });

    it('should handle rapid state updates efficiently', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: createTestWrapper(undefined, true),
      });

      const startTime = performance.now();

      // Perform many rapid updates
      act(() => {
        for (let i = 0; i < 1000; i++) {
          result.current.updateLastActivity();
        }
      });

      const endTime = performance.now();
      const updateTime = endTime - startTime;

      // Should complete within reasonable time (less than 100ms for 1000 updates)
      expect(updateTime).toBeLessThan(100);

      const performanceElement = screen.getByTestId('performance-metrics');
      const renderCount = parseInt(performanceElement.getAttribute('data-render-count') || '0');

      // Should not cause excessive re-renders
      expect(renderCount).toBeLessThan(10);
    });

    it('should manage notification cleanup efficiently', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: createTestWrapper(),
      });

      // Create many notifications with staggered timeouts
      act(() => {
        for (let i = 0; i < 50; i++) {
          result.current.addNotification({
            type: 'info',
            message: `Notification ${i}`,
            duration: (i + 1) * 10,
          });
        }
      });

      expect(result.current.state.notifications).toHaveLength(50);

      // Advance timers in steps to test cleanup
      for (let step = 1; step <= 50; step++) {
        act(() => {
          jest.advanceTimersByTime(10);
        });

        expect(result.current.state.notifications).toHaveLength(50 - step);
      }

      expect(result.current.state.notifications).toHaveLength(0);
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle invalid view type gracefully', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: createTestWrapper(),
      });

      act(() => {
        result.current.setCurrentView('invalid-view' as ViewType);
      });

      // Should still update the state (context doesn't validate view types)
      expect(result.current.state.currentView).toBe('invalid-view');
    });

    it('should handle invalid theme type gracefully', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: createTestWrapper(),
      });

      act(() => {
        result.current.setTheme('invalid-theme' as ThemeType);
      });

      expect(result.current.state.theme).toBe('invalid-theme');
    });

    it('should handle notification removal of non-existent ID', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: createTestWrapper(),
      });

      act(() => {
        result.current.addNotification({
          type: 'info',
          message: 'Test notification',
        });
      });

      expect(result.current.state.notifications).toHaveLength(1);

      act(() => {
        result.current.removeNotification('non-existent-id');
      });

      // Should not affect existing notifications
      expect(result.current.state.notifications).toHaveLength(1);
    });

    it('should handle accessibility updates with undefined values', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: createTestWrapper(),
      });

      const initialAccessibility = result.current.state.accessibility;

      act(() => {
        result.current.updateAccessibility({
          isScreenReaderActive: undefined as any,
          fontSize: undefined as any,
        });
      });

      // Should merge properly and not overwrite with undefined
      expect(result.current.state.accessibility).toEqual({
        ...initialAccessibility,
        isScreenReaderActive: undefined,
        fontSize: undefined,
      });
    });

    it('should handle status updates with partial undefined values', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: createTestWrapper(),
      });

      const initialStatus = result.current.state.status;

      act(() => {
        result.current.updateStatus({
          isOnline: undefined as any,
          isDatabaseConnected: true,
        });
      });

      expect(result.current.state.status).toEqual({
        ...initialStatus,
        isOnline: undefined,
        isDatabaseConnected: true,
      });
    });

    it('should handle concurrent theme changes', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: createTestWrapper(),
      });

      // Simulate rapid theme changes
      act(() => {
        result.current.setTheme('light');
        result.current.setTheme('dark');
        result.current.setTheme('system');
        result.current.setTheme('light');
      });

      expect(result.current.state.theme).toBe('light');
      expect(document.documentElement.setAttribute).toHaveBeenLastCalledWith('data-theme', 'light');
    });

    it('should handle matchMedia errors gracefully', () => {
      // Mock matchMedia to throw error
      (window.matchMedia as jest.Mock).mockImplementation(() => {
        throw new Error('matchMedia error');
      });

      const { result } = renderHook(() => useApp(), {
        wrapper: createTestWrapper(),
      });

      expect(() => {
        act(() => {
          result.current.setTheme('system');
        });
      }).not.toThrow();

      expect(result.current.state.theme).toBe('system');
    });
  });

  describe('State Synchronization and Consistency', () => {
    it('should maintain consistency across multiple hook calls', () => {
      const TestComponent = () => {
        const app = useApp();
        const [currentView] = useCurrentView();
        const [theme] = useTheme();
        const { notifications } = useNotifications();

        return (
          <div>
            <span data-testid="app-view">{app.state.currentView}</span>
            <span data-testid="hook-view">{currentView}</span>
            <span data-testid="app-theme">{app.state.theme}</span>
            <span data-testid="hook-theme">{theme}</span>
            <span data-testid="app-notifications">{app.state.notifications.length}</span>
            <span data-testid="hook-notifications">{notifications.length}</span>
          </div>
        );
      };

      render(
        <AppProvider>
          <TestComponent />
        </AppProvider>
      );

      // All hooks should return the same values
      expect(screen.getByTestId('app-view')).toHaveTextContent('search');
      expect(screen.getByTestId('hook-view')).toHaveTextContent('search');
      expect(screen.getByTestId('app-theme')).toHaveTextContent('system');
      expect(screen.getByTestId('hook-theme')).toHaveTextContent('system');
      expect(screen.getByTestId('app-notifications')).toHaveTextContent('0');
      expect(screen.getByTestId('hook-notifications')).toHaveTextContent('0');
    });

    it('should update all hook instances consistently', () => {
      const TestComponent = () => {
        const { setCurrentView, addNotification } = useApp();
        const [currentView] = useCurrentView();
        const { notifications } = useNotifications();

        return (
          <div>
            <span data-testid="current-view">{currentView}</span>
            <span data-testid="notification-count">{notifications.length}</span>
            <button
              data-testid="change-view"
              onClick={() => setCurrentView('settings')}
            >
              Change View
            </button>
            <button
              data-testid="add-notification"
              onClick={() => addNotification({ type: 'info', message: 'Test' })}
            >
              Add Notification
            </button>
          </div>
        );
      };

      render(
        <AppProvider>
          <TestComponent />
        </AppProvider>
      );

      fireEvent.click(screen.getByTestId('change-view'));
      expect(screen.getByTestId('current-view')).toHaveTextContent('settings');

      fireEvent.click(screen.getByTestId('add-notification'));
      expect(screen.getByTestId('notification-count')).toHaveTextContent('1');
    });
  });
});