#!/usr/bin/env node
/**
 * Bundle Size Analyzer - Comprehensive bundle analysis and optimization tool
 * Integrates with Vite build system for detailed bundle insights
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const gzipSize = require('gzip-size');
const brotliSize = require('brotli-size');

class BundleAnalyzer {
  constructor(options = {}) {
    this.distDir = options.distDir || 'dist';
    this.outputDir = options.outputDir || 'bundle-analysis';
    this.budgets = options.budgets || {
      maxBundleSize: 1024 * 1024, // 1MB
      maxInitialSize: 512 * 1024,  // 512KB
      maxChunkSize: 256 * 1024     // 256KB
    };
    this.results = {
      timestamp: new Date().toISOString(),
      files: [],
      chunks: [],
      dependencies: new Map(),
      warnings: [],
      recommendations: []
    };
  }

  async analyze() {
    console.log('🔍 Starting comprehensive bundle analysis...');

    // Ensure build exists
    await this.ensureBuild();

    // Analyze all bundle files
    await this.analyzeFiles();

    // Analyze chunks and code splitting
    await this.analyzeChunks();

    // Analyze dependencies
    await this.analyzeDependencies();

    // Check tree-shaking effectiveness
    await this.analyzeTreeShaking();

    // Detect dead code
    await this.detectDeadCode();

    // Generate recommendations
    this.generateRecommendations();

    // Check budgets
    this.checkBudgets();

    // Save results
    await this.saveResults();

    // Generate reports
    await this.generateReports();

    console.log('✅ Bundle analysis complete!');
    return this.results;
  }

  async ensureBuild() {
    if (!fs.existsSync(this.distDir)) {
      console.log('📦 Building project...');
      try {
        execSync('npm run build', { stdio: 'inherit' });
      } catch (error) {
        throw new Error(`Build failed: ${error.message}`);
      }
    }
  }

  async analyzeFiles() {
    console.log('📊 Analyzing bundle files...');

    const files = this.getAllFiles(this.distDir);

    for (const file of files) {
      const filePath = path.join(this.distDir, file);
      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath);

      const analysis = {
        name: file,
        path: filePath,
        size: stats.size,
        gzipSize: await gzipSize(content),
        brotliSize: await brotliSize(content),
        type: this.getFileType(file),
        isEntry: this.isEntryFile(file),
        isChunk: this.isChunkFile(file)
      };

      // Add compression ratios
      analysis.gzipRatio = (analysis.gzipSize / analysis.size * 100).toFixed(1);
      analysis.brotliRatio = (analysis.brotliSize / analysis.size * 100).toFixed(1);

      this.results.files.push(analysis);
    }

    // Sort by size
    this.results.files.sort((a, b) => b.size - a.size);
  }

  async analyzeChunks() {
    console.log('🧩 Analyzing chunk splitting...');

    const manifestPath = path.join(this.distDir, '.vite', 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      for (const [key, entry] of Object.entries(manifest)) {
        const chunk = {
          name: key,
          file: entry.file,
          isEntry: entry.isEntry || false,
          isDynamicEntry: entry.isDynamicEntry || false,
          imports: entry.imports || [],
          dynamicImports: entry.dynamicImports || [],
          css: entry.css || [],
          assets: entry.assets || []
        };

        // Get file size info
        const filePath = path.join(this.distDir, entry.file);
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          chunk.size = stats.size;
        }

        this.results.chunks.push(chunk);
      }
    }
  }

  async analyzeDependencies() {
    console.log('📦 Analyzing dependencies...');

    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      for (const [name, version] of Object.entries(deps)) {
        try {
          const depPackagePath = path.join(process.cwd(), 'node_modules', name, 'package.json');
          if (fs.existsSync(depPackagePath)) {
            const depPackage = JSON.parse(fs.readFileSync(depPackagePath, 'utf8'));

            this.results.dependencies.set(name, {
              version,
              installedVersion: depPackage.version,
              description: depPackage.description,
              license: depPackage.license,
              size: await this.getDependencySize(name),
              usage: this.findDependencyUsage(name)
            });
          }
        } catch (error) {
          console.warn(`Could not analyze dependency ${name}: ${error.message}`);
        }
      }
    }
  }

  async analyzeTreeShaking() {
    console.log('🌳 Analyzing tree-shaking effectiveness...');

    // Look for unused exports in built files
    const jsFiles = this.results.files.filter(f => f.type === 'js');

    for (const file of jsFiles) {
      const content = fs.readFileSync(file.path, 'utf8');

      // Check for common patterns that indicate poor tree-shaking
      const patterns = [
        /export\s*{[^}]*}/g, // Named exports
        /export\s+default/g,  // Default exports
        /import\s*{[^}]*}/g,  // Named imports
        /import\s+\w+/g       // Default imports
      ];

      let exportCount = 0;
      let importCount = 0;

      patterns.forEach((pattern, index) => {
        const matches = content.match(pattern) || [];
        if (index < 2) exportCount += matches.length;
        else importCount += matches.length;
      });

      file.treeShaking = {
        exportCount,
        importCount,
        ratio: importCount > 0 ? (exportCount / importCount * 100).toFixed(1) : 'N/A'
      };
    }
  }

  async detectDeadCode() {
    console.log('💀 Detecting dead code...');

    const srcDir = path.join(process.cwd(), 'src');
    if (fs.existsSync(srcDir)) {
      const sourceFiles = this.getAllFiles(srcDir, '.ts', '.tsx', '.js', '.jsx');
      const bundledContent = this.results.files
        .filter(f => f.type === 'js')
        .map(f => fs.readFileSync(f.path, 'utf8'))
        .join('\n');

      const unusedFiles = [];
      const unusedFunctions = [];

      for (const file of sourceFiles) {
        const filePath = path.join(srcDir, file);
        const content = fs.readFileSync(filePath, 'utf8');

        // Extract function/component names
        const functionMatches = content.match(/(?:export\s+)?(?:function|const|class)\s+(\w+)/g) || [];

        for (const match of functionMatches) {
          const functionName = match.split(/\s+/).pop();
          if (functionName && !bundledContent.includes(functionName)) {
            unusedFunctions.push({ file, function: functionName });
          }
        }

        // Check if entire file is referenced
        const fileName = path.basename(file, path.extname(file));
        if (!bundledContent.includes(fileName)) {
          unusedFiles.push(file);
        }
      }

      this.results.deadCode = { unusedFiles, unusedFunctions };
    }
  }

  generateRecommendations() {
    console.log('💡 Generating optimization recommendations...');

    const recommendations = [];

    // Large file recommendations
    const largeFiles = this.results.files.filter(f => f.size > 100 * 1024); // 100KB
    if (largeFiles.length > 0) {
      recommendations.push({
        type: 'size',
        priority: 'high',
        title: 'Large Files Detected',
        description: `${largeFiles.length} files are larger than 100KB`,
        files: largeFiles.map(f => ({ name: f.name, size: f.size })),
        suggestion: 'Consider code splitting or lazy loading for these files'
      });
    }

    // Compression recommendations
    const poorCompression = this.results.files.filter(f => parseFloat(f.gzipRatio) > 70);
    if (poorCompression.length > 0) {
      recommendations.push({
        type: 'compression',
        priority: 'medium',
        title: 'Poor Compression Detected',
        description: `${poorCompression.length} files have poor gzip compression`,
        files: poorCompression.map(f => ({ name: f.name, ratio: f.gzipRatio })),
        suggestion: 'These files may contain repetitive code or could benefit from minification'
      });
    }

    // Dependencies recommendations
    const largeDeps = Array.from(this.results.dependencies.entries())
      .filter(([_, dep]) => dep.size > 50 * 1024) // 50KB
      .sort((a, b) => b[1].size - a[1].size);

    if (largeDeps.length > 0) {
      recommendations.push({
        type: 'dependencies',
        priority: 'high',
        title: 'Large Dependencies',
        description: `${largeDeps.length} dependencies are larger than 50KB`,
        dependencies: largeDeps.slice(0, 5).map(([name, dep]) => ({ name, size: dep.size })),
        suggestion: 'Consider lighter alternatives or dynamic imports for these dependencies'
      });
    }

    this.results.recommendations = recommendations;
  }

  checkBudgets() {
    console.log('💰 Checking size budgets...');

    const warnings = [];

    // Check total bundle size
    const totalSize = this.results.files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > this.budgets.maxBundleSize) {
      warnings.push({
        type: 'budget',
        level: 'error',
        message: `Total bundle size (${this.formatSize(totalSize)}) exceeds budget (${this.formatSize(this.budgets.maxBundleSize)})`
      });
    }

    // Check initial chunk size
    const initialChunks = this.results.chunks.filter(c => c.isEntry);
    const initialSize = initialChunks.reduce((sum, chunk) => sum + (chunk.size || 0), 0);
    if (initialSize > this.budgets.maxInitialSize) {
      warnings.push({
        type: 'budget',
        level: 'warning',
        message: `Initial bundle size (${this.formatSize(initialSize)}) exceeds budget (${this.formatSize(this.budgets.maxInitialSize)})`
      });
    }

    // Check individual chunk sizes
    const largeChunks = this.results.chunks.filter(c => c.size > this.budgets.maxChunkSize);
    if (largeChunks.length > 0) {
      warnings.push({
        type: 'budget',
        level: 'warning',
        message: `${largeChunks.length} chunks exceed size budget (${this.formatSize(this.budgets.maxChunkSize)})`
      });
    }

    this.results.warnings = warnings;
  }

  async saveResults() {
    console.log('💾 Saving analysis results...');

    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    // Convert Map to object for JSON serialization
    const resultsForJson = {
      ...this.results,
      dependencies: Object.fromEntries(this.results.dependencies)
    };

    const outputPath = path.join(this.outputDir, 'bundle-analysis.json');
    fs.writeFileSync(outputPath, JSON.stringify(resultsForJson, null, 2));

    console.log(`📄 Results saved to ${outputPath}`);
  }

  async generateReports() {
    console.log('📊 Generating reports...');

    // Generate HTML report
    await this.generateHtmlReport();

    // Generate CSV for tracking
    await this.generateCsvReport();

    // Generate markdown summary
    await this.generateMarkdownReport();
  }

  async generateHtmlReport() {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Bundle Analysis Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .metric { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 4px; }
        .warning { background: #fff3cd; border-left: 4px solid #ffc107; }
        .error { background: #f8d7da; border-left: 4px solid #dc3545; }
        .recommendation { background: #d1ecf1; border-left: 4px solid #17a2b8; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .size { text-align: right; }
    </style>
</head>
<body>
    <h1>Bundle Analysis Report</h1>
    <p>Generated: ${this.results.timestamp}</p>

    <h2>Summary</h2>
    <div class="metric">
        <strong>Total Files:</strong> ${this.results.files.length}<br>
        <strong>Total Size:</strong> ${this.formatSize(this.results.files.reduce((sum, f) => sum + f.size, 0))}<br>
        <strong>Total Gzipped:</strong> ${this.formatSize(this.results.files.reduce((sum, f) => sum + f.gzipSize, 0))}<br>
        <strong>Dependencies:</strong> ${this.results.dependencies.size}
    </div>

    ${this.results.warnings.map(w => `
        <div class="metric ${w.level}">
            <strong>${w.type.toUpperCase()}:</strong> ${w.message}
        </div>
    `).join('')}

    <h2>File Analysis</h2>
    <table>
        <tr>
            <th>File</th>
            <th>Type</th>
            <th class="size">Size</th>
            <th class="size">Gzipped</th>
            <th class="size">Compression</th>
        </tr>
        ${this.results.files.map(f => `
            <tr>
                <td>${f.name}</td>
                <td>${f.type}</td>
                <td class="size">${this.formatSize(f.size)}</td>
                <td class="size">${this.formatSize(f.gzipSize)}</td>
                <td class="size">${f.gzipRatio}%</td>
            </tr>
        `).join('')}
    </table>

    <h2>Recommendations</h2>
    ${this.results.recommendations.map(r => `
        <div class="metric recommendation">
            <strong>${r.title}</strong> (${r.priority})<br>
            ${r.description}<br>
            <em>${r.suggestion}</em>
        </div>
    `).join('')}
</body>
</html>`;

    const htmlPath = path.join(this.outputDir, 'bundle-report.html');
    fs.writeFileSync(htmlPath, html);
    console.log(`📄 HTML report saved to ${htmlPath}`);
  }

  async generateCsvReport() {
    const csv = [
      'File,Type,Size,Gzipped,Compression Ratio',
      ...this.results.files.map(f =>
        `${f.name},${f.type},${f.size},${f.gzipSize},${f.gzipRatio}%`
      )
    ].join('\n');

    const csvPath = path.join(this.outputDir, 'bundle-analysis.csv');
    fs.writeFileSync(csvPath, csv);
    console.log(`📄 CSV report saved to ${csvPath}`);
  }

  async generateMarkdownReport() {
    const totalSize = this.results.files.reduce((sum, f) => sum + f.size, 0);
    const totalGzipped = this.results.files.reduce((sum, f) => sum + f.gzipSize, 0);

    const markdown = `# Bundle Analysis Report

*Generated: ${this.results.timestamp}*

## Summary

- **Total Files:** ${this.results.files.length}
- **Total Size:** ${this.formatSize(totalSize)}
- **Total Gzipped:** ${this.formatSize(totalGzipped)}
- **Compression Ratio:** ${(totalGzipped / totalSize * 100).toFixed(1)}%
- **Dependencies:** ${this.results.dependencies.size}

## Warnings

${this.results.warnings.map(w => `- **${w.type.toUpperCase()}:** ${w.message}`).join('\n') || 'No warnings'}

## Top 10 Largest Files

| File | Type | Size | Gzipped | Compression |
|------|------|------|---------|-------------|
${this.results.files.slice(0, 10).map(f =>
  `| ${f.name} | ${f.type} | ${this.formatSize(f.size)} | ${this.formatSize(f.gzipSize)} | ${f.gzipRatio}% |`
).join('\n')}

## Recommendations

${this.results.recommendations.map(r => `### ${r.title} (${r.priority})

${r.description}

*${r.suggestion}*`).join('\n\n') || 'No recommendations'}
`;

    const mdPath = path.join(this.outputDir, 'bundle-report.md');
    fs.writeFileSync(mdPath, markdown);
    console.log(`📄 Markdown report saved to ${mdPath}`);
  }

  // Helper methods
  getAllFiles(dir, ...extensions) {
    const files = [];
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...this.getAllFiles(fullPath, ...extensions).map(f => path.join(item, f)));
      } else if (extensions.length === 0 || extensions.some(ext => item.endsWith(ext))) {
        files.push(item);
      }
    }

    return files;
  }

  getFileType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const typeMap = {
      '.js': 'js',
      '.mjs': 'js',
      '.css': 'css',
      '.html': 'html',
      '.json': 'json',
      '.svg': 'svg',
      '.png': 'image',
      '.jpg': 'image',
      '.jpeg': 'image',
      '.gif': 'image',
      '.webp': 'image',
      '.woff': 'font',
      '.woff2': 'font',
      '.ttf': 'font',
      '.eot': 'font'
    };
    return typeMap[ext] || 'other';
  }

  isEntryFile(filename) {
    return filename.includes('index') || filename.includes('main') || filename.includes('entry');
  }

  isChunkFile(filename) {
    return /chunk|vendor|runtime/.test(filename);
  }

  async getDependencySize(name) {
    try {
      const depDir = path.join(process.cwd(), 'node_modules', name);
      const files = this.getAllFiles(depDir, '.js', '.mjs');
      let totalSize = 0;

      for (const file of files.slice(0, 10)) { // Limit to prevent long analysis
        const filePath = path.join(depDir, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;
      }

      return totalSize;
    } catch (error) {
      return 0;
    }
  }

  findDependencyUsage(name) {
    // Simple implementation - could be enhanced with AST parsing
    const srcDir = path.join(process.cwd(), 'src');
    if (fs.existsSync(srcDir)) {
      const files = this.getAllFiles(srcDir, '.ts', '.tsx', '.js', '.jsx');
      const usageCount = files.reduce((count, file) => {
        const content = fs.readFileSync(path.join(srcDir, file), 'utf8');
        const importPattern = new RegExp(`from\\s+['"]${name}['"]`, 'g');
        const requirePattern = new RegExp(`require\\s*\\(['"]${name}['"]\\)`, 'g');
        return count + (content.match(importPattern) || []).length + (content.match(requirePattern) || []).length;
      }, 0);
      return usageCount;
    }
    return 0;
  }

  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];

    if (key === 'dist-dir') options.distDir = value;
    else if (key === 'output-dir') options.outputDir = value;
    else if (key === 'max-bundle-size') options.budgets = { ...options.budgets, maxBundleSize: parseInt(value) };
  }

  const analyzer = new BundleAnalyzer(options);

  analyzer.analyze()
    .then(results => {
      console.log('\n📊 Analysis Summary:');
      console.log(`Total files: ${results.files.length}`);
      console.log(`Total size: ${analyzer.formatSize(results.files.reduce((sum, f) => sum + f.size, 0))}`);
      console.log(`Warnings: ${results.warnings.length}`);
      console.log(`Recommendations: ${results.recommendations.length}`);

      if (results.warnings.some(w => w.level === 'error')) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Analysis failed:', error.message);
      process.exit(1);
    });
}

module.exports = BundleAnalyzer;