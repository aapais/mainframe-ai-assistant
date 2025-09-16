#!/usr/bin/env node
/**
 * Dependency Size Report - Analyze and track dependency contribution to bundle size
 * Identifies heavy dependencies and suggests lighter alternatives
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class DependencySizeReporter {
  constructor(options = {}) {
    this.nodeModulesDir = options.nodeModulesDir || 'node_modules';
    this.outputDir = options.outputDir || 'bundle-analysis';
    this.packageJsonPath = options.packageJsonPath || 'package.json';
    this.alternatives = this.loadAlternatives();
    this.results = {
      timestamp: new Date().toISOString(),
      dependencies: [],
      totalSize: 0,
      heavyDependencies: [],
      alternatives: [],
      duplicates: [],
      unused: []
    };
  }

  async analyze() {
    console.log('📦 Starting dependency size analysis...');

    // Load package.json
    const packageData = await this.loadPackageData();

    // Analyze each dependency
    await this.analyzeDependencies(packageData);

    // Find duplicates
    await this.findDuplicates();

    // Find unused dependencies
    await this.findUnusedDependencies();

    // Suggest alternatives
    this.suggestAlternatives();

    // Generate reports
    await this.generateReports();

    console.log('✅ Dependency analysis complete!');
    return this.results;
  }

  async loadPackageData() {
    if (!fs.existsSync(this.packageJsonPath)) {
      throw new Error('package.json not found');
    }

    const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
    return {
      dependencies: packageJson.dependencies || {},
      devDependencies: packageJson.devDependencies || {},
      peerDependencies: packageJson.peerDependencies || {}
    };
  }

  async analyzeDependencies(packageData) {
    console.log('🔍 Analyzing individual dependencies...');

    const allDeps = {
      ...packageData.dependencies,
      ...packageData.devDependencies
    };

    for (const [name, version] of Object.entries(allDeps)) {
      try {
        const analysis = await this.analyzeDependency(name, version, packageData);
        this.results.dependencies.push(analysis);
        this.results.totalSize += analysis.totalSize;

        if (analysis.totalSize > 100 * 1024) { // 100KB threshold
          this.results.heavyDependencies.push(analysis);
        }
      } catch (error) {
        console.warn(`Could not analyze ${name}: ${error.message}`);
      }
    }

    // Sort by size
    this.results.dependencies.sort((a, b) => b.totalSize - a.totalSize);
    this.results.heavyDependencies.sort((a, b) => b.totalSize - a.totalSize);
  }

  async analyzeDependency(name, version, packageData) {
    const depPath = path.join(this.nodeModulesDir, name);
    const analysis = {
      name,
      version,
      type: this.getDependencyType(name, packageData),
      totalSize: 0,
      fileCount: 0,
      mainFile: '',
      hasTypes: false,
      license: '',
      description: '',
      bundledDependencies: [],
      largestFiles: []
    };

    if (fs.existsSync(depPath)) {
      // Get package info
      const depPackageJson = path.join(depPath, 'package.json');
      if (fs.existsSync(depPackageJson)) {
        const depPackage = JSON.parse(fs.readFileSync(depPackageJson, 'utf8'));
        analysis.license = depPackage.license || 'Unknown';
        analysis.description = depPackage.description || '';
        analysis.mainFile = depPackage.main || 'index.js';
        analysis.hasTypes = !!(depPackage.types || depPackage.typings);
        analysis.bundledDependencies = Object.keys(depPackage.dependencies || {});
      }

      // Calculate size
      const sizeData = await this.calculateDirectorySize(depPath);
      analysis.totalSize = sizeData.totalSize;
      analysis.fileCount = sizeData.fileCount;
      analysis.largestFiles = sizeData.largestFiles;
    }

    return analysis;
  }

  async calculateDirectorySize(dirPath, maxDepth = 3, currentDepth = 0) {
    let totalSize = 0;
    let fileCount = 0;
    const largestFiles = [];

    if (currentDepth >= maxDepth) {
      return { totalSize, fileCount, largestFiles };
    }

    try {
      const items = fs.readdirSync(dirPath);

      for (const item of items) {
        // Skip common directories that shouldn't be included in bundle
        if (['test', 'tests', '__tests__', 'spec', 'docs', 'examples', '.git'].includes(item)) {
          continue;
        }

        const itemPath = path.join(dirPath, item);
        const stats = fs.statSync(itemPath);

        if (stats.isDirectory()) {
          // Recursively calculate subdirectories
          const subData = await this.calculateDirectorySize(itemPath, maxDepth, currentDepth + 1);
          totalSize += subData.totalSize;
          fileCount += subData.fileCount;
          largestFiles.push(...subData.largestFiles);
        } else {
          // Only count relevant file types
          const ext = path.extname(item).toLowerCase();
          if (['.js', '.mjs', '.ts', '.jsx', '.tsx', '.json'].includes(ext)) {
            totalSize += stats.size;
            fileCount++;

            if (stats.size > 10 * 1024) { // Files larger than 10KB
              largestFiles.push({
                file: path.relative(this.nodeModulesDir, itemPath),
                size: stats.size
              });
            }
          }
        }
      }
    } catch (error) {
      // Handle permission errors or other issues
      console.warn(`Could not read directory ${dirPath}: ${error.message}`);
    }

    // Keep only top 5 largest files
    largestFiles.sort((a, b) => b.size - a.size);
    return {
      totalSize,
      fileCount,
      largestFiles: largestFiles.slice(0, 5)
    };
  }

  getDependencyType(name, packageData) {
    if (packageData.dependencies[name]) return 'production';
    if (packageData.devDependencies[name]) return 'development';
    if (packageData.peerDependencies[name]) return 'peer';
    return 'unknown';
  }

  async findDuplicates() {
    console.log('🔍 Finding duplicate dependencies...');

    const duplicates = new Map();

    // Scan all node_modules for version conflicts
    const scanDirectory = (dir, prefix = '') => {
      try {
        const items = fs.readdirSync(dir);

        for (const item of items) {
          if (item.startsWith('.')) continue;

          const itemPath = path.join(dir, item);
          const packageJsonPath = path.join(itemPath, 'package.json');

          if (fs.existsSync(packageJsonPath)) {
            try {
              const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
              const fullName = prefix ? `${prefix}/${item}` : item;

              if (!duplicates.has(packageJson.name)) {
                duplicates.set(packageJson.name, []);
              }

              duplicates.get(packageJson.name).push({
                name: fullName,
                version: packageJson.version,
                path: itemPath,
                size: 0 // Will be calculated if needed
              });

              // Recursively scan nested node_modules
              const nestedNodeModules = path.join(itemPath, 'node_modules');
              if (fs.existsSync(nestedNodeModules)) {
                scanDirectory(nestedNodeModules, fullName);
              }
            } catch (error) {
              // Skip invalid package.json files
            }
          }
        }
      } catch (error) {
        console.warn(`Could not scan directory ${dir}: ${error.message}`);
      }
    };

    scanDirectory(this.nodeModulesDir);

    // Filter to only actual duplicates
    for (const [name, versions] of duplicates.entries()) {
      if (versions.length > 1) {
        this.results.duplicates.push({
          name,
          versions: versions.map(v => ({ version: v.version, path: v.path })),
          potentialSavings: versions.length - 1 // Estimated savings in duplicate count
        });
      }
    }
  }

  async findUnusedDependencies() {
    console.log('🔍 Finding unused dependencies...');

    const srcDir = path.join(process.cwd(), 'src');
    if (!fs.existsSync(srcDir)) return;

    // Get all source files
    const sourceFiles = this.getAllFiles(srcDir, ['.ts', '.tsx', '.js', '.jsx']);
    const sourceContent = sourceFiles
      .map(file => fs.readFileSync(file, 'utf8'))
      .join('\n');

    // Check each dependency for usage
    for (const dep of this.results.dependencies) {
      if (dep.type === 'development') continue; // Skip dev dependencies

      const patterns = [
        new RegExp(`from\\s+['"]${dep.name}['"]`, 'g'),
        new RegExp(`import\\s+.*['"]${dep.name}['"]`, 'g'),
        new RegExp(`require\\s*\\(\\s*['"]${dep.name}['"]\\s*\\)`, 'g')
      ];

      const isUsed = patterns.some(pattern => pattern.test(sourceContent));

      if (!isUsed) {
        this.results.unused.push({
          name: dep.name,
          size: dep.totalSize,
          type: dep.type
        });
      }
    }
  }

  suggestAlternatives() {
    console.log('💡 Suggesting lighter alternatives...');

    for (const dep of this.results.heavyDependencies) {
      const alternatives = this.alternatives[dep.name];
      if (alternatives) {
        this.results.alternatives.push({
          current: {
            name: dep.name,
            size: dep.totalSize
          },
          alternatives: alternatives.map(alt => ({
            ...alt,
            potentialSavings: dep.totalSize - (alt.estimatedSize || 0)
          }))
        });
      }
    }
  }

  async generateReports() {
    console.log('📊 Generating reports...');

    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    await this.generateJsonReport();
    await this.generateMarkdownReport();
    await this.generateCsvReport();
  }

  async generateJsonReport() {
    const reportPath = path.join(this.outputDir, 'dependency-size-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`📄 JSON report saved to ${reportPath}`);
  }

  async generateMarkdownReport() {
    const markdown = `# Dependency Size Report

*Generated: ${this.results.timestamp}*

## Summary

- **Total Dependencies:** ${this.results.dependencies.length}
- **Total Size:** ${this.formatSize(this.results.totalSize)}
- **Heavy Dependencies (>100KB):** ${this.results.heavyDependencies.length}
- **Duplicates Found:** ${this.results.duplicates.length}
- **Unused Dependencies:** ${this.results.unused.length}

## Heavy Dependencies

${this.results.heavyDependencies.slice(0, 10).map(dep => `
### ${dep.name} (${this.formatSize(dep.totalSize)})
- **Type:** ${dep.type}
- **Files:** ${dep.fileCount}
- **License:** ${dep.license}
- **Description:** ${dep.description}
${dep.largestFiles.length > 0 ? `
**Largest Files:**
${dep.largestFiles.map(f => `- ${f.file}: ${this.formatSize(f.size)}`).join('\n')}
` : ''}
`).join('\n')}

## Duplicate Dependencies

${this.results.duplicates.length > 0 ? this.results.duplicates.map(dup => `
### ${dup.name}
${dup.versions.map(v => `- Version ${v.version} at ${v.path}`).join('\n')}
`).join('\n') : 'No duplicates found.'}

## Unused Dependencies

${this.results.unused.length > 0 ? this.results.unused.map(dep => `
- **${dep.name}** (${this.formatSize(dep.size)}) - ${dep.type}
`).join('\n') : 'No unused dependencies found.'}

## Suggested Alternatives

${this.results.alternatives.length > 0 ? this.results.alternatives.map(alt => `
### ${alt.current.name} → Alternatives
Current size: ${this.formatSize(alt.current.size)}

${alt.alternatives.map(a => `
- **${a.name}**: ${a.description}
  - Estimated size: ${this.formatSize(a.estimatedSize || 0)}
  - Potential savings: ${this.formatSize(a.potentialSavings || 0)}
  - Trade-offs: ${a.tradeoffs || 'None noted'}
`).join('\n')}
`).join('\n') : 'No alternatives suggested.'}

## Recommendations

1. **Remove unused dependencies** to save ${this.formatSize(this.results.unused.reduce((sum, dep) => sum + dep.size, 0))}
2. **Resolve duplicates** to potentially reduce bundle size
3. **Consider alternatives** for heavy dependencies
4. **Use dynamic imports** for large dependencies that aren't always needed
5. **Review bundled dependencies** of heavy packages
`;

    const reportPath = path.join(this.outputDir, 'dependency-size-report.md');
    fs.writeFileSync(reportPath, markdown);
    console.log(`📄 Markdown report saved to ${reportPath}`);
  }

  async generateCsvReport() {
    const csv = [
      'Name,Type,Size,FileCount,License,Description',
      ...this.results.dependencies.map(dep =>
        `"${dep.name}","${dep.type}",${dep.totalSize},${dep.fileCount},"${dep.license}","${dep.description.replace(/"/g, '""')}"`
      )
    ].join('\n');

    const reportPath = path.join(this.outputDir, 'dependency-sizes.csv');
    fs.writeFileSync(reportPath, csv);
    console.log(`📄 CSV report saved to ${reportPath}`);
  }

  getAllFiles(dir, extensions = []) {
    const files = [];
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...this.getAllFiles(fullPath, extensions));
      } else if (extensions.length === 0 || extensions.some(ext => item.endsWith(ext))) {
        files.push(fullPath);
      }
    }

    return files;
  }

  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  loadAlternatives() {
    // Database of known lighter alternatives
    return {
      'lodash': [
        {
          name: 'lodash-es',
          description: 'ES modules version with better tree-shaking',
          estimatedSize: 70 * 1024,
          tradeoffs: 'Better tree-shaking, same API'
        },
        {
          name: 'ramda',
          description: 'Functional programming library',
          estimatedSize: 50 * 1024,
          tradeoffs: 'Different API, more functional approach'
        }
      ],
      'moment': [
        {
          name: 'date-fns',
          description: 'Modern JavaScript date utility library',
          estimatedSize: 30 * 1024,
          tradeoffs: 'Different API, better tree-shaking'
        },
        {
          name: 'dayjs',
          description: 'Fast 2kB alternative to Moment.js',
          estimatedSize: 10 * 1024,
          tradeoffs: 'Similar API, much smaller'
        }
      ],
      'axios': [
        {
          name: 'fetch (native)',
          description: 'Native browser fetch API',
          estimatedSize: 0,
          tradeoffs: 'No IE support, less features'
        },
        {
          name: 'ky',
          description: 'Tiny and elegant HTTP client',
          estimatedSize: 15 * 1024,
          tradeoffs: 'Modern API, smaller bundle'
        }
      ]
    };
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

    if (key === 'output-dir') options.outputDir = value;
    else if (key === 'node-modules') options.nodeModulesDir = value;
  }

  const reporter = new DependencySizeReporter(options);

  reporter.analyze()
    .then(results => {
      console.log('\n📊 Dependency Analysis Summary:');
      console.log(`Total dependencies: ${results.dependencies.length}`);
      console.log(`Total size: ${reporter.formatSize(results.totalSize)}`);
      console.log(`Heavy dependencies: ${results.heavyDependencies.length}`);
      console.log(`Duplicates: ${results.duplicates.length}`);
      console.log(`Unused: ${results.unused.length}`);
    })
    .catch(error => {
      console.error('❌ Analysis failed:', error.message);
      process.exit(1);
    });
}

module.exports = DependencySizeReporter;