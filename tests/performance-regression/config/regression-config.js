/**
 * Performance Regression Testing Configuration
 * Central configuration management for the regression testing system
 */

class RegressionConfig {
  constructor(environment = process.env.NODE_ENV || 'development') {
    this.environment = environment;
    this.config = this.loadConfiguration();
  }

  /**
   * Load configuration based on environment
   */
  loadConfiguration() {
    const baseConfig = {
      // Test execution settings
      execution: {
        timeout: '30m',
        retryAttempts: 3,
        parallelJobs: 4,
        warmupRuns: 2,
        measurementRuns: 10,
        environments: ['development', 'staging', 'production']
      },

      // Performance thresholds
      thresholds: {
        performance: {
          warning: 15,    // 15% performance degradation
          critical: 30    // 30% performance degradation
        },
        memory: {
          warning: 20,    // 20% memory increase
          critical: 40    // 40% memory increase
        },
        reliability: {
          warning: 5,     // 5% success rate decrease
          critical: 10    // 10% success rate decrease
        }
      },

      // Baseline management
      baselines: {
        directory: './baselines',
        retentionDays: 30,
        minSampleSize: 5,
        confidenceLevel: 0.95,
        autoUpdate: false
      },

      // Alert configuration
      alerts: {
        channels: {
          console: { enabled: true },
          email: { enabled: false },
          slack: { enabled: false },
          webhook: { enabled: false }
        },
        rateLimiting: {
          enabled: true,
          maxAlertsPerHour: 10,
          duplicateSuppressionMinutes: 30
        }
      },

      // Report generation
      reports: {
        outputDir: './reports',
        formats: ['html', 'json', 'markdown'],
        includeCharts: true,
        retentionDays: 90
      },

      // CI/CD integration
      cicd: {
        failOnRegression: true,
        failOnCritical: true,
        commentOnPR: true,
        uploadArtifacts: true
      },

      // Test suites configuration
      testSuites: []
    };

    // Environment-specific overrides
    const environmentConfigs = {
      development: {
        execution: {
          measurementRuns: 5,
          parallelJobs: 2
        },
        thresholds: {
          performance: { warning: 25, critical: 50 },
          memory: { warning: 30, critical: 60 }
        },
        alerts: {
          channels: {
            console: { enabled: true }
          }
        }
      },

      staging: {
        execution: {
          measurementRuns: 8
        },
        thresholds: {
          performance: { warning: 20, critical: 35 }
        },
        alerts: {
          channels: {
            console: { enabled: true },
            slack: { enabled: true, channel: '#staging-alerts' }
          }
        }
      },

      production: {
        execution: {
          measurementRuns: 15,
          retryAttempts: 5
        },
        thresholds: {
          performance: { warning: 10, critical: 20 },
          memory: { warning: 15, critical: 25 },
          reliability: { warning: 2, critical: 5 }
        },
        baselines: {
          retentionDays: 90,
          minSampleSize: 10
        },
        alerts: {
          channels: {
            console: { enabled: true },
            email: { enabled: true },
            slack: { enabled: true, channel: '#production-alerts' },
            webhook: { enabled: true }
          },
          rateLimiting: {
            maxAlertsPerHour: 5
          }
        },
        cicd: {
          failOnRegression: true,
          failOnCritical: true
        }
      }
    };

    // Merge base config with environment-specific config
    const envConfig = environmentConfigs[this.environment] || {};
    return this.deepMerge(baseConfig, envConfig);
  }

  /**
   * Get configuration value by path
   */
  get(path, defaultValue = undefined) {
    const keys = path.split('.');
    let current = this.config;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return defaultValue;
      }
    }
    
    return current;
  }

  /**
   * Set configuration value by path
   */
  set(path, value) {
    const keys = path.split('.');
    let current = this.config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  /**
   * Get all configuration
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * Load test suites configuration
   */
  loadTestSuites(suitesConfig) {
    if (Array.isArray(suitesConfig)) {
      this.config.testSuites = suitesConfig;
    } else if (typeof suitesConfig === 'object') {
      this.config.testSuites = Object.values(suitesConfig);
    }
    
    return this.config.testSuites;
  }

  /**
   * Add test suite
   */
  addTestSuite(suite) {
    const requiredFields = ['name', 'testFunction'];
    const missingFields = requiredFields.filter(field => !(field in suite));
    
    if (missingFields.length > 0) {
      throw new Error(`Test suite missing required fields: ${missingFields.join(', ')}`);
    }
    
    this.config.testSuites.push({
      name: suite.name,
      testFunction: suite.testFunction,
      timeout: suite.timeout || this.get('execution.timeout'),
      retries: suite.retries || this.get('execution.retryAttempts'),
      environments: suite.environments || this.get('execution.environments'),
      metadata: suite.metadata || {},
      thresholds: suite.thresholds || this.get('thresholds')
    });
    
    return this.config.testSuites.length - 1;
  }

  /**
   * Remove test suite
   */
  removeTestSuite(name) {
    const index = this.config.testSuites.findIndex(suite => suite.name === name);
    if (index !== -1) {
      this.config.testSuites.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Configure alerts
   */
  configureAlerts(alertConfig) {
    this.config.alerts = this.deepMerge(this.config.alerts, alertConfig);
    
    // Validate email configuration
    if (this.config.alerts.channels.email.enabled) {
      const emailConfig = this.config.alerts.channels.email;
      if (!emailConfig.smtp || !emailConfig.from || !emailConfig.to) {
        console.warn('Email alerts enabled but configuration is incomplete');
      }
    }
    
    // Validate Slack configuration
    if (this.config.alerts.channels.slack.enabled) {
      const slackConfig = this.config.alerts.channels.slack;
      if (!slackConfig.webhook) {
        console.warn('Slack alerts enabled but webhook URL is missing');
      }
    }
    
    return this.config.alerts;
  }

  /**
   * Configure CI/CD integration
   */
  configureCICD(platform, cicdConfig) {
    if (!this.config.cicd.platforms) {
      this.config.cicd.platforms = {};
    }
    
    this.config.cicd.platforms[platform] = {
      enabled: true,
      ...cicdConfig
    };
    
    return this.config.cicd.platforms[platform];
  }

  /**
   * Validate configuration
   */
  validate() {
    const errors = [];
    const warnings = [];
    
    // Validate execution configuration
    if (this.get('execution.measurementRuns') < 3) {
      warnings.push('measurementRuns should be at least 3 for reliable statistics');
    }
    
    if (this.get('execution.parallelJobs') > 10) {
      warnings.push('High parallel job count may impact system performance');
    }
    
    // Validate thresholds
    const perfThresholds = this.get('thresholds.performance');
    if (perfThresholds.warning >= perfThresholds.critical) {
      errors.push('Performance warning threshold must be less than critical threshold');
    }
    
    // Validate test suites
    if (this.config.testSuites.length === 0) {
      warnings.push('No test suites configured');
    }
    
    this.config.testSuites.forEach((suite, index) => {
      if (!suite.name) {
        errors.push(`Test suite at index ${index} missing name`);
      }
      if (!suite.testFunction) {
        errors.push(`Test suite '${suite.name}' missing test function`);
      }
    });
    
    // Validate alert configuration
    const enabledChannels = Object.entries(this.get('alerts.channels'))
      .filter(([_, config]) => config.enabled)
      .map(([channel, _]) => channel);
    
    if (enabledChannels.length === 0) {
      warnings.push('No alert channels enabled');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Export configuration to JSON
   */
  exportConfig() {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Import configuration from JSON
   */
  importConfig(configJson) {
    try {
      const importedConfig = typeof configJson === 'string' 
        ? JSON.parse(configJson) 
        : configJson;
      
      this.config = this.deepMerge(this.config, importedConfig);
      return this.validate();
    } catch (error) {
      throw new Error(`Failed to import configuration: ${error.message}`);
    }
  }

  /**
   * Deep merge objects
   */
  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          result[key] = this.deepMerge(target[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }
    
    return result;
  }

  /**
   * Create default test suite template
   */
  createTestSuiteTemplate(name, description = '') {
    return {
      name,
      description,
      testFunction: async (environment, options) => {
        // Template test function
        const startTime = Date.now();
        
        // Simulate test execution
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
        
        return {
          duration: Date.now() - startTime,
          success: Math.random() > 0.1, // 90% success rate
          data: {
            // Test-specific data
          }
        };
      },
      timeout: this.get('execution.timeout'),
      environments: this.get('execution.environments'),
      metadata: {
        category: 'general',
        priority: 'medium',
        tags: []
      }
    };
  }

  /**
   * Get environment-specific configuration
   */
  getEnvironmentConfig(environment) {
    const envConfig = { ...this.config };
    
    // Apply environment-specific overrides if they exist
    if (envConfig.environmentOverrides && envConfig.environmentOverrides[environment]) {
      return this.deepMerge(envConfig, envConfig.environmentOverrides[environment]);
    }
    
    return envConfig;
  }

  /**
   * Generate configuration summary
   */
  getSummary() {
    const validation = this.validate();
    
    return {
      environment: this.environment,
      testSuites: this.config.testSuites.length,
      enabledEnvironments: this.get('execution.environments').length,
      alertChannels: Object.entries(this.get('alerts.channels'))
        .filter(([_, config]) => config.enabled)
        .map(([channel, _]) => channel),
      thresholds: this.get('thresholds'),
      validation
    };
  }
}

// Export singleton instance
const instance = new RegressionConfig();

module.exports = {
  RegressionConfig,
  config: instance
};