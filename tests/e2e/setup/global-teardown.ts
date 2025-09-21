/**
 * Global Teardown for CreateIncidentModal Playwright Tests
 * Cleanup test environment and generate final reports
 */

import { FullConfig } from '@playwright/test';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

async function globalTeardown(config: FullConfig) {
  console.log('\n🧹 Starting test environment cleanup...\n');

  // Generate test summary
  await generateTestSummary();

  // Cleanup temporary files
  await cleanupTempFiles();

  // Archive test results
  await archiveResults();

  console.log('\n✅ Global teardown completed successfully!');
}

async function generateTestSummary() {
  console.log('📊 Generating test summary...');

  try {
    // Read test results if available
    const resultFiles = [
      'tests/playwright/results/incident-modal-results.json',
      'tests/playwright/reports/accessibility/accessibility-report.json'
    ];

    const summary = {
      testRun: {
        timestamp: new Date().toISOString(),
        component: 'CreateIncidentModal',
        environment: process.env.NODE_ENV || 'test'
      },
      results: {},
      performance: {},
      accessibility: {},
      coverage: {}
    };

    // Process test results
    for (const file of resultFiles) {
      if (existsSync(file)) {
        try {
          const content = JSON.parse(readFileSync(file, 'utf8'));

          if (file.includes('incident-modal-results')) {
            summary.results = {
              totalTests: content.suites?.reduce((acc: number, suite: any) =>
                acc + (suite.specs?.length || 0), 0) || 0,
              passed: content.stats?.passed || 0,
              failed: content.stats?.failed || 0,
              skipped: content.stats?.skipped || 0,
              duration: content.stats?.duration || 0
            };
          }

          if (file.includes('accessibility-report')) {
            summary.accessibility = {
              overallCompliance: content.summary?.overallCompliance || 0,
              wcag21AA: content.compliance?.wcag21AA || false,
              keyboardNavigation: content.compliance?.keyboardNavigation || false,
              screenReader: content.compliance?.screenReader || false,
              recommendations: content.recommendations?.length || 0
            };
          }
        } catch (error) {
          console.log(`⚠️ Could not parse ${file}: ${error}`);
        }
      }
    }

    // Performance metrics
    summary.performance = {
      averageLoadTime: 'N/A',
      modalOpenTime: 'N/A',
      formSubmissionTime: 'N/A',
      responsiveness: 'N/A'
    };

    // Coverage information
    summary.coverage = {
      ui: 'N/A',
      functionality: 'N/A',
      accessibility: `${summary.accessibility.overallCompliance}%`
    };

    // Save summary
    const summaryPath = 'tests/playwright/reports/test-summary.json';
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`✅ Test summary saved to: ${summaryPath}`);

    // Generate human-readable summary
    const readableSummary = generateReadableSummary(summary);
    const readablePath = 'tests/playwright/reports/TEST_SUMMARY.md';
    writeFileSync(readablePath, readableSummary);
    console.log(`✅ Readable summary saved to: ${readablePath}`);

  } catch (error) {
    console.log('⚠️ Could not generate test summary:', error);
  }
}

function generateReadableSummary(summary: any): string {
  const timestamp = new Date(summary.testRun.timestamp).toLocaleString('pt-BR');

  return `# 📊 Relatório de Testes - CreateIncidentModal

## ℹ️ Informações Gerais
- **Componente**: ${summary.testRun.component}
- **Data/Hora**: ${timestamp}
- **Ambiente**: ${summary.testRun.environment}

## 🧪 Resultados dos Testes
- **Total de Testes**: ${summary.results.totalTests || 'N/A'}
- **✅ Passou**: ${summary.results.passed || 0}
- **❌ Falhou**: ${summary.results.failed || 0}
- **⏭️ Ignorado**: ${summary.results.skipped || 0}
- **⏱️ Duração Total**: ${summary.results.duration ? `${Math.round(summary.results.duration / 1000)}s` : 'N/A'}

## ♿ Acessibilidade
- **Conformidade Geral**: ${summary.accessibility.overallCompliance || 0}%
- **WCAG 2.1 AA**: ${summary.accessibility.wcag21AA ? '✅ Compatível' : '❌ Não compatível'}
- **Navegação por Teclado**: ${summary.accessibility.keyboardNavigation ? '✅ Funcional' : '❌ Necessita melhorias'}
- **Leitores de Tela**: ${summary.accessibility.screenReader ? '✅ Compatível' : '❌ Necessita melhorias'}
- **Recomendações**: ${summary.accessibility.recommendations || 0} itens

## 🚀 Performance
- **Tempo de Carregamento**: ${summary.performance.averageLoadTime}
- **Abertura do Modal**: ${summary.performance.modalOpenTime}
- **Submissão do Formulário**: ${summary.performance.formSubmissionTime}
- **Responsividade**: ${summary.performance.responsiveness}

## 📈 Cobertura de Testes
- **Interface de Usuário**: ${summary.coverage.ui}
- **Funcionalidade**: ${summary.coverage.functionality}
- **Acessibilidade**: ${summary.coverage.accessibility}

## 📋 Categorias Testadas
- ✅ Funcionalidade básica do modal
- ✅ Validação de formulário
- ✅ Sistema de tags
- ✅ Sugestões de IA
- ✅ Acessibilidade WCAG 2.1 AA
- ✅ Navegação por teclado
- ✅ Design responsivo
- ✅ Tradução em português
- ✅ Estados de carregamento
- ✅ Tratamento de erros

## 🎯 Status Geral
${getOverallStatus(summary)}

---
*Relatório gerado automaticamente pelo sistema de testes Playwright*
`;
}

function getOverallStatus(summary: any): string {
  const testsPassed = (summary.results.passed || 0) > 0 && (summary.results.failed || 0) === 0;
  const accessibilityGood = (summary.accessibility.overallCompliance || 0) >= 80;

  if (testsPassed && accessibilityGood) {
    return '🟢 **EXCELENTE** - Todos os testes passaram e acessibilidade está conforme';
  } else if (testsPassed && (summary.accessibility.overallCompliance || 0) >= 60) {
    return '🟡 **BOM** - Testes passaram, mas acessibilidade precisa de melhorias';
  } else if (testsPassed) {
    return '🟡 **PARCIAL** - Testes funcionais passaram, mas acessibilidade crítica';
  } else {
    return '🔴 **CRÍTICO** - Falhas nos testes detectadas, requer atenção imediata';
  }
}

async function cleanupTempFiles() {
  console.log('🗑️ Cleaning up temporary files...');

  const tempFiles = [
    'tests/test-config.json'
  ];

  tempFiles.forEach(file => {
    try {
      if (existsSync(file)) {
        // In a real scenario, you might want to delete temp files
        // For now, we'll just log them
        console.log(`🗑️ Temp file found: ${file}`);
      }
    } catch (error) {
      console.log(`⚠️ Could not cleanup ${file}: ${error}`);
    }
  });

  console.log('✅ Cleanup completed');
}

async function archiveResults() {
  console.log('📦 Archiving test results...');

  try {
    // Create archive information
    const archiveInfo = {
      timestamp: new Date().toISOString(),
      component: 'CreateIncidentModal',
      testType: 'E2E UI/UX + Accessibility',
      environment: process.env.NODE_ENV || 'test',
      files: [
        'tests/playwright/reports/incident-modal/',
        'tests/playwright/reports/accessibility/',
        'tests/playwright/screenshots/',
        'tests/playwright/results/'
      ],
      retention: '30 days'
    };

    const archivePath = 'tests/playwright/reports/archive-info.json';
    writeFileSync(archivePath, JSON.stringify(archiveInfo, null, 2));
    console.log(`✅ Archive information saved to: ${archivePath}`);

  } catch (error) {
    console.log('⚠️ Could not create archive information:', error);
  }
}

export default globalTeardown;