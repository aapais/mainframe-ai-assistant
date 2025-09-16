import { FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting Responsive Test Suite Global Teardown');
  
  try {
    // Load test configuration
    const configPath = 'test-results/test-config.json';
    let testConfig: any = {};
    
    if (fs.existsSync(configPath)) {
      testConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
    
    // Generate test summary report
    const testSummary = {
      ...testConfig,
      endTime: new Date().toISOString(),
      duration: testConfig.startTime ? 
        new Date().getTime() - new Date(testConfig.startTime).getTime() : 0,
      results: {
        htmlReport: 'test-results/responsive-html-report/index.html',
        jsonResults: 'test-results/responsive-results.json',
        junitResults: 'test-results/responsive-junit.xml'
      }
    };
    
    // Check for test results files
    const resultFiles = [
      'test-results/responsive-results.json',
      'test-results/responsive-junit.xml'
    ];
    
    resultFiles.forEach(file => {
      if (fs.existsSync(file)) {
        console.log(`✅ Generated test results: ${file}`);
      } else {
        console.warn(`⚠️  Missing test results file: ${file}`);
      }
    });
    
    // Generate performance summary
    const performanceFiles = fs.readdirSync('test-results')
      .filter(file => file.includes('performance') || file.includes('metrics'))
      .map(file => path.join('test-results', file));
    
    if (performanceFiles.length > 0) {
      console.log(`📊 Generated ${performanceFiles.length} performance reports`);
      testSummary.performanceReports = performanceFiles;
    }
    
    // Generate accessibility summary
    const accessibilityFiles = fs.readdirSync('test-results')
      .filter(file => file.includes('accessibility') || file.includes('a11y'))
      .map(file => path.join('test-results', file));
    
    if (accessibilityFiles.length > 0) {
      console.log(`♿ Generated ${accessibilityFiles.length} accessibility reports`);
      testSummary.accessibilityReports = accessibilityFiles;
    }
    
    // Count visual regression screenshots
    const visualDir = 'test-results/visual-baselines';
    if (fs.existsSync(visualDir)) {
      const screenshots = fs.readdirSync(visualDir, { recursive: true })
        .filter(file => file.toString().endsWith('.png'));
      
      console.log(`📸 Generated ${screenshots.length} visual regression screenshots`);
      testSummary.visualScreenshots = screenshots.length;
    }
    
    // Save comprehensive test summary
    const summaryPath = 'test-results/responsive-test-summary.json';
    fs.writeFileSync(summaryPath, JSON.stringify(testSummary, null, 2));
    console.log(`💾 Test summary saved to ${summaryPath}`);
    
    // Generate markdown report
    const markdownReport = generateMarkdownReport(testSummary);
    const markdownPath = 'test-results/responsive-test-report.md';
    fs.writeFileSync(markdownPath, markdownReport);
    console.log(`📝 Markdown report saved to ${markdownPath}`);
    
    // Cleanup temporary files
    const tempFiles = [
      'test-results/temp',
      'test-results/.tmp'
    ];
    
    tempFiles.forEach(file => {
      if (fs.existsSync(file)) {
        fs.rmSync(file, { recursive: true, force: true });
        console.log(`🗑️  Cleaned up temporary files: ${file}`);
      }
    });
    
    // Display final summary
    console.log('\n📋 RESPONSIVE TEST SUITE SUMMARY');
    console.log('=====================================');
    console.log(`🕐 Test Duration: ${Math.round(testSummary.duration / 1000 / 60)} minutes`);
    console.log(`🎯 Projects Tested: ${testSummary.projects?.length || 0}`);
    console.log(`📸 Visual Screenshots: ${testSummary.visualScreenshots || 0}`);
    console.log(`📊 Performance Reports: ${testSummary.performanceReports?.length || 0}`);
    console.log(`♿ Accessibility Reports: ${testSummary.accessibilityReports?.length || 0}`);
    console.log('');
    console.log('📁 Key Test Results:');
    console.log(`   📊 HTML Report: ${testSummary.results.htmlReport}`);
    console.log(`   📄 JSON Results: ${testSummary.results.jsonResults}`);
    console.log(`   📋 Summary: ${summaryPath}`);
    console.log(`   📝 Markdown Report: ${markdownPath}`);
    console.log('');
    
    // CI/CD integration hints
    if (process.env.CI) {
      console.log('🚀 CI/CD Integration:');
      console.log('   Add these artifacts to your CI/CD pipeline:');
      console.log('   - test-results/responsive-html-report/');
      console.log('   - test-results/responsive-test-summary.json');
      console.log('   - test-results/responsive-test-report.md');
      console.log('');
    }
    
    console.log('🎉 Responsive Test Suite completed successfully!');
    
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw error to avoid masking test failures
  }
}

function generateMarkdownReport(testSummary: any): string {
  const duration = Math.round(testSummary.duration / 1000 / 60);
  const startTime = new Date(testSummary.startTime).toLocaleString();
  const endTime = new Date(testSummary.endTime).toLocaleString();
  
  return `# Responsive Test Suite Report

## Test Execution Summary

- **Start Time**: ${startTime}
- **End Time**: ${endTime}
- **Duration**: ${duration} minutes
- **Environment**: ${testSummary.testEnvironment?.ci ? 'CI/CD' : 'Local'}
- **Platform**: ${testSummary.testEnvironment?.platform || 'Unknown'}
- **Node Version**: ${testSummary.testEnvironment?.node || 'Unknown'}

## Test Coverage

### Projects Tested
${testSummary.projects?.map((project: string) => `- ${project}`).join('\n') || 'No projects listed'}

### Test Categories

- **📱 Mobile Tests**: Portrait and landscape orientations
- **📟 Tablet Tests**: Various tablet sizes and orientations  
- **🖥️ Desktop Tests**: Multiple screen resolutions up to 4K
- **📸 Visual Regression**: Screenshot comparisons across viewports
- **⚡ Performance Tests**: Core Web Vitals and metrics
- **♿ Accessibility Tests**: WCAG compliance and screen reader support

## Results

### Generated Artifacts

- **HTML Report**: \`${testSummary.results?.htmlReport}\`
- **JSON Results**: \`${testSummary.results?.jsonResults}\`
- **JUnit XML**: \`${testSummary.results?.junitResults}\`

### Performance Reports
${testSummary.performanceReports?.map((report: string) => `- \`${report}\``).join('\n') || 'No performance reports generated'}

### Accessibility Reports  
${testSummary.accessibilityReports?.map((report: string) => `- \`${report}\``).join('\n') || 'No accessibility reports generated'}

### Visual Regression
- **Screenshots Generated**: ${testSummary.visualScreenshots || 0}
- **Baseline Directory**: \`test-results/visual-baselines/baseline/\`
- **Actual Directory**: \`test-results/visual-baselines/actual/\`
- **Diff Directory**: \`test-results/visual-baselines/diff/\`

## Recommendations

### For Development Teams

1. **Review HTML Report** for detailed test results and failures
2. **Check Performance Reports** for optimization opportunities
3. **Validate Accessibility Reports** for WCAG compliance
4. **Monitor Visual Diffs** for unintended layout changes

### For CI/CD Integration

1. Archive test artifacts for historical comparison
2. Set up performance budgets based on metrics
3. Configure accessibility checks as quality gates
4. Monitor visual regression trends

## Next Steps

- [ ] Review failed tests and fix issues
- [ ] Update visual baselines if changes are intentional
- [ ] Optimize performance based on metrics
- [ ] Address accessibility violations
- [ ] Update responsive breakpoints if needed

---

*Generated by Responsive Test Suite on ${new Date().toLocaleString()}*
`;
}

export default globalTeardown;
