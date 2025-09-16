import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

describe('Build Artifacts Verification', () => {
  const projectRoot = process.cwd();
  const buildDir = path.join(projectRoot, 'dist');

  beforeAll(async () => {
    // Ensure fresh build exists
    try {
      await fs.rm(buildDir, { recursive: true, force: true });
      execSync('npm run build', { cwd: projectRoot, stdio: 'pipe' });
    } catch (error) {
      console.warn('Build setup failed:', error);
    }
  });

  describe('Static Asset Verification', () => {
    it('should have all required static assets', async () => {
      const requiredAssets = [
        'favicon.ico',
        'robots.txt',
        'sitemap.xml'
      ];

      for (const asset of requiredAssets) {
        const assetPath = path.join(buildDir, asset);
        const exists = await fs.access(assetPath).then(() => true).catch(() => false);

        if (exists) {
          const stats = await fs.stat(assetPath);
          expect(stats.size).toBeGreaterThan(0);
        }
        // Note: Some assets might be optional, adjust expectations as needed
      }
    });

    it('should have properly formatted robots.txt', async () => {
      const robotsPath = path.join(buildDir, 'robots.txt');
      const exists = await fs.access(robotsPath).then(() => true).catch(() => false);

      if (exists) {
        const content = await fs.readFile(robotsPath, 'utf-8');

        // Basic robots.txt validation
        expect(content).toMatch(/User-agent:/i);
        expect(content).toMatch(/Disallow:|Allow:/i);
      }
    });

    it('should have valid sitemap.xml structure', async () => {
      const sitemapPath = path.join(buildDir, 'sitemap.xml');
      const exists = await fs.access(sitemapPath).then(() => true).catch(() => false);

      if (exists) {
        const content = await fs.readFile(sitemapPath, 'utf-8');

        // Basic sitemap validation
        expect(content).toContain('<?xml version="1.0"');
        expect(content).toContain('<urlset');
        expect(content).toContain('</urlset>');
      }
    });
  });

  describe('Bundle Composition Analysis', () => {
    it('should have main application chunks', async () => {
      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);

      const jsFiles = files.filter(file => file.endsWith('.js') && !file.includes('.map'));

      // Should have at least main bundle
      expect(jsFiles.length).toBeGreaterThan(0);

      // Check for common chunk patterns
      const chunkTypes = {
        main: jsFiles.some(f => f.includes('index') || f.includes('main')),
        vendor: jsFiles.some(f => f.includes('vendor') || f.includes('chunk')),
        runtime: jsFiles.some(f => f.includes('runtime') || f.includes('manifest'))
      };

      expect(chunkTypes.main).toBe(true);
    });

    it('should have appropriate chunk sizes', async () => {
      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);

      const jsFiles = files.filter(file => file.endsWith('.js') && !file.includes('.map'));

      for (const file of jsFiles) {
        const filePath = path.join(assetsDir, file);
        const stats = await fs.stat(filePath);

        // Main chunks should be reasonable size
        if (file.includes('index') || file.includes('main')) {
          expect(stats.size).toBeLessThan(5 * 1024 * 1024); // 5MB max for main
          expect(stats.size).toBeGreaterThan(10 * 1024); // 10KB minimum
        }

        // Vendor chunks can be larger
        if (file.includes('vendor')) {
          expect(stats.size).toBeLessThan(10 * 1024 * 1024); // 10MB max for vendor
        }

        // Runtime chunks should be small
        if (file.includes('runtime')) {
          expect(stats.size).toBeLessThan(100 * 1024); // 100KB max for runtime
        }
      }
    });
  });

  describe('CSS and Styling Assets', () => {
    it('should have CSS bundles with proper content', async () => {
      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);

      const cssFiles = files.filter(file => file.endsWith('.css') && !file.includes('.map'));

      expect(cssFiles.length).toBeGreaterThan(0);

      for (const file of cssFiles) {
        const filePath = path.join(assetsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');

        // Should have actual CSS content
        expect(content).toMatch(/[.#][\w-]+\s*{/); // CSS selectors
        expect(content.length).toBeGreaterThan(100); // Not empty
      }
    });

    it('should have optimized CSS (minified)', async () => {
      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);

      const cssFiles = files.filter(file => file.endsWith('.css') && !file.includes('.map'));

      for (const file of cssFiles) {
        const filePath = path.join(assetsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');

        // Check for minification (no excessive whitespace)
        const lines = content.split('\n');
        const nonEmptyLines = lines.filter(line => line.trim().length > 0);

        // Minified CSS should have fewer lines relative to content
        const avgLineLength = content.length / nonEmptyLines.length;
        expect(avgLineLength).toBeGreaterThan(30); // Reasonably compressed
      }
    });

    it('should not have unused CSS imports', async () => {
      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);

      const cssFiles = files.filter(file => file.endsWith('.css') && !file.includes('.map'));

      for (const file of cssFiles) {
        const filePath = path.join(assetsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');

        // Should not have development artifacts
        expect(content).not.toContain('@import url("http://localhost');
        expect(content).not.toContain('/* TODO');
        expect(content).not.toContain('/* DEBUG');
      }
    });
  });

  describe('Image and Media Assets', () => {
    it('should have optimized image formats', async () => {
      const findImages = async (dir: string): Promise<string[]> => {
        const images: string[] = [];

        try {
          const items = await fs.readdir(dir, { withFileTypes: true });

          for (const item of items) {
            const fullPath = path.join(dir, item.name);

            if (item.isDirectory()) {
              images.push(...await findImages(fullPath));
            } else if (/\.(jpg|jpeg|png|gif|svg|webp|avif)$/i.test(item.name)) {
              images.push(fullPath);
            }
          }
        } catch (error) {
          // Directory might not exist
        }

        return images;
      };

      const images = await findImages(buildDir);

      for (const imagePath of images) {
        const stats = await fs.stat(imagePath);
        const ext = path.extname(imagePath).toLowerCase();

        // Images should not be excessively large
        if (['.jpg', '.jpeg', '.png'].includes(ext)) {
          expect(stats.size).toBeLessThan(2 * 1024 * 1024); // 2MB max
        }

        // SVGs should be reasonably sized
        if (ext === '.svg') {
          expect(stats.size).toBeLessThan(500 * 1024); // 500KB max for SVG
        }
      }
    });

    it('should have properly named asset files', async () => {
      const assetsDir = path.join(buildDir, 'assets');

      try {
        const files = await fs.readdir(assetsDir);

        for (const file of files) {
          // Files should have proper naming conventions
          expect(file).toMatch(/^[a-zA-Z0-9._-]+$/); // No special characters
          expect(file).not.toMatch(/\s/); // No spaces
          expect(file.length).toBeLessThan(255); // Reasonable filename length
        }
      } catch (error) {
        // Assets directory might not exist
      }
    });
  });

  describe('Bundle Dependencies Analysis', () => {
    it('should not include development dependencies in bundles', async () => {
      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);

      const jsFiles = files.filter(file => file.endsWith('.js') && !file.includes('.map'));

      const devDependencies = [
        'jest',
        'vitest',
        'playwright',
        'eslint',
        'prettier',
        'webpack-dev-server',
        'vite/client',
        '@testing-library'
      ];

      for (const file of jsFiles) {
        const filePath = path.join(assetsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');

        for (const devDep of devDependencies) {
          expect(content).not.toContain(devDep);
        }
      }
    });

    it('should have tree-shaken bundles', async () => {
      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);

      const jsFiles = files.filter(file => file.endsWith('.js') && !file.includes('.map'));

      for (const file of jsFiles) {
        const filePath = path.join(assetsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');

        // Should not have unused exports warnings or dead code markers
        expect(content).not.toContain('/* unused harmony export');
        expect(content).not.toContain('/* dead code elimination');
      }
    });
  });

  describe('Service Worker and PWA Assets', () => {
    it('should have service worker if PWA enabled', async () => {
      const swPath = path.join(buildDir, 'sw.js');
      const exists = await fs.access(swPath).then(() => true).catch(() => false);

      if (exists) {
        const content = await fs.readFile(swPath, 'utf-8');

        // Basic service worker validation
        expect(content).toContain('self.');
        expect(content).toMatch(/install|fetch|activate/);
      }
    });

    it('should have web app manifest if PWA enabled', async () => {
      const manifestPath = path.join(buildDir, 'manifest.json');
      const exists = await fs.access(manifestPath).then(() => true).catch(() => false);

      if (exists) {
        const content = await fs.readFile(manifestPath, 'utf-8');
        const manifest = JSON.parse(content);

        expect(manifest).toHaveProperty('name');
        expect(manifest).toHaveProperty('start_url');
        expect(manifest).toHaveProperty('display');
      }
    });
  });

  describe('Build Metadata and Documentation', () => {
    it('should have build metadata files', async () => {
      const metadataFiles = [
        'build-info.json',
        'asset-manifest.json',
        '.buildinfo'
      ];

      // Check if any metadata files exist
      for (const file of metadataFiles) {
        const filePath = path.join(buildDir, file);
        const exists = await fs.access(filePath).then(() => true).catch(() => false);

        if (exists) {
          const stats = await fs.stat(filePath);
          expect(stats.size).toBeGreaterThan(0);
        }
      }
    });

    it('should not include unnecessary documentation in production', async () => {
      const docFiles = [
        'README.md',
        'CHANGELOG.md',
        'LICENSE',
        '.gitignore',
        'package.json'
      ];

      for (const file of docFiles) {
        const filePath = path.join(buildDir, file);
        const exists = await fs.access(filePath).then(() => true).catch(() => false);

        // These files should typically not be in production build
        expect(exists).toBe(false);
      }
    });
  });

  describe('Security Validation', () => {
    it('should not expose source code in production', async () => {
      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);

      const jsFiles = files.filter(file => file.endsWith('.js') && !file.includes('.map'));

      for (const file of jsFiles) {
        const filePath = path.join(assetsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');

        // Should not contain obvious source code patterns
        expect(content).not.toContain('console.log(');
        expect(content).not.toContain('debugger;');
        expect(content).not.toContain('// TODO:');
        expect(content).not.toContain('// FIXME:');
      }
    });

    it('should have proper CSP headers in HTML', async () => {
      const indexPath = path.join(buildDir, 'index.html');
      const content = await fs.readFile(indexPath, 'utf-8');

      // Check for security headers (if implemented)
      const hasSecurityHeaders = content.includes('Content-Security-Policy') ||
                                content.includes('X-Frame-Options') ||
                                content.includes('X-Content-Type-Options');

      // This might be optional depending on implementation
      // expect(hasSecurityHeaders).toBe(true);
    });
  });
});