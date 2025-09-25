/**
 * Search WebSocket Service
 *
 * Provides real-time updates for search results including:
 * - Live search result updates
 * - Knowledge base entry changes
 * - Real-time collaboration features
 * - Connection management and reconnection
 * - Message queuing and delivery guarantees
 * - Performance monitoring
 *
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { SearchResult, KBEntry } from '../types/services';

export interface WebSocketMessage {
  id: string;
  type: WebSocketMessageType;
  payload: any;
  timestamp: number;
  userId?: string;
  sessionId?: string;
}

export type WebSocketMessageType =
  | 'search_update'
  | 'kb_entry_created'
  | 'kb_entry_updated'
  | 'kb_entry_deleted'
  | 'search_results_invalidated'
  | 'user_search_activity'
  | 'system_notification'
  | 'heartbeat'
  | 'error';

export interface SearchUpdatePayload {
  query: string;
  results: SearchResult[];
  metadata: {
    totalResults: number;
    searchTime: number;
    userId?: string;
  };
}

export interface KBEntryChangePayload {
  entry: KBEntry;
  changeType: 'created' | 'updated' | 'deleted';
  previousEntry?: KBEntry;
  userId?: string;
}

export interface UserSearchActivityPayload {
  userId: string;
  query: string;
  timestamp: number;
  resultCount: number;
}

export interface SystemNotificationPayload {
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  priority: 'low' | 'medium' | 'high';
  autoHide?: boolean;
  duration?: number;
}

export interface WebSocketConfig {
  url: string;
  reconnectAttempts: number;
  reconnectDelay: number;
  heartbeatInterval: number;
  messageTimeout: number;
  queueSize: number;
  enableCompression: boolean;
  enableEncryption: boolean;
}

export interface WebSocketMetrics {
  connectionCount: number;
  messagesSent: number;
  messagesReceived: number;
  reconnectionCount: number;
  averageLatency: number;
  lastConnected: number;
  uptime: number;
  errors: Array<{
    timestamp: number;
    error: string;
    type: string;
  }>;
}

/**
 * Enhanced WebSocket service for real-time search updates
 */
export class SearchWebSocketService extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private metrics: WebSocketMetrics;

  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  private messageQueue: WebSocketMessage[] = [];
  private pendingMessages = new Map<
    string,
    {
      message: WebSocketMessage;
      resolve: (value: any) => void;
      reject: (reason: any) => void;
      timestamp: number;
    }
  >();

  private connectionStartTime = 0;
  private lastHeartbeat = 0;

  constructor(config: Partial<WebSocketConfig> = {}) {
    super();

    this.config = {
      url: 'ws://localhost:3001/search',
      reconnectAttempts: 5,
      reconnectDelay: 1000,
      heartbeatInterval: 30000, // 30 seconds
      messageTimeout: 10000, // 10 seconds
      queueSize: 100,
      enableCompression: false,
      enableEncryption: false,
      ...config,
    };

    this.metrics = {
      connectionCount: 0,
      messagesSent: 0,
      messagesReceived: 0,
      reconnectionCount: 0,
      averageLatency: 0,
      lastConnected: 0,
      uptime: 0,
      errors: [],
    };

    // Cleanup pending messages periodically
    setInterval(() => {
      this.cleanupPendingMessages();
    }, this.config.messageTimeout);
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.connectionStartTime = Date.now();
        this.ws = new WebSocket(this.config.url);

        this.ws.onopen = () => {
          this.handleOpen();
          resolve();
        };

        this.ws.onmessage = event => {
          this.handleMessage(event);
        };

        this.ws.onclose = event => {
          this.handleClose(event);
        };

        this.ws.onerror = error => {
          this.handleError(error);
          reject(error);
        };
      } catch (error) {
        this.recordError('connection', error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.reconnectAttempt = 0;
  }

  /**
   * Send message with delivery guarantee
   */
  async sendMessage(
    type: WebSocketMessageType,
    payload: any,
    options: { requireAck?: boolean; priority?: 'low' | 'medium' | 'high' } = {}
  ): Promise<any> {
    const message: WebSocketMessage = {
      id: this.generateMessageId(),
      type,
      payload,
      timestamp: Date.now(),
      userId: this.getUserId(),
      sessionId: this.getSessionId(),
    };

    if (options.requireAck) {
      return this.sendReliableMessage(message);
    } else {
      return this.sendUnreliableMessage(message);
    }
  }

  /**
   * Subscribe to specific message types
   */
  subscribe(messageType: WebSocketMessageType, callback: (payload: any) => void): () => void {
    const listener = (message: WebSocketMessage) => {
      if (message.type === messageType) {
        callback(message.payload);
      }
    };

    this.on('message', listener);

    return () => {
      this.off('message', listener);
    };
  }

  /**
   * Subscribe to search updates
   */
  subscribeToSearchUpdates(callback: (update: SearchUpdatePayload) => void): () => void {
    return this.subscribe('search_update', callback);
  }

  /**
   * Subscribe to KB entry changes
   */
  subscribeToKBChanges(callback: (change: KBEntryChangePayload) => void): () => void {
    const unsubscribeCreate = this.subscribe('kb_entry_created', payload => {
      callback({ ...payload, changeType: 'created' });
    });

    const unsubscribeUpdate = this.subscribe('kb_entry_updated', payload => {
      callback({ ...payload, changeType: 'updated' });
    });

    const unsubscribeDelete = this.subscribe('kb_entry_deleted', payload => {
      callback({ ...payload, changeType: 'deleted' });
    });

    return () => {
      unsubscribeCreate();
      unsubscribeUpdate();
      unsubscribeDelete();
    };
  }

  /**
   * Subscribe to user search activity
   */
  subscribeToUserActivity(callback: (activity: UserSearchActivityPayload) => void): () => void {
    return this.subscribe('user_search_activity', callback);
  }

  /**
   * Subscribe to system notifications
   */
  subscribeToNotifications(
    callback: (notification: SystemNotificationPayload) => void
  ): () => void {
    return this.subscribe('system_notification', callback);
  }

  /**
   * Broadcast search activity to other users
   */
  async broadcastSearchActivity(query: string, resultCount: number): Promise<void> {
    await this.sendMessage('user_search_activity', {
      userId: this.getUserId(),
      query,
      timestamp: Date.now(),
      resultCount,
    });
  }

  /**
   * Request fresh search results from server
   */
  async requestSearchUpdate(query: string, options: any = {}): Promise<SearchResult[]> {
    return this.sendMessage(
      'search_update',
      {
        query,
        options,
        requestId: this.generateMessageId(),
      },
      { requireAck: true }
    );
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): 'connecting' | 'open' | 'closing' | 'closed' {
    if (!this.ws) return 'closed';

    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'open';
      case WebSocket.CLOSING:
        return 'closing';
      case WebSocket.CLOSED:
        return 'closed';
      default:
        return 'closed';
    }
  }

  /**
   * Get service metrics
   */
  getMetrics(): WebSocketMetrics {
    return {
      ...this.metrics,
      uptime: this.connectionStartTime ? Date.now() - this.connectionStartTime : 0,
    };
  }

  /**
   * Private Methods
   */

  private handleOpen(): void {
    console.log('WebSocket connected');

    this.metrics.connectionCount++;
    this.metrics.lastConnected = Date.now();
    this.reconnectAttempt = 0;

    // Start heartbeat
    this.startHeartbeat();

    // Process queued messages
    this.processMessageQueue();

    this.emit('connected');
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);

      this.metrics.messagesReceived++;

      // Handle acknowledgments
      if (message.type === 'ack') {
        this.handleAcknowledgment(message);
        return;
      }

      // Handle heartbeat response
      if (message.type === 'heartbeat') {
        this.handleHeartbeatResponse(message);
        return;
      }

      // Update latency metrics
      if (message.timestamp) {
        const latency = Date.now() - message.timestamp;
        this.updateLatencyMetrics(latency);
      }

      // Emit message event
      this.emit('message', message);

      // Emit specific message type events
      this.emit(message.type, message.payload);
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
      this.recordError('message_parse', error);
    }
  }

  private handleClose(event: CloseEvent): void {
    console.log(`WebSocket disconnected: ${event.code} ${event.reason}`);

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    this.emit('disconnected', { code: event.code, reason: event.reason });

    // Attempt reconnection if not intentional disconnect
    if (event.code !== 1000 && this.reconnectAttempt < this.config.reconnectAttempts) {
      this.scheduleReconnect();
    }
  }

  private handleError(error: Event): void {
    console.error('WebSocket error:', error);
    this.recordError('connection', error);
    this.emit('error', error);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    const delay = this.config.reconnectDelay * Math.pow(2, this.reconnectAttempt);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      this.reconnectAttempt++;
      this.metrics.reconnectionCount++;

      try {
        await this.connect();
      } catch (error) {
        console.error('Reconnection failed:', error);

        if (this.reconnectAttempt < this.config.reconnectAttempts) {
          this.scheduleReconnect();
        } else {
          this.emit('reconnectionFailed');
        }
      }
    }, delay);

    console.log(`Scheduled reconnection attempt ${this.reconnectAttempt + 1} in ${delay}ms`);
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) return;

    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);
  }

  private sendHeartbeat(): void {
    if (this.getConnectionStatus() === 'open') {
      this.lastHeartbeat = Date.now();
      this.sendUnreliableMessage({
        id: this.generateMessageId(),
        type: 'heartbeat',
        payload: { timestamp: this.lastHeartbeat },
        timestamp: this.lastHeartbeat,
      });
    }
  }

  private handleHeartbeatResponse(message: WebSocketMessage): void {
    const roundTripTime = Date.now() - message.payload.timestamp;
    this.updateLatencyMetrics(roundTripTime);
  }

  private sendReliableMessage(message: WebSocketMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      // Store pending message
      this.pendingMessages.set(message.id, {
        message,
        resolve,
        reject,
        timestamp: Date.now(),
      });

      // Send message
      if (this.getConnectionStatus() === 'open') {
        this.ws!.send(JSON.stringify(message));
        this.metrics.messagesSent++;
      } else {
        // Queue message for later delivery
        this.queueMessage(message);
      }

      // Set timeout for acknowledgment
      setTimeout(() => {
        const pending = this.pendingMessages.get(message.id);
        if (pending) {
          this.pendingMessages.delete(message.id);
          reject(new Error('Message acknowledgment timeout'));
        }
      }, this.config.messageTimeout);
    });
  }

  private sendUnreliableMessage(message: WebSocketMessage): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.getConnectionStatus() === 'open') {
        try {
          this.ws!.send(JSON.stringify(message));
          this.metrics.messagesSent++;
          resolve();
        } catch (error) {
          reject(error);
        }
      } else {
        this.queueMessage(message);
        resolve();
      }
    });
  }

  private handleAcknowledgment(message: WebSocketMessage): void {
    const ackId = message.payload.messageId;
    const pending = this.pendingMessages.get(ackId);

    if (pending) {
      this.pendingMessages.delete(ackId);
      pending.resolve(message.payload.data);
    }
  }

  private queueMessage(message: WebSocketMessage): void {
    if (this.messageQueue.length >= this.config.queueSize) {
      // Remove oldest message to make room
      this.messageQueue.shift();
    }

    this.messageQueue.push(message);
  }

  private processMessageQueue(): void {
    if (this.getConnectionStatus() !== 'open' || this.messageQueue.length === 0) {
      return;
    }

    const messages = [...this.messageQueue];
    this.messageQueue = [];

    for (const message of messages) {
      try {
        this.ws!.send(JSON.stringify(message));
        this.metrics.messagesSent++;
      } catch (error) {
        // Requeue message if send fails
        this.queueMessage(message);
        break;
      }
    }
  }

  private cleanupPendingMessages(): void {
    const now = Date.now();
    const expiredIds: string[] = [];

    for (const [id, pending] of this.pendingMessages) {
      if (now - pending.timestamp > this.config.messageTimeout) {
        expiredIds.push(id);
      }
    }

    for (const id of expiredIds) {
      const pending = this.pendingMessages.get(id);
      if (pending) {
        this.pendingMessages.delete(id);
        pending.reject(new Error('Message timeout'));
      }
    }
  }

  private updateLatencyMetrics(latency: number): void {
    this.metrics.averageLatency = (this.metrics.averageLatency + latency) / 2;
  }

  private recordError(type: string, error: any): void {
    this.metrics.errors.push({
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : String(error),
      type,
    });

    // Keep only last 100 errors
    if (this.metrics.errors.length > 100) {
      this.metrics.errors.shift();
    }
  }

  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getUserId(): string {
    // This would typically come from authentication context
    return localStorage.getItem('userId') || 'anonymous';
  }

  private getSessionId(): string {
    // This would typically come from session management
    return localStorage.getItem('sessionId') || this.generateMessageId();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.disconnect();
    this.removeAllListeners();
    this.pendingMessages.clear();
    this.messageQueue = [];
  }
}

/**
 * React hook for using WebSocket service
 */
export function useSearchWebSocket(config?: Partial<WebSocketConfig>): {
  webSocketService: SearchWebSocketService;
  connectionStatus: string;
  metrics: WebSocketMetrics;
  connect: () => Promise<void>;
  disconnect: () => void;
} {
  const [service] = React.useState(() => new SearchWebSocketService(config));
  const [connectionStatus, setConnectionStatus] = React.useState('closed');
  const [metrics, setMetrics] = React.useState<WebSocketMetrics>(service.getMetrics());

  React.useEffect(() => {
    const handleConnected = () => setConnectionStatus('open');
    const handleDisconnected = () => setConnectionStatus('closed');

    service.on('connected', handleConnected);
    service.on('disconnected', handleDisconnected);

    // Update metrics periodically
    const metricsInterval = setInterval(() => {
      setMetrics(service.getMetrics());
    }, 5000);

    return () => {
      service.off('connected', handleConnected);
      service.off('disconnected', handleDisconnected);
      clearInterval(metricsInterval);
      service.destroy();
    };
  }, [service]);

  return {
    webSocketService: service,
    connectionStatus,
    metrics,
    connect: () => service.connect(),
    disconnect: () => service.disconnect(),
  };
}

export default SearchWebSocketService;
