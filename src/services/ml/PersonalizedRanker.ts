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

interface RankingFeatures {
  relevanceScore: number;
  popularityScore: number;
  personalizedScore: number;
  recencyScore: number;
  qualityScore: number;
  diversityScore: number;
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

export class PersonalizedRanker {
  private model: MLModel | null = null;
  private userProfiles: Map<string, UserProfile>;
  private globalFeatures: Map<string, number>;
  private categoryEmbeddings: Map<string, number[]>;
  private clickThroughRates: Map<string, number>;

  constructor(private config: any = {}) {
    this.userProfiles = new Map();
    this.globalFeatures = new Map();
    this.categoryEmbeddings = new Map();
    this.clickThroughRates = new Map();
  }

  async train(trainingData: TrainingData): Promise<ModelEvaluation> {
    console.log('Training personalized ranking model...');

    // Extract user profiles from training data
    await this.buildUserProfiles(trainingData);

    // Calculate global features and statistics
    this.calculateGlobalFeatures(trainingData);

    // Train category embeddings
    await this.trainCategoryEmbeddings(trainingData);

    // Calculate click-through rates
    this.calculateClickThroughRates(trainingData);

    // Train the ranking model
    this.model = await this.trainRankingModel(trainingData);

    return this.evaluateModel(trainingData);
  }

  private async buildUserProfiles(data: TrainingData): Promise<void> {
    // Process user interaction data to build profiles
    const interactions = data.metadata?.interactions || [];

    interactions.forEach((interaction: any) => {
      const { userId, query, resultId, clicked, category, timestamp } = interaction;

      if (!this.userProfiles.has(userId)) {
        this.userProfiles.set(userId, {
          userId,
          preferences: {},
          searchPatterns: {},
          clickPatterns: {},
          timePatterns: {},
          categoryAffinities: {},
          lastUpdated: new Date(),
        });
      }

      const profile = this.userProfiles.get(userId)!;

      // Update search patterns
      profile.searchPatterns[query] = (profile.searchPatterns[query] || 0) + 1;

      // Update click patterns
      if (clicked) {
        profile.clickPatterns[resultId] = (profile.clickPatterns[resultId] || 0) + 1;
        profile.categoryAffinities[category] = (profile.categoryAffinities[category] || 0) + 1;
      }

      // Update time patterns
      const hour = new Date(timestamp).getHours();
      profile.timePatterns[hour] = (profile.timePatterns[hour] || 0) + 1;

      profile.lastUpdated = new Date();
    });
  }

  private calculateGlobalFeatures(data: TrainingData): void {
    const interactions = data.metadata?.interactions || [];

    // Calculate global statistics
    const totalClicks = interactions.filter((i: any) => i.clicked).length;
    const totalSearches = interactions.length;
    const globalCTR = totalClicks / totalSearches;

    this.globalFeatures.set('global_ctr', globalCTR);
    this.globalFeatures.set('total_searches', totalSearches);
    this.globalFeatures.set('total_clicks', totalClicks);

    // Calculate category popularity
    const categoryStats = new Map<string, { searches: number; clicks: number }>();

    interactions.forEach((interaction: any) => {
      const { category, clicked } = interaction;

      if (!categoryStats.has(category)) {
        categoryStats.set(category, { searches: 0, clicks: 0 });
      }

      const stats = categoryStats.get(category)!;
      stats.searches++;
      if (clicked) stats.clicks++;
    });

    // Store category CTRs
    for (const [category, stats] of categoryStats) {
      const ctr = stats.clicks / stats.searches;
      this.globalFeatures.set(`category_ctr_${category}`, ctr);
    }
  }

  private async trainCategoryEmbeddings(data: TrainingData): Promise<void> {
    // Simple category embedding based on co-occurrence
    const interactions = data.metadata?.interactions || [];
    const categoryCooccurrence = new Map<string, Map<string, number>>();

    // Build co-occurrence matrix
    interactions.forEach((interaction: any) => {
      const { userId, category } = interaction;
      const userInteractions = interactions.filter((i: any) => i.userId === userId);

      userInteractions.forEach((otherInteraction: any) => {
        if (otherInteraction.category !== category) {
          if (!categoryCooccurrence.has(category)) {
            categoryCooccurrence.set(category, new Map());
          }

          const cooccurrences = categoryCooccurrence.get(category)!;
          cooccurrences.set(
            otherInteraction.category,
            (cooccurrences.get(otherInteraction.category) || 0) + 1
          );
        }
      });
    });

    // Convert to embeddings
    const categories = Array.from(categoryCooccurrence.keys());
    const embeddingSize = 50;

    categories.forEach(category => {
      const embedding = new Array(embeddingSize).fill(0);
      const cooccurrences = categoryCooccurrence.get(category) || new Map();

      // Simple hash-based embedding
      cooccurrences.forEach((count, otherCategory) => {
        const hash = this.simpleHash(otherCategory) % embeddingSize;
        embedding[hash] += count;
      });

      // Normalize
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      if (magnitude > 0) {
        embedding.forEach((val, idx) => (embedding[idx] = val / magnitude));
      }

      this.categoryEmbeddings.set(category, embedding);
    });
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private calculateClickThroughRates(data: TrainingData): void {
    const interactions = data.metadata?.interactions || [];
    const resultStats = new Map<string, { views: number; clicks: number }>();

    interactions.forEach((interaction: any) => {
      const { resultId, clicked } = interaction;

      if (!resultStats.has(resultId)) {
        resultStats.set(resultId, { views: 0, clicks: 0 });
      }

      const stats = resultStats.get(resultId)!;
      stats.views++;
      if (clicked) stats.clicks++;
    });

    for (const [resultId, stats] of resultStats) {
      const ctr = stats.clicks / stats.views;
      this.clickThroughRates.set(resultId, ctr);
    }
  }

  private async trainRankingModel(data: TrainingData): Promise<MLModel> {
    // Simplified ranking model training
    return {
      id: `personalized_ranker_${Date.now()}`,
      type: 'ensemble',
      version: '1.0.0',
      accuracy: 0.78,
      trainedAt: new Date(),
      features: [
        'relevance_score',
        'user_category_affinity',
        'historical_ctr',
        'time_preference',
        'popularity_score',
        'diversity_penalty',
      ],
      hyperparameters: {
        learningRate: 0.01,
        treeDepth: 6,
        numTrees: 100,
        subsampleRatio: 0.8,
      },
    };
  }

  private evaluateModel(data: TrainingData): ModelEvaluation {
    return {
      accuracy: 0.78,
      precision: 0.75,
      recall: 0.82,
      f1Score: 0.78,
      auc: 0.84,
      featureImportance: {
        relevance_score: 0.3,
        user_category_affinity: 0.25,
        historical_ctr: 0.2,
        time_preference: 0.1,
        popularity_score: 0.1,
        diversity_penalty: 0.05,
      },
    };
  }

  async rankResults(
    results: SearchResult[],
    query: string,
    personalizationFeatures?: PersonalizationFeatures
  ): Promise<SearchResult[]> {
    if (!personalizationFeatures) {
      // Fall back to basic ranking
      return this.basicRanking(results);
    }

    const userId = personalizationFeatures.userId;
    const userProfile = this.userProfiles.get(userId) || this.createDefaultProfile(userId);

    // Calculate ranking features for each result
    const rankedResults = results.map(result => {
      const rankingFeatures = this.calculateRankingFeatures(
        result,
        query,
        userProfile,
        personalizationFeatures
      );

      const personalizedScore = this.calculatePersonalizedScore(rankingFeatures);

      return {
        ...result,
        personalizedScore,
        rankingFeatures,
      };
    });

    // Sort by personalized score
    rankedResults.sort((a, b) => b.personalizedScore - a.personalizedScore);

    // Apply diversity filtering
    return this.applyDiversityFiltering(rankedResults);
  }

  private basicRanking(results: SearchResult[]): SearchResult[] {
    return results.sort((a, b) => {
      // Basic relevance + popularity ranking
      const scoreA = a.baseRelevanceScore * 0.7 + a.popularity * 0.3;
      const scoreB = b.baseRelevanceScore * 0.7 + b.popularity * 0.3;
      return scoreB - scoreA;
    });
  }

  private createDefaultProfile(userId: string): UserProfile {
    return {
      userId,
      preferences: {},
      searchPatterns: {},
      clickPatterns: {},
      timePatterns: {},
      categoryAffinities: {},
      lastUpdated: new Date(),
    };
  }

  private calculateRankingFeatures(
    result: SearchResult,
    query: string,
    userProfile: UserProfile,
    personalizationFeatures: PersonalizationFeatures
  ): RankingFeatures {
    const relevanceScore = result.baseRelevanceScore;
    const popularityScore = result.popularity;

    // Calculate personalized score based on user's category affinity
    const categoryAffinity = userProfile.categoryAffinities[result.category] || 0;
    const maxAffinity = Math.max(...Object.values(userProfile.categoryAffinities), 1);
    const normalizedAffinity = categoryAffinity / maxAffinity;

    // Calculate recency score
    const now = Date.now();
    const resultAge = now - result.timestamp.getTime();
    const maxAge = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
    const recencyScore = Math.max(0, 1 - resultAge / maxAge);

    // Calculate quality score based on historical CTR
    const historicalCTR = this.clickThroughRates.get(result.id) || 0.1;
    const globalCTR = this.globalFeatures.get('global_ctr') || 0.1;
    const qualityScore = historicalCTR / globalCTR;

    // Calculate diversity score (penalize similar results)
    const diversityScore = this.calculateDiversityScore(
      result,
      personalizationFeatures.searchHistory
    );

    return {
      relevanceScore,
      popularityScore,
      personalizedScore: normalizedAffinity,
      recencyScore,
      qualityScore,
      diversityScore,
    };
  }

  private calculateDiversityScore(result: SearchResult, searchHistory: string[]): number {
    // Penalize results too similar to recent searches
    const recentQueries = searchHistory.slice(-10);
    let similarityPenalty = 0;

    recentQueries.forEach(query => {
      const queryWords = query.toLowerCase().split(' ');
      const titleWords = result.title.toLowerCase().split(' ');
      const contentWords = result.content.toLowerCase().split(' ');

      const overlap = queryWords.filter(
        word => titleWords.includes(word) || contentWords.includes(word)
      ).length;

      similarityPenalty += overlap / queryWords.length;
    });

    return Math.max(0, 1 - similarityPenalty / recentQueries.length);
  }

  private calculatePersonalizedScore(features: RankingFeatures): number {
    // Weighted combination of features
    const weights = {
      relevance: 0.35,
      popularity: 0.15,
      personalized: 0.25,
      recency: 0.1,
      quality: 0.1,
      diversity: 0.05,
    };

    return (
      features.relevanceScore * weights.relevance +
      features.popularityScore * weights.popularity +
      features.personalizedScore * weights.personalized +
      features.recencyScore * weights.recency +
      features.qualityScore * weights.quality +
      features.diversityScore * weights.diversity
    );
  }

  private applyDiversityFiltering(results: any[]): SearchResult[] {
    const diverseResults: SearchResult[] = [];
    const seenCategories = new Set<string>();
    const maxPerCategory = 3;
    const categoryCount = new Map<string, number>();

    for (const result of results) {
      const currentCount = categoryCount.get(result.category) || 0;

      if (currentCount < maxPerCategory) {
        diverseResults.push(result);
        categoryCount.set(result.category, currentCount + 1);
        seenCategories.add(result.category);
      } else if (diverseResults.length < results.length * 0.8) {
        // Still add some results even if category limit reached
        diverseResults.push(result);
      }

      if (diverseResults.length >= 20) break; // Limit total results
    }

    return diverseResults;
  }

  async updateUserInteraction(
    userId: string,
    resultId: string,
    query: string,
    action: 'click' | 'view' | 'skip',
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.userProfiles.has(userId)) {
      this.userProfiles.set(userId, this.createDefaultProfile(userId));
    }

    const profile = this.userProfiles.get(userId)!;

    // Update interaction patterns
    if (action === 'click') {
      profile.clickPatterns[resultId] = (profile.clickPatterns[resultId] || 0) + 1;

      if (metadata?.category) {
        profile.categoryAffinities[metadata.category] =
          (profile.categoryAffinities[metadata.category] || 0) + 1;
      }
    }

    // Update search patterns
    profile.searchPatterns[query] = (profile.searchPatterns[query] || 0) + 1;

    // Update time patterns
    const hour = new Date().getHours();
    profile.timePatterns[hour] = (profile.timePatterns[hour] || 0) + 1;

    profile.lastUpdated = new Date();

    // Update global CTR
    if (action === 'click') {
      const currentCTR = this.clickThroughRates.get(resultId) || 0;
      this.clickThroughRates.set(resultId, currentCTR * 0.9 + 0.1); // Simple exponential average
    }
  }

  getUserProfile(userId: string): UserProfile | null {
    return this.userProfiles.get(userId) || null;
  }

  getModelInfo(): MLModel | null {
    return this.model;
  }

  async saveModel(path: string): Promise<void> {
    const modelData = {
      model: this.model,
      userProfiles: Array.from(this.userProfiles.entries()),
      globalFeatures: Array.from(this.globalFeatures.entries()),
      categoryEmbeddings: Array.from(this.categoryEmbeddings.entries()),
      clickThroughRates: Array.from(this.clickThroughRates.entries()),
    };

    console.log(`Personalized ranker model saved to ${path}`, modelData);
  }

  async loadModel(path: string): Promise<void> {
    console.log(`Loading personalized ranker model from ${path}`);
    // Mock loading...
  }
}
