#!/usr/bin/env node

/**
 * TypeScript Type Checking Script
 * Comprehensive type checking with detailed error reporting and performance metrics
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class TypeChecker {
    constructor() {
        this.projectRoot = process.cwd();
        this.options = this.parseArgs();
        this.results = {
            success: true,
            errors: [],
            warnings: [],
            performance: {},
            filesCovered: 0,
            totalFiles: 0
        };
    }

    parseArgs() {
        const args = process.argv.slice(2);
        return {
            test: args.includes('--test'),
            strict: args.includes('--strict'),
            watch: args.includes('--watch'),
            performance: args.includes('--performance'),
            fix: args.includes('--fix'),
            project: args.find(arg => arg.startsWith('--project='))?.split('=')[1] || 'tsconfig.json',
            output: args.find(arg => arg.startsWith('--output='))?.split('=')[1] || null,
            verbose: args.includes('--verbose') || process.env.CI === 'true'
        };
    }

    async run() {
        console.log('🔍 Starting TypeScript type checking...');
        console.log(`📁 Project: ${this.projectRoot}`);
        console.log(`⚙️  Config: ${this.options.project}`);

        const startTime = Date.now();

        try {
            // Pre-check validation
            await this.validateEnvironment();

            // Run type checking
            if (this.options.test) {
                await this.runTypeTests();
            } else {
                await this.runTypeCheck();
            }

            // Performance analysis
            if (this.options.performance) {
                await this.runPerformanceAnalysis();
            }

            // Auto-fix if requested
            if (this.options.fix) {
                await this.attemptAutoFix();
            }

            this.results.performance.totalTime = Date.now() - startTime;
            await this.generateReport();

        } catch (error) {
            this.results.success = false;
            this.results.errors.push({
                type: 'FATAL_ERROR',
                message: error.message,
                stack: error.stack
            });
        }

        await this.outputResults();
        process.exit(this.results.success ? 0 : 1);
    }

    async validateEnvironment() {
        console.log('✅ Validating environment...');

        // Check TypeScript installation
        try {
            const tscVersion = execSync('npx tsc --version', { encoding: 'utf8' }).trim();
            console.log(`📦 TypeScript: ${tscVersion}`);
        } catch (error) {
            throw new Error('TypeScript compiler not found. Run: npm install typescript');
        }

        // Check tsconfig.json exists
        const tsconfigPath = path.join(this.projectRoot, this.options.project);
        if (!fs.existsSync(tsconfigPath)) {
            throw new Error(`TypeScript config not found: ${tsconfigPath}`);
        }

        // Load and validate tsconfig
        try {
            const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
            console.log(`⚙️  Compiler options: ${Object.keys(tsconfig.compilerOptions || {}).length} options`);

            if (this.options.strict && !tsconfig.compilerOptions?.strict) {
                console.log('⚠️  Warning: Strict mode requested but not enabled in tsconfig');
            }
        } catch (error) {
            throw new Error(`Invalid tsconfig.json: ${error.message}`);
        }

        // Count source files
        this.results.totalFiles = await this.countTypeScriptFiles();
        console.log(`📄 TypeScript files: ${this.results.totalFiles}`);
    }

    async countTypeScriptFiles() {
        try {
            const output = execSync(
                'find src -name "*.ts" -o -name "*.tsx" | grep -v ".d.ts" | wc -l',
                { encoding: 'utf8', cwd: this.projectRoot }
            );
            return parseInt(output.trim()) || 0;
        } catch {
            return 0;
        }
    }

    async runTypeCheck() {
        console.log('🔍 Running TypeScript compilation check...');

        const startTime = Date.now();
        const command = this.buildTypeCheckCommand();

        return new Promise((resolve) => {
            const tsc = spawn('npx', command.split(' ').slice(1), {
                cwd: this.projectRoot,
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';

            tsc.stdout.on('data', (data) => {
                stdout += data.toString();
                if (this.options.verbose) {
                    process.stdout.write(data);
                }
            });

            tsc.stderr.on('data', (data) => {
                stderr += data.toString();
                if (this.options.verbose) {
                    process.stderr.write(data);
                }
            });

            tsc.on('close', (code) => {
                this.results.performance.typeCheckTime = Date.now() - startTime;

                if (code === 0) {
                    console.log('✅ Type checking completed successfully');
                    this.results.filesCovered = this.results.totalFiles;
                } else {
                    console.log('❌ Type checking failed');
                    this.results.success = false;
                    this.parseTypeErrors(stderr || stdout);
                }

                resolve();
            });
        });
    }

    buildTypeCheckCommand() {
        let command = `tsc --noEmit --project ${this.options.project}`;

        if (this.options.strict) {
            command += ' --strict';
        }

        if (this.options.verbose) {
            command += ' --listFiles';
        }

        return command;
    }

    async runTypeTests() {
        console.log('🧪 Running TypeScript type tests...');

        const testFiles = await this.findTypeTestFiles();
        if (testFiles.length === 0) {
            console.log('⚠️  No type test files found');
            return;
        }

        console.log(`📝 Found ${testFiles.length} type test files`);

        for (const testFile of testFiles) {
            await this.runSingleTypeTest(testFile);
        }
    }

    async findTypeTestFiles() {
        try {
            const output = execSync(
                'find src tests -name "*.type-test.ts" -o -name "*.types.test.ts" 2>/dev/null',
                { encoding: 'utf8', cwd: this.projectRoot }
            );
            return output.trim().split('\n').filter(Boolean);
        } catch {
            return [];
        }
    }

    async runSingleTypeTest(testFile) {
        console.log(`  🔍 Testing: ${testFile}`);

        try {
            execSync(`npx tsc --noEmit --skipLibCheck ${testFile}`, {
                cwd: this.projectRoot,
                stdio: this.options.verbose ? 'inherit' : 'pipe'
            });
            console.log(`  ✅ ${testFile}`);
        } catch (error) {
            console.log(`  ❌ ${testFile}`);
            this.results.success = false;
            this.results.errors.push({
                type: 'TYPE_TEST_FAILED',
                file: testFile,
                message: error.message
            });
        }
    }

    parseTypeErrors(output) {
        const lines = output.split('\n');
        let currentError = null;

        for (const line of lines) {
            // TypeScript error format: file.ts(line,col): error TS####: message
            const errorMatch = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/);

            if (errorMatch) {
                if (currentError) {
                    this.results.errors.push(currentError);
                }

                currentError = {
                    type: 'TYPESCRIPT_ERROR',
                    file: errorMatch[1],
                    line: parseInt(errorMatch[2]),
                    column: parseInt(errorMatch[3]),
                    code: errorMatch[4],
                    message: errorMatch[5],
                    context: []
                };
            } else if (currentError && line.trim()) {
                // Additional context lines
                currentError.context.push(line);
            }
        }

        if (currentError) {
            this.results.errors.push(currentError);
        }

        console.log(`❌ Found ${this.results.errors.length} type errors`);
    }

    async runPerformanceAnalysis() {
        console.log('⚡ Analyzing TypeScript performance...');

        const startTime = Date.now();

        // Run with --extendedDiagnostics
        try {
            const output = execSync(
                `npx tsc --noEmit --extendedDiagnostics --project ${this.options.project}`,
                { encoding: 'utf8', cwd: this.projectRoot }
            );

            this.parsePerformanceDiagnostics(output);
            this.results.performance.analysisTime = Date.now() - startTime;

        } catch (error) {
            console.log('⚠️  Performance analysis failed');
            this.results.warnings.push({
                type: 'PERFORMANCE_ANALYSIS_FAILED',
                message: error.message
            });
        }
    }

    parsePerformanceDiagnostics(output) {
        const lines = output.split('\n');
        const performance = {};

        for (const line of lines) {
            // Parse timing information
            const timeMatch = line.match(/(.+?):\s+(\d+(?:\.\d+)?)ms/);
            if (timeMatch) {
                const metric = timeMatch[1].trim().toLowerCase().replace(/\s+/g, '_');
                performance[metric] = parseFloat(timeMatch[2]);
            }

            // Parse file count information
            const fileMatch = line.match(/Files:\s+(\d+)/);
            if (fileMatch) {
                performance.files_processed = parseInt(fileMatch[1]);
            }

            // Parse line count information
            const lineMatch = line.match(/Lines:\s+(\d+)/);
            if (lineMatch) {
                performance.lines_processed = parseInt(lineMatch[1]);
            }
        }

        this.results.performance = { ...this.results.performance, ...performance };
        console.log(`⚡ Performance data collected: ${Object.keys(performance).length} metrics`);
    }

    async attemptAutoFix() {
        console.log('🔧 Attempting automatic fixes...');

        // Run ESLint with TypeScript rules to fix common issues
        try {
            execSync('npx eslint src --ext .ts,.tsx --fix --quiet', {
                cwd: this.projectRoot,
                stdio: this.options.verbose ? 'inherit' : 'pipe'
            });
            console.log('✅ Applied ESLint fixes');
        } catch (error) {
            this.results.warnings.push({
                type: 'AUTOFIX_FAILED',
                message: 'ESLint auto-fix failed: ' + error.message
            });
        }

        // Re-run type check to see if fixes helped
        console.log('🔍 Re-checking after fixes...');
        await this.runTypeCheck();
    }

    async generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            project: this.projectRoot,
            config: this.options.project,
            summary: {
                success: this.results.success,
                totalErrors: this.results.errors.length,
                totalWarnings: this.results.warnings.length,
                filesCovered: this.results.filesCovered,
                totalFiles: this.results.totalFiles,
                coverage: this.results.totalFiles > 0
                    ? ((this.results.filesCovered / this.results.totalFiles) * 100).toFixed(2)
                    : 0
            },
            performance: this.results.performance,
            errors: this.results.errors,
            warnings: this.results.warnings,
            environment: {
                node: process.version,
                platform: os.platform(),
                arch: os.arch(),
                memory: process.memoryUsage()
            }
        };

        if (this.options.output) {
            const outputPath = path.resolve(this.projectRoot, this.options.output);
            fs.mkdirSync(path.dirname(outputPath), { recursive: true });
            fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
            console.log(`📊 Report saved: ${outputPath}`);
        }

        this.report = report;
    }

    async outputResults() {
        console.log('\n📊 TypeScript Type Checking Results');
        console.log('=====================================');

        if (this.results.success) {
            console.log('✅ Status: PASSED');
        } else {
            console.log('❌ Status: FAILED');
        }

        console.log(`📁 Files: ${this.results.filesCovered}/${this.results.totalFiles}`);

        if (this.results.performance.totalTime) {
            console.log(`⏱️  Duration: ${this.results.performance.totalTime}ms`);
        }

        if (this.results.errors.length > 0) {
            console.log(`\n❌ Errors (${this.results.errors.length}):`);
            this.results.errors.forEach((error, index) => {
                console.log(`  ${index + 1}. ${error.file}:${error.line}:${error.column}`);
                console.log(`     ${error.code}: ${error.message}`);
            });
        }

        if (this.results.warnings.length > 0) {
            console.log(`\n⚠️  Warnings (${this.results.warnings.length}):`);
            this.results.warnings.forEach((warning, index) => {
                console.log(`  ${index + 1}. ${warning.type}: ${warning.message}`);
            });
        }

        if (this.results.performance && Object.keys(this.results.performance).length > 1) {
            console.log('\n⚡ Performance Metrics:');
            Object.entries(this.results.performance).forEach(([key, value]) => {
                if (typeof value === 'number') {
                    console.log(`  ${key}: ${value}${key.includes('time') ? 'ms' : ''}`);
                }
            });
        }

        console.log('\n');
    }
}

// Run if called directly
if (require.main === module) {
    const checker = new TypeChecker();
    checker.run().catch(console.error);
}

module.exports = { TypeChecker };