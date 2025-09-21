#!/usr/bin/env node

/**
 * Execução direta dos testes sem Jest
 * Para evitar conflitos de configuração
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

class DirectSearchTest {
  constructor() {
    this.baseUrl = 'http://localhost:3000';
    this.screenshotsDir = path.join(__dirname, 'screenshots');
    this.reportsDir = path.join(__dirname, 'reports');
    this.testResults = [];
  }

  async setup() {
    // Criar diretórios
    [this.screenshotsDir, this.reportsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    this.browser = await puppeteer.launch({
      headless: false,
      slowMo: 200,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--window-size=1920,1080'
      ]
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1920, height: 1080 });
    this.page.setDefaultTimeout(10000);

    // Console listeners
    this.page.on('console', msg => {
      console.log(`🔍 Console [${msg.type()}]:`, msg.text());
    });

    this.page.on('pageerror', error => {
      console.log('❌ Page Error:', error.message);
    });
  }

  async takeScreenshot(name) {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    const filename = `${timestamp}-${name}.png`;
    const filepath = path.join(this.screenshotsDir, filename);

    await this.page.screenshot({
      path: filepath,
      fullPage: true
    });

    console.log(`📸 Screenshot: ${filename}`);
    return filename;
  }

  async testPageLoad() {
    console.log('\n🚀 Teste 1: Carregamento da página');

    try {
      const response = await this.page.goto(this.baseUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      const success = response.status() === 200;
      await this.takeScreenshot('01-page-load');

      this.testResults.push({
        test: 'Page Load',
        success,
        details: `Status: ${response.status()}`
      });

      console.log(success ? '✅ Página carregada' : '❌ Falha no carregamento');
      return success;

    } catch (error) {
      console.log('❌ Erro:', error.message);
      this.testResults.push({
        test: 'Page Load',
        success: false,
        details: error.message
      });
      return false;
    }
  }

  async testSearchElements() {
    console.log('\n🔍 Teste 2: Elementos de pesquisa');

    try {
      // Procurar por diferentes tipos de input de pesquisa
      const searchSelectors = [
        'input[type="search"]',
        'input[type="text"]',
        '.search-input',
        '[data-testid="search"]',
        '[placeholder*="search"]',
        '[placeholder*="Search"]',
        '[placeholder*="pesquisa"]',
        '.search-bar input'
      ];

      let searchInput = null;
      let foundSelector = '';

      for (const selector of searchSelectors) {
        try {
          searchInput = await this.page.$(selector);
          if (searchInput) {
            foundSelector = selector;
            break;
          }
        } catch (e) {
          // Continue
        }
      }

      await this.takeScreenshot('02-search-elements');

      const success = !!searchInput;
      this.testResults.push({
        test: 'Search Elements',
        success,
        details: success ? `Encontrado: ${foundSelector}` : 'Nenhum input de pesquisa encontrado'
      });

      console.log(success ? `✅ Input encontrado: ${foundSelector}` : '❌ Input não encontrado');
      return success;

    } catch (error) {
      console.log('❌ Erro:', error.message);
      this.testResults.push({
        test: 'Search Elements',
        success: false,
        details: error.message
      });
      return false;
    }
  }

  async testDropdowns() {
    console.log('\n📋 Teste 3: Dropdowns e menus');

    try {
      // Procurar por botões que podem abrir dropdowns
      const buttonSelectors = [
        'button',
        '[role="button"]',
        '.dropdown-trigger',
        '.menu-trigger'
      ];

      const buttons = [];
      for (const selector of buttonSelectors) {
        const elements = await this.page.$$(selector);
        buttons.push(...elements);
      }

      console.log(`🔍 Encontrados ${buttons.length} botões/elementos clicáveis`);

      await this.takeScreenshot('03-before-dropdowns');

      let dropdownsFound = 0;

      // Testar primeiros 3 botões
      for (let i = 0; i < Math.min(buttons.length, 3); i++) {
        try {
          await buttons[i].click();
          await this.page.waitForTimeout(500);

          // Verificar se algum dropdown apareceu
          const dropdowns = await this.page.$$('.dropdown, .menu, .popover, [role="menu"]');
          if (dropdowns.length > 0) {
            dropdownsFound++;
            console.log(`✅ Dropdown ${i + 1} encontrado`);

            await this.takeScreenshot(`04-dropdown-${i + 1}`);

            // Fechar dropdown
            await this.page.keyboard.press('Escape');
            await this.page.waitForTimeout(300);
          }
        } catch (e) {
          console.log(`⚠️ Erro testando botão ${i + 1}:`, e.message);
        }
      }

      this.testResults.push({
        test: 'Dropdowns',
        success: dropdownsFound > 0,
        details: `${dropdownsFound} dropdowns funcionais encontrados de ${Math.min(buttons.length, 3)} testados`
      });

      return dropdownsFound > 0;

    } catch (error) {
      console.log('❌ Erro:', error.message);
      this.testResults.push({
        test: 'Dropdowns',
        success: false,
        details: error.message
      });
      return false;
    }
  }

  async testOverlaps() {
    console.log('\n🔄 Teste 4: Verificação de sobreposições');

    try {
      // Abrir múltiplos elementos se possível
      const buttons = await this.page.$$('button, [role="button"]');

      if (buttons.length >= 2) {
        // Clicar no primeiro
        await buttons[0].click();
        await this.page.waitForTimeout(300);

        // Clicar no segundo
        await buttons[1].click();
        await this.page.waitForTimeout(300);

        await this.takeScreenshot('05-multiple-elements');
      }

      // Verificar sobreposições
      const overlaps = await this.page.evaluate(() => {
        const dropdowns = Array.from(document.querySelectorAll('.dropdown, .menu, .popover, [role="menu"]'));
        const overlapping = [];

        for (let i = 0; i < dropdowns.length; i++) {
          for (let j = i + 1; j < dropdowns.length; j++) {
            const rect1 = dropdowns[i].getBoundingClientRect();
            const rect2 = dropdowns[j].getBoundingClientRect();

            const overlap = !(
              rect1.right < rect2.left ||
              rect2.right < rect1.left ||
              rect1.bottom < rect2.top ||
              rect2.bottom < rect1.top
            );

            if (overlap && rect1.width > 0 && rect1.height > 0 && rect2.width > 0 && rect2.height > 0) {
              overlapping.push({
                element1: dropdowns[i].className,
                element2: dropdowns[j].className
              });
            }
          }
        }

        return overlapping;
      });

      const success = overlaps.length === 0;
      this.testResults.push({
        test: 'Overlaps Check',
        success,
        details: success ? 'Nenhuma sobreposição detectada' : `${overlaps.length} sobreposições encontradas`
      });

      console.log(success ? '✅ Sem sobreposições' : `❌ ${overlaps.length} sobreposições encontradas`);

      // Fechar todos os dropdowns
      await this.page.keyboard.press('Escape');
      await this.page.keyboard.press('Escape');

      return success;

    } catch (error) {
      console.log('❌ Erro:', error.message);
      this.testResults.push({
        test: 'Overlaps Check',
        success: false,
        details: error.message
      });
      return false;
    }
  }

  async testPerformance() {
    console.log('\n⚡ Teste 5: Performance');

    try {
      const metrics = await this.page.metrics();

      const performanceData = {
        JSHeapUsedSize: Math.round(metrics.JSHeapUsedSize / 1024 / 1024),
        JSHeapTotalSize: Math.round(metrics.JSHeapTotalSize / 1024 / 1024),
        timestamp: metrics.Timestamp
      };

      console.log('📊 Métricas:', performanceData);

      // Teste de responsividade - pesquisa
      const searchInput = await this.page.$('input[type="search"], input[type="text"], .search-input');
      if (searchInput) {
        const startTime = Date.now();
        await searchInput.type('teste');
        await this.page.waitForTimeout(100);
        const endTime = Date.now();

        const responseTime = endTime - startTime;
        console.log(`⏱️ Tempo de resposta: ${responseTime}ms`);

        await searchInput.click({ clickCount: 3 });
        await searchInput.press('Delete');
      }

      await this.takeScreenshot('06-performance-test');

      const success = performanceData.JSHeapUsedSize < 100; // Menos de 100MB
      this.testResults.push({
        test: 'Performance',
        success,
        details: `Memória: ${performanceData.JSHeapUsedSize}MB`
      });

      return success;

    } catch (error) {
      console.log('❌ Erro:', error.message);
      this.testResults.push({
        test: 'Performance',
        success: false,
        details: error.message
      });
      return false;
    }
  }

  generateReport() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(this.reportsDir, `direct-test-report-${timestamp}.md`);

    const successCount = this.testResults.filter(r => r.success).length;
    const totalCount = this.testResults.length;
    const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0;

    const report = `# Relatório de Testes Diretos - Interface de Pesquisa

## 📊 Resumo Executivo

**Data/Hora:** ${new Date().toLocaleString('pt-BR')}
**URL Testada:** ${this.baseUrl}
**Taxa de Sucesso:** ${successRate}% (${successCount}/${totalCount})
**Status Geral:** ${successRate >= 80 ? '✅ APROVADO' : '❌ NECESSITA CORREÇÕES'}

## 📋 Resultados dos Testes

${this.testResults.map((result, index) => `
### ${index + 1}. ${result.test}

**Status:** ${result.success ? '✅ PASSOU' : '❌ FALHOU'}
**Detalhes:** ${result.details}
`).join('\n')}

## 📸 Screenshots Capturadas

Os screenshots foram salvos em: \`${this.screenshotsDir}\`

## 🎯 Análise

### Funcionalidades Testadas

- **Carregamento da Página:** ${this.testResults.find(r => r.test === 'Page Load')?.success ? 'Funcionando' : 'Com problemas'}
- **Elementos de Pesquisa:** ${this.testResults.find(r => r.test === 'Search Elements')?.success ? 'Encontrados' : 'Não encontrados'}
- **Dropdowns:** ${this.testResults.find(r => r.test === 'Dropdowns')?.success ? 'Funcionais' : 'Com problemas'}
- **Sobreposições:** ${this.testResults.find(r => r.test === 'Overlaps Check')?.success ? 'Corrigidas' : 'Detectadas'}
- **Performance:** ${this.testResults.find(r => r.test === 'Performance')?.success ? 'Adequada' : 'Precisa otimização'}

### Recomendações

${successRate >= 80 ? `
✅ **Interface Aprovada**

A interface de pesquisa está funcionando adequadamente:
- Elementos básicos funcionais
- Sem conflitos críticos detectados
- Performance dentro do esperado

**Próximos passos:**
- Monitorar em produção
- Implementar testes automatizados no CI/CD
` : `
❌ **Correções Necessárias**

Foram identificados problemas que precisam ser resolvidos:
- Revisar elementos que falharam nos testes
- Corrigir sobreposições se detectadas
- Otimizar performance se necessário

**Próximos passos:**
- Aplicar correções específicas
- Re-executar testes
- Validar correções antes do deploy
`}

---

**Relatório gerado automaticamente em ${new Date().toLocaleString('pt-BR')}**
`;

    fs.writeFileSync(reportPath, report);
    console.log(`\n📄 Relatório salvo: ${reportPath}`);

    return { reportPath, successRate };
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async run() {
    try {
      console.log('🚀 Iniciando testes diretos da interface de pesquisa...');

      await this.setup();

      // Executar testes sequencialmente
      await this.testPageLoad();
      await this.testSearchElements();
      await this.testDropdowns();
      await this.testOverlaps();
      await this.testPerformance();

      const { reportPath, successRate } = this.generateReport();

      console.log('\n🎉 Testes concluídos!');
      console.log(`📊 Taxa de sucesso: ${successRate}%`);
      console.log(`📄 Relatório: ${reportPath}`);

      if (successRate >= 80) {
        console.log('✅ Interface aprovada nos testes!');
      } else {
        console.log('❌ Interface necessita correções');
      }

    } catch (error) {
      console.error('💥 Erro durante os testes:', error);
    } finally {
      await this.cleanup();
    }
  }
}

// Executar
if (require.main === module) {
  const tester = new DirectSearchTest();
  tester.run().catch(console.error);
}

module.exports = DirectSearchTest;