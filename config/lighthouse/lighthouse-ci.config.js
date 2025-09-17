// Alternative Lighthouse CI configuration for different environments

const baseConfig = {
  ci: {
    collect: {
      numberOfRuns: 3,
      settings: {
        chromeFlags: '--no-sandbox --disable-gpu --headless',
        preset: 'desktop',
        throttling: {
          rttMs: 40,
          throughputKbps: 10240,
          cpuSlowdownMultiplier: 1
        },
        formFactor: 'desktop',
        screenEmulation: {
          mobile: false,
          width: 1350,
          height: 940,
          deviceScaleFactor: 1,
          disabled: false
        }
      }
    },
    upload: {
      target: 'filesystem',
      outputDir: './reports/lighthouse'
    }
  }
};

// Environment-specific configurations
const environments = {
  development: {
    ...baseConfig,
    ci: {
      ...baseConfig.ci,
      collect: {
        ...baseConfig.ci.collect,
        url: ['http://localhost:3000'],
        numberOfRuns: 1, // Faster for dev
        settings: {
          ...baseConfig.ci.collect.settings,
          onlyCategories: ['performance'], // Focus on performance in dev
          skipAudits: [
            'is-on-https',
            'uses-http2',
            'redirects-http',
            'works-offline'
          ]
        }
      },
      assert: {
        preset: 'lighthouse:no-pwa',
        assertions: {
          'categories:performance': ['warn', { minScore: 0.7 }], // Relaxed for dev
          'first-contentful-paint': ['warn', { maxNumericValue: 2500 }],
          'largest-contentful-paint': ['warn', { maxNumericValue: 3500 }],
          'interactive': ['warn', { maxNumericValue: 5000 }]
        }
      }
    }
  },

  staging: {
    ...baseConfig,
    ci: {
      ...baseConfig.ci,
      collect: {
        ...baseConfig.ci.collect,
        url: [
          'https://staging.example.com',
          'https://staging.example.com/dashboard',
          'https://staging.example.com/settings'
        ],
        numberOfRuns: 3
      },
      assert: {
        preset: 'lighthouse:recommended',
        assertions: {
          'categories:performance': ['error', { minScore: 0.8 }],
          'categories:accessibility': ['error', { minScore: 0.9 }],
          'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
          'largest-contentful-paint': ['error', { maxNumericValue: 2800 }],
          'interactive': ['error', { maxNumericValue: 4000 }],
          'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }]
        }
      }
    }
  },

  production: {
    ...baseConfig,
    ci: {
      ...baseConfig.ci,
      collect: {
        ...baseConfig.ci.collect,
        url: [
          'https://app.example.com',
          'https://app.example.com/dashboard',
          'https://app.example.com/settings'
        ],
        numberOfRuns: 5 // More runs for production accuracy
      },
      assert: {
        preset: 'lighthouse:recommended',
        assertions: {
          // Strict production requirements
          'categories:performance': ['error', { minScore: 0.85 }],
          'categories:accessibility': ['error', { minScore: 0.95 }],
          'categories:best-practices': ['error', { minScore: 0.85 }],
          'categories:seo': ['error', { minScore: 0.8 }],

          // Core Web Vitals - Production targets
          'first-contentful-paint': ['error', { maxNumericValue: 1800 }],
          'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
          'interactive': ['error', { maxNumericValue: 3800 }],
          'first-cpu-idle': ['warn', { maxNumericValue: 3500 }],
          'max-potential-fid': ['error', { maxNumericValue: 100 }],
          'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],

          // Resource budgets
          'resource-summary:script:size': ['error', { maxNumericValue: 250000 }],
          'resource-summary:stylesheet:size': ['warn', { maxNumericValue: 50000 }],
          'resource-summary:total:size': ['error', { maxNumericValue: 1000000 }],
          'resource-summary:total:count': ['warn', { maxNumericValue: 50 }],

          // Performance optimizations
          'unused-javascript': ['warn', { maxNumericValue: 50000 }],
          'unused-css-rules': ['warn', { maxNumericValue: 20000 }],
          'bootup-time': ['warn', { maxNumericValue: 3000 }],
          'mainthread-work-breakdown': ['warn', { maxNumericValue: 2000 }],
          'third-party-summary': ['warn', { maxNumericValue: 500 }]
        }
      }
    }
  },

  mobile: {
    ...baseConfig,
    ci: {
      ...baseConfig.ci,
      collect: {
        ...baseConfig.ci.collect,
        url: ['http://localhost:3000'],
        settings: {
          ...baseConfig.ci.collect.settings,
          preset: 'mobile', // Mobile preset
          formFactor: 'mobile',
          throttling: {
            rttMs: 150,
            throughputKbps: 1638,
            cpuSlowdownMultiplier: 4
          },
          screenEmulation: {
            mobile: true,
            width: 360,
            height: 640,
            deviceScaleFactor: 2,
            disabled: false
          }
        }
      },
      assert: {
        preset: 'lighthouse:recommended',
        assertions: {
          // Mobile-specific requirements (more lenient)
          'categories:performance': ['error', { minScore: 0.75 }],
          'first-contentful-paint': ['error', { maxNumericValue: 2500 }],
          'largest-contentful-paint': ['error', { maxNumericValue: 4000 }],
          'interactive': ['error', { maxNumericValue: 6000 }],
          'cumulative-layout-shift': ['error', { maxNumericValue: 0.15 }]
        }
      }
    }
  }
};

// Export configuration based on environment
const env = process.env.NODE_ENV || 'development';
const lhciEnv = process.env.LHCI_ENV || env;

if (environments[lhciEnv]) {
  module.exports = environments[lhciEnv];
} else {
  console.warn(`Unknown environment: ${lhciEnv}, falling back to development`);
  module.exports = environments.development;
}