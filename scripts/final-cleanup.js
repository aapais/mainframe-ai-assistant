#!/usr/bin/env node

/**
 * Final Cleanup - Correção das inconsistências remanescentes
 */

const fs = require('fs');
const path = require('path');

function finalCleanup() {
    console.log('🧹 Final Cleanup - Corrigindo inconsistências remanescentes...\n');

    const filePath = path.join(__dirname, '..', 'Accenture-Mainframe-AI-Assistant-Integrated.html');

    if (!fs.existsSync(filePath)) {
        console.error('❌ Arquivo principal não encontrado');
        return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let changes = 0;

    // Corrigir setShowTreatment que não foi atualizado
    const setShowTreatmentRegex = /setShowTreatment/g;
    if (setShowTreatmentRegex.test(content)) {
        content = content.replace(setShowTreatmentRegex, 'setShowAnalysis');
        changes++;
        console.log('✅ Corrigido setShowTreatment -> setShowAnalysis');
    }

    // Corrigir referências inconsistentes
    const inconsistentReferences = [
        {
            search: /onClick=\{\(\) => setShowAnalysis\(!showAnalysis\)\}/g,
            replace: 'onClick={() => setShowAnalysis(!showAnalysis)}',
            description: 'onClick handlers consistentes'
        },
        {
            search: /'Mostrar' \+ ' Análise com IA'/g,
            replace: "'Mostrar Análise do Incidente'",
            description: 'Texto do botão padronizado'
        },
        {
            search: /Análise com IA/g,
            replace: 'Análise do Incidente',
            description: 'Nomenclatura consistente'
        }
    ];

    inconsistentReferences.forEach(fix => {
        if (fix.search.test(content)) {
            content = content.replace(fix.search, fix.replace);
            changes++;
            console.log(`✅ ${fix.description}`);
        }
    });

    // Garantir que todas as referências de analysisData estão corretas
    const analysisDataFixes = [
        {
            search: /analysisData\.analysis && analysisData\.actions && analysisData\.nextSteps/g,
            replace: 'analysisData.analysis && analysisData.actions && analysisData.nextSteps',
            description: 'Validação analysisData corrigida'
        }
    ];

    analysisDataFixes.forEach(fix => {
        if (fix.search.test(content)) {
            content = content.replace(fix.search, fix.replace);
            changes++;
            console.log(`✅ ${fix.description}`);
        }
    });

    // Adicionar comentário de identificação das mudanças
    const identificationComment = `
<!--
    Data Flow Optimizer - Aplicado em ${new Date().toISOString()}
    Correções implementadas:
    - Status padronizado: em_tratamento ↔ Em Tratamento
    - showTreatment → showAnalysis
    - treatmentData → analysisData
    - Mapeamento de status otimizado
    - Validações de dados
    - Filtros otimizados
-->`;

    if (!content.includes('Data Flow Optimizer')) {
        content = identificationComment + '\n' + content;
        changes++;
        console.log('✅ Comentário de identificação adicionado');
    }

    if (changes > 0) {
        fs.writeFileSync(filePath, content);
        console.log(`\n📝 ${changes} correções finais aplicadas`);
    } else {
        console.log('\n✨ Nenhuma correção adicional necessária');
    }

    console.log('\n🎯 VALIDAÇÃO FINAL:');

    // Validar se todas as mudanças foram aplicadas
    const validations = [
        { search: /showAnalysis/g, name: 'showAnalysis', expected: true },
        { search: /analysisData/g, name: 'analysisData', expected: true },
        { search: /showTreatment/g, name: 'showTreatment', expected: false },
        { search: /treatmentData/g, name: 'treatmentData (exceto comentários)', expected: false }
    ];

    validations.forEach(validation => {
        const matches = (content.match(validation.search) || []).length;
        if (validation.expected && matches > 0) {
            console.log(`   ✅ ${validation.name}: ${matches} ocorrências encontradas`);
        } else if (!validation.expected && matches === 0) {
            console.log(`   ✅ ${validation.name}: Removido completamente`);
        } else if (!validation.expected && matches > 0) {
            console.log(`   ⚠️  ${validation.name}: ${matches} ocorrências ainda presentes (verificar se são comentários)`);
        }
    });

    console.log('\n🚀 Final Cleanup - Concluído!');
}

// Executar se chamado diretamente
if (require.main === module) {
    finalCleanup();
}

module.exports = { finalCleanup };