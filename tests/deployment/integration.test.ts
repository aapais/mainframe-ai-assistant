import * as fs from 'fs';
import * as path from 'path';
import { PackageValidator, InstallerValidator, AutoUpdater } from '../../scripts/validate-deployment';
import { ChecksumGenerator } from '../../scripts/checksum-generator';
import { SecurityVerificationSuite } from '../../scripts/security-verification';
import { DeploymentMonitor } from '../../scripts/deployment-monitoring';

/**
 * Integration tests for the complete deployment package testing suite
 * Tests end-to-end workflows and component interactions
 */
describe('Deployment Test Suite Integration', () => {
  let tempDir: string;
  let testPackage: any;
  let packageValidator: PackageValidator;
  let installerValidator: InstallerValidator;
  let autoUpdater: AutoUpdater;
  let checksumGenerator: ChecksumGenerator;
  let securitySuite: SecurityVerificationSuite;
  let deploymentMonitor: DeploymentMonitor;

  beforeAll(async () => {
    // Setup test environment
    tempDir = global.TEST_TEMP_DIR;
    testPackage = global.createMockDeploymentPackage();

    // Initialize all components
    packageValidator = new PackageValidator({ strictMode: true });
    installerValidator = new InstallerValidator();
    autoUpdater = new AutoUpdater();
    checksumGenerator = new ChecksumGenerator();
    securitySuite = new SecurityVerificationSuite({ strictMode: false });
    deploymentMonitor = new DeploymentMonitor();
  });

  afterAll(async () => {
    // Cleanup
    await deploymentMonitor.shutdown();
  });

  describe('End-to-End Deployment Workflow', () => {
    test('should perform complete deployment validation workflow', async () => {
      const deploymentId = await deploymentMonitor.trackDeploymentStart({
        packageName: testPackage.manifest.name,
        version: testPackage.manifest.version,
        environment: 'test'
      });

      // Phase 1: Package Validation
      await deploymentMonitor.updateDeploymentPhase(deploymentId, 'package-validation');

      const packageValidation = await packageValidator.validateComplete(testPackage);
      expect(packageValidation.valid).toBe(true);

      // Phase 2: Checksum Generation and Verification
      await deploymentMonitor.updateDeploymentPhase(deploymentId, 'checksum-verification');

      const checksumData = await checksumGenerator.generateDirectoryChecksums(
        path.join(tempDir, 'test-app')
      );
      expect(checksumData).toBeDefined();

      // Phase 3: Security Verification
      await deploymentMonitor.updateDeploymentPhase(deploymentId, 'security-verification');

      const packagePath = path.join(tempDir, 'test-package.zip');
      const securityResults = await securitySuite.performComprehensiveVerification(packagePath);
      expect(securityResults.overallSecurity).not.toBe('critical');

      // Phase 4: Installation Testing
      await deploymentMonitor.updateDeploymentPhase(deploymentId, 'installation-testing');

      const installResult = await installerValidator.performInstallation({
        packagePath,
        installPath: path.join(tempDir, 'install-test'),
        mode: 'fresh'
      });
      expect(installResult.success).toBe(true);

      // Phase 5: Update Mechanism Testing
      await deploymentMonitor.updateDeploymentPhase(deploymentId, 'update-testing');

      const updateValidation = await autoUpdater.validateUpdateChannel({
        name: 'test',
        url: 'https://test-updates.example.com',
        priority: 1,
        stable: true
      });
      expect(updateValidation.valid).toBe(true);

      // Complete deployment
      const completionResult = await deploymentMonitor.recordDeploymentCompletion(deploymentId, {
        success: true,
        duration: Date.now() - Date.now(),
        validationResults: {
          package: packageValidation,
          security: securityResults,
          installation: installResult
        }
      });

      expect(completionResult.summary.status).toBe('completed');
    });

    test('should handle deployment failure scenarios', async () => {
      const deploymentId = await deploymentMonitor.trackDeploymentStart({
        packageName: 'failing-package',
        version: '1.0.0',
        environment: 'test'
      });

      // Simulate package validation failure
      const corruptedPackage = {
        ...testPackage,
        manifest: {
          ...testPackage.manifest,
          files: [] // Missing files will cause validation failure
        }
      };

      await deploymentMonitor.updateDeploymentPhase(deploymentId, 'package-validation');

      const validationResult = await packageValidator.validateComplete(corruptedPackage);
      expect(validationResult.valid).toBe(false);

      // Record error
      await deploymentMonitor.recordDeploymentError(deploymentId,
        new Error('Package validation failed: missing required files'));

      // Complete with failure
      const completionResult = await deploymentMonitor.recordDeploymentCompletion(deploymentId, {
        success: false,
        error: 'Package validation failed',
        validationResults: {
          package: validationResult
        }
      });

      expect(completionResult.summary.status).toBe('failed');
    });

    test('should validate security requirements throughout deployment', async () => {
      const deploymentId = await deploymentMonitor.trackDeploymentStart({
        packageName: 'security-test-package',
        version: '1.0.0',
        environment: 'production' // Higher security requirements
      });

      // Enhanced security validation for production
      const securityOptions = {
        strictMode: true,
        requireSignature: true,
        scanTimeout: 60000
      };

      await deploymentMonitor.updateDeploymentPhase(deploymentId, 'enhanced-security-scan');

      const packagePath = path.join(tempDir, 'security-test.zip');
      const securityResults = await securitySuite.performComprehensiveVerification(
        packagePath,
        securityOptions
      );

      // Production deployments should have higher security standards
      if (securityResults.overallSecurity === 'critical' || securityResults.overallSecurity === 'poor') {
        await deploymentMonitor.recordDeploymentError(deploymentId,
          new Error(`Security validation failed: ${securityResults.overallSecurity} security level`));

        const result = await deploymentMonitor.recordDeploymentCompletion(deploymentId, {
          success: false,
          error: 'Security requirements not met'
        });

        expect(result.summary.status).toBe('failed');
      } else {
        const result = await deploymentMonitor.recordDeploymentCompletion(deploymentId, {
          success: true,
          securityLevel: securityResults.overallSecurity
        });

        expect(result.summary.status).toBe('completed');
      }
    });
  });

  describe('Component Integration Tests', () => {
    test('should integrate package validator with checksum generator', async () => {
      // Generate checksums for test package
      const testDir = path.join(tempDir, 'integration-test');
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }

      // Create test files
      fs.writeFileSync(path.join(testDir, 'app.js'), 'console.log("test");');
      fs.writeFileSync(path.join(testDir, 'config.json'), '{"test": true}');

      const checksumFile = path.join(testDir, 'checksums.json');
      const checksumData = await checksumGenerator.generateDirectoryChecksums(testDir, checksumFile);

      expect(checksumData.summary.totalFiles).toBeGreaterThan(0);
      expect(fs.existsSync(checksumFile)).toBe(true);

      // Verify checksums
      const verificationResult = await checksumGenerator.verifyChecksums(checksumFile, testDir);
      expect(verificationResult.valid).toBe(true);
      expect(verificationResult.summary.verifiedFiles).toBe(checksumData.summary.totalFiles);
    });

    test('should integrate installer validator with auto updater', async () => {
      const testInstallPath = path.join(tempDir, 'auto-update-test');
      const packagePath = global.createMockPackage({
        name: 'update-test-app',
        version: '1.0.0'
      });

      // Initial installation
      const installResult = await installerValidator.performInstallation({
        packagePath,
        installPath: testInstallPath,
        mode: 'fresh'
      });

      expect(installResult.success).toBe(true);

      // Validate installation
      const validation = await installerValidator.validateInstallation({
        installPath: testInstallPath
      });

      expect(validation.complete).toBe(true);

      // Test update process
      const updatePackage = global.createMockPackage({
        name: 'update-test-app',
        version: '1.1.0'
      });

      const updateResult = await installerValidator.performInstallation({
        packagePath: updatePackage,
        installPath: testInstallPath,
        mode: 'update'
      });

      expect(updateResult.success).toBe(true);
    });

    test('should integrate security verification with deployment monitoring', async () => {
      let securityAlerts = 0;
      let deploymentAlerts = 0;

      // Setup event listeners
      securitySuite.on('threat-detected', () => securityAlerts++);
      deploymentMonitor.on('alert-created', (alert) => {
        if (alert.type.includes('security')) deploymentAlerts++;
      });

      const deploymentId = await deploymentMonitor.trackDeploymentStart({
        packageName: 'security-monitored-package',
        version: '1.0.0',
        environment: 'test'
      });

      await deploymentMonitor.updateDeploymentPhase(deploymentId, 'security-scan');

      // Simulate security scan that might detect issues
      const packagePath = path.join(tempDir, 'monitored-package.zip');
      await securitySuite.performComprehensiveVerification(packagePath);

      // Verify monitoring captured security events
      const healthReport = await deploymentMonitor.generateHealthReport();
      expect(healthReport).toBeDefined();
      expect(healthReport.systemHealth).toBeDefined();

      await deploymentMonitor.recordDeploymentCompletion(deploymentId, {
        success: true,
        securityAlertsGenerated: securityAlerts
      });
    });
  });

  describe('Performance and Reliability Tests', () => {
    test('should handle concurrent deployment validations', async () => {
      const concurrentDeployments = 5;
      const deploymentPromises = [];

      for (let i = 0; i < concurrentDeployments; i++) {
        const deploymentPromise = (async () => {
          const deploymentId = await deploymentMonitor.trackDeploymentStart({
            packageName: `concurrent-package-${i}`,
            version: '1.0.0',
            environment: 'test'
          });

          const testPkg = global.createMockDeploymentPackage();
          const validation = await packageValidator.validateComplete(testPkg);

          await deploymentMonitor.recordDeploymentCompletion(deploymentId, {
            success: validation.valid,
            concurrentId: i
          });

          return { deploymentId, success: validation.valid };
        })();

        deploymentPromises.push(deploymentPromise);
      }

      const results = await Promise.all(deploymentPromises);

      // All deployments should succeed
      expect(results.every(r => r.success)).toBe(true);

      // Verify monitoring tracked all deployments
      const stats = await deploymentMonitor.getDeploymentStatistics();
      expect(stats.recent).toBeGreaterThanOrEqual(concurrentDeployments);
    });

    test('should maintain performance within acceptable limits', async () => {
      const performanceTest = async () => {
        const startTime = Date.now();

        const testPkg = global.createMockDeploymentPackage();

        // Run full validation suite
        const packageValidation = await packageValidator.validateComplete(testPkg);
        const packagePath = path.join(tempDir, 'perf-test.zip');
        const securityScan = await securitySuite.performComprehensiveVerification(packagePath);

        const endTime = Date.now();
        const duration = endTime - startTime;

        return {
          duration,
          packageValid: packageValidation.valid,
          securityLevel: securityScan.overallSecurity
        };
      };

      // Run performance test multiple times
      const iterations = 3;
      const results = [];

      for (let i = 0; i < iterations; i++) {
        const result = await performanceTest();
        results.push(result);
      }

      // Calculate average duration
      const averageDuration = results.reduce((sum, r) => sum + r.duration, 0) / iterations;

      // Performance should be under 10 seconds for full validation
      expect(averageDuration).toBeLessThan(10000);

      // All validations should succeed
      expect(results.every(r => r.packageValid)).toBe(true);
    });

    test('should handle large package validation efficiently', async () => {
      // Create a larger mock package
      const largePackageFiles = {};

      // Generate multiple files to simulate larger package
      for (let i = 0; i < 50; i++) {
        largePackageFiles[`file-${i}.js`] = `console.log("File ${i}"); `.repeat(100);
      }

      const largePackage = global.createMockDeploymentPackage();
      largePackage.manifest.files = Object.keys(largePackageFiles).map(fileName => ({
        path: fileName,
        checksum: `mock-checksum-${fileName}`,
        size: Buffer.from(largePackageFiles[fileName]).length,
        required: false
      }));

      // Add files to package
      Object.entries(largePackageFiles).forEach(([fileName, content]) => {
        largePackage.files.set(fileName, Buffer.from(content));
      });

      const startTime = Date.now();
      const validation = await packageValidator.validateComplete(largePackage);
      const duration = Date.now() - startTime;

      expect(validation.valid).toBe(true);
      expect(duration).toBeLessThan(15000); // Should handle large packages within 15 seconds
      expect(validation.fileIntegrity.checkedFiles).toBe(largePackage.manifest.files.length);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle and report validation errors gracefully', async () => {
      const deploymentId = await deploymentMonitor.trackDeploymentStart({
        packageName: 'error-test-package',
        version: '1.0.0',
        environment: 'test'
      });

      // Test various error scenarios
      const errorScenarios = [
        {
          name: 'missing-files',
          package: {
            ...testPackage,
            files: new Map() // Empty files map
          }
        },
        {
          name: 'invalid-manifest',
          package: {
            ...testPackage,
            manifest: null
          }
        },
        {
          name: 'corrupted-checksums',
          package: {
            ...testPackage,
            manifest: {
              ...testPackage.manifest,
              files: testPackage.manifest.files.map(f => ({
                ...f,
                checksum: 'corrupted-checksum'
              }))
            }
          }
        }
      ];

      for (const scenario of errorScenarios) {
        try {
          await deploymentMonitor.updateDeploymentPhase(deploymentId, `testing-${scenario.name}`);

          const validation = await packageValidator.validateComplete(scenario.package);

          expect(validation.valid).toBe(false);
          expect(validation.errors.length).toBeGreaterThan(0);

          console.log(`✅ Error scenario '${scenario.name}' handled correctly`);
        } catch (error) {
          await deploymentMonitor.recordDeploymentError(deploymentId, error);
        }
      }

      const result = await deploymentMonitor.recordDeploymentCompletion(deploymentId, {
        success: true,
        testedErrorScenarios: errorScenarios.length
      });

      expect(result.quality.errorCount).toBeGreaterThan(0);
    });

    test('should implement proper cleanup on deployment failure', async () => {
      const testInstallPath = path.join(tempDir, 'cleanup-test');
      const backupPath = path.join(tempDir, 'cleanup-backup');

      // Create initial installation
      fs.mkdirSync(testInstallPath, { recursive: true });
      fs.mkdirSync(backupPath, { recursive: true });
      fs.writeFileSync(path.join(testInstallPath, 'existing-file.txt'), 'existing content');

      const packagePath = global.createMockPackage({
        name: 'failing-package',
        version: '1.0.0'
      });

      // Simulate failed installation
      try {
        await installerValidator.performInstallation({
          packagePath: 'non-existent-package.zip', // This should fail
          installPath: testInstallPath,
          mode: 'update',
          createBackup: true
        });
      } catch (error) {
        // Expected failure
      }

      // Verify original files are preserved
      expect(fs.existsSync(path.join(testInstallPath, 'existing-file.txt'))).toBe(true);
    });
  });

  describe('Comprehensive Test Report Generation', () => {
    test('should generate comprehensive deployment test report', async () => {
      const deploymentId = await deploymentMonitor.trackDeploymentStart({
        packageName: 'comprehensive-test-package',
        version: '1.0.0',
        environment: 'test'
      });

      // Perform all validations
      const packageValidation = await packageValidator.validateComplete(testPackage);
      const packageReport = await packageValidator.generateValidationReport(testPackage);

      const packagePath = path.join(tempDir, 'comprehensive-test.zip');
      const securityResults = await securitySuite.performComprehensiveVerification(packagePath);

      const installResult = await installerValidator.performInstallation({
        packagePath,
        installPath: path.join(tempDir, 'comprehensive-install'),
        mode: 'fresh'
      });

      // Complete deployment with comprehensive results
      const completionResult = await deploymentMonitor.recordDeploymentCompletion(deploymentId, {
        success: packageValidation.valid && installResult.success,
        validationResults: {
          package: packageValidation,
          packageReport: packageReport,
          security: securityResults,
          installation: installResult
        }
      });

      // Generate final health report
      const healthReport = await deploymentMonitor.generateHealthReport();

      // Verify comprehensive report contains all necessary information
      expect(completionResult.summary).toBeDefined();
      expect(completionResult.performance).toBeDefined();
      expect(completionResult.quality).toBeDefined();
      expect(completionResult.recommendations).toBeDefined();

      expect(packageReport.report).toContain('Package Validation Report');
      expect(packageReport.summary.totalChecks).toBeGreaterThan(0);

      expect(healthReport.deploymentStats).toBeDefined();
      expect(healthReport.performance).toBeDefined();
      expect(healthReport.trends).toBeDefined();

      console.log('📊 Comprehensive test report generated successfully');
      console.log(`   - Package validation: ${packageValidation.valid ? 'PASSED' : 'FAILED'}`);
      console.log(`   - Security level: ${securityResults.overallSecurity}`);
      console.log(`   - Installation: ${installResult.success ? 'SUCCESSFUL' : 'FAILED'}`);
      console.log(`   - Overall health: ${healthReport.systemHealth}`);
    });
  });
});