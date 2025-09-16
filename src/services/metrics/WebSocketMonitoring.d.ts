import { WebSocket } from 'ws';
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
export declare class WebSocketMonitoring {
    private wss;
    private clients;
    private metricsSubscription;
    private heartbeatInterval;
    private port;
    private server;
    constructor(port?: number);
    initialize(): Promise<void>;
    private setupEventHandlers;
    private setupClientHandlers;
    private handleClientMessage;
    private handleSubscription;
    private isValidChannel;
    private subscribeToMetrics;
    private broadcastMetrics;
    private broadcastToSubscribers;
    private sendMessage;
    private sendError;
    private sendCurrentMetrics;
    private startHeartbeat;
    getClientsInfo(): Array<{
        id: string;
        subscriptions: string[];
        connectedAt: number;
        lastPing: number;
        metadata: any;
    }>;
    broadcastMessage(type: string, data: any): void;
    private generateClientId;
    private generateMessageId;
    getStats(): {
        connectedClients: number;
        totalMessages: number;
        uptime: number;
        subscriptions: Record<string, number>;
    };
    close(): Promise<void>;
}
export declare const webSocketMonitoring: WebSocketMonitoring;
//# sourceMappingURL=WebSocketMonitoring.d.ts.map