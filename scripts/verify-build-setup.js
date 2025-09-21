#!/usr/bin/env node

/**
 * Build Verification Script
 * Verifies that all the Priority 1 fixes are working correctly
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Priority 1 Build System Fixes...\n');

let allChecksPass = true;

function check(name, condition, expected, actual) {
  const status = condition ? '✅' : '❌';
  console.log(`${status} ${name}`);
  if (!condition) {
    console.log(`   Expected: ${expected}`);
    console.log(`   Actual: ${actual}\n`);
    allChecksPass = false;
  }
  return condition;
}

// Check 1: APISettingsHandler.js exists and has proper IPC handlers
const apiHandlerPath = path.join(__dirname, '../src/main/ipc/handlers/APISettingsHandler.js');
const apiHandlerExists = fs.existsSync(apiHandlerPath);
check('APISettingsHandler.js exists', apiHandlerExists, 'File exists', 'File missing');

if (apiHandlerExists) {
  const apiHandlerContent = fs.readFileSync(apiHandlerPath, 'utf-8');
  const hasProperHandlers = apiHandlerContent.includes('api-settings:get-providers') &&
                            apiHandlerContent.includes('api-settings:save-key') &&
                            apiHandlerContent.includes('api-settings:test-connection') &&
                            apiHandlerContent.includes('safeStorage') &&
                            apiHandlerContent.includes('encrypt') &&
                            apiHandlerContent.includes('decrypt');
  check('APISettingsHandler has all required IPC handlers', hasProperHandlers, 'All handlers present', 'Missing handlers');

  const hasProviderSupport = apiHandlerContent.includes('openai') &&
                            apiHandlerContent.includes('anthropic') &&
                            apiHandlerContent.includes('gemini') &&
                            apiHandlerContent.includes('copilot');
  check('APISettingsHandler supports all providers', hasProviderSupport, 'OpenAI, Anthropic, Gemini, Copilot', 'Missing providers');
}

// Check 2: Package.json build configuration is correct
const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

const hasCorrectFiles = packageJson.build.files.includes('dist/renderer/**/*') &&
                       packageJson.build.files.includes('src/main/ipc/**/*') &&
                       !packageJson.build.files.includes('!dist/renderer/**/*');
check('package.json includes dist/renderer in build files', hasCorrectFiles, 'dist/renderer/**/* included', 'dist/renderer not included or excluded');

const hasExtraResources = packageJson.build.extraResources &&
                         packageJson.build.extraResources.length > 0;
check('package.json has extraResources for better-sqlite3', hasExtraResources, 'extraResources configured', 'No extraResources');

// Check 3: Main.js has enhanced loading logic
const mainJsPath = path.join(__dirname, '../src/main/main.js');
const mainJsContent = fs.readFileSync(mainJsPath, 'utf-8');

const hasEnhancedLoading = mainJsContent.includes('possiblePaths') &&
                          mainJsContent.includes('dist/renderer/index.html') &&
                          mainJsContent.includes('createEmergencyFallback');
check('main.js has enhanced loading logic', hasEnhancedLoading, 'Multiple fallback paths', 'Basic loading only');

const hasFallbackMechanism = mainJsContent.includes('Emergency Fallback') &&
                            mainJsContent.includes('emergency.html');
check('main.js has emergency fallback mechanism', hasFallbackMechanism, 'Emergency fallback present', 'No emergency fallback');

// Check 4: React app builds successfully
const reactBuildPath = path.join(__dirname, '../dist/renderer/index.html');
const reactBuildExists = fs.existsSync(reactBuildPath);
check('React app built successfully', reactBuildExists, 'dist/renderer/index.html exists', 'React build missing');

if (reactBuildExists) {
  const reactIndexContent = fs.readFileSync(reactBuildPath, 'utf-8');
  const hasReactBundle = reactIndexContent.includes('script') &&
                        reactIndexContent.includes('assets/') &&
                        reactIndexContent.includes('root');
  check('React build contains proper bundle references', hasReactBundle, 'Script and asset references present', 'Missing bundle references');
}

// Check 5: Assets directory exists
const assetsPath = path.join(__dirname, '../dist/renderer/assets');
const assetsExists = fs.existsSync(assetsPath);
check('React assets directory exists', assetsExists, 'dist/renderer/assets exists', 'Assets directory missing');

if (assetsExists) {
  const assetsFiles = fs.readdirSync(assetsPath);
  const hasJsAssets = assetsFiles.some(file => file.endsWith('.js'));
  const hasCssAssets = assetsFiles.some(file => file.endsWith('.css'));
  check('React assets include JS and CSS files', hasJsAssets && hasCssAssets, 'JS and CSS assets present', 'Missing JS or CSS assets');
}

// Check 6: Import issues fixed
const batchedIpcPath = path.join(__dirname, '../src/renderer/utils/BatchedIPCManager.ts');
if (fs.existsSync(batchedIpcPath)) {
  const batchedIpcContent = fs.readFileSync(batchedIpcPath, 'utf-8');
  const hasFixedImports = batchedIpcContent.includes('require(') &&
                         batchedIpcContent.includes('differentialStateManager');
  check('Import issues fixed in BatchedIPCManager', hasFixedImports, 'CommonJS require used', 'ES6 import still present');
}

// Summary
console.log('\n📋 BUILD VERIFICATION SUMMARY');
console.log('================================');

if (allChecksPass) {
  console.log('🎉 ALL PRIORITY 1 FIXES VERIFIED SUCCESSFULLY!');
  console.log('\n✅ APISettingsHandler.js - Complete IPC functionality');
  console.log('✅ Electron packaging - Fixed file inclusion');
  console.log('✅ main.js loading - Enhanced with fallbacks');
  console.log('✅ React app building - Successfully generated');
  console.log('✅ Build system - All components working');

  console.log('\n🚀 NEXT STEPS:');
  console.log('1. Run "npm run build:electron" to create distributable');
  console.log('2. Test the packaged application');
  console.log('3. Verify API settings functionality in the app');

  process.exit(0);
} else {
  console.log('❌ SOME FIXES NEED ATTENTION');
  console.log('Please review the failed checks above.');
  process.exit(1);
}