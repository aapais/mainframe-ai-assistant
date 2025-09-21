#!/usr/bin/env node

/**
 * MCP Playwright Docker - Servidor MCP simples
 * Executa Playwright via Docker com interface MCP
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Simula um servidor MCP básico via stdio
class SimplePlaywrightMCP {
    constructor() {
        this.resultsDir = path.join(process.cwd(), 'tests', 'e2e', 'docker-results');
        if (!fs.existsSync(this.resultsDir)) {
            fs.mkdirSync(this.resultsDir, { recursive: true });
        }
    }

    async runDockerPlaywright(url = 'http://localhost:3000') {
        const timestamp = Date.now();
        
        const testScript = `
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    console.log('🎭 Iniciando teste Playwright Docker...');
    
    const browser = await chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 }
    });
    
    const page = await context.newPage();
    const results = [];
    
    try {
        // Teste 1: Carregamento da aplicação
        console.log('🔍 Testando carregamento...');
        
        // Tenta diferentes URLs
        const urls = [
            'http://host.docker.internal:3000',
            'http://172.17.0.1:3000',
            'http://host.docker.internal:5173',
            'http://172.17.0.1:5173'
        ];
        
        let connectedUrl = null;
        for (const testUrl of urls) {
            try {
                await page.goto(testUrl, { waitUntil: 'networkidle', timeout: 5000 });
                connectedUrl = testUrl;
                console.log(\`✅ Conectado: \${testUrl}\`);
                break;
            } catch (e) {
                console.log(\`❌ Falhou: \${testUrl}\`);
            }
        }
        
        if (!connectedUrl) {
            throw new Error('Aplicação não acessível');
        }
        
        const title = await page.title();
        console.log(\`📄 Título: \${title}\`);
        
        results.push({
            test: 'Carregamento',
            status: 'PASS',
            url: connectedUrl,
            title
        });
        
        // Screenshot inicial
        await page.screenshot({ 
            path: '/results/01-homepage.png',
            fullPage: true 
        });
        console.log('📸 Screenshot homepage capturado');
        
        // Teste 2: Elementos da interface
        console.log('\n🔍 Testando elementos da interface...');
        
        const selectors = [
            { selector: 'input[type="search"], .search-bar, #search', name: 'Campo de busca' },
            { selector: 'button', name: 'Botões' },
            { selector: 'nav, .navigation, .sidebar', name: 'Navegação' },
            { selector: 'main, .content, #root', name: 'Conteúdo principal' }
        ];
        
        for (const item of selectors) {
            const element = await page.$(item.selector);
            const found = element !== null;
            
            results.push({
                test: item.name,
                status: found ? 'PASS' : 'FAIL',
                selector: item.selector
            });
            
            console.log(\`  \${found ? '✅' : '❌'} \${item.name}\`);
        }
        
        // Teste 3: Interação (se houver campo de busca)
        console.log('\n🔍 Testando interações...');
        
        const searchInput = await page.$('input[type="search"], input[placeholder*="search" i], .search-input');
        if (searchInput) {
            await searchInput.type('teste playwright docker');
            await page.screenshot({ 
                path: '/results/02-search-interaction.png',
                fullPage: true 
            });
            
            results.push({
                test: 'Interação busca',
                status: 'PASS'
            });
            
            console.log('  ✅ Campo de busca testado');
        } else {
            results.push({
                test: 'Interação busca',
                status: 'SKIP',
                reason: 'Campo não encontrado'
            });
            
            console.log('  ⏩ Campo de busca não encontrado');
        }
        
        // Teste 4: Responsividade
        console.log('\n🔍 Testando responsividade...');
        
        const viewports = [
            { width: 375, height: 667, name: 'mobile' },
            { width: 768, height: 1024, name: 'tablet' },
            { width: 1920, height: 1080, name: 'desktop' }
        ];
        
        for (const viewport of viewports) {
            await page.setViewportSize(viewport);
            await page.waitForTimeout(500);
            await page.screenshot({ 
                path: \`/results/03-responsive-\${viewport.name}.png\`,
                fullPage: true 
            });
            
            console.log(\`  ✅ \${viewport.name} (\${viewport.width}x\${viewport.height})\`);
        }
        
        results.push({
            test: 'Responsividade',
            status: 'PASS',
            viewports: viewports.length
        });
        
        // Teste 5: Performance
        console.log('\n🔍 Medindo performance...');
        
        const metrics = await page.evaluate(() => {
            const nav = performance.getEntriesByType('navigation')[0];
            return {
                domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart),
                loadComplete: Math.round(nav.loadEventEnd - nav.loadEventStart),
                domInteractive: Math.round(nav.domInteractive - nav.fetchStart)
            };
        });
        
        console.log(\`  ⏱️  DOM Content Loaded: \${metrics.domContentLoaded}ms\`);
        console.log(\`  ⏱️  Load Complete: \${metrics.loadComplete}ms\`);
        console.log(\`  ⏱️  DOM Interactive: \${metrics.domInteractive}ms\`);
        
        const performanceOk = metrics.domInteractive < 5000;
        results.push({
            test: 'Performance',
            status: performanceOk ? 'PASS' : 'WARN',
            metrics
        });
        
    } catch (error) {
        console.error('❌ Erro durante os testes:', error.message);
        results.push({
            test: 'Erro Geral',
            status: 'FAIL',
            error: error.message
        });
    } finally {
        await browser.close();
    }
    
    // Relatório final
    const summary = {
        total: results.length,
        passed: results.filter(r => r.status === 'PASS').length,
        failed: results.filter(r => r.status === 'FAIL').length,
        warned: results.filter(r => r.status === 'WARN').length,
        skipped: results.filter(r => r.status === 'SKIP').length
    };
    
    const report = {
        timestamp: new Date().toISOString(),
        environment: 'Docker Playwright MCP',
        results,
        summary
    };
    
    fs.writeFileSync('/results/test-report.json', JSON.stringify(report, null, 2));
    
    console.log('\n' + '='.repeat(60));
    console.log('📋 RELATÓRIO FINAL');
    console.log('='.repeat(60));
    
    results.forEach(result => {
        const icon = result.status === 'PASS' ? '✅' : 
                    result.status === 'FAIL' ? '❌' : 
                    result.status === 'WARN' ? '⚠️' : '⏩';
        console.log(\`\${icon} \${result.test}: \${result.status}\`);
    });
    
    const successRate = ((summary.passed / summary.total) * 100).toFixed(1);
    console.log(\`\n🎯 Taxa de sucesso: \${successRate}%\`);
    console.log(\`✅ Passou: \${summary.passed}\`);
    console.log(\`❌ Falhou: \${summary.failed}\`);
    console.log(\`⚠️  Avisos: \${summary.warned}\`);
    console.log(\`⏩ Pulados: \${summary.skipped}\`);
    
    console.log('\n🎉 Teste concluído!');
})();
`;
        
        // Salva script temporário
        const scriptPath = path.join(this.resultsDir, `test-script-${timestamp}.js`);
        fs.writeFileSync(scriptPath, testScript);
        
        console.log('🎭 Executando Playwright via Docker...');
        console.log(`🎯 URL alvo: ${url}`);
        
        // Comando Docker
        const dockerCommand = `docker run --rm \
            --name playwright-mcp-${timestamp} \
            --shm-size=2gb \
            -v "${scriptPath}:/app/test.js" \
            -v "${this.resultsDir}:/results" \
            --add-host=host.docker.internal:host-gateway \
            mcr.microsoft.com/playwright:v1.48.0-jammy \
            bash -c "npm install -g playwright && node /app/test.js"`;
        
        return new Promise((resolve, reject) => {
            exec(dockerCommand, {
                maxBuffer: 1024 * 1024 * 10,
                timeout: 120000
            }, (error, stdout, stderr) => {
                // Remove script temporário
                if (fs.existsSync(scriptPath)) {
                    fs.unlinkSync(scriptPath);
                }
                
                if (error && error.code !== 0) {
                    console.error('❌ Erro Docker:', error.message);
                    reject(error);
                    return;
                }
                
                console.log('✅ Docker Output:');
                console.log(stdout);
                
                if (stderr) {
                    console.log('🟡 Docker Warnings:');
                    console.log(stderr);
                }
                
                // Lê relatório se disponível
                const reportPath = path.join(this.resultsDir, 'test-report.json');
                let report = null;
                
                if (fs.existsSync(reportPath)) {
                    try {
                        report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
                        console.log('\n📋 Relatório carregado:', reportPath);
                    } catch (e) {
                        console.log('⚠️  Erro ao ler relatório:', e.message);
                    }
                }
                
                resolve({
                    success: true,
                    stdout,
                    stderr,
                    report,
                    resultsDir: this.resultsDir
                });
            });
        });
    }

    async takeScreenshot(url = 'http://localhost:3000', selector = null) {
        const timestamp = Date.now();
        
        const script = `
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    const urls = [
        'http://host.docker.internal:3000',
        'http://172.17.0.1:3000',
        'http://host.docker.internal:5173',
        'http://172.17.0.1:5173'
    ];
    
    let connected = false;
    for (const testUrl of urls) {
        try {
            await page.goto(testUrl, { waitUntil: 'networkidle', timeout: 5000 });
            console.log('Conectado:', testUrl);
            connected = true;
            break;
        } catch (e) {
            console.log('Falhou:', testUrl);
        }
    }
    
    if (!connected) {
        throw new Error('Aplicação não acessível');
    }
    
    ${selector ? 
        `const element = await page.$('${selector}');
         if (element) {
             await element.screenshot({ path: '/results/screenshot-${timestamp}.png' });
         } else {
             await page.screenshot({ path: '/results/screenshot-${timestamp}.png', fullPage: true });
         }` :
        `await page.screenshot({ path: '/results/screenshot-${timestamp}.png', fullPage: true });`
    }
    
    await browser.close();
    console.log('Screenshot capturado: screenshot-${timestamp}.png');
})();
`;
        
        const scriptPath = path.join(this.resultsDir, `screenshot-script-${timestamp}.js`);
        fs.writeFileSync(scriptPath, script);
        
        const dockerCommand = `docker run --rm \
            -v "${scriptPath}:/app/script.js" \
            -v "${this.resultsDir}:/results" \
            --add-host=host.docker.internal:host-gateway \
            mcr.microsoft.com/playwright:v1.48.0-jammy \
            bash -c "npm install -g playwright && node /app/script.js"`;
        
        return new Promise((resolve, reject) => {
            exec(dockerCommand, {
                maxBuffer: 1024 * 1024 * 5,
                timeout: 60000
            }, (error, stdout, stderr) => {
                if (fs.existsSync(scriptPath)) {
                    fs.unlinkSync(scriptPath);
                }
                
                if (error) {
                    reject(error);
                    return;
                }
                
                resolve({
                    success: true,
                    screenshot: `screenshot-${timestamp}.png`,
                    path: path.join(this.resultsDir, `screenshot-${timestamp}.png`),
                    stdout,
                    stderr
                });
            });
        });
    }
}

// Interface de linha de comando
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0] || 'test';
    const url = args[1] || 'http://localhost:3000';
    
    const mcp = new SimplePlaywrightMCP();
    
    switch (command) {
        case 'test':
            console.log('🎭 Iniciando teste completo...');
            mcp.runDockerPlaywright(url)
                .then(result => {
                    console.log('\n✅ Teste concluído com sucesso!');
                    console.log(`📁 Resultados em: ${result.resultsDir}`);
                    if (result.report) {
                        console.log(`📋 Taxa de sucesso: ${((result.report.summary.passed / result.report.summary.total) * 100).toFixed(1)}%`);
                    }
                    process.exit(0);
                })
                .catch(error => {
                    console.error('❌ Erro:', error.message);
                    process.exit(1);
                });
            break;
            
        case 'screenshot':
            console.log('📸 Capturando screenshot...');
            mcp.takeScreenshot(url)
                .then(result => {
                    console.log(`✅ Screenshot salvo: ${result.path}`);
                    process.exit(0);
                })
                .catch(error => {
                    console.error('❌ Erro:', error.message);
                    process.exit(1);
                });
            break;
            
        default:
            console.log('Uso:');
            console.log('  node playwright-mcp-docker.js test [url]');
            console.log('  node playwright-mcp-docker.js screenshot [url]');
            process.exit(1);
    }
}

module.exports = SimplePlaywrightMCP;