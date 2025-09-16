#!/usr/bin/env node

/**
 * Package Verification Script
 * Verifies that all required packages are properly installed with correct dist files
 */

const fs = require('fs');
const path = require('path');

const REQUIRED_PACKAGES = {
    'react': {
        version: '^18.2.0',
        files: ['index.js', 'package.json'],
        distPath: 'node_modules/react'
    },
    'react-dom': {
        version: '^18.2.0',
        files: ['index.js', 'package.json'],
        distPath: 'node_modules/react-dom'
    },
    'react-router-dom': {
        version: '^6.20.0',
        files: ['index.js', 'package.json'],
        distPath: 'node_modules/react-router-dom'
    },
    'class-variance-authority': {
        version: '^0.7.0',
        files: ['dist/index.mjs', 'dist/index.d.ts', 'package.json'],
        distPath: 'node_modules/class-variance-authority',
        critical: true
    },
    'lucide-react': {
        version: '^0.292.0',
        files: ['dist/esm/index.js', 'package.json'],
        distPath: 'node_modules/lucide-react'
    },
    'clsx': {
        version: '^2.0.0',
        files: ['dist/clsx.js', 'package.json'],
        distPath: 'node_modules/clsx'
    },
    'tailwind-merge': {
        version: '^2.0.0',
        files: ['dist/bundle-mjs.mjs', 'package.json'],
        distPath: 'node_modules/tailwind-merge'
    }
};

console.log('🔍 Verifying package installations...\n');

let hasErrors = false;
let hasWarnings = false;

function checkPackage(packageName, config) {
    console.log(`Checking ${packageName}...`);

    const packagePath = config.distPath;

    // Check if package directory exists
    if (!fs.existsSync(packagePath)) {
        console.log(`❌ ${packageName}: Package directory not found at ${packagePath}`);
        hasErrors = true;
        return false;
    }

    // Check package.json
    const packageJsonPath = path.join(packagePath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
        console.log(`❌ ${packageName}: package.json not found`);
        hasErrors = true;
        return false;
    }

    // Read and verify version
    try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        console.log(`   📋 Version: ${packageJson.version}`);

        // Check main entry point
        if (packageJson.main) {
            const mainFile = path.join(packagePath, packageJson.main);
            if (!fs.existsSync(mainFile)) {
                console.log(`⚠️  ${packageName}: Main file missing: ${packageJson.main}`);
                hasWarnings = true;
            }
        }

        // Check module entry point
        if (packageJson.module) {
            const moduleFile = path.join(packagePath, packageJson.module);
            if (!fs.existsSync(moduleFile)) {
                console.log(`⚠️  ${packageName}: Module file missing: ${packageJson.module}`);
                hasWarnings = true;
            }
        }

        // Check exports
        if (packageJson.exports) {
            console.log(`   📤 Exports defined: ${Object.keys(packageJson.exports).join(', ')}`);
        }

    } catch (error) {
        console.log(`❌ ${packageName}: Error reading package.json: ${error.message}`);
        hasErrors = true;
        return false;
    }

    // Check required files
    let missingFiles = [];
    config.files.forEach(file => {
        const filePath = path.join(packagePath, file);
        if (!fs.existsSync(filePath)) {
            missingFiles.push(file);
        }
    });

    if (missingFiles.length > 0) {
        console.log(`❌ ${packageName}: Missing files: ${missingFiles.join(', ')}`);
        if (config.critical) {
            hasErrors = true;
        } else {
            hasWarnings = true;
        }

        // For class-variance-authority, check alternative locations
        if (packageName === 'class-variance-authority') {
            console.log(`   🔍 Searching for alternative file locations...`);
            const findFiles = (dir, pattern) => {
                const results = [];
                if (!fs.existsSync(dir)) return results;

                function walk(currentPath) {
                    const items = fs.readdirSync(currentPath);
                    items.forEach(item => {
                        const fullPath = path.join(currentPath, item);
                        const stat = fs.statSync(fullPath);
                        if (stat.isFile() && item.includes(pattern)) {
                            results.push(fullPath.replace(packagePath + '/', ''));
                        } else if (stat.isDirectory() && item !== 'node_modules') {
                            walk(fullPath);
                        }
                    });
                }

                walk(dir);
                return results;
            };

            const mjsFiles = findFiles(packagePath, 'index.mjs');
            const dtsFiles = findFiles(packagePath, 'index.d.ts');

            if (mjsFiles.length > 0) {
                console.log(`   ✅ Found .mjs files: ${mjsFiles.join(', ')}`);
            }
            if (dtsFiles.length > 0) {
                console.log(`   ✅ Found .d.ts files: ${dtsFiles.join(', ')}`);
            }
        }

        return false;
    }

    console.log(`✅ ${packageName}: All required files present`);
    return true;
}

// Test imports
function testImports() {
    console.log('\n🧪 Testing package imports...');

    const testCases = [
        {
            name: 'React',
            test: () => require('react')
        },
        {
            name: 'React DOM',
            test: () => require('react-dom')
        },
        {
            name: 'React Router DOM',
            test: () => require('react-router-dom')
        },
        {
            name: 'clsx',
            test: () => require('clsx')
        },
        {
            name: 'tailwind-merge',
            test: () => require('tailwind-merge')
        },
        {
            name: 'lucide-react',
            test: () => require('lucide-react')
        },
        {
            name: 'class-variance-authority',
            test: () => {
                // Try different import paths
                try {
                    return require('class-variance-authority');
                } catch (e1) {
                    try {
                        return require('class-variance-authority/dist');
                    } catch (e2) {
                        try {
                            return require('class-variance-authority/dist/index.mjs');
                        } catch (e3) {
                            throw e1; // Throw original error
                        }
                    }
                }
            }
        }
    ];

    testCases.forEach(testCase => {
        try {
            const imported = testCase.test();
            console.log(`✅ ${testCase.name}: Import successful`);

            // Additional checks for specific packages
            if (testCase.name === 'class-variance-authority') {
                if (typeof imported.cva === 'function') {
                    console.log(`   ✅ cva function available`);
                } else {
                    console.log(`   ⚠️  cva function not found in import`);
                    hasWarnings = true;
                }
            }

        } catch (error) {
            console.log(`❌ ${testCase.name}: Import failed - ${error.message}`);
            hasErrors = true;
        }
    });
}

// Run verification
console.log('Starting verification process...\n');

Object.keys(REQUIRED_PACKAGES).forEach(packageName => {
    checkPackage(packageName, REQUIRED_PACKAGES[packageName]);
    console.log('');
});

testImports();

// Summary
console.log('\n📊 Verification Summary:');
if (hasErrors) {
    console.log('❌ ERRORS FOUND - Some packages are missing or broken');
    console.log('   Run rebuild-dependencies.sh to fix these issues');
    process.exit(1);
} else if (hasWarnings) {
    console.log('⚠️  WARNINGS FOUND - Some non-critical issues detected');
    console.log('   Packages should work but may have suboptimal performance');
    process.exit(0);
} else {
    console.log('✅ ALL PACKAGES VERIFIED - Everything looks good!');
    process.exit(0);
}