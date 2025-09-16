#!/usr/bin/env node

/**
 * Performance Notification System
 * Sends performance test notifications to various platforms
 */

const fs = require('fs');
const https = require('https');
const { program } = require('commander');

class PerformanceNotificationSender {
  constructor(platform, webhookUrl, results, context = {}) {
    this.platform = platform;
    this.webhookUrl = webhookUrl;
    this.results = results;
    this.context = {
      source: 'performance-testing',
      environment: process.env.NODE_ENV || 'development',
      ...context
    };
  }

  /**
   * Send notification to configured platform
   */
  async send() {
    console.log(`📤 Sending ${this.platform} notification...`);

    const message = this.formatMessage();

    try {
      await this.sendWebhook(message);
      console.log('✅ Notification sent successfully');
    } catch (error) {
      console.error('❌ Failed to send notification:', error.message);
      throw error;
    }
  }

  /**
   * Format message based on platform
   */
  formatMessage() {
    switch (this.platform.toLowerCase()) {
      case 'slack':
        return this.formatSlackMessage();
      case 'teams':
        return this.formatTeamsMessage();
      case 'discord':
        return this.formatDiscordMessage();
      case 'webhook':
        return this.formatGenericWebhook();
      default:
        throw new Error(`Unsupported platform: ${this.platform}`);
    }
  }

  /**
   * Format Slack message
   */
  formatSlackMessage() {
    const status = this.results.passed ? 'good' : 'danger';
    const emoji = this.results.passed ? '✅' : '❌';
    const statusText = this.results.passed ? 'PASSED' : 'FAILED';

    const fields = [
      {
        title: 'Overall Score',
        value: `${this.results.score.toFixed(1)}%`,
        short: true
      },
      {
        title: 'Test Results',
        value: `${this.results.summary.passed}/${this.results.summary.total} passed`,
        short: true
      }
    ];

    if (this.results.summary.regressions > 0) {
      fields.push({
        title: 'Regressions',
        value: `${this.results.summary.regressions} detected`,
        short: true
      });
    }

    // Add key metrics
    const keyMetrics = this.getKeyMetrics();
    if (keyMetrics.length > 0) {
      fields.push({
        title: 'Key Metrics',
        value: keyMetrics.map(m => `• ${m.name}: ${m.current} (${m.change})`).join('\n'),
        short: false
      });
    }

    // Add recommendations for failures
    let recommendationText = '';
    if (!this.results.passed && this.results.recommendations) {
      const criticalRecs = this.results.recommendations
        .filter(r => r.priority === 'critical' || r.priority === 'high')
        .slice(0, 3);

      if (criticalRecs.length > 0) {
        recommendationText = '\n*Recommendations:*\n' +
          criticalRecs.map(r => `• ${r.message}`).join('\n');
      }
    }

    const message = {
      username: 'Performance Bot',
      icon_emoji: ':chart_with_upwards_trend:',
      attachments: [
        {
          color: status,
          title: `${emoji} Performance Tests ${statusText}`,
          title_link: this.getReportUrl(),
          text: this.getContextText() + recommendationText,
          fields: fields,
          footer: 'Performance Testing',
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    };

    // Add actions for failed tests
    if (!this.results.passed) {
      message.attachments[0].actions = [
        {
          type: 'button',
          text: 'View Detailed Report',
          url: this.getReportUrl()
        },
        {
          type: 'button',
          text: 'View Logs',
          url: this.getLogsUrl()
        }
      ];
    }

    return message;
  }

  /**
   * Format Microsoft Teams message
   */
  formatTeamsMessage() {
    const status = this.results.passed ? 'good' : 'attention';
    const emoji = this.results.passed ? '✅' : '❌';
    const statusText = this.results.passed ? 'PASSED' : 'FAILED';

    const facts = [
      {
        name: 'Overall Score',
        value: `${this.results.score.toFixed(1)}%`
      },
      {
        name: 'Test Results',
        value: `${this.results.summary.passed}/${this.results.summary.total} passed`
      }
    ];

    if (this.results.summary.regressions > 0) {
      facts.push({
        name: 'Regressions',
        value: `${this.results.summary.regressions} detected`
      });
    }

    // Add environment info
    if (this.context.environment) {
      facts.push({
        name: 'Environment',
        value: this.context.environment
      });
    }

    if (this.context.branch) {
      facts.push({
        name: 'Branch',
        value: this.context.branch
      });
    }

    const sections = [
      {
        activityTitle: `${emoji} Performance Tests ${statusText}`,
        activitySubtitle: this.getContextText(),
        facts: facts,
        markdown: true
      }
    ];

    // Add key metrics section
    const keyMetrics = this.getKeyMetrics();
    if (keyMetrics.length > 0) {
      sections.push({
        activityTitle: 'Key Metrics',
        text: keyMetrics.map(m => `• **${m.name}**: ${m.current} (${m.change})`).join('  \n'),
        markdown: true
      });
    }

    // Add recommendations for failures
    if (!this.results.passed && this.results.recommendations) {
      const criticalRecs = this.results.recommendations
        .filter(r => r.priority === 'critical' || r.priority === 'high')
        .slice(0, 3);

      if (criticalRecs.length > 0) {
        sections.push({
          activityTitle: 'Recommendations',
          text: criticalRecs.map(r => `• ${r.message}`).join('  \n'),
          markdown: true
        });
      }
    }

    const message = {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      summary: `Performance Tests ${statusText}`,
      themeColor: status === 'good' ? '00FF00' : 'FF0000',
      sections: sections
    };

    // Add potential actions
    if (this.getReportUrl() || this.getLogsUrl()) {
      message.potentialAction = [];

      if (this.getReportUrl()) {
        message.potentialAction.push({
          '@type': 'OpenUri',
          name: 'View Detailed Report',
          targets: [{ os: 'default', uri: this.getReportUrl() }]
        });
      }

      if (this.getLogsUrl()) {
        message.potentialAction.push({
          '@type': 'OpenUri',
          name: 'View Logs',
          targets: [{ os: 'default', uri: this.getLogsUrl() }]
        });
      }
    }

    return message;
  }

  /**
   * Format Discord message
   */
  formatDiscordMessage() {
    const color = this.results.passed ? 0x00FF00 : 0xFF0000;
    const emoji = this.results.passed ? '✅' : '❌';
    const statusText = this.results.passed ? 'PASSED' : 'FAILED';

    const fields = [
      {
        name: 'Overall Score',
        value: `${this.results.score.toFixed(1)}%`,
        inline: true
      },
      {
        name: 'Test Results',
        value: `${this.results.summary.passed}/${this.results.summary.total} passed`,
        inline: true
      }
    ];

    if (this.results.summary.regressions > 0) {
      fields.push({
        name: 'Regressions',
        value: `${this.results.summary.regressions} detected`,
        inline: true
      });
    }

    // Add key metrics
    const keyMetrics = this.getKeyMetrics().slice(0, 5); // Discord has field limits
    keyMetrics.forEach(metric => {
      fields.push({
        name: metric.name,
        value: `${metric.current} (${metric.change})`,
        inline: true
      });
    });

    const embed = {
      title: `${emoji} Performance Tests ${statusText}`,
      description: this.getContextText(),
      color: color,
      fields: fields,
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Performance Testing'
      }
    };

    if (this.getReportUrl()) {
      embed.url = this.getReportUrl();
    }

    return {
      embeds: [embed]
    };
  }

  /**
   * Format generic webhook
   */
  formatGenericWebhook() {
    return {
      platform: this.platform,
      timestamp: new Date().toISOString(),
      context: this.context,
      results: this.results,
      summary: {
        status: this.results.passed ? 'passed' : 'failed',
        score: this.results.score,
        tests: this.results.summary,
        key_metrics: this.getKeyMetrics(),
        recommendations: this.results.recommendations || []
      }
    };
  }

  /**
   * Get key metrics for display
   */
  getKeyMetrics() {
    if (!this.results.metrics) return [];

    return this.results.metrics
      .filter(m => ['fail', 'pass'].includes(m.status))
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
      .slice(0, 6)
      .map(m => ({
        name: m.name.replace(/\./g, ' ').replace(/_/g, ' '),
        current: this.formatMetricValue(m.current),
        change: m.change > 0 ? `+${m.change.toFixed(1)}%` : `${m.change.toFixed(1)}%`,
        status: m.status
      }));
  }

  /**
   * Format metric value for display
   */
  formatMetricValue(value) {
    if (typeof value !== 'number') return value;

    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    } else if (value < 1) {
      return value.toFixed(3);
    } else {
      return value.toFixed(1);
    }
  }

  /**
   * Get context text for the notification
   */
  getContextText() {
    const parts = [];

    if (this.context.source === 'github') {
      if (this.context.event === 'pull_request') {
        parts.push(`PR #${this.context.pr_number}`);
      } else if (this.context.branch) {
        parts.push(`Branch: ${this.context.branch}`);
      }

      if (this.context.commit_sha) {
        parts.push(`Commit: ${this.context.commit_sha.substring(0, 7)}`);
      }
    }

    if (this.context.environment) {
      parts.push(`Environment: ${this.context.environment}`);
    }

    return parts.join(' • ');
  }

  /**
   * Get report URL if available
   */
  getReportUrl() {
    if (this.context.source === 'github') {
      const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
      if (GITHUB_SERVER_URL && GITHUB_REPOSITORY && GITHUB_RUN_ID) {
        return `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;
      }
    }

    return this.context.report_url || null;
  }

  /**
   * Get logs URL if available
   */
  getLogsUrl() {
    if (this.context.source === 'github') {
      const reportUrl = this.getReportUrl();
      return reportUrl ? `${reportUrl}/logs` : null;
    }

    return this.context.logs_url || null;
  }

  /**
   * Send webhook HTTP request
   */
  async sendWebhook(message) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(message);
      const url = new URL(this.webhookUrl);

      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          'User-Agent': 'Performance-Testing-Bot/1.0'
        }
      };

      const req = https.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(responseData);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(data);
      req.end();
    });
  }

  /**
   * Test webhook connectivity
   */
  async testWebhook() {
    const testMessage = this.formatTestMessage();

    try {
      await this.sendWebhook(testMessage);
      console.log('✅ Webhook test successful');
      return true;
    } catch (error) {
      console.error('❌ Webhook test failed:', error.message);
      return false;
    }
  }

  /**
   * Format test message
   */
  formatTestMessage() {
    const testResults = {
      passed: true,
      score: 95.5,
      summary: {
        total: 10,
        passed: 10,
        failed: 0,
        regressions: 0
      },
      metrics: [
        {
          name: 'response_time.p95',
          current: 150,
          change: -5.2,
          status: 'pass'
        }
      ]
    };

    const originalResults = this.results;
    this.results = testResults;

    const message = this.formatMessage();
    message._test = true;

    this.results = originalResults;
    return message;
  }
}

// CLI interface
program
  .name('send-notifications')
  .description('Send performance test notifications')
  .requiredOption('-p, --platform <platform>', 'Notification platform (slack, teams, discord, webhook)')
  .requiredOption('-w, --webhook-url <url>', 'Webhook URL for notifications')
  .requiredOption('-r, --results <path>', 'Performance results file')
  .option('-c, --context <context>', 'Additional context (github, ci, local)', 'local')
  .option('--test', 'Send test notification')
  .option('--dry-run', 'Show notification content without sending')
  .action(async (options) => {
    try {
      console.log('📤 Performance Notification Sender');
      console.log(`📱 Platform: ${options.platform}`);
      console.log(`🔗 Webhook: ${options.webhookUrl.substring(0, 50)}...`);

      let results = {};
      if (!options.test) {
        results = JSON.parse(fs.readFileSync(options.results, 'utf8'));
      }

      // Set up context based on environment
      const context = { source: options.context };

      if (options.context === 'github') {
        context.event = process.env.GITHUB_EVENT_NAME;
        context.branch = process.env.GITHUB_REF_NAME;
        context.commit_sha = process.env.GITHUB_SHA;
        context.pr_number = process.env.GITHUB_EVENT_PATH ?
          JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')).number : null;
      }

      const sender = new PerformanceNotificationSender(
        options.platform,
        options.webhookUrl,
        results,
        context
      );

      if (options.test) {
        console.log('🧪 Sending test notification...');
        await sender.testWebhook();
      } else if (options.dryRun) {
        console.log('👀 Dry run - notification content:');
        const message = sender.formatMessage();
        console.log(JSON.stringify(message, null, 2));
      } else {
        await sender.send();
      }

      console.log('✅ Notification process completed');

    } catch (error) {
      console.error('❌ Notification failed:', error.message);
      process.exit(1);
    }
  });

if (require.main === module) {
  program.parse();
}

module.exports = PerformanceNotificationSender;