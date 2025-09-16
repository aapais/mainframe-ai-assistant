/**
 * Interaction Analytics Utility
 *
 * Comprehensive analytics tracking for user interactions and accessibility events:
 * - Keyboard navigation tracking
 * - Touch gesture analytics
 * - Voice command tracking
 * - Performance metrics
 * - Accessibility compliance monitoring
 * @version 1.0.0
 */

export interface InteractionEvent {
  /** Event type */
  type: string;
  /** Interaction action */
  action: string;
  /** Event timestamp */
  timestamp: number;
  /** User session ID */
  sessionId: string;
  /** Additional event data */
  data?: Record<string, any>;
  /** Performance metrics */
  performance?: {
    duration?: number;
    responseTime?: number;
    memory?: number;
  };
  /** Accessibility context */
  accessibility?: {
    screenReader?: boolean;
    keyboardOnly?: boolean;
    voiceNavigation?: boolean;
    highContrast?: boolean;
    reducedMotion?: boolean;
  };
}

export interface AnalyticsConfig {
  /** Enable analytics collection */
  enabled: boolean;
  /** Buffer size before sending events */
  bufferSize: number;
  /** Endpoint for sending analytics */
  endpoint?: string;
  /** Debug mode */
  debug: boolean;
  /** Privacy mode - no PII */
  privacyMode: boolean;
  /** Sample rate (0-1) */
  sampleRate: number;
}

class InteractionAnalytics {
  private config: AnalyticsConfig;
  private eventBuffer: InteractionEvent[] = [];
  private sessionId: string;
  private startTime: number;
  private eventCount: number = 0;

  constructor(config: Partial<AnalyticsConfig> = {}) {
    this.config = {
      enabled: true,
      bufferSize: 10,
      debug: false,
      privacyMode: true,
      sampleRate: 1.0,
      ...config
    };

    this.sessionId = this.generateSessionId();
    this.startTime = performance.now();

    // Bind methods
    this.flush = this.flush.bind(this);

    // Auto-flush on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.flush);
      window.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    }
  }

  /**
   * Track an interaction event
   */
  track(type: string, data: Record<string, any> = {}): void {
    if (!this.config.enabled || Math.random() > this.config.sampleRate) {
      return;
    }

    const event: InteractionEvent = {
      type,
      action: data.action || 'unknown',
      timestamp: Date.now(),
      sessionId: this.sessionId,
      data: this.sanitizeData(data),
      performance: this.getPerformanceMetrics(),
      accessibility: this.getAccessibilityContext()
    };

    this.eventBuffer.push(event);
    this.eventCount++;

    if (this.config.debug) {
      console.log('Analytics Event:', event);
    }

    // Auto-flush if buffer is full
    if (this.eventBuffer.length >= this.config.bufferSize) {
      this.flush();
    }
  }

  /**
   * Track keyboard navigation events
   */
  trackKeyboardNavigation(action: string, data: Record<string, any> = {}): void {
    this.track('keyboard_navigation', {
      action,
      ...data,
      inputMethod: 'keyboard'
    });
  }

  /**
   * Track touch gesture events
   */
  trackTouchGesture(action: string, data: Record<string, any> = {}): void {
    this.track('touch_gesture', {
      action,
      ...data,
      inputMethod: 'touch'
    });
  }

  /**
   * Track voice navigation events
   */
  trackVoiceNavigation(action: string, data: Record<string, any> = {}): void {
    this.track('voice_navigation', {
      action,
      ...data,
      inputMethod: 'voice'
    });
  }

  /**
   * Track search interactions
   */
  trackSearchInteraction(action: string, data: Record<string, any> = {}): void {
    this.track('search_interaction', {
      action,
      ...data
    });
  }

  /**
   * Track result interactions
   */
  trackResultInteraction(action: string, data: Record<string, any> = {}): void {
    this.track('result_interaction', {
      action,
      ...data
    });
  }

  /**
   * Track accessibility events
   */
  trackAccessibility(action: string, data: Record<string, any> = {}): void {
    this.track('accessibility', {
      action,
      ...data
    });
  }

  /**
   * Track performance metrics
   */
  trackPerformance(action: string, data: Record<string, any> = {}): void {
    this.track('performance', {
      action,
      ...data,
      sessionDuration: performance.now() - this.startTime
    });
  }

  /**
   * Track user preferences
   */
  trackPreferences(action: string, data: Record<string, any> = {}): void {
    this.track('user_preferences', {
      action,
      ...data
    });
  }

  /**
   * Flush events to storage/endpoint
   */
  flush(): void {
    if (this.eventBuffer.length === 0) return;

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    if (this.config.endpoint) {
      this.sendToEndpoint(events);
    } else {
      this.storeLocally(events);
    }

    if (this.config.debug) {
      console.log(`Flushed ${events.length} analytics events`);
    }
  }

  /**
   * Get analytics summary
   */
  getSummary(): {
    sessionId: string;
    eventCount: number;
    sessionDuration: number;
    topEvents: Array<{ type: string; count: number }>;
  } {
    const sessionDuration = performance.now() - this.startTime;

    // Get event counts from localStorage
    const storedEvents = this.getStoredEvents();
    const eventCounts = new Map<string, number>();

    storedEvents.forEach(event => {
      const count = eventCounts.get(event.type) || 0;
      eventCounts.set(event.type, count + 1);
    });

    const topEvents = Array.from(eventCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      sessionId: this.sessionId,
      eventCount: this.eventCount,
      sessionDuration,
      topEvents
    };
  }

  /**
   * Clear analytics data
   */
  clear(): void {
    this.eventBuffer = [];
    this.eventCount = 0;
    localStorage.removeItem('interaction_analytics');
  }

  /**
   * Export analytics data
   */
  export(): {
    config: AnalyticsConfig;
    summary: ReturnType<typeof this.getSummary>;
    events: InteractionEvent[];
  } {
    return {
      config: this.config,
      summary: this.getSummary(),
      events: this.getStoredEvents()
    };
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeData(data: Record<string, any>): Record<string, any> {
    if (!this.config.privacyMode) return data;

    // Remove potentially sensitive data in privacy mode
    const sanitized = { ...data };
    const sensitiveKeys = ['email', 'username', 'password', 'token', 'api_key', 'personal'];

    sensitiveKeys.forEach(key => {
      if (key in sanitized) {
        delete sanitized[key];
      }
    });

    // Truncate long text values
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'string' && sanitized[key].length > 100) {
        sanitized[key] = sanitized[key].substring(0, 100) + '...';
      }
    });

    return sanitized;
  }

  private getPerformanceMetrics(): InteractionEvent['performance'] {
    if (typeof window === 'undefined' || !window.performance) return undefined;

    return {
      memory: (performance as any).memory ? (performance as any).memory.usedJSHeapSize : undefined,
      responseTime: performance.now() - this.startTime
    };
  }

  private getAccessibilityContext(): InteractionEvent['accessibility'] {
    if (typeof window === 'undefined') return undefined;

    return {
      screenReader: this.detectScreenReader(),
      keyboardOnly: this.detectKeyboardOnly(),
      voiceNavigation: this.detectVoiceNavigation(),
      highContrast: window.matchMedia('(prefers-contrast: high)').matches,
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
    };
  }

  private detectScreenReader(): boolean {
    // Basic screen reader detection heuristics
    return !!(
      window.navigator.userAgent.includes('NVDA') ||
      window.navigator.userAgent.includes('JAWS') ||
      window.speechSynthesis ||
      document.querySelector('[aria-label]')
    );
  }

  private detectKeyboardOnly(): boolean {
    // Check if user is primarily using keyboard
    return document.activeElement !== document.body;
  }

  private detectVoiceNavigation(): boolean {
    // Check for voice navigation features
    return !!(
      'webkitSpeechRecognition' in window ||
      'SpeechRecognition' in window
    );
  }

  private async sendToEndpoint(events: InteractionEvent[]): Promise<void> {
    if (!this.config.endpoint) return;

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          events,
          timestamp: Date.now()
        })
      });

      if (!response.ok) {
        throw new Error(`Analytics endpoint error: ${response.status}`);
      }

      if (this.config.debug) {
        console.log('Analytics events sent successfully');
      }
    } catch (error) {
      console.error('Failed to send analytics events:', error);
      // Fall back to local storage
      this.storeLocally(events);
    }
  }

  private storeLocally(events: InteractionEvent[]): void {
    try {
      const existingEvents = this.getStoredEvents();
      const allEvents = [...existingEvents, ...events];

      // Keep only last 1000 events to prevent storage overflow
      const recentEvents = allEvents.slice(-1000);

      localStorage.setItem('interaction_analytics', JSON.stringify(recentEvents));
    } catch (error) {
      console.error('Failed to store analytics events locally:', error);
    }
  }

  private getStoredEvents(): InteractionEvent[] {
    try {
      const stored = localStorage.getItem('interaction_analytics');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to retrieve stored analytics events:', error);
      return [];
    }
  }

  private handleVisibilityChange(): void {
    if (document.visibilityState === 'hidden') {
      this.flush();
    }
  }
}

// Global analytics instance
const analytics = new InteractionAnalytics();

/**
 * Track an interaction event
 */
export function trackInteraction(type: string, data: Record<string, any> = {}): void {
  analytics.track(type, data);
}

/**
 * Configure analytics
 */
export function configureAnalytics(config: Partial<AnalyticsConfig>): void {
  Object.assign(analytics['config'], config);
}

/**
 * Get analytics summary
 */
export function getAnalyticsSummary() {
  return analytics.getSummary();
}

/**
 * Export analytics data
 */
export function exportAnalyticsData() {
  return analytics.export();
}

/**
 * Clear analytics data
 */
export function clearAnalyticsData(): void {
  analytics.clear();
}

/**
 * Flush pending events
 */
export function flushAnalytics(): void {
  analytics.flush();
}

// Named exports for specific tracking functions
export const trackKeyboardNavigation = analytics.trackKeyboardNavigation.bind(analytics);
export const trackTouchGesture = analytics.trackTouchGesture.bind(analytics);
export const trackVoiceNavigation = analytics.trackVoiceNavigation.bind(analytics);
export const trackSearchInteraction = analytics.trackSearchInteraction.bind(analytics);
export const trackResultInteraction = analytics.trackResultInteraction.bind(analytics);
export const trackAccessibility = analytics.trackAccessibility.bind(analytics);
export const trackPerformance = analytics.trackPerformance.bind(analytics);
export const trackPreferences = analytics.trackPreferences.bind(analytics);

export default analytics;