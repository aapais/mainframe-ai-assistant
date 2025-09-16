import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { createHash } from 'crypto';
import { PackageValidator } from '../../scripts/validate-deployment';
import { ChecksumGenerator } from '../../scripts/checksum-generator';

interface PackageManifest {
  name: string;
  version: string;
  files: Array<{
    path: string;
    checksum: string;
    size: number;
    required: boolean;
  }>;
  dependencies: Record<string, string>;
  signature?: string;
  timestamp: number;
}

interface DeploymentPackage {
  manifest: PackageManifest;
  files: Map<string, Buffer>;
  metadata: {
    buildDate: string;
    buildEnvironment: string;
    buildCommit: string;
    platform: string;
    architecture: string;
  };
}

describe('Package Integrity Tests', () => {
  let packageValidator: PackageValidator;
  let checksumGenerator: ChecksumGenerator;
  let testPackage: DeploymentPackage;
  let tempDir: string;

  beforeAll(async () => {
    packageValidator = new PackageValidator();
    checksumGenerator = new ChecksumGenerator();
    tempDir = path.join(__dirname, 'temp-deployment');

    // Ensure clean test environment
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterAll(async () => {
    // Cleanup
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Create mock deployment package
    testPackage = createMockDeploymentPackage();
  });

  describe('File Integrity Verification', () => {
    test('should verify SHA256 checksums for all files', async () => {
      const { manifest, files } = testPackage;

      for (const fileInfo of manifest.files) {
        const fileBuffer = files.get(fileInfo.path);
        expect(fileBuffer).toBeDefined();

        const actualChecksum = createHash('sha256')
          .update(fileBuffer!)
          .digest('hex');

        expect(actualChecksum).toBe(fileInfo.checksum);
      }
    });

    test('should detect corrupted files', async () => {
      const { manifest, files } = testPackage;

      // Corrupt a file
      const firstFile = manifest.files[0];
      const corruptedContent = Buffer.from('corrupted content');
      files.set(firstFile.path, corruptedContent);

      const result = await packageValidator.validateFileIntegrity(testPackage);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(`Checksum mismatch for file: ${firstFile.path}`);
    });

    test('should verify file sizes match manifest', async () => {
      const { manifest, files } = testPackage;

      for (const fileInfo of manifest.files) {
        const fileBuffer = files.get(fileInfo.path);
        expect(fileBuffer?.length).toBe(fileInfo.size);
      }
    });

    test('should identify missing required files', async () => {
      const { manifest, files } = testPackage;

      // Remove a required file
      const requiredFile = manifest.files.find(f => f.required);
      if (requiredFile) {
        files.delete(requiredFile.path);

        const result = await packageValidator.validateFileIntegrity(testPackage);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain(`Missing required file: ${requiredFile.path}`);
      }
    });

    test('should allow missing optional files', async () => {
      const { manifest, files } = testPackage;

      // Remove an optional file
      const optionalFile = manifest.files.find(f => !f.required);
      if (optionalFile) {
        files.delete(optionalFile.path);

        const result = await packageValidator.validateFileIntegrity(testPackage);

        expect(result.warnings).toContain(`Optional file missing: ${optionalFile.path}`);
        // Should still be valid if only optional files are missing
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('Digital Signature Validation', () => {
    test('should verify package signature when present', async () => {
      const signedPackage = await createSignedPackage(testPackage);

      const result = await packageValidator.validateSignature(signedPackage);

      expect(result.valid).toBe(true);
      expect(result.signerInfo).toBeDefined();
    });

    test('should reject packages with invalid signatures', async () => {
      const packageWithInvalidSignature = {
        ...testPackage,
        manifest: {
          ...testPackage.manifest,
          signature: 'invalid-signature-data'
        }
      };

      const result = await packageValidator.validateSignature(packageWithInvalidSignature);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid package signature');
    });

    test('should handle unsigned packages appropriately', async () => {
      const unsignedPackage = {
        ...testPackage,
        manifest: {
          ...testPackage.manifest,
          signature: undefined
        }
      };

      const result = await packageValidator.validateSignature(unsignedPackage);

      expect(result.valid).toBe(false);
      expect(result.warnings).toContain('Package is not digitally signed');
    });
  });

  describe('Manifest Validation', () => {
    test('should validate manifest structure', async () => {
      const result = await packageValidator.validateManifest(testPackage.manifest);

      expect(result.valid).toBe(true);
      expect(result.manifest.name).toBeDefined();
      expect(result.manifest.version).toBeDefined();
      expect(Array.isArray(result.manifest.files)).toBe(true);
    });

    test('should reject manifests with missing required fields', async () => {
      const invalidManifest = {
        ...testPackage.manifest,
        name: undefined
      } as any;

      const result = await packageValidator.validateManifest(invalidManifest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: name');
    });

    test('should validate version format', async () => {
      const invalidVersionManifest = {
        ...testPackage.manifest,
        version: 'invalid-version'
      };

      const result = await packageValidator.validateManifest(invalidVersionManifest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid version format');
    });

    test('should validate file paths in manifest', async () => {
      const manifestWithInvalidPaths = {
        ...testPackage.manifest,
        files: [
          ...testPackage.manifest.files,
          {
            path: '../../../etc/passwd',
            checksum: 'abc123',
            size: 100,
            required: false
          }
        ]
      };

      const result = await packageValidator.validateManifest(manifestWithInvalidPaths);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid file path detected: ../../../etc/passwd');
    });
  });

  describe('Dependency Validation', () => {
    test('should verify all dependencies are included', async () => {
      const result = await packageValidator.validateDependencies(testPackage);

      expect(result.valid).toBe(true);
      expect(result.missingDependencies).toHaveLength(0);
    });

    test('should detect missing dependencies', async () => {
      const packageWithMissingDeps = {
        ...testPackage,
        manifest: {
          ...testPackage.manifest,
          dependencies: {
            ...testPackage.manifest.dependencies,
            'missing-dependency': '^1.0.0'
          }
        }
      };

      const result = await packageValidator.validateDependencies(packageWithMissingDeps);

      expect(result.valid).toBe(false);
      expect(result.missingDependencies).toContain('missing-dependency');
    });

    test('should validate dependency versions', async () => {
      const result = await packageValidator.validateDependencyVersions(testPackage);

      expect(result.valid).toBe(true);
      expect(result.versionConflicts).toHaveLength(0);
    });
  });

  describe('License Validation', () => {
    test('should verify license file presence', async () => {
      const result = await packageValidator.validateLicense(testPackage);

      expect(result.valid).toBe(true);
      expect(result.licenseFile).toBeDefined();
    });

    test('should detect missing license file', async () => {
      const packageWithoutLicense = {
        ...testPackage,
        files: new Map([...testPackage.files].filter(([path]) => !path.includes('LICENSE')))
      };

      const result = await packageValidator.validateLicense(packageWithoutLicense);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('License file not found');
    });

    test('should validate license content', async () => {
      const result = await packageValidator.validateLicenseContent(testPackage);

      expect(result.valid).toBe(true);
      expect(result.licenseType).toBeDefined();
    });
  });

  describe('Asset Validation', () => {
    test('should verify required assets are present', async () => {
      const result = await packageValidator.validateAssets(testPackage);

      expect(result.valid).toBe(true);
      expect(result.missingAssets).toHaveLength(0);
    });

    test('should validate asset file formats', async () => {
      const result = await packageValidator.validateAssetFormats(testPackage);

      expect(result.valid).toBe(true);
      expect(result.invalidFormats).toHaveLength(0);
    });

    test('should check asset file sizes', async () => {
      const result = await packageValidator.validateAssetSizes(testPackage);

      expect(result.valid).toBe(true);
      expect(result.oversizedAssets).toHaveLength(0);
    });
  });

  describe('Performance Validation', () => {
    test('should validate package size constraints', async () => {
      const result = await packageValidator.validatePackageSize(testPackage);

      expect(result.valid).toBe(true);
      expect(result.totalSize).toBeLessThan(100 * 1024 * 1024); // 100MB limit
    });

    test('should measure validation performance', async () => {
      const startTime = Date.now();

      await packageValidator.validateComplete(testPackage);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Comprehensive Validation', () => {
    test('should perform complete package validation', async () => {
      const result = await packageValidator.validateComplete(testPackage);

      expect(result.valid).toBe(true);
      expect(result.fileIntegrity.valid).toBe(true);
      expect(result.manifestValidation.valid).toBe(true);
      expect(result.dependencyValidation.valid).toBe(true);
      expect(result.licenseValidation.valid).toBe(true);
      expect(result.assetValidation.valid).toBe(true);
    });

    test('should generate detailed validation report', async () => {
      const result = await packageValidator.generateValidationReport(testPackage);

      expect(result.report).toContain('Package Validation Report');
      expect(result.report).toContain('File Integrity: PASSED');
      expect(result.report).toContain('Manifest Validation: PASSED');
      expect(result.summary.totalChecks).toBeGreaterThan(0);
      expect(result.summary.passedChecks).toEqual(result.summary.totalChecks);
    });
  });

  // Helper functions
  function createMockDeploymentPackage(): DeploymentPackage {
    const files = new Map<string, Buffer>();

    // Create mock files
    const appFile = Buffer.from('mock application content');
    const configFile = Buffer.from('mock configuration content');
    const licenseFile = Buffer.from('MIT License\n\nCopyright (c) 2024');
    const readmeFile = Buffer.from('# Application README');

    files.set('app/main.js', appFile);
    files.set('config/app.json', configFile);
    files.set('LICENSE', licenseFile);
    files.set('README.md', readmeFile);

    const manifest: PackageManifest = {
      name: 'mainframe-ai-assistant',
      version: '1.0.0',
      files: [
        {
          path: 'app/main.js',
          checksum: createHash('sha256').update(appFile).digest('hex'),
          size: appFile.length,
          required: true
        },
        {
          path: 'config/app.json',
          checksum: createHash('sha256').update(configFile).digest('hex'),
          size: configFile.length,
          required: true
        },
        {
          path: 'LICENSE',
          checksum: createHash('sha256').update(licenseFile).digest('hex'),
          size: licenseFile.length,
          required: true
        },
        {
          path: 'README.md',
          checksum: createHash('sha256').update(readmeFile).digest('hex'),
          size: readmeFile.length,
          required: false
        }
      ],
      dependencies: {
        'react': '^18.2.0',
        'typescript': '^5.0.0'
      },
      timestamp: Date.now()
    };

    return {
      manifest,
      files,
      metadata: {
        buildDate: new Date().toISOString(),
        buildEnvironment: 'test',
        buildCommit: 'abc123def456',
        platform: 'linux',
        architecture: 'x64'
      }
    };
  }

  async function createSignedPackage(pkg: DeploymentPackage): Promise<DeploymentPackage> {
    // Mock signature creation
    const manifestString = JSON.stringify(pkg.manifest);
    const signature = createHash('sha256').update(manifestString).digest('hex');

    return {
      ...pkg,
      manifest: {
        ...pkg.manifest,
        signature
      }
    };
  }
});