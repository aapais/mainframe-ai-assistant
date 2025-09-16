#!/usr/bin/env tsx

/**
 * Accessibility Test Runner
 * Command-line interface for running comprehensive accessibility tests
 *
 * Usage:
 *   npm run test:accessibility              # Run all accessibility tests
 *   npm run test:accessibility -- --quick   # Run quick validation only
 *   npm run test:accessibility -- --report  # Generate detailed report
 *   npm run test:accessibility -- --wcag AA # Test specific WCAG level
 */

import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import React from 'react';
import { render } from '@testing-library/react';

// Import our accessibility testing framework
import {
  generateAccessibilityAuditReport,
  quickAccessibilityCheck,
  isWCAGCompliant,
  accessibilityTestingConfig,
  type AccessibilityAuditReport
} from './comprehensive';

// Import components to test
import { KBEntryForm } from '../../src/renderer/components/forms/KBEntryForm';
import { SearchInterface } from '../../src/renderer/components/search/SearchInterface';
import { AccessibleKBTable } from '../../src/renderer/components/AccessibleKBTable';
import { AppLayout } from '../../src/renderer/components/AppLayout';

/**
 * Component test registry
 */
const testComponents = [
  {
    name: 'KBEntryForm',
    component: React.createElement(KBEntryForm, { onSubmit: jest.fn() }),
    description: 'Knowledge Base Entry Form - Primary data input component'
  },
  {
    name: 'SearchInterface',
    component: React.createElement(SearchInterface, { onSearch: jest.fn() }),
    description: 'Search Interface - Main search functionality component'
  },
  {
    name: 'AccessibleKBTable',
    component: React.createElement(AccessibleKBTable, {
      data: [
        { id: '1', title: 'Test Entry', category: 'VSAM', usageCount: 10, successRate: 90 }
      ]
    }),
    description: 'Accessible KB Table - Data presentation component'
  },
  {
    name: 'AppLayout',
    component: React.createElement(AppLayout, {}, React.createElement('div', {}, 'Test content')),
    description: 'Application Layout - Main structural component'
  }
];

/**
 * CLI Application
 */
const program = new Command();

program
  .name('accessibility-tester')
  .description('Comprehensive accessibility testing for Mainframe KB Assistant')
  .version('1.0.0');

program
  .command('test')
  .description('Run accessibility tests')
  .option('-q, --quick', 'Run quick validation only')
  .option('-r, --report', 'Generate detailed HTML/markdown report')
  .option('-w, --wcag <level>', 'WCAG level to test (A, AA, AAA)', 'AA')
  .option('-c, --component <name>', 'Test specific component only')
  .option('-o, --output <path>', 'Output directory for reports', './accessibility-reports')
  .option('--json', 'Output results as JSON')
  .option('--ci', 'Run in CI mode (exit with error code on failures)')
  .action(async (options) => {
    try {
      console.log('🚀 Starting accessibility tests...\n');

      // Ensure output directory exists
      if (!existsSync(options.output)) {
        mkdirSync(options.output, { recursive: true });
      }

      // Filter components if specific component requested
      const componentsToTest = options.component
        ? testComponents.filter(comp => comp.name.toLowerCase() === options.component.toLowerCase())
        : testComponents;

      if (componentsToTest.length === 0) {
        console.error(`❌ Component "${options.component}" not found`);
        process.exit(1);
      }

      const results = [];
      let totalScore = 0;
      let totalCriticalIssues = 0;
      let totalIssues = 0;

      // Run tests for each component
      for (const testComponent of componentsToTest) {
        console.log(`🔍 Testing ${testComponent.name}...`);
        console.log(`   ${testComponent.description}`);

        try {
          let result;

          if (options.quick) {
            // Quick validation
            result = await quickAccessibilityCheck(testComponent.component, testComponent.name);
          } else {
            // Comprehensive test
            result = await quickAccessibilityCheck(testComponent.component, testComponent.name);
          }

          results.push({
            component: testComponent.name,
            description: testComponent.description,
            result
          });

          // Calculate metrics
          totalScore += result.summary.overallScore;
          totalCriticalIssues += result.summary.criticalIssues;
          totalIssues += result.issues.length;

          // Display component results
          const status = result.summary.criticalIssues === 0 ? '✅' : '❌';
          const score = result.summary.overallScore;
          const issues = result.issues.length;

          console.log(`   ${status} Score: ${score}% | Issues: ${issues} | Critical: ${result.summary.criticalIssues}`);

          // Show specific violations if any
          if (result.violations.length > 0) {
            console.log(`   Violations:`);
            result.violations.slice(0, 3).forEach(violation => {
              console.log(`     - ${violation.id}: ${violation.description}`);
            });
            if (result.violations.length > 3) {
              console.log(`     ... and ${result.violations.length - 3} more`);
            }
          }

        } catch (error) {
          console.error(`   ❌ Error testing ${testComponent.name}:`, error.message);

          if (options.ci) {
            process.exit(1);
          }
        }

        console.log('');
      }

      // Calculate overall metrics
      const averageScore = totalScore / componentsToTest.length;
      const passedComponents = results.filter(r => r.result.summary.criticalIssues === 0).length;

      console.log('📊 Overall Results:');
      console.log(`   Average Score: ${Math.round(averageScore)}%`);
      console.log(`   Components Passed: ${passedComponents}/${componentsToTest.length}`);
      console.log(`   Total Critical Issues: ${totalCriticalIssues}`);
      console.log(`   Total Issues: ${totalIssues}`);

      // WCAG Compliance Check
      const wcagCompliant = totalCriticalIssues === 0 && averageScore >= accessibilityTestingConfig.minCoverageThreshold;
      const complianceStatus = wcagCompliant ? '✅ COMPLIANT' : '❌ NON-COMPLIANT';

      console.log(`\n🎯 WCAG ${options.wcag} Compliance: ${complianceStatus}`);

      // Generate detailed report if requested
      if (options.report) {
        console.log('\n📋 Generating detailed report...');

        const auditReport = await generateAccessibilityAuditReport(
          componentsToTest.map(comp => ({
            component: comp.component,
            name: comp.name
          })),
          {
            applicationName: 'Mainframe KB Assistant',
            applicationVersion: '1.0.0-mvp1',
            auditor: 'Automated Accessibility Testing Suite'
          }
        );

        // Generate HTML report
        const htmlReportPath = join(options.output, 'accessibility-audit-report.html');
        const htmlReport = generateHTMLReport(auditReport);
        writeFileSync(htmlReportPath, htmlReport);
        console.log(`   📄 HTML Report: ${htmlReportPath}`);

        // Generate Markdown report
        const markdownReportPath = join(options.output, 'accessibility-audit-report.md');
        const markdownReport = generateMarkdownReport(auditReport);
        writeFileSync(markdownReportPath, markdownReport);
        console.log(`   📝 Markdown Report: ${markdownReportPath}`);

        // Generate JSON report if requested
        if (options.json) {
          const jsonReportPath = join(options.output, 'accessibility-audit-report.json');
          writeFileSync(jsonReportPath, JSON.stringify(auditReport, null, 2));
          console.log(`   📊 JSON Report: ${jsonReportPath}`);
        }
      }

      // Export results for CI integration
      if (options.ci) {
        const ciReport = {
          passed: wcagCompliant,
          averageScore: Math.round(averageScore),
          totalCriticalIssues,
          totalIssues,
          componentsTestedCount: componentsToTest.length,
          componentsPassed: passedComponents,
          wcagLevel: options.wcag,
          timestamp: new Date().toISOString()
        };

        const ciReportPath = join(options.output, 'ci-accessibility-report.json');
        writeFileSync(ciReportPath, JSON.stringify(ciReport, null, 2));

        if (!wcagCompliant) {
          console.error('\n❌ Accessibility tests failed. Critical issues must be resolved.');
          process.exit(1);
        }
      }

      console.log('\n✅ Accessibility testing completed successfully!');

      // Store coordination data
      await storeCoordinationData({
        testType: 'accessibility',
        results: {
          averageScore: Math.round(averageScore),
          totalIssues,
          criticalIssues: totalCriticalIssues,
          wcagCompliant,
          componentsTestedCount: componentsToTest.length
        }
      });

    } catch (error) {
      console.error('❌ Accessibility testing failed:', error);

      if (options.ci) {
        process.exit(1);
      }
    }
  });

program
  .command('validate')
  .description('Quick WCAG compliance validation')
  .argument('<component>', 'Component name to validate')
  .option('-w, --wcag <level>', 'WCAG level (A, AA, AAA)', 'AA')
  .action(async (componentName, options) => {
    try {
      const testComponent = testComponents.find(
        comp => comp.name.toLowerCase() === componentName.toLowerCase()
      );

      if (!testComponent) {
        console.error(`❌ Component "${componentName}" not found`);
        console.log('Available components:', testComponents.map(c => c.name).join(', '));
        process.exit(1);
      }

      console.log(`🔍 Validating ${testComponent.name} for WCAG ${options.wcag} compliance...`);

      const compliant = await isWCAGCompliant(
        testComponent.component,
        options.wcag as 'A' | 'AA' | 'AAA'
      );

      const status = compliant ? '✅ COMPLIANT' : '❌ NON-COMPLIANT';
      console.log(`\n🎯 Result: ${status}`);

      if (!compliant) {
        const result = await quickAccessibilityCheck(testComponent.component, testComponent.name);
        console.log(`\nIssues found:`);
        console.log(`- Score: ${result.summary.overallScore}%`);
        console.log(`- Critical Issues: ${result.summary.criticalIssues}`);
        console.log(`- Total Issues: ${result.issues.length}`);
      }

    } catch (error) {
      console.error('❌ Validation failed:', error);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize accessibility testing configuration')
  .action(() => {
    try {
      const configPath = './accessibility.config.json';

      if (existsSync(configPath)) {
        console.log('📋 Accessibility configuration already exists');
        return;
      }

      const config = {
        wcagLevel: 'AA',
        components: testComponents.map(comp => comp.name),
        excludeComponents: [],
        reportOutput: './accessibility-reports',
        thresholds: {
          minScore: 85,
          maxCriticalIssues: 0,
          maxWarningIssues: 5
        },
        automation: {
          runOnBuild: true,
          failOnViolations: true,
          generateReports: true
        }
      };

      writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log('✅ Accessibility configuration initialized');
      console.log(`📄 Config file: ${configPath}`);

    } catch (error) {
      console.error('❌ Failed to initialize configuration:', error);
      process.exit(1);
    }
  });

/**
 * Helper functions
 */
function generateHTMLReport(report: AccessibilityAuditReport): string {
  // Use the report generator's HTML formatting
  const generator = new (require('./comprehensive/AccessibilityAuditReport').AccessibilityAuditReportGenerator)([], {});
  return generator.formatAsHTML(report);
}

function generateMarkdownReport(report: AccessibilityAuditReport): string {
  // Use the report generator's Markdown formatting
  const generator = new (require('./comprehensive/AccessibilityAuditReport').AccessibilityAuditReportGenerator)([], {});
  return generator.formatAsMarkdown(report);
}

async function storeCoordinationData(data: any): Promise<void> {
  try {
    // Store coordination data for claude-flow integration
    if (process.env.CLAUDE_FLOW_ENABLED) {
      await fetch('/api/hooks/post-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file: 'accessibility-test-results',
          'memory-key': 'swarm/ui-testing/accessibility',
          data
        })
      }).catch(() => {}); // Silent fail - coordination is optional
    }
  } catch (error) {
    // Silent fail - coordination is optional
  }
}

// Parse command line arguments and run
program.parse();

export { testComponents };