/**
 * Intelligent Cache Warming Engine
 * 
 * Implements sophisticated cache warming strategies to ensure optimal
 * cache hit rates and sub-1s performance across all MVPs:
 * 
 * - Predictive warming based on historical patterns
 * - User behavior analysis for personalized warming
 * - Time-based warming for anticipated usage peaks
 * - MVP-specific warming strategies
 */

import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import { MultiLayerCacheManager } from './MultiLayerCacheManager';

export interface WarmingPrediction {
  query: string;
  probability: number;
  expectedTime: Date;
  userContext?: string;
  category?: string;
  mvpLevel: number;
  priority: number;
}

export interface WarmingStats {
  totalWarmed: number;
  successfulPredictions: number;
  accuracy: number;
  timesSaved: number;
  avgTimeSaved: number;
  topPatterns: Array<{
    pattern: string;
    frequency: number;
    avgTimeSaved: number;
  }>;
}

export interface UserPattern {
  userId: string;
  commonQueries: string[];
  preferredCategories: string[];
  activeHours: number[];
  searchVelocity: number;
  lastSeen: Date;
}

export class CacheWarmingEngine extends EventEmitter {
  private db: Database.Database;
  private cacheManager: MultiLayerCacheManager;
  private mvpLevel: 1 | 2 | 3 | 4 | 5;
  
  private userPatterns: Map<string, UserPattern> = new Map();
  private queryPatterns: Map<string, number> = new Map();
  private timeBasedPatterns: Map<number, string[]> = new Map(); // hour -> common queries
  
  private stats: WarmingStats = {
    totalWarmed: 0,
    successfulPredictions: 0,
    accuracy: 0,
    timesSaved: 0,
    avgTimeSaved: 0,
    topPatterns: []
  };

  private config = {
    predictionWindow: 30 * 60 * 1000, // 30 minutes
    minPatternFrequency: 3,
    maxPredictions: 50,
    userHistoryDays: 30,
    warmingBatchSize: 10,
    enableUserSpecificWarming: true,
    enableTimeBasedWarming: true,
    enableSeasonalWarming: true
  };

  constructor(
    database: Database.Database,
    cacheManager: MultiLayerCacheManager,
    mvpLevel: 1 | 2 | 3 | 4 | 5
  ) {
    super();
    
    this.db = database;
    this.cacheManager = cacheManager;
    this.mvpLevel = mvpLevel;
    
    this.initializePatternTables();
    this.loadHistoricalPatterns();
    this.startWarmingProcesses();
    
    console.log(`🔥 Cache warming engine initialized for MVP${mvpLevel}`);
  }

  /**
   * Generate warming predictions based on multiple factors
   */
  async generatePredictions(userContext?: string): Promise<WarmingPrediction[]> {
    const predictions: WarmingPrediction[] = [];
    const currentHour = new Date().getHours();
    
    // Time-based predictions
    if (this.config.enableTimeBasedWarming) {
      const timeBasedPredictions = this.generateTimeBasedPredictions(currentHour);
      predictions.push(...timeBasedPredictions);
    }
    
    // User-specific predictions
    if (this.config.enableUserSpecificWarming && userContext) {
      const userPredictions = this.generateUserPredictions(userContext);
      predictions.push(...userPredictions);
    }
    
    // Pattern-based predictions (historical query patterns)
    const patternPredictions = await this.generatePatternPredictions();
    predictions.push(...patternPredictions);
    
    // MVP-specific predictions
    const mvpPredictions = this.generateMVPSpecificPredictions();
    predictions.push(...mvpPredictions);
    
    // Seasonal predictions (e.g., month-end batch processing)
    if (this.config.enableSeasonalWarming) {
      const seasonalPredictions = this.generateSeasonalPredictions();
      predictions.push(...seasonalPredictions);
    }
    
    // Sort by priority and probability
    predictions.sort((a, b) => {
      const scoreA = a.priority * a.probability;
      const scoreB = b.priority * b.probability;
      return scoreB - scoreA;
    });
    
    return predictions.slice(0, this.config.maxPredictions);
  }

  /**
   * Execute warming based on predictions
   */
  async executeWarming(predictions?: WarmingPrediction[]): Promise<WarmingStats> {
    const startTime = Date.now();
    const warmingPredictions = predictions || await this.generatePredictions();
    
    console.log(`🔥 Executing cache warming for ${warmingPredictions.length} predictions...`);
    
    let warmed = 0;
    let totalTimeSaved = 0;
    
    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < warmingPredictions.length; i += this.config.warmingBatchSize) {
      const batch = warmingPredictions.slice(i, i + this.config.warmingBatchSize);
      
      const batchResults = await Promise.allSettled(
        batch.map(prediction => this.warmPrediction(prediction))
      );
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.success) {
          warmed++;
          totalTimeSaved += result.value.timeSaved;
          
          // Record successful prediction
          this.recordSuccessfulPrediction(batch[index]);
        }
      });
      
      // Small delay between batches to maintain system responsiveness
      if (i + this.config.warmingBatchSize < warmingPredictions.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    this.stats.totalWarmed += warmed;
    this.stats.timesSaved += totalTimeSaved;
    this.stats.avgTimeSaved = this.stats.timesSaved / Math.max(this.stats.totalWarmed, 1);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Cache warming completed: ${warmed}/${warmingPredictions.length} in ${duration}ms`);
    
    this.emit('warming-completed', { 
      warmed, 
      total: warmingPredictions.length, 
      duration,
      timeSaved: totalTimeSaved 
    });
    
    return { ...this.stats };
  }

  /**
   * Learn from user interactions to improve predictions
   */
  async learnFromInteraction(
    userId: string,
    query: string,
    category: string,
    responseTime: number,
    timestamp: Date = new Date()
  ): Promise<void> {
    // Update user patterns
    await this.updateUserPattern(userId, query, category, timestamp);
    
    // Update query frequency patterns
    this.updateQueryPattern(query, timestamp);
    
    // Update time-based patterns
    this.updateTimePattern(timestamp.getHours(), query);
    
    // Store interaction for future analysis
    await this.recordInteraction(userId, query, category, responseTime, timestamp);
  }

  /**
   * Get warming effectiveness statistics
   */
  getStats(): WarmingStats {
    return { ...this.stats };
  }

  /**
   * Get warming recommendations for system optimization
   */
  getRecommendations(): string[] {
    const recommendations: string[] = [];
    
    if (this.stats.accuracy < 0.7) {
      recommendations.push('Warming accuracy is low - consider adjusting prediction algorithms');
    }
    
    if (this.stats.avgTimeSaved < 100) {
      recommendations.push('Average time saved is low - review warming targets');
    }
    
    const topPatterns = this.getTopPatterns();
    if (topPatterns.length < 5) {
      recommendations.push('Few patterns detected - increase pattern collection period');
    }
    
    return recommendations;
  }

  // Private implementation methods

  private generateTimeBasedPredictions(currentHour: number): WarmingPrediction[] {
    const predictions: WarmingPrediction[] = [];
    
    // Predict next hour patterns
    const nextHour = (currentHour + 1) % 24;
    const nextHourQueries = this.timeBasedPatterns.get(nextHour) || [];
    
    nextHourQueries.forEach(query => {
      predictions.push({
        query,
        probability: 0.8,
        expectedTime: new Date(Date.now() + 60 * 60 * 1000), // Next hour
        category: this.extractCategory(query),
        mvpLevel: this.mvpLevel,
        priority: 8
      });
    });
    
    // Predict patterns for typical business hours
    if (currentHour >= 8 && currentHour <= 17) {
      const businessHourQueries = [
        'category:JCL',
        'category:Batch',
        'popular:errors',
        'recent:incidents'
      ];
      
      businessHourQueries.forEach(query => {
        predictions.push({
          query,
          probability: 0.6,
          expectedTime: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
          category: this.extractCategory(query),
          mvpLevel: this.mvpLevel,
          priority: 6
        });
      });
    }
    
    return predictions;
  }

  private generateUserPredictions(userContext: string): WarmingPrediction[] {
    const predictions: WarmingPrediction[] = [];
    const userPattern = this.userPatterns.get(userContext);
    
    if (!userPattern) return predictions;
    
    // Predict based on user's common queries
    userPattern.commonQueries.forEach(query => {
      predictions.push({
        query,
        probability: 0.7,
        expectedTime: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
        userContext,
        category: this.extractCategory(query),
        mvpLevel: this.mvpLevel,
        priority: 9
      });
    });
    
    // Predict based on preferred categories
    userPattern.preferredCategories.forEach(category => {
      predictions.push({
        query: `category:${category}`,
        probability: 0.5,
        expectedTime: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        userContext,
        category,
        mvpLevel: this.mvpLevel,
        priority: 7
      });
    });
    
    return predictions;
  }

  private async generatePatternPredictions(): Promise<WarmingPrediction[]> {
    const predictions: WarmingPrediction[] = [];
    
    // Get trending queries from recent search history
    const trendingQueries = await this.getTrendingQueries();
    
    trendingQueries.forEach(({ query, frequency }) => {
      const probability = Math.min(0.9, frequency / 10); // Scale frequency to probability
      
      predictions.push({
        query,
        probability,
        expectedTime: new Date(Date.now() + 20 * 60 * 1000), // 20 minutes
        category: this.extractCategory(query),
        mvpLevel: this.mvpLevel,
        priority: Math.ceil(probability * 10)
      });
    });
    
    return predictions;
  }

  private generateMVPSpecificPredictions(): WarmingPrediction[] {
    const predictions: WarmingPrediction[] = [];
    const baseTime = Date.now() + 30 * 60 * 1000; // 30 minutes
    
    // MVP1: Basic KB queries
    if (this.mvpLevel >= 1) {
      const mvp1Queries = [
        'popular:entries',
        'recent:entries',
        'category:VSAM',
        'category:JCL'
      ];
      
      mvp1Queries.forEach((query, index) => {
        predictions.push({
          query,
          probability: 0.8,
          expectedTime: new Date(baseTime + index * 5 * 60 * 1000),
          mvpLevel: 1,
          priority: 8
        });
      });
    }
    
    // MVP2: Pattern detection queries
    if (this.mvpLevel >= 2) {
      const mvp2Queries = [
        'patterns:recent',
        'trends:weekly',
        'analysis:components'
      ];
      
      mvp2Queries.forEach((query, index) => {
        predictions.push({
          query,
          probability: 0.7,
          expectedTime: new Date(baseTime + index * 10 * 60 * 1000),
          mvpLevel: 2,
          priority: 7
        });
      });
    }
    
    // MVP3: Code analysis queries
    if (this.mvpLevel >= 3) {
      const mvp3Queries = [
        'code:analysis',
        'debug:frequent',
        'links:code-kb'
      ];
      
      mvp3Queries.forEach((query, index) => {
        predictions.push({
          query,
          probability: 0.6,
          expectedTime: new Date(baseTime + index * 15 * 60 * 1000),
          mvpLevel: 3,
          priority: 6
        });
      });
    }
    
    return predictions;
  }

  private generateSeasonalPredictions(): WarmingPrediction[] {
    const predictions: WarmingPrediction[] = [];
    const now = new Date();
    const dayOfMonth = now.getDate();
    const hour = now.getHours();
    
    // Month-end processing patterns
    if (dayOfMonth >= 28) {
      const monthEndQueries = [
        'category:Batch',
        'patterns:month-end',
        'issues:batch-processing'
      ];
      
      monthEndQueries.forEach(query => {
        predictions.push({
          query,
          probability: 0.8,
          expectedTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
          category: 'Batch',
          mvpLevel: this.mvpLevel,
          priority: 9
        });
      });
    }
    
    // Weekend maintenance patterns
    if (now.getDay() === 0 || now.getDay() === 6) { // Sunday or Saturday
      const maintenanceQueries = [
        'maintenance:systems',
        'updates:applications',
        'backup:procedures'
      ];
      
      maintenanceQueries.forEach(query => {
        predictions.push({
          query,
          probability: 0.6,
          expectedTime: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
          mvpLevel: this.mvpLevel,
          priority: 5
        });
      });
    }
    
    return predictions;
  }

  private async warmPrediction(prediction: WarmingPrediction): Promise<{ success: boolean; timeSaved: number }> {
    const startTime = Date.now();
    
    try {
      // Execute the warming by triggering cache population
      await this.cacheManager.get(
        prediction.query,
        () => this.generateMockData(prediction.query),
        {
          priority: 'low', // Warming should not interfere with real requests
          ttl: 60 * 60 * 1000, // 1 hour TTL for warmed data
          tags: [prediction.category || 'general'],
          userContext: prediction.userContext
        }
      );
      
      const timeSaved = Date.now() - startTime;
      return { success: true, timeSaved };
      
    } catch (error) {
      console.error('Failed to warm prediction:', prediction.query, error);
      return { success: false, timeSaved: 0 };
    }
  }

  private async updateUserPattern(
    userId: string,
    query: string,
    category: string,
    timestamp: Date
  ): Promise<void> {
    let pattern = this.userPatterns.get(userId);
    
    if (!pattern) {
      pattern = {
        userId,
        commonQueries: [],
        preferredCategories: [],
        activeHours: [],
        searchVelocity: 0,
        lastSeen: timestamp
      };
    }
    
    // Update common queries
    if (!pattern.commonQueries.includes(query)) {
      pattern.commonQueries.push(query);
      if (pattern.commonQueries.length > 20) {
        pattern.commonQueries.shift(); // Keep only recent 20
      }
    }
    
    // Update preferred categories
    if (!pattern.preferredCategories.includes(category)) {
      pattern.preferredCategories.push(category);
    }
    
    // Update active hours
    const hour = timestamp.getHours();
    if (!pattern.activeHours.includes(hour)) {
      pattern.activeHours.push(hour);
    }
    
    // Update search velocity (searches per hour)
    const hoursSinceLastSeen = (timestamp.getTime() - pattern.lastSeen.getTime()) / (60 * 60 * 1000);
    if (hoursSinceLastSeen > 0) {
      pattern.searchVelocity = 1 / hoursSinceLastSeen;
    }
    
    pattern.lastSeen = timestamp;
    this.userPatterns.set(userId, pattern);
  }

  private updateQueryPattern(query: string, timestamp: Date): void {
    const currentCount = this.queryPatterns.get(query) || 0;
    this.queryPatterns.set(query, currentCount + 1);
  }

  private updateTimePattern(hour: number, query: string): void {
    let hourlyQueries = this.timeBasedPatterns.get(hour);
    if (!hourlyQueries) {
      hourlyQueries = [];
      this.timeBasedPatterns.set(hour, hourlyQueries);
    }
    
    if (!hourlyQueries.includes(query)) {
      hourlyQueries.push(query);
      if (hourlyQueries.length > 50) {
        hourlyQueries.shift(); // Keep only recent 50
      }
    }
  }

  private async getTrendingQueries(): Promise<Array<{ query: string; frequency: number }>> {
    try {
      const results = this.db.prepare(`
        SELECT query, COUNT(*) as frequency
        FROM search_history
        WHERE timestamp > datetime('now', '-24 hours')
        GROUP BY query
        HAVING frequency >= ?
        ORDER BY frequency DESC
        LIMIT 20
      `).all(this.config.minPatternFrequency) as Array<{ query: string; frequency: number }>;
      
      return results;
    } catch (error) {
      console.error('Error getting trending queries:', error);
      return [];
    }
  }

  private extractCategory(query: string): string {
    if (query.includes('category:')) {
      return query.split('category:')[1].split(' ')[0];
    }
    
    // Infer category from query content
    const categories = ['JCL', 'VSAM', 'DB2', 'Batch', 'CICS', 'IMS'];
    for (const category of categories) {
      if (query.toLowerCase().includes(category.toLowerCase())) {
        return category;
      }
    }
    
    return 'General';
  }

  private async generateMockData(query: string): Promise<any> {
    // Generate appropriate mock data based on query type
    if (query.startsWith('popular:')) {
      return { type: 'popular', entries: [], timestamp: Date.now() };
    }
    
    if (query.startsWith('category:')) {
      return { type: 'category', entries: [], category: this.extractCategory(query) };
    }
    
    return { type: 'general', results: [], query };
  }

  private recordSuccessfulPrediction(prediction: WarmingPrediction): void {
    this.stats.successfulPredictions++;
    this.stats.accuracy = this.stats.successfulPredictions / this.stats.totalWarmed;
  }

  private async recordInteraction(
    userId: string,
    query: string,
    category: string,
    responseTime: number,
    timestamp: Date
  ): Promise<void> {
    try {
      this.db.prepare(`
        INSERT INTO warming_interactions (
          user_id, query, category, response_time, timestamp, mvp_level
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(userId, query, category, responseTime, timestamp.toISOString(), this.mvpLevel);
    } catch (error) {
      console.error('Error recording interaction:', error);
    }
  }

  private getTopPatterns(): Array<{ pattern: string; frequency: number; avgTimeSaved: number }> {
    const patterns = Array.from(this.queryPatterns.entries())
      .filter(([_, frequency]) => frequency >= this.config.minPatternFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([pattern, frequency]) => ({
        pattern,
        frequency,
        avgTimeSaved: 150 // Placeholder - would track actual time saved
      }));
    
    return patterns;
  }

  private initializePatternTables(): void {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS warming_interactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          query TEXT NOT NULL,
          category TEXT,
          response_time INTEGER,
          timestamp TEXT NOT NULL,
          mvp_level INTEGER,
          predicted BOOLEAN DEFAULT FALSE
        )
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_warming_timestamp 
        ON warming_interactions(timestamp DESC)
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_warming_user_query 
        ON warming_interactions(user_id, query)
      `);

      console.log('✅ Warming pattern tables initialized');
    } catch (error) {
      console.error('❌ Failed to initialize pattern tables:', error);
    }
  }

  private async loadHistoricalPatterns(): Promise<void> {
    try {
      // Load user patterns from historical data
      const userInteractions = this.db.prepare(`
        SELECT user_id, query, category, timestamp
        FROM warming_interactions
        WHERE timestamp > datetime('now', '-${this.config.userHistoryDays} days')
        ORDER BY timestamp DESC
      `).all();

      const userGroups = new Map<string, any[]>();
      for (const interaction of userInteractions as any[]) {
        const userId = interaction.user_id;
        if (!userGroups.has(userId)) {
          userGroups.set(userId, []);
        }
        userGroups.get(userId)!.push(interaction);
      }

      // Build user patterns
      for (const [userId, interactions] of userGroups) {
        const pattern: UserPattern = {
          userId,
          commonQueries: [...new Set(interactions.map(i => i.query))].slice(0, 10),
          preferredCategories: [...new Set(interactions.map(i => i.category))].filter(Boolean),
          activeHours: [...new Set(interactions.map(i => new Date(i.timestamp).getHours()))],
          searchVelocity: interactions.length / Math.max(this.config.userHistoryDays, 1),
          lastSeen: new Date(interactions[0].timestamp)
        };
        
        this.userPatterns.set(userId, pattern);
      }

      console.log(`📊 Loaded patterns for ${this.userPatterns.size} users`);
    } catch (error) {
      console.error('Error loading historical patterns:', error);
    }
  }

  private startWarmingProcesses(): void {
    // Continuous micro-warming every 5 minutes
    setInterval(() => {
      this.executeWarming().catch(error => {
        console.error('Continuous warming failed:', error);
      });
    }, 5 * 60 * 1000);

    // Hourly comprehensive warming
    setInterval(() => {
      this.generatePredictions().then(predictions => {
        return this.executeWarming(predictions);
      }).catch(error => {
        console.error('Hourly warming failed:', error);
      });
    }, 60 * 60 * 1000);

    // Daily pattern learning and optimization
    setInterval(() => {
      this.optimizePatterns();
    }, 24 * 60 * 60 * 1000);
  }

  private optimizePatterns(): void {
    console.log('🧠 Optimizing warming patterns...');
    
    // Clean up old patterns
    const cutoffTime = Date.now() - (this.config.userHistoryDays * 24 * 60 * 60 * 1000);
    
    // Remove stale user patterns
    for (const [userId, pattern] of this.userPatterns) {
      if (pattern.lastSeen.getTime() < cutoffTime) {
        this.userPatterns.delete(userId);
      }
    }
    
    // Update stats
    this.stats.topPatterns = this.getTopPatterns();
    
    console.log('✅ Pattern optimization completed');
  }
}