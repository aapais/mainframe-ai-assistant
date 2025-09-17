/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],

    // Test file patterns
    include: [
      'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],

    exclude: [
      'node_modules',
      'dist',
      'dist-electron',
      '.git',
      '.cache',
      'tests/e2e/**',
      'tests/visual/**'
    ],

    // Timeouts
    testTimeout: 30000,
    hookTimeout: 10000,

    // Parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 4,
        minThreads: 1
      }
    },

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'cobertura'],
      reportsDirectory: './coverage',

      // Coverage thresholds
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        }
      },

      // Include/exclude patterns
      include: [
        'src/**/*.{js,ts,jsx,tsx}'
      ],

      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.{js,ts,jsx,tsx}',
        'src/**/*.spec.{js,ts,jsx,tsx}',
        'src/test-setup.ts',
        'src/main/**/*', // Exclude Electron main process
        'tests/**/*',
        'node_modules/**/*',
        'dist/**/*'
      ]
    },

    // Reporter configuration
    reporter: [
      'verbose',
      'html',
      'json'
    ],

    outputFile: {
      html: './test-reports/html/index.html',
      json: './test-reports/json/results.json'
    },

    // Watch configuration
    watch: false, // Disable by default, enable in dev

    // Environment variables for tests
    env: {
      NODE_ENV: 'test',
      VITE_TEST_MODE: 'true'
    }
  },

  // Vite configuration for test build
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests')
    }
  },

  // Define global constants for tests
  define: {
    __TEST__: true,
    __VITEST__: true
  },

  // Optimize deps for testing
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@testing-library/react',
      '@testing-library/user-event',
      '@testing-library/jest-dom'
    ]
  }
});