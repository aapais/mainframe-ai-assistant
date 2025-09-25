'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.webSocketMonitoring = exports.WebSocketMonitoring = void 0;
const ws_1 = require('ws');
const MetricsCollector_1 = require('./MetricsCollector');
const http_1 = require('http');
class WebSocketMonitoring {
  wss = null;
  clients = new Map();
  metricsSubscription = null;
  heartbeatInterval = null;
  port = 8080;
  server = null;
  constructor(port) {
    if (port) this.port = port;
  }
  async initialize() {
    try {
      this.server = (0, http_1.createServer)();
      this.wss = new ws_1.WebSocketServer({
        server: this.server,
        path: '/monitoring',
        clientTracking: true,
      });
      this.setupEventHandlers();
      this.subscribeToMetrics();
      this.startHeartbeat();
      this.server.listen(this.port, () => {
        console.log(`WebSocket monitoring server started on port ${this.port}`);
        console.log(`WebSocket endpoint: ws://localhost:${this.port}/monitoring`);
      });
    } catch (error) {
      console.error('Failed to initialize WebSocket server:', error);
      throw error;
    }
  }
  setupEventHandlers() {
    if (!this.wss) return;
    this.wss.on('connection', (ws, request) => {
      const clientId = this.generateClientId();
      const client = {
        id: clientId,
        ws,
        subscriptions: new Set(['metrics']),
        lastPing: Date.now(),
        metadata: {
          userAgent: request.headers['user-agent'],
          ip: request.socket.remoteAddress,
          connectedAt: Date.now(),
        },
      };
      this.clients.set(clientId, client);
      console.log(`WebSocket client connected: ${clientId} (total: ${this.clients.size})`);
      this.sendMessage(clientId, {
        type: 'heartbeat',
        data: {
          message: 'Connected to monitoring WebSocket',
          clientId,
          serverTime: Date.now(),
        },
        timestamp: Date.now(),
        id: this.generateMessageId(),
      });
      this.setupClientHandlers(client);
    });
    this.wss.on('error', error => {
      console.error('WebSocket server error:', error);
    });
  }
  setupClientHandlers(client) {
    const { ws, id } = client;
    ws.on('message', data => {
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
    ws.on('error', error => {
      console.error(`WebSocket client error (${id}):`, error);
      this.clients.delete(id);
    });
  }
  handleClientMessage(client, message) {
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
          id: this.generateMessageId(),
        });
        break;
      case 'getMetrics':
        this.sendCurrentMetrics(client.id);
        break;
      default:
        this.sendError(client.id, `Unknown message type: ${type}`);
    }
  }
  handleSubscription(client, data) {
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
        subscriptions: Array.from(client.subscriptions),
      },
      timestamp: Date.now(),
      id: this.generateMessageId(),
    });
  }
  isValidChannel(channel) {
    const validChannels = ['metrics', 'alerts', 'sla', 'queries', 'cache'];
    return validChannels.includes(channel);
  }
  subscribeToMetrics() {
    this.metricsSubscription = MetricsCollector_1.metricsCollector.subscribe(metrics => {
      this.broadcastMetrics(metrics);
    });
  }
  broadcastMetrics(metrics) {
    const message = {
      type: 'metrics',
      data: metrics,
      timestamp: Date.now(),
      id: this.generateMessageId(),
    };
    this.broadcastToSubscribers('metrics', message);
    if (metrics.sla && metrics.sla.violations && metrics.sla.violations.length > 0) {
      const alertMessage = {
        type: 'alert',
        data: {
          violations: metrics.sla.violations,
          severity: metrics.sla.violations.some(v => v.severity === 'critical')
            ? 'critical'
            : 'warning',
        },
        timestamp: Date.now(),
        id: this.generateMessageId(),
      };
      this.broadcastToSubscribers('alerts', alertMessage);
    }
  }
  broadcastToSubscribers(channel, message) {
    const subscribedClients = Array.from(this.clients.values()).filter(client =>
      client.subscriptions.has(channel)
    );
    subscribedClients.forEach(client => {
      this.sendMessage(client.id, message);
    });
  }
  sendMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== ws_1.WebSocket.OPEN) {
      return;
    }
    try {
      client.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error(`Failed to send message to client ${clientId}:`, error);
      this.clients.delete(clientId);
    }
  }
  sendError(clientId, errorMessage) {
    this.sendMessage(clientId, {
      type: 'error',
      data: { message: errorMessage },
      timestamp: Date.now(),
      id: this.generateMessageId(),
    });
  }
  sendCurrentMetrics(clientId) {
    const metrics = MetricsCollector_1.metricsCollector.getCurrentMetrics();
    this.sendMessage(clientId, {
      type: 'metrics',
      data: metrics,
      timestamp: Date.now(),
      id: this.generateMessageId(),
    });
  }
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const staleTimeout = 30000;
      const staleClients = Array.from(this.clients.entries()).filter(
        ([_, client]) => now - client.lastPing > staleTimeout
      );
      staleClients.forEach(([clientId, client]) => {
        console.log(`Removing stale WebSocket client: ${clientId}`);
        client.ws.terminate();
        this.clients.delete(clientId);
      });
      this.clients.forEach(client => {
        if (client.ws.readyState === ws_1.WebSocket.OPEN) {
          client.ws.ping();
        }
      });
    }, 15000);
  }
  getClientsInfo() {
    return Array.from(this.clients.values()).map(client => ({
      id: client.id,
      subscriptions: Array.from(client.subscriptions),
      connectedAt: client.metadata.connectedAt,
      lastPing: client.lastPing,
      metadata: {
        userAgent: client.metadata.userAgent,
        ip: client.metadata.ip,
      },
    }));
  }
  broadcastMessage(type, data) {
    const message = {
      type,
      data,
      timestamp: Date.now(),
      id: this.generateMessageId(),
    };
    this.clients.forEach(client => {
      this.sendMessage(client.id, message);
    });
  }
  generateClientId() {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  generateMessageId() {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  getStats() {
    const subscriptions = {};
    this.clients.forEach(client => {
      client.subscriptions.forEach(channel => {
        subscriptions[channel] = (subscriptions[channel] || 0) + 1;
      });
    });
    return {
      connectedClients: this.clients.size,
      totalMessages: 0,
      uptime: process.uptime(),
      subscriptions,
    };
  }
  async close() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.metricsSubscription) {
      this.metricsSubscription();
    }
    this.clients.forEach(client => {
      client.ws.close();
    });
    this.clients.clear();
    if (this.wss) {
      this.wss.close();
    }
    if (this.server) {
      this.server.close();
    }
    console.log('WebSocket monitoring server closed');
  }
}
exports.WebSocketMonitoring = WebSocketMonitoring;
exports.webSocketMonitoring = new WebSocketMonitoring();
//# sourceMappingURL=WebSocketMonitoring.js.map
