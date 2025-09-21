/**
 * macOS Notarization Script
 * Handles notarization process for macOS builds
 */

const { notarize } = require('electron-notarize');
const fs = require('fs');
const path = require('path');

exports.default = async function notarizeMacOS(context) {
  const { electronPlatformName, appOutDir } = context;

  // Only notarize macOS builds
  if (electronPlatformName !== 'darwin') {
    console.log('Skipping notarization for non-macOS platform');
    return;
  }

  // Check if this is a release build
  if (!process.env.CI || !process.env.APPLE_ID) {
    console.log('Skipping notarization - not a CI release build or missing Apple ID');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  // Verify the app exists
  if (!fs.existsSync(appPath)) {
    throw new Error(`App not found at ${appPath}`);
  }

  console.log(`Starting notarization for ${appPath}`);
  console.log('This may take several minutes...');

  const startTime = Date.now();

  try {
    await notarize({
      appBundleId: context.packager.appInfo.id,
      appPath: appPath,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_ID_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
      tool: 'notarytool' // Use the newer notarytool
    });

    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);

    console.log(`✅ Notarization completed successfully in ${duration} seconds`);

  } catch (error) {
    console.error('❌ Notarization failed:', error);

    // Provide helpful error messages
    if (error.message.includes('invalid credentials')) {
      console.error('Check your Apple ID credentials (APPLE_ID, APPLE_ID_PASSWORD, APPLE_TEAM_ID)');
    } else if (error.message.includes('invalid bundle')) {
      console.error('The app bundle may not be properly signed');
    } else if (error.message.includes('network')) {
      console.error('Network error - check internet connection');
    }

    throw error;
  }
};

/**
 * Validate notarization environment
 */
function validateNotarizationEnvironment() {
  const requiredEnvVars = ['APPLE_ID', 'APPLE_ID_PASSWORD', 'APPLE_TEAM_ID'];
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);

  if (missing.length > 0) {
    console.warn(`⚠️  Missing notarization environment variables: ${missing.join(', ')}`);
    console.warn('Notarization will be skipped');
    return false;
  }

  return true;
}

/**
 * Check notarization status
 */
async function checkNotarizationStatus(appPath) {
  const { execSync } = require('child_process');

  try {
    const result = execSync(`spctl -a -vvv "${appPath}"`, { encoding: 'utf8' });
    console.log('Gatekeeper assessment:', result);
    return true;
  } catch (error) {
    console.error('Gatekeeper assessment failed:', error.message);
    return false;
  }
}

module.exports = {
  default: exports.default,
  validateNotarizationEnvironment,
  checkNotarizationStatus
};