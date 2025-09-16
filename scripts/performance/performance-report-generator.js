/**
 * Performance Report Generator
 * Creates comprehensive performance analysis reports
 */

const fs = require('fs').promises;
const path = require('path');

class PerformanceReportGenerator {
  constructor(config = {}) {
    this.config = {
      outputDir: config.outputDir || './performance-reports',
      templateDir: config.templateDir || './report-templates',
      includeCharts: config.includeCharts !== false,
      includeRawData: config.includeRawData === true,
      reportFormats: config.reportFormats || ['html', 'json', 'csv'],
      slaTargets: {
        responseTime: 1000,
        availability: 99.9,
        throughput: 100,
        errorRate: 1,
        ...config.slaTargets
      },
      ...config
    };

    this.reportData = null;
  }

  /**
   * Generate comprehensive performance report
   */
  async generateReport(testResults) {
    console.log('📊 Generating Comprehensive Performance Report');

    try {
      await this.ensureOutputDir();

      const reportData = {
        metadata: {
          generatedAt: new Date().toISOString(),
          reportId: `perf-report-${Date.now()}`,
          version: '1.0.0',
          generator: 'Performance Report Generator'
        },
        executiveSummary: this.generateExecutiveSummary(testResults),
        testConfiguration: this.extractTestConfiguration(testResults),
        performanceMetrics: this.analyzePerformanceMetrics(testResults),
        slaCompliance: this.analyzeSLACompliance(testResults),
        trendAnalysis: this.generateTrendAnalysis(testResults),
        recommendations: this.generateRecommendations(testResults),
        detailedResults: this.config.includeRawData ? testResults : null
      };

      this.reportData = reportData;

      // Generate reports in requested formats
      const generatedReports = [];

      for (const format of this.config.reportFormats) {
        const reportPath = await this.generateReportFormat(reportData, format);
        generatedReports.push(reportPath);
      }

      console.log('✅ Performance report generation completed');
      console.log(`Generated reports: ${generatedReports.join(', ')}`);

      return {
        reportData,
        generatedReports,
        summary: reportData.executiveSummary
      };

    } catch (error) {
      console.error('❌ Report generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate executive summary
   */
  generateExecutiveSummary(testResults) {
    const summary = {
      overallGrade: 'F',
      slaCompliance: false,
      keyFindings: [],
      criticalIssues: [],
      performanceScore: 0,
      testCoverage: {
        loadTesting: false,
        stressTesting: false,
        benchmarking: false,
        slaValidation: false,
        regressionTesting: false
      }
    };

    // Determine test coverage
    if (testResults.loadTest || testResults.tests?.loadTest) {
      summary.testCoverage.loadTesting = true;
    }
    if (testResults.stressTest || testResults.tests?.stressTest) {
      summary.testCoverage.stressTesting = true;
    }
    if (testResults.benchmarks || testResults.tests?.responseTime) {
      summary.testCoverage.benchmarking = true;
    }
    if (testResults.slaValidation || testResults.tests?.availability) {
      summary.testCoverage.slaValidation = true;
    }
    if (testResults.regressions || testResults.analysis) {
      summary.testCoverage.regressionTesting = true;
    }

    // Calculate performance score
    summary.performanceScore = this.calculatePerformanceScore(testResults);
    summary.overallGrade = this.calculateGrade(summary.performanceScore);

    // Check SLA compliance
    summary.slaCompliance = this.checkOverallSLACompliance(testResults);

    // Generate key findings
    summary.keyFindings = this.extractKeyFindings(testResults);
    summary.criticalIssues = this.extractCriticalIssues(testResults);

    return summary;
  }

  /**
   * Calculate overall performance score
   */
  calculatePerformanceScore(testResults) {
    let score = 100;
    let factors = 0;

    // Response time factor (30%)
    const responseTimeScore = this.scoreResponseTime(testResults);
    if (responseTimeScore !== null) {
      score = score * 0.7 + responseTimeScore * 0.3;
      factors++;
    }

    // Throughput factor (25%)
    const throughputScore = this.scoreThroughput(testResults);
    if (throughputScore !== null) {
      score = score * 0.75 + throughputScore * 0.25;
      factors++;
    }

    // Error rate factor (25%)
    const errorRateScore = this.scoreErrorRate(testResults);
    if (errorRateScore !== null) {
      score = score * 0.75 + errorRateScore * 0.25;
      factors++;
    }

    // Availability factor (20%)
    const availabilityScore = this.scoreAvailability(testResults);
    if (availabilityScore !== null) {
      score = score * 0.8 + availabilityScore * 0.2;
      factors++;
    }

    return factors > 0 ? Math.max(0, Math.min(100, score)) : 0;
  }

  /**
   * Score response time performance
   */
  scoreResponseTime(testResults) {
    // Try to extract P95 response time from various test types
    let p95ResponseTime = null;

    if (testResults.summary?.keyMetrics?.p95ResponseTime) {
      p95ResponseTime = testResults.summary.keyMetrics.p95ResponseTime;
    } else if (testResults.slaValidation?.averageResponseTime) {
      p95ResponseTime = testResults.slaValidation.averageResponseTime;
    } else if (testResults.tests?.responseTime?.aggregated?.percentiles?.p95) {
      p95ResponseTime = testResults.tests.responseTime.aggregated.percentiles.p95;
    }

    if (p95ResponseTime === null) return null;

    const target = this.config.slaTargets.responseTime;
    if (p95ResponseTime <= target) return 100;
    if (p95ResponseTime <= target * 1.5) return 80;
    if (p95ResponseTime <= target * 2) return 60;
    if (p95ResponseTime <= target * 3) return 40;
    return 20;
  }

  /**
   * Score throughput performance
   */
  scoreThroughput(testResults) {
    let maxThroughput = null;

    if (testResults.summary?.keyMetrics?.maxThroughput) {
      maxThroughput = testResults.summary.keyMetrics.maxThroughput;
    } else if (testResults.tests?.throughput?.maxThroughput) {
      maxThroughput = testResults.tests.throughput.maxThroughput;
    }

    if (maxThroughput === null) return null;

    const target = this.config.slaTargets.throughput;
    if (maxThroughput >= target * 2) return 100;
    if (maxThroughput >= target * 1.5) return 80;
    if (maxThroughput >= target) return 60;
    if (maxThroughput >= target * 0.5) return 40;
    return 20;
  }

  /**
   * Score error rate performance
   */
  scoreErrorRate(testResults) {
    let errorRate = null;

    if (testResults.summary?.keyMetrics?.errorRate) {
      errorRate = testResults.summary.keyMetrics.errorRate;
    } else if (testResults.tests?.errorRate?.errorRate) {
      errorRate = testResults.tests.errorRate.errorRate;
    }

    if (errorRate === null) return null;

    const target = this.config.slaTargets.errorRate;
    if (errorRate <= target) return 100;
    if (errorRate <= target * 2) return 80;
    if (errorRate <= target * 3) return 60;
    if (errorRate <= target * 5) return 40;
    return 20;
  }

  /**
   * Score availability performance
   */
  scoreAvailability(testResults) {
    let availability = null;

    if (testResults.summary?.keyMetrics?.availability) {
      availability = testResults.summary.keyMetrics.availability;
    } else if (testResults.tests?.availability?.uptimePercentage) {
      availability = testResults.tests.availability.uptimePercentage;
    }

    if (availability === null) return null;

    const target = this.config.slaTargets.availability;
    if (availability >= target) return 100;
    if (availability >= target - 1) return 80;
    if (availability >= target - 2) return 60;
    if (availability >= target - 5) return 40;
    return 20;
  }

  /**
   * Calculate letter grade from score
   */
  calculateGrade(score) {
    if (score >= 95) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 85) return 'A-';
    if (score >= 80) return 'B+';
    if (score >= 75) return 'B';
    if (score >= 70) return 'B-';
    if (score >= 65) return 'C+';
    if (score >= 60) return 'C';
    if (score >= 55) return 'C-';
    if (score >= 50) return 'D';
    return 'F';
  }

  /**
   * Check overall SLA compliance
   */
  checkOverallSLACompliance(testResults) {
    if (testResults.slaValidation?.compliance?.overallCompliant !== undefined) {
      return testResults.slaValidation.compliance.overallCompliant;
    }

    if (testResults.compliance?.overallCompliant !== undefined) {
      return testResults.compliance.overallCompliant;
    }

    // Infer from individual metrics
    let compliantMetrics = 0;
    let totalMetrics = 0;

    // Check response time
    const responseTime = this.scoreResponseTime(testResults);
    if (responseTime !== null) {
      totalMetrics++;
      if (responseTime >= 60) compliantMetrics++;
    }

    // Check throughput
    const throughput = this.scoreThroughput(testResults);
    if (throughput !== null) {
      totalMetrics++;
      if (throughput >= 60) compliantMetrics++;
    }

    // Check error rate
    const errorRate = this.scoreErrorRate(testResults);
    if (errorRate !== null) {
      totalMetrics++;
      if (errorRate >= 60) compliantMetrics++;
    }

    // Check availability
    const availability = this.scoreAvailability(testResults);
    if (availability !== null) {
      totalMetrics++;
      if (availability >= 60) compliantMetrics++;
    }

    return totalMetrics > 0 ? (compliantMetrics / totalMetrics) >= 0.8 : false;
  }

  /**
   * Extract key findings
   */
  extractKeyFindings(testResults) {
    const findings = [];

    // Response time findings
    const p95 = this.extractP95ResponseTime(testResults);
    if (p95 !== null) {
      if (p95 <= this.config.slaTargets.responseTime) {
        findings.push(`Response times meet SLA target (P95: ${p95.toFixed(2)}ms)`);
      } else {
        findings.push(`Response times exceed SLA target (P95: ${p95.toFixed(2)}ms vs ${this.config.slaTargets.responseTime}ms target)`);
      }
    }

    // Throughput findings
    const throughput = this.extractMaxThroughput(testResults);
    if (throughput !== null) {
      if (throughput >= this.config.slaTargets.throughput) {
        findings.push(`Throughput meets requirements (${throughput.toFixed(1)} RPS)`);
      } else {
        findings.push(`Throughput below requirements (${throughput.toFixed(1)} RPS vs ${this.config.slaTargets.throughput} RPS target)`);
      }
    }

    // Error rate findings
    const errorRate = this.extractErrorRate(testResults);
    if (errorRate !== null) {
      if (errorRate <= this.config.slaTargets.errorRate) {
        findings.push(`Error rate within acceptable limits (${errorRate.toFixed(2)}%)`);
      } else {
        findings.push(`Error rate exceeds acceptable limits (${errorRate.toFixed(2)}% vs ${this.config.slaTargets.errorRate}% target)`);
      }
    }

    // Regression findings
    if (testResults.regressions && testResults.regressions.length > 0) {
      findings.push(`${testResults.regressions.length} performance regressions detected`);
    }

    // Improvement findings
    if (testResults.improvements && testResults.improvements.length > 0) {
      findings.push(`${testResults.improvements.length} performance improvements detected`);
    }

    return findings;
  }

  /**
   * Extract critical issues
   */
  extractCriticalIssues(testResults) {
    const issues = [];

    // Critical response time issues
    const p95 = this.extractP95ResponseTime(testResults);
    if (p95 !== null && p95 > this.config.slaTargets.responseTime * 2) {
      issues.push({
        type: 'critical',
        category: 'response-time',
        message: `Critical response time issue: P95 is ${(p95 / this.config.slaTargets.responseTime).toFixed(1)}x above SLA target`,
        impact: 'high'
      });
    }

    // Critical availability issues
    const availability = this.extractAvailability(testResults);
    if (availability !== null && availability < 99) {
      issues.push({
        type: 'critical',
        category: 'availability',
        message: `Critical availability issue: ${availability.toFixed(2)}% uptime`,
        impact: 'high'
      });
    }

    // Critical error rate issues
    const errorRate = this.extractErrorRate(testResults);
    if (errorRate !== null && errorRate > 10) {
      issues.push({
        type: 'critical',
        category: 'error-rate',
        message: `Critical error rate: ${errorRate.toFixed(2)}%`,
        impact: 'high'
      });
    }

    // Critical regression issues
    if (testResults.regressions) {
      const criticalRegressions = testResults.regressions.filter(r => r.severity === 'critical');
      if (criticalRegressions.length > 0) {
        issues.push({
          type: 'critical',
          category: 'regression',
          message: `${criticalRegressions.length} critical performance regressions`,
          impact: 'high'
        });
      }
    }

    return issues;
  }

  /**
   * Extract test configuration
   */
  extractTestConfiguration(testResults) {
    const config = {
      testTypes: [],
      duration: null,
      concurrency: null,
      endpoints: [],
      environment: null
    };

    // Determine test types run
    if (testResults.loadTest || testResults.tests?.loadTest) {
      config.testTypes.push('Load Testing');
    }
    if (testResults.stressTest || testResults.tests?.stressTest) {
      config.testTypes.push('Stress Testing');
    }
    if (testResults.benchmarks || testResults.tests?.responseTime) {
      config.testTypes.push('Performance Benchmarking');
    }
    if (testResults.slaValidation || testResults.tests?.availability) {
      config.testTypes.push('SLA Validation');
    }
    if (testResults.regressions || testResults.analysis) {
      config.testTypes.push('Regression Testing');
    }

    // Extract configuration details
    if (testResults.config) {
      config.duration = testResults.config.testDuration;
      config.concurrency = testResults.config.maxConcurrency;
      config.environment = testResults.config.baseUrl;
    }

    return config;
  }

  /**
   * Analyze performance metrics
   */
  analyzePerformanceMetrics(testResults) {
    return {
      responseTime: this.analyzeResponseTimeMetrics(testResults),
      throughput: this.analyzeThroughputMetrics(testResults),
      errorRate: this.analyzeErrorRateMetrics(testResults),
      availability: this.analyzeAvailabilityMetrics(testResults),
      scalability: this.analyzeScalabilityMetrics(testResults)
    };
  }

  /**
   * Analyze response time metrics
   */
  analyzeResponseTimeMetrics(testResults) {
    const p95 = this.extractP95ResponseTime(testResults);
    const mean = this.extractMeanResponseTime(testResults);

    return {
      p95ResponseTime: p95,
      meanResponseTime: mean,
      slaTarget: this.config.slaTargets.responseTime,
      slaCompliant: p95 !== null ? p95 <= this.config.slaTargets.responseTime : null,
      grade: this.calculateGrade(this.scoreResponseTime(testResults) || 0)
    };
  }

  /**
   * Analyze throughput metrics
   */
  analyzeThroughputMetrics(testResults) {
    const maxThroughput = this.extractMaxThroughput(testResults);

    return {
      maxThroughput,
      slaTarget: this.config.slaTargets.throughput,
      slaCompliant: maxThroughput !== null ? maxThroughput >= this.config.slaTargets.throughput : null,
      grade: this.calculateGrade(this.scoreThroughput(testResults) || 0)
    };
  }

  /**
   * Analyze error rate metrics
   */
  analyzeErrorRateMetrics(testResults) {
    const errorRate = this.extractErrorRate(testResults);

    return {
      errorRate,
      slaTarget: this.config.slaTargets.errorRate,
      slaCompliant: errorRate !== null ? errorRate <= this.config.slaTargets.errorRate : null,
      grade: this.calculateGrade(this.scoreErrorRate(testResults) || 0)
    };
  }

  /**
   * Analyze availability metrics
   */
  analyzeAvailabilityMetrics(testResults) {
    const availability = this.extractAvailability(testResults);

    return {
      availability,
      slaTarget: this.config.slaTargets.availability,
      slaCompliant: availability !== null ? availability >= this.config.slaTargets.availability : null,
      grade: this.calculateGrade(this.scoreAvailability(testResults) || 0)
    };
  }

  /**
   * Analyze scalability metrics
   */
  analyzeScalabilityMetrics(testResults) {
    const scalability = {
      breakingPoint: null,
      scalabilityScore: 0,
      recommendation: 'Unable to determine'
    };

    // Extract breaking point from stress tests
    if (testResults.tests?.stressTest?.breakingPoint) {
      scalability.breakingPoint = testResults.tests.stressTest.breakingPoint.breakingPoint;
    }

    // Calculate scalability score
    if (scalability.breakingPoint) {
      if (scalability.breakingPoint >= 500) scalability.scalabilityScore = 100;
      else if (scalability.breakingPoint >= 200) scalability.scalabilityScore = 80;
      else if (scalability.breakingPoint >= 100) scalability.scalabilityScore = 60;
      else if (scalability.breakingPoint >= 50) scalability.scalabilityScore = 40;
      else scalability.scalabilityScore = 20;

      // Generate recommendation
      if (scalability.scalabilityScore >= 80) {
        scalability.recommendation = 'Excellent scalability';
      } else if (scalability.scalabilityScore >= 60) {
        scalability.recommendation = 'Good scalability, consider optimization';
      } else {
        scalability.recommendation = 'Poor scalability, requires immediate attention';
      }
    }

    return scalability;
  }

  /**
   * Analyze SLA compliance
   */
  analyzeSLACompliance(testResults) {
    return {
      overall: this.checkOverallSLACompliance(testResults),
      responseTime: this.analyzeResponseTimeMetrics(testResults).slaCompliant,
      throughput: this.analyzeThroughputMetrics(testResults).slaCompliant,
      errorRate: this.analyzeErrorRateMetrics(testResults).slaCompliant,
      availability: this.analyzeAvailabilityMetrics(testResults).slaCompliant,
      violations: this.extractSLAViolations(testResults)
    };
  }

  /**
   * Generate trend analysis
   */
  generateTrendAnalysis(testResults) {
    const trends = {
      regression: {
        detected: false,
        count: 0,
        severity: 'none'
      },
      improvement: {
        detected: false,
        count: 0,
        significance: 'none'
      },
      stability: {
        score: 0,
        assessment: 'unknown'
      }
    };

    // Analyze regressions
    if (testResults.regressions && testResults.regressions.length > 0) {
      trends.regression.detected = true;
      trends.regression.count = testResults.regressions.length;

      const criticalRegressions = testResults.regressions.filter(r => r.severity === 'critical').length;
      const highRegressions = testResults.regressions.filter(r => r.severity === 'high').length;

      if (criticalRegressions > 0) trends.regression.severity = 'critical';
      else if (highRegressions > 0) trends.regression.severity = 'high';
      else trends.regression.severity = 'medium';
    }

    // Analyze improvements
    if (testResults.improvements && testResults.improvements.length > 0) {
      trends.improvement.detected = true;
      trends.improvement.count = testResults.improvements.length;

      const significantImprovements = testResults.improvements.filter(i => Math.abs(i.changePercent) > 20).length;
      if (significantImprovements > 0) trends.improvement.significance = 'significant';
      else trends.improvement.significance = 'minor';
    }

    return trends;
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(testResults) {
    const recommendations = [];

    // Response time recommendations
    const p95 = this.extractP95ResponseTime(testResults);
    if (p95 !== null && p95 > this.config.slaTargets.responseTime) {
      recommendations.push({
        category: 'Performance',
        priority: p95 > this.config.slaTargets.responseTime * 2 ? 'Critical' : 'High',
        recommendation: 'Optimize response times through caching, database optimization, or infrastructure scaling',
        expectedImpact: 'Reduce P95 response time to meet SLA target'
      });
    }

    // Throughput recommendations
    const throughput = this.extractMaxThroughput(testResults);
    if (throughput !== null && throughput < this.config.slaTargets.throughput) {
      recommendations.push({
        category: 'Scalability',
        priority: 'High',
        recommendation: 'Increase system throughput through horizontal scaling or performance optimization',
        expectedImpact: 'Meet minimum throughput requirements'
      });
    }

    // Error rate recommendations
    const errorRate = this.extractErrorRate(testResults);
    if (errorRate !== null && errorRate > this.config.slaTargets.errorRate) {
      recommendations.push({
        category: 'Reliability',
        priority: errorRate > 10 ? 'Critical' : 'High',
        recommendation: 'Investigate and fix error sources, implement better error handling',
        expectedImpact: 'Reduce error rate to acceptable levels'
      });
    }

    // Regression recommendations
    if (testResults.regressions && testResults.regressions.length > 0) {
      const criticalRegressions = testResults.regressions.filter(r => r.severity === 'critical');
      if (criticalRegressions.length > 0) {
        recommendations.push({
          category: 'Regression',
          priority: 'Critical',
          recommendation: 'Address critical performance regressions immediately',
          expectedImpact: 'Restore performance to baseline levels'
        });
      }
    }

    return recommendations;
  }

  /**
   * Helper methods to extract specific metrics
   */
  extractP95ResponseTime(testResults) {
    if (testResults.summary?.keyMetrics?.p95ResponseTime) return testResults.summary.keyMetrics.p95ResponseTime;
    if (testResults.slaValidation?.percentiles?.p95) return testResults.slaValidation.percentiles.p95;
    if (testResults.tests?.responseTime?.aggregated?.percentiles?.p95) return testResults.tests.responseTime.aggregated.percentiles.p95;
    return null;
  }

  extractMeanResponseTime(testResults) {
    if (testResults.summary?.keyMetrics?.averageResponseTime) return testResults.summary.keyMetrics.averageResponseTime;
    if (testResults.slaValidation?.averageResponseTime) return testResults.slaValidation.averageResponseTime;
    return null;
  }

  extractMaxThroughput(testResults) {
    if (testResults.summary?.keyMetrics?.maxThroughput) return testResults.summary.keyMetrics.maxThroughput;
    if (testResults.tests?.throughput?.maxThroughput) return testResults.tests.throughput.maxThroughput;
    return null;
  }

  extractErrorRate(testResults) {
    if (testResults.summary?.keyMetrics?.errorRate) return testResults.summary.keyMetrics.errorRate;
    if (testResults.tests?.errorRate?.errorRate) return testResults.tests.errorRate.errorRate;
    return null;
  }

  extractAvailability(testResults) {
    if (testResults.summary?.keyMetrics?.availability) return testResults.summary.keyMetrics.availability;
    if (testResults.tests?.availability?.uptimePercentage) return testResults.tests.availability.uptimePercentage;
    return null;
  }

  extractSLAViolations(testResults) {
    const violations = [];

    if (testResults.violations) return testResults.violations;
    if (testResults.slaValidation?.violations) return testResults.slaValidation.violations;

    return violations;
  }

  /**
   * Generate report in specific format
   */
  async generateReportFormat(reportData, format) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `performance-report-${timestamp}.${format}`;
    const filepath = path.join(this.config.outputDir, filename);

    switch (format.toLowerCase()) {
      case 'html':
        await this.generateHTMLReport(reportData, filepath);
        break;
      case 'json':
        await this.generateJSONReport(reportData, filepath);
        break;
      case 'csv':
        await this.generateCSVReport(reportData, filepath);
        break;
      case 'txt':
        await this.generateTextReport(reportData, filepath);
        break;
      default:
        throw new Error(`Unsupported report format: ${format}`);
    }

    console.log(`📄 Generated ${format.toUpperCase()} report: ${filepath}`);
    return filepath;
  }

  /**
   * Generate HTML report
   */
  async generateHTMLReport(reportData, filepath) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { border-bottom: 3px solid #007bff; padding-bottom: 20px; margin-bottom: 30px; }
        .grade { font-size: 3em; font-weight: bold; text-align: center; margin: 20px 0; }
        .grade.A { color: #28a745; }
        .grade.B { color: #ffc107; }
        .grade.C { color: #fd7e14; }
        .grade.D { color: #dc3545; }
        .grade.F { color: #dc3545; }
        .metric-card { background: #f8f9fa; padding: 20px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #007bff; }
        .compliant { border-left-color: #28a745; }
        .non-compliant { border-left-color: #dc3545; }
        .critical-issue { background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .recommendation { background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .findings-list { list-style-type: none; padding: 0; }
        .findings-list li { padding: 10px; margin: 5px 0; background: #e9ecef; border-radius: 3px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #007bff; color: white; }
        .text-center { text-align: center; }
        .text-success { color: #28a745; }
        .text-danger { color: #dc3545; }
        .text-warning { color: #ffc107; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Performance Test Report</h1>
            <p><strong>Generated:</strong> ${reportData.metadata.generatedAt}</p>
            <p><strong>Report ID:</strong> ${reportData.metadata.reportId}</p>
        </div>

        <div class="text-center">
            <div class="grade ${reportData.executiveSummary.overallGrade.charAt(0)}">${reportData.executiveSummary.overallGrade}</div>
            <h3>Performance Score: ${reportData.executiveSummary.performanceScore.toFixed(1)}/100</h3>
        </div>

        <div class="metric-card ${reportData.executiveSummary.slaCompliance ? 'compliant' : 'non-compliant'}">
            <h3>SLA Compliance: ${reportData.executiveSummary.slaCompliance ? '✅ COMPLIANT' : '❌ NON-COMPLIANT'}</h3>
        </div>

        <h2>Executive Summary</h2>
        <h3>Key Findings</h3>
        <ul class="findings-list">
            ${reportData.executiveSummary.keyFindings.map(finding => `<li>${finding}</li>`).join('')}
        </ul>

        ${reportData.executiveSummary.criticalIssues.length > 0 ? `
        <h3>Critical Issues</h3>
        ${reportData.executiveSummary.criticalIssues.map(issue => `
        <div class="critical-issue">
            <strong>${issue.category.toUpperCase()}:</strong> ${issue.message}
        </div>
        `).join('')}
        ` : ''}

        <h2>Performance Metrics</h2>
        <table>
            <thead>
                <tr>
                    <th>Metric</th>
                    <th>Current Value</th>
                    <th>SLA Target</th>
                    <th>Status</th>
                    <th>Grade</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Response Time (P95)</td>
                    <td>${reportData.performanceMetrics.responseTime.p95ResponseTime?.toFixed(2) || 'N/A'}ms</td>
                    <td>${reportData.performanceMetrics.responseTime.slaTarget}ms</td>
                    <td class="${reportData.performanceMetrics.responseTime.slaCompliant ? 'text-success' : 'text-danger'}">
                        ${reportData.performanceMetrics.responseTime.slaCompliant ? '✅ Compliant' : '❌ Non-Compliant'}
                    </td>
                    <td>${reportData.performanceMetrics.responseTime.grade}</td>
                </tr>
                <tr>
                    <td>Throughput</td>
                    <td>${reportData.performanceMetrics.throughput.maxThroughput?.toFixed(2) || 'N/A'} RPS</td>
                    <td>${reportData.performanceMetrics.throughput.slaTarget} RPS</td>
                    <td class="${reportData.performanceMetrics.throughput.slaCompliant ? 'text-success' : 'text-danger'}">
                        ${reportData.performanceMetrics.throughput.slaCompliant ? '✅ Compliant' : '❌ Non-Compliant'}
                    </td>
                    <td>${reportData.performanceMetrics.throughput.grade}</td>
                </tr>
                <tr>
                    <td>Error Rate</td>
                    <td>${reportData.performanceMetrics.errorRate.errorRate?.toFixed(2) || 'N/A'}%</td>
                    <td>${reportData.performanceMetrics.errorRate.slaTarget}%</td>
                    <td class="${reportData.performanceMetrics.errorRate.slaCompliant ? 'text-success' : 'text-danger'}">
                        ${reportData.performanceMetrics.errorRate.slaCompliant ? '✅ Compliant' : '❌ Non-Compliant'}
                    </td>
                    <td>${reportData.performanceMetrics.errorRate.grade}</td>
                </tr>
                <tr>
                    <td>Availability</td>
                    <td>${reportData.performanceMetrics.availability.availability?.toFixed(2) || 'N/A'}%</td>
                    <td>${reportData.performanceMetrics.availability.slaTarget}%</td>
                    <td class="${reportData.performanceMetrics.availability.slaCompliant ? 'text-success' : 'text-danger'}">
                        ${reportData.performanceMetrics.availability.slaCompliant ? '✅ Compliant' : '❌ Non-Compliant'}
                    </td>
                    <td>${reportData.performanceMetrics.availability.grade}</td>
                </tr>
            </tbody>
        </table>

        <h2>Test Coverage</h2>
        <ul class="findings-list">
            ${Object.entries(reportData.executiveSummary.testCoverage).map(([test, covered]) =>
                `<li>${test.replace(/([A-Z])/g, ' $1').trim()}: ${covered ? '✅ Covered' : '❌ Not Covered'}</li>`
            ).join('')}
        </ul>

        <h2>Recommendations</h2>
        ${reportData.recommendations.map(rec => `
        <div class="recommendation">
            <strong>${rec.category} (${rec.priority}):</strong> ${rec.recommendation}
            <br><em>Expected Impact:</em> ${rec.expectedImpact}
        </div>
        `).join('')}

        <div class="header" style="margin-top: 40px;">
            <p><em>Report generated by Performance Report Generator v${reportData.metadata.version}</em></p>
        </div>
    </div>
</body>
</html>`;

    await fs.writeFile(filepath, html);
  }

  /**
   * Generate JSON report
   */
  async generateJSONReport(reportData, filepath) {
    await fs.writeFile(filepath, JSON.stringify(reportData, null, 2));
  }

  /**
   * Generate CSV report
   */
  async generateCSVReport(reportData, filepath) {
    const csvData = [
      ['Metric', 'Value', 'Target', 'Compliant', 'Grade'],
      ['Overall Performance Score', reportData.executiveSummary.performanceScore.toFixed(1), '90', reportData.executiveSummary.performanceScore >= 90 ? 'Yes' : 'No', reportData.executiveSummary.overallGrade],
      ['Response Time P95 (ms)', reportData.performanceMetrics.responseTime.p95ResponseTime?.toFixed(2) || 'N/A', reportData.performanceMetrics.responseTime.slaTarget, reportData.performanceMetrics.responseTime.slaCompliant ? 'Yes' : 'No', reportData.performanceMetrics.responseTime.grade],
      ['Throughput (RPS)', reportData.performanceMetrics.throughput.maxThroughput?.toFixed(2) || 'N/A', reportData.performanceMetrics.throughput.slaTarget, reportData.performanceMetrics.throughput.slaCompliant ? 'Yes' : 'No', reportData.performanceMetrics.throughput.grade],
      ['Error Rate (%)', reportData.performanceMetrics.errorRate.errorRate?.toFixed(2) || 'N/A', reportData.performanceMetrics.errorRate.slaTarget, reportData.performanceMetrics.errorRate.slaCompliant ? 'Yes' : 'No', reportData.performanceMetrics.errorRate.grade],
      ['Availability (%)', reportData.performanceMetrics.availability.availability?.toFixed(2) || 'N/A', reportData.performanceMetrics.availability.slaTarget, reportData.performanceMetrics.availability.slaCompliant ? 'Yes' : 'No', reportData.performanceMetrics.availability.grade]
    ];

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    await fs.writeFile(filepath, csvContent);
  }

  /**
   * Generate text report
   */
  async generateTextReport(reportData, filepath) {
    const report = `PERFORMANCE TEST REPORT
${'='.repeat(50)}

Generated: ${reportData.metadata.generatedAt}
Report ID: ${reportData.metadata.reportId}

OVERALL GRADE: ${reportData.executiveSummary.overallGrade}
PERFORMANCE SCORE: ${reportData.executiveSummary.performanceScore.toFixed(1)}/100
SLA COMPLIANCE: ${reportData.executiveSummary.slaCompliance ? 'COMPLIANT' : 'NON-COMPLIANT'}

KEY FINDINGS:
${reportData.executiveSummary.keyFindings.map(finding => `- ${finding}`).join('\n')}

${reportData.executiveSummary.criticalIssues.length > 0 ? `
CRITICAL ISSUES:
${reportData.executiveSummary.criticalIssues.map(issue => `- ${issue.message}`).join('\n')}
` : ''}

PERFORMANCE METRICS:
${'='.repeat(30)}
Response Time (P95): ${reportData.performanceMetrics.responseTime.p95ResponseTime?.toFixed(2) || 'N/A'}ms (Target: ${reportData.performanceMetrics.responseTime.slaTarget}ms)
Throughput: ${reportData.performanceMetrics.throughput.maxThroughput?.toFixed(2) || 'N/A'} RPS (Target: ${reportData.performanceMetrics.throughput.slaTarget} RPS)
Error Rate: ${reportData.performanceMetrics.errorRate.errorRate?.toFixed(2) || 'N/A'}% (Target: ≤${reportData.performanceMetrics.errorRate.slaTarget}%)
Availability: ${reportData.performanceMetrics.availability.availability?.toFixed(2) || 'N/A'}% (Target: ≥${reportData.performanceMetrics.availability.slaTarget}%)

RECOMMENDATIONS:
${'='.repeat(30)}
${reportData.recommendations.map(rec => `${rec.priority}: ${rec.recommendation}`).join('\n')}

Report generated by Performance Report Generator v${reportData.metadata.version}
`;

    await fs.writeFile(filepath, report);
  }

  /**
   * Ensure output directory exists
   */
  async ensureOutputDir() {
    try {
      await fs.access(this.config.outputDir);
    } catch {
      await fs.mkdir(this.config.outputDir, { recursive: true });
    }
  }
}

module.exports = PerformanceReportGenerator;