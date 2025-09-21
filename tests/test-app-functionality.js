// Usar npx para importar puppeteer
const { spawn } = require('child_process');
const fs = require('fs');

// Função para executar com npx
async function runPuppeteerTest() {
  const puppeteerScript = `
const puppeteer = require('puppeteer');
const path = require('path');

async function testApplication() {
  console.log('🚀 Iniciando teste da aplicação na porta 3002...\n');

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/tmp/puppeteer-browsers/chrome/linux-140.0.7339.82/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // Arrays para capturar logs e erros
  const consoleMessages = [];
  const errors = [];

  // Capturar erros do console
  page.on('console', msg => {
    const logMessage = `[${msg.type().toUpperCase()}] ${msg.text()}`;
    consoleMessages.push(logMessage);
    console.log('Console:', logMessage);
  });

  page.on('pageerror', error => {
    const errorMessage = `Page Error: ${error.message}`;
    errors.push(errorMessage);
    console.log('❌', errorMessage);
  });

  page.on('requestfailed', request => {
    const failMessage = `Request Failed: ${request.url()} - ${request.failure()?.errorText}`;
    errors.push(failMessage);
    console.log('🔥', failMessage);
  });

  try {
    // 1. Testar carregamento da página
    console.log('📋 1. Testando carregamento da página...');
    await page.goto('http://localhost:3002', {
      waitUntil: 'networkidle2',
      timeout: 10000
    });
    console.log('✅ Página carregou com sucesso');

    // 2. Verificar título da aplicação
    console.log('\n📋 2. Verificando título da aplicação...');
    const title = await page.title();
    console.log('Título da página:', title);

    // Buscar por diferentes variações do título
    const titleSelectors = [
      'h1',
      '[data-testid="app-title"]',
      '.title',
      '.app-title',
      'header h1',
      '[role="banner"] h1'
    ];

    let mainTitle = null;
    for (const selector of titleSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const text = await page.evaluate(el => el.textContent, element);
          if (text && text.trim()) {
            mainTitle = text.trim();
            console.log(`✅ Título encontrado (${selector}):`, mainTitle);
            break;
          }
        }
      } catch (e) {
        // Continuar tentando outros seletores
      }
    }

    if (!mainTitle) {
      console.log('⚠️  Título principal não encontrado com os seletores padrão');
    }

    // 3. Verificar componente de busca
    console.log('\n📋 3. Verificando componente de busca...');
    const searchSelectors = [
      '[data-testid="search-input"]',
      'input[type="search"]',
      'input[placeholder*="Search"]',
      'input[placeholder*="search"]',
      'input[placeholder*="busca"]',
      'input[placeholder*="Busca"]',
      '.search-input',
      '#search',
      '[role="searchbox"]'
    ];

    let searchFound = false;
    for (const selector of searchSelectors) {
      const searchElement = await page.$(selector);
      if (searchElement) {
        const placeholder = await page.evaluate(el => el.placeholder || el.getAttribute('aria-label') || '', searchElement);
        console.log(`✅ Componente de busca encontrado (${selector}):`, placeholder);
        searchFound = true;
        break;
      }
    }

    if (!searchFound) {
      console.log('⚠️  Componente de busca não encontrado com os seletores padrão');
    }

    // 4. Verificar dropdowns e possíveis sobreposições
    console.log('\n📋 4. Verificando dropdowns e sobreposições...');

    const dropdownSelectors = [
      '[data-testid*="dropdown"]',
      '.dropdown',
      '[role="combobox"]',
      '[role="listbox"]',
      'select',
      '.select',
      '[aria-haspopup="listbox"]'
    ];

    const dropdowns = [];
    for (const selector of dropdownSelectors) {
      const elements = await page.$$(selector);
      for (const element of elements) {
        const rect = await page.evaluate(el => {
          const box = el.getBoundingClientRect();
          return {
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
            text: el.textContent?.trim() || el.value || el.getAttribute('aria-label') || 'Dropdown'
          };
        }, element);

        if (rect.width > 0 && rect.height > 0) {
          dropdowns.push({selector, ...rect});
        }
      }
    }

    console.log(`Encontrados ${dropdowns.length} elementos dropdown/select`);
    dropdowns.forEach((dropdown, index) => {
      console.log(`  ${index + 1}. ${dropdown.text} - Posição: (${Math.round(dropdown.x)}, ${Math.round(dropdown.y)}) - Tamanho: ${Math.round(dropdown.width)}x${Math.round(dropdown.height)}`);
    });

    // Verificar sobreposições
    const overlaps = [];
    for (let i = 0; i < dropdowns.length; i++) {
      for (let j = i + 1; j < dropdowns.length; j++) {
        const a = dropdowns[i];
        const b = dropdowns[j];

        const isOverlapping = !(a.x + a.width < b.x ||
                               b.x + b.width < a.x ||
                               a.y + a.height < b.y ||
                               b.y + b.height < a.y);

        if (isOverlapping) {
          overlaps.push({a: a.text, b: b.text});
        }
      }
    }

    if (overlaps.length > 0) {
      console.log('⚠️  Possíveis sobreposições detectadas:');
      overlaps.forEach(overlap => {
        console.log(`   - "${overlap.a}" sobrepõe-se com "${overlap.b}"`);
      });
    } else {
      console.log('✅ Nenhuma sobreposição detectada entre dropdowns');
    }

    // 5. Procurar por elementos específicos mencionados
    console.log('\n📋 5. Procurando elementos específicos...');

    const specificElements = [
      { name: 'Popular searches', selectors: ['[data-testid*="popular"]', '*[contains(text(), "Popular")]', '.popular-searches'] },
      { name: 'Quick actions', selectors: ['[data-testid*="quick"]', '*[contains(text(), "Quick")]', '.quick-actions'] }
    ];

    for (const elementGroup of specificElements) {
      let found = false;
      for (const selector of elementGroup.selectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            const text = await page.evaluate(el => el.textContent, element);
            console.log(`✅ ${elementGroup.name} encontrado:`, text?.trim());
            found = true;
            break;
          }
        } catch (e) {
          // Continuar
        }
      }

      if (!found) {
        // Tentar busca por texto
        try {
          const textElement = await page.evaluateHandle((searchText) => {
            const walker = document.createTreeWalker(
              document.body,
              NodeFilter.SHOW_TEXT,
              null,
              false
            );

            let node;
            while (node = walker.nextNode()) {
              if (node.textContent.toLowerCase().includes(searchText.toLowerCase())) {
                return node.parentElement;
              }
            }
            return null;
          }, elementGroup.name.split(' ')[0]);

          if (textElement.asElement()) {
            console.log(`✅ ${elementGroup.name} encontrado por busca de texto`);
          } else {
            console.log(`⚠️  ${elementGroup.name} não encontrado`);
          }
        } catch (e) {
          console.log(`⚠️  ${elementGroup.name} não encontrado`);
        }
      }
    }

    // 6. Capturar screenshot
    console.log('\n📋 6. Capturando screenshot...');
    const screenshotPath = '/mnt/c/mainframe-ai-assistant/tests/test-result.png';
    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });
    console.log(`✅ Screenshot salvo em: ${screenshotPath}`);

    // 7. Análise final
    console.log('\n📋 7. Análise final...');
    console.log('='.repeat(50));
    console.log('RELATÓRIO DE TESTE DA APLICAÇÃO');
    console.log('='.repeat(50));

    console.log('\n📊 RESUMO:');
    console.log(`✅ Aplicação acessível na porta 3002: SIM`);
    console.log(`✅ Página carrega sem erros críticos: ${errors.length === 0 ? 'SIM' : 'NÃO'}`);
    console.log(`✅ Título encontrado: ${mainTitle ? 'SIM' : 'NÃO'}`);
    console.log(`✅ Componente de busca presente: ${searchFound ? 'SIM' : 'NÃO'}`);
    console.log(`✅ Dropdowns sem sobreposição: ${overlaps.length === 0 ? 'SIM' : 'NÃO'}`);

    if (errors.length > 0) {
      console.log('\n❌ ERROS DETECTADOS:');
      errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    if (consoleMessages.length > 0) {
      console.log('\n📝 MENSAGENS DO CONSOLE:');
      consoleMessages.slice(-5).forEach((msg, index) => {
        console.log(`   ${msg}`);
      });
      if (consoleMessages.length > 5) {
        console.log(`   ... e mais ${consoleMessages.length - 5} mensagens`);
      }
    }

    console.log('\n🎯 RECOMENDAÇÕES:');
    if (!mainTitle || !mainTitle.includes('Accenture')) {
      console.log('   - Verificar se o título "Accenture Mainframe AI Assistant" está presente');
    }
    if (!searchFound) {
      console.log('   - Verificar se o componente de busca está implementado e visível');
    }
    if (overlaps.length > 0) {
      console.log('   - Corrigir sobreposições de elementos UI detectadas');
    }
    if (errors.length > 0) {
      console.log('   - Resolver erros JavaScript detectados');
    }

  } catch (error) {
    console.log('❌ Erro durante o teste:', error.message);

    // Tentar capturar screenshot mesmo com erro
    try {
      await page.screenshot({
        path: '/mnt/c/mainframe-ai-assistant/tests/test-error.png',
        fullPage: true
      });
      console.log('📸 Screenshot de erro salvo em: test-error.png');
    } catch (screenshotError) {
      console.log('⚠️  Não foi possível capturar screenshot de erro');
    }
  } finally {
    await browser.close();
    console.log('\n🏁 Teste concluído!');
  }
}

// Executar o teste
testApplication().catch(console.error);