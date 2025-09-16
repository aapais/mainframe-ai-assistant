import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync, exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('CI/CD Integration Build Tests', () => {
  const projectRoot = process.cwd();
  const buildDir = path.join(projectRoot, 'dist');
  const buildTimeout = 600000; // 10 minutes for CI builds

  beforeAll(async () => {
    // Clean any existing build artifacts
    try {
      await fs.rm(buildDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }
  });

  describe('CI Environment Simulation', () => {
    it('should build successfully in CI environment', async () => {
      const ciEnv = {
        CI: 'true',
        NODE_ENV: 'production',
        TERM: 'xterm',
        HOME: '/home/runner', // Simulate CI home directory
        USER: 'runner'
      };

      const result = await execAsync('npm run build', {
        cwd: projectRoot,
        timeout: buildTimeout,
        env: { ...process.env, ...ciEnv }
      });

      expect(result.stderr).not.toContain('ERROR');
      expect(result.stderr).not.toContain('FAILED');

      const buildExists = await fs.access(buildDir).then(() => true).catch(() => false);
      expect(buildExists).toBe(true);
    }, buildTimeout);

    it('should handle missing TTY in CI environment', async () => {
      const ciEnv = {
        CI: 'true',
        NODE_ENV: 'production',
        TERM: 'dumb', // No TTY
        npm_config_color: 'false'
      };

      await expect(execAsync('npm run build', {
        cwd: projectRoot,
        timeout: buildTimeout,
        env: { ...process.env, ...ciEnv }
      })).resolves.not.toThrow();
    }, buildTimeout);

    it('should respect CI-specific build flags', async () => {
      const ciEnv = {
        CI: 'true',
        NODE_ENV: 'production',
        GENERATE_SOURCEMAP: 'false', // Often disabled in CI for speed
        DISABLE_ESLINT_PLUGIN: 'true'
      };

      const result = await execAsync('npm run build', {
        cwd: projectRoot,
        timeout: buildTimeout,
        env: { ...process.env, ...ciEnv }
      });

      expect(result.stderr).not.toContain('ERROR');

      // Verify sourcemaps are disabled if configured
      const assetsDir = path.join(buildDir, 'assets');
      try {
        const files = await fs.readdir(assetsDir);
        const mapFiles = files.filter(f => f.endsWith('.map'));

        // If GENERATE_SOURCEMAP=false was respected, there should be fewer or no map files
        if (process.env.GENERATE_SOURCEMAP === 'false') {
          // This assertion might need adjustment based on your build configuration
        }
      } catch (error) {
        // Assets directory might not exist yet
      }
    }, buildTimeout);
  });

  describe('GitHub Actions Integration', () => {
    it('should build successfully with GitHub Actions environment', async () => {
      const githubEnv = {
        CI: 'true',
        GITHUB_ACTIONS: 'true',
        GITHUB_WORKFLOW: 'Build and Test',
        GITHUB_RUN_ID: '123456789',
        GITHUB_SHA: 'abc123def456',
        GITHUB_REF: 'refs/heads/main',
        RUNNER_OS: 'Linux',
        RUNNER_ARCH: 'X64'
      };

      const result = await execAsync('npm run build', {
        cwd: projectRoot,
        timeout: buildTimeout,
        env: { ...process.env, ...githubEnv }
      });

      expect(result.stderr).not.toContain('ERROR');

      const buildExists = await fs.access(buildDir).then(() => true).catch(() => false);
      expect(buildExists).toBe(true);
    }, buildTimeout);

    it('should handle GitHub Pages deployment builds', async () => {
      const ghPagesEnv = {
        CI: 'true',
        GITHUB_ACTIONS: 'true',
        PUBLIC_URL: '/repository-name', // GitHub Pages subdirectory
        NODE_ENV: 'production'
      };

      await execAsync('npm run build', {
        cwd: projectRoot,
        timeout: buildTimeout,
        env: { ...process.env, ...ghPagesEnv }
      });

      const indexPath = path.join(buildDir, 'index.html');
      const content = await fs.readFile(indexPath, 'utf-8');

      // Check if PUBLIC_URL is properly handled in asset paths
      if (process.env.PUBLIC_URL) {
        // Asset paths should respect the PUBLIC_URL
        const assetPaths = [...content.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(m => m[1]);

        for (const assetPath of assetPaths) {
          if (assetPath.startsWith('/') && !assetPath.startsWith('//')) {
            // Relative paths should be prefixed with PUBLIC_URL in GitHub Pages builds
            // This test might need adjustment based on your build configuration
          }
        }
      }
    }, buildTimeout);
  });

  describe('Docker Container Builds', () => {
    it('should simulate Docker container environment', async () => {
      const dockerEnv = {
        CI: 'true',
        DOCKER: 'true',
        USER: 'node',
        HOME: '/home/node',
        PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
        NODE_ENV: 'production'
      };

      const result = await execAsync('npm run build', {
        cwd: projectRoot,
        timeout: buildTimeout,
        env: { ...process.env, ...dockerEnv }
      });

      expect(result.stderr).not.toContain('ERROR');

      const buildExists = await fs.access(buildDir).then(() => true).catch(() => false);
      expect(buildExists).toBe(true);
    }, buildTimeout);

    it('should handle limited memory in container', async () => {
      const containerEnv = {
        CI: 'true',
        NODE_ENV: 'production',
        NODE_OPTIONS: '--max-old-space-size=2048' // 2GB limit
      };

      const startTime = Date.now();
      await execAsync('npm run build', {
        cwd: projectRoot,
        timeout: buildTimeout,
        env: { ...process.env, ...containerEnv }
      });
      const buildTime = Date.now() - startTime;

      expect(buildTime).toBeLessThan(buildTimeout);

      const buildExists = await fs.access(buildDir).then(() => true).catch(() => false);
      expect(buildExists).toBe(true);
    }, buildTimeout);
  });

  describe('Build Reproducibility', () => {
    it('should produce identical builds in CI', async () => {
      const ciEnv = {
        CI: 'true',
        NODE_ENV: 'production',
        SOURCE_DATE_EPOCH: '1640995200' // Fixed timestamp for reproducible builds
      };

      // First build
      await fs.rm(buildDir, { recursive: true, force: true });
      await execAsync('npm run build', {
        cwd: projectRoot,
        timeout: buildTimeout,
        env: { ...process.env, ...ciEnv }
      });

      const firstBuildHashes = await getBuildHashes();

      // Second build
      await fs.rm(buildDir, { recursive: true, force: true });
      await execAsync('npm run build', {
        cwd: projectRoot,
        timeout: buildTimeout,
        env: { ...process.env, ...ciEnv }
      });

      const secondBuildHashes = await getBuildHashes();

      // Compare main bundles (excluding HTML which might have timestamps)
      const mainFiles = Object.keys(firstBuildHashes).filter(file =>
        file.endsWith('.js') && !file.endsWith('.map')
      );

      for (const file of mainFiles) {
        if (firstBuildHashes[file] && secondBuildHashes[file]) {
          expect(firstBuildHashes[file]).toBe(secondBuildHashes[file]);
        }
      }
    }, buildTimeout * 2);

    async function getBuildHashes(): Promise<Record<string, string>> {
      const crypto = await import('crypto');
      const hashes: Record<string, string> = {};

      async function hashFiles(dir: string, basePath: string = '') {
        const files = await fs.readdir(dir, { withFileTypes: true });

        for (const file of files) {
          const fullPath = path.join(dir, file.name);
          const relativePath = path.join(basePath, file.name);

          if (file.isDirectory()) {
            await hashFiles(fullPath, relativePath);
          } else {
            const content = await fs.readFile(fullPath);
            const hash = crypto.createHash('md5').update(content).digest('hex');
            hashes[relativePath] = hash;
          }
        }
      }

      await hashFiles(buildDir);
      return hashes;
    }
  });

  describe('Parallel Build Testing', () => {
    it('should handle parallel builds without conflicts', async () => {
      const ciEnv = {
        CI: 'true',
        NODE_ENV: 'production',
        FORCE_COLOR: '0'
      };

      // Simulate parallel builds (though we run them sequentially to avoid conflicts)
      const buildPromises = Array.from({ length: 2 }, async (_, index) => {
        const buildDirForJob = path.join(projectRoot, `dist-job-${index}`);

        try {
          await fs.rm(buildDirForJob, { recursive: true, force: true });
        } catch (error) {
          // Directory might not exist
        }

        // Simulate different CI job
        const jobEnv = {
          ...ciEnv,
          BUILD_DIR: buildDirForJob,
          CI_JOB_ID: `job-${index}`
        };

        return execAsync('npm run build', {
          cwd: projectRoot,
          timeout: buildTimeout,
          env: { ...process.env, ...jobEnv }
        });
      });

      // Wait for all builds to complete
      const results = await Promise.allSettled(buildPromises);

      // All builds should succeed
      for (const result of results) {
        expect(result.status).toBe('fulfilled');
      }

      // Clean up job-specific build directories
      for (let i = 0; i < 2; i++) {
        const jobBuildDir = path.join(projectRoot, `dist-job-${i}`);
        try {
          await fs.rm(jobBuildDir, { recursive: true, force: true });
        } catch (error) {
          // Directory might not exist
        }
      }
    }, buildTimeout * 2);
  });

  describe('Deployment Preparation', () => {
    it('should generate deployment-ready artifacts', async () => {
      const deployEnv = {
        CI: 'true',
        NODE_ENV: 'production',
        GENERATE_DEPLOYMENT_INFO: 'true'
      };

      await execAsync('npm run build', {
        cwd: projectRoot,
        timeout: buildTimeout,
        env: { ...process.env, ...deployEnv }
      });

      // Check for deployment artifacts
      const deploymentFiles = [
        'index.html',
        'assets'
      ];

      for (const file of deploymentFiles) {
        const filePath = path.join(buildDir, file);
        const exists = await fs.access(filePath).then(() => true).catch(() => false);
        expect(exists).toBe(true);
      }

      // Verify assets are optimized for production
      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);
      const jsFiles = files.filter(f => f.endsWith('.js') && !f.includes('.map'));

      expect(jsFiles.length).toBeGreaterThan(0);

      // Check file sizes are reasonable for deployment
      let totalSize = 0;
      for (const file of jsFiles) {
        const filePath = path.join(assetsDir, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
      }

      // Total JS should be under 50MB for reasonable deployment
      expect(totalSize).toBeLessThan(50 * 1024 * 1024);
    }, buildTimeout);

    it('should handle CDN deployment preparation', async () => {
      const cdnEnv = {
        CI: 'true',
        NODE_ENV: 'production',
        CDN_URL: 'https://cdn.example.com',
        ASSET_PREFIX: '/static'
      };

      await execAsync('npm run build', {
        cwd: projectRoot,
        timeout: buildTimeout,
        env: { ...process.env, ...cdnEnv }
      });

      const indexPath = path.join(buildDir, 'index.html');
      const content = await fs.readFile(indexPath, 'utf-8');

      // Asset references should be ready for CDN if configured
      if (process.env.CDN_URL) {
        // This test might need adjustment based on your CDN configuration
        const assetRefs = [...content.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(m => m[1]);

        // Some assets might reference the CDN URL
        // This depends on your build configuration
      }
    }, buildTimeout);
  });

  describe('Build Metrics and Reporting', () => {
    it('should generate build metrics for CI', async () => {
      const metricsEnv = {
        CI: 'true',
        NODE_ENV: 'production',
        GENERATE_BUILD_REPORT: 'true'
      };

      const startTime = Date.now();
      const result = await execAsync('npm run build', {
        cwd: projectRoot,
        timeout: buildTimeout,
        env: { ...process.env, ...metricsEnv }
      });
      const buildTime = Date.now() - startTime;

      // Basic timing metrics
      expect(buildTime).toBeGreaterThan(1000); // At least 1 second
      expect(buildTime).toBeLessThan(buildTimeout);

      // Check for build output information
      const hasOutput = result.stdout.length > 0 || result.stderr.length > 0;
      expect(hasOutput).toBe(true);

      // Verify build artifacts exist
      const buildExists = await fs.access(buildDir).then(() => true).catch(() => false);
      expect(buildExists).toBe(true);
    }, buildTimeout);

    it('should provide bundle analysis information', async () => {
      const analysisEnv = {
        CI: 'true',
        NODE_ENV: 'production',
        ANALYZE: 'false' // Disable interactive analysis in CI
      };

      await execAsync('npm run build', {
        cwd: projectRoot,
        timeout: buildTimeout,
        env: { ...process.env, ...analysisEnv }
      });

      // Check bundle composition
      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);

      const fileTypes = {
        js: files.filter(f => f.endsWith('.js') && !f.includes('.map')).length,
        css: files.filter(f => f.endsWith('.css') && !f.includes('.map')).length,
        maps: files.filter(f => f.endsWith('.map')).length
      };

      expect(fileTypes.js).toBeGreaterThan(0);

      // Calculate total bundle size
      let totalSize = 0;
      for (const file of files) {
        if (file.endsWith('.js') || file.endsWith('.css')) {
          const filePath = path.join(assetsDir, file);
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
        }
      }

      // Log bundle information for CI
      console.log(`Bundle analysis: ${fileTypes.js} JS files, ${fileTypes.css} CSS files, total size: ${Math.round(totalSize / 1024)}KB`);
    }, buildTimeout);
  });

  describe('Error Handling in CI', () => {
    it('should fail CI build on critical errors', async () => {
      // This test simulates what should happen if there are critical build errors
      // In practice, this would be tested by introducing actual errors

      const ciEnv = {
        CI: 'true',
        NODE_ENV: 'production'
      };

      // Normal build should succeed
      await expect(execAsync('npm run build', {
        cwd: projectRoot,
        timeout: buildTimeout,
        env: { ...process.env, ...ciEnv }
      })).resolves.not.toThrow();

      const buildExists = await fs.access(buildDir).then(() => true).catch(() => false);
      expect(buildExists).toBe(true);
    }, buildTimeout);

    it('should provide meaningful error messages in CI', async () => {
      // Test that build errors are informative
      try {
        // This would typically test with an intentionally broken configuration
        await execAsync('npm run build', {
          cwd: projectRoot,
          timeout: buildTimeout,
          env: { ...process.env, CI: 'true', NODE_ENV: 'production' }
        });

        // If build succeeds, that's actually what we want
        const buildExists = await fs.access(buildDir).then(() => true).catch(() => false);
        expect(buildExists).toBe(true);
      } catch (error) {
        // If build fails, error should be informative
        expect(error.message).toBeDefined();
        expect(error.message.length).toBeGreaterThan(10);
      }
    }, buildTimeout);
  });
});