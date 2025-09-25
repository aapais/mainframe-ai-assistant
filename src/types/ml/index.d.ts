export interface QuerySuggestion {
  query: string;
  confidence: number;
  source: 'ml' | 'historical' | 'trending';
  metadata?: Record<string, any>;
}
export interface PersonalizationFeatures {
  userId: string;
  searchHistory: string[];
  clickHistory: string[];
  preferences: Record<string, any>;
  demographics?: Record<string, any>;
  sessionContext?: Record<string, any>;
}
export interface SemanticFeatures {
  embedding: number[];
  intent: string;
  entities: Array<{
    type: string;
    value: string;
    confidence: number;
  }>;
  sentiment: number;
  complexity: number;
}
export interface SearchAnomaly {
  type: 'pattern' | 'volume' | 'performance' | 'quality';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: Date;
  metrics: Record<string, number>;
  suggestions: string[];
}
export interface MLModel {
  id: string;
  type: 'neural' | 'tree' | 'linear' | 'ensemble';
  version: string;
  accuracy: number;
  trainedAt: Date;
  features: string[];
  hyperparameters: Record<string, any>;
}
export interface TrainingData {
  features: number[][];
  labels: number[] | string[];
  metadata?: Record<string, any>;
}
export interface ModelEvaluation {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  auc?: number;
  confusionMatrix?: number[][];
  featureImportance?: Record<string, number>;
}
export interface PredictiveInsight {
  type: 'trend' | 'anomaly' | 'opportunity' | 'risk';
  prediction: string;
  confidence: number;
  timeframe: string;
  impact: 'low' | 'medium' | 'high';
  recommendations: string[];
}
export interface MLConfig {
  models: {
    querySuggestion: {
      algorithm: string;
      maxSuggestions: number;
      minConfidence: number;
    };
    personalization: {
      algorithm: string;
      features: string[];
      retrainInterval: number;
    };
    semanticSearch: {
      embeddingModel: string;
      dimensions: number;
      similarity: string;
    };
    anomalyDetection: {
      algorithm: string;
      threshold: number;
      windowSize: number;
    };
  };
  training: {
    batchSize: number;
    epochs: number;
    validationSplit: number;
    earlyStoppingPatience: number;
  };
}
//# sourceMappingURL=index.d.ts.map
