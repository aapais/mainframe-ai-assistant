#!/usr/bin/env node

/**
 * Memory Analysis Execution Script
 *
 * Main entry point for comprehensive memory usage analysis of the
 * mainframe knowledge base assistant application.
 *
 * Usage:
 *   npm run memory:analyze
 *   node src/performance/run-memory-analysis.ts
 *   node src/performance/run-memory-analysis.ts --mode=continuous --duration=2h
 */

import path from 'path';
import fs from 'fs/promises';
import { program } from 'commander';
import MemoryAnalyzer from './MemoryAnalyzer';
import MemoryAnalysisReportGenerator from './memory-analysis-report';
import {
  setupMemoryMonitoring,
  runMemoryAnalysis,
  runLongSessionTest,
  formatBytes
} from './memory-usage-example';

interface AnalysisOptions {
  mode: 'snapshot' | 'continuous' | 'long-session' | 'validation';
  duration: string;
  output: string;
  format: 'json' | 'html' | 'markdown' | 'csv';
  leakThreshold: number;
  interval: number;
  verbose: boolean;
  exportRaw: boolean;
}

class MemoryAnalysisRunner {
  private analyzer: MemoryAnalyzer | null = null;
  private reportGenerator = new MemoryAnalysisReportGenerator();
  private startTime = Date.now();

  async run(options: AnalysisOptions): Promise<void> {
    console.log('🚀 Starting Memory Analysis for Mainframe KB Assistant');
    console.log('=' .repeat(60));

    try {
      // Initialize coordination hooks
      await this.initializeCoordination();

      // Setup analyzer based on mode
      this.analyzer = await this.setupAnalyzer(options);

      // Execute analysis based on mode
      switch (options.mode) {
        case 'snapshot':
          await this.runSnapshotAnalysis(options);
          break;
        case 'continuous':
          await this.runContinuousAnalysis(options);
          break;
        case 'long-session':
          await this.runLongSessionAnalysis(options);
          break;
        case 'validation':
          await this.runValidationAnalysis(options);
          break;
        default:
          throw new Error(`Unknown analysis mode: ${options.mode}`);
      }

      console.log('✅ Memory analysis completed successfully');

    } catch (error) {
      console.error('❌ Memory analysis failed:', error);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }

  private async initializeCoordination(): Promise<void> {
    try {
      console.log('🔗 Attempting to initialize coordination...');

      // Try coordination hooks without failing the analysis
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      try {
        await execAsync('npx claude-flow@alpha hooks pre-task --description "comprehensive-memory-analysis"', {
          timeout: 5000
        });
        console.log('✅ Coordination hooks initialized');
      } catch (hookError) {
        console.log('⚠️ Coordination hooks not available, continuing without coordination');
      }

    } catch (error) {
      console.log('⚠️ Coordination initialization skipped:', error.message);
    }
  }

  private async setupAnalyzer(options: AnalysisOptions): Promise<MemoryAnalyzer> {
    console.log('🔧 Configuring memory analyzer...');

    const config = {
      snapshotInterval: options.interval,
      maxSnapshots: options.mode === 'long-session' ? 10000 : 1000,
      leakThreshold: options.leakThreshold,
      gcPressureThreshold: 50
    };

    const analyzer = new MemoryAnalyzer(config);

    // Setup event listeners
    analyzer.on('monitoring:started', (baseline) => {
      console.log(`📊 Monitoring started. Baseline: ${formatBytes(baseline.heapUsed)}`);
    });

    analyzer.on('snapshot:taken', (snapshot) => {
      if (options.verbose) {
        console.log(`📸 Snapshot: ${formatBytes(snapshot.heapUsed)} heap, ${snapshot.leakSuspects.length} leaks`);
      }
    });

    analyzer.on('gc:occurred', (gcEvent) => {
      if (options.verbose && gcEvent.duration > 50) {
        console.log(`🗑️ GC: ${gcEvent.duration.toFixed(2)}ms`);
      }
    });

    analyzer.on('long-session:alert', (issues) => {
      console.warn(`🚨 Long session alert: ${issues.length} critical issues`);
      issues.forEach(issue => {
        console.warn(`  - ${issue.type}: ${issue.description}`);
      });
    });

    await analyzer.startMonitoring();
    return analyzer;
  }

  private async runSnapshotAnalysis(options: AnalysisOptions): Promise<void> {
    console.log('📸 Running snapshot analysis...');

    if (!this.analyzer) throw new Error('Analyzer not initialized');

    // Force garbage collection if available
    if (global.gc) {
      console.log('🗑️ Running garbage collection...');
      global.gc();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Take comprehensive snapshot
    await this.analyzer.takeSnapshot();

    // Generate and export report
    const analysisReport = await this.analyzer.generateReport();
    const validationResult = this.reportGenerator.generateReport(analysisReport);

    await this.exportReports(analysisReport, validationResult, options);

    // Display summary
    this.displaySummary(validationResult);
  }

  private async runContinuousAnalysis(options: AnalysisOptions): Promise<void> {
    console.log(`🔄 Running continuous analysis for ${options.duration}...`);

    if (!this.analyzer) throw new Error('Analyzer not initialized');

    const durationMs = this.parseDuration(options.duration);
    const endTime = Date.now() + durationMs;

    console.log(`⏰ Analysis will run until ${new Date(endTime).toISOString()}`);

    // Monitor continuously
    const monitoringInterval = setInterval(async () => {
      if (Date.now() >= endTime) {
        clearInterval(monitoringInterval);
        await this.finalizeContinuousAnalysis(options);
        return;
      }

      const snapshot = await this.analyzer!.takeSnapshot();

      if (snapshot.leakSuspects.length > 0) {
        console.warn(`⚠️ Issues detected: ${snapshot.leakSuspects.length} leaks`);
      }
    }, options.interval);

    // Wait for completion
    await new Promise(resolve => {
      const checkCompletion = () => {
        if (Date.now() >= endTime) {
          resolve(undefined);
        } else {
          setTimeout(checkCompletion, 1000);
        }
      };
      checkCompletion();
    });
  }

  private async runLongSessionAnalysis(options: AnalysisOptions): Promise<void> {
    console.log(`🕐 Running long session analysis for ${options.duration}...`);

    if (!this.analyzer) throw new Error('Analyzer not initialized');

    const durationHours = this.parseDuration(options.duration) / (1000 * 60 * 60);

    // Start long session monitoring with simulation
    const finalReport = await runLongSessionTest(this.analyzer, durationHours);
    const validationResult = this.reportGenerator.generateReport(finalReport);

    await this.exportReports(finalReport, validationResult, options);
    this.displaySummary(validationResult);
  }

  private async runValidationAnalysis(options: AnalysisOptions): Promise<void> {
    console.log('✅ Running validation analysis against target metrics...');

    if (!this.analyzer) throw new Error('Analyzer not initialized');

    // Run comprehensive analysis
    const analysisReport = await runMemoryAnalysis(this.analyzer);
    const validationResult = this.reportGenerator.generateReport(analysisReport);

    // Export detailed validation report
    await this.exportReports(analysisReport, validationResult, options);

    // Display validation results
    this.displayValidationResults(validationResult);

    // Exit with appropriate code
    process.exit(validationResult.passed ? 0 : 1);
  }

  private async finalizeContinuousAnalysis(options: AnalysisOptions): Promise<void> {
    console.log('📋 Finalizing continuous analysis...');

    if (!this.analyzer) return;

    const analysisReport = await this.analyzer.generateReport();
    const validationResult = this.reportGenerator.generateReport(analysisReport);

    await this.exportReports(analysisReport, validationResult, options);
    this.displaySummary(validationResult);
  }

  private async exportReports(
    analysisReport: any,
    validationResult: any,
    options: AnalysisOptions
  ): Promise<void> {
    console.log(`📄 Exporting reports in ${options.format} format...`);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseFilename = `memory-analysis-${timestamp}`;

    try {
      // Ensure output directory exists
      await fs.mkdir(path.dirname(options.output), { recursive: true });

      switch (options.format) {
        case 'json':
          await this.exportJSONReport(analysisReport, validationResult, options.output, baseFilename);
          break;
        case 'html':
          await this.exportHTMLReport(analysisReport, validationResult, options.output, baseFilename);
          break;
        case 'markdown':
          await this.exportMarkdownReport(analysisReport, validationResult, options.output, baseFilename);
          break;
        case 'csv':
          await this.exportCSVReport(analysisReport, options.output, baseFilename);
          break;
      }

      // Export raw data if requested
      if (options.exportRaw) {
        const rawFile = path.join(path.dirname(options.output), `${baseFilename}-raw.json`);
        await fs.writeFile(rawFile, JSON.stringify(analysisReport, null, 2));
        console.log(`📊 Raw data exported to: ${rawFile}`);
      }

    } catch (error) {
      console.error('❌ Failed to export reports:', error);
    }
  }

  private async exportJSONReport(
    analysisReport: any,
    validationResult: any,
    outputPath: string,
    baseFilename: string
  ): Promise<void> {
    const reportData = {
      timestamp: new Date().toISOString(),
      analysis: analysisReport,
      validation: validationResult,
      metadata: {
        version: '2.0.0',
        tool: 'Memory Analysis System',
        duration: Date.now() - this.startTime
      }
    };

    const filename = path.join(path.dirname(outputPath), `${baseFilename}.json`);
    await fs.writeFile(filename, JSON.stringify(reportData, null, 2));
    console.log(`📄 JSON report exported to: ${filename}`);
  }

  private async exportHTMLReport(
    analysisReport: any,
    validationResult: any,
    outputPath: string,
    baseFilename: string
  ): Promise<void> {
    const htmlContent = this.reportGenerator.generateHTMLReport(analysisReport, validationResult);
    const filename = path.join(path.dirname(outputPath), `${baseFilename}.html`);
    await fs.writeFile(filename, htmlContent);
    console.log(`📄 HTML report exported to: ${filename}`);
  }

  private async exportMarkdownReport(
    analysisReport: any,
    validationResult: any,
    outputPath: string,
    baseFilename: string
  ): Promise<void> {
    const markdownContent = this.reportGenerator.generateMarkdownReport(analysisReport, validationResult);
    const filename = path.join(path.dirname(outputPath), `${baseFilename}.md`);
    await fs.writeFile(filename, markdownContent);
    console.log(`📄 Markdown report exported to: ${filename}`);
  }

  private async exportCSVReport(
    analysisReport: any,
    outputPath: string,
    baseFilename: string
  ): Promise<void> {
    const csvContent = this.reportGenerator.generateCSVReport(analysisReport);
    const filename = path.join(path.dirname(outputPath), `${baseFilename}.csv`);
    await fs.writeFile(filename, csvContent);
    console.log(`📄 CSV report exported to: ${filename}`);
  }

  private displaySummary(validationResult: any): void {
    console.log('\n📊 Analysis Summary');
    console.log('=' .repeat(40));
    console.log(`Overall Grade: ${validationResult.grade} (${validationResult.score}/100)`);
    console.log(`Status: ${validationResult.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Critical Issues: ${validationResult.summary.criticalIssues}`);
    console.log(`Warnings: ${validationResult.summary.warnings}`);

    if (validationResult.summary.recommendations.length > 0) {
      console.log('\n🔧 Key Recommendations:');
      validationResult.summary.recommendations.slice(0, 3).forEach((rec: string, i: number) => {
        console.log(`  ${i + 1}. ${rec}`);
      });
    }
  }

  private displayValidationResults(validationResult: any): void {
    console.log('\n✅ Validation Results');
    console.log('=' .repeat(40));

    Object.entries(validationResult.metrics).forEach(([key, metric]: [string, any]) => {
      const status = metric.passed ? '✅' : '❌';
      console.log(`${status} ${metric.name}: ${metric.actual} ${metric.unit} (target: ${metric.target})`);
    });

    console.log('\n📋 Compliance Status:');
    Object.entries(validationResult.compliance).forEach(([key, passed]: [string, any]) => {
      const status = passed ? '✅' : '❌';
      const label = key.replace(/([A-Z])/g, ' $1').toLowerCase();
      console.log(`${status} ${label}`);
    });
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([hms])$/);
    if (!match) {
      throw new Error(`Invalid duration format: ${duration}. Use format like '2h', '30m', or '60s'`);
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'h': return value * 60 * 60 * 1000;
      case 'm': return value * 60 * 1000;
      case 's': return value * 1000;
      default: throw new Error(`Unknown time unit: ${unit}`);
    }
  }

  private async cleanup(): Promise<void> {
    try {
      // Stop monitoring
      if (this.analyzer) {
        this.analyzer.stopMonitoring();
      }

      // Update coordination hooks
      try {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        await execAsync('npx claude-flow@alpha hooks post-edit --memory-key "swarm/performance/memory" --file "memory-analysis-complete"', {
          timeout: 5000
        });

        await execAsync('npx claude-flow@alpha hooks post-task --task-id "memory-analysis"', {
          timeout: 5000
        });

        console.log('✅ Coordination hooks updated');
      } catch (hookError) {
        // Don't fail on hook errors
        console.log('⚠️ Coordination hook update skipped');
      }

    } catch (error) {
      console.error('⚠️ Cleanup error:', error.message);
    }
  }
}

// CLI Configuration
program
  .name('memory-analysis')
  .description('Comprehensive memory usage analysis for Mainframe KB Assistant')
  .version('2.0.0');

program
  .option('-m, --mode <mode>', 'Analysis mode: snapshot, continuous, long-session, validation', 'snapshot')
  .option('-d, --duration <duration>', 'Duration for continuous/long-session modes (e.g., 2h, 30m, 60s)', '1h')
  .option('-o, --output <path>', 'Output directory for reports', './reports')
  .option('-f, --format <format>', 'Report format: json, html, markdown, csv', 'html')
  .option('-t, --leak-threshold <bytes>', 'Memory leak threshold in bytes', '1048576') // 1MB
  .option('-i, --interval <ms>', 'Snapshot interval in milliseconds', '15000') // 15 seconds
  .option('-v, --verbose', 'Enable verbose output', false)
  .option('-r, --export-raw', 'Export raw analysis data', false);

program.parse();

const options = program.opts() as AnalysisOptions;

// Convert string options to appropriate types
options.leakThreshold = parseInt(options.leakThreshold.toString());
options.interval = parseInt(options.interval.toString());

// Run analysis
const runner = new MemoryAnalysisRunner();
runner.run(options).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export default MemoryAnalysisRunner;