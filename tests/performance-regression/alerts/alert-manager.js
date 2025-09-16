/**
 * Alert Manager
 * Handles automated alerts and notifications for performance regressions
 */

const nodemailer = require('nodemailer');
const webhook = require('webhook');

class AlertManager {
  constructor(config = {}) {
    this.config = {
      // Alert channels configuration
      channels: {
        email: {
          enabled: config.email?.enabled || false,
          smtp: config.email?.smtp || {
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT || 587,
            secure: false,
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS
            }
          },
          from: config.email?.from || process.env.ALERT_FROM_EMAIL,
          to: config.email?.to || process.env.ALERT_TO_EMAIL?.split(',') || []
        },
        slack: {
          enabled: config.slack?.enabled || false,
          webhook: config.slack?.webhook || process.env.SLACK_WEBHOOK_URL,
          channel: config.slack?.channel || '#performance-alerts'
        },
        teams: {
          enabled: config.teams?.enabled || false,
          webhook: config.teams?.webhook || process.env.TEAMS_WEBHOOK_URL
        },
        webhook: {
          enabled: config.webhook?.enabled || false,
          url: config.webhook?.url || process.env.ALERT_WEBHOOK_URL,
          headers: config.webhook?.headers || {},
          timeout: config.webhook?.timeout || 5000
        },
        console: {
          enabled: config.console?.enabled !== false, // Default enabled
          colors: config.console?.colors !== false
        }
      },
      
      // Alert severity thresholds
      severityThresholds: {
        critical: {
          performanceDegradation: 30, // 30% or more
          memoryIncrease: 40,         // 40% or more
          errorRateIncrease: 10,      // 10% or more
          successRateDecrease: 10     // 10% or more
        },
        warning: {
          performanceDegradation: 15, // 15% or more
          memoryIncrease: 20,         // 20% or more
          errorRateIncrease: 5,       // 5% or more
          successRateDecrease: 5      // 5% or more
        }
      },
      
      // Rate limiting
      rateLimiting: {
        enabled: config.rateLimiting?.enabled !== false,
        maxAlertsPerHour: config.rateLimiting?.maxAlertsPerHour || 10,
        duplicateSuppressionMinutes: config.rateLimiting?.duplicateSuppressionMinutes || 30
      },
      
      // Alert customization
      templates: {
        email: config.templates?.email || 'default',
        slack: config.templates?.slack || 'default'
      },
      
      ...config
    };
    
    this.emailTransporter = null;
    this.alertHistory = new Map();
    this.rateLimitTracker = new Map();
    
    this.initializeEmailTransporter();
  }

  /**
   * Initialize email transporter
   */
  async initializeEmailTransporter() {
    if (this.config.channels.email.enabled && this.config.channels.email.smtp) {
      try {
        this.emailTransporter = nodemailer.createTransporter(this.config.channels.email.smtp);
        await this.emailTransporter.verify();
        console.log('Email transporter initialized successfully');
      } catch (error) {
        console.warn('Failed to initialize email transporter:', error.message);
        this.config.channels.email.enabled = false;
      }
    }
  }

  /**
   * Send alert to all configured channels
   */
  async sendAlert(alertData) {
    try {
      // Check rate limiting
      if (!this.checkRateLimit(alertData)) {
        console.log('Alert suppressed due to rate limiting');
        return { success: false, reason: 'rate_limited' };
      }
      
      // Enrich alert data
      const enrichedAlert = await this.enrichAlertData(alertData);
      
      // Send to all enabled channels
      const results = await Promise.allSettled([
        this.sendConsoleAlert(enrichedAlert),
        this.sendEmailAlert(enrichedAlert),
        this.sendSlackAlert(enrichedAlert),
        this.sendTeamsAlert(enrichedAlert),
        this.sendWebhookAlert(enrichedAlert)
      ]);
      
      // Track alert history
      this.trackAlert(enrichedAlert);
      
      const successfulChannels = results
        .map((result, index) => ({ 
          channel: ['console', 'email', 'slack', 'teams', 'webhook'][index],
          success: result.status === 'fulfilled' && result.value.success
        }))
        .filter(channel => channel.success)
        .map(channel => channel.channel);
      
      return {
        success: successfulChannels.length > 0,
        channels: successfulChannels,
        errors: results
          .filter(result => result.status === 'rejected')
          .map(result => result.reason)
      };
      
    } catch (error) {
      console.error('Failed to send alert:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send console alert
   */
  async sendConsoleAlert(alertData) {
    if (!this.config.channels.console.enabled) {
      return { success: false, reason: 'disabled' };
    }
    
    const colors = this.config.channels.console.colors ? {
      critical: '\x1b[31m', // Red
      warning: '\x1b[33m',  // Yellow
      info: '\x1b[36m',     // Cyan
      reset: '\x1b[0m'      // Reset
    } : {};
    
    const severityColor = colors[alertData.severity] || '';
    const resetColor = colors.reset || '';
    
    console.log(`\n${severityColor}🚨 PERFORMANCE ALERT [${alertData.severity.toUpperCase()}]${resetColor}`);
    console.log(`Type: ${alertData.type}`);
    console.log(`Environment: ${alertData.environment || 'Unknown'}`);
    console.log(`Timestamp: ${alertData.timestamp}`);
    
    if (alertData.regressions && alertData.regressions.length > 0) {
      console.log('\nRegressions detected:');
      alertData.regressions.forEach((regression, index) => {
        console.log(`  ${index + 1}. ${regression.testSuite} - ${regression.severity}`);
        if (regression.summary) {
          console.log(`     ${regression.summary.message}`);
        }
      });
    }
    
    if (alertData.summary) {
      console.log(`\nSummary: ${alertData.summary}`);
    }
    
    if (alertData.recommendations) {
      console.log('\nRecommendations:');
      alertData.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. [${rec.priority}] ${rec.action}`);
      });
    }
    
    console.log('');
    
    return { success: true };
  }

  /**
   * Send email alert
   */
  async sendEmailAlert(alertData) {
    if (!this.config.channels.email.enabled || !this.emailTransporter) {
      return { success: false, reason: 'disabled_or_not_configured' };
    }
    
    const template = await this.generateEmailTemplate(alertData);
    
    const mailOptions = {
      from: this.config.channels.email.from,
      to: this.config.channels.email.to,
      subject: template.subject,
      html: template.html,
      text: template.text
    };
    
    try {
      const result = await this.emailTransporter.sendMail(mailOptions);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Failed to send email alert:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send Slack alert
   */
  async sendSlackAlert(alertData) {
    if (!this.config.channels.slack.enabled || !this.config.channels.slack.webhook) {
      return { success: false, reason: 'disabled_or_not_configured' };
    }
    
    const slackMessage = await this.generateSlackMessage(alertData);
    
    try {
      const response = await fetch(this.config.channels.slack.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slackMessage)
      });
      
      if (response.ok) {
        return { success: true };
      } else {
        return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
      }
    } catch (error) {
      console.error('Failed to send Slack alert:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send Teams alert
   */
  async sendTeamsAlert(alertData) {
    if (!this.config.channels.teams.enabled || !this.config.channels.teams.webhook) {
      return { success: false, reason: 'disabled_or_not_configured' };
    }
    
    const teamsMessage = await this.generateTeamsMessage(alertData);
    
    try {
      const response = await fetch(this.config.channels.teams.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamsMessage)
      });
      
      if (response.ok) {
        return { success: true };
      } else {
        return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
      }
    } catch (error) {
      console.error('Failed to send Teams alert:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send webhook alert
   */
  async sendWebhookAlert(alertData) {
    if (!this.config.channels.webhook.enabled || !this.config.channels.webhook.url) {
      return { success: false, reason: 'disabled_or_not_configured' };
    }
    
    const webhookPayload = {
      type: 'performance_alert',
      data: alertData,
      timestamp: new Date().toISOString()
    };
    
    try {
      const response = await fetch(this.config.channels.webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.channels.webhook.headers
        },
        body: JSON.stringify(webhookPayload),
        signal: AbortSignal.timeout(this.config.channels.webhook.timeout)
      });
      
      if (response.ok) {
        return { success: true, status: response.status };
      } else {
        return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
      }
    } catch (error) {
      console.error('Failed to send webhook alert:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate email template
   */
  async generateEmailTemplate(alertData) {
    const severityEmoji = {
      critical: '🚨',
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    const subject = `${severityEmoji[alertData.severity]} Performance Alert: ${alertData.type.replace('_', ' ').toUpperCase()}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background-color: ${alertData.severity === 'critical' ? '#d32f2f' : '#f57c00'}; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .severity { display: inline-block; padding: 5px 10px; border-radius: 5px; color: white; font-weight: bold; }
          .critical { background-color: #d32f2f; }
          .warning { background-color: #f57c00; }
          .regression { background-color: #f5f5f5; padding: 15px; margin: 10px 0; border-left: 4px solid #f57c00; }
          .recommendations { background-color: #e8f5e8; padding: 15px; margin: 10px 0; border-left: 4px solid #4caf50; }
          .footer { background-color: #f5f5f5; padding: 10px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${severityEmoji[alertData.severity]} Performance Alert</h1>
          <p>Type: ${alertData.type.replace('_', ' ').toUpperCase()}</p>
        </div>
        
        <div class="content">
          <p><strong>Severity:</strong> <span class="severity ${alertData.severity}">${alertData.severity.toUpperCase()}</span></p>
          <p><strong>Environment:</strong> ${alertData.environment || 'Not specified'}</p>
          <p><strong>Timestamp:</strong> ${alertData.timestamp}</p>
          
          ${alertData.regressions && alertData.regressions.length > 0 ? `
            <h3>Detected Regressions:</h3>
            ${alertData.regressions.map(regression => `
              <div class="regression">
                <h4>${regression.testSuite} (${regression.environment})</h4>
                <p><strong>Severity:</strong> ${regression.severity}</p>
                ${regression.summary ? `<p><strong>Details:</strong> ${regression.summary.message}</p>` : ''}
                ${regression.algorithms && regression.algorithms.statistical ? `
                  <ul>
                    ${regression.algorithms.statistical.duration?.isSignificant ? 
                      `<li>Duration increased by ${regression.algorithms.statistical.duration.percentageChange.toFixed(1)}%</li>` : ''}
                    ${regression.algorithms.statistical.memory?.isSignificant ? 
                      `<li>Memory usage increased by ${regression.algorithms.statistical.memory.percentageChange.toFixed(1)}%</li>` : ''}
                  </ul>
                ` : ''}
              </div>
            `).join('')}
          ` : ''}
          
          ${alertData.recommendations && alertData.recommendations.length > 0 ? `
            <div class="recommendations">
              <h3>Recommendations:</h3>
              <ol>
                ${alertData.recommendations.map(rec => `
                  <li><strong>[${rec.priority.toUpperCase()}]</strong> ${rec.action}
                    ${rec.details ? `<br><small>${rec.details}</small>` : ''}
                  </li>
                `).join('')}
              </ol>
            </div>
          ` : ''}
          
          ${alertData.report?.url ? `
            <p><strong>Full Report:</strong> <a href="${alertData.report.url}">View detailed analysis</a></p>
          ` : ''}
        </div>
        
        <div class="footer">
          <p>This alert was generated by the automated performance regression testing system.</p>
        </div>
      </body>
      </html>
    `;
    
    const text = `
      PERFORMANCE ALERT [${alertData.severity.toUpperCase()}]
      
      Type: ${alertData.type.replace('_', ' ').toUpperCase()}
      Environment: ${alertData.environment || 'Not specified'}
      Timestamp: ${alertData.timestamp}
      
      ${alertData.regressions && alertData.regressions.length > 0 ? `
        Detected Regressions:
        ${alertData.regressions.map((regression, index) => `
          ${index + 1}. ${regression.testSuite} (${regression.environment}) - ${regression.severity}
             ${regression.summary?.message || ''}
        `).join('')}
      ` : ''}
      
      ${alertData.recommendations && alertData.recommendations.length > 0 ? `
        Recommendations:
        ${alertData.recommendations.map((rec, index) => `
          ${index + 1}. [${rec.priority.toUpperCase()}] ${rec.action}
             ${rec.details || ''}
        `).join('')}
      ` : ''}
      
      ${alertData.report?.url ? `Full Report: ${alertData.report.url}` : ''}
    `;
    
    return { subject, html, text };
  }

  /**
   * Generate Slack message
   */
  async generateSlackMessage(alertData) {
    const severityColor = {
      critical: '#d32f2f',
      warning: '#f57c00',
      info: '#2196f3'
    };
    
    const severityEmoji = {
      critical: '🚨',
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${severityEmoji[alertData.severity]} Performance Alert: ${alertData.type.replace('_', ' ').toUpperCase()}`
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Severity:* ${alertData.severity.toUpperCase()}`
          },
          {
            type: 'mrkdwn',
            text: `*Environment:* ${alertData.environment || 'Not specified'}`
          },
          {
            type: 'mrkdwn',
            text: `*Timestamp:* ${new Date(alertData.timestamp).toLocaleString()}`
          }
        ]
      }
    ];
    
    if (alertData.regressions && alertData.regressions.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Detected Regressions (${alertData.regressions.length}):*\n${alertData.regressions.map(regression => 
            `• ${regression.testSuite} - ${regression.severity}${regression.summary ? `: ${regression.summary.message}` : ''}`
          ).join('\n')}`
        }
      });
    }
    
    if (alertData.recommendations && alertData.recommendations.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Recommendations:*\n${alertData.recommendations.map((rec, index) => 
            `${index + 1}. [${rec.priority.toUpperCase()}] ${rec.action}`
          ).join('\n')}`
        }
      });
    }
    
    if (alertData.report?.url) {
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Full Report'
            },
            url: alertData.report.url,
            style: alertData.severity === 'critical' ? 'danger' : 'primary'
          }
        ]
      });
    }
    
    return {
      channel: this.config.channels.slack.channel,
      attachments: [{
        color: severityColor[alertData.severity],
        blocks
      }]
    };
  }

  /**
   * Generate Teams message
   */
  async generateTeamsMessage(alertData) {
    const severityColor = {
      critical: 'attention',
      warning: 'warning',
      info: 'good'
    };
    
    return {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      summary: `Performance Alert: ${alertData.type}`,
      themeColor: severityColor[alertData.severity],
      sections: [
        {
          activityTitle: `🚨 Performance Alert: ${alertData.type.replace('_', ' ').toUpperCase()}`,
          activitySubtitle: `Severity: ${alertData.severity.toUpperCase()}`,
          facts: [
            {
              name: 'Environment',
              value: alertData.environment || 'Not specified'
            },
            {
              name: 'Timestamp',
              value: new Date(alertData.timestamp).toLocaleString()
            },
            ...(alertData.regressions ? [{
              name: 'Regressions Detected',
              value: alertData.regressions.length.toString()
            }] : [])
          ]
        },
        ...(alertData.regressions && alertData.regressions.length > 0 ? [{
          title: 'Detected Regressions',
          text: alertData.regressions.map(regression => 
            `• ${regression.testSuite} (${regression.severity})${regression.summary ? `: ${regression.summary.message}` : ''}`
          ).join('\n\n')
        }] : []),
        ...(alertData.recommendations && alertData.recommendations.length > 0 ? [{
          title: 'Recommendations',
          text: alertData.recommendations.map((rec, index) => 
            `${index + 1}. [${rec.priority.toUpperCase()}] ${rec.action}`
          ).join('\n\n')
        }] : [])
      ],
      potentialAction: alertData.report?.url ? [{
        '@type': 'OpenUri',
        name: 'View Full Report',
        targets: [{
          os: 'default',
          uri: alertData.report.url
        }]
      }] : []
    };
  }

  /**
   * Enrich alert data with additional context
   */
  async enrichAlertData(alertData) {
    return {
      ...alertData,
      timestamp: alertData.timestamp || new Date().toISOString(),
      alertId: this.generateAlertId(alertData),
      environment: alertData.environment || process.env.NODE_ENV || 'unknown',
      summary: alertData.summary || this.generateAlertSummary(alertData)
    };
  }

  /**
   * Generate alert summary
   */
  generateAlertSummary(alertData) {
    if (alertData.regressions && alertData.regressions.length > 0) {
      const criticalCount = alertData.regressions.filter(r => r.severity === 'critical').length;
      const warningCount = alertData.regressions.filter(r => r.severity === 'warning').length;
      
      let summary = `${alertData.regressions.length} performance regression(s) detected`;
      if (criticalCount > 0) {
        summary += ` (${criticalCount} critical`;
        if (warningCount > 0) summary += `, ${warningCount} warning`;
        summary += ')';
      } else if (warningCount > 0) {
        summary += ` (${warningCount} warning)`;
      }
      
      return summary;
    }
    
    return 'Performance issue detected';
  }

  /**
   * Generate unique alert ID
   */
  generateAlertId(alertData) {
    const hash = require('crypto')
      .createHash('md5')
      .update(`${alertData.type}-${alertData.environment}-${Date.now()}`)
      .digest('hex');
    return `alert-${hash.substring(0, 8)}`;
  }

  /**
   * Check rate limiting
   */
  checkRateLimit(alertData) {
    if (!this.config.rateLimiting.enabled) {
      return true;
    }
    
    const now = Date.now();
    const hourAgo = now - (60 * 60 * 1000);
    const alertKey = `${alertData.type}-${alertData.environment}`;
    
    // Clean old entries
    for (const [key, timestamps] of this.rateLimitTracker.entries()) {
      this.rateLimitTracker.set(key, timestamps.filter(ts => ts > hourAgo));
    }
    
    // Check hourly limit
    const hourlyAlerts = this.rateLimitTracker.get('hourly') || [];
    if (hourlyAlerts.length >= this.config.rateLimiting.maxAlertsPerHour) {
      return false;
    }
    
    // Check duplicate suppression
    const recentAlerts = this.rateLimitTracker.get(alertKey) || [];
    const suppressionWindow = this.config.rateLimiting.duplicateSuppressionMinutes * 60 * 1000;
    const recentDuplicate = recentAlerts.find(ts => (now - ts) < suppressionWindow);
    
    if (recentDuplicate) {
      return false;
    }
    
    // Update trackers
    hourlyAlerts.push(now);
    this.rateLimitTracker.set('hourly', hourlyAlerts);
    
    recentAlerts.push(now);
    this.rateLimitTracker.set(alertKey, recentAlerts);
    
    return true;
  }

  /**
   * Track alert in history
   */
  trackAlert(alertData) {
    const historyEntry = {
      timestamp: new Date().toISOString(),
      alertId: alertData.alertId,
      type: alertData.type,
      severity: alertData.severity,
      environment: alertData.environment,
      regressionCount: alertData.regressions?.length || 0
    };
    
    this.alertHistory.set(alertData.alertId, historyEntry);
    
    // Keep only last 1000 alerts in memory
    if (this.alertHistory.size > 1000) {
      const firstKey = this.alertHistory.keys().next().value;
      this.alertHistory.delete(firstKey);
    }
  }

  /**
   * Get alert statistics
   */
  getAlertStats() {
    const now = Date.now();
    const dayAgo = now - (24 * 60 * 60 * 1000);
    const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
    
    const alerts = Array.from(this.alertHistory.values());
    const last24h = alerts.filter(alert => new Date(alert.timestamp).getTime() > dayAgo);
    const lastWeek = alerts.filter(alert => new Date(alert.timestamp).getTime() > weekAgo);
    
    return {
      total: alerts.length,
      last24h: last24h.length,
      lastWeek: lastWeek.length,
      byType: this.groupBy(alerts, 'type'),
      bySeverity: this.groupBy(alerts, 'severity'),
      byEnvironment: this.groupBy(alerts, 'environment')
    };
  }

  /**
   * Group array by property
   */
  groupBy(array, property) {
    return array.reduce((groups, item) => {
      const key = item[property];
      groups[key] = (groups[key] || 0) + 1;
      return groups;
    }, {});
  }

  /**
   * Test alert channels
   */
  async testAlerts() {
    const testAlert = {
      type: 'test_alert',
      severity: 'info',
      environment: 'test',
      timestamp: new Date().toISOString(),
      summary: 'This is a test alert to verify channel configuration'
    };
    
    return await this.sendAlert(testAlert);
  }
}

module.exports = AlertManager;