/**
 * Search Analytics Service - Privacy-Aware Search Intelligence
 *
 * Features:
 * - Anonymous analytics tracking with privacy protection
 * - Search performance metrics and insights
 * - User behavior analysis without PII
 * - Failed search detection and optimization recommendations
 * - Real-time search quality monitoring
 * - Configurable data retention and cleanup
 *
 * @author Search Intelligence Agent
 * @version 1.0.0
 */

export interface SearchEvent {
  id: string;
  timestamp: Date;
  sessionId: string; // Anonymous session identifier
  query: string; // Hashed for privacy in production
  queryLength: number;
  queryType: 'quick' | 'advanced' | 'ai' | 'filter';
  context?: string; // Page/section context
  category?: string;

  // Performance metrics
  executionTime: number;
  resultCount: number;
  cacheHit: boolean;
  aiUsed: boolean;

  // User interaction
  clicked: boolean;
  clickedPosition?: number; // Position of clicked result
  timeToClick?: number; // Time from search to click
  refinedQuery?: string; // If user refined the search

  // Success indicators
  successful: boolean;
  abandoned: boolean; // User left without clicking

  // Privacy-safe metadata
  userAgent?: string; // Browser type for compatibility
  viewport?: { width: number; height: number };
  locale?: string;
}

export interface SearchAnalytics {
  // Performance metrics
  totalSearches: number;
  avgExecutionTime: number;
  avgResultCount: number;
  cacheHitRate: number;
  aiUsageRate: number;

  // User behavior
  clickThroughRate: number;
  avgTimeToClick: number;
  queryRefinementRate: number;
  abandonmentRate: number;

  // Search quality
  successRate: number;
  duplicateSearchRate: number;
  zeroResultRate: number;

  // Patterns and trends
  popularCategories: Array<{ category: string; count: number; successRate: number }>;
  commonQueries: Array<{ query: string; count: number; avgResults: number }>;
  searchTrends: Array<{ period: string; count: number; avgPerformance: number }>;
  failurePatterns: Array<{ pattern: string; count: number; examples: string[] }>;

  // Time-based analytics
  hourlyDistribution: Array<{ hour: number; count: number; performance: number }>;
  weeklyTrends: Array<{ day: string; count: number; successRate: number }>;

  // Performance insights
  slowQueries: Array<{ query: string; avgTime: number; count: number }>;
  topPerformers: Array<{ query: string; successRate: number; clickRate: number }>;
}

export interface SearchOptimizationRecommendation {
  type: 'performance' | 'content' | 'user_experience' | 'search_quality';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  implementation: string;
  metrics: Record<string, number>;
}

interface AnalyticsOptions {
  enableTracking?: boolean;
  retentionDays?: number;
  maxEvents?: number;
  enableOptimizations?: boolean;
  hashQueries?: boolean; // Hash queries for privacy
  trackUserAgent?: boolean;
  sessionTimeout?: number; // Minutes for session expiry
}

const DEFAULT_OPTIONS: Required<AnalyticsOptions> = {
  enableTracking: true,
  retentionDays: 30,
  maxEvents: 10000,
  enableOptimizations: true,
  hashQueries: false, // Keep readable for internal analytics
  trackUserAgent: true,
  sessionTimeout: 30,
};

/**
 * Generate anonymous session ID
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Hash string for privacy (if enabled)
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

/**
 * Detect query patterns for failure analysis
 */
function categorizeQuery(query: string): string {
  const normalized = query.toLowerCase().trim();

  if (normalized.length <= 3) return 'short_query';
  if (normalized.length > 50) return 'long_query';
  if (/^[a-z]+\d+$/.test(normalized)) return 'error_code';
  if (/how to|tutorial|guide/.test(normalized)) return 'instructional';
  if (/error|fail|problem|issue/.test(normalized)) return 'troubleshooting';
  if (/^\w+$/.test(normalized)) return 'single_term';
  if (normalized.includes('"')) return 'exact_phrase';
  if (/\band\b|\bor\b|\bnot\b/.test(normalized)) return 'boolean_query';

  return 'general';
}

export class SearchAnalyticsService {
  private events: SearchEvent[] = [];
  private sessionId: string;
  private sessionStartTime: Date;
  private options: Required<AnalyticsOptions>;
  private storageKey = 'search-analytics-v2';

  constructor(options: AnalyticsOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.sessionId = generateSessionId();
    this.sessionStartTime = new Date();

    if (this.options.enableTracking) {
      this.loadStoredEvents();
      this.startSessionManagement();
    }
  }

  /**
   * Track a search event
   */
  trackSearch(params: {
    query: string;
    queryType?: SearchEvent['queryType'];
    context?: string;
    category?: string;
    executionTime: number;
    resultCount: number;
    cacheHit?: boolean;
    aiUsed?: boolean;
  }): string {
    if (!this.options.enableTracking) return '';

    const eventId = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const event: SearchEvent = {
      id: eventId,
      timestamp: new Date(),
      sessionId: this.sessionId,
      query: this.options.hashQueries ? hashString(params.query) : params.query,
      queryLength: params.query.length,
      queryType: params.queryType || 'quick',
      context: params.context,
      category: params.category,
      executionTime: params.executionTime,
      resultCount: params.resultCount,
      cacheHit: params.cacheHit || false,
      aiUsed: params.aiUsed || false,
      clicked: false,
      successful: params.resultCount > 0,
      abandoned: false,
      userAgent: this.options.trackUserAgent ? navigator.userAgent : undefined,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      locale: navigator.language,
    };

    this.events.push(event);
    this.cleanupOldEvents();
    this.saveEvents();

    return eventId;
  }

  /**
   * Track user interaction with search results
   */
  trackInteraction(
    eventId: string,
    params: {
      clicked: boolean;
      clickedPosition?: number;
      timeToClick?: number;
      refinedQuery?: string;
      abandoned?: boolean;
    }
  ): void {
    if (!this.options.enableTracking) return;

    const event = this.events.find(e => e.id === eventId);
    if (event) {
      event.clicked = params.clicked;
      event.clickedPosition = params.clickedPosition;
      event.timeToClick = params.timeToClick;
      event.refinedQuery = params.refinedQuery;
      event.abandoned = params.abandoned || false;
      event.successful = params.clicked || (event.resultCount > 0 && !params.abandoned);

      this.saveEvents();
    }
  }

  /**
   * Get comprehensive analytics
   */
  getAnalytics(timeRange?: { start: Date; end: Date }): SearchAnalytics {
    let filteredEvents = this.events;

    if (timeRange) {
      filteredEvents = this.events.filter(
        event => event.timestamp >= timeRange.start && event.timestamp <= timeRange.end
      );
    }

    if (filteredEvents.length === 0) {
      return this.getEmptyAnalytics();
    }

    const totalSearches = filteredEvents.length;
    const clickedEvents = filteredEvents.filter(e => e.clicked);
    const successfulEvents = filteredEvents.filter(e => e.successful);
    const abandonedEvents = filteredEvents.filter(e => e.abandoned);
    const refinedEvents = filteredEvents.filter(e => e.refinedQuery);
    const cacheHitEvents = filteredEvents.filter(e => e.cacheHit);
    const aiUsedEvents = filteredEvents.filter(e => e.aiUsed);
    const zeroResultEvents = filteredEvents.filter(e => e.resultCount === 0);

    // Performance metrics
    const avgExecutionTime =
      filteredEvents.reduce((sum, e) => sum + e.executionTime, 0) / totalSearches;
    const avgResultCount =
      filteredEvents.reduce((sum, e) => sum + e.resultCount, 0) / totalSearches;

    // User behavior
    const clickThroughRate = clickedEvents.length / totalSearches;
    const avgTimeToClick =
      clickedEvents.length > 0
        ? clickedEvents.reduce((sum, e) => sum + (e.timeToClick || 0), 0) / clickedEvents.length
        : 0;

    // Categories analysis
    const categoryMap = new Map<string, { count: number; successes: number }>();
    filteredEvents.forEach(event => {
      if (event.category) {
        const current = categoryMap.get(event.category) || { count: 0, successes: 0 };
        categoryMap.set(event.category, {
          count: current.count + 1,
          successes: current.successes + (event.successful ? 1 : 0),
        });
      }
    });

    const popularCategories = Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        count: data.count,
        successRate: data.successes / data.count,
      }))
      .sort((a, b) => b.count - a.count);

    // Query analysis
    const queryMap = new Map<string, { count: number; totalResults: number }>();
    filteredEvents.forEach(event => {
      const query = event.query;
      const current = queryMap.get(query) || { count: 0, totalResults: 0 };
      queryMap.set(query, {
        count: current.count + 1,
        totalResults: current.totalResults + event.resultCount,
      });
    });

    const commonQueries = Array.from(queryMap.entries())
      .filter(([_, data]) => data.count > 1)
      .map(([query, data]) => ({
        query,
        count: data.count,
        avgResults: data.totalResults / data.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Time-based analysis
    const hourlyMap = new Map<number, { count: number; totalTime: number }>();
    filteredEvents.forEach(event => {
      const hour = event.timestamp.getHours();
      const current = hourlyMap.get(hour) || { count: 0, totalTime: 0 };
      hourlyMap.set(hour, {
        count: current.count + 1,
        totalTime: current.totalTime + event.executionTime,
      });
    });

    const hourlyDistribution = Array.from({ length: 24 }, (_, hour) => {
      const data = hourlyMap.get(hour) || { count: 0, totalTime: 0 };
      return {
        hour,
        count: data.count,
        performance: data.count > 0 ? data.totalTime / data.count : 0,
      };
    });

    // Failure pattern analysis
    const failurePatterns = this.analyzeFailurePatterns(filteredEvents);

    // Performance insights
    const slowQueries = Array.from(queryMap.entries())
      .map(([query, data]) => {
        const events = filteredEvents.filter(e => e.query === query);
        const avgTime = events.reduce((sum, e) => sum + e.executionTime, 0) / events.length;
        return { query, avgTime, count: data.count };
      })
      .filter(item => item.avgTime > avgExecutionTime * 1.5)
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 10);

    const topPerformers = Array.from(queryMap.entries())
      .map(([query, data]) => {
        const events = filteredEvents.filter(e => e.query === query);
        const successCount = events.filter(e => e.successful).length;
        const clickCount = events.filter(e => e.clicked).length;
        return {
          query,
          successRate: successCount / events.length,
          clickRate: clickCount / events.length,
        };
      })
      .filter(item => item.successRate > 0.8 && queryMap.get(item.query)!.count > 2)
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 10);

    // Duplicate detection
    const duplicateSearches = filteredEvents.filter(event => {
      const sameQuery = filteredEvents.filter(
        e =>
          e.query === event.query &&
          e.sessionId === event.sessionId &&
          Math.abs(e.timestamp.getTime() - event.timestamp.getTime()) < 5 * 60 * 1000 // Within 5 minutes
      );
      return sameQuery.length > 1;
    });

    return {
      // Performance metrics
      totalSearches,
      avgExecutionTime: Math.round(avgExecutionTime),
      avgResultCount: Math.round(avgResultCount * 10) / 10,
      cacheHitRate: cacheHitEvents.length / totalSearches,
      aiUsageRate: aiUsedEvents.length / totalSearches,

      // User behavior
      clickThroughRate,
      avgTimeToClick: Math.round(avgTimeToClick),
      queryRefinementRate: refinedEvents.length / totalSearches,
      abandonmentRate: abandonedEvents.length / totalSearches,

      // Search quality
      successRate: successfulEvents.length / totalSearches,
      duplicateSearchRate: duplicateSearches.length / totalSearches,
      zeroResultRate: zeroResultEvents.length / totalSearches,

      // Patterns and trends
      popularCategories,
      commonQueries,
      searchTrends: this.calculateSearchTrends(filteredEvents),
      failurePatterns,

      // Time-based analytics
      hourlyDistribution,
      weeklyTrends: this.calculateWeeklyTrends(filteredEvents),

      // Performance insights
      slowQueries,
      topPerformers,
    };
  }

  /**
   * Get optimization recommendations based on analytics
   */
  getOptimizationRecommendations(): SearchOptimizationRecommendation[] {
    if (!this.options.enableOptimizations) return [];

    const analytics = this.getAnalytics();
    const recommendations: SearchOptimizationRecommendation[] = [];

    // Performance recommendations
    if (analytics.avgExecutionTime > 1000) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        title: 'Improve Search Performance',
        description: `Average search time is ${analytics.avgExecutionTime}ms, which exceeds the 1-second target.`,
        impact: 'Reduce user frustration and improve search experience',
        implementation:
          'Optimize database indexes, implement better caching, or reduce result set size',
        metrics: {
          currentAvgTime: analytics.avgExecutionTime,
          targetTime: 800,
          potentialImprovement: analytics.avgExecutionTime - 800,
        },
      });
    }

    if (analytics.cacheHitRate < 0.3) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        title: 'Improve Cache Utilization',
        description: `Cache hit rate is only ${(analytics.cacheHitRate * 100).toFixed(1)}%`,
        impact: 'Reduce server load and improve response times',
        implementation: 'Analyze common queries and implement predictive caching',
        metrics: {
          currentCacheRate: analytics.cacheHitRate,
          targetCacheRate: 0.5,
          potentialSpeedup: 1.5,
        },
      });
    }

    // User experience recommendations
    if (analytics.clickThroughRate < 0.6) {
      recommendations.push({
        type: 'user_experience',
        priority: 'high',
        title: 'Improve Search Relevance',
        description: `Click-through rate is ${(analytics.clickThroughRate * 100).toFixed(1)}%, indicating poor result relevance`,
        impact: 'Increase user satisfaction and task completion rates',
        implementation:
          'Improve ranking algorithm, add more contextual factors, or enhance result presentation',
        metrics: {
          currentCTR: analytics.clickThroughRate,
          targetCTR: 0.7,
          affectedSearches: Math.round(analytics.totalSearches * (1 - analytics.clickThroughRate)),
        },
      });
    }

    if (analytics.abandonmentRate > 0.3) {
      recommendations.push({
        type: 'user_experience',
        priority: 'medium',
        title: 'Reduce Search Abandonment',
        description: `${(analytics.abandonmentRate * 100).toFixed(1)}% of searches are abandoned without interaction`,
        impact: 'Improve user engagement and reduce search frustration',
        implementation:
          'Add search suggestions, improve zero-result handling, or provide search guidance',
        metrics: {
          currentAbandonmentRate: analytics.abandonmentRate,
          targetAbandonmentRate: 0.2,
          recoveredSearches: Math.round(
            analytics.totalSearches * (analytics.abandonmentRate - 0.2)
          ),
        },
      });
    }

    // Search quality recommendations
    if (analytics.zeroResultRate > 0.2) {
      recommendations.push({
        type: 'search_quality',
        priority: 'high',
        title: 'Reduce Zero-Result Searches',
        description: `${(analytics.zeroResultRate * 100).toFixed(1)}% of searches return no results`,
        impact: 'Improve search coverage and user satisfaction',
        implementation: 'Expand content index, implement fuzzy matching, or add query suggestions',
        metrics: {
          currentZeroResultRate: analytics.zeroResultRate,
          targetZeroResultRate: 0.1,
          affectedUsers: Math.round(analytics.totalSearches * analytics.zeroResultRate),
        },
      });
    }

    if (analytics.duplicateSearchRate > 0.25) {
      recommendations.push({
        type: 'user_experience',
        priority: 'medium',
        title: 'Reduce Duplicate Searches',
        description: `${(analytics.duplicateSearchRate * 100).toFixed(1)}% of searches are duplicates, indicating user confusion`,
        impact: 'Improve search efficiency and reduce server load',
        implementation:
          'Implement better search history, add query suggestions, or improve result presentation',
        metrics: {
          currentDuplicateRate: analytics.duplicateSearchRate,
          targetDuplicateRate: 0.15,
          wastedSearches: Math.round(analytics.totalSearches * analytics.duplicateSearchRate),
        },
      });
    }

    // Content recommendations
    if (analytics.aiUsageRate < 0.1 && analytics.successRate < 0.8) {
      recommendations.push({
        type: 'content',
        priority: 'medium',
        title: 'Promote AI-Enhanced Search',
        description: 'AI search usage is low but could improve success rates',
        impact: 'Improve search quality through better semantic understanding',
        implementation: 'Add AI search prompts, improve AI search visibility, or enable by default',
        metrics: {
          currentAIUsage: analytics.aiUsageRate,
          targetAIUsage: 0.3,
          potentialSuccessImprovement: 0.15,
        },
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Export analytics data
   */
  exportAnalytics(): string {
    const analytics = this.getAnalytics();
    const recommendations = this.getOptimizationRecommendations();

    const exportData = {
      version: '2.0',
      exportDate: new Date().toISOString(),
      sessionInfo: {
        sessionId: this.sessionId,
        sessionStart: this.sessionStartTime.toISOString(),
        totalEvents: this.events.length,
      },
      analytics,
      recommendations,
      summary: {
        dataQuality: this.assessDataQuality(),
        keyInsights: this.generateKeyInsights(analytics),
        actionItems: recommendations.filter(r => r.priority === 'high'),
      },
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Clear all analytics data
   */
  clearAnalytics(): void {
    this.events = [];
    this.saveEvents();
    this.sessionId = generateSessionId();
    this.sessionStartTime = new Date();
  }

  // Private methods

  private loadStoredEvents(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.events = parsed.map((event: any) => ({
          ...event,
          timestamp: new Date(event.timestamp),
        }));
        this.cleanupOldEvents();
      }
    } catch (error) {
      console.warn('Failed to load search analytics:', error);
      this.events = [];
    }
  }

  private saveEvents(): void {
    try {
      const serializable = this.events.map(event => ({
        ...event,
        timestamp: event.timestamp.toISOString(),
      }));
      localStorage.setItem(this.storageKey, JSON.stringify(serializable));
    } catch (error) {
      console.warn('Failed to save search analytics:', error);
    }
  }

  private cleanupOldEvents(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.options.retentionDays);

    this.events = this.events
      .filter(event => event.timestamp > cutoffDate)
      .slice(-this.options.maxEvents);
  }

  private startSessionManagement(): void {
    // Check for session timeout
    setInterval(() => {
      const sessionAge = Date.now() - this.sessionStartTime.getTime();
      const sessionTimeoutMs = this.options.sessionTimeout * 60 * 1000;

      if (sessionAge > sessionTimeoutMs) {
        this.sessionId = generateSessionId();
        this.sessionStartTime = new Date();
      }
    }, 60000); // Check every minute
  }

  private analyzeFailurePatterns(
    events: SearchEvent[]
  ): Array<{ pattern: string; count: number; examples: string[] }> {
    const patternMap = new Map<string, string[]>();

    events
      .filter(e => !e.successful)
      .forEach(event => {
        const pattern = categorizeQuery(event.query);
        if (!patternMap.has(pattern)) {
          patternMap.set(pattern, []);
        }
        patternMap.get(pattern)!.push(event.query);
      });

    return Array.from(patternMap.entries())
      .map(([pattern, queries]) => ({
        pattern,
        count: queries.length,
        examples: [...new Set(queries)].slice(0, 5), // Unique examples, max 5
      }))
      .sort((a, b) => b.count - a.count);
  }

  private calculateSearchTrends(
    events: SearchEvent[]
  ): Array<{ period: string; count: number; avgPerformance: number }> {
    const trendMap = new Map<string, { count: number; totalTime: number }>();

    events.forEach(event => {
      const period = event.timestamp.toISOString().substr(0, 10); // YYYY-MM-DD
      const current = trendMap.get(period) || { count: 0, totalTime: 0 };
      trendMap.set(period, {
        count: current.count + 1,
        totalTime: current.totalTime + event.executionTime,
      });
    });

    return Array.from(trendMap.entries())
      .map(([period, data]) => ({
        period,
        count: data.count,
        avgPerformance: data.totalTime / data.count,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  private calculateWeeklyTrends(
    events: SearchEvent[]
  ): Array<{ day: string; count: number; successRate: number }> {
    const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekMap = new Map<number, { count: number; successes: number }>();

    events.forEach(event => {
      const dayOfWeek = event.timestamp.getDay();
      const current = weekMap.get(dayOfWeek) || { count: 0, successes: 0 };
      weekMap.set(dayOfWeek, {
        count: current.count + 1,
        successes: current.successes + (event.successful ? 1 : 0),
      });
    });

    return weekDays.map((day, index) => {
      const data = weekMap.get(index) || { count: 0, successes: 0 };
      return {
        day,
        count: data.count,
        successRate: data.count > 0 ? data.successes / data.count : 0,
      };
    });
  }

  private getEmptyAnalytics(): SearchAnalytics {
    return {
      totalSearches: 0,
      avgExecutionTime: 0,
      avgResultCount: 0,
      cacheHitRate: 0,
      aiUsageRate: 0,
      clickThroughRate: 0,
      avgTimeToClick: 0,
      queryRefinementRate: 0,
      abandonmentRate: 0,
      successRate: 0,
      duplicateSearchRate: 0,
      zeroResultRate: 0,
      popularCategories: [],
      commonQueries: [],
      searchTrends: [],
      failurePatterns: [],
      hourlyDistribution: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        count: 0,
        performance: 0,
      })),
      weeklyTrends: [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ].map(day => ({ day, count: 0, successRate: 0 })),
      slowQueries: [],
      topPerformers: [],
    };
  }

  private assessDataQuality(): { score: number; issues: string[] } {
    const issues: string[] = [];
    let score = 100;

    if (this.events.length < 10) {
      issues.push('Insufficient data for reliable analysis');
      score -= 30;
    }

    const recentEvents = this.events.filter(
      e => Date.now() - e.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000
    );

    if (recentEvents.length / this.events.length < 0.3) {
      issues.push('Most data is outdated');
      score -= 20;
    }

    const clickedEvents = this.events.filter(e => e.clicked);
    if (clickedEvents.length / this.events.length < 0.1) {
      issues.push('Low interaction tracking');
      score -= 15;
    }

    return { score: Math.max(0, score), issues };
  }

  private generateKeyInsights(analytics: SearchAnalytics): string[] {
    const insights: string[] = [];

    if (analytics.successRate > 0.9) {
      insights.push('Excellent search success rate indicates good content coverage');
    } else if (analytics.successRate < 0.6) {
      insights.push('Low success rate suggests content gaps or relevance issues');
    }

    if (analytics.clickThroughRate > 0.8) {
      insights.push('High click-through rate shows good result relevance');
    } else if (analytics.clickThroughRate < 0.4) {
      insights.push('Low click-through rate indicates poor result ranking or presentation');
    }

    if (analytics.avgExecutionTime < 500) {
      insights.push('Fast search performance enhances user experience');
    } else if (analytics.avgExecutionTime > 2000) {
      insights.push('Slow search performance may frustrate users');
    }

    if (analytics.aiUsageRate > 0.5) {
      insights.push('High AI usage indicates user trust in advanced search features');
    } else if (analytics.aiUsageRate < 0.1) {
      insights.push('Low AI usage suggests need for better feature promotion or UX');
    }

    return insights;
  }
}
