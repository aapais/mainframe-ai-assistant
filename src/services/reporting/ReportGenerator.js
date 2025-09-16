"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportGenerator = void 0;
const events_1 = require("events");
class ReportGenerator extends events_1.EventEmitter {
    logger;
    dataConnectors;
    activeReports;
    reportCache;
    maxCacheSize;
    constructor(logger, maxCacheSize = 100) {
        super();
        this.logger = logger;
        this.dataConnectors = new Map();
        this.activeReports = new Map();
        this.reportCache = new Map();
        this.maxCacheSize = maxCacheSize;
    }
    registerDataSource(name, connector) {
        this.dataConnectors.set(name, connector);
        this.logger.info(`Data source registered: ${name}`);
    }
    async generateReport(config) {
        const reportId = `${config.id}_${Date.now()}`;
        try {
            this.logger.info(`Starting report generation: ${config.name} (${reportId})`);
            this.emit('reportStarted', { reportId, config });
            if (this.activeReports.has(config.id)) {
                this.logger.warn(`Report ${config.id} is already being generated`);
                return await this.activeReports.get(config.id);
            }
            const reportPromise = this.executeReportGeneration(reportId, config);
            this.activeReports.set(config.id, reportPromise);
            const result = await reportPromise;
            if (result.status === 'success') {
                this.cacheReport(result);
            }
            this.activeReports.delete(config.id);
            this.emit('reportCompleted', result);
            return result;
        }
        catch (error) {
            this.activeReports.delete(config.id);
            const errorResult = {
                id: reportId,
                reportId: config.id,
                generatedAt: new Date(),
                status: 'error',
                data: null,
                metadata: {
                    rowCount: 0,
                    executionTime: 0,
                    dataSourceVersion: 'unknown',
                    parameters: config.parameters
                },
                errors: [error instanceof Error ? error.message : String(error)]
            };
            this.emit('reportError', errorResult);
            this.logger.error(`Report generation failed: ${config.name}`, error);
            return errorResult;
        }
    }
    async executeReportGeneration(reportId, config) {
        const startTime = Date.now();
        const connector = this.dataConnectors.get(config.dataSource);
        if (!connector) {
            throw new Error(`Data source not found: ${config.dataSource}`);
        }
        await connector.connect();
        try {
            const query = this.buildQuery(config);
            const data = await connector.executeQuery(query, config.parameters);
            const processedData = await this.processData(data, config);
            const visualizations = config.visualizations
                ? await this.generateVisualizations(processedData, config.visualizations)
                : [];
            const executionTime = Date.now() - startTime;
            return {
                id: reportId,
                reportId: config.id,
                generatedAt: new Date(),
                status: 'success',
                data: processedData,
                metadata: {
                    rowCount: Array.isArray(processedData) ? processedData.length : 1,
                    executionTime,
                    dataSourceVersion: await this.getDataSourceVersion(connector),
                    parameters: config.parameters
                },
                warnings: this.validateReportData(processedData, config)
            };
        }
        finally {
            await connector.disconnect();
        }
    }
    buildQuery(config) {
        let query = `SELECT * FROM ${config.dataSource}`;
        if (config.filters && config.filters.length > 0) {
            const whereClause = this.buildWhereClause(config.filters);
            query += ` WHERE ${whereClause}`;
        }
        if (config.aggregations && config.aggregations.length > 0) {
            const selectClause = this.buildSelectClause(config.aggregations);
            const groupByClause = this.buildGroupByClause(config.aggregations);
            query = `SELECT ${selectClause} FROM ${config.dataSource}`;
            if (config.filters && config.filters.length > 0) {
                query += ` WHERE ${this.buildWhereClause(config.filters)}`;
            }
            if (groupByClause) {
                query += ` GROUP BY ${groupByClause}`;
            }
        }
        return query;
    }
    buildWhereClause(filters) {
        return filters.map((filter, index) => {
            let clause = '';
            if (index > 0 && filter.logicalOperator) {
                clause += ` ${filter.logicalOperator} `;
            }
            clause += this.buildFilterClause(filter);
            return clause;
        }).join('');
    }
    buildFilterClause(filter) {
        const { field, operator, value } = filter;
        switch (operator) {
            case 'eq': return `${field} = '${value}'`;
            case 'ne': return `${field} != '${value}'`;
            case 'gt': return `${field} > ${value}`;
            case 'gte': return `${field} >= ${value}`;
            case 'lt': return `${field} < ${value}`;
            case 'lte': return `${field} <= ${value}`;
            case 'in': return `${field} IN (${Array.isArray(value) ? value.map(v => `'${v}'`).join(',') : value})`;
            case 'like': return `${field} LIKE '%${value}%'`;
            case 'between': return `${field} BETWEEN '${value.start}' AND '${value.end}'`;
            default: throw new Error(`Unsupported filter operator: ${operator}`);
        }
    }
    buildSelectClause(aggregations) {
        return aggregations.map(agg => {
            const func = agg.function.toUpperCase();
            return `${func}(${agg.field}) as ${agg.field}_${agg.function}`;
        }).join(', ');
    }
    buildGroupByClause(aggregations) {
        const groupByFields = aggregations
            .filter(agg => agg.groupBy && agg.groupBy.length > 0)
            .flatMap(agg => agg.groupBy)
            .filter((field, index, arr) => arr.indexOf(field) === index);
        return groupByFields.length > 0 ? groupByFields.join(', ') : null;
    }
    async processData(data, config) {
        let processedData = [...data];
        switch (config.type) {
            case 'analytics':
                processedData = await this.applyAnalyticsTransformations(processedData, config);
                break;
            case 'performance':
                processedData = await this.applyPerformanceTransformations(processedData, config);
                break;
            case 'usage':
                processedData = await this.applyUsageTransformations(processedData, config);
                break;
        }
        return processedData;
    }
    async applyAnalyticsTransformations(data, config) {
        return data.map(row => ({
            ...row,
            calculated_metrics: this.calculateMetrics(row, config.parameters),
            trend_indicators: this.calculateTrends(row, data)
        }));
    }
    async applyPerformanceTransformations(data, config) {
        return data.map(row => ({
            ...row,
            performance_score: this.calculatePerformanceScore(row),
            benchmark_comparison: this.compareToBenchmark(row, config.parameters)
        }));
    }
    async applyUsageTransformations(data, config) {
        return data.map(row => ({
            ...row,
            usage_patterns: this.identifyUsagePatterns(row),
            activity_classification: this.classifyActivity(row)
        }));
    }
    calculateMetrics(row, parameters) {
        return {
            growth_rate: 0,
            conversion_rate: 0,
            efficiency_score: 0
        };
    }
    calculateTrends(row, allData) {
        return {
            direction: 'stable',
            magnitude: 0,
            confidence: 0.5
        };
    }
    calculatePerformanceScore(row) {
        return Math.random() * 100;
    }
    compareToBenchmark(row, parameters) {
        return {
            vs_benchmark: 0,
            percentile: 50,
            category: 'average'
        };
    }
    identifyUsagePatterns(row) {
        return ['peak_hours', 'regular_user', 'mobile_preferred'];
    }
    classifyActivity(row) {
        return 'normal';
    }
    async generateVisualizations(data, configs) {
        const visualizations = [];
        for (const config of configs) {
            try {
                const visualization = await this.createVisualization(data, config);
                visualizations.push(visualization);
            }
            catch (error) {
                this.logger.warn(`Failed to create visualization: ${config.title}`, error);
            }
        }
        return visualizations;
    }
    async createVisualization(data, config) {
        return {
            type: config.type,
            title: config.title,
            data: this.mapDataForVisualization(data, config.dataMapping),
            config: config.styling || {}
        };
    }
    mapDataForVisualization(data, mapping) {
        return data.map(row => {
            const mappedRow = {};
            for (const [vizField, dataField] of Object.entries(mapping)) {
                mappedRow[vizField] = row[dataField];
            }
            return mappedRow;
        });
    }
    async getDataSourceVersion(connector) {
        try {
            const schema = await connector.getSchema();
            return schema.version || 'unknown';
        }
        catch {
            return 'unknown';
        }
    }
    validateReportData(data, config) {
        const warnings = [];
        if (Array.isArray(data) && data.length === 0) {
            warnings.push('No data returned for the specified criteria');
        }
        if (Array.isArray(data) && data.length > 10000) {
            warnings.push('Large dataset returned - consider adding filters for better performance');
        }
        return warnings;
    }
    cacheReport(result) {
        if (this.reportCache.size >= this.maxCacheSize) {
            const oldestKey = this.reportCache.keys().next().value;
            this.reportCache.delete(oldestKey);
        }
        this.reportCache.set(result.id, result);
    }
    getCachedReport(reportId) {
        return this.reportCache.get(reportId) || null;
    }
    clearCache() {
        this.reportCache.clear();
        this.logger.info('Report cache cleared');
    }
    getActiveReports() {
        return Array.from(this.activeReports.keys());
    }
}
exports.ReportGenerator = ReportGenerator;
//# sourceMappingURL=ReportGenerator.js.map