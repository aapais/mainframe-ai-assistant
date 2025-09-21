/**
 * Custom Playwright Reporter for Accessibility Testing Results
 * Generates detailed accessibility compliance reports for CreateIncidentModal
 */

import {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult
} from '@playwright/test/reporter';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

interface AccessibilityTest {
  testName: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  errors: string[];
  wcagCriteria: {
    perceivable: boolean;
    operable: boolean;
    understandable: boolean;
    robust: boolean;
  };
  details: {
    keyboardNavigation: boolean;
    screenReaderCompatibility: boolean;
    colorContrast: boolean;
    formLabels: boolean;
    ariaAttributes: boolean;
    focusManagement: boolean;
  };
}

interface AccessibilityReport {
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    overallCompliance: number;
    wcagLevel: string;
  };
  tests: AccessibilityTest[];
  recommendations: string[];
  compliance: {
    wcag21AA: boolean;
    section508: boolean;
    keyboardNavigation: boolean;
    screenReader: boolean;
  };
  generatedAt: string;
  component: string;
}

export default class AccessibilityReporter implements Reporter {
  private accessibilityTests: AccessibilityTest[] = [];
  private outputDir = 'tests/playwright/reports/accessibility';

  onBegin(config: FullConfig, suite: Suite) {
    console.log(`\n🔍 Starting accessibility testing for CreateIncidentModal`);
    console.log(`📊 Running ${suite.allTests().length} tests across ${config.projects.length} projects\n`);

    // Ensure output directory exists
    try {
      mkdirSync(this.outputDir, { recursive: true });
    } catch (error) {
      // Directory already exists
    }
  }

  onTestEnd(test: TestCase, result: TestResult) {
    // Only process accessibility-related tests
    if (!this.isAccessibilityTest(test)) {
      return;
    }

    const accessibilityTest: AccessibilityTest = {
      testName: test.title,
      status: result.status,
      duration: result.duration,
      errors: result.errors.map(error => error.message || ''),
      wcagCriteria: this.evaluateWCAGCriteria(test, result),
      details: this.evaluateAccessibilityDetails(test, result)
    };

    this.accessibilityTests.push(accessibilityTest);

    // Log progress
    const statusIcon = result.status === 'passed' ? '✅' : result.status === 'failed' ? '❌' : '⏭️';
    console.log(`${statusIcon} ${test.title} (${result.duration}ms)`);
  }

  onEnd(result: FullResult) {
    const report = this.generateReport();
    this.saveReport(report);
    this.printSummary(report);
  }

  private isAccessibilityTest(test: TestCase): boolean {
    const accessibilityKeywords = [
      'acessibilidade', 'accessibility', 'wcag', 'aria', 'keyboard',
      'screen reader', 'contrast', 'focus', 'navegação', 'teclado'
    ];

    const testTitle = test.title.toLowerCase();
    const suiteName = test.parent.title.toLowerCase();

    return accessibilityKeywords.some(keyword =>
      testTitle.includes(keyword) || suiteName.includes(keyword)
    );
  }

  private evaluateWCAGCriteria(test: TestCase, result: TestResult) {
    const testTitle = test.title.toLowerCase();

    return {
      perceivable: this.checkPerceivable(testTitle, result),
      operable: this.checkOperable(testTitle, result),
      understandable: this.checkUnderstandable(testTitle, result),
      robust: this.checkRobust(testTitle, result)
    };
  }

  private checkPerceivable(testTitle: string, result: TestResult): boolean {
    const perceivableKeywords = ['contrast', 'color', 'text', 'image', 'visual'];
    return perceivableKeywords.some(keyword => testTitle.includes(keyword)) &&
           result.status === 'passed';
  }

  private checkOperable(testTitle: string, result: TestResult): boolean {
    const operableKeywords = ['keyboard', 'focus', 'navigation', 'click', 'interaction'];
    return operableKeywords.some(keyword => testTitle.includes(keyword)) &&
           result.status === 'passed';
  }

  private checkUnderstandable(testTitle: string, result: TestResult): boolean {
    const understandableKeywords = ['label', 'error', 'validation', 'instruction', 'help'];
    return understandableKeywords.some(keyword => testTitle.includes(keyword)) &&
           result.status === 'passed';
  }

  private checkRobust(testTitle: string, result: TestResult): boolean {
    const robustKeywords = ['aria', 'semantic', 'markup', 'screen reader', 'assistive'];
    return robustKeywords.some(keyword => testTitle.includes(keyword)) &&
           result.status === 'passed';
  }

  private evaluateAccessibilityDetails(test: TestCase, result: TestResult) {
    const testTitle = test.title.toLowerCase();

    return {
      keyboardNavigation: testTitle.includes('keyboard') && result.status === 'passed',
      screenReaderCompatibility: testTitle.includes('screen reader') && result.status === 'passed',
      colorContrast: testTitle.includes('contrast') && result.status === 'passed',
      formLabels: testTitle.includes('label') && result.status === 'passed',
      ariaAttributes: testTitle.includes('aria') && result.status === 'passed',
      focusManagement: testTitle.includes('focus') && result.status === 'passed'
    };
  }

  private generateReport(): AccessibilityReport {
    const totalTests = this.accessibilityTests.length;
    const passed = this.accessibilityTests.filter(t => t.status === 'passed').length;
    const failed = this.accessibilityTests.filter(t => t.status === 'failed').length;
    const skipped = this.accessibilityTests.filter(t => t.status === 'skipped').length;

    const overallCompliance = totalTests > 0 ? (passed / totalTests) * 100 : 0;

    // Generate recommendations based on failed tests
    const recommendations = this.generateRecommendations();

    // Evaluate compliance
    const compliance = this.evaluateCompliance();

    return {
      summary: {
        totalTests,
        passed,
        failed,
        skipped,
        overallCompliance: Math.round(overallCompliance * 100) / 100,
        wcagLevel: 'AA'
      },
      tests: this.accessibilityTests,
      recommendations,
      compliance,
      generatedAt: new Date().toISOString(),
      component: 'CreateIncidentModal'
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const failedTests = this.accessibilityTests.filter(t => t.status === 'failed');

    if (failedTests.some(t => t.testName.includes('keyboard'))) {
      recommendations.push(
        '🔧 Melhorar navegação por teclado: Certificar que todos os elementos interativos são acessíveis via Tab e teclas de seta'
      );
    }

    if (failedTests.some(t => t.testName.includes('contrast'))) {
      recommendations.push(
        '🎨 Ajustar contraste de cores: Garantir que o contraste atenda aos padrões WCAG 2.1 AA (4.5:1 para texto normal)'
      );
    }

    if (failedTests.some(t => t.testName.includes('aria'))) {
      recommendations.push(
        '🏷️ Implementar atributos ARIA adequados: Adicionar aria-label, aria-describedby e role apropriados'
      );
    }

    if (failedTests.some(t => t.testName.includes('label'))) {
      recommendations.push(
        '📝 Melhorar labels de formulário: Associar corretamente labels com campos de entrada usando for/id'
      );
    }

    if (failedTests.some(t => t.testName.includes('focus'))) {
      recommendations.push(
        '🎯 Gerenciar foco adequadamente: Implementar trap de foco no modal e indicadores visuais claros'
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ Excelente! Todos os testes de acessibilidade passaram.');
    }

    return recommendations;
  }

  private evaluateCompliance() {
    const details = this.accessibilityTests.map(t => t.details);
    const totalDetails = details.length;

    if (totalDetails === 0) {
      return {
        wcag21AA: false,
        section508: false,
        keyboardNavigation: false,
        screenReader: false
      };
    }

    const keyboardNavigation = details.filter(d => d.keyboardNavigation).length / totalDetails >= 0.8;
    const screenReader = details.filter(d => d.screenReaderCompatibility).length / totalDetails >= 0.8;
    const formLabels = details.filter(d => d.formLabels).length / totalDetails >= 0.9;
    const ariaAttributes = details.filter(d => d.ariaAttributes).length / totalDetails >= 0.8;

    return {
      wcag21AA: keyboardNavigation && screenReader && formLabels,
      section508: keyboardNavigation && formLabels,
      keyboardNavigation,
      screenReader
    };
  }

  private saveReport(report: AccessibilityReport) {
    const reportPath = join(this.outputDir, 'accessibility-report.json');
    const htmlReportPath = join(this.outputDir, 'accessibility-report.html');

    // Save JSON report
    try {
      writeFileSync(reportPath, JSON.stringify(report, null, 2));
    } catch (error) {
      console.error('❌ Failed to save JSON report:', error);
    }

    // Generate and save HTML report
    const htmlContent = this.generateHTMLReport(report);
    try {
      writeFileSync(htmlReportPath, htmlContent);
    } catch (error) {
      console.error('❌ Failed to save HTML report:', error);
    }

    console.log(`\n📊 Accessibility reports saved:`);
    console.log(`   JSON: ${reportPath}`);
    console.log(`   HTML: ${htmlReportPath}`);
  }

  private generateHTMLReport(report: AccessibilityReport): string {
    const complianceColor = report.summary.overallCompliance >= 80 ? '#28a745' :
                           report.summary.overallCompliance >= 60 ? '#ffc107' : '#dc3545';

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Relatório de Acessibilidade - CreateIncidentModal</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f8f9fa; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 40px; }
        .score { font-size: 3em; font-weight: bold; color: ${complianceColor}; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
        .summary-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .compliance-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 30px 0; }
        .compliance-item { padding: 15px; border-radius: 8px; }
        .compliance-pass { background: #d4edda; border-left: 4px solid #28a745; }
        .compliance-fail { background: #f8d7da; border-left: 4px solid #dc3545; }
        .test-results { margin-top: 40px; }
        .test-item { margin: 10px 0; padding: 15px; border-radius: 8px; border-left: 4px solid; }
        .test-pass { background: #d4edda; border-color: #28a745; }
        .test-fail { background: #f8d7da; border-color: #dc3545; }
        .test-skip { background: #fff3cd; border-color: #ffc107; }
        .recommendations { background: #e7f3ff; padding: 20px; border-radius: 8px; margin: 30px 0; }
        .recommendations ul { list-style: none; padding: 0; }
        .recommendations li { margin: 10px 0; padding: 10px; background: white; border-radius: 4px; }
        .timestamp { text-align: center; color: #6c757d; margin-top: 30px; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🛡️ Relatório de Acessibilidade</h1>
            <h2>CreateIncidentModal - Accenture Mainframe Assistant</h2>
            <div class="score">${report.summary.overallCompliance}%</div>
            <p>Conformidade WCAG 2.1 AA</p>
        </div>

        <div class="summary">
            <div class="summary-card">
                <h3>✅ Passou</h3>
                <div style="font-size: 2em; font-weight: bold; color: #28a745;">${report.summary.passed}</div>
            </div>
            <div class="summary-card">
                <h3>❌ Falhou</h3>
                <div style="font-size: 2em; font-weight: bold; color: #dc3545;">${report.summary.failed}</div>
            </div>
            <div class="summary-card">
                <h3>⏭️ Ignorado</h3>
                <div style="font-size: 2em; font-weight: bold; color: #ffc107;">${report.summary.skipped}</div>
            </div>
            <div class="summary-card">
                <h3>📊 Total</h3>
                <div style="font-size: 2em; font-weight: bold; color: #6c757d;">${report.summary.totalTests}</div>
            </div>
        </div>

        <div class="compliance-grid">
            <div class="compliance-item ${report.compliance.wcag21AA ? 'compliance-pass' : 'compliance-fail'}">
                <h4>WCAG 2.1 AA</h4>
                <p>${report.compliance.wcag21AA ? '✅ Compatível' : '❌ Não compatível'}</p>
            </div>
            <div class="compliance-item ${report.compliance.keyboardNavigation ? 'compliance-pass' : 'compliance-fail'}">
                <h4>Navegação por Teclado</h4>
                <p>${report.compliance.keyboardNavigation ? '✅ Funcional' : '❌ Necessita melhorias'}</p>
            </div>
            <div class="compliance-item ${report.compliance.screenReader ? 'compliance-pass' : 'compliance-fail'}">
                <h4>Leitores de Tela</h4>
                <p>${report.compliance.screenReader ? '✅ Compatível' : '❌ Necessita melhorias'}</p>
            </div>
            <div class="compliance-item ${report.compliance.section508 ? 'compliance-pass' : 'compliance-fail'}">
                <h4>Section 508</h4>
                <p>${report.compliance.section508 ? '✅ Compatível' : '❌ Não compatível'}</p>
            </div>
        </div>

        <div class="recommendations">
            <h3>💡 Recomendações de Melhoria</h3>
            <ul>
                ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        </div>

        <div class="test-results">
            <h3>📋 Resultados Detalhados dos Testes</h3>
            ${report.tests.map(test => `
                <div class="test-item test-${test.status}">
                    <h4>${test.testName}</h4>
                    <p><strong>Status:</strong> ${test.status} | <strong>Duração:</strong> ${test.duration}ms</p>
                    ${test.errors.length > 0 ? `<p><strong>Erros:</strong> ${test.errors.join(', ')}</p>` : ''}
                </div>
            `).join('')}
        </div>

        <div class="timestamp">
            Relatório gerado em ${new Date(report.generatedAt).toLocaleString('pt-BR')}
        </div>
    </div>
</body>
</html>`;
  }

  private printSummary(report: AccessibilityReport) {
    console.log('\n🛡️ ═══════════════════════════════════════');
    console.log('    RELATÓRIO DE ACESSIBILIDADE FINAL');
    console.log('═══════════════════════════════════════\n');

    console.log(`📊 Resumo dos Testes:`);
    console.log(`   ✅ Passou: ${report.summary.passed}`);
    console.log(`   ❌ Falhou: ${report.summary.failed}`);
    console.log(`   ⏭️  Ignorado: ${report.summary.skipped}`);
    console.log(`   📊 Total: ${report.summary.totalTests}`);

    const complianceIcon = report.summary.overallCompliance >= 80 ? '🟢' :
                          report.summary.overallCompliance >= 60 ? '🟡' : '🔴';

    console.log(`\n${complianceIcon} Conformidade Geral: ${report.summary.overallCompliance}%`);

    console.log('\n🎯 Status de Conformidade:');
    console.log(`   WCAG 2.1 AA: ${report.compliance.wcag21AA ? '✅' : '❌'}`);
    console.log(`   Section 508: ${report.compliance.section508 ? '✅' : '❌'}`);
    console.log(`   Teclado: ${report.compliance.keyboardNavigation ? '✅' : '❌'}`);
    console.log(`   Leitor de Tela: ${report.compliance.screenReader ? '✅' : '❌'}`);

    if (report.recommendations.length > 0) {
      console.log('\n💡 Principais Recomendações:');
      report.recommendations.slice(0, 3).forEach(rec => {
        console.log(`   ${rec}`);
      });
    }

    console.log('\n═══════════════════════════════════════\n');
  }
}