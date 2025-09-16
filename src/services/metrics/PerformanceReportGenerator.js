"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceReportGenerator = void 0;
class PerformanceReportGenerator {
    metricsCollector;
    constructor(metricsCollector) {
        this.metricsCollector = metricsCollector;
    }
    async generateReport(type = 'daily', customPeriod) {
        const now = Date.now();
        const period = this.calculateReportPeriod(type, customPeriod);
        const currentMetrics = this.metricsCollector.getCurrentMetrics();
        const report = {
            id: `report-${now}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: now,
            period,
            summary: this.generateSummary(currentMetrics),
            sections: {
                executive: await this.generateExecutiveSummary(currentMetrics),
                performance: await this.generatePerformanceAnalysis(currentMetrics),
                availability: await this.generateAvailabilityReport(currentMetrics),
                cache: await this.generateCacheReport(currentMetrics.cache),
                queries: await this.generateQueryReport(currentMetrics.query),
                sla: await this.generateSLAReport(currentMetrics.sla),
                trends: await this.generateTrendAnalysis(currentMetrics),
                recommendations: await this.generateRecommendations(currentMetrics)
            },
            metadata: {
                generatedBy: 'PerformanceReportGenerator v1.0',
                version: '1.0.0',
                reportType: type,
                exportFormats: ['pdf', 'json', 'csv', 'html']
            }
        };
        return report;
    }
    calculateReportPeriod(type, customPeriod) {
        if (customPeriod) {
            return {
                start: customPeriod.start,
                end: customPeriod.end,
                duration: customPeriod.end - customPeriod.start
            };
        }
        const now = Date.now();
        const durations = {
            hourly: 3600000,
            daily: 86400000,
            weekly: 604800000,
            monthly: 2592000000
        };
        const duration = durations[type];
        return {
            start: now - duration,
            end: now,
            duration
        };
    }
    generateSummary(metrics) {
        const slaCompliance = ((metrics.sla.availability * 100) +
            (metrics.responseTime.p95 <= 500 ? 100 : 0) +
            (metrics.query.errorRate <= 0.01 ? 100 : 0) +
            (metrics.cache.hitRate >= 0.8 ? 100 : 0)) / 4;
        return {
            totalRequests: metrics.responseTime.count,
            avgResponseTime: metrics.responseTime.mean,
            p95ResponseTime: metrics.responseTime.p95,
            errorRate: metrics.query.errorRate,
            cacheHitRate: metrics.cache.hitRate,
            slaCompliance: slaCompliance / 100,
            availability: metrics.sla.availability
        };
    }
    async generateExecutiveSummary(metrics) {
        const healthScore = this.calculateHealthScore(metrics);
        const keyMetrics = [
            {
                name: 'Response Time (P95)',
                value: `${metrics.responseTime.p95.toFixed(0)}ms`,
                status: metrics.responseTime.p95 <= 500 ? 'good' : metrics.responseTime.p95 <= 1000 ? 'warning' : 'critical',
                trend: 'stable'
            },
            {
                name: 'Error Rate',
                value: `${(metrics.query.errorRate * 100).toFixed(2)}%`,
                status: metrics.query.errorRate <= 0.01 ? 'good' : metrics.query.errorRate <= 0.05 ? 'warning' : 'critical',
                trend: 'stable'
            },
            {
                name: 'Cache Hit Rate',
                value: `${(metrics.cache.hitRate * 100).toFixed(1)}%`,
                status: metrics.cache.hitRate >= 0.8 ? 'good' : metrics.cache.hitRate >= 0.6 ? 'warning' : 'critical',
                trend: 'stable'
            },
            {
                name: 'Availability',
                value: `${(metrics.sla.availability * 100).toFixed(2)}%`,
                status: metrics.sla.availability >= 0.999 ? 'good' : metrics.sla.availability >= 0.99 ? 'warning' : 'critical',
                trend: 'stable'
            }
        ];
        const criticalIssues = [];
        if (metrics.responseTime.p95 > 1000) {
            criticalIssues.push('High response times detected - immediate optimization needed');
        }
        if (metrics.query.errorRate > 0.05) {
            criticalIssues.push('High error rate indicates system instability');
        }
        if (metrics.sla.violations.length > 0) {
            criticalIssues.push(`${metrics.sla.violations.length} active SLA violations`);
        }
        const achievements = [];
        if (metrics.responseTime.p95 <= 200) {
            achievements.push('Excellent response time performance maintained');
        }
        if (metrics.cache.hitRate >= 0.9) {
            achievements.push('High cache efficiency achieved');
        }
        if (metrics.query.errorRate <= 0.001) {
            achievements.push('Outstanding system reliability');
        }
        return {
            healthScore,
            keyMetrics,
            criticalIssues,
            achievements
        };
    }
    calculateHealthScore(metrics) {
        const scores = [
            Math.max(0, 25 - (metrics.responseTime.p95 / 20)),
            Math.max(0, 25 - (metrics.query.errorRate * 2500)),
            metrics.cache.hitRate * 25,
            (metrics.sla.availability - 0.95) * 500
        ];
        return Math.max(0, Math.min(100, scores.reduce((a, b) => a + b, 0)));
    }
    async generatePerformanceAnalysis(metrics) {
        const distribution = this.calculateResponseTimeDistribution(metrics.responseTime);
        return {
            responseTime: {
                percentiles: metrics.responseTime,
                distribution,
                trends: []
            },
            throughput: {
                average: metrics.sla.throughputActual,
                peak: metrics.sla.throughputActual * 1.5,
                trends: []
            },
            errorAnalysis: {
                totalErrors: Math.floor(metrics.responseTime.count * metrics.query.errorRate),
                errorRate: metrics.query.errorRate,
                errorTypes: [
                    { type: '5xx Server Errors', count: 0, percentage: 0 },
                    { type: '4xx Client Errors', count: 0, percentage: 0 },
                    { type: 'Timeout Errors', count: 0, percentage: 0 }
                ],
                trends: []
            }
        };
    }
    calculateResponseTimeDistribution(responseTimeMetrics) {
        const ranges = [
            { range: '0-100ms', min: 0, max: 100 },
            { range: '100-500ms', min: 100, max: 500 },
            { range: '500ms-1s', min: 500, max: 1000 },
            { range: '1s-5s', min: 1000, max: 5000 },
            { range: '5s+', min: 5000, max: Infinity }
        ];
        return ranges.map(range => ({
            range: range.range,
            count: Math.floor(responseTimeMetrics.count * 0.2),
            percentage: 20
        }));
    }
    async generateAvailabilityReport(metrics) {
        return {
            uptime: metrics.sla.availability,
            downtime: 1 - metrics.sla.availability,
            incidents: [],
            mttr: 5,
            mtbf: 720
        };
    }
    async generateCacheReport(cacheMetrics) {
        return {
            effectiveness: {
                hitRate: cacheMetrics.hitRate,
                missRate: cacheMetrics.missRate,
                totalRequests: cacheMetrics.totalRequests
            },
            performance: {
                avgHitTime: 5,
                avgMissTime: 100,
                sizeTrends: []
            },
            optimization: {
                evictionRate: cacheMetrics.evictions / Math.max(1, cacheMetrics.totalRequests),
                hotKeys: [],
                recommendations: this.generateCacheRecommendations(cacheMetrics)
            }
        };
    }
    generateCacheRecommendations(cacheMetrics) {
        const recommendations = [];
        if (cacheMetrics.hitRate < 0.6) {
            recommendations.push('Review cache key strategies and TTL settings');
        }
        if (cacheMetrics.evictions > cacheMetrics.hits * 0.1) {
            recommendations.push('Consider increasing cache size to reduce evictions');
        }
        if (cacheMetrics.totalRequests === 0) {
            recommendations.push('Implement caching for frequently accessed data');
        }
        return recommendations;
    }
    async generateQueryReport(queryMetrics) {
        return {
            performance: queryMetrics,
            analysis: {
                slowestQueries: queryMetrics.slowQueries.map(q => ({
                    query: q.query,
                    avgDuration: q.duration,
                    count: 1,
                    impact: q.duration
                })),
                queryPatterns: [],
                optimizationOpportunities: this.generateQueryOptimizations(queryMetrics)
            }
        };
    }
    generateQueryOptimizations(queryMetrics) {
        const optimizations = [];
        if (queryMetrics.avgResponseTime > 500) {
            optimizations.push('Add database indexes for frequently queried columns');
        }
        if (queryMetrics.slowQueries.length > 5) {
            optimizations.push('Optimize slow queries with query plan analysis');
        }
        if (queryMetrics.errorRate > 0.01) {
            optimizations.push('Implement query retry logic with exponential backoff');
        }
        return optimizations;
    }
    async generateSLAReport(slaMetrics) {
        const violations = [
            {
                metric: 'Response Time',
                count: slaMetrics.violations.filter(v => v.type === 'response_time').length,
                totalDuration: 0,
                impact: 'medium'
            },
            {
                metric: 'Error Rate',
                count: slaMetrics.violations.filter(v => v.type === 'error_rate').length,
                totalDuration: 0,
                impact: 'high'
            },
            {
                metric: 'Throughput',
                count: slaMetrics.violations.filter(v => v.type === 'throughput').length,
                totalDuration: 0,
                impact: 'low'
            }
        ];
        return {
            compliance: slaMetrics,
            violations,
            trends: {
                complianceHistory: [],
                violationTrends: []
            }
        };
    }
    async generateTrendAnalysis(metrics) {
        return {
            performanceTrends: {
                responseTime: 'stable',
                throughput: 'stable',
                errorRate: 'stable',
                cacheHitRate: 'stable'
            },
            seasonality: {
                dailyPatterns: [],
                weeklyPatterns: []
            },
            forecasting: {
                expectedLoad: metrics.sla.throughputActual * 1.2,
                capacityRecommendations: [
                    'Monitor resource utilization during peak hours',
                    'Consider horizontal scaling for increased load'
                ],
                growthProjections: [
                    { period: 'Next Month', expectedIncrease: 20 },
                    { period: 'Next Quarter', expectedIncrease: 60 }
                ]
            }
        };
    }
    async generateRecommendations(metrics) {
        const recommendations = [];
        if (metrics.responseTime.p95 > 500) {
            recommendations.push({
                id: 'perf-001',
                category: 'performance',
                priority: 'high',
                title: 'Optimize Response Time',
                description: 'P95 response time exceeds 500ms target',
                impact: 'Improve user experience and meet SLA requirements',
                effort: 'medium',
                timeline: '2-4 weeks',
                implementationSteps: [
                    'Analyze slow query log',
                    'Add database indexes',
                    'Implement query optimization',
                    'Add response caching where appropriate'
                ]
            });
        }
        if (metrics.cache.hitRate < 0.8) {
            recommendations.push({
                id: 'cache-001',
                category: 'performance',
                priority: 'medium',
                title: 'Improve Cache Effectiveness',
                description: 'Cache hit rate is below 80% target',
                impact: 'Reduce database load and improve response times',
                effort: 'low',
                timeline: '1-2 weeks',
                implementationSteps: [
                    'Review cache key strategies',
                    'Adjust TTL settings',
                    'Implement cache warming',
                    'Add caching for frequently accessed data'
                ]
            });
        }
        if (metrics.query.errorRate > 0.01) {
            recommendations.push({
                id: 'rel-001',
                category: 'reliability',
                priority: 'critical',
                title: 'Reduce Error Rate',
                description: 'Error rate exceeds 1% threshold',
                impact: 'Improve system reliability and user experience',
                effort: 'high',
                timeline: '3-6 weeks',
                implementationSteps: [
                    'Implement comprehensive error logging',
                    'Add circuit breakers for external services',
                    'Improve input validation',
                    'Add automated error recovery'
                ]
            });
        }
        return recommendations;
    }
    async exportReport(report, format) {
        switch (format) {
            case 'json':
                return JSON.stringify(report, null, 2);
            case 'csv':
                return this.exportToCSV(report);
            case 'html':
                return this.exportToHTML(report);
            case 'pdf':
                return 'PDF export would require additional PDF generation library';
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }
    exportToCSV(report) {
        const rows = [
            ['Metric', 'Value', 'Status'],
            ['Report ID', report.id, ''],
            ['Generated', new Date(report.timestamp).toISOString(), ''],
            ['Period Start', new Date(report.period.start).toISOString(), ''],
            ['Period End', new Date(report.period.end).toISOString(), ''],
            ['Total Requests', report.summary.totalRequests.toString(), ''],
            ['Average Response Time', `${report.summary.avgResponseTime.toFixed(2)}ms`, ''],
            ['P95 Response Time', `${report.summary.p95ResponseTime.toFixed(2)}ms`, ''],
            ['Error Rate', `${(report.summary.errorRate * 100).toFixed(2)}%`, ''],
            ['Cache Hit Rate', `${(report.summary.cacheHitRate * 100).toFixed(1)}%`, ''],
            ['SLA Compliance', `${(report.summary.slaCompliance * 100).toFixed(1)}%`, ''],
            ['Availability', `${(report.summary.availability * 100).toFixed(2)}%`, '']
        ];
        return rows.map(row => row.join(',')).join('\n');
    }
    exportToHTML(report) {
        return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Performance Report - ${report.id}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
            .metric { display: inline-block; margin: 10px; padding: 15px; background: #fff; border: 1px solid #ddd; border-radius: 4px; }
            .critical { border-left: 4px solid #dc3545; }
            .warning { border-left: 4px solid #ffc107; }
            .good { border-left: 4px solid #28a745; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Performance Report</h1>
            <p>Generated: ${new Date(report.timestamp).toLocaleString()}</p>
            <p>Period: ${new Date(report.period.start).toLocaleString()} - ${new Date(report.period.end).toLocaleString()}</p>
        </div>

        <h2>Summary</h2>
        <div class="metric">
            <h4>Total Requests</h4>
            <p>${report.summary.totalRequests.toLocaleString()}</p>
        </div>
        <div class="metric">
            <h4>Average Response Time</h4>
            <p>${report.summary.avgResponseTime.toFixed(2)}ms</p>
        </div>
        <div class="metric">
            <h4>Error Rate</h4>
            <p>${(report.summary.errorRate * 100).toFixed(2)}%</p>
        </div>
        <div class="metric">
            <h4>Cache Hit Rate</h4>
            <p>${(report.summary.cacheHitRate * 100).toFixed(1)}%</p>
        </div>

        <h2>Recommendations</h2>
        ${report.sections.recommendations.map(rec => `
            <div class="metric ${rec.priority}">
                <h4>${rec.title}</h4>
                <p><strong>Priority:</strong> ${rec.priority}</p>
                <p><strong>Category:</strong> ${rec.category}</p>
                <p>${rec.description}</p>
                <p><strong>Impact:</strong> ${rec.impact}</p>
            </div>
        `).join('')}
    </body>
    </html>`;
    }
}
exports.PerformanceReportGenerator = PerformanceReportGenerator;
//# sourceMappingURL=PerformanceReportGenerator.js.map