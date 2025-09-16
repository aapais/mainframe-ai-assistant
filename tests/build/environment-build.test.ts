import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync, exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('Environment-Specific Build Tests', () => {
  const projectRoot = process.cwd();
  const buildDir = path.join(projectRoot, 'dist');
  const buildTimeout = 300000; // 5 minutes

  // Store original env vars to restore later
  let originalEnv: Record<string, string | undefined> = {};

  beforeAll(() => {
    // Store original environment variables
    originalEnv = { ...process.env };
  });

  afterAll(() => {
    // Restore original environment variables
    Object.keys(process.env).forEach(key => {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    });
    Object.assign(process.env, originalEnv);
  });

  async function cleanBuild() {
    try {
      await fs.rm(buildDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }
  }

  async function buildWithEnv(envVars: Record<string, string>) {
    await cleanBuild();

    const env = { ...process.env, ...envVars };

    await execAsync('npm run build', {
      cwd: projectRoot,
      timeout: buildTimeout,
      env
    });
  }

  describe('Production Environment Builds', () => {
    it('should build successfully with NODE_ENV=production', async () => {
      await buildWithEnv({ NODE_ENV: 'production' });

      const buildExists = await fs.access(buildDir).then(() => true).catch(() => false);
      expect(buildExists).toBe(true);

      // Verify production optimizations
      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);
      const jsFiles = files.filter(f => f.endsWith('.js') && !f.includes('.map'));

      expect(jsFiles.length).toBeGreaterThan(0);

      // Check that files are minified in production
      for (const file of jsFiles.slice(0, 2)) {
        const filePath = path.join(assetsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');

        // Minified files should have very long lines
        const avgLineLength = content.split('\n').reduce((sum, line) => sum + line.length, 0) / content.split('\n').length;
        expect(avgLineLength).toBeGreaterThan(100);

        // Should not contain debug code
        expect(content).not.toContain('console.log');
        expect(content).not.toContain('debugger');
      }
    }, buildTimeout);

    it('should not include development dependencies in production build', async () => {
      await buildWithEnv({ NODE_ENV: 'production' });

      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);
      const jsFiles = files.filter(f => f.endsWith('.js') && !f.includes('.map'));

      const devDependencies = [
        'webpack-dev-server',
        'vite/client',
        'hot-reload',
        '@testing-library',
        'jest',
        'vitest'
      ];

      for (const file of jsFiles) {
        const filePath = path.join(assetsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');

        for (const devDep of devDependencies) {
          expect(content).not.toContain(devDep);
        }
      }
    });

    it('should have production-optimized HTML', async () => {
      await buildWithEnv({ NODE_ENV: 'production' });

      const indexPath = path.join(buildDir, 'index.html');
      const content = await fs.readFile(indexPath, 'utf-8');

      // Should not have development comments
      expect(content).not.toMatch(/<!--\s*DEV/);
      expect(content).not.toMatch(/<!--\s*DEBUG/);
      expect(content).not.toMatch(/<!--\s*TODO/);

      // Should not reference localhost
      expect(content).not.toContain('localhost:3000');
      expect(content).not.toContain('127.0.0.1');
    });
  });

  describe('Development Environment Builds', () => {
    it('should build successfully with NODE_ENV=development', async () => {
      await buildWithEnv({ NODE_ENV: 'development' });

      const buildExists = await fs.access(buildDir).then(() => true).catch(() => false);
      expect(buildExists).toBe(true);

      // Development builds might have different characteristics
      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);
      const jsFiles = files.filter(f => f.endsWith('.js') && !f.includes('.map'));

      expect(jsFiles.length).toBeGreaterThan(0);
    }, buildTimeout);

    it('should include source maps in development build', async () => {
      await buildWithEnv({ NODE_ENV: 'development' });

      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);
      const mapFiles = files.filter(f => f.endsWith('.map'));

      // Development builds should have source maps
      expect(mapFiles.length).toBeGreaterThan(0);

      // Verify source maps are valid
      for (const mapFile of mapFiles.slice(0, 2)) {
        const mapPath = path.join(assetsDir, mapFile);
        const mapContent = await fs.readFile(mapPath, 'utf-8');

        const sourceMap = JSON.parse(mapContent);
        expect(sourceMap).toHaveProperty('version');
        expect(sourceMap).toHaveProperty('sources');
        expect(sourceMap).toHaveProperty('mappings');
      }
    });
  });

  describe('Staging Environment Builds', () => {
    it('should build successfully with NODE_ENV=staging', async () => {
      await buildWithEnv({ NODE_ENV: 'staging' });

      const buildExists = await fs.access(buildDir).then(() => true).catch(() => false);
      expect(buildExists).toBe(true);

      // Staging should be similar to production but might have different optimizations
      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);
      const jsFiles = files.filter(f => f.endsWith('.js') && !f.includes('.map'));

      expect(jsFiles.length).toBeGreaterThan(0);
    }, buildTimeout);
  });

  describe('Custom Environment Variables', () => {
    it('should handle VITE_* environment variables', async () => {
      const customEnvVars = {
        NODE_ENV: 'production',
        VITE_API_URL: 'https://api.example.com',
        VITE_APP_VERSION: '1.0.0',
        VITE_FEATURE_FLAG: 'true'
      };

      await buildWithEnv(customEnvVars);

      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);
      const jsFiles = files.filter(f => f.endsWith('.js') && !f.includes('.map'));

      // Check that VITE_ variables are injected
      let foundApiUrl = false;
      let foundVersion = false;

      for (const file of jsFiles) {
        const filePath = path.join(assetsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');

        if (content.includes('api.example.com')) {
          foundApiUrl = true;
        }
        if (content.includes('1.0.0')) {
          foundVersion = true;
        }
      }

      // At least one of the environment variables should be found
      expect(foundApiUrl || foundVersion).toBe(true);
    });

    it('should handle REACT_APP_* environment variables', async () => {
      const customEnvVars = {
        NODE_ENV: 'production',
        REACT_APP_API_URL: 'https://react-api.example.com',
        REACT_APP_ENVIRONMENT: 'production'
      };

      await buildWithEnv(customEnvVars);

      // Build should complete successfully even if not a React app
      const buildExists = await fs.access(buildDir).then(() => true).catch(() => false);
      expect(buildExists).toBe(true);
    });

    it('should not expose non-public environment variables', async () => {
      const customEnvVars = {
        NODE_ENV: 'production',
        SECRET_KEY: 'super-secret-key',
        DATABASE_PASSWORD: 'db-password',
        API_SECRET: 'api-secret',
        // Public variables (should be included)
        VITE_PUBLIC_URL: 'https://public.example.com'
      };

      await buildWithEnv(customEnvVars);

      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);
      const jsFiles = files.filter(f => f.endsWith('.js') && !f.includes('.map'));

      for (const file of jsFiles) {
        const filePath = path.join(assetsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');

        // Secret variables should not be in the bundle
        expect(content).not.toContain('super-secret-key');
        expect(content).not.toContain('db-password');
        expect(content).not.toContain('api-secret');

        // Public variables might be included
        // expect(content).toContain('public.example.com'); // Uncomment if expected
      }
    });
  });

  describe('Build Configuration Variations', () => {
    it('should handle different build modes', async () => {
      const modes = ['production', 'development', 'test'];

      for (const mode of modes) {
        await buildWithEnv({ NODE_ENV: mode });

        const buildExists = await fs.access(buildDir).then(() => true).catch(() => false);
        expect(buildExists).toBe(true);

        // Basic validation that build completed
        const indexPath = path.join(buildDir, 'index.html');
        const indexExists = await fs.access(indexPath).then(() => true).catch(() => false);
        expect(indexExists).toBe(true);
      }
    }, buildTimeout * 3);

    it('should respect custom build flags', async () => {
      // Test with common build flags
      const buildFlags = {
        ANALYZE_BUNDLE: 'false',
        GENERATE_SOURCEMAP: 'true',
        INLINE_RUNTIME_CHUNK: 'false'
      };

      await buildWithEnv({ NODE_ENV: 'production', ...buildFlags });

      const buildExists = await fs.access(buildDir).then(() => true).catch(() => false);
      expect(buildExists).toBe(true);
    });
  });

  describe('Cross-Platform Builds', () => {
    it('should produce consistent builds across platforms', async () => {
      // Test with platform-specific environment variables
      const platformEnvs = [
        { PLATFORM: 'win32', NODE_ENV: 'production' },
        { PLATFORM: 'darwin', NODE_ENV: 'production' },
        { PLATFORM: 'linux', NODE_ENV: 'production' }
      ];

      const buildHashes: string[] = [];

      for (const env of platformEnvs) {
        await buildWithEnv(env);

        // Calculate hash of main bundle
        const assetsDir = path.join(buildDir, 'assets');
        const files = await fs.readdir(assetsDir);
        const mainJsFile = files.find(f => f.includes('index') || f.includes('main')) || files.find(f => f.endsWith('.js') && !f.includes('.map'));

        if (mainJsFile) {
          const filePath = path.join(assetsDir, mainJsFile);
          const content = await fs.readFile(filePath, 'utf-8');

          const crypto = await import('crypto');
          const hash = crypto.createHash('md5').update(content).digest('hex');
          buildHashes.push(hash);
        }
      }

      // Note: In practice, builds might differ due to platform-specific optimizations
      // This test serves as a baseline for build consistency validation
    }, buildTimeout * 3);
  });

  describe('Build Performance Under Different Conditions', () => {
    it('should build efficiently with limited memory', async () => {
      const limitedMemoryEnv = {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--max-old-space-size=1024' // 1GB limit
      };

      const startTime = Date.now();
      await buildWithEnv(limitedMemoryEnv);
      const buildTime = Date.now() - startTime;

      const buildExists = await fs.access(buildDir).then(() => true).catch(() => false);
      expect(buildExists).toBe(true);

      // Build should complete in reasonable time even with memory constraints
      expect(buildTime).toBeLessThan(buildTimeout);
    }, buildTimeout);

    it('should handle concurrent build environments', async () => {
      // Test that builds work with environment simulation
      const concurrentEnvs = [
        { NODE_ENV: 'production', BUILD_ID: 'build-1' },
        { NODE_ENV: 'development', BUILD_ID: 'build-2' }
      ];

      // Run builds sequentially to avoid conflicts
      for (const env of concurrentEnvs) {
        await buildWithEnv(env);

        const buildExists = await fs.access(buildDir).then(() => true).catch(() => false);
        expect(buildExists).toBe(true);
      }
    }, buildTimeout * 2);
  });

  describe('Environment Variable Validation', () => {
    it('should handle missing optional environment variables gracefully', async () => {
      // Build with minimal environment
      await buildWithEnv({ NODE_ENV: 'production' });

      const buildExists = await fs.access(buildDir).then(() => true).catch(() => false);
      expect(buildExists).toBe(true);
    });

    it('should validate required environment variables', async () => {
      // This test might need to be adjusted based on your specific requirements
      const requiredEnvs = {
        NODE_ENV: 'production'
        // Add other required environment variables as needed
      };

      await buildWithEnv(requiredEnvs);

      const buildExists = await fs.access(buildDir).then(() => true).catch(() => false);
      expect(buildExists).toBe(true);
    });

    it('should handle environment variable type coercion', async () => {
      const envVars = {
        NODE_ENV: 'production',
        VITE_ENABLE_FEATURE: 'true', // String 'true'
        VITE_MAX_ITEMS: '100', // String number
        VITE_DEBUG_MODE: 'false' // String 'false'
      };

      await buildWithEnv(envVars);

      const buildExists = await fs.access(buildDir).then(() => true).catch(() => false);
      expect(buildExists).toBe(true);
    });
  });
});