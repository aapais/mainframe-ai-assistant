module.exports = {
  ci: {
    collect: {
      // Lighthouse collection settings
      url: [
        'http://localhost:3000', // Main app URL
        'http://localhost:3000/dashboard',
        'http://localhost:3000/settings'
      ],
      numberOfRuns: 3, // Run Lighthouse 3 times for each URL
      settings: {
        chromeFlags: '--no-sandbox --disable-gpu --headless',
        preset: 'desktop', // or 'mobile'
        throttling: {
          rttMs: 40,
          throughputKbps: 10240,
          cpuSlowdownMultiplier: 1
        },
        // Electron-specific settings
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
    assert: {
      // Performance budgets and assertions
      preset: 'lighthouse:recommended',
      assertions: {
        // Core Web Vitals
        'first-contentful-paint': ['error', { maxNumericValue: 1800 }], // < 1.8s
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }], // < 2.5s
        'first-meaningful-paint': ['warn', { maxNumericValue: 2000 }], // < 2s
        'speed-index': ['warn', { maxNumericValue: 3000 }], // < 3s
        'interactive': ['error', { maxNumericValue: 3800 }], // < 3.8s
        'first-cpu-idle': ['warn', { maxNumericValue: 3500 }], // < 3.5s
        'max-potential-fid': ['error', { maxNumericValue: 100 }], // < 100ms
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }], // < 0.1

        // Performance score
        'categories:performance': ['error', { minScore: 0.85 }], // > 85%
        'categories:accessibility': ['warn', { minScore: 0.90 }], // > 90%
        'categories:best-practices': ['warn', { minScore: 0.85 }], // > 85%
        'categories:seo': ['warn', { minScore: 0.80 }], // > 80%
        'categories:pwa': ['warn', { minScore: 0.70 }], // > 70%

        // Resource budgets
        'resource-summary:script:size': ['error', { maxNumericValue: 250000 }], // < 250KB JS
        'resource-summary:stylesheet:size': ['warn', { maxNumericValue: 50000 }], // < 50KB CSS
        'resource-summary:image:size': ['warn', { maxNumericValue: 500000 }], // < 500KB images
        'resource-summary:total:size': ['error', { maxNumericValue: 1000000 }], // < 1MB total

        // Network requests
        'resource-summary:total:count': ['warn', { maxNumericValue: 50 }], // < 50 requests
        'unused-javascript': ['warn', { maxNumericValue: 50000 }], // < 50KB unused JS
        'unused-css-rules': ['warn', { maxNumericValue: 20000 }], // < 20KB unused CSS

        // Security and best practices
        'is-on-https': 'off', // Skip for local development
        'uses-http2': 'off', // Skip for local development
        'viewport': ['error', { minScore: 1 }],
        'without-javascript': 'off', // Skip for SPA

        // Electron-specific optimizations
        'bootup-time': ['warn', { maxNumericValue: 3000 }], // < 3s bootup
        'mainthread-work-breakdown': ['warn', { maxNumericValue: 2000 }], // < 2s main thread
        'third-party-summary': ['warn', { maxNumericValue: 500 }] // < 500ms third-party
      }
    },
    upload: {
      target: 'filesystem',
      outputDir: './reports/lighthouse'
    },
    server: {
      port: 9001,
      storage: {
        storageMethod: 'sql',
        sqlDialect: 'sqlite',
        sqlDatabasePath: './reports/lighthouse/lhci.db'
      }
    }
  }
};