"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatternDetectionPlugin = void 0;
const BaseStoragePlugin_1 = require("./BaseStoragePlugin");
class PatternDetectionPlugin extends BaseStoragePlugin_1.BaseStoragePlugin {
    incidents = new Map();
    patterns = new Map();
    analysisTimer;
    lastAnalysis;
    constructor(adapter, config = {}) {
        super(adapter, config);
    }
    getName() {
        return 'pattern-detection';
    }
    getVersion() {
        return '2.0.0';
    }
    getDescription() {
        return 'Detects patterns in incidents and tickets for proactive issue identification';
    }
    getMVPVersion() {
        return 2;
    }
    getDependencies() {
        return ['full-text-search', 'raw-sql'];
    }
    getDefaultConfig() {
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
                semantic_similarity: false
            },
            alerting: {
                critical_pattern_alert: true,
                escalation_threshold: 10,
                notification_cooldown_hours: 2
            }
        };
    }
    async initializePlugin() {
        await this.createTables();
        await this.loadExistingIncidents();
        this.startPeriodicAnalysis();
        this.log('info', 'Pattern detection plugin initialized', {
            incidents_loaded: this.incidents.size,
            analysis_interval: this.config.detection.analysis_interval_minutes
        });
    }
    async cleanupPlugin() {
        if (this.analysisTimer) {
            clearInterval(this.analysisTimer);
        }
        await this.persistPatterns();
        this.log('info', 'Pattern detection plugin cleaned up');
    }
    async processData(data, context) {
        const { action, payload } = data;
        switch (action) {
            case 'add_incident':
                return await this.addIncident(payload);
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
    async addIncident(incident) {
        this.validateIncident(incident);
        this.incidents.set(incident.id, incident);
        await this.persistIncident(incident);
        const analysis = await this.analyzeNewIncident(incident);
        this.emit('incident-added', {
            incident,
            patterns_found: analysis.patterns.length,
            critical_patterns: analysis.summary.critical_patterns
        });
        return analysis;
    }
    async analyzePatterns(timeWindowHours) {
        const config = this.config;
        const timeWindow = timeWindowHours || config.detection.time_window_hours;
        this.log('info', 'Starting pattern analysis', { time_window: timeWindow });
        const cutoffTime = new Date(Date.now() - (timeWindow * 60 * 60 * 1000));
        const recentIncidents = Array.from(this.incidents.values())
            .filter(incident => incident.timestamp > cutoffTime);
        this.patterns.clear();
        const temporalPatterns = await this.detectTemporalPatterns(recentIncidents);
        const componentPatterns = await this.detectComponentPatterns(recentIncidents);
        const errorPatterns = await this.detectErrorPatterns(recentIncidents);
        const allPatterns = [...temporalPatterns, ...componentPatterns, ...errorPatterns];
        const uniquePatterns = this.deduplicatePatterns(allPatterns);
        uniquePatterns.forEach(pattern => {
            this.patterns.set(pattern.id, pattern);
        });
        await this.persistPatterns();
        const analysis = this.generateAnalysis(uniquePatterns, recentIncidents);
        await this.checkForAlerts(analysis);
        this.lastAnalysis = new Date();
        this.emit('patterns-analyzed', analysis);
        return analysis;
    }
    async detectTemporalPatterns(incidents) {
        const config = this.config;
        const patterns = [];
        const hourlyBuckets = new Map();
        incidents.forEach(incident => {
            const hourKey = Math.floor(incident.timestamp.getTime() / 3600000);
            if (!hourlyBuckets.has(hourKey)) {
                hourlyBuckets.set(hourKey, []);
            }
            hourlyBuckets.get(hourKey).push(incident);
        });
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
    async detectComponentPatterns(incidents) {
        const config = this.config;
        const patterns = [];
        if (!config.clustering.component_grouping) {
            return patterns;
        }
        const componentGroups = new Map();
        incidents.forEach(incident => {
            if (incident.component) {
                if (!componentGroups.has(incident.component)) {
                    componentGroups.set(incident.component, []);
                }
                componentGroups.get(incident.component).push(incident);
            }
        });
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
    async detectErrorPatterns(incidents) {
        const config = this.config;
        const patterns = [];
        if (!config.clustering.error_code_matching) {
            return patterns;
        }
        const errorGroups = new Map();
        incidents.forEach(incident => {
            const errorCode = this.extractErrorCode(`${incident.title  } ${  incident.description}`);
            if (errorCode) {
                if (!errorGroups.has(errorCode)) {
                    errorGroups.set(errorCode, []);
                }
                errorGroups.get(errorCode).push(incident);
            }
        });
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
    createPattern(type, incidents, confidence) {
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
    calculateSimilarity(incidents) {
        if (incidents.length < 2)
            return 1;
        const allTexts = incidents.map(i => `${i.title} ${i.description}`.toLowerCase());
        const wordFrequency = new Map();
        allTexts.forEach(text => {
            const words = text.split(/\s+/).filter(w => w.length > 3);
            words.forEach(word => {
                wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
            });
        });
        const commonWords = Array.from(wordFrequency.entries())
            .filter(([_, count]) => count >= incidents.length * 0.6)
            .length;
        return Math.min(1, commonWords / 5);
    }
    calculatePatternSeverity(incidents) {
        const severityScores = { critical: 4, high: 3, medium: 2, low: 1 };
        const totalScore = incidents.reduce((sum, incident) => sum + (severityScores[incident.severity] || 1), 0);
        const avgScore = totalScore / incidents.length;
        if (avgScore >= 3.5)
            return 'critical';
        if (avgScore >= 2.5)
            return 'high';
        if (avgScore >= 1.5)
            return 'medium';
        return 'low';
    }
    calculateTrend(incidents) {
        if (incidents.length < 3)
            return 'stable';
        const sorted = incidents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        const midpoint = sorted.length / 2;
        const firstHalf = sorted.slice(0, Math.floor(midpoint));
        const secondHalf = sorted.slice(Math.floor(midpoint));
        const firstHalfTime = firstHalf[firstHalf.length - 1].timestamp.getTime() - firstHalf[0].timestamp.getTime();
        const secondHalfTime = secondHalf[secondHalf.length - 1].timestamp.getTime() - secondHalf[0].timestamp.getTime();
        if (secondHalfTime === 0)
            return 'stable';
        const firstRate = firstHalf.length / Math.max(firstHalfTime, 1);
        const secondRate = secondHalf.length / Math.max(secondHalfTime, 1);
        if (secondRate > firstRate * 1.2)
            return 'increasing';
        if (secondRate < firstRate * 0.8)
            return 'decreasing';
        return 'stable';
    }
    calculatePreventionScore(incidents) {
        let score = 50;
        const hasComponents = incidents.some(i => i.component);
        if (hasComponents)
            score += 20;
        const hasErrorCodes = incidents.some(i => this.extractErrorCode(`${i.title  } ${  i.description}`));
        if (hasErrorCodes)
            score += 30;
        const criticalCount = incidents.filter(i => i.severity === 'critical').length;
        score -= (criticalCount / incidents.length) * 20;
        return Math.max(0, Math.min(100, score));
    }
    extractErrorCode(text) {
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
            if (match)
                return match[0].toUpperCase();
        }
        return null;
    }
    deduplicatePatterns(patterns) {
        const uniquePatterns = new Map();
        patterns.forEach(pattern => {
            const key = this.createPatternKey(pattern);
            if (uniquePatterns.has(key)) {
                const existing = uniquePatterns.get(key);
                existing.incidents.push(...pattern.incidents);
                existing.frequency += pattern.frequency;
                existing.confidence = Math.max(existing.confidence, pattern.confidence);
            }
            else {
                uniquePatterns.set(key, pattern);
            }
        });
        return Array.from(uniquePatterns.values());
    }
    createPatternKey(pattern) {
        const components = pattern.incidents
            .map(i => i.component)
            .filter(c => c)
            .join(',');
        const errorCodes = pattern.incidents
            .map(i => this.extractErrorCode(`${i.title  } ${  i.description}`))
            .filter(c => c)
            .join(',');
        return `${pattern.type}-${components}-${errorCodes}`;
    }
    generateAnalysis(patterns, incidents) {
        const criticalPatterns = patterns.filter(p => p.severity === 'critical');
        const newPatterns = patterns.filter(p => !this.lastAnalysis || p.first_seen > this.lastAnalysis);
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
            next_analysis: new Date(Date.now() + this.config.detection.analysis_interval_minutes * 60 * 1000)
        };
    }
    generateRecommendations(patterns) {
        const recommendations = [];
        const criticalPatterns = patterns.filter(p => p.severity === 'critical');
        if (criticalPatterns.length > 0) {
            recommendations.push(`Immediate attention required: ${criticalPatterns.length} critical patterns detected`);
        }
        const componentPatterns = patterns.filter(p => p.type === 'component');
        if (componentPatterns.length > 0) {
            const components = componentPatterns.map(p => p.incidents[0].component).filter(c => c);
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
    async createTables() {
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
    async loadExistingIncidents() {
        const incidents = await this.adapter.executeSQL('SELECT * FROM pattern_incidents ORDER BY timestamp DESC LIMIT 1000');
        incidents.forEach((row) => {
            const incident = {
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
    async persistIncident(incident) {
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
    async persistPatterns() {
        await this.adapter.executeSQL('DELETE FROM detected_patterns');
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
    validateIncident(incident) {
        if (!incident.id)
            throw new Error('Incident ID is required');
        if (!incident.title)
            throw new Error('Incident title is required');
        if (!incident.timestamp)
            throw new Error('Incident timestamp is required');
        if (!['critical', 'high', 'medium', 'low'].includes(incident.severity)) {
            throw new Error('Invalid incident severity');
        }
    }
    startPeriodicAnalysis() {
        const config = this.config;
        const intervalMs = config.detection.analysis_interval_minutes * 60 * 1000;
        this.analysisTimer = setInterval(async () => {
            try {
                await this.analyzePatterns();
            }
            catch (error) {
                this.handleError(error);
            }
        }, intervalMs);
    }
    async analyzeNewIncident(incident) {
        const recentIncidents = Array.from(this.incidents.values())
            .filter(i => i.timestamp > new Date(Date.now() - 3600000));
        if (recentIncidents.length >= this.config.detection.min_incidents_for_pattern) {
            return await this.analyzePatterns(1);
        }
        return {
            patterns: [],
            summary: { total_patterns: 0, critical_patterns: 0, new_patterns: 0, escalating_patterns: 0 },
            recommendations: [],
            next_analysis: new Date(Date.now() + this.config.detection.analysis_interval_minutes * 60 * 1000)
        };
    }
    async checkForAlerts(analysis) {
        const config = this.config;
        if (!config.alerting.critical_pattern_alert)
            return;
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
    async getPatterns(filters) {
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
    async getPattern(patternId) {
        return this.patterns.get(patternId) || null;
    }
    async importIncidents(incidents) {
        for (const incident of incidents) {
            this.validateIncident(incident);
            this.incidents.set(incident.id, incident);
            await this.persistIncident(incident);
        }
        this.log('info', 'Imported incidents', { count: incidents.length });
        return await this.analyzePatterns();
    }
}
exports.PatternDetectionPlugin = PatternDetectionPlugin;
//# sourceMappingURL=PatternDetectionPlugin.js.map