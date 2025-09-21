#!/usr/bin/env node

const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const fs = require('fs');
const path = require('path');

class ElectronLighthouseRunner {
  constructor() {
    this.reportsDir = path.join(__dirname, '../../reports/lighthouse');
    this.electronConfig = {
      extends: 'lighthouse:default',
      settings: {
        formFactor: 'desktop',
        throttling: {
          rttMs: 40,
          throughputKbps: 10240,
          cpuSlowdownMultiplier: 1
        },
        screenEmulation: {
          mobile: false,
          width: 1350,
          height: 940,
          deviceScaleFactor: 1,
          disabled: false
        },
        emulatedUserAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Safari/537.36 Electron/13.0.0',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        skipAudits: [
          'is-on-https', // Skip HTTPS requirement for local testing
          'uses-http2', // Skip HTTP/2 requirement for local testing
          'redirects-http', // Skip HTTP redirect check
          'works-offline' // Skip offline functionality for desktop app
        ]
      }
    };
  }

  async launchChrome() {
    console.log('🚀 Launching Chrome...');
    return await chromeLauncher.launch({
      chromeFlags: [
        '--headless',
        '--no-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection'
      ]
    });
  }

  async runLighthouse(url, chrome) {
    console.log(`🔍 Running Lighthouse analysis on ${url}...`);

    const opts = {
      ...this.electronConfig,
      port: chrome.port
    };

    const runnerResult = await lighthouse(url, opts);
    return runnerResult;
  }

  saveResults(results, url) {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sanitizedUrl = url.replace(/[^a-zA-Z0-9]/g, '_');

    // Save JSON report
    const jsonPath = path.join(this.reportsDir, `lighthouse-${sanitizedUrl}-${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(results.lhr, null, 2));

    // Save HTML report
    const htmlPath = path.join(this.reportsDir, `lighthouse-${sanitizedUrl}-${timestamp}.html`);
    fs.writeFileSync(htmlPath, results.report);

    console.log(`📊 Reports saved:`);
    console.log(`  JSON: ${jsonPath}`);
    console.log(`  HTML: ${htmlPath}`);

    return { jsonPath, htmlPath };
  }

  generateSummary(lhr) {
    const categories = lhr.categories;
    const audits = lhr.audits;

    console.log('\n📈 LIGHTHOUSE PERFORMANCE SUMMARY');
    console.log('='.repeat(50));

    // Scores
    console.log('\n🎯 CATEGORY SCORES:');
    Object.entries(categories).forEach(([key, category]) => {
      const score = Math.round(category.score * 100);
      const emoji = score >= 90 ? '🟢' : score >= 70 ? '🟡' : '🔴';
      console.log(`${emoji} ${category.title}: ${score}%`);
    });

    // Core Web Vitals
    console.log('\n⚡ CORE WEB VITALS:');
    const coreMetrics = {
      'First Contentful Paint': audits['first-contentful-paint'],
      'Largest Contentful Paint': audits['largest-contentful-paint'],
      'Time to Interactive': audits['interactive'],
      'Cumulative Layout Shift': audits['cumulative-layout-shift'],
      'First Input Delay': audits['max-potential-fid']
    };

    Object.entries(coreMetrics).forEach(([name, audit]) => {
      if (audit) {
        const value = audit.displayValue || audit.score;
        const emoji = audit.score >= 0.9 ? '🟢' : audit.score >= 0.5 ? '🟡' : '🔴';
        console.log(`${emoji} ${name}: ${value}`);
      }
    });

    // Resource summary
    const resourceSummary = audits['resource-summary'];
    if (resourceSummary && resourceSummary.details) {
      console.log('\n📦 RESOURCE SUMMARY:');
      resourceSummary.details.items.forEach(item => {
        if (item.resourceType && item.size) {
          console.log(`  ${item.resourceType}: ${Math.round(item.size / 1024)}KB (${item.requestCount} requests)`);
        }
      });
    }

    // Opportunities
    const opportunities = Object.values(audits)
      .filter(audit => audit.score !== null && audit.score < 1 && audit.details && audit.details.overallSavingsMs > 100)
      .sort((a, b) => b.details.overallSavingsMs - a.details.overallSavingsMs)
      .slice(0, 5);

    if (opportunities.length > 0) {
      console.log('\n🔧 TOP OPTIMIZATION OPPORTUNITIES:');
      opportunities.forEach((audit, index) => {
        console.log(`${index + 1}. ${audit.title}: ${Math.round(audit.details.overallSavingsMs)}ms potential savings`);
      });
    }

    return {
      performanceScore: categories.performance.score,
      accessibilityScore: categories.accessibility.score,
      bestPracticesScore: categories['best-practices'].score,
      seoScore: categories.seo.score,
      fcp: audits['first-contentful-paint'].numericValue,
      lcp: audits['largest-contentful-paint'].numericValue,
      tti: audits['interactive'].numericValue,
      cls: audits['cumulative-layout-shift'].numericValue
    };
  }

  async run(urls = ['http://localhost:3000']) {
    console.log('🚀 Starting Electron-optimized Lighthouse analysis...');

    let chrome;
    const results = [];

    try {
      chrome = await this.launchChrome();

      for (const url of urls) {
        const result = await this.runLighthouse(url, chrome);
        const summary = this.generateSummary(result.lhr);
        const paths = this.saveResults(result, url);

        results.push({
          url,
          summary,
          paths
        });

        // Wait between runs
        if (urls.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

    } catch (error) {
      console.error('❌ Lighthouse analysis failed:', error);
      process.exit(1);
    } finally {
      if (chrome) {
        await chrome.kill();
        console.log('🔚 Chrome closed');
      }
    }

    console.log('\n✅ Lighthouse analysis completed');
    return results;
  }
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2);
  const urls = args.length > 0 ? args : ['http://localhost:3000'];

  const runner = new ElectronLighthouseRunner();
  runner.run(urls).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = ElectronLighthouseRunner;