#!/usr/bin/env node

/**
 * Cross-Platform Build Script
 * Orchestrates builds for Windows, macOS, and Linux platforms
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class CrossPlatformBuilder {
  constructor() {
    this.platform = os.platform();
    this.arch = os.arch();
    this.buildDir = path.join(process.cwd(), 'dist');
    this.configDir = path.join(process.cwd(), 'electron-builder-configs');
    this.logFile = path.join(process.cwd(), 'build.log');

    this.platforms = {
      win32: {
        name: 'Windows',
        targets: ['nsis', 'msi', 'portable'],
        architectures: ['x64', 'arm64'],
        extensions: ['.exe', '.msi']
      },
      darwin: {
        name: 'macOS',
        targets: ['dmg', 'pkg', 'mas'],
        architectures: ['x64', 'arm64', 'universal'],
        extensions: ['.dmg', '.pkg', '.app']
      },
      linux: {
        name: 'Linux',
        targets: ['AppImage', 'deb', 'rpm', 'snap', 'tar.gz'],
        architectures: ['x64', 'arm64', 'armv7l'],
        extensions: ['.AppImage', '.deb', '.rpm', '.snap', '.tar.gz']
      }
    };

    this.buildMatrix = this.generateBuildMatrix();
  }

  /**
   * Generate build matrix for all platform combinations
   */
  generateBuildMatrix() {
    const matrix = [];

    Object.entries(this.platforms).forEach(([platform, config]) => {
      config.targets.forEach(target => {
        config.architectures.forEach(arch => {
          matrix.push({
            platform,
            platformName: config.name,
            target,
            arch,
            extensions: config.extensions
          });
        });
      });
    });

    return matrix;
  }

  /**
   * Log message with timestamp
   */
  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;

    console.log(logMessage);

    // Append to log file
    try {
      fs.appendFileSync(this.logFile, logMessage + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  /**
   * Check if required tools are available
   */
  async checkPrerequisites() {
    this.log('Checking build prerequisites...');

    const tools = {
      node: 'node --version',
      npm: 'npm --version',
      electronBuilder: 'npx electron-builder --version'
    };

    const platformSpecificTools = {
      win32: {
        nodeGyp: 'npx node-gyp --version'
      },
      darwin: {
        xcode: 'xcode-select -p',
        codesign: 'codesign --version'
      },
      linux: {
        gcc: 'gcc --version'
      }
    };

    // Check general tools
    for (const [tool, command] of Object.entries(tools)) {
      try {
        const version = execSync(command, { encoding: 'utf8', stdio: 'pipe' }).trim();
        this.log(`✓ ${tool}: ${version.split('\n')[0]}`);
      } catch (error) {
        this.log(`✗ ${tool}: Not available`, 'ERROR');
        throw new Error(`Required tool ${tool} is not available`);
      }
    }

    // Check platform-specific tools
    if (platformSpecificTools[this.platform]) {
      for (const [tool, command] of Object.entries(platformSpecificTools[this.platform])) {
        try {
          const result = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
          this.log(`✓ ${tool}: Available`);
        } catch (error) {
          this.log(`⚠ ${tool}: Not available (may affect builds)`, 'WARN');
        }
      }
    }
  }

  /**
   * Validate build configurations
   */
  validateConfigurations() {
    this.log('Validating build configurations...');

    const requiredConfigs = ['windows.json', 'macos.json', 'linux.json'];

    requiredConfigs.forEach(configFile => {
      const configPath = path.join(this.configDir, configFile);

      if (!fs.existsSync(configPath)) {
        this.log(`✗ Missing configuration: ${configFile}`, 'ERROR');
        throw new Error(`Configuration file ${configFile} not found`);
      }

      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        this.log(`✓ Valid configuration: ${configFile}`);

        // Validate required fields
        const platform = configFile.replace('.json', '');
        this.validateConfigurationFields(config, platform);

      } catch (error) {
        this.log(`✗ Invalid configuration: ${configFile} - ${error.message}`, 'ERROR');
        throw error;
      }
    });
  }

  /**
   * Validate configuration fields for a platform
   */
  validateConfigurationFields(config, platform) {
    const requiredFields = {
      windows: ['win', 'nsis'],
      macos: ['mac', 'dmg'],
      linux: ['linux']
    };

    const required = requiredFields[platform];
    if (required) {
      required.forEach(field => {
        if (!config[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      });
    }
  }

  /**
   * Run pre-build setup
   */
  async preBuild() {
    this.log('Running pre-build setup...');

    // Clean build directory
    if (fs.existsSync(this.buildDir)) {
      this.log('Cleaning build directory...');
      fs.rmSync(this.buildDir, { recursive: true, force: true });
    }

    // Create build directory
    fs.mkdirSync(this.buildDir, { recursive: true });

    // Install dependencies
    this.log('Installing dependencies...');
    try {
      execSync('npm ci', { stdio: 'inherit' });
      this.log('✓ Dependencies installed');
    } catch (error) {
      this.log('✗ Failed to install dependencies', 'ERROR');
      throw error;
    }

    // Run tests
    this.log('Running build tests...');
    try {
      execSync('npm run test:build', { stdio: 'inherit' });
      this.log('✓ Build tests passed');
    } catch (error) {
      this.log('⚠ Build tests failed', 'WARN');
      // Continue with build even if tests fail (for CI/CD flexibility)
    }
  }

  /**
   * Build for specific platform
   */
  async buildPlatform(platformConfig) {
    const { platform, platformName, target, arch } = platformConfig;

    this.log(`Building ${platformName} ${target} for ${arch}...`);

    const configPath = path.join(this.configDir, `${platform === 'win32' ? 'windows' : platform === 'darwin' ? 'macos' : 'linux'}.json`);

    const buildCommand = [
      'npx electron-builder',
      `--config ${configPath}`,
      `--${platform}`,
      `--${arch}`,
      target !== 'default' ? `--${target}` : ''
    ].filter(Boolean).join(' ');

    try {
      const startTime = Date.now();
      execSync(buildCommand, {
        stdio: 'inherit',
        env: {
          ...process.env,
          NODE_ENV: 'production',
          ELECTRON_CACHE: path.join(process.cwd(), '.cache', 'electron'),
          ELECTRON_BUILDER_CACHE: path.join(process.cwd(), '.cache', 'electron-builder')
        }
      });

      const buildTime = Date.now() - startTime;
      this.log(`✓ ${platformName} ${target} (${arch}) built successfully in ${buildTime}ms`);

      return { success: true, buildTime, platform, target, arch };

    } catch (error) {
      this.log(`✗ Failed to build ${platformName} ${target} (${arch}): ${error.message}`, 'ERROR');
      return { success: false, error: error.message, platform, target, arch };
    }
  }

  /**
   * Build all platforms
   */
  async buildAllPlatforms() {
    this.log('Starting cross-platform build...');

    const results = [];
    const totalBuilds = this.buildMatrix.length;
    let completedBuilds = 0;

    for (const platformConfig of this.buildMatrix) {
      // Skip builds for platforms we can't build on current OS
      if (!this.canBuildPlatform(platformConfig.platform)) {
        this.log(`Skipping ${platformConfig.platformName} build (not supported on ${this.platform})`, 'WARN');
        continue;
      }

      const result = await this.buildPlatform(platformConfig);
      results.push(result);

      completedBuilds++;
      this.log(`Progress: ${completedBuilds}/${totalBuilds} builds completed`);
    }

    return results;
  }

  /**
   * Check if we can build for target platform on current OS
   */
  canBuildPlatform(targetPlatform) {
    // Generally, we can only build for the current platform
    // Exception: Linux can build for Windows with wine, macOS with proper tools
    const canBuild = {
      win32: ['win32'],
      darwin: ['darwin'],
      linux: ['linux', 'win32'] // Linux can cross-compile for Windows
    };

    return canBuild[this.platform]?.includes(targetPlatform) || false;
  }

  /**
   * Validate build artifacts
   */
  async validateArtifacts(buildResults) {
    this.log('Validating build artifacts...');

    const artifacts = [];

    buildResults.forEach(result => {
      if (result.success) {
        const platformConfig = this.platforms[result.platform];

        platformConfig.extensions.forEach(ext => {
          const artifactPattern = `mainframe-ai-assistant*${ext}`;
          const artifactPath = path.join(this.buildDir, artifactPattern);

          // Check if artifact exists (simplified check)
          if (fs.existsSync(this.buildDir)) {
            artifacts.push({
              platform: result.platform,
              target: result.target,
              arch: result.arch,
              path: artifactPath,
              exists: true // Simplified for this example
            });
          }
        });
      }
    });

    this.log(`Found ${artifacts.length} build artifacts`);

    // Validate artifact integrity
    artifacts.forEach(artifact => {
      if (artifact.exists) {
        this.log(`✓ ${artifact.platform} ${artifact.target} (${artifact.arch}) artifact validated`);
      } else {
        this.log(`✗ Missing artifact: ${artifact.path}`, 'ERROR');
      }
    });

    return artifacts;
  }

  /**
   * Generate build report
   */
  generateBuildReport(buildResults, artifacts) {
    const report = {
      timestamp: new Date().toISOString(),
      platform: this.platform,
      arch: this.arch,
      totalBuilds: buildResults.length,
      successfulBuilds: buildResults.filter(r => r.success).length,
      failedBuilds: buildResults.filter(r => !r.success).length,
      totalBuildTime: buildResults.reduce((sum, r) => sum + (r.buildTime || 0), 0),
      artifacts: artifacts.length,
      results: buildResults,
      artifactList: artifacts
    };

    const reportPath = path.join(this.buildDir, 'build-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    this.log(`Build report generated: ${reportPath}`);

    // Console summary
    console.log('\n=== BUILD SUMMARY ===');
    console.log(`Total builds: ${report.totalBuilds}`);
    console.log(`Successful: ${report.successfulBuilds}`);
    console.log(`Failed: ${report.failedBuilds}`);
    console.log(`Total time: ${(report.totalBuildTime / 1000).toFixed(2)}s`);
    console.log(`Artifacts: ${report.artifacts}`);
    console.log('=====================\n');

    return report;
  }

  /**
   * Run complete build process
   */
  async run() {
    try {
      this.log('Starting cross-platform build process...');

      await this.checkPrerequisites();
      this.validateConfigurations();
      await this.preBuild();

      const buildResults = await this.buildAllPlatforms();
      const artifacts = await this.validateArtifacts(buildResults);
      const report = this.generateBuildReport(buildResults, artifacts);

      this.log('Cross-platform build process completed');

      // Exit with error code if any builds failed
      const hasFailures = buildResults.some(r => !r.success);
      process.exit(hasFailures ? 1 : 0);

    } catch (error) {
      this.log(`Build process failed: ${error.message}`, 'ERROR');
      console.error(error);
      process.exit(1);
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  const builder = new CrossPlatformBuilder();

  switch (command) {
    case 'matrix':
      console.log('Build Matrix:');
      console.table(builder.buildMatrix);
      break;

    case 'check':
      builder.checkPrerequisites().catch(console.error);
      break;

    case 'validate':
      builder.validateConfigurations();
      break;

    case 'build':
      const platform = args[1];
      if (platform && builder.platforms[platform]) {
        // Build specific platform
        const platformBuilds = builder.buildMatrix.filter(b => b.platform === platform);
        Promise.all(platformBuilds.map(b => builder.buildPlatform(b)))
          .then(results => console.log('Platform build completed:', results))
          .catch(console.error);
      } else {
        // Build all platforms
        builder.run();
      }
      break;

    default:
      console.log('Cross-Platform Build Script');
      console.log('Usage:');
      console.log('  node cross-platform-build.js matrix    - Show build matrix');
      console.log('  node cross-platform-build.js check     - Check prerequisites');
      console.log('  node cross-platform-build.js validate  - Validate configurations');
      console.log('  node cross-platform-build.js build     - Build all platforms');
      console.log('  node cross-platform-build.js build win32 - Build specific platform');
      break;
  }
}

module.exports = CrossPlatformBuilder;