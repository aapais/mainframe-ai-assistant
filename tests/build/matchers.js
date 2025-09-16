/**
 * Custom Jest matchers for cross-platform build testing
 */

expect.extend({
  /**
   * Check if a platform-specific file exists
   */
  toHavePlatformFile(received, platform, filename) {
    const platforms = {
      windows: ['exe', 'msi'],
      macos: ['dmg', 'pkg', 'app'],
      linux: ['AppImage', 'deb', 'rpm', 'snap']
    };

    const extensions = platforms[platform] || [];
    const hasFile = extensions.some(ext => {
      const expectedFile = filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`;
      return received.includes(expectedFile);
    });

    return {
      message: () => `expected ${received} to contain ${platform} file matching ${filename}`,
      pass: hasFile
    };
  },

  /**
   * Check if build artifacts match expected architecture
   */
  toSupportArchitecture(received, arch) {
    const supportedArchs = ['x64', 'arm64', 'armv7l', 'ia32', 'universal'];
    const isSupported = supportedArchs.includes(arch);

    return {
      message: () => `expected architecture ${arch} to be supported`,
      pass: isSupported && received.includes(arch)
    };
  },

  /**
   * Validate electron-builder configuration
   */
  toBeValidElectronConfig(received) {
    const requiredFields = ['productName', 'appId', 'directories'];
    const missingFields = requiredFields.filter(field => !received[field]);

    return {
      message: () => `expected configuration to have required fields: ${missingFields.join(', ')}`,
      pass: missingFields.length === 0
    };
  },

  /**
   * Check if file size is within acceptable range
   */
  toBeWithinSizeLimit(received, maxSizeMB) {
    const sizeMB = received / (1024 * 1024);
    const withinLimit = sizeMB <= maxSizeMB;

    return {
      message: () => `expected file size ${sizeMB.toFixed(2)}MB to be within limit of ${maxSizeMB}MB`,
      pass: withinLimit
    };
  },

  /**
   * Validate code signing information
   */
  toBeCodeSigned(received, platform) {
    const signingIndicators = {
      windows: ['Authenticode', 'SHA256'],
      macos: ['Developer ID', 'Apple'],
      linux: ['GPG', 'Package']
    };

    const indicators = signingIndicators[platform] || [];
    const isSigned = indicators.some(indicator =>
      received.toLowerCase().includes(indicator.toLowerCase())
    );

    return {
      message: () => `expected ${received} to show ${platform} code signing`,
      pass: isSigned
    };
  },

  /**
   * Check performance metrics
   */
  toMeetPerformanceTarget(received, target, metric) {
    let passes = false;
    let message = '';

    switch (metric) {
      case 'startup':
        passes = received <= target;
        message = `expected startup time ${received}ms to be <= ${target}ms`;
        break;
      case 'memory':
        passes = received <= target;
        message = `expected memory usage ${received}MB to be <= ${target}MB`;
        break;
      case 'size':
        passes = received <= target;
        message = `expected package size ${received}MB to be <= ${target}MB`;
        break;
      default:
        message = `unknown performance metric: ${metric}`;
    }

    return {
      message: () => message,
      pass: passes
    };
  },

  /**
   * Validate installer capabilities
   */
  toSupportInstallerFeature(received, feature) {
    const supportedFeatures = {
      windows: ['desktop-shortcut', 'start-menu', 'auto-start', 'uninstaller'],
      macos: ['applications-folder', 'dock-integration', 'spotlight'],
      linux: ['desktop-entry', 'system-tray', 'auto-start', 'mime-types']
    };

    const allFeatures = Object.values(supportedFeatures).flat();
    const isValidFeature = allFeatures.includes(feature);
    const isSupported = received.features && received.features.includes(feature);

    return {
      message: () => `expected installer to support feature: ${feature}`,
      pass: isValidFeature && isSupported
    };
  },

  /**
   * Check cross-platform path handling
   */
  toHandleCrossPlatformPaths(received) {
    const hasValidPaths = received.every(filePath => {
      // Check for proper path separators and no invalid characters
      const isValid = !filePath.includes('\\\\') &&
                     !filePath.includes('//') &&
                     !filePath.includes('<') &&
                     !filePath.includes('>') &&
                     !filePath.includes('|');
      return isValid;
    });

    return {
      message: () => `expected paths to be cross-platform compatible`,
      pass: hasValidPaths
    };
  }
});

module.exports = {};