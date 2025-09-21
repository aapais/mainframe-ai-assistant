#!/usr/bin/env node

/**
 * Test Validation Script
 * Validates 80%+ code coverage and test performance across all created test files
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const COVERAGE_THRESHOLDS = {
  global: {
    statements: 80,
    branches: 80,
    functions: 80,
    lines: 80
  },
  hybridSearch: {
    statements: 90,
    branches: 85,
    functions: 90,
    lines: 90
  }
};

const TEST_FILES = [
  'tests/unit/services/hybridSearchService.test.ts',
  'tests/unit/hooks/useHybridSearch.test.ts',
  'tests/integration/searchWorkflow.test.ts',
  'tests/performance/searchPerformance.test.ts',
  'tests/e2e/searchFlow.test.ts',
  'tests/accessibility/wcag-compliance.test.ts'
];

class TestValidator {
  constructor() {
    this.results = {
      filesValidated: 0,
      testsRun: 0,
      coverageResults: null,
      performanceResults: [],
      errors: [],
      warnings: []
    };
  }

  async validate() {
    console.log('🧪 Starting comprehensive test validation...');
    console.log('=' .repeat(60));

    try {
      await this.validateTestFiles();
      await this.runCoverageAnalysis();
      await this.validateTestPerformance();
      await this.generateReport();
      
      console.log('\n✅ Test validation completed successfully!');
      return this.results;
    } catch (error) {
      console.error('\n❌ Test validation failed:', error.message);
      throw error;
    }
  }

  async validateTestFiles() {
    console.log('\n📁 Validating test files exist and are properly structured...');
    
    for (const testFile of TEST_FILES) {
      const fullPath = path.join(process.cwd(), testFile);
      
      if (fs.existsSync(fullPath)) {
        console.log(`✅ ${testFile}`);
        this.results.filesValidated++;
        
        // Basic structure validation
        await this.validateTestStructure(fullPath);
      } else {
        const error = `Test file missing: ${testFile}`;
        console.log(`❌ ${error}`);
        this.results.errors.push(error);
      }
    }

    if (this.results.errors.length > 0) {
      throw new Error(`Missing test files: ${this.results.errors.length}`);
    }
  }

  async validateTestStructure(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check for essential test patterns
    const patterns = {
      'describe blocks': /describe\s*\(/g,
      'test cases': /(it|test)\s*\(/g,
      'expect assertions': /expect\s*\(/g,
      'beforeEach/beforeAll': /(beforeEach|beforeAll)\s*\(/g
    };

    for (const [name, pattern] of Object.entries(patterns)) {
      const matches = content.match(pattern);
      if (!matches || matches.length === 0) {
        this.results.warnings.push(`${filePath}: No ${name} found`);
      }
    }

    // Count test cases
    const testMatches = content.match(/(it|test)\s*\(/g);
    if (testMatches) {
      this.results.testsRun += testMatches.length;
    }
  }

  async runCoverageAnalysis() {
    console.log('\n📊 Running code coverage analysis...');
    
    return new Promise((resolve, reject) => {
      const jest = spawn('npx', ['jest', '--coverage', '--coverageReporters=json-summary', '--coverageReporters=text'], {
        stdio: ['inherit', 'pipe', 'pipe'],
        shell: true
      });

      let output = '';
      let errorOutput = '';

      jest.stdout.on('data', (data) => {
        output += data.toString();
        process.stdout.write(data);
      });

      jest.stderr.on('data', (data) => {
        errorOutput += data.toString();
        process.stderr.write(data);
      });

      jest.on('close', (code) => {
        if (code === 0) {
          this.processCoverageResults();
          resolve();
        } else {
          reject(new Error(`Jest failed with code ${code}: ${errorOutput}`));
        }
      });
    });
  }

  processCoverageResults() {
    try {
      const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
      
      if (fs.existsSync(coveragePath)) {
        const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
        this.results.coverageResults = coverageData.total;
        
        console.log('\n📈 Coverage Results:');
        console.log(`Statements: ${this.results.coverageResults.statements.pct}%`);
        console.log(`Branches: ${this.results.coverageResults.branches.pct}%`);
        console.log(`Functions: ${this.results.coverageResults.functions.pct}%`);
        console.log(`Lines: ${this.results.coverageResults.lines.pct}%`);
        
        // Validate against thresholds
        this.validateCoverageThresholds();
      } else {
        this.results.warnings.push('Coverage summary file not found');
      }
    } catch (error) {
      this.results.warnings.push(`Failed to process coverage: ${error.message}`);
    }
  }

  validateCoverageThresholds() {
    const coverage = this.results.coverageResults;
    const thresholds = COVERAGE_THRESHOLDS.global;

    for (const [metric, threshold] of Object.entries(thresholds)) {
      if (coverage[metric].pct < threshold) {
        const error = `${metric} coverage (${coverage[metric].pct}%) below threshold (${threshold}%)`;
        console.log(`⚠️  ${error}`);
        this.results.errors.push(error);
      } else {
        console.log(`✅ ${metric} coverage: ${coverage[metric].pct}% (>= ${threshold}%)`);
      }
    }
  }

  async validateTestPerformance() {
    console.log('\n⚡ Validating test performance...');
    
    const performanceTests = [
      {
        name: 'Unit Tests',
        command: ['npx', 'jest', '--testNamePattern=unit', '--detectOpenHandles'],
        maxTime: 30000 // 30 seconds
      },
      {
        name: 'Integration Tests',
        command: ['npx', 'jest', '--testNamePattern=integration', '--detectOpenHandles'],
        maxTime: 60000 // 60 seconds
      },
      {
        name: 'Performance Tests',
        command: ['npx', 'jest', '--testNamePattern=performance', '--detectOpenHandles'],
        maxTime: 120000 // 2 minutes
      }
    ];

    for (const test of performanceTests) {
      const startTime = Date.now();
      
      try {
        await this.runTestSuite(test.command);
        const duration = Date.now() - startTime;
        
        console.log(`✅ ${test.name}: ${duration}ms`);
        
        this.results.performanceResults.push({
          name: test.name,
          duration,
          passed: duration <= test.maxTime
        });
        
        if (duration > test.maxTime) {
          this.results.warnings.push(`${test.name} took ${duration}ms (max: ${test.maxTime}ms)`);
        }
      } catch (error) {
        console.log(`❌ ${test.name}: ${error.message}`);
        this.results.errors.push(`${test.name} failed: ${error.message}`);
      }
    }
  }

  async runTestSuite(command) {
    return new Promise((resolve, reject) => {
      const process = spawn(command[0], command.slice(1), {
        stdio: ['inherit', 'pipe', 'pipe'],
        shell: true
      });

      let output = '';
      let errorOutput = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Command failed with code ${code}\n${errorOutput}`));
        }
      });
    });
  }

  async generateReport() {
    console.log('\n📋 Generating validation report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        filesValidated: this.results.filesValidated,
        expectedFiles: TEST_FILES.length,
        testsRun: this.results.testsRun,
        errors: this.results.errors.length,
        warnings: this.results.warnings.length
      },
      coverage: this.results.coverageResults,
      performance: this.results.performanceResults,
      issues: {
        errors: this.results.errors,
        warnings: this.results.warnings
      },
      recommendations: this.generateRecommendations()
    };

    // Save report to file
    const reportPath = path.join(process.cwd(), 'test-validation-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n📄 Report saved to: ${reportPath}`);
    
    // Print summary
    this.printSummary(report);
    
    return report;
  }

  generateRecommendations() {
    const recommendations = [];
    
    if (this.results.coverageResults) {
      const coverage = this.results.coverageResults;
      
      if (coverage.statements.pct < 90) {
        recommendations.push('Consider adding more unit tests to improve statement coverage');
      }
      
      if (coverage.branches.pct < 85) {
        recommendations.push('Add tests for edge cases and error conditions to improve branch coverage');
      }
      
      if (coverage.functions.pct < 90) {
        recommendations.push('Ensure all exported functions have corresponding tests');
      }
    }
    
    if (this.results.testsRun < 50) {
      recommendations.push('Consider adding more comprehensive test cases');
    }
    
    const slowTests = this.results.performanceResults.filter(test => !test.passed);
    if (slowTests.length > 0) {
      recommendations.push('Optimize slow-running tests or increase timeout thresholds');
    }
    
    if (this.results.warnings.length > 5) {
      recommendations.push('Address test warnings to improve code quality');
    }
    
    return recommendations;
  }

  printSummary(report) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST VALIDATION SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`📁 Files: ${report.summary.filesValidated}/${report.summary.expectedFiles}`);
    console.log(`🧪 Tests: ${report.summary.testsRun}`);
    console.log(`❌ Errors: ${report.summary.errors}`);
    console.log(`⚠️  Warnings: ${report.summary.warnings}`);
    
    if (report.coverage) {
      console.log('\n📈 Coverage:');
      console.log(`  Statements: ${report.coverage.statements.pct}%`);
      console.log(`  Branches: ${report.coverage.branches.pct}%`);
      console.log(`  Functions: ${report.coverage.functions.pct}%`);
      console.log(`  Lines: ${report.coverage.lines.pct}%`);
    }
    
    if (report.performance.length > 0) {
      console.log('\n⚡ Performance:');
      report.performance.forEach(perf => {
        const status = perf.passed ? '✅' : '❌';
        console.log(`  ${status} ${perf.name}: ${perf.duration}ms`);
      });
    }
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
    
    // Final assessment
    const allTestsPassed = report.summary.errors === 0;
    const coverageGood = report.coverage && 
      report.coverage.statements.pct >= 80 &&
      report.coverage.branches.pct >= 80 &&
      report.coverage.functions.pct >= 80 &&
      report.coverage.lines.pct >= 80;
    
    if (allTestsPassed && coverageGood) {
      console.log('🎉 ALL VALIDATION CHECKS PASSED!');
    } else {
      console.log('⚠️  SOME VALIDATION CHECKS FAILED - REVIEW REQUIRED');
    }
    
    console.log('='.repeat(60));
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new TestValidator();
  
  validator.validate()
    .then((results) => {
      const exitCode = results.errors.length > 0 ? 1 : 0;
      process.exit(exitCode);
    })
    .catch((error) => {
      console.error('Validation failed:', error);
      process.exit(1);
    });
}

module.exports = { TestValidator, COVERAGE_THRESHOLDS, TEST_FILES };
