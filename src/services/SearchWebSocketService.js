"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchWebSocketService = void 0;
exports.useSearchWebSocket = useSearchWebSocket;
const events_1 = require("events");
class SearchWebSocketService extends events_1.EventEmitter {
    ws = null;
    config;
    metrics;
    reconnectAttempt = 0;
    reconnectTimer = null;
    heartbeatTimer = null;
    messageQueue = [];
    pendingMessages = new Map();
    connectionStartTime = 0;
    lastHeartbeat = 0;
    constructor(config = {}) {
        super();
        this.config = {
            url: 'ws://localhost:3001/search',
            reconnectAttempts: 5,
            reconnectDelay: 1000,
            heartbeatInterval: 30000,
            messageTimeout: 10000,
            queueSize: 100,
            enableCompression: false,
            enableEncryption: false,
            ...config
        };
        this.metrics = {
            connectionCount: 0,
            messagesSent: 0,
            messagesReceived: 0,
            reconnectionCount: 0,
            averageLatency: 0,
            lastConnected: 0,
            uptime: 0,
            errors: []
        };
        setInterval(() => {
            this.cleanupPendingMessages();
        }, this.config.messageTimeout);
    }
    async connect() {
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
                this.ws.onmessage = (event) => {
                    this.handleMessage(event);
                };
                this.ws.onclose = (event) => {
                    this.handleClose(event);
                };
                this.ws.onerror = (error) => {
                    this.handleError(error);
                    reject(error);
                };
            }
            catch (error) {
                this.recordError('connection', error);
                reject(error);
            }
        });
    }
    disconnect() {
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
    async sendMessage(type, payload, options = {}) {
        const message = {
            id: this.generateMessageId(),
            type,
            payload,
            timestamp: Date.now(),
            userId: this.getUserId(),
            sessionId: this.getSessionId()
        };
        if (options.requireAck) {
            return this.sendReliableMessage(message);
        }
        else {
            return this.sendUnreliableMessage(message);
        }
    }
    subscribe(messageType, callback) {
        const listener = (message) => {
            if (message.type === messageType) {
                callback(message.payload);
            }
        };
        this.on('message', listener);
        return () => {
            this.off('message', listener);
        };
    }
    subscribeToSearchUpdates(callback) {
        return this.subscribe('search_update', callback);
    }
    subscribeToKBChanges(callback) {
        const unsubscribeCreate = this.subscribe('kb_entry_created', (payload) => {
            callback({ ...payload, changeType: 'created' });
        });
        const unsubscribeUpdate = this.subscribe('kb_entry_updated', (payload) => {
            callback({ ...payload, changeType: 'updated' });
        });
        const unsubscribeDelete = this.subscribe('kb_entry_deleted', (payload) => {
            callback({ ...payload, changeType: 'deleted' });
        });
        return () => {
            unsubscribeCreate();
            unsubscribeUpdate();
            unsubscribeDelete();
        };
    }
    subscribeToUserActivity(callback) {
        return this.subscribe('user_search_activity', callback);
    }
    subscribeToNotifications(callback) {
        return this.subscribe('system_notification', callback);
    }
    async broadcastSearchActivity(query, resultCount) {
        await this.sendMessage('user_search_activity', {
            userId: this.getUserId(),
            query,
            timestamp: Date.now(),
            resultCount
        });
    }
    async requestSearchUpdate(query, options = {}) {
        return this.sendMessage('search_update', {
            query,
            options,
            requestId: this.generateMessageId()
        }, { requireAck: true });
    }
    getConnectionStatus() {
        if (!this.ws)
            return 'closed';
        switch (this.ws.readyState) {
            case WebSocket.CONNECTING: return 'connecting';
            case WebSocket.OPEN: return 'open';
            case WebSocket.CLOSING: return 'closing';
            case WebSocket.CLOSED: return 'closed';
            default: return 'closed';
        }
    }
    getMetrics() {
        return {
            ...this.metrics,
            uptime: this.connectionStartTime ? Date.now() - this.connectionStartTime : 0
        };
    }
    handleOpen() {
        console.log('WebSocket connected');
        this.metrics.connectionCount++;
        this.metrics.lastConnected = Date.now();
        this.reconnectAttempt = 0;
        this.startHeartbeat();
        this.processMessageQueue();
        this.emit('connected');
    }
    handleMessage(event) {
        try {
            const message = JSON.parse(event.data);
            this.metrics.messagesReceived++;
            if (message.type === 'ack') {
                this.handleAcknowledgment(message);
                return;
            }
            if (message.type === 'heartbeat') {
                this.handleHeartbeatResponse(message);
                return;
            }
            if (message.timestamp) {
                const latency = Date.now() - message.timestamp;
                this.updateLatencyMetrics(latency);
            }
            this.emit('message', message);
            this.emit(message.type, message.payload);
        }
        catch (error) {
            console.error('Failed to parse WebSocket message:', error);
            this.recordError('message_parse', error);
        }
    }
    handleClose(event) {
        console.log(`WebSocket disconnected: ${event.code} ${event.reason}`);
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        this.emit('disconnected', { code: event.code, reason: event.reason });
        if (event.code !== 1000 && this.reconnectAttempt < this.config.reconnectAttempts) {
            this.scheduleReconnect();
        }
    }
    handleError(error) {
        console.error('WebSocket error:', error);
        this.recordError('connection', error);
        this.emit('error', error);
    }
    scheduleReconnect() {
        if (this.reconnectTimer)
            return;
        const delay = this.config.reconnectDelay * Math.pow(2, this.reconnectAttempt);
        this.reconnectTimer = setTimeout(async () => {
            this.reconnectTimer = null;
            this.reconnectAttempt++;
            this.metrics.reconnectionCount++;
            try {
                await this.connect();
            }
            catch (error) {
                console.error('Reconnection failed:', error);
                if (this.reconnectAttempt < this.config.reconnectAttempts) {
                    this.scheduleReconnect();
                }
                else {
                    this.emit('reconnectionFailed');
                }
            }
        }, delay);
        console.log(`Scheduled reconnection attempt ${this.reconnectAttempt + 1} in ${delay}ms`);
    }
    startHeartbeat() {
        if (this.heartbeatTimer)
            return;
        this.heartbeatTimer = setInterval(() => {
            this.sendHeartbeat();
        }, this.config.heartbeatInterval);
    }
    sendHeartbeat() {
        if (this.getConnectionStatus() === 'open') {
            this.lastHeartbeat = Date.now();
            this.sendUnreliableMessage({
                id: this.generateMessageId(),
                type: 'heartbeat',
                payload: { timestamp: this.lastHeartbeat },
                timestamp: this.lastHeartbeat
            });
        }
    }
    handleHeartbeatResponse(message) {
        const roundTripTime = Date.now() - message.payload.timestamp;
        this.updateLatencyMetrics(roundTripTime);
    }
    sendReliableMessage(message) {
        return new Promise((resolve, reject) => {
            this.pendingMessages.set(message.id, {
                message,
                resolve,
                reject,
                timestamp: Date.now()
            });
            if (this.getConnectionStatus() === 'open') {
                this.ws.send(JSON.stringify(message));
                this.metrics.messagesSent++;
            }
            else {
                this.queueMessage(message);
            }
            setTimeout(() => {
                const pending = this.pendingMessages.get(message.id);
                if (pending) {
                    this.pendingMessages.delete(message.id);
                    reject(new Error('Message acknowledgment timeout'));
                }
            }, this.config.messageTimeout);
        });
    }
    sendUnreliableMessage(message) {
        return new Promise((resolve, reject) => {
            if (this.getConnectionStatus() === 'open') {
                try {
                    this.ws.send(JSON.stringify(message));
                    this.metrics.messagesSent++;
                    resolve();
                }
                catch (error) {
                    reject(error);
                }
            }
            else {
                this.queueMessage(message);
                resolve();
            }
        });
    }
    handleAcknowledgment(message) {
        const ackId = message.payload.messageId;
        const pending = this.pendingMessages.get(ackId);
        if (pending) {
            this.pendingMessages.delete(ackId);
            pending.resolve(message.payload.data);
        }
    }
    queueMessage(message) {
        if (this.messageQueue.length >= this.config.queueSize) {
            this.messageQueue.shift();
        }
        this.messageQueue.push(message);
    }
    processMessageQueue() {
        if (this.getConnectionStatus() !== 'open' || this.messageQueue.length === 0) {
            return;
        }
        const messages = [...this.messageQueue];
        this.messageQueue = [];
        for (const message of messages) {
            try {
                this.ws.send(JSON.stringify(message));
                this.metrics.messagesSent++;
            }
            catch (error) {
                this.queueMessage(message);
                break;
            }
        }
    }
    cleanupPendingMessages() {
        const now = Date.now();
        const expiredIds = [];
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
    updateLatencyMetrics(latency) {
        this.metrics.averageLatency = (this.metrics.averageLatency + latency) / 2;
    }
    recordError(type, error) {
        this.metrics.errors.push({
            timestamp: Date.now(),
            error: error instanceof Error ? error.message : String(error),
            type
        });
        if (this.metrics.errors.length > 100) {
            this.metrics.errors.shift();
        }
    }
    generateMessageId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    getUserId() {
        return localStorage.getItem('userId') || 'anonymous';
    }
    getSessionId() {
        return localStorage.getItem('sessionId') || this.generateMessageId();
    }
    destroy() {
        this.disconnect();
        this.removeAllListeners();
        this.pendingMessages.clear();
        this.messageQueue = [];
    }
}
exports.SearchWebSocketService = SearchWebSocketService;
function useSearchWebSocket(config) {
    const [service] = React.useState(() => new SearchWebSocketService(config));
    const [connectionStatus, setConnectionStatus] = React.useState('closed');
    const [metrics, setMetrics] = React.useState(service.getMetrics());
    React.useEffect(() => {
        const handleConnected = () => setConnectionStatus('open');
        const handleDisconnected = () => setConnectionStatus('closed');
        service.on('connected', handleConnected);
        service.on('disconnected', handleDisconnected);
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
        disconnect: () => service.disconnect()
    };
}
exports.default = SearchWebSocketService;
//# sourceMappingURL=SearchWebSocketService.js.map