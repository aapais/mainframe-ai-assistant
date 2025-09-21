/**
 * Advanced Usage Patterns for Database Utilities System
 * 
 * This file demonstrates sophisticated usage patterns including:
 * - Custom query strategies and optimization
 * - Advanced caching patterns
 * - Performance tuning and monitoring
 * - Enterprise integration patterns
 * - Error handling and recovery strategies
 * - Batch operations and bulk processing
 */

import { KnowledgeDB, createKnowledgeDB } from '../src/database/KnowledgeDB';
import { KBEntry, SearchResult } from '../src/types/index';
import { EventEmitter } from 'events';

// ==============================================
// 1. CUSTOM QUERY STRATEGIES
// ==============================================

/**
 * Example: Custom Search Strategy Implementation
 * Shows how to implement domain-specific search logic
 */
class MainframeSearchStrategy {
  constructor(private db: KnowledgeDB) {}
  
  /**
   * Mainframe error code search with intelligent routing
   */
  async searchErrorCode(errorCode: string): Promise<SearchResult[]> {
    // Normalize common mainframe error patterns
    const normalizedCode = this.normalizeErrorCode(errorCode);
    
    // Try exact match first for known error patterns
    let results = await this.db.search(`"${normalizedCode}"`, { limit: 5 });
    
    if (results.length === 0) {
      // Fall back to broader search
      results = await this.db.search(normalizedCode, { 
        fuzzyThreshold: 0.6,
        limit: 10 
      });
    }
    
    // Enhance results with error code analysis
    return results.map(result => ({
      ...result,
      score: this.calculateErrorCodeRelevance(result, normalizedCode),
      highlights: this.generateErrorCodeHighlights(result, normalizedCode)
    }));
  }
  
  /**
   * Component-specific search with category weighting
   */
  async searchByComponent(component: string, problem: string): Promise<SearchResult[]> {
    const componentMap: Record<string, string> = {
      'vsam': 'VSAM',
      'db2': 'DB2',
      'ims': 'IMS',
      'cics': 'CICS',
      'jcl': 'JCL',
      'cobol': 'Batch'
    };
    
    const category = componentMap[component.toLowerCase()];
    
    // Primary search in specific category
    const primaryResults = await this.db.search(problem, {
      category,
      limit: 5,
      sortBy: 'relevance'
    });
    
    // Secondary search across all categories
    const secondaryResults = await this.db.search(`${component} ${problem}`, {
      limit: 5,
      sortBy: 'usage'
    });
    
    // Merge and deduplicate results
    return this.mergeAndRankResults(primaryResults, secondaryResults, category);
  }
  
  /**
   * Temporal search for trending issues
   */
  async searchTrendingIssues(timeframe: '24h' | '7d' | '30d' = '7d'): Promise<SearchResult[]> {
    // This would integrate with usage metrics to find trending issues
    const popular = await this.db.getPopular(10);
    
    // Filter for recent activity and high failure rates
    return popular.filter(result => {
      const successRate = result.entry.success_count! / 
        Math.max(1, result.entry.usage_count!);
      return successRate < 0.8; // Issues with <80% success rate
    });
  }
  
  private normalizeErrorCode(code: string): string {
    // Normalize common mainframe error patterns
    return code
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/ERROR|CODE|STATUS/gi, '');
  }
  
  private calculateErrorCodeRelevance(result: SearchResult, errorCode: string): number {
    const content = `${result.entry.title} ${result.entry.problem} ${result.entry.solution}`;
    const codeMatches = (content.match(new RegExp(errorCode, 'gi')) || []).length;
    
    return Math.min(100, result.score + (codeMatches * 10));
  }
  
  private generateErrorCodeHighlights(result: SearchResult, errorCode: string): string[] {
    const highlights: string[] = [];
    const regex = new RegExp(`(.{0,30}${errorCode}.{0,30})`, 'gi');
    
    [result.entry.title, result.entry.problem, result.entry.solution].forEach(text => {
      const matches = text.match(regex);
      if (matches) {
        highlights.push(...matches);
      }
    });
    
    return highlights.slice(0, 3);
  }
  
  private mergeAndRankResults(primary: SearchResult[], secondary: SearchResult[], category?: string): SearchResult[] {
    const seen = new Set<string>();
    const merged: SearchResult[] = [];
    
    // Add primary results with category boost
    primary.forEach(result => {
      if (!seen.has(result.entry.id!)) {
        seen.add(result.entry.id!);
        merged.push({
          ...result,
          score: result.entry.category === category ? result.score * 1.2 : result.score
        });
      }
    });
    
    // Add secondary results
    secondary.forEach(result => {
      if (!seen.has(result.entry.id!)) {
        seen.add(result.entry.id!);
        merged.push(result);
      }
    });
    
    return merged.sort((a, b) => b.score - a.score);
  }
}

// ==============================================
// 2. ADVANCED CACHING PATTERNS
// ==============================================

/**
 * Example: Smart Cache Management
 * Shows advanced caching strategies with intelligent invalidation
 */
class SmartCacheManager {
  constructor(private db: KnowledgeDB) {}
  
  /**
   * Multi-layer caching with automatic warm-up
   */
  async setupIntelligentCaching(): Promise<void> {
    console.log('🧠 Setting up intelligent caching...');
    
    // Pre-warm cache with common searches
    const commonQueries = [
      'VSAM status 35',
      'S0C7 data exception', 
      'JCL error',
      'DB2 deadlock',
      'file not found',
      'category:VSAM',
      'category:JCL',
      'category:Batch'
    ];
    
    console.log('Pre-warming cache with common queries...');
    for (const query of commonQueries) {
      await this.db.search(query, { limit: 10 });
    }
    
    // Pre-warm with popular entries
    await this.db.getPopular(20);
    
    console.log('✅ Cache pre-warmed');
  }
  
  /**
   * Context-aware cache invalidation
   */
  async smartCacheInvalidation(updatedEntry: KBEntry): Promise<void> {
    const tagsToInvalidate: string[] = ['search'];
    
    // Add category-specific tags
    if (updatedEntry.category) {
      tagsToInvalidate.push(`category:${updatedEntry.category}`);
    }
    
    // Add tag-specific invalidations
    if (updatedEntry.tags) {
      updatedEntry.tags.forEach(tag => {
        tagsToInvalidate.push(`tag:${tag}`);
      });
    }
    
    // Invalidate related cache entries
    await this.db.invalidateCache(undefined, tagsToInvalidate);
    
    console.log(`Cache invalidated for tags: ${tagsToInvalidate.join(', ')}`);
  }
  
  /**
   * Adaptive cache sizing based on memory pressure
   */
  async adaptiveCacheSizing(): Promise<void> {
    const cacheStats = this.db.getCacheStats();
    const memoryUsageMB = cacheStats.memoryUsage / 1024 / 1024;
    
    console.log(`Current cache memory usage: ${memoryUsageMB.toFixed(2)} MB`);
    
    // If memory usage is high and hit rate is low, clear some cache
    if (memoryUsageMB > 100 && cacheStats.hitRate < 0.6) {
      console.log('High memory usage with low hit rate, clearing old cache entries');
      await this.db.invalidateCache('search:*');
    }
    
    // If hit rate is very high, we can afford to keep more cache
    if (cacheStats.hitRate > 0.9) {
      console.log('Excellent hit rate, cache is well-optimized');
    }
  }
}

// ==============================================
// 3. PERFORMANCE TUNING AND MONITORING
// ==============================================

/**
 * Example: Advanced Performance Monitor
 * Implements custom performance monitoring with alerting
 */
class AdvancedPerformanceMonitor extends EventEmitter {
  private db: KnowledgeDB;
  private monitoringInterval?: NodeJS.Timeout;
  private metrics: Map<string, number[]> = new Map();
  
  constructor(db: KnowledgeDB) {
    super();
    this.db = db;
  }
  
  /**
   * Start comprehensive performance monitoring
   */
  startMonitoring(intervalMs: number = 30000): void {
    console.log('📊 Starting advanced performance monitoring...');
    
    this.monitoringInterval = setInterval(async () => {
      await this.collectMetrics();
      await this.analyzePerformance();
      await this.checkThresholds();
    }, intervalMs);
  }
  
  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
      console.log('⏹️ Performance monitoring stopped');
    }
  }
  
  /**
   * Collect comprehensive metrics
   */
  private async collectMetrics(): Promise<void> {
    const health = await this.db.healthCheck();
    const stats = await this.db.getStats();
    const cacheStats = this.db.getCacheStats();
    const perfStatus = this.db.getPerformanceStatus();
    
    // Measure search performance
    const searchStart = performance.now();
    await this.db.search('test performance');
    const searchTime = performance.now() - searchStart;
    
    // Store metrics
    this.addMetric('searchTime', searchTime);
    this.addMetric('cacheHitRate', cacheStats.hitRate);
    this.addMetric('totalEntries', stats.totalEntries);
    this.addMetric('memoryUsage', cacheStats.memoryUsage / 1024 / 1024);
    this.addMetric('diskUsage', stats.diskUsage / 1024 / 1024);
  }
  
  /**
   * Analyze performance trends
   */
  private async analyzePerformance(): Promise<void> {
    const trends = this.calculateTrends();
    
    // Detect performance degradation
    if (trends.searchTime && trends.searchTime > 1.2) {
      this.emit('performance-degradation', {
        metric: 'searchTime',
        trend: trends.searchTime,
        recommendation: 'Consider running database optimization'
      });
    }
    
    // Detect memory pressure
    if (trends.memoryUsage && trends.memoryUsage > 1.3) {
      this.emit('memory-pressure', {
        metric: 'memoryUsage', 
        trend: trends.memoryUsage,
        recommendation: 'Consider clearing cache or reducing cache size'
      });
    }
    
    // Detect low cache efficiency
    const cacheHitRate = this.getAverageMetric('cacheHitRate');
    if (cacheHitRate < 0.5) {
      this.emit('cache-inefficiency', {
        metric: 'cacheHitRate',
        value: cacheHitRate,
        recommendation: 'Review caching strategy and pre-warm frequently used queries'
      });
    }
  }
  
  /**
   * Check performance thresholds and emit alerts
   */
  private async checkThresholds(): Promise<void> {
    const thresholds = {
      searchTime: 1000,      // 1 second
      memoryUsage: 200,      // 200 MB
      cacheHitRate: 0.6      // 60%
    };
    
    const current = {
      searchTime: this.getAverageMetric('searchTime'),
      memoryUsage: this.getAverageMetric('memoryUsage'),
      cacheHitRate: this.getAverageMetric('cacheHitRate')
    };
    
    // Check thresholds
    if (current.searchTime > thresholds.searchTime) {
      this.emit('threshold-exceeded', {
        metric: 'searchTime',
        current: current.searchTime,
        threshold: thresholds.searchTime
      });
    }
    
    if (current.memoryUsage > thresholds.memoryUsage) {
      this.emit('threshold-exceeded', {
        metric: 'memoryUsage',
        current: current.memoryUsage,
        threshold: thresholds.memoryUsage
      });
    }
    
    if (current.cacheHitRate < thresholds.cacheHitRate) {
      this.emit('threshold-exceeded', {
        metric: 'cacheHitRate',
        current: current.cacheHitRate,
        threshold: thresholds.cacheHitRate
      });
    }
  }
  
  private addMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const values = this.metrics.get(name)!;
    values.push(value);
    
    // Keep only last 20 values
    if (values.length > 20) {
      values.shift();
    }
  }
  
  private getAverageMetric(name: string): number {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return 0;
    
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
  
  private calculateTrends(): Record<string, number> {
    const trends: Record<string, number> = {};
    
    for (const [name, values] of this.metrics) {
      if (values.length < 4) continue;
      
      const recent = values.slice(-3);
      const older = values.slice(-6, -3);
      
      if (older.length === 0) continue;
      
      const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
      const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length;
      
      trends[name] = recentAvg / olderAvg;
    }
    
    return trends;
  }
}

// ==============================================
// 4. ENTERPRISE INTEGRATION PATTERNS
// ==============================================

/**
 * Example: Enterprise Service Bus Integration
 * Shows how to integrate with enterprise systems
 */
class EnterpriseKnowledgeService {
  constructor(private db: KnowledgeDB) {}
  
  /**
   * ServiceNow incident integration
   */
  async integrateWithServiceNow(incident: any): Promise<SearchResult[]> {
    console.log('🔌 Integrating with ServiceNow incident:', incident.number);
    
    // Extract relevant information from ServiceNow incident
    const searchTerms = this.extractSearchTerms(incident);
    
    // Perform intelligent search
    const results = await this.db.search(searchTerms, {
      limit: 10,
      sortBy: 'relevance'
    });
    
    // Enhance results with ServiceNow context
    const enhancedResults = results.map(result => ({
      ...result,
      serviceNowMatch: this.calculateServiceNowRelevance(result, incident),
      suggestedActions: this.generateServiceNowActions(result, incident)
    }));
    
    // Log integration for analytics
    await this.logServiceNowIntegration(incident, enhancedResults);
    
    return enhancedResults;
  }
  
  /**
   * JIRA issue integration
   */
  async integrateWithJira(issue: any): Promise<{
    knowledgeMatches: SearchResult[];
    suggestedLabels: string[];
    estimatedResolutionTime: number;
  }> {
    console.log('🔌 Integrating with JIRA issue:', issue.key);
    
    // Search for similar issues
    const matches = await this.db.search(issue.summary + ' ' + issue.description, {
      limit: 5,
      sortBy: 'success_rate'
    });
    
    // Extract suggested labels from matches
    const suggestedLabels = this.extractSuggestedLabels(matches);
    
    // Estimate resolution time based on historical data
    const estimatedTime = this.estimateResolutionTime(matches);
    
    return {
      knowledgeMatches: matches,
      suggestedLabels,
      estimatedResolutionTime: estimatedTime
    };
  }
  
  /**
   * Splunk log analysis integration
   */
  async integrateSplunkLogs(logData: any[]): Promise<{
    detectedPatterns: string[];
    relatedKnowledge: SearchResult[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  }> {
    console.log('📊 Analyzing Splunk logs for patterns...');
    
    // Extract error patterns from logs
    const patterns = this.extractErrorPatterns(logData);
    
    // Search knowledge base for each pattern
    const allMatches: SearchResult[] = [];
    for (const pattern of patterns) {
      const matches = await this.db.search(pattern, { limit: 3 });
      allMatches.push(...matches);
    }
    
    // Calculate risk level based on patterns and matches
    const riskLevel = this.calculateRiskLevel(patterns, allMatches);
    
    return {
      detectedPatterns: patterns,
      relatedKnowledge: this.deduplicateResults(allMatches),
      riskLevel
    };
  }
  
  private extractSearchTerms(incident: any): string {
    const terms = [];
    
    if (incident.short_description) terms.push(incident.short_description);
    if (incident.description) terms.push(incident.description);
    if (incident.work_notes) terms.push(incident.work_notes);
    
    return terms.join(' ');
  }
  
  private calculateServiceNowRelevance(result: SearchResult, incident: any): number {
    let relevance = result.score;
    
    // Boost for category matches
    if (incident.category && result.entry.category?.toLowerCase().includes(incident.category.toLowerCase())) {
      relevance += 10;
    }
    
    // Boost for priority matches
    if (incident.priority && result.entry.severity) {
      const priorityMap: Record<string, string> = {
        '1': 'critical',
        '2': 'high', 
        '3': 'medium',
        '4': 'low'
      };
      
      if (priorityMap[incident.priority] === result.entry.severity) {
        relevance += 5;
      }
    }
    
    return Math.min(100, relevance);
  }
  
  private generateServiceNowActions(result: SearchResult, incident: any): string[] {
    const actions = [];
    
    actions.push('Review suggested solution from knowledge base');
    actions.push('Update incident work notes with knowledge reference');
    
    if (result.entry.success_count && result.entry.success_count > 5) {
      actions.push('This solution has high success rate - prioritize implementation');
    }
    
    if (result.entry.tags?.includes('escalation-needed')) {
      actions.push('Consider escalating based on historical patterns');
    }
    
    return actions;
  }
  
  private async logServiceNowIntegration(incident: any, results: SearchResult[]): Promise<void> {
    // This would log to analytics system
    console.log(`ServiceNow integration logged: ${incident.number} -> ${results.length} matches`);
  }
  
  private extractSuggestedLabels(matches: SearchResult[]): string[] {
    const labelCounts = new Map<string, number>();
    
    matches.forEach(match => {
      match.entry.tags?.forEach(tag => {
        labelCounts.set(tag, (labelCounts.get(tag) || 0) + 1);
      });
    });
    
    return Array.from(labelCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label]) => label);
  }
  
  private estimateResolutionTime(matches: SearchResult[]): number {
    if (matches.length === 0) return 240; // 4 hours default
    
    // Simple estimation based on complexity indicated by solution length
    const avgSolutionLength = matches.reduce((sum, match) => 
      sum + match.entry.solution.length, 0) / matches.length;
    
    // More complex solutions = longer resolution time
    if (avgSolutionLength > 1000) return 480; // 8 hours
    if (avgSolutionLength > 500) return 240;  // 4 hours
    return 120; // 2 hours
  }
  
  private extractErrorPatterns(logData: any[]): string[] {
    const patterns = new Set<string>();
    
    logData.forEach(log => {
      const message = log.message || log._raw || '';
      
      // Extract error codes
      const errorCodes = message.match(/[A-Z]\d{3,4}[A-Z]?|S\d{3}[A-Z]?/g);
      if (errorCodes) {
        errorCodes.forEach(code => patterns.add(code));
      }
      
      // Extract common error keywords
      const keywords = message.match(/\b(error|exception|failed|timeout|deadlock|abort)\b/gi);
      if (keywords) {
        keywords.forEach(keyword => patterns.add(keyword.toLowerCase()));
      }
    });
    
    return Array.from(patterns);
  }
  
  private calculateRiskLevel(patterns: string[], matches: SearchResult[]): 'low' | 'medium' | 'high' | 'critical' {
    let riskScore = 0;
    
    // More patterns = higher risk
    riskScore += patterns.length * 10;
    
    // Critical error codes
    const criticalPatterns = ['S0C7', 'S0C4', 'S013', 'IEF450I'];
    criticalPatterns.forEach(pattern => {
      if (patterns.includes(pattern)) riskScore += 50;
    });
    
    // Low success rate matches = higher risk
    matches.forEach(match => {
      const successRate = (match.entry.success_count || 0) / Math.max(1, match.entry.usage_count || 1);
      if (successRate < 0.5) riskScore += 20;
    });
    
    if (riskScore >= 150) return 'critical';
    if (riskScore >= 100) return 'high';
    if (riskScore >= 50) return 'medium';
    return 'low';
  }
  
  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
      if (seen.has(result.entry.id!)) {
        return false;
      }
      seen.add(result.entry.id!);
      return true;
    });
  }
}

// ==============================================
// 5. BATCH OPERATIONS AND BULK PROCESSING
// ==============================================

/**
 * Example: Batch Operations Manager
 * Handles bulk operations with progress tracking and error recovery
 */
class BatchOperationsManager extends EventEmitter {
  constructor(private db: KnowledgeDB) {
    super();
  }
  
  /**
   * Bulk import with progress tracking and validation
   */
  async bulkImport(entries: Partial<KBEntry>[], options: {
    batchSize?: number;
    validateBeforeInsert?: boolean;
    continueOnError?: boolean;
    progressCallback?: (progress: { completed: number; total: number; errors: number }) => void;
  } = {}): Promise<{
    imported: number;
    errors: Array<{ entry: Partial<KBEntry>; error: string }>;
    duration: number;
  }> {
    const startTime = Date.now();
    const batchSize = options.batchSize || 100;
    const errors: Array<{ entry: Partial<KBEntry>; error: string }> = [];
    let imported = 0;
    
    console.log(`📥 Starting bulk import of ${entries.length} entries...`);
    
    // Process in batches
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      
      try {
        const batchResults = await this.processBatch(batch, options.validateBeforeInsert || false);
        imported += batchResults.success;
        errors.push(...batchResults.errors);
        
        // Report progress
        if (options.progressCallback) {
          options.progressCallback({
            completed: Math.min(i + batchSize, entries.length),
            total: entries.length,
            errors: errors.length
          });
        }
        
        // Emit progress event
        this.emit('batch-progress', {
          batch: Math.floor(i / batchSize) + 1,
          completed: imported,
          errors: errors.length
        });
        
      } catch (error) {
        console.error(`Batch ${Math.floor(i / batchSize) + 1} failed:`, error);
        
        if (!options.continueOnError) {
          throw error;
        }
        
        // Add all batch entries to errors
        batch.forEach(entry => {
          errors.push({ entry, error: error instanceof Error ? error.message : String(error) });
        });
      }
    }
    
    const duration = Date.now() - startTime;
    console.log(`✅ Bulk import completed: ${imported} imported, ${errors.length} errors, ${duration}ms`);
    
    return { imported, errors, duration };
  }
  
  /**
   * Bulk update with optimistic concurrency
   */
  async bulkUpdate(
    updates: Array<{ id: string; updates: Partial<KBEntry> }>,
    options: { batchSize?: number } = {}
  ): Promise<{
    updated: number;
    errors: Array<{ id: string; error: string }>;
  }> {
    const batchSize = options.batchSize || 50;
    const errors: Array<{ id: string; error: string }> = [];
    let updated = 0;
    
    console.log(`📝 Starting bulk update of ${updates.length} entries...`);
    
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      // Process batch updates
      const promises = batch.map(async ({ id, updates: entryUpdates }) => {
        try {
          await this.db.updateEntry(id, entryUpdates);
          return { success: true, id };
        } catch (error) {
          return { 
            success: false, 
            id, 
            error: error instanceof Error ? error.message : String(error) 
          };
        }
      });
      
      const results = await Promise.all(promises);
      
      results.forEach(result => {
        if (result.success) {
          updated++;
        } else {
          errors.push({ id: result.id, error: result.error });
        }
      });
      
      // Small delay between batches to avoid overwhelming the database
      if (i + batchSize < updates.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`✅ Bulk update completed: ${updated} updated, ${errors.length} errors`);
    return { updated, errors };
  }
  
  /**
   * Bulk analysis and reporting
   */
  async analyzeBulkData(entries: KBEntry[]): Promise<{
    categories: Record<string, number>;
    averageLength: { title: number; problem: number; solution: number };
    tagDistribution: Record<string, number>;
    severityDistribution: Record<string, number>;
    qualityScore: number;
    recommendations: string[];
  }> {
    console.log(`📊 Analyzing ${entries.length} entries...`);
    
    const categories: Record<string, number> = {};
    const tagCounts: Record<string, number> = {};
    const severityCounts: Record<string, number> = {};
    let totalTitleLength = 0;
    let totalProblemLength = 0;
    let totalSolutionLength = 0;
    const qualityIssues: string[] = [];
    
    entries.forEach(entry => {
      // Count categories
      categories[entry.category] = (categories[entry.category] || 0) + 1;
      
      // Count severities
      const severity = entry.severity || 'medium';
      severityCounts[severity] = (severityCounts[severity] || 0) + 1;
      
      // Count tags
      entry.tags?.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
      
      // Length analysis
      totalTitleLength += entry.title.length;
      totalProblemLength += entry.problem.length;
      totalSolutionLength += entry.solution.length;
      
      // Quality checks
      if (entry.title.length < 10) qualityIssues.push('Short titles detected');
      if (entry.solution.length < 50) qualityIssues.push('Very short solutions detected');
      if (!entry.tags || entry.tags.length === 0) qualityIssues.push('Entries without tags detected');
    });
    
    const count = entries.length;
    const averageLength = {
      title: Math.round(totalTitleLength / count),
      problem: Math.round(totalProblemLength / count), 
      solution: Math.round(totalSolutionLength / count)
    };
    
    // Calculate quality score (0-100)
    let qualityScore = 100;
    qualityScore -= Math.min(30, qualityIssues.length * 5); // Deduct for quality issues
    
    // Generate recommendations
    const recommendations: string[] = [];
    if (averageLength.solution < 100) {
      recommendations.push('Consider adding more detailed solutions');
    }
    if (Object.keys(tagCounts).length / count < 2) {
      recommendations.push('Add more tags to improve searchability');
    }
    if (severityCounts['critical'] || 0 > count * 0.3) {
      recommendations.push('High percentage of critical issues - consider prioritization');
    }
    
    return {
      categories,
      averageLength,
      tagDistribution: tagCounts,
      severityDistribution: severityCounts,
      qualityScore,
      recommendations
    };
  }
  
  private async processBatch(
    batch: Partial<KBEntry>[], 
    validate: boolean
  ): Promise<{
    success: number;
    errors: Array<{ entry: Partial<KBEntry>; error: string }>;
  }> {
    const errors: Array<{ entry: Partial<KBEntry>; error: string }> = [];
    let success = 0;
    
    for (const entry of batch) {
      try {
        // Validation if requested
        if (validate) {
          this.validateEntry(entry);
        }
        
        // Ensure required fields
        const completeEntry: KBEntry = {
          title: entry.title || 'Untitled',
          problem: entry.problem || 'No problem description',
          solution: entry.solution || 'No solution provided',
          category: entry.category || 'Other',
          ...entry
        };
        
        await this.db.addEntry(completeEntry, 'bulk-import');
        success++;
        
      } catch (error) {
        errors.push({ 
          entry, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }
    
    return { success, errors };
  }
  
  private validateEntry(entry: Partial<KBEntry>): void {
    if (!entry.title || entry.title.trim().length === 0) {
      throw new Error('Title is required');
    }
    
    if (!entry.problem || entry.problem.trim().length === 0) {
      throw new Error('Problem description is required');
    }
    
    if (!entry.solution || entry.solution.trim().length === 0) {
      throw new Error('Solution is required');
    }
    
    if (entry.title.length > 200) {
      throw new Error('Title is too long (max 200 characters)');
    }
  }
}

// ==============================================
// MAIN EXECUTION EXAMPLES
// ==============================================

/**
 * Example: Comprehensive Advanced Usage
 * Demonstrates all advanced patterns working together
 */
async function demonstrateAdvancedPatterns() {
  console.log('🚀 Demonstrating Advanced Database Patterns\n');
  
  const db = await createKnowledgeDB('./examples/advanced-knowledge.db', {
    autoBackup: true,
    backupInterval: 6
  });
  
  try {
    // 1. Custom Search Strategies
    console.log('=== Custom Search Strategies ===');
    const searchStrategy = new MainframeSearchStrategy(db);
    
    // Add some test data first
    await db.addEntry({
      title: 'VSAM Status 35 File Access Error',
      problem: 'Program receives VSAM status 35 when trying to open file',
      solution: 'Check file cataloging and permissions',
      category: 'VSAM',
      tags: ['vsam', 'status-35', 'file-error']
    });
    
    const errorResults = await searchStrategy.searchErrorCode('STATUS 35');
    console.log(`Error code search found ${errorResults.length} results`);
    
    // 2. Advanced Caching
    console.log('\n=== Smart Cache Management ===');
    const cacheManager = new SmartCacheManager(db);
    await cacheManager.setupIntelligentCaching();
    await cacheManager.adaptiveCacheSizing();
    
    // 3. Performance Monitoring
    console.log('\n=== Advanced Performance Monitoring ===');
    const perfMonitor = new AdvancedPerformanceMonitor(db);
    
    // Set up event listeners
    perfMonitor.on('performance-degradation', (data) => {
      console.log('⚠️ Performance degradation detected:', data.recommendation);
    });
    
    perfMonitor.on('memory-pressure', (data) => {
      console.log('💾 Memory pressure detected:', data.recommendation);
    });
    
    perfMonitor.on('cache-inefficiency', (data) => {
      console.log('🗄️ Cache inefficiency detected:', data.recommendation);
    });
    
    // Start monitoring briefly
    perfMonitor.startMonitoring(5000); // 5 second intervals
    await new Promise(resolve => setTimeout(resolve, 15000)); // Monitor for 15 seconds
    perfMonitor.stopMonitoring();
    
    // 4. Enterprise Integration
    console.log('\n=== Enterprise Integration ===');
    const enterpriseService = new EnterpriseKnowledgeService(db);
    
    // Mock ServiceNow incident
    const mockIncident = {
      number: 'INC0001234',
      short_description: 'VSAM file access error in production',
      description: 'Users unable to access VSAM file, getting status 35',
      category: 'Database',
      priority: '2'
    };
    
    const serviceNowResults = await enterpriseService.integrateWithServiceNow(mockIncident);
    console.log(`ServiceNow integration found ${serviceNowResults.length} relevant solutions`);
    
    // 5. Batch Operations
    console.log('\n=== Batch Operations ===');
    const batchManager = new BatchOperationsManager(db);
    
    // Generate test data for bulk operations
    const bulkEntries: Partial<KBEntry>[] = Array.from({ length: 50 }, (_, i) => ({
      title: `Bulk Test Entry ${i + 1}`,
      problem: `Test problem description for entry ${i + 1}`,
      solution: `Test solution for entry ${i + 1}`,
      category: ['VSAM', 'JCL', 'DB2', 'Batch'][i % 4],
      tags: [`test-${i}`, 'bulk-import']
    }));
    
    const bulkResult = await batchManager.bulkImport(bulkEntries, {
      batchSize: 10,
      validateBeforeInsert: true,
      progressCallback: (progress) => {
        console.log(`Import progress: ${progress.completed}/${progress.total} (${progress.errors} errors)`);
      }
    });
    
    console.log(`Bulk import result: ${bulkResult.imported} imported, ${bulkResult.errors.length} errors`);
    
    // Analyze the bulk data
    const allEntries = await db.search('', { limit: 1000, includeArchived: true });
    const analysis = await batchManager.analyzeBulkData(allEntries.map(r => r.entry));
    
    console.log('Database Analysis:');
    console.log(`- Categories:`, analysis.categories);
    console.log(`- Quality Score: ${analysis.qualityScore}/100`);
    console.log(`- Recommendations:`, analysis.recommendations);
    
  } catch (error) {
    console.error('Error in advanced patterns demo:', error);
  } finally {
    await db.close();
  }
}

// Export all classes and functions for individual use
export {
  MainframeSearchStrategy,
  SmartCacheManager,
  AdvancedPerformanceMonitor,
  EnterpriseKnowledgeService,
  BatchOperationsManager,
  demonstrateAdvancedPatterns
};

// Run demonstration if called directly
if (require.main === module) {
  demonstrateAdvancedPatterns();
}