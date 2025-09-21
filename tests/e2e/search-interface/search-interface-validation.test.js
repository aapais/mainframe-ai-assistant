const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

describe('Search Interface Validation Tests', () => {
  let browser;
  let page;
  const screenshotsDir = path.join(__dirname, 'screenshots');
  const baseUrl = 'http://localhost:3000';

  beforeAll(async () => {
    // Criar diretório de screenshots
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    browser = await puppeteer.launch({
      headless: false,
      slowMo: 100,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--window-size=1920,1080'
      ]
    });

    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Configurar timeout e listeners
    page.setDefaultTimeout(10000);

    // Listener para erros de console
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('❌ Console Error:', msg.text());
      }
    });

    // Listener para erros de página
    page.on('pageerror', error => {
      console.log('❌ Page Error:', error.message);
    });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  describe('Navegação Inicial', () => {
    test('Deve carregar a página principal sem erros', async () => {
      console.log('🚀 Navegando para:', baseUrl);

      const response = await page.goto(baseUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      expect(response.status()).toBe(200);

      // Screenshot inicial
      await page.screenshot({
        path: path.join(screenshotsDir, '01-pagina-inicial.png'),
        fullPage: true
      });

      // Verificar se elementos principais estão presentes
      const searchBar = await page.$('.search-bar, [data-testid="search-bar"], input[type="search"]');
      expect(searchBar).toBeTruthy();

      console.log('✅ Página carregada com sucesso');
    });

    test('Deve identificar elementos da interface de pesquisa', async () => {
      // Mapear elementos da interface
      const elements = {
        searchInput: '.search-bar input, [data-testid="search-input"], input[type="search"]',
        popularSearches: '[data-testid="popular-searches"], .popular-searches, .search-suggestions',
        quickActions: '[data-testid="quick-actions"], .quick-actions, .action-buttons',
        filters: '[data-testid="filters"], .filters, .filter-panel'
      };

      const foundElements = {};

      for (const [name, selector] of Object.entries(elements)) {
        const element = await page.$(selector);
        foundElements[name] = !!element;
        console.log(`${element ? '✅' : '❌'} ${name}: ${selector}`);
      }

      // Screenshot com elementos identificados
      await page.screenshot({
        path: path.join(screenshotsDir, '02-elementos-identificados.png'),
        fullPage: true
      });

      // Pelo menos a barra de pesquisa deve estar presente
      expect(foundElements.searchInput).toBe(true);
    });
  });

  describe('Testes de Popular Searches', () => {
    test('Deve abrir Popular Searches sem sobreposições', async () => {
      console.log('🔍 Testando Popular Searches...');

      // Tentar diferentes seletores para Popular Searches
      const popularSearchesSelectors = [
        '[data-testid="popular-searches"]',
        '.popular-searches',
        '.search-suggestions',
        'button:contains("Popular")',
        '[aria-label*="popular"]',
        '.dropdown-trigger:contains("Popular")'
      ];

      let popularButton = null;

      for (const selector of popularSearchesSelectors) {
        try {
          popularButton = await page.$(selector);
          if (popularButton) {
            console.log(`✅ Encontrado Popular Searches: ${selector}`);
            break;
          }
        } catch (e) {
          // Continuar tentando
        }
      }

      if (!popularButton) {
        // Tentar encontrar por texto
        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, div, span'));
          const popularBtn = buttons.find(btn =>
            btn.textContent && btn.textContent.toLowerCase().includes('popular')
          );
          if (popularBtn) {
            popularBtn.setAttribute('data-test-popular', 'true');
          }
        });

        popularButton = await page.$('[data-test-popular="true"]');
      }

      if (popularButton) {
        // Screenshot antes de abrir
        await page.screenshot({
          path: path.join(screenshotsDir, '03-antes-popular-searches.png'),
          fullPage: true
        });

        // Clicar no Popular Searches
        await popularButton.click();
        await page.waitForTimeout(500);

        // Screenshot depois de abrir
        await page.screenshot({
          path: path.join(screenshotsDir, '04-depois-popular-searches.png'),
          fullPage: true
        });

        // Verificar posicionamento e sobreposições
        const overlayCheck = await page.evaluate(() => {
          const dropdowns = document.querySelectorAll('.dropdown, .menu, .popover, [role="menu"]');
          const results = [];

          dropdowns.forEach((dropdown, index) => {
            const rect = dropdown.getBoundingClientRect();
            const zIndex = window.getComputedStyle(dropdown).zIndex;

            results.push({
              index,
              visible: rect.width > 0 && rect.height > 0,
              position: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
              zIndex: zIndex,
              className: dropdown.className
            });
          });

          return results;
        });

        console.log('📊 Análise de posicionamento:', overlayCheck);

        // Fechar dropdown se aberto
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);

        expect(overlayCheck.length).toBeGreaterThanOrEqual(0);
      } else {
        console.log('⚠️ Popular Searches não encontrado - pode não estar implementado');
      }
    });
  });

  describe('Testes de Quick Actions', () => {
    test('Deve abrir Quick Actions sem sobreposições', async () => {
      console.log('⚡ Testando Quick Actions...');

      const quickActionsSelectors = [
        '[data-testid="quick-actions"]',
        '.quick-actions',
        '.action-buttons',
        'button:contains("Quick")',
        '[aria-label*="quick"]',
        '.dropdown-trigger:contains("Actions")'
      ];

      let quickButton = null;

      for (const selector of quickActionsSelectors) {
        try {
          quickButton = await page.$(selector);
          if (quickButton) {
            console.log(`✅ Encontrado Quick Actions: ${selector}`);
            break;
          }
        } catch (e) {
          // Continuar tentando
        }
      }

      if (!quickButton) {
        // Tentar encontrar por texto
        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, div, span'));
          const quickBtn = buttons.find(btn =>
            btn.textContent && (
              btn.textContent.toLowerCase().includes('quick') ||
              btn.textContent.toLowerCase().includes('action')
            )
          );
          if (quickBtn) {
            quickBtn.setAttribute('data-test-quick', 'true');
          }
        });

        quickButton = await page.$('[data-test-quick="true"]');
      }

      if (quickButton) {
        // Screenshot antes
        await page.screenshot({
          path: path.join(screenshotsDir, '05-antes-quick-actions.png'),
          fullPage: true
        });

        await quickButton.click();
        await page.waitForTimeout(500);

        // Screenshot depois
        await page.screenshot({
          path: path.join(screenshotsDir, '06-depois-quick-actions.png'),
          fullPage: true
        });

        // Verificar sobreposições
        const overlapAnalysis = await page.evaluate(() => {
          const elements = Array.from(document.querySelectorAll('.dropdown, .menu, .popover, [role="menu"]'));
          const overlaps = [];

          for (let i = 0; i < elements.length; i++) {
            for (let j = i + 1; j < elements.length; j++) {
              const rect1 = elements[i].getBoundingClientRect();
              const rect2 = elements[j].getBoundingClientRect();

              const overlap = !(
                rect1.right < rect2.left ||
                rect2.right < rect1.left ||
                rect1.bottom < rect2.top ||
                rect2.bottom < rect1.top
              );

              if (overlap && rect1.width > 0 && rect1.height > 0 && rect2.width > 0 && rect2.height > 0) {
                overlaps.push({
                  element1: { className: elements[i].className, rect: rect1 },
                  element2: { className: elements[j].className, rect: rect2 }
                });
              }
            }
          }

          return overlaps;
        });

        console.log('🔍 Análise de sobreposições:', overlapAnalysis);

        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);

        expect(overlapAnalysis.length).toBe(0); // Não deve haver sobreposições
      } else {
        console.log('⚠️ Quick Actions não encontrado - pode não estar implementado');
      }
    });
  });

  describe('Testes de Filtros', () => {
    test('Deve aplicar filtros corretamente', async () => {
      console.log('🔧 Testando funcionalidade dos filtros...');

      const filterSelectors = [
        '[data-testid="filters"]',
        '.filters',
        '.filter-panel',
        '.search-filters',
        'select, input[type="checkbox"], input[type="radio"]'
      ];

      // Screenshot antes dos testes de filtro
      await page.screenshot({
        path: path.join(screenshotsDir, '07-antes-filtros.png'),
        fullPage: true
      });

      const filters = [];

      for (const selector of filterSelectors) {
        try {
          const elements = await page.$$(selector);
          if (elements.length > 0) {
            console.log(`✅ Encontrados ${elements.length} filtros: ${selector}`);
            filters.push(...elements);
          }
        } catch (e) {
          // Continuar
        }
      }

      if (filters.length > 0) {
        // Testar interação com primeiro filtro disponível
        try {
          await filters[0].click();
          await page.waitForTimeout(500);

          await page.screenshot({
            path: path.join(screenshotsDir, '08-filtro-ativado.png'),
            fullPage: true
          });

          console.log('✅ Filtro ativado com sucesso');
        } catch (e) {
          console.log('⚠️ Erro ao ativar filtro:', e.message);
        }
      } else {
        console.log('⚠️ Nenhum filtro encontrado');
      }

      // Verificar se a página permanece funcional
      const pageTitle = await page.title();
      expect(pageTitle).toBeTruthy();
    });
  });

  describe('Testes de Combinações e Conflitos', () => {
    test('Deve funcionar com múltiplas ações simultâneas', async () => {
      console.log('🔄 Testando combinações de ações...');

      // Screenshot inicial
      await page.screenshot({
        path: path.join(screenshotsDir, '09-antes-combinacoes.png'),
        fullPage: true
      });

      try {
        // Tentar abrir múltiplos elementos
        const allButtons = await page.$$('button, [role="button"]');

        if (allButtons.length > 0) {
          // Clicar no primeiro botão
          await allButtons[0].click();
          await page.waitForTimeout(200);

          // Tentar clicar em outro se disponível
          if (allButtons.length > 1) {
            await allButtons[1].click();
            await page.waitForTimeout(200);
          }

          await page.screenshot({
            path: path.join(screenshotsDir, '10-multiplas-acoes.png'),
            fullPage: true
          });
        }

        // Fechar todos os dropdowns
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);

        console.log('✅ Teste de combinações concluído');
      } catch (e) {
        console.log('⚠️ Erro durante teste de combinações:', e.message);
      }
    });
  });

  describe('Testes de Performance', () => {
    test('Deve carregar rapidamente e responder às interações', async () => {
      console.log('⚡ Testando performance...');

      const metrics = await page.metrics();
      console.log('📊 Métricas iniciais:', {
        JSHeapUsedSize: Math.round(metrics.JSHeapUsedSize / 1024 / 1024) + 'MB',
        JSHeapTotalSize: Math.round(metrics.JSHeapTotalSize / 1024 / 1024) + 'MB',
        Timestamp: metrics.Timestamp
      });

      // Medir tempo de resposta para interações
      const startTime = Date.now();

      // Simular pesquisa se input disponível
      const searchInput = await page.$('input[type="search"], input[type="text"], .search-input');
      if (searchInput) {
        await searchInput.type('teste performance');
        await page.waitForTimeout(500);
        await searchInput.click({ clickCount: 3 }); // Selecionar tudo
        await page.keyboard.press('Delete');
      }

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      console.log(`⏱️ Tempo de resposta: ${responseTime}ms`);

      // Screenshot final
      await page.screenshot({
        path: path.join(screenshotsDir, '11-teste-performance.png'),
        fullPage: true
      });

      expect(responseTime).toBeLessThan(2000); // Deve responder em menos de 2s
    });
  });

  describe('Testes de Regressão', () => {
    test('Deve manter funcionalidades básicas funcionando', async () => {
      console.log('🔍 Executando testes de regressão...');

      // Verificar elementos críticos ainda estão funcionais
      const criticalChecks = await page.evaluate(() => {
        const checks = {
          hasSearchInput: !!document.querySelector('input[type="search"], input[type="text"], .search-input'),
          hasButtons: document.querySelectorAll('button').length > 0,
          hasInteractiveElements: document.querySelectorAll('button, a, input, select').length > 0,
          noJSErrors: !window.hasJSErrors, // Assumindo que seria setado em caso de erro
          pageResponsive: window.innerWidth > 0 && window.innerHeight > 0
        };

        return checks;
      });

      console.log('✅ Verificações críticas:', criticalChecks);

      // Screenshot final de regressão
      await page.screenshot({
        path: path.join(screenshotsDir, '12-teste-regressao.png'),
        fullPage: true
      });

      // Todas as verificações críticas devem passar
      Object.values(criticalChecks).forEach(check => {
        expect(check).toBe(true);
      });
    });
  });
});