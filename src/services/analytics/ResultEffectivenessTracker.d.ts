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
  timeToClick: number;
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
  loadTime: number;
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
export declare class ResultEffectivenessTracker extends EventEmitter {
  private clickEvents;
  private impressionEvents;
  private engagementEvents;
  private sessionData;
  private metricsCache;
  private cacheExpiry;
  constructor();
  trackClick(clickEvent: Omit<ClickEvent, 'id' | 'timestamp'>): string;
  trackImpression(impressionEvent: Omit<ImpressionEvent, 'id' | 'timestamp'>): string;
  trackEngagement(engagementEvent: Omit<EngagementEvent, 'id' | 'timestamp'>): string;
  calculateCTRMetrics(filters?: {
    timeRange?: [number, number];
    resultType?: string;
    userId?: string;
  }): Promise<CTRMetrics>;
  calculateEngagementMetrics(filters?: {
    timeRange?: [number, number];
    userId?: string;
  }): Promise<EngagementMetrics>;
  calculatePositionStats(clicks: ClickEvent[], impressions: ImpressionEvent[]): PositionAnalysis[];
  getDashboardData(): Promise<{
    realtimeMetrics: {
      currentCTR: number;
      activeUsers: number;
      totalClicks: number;
      totalImpressions: number;
    };
    trends: {
      ctrTrend: Array<{
        time: string;
        value: number;
      }>;
      engagementTrend: Array<{
        time: string;
        value: number;
      }>;
    };
    topPerforming: {
      positions: PositionAnalysis[];
      queries: Array<{
        query: string;
        ctr: number;
        volume: number;
      }>;
    };
    alerts: Array<{
      type: 'warning' | 'info' | 'error';
      message: string;
      timestamp: number;
    }>;
  }>;
  private getFilteredEvents;
  private calculateConfidenceLevel;
  private calculatePositionEngagementScore;
  private calculateConversionRate;
  private calculateReturnUserRate;
  private groupBy;
  private groupByTimeRange;
  private generateTimeTrend;
  private getTopQueries;
  private generateAlerts;
  private getCachedMetrics;
  private setCachedMetrics;
  private invalidateCache;
  private generateEventId;
  private startPeriodicAnalysis;
}
//# sourceMappingURL=ResultEffectivenessTracker.d.ts.map
