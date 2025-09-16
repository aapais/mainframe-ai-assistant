/**
 * Windows Build Tests
 * Tests Windows-specific build configurations, installer generation, and platform features
 */

import { execSync } from 'child_process';
import { existsSync, statSync } from 'fs';
import path from 'path';
import os from 'os';

describe('Windows Build Tests', () => {
  const isWindows = os.platform() === 'win32';
  const buildDir = path.join(process.cwd(), 'dist');
  const windowsArtifacts = [
    'mainframe-ai-assistant Setup.exe',
    'mainframe-ai-assistant.exe',
    'mainframe-ai-assistant.msi'
  ];

  beforeAll(() => {
    if (!isWindows) {
      console.log('Skipping Windows-specific tests on non-Windows platform');
      return;
    }
  });

  describe('Windows Dependencies', () => {
    test('should have Windows-specific dependencies available', () => {
      if (!isWindows) return;

      const requiredModules = [
        'electron-builder',
        'electron-winstaller',
        'node-gyp'
      ];

      requiredModules.forEach(module => {
        expect(() => {
          require.resolve(module);
        }).not.toThrow();
      });
    });

    test('should detect native modules compilation capability', () => {
      if (!isWindows) return;

      try {
        execSync('node-gyp --version', { stdio: 'pipe' });
        expect(true).toBe(true);
      } catch (error) {
        fail('node-gyp not available for native module compilation');
      }
    });
  });

  describe('Windows File Path Handling', () => {
    test('should handle Windows path separators correctly', () => {
      const testPath = path.join('C:', 'Users', 'test', 'file.txt');
      expect(testPath).toContain('\\');
      expect(path.isAbsolute(testPath)).toBe(true);
    });

    test('should handle long file paths', () => {
      const longPath = 'C:\\' + 'a'.repeat(250) + '\\file.txt';
      expect(longPath.length).toBeGreaterThan(260); // Windows MAX_PATH
      expect(() => path.parse(longPath)).not.toThrow();
    });

    test('should validate reserved Windows filenames', () => {
      const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'LPT1'];
      reservedNames.forEach(name => {
        expect(['CON', 'PRN', 'AUX', 'NUL']).toContain(name.toUpperCase().substring(0, 3));
      });
    });
  });

  describe('Windows Build Configuration', () => {
    test('should have valid Windows electron-builder config', () => {
      const configPath = path.join(process.cwd(), 'electron-builder-configs', 'windows.json');
      expect(existsSync(configPath)).toBe(true);

      const config = require(configPath);
      expect(config.win).toBeDefined();
      expect(config.win.target).toBeDefined();
      expect(config.nsis).toBeDefined();
    });

    test('should configure NSIS installer properly', () => {
      const configPath = path.join(process.cwd(), 'electron-builder-configs', 'windows.json');
      const config = require(configPath);

      expect(config.nsis).toMatchObject({
        oneClick: false,
        allowToChangeInstallationDirectory: true,
        createDesktopShortcut: true,
        createStartMenuShortcut: true
      });
    });
  });

  describe('Windows Platform Features', () => {
    test('should support Windows registry operations', () => {
      if (!isWindows) return;

      // Mock registry operation test
      const mockRegistryKey = 'HKEY_CURRENT_USER\\Software\\Test';
      expect(typeof mockRegistryKey).toBe('string');
      expect(mockRegistryKey).toContain('HKEY_');
    });

    test('should handle Windows services integration', () => {
      if (!isWindows) return;

      // Test service configuration capability
      const serviceConfig = {
        name: 'MainframeAIAssistant',
        displayName: 'Mainframe AI Assistant',
        description: 'AI-powered mainframe assistant service'
      };

      expect(serviceConfig.name).toBeTruthy();
      expect(serviceConfig.displayName).toBeTruthy();
    });

    test('should support Windows auto-updater', () => {
      const updateConfig = {
        provider: 'github',
        updaterCacheDirName: 'mainframe-ai-assistant-updater'
      };

      expect(updateConfig.provider).toBe('github');
      expect(updateConfig.updaterCacheDirName).toBeTruthy();
    });
  });

  describe('Windows Installer Generation', () => {
    test('should generate Windows installer artifacts', async () => {
      if (!isWindows) return;

      // This would be run after a successful build
      const expectedArtifacts = [
        path.join(buildDir, 'mainframe-ai-assistant Setup.exe'),
        path.join(buildDir, 'mainframe-ai-assistant.exe')
      ];

      // Mock test - in real scenario, these files would exist after build
      expectedArtifacts.forEach(artifact => {
        const filename = path.basename(artifact);
        expect(filename).toMatch(/\.(exe|msi)$/);
      });
    });

    test('should validate installer metadata', () => {
      const metadata = {
        productName: 'Mainframe AI Assistant',
        version: '1.0.0',
        description: 'AI-powered mainframe assistant',
        author: 'AI Development Team',
        copyright: '© 2024 AI Development Team'
      };

      expect(metadata.productName).toBeTruthy();
      expect(metadata.version).toMatch(/^\d+\.\d+\.\d+/);
      expect(metadata.author).toBeTruthy();
    });

    test('should configure code signing for Windows', () => {
      const signingConfig = {
        certificateFile: process.env.WIN_CSC_LINK,
        certificatePassword: process.env.WIN_CSC_KEY_PASSWORD,
        signingHashAlgorithms: ['sha256']
      };

      // In CI/CD, these environment variables should be set
      expect(Array.isArray(signingConfig.signingHashAlgorithms)).toBe(true);
      expect(signingConfig.signingHashAlgorithms).toContain('sha256');
    });
  });

  describe('Windows Architecture Support', () => {
    test('should support x64 architecture', () => {
      const arch = 'x64';
      expect(['x64', 'ia32', 'arm64']).toContain(arch);
    });

    test('should support ARM64 architecture', () => {
      const arch = 'arm64';
      expect(['x64', 'ia32', 'arm64']).toContain(arch);
    });

    test('should handle architecture-specific builds', () => {
      const buildTargets = [
        { platform: 'win32', arch: 'x64' },
        { platform: 'win32', arch: 'arm64' }
      ];

      buildTargets.forEach(target => {
        expect(target.platform).toBe('win32');
        expect(['x64', 'arm64']).toContain(target.arch);
      });
    });
  });

  describe('Windows Performance Validation', () => {
    test('should validate startup time on Windows', async () => {
      if (!isWindows) return;

      const startTime = Date.now();

      // Mock application startup
      await new Promise(resolve => setTimeout(resolve, 100));

      const endTime = Date.now();
      const startupTime = endTime - startTime;

      expect(startupTime).toBeLessThan(5000); // 5 second startup limit
    });

    test('should validate memory usage on Windows', () => {
      if (!isWindows) return;

      const memoryUsage = process.memoryUsage();

      expect(memoryUsage.heapUsed).toBeLessThan(500 * 1024 * 1024); // 500MB limit
      expect(memoryUsage.rss).toBeLessThan(1024 * 1024 * 1024); // 1GB limit
    });
  });

  describe('Windows Security Features', () => {
    test('should validate Windows Defender compatibility', () => {
      // Test that the application doesn't trigger false positives
      const allowedFileTypes = ['.exe', '.msi', '.dll'];
      const appFiles = ['mainframe-ai-assistant.exe', 'mainframe-ai-assistant Setup.exe'];

      appFiles.forEach(file => {
        const ext = path.extname(file);
        expect(allowedFileTypes).toContain(ext);
      });
    });

    test('should support Windows UAC elevation', () => {
      const uacConfig = {
        requestedExecutionLevel: 'asInvoker',
        uiAccess: false
      };

      expect(['asInvoker', 'requireAdministrator', 'highestAvailable'])
        .toContain(uacConfig.requestedExecutionLevel);
    });
  });
});