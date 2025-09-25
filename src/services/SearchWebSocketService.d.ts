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
export declare class SearchWebSocketService extends EventEmitter {
  private ws;
  private config;
  private metrics;
  private reconnectAttempt;
  private reconnectTimer;
  private heartbeatTimer;
  private messageQueue;
  private pendingMessages;
  private connectionStartTime;
  private lastHeartbeat;
  constructor(config?: Partial<WebSocketConfig>);
  connect(): Promise<void>;
  disconnect(): void;
  sendMessage(
    type: WebSocketMessageType,
    payload: any,
    options?: {
      requireAck?: boolean;
      priority?: 'low' | 'medium' | 'high';
    }
  ): Promise<any>;
  subscribe(messageType: WebSocketMessageType, callback: (payload: any) => void): () => void;
  subscribeToSearchUpdates(callback: (update: SearchUpdatePayload) => void): () => void;
  subscribeToKBChanges(callback: (change: KBEntryChangePayload) => void): () => void;
  subscribeToUserActivity(callback: (activity: UserSearchActivityPayload) => void): () => void;
  subscribeToNotifications(callback: (notification: SystemNotificationPayload) => void): () => void;
  broadcastSearchActivity(query: string, resultCount: number): Promise<void>;
  requestSearchUpdate(query: string, options?: any): Promise<SearchResult[]>;
  getConnectionStatus(): 'connecting' | 'open' | 'closing' | 'closed';
  getMetrics(): WebSocketMetrics;
  private handleOpen;
  private handleMessage;
  private handleClose;
  private handleError;
  private scheduleReconnect;
  private startHeartbeat;
  private sendHeartbeat;
  private handleHeartbeatResponse;
  private sendReliableMessage;
  private sendUnreliableMessage;
  private handleAcknowledgment;
  private queueMessage;
  private processMessageQueue;
  private cleanupPendingMessages;
  private updateLatencyMetrics;
  private recordError;
  private generateMessageId;
  private getUserId;
  private getSessionId;
  destroy(): void;
}
export declare function useSearchWebSocket(config?: Partial<WebSocketConfig>): {
  webSocketService: SearchWebSocketService;
  connectionStatus: string;
  metrics: WebSocketMetrics;
  connect: () => Promise<void>;
  disconnect: () => void;
};
export default SearchWebSocketService;
//# sourceMappingURL=SearchWebSocketService.d.ts.map
