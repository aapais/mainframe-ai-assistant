"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheWarmingEngine = void 0;
const events_1 = require("events");
class CacheWarmingEngine extends events_1.EventEmitter {
    db;
    cacheManager;
    mvpLevel;
    userPatterns = new Map();
    queryPatterns = new Map();
    timeBasedPatterns = new Map();
    stats = {
        totalWarmed: 0,
        successfulPredictions: 0,
        accuracy: 0,
        timesSaved: 0,
        avgTimeSaved: 0,
        topPatterns: []
    };
    config = {
        predictionWindow: 30 * 60 * 1000,
        minPatternFrequency: 3,
        maxPredictions: 50,
        userHistoryDays: 30,
        warmingBatchSize: 10,
        enableUserSpecificWarming: true,
        enableTimeBasedWarming: true,
        enableSeasonalWarming: true
    };
    constructor(database, cacheManager, mvpLevel) {
        super();
        this.db = database;
        this.cacheManager = cacheManager;
        this.mvpLevel = mvpLevel;
        this.initializePatternTables();
        this.loadHistoricalPatterns();
        this.startWarmingProcesses();
        console.log(`🔥 Cache warming engine initialized for MVP${mvpLevel}`);
    }
    async generatePredictions(userContext) {
        const predictions = [];
        const currentHour = new Date().getHours();
        if (this.config.enableTimeBasedWarming) {
            const timeBasedPredictions = this.generateTimeBasedPredictions(currentHour);
            predictions.push(...timeBasedPredictions);
        }
        if (this.config.enableUserSpecificWarming && userContext) {
            const userPredictions = this.generateUserPredictions(userContext);
            predictions.push(...userPredictions);
        }
        const patternPredictions = await this.generatePatternPredictions();
        predictions.push(...patternPredictions);
        const mvpPredictions = this.generateMVPSpecificPredictions();
        predictions.push(...mvpPredictions);
        if (this.config.enableSeasonalWarming) {
            const seasonalPredictions = this.generateSeasonalPredictions();
            predictions.push(...seasonalPredictions);
        }
        predictions.sort((a, b) => {
            const scoreA = a.priority * a.probability;
            const scoreB = b.priority * b.probability;
            return scoreB - scoreA;
        });
        return predictions.slice(0, this.config.maxPredictions);
    }
    async executeWarming(predictions) {
        const startTime = Date.now();
        const warmingPredictions = predictions || await this.generatePredictions();
        console.log(`🔥 Executing cache warming for ${warmingPredictions.length} predictions...`);
        let warmed = 0;
        let totalTimeSaved = 0;
        for (let i = 0; i < warmingPredictions.length; i += this.config.warmingBatchSize) {
            const batch = warmingPredictions.slice(i, i + this.config.warmingBatchSize);
            const batchResults = await Promise.allSettled(batch.map(prediction => this.warmPrediction(prediction)));
            batchResults.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value.success) {
                    warmed++;
                    totalTimeSaved += result.value.timeSaved;
                    this.recordSuccessfulPrediction(batch[index]);
                }
            });
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
    async learnFromInteraction(userId, query, category, responseTime, timestamp = new Date()) {
        await this.updateUserPattern(userId, query, category, timestamp);
        this.updateQueryPattern(query, timestamp);
        this.updateTimePattern(timestamp.getHours(), query);
        await this.recordInteraction(userId, query, category, responseTime, timestamp);
    }
    getStats() {
        return { ...this.stats };
    }
    getRecommendations() {
        const recommendations = [];
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
    generateTimeBasedPredictions(currentHour) {
        const predictions = [];
        const nextHour = (currentHour + 1) % 24;
        const nextHourQueries = this.timeBasedPatterns.get(nextHour) || [];
        nextHourQueries.forEach(query => {
            predictions.push({
                query,
                probability: 0.8,
                expectedTime: new Date(Date.now() + 60 * 60 * 1000),
                category: this.extractCategory(query),
                mvpLevel: this.mvpLevel,
                priority: 8
            });
        });
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
                    expectedTime: new Date(Date.now() + 15 * 60 * 1000),
                    category: this.extractCategory(query),
                    mvpLevel: this.mvpLevel,
                    priority: 6
                });
            });
        }
        return predictions;
    }
    generateUserPredictions(userContext) {
        const predictions = [];
        const userPattern = this.userPatterns.get(userContext);
        if (!userPattern)
            return predictions;
        userPattern.commonQueries.forEach(query => {
            predictions.push({
                query,
                probability: 0.7,
                expectedTime: new Date(Date.now() + 5 * 60 * 1000),
                userContext,
                category: this.extractCategory(query),
                mvpLevel: this.mvpLevel,
                priority: 9
            });
        });
        userPattern.preferredCategories.forEach(category => {
            predictions.push({
                query: `category:${category}`,
                probability: 0.5,
                expectedTime: new Date(Date.now() + 10 * 60 * 1000),
                userContext,
                category,
                mvpLevel: this.mvpLevel,
                priority: 7
            });
        });
        return predictions;
    }
    async generatePatternPredictions() {
        const predictions = [];
        const trendingQueries = await this.getTrendingQueries();
        trendingQueries.forEach(({ query, frequency }) => {
            const probability = Math.min(0.9, frequency / 10);
            predictions.push({
                query,
                probability,
                expectedTime: new Date(Date.now() + 20 * 60 * 1000),
                category: this.extractCategory(query),
                mvpLevel: this.mvpLevel,
                priority: Math.ceil(probability * 10)
            });
        });
        return predictions;
    }
    generateMVPSpecificPredictions() {
        const predictions = [];
        const baseTime = Date.now() + 30 * 60 * 1000;
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
    generateSeasonalPredictions() {
        const predictions = [];
        const now = new Date();
        const dayOfMonth = now.getDate();
        const hour = now.getHours();
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
                    expectedTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
                    category: 'Batch',
                    mvpLevel: this.mvpLevel,
                    priority: 9
                });
            });
        }
        if (now.getDay() === 0 || now.getDay() === 6) {
            const maintenanceQueries = [
                'maintenance:systems',
                'updates:applications',
                'backup:procedures'
            ];
            maintenanceQueries.forEach(query => {
                predictions.push({
                    query,
                    probability: 0.6,
                    expectedTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
                    mvpLevel: this.mvpLevel,
                    priority: 5
                });
            });
        }
        return predictions;
    }
    async warmPrediction(prediction) {
        const startTime = Date.now();
        try {
            await this.cacheManager.get(prediction.query, () => this.generateMockData(prediction.query), {
                priority: 'low',
                ttl: 60 * 60 * 1000,
                tags: [prediction.category || 'general'],
                userContext: prediction.userContext
            });
            const timeSaved = Date.now() - startTime;
            return { success: true, timeSaved };
        }
        catch (error) {
            console.error('Failed to warm prediction:', prediction.query, error);
            return { success: false, timeSaved: 0 };
        }
    }
    async updateUserPattern(userId, query, category, timestamp) {
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
        if (!pattern.commonQueries.includes(query)) {
            pattern.commonQueries.push(query);
            if (pattern.commonQueries.length > 20) {
                pattern.commonQueries.shift();
            }
        }
        if (!pattern.preferredCategories.includes(category)) {
            pattern.preferredCategories.push(category);
        }
        const hour = timestamp.getHours();
        if (!pattern.activeHours.includes(hour)) {
            pattern.activeHours.push(hour);
        }
        const hoursSinceLastSeen = (timestamp.getTime() - pattern.lastSeen.getTime()) / (60 * 60 * 1000);
        if (hoursSinceLastSeen > 0) {
            pattern.searchVelocity = 1 / hoursSinceLastSeen;
        }
        pattern.lastSeen = timestamp;
        this.userPatterns.set(userId, pattern);
    }
    updateQueryPattern(query, timestamp) {
        const currentCount = this.queryPatterns.get(query) || 0;
        this.queryPatterns.set(query, currentCount + 1);
    }
    updateTimePattern(hour, query) {
        let hourlyQueries = this.timeBasedPatterns.get(hour);
        if (!hourlyQueries) {
            hourlyQueries = [];
            this.timeBasedPatterns.set(hour, hourlyQueries);
        }
        if (!hourlyQueries.includes(query)) {
            hourlyQueries.push(query);
            if (hourlyQueries.length > 50) {
                hourlyQueries.shift();
            }
        }
    }
    async getTrendingQueries() {
        try {
            const results = this.db.prepare(`
        SELECT query, COUNT(*) as frequency
        FROM search_history
        WHERE timestamp > datetime('now', '-24 hours')
        GROUP BY query
        HAVING frequency >= ?
        ORDER BY frequency DESC
        LIMIT 20
      `).all(this.config.minPatternFrequency);
            return results;
        }
        catch (error) {
            console.error('Error getting trending queries:', error);
            return [];
        }
    }
    extractCategory(query) {
        if (query.includes('category:')) {
            return query.split('category:')[1].split(' ')[0];
        }
        const categories = ['JCL', 'VSAM', 'DB2', 'Batch', 'CICS', 'IMS'];
        for (const category of categories) {
            if (query.toLowerCase().includes(category.toLowerCase())) {
                return category;
            }
        }
        return 'General';
    }
    async generateMockData(query) {
        if (query.startsWith('popular:')) {
            return { type: 'popular', entries: [], timestamp: Date.now() };
        }
        if (query.startsWith('category:')) {
            return { type: 'category', entries: [], category: this.extractCategory(query) };
        }
        return { type: 'general', results: [], query };
    }
    recordSuccessfulPrediction(prediction) {
        this.stats.successfulPredictions++;
        this.stats.accuracy = this.stats.successfulPredictions / this.stats.totalWarmed;
    }
    async recordInteraction(userId, query, category, responseTime, timestamp) {
        try {
            this.db.prepare(`
        INSERT INTO warming_interactions (
          user_id, query, category, response_time, timestamp, mvp_level
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(userId, query, category, responseTime, timestamp.toISOString(), this.mvpLevel);
        }
        catch (error) {
            console.error('Error recording interaction:', error);
        }
    }
    getTopPatterns() {
        const patterns = Array.from(this.queryPatterns.entries())
            .filter(([_, frequency]) => frequency >= this.config.minPatternFrequency)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([pattern, frequency]) => ({
            pattern,
            frequency,
            avgTimeSaved: 150
        }));
        return patterns;
    }
    initializePatternTables() {
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
        }
        catch (error) {
            console.error('❌ Failed to initialize pattern tables:', error);
        }
    }
    async loadHistoricalPatterns() {
        try {
            const userInteractions = this.db.prepare(`
        SELECT user_id, query, category, timestamp
        FROM warming_interactions
        WHERE timestamp > datetime('now', '-${this.config.userHistoryDays} days')
        ORDER BY timestamp DESC
      `).all();
            const userGroups = new Map();
            for (const interaction of userInteractions) {
                const userId = interaction.user_id;
                if (!userGroups.has(userId)) {
                    userGroups.set(userId, []);
                }
                userGroups.get(userId).push(interaction);
            }
            for (const [userId, interactions] of userGroups) {
                const pattern = {
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
        }
        catch (error) {
            console.error('Error loading historical patterns:', error);
        }
    }
    startWarmingProcesses() {
        setInterval(() => {
            this.executeWarming().catch(error => {
                console.error('Continuous warming failed:', error);
            });
        }, 5 * 60 * 1000);
        setInterval(() => {
            this.generatePredictions().then(predictions => {
                return this.executeWarming(predictions);
            }).catch(error => {
                console.error('Hourly warming failed:', error);
            });
        }, 60 * 60 * 1000);
        setInterval(() => {
            this.optimizePatterns();
        }, 24 * 60 * 60 * 1000);
    }
    optimizePatterns() {
        console.log('🧠 Optimizing warming patterns...');
        const cutoffTime = Date.now() - (this.config.userHistoryDays * 24 * 60 * 60 * 1000);
        for (const [userId, pattern] of this.userPatterns) {
            if (pattern.lastSeen.getTime() < cutoffTime) {
                this.userPatterns.delete(userId);
            }
        }
        this.stats.topPatterns = this.getTopPatterns();
        console.log('✅ Pattern optimization completed');
    }
}
exports.CacheWarmingEngine = CacheWarmingEngine;
//# sourceMappingURL=CacheWarmingEngine.js.map