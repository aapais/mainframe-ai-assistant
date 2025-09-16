/**
 * Window Operation Tracker
 * Monitors window operation performance with <100ms target
 */

import { EventEmitter } from 'events';
import { BrowserWindow } from 'electron';

export interface WindowOperation {
  operation: string;
  windowId: number;
  startTime: number;
  endTime: number;
  duration: number;
  isTargetMet: boolean; // < 100ms target
  windowState: {
    width: number;
    height: number;
    x: number;
    y: number;
    isVisible: boolean;
    isMinimized: boolean;
    isMaximized: boolean;
    isFullScreen: boolean;
  };
  metadata?: Record<string, any>;
}

export interface WindowPerformanceSummary {
  totalOperations: number;
  averageDuration: number;
  targetMeetRate: number;
  slowestOperation: WindowOperation | null;
  fastestOperation: WindowOperation | null;
  operationCounts: Record<string, number>;
  operationAverages: Record<string, number>;
}

export class WindowOperationTracker extends EventEmitter {
  private operations: WindowOperation[] = [];
  private activeOperations: Map<string, Partial<WindowOperation>> = new Map();
  private targetDuration = 100; // 100ms target
  private maxHistorySize = 5000;
  private trackedWindows: Set<number> = new Set();

  constructor(targetDuration = 100) {
    super();
    this.targetDuration = targetDuration;
    this.setupWindowTracking();
  }

  /**
   * Setup automatic window tracking
   */
  private setupWindowTracking(): void {
    // Track existing windows
    BrowserWindow.getAllWindows().forEach(window => {
      this.trackWindow(window);
    });

    // Track new windows
    const originalConstructor = BrowserWindow;
    const tracker = this;

    // Override BrowserWindow constructor to automatically track new windows
    (global as any).BrowserWindow = class extends BrowserWindow {
      constructor(options?: any) {
        super(options);
        tracker.trackWindow(this);
      }
    };
  }

  /**
   * Track a specific window
   */
  public trackWindow(window: BrowserWindow): void {
    const windowId = window.id;

    if (this.trackedWindows.has(windowId)) {
      return; // Already tracking
    }

    this.trackedWindows.add(windowId);

    // Track window operations
    this.trackWindowShow(window);
    this.trackWindowHide(window);
    this.trackWindowMinimize(window);
    this.trackWindowMaximize(window);
    this.trackWindowRestore(window);
    this.trackWindowResize(window);
    this.trackWindowMove(window);
    this.trackWindowFocus(window);
    this.trackWindowBlur(window);
    this.trackWindowClose(window);

    // Track page operations
    this.trackPageLoad(window);
    this.trackPageReload(window);

    this.emit('window-tracked', windowId);
  }

  /**
   * Start tracking a window operation
   */
  public startOperation(operation: string, windowId: number, metadata?: Record<string, any>): string {
    const operationId = `${operation}-${windowId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = performance.now();

    const window = BrowserWindow.fromId(windowId);
    const windowState = window ? this.getWindowState(window) : this.getDefaultWindowState();

    const operationData: Partial<WindowOperation> = {
      operation,
      windowId,
      startTime,
      windowState,
      metadata
    };

    this.activeOperations.set(operationId, operationData);
    return operationId;
  }

  /**
   * End tracking a window operation
   */
  public endOperation(operationId: string): WindowOperation | null {
    const operationData = this.activeOperations.get(operationId);

    if (!operationData) {
      console.warn('Window operation tracking ID not found:', operationId);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - (operationData.startTime || 0);

    const operation: WindowOperation = {
      operation: operationData.operation || '',
      windowId: operationData.windowId || 0,
      startTime: operationData.startTime || 0,
      endTime,
      duration,
      isTargetMet: duration <= this.targetDuration,
      windowState: operationData.windowState || this.getDefaultWindowState(),
      metadata: operationData.metadata
    };

    this.activeOperations.delete(operationId);
    this.operations.push(operation);

    // Emit events
    this.emit('operation-completed', operation);

    if (!operation.isTargetMet) {
      this.emit('performance-violation', {
        type: 'window-operation',
        operation: operation.operation,
        windowId: operation.windowId,
        duration: operation.duration,
        target: this.targetDuration,
        message: `Window operation "${operation.operation}" took ${duration.toFixed(2)}ms, exceeding target of ${this.targetDuration}ms`
      });
    }

    // Keep history size manageable
    if (this.operations.length > this.maxHistorySize) {
      this.operations = this.operations.slice(-Math.floor(this.maxHistorySize * 0.8));
    }

    return operation;
  }

  /**
   * Track window show operation
   */
  private trackWindowShow(window: BrowserWindow): void {
    window.on('show', () => {
      const operationId = this.startOperation('show', window.id);
      setImmediate(() => {
        this.endOperation(operationId);
      });
    });
  }

  /**
   * Track window hide operation
   */
  private trackWindowHide(window: BrowserWindow): void {
    window.on('hide', () => {
      const operationId = this.startOperation('hide', window.id);
      setImmediate(() => {
        this.endOperation(operationId);
      });
    });
  }

  /**
   * Track window minimize operation
   */
  private trackWindowMinimize(window: BrowserWindow): void {
    window.on('minimize', () => {
      const operationId = this.startOperation('minimize', window.id);
      setImmediate(() => {
        this.endOperation(operationId);
      });
    });
  }

  /**
   * Track window maximize operation
   */
  private trackWindowMaximize(window: BrowserWindow): void {
    window.on('maximize', () => {
      const operationId = this.startOperation('maximize', window.id);
      setImmediate(() => {
        this.endOperation(operationId);
      });
    });
  }

  /**
   * Track window restore operation
   */
  private trackWindowRestore(window: BrowserWindow): void {
    window.on('restore', () => {
      const operationId = this.startOperation('restore', window.id);
      setImmediate(() => {
        this.endOperation(operationId);
      });
    });
  }

  /**
   * Track window resize operation
   */
  private trackWindowResize(window: BrowserWindow): void {
    let resizeOperationId: string | null = null;

    window.on('will-resize', () => {
      resizeOperationId = this.startOperation('resize', window.id);
    });

    window.on('resize', () => {
      if (resizeOperationId) {
        this.endOperation(resizeOperationId);
        resizeOperationId = null;
      }
    });
  }

  /**
   * Track window move operation
   */
  private trackWindowMove(window: BrowserWindow): void {
    let moveOperationId: string | null = null;

    window.on('will-move', () => {
      moveOperationId = this.startOperation('move', window.id);
    });

    window.on('move', () => {
      if (moveOperationId) {
        this.endOperation(moveOperationId);
        moveOperationId = null;
      }
    });
  }

  /**
   * Track window focus operation
   */
  private trackWindowFocus(window: BrowserWindow): void {
    window.on('focus', () => {
      const operationId = this.startOperation('focus', window.id);
      setImmediate(() => {
        this.endOperation(operationId);
      });
    });
  }

  /**
   * Track window blur operation
   */
  private trackWindowBlur(window: BrowserWindow): void {
    window.on('blur', () => {
      const operationId = this.startOperation('blur', window.id);
      setImmediate(() => {
        this.endOperation(operationId);
      });
    });
  }

  /**
   * Track window close operation
   */
  private trackWindowClose(window: BrowserWindow): void {
    window.on('close', () => {
      const operationId = this.startOperation('close', window.id);
      setImmediate(() => {
        this.endOperation(operationId);
        this.trackedWindows.delete(window.id);
      });
    });
  }

  /**
   * Track page load operation
   */
  private trackPageLoad(window: BrowserWindow): void {
    let loadOperationId: string | null = null;

    window.webContents.on('did-start-loading', () => {
      loadOperationId = this.startOperation('page-load', window.id);
    });

    window.webContents.on('did-finish-load', () => {
      if (loadOperationId) {
        this.endOperation(loadOperationId);
        loadOperationId = null;
      }
    });

    // Also track DOM ready
    window.webContents.on('dom-ready', () => {
      const operationId = this.startOperation('dom-ready', window.id);
      setImmediate(() => {
        this.endOperation(operationId);
      });
    });
  }

  /**
   * Track page reload operation
   */
  private trackPageReload(window: BrowserWindow): void {
    let reloadOperationId: string | null = null;

    window.webContents.on('did-start-loading', () => {
      // Check if this is a reload vs initial load
      if (window.webContents.getURL()) {
        reloadOperationId = this.startOperation('page-reload', window.id);
      }
    });

    window.webContents.on('did-finish-load', () => {
      if (reloadOperationId) {
        this.endOperation(reloadOperationId);
        reloadOperationId = null;
      }
    });
  }

  /**
   * Get window state
   */
  private getWindowState(window: BrowserWindow): WindowOperation['windowState'] {
    const bounds = window.getBounds();

    return {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isVisible: window.isVisible(),
      isMinimized: window.isMinimized(),
      isMaximized: window.isMaximized(),
      isFullScreen: window.isFullScreen()
    };
  }

  /**
   * Get default window state for when window is not available
   */
  private getDefaultWindowState(): WindowOperation['windowState'] {
    return {
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      isVisible: false,
      isMinimized: false,
      isMaximized: false,
      isFullScreen: false
    };
  }

  /**
   * Get window operations
   */
  public getOperations(count?: number): WindowOperation[] {
    if (!count) return [...this.operations];
    return this.operations.slice(-count);
  }

  /**
   * Get operations by window ID
   */
  public getOperationsByWindow(windowId: number): WindowOperation[] {
    return this.operations.filter(op => op.windowId === windowId);
  }

  /**
   * Get operations by type
   */
  public getOperationsByType(operation: string): WindowOperation[] {
    return this.operations.filter(op => op.operation === operation);
  }

  /**
   * Get slow operations (above target)
   */
  public getSlowOperations(): WindowOperation[] {
    return this.operations.filter(op => !op.isTargetMet);
  }

  /**
   * Get performance summary
   */
  public getPerformanceSummary(): WindowPerformanceSummary {
    if (this.operations.length === 0) {
      return {
        totalOperations: 0,
        averageDuration: 0,
        targetMeetRate: 0,
        slowestOperation: null,
        fastestOperation: null,
        operationCounts: {},
        operationAverages: {}
      };
    }

    const totalOperations = this.operations.length;
    const averageDuration = this.operations.reduce((sum, op) => sum + op.duration, 0) / totalOperations;
    const targetMeets = this.operations.filter(op => op.isTargetMet).length;

    const slowestOperation = this.operations.reduce((slowest, current) =>
      !slowest || current.duration > slowest.duration ? current : slowest);

    const fastestOperation = this.operations.reduce((fastest, current) =>
      !fastest || current.duration < fastest.duration ? current : fastest);

    // Calculate operation counts and averages
    const operationStats = new Map<string, { count: number; totalDuration: number }>();

    this.operations.forEach(op => {
      const existing = operationStats.get(op.operation);
      if (existing) {
        existing.count++;
        existing.totalDuration += op.duration;
      } else {
        operationStats.set(op.operation, { count: 1, totalDuration: op.duration });
      }
    });

    const operationCounts: Record<string, number> = {};
    const operationAverages: Record<string, number> = {};

    operationStats.forEach((stats, operation) => {
      operationCounts[operation] = stats.count;
      operationAverages[operation] = stats.totalDuration / stats.count;
    });

    return {
      totalOperations,
      averageDuration,
      targetMeetRate: targetMeets / totalOperations,
      slowestOperation,
      fastestOperation,
      operationCounts,
      operationAverages
    };
  }

  /**
   * Get window-specific summary
   */
  public getWindowSummary(windowId: number): {
    windowId: number;
    totalOperations: number;
    averageDuration: number;
    targetMeetRate: number;
    operationBreakdown: Record<string, { count: number; averageDuration: number }>;
  } {
    const windowOperations = this.getOperationsByWindow(windowId);

    if (windowOperations.length === 0) {
      return {
        windowId,
        totalOperations: 0,
        averageDuration: 0,
        targetMeetRate: 0,
        operationBreakdown: {}
      };
    }

    const totalOperations = windowOperations.length;
    const averageDuration = windowOperations.reduce((sum, op) => sum + op.duration, 0) / totalOperations;
    const targetMeets = windowOperations.filter(op => op.isTargetMet).length;

    const operationBreakdown: Record<string, { count: number; averageDuration: number }> = {};

    windowOperations.forEach(op => {
      if (!operationBreakdown[op.operation]) {
        operationBreakdown[op.operation] = { count: 0, averageDuration: 0 };
      }
      operationBreakdown[op.operation].count++;
    });

    Object.keys(operationBreakdown).forEach(operation => {
      const ops = windowOperations.filter(op => op.operation === operation);
      operationBreakdown[operation].averageDuration = ops.reduce((sum, op) => sum + op.duration, 0) / ops.length;
    });

    return {
      windowId,
      totalOperations,
      averageDuration,
      targetMeetRate: targetMeets / totalOperations,
      operationBreakdown
    };
  }

  /**
   * Export window operation data
   */
  public exportData(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = [
        'operation', 'windowId', 'startTime', 'endTime', 'duration',
        'isTargetMet', 'windowWidth', 'windowHeight', 'windowX', 'windowY',
        'isVisible', 'isMinimized', 'isMaximized', 'isFullScreen'
      ];

      const rows = this.operations.map(op => [
        op.operation,
        op.windowId,
        op.startTime,
        op.endTime,
        op.duration,
        op.isTargetMet,
        op.windowState.width,
        op.windowState.height,
        op.windowState.x,
        op.windowState.y,
        op.windowState.isVisible,
        op.windowState.isMinimized,
        op.windowState.isMaximized,
        op.windowState.isFullScreen
      ]);

      return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }

    return JSON.stringify({
      operations: this.operations,
      summary: this.getPerformanceSummary(),
      trackedWindows: Array.from(this.trackedWindows)
    }, null, 2);
  }

  /**
   * Reset all data
   */
  public reset(): void {
    this.operations = [];
    this.activeOperations.clear();
    this.emit('data-reset');
  }

  /**
   * Set target duration
   */
  public setTargetDuration(targetMs: number): void {
    this.targetDuration = targetMs;
    this.emit('target-updated', targetMs);
  }

  /**
   * Get current target duration
   */
  public getTargetDuration(): number {
    return this.targetDuration;
  }

  /**
   * Get tracked windows
   */
  public getTrackedWindows(): number[] {
    return Array.from(this.trackedWindows);
  }
}

export default WindowOperationTracker;