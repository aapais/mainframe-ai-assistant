import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const BundleAnalyzer = require('../../scripts/analyze-bundle.js');
const DependencySizeReporter = require('../../scripts/dependency-size-report.js');
const BundleComparison = require('../../scripts/bundle-comparison.js');

describe('Bundle Size Analysis', () => {
  const testOutputDir = path.join(__dirname, 'test-output');
  const testDistDir = path.join(__dirname, 'test-dist');

  beforeAll(() => {
    // Create test directories
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
    if (!fs.existsSync(testDistDir)) {
      fs.mkdirSync(testDistDir, { recursive: true });
    }

    // Create mock bundle files for testing
    createMockBundleFiles();
  });

  afterAll(() => {
    // Cleanup test files
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true });
    }
    if (fs.existsSync(testDistDir)) {
      fs.rmSync(testDistDir, { recursive: true });
    }
  });

  function createMockBundleFiles() {
    // Create mock JavaScript files
    fs.writeFileSync(
      path.join(testDistDir, 'index.js'),
      'console.log("Main bundle"); ' + 'x'.repeat(10000)
    );

    fs.writeFileSync(
      path.join(testDistDir, 'vendor.js'),
      'console.log("Vendor bundle"); ' + 'y'.repeat(50000)
    );

    fs.writeFileSync(
      path.join(testDistDir, 'chunk-123.js'),
      'console.log("Async chunk"); ' + 'z'.repeat(5000)
    );

    // Create mock CSS file
    fs.writeFileSync(
      path.join(testDistDir, 'styles.css'),
      '.test { color: red; } ' + '/* padding */'.repeat(1000)
    );

    // Create mock manifest
    const manifest = {
      'index.html': {
        file: 'index.js',
        isEntry: true,
        imports: ['vendor.js']
      },
      'vendor.js': {
        file: 'vendor.js',
        isEntry: false
      },
      'chunk-123.js': {
        file: 'chunk-123.js',
        isDynamicEntry: true
      }
    };

    const viteDir = path.join(testDistDir, '.vite');
    if (!fs.existsSync(viteDir)) {
      fs.mkdirSync(viteDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(viteDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );
  }

  describe('BundleAnalyzer', () => {
    it('should analyze bundle files correctly', async () => {
      const analyzer = new BundleAnalyzer({
        distDir: testDistDir,
        outputDir: testOutputDir
      });

      const results = await analyzer.analyze();

      expect(results).toBeDefined();
      expect(results.files).toBeInstanceOf(Array);
      expect(results.files.length).toBeGreaterThan(0);
      expect(results.timestamp).toBeDefined();
    });

    it('should detect file types correctly', () => {
      const analyzer = new BundleAnalyzer();

      expect(analyzer.getFileType('bundle.js')).toBe('js');
      expect(analyzer.getFileType('styles.css')).toBe('css');
      expect(analyzer.getFileType('image.png')).toBe('image');
      expect(analyzer.getFileType('font.woff2')).toBe('font');
      expect(analyzer.getFileType('data.json')).toBe('json');
    });

    it('should identify entry and chunk files', () => {
      const analyzer = new BundleAnalyzer();

      expect(analyzer.isEntryFile('index.js')).toBe(true);
      expect(analyzer.isEntryFile('main.js')).toBe(true);
      expect(analyzer.isChunkFile('chunk-123.js')).toBe(true);
      expect(analyzer.isChunkFile('vendor.js')).toBe(true);
      expect(analyzer.isEntryFile('component.js')).toBe(false);
    });

    it('should format file sizes correctly', () => {
      const analyzer = new BundleAnalyzer();

      expect(analyzer.formatSize(0)).toBe('0 B');
      expect(analyzer.formatSize(512)).toBe('512 B');
      expect(analyzer.formatSize(1024)).toBe('1 KB');
      expect(analyzer.formatSize(1024 * 1024)).toBe('1 MB');
      expect(analyzer.formatSize(1536)).toBe('1.5 KB');
    });

    it('should check budget violations', async () => {
      const analyzer = new BundleAnalyzer({
        distDir: testDistDir,
        outputDir: testOutputDir,
        budgets: {
          maxBundleSize: 30000, // 30KB - should trigger warning
          maxInitialSize: 15000, // 15KB
          maxChunkSize: 10000    // 10KB
        }
      });

      const results = await analyzer.analyze();

      expect(results.warnings).toBeInstanceOf(Array);
      // Should have warnings due to small budget limits
      expect(results.warnings.length).toBeGreaterThan(0);
    });

    it('should generate all required reports', async () => {
      const analyzer = new BundleAnalyzer({
        distDir: testDistDir,
        outputDir: testOutputDir
      });

      await analyzer.analyze();

      // Check that reports were generated
      expect(fs.existsSync(path.join(testOutputDir, 'bundle-analysis.json'))).toBe(true);
      expect(fs.existsSync(path.join(testOutputDir, 'bundle-report.html'))).toBe(true);
      expect(fs.existsSync(path.join(testOutputDir, 'bundle-report.md'))).toBe(true);
      expect(fs.existsSync(path.join(testOutputDir, 'bundle-analysis.csv'))).toBe(true);
    });
  });

  describe('DependencySizeReporter', () => {
    it('should load package data correctly', async () => {
      const reporter = new DependencySizeReporter({
        outputDir: testOutputDir,
        packageJsonPath: path.join(__dirname, '../../package.json')
      });

      const packageData = await reporter.loadPackageData();

      expect(packageData).toBeDefined();
      expect(packageData.dependencies).toBeDefined();
      expect(packageData.devDependencies).toBeDefined();
    });

    it('should determine dependency types correctly', async () => {
      const reporter = new DependencySizeReporter();
      const packageData = {
        dependencies: { react: '^18.0.0' },
        devDependencies: { jest: '^29.0.0' },
        peerDependencies: { typescript: '^5.0.0' }
      };

      expect(reporter.getDependencyType('react', packageData)).toBe('production');
      expect(reporter.getDependencyType('jest', packageData)).toBe('development');
      expect(reporter.getDependencyType('typescript', packageData)).toBe('peer');
      expect(reporter.getDependencyType('unknown', packageData)).toBe('unknown');
    });

    it('should calculate directory sizes', async () => {
      const reporter = new DependencySizeReporter({
        outputDir: testOutputDir
      });

      const sizeData = await reporter.calculateDirectorySize(testDistDir);

      expect(sizeData).toBeDefined();
      expect(sizeData.totalSize).toBeGreaterThan(0);
      expect(sizeData.fileCount).toBeGreaterThan(0);
      expect(sizeData.largestFiles).toBeInstanceOf(Array);
    });

    it('should format sizes correctly', () => {
      const reporter = new DependencySizeReporter();

      expect(reporter.formatSize(0)).toBe('0 B');
      expect(reporter.formatSize(1000)).toBe('1000 B');
      expect(reporter.formatSize(2048)).toBe('2 KB');
      expect(reporter.formatSize(1048576)).toBe('1 MB');
    });

    it('should load alternatives database', () => {
      const reporter = new DependencySizeReporter();
      const alternatives = reporter.loadAlternatives();

      expect(alternatives).toBeDefined();
      expect(alternatives['moment']).toBeDefined();
      expect(alternatives['lodash']).toBeDefined();
      expect(alternatives['axios']).toBeDefined();
    });
  });

  describe('BundleComparison', () => {
    let comparison: typeof BundleComparison;
    let mockAnalysis1: any;
    let mockAnalysis2: any;

    beforeAll(() => {
      comparison = new BundleComparison({
        outputDir: testOutputDir,
        historyDir: path.join(testOutputDir, 'history')
      });

      // Create mock analyses
      mockAnalysis1 = {
        timestamp: '2023-01-01T00:00:00.000Z',
        files: [
          { name: 'index.js', size: 10000, gzipSize: 3000, type: 'js' },
          { name: 'vendor.js', size: 50000, gzipSize: 15000, type: 'js' }
        ],
        chunks: [
          { name: 'index', size: 10000, isEntry: true },
          { name: 'vendor', size: 50000, isEntry: false }
        ],
        dependencies: {
          react: { version: '18.0.0', size: 45000 },
          lodash: { version: '4.17.21', size: 70000 }
        }
      };

      mockAnalysis2 = {
        timestamp: '2023-01-02T00:00:00.000Z',
        files: [
          { name: 'index.js', size: 12000, gzipSize: 3500, type: 'js' }, // Increased
          { name: 'vendor.js', size: 50000, gzipSize: 15000, type: 'js' }, // Same
          { name: 'new-chunk.js', size: 8000, gzipSize: 2500, type: 'js' } // New
        ],
        chunks: [
          { name: 'index', size: 12000, isEntry: true },
          { name: 'vendor', size: 50000, isEntry: false },
          { name: 'new-chunk', size: 8000, isDynamicEntry: true }
        ],
        dependencies: {
          react: { version: '18.2.0', size: 47000 }, // Updated
          lodash: { version: '4.17.21', size: 70000 }, // Same
          dayjs: { version: '1.11.0', size: 12000 } // New
        }
      };
    });

    it('should calculate total size correctly', () => {
      const totalSize1 = comparison.calculateTotalSize(mockAnalysis1);
      const totalSize2 = comparison.calculateTotalSize(mockAnalysis2);

      expect(totalSize1).toBe(60000); // 10000 + 50000
      expect(totalSize2).toBe(70000); // 12000 + 50000 + 8000
    });

    it('should format size changes correctly', () => {
      expect(comparison.formatSizeChange(1000)).toBe('+1000 B');
      expect(comparison.formatSizeChange(-1000)).toBe('-1000 B');
      expect(comparison.formatSizeChange(0)).toBe('0 B');
      expect(comparison.formatSizeChange(2048)).toBe('+2 KB');
    });

    it('should calculate trends correctly', () => {
      const values = [100, 110, 105, 120, 115];
      const trend = comparison.calculateTrend(values);

      expect(trend).toBeDefined();
      expect(trend.direction).toBe('increasing'); // 15% increase
      expect(parseFloat(trend.change)).toBeGreaterThan(0);
    });

    it('should detect file changes', async () => {
      // Mock the comparison object with test data
      comparison.currentAnalysis = mockAnalysis2;
      comparison.previousAnalysis = mockAnalysis1;

      const comparisonResult = { changes: { files: [] } };
      await comparison.analyzeFileChanges(comparisonResult);

      expect(comparisonResult.changes.files).toBeInstanceOf(Array);
      expect(comparisonResult.changes.files.length).toBeGreaterThan(0);

      // Should detect new file
      const newFiles = comparisonResult.changes.files.filter(f => f.type === 'added');
      expect(newFiles.length).toBe(1);
      expect(newFiles[0].name).toBe('new-chunk.js');

      // Should detect modified file
      const modifiedFiles = comparisonResult.changes.files.filter(f => f.type === 'modified');
      expect(modifiedFiles.length).toBeGreaterThan(0);
    });

    it('should generate alerts for significant changes', () => {
      const mockComparison = {
        changes: {
          size: { percentage: 20 } // 20% increase
        },
        alerts: []
      };

      comparison.thresholds = { critical: 0.15, size: 0.05 };
      comparison.generateAlerts(mockComparison);

      expect(mockComparison.alerts.length).toBeGreaterThan(0);
      expect(mockComparison.alerts[0].type).toBe('critical');
    });
  });

  describe('Integration Tests', () => {
    it('should run complete analysis pipeline', async () => {
      // Run bundle analysis
      const analyzer = new BundleAnalyzer({
        distDir: testDistDir,
        outputDir: testOutputDir
      });

      const bundleResults = await analyzer.analyze();
      expect(bundleResults).toBeDefined();

      // Run dependency analysis if package.json exists
      if (fs.existsSync(path.join(__dirname, '../../package.json'))) {
        const depReporter = new DependencySizeReporter({
          outputDir: testOutputDir,
          packageJsonPath: path.join(__dirname, '../../package.json')
        });

        const depResults = await depReporter.analyze();
        expect(depResults).toBeDefined();
      }

      // Run comparison
      const comparison = new BundleComparison({
        outputDir: testOutputDir
      });

      const analysisPath = path.join(testOutputDir, 'bundle-analysis.json');
      const comparisonResults = await comparison.compare(analysisPath);
      expect(comparisonResults).toBeDefined();
    });

    it('should handle missing files gracefully', async () => {
      const analyzer = new BundleAnalyzer({
        distDir: '/nonexistent',
        outputDir: testOutputDir
      });

      // Should attempt to build first
      await expect(analyzer.analyze()).rejects.toThrow();
    });

    it('should validate budget enforcement', async () => {
      const analyzer = new BundleAnalyzer({
        distDir: testDistDir,
        outputDir: testOutputDir,
        budgets: {
          maxBundleSize: 1000, // Very small budget
          maxInitialSize: 500,
          maxChunkSize: 500
        }
      });

      const results = await analyzer.analyze();

      // Should have budget violations
      expect(results.warnings.length).toBeGreaterThan(0);
      expect(results.warnings.some(w => w.type === 'budget')).toBe(true);
    });

    it('should track size improvements', async () => {
      // Create a scenario where bundle size decreases
      const smallerMockFiles = path.join(testOutputDir, 'smaller-dist');
      if (!fs.existsSync(smallerMockFiles)) {
        fs.mkdirSync(smallerMockFiles, { recursive: true });
      }

      // Create smaller files
      fs.writeFileSync(path.join(smallerMockFiles, 'index.js'), 'console.log("smaller");');
      fs.writeFileSync(path.join(smallerMockFiles, 'vendor.js'), 'console.log("smaller vendor");');

      const analyzer = new BundleAnalyzer({
        distDir: smallerMockFiles,
        outputDir: testOutputDir
      });

      const results = await analyzer.analyze();

      // Should successfully analyze smaller bundle
      expect(results.files.length).toBeGreaterThan(0);
      expect(results.files.every(f => f.size < 100)).toBe(true); // Very small files

      // Cleanup
      fs.rmSync(smallerMockFiles, { recursive: true });
    });
  });

  describe('Performance Tests', () => {
    it('should complete analysis within reasonable time', async () => {
      const startTime = Date.now();

      const analyzer = new BundleAnalyzer({
        distDir: testDistDir,
        outputDir: testOutputDir
      });

      await analyzer.analyze();

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 10 seconds for small test bundle
      expect(duration).toBeLessThan(10000);
    });

    it('should handle large file counts efficiently', async () => {
      // Create many small files to test performance
      const manyFilesDir = path.join(testOutputDir, 'many-files');
      if (!fs.existsSync(manyFilesDir)) {
        fs.mkdirSync(manyFilesDir, { recursive: true });
      }

      // Create 50 small files
      for (let i = 0; i < 50; i++) {
        fs.writeFileSync(
          path.join(manyFilesDir, `file-${i}.js`),
          `console.log("File ${i}");`
        );
      }

      const startTime = Date.now();

      const analyzer = new BundleAnalyzer({
        distDir: manyFilesDir,
        outputDir: testOutputDir
      });

      const results = await analyzer.analyze();

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(results.files.length).toBe(50);
      expect(duration).toBeLessThan(15000); // Should complete within 15 seconds

      // Cleanup
      fs.rmSync(manyFilesDir, { recursive: true });
    });
  });
});