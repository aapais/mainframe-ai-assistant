/**
 * Unit Tests for useScrollPosition Hook
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useScrollPosition } from '../../../src/renderer/hooks/useScrollPosition';

// Mock sessionStorage
const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

// Mock window methods
const mockScrollTo = jest.fn();
const mockAddEventListener = jest.fn();
const mockRemoveEventListener = jest.fn();

// Setup mocks
beforeAll(() => {
  Object.defineProperty(window, 'sessionStorage', {
    value: mockSessionStorage,
    writable: true,
  });

  Object.defineProperty(window, 'scrollTo', {
    value: mockScrollTo,
    writable: true,
  });

  Object.defineProperty(window, 'addEventListener', {
    value: mockAddEventListener,
    writable: true,
  });

  Object.defineProperty(window, 'removeEventListener', {
    value: mockRemoveEventListener,
    writable: true,
  });

  Object.defineProperty(window, 'scrollY', {
    value: 0,
    writable: true,
  });

  Object.defineProperty(window, 'scrollX', {
    value: 0,
    writable: true,
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  (window as any).scrollY = 0;
  (window as any).scrollX = 0;
});

describe('useScrollPosition', () => {
  test('should initialize with default options', () => {
    const { result } = renderHook(() =>
      useScrollPosition({ key: 'test' })
    );

    expect(result.current.containerRef).toBeDefined();
    expect(result.current.restoreScrollPosition).toBeInstanceOf(Function);
    expect(result.current.clearScrollPosition).toBeInstanceOf(Function);
    expect(result.current.saveScrollPosition).toBeInstanceOf(Function);
  });

  test('should add scroll event listener on mount', () => {
    renderHook(() =>
      useScrollPosition({ key: 'test' })
    );

    expect(mockAddEventListener).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function),
      { passive: true }
    );
  });

  test('should remove scroll event listener on unmount', () => {
    const { unmount } = renderHook(() =>
      useScrollPosition({ key: 'test' })
    );

    unmount();

    expect(mockRemoveEventListener).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function)
    );
  });

  test('should save scroll position to sessionStorage', async () => {
    const { result } = renderHook(() =>
      useScrollPosition({ key: 'test', debounceDelay: 0 })
    );

    await act(async () => {
      result.current.saveScrollPosition({ top: 100, left: 50 });
    });

    expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
      'scroll_position_test',
      JSON.stringify({ top: 100, left: 50 })
    );
  });

  test('should restore scroll position from sessionStorage', () => {
    mockSessionStorage.getItem.mockReturnValue(
      JSON.stringify({ top: 200, left: 100 })
    );

    const { result } = renderHook(() =>
      useScrollPosition({ key: 'test', restoreDelay: 0 })
    );

    act(() => {
      result.current.restoreScrollPosition();
    });

    // Should call scrollTo after restoreDelay
    setTimeout(() => {
      expect(mockScrollTo).toHaveBeenCalledWith({
        top: 200,
        left: 100,
        behavior: 'auto'
      });
    }, 10);
  });

  test('should clear scroll position from sessionStorage', () => {
    const { result } = renderHook(() =>
      useScrollPosition({ key: 'test' })
    );

    act(() => {
      result.current.clearScrollPosition();
    });

    expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(
      'scroll_position_test'
    );
  });

  test('should handle sessionStorage errors gracefully', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    mockSessionStorage.setItem.mockImplementation(() => {
      throw new Error('Storage quota exceeded');
    });

    const { result } = renderHook(() =>
      useScrollPosition({ key: 'test' })
    );

    act(() => {
      result.current.saveScrollPosition({ top: 100, left: 0 });
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to save scroll position:',
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  test('should not save scroll position when disabled', () => {
    const { result } = renderHook(() =>
      useScrollPosition({ key: 'test', enabled: false })
    );

    act(() => {
      result.current.saveScrollPosition({ top: 100, left: 0 });
    });

    expect(mockSessionStorage.setItem).not.toHaveBeenCalled();
  });

  test('should not restore scroll position when disabled', () => {
    const { result } = renderHook(() =>
      useScrollPosition({ key: 'test', enabled: false })
    );

    act(() => {
      result.current.restoreScrollPosition();
    });

    expect(mockScrollTo).not.toHaveBeenCalled();
  });

  test('should handle custom element scroll', () => {
    const mockElement = {
      scrollTop: 100,
      scrollLeft: 50,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };

    const { result } = renderHook(() =>
      useScrollPosition({ key: 'test' })
    );

    // Set custom element
    act(() => {
      if (result.current.containerRef) {
        result.current.containerRef.current = mockElement as any;
      }
    });

    expect(mockElement.addEventListener).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function),
      { passive: true }
    );
  });

  test('should debounce scroll position saving', async () => {
    jest.useFakeTimers();

    const { result } = renderHook(() =>
      useScrollPosition({ key: 'test', debounceDelay: 100 })
    );

    // Simulate multiple rapid scroll events
    const scrollHandler = mockAddEventListener.mock.calls[0][1];

    act(() => {
      scrollHandler();
      scrollHandler();
      scrollHandler();
    });

    // Should not save immediately
    expect(mockSessionStorage.setItem).not.toHaveBeenCalled();

    // Fast-forward past debounce delay
    act(() => {
      jest.advanceTimersByTime(100);
    });

    // Now should save
    expect(mockSessionStorage.setItem).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  test('should save position on unmount', () => {
    (window as any).scrollY = 300;
    (window as any).scrollX = 150;

    const { unmount } = renderHook(() =>
      useScrollPosition({ key: 'test' })
    );

    unmount();

    expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
      'scroll_position_test',
      JSON.stringify({ top: 300, left: 150 })
    );
  });

  test('should handle malformed data in sessionStorage', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    mockSessionStorage.getItem.mockReturnValue('invalid json');

    const { result } = renderHook(() =>
      useScrollPosition({ key: 'test' })
    );

    act(() => {
      result.current.restoreScrollPosition();
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to load scroll position:',
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  test('should not interfere with scroll during restoration', async () => {
    jest.useFakeTimers();

    const { result } = renderHook(() =>
      useScrollPosition({ key: 'test', debounceDelay: 100 })
    );

    // Simulate scroll during restoration
    const scrollHandler = mockAddEventListener.mock.calls[0][1];

    act(() => {
      result.current.restoreScrollPosition();
      // This scroll should be ignored during restoration
      scrollHandler();
    });

    act(() => {
      jest.advanceTimersByTime(150); // Past restoration delay
    });

    // Should not have saved the scroll that happened during restoration
    expect(mockSessionStorage.setItem).not.toHaveBeenCalled();

    jest.useRealTimers();
  });
});