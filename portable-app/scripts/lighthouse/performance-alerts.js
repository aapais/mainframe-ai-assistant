#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class PerformanceAlerts {
  constructor() {
    this.reportsDir = path.join(__dirname, '../../reports/lighthouse');
    this.alertsConfig = {
      slack: {
        enabled: process.env.SLACK_WEBHOOK_URL ? true : false,
        webhookUrl: process.env.SLACK_WEBHOOK_URL,
        channel: process.env.SLACK_CHANNEL || '#performance'
      },
      email: {
        enabled: process.env.EMAIL_ALERTS_ENABLED === 'true',
        recipients: process.env.EMAIL_RECIPIENTS ? process.env.EMAIL_RECIPIENTS.split(',') : []
      },
      github: {
        enabled: process.env.GITHUB_TOKEN ? true : false,
        token: process.env.GITHUB_TOKEN,
        repo: process.env.GITHUB_REPOSITORY
      }
    };

    this.severityThresholds = {
      critical: {
        performanceScore: 0.5, // Below 50%
        fcp: 3000, // Above 3s
        lcp: 4000, // Above 4s
        tti: 6000, // Above 6s
        cls: 0.25,  // Above 0.25
        bundleSize: 500000 // Above 500KB
      },
      warning: {
        performanceScore: 0.7, // Below 70%
        fcp: 2000, // Above 2s
        lcp: 3000, // Above 3s
        tti: 4000, // Above 4s
        cls: 0.15,  // Above 0.15
        bundleSize: 300000 // Above 300KB
      }
    };
  }

  getLatestReport() {
    try {
      const files = fs.readdirSync(this.reportsDir)
        .filter(f => f.endsWith('.json') && !f.includes('manifest'))
        .sort()
        .reverse();

      if (files.length === 0) {
        throw new Error('No Lighthouse reports found');
      }

      const latestFile = files[0];
      const reportPath = path.join(this.reportsDir, latestFile);
      return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    } catch (error) {
      console.error('❌ Error loading latest report:', error.message);
      return null;
    }
  }

  extractMetrics(report) {
    const { categories, audits } = report;

    return {
      performance: categories.performance.score,
      accessibility: categories.accessibility.score,
      bestPractices: categories['best-practices'].score,
      seo: categories.seo.score,
      fcp: audits['first-contentful-paint'].numericValue,
      lcp: audits['largest-contentful-paint'].numericValue,
      tti: audits['interactive'].numericValue,
      cls: audits['cumulative-layout-shift'].numericValue,
      fid: audits['max-potential-fid'].numericValue,
      bundleSize: this.getBundleSize(audits),
      url: report.requestedUrl,
      fetchTime: report.fetchTime
    };
  }

  getBundleSize(audits) {
    const resourceSummary = audits['resource-summary'];
    if (resourceSummary && resourceSummary.details && resourceSummary.details.items) {
      const totalItem = resourceSummary.details.items.find(item => item.resourceType === 'total');
      return totalItem ? totalItem.size : 0;
    }
    return 0;
  }

  assessSeverity(metrics) {
    const issues = [];

    // Check critical thresholds
    const critical = this.severityThresholds.critical;
    if (metrics.performance < critical.performanceScore) {
      issues.push({ severity: 'critical', metric: 'Performance Score', value: `${Math.round(metrics.performance * 100)}%`, threshold: `${critical.performanceScore * 100}%` });
    }
    if (metrics.fcp > critical.fcp) {
      issues.push({ severity: 'critical', metric: 'First Contentful Paint', value: `${Math.round(metrics.fcp)}ms`, threshold: `${critical.fcp}ms` });
    }
    if (metrics.lcp > critical.lcp) {
      issues.push({ severity: 'critical', metric: 'Largest Contentful Paint', value: `${Math.round(metrics.lcp)}ms`, threshold: `${critical.lcp}ms` });
    }
    if (metrics.tti > critical.tti) {
      issues.push({ severity: 'critical', metric: 'Time to Interactive', value: `${Math.round(metrics.tti)}ms`, threshold: `${critical.tti}ms` });
    }
    if (metrics.cls > critical.cls) {
      issues.push({ severity: 'critical', metric: 'Cumulative Layout Shift', value: metrics.cls.toFixed(3), threshold: critical.cls.toFixed(3) });
    }
    if (metrics.bundleSize > critical.bundleSize) {
      issues.push({ severity: 'critical', metric: 'Bundle Size', value: `${Math.round(metrics.bundleSize / 1024)}KB`, threshold: `${Math.round(critical.bundleSize / 1024)}KB` });
    }

    // Check warning thresholds (only if not already critical)
    if (issues.length === 0) {
      const warning = this.severityThresholds.warning;
      if (metrics.performance < warning.performanceScore) {
        issues.push({ severity: 'warning', metric: 'Performance Score', value: `${Math.round(metrics.performance * 100)}%`, threshold: `${warning.performanceScore * 100}%` });
      }
      if (metrics.fcp > warning.fcp) {
        issues.push({ severity: 'warning', metric: 'First Contentful Paint', value: `${Math.round(metrics.fcp)}ms`, threshold: `${warning.fcp}ms` });
      }
      if (metrics.lcp > warning.lcp) {
        issues.push({ severity: 'warning', metric: 'Largest Contentful Paint', value: `${Math.round(metrics.lcp)}ms`, threshold: `${warning.lcp}ms` });
      }
      if (metrics.tti > warning.tti) {
        issues.push({ severity: 'warning', metric: 'Time to Interactive', value: `${Math.round(metrics.tti)}ms`, threshold: `${warning.tti}ms` });
      }
      if (metrics.cls > warning.cls) {
        issues.push({ severity: 'warning', metric: 'Cumulative Layout Shift', value: metrics.cls.toFixed(3), threshold: warning.cls.toFixed(3) });
      }
      if (metrics.bundleSize > warning.bundleSize) {
        issues.push({ severity: 'warning', metric: 'Bundle Size', value: `${Math.round(metrics.bundleSize / 1024)}KB`, threshold: `${Math.round(warning.bundleSize / 1024)}KB` });
      }
    }

    return issues;
  }

  formatSlackMessage(metrics, issues) {
    const emoji = issues.some(i => i.severity === 'critical') ? '🚨' : '⚠️';
    const color = issues.some(i => i.severity === 'critical') ? 'danger' : 'warning';

    const fields = [
      {
        title: 'Performance Score',
        value: `${Math.round(metrics.performance * 100)}%`,
        short: true
      },
      {
        title: 'Core Web Vitals',
        value: `FCP: ${Math.round(metrics.fcp)}ms\nLCP: ${Math.round(metrics.lcp)}ms\nTTI: ${Math.round(metrics.tti)}ms\nCLS: ${metrics.cls.toFixed(3)}`,
        short: true
      },
      {
        title: 'Bundle Size',
        value: `${Math.round(metrics.bundleSize / 1024)}KB`,
        short: true
      },
      {
        title: 'URL',
        value: metrics.url,
        short: false
      }
    ];

    if (issues.length > 0) {
      fields.push({
        title: 'Issues Detected',
        value: issues.map(issue => `• ${issue.metric}: ${issue.value} (threshold: ${issue.threshold})`).join('\n'),
        short: false
      });
    }

    return {
      channel: this.alertsConfig.slack.channel,
      username: 'Lighthouse Performance Monitor',
      icon_emoji: ':lighthouse:',
      attachments: [{
        color: color,
        title: `${emoji} Performance Alert - ${issues.length > 0 ? issues[0].severity.toUpperCase() : 'INFO'}`,
        text: issues.length > 0 ? 'Performance thresholds exceeded' : 'Performance monitoring update',
        fields: fields,
        footer: 'Lighthouse CI',
        ts: Math.floor(Date.now() / 1000)
      }]
    };
  }

  async sendSlackAlert(metrics, issues) {
    if (!this.alertsConfig.slack.enabled) {
      console.log('📱 Slack alerts disabled');
      return;
    }

    try {
      const message = this.formatSlackMessage(metrics, issues);

      // Use curl to send webhook (more reliable than fetch in CI)
      const curlCommand = `curl -X POST -H 'Content-type: application/json' --data '${JSON.stringify(message)}' ${this.alertsConfig.slack.webhookUrl}`;
      execSync(curlCommand, { stdio: 'pipe' });

      console.log('✅ Slack alert sent successfully');
    } catch (error) {
      console.error('❌ Failed to send Slack alert:', error.message);
    }
  }

  async sendGitHubIssue(metrics, issues) {
    if (!this.alertsConfig.github.enabled || issues.length === 0) {
      return;
    }

    try {
      const criticalIssues = issues.filter(i => i.severity === 'critical');
      const warningIssues = issues.filter(i => i.severity === 'warning');

      const title = criticalIssues.length > 0
        ? `🚨 Critical Performance Issues Detected`
        : `⚠️ Performance Warnings Detected`;

      const body = `
## Performance Alert Report

**Performance Score:** ${Math.round(metrics.performance * 100)}%
**URL:** ${metrics.url}
**Timestamp:** ${new Date().toISOString()}

### Core Web Vitals
- **First Contentful Paint:** ${Math.round(metrics.fcp)}ms
- **Largest Contentful Paint:** ${Math.round(metrics.lcp)}ms
- **Time to Interactive:** ${Math.round(metrics.tti)}ms
- **Cumulative Layout Shift:** ${metrics.cls.toFixed(3)}
- **Bundle Size:** ${Math.round(metrics.bundleSize / 1024)}KB

### Issues Detected

${criticalIssues.length > 0 ? `#### 🚨 Critical Issues\n${criticalIssues.map(issue => `- **${issue.metric}:** ${issue.value} (threshold: ${issue.threshold})`).join('\n')}\n` : ''}

${warningIssues.length > 0 ? `#### ⚠️ Warnings\n${warningIssues.map(issue => `- **${issue.metric}:** ${issue.value} (threshold: ${issue.threshold})`).join('\n')}\n` : ''}

### Recommendations

1. **Bundle Optimization:** Consider code splitting and tree shaking
2. **Image Optimization:** Implement lazy loading and WebP format
3. **CSS Optimization:** Remove unused CSS and minimize critical path
4. **JavaScript Optimization:** Defer non-critical JavaScript execution
5. **Caching Strategy:** Implement service worker for resource caching

---
*This issue was automatically created by Lighthouse CI performance monitoring.*
      `;

      // Create GitHub issue using GitHub CLI if available
      try {
        const command = `gh issue create --title "${title}" --body "${body}" --label "performance,lighthouse-ci"`;
        execSync(command, { stdio: 'pipe' });
        console.log('✅ GitHub issue created successfully');
      } catch (error) {
        console.log('ℹ️ GitHub CLI not available, skipping issue creation');
      }
    } catch (error) {
      console.error('❌ Failed to create GitHub issue:', error.message);
    }
  }

  generateConsoleReport(metrics, issues) {
    console.log('\n🔍 PERFORMANCE MONITORING REPORT');
    console.log('='.repeat(50));

    const performanceEmoji = metrics.performance >= 0.9 ? '🟢' : metrics.performance >= 0.7 ? '🟡' : '🔴';
    console.log(`${performanceEmoji} Performance Score: ${Math.round(metrics.performance * 100)}%`);

    console.log('\n📊 CORE WEB VITALS:');
    console.log(`⚡ First Contentful Paint: ${Math.round(metrics.fcp)}ms`);
    console.log(`🎨 Largest Contentful Paint: ${Math.round(metrics.lcp)}ms`);
    console.log(`🖱️ Time to Interactive: ${Math.round(metrics.tti)}ms`);
    console.log(`📐 Cumulative Layout Shift: ${metrics.cls.toFixed(3)}`);
    console.log(`📦 Bundle Size: ${Math.round(metrics.bundleSize / 1024)}KB`);

    if (issues.length > 0) {
      console.log('\n⚠️ ISSUES DETECTED:');
      issues.forEach(issue => {
        const emoji = issue.severity === 'critical' ? '🚨' : '⚠️';
        console.log(`${emoji} ${issue.metric}: ${issue.value} (exceeds ${issue.threshold})`);
      });
    } else {
      console.log('\n✅ All performance metrics within acceptable thresholds');
    }

    console.log(`\n🌐 URL: ${metrics.url}`);
    console.log(`⏰ Report Time: ${new Date().toLocaleString()}`);
  }

  async run() {
    console.log('🚀 Starting performance alerts check...');

    const report = this.getLatestReport();
    if (!report) {
      console.error('❌ No report available for analysis');
      process.exit(1);
    }

    const metrics = this.extractMetrics(report);
    const issues = this.assessSeverity(metrics);

    this.generateConsoleReport(metrics, issues);

    // Send alerts only if there are issues
    if (issues.length > 0) {
      console.log('\n📢 Sending performance alerts...');

      await Promise.all([
        this.sendSlackAlert(metrics, issues),
        this.sendGitHubIssue(metrics, issues)
      ]);
    } else {
      console.log('\n✅ No alerts needed - performance within thresholds');
    }

    // Exit with error code if critical issues found
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      console.log('\n❌ Critical performance issues detected');
      process.exit(1);
    }

    console.log('\n✅ Performance monitoring completed');
  }
}

// Run the performance alerts
if (require.main === module) {
  const alerts = new PerformanceAlerts();
  alerts.run().catch(error => {
    console.error('❌ Performance alerts failed:', error);
    process.exit(1);
  });
}

module.exports = PerformanceAlerts;