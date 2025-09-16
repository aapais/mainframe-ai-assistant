import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn, ChildProcess } from 'child_process';
import { InstallerValidator } from '../../scripts/validate-deployment';

interface InstallationContext {
  installPath: string;
  tempPath: string;
  backupPath: string;
  configPath: string;
  logPath: string;
}

interface InstallationResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
  installedFiles: string[];
  errors: string[];
}

describe('Installer Validation Tests', () => {
  let installerValidator: InstallerValidator;
  let testContext: InstallationContext;
  let packagePath: string;

  beforeAll(async () => {
    installerValidator = new InstallerValidator();
    packagePath = path.join(__dirname, 'fixtures', 'test-package.zip');

    // Setup test environment
    testContext = await setupTestEnvironment();

    // Create mock installer package
    await createMockInstallerPackage();
  });

  afterAll(async () => {
    // Cleanup test environment
    await cleanupTestEnvironment(testContext);
  });

  beforeEach(async () => {
    // Reset installation directory
    await resetInstallationDirectory(testContext);
  });

  describe('Fresh Installation Testing', () => {
    test('should perform clean installation', async () => {
      const result = await installerValidator.performInstallation({
        packagePath,
        installPath: testContext.installPath,
        mode: 'fresh'
      });

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.installedFiles.length).toBeGreaterThan(0);
    });

    test('should create required directories', async () => {
      await installerValidator.performInstallation({
        packagePath,
        installPath: testContext.installPath,
        mode: 'fresh'
      });

      const requiredDirs = [
        path.join(testContext.installPath, 'app'),
        path.join(testContext.installPath, 'config'),
        path.join(testContext.installPath, 'logs'),
        path.join(testContext.installPath, 'data')
      ];

      for (const dir of requiredDirs) {
        expect(fs.existsSync(dir)).toBe(true);
      }
    });

    test('should set correct file permissions', async () => {
      if (os.platform() === 'win32') {
        return; // Skip on Windows
      }

      await installerValidator.performInstallation({
        packagePath,
        installPath: testContext.installPath,
        mode: 'fresh'
      });

      const executablePath = path.join(testContext.installPath, 'app', 'main');
      const stats = fs.statSync(executablePath);

      // Check if executable bit is set
      expect(stats.mode & parseInt('100', 8)).toBeTruthy();
    });

    test('should register application with system', async () => {
      const result = await installerValidator.performInstallation({
        packagePath,
        installPath: testContext.installPath,
        mode: 'fresh'
      });

      expect(result.success).toBe(true);

      // Verify system registration
      const registrationResult = await installerValidator.verifySystemRegistration({
        appName: 'mainframe-ai-assistant',
        installPath: testContext.installPath
      });

      expect(registrationResult.registered).toBe(true);
    });

    test('should create desktop shortcuts', async () => {
      await installerValidator.performInstallation({
        packagePath,
        installPath: testContext.installPath,
        mode: 'fresh',
        createShortcuts: true
      });

      const shortcutResult = await installerValidator.verifyShortcuts({
        appName: 'mainframe-ai-assistant'
      });

      expect(shortcutResult.desktopShortcut).toBe(true);
      expect(shortcutResult.startMenuShortcut).toBe(true);
    });

    test('should handle installation errors gracefully', async () => {
      // Test installation to invalid path
      const result = await installerValidator.performInstallation({
        packagePath,
        installPath: '/invalid/path/that/does/not/exist',
        mode: 'fresh'
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Update Installation Testing', () => {
    beforeEach(async () => {
      // Install previous version first
      await installerValidator.performInstallation({
        packagePath: path.join(__dirname, 'fixtures', 'old-version.zip'),
        installPath: testContext.installPath,
        mode: 'fresh'
      });
    });

    test('should update from previous version', async () => {
      const result = await installerValidator.performInstallation({
        packagePath,
        installPath: testContext.installPath,
        mode: 'update'
      });

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
    });

    test('should preserve user data during update', async () => {
      // Create user data
      const userDataPath = path.join(testContext.installPath, 'data', 'user.json');
      fs.writeFileSync(userDataPath, JSON.stringify({ userId: 123, preferences: {} }));

      await installerValidator.performInstallation({
        packagePath,
        installPath: testContext.installPath,
        mode: 'update'
      });

      expect(fs.existsSync(userDataPath)).toBe(true);
      const userData = JSON.parse(fs.readFileSync(userDataPath, 'utf8'));
      expect(userData.userId).toBe(123);
    });

    test('should backup old version before update', async () => {
      const result = await installerValidator.performInstallation({
        packagePath,
        installPath: testContext.installPath,
        mode: 'update',
        createBackup: true
      });

      expect(result.success).toBe(true);
      expect(fs.existsSync(testContext.backupPath)).toBe(true);
    });

    test('should migrate configuration files', async () => {
      // Create old config format
      const oldConfigPath = path.join(testContext.installPath, 'config', 'app.ini');
      fs.writeFileSync(oldConfigPath, '[app]\nversion=0.9.0\nport=3000');

      await installerValidator.performInstallation({
        packagePath,
        installPath: testContext.installPath,
        mode: 'update'
      });

      // Check new config format
      const newConfigPath = path.join(testContext.installPath, 'config', 'app.json');
      expect(fs.existsSync(newConfigPath)).toBe(true);

      const newConfig = JSON.parse(fs.readFileSync(newConfigPath, 'utf8'));
      expect(newConfig.version).toBe('1.0.0');
      expect(newConfig.port).toBe(3000);
    });
  });

  describe('Downgrade Testing', () => {
    beforeEach(async () => {
      // Install current version first
      await installerValidator.performInstallation({
        packagePath,
        installPath: testContext.installPath,
        mode: 'fresh'
      });
    });

    test('should handle version downgrade', async () => {
      const result = await installerValidator.performInstallation({
        packagePath: path.join(__dirname, 'fixtures', 'old-version.zip'),
        installPath: testContext.installPath,
        mode: 'downgrade'
      });

      expect(result.success).toBe(true);
    });

    test('should warn about data compatibility issues', async () => {
      const result = await installerValidator.performInstallation({
        packagePath: path.join(__dirname, 'fixtures', 'old-version.zip'),
        installPath: testContext.installPath,
        mode: 'downgrade'
      });

      expect(result.warnings).toContain('Data format compatibility warning');
    });

    test('should backup current version before downgrade', async () => {
      await installerValidator.performInstallation({
        packagePath: path.join(__dirname, 'fixtures', 'old-version.zip'),
        installPath: testContext.installPath,
        mode: 'downgrade',
        createBackup: true
      });

      expect(fs.existsSync(testContext.backupPath)).toBe(true);
    });
  });

  describe('Uninstallation Testing', () => {
    beforeEach(async () => {
      // Install application first
      await installerValidator.performInstallation({
        packagePath,
        installPath: testContext.installPath,
        mode: 'fresh'
      });
    });

    test('should completely remove application', async () => {
      const result = await installerValidator.performUninstallation({
        installPath: testContext.installPath,
        removeUserData: true,
        removeConfig: true
      });

      expect(result.success).toBe(true);
      expect(fs.existsSync(testContext.installPath)).toBe(false);
    });

    test('should preserve user data when requested', async () => {
      const userDataPath = path.join(testContext.installPath, 'data');

      const result = await installerValidator.performUninstallation({
        installPath: testContext.installPath,
        removeUserData: false,
        removeConfig: true
      });

      expect(result.success).toBe(true);
      expect(fs.existsSync(userDataPath)).toBe(true);
    });

    test('should remove system registration', async () => {
      await installerValidator.performUninstallation({
        installPath: testContext.installPath,
        removeUserData: true,
        removeConfig: true
      });

      const registrationResult = await installerValidator.verifySystemRegistration({
        appName: 'mainframe-ai-assistant',
        installPath: testContext.installPath
      });

      expect(registrationResult.registered).toBe(false);
    });

    test('should remove shortcuts', async () => {
      await installerValidator.performUninstallation({
        installPath: testContext.installPath,
        removeUserData: true,
        removeConfig: true,
        removeShortcuts: true
      });

      const shortcutResult = await installerValidator.verifyShortcuts({
        appName: 'mainframe-ai-assistant'
      });

      expect(shortcutResult.desktopShortcut).toBe(false);
      expect(shortcutResult.startMenuShortcut).toBe(false);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle corrupted package gracefully', async () => {
      const corruptedPackagePath = path.join(__dirname, 'fixtures', 'corrupted-package.zip');

      const result = await installerValidator.performInstallation({
        packagePath: corruptedPackagePath,
        installPath: testContext.installPath,
        mode: 'fresh'
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Package corruption detected');
    });

    test('should recover from interrupted installation', async () => {
      // Simulate interrupted installation
      const partialInstall = await installerValidator.simulateInterruptedInstallation({
        packagePath,
        installPath: testContext.installPath,
        interruptAt: 50 // 50% completion
      });

      expect(partialInstall.interrupted).toBe(true);

      // Attempt recovery
      const recoveryResult = await installerValidator.recoverInstallation({
        installPath: testContext.installPath,
        packagePath
      });

      expect(recoveryResult.success).toBe(true);
    });

    test('should rollback failed installation', async () => {
      // Create a scenario that will fail
      const failingPackagePath = path.join(__dirname, 'fixtures', 'failing-package.zip');

      const result = await installerValidator.performInstallation({
        packagePath: failingPackagePath,
        installPath: testContext.installPath,
        mode: 'fresh',
        autoRollback: true
      });

      expect(result.success).toBe(false);
      expect(result.rolledBack).toBe(true);
      expect(fs.existsSync(testContext.installPath)).toBe(false);
    });

    test('should handle insufficient disk space', async () => {
      const result = await installerValidator.performInstallation({
        packagePath,
        installPath: testContext.installPath,
        mode: 'fresh',
        requiredSpace: '999GB' // Intentionally large
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Insufficient disk space');
    });

    test('should handle permission errors', async () => {
      if (os.platform() === 'win32') {
        return; // Skip on Windows
      }

      // Create read-only directory
      const readOnlyPath = path.join(testContext.tempPath, 'readonly');
      fs.mkdirSync(readOnlyPath);
      fs.chmodSync(readOnlyPath, 0o444);

      const result = await installerValidator.performInstallation({
        packagePath,
        installPath: readOnlyPath,
        mode: 'fresh'
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Permission denied');
    });
  });

  describe('Installation Validation', () => {
    test('should verify installation completeness', async () => {
      await installerValidator.performInstallation({
        packagePath,
        installPath: testContext.installPath,
        mode: 'fresh'
      });

      const validation = await installerValidator.validateInstallation({
        installPath: testContext.installPath
      });

      expect(validation.complete).toBe(true);
      expect(validation.missingFiles).toHaveLength(0);
      expect(validation.corruptedFiles).toHaveLength(0);
    });

    test('should verify application can start', async () => {
      await installerValidator.performInstallation({
        packagePath,
        installPath: testContext.installPath,
        mode: 'fresh'
      });

      const startupTest = await installerValidator.testApplicationStartup({
        installPath: testContext.installPath,
        timeout: 30000
      });

      expect(startupTest.success).toBe(true);
      expect(startupTest.responseTime).toBeLessThan(10000);
    });

    test('should verify configuration validity', async () => {
      await installerValidator.performInstallation({
        packagePath,
        installPath: testContext.installPath,
        mode: 'fresh'
      });

      const configValidation = await installerValidator.validateConfiguration({
        installPath: testContext.installPath
      });

      expect(configValidation.valid).toBe(true);
      expect(configValidation.errors).toHaveLength(0);
    });
  });

  // Helper functions
  async function setupTestEnvironment(): Promise<InstallationContext> {
    const tempPath = fs.mkdtempSync(path.join(os.tmpdir(), 'installer-test-'));

    return {
      installPath: path.join(tempPath, 'install'),
      tempPath,
      backupPath: path.join(tempPath, 'backup'),
      configPath: path.join(tempPath, 'config'),
      logPath: path.join(tempPath, 'logs')
    };
  }

  async function cleanupTestEnvironment(context: InstallationContext): Promise<void> {
    if (fs.existsSync(context.tempPath)) {
      fs.rmSync(context.tempPath, { recursive: true, force: true });
    }
  }

  async function resetInstallationDirectory(context: InstallationContext): Promise<void> {
    if (fs.existsSync(context.installPath)) {
      fs.rmSync(context.installPath, { recursive: true, force: true });
    }
  }

  async function createMockInstallerPackage(): Promise<void> {
    // Create mock installer package for testing
    const fixturesDir = path.join(__dirname, 'fixtures');
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }

    // Create mock package content
    const packageContent = {
      manifest: {
        name: 'mainframe-ai-assistant',
        version: '1.0.0',
        files: ['app/main.js', 'config/app.json', 'LICENSE']
      },
      files: {
        'app/main.js': 'console.log("Hello World");',
        'config/app.json': '{"version": "1.0.0", "port": 3000}',
        'LICENSE': 'MIT License'
      }
    };

    fs.writeFileSync(
      path.join(fixturesDir, 'test-package.json'),
      JSON.stringify(packageContent, null, 2)
    );
  }
});