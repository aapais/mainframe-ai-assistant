import { PersonalizationFeatures, MLModel, TrainingData, ModelEvaluation } from '../../types/ml';
interface UserProfile {
  userId: string;
  preferences: Record<string, number>;
  searchPatterns: Record<string, number>;
  clickPatterns: Record<string, number>;
  timePatterns: Record<string, number>;
  categoryAffinities: Record<string, number>;
  lastUpdated: Date;
}
interface SearchResult {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  popularity: number;
  timestamp: Date;
  baseRelevanceScore: number;
}
export declare class PersonalizedRanker {
  private config;
  private model;
  private userProfiles;
  private globalFeatures;
  private categoryEmbeddings;
  private clickThroughRates;
  constructor(config?: any);
  train(trainingData: TrainingData): Promise<ModelEvaluation>;
  private buildUserProfiles;
  private calculateGlobalFeatures;
  private trainCategoryEmbeddings;
  private simpleHash;
  private calculateClickThroughRates;
  private trainRankingModel;
  private evaluateModel;
  rankResults(
    results: SearchResult[],
    query: string,
    personalizationFeatures?: PersonalizationFeatures
  ): Promise<SearchResult[]>;
  private basicRanking;
  private createDefaultProfile;
  private calculateRankingFeatures;
  private calculateDiversityScore;
  private calculatePersonalizedScore;
  private applyDiversityFiltering;
  updateUserInteraction(
    userId: string,
    resultId: string,
    query: string,
    action: 'click' | 'view' | 'skip',
    metadata?: Record<string, any>
  ): Promise<void>;
  getUserProfile(userId: string): UserProfile | null;
  getModelInfo(): MLModel | null;
  saveModel(path: string): Promise<void>;
  loadModel(path: string): Promise<void>;
}
export {};
//# sourceMappingURL=PersonalizedRanker.d.ts.map
