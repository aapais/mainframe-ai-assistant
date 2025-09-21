#!/usr/bin/env node

/**
 * TypeScript Type Safety Monitoring Dashboard
 * Creates a comprehensive monitoring dashboard for TypeScript type safety metrics
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');

class TypeScriptMonitoringDashboard {
    constructor() {
        this.projectRoot = process.cwd();
        this.options = this.parseArgs();
        this.port = this.options.port || 3001;
        this.dataDir = path.join(this.projectRoot, 'coverage', 'monitoring');
        this.server = null;
        this.metrics = {
            coverage: {},
            errors: {},
            trends: [],
            files: [],
            performance: {}
        };
    }

    parseArgs() {
        const args = process.argv.slice(2);
        return {
            port: parseInt(args.find(arg => arg.startsWith('--port='))?.split('=')[1]) || 3001,
            interval: parseInt(args.find(arg => arg.startsWith('--interval='))?.split('=')[1]) || 300, // 5 minutes
            persistent: args.includes('--persistent'),
            export: args.includes('--export'),
            verbose: args.includes('--verbose')
        };
    }

    async run() {
        console.log('📊 Starting TypeScript Monitoring Dashboard...');

        try {
            // Initialize monitoring directory
            await this.initializeStorage();

            // Collect initial metrics
            await this.collectMetrics();

            // Start web server
            await this.startServer();

            // Set up monitoring interval if persistent
            if (this.options.persistent) {
                this.startPeriodicCollection();
            }

            console.log(`🌐 Dashboard running at http://localhost:${this.port}`);

            if (!this.options.persistent) {
                console.log('💡 Use --persistent to keep monitoring in the background');
            }

        } catch (error) {
            console.error('❌ Dashboard failed to start:', error.message);
            if (this.options.verbose) {
                console.error(error.stack);
            }
            process.exit(1);
        }
    }

    async initializeStorage() {
        fs.mkdirSync(this.dataDir, { recursive: true });

        // Create data files if they don't exist
        const trendsFile = path.join(this.dataDir, 'trends.json');
        if (!fs.existsSync(trendsFile)) {
            fs.writeFileSync(trendsFile, JSON.stringify([], null, 2));
        }

        const configFile = path.join(this.dataDir, 'config.json');
        if (!fs.existsSync(configFile)) {
            const defaultConfig = {
                thresholds: {
                    coverage: { excellent: 95, good: 90, warning: 80, minimum: 70 },
                    errors: { maximum: 0, warning: 5, critical: 20 },
                    performance: { typeCheckTime: 30000, buildTime: 60000 }
                },
                alerts: {
                    enabled: true,
                    coverageDropThreshold: 2.0,
                    errorIncreaseThreshold: 5
                },
                retention: {
                    days: 30,
                    maxDataPoints: 1000
                }
            };
            fs.writeFileSync(configFile, JSON.stringify(defaultConfig, null, 2));
        }

        console.log('📁 Storage initialized');
    }

    async collectMetrics() {
        console.log('📊 Collecting TypeScript metrics...');

        const startTime = Date.now();

        try {
            // Collect type coverage data
            await this.collectCoverageMetrics();

            // Collect type error data
            await this.collectErrorMetrics();

            // Collect performance data
            await this.collectPerformanceMetrics();

            // Collect file-level metrics
            await this.collectFileMetrics();

            // Store trend data
            await this.storeTrendData();

            const duration = Date.now() - startTime;
            console.log(`✅ Metrics collected in ${duration}ms`);

        } catch (error) {
            console.error('⚠️  Error collecting metrics:', error.message);
            this.metrics.lastError = {
                message: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async collectCoverageMetrics() {
        try {
            const output = execSync('npx type-coverage --reportType json', {
                encoding: 'utf8',
                cwd: this.projectRoot,
                timeout: 30000
            });

            const coverage = JSON.parse(output);

            this.metrics.coverage = {
                percentage: coverage.percentage,
                totalFiles: coverage.fileCounts?.sourceFileCount || 0,
                totalLines: coverage.fileCounts?.totalCount || 0,
                coveredLines: coverage.fileCounts?.correctCount || 0,
                uncoveredLines: (coverage.fileCounts?.totalCount || 0) - (coverage.fileCounts?.correctCount || 0),
                files: coverage.files || [],
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.warn('⚠️  Could not collect coverage metrics:', error.message);
            this.metrics.coverage = {
                percentage: 0,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async collectErrorMetrics() {
        try {
            const result = await this.runTypeCheck();

            this.metrics.errors = {
                count: result.errors.length,
                warnings: result.warnings.length,
                errors: result.errors,
                errorsByType: this.categorizeErrors(result.errors),
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.warn('⚠️  Could not collect error metrics:', error.message);
            this.metrics.errors = {
                count: -1,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async runTypeCheck() {
        return new Promise((resolve) => {
            const { spawn } = require('child_process');
            const tsc = spawn('npx', ['tsc', '--noEmit'], {
                cwd: this.projectRoot,
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let stderr = '';
            tsc.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            tsc.on('close', () => {
                const result = this.parseTypeScriptOutput(stderr);
                resolve(result);
            });
        });
    }

    parseTypeScriptOutput(output) {
        const lines = output.split('\n');
        const errors = [];
        const warnings = [];

        for (const line of lines) {
            const errorMatch = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/);
            if (errorMatch) {
                errors.push({
                    file: errorMatch[1],
                    line: parseInt(errorMatch[2]),
                    column: parseInt(errorMatch[3]),
                    code: errorMatch[4],
                    message: errorMatch[5]
                });
            }
        }

        return { errors, warnings };
    }

    categorizeErrors(errors) {
        const categories = {};
        errors.forEach(error => {
            const category = this.getErrorCategory(error.code);
            if (!categories[category]) {
                categories[category] = { count: 0, codes: new Set() };
            }
            categories[category].count++;
            categories[category].codes.add(error.code);
        });

        // Convert Sets to Arrays for JSON serialization
        Object.values(categories).forEach(cat => {
            cat.codes = Array.from(cat.codes);
        });

        return categories;
    }

    getErrorCategory(code) {
        const categoryMap = {
            'TS2304': 'missing_types',      // Cannot find name
            'TS2322': 'type_mismatch',      // Type assignment
            'TS2345': 'argument_type',      // Argument type
            'TS2339': 'property_missing',   // Property missing
            'TS7053': 'index_signature',    // Index signature
            'TS2571': 'union_type',         // Union type issues
            'TS2532': 'null_undefined',     // Null/undefined
            'TS2531': 'possibly_null'       // Possibly null
        };

        return categoryMap[code] || 'other';
    }

    async collectPerformanceMetrics() {
        const performanceTests = [
            { name: 'typeCheck', command: 'npx tsc --noEmit' },
            { name: 'typeCoverage', command: 'npx type-coverage --reportType json' }
        ];

        this.metrics.performance = {
            tests: {},
            timestamp: new Date().toISOString()
        };

        for (const test of performanceTests) {
            try {
                const startTime = Date.now();
                execSync(test.command, {
                    cwd: this.projectRoot,
                    stdio: 'pipe',
                    timeout: 60000
                });
                const duration = Date.now() - startTime;

                this.metrics.performance.tests[test.name] = {
                    duration: duration,
                    status: 'success'
                };

            } catch (error) {
                const duration = Date.now() - Date.now();
                this.metrics.performance.tests[test.name] = {
                    duration: duration,
                    status: 'failed',
                    error: error.message
                };
            }
        }
    }

    async collectFileMetrics() {
        const files = this.metrics.coverage.files || [];

        this.metrics.files = files.map(file => ({
            path: file.filename,
            coverage: file.percentage,
            lines: {
                total: file.totalCount,
                covered: file.correctCount,
                uncovered: file.totalCount - file.correctCount
            },
            category: this.getCoverageCategory(file.percentage),
            size: this.getFileSize(file.filename),
            lastModified: this.getFileLastModified(file.filename)
        })).sort((a, b) => a.coverage - b.coverage);
    }

    getCoverageCategory(percentage) {
        if (percentage >= 95) return 'excellent';
        if (percentage >= 90) return 'good';
        if (percentage >= 80) return 'warning';
        return 'poor';
    }

    getFileSize(filePath) {
        try {
            const fullPath = path.join(this.projectRoot, filePath);
            const stats = fs.statSync(fullPath);
            return stats.size;
        } catch {
            return 0;
        }
    }

    getFileLastModified(filePath) {
        try {
            const fullPath = path.join(this.projectRoot, filePath);
            const stats = fs.statSync(fullPath);
            return stats.mtime.toISOString();
        } catch {
            return null;
        }
    }

    async storeTrendData() {
        const trendsFile = path.join(this.dataDir, 'trends.json');
        let trends = [];

        try {
            trends = JSON.parse(fs.readFileSync(trendsFile, 'utf8'));
        } catch {
            trends = [];
        }

        const trendPoint = {
            timestamp: new Date().toISOString(),
            coverage: this.metrics.coverage.percentage || 0,
            errors: this.metrics.errors.count || 0,
            files: this.metrics.coverage.totalFiles || 0,
            performance: this.metrics.performance.tests.typeCheck?.duration || 0
        };

        trends.push(trendPoint);

        // Keep only last 1000 data points
        if (trends.length > 1000) {
            trends = trends.slice(-1000);
        }

        fs.writeFileSync(trendsFile, JSON.stringify(trends, null, 2));
        this.metrics.trends = trends;
    }

    async startServer() {
        this.server = http.createServer((req, res) => {
            this.handleRequest(req, res);
        });

        return new Promise((resolve) => {
            this.server.listen(this.port, () => {
                resolve();
            });
        });
    }

    handleRequest(req, res) {
        const url = new URL(req.url, `http://localhost:${this.port}`);

        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        switch (url.pathname) {
            case '/':
                this.serveDashboard(res);
                break;
            case '/api/metrics':
                this.serveMetrics(res);
                break;
            case '/api/trends':
                this.serveTrends(res);
                break;
            case '/api/refresh':
                this.handleRefresh(res);
                break;
            default:
                res.writeHead(404);
                res.end('Not found');
        }
    }

    serveDashboard(res) {
        const html = this.generateDashboardHTML();
        res.setHeader('Content-Type', 'text/html');
        res.writeHead(200);
        res.end(html);
    }

    serveMetrics(res) {
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify(this.metrics, null, 2));
    }

    serveTrends(res) {
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify(this.metrics.trends, null, 2));
    }

    async handleRefresh(res) {
        try {
            await this.collectMetrics();
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(200);
            res.end(JSON.stringify({ success: true, timestamp: new Date().toISOString() }));
        } catch (error) {
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(500);
            res.end(JSON.stringify({ success: false, error: error.message }));
        }
    }

    generateDashboardHTML() {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TypeScript Type Safety Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #f5f7fa;
            color: #333;
            line-height: 1.6;
        }
        .header {
            background: linear-gradient(135deg, #007acc, #005a9e);
            color: white;
            padding: 20px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 20px;
        }
        .card {
            background: white;
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
            border: 1px solid #e1e5e9;
        }
        .card h2 {
            margin-bottom: 20px;
            color: #007acc;
            font-size: 1.4em;
        }
        .metric-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }
        .metric {
            text-align: center;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
            border: 1px solid #e9ecef;
        }
        .metric-value {
            font-size: 2em;
            font-weight: bold;
            color: #007acc;
            display: block;
        }
        .metric-label {
            font-size: 0.85em;
            color: #666;
            margin-top: 5px;
        }
        .excellent { border-left: 4px solid #4caf50; background: #f1f8e9; }
        .good { border-left: 4px solid #8bc34a; background: #f9fbe7; }
        .warning { border-left: 4px solid #ff9800; background: #fff3e0; }
        .poor { border-left: 4px solid #f44336; background: #ffebee; }
        .chart-container {
            position: relative;
            height: 300px;
            margin-top: 20px;
        }
        .file-list {
            max-height: 400px;
            overflow-y: auto;
            margin-top: 20px;
        }
        .file-item {
            padding: 12px;
            border-bottom: 1px solid #e9ecef;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .file-item:last-child { border-bottom: none; }
        .file-path {
            font-family: 'Monaco', monospace;
            font-size: 0.9em;
            flex: 1;
        }
        .file-coverage {
            font-weight: bold;
            margin-left: 10px;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.85em;
        }
        .refresh-btn {
            background: #007acc;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            margin-bottom: 20px;
        }
        .refresh-btn:hover { background: #005a9e; }
        .status-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 8px;
        }
        .status-success { background: #4caf50; }
        .status-warning { background: #ff9800; }
        .status-error { background: #f44336; }
        .last-update {
            text-align: center;
            color: #666;
            font-size: 0.9em;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 TypeScript Type Safety Dashboard</h1>
        <p>Real-time monitoring of TypeScript type coverage and errors</p>
    </div>

    <div class="container">
        <div class="card">
            <h2>📈 Coverage Overview</h2>
            <button class="refresh-btn" onclick="refreshData()">Refresh Data</button>
            <div class="metric-grid" id="coverageMetrics">
                <div class="metric">
                    <span class="metric-value" id="coveragePercentage">--</span>
                    <span class="metric-label">Coverage %</span>
                </div>
                <div class="metric">
                    <span class="metric-value" id="totalFiles">--</span>
                    <span class="metric-label">Files</span>
                </div>
                <div class="metric">
                    <span class="metric-value" id="errorCount">--</span>
                    <span class="metric-label">Errors</span>
                </div>
                <div class="metric">
                    <span class="metric-value" id="typeCheckTime">--</span>
                    <span class="metric-label">Type Check (ms)</span>
                </div>
            </div>
        </div>

        <div class="card">
            <h2>📊 Coverage Trend</h2>
            <div class="chart-container">
                <canvas id="coverageTrendChart"></canvas>
            </div>
        </div>

        <div class="card">
            <h2>🎯 File Coverage</h2>
            <div class="file-list" id="fileList">
                Loading files...
            </div>
        </div>

        <div class="card">
            <h2>⚠️ Error Analysis</h2>
            <div class="chart-container">
                <canvas id="errorCategoryChart"></canvas>
            </div>
        </div>
    </div>

    <div class="last-update" id="lastUpdate">
        Last updated: Loading...
    </div>

    <script>
        let coverageTrendChart = null;
        let errorCategoryChart = null;

        async function loadData() {
            try {
                const response = await fetch('/api/metrics');
                const data = await response.json();
                updateDashboard(data);
                updateCharts(data);
            } catch (error) {
                console.error('Failed to load data:', error);
            }
        }

        function updateDashboard(data) {
            // Update metrics
            document.getElementById('coveragePercentage').textContent =
                data.coverage.percentage ? data.coverage.percentage.toFixed(1) : '--';
            document.getElementById('totalFiles').textContent = data.coverage.totalFiles || '--';
            document.getElementById('errorCount').textContent = data.errors.count >= 0 ? data.errors.count : '--';
            document.getElementById('typeCheckTime').textContent =
                data.performance.tests?.typeCheck?.duration || '--';

            // Update file list
            const fileList = document.getElementById('fileList');
            if (data.files && data.files.length > 0) {
                fileList.innerHTML = data.files.slice(0, 20).map(file => \`
                    <div class="file-item \${file.category}">
                        <span class="file-path">\${file.path}</span>
                        <span class="file-coverage \${file.category}">\${file.coverage.toFixed(1)}%</span>
                    </div>
                \`).join('');
            } else {
                fileList.innerHTML = '<div class="file-item">No file data available</div>';
            }

            // Update last update time
            document.getElementById('lastUpdate').textContent =
                'Last updated: ' + (data.coverage.timestamp ? new Date(data.coverage.timestamp).toLocaleString() : 'Never');
        }

        async function updateCharts(data) {
            // Coverage trend chart
            if (data.trends && data.trends.length > 0) {
                const ctx = document.getElementById('coverageTrendChart').getContext('2d');

                if (coverageTrendChart) {
                    coverageTrendChart.destroy();
                }

                coverageTrendChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: data.trends.map(t => new Date(t.timestamp).toLocaleDateString()),
                        datasets: [{
                            label: 'Coverage %',
                            data: data.trends.map(t => t.coverage),
                            borderColor: '#007acc',
                            backgroundColor: 'rgba(0, 122, 204, 0.1)',
                            fill: true,
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: {
                                beginAtZero: false,
                                min: Math.max(0, Math.min(...data.trends.map(t => t.coverage)) - 5),
                                max: 100
                            }
                        }
                    }
                });
            }

            // Error category chart
            if (data.errors.errorsByType) {
                const ctx = document.getElementById('errorCategoryChart').getContext('2d');

                if (errorCategoryChart) {
                    errorCategoryChart.destroy();
                }

                const categories = Object.entries(data.errors.errorsByType);
                if (categories.length > 0) {
                    errorCategoryChart = new Chart(ctx, {
                        type: 'doughnut',
                        data: {
                            labels: categories.map(([name]) => name.replace('_', ' ')),
                            datasets: [{
                                data: categories.map(([, cat]) => cat.count),
                                backgroundColor: [
                                    '#f44336', '#ff9800', '#ffc107', '#4caf50',
                                    '#2196f3', '#9c27b0', '#607d8b', '#795548'
                                ]
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false
                        }
                    });
                }
            }
        }

        async function refreshData() {
            const btn = document.querySelector('.refresh-btn');
            const originalText = btn.textContent;
            btn.textContent = 'Refreshing...';
            btn.disabled = true;

            try {
                await fetch('/api/refresh');
                await loadData();
            } catch (error) {
                console.error('Refresh failed:', error);
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        }

        // Initial load
        loadData();

        // Auto-refresh every 5 minutes
        setInterval(loadData, 5 * 60 * 1000);
    </script>
</body>
</html>`;
    }

    startPeriodicCollection() {
        console.log(`🔄 Starting periodic collection every ${this.options.interval} seconds`);

        setInterval(async () => {
            try {
                await this.collectMetrics();
                if (this.options.verbose) {
                    console.log('📊 Metrics updated:', new Date().toLocaleString());
                }
            } catch (error) {
                console.error('⚠️  Periodic collection failed:', error.message);
            }
        }, this.options.interval * 1000);

        // Graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n🛑 Shutting down dashboard...');
            if (this.server) {
                this.server.close();
            }
            process.exit(0);
        });
    }
}

// Run if called directly
if (require.main === module) {
    const dashboard = new TypeScriptMonitoringDashboard();
    dashboard.run().catch(console.error);
}

module.exports = { TypeScriptMonitoringDashboard };