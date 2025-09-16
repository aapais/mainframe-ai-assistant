/**
 * Babel Configuration for v8 Transparency Testing
 * Supports React JSX, TypeScript, and modern JavaScript features
 */

module.exports = {
  presets: [
    // Environment preset for Node.js and browser compatibility
    ['@babel/preset-env', {
      targets: {
        node: 'current',
        browsers: ['last 2 versions', 'not dead']
      },
      modules: 'auto',
      useBuiltIns: 'usage',
      corejs: 3
    }],

    // React preset with automatic JSX runtime
    ['@babel/preset-react', {
      runtime: 'automatic',
      development: process.env.NODE_ENV === 'development'
    }],

    // TypeScript preset
    ['@babel/preset-typescript', {
      isTSX: true,
      allExtensions: true
    }]
  ],

  plugins: [
    // Class properties support
    '@babel/plugin-proposal-class-properties',

    // Decorators support for future MVPs
    ['@babel/plugin-proposal-decorators', { legacy: true }],

    // Optional chaining and nullish coalescing
    '@babel/plugin-proposal-optional-chaining',
    '@babel/plugin-proposal-nullish-coalescing-operator',

    // Dynamic imports
    '@babel/plugin-syntax-dynamic-import',

    // Object rest spread
    '@babel/plugin-proposal-object-rest-spread',

    // Async/await support
    '@babel/plugin-transform-async-to-generator',

    // Runtime helpers
    ['@babel/plugin-transform-runtime', {
      corejs: false,
      helpers: true,
      regenerator: true,
      useESModules: false
    }]
  ],

  env: {
    // Test environment specific configuration
    test: {
      presets: [
        ['@babel/preset-env', {
          targets: { node: 'current' },
          modules: 'commonjs'
        }],
        ['@babel/preset-react', {
          runtime: 'automatic'
        }],
        '@babel/preset-typescript'
      ],
      plugins: [
        // Test-specific plugins
        'babel-plugin-dynamic-import-node'
      ]
    },

    // Development environment
    development: {
      plugins: [
        // Hot reloading support
        'react-refresh/babel'
      ]
    },

    // Production environment
    production: {
      plugins: [
        // Production optimizations
        '@babel/plugin-transform-react-inline-elements',
        '@babel/plugin-transform-react-constant-elements'
      ]
    }
  },

  // Source maps for debugging
  sourceMaps: true,
  retainLines: true,

  // Ignore patterns
  ignore: [
    'node_modules/**',
    'dist/**',
    'build/**',
    'coverage/**'
  ]
};