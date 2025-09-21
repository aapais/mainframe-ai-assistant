#!/usr/bin/env node

/**
 * Performance Setup Validator
 * Validates that the performance testing environment is properly configured
 */

const fs = require('fs').promises;
const path = require('path');

async function validatePerformanceSetup() {
  console.log('🔍 Validating Performance Test Setup');
  console.log('=====================================');

  const checks = [];

  try {
    // Check 1: Core test files exist
    const testFiles = [
      'tests/integration/comprehensive-performance-suite.js',
      'tests/integration/run-performance-tests.js',
      'tests/integration/performance-report.md'
    ];

    for (const file of testFiles) {
      try {
        await fs.access(file);
        checks.push({ name: `Test file: ${file}`, status: '✅ Found' });
      } catch (error) {
        checks.push({ name: `Test file: ${file}`, status: '❌ Missing' });
      }
    }

    // Check 2: Package.json scripts
    try {
      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
      const requiredScripts = [
        'test:performance:comprehensive',
        'test:performance:report'
      ];

      for (const script of requiredScripts) {
        if (packageJson.scripts[script]) {
          checks.push({ name: `NPM script: ${script}`, status: '✅ Configured' });
        } else {
          checks.push({ name: `NPM script: ${script}`, status: '❌ Missing' });
        }
      }
    } catch (error) {
      checks.push({ name: 'Package.json validation', status: '❌ Failed' });
    }

    // Check 3: Required directories
    const directories = [
      'tests/integration',
      'src/database',
      'src/services'
    ];

    for (const dir of directories) {
      try {
        const stat = await fs.stat(dir);
        if (stat.isDirectory()) {
          checks.push({ name: `Directory: ${dir}`, status: '✅ Exists' });
        } else {
          checks.push({ name: `Directory: ${dir}`, status: '❌ Not a directory' });
        }
      } catch (error) {
        checks.push({ name: `Directory: ${dir}`, status: '❌ Missing' });
      }
    }

    // Check 4: Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));

    if (majorVersion >= 18) {
      checks.push({ name: `Node.js version: ${nodeVersion}`, status: '✅ Compatible' });
    } else {
      checks.push({ name: `Node.js version: ${nodeVersion}`, status: '⚠️ Upgrade recommended (>=18)' });
    }

    // Check 5: Available memory
    const memoryMB = Math.round(process.memoryUsage().heapTotal / 1024 / 1024);
    if (memoryMB >= 256) {
      checks.push({ name: `Available memory: ${memoryMB}MB`, status: '✅ Sufficient' });
    } else {
      checks.push({ name: `Available memory: ${memoryMB}MB`, status: '⚠️ Low memory' });
    }

    // Check 6: Test configuration validation
    try {
      const testSuite = require(path.join(process.cwd(), 'tests/integration/comprehensive-performance-suite.js'));
      if (typeof testSuite === 'function') {
        checks.push({ name: 'Test suite module', status: '✅ Valid' });
      } else {
        checks.push({ name: 'Test suite module', status: '❌ Invalid export' });
      }
    } catch (error) {
      checks.push({ name: 'Test suite module', status: `❌ Load error: ${error.message}` });
    }

    // Display results
    console.log('\n📋 Validation Results:');
    console.log('----------------------');

    let passCount = 0;
    let totalCount = checks.length;

    for (const check of checks) {
      console.log(`${check.status} ${check.name}`);
      if (check.status.startsWith('✅')) passCount++;
    }

    console.log('\n📊 Summary:');
    console.log(`Passed: ${passCount}/${totalCount}`);
    console.log(`Success Rate: ${Math.round((passCount / totalCount) * 100)}%`);

    if (passCount === totalCount) {
      console.log('\n🎉 Performance test environment is ready!');
      console.log('\n💡 To run performance tests:');
      console.log('  npm run test:performance:comprehensive');
      console.log('  npm run test:performance:report');
      console.log('  ./scripts/run-performance-suite.sh');
      return true;
    } else {
      console.log('\n⚠️ Some checks failed. Please address the issues above.');
      return false;
    }

  } catch (error) {
    console.error('\n❌ Validation failed:', error);
    return false;
  }
}

// Performance test capability check
async function checkPerformanceCapabilities() {
  console.log('\n🔧 Performance Testing Capabilities:');
  console.log('------------------------------------');

  const capabilities = [];

  // Memory management
  if (global.gc) {
    capabilities.push('✅ Garbage collection control available');
  } else {
    capabilities.push('⚠️ Garbage collection control not available (use --expose-gc)');
  }

  // Performance APIs
  if (typeof performance !== 'undefined' && performance.now) {
    capabilities.push('✅ High-resolution time measurement available');
  } else {
    capabilities.push('❌ Performance API not available');
  }

  // Worker threads
  try {
    require('worker_threads');
    capabilities.push('✅ Worker threads available for concurrency testing');
  } catch (error) {
    capabilities.push('⚠️ Worker threads not available');
  }

  // Cluster support
  try {
    require('cluster');
    capabilities.push('✅ Cluster module available for load testing');
  } catch (error) {
    capabilities.push('❌ Cluster module not available');
  }

  // File system performance
  try {
    require('fs').promises;
    capabilities.push('✅ Async file system operations available');
  } catch (error) {
    capabilities.push('❌ Async file system not available');
  }

  for (const capability of capabilities) {
    console.log(capability);
  }

  return capabilities;
}

// Expected performance thresholds
function displayPerformanceTargets() {
  console.log('\n🎯 Performance Targets:');
  console.log('----------------------');

  const targets = [
    { test: 'FTS5 Search (50+ KB entries)', target: '< 1000ms avg response time' },
    { test: 'IPC Communication Latency', target: '< 10ms P95 latency' },
    { test: 'Dashboard Rendering (1000+ logs)', target: '< 2000ms max render time' },
    { test: 'AI Authorization Decisions', target: '< 100ms P95 decision time' },
    { test: 'Memory Usage (Large datasets)', target: '0 memory leaks detected' },
    { test: 'Concurrent Operations', target: '10+ simultaneous operations' },
    { test: 'Startup Performance', target: '< 5000ms P95 startup time' }
  ];

  for (const target of targets) {
    console.log(`✓ ${target.test}: ${target.target}`);
  }
}

// Main execution
async function main() {
  const isValid = await validatePerformanceSetup();
  await checkPerformanceCapabilities();
  displayPerformanceTargets();

  if (!isValid) {
    process.exit(1);
  }

  console.log('\n✅ Performance test environment validation complete!');
}

if (require.main === module) {
  main().catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

module.exports = {
  validatePerformanceSetup,
  checkPerformanceCapabilities,
  displayPerformanceTargets
};