"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.basicUsageExample = basicUsageExample;
exports.queryMonitoringExample = queryMonitoringExample;
exports.healthMonitoringExample = healthMonitoringExample;
exports.dashboardExample = dashboardExample;
exports.queryOptimizationExample = queryOptimizationExample;
exports.advancedConfigurationExample = advancedConfigurationExample;
exports.runExamples = runExamples;
const tslib_1 = require("tslib");
const better_sqlite3_1 = tslib_1.__importDefault(require("better-sqlite3"));
const index_1 = require("./index");
async function basicUsageExample() {
    console.log('📊 Setting up SQLite Performance Monitoring...\n');
    const db = new better_sqlite3_1.default('example.db');
    const monitoring = (0, index_1.createMonitoringSystem)(db, {
        enableAllFeatures: true,
        enablePrometheusExport: true,
        performance: {
            enableRealTimeAlerts: true,
            slowQueryThreshold: 1000,
            criticalThreshold: 5000
        },
        health: {
            checkInterval: 300,
            enableAutoRemediation: false
        },
        dashboard: {
            refreshInterval: 30,
            enableRealTime: true
        }
    });
    monitoring.on('performance-alert', (alert) => {
        console.log(`🚨 Performance Alert: ${alert.message}`);
    });
    monitoring.on('health-status-updated', (status) => {
        console.log(`💚 Health Status: ${status.overall} (Score: ${status.score})`);
    });
    monitoring.on('index-recommendation', (recommendation) => {
        console.log(`💡 Index Recommendation: ${recommendation.creationSQL}`);
    });
    await monitoring.initialize();
    return monitoring;
}
async function queryMonitoringExample() {
    const db = new better_sqlite3_1.default(':memory:');
    const monitoring = (0, index_1.createMonitoringSystem)(db);
    await monitoring.initialize();
    db.exec(`
    CREATE TABLE test_table (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      value INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    INSERT INTO test_table (name, value)
    SELECT 'test_' || i, i FROM (
      WITH RECURSIVE seq(i) AS (
        SELECT 1 UNION ALL SELECT i+1 FROM seq WHERE i < 1000
      ) SELECT i FROM seq
    );
  `);
    console.log('🔍 Testing query performance monitoring...\n');
    const fastResult = await monitoring.measureQuery('fast_lookup', 'SELECT * FROM test_table WHERE id = ?', 'conn_001', () => db.prepare('SELECT * FROM test_table WHERE id = ?').get(1), { userId: 'user123' });
    console.log('✅ Fast query completed');
    const slowResult = await monitoring.measureQuery('slow_scan', 'SELECT * FROM test_table WHERE name LIKE ? ORDER BY value DESC', 'conn_002', () => db.prepare('SELECT * FROM test_table WHERE name LIKE ? ORDER BY value DESC').all('%test%'), {
        userId: 'user456',
        captureQueryPlan: true,
        enableAnalysis: true
    });
    console.log('⚠️ Slow query completed - analysis triggered');
    try {
        await monitoring.measureQuery('error_query', 'SELECT * FROM nonexistent_table', 'conn_003', () => db.prepare('SELECT * FROM nonexistent_table').all());
    }
    catch (error) {
        console.log('❌ Error query handled and metrics recorded');
    }
    const stats = monitoring.getStats();
    console.log('\n📈 Current Stats:', stats);
    await monitoring.shutdown();
}
async function healthMonitoringExample() {
    const db = new better_sqlite3_1.default('health_test.db');
    const monitoring = (0, index_1.createMonitoringSystem)(db, {
        health: {
            checkInterval: 10,
            enableAutoRemediation: true,
            criticalThresholds: {
                memoryUsageHigh: 500,
                performanceDegradation: 30
            }
        }
    });
    console.log('🏥 Testing health monitoring...\n');
    monitoring.on('health-status-updated', (status) => {
        console.log(`Health Check: ${status.overall} (${status.checks.length} checks)`);
        status.checks.forEach(check => {
            if (check.status !== 'healthy') {
                console.log(`  ⚠️ ${check.name}: ${check.message}`);
            }
        });
    });
    await monitoring.initialize();
    const healthStatus = await monitoring.runHealthCheck();
    console.log('\n🔍 Manual Health Check Results:');
    console.log(`Overall: ${healthStatus.overall} (Score: ${healthStatus.score})`);
    const healthHistory = monitoring.health.getHealthHistory();
    console.log(`Health history: ${healthHistory.length} previous checks`);
    await monitoring.shutdown();
}
async function dashboardExample() {
    const db = new better_sqlite3_1.default('dashboard_test.db');
    const monitoring = (0, index_1.createMonitoringSystem)(db, {
        dashboard: {
            refreshInterval: 5,
            enableRealTime: true,
            enableAlerts: true,
            enableCapacityPlanning: true
        }
    });
    console.log('📊 Testing dashboard and metrics export...\n');
    await monitoring.initialize();
    for (let i = 0; i < 10; i++) {
        await monitoring.measureQuery(`test_query_${i}`, 'SELECT 1 as test', `conn_${i}`, () => db.prepare('SELECT 1 as test').get());
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    const dashboardData = monitoring.getDashboardData();
    console.log('Current Metrics:', dashboardData.metrics);
    const prometheusMetrics = monitoring.exportPrometheusMetrics();
    console.log('\n📈 Prometheus Metrics (sample):');
    console.log(`${prometheusMetrics.split('\n').slice(0, 10).join('\n')  }\n...`);
    const responseTimeData = monitoring.dashboard.getTimeSeriesData('responseTime', 1);
    console.log(`Response Time Chart Data: ${responseTimeData.datasets[0].data.length} points`);
    const alertSummary = monitoring.dashboard.getAlertSummary();
    console.log(`Alerts: ${alertSummary.total} total, ${alertSummary.critical} critical`);
    const capacityData = monitoring.dashboard.getCapacityPlanningData();
    console.log(`Capacity Recommendations: ${capacityData.recommendations.length}`);
    await monitoring.shutdown();
}
async function queryOptimizationExample() {
    const db = new better_sqlite3_1.default('optimization_test.db');
    const monitoring = (0, index_1.createMonitoringSystem)(db, {
        analyzer: {
            analysisThreshold: 50,
            captureSlowQueries: true,
            generateRecommendations: true,
            trackQueryPatterns: true
        }
    });
    console.log('🔧 Testing query analysis and optimization...\n');
    db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE orders (
      id INTEGER PRIMARY KEY,
      user_id INTEGER,
      amount DECIMAL(10,2),
      status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Insert test data
    INSERT INTO users (email, name) VALUES
      ('user1@test.com', 'User 1'),
      ('user2@test.com', 'User 2'),
      ('user3@test.com', 'User 3');
      
    INSERT INTO orders (user_id, amount, status) VALUES
      (1, 100.00, 'completed'),
      (2, 50.00, 'pending'),
      (1, 75.00, 'completed'),
      (3, 200.00, 'cancelled');
  `);
    await monitoring.initialize();
    console.log('Running queries for analysis...');
    await monitoring.measureQuery('user_lookup_by_email', 'SELECT * FROM users WHERE email = ?', 'conn_001', () => db.prepare('SELECT * FROM users WHERE email = ?').get('user1@test.com'), { enableAnalysis: true });
    await monitoring.measureQuery('user_orders_join', 'SELECT u.name, o.amount FROM users u JOIN orders o ON u.id = o.user_id WHERE o.status = ?', 'conn_002', () => db.prepare('SELECT u.name, o.amount FROM users u JOIN orders o ON u.id = o.user_id WHERE o.status = ?').all('completed'), { enableAnalysis: true });
    await monitoring.measureQuery('inefficient_select', 'SELECT * FROM orders ORDER BY created_at DESC', 'conn_003', () => db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all(), { enableAnalysis: true });
    await new Promise(resolve => setTimeout(resolve, 1000));
    const recommendations = monitoring.getOptimizationRecommendations();
    console.log('\n💡 Optimization Recommendations:');
    console.log(`Index Recommendations: ${recommendations.indexes.length}`);
    recommendations.indexes.forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec.rationale}`);
        console.log(`     SQL: ${rec.creationSQL}`);
        console.log(`     Expected Impact: ${rec.estimatedImpact}%\n`);
    });
    console.log(`Slow Queries: ${recommendations.slowQueries.length}`);
    recommendations.slowQueries.forEach((query, i) => {
        console.log(`  ${i + 1}. Avg Duration: ${query.avgDuration}ms (${query.occurrences} occurrences)`);
        console.log(`     Query: ${query.query.substring(0, 100)}...\n`);
    });
    console.log(`Query Patterns: ${recommendations.patterns.length}`);
    recommendations.patterns.slice(0, 3).forEach((pattern, i) => {
        console.log(`  ${i + 1}. ${pattern.occurrences} occurrences, avg ${pattern.avgDuration}ms`);
        console.log(`     Pattern: ${pattern.pattern.substring(0, 80)}...\n`);
    });
    if (recommendations.indexes.length > 0) {
        const firstRecommendation = recommendations.indexes[0];
        console.log('🔨 Simulating index implementation...');
        console.log(`Would execute: ${firstRecommendation.creationSQL}`);
    }
    await monitoring.shutdown();
}
async function advancedConfigurationExample() {
    const db = new better_sqlite3_1.default('advanced_test.db');
    const monitoring = (0, index_1.createMonitoringSystem)(db, {
        enableAllFeatures: true,
        enablePrometheusExport: true,
        enableGrafanaIntegration: true,
        performance: {
            enableRealTimeAlerts: true,
            slowQueryThreshold: 500,
            criticalThreshold: 2000,
            memoryAlertThreshold: 256 * 1024 * 1024,
            sampleRate: 1.0,
            retentionDays: 30,
            enableQueryPlanCapture: true
        },
        metrics: {
            collectionInterval: 15,
            aggregationInterval: 60,
            retentionDays: 14,
            maxDataPoints: 50000,
            enableCompression: true,
            exportFormats: ['prometheus', 'json', 'csv']
        },
        health: {
            checkInterval: 120,
            enableAutoRemediation: false,
            criticalThresholds: {
                performanceDegradation: 40,
                memoryUsageHigh: 1024,
                diskSpaceLow: 5000,
                queryFailureRate: 5
            },
            remediationActions: {
                vacuum: true,
                reindex: true,
                checkpoint: true,
                connectionPoolReset: false,
                cacheFlush: true
            }
        },
        analyzer: {
            analysisThreshold: 100,
            captureSlowQueries: true,
            generateRecommendations: true,
            trackQueryPatterns: true,
            maxQueryHistory: 5000,
            autoIndexCreation: false,
            indexCreationThreshold: 25
        },
        dashboard: {
            refreshInterval: 20,
            retentionPeriod: 30,
            enableRealTime: true,
            enableAlerts: true,
            enableTrends: true,
            enableCapacityPlanning: true,
            customMetrics: ['custom_business_metric', 'user_activity_metric'],
            alertThresholds: {
                responseTime: 800,
                errorRate: 0.02,
                memoryUsage: 0.75,
                diskUsage: 0.85
            }
        }
    });
    console.log('⚙️ Testing advanced configuration...\n');
    monitoring.on('performance-alert', (alert) => {
        console.log(`🚨 Performance: ${alert.level} - ${alert.message}`);
    });
    monitoring.on('health-status-updated', (status) => {
        console.log(`🏥 Health: ${status.overall} (${status.score}/100)`);
    });
    monitoring.on('query-analyzed', (analysis) => {
        if (analysis.performance.complexity !== 'low') {
            console.log(`🔍 Query Analysis: ${analysis.queryType} - ${analysis.performance.complexity} complexity`);
        }
    });
    monitoring.on('index-recommendation', (rec) => {
        console.log(`💡 Index Rec: ${rec.priority} priority for ${rec.tableName}.${rec.columns.join(',')}`);
    });
    monitoring.on('dashboard-alert', (alert) => {
        console.log(`📊 Dashboard: ${alert.severity} - ${alert.title}`);
    });
    monitoring.on('metrics-alert', (alert) => {
        console.log(`📈 Metrics: ${alert.severity} - ${alert.description}`);
    });
    await monitoring.initialize();
    console.log('Recording custom metrics...');
    monitoring.metrics.recordMetric('custom_business_metric', 42.5, { category: 'revenue' });
    monitoring.metrics.recordMetric('user_activity_metric', 156, { activity_type: 'login' });
    console.log('Simulating high-load scenario...');
    const promises = [];
    for (let i = 0; i < 20; i++) {
        promises.push(monitoring.measureQuery('load_test_query', 'SELECT COUNT(*) FROM sqlite_master', `conn_${i}`, async () => {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
            return db.prepare('SELECT COUNT(*) FROM sqlite_master').get();
        }));
    }
    await Promise.all(promises);
    const stats = monitoring.getStats();
    console.log('\n📊 Final Statistics:');
    console.log(`  System Status: ${stats.systemStatus}`);
    console.log(`  Total Queries: ${stats.totalQueries}`);
    console.log(`  Slow Queries: ${stats.slowQueries}`);
    console.log(`  Active Alerts: ${stats.activeAlerts}`);
    console.log(`  Health Score: ${stats.healthScore}`);
    console.log(`  Performance Score: ${stats.performanceScore}`);
    console.log(`  Uptime: ${Math.round(stats.uptime / 1000)}s`);
    await monitoring.shutdown();
}
async function runExamples() {
    console.log('🚀 SQLite Performance Monitoring System Examples\n');
    console.log(`${'='.repeat(60)  }\n`);
    try {
        console.log('Example 1: Basic Usage');
        console.log('-'.repeat(30));
        await basicUsageExample();
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('\n');
        console.log('Example 2: Query Monitoring');
        console.log('-'.repeat(30));
        await queryMonitoringExample();
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('\n');
        console.log('Example 3: Health Monitoring');
        console.log('-'.repeat(30));
        await healthMonitoringExample();
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('\n');
        console.log('Example 4: Dashboard and Metrics');
        console.log('-'.repeat(30));
        await dashboardExample();
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('\n');
        console.log('Example 5: Query Optimization');
        console.log('-'.repeat(30));
        await queryOptimizationExample();
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('\n');
        console.log('Example 6: Advanced Configuration');
        console.log('-'.repeat(30));
        await advancedConfigurationExample();
        console.log('\n');
        console.log('✅ All examples completed successfully!');
    }
    catch (error) {
        console.error('❌ Error running examples:', error);
    }
}
if (require.main === module) {
    runExamples().catch(console.error);
}
//# sourceMappingURL=usage-example.js.map