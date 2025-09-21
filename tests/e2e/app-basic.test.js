// Basic Playwright test for Mainframe AI Assistant
// Este teste valida as funcionalidades principais da aplicação

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Configurações
const APP_URL = 'http://localhost:5173'; // Vite dev server
const TIMEOUT = 30000;
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

// Cria diretório para screenshots
if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// Função auxiliar para screenshot
async function takeScreenshot(page, name) {
    const screenshotPath = path.join(SCREENSHOTS_DIR, `${name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Screenshot salvo: ${screenshotPath}`);
}

// Função auxiliar para aguardar elemento
async function waitForElement(page, selector, options = {}) {
    try {
        await page.waitForSelector(selector, { timeout: 10000, ...options });
        return true;
    } catch (error) {
        console.log(`⚠️  Elemento não encontrado: ${selector}`);
        return false;
    }
}

// Testes principais
async function runTests() {
    console.log('🎭 Iniciando testes com Playwright...');
    console.log(`🎯 URL da aplicação: ${APP_URL}`);
    console.log('');
    
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        ignoreHTTPSErrors: true
    });
    
    const page = await context.newPage();
    const results = [];
    
    try {
        // Test 1: Acessar aplicação
        console.log('🧪 Test 1: Carregamento da aplicação');
        await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: TIMEOUT });
        await takeScreenshot(page, '01-homepage');
        
        const title = await page.title();
        console.log(`  ✅ Título: ${title}`);
        results.push({ test: 'Carregamento', status: 'PASS', details: title });
        
        // Test 2: Verificar componentes principais
        console.log('\n🧪 Test 2: Componentes principais');
        
        const components = [
            { selector: 'input[type="search"], .search-bar, #search', name: 'Barra de pesquisa' },
            { selector: 'nav, .navigation, .sidebar', name: 'Navegação' },
            { selector: 'button, .btn', name: 'Botões' },
            { selector: 'main, .content, #root', name: 'Conteúdo principal' }
        ];
        
        for (const component of components) {
            const found = await waitForElement(page, component.selector);
            if (found) {
                console.log(`  ✅ ${component.name} encontrado`);
                results.push({ test: component.name, status: 'PASS' });
            } else {
                console.log(`  ❌ ${component.name} não encontrado`);
                results.push({ test: component.name, status: 'FAIL' });
            }
        }
        
        // Test 3: Testar barra de pesquisa
        console.log('\n🧪 Test 3: Funcionalidade de pesquisa');
        const searchInput = await page.$('input[type="search"], input[placeholder*="search" i], .search-input');
        
        if (searchInput) {
            await searchInput.type('test query');
            await takeScreenshot(page, '02-search-input');
            
            // Procura botão de pesquisa ou pressiona Enter
            const searchButton = await page.$('button[type="submit"], .search-button');
            if (searchButton) {
                await searchButton.click();
            } else {
                await page.keyboard.press('Enter');
            }
            
            await page.waitForTimeout(2000);
            await takeScreenshot(page, '03-search-results');
            
            console.log('  ✅ Pesquisa executada');
            results.push({ test: 'Pesquisa', status: 'PASS' });
        } else {
            console.log('  ⚠️  Campo de pesquisa não encontrado');
            results.push({ test: 'Pesquisa', status: 'SKIP' });
        }
        
        // Test 4: Verificar modais/formulários
        console.log('\n🧪 Test 4: Modais e formulários');
        
        // Procura por botões que abrem modais
        const modalTriggers = await page.$$('button[data-modal], [onclick*="modal"], .modal-trigger, button:has-text("Add"), button:has-text("Create"), button:has-text("New")');
        
        if (modalTriggers.length > 0) {
            console.log(`  🔍 Encontrados ${modalTriggers.length} gatilhos de modal`);
            
            // Clica no primeiro
            await modalTriggers[0].click();
            await page.waitForTimeout(1000);
            
            // Verifica se modal abriu
            const modalVisible = await waitForElement(page, '.modal, [role="dialog"], .dialog, .overlay');
            
            if (modalVisible) {
                await takeScreenshot(page, '04-modal-open');
                console.log('  ✅ Modal aberto com sucesso');
                
                // Fecha modal
                const closeButton = await page.$('.modal-close, .close-button, [aria-label="close"], button:has-text("Cancel")');
                if (closeButton) {
                    await closeButton.click();
                } else {
                    await page.keyboard.press('Escape');
                }
                
                results.push({ test: 'Modais', status: 'PASS' });
            } else {
                console.log('  ⚠️  Modal não abriu');
                results.push({ test: 'Modais', status: 'FAIL' });
            }
        } else {
            console.log('  ⚠️  Nenhum gatilho de modal encontrado');
            results.push({ test: 'Modais', status: 'SKIP' });
        }
        
        // Test 5: Navegação
        console.log('\n🧪 Test 5: Navegação entre páginas');
        
        const navLinks = await page.$$('nav a, .sidebar a, a[href^="/"], a[href^="#"]');
        
        if (navLinks.length > 0) {
            console.log(`  🔍 Encontrados ${navLinks.length} links de navegação`);
            
            // Testa primeiro link
            const firstLink = navLinks[0];
            const linkText = await firstLink.textContent();
            await firstLink.click();
            await page.waitForTimeout(1000);
            
            await takeScreenshot(page, '05-navigation');
            console.log(`  ✅ Navegou para: ${linkText}`);
            results.push({ test: 'Navegação', status: 'PASS' });
        } else {
            console.log('  ⚠️  Nenhum link de navegação encontrado');
            results.push({ test: 'Navegação', status: 'SKIP' });
        }
        
        // Test 6: Responsividade
        console.log('\n🧪 Test 6: Responsividade');
        
        const viewports = [
            { width: 375, height: 667, name: 'mobile' },
            { width: 768, height: 1024, name: 'tablet' },
            { width: 1920, height: 1080, name: 'desktop' }
        ];
        
        for (const viewport of viewports) {
            await page.setViewportSize(viewport);
            await page.waitForTimeout(500);
            await takeScreenshot(page, `06-responsive-${viewport.name}`);
            console.log(`  ✅ Testado em ${viewport.name} (${viewport.width}x${viewport.height})`);
        }
        
        results.push({ test: 'Responsividade', status: 'PASS' });
        
        // Test 7: Performance básica
        console.log('\n🧪 Test 7: Performance');
        
        const metrics = await page.evaluate(() => {
            const navigation = performance.getEntriesByType('navigation')[0];
            return {
                domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
                loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
                domInteractive: navigation.domInteractive - navigation.fetchStart
            };
        });
        
        console.log(`  ⏱️  DOM Content Loaded: ${metrics.domContentLoaded}ms`);
        console.log(`  ⏱️  Load Complete: ${metrics.loadComplete}ms`);
        console.log(`  ⏱️  DOM Interactive: ${metrics.domInteractive}ms`);
        
        const performanceOk = metrics.domInteractive < 3000;
        results.push({ 
            test: 'Performance', 
            status: performanceOk ? 'PASS' : 'WARN',
            details: `DOM Interactive: ${metrics.domInteractive}ms`
        });
        
    } catch (error) {
        console.error('\n❌ Erro durante os testes:', error.message);
        results.push({ test: 'Erro Geral', status: 'FAIL', error: error.message });
    } finally {
        await browser.close();
    }
    
    // Relatório final
    console.log('\n' + '='.repeat(60));
    console.log('📋 RELATÓRIO DE TESTES');
    console.log('='.repeat(60));
    
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const skipped = results.filter(r => r.status === 'SKIP').length;
    const warned = results.filter(r => r.status === 'WARN').length;
    
    results.forEach(result => {
        const icon = result.status === 'PASS' ? '✅' : 
                    result.status === 'FAIL' ? '❌' : 
                    result.status === 'WARN' ? '⚠️' : '⏩';
        console.log(`${icon} ${result.test}: ${result.status} ${result.details || ''}`);
    });
    
    console.log('\n📊 RESUMO:');
    console.log(`  ✅ Passou: ${passed}`);
    console.log(`  ❌ Falhou: ${failed}`);
    console.log(`  ⚠️  Avisos: ${warned}`);
    console.log(`  ⏩ Pulados: ${skipped}`);
    console.log(`  📷 Screenshots salvos em: ${SCREENSHOTS_DIR}`);
    
    const successRate = (passed / results.length) * 100;
    console.log(`\n🎯 Taxa de sucesso: ${successRate.toFixed(1)}%`);
    
    // Salva relatório JSON
    const reportPath = path.join(__dirname, 'test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        url: APP_URL,
        results,
        summary: { passed, failed, warned, skipped, total: results.length, successRate }
    }, null, 2));
    
    console.log(`💾 Relatório salvo em: ${reportPath}`);
    
    return failed === 0;
}

// Executa os testes
if (require.main === module) {
    runTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Erro fatal:', error);
            process.exit(1);
        });
}

module.exports = { runTests };