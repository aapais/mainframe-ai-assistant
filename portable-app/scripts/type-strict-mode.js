#!/usr/bin/env node

/**
 * TypeScript Strict Mode Validation Script
 * Validates TypeScript code against strict compilation rules
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class TypeScriptStrictValidator {
    constructor() {
        this.projectRoot = process.cwd();
        this.options = this.parseArgs();
        this.results = {
            success: true,
            errors: [],
            warnings: [],
            strictChecks: {},
            fileResults: new Map(),
            recommendations: []
        };
    }

    parseArgs() {
        const args = process.argv.slice(2);
        return {
            fix: args.includes('--fix'),
            gradual: args.includes('--gradual'),
            report: args.includes('--report'),
            project: args.find(arg => arg.startsWith('--project='))?.split('=')[1] || 'tsconfig.json',
            output: args.find(arg => arg.startsWith('--output='))?.split('=')[1] || 'coverage/strict-mode-report.json',
            verbose: args.includes('--verbose') || process.env.CI === 'true',
            allowErrors: parseInt(args.find(arg => arg.startsWith('--allow-errors='))?.split('=')[1]) || 0,
            enableAll: args.includes('--enable-all'),
            checkOnly: args.filter(arg => arg.startsWith('--check=')).map(arg => arg.split('=')[1])
        };
    }

    async run() {
        console.log('🔍 Running TypeScript strict mode validation...');
        console.log(`📁 Project: ${this.projectRoot}`);

        try {
            // Load current TypeScript configuration
            await this.loadTypeScriptConfig();

            // Run strict mode checks
            await this.runStrictChecks();

            // Generate recommendations
            await this.generateRecommendations();

            // Apply fixes if requested
            if (this.options.fix) {
                await this.applyFixes();
            }

            // Generate report
            if (this.options.report) {
                await this.generateReport();
            }

            await this.outputResults();

        } catch (error) {
            console.error('❌ Strict mode validation failed:', error.message);
            if (this.options.verbose) {
                console.error(error.stack);
            }
            process.exit(1);
        }

        const hasErrors = this.results.errors.length > this.options.allowErrors;
        process.exit(hasErrors ? 1 : 0);
    }

    async loadTypeScriptConfig() {
        const tsconfigPath = path.join(this.projectRoot, this.options.project);

        if (!fs.existsSync(tsconfigPath)) {
            throw new Error(`TypeScript config not found: ${tsconfigPath}`);
        }

        try {
            this.tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
            this.compilerOptions = this.tsconfig.compilerOptions || {};

            console.log('⚙️  Current TypeScript configuration loaded');
            if (this.options.verbose) {
                console.log(`   Strict: ${this.compilerOptions.strict || false}`);
                console.log(`   NoImplicitAny: ${this.compilerOptions.noImplicitAny || false}`);
                console.log(`   StrictNullChecks: ${this.compilerOptions.strictNullChecks || false}`);
            }

        } catch (error) {
            throw new Error(`Invalid tsconfig.json: ${error.message}`);
        }
    }

    async runStrictChecks() {
        console.log('🧪 Running strict mode checks...');

        const strictOptions = this.getStrictOptions();
        const checksToRun = this.options.checkOnly.length > 0 ? this.options.checkOnly : Object.keys(strictOptions);

        for (const checkName of checksToRun) {
            if (strictOptions[checkName]) {
                await this.runIndividualCheck(checkName, strictOptions[checkName]);
            }
        }
    }

    getStrictOptions() {
        return {
            'strict': {
                flag: '--strict',
                description: 'Enable all strict type checking options',
                priority: 'high',
                implies: ['noImplicitAny', 'strictNullChecks', 'strictFunctionTypes', 'strictPropertyInitialization']
            },
            'noImplicitAny': {
                flag: '--noImplicitAny',
                description: 'Raise error on expressions and declarations with an implied any type',
                priority: 'high',
                common: true
            },
            'strictNullChecks': {
                flag: '--strictNullChecks',
                description: 'Enable strict null checks',
                priority: 'high',
                common: true
            },
            'strictFunctionTypes': {
                flag: '--strictFunctionTypes',
                description: 'Enable strict checking of function types',
                priority: 'medium',
                common: true
            },
            'strictPropertyInitialization': {
                flag: '--strictPropertyInitialization',
                description: 'Enable strict checking of property initialization in classes',
                priority: 'medium',
                common: true
            },
            'noImplicitReturns': {
                flag: '--noImplicitReturns',
                description: 'Report error when not all code paths in function return a value',
                priority: 'medium'
            },
            'noImplicitThis': {
                flag: '--noImplicitThis',
                description: 'Raise error on this expressions with an implied any type',
                priority: 'low'
            },
            'noUnusedLocals': {
                flag: '--noUnusedLocals',
                description: 'Report errors on unused locals',
                priority: 'low',
                quality: true
            },
            'noUnusedParameters': {
                flag: '--noUnusedParameters',
                description: 'Report errors on unused parameters',
                priority: 'low',
                quality: true
            },
            'exactOptionalPropertyTypes': {
                flag: '--exactOptionalPropertyTypes',
                description: 'Interpret optional property types as written, rather than adding undefined',
                priority: 'low',
                advanced: true
            },
            'noUncheckedIndexedAccess': {
                flag: '--noUncheckedIndexedAccess',
                description: 'Include undefined in index signature results',
                priority: 'medium',
                advanced: true
            }
        };
    }

    async runIndividualCheck(checkName, checkConfig) {
        console.log(`  🔍 Checking: ${checkName}...`);

        const isCurrentlyEnabled = this.compilerOptions[checkName] === true ||
                                 (checkName === 'strict' && this.compilerOptions.strict === true);

        if (isCurrentlyEnabled && !this.options.enableAll) {
            console.log(`    ✅ Already enabled: ${checkName}`);
            this.results.strictChecks[checkName] = {
                enabled: true,
                errors: 0,
                status: 'already_enabled'
            };
            return;
        }

        const startTime = Date.now();

        try {
            // Create temporary tsconfig with this strict option enabled
            const tempConfig = await this.createTempConfig(checkName, checkConfig.flag);

            // Run TypeScript with the strict option
            const result = await this.runTypeCheckWithConfig(tempConfig);

            const duration = Date.now() - startTime;

            this.results.strictChecks[checkName] = {
                enabled: isCurrentlyEnabled,
                errors: result.errors.length,
                warnings: result.warnings.length,
                duration: duration,
                status: result.errors.length === 0 ? 'ready' : 'needs_fixes',
                errorSummary: result.errorSummary,
                config: checkConfig
            };

            if (result.errors.length === 0) {
                console.log(`    ✅ ${checkName}: Ready for adoption (${duration}ms)`);
            } else {
                console.log(`    ❌ ${checkName}: ${result.errors.length} errors found (${duration}ms)`);

                if (this.options.verbose) {
                    result.errors.slice(0, 3).forEach(error => {
                        console.log(`       • ${error.file}:${error.line} - ${error.message}`);
                    });

                    if (result.errors.length > 3) {
                        console.log(`       ... and ${result.errors.length - 3} more errors`);
                    }
                }
            }

            // Clean up temp config
            fs.unlinkSync(tempConfig);

        } catch (error) {
            console.log(`    ❌ ${checkName}: Check failed - ${error.message}`);
            this.results.strictChecks[checkName] = {
                enabled: isCurrentlyEnabled,
                errors: -1,
                status: 'check_failed',
                error: error.message,
                config: checkConfig
            };
        }
    }

    async createTempConfig(checkName, flag) {
        const tempConfigPath = path.join(this.projectRoot, `tsconfig.strict-${checkName}.json`);

        const tempConfig = {
            ...this.tsconfig,
            compilerOptions: {
                ...this.compilerOptions,
                [checkName]: true
            }
        };

        // If enabling strict, disable individual flags to avoid conflicts
        if (checkName === 'strict') {
            delete tempConfig.compilerOptions.noImplicitAny;
            delete tempConfig.compilerOptions.strictNullChecks;
            delete tempConfig.compilerOptions.strictFunctionTypes;
            delete tempConfig.compilerOptions.strictPropertyInitialization;
        }

        fs.writeFileSync(tempConfigPath, JSON.stringify(tempConfig, null, 2));
        return tempConfigPath;
    }

    async runTypeCheckWithConfig(configPath) {
        return new Promise((resolve) => {
            const tsc = spawn('npx', ['tsc', '--noEmit', '--project', configPath], {
                cwd: this.projectRoot,
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let stderr = '';
            let stdout = '';

            tsc.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            tsc.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            tsc.on('close', (code) => {
                const output = stderr || stdout;
                const result = this.parseTypeScriptOutput(output);
                resolve(result);
            });
        });
    }

    parseTypeScriptOutput(output) {
        const lines = output.split('\n');
        const errors = [];
        const warnings = [];
        const errorSummary = {};

        for (const line of lines) {
            // Parse TypeScript error format: file.ts(line,col): error TS####: message
            const errorMatch = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/);

            if (errorMatch) {
                const error = {
                    file: errorMatch[1],
                    line: parseInt(errorMatch[2]),
                    column: parseInt(errorMatch[3]),
                    code: errorMatch[4],
                    message: errorMatch[5]
                };

                errors.push(error);

                // Count error types
                if (!errorSummary[error.code]) {
                    errorSummary[error.code] = { count: 0, message: error.message };
                }
                errorSummary[error.code].count++;
            }
        }

        return { errors, warnings, errorSummary };
    }

    async generateRecommendations() {
        console.log('💡 Generating recommendations...');

        const recommendations = [];

        // Analyze results and create recommendations
        const readyChecks = Object.entries(this.results.strictChecks)
            .filter(([_, result]) => result.status === 'ready')
            .sort(([_, a], [__, b]) => {
                const priorityOrder = { high: 3, medium: 2, low: 1 };
                return (priorityOrder[b.config.priority] || 0) - (priorityOrder[a.config.priority] || 0);
            });

        if (readyChecks.length > 0) {
            recommendations.push({
                type: 'immediate_adoption',
                title: 'Ready for Immediate Adoption',
                description: 'These strict checks can be enabled immediately with no errors',
                checks: readyChecks.map(([name, _]) => name),
                priority: 'high',
                effort: 'minimal'
            });
        }

        // Checks with few errors
        const nearReadyChecks = Object.entries(this.results.strictChecks)
            .filter(([_, result]) => result.status === 'needs_fixes' && result.errors > 0 && result.errors <= 10)
            .sort(([_, a], [__, b]) => a.errors - b.errors);

        if (nearReadyChecks.length > 0) {
            recommendations.push({
                type: 'quick_fixes',
                title: 'Quick Fixes Required',
                description: 'These checks have few errors and can be adopted with minimal effort',
                checks: nearReadyChecks.map(([name, result]) => ({
                    name,
                    errors: result.errors,
                    effort: result.errors <= 5 ? 'low' : 'medium'
                })),
                priority: 'medium',
                effort: 'low_to_medium'
            });
        }

        // Gradual adoption strategy
        if (this.options.gradual) {
            const adoptionPlan = this.createGradualAdoptionPlan();
            if (adoptionPlan.phases.length > 0) {
                recommendations.push({
                    type: 'gradual_adoption',
                    title: 'Gradual Adoption Plan',
                    description: 'A phased approach to adopting strict mode',
                    ...adoptionPlan,
                    priority: 'medium',
                    effort: 'planned'
                });
            }
        }

        // Migration recommendations
        const migrationTips = this.generateMigrationTips();
        if (migrationTips.length > 0) {
            recommendations.push({
                type: 'migration_tips',
                title: 'Migration Tips',
                description: 'Strategies for addressing common strict mode issues',
                tips: migrationTips,
                priority: 'low',
                effort: 'educational'
            });
        }

        this.results.recommendations = recommendations;

        console.log(`💡 Generated ${recommendations.length} recommendations`);
    }

    createGradualAdoptionPlan() {
        const phases = [];

        // Phase 1: Enable checks with no errors
        const readyChecks = Object.entries(this.results.strictChecks)
            .filter(([_, result]) => result.status === 'ready')
            .map(([name, _]) => name);

        if (readyChecks.length > 0) {
            phases.push({
                phase: 1,
                title: 'Enable Error-Free Checks',
                checks: readyChecks,
                effort: 'minimal',
                timeline: 'immediate'
            });
        }

        // Phase 2: Fix checks with few errors
        const quickFixChecks = Object.entries(this.results.strictChecks)
            .filter(([_, result]) => result.status === 'needs_fixes' && result.errors > 0 && result.errors <= 10)
            .sort(([_, a], [__, b]) => a.errors - b.errors);

        if (quickFixChecks.length > 0) {
            phases.push({
                phase: 2,
                title: 'Quick Fixes',
                checks: quickFixChecks.map(([name, result]) => ({
                    name,
                    errors: result.errors,
                    estimatedHours: Math.ceil(result.errors * 0.5)
                })),
                effort: 'low',
                timeline: '1-2 weeks'
            });
        }

        // Phase 3: Tackle larger issues
        const majorFixChecks = Object.entries(this.results.strictChecks)
            .filter(([_, result]) => result.status === 'needs_fixes' && result.errors > 10)
            .sort(([_, a], [__, b]) => a.errors - b.errors);

        if (majorFixChecks.length > 0) {
            phases.push({
                phase: 3,
                title: 'Major Refactoring',
                checks: majorFixChecks.map(([name, result]) => ({
                    name,
                    errors: result.errors,
                    estimatedHours: Math.ceil(result.errors * 0.3)
                })),
                effort: 'high',
                timeline: '2-4 weeks'
            });
        }

        return { phases, totalPhases: phases.length };
    }

    generateMigrationTips() {
        const tips = [];

        // Analyze common error patterns
        const errorPatterns = {};

        Object.values(this.results.strictChecks).forEach(check => {
            if (check.errorSummary) {
                Object.entries(check.errorSummary).forEach(([code, info]) => {
                    if (!errorPatterns[code]) {
                        errorPatterns[code] = { count: 0, message: info.message, checks: [] };
                    }
                    errorPatterns[code].count += info.count;
                    errorPatterns[code].checks.push(check);
                });
            }
        });

        // Generate tips based on common errors
        Object.entries(errorPatterns).forEach(([code, pattern]) => {
            const tip = this.getTipForErrorCode(code, pattern);
            if (tip) {
                tips.push(tip);
            }
        });

        return tips;
    }

    getTipForErrorCode(code, pattern) {
        const tipMap = {
            'TS2304': {
                title: 'Cannot find name errors',
                description: 'Add proper type imports or declare missing types',
                solution: 'Check imports and add type declarations where needed',
                example: 'import { MyType } from "./types";'
            },
            'TS2322': {
                title: 'Type assignment errors',
                description: 'Type mismatch in assignments',
                solution: 'Add proper type annotations or use type assertions',
                example: 'const value: string = getValue() as string;'
            },
            'TS2345': {
                title: 'Argument type errors',
                description: 'Function arguments have incorrect types',
                solution: 'Check function signatures and provide correct types',
                example: 'function process(data: MyType[]): void'
            },
            'TS7053': {
                title: 'Index signature errors',
                description: 'Properties accessed with bracket notation need index signatures',
                solution: 'Add index signatures or use dot notation',
                example: 'interface MyObject { [key: string]: any; }'
            }
        };

        const tip = tipMap[code];
        if (tip) {
            return {
                ...tip,
                errorCode: code,
                occurrences: pattern.count,
                priority: pattern.count > 5 ? 'high' : 'medium'
            };
        }

        return null;
    }

    async applyFixes() {
        console.log('🔧 Attempting to apply automatic fixes...');

        // Apply fixes for ready checks
        const readyChecks = Object.entries(this.results.strictChecks)
            .filter(([_, result]) => result.status === 'ready')
            .map(([name, _]) => name);

        if (readyChecks.length > 0) {
            await this.updateTsConfig(readyChecks);
            console.log(`✅ Enabled ${readyChecks.length} strict checks`);
        }

        // Try ESLint fixes for code quality issues
        try {
            execSync('npx eslint src --ext .ts,.tsx --fix --quiet', {
                cwd: this.projectRoot,
                stdio: this.options.verbose ? 'inherit' : 'pipe'
            });
            console.log('✅ Applied ESLint fixes');
        } catch (error) {
            console.log('⚠️  ESLint fixes not applied:', error.message);
        }
    }

    async updateTsConfig(enabledChecks) {
        const tsconfigPath = path.join(this.projectRoot, this.options.project);

        // Backup original config
        const backupPath = tsconfigPath + '.backup.' + Date.now();
        fs.copyFileSync(tsconfigPath, backupPath);
        console.log(`📁 Backup created: ${backupPath}`);

        // Update config
        const updatedConfig = { ...this.tsconfig };
        if (!updatedConfig.compilerOptions) {
            updatedConfig.compilerOptions = {};
        }

        enabledChecks.forEach(checkName => {
            updatedConfig.compilerOptions[checkName] = true;
        });

        fs.writeFileSync(tsconfigPath, JSON.stringify(updatedConfig, null, 2));
        console.log(`⚙️  Updated ${tsconfigPath} with ${enabledChecks.length} strict checks`);
    }

    async generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            project: this.projectRoot,
            config: this.options.project,
            options: this.options,
            summary: {
                totalChecks: Object.keys(this.results.strictChecks).length,
                readyChecks: Object.values(this.results.strictChecks).filter(r => r.status === 'ready').length,
                needsFixesChecks: Object.values(this.results.strictChecks).filter(r => r.status === 'needs_fixes').length,
                failedChecks: Object.values(this.results.strictChecks).filter(r => r.status === 'check_failed').length,
                totalErrors: Object.values(this.results.strictChecks).reduce((sum, r) => sum + (r.errors || 0), 0),
                recommendationCount: this.results.recommendations.length
            },
            currentConfig: this.compilerOptions,
            strictChecks: this.results.strictChecks,
            recommendations: this.results.recommendations,
            environment: {
                node: process.version,
                platform: os.platform(),
                timestamp: new Date().toISOString()
            }
        };

        const outputPath = path.resolve(this.projectRoot, this.options.output);
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

        console.log(`📊 Report saved: ${outputPath}`);
    }

    async outputResults() {
        console.log('\n📊 TypeScript Strict Mode Validation Results');
        console.log('=============================================');

        const summary = {
            ready: Object.values(this.results.strictChecks).filter(r => r.status === 'ready').length,
            needsFixes: Object.values(this.results.strictChecks).filter(r => r.status === 'needs_fixes').length,
            failed: Object.values(this.results.strictChecks).filter(r => r.status === 'check_failed').length
        };

        console.log(`✅ Ready for adoption: ${summary.ready}`);
        console.log(`🔧 Needs fixes: ${summary.needsFixes}`);
        console.log(`❌ Check failed: ${summary.failed}`);

        if (summary.ready > 0) {
            console.log('\n🎯 Ready for Immediate Adoption:');
            Object.entries(this.results.strictChecks)
                .filter(([_, result]) => result.status === 'ready')
                .forEach(([name, result]) => {
                    console.log(`  ✅ ${name}: ${result.config.description}`);
                });
        }

        if (summary.needsFixes > 0) {
            console.log('\n🔧 Requires Fixes:');
            Object.entries(this.results.strictChecks)
                .filter(([_, result]) => result.status === 'needs_fixes')
                .sort(([_, a], [__, b]) => (a.errors || 0) - (b.errors || 0))
                .forEach(([name, result]) => {
                    console.log(`  ❌ ${name}: ${result.errors} errors`);
                });
        }

        if (this.results.recommendations.length > 0) {
            console.log(`\n💡 Recommendations: ${this.results.recommendations.length} available`);
            this.results.recommendations.forEach((rec, index) => {
                console.log(`  ${index + 1}. ${rec.title} (${rec.priority} priority)`);
            });
        }

        console.log('\n');
    }
}

// Run if called directly
if (require.main === module) {
    const validator = new TypeScriptStrictValidator();
    validator.run().catch(console.error);
}

module.exports = { TypeScriptStrictValidator };