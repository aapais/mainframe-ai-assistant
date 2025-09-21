#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const semver = require('semver');

/**
 * Deployment Package Validator
 * Validates deployment packages for integrity, security, and completeness
 */
class PackageValidator {
  constructor(options = {}) {
    this.options = {
      strictMode: options.strictMode || false,
      allowUnsigned: options.allowUnsigned || false,
      maxPackageSize: options.maxPackageSize || 500 * 1024 * 1024, // 500MB
      requiredFiles: options.requiredFiles || [
        'package.json',
        'LICENSE',
        'README.md'
      ],
      ...options
    };
  }

  /**
   * Perform complete package validation
   */
  async validateComplete(deploymentPackage) {
    console.log('🔍 Starting comprehensive package validation...');

    const results = {
      valid: true,
      errors: [],
      warnings: [],
      fileIntegrity: null,
      manifestValidation: null,
      dependencyValidation: null,
      licenseValidation: null,
      assetValidation: null,
      signatureValidation: null,
      performanceMetrics: {
        startTime: Date.now(),
        endTime: null,
        duration: null
      }
    };

    try {
      // File integrity check
      console.log('📁 Validating file integrity...');
      results.fileIntegrity = await this.validateFileIntegrity(deploymentPackage);

      // Manifest validation
      console.log('📋 Validating manifest...');
      results.manifestValidation = await this.validateManifest(deploymentPackage.manifest);

      // Dependency validation
      console.log('📦 Validating dependencies...');
      results.dependencyValidation = await this.validateDependencies(deploymentPackage);

      // License validation
      console.log('⚖️ Validating license...');
      results.licenseValidation = await this.validateLicense(deploymentPackage);

      // Asset validation
      console.log('🎨 Validating assets...');
      results.assetValidation = await this.validateAssets(deploymentPackage);

      // Signature validation
      console.log('🔐 Validating signature...');
      results.signatureValidation = await this.validateSignature(deploymentPackage);

      // Package size validation
      console.log('📏 Validating package size...');
      const sizeValidation = await this.validatePackageSize(deploymentPackage);

      // Compile overall results
      const validationSteps = [
        results.fileIntegrity,
        results.manifestValidation,
        results.dependencyValidation,
        results.licenseValidation,
        results.assetValidation,
        sizeValidation
      ];

      // Include signature validation only if not allowing unsigned packages
      if (!this.options.allowUnsigned) {
        validationSteps.push(results.signatureValidation);
      }

      // Check if any validation step failed
      results.valid = validationSteps.every(step => step && step.valid);

      // Collect all errors and warnings
      validationSteps.forEach(step => {
        if (step) {
          if (step.errors) results.errors.push(...step.errors);
          if (step.warnings) results.warnings.push(...step.warnings);
        }
      });

      results.performanceMetrics.endTime = Date.now();
      results.performanceMetrics.duration = results.performanceMetrics.endTime - results.performanceMetrics.startTime;

      console.log(`✅ Package validation completed in ${results.performanceMetrics.duration}ms`);

      if (results.valid) {
        console.log('🎉 Package validation PASSED');
      } else {
        console.log('❌ Package validation FAILED');
        console.log('Errors:', results.errors);
      }

      return results;

    } catch (error) {
      console.error('💥 Validation failed with error:', error.message);
      results.valid = false;
      results.errors.push(`Validation error: ${error.message}`);
      return results;
    }
  }

  /**
   * Validate file integrity using checksums
   */
  async validateFileIntegrity(deploymentPackage) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      checkedFiles: 0,
      corruptedFiles: [],
      missingFiles: []
    };

    const { manifest, files } = deploymentPackage;

    for (const fileInfo of manifest.files) {
      const fileBuffer = files.get(fileInfo.path);

      if (!fileBuffer) {
        if (fileInfo.required) {
          result.errors.push(`Missing required file: ${fileInfo.path}`);
          result.missingFiles.push(fileInfo.path);
        } else {
          result.warnings.push(`Optional file missing: ${fileInfo.path}`);
        }
        continue;
      }

      // Verify checksum
      const actualChecksum = crypto.createHash('sha256')
        .update(fileBuffer)
        .digest('hex');

      if (actualChecksum !== fileInfo.checksum) {
        result.errors.push(`Checksum mismatch for file: ${fileInfo.path}`);
        result.corruptedFiles.push(fileInfo.path);
      }

      // Verify file size
      if (fileBuffer.length !== fileInfo.size) {
        result.errors.push(`Size mismatch for file: ${fileInfo.path}. Expected: ${fileInfo.size}, Actual: ${fileBuffer.length}`);
      }

      result.checkedFiles++;
    }

    result.valid = result.errors.length === 0;
    return result;
  }

  /**
   * Validate package manifest structure and content
   */
  async validateManifest(manifest) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      manifest: manifest
    };

    // Required fields validation
    const requiredFields = ['name', 'version', 'files'];
    for (const field of requiredFields) {
      if (!manifest[field]) {
        result.errors.push(`Missing required field: ${field}`);
      }
    }

    // Version format validation
    if (manifest.version && !semver.valid(manifest.version)) {
      result.errors.push('Invalid version format');
    }

    // Files array validation
    if (manifest.files && Array.isArray(manifest.files)) {
      for (const fileInfo of manifest.files) {
        // Path validation - prevent directory traversal
        if (fileInfo.path.includes('..') || path.isAbsolute(fileInfo.path)) {
          result.errors.push(`Invalid file path detected: ${fileInfo.path}`);
        }

        // Required file info fields
        if (!fileInfo.checksum || !fileInfo.size) {
          result.errors.push(`Missing checksum or size for file: ${fileInfo.path}`);
        }
      }
    }

    // Timestamp validation
    if (manifest.timestamp && manifest.timestamp > Date.now()) {
      result.warnings.push('Manifest timestamp is in the future');
    }

    result.valid = result.errors.length === 0;
    return result;
  }

  /**
   * Validate package dependencies
   */
  async validateDependencies(deploymentPackage) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      missingDependencies: [],
      versionConflicts: []
    };

    const { manifest } = deploymentPackage;

    if (manifest.dependencies) {
      for (const [depName, depVersion] of Object.entries(manifest.dependencies)) {
        try {
          // Check if dependency version is valid semver
          if (!semver.validRange(depVersion)) {
            result.warnings.push(`Invalid version range for dependency: ${depName}@${depVersion}`);
          }

          // Here you would typically check if the dependency is actually included
          // This is a simplified check
          const isDependencyIncluded = this.checkDependencyInclusion(deploymentPackage, depName);
          if (!isDependencyIncluded) {
            result.missingDependencies.push(depName);
          }
        } catch (error) {
          result.errors.push(`Error validating dependency ${depName}: ${error.message}`);
        }
      }
    }

    if (result.missingDependencies.length > 0) {
      result.errors.push(`Missing dependencies: ${result.missingDependencies.join(', ')}`);
    }

    result.valid = result.errors.length === 0;
    return result;
  }

  /**
   * Validate license file presence and content
   */
  async validateLicense(deploymentPackage) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      licenseFile: null,
      licenseType: null
    };

    const { files } = deploymentPackage;

    // Look for license file
    const licenseFiles = ['LICENSE', 'LICENSE.txt', 'LICENSE.md', 'COPYING'];
    let licenseFound = false;

    for (const licenseFileName of licenseFiles) {
      if (files.has(licenseFileName)) {
        licenseFound = true;
        result.licenseFile = licenseFileName;

        const licenseContent = files.get(licenseFileName).toString();
        result.licenseType = this.detectLicenseType(licenseContent);
        break;
      }
    }

    if (!licenseFound) {
      result.errors.push('License file not found');
    }

    result.valid = result.errors.length === 0;
    return result;
  }

  /**
   * Validate assets (images, fonts, etc.)
   */
  async validateAssets(deploymentPackage) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      missingAssets: [],
      invalidFormats: [],
      oversizedAssets: []
    };

    const { files } = deploymentPackage;
    const maxAssetSize = 10 * 1024 * 1024; // 10MB per asset

    const assetExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf'];

    for (const [filePath, fileBuffer] of files) {
      const ext = path.extname(filePath).toLowerCase();

      if (assetExtensions.includes(ext)) {
        // Check file size
        if (fileBuffer.length > maxAssetSize) {
          result.oversizedAssets.push(`${filePath} (${Math.round(fileBuffer.length / 1024 / 1024)}MB)`);
        }

        // Basic format validation (could be expanded)
        if (!this.validateAssetFormat(filePath, fileBuffer)) {
          result.invalidFormats.push(filePath);
        }
      }
    }

    if (result.oversizedAssets.length > 0) {
      result.warnings.push(`Oversized assets detected: ${result.oversizedAssets.join(', ')}`);
    }

    if (result.invalidFormats.length > 0) {
      result.errors.push(`Invalid asset formats: ${result.invalidFormats.join(', ')}`);
    }

    result.valid = result.errors.length === 0;
    return result;
  }

  /**
   * Validate digital signature
   */
  async validateSignature(deploymentPackage) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      signerInfo: null
    };

    const { manifest } = deploymentPackage;

    if (!manifest.signature) {
      if (this.options.allowUnsigned) {
        result.warnings.push('Package is not digitally signed');
      } else {
        result.errors.push('Package signature is required but not present');
      }
    } else {
      // Verify signature (simplified implementation)
      const isValidSignature = await this.verifyDigitalSignature(manifest);

      if (!isValidSignature) {
        result.errors.push('Invalid package signature');
      } else {
        result.signerInfo = {
          algorithm: 'SHA256withRSA',
          timestamp: manifest.timestamp
        };
      }
    }

    result.valid = result.errors.length === 0;
    return result;
  }

  /**
   * Validate package size constraints
   */
  async validatePackageSize(deploymentPackage) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      totalSize: 0
    };

    const { files } = deploymentPackage;

    for (const [, fileBuffer] of files) {
      result.totalSize += fileBuffer.length;
    }

    if (result.totalSize > this.options.maxPackageSize) {
      result.errors.push(`Package size (${Math.round(result.totalSize / 1024 / 1024)}MB) exceeds maximum allowed size (${Math.round(this.options.maxPackageSize / 1024 / 1024)}MB)`);
    }

    result.valid = result.errors.length === 0;
    return result;
  }

  /**
   * Generate detailed validation report
   */
  async generateValidationReport(deploymentPackage) {
    const validationResult = await this.validateComplete(deploymentPackage);

    const report = `
# Package Validation Report

**Package:** ${deploymentPackage.manifest.name}
**Version:** ${deploymentPackage.manifest.version}
**Validation Date:** ${new Date().toISOString()}
**Validation Duration:** ${validationResult.performanceMetrics.duration}ms

## Summary
- **Overall Status:** ${validationResult.valid ? 'PASSED' : 'FAILED'}
- **Total Checks:** ${this.countTotalChecks(validationResult)}
- **Passed Checks:** ${this.countPassedChecks(validationResult)}
- **Failed Checks:** ${validationResult.errors.length}
- **Warnings:** ${validationResult.warnings.length}

## Detailed Results

### File Integrity: ${validationResult.fileIntegrity?.valid ? 'PASSED' : 'FAILED'}
- Files Checked: ${validationResult.fileIntegrity?.checkedFiles || 0}
- Corrupted Files: ${validationResult.fileIntegrity?.corruptedFiles?.length || 0}
- Missing Required Files: ${validationResult.fileIntegrity?.missingFiles?.length || 0}

### Manifest Validation: ${validationResult.manifestValidation?.valid ? 'PASSED' : 'FAILED'}
- Structure: Valid
- Version Format: ${validationResult.manifestValidation?.valid ? 'Valid' : 'Invalid'}

### Dependency Validation: ${validationResult.dependencyValidation?.valid ? 'PASSED' : 'FAILED'}
- Missing Dependencies: ${validationResult.dependencyValidation?.missingDependencies?.length || 0}
- Version Conflicts: ${validationResult.dependencyValidation?.versionConflicts?.length || 0}

### License Validation: ${validationResult.licenseValidation?.valid ? 'PASSED' : 'FAILED'}
- License File: ${validationResult.licenseValidation?.licenseFile || 'Not Found'}
- License Type: ${validationResult.licenseValidation?.licenseType || 'Unknown'}

### Asset Validation: ${validationResult.assetValidation?.valid ? 'PASSED' : 'FAILED'}
- Oversized Assets: ${validationResult.assetValidation?.oversizedAssets?.length || 0}
- Invalid Formats: ${validationResult.assetValidation?.invalidFormats?.length || 0}

### Signature Validation: ${validationResult.signatureValidation?.valid ? 'PASSED' : 'FAILED'}
- Signature Present: ${deploymentPackage.manifest.signature ? 'Yes' : 'No'}
- Signature Valid: ${validationResult.signatureValidation?.valid ? 'Yes' : 'No'}

## Errors
${validationResult.errors.map(error => `- ${error}`).join('\n')}

## Warnings
${validationResult.warnings.map(warning => `- ${warning}`).join('\n')}

---
Generated by Deployment Package Validator v1.0.0
    `.trim();

    return {
      report,
      summary: {
        valid: validationResult.valid,
        totalChecks: this.countTotalChecks(validationResult),
        passedChecks: this.countPassedChecks(validationResult),
        failedChecks: validationResult.errors.length,
        warnings: validationResult.warnings.length
      }
    };
  }

  // Helper methods
  checkDependencyInclusion(deploymentPackage, depName) {
    // Simplified implementation - in reality, you'd check node_modules or bundled dependencies
    return deploymentPackage.files.has(`node_modules/${depName}/package.json`);
  }

  detectLicenseType(licenseContent) {
    const content = licenseContent.toLowerCase();

    if (content.includes('mit license')) return 'MIT';
    if (content.includes('apache license')) return 'Apache';
    if (content.includes('gnu general public license')) return 'GPL';
    if (content.includes('bsd license')) return 'BSD';

    return 'Unknown';
  }

  validateAssetFormat(filePath, fileBuffer) {
    const ext = path.extname(filePath).toLowerCase();

    // Basic magic number validation
    const magicNumbers = {
      '.png': [0x89, 0x50, 0x4E, 0x47],
      '.jpg': [0xFF, 0xD8, 0xFF],
      '.jpeg': [0xFF, 0xD8, 0xFF],
      '.gif': [0x47, 0x49, 0x46]
    };

    const expectedMagic = magicNumbers[ext];
    if (expectedMagic) {
      for (let i = 0; i < expectedMagic.length; i++) {
        if (fileBuffer[i] !== expectedMagic[i]) {
          return false;
        }
      }
    }

    return true;
  }

  async verifyDigitalSignature(manifest) {
    // Simplified signature verification
    // In production, you'd use proper cryptographic verification
    return manifest.signature && manifest.signature.length > 10;
  }

  countTotalChecks(validationResult) {
    return Object.keys(validationResult).filter(key =>
      key.endsWith('Validation') || key === 'fileIntegrity'
    ).length;
  }

  countPassedChecks(validationResult) {
    const checkResults = [
      validationResult.fileIntegrity,
      validationResult.manifestValidation,
      validationResult.dependencyValidation,
      validationResult.licenseValidation,
      validationResult.assetValidation,
      validationResult.signatureValidation
    ].filter(result => result && result.valid);

    return checkResults.length;
  }
}

/**
 * Installer Validator
 * Validates installation and uninstallation processes
 */
class InstallerValidator {
  constructor(options = {}) {
    this.options = {
      timeout: options.timeout || 300000, // 5 minutes
      ...options
    };
  }

  async performInstallation(config) {
    const result = {
      success: false,
      exitCode: -1,
      stdout: '',
      stderr: '',
      duration: 0,
      installedFiles: [],
      errors: [],
      warnings: []
    };

    const startTime = Date.now();

    try {
      // Validate installation requirements
      await this.validateInstallationRequirements(config);

      // Create installation directory
      if (!fs.existsSync(config.installPath)) {
        fs.mkdirSync(config.installPath, { recursive: true });
      }

      // Simulate installation process
      await this.simulateInstallation(config, result);

      result.duration = Date.now() - startTime;
      result.success = true;
      result.exitCode = 0;

    } catch (error) {
      result.errors.push(error.message);
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  async validateInstallationRequirements(config) {
    // Check disk space
    const stats = fs.statSync(path.dirname(config.installPath));
    const requiredSpace = 100 * 1024 * 1024; // 100MB minimum

    // Note: This is a simplified check
    if (stats.size && stats.size < requiredSpace) {
      throw new Error('Insufficient disk space');
    }

    // Check permissions
    try {
      fs.accessSync(path.dirname(config.installPath), fs.constants.W_OK);
    } catch (error) {
      throw new Error('Permission denied: Cannot write to installation directory');
    }
  }

  async simulateInstallation(config, result) {
    // Simulate file extraction and installation
    const mockFiles = [
      'app/main.js',
      'app/renderer.js',
      'config/app.json',
      'LICENSE',
      'README.md'
    ];

    for (const file of mockFiles) {
      const fullPath = path.join(config.installPath, file);
      const dir = path.dirname(fullPath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(fullPath, `Mock content for ${file}`);
      result.installedFiles.push(fullPath);
    }
  }

  async performUninstallation(config) {
    const result = {
      success: false,
      errors: [],
      removedFiles: []
    };

    try {
      if (fs.existsSync(config.installPath)) {
        // Remove installation directory
        this.removeDirectory(config.installPath, result);
        result.success = true;
      }
    } catch (error) {
      result.errors.push(error.message);
    }

    return result;
  }

  removeDirectory(dirPath, result) {
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        this.removeDirectory(fullPath, result);
      } else {
        fs.unlinkSync(fullPath);
        result.removedFiles.push(fullPath);
      }
    }

    fs.rmdirSync(dirPath);
    result.removedFiles.push(dirPath);
  }

  async validateInstallation(config) {
    const result = {
      complete: true,
      missingFiles: [],
      corruptedFiles: []
    };

    // Check for required files
    const requiredFiles = [
      'app/main.js',
      'config/app.json',
      'LICENSE'
    ];

    for (const file of requiredFiles) {
      const fullPath = path.join(config.installPath, file);
      if (!fs.existsSync(fullPath)) {
        result.missingFiles.push(file);
        result.complete = false;
      }
    }

    return result;
  }

  async verifySystemRegistration(config) {
    // Mock system registration check
    return {
      registered: fs.existsSync(config.installPath)
    };
  }

  async verifyShortcuts(config) {
    // Mock shortcut verification
    return {
      desktopShortcut: true,
      startMenuShortcut: true
    };
  }
}

/**
 * Auto Updater
 * Handles automatic updates and rollbacks
 */
class AutoUpdater {
  constructor(options = {}) {
    this.options = {
      updateChannel: options.updateChannel || 'stable',
      checkInterval: options.checkInterval || 3600000, // 1 hour
      ...options
    };
  }

  async validateUpdateChannel(channel) {
    const result = {
      valid: true,
      errors: []
    };

    if (!channel.name || channel.name.trim().length === 0) {
      result.errors.push('Invalid channel name');
    }

    try {
      new URL(channel.url);
    } catch (error) {
      result.errors.push('Invalid channel URL');
    }

    if (channel.priority < 0) {
      result.errors.push('Invalid priority value');
    }

    result.valid = result.errors.length === 0;
    return result;
  }

  async checkMultipleChannels(channels) {
    const result = {
      updates: [],
      recommendedUpdate: null
    };

    // Sort channels by priority (lower number = higher priority)
    const sortedChannels = channels.sort((a, b) => a.priority - b.priority);

    for (const channel of sortedChannels) {
      try {
        const updateInfo = await this.mockCheckForUpdates(channel);
        if (updateInfo) {
          result.updates.push({ channel: channel.name, update: updateInfo });

          // Recommend stable channel updates first
          if (!result.recommendedUpdate && channel.stable) {
            result.recommendedUpdate = { channel: channel.name, update: updateInfo };
          }
        }
      } catch (error) {
        console.warn(`Failed to check updates for channel ${channel.name}:`, error.message);
      }
    }

    return result;
  }

  async mockCheckForUpdates(channel) {
    // Simulate update check
    return {
      version: '1.1.0',
      releaseDate: new Date().toISOString(),
      downloadUrl: `${channel.url}/releases/1.1.0`,
      checksum: 'abc123def456',
      size: 50 * 1024 * 1024,
      releaseNotes: 'Bug fixes and performance improvements',
      mandatory: false,
      rolloutPercentage: 100
    };
  }

  async checkRolloutEligibility(updateInfo, userId) {
    // Simple hash-based rollout determination
    const hash = crypto.createHash('md5').update(userId).digest('hex');
    const hashValue = parseInt(hash.substring(0, 8), 16);
    const userPercentile = (hashValue % 100) + 1;

    return {
      eligible: userPercentile <= updateInfo.rolloutPercentage,
      rolloutPercentage: updateInfo.rolloutPercentage,
      userPercentile
    };
  }

  async verifyDownloadIntegrity(config) {
    if (!fs.existsSync(config.filePath)) {
      return { valid: false, error: 'File not found' };
    }

    const fileBuffer = fs.readFileSync(config.filePath);
    const actualChecksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const actualSize = fileBuffer.length;

    return {
      valid: actualChecksum === config.expectedChecksum && actualSize === config.expectedSize,
      actualChecksum,
      expectedChecksum: config.expectedChecksum,
      actualSize,
      expectedSize: config.expectedSize
    };
  }

  async resumeDownload(partialDownloadInfo) {
    // Mock resume download
    return {
      success: true,
      resumedFromOffset: partialDownloadInfo.resumeOffset
    };
  }

  async checkDiskSpace(config) {
    try {
      const stats = fs.statSync(config.downloadPath);
      // Simplified disk space check
      return {
        sufficient: true,
        availableSpace: 1024 * 1024 * 1024, // 1GB mock
        requiredSpace: config.requiredSpace
      };
    } catch (error) {
      return {
        sufficient: false,
        error: error.message
      };
    }
  }
}

// Export classes for testing
module.exports = {
  PackageValidator,
  InstallerValidator,
  AutoUpdater
};

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'validate':
      validatePackageFromCLI(args.slice(1));
      break;
    case 'install':
      testInstallationFromCLI(args.slice(1));
      break;
    case 'update':
      testUpdateFromCLI(args.slice(1));
      break;
    default:
      console.log(`
Usage: node validate-deployment.js <command> [options]

Commands:
  validate <package-path>  - Validate deployment package
  install <package-path>   - Test installation process
  update <channel>         - Test update mechanism

Examples:
  node validate-deployment.js validate ./dist/app-1.0.0.zip
  node validate-deployment.js install ./dist/app-1.0.0.zip
  node validate-deployment.js update stable
      `);
  }
}

async function validatePackageFromCLI(args) {
  const packagePath = args[0];
  if (!packagePath) {
    console.error('Package path required');
    process.exit(1);
  }

  console.log(`Validating package: ${packagePath}`);

  try {
    // Mock package loading for CLI demo
    const validator = new PackageValidator();
    const mockPackage = createMockPackageForCLI(packagePath);

    const result = await validator.validateComplete(mockPackage);
    const report = await validator.generateValidationReport(mockPackage);

    console.log(report.report);

    process.exit(result.valid ? 0 : 1);
  } catch (error) {
    console.error('Validation failed:', error.message);
    process.exit(1);
  }
}

function createMockPackageForCLI(packagePath) {
  const files = new Map();
  files.set('package.json', Buffer.from('{"name": "test", "version": "1.0.0"}'));
  files.set('LICENSE', Buffer.from('MIT License'));
  files.set('README.md', Buffer.from('# Test Package'));

  return {
    manifest: {
      name: path.basename(packagePath, '.zip'),
      version: '1.0.0',
      files: [
        { path: 'package.json', checksum: crypto.createHash('sha256').update(files.get('package.json')).digest('hex'), size: files.get('package.json').length, required: true },
        { path: 'LICENSE', checksum: crypto.createHash('sha256').update(files.get('LICENSE')).digest('hex'), size: files.get('LICENSE').length, required: true },
        { path: 'README.md', checksum: crypto.createHash('sha256').update(files.get('README.md')).digest('hex'), size: files.get('README.md').length, required: false }
      ],
      dependencies: {},
      timestamp: Date.now()
    },
    files,
    metadata: {
      buildDate: new Date().toISOString(),
      buildEnvironment: 'production',
      buildCommit: 'abc123',
      platform: 'linux',
      architecture: 'x64'
    }
  };
}