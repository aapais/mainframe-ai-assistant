#!/usr/bin/env node

/**
 * TypeScript Type Coverage Reporter
 * Generates detailed type coverage reports and tracks type safety metrics
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class TypeCoverageReporter {
    constructor() {
        this.projectRoot = process.cwd();
        this.options = this.parseArgs();
        this.coverage = {
            overall: 0,
            files: [],
            summary: {},
            thresholds: {
                minimum: 95,
                warning: 90,
                good: 95
            }
        };
    }

    parseArgs() {
        const args = process.argv.slice(2);
        return {
            detailed: args.includes('--detailed'),
            json: args.includes('--json'),
            html: args.includes('--html'),
            badge: args.includes('--badge'),
            threshold: parseFloat(args.find(arg => arg.startsWith('--threshold='))?.split('=')[1]) || 95,
            output: args.find(arg => arg.startsWith('--output='))?.split('=')[1] || 'coverage',
            project: args.find(arg => arg.startsWith('--project='))?.split('=')[1] || 'tsconfig.json',
            exclude: args.filter(arg => arg.startsWith('--exclude=')).map(arg => arg.split('=')[1]),
            verbose: args.includes('--verbose') || process.env.CI === 'true'
        };
    }

    async run() {
        console.log('📊 Generating TypeScript type coverage report...');

        try {
            // Check if type-coverage is installed
            await this.checkDependencies();

            // Generate coverage data
            await this.generateCoverage();

            // Process and analyze coverage
            await this.analyzeCoverage();

            // Generate reports
            await this.generateReports();

            // Check thresholds
            const passed = await this.checkThresholds();

            console.log('\n✅ Type coverage analysis completed');
            process.exit(passed ? 0 : 1);

        } catch (error) {
            console.error('❌ Type coverage analysis failed:', error.message);
            if (this.options.verbose) {
                console.error(error.stack);
            }
            process.exit(1);
        }
    }

    async checkDependencies() {
        try {
            execSync('npx type-coverage --version', { stdio: 'pipe' });
        } catch (error) {
            console.log('📦 Installing type-coverage...');
            execSync('npm install --no-save type-coverage', { stdio: 'inherit' });
        }
    }

    async generateCoverage() {
        console.log('🔍 Analyzing type coverage...');

        const excludePatterns = [
            'node_modules',
            'dist',
            'build',
            '**/*.d.ts',
            '**/*.test.ts',
            '**/*.test.tsx',
            '**/*.spec.ts',
            '**/*.spec.tsx',
            ...this.options.exclude
        ];

        const excludeArgs = excludePatterns.map(pattern => `--ignore-files "${pattern}"`).join(' ');

        try {
            // Generate detailed coverage report
            const output = execSync(
                `npx type-coverage --detail --strict --project ${this.options.project} ${excludeArgs}`,
                { encoding: 'utf8', cwd: this.projectRoot }
            );

            this.parseCoverageOutput(output);

            // Generate JSON output for programmatic use
            const jsonOutput = execSync(
                `npx type-coverage --detail --strict --project ${this.options.project} ${excludeArgs} --reportType json`,
                { encoding: 'utf8', cwd: this.projectRoot }
            );

            this.parseJsonCoverage(jsonOutput);

        } catch (error) {
            // type-coverage exits with non-zero on coverage below 100%, so we handle this
            if (error.stdout) {
                this.parseCoverageOutput(error.stdout);
            }
            if (error.stderr && !error.stdout) {
                throw new Error(`Type coverage failed: ${error.stderr}`);
            }
        }
    }

    parseCoverageOutput(output) {
        const lines = output.split('\n');
        let currentFile = null;

        for (const line of lines) {
            // Overall coverage percentage
            const overallMatch = line.match(/(\d+\.\d+)% type coverage/);
            if (overallMatch) {
                this.coverage.overall = parseFloat(overallMatch[1]);
                continue;
            }

            // File-specific coverage
            const fileMatch = line.match(/^(.+?): (\d+\.\d+)% \((\d+)\/(\d+)\)/);
            if (fileMatch) {
                const [, filePath, percentage, covered, total] = fileMatch;
                this.coverage.files.push({
                    path: filePath,
                    percentage: parseFloat(percentage),
                    covered: parseInt(covered),
                    total: parseInt(total),
                    uncoveredLines: []
                });
                currentFile = this.coverage.files[this.coverage.files.length - 1];
                continue;
            }

            // Uncovered lines
            const lineMatch = line.match(/^\s+line (\d+): (.+)$/);
            if (lineMatch && currentFile) {
                currentFile.uncoveredLines.push({
                    line: parseInt(lineMatch[1]),
                    reason: lineMatch[2]
                });
            }
        }

        console.log(`📊 Overall type coverage: ${this.coverage.overall.toFixed(2)}%`);
        console.log(`📁 Files analyzed: ${this.coverage.files.length}`);
    }

    parseJsonCoverage(jsonOutput) {
        try {
            const data = JSON.parse(jsonOutput);
            this.coverage.summary = {
                totalFiles: data.fileCounts.sourceFileCount,
                coveredFiles: data.fileCounts.correctCount,
                totalLines: data.fileCounts.totalCount,
                coveredLines: data.fileCounts.correctCount,
                percentage: data.percentage
            };
        } catch (error) {
            console.warn('⚠️  Could not parse JSON coverage output');
        }
    }

    async analyzeCoverage() {
        console.log('🔍 Analyzing coverage patterns...');

        // Categorize files by coverage level
        const categories = {
            excellent: [], // >= 95%
            good: [],      // >= 90%
            warning: [],   // >= 80%
            poor: []       // < 80%
        };

        for (const file of this.coverage.files) {
            if (file.percentage >= 95) {
                categories.excellent.push(file);
            } else if (file.percentage >= 90) {
                categories.good.push(file);
            } else if (file.percentage >= 80) {
                categories.warning.push(file);
            } else {
                categories.poor.push(file);
            }
        }

        this.coverage.categories = categories;

        // Find common uncovered patterns
        const reasonCounts = {};
        for (const file of this.coverage.files) {
            for (const line of file.uncoveredLines) {
                reasonCounts[line.reason] = (reasonCounts[line.reason] || 0) + 1;
            }
        }

        this.coverage.commonIssues = Object.entries(reasonCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([reason, count]) => ({ reason, count }));

        // Calculate directory-level coverage
        const dirCoverage = {};
        for (const file of this.coverage.files) {
            const dir = path.dirname(file.path);
            if (!dirCoverage[dir]) {
                dirCoverage[dir] = { files: [], totalCovered: 0, totalLines: 0 };
            }
            dirCoverage[dir].files.push(file);
            dirCoverage[dir].totalCovered += file.covered;
            dirCoverage[dir].totalLines += file.total;
        }

        this.coverage.directories = Object.entries(dirCoverage)
            .map(([dir, data]) => ({
                directory: dir,
                fileCount: data.files.length,
                percentage: data.totalLines > 0 ? (data.totalCovered / data.totalLines) * 100 : 0,
                covered: data.totalCovered,
                total: data.totalLines
            }))
            .sort((a, b) => a.percentage - b.percentage);

        console.log('📈 Analysis completed');
    }

    async generateReports() {
        console.log('📝 Generating coverage reports...');

        const outputDir = path.resolve(this.projectRoot, this.options.output);
        fs.mkdirSync(outputDir, { recursive: true });

        // Always generate JSON report
        await this.generateJsonReport(outputDir);

        if (this.options.html) {
            await this.generateHtmlReport(outputDir);
        }

        if (this.options.badge) {
            await this.generateBadge(outputDir);
        }

        if (this.options.detailed) {
            await this.generateDetailedReport(outputDir);
        }
    }

    async generateJsonReport(outputDir) {
        const jsonReport = {
            timestamp: new Date().toISOString(),
            overall: this.coverage.overall,
            summary: this.coverage.summary,
            threshold: this.options.threshold,
            passed: this.coverage.overall >= this.options.threshold,
            files: this.coverage.files,
            categories: Object.entries(this.coverage.categories).reduce((acc, [key, files]) => {
                acc[key] = { count: files.length, percentage: files.length / this.coverage.files.length * 100 };
                return acc;
            }, {}),
            directories: this.coverage.directories,
            commonIssues: this.coverage.commonIssues
        };

        const jsonPath = path.join(outputDir, 'type-coverage.json');
        fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));
        console.log(`📄 JSON report: ${jsonPath}`);
    }

    async generateHtmlReport(outputDir) {
        const htmlContent = this.generateHtmlContent();
        const htmlPath = path.join(outputDir, 'type-coverage.html');
        fs.writeFileSync(htmlPath, htmlContent);
        console.log(`🌐 HTML report: ${htmlPath}`);
    }

    generateHtmlContent() {
        const { excellent, good, warning, poor } = this.coverage.categories;

        return `
<!DOCTYPE html>
<html>
<head>
    <title>TypeScript Type Coverage Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { border-bottom: 3px solid #007acc; padding-bottom: 20px; margin-bottom: 30px; }
        .metric { display: inline-block; margin: 10px 20px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; color: #007acc; }
        .metric-label { color: #666; font-size: 0.9em; }
        .coverage-bar { height: 20px; background: #e0e0e0; border-radius: 10px; margin: 10px 0; }
        .coverage-fill { height: 100%; border-radius: 10px; transition: width 0.3s; }
        .excellent { background: #4caf50; }
        .good { background: #8bc34a; }
        .warning { background: #ff9800; }
        .poor { background: #f44336; }
        .file-list { margin: 20px 0; }
        .file-item { padding: 10px; border-left: 4px solid #ddd; margin: 5px 0; background: #f9f9f9; }
        .file-item.excellent { border-color: #4caf50; }
        .file-item.good { border-color: #8bc34a; }
        .file-item.warning { border-color: #ff9800; }
        .file-item.poor { border-color: #f44336; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #007acc; color: white; }
        tr:hover { background: #f5f5f5; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .summary-card { background: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #e9ecef; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>TypeScript Type Coverage Report</h1>
            <p>Generated on ${new Date().toLocaleString()}</p>
        </div>

        <div class="summary-grid">
            <div class="summary-card">
                <div class="metric">
                    <div class="metric-value">${this.coverage.overall.toFixed(1)}%</div>
                    <div class="metric-label">Overall Coverage</div>
                </div>
                <div class="coverage-bar">
                    <div class="coverage-fill ${this.getCoverageClass(this.coverage.overall)}"
                         style="width: ${this.coverage.overall}%"></div>
                </div>
            </div>

            <div class="summary-card">
                <div class="metric">
                    <div class="metric-value">${this.coverage.files.length}</div>
                    <div class="metric-label">Files Analyzed</div>
                </div>
            </div>

            <div class="summary-card">
                <div class="metric">
                    <div class="metric-value">${excellent.length}</div>
                    <div class="metric-label">Excellent Files (≥95%)</div>
                </div>
            </div>

            <div class="summary-card">
                <div class="metric">
                    <div class="metric-value">${poor.length}</div>
                    <div class="metric-label">Files Need Attention (<80%)</div>
                </div>
            </div>
        </div>

        <h2>Files by Category</h2>

        ${excellent.length > 0 ? `
        <h3>✅ Excellent Coverage (≥95%)</h3>
        <div class="file-list">
            ${excellent.map(file => `
                <div class="file-item excellent">
                    <strong>${file.path}</strong> - ${file.percentage.toFixed(1)}%
                    (${file.covered}/${file.total} lines)
                </div>
            `).join('')}
        </div>
        ` : ''}

        ${good.length > 0 ? `
        <h3>✅ Good Coverage (90-94%)</h3>
        <div class="file-list">
            ${good.map(file => `
                <div class="file-item good">
                    <strong>${file.path}</strong> - ${file.percentage.toFixed(1)}%
                    (${file.covered}/${file.total} lines)
                </div>
            `).join('')}
        </div>
        ` : ''}

        ${warning.length > 0 ? `
        <h3>⚠️ Needs Improvement (80-89%)</h3>
        <div class="file-list">
            ${warning.map(file => `
                <div class="file-item warning">
                    <strong>${file.path}</strong> - ${file.percentage.toFixed(1)}%
                    (${file.covered}/${file.total} lines)
                    ${file.uncoveredLines.length > 0 ? `
                        <ul>
                            ${file.uncoveredLines.slice(0, 5).map(line =>
                                `<li>Line ${line.line}: ${line.reason}</li>`
                            ).join('')}
                            ${file.uncoveredLines.length > 5 ? `<li>... and ${file.uncoveredLines.length - 5} more</li>` : ''}
                        </ul>
                    ` : ''}
                </div>
            `).join('')}
        </div>
        ` : ''}

        ${poor.length > 0 ? `
        <h3>❌ Needs Attention (<80%)</h3>
        <div class="file-list">
            ${poor.map(file => `
                <div class="file-item poor">
                    <strong>${file.path}</strong> - ${file.percentage.toFixed(1)}%
                    (${file.covered}/${file.total} lines)
                    ${file.uncoveredLines.length > 0 ? `
                        <ul>
                            ${file.uncoveredLines.slice(0, 5).map(line =>
                                `<li>Line ${line.line}: ${line.reason}</li>`
                            ).join('')}
                            ${file.uncoveredLines.length > 5 ? `<li>... and ${file.uncoveredLines.length - 5} more</li>` : ''}
                        </ul>
                    ` : ''}
                </div>
            `).join('')}
        </div>
        ` : ''}

        ${this.coverage.commonIssues.length > 0 ? `
        <h2>Common Issues</h2>
        <table>
            <tr><th>Issue</th><th>Occurrences</th></tr>
            ${this.coverage.commonIssues.map(issue => `
                <tr>
                    <td>${issue.reason}</td>
                    <td>${issue.count}</td>
                </tr>
            `).join('')}
        </table>
        ` : ''}

        <h2>Directory Coverage</h2>
        <table>
            <tr><th>Directory</th><th>Files</th><th>Coverage</th><th>Details</th></tr>
            ${this.coverage.directories.map(dir => `
                <tr>
                    <td>${dir.directory}</td>
                    <td>${dir.fileCount}</td>
                    <td>${dir.percentage.toFixed(1)}%</td>
                    <td>${dir.covered}/${dir.total} lines</td>
                </tr>
            `).join('')}
        </table>
    </div>
</body>
</html>`;
    }

    getCoverageClass(percentage) {
        if (percentage >= 95) return 'excellent';
        if (percentage >= 90) return 'good';
        if (percentage >= 80) return 'warning';
        return 'poor';
    }

    async generateBadge(outputDir) {
        const percentage = this.coverage.overall.toFixed(1);
        let color = 'red';

        if (this.coverage.overall >= 95) color = 'brightgreen';
        else if (this.coverage.overall >= 90) color = 'yellow';
        else if (this.coverage.overall >= 80) color = 'orange';

        try {
            const badgeUrl = `https://img.shields.io/badge/Type_Coverage-${percentage}%25-${color}`;
            const response = await fetch(badgeUrl);
            const badgeContent = await response.text();

            const badgePath = path.join(outputDir, 'type-coverage-badge.svg');
            fs.writeFileSync(badgePath, badgeContent);
            console.log(`🏆 Coverage badge: ${badgePath}`);
        } catch (error) {
            console.warn('⚠️  Could not generate coverage badge:', error.message);
        }
    }

    async generateDetailedReport(outputDir) {
        const detailedPath = path.join(outputDir, 'type-coverage-detailed.txt');
        let content = `TypeScript Type Coverage Detailed Report
Generated: ${new Date().toISOString()}
Overall Coverage: ${this.coverage.overall.toFixed(2)}%
Threshold: ${this.options.threshold}%
Status: ${this.coverage.overall >= this.options.threshold ? 'PASSED' : 'FAILED'}

Files Analyzed: ${this.coverage.files.length}
==========================================

`;

        // Add file details
        for (const file of this.coverage.files.sort((a, b) => a.percentage - b.percentage)) {
            content += `${file.path}: ${file.percentage.toFixed(2)}% (${file.covered}/${file.total})\n`;

            if (file.uncoveredLines.length > 0) {
                content += '  Uncovered lines:\n';
                for (const line of file.uncoveredLines) {
                    content += `    Line ${line.line}: ${line.reason}\n`;
                }
            }
            content += '\n';
        }

        fs.writeFileSync(detailedPath, content);
        console.log(`📋 Detailed report: ${detailedPath}`);
    }

    async checkThresholds() {
        console.log('\n🎯 Checking coverage thresholds...');

        const threshold = this.options.threshold;
        const coverage = this.coverage.overall;

        console.log(`Target: ${threshold}%`);
        console.log(`Actual: ${coverage.toFixed(2)}%`);

        if (coverage >= threshold) {
            console.log(`✅ Coverage threshold met (${coverage.toFixed(2)}% >= ${threshold}%)`);
            return true;
        } else {
            const gap = threshold - coverage;
            console.log(`❌ Coverage below threshold (${coverage.toFixed(2)}% < ${threshold}%)`);
            console.log(`   Gap: ${gap.toFixed(2)} percentage points`);

            // Provide recommendations
            const poorFiles = this.coverage.categories.poor;
            if (poorFiles.length > 0) {
                console.log(`\n💡 Recommendations:`);
                console.log(`   - Focus on ${poorFiles.length} files with <80% coverage`);
                console.log(`   - Top priority: ${poorFiles.slice(0, 3).map(f => f.path).join(', ')}`);
            }

            return false;
        }
    }
}

// Run if called directly
if (require.main === module) {
    const reporter = new TypeCoverageReporter();
    reporter.run().catch(console.error);
}

module.exports = { TypeCoverageReporter };