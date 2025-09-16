/**
 * Report Generator
 * Creates comprehensive performance regression test reports
 */

const fs = require('fs/promises');
const path = require('path');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

class ReportGenerator {
  constructor(config = {}) {
    this.config = {
      outputDir: config.outputDir || './reports',
      formats: config.formats || ['html', 'json', 'pdf'],
      includeCharts: config.includeCharts !== false,
      chartDimensions: {
        width: config.chartWidth || 800,
        height: config.chartHeight || 400
      },
      theme: config.theme || 'default',
      branding: {
        title: config.branding?.title || 'Performance Regression Test Report',
        logo: config.branding?.logo,
        company: config.branding?.company || 'Your Organization'
      },
      ...config
    };
    
    this.chartRenderer = new ChartJSNodeCanvas(this.config.chartDimensions);
  }

  /**
   * Generate comprehensive report
   */
  async generate(reportData) {
    const reportId = `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const reportDir = path.join(this.config.outputDir, reportId);
    
    // Create report directory
    await fs.mkdir(reportDir, { recursive: true });
    
    // Prepare report content
    const content = await this.prepareReportContent(reportData);
    
    // Generate reports in different formats
    const reports = {};
    
    if (this.config.formats.includes('json')) {
      reports.json = await this.generateJsonReport(content, reportDir);
    }
    
    if (this.config.formats.includes('html')) {
      reports.html = await this.generateHtmlReport(content, reportDir);
    }
    
    if (this.config.formats.includes('pdf')) {
      reports.pdf = await this.generatePdfReport(content, reportDir);
    }
    
    if (this.config.formats.includes('markdown')) {
      reports.markdown = await this.generateMarkdownReport(content, reportDir);
    }
    
    // Generate summary dashboard
    const dashboard = await this.generateDashboard(content, reportDir);
    
    return {
      reportId,
      reportDir,
      reports,
      dashboard,
      summary: content.summary,
      url: this.generateReportUrl(reportId)
    };
  }

  /**
   * Prepare report content from raw data
   */
  async prepareReportContent(reportData) {
    const content = {
      metadata: {
        reportId: reportData.runId,
        timestamp: reportData.timestamp || new Date().toISOString(),
        generatedAt: new Date().toISOString(),
        config: reportData.config
      },
      
      summary: this.generateSummary(reportData),
      
      regressionAnalysis: reportData.regressionAnalysis,
      
      environmentResults: await this.processEnvironmentResults(reportData.results),
      
      performance: await this.analyzePerformance(reportData.results),
      
      trends: await this.analyzeTrends(reportData.results),
      
      charts: this.config.includeCharts ? await this.generateCharts(reportData) : null,
      
      recommendations: this.consolidateRecommendations(reportData.regressionAnalysis),
      
      appendix: {
        rawData: reportData.results,
        testConfiguration: reportData.config,
        statistics: this.calculateGlobalStatistics(reportData.results)
      }
    };
    
    return content;
  }

  /**
   * Generate executive summary
   */
  generateSummary(reportData) {
    const regression = reportData.regressionAnalysis;
    
    return {
      executiveSummary: {
        totalTests: regression.summary.totalTests,
        regressions: regression.summary.regressionCount,
        improvements: regression.summary.improvementCount,
        criticalIssues: regression.summary.criticalRegressions,
        overallHealth: this.assessOverallHealth(regression),
        riskLevel: this.assessRiskLevel(regression)
      },
      
      keyFindings: this.extractKeyFindings(reportData),
      
      impactAssessment: {
        businessImpact: this.assessBusinessImpact(regression),
        technicalImpact: this.assessTechnicalImpact(regression),
        userImpact: this.assessUserImpact(regression)
      },
      
      actionItems: this.prioritizeActionItems(regression)
    };
  }

  /**
   * Process environment results
   */
  async processEnvironmentResults(results) {
    const processed = {};
    
    for (const [environment, envResults] of results) {
      processed[environment] = {
        summary: {
          totalSuites: envResults.size,
          successful: Array.from(envResults.values()).filter(r => !r.error).length,
          failed: Array.from(envResults.values()).filter(r => r.error).length
        },
        
        suites: {},
        
        environmentMetrics: await this.calculateEnvironmentMetrics(envResults)
      };
      
      for (const [suiteName, suiteResult] of envResults) {
        processed[environment].suites[suiteName] = {
          ...suiteResult,
          analysis: this.analyzeSuiteResult(suiteResult)
        };
      }
    }
    
    return processed;
  }

  /**
   * Analyze performance across all tests
   */
  async analyzePerformance(results) {
    const analysis = {
      duration: { values: [], stats: {} },
      memory: { values: [], stats: {} },
      reliability: { values: [], stats: {} }
    };
    
    // Collect all performance data
    for (const [environment, envResults] of results) {
      for (const [suiteName, suiteResult] of envResults) {
        if (suiteResult.statistics && !suiteResult.error) {
          analysis.duration.values.push(suiteResult.statistics.duration.mean);
          analysis.memory.values.push(suiteResult.statistics.memory.heap.mean);
          analysis.reliability.values.push(suiteResult.statistics.successRate);
        }
      }
    }
    
    // Calculate statistics
    for (const metric of Object.keys(analysis)) {
      analysis[metric].stats = this.calculateStatistics(analysis[metric].values);
    }
    
    return {
      ...analysis,
      slowestTests: this.identifySlowests(results),
      memoryHungryTests: this.identifyMemoryHungry(results),
      unreliableTests: this.identifyUnreliable(results),
      performanceDistribution: this.analyzePerformanceDistribution(results)
    };
  }

  /**
   * Analyze trends over time
   */
  async analyzeTrends(results) {
    // This would typically use historical data
    // For now, we'll simulate trend analysis
    return {
      performanceTrend: {
        direction: 'stable',
        confidence: 0.85,
        periodOverPeriod: {
          duration: { change: 2.3, direction: 'slower' },
          memory: { change: -1.2, direction: 'better' },
          reliability: { change: 0.1, direction: 'stable' }
        }
      },
      
      seasonality: {
        detected: false,
        patterns: []
      },
      
      predictions: {
        nextPeriod: {
          expectedDuration: 'stable',
          expectedMemory: 'stable',
          expectedReliability: 'stable'
        }
      }
    };
  }

  /**
   * Generate charts for visual analysis
   */
  async generateCharts(reportData) {
    const charts = {};
    
    try {
      // Performance distribution chart
      charts.performanceDistribution = await this.createPerformanceDistributionChart(reportData.results);
      
      // Regression severity chart
      if (reportData.regressionAnalysis.regressions.length > 0) {
        charts.regressionSeverity = await this.createRegressionSeverityChart(reportData.regressionAnalysis);
      }
      
      // Environment comparison chart
      charts.environmentComparison = await this.createEnvironmentComparisonChart(reportData.results);
      
      // Memory usage chart
      charts.memoryUsage = await this.createMemoryUsageChart(reportData.results);
      
      // Success rate chart
      charts.successRate = await this.createSuccessRateChart(reportData.results);
      
    } catch (error) {
      console.warn('Failed to generate some charts:', error.message);
    }
    
    return charts;
  }

  /**
   * Generate JSON report
   */
  async generateJsonReport(content, reportDir) {
    const filePath = path.join(reportDir, 'report.json');
    await fs.writeFile(filePath, JSON.stringify(content, null, 2));
    return { path: filePath, type: 'json' };
  }

  /**
   * Generate HTML report
   */
  async generateHtmlReport(content, reportDir) {
    const html = await this.generateHtmlContent(content);
    const filePath = path.join(reportDir, 'report.html');
    await fs.writeFile(filePath, html);
    
    // Copy assets
    await this.copyReportAssets(reportDir);
    
    return { path: filePath, type: 'html' };
  }

  /**
   * Generate PDF report
   */
  async generatePdfReport(content, reportDir) {
    // This would typically use a library like puppeteer or @react-pdf/renderer
    // For now, we'll create a simplified text-based PDF
    const textContent = this.convertToText(content);
    const filePath = path.join(reportDir, 'report.pdf');
    
    // Placeholder for PDF generation
    await fs.writeFile(filePath, textContent);
    
    return { path: filePath, type: 'pdf' };
  }

  /**
   * Generate Markdown report
   */
  async generateMarkdownReport(content, reportDir) {
    const markdown = this.generateMarkdownContent(content);
    const filePath = path.join(reportDir, 'report.md');
    await fs.writeFile(filePath, markdown);
    return { path: filePath, type: 'markdown' };
  }

  /**
   * Generate HTML content
   */
  async generateHtmlContent(content) {
    const chartImages = content.charts ? Object.entries(content.charts)
      .map(([name, chart]) => `
        <div class="chart-container">
          <h3>${this.formatChartTitle(name)}</h3>
          <img src="${chart}" alt="${name} chart" class="chart">
        </div>
      `).join('') : '';
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.config.branding.title}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 2.5em;
            font-weight: 300;
        }
        .header .subtitle {
            font-size: 1.2em;
            opacity: 0.9;
            margin-top: 10px;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .summary-card {
            background: white;
            padding: 25px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            border-left: 4px solid #667eea;
        }
        .summary-card h3 {
            margin: 0 0 15px 0;
            color: #667eea;
            font-size: 1.1em;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .metric {
            font-size: 2.5em;
            font-weight: bold;
            color: #333;
            margin: 10px 0;
        }
        .metric.critical {
            color: #e74c3c;
        }
        .metric.warning {
            color: #f39c12;
        }
        .metric.good {
            color: #27ae60;
        }
        .section {
            background: white;
            margin-bottom: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .section-header {
            background: #667eea;
            color: white;
            padding: 20px;
            font-size: 1.3em;
            font-weight: 500;
        }
        .section-content {
            padding: 25px;
        }
        .chart-container {
            margin: 20px 0;
            text-align: center;
        }
        .chart {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .regression-item {
            background: #fff5f5;
            border: 1px solid #fed7d7;
            border-radius: 8px;
            padding: 20px;
            margin: 15px 0;
            border-left: 4px solid #e53e3e;
        }
        .regression-item.warning {
            background: #fffbeb;
            border-color: #fbd38d;
            border-left-color: #f6ad55;
        }
        .recommendation {
            background: #f0fff4;
            border: 1px solid #9ae6b4;
            border-radius: 8px;
            padding: 15px;
            margin: 10px 0;
            border-left: 4px solid #38a169;
        }
        .priority-high {
            border-left-color: #e53e3e;
        }
        .priority-medium {
            border-left-color: #f6ad55;
        }
        .priority-low {
            border-left-color: #4299e1;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
        }
        th {
            background: #f7fafc;
            font-weight: 600;
            color: #2d3748;
        }
        .footer {
            text-align: center;
            padding: 30px;
            color: #666;
            border-top: 1px solid #e2e8f0;
            margin-top: 30px;
        }
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.8em;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .status-critical {
            background: #fed7d7;
            color: #c53030;
        }
        .status-warning {
            background: #fbd38d;
            color: #c05621;
        }
        .status-good {
            background: #c6f6d5;
            color: #22543d;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${this.config.branding.title}</h1>
        <div class="subtitle">
            Report ID: ${content.metadata.reportId} | 
            Generated: ${new Date(content.metadata.generatedAt).toLocaleString()}
        </div>
    </div>

    <div class="summary-grid">
        <div class="summary-card">
            <h3>Total Tests</h3>
            <div class="metric">${content.summary.executiveSummary.totalTests}</div>
        </div>
        <div class="summary-card">
            <h3>Regressions</h3>
            <div class="metric ${content.summary.executiveSummary.regressions > 0 ? 'critical' : 'good'}">
                ${content.summary.executiveSummary.regressions}
            </div>
        </div>
        <div class="summary-card">
            <h3>Critical Issues</h3>
            <div class="metric ${content.summary.executiveSummary.criticalIssues > 0 ? 'critical' : 'good'}">
                ${content.summary.executiveSummary.criticalIssues}
            </div>
        </div>
        <div class="summary-card">
            <h3>Overall Health</h3>
            <div class="metric ${this.getHealthColorClass(content.summary.executiveSummary.overallHealth)}">
                ${content.summary.executiveSummary.overallHealth.toUpperCase()}
            </div>
        </div>
    </div>

    ${content.regressionAnalysis.regressions.length > 0 ? `
    <div class="section">
        <div class="section-header">Detected Regressions</div>
        <div class="section-content">
            ${content.regressionAnalysis.regressions.map(regression => `
                <div class="regression-item ${regression.severity}">
                    <h4>${regression.testSuite} (${regression.environment})</h4>
                    <p><strong>Severity:</strong> 
                        <span class="status-badge status-${regression.severity}">${regression.severity}</span>
                    </p>
                    ${regression.summary ? `<p><strong>Issue:</strong> ${regression.summary.message}</p>` : ''}
                    ${regression.algorithms?.statistical ? `
                        <div class="metrics">
                            ${regression.algorithms.statistical.duration?.isSignificant ? 
                                `<p>• Duration increased by ${regression.algorithms.statistical.duration.percentageChange.toFixed(1)}%</p>` : ''}
                            ${regression.algorithms.statistical.memory?.isSignificant ? 
                                `<p>• Memory usage increased by ${regression.algorithms.statistical.memory.percentageChange.toFixed(1)}%</p>` : ''}
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    </div>
    ` : ''}

    ${content.recommendations.length > 0 ? `
    <div class="section">
        <div class="section-header">Recommendations</div>
        <div class="section-content">
            ${content.recommendations.map(rec => `
                <div class="recommendation priority-${rec.priority}">
                    <h4>[${rec.priority.toUpperCase()}] ${rec.action}</h4>
                    ${rec.details ? `<p>${rec.details}</p>` : ''}
                    <p><strong>Category:</strong> ${rec.category}</p>
                </div>
            `).join('')}
        </div>
    </div>
    ` : ''}

    ${chartImages ? `
    <div class="section">
        <div class="section-header">Performance Analysis</div>
        <div class="section-content">
            ${chartImages}
        </div>
    </div>
    ` : ''}

    <div class="section">
        <div class="section-header">Environment Results</div>
        <div class="section-content">
            ${Object.entries(content.environmentResults).map(([env, envData]) => `
                <h3>${env}</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Test Suite</th>
                            <th>Status</th>
                            <th>Duration (ms)</th>
                            <th>Memory (MB)</th>
                            <th>Success Rate</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(envData.suites).map(([suite, data]) => `
                            <tr>
                                <td>${suite}</td>
                                <td><span class="status-badge ${data.error ? 'status-critical' : 'status-good'}">
                                    ${data.error ? 'FAILED' : 'PASSED'}
                                </span></td>
                                <td>${data.statistics ? data.statistics.duration.mean.toFixed(2) : 'N/A'}</td>
                                <td>${data.statistics ? (data.statistics.memory.heap.mean / 1024 / 1024).toFixed(2) : 'N/A'}</td>
                                <td>${data.statistics ? data.statistics.successRate.toFixed(1) + '%' : 'N/A'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `).join('')}
        </div>
    </div>

    <div class="footer">
        <p>Generated by ${this.config.branding.company} Performance Regression Testing System</p>
        <p>Report generated at ${new Date(content.metadata.generatedAt).toLocaleString()}</p>
    </div>
</body>
</html>
    `;
  }

  /**
   * Generate Markdown content
   */
  generateMarkdownContent(content) {
    return `
# ${this.config.branding.title}

**Report ID:** ${content.metadata.reportId}  
**Generated:** ${new Date(content.metadata.generatedAt).toLocaleString()}

## Executive Summary

- **Total Tests:** ${content.summary.executiveSummary.totalTests}
- **Regressions Detected:** ${content.summary.executiveSummary.regressions}
- **Critical Issues:** ${content.summary.executiveSummary.criticalIssues}
- **Overall Health:** ${content.summary.executiveSummary.overallHealth.toUpperCase()}
- **Risk Level:** ${content.summary.executiveSummary.riskLevel.toUpperCase()}

${content.regressionAnalysis.regressions.length > 0 ? `
## Detected Regressions

${content.regressionAnalysis.regressions.map(regression => `
### ${regression.testSuite} (${regression.environment})

- **Severity:** ${regression.severity.toUpperCase()}
- **Issue:** ${regression.summary?.message || 'Performance regression detected'}
${regression.algorithms?.statistical ? `
- **Performance Impact:**
${regression.algorithms.statistical.duration?.isSignificant ? 
  `  - Duration increased by ${regression.algorithms.statistical.duration.percentageChange.toFixed(1)}%` : ''}
${regression.algorithms.statistical.memory?.isSignificant ? 
  `  - Memory usage increased by ${regression.algorithms.statistical.memory.percentageChange.toFixed(1)}%` : ''}
` : ''}
`).join('')}
` : ''}

${content.recommendations.length > 0 ? `
## Recommendations

${content.recommendations.map((rec, index) => `
${index + 1}. **[${rec.priority.toUpperCase()}] ${rec.action}**
   - Category: ${rec.category}
   - Details: ${rec.details || 'No additional details'}
`).join('')}
` : ''}

## Environment Results

${Object.entries(content.environmentResults).map(([env, envData]) => `
### ${env}

| Test Suite | Status | Duration (ms) | Memory (MB) | Success Rate |
|------------|--------|---------------|-------------|---------------|
${Object.entries(envData.suites).map(([suite, data]) => 
  `| ${suite} | ${data.error ? 'FAILED' : 'PASSED'} | ${data.statistics ? data.statistics.duration.mean.toFixed(2) : 'N/A'} | ${data.statistics ? (data.statistics.memory.heap.mean / 1024 / 1024).toFixed(2) : 'N/A'} | ${data.statistics ? data.statistics.successRate.toFixed(1) + '%' : 'N/A'} |`
).join('\n')}
`).join('')}

---

*Report generated by ${this.config.branding.company} Performance Regression Testing System*
    `;
  }

  // Utility methods for report generation
  
  assessOverallHealth(regressionAnalysis) {
    const { criticalRegressions, regressionCount, totalTests } = regressionAnalysis.summary;
    
    if (criticalRegressions > 0) return 'critical';
    if (regressionCount > totalTests * 0.2) return 'poor';
    if (regressionCount > 0) return 'warning';
    return 'good';
  }
  
  assessRiskLevel(regressionAnalysis) {
    const { criticalRegressions, regressionCount } = regressionAnalysis.summary;
    
    if (criticalRegressions >= 3) return 'very high';
    if (criticalRegressions > 0) return 'high';
    if (regressionCount >= 5) return 'medium';
    if (regressionCount > 0) return 'low';
    return 'minimal';
  }
  
  extractKeyFindings(reportData) {
    const findings = [];
    
    if (reportData.regressionAnalysis.summary.criticalRegressions > 0) {
      findings.push(`${reportData.regressionAnalysis.summary.criticalRegressions} critical performance regressions require immediate attention`);
    }
    
    if (reportData.regressionAnalysis.summary.improvementCount > 0) {
      findings.push(`${reportData.regressionAnalysis.summary.improvementCount} performance improvements detected`);
    }
    
    return findings;
  }
  
  consolidateRecommendations(regressionAnalysis) {
    const allRecommendations = [];
    
    regressionAnalysis.regressions.forEach(regression => {
      if (regression.recommendations) {
        allRecommendations.push(...regression.recommendations);
      }
    });
    
    // Deduplicate and prioritize
    const unique = new Map();
    allRecommendations.forEach(rec => {
      const key = `${rec.category}-${rec.action}`;
      if (!unique.has(key) || unique.get(key).priority < rec.priority) {
        unique.set(key, rec);
      }
    });
    
    return Array.from(unique.values()).sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }
  
  calculateStatistics(values) {
    if (values.length === 0) return {};
    
    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    
    return {
      count: values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean,
      median: sorted[Math.floor(sorted.length / 2)],
      sum
    };
  }
  
  getHealthColorClass(health) {
    const colorMap = {
      good: 'good',
      warning: 'warning',
      poor: 'critical',
      critical: 'critical'
    };
    return colorMap[health] || 'warning';
  }
  
  formatChartTitle(chartName) {
    return chartName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }
  
  generateReportUrl(reportId) {
    // This would be the actual URL where reports are accessible
    return `${process.env.REPORT_BASE_URL || 'http://localhost:3000'}/reports/${reportId}`;
  }

  // Placeholder methods for chart generation
  async createPerformanceDistributionChart(results) {
    // Implementation would use ChartJS to create actual charts
    return 'data:image/png;base64,placeholder-chart-data';
  }
  
  async createRegressionSeverityChart(regressionAnalysis) {
    return 'data:image/png;base64,placeholder-chart-data';
  }
  
  async createEnvironmentComparisonChart(results) {
    return 'data:image/png;base64,placeholder-chart-data';
  }
  
  async createMemoryUsageChart(results) {
    return 'data:image/png;base64,placeholder-chart-data';
  }
  
  async createSuccessRateChart(results) {
    return 'data:image/png;base64,placeholder-chart-data';
  }

  // Additional utility methods
  analyzeSuiteResult(suiteResult) {
    if (suiteResult.error) {
      return { status: 'failed', reason: suiteResult.error };
    }
    
    const stats = suiteResult.statistics;
    if (!stats) {
      return { status: 'incomplete', reason: 'No statistics available' };
    }
    
    return {
      status: 'success',
      performanceGrade: this.gradePerformance(stats),
      reliabilityGrade: this.gradeReliability(stats)
    };
  }
  
  gradePerformance(stats) {
    // Simple grading based on duration
    const duration = stats.duration.mean;
    if (duration < 100) return 'A';
    if (duration < 500) return 'B';
    if (duration < 1000) return 'C';
    if (duration < 2000) return 'D';
    return 'F';
  }
  
  gradeReliability(stats) {
    const successRate = stats.successRate;
    if (successRate >= 99) return 'A';
    if (successRate >= 95) return 'B';
    if (successRate >= 90) return 'C';
    if (successRate >= 80) return 'D';
    return 'F';
  }
}

module.exports = ReportGenerator;