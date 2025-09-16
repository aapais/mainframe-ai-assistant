#!/usr/bin/env node
/**
 * Accenture Mainframe AI Assistant - Build Setup Validator
 * This script validates that all files and configurations are ready for building
 */

const fs = require('fs');
const path = require('path');

class BuildValidator {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.successes = [];
    }

    error(message) {
        this.errors.push(message);
        console.log(`❌ ERROR: ${message}`);
    }

    warning(message) {
        this.warnings.push(message);
        console.log(`⚠️  WARNING: ${message}`);
    }

    success(message) {
        this.successes.push(message);
        console.log(`✅ ${message}`);
    }

    info(message) {
        console.log(`ℹ️  ${message}`);
    }

    checkFileExists(filePath, description, required = true) {
        if (fs.existsSync(filePath)) {
            this.success(`${description} exists: ${filePath}`);
            return true;
        } else {
            if (required) {
                this.error(`${description} missing: ${filePath}`);
            } else {
                this.warning(`${description} missing (optional): ${filePath}`);
            }
            return false;
        }
    }

    checkFileSize(filePath, maxSizeKB, description) {
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            const sizeKB = stats.size / 1024;
            if (sizeKB > maxSizeKB) {
                this.warning(`${description} is large (${sizeKB.toFixed(2)} KB): ${filePath}`);
            } else {
                this.success(`${description} size OK (${sizeKB.toFixed(2)} KB): ${filePath}`);
            }
        }
    }

    checkJSONFile(filePath, description) {
        if (this.checkFileExists(filePath, description)) {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                JSON.parse(content);
                this.success(`${description} is valid JSON`);
                return true;
            } catch (error) {
                this.error(`${description} has invalid JSON: ${error.message}`);
                return false;
            }
        }
        return false;
    }

    validatePackageJson() {
        console.log('\n📦 Validating package.json...');

        if (this.checkJSONFile('package.json', 'package.json')) {
            const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

            // Check required fields
            const requiredFields = ['name', 'version', 'description', 'main', 'author'];
            requiredFields.forEach(field => {
                if (pkg[field]) {
                    this.success(`package.json has ${field}: ${pkg[field]}`);
                } else {
                    this.error(`package.json missing required field: ${field}`);
                }
            });

            // Check main file path
            if (pkg.main && pkg.main.includes('main.js')) {
                this.success('package.json main points to correct file');
            } else {
                this.warning('package.json main should point to src/main/main.js');
            }

            // Check build configuration
            if (pkg.build) {
                this.success('package.json has build configuration');

                if (pkg.build.appId) {
                    this.success(`App ID configured: ${pkg.build.appId}`);
                } else {
                    this.error('package.json build.appId is missing');
                }

                if (pkg.build.productName) {
                    this.success(`Product name: ${pkg.build.productName}`);
                } else {
                    this.error('package.json build.productName is missing');
                }
            } else {
                this.error('package.json missing build configuration');
            }

            // Check scripts
            const requiredScripts = ['package:win', 'installer:win', 'build:icons'];
            requiredScripts.forEach(script => {
                if (pkg.scripts && pkg.scripts[script]) {
                    this.success(`Script available: ${script}`);
                } else {
                    this.warning(`Script missing: ${script}`);
                }
            });
        }
    }

    validateElectronFiles() {
        console.log('\n⚡ Validating Electron files...');

        // Check main process files
        this.checkFileExists('src/main/main.js', 'Main Electron process');
        this.checkFileExists('src/main/preload.js', 'Preload script');

        // Check application files
        this.checkFileExists('index.html', 'Main HTML file');
        this.checkFileExists('app.js', 'Application JavaScript');

        // Validate main.js content
        if (fs.existsSync('src/main/main.js')) {
            const mainContent = fs.readFileSync('src/main/main.js', 'utf8');

            if (mainContent.includes('BrowserWindow')) {
                this.success('main.js creates BrowserWindow');
            } else {
                this.error('main.js missing BrowserWindow creation');
            }

            if (mainContent.includes('preload.js')) {
                this.success('main.js references preload script');
            } else {
                this.warning('main.js should reference preload script for security');
            }

            if (mainContent.includes('nodeIntegration: false')) {
                this.success('main.js has secure nodeIntegration setting');
            } else {
                this.warning('main.js should disable nodeIntegration for security');
            }
        }
    }

    validateBuildAssets() {
        console.log('\n🎨 Validating build assets...');

        // Check build directory
        if (!fs.existsSync('build')) {
            this.error('build/ directory missing - run npm run build:icons');
            return;
        }

        // Check icons
        this.checkFileExists('build/icon.ico', 'Windows icon file');
        this.checkFileExists('build/icon.png', 'PNG icon file');
        this.checkFileExists('build/icon.svg', 'SVG icon source', false);

        // Check installer assets
        this.checkFileExists('build/license.txt', 'License file');
        this.checkFileExists('build/installer.nsh', 'NSIS installer script');

        // Check icon file sizes
        this.checkFileSize('build/icon.ico', 500, 'Windows icon');
        this.checkFileSize('build/icon.png', 200, 'PNG icon');
    }

    validateBuildConfiguration() {
        console.log('\n⚙️ Validating build configuration...');

        // Check electron-builder config
        if (this.checkFileExists('electron-builder.yml', 'Electron builder config', false)) {
            // Could validate YAML syntax here if needed
            this.success('electron-builder.yml configuration exists');
        }

        // Check build scripts
        this.checkFileExists('build-windows-installer.ps1', 'PowerShell build script');
        this.checkFileExists('build-installer.cmd', 'Batch build script');
        this.checkFileExists('scripts/create-icons.js', 'Icon creation script');
    }

    validateDependencies() {
        console.log('\n📚 Validating dependencies...');

        if (fs.existsSync('node_modules')) {
            this.success('node_modules directory exists');

            // Check for key dependencies
            const requiredDeps = [
                'electron',
                'electron-builder'
            ];

            requiredDeps.forEach(dep => {
                if (fs.existsSync(`node_modules/${dep}`)) {
                    this.success(`Dependency installed: ${dep}`);
                } else {
                    this.error(`Dependency missing: ${dep} - run npm install`);
                }
            });
        } else {
            this.error('node_modules missing - run npm install');
        }
    }

    validateSystemRequirements() {
        console.log('\n🖥️ Validating system requirements...');

        // Check Node.js (this script running means Node.js works)
        this.success('Node.js is available');

        // Check npm
        try {
            const { execSync } = require('child_process');
            const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
            this.success(`npm is available: v${npmVersion}`);
        } catch (error) {
            this.error('npm is not available');
        }

        // Check platform
        if (process.platform === 'win32') {
            this.success('Running on Windows (required for Windows builds)');
        } else {
            this.warning(`Running on ${process.platform} - Windows required for Windows builds`);
        }
    }

    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📋 VALIDATION REPORT');
        console.log('='.repeat(60));

        console.log(`\n✅ Successes: ${this.successes.length}`);
        console.log(`⚠️  Warnings: ${this.warnings.length}`);
        console.log(`❌ Errors: ${this.errors.length}`);

        if (this.warnings.length > 0) {
            console.log('\n⚠️  WARNINGS:');
            this.warnings.forEach(warning => console.log(`   • ${warning}`));
        }

        if (this.errors.length > 0) {
            console.log('\n❌ ERRORS:');
            this.errors.forEach(error => console.log(`   • ${error}`));
        }

        console.log('\n📊 READINESS ASSESSMENT:');

        if (this.errors.length === 0) {
            console.log('🎉 BUILD READY: All checks passed! You can build the Windows installer.');

            if (this.warnings.length > 0) {
                console.log('💡 Consider addressing warnings for optimal build quality.');
            }

            console.log('\n🚀 Next steps:');
            console.log('   1. Run: .\\build-windows-installer.ps1');
            console.log('   2. Or run: build-installer.cmd');
            console.log('   3. Find installer in: dist-installer\\Accenture-Mainframe-AI-Setup.exe');

            return true;
        } else {
            console.log('🚫 BUILD NOT READY: Please fix the errors above before building.');

            console.log('\n🔧 Common fixes:');
            console.log('   • Run: npm install (for dependency errors)');
            console.log('   • Run: npm run build:icons (for icon errors)');
            console.log('   • Check file paths and spellings');

            return false;
        }
    }

    run() {
        console.log('🔍 Accenture Mainframe AI Assistant - Build Setup Validator');
        console.log('Checking if everything is ready for Windows installer build...\n');

        this.validateSystemRequirements();
        this.validatePackageJson();
        this.validateElectronFiles();
        this.validateBuildAssets();
        this.validateBuildConfiguration();
        this.validateDependencies();

        const ready = this.generateReport();

        process.exit(ready ? 0 : 1);
    }
}

// Run validation if called directly
if (require.main === module) {
    const validator = new BuildValidator();
    validator.run();
}

module.exports = BuildValidator;