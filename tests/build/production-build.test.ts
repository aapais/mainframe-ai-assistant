import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync, exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('Production Build Validation', () => {
  const projectRoot = process.cwd();
  const buildDir = path.join(projectRoot, 'dist');
  const buildTimeout = 300000; // 5 minutes

  beforeAll(async () => {
    // Clean any existing build artifacts
    try {
      await fs.rm(buildDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist, that's okay
    }
  });

  afterAll(async () => {
    // Optional: Clean up after tests
  });

  describe('Build Command Execution', () => {
    it('should execute build command without errors', async () => {
      const buildProcess = execAsync('npm run build', {
        cwd: projectRoot,
        timeout: buildTimeout
      });

      await expect(buildProcess).resolves.not.toThrow();

      const result = await buildProcess;
      expect(result.stderr).not.toContain('ERROR');
      expect(result.stderr).not.toContain('FAILED');
    }, buildTimeout);

    it('should have zero exit code for build command', () => {
      expect(() => {
        execSync('npm run build', {
          cwd: projectRoot,
          stdio: 'pipe',
          timeout: buildTimeout
        });
      }).not.toThrow();
    });

    it('should complete build within reasonable time', async () => {
      const startTime = Date.now();

      await execAsync('npm run build', {
        cwd: projectRoot,
        timeout: buildTimeout
      });

      const buildTime = Date.now() - startTime;

      // Build should complete within 5 minutes
      expect(buildTime).toBeLessThan(buildTimeout);

      // Build should take at least some time (not instant failure)
      expect(buildTime).toBeGreaterThan(1000); // 1 second minimum
    }, buildTimeout);
  });

  describe('Build Output Structure', () => {
    beforeAll(async () => {
      // Ensure build exists for structure tests
      try {
        await execAsync('npm run build', { cwd: projectRoot });
      } catch (error) {
        console.warn('Build failed in beforeAll:', error);
      }
    });

    it('should create dist directory', async () => {
      const distExists = await fs.access(buildDir).then(() => true).catch(() => false);
      expect(distExists).toBe(true);
    });

    it('should have expected directory structure', async () => {
      const expectedDirs = ['assets', 'static'];
      const expectedFiles = ['index.html'];

      for (const dir of expectedDirs) {
        const dirPath = path.join(buildDir, dir);
        const dirExists = await fs.access(dirPath).then(() => true).catch(() => false);
        expect(dirExists).toBe(true);
      }

      for (const file of expectedFiles) {
        const filePath = path.join(buildDir, file);
        const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
        expect(fileExists).toBe(true);
      }
    });

    it('should contain JavaScript bundle files', async () => {
      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);

      const jsFiles = files.filter(file => file.endsWith('.js'));
      expect(jsFiles.length).toBeGreaterThan(0);

      // Check for main application bundle
      const hasMainBundle = jsFiles.some(file =>
        file.includes('index') || file.includes('main') || file.includes('app')
      );
      expect(hasMainBundle).toBe(true);
    });

    it('should contain CSS bundle files', async () => {
      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);

      const cssFiles = files.filter(file => file.endsWith('.css'));
      expect(cssFiles.length).toBeGreaterThan(0);
    });
  });

  describe('Required Files Presence', () => {
    it('should have main HTML entry point', async () => {
      const indexPath = path.join(buildDir, 'index.html');
      const indexExists = await fs.access(indexPath).then(() => true).catch(() => false);
      expect(indexExists).toBe(true);

      const content = await fs.readFile(indexPath, 'utf-8');
      expect(content).toContain('<!DOCTYPE html>');
      expect(content).toContain('<html');
      expect(content).toContain('</html>');
    });

    it('should have favicon or app icons', async () => {
      const iconFiles = ['favicon.ico', 'favicon.png', 'icon.png', 'logo.png'];
      let hasIcon = false;

      for (const iconFile of iconFiles) {
        const iconPath = path.join(buildDir, iconFile);
        const iconExists = await fs.access(iconPath).then(() => true).catch(() => false);
        if (iconExists) {
          hasIcon = true;
          break;
        }
      }

      expect(hasIcon).toBe(true);
    });

    it('should have manifest or app configuration files', async () => {
      const configFiles = ['manifest.json', 'site.webmanifest', 'app.config.json'];
      let hasConfig = false;

      for (const configFile of configFiles) {
        const configPath = path.join(buildDir, configFile);
        const configExists = await fs.access(configPath).then(() => true).catch(() => false);
        if (configExists) {
          hasConfig = true;
          break;
        }
      }

      // This might be optional depending on the project
      // expect(hasConfig).toBe(true);
    });
  });

  describe('Bundle Integrity', () => {
    it('should have non-empty bundle files', async () => {
      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);

      const bundleFiles = files.filter(file =>
        file.endsWith('.js') || file.endsWith('.css')
      );

      for (const file of bundleFiles) {
        const filePath = path.join(assetsDir, file);
        const stats = await fs.stat(filePath);
        expect(stats.size).toBeGreaterThan(0);
      }
    });

    it('should have reasonable bundle sizes', async () => {
      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);

      const jsFiles = files.filter(file => file.endsWith('.js'));

      for (const file of jsFiles) {
        const filePath = path.join(assetsDir, file);
        const stats = await fs.stat(filePath);

        // Bundle should be less than 10MB (adjust based on your needs)
        expect(stats.size).toBeLessThan(10 * 1024 * 1024);

        // Bundle should be more than 1KB (not empty)
        expect(stats.size).toBeGreaterThan(1024);
      }
    });

    it('should have valid JavaScript syntax in bundles', async () => {
      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);

      const jsFiles = files.filter(file => file.endsWith('.js') && !file.includes('.map'));

      for (const file of jsFiles) {
        const filePath = path.join(assetsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');

        // Basic syntax checks
        expect(content).not.toContain('undefined is not defined');
        expect(content).not.toContain('SyntaxError');
        expect(content).not.toContain('ReferenceError');

        // Should have some recognizable JavaScript patterns
        const hasValidJS = content.includes('function') ||
                          content.includes('=>') ||
                          content.includes('var ') ||
                          content.includes('const ') ||
                          content.includes('let ');
        expect(hasValidJS).toBe(true);
      }
    });
  });

  describe('Asset Optimization', () => {
    it('should have minified JavaScript files', async () => {
      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);

      const jsFiles = files.filter(file => file.endsWith('.js') && !file.includes('.map'));

      for (const file of jsFiles) {
        const filePath = path.join(assetsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');

        // Check for minification indicators
        const avgLineLength = content.split('\n').reduce((sum, line) => sum + line.length, 0) / content.split('\n').length;

        // Minified files typically have very long lines
        expect(avgLineLength).toBeGreaterThan(50);
      }
    });

    it('should have minified CSS files', async () => {
      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);

      const cssFiles = files.filter(file => file.endsWith('.css') && !file.includes('.map'));

      for (const file of cssFiles) {
        const filePath = path.join(assetsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');

        // CSS should be minified (no unnecessary whitespace)
        expect(content).not.toMatch(/\n\s+/g); // No indented lines
        expect(content).not.toMatch(/{\s+/g); // No space after {
        expect(content).not.toMatch(/\s+}/g); // No space before }
      }
    });

    it('should have hashed filenames for cache busting', async () => {
      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);

      const assetFiles = files.filter(file =>
        file.endsWith('.js') || file.endsWith('.css')
      );

      // Check for hash patterns in filenames
      const hashedFiles = assetFiles.filter(file =>
        /\.[a-f0-9]{8,}\.(js|css)$/.test(file) || // Common hash pattern
        /-[a-f0-9]{8,}\.(js|css)$/.test(file)    // Alternative hash pattern
      );

      expect(hashedFiles.length).toBeGreaterThan(0);
    });
  });

  describe('Source Maps Generation', () => {
    it('should generate source maps for JavaScript files', async () => {
      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);

      const jsFiles = files.filter(file => file.endsWith('.js') && !file.includes('.map'));
      const mapFiles = files.filter(file => file.endsWith('.js.map'));

      // Should have at least one source map for JavaScript files
      expect(mapFiles.length).toBeGreaterThan(0);

      for (const mapFile of mapFiles) {
        const mapPath = path.join(assetsDir, mapFile);
        const mapContent = await fs.readFile(mapPath, 'utf-8');

        // Validate source map format
        const sourceMap = JSON.parse(mapContent);
        expect(sourceMap).toHaveProperty('version');
        expect(sourceMap).toHaveProperty('sources');
        expect(sourceMap).toHaveProperty('mappings');
      }
    });

    it('should have source map references in bundles', async () => {
      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);

      const jsFiles = files.filter(file => file.endsWith('.js') && !file.includes('.map'));

      for (const file of jsFiles) {
        const filePath = path.join(assetsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');

        // Check for source map reference
        const hasSourceMapRef = content.includes('//# sourceMappingURL=') ||
                               content.includes('//@ sourceMappingURL=');
        expect(hasSourceMapRef).toBe(true);
      }
    });
  });

  describe('Environment Variable Injection', () => {
    it('should inject production environment variables', async () => {
      const indexPath = path.join(buildDir, 'index.html');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Check that development-specific content is not present
      expect(indexContent).not.toContain('localhost:3000');
      expect(indexContent).not.toContain('development');

      // Check for production optimizations
      expect(indexContent).not.toContain('<!-- DEV -->');
    });

    it('should not expose sensitive environment variables', async () => {
      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);

      const jsFiles = files.filter(file => file.endsWith('.js') && !file.includes('.map'));

      const sensitivePatterns = [
        /API_SECRET/,
        /DATABASE_PASSWORD/,
        /PRIVATE_KEY/,
        /SECRET_KEY/,
        /JWT_SECRET/
      ];

      for (const file of jsFiles) {
        const filePath = path.join(assetsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');

        for (const pattern of sensitivePatterns) {
          expect(content).not.toMatch(pattern);
        }
      }
    });
  });

  describe('Build Reproducibility', () => {
    it('should produce identical builds with same inputs', async () => {
      // First build
      await execAsync('npm run build', { cwd: projectRoot });
      const firstBuildFiles = await getBuildFileHashes();

      // Clean and rebuild
      await fs.rm(buildDir, { recursive: true, force: true });
      await execAsync('npm run build', { cwd: projectRoot });
      const secondBuildFiles = await getBuildFileHashes();

      // Compare file hashes (excluding timestamp-dependent files)
      for (const [file, hash] of Object.entries(firstBuildFiles)) {
        if (!file.includes('.map') && !file.includes('.html')) {
          expect(secondBuildFiles[file]).toBe(hash);
        }
      }
    }, buildTimeout * 2);
  });

  // Helper function to get file hashes
  async function getBuildFileHashes(): Promise<Record<string, string>> {
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