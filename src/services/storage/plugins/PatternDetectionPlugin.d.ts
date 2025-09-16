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
export declare class PatternDetectionPlugin extends BaseStoragePlugin {
    private incidents;
    private patterns;
    private analysisTimer?;
    private lastAnalysis?;
    constructor(adapter: IStorageAdapter, config?: PatternDetectionConfig);
    getName(): string;
    getVersion(): string;
    getDescription(): string;
    getMVPVersion(): number;
    getDependencies(): string[];
    protected getDefaultConfig(): PatternDetectionConfig;
    protected initializePlugin(): Promise<void>;
    protected cleanupPlugin(): Promise<void>;
    processData(data: any, context?: any): Promise<PatternAnalysis>;
    addIncident(incident: Incident): Promise<PatternAnalysis>;
    analyzePatterns(timeWindowHours?: number): Promise<PatternAnalysis>;
    private detectTemporalPatterns;
    private detectComponentPatterns;
    private detectErrorPatterns;
    private createPattern;
    private calculateSimilarity;
    private calculatePatternSeverity;
    private calculateTrend;
    private calculatePreventionScore;
    private extractErrorCode;
    private deduplicatePatterns;
    private createPatternKey;
    private generateAnalysis;
    private generateRecommendations;
    private createTables;
    private loadExistingIncidents;
    private persistIncident;
    private persistPatterns;
    private validateIncident;
    private startPeriodicAnalysis;
    private analyzeNewIncident;
    private checkForAlerts;
    getPatterns(filters?: any): Promise<PatternAnalysis>;
    getPattern(patternId: string): Promise<Pattern | null>;
    importIncidents(incidents: Incident[]): Promise<PatternAnalysis>;
}
//# sourceMappingURL=PatternDetectionPlugin.d.ts.map