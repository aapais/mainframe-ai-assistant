#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

/**
 * Deployment Test Suite Validator
 * Validates that all deployment testing components are correctly installed and functional
 */
class DeploymentSuiteValidator {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.results = {
      overall: false,
      components: {},
      tests: {},
      scripts: {},
      recommendations: []
    };
  }

  /**
   * Validate complete deployment test suite
   */
  async validateSuite() {
    console.log('🔍 Validating Deployment Package Integrity Test Suite...\n');

    // Check component files
    await this.validateComponents();

    // Check test files
    await this.validateTests();

    // Check script files
    await this.validateScripts();

    // Validate package.json configuration
    await this.validatePackageConfig();

    // Run basic functionality tests
    await this.runFunctionalityTests();

    // Generate final assessment
    this.generateAssessment();

    return this.results;
  }

  /**
   * Validate all test components exist and are properly structured
   */
  async validateComponents() {
    console.log('📁 Validating test components...');

    const components = [
      {
        name: 'Package Integrity Tests',
        path: 'tests/deployment/package-integrity.test.ts',
        required: true
      },
      {
        name: 'Installer Validation Tests',
        path: 'tests/deployment/installer-validation.test.ts',
        required: true
      },
      {
        name: 'Update Mechanism Tests',
        path: 'tests/deployment/update-mechanism.test.ts',
        required: true
      },
      {
        name: 'Auto-Updater Tests',
        path: 'tests/deployment/auto-updater.test.ts',
        required: true
      },
      {
        name: 'Integration Tests',
        path: 'tests/deployment/integration.test.ts',
        required: true
      },
      {
        name: 'Jest Configuration',
        path: 'tests/deployment/jest.config.js',
        required: true
      },
      {
        name: 'Jest Setup',
        path: 'tests/deployment/jest.setup.js',
        required: true
      },
      {
        name: 'Documentation',
        path: 'tests/deployment/README.md',
        required: false
      }
    ];

    for (const component of components) {
      const fullPath = path.join(this.projectRoot, component.path);
      const exists = fs.existsSync(fullPath);

      this.results.components[component.name] = {
        exists,
        path: component.path,
        required: component.required,
        size: exists ? fs.statSync(fullPath).size : 0
      };

      const status = exists ? '✅' : (component.required ? '❌' : '⚠️');
      console.log(`  ${status} ${component.name} (${component.path})`);

      if (component.required && !exists) {
        this.results.recommendations.push(`Missing required component: ${component.name}`);
      }
    }

    console.log('');
  }

  /**
   * Validate script files
   */
  async validateScripts() {
    console.log('📜 Validating deployment scripts...');

    const scripts = [
      {
        name: 'Package Validator',
        path: 'scripts/validate-deployment.js',
        executable: true
      },
      {
        name: 'Checksum Generator',
        path: 'scripts/checksum-generator.js',
        executable: true
      },
      {
        name: 'Security Verification',
        path: 'scripts/security-verification.js',
        executable: true
      },
      {
        name: 'Deployment Monitoring',
        path: 'scripts/deployment-monitoring.js',
        executable: true
      },
      {
        name: 'Auto-Updater Service',
        path: 'scripts/auto-updater-service.js',
        executable: false
      }
    ];

    for (const script of scripts) {
      const fullPath = path.join(this.projectRoot, script.path);
      const exists = fs.existsSync(fullPath);

      let executable = false;
      if (exists && script.executable) {
        try {
          const stats = fs.statSync(fullPath);
          // On Unix systems, check if executable bit is set
          executable = process.platform === 'win32' || (stats.mode & parseInt('111', 8)) !== 0;
        } catch (error) {
          executable = false;
        }
      }

      this.results.scripts[script.name] = {
        exists,
        executable: script.executable ? executable : 'N/A',
        path: script.path,
        size: exists ? fs.statSync(fullPath).size : 0
      };

      const status = exists ? (script.executable && !executable ? '⚠️' : '✅') : '❌';
      console.log(`  ${status} ${script.name} (${script.path})`);

      if (!exists) {
        this.results.recommendations.push(`Missing script: ${script.name}`);
      } else if (script.executable && !executable) {
        this.results.recommendations.push(`Script not executable: ${script.name}`);
      }
    }

    console.log('');
  }

  /**
   * Validate test files syntax and structure
   */
  async validateTests() {
    console.log('🧪 Validating test file structure...');

    const testFiles = [
      'tests/deployment/package-integrity.test.ts',
      'tests/deployment/installer-validation.test.ts',
      'tests/deployment/update-mechanism.test.ts',
      'tests/deployment/auto-updater.test.ts',
      'tests/deployment/integration.test.ts'
    ];

    for (const testFile of testFiles) {
      const fullPath = path.join(this.projectRoot, testFile);
      const testName = path.basename(testFile, '.test.ts');

      if (!fs.existsSync(fullPath)) {
        this.results.tests[testName] = { valid: false, error: 'File not found' };
        console.log(`  ❌ ${testName}: File not found`);
        continue;
      }

      try {
        const content = fs.readFileSync(fullPath, 'utf8');

        // Basic validation checks
        const hasDescribe = content.includes('describe(');
        const hasTest = content.includes('test(') || content.includes('it(');
        const hasImports = content.includes('import');
        const hasExports = content.includes('export') || content.includes('module.exports');

        const validation = {
          valid: hasDescribe && hasTest,
          hasDescribe,
          hasTest,
          hasImports,
          hasExports,
          lineCount: content.split('\n').length,
          size: content.length
        };

        this.results.tests[testName] = validation;

        const status = validation.valid ? '✅' : '⚠️';
        console.log(`  ${status} ${testName}: ${validation.lineCount} lines, ${Math.round(validation.size / 1024)}KB`);

        if (!validation.valid) {
          this.results.recommendations.push(`Test file structure issues in ${testName}`);
        }

      } catch (error) {
        this.results.tests[testName] = { valid: false, error: error.message };
        console.log(`  ❌ ${testName}: ${error.message}`);
      }
    }

    console.log('');
  }

  /**
   * Validate package.json configuration
   */
  async validatePackageConfig() {
    console.log('📦 Validating package.json configuration...');

    const packageJsonPath = path.join(this.projectRoot, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      console.log('  ❌ package.json not found');
      this.results.recommendations.push('Missing package.json file');
      return;
    }

    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      // Check for deployment-related scripts
      const requiredScripts = [
        'test:deployment',
        'test:deployment:coverage',
        'validate:deployment',
        'generate:checksums',
        'scan:security',
        'monitor:deployment'
      ];

      const hasAllScripts = requiredScripts.every(script => packageJson.scripts && packageJson.scripts[script]);

      console.log(`  ${hasAllScripts ? '✅' : '⚠️'} Deployment scripts configured`);

      // Check for required dependencies
      const testDependencies = ['jest', 'ts-jest', '@types/jest'];
      const hasTestDeps = testDependencies.every(dep =>
        (packageJson.dependencies && packageJson.dependencies[dep]) ||
        (packageJson.devDependencies && packageJson.devDependencies[dep])
      );

      console.log(`  ${hasTestDeps ? '✅' : '⚠️'} Test dependencies available`);

      if (!hasAllScripts) {
        this.results.recommendations.push('Missing deployment-related npm scripts');
      }

      if (!hasTestDeps) {
        this.results.recommendations.push('Missing required test dependencies');
      }

    } catch (error) {
      console.log(`  ❌ Error parsing package.json: ${error.message}`);
      this.results.recommendations.push('Invalid package.json format');
    }

    console.log('');
  }

  /**
   * Run basic functionality tests
   */
  async runFunctionalityTests() {
    console.log('🔬 Running basic functionality tests...');

    const functionalityTests = [
      {
        name: 'Package Validator Import',
        test: async () => {
          try {
            const validatorPath = path.join(this.projectRoot, 'scripts/validate-deployment.js');
            if (fs.existsSync(validatorPath)) {
              require(validatorPath);
              return { success: true };
            }
            return { success: false, error: 'File not found' };
          } catch (error) {
            return { success: false, error: error.message };
          }
        }
      },
      {
        name: 'Checksum Generator Import',
        test: async () => {
          try {
            const generatorPath = path.join(this.projectRoot, 'scripts/checksum-generator.js');
            if (fs.existsSync(generatorPath)) {
              require(generatorPath);
              return { success: true };
            }
            return { success: false, error: 'File not found' };
          } catch (error) {
            return { success: false, error: error.message };
          }
        }
      },
      {
        name: 'Test Configuration Validation',
        test: async () => {
          try {
            const configPath = path.join(this.projectRoot, 'tests/deployment/jest.config.js');
            if (fs.existsSync(configPath)) {
              const config = require(configPath);
              const hasRequiredFields = config.testEnvironment && config.testMatch;
              return { success: hasRequiredFields };
            }
            return { success: false, error: 'Config file not found' };
          } catch (error) {
            return { success: false, error: error.message };
          }
        }
      }
    ];

    for (const test of functionalityTests) {
      try {
        const result = await test.test();
        const status = result.success ? '✅' : '❌';
        console.log(`  ${status} ${test.name}`);

        if (!result.success && result.error) {
          console.log(`      Error: ${result.error}`);
          this.results.recommendations.push(`Fix functionality issue: ${test.name}`);
        }
      } catch (error) {
        console.log(`  ❌ ${test.name}: ${error.message}`);
        this.results.recommendations.push(`Fix functionality issue: ${test.name}`);
      }
    }

    console.log('');
  }

  /**
   * Generate final assessment
   */
  generateAssessment() {
    console.log('📊 Final Assessment');
    console.log('==================');

    // Count successful validations
    const componentsPassed = Object.values(this.results.components).filter(c => c.exists).length;
    const componentsTotal = Object.keys(this.results.components).length;

    const scriptsPassed = Object.values(this.results.scripts).filter(s => s.exists).length;
    const scriptsTotal = Object.keys(this.results.scripts).length;

    const testsPassed = Object.values(this.results.tests).filter(t => t.valid).length;
    const testsTotal = Object.keys(this.results.tests).length;

    console.log(`Components: ${componentsPassed}/${componentsTotal} ✅`);
    console.log(`Scripts: ${scriptsPassed}/${scriptsTotal} ✅`);
    console.log(`Tests: ${testsPassed}/${testsTotal} ✅`);

    // Overall assessment
    const overallScore = (componentsPassed + scriptsPassed + testsPassed) / (componentsTotal + scriptsTotal + testsTotal);
    this.results.overall = overallScore >= 0.9; // 90% threshold

    console.log(`\nOverall Score: ${Math.round(overallScore * 100)}%`);
    console.log(`Status: ${this.results.overall ? '🎉 READY FOR DEPLOYMENT TESTING' : '⚠️ NEEDS ATTENTION'}`);

    if (this.results.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      this.results.recommendations.forEach(rec => {
        console.log(`  • ${rec}`);
      });
    }

    console.log('\n🚀 Next Steps:');
    console.log('  1. Run: npm run test:deployment');
    console.log('  2. Run: npm run test:deployment:coverage');
    console.log('  3. Run: npm run validate:deployment');
    console.log('  4. Run: npm run ci:deployment');

    console.log('\n📚 Documentation:');
    console.log('  • View: tests/deployment/README.md');
    console.log('  • CLI Help: node scripts/validate-deployment.js --help');
    console.log('  • Security Scan: node scripts/security-verification.js --help');

    return this.results;
  }
}

// CLI interface
if (require.main === module) {
  const validator = new DeploymentSuiteValidator();

  validator.validateSuite()
    .then(results => {
      const exitCode = results.overall ? 0 : 1;
      process.exit(exitCode);
    })
    .catch(error => {
      console.error('❌ Validation failed:', error.message);
      process.exit(1);
    });
}

module.exports = { DeploymentSuiteValidator };