/**
 * ConversionTracker - Advanced goal completion and conversion tracking
 * Tracks user conversions, goal completions, and conversion funnel analytics
 */

import { EventEmitter } from 'events';

export interface ConversionGoal {
  id: string;
  name: string;
  type: 'pageview' | 'click' | 'download' | 'form_submit' | 'time_spent' | 'custom';
  category: 'micro' | 'macro';
  value: number; // Monetary or point value
  conditions: {
    triggers: Array<{
      event: string;
      parameters?: Record<string, any>;
      operator?: 'equals' | 'contains' | 'greater_than' | 'less_than';
      value?: any;
    }>;
    timeframe?: number; // Max time to complete (ms)
    sequence?: boolean; // Must complete in order
  };
  metadata: {
    description: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    createdAt: number;
    isActive: boolean;
  };
}

export interface ConversionEvent {
  id: string;
  userId: string;
  sessionId: string;
  goalId: string;
  eventType: string;
  timestamp: number;
  value?: number;
  properties: Record<string, any>;
  source: {
    page: string;
    referrer?: string;
    campaign?: string;
    medium?: string;
  };
  context: {
    userAgent: string;
    ip?: string;
    location?: string;
    deviceType: 'desktop' | 'mobile' | 'tablet';
  };
}

export interface Conversion {
  id: string;
  userId: string;
  sessionId: string;
  goalId: string;
  goalName: string;
  completedAt: number;
  value: number;
  timeToConvert: number; // From first touch to conversion (ms)
  touchpoints: ConversionEvent[];
  attribution: {
    firstTouch: ConversionEvent;
    lastTouch: ConversionEvent;
    assistingTouches: ConversionEvent[];
    model: 'first_touch' | 'last_touch' | 'linear' | 'time_decay' | 'position_based';
  };
  funnel: {
    stage: string;
    completionRate: number;
    dropoffPoint?: string;
  };
}

export interface ConversionMetrics {
  overall: {
    conversionRate: number;
    totalConversions: number;
    totalValue: number;
    averageValue: number;
    averageTimeToConvert: number;
  };
  byGoal: Record<
    string,
    {
      conversions: number;
      conversionRate: number;
      value: number;
      averageTimeToConvert: number;
    }
  >;
  bySource: Record<
    string,
    {
      conversions: number;
      conversionRate: number;
      value: number;
    }
  >;
  byTimeframe: Array<{
    period: string;
    conversions: number;
    conversionRate: number;
    value: number;
  }>;
  funnelAnalysis: Array<{
    stage: string;
    users: number;
    conversions: number;
    conversionRate: number;
    dropoffRate: number;
  }>;
}

export interface FunnelStage {
  id: string;
  name: string;
  order: number;
  conditions: Array<{
    event: string;
    parameters?: Record<string, any>;
  }>;
  isRequired: boolean;
}

export interface ConversionFunnel {
  id: string;
  name: string;
  goalId: string;
  stages: FunnelStage[];
  timeframe: number; // Max time to complete funnel (ms)
  isActive: boolean;
  createdAt: number;
}

export interface AttributionModel {
  name: string;
  type: 'first_touch' | 'last_touch' | 'linear' | 'time_decay' | 'position_based' | 'custom';
  weights?: number[]; // For position-based models
  decayRate?: number; // For time-decay models
  customLogic?: (touchpoints: ConversionEvent[]) => Record<string, number>;
}

export class ConversionTracker extends EventEmitter {
  private goals: Map<string, ConversionGoal> = new Map();
  private events: Map<string, ConversionEvent[]> = new Map(); // userId -> events
  private conversions: Map<string, Conversion[]> = new Map(); // userId -> conversions
  private funnels: Map<string, ConversionFunnel> = new Map();
  private attributionModels: Map<string, AttributionModel> = new Map();
  private metricsCache: Map<string, any> = new Map();
  private cacheExpiry: number = 5 * 60 * 1000; // 5 minutes
  private activeUserSessions: Map<
    string,
    { userId: string; startTime: number; events: ConversionEvent[] }
  > = new Map();

  constructor() {
    super();
    this.initializeDefaultGoals();
    this.initializeAttributionModels();
    this.startSessionMonitoring();
  }

  /**
   * Create a new conversion goal
   */
  createGoal(goal: Omit<ConversionGoal, 'id' | 'metadata.createdAt'>): string {
    const goalRecord: ConversionGoal = {
      ...goal,
      id: this.generateId(),
      metadata: {
        ...goal.metadata,
        createdAt: Date.now(),
      },
    };

    this.goals.set(goalRecord.id, goalRecord);
    this.invalidateCache();
    this.emit('goalCreated', goalRecord);

    return goalRecord.id;
  }

  /**
   * Track a conversion event
   */
  trackEvent(event: Omit<ConversionEvent, 'id' | 'timestamp'>): string {
    const eventRecord: ConversionEvent = {
      ...event,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    if (!this.events.has(event.userId)) {
      this.events.set(event.userId, []);
    }
    this.events.get(event.userId)!.push(eventRecord);

    // Add to active session
    this.updateActiveSession(event.sessionId, event.userId, eventRecord);

    this.invalidateCache();
    this.emit('eventTracked', eventRecord);

    // Check for goal completions
    this.checkGoalCompletions(event.userId, eventRecord);

    return eventRecord.id;
  }

  /**
   * Check and record goal completions
   */
  private async checkGoalCompletions(userId: string, triggerEvent: ConversionEvent): Promise<void> {
    const userEvents = this.events.get(userId) || [];
    const activeGoals = Array.from(this.goals.values()).filter(goal => goal.metadata.isActive);

    for (const goal of activeGoals) {
      const isCompleted = await this.evaluateGoalCompletion(goal, userEvents, triggerEvent);

      if (isCompleted) {
        await this.recordConversion(userId, goal, userEvents, triggerEvent);
      }
    }
  }

  /**
   * Evaluate if a goal has been completed
   */
  private async evaluateGoalCompletion(
    goal: ConversionGoal,
    userEvents: ConversionEvent[],
    triggerEvent: ConversionEvent
  ): Promise<boolean> {
    const { triggers, timeframe, sequence } = goal.conditions;

    // Check if trigger event matches any of the goal triggers
    const matchingTrigger = triggers.find(trigger =>
      this.eventMatchesTrigger(triggerEvent, trigger)
    );

    if (!matchingTrigger && triggers.length > 0) {
      return false;
    }

    // If sequence is required, check if events occurred in order
    if (sequence) {
      return this.validateEventSequence(triggers, userEvents, timeframe);
    }

    // For non-sequence goals, check if all triggers are satisfied
    return this.validateAllTriggers(triggers, userEvents, timeframe);
  }

  /**
   * Record a conversion
   */
  private async recordConversion(
    userId: string,
    goal: ConversionGoal,
    userEvents: ConversionEvent[],
    completionEvent: ConversionEvent
  ): Promise<void> {
    // Check if this conversion already exists (prevent duplicates)
    const existingConversions = this.conversions.get(userId) || [];
    const isDuplicate = existingConversions.some(
      conv =>
        conv.goalId === goal.id && Math.abs(conv.completedAt - completionEvent.timestamp) < 5000 // Within 5 seconds
    );

    if (isDuplicate) {
      return;
    }

    // Find relevant touchpoints for this conversion
    const touchpoints = this.findRelevantTouchpoints(userEvents, goal, completionEvent);

    // Calculate attribution
    const attribution = this.calculateAttribution(touchpoints, 'last_touch');

    // Calculate funnel information
    const funnel = await this.calculateFunnelPosition(userId, goal, touchpoints);

    // Calculate time to convert
    const firstTouchTime =
      touchpoints.length > 0 ? touchpoints[0].timestamp : completionEvent.timestamp;
    const timeToConvert = completionEvent.timestamp - firstTouchTime;

    const conversion: Conversion = {
      id: this.generateId(),
      userId,
      sessionId: completionEvent.sessionId,
      goalId: goal.id,
      goalName: goal.name,
      completedAt: completionEvent.timestamp,
      value: goal.value,
      timeToConvert,
      touchpoints,
      attribution,
      funnel,
    };

    if (!this.conversions.has(userId)) {
      this.conversions.set(userId, []);
    }
    this.conversions.get(userId)!.push(conversion);

    this.invalidateCache();
    this.emit('conversionRecorded', conversion);

    // Update funnel analytics
    this.updateFunnelAnalytics(conversion);
  }

  /**
   * Calculate comprehensive conversion metrics
   */
  async calculateConversionMetrics(filters?: {
    timeRange?: [number, number];
    goalIds?: string[];
    userSegment?: string;
  }): Promise<ConversionMetrics> {
    const cacheKey = `conversion_metrics_${JSON.stringify(filters)}`;
    const cached = this.getCachedMetrics(cacheKey);
    if (cached) return cached;

    const { conversions, events } = this.getFilteredData(filters);

    // Overall metrics
    const totalConversions = conversions.length;
    const totalValue = conversions.reduce((sum, conv) => sum + conv.value, 0);
    const averageValue = totalConversions > 0 ? totalValue / totalConversions : 0;

    const timeToConvertValues = conversions.map(conv => conv.timeToConvert);
    const averageTimeToConvert =
      timeToConvertValues.length > 0
        ? timeToConvertValues.reduce((sum, time) => sum + time, 0) / timeToConvertValues.length
        : 0;

    // Calculate unique users for conversion rate
    const uniqueUsers = new Set([
      ...conversions.map(conv => conv.userId),
      ...events.map(event => event.userId),
    ]).size;

    const conversionRate =
      uniqueUsers > 0
        ? (new Set(conversions.map(conv => conv.userId)).size / uniqueUsers) * 100
        : 0;

    const overall = {
      conversionRate,
      totalConversions,
      totalValue,
      averageValue,
      averageTimeToConvert,
    };

    // Metrics by goal
    const byGoal = this.calculateGoalMetrics(conversions, events);

    // Metrics by source
    const bySource = this.calculateSourceMetrics(conversions);

    // Metrics by timeframe
    const byTimeframe = this.calculateTimeframeMetrics(conversions);

    // Funnel analysis
    const funnelAnalysis = await this.calculateFunnelAnalysis(conversions, events);

    const metrics: ConversionMetrics = {
      overall,
      byGoal,
      bySource,
      byTimeframe,
      funnelAnalysis,
    };

    this.setCachedMetrics(cacheKey, metrics);
    return metrics;
  }

  /**
   * Create a conversion funnel
   */
  createFunnel(funnel: Omit<ConversionFunnel, 'id' | 'createdAt'>): string {
    const funnelRecord: ConversionFunnel = {
      ...funnel,
      id: this.generateId(),
      createdAt: Date.now(),
    };

    this.funnels.set(funnelRecord.id, funnelRecord);
    this.emit('funnelCreated', funnelRecord);

    return funnelRecord.id;
  }

  /**
   * Analyze funnel performance
   */
  async analyzeFunnelPerformance(
    funnelId: string,
    timeRange?: [number, number]
  ): Promise<{
    funnel: ConversionFunnel;
    performance: Array<{
      stage: FunnelStage;
      users: number;
      completions: number;
      conversionRate: number;
      dropoffRate: number;
      averageTimeInStage: number;
    }>;
    insights: {
      bottleneckStage: string;
      improvementOpportunities: Array<{
        stage: string;
        currentRate: number;
        potentialRate: number;
        impact: number;
      }>;
      recommendations: string[];
    };
  }> {
    const funnel = this.funnels.get(funnelId);
    if (!funnel) {
      throw new Error(`Funnel with ID ${funnelId} not found`);
    }

    const { events } = this.getFilteredData({ timeRange });

    // Analyze each stage
    const performance = await Promise.all(
      funnel.stages.map(async (stage, index) => {
        const stageUsers = this.getUsersInStage(stage, events);
        const stageCompletions = this.getStageCompletions(stage, events);
        const conversionRate =
          stageUsers.size > 0 ? (stageCompletions.size / stageUsers.size) * 100 : 0;
        const dropoffRate = 100 - conversionRate;
        const averageTimeInStage = this.calculateAverageTimeInStage(stage, events);

        return {
          stage,
          users: stageUsers.size,
          completions: stageCompletions.size,
          conversionRate,
          dropoffRate,
          averageTimeInStage,
        };
      })
    );

    // Generate insights
    const insights = this.generateFunnelInsights(performance);

    return {
      funnel,
      performance,
      insights,
    };
  }

  /**
   * Get conversion attribution analysis
   */
  async getAttributionAnalysis(
    modelType:
      | 'first_touch'
      | 'last_touch'
      | 'linear'
      | 'time_decay'
      | 'position_based' = 'last_touch',
    timeRange?: [number, number]
  ): Promise<{
    model: AttributionModel;
    attribution: Record<
      string,
      {
        conversions: number;
        value: number;
        percentage: number;
      }
    >;
    comparison: Record<string, Record<string, number>>; // Compare different models
  }> {
    const { conversions } = this.getFilteredData({ timeRange });
    const model = this.attributionModels.get(modelType);

    if (!model) {
      throw new Error(`Attribution model ${modelType} not found`);
    }

    // Calculate attribution for each touchpoint
    const attributionData: Record<string, { conversions: number; value: number }> = {};

    conversions.forEach(conversion => {
      const attribution = this.calculateAttribution(conversion.touchpoints, modelType);

      Object.entries(attribution.weights).forEach(([source, weight]) => {
        if (!attributionData[source]) {
          attributionData[source] = { conversions: 0, value: 0 };
        }
        attributionData[source].conversions += weight;
        attributionData[source].value += conversion.value * weight;
      });
    });

    // Calculate percentages
    const totalConversions = Object.values(attributionData).reduce(
      (sum, data) => sum + data.conversions,
      0
    );
    const attribution: Record<string, { conversions: number; value: number; percentage: number }> =
      {};

    Object.entries(attributionData).forEach(([source, data]) => {
      attribution[source] = {
        ...data,
        percentage: totalConversions > 0 ? (data.conversions / totalConversions) * 100 : 0,
      };
    });

    // Compare with other models
    const comparison = await this.compareAttributionModels(conversions);

    return {
      model,
      attribution,
      comparison,
    };
  }

  /**
   * Get real-time conversion dashboard
   */
  async getConversionDashboard(): Promise<{
    realtimeMetrics: {
      conversionsToday: number;
      conversionRateToday: number;
      valueToday: number;
      activeGoals: number;
    };
    topConvertingGoals: Array<{
      goalId: string;
      goalName: string;
      conversions: number;
      conversionRate: number;
      value: number;
    }>;
    conversionTrends: Array<{
      time: string;
      conversions: number;
      conversionRate: number;
    }>;
    funnelHealth: Array<{
      funnelId: string;
      funnelName: string;
      overallConversionRate: number;
      bottleneckStage: string;
      status: 'healthy' | 'warning' | 'critical';
    }>;
    alerts: Array<{
      type: 'goal_underperforming' | 'funnel_bottleneck' | 'conversion_spike' | 'technical_issue';
      severity: 'low' | 'medium' | 'high';
      message: string;
      timestamp: number;
    }>;
  }> {
    const now = Date.now();
    const todayStart = new Date(now).setHours(0, 0, 0, 0);

    const todayConversions = this.getFilteredData({
      timeRange: [todayStart, now],
    }).conversions;

    // Real-time metrics
    const realtimeMetrics = {
      conversionsToday: todayConversions.length,
      conversionRateToday: await this.calculateTodayConversionRate(),
      valueToday: todayConversions.reduce((sum, conv) => sum + conv.value, 0),
      activeGoals: Array.from(this.goals.values()).filter(goal => goal.metadata.isActive).length,
    };

    // Top converting goals
    const topConvertingGoals = await this.getTopConvertingGoals(5);

    // Conversion trends (last 24 hours)
    const conversionTrends = this.generateConversionTrends(24);

    // Funnel health
    const funnelHealth = await this.assessFunnelHealth();

    // Alerts
    const alerts = await this.generateConversionAlerts();

    return {
      realtimeMetrics,
      topConvertingGoals,
      conversionTrends,
      funnelHealth,
      alerts,
    };
  }

  // Private helper methods

  private getFilteredData(filters?: {
    timeRange?: [number, number];
    goalIds?: string[];
    userSegment?: string;
  }) {
    let conversions: Conversion[] = [];
    let events: ConversionEvent[] = [];

    // Collect all data
    this.conversions.forEach(userConversions => conversions.push(...userConversions));
    this.events.forEach(userEvents => events.push(...userEvents));

    // Apply filters
    if (filters) {
      if (filters.timeRange) {
        const [start, end] = filters.timeRange;
        conversions = conversions.filter(
          conv => conv.completedAt >= start && conv.completedAt <= end
        );
        events = events.filter(event => event.timestamp >= start && event.timestamp <= end);
      }

      if (filters.goalIds) {
        conversions = conversions.filter(conv => filters.goalIds!.includes(conv.goalId));
      }
    }

    return { conversions, events };
  }

  private eventMatchesTrigger(
    event: ConversionEvent,
    trigger: { event: string; parameters?: Record<string, any>; operator?: string; value?: any }
  ): boolean {
    if (event.eventType !== trigger.event) {
      return false;
    }

    if (trigger.parameters) {
      return Object.entries(trigger.parameters).every(([key, expectedValue]) => {
        const actualValue = event.properties[key];
        const operator = trigger.operator || 'equals';

        switch (operator) {
          case 'equals':
            return actualValue === expectedValue;
          case 'contains':
            return String(actualValue).includes(String(expectedValue));
          case 'greater_than':
            return Number(actualValue) > Number(expectedValue);
          case 'less_than':
            return Number(actualValue) < Number(expectedValue);
          default:
            return actualValue === expectedValue;
        }
      });
    }

    return true;
  }

  private validateEventSequence(
    triggers: Array<{ event: string; parameters?: Record<string, any> }>,
    userEvents: ConversionEvent[],
    timeframe?: number
  ): boolean {
    let triggerIndex = 0;
    const startTime = timeframe ? Date.now() - timeframe : 0;

    for (const event of userEvents) {
      if (event.timestamp < startTime) continue;

      if (
        triggerIndex < triggers.length &&
        this.eventMatchesTrigger(event, triggers[triggerIndex])
      ) {
        triggerIndex++;
        if (triggerIndex === triggers.length) {
          return true;
        }
      }
    }

    return false;
  }

  private validateAllTriggers(
    triggers: Array<{ event: string; parameters?: Record<string, any> }>,
    userEvents: ConversionEvent[],
    timeframe?: number
  ): boolean {
    const startTime = timeframe ? Date.now() - timeframe : 0;
    const relevantEvents = userEvents.filter(event => event.timestamp >= startTime);

    return triggers.every(trigger =>
      relevantEvents.some(event => this.eventMatchesTrigger(event, trigger))
    );
  }

  private findRelevantTouchpoints(
    userEvents: ConversionEvent[],
    goal: ConversionGoal,
    completionEvent: ConversionEvent
  ): ConversionEvent[] {
    const lookbackTime = goal.conditions.timeframe || 30 * 24 * 60 * 60 * 1000; // 30 days default
    const startTime = completionEvent.timestamp - lookbackTime;

    return userEvents
      .filter(event => event.timestamp >= startTime && event.timestamp <= completionEvent.timestamp)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  private calculateAttribution(
    touchpoints: ConversionEvent[],
    modelType: string
  ): {
    firstTouch: ConversionEvent;
    lastTouch: ConversionEvent;
    assistingTouches: ConversionEvent[];
    model: string;
    weights: Record<string, number>;
  } {
    if (touchpoints.length === 0) {
      return {
        firstTouch: touchpoints[0],
        lastTouch: touchpoints[0],
        assistingTouches: [],
        model: modelType,
        weights: {},
      };
    }

    const firstTouch = touchpoints[0];
    const lastTouch = touchpoints[touchpoints.length - 1];
    const assistingTouches = touchpoints.slice(1, -1);

    const weights: Record<string, number> = {};

    // Calculate attribution weights based on model
    switch (modelType) {
      case 'first_touch':
        weights[this.getTouchpointSource(firstTouch)] = 1;
        break;

      case 'last_touch':
        weights[this.getTouchpointSource(lastTouch)] = 1;
        break;

      case 'linear':
        touchpoints.forEach(touchpoint => {
          const source = this.getTouchpointSource(touchpoint);
          weights[source] = (weights[source] || 0) + 1 / touchpoints.length;
        });
        break;

      case 'time_decay':
        const decayRate = 0.5; // Half-life
        const totalWeight = touchpoints.reduce((sum, touchpoint, index) => {
          const timeFromEnd = touchpoints.length - 1 - index;
          return sum + Math.pow(decayRate, timeFromEnd);
        }, 0);

        touchpoints.forEach((touchpoint, index) => {
          const timeFromEnd = touchpoints.length - 1 - index;
          const weight = Math.pow(decayRate, timeFromEnd) / totalWeight;
          const source = this.getTouchpointSource(touchpoint);
          weights[source] = (weights[source] || 0) + weight;
        });
        break;

      case 'position_based':
        // 40% first, 20% middle (distributed), 40% last
        if (touchpoints.length === 1) {
          weights[this.getTouchpointSource(firstTouch)] = 1;
        } else {
          weights[this.getTouchpointSource(firstTouch)] = 0.4;
          weights[this.getTouchpointSource(lastTouch)] =
            (weights[this.getTouchpointSource(lastTouch)] || 0) + 0.4;

          if (assistingTouches.length > 0) {
            const middleWeight = 0.2 / assistingTouches.length;
            assistingTouches.forEach(touchpoint => {
              const source = this.getTouchpointSource(touchpoint);
              weights[source] = (weights[source] || 0) + middleWeight;
            });
          }
        }
        break;

      default:
        weights[this.getTouchpointSource(lastTouch)] = 1;
    }

    return {
      firstTouch,
      lastTouch,
      assistingTouches,
      model: modelType,
      weights,
    };
  }

  private getTouchpointSource(touchpoint: ConversionEvent): string {
    return (
      touchpoint.source.campaign || touchpoint.source.referrer || touchpoint.source.page || 'direct'
    );
  }

  private async calculateFunnelPosition(
    userId: string,
    goal: ConversionGoal,
    touchpoints: ConversionEvent[]
  ): Promise<{ stage: string; completionRate: number; dropoffPoint?: string }> {
    // Find relevant funnel for this goal
    const funnel = Array.from(this.funnels.values()).find(f => f.goalId === goal.id);

    if (!funnel) {
      return {
        stage: 'conversion',
        completionRate: 1,
      };
    }

    // Determine which stage the user completed
    let completedStages = 0;
    let dropoffPoint: string | undefined;

    for (const stage of funnel.stages) {
      const stageCompleted = stage.conditions.every(condition =>
        touchpoints.some(touchpoint => this.eventMatchesTrigger(touchpoint, condition))
      );

      if (stageCompleted) {
        completedStages++;
      } else if (stage.isRequired) {
        dropoffPoint = stage.name;
        break;
      }
    }

    const completionRate = completedStages / funnel.stages.length;

    return {
      stage: funnel.stages[Math.min(completedStages, funnel.stages.length - 1)].name,
      completionRate,
      dropoffPoint,
    };
  }

  private calculateGoalMetrics(
    conversions: Conversion[],
    events: ConversionEvent[]
  ): Record<
    string,
    { conversions: number; conversionRate: number; value: number; averageTimeToConvert: number }
  > {
    const goalMetrics: Record<
      string,
      { conversions: number; conversionRate: number; value: number; averageTimeToConvert: number }
    > = {};

    // Group conversions by goal
    const conversionsByGoal = this.groupBy(conversions, 'goalId');

    // Get unique users who triggered events for each goal
    const usersByGoal: Record<string, Set<string>> = {};
    events.forEach(event => {
      const goal = Array.from(this.goals.values()).find(g =>
        g.conditions.triggers.some(trigger => trigger.event === event.eventType)
      );

      if (goal) {
        if (!usersByGoal[goal.id]) {
          usersByGoal[goal.id] = new Set();
        }
        usersByGoal[goal.id].add(event.userId);
      }
    });

    Object.entries(conversionsByGoal).forEach(([goalId, goalConversions]) => {
      const uniqueConverters = new Set(goalConversions.map(conv => conv.userId)).size;
      const totalEligibleUsers = usersByGoal[goalId]?.size || uniqueConverters;

      goalMetrics[goalId] = {
        conversions: goalConversions.length,
        conversionRate: totalEligibleUsers > 0 ? (uniqueConverters / totalEligibleUsers) * 100 : 0,
        value: goalConversions.reduce((sum, conv) => sum + conv.value, 0),
        averageTimeToConvert:
          goalConversions.length > 0
            ? goalConversions.reduce((sum, conv) => sum + conv.timeToConvert, 0) /
              goalConversions.length
            : 0,
      };
    });

    return goalMetrics;
  }

  private calculateSourceMetrics(
    conversions: Conversion[]
  ): Record<string, { conversions: number; conversionRate: number; value: number }> {
    const sourceMetrics: Record<
      string,
      { conversions: number; conversionRate: number; value: number }
    > = {};

    conversions.forEach(conversion => {
      const source = this.getTouchpointSource(conversion.attribution.lastTouch);

      if (!sourceMetrics[source]) {
        sourceMetrics[source] = { conversions: 0, conversionRate: 0, value: 0 };
      }

      sourceMetrics[source].conversions++;
      sourceMetrics[source].value += conversion.value;
    });

    // Calculate conversion rates (simplified - would need traffic data for accurate rates)
    Object.keys(sourceMetrics).forEach(source => {
      sourceMetrics[source].conversionRate = sourceMetrics[source].conversions; // Placeholder
    });

    return sourceMetrics;
  }

  private calculateTimeframeMetrics(
    conversions: Conversion[]
  ): Array<{ period: string; conversions: number; conversionRate: number; value: number }> {
    const timeframeMetrics: Array<{
      period: string;
      conversions: number;
      conversionRate: number;
      value: number;
    }> = [];

    // Group by day for the last 30 days
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const periodStart = date.setHours(0, 0, 0, 0);
      const periodEnd = date.setHours(23, 59, 59, 999);

      const periodConversions = conversions.filter(
        conv => conv.completedAt >= periodStart && conv.completedAt <= periodEnd
      );

      timeframeMetrics.push({
        period: date.toISOString().split('T')[0],
        conversions: periodConversions.length,
        conversionRate: periodConversions.length, // Simplified
        value: periodConversions.reduce((sum, conv) => sum + conv.value, 0),
      });
    }

    return timeframeMetrics;
  }

  private async calculateFunnelAnalysis(
    conversions: Conversion[],
    events: ConversionEvent[]
  ): Promise<
    Array<{
      stage: string;
      users: number;
      conversions: number;
      conversionRate: number;
      dropoffRate: number;
    }>
  > {
    const funnelAnalysis: Array<{
      stage: string;
      users: number;
      conversions: number;
      conversionRate: number;
      dropoffRate: number;
    }> = [];

    // For each active funnel
    for (const funnel of this.funnels.values()) {
      if (!funnel.isActive) continue;

      let previousStageUsers = new Set<string>();
      let isFirstStage = true;

      for (const stage of funnel.stages) {
        const stageUsers = this.getUsersInStage(stage, events);
        const stageConversions = conversions.filter(conv => conv.goalId === funnel.goalId);

        const eligibleUsers = isFirstStage ? stageUsers : previousStageUsers;
        const conversionRate =
          eligibleUsers.size > 0 ? (stageUsers.size / eligibleUsers.size) * 100 : 0;
        const dropoffRate = 100 - conversionRate;

        funnelAnalysis.push({
          stage: stage.name,
          users: stageUsers.size,
          conversions: stageConversions.length,
          conversionRate,
          dropoffRate,
        });

        previousStageUsers = stageUsers;
        isFirstStage = false;
      }
    }

    return funnelAnalysis;
  }

  private getUsersInStage(stage: FunnelStage, events: ConversionEvent[]): Set<string> {
    const users = new Set<string>();

    events.forEach(event => {
      const meetsConditions = stage.conditions.every(condition =>
        this.eventMatchesTrigger(event, condition)
      );

      if (meetsConditions) {
        users.add(event.userId);
      }
    });

    return users;
  }

  private getStageCompletions(stage: FunnelStage, events: ConversionEvent[]): Set<string> {
    return this.getUsersInStage(stage, events);
  }

  private calculateAverageTimeInStage(stage: FunnelStage, events: ConversionEvent[]): number {
    // Simplified calculation - would need more sophisticated session tracking
    return 60000; // 1 minute placeholder
  }

  private generateFunnelInsights(
    performance: Array<{
      stage: FunnelStage;
      users: number;
      completions: number;
      conversionRate: number;
      dropoffRate: number;
      averageTimeInStage: number;
    }>
  ): {
    bottleneckStage: string;
    improvementOpportunities: Array<{
      stage: string;
      currentRate: number;
      potentialRate: number;
      impact: number;
    }>;
    recommendations: string[];
  } {
    // Find bottleneck (stage with highest dropoff)
    const bottleneckStage = performance.reduce((max, current) =>
      current.dropoffRate > max.dropoffRate ? current : max
    ).stage.name;

    // Identify improvement opportunities
    const improvementOpportunities = performance
      .filter(p => p.dropoffRate > 20) // Stages with >20% dropoff
      .map(p => ({
        stage: p.stage.name,
        currentRate: p.conversionRate,
        potentialRate: Math.min(p.conversionRate * 1.5, 95), // 50% improvement cap
        impact: p.users * 0.5 * (p.dropoffRate / 100),
      }))
      .sort((a, b) => b.impact - a.impact);

    // Generate recommendations
    const recommendations = [
      `Focus on optimizing ${bottleneckStage} stage to reduce dropoff`,
      'A/B test different approaches for high-dropoff stages',
      'Implement exit-intent surveys to understand user friction points',
      'Add progress indicators to improve user confidence',
    ];

    return {
      bottleneckStage,
      improvementOpportunities,
      recommendations,
    };
  }

  private async compareAttributionModels(
    conversions: Conversion[]
  ): Promise<Record<string, Record<string, number>>> {
    const models = ['first_touch', 'last_touch', 'linear', 'time_decay', 'position_based'];
    const comparison: Record<string, Record<string, number>> = {};

    models.forEach(model => {
      comparison[model] = {};

      conversions.forEach(conversion => {
        const attribution = this.calculateAttribution(conversion.touchpoints, model);

        Object.entries(attribution.weights).forEach(([source, weight]) => {
          comparison[model][source] = (comparison[model][source] || 0) + conversion.value * weight;
        });
      });
    });

    return comparison;
  }

  private async calculateTodayConversionRate(): Promise<number> {
    const now = Date.now();
    const todayStart = new Date(now).setHours(0, 0, 0, 0);

    const { conversions, events } = this.getFilteredData({
      timeRange: [todayStart, now],
    });

    const uniqueUsers = new Set([
      ...conversions.map(conv => conv.userId),
      ...events.map(event => event.userId),
    ]).size;

    const convertedUsers = new Set(conversions.map(conv => conv.userId)).size;

    return uniqueUsers > 0 ? (convertedUsers / uniqueUsers) * 100 : 0;
  }

  private async getTopConvertingGoals(limit: number): Promise<
    Array<{
      goalId: string;
      goalName: string;
      conversions: number;
      conversionRate: number;
      value: number;
    }>
  > {
    const { conversions } = this.getFilteredData();
    const goalStats: Record<string, { conversions: number; value: number }> = {};

    conversions.forEach(conversion => {
      if (!goalStats[conversion.goalId]) {
        goalStats[conversion.goalId] = { conversions: 0, value: 0 };
      }
      goalStats[conversion.goalId].conversions++;
      goalStats[conversion.goalId].value += conversion.value;
    });

    return Object.entries(goalStats)
      .map(([goalId, stats]) => {
        const goal = this.goals.get(goalId);
        return {
          goalId,
          goalName: goal?.name || 'Unknown Goal',
          conversions: stats.conversions,
          conversionRate: stats.conversions, // Simplified
          value: stats.value,
        };
      })
      .sort((a, b) => b.conversions - a.conversions)
      .slice(0, limit);
  }

  private generateConversionTrends(
    hours: number
  ): Array<{ time: string; conversions: number; conversionRate: number }> {
    const trends: Array<{ time: string; conversions: number; conversionRate: number }> = [];
    const now = Date.now();

    for (let i = hours - 1; i >= 0; i--) {
      const hourStart = now - i * 60 * 60 * 1000;
      const hourEnd = hourStart + 60 * 60 * 1000;

      const { conversions } = this.getFilteredData({
        timeRange: [hourStart, hourEnd],
      });

      trends.push({
        time: new Date(hourStart).toISOString().slice(0, 16),
        conversions: conversions.length,
        conversionRate: conversions.length, // Simplified
      });
    }

    return trends;
  }

  private async assessFunnelHealth(): Promise<
    Array<{
      funnelId: string;
      funnelName: string;
      overallConversionRate: number;
      bottleneckStage: string;
      status: 'healthy' | 'warning' | 'critical';
    }>
  > {
    const health: Array<{
      funnelId: string;
      funnelName: string;
      overallConversionRate: number;
      bottleneckStage: string;
      status: 'healthy' | 'warning' | 'critical';
    }> = [];

    for (const funnel of this.funnels.values()) {
      if (!funnel.isActive) continue;

      const analysis = await this.analyzeFunnelPerformance(funnel.id);
      const overallConversionRate =
        analysis.performance.length > 0
          ? analysis.performance[analysis.performance.length - 1].conversionRate
          : 0;

      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (overallConversionRate < 5) status = 'critical';
      else if (overallConversionRate < 15) status = 'warning';

      health.push({
        funnelId: funnel.id,
        funnelName: funnel.name,
        overallConversionRate,
        bottleneckStage: analysis.insights.bottleneckStage,
        status,
      });
    }

    return health;
  }

  private async generateConversionAlerts(): Promise<
    Array<{
      type: 'goal_underperforming' | 'funnel_bottleneck' | 'conversion_spike' | 'technical_issue';
      severity: 'low' | 'medium' | 'high';
      message: string;
      timestamp: number;
    }>
  > {
    const alerts: Array<{
      type: 'goal_underperforming' | 'funnel_bottleneck' | 'conversion_spike' | 'technical_issue';
      severity: 'low' | 'medium' | 'high';
      message: string;
      timestamp: number;
    }> = [];

    const now = Date.now();

    // Check for underperforming goals
    const metrics = await this.calculateConversionMetrics();
    Object.entries(metrics.byGoal).forEach(([goalId, goalMetrics]) => {
      if (goalMetrics.conversionRate < 5) {
        const goal = this.goals.get(goalId);
        alerts.push({
          type: 'goal_underperforming',
          severity: 'high',
          message: `Goal "${goal?.name}" has low conversion rate: ${goalMetrics.conversionRate.toFixed(1)}%`,
          timestamp: now,
        });
      }
    });

    return alerts;
  }

  private updateActiveSession(sessionId: string, userId: string, event: ConversionEvent): void {
    if (!this.activeUserSessions.has(sessionId)) {
      this.activeUserSessions.set(sessionId, {
        userId,
        startTime: Date.now(),
        events: [],
      });
    }

    this.activeUserSessions.get(sessionId)!.events.push(event);
  }

  private updateFunnelAnalytics(conversion: Conversion): void {
    // Update funnel analytics with new conversion data
    this.emit('funnelAnalyticsUpdated', { conversion, timestamp: Date.now() });
  }

  private groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce(
      (groups, item) => {
        const groupKey = String(item[key]);
        if (!groups[groupKey]) {
          groups[groupKey] = [];
        }
        groups[groupKey].push(item);
        return groups;
      },
      {} as Record<string, T[]>
    );
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
      timestamp: Date.now(),
    });
  }

  private invalidateCache(): void {
    this.metricsCache.clear();
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeDefaultGoals(): void {
    // Create some default conversion goals
    const defaultGoals = [
      {
        name: 'Search Result Click',
        type: 'click' as const,
        category: 'micro' as const,
        value: 1,
        conditions: {
          triggers: [{ event: 'result_click' }],
        },
        metadata: {
          description: 'User clicks on a search result',
          priority: 'medium' as const,
          isActive: true,
        },
      },
      {
        name: 'Knowledge Base Article View',
        type: 'pageview' as const,
        category: 'micro' as const,
        value: 2,
        conditions: {
          triggers: [{ event: 'page_view', parameters: { page_type: 'article' } }],
        },
        metadata: {
          description: 'User views a knowledge base article',
          priority: 'high' as const,
          isActive: true,
        },
      },
      {
        name: 'Deep Engagement',
        type: 'time_spent' as const,
        category: 'macro' as const,
        value: 10,
        conditions: {
          triggers: [{ event: 'time_spent', operator: 'greater_than', value: 300000 }], // 5 minutes
        },
        metadata: {
          description: 'User spends significant time engaging with content',
          priority: 'high' as const,
          isActive: true,
        },
      },
    ];

    defaultGoals.forEach(goal => this.createGoal(goal));
  }

  private initializeAttributionModels(): void {
    const models: AttributionModel[] = [
      {
        name: 'First Touch',
        type: 'first_touch',
      },
      {
        name: 'Last Touch',
        type: 'last_touch',
      },
      {
        name: 'Linear',
        type: 'linear',
      },
      {
        name: 'Time Decay',
        type: 'time_decay',
        decayRate: 0.5,
      },
      {
        name: 'Position Based',
        type: 'position_based',
        weights: [0.4, 0.2, 0.4], // First 40%, Middle 20%, Last 40%
      },
    ];

    models.forEach(model => {
      this.attributionModels.set(model.type, model);
    });
  }

  private startSessionMonitoring(): void {
    // Clean up old sessions every hour
    setInterval(
      () => {
        const now = Date.now();
        const sessionTimeout = 30 * 60 * 1000; // 30 minutes

        for (const [sessionId, session] of this.activeUserSessions.entries()) {
          if (now - session.startTime > sessionTimeout) {
            this.activeUserSessions.delete(sessionId);
          }
        }
      },
      60 * 60 * 1000
    );

    this.emit('sessionMonitoringStarted', { timestamp: Date.now() });
  }
}
