"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryAnalyzer = void 0;
class QueryAnalyzer {
    patterns = new Map();
    clusters = new Map();
    queryHistory = [];
    textProcessor;
    config;
    constructor(config = {}) {
        this.config = {
            maxHistorySize: 10000,
            clusteringThreshold: 0.7,
            patternMinFrequency: 5,
            anomalyThreshold: 2.0,
            trendWindowDays: 30,
            ...config
        };
        this.initializeTextProcessor();
    }
    analyzeQuery(query, parsedQuery, executionTime, resultCount, userId) {
        this.recordQuery(query, executionTime, resultCount, userId);
        const pattern = this.identifyPattern(query, parsedQuery);
        const cluster = this.findOrCreateCluster(query, pattern);
        const anomalies = this.detectAnomalies(query, executionTime, resultCount);
        const insights = this.generateQueryInsights(query, pattern, cluster);
        return {
            pattern,
            cluster,
            anomalies,
            insights
        };
    }
    generateAnalysisReport(timeRange) {
        const filteredHistory = this.filterHistoryByTimeRange(timeRange);
        const totalQueries = filteredHistory.length;
        const uniqueQueries = new Set(filteredHistory.map(h => h.query)).size;
        const patternDistribution = this.calculatePatternDistribution(filteredHistory);
        const complexityDistribution = this.calculateComplexityDistribution(filteredHistory);
        const intentDistribution = this.calculateIntentDistribution(filteredHistory);
        const topPatterns = this.getTopPatterns(10);
        const clusters = Array.from(this.clusters.values());
        const anomalies = this.detectAnomaliesInRange(filteredHistory);
        const trends = this.calculateTrends(filteredHistory);
        const insights = this.generateInsights(filteredHistory, patterns, clusters);
        return {
            totalQueries,
            uniqueQueries,
            patternDistribution,
            complexityDistribution,
            intentDistribution,
            topPatterns,
            clusters,
            anomalies,
            trends,
            insights
        };
    }
    getPatternsByType(type) {
        return Array.from(this.patterns.values())
            .filter(pattern => pattern.type === type)
            .sort((a, b) => b.frequency - a.frequency);
    }
    getClusters() {
        return Array.from(this.clusters.values())
            .sort((a, b) => b.size - a.size);
    }
    findSimilarQueries(query, limit = 10) {
        const similarities = [];
        for (const historyItem of this.queryHistory) {
            if (historyItem.query === query)
                continue;
            const similarity = this.calculateQuerySimilarity(query, historyItem.query);
            if (similarity > 0.3) {
                const pattern = this.findPatternForQuery(historyItem.query);
                if (pattern) {
                    similarities.push({
                        query: historyItem.query,
                        similarity,
                        pattern
                    });
                }
            }
        }
        return similarities
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);
    }
    optimizeQuery(query) {
        const similarQueries = this.findSimilarQueries(query, 5);
        const pattern = this.identifyPattern(query, this.parseQuery(query));
        const optimizedQuery = query;
        const suggestions = [];
        let confidence = 0.5;
        let reasoning = 'No optimization patterns found';
        const successfulSimilar = similarQueries.filter(sq => sq.pattern.successRate > 0.8);
        if (successfulSimilar.length > 0) {
            const bestPattern = successfulSimilar[0].pattern;
            if (bestPattern.type === 'boolean_complex' && !query.includes('AND')) {
                suggestions.push('Consider using AND/OR operators for more precise results');
            }
            if (bestPattern.type === 'phrase_search' && !query.includes('"')) {
                suggestions.push('Try using quotes for exact phrase matching');
            }
            if (bestPattern.type === 'field_specific' && !query.includes(':')) {
                suggestions.push('Consider field-specific searches (e.g., title:keyword)');
            }
            confidence = Math.min(0.9, successfulSimilar[0].similarity + 0.1);
            reasoning = `Based on ${successfulSimilar.length} similar successful queries`;
        }
        return {
            optimizedQuery,
            suggestions,
            confidence,
            reasoning
        };
    }
    exportAnalysisData(format = 'json') {
        const data = {
            patterns: Array.from(this.patterns.values()),
            clusters: Array.from(this.clusters.values()),
            history: this.queryHistory,
            report: this.generateAnalysisReport()
        };
        if (format === 'csv') {
            return this.convertToCSV(data);
        }
        return JSON.stringify(data, null, 2);
    }
    initializeTextProcessor() {
        this.textProcessor = {
            tokenize: (text) => text.toLowerCase().split(/\s+/),
            stemWords: (words) => words,
            calculateJaccardSimilarity: (set1, set2) => {
                const intersection = new Set([...set1].filter(x => set2.has(x)));
                const union = new Set([...set1, ...set2]);
                return intersection.size / union.size;
            }
        };
    }
    recordQuery(query, executionTime, resultCount, userId) {
        this.queryHistory.push({
            query,
            timestamp: Date.now(),
            userId,
            results: resultCount,
            executionTime,
            success: resultCount > 0
        });
        if (this.queryHistory.length > this.config.maxHistorySize) {
            this.queryHistory.shift();
        }
    }
    identifyPattern(query, parsedQuery) {
        const patternKey = this.generatePatternKey(parsedQuery);
        let pattern = this.patterns.get(patternKey);
        if (!pattern) {
            pattern = this.createNewPattern(query, parsedQuery);
            this.patterns.set(patternKey, pattern);
        }
        else {
            this.updatePattern(pattern, query);
        }
        return pattern;
    }
    generatePatternKey(parsedQuery) {
        const components = [
            parsedQuery.type,
            parsedQuery.terms.length.toString(),
            parsedQuery.terms.map(t => t.operator).join('-'),
            parsedQuery.filters.length.toString()
        ];
        return components.join('|');
    }
    createNewPattern(query, parsedQuery) {
        const type = this.determinePatternType(parsedQuery);
        const complexity = this.calculateQueryComplexity(parsedQuery);
        const intent = this.classifyQueryIntent(query, parsedQuery);
        return {
            id: this.generatePatternId(),
            type,
            pattern: this.extractPattern(parsedQuery),
            examples: [query],
            frequency: 1,
            successRate: 1,
            averageResults: 0,
            complexity,
            intent,
            metadata: {
                firstSeen: Date.now(),
                lastSeen: Date.now(),
                userCount: 1,
                avgExecutionTime: 0,
                failureRate: 0
            }
        };
    }
    updatePattern(pattern, query) {
        pattern.frequency++;
        pattern.metadata.lastSeen = Date.now();
        if (!pattern.examples.includes(query)) {
            pattern.examples.push(query);
            if (pattern.examples.length > 10) {
                pattern.examples.shift();
            }
        }
    }
    determinePatternType(parsedQuery) {
        if (parsedQuery.type === 'phrase')
            return 'phrase_search';
        if (parsedQuery.type === 'boolean')
            return 'boolean_complex';
        if (parsedQuery.type === 'field')
            return 'field_specific';
        if (parsedQuery.terms.some(t => t.fuzzy))
            return 'fuzzy_search';
        if (parsedQuery.original.includes('*') || parsedQuery.original.includes('?')) {
            return 'wildcard_search';
        }
        const technicalPatterns = /\b(error|exception|debug|troubleshoot|fix|resolve)\b/i;
        if (technicalPatterns.test(parsedQuery.original)) {
            return 'troubleshooting';
        }
        const proceduralPatterns = /\b(how to|step|procedure|process|guide)\b/i;
        if (proceduralPatterns.test(parsedQuery.original)) {
            return 'procedural_search';
        }
        return 'keyword_search';
    }
    calculateQueryComplexity(parsedQuery) {
        let score = 0;
        score += parsedQuery.terms.length;
        score += parsedQuery.terms.filter(t => t.operator === 'AND' || t.operator === 'OR').length * 2;
        score += parsedQuery.terms.filter(t => t.field).length;
        score += parsedQuery.filters.length * 1.5;
        score += parsedQuery.terms.filter(t => t.fuzzy).length * 1.5;
        if (score <= 3)
            return 'simple';
        if (score <= 7)
            return 'moderate';
        if (score <= 12)
            return 'complex';
        return 'advanced';
    }
    classifyQueryIntent(query, parsedQuery) {
        const informationalPatterns = /\b(what|how|why|when|where|define|explain)\b/i;
        const navigationalPatterns = /\b(find|locate|search|show me)\b/i;
        const transactionalPatterns = /\b(download|export|save|generate|create)\b/i;
        const investigationalPatterns = /\b(analyze|compare|investigate|research)\b/i;
        if (investigationalPatterns.test(query))
            return 'investigational';
        if (transactionalPatterns.test(query))
            return 'transactional';
        if (navigationalPatterns.test(query))
            return 'navigational';
        if (informationalPatterns.test(query))
            return 'informational';
        return parsedQuery.terms.length > 3 ? 'investigational' : 'informational';
    }
    extractPattern(parsedQuery) {
        return parsedQuery.terms
            .map(t => `${t.field ? `${t.field  }:` : ''}[${t.operator}]`)
            .join(' ');
    }
    findOrCreateCluster(query, pattern) {
        for (const cluster of this.clusters.values()) {
            const similarity = this.calculateQuerySimilarity(query, cluster.centroid);
            if (similarity >= this.config.clusteringThreshold) {
                this.updateCluster(cluster, query);
                return cluster;
            }
        }
        const cluster = {
            id: this.generateClusterId(),
            centroid: query,
            queries: [query],
            pattern,
            cohesion: 1.0,
            size: 1,
            avgSimilarity: 1.0,
            representativeQueries: [query],
            metadata: {
                createdAt: Date.now(),
                lastUpdated: Date.now(),
                stability: 1.0,
                growth: 0
            }
        };
        this.clusters.set(cluster.id, cluster);
        return cluster;
    }
    updateCluster(cluster, query) {
        cluster.queries.push(query);
        cluster.size++;
        cluster.metadata.lastUpdated = Date.now();
        if (cluster.representativeQueries.length < 5) {
            cluster.representativeQueries.push(query);
        }
        this.recalculateClusterMetrics(cluster);
    }
    recalculateClusterMetrics(cluster) {
        let totalSimilarity = 0;
        let comparisons = 0;
        for (let i = 0; i < cluster.queries.length; i++) {
            for (let j = i + 1; j < cluster.queries.length; j++) {
                totalSimilarity += this.calculateQuerySimilarity(cluster.queries[i], cluster.queries[j]);
                comparisons++;
            }
        }
        cluster.avgSimilarity = comparisons > 0 ? totalSimilarity / comparisons : 1.0;
        cluster.cohesion = cluster.avgSimilarity;
    }
    calculateQuerySimilarity(query1, query2) {
        const tokens1 = new Set(this.textProcessor.tokenize(query1));
        const tokens2 = new Set(this.textProcessor.tokenize(query2));
        return this.textProcessor.calculateJaccardSimilarity(tokens1, tokens2);
    }
    detectAnomalies(query, executionTime, resultCount) {
        const anomalies = [];
        const avgExecutionTime = this.calculateAverageExecutionTime();
        if (executionTime > avgExecutionTime * this.config.anomalyThreshold) {
            anomalies.push({
                type: 'performance',
                query,
                score: executionTime / avgExecutionTime,
                description: `Query execution time (${executionTime}ms) is ${Math.round(executionTime / avgExecutionTime)}x above average`,
                detectedAt: Date.now(),
                severity: executionTime > avgExecutionTime * 3 ? 'high' : 'medium'
            });
        }
        if (resultCount === 0 && query.length > 3) {
            anomalies.push({
                type: 'pattern',
                query,
                score: 1.0,
                description: 'Query returned no results despite being well-formed',
                detectedAt: Date.now(),
                severity: 'medium'
            });
        }
        const queryFrequency = this.getQueryFrequency(query);
        const avgFrequency = this.calculateAverageQueryFrequency();
        if (queryFrequency > avgFrequency * 5) {
            anomalies.push({
                type: 'frequency',
                query,
                score: queryFrequency / avgFrequency,
                description: `Query appears much more frequently than average`,
                detectedAt: Date.now(),
                severity: 'low'
            });
        }
        return anomalies;
    }
    generateQueryInsights(query, pattern, cluster) {
        const insights = [];
        if (pattern.successRate < 0.5) {
            insights.push({
                type: 'optimization',
                description: `Queries with this pattern have low success rate (${Math.round(pattern.successRate * 100)}%)`,
                impact: 'high',
                actionable: true,
                recommendation: 'Consider refining query structure or expanding content coverage',
                confidence: 0.8
            });
        }
        if (cluster && cluster.size > 10) {
            insights.push({
                type: 'user_behavior',
                description: `Query belongs to a popular cluster with ${cluster.size} similar queries`,
                impact: 'medium',
                actionable: true,
                recommendation: 'Consider creating dedicated content or shortcuts for this topic',
                confidence: 0.7
            });
        }
        if (pattern.metadata.avgExecutionTime > 1000) {
            insights.push({
                type: 'performance',
                description: `Queries with this pattern are slow (${pattern.metadata.avgExecutionTime}ms avg)`,
                impact: 'medium',
                actionable: true,
                recommendation: 'Consider optimizing indexes or query structure',
                confidence: 0.9
            });
        }
        return insights;
    }
    calculateAverageExecutionTime() {
        if (this.queryHistory.length === 0)
            return 100;
        const total = this.queryHistory.reduce((sum, h) => sum + h.executionTime, 0);
        return total / this.queryHistory.length;
    }
    getQueryFrequency(query) {
        return this.queryHistory.filter(h => h.query === query).length;
    }
    calculateAverageQueryFrequency() {
        const queryFreqs = new Map();
        for (const history of this.queryHistory) {
            queryFreqs.set(history.query, (queryFreqs.get(history.query) || 0) + 1);
        }
        const frequencies = Array.from(queryFreqs.values());
        return frequencies.reduce((sum, freq) => sum + freq, 0) / frequencies.length || 1;
    }
    filterHistoryByTimeRange(timeRange) {
        if (!timeRange)
            return this.queryHistory;
        return this.queryHistory.filter(h => h.timestamp >= timeRange.from && h.timestamp <= timeRange.to);
    }
    calculatePatternDistribution(history) {
        const distribution = {
            keyword_search: 0,
            phrase_search: 0,
            boolean_complex: 0,
            field_specific: 0,
            fuzzy_search: 0,
            wildcard_search: 0,
            range_search: 0,
            nested_search: 0,
            technical_lookup: 0,
            troubleshooting: 0,
            procedural_search: 0
        };
        for (const item of history) {
            const pattern = this.findPatternForQuery(item.query);
            if (pattern) {
                distribution[pattern.type]++;
            }
        }
        return distribution;
    }
    calculateComplexityDistribution(history) {
        const distribution = {
            simple: 0,
            moderate: 0,
            complex: 0,
            advanced: 0
        };
        for (const item of history) {
            const pattern = this.findPatternForQuery(item.query);
            if (pattern) {
                distribution[pattern.complexity]++;
            }
        }
        return distribution;
    }
    calculateIntentDistribution(history) {
        const distribution = {
            informational: 0,
            navigational: 0,
            transactional: 0,
            investigational: 0
        };
        for (const item of history) {
            const pattern = this.findPatternForQuery(item.query);
            if (pattern) {
                distribution[pattern.intent]++;
            }
        }
        return distribution;
    }
    getTopPatterns(limit) {
        return Array.from(this.patterns.values())
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, limit);
    }
    detectAnomaliesInRange(history) {
        return [];
    }
    calculateTrends(history) {
        return [];
    }
    generateInsights(history, patterns, clusters) {
        const insights = [];
        const totalQueries = history.length;
        const successfulQueries = history.filter(h => h.success).length;
        const successRate = totalQueries > 0 ? successfulQueries / totalQueries : 0;
        if (successRate < 0.7) {
            insights.push({
                type: 'content_gap',
                description: `Overall search success rate is low (${Math.round(successRate * 100)}%)`,
                impact: 'high',
                actionable: true,
                recommendation: 'Review content coverage and search algorithms',
                confidence: 0.9
            });
        }
        return insights;
    }
    findPatternForQuery(query) {
        const parsedQuery = this.parseQuery(query);
        const patternKey = this.generatePatternKey(parsedQuery);
        return this.patterns.get(patternKey);
    }
    parseQuery(query) {
        return {
            type: 'simple',
            terms: [{
                    text: query,
                    operator: 'AND',
                    boost: 1,
                    fuzzy: false,
                    required: false,
                    prohibited: false
                }],
            filters: [],
            options: {},
            original: query,
            normalized: query.toLowerCase()
        };
    }
    convertToCSV(data) {
        return JSON.stringify(data);
    }
    generatePatternId() {
        return `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    generateClusterId() {
        return `cluster-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.QueryAnalyzer = QueryAnalyzer;
exports.default = QueryAnalyzer;
//# sourceMappingURL=QueryAnalyzer.js.map