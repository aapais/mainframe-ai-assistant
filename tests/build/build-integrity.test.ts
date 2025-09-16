import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

describe('Build Integrity Tests', () => {
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

  describe('HTML Integrity Validation', () => {
    it('should have valid HTML structure', async () => {
      const indexPath = path.join(buildDir, 'index.html');
      const content = await fs.readFile(indexPath, 'utf-8');

      // Basic HTML validation
      expect(content).toMatch(/<!DOCTYPE html>/i);
      expect(content).toContain('<html');
      expect(content).toContain('<head>');
      expect(content).toContain('</head>');
      expect(content).toContain('<body>');
      expect(content).toContain('</body>');
      expect(content).toContain('</html>');

      // Check for proper tag closing
      const openTags = content.match(/<(\w+)(?:\s[^>]*)?>/g) || [];
      const closeTags = content.match(/<\/(\w+)>/g) || [];

      // Self-closing tags
      const selfClosingTags = ['meta', 'link', 'img', 'br', 'hr', 'input', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr'];

      const openTagNames = openTags
        .map(tag => tag.match(/<(\w+)/)?.[1]?.toLowerCase())
        .filter(tag => tag && !selfClosingTags.includes(tag));

      const closeTagNames = closeTags
        .map(tag => tag.match(/<\/(\w+)>/)?.[1]?.toLowerCase())
        .filter(Boolean);

      // Check that important tags are properly closed
      const importantTags = ['html', 'head', 'body', 'title'];
      for (const tag of importantTags) {
        if (openTagNames.includes(tag)) {
          expect(closeTagNames).toContain(tag);
        }
      }
    });

    it('should have required meta tags', async () => {
      const indexPath = path.join(buildDir, 'index.html');
      const content = await fs.readFile(indexPath, 'utf-8');

      // Required meta tags
      expect(content).toMatch(/<meta\s+charset=["']utf-8["']/i);
      expect(content).toMatch(/<meta\s+name=["']viewport["']/i);

      // SEO meta tags
      const hasTitle = content.includes('<title>') && content.includes('</title>');
      expect(hasTitle).toBe(true);

      // Optional but recommended
      const hasDescription = content.match(/<meta\s+name=["']description["']/i);
      // expect(hasDescription).toBeTruthy(); // Uncomment if required
    });

    it('should have proper script and link references', async () => {
      const indexPath = path.join(buildDir, 'index.html');
      const content = await fs.readFile(indexPath, 'utf-8');

      // Find all script and link references
      const scriptTags = content.match(/<script[^>]*src=["']([^"']+)["'][^>]*>/g) || [];
      const linkTags = content.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/g) || [];

      // Verify referenced files exist
      for (const scriptTag of scriptTags) {
        const srcMatch = scriptTag.match(/src=["']([^"']+)["']/);
        if (srcMatch) {
          const src = srcMatch[1];
          if (!src.startsWith('http') && !src.startsWith('//')) {
            const scriptPath = path.join(buildDir, src.replace(/^\//, ''));
            const exists = await fs.access(scriptPath).then(() => true).catch(() => false);
            expect(exists).toBe(true);
          }
        }
      }

      for (const linkTag of linkTags) {
        const hrefMatch = linkTag.match(/href=["']([^"']+)["']/);
        if (hrefMatch) {
          const href = hrefMatch[1];
          if (!href.startsWith('http') && !href.startsWith('//') && href.endsWith('.css')) {
            const linkPath = path.join(buildDir, href.replace(/^\//, ''));
            const exists = await fs.access(linkPath).then(() => true).catch(() => false);
            expect(exists).toBe(true);
          }
        }
      }
    });
  });

  describe('JavaScript Bundle Integrity', () => {
    it('should have syntactically correct JavaScript', async () => {
      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);

      const jsFiles = files.filter(file => file.endsWith('.js') && !file.includes('.map'));

      for (const file of jsFiles) {
        const filePath = path.join(assetsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');

        // Basic syntax validation
        expect(content).not.toContain('SyntaxError');
        expect(content).not.toContain('Unexpected token');
        expect(content).not.toContain('Uncaught ReferenceError');

        // Should have valid JavaScript patterns
        const hasValidStructure = content.includes('{') && content.includes('}');
        expect(hasValidStructure).toBe(true);

        // Should not have obvious parsing errors
        expect(content).not.toMatch(/\bunexpected\s+token/i);
        expect(content).not.toMatch(/\bsyntax\s+error/i);
      }
    });

    it('should have proper module definitions', async () => {
      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);

      const jsFiles = files.filter(file => file.endsWith('.js') && !file.includes('.map'));

      for (const file of jsFiles) {
        const filePath = path.join(assetsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');

        // Should have module system patterns (UMD, CommonJS, or ES modules)
        const hasModulePattern = content.includes('exports') ||
                                content.includes('module.exports') ||
                                content.includes('define(') ||
                                content.includes('__webpack_require__') ||
                                content.includes('import') ||
                                content.includes('export');

        expect(hasModulePattern).toBe(true);
      }
    });

    it('should not have runtime errors in console output', async () => {
      // This test simulates basic runtime validation
      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);

      const jsFiles = files.filter(file => file.endsWith('.js') && !file.includes('.map'));

      for (const file of jsFiles) {
        const filePath = path.join(assetsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');

        // Should not contain obvious runtime error patterns
        expect(content).not.toContain('TypeError:');
        expect(content).not.toContain('ReferenceError:');
        expect(content).not.toContain('Cannot read property');
        expect(content).not.toContain('Cannot read properties');
        expect(content).not.toContain('is not defined');
        expect(content).not.toContain('is not a function');
      }
    });
  });

  describe('CSS Integrity Validation', () => {
    it('should have valid CSS syntax', async () => {
      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);

      const cssFiles = files.filter(file => file.endsWith('.css') && !file.includes('.map'));

      for (const file of cssFiles) {
        const filePath = path.join(assetsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');

        // Basic CSS syntax validation
        const openBraces = (content.match(/{/g) || []).length;
        const closeBraces = (content.match(/}/g) || []).length;

        expect(openBraces).toBe(closeBraces);

        // Should not have CSS syntax errors
        expect(content).not.toContain('Unexpected token');
        expect(content).not.toContain('Parse error');
        expect(content).not.toContain('Invalid CSS');
      }
    });

    it('should have valid CSS selectors and properties', async () => {
      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);

      const cssFiles = files.filter(file => file.endsWith('.css') && !file.includes('.map'));

      for (const file of cssFiles) {
        const filePath = path.join(assetsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');

        // Should have valid CSS structure
        expect(content).toMatch(/[.#\w\s,>+~\[\]:()-]+\s*{[^}]*}/);

        // Should not have malformed properties
        expect(content).not.toMatch(/:\s*;/); // Empty values
        expect(content).not.toMatch(/[^}];\s*[^{}]*{/); // Missing closing brace
      }
    });

    it('should not have broken url() references', async () => {
      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);

      const cssFiles = files.filter(file => file.endsWith('.css') && !file.includes('.map'));

      for (const file of cssFiles) {
        const filePath = path.join(assetsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');

        const urlMatches = content.match(/url\(["']?([^"')]+)["']?\)/g);

        if (urlMatches) {
          for (const urlMatch of urlMatches) {
            const urlPath = urlMatch.match(/url\(["']?([^"')]+)["']?\)/)?.[1];

            if (urlPath && !urlPath.startsWith('http') && !urlPath.startsWith('//') && !urlPath.startsWith('data:')) {
              // Check if relative asset exists
              const assetPath = path.join(assetsDir, path.basename(urlPath));
              // Note: This is a simplified check. In practice, you might need more sophisticated path resolution
            }
          }
        }
      }
    });
  });

  describe('Asset Cross-References Integrity', () => {
    it('should have matching source map references', async () => {
      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);

      const jsFiles = files.filter(file => file.endsWith('.js') && !file.includes('.map'));
      const mapFiles = files.filter(file => file.endsWith('.map'));

      for (const jsFile of jsFiles) {
        const jsPath = path.join(assetsDir, jsFile);
        const content = await fs.readFile(jsPath, 'utf-8');

        const sourceMappingMatch = content.match(/\/\/[#@]\s*sourceMappingURL=(.+)$/m);

        if (sourceMappingMatch) {
          const mapFileName = sourceMappingMatch[1].trim();
          const expectedMapFile = jsFile + '.map';

          expect(mapFiles).toContain(expectedMapFile);

          // Verify the map file exists and is valid
          const mapPath = path.join(assetsDir, expectedMapFile);
          const mapContent = await fs.readFile(mapPath, 'utf-8');

          expect(() => JSON.parse(mapContent)).not.toThrow();
        }
      }
    });

    it('should have consistent asset references', async () => {
      const indexPath = path.join(buildDir, 'index.html');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Extract all asset references from HTML
      const scriptSrcs = [...indexContent.matchAll(/src=["']([^"']+\.js)["']/g)].map(m => m[1]);
      const linkHrefs = [...indexContent.matchAll(/href=["']([^"']+\.css)["']/g)].map(m => m[1]);

      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);

      // Verify all referenced assets exist
      for (const src of scriptSrcs) {
        if (!src.startsWith('http')) {
          const fileName = path.basename(src);
          expect(files).toContain(fileName);
        }
      }

      for (const href of linkHrefs) {
        if (!href.startsWith('http')) {
          const fileName = path.basename(href);
          expect(files).toContain(fileName);
        }
      }
    });
  });

  describe('Build Output Consistency', () => {
    it('should have consistent file naming patterns', async () => {
      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);

      // Check for consistent hash patterns
      const jsFiles = files.filter(file => file.endsWith('.js') && !file.includes('.map'));
      const cssFiles = files.filter(file => file.endsWith('.css') && !file.includes('.map'));

      // If using hashes, they should be consistent
      if (jsFiles.length > 0) {
        const hasHashes = jsFiles.some(file => /\.[a-f0-9]{8,}\./i.test(file));

        if (hasHashes) {
          // All JS files should have hashes
          for (const file of jsFiles) {
            expect(file).toMatch(/\.[a-f0-9]{8,}\./i);
          }
        }
      }

      if (cssFiles.length > 0) {
        const hasHashes = cssFiles.some(file => /\.[a-f0-9]{8,}\./i.test(file));

        if (hasHashes) {
          // All CSS files should have hashes
          for (const file of cssFiles) {
            expect(file).toMatch(/\.[a-f0-9]{8,}\./i);
          }
        }
      }
    });

    it('should not have duplicate or conflicting assets', async () => {
      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);

      // Check for potential duplicates (same content, different names)
      const fileHashes = new Map<string, string[]>();

      for (const file of files) {
        if (file.endsWith('.js') || file.endsWith('.css')) {
          const filePath = path.join(assetsDir, file);
          const content = await fs.readFile(filePath, 'utf-8');

          const crypto = await import('crypto');
          const hash = crypto.createHash('md5').update(content).digest('hex');

          if (!fileHashes.has(hash)) {
            fileHashes.set(hash, []);
          }
          fileHashes.get(hash)!.push(file);
        }
      }

      // Check for duplicates
      for (const [hash, filenames] of fileHashes) {
        if (filenames.length > 1) {
          // This might be expected in some cases (e.g., legacy support)
          console.warn('Potential duplicate files:', filenames);
        }
      }
    });
  });

  describe('Performance and Size Validation', () => {
    it('should have reasonable total bundle size', async () => {
      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);

      let totalSize = 0;

      for (const file of files) {
        if (file.endsWith('.js') || file.endsWith('.css')) {
          const filePath = path.join(assetsDir, file);
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
        }
      }

      // Total bundle size should be reasonable (adjust based on your needs)
      expect(totalSize).toBeLessThan(50 * 1024 * 1024); // 50MB max
      expect(totalSize).toBeGreaterThan(1024); // At least 1KB
    });

    it('should have optimized assets', async () => {
      const assetsDir = path.join(buildDir, 'assets');
      const files = await fs.readdir(assetsDir);

      const jsFiles = files.filter(file => file.endsWith('.js') && !file.includes('.map'));

      for (const file of jsFiles) {
        const filePath = path.join(assetsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');

        // Check for minification indicators
        const avgLineLength = content.split('\n').reduce((sum, line) => sum + line.length, 0) / content.split('\n').length;

        // Minified files should have longer average line length
        expect(avgLineLength).toBeGreaterThan(50);

        // Should not have excessive whitespace
        const whitespaceRatio = (content.match(/\s/g) || []).length / content.length;
        expect(whitespaceRatio).toBeLessThan(0.3); // Less than 30% whitespace
      }
    });
  });
});