/**
 * Mock Storage Plugin for Testing
 * Provides test implementation of BaseStoragePlugin
 */

import { BaseStoragePlugin } from '../../../src/services/storage/plugins/BaseStoragePlugin';
import { StorageEvent, KBEntry, SearchResult } from '../../../src/services/storage/IStorageService';

export class MockPlugin extends BaseStoragePlugin {
  public name = 'MockPlugin';
  public version = '1.0.0';
  public description = 'Mock plugin for testing';

  // Test tracking
  public hooksCalled: string[] = [];
  public eventsReceived: StorageEvent[] = [];
  public modifiedData: any[] = [];

  // Test control flags
  public shouldFailInitialization = false;
  public shouldFailCleanup = false;
  public shouldModifyData = false;
  public shouldRejectHooks = false;

  // Spy methods
  public initialize = jest.fn().mockImplementation(this._initialize.bind(this));
  public cleanup = jest.fn().mockImplementation(this._cleanup.bind(this));
  public beforeAdd = jest.fn().mockImplementation(this._beforeAdd.bind(this));
  public afterAdd = jest.fn().mockImplementation(this._afterAdd.bind(this));
  public beforeUpdate = jest.fn().mockImplementation(this._beforeUpdate.bind(this));
  public afterUpdate = jest.fn().mockImplementation(this._afterUpdate.bind(this));
  public beforeDelete = jest.fn().mockImplementation(this._beforeDelete.bind(this));
  public afterDelete = jest.fn().mockImplementation(this._afterDelete.bind(this));
  public beforeSearch = jest.fn().mockImplementation(this._beforeSearch.bind(this));
  public afterSearch = jest.fn().mockImplementation(this._afterSearch.bind(this));
  public onEvent = jest.fn().mockImplementation(this._onEvent.bind(this));

  private async _initialize(): Promise<void> {
    if (this.shouldFailInitialization) {
      throw new Error('Mock plugin initialization failed');
    }
    
    this.isInitialized = true;
    this.hooksCalled.push('initialize');
  }

  private async _cleanup(): Promise<void> {
    if (this.shouldFailCleanup) {
      throw new Error('Mock plugin cleanup failed');
    }
    
    this.isInitialized = false;
    this.hooksCalled.push('cleanup');
  }

  private async _beforeAdd(entry: any): Promise<any> {
    this.hooksCalled.push('beforeAdd');
    
    if (this.shouldRejectHooks) {
      throw new Error('beforeAdd hook rejected');
    }

    if (this.shouldModifyData) {
      const modified = { ...entry, title: `[MODIFIED] ${entry.title}` };
      this.modifiedData.push(modified);
      return modified;
    }

    return entry;
  }

  private async _afterAdd(entry: KBEntry): Promise<void> {
    this.hooksCalled.push('afterAdd');
    
    if (this.shouldRejectHooks) {
      throw new Error('afterAdd hook rejected');
    }
  }

  private async _beforeUpdate(id: string, data: any): Promise<any> {
    this.hooksCalled.push('beforeUpdate');
    
    if (this.shouldRejectHooks) {
      throw new Error('beforeUpdate hook rejected');
    }

    if (this.shouldModifyData) {
      const modified = { ...data, title: `[UPDATED] ${data.title || 'Unknown'}` };
      this.modifiedData.push(modified);
      return modified;
    }

    return data;
  }

  private async _afterUpdate(entry: KBEntry): Promise<void> {
    this.hooksCalled.push('afterUpdate');
    
    if (this.shouldRejectHooks) {
      throw new Error('afterUpdate hook rejected');
    }
  }

  private async _beforeDelete(id: string): Promise<void> {
    this.hooksCalled.push('beforeDelete');
    
    if (this.shouldRejectHooks) {
      throw new Error('beforeDelete hook rejected');
    }
  }

  private async _afterDelete(id: string): Promise<void> {
    this.hooksCalled.push('afterDelete');
    
    if (this.shouldRejectHooks) {
      throw new Error('afterDelete hook rejected');
    }
  }

  private async _beforeSearch(query: string, options: any): Promise<{ query: string; options: any }> {
    this.hooksCalled.push('beforeSearch');
    
    if (this.shouldRejectHooks) {
      throw new Error('beforeSearch hook rejected');
    }

    if (this.shouldModifyData) {
      const modified = {
        query: `[ENHANCED] ${query}`,
        options: { ...options, enhanced: true }
      };
      this.modifiedData.push(modified);
      return modified;
    }

    return { query, options };
  }

  private async _afterSearch(results: SearchResult[]): Promise<SearchResult[]> {
    this.hooksCalled.push('afterSearch');
    
    if (this.shouldRejectHooks) {
      throw new Error('afterSearch hook rejected');
    }

    if (this.shouldModifyData) {
      const modified = results.map(result => ({
        ...result,
        score: result.score * 1.1, // Boost scores
        metadata: { ...result.metadata, enhanced: true }
      }));
      this.modifiedData.push(modified);
      return modified;
    }

    return results;
  }

  private async _onEvent(event: StorageEvent): Promise<void> {
    this.hooksCalled.push(`onEvent:${event.type}`);
    this.eventsReceived.push(event);
    
    if (this.shouldRejectHooks) {
      throw new Error('onEvent hook rejected');
    }
  }

  // Test utilities
  public reset(): void {
    this.hooksCalled = [];
    this.eventsReceived = [];
    this.modifiedData = [];
    this.shouldFailInitialization = false;
    this.shouldFailCleanup = false;
    this.shouldModifyData = false;
    this.shouldRejectHooks = false;
    this.isInitialized = false;
    this.isEnabled = true;
    jest.clearAllMocks();
  }

  public getHookCallCount(hookName: string): number {
    return this.hooksCalled.filter(call => call === hookName).length;
  }

  public wasHookCalled(hookName: string): boolean {
    return this.hooksCalled.includes(hookName);
  }

  public getEventCount(eventType?: string): number {
    if (eventType) {
      return this.eventsReceived.filter(event => event.type === eventType).length;
    }
    return this.eventsReceived.length;
  }

  public getLastEvent(): StorageEvent | undefined {
    return this.eventsReceived[this.eventsReceived.length - 1];
  }

  public getLastModifiedData(): any {
    return this.modifiedData[this.modifiedData.length - 1];
  }
}

// Analytics Mock Plugin
export class MockAnalyticsPlugin extends MockPlugin {
  public name = 'MockAnalyticsPlugin';
  public description = 'Mock analytics plugin for testing';

  private analytics: Map<string, any> = new Map();

  private async _afterAdd(entry: KBEntry): Promise<void> {
    await super._afterAdd(entry);
    this.trackEvent('entry_added', { category: entry.category });
  }

  private async _afterSearch(results: SearchResult[]): Promise<SearchResult[]> {
    const modifiedResults = await super._afterSearch(results);
    this.trackEvent('search_performed', { resultCount: results.length });
    return modifiedResults;
  }

  private trackEvent(eventType: string, data: any): void {
    const key = `${eventType}_${Date.now()}`;
    this.analytics.set(key, { type: eventType, data, timestamp: new Date() });
  }

  public getAnalytics(): Map<string, any> {
    return this.analytics;
  }

  public getAnalyticsCount(eventType?: string): number {
    if (eventType) {
      return Array.from(this.analytics.values()).filter(a => a.type === eventType).length;
    }
    return this.analytics.size;
  }

  public reset(): void {
    super.reset();
    this.analytics.clear();
  }
}

// Performance Mock Plugin
export class MockPerformancePlugin extends MockPlugin {
  public name = 'MockPerformancePlugin';
  public description = 'Mock performance plugin for testing';

  private performanceData: Map<string, number[]> = new Map();

  private async _beforeSearch(query: string, options: any): Promise<{ query: string; options: any }> {
    const result = await super._beforeSearch(query, options);
    this.startTimer('search');
    return result;
  }

  private async _afterSearch(results: SearchResult[]): Promise<SearchResult[]> {
    const modifiedResults = await super._afterSearch(results);
    this.endTimer('search');
    return modifiedResults;
  }

  private startTimer(operation: string): void {
    if (!this.performanceData.has(operation)) {
      this.performanceData.set(operation, []);
    }
    // Store start time as negative value
    this.performanceData.get(operation)!.push(-Date.now());
  }

  private endTimer(operation: string): void {
    const times = this.performanceData.get(operation);
    if (times && times.length > 0) {
      const startTime = times[times.length - 1];
      if (startTime < 0) {
        times[times.length - 1] = Date.now() + startTime; // Convert to duration
      }
    }
  }

  public getPerformanceData(operation?: string): Map<string, number[]> | number[] {
    if (operation) {
      return this.performanceData.get(operation) || [];
    }
    return this.performanceData;
  }

  public getAverageTime(operation: string): number {
    const times = this.performanceData.get(operation) || [];
    const validTimes = times.filter(t => t > 0);
    if (validTimes.length === 0) return 0;
    return validTimes.reduce((sum, time) => sum + time, 0) / validTimes.length;
  }

  public reset(): void {
    super.reset();
    this.performanceData.clear();
  }
}

// Mock Jest implementation for environments where jest is not available
if (typeof jest === 'undefined') {
  (global as any).jest = {
    fn: () => ({
      mockImplementation: (impl: Function) => impl,
      mockReturnValue: (value: any) => () => value,
      mockRejectedValue: (error: Error) => () => Promise.reject(error)
    })
  };
}