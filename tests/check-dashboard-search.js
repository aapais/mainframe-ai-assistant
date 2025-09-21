const puppeteer = require('puppeteer');

(async () => {
  console.log('🔍 Verificando Dashboard Search com Puppeteer...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // Navegar para o dashboard
    console.log('1. Navegando para http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 30000 });

    // Aguardar um pouco para a página carregar
    await page.waitForTimeout(2000);

    // Verificar o título da página
    const title = await page.title();
    console.log(`   Título: ${title}`);

    // Verificar se estamos no dashboard
    console.log('\n2. Verificando a view atual...');
    const currentView = await page.evaluate(() => {
      // Procurar por indicadores de qual view está ativa
      const dashboardElement = document.querySelector('[data-view="dashboard"]');
      const searchElement = document.querySelector('[data-view="search"]');
      const incidentsElement = document.querySelector('[data-view="incidents"]');

      if (dashboardElement) return 'dashboard';
      if (searchElement) return 'search';
      if (incidentsElement) return 'incidents';

      // Tentar identificar pela URL ou conteúdo
      const h1 = document.querySelector('h1');
      if (h1) {
        const text = h1.textContent.toLowerCase();
        if (text.includes('dashboard')) return 'dashboard';
        if (text.includes('search')) return 'search';
        if (text.includes('incident')) return 'incidents';
      }

      return 'unknown';
    });
    console.log(`   View atual: ${currentView}`);

    // Procurar por elementos de pesquisa
    console.log('\n3. Procurando elementos de pesquisa...');

    // Verificar UnifiedSearch
    const hasUnifiedSearch = await page.evaluate(() => {
      return !!document.querySelector('.unified-search');
    });
    console.log(`   UnifiedSearch presente: ${hasUnifiedSearch}`);

    // Verificar outros componentes de pesquisa
    const searchInputs = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="search"], input[type="text"], input[placeholder*="search" i], input[placeholder*="pesquis" i]'));
      return inputs.map(input => ({
        type: input.type,
        placeholder: input.placeholder,
        id: input.id,
        className: input.className,
        value: input.value
      }));
    });

    console.log(`   Inputs de pesquisa encontrados: ${searchInputs.length}`);
    searchInputs.forEach((input, index) => {
      console.log(`     ${index + 1}. Type: ${input.type}, Placeholder: "${input.placeholder}", Class: "${input.className}"`);
    });

    // Verificar se há botões de navegação
    console.log('\n4. Procurando navegação para dashboard...');
    const navigationButtons = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
      return buttons
        .filter(btn => {
          const text = btn.textContent?.toLowerCase() || '';
          return text.includes('dashboard') || text.includes('painel') ||
                 text.includes('home') || text.includes('início');
        })
        .map(btn => ({
          text: btn.textContent?.trim(),
          tag: btn.tagName,
          className: btn.className
        }));
    });

    console.log(`   Botões de navegação encontrados: ${navigationButtons.length}`);
    navigationButtons.forEach(btn => {
      console.log(`     - "${btn.text}" (${btn.tag})`);
    });

    // Se não estamos no dashboard, tentar navegar
    if (currentView !== 'dashboard' && navigationButtons.length > 0) {
      console.log('\n5. Tentando navegar para o dashboard...');
      await page.evaluate(() => {
        const dashboardBtn = Array.from(document.querySelectorAll('button, a, [role="button"]'))
          .find(btn => btn.textContent?.toLowerCase().includes('dashboard'));
        if (dashboardBtn) dashboardBtn.click();
      });
      await page.waitForTimeout(2000);

      // Verificar novamente
      const newView = await page.evaluate(() => {
        const h1 = document.querySelector('h1');
        return h1?.textContent || 'unknown';
      });
      console.log(`   Nova view: ${newView}`);
    }

    // Tirar screenshot para análise
    console.log('\n6. Tirando screenshot...');
    await page.screenshot({ path: 'dashboard-search-check.png', fullPage: true });
    console.log('   Screenshot salvo como dashboard-search-check.png');

    // Verificar estrutura completa da página
    console.log('\n7. Estrutura da página:');
    const pageStructure = await page.evaluate(() => {
      const structure = {
        headers: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent?.trim()).slice(0, 5),
        mainClasses: document.querySelector('main')?.className || 'no main element',
        divCount: document.querySelectorAll('div').length,
        hasReactRoot: !!document.querySelector('#root'),
        bodyClasses: document.body.className
      };
      return structure;
    });
    console.log('   Headers:', pageStructure.headers);
    console.log('   Main classes:', pageStructure.mainClasses);
    console.log('   Total divs:', pageStructure.divCount);
    console.log('   React root:', pageStructure.hasReactRoot);
    console.log('   Body classes:', pageStructure.bodyClasses);

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await browser.close();
    console.log('\n✅ Verificação completa!');
  }
})();