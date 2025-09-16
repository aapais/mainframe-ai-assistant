/**
 * User Satisfaction Assessment and Usability Metrics
 * Comprehensive evaluation of user experience quality
 */

export interface UserSatisfactionMetrics {
  // System Usability Scale (SUS) scores
  systemUsabilityScale: number; // 0-100

  // Task success metrics
  taskCompletionRate: number; // Percentage of tasks completed successfully
  taskEfficiency: number; // Time to complete / optimal time
  errorRate: number; // Percentage of tasks with errors

  // Satisfaction ratings (1-5 scale)
  overallSatisfaction: number;
  easeOfUse: number;
  visualAppeal: number;
  informationArchitecture: number;
  searchAccuracy: number;
  performancePerception: number;

  // Behavioral metrics
  timeOnTask: number; // Average seconds per task
  clicksToComplete: number; // Average clicks per task
  helpSeekingBehavior: number; // Times help was sought
  retryAttempts: number; // Number of retry attempts

  // Emotional response
  frustrationLevel: number; // 1-5 scale (1 = not frustrated, 5 = very frustrated)
  confidenceLevel: number; // 1-5 scale (1 = not confident, 5 = very confident)
  perceivedValue: number; // 1-5 scale (1 = not valuable, 5 = very valuable)

  // Accessibility satisfaction
  accessibilityRating: number; // 1-5 scale for users with disabilities
  screenReaderExperience: number; // 1-5 scale for screen reader users
  keyboardNavigationSatisfaction: number; // 1-5 scale

  // Net Promoter Score
  netPromoterScore: number; // -100 to +100

  // Qualitative feedback
  positiveComments: string[];
  negativeComments: string[];
  suggestions: string[];
}

export interface UserProfile {
  id: string;
  demographics: {
    ageGroup: '18-25' | '26-35' | '36-45' | '46-55' | '56-65' | '65+';
    experience: 'novice' | 'intermediate' | 'expert';
    mainframeFamiliarity: 'none' | 'basic' | 'intermediate' | 'expert';
    assistiveTechnology: boolean;
    primaryLanguage: string;
  };
  technicalContext: {
    device: 'desktop' | 'tablet' | 'mobile';
    browser: string;
    screenSize: string;
    connectionSpeed: 'slow' | 'medium' | 'fast';
  };
  accessibilityNeeds: {
    visualImpairment: boolean;
    motorImpairment: boolean;
    cognitiveImpairment: boolean;
    hearingImpairment: boolean;
    assistiveTech: string[];
  };
}

export interface TestScenarioResult {
  scenarioId: string;
  userId: string;
  startTime: Date;
  endTime: Date;
  completed: boolean;
  errors: TaskError[];
  interactions: UserInteraction[];
  satisfactionRating: number;
  comments: string;
}

export interface TaskError {
  timestamp: Date;
  type: 'navigation' | 'search' | 'interpretation' | 'system' | 'user';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
  recoveryTime: number; // seconds
}

export interface UserInteraction {
  timestamp: Date;
  action: 'click' | 'type' | 'scroll' | 'focus' | 'hover' | 'keypress';
  element: string;
  value?: string;
  coordinates?: { x: number; y: number };
  duration?: number;
}

export class UserSatisfactionCollector {
  private sessions: Map<string, TestSession> = new Map();
  private analytics: UserAnalytics;

  constructor() {
    this.analytics = new UserAnalytics();
  }

  startSession(userId: string, profile: UserProfile): string {
    const sessionId = `session-${Date.now()}-${userId}`;

    const session: TestSession = {
      id: sessionId,
      userId,
      profile,
      startTime: new Date(),
      scenarios: [],
      metrics: this.initializeMetrics(),
      interactions: [],
      errors: []
    };

    this.sessions.set(sessionId, session);
    this.analytics.trackSessionStart(session);

    return sessionId;
  }

  recordScenarioResult(sessionId: string, result: TestScenarioResult): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.scenarios.push(result);
    this.updateSessionMetrics(session, result);
    this.analytics.trackScenarioCompletion(result);
  }

  recordInteraction(sessionId: string, interaction: UserInteraction): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.interactions.push(interaction);
    this.analytics.trackInteraction(interaction);
  }

  recordError(sessionId: string, error: TaskError): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.errors.push(error);
    this.analytics.trackError(error);
  }

  collectPostTaskFeedback(sessionId: string, feedback: PostTaskFeedback): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.postTaskFeedback = feedback;
    this.updateSatisfactionMetrics(session, feedback);
  }

  endSession(sessionId: string): UserSatisfactionMetrics {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.endTime = new Date();
    this.finalizeMetrics(session);
    this.analytics.trackSessionEnd(session);

    return session.metrics;
  }

  private initializeMetrics(): UserSatisfactionMetrics {
    return {
      systemUsabilityScale: 0,
      taskCompletionRate: 0,
      taskEfficiency: 0,
      errorRate: 0,
      overallSatisfaction: 0,
      easeOfUse: 0,
      visualAppeal: 0,
      informationArchitecture: 0,
      searchAccuracy: 0,
      performancePerception: 0,
      timeOnTask: 0,
      clicksToComplete: 0,
      helpSeekingBehavior: 0,
      retryAttempts: 0,
      frustrationLevel: 0,
      confidenceLevel: 0,
      perceivedValue: 0,
      accessibilityRating: 0,
      screenReaderExperience: 0,
      keyboardNavigationSatisfaction: 0,
      netPromoterScore: 0,
      positiveComments: [],
      negativeComments: [],
      suggestions: []
    };
  }

  private updateSessionMetrics(session: TestSession, result: TestScenarioResult): void {
    const metrics = session.metrics;
    const scenarios = session.scenarios;

    // Update completion rate
    const completedTasks = scenarios.filter(s => s.completed).length;
    metrics.taskCompletionRate = (completedTasks / scenarios.length) * 100;

    // Update error rate
    const totalErrors = scenarios.reduce((sum, s) => sum + s.errors.length, 0);
    metrics.errorRate = scenarios.length > 0 ? (totalErrors / scenarios.length) : 0;

    // Update time on task
    const totalTime = scenarios.reduce((sum, s) => {
      const duration = (s.endTime.getTime() - s.startTime.getTime()) / 1000;
      return sum + duration;
    }, 0);
    metrics.timeOnTask = totalTime / scenarios.length;

    // Update satisfaction
    const satisfactionScores = scenarios.map(s => s.satisfactionRating).filter(s => s > 0);
    if (satisfactionScores.length > 0) {
      metrics.overallSatisfaction = satisfactionScores.reduce((sum, score) => sum + score, 0) / satisfactionScores.length;
    }
  }

  private updateSatisfactionMetrics(session: TestSession, feedback: PostTaskFeedback): void {
    const metrics = session.metrics;

    // Update SUS score
    metrics.systemUsabilityScale = this.calculateSUSScore(feedback.susResponses);

    // Update satisfaction ratings
    metrics.easeOfUse = feedback.easeOfUse;
    metrics.visualAppeal = feedback.visualAppeal;
    metrics.informationArchitecture = feedback.informationArchitecture;
    metrics.searchAccuracy = feedback.searchAccuracy;
    metrics.performancePerception = feedback.performancePerception;

    // Update emotional metrics
    metrics.frustrationLevel = feedback.frustrationLevel;
    metrics.confidenceLevel = feedback.confidenceLevel;
    metrics.perceivedValue = feedback.perceivedValue;

    // Update accessibility metrics
    if (session.profile.accessibilityNeeds.visualImpairment ||
        session.profile.accessibilityNeeds.assistiveTech.length > 0) {
      metrics.accessibilityRating = feedback.accessibilityRating || 0;
      metrics.screenReaderExperience = feedback.screenReaderExperience || 0;
      metrics.keyboardNavigationSatisfaction = feedback.keyboardNavigationSatisfaction || 0;
    }

    // Calculate NPS
    metrics.netPromoterScore = this.calculateNPS(feedback.recommendationLikelihood);

    // Store qualitative feedback
    if (feedback.positiveComments) {
      metrics.positiveComments.push(...feedback.positiveComments);
    }
    if (feedback.negativeComments) {
      metrics.negativeComments.push(...feedback.negativeComments);
    }
    if (feedback.suggestions) {
      metrics.suggestions.push(...feedback.suggestions);
    }
  }

  private calculateSUSScore(responses: number[]): number {
    if (responses.length !== 10) {
      throw new Error('SUS requires exactly 10 responses');
    }

    let score = 0;

    // Odd items (1, 3, 5, 7, 9) - subtract 1 from score
    for (let i = 0; i < 10; i += 2) {
      score += responses[i] - 1;
    }

    // Even items (2, 4, 6, 8, 10) - subtract score from 5
    for (let i = 1; i < 10; i += 2) {
      score += 5 - responses[i];
    }

    // Multiply by 2.5 to get final score (0-100)
    return score * 2.5;
  }

  private calculateNPS(recommendationScore: number): number {
    // NPS calculation: % Promoters (9-10) - % Detractors (0-6)
    // For individual scores: Promoters = +100, Passives = 0, Detractors = -100
    if (recommendationScore >= 9) return 100;
    if (recommendationScore >= 7) return 0;
    return -100;
  }

  private finalizeMetrics(session: TestSession): void {
    const metrics = session.metrics;

    // Calculate task efficiency
    if (session.scenarios.length > 0) {
      const efficiency = session.scenarios.map(scenario => {
        const actualTime = (scenario.endTime.getTime() - scenario.startTime.getTime()) / 1000;
        const optimalTime = this.getOptimalTime(scenario.scenarioId);
        return actualTime / optimalTime;
      });

      metrics.taskEfficiency = efficiency.reduce((sum, eff) => sum + eff, 0) / efficiency.length;
    }

    // Calculate clicks to complete
    const totalClicks = session.interactions.filter(i => i.action === 'click').length;
    metrics.clicksToComplete = session.scenarios.length > 0 ? totalClicks / session.scenarios.length : 0;

    // Calculate help seeking behavior
    const helpActions = session.interactions.filter(i =>
      i.element.includes('help') ||
      i.element.includes('documentation') ||
      i.element.includes('support')
    ).length;
    metrics.helpSeekingBehavior = helpActions;

    // Calculate retry attempts
    metrics.retryAttempts = session.errors.filter(e => e.type === 'user' && !e.resolved).length;
  }

  private getOptimalTime(scenarioId: string): number {
    // Define optimal times for each scenario (in seconds)
    const optimalTimes: Record<string, number> = {
      'search-basic-query': 20,
      'search-advanced-filtering': 45,
      'search-ai-semantic': 30,
      'search-autocomplete-navigation': 10,
      'mobile-search-experience': 25,
      'screen-reader-navigation': 60,
      'high-contrast-mode': 35,
      'performance-under-load': 25,
      'error-recovery': 40,
      'cognitive-load-assessment': 50
    };

    return optimalTimes[scenarioId] || 30; // Default 30 seconds
  }

  generateSatisfactionReport(sessionIds: string[]): UserSatisfactionReport {
    const sessions = sessionIds.map(id => this.sessions.get(id)).filter(s => s) as TestSession[];

    if (sessions.length === 0) {
      throw new Error('No valid sessions found');
    }

    return {
      overview: this.generateOverview(sessions),
      demographics: this.analyzeDemographics(sessions),
      taskPerformance: this.analyzeTaskPerformance(sessions),
      satisfactionAnalysis: this.analyzeSatisfaction(sessions),
      accessibilityAssessment: this.analyzeAccessibility(sessions),
      recommendations: this.generateRecommendations(sessions),
      qualitativeFeedback: this.aggregateQualitativeFeedback(sessions)
    };
  }

  private generateOverview(sessions: TestSession[]): SatisfactionOverview {
    const allMetrics = sessions.map(s => s.metrics);

    return {
      totalParticipants: sessions.length,
      averageSUSScore: this.average(allMetrics.map(m => m.systemUsabilityScale)),
      overallCompletionRate: this.average(allMetrics.map(m => m.taskCompletionRate)),
      averageSatisfaction: this.average(allMetrics.map(m => m.overallSatisfaction)),
      netPromoterScore: this.average(allMetrics.map(m => m.netPromoterScore)),
      criticalIssues: this.identifyCriticalIssues(sessions),
      strengths: this.identifyStrengths(sessions)
    };
  }

  private analyzeDemographics(sessions: TestSession[]): DemographicsAnalysis {
    const profiles = sessions.map(s => s.profile);

    return {
      ageDistribution: this.calculateDistribution(profiles.map(p => p.demographics.ageGroup)),
      experienceDistribution: this.calculateDistribution(profiles.map(p => p.demographics.experience)),
      deviceDistribution: this.calculateDistribution(profiles.map(p => p.technicalContext.device)),
      accessibilityNeedsDistribution: this.calculateAccessibilityDistribution(profiles)
    };
  }

  private analyzeTaskPerformance(sessions: TestSession[]): TaskPerformanceAnalysis {
    const allScenarios = sessions.flatMap(s => s.scenarios);

    return {
      scenarioSuccessRates: this.calculateScenarioSuccessRates(allScenarios),
      averageTaskTimes: this.calculateAverageTaskTimes(allScenarios),
      errorPatterns: this.analyzeErrorPatterns(sessions.flatMap(s => s.errors)),
      efficiencyMetrics: this.calculateEfficiencyMetrics(sessions)
    };
  }

  private analyzeSatisfaction(sessions: TestSession[]): SatisfactionAnalysis {
    const metrics = sessions.map(s => s.metrics);

    return {
      satisfactionByCategory: {
        easeOfUse: this.average(metrics.map(m => m.easeOfUse)),
        visualAppeal: this.average(metrics.map(m => m.visualAppeal)),
        informationArchitecture: this.average(metrics.map(m => m.informationArchitecture)),
        searchAccuracy: this.average(metrics.map(m => m.searchAccuracy)),
        performancePerception: this.average(metrics.map(m => m.performancePerception))
      },
      emotionalResponse: {
        frustrationLevel: this.average(metrics.map(m => m.frustrationLevel)),
        confidenceLevel: this.average(metrics.map(m => m.confidenceLevel)),
        perceivedValue: this.average(metrics.map(m => m.perceivedValue))
      },
      correlationAnalysis: this.analyzeCorrelations(metrics)
    };
  }

  private analyzeAccessibility(sessions: TestSession[]): AccessibilityAssessment {
    const accessibilityUsers = sessions.filter(s =>
      s.profile.accessibilityNeeds.visualImpairment ||
      s.profile.accessibilityNeeds.motorImpairment ||
      s.profile.accessibilityNeeds.cognitiveImpairment ||
      s.profile.accessibilityNeeds.assistiveTech.length > 0
    );

    if (accessibilityUsers.length === 0) {
      return {
        participantCount: 0,
        averageAccessibilityRating: 0,
        screenReaderSatisfaction: 0,
        keyboardNavigationSatisfaction: 0,
        specificChallenges: [],
        recommendations: []
      };
    }

    const metrics = accessibilityUsers.map(s => s.metrics);

    return {
      participantCount: accessibilityUsers.length,
      averageAccessibilityRating: this.average(metrics.map(m => m.accessibilityRating)),
      screenReaderSatisfaction: this.average(metrics.map(m => m.screenReaderExperience)),
      keyboardNavigationSatisfaction: this.average(metrics.map(m => m.keyboardNavigationSatisfaction)),
      specificChallenges: this.identifyAccessibilityChallenges(accessibilityUsers),
      recommendations: this.generateAccessibilityRecommendations(accessibilityUsers)
    };
  }

  private generateRecommendations(sessions: TestSession[]): string[] {
    const recommendations: string[] = [];
    const metrics = sessions.map(s => s.metrics);

    // Performance recommendations
    const avgSUS = this.average(metrics.map(m => m.systemUsabilityScale));
    if (avgSUS < 68) { // Below average SUS score
      recommendations.push('Overall usability needs improvement. Focus on simplifying user workflows.');
    }

    // Task completion recommendations
    const avgCompletion = this.average(metrics.map(m => m.taskCompletionRate));
    if (avgCompletion < 80) {
      recommendations.push('Task completion rate is below target. Review task flows and error handling.');
    }

    // Search accuracy recommendations
    const avgSearchAccuracy = this.average(metrics.map(m => m.searchAccuracy));
    if (avgSearchAccuracy < 3.5) {
      recommendations.push('Search accuracy needs improvement. Consider refining search algorithms and result ranking.');
    }

    // Performance perception recommendations
    const avgPerformance = this.average(metrics.map(m => m.performancePerception));
    if (avgPerformance < 3.5) {
      recommendations.push('Perceived performance is below expectations. Optimize loading times and provide better feedback.');
    }

    // Error rate recommendations
    const avgErrorRate = this.average(metrics.map(m => m.errorRate));
    if (avgErrorRate > 15) {
      recommendations.push('Error rate is high. Improve error prevention and recovery mechanisms.');
    }

    return recommendations;
  }

  private aggregateQualitativeFeedback(sessions: TestSession[]): QualitativeFeedback {
    const allMetrics = sessions.map(s => s.metrics);

    return {
      positiveThemes: this.extractThemes(allMetrics.flatMap(m => m.positiveComments)),
      negativeThemes: this.extractThemes(allMetrics.flatMap(m => m.negativeComments)),
      suggestionThemes: this.extractThemes(allMetrics.flatMap(m => m.suggestions)),
      representativeQuotes: this.selectRepresentativeQuotes(allMetrics)
    };
  }

  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  }

  private calculateDistribution<T>(items: T[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    items.forEach(item => {
      const key = String(item);
      distribution[key] = (distribution[key] || 0) + 1;
    });
    return distribution;
  }

  private calculateAccessibilityDistribution(profiles: UserProfile[]): Record<string, number> {
    const needs = {
      visual: profiles.filter(p => p.accessibilityNeeds.visualImpairment).length,
      motor: profiles.filter(p => p.accessibilityNeeds.motorImpairment).length,
      cognitive: profiles.filter(p => p.accessibilityNeeds.cognitiveImpairment).length,
      hearing: profiles.filter(p => p.accessibilityNeeds.hearingImpairment).length,
      assistiveTech: profiles.filter(p => p.accessibilityNeeds.assistiveTech.length > 0).length
    };
    return needs;
  }

  private calculateScenarioSuccessRates(scenarios: TestScenarioResult[]): Record<string, number> {
    const rates: Record<string, number> = {};
    const scenarioGroups = this.groupBy(scenarios, s => s.scenarioId);

    Object.entries(scenarioGroups).forEach(([scenarioId, scenarios]) => {
      const completedCount = scenarios.filter(s => s.completed).length;
      rates[scenarioId] = (completedCount / scenarios.length) * 100;
    });

    return rates;
  }

  private calculateAverageTaskTimes(scenarios: TestScenarioResult[]): Record<string, number> {
    const times: Record<string, number> = {};
    const scenarioGroups = this.groupBy(scenarios, s => s.scenarioId);

    Object.entries(scenarioGroups).forEach(([scenarioId, scenarios]) => {
      const durations = scenarios.map(s => (s.endTime.getTime() - s.startTime.getTime()) / 1000);
      times[scenarioId] = this.average(durations);
    });

    return times;
  }

  private analyzeErrorPatterns(errors: TaskError[]): Record<string, number> {
    return this.calculateDistribution(errors.map(e => e.type));
  }

  private calculateEfficiencyMetrics(sessions: TestSession[]): Record<string, number> {
    return {
      averageEfficiency: this.average(sessions.map(s => s.metrics.taskEfficiency)),
      averageClicksToComplete: this.average(sessions.map(s => s.metrics.clicksToComplete)),
      averageTimeOnTask: this.average(sessions.map(s => s.metrics.timeOnTask))
    };
  }

  private analyzeCorrelations(metrics: UserSatisfactionMetrics[]): Record<string, number> {
    // Simplified correlation analysis
    return {
      susVsCompletion: this.calculateCorrelation(
        metrics.map(m => m.systemUsabilityScale),
        metrics.map(m => m.taskCompletionRate)
      ),
      satisfactionVsPerformance: this.calculateCorrelation(
        metrics.map(m => m.overallSatisfaction),
        metrics.map(m => m.performancePerception)
      ),
      easeOfUseVsErrors: this.calculateCorrelation(
        metrics.map(m => m.easeOfUse),
        metrics.map(m => -m.errorRate) // Negative because fewer errors = better
      )
    };
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length) return 0;

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  private identifyCriticalIssues(sessions: TestSession[]): string[] {
    const issues: string[] = [];
    const metrics = sessions.map(s => s.metrics);

    const avgSUS = this.average(metrics.map(m => m.systemUsabilityScale));
    if (avgSUS < 50) {
      issues.push('Very low System Usability Scale score indicates critical usability problems');
    }

    const avgCompletion = this.average(metrics.map(m => m.taskCompletionRate));
    if (avgCompletion < 60) {
      issues.push('Low task completion rate suggests fundamental workflow problems');
    }

    const avgErrorRate = this.average(metrics.map(m => m.errorRate));
    if (avgErrorRate > 25) {
      issues.push('High error rate indicates system reliability issues');
    }

    return issues;
  }

  private identifyStrengths(sessions: TestSession[]): string[] {
    const strengths: string[] = [];
    const metrics = sessions.map(s => s.metrics);

    const avgSUS = this.average(metrics.map(m => m.systemUsabilityScale));
    if (avgSUS > 80) {
      strengths.push('Excellent System Usability Scale score');
    }

    const avgSearchAccuracy = this.average(metrics.map(m => m.searchAccuracy));
    if (avgSearchAccuracy > 4.0) {
      strengths.push('High search accuracy satisfaction');
    }

    const avgVisualAppeal = this.average(metrics.map(m => m.visualAppeal));
    if (avgVisualAppeal > 4.0) {
      strengths.push('Strong visual design appeal');
    }

    return strengths;
  }

  private identifyAccessibilityChallenges(sessions: TestSession[]): string[] {
    const challenges: string[] = [];

    // Analyze specific accessibility issues from errors and feedback
    const accessibilityErrors = sessions.flatMap(s => s.errors)
      .filter(e => e.description.toLowerCase().includes('accessibility') ||
                   e.description.toLowerCase().includes('screen reader') ||
                   e.description.toLowerCase().includes('keyboard'));

    if (accessibilityErrors.length > 0) {
      challenges.push('Screen reader and keyboard navigation issues identified');
    }

    const avgA11yRating = this.average(sessions.map(s => s.metrics.accessibilityRating));
    if (avgA11yRating < 3.0) {
      challenges.push('Overall accessibility rating below expectations');
    }

    return challenges;
  }

  private generateAccessibilityRecommendations(sessions: TestSession[]): string[] {
    const recommendations: string[] = [];

    const avgScreenReader = this.average(sessions.map(s => s.metrics.screenReaderExperience));
    if (avgScreenReader < 3.5) {
      recommendations.push('Improve screen reader compatibility and semantic markup');
    }

    const avgKeyboard = this.average(sessions.map(s => s.metrics.keyboardNavigationSatisfaction));
    if (avgKeyboard < 3.5) {
      recommendations.push('Enhance keyboard navigation and focus management');
    }

    return recommendations;
  }

  private extractThemes(comments: string[]): string[] {
    // Simplified theme extraction - in real implementation, would use NLP
    const commonWords = ['search', 'slow', 'fast', 'easy', 'difficult', 'confusing', 'clear'];
    const themes: string[] = [];

    commonWords.forEach(word => {
      const count = comments.filter(comment =>
        comment.toLowerCase().includes(word)
      ).length;

      if (count > comments.length * 0.2) { // 20% threshold
        themes.push(`${word} mentioned frequently`);
      }
    });

    return themes;
  }

  private selectRepresentativeQuotes(metrics: UserSatisfactionMetrics[]): string[] {
    // Select diverse, representative quotes
    const allComments = metrics.flatMap(m => [...m.positiveComments, ...m.negativeComments]);

    // In real implementation, would use more sophisticated selection
    return allComments.slice(0, 5);
  }

  private groupBy<T, K extends string | number>(
    array: T[],
    keyFunction: (item: T) => K
  ): Record<K, T[]> {
    return array.reduce((groups, item) => {
      const key = keyFunction(item);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
      return groups;
    }, {} as Record<K, T[]>);
  }
}

// Supporting interfaces
interface TestSession {
  id: string;
  userId: string;
  profile: UserProfile;
  startTime: Date;
  endTime?: Date;
  scenarios: TestScenarioResult[];
  metrics: UserSatisfactionMetrics;
  interactions: UserInteraction[];
  errors: TaskError[];
  postTaskFeedback?: PostTaskFeedback;
}

interface PostTaskFeedback {
  susResponses: number[]; // 10 SUS questions, 1-5 scale
  easeOfUse: number;
  visualAppeal: number;
  informationArchitecture: number;
  searchAccuracy: number;
  performancePerception: number;
  frustrationLevel: number;
  confidenceLevel: number;
  perceivedValue: number;
  recommendationLikelihood: number; // 0-10 for NPS
  accessibilityRating?: number;
  screenReaderExperience?: number;
  keyboardNavigationSatisfaction?: number;
  positiveComments?: string[];
  negativeComments?: string[];
  suggestions?: string[];
}

export interface UserSatisfactionReport {
  overview: SatisfactionOverview;
  demographics: DemographicsAnalysis;
  taskPerformance: TaskPerformanceAnalysis;
  satisfactionAnalysis: SatisfactionAnalysis;
  accessibilityAssessment: AccessibilityAssessment;
  recommendations: string[];
  qualitativeFeedback: QualitativeFeedback;
}

interface SatisfactionOverview {
  totalParticipants: number;
  averageSUSScore: number;
  overallCompletionRate: number;
  averageSatisfaction: number;
  netPromoterScore: number;
  criticalIssues: string[];
  strengths: string[];
}

interface DemographicsAnalysis {
  ageDistribution: Record<string, number>;
  experienceDistribution: Record<string, number>;
  deviceDistribution: Record<string, number>;
  accessibilityNeedsDistribution: Record<string, number>;
}

interface TaskPerformanceAnalysis {
  scenarioSuccessRates: Record<string, number>;
  averageTaskTimes: Record<string, number>;
  errorPatterns: Record<string, number>;
  efficiencyMetrics: Record<string, number>;
}

interface SatisfactionAnalysis {
  satisfactionByCategory: Record<string, number>;
  emotionalResponse: Record<string, number>;
  correlationAnalysis: Record<string, number>;
}

interface AccessibilityAssessment {
  participantCount: number;
  averageAccessibilityRating: number;
  screenReaderSatisfaction: number;
  keyboardNavigationSatisfaction: number;
  specificChallenges: string[];
  recommendations: string[];
}

interface QualitativeFeedback {
  positiveThemes: string[];
  negativeThemes: string[];
  suggestionThemes: string[];
  representativeQuotes: string[];
}

class UserAnalytics {
  trackSessionStart(session: TestSession): void {
    console.log(`Session started: ${session.id} for user ${session.userId}`);
  }

  trackScenarioCompletion(result: TestScenarioResult): void {
    console.log(`Scenario ${result.scenarioId} completed: ${result.completed}`);
  }

  trackInteraction(interaction: UserInteraction): void {
    // Track interaction patterns
  }

  trackError(error: TaskError): void {
    console.log(`Error recorded: ${error.type} - ${error.description}`);
  }

  trackSessionEnd(session: TestSession): void {
    console.log(`Session ended: ${session.id}`);
  }
}