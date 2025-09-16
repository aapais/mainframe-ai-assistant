/**
 * ResultEffectivenessTracker - Comprehensive CTR and engagement metrics tracking
 * Tracks click-through rates, user engagement, and result effectiveness
 */

import { EventEmitter } from 'events';

export interface ClickEvent {
  id: string;
  userId: string;
  sessionId: string;
  resultId: string;
  resultPosition: number;
  query: string;
  timestamp: number;
  resultType: 'knowledge' | 'web' | 'mixed';
  clickType: 'primary' | 'secondary' | 'preview';
  timeToClick: number; // ms from result display
  viewport: {
    width: number;
    height: number;
    scrollY: number;
  };
  metadata?: Record<string, any>;
}

export interface ImpressionEvent {
  id: string;
  userId: string;
  sessionId: string;
  resultIds: string[];
  query: string;
  timestamp: number;
  totalResults: number;
  visibleResults: number;
  searchType: 'instant' | 'full' | 'refined';
  loadTime: number; // ms
  viewport: {
    width: number;
    height: number;
  };
}

export interface EngagementEvent {
  id: string;
  userId: string;
  sessionId: string;
  resultId: string;
  eventType: 'hover' | 'scroll' | 'copy' | 'share' | 'bookmark';
  timestamp: number;
  duration?: number;
  data?: Record<string, any>;
}

export interface CTRMetrics {
  overall: number;
  byPosition: Record<number, number>;
  byResultType: Record<string, number>;
  byTimeRange: Record<string, number>;
  confidence: number;
  sampleSize: number;
}

export interface EngagementMetrics {
  averageTimeOnResults: number;
  bounceRate: number;
  interactionRate: number;
  deepEngagementRate: number;
  conversionRate: number;
  returnUserRate: number;
}

export interface PositionAnalysis {
  position: number;
  impressions: number;
  clicks: number;
  ctr: number;
  averageTimeToClick: number;
  engagementScore: number;
}

export class ResultEffectivenessTracker extends EventEmitter {
  private clickEvents: Map<string, ClickEvent[]> = new Map();
  private impressionEvents: Map<string, ImpressionEvent[]> = new Map();
  private engagementEvents: Map<string, EngagementEvent[]> = new Map();
  private sessionData: Map<string, any> = new Map();
  private metricsCache: Map<string, any> = new Map();
  private cacheExpiry: number = 5 * 60 * 1000; // 5 minutes

  constructor() {
    super();
    this.startPeriodicAnalysis();
  }

  /**
   * Track a click event
   */
  trackClick(clickEvent: Omit<ClickEvent, 'id' | 'timestamp'>): string {
    const event: ClickEvent = {
      ...clickEvent,
      id: this.generateEventId(),
      timestamp: Date.now()
    };

    if (!this.clickEvents.has(event.sessionId)) {
      this.clickEvents.set(event.sessionId, []);
    }
    this.clickEvents.get(event.sessionId)!.push(event);

    this.invalidateCache();
    this.emit('click', event);

    return event.id;
  }

  /**
   * Track an impression event
   */
  trackImpression(impressionEvent: Omit<ImpressionEvent, 'id' | 'timestamp'>): string {
    const event: ImpressionEvent = {
      ...impressionEvent,
      id: this.generateEventId(),
      timestamp: Date.now()
    };

    if (!this.impressionEvents.has(event.sessionId)) {
      this.impressionEvents.set(event.sessionId, []);
    }
    this.impressionEvents.get(event.sessionId)!.push(event);

    this.invalidateCache();
    this.emit('impression', event);

    return event.id;
  }

  /**
   * Track an engagement event
   */
  trackEngagement(engagementEvent: Omit<EngagementEvent, 'id' | 'timestamp'>): string {
    const event: EngagementEvent = {
      ...engagementEvent,
      id: this.generateEventId(),
      timestamp: Date.now()
    };

    if (!this.engagementEvents.has(event.sessionId)) {
      this.engagementEvents.set(event.sessionId, []);
    }
    this.engagementEvents.get(event.sessionId)!.push(event);

    this.invalidateCache();
    this.emit('engagement', event);

    return event.id;
  }

  /**
   * Calculate overall CTR metrics
   */
  async calculateCTRMetrics(filters?: {
    timeRange?: [number, number];
    resultType?: string;
    userId?: string;
  }): Promise<CTRMetrics> {
    const cacheKey = `ctr_metrics_${JSON.stringify(filters)}`;
    const cached = this.getCachedMetrics(cacheKey);
    if (cached) return cached;

    const { clicks, impressions } = this.getFilteredEvents(filters);

    const totalImpressions = impressions.reduce((sum, imp) => sum + imp.totalResults, 0);
    const totalClicks = clicks.length;

    const overall = totalImpressions > 0 ? totalClicks / totalImpressions : 0;

    // CTR by position
    const byPosition: Record<number, number> = {};
    const positionStats = this.calculatePositionStats(clicks, impressions);

    positionStats.forEach(stat => {
      byPosition[stat.position] = stat.ctr;
    });

    // CTR by result type
    const byResultType: Record<string, number> = {};
    const typeGroups = this.groupBy(clicks, 'resultType');

    Object.keys(typeGroups).forEach(type => {
      const typeClicks = typeGroups[type].length;
      const typeImpressions = impressions.filter(imp =>
        clicks.some(click => click.resultType === type)
      ).length;
      byResultType[type] = typeImpressions > 0 ? typeClicks / typeImpressions : 0;
    });

    // CTR by time range (hourly)
    const byTimeRange: Record<string, number> = {};
    const hourlyData = this.groupByTimeRange(clicks, impressions, 'hour');

    Object.keys(hourlyData).forEach(hour => {
      const { clicks: hourClicks, impressions: hourImpressions } = hourlyData[hour];
      byTimeRange[hour] = hourImpressions > 0 ? hourClicks / hourImpressions : 0;
    });

    const confidence = this.calculateConfidenceLevel(totalClicks, totalImpressions);

    const metrics: CTRMetrics = {
      overall,
      byPosition,
      byResultType,
      byTimeRange,
      confidence,
      sampleSize: totalImpressions
    };

    this.setCachedMetrics(cacheKey, metrics);
    return metrics;
  }

  /**
   * Calculate engagement metrics
   */
  async calculateEngagementMetrics(filters?: {
    timeRange?: [number, number];
    userId?: string;
  }): Promise<EngagementMetrics> {
    const cacheKey = `engagement_metrics_${JSON.stringify(filters)}`;
    const cached = this.getCachedMetrics(cacheKey);
    if (cached) return cached;

    const { clicks, impressions, engagements } = this.getFilteredEvents(filters);

    // Average time on results (for clicked results)
    const timeOnResults = clicks
      .filter(click => click.timeToClick)
      .map(click => click.timeToClick);

    const averageTimeOnResults = timeOnResults.length > 0
      ? timeOnResults.reduce((sum, time) => sum + time, 0) / timeOnResults.length
      : 0;

    // Bounce rate (sessions with no clicks)
    const sessionIds = new Set([
      ...impressions.map(imp => imp.sessionId),
      ...clicks.map(click => click.sessionId)
    ]);

    const sessionsWithClicks = new Set(clicks.map(click => click.sessionId));
    const bounceRate = (sessionIds.size - sessionsWithClicks.size) / sessionIds.size;

    // Interaction rate (sessions with any engagement)
    const sessionsWithEngagement = new Set(engagements.map(eng => eng.sessionId));
    const interactionRate = sessionsWithEngagement.size / sessionIds.size;

    // Deep engagement rate (multiple interactions or long duration)
    const deepEngagementSessions = new Set();
    const sessionEngagements = this.groupBy(engagements, 'sessionId');

    Object.keys(sessionEngagements).forEach(sessionId => {
      const sessionEvents = sessionEngagements[sessionId];
      const hasMultipleInteractions = sessionEvents.length > 2;
      const hasLongDuration = sessionEvents.some(event => (event.duration || 0) > 30000);

      if (hasMultipleInteractions || hasLongDuration) {
        deepEngagementSessions.add(sessionId);
      }
    });

    const deepEngagementRate = deepEngagementSessions.size / sessionIds.size;

    // Conversion rate (placeholder - would integrate with actual conversion tracking)
    const conversionRate = this.calculateConversionRate(clicks);

    // Return user rate
    const returnUserRate = this.calculateReturnUserRate();

    const metrics: EngagementMetrics = {
      averageTimeOnResults,
      bounceRate,
      interactionRate,
      deepEngagementRate,
      conversionRate,
      returnUserRate
    };

    this.setCachedMetrics(cacheKey, metrics);
    return metrics;
  }

  /**
   * Analyze position effectiveness
   */
  calculatePositionStats(clicks: ClickEvent[], impressions: ImpressionEvent[]): PositionAnalysis[] {
    const positionData: Map<number, {
      impressions: number;
      clicks: number;
      totalTimeToClick: number;
      engagementScore: number;
    }> = new Map();

    // Count impressions by position
    impressions.forEach(impression => {
      for (let i = 1; i <= impression.visibleResults; i++) {
        if (!positionData.has(i)) {
          positionData.set(i, {
            impressions: 0,
            clicks: 0,
            totalTimeToClick: 0,
            engagementScore: 0
          });
        }
        positionData.get(i)!.impressions++;
      }
    });

    // Count clicks by position
    clicks.forEach(click => {
      const position = click.resultPosition;
      if (positionData.has(position)) {
        const data = positionData.get(position)!;
        data.clicks++;
        data.totalTimeToClick += click.timeToClick;
      }
    });

    // Calculate metrics for each position
    return Array.from(positionData.entries()).map(([position, data]) => ({
      position,
      impressions: data.impressions,
      clicks: data.clicks,
      ctr: data.impressions > 0 ? data.clicks / data.impressions : 0,
      averageTimeToClick: data.clicks > 0 ? data.totalTimeToClick / data.clicks : 0,
      engagementScore: this.calculatePositionEngagementScore(position, data)
    }));
  }

  /**
   * Get real-time effectiveness dashboard data
   */
  async getDashboardData(): Promise<{
    realtimeMetrics: {
      currentCTR: number;
      activeUsers: number;
      totalClicks: number;
      totalImpressions: number;
    };
    trends: {
      ctrTrend: Array<{ time: string; value: number }>;
      engagementTrend: Array<{ time: string; value: number }>;
    };
    topPerforming: {
      positions: PositionAnalysis[];
      queries: Array<{ query: string; ctr: number; volume: number }>;
    };
    alerts: Array<{
      type: 'warning' | 'info' | 'error';
      message: string;
      timestamp: number;
    }>;
  }> {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);

    const recentFilters = { timeRange: [oneHourAgo, now] as [number, number] };

    const [ctrMetrics, engagementMetrics] = await Promise.all([
      this.calculateCTRMetrics(recentFilters),
      this.calculateEngagementMetrics(recentFilters)
    ]);

    const recentEvents = this.getFilteredEvents(recentFilters);

    const realtimeMetrics = {
      currentCTR: ctrMetrics.overall,
      activeUsers: new Set([
        ...recentEvents.clicks.map(c => c.userId),
        ...recentEvents.impressions.map(i => i.userId)
      ]).size,
      totalClicks: recentEvents.clicks.length,
      totalImpressions: recentEvents.impressions.reduce((sum, imp) => sum + imp.totalResults, 0)
    };

    const trends = {
      ctrTrend: this.generateTimeTrend('ctr', 24), // 24 hours
      engagementTrend: this.generateTimeTrend('engagement', 24)
    };

    const positionStats = this.calculatePositionStats(recentEvents.clicks, recentEvents.impressions);
    const topQueries = this.getTopQueries(recentEvents.clicks, recentEvents.impressions);

    const topPerforming = {
      positions: positionStats.sort((a, b) => b.ctr - a.ctr).slice(0, 10),
      queries: topQueries.slice(0, 10)
    };

    const alerts = this.generateAlerts(ctrMetrics, engagementMetrics);

    return {
      realtimeMetrics,
      trends,
      topPerforming,
      alerts
    };
  }

  // Private helper methods

  private getFilteredEvents(filters?: {
    timeRange?: [number, number];
    resultType?: string;
    userId?: string;
  }) {
    let clicks: ClickEvent[] = [];
    let impressions: ImpressionEvent[] = [];
    let engagements: EngagementEvent[] = [];

    // Collect all events
    this.clickEvents.forEach(events => clicks.push(...events));
    this.impressionEvents.forEach(events => impressions.push(...events));
    this.engagementEvents.forEach(events => engagements.push(...events));

    // Apply filters
    if (filters) {
      if (filters.timeRange) {
        const [start, end] = filters.timeRange;
        clicks = clicks.filter(event => event.timestamp >= start && event.timestamp <= end);
        impressions = impressions.filter(event => event.timestamp >= start && event.timestamp <= end);
        engagements = engagements.filter(event => event.timestamp >= start && event.timestamp <= end);
      }

      if (filters.resultType) {
        clicks = clicks.filter(event => event.resultType === filters.resultType);
      }

      if (filters.userId) {
        clicks = clicks.filter(event => event.userId === filters.userId);
        impressions = impressions.filter(event => event.userId === filters.userId);
        engagements = engagements.filter(event => event.userId === filters.userId);
      }
    }

    return { clicks, impressions, engagements };
  }

  private calculateConfidenceLevel(clicks: number, impressions: number): number {
    if (impressions < 30) return 0.5; // Low confidence
    if (impressions < 100) return 0.7; // Medium confidence
    if (impressions < 1000) return 0.85; // Good confidence
    return 0.95; // High confidence
  }

  private calculatePositionEngagementScore(position: number, data: any): number {
    // Simple engagement score based on position and performance
    const positionWeight = Math.max(0, (11 - position) / 10); // Higher positions get higher weight
    const performanceScore = data.clicks / Math.max(1, data.impressions);
    return positionWeight * performanceScore;
  }

  private calculateConversionRate(clicks: ClickEvent[]): number {
    // Placeholder implementation - would integrate with actual conversion tracking
    // This could track specific actions like downloads, purchases, etc.
    return 0.15; // 15% default conversion rate
  }

  private calculateReturnUserRate(): number {
    const allUserSessions = new Map<string, Set<string>>();

    // Collect all sessions per user
    [this.clickEvents, this.impressionEvents, this.engagementEvents].forEach(eventMap => {
      eventMap.forEach((events, sessionId) => {
        events.forEach(event => {
          if (!allUserSessions.has(event.userId)) {
            allUserSessions.set(event.userId, new Set());
          }
          allUserSessions.get(event.userId)!.add(sessionId);
        });
      });
    });

    // Calculate return rate
    const returnUsers = Array.from(allUserSessions.values()).filter(sessions => sessions.size > 1).length;
    const totalUsers = allUserSessions.size;

    return totalUsers > 0 ? returnUsers / totalUsers : 0;
  }

  private groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce((groups, item) => {
      const groupKey = String(item[key]);
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }

  private groupByTimeRange(
    clicks: ClickEvent[],
    impressions: ImpressionEvent[],
    granularity: 'hour' | 'day'
  ): Record<string, { clicks: number; impressions: number }> {
    const data: Record<string, { clicks: number; impressions: number }> = {};

    const getTimeKey = (timestamp: number): string => {
      const date = new Date(timestamp);
      if (granularity === 'hour') {
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
      }
      return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    };

    clicks.forEach(click => {
      const key = getTimeKey(click.timestamp);
      if (!data[key]) data[key] = { clicks: 0, impressions: 0 };
      data[key].clicks++;
    });

    impressions.forEach(impression => {
      const key = getTimeKey(impression.timestamp);
      if (!data[key]) data[key] = { clicks: 0, impressions: 0 };
      data[key].impressions += impression.totalResults;
    });

    return data;
  }

  private generateTimeTrend(metric: 'ctr' | 'engagement', hours: number): Array<{ time: string; value: number }> {
    const now = Date.now();
    const trend: Array<{ time: string; value: number }> = [];

    for (let i = hours; i >= 0; i--) {
      const time = now - (i * 60 * 60 * 1000);
      const timeKey = new Date(time).toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM

      // Calculate metric for this hour
      const hourData = this.getFilteredEvents({
        timeRange: [time - 3600000, time] // 1 hour window
      });

      let value = 0;
      if (metric === 'ctr') {
        const totalImpressions = hourData.impressions.reduce((sum, imp) => sum + imp.totalResults, 0);
        value = totalImpressions > 0 ? hourData.clicks.length / totalImpressions : 0;
      } else {
        const sessions = new Set([...hourData.clicks.map(c => c.sessionId), ...hourData.impressions.map(i => i.sessionId)]);
        const engagedSessions = new Set(hourData.engagements.map(e => e.sessionId));
        value = sessions.size > 0 ? engagedSessions.size / sessions.size : 0;
      }

      trend.push({ time: timeKey, value });
    }

    return trend;
  }

  private getTopQueries(clicks: ClickEvent[], impressions: ImpressionEvent[]): Array<{ query: string; ctr: number; volume: number }> {
    const queryStats: Map<string, { clicks: number; impressions: number }> = new Map();

    clicks.forEach(click => {
      if (!queryStats.has(click.query)) {
        queryStats.set(click.query, { clicks: 0, impressions: 0 });
      }
      queryStats.get(click.query)!.clicks++;
    });

    impressions.forEach(impression => {
      if (!queryStats.has(impression.query)) {
        queryStats.set(impression.query, { clicks: 0, impressions: 0 });
      }
      queryStats.get(impression.query)!.impressions += impression.totalResults;
    });

    return Array.from(queryStats.entries())
      .map(([query, stats]) => ({
        query,
        ctr: stats.impressions > 0 ? stats.clicks / stats.impressions : 0,
        volume: stats.impressions
      }))
      .sort((a, b) => b.ctr - a.ctr);
  }

  private generateAlerts(ctrMetrics: CTRMetrics, engagementMetrics: EngagementMetrics): Array<{
    type: 'warning' | 'info' | 'error';
    message: string;
    timestamp: number;
  }> {
    const alerts: Array<{ type: 'warning' | 'info' | 'error'; message: string; timestamp: number }> = [];
    const now = Date.now();

    // CTR alerts
    if (ctrMetrics.overall < 0.05) {
      alerts.push({
        type: 'warning',
        message: `Low CTR detected: ${(ctrMetrics.overall * 100).toFixed(2)}%`,
        timestamp: now
      });
    }

    if (ctrMetrics.confidence < 0.7) {
      alerts.push({
        type: 'info',
        message: `Low confidence in CTR metrics (${(ctrMetrics.confidence * 100).toFixed(1)}%) - need more data`,
        timestamp: now
      });
    }

    // Engagement alerts
    if (engagementMetrics.bounceRate > 0.7) {
      alerts.push({
        type: 'error',
        message: `High bounce rate: ${(engagementMetrics.bounceRate * 100).toFixed(1)}%`,
        timestamp: now
      });
    }

    if (engagementMetrics.interactionRate < 0.3) {
      alerts.push({
        type: 'warning',
        message: `Low interaction rate: ${(engagementMetrics.interactionRate * 100).toFixed(1)}%`,
        timestamp: now
      });
    }

    return alerts;
  }

  private getCachedMetrics(key: string): any | null {
    const cached = this.metricsCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }
    return null;
  }

  private setCachedMetrics(key: string, data: any): void {
    this.metricsCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  private invalidateCache(): void {
    this.metricsCache.clear();
  }

  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private startPeriodicAnalysis(): void {
    setInterval(() => {
      this.emit('periodicAnalysis', {
        timestamp: Date.now(),
        summary: 'Periodic analysis completed'
      });
    }, 5 * 60 * 1000); // Every 5 minutes
  }
}