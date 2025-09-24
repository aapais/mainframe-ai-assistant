#!/usr/bin/env node

/**
 * Data Flow Optimizer - Correção de Inconsistências de Dados
 *
 * Este script automatiza a padronização de status e nomenclaturas
 * no sistema de gestão de incidentes do Mainframe AI Assistant.
 */

const fs = require('fs');
const path = require('path');

// Definir mapeamentos de status consistentes
const STATUS_MAPPINGS = {
    // Backend (banco de dados) -> Frontend (interface)
    backend_to_frontend: {
        'aberto': 'Aberto',
        'em_tratamento': 'Em Tratamento',
        'resolvido': 'Resolvido',
        'fechado': 'Fechado'
    },
    // Frontend -> Backend
    frontend_to_backend: {
        'Aberto': 'aberto',
        'Em Tratamento': 'em_tratamento',
        'Resolvido': 'resolvido',
        'Fechado': 'fechado'
    }
};

// Validações de dados consistentes
const VALIDATION_RULES = {
    status: {
        required: true,
        allowedValues: ['aberto', 'em_tratamento', 'resolvido', 'fechado'],
        defaultValue: 'aberto'
    },
    priority: {
        required: true,
        allowedValues: ['P1', 'P2', 'P3', 'P4'],
        mapping: {
            'Crítica': 'P1',
            'Alta': 'P2',
            'Média': 'P3',
            'Baixa': 'P4'
        }
    },
    severity: {
        required: true,
        allowedValues: ['critical', 'high', 'medium', 'low'],
        defaultValue: 'medium'
    }
};

// Otimizações de API
const API_OPTIMIZATIONS = {
    // Cache de consultas frequentes
    cacheConfig: {
        ttl: 300000, // 5 minutos
        maxSize: 100
    },
    // Batch operations para múltiplas atualizações
    batchSize: 50,
    // Debounce para filtros em tempo real
    debounceMs: 300
};

/**
 * Função para padronizar status em arquivos
 */
function standardizeStatusInFile(filePath, content) {
    console.log(`🔧 Processando: ${filePath}`);

    let updatedContent = content;
    let changesCount = 0;

    // 1. Padronizar showTreatment -> showAnalysis
    const treatmentToAnalysisRegex = /showTreatment/g;
    if (treatmentToAnalysisRegex.test(updatedContent)) {
        updatedContent = updatedContent.replace(treatmentToAnalysisRegex, 'showAnalysis');
        changesCount++;
        console.log(`   ✅ Renomeado showTreatment -> showAnalysis`);
    }

    // 2. Padronizar treatmentData -> analysisData
    const treatmentDataRegex = /treatmentData/g;
    if (treatmentDataRegex.test(updatedContent)) {
        updatedContent = updatedContent.replace(treatmentDataRegex, 'analysisData');
        changesCount++;
        console.log(`   ✅ Renomeado treatmentData -> analysisData`);
    }

    // 3. Melhorar mapeamento de status (linha crítica)
    const statusMappingOld = /let statusMapped = 'Aberto';\s*if \(item\.status === 'aberto'\) statusMapped = 'Aberto';\s*else if \(item\.status === 'em_tratamento'\) statusMapped = 'Em Tratamento';\s*else if \(item\.status === 'resolvido'\) statusMapped = 'Resolvido';\s*else if \(item\.status === 'fechado'\) statusMapped = 'Fechado';/g;

    const statusMappingNew = `// Mapeamento otimizado de status - Data Flow Optimizer
                                    const statusMapping = {
                                        'aberto': 'Aberto',
                                        'em_tratamento': 'Em Tratamento',
                                        'resolvido': 'Resolvido',
                                        'fechado': 'Fechado'
                                    };
                                    const statusMapped = statusMapping[item.status] || 'Aberto';`;

    if (statusMappingOld.test(updatedContent)) {
        updatedContent = updatedContent.replace(statusMappingOld, statusMappingNew);
        changesCount++;
        console.log(`   ✅ Otimizado mapeamento de status`);
    }

    // 4. Padronizar 'Em Tratamento' para uso no backend
    const frontendStatusUpdates = /status: ['"]Em Tratamento['"]/g;
    if (frontendStatusUpdates.test(updatedContent)) {
        updatedContent = updatedContent.replace(frontendStatusUpdates, "status: 'em_tratamento'");
        changesCount++;
        console.log(`   ✅ Padronizado status frontend -> backend`);
    }

    // 5. Adicionar validação de dados
    const validationSnippet = `
    // Validação de dados - Data Flow Optimizer
    const validateIncidentData = (data) => {
        const errors = [];

        // Validar status
        if (!data.status || !['aberto', 'em_tratamento', 'resolvido', 'fechado'].includes(data.status)) {
            errors.push('Status inválido');
            data.status = 'aberto'; // valor padrão
        }

        // Validar prioridade
        if (!data.priority || !['P1', 'P2', 'P3', 'P4'].includes(data.priority)) {
            errors.push('Prioridade inválida');
            data.priority = 'P3'; // valor padrão
        }

        return { isValid: errors.length === 0, errors, data };
    };`;

    // Adicionar validação se ainda não existe
    if (!updatedContent.includes('validateIncidentData')) {
        const insertPoint = updatedContent.indexOf('const EditModal');
        if (insertPoint > -1) {
            updatedContent = updatedContent.slice(0, insertPoint) + validationSnippet + '\n\n        ' + updatedContent.slice(insertPoint);
            changesCount++;
            console.log(`   ✅ Adicionada validação de dados`);
        }
    }

    // 6. Otimizar filtros e agrupamentos
    const filterOptimization = `
    // Filtros otimizados - Data Flow Optimizer
    const optimizedFilters = useMemo(() => {
        return incidents.filter(incident => {
            const matchesFilter = filter === 'all' ||
                (filter === 'active' && ['Aberto', 'Em Tratamento'].includes(incident.status)) ||
                (filter === 'closed' && ['Resolvido', 'Fechado'].includes(incident.status));

            const matchesSearch = !searchTerm ||
                incident.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                incident.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                incident.assignee.toLowerCase().includes(searchTerm.toLowerCase());

            return matchesFilter && matchesSearch;
        });
    }, [incidents, filter, searchTerm]);`;

    // Substituir filtros simples por versão otimizada
    const simpleFilterRegex = /const filteredIncidents = incidents\.filter\(incident => \{[\s\S]*?\}\);/g;
    if (simpleFilterRegex.test(updatedContent) && !updatedContent.includes('optimizedFilters')) {
        updatedContent = updatedContent.replace(simpleFilterRegex, 'const filteredIncidents = optimizedFilters;');
        // Inserir a função otimizada antes
        const insertPoint = updatedContent.indexOf('const filteredIncidents = optimizedFilters;');
        if (insertPoint > -1) {
            updatedContent = updatedContent.slice(0, insertPoint) + filterOptimization + '\n\n            ' + updatedContent.slice(insertPoint);
            changesCount++;
            console.log(`   ✅ Otimizados filtros e busca`);
        }
    }

    return {
        content: updatedContent,
        changes: changesCount
    };
}

/**
 * Função principal de otimização
 */
function optimizeDataFlow() {
    console.log('🚀 Data Flow Optimizer - Iniciando correções...\n');

    const targetFiles = [
        'Accenture-Mainframe-AI-Assistant-Integrated.html',
        'add-new-incident.js',
        'add-incident.js',
        'add-incidents.js'
    ];

    let totalChanges = 0;
    let processedFiles = 0;

    targetFiles.forEach(fileName => {
        const filePath = path.join(__dirname, '..', fileName);

        if (fs.existsSync(filePath)) {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const result = standardizeStatusInFile(fileName, content);

                if (result.changes > 0) {
                    fs.writeFileSync(filePath, result.content);
                    console.log(`   📝 ${result.changes} alterações aplicadas\n`);
                    totalChanges += result.changes;
                } else {
                    console.log(`   ✨ Arquivo já está otimizado\n`);
                }

                processedFiles++;
            } catch (error) {
                console.error(`   ❌ Erro ao processar ${fileName}:`, error.message);
            }
        } else {
            console.log(`   ⚠️  Arquivo não encontrado: ${fileName}`);
        }
    });

    // Relatório final
    console.log('📊 RELATÓRIO DE OTIMIZAÇÃO:');
    console.log(`   Arquivos processados: ${processedFiles}/${targetFiles.length}`);
    console.log(`   Total de correções: ${totalChanges}`);
    console.log('\n✅ CORREÇÕES IMPLEMENTADAS:');
    console.log('   • Status padronizado: em_tratamento ↔ Em Tratamento');
    console.log('   • Nomenclatura: showTreatment → showAnalysis');
    console.log('   • Variáveis: treatmentData → analysisData');
    console.log('   • Mapeamento de status otimizado');
    console.log('   • Validações de dados adicionadas');
    console.log('   • Filtros e agrupamentos otimizados');
    console.log('\n🎯 BENEFÍCIOS:');
    console.log('   • Consistência de dados frontend/backend');
    console.log('   • Melhor performance em filtros');
    console.log('   • Validações automatizadas');
    console.log('   • Nomenclatura mais clara');

    // Criar arquivo de configuração para futuras otimizações
    const configData = {
        version: '1.0.0',
        lastOptimization: new Date().toISOString(),
        statusMappings: STATUS_MAPPINGS,
        validationRules: VALIDATION_RULES,
        apiOptimizations: API_OPTIMIZATIONS,
        changesApplied: totalChanges
    };

    fs.writeFileSync(
        path.join(__dirname, 'data-flow-config.json'),
        JSON.stringify(configData, null, 2)
    );

    console.log('\n📁 Configuração salva em: scripts/data-flow-config.json');
    console.log('\n🚀 Data Flow Optimizer - Concluído com sucesso!');
}

// Executar se chamado diretamente
if (require.main === module) {
    optimizeDataFlow();
}

module.exports = {
    standardizeStatusInFile,
    optimizeDataFlow,
    STATUS_MAPPINGS,
    VALIDATION_RULES,
    API_OPTIMIZATIONS
};