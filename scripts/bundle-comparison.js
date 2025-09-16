#!/usr/bin/env node
/**
 * Bundle Comparison Tool - Compare bundle sizes across builds and track changes
 * Provides historical analysis and regression detection
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class BundleComparison {
  constructor(options = {}) {
    this.historyDir = options.historyDir || 'bundle-history';
    this.outputDir = options.outputDir || 'bundle-analysis';
    this.currentAnalysis = null;
    this.previousAnalysis = null;
    this.thresholds = options.thresholds || {
      size: 0.05,      // 5% size increase threshold
      files: 0.1,      // 10% file count increase threshold
      critical: 0.15   // 15% critical threshold
    };
  }

  async compare(currentPath, previousPath = null) {
    console.log('🔄 Starting bundle comparison...');

    // Load current analysis
    this.currentAnalysis = await this.loadAnalysis(currentPath);

    // Load previous analysis
    if (previousPath) {
      this.previousAnalysis = await this.loadAnalysis(previousPath);
    } else {
      this.previousAnalysis = await this.loadLatestAnalysis();
    }

    if (!this.previousAnalysis) {
      console.log('📊 No previous analysis found, saving current as baseline');
      await this.saveAnalysis(this.currentAnalysis);
      return this.currentAnalysis;
    }

    // Perform comparison
    const comparison = await this.performComparison();

    // Save current analysis to history
    await this.saveAnalysis(this.currentAnalysis);

    // Generate comparison reports
    await this.generateComparisonReports(comparison);

    console.log('✅ Bundle comparison complete!');
    return comparison;
  }

  async loadAnalysis(analysisPath) {
    if (!fs.existsSync(analysisPath)) {
      throw new Error(`Analysis file not found: ${analysisPath}`);
    }

    const data = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));
    return {
      ...data,
      timestamp: new Date(data.timestamp)
    };
  }

  async loadLatestAnalysis() {
    if (!fs.existsSync(this.historyDir)) {
      return null;
    }

    const files = fs.readdirSync(this.historyDir)
      .filter(file => file.endsWith('.json'))
      .sort()
      .reverse();

    if (files.length === 0) {
      return null;
    }

    const latestFile = path.join(this.historyDir, files[0]);
    return this.loadAnalysis(latestFile);
  }

  async saveAnalysis(analysis) {
    if (!fs.existsSync(this.historyDir)) {
      fs.mkdirSync(this.historyDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `bundle-analysis-${timestamp}.json`;
    const filepath = path.join(this.historyDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(analysis, null, 2));
    console.log(`📄 Analysis saved to history: ${filepath}`);
  }

  async performComparison() {
    console.log('🔍 Performing detailed comparison...');

    const comparison = {
      timestamp: new Date().toISOString(),
      current: {
        timestamp: this.currentAnalysis.timestamp,
        totalSize: this.calculateTotalSize(this.currentAnalysis),
        fileCount: this.currentAnalysis.files.length,
        chunkCount: this.currentAnalysis.chunks?.length || 0
      },
      previous: {
        timestamp: this.previousAnalysis.timestamp,
        totalSize: this.calculateTotalSize(this.previousAnalysis),
        fileCount: this.previousAnalysis.files.length,
        chunkCount: this.previousAnalysis.chunks?.length || 0
      },
      changes: {
        size: {},
        files: [],
        chunks: [],
        dependencies: []
      },
      alerts: []
    };

    // Calculate overall changes
    comparison.changes.size = {
      absolute: comparison.current.totalSize - comparison.previous.totalSize,
      percentage: ((comparison.current.totalSize - comparison.previous.totalSize) / comparison.previous.totalSize * 100),
      formatted: this.formatSizeChange(comparison.current.totalSize - comparison.previous.totalSize)
    };

    // Analyze file changes
    await this.analyzeFileChanges(comparison);

    // Analyze chunk changes
    await this.analyzeChunkChanges(comparison);

    // Analyze dependency changes
    await this.analyzeDependencyChanges(comparison);

    // Generate alerts
    this.generateAlerts(comparison);

    return comparison;
  }

  async analyzeFileChanges(comparison) {
    console.log('📁 Analyzing file changes...');

    const currentFiles = new Map(this.currentAnalysis.files.map(f => [f.name, f]));
    const previousFiles = new Map(this.previousAnalysis.files.map(f => [f.name, f]));

    // Find new files
    for (const [name, file] of currentFiles) {
      if (!previousFiles.has(name)) {
        comparison.changes.files.push({
          type: 'added',
          name,
          size: file.size,
          impact: 'increase'
        });
      }
    }

    // Find removed files
    for (const [name, file] of previousFiles) {
      if (!currentFiles.has(name)) {
        comparison.changes.files.push({
          type: 'removed',
          name,
          size: file.size,
          impact: 'decrease'
        });
      }
    }

    // Find modified files
    for (const [name, currentFile] of currentFiles) {
      const previousFile = previousFiles.get(name);
      if (previousFile) {
        const sizeDiff = currentFile.size - previousFile.size;
        const sizeChangePercent = (sizeDiff / previousFile.size) * 100;

        if (Math.abs(sizeChangePercent) > 1) { // 1% threshold
          comparison.changes.files.push({
            type: 'modified',
            name,
            previousSize: previousFile.size,
            currentSize: currentFile.size,
            sizeDiff,
            sizeChangePercent: sizeChangePercent.toFixed(2),
            impact: sizeDiff > 0 ? 'increase' : 'decrease'
          });
        }
      }
    }

    // Sort by impact
    comparison.changes.files.sort((a, b) => {
      const aSize = Math.abs(a.sizeDiff || a.size);
      const bSize = Math.abs(b.sizeDiff || b.size);
      return bSize - aSize;
    });
  }

  async analyzeChunkChanges(comparison) {
    if (!this.currentAnalysis.chunks || !this.previousAnalysis.chunks) {
      return;
    }

    console.log('🧩 Analyzing chunk changes...');

    const currentChunks = new Map(this.currentAnalysis.chunks.map(c => [c.name, c]));
    const previousChunks = new Map(this.previousAnalysis.chunks.map(c => [c.name, c]));

    // Analyze chunk changes similar to file changes
    for (const [name, chunk] of currentChunks) {
      const previousChunk = previousChunks.get(name);

      if (!previousChunk) {
        comparison.changes.chunks.push({
          type: 'added',
          name,
          size: chunk.size || 0,
          impact: 'increase'
        });
      } else if (chunk.size && previousChunk.size) {
        const sizeDiff = chunk.size - previousChunk.size;
        const sizeChangePercent = (sizeDiff / previousChunk.size) * 100;

        if (Math.abs(sizeChangePercent) > 2) { // 2% threshold for chunks
          comparison.changes.chunks.push({
            type: 'modified',
            name,
            previousSize: previousChunk.size,
            currentSize: chunk.size,
            sizeDiff,
            sizeChangePercent: sizeChangePercent.toFixed(2),
            impact: sizeDiff > 0 ? 'increase' : 'decrease'
          });
        }
      }
    }

    for (const [name, chunk] of previousChunks) {
      if (!currentChunks.has(name)) {
        comparison.changes.chunks.push({
          type: 'removed',
          name,
          size: chunk.size || 0,
          impact: 'decrease'
        });
      }
    }
  }

  async analyzeDependencyChanges(comparison) {
    if (!this.currentAnalysis.dependencies || !this.previousAnalysis.dependencies) {
      return;
    }

    console.log('📦 Analyzing dependency changes...');

    const currentDeps = this.currentAnalysis.dependencies;
    const previousDeps = this.previousAnalysis.dependencies;

    // Find new dependencies
    for (const [name, dep] of Object.entries(currentDeps)) {
      if (!previousDeps[name]) {
        comparison.changes.dependencies.push({
          type: 'added',
          name,
          version: dep.version,
          size: dep.size || 0,
          impact: 'increase'
        });
      }
    }

    // Find removed dependencies
    for (const [name, dep] of Object.entries(previousDeps)) {
      if (!currentDeps[name]) {
        comparison.changes.dependencies.push({
          type: 'removed',
          name,
          version: dep.version,
          size: dep.size || 0,
          impact: 'decrease'
        });
      }
    }

    // Find updated dependencies
    for (const [name, currentDep] of Object.entries(currentDeps)) {
      const previousDep = previousDeps[name];
      if (previousDep && currentDep.version !== previousDep.version) {
        const sizeDiff = (currentDep.size || 0) - (previousDep.size || 0);

        comparison.changes.dependencies.push({
          type: 'updated',
          name,
          previousVersion: previousDep.version,
          currentVersion: currentDep.version,
          previousSize: previousDep.size || 0,
          currentSize: currentDep.size || 0,
          sizeDiff,
          impact: sizeDiff > 0 ? 'increase' : 'decrease'
        });
      }
    }
  }

  generateAlerts(comparison) {
    console.log('⚠️ Generating alerts...');

    // Size increase alerts
    if (comparison.changes.size.percentage > this.thresholds.critical * 100) {
      comparison.alerts.push({
        type: 'critical',
        category: 'size',
        message: `Bundle size increased by ${comparison.changes.size.percentage.toFixed(1)}% (${comparison.changes.size.formatted})`,
        threshold: this.thresholds.critical * 100
      });
    } else if (comparison.changes.size.percentage > this.thresholds.size * 100) {
      comparison.alerts.push({
        type: 'warning',
        category: 'size',
        message: `Bundle size increased by ${comparison.changes.size.percentage.toFixed(1)}% (${comparison.changes.size.formatted})`,
        threshold: this.thresholds.size * 100
      });
    }

    // Large file additions
    const largeNewFiles = comparison.changes.files
      .filter(f => f.type === 'added' && f.size > 50 * 1024); // 50KB threshold

    if (largeNewFiles.length > 0) {
      comparison.alerts.push({
        type: 'warning',
        category: 'files',
        message: `${largeNewFiles.length} large new files added (${largeNewFiles.map(f => f.name).join(', ')})`,
        files: largeNewFiles
      });
    }

    // Significant file size increases
    const significantIncreases = comparison.changes.files
      .filter(f => f.type === 'modified' && f.sizeChangePercent > 20); // 20% increase

    if (significantIncreases.length > 0) {
      comparison.alerts.push({
        type: 'warning',
        category: 'files',
        message: `${significantIncreases.length} files with significant size increases`,
        files: significantIncreases
      });
    }

    // New heavy dependencies
    const heavyNewDeps = comparison.changes.dependencies
      .filter(d => d.type === 'added' && d.size > 100 * 1024); // 100KB threshold

    if (heavyNewDeps.length > 0) {
      comparison.alerts.push({
        type: 'warning',
        category: 'dependencies',
        message: `${heavyNewDeps.length} heavy new dependencies added`,
        dependencies: heavyNewDeps
      });
    }
  }

  async generateComparisonReports(comparison) {
    console.log('📊 Generating comparison reports...');

    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    await this.generateJsonReport(comparison);
    await this.generateMarkdownReport(comparison);
    await this.generateTrendReport();
  }

  async generateJsonReport(comparison) {
    const reportPath = path.join(this.outputDir, 'bundle-comparison.json');
    fs.writeFileSync(reportPath, JSON.stringify(comparison, null, 2));
    console.log(`📄 JSON comparison saved to ${reportPath}`);
  }

  async generateMarkdownReport(comparison) {
    const markdown = `# Bundle Comparison Report

*Generated: ${comparison.timestamp}*

## Summary

### Overall Changes
- **Bundle Size:** ${this.formatSize(comparison.previous.totalSize)} → ${this.formatSize(comparison.current.totalSize)} (${comparison.changes.size.percentage > 0 ? '+' : ''}${comparison.changes.size.percentage.toFixed(1)}%)
- **File Count:** ${comparison.previous.fileCount} → ${comparison.current.fileCount}
- **Chunk Count:** ${comparison.previous.chunkCount} → ${comparison.current.chunkCount}

### Alerts
${comparison.alerts.length > 0 ? comparison.alerts.map(alert => `
${alert.type === 'critical' ? '🚨' : '⚠️'} **${alert.type.toUpperCase()}**: ${alert.message}
`).join('\n') : 'No alerts generated.'}

## File Changes

### Added Files (${comparison.changes.files.filter(f => f.type === 'added').length})
${comparison.changes.files.filter(f => f.type === 'added').slice(0, 10).map(f => `
- **${f.name}**: ${this.formatSize(f.size)}
`).join('') || 'None'}

### Removed Files (${comparison.changes.files.filter(f => f.type === 'removed').length})
${comparison.changes.files.filter(f => f.type === 'removed').slice(0, 10).map(f => `
- **${f.name}**: ${this.formatSize(f.size)} saved
`).join('') || 'None'}

### Modified Files (${comparison.changes.files.filter(f => f.type === 'modified').length})
${comparison.changes.files.filter(f => f.type === 'modified').slice(0, 10).map(f => `
- **${f.name}**: ${this.formatSize(f.previousSize)} → ${this.formatSize(f.currentSize)} (${f.sizeChangePercent > 0 ? '+' : ''}${f.sizeChangePercent}%)
`).join('') || 'None'}

## Chunk Changes

${comparison.changes.chunks.length > 0 ? comparison.changes.chunks.map(c => `
### ${c.type.charAt(0).toUpperCase() + c.type.slice(1)}: ${c.name}
${c.type === 'modified' ? `Size: ${this.formatSize(c.previousSize)} → ${this.formatSize(c.currentSize)} (${c.sizeChangePercent > 0 ? '+' : ''}${c.sizeChangePercent}%)` : `Size: ${this.formatSize(c.size)}`}
`).join('\n') : 'No chunk changes detected.'}

## Dependency Changes

${comparison.changes.dependencies.length > 0 ? comparison.changes.dependencies.map(d => `
### ${d.type.charAt(0).toUpperCase() + d.type.slice(1)}: ${d.name}
${d.type === 'updated' ? `Version: ${d.previousVersion} → ${d.currentVersion}` : `Version: ${d.version}`}
${d.sizeDiff !== undefined ? `Size impact: ${this.formatSizeChange(d.sizeDiff)}` : d.size ? `Size: ${this.formatSize(d.size)}` : ''}
`).join('\n') : 'No dependency changes detected.'}

## Recommendations

${this.generateRecommendations(comparison).map(rec => `
- ${rec}
`).join('')}
`;

    const reportPath = path.join(this.outputDir, 'bundle-comparison.md');
    fs.writeFileSync(reportPath, markdown);
    console.log(`📄 Markdown comparison saved to ${reportPath}`);
  }

  async generateTrendReport() {
    console.log('📈 Generating trend analysis...');

    if (!fs.existsSync(this.historyDir)) {
      return;
    }

    const historyFiles = fs.readdirSync(this.historyDir)
      .filter(file => file.endsWith('.json'))
      .sort()
      .slice(-10); // Last 10 builds

    const trendData = [];

    for (const file of historyFiles) {
      try {
        const analysis = JSON.parse(fs.readFileSync(path.join(this.historyDir, file), 'utf8'));
        trendData.push({
          timestamp: analysis.timestamp,
          totalSize: this.calculateTotalSize(analysis),
          fileCount: analysis.files.length,
          chunkCount: analysis.chunks?.length || 0
        });
      } catch (error) {
        console.warn(`Could not process history file ${file}: ${error.message}`);
      }
    }

    if (trendData.length < 2) {
      return;
    }

    const trendReport = {
      period: {
        start: trendData[0].timestamp,
        end: trendData[trendData.length - 1].timestamp,
        builds: trendData.length
      },
      trends: {
        size: this.calculateTrend(trendData.map(d => d.totalSize)),
        files: this.calculateTrend(trendData.map(d => d.fileCount)),
        chunks: this.calculateTrend(trendData.map(d => d.chunkCount))
      },
      data: trendData
    };

    const trendPath = path.join(this.outputDir, 'bundle-trends.json');
    fs.writeFileSync(trendPath, JSON.stringify(trendReport, null, 2));
    console.log(`📄 Trend analysis saved to ${trendPath}`);
  }

  calculateTrend(values) {
    if (values.length < 2) return { direction: 'stable', change: 0 };

    const first = values[0];
    const last = values[values.length - 1];
    const change = ((last - first) / first) * 100;

    return {
      direction: change > 5 ? 'increasing' : change < -5 ? 'decreasing' : 'stable',
      change: change.toFixed(2),
      average: (values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(0)
    };
  }

  generateRecommendations(comparison) {
    const recommendations = [];

    if (comparison.changes.size.percentage > 10) {
      recommendations.push('Consider reverting recent changes that significantly increased bundle size');
    }

    const largeAdditions = comparison.changes.files.filter(f => f.type === 'added' && f.size > 100 * 1024);
    if (largeAdditions.length > 0) {
      recommendations.push('Review large new files for optimization opportunities');
    }

    const newHeavyDeps = comparison.changes.dependencies.filter(d => d.type === 'added' && d.size > 100 * 1024);
    if (newHeavyDeps.length > 0) {
      recommendations.push('Consider lighter alternatives for newly added heavy dependencies');
    }

    if (comparison.alerts.some(a => a.type === 'critical')) {
      recommendations.push('Critical size increase detected - immediate review recommended');
    }

    return recommendations.length > 0 ? recommendations : ['Bundle size changes are within acceptable thresholds'];
  }

  calculateTotalSize(analysis) {
    return analysis.files.reduce((sum, file) => sum + file.size, 0);
  }

  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  formatSizeChange(bytes) {
    const formatted = this.formatSize(Math.abs(bytes));
    return bytes > 0 ? `+${formatted}` : `-${formatted}`;
  }
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  let currentPath = null;
  let previousPath = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.replace('--', '');
      const value = args[i + 1];

      if (key === 'history-dir') options.historyDir = value;
      else if (key === 'output-dir') options.outputDir = value;
      else if (key === 'previous') previousPath = value;
      i++; // Skip the value
    } else if (!currentPath) {
      currentPath = arg;
    }
  }

  if (!currentPath) {
    currentPath = path.join(process.cwd(), 'bundle-analysis', 'bundle-analysis.json');
  }

  const comparison = new BundleComparison(options);

  comparison.compare(currentPath, previousPath)
    .then(result => {
      console.log('\n📊 Comparison Summary:');
      if (result.previous) {
        console.log(`Size change: ${result.changes.size.formatted} (${result.changes.size.percentage.toFixed(1)}%)`);
        console.log(`File changes: +${result.changes.files.filter(f => f.type === 'added').length} -${result.changes.files.filter(f => f.type === 'removed').length}`);
        console.log(`Alerts: ${result.alerts.length}`);

        if (result.alerts.some(a => a.type === 'critical')) {
          process.exit(1);
        }
      } else {
        console.log('Baseline analysis saved');
      }
    })
    .catch(error => {
      console.error('❌ Comparison failed:', error.message);
      process.exit(1);
    });
}

module.exports = BundleComparison;