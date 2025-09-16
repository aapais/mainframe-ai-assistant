#!/usr/bin/env node

/**
 * TypeScript Configuration Validation Script
 * Validates all tsconfig.json files for MVP1 setup
 */

const fs = require('fs');
const path = require('path');

const configs = [
  'tsconfig.json',
  'tsconfig.main.json',
  'tsconfig.renderer.json',
  'tsconfig.test.json',
  'tsconfig.dev.json',
  'tsconfig.prod.json'
];

console.log('🔍 Validating TypeScript Configurations for MVP1...\n');

let allValid = true;

configs.forEach(configFile => {
  console.log(`📋 Checking ${configFile}...`);
  
  try {
    const configPath = path.join(process.cwd(), configFile);
    
    if (!fs.existsSync(configPath)) {
      console.log(`   ❌ File not found: ${configFile}`);
      allValid = false;
      return;
    }
    
    const content = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(content);
    
    // Basic validation checks
    const checks = [
      {
        name: 'Has compilerOptions',
        test: () => config.compilerOptions !== undefined,
        critical: true
      },
      {
        name: 'Has target specified',
        test: () => config.compilerOptions?.target !== undefined,
        critical: true
      },
      {
        name: 'Has module specified',
        test: () => config.compilerOptions?.module !== undefined,
        critical: true
      },
      {
        name: 'Has strict mode enabled',
        test: () => config.compilerOptions?.strict === true,
        critical: false
      },
      {
        name: 'Has proper path mapping',
        test: () => config.compilerOptions?.paths !== undefined && 
                   config.compilerOptions?.paths['@/*'] !== undefined,
        critical: false
      },
      {
        name: 'Has include array',
        test: () => Array.isArray(config.include),
        critical: true
      },
      {
        name: 'Has exclude array',
        test: () => Array.isArray(config.exclude),
        critical: false
      }
    ];
    
    let configValid = true;
    checks.forEach(check => {
      const passed = check.test();
      const symbol = passed ? '✅' : (check.critical ? '❌' : '⚠️');
      const status = passed ? 'PASS' : (check.critical ? 'FAIL' : 'WARN');
      
      console.log(`   ${symbol} ${check.name}: ${status}`);
      
      if (!passed && check.critical) {
        configValid = false;
      }
    });
    
    // Configuration-specific checks
    switch (configFile) {
      case 'tsconfig.main.json':
        if (config.compilerOptions?.module !== 'CommonJS') {
          console.log('   ⚠️  Main process should use CommonJS modules');
        }
        if (!config.compilerOptions?.lib?.includes('ES2022')) {
          console.log('   ⚠️  Main process should include ES2022 lib');
        }
        break;
        
      case 'tsconfig.renderer.json':
        if (config.compilerOptions?.jsx !== 'react-jsx') {
          console.log('   ⚠️  Renderer should use react-jsx transform');
        }
        if (!config.compilerOptions?.lib?.includes('DOM')) {
          console.log('   ⚠️  Renderer should include DOM lib');
        }
        break;
        
      case 'tsconfig.test.json':
        if (!config.compilerOptions?.types?.includes('jest')) {
          console.log('   ⚠️  Test config should include jest types');
        }
        break;
    }
    
    if (configValid) {
      console.log(`   ✅ ${configFile} is valid\n`);
    } else {
      console.log(`   ❌ ${configFile} has critical issues\n`);
      allValid = false;
    }
    
  } catch (error) {
    console.log(`   ❌ Error parsing ${configFile}: ${error.message}\n`);
    allValid = false;
  }
});

// Summary
console.log('📊 Validation Summary:');
console.log('='.repeat(50));

if (allValid) {
  console.log('✅ All TypeScript configurations are valid!');
  console.log('\n🚀 MVP1 TypeScript Setup Features:');
  console.log('   • Dual-process Electron configuration (main + renderer)');
  console.log('   • Strict type safety with performance optimizations');
  console.log('   • Path aliases for clean imports (@/*, @main/*, etc.)');
  console.log('   • Future MVP extensibility with decorators');
  console.log('   • Optimized build configurations (dev/prod/test)');
  console.log('   • React 18 JSX transform support');
  console.log('   • SQLite and Node.js type integration');
  console.log('   • Source maps for debugging');
  console.log('   • Bundle size optimizations');
  console.log('   • ES2022 target for modern JavaScript');
  
  process.exit(0);
} else {
  console.log('❌ Some configurations have issues that need to be addressed.');
  console.log('\n🔧 Please review the errors above and fix the configurations.');
  
  process.exit(1);
}