/**
 * Memory Analysis Performance Validation Report
 *
 * Comprehensive report generator for memory usage analysis results
 * including validation against target metrics and recommendations.
 */

import { MemoryAnalysisReport, MemorySnapshot, MemoryLeak } from './MemoryAnalyzer';

export interface PerformanceValidationResult {
  passed: boolean;
  score: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  metrics: {
    heapSize: ValidationMetric;
    memoryGrowth: ValidationMetric;
    detachedNodes: ValidationMetric;
    memoryLeaks: ValidationMetric;
    gcEfficiency: ValidationMetric;
    eventListeners: ValidationMetric;
  };
  summary: {
    criticalIssues: number;
    warnings: number;
    recommendations: string[];
    nextSteps: string[];
  };
  compliance: {
    targetMetricsMet: boolean;
    baselineCompliance: boolean;
    growthRateCompliance: boolean;
    leakFreeCompliance: boolean;
  };
}

export interface ValidationMetric {
  name: string;
  target: number;
  actual: number;
  unit: string;
  passed: boolean;
  severity: 'info' | 'warning' | 'error' | 'critical';
  recommendation?: string;
}

export class MemoryAnalysisReportGenerator {
  private readonly targetMetrics = {
    heapSizeBaseline: 50 * 1024 * 1024, // 50MB
    maxMemoryGrowth: 10 * 1024 * 1024, // 10MB per hour
    maxDetachedNodes: 0,
    maxMemoryLeaks: 0,
    minGcEfficiency: 0.90, // 90%
    maxOrphanedListeners: 10
  };

  /**
   * Generate comprehensive memory analysis report
   */
  generateReport(analysisReport: MemoryAnalysisReport): PerformanceValidationResult {
    const metrics = this.validateMetrics(analysisReport);
    const compliance = this.assessCompliance(metrics);
    const summary = this.generateSummary(analysisReport, metrics);
    const score = this.calculateScore(metrics);
    const grade = this.calculateGrade(score);

    return {
      passed: compliance.targetMetricsMet && score >= 70,
      score,
      grade,
      metrics,
      summary,
      compliance
    };
  }

  /**
   * Generate detailed HTML report
   */
  generateHTMLReport(
    analysisReport: MemoryAnalysisReport,
    validationResult: PerformanceValidationResult
  ): string {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Memory Analysis Report - Mainframe KB Assistant</title>
        <style>
            ${this.getReportStyles()}
        </style>
    </head>
    <body>
        <div class="container">
            ${this.generateHeader(validationResult)}
            ${this.generateExecutiveSummary(analysisReport, validationResult)}
            ${this.generateMetricsSection(validationResult)}
            ${this.generateTrendsSection(analysisReport)}
            ${this.generateIssuesSection(analysisReport)}
            ${this.generateOptimizationsSection(analysisReport)}
            ${this.generateComplianceSection(validationResult)}
            ${this.generateRecommendationsSection(validationResult)}
            ${this.generateRawDataSection(analysisReport)}
        </div>

        <script>
            ${this.getReportScripts()}
        </script>
    </body>
    </html>
    `;
  }

  /**
   * Generate markdown report for documentation
   */
  generateMarkdownReport(
    analysisReport: MemoryAnalysisReport,
    validationResult: PerformanceValidationResult
  ): string {
    const timestamp = new Date().toISOString();

    return `# Memory Analysis Report
*Generated: ${timestamp}*

## Executive Summary

**Overall Grade: ${validationResult.grade}** (Score: ${validationResult.score}/100)
**Status: ${validationResult.passed ? '✅ PASSED' : '❌ FAILED'}**

- **Current Heap Usage**: ${this.formatBytes(analysisReport.current.heapUsed)}
- **Memory Growth Rate**: ${this.formatBytes(analysisReport.summary.memoryGrowthRate)}/hour
- **Issues Found**: ${analysisReport.summary.leakCount}
- **Overall Health**: ${analysisReport.summary.overallHealth.toUpperCase()}

## Target Metrics Validation

| Metric | Target | Actual | Status | Severity |
|--------|---------|---------|---------|----------|
${Object.entries(validationResult.metrics).map(([key, metric]) =>
  `| ${metric.name} | ${metric.target} ${metric.unit} | ${metric.actual} ${metric.unit} | ${metric.passed ? '✅' : '❌'} | ${metric.severity.toUpperCase()} |`
).join('\n')}

## Memory Trends

### Heap Growth Over Time
${this.generateTrendText(analysisReport.trends.heapGrowth)}

### Component Memory Usage
${this.generateComponentTrendText(analysisReport.trends.componentCounts)}

## Issues Detected

${analysisReport.issues.length === 0 ?
  '✅ No memory issues detected.' :
  analysisReport.issues.map((issue, index) => `
### ${index + 1}. ${issue.type.charAt(0).toUpperCase() + issue.type.slice(1)} Issue - ${issue.severity.toUpperCase()}

**Source**: ${issue.source}
**Impact**: ${this.formatBytes(issue.memoryDelta)}
**Description**: ${issue.description}
**Suggested Fix**: ${issue.suggestedFix}
`).join('\n')
}

## Optimization Opportunities

${analysisReport.optimizations.length === 0 ?
  '✅ No optimizations needed at this time.' :
  analysisReport.optimizations.map((opt, index) => `
### ${index + 1}. ${opt.description}

- **Type**: ${opt.type}
- **Priority**: ${opt.priority.toUpperCase()}
- **Expected Savings**: ${this.formatBytes(opt.expectedSavings)}
- **Implementation Effort**: ${opt.effort}
- **Implementation**: ${opt.implementation}
`).join('\n')
}

## Compliance Assessment

- **Target Metrics Met**: ${validationResult.compliance.targetMetricsMet ? '✅ Yes' : '❌ No'}
- **Baseline Compliance**: ${validationResult.compliance.baselineCompliance ? '✅ Yes' : '❌ No'}
- **Growth Rate Compliance**: ${validationResult.compliance.growthRateCompliance ? '✅ Yes' : '❌ No'}
- **Leak-Free Compliance**: ${validationResult.compliance.leakFreeCompliance ? '✅ Yes' : '❌ No'}

## Recommendations

${validationResult.summary.recommendations.map((rec, index) =>
  `${index + 1}. ${rec}`
).join('\n')}

## Next Steps

${validationResult.summary.nextSteps.map((step, index) =>
  `${index + 1}. ${step}`
).join('\n')}

## Technical Details

### Current Memory Snapshot
- **Timestamp**: ${analysisReport.current.timestamp.toISOString()}
- **RSS**: ${this.formatBytes(analysisReport.current.rss)}
- **Heap Total**: ${this.formatBytes(analysisReport.current.heapTotal)}
- **Heap Used**: ${this.formatBytes(analysisReport.current.heapUsed)}
- **External**: ${this.formatBytes(analysisReport.current.external)}
- **Array Buffers**: ${this.formatBytes(analysisReport.current.arrayBuffers)}

### DOM Metrics
- **Total Nodes**: ${analysisReport.current.domMetrics.totalNodes}
- **Detached Nodes**: ${analysisReport.current.domMetrics.detachedNodes}
- **Event Listeners**: ${analysisReport.current.domMetrics.eventListeners}
- **Observed Elements**: ${analysisReport.current.domMetrics.observedElements}

### Event Listener Metrics
- **Total**: ${analysisReport.current.eventListenerMetrics.total}
- **Orphaned**: ${analysisReport.current.eventListenerMetrics.orphaned}
- **Duplicates**: ${analysisReport.current.eventListenerMetrics.duplicates}

### GC Metrics
- **Collections**: ${analysisReport.current.gcMetrics.collections}
- **Total Time**: ${analysisReport.current.gcMetrics.totalTime}ms
- **Average Time**: ${analysisReport.current.gcMetrics.averageTime}ms
- **Pressure**: ${analysisReport.current.gcMetrics.pressure.toUpperCase()}
- **Efficiency**: ${(analysisReport.current.gcMetrics.efficiency * 100).toFixed(1)}%

---
*Report generated by Memory Analysis System v2.0*
`;
  }

  /**
   * Generate CSV export for trend analysis
   */
  generateCSVReport(analysisReport: MemoryAnalysisReport): string {
    const headers = [
      'Timestamp',
      'Heap Used (MB)',
      'Heap Total (MB)',
      'RSS (MB)',
      'External (MB)',
      'Array Buffers (MB)',
      'Total DOM Nodes',
      'Detached Nodes',
      'Event Listeners',
      'GC Collections',
      'GC Efficiency',
      'Issues Count'
    ];

    const rows = [headers.join(',')];

    // Add current snapshot data
    const current = analysisReport.current;
    rows.push([
      current.timestamp.toISOString(),
      (current.heapUsed / 1024 / 1024).toFixed(2),
      (current.heapTotal / 1024 / 1024).toFixed(2),
      (current.rss / 1024 / 1024).toFixed(2),
      (current.external / 1024 / 1024).toFixed(2),
      (current.arrayBuffers / 1024 / 1024).toFixed(2),
      current.domMetrics.totalNodes.toString(),
      current.domMetrics.detachedNodes.toString(),
      current.eventListenerMetrics.total.toString(),
      current.gcMetrics.collections.toString(),
      current.gcMetrics.efficiency.toFixed(3),
      current.leakSuspects.length.toString()
    ].join(','));

    return rows.join('\n');
  }

  // Private helper methods

  private validateMetrics(report: MemoryAnalysisReport): PerformanceValidationResult['metrics'] {
    return {
      heapSize: {
        name: 'Heap Size',
        target: this.targetMetrics.heapSizeBaseline,
        actual: report.current.heapUsed,
        unit: 'bytes',
        passed: report.current.heapUsed <= this.targetMetrics.heapSizeBaseline,
        severity: report.current.heapUsed > this.targetMetrics.heapSizeBaseline * 1.5 ? 'critical' :
                 report.current.heapUsed > this.targetMetrics.heapSizeBaseline ? 'warning' : 'info',
        recommendation: report.current.heapUsed > this.targetMetrics.heapSizeBaseline
          ? 'Consider implementing memory optimization strategies'
          : undefined
      },
      memoryGrowth: {
        name: 'Memory Growth Rate',
        target: this.targetMetrics.maxMemoryGrowth,
        actual: report.summary.memoryGrowthRate,
        unit: 'bytes/hour',
        passed: report.summary.memoryGrowthRate <= this.targetMetrics.maxMemoryGrowth,
        severity: report.summary.memoryGrowthRate > this.targetMetrics.maxMemoryGrowth * 2 ? 'critical' :
                 report.summary.memoryGrowthRate > this.targetMetrics.maxMemoryGrowth ? 'error' : 'info',
        recommendation: report.summary.memoryGrowthRate > this.targetMetrics.maxMemoryGrowth
          ? 'Investigate memory leaks and optimize component lifecycle'
          : undefined
      },
      detachedNodes: {
        name: 'Detached DOM Nodes',
        target: this.targetMetrics.maxDetachedNodes,
        actual: report.current.domMetrics.detachedNodes,
        unit: 'nodes',
        passed: report.current.domMetrics.detachedNodes <= this.targetMetrics.maxDetachedNodes,
        severity: report.current.domMetrics.detachedNodes > 100 ? 'critical' :
                 report.current.domMetrics.detachedNodes > 10 ? 'warning' : 'info',
        recommendation: report.current.domMetrics.detachedNodes > 0
          ? 'Review component cleanup and DOM manipulation'
          : undefined
      },
      memoryLeaks: {
        name: 'Memory Leaks',
        target: this.targetMetrics.maxMemoryLeaks,
        actual: report.summary.leakCount,
        unit: 'leaks',
        passed: report.summary.leakCount <= this.targetMetrics.maxMemoryLeaks,
        severity: report.issues.some(i => i.severity === 'critical') ? 'critical' :
                 report.issues.some(i => i.severity === 'high') ? 'error' :
                 report.summary.leakCount > 0 ? 'warning' : 'info',
        recommendation: report.summary.leakCount > 0
          ? 'Address identified memory leaks immediately'
          : undefined
      },
      gcEfficiency: {
        name: 'GC Efficiency',
        target: this.targetMetrics.minGcEfficiency,
        actual: report.current.gcMetrics.efficiency,
        unit: '%',
        passed: report.current.gcMetrics.efficiency >= this.targetMetrics.minGcEfficiency,
        severity: report.current.gcMetrics.efficiency < 0.7 ? 'critical' :
                 report.current.gcMetrics.efficiency < 0.8 ? 'warning' : 'info',
        recommendation: report.current.gcMetrics.efficiency < this.targetMetrics.minGcEfficiency
          ? 'Optimize object allocation patterns and reduce GC pressure'
          : undefined
      },
      eventListeners: {
        name: 'Orphaned Event Listeners',
        target: this.targetMetrics.maxOrphanedListeners,
        actual: report.current.eventListenerMetrics.orphaned,
        unit: 'listeners',
        passed: report.current.eventListenerMetrics.orphaned <= this.targetMetrics.maxOrphanedListeners,
        severity: report.current.eventListenerMetrics.orphaned > 50 ? 'critical' :
                 report.current.eventListenerMetrics.orphaned > 20 ? 'warning' : 'info',
        recommendation: report.current.eventListenerMetrics.orphaned > this.targetMetrics.maxOrphanedListeners
          ? 'Implement proper event listener cleanup in useEffect hooks'
          : undefined
      }
    };
  }

  private assessCompliance(metrics: PerformanceValidationResult['metrics']): PerformanceValidationResult['compliance'] {
    return {
      targetMetricsMet: Object.values(metrics).every(m => m.passed),
      baselineCompliance: metrics.heapSize.passed,
      growthRateCompliance: metrics.memoryGrowth.passed,
      leakFreeCompliance: metrics.memoryLeaks.passed && metrics.detachedNodes.passed
    };
  }

  private generateSummary(
    report: MemoryAnalysisReport,
    metrics: PerformanceValidationResult['metrics']
  ): PerformanceValidationResult['summary'] {
    const criticalIssues = Object.values(metrics).filter(m => m.severity === 'critical').length +
                          report.issues.filter(i => i.severity === 'critical').length;

    const warnings = Object.values(metrics).filter(m => m.severity === 'warning').length +
                    report.issues.filter(i => i.severity === 'high' || i.severity === 'medium').length;

    const recommendations = [
      ...report.summary.recommendations,
      ...Object.values(metrics)
        .filter(m => m.recommendation)
        .map(m => m.recommendation!)
    ];

    const nextSteps = [];

    if (criticalIssues > 0) {
      nextSteps.push('Address critical memory issues immediately');
    }

    if (warnings > 0) {
      nextSteps.push('Plan optimization tasks for identified warnings');
    }

    if (!metrics.heapSize.passed) {
      nextSteps.push('Implement memory optimization strategies');
    }

    if (!metrics.memoryGrowth.passed) {
      nextSteps.push('Investigate and fix memory growth patterns');
    }

    if (nextSteps.length === 0) {
      nextSteps.push('Continue monitoring and maintain current performance');
    }

    return {
      criticalIssues,
      warnings,
      recommendations: [...new Set(recommendations)], // Remove duplicates
      nextSteps
    };
  }

  private calculateScore(metrics: PerformanceValidationResult['metrics']): number {
    const weights = {
      heapSize: 20,
      memoryGrowth: 25,
      detachedNodes: 15,
      memoryLeaks: 25,
      gcEfficiency: 10,
      eventListeners: 5
    };

    let totalScore = 0;
    let totalWeight = 0;

    Object.entries(metrics).forEach(([key, metric]) => {
      const weight = weights[key as keyof typeof weights];
      let score = 0;

      if (metric.passed) {
        score = 100;
      } else {
        switch (metric.severity) {
          case 'info': score = 90; break;
          case 'warning': score = 70; break;
          case 'error': score = 40; break;
          case 'critical': score = 10; break;
        }
      }

      totalScore += score * weight;
      totalWeight += weight;
    });

    return Math.round(totalScore / totalWeight);
  }

  private calculateGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private generateTrendText(heapGrowth: number[]): string {
    if (heapGrowth.length < 2) return 'Insufficient data for trend analysis';

    const growth = heapGrowth[heapGrowth.length - 1] - heapGrowth[0];
    const trend = growth > 0 ? 'increasing' : growth < 0 ? 'decreasing' : 'stable';

    return `Memory usage is ${trend} with a total change of ${this.formatBytes(growth)}`;
  }

  private generateComponentTrendText(componentCounts: Record<string, number[]>): string {
    const components = Object.entries(componentCounts)
      .map(([name, counts]) => {
        const growth = counts.length > 1 ? counts[counts.length - 1] - counts[0] : 0;
        return `- ${name}: ${growth > 0 ? '+' : ''}${growth} instances`;
      })
      .slice(0, 5) // Top 5 components
      .join('\n');

    return components || 'No component data available';
  }

  // HTML Report generation methods (styles and scripts)
  private getReportStyles(): string {
    return `
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
      .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
      .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #eee; }
      .grade { font-size: 48px; font-weight: bold; margin: 10px 0; }
      .grade.A { color: #28a745; }
      .grade.B { color: #17a2b8; }
      .grade.C { color: #ffc107; }
      .grade.D { color: #fd7e14; }
      .grade.F { color: #dc3545; }
      .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 20px 0; }
      .metric-card { border: 1px solid #ddd; border-radius: 8px; padding: 20px; background: #fafafa; }
      .metric-passed { border-left: 4px solid #28a745; }
      .metric-failed { border-left: 4px solid #dc3545; }
      .section { margin: 30px 0; }
      .section h2 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
      .issue-critical { border-left: 4px solid #dc3545; background: #fff5f5; padding: 15px; margin: 10px 0; }
      .issue-high { border-left: 4px solid #fd7e14; background: #fff8f0; padding: 15px; margin: 10px 0; }
      .issue-medium { border-left: 4px solid #ffc107; background: #fffbf0; padding: 15px; margin: 10px 0; }
      .optimization { background: #f0f8ff; padding: 15px; margin: 10px 0; border-radius: 5px; }
      .raw-data { background: #f8f9fa; padding: 20px; border-radius: 5px; font-family: monospace; font-size: 12px; white-space: pre-wrap; }
    `;
  }

  private getReportScripts(): string {
    return `
      // Chart rendering and interactive features
      function toggleSection(sectionId) {
        const section = document.getElementById(sectionId);
        section.style.display = section.style.display === 'none' ? 'block' : 'none';
      }

      // Export functionality
      function exportReport(format) {
        if (format === 'json') {
          const data = {
            timestamp: new Date().toISOString(),
            report: document.querySelector('.container').innerHTML
          };
          downloadFile('memory-report.json', JSON.stringify(data, null, 2));
        }
      }

      function downloadFile(filename, content) {
        const element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
        element.setAttribute('download', filename);
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
      }
    `;
  }

  private generateHeader(result: PerformanceValidationResult): string {
    return `
      <div class="header">
        <h1>Memory Analysis Report</h1>
        <div class="grade ${result.grade}">${result.grade}</div>
        <div>Score: ${result.score}/100</div>
        <div>${result.passed ? '✅ PASSED' : '❌ FAILED'}</div>
      </div>
    `;
  }

  private generateExecutiveSummary(report: MemoryAnalysisReport, result: PerformanceValidationResult): string {
    return `
      <div class="section">
        <h2>Executive Summary</h2>
        <div class="metric-grid">
          <div>
            <strong>Current Heap Usage</strong><br>
            ${this.formatBytes(report.current.heapUsed)}
          </div>
          <div>
            <strong>Memory Growth Rate</strong><br>
            ${this.formatBytes(report.summary.memoryGrowthRate)}/hour
          </div>
          <div>
            <strong>Issues Found</strong><br>
            ${report.summary.leakCount}
          </div>
          <div>
            <strong>Overall Health</strong><br>
            ${report.summary.overallHealth.toUpperCase()}
          </div>
        </div>
      </div>
    `;
  }

  private generateMetricsSection(result: PerformanceValidationResult): string {
    return `
      <div class="section">
        <h2>Metrics Validation</h2>
        <div class="metric-grid">
          ${Object.entries(result.metrics).map(([key, metric]) => `
            <div class="metric-card ${metric.passed ? 'metric-passed' : 'metric-failed'}">
              <h4>${metric.name}</h4>
              <div>Target: ${metric.target} ${metric.unit}</div>
              <div>Actual: ${metric.actual} ${metric.unit}</div>
              <div>Status: ${metric.passed ? '✅ PASSED' : '❌ FAILED'}</div>
              ${metric.recommendation ? `<div><small>${metric.recommendation}</small></div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  private generateTrendsSection(report: MemoryAnalysisReport): string {
    return `
      <div class="section">
        <h2>Memory Trends</h2>
        <div>Heap Growth: ${this.generateTrendText(report.trends.heapGrowth)}</div>
        <div>Component Trends: ${this.generateComponentTrendText(report.trends.componentCounts)}</div>
      </div>
    `;
  }

  private generateIssuesSection(report: MemoryAnalysisReport): string {
    if (report.issues.length === 0) {
      return `<div class="section"><h2>Issues</h2><div>✅ No memory issues detected.</div></div>`;
    }

    return `
      <div class="section">
        <h2>Issues Detected</h2>
        ${report.issues.map((issue, index) => `
          <div class="issue-${issue.severity}">
            <h4>${index + 1}. ${issue.type} - ${issue.severity}</h4>
            <div><strong>Source:</strong> ${issue.source}</div>
            <div><strong>Impact:</strong> ${this.formatBytes(issue.memoryDelta)}</div>
            <div><strong>Description:</strong> ${issue.description}</div>
            <div><strong>Fix:</strong> ${issue.suggestedFix}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  private generateOptimizationsSection(report: MemoryAnalysisReport): string {
    if (report.optimizations.length === 0) {
      return `<div class="section"><h2>Optimizations</h2><div>✅ No optimizations needed.</div></div>`;
    }

    return `
      <div class="section">
        <h2>Optimization Opportunities</h2>
        ${report.optimizations.map((opt, index) => `
          <div class="optimization">
            <h4>${index + 1}. ${opt.description}</h4>
            <div><strong>Type:</strong> ${opt.type}</div>
            <div><strong>Priority:</strong> ${opt.priority}</div>
            <div><strong>Expected Savings:</strong> ${this.formatBytes(opt.expectedSavings)}</div>
            <div><strong>Effort:</strong> ${opt.effort}</div>
            <div><strong>Implementation:</strong> ${opt.implementation}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  private generateComplianceSection(result: PerformanceValidationResult): string {
    return `
      <div class="section">
        <h2>Compliance Assessment</h2>
        <div>Target Metrics Met: ${result.compliance.targetMetricsMet ? '✅' : '❌'}</div>
        <div>Baseline Compliance: ${result.compliance.baselineCompliance ? '✅' : '❌'}</div>
        <div>Growth Rate Compliance: ${result.compliance.growthRateCompliance ? '✅' : '❌'}</div>
        <div>Leak-Free Compliance: ${result.compliance.leakFreeCompliance ? '✅' : '❌'}</div>
      </div>
    `;
  }

  private generateRecommendationsSection(result: PerformanceValidationResult): string {
    return `
      <div class="section">
        <h2>Recommendations</h2>
        <ul>
          ${result.summary.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
        <h3>Next Steps</h3>
        <ol>
          ${result.summary.nextSteps.map(step => `<li>${step}</li>`).join('')}
        </ol>
      </div>
    `;
  }

  private generateRawDataSection(report: MemoryAnalysisReport): string {
    return `
      <div class="section">
        <h2>Raw Data <button onclick="toggleSection('raw-data')">Toggle</button></h2>
        <div id="raw-data" class="raw-data" style="display: none;">
          ${JSON.stringify(report, null, 2)}
        </div>
      </div>
    `;
  }
}

export default MemoryAnalysisReportGenerator;