#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { glob } = require('glob');

/**
 * Checksum Generator and Verification Tool
 * Generates and verifies file checksums for deployment packages
 */
class ChecksumGenerator {
  constructor(options = {}) {
    this.options = {
      algorithm: options.algorithm || 'sha256',
      encoding: options.encoding || 'hex',
      excludePatterns: options.excludePatterns || [
        'node_modules/**',
        '.git/**',
        '*.log',
        'tmp/**',
        'temp/**',
        '.DS_Store',
        'Thumbs.db'
      ],
      ...options
    };
  }

  /**
   * Generate checksums for all files in a directory
   */
  async generateDirectoryChecksums(directoryPath, outputFile) {
    console.log(`🔍 Generating checksums for directory: ${directoryPath}`);

    const startTime = Date.now();
    const checksums = new Map();
    const errors = [];

    try {
      // Get all files in directory
      const files = await this.getFilesInDirectory(directoryPath);
      console.log(`📁 Found ${files.length} files to process`);

      // Generate checksums for each file
      let processed = 0;
      for (const filePath of files) {
        try {
          const relativePath = path.relative(directoryPath, filePath);
          const checksum = await this.generateFileChecksum(filePath);
          const stats = fs.statSync(filePath);

          checksums.set(relativePath, {
            checksum: checksum,
            size: stats.size,
            modified: stats.mtime.toISOString(),
            algorithm: this.options.algorithm
          });

          processed++;
          if (processed % 100 === 0) {
            console.log(`✅ Processed ${processed}/${files.length} files`);
          }
        } catch (error) {
          errors.push(`Error processing ${filePath}: ${error.message}`);
        }
      }

      // Generate summary
      const summary = {
        generated: new Date().toISOString(),
        directory: directoryPath,
        algorithm: this.options.algorithm,
        totalFiles: checksums.size,
        errors: errors,
        processingTime: Date.now() - startTime
      };

      // Save checksums to file
      const output = {
        summary,
        checksums: Object.fromEntries(checksums)
      };

      if (outputFile) {
        fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
        console.log(`💾 Checksums saved to: ${outputFile}`);
      }

      console.log(`✅ Generated checksums for ${checksums.size} files in ${summary.processingTime}ms`);

      if (errors.length > 0) {
        console.warn(`⚠️ ${errors.length} errors encountered`);
        errors.forEach(error => console.warn(`   ${error}`));
      }

      return output;

    } catch (error) {
      console.error(`❌ Failed to generate checksums: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate checksum for a single file
   */
  async generateFileChecksum(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash(this.options.algorithm);
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => {
        hash.update(data);
      });

      stream.on('end', () => {
        resolve(hash.digest(this.options.encoding));
      });

      stream.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Verify checksums against existing checksum file
   */
  async verifyChecksums(checksumFile, baseDirectory) {
    console.log(`🔍 Verifying checksums from: ${checksumFile}`);

    const startTime = Date.now();
    const results = {
      valid: true,
      summary: {
        totalFiles: 0,
        verifiedFiles: 0,
        failedFiles: 0,
        missingFiles: 0,
        newFiles: 0
      },
      failures: [],
      missing: [],
      new: [],
      errors: []
    };

    try {
      // Load checksum file
      const checksumData = JSON.parse(fs.readFileSync(checksumFile, 'utf8'));
      const expectedChecksums = checksumData.checksums;

      results.summary.totalFiles = Object.keys(expectedChecksums).length;
      console.log(`📋 Verifying ${results.summary.totalFiles} files`);

      // Verify each expected file
      for (const [relativePath, expectedData] of Object.entries(expectedChecksums)) {
        const fullPath = path.join(baseDirectory, relativePath);

        if (!fs.existsSync(fullPath)) {
          results.missing.push(relativePath);
          results.summary.missingFiles++;
          continue;
        }

        try {
          const actualChecksum = await this.generateFileChecksum(fullPath);
          const stats = fs.statSync(fullPath);

          if (actualChecksum === expectedData.checksum && stats.size === expectedData.size) {
            results.summary.verifiedFiles++;
          } else {
            results.failures.push({
              file: relativePath,
              expected: expectedData.checksum,
              actual: actualChecksum,
              expectedSize: expectedData.size,
              actualSize: stats.size
            });
            results.summary.failedFiles++;
          }
        } catch (error) {
          results.errors.push(`Error verifying ${relativePath}: ${error.message}`);
          results.summary.failedFiles++;
        }
      }

      // Check for new files not in checksum file
      const currentFiles = await this.getFilesInDirectory(baseDirectory);
      for (const filePath of currentFiles) {
        const relativePath = path.relative(baseDirectory, filePath);
        if (!expectedChecksums[relativePath]) {
          results.new.push(relativePath);
          results.summary.newFiles++;
        }
      }

      // Determine overall validity
      results.valid = results.summary.failedFiles === 0 && results.summary.missingFiles === 0;

      const duration = Date.now() - startTime;
      console.log(`\n📊 Verification Results (${duration}ms):`);
      console.log(`   ✅ Verified: ${results.summary.verifiedFiles}`);
      console.log(`   ❌ Failed: ${results.summary.failedFiles}`);
      console.log(`   📭 Missing: ${results.summary.missingFiles}`);
      console.log(`   📄 New: ${results.summary.newFiles}`);
      console.log(`   🚨 Errors: ${results.errors.length}`);

      if (results.valid) {
        console.log(`🎉 All checksums verified successfully!`);
      } else {
        console.log(`❌ Checksum verification failed!`);
      }

      return results;

    } catch (error) {
      console.error(`❌ Failed to verify checksums: ${error.message}`);
      throw error;
    }
  }

  /**
   * Compare two checksum files
   */
  async compareChecksumFiles(file1, file2) {
    console.log(`🔍 Comparing checksum files: ${file1} vs ${file2}`);

    const results = {
      identical: true,
      changes: {
        modified: [],
        added: [],
        removed: []
      },
      summary: {
        totalChanges: 0,
        modifiedFiles: 0,
        addedFiles: 0,
        removedFiles: 0
      }
    };

    try {
      const data1 = JSON.parse(fs.readFileSync(file1, 'utf8'));
      const data2 = JSON.parse(fs.readFileSync(file2, 'utf8'));

      const checksums1 = data1.checksums;
      const checksums2 = data2.checksums;

      // Find modified and removed files
      for (const [filePath, data] of Object.entries(checksums1)) {
        if (checksums2[filePath]) {
          if (checksums2[filePath].checksum !== data.checksum) {
            results.changes.modified.push({
              file: filePath,
              oldChecksum: data.checksum,
              newChecksum: checksums2[filePath].checksum,
              oldSize: data.size,
              newSize: checksums2[filePath].size
            });
            results.summary.modifiedFiles++;
          }
        } else {
          results.changes.removed.push(filePath);
          results.summary.removedFiles++;
        }
      }

      // Find added files
      for (const filePath of Object.keys(checksums2)) {
        if (!checksums1[filePath]) {
          results.changes.added.push(filePath);
          results.summary.addedFiles++;
        }
      }

      results.summary.totalChanges = results.summary.modifiedFiles + results.summary.addedFiles + results.summary.removedFiles;
      results.identical = results.summary.totalChanges === 0;

      console.log(`\n📊 Comparison Results:`);
      console.log(`   📝 Modified: ${results.summary.modifiedFiles}`);
      console.log(`   ➕ Added: ${results.summary.addedFiles}`);
      console.log(`   ➖ Removed: ${results.summary.removedFiles}`);
      console.log(`   📊 Total Changes: ${results.summary.totalChanges}`);

      if (results.identical) {
        console.log(`✅ Checksum files are identical`);
      } else {
        console.log(`📋 ${results.summary.totalChanges} differences found`);
      }

      return results;

    } catch (error) {
      console.error(`❌ Failed to compare checksum files: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate manifest file with checksums
   */
  async generateManifest(directoryPath, manifestFile) {
    console.log(`📋 Generating manifest for: ${directoryPath}`);

    const checksumData = await this.generateDirectoryChecksums(directoryPath);

    const manifest = {
      name: path.basename(directoryPath),
      version: this.extractVersionFromPackageJson(directoryPath) || '1.0.0',
      generated: new Date().toISOString(),
      algorithm: this.options.algorithm,
      files: []
    };

    // Convert checksums to manifest format
    for (const [filePath, data] of Object.entries(checksumData.checksums)) {
      manifest.files.push({
        path: filePath,
        checksum: data.checksum,
        size: data.size,
        required: this.isRequiredFile(filePath)
      });
    }

    // Add dependencies if package.json exists
    const packageJsonPath = path.join(directoryPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        manifest.dependencies = packageJson.dependencies || {};
      } catch (error) {
        console.warn(`⚠️ Could not parse package.json: ${error.message}`);
      }
    }

    // Sign manifest
    manifest.signature = this.signManifest(manifest);
    manifest.timestamp = Date.now();

    if (manifestFile) {
      fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
      console.log(`💾 Manifest saved to: ${manifestFile}`);
    }

    return manifest;
  }

  /**
   * Batch process multiple directories
   */
  async batchGenerateChecksums(directories, outputDir) {
    console.log(`🔄 Batch processing ${directories.length} directories`);

    const results = [];
    const startTime = Date.now();

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    for (let i = 0; i < directories.length; i++) {
      const dir = directories[i];
      console.log(`\n📁 Processing ${i + 1}/${directories.length}: ${dir}`);

      try {
        const dirName = path.basename(dir);
        const outputFile = path.join(outputDir, `${dirName}-checksums.json`);

        const result = await this.generateDirectoryChecksums(dir, outputFile);
        results.push({
          directory: dir,
          outputFile,
          success: true,
          fileCount: result.summary.totalFiles,
          processingTime: result.summary.processingTime
        });
      } catch (error) {
        console.error(`❌ Failed to process ${dir}: ${error.message}`);
        results.push({
          directory: dir,
          success: false,
          error: error.message
        });
      }
    }

    const totalTime = Date.now() - startTime;
    const successful = results.filter(r => r.success).length;

    console.log(`\n🎉 Batch processing completed in ${totalTime}ms`);
    console.log(`   ✅ Successful: ${successful}/${directories.length}`);
    console.log(`   ❌ Failed: ${directories.length - successful}/${directories.length}`);

    return results;
  }

  // Helper methods
  async getFilesInDirectory(directoryPath) {
    const patterns = ['**/*'];
    const options = {
      cwd: directoryPath,
      nodir: true,
      ignore: this.options.excludePatterns,
      absolute: true
    };

    return glob(patterns, options);
  }

  extractVersionFromPackageJson(directoryPath) {
    const packageJsonPath = path.join(directoryPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        return packageJson.version;
      } catch (error) {
        return null;
      }
    }
    return null;
  }

  isRequiredFile(filePath) {
    const requiredPatterns = [
      /^package\.json$/,
      /^LICENSE/i,
      /^README/i,
      /\.exe$/,
      /\.dll$/,
      /\.so$/,
      /main\./
    ];

    return requiredPatterns.some(pattern => pattern.test(filePath));
  }

  signManifest(manifest) {
    // Simple signature generation (in production, use proper cryptographic signing)
    const manifestString = JSON.stringify({
      name: manifest.name,
      version: manifest.version,
      files: manifest.files
    });

    return crypto.createHash('sha256').update(manifestString).digest('hex');
  }

  /**
   * Watch directory for changes and update checksums
   */
  watchDirectory(directoryPath, checksumFile, callback) {
    console.log(`👀 Watching directory for changes: ${directoryPath}`);

    let debounceTimer = null;

    const watcher = fs.watch(directoryPath, { recursive: true }, (eventType, filename) => {
      if (filename && !this.shouldIgnoreFile(filename)) {
        console.log(`📝 File changed: ${filename} (${eventType})`);

        // Debounce rapid changes
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          try {
            console.log('🔄 Regenerating checksums...');
            const result = await this.generateDirectoryChecksums(directoryPath, checksumFile);
            if (callback) callback(null, result);
          } catch (error) {
            console.error(`❌ Error regenerating checksums: ${error.message}`);
            if (callback) callback(error);
          }
        }, 2000); // 2 second delay
      }
    });

    return {
      stop: () => {
        watcher.close();
        console.log('🛑 Stopped watching directory');
      }
    };
  }

  shouldIgnoreFile(filename) {
    return this.options.excludePatterns.some(pattern => {
      // Convert glob pattern to regex for simple check
      const regexPattern = pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*');
      return new RegExp(regexPattern).test(filename);
    });
  }
}

// Export for testing
module.exports = { ChecksumGenerator };

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'generate':
      generateFromCLI(args.slice(1));
      break;
    case 'verify':
      verifyFromCLI(args.slice(1));
      break;
    case 'compare':
      compareFromCLI(args.slice(1));
      break;
    case 'manifest':
      manifestFromCLI(args.slice(1));
      break;
    case 'batch':
      batchFromCLI(args.slice(1));
      break;
    case 'watch':
      watchFromCLI(args.slice(1));
      break;
    default:
      console.log(`
Checksum Generator v1.0.0

Usage: node checksum-generator.js <command> [options]

Commands:
  generate <directory> [output-file]     - Generate checksums for directory
  verify <checksum-file> <directory>     - Verify checksums against directory
  compare <file1> <file2>                - Compare two checksum files
  manifest <directory> [output-file]     - Generate deployment manifest
  batch <dirs...> <output-dir>           - Batch process multiple directories
  watch <directory> <checksum-file>      - Watch directory and auto-update checksums

Examples:
  node checksum-generator.js generate ./dist ./checksums.json
  node checksum-generator.js verify ./checksums.json ./dist
  node checksum-generator.js compare ./old-checksums.json ./new-checksums.json
  node checksum-generator.js manifest ./dist ./manifest.json
  node checksum-generator.js batch ./app1 ./app2 ./checksums
  node checksum-generator.js watch ./src ./src-checksums.json

Options:
  --algorithm <alg>     Hash algorithm (default: sha256)
  --exclude <pattern>   Additional exclude pattern
  --help               Show this help message
      `);
  }
}

async function generateFromCLI(args) {
  const directory = args[0];
  const outputFile = args[1];

  if (!directory) {
    console.error('Directory path required');
    process.exit(1);
  }

  try {
    const generator = new ChecksumGenerator();
    await generator.generateDirectoryChecksums(directory, outputFile);
  } catch (error) {
    console.error('Generation failed:', error.message);
    process.exit(1);
  }
}

async function verifyFromCLI(args) {
  const checksumFile = args[0];
  const directory = args[1];

  if (!checksumFile || !directory) {
    console.error('Checksum file and directory paths required');
    process.exit(1);
  }

  try {
    const generator = new ChecksumGenerator();
    const result = await generator.verifyChecksums(checksumFile, directory);
    process.exit(result.valid ? 0 : 1);
  } catch (error) {
    console.error('Verification failed:', error.message);
    process.exit(1);
  }
}

async function compareFromCLI(args) {
  const file1 = args[0];
  const file2 = args[1];

  if (!file1 || !file2) {
    console.error('Two checksum files required');
    process.exit(1);
  }

  try {
    const generator = new ChecksumGenerator();
    const result = await generator.compareChecksumFiles(file1, file2);
    process.exit(result.identical ? 0 : 1);
  } catch (error) {
    console.error('Comparison failed:', error.message);
    process.exit(1);
  }
}

async function manifestFromCLI(args) {
  const directory = args[0];
  const outputFile = args[1];

  if (!directory) {
    console.error('Directory path required');
    process.exit(1);
  }

  try {
    const generator = new ChecksumGenerator();
    await generator.generateManifest(directory, outputFile);
  } catch (error) {
    console.error('Manifest generation failed:', error.message);
    process.exit(1);
  }
}

async function watchFromCLI(args) {
  const directory = args[0];
  const checksumFile = args[1];

  if (!directory || !checksumFile) {
    console.error('Directory and checksum file paths required');
    process.exit(1);
  }

  try {
    const generator = new ChecksumGenerator();
    const watcher = generator.watchDirectory(directory, checksumFile, (error, result) => {
      if (error) {
        console.error('Watch error:', error.message);
      } else {
        console.log(`✅ Updated checksums for ${result.summary.totalFiles} files`);
      }
    });

    // Keep process running
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping watcher...');
      watcher.stop();
      process.exit(0);
    });

    console.log('Press Ctrl+C to stop watching');
  } catch (error) {
    console.error('Watch setup failed:', error.message);
    process.exit(1);
  }
}