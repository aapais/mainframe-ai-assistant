#!/usr/bin/env node

/**
 * TypeScript Type Coverage Setup Script
 * Installs and configures type coverage tools with appropriate thresholds
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class TypeCoverageSetup {
    constructor() {
        this.projectRoot = process.cwd();
        this.options = this.parseArgs();
        this.config = {
            threshold: 95,
            warningThreshold: 90,
            ignoreFiles: [
                '**/*.test.ts',
                '**/*.test.tsx',
                '**/*.spec.ts',
                '**/*.spec.tsx',
                '**/*.d.ts',
                'node_modules/**/*',
                'dist/**/*',
                'build/**/*'
            ]
        };
    }

    parseArgs() {
        const args = process.argv.slice(2);
        return {
            install: !args.includes('--no-install'),
            configure: !args.includes('--no-configure'),
            threshold: parseFloat(args.find(arg => arg.startsWith('--threshold='))?.split('=')[1]) || 95,
            verbose: args.includes('--verbose')
        };
    }

    async run() {
        console.log('⚙️  Setting up TypeScript type coverage tools...');

        try {
            if (this.options.install) {
                await this.installDependencies();
            }

            if (this.options.configure) {
                await this.createConfiguration();
                await this.updatePackageScripts();
                await this.createBadgeScript();
                await this.setupCoverageThresholds();
            }

            await this.validateSetup();

            console.log('✅ Type coverage setup completed successfully!');
            this.printUsageInstructions();

        } catch (error) {
            console.error('❌ Setup failed:', error.message);
            if (this.options.verbose) {
                console.error(error.stack);
            }
            process.exit(1);
        }
    }

    async installDependencies() {
        console.log('📦 Installing type coverage dependencies...');

        const dependencies = [
            'type-coverage',
            '@typescript-eslint/typescript-estree',
            'organize-imports-cli',
            'ts-unused-exports'
        ];

        try {
            console.log('   Installing:', dependencies.join(', '));
            execSync(`npm install --save-dev ${dependencies.join(' ')}`, {
                cwd: this.projectRoot,
                stdio: this.options.verbose ? 'inherit' : 'pipe'
            });

            console.log('✅ Dependencies installed successfully');

        } catch (error) {
            throw new Error(`Failed to install dependencies: ${error.message}`);
        }
    }

    async createConfiguration() {
        console.log('⚙️  Creating type coverage configuration...');

        // Create type-coverage configuration
        const typeCoverageConfig = {
            project: './tsconfig.json',
            at: 'least',
            atLeast: this.options.threshold,
            detail: true,
            strict: true,
            reportType: ['json', 'text'],
            ignoreFiles: this.config.ignoreFiles,
            cache: true,
            enableCache: true
        };

        const configPath = path.join(this.projectRoot, '.typecoveragerc');
        fs.writeFileSync(configPath, JSON.stringify(typeCoverageConfig, null, 2));
        console.log('✅ Created .typecoveragerc');

        // Create VSCode settings for type coverage
        const vscodeDir = path.join(this.projectRoot, '.vscode');
        if (!fs.existsSync(vscodeDir)) {
            fs.mkdirSync(vscodeDir);
        }

        const vscodeSettings = {
            'typescript.preferences.includePackageJsonAutoImports': 'on',
            'typescript.suggest.autoImports': true,
            'typescript.suggest.completeFunctionCalls': true,
            'typescript.workspaceSymbols.scope': 'allOpenProjects',
            'editor.codeActionsOnSave': {
                'source.organizeImports': true,
                'source.fixAll.eslint': true
            },
            'files.associations': {
                '.typecoveragerc': 'json'
            }
        };

        const settingsPath = path.join(vscodeDir, 'settings.json');
        if (fs.existsSync(settingsPath)) {
            const existingSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            Object.assign(existingSettings, vscodeSettings);
            fs.writeFileSync(settingsPath, JSON.stringify(existingSettings, null, 2));
        } else {
            fs.writeFileSync(settingsPath, JSON.stringify(vscodeSettings, null, 2));
        }
        console.log('✅ Updated .vscode/settings.json');
    }

    async updatePackageScripts() {
        console.log('📝 Updating package.json scripts...');

        const packageJsonPath = path.join(this.projectRoot, 'package.json');
        if (!fs.existsSync(packageJsonPath)) {
            throw new Error('package.json not found');
        }

        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

        if (!packageJson.scripts) {
            packageJson.scripts = {};
        }

        // Add additional type coverage scripts
        const newScripts = {
            'type:coverage:check': 'type-coverage --at-least 95',
            'type:coverage:report': 'type-coverage --detail --reportType html && open coverage/type-coverage.html',
            'type:coverage:badge': 'node scripts/generate-type-coverage-badge.js',
            'type:coverage:trend': 'node scripts/track-type-coverage-trend.js',
            'type:unused': 'ts-unused-exports tsconfig.json --excludeDeclarationFiles',
            'type:organize': 'organize-imports-cli src/**/*.ts src/**/*.tsx',
            'type:validate': 'npm run type:check && npm run type:coverage:check && npm run type:unused',
            'type:fix': 'npm run type:organize && npm run lint:fix'
        };

        Object.assign(packageJson.scripts, newScripts);

        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
        console.log('✅ Updated package.json with type coverage scripts');
    }

    async createBadgeScript() {
        console.log('🏆 Creating type coverage badge generator...');

        const badgeScript = `#!/usr/bin/env node

/**
 * Generate Type Coverage Badge
 * Creates SVG badges for type coverage percentage
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function generateBadge() {
    try {
        // Run type-coverage and parse output
        const output = execSync('npx type-coverage --reportType json', {
            encoding: 'utf8',
            cwd: process.cwd()
        });

        const coverage = JSON.parse(output);
        const percentage = coverage.percentage.toFixed(1);

        let color = 'red';
        if (coverage.percentage >= 95) color = 'brightgreen';
        else if (coverage.percentage >= 90) color = 'green';
        else if (coverage.percentage >= 80) color = 'yellow';
        else if (coverage.percentage >= 70) color = 'orange';

        const badgeUrl = \`https://img.shields.io/badge/Type_Coverage-\${percentage}%25-\${color}\`;

        console.log(\`Type Coverage: \${percentage}%\`);
        console.log(\`Badge URL: \${badgeUrl}\`);
        console.log(\`Markdown: ![Type Coverage](\${badgeUrl})\`);

        // Save badge URL to file for README usage
        const badgeInfo = {
            percentage: parseFloat(percentage),
            color: color,
            url: badgeUrl,
            markdown: \`![Type Coverage](\${badgeUrl})\`,
            timestamp: new Date().toISOString()
        };

        fs.writeFileSync('coverage/type-coverage-badge.json', JSON.stringify(badgeInfo, null, 2));
        console.log('✅ Badge info saved to coverage/type-coverage-badge.json');

    } catch (error) {
        console.error('❌ Failed to generate badge:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    generateBadge();
}

module.exports = { generateBadge };`;

        const badgeScriptPath = path.join(this.projectRoot, 'scripts', 'generate-type-coverage-badge.js');
        fs.writeFileSync(badgeScriptPath, badgeScript);
        fs.chmodSync(badgeScriptPath, '755');
        console.log('✅ Created type coverage badge generator');
    }

    async setupCoverageThresholds() {
        console.log('🎯 Setting up coverage thresholds...');

        const thresholdScript = `#!/usr/bin/env node

/**
 * Type Coverage Threshold Checker
 * Validates type coverage against configured thresholds
 */

const { execSync } = require('child_process');
const fs = require('fs');

const THRESHOLDS = {
    excellent: 95,
    good: 90,
    warning: 80,
    minimum: 70
};

async function checkThresholds() {
    try {
        const output = execSync('npx type-coverage --reportType json', {
            encoding: 'utf8',
            cwd: process.cwd()
        });

        const coverage = JSON.parse(output);
        const percentage = coverage.percentage;

        console.log(\`Current Type Coverage: \${percentage.toFixed(2)}%\`);

        let status = 'failing';
        let level = 'poor';
        let message = '';

        if (percentage >= THRESHOLDS.excellent) {
            status = 'excellent';
            level = 'excellent';
            message = 'Excellent type coverage! 🎉';
        } else if (percentage >= THRESHOLDS.good) {
            status = 'good';
            level = 'good';
            message = 'Good type coverage! 👍';
        } else if (percentage >= THRESHOLDS.warning) {
            status = 'warning';
            level = 'warning';
            message = 'Type coverage needs improvement ⚠️';
        } else if (percentage >= THRESHOLDS.minimum) {
            status = 'poor';
            level = 'poor';
            message = 'Type coverage is below acceptable level ❌';
        } else {
            status = 'failing';
            level = 'critical';
            message = 'Type coverage is critically low! 🚨';
        }

        console.log(message);

        // Generate recommendations
        if (percentage < THRESHOLDS.excellent) {
            const gap = THRESHOLDS.excellent - percentage;
            console.log(\`\\n💡 To reach excellent level (95%), improve coverage by \${gap.toFixed(1)} percentage points\`);

            if (coverage.files) {
                const worstFiles = coverage.files
                    .filter(f => f.percentage < 90)
                    .sort((a, b) => a.percentage - b.percentage)
                    .slice(0, 5);

                if (worstFiles.length > 0) {
                    console.log('\\n🎯 Focus on these files:');
                    worstFiles.forEach(file => {
                        console.log(\`   • \${file.filename}: \${file.percentage.toFixed(1)}%\`);
                    });
                }
            }
        }

        // Exit with appropriate code
        const exitCode = percentage >= THRESHOLDS.minimum ? 0 : 1;
        process.exit(exitCode);

    } catch (error) {
        console.error('❌ Failed to check thresholds:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    checkThresholds();
}

module.exports = { checkThresholds, THRESHOLDS };`;

        const thresholdScriptPath = path.join(this.projectRoot, 'scripts', 'check-type-coverage-thresholds.js');
        fs.writeFileSync(thresholdScriptPath, thresholdScript);
        fs.chmodSync(thresholdScriptPath, '755');
        console.log('✅ Created type coverage threshold checker');
    }

    async validateSetup() {
        console.log('🔍 Validating type coverage setup...');

        // Check if TypeScript is available
        try {
            execSync('npx tsc --version', { stdio: 'pipe' });
            console.log('✅ TypeScript compiler available');
        } catch (error) {
            throw new Error('TypeScript compiler not found');
        }

        // Check if type-coverage is available
        try {
            execSync('npx type-coverage --version', { stdio: 'pipe' });
            console.log('✅ type-coverage tool available');
        } catch (error) {
            throw new Error('type-coverage tool not found');
        }

        // Validate tsconfig.json
        const tsconfigPath = path.join(this.projectRoot, 'tsconfig.json');
        if (!fs.existsSync(tsconfigPath)) {
            throw new Error('tsconfig.json not found');
        }

        try {
            JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
            console.log('✅ tsconfig.json is valid');
        } catch (error) {
            throw new Error('Invalid tsconfig.json');
        }

        // Test type coverage command
        try {
            console.log('🧪 Testing type coverage...');
            execSync('npx type-coverage --reportType text', {
                stdio: this.options.verbose ? 'inherit' : 'pipe'
            });
            console.log('✅ Type coverage test successful');
        } catch (error) {
            console.warn('⚠️  Type coverage test failed (this may be normal for new projects)');
        }
    }

    printUsageInstructions() {
        console.log('\\n📚 Usage Instructions');
        console.log('=====================');
        console.log('');
        console.log('Available type coverage commands:');
        console.log('  npm run type:coverage        - Generate detailed coverage report');
        console.log('  npm run type:coverage:check  - Check if coverage meets threshold');
        console.log('  npm run type:coverage:badge  - Generate coverage badge');
        console.log('  npm run type:unused          - Find unused exports');
        console.log('  npm run type:organize        - Organize TypeScript imports');
        console.log('  npm run type:validate        - Run all type validations');
        console.log('');
        console.log('Integration:');
        console.log('  • Pre-commit hooks are configured to run type checking');
        console.log('  • GitHub Actions will run type coverage on every push');
        console.log('  • Coverage reports are saved to ./coverage/ directory');
        console.log('');
        console.log('Configuration:');
        console.log('  • .typecoveragerc      - Type coverage settings');
        console.log('  • .pre-commit-config.yaml - Pre-commit hook configuration');
        console.log('  • .github/workflows/   - CI/CD configuration');
        console.log('');
        console.log('Next steps:');
        console.log('  1. Run "npm run type:coverage" to get baseline coverage');
        console.log('  2. Commit the configuration files to git');
        console.log('  3. Set up pre-commit hooks with "pre-commit install"');
        console.log('  4. Start improving type coverage in files with low scores');
    }
}

// Run if called directly
if (require.main === module) {
    const setup = new TypeCoverageSetup();
    setup.run().catch(console.error);
}

module.exports = { TypeCoverageSetup };