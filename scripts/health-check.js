#!/usr/bin/env node

/**
 * Health Check - Monitoramento contínuo da saúde do sistema
 */

const fs = require('fs');
const path = require('path');

function performHealthCheck() {
    console.log('🏥 Health Check - Verificando saúde do sistema...\n');

    const results = {
        timestamp: new Date().toISOString(),
        status: 'healthy',
        checks: [],
        summary: {}
    };

    // Verificar arquivo principal
    const mainFile = path.join(__dirname, '..', 'Accenture-Mainframe-AI-Assistant-Integrated.html');

    if (fs.existsSync(mainFile)) {
        const content = fs.readFileSync(mainFile, 'utf8');

        // Verificações de consistência
        const checks = [
            {
                name: 'Status Consistency',
                test: () => {
                    const emTratamento = (content.match(/Em Tratamento/g) || []).length;
                    const statusMapping = (content.match(/statusMapping/g) || []).length;
                    return emTratamento > 10 && statusMapping > 0;
                },
                description: 'Status padronizados e mapeamento implementado'
            },
            {
                name: 'Variable Naming',
                test: () => {
                    const showAnalysis = (content.match(/showAnalysis/g) || []).length;
                    const analysisData = (content.match(/analysisData/g) || []).length;
                    const oldNames = (content.match(/showTreatment|treatmentData/g) || []).length;
                    return showAnalysis > 5 && analysisData > 10 && oldNames === 0;
                },
                description: 'Variáveis renomeadas corretamente'
            },
            {
                name: 'Data Validation',
                test: () => {
                    return content.includes('validateIncidentData');
                },
                description: 'Validações de dados implementadas'
            },
            {
                name: 'API Optimizations',
                test: () => {
                    return content.includes('apiCache') && content.includes('useDebounce');
                },
                description: 'Otimizações de API ativas'
            },
            {
                name: 'Performance Monitor',
                test: () => {
                    return content.includes('Performance Monitor') || content.includes('perfMonitor');
                },
                description: 'Monitoramento de performance ativo'
            }
        ];

        let passedChecks = 0;
        checks.forEach(check => {
            const passed = check.test();
            results.checks.push({
                name: check.name,
                status: passed ? 'PASS' : 'FAIL',
                description: check.description
            });

            console.log(`${passed ? '✅' : '❌'} ${check.name}: ${check.description}`);
            if (passed) passedChecks++;
        });

        results.summary = {
            total: checks.length,
            passed: passedChecks,
            failed: checks.length - passedChecks,
            score: ((passedChecks / checks.length) * 100).toFixed(1)
        };

        // Determinar status geral
        if (passedChecks === checks.length) {
            results.status = 'healthy';
            console.log('\n🟢 SISTEMA SAUDÁVEL - Todas as verificações passaram!');
        } else if (passedChecks >= checks.length * 0.8) {
            results.status = 'warning';
            console.log('\n🟡 ATENÇÃO - Algumas verificações falharam');
        } else {
            results.status = 'critical';
            console.log('\n🔴 CRÍTICO - Muitas verificações falharam');
        }

    } else {
        results.status = 'critical';
        results.checks.push({
            name: 'File Existence',
            status: 'FAIL',
            description: 'Arquivo principal não encontrado'
        });
        console.log('❌ Arquivo principal não encontrado!');
    }

    // Salvar log de health check
    const logFile = path.join(__dirname, 'health-check.log');
    fs.appendFileSync(logFile, JSON.stringify(results) + '\n');

    console.log(`\n📊 RESUMO:`);
    console.log(`   Score: ${results.summary.score || 0}%`);
    console.log(`   Verificações: ${results.summary.passed || 0}/${results.summary.total || 0}`);
    console.log(`   Status: ${results.status.toUpperCase()}`);
    console.log(`   Log salvo em: ${logFile}`);

    return results;
}

// Executar se chamado diretamente
if (require.main === module) {
    performHealthCheck();
}

module.exports = { performHealthCheck };