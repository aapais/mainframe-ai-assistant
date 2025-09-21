# Lighthouse CI Setup Documentation

## Overview

This document describes the comprehensive Lighthouse CI setup for automated performance regression testing of the Mainframe AI Assistant Electron application.

## 🎯 Performance Targets

The following performance budgets and thresholds have been configured:

### Core Web Vitals
- **First Contentful Paint (FCP)**: < 1.8s
- **Largest Contentful Paint (LCP)**: < 2.5s
- **Time to Interactive (TTI)**: < 3.8s
- **First Input Delay (FID)**: < 100ms
- **Cumulative Layout Shift (CLS)**: < 0.1

### Performance Scores
- **Performance**: > 85%
- **Accessibility**: > 90%
- **Best Practices**: > 85%
- **SEO**: > 80%

### Resource Budgets
- **Total Bundle Size**: < 250KB JavaScript
- **CSS Size**: < 50KB
- **Total Resources**: < 1MB
- **Request Count**: < 50 requests

## 📁 File Structure

```
├── config/lighthouse/
│   ├── lighthouserc.js           # Main Lighthouse CI configuration
│   ├── lighthouse-ci.config.js   # Environment-specific configs
│   ├── budget.json              # Performance budgets
│   ├── baseline.json            # Performance baseline metrics
│   └── baseline-history.json    # Historical baseline data
├── scripts/lighthouse/
│   ├── lighthouse-runner.js     # Main runner script
│   ├── electron-lighthouse.js   # Electron-optimized runner
│   ├── check-regression.js      # Regression detection
│   ├── update-baseline.js       # Baseline management
│   ├── performance-alerts.js    # Alert system
│   └── lighthouse-server.js     # Local LHCI server
├── reports/lighthouse/           # Generated reports
└── .github/workflows/
    └── lighthouse-ci.yml        # GitHub Actions workflow
```

## 🚀 Usage

### Local Development

```bash
# Run full Lighthouse analysis
npm run lighthouse:full

# Run only collection
npm run lighthouse:collect

# Run only assertions
npm run lighthouse:assert

# Run Electron-optimized analysis
npm run lighthouse:electron

# Check for performance regressions
npm run lighthouse:regression

# Update performance baseline
npm run lighthouse:baseline

# Send performance alerts
npm run lighthouse:alerts

# Start Lighthouse CI server
npm run lighthouse:server
```

### CI/CD Integration

The GitHub Actions workflow automatically:
1. Runs Lighthouse CI on every push/PR
2. Checks for performance regressions
3. Comments on PRs with results
4. Updates baseline on main branch
5. Sends alerts for critical issues

### Environment Configurations

Use different configurations for different environments:

```bash
# Development (relaxed thresholds)
LHCI_ENV=development npm run lighthouse:ci

# Staging (standard thresholds)
LHCI_ENV=staging npm run lighthouse:ci

# Production (strict thresholds)
LHCI_ENV=production npm run lighthouse:ci

# Mobile testing
LHCI_ENV=mobile npm run lighthouse:ci
```

## 📊 Reports and Monitoring

### Local Reports
- **JSON reports**: `reports/lighthouse/*.json`
- **HTML reports**: `reports/lighthouse/*.html`
- **Baseline data**: `config/lighthouse/baseline.json`

### CI Reports
- GitHub Actions artifacts contain all generated reports
- PR comments show performance summary
- Lighthouse CI server provides trend analysis

### Performance Dashboard

Start the local Lighthouse CI server to view trends:

```bash
npm run lighthouse:serve
# Opens http://localhost:9001
```

## 🔔 Alerts and Notifications

### Slack Integration
Set environment variables for Slack notifications:
```bash
export SLACK_WEBHOOK_URL="https://hooks.slack.com/..."
export SLACK_CHANNEL="#performance"
```

### GitHub Issues
Automatic GitHub issue creation for critical performance issues requires:
```bash
export GITHUB_TOKEN="your-github-token"
export GITHUB_REPOSITORY="owner/repo"
```

### Email Alerts
Configure email notifications:
```bash
export EMAIL_ALERTS_ENABLED="true"
export EMAIL_RECIPIENTS="dev-team@company.com,qa@company.com"
```

## 🧪 Testing Scenarios

### Regression Detection
The system detects regressions in:
- Performance scores (>5% degradation)
- Core Web Vitals thresholds
- Bundle size increases (>10%)
- Accessibility score changes

### Baseline Management
- Baselines are updated automatically on main branch
- Historical baselines are preserved for trend analysis
- Manual baseline updates available via scripts

### Alert Thresholds

#### Critical Alerts (CI failure)
- Performance score < 50%
- FCP > 3s
- LCP > 4s
- TTI > 6s
- Bundle size > 500KB

#### Warning Alerts (notification only)
- Performance score < 70%
- FCP > 2s
- LCP > 3s
- TTI > 4s
- Bundle size > 300KB

## 🔧 Configuration Customization

### Modifying Budgets
Edit `config/lighthouse/budget.json` to adjust:
- Resource size limits
- Timing budgets
- Request count limits
- Path-specific budgets

### Assertion Thresholds
Update `config/lighthouse/lighthouserc.js` assertions section:
```javascript
assertions: {
  'first-contentful-paint': ['error', { maxNumericValue: 1800 }],
  'categories:performance': ['error', { minScore: 0.85 }],
  // ... other assertions
}
```

### Environment-Specific Settings
Modify `config/lighthouse/lighthouse-ci.config.js` for:
- Different URL targets
- Varied test run counts
- Environment-specific budgets
- Custom Chrome flags

## 🛠️ Troubleshooting

### Common Issues

#### Chrome Launch Failures
```bash
# Add to Chrome flags in configuration
"--no-sandbox --disable-gpu --disable-dev-shm-usage"
```

#### Server Connection Issues
```bash
# Check if application server is running
curl -f http://localhost:3000

# Wait for server in CI
timeout 60 bash -c 'until curl -f http://localhost:3000; do sleep 2; done'
```

#### Memory Issues
```bash
# Increase Node.js memory limit
node --max-old-space-size=4096 scripts/lighthouse/lighthouse-runner.js
```

### Debug Mode
Enable verbose logging:
```bash
DEBUG=lhci:* npm run lighthouse:ci
```

## 📈 Performance Optimization Tips

Based on Lighthouse results, common optimizations include:

### JavaScript Optimization
- Code splitting and lazy loading
- Tree shaking unused code
- Minification and compression
- Service worker caching

### CSS Optimization
- Remove unused CSS rules
- Critical CSS inlining
- CSS minification
- Efficient font loading

### Image Optimization
- WebP format conversion
- Lazy loading implementation
- Responsive image sizes
- Image compression

### Network Optimization
- HTTP/2 implementation
- Resource bundling
- CDN utilization
- Cache optimization

## 🔄 Continuous Improvement

### Regular Reviews
- Weekly performance trend analysis
- Monthly baseline adjustments
- Quarterly budget reviews
- Annual target reassessment

### Team Training
- Lighthouse metrics understanding
- Performance debugging techniques
- Optimization best practices
- CI/CD integration knowledge

## 📚 Resources

- [Lighthouse CI Documentation](https://github.com/GoogleChrome/lighthouse-ci)
- [Web Vitals Guide](https://web.dev/vitals/)
- [Performance Budget Guide](https://web.dev/performance-budgets-101/)
- [Lighthouse Scoring Guide](https://web.dev/performance-scoring/)

## 🆘 Support

For issues with the Lighthouse CI setup:
1. Check the troubleshooting section above
2. Review GitHub Actions logs
3. Check Slack #performance channel
4. Contact the development team
5. Create GitHub issue with `lighthouse-ci` label