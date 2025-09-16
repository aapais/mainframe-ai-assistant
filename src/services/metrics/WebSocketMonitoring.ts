/**
 * WebSocket Monitoring Service
 * Real-time metric broadcasting via WebSocket
 */

import { WebSocket, WebSocketServer } from 'ws';
import { metricsCollector } from './MetricsCollector';
import { createServer } from 'http';

export interface WebSocketClient {
  id: string;
  ws: WebSocket;
  subscriptions: Set<string>;
  lastPing: number;
  metadata: {
    userAgent?: string;
    ip?: string;
    connectedAt: number;
  };
}

export interface MonitoringMessage {
  type: 'metrics' | 'alert' | 'heartbeat' | 'subscription' | 'error';
  data: any;
  timestamp: number;
  id: string;
}

export class WebSocketMonitoring {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WebSocketClient> = new Map();
  private metricsSubscription: (() => void) | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private port: number = 8080;
  private server: any = null;

  constructor(port?: number) {
    if (port) this.port = port;
  }

  /**
   * Initialize WebSocket server
   */
  async initialize(): Promise<void> {
    try {
      // Create HTTP server for WebSocket upgrade
      this.server = createServer();

      // Create WebSocket server
      this.wss = new WebSocketServer({
        server: this.server,
        path: '/monitoring',
        clientTracking: true
      });

      // Set up WebSocket event handlers
      this.setupEventHandlers();

      // Subscribe to metrics updates
      this.subscribeToMetrics();

      // Start heartbeat check
      this.startHeartbeat();

      // Start HTTP server
      this.server.listen(this.port, () => {
        console.log(`WebSocket monitoring server started on port ${this.port}`);
        console.log(`WebSocket endpoint: ws://localhost:${this.port}/monitoring`);
      });

    } catch (error) {
      console.error('Failed to initialize WebSocket server:', error);
      throw error;
    }
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.wss) return;

    this.wss.on('connection', (ws, request) => {
      const clientId = this.generateClientId();
      const client: WebSocketClient = {
        id: clientId,
        ws,
        subscriptions: new Set(['metrics']), // Default subscription
        lastPing: Date.now(),
        metadata: {
          userAgent: request.headers['user-agent'],
          ip: request.socket.remoteAddress,
          connectedAt: Date.now()
        }
      };

      this.clients.set(clientId, client);
      console.log(`WebSocket client connected: ${clientId} (total: ${this.clients.size})`);

      // Send welcome message
      this.sendMessage(clientId, {
        type: 'heartbeat',
        data: {
          message: 'Connected to monitoring WebSocket',
          clientId,
          serverTime: Date.now()
        },
        timestamp: Date.now(),
        id: this.generateMessageId()
      });

      // Set up client event handlers
      this.setupClientHandlers(client);
    });

    this.wss.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });
  }

  /**
   * Set up individual client event handlers
   */
  private setupClientHandlers(client: WebSocketClient): void {
    const { ws, id } = client;

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleClientMessage(client, message);
      } catch (error) {
        console.error(`Invalid message from client ${id}:`, error);
        this.sendError(id, 'Invalid message format');
      }
    });

    ws.on('pong', () => {
      client.lastPing = Date.now();
    });

    ws.on('close', (code, reason) => {
      console.log(`WebSocket client disconnected: ${id}, code: ${code}, reason: ${reason}`);
      this.clients.delete(id);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket client error (${id}):`, error);
      this.clients.delete(id);
    });
  }

  /**
   * Handle messages from clients
   */
  private handleClientMessage(client: WebSocketClient, message: any): void {
    const { type, data } = message;

    switch (type) {
      case 'subscription':
        this.handleSubscription(client, data);
        break;

      case 'heartbeat':
        client.lastPing = Date.now();
        this.sendMessage(client.id, {
          type: 'heartbeat',
          data: { pong: true, serverTime: Date.now() },
          timestamp: Date.now(),
          id: this.generateMessageId()
        });
        break;

      case 'getMetrics':
        this.sendCurrentMetrics(client.id);
        break;

      default:
        this.sendError(client.id, `Unknown message type: ${type}`);
    }
  }

  /**
   * Handle subscription management
   */
  private handleSubscription(client: WebSocketClient, data: any): void {
    const { action, channels } = data;

    if (action === 'subscribe' && Array.isArray(channels)) {
      channels.forEach(channel => {
        if (this.isValidChannel(channel)) {
          client.subscriptions.add(channel);
        }
      });
    } else if (action === 'unsubscribe' && Array.isArray(channels)) {
      channels.forEach(channel => {
        client.subscriptions.delete(channel);
      });
    }

    this.sendMessage(client.id, {
      type: 'subscription',
      data: {
        status: 'updated',
        subscriptions: Array.from(client.subscriptions)
      },
      timestamp: Date.now(),
      id: this.generateMessageId()
    });
  }

  /**
   * Validate subscription channel
   */
  private isValidChannel(channel: string): boolean {
    const validChannels = ['metrics', 'alerts', 'sla', 'queries', 'cache'];
    return validChannels.includes(channel);
  }

  /**
   * Subscribe to metrics updates
   */
  private subscribeToMetrics(): void {
    this.metricsSubscription = metricsCollector.subscribe((metrics) => {
      this.broadcastMetrics(metrics);
    });
  }

  /**
   * Broadcast metrics to subscribed clients
   */
  private broadcastMetrics(metrics: any): void {
    const message: MonitoringMessage = {
      type: 'metrics',
      data: metrics,
      timestamp: Date.now(),
      id: this.generateMessageId()
    };

    this.broadcastToSubscribers('metrics', message);

    // Check for alerts in the metrics
    if (metrics.sla && metrics.sla.violations && metrics.sla.violations.length > 0) {
      const alertMessage: MonitoringMessage = {
        type: 'alert',
        data: {
          violations: metrics.sla.violations,
          severity: metrics.sla.violations.some((v: any) => v.severity === 'critical') ? 'critical' : 'warning'
        },
        timestamp: Date.now(),
        id: this.generateMessageId()
      };

      this.broadcastToSubscribers('alerts', alertMessage);
    }
  }

  /**
   * Broadcast message to clients subscribed to a specific channel
   */
  private broadcastToSubscribers(channel: string, message: MonitoringMessage): void {
    const subscribedClients = Array.from(this.clients.values())
      .filter(client => client.subscriptions.has(channel));

    subscribedClients.forEach(client => {
      this.sendMessage(client.id, message);
    });
  }

  /**
   * Send message to specific client
   */
  private sendMessage(clientId: string, message: MonitoringMessage): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      client.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error(`Failed to send message to client ${clientId}:`, error);
      this.clients.delete(clientId);
    }
  }

  /**
   * Send error message to client
   */
  private sendError(clientId: string, errorMessage: string): void {
    this.sendMessage(clientId, {
      type: 'error',
      data: { message: errorMessage },
      timestamp: Date.now(),
      id: this.generateMessageId()
    });
  }

  /**
   * Send current metrics to a specific client
   */
  private sendCurrentMetrics(clientId: string): void {
    const metrics = metricsCollector.getCurrentMetrics();
    this.sendMessage(clientId, {
      type: 'metrics',
      data: metrics,
      timestamp: Date.now(),
      id: this.generateMessageId()
    });
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const staleTimeout = 30000; // 30 seconds

      // Find stale connections
      const staleClients = Array.from(this.clients.entries())
        .filter(([_, client]) => now - client.lastPing > staleTimeout);

      // Remove stale connections
      staleClients.forEach(([clientId, client]) => {
        console.log(`Removing stale WebSocket client: ${clientId}`);
        client.ws.terminate();
        this.clients.delete(clientId);
      });

      // Send ping to remaining clients
      this.clients.forEach(client => {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      });

    }, 15000); // Check every 15 seconds
  }

  /**
   * Get connected clients information
   */
  getClientsInfo(): Array<{
    id: string;
    subscriptions: string[];
    connectedAt: number;
    lastPing: number;
    metadata: any;
  }> {
    return Array.from(this.clients.values()).map(client => ({
      id: client.id,
      subscriptions: Array.from(client.subscriptions),
      connectedAt: client.metadata.connectedAt,
      lastPing: client.lastPing,
      metadata: {
        userAgent: client.metadata.userAgent,
        ip: client.metadata.ip
      }
    }));
  }

  /**
   * Broadcast custom message to all clients
   */
  broadcastMessage(type: string, data: any): void {
    const message: MonitoringMessage = {
      type: type as any,
      data,
      timestamp: Date.now(),
      id: this.generateMessageId()
    };

    this.clients.forEach(client => {
      this.sendMessage(client.id, message);
    });
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get server statistics
   */
  getStats(): {
    connectedClients: number;
    totalMessages: number;
    uptime: number;
    subscriptions: Record<string, number>;
  } {
    const subscriptions: Record<string, number> = {};

    this.clients.forEach(client => {
      client.subscriptions.forEach(channel => {
        subscriptions[channel] = (subscriptions[channel] || 0) + 1;
      });
    });

    return {
      connectedClients: this.clients.size,
      totalMessages: 0, // Would need to track this
      uptime: process.uptime(),
      subscriptions
    };
  }

  /**
   * Close WebSocket server
   */
  async close(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.metricsSubscription) {
      this.metricsSubscription();
    }

    // Close all client connections
    this.clients.forEach(client => {
      client.ws.close();
    });
    this.clients.clear();

    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
    }

    // Close HTTP server
    if (this.server) {
      this.server.close();
    }

    console.log('WebSocket monitoring server closed');
  }
}

// Global instance
export const webSocketMonitoring = new WebSocketMonitoring();