/**
 * Vitest Configuration for TypeScript Type Tests
 * Specialized configuration for running type-only tests
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Type testing specific configuration
    typecheck: {
      enabled: true,
      tsconfig: path.resolve(__dirname, '../../tsconfig.test.json'),
      include: ['**/*.type.test.ts'],
      checker: 'tsc'
    },

    // Test environment
    environment: 'jsdom',

    // Include patterns for type tests
    include: ['**/*.type.test.ts'],

    // Exclude patterns
    exclude: [
      'node_modules/**',
      'dist/**',
      '**/*.spec.ts',
      '**/*.test.tsx'
    ],

    // Globals
    globals: true,

    // Coverage configuration for type tests
    coverage: {
      enabled: false, // Type tests don't need runtime coverage
      provider: 'v8'
    },

    // Reporter configuration
    reporter: ['verbose', 'json'],

    // Timeout settings
    testTimeout: 30000,
    hookTimeout: 10000,

    // Retry configuration
    retry: 1,

    // Concurrent execution
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 1
      }
    }
  },

  // Resolve configuration
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../src'),
      '@components': path.resolve(__dirname, '../../src/renderer/components'),
      '@utils': path.resolve(__dirname, '../../src/renderer/utils'),
      '@types': path.resolve(__dirname, '../../src/types')
    }
  },

  // Define configuration
  define: {
    'process.env.NODE_ENV': '"test"'
  }
});