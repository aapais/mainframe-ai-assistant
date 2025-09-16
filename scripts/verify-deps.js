#!/usr/bin/env node

/**
 * Dependency Verification Script
 * Comprehensive verification of all project dependencies
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class DependencyVerifier {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.success = [];
        this.packageJson = null;
        this.nodeModulesPath = path.join(process.cwd(), 'node_modules');
    }

    log(level, message) {
        const timestamp = new Date().toISOString();
        const prefix = {
            'ERROR': '❌',
            'WARN': '⚠️',
            'SUCCESS': '✅',
            'INFO': 'ℹ️'
        }[level] || 'ℹ️';

        console.log(`${prefix} [${timestamp}] ${message}`);
    }

    async loadPackageJson() {
        try {
            const packagePath = path.join(process.cwd(), 'package.json');
            this.packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            this.log('SUCCESS', 'package.json loaded successfully');
        } catch (error) {
            this.errors.push('Failed to load package.json');
            this.log('ERROR', `Failed to load package.json: ${error.message}`);
        }
    }

    async checkNodeModulesExists() {
        if (!fs.existsSync(this.nodeModulesPath)) {
            this.errors.push('node_modules directory does not exist');
            this.log('ERROR', 'node_modules directory not found');
            return false;
        }
        this.log('SUCCESS', 'node_modules directory exists');
        return true;
    }

    async checkPackageLock() {
        const lockPath = path.join(process.cwd(), 'package-lock.json');
        if (fs.existsSync(lockPath)) {
            this.log('SUCCESS', 'package-lock.json exists');

            // Check if lock file is valid JSON
            try {
                const lockData = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
                if (lockData.lockfileVersion) {
                    this.log('SUCCESS', `package-lock.json version: ${lockData.lockfileVersion}`);
                }
            } catch (error) {
                this.errors.push('package-lock.json is corrupted');
                this.log('ERROR', 'package-lock.json is not valid JSON');
            }
        } else {
            this.warnings.push('package-lock.json not found');
            this.log('WARN', 'package-lock.json not found - this may cause version inconsistencies');
        }
    }

    async verifyDependency(name, version, type = 'dependency') {
        const depPath = path.join(this.nodeModulesPath, name);

        if (!fs.existsSync(depPath)) {
            this.errors.push(`${type}: ${name} not installed`);
            this.log('ERROR', `${name} directory not found in node_modules`);
            return false;
        }

        // Check package.json in dependency
        const depPackagePath = path.join(depPath, 'package.json');
        if (fs.existsSync(depPackagePath)) {
            try {
                const depPackage = JSON.parse(fs.readFileSync(depPackagePath, 'utf8'));
                this.log('SUCCESS', `${name}@${depPackage.version} installed`);

                // Check for native modules
                if (fs.existsSync(path.join(depPath, 'binding.gyp')) ||
                    fs.existsSync(path.join(depPath, 'build'))) {
                    this.log('INFO', `${name} is a native module`);
                }

                return true;
            } catch (error) {
                this.warnings.push(`${name} package.json is corrupted`);
                this.log('WARN', `${name} package.json cannot be read`);
                return false;
            }
        } else {
            this.warnings.push(`${name} package.json missing`);
            this.log('WARN', `${name} package.json not found`);
            return false;
        }
    }

    async checkBinaries() {
        const binPath = path.join(this.nodeModulesPath, '.bin');
        if (!fs.existsSync(binPath)) {
            this.warnings.push('No .bin directory found');
            this.log('WARN', 'No .bin directory in node_modules');
            return;
        }

        const binaries = fs.readdirSync(binPath);
        this.log('SUCCESS', `Found ${binaries.length} binaries in .bin`);

        // Check critical binaries
        const criticalBinaries = ['tsc', 'vite', 'jest', 'electron', 'eslint'];
        for (const binary of criticalBinaries) {
            if (binaries.includes(binary)) {
                this.log('SUCCESS', `Binary: ${binary} ✓`);
            } else {
                this.warnings.push(`Missing binary: ${binary}`);
                this.log('WARN', `Binary missing: ${binary}`);
            }
        }
    }

    async checkTypeScriptTypes() {
        const typesPath = path.join(this.nodeModulesPath, '@types');
        if (!fs.existsSync(typesPath)) {
            this.warnings.push('No @types directory found');
            this.log('WARN', 'No @types directory found');
            return;
        }

        const types = fs.readdirSync(typesPath);
        this.log('SUCCESS', `Found ${types.length} TypeScript type packages`);

        // Check critical types
        const criticalTypes = ['node', 'react', 'react-dom', 'jest'];
        for (const type of criticalTypes) {
            if (types.includes(type)) {
                this.log('SUCCESS', `Types: @types/${type} ✓`);
            } else {
                this.warnings.push(`Missing types: @types/${type}`);
                this.log('WARN', `Types missing: @types/${type}`);
            }
        }
    }

    async testImports() {
        const testImports = [
            { name: 'react', test: 'require("react")' },
            { name: 'typescript', test: 'require("typescript")' },
            { name: 'electron', test: 'require("electron")' },
            { name: 'jest', test: 'require("jest")' },
            { name: 'vite', test: 'require("vite")' }
        ];

        for (const { name, test } of testImports) {
            try {
                eval(test);
                this.log('SUCCESS', `Import test: ${name} ✓`);
            } catch (error) {
                this.errors.push(`Cannot import ${name}: ${error.message}`);
                this.log('ERROR', `Import failed: ${name} - ${error.message}`);
            }
        }
    }

    async checkNpmLs() {
        try {
            const output = execSync('npm ls --depth=0 --json', { encoding: 'utf8' });
            const npmLs = JSON.parse(output);

            if (npmLs.problems && npmLs.problems.length > 0) {
                this.warnings.push(`npm ls found ${npmLs.problems.length} problems`);
                this.log('WARN', `npm ls found problems: ${npmLs.problems.length}`);

                // Log first 5 problems
                npmLs.problems.slice(0, 5).forEach(problem => {
                    this.log('WARN', `  - ${problem}`);
                });
            } else {
                this.log('SUCCESS', 'npm ls shows no dependency problems');
            }
        } catch (error) {
            this.errors.push('npm ls command failed');
            this.log('ERROR', 'npm ls command failed - this indicates serious dependency issues');
        }
    }

    async checkDiskSpace() {
        try {
            const stats = fs.statSync(this.nodeModulesPath);
            const sizeOutput = execSync(`du -sh "${this.nodeModulesPath}"`, { encoding: 'utf8' });
            const size = sizeOutput.split('\t')[0];
            this.log('INFO', `node_modules size: ${size}`);

            // Count packages
            const packages = fs.readdirSync(this.nodeModulesPath).filter(dir =>
                !dir.startsWith('.') && fs.statSync(path.join(this.nodeModulesPath, dir)).isDirectory()
            );
            this.log('INFO', `Installed packages: ${packages.length}`);
        } catch (error) {
            this.log('WARN', 'Could not check disk space usage');
        }
    }

    async generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            node_version: process.version,
            npm_version: execSync('npm --version', { encoding: 'utf8' }).trim(),
            summary: {
                errors: this.errors.length,
                warnings: this.warnings.length,
                success: this.success.length
            },
            errors: this.errors,
            warnings: this.warnings,
            success: this.success
        };

        const reportPath = path.join(process.cwd(), 'dependency-verification-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        this.log('SUCCESS', `Report saved to: ${reportPath}`);

        return report;
    }

    async run() {
        console.log('🔍 Starting Dependency Verification...');
        console.log('=====================================');

        await this.loadPackageJson();

        if (!this.packageJson) {
            console.log('❌ Cannot proceed without package.json');
            process.exit(1);
        }

        // Run all checks
        await this.checkNodeModulesExists();
        await this.checkPackageLock();

        // Verify each dependency
        if (this.packageJson.dependencies) {
            for (const [name, version] of Object.entries(this.packageJson.dependencies)) {
                await this.verifyDependency(name, version, 'dependency');
            }
        }

        if (this.packageJson.devDependencies) {
            for (const [name, version] of Object.entries(this.packageJson.devDependencies)) {
                await this.verifyDependency(name, version, 'devDependency');
            }
        }

        await this.checkBinaries();
        await this.checkTypeScriptTypes();
        await this.testImports();
        await this.checkNpmLs();
        await this.checkDiskSpace();

        // Generate final report
        const report = await this.generateReport();

        console.log('\n📊 Verification Summary:');
        console.log('========================');
        console.log(`✅ Successes: ${this.success.length}`);
        console.log(`⚠️  Warnings: ${this.warnings.length}`);
        console.log(`❌ Errors: ${this.errors.length}`);

        if (this.errors.length > 0) {
            console.log('\n❌ CRITICAL ERRORS:');
            this.errors.forEach(error => console.log(`  - ${error}`));
        }

        if (this.warnings.length > 0) {
            console.log('\n⚠️  WARNINGS:');
            this.warnings.slice(0, 10).forEach(warning => console.log(`  - ${warning}`));
            if (this.warnings.length > 10) {
                console.log(`  ... and ${this.warnings.length - 10} more warnings`);
            }
        }

        console.log('\n🔧 RECOMMENDATIONS:');
        if (this.errors.length > 0) {
            console.log('  1. Run: npm run clean-install');
            console.log('  2. Check .npmrc configuration');
            console.log('  3. Verify network connectivity');
        } else if (this.warnings.length > 0) {
            console.log('  1. Review warnings above');
            console.log('  2. Consider running: npm audit fix');
            console.log('  3. Update outdated packages: npm outdated');
        } else {
            console.log('  ✅ All dependencies look good!');
            console.log('  💡 Consider running: npm audit for security check');
        }

        process.exit(this.errors.length > 0 ? 1 : 0);
    }
}

// Run verification if called directly
if (require.main === module) {
    const verifier = new DependencyVerifier();
    verifier.run().catch(error => {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    });
}

module.exports = DependencyVerifier;