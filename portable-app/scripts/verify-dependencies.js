#!/usr/bin/env node

/**
 * Dependency Verification Script
 * Checks the status of critical development dependencies
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Development Dependencies...\n');

// Test functions
const tests = [
  {
    name: 'Node.js Version',
    test: () => {
      const version = process.version;
      console.log(`✅ Node.js: ${version}`);
      return version;
    }
  },
  {
    name: 'NPM Version',
    test: () => {
      try {
        const version = execSync('npm --version', { encoding: 'utf8' }).trim();
        console.log(`✅ NPM: v${version}`);
        return version;
      } catch (error) {
        console.log(`❌ NPM: Error - ${error.message}`);
        return null;
      }
    }
  },
  {
    name: 'TypeScript',
    test: () => {
      try {
        const version = execSync('npx tsc --version', { encoding: 'utf8' }).trim();
        console.log(`✅ TypeScript: ${version}`);
        return version;
      } catch (error) {
        console.log(`❌ TypeScript: Error - ${error.message}`);
        return null;
      }
    }
  },
  {
    name: 'Vite',
    test: () => {
      try {
        const version = execSync('npx vite --version', { encoding: 'utf8' }).trim();
        console.log(`✅ Vite: ${version}`);
        return version;
      } catch (error) {
        console.log(`❌ Vite: Error - ${error.message}`);
        return null;
      }
    }
  },
  {
    name: 'ESLint',
    test: () => {
      try {
        const version = execSync('npx eslint --version', { encoding: 'utf8' }).trim();
        console.log(`✅ ESLint: ${version}`);
        return version;
      } catch (error) {
        console.log(`❌ ESLint: Error - ${error.message}`);
        return null;
      }
    }
  },
  {
    name: 'Jest',
    test: () => {
      try {
        const version = execSync('npx jest --version', { encoding: 'utf8' }).trim();
        console.log(`✅ Jest: ${version}`);
        return version;
      } catch (error) {
        console.log(`❌ Jest: Error - ${error.message}`);
        return null;
      }
    }
  },
  {
    name: 'Package.json',
    test: () => {
      try {
        const packagePath = path.join(process.cwd(), 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        console.log(`✅ Package.json: Found with ${Object.keys(packageJson.dependencies || {}).length} dependencies`);
        return packageJson;
      } catch (error) {
        console.log(`❌ Package.json: Error - ${error.message}`);
        return null;
      }
    }
  },
  {
    name: 'Node Modules',
    test: () => {
      try {
        const nodeModulesPath = path.join(process.cwd(), 'node_modules');
        const stats = fs.statSync(nodeModulesPath);
        const contents = fs.readdirSync(nodeModulesPath);
        console.log(`✅ Node Modules: Directory exists with ${contents.length} items`);
        return contents.length;
      } catch (error) {
        console.log(`❌ Node Modules: Error - ${error.message}`);
        return null;
      }
    }
  }
];

// Configuration file checks
const configTests = [
  {
    name: 'TypeScript Config',
    file: 'tsconfig.json'
  },
  {
    name: 'Vite Config',
    file: 'vite.config.ts'
  },
  {
    name: 'ESLint Config',
    file: '.eslintrc.json'
  },
  {
    name: 'Jest Config',
    file: 'jest.config.js'
  }
];

// Run dependency tests
console.log('=== Core Tools ===');
const results = tests.map(test => {
  try {
    const result = test.test();
    return { name: test.name, success: !!result, result };
  } catch (error) {
    console.log(`❌ ${test.name}: Exception - ${error.message}`);
    return { name: test.name, success: false, error: error.message };
  }
});

// Run config file tests
console.log('\n=== Configuration Files ===');
configTests.forEach(configTest => {
  try {
    const configPath = path.join(process.cwd(), configTest.file);
    const stats = fs.statSync(configPath);
    console.log(`✅ ${configTest.name}: ${configTest.file} found (${stats.size} bytes)`);
  } catch (error) {
    console.log(`❌ ${configTest.name}: ${configTest.file} missing or invalid`);
  }
});

// Summary
console.log('\n=== Summary ===');
const successful = results.filter(r => r.success).length;
const total = results.length;
console.log(`${successful}/${total} core tools are working`);

if (successful === total) {
  console.log('🎉 All development dependencies are properly installed and working!');
  process.exit(0);
} else {
  console.log('⚠️  Some development dependencies have issues. Check the output above.');
  console.log('\n💡 Recommendations:');

  const failed = results.filter(r => !r.success);
  failed.forEach(failure => {
    console.log(`   - Fix ${failure.name}: Install or repair this dependency`);
  });

  console.log('\n🔧 Quick fixes:');
  console.log('   - Run: npm install --force');
  console.log('   - Or: npm run install:clean');
  console.log('   - Or: rm -rf node_modules package-lock.json && npm install');

  process.exit(1);
}