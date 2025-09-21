# Bundle Size Analysis Guide

This guide covers the comprehensive bundle size analysis and optimization tools implemented for the mainframe AI assistant project.

## Overview

The bundle analysis toolkit provides:

- **Comprehensive Bundle Analysis**: Detailed analysis of bundle files, chunks, and dependencies
- **Size Tracking**: Historical tracking of bundle size changes over time
- **Budget Enforcement**: Automated checking against size budgets with CI/CD integration
- **Optimization Recommendations**: AI-powered suggestions for reducing bundle size
- **Dependency Analysis**: Deep dive into dependency contributions and alternatives
- **Dead Code Detection**: Identification of unused code and opportunities for tree-shaking
- **Performance Impact Assessment**: Understanding how bundle size affects performance

## Tools and Scripts

### 1. Bundle Analyzer (`scripts/analyze-bundle.js`)

The main analysis tool that examines your built application and provides comprehensive insights.

```bash
# Basic analysis
npm run analyze:bundle

# With custom options
node scripts/analyze-bundle.js --dist-dir dist --output-dir bundle-analysis --max-bundle-size 1048576
```

**Features:**
- File size analysis (raw, gzip, brotli compression)
- Chunk analysis and code splitting effectiveness
- Tree-shaking validation
- Dead code detection
- Budget checking with configurable thresholds
- Multiple report formats (JSON, HTML, Markdown, CSV)

**Output Files:**
- `bundle-analysis/bundle-analysis.json` - Raw analysis data
- `bundle-analysis/bundle-report.html` - Interactive HTML report
- `bundle-analysis/bundle-report.md` - Markdown summary
- `bundle-analysis/bundle-analysis.csv` - Data for spreadsheet analysis

### 2. Dependency Size Reporter (`scripts/dependency-size-report.js`)

Analyzes the contribution of each dependency to your bundle size.

```bash
# Analyze dependencies
npm run analyze:deps

# With custom options
node scripts/dependency-size-report.js --output-dir bundle-analysis --node-modules node_modules
```

**Features:**
- Per-dependency size calculation
- Duplicate dependency detection
- Unused dependency identification
- Alternative package suggestions
- License and description tracking
- Bundle impact assessment

**Key Reports:**
- Heavy dependencies (>100KB)
- Unused dependencies
- Duplicate packages
- Lighter alternatives database

### 3. Bundle Comparison (`scripts/bundle-comparison.js`)

Tracks changes in bundle size over time and between builds.

```bash
# Compare with previous build
npm run analyze:compare

# Compare specific analyses
node scripts/bundle-comparison.js current-analysis.json --previous previous-analysis.json
```

**Features:**
- File-by-file comparison
- Chunk size tracking
- Dependency change detection
- Trend analysis
- Alert generation for significant changes
- Historical data storage

### 4. Performance Budget Enforcement

```bash
# Check against 1MB budget
npm run budget:check
```

**Budget Categories:**
- Total bundle size
- Initial chunk size
- Individual chunk size
- Dependency size limits

## CI/CD Integration

### GitHub Actions Workflow

The `.github/workflows/bundle-analysis.yml` provides:

- **Automated Analysis**: Runs on every push and PR
- **Historical Tracking**: Maintains bundle size history
- **PR Comments**: Automatic bundle size reports on pull requests
- **Budget Enforcement**: Fails builds that exceed size budgets
- **Security Scanning**: Checks for vulnerabilities in large dependencies
- **Trend Visualization**: Publishes bundle size trends to GitHub Pages

### Running in CI

```yaml
- name: Bundle Analysis
  run: |
    npm run build
    npm run analyze:full

- name: Check Budget
  run: npm run budget:check
```

## Configuration

### Bundle Size Budgets

Configure budgets in your analysis scripts:

```javascript
const options = {
  budgets: {
    maxBundleSize: 1024 * 1024,  // 1MB total
    maxInitialSize: 512 * 1024,   // 512KB initial
    maxChunkSize: 256 * 1024      // 256KB per chunk
  }
};
```

### Vite Integration

The analyzer integrates with Vite's build output and manifest:

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'forms': ['./src/components/forms/*'],
          // ... chunk configuration
        }
      }
    }
  }
});
```

## Understanding Reports

### Bundle Analysis Report

**Summary Section:**
- Total files and size
- Compression effectiveness
- Dependency count
- Warning and error count

**File Analysis:**
- Individual file sizes
- Compression ratios
- File type categorization
- Entry point identification

**Recommendations:**
- Large file identification
- Compression opportunities
- Code splitting suggestions
- Dependency optimization

### Dependency Report

**Heavy Dependencies:**
- Size impact assessment
- Alternative suggestions
- Usage pattern analysis

**Unused Dependencies:**
- Safe-to-remove packages
- Potential size savings
- Impact assessment

**Duplicates:**
- Version conflicts
- Deduplication opportunities
- Size savings potential

### Comparison Report

**Change Tracking:**
- Size deltas (absolute and percentage)
- New/removed files
- Dependency updates
- Performance impact

**Alerts:**
- Budget violations
- Significant size increases
- New heavy dependencies
- Regression detection

## Optimization Strategies

### 1. Code Splitting

```typescript
// Dynamic imports for large components
const HeavyComponent = lazy(() => import('./HeavyComponent'));

// Route-based splitting
const routes = [
  {
    path: '/dashboard',
    component: lazy(() => import('./Dashboard'))
  }
];
```

### 2. Dependency Optimization

```bash
# Replace heavy dependencies
npm uninstall moment
npm install dayjs

# Use ES modules for better tree-shaking
npm install lodash-es
```

### 3. Build Configuration

```typescript
// vite.config.ts - Optimize chunks
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react')) return 'react-vendor';
            if (id.includes('lodash')) return 'utils';
            return 'vendor';
          }
        }
      }
    }
  }
});
```

### 4. Asset Optimization

```typescript
// Image optimization
import { defineConfig } from 'vite';
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons';

export default defineConfig({
  plugins: [
    createSvgIconsPlugin({
      iconDirs: [path.resolve(process.cwd(), 'src/icons')],
      symbolId: 'icon-[dir]-[name]',
    })
  ]
});
```

## Best Practices

### 1. Regular Monitoring

- Run bundle analysis on every build
- Track trends over time
- Set up alerts for size regressions
- Review reports in code reviews

### 2. Budget Management

- Set realistic but challenging budgets
- Update budgets as features grow
- Consider different budgets for different environments
- Document budget rationale

### 3. Dependency Management

- Regularly audit dependencies
- Prefer smaller, focused packages
- Consider alternatives for heavy dependencies
- Use peer dependencies where appropriate

### 4. Performance Correlation

- Correlate bundle size with performance metrics
- Test on different network conditions
- Consider mobile-first optimization
- Monitor real-user impact

## Troubleshooting

### Common Issues

**Analysis Fails:**
```bash
# Ensure build exists
npm run build
# Check permissions
chmod +x scripts/analyze-bundle.js
```

**Missing Dependencies:**
```bash
# Install analysis dependencies
npm install gzip-size brotli-size
```

**Large Bundle Size:**
- Check for accidentally included development dependencies
- Look for large images or fonts
- Verify tree-shaking is working
- Consider lazy loading for large features

### Performance Tips

- Run analysis after builds, not during development
- Use file system caching for repeated analyses
- Limit dependency analysis depth for large projects
- Consider sampling for very large bundles

## Integration with Other Tools

### Webpack Bundle Analyzer

```bash
# Generate webpack stats
npm run build -- --stats
npx webpack-bundle-analyzer dist/stats.json
```

### Bundle Buddy

```bash
# Generate source maps for analysis
npm run build -- --sourcemap
npx bundle-buddy dist/**/*.map
```

### Lighthouse CI

```yaml
# .lighthouserc.js
module.exports = {
  ci: {
    collect: {
      numberOfRuns: 3
    },
    assert: {
      assertions: {
        'total-byte-weight': ['error', { maxNumericValue: 1048576 }] // 1MB
      }
    }
  }
};
```

## Advanced Features

### Custom Analysis Plugins

```javascript
// Custom analyzer plugin
class CustomAnalyzer {
  analyze(bundleData) {
    // Custom analysis logic
    return recommendations;
  }
}
```

### Integration with Performance Monitoring

```javascript
// Correlate with Core Web Vitals
const bundleImpact = {
  FCP: calculateFCPImpact(bundleSize),
  LCP: calculateLCPImpact(imageSize),
  CLS: calculateCLSImpact(fontLoading)
};
```

### Machine Learning Optimization

```javascript
// Predict optimal chunk sizes
const optimalChunks = await ml.predictOptimalChunking({
  usage: userBehaviorData,
  network: networkConditions,
  device: deviceCapabilities
});
```

## Conclusion

The bundle analysis toolkit provides comprehensive insights into your application's size and performance characteristics. Regular use of these tools, combined with disciplined budget management and optimization practices, will help maintain optimal bundle sizes and deliver better user experiences.

For questions or improvements to these tools, please refer to the project's issue tracker or contribute directly to the bundle analysis scripts.