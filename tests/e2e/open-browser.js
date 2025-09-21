#!/usr/bin/env node

// Script para abrir o browser com Playwright em modo visual
// Permite testar a aplicação manualmente com o browser aberto

const { chromium } = require('playwright');

async function openBrowser() {
    console.log('🎭 Abrindo browser com Playwright...');
    console.log('\n💡 Dicas:');
    console.log('  - O browser ficará aberto para testes manuais');
    console.log('  - Use Ctrl+C para fechar');
    console.log('  - O console mostrará as ações realizadas');
    console.log('');

    // Lança o browser em modo visual (não headless)
    const browser = await chromium.launch({
        headless: false, // Mostra o browser
        slowMo: 100,     // Adiciona delay para visualizar ações
        devtools: true,  // Abre DevTools automaticamente
        args: [
            '--start-maximized',
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox'
        ]
    });

    // Cria contexto com viewport grande
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        ignoreHTTPSErrors: true,
        // Grava vídeo da sessão
        recordVideo: {
            dir: './tests/e2e/videos/',
            size: { width: 1280, height: 720 }
        }
    });

    // Adiciona listener para console do browser
    context.on('console', msg => {
        if (msg.type() === 'error') {
            console.log('🔴 Console Error:', msg.text());
        }
    });

    // Adiciona listener para requisições
    context.on('request', request => {
        console.log('📤 Request:', request.method(), request.url().substring(0, 50));
    });

    // Adiciona listener para respostas com erro
    context.on('response', response => {
        if (response.status() >= 400) {
            console.log('🔴 Response Error:', response.status(), response.url());
        }
    });

    // Cria nova página
    const page = await context.newPage();

    console.log('\n🌐 Navegando para a aplicação...');
    
    // Tenta primeiro a aplicação Electron
    try {
        await page.goto('http://localhost:3000', { 
            waitUntil: 'networkidle',
            timeout: 5000 
        });
        console.log('✅ Conectado à aplicação Electron (porta 3000)');
    } catch (error) {
        console.log('⚠️  Porta 3000 não disponível, tentando Vite...');
        
        // Tenta o servidor Vite
        try {
            await page.goto('http://localhost:5173', { 
                waitUntil: 'networkidle',
                timeout: 5000 
            });
            console.log('✅ Conectado ao servidor Vite (porta 5173)');
        } catch (error2) {
            console.log('⚠️  Porta 5173 não disponível, tentando arquivo local...');
            
            // Tenta abrir o index.html local
            const path = require('path');
            const indexPath = path.join(__dirname, '../../index.html');
            await page.goto(`file://${indexPath}`);
            console.log('✅ Aberto arquivo local index.html');
        }
    }

    const title = await page.title();
    console.log(`📄 Título da página: ${title}`);

    // Executa alguns comandos automáticos de exemplo
    console.log('\n🤖 Executando ações automáticas de demonstração...');
    
    // Procura por campo de busca
    const searchInput = await page.$('input[type="search"], input[type="text"], .search-input, #search');
    if (searchInput) {
        console.log('🔍 Campo de busca encontrado');
        await searchInput.click();
        await searchInput.type('Teste automático Playwright', { delay: 50 });
        console.log('✍️  Texto digitado no campo de busca');
        
        // Limpa o campo
        await page.waitForTimeout(2000);
        await searchInput.click({ clickCount: 3 });
        await page.keyboard.press('Backspace');
        console.log('🧹 Campo limpo');
    }

    // Procura por botões e destaca
    const buttons = await page.$$('button');
    console.log(`\n🔘 Encontrados ${buttons.length} botões na página`);
    
    // Destaca cada botão com uma borda colorida
    for (let i = 0; i < Math.min(buttons.length, 5); i++) {
        await buttons[i].evaluate(el => {
            el.style.border = '3px solid red';
            el.style.boxShadow = '0 0 10px rgba(255,0,0,0.5)';
        });
    }
    console.log('✨ Botões destacados com borda vermelha');

    // Tira screenshot
    const screenshotPath = './tests/e2e/screenshots/browser-open.png';
    await page.screenshot({ 
        path: screenshotPath,
        fullPage: true 
    });
    console.log(`📸 Screenshot salvo em: ${screenshotPath}`);

    console.log('\n' + '='.repeat(60));
    console.log('🎆 BROWSER ABERTO COM SUCESSO!');
    console.log('='.repeat(60));
    console.log('\nO browser está pronto para uso manual.');
    console.log('Você pode interagir com a aplicação normalmente.');
    console.log('\n🛑 Pressione Ctrl+C para fechar o browser e sair.');
    console.log('');

    // Mantém o script rodando para manter o browser aberto
    await new Promise((resolve) => {
        process.on('SIGINT', async () => {
            console.log('\n🚪 Fechando browser...');
            await browser.close();
            console.log('✅ Browser fechado com sucesso!');
            resolve();
            process.exit(0);
        });
    });
}

// Executa a função
openBrowser().catch(error => {
    console.error('\n❌ Erro ao abrir browser:', error.message);
    process.exit(1);
});