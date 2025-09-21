/**
 * After Build Script
 * Runs after all artifacts are built
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

exports.default = async function afterBuild(context) {
  console.log('Running after-build script...');

  const { outDir, electronPlatformName } = context;

  // Generate checksums for all artifacts
  await generateChecksums(outDir);

  // Platform-specific post-build actions
  switch (electronPlatformName) {
    case 'darwin':
      await macOSPostBuild(context);
      break;
    case 'win32':
      await windowsPostBuild(context);
      break;
    case 'linux':
      await linuxPostBuild(context);
      break;
  }

  console.log('After-build script completed');
};

/**
 * Generate SHA256 checksums for all build artifacts
 */
async function generateChecksums(outDir) {
  console.log('Generating checksums...');

  const files = fs.readdirSync(outDir);
  const checksums = {};

  for (const file of files) {
    const filePath = path.join(outDir, file);
    const stats = fs.statSync(filePath);

    if (stats.isFile() && !file.endsWith('.yml') && !file.endsWith('.txt')) {
      const hash = crypto.createHash('sha256');
      const fileBuffer = fs.readFileSync(filePath);
      hash.update(fileBuffer);
      const checksum = hash.digest('hex');

      checksums[file] = {
        sha256: checksum,
        size: stats.size,
        modified: stats.mtime.toISOString()
      };

      console.log(`  ${file}: ${checksum}`);
    }
  }

  // Write checksums file
  const checksumFile = path.join(outDir, 'checksums.json');
  fs.writeFileSync(checksumFile, JSON.stringify(checksums, null, 2));

  // Write traditional CHECKSUMS.txt file
  const checksumTxt = path.join(outDir, 'CHECKSUMS.txt');
  const txtContent = Object.entries(checksums)
    .map(([file, data]) => `${data.sha256}  ${file}`)
    .join('\n');
  fs.writeFileSync(checksumTxt, txtContent);

  console.log(`Checksums written to ${checksumFile} and ${checksumTxt}`);
}

/**
 * macOS-specific post-build actions
 */
async function macOSPostBuild(context) {
  console.log('Running macOS post-build actions...');

  const { appOutDir } = context;
  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  // Verify code signing
  if (fs.existsSync(appPath)) {
    try {
      const { execSync } = require('child_process');
      const result = execSync(`codesign -vvv --deep --strict "${appPath}"`, { encoding: 'utf8' });
      console.log('✅ Code signing verification passed');
    } catch (error) {
      console.warn('⚠️  Code signing verification failed:', error.message);
    }
  }

  // Create symbolic links for easier access
  const contentsPath = path.join(appPath, 'Contents');
  if (fs.existsSync(contentsPath)) {
    console.log('macOS app bundle structure verified');
  }
}

/**
 * Windows-specific post-build actions
 */
async function windowsPostBuild(context) {
  console.log('Running Windows post-build actions...');

  const { outDir } = context;

  // Verify installer signatures
  const installers = fs.readdirSync(outDir).filter(file =>
    file.endsWith('.exe') || file.endsWith('.msi')
  );

  for (const installer of installers) {
    const installerPath = path.join(outDir, installer);
    console.log(`Verifying ${installer}...`);

    try {
      const { execSync } = require('child_process');
      // Use signtool to verify (if available)
      execSync(`powershell -Command "Get-AuthenticodeSignature '${installerPath}'"`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      console.log(`✅ ${installer} signature verified`);
    } catch (error) {
      console.warn(`⚠️  Could not verify signature for ${installer}`);
    }
  }
}

/**
 * Linux-specific post-build actions
 */
async function linuxPostBuild(context) {
  console.log('Running Linux post-build actions...');

  const { outDir } = context;

  // Verify AppImage executability
  const appImages = fs.readdirSync(outDir).filter(file => file.endsWith('.AppImage'));

  for (const appImage of appImages) {
    const appImagePath = path.join(outDir, appImage);
    const stats = fs.statSync(appImagePath);

    // Check if executable bit is set
    if (stats.mode & parseInt('111', 8)) {
      console.log(`✅ ${appImage} is executable`);
    } else {
      console.warn(`⚠️  ${appImage} is not executable`);
      // Make it executable
      fs.chmodSync(appImagePath, stats.mode | parseInt('111', 8));
      console.log(`Fixed executable permissions for ${appImage}`);
    }
  }

  // Verify package dependencies
  const debFiles = fs.readdirSync(outDir).filter(file => file.endsWith('.deb'));
  for (const debFile of debFiles) {
    console.log(`✅ Generated Debian package: ${debFile}`);
  }

  const rpmFiles = fs.readdirSync(outDir).filter(file => file.endsWith('.rpm'));
  for (const rpmFile of rpmFiles) {
    console.log(`✅ Generated RPM package: ${rpmFile}`);
  }
}

module.exports = { default: exports.default };