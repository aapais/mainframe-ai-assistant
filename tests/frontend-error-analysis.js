#!/usr/bin/env node

/**
 * Frontend Error Analysis Tool
 * Accenture Mainframe AI Assistant
 *
 * This script uses Puppeteer to analyze frontend errors including:
 * - JavaScript console errors
 * - Network failures (404s, failed resource loads)
 * - React component errors
 * - Missing imports or dependencies
 * - CSS styling problems
 * - JavaScript runtime exceptions
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class FrontendErrorAnalyzer {
    constructor() {
        this.errors = {
            console: [],
            network: [],
            javascript: [],
            resources: [],
            performance: {},
            accessibility: []
        };
        this.browser = null;
        this.page = null;
    }

    async initialize() {
        console.log('🚀 Initializing Frontend Error Analyzer...');

        this.browser = await puppeteer.launch({
            headless: false, // Set to true for CI/CD
            devtools: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--allow-running-insecure-content',
                '--disable-features=VizDisplayCompositor'
            ]
        });

        this.page = await this.browser.newPage();

        // Set viewport for consistent testing
        await this.page.setViewport({
            width: 1920,
            height: 1080
        });

        // Enable console logging
        this.page.on('console', (msg) => {
            const type = msg.type();
            const text = msg.text();
            const location = msg.location();

            if (type === 'error' || type === 'warning') {
                this.errors.console.push({
                    type,
                    message: text,
                    location,
                    timestamp: new Date().toISOString()
                });
                console.log(`📝 Console ${type.toUpperCase()}: ${text}`);
            }
        });

        // Track network failures
        this.page.on('response', (response) => {
            const status = response.status();
            const url = response.url();

            if (status >= 400) {
                this.errors.network.push({
                    status,
                    url,
                    statusText: response.statusText(),
                    timestamp: new Date().toISOString()
                });
                console.log(`🌐 Network Error ${status}: ${url}`);
            }
        });

        // Track failed requests
        this.page.on('requestfailed', (request) => {
            this.errors.network.push({
                status: 'FAILED',
                url: request.url(),
                failure: request.failure().errorText,
                timestamp: new Date().toISOString()
            });
            console.log(`❌ Request Failed: ${request.url()} - ${request.failure().errorText}`);
        });

        // Track JavaScript errors
        this.page.on('pageerror', (error) => {
            this.errors.javascript.push({
                message: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            console.log(`💥 JavaScript Error: ${error.message}`);
        });

        console.log('✅ Puppeteer initialized successfully');
    }

    async testApplication(url = 'http://localhost:3001/working-application.html') {
        console.log(`🔍 Testing application at: ${url}`);

        try {
            // Navigate to the application
            const response = await this.page.goto(url, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            if (!response.ok()) {
                throw new Error(`Failed to load page: ${response.status()} ${response.statusText()}`);
            }

            console.log('✅ Page loaded successfully');

            // Wait for React to load
            await this.page.waitForTimeout(3000);

            // Test basic functionality
            await this.testBasicFunctionality();
            await this.testComponentRendering();
            await this.testNavigationAndModals();
            await this.testPerformance();
            await this.checkAccessibility();

        } catch (error) {
            console.error('❌ Failed to test application:', error.message);
            this.errors.javascript.push({
                message: `Test execution error: ${error.message}`,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
        }
    }

    async testBasicFunctionality() {
        console.log('🧪 Testing basic functionality...');

        try {
            // Check if React loaded
            const reactLoaded = await this.page.evaluate(() => {
                return typeof window.React !== 'undefined';
            });

            if (!reactLoaded) {
                this.errors.javascript.push({
                    message: 'React library not loaded',
                    timestamp: new Date().toISOString()
                });
            }

            // Check if root element exists and has content
            const rootHasContent = await this.page.evaluate(() => {
                const root = document.getElementById('root');
                return root && root.children.length > 0;
            });

            if (!rootHasContent) {
                this.errors.javascript.push({
                    message: 'React application not mounted to root element',
                    timestamp: new Date().toISOString()
                });
            }

            // Check for loading screen
            const loadingVisible = await this.page.$('#loading');
            if (loadingVisible) {
                const isVisible = await this.page.evaluate((el) => {
                    const style = window.getComputedStyle(el);
                    return style.display !== 'none';
                }, loadingVisible);

                if (isVisible) {
                    console.log('⚠️  Loading screen still visible - possible loading issue');
                }
            }

        } catch (error) {
            console.error('❌ Basic functionality test failed:', error.message);
        }
    }

    async testComponentRendering() {
        console.log('🎨 Testing component rendering...');

        try {
            // Check for common UI elements
            const selectors = [
                'nav', 'header', 'main', 'footer',
                '.btn', 'button',
                'input', 'select', 'textarea',
                '.modal', '.dropdown'
            ];

            for (const selector of selectors) {
                const elements = await this.page.$$(selector);
                if (elements.length === 0) {
                    console.log(`⚠️  No elements found for selector: ${selector}`);
                }
            }

            // Check for broken images
            const brokenImages = await this.page.evaluate(() => {
                const images = Array.from(document.querySelectorAll('img'));
                return images.filter(img => img.naturalWidth === 0).map(img => img.src);
            });

            if (brokenImages.length > 0) {
                this.errors.resources.push({
                    type: 'broken_images',
                    count: brokenImages.length,
                    urls: brokenImages,
                    timestamp: new Date().toISOString()
                });
            }

            // Check for missing CSS classes
            const missingClasses = await this.page.evaluate(() => {
                const elements = Array.from(document.querySelectorAll('*[class]'));
                const missingStyles = [];

                elements.forEach(el => {
                    const computedStyle = window.getComputedStyle(el);
                    if (computedStyle.display === 'none' && !el.classList.contains('hidden')) {
                        missingStyles.push({
                            element: el.tagName,
                            classes: Array.from(el.classList),
                            computed: 'display: none'
                        });
                    }
                });

                return missingStyles.slice(0, 10); // Limit to first 10
            });

            if (missingClasses.length > 0) {
                this.errors.resources.push({
                    type: 'potential_missing_styles',
                    elements: missingClasses,
                    timestamp: new Date().toISOString()
                });
            }

        } catch (error) {
            console.error('❌ Component rendering test failed:', error.message);
        }
    }

    async testNavigationAndModals() {
        console.log('🧭 Testing navigation and modals...');

        try {
            // Test navigation tabs
            const navButtons = await this.page.$$('nav button, .nav-button, [role="tab"]');

            for (let i = 0; i < Math.min(navButtons.length, 5); i++) {
                try {
                    await navButtons[i].click();
                    await this.page.waitForTimeout(500);
                    console.log(`✅ Navigation button ${i + 1} clicked successfully`);
                } catch (error) {
                    this.errors.javascript.push({
                        message: `Navigation button ${i + 1} click failed: ${error.message}`,
                        timestamp: new Date().toISOString()
                    });
                }
            }

            // Test modal functionality
            const modalTriggers = await this.page.$$('[data-new-incident], .btn-primary, button[data-bs-toggle="modal"]');

            for (let i = 0; i < Math.min(modalTriggers.length, 3); i++) {
                try {
                    await modalTriggers[i].click();
                    await this.page.waitForTimeout(1000);

                    // Check if modal opened
                    const modalOpen = await this.page.$('.modal[data-state="open"], .modal.show, .modal:not([style*="display: none"])');
                    if (modalOpen) {
                        console.log(`✅ Modal ${i + 1} opened successfully`);

                        // Try to close modal
                        const closeButton = await this.page.$('[data-modal-close], .modal .btn-close, .modal .close');
                        if (closeButton) {
                            await closeButton.click();
                            await this.page.waitForTimeout(500);
                        } else {
                            // Try escape key
                            await this.page.keyboard.press('Escape');
                            await this.page.waitForTimeout(500);
                        }
                    } else {
                        this.errors.javascript.push({
                            message: `Modal trigger ${i + 1} did not open modal`,
                            timestamp: new Date().toISOString()
                        });
                    }
                } catch (error) {
                    this.errors.javascript.push({
                        message: `Modal test ${i + 1} failed: ${error.message}`,
                        timestamp: new Date().toISOString()
                    });
                }
            }

        } catch (error) {
            console.error('❌ Navigation and modal test failed:', error.message);
        }
    }

    async testPerformance() {
        console.log('⚡ Testing performance...');

        try {
            const performanceMetrics = await this.page.evaluate(() => {
                const perfData = performance.getEntriesByType('navigation')[0];
                const paintEntries = performance.getEntriesByType('paint');

                return {
                    loadTime: perfData ? Math.round(perfData.loadEventEnd - perfData.loadEventStart) : 0,
                    domContentLoaded: perfData ? Math.round(perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart) : 0,
                    firstPaint: paintEntries.find(entry => entry.name === 'first-paint')?.startTime || 0,
                    firstContentfulPaint: paintEntries.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0,
                    resourceCount: performance.getEntriesByType('resource').length
                };
            });

            this.errors.performance = performanceMetrics;

            if (performanceMetrics.loadTime > 5000) {
                console.log('⚠️  Slow load time detected:', performanceMetrics.loadTime, 'ms');
            }

            if (performanceMetrics.firstContentfulPaint > 2000) {
                console.log('⚠️  Slow first contentful paint:', performanceMetrics.firstContentfulPaint, 'ms');
            }

        } catch (error) {
            console.error('❌ Performance test failed:', error.message);
        }
    }

    async checkAccessibility() {
        console.log('♿ Checking accessibility...');

        try {
            const accessibilityIssues = await this.page.evaluate(() => {
                const issues = [];

                // Check for missing alt text
                const images = document.querySelectorAll('img:not([alt])');
                if (images.length > 0) {
                    issues.push({
                        type: 'missing_alt_text',
                        count: images.length,
                        message: 'Images without alt text found'
                    });
                }

                // Check for missing form labels
                const inputs = document.querySelectorAll('input:not([aria-label]):not([aria-labelledby])');
                const inputsWithoutLabels = Array.from(inputs).filter(input => {
                    const label = document.querySelector(`label[for="${input.id}"]`);
                    return !label && input.type !== 'hidden';
                });

                if (inputsWithoutLabels.length > 0) {
                    issues.push({
                        type: 'missing_form_labels',
                        count: inputsWithoutLabels.length,
                        message: 'Form inputs without labels found'
                    });
                }

                // Check for missing headings structure
                const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
                if (headings.length === 0) {
                    issues.push({
                        type: 'missing_headings',
                        message: 'No heading elements found'
                    });
                }

                return issues;
            });

            this.errors.accessibility = accessibilityIssues;

        } catch (error) {
            console.error('❌ Accessibility check failed:', error.message);
        }
    }

    async takeScreenshot() {
        console.log('📸 Taking screenshot...');

        try {
            const screenshotPath = path.join(__dirname, '../test-results', 'frontend-analysis-screenshot.png');
            await this.page.screenshot({
                path: screenshotPath,
                fullPage: true
            });
            console.log(`✅ Screenshot saved: ${screenshotPath}`);
        } catch (error) {
            console.error('❌ Screenshot failed:', error.message);
        }
    }

    generateReport() {
        console.log('📊 Generating error analysis report...');

        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                consoleErrors: this.errors.console.filter(e => e.type === 'error').length,
                consoleWarnings: this.errors.console.filter(e => e.type === 'warning').length,
                networkErrors: this.errors.network.length,
                javascriptErrors: this.errors.javascript.length,
                resourceIssues: this.errors.resources.length,
                accessibilityIssues: this.errors.accessibility.length
            },
            details: this.errors,
            recommendations: this.generateRecommendations()
        };

        return report;
    }

    generateRecommendations() {
        const recommendations = [];

        // Console errors
        if (this.errors.console.length > 0) {
            recommendations.push({
                category: 'Console Errors',
                priority: 'HIGH',
                description: 'Fix console errors to improve application stability',
                actions: [
                    'Review browser console logs',
                    'Fix JavaScript syntax errors',
                    'Handle promise rejections properly',
                    'Add error boundaries for React components'
                ]
            });
        }

        // Network errors
        if (this.errors.network.length > 0) {
            recommendations.push({
                category: 'Network Issues',
                priority: 'HIGH',
                description: 'Resolve network failures and missing resources',
                actions: [
                    'Check file paths and URLs',
                    'Ensure all CSS and JS files are accessible',
                    'Verify server configuration',
                    'Add proper error handling for failed requests'
                ]
            });
        }

        // Performance
        if (this.errors.performance.loadTime > 3000) {
            recommendations.push({
                category: 'Performance',
                priority: 'MEDIUM',
                description: 'Optimize application load time',
                actions: [
                    'Minimize and compress CSS/JS files',
                    'Optimize images',
                    'Implement lazy loading',
                    'Use CDN for static assets'
                ]
            });
        }

        // Accessibility
        if (this.errors.accessibility.length > 0) {
            recommendations.push({
                category: 'Accessibility',
                priority: 'MEDIUM',
                description: 'Improve application accessibility',
                actions: [
                    'Add alt text to images',
                    'Associate labels with form inputs',
                    'Implement proper heading structure',
                    'Ensure keyboard navigation works'
                ]
            });
        }

        return recommendations;
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            console.log('🧹 Browser closed');
        }
    }

    async run() {
        try {
            await this.initialize();
            await this.testApplication();
            await this.takeScreenshot();

            const report = this.generateReport();

            // Save report
            const reportPath = path.join(__dirname, '../test-results', 'frontend-error-analysis-report.json');
            fs.mkdirSync(path.dirname(reportPath), { recursive: true });
            fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

            console.log('\n📋 FRONTEND ERROR ANALYSIS COMPLETE');
            console.log('=====================================');
            console.log(`Console Errors: ${report.summary.consoleErrors}`);
            console.log(`Console Warnings: ${report.summary.consoleWarnings}`);
            console.log(`Network Errors: ${report.summary.networkErrors}`);
            console.log(`JavaScript Errors: ${report.summary.javascriptErrors}`);
            console.log(`Resource Issues: ${report.summary.resourceIssues}`);
            console.log(`Accessibility Issues: ${report.summary.accessibilityIssues}`);
            console.log(`\nDetailed report saved: ${reportPath}`);

            return report;

        } catch (error) {
            console.error('💥 Analysis failed:', error);
            throw error;
        } finally {
            await this.cleanup();
        }
    }
}

// Run if called directly
if (require.main === module) {
    const analyzer = new FrontendErrorAnalyzer();
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

module.exports = FrontendErrorAnalyzer;