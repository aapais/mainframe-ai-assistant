#!/usr/bin/env node

/**
 * Bundle Performance Analysis Script
 * Analyzes bundle sizes, chunk splitting effectiveness, and loading performance
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class BundlePerformanceAnalyzer {
  constructor() {
    this.distPath = path.join(process.cwd(), 'dist');
    this.rendererPath = path.join(this.distPath, 'renderer');
    this.analysisResults = {
      timestamp: new Date().toISOString(),
      bundles: {},
      chunks: {},
      assets: {},
      recommendations: [],
      performance: {
        totalSize: 0,
        gzippedSize: 0,
        loadingTime: {
          fast3g: 0,
          slow3g: 0,
          regular4g: 0
        },
        cacheEfficiency: 0
      }
    };
  }

  async analyze() {
    console.log('🔍 Starting Bundle Performance Analysis...\n');

    try {
      await this.analyzeDistribution();
      await this.analyzeChunkSplitting();
      await this.analyzeAssetOptimization();
      await this.calculatePerformanceMetrics();
      await this.generateRecommendations();
      await this.generateReport();

      console.log('✅ Bundle analysis complete!');
      console.log(`📊 Report generated: bundle-performance-report.json`);

    } catch (error) {
      console.error('❌ Analysis failed:', error.message);
      process.exit(1);
    }
  }

  async analyzeDistribution() {
    console.log('📦 Analyzing bundle distribution...');

    if (!fs.existsSync(this.rendererPath)) {
      throw new Error('Renderer build not found. Run npm run build first.');
    }

    const files = this.getFilesRecursive(this.rendererPath);

    for (const file of files) {
      const relativePath = path.relative(this.rendererPath, file);
      const stats = fs.statSync(file);
      const ext = path.extname(file);

      if (['.js', '.css', '.html'].includes(ext)) {
        const content = fs.readFileSync(file, 'utf8');
        const gzippedSize = this.estimateGzipSize(content);

        this.analysisResults.bundles[relativePath] = {
          size: stats.size,
          gzippedSize,
          type: this.categorizeFile(relativePath),
          isMainBundle: relativePath.includes('index') || relativePath.includes('main'),
          isVendor: relativePath.includes('vendor') || relativePath.includes('node_modules'),
          isLazy: relativePath.includes('lazy') || relativePath.includes('chunk'),
          compressionRatio: stats.size > 0 ? gzippedSize / stats.size : 0
        };

        this.analysisResults.performance.totalSize += stats.size;
        this.analysisResults.performance.gzippedSize += gzippedSize;
      }
    }

    console.log(`   Found ${Object.keys(this.analysisResults.bundles).length} bundles`);
    console.log(`   Total size: ${this.formatSize(this.analysisResults.performance.totalSize)}`);
    console.log(`   Gzipped size: ${this.formatSize(this.analysisResults.performance.gzippedSize)}`);
  }

  async analyzeChunkSplitting() {
    console.log('🧩 Analyzing chunk splitting strategy...');

    const bundles = this.analysisResults.bundles;
    const chunks = {
      vendor: [],
      main: [],
      lazy: [],
      other: []
    };

    for (const [file, info] of Object.entries(bundles)) {
      if (info.isVendor) {
        chunks.vendor.push({ file, ...info });
      } else if (info.isMainBundle) {
        chunks.main.push({ file, ...info });
      } else if (info.isLazy) {
        chunks.lazy.push({ file, ...info });
      } else {
        chunks.other.push({ file, ...info });
      }
    }

    this.analysisResults.chunks = {
      vendor: {
        count: chunks.vendor.length,
        totalSize: chunks.vendor.reduce((sum, chunk) => sum + chunk.size, 0),
        files: chunks.vendor
      },
      main: {
        count: chunks.main.length,
        totalSize: chunks.main.reduce((sum, chunk) => sum + chunk.size, 0),
        files: chunks.main
      },
      lazy: {
        count: chunks.lazy.length,
        totalSize: chunks.lazy.reduce((sum, chunk) => sum + chunk.size, 0),
        files: chunks.lazy
      },
      other: {
        count: chunks.other.length,
        totalSize: chunks.other.reduce((sum, chunk) => sum + chunk.size, 0),
        files: chunks.other
      }
    };

    console.log(`   Vendor chunks: ${chunks.vendor.length} (${this.formatSize(this.analysisResults.chunks.vendor.totalSize)})`);
    console.log(`   Main chunks: ${chunks.main.length} (${this.formatSize(this.analysisResults.chunks.main.totalSize)})`);
    console.log(`   Lazy chunks: ${chunks.lazy.length} (${this.formatSize(this.analysisResults.chunks.lazy.totalSize)})`);
  }

  async analyzeAssetOptimization() {
    console.log('🖼️ Analyzing asset optimization...');

    const assets = {
      images: [],
      fonts: [],
      other: []
    };

    const assetFiles = this.getFilesRecursive(this.rendererPath)
      .filter(file => {
        const ext = path.extname(file);
        return ['.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp', '.woff', '.woff2', '.ttf'].includes(ext);
      });

    for (const file of assetFiles) {
      const relativePath = path.relative(this.rendererPath, file);
      const stats = fs.statSync(file);
      const ext = path.extname(file);

      const assetInfo = {
        file: relativePath,
        size: stats.size,
        type: ext,
        optimized: this.isAssetOptimized(file, ext)
      };

      if (['.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp'].includes(ext)) {
        assets.images.push(assetInfo);
      } else if (['.woff', '.woff2', '.ttf'].includes(ext)) {
        assets.fonts.push(assetInfo);
      } else {
        assets.other.push(assetInfo);
      }
    }

    this.analysisResults.assets = assets;

    const totalAssetSize = [...assets.images, ...assets.fonts, ...assets.other]
      .reduce((sum, asset) => sum + asset.size, 0);

    console.log(`   Images: ${assets.images.length} (${this.formatSize(assets.images.reduce((sum, img) => sum + img.size, 0))})`);
    console.log(`   Fonts: ${assets.fonts.length} (${this.formatSize(assets.fonts.reduce((sum, font) => sum + font.size, 0))})`);
    console.log(`   Total assets: ${this.formatSize(totalAssetSize)}`);
  }

  async calculatePerformanceMetrics() {
    console.log('⚡ Calculating performance metrics...');

    const totalGzippedSize = this.analysisResults.performance.gzippedSize;

    // Estimate loading times for different connection speeds (in seconds)
    const connectionSpeeds = {
      slow3g: 400 * 1024, // 400 KB/s
      fast3g: 1.6 * 1024 * 1024, // 1.6 MB/s
      regular4g: 10 * 1024 * 1024 // 10 MB/s
    };

    this.analysisResults.performance.loadingTime = {
      slow3g: totalGzippedSize / connectionSpeeds.slow3g,
      fast3g: totalGzippedSize / connectionSpeeds.fast3g,
      regular4g: totalGzippedSize / connectionSpeeds.regular4g
    };

    // Calculate cache efficiency based on chunk splitting
    const lazyChunkSize = this.analysisResults.chunks.lazy.totalSize;
    const totalSize = this.analysisResults.performance.totalSize;
    this.analysisResults.performance.cacheEfficiency = totalSize > 0 ? (lazyChunkSize / totalSize) * 100 : 0;

    console.log(`   Loading time (Regular 4G): ${this.analysisResults.performance.loadingTime.regular4g.toFixed(2)}s`);
    console.log(`   Loading time (Fast 3G): ${this.analysisResults.performance.loadingTime.fast3g.toFixed(2)}s`);
    console.log(`   Cache efficiency: ${this.analysisResults.performance.cacheEfficiency.toFixed(1)}%`);
  }

  async generateRecommendations() {
    console.log('💡 Generating optimization recommendations...');

    const recommendations = [];
    const performance = this.analysisResults.performance;
    const chunks = this.analysisResults.chunks;

    // Bundle size recommendations
    if (performance.totalSize > 5 * 1024 * 1024) { // 5MB
      recommendations.push({
        type: 'bundle-size',
        priority: 'high',
        message: `Total bundle size (${this.formatSize(performance.totalSize)}) exceeds 5MB. Consider more aggressive code splitting.`
      });
    }

    if (performance.gzippedSize > 2 * 1024 * 1024) { // 2MB
      recommendations.push({
        type: 'gzip-size',
        priority: 'medium',
        message: `Gzipped size (${this.formatSize(performance.gzippedSize)}) is large. Review dependencies and consider lazy loading.`
      });
    }

    // Main bundle recommendations
    if (chunks.main.totalSize > 1 * 1024 * 1024) { // 1MB
      recommendations.push({
        type: 'main-bundle',
        priority: 'high',
        message: `Main bundle (${this.formatSize(chunks.main.totalSize)}) is too large. Split into smaller chunks.`
      });
    }

    // Vendor bundle recommendations
    if (chunks.vendor.totalSize > 2 * 1024 * 1024) { // 2MB
      recommendations.push({
        type: 'vendor-bundle',
        priority: 'medium',
        message: `Vendor bundle (${this.formatSize(chunks.vendor.totalSize)}) is large. Consider splitting by usage frequency.`
      });
    }

    // Loading time recommendations
    if (performance.loadingTime.fast3g > 10) { // 10 seconds
      recommendations.push({
        type: 'loading-time',
        priority: 'high',
        message: `Loading time on Fast 3G (${performance.loadingTime.fast3g.toFixed(1)}s) is too slow. Implement progressive loading.`
      });
    }

    // Cache efficiency recommendations
    if (performance.cacheEfficiency < 30) {
      recommendations.push({
        type: 'cache-efficiency',
        priority: 'medium',
        message: `Cache efficiency (${performance.cacheEfficiency.toFixed(1)}%) is low. Increase code splitting for better caching.`
      });
    }

    // Asset optimization recommendations
    const unoptimizedImages = this.analysisResults.assets.images.filter(img => !img.optimized);
    if (unoptimizedImages.length > 0) {
      recommendations.push({
        type: 'image-optimization',
        priority: 'medium',
        message: `${unoptimizedImages.length} images are not optimized. Consider using WebP format and compression.`
      });
    }

    // Check for duplicate dependencies
    const duplicates = this.findDuplicateDependencies();
    if (duplicates.length > 0) {
      recommendations.push({
        type: 'duplicate-dependencies',
        priority: 'medium',
        message: `Found ${duplicates.length} potential duplicate dependencies. Review and deduplicate.`
      });
    }

    this.analysisResults.recommendations = recommendations;

    console.log(`   Generated ${recommendations.length} recommendations`);
    recommendations.forEach(rec => {
      const icon = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
      console.log(`   ${icon} ${rec.message}`);
    });
  }

  async generateReport() {
    const report = {
      ...this.analysisResults,
      summary: {
        totalBundles: Object.keys(this.analysisResults.bundles).length,
        totalSize: this.formatSize(this.analysisResults.performance.totalSize),
        gzippedSize: this.formatSize(this.analysisResults.performance.gzippedSize),
        compressionRatio: (this.analysisResults.performance.gzippedSize / this.analysisResults.performance.totalSize * 100).toFixed(1) + '%',
        loadingTime4G: this.analysisResults.performance.loadingTime.regular4g.toFixed(2) + 's',
        cacheEfficiency: this.analysisResults.performance.cacheEfficiency.toFixed(1) + '%',
        highPriorityRecommendations: this.analysisResults.recommendations.filter(r => r.priority === 'high').length,
        overallScore: this.calculateOverallScore()
      }
    };

    fs.writeFileSync(
      path.join(process.cwd(), 'bundle-performance-report.json'),
      JSON.stringify(report, null, 2)
    );

    // Generate markdown report
    const markdownReport = this.generateMarkdownReport(report);
    fs.writeFileSync(
      path.join(process.cwd(), 'docs/bundle-performance-report.md'),
      markdownReport
    );
  }

  calculateOverallScore() {
    let score = 100;
    const recommendations = this.analysisResults.recommendations;

    // Deduct points based on recommendations
    recommendations.forEach(rec => {
      switch (rec.priority) {
        case 'high':
          score -= 20;
          break;
        case 'medium':
          score -= 10;
          break;
        case 'low':
          score -= 5;
          break;
      }
    });

    return Math.max(0, score);
  }

  generateMarkdownReport(report) {
    return `# Bundle Performance Analysis Report

Generated: ${new Date(report.timestamp).toLocaleString()}

## Summary

- **Overall Score**: ${report.summary.overallScore}/100
- **Total Bundles**: ${report.summary.totalBundles}
- **Total Size**: ${report.summary.totalSize}
- **Gzipped Size**: ${report.summary.gzippedSize}
- **Compression Ratio**: ${report.summary.compressionRatio}
- **Loading Time (4G)**: ${report.summary.loadingTime4G}
- **Cache Efficiency**: ${report.summary.cacheEfficiency}

## Performance Metrics

### Loading Times
- **Regular 4G**: ${report.performance.loadingTime.regular4g.toFixed(2)}s
- **Fast 3G**: ${report.performance.loadingTime.fast3g.toFixed(2)}s
- **Slow 3G**: ${report.performance.loadingTime.slow3g.toFixed(2)}s

### Bundle Distribution
${this.generateChunkTable(report.chunks)}

## Recommendations (${report.recommendations.length} total)

${report.recommendations.map(rec => {
  const icon = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
  return `### ${icon} ${rec.type.toUpperCase()} (${rec.priority} priority)\n${rec.message}`;
}).join('\n\n')}

## Detailed Analysis

### Asset Optimization
- **Images**: ${report.assets.images.length} files
- **Fonts**: ${report.assets.fonts.length} files
- **Other Assets**: ${report.assets.other.length} files

### Bundle Files
${Object.entries(report.bundles).map(([file, info]) =>
  `- **${file}**: ${this.formatSize(info.size)} (${this.formatSize(info.gzippedSize)} gzipped)`
).join('\n')}

---
*Report generated by Bundle Performance Analyzer*
`;
  }

  generateChunkTable(chunks) {
    return `
| Chunk Type | Count | Total Size | Average Size |
|------------|-------|------------|--------------|
| Main | ${chunks.main.count} | ${this.formatSize(chunks.main.totalSize)} | ${this.formatSize(chunks.main.totalSize / Math.max(chunks.main.count, 1))} |
| Vendor | ${chunks.vendor.count} | ${this.formatSize(chunks.vendor.totalSize)} | ${this.formatSize(chunks.vendor.totalSize / Math.max(chunks.vendor.count, 1))} |
| Lazy | ${chunks.lazy.count} | ${this.formatSize(chunks.lazy.totalSize)} | ${this.formatSize(chunks.lazy.totalSize / Math.max(chunks.lazy.count, 1))} |
| Other | ${chunks.other.count} | ${this.formatSize(chunks.other.totalSize)} | ${this.formatSize(chunks.other.totalSize / Math.max(chunks.other.count, 1))} |
`;
  }

  // Helper methods
  getFilesRecursive(dir) {
    const files = [];

    if (!fs.existsSync(dir)) return files;

    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...this.getFilesRecursive(fullPath));
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }

  estimateGzipSize(content) {
    // Rough estimation: typical compression ratio is 3-4x for text files
    return Math.floor(content.length / 3.5);
  }

  categorizeFile(filename) {
    if (filename.includes('.js')) return 'javascript';
    if (filename.includes('.css')) return 'stylesheet';
    if (filename.includes('.html')) return 'markup';
    if (filename.match(/\.(png|jpg|jpeg|svg|gif|webp)$/)) return 'image';
    if (filename.match(/\.(woff|woff2|ttf)$/)) return 'font';
    return 'other';
  }

  isAssetOptimized(file, ext) {
    // Simple heuristics for asset optimization
    const stats = fs.statSync(file);

    if (['.png', '.jpg', '.jpeg'].includes(ext)) {
      return stats.size < 100 * 1024; // Consider optimized if < 100KB
    }

    if (ext === '.svg') {
      const content = fs.readFileSync(file, 'utf8');
      return !content.includes('<!--') && content.length < 10 * 1024; // No comments, < 10KB
    }

    if (['.woff', '.woff2'].includes(ext)) {
      return stats.size < 200 * 1024; // Consider optimized if < 200KB
    }

    return true;
  }

  findDuplicateDependencies() {
    // This is a simplified implementation
    // In a real scenario, you'd analyze the actual bundle content
    return [];
  }

  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
  }
}

// CLI interface
if (require.main === module) {
  const analyzer = new BundlePerformanceAnalyzer();

  analyzer.analyze().catch(error => {
    console.error('Analysis failed:', error);
    process.exit(1);
  });
}

module.exports = BundlePerformanceAnalyzer;