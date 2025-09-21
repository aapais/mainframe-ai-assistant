#!/usr/bin/env node

/**
 * TypeScript HTML Report Generator
 * Creates comprehensive HTML reports from TypeScript analysis data
 */

const fs = require('fs');
const path = require('path');

class TypeScriptReportGenerator {
    constructor() {
        this.projectRoot = process.cwd();
        this.options = this.parseArgs();
        this.templates = this.loadTemplates();
    }

    parseArgs() {
        const args = process.argv.slice(2);
        return {
            input: args.find(arg => arg.startsWith('--input='))?.split('=')[1] || 'coverage/type-coverage.json',
            output: args.find(arg => arg.startsWith('--output='))?.split('=')[1] || 'coverage/typescript-report.html',
            template: args.find(arg => arg.startsWith('--template='))?.split('=')[1] || 'default',
            title: args.find(arg => arg.startsWith('--title='))?.split('=')[1] || 'TypeScript Analysis Report',
            includeCharts: !args.includes('--no-charts'),
            includeTrends: args.includes('--trends'),
            verbose: args.includes('--verbose')
        };
    }

    async run() {
        console.log('📊 Generating TypeScript HTML report...');

        try {
            // Load analysis data
            const data = await this.loadAnalysisData();

            // Generate HTML report
            const html = await this.generateReport(data);

            // Save report
            await this.saveReport(html);

            console.log(`✅ Report generated: ${this.options.output}`);

        } catch (error) {
            console.error('❌ Report generation failed:', error.message);
            if (this.options.verbose) {
                console.error(error.stack);
            }
            process.exit(1);
        }
    }

    async loadAnalysisData() {
        const inputPath = path.resolve(this.projectRoot, this.options.input);

        if (!fs.existsSync(inputPath)) {
            throw new Error(`Analysis data not found: ${inputPath}`);
        }

        const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
        console.log(`📊 Loaded analysis data from ${inputPath}`);
        return data;
    }

    loadTemplates() {
        return {
            page: this.getPageTemplate(),
            charts: this.getChartsScript(),
            styles: this.getStyles()
        };
    }

    async generateReport(data) {
        console.log('🔨 Building HTML report...');

        const reportData = {
            title: this.options.title,
            timestamp: new Date().toLocaleString(),
            data: data,
            stats: this.calculateStats(data),
            charts: this.options.includeCharts ? this.generateChartData(data) : null
        };

        let html = this.templates.page;

        // Replace placeholders
        html = html.replace('{{TITLE}}', reportData.title);
        html = html.replace('{{TIMESTAMP}}', reportData.timestamp);
        html = html.replace('{{STYLES}}', this.templates.styles);
        html = html.replace('{{SUMMARY_HTML}}', this.generateSummaryHtml(reportData));
        html = html.replace('{{METRICS_HTML}}', this.generateMetricsHtml(reportData));
        html = html.replace('{{FILES_HTML}}', this.generateFilesHtml(reportData));
        html = html.replace('{{CHARTS_HTML}}', this.generateChartsHtml(reportData));
        html = html.replace('{{SCRIPTS}}', this.options.includeCharts ? this.templates.charts : '');

        return html;
    }

    calculateStats(data) {
        const files = data.files || [];
        const directories = data.directories || [];

        return {
            totalFiles: files.length,
            averageCoverage: files.length > 0 ? files.reduce((sum, f) => sum + f.percentage, 0) / files.length : 0,
            medianCoverage: this.calculateMedian(files.map(f => f.percentage)),
            topPerformer: files.reduce((best, file) => file.percentage > (best?.percentage || 0) ? file : best, null),
            worstPerformer: files.reduce((worst, file) => file.percentage < (worst?.percentage || 100) ? file : worst, null),
            totalDirectories: directories.length,
            perfectFiles: files.filter(f => f.percentage === 100).length,
            criticalFiles: files.filter(f => f.percentage < 50).length
        };
    }

    calculateMedian(values) {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    }

    generateSummaryHtml(reportData) {
        const { data, stats } = reportData;

        return `
        <div class="summary-section">
            <div class="summary-grid">
                <div class="summary-card primary">
                    <div class="metric-large">
                        <span class="metric-value">${data.overall?.toFixed(1) || '0.0'}%</span>
                        <span class="metric-label">Overall Coverage</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${data.overall || 0}%"></div>
                    </div>
                </div>

                <div class="summary-card">
                    <div class="metric">
                        <span class="metric-value">${stats.totalFiles}</span>
                        <span class="metric-label">Files Analyzed</span>
                    </div>
                </div>

                <div class="summary-card">
                    <div class="metric">
                        <span class="metric-value">${stats.averageCoverage.toFixed(1)}%</span>
                        <span class="metric-label">Average Coverage</span>
                    </div>
                </div>

                <div class="summary-card">
                    <div class="metric">
                        <span class="metric-value">${stats.perfectFiles}</span>
                        <span class="metric-label">Perfect Files</span>
                    </div>
                </div>

                <div class="summary-card ${stats.criticalFiles > 0 ? 'warning' : 'success'}">
                    <div class="metric">
                        <span class="metric-value">${stats.criticalFiles}</span>
                        <span class="metric-label">Critical Files</span>
                    </div>
                </div>

                <div class="summary-card">
                    <div class="metric">
                        <span class="metric-value">${data.passed ? '✅' : '❌'}</span>
                        <span class="metric-label">Threshold ${data.threshold}%</span>
                    </div>
                </div>
            </div>
        </div>`;
    }

    generateMetricsHtml(reportData) {
        const { data, stats } = reportData;
        const categories = data.categories || {};

        return `
        <div class="metrics-section">
            <h2>📊 Coverage Distribution</h2>

            <div class="category-grid">
                <div class="category-card excellent">
                    <div class="category-header">
                        <h3>Excellent (≥95%)</h3>
                        <span class="category-count">${categories.excellent?.count || 0}</span>
                    </div>
                    <div class="category-percentage">${(categories.excellent?.percentage || 0).toFixed(1)}% of files</div>
                </div>

                <div class="category-card good">
                    <div class="category-header">
                        <h3>Good (90-94%)</h3>
                        <span class="category-count">${categories.good?.count || 0}</span>
                    </div>
                    <div class="category-percentage">${(categories.good?.percentage || 0).toFixed(1)}% of files</div>
                </div>

                <div class="category-card warning">
                    <div class="category-header">
                        <h3>Warning (80-89%)</h3>
                        <span class="category-count">${categories.warning?.count || 0}</span>
                    </div>
                    <div class="category-percentage">${(categories.warning?.percentage || 0).toFixed(1)}% of files</div>
                </div>

                <div class="category-card poor">
                    <div class="category-header">
                        <h3>Poor (<80%)</h3>
                        <span class="category-count">${categories.poor?.count || 0}</span>
                    </div>
                    <div class="category-percentage">${(categories.poor?.percentage || 0).toFixed(1)}% of files</div>
                </div>
            </div>

            ${stats.topPerformer || stats.worstPerformer ? `
            <div class="highlights">
                ${stats.topPerformer ? `
                <div class="highlight excellent">
                    <h4>🏆 Top Performer</h4>
                    <p><strong>${stats.topPerformer.path}</strong></p>
                    <p>${stats.topPerformer.percentage.toFixed(1)}% (${stats.topPerformer.covered}/${stats.topPerformer.total})</p>
                </div>
                ` : ''}

                ${stats.worstPerformer ? `
                <div class="highlight poor">
                    <h4>⚠️ Needs Attention</h4>
                    <p><strong>${stats.worstPerformer.path}</strong></p>
                    <p>${stats.worstPerformer.percentage.toFixed(1)}% (${stats.worstPerformer.covered}/${stats.worstPerformer.total})</p>
                </div>
                ` : ''}
            </div>
            ` : ''}
        </div>`;
    }

    generateFilesHtml(reportData) {
        const { data } = reportData;
        const files = data.files || [];

        if (files.length === 0) {
            return '<div class="no-data">No file data available</div>';
        }

        const sortedFiles = [...files].sort((a, b) => a.percentage - b.percentage);

        return `
        <div class="files-section">
            <h2>📁 File Coverage Details</h2>

            <div class="files-table-container">
                <table class="files-table">
                    <thead>
                        <tr>
                            <th>File</th>
                            <th>Coverage</th>
                            <th>Lines</th>
                            <th>Status</th>
                            <th>Issues</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sortedFiles.map(file => `
                        <tr class="file-row ${this.getCoverageClass(file.percentage)}">
                            <td class="file-path" title="${file.path}">
                                ${this.truncatePath(file.path, 50)}
                            </td>
                            <td class="coverage-cell">
                                <div class="coverage-bar-small">
                                    <div class="coverage-fill-small" style="width: ${file.percentage}%"></div>
                                </div>
                                <span class="coverage-text">${file.percentage.toFixed(1)}%</span>
                            </td>
                            <td class="lines-cell">${file.covered}/${file.total}</td>
                            <td class="status-cell">
                                <span class="status-badge ${this.getCoverageClass(file.percentage)}">
                                    ${this.getCoverageLabel(file.percentage)}
                                </span>
                            </td>
                            <td class="issues-cell">
                                ${file.uncoveredLines?.length || 0} uncovered lines
                                ${file.uncoveredLines?.length > 0 ? `
                                <div class="issues-detail">
                                    ${file.uncoveredLines.slice(0, 3).map(line =>
                                        `<div class="issue-line">Line ${line.line}: ${line.reason}</div>`
                                    ).join('')}
                                    ${file.uncoveredLines.length > 3 ?
                                        `<div class="issue-line">... and ${file.uncoveredLines.length - 3} more</div>`
                                        : ''
                                    }
                                </div>
                                ` : ''}
                            </td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
    }

    generateChartsHtml(reportData) {
        if (!this.options.includeCharts) {
            return '';
        }

        const { data } = reportData;

        return `
        <div class="charts-section">
            <h2>📈 Visual Analysis</h2>

            <div class="charts-grid">
                <div class="chart-container">
                    <h3>Coverage Distribution</h3>
                    <canvas id="coverageChart" width="400" height="200"></canvas>
                </div>

                <div class="chart-container">
                    <h3>Directory Coverage</h3>
                    <canvas id="directoryChart" width="400" height="200"></canvas>
                </div>
            </div>

            <script>
                // Chart data
                window.chartData = ${JSON.stringify(this.generateChartData(data))};
            </script>
        </div>`;
    }

    generateChartData(data) {
        const categories = data.categories || {};
        const directories = data.directories || [];

        return {
            coverage: {
                labels: ['Excellent (≥95%)', 'Good (90-94%)', 'Warning (80-89%)', 'Poor (<80%)'],
                data: [
                    categories.excellent?.count || 0,
                    categories.good?.count || 0,
                    categories.warning?.count || 0,
                    categories.poor?.count || 0
                ],
                colors: ['#4caf50', '#8bc34a', '#ff9800', '#f44336']
            },
            directories: {
                labels: directories.slice(0, 10).map(d => d.directory),
                data: directories.slice(0, 10).map(d => d.percentage),
                colors: directories.slice(0, 10).map(d => this.getCoverageColor(d.percentage))
            }
        };
    }

    getCoverageClass(percentage) {
        if (percentage >= 95) return 'excellent';
        if (percentage >= 90) return 'good';
        if (percentage >= 80) return 'warning';
        return 'poor';
    }

    getCoverageLabel(percentage) {
        if (percentage >= 95) return 'Excellent';
        if (percentage >= 90) return 'Good';
        if (percentage >= 80) return 'Warning';
        return 'Poor';
    }

    getCoverageColor(percentage) {
        if (percentage >= 95) return '#4caf50';
        if (percentage >= 90) return '#8bc34a';
        if (percentage >= 80) return '#ff9800';
        return '#f44336';
    }

    truncatePath(path, maxLength) {
        if (path.length <= maxLength) return path;
        const parts = path.split('/');
        if (parts.length <= 2) return path;
        return '.../' + parts.slice(-2).join('/');
    }

    async saveReport(html) {
        const outputPath = path.resolve(this.projectRoot, this.options.output);
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, html);
    }

    getPageTemplate() {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{TITLE}}</title>
    <style>{{STYLES}}</style>
</head>
<body>
    <div class="container">
        <header class="header">
            <h1>{{TITLE}}</h1>
            <p class="timestamp">Generated on {{TIMESTAMP}}</p>
        </header>

        {{SUMMARY_HTML}}
        {{METRICS_HTML}}
        {{FILES_HTML}}
        {{CHARTS_HTML}}

        <footer class="footer">
            <p>Generated by TypeScript Report Generator</p>
        </footer>
    </div>

    {{SCRIPTS}}
</body>
</html>`;
    }

    getStyles() {
        return `
        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f7fa;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            background: linear-gradient(135deg, #007acc, #005a9e);
            color: white;
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 30px;
            text-align: center;
        }

        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }

        .timestamp {
            opacity: 0.8;
            font-size: 0.9em;
        }

        .summary-section, .metrics-section, .files-section, .charts-section {
            background: white;
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 30px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
        }

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
        }

        .summary-card {
            padding: 20px;
            border-radius: 8px;
            background: #f8f9fa;
            border: 2px solid #e9ecef;
            text-align: center;
        }

        .summary-card.primary {
            background: linear-gradient(135deg, #007acc, #005a9e);
            color: white;
            border-color: #007acc;
        }

        .summary-card.success {
            border-color: #4caf50;
            background: #f1f8e9;
        }

        .summary-card.warning {
            border-color: #ff9800;
            background: #fff3e0;
        }

        .metric-large .metric-value {
            font-size: 3em;
            font-weight: bold;
            display: block;
        }

        .metric .metric-value {
            font-size: 2em;
            font-weight: bold;
            display: block;
            color: #007acc;
        }

        .summary-card.primary .metric-value {
            color: white;
        }

        .metric-label {
            font-size: 0.9em;
            color: #666;
            margin-top: 5px;
        }

        .summary-card.primary .metric-label {
            color: rgba(255, 255, 255, 0.8);
        }

        .progress-bar {
            height: 8px;
            background: rgba(255, 255, 255, 0.3);
            border-radius: 4px;
            margin-top: 15px;
            overflow: hidden;
        }

        .progress-fill {
            height: 100%;
            background: white;
            border-radius: 4px;
            transition: width 0.3s ease;
        }

        .category-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }

        .category-card {
            padding: 20px;
            border-radius: 8px;
            border: 2px solid;
        }

        .category-card.excellent { border-color: #4caf50; background: #f1f8e9; }
        .category-card.good { border-color: #8bc34a; background: #f9fbe7; }
        .category-card.warning { border-color: #ff9800; background: #fff3e0; }
        .category-card.poor { border-color: #f44336; background: #ffebee; }

        .category-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }

        .category-count {
            font-size: 2em;
            font-weight: bold;
        }

        .highlights {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 30px;
        }

        .highlight {
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid;
        }

        .highlight.excellent { border-color: #4caf50; background: #f1f8e9; }
        .highlight.poor { border-color: #f44336; background: #ffebee; }

        .files-table-container {
            overflow-x: auto;
        }

        .files-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }

        .files-table th {
            background: #007acc;
            color: white;
            padding: 15px 12px;
            text-align: left;
            font-weight: 600;
        }

        .files-table td {
            padding: 12px;
            border-bottom: 1px solid #e9ecef;
        }

        .file-row:hover {
            background: #f8f9fa;
        }

        .file-path {
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 0.85em;
        }

        .coverage-cell {
            min-width: 120px;
        }

        .coverage-bar-small {
            height: 6px;
            background: #e0e0e0;
            border-radius: 3px;
            margin-bottom: 5px;
        }

        .coverage-fill-small {
            height: 100%;
            border-radius: 3px;
            transition: width 0.3s ease;
        }

        .file-row.excellent .coverage-fill-small { background: #4caf50; }
        .file-row.good .coverage-fill-small { background: #8bc34a; }
        .file-row.warning .coverage-fill-small { background: #ff9800; }
        .file-row.poor .coverage-fill-small { background: #f44336; }

        .status-badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            font-weight: 600;
            text-transform: uppercase;
        }

        .status-badge.excellent { background: #4caf50; color: white; }
        .status-badge.good { background: #8bc34a; color: white; }
        .status-badge.warning { background: #ff9800; color: white; }
        .status-badge.poor { background: #f44336; color: white; }

        .issues-detail {
            margin-top: 8px;
            font-size: 0.85em;
            color: #666;
        }

        .issue-line {
            background: #f8f9fa;
            padding: 2px 6px;
            margin: 2px 0;
            border-radius: 3px;
            font-family: 'Monaco', 'Menlo', monospace;
        }

        .charts-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 30px;
            margin-top: 20px;
        }

        .chart-container {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }

        .chart-container h3 {
            margin-bottom: 20px;
            color: #007acc;
        }

        .footer {
            text-align: center;
            padding: 20px;
            color: #666;
            border-top: 1px solid #e9ecef;
            margin-top: 30px;
        }

        .no-data {
            text-align: center;
            padding: 40px;
            color: #666;
            font-style: italic;
        }

        @media (max-width: 768px) {
            .container { padding: 10px; }
            .summary-grid { grid-template-columns: 1fr; }
            .category-grid { grid-template-columns: 1fr; }
            .charts-grid { grid-template-columns: 1fr; }
            .highlights { grid-template-columns: 1fr; }
        }`;
    }

    getChartsScript() {
        return `
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <script>
            document.addEventListener('DOMContentLoaded', function() {
                if (typeof Chart !== 'undefined' && window.chartData) {
                    // Coverage Distribution Chart
                    const coverageCtx = document.getElementById('coverageChart');
                    if (coverageCtx) {
                        new Chart(coverageCtx, {
                            type: 'doughnut',
                            data: {
                                labels: window.chartData.coverage.labels,
                                datasets: [{
                                    data: window.chartData.coverage.data,
                                    backgroundColor: window.chartData.coverage.colors,
                                    borderWidth: 2,
                                    borderColor: '#fff'
                                }]
                            },
                            options: {
                                responsive: true,
                                plugins: {
                                    legend: {
                                        position: 'bottom',
                                        labels: {
                                            padding: 20
                                        }
                                    }
                                }
                            }
                        });
                    }

                    // Directory Coverage Chart
                    const directoryCtx = document.getElementById('directoryChart');
                    if (directoryCtx && window.chartData.directories.labels.length > 0) {
                        new Chart(directoryCtx, {
                            type: 'bar',
                            data: {
                                labels: window.chartData.directories.labels,
                                datasets: [{
                                    label: 'Coverage %',
                                    data: window.chartData.directories.data,
                                    backgroundColor: window.chartData.directories.colors,
                                    borderColor: window.chartData.directories.colors,
                                    borderWidth: 1
                                }]
                            },
                            options: {
                                responsive: true,
                                scales: {
                                    y: {
                                        beginAtZero: true,
                                        max: 100,
                                        ticks: {
                                            callback: function(value) {
                                                return value + '%';
                                            }
                                        }
                                    }
                                },
                                plugins: {
                                    legend: {
                                        display: false
                                    }
                                }
                            }
                        });
                    }
                }
            });
        </script>`;
    }
}

// Run if called directly
if (require.main === module) {
    const generator = new TypeScriptReportGenerator();
    generator.run().catch(console.error);
}

module.exports = { TypeScriptReportGenerator };