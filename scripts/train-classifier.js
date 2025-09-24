#!/usr/bin/env node

/**
 * Script de Treinamento Incremental do Classificador ML
 *
 * Script para treinar e retreinar o modelo de Machine Learning usado na
 * categorização automática de incidentes bancários.
 */

const path = require('path');
const fs = require('fs').promises;
const MLClassifier = require('../src/services/categorization/MLClassifier');
const TaxonomyManager = require('../src/services/categorization/TaxonomyManager');

class ClassifierTrainer {
    constructor(options = {}) {
        this.options = {
            dataPath: options.dataPath || path.join(__dirname, '../data/training'),
            modelPath: options.modelPath || path.join(__dirname, '../src/models/categorization'),
            algorithm: options.algorithm || 'naive_bayes',
            validationSplit: options.validationSplit || 0.2,
            enableCrossValidation: options.enableCrossValidation !== false,
            folds: options.folds || 5,
            enableFeatureAnalysis: options.enableFeatureAnalysis !== false,
            enableModelComparison: options.enableModelComparison || false,
            minSamples: options.minSamples || 10,
            generateSyntheticData: options.generateSyntheticData || false,
            syntheticDataRatio: options.syntheticDataRatio || 0.3,
            ...options
        };

        this.taxonomyManager = new TaxonomyManager();
        this.classifier = null;
        this.trainingData = [];
        this.validationData = [];
        this.testResults = {};
    }

    /**
     * Executa treinamento completo
     */
    async run() {
        try {
            console.log('🚀 Iniciando treinamento do classificador ML...\n');

            // Carrega dados de treinamento
            await this.loadTrainingData();

            // Valida qualidade dos dados
            await this.validateDataQuality();

            // Gera dados sintéticos se necessário
            if (this.options.generateSyntheticData) {
                await this.generateSyntheticData();
            }

            // Prepara dados
            await this.prepareTrainingData();

            // Treina modelo principal
            await this.trainModel();

            // Avalia modelo
            await this.evaluateModel();

            // Compara algoritmos se habilitado
            if (this.options.enableModelComparison) {
                await this.compareAlgorithms();
            }

            // Analisa features se habilitado
            if (this.options.enableFeatureAnalysis) {
                await this.analyzeFeatures();
            }

            // Salva resultados
            await this.saveResults();

            // Gera relatório
            await this.generateReport();

            console.log('✅ Treinamento concluído com sucesso!');

        } catch (error) {
            console.error('❌ Erro durante o treinamento:', error);
            process.exit(1);
        }
    }

    /**
     * Carrega dados de treinamento
     */
    async loadTrainingData() {
        console.log('📥 Carregando dados de treinamento...');

        try {
            // Carrega dados de arquivo JSON se existir
            const dataFile = path.join(this.options.dataPath, 'training_data.json');

            try {
                const data = await fs.readFile(dataFile, 'utf8');
                this.trainingData = JSON.parse(data);
                console.log(`   📄 Carregados ${this.trainingData.length} registros do arquivo`);
            } catch (error) {
                console.log('   📄 Arquivo de dados não encontrado, gerando dados de exemplo...');
                await this.generateSampleData();
            }

            // Carrega dados de feedback se existir
            await this.loadFeedbackData();

            // Carrega dados históricos se existir
            await this.loadHistoricalData();

            console.log(`   ✅ Total de ${this.trainingData.length} registros carregados\n`);

        } catch (error) {
            console.error('Erro carregando dados:', error);
            throw error;
        }
    }

    /**
     * Gera dados de exemplo para demonstração
     */
    async generateSampleData() {
        const sampleData = [
            // Mainframe
            { text: 'Erro ABEND S0C4 no programa COBOL PGMTEST01 durante processamento batch', category: 'mainframe' },
            { text: 'JCL JOB falhou com erro de compilação COBOL copybook não encontrado', category: 'mainframe' },
            { text: 'Sistema z/OS apresentando lentidão no CICS região produção', category: 'mainframe' },
            { text: 'DB2 tablespace DBTEST01 em status STOP devido falta de espaço', category: 'mainframe' },
            { text: 'Transação CICS ABCDxxxx retornando timeout para usuários', category: 'mainframe' },

            // Mobile Banking
            { text: 'App mobile iOS travando na tela de login do banco', category: 'mobile-banking' },
            { text: 'Aplicativo Android não carrega saldo da conta corrente', category: 'mobile-banking' },
            { text: 'Push notifications não chegando para usuários iPhone', category: 'mobile-banking' },
            { text: 'React Native crash ao acessar extrato bancário', category: 'mobile-banking' },
            { text: 'API mobile retornando erro 500 na consulta de cartões', category: 'mobile-banking' },

            // Internet Banking
            { text: 'Portal web apresentando erro de sessão expirada', category: 'internet-banking' },
            { text: 'JavaScript error na página de transferências TED', category: 'internet-banking' },
            { text: 'Microserviço de autenticação fora do ar', category: 'internet-banking' },
            { text: 'API Gateway retornando timeout para requisições web', category: 'internet-banking' },
            { text: 'Frontend Angular com erro na validação de formulários', category: 'internet-banking' },

            // Payment Systems
            { text: 'PIX indisponível para todos os clientes do banco', category: 'payment-systems' },
            { text: 'TED não processando para Banco do Brasil', category: 'payment-systems' },
            { text: 'Gateway de pagamento recusando transações cartão', category: 'payment-systems' },
            { text: 'DOC com falha na compensação bancária', category: 'payment-systems' },
            { text: 'Sistema de transferências apresentando lentidão', category: 'payment-systems' },

            // Core Banking
            { text: 'Processamento batch de contas correntes atrasado', category: 'core-banking' },
            { text: 'SOA middleware falhando na comunicação entre sistemas', category: 'core-banking' },
            { text: 'Sistema central não atualizando saldos das contas', category: 'core-banking' },
            { text: 'Transações não sendo processadas no core bancário', category: 'core-banking' },
            { text: 'Batch de fechamento contábil com erro crítico', category: 'core-banking' },

            // ATM Network
            { text: 'Rede de ATMs Banco24Horas fora do ar', category: 'atm-network' },
            { text: 'Caixa eletrônico com erro no hardware leitor cartão', category: 'atm-network' },
            { text: 'Protocolo ISO8583 falhando na comunicação ATM', category: 'atm-network' },
            { text: 'Software ATM travando na tela inicial', category: 'atm-network' },
            { text: 'Rede de comunicação ATMs com instabilidade', category: 'atm-network' },

            // Data Platforms
            { text: 'Data Lake com falha na ingestão de dados', category: 'data-platforms' },
            { text: 'ETL de relatórios gerenciais não executando', category: 'data-platforms' },
            { text: 'Business Intelligence dashboard sem dados', category: 'data-platforms' },
            { text: 'Analytics de fraude com performance degradada', category: 'data-platforms' },
            { text: 'Big Data cluster com nós fora do ar', category: 'data-platforms' },

            // Infrastructure
            { text: 'Servidor de aplicação com alto uso de CPU', category: 'infrastructure' },
            { text: 'Rede interna com perda de pacotes', category: 'infrastructure' },
            { text: 'Cloud AWS com problemas de conectividade', category: 'infrastructure' },
            { text: 'Sistema de monitoramento reportando alertas', category: 'infrastructure' },
            { text: 'Backup noturno falhando há 3 dias', category: 'infrastructure' }
        ];

        // Expande dados com variações
        const expandedData = [];

        for (const sample of sampleData) {
            expandedData.push(sample);

            // Cria variações
            const variations = this.createTextVariations(sample.text, sample.category);
            expandedData.push(...variations);
        }

        this.trainingData = expandedData;
        console.log(`   🎯 Gerados ${expandedData.length} registros de exemplo`);
    }

    /**
     * Cria variações de texto para aumentar dataset
     */
    createTextVariations(originalText, category) {
        const variations = [];

        // Variações com sinônimos
        const synonyms = {
            'erro': ['falha', 'problema', 'exception', 'issue'],
            'sistema': ['aplicação', 'aplicativo', 'software', 'plataforma'],
            'usuário': ['cliente', 'user'],
            'lento': ['lentidão', 'performance', 'demora', 'degradado'],
            'fora': ['indisponível', 'offline', 'down', 'inativo']
        };

        let varText = originalText.toLowerCase();

        for (const [word, syns] of Object.entries(synonyms)) {
            if (varText.includes(word)) {
                for (const syn of syns.slice(0, 2)) { // Máximo 2 sinônimos
                    const newText = varText.replace(word, syn);
                    variations.push({
                        text: newText.charAt(0).toUpperCase() + newText.slice(1),
                        category: category
                    });
                }
            }
        }

        // Variações com contexto adicional
        const contextPrefixes = [
            'Usuários reportando: ',
            'Cliente informou: ',
            'Detectado problema: ',
            'Alerta crítico: ',
            'Incidente urgente: '
        ];

        for (const prefix of contextPrefixes.slice(0, 2)) {
            variations.push({
                text: prefix + originalText.toLowerCase(),
                category: category
            });
        }

        return variations.slice(0, 3); // Máximo 3 variações por texto
    }

    /**
     * Carrega dados de feedback
     */
    async loadFeedbackData() {
        try {
            const feedbackFile = path.join(this.options.modelPath, 'feedback_history.json');
            const data = await fs.readFile(feedbackFile, 'utf8');
            const feedbackHistory = JSON.parse(data);

            if (feedbackHistory.feedback && feedbackHistory.feedback.length > 0) {
                // Converte feedback para formato de treinamento
                const feedbackData = feedbackHistory.feedback
                    .filter(f => f.processed && f.correctCategory)
                    .map(f => ({
                        text: f.text || `Incident ${f.incidentId}`, // Simulado
                        category: f.correctCategory,
                        source: 'feedback',
                        confidence: f.confidence || 1.0
                    }));

                this.trainingData.push(...feedbackData);
                console.log(`   📝 Adicionados ${feedbackData.length} registros de feedback`);
            }
        } catch (error) {
            console.log('   📝 Nenhum dado de feedback encontrado');
        }
    }

    /**
     * Carrega dados históricos
     */
    async loadHistoricalData() {
        try {
            const historicalFile = path.join(this.options.dataPath, 'historical_incidents.json');
            const data = await fs.readFile(historicalFile, 'utf8');
            const historicalData = JSON.parse(data);

            if (historicalData && historicalData.length > 0) {
                const validHistorical = historicalData
                    .filter(h => h.text && h.category)
                    .map(h => ({
                        text: h.text,
                        category: h.category,
                        source: 'historical',
                        confidence: h.confidence || 0.8
                    }));

                this.trainingData.push(...validHistorical);
                console.log(`   📚 Adicionados ${validHistorical.length} registros históricos`);
            }
        } catch (error) {
            console.log('   📚 Nenhum dado histórico encontrado');
        }
    }

    /**
     * Valida qualidade dos dados
     */
    async validateDataQuality() {
        console.log('🔍 Validando qualidade dos dados...');

        // Verifica distribuição por categoria
        const categoryDistribution = {};
        for (const item of this.trainingData) {
            categoryDistribution[item.category] = (categoryDistribution[item.category] || 0) + 1;
        }

        console.log('   📊 Distribuição por categoria:');
        for (const [category, count] of Object.entries(categoryDistribution)) {
            console.log(`      ${category}: ${count} amostras`);

            if (count < this.options.minSamples) {
                console.warn(`   ⚠️  Categoria '${category}' tem apenas ${count} amostras (mínimo: ${this.options.minSamples})`);
            }
        }

        // Remove duplicatas
        const uniqueData = [];
        const seen = new Set();

        for (const item of this.trainingData) {
            const key = `${item.text}_${item.category}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueData.push(item);
            }
        }

        const duplicatesRemoved = this.trainingData.length - uniqueData.length;
        if (duplicatesRemoved > 0) {
            console.log(`   🔄 Removidas ${duplicatesRemoved} duplicatas`);
            this.trainingData = uniqueData;
        }

        // Valida textos vazios ou muito curtos
        const validData = this.trainingData.filter(item => {
            return item.text && item.text.trim().length >= 10 && item.category;
        });

        const invalidRemoved = this.trainingData.length - validData.length;
        if (invalidRemoved > 0) {
            console.log(`   🚮 Removidos ${invalidRemoved} registros inválidos`);
            this.trainingData = validData;
        }

        console.log(`   ✅ Dados validados: ${this.trainingData.length} registros válidos\n`);
    }

    /**
     * Gera dados sintéticos
     */
    async generateSyntheticData() {
        console.log('🧪 Gerando dados sintéticos...');

        const templates = {
            'mainframe': [
                'Erro {error_code} no programa {program} sistema z/OS',
                'ABEND {abend_code} durante processamento batch {job_name}',
                'CICS transação {trans_id} com timeout região {region}',
                'DB2 tablespace {ts_name} em status {status} erro {db_error}',
                'JCL job {job_name} falhou step {step_name} erro {error}'
            ],
            'mobile-banking': [
                'App {platform} crashando na tela {screen}',
                'API mobile retornando erro {status_code} endpoint {endpoint}',
                'Push notification não funcionando plataforma {platform}',
                'React Native erro {error_type} componente {component}',
                'Autenticação mobile falhando método {auth_method}'
            ],
            'payment-systems': [
                'PIX indisponível para {institution} código {error_code}',
                'TED não processando destino {bank} erro {error}',
                'Gateway pagamento recusando {payment_type} código {code}',
                'Transferência falhou valor {amount} erro {error_type}',
                'DOC compensação falhando clearing {clearing_code}'
            ]
        };

        const placeholders = {
            error_code: ['S0C4', 'S0C7', 'S322', 'S806', 'S837'],
            abend_code: ['0C4', '0C7', '322', 'B37', 'D37'],
            program: ['PGMTEST01', 'BATCH001', 'ONLINE02', 'REPORT03'],
            platform: ['iOS', 'Android', 'React Native'],
            status_code: ['500', '404', '403', '502', '503'],
            payment_type: ['cartão crédito', 'cartão débito', 'transferência'],
            bank: ['Banco do Brasil', 'Caixa', 'Bradesco', 'Itaú']
        };

        const syntheticData = [];
        const targetCount = Math.round(this.trainingData.length * this.options.syntheticDataRatio);

        for (let i = 0; i < targetCount; i++) {
            const categories = Object.keys(templates);
            const category = categories[Math.floor(Math.random() * categories.length)];
            const template = templates[category][Math.floor(Math.random() * templates[category].length)];

            let text = template;
            for (const [placeholder, values] of Object.entries(placeholders)) {
                if (text.includes(`{${placeholder}}`)) {
                    const value = values[Math.floor(Math.random() * values.length)];
                    text = text.replace(`{${placeholder}}`, value);
                }
            }

            // Remove placeholders não preenchidos
            text = text.replace(/\{[^}]+\}/g, 'SYSTEM');

            syntheticData.push({
                text: text,
                category: category,
                source: 'synthetic',
                confidence: 0.6
            });
        }

        this.trainingData.push(...syntheticData);
        console.log(`   🎯 Gerados ${syntheticData.length} registros sintéticos\n`);
    }

    /**
     * Prepara dados para treinamento
     */
    async prepareTrainingData() {
        console.log('⚙️  Preparando dados para treinamento...');

        // Embaralha dados
        this.trainingData = this.shuffleArray(this.trainingData);

        // Divide em treino e validação
        const splitIndex = Math.floor(this.trainingData.length * (1 - this.options.validationSplit));
        this.validationData = this.trainingData.slice(splitIndex);
        this.trainingData = this.trainingData.slice(0, splitIndex);

        console.log(`   📚 Dados de treinamento: ${this.trainingData.length}`);
        console.log(`   🔍 Dados de validação: ${this.validationData.length}\n`);
    }

    /**
     * Treina o modelo
     */
    async trainModel() {
        console.log(`🤖 Treinando modelo ${this.options.algorithm}...`);

        this.classifier = new MLClassifier({
            algorithm: this.options.algorithm,
            modelPath: this.options.modelPath,
            enableIncrementalLearning: true
        });

        await this.classifier.initialize();
        await this.classifier.train(this.trainingData);

        console.log('   ✅ Modelo treinado com sucesso\n');
    }

    /**
     * Avalia o modelo
     */
    async evaluateModel() {
        console.log('📊 Avaliando performance do modelo...');

        const predictions = [];
        const actualLabels = [];

        for (const sample of this.validationData) {
            const result = await this.classifier.predict(sample.text);

            if (result && result.length > 0) {
                predictions.push(result[0].category);
            } else {
                predictions.push('unknown');
            }

            actualLabels.push(sample.category);
        }

        // Calcula métricas
        const metrics = this.calculateMetrics(predictions, actualLabels);
        this.testResults.validation = metrics;

        console.log(`   🎯 Acurácia: ${(metrics.accuracy * 100).toFixed(2)}%`);
        console.log(`   📏 Precisão: ${(metrics.precision * 100).toFixed(2)}%`);
        console.log(`   📋 Recall: ${(metrics.recall * 100).toFixed(2)}%`);
        console.log(`   🎲 F1-Score: ${(metrics.f1Score * 100).toFixed(2)}%`);

        // Matriz de confusão
        console.log('\n   📊 Matriz de Confusão:');
        this.printConfusionMatrix(predictions, actualLabels);

        // Cross-validation se habilitado
        if (this.options.enableCrossValidation) {
            await this.performCrossValidation();
        }

        console.log();
    }

    /**
     * Realiza validação cruzada
     */
    async performCrossValidation() {
        console.log(`🔄 Executando validação cruzada (${this.options.folds} folds)...`);

        const allData = [...this.trainingData, ...this.validationData];
        const foldSize = Math.floor(allData.length / this.options.folds);
        const cvResults = [];

        for (let fold = 0; fold < this.options.folds; fold++) {
            console.log(`   Fold ${fold + 1}/${this.options.folds}...`);

            // Divide dados para este fold
            const testStart = fold * foldSize;
            const testEnd = fold === this.options.folds - 1 ? allData.length : testStart + foldSize;

            const testData = allData.slice(testStart, testEnd);
            const trainData = [...allData.slice(0, testStart), ...allData.slice(testEnd)];

            // Treina modelo para este fold
            const foldClassifier = new MLClassifier({
                algorithm: this.options.algorithm,
                modelPath: path.join(this.options.modelPath, `fold_${fold}`)
            });

            await foldClassifier.initialize();
            await foldClassifier.train(trainData);

            // Testa modelo
            const predictions = [];
            const actualLabels = [];

            for (const sample of testData) {
                const result = await foldClassifier.predict(sample.text);
                predictions.push(result && result.length > 0 ? result[0].category : 'unknown');
                actualLabels.push(sample.category);
            }

            const foldMetrics = this.calculateMetrics(predictions, actualLabels);
            cvResults.push(foldMetrics);
        }

        // Calcula médias
        const avgMetrics = {
            accuracy: cvResults.reduce((sum, r) => sum + r.accuracy, 0) / cvResults.length,
            precision: cvResults.reduce((sum, r) => sum + r.precision, 0) / cvResults.length,
            recall: cvResults.reduce((sum, r) => sum + r.recall, 0) / cvResults.length,
            f1Score: cvResults.reduce((sum, r) => sum + r.f1Score, 0) / cvResults.length
        };

        this.testResults.crossValidation = {
            folds: cvResults,
            average: avgMetrics
        };

        console.log(`   📊 CV Acurácia Média: ${(avgMetrics.accuracy * 100).toFixed(2)}%`);
        console.log(`   📊 CV F1-Score Médio: ${(avgMetrics.f1Score * 100).toFixed(2)}%`);
    }

    /**
     * Compara diferentes algoritmos
     */
    async compareAlgorithms() {
        console.log('🔬 Comparando algoritmos...');

        const algorithms = ['naive_bayes', 'svm', 'random_forest'];
        const comparison = {};

        for (const algorithm of algorithms) {
            if (algorithm === this.options.algorithm) {
                comparison[algorithm] = this.testResults.validation;
                continue;
            }

            console.log(`   Testando ${algorithm}...`);

            const testClassifier = new MLClassifier({
                algorithm: algorithm,
                modelPath: path.join(this.options.modelPath, `test_${algorithm}`)
            });

            await testClassifier.initialize();
            await testClassifier.train(this.trainingData);

            // Avalia
            const predictions = [];
            const actualLabels = [];

            for (const sample of this.validationData) {
                const result = await testClassifier.predict(sample.text);
                predictions.push(result && result.length > 0 ? result[0].category : 'unknown');
                actualLabels.push(sample.category);
            }

            comparison[algorithm] = this.calculateMetrics(predictions, actualLabels);
        }

        this.testResults.algorithmComparison = comparison;

        console.log('\n   📊 Comparação de Algoritmos:');
        for (const [algorithm, metrics] of Object.entries(comparison)) {
            console.log(`      ${algorithm}: Acc=${(metrics.accuracy * 100).toFixed(1)}% F1=${(metrics.f1Score * 100).toFixed(1)}%`);
        }
        console.log();
    }

    /**
     * Analisa features mais importantes
     */
    async analyzeFeatures() {
        console.log('🔍 Analisando features mais importantes...');

        // Análise de palavras-chave por categoria
        const categoryKeywords = {};

        for (const sample of this.trainingData) {
            if (!categoryKeywords[sample.category]) {
                categoryKeywords[sample.category] = {};
            }

            const words = sample.text.toLowerCase().match(/\b\w+\b/g) || [];
            for (const word of words) {
                if (word.length > 3) { // Ignora palavras muito curtas
                    categoryKeywords[sample.category][word] = (categoryKeywords[sample.category][word] || 0) + 1;
                }
            }
        }

        // Encontra top keywords por categoria
        const topKeywords = {};
        for (const [category, keywords] of Object.entries(categoryKeywords)) {
            const sorted = Object.entries(keywords)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10)
                .map(([word, count]) => ({ word, count }));

            topKeywords[category] = sorted;
        }

        this.testResults.featureAnalysis = {
            categoryKeywords: topKeywords,
            totalFeatures: Object.keys(this.classifier.vectorizer?.vocabulary || {}).length
        };

        console.log('   📝 Top palavras-chave por categoria:');
        for (const [category, keywords] of Object.entries(topKeywords)) {
            console.log(`      ${category}:`);
            keywords.slice(0, 5).forEach(kw => {
                console.log(`         ${kw.word} (${kw.count})`);
            });
        }
        console.log();
    }

    /**
     * Salva resultados do treinamento
     */
    async saveResults() {
        console.log('💾 Salvando resultados...');

        const results = {
            trainingInfo: {
                algorithm: this.options.algorithm,
                trainingSize: this.trainingData.length,
                validationSize: this.validationData.length,
                timestamp: new Date().toISOString(),
                options: this.options
            },
            metrics: this.testResults,
            model: {
                version: this.classifier.getModelVersion(),
                accuracy: this.classifier.getAccuracy(),
                path: this.options.modelPath
            }
        };

        const resultsPath = path.join(this.options.modelPath, 'training_results.json');
        await fs.mkdir(path.dirname(resultsPath), { recursive: true });
        await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));

        console.log(`   ✅ Resultados salvos em: ${resultsPath}\n`);
    }

    /**
     * Gera relatório final
     */
    async generateReport() {
        console.log('📋 Gerando relatório de treinamento...');

        const report = this.buildTextReport();
        const reportPath = path.join(this.options.modelPath, 'training_report.md');

        await fs.writeFile(reportPath, report);

        console.log(`   📄 Relatório salvo em: ${reportPath}`);
        console.log('\n' + '='.repeat(60));
        console.log('RESUMO DO TREINAMENTO');
        console.log('='.repeat(60));

        const validation = this.testResults.validation;
        console.log(`Algoritmo: ${this.options.algorithm}`);
        console.log(`Dados de treinamento: ${this.trainingData.length}`);
        console.log(`Acurácia: ${(validation.accuracy * 100).toFixed(2)}%`);
        console.log(`F1-Score: ${(validation.f1Score * 100).toFixed(2)}%`);

        if (this.testResults.crossValidation) {
            const cv = this.testResults.crossValidation.average;
            console.log(`CV Acurácia Média: ${(cv.accuracy * 100).toFixed(2)}%`);
        }

        console.log('='.repeat(60));
    }

    // ============= MÉTODOS AUXILIARES =============

    calculateMetrics(predictions, actual) {
        const accuracy = predictions.reduce((correct, pred, i) =>
            correct + (pred === actual[i] ? 1 : 0), 0) / predictions.length;

        // Calcula precisão, recall e F1 por classe
        const classes = [...new Set(actual)];
        let totalPrecision = 0;
        let totalRecall = 0;

        for (const cls of classes) {
            const tp = predictions.reduce((count, pred, i) =>
                count + (pred === cls && actual[i] === cls ? 1 : 0), 0);
            const fp = predictions.reduce((count, pred, i) =>
                count + (pred === cls && actual[i] !== cls ? 1 : 0), 0);
            const fn = predictions.reduce((count, pred, i) =>
                count + (pred !== cls && actual[i] === cls ? 1 : 0), 0);

            const precision = tp / (tp + fp) || 0;
            const recall = tp / (tp + fn) || 0;

            totalPrecision += precision;
            totalRecall += recall;
        }

        const avgPrecision = totalPrecision / classes.length;
        const avgRecall = totalRecall / classes.length;
        const f1Score = 2 * (avgPrecision * avgRecall) / (avgPrecision + avgRecall) || 0;

        return {
            accuracy,
            precision: avgPrecision,
            recall: avgRecall,
            f1Score
        };
    }

    printConfusionMatrix(predictions, actual) {
        const classes = [...new Set(actual)].sort();
        const matrix = {};

        // Inicializa matriz
        for (const cls of classes) {
            matrix[cls] = {};
            for (const cls2 of classes) {
                matrix[cls][cls2] = 0;
            }
        }

        // Preenche matriz
        for (let i = 0; i < actual.length; i++) {
            const actualClass = actual[i];
            const predClass = predictions[i];
            if (matrix[actualClass] && matrix[actualClass][predClass] !== undefined) {
                matrix[actualClass][predClass]++;
            }
        }

        // Imprime matriz (versão simplificada)
        console.log('      ' + classes.map(c => c.substr(0, 8).padEnd(8)).join(' '));
        for (const actualClass of classes) {
            const row = actualClass.substr(0, 8).padEnd(6) +
                       classes.map(predClass =>
                           (matrix[actualClass][predClass] || 0).toString().padEnd(8)
                       ).join(' ');
            console.log(row);
        }
    }

    buildTextReport() {
        const validation = this.testResults.validation;
        const timestamp = new Date().toISOString();

        let report = `# Relatório de Treinamento do Classificador ML

**Data:** ${timestamp}
**Algoritmo:** ${this.options.algorithm}

## Resumo dos Dados

- **Dados de treinamento:** ${this.trainingData.length} registros
- **Dados de validação:** ${this.validationData.length} registros
- **Total:** ${this.trainingData.length + this.validationData.length} registros

## Métricas de Performance

### Validação Principal
- **Acurácia:** ${(validation.accuracy * 100).toFixed(2)}%
- **Precisão:** ${(validation.precision * 100).toFixed(2)}%
- **Recall:** ${(validation.recall * 100).toFixed(2)}%
- **F1-Score:** ${(validation.f1Score * 100).toFixed(2)}%

`;

        if (this.testResults.crossValidation) {
            const cv = this.testResults.crossValidation.average;
            report += `### Validação Cruzada (${this.options.folds} folds)
- **Acurácia Média:** ${(cv.accuracy * 100).toFixed(2)}%
- **F1-Score Médio:** ${(cv.f1Score * 100).toFixed(2)}%

`;
        }

        if (this.testResults.algorithmComparison) {
            report += `## Comparação de Algoritmos

`;
            for (const [algorithm, metrics] of Object.entries(this.testResults.algorithmComparison)) {
                report += `- **${algorithm}:** Acc=${(metrics.accuracy * 100).toFixed(1)}% F1=${(metrics.f1Score * 100).toFixed(1)}%
`;
            }
            report += '\n';
        }

        if (this.testResults.featureAnalysis) {
            report += `## Análise de Features

**Total de features:** ${this.testResults.featureAnalysis.totalFeatures}

### Top Palavras-chave por Categoria

`;
            for (const [category, keywords] of Object.entries(this.testResults.featureAnalysis.categoryKeywords)) {
                report += `**${category}:**
`;
                keywords.slice(0, 5).forEach(kw => {
                    report += `- ${kw.word} (${kw.count} ocorrências)
`;
                });
                report += '\n';
            }
        }

        report += `## Configurações

\`\`\`json
${JSON.stringify(this.options, null, 2)}
\`\`\`

## Conclusões

O modelo foi treinado com sucesso usando o algoritmo ${this.options.algorithm}.
A acurácia de ${(validation.accuracy * 100).toFixed(2)}% indica ${validation.accuracy > 0.8 ? 'boa' : validation.accuracy > 0.6 ? 'aceitável' : 'baixa'} performance.

${validation.accuracy > 0.8 ?
    '✅ O modelo está pronto para produção.' :
    validation.accuracy > 0.6 ?
        '⚠️  O modelo precisa de melhorias antes da produção.' :
        '❌ O modelo precisa de mais dados e ajustes significativos.'
}
`;

        return report;
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
}

// ============= EXECUÇÃO PRINCIPAL =============

async function main() {
    const args = process.argv.slice(2);
    const options = {};

    // Parse argumentos da linha de comando
    for (let i = 0; i < args.length; i += 2) {
        const key = args[i].replace('--', '');
        const value = args[i + 1];

        switch (key) {
            case 'algorithm':
                options.algorithm = value;
                break;
            case 'data-path':
                options.dataPath = value;
                break;
            case 'model-path':
                options.modelPath = value;
                break;
            case 'validation-split':
                options.validationSplit = parseFloat(value);
                break;
            case 'cv':
                options.enableCrossValidation = value === 'true';
                break;
            case 'compare':
                options.enableModelComparison = value === 'true';
                break;
            case 'synthetic':
                options.generateSyntheticData = value === 'true';
                break;
            default:
                if (args[i].startsWith('--')) {
                    console.log(`Argumento desconhecido: ${args[i]}`);
                }
        }
    }

    const trainer = new ClassifierTrainer(options);
    await trainer.run();
}

// Executa se chamado diretamente
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Erro fatal:', error);
        process.exit(1);
    });
}

module.exports = ClassifierTrainer;