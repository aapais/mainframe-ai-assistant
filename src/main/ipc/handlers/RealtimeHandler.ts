/**
 * Real-time Updates IPC Handler
 *
 * Handles WebSocket/SSE-style real-time communication for live updates
 * of categories, tags, and KB entries across multiple client instances.
 */

import {
  IPCHandlerFunction,
  BaseIPCRequest,
  BaseIPCResponse,
  IPCErrorCode
} from '../../../types/ipc';
import { DatabaseManager } from '../../../database/DatabaseManager';
import { MultiLayerCacheManager } from '../../../caching/MultiLayerCacheManager';
import { HandlerUtils, HandlerConfigs } from './index';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// Real-time Event Types
export type RealtimeEventType =
  | 'category_created' | 'category_updated' | 'category_deleted' | 'category_moved'
  | 'tag_created' | 'tag_updated' | 'tag_deleted' | 'tag_associated' | 'tag_dissociated'
  | 'kb_entry_created' | 'kb_entry_updated' | 'kb_entry_deleted'
  | 'search_performed' | 'bulk_operation_completed'
  | 'system_status' | 'cache_invalidated';

export interface RealtimeEvent {
  id: string;
  type: RealtimeEventType;
  timestamp: Date;
  source: string;
  data: any;
  metadata?: {
    user_id?: string;
    session_id?: string;
    affected_entities?: string[];
    change_summary?: string;
  };
}

// Request/Response Types
interface RealtimeSubscribeRequest extends BaseIPCRequest {
  subscription: {
    event_types?: RealtimeEventType[];
    filters?: {
      categories?: string[];
      tags?: string[];
      users?: string[];
      exclude_own_events?: boolean;
    };
    options?: {
      batch_events?: boolean;
      batch_interval?: number;
      include_historical?: boolean;
      historical_limit?: number;
    };
  };
}

interface RealtimeSubscribeResponse extends BaseIPCResponse {
  data: {
    subscription_id: string;
    active_subscriptions: number;
    supported_events: RealtimeEventType[];
  };
}

interface RealtimeUnsubscribeRequest extends BaseIPCRequest {
  subscription_id: string;
}

interface RealtimeBroadcastRequest extends BaseIPCRequest {
  event: Omit<RealtimeEvent, 'id' | 'timestamp'>;
  options?: {
    exclude_subscribers?: string[];
    target_subscribers?: string[];
    persist?: boolean;
  };
}

interface RealtimeGetEventsRequest extends BaseIPCRequest {
  filters?: {
    event_types?: RealtimeEventType[];
    since?: Date;
    limit?: number;
    offset?: number;
  };
}

interface RealtimeGetEventsResponse extends BaseIPCResponse {
  data: {
    events: RealtimeEvent[];
    total_count: number;
    has_more: boolean;
  };
}

interface RealtimeStatusRequest extends BaseIPCRequest {
  include_stats?: boolean;
}

interface RealtimeStatusResponse extends BaseIPCResponse {
  data: {
    status: 'active' | 'inactive';
    active_subscriptions: number;
    connected_clients: number;
    events_processed: number;
    uptime: number;
    stats?: {
      events_per_minute: number;
      most_active_event_types: Array<{ type: RealtimeEventType; count: number }>;
      memory_usage: number;
    };
  };
}

// Subscription Management
interface Subscription {
  id: string;
  client_id: string;
  event_types: Set<RealtimeEventType>;
  filters: any;
  options: any;
  created_at: Date;
  last_activity: Date;
  event_count: number;
}

/**
 * Real-time Handler
 *
 * Provides WebSocket/SSE-like functionality for real-time updates
 * using Electron's IPC system with event broadcasting capabilities.
 */
export class RealtimeHandler extends EventEmitter {
  private subscriptions = new Map<string, Subscription>();
  private eventHistory: RealtimeEvent[] = [];
  private maxHistorySize = 1000;
  private eventCounter = 0;
  private startTime = Date.now();

  constructor(
    private dbManager: DatabaseManager,
    private cacheManager: MultiLayerCacheManager
  ) {
    super();
    this.setupCleanupInterval();
  }

  /**
   * Subscribe to real-time events
   */
  handleSubscribe: IPCHandlerFunction<'realtime:subscribe'> = async (request: RealtimeSubscribeRequest) => {
    const startTime = Date.now();

    try {
      const { subscription } = request;

      // Generate subscription ID
      const subscriptionId = uuidv4();
      const clientId = request.requestId; // Use request ID as client identifier

      // Validate event types
      const supportedEventTypes: RealtimeEventType[] = [
        'category_created', 'category_updated', 'category_deleted', 'category_moved',
        'tag_created', 'tag_updated', 'tag_deleted', 'tag_associated', 'tag_dissociated',
        'kb_entry_created', 'kb_entry_updated', 'kb_entry_deleted',
        'search_performed', 'bulk_operation_completed',
        'system_status', 'cache_invalidated'
      ];

      const requestedTypes = subscription.event_types || supportedEventTypes;
      const invalidTypes = requestedTypes.filter(type => !supportedEventTypes.includes(type));

      if (invalidTypes.length > 0) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.VALIDATION_FAILED,
          `Invalid event types: ${invalidTypes.join(', ')}`
        );
      }

      // Create subscription
      const newSubscription: Subscription = {
        id: subscriptionId,
        client_id: clientId,
        event_types: new Set(requestedTypes),
        filters: subscription.filters || {},
        options: subscription.options || {},
        created_at: new Date(),
        last_activity: new Date(),
        event_count: 0
      };

      this.subscriptions.set(subscriptionId, newSubscription);

      // Send historical events if requested
      if (subscription.options?.include_historical) {
        const historicalEvents = this.getHistoricalEvents(
          requestedTypes,
          subscription.options.historical_limit || 50
        );

        // Send historical events asynchronously
        setTimeout(() => {
          historicalEvents.forEach(event => {
            this.sendEventToSubscription(subscriptionId, event);
          });
        }, 100);
      }

      console.log(`🔄 New real-time subscription: ${subscriptionId} (${requestedTypes.length} event types)`);

      return HandlerUtils.createSuccessResponse(
        request.requestId,
        startTime,
        {
          subscription_id: subscriptionId,
          active_subscriptions: this.subscriptions.size,
          supported_events: supportedEventTypes
        }
      ) as RealtimeSubscribeResponse;

    } catch (error) {
      console.error('Real-time subscription error:', error);
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Subscription failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  /**
   * Unsubscribe from real-time events
   */
  handleUnsubscribe: IPCHandlerFunction<'realtime:unsubscribe'> = async (request: RealtimeUnsubscribeRequest) => {
    const startTime = Date.now();

    try {
      const { subscription_id } = request;

      if (!this.subscriptions.has(subscription_id)) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.ENTRY_NOT_FOUND,
          `Subscription ${subscription_id} not found`
        );
      }

      const subscription = this.subscriptions.get(subscription_id)!;
      this.subscriptions.delete(subscription_id);

      console.log(`🛑 Unsubscribed: ${subscription_id} (processed ${subscription.event_count} events)`);

      return HandlerUtils.createSuccessResponse(
        request.requestId,
        startTime,
        null,
        {
          unsubscribed: true,
          events_processed: subscription.event_count,
          active_subscriptions: this.subscriptions.size
        }
      );

    } catch (error) {
      console.error('Real-time unsubscription error:', error);
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Unsubscription failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  /**
   * Broadcast event to subscribers
   */
  handleBroadcast: IPCHandlerFunction<'realtime:broadcast'> = async (request: RealtimeBroadcastRequest) => {
    const startTime = Date.now();

    try {
      const { event, options = {} } = request;

      // Create complete event object
      const completeEvent: RealtimeEvent = {
        id: uuidv4(),
        timestamp: new Date(),
        ...event
      };

      // Validate event
      if (!completeEvent.type || !completeEvent.source) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.VALIDATION_FAILED,
          'Event type and source are required'
        );
      }

      // Store in history if requested
      if (options.persist !== false) {
        this.addToHistory(completeEvent);
      }

      // Broadcast to matching subscribers
      const broadcastCount = this.broadcastEvent(completeEvent, options);

      this.eventCounter++;

      return HandlerUtils.createSuccessResponse(
        request.requestId,
        startTime,
        null,
        {
          event_id: completeEvent.id,
          subscribers_notified: broadcastCount,
          timestamp: completeEvent.timestamp
        }
      );

    } catch (error) {
      console.error('Real-time broadcast error:', error);
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Broadcast failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  /**
   * Get event history
   */
  handleGetEvents: IPCHandlerFunction<'realtime:events'> = async (request: RealtimeGetEventsRequest) => {
    const startTime = Date.now();

    try {
      const { filters = {} } = request;

      let events = [...this.eventHistory];

      // Apply filters
      if (filters.event_types && filters.event_types.length > 0) {
        events = events.filter(event => filters.event_types!.includes(event.type));
      }

      if (filters.since) {
        events = events.filter(event => event.timestamp >= filters.since!);
      }

      // Sort by timestamp (newest first)
      events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Apply pagination
      const offset = filters.offset || 0;
      const limit = filters.limit || 50;
      const totalCount = events.length;
      const paginatedEvents = events.slice(offset, offset + limit);
      const hasMore = offset + limit < totalCount;

      return HandlerUtils.createSuccessResponse(
        request.requestId,
        startTime,
        {
          events: paginatedEvents,
          total_count: totalCount,
          has_more: hasMore
        }
      ) as RealtimeGetEventsResponse;

    } catch (error) {
      console.error('Get events error:', error);
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Get events failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  /**
   * Get real-time system status
   */
  handleStatus: IPCHandlerFunction<'realtime:status'> = async (request: RealtimeStatusRequest) => {
    const startTime = Date.now();

    try {
      const { include_stats = false } = request;

      const uptime = Date.now() - this.startTime;
      const activeSubscriptions = this.subscriptions.size;
      const connectedClients = new Set(Array.from(this.subscriptions.values()).map(s => s.client_id)).size;

      let stats;
      if (include_stats) {
        const eventsPerMinute = Math.round((this.eventCounter / (uptime / 60000)) || 0);
        const eventTypeCounts = new Map<RealtimeEventType, number>();

        this.eventHistory.forEach(event => {
          eventTypeCounts.set(event.type, (eventTypeCounts.get(event.type) || 0) + 1);
        });

        const mostActiveEventTypes = Array.from(eventTypeCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([type, count]) => ({ type, count }));

        stats = {
          events_per_minute: eventsPerMinute,
          most_active_event_types: mostActiveEventTypes,
          memory_usage: process.memoryUsage().heapUsed
        };
      }

      return HandlerUtils.createSuccessResponse(
        request.requestId,
        startTime,
        {
          status: activeSubscriptions > 0 ? 'active' : 'inactive',
          active_subscriptions: activeSubscriptions,
          connected_clients: connectedClients,
          events_processed: this.eventCounter,
          uptime: uptime,
          stats
        }
      ) as RealtimeStatusResponse;

    } catch (error) {
      console.error('Status error:', error);
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Status failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  // Public methods for other services to emit events

  /**
   * Emit a real-time event from external services
   */
  emitRealtimeEvent(type: RealtimeEventType, data: any, metadata?: any): void {
    const event: RealtimeEvent = {
      id: uuidv4(),
      type,
      timestamp: new Date(),
      source: 'system',
      data,
      metadata
    };

    this.addToHistory(event);
    this.broadcastEvent(event);
    this.eventCounter++;
  }

  /**
   * Get current subscription count
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  // Private helper methods

  private broadcastEvent(event: RealtimeEvent, options: any = {}): number {
    let notifiedCount = 0;

    this.subscriptions.forEach((subscription, subscriptionId) => {
      // Check if subscription is interested in this event type
      if (!subscription.event_types.has(event.type)) {
        return;
      }

      // Apply filters
      if (!this.passesFilters(event, subscription.filters)) {
        return;
      }

      // Apply broadcast options
      if (options.exclude_subscribers?.includes(subscriptionId)) {
        return;
      }

      if (options.target_subscribers && !options.target_subscribers.includes(subscriptionId)) {
        return;
      }

      // Send event to subscription
      this.sendEventToSubscription(subscriptionId, event);
      notifiedCount++;

      // Update subscription activity
      subscription.last_activity = new Date();
      subscription.event_count++;
    });

    return notifiedCount;
  }

  private sendEventToSubscription(subscriptionId: string, event: RealtimeEvent): void {
    // In a real implementation, this would send the event via IPC to the specific client
    // For now, we'll emit it as a Node.js event that can be listened to
    this.emit('subscription_event', {
      subscription_id: subscriptionId,
      event
    });

    // Log for debugging
    console.log(`📡 Event sent to subscription ${subscriptionId}: ${event.type}`);
  }

  private passesFilters(event: RealtimeEvent, filters: any): boolean {
    // Category filter
    if (filters.categories && filters.categories.length > 0) {
      const eventCategories = event.metadata?.affected_entities?.filter(id => id.startsWith('category_')) || [];
      if (eventCategories.length > 0) {
        const hasMatchingCategory = eventCategories.some(cat => filters.categories.includes(cat));
        if (!hasMatchingCategory) return false;
      }
    }

    // Tag filter
    if (filters.tags && filters.tags.length > 0) {
      const eventTags = event.metadata?.affected_entities?.filter(id => id.startsWith('tag_')) || [];
      if (eventTags.length > 0) {
        const hasMatchingTag = eventTags.some(tag => filters.tags.includes(tag));
        if (!hasMatchingTag) return false;
      }
    }

    // User filter
    if (filters.users && filters.users.length > 0) {
      if (event.metadata?.user_id && !filters.users.includes(event.metadata.user_id)) {
        return false;
      }
    }

    // Exclude own events
    if (filters.exclude_own_events && event.metadata?.session_id) {
      // This would need to be implemented based on session tracking
    }

    return true;
  }

  private addToHistory(event: RealtimeEvent): void {
    this.eventHistory.push(event);

    // Maintain history size
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  private getHistoricalEvents(eventTypes: RealtimeEventType[], limit: number): RealtimeEvent[] {
    return this.eventHistory
      .filter(event => eventTypes.includes(event.type))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  private setupCleanupInterval(): void {
    // Clean up inactive subscriptions every 5 minutes
    setInterval(() => {
      const now = Date.now();
      const inactiveThreshold = 30 * 60 * 1000; // 30 minutes

      this.subscriptions.forEach((subscription, subscriptionId) => {
        if (now - subscription.last_activity.getTime() > inactiveThreshold) {
          console.log(`🧹 Cleaning up inactive subscription: ${subscriptionId}`);
          this.subscriptions.delete(subscriptionId);
        }
      });
    }, 5 * 60 * 1000);
  }
}

// Handler configuration
export const realtimeHandlerConfigs = {
  'realtime:subscribe': {
    ...HandlerConfigs.SYSTEM_OPERATIONS,
    rateLimitConfig: { requests: 10, windowMs: 60000 }
  },
  'realtime:unsubscribe': HandlerConfigs.SYSTEM_OPERATIONS,
  'realtime:broadcast': {
    ...HandlerConfigs.SYSTEM_OPERATIONS,
    rateLimitConfig: { requests: 100, windowMs: 60000 } // Higher limit for broadcasts
  },
  'realtime:events': HandlerConfigs.READ_HEAVY,
  'realtime:status': HandlerConfigs.SYSTEM_OPERATIONS
} as const;