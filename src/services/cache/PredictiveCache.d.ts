import { EventEmitter } from 'events';
export interface PredictionModel {
  id: string;
  name: string;
  version: string;
  accuracy: number;
  lastTraining: number;
  features: string[];
  weights: number[];
}
export interface UserPattern {
  userId?: string;
  sessionId: string;
  searchHistory: SearchEvent[];
  categoryPreferences: Map<string, number>;
  timePatterns: Map<string, number>;
  queryPatterns: QueryPattern[];
  behaviorScore: number;
}
export interface SearchEvent {
  query: string;
  timestamp: number;
  category?: string;
  resultClicks: number;
  sessionDuration: number;
  followupQueries: string[];
}
export interface QueryPattern {
  pattern: string;
  frequency: number;
  nextQueries: Map<string, number>;
  contextClues: string[];
  temporalPattern: number[];
}
export interface PredictionCandidate {
  key: string;
  query: string;
  confidence: number;
  estimatedValue: number;
  computationCost: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timeToNeeded: number;
  userContext?: string;
  category?: string;
  tags: string[];
}
export interface PredictiveCacheConfig {
  enableMLPredictions: boolean;
  maxPredictions: number;
  confidenceThreshold: number;
  predictionHorizon: number;
  modelUpdateInterval: number;
  enablePatternLearning: boolean;
  enableContextualPredictions: boolean;
  enableTemporalPredictions: boolean;
  maxPatternHistory: number;
  predictionBatchSize: number;
}
export interface PredictiveCacheStats {
  totalPredictions: number;
  successfulPredictions: number;
  predictionAccuracy: number;
  cacheHitRate: number;
  computationTimeSaved: number;
  modelsActive: number;
  patternsLearned: number;
  averagePredictionTime: number;
}
export declare class PredictiveCache extends EventEmitter {
  private config;
  private stats;
  private userPatterns;
  private globalPatterns;
  private temporalPatterns;
  private predictionModels;
  private activeModel?;
  private predictionQueue;
  private pendingPredictions;
  private predictionHistory;
  constructor(config?: Partial<PredictiveCacheConfig>);
  recordSearchEvent(sessionId: string, event: SearchEvent, userId?: string): void;
  getPredictions(
    sessionId: string,
    userId?: string,
    context?: Record<string, any>
  ): Promise<PredictionCandidate[]>;
  markPredictionSuccess(key: string): void;
  markPredictionFailure(key: string): void;
  trainModels(): Promise<void>;
  getStats(): PredictiveCacheStats;
  reset(): void;
  private initializeModels;
  private updateUserPatterns;
  private updateQueryPatterns;
  private updateGlobalPatterns;
  private updateTemporalPatterns;
  private generatePredictions;
  private generatePatternBasedPredictions;
  private generateTemporalPredictions;
  private generateContextualPredictions;
  private generateMLPredictions;
  private filterPredictions;
  private rankPredictions;
  private calculatePredictionScore;
  private processPredictionQueue;
  private startPredictionEngine;
  private calculateSimilarity;
  private extractContextClues;
  private normalizeQuery;
  private calculateBehaviorScore;
  private calculateEstimatedValue;
  private estimateComputationCost;
  private calculatePriority;
  private estimateTimeToNeeded;
  private predictCategory;
  private generatePredictionKey;
  private extractFeatures;
  private applyModel;
  private prepareTrainingData;
  private trainPredictionModel;
  private updateAccuracy;
  private updateStats;
  private cleanupOldPatterns;
}
export default PredictiveCache;
//# sourceMappingURL=PredictiveCache.d.ts.map
