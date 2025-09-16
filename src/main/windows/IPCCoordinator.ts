/**
 * IPC Coordination System for Multi-Window Communication
 * 
 * Secure, efficient inter-process communication coordinator for 
 * knowledge-first multi-window architecture with progressive MVP enhancement
 */

import { BrowserWindow, ipcMain, IpcMainEvent } from 'electron';
import { EventEmitter } from 'events';
import { WindowType, WindowIPCMessage, WindowIPCResponse, WindowInstance } from './types/WindowTypes';
import { v4 as uuidv4 } from 'uuid';

interface MessageQueueItem {
  message: WindowIPCMessage;
  retries: number;
  maxRetries: number;
  createdAt: Date;
  expiry: Date;
}

interface IPCChannelHandler {
  channel: string;
  handler: (event: IpcMainEvent, ...args: any[]) => Promise<any> | any;
  restricted?: boolean; // Requires authentication
  mvpLevel?: number;    // Minimum MVP level required
}

/**
 * IPC Coordinator manages secure communication between windows
 * 
 * Features by MVP:
 * MVP1: Basic main window IPC
 * MVP2: Multi-window messaging, pattern data sync
 * MVP3: Code context sharing, debug data sync
 * MVP4: Project data sync, template sharing
 * MVP5: AI assistant communication, real-time analytics sync
 */
export class IPCCoordinator extends EventEmitter {
  private messageQueue: Map<string, MessageQueueItem> = new Map();
  private pendingResponses: Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  
  private registeredHandlers: Map<string, IPCChannelHandler> = new Map();
  private windowRegistry: Map<string, BrowserWindow> = new Map();
  private channelSubscriptions: Map<string, Set<string>> = new Map(); // channel -> windowIds
  
  private config = {
    maxQueueSize: 1000,
    messageTimeout: 30000,
    maxRetries: 3,
    enableMessageLog: true,
    requireAuth: false
  };

  private stats = {
    messagesSent: 0,
    messagesReceived: 0,
    messagesQueued: 0,
    messagesFailed: 0,
    avgResponseTime: 0,
    errors: [] as string[]
  };

  constructor() {
    super();
    this.setupCoreHandlers();
    this.startQueueProcessor();
  }

  async initialize(): Promise<void> {
    // Register core IPC handlers
    this.registerCoreChannels();
    
    // Setup security middleware
    this.setupSecurityMiddleware();
    
    // Start periodic cleanup
    this.startPeriodicCleanup();
    
    this.emit('initialized');
  }

  async shutdown(): Promise<void> {
    // Clear pending messages
    for (const [messageId, pendingResponse] of this.pendingResponses) {
      clearTimeout(pendingResponse.timeout);
      pendingResponse.reject(new Error('IPC Coordinator shutting down'));
    }
    this.pendingResponses.clear();
    
    // Clear queue
    this.messageQueue.clear();
    
    // Unregister all handlers
    this.registeredHandlers.clear();
    
    this.emit('shutdown');
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Test basic IPC functionality
      const testMessage: WindowIPCMessage = {
        id: 'health-check-' + Date.now(),
        sourceWindowId: 'system',
        channel: 'ipc:health-check',
        data: { timestamp: Date.now() },
        timestamp: new Date(),
        priority: 'normal'
      };

      // Verify message queue is working
      return this.messageQueue.size < this.config.maxQueueSize;
    } catch (error) {
      this.stats.errors.push(`Health check failed: ${error.message}`);
      return false;
    }
  }

  // Window Registration
  registerWindow(windowId: string, window: BrowserWindow): void {
    this.windowRegistry.set(windowId, window);
    
    // Setup window-specific handlers
    window.webContents.on('ipc-message', (event, channel, ...args) => {
      this.handleWindowMessage(windowId, channel, args);
    });

    window.on('closed', () => {
      this.unregisterWindow(windowId);
    });

    this.emit('windowRegistered', windowId);
  }

  unregisterWindow(windowId: string): void {
    this.windowRegistry.delete(windowId);
    
    // Clean up subscriptions
    for (const [channel, subscribers] of this.channelSubscriptions) {
      subscribers.delete(windowId);
      if (subscribers.size === 0) {
        this.channelSubscriptions.delete(channel);
      }
    }

    // Cancel pending messages from this window
    for (const [messageId, queueItem] of this.messageQueue) {
      if (queueItem.message.sourceWindowId === windowId) {
        this.messageQueue.delete(messageId);
      }
    }

    this.emit('windowUnregistered', windowId);
  }

  // Message Sending
  async sendMessage(message: Omit<WindowIPCMessage, 'id' | 'timestamp'>): Promise<WindowIPCResponse | void> {
    const fullMessage: WindowIPCMessage = {
      id: uuidv4(),
      timestamp: new Date(),
      ...message
    };

    // Validate message
    if (!this.validateMessage(fullMessage)) {
      throw new Error(`Invalid message: ${fullMessage.channel}`);
    }

    // Check MVP level requirements
    const handler = this.registeredHandlers.get(fullMessage.channel);
    if (handler?.mvpLevel && this.getCurrentMVPLevel() < handler.mvpLevel) {
      throw new Error(`Channel ${fullMessage.channel} requires MVP level ${handler.mvpLevel}`);
    }

    this.stats.messagesSent++;

    // Handle different message types
    if (fullMessage.targetWindowId) {
      // Direct message to specific window
      return await this.sendDirectMessage(fullMessage);
    } else {
      // Broadcast message
      this.broadcastMessage(fullMessage);
    }
  }

  // Broadcast to all windows or specific types
  broadcast(channel: string, data: any, targetTypes?: WindowType[]): void {
    const message: WindowIPCMessage = {
      id: uuidv4(),
      sourceWindowId: 'system',
      channel,
      data,
      timestamp: new Date(),
      priority: 'normal'
    };

    if (targetTypes) {
      // Broadcast to specific window types
      for (const [windowId, window] of this.windowRegistry) {
        if (this.isWindowOfType(window, targetTypes)) {
          this.sendToWindow(windowId, message);
        }
      }
    } else {
      // Broadcast to all windows
      this.broadcastMessage(message);
    }
  }

  // Channel Management
  registerHandler(handler: IPCChannelHandler): void {
    this.registeredHandlers.set(handler.channel, handler);
    
    // Register with Electron IPC
    ipcMain.handle(handler.channel, async (event, ...args) => {
      try {
        // Security check
        if (handler.restricted && !this.isAuthorized(event)) {
          throw new Error('Unauthorized access to restricted channel');
        }

        // MVP level check
        if (handler.mvpLevel && this.getCurrentMVPLevel() < handler.mvpLevel) {
          throw new Error(`Feature not available in current MVP level`);
        }

        return await handler.handler(event, ...args);
      } catch (error) {
        this.stats.errors.push(`Handler error [${handler.channel}]: ${error.message}`);
        throw error;
      }
    });
  }

  unregisterHandler(channel: string): void {
    this.registeredHandlers.delete(channel);
    ipcMain.removeHandler(channel);
  }

  // Channel Subscriptions (for push notifications)
  subscribe(windowId: string, channel: string): void {
    if (!this.channelSubscriptions.has(channel)) {
      this.channelSubscriptions.set(channel, new Set());
    }
    this.channelSubscriptions.get(channel)!.add(windowId);
  }

  unsubscribe(windowId: string, channel: string): void {
    const subscribers = this.channelSubscriptions.get(channel);
    if (subscribers) {
      subscribers.delete(windowId);
      if (subscribers.size === 0) {
        this.channelSubscriptions.delete(channel);
      }
    }
  }

  // Push Notifications to Subscribers
  notifySubscribers(channel: string, data: any): void {
    const subscribers = this.channelSubscriptions.get(channel);
    if (!subscribers) return;

    const message: WindowIPCMessage = {
      id: uuidv4(),
      sourceWindowId: 'system',
      channel: `notification:${channel}`,
      data,
      timestamp: new Date(),
      priority: 'normal'
    };

    for (const windowId of subscribers) {
      this.sendToWindow(windowId, message);
    }
  }

  // Statistics and Monitoring
  getStats() {
    return {
      ...this.stats,
      queueSize: this.messageQueue.size,
      pendingResponses: this.pendingResponses.size,
      registeredHandlers: this.registeredHandlers.size,
      activeWindows: this.windowRegistry.size,
      subscriptions: Array.from(this.channelSubscriptions.entries()).map(([channel, subs]) => ({
        channel,
        subscribers: subs.size
      }))
    };
  }

  // Private Implementation
  
  private setupCoreHandlers(): void {
    // Window management handlers
    this.registerHandler({
      channel: 'ipc:ping',
      handler: () => ({ pong: Date.now() })
    });

    this.registerHandler({
      channel: 'ipc:stats',
      handler: () => this.getStats()
    });

    this.registerHandler({
      channel: 'ipc:subscribe',
      handler: (event, channel: string) => {
        const windowId = this.getWindowIdFromEvent(event);
        if (windowId) {
          this.subscribe(windowId, channel);
          return { subscribed: true, channel };
        }
        throw new Error('Unable to identify source window');
      }
    });

    this.registerHandler({
      channel: 'ipc:unsubscribe',
      handler: (event, channel: string) => {
        const windowId = this.getWindowIdFromEvent(event);
        if (windowId) {
          this.unsubscribe(windowId, channel);
          return { unsubscribed: true, channel };
        }
        throw new Error('Unable to identify source window');
      }
    });
  }

  private registerCoreChannels(): void {
    // Knowledge Base Synchronization (MVP1+)
    this.registerHandler({
      channel: 'kb:sync-request',
      handler: (event, data) => this.handleKBSync(data),
      mvpLevel: 1
    });

    // Pattern Detection Sync (MVP2+)
    this.registerHandler({
      channel: 'pattern:new-detection',
      handler: (event, pattern) => this.handlePatternDetection(pattern),
      mvpLevel: 2
    });

    this.registerHandler({
      channel: 'pattern:alert',
      handler: (event, alert) => this.handlePatternAlert(alert),
      mvpLevel: 2
    });

    // Code Analysis Sync (MVP3+)
    this.registerHandler({
      channel: 'code:analysis-result',
      handler: (event, result) => this.handleCodeAnalysis(result),
      mvpLevel: 3
    });

    this.registerHandler({
      channel: 'code:debug-context',
      handler: (event, context) => this.handleDebugContext(context),
      mvpLevel: 3
    });

    // Project Synchronization (MVP4+)
    this.registerHandler({
      channel: 'project:sync',
      handler: (event, projectData) => this.handleProjectSync(projectData),
      mvpLevel: 4
    });

    // AI Assistant Communication (MVP5+)
    this.registerHandler({
      channel: 'ai:request',
      handler: (event, request) => this.handleAIRequest(request),
      mvpLevel: 5
    });

    this.registerHandler({
      channel: 'ai:response',
      handler: (event, response) => this.handleAIResponse(response),
      mvpLevel: 5
    });
  }

  private async sendDirectMessage(message: WindowIPCMessage): Promise<WindowIPCResponse> {
    const targetWindow = this.windowRegistry.get(message.targetWindowId!);
    
    if (!targetWindow || targetWindow.isDestroyed()) {
      throw new Error(`Target window not found: ${message.targetWindowId}`);
    }

    if (message.requiresResponse) {
      return this.sendMessageWithResponse(targetWindow, message);
    } else {
      targetWindow.webContents.send(message.channel, message.data);
      return {
        messageId: message.id,
        success: true,
        timestamp: new Date()
      };
    }
  }

  private async sendMessageWithResponse(window: BrowserWindow, message: WindowIPCMessage): Promise<WindowIPCResponse> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingResponses.delete(message.id);
        reject(new Error(`Message timeout: ${message.channel}`));
      }, message.responseTimeout || this.config.messageTimeout);

      this.pendingResponses.set(message.id, { resolve, reject, timeout });
      
      window.webContents.send(message.channel, {
        ...message.data,
        _messageId: message.id,
        _requiresResponse: true
      });
    });
  }

  private broadcastMessage(message: WindowIPCMessage): void {
    for (const [windowId, window] of this.windowRegistry) {
      if (!window.isDestroyed()) {
        this.sendToWindow(windowId, message);
      }
    }
  }

  private sendToWindow(windowId: string, message: WindowIPCMessage): void {
    const window = this.windowRegistry.get(windowId);
    if (window && !window.isDestroyed()) {
      window.webContents.send(message.channel, message.data);
    }
  }

  private validateMessage(message: WindowIPCMessage): boolean {
    // Basic validation
    if (!message.id || !message.sourceWindowId || !message.channel) {
      return false;
    }

    // Channel name validation
    if (!/^[a-zA-Z][a-zA-Z0-9-_:]*$/.test(message.channel)) {
      return false;
    }

    // Priority validation
    const validPriorities = ['low', 'normal', 'high', 'critical'];
    if (!validPriorities.includes(message.priority)) {
      return false;
    }

    return true;
  }

  private handleWindowMessage(windowId: string, channel: string, args: any[]): void {
    this.stats.messagesReceived++;

    // Handle IPC responses
    if (channel === 'ipc:response') {
      this.handleIPCResponse(args[0]);
      return;
    }

    // Emit to registered handlers
    this.emit('windowMessage', { windowId, channel, args });
  }

  private handleIPCResponse(response: WindowIPCResponse): void {
    const pending = this.pendingResponses.get(response.messageId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingResponses.delete(response.messageId);
      
      if (response.success) {
        pending.resolve(response);
      } else {
        pending.reject(new Error(response.error || 'Unknown IPC error'));
      }
    }
  }

  // MVP-specific handlers
  private handleKBSync(data: any): any {
    this.notifySubscribers('kb:updated', data);
    return { synced: true, timestamp: Date.now() };
  }

  private handlePatternDetection(pattern: any): any {
    this.notifySubscribers('pattern:detected', pattern);
    return { acknowledged: true };
  }

  private handlePatternAlert(alert: any): any {
    // Create alert window if critical
    if (alert.severity === 'critical') {
      this.emit('createAlertWindow', alert);
    }
    
    this.notifySubscribers('alert:new', alert);
    return { processed: true };
  }

  private handleCodeAnalysis(result: any): any {
    this.notifySubscribers('code:analyzed', result);
    return { processed: true };
  }

  private handleDebugContext(context: any): any {
    this.notifySubscribers('debug:context-updated', context);
    return { updated: true };
  }

  private handleProjectSync(projectData: any): any {
    this.notifySubscribers('project:updated', projectData);
    return { synced: true };
  }

  private handleAIRequest(request: any): any {
    this.notifySubscribers('ai:processing', request);
    return { queued: true, requestId: request.id };
  }

  private handleAIResponse(response: any): any {
    this.notifySubscribers('ai:responded', response);
    return { delivered: true };
  }

  // Helper methods
  private isWindowOfType(window: BrowserWindow, types: WindowType[]): boolean {
    // This would need to be implemented based on how window types are tracked
    // For now, return true for all windows
    return true;
  }

  private getCurrentMVPLevel(): number {
    // This should be injected or retrieved from configuration
    return parseInt(process.env.MVP_LEVEL || '1');
  }

  private getWindowIdFromEvent(event: IpcMainEvent): string | null {
    // Find window ID by webContents
    for (const [windowId, window] of this.windowRegistry) {
      if (window.webContents === event.sender) {
        return windowId;
      }
    }
    return null;
  }

  private isAuthorized(event: IpcMainEvent): boolean {
    // Implement authorization logic based on window origin, etc.
    return true; // For now, allow all
  }

  private setupSecurityMiddleware(): void {
    // Add security checks for sensitive channels
    // This would include origin validation, authentication, etc.
  }

  private startQueueProcessor(): void {
    // Process queued messages periodically
    setInterval(() => {
      this.processMessageQueue();
    }, 1000);
  }

  private processMessageQueue(): void {
    const now = Date.now();
    
    for (const [messageId, queueItem] of this.messageQueue) {
      if (now > queueItem.expiry.getTime()) {
        // Message expired
        this.messageQueue.delete(messageId);
        this.stats.messagesFailed++;
        continue;
      }

      // Try to send queued message
      // Implementation depends on specific queuing strategy
    }
  }

  private startPeriodicCleanup(): void {
    setInterval(() => {
      // Clean up old error logs
      if (this.stats.errors.length > 100) {
        this.stats.errors = this.stats.errors.slice(-50);
      }
      
      // Clean up expired queue items
      this.processMessageQueue();
    }, 60000); // Every minute
  }
}