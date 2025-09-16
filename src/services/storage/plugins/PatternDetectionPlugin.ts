/**
 * Pattern Detection Plugin (MVP2)
 * Detects patterns in incidents and tickets for proactive issue identification
 * 
 * This plugin implements advanced pattern recognition algorithms to identify
 * recurring issues, temporal correlations, and component degradation patterns.
 */

import { BaseStoragePlugin } from './BaseStoragePlugin';
import { IStorageAdapter } from '../adapters/IStorageAdapter';
import { PluginConfig } from '../IStorageService';

export interface Incident {
  id: string;
  ticket_id: string;
  timestamp: Date;
  title: string;
  description: string;
  component?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  resolution?: string;
  resolution_time?: number;
  kb_entry_id?: string;
  category?: string;
  tags?: string[];
}

export interface Pattern {
  id: string;
  type: 'temporal' | 'component' | 'error' | 'mixed';
  incidents: Incident[];
  confidence: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  first_seen: Date;
  last_seen: Date;
  frequency: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  suggested_cause?: string;
  suggested_action?: string;
  related_kb_entries?: string[];
  prevention_score?: number;
}

export interface PatternAnalysis {
  patterns: Pattern[];
  summary: {
    total_patterns: number;
    critical_patterns: number;
    new_patterns: number;
    escalating_patterns: number;
  };
  recommendations: string[];
  next_analysis: Date;
}

export interface PatternDetectionConfig extends PluginConfig {
  detection: {
    min_incidents_for_pattern: number;
    time_window_hours: number;
    similarity_threshold: number;
    alert_threshold: number;
    analysis_interval_minutes: number;
  };
  clustering: {
    temporal_sensitivity: number;
    component_grouping: boolean;
    error_code_matching: boolean;
    semantic_similarity: boolean;
  };
  alerting: {
    critical_pattern_alert: boolean;
    escalation_threshold: number;
    notification_cooldown_hours: number;
  };
}

export class PatternDetectionPlugin extends BaseStoragePlugin {
  private incidents: Map<string, Incident> = new Map();
  private patterns: Map<string, Pattern> = new Map();
  private analysisTimer?: NodeJS.Timeout;
  private lastAnalysis?: Date;

  constructor(adapter: IStorageAdapter, config: PatternDetectionConfig = {} as PatternDetectionConfig) {
    super(adapter, config);
  }

  // ========================
  // Abstract Method Implementations
  // ========================

  getName(): string {
    return 'pattern-detection';
  }

  getVersion(): string {
    return '2.0.0';
  }

  getDescription(): string {
    return 'Detects patterns in incidents and tickets for proactive issue identification';
  }

  getMVPVersion(): number {
    return 2;
  }

  getDependencies(): string[] {
    return ['full-text-search', 'raw-sql'];
  }

  protected getDefaultConfig(): PatternDetectionConfig {
    return {
      enabled: true,
      detection: {
        min_incidents_for_pattern: 3,
        time_window_hours: 24,
        similarity_threshold: 0.7,
        alert_threshold: 5,
        analysis_interval_minutes: 60
      },
      clustering: {
        temporal_sensitivity: 0.8,
        component_grouping: true,
        error_code_matching: true,
        semantic_similarity: false // Requires AI service
      },
      alerting: {
        critical_pattern_alert: true,
        escalation_threshold: 10,
        notification_cooldown_hours: 2
      }
    } as PatternDetectionConfig;
  }

  protected async initializePlugin(): Promise<void> {
    // Create tables for pattern detection
    await this.createTables();
    
    // Load existing incidents
    await this.loadExistingIncidents();
    
    // Start periodic analysis
    this.startPeriodicAnalysis();
    
    this.log('info', 'Pattern detection plugin initialized', {
      incidents_loaded: this.incidents.size,
      analysis_interval: this.config.detection.analysis_interval_minutes
    });
  }

  protected async cleanupPlugin(): Promise<void> {
    // Stop periodic analysis
    if (this.analysisTimer) {
      clearInterval(this.analysisTimer);
    }
    
    // Save current state
    await this.persistPatterns();
    
    this.log('info', 'Pattern detection plugin cleaned up');
  }

  async processData(data: any, context?: any): Promise<PatternAnalysis> {
    const { action, payload } = data;

    switch (action) {
      case 'add_incident':
        return await this.addIncident(payload as Incident);
      
      case 'analyze_patterns':
        return await this.analyzePatterns(payload?.timeWindow);
      
      case 'get_patterns':
        return await this.getPatterns(payload?.filters);
      
      case 'get_pattern':
        return await this.getPattern(payload.patternId);
      
      case 'import_incidents':
        return await this.importIncidents(payload.incidents);
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  // ========================
  // Core Pattern Detection Logic
  // ========================

  async addIncident(incident: Incident): Promise<PatternAnalysis> {
    // Validate incident
    this.validateIncident(incident);
    
    // Store incident
    this.incidents.set(incident.id, incident);
    await this.persistIncident(incident);
    
    // Trigger immediate pattern analysis for this incident
    const analysis = await this.analyzeNewIncident(incident);
    
    this.emit('incident-added', {
      incident,
      patterns_found: analysis.patterns.length,
      critical_patterns: analysis.summary.critical_patterns
    });
    
    return analysis;
  }

  async analyzePatterns(timeWindowHours?: number): Promise<PatternAnalysis> {
    const config = this.config as PatternDetectionConfig;
    const timeWindow = timeWindowHours || config.detection.time_window_hours;
    
    this.log('info', 'Starting pattern analysis', { time_window: timeWindow });
    
    // Get incidents within time window
    const cutoffTime = new Date(Date.now() - (timeWindow * 60 * 60 * 1000));
    const recentIncidents = Array.from(this.incidents.values())
      .filter(incident => incident.timestamp > cutoffTime);
    
    // Clear existing patterns
    this.patterns.clear();
    
    // Detect different types of patterns
    const temporalPatterns = await this.detectTemporalPatterns(recentIncidents);
    const componentPatterns = await this.detectComponentPatterns(recentIncidents);
    const errorPatterns = await this.detectErrorPatterns(recentIncidents);
    
    // Merge and deduplicate patterns
    const allPatterns = [...temporalPatterns, ...componentPatterns, ...errorPatterns];
    const uniquePatterns = this.deduplicatePatterns(allPatterns);
    
    // Store patterns
    uniquePatterns.forEach(pattern => {
      this.patterns.set(pattern.id, pattern);
    });
    
    // Persist patterns
    await this.persistPatterns();
    
    // Generate analysis summary
    const analysis = this.generateAnalysis(uniquePatterns, recentIncidents);
    
    // Check for alerts
    await this.checkForAlerts(analysis);
    
    this.lastAnalysis = new Date();
    
    this.emit('patterns-analyzed', analysis);
    
    return analysis;
  }

  private async detectTemporalPatterns(incidents: Incident[]): Promise<Pattern[]> {
    const config = this.config as PatternDetectionConfig;
    const patterns: Pattern[] = [];
    
    // Group incidents by hour
    const hourlyBuckets = new Map<number, Incident[]>();
    
    incidents.forEach(incident => {
      const hourKey = Math.floor(incident.timestamp.getTime() / 3600000);
      if (!hourlyBuckets.has(hourKey)) {
        hourlyBuckets.set(hourKey, []);
      }
      hourlyBuckets.get(hourKey)!.push(incident);
    });
    
    // Find temporal clusters
    hourlyBuckets.forEach((bucket, hourKey) => {
      if (bucket.length >= config.detection.min_incidents_for_pattern) {
        const similarity = this.calculateSimilarity(bucket);
        
        if (similarity >= config.detection.similarity_threshold) {
          const pattern = this.createPattern('temporal', bucket, similarity);
          pattern.suggested_cause = 'Multiple incidents in short time window - possible system event';
          pattern.suggested_action = 'Check system health, recent changes, and external triggers';
          patterns.push(pattern);
        }
      }
    });
    
    return patterns;
  }

  private async detectComponentPatterns(incidents: Incident[]): Promise<Pattern[]> {
    const config = this.config as PatternDetectionConfig;
    const patterns: Pattern[] = [];
    
    if (!config.clustering.component_grouping) {
      return patterns;
    }
    
    // Group by component
    const componentGroups = new Map<string, Incident[]>();
    
    incidents.forEach(incident => {
      if (incident.component) {
        if (!componentGroups.has(incident.component)) {
          componentGroups.set(incident.component, []);
        }
        componentGroups.get(incident.component)!.push(incident);
      }
    });
    
    // Create patterns for components with multiple incidents
    componentGroups.forEach((group, component) => {
      if (group.length >= config.detection.min_incidents_for_pattern) {
        const pattern = this.createPattern('component', group, 0.9);
        pattern.suggested_cause = `Component ${component} experiencing multiple issues`;
        pattern.suggested_action = `Review ${component} health, configuration, and recent changes`;
        patterns.push(pattern);
      }
    });
    
    return patterns;
  }

  private async detectErrorPatterns(incidents: Incident[]): Promise<Pattern[]> {
    const config = this.config as PatternDetectionConfig;
    const patterns: Pattern[] = [];
    
    if (!config.clustering.error_code_matching) {
      return patterns;
    }
    
    // Group by error code
    const errorGroups = new Map<string, Incident[]>();
    
    incidents.forEach(incident => {
      const errorCode = this.extractErrorCode(incident.title + ' ' + incident.description);
      if (errorCode) {
        if (!errorGroups.has(errorCode)) {
          errorGroups.set(errorCode, []);
        }
        errorGroups.get(errorCode)!.push(incident);
      }
    });
    
    // Create patterns for recurring errors
    errorGroups.forEach((group, errorCode) => {
      if (group.length >= config.detection.min_incidents_for_pattern) {
        const pattern = this.createPattern('error', group, 0.95);
        pattern.suggested_cause = `Recurring error ${errorCode}`;
        pattern.suggested_action = `Investigate root cause of ${errorCode} and implement fix`;
        patterns.push(pattern);
      }
    });
    
    return patterns;
  }

  private createPattern(type: Pattern['type'], incidents: Incident[], confidence: number): Pattern {
    const now = new Date();
    const timestamps = incidents.map(i => i.timestamp.getTime());
    
    return {
      id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      incidents: [...incidents],
      confidence: Math.round(confidence * 100),
      severity: this.calculatePatternSeverity(incidents),
      first_seen: new Date(Math.min(...timestamps)),
      last_seen: new Date(Math.max(...timestamps)),
      frequency: incidents.length,
      trend: this.calculateTrend(incidents),
      prevention_score: this.calculatePreventionScore(incidents)
    };
  }

  private calculateSimilarity(incidents: Incident[]): number {
    if (incidents.length < 2) return 1;
    
    // Simple text similarity based on common words
    const allTexts = incidents.map(i => 
      `${i.title} ${i.description}`.toLowerCase()
    );
    
    // Find common words
    const wordFrequency = new Map<string, number>();
    allTexts.forEach(text => {
      const words = text.split(/\s+/).filter(w => w.length > 3);
      words.forEach(word => {
        wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
      });
    });
    
    // Calculate similarity score
    const commonWords = Array.from(wordFrequency.entries())
      .filter(([_, count]) => count >= incidents.length * 0.6)
      .length;
    
    return Math.min(1, commonWords / 5); // Normalize to 0-1
  }

  private calculatePatternSeverity(incidents: Incident[]): Pattern['severity'] {
    const severityScores = { critical: 4, high: 3, medium: 2, low: 1 };
    const totalScore = incidents.reduce((sum, incident) => 
      sum + (severityScores[incident.severity] || 1), 0
    );
    const avgScore = totalScore / incidents.length;
    
    if (avgScore >= 3.5) return 'critical';
    if (avgScore >= 2.5) return 'high';
    if (avgScore >= 1.5) return 'medium';
    return 'low';
  }

  private calculateTrend(incidents: Incident[]): Pattern['trend'] {
    if (incidents.length < 3) return 'stable';
    
    // Sort by timestamp
    const sorted = incidents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Calculate frequency in first half vs second half
    const midpoint = sorted.length / 2;
    const firstHalf = sorted.slice(0, Math.floor(midpoint));
    const secondHalf = sorted.slice(Math.floor(midpoint));
    
    const firstHalfTime = firstHalf[firstHalf.length - 1].timestamp.getTime() - firstHalf[0].timestamp.getTime();
    const secondHalfTime = secondHalf[secondHalf.length - 1].timestamp.getTime() - secondHalf[0].timestamp.getTime();
    
    if (secondHalfTime === 0) return 'stable';
    
    const firstRate = firstHalf.length / Math.max(firstHalfTime, 1);
    const secondRate = secondHalf.length / Math.max(secondHalfTime, 1);
    
    if (secondRate > firstRate * 1.2) return 'increasing';
    if (secondRate < firstRate * 0.8) return 'decreasing';
    return 'stable';
  }

  private calculatePreventionScore(incidents: Incident[]): number {
    // Score based on how preventable the pattern appears
    let score = 50; // Base score
    
    // Higher score for component-specific issues (more preventable)
    const hasComponents = incidents.some(i => i.component);
    if (hasComponents) score += 20;
    
    // Higher score for recurring error codes (very preventable)
    const hasErrorCodes = incidents.some(i => this.extractErrorCode(i.title + ' ' + i.description));
    if (hasErrorCodes) score += 30;
    
    // Lower score for critical incidents (harder to prevent)
    const criticalCount = incidents.filter(i => i.severity === 'critical').length;
    score -= (criticalCount / incidents.length) * 20;
    
    return Math.max(0, Math.min(100, score));
  }

  private extractErrorCode(text: string): string | null {
    // Common mainframe error patterns
    const patterns = [
      /S0C\d/i,
      /U\d{4}/i,
      /IEF\d{3}[A-Z]/i,
      /VSAM STATUS \d{2}/i,
      /SQLCODE -?\d+/i,
      /WER\d{3}[A-Z]/i,
      /EDC\d{4}[A-Z]/i,
      /IGZ\d{4}[A-Z]/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[0].toUpperCase();
    }
    
    return null;
  }

  private deduplicatePatterns(patterns: Pattern[]): Pattern[] {
    const uniquePatterns = new Map<string, Pattern>();
    
    patterns.forEach(pattern => {
      // Create a key based on pattern characteristics
      const key = this.createPatternKey(pattern);
      
      if (uniquePatterns.has(key)) {
        // Merge with existing pattern
        const existing = uniquePatterns.get(key)!;
        existing.incidents.push(...pattern.incidents);
        existing.frequency += pattern.frequency;
        existing.confidence = Math.max(existing.confidence, pattern.confidence);
      } else {
        uniquePatterns.set(key, pattern);
      }
    });
    
    return Array.from(uniquePatterns.values());
  }

  private createPatternKey(pattern: Pattern): string {
    // Create a unique key for pattern deduplication
    const components = pattern.incidents
      .map(i => i.component)
      .filter(c => c)
      .join(',');
    
    const errorCodes = pattern.incidents
      .map(i => this.extractErrorCode(i.title + ' ' + i.description))
      .filter(c => c)
      .join(',');
    
    return `${pattern.type}-${components}-${errorCodes}`;
  }

  private generateAnalysis(patterns: Pattern[], incidents: Incident[]): PatternAnalysis {
    const criticalPatterns = patterns.filter(p => p.severity === 'critical');
    const newPatterns = patterns.filter(p => 
      !this.lastAnalysis || p.first_seen > this.lastAnalysis
    );
    const escalatingPatterns = patterns.filter(p => p.trend === 'increasing');
    
    return {
      patterns,
      summary: {
        total_patterns: patterns.length,
        critical_patterns: criticalPatterns.length,
        new_patterns: newPatterns.length,
        escalating_patterns: escalatingPatterns.length
      },
      recommendations: this.generateRecommendations(patterns),
      next_analysis: new Date(Date.now() + (this.config as PatternDetectionConfig).detection.analysis_interval_minutes * 60 * 1000)
    };
  }

  private generateRecommendations(patterns: Pattern[]): string[] {
    const recommendations: string[] = [];
    
    const criticalPatterns = patterns.filter(p => p.severity === 'critical');
    if (criticalPatterns.length > 0) {
      recommendations.push(`Immediate attention required: ${criticalPatterns.length} critical patterns detected`);
    }
    
    const componentPatterns = patterns.filter(p => p.type === 'component');
    if (componentPatterns.length > 0) {
      const components = componentPatterns.map(p => 
        p.incidents[0].component
      ).filter(c => c);
      recommendations.push(`Review component health: ${[...new Set(components)].join(', ')}`);
    }
    
    const temporalPatterns = patterns.filter(p => p.type === 'temporal');
    if (temporalPatterns.length > 0) {
      recommendations.push(`Check for systemic issues: ${temporalPatterns.length} temporal patterns detected`);
    }
    
    const escalatingPatterns = patterns.filter(p => p.trend === 'increasing');
    if (escalatingPatterns.length > 0) {
      recommendations.push(`Monitor escalating patterns: ${escalatingPatterns.length} patterns trending upward`);
    }
    
    return recommendations;
  }

  // ========================
  // Database Operations
  // ========================

  private async createTables(): Promise<void> {
    const createIncidentsTable = `
      CREATE TABLE IF NOT EXISTS pattern_incidents (
        id TEXT PRIMARY KEY,
        ticket_id TEXT,
        timestamp DATETIME,
        title TEXT,
        description TEXT,
        component TEXT,
        severity TEXT,
        resolution TEXT,
        resolution_time INTEGER,
        kb_entry_id TEXT,
        category TEXT,
        tags TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    const createPatternsTable = `
      CREATE TABLE IF NOT EXISTS detected_patterns (
        id TEXT PRIMARY KEY,
        type TEXT,
        incident_ids TEXT,
        confidence INTEGER,
        severity TEXT,
        first_seen DATETIME,
        last_seen DATETIME,
        frequency INTEGER,
        trend TEXT,
        suggested_cause TEXT,
        suggested_action TEXT,
        prevention_score INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_incidents_timestamp ON pattern_incidents(timestamp);
      CREATE INDEX IF NOT EXISTS idx_incidents_component ON pattern_incidents(component);
      CREATE INDEX IF NOT EXISTS idx_incidents_severity ON pattern_incidents(severity);
      CREATE INDEX IF NOT EXISTS idx_patterns_type ON detected_patterns(type);
      CREATE INDEX IF NOT EXISTS idx_patterns_severity ON detected_patterns(severity);
    `;
    
    await this.adapter.executeSQL(createIncidentsTable);
    await this.adapter.executeSQL(createPatternsTable);
    await this.adapter.executeSQL(createIndexes);
  }

  private async loadExistingIncidents(): Promise<void> {
    const incidents = await this.adapter.executeSQL('SELECT * FROM pattern_incidents ORDER BY timestamp DESC LIMIT 1000');
    
    incidents.forEach((row: any) => {
      const incident: Incident = {
        id: row.id,
        ticket_id: row.ticket_id,
        timestamp: new Date(row.timestamp),
        title: row.title,
        description: row.description,
        component: row.component,
        severity: row.severity,
        resolution: row.resolution,
        resolution_time: row.resolution_time,
        kb_entry_id: row.kb_entry_id,
        category: row.category,
        tags: row.tags ? row.tags.split(',') : []
      };
      
      this.incidents.set(incident.id, incident);
    });
  }

  private async persistIncident(incident: Incident): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO pattern_incidents 
      (id, ticket_id, timestamp, title, description, component, severity, resolution, resolution_time, kb_entry_id, category, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.adapter.executeSQL(sql, [
      incident.id,
      incident.ticket_id,
      incident.timestamp.toISOString(),
      incident.title,
      incident.description,
      incident.component,
      incident.severity,
      incident.resolution,
      incident.resolution_time,
      incident.kb_entry_id,
      incident.category,
      incident.tags?.join(',')
    ]);
  }

  private async persistPatterns(): Promise<void> {
    // Clear existing patterns
    await this.adapter.executeSQL('DELETE FROM detected_patterns');
    
    // Insert current patterns
    const sql = `
      INSERT INTO detected_patterns 
      (id, type, incident_ids, confidence, severity, first_seen, last_seen, frequency, trend, suggested_cause, suggested_action, prevention_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    for (const pattern of this.patterns.values()) {
      const incidentIds = pattern.incidents.map(i => i.id).join(',');
      
      await this.adapter.executeSQL(sql, [
        pattern.id,
        pattern.type,
        incidentIds,
        pattern.confidence,
        pattern.severity,
        pattern.first_seen.toISOString(),
        pattern.last_seen.toISOString(),
        pattern.frequency,
        pattern.trend,
        pattern.suggested_cause,
        pattern.suggested_action,
        pattern.prevention_score
      ]);
    }
  }

  // ========================
  // Helper Methods
  // ========================

  private validateIncident(incident: Incident): void {
    if (!incident.id) throw new Error('Incident ID is required');
    if (!incident.title) throw new Error('Incident title is required');
    if (!incident.timestamp) throw new Error('Incident timestamp is required');
    if (!['critical', 'high', 'medium', 'low'].includes(incident.severity)) {
      throw new Error('Invalid incident severity');
    }
  }

  private startPeriodicAnalysis(): void {
    const config = this.config as PatternDetectionConfig;
    const intervalMs = config.detection.analysis_interval_minutes * 60 * 1000;
    
    this.analysisTimer = setInterval(async () => {
      try {
        await this.analyzePatterns();
      } catch (error) {
        this.handleError(error as Error);
      }
    }, intervalMs);
  }

  private async analyzeNewIncident(incident: Incident): Promise<PatternAnalysis> {
    // Quick analysis focusing on the new incident
    const recentIncidents = Array.from(this.incidents.values())
      .filter(i => i.timestamp > new Date(Date.now() - 3600000)); // Last hour
    
    if (recentIncidents.length >= (this.config as PatternDetectionConfig).detection.min_incidents_for_pattern) {
      return await this.analyzePatterns(1); // Analyze last hour
    }
    
    return {
      patterns: [],
      summary: { total_patterns: 0, critical_patterns: 0, new_patterns: 0, escalating_patterns: 0 },
      recommendations: [],
      next_analysis: new Date(Date.now() + (this.config as PatternDetectionConfig).detection.analysis_interval_minutes * 60 * 1000)
    };
  }

  private async checkForAlerts(analysis: PatternAnalysis): Promise<void> {
    const config = this.config as PatternDetectionConfig;
    
    if (!config.alerting.critical_pattern_alert) return;
    
    const criticalPatterns = analysis.patterns.filter(p => p.severity === 'critical');
    
    for (const pattern of criticalPatterns) {
      if (pattern.frequency >= config.alerting.escalation_threshold) {
        this.emit('critical-pattern-alert', {
          pattern,
          analysis,
          timestamp: new Date()
        });
      }
    }
  }

  // ========================
  // Public API Methods
  // ========================

  async getPatterns(filters?: any): Promise<PatternAnalysis> {
    let patterns = Array.from(this.patterns.values());
    
    if (filters) {
      if (filters.type) {
        patterns = patterns.filter(p => p.type === filters.type);
      }
      if (filters.severity) {
        patterns = patterns.filter(p => p.severity === filters.severity);
      }
      if (filters.minConfidence) {
        patterns = patterns.filter(p => p.confidence >= filters.minConfidence);
      }
    }
    
    return this.generateAnalysis(patterns, Array.from(this.incidents.values()));
  }

  async getPattern(patternId: string): Promise<Pattern | null> {
    return this.patterns.get(patternId) || null;
  }

  async importIncidents(incidents: Incident[]): Promise<PatternAnalysis> {
    for (const incident of incidents) {
      this.validateIncident(incident);
      this.incidents.set(incident.id, incident);
      await this.persistIncident(incident);
    }
    
    this.log('info', 'Imported incidents', { count: incidents.length });
    
    // Trigger analysis
    return await this.analyzePatterns();
  }
}