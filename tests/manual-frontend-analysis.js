#!/usr/bin/env node

/**
 * Manual Frontend Analysis Tool
 * Accenture Mainframe AI Assistant
 *
 * Simple analysis tool using built-in Node.js capabilities
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

class ManualFrontendAnalyzer {
    constructor() {
        this.results = {
            serverStatus: null,
            fileChecks: [],
            cssAnalysis: [],
            jsAnalysis: [],
            htmlStructure: null,
            recommendations: []
        };
    }

    async checkServerStatus(port = 3001) {
        console.log(`🔍 Checking server status on port ${port}...`);

        return new Promise((resolve) => {
            const req = http.get(`http://localhost:${port}`, (res) => {
                this.results.serverStatus = {
                    status: 'OK',
                    statusCode: res.statusCode,
                    headers: res.headers
                };
                console.log(`✅ Server responding: ${res.statusCode}`);
                resolve(true);
            });

            req.on('error', (error) => {
                this.results.serverStatus = {
                    status: 'ERROR',
                    error: error.message
                };
                console.log(`❌ Server error: ${error.message}`);
                resolve(false);
            });

            req.setTimeout(5000, () => {
                this.results.serverStatus = {
                    status: 'TIMEOUT',
                    error: 'Request timeout'
                };
                console.log(`⏰ Server timeout`);
                resolve(false);
            });
        });
    }

    analyzeHTMLFile(filePath) {
        console.log(`📄 Analyzing HTML file: ${filePath}`);

        try {
            const content = fs.readFileSync(filePath, 'utf8');

            const analysis = {
                fileSize: content.length,
                hasReact: content.includes('React') || content.includes('react'),
                hasCSS: content.includes('<link') && content.includes('stylesheet'),
                hasJS: content.includes('<script'),
                hasModules: content.includes('type="module"'),
                hasErrorHandling: content.includes('error') || content.includes('catch'),
                cssFiles: [],
                jsFiles: [],
                externalResources: [],
                potentialIssues: []
            };

            // Extract CSS file references
            const cssMatches = content.match(/href=["']([^"']*\.css[^"']*)/g);
            if (cssMatches) {
                analysis.cssFiles = cssMatches.map(match =>
                    match.replace(/href=["']/, '').replace(/["']$/, '')
                );
            }

            // Extract JS file references
            const jsMatches = content.match(/src=["']([^"']*\.js[^"']*)/g);
            if (jsMatches) {
                analysis.jsFiles = jsMatches.map(match =>
                    match.replace(/src=["']/, '').replace(/["']$/, '')
                );
            }

            // Extract external resources
            const externalMatches = content.match(/(?:src|href)=["'](https?:\/\/[^"']*)/g);
            if (externalMatches) {
                analysis.externalResources = externalMatches.map(match =>
                    match.replace(/(?:src|href)=["']/, '').replace(/["']$/, '')
                );
            }

            // Check for potential issues
            if (!analysis.hasReact) {
                analysis.potentialIssues.push('No React references found');
            }

            if (analysis.cssFiles.length === 0) {
                analysis.potentialIssues.push('No CSS files referenced');
            }

            if (analysis.jsFiles.length === 0) {
                analysis.potentialIssues.push('No JavaScript files referenced');
            }

            if (content.includes('/src/renderer/index.tsx')) {
                const tsxPath = path.join(path.dirname(filePath), 'src/renderer/index.tsx');
                if (!fs.existsSync(tsxPath)) {
                    analysis.potentialIssues.push(`Main React entry point not found: ${tsxPath}`);
                }
            }

            this.results.htmlStructure = analysis;
            console.log(`✅ HTML analysis complete`);

        } catch (error) {
            console.log(`❌ HTML analysis failed: ${error.message}`);
            this.results.htmlStructure = { error: error.message };
        }
    }

    checkCSSFiles(baseDir) {
        console.log(`🎨 Checking CSS files in: ${baseDir}`);

        const cssDir = path.join(baseDir, 'src/styles');

        if (!fs.existsSync(cssDir)) {
            this.results.cssAnalysis.push({
                file: 'src/styles',
                status: 'DIRECTORY_NOT_FOUND',
                issue: 'CSS styles directory does not exist'
            });
            return;
        }

        const cssFiles = [
            'visual-hierarchy.css',
            'dropdown-system.css',
            'search-bar-enhancements.css',
            'component-layer-fixes.css',
            'integrated-dropdown-fix.css',
            'global.css',
            'components.css'
        ];

        cssFiles.forEach(filename => {
            const filePath = path.join(cssDir, filename);

            if (fs.existsSync(filePath)) {
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    this.results.cssAnalysis.push({
                        file: filename,
                        status: 'OK',
                        size: content.length,
                        hasVariables: content.includes('--') || content.includes('var('),
                        hasResponsive: content.includes('@media')
                    });
                    console.log(`✅ CSS file found: ${filename}`);
                } catch (error) {
                    this.results.cssAnalysis.push({
                        file: filename,
                        status: 'READ_ERROR',
                        error: error.message
                    });
                }
            } else {
                this.results.cssAnalysis.push({
                    file: filename,
                    status: 'NOT_FOUND',
                    issue: 'Referenced CSS file does not exist'
                });
                console.log(`❌ CSS file missing: ${filename}`);
            }
        });
    }

    checkJavaScriptStructure(baseDir) {
        console.log(`⚙️ Checking JavaScript structure in: ${baseDir}`);

        const srcDir = path.join(baseDir, 'src');
        const rendererDir = path.join(srcDir, 'renderer');

        const criticalFiles = [
            'src/renderer/index.tsx',
            'src/renderer/App.tsx',
            'package.json',
            'vite.config.ts'
        ];

        criticalFiles.forEach(relativePath => {
            const filePath = path.join(baseDir, relativePath);

            if (fs.existsSync(filePath)) {
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    this.results.jsAnalysis.push({
                        file: relativePath,
                        status: 'OK',
                        size: content.length,
                        hasImports: content.includes('import'),
                        hasReact: content.includes('React') || content.includes('react'),
                        hasTSX: filePath.endsWith('.tsx')
                    });
                    console.log(`✅ JS/TS file found: ${relativePath}`);
                } catch (error) {
                    this.results.jsAnalysis.push({
                        file: relativePath,
                        status: 'READ_ERROR',
                        error: error.message
                    });
                }
            } else {
                this.results.jsAnalysis.push({
                    file: relativePath,
                    status: 'NOT_FOUND',
                    issue: 'Critical file missing'
                });
                console.log(`❌ Critical file missing: ${relativePath}`);
            }
        });
    }

    generateRecommendations() {
        console.log(`💡 Generating recommendations...`);

        const recommendations = [];

        // Server issues
        if (this.results.serverStatus?.status !== 'OK') {
            recommendations.push({
                category: 'SERVER',
                priority: 'HIGH',
                issue: 'Server not responding properly',
                solution: 'Start development server on port 3001: python3 -m http.server 3001'
            });
        }

        // Missing CSS files
        const missingCSS = this.results.cssAnalysis.filter(css => css.status === 'NOT_FOUND');
        if (missingCSS.length > 0) {
            recommendations.push({
                category: 'CSS',
                priority: 'HIGH',
                issue: `${missingCSS.length} CSS files missing`,
                solution: 'Create missing CSS files or update file paths in HTML',
                files: missingCSS.map(css => css.file)
            });
        }

        // Missing JS files
        const missingJS = this.results.jsAnalysis.filter(js => js.status === 'NOT_FOUND');
        if (missingJS.length > 0) {
            recommendations.push({
                category: 'JAVASCRIPT',
                priority: 'HIGH',
                issue: `${missingJS.length} critical JavaScript files missing`,
                solution: 'Create missing React components and ensure proper file structure',
                files: missingJS.map(js => js.file)
            });
        }

        // HTML structure issues
        if (this.results.htmlStructure?.potentialIssues?.length > 0) {
            recommendations.push({
                category: 'HTML',
                priority: 'MEDIUM',
                issue: 'HTML structure issues detected',
                solution: 'Review HTML file and fix missing references',
                issues: this.results.htmlStructure.potentialIssues
            });
        }

        this.results.recommendations = recommendations;
    }

    generateReport() {
        const summary = {
            timestamp: new Date().toISOString(),
            serverStatus: this.results.serverStatus?.status || 'UNKNOWN',
            cssFiles: {
                total: this.results.cssAnalysis.length,
                found: this.results.cssAnalysis.filter(css => css.status === 'OK').length,
                missing: this.results.cssAnalysis.filter(css => css.status === 'NOT_FOUND').length
            },
            jsFiles: {
                total: this.results.jsAnalysis.length,
                found: this.results.jsAnalysis.filter(js => js.status === 'OK').length,
                missing: this.results.jsAnalysis.filter(js => js.status === 'NOT_FOUND').length
            },
            criticalIssues: this.results.recommendations.filter(r => r.priority === 'HIGH').length,
            recommendations: this.results.recommendations.length
        };

        return {
            summary,
            details: this.results
        };
    }

    async run() {
        console.log('🚀 Starting Manual Frontend Analysis...\n');

        try {
            // Check server
            await this.checkServerStatus(3001);

            // Analyze main HTML file
            const htmlPath = '/mnt/c/mainframe-ai-assistant/working-application.html';
            this.analyzeHTMLFile(htmlPath);

            // Check CSS files
            this.checkCSSFiles('/mnt/c/mainframe-ai-assistant');

            // Check JavaScript structure
            this.checkJavaScriptStructure('/mnt/c/mainframe-ai-assistant');

            // Generate recommendations
            this.generateRecommendations();

            // Generate final report
            const report = this.generateReport();

            // Save report
            const reportPath = '/mnt/c/mainframe-ai-assistant/test-results/manual-frontend-analysis.json';
            fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

            console.log('\n📊 FRONTEND ANALYSIS COMPLETE');
            console.log('=====================================');
            console.log(`Server Status: ${report.summary.serverStatus}`);
            console.log(`CSS Files: ${report.summary.cssFiles.found}/${report.summary.cssFiles.total} found`);
            console.log(`JS Files: ${report.summary.jsFiles.found}/${report.summary.jsFiles.total} found`);
            console.log(`Critical Issues: ${report.summary.criticalIssues}`);
            console.log(`Total Recommendations: ${report.summary.recommendations}`);
            console.log(`\nReport saved: ${reportPath}`);

            return report;

        } catch (error) {
            console.error('💥 Analysis failed:', error);
            throw error;
        }
    }
}

// Run if called directly
if (require.main === module) {
    const analyzer = new ManualFrontendAnalyzer();
    analyzer.run()
        .then(report => {
            console.log('\n✅ Analysis completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Analysis failed:', error);
            process.exit(1);
        });
}

module.exports = ManualFrontendAnalyzer;