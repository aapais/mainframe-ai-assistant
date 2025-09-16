/**
 * Window Registry - Active Window Tracking System
 * 
 * Maintains central registry of all active windows with their relationships,
 * dependencies, and health status for the Knowledge-First architecture
 */

import { EventEmitter } from 'events';
import { BrowserWindow } from 'electron';
import { 
  WindowInstance, 
  WindowType, 
  WindowRegistryEntry, 
  WindowHealth, 
  WindowRelationship,
  WindowEvent,
  WindowEventData
} from './types/WindowTypes';

/**
 * Window Registry manages:
 * - Active window tracking
 * - Window relationships and dependencies
 * - Health monitoring
 * - Event coordination
 * - Lookup and query operations
 */
export class WindowRegistry extends EventEmitter {
  private windows: Map<string, WindowRegistryEntry> = new Map();
  private typeIndex: Map<WindowType, Set<string>> = new Map();
  private parentChildMap: Map<string, Set<string>> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  private readonly config = {
    healthCheckInterval: 10000, // 10 seconds
    maxHealthErrors: 5,
    maxHealthWarnings: 10,
    trackMemoryUsage: true,
    trackCPUUsage: false // Requires additional libraries
  };

  private stats = {
    totalRegistered: 0,
    totalUnregistered: 0,
    healthCheckCount: 0,
    healthCheckFailures: 0
  };

  constructor() {
    super();
    this.startHealthMonitoring();
  }

  // Registration Management
  
  register(windowInstance: WindowInstance): void {
    const registryEntry: WindowRegistryEntry = {
      instance: windowInstance,
      relationships: [],
      dependencies: [],
      dependents: [],
      health: this.createInitialHealth()
    };

    // Store in main registry
    this.windows.set(windowInstance.id, registryEntry);

    // Update type index
    if (!this.typeIndex.has(windowInstance.type)) {
      this.typeIndex.set(windowInstance.type, new Set());
    }
    this.typeIndex.get(windowInstance.type)!.add(windowInstance.id);

    // Setup window event handlers
    this.setupWindowEventHandlers(windowInstance);

    // Handle parent-child relationships
    if (windowInstance.config.parent) {
      this.addParentChildRelationship(windowInstance.config.parent, windowInstance.id);
    }

    this.stats.totalRegistered++;
    this.emit('windowRegistered', windowInstance);
  }

  unregister(windowId: string): boolean {
    const entry = this.windows.get(windowId);
    if (!entry) {
      return false;
    }

    const windowInstance = entry.instance;

    // Remove from type index
    const typeSet = this.typeIndex.get(windowInstance.type);
    if (typeSet) {
      typeSet.delete(windowId);
      if (typeSet.size === 0) {
        this.typeIndex.delete(windowInstance.type);
      }
    }

    // Handle parent-child relationships
    this.removeFromParentChildMap(windowId);

    // Clean up dependencies
    this.cleanupDependencies(windowId);

    // Remove from main registry
    this.windows.delete(windowId);

    this.stats.totalUnregistered++;
    this.emit('windowUnregistered', windowInstance);

    return true;
  }

  // Lookup Operations
  
  getWindow(idOrType: string | WindowType): WindowInstance | null {
    // Try direct ID lookup first
    const entry = this.windows.get(idOrType);
    if (entry) {
      return entry.instance;
    }

    // Try type lookup (return first match)
    if (this.typeIndex.has(idOrType as WindowType)) {
      const windowIds = this.typeIndex.get(idOrType as WindowType)!;
      const firstId = windowIds.values().next().value;
      if (firstId) {
        const firstEntry = this.windows.get(firstId);
        return firstEntry?.instance || null;
      }
    }

    return null;
  }

  getWindowsByType(type: WindowType): WindowInstance[] {
    const windowIds = this.typeIndex.get(type);
    if (!windowIds) {
      return [];
    }

    return Array.from(windowIds)
      .map(id => this.windows.get(id)?.instance)
      .filter((instance): instance is WindowInstance => instance !== undefined);
  }

  getAllWindows(): WindowInstance[] {
    return Array.from(this.windows.values()).map(entry => entry.instance);
  }

  getWindowCount(): number {
    return this.windows.size;
  }

  getWindowCountByType(type: WindowType): number {
    return this.typeIndex.get(type)?.size || 0;
  }

  // Health Management
  
  getWindowHealth(windowId: string): WindowHealth | null {
    const entry = this.windows.get(windowId);
    return entry?.health || null;
  }

  updateWindowHealth(windowId: string, health: Partial<WindowHealth>): boolean {
    const entry = this.windows.get(windowId);
    if (!entry) {
      return false;
    }

    entry.health = {
      ...entry.health,
      ...health,
      lastHealthCheck: new Date()
    };

    // Emit health events
    if (!health.responsive && entry.health.responsive) {
      this.emit('windowUnresponsive', entry.instance);
    } else if (health.responsive && !entry.health.responsive) {
      this.emit('windowResponsive', entry.instance);
    }

    return true;
  }

  getHealthyWindows(): WindowInstance[] {
    return Array.from(this.windows.values())
      .filter(entry => entry.health.responsive && entry.health.errors.length === 0)
      .map(entry => entry.instance);
  }

  getUnhealthyWindows(): WindowInstance[] {
    return Array.from(this.windows.values())
      .filter(entry => !entry.health.responsive || entry.health.errors.length > 0)
      .map(entry => entry.instance);
  }

  // Relationship Management
  
  addRelationship(windowId: string, relationship: WindowRelationship): boolean {
    const entry = this.windows.get(windowId);
    if (!entry) {
      return false;
    }

    // Avoid duplicate relationships
    const exists = entry.relationships.some(r => 
      r.type === relationship.type && r.targetWindowId === relationship.targetWindowId
    );

    if (!exists) {
      entry.relationships.push(relationship);
      this.updateDependencyMap(windowId, relationship);
      this.emit('relationshipAdded', { windowId, relationship });
    }

    return true;
  }

  removeRelationship(windowId: string, targetWindowId: string, type: WindowRelationship['type']): boolean {
    const entry = this.windows.get(windowId);
    if (!entry) {
      return false;
    }

    const index = entry.relationships.findIndex(r => 
      r.targetWindowId === targetWindowId && r.type === type
    );

    if (index >= 0) {
      const relationship = entry.relationships[index];
      entry.relationships.splice(index, 1);
      this.cleanupDependencyMap(windowId, relationship);
      this.emit('relationshipRemoved', { windowId, relationship });
      return true;
    }

    return false;
  }

  getRelationships(windowId: string): WindowRelationship[] {
    const entry = this.windows.get(windowId);
    return entry?.relationships || [];
  }

  getChildren(parentId: string): WindowInstance[] {
    const childIds = this.parentChildMap.get(parentId);
    if (!childIds) {
      return [];
    }

    return Array.from(childIds)
      .map(id => this.windows.get(id)?.instance)
      .filter((instance): instance is WindowInstance => instance !== undefined);
  }

  getParent(childId: string): WindowInstance | null {
    for (const [parentId, childIds] of this.parentChildMap) {
      if (childIds.has(childId)) {
        const entry = this.windows.get(parentId);
        return entry?.instance || null;
      }
    }
    return null;
  }

  // Query Operations
  
  findWindows(predicate: (instance: WindowInstance) => boolean): WindowInstance[] {
    return Array.from(this.windows.values())
      .map(entry => entry.instance)
      .filter(predicate);
  }

  getWindowsByWorkspace(workspace: string): WindowInstance[] {
    return this.findWindows(instance => instance.config.workspace === workspace);
  }

  getFocusedWindow(): WindowInstance | null {
    return this.findWindows(instance => instance.focused)[0] || null;
  }

  getVisibleWindows(): WindowInstance[] {
    return this.findWindows(instance => 
      !instance.window.isDestroyed() && 
      instance.window.isVisible() && 
      !instance.window.isMinimized()
    );
  }

  // Statistics and Monitoring
  
  getStats() {
    const healthyCount = this.getHealthyWindows().length;
    const unhealthyCount = this.getUnhealthyWindows().length;
    const typeBreakdown: Record<string, number> = {};
    
    for (const [type, windowIds] of this.typeIndex) {
      typeBreakdown[type] = windowIds.size;
    }

    return {
      ...this.stats,
      currentWindows: this.windows.size,
      healthyWindows: healthyCount,
      unhealthyWindows: unhealthyCount,
      typeBreakdown,
      relationships: Array.from(this.windows.values()).reduce((sum, entry) => sum + entry.relationships.length, 0),
      parentChildRelationships: this.parentChildMap.size
    };
  }

  clear(): void {
    // Close all windows before clearing
    for (const entry of this.windows.values()) {
      if (!entry.instance.window.isDestroyed()) {
        entry.instance.window.close();
      }
    }

    this.windows.clear();
    this.typeIndex.clear();
    this.parentChildMap.clear();
    
    this.emit('registryCleared');
  }

  // Private Implementation
  
  private createInitialHealth(): WindowHealth {
    return {
      responsive: true,
      lastHealthCheck: new Date(),
      errors: [],
      warnings: []
    };
  }

  private setupWindowEventHandlers(windowInstance: WindowInstance): void {
    const window = windowInstance.window;

    // Track window events
    const events: WindowEvent[] = [
      'focused', 'blurred', 'minimized', 'maximized', 'restored',
      'moved', 'resized', 'closed', 'hidden', 'shown', 'unresponsive', 'responsive'
    ];

    events.forEach(eventName => {
      window.on(eventName as any, () => {
        this.handleWindowEvent(windowInstance, eventName);
      });
    });

    // Special handling for focus events
    window.on('focus', () => {
      this.updateFocusState(windowInstance.id, true);
    });

    window.on('blur', () => {
      this.updateFocusState(windowInstance.id, false);
    });

    // Track last accessed time
    window.on('focus', () => {
      windowInstance.lastAccessed = new Date();
    });
  }

  private handleWindowEvent(windowInstance: WindowInstance, event: WindowEvent): void {
    const eventData: WindowEventData = {
      windowId: windowInstance.id,
      windowType: windowInstance.type,
      event,
      timestamp: new Date()
    };

    // Update health based on event
    if (event === 'unresponsive') {
      this.updateWindowHealth(windowInstance.id, { responsive: false });
    } else if (event === 'responsive') {
      this.updateWindowHealth(windowInstance.id, { responsive: true });
    }

    this.emit('windowEvent', eventData);
  }

  private updateFocusState(windowId: string, focused: boolean): void {
    // Update focus state for all windows
    for (const entry of this.windows.values()) {
      entry.instance.focused = entry.instance.id === windowId && focused;
    }
  }

  private addParentChildRelationship(parentId: string, childId: string): void {
    if (!this.parentChildMap.has(parentId)) {
      this.parentChildMap.set(parentId, new Set());
    }
    this.parentChildMap.get(parentId)!.add(childId);
  }

  private removeFromParentChildMap(windowId: string): void {
    // Remove as parent
    this.parentChildMap.delete(windowId);

    // Remove as child
    for (const [parentId, childIds] of this.parentChildMap) {
      childIds.delete(windowId);
      if (childIds.size === 0) {
        this.parentChildMap.delete(parentId);
      }
    }
  }

  private updateDependencyMap(windowId: string, relationship: WindowRelationship): void {
    const entry = this.windows.get(windowId);
    const targetEntry = this.windows.get(relationship.targetWindowId);
    
    if (!entry || !targetEntry) {
      return;
    }

    if (relationship.type === 'child' || relationship.type === 'modal') {
      // windowId depends on targetWindowId
      if (!entry.dependencies.includes(relationship.targetWindowId)) {
        entry.dependencies.push(relationship.targetWindowId);
      }
      if (!targetEntry.dependents.includes(windowId)) {
        targetEntry.dependents.push(windowId);
      }
    }
  }

  private cleanupDependencyMap(windowId: string, relationship: WindowRelationship): void {
    const entry = this.windows.get(windowId);
    const targetEntry = this.windows.get(relationship.targetWindowId);
    
    if (entry) {
      entry.dependencies = entry.dependencies.filter(id => id !== relationship.targetWindowId);
    }
    
    if (targetEntry) {
      targetEntry.dependents = targetEntry.dependents.filter(id => id !== windowId);
    }
  }

  private cleanupDependencies(windowId: string): void {
    const entry = this.windows.get(windowId);
    if (!entry) {
      return;
    }

    // Remove from dependents' dependency lists
    for (const dependentId of entry.dependents) {
      const dependentEntry = this.windows.get(dependentId);
      if (dependentEntry) {
        dependentEntry.dependencies = dependentEntry.dependencies.filter(id => id !== windowId);
      }
    }

    // Remove from dependencies' dependent lists
    for (const dependencyId of entry.dependencies) {
      const dependencyEntry = this.windows.get(dependencyId);
      if (dependencyEntry) {
        dependencyEntry.dependents = dependencyEntry.dependents.filter(id => id !== windowId);
      }
    }
  }

  private startHealthMonitoring(): void {
    if (!this.config.healthCheckInterval) {
      return;
    }

    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  private async performHealthCheck(): Promise<void> {
    this.stats.healthCheckCount++;

    for (const entry of this.windows.values()) {
      try {
        await this.checkWindowHealth(entry);
      } catch (error) {
        this.stats.healthCheckFailures++;
        
        // Add error to window health
        const errorMsg = `Health check failed: ${error.message}`;
        entry.health.errors.push(errorMsg);
        
        // Keep error list manageable
        if (entry.health.errors.length > this.config.maxHealthErrors) {
          entry.health.errors = entry.health.errors.slice(-this.config.maxHealthErrors);
        }
      }
    }
  }

  private async checkWindowHealth(entry: WindowRegistryEntry): Promise<void> {
    const window = entry.instance.window;
    
    if (window.isDestroyed()) {
      entry.health.responsive = false;
      entry.health.errors.push('Window destroyed');
      return;
    }

    // Basic responsiveness check
    const wasResponsive = entry.health.responsive;
    entry.health.responsive = !window.webContents.isDestroyed();

    // Memory usage tracking (if enabled)
    if (this.config.trackMemoryUsage) {
      try {
        const memoryInfo = await window.webContents.getProcessMemoryInfo();
        entry.health.memoryUsage = memoryInfo.workingSetSize;
        
        // Warning for high memory usage (>500MB)
        if (memoryInfo.workingSetSize > 500 * 1024 * 1024) {
          entry.health.warnings.push('High memory usage detected');
          
          // Keep warnings list manageable
          if (entry.health.warnings.length > this.config.maxHealthWarnings) {
            entry.health.warnings = entry.health.warnings.slice(-this.config.maxHealthWarnings);
          }
        }
      } catch (error) {
        // Memory info not available, skip
      }
    }

    entry.health.lastHealthCheck = new Date();

    // Emit events for health state changes
    if (wasResponsive !== entry.health.responsive) {
      if (entry.health.responsive) {
        this.emit('windowResponsive', entry.instance);
      } else {
        this.emit('windowUnresponsive', entry.instance);
      }
    }
  }

  shutdown(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}