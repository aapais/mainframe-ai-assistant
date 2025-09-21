// Teste usando Playwright via Docker
// Este script executa testes da aplicação usando o container Docker do Playwright

const fs = require('fs');
const path = require('path');

// Função para executar comando Docker
function runDockerCommand(command, options = {}) {
    const { exec } = require('child_process');
    
    return new Promise((resolve, reject) => {
        console.log(`🐳 Executando: ${command}`);
        
        const process = exec(command, {
            cwd: path.join(__dirname, '../..'),
            maxBuffer: 1024 * 1024 * 10, // 10MB buffer
            ...options
        });
        
        let stdout = '';
        let stderr = '';
        
        process.stdout?.on('data', (data) => {
            stdout += data;
            if (options.showOutput !== false) {
                console.log(data.toString().trim());
            }
        });
        
        process.stderr?.on('data', (data) => {
            stderr += data;
            if (options.showOutput !== false) {
                console.error(data.toString().trim());
            }
        });
        
        process.on('close', (code) => {
            if (code === 0) {
                resolve({ stdout, stderr, code });
            } else {
                reject(new Error(`Comando falhou com código ${code}: ${stderr}`));
            }
        });
    });
}

// Código do teste Playwright para executar no container
const testScript = `
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function runTests() {
    console.log('🎭 Iniciando testes Playwright no Docker...');
    
    const browser = await chromium.launch({
        headless: true, // No Docker, sempre headless
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        ignoreHTTPSErrors: true
    });
    
    const page = await context.newPage();
    const results = [];
    
    try {
        // Teste 1: Verificar se aplicação está rodando
        console.log('🔍 Teste 1: Verificando aplicação...');
        
        const urls = [
            'http://host.docker.internal:5173', // Vite
            'http://host.docker.internal:3000', // Electron
            'http://172.17.0.1:5173',          // Docker bridge
            'http://172.17.0.1:3000'
        ];
        
        let appUrl = null;
        
        for (const url of urls) {
            try {
                console.log(\`  Tentando: \${url}\`);
                await page.goto(url, { waitUntil: 'networkidle', timeout: 5000 });
                appUrl = url;
                console.log(\`  ✅ Conectado: \${url}\`);
                break;
            } catch (e) {
                console.log(\`  ❌ Falhou: \${url}\`);
            }
        }
        
        if (!appUrl) {
            throw new Error('Nenhuma URL da aplicação está acessível');
        }
        
        // Captura screenshot inicial
        await page.screenshot({ 
            path: '/app/results/01-homepage.png',
            fullPage: true 
        });
        
        const title = await page.title();
        console.log(\`📄 Título: \${title}\`);
        results.push({ test: 'Carregamento', status: 'PASS', url: appUrl, title });
        
        // Teste 2: Verificar elementos da interface
        console.log('\n🔍 Teste 2: Elementos da interface...');
        
        const elements = [
            { selector: 'input[type="search"], .search-bar, #search, input[placeholder*="search" i]', name: 'Campo de busca' },
            { selector: 'button', name: 'Botões' },
            { selector: 'nav, .navigation, .sidebar, .menu', name: 'Navegação' },
            { selector: 'main, .content, #root, .app', name: 'Conteúdo principal' }
        ];
        
        for (const element of elements) {
            try {
                const found = await page.$(element.selector);
                if (found) {
                    console.log(\`  ✅ \${element.name} encontrado\`);
                    results.push({ test: element.name, status: 'PASS' });
                } else {
                    console.log(\`  ❌ \${element.name} não encontrado\`);
                    results.push({ test: element.name, status: 'FAIL' });
                }
            } catch (e) {
                console.log(\`  ❌ \${element.name} erro: \${e.message}\`);
                results.push({ test: element.name, status: 'ERROR', error: e.message });
            }
        }
        
        // Teste 3: Testar interação
        console.log('\n🔍 Teste 3: Interações...');
        
        const searchInput = await page.$('input[type="search"], input[placeholder*="search" i], .search-input');
        if (searchInput) {
            await searchInput.type('teste playwright');
            await page.screenshot({ 
                path: '/app/results/02-search-input.png',
                fullPage: true 
            });
            console.log('  ✅ Campo de busca testado');
            results.push({ test: 'Interação busca', status: 'PASS' });
        } else {
            console.log('  ⚠️  Campo de busca não encontrado');
            results.push({ test: 'Interação busca', status: 'SKIP' });
        }
        
        // Teste 4: Responsividade
        console.log('\n🔍 Teste 4: Responsividade...');
        
        const viewports = [
            { width: 375, height: 667, name: 'mobile' },
            { width: 768, height: 1024, name: 'tablet' },
            { width: 1920, height: 1080, name: 'desktop' }
        ];
        
        for (const viewport of viewports) {
            await page.setViewportSize(viewport);
            await page.waitForTimeout(500);
            await page.screenshot({ 
                path: \`/app/results/03-responsive-\${viewport.name}.png\`,
                fullPage: true 
            });
            console.log(\`  ✅ \${viewport.name} (\${viewport.width}x\${viewport.height})\`);
        }
        
        results.push({ test: 'Responsividade', status: 'PASS' });
        
        // Teste 5: Performance
        console.log('\n🔍 Teste 5: Performance...');
        
        const metrics = await page.evaluate(() => {
            const navigation = performance.getEntriesByType('navigation')[0];
            return {
                domContentLoaded: Math.round(navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart),
                loadComplete: Math.round(navigation.loadEventEnd - navigation.loadEventStart),
                domInteractive: Math.round(navigation.domInteractive - navigation.fetchStart)
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
        results.push({ test: 'Erro Geral', status: 'FAIL', error: error.message });
    } finally {
        await browser.close();
    }
    
    // Salvar relatório
    const report = {
        timestamp: new Date().toISOString(),
        environment: 'Docker Playwright',
        results,
        summary: {
            total: results.length,
            passed: results.filter(r => r.status === 'PASS').length,
            failed: results.filter(r => r.status === 'FAIL').length,
            errors: results.filter(r => r.status === 'ERROR').length,
            warnings: results.filter(r => r.status === 'WARN').length,
            skipped: results.filter(r => r.status === 'SKIP').length
        }
    };
    
    fs.writeFileSync('/app/results/test-report.json', JSON.stringify(report, null, 2));
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 RELATÓRIO DE TESTES');
    console.log('='.repeat(60));
    
    results.forEach(result => {
        const icon = result.status === 'PASS' ? '✅' : 
                    result.status === 'FAIL' ? '❌' : 
                    result.status === 'ERROR' ? '🔴' :
                    result.status === 'WARN' ? '⚠️' : '⏭️';
        console.log(\`\${icon} \${result.test}: \${result.status}\`);
    });
    
    const { summary } = report;
    const successRate = ((summary.passed / summary.total) * 100).toFixed(1);
    
    console.log(\`\n📈 Taxa de sucesso: \${successRate}%\`);
    console.log(\`✅ Passou: \${summary.passed}\`);
    console.log(\`❌ Falhou: \${summary.failed}\`);
    console.log(\`🔴 Erros: \${summary.errors}\`);
    console.log(\`⚠️  Avisos: \${summary.warnings}\`);
    console.log(\`⏭️  Pulados: \${summary.skipped}\`);
    
    return summary.failed === 0 && summary.errors === 0;
}

runTests()
    .then(success => {
        console.log(success ? '🎉 Todos os testes passaram!' : '⚠️  Alguns testes falharam');
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('💥 Erro fatal:', error);
        process.exit(1);
    });
`;

async function runDockerTests() {
    console.log('🎭 Iniciando testes com Playwright Docker...');
    
    // Cria diretórios necessários
    const resultsDir = path.join(__dirname, 'results');
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    // Salva o script de teste
    const testScriptPath = path.join(__dirname, 'docker-test-script.js');
    fs.writeFileSync(testScriptPath, testScript);
    
    console.log('📝 Script de teste criado');
    
    try {
        // Para containers antigos
        console.log('\n🧹 Limpando containers antigos...');
        try {
            await runDockerCommand('docker stop playwright-test 2>/dev/null || true', { showOutput: false });
            await runDockerCommand('docker rm playwright-test 2>/dev/null || true', { showOutput: false });
        } catch (e) {
            // Ignora erros de limpeza
        }
        
        // Executa o teste no container
        console.log('\n🚀 Executando testes no container Docker...');
        
        const dockerCommand = `docker run --rm \
            --name playwright-test \
            --shm-size=2gb \
            -v "${path.resolve(testScriptPath)}:/app/test.js" \
            -v "${path.resolve(resultsDir)}:/app/results" \
            --add-host=host.docker.internal:host-gateway \
            mcr.microsoft.com/playwright:v1.48.0-jammy \
            bash -c "npm install -g playwright && node /app/test.js"`;
        
        const result = await runDockerCommand(dockerCommand, { timeout: 120000 });
        
        console.log('\n✅ Testes concluídos!');
        
        // Verifica se relatório foi gerado
        const reportPath = path.join(resultsDir, 'test-report.json');
        if (fs.existsSync(reportPath)) {
            const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
            console.log('\n📊 Relatório disponível em:', reportPath);
            console.log('📷 Screenshots disponíveis em:', resultsDir);
            
            return report;
        } else {
            console.log('⚠️  Relatório não foi gerado');
            return null;
        }
        
    } catch (error) {
        console.error('❌ Erro durante execução:', error.message);
        throw error;
    }
}

// Executa os testes se este arquivo for chamado diretamente
if (require.main === module) {
    runDockerTests()
        .then(report => {
            if (report) {
                console.log('\n🎯 Resumo final:');
                console.log(JSON.stringify(report.summary, null, 2));
                process.exit(report.summary.failed === 0 ? 0 : 1);
            } else {
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('💥 Erro fatal:', error.message);
            process.exit(1);
        });
}

module.exports = { runDockerTests };