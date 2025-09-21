#!/usr/bin/env node

/**
 * Performance Report Generator
 * Generates comprehensive HTML performance reports
 */

const fs = require('fs');
const path = require('path');
const { program } = require('commander');

class PerformanceReportGenerator {
  constructor(results, qualityGates, options = {}) {
    this.results = results;
    this.qualityGates = qualityGates;
    this.options = {
      format: 'html',
      includeCharts: true,
      includeRecommendations: true,
      theme: 'default',
      ...options
    };
  }

  /**
   * Generate performance report
   */
  async generate() {
    console.log(`📊 Generating ${this.options.format} performance report...`);

    switch (this.options.format.toLowerCase()) {
      case 'html':
        return this.generateHTMLReport();
      case 'json':
        return this.generateJSONReport();
      case 'markdown':
        return this.generateMarkdownReport();
      case 'pdf':
        return this.generatePDFReport();
      default:
        throw new Error(`Unsupported format: ${this.options.format}`);
    }
  }

  /**
   * Generate HTML report
   */
  generateHTMLReport() {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Test Report</title>
    <style>
        ${this.getCSS()}
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="container">
        ${this.generateHeader()}
        ${this.generateExecutiveSummary()}
        ${this.generateQualityGatesSection()}
        ${this.generateMetricsSection()}
        ${this.generateTrendsSection()}
        ${this.generateRecommendationsSection()}
        ${this.generateDetailsSection()}
        ${this.generateFooter()}
    </div>
    <script>
        ${this.getJavaScript()}
    </script>
</body>
</html>`;

    return html;
  }

  /**
   * Generate report header
   */
  generateHeader() {
    const metadata = this.results.metadata || {};
    const timestamp = new Date(metadata.timestamp || Date.now()).toLocaleString();

    return `
    <header class="report-header">
        <div class="header-content">
            <h1>🚀 Performance Test Report</h1>
            <div class="header-meta">
                <div class="meta-item">
                    <span class="meta-label">Generated:</span>
                    <span class="meta-value">${timestamp}</span>
                </div>
                ${metadata.branch ? `
                <div class="meta-item">
                    <span class="meta-label">Branch:</span>
                    <span class="meta-value">${metadata.branch}</span>
                </div>
                ` : ''}
                ${metadata.commit_sha ? `
                <div class="meta-item">
                    <span class="meta-label">Commit:</span>
                    <span class="meta-value">${metadata.commit_sha.substring(0, 7)}</span>
                </div>
                ` : ''}
                <div class="meta-item">
                    <span class="meta-label">Environment:</span>
                    <span class="meta-value">${metadata.environment || 'Unknown'}</span>
                </div>
            </div>
        </div>
        <div class="status-badge ${this.qualityGates.passed ? 'passed' : 'failed'}">
            ${this.qualityGates.passed ? '✅ PASSED' : '❌ FAILED'}
        </div>
    </header>`;
  }

  /**
   * Generate executive summary
   */
  generateExecutiveSummary() {
    const summary = this.results.summary || {};
    const qgSummary = this.qualityGates.summary || {};

    return `
    <section class="executive-summary">
        <h2>📈 Executive Summary</h2>
        <div class="summary-grid">
            <div class="summary-card score">
                <div class="card-header">
                    <h3>Overall Score</h3>
                    <div class="score-circle">
                        <span class="score-value">${this.qualityGates.score?.toFixed(1) || 0}%</span>
                    </div>
                </div>
                <div class="card-body">
                    <div class="trend-indicator ${summary.overall_trend}">
                        ${this.getTrendIcon(summary.overall_trend)} ${summary.overall_trend || 'stable'}
                    </div>
                </div>
            </div>

            <div class="summary-card tests">
                <div class="card-header">
                    <h3>Quality Gates</h3>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${(qgSummary.passed / qgSummary.total * 100) || 0}%"></div>
                    </div>
                </div>
                <div class="card-body">
                    <div class="stat-row">
                        <span>Passed:</span>
                        <span class="stat-value passed">${qgSummary.passed || 0}</span>
                    </div>
                    <div class="stat-row">
                        <span>Failed:</span>
                        <span class="stat-value failed">${qgSummary.failed || 0}</span>
                    </div>
                    <div class="stat-row">
                        <span>Total:</span>
                        <span class="stat-value">${qgSummary.total || 0}</span>
                    </div>
                </div>
            </div>

            <div class="summary-card metrics">
                <div class="card-header">
                    <h3>Performance Impact</h3>
                    <div class="impact-badge ${this.qualityGates.impact?.overall}">
                        ${this.getImpactIcon(this.qualityGates.impact?.overall)}
                        ${this.qualityGates.impact?.overall || 'none'}
                    </div>
                </div>
                <div class="card-body">
                    <div class="stat-row">
                        <span>Test Types:</span>
                        <span class="stat-value">${summary.test_types?.length || 0}</span>
                    </div>
                    <div class="stat-row">
                        <span>Metrics:</span>
                        <span class="stat-value">${summary.total_metrics || 0}</span>
                    </div>
                    <div class="stat-row">
                        <span>Regressions:</span>
                        <span class="stat-value ${qgSummary.regressions > 0 ? 'warning' : ''}">${qgSummary.regressions || 0}</span>
                    </div>
                </div>
            </div>

            <div class="summary-card duration">
                <div class="card-header">
                    <h3>Test Execution</h3>
                    <div class="duration-value">
                        ${this.formatDuration(summary.duration_ms || 0)}
                    </div>
                </div>
                <div class="card-body">
                    <div class="stat-row">
                        <span>Test Types:</span>
                        <span class="stat-value">${(summary.test_types || []).join(', ') || 'None'}</span>
                    </div>
                </div>
            </div>
        </div>
    </section>`;
  }

  /**
   * Generate quality gates section
   */
  generateQualityGatesSection() {
    const gates = this.qualityGates.gates || {};

    return `
    <section class="quality-gates">
        <h2>🎯 Quality Gates</h2>
        <div class="gates-grid">
            ${Object.entries(gates).map(([gateName, gateData]) => `
            <div class="gate-card ${gateData.passed ? 'passed' : 'failed'} ${gateData.critical ? 'critical' : ''}">
                <div class="gate-header">
                    <h3>${this.formatGateName(gateName)}</h3>
                    <div class="gate-status">
                        ${gateData.passed ? '✅' : '❌'}
                        <span class="gate-score">${gateData.score?.toFixed(1) || 0}%</span>
                    </div>
                </div>
                <div class="gate-body">
                    <div class="gate-weight">Weight: ${(gateData.weight * 100).toFixed(0)}%</div>
                    ${gateData.critical ? '<div class="critical-badge">Critical</div>' : ''}

                    ${gateData.violations?.length > 0 ? `
                    <div class="violations">
                        <h4>Violations:</h4>
                        <ul>
                            ${gateData.violations.map(v => `<li class="violation">${v.violation}</li>`).join('')}
                        </ul>
                    </div>
                    ` : ''}

                    ${gateData.regressions?.length > 0 ? `
                    <div class="regressions">
                        <h4>Regressions:</h4>
                        <ul>
                            ${gateData.regressions.map(r => `
                            <li class="regression ${r.impact}">
                                ${r.name}: ${r.violation || 'Performance degradation detected'}
                            </li>
                            `).join('')}
                        </ul>
                    </div>
                    ` : ''}
                </div>
            </div>
            `).join('')}
        </div>
    </section>`;
  }

  /**
   * Generate metrics section with charts
   */
  generateMetricsSection() {
    const metrics = this.qualityGates.metrics || [];

    return `
    <section class="metrics-section">
        <h2>📊 Performance Metrics</h2>

        ${this.options.includeCharts ? `
        <div class="charts-container">
            <div class="chart-card">
                <h3>Response Time Metrics</h3>
                <canvas id="responseTimeChart"></canvas>
            </div>
            <div class="chart-card">
                <h3>Resource Usage</h3>
                <canvas id="resourceChart"></canvas>
            </div>
            <div class="chart-card">
                <h3>Performance Changes</h3>
                <canvas id="changesChart"></canvas>
            </div>
        </div>
        ` : ''}

        <div class="metrics-table-container">
            <table class="metrics-table">
                <thead>
                    <tr>
                        <th>Metric</th>
                        <th>Current</th>
                        <th>Baseline</th>
                        <th>Change</th>
                        <th>Status</th>
                        <th>Impact</th>
                    </tr>
                </thead>
                <tbody>
                    ${metrics.map(metric => `
                    <tr class="metric-row ${metric.status}">
                        <td class="metric-name">${this.formatMetricName(metric.name)}</td>
                        <td class="metric-current">${this.formatMetricValue(metric.current)}</td>
                        <td class="metric-baseline">${this.formatMetricValue(metric.baseline)}</td>
                        <td class="metric-change ${metric.change >= 0 ? 'positive' : 'negative'}">
                            ${metric.change >= 0 ? '+' : ''}${metric.change?.toFixed(1) || 0}%
                        </td>
                        <td class="metric-status">
                            <span class="status-badge ${metric.status}">${metric.status}</span>
                        </td>
                        <td class="metric-impact">
                            <span class="impact-badge ${metric.impact}">${metric.impact}</span>
                        </td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </section>`;
  }

  /**
   * Generate trends section
   */
  generateTrendsSection() {
    const trends = this.results.trends || {};

    return `
    <section class="trends-section">
        <h2>📈 Performance Trends</h2>
        <div class="trends-grid">
            ${Object.entries(trends).map(([testType, trendData]) => `
            <div class="trend-card">
                <h3>${this.formatTestType(testType)}</h3>

                ${trendData.trending_up?.length > 0 ? `
                <div class="trend-group trending-up">
                    <h4>📈 Improving</h4>
                    <ul>
                        ${trendData.trending_up.slice(0, 5).map(item => `
                        <li>
                            <span class="metric-name">${this.formatMetricName(item.metric)}</span>
                            <span class="change-value positive">+${item.change.toFixed(1)}%</span>
                        </li>
                        `).join('')}
                    </ul>
                </div>
                ` : ''}

                ${trendData.trending_down?.length > 0 ? `
                <div class="trend-group trending-down">
                    <h4>📉 Declining</h4>
                    <ul>
                        ${trendData.trending_down.slice(0, 5).map(item => `
                        <li>
                            <span class="metric-name">${this.formatMetricName(item.metric)}</span>
                            <span class="change-value negative">${item.change.toFixed(1)}%</span>
                        </li>
                        `).join('')}
                    </ul>
                </div>
                ` : ''}

                ${trendData.stable?.length > 0 ? `
                <div class="trend-group stable">
                    <h4>📊 Stable</h4>
                    <div class="stable-count">${trendData.stable.length} metrics unchanged</div>
                </div>
                ` : ''}
            </div>
            `).join('')}
        </div>
    </section>`;
  }

  /**
   * Generate recommendations section
   */
  generateRecommendationsSection() {
    if (!this.options.includeRecommendations || !this.qualityGates.recommendations?.length) {
      return '';
    }

    const recommendations = this.qualityGates.recommendations;

    return `
    <section class="recommendations-section">
        <h2>💡 Recommendations</h2>
        <div class="recommendations-list">
            ${recommendations.map(rec => `
            <div class="recommendation-card priority-${rec.priority}">
                <div class="rec-header">
                    <div class="rec-priority ${rec.priority}">
                        ${this.getPriorityIcon(rec.priority)} ${rec.priority.toUpperCase()}
                    </div>
                    <div class="rec-type">${rec.type.replace(/_/g, ' ')}</div>
                </div>
                <div class="rec-body">
                    <div class="rec-message">${rec.message}</div>
                    ${rec.action ? `<div class="rec-action"><strong>Action:</strong> ${rec.action}</div>` : ''}
                    ${rec.metrics ? `
                    <div class="rec-metrics">
                        <strong>Affected metrics:</strong> ${rec.metrics.join(', ')}
                    </div>
                    ` : ''}
                </div>
            </div>
            `).join('')}
        </div>
    </section>`;
  }

  /**
   * Generate detailed results section
   */
  generateDetailsSection() {
    return `
    <section class="details-section">
        <h2>🔍 Detailed Results</h2>

        <div class="details-tabs">
            <button class="tab-button active" onclick="showTab('raw-data')">Raw Data</button>
            <button class="tab-button" onclick="showTab('statistics')">Statistics</button>
            <button class="tab-button" onclick="showTab('configuration')">Configuration</button>
        </div>

        <div id="raw-data" class="tab-content active">
            <h3>Raw Performance Data</h3>
            <pre class="json-data">${JSON.stringify(this.results.results || {}, null, 2)}</pre>
        </div>

        <div id="statistics" class="tab-content">
            <h3>Statistical Analysis</h3>
            <pre class="json-data">${JSON.stringify(this.results.statistics || {}, null, 2)}</pre>
        </div>

        <div id="configuration" class="tab-content">
            <h3>Test Configuration</h3>
            <pre class="json-data">${JSON.stringify(this.results.metadata || {}, null, 2)}</pre>
        </div>
    </section>`;
  }

  /**
   * Generate report footer
   */
  generateFooter() {
    return `
    <footer class="report-footer">
        <div class="footer-content">
            <div class="footer-info">
                <p>Generated by Performance Testing Suite</p>
                <p>Report Version: 1.0.0</p>
            </div>
            <div class="footer-timestamp">
                <p>Generated at: ${new Date().toLocaleString()}</p>
            </div>
        </div>
    </footer>`;
  }

  /**
   * Get CSS styles for the report
   */
  getCSS() {
    return `
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: white;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
        }

        .report-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 30px 0;
            border-bottom: 2px solid #eee;
            margin-bottom: 30px;
        }

        .header-content h1 {
            font-size: 2.5em;
            color: #2c3e50;
            margin-bottom: 10px;
        }

        .header-meta {
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
        }

        .meta-item {
            display: flex;
            gap: 5px;
        }

        .meta-label {
            font-weight: bold;
            color: #666;
        }

        .meta-value {
            color: #333;
        }

        .status-badge {
            padding: 10px 20px;
            border-radius: 5px;
            font-weight: bold;
            font-size: 1.1em;
        }

        .status-badge.passed {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }

        .status-badge.failed {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }

        .executive-summary {
            margin-bottom: 40px;
        }

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }

        .summary-card {
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }

        .card-header h3 {
            color: #2c3e50;
            font-size: 1.2em;
        }

        .score-circle {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: #3498db;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
        }

        .progress-bar {
            width: 100px;
            height: 8px;
            background: #eee;
            border-radius: 4px;
            overflow: hidden;
        }

        .progress-fill {
            height: 100%;
            background: #28a745;
            transition: width 0.3s ease;
        }

        .impact-badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.9em;
            font-weight: bold;
        }

        .impact-badge.none { background: #e9ecef; color: #6c757d; }
        .impact-badge.improvement { background: #d4edda; color: #155724; }
        .impact-badge.regression { background: #f8d7da; color: #721c24; }
        .impact-badge.degradation { background: #fff3cd; color: #856404; }

        .trend-indicator {
            display: flex;
            align-items: center;
            gap: 5px;
            font-weight: bold;
            text-transform: capitalize;
        }

        .trend-indicator.improved { color: #28a745; }
        .trend-indicator.degraded { color: #dc3545; }
        .trend-indicator.mixed { color: #ffc107; }
        .trend-indicator.stable { color: #6c757d; }

        .stat-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
        }

        .stat-value {
            font-weight: bold;
        }

        .stat-value.passed { color: #28a745; }
        .stat-value.failed { color: #dc3545; }
        .stat-value.warning { color: #ffc107; }

        .quality-gates {
            margin-bottom: 40px;
        }

        .gates-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }

        .gate-card {
            border: 2px solid #ddd;
            border-radius: 8px;
            padding: 20px;
            background: white;
        }

        .gate-card.passed {
            border-color: #28a745;
            background: #f8fff9;
        }

        .gate-card.failed {
            border-color: #dc3545;
            background: #fff8f8;
        }

        .gate-card.critical {
            border-width: 3px;
        }

        .gate-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }

        .gate-status {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .gate-score {
            font-weight: bold;
            font-size: 1.1em;
        }

        .critical-badge {
            background: #dc3545;
            color: white;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 0.8em;
            font-weight: bold;
        }

        .violations, .regressions {
            margin-top: 15px;
        }

        .violations h4, .regressions h4 {
            color: #dc3545;
            margin-bottom: 8px;
        }

        .violation, .regression {
            margin-bottom: 5px;
            font-size: 0.9em;
        }

        .metrics-table-container {
            overflow-x: auto;
            margin-top: 20px;
        }

        .metrics-table {
            width: 100%;
            border-collapse: collapse;
            background: white;
        }

        .metrics-table th {
            background: #f8f9fa;
            padding: 12px;
            text-align: left;
            border-bottom: 2px solid #dee2e6;
            font-weight: bold;
        }

        .metrics-table td {
            padding: 10px 12px;
            border-bottom: 1px solid #dee2e6;
        }

        .metric-row.pass {
            background: #f8fff9;
        }

        .metric-row.fail {
            background: #fff8f8;
        }

        .metric-change.positive {
            color: #28a745;
        }

        .metric-change.negative {
            color: #dc3545;
        }

        .status-badge {
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 0.8em;
            font-weight: bold;
        }

        .status-badge.pass {
            background: #d4edda;
            color: #155724;
        }

        .status-badge.fail {
            background: #f8d7da;
            color: #721c24;
        }

        .charts-container {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }

        .chart-card {
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 20px;
        }

        .chart-card h3 {
            margin-bottom: 15px;
            color: #2c3e50;
        }

        .recommendations-list {
            display: flex;
            flex-direction: column;
            gap: 15px;
            margin-top: 20px;
        }

        .recommendation-card {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 20px;
            background: white;
        }

        .recommendation-card.priority-critical {
            border-left: 4px solid #dc3545;
        }

        .recommendation-card.priority-high {
            border-left: 4px solid #fd7e14;
        }

        .recommendation-card.priority-medium {
            border-left: 4px solid #ffc107;
        }

        .recommendation-card.priority-low {
            border-left: 4px solid #28a745;
        }

        .rec-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }

        .rec-priority {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            font-weight: bold;
        }

        .rec-priority.critical { background: #f8d7da; color: #721c24; }
        .rec-priority.high { background: #fff3cd; color: #856404; }
        .rec-priority.medium { background: #fff3cd; color: #856404; }
        .rec-priority.low { background: #d4edda; color: #155724; }

        .rec-type {
            color: #666;
            font-size: 0.9em;
            text-transform: capitalize;
        }

        .rec-message {
            margin-bottom: 10px;
            font-weight: 500;
        }

        .rec-action {
            margin-bottom: 10px;
            font-size: 0.9em;
        }

        .rec-metrics {
            font-size: 0.8em;
            color: #666;
        }

        .details-tabs {
            display: flex;
            border-bottom: 1px solid #ddd;
            margin-bottom: 20px;
        }

        .tab-button {
            padding: 10px 20px;
            border: none;
            background: none;
            cursor: pointer;
            border-bottom: 2px solid transparent;
        }

        .tab-button.active {
            border-bottom-color: #007bff;
            color: #007bff;
        }

        .tab-content {
            display: none;
        }

        .tab-content.active {
            display: block;
        }

        .json-data {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 5px;
            overflow-x: auto;
            font-size: 0.9em;
            line-height: 1.4;
        }

        .report-footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #666;
            font-size: 0.9em;
        }

        .footer-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        @media (max-width: 768px) {
            .container {
                padding: 10px;
            }

            .report-header {
                flex-direction: column;
                text-align: center;
            }

            .header-meta {
                justify-content: center;
                margin-top: 15px;
            }

            .summary-grid {
                grid-template-columns: 1fr;
            }

            .gates-grid {
                grid-template-columns: 1fr;
            }

            .charts-container {
                grid-template-columns: 1fr;
            }

            .footer-content {
                flex-direction: column;
                text-align: center;
                gap: 10px;
            }
        }
    `;
  }

  /**
   * Get JavaScript for interactive features
   */
  getJavaScript() {
    const metricsData = this.prepareChartData();

    return `
        // Tab functionality
        function showTab(tabId) {
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            document.querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.remove('active');
            });

            document.getElementById(tabId).classList.add('active');
            event.target.classList.add('active');
        }

        // Chart data
        const metricsData = ${JSON.stringify(metricsData)};

        // Initialize charts when DOM is loaded
        document.addEventListener('DOMContentLoaded', function() {
            if (typeof Chart !== 'undefined') {
                initializeCharts();
            }
        });

        function initializeCharts() {
            // Response Time Chart
            const responseCtx = document.getElementById('responseTimeChart');
            if (responseCtx && metricsData.responseTime.length > 0) {
                new Chart(responseCtx, {
                    type: 'bar',
                    data: {
                        labels: metricsData.responseTime.map(m => m.name),
                        datasets: [{
                            label: 'Current (ms)',
                            data: metricsData.responseTime.map(m => m.current),
                            backgroundColor: 'rgba(54, 162, 235, 0.8)'
                        }, {
                            label: 'Baseline (ms)',
                            data: metricsData.responseTime.map(m => m.baseline),
                            backgroundColor: 'rgba(255, 99, 132, 0.8)'
                        }]
                    },
                    options: {
                        responsive: true,
                        scales: {
                            y: { beginAtZero: true }
                        }
                    }
                });
            }

            // Resource Usage Chart
            const resourceCtx = document.getElementById('resourceChart');
            if (resourceCtx && metricsData.resources.length > 0) {
                new Chart(resourceCtx, {
                    type: 'doughnut',
                    data: {
                        labels: metricsData.resources.map(m => m.name),
                        datasets: [{
                            data: metricsData.resources.map(m => m.current),
                            backgroundColor: [
                                'rgba(255, 99, 132, 0.8)',
                                'rgba(54, 162, 235, 0.8)',
                                'rgba(255, 205, 86, 0.8)',
                                'rgba(75, 192, 192, 0.8)',
                                'rgba(153, 102, 255, 0.8)'
                            ]
                        }]
                    },
                    options: {
                        responsive: true
                    }
                });
            }

            // Performance Changes Chart
            const changesCtx = document.getElementById('changesChart');
            if (changesCtx && metricsData.changes.length > 0) {
                new Chart(changesCtx, {
                    type: 'line',
                    data: {
                        labels: metricsData.changes.map(m => m.name),
                        datasets: [{
                            label: 'Change %',
                            data: metricsData.changes.map(m => m.change),
                            borderColor: 'rgba(75, 192, 192, 1)',
                            backgroundColor: 'rgba(75, 192, 192, 0.2)',
                            fill: true
                        }]
                    },
                    options: {
                        responsive: true,
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    callback: function(value) {
                                        return value + '%';
                                    }
                                }
                            }
                        }
                    }
                });
            }
        }
    `;
  }

  /**
   * Prepare data for charts
   */
  prepareChartData() {
    const metrics = this.qualityGates.metrics || [];

    return {
      responseTime: metrics
        .filter(m => m.name.toLowerCase().includes('response') || m.name.toLowerCase().includes('latency'))
        .slice(0, 10),
      resources: metrics
        .filter(m => m.name.toLowerCase().includes('memory') || m.name.toLowerCase().includes('cpu'))
        .slice(0, 5),
      changes: metrics
        .filter(m => Math.abs(m.change) > 0)
        .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
        .slice(0, 10)
    };
  }

  /**
   * Helper methods for formatting
   */
  formatGateName(name) {
    return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  formatMetricName(name) {
    return name.replace(/\./g, ' › ').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  formatTestType(type) {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  formatMetricValue(value) {
    if (typeof value !== 'number') return value || 'N/A';

    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    } else if (value < 1) {
      return value.toFixed(3);
    } else {
      return value.toFixed(1);
    }
  }

  formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }

  getTrendIcon(trend) {
    switch (trend) {
      case 'improved': return '📈';
      case 'degraded': return '📉';
      case 'mixed': return '📊';
      default: return '➡️';
    }
  }

  getImpactIcon(impact) {
    switch (impact) {
      case 'improvement': return '🚀';
      case 'regression': return '⚠️';
      case 'degradation': return '🔴';
      default: return '✅';
    }
  }

  getPriorityIcon(priority) {
    switch (priority) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '💡';
      case 'low': return 'ℹ️';
      default: return '📝';
    }
  }

  /**
   * Generate JSON report
   */
  generateJSONReport() {
    return JSON.stringify({
      report_metadata: {
        generated_at: new Date().toISOString(),
        format: 'json',
        version: '1.0.0'
      },
      results: this.results,
      quality_gates: this.qualityGates
    }, null, 2);
  }

  /**
   * Generate Markdown report (simplified)
   */
  generateMarkdownReport() {
    const summary = this.results.summary || {};
    const qgSummary = this.qualityGates.summary || {};

    return `# Performance Test Report

## Executive Summary

- **Overall Status**: ${this.qualityGates.passed ? '✅ PASSED' : '❌ FAILED'}
- **Score**: ${this.qualityGates.score?.toFixed(1) || 0}%
- **Quality Gates**: ${qgSummary.passed || 0}/${qgSummary.total || 0} passed
- **Regressions**: ${qgSummary.regressions || 0}

## Key Metrics

${(this.qualityGates.metrics || []).slice(0, 10).map(m =>
  `- **${this.formatMetricName(m.name)}**: ${this.formatMetricValue(m.current)} (${m.change >= 0 ? '+' : ''}${m.change?.toFixed(1) || 0}% vs baseline)`
).join('\n')}

## Recommendations

${(this.qualityGates.recommendations || []).map(r =>
  `- **${r.priority.toUpperCase()}**: ${r.message}`
).join('\n')}

---
*Generated at: ${new Date().toLocaleString()}*
`;
  }
}

// CLI interface
program
  .name('generate-report')
  .description('Generate performance test reports')
  .requiredOption('-r, --results <path>', 'Performance results file')
  .requiredOption('-q, --quality-gates <path>', 'Quality gates results file')
  .requiredOption('-o, --output <path>', 'Output file for the report')
  .option('-f, --format <format>', 'Report format (html, json, markdown)', 'html')
  .option('--no-charts', 'Exclude charts from HTML report')
  .option('--no-recommendations', 'Exclude recommendations section')
  .option('--theme <theme>', 'Report theme (default, dark)', 'default')
  .action(async (options) => {
    try {
      console.log('📊 Performance Report Generator');
      console.log(`📄 Format: ${options.format}`);
      console.log(`📁 Output: ${options.output}`);

      // Load input files
      const results = JSON.parse(fs.readFileSync(options.results, 'utf8'));
      const qualityGates = JSON.parse(fs.readFileSync(options.qualityGates, 'utf8'));

      const generator = new PerformanceReportGenerator(results, qualityGates, {
        format: options.format,
        includeCharts: options.charts,
        includeRecommendations: options.recommendations,
        theme: options.theme
      });

      const report = await generator.generate();

      // Save report
      fs.writeFileSync(options.output, report);

      console.log('✅ Report generated successfully');
      console.log(`📊 Overall Status: ${qualityGates.passed ? 'PASSED' : 'FAILED'}`);
      console.log(`📈 Score: ${qualityGates.score?.toFixed(1) || 0}%`);

    } catch (error) {
      console.error('❌ Report generation failed:', error.message);
      process.exit(1);
    }
  });

if (require.main === module) {
  program.parse();
}

module.exports = PerformanceReportGenerator;