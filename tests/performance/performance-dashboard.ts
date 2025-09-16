/**
 * Performance Dashboard Generator
 * Creates HTML dashboard and reports for performance monitoring and visualization
 */

import fs from 'fs/promises';
import path from 'path';
import type { PerformanceReport, PerformanceMeasurement, RegressionAnalysis } from './performance-benchmark-runner';

interface DashboardConfig {
  title: string;
  description: string;
  refreshInterval?: number; // seconds
  includeCharts: boolean;
  includeHistory: boolean;
  maxHistoryEntries: number;
}

interface HistoricalData {
  reports: PerformanceReport[];
  trends: {
    [benchmarkName: string]: {
      timestamps: number[];
      durations: number[];
      memoryUsage: number[];
      trend: 'improving' | 'degrading' | 'stable';
      changeRate: number; // ms per day
    };
  };
}

export class PerformanceDashboard {
  private config: DashboardConfig;
  private reportPath: string;
  private dashboardPath: string;

  constructor(
    reportPath: string = './performance-reports',
    dashboardPath: string = './performance-dashboard',
    config?: Partial<DashboardConfig>
  ) {
    this.reportPath = reportPath;
    this.dashboardPath = dashboardPath;
    this.config = {
      title: 'UI Component Performance Dashboard',
      description: 'Real-time performance monitoring for Mainframe KB Assistant UI components',
      refreshInterval: 300, // 5 minutes
      includeCharts: true,
      includeHistory: true,
      maxHistoryEntries: 50,
      ...config,
    };
  }

  /**
   * Generate complete performance dashboard
   */
  async generateDashboard(report: PerformanceReport): Promise<void> {
    try {
      await fs.mkdir(this.dashboardPath, { recursive: true });

      // Load historical data
      const historicalData = await this.loadHistoricalData();

      // Update historical data with current report
      this.updateHistoricalData(historicalData, report);

      // Generate dashboard HTML
      const dashboardHtml = this.generateDashboardHTML(report, historicalData);

      // Save dashboard
      const dashboardFile = path.join(this.dashboardPath, 'index.html');
      await fs.writeFile(dashboardFile, dashboardHtml);

      // Generate additional assets
      await this.generateAssets();

      // Save updated historical data
      await this.saveHistoricalData(historicalData);

      console.log(`📊 Performance dashboard generated: ${dashboardFile}`);
      console.log(`🌐 Open file://${path.resolve(dashboardFile)} in your browser`);
    } catch (error) {
      console.error('Failed to generate performance dashboard:', error);
      throw error;
    }
  }

  /**
   * Generate HTML dashboard content
   */
  private generateDashboardHTML(report: PerformanceReport, historicalData: HistoricalData): string {
    const { summary } = report;
    const passRate = summary.totalBenchmarks > 0
      ? ((summary.passedBenchmarks / summary.totalBenchmarks) * 100).toFixed(1)
      : '0';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.config.title}</title>
    <link rel="stylesheet" href="dashboard.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="dashboard.js"></script>
</head>
<body>
    <div class="dashboard-container">
        <!-- Header -->
        <header class="dashboard-header">
            <h1>${this.config.title}</h1>
            <p>${this.config.description}</p>
            <div class="last-updated">
                Last Updated: <span class="timestamp">${new Date(report.timestamp).toLocaleString()}</span>
            </div>
        </header>

        <!-- Summary Cards -->
        <section class="summary-cards">
            <div class="card ${summary.regressionCount > 0 ? 'card-warning' : 'card-success'}">
                <h3>Overall Health</h3>
                <div class="metric-value">${passRate}%</div>
                <div class="metric-label">Pass Rate</div>
            </div>

            <div class="card">
                <h3>Benchmarks</h3>
                <div class="metric-value">${summary.totalBenchmarks}</div>
                <div class="metric-breakdown">
                    <span class="success">${summary.passedBenchmarks} passed</span>
                    <span class="warning">${summary.warningBenchmarks} warnings</span>
                    <span class="error">${summary.failedBenchmarks} failed</span>
                </div>
            </div>

            <div class="card">
                <h3>Average Performance</h3>
                <div class="metric-value">${summary.averagePerformance.toFixed(1)}ms</div>
                <div class="metric-label">Render Time</div>
            </div>

            <div class="card ${summary.regressionCount > 0 ? 'card-error' : 'card-success'}">
                <h3>Regressions</h3>
                <div class="metric-value">${summary.regressionCount}</div>
                <div class="metric-label">Active Issues</div>
            </div>
        </section>

        <!-- Performance Charts -->
        ${this.config.includeCharts ? this.generateChartsSection(report, historicalData) : ''}

        <!-- Benchmark Results -->
        <section class="benchmark-results">
            <h2>Benchmark Results</h2>
            <div class="benchmark-grid">
                ${report.benchmarks.map(benchmark => this.generateBenchmarkCard(benchmark)).join('')}
            </div>
        </section>

        <!-- Regression Analysis -->
        ${report.regressions.length > 0 ? this.generateRegressionsSection(report.regressions) : ''}

        <!-- Recommendations -->
        <section class="recommendations">
            <h2>Recommendations</h2>
            <ul class="recommendation-list">
                ${report.recommendations.map(rec => `<li class="recommendation-item">${rec}</li>`).join('')}
            </ul>
        </section>

        <!-- Historical Trends -->
        ${this.config.includeHistory ? this.generateHistorySection(historicalData) : ''}

        <!-- System Information -->
        <section class="system-info">
            <h2>System Information</h2>
            <div class="info-grid">
                <div class="info-item">
                    <strong>Environment:</strong> ${report.metadata.environment}
                </div>
                <div class="info-item">
                    <strong>Node Version:</strong> ${report.metadata.nodeVersion}
                </div>
                <div class="info-item">
                    <strong>Platform:</strong> ${report.metadata.platform}
                </div>
                ${report.metadata.cpuInfo ? `
                <div class="info-item">
                    <strong>CPU:</strong> ${report.metadata.cpuInfo.model} (${report.metadata.cpuInfo.cores} cores)
                </div>
                ` : ''}
            </div>
        </section>
    </div>

    <script>
        // Initialize dashboard
        document.addEventListener('DOMContentLoaded', function() {
            initializeDashboard(${JSON.stringify({ report, historicalData, config: this.config })});
        });

        // Auto-refresh functionality
        ${this.config.refreshInterval ? `
        setInterval(function() {
            if (document.hidden) return;

            fetch('latest-performance-report.json')
                .then(response => response.json())
                .then(data => {
                    if (data.timestamp > ${report.timestamp}) {
                        location.reload();
                    }
                })
                .catch(error => console.log('Auto-refresh check failed:', error));
        }, ${this.config.refreshInterval * 1000});
        ` : ''}
    </script>
</body>
</html>`;
  }

  /**
   * Generate charts section HTML
   */
  private generateChartsSection(report: PerformanceReport, historicalData: HistoricalData): string {
    return `
        <section class="performance-charts">
            <h2>Performance Charts</h2>
            <div class="chart-grid">
                <div class="chart-container">
                    <h3>Render Time Distribution</h3>
                    <canvas id="renderTimeChart"></canvas>
                </div>
                <div class="chart-container">
                    <h3>Memory Usage</h3>
                    <canvas id="memoryChart"></canvas>
                </div>
                ${Object.keys(historicalData.trends).length > 0 ? `
                <div class="chart-container chart-wide">
                    <h3>Performance Trends</h3>
                    <canvas id="trendsChart"></canvas>
                </div>
                ` : ''}
            </div>
        </section>`;
  }

  /**
   * Generate benchmark card HTML
   */
  private generateBenchmarkCard(benchmark: PerformanceMeasurement): string {
    const statusClass = !benchmark.passed ? 'failed' : benchmark.warning ? 'warning' : 'passed';
    const statusIcon = !benchmark.passed ? '❌' : benchmark.warning ? '⚠️' : '✅';

    return `
        <div class="benchmark-card ${statusClass}">
            <div class="benchmark-header">
                <h3>${benchmark.name}</h3>
                <span class="status-icon">${statusIcon}</span>
            </div>
            <div class="benchmark-metrics">
                <div class="metric">
                    <span class="metric-label">Duration</span>
                    <span class="metric-value">${benchmark.duration.toFixed(2)}ms</span>
                    <span class="metric-threshold">(threshold: ${benchmark.metadata?.threshold}ms)</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Memory</span>
                    <span class="metric-value">${benchmark.memory.toFixed(2)}MB</span>
                    <span class="metric-threshold">(threshold: ${benchmark.metadata?.memoryThreshold}MB)</span>
                </div>
                <div class="metric">
                    <span class="metric-label">P95</span>
                    <span class="metric-value">${benchmark.statistics.p95.toFixed(2)}ms</span>
                </div>
            </div>
            ${benchmark.metadata?.description ? `
            <div class="benchmark-description">
                ${benchmark.metadata.description}
            </div>
            ` : ''}
        </div>`;
  }

  /**
   * Generate regressions section HTML
   */
  private generateRegressionsSection(regressions: Array<{ benchmark: string; analysis: RegressionAnalysis }>): string {
    const severityColors = {
      low: '#fbbf24',
      medium: '#f59e0b',
      high: '#dc2626',
      critical: '#7f1d1d',
      none: '#10b981'
    };

    return `
        <section class="regressions">
            <h2>Performance Regressions</h2>
            <div class="regression-list">
                ${regressions.map(({ benchmark, analysis }) => `
                <div class="regression-item severity-${analysis.severityLevel}">
                    <div class="regression-header">
                        <h3>${benchmark}</h3>
                        <span class="severity-badge" style="background-color: ${severityColors[analysis.severityLevel]}">
                            ${analysis.severityLevel.toUpperCase()}
                        </span>
                    </div>
                    <div class="regression-details">
                        <div class="performance-change">
                            <strong>${analysis.performanceChange.toFixed(1)}%</strong> slower
                            (${analysis.baselineMean.toFixed(2)}ms → ${analysis.currentMean.toFixed(2)}ms)
                        </div>
                        <div class="confidence">
                            Confidence: ${analysis.confidenceLevel.toFixed(1)}%
                        </div>
                        <div class="recommendation">
                            ${analysis.recommendation}
                        </div>
                    </div>
                </div>
                `).join('')}
            </div>
        </section>`;
  }

  /**
   * Generate history section HTML
   */
  private generateHistorySection(historicalData: HistoricalData): string {
    const recentReports = historicalData.reports.slice(-10).reverse();

    return `
        <section class="history">
            <h2>Performance History</h2>
            <div class="history-table">
                <table>
                    <thead>
                        <tr>
                            <th>Timestamp</th>
                            <th>Total Tests</th>
                            <th>Passed</th>
                            <th>Failed</th>
                            <th>Avg Performance</th>
                            <th>Regressions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${recentReports.map(report => `
                        <tr>
                            <td>${new Date(report.timestamp).toLocaleString()}</td>
                            <td>${report.summary.totalBenchmarks}</td>
                            <td class="success">${report.summary.passedBenchmarks}</td>
                            <td class="error">${report.summary.failedBenchmarks}</td>
                            <td>${report.summary.averagePerformance.toFixed(1)}ms</td>
                            <td class="${report.summary.regressionCount > 0 ? 'error' : 'success'}">
                                ${report.summary.regressionCount}
                            </td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </section>`;
  }

  /**
   * Generate CSS and JavaScript assets
   */
  private async generateAssets(): Promise<void> {
    // Generate CSS
    const css = `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: #f8fafc;
            color: #1e293b;
            line-height: 1.6;
        }

        .dashboard-container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        .dashboard-header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .dashboard-header h1 {
            color: #1e40af;
            margin-bottom: 10px;
        }

        .last-updated {
            margin-top: 15px;
            color: #64748b;
        }

        .timestamp {
            font-weight: bold;
            color: #059669;
        }

        .summary-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            border-left: 4px solid #10b981;
        }

        .card-success { border-left-color: #10b981; }
        .card-warning { border-left-color: #f59e0b; }
        .card-error { border-left-color: #dc2626; }

        .card h3 {
            margin-bottom: 10px;
            color: #374151;
        }

        .metric-value {
            font-size: 2em;
            font-weight: bold;
            color: #1f2937;
        }

        .metric-label {
            color: #6b7280;
            margin-top: 5px;
        }

        .metric-breakdown {
            margin-top: 10px;
            font-size: 0.9em;
        }

        .metric-breakdown span {
            margin-right: 15px;
        }

        .success { color: #059669; }
        .warning { color: #d97706; }
        .error { color: #dc2626; }

        .performance-charts, .benchmark-results, .recommendations, .history, .system-info {
            margin-bottom: 30px;
        }

        .performance-charts h2, .benchmark-results h2, .recommendations h2, .history h2, .system-info h2 {
            margin-bottom: 20px;
            color: #1e40af;
        }

        .chart-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 20px;
        }

        .chart-container {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .chart-wide {
            grid-column: 1 / -1;
        }

        .chart-container h3 {
            margin-bottom: 15px;
            color: #374151;
        }

        .benchmark-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
        }

        .benchmark-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            border-left: 4px solid #10b981;
        }

        .benchmark-card.warning { border-left-color: #f59e0b; }
        .benchmark-card.failed { border-left-color: #dc2626; }

        .benchmark-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }

        .benchmark-header h3 {
            color: #374151;
        }

        .status-icon {
            font-size: 1.2em;
        }

        .benchmark-metrics {
            margin-bottom: 15px;
        }

        .metric {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }

        .metric-threshold {
            font-size: 0.8em;
            color: #6b7280;
        }

        .benchmark-description {
            font-size: 0.9em;
            color: #6b7280;
            font-style: italic;
        }

        .recommendation-list {
            list-style: none;
        }

        .recommendation-item {
            background: white;
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            border-left: 4px solid #3b82f6;
        }

        .regression-list {
            background: white;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }

        .regression-item {
            padding: 20px;
            border-bottom: 1px solid #e5e7eb;
        }

        .regression-item:last-child {
            border-bottom: none;
        }

        .regression-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }

        .severity-badge {
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            font-weight: bold;
        }

        .regression-details {
            color: #4b5563;
        }

        .performance-change {
            font-size: 1.1em;
            margin-bottom: 10px;
        }

        .performance-change strong {
            color: #dc2626;
        }

        .confidence {
            margin-bottom: 10px;
            font-size: 0.9em;
        }

        .recommendation {
            font-style: italic;
            color: #6b7280;
        }

        .history-table {
            background: white;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }

        .history-table table {
            width: 100%;
            border-collapse: collapse;
        }

        .history-table th {
            background: #f8fafc;
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e5e7eb;
            font-weight: 600;
            color: #374151;
        }

        .history-table td {
            padding: 12px;
            border-bottom: 1px solid #e5e7eb;
        }

        .history-table tr:last-child td {
            border-bottom: none;
        }

        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .info-item {
            color: #4b5563;
        }

        .info-item strong {
            color: #1f2937;
        }

        @media (max-width: 768px) {
            .dashboard-container {
                padding: 10px;
            }

            .chart-grid {
                grid-template-columns: 1fr;
            }

            .chart-wide {
                grid-column: 1;
            }

            .benchmark-grid {
                grid-template-columns: 1fr;
            }
        }
    `;

    // Generate JavaScript
    const js = `
        function initializeDashboard(data) {
            const { report, historicalData, config } = data;

            if (config.includeCharts) {
                initializeCharts(report, historicalData);
            }

            // Add interactive features
            addInteractivity();
        }

        function initializeCharts(report, historicalData) {
            // Render Time Distribution Chart
            const renderTimeCtx = document.getElementById('renderTimeChart');
            if (renderTimeCtx) {
                new Chart(renderTimeCtx, {
                    type: 'bar',
                    data: {
                        labels: report.benchmarks.map(b => b.name.replace(/.*-/, '')),
                        datasets: [{
                            label: 'Render Time (ms)',
                            data: report.benchmarks.map(b => b.duration),
                            backgroundColor: report.benchmarks.map(b =>
                                !b.passed ? '#dc2626' : b.warning ? '#f59e0b' : '#10b981'
                            ),
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        scales: {
                            y: {
                                beginAtZero: true,
                                title: {
                                    display: true,
                                    text: 'Time (ms)'
                                }
                            }
                        }
                    }
                });
            }

            // Memory Usage Chart
            const memoryCtx = document.getElementById('memoryChart');
            if (memoryCtx) {
                new Chart(memoryCtx, {
                    type: 'doughnut',
                    data: {
                        labels: report.benchmarks.map(b => b.name.replace(/.*-/, '')),
                        datasets: [{
                            data: report.benchmarks.map(b => b.memory),
                            backgroundColor: [
                                '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
                                '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'
                            ]
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: {
                                position: 'bottom'
                            }
                        }
                    }
                });
            }

            // Trends Chart
            const trendsCtx = document.getElementById('trendsChart');
            if (trendsCtx && Object.keys(historicalData.trends).length > 0) {
                const datasets = Object.entries(historicalData.trends).map(([name, trend], index) => ({
                    label: name.replace(/.*-/, ''),
                    data: trend.timestamps.map((timestamp, i) => ({
                        x: new Date(timestamp),
                        y: trend.durations[i]
                    })),
                    borderColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5],
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5] + '20',
                    fill: false,
                    tension: 0.1
                }));

                new Chart(trendsCtx, {
                    type: 'line',
                    data: { datasets },
                    options: {
                        responsive: true,
                        scales: {
                            x: {
                                type: 'time',
                                title: {
                                    display: true,
                                    text: 'Time'
                                }
                            },
                            y: {
                                beginAtZero: true,
                                title: {
                                    display: true,
                                    text: 'Duration (ms)'
                                }
                            }
                        }
                    }
                });
            }
        }

        function addInteractivity() {
            // Add click handlers for benchmark cards
            document.querySelectorAll('.benchmark-card').forEach(card => {
                card.addEventListener('click', function() {
                    this.classList.toggle('expanded');
                });
            });

            // Add copy functionality for system info
            document.querySelectorAll('.info-item').forEach(item => {
                item.addEventListener('click', function() {
                    navigator.clipboard.writeText(this.textContent);
                    this.style.backgroundColor = '#dcfce7';
                    setTimeout(() => {
                        this.style.backgroundColor = '';
                    }, 1000);
                });
            });
        }
    `;

    // Save assets
    await fs.writeFile(path.join(this.dashboardPath, 'dashboard.css'), css);
    await fs.writeFile(path.join(this.dashboardPath, 'dashboard.js'), js);
  }

  /**
   * Load historical performance data
   */
  private async loadHistoricalData(): Promise<HistoricalData> {
    try {
      const dataFile = path.join(this.reportPath, 'historical-data.json');
      const data = await fs.readFile(dataFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return { reports: [], trends: {} };
    }
  }

  /**
   * Update historical data with new report
   */
  private updateHistoricalData(historicalData: HistoricalData, newReport: PerformanceReport): void {
    // Add new report
    historicalData.reports.push(newReport);

    // Limit history size
    if (historicalData.reports.length > this.config.maxHistoryEntries) {
      historicalData.reports = historicalData.reports.slice(-this.config.maxHistoryEntries);
    }

    // Update trends
    newReport.benchmarks.forEach(benchmark => {
      if (!historicalData.trends[benchmark.name]) {
        historicalData.trends[benchmark.name] = {
          timestamps: [],
          durations: [],
          memoryUsage: [],
          trend: 'stable',
          changeRate: 0,
        };
      }

      const trend = historicalData.trends[benchmark.name];
      trend.timestamps.push(newReport.timestamp);
      trend.durations.push(benchmark.duration);
      trend.memoryUsage.push(benchmark.memory);

      // Calculate trend direction
      if (trend.durations.length >= 5) {
        const recent = trend.durations.slice(-5);
        const older = trend.durations.slice(-10, -5);

        if (older.length >= 5) {
          const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
          const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
          const change = (recentAvg - olderAvg) / olderAvg;

          if (change > 0.1) trend.trend = 'degrading';
          else if (change < -0.1) trend.trend = 'improving';
          else trend.trend = 'stable';

          trend.changeRate = change * 100; // percentage
        }
      }

      // Limit trend data
      const maxTrendPoints = 50;
      if (trend.timestamps.length > maxTrendPoints) {
        trend.timestamps = trend.timestamps.slice(-maxTrendPoints);
        trend.durations = trend.durations.slice(-maxTrendPoints);
        trend.memoryUsage = trend.memoryUsage.slice(-maxTrendPoints);
      }
    });
  }

  /**
   * Save historical data
   */
  private async saveHistoricalData(historicalData: HistoricalData): Promise<void> {
    try {
      const dataFile = path.join(this.reportPath, 'historical-data.json');
      await fs.writeFile(dataFile, JSON.stringify(historicalData, null, 2));
    } catch (error) {
      console.error('Failed to save historical data:', error);
    }
  }
}