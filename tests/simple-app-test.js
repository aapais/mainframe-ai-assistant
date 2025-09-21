// Teste simples da aplicação usando apenas Node.js built-ins
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

async function testApplicationBasic() {
  console.log('🚀 Iniciando teste básico da aplicação na porta 3002...\n');

  try {
    // 1. Verificar se a aplicação responde
    console.log('📋 1. Testando conectividade da aplicação...');

    const testConnectivity = () => {
      return new Promise((resolve, reject) => {
        const req = http.get('http://localhost:3002', (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            resolve({ statusCode: res.statusCode, headers: res.headers, body: data });
          });
        });

        req.on('error', (err) => {
          reject(err);
        });

        req.setTimeout(5000, () => {
          req.destroy();
          reject(new Error('Timeout'));
        });
      });
    };

    const response = await testConnectivity();
    console.log(`✅ Aplicação respondeu com status: ${response.statusCode}`);
    console.log(`✅ Content-Type: ${response.headers['content-type']}`);

    // 2. Analisar o HTML retornado
    console.log('\n📋 2. Analisando conteúdo HTML...');
    const html = response.body;

    // Verificar título
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Não encontrado';
    console.log(`Título da página: "${title}"`);

    // Verificar se contém "Accenture"
    const hasAccenture = html.toLowerCase().includes('accenture');
    console.log(`✅ Contém "Accenture": ${hasAccenture ? 'SIM' : 'NÃO'}`);

    // Verificar se contém "Mainframe"
    const hasMainframe = html.toLowerCase().includes('mainframe');
    console.log(`✅ Contém "Mainframe": ${hasMainframe ? 'SIM' : 'NÃO'}`);

    // Verificar elementos de busca
    const hasSearchInput = html.match(/<input[^>]*(?:type=["']search["']|placeholder[^>]*search)/i);
    console.log(`✅ Elemento de busca encontrado: ${hasSearchInput ? 'SIM' : 'NÃO'}`);

    // Verificar dropdowns/selects
    const selectElements = html.match(/<select[^>]*>/gi) || [];
    const dropdownElements = html.match(/dropdown/gi) || [];
    console.log(`✅ Elementos select encontrados: ${selectElements.length}`);
    console.log(`✅ Referências a "dropdown": ${dropdownElements.length}`);

    // Verificar scripts e possíveis erros
    const scriptTags = html.match(/<script[^>]*>/gi) || [];
    console.log(`✅ Scripts carregados: ${scriptTags.length}`);

    // 3. Tentar screenshot com headless browser via comando
    console.log('\n📋 3. Tentando capturar screenshot com Puppeteer...');

    const screenshotScript = `
const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: '/tmp/puppeteer-browsers/chrome/linux-140.0.7339.82/chrome-linux64/chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Capturar erros
    const errors = [];
    page.on('pageerror', error => {
      errors.push(error.message);
      console.log('Error:', error.message);
    });

    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Console Error:', msg.text());
      }
    });

    await page.goto('http://localhost:3002', {
      waitUntil: 'networkidle2',
      timeout: 10000
    });

    // Verificar título na página renderizada
    const pageTitle = await page.title();
    console.log('Título renderizado:', pageTitle);

    // Verificar se componente de busca está visível
    const searchVisible = await page.evaluate(() => {
      const searchSelectors = [
        'input[type="search"]',
        'input[placeholder*="search" i]',
        'input[placeholder*="busca" i]',
        '[data-testid*="search"]',
        '.search-input',
        '#search'
      ];

      for (const selector of searchSelectors) {
        const element = document.querySelector(selector);
        if (element && element.offsetParent !== null) {
          return { found: true, selector, placeholder: element.placeholder };
        }
      }
      return { found: false };
    });

    console.log('Busca visível:', searchVisible);

    // Verificar sobreposições
    const overlaps = await page.evaluate(() => {
      const dropdowns = Array.from(document.querySelectorAll('select, [role="combobox"], .dropdown, [data-testid*="dropdown"]'));
      const positions = dropdowns.map(el => {
        const rect = el.getBoundingClientRect();
        return {
          element: el.tagName + (el.className ? '.' + el.className.split(' ')[0] : ''),
          x: rect.x, y: rect.y, width: rect.width, height: rect.height
        };
      }).filter(pos => pos.width > 0 && pos.height > 0);

      const overlapping = [];
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const a = positions[i], b = positions[j];
          if (!(a.x + a.width < b.x || b.x + b.width < a.x ||
                a.y + a.height < b.y || b.y + b.height < a.y)) {
            overlapping.push([a.element, b.element]);
          }
        }
      }

      return { total: positions.length, overlapping };
    });

    console.log('Análise de sobreposições:', overlaps);

    await page.screenshot({
      path: '/mnt/c/mainframe-ai-assistant/tests/app-screenshot.png',
      fullPage: true
    });

    console.log('Screenshot salvo em: /mnt/c/mainframe-ai-assistant/tests/app-screenshot.png');

    await browser.close();

    // Relatório final
    console.log('\\n=== RELATÓRIO FINAL ===');
    console.log('Status: SUCESSO');
    console.log('Erros JavaScript:', errors.length);
    console.log('Componente de busca:', searchVisible.found ? 'Presente' : 'Ausente');
    console.log('Elementos dropdown:', overlaps.total);
    console.log('Sobreposições:', overlaps.overlapping.length);

  } catch (error) {
    console.log('Erro no teste:', error.message);
    process.exit(1);
  }
})();
`;

    // Salvar e executar script Puppeteer
    fs.writeFileSync('/tmp/puppeteer-test.js', screenshotScript);

    return new Promise((resolve) => {
      const puppeteerProcess = spawn('npx', ['puppeteer', 'browsers', 'install', 'chrome', '&&', 'node', '/tmp/puppeteer-test.js'], {
        shell: true,
        stdio: 'inherit'
      });

      puppeteerProcess.on('close', (code) => {
        console.log(`\nProcesso Puppeteer finalizado com código: ${code}`);
        resolve();
      });

      puppeteerProcess.on('error', (error) => {
        console.log('Erro executando Puppeteer:', error.message);
        resolve();
      });

      // Timeout de 30 segundos
      setTimeout(() => {
        puppeteerProcess.kill();
        console.log('\nTimeout: Processo Puppeteer interrompido');
        resolve();
      }, 30000);
    });

  } catch (error) {
    console.log('❌ Erro durante teste básico:', error.message);
  }
}

// Executar teste
testApplicationBasic().then(() => {
  console.log('\n🏁 Teste básico concluído!');
}).catch(console.error);