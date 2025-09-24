/**
 * MLClassifier - Sistema de Machine Learning para Classificação de Incidentes
 *
 * Implementa algoritmos de ML para classificação automática de incidentes
 * com suporte a treinamento incremental e múltiplos algoritmos.
 */

const path = require('path');
const fs = require('fs').promises;

class MLClassifier {
    constructor(options = {}) {
        this.options = {
            algorithm: options.algorithm || 'naive_bayes', // naive_bayes, svm, random_forest, neural_network
            modelPath: options.modelPath || path.join(__dirname, '../../models/ml'),
            enableIncrementalLearning: options.enableIncrementalLearning !== false,
            batchSize: options.batchSize || 100,
            maxFeatures: options.maxFeatures || 10000,
            minDocumentFreq: options.minDocumentFreq || 2,
            maxDocumentFreq: options.maxDocumentFreq || 0.95,
            nGramRange: options.nGramRange || [1, 2],
            enableFeatureSelection: options.enableFeatureSelection !== false,
            ...options
        };

        // Estado do modelo
        this.model = null;
        this.vectorizer = null;
        this.labelEncoder = null;
        this.featureSelector = null;
        this.isModelLoaded = false;
        this.modelVersion = '1.0.0';

        // Métricas de performance
        this.metrics = {
            accuracy: 0,
            precision: 0,
            recall: 0,
            f1Score: 0,
            trainingSamples: 0,
            lastTraining: null,
            predictions: 0,
            averageConfidence: 0
        };

        // Cache de features
        this.featureCache = new Map();
        this.predictionCache = new Map();

        // Dados de treinamento incremental
        this.incrementalBuffer = [];
    }

    /**
     * Inicializa o classificador ML
     */
    async initialize() {
        try {
            // Tenta carregar modelo existente
            const modelLoaded = await this.loadModel();

            if (!modelLoaded) {
                console.log('No existing model found, initializing fresh classifier');
                await this.initializeFreshModel();
            }

            console.log(`MLClassifier initialized with algorithm: ${this.options.algorithm}`);
            return true;

        } catch (error) {
            console.error('Error initializing MLClassifier:', error);
            throw error;
        }
    }

    /**
     * Inicializa um modelo fresco
     */
    async initializeFreshModel() {
        // Inicializa vectorizer
        this.vectorizer = new TFIDFVectorizer({
            maxFeatures: this.options.maxFeatures,
            minDocumentFreq: this.options.minDocumentFreq,
            maxDocumentFreq: this.options.maxDocumentFreq,
            nGramRange: this.options.nGramRange
        });

        // Inicializa encoder de labels
        this.labelEncoder = new LabelEncoder();

        // Inicializa seletor de features se habilitado
        if (this.options.enableFeatureSelection) {
            this.featureSelector = new FeatureSelector({
                method: 'chi2',
                k: Math.min(5000, this.options.maxFeatures)
            });
        }

        // Inicializa modelo baseado no algoritmo escolhido
        this.model = this.createModel(this.options.algorithm);

        this.isModelLoaded = true;
    }

    /**
     * Cria modelo baseado no algoritmo especificado
     */
    createModel(algorithm) {
        switch (algorithm) {
            case 'naive_bayes':
                return new MultinomialNaiveBayes({
                    alpha: 1.0,
                    fitPrior: true
                });

            case 'svm':
                return new SupportVectorMachine({
                    kernel: 'linear',
                    C: 1.0,
                    probability: true
                });

            case 'random_forest':
                return new RandomForestClassifier({
                    nEstimators: 100,
                    maxDepth: 20,
                    minSamplesSplit: 5,
                    randomState: 42
                });

            case 'neural_network':
                return new MLPClassifier({
                    hiddenLayerSizes: [100, 50],
                    maxIter: 500,
                    alpha: 0.0001,
                    learningRate: 'adaptive'
                });

            default:
                throw new Error(`Unsupported algorithm: ${algorithm}`);
        }
    }

    /**
     * Treina o modelo com dados de treinamento
     */
    async train(trainingData) {
        try {
            if (!Array.isArray(trainingData) || trainingData.length === 0) {
                throw new Error('Training data must be a non-empty array');
            }

            console.log(`Training model with ${trainingData.length} samples`);

            // Separa textos e labels
            const texts = trainingData.map(item => item.text);
            const labels = trainingData.map(item => item.category);

            // Processa textos
            const processedTexts = texts.map(text => this.preprocessText(text));

            // Treina vectorizer
            console.log('Training vectorizer...');
            await this.vectorizer.fit(processedTexts);

            // Converte textos para features
            const features = await this.vectorizer.transform(processedTexts);

            // Treina label encoder
            const encodedLabels = await this.labelEncoder.fitTransform(labels);

            // Aplica seleção de features se habilitada
            let finalFeatures = features;
            if (this.featureSelector) {
                console.log('Applying feature selection...');
                finalFeatures = await this.featureSelector.fitTransform(features, encodedLabels);
            }

            // Treina modelo
            console.log('Training classifier...');
            await this.model.fit(finalFeatures, encodedLabels);

            // Atualiza métricas
            this.metrics.trainingSamples = trainingData.length;
            this.metrics.lastTraining = new Date().toISOString();

            // Avalia modelo
            await this.evaluateModel(finalFeatures, encodedLabels);

            // Salva modelo
            await this.saveModel();

            console.log('Model training completed successfully');
            return true;

        } catch (error) {
            console.error('Error training model:', error);
            throw error;
        }
    }

    /**
     * Treinamento incremental
     */
    async incrementalTrain(newData) {
        try {
            if (!this.options.enableIncrementalLearning) {
                console.warn('Incremental learning is disabled');
                return false;
            }

            if (!this.isModelLoaded) {
                console.log('No base model found, performing full training');
                return await this.train(newData);
            }

            // Adiciona novos dados ao buffer
            this.incrementalBuffer.push(...newData);

            // Processa em lotes se buffer atingir o tamanho mínimo
            if (this.incrementalBuffer.length >= this.options.batchSize) {
                await this.processIncrementalBatch();
            }

            return true;

        } catch (error) {
            console.error('Error in incremental training:', error);
            return false;
        }
    }

    /**
     * Processa lote incremental
     */
    async processIncrementalBatch() {
        try {
            const batchData = this.incrementalBuffer.splice(0, this.options.batchSize);

            console.log(`Processing incremental batch with ${batchData.length} samples`);

            // Processa novos textos
            const texts = batchData.map(item => this.preprocessText(item.text));
            const labels = batchData.map(item => item.category);

            // Atualiza vectorizer incrementalmente (se suportado)
            if (this.vectorizer.partialFit) {
                await this.vectorizer.partialFit(texts);
            }

            // Converte para features
            const features = await this.vectorizer.transform(texts);

            // Atualiza label encoder
            const encodedLabels = await this.labelEncoder.transform(labels);

            // Aplica seleção de features
            let finalFeatures = features;
            if (this.featureSelector) {
                finalFeatures = await this.featureSelector.transform(features);
            }

            // Treinamento incremental do modelo
            if (this.model.partialFit) {
                await this.model.partialFit(finalFeatures, encodedLabels);
            } else {
                // Se não suporta incremental, retreina com subset dos dados
                console.log('Model does not support incremental learning, performing partial retrain');
                await this.model.fit(finalFeatures, encodedLabels);
            }

            // Atualiza métricas
            this.metrics.trainingSamples += batchData.length;
            this.metrics.lastTraining = new Date().toISOString();

            // Incrementa versão do modelo
            const versionParts = this.modelVersion.split('.');
            versionParts[2] = (parseInt(versionParts[2]) + 1).toString();
            this.modelVersion = versionParts.join('.');

            // Salva modelo atualizado
            await this.saveModel();

            console.log('Incremental training completed');

        } catch (error) {
            console.error('Error processing incremental batch:', error);
            throw error;
        }
    }

    /**
     * Faz predição para um texto
     */
    async predict(text, options = {}) {
        try {
            if (!this.isModelLoaded) {
                throw new Error('Model not loaded');
            }

            // Verifica cache
            const cacheKey = this.generatePredictionCacheKey(text, options);
            if (this.predictionCache.has(cacheKey)) {
                return this.predictionCache.get(cacheKey);
            }

            // Preprocessa texto
            const processedText = this.preprocessText(text);

            // Extrai features
            const features = await this.extractFeatures(processedText);

            // Aplica seleção de features
            let finalFeatures = features;
            if (this.featureSelector) {
                finalFeatures = await this.featureSelector.transform([features]);
            } else {
                finalFeatures = [features];
            }

            // Faz predição
            const probabilities = await this.model.predictProba(finalFeatures);
            const prediction = probabilities[0]; // Primeira (e única) amostra

            // Converte para resultado estruturado
            const results = await this.formatPredictionResults(prediction, text, options);

            // Cache resultado
            this.predictionCache.set(cacheKey, results);

            // Atualiza métricas
            this.metrics.predictions++;
            this.updateAverageConfidence(results);

            return results;

        } catch (error) {
            console.error('Error making prediction:', error);
            return [];
        }
    }

    /**
     * Extrai features do texto
     */
    async extractFeatures(text) {
        try {
            // Verifica cache de features
            if (this.featureCache.has(text)) {
                return this.featureCache.get(text);
            }

            // Vectorização TF-IDF
            const tfidfFeatures = await this.vectorizer.transform([text]);

            // Features adicionais
            const additionalFeatures = this.extractAdditionalFeatures(text);

            // Combina features
            const combinedFeatures = this.combineFeatures(tfidfFeatures[0], additionalFeatures);

            // Cache features
            if (this.featureCache.size < 10000) { // Limita cache
                this.featureCache.set(text, combinedFeatures);
            }

            return combinedFeatures;

        } catch (error) {
            console.error('Error extracting features:', error);
            return [];
        }
    }

    /**
     * Extrai features adicionais específicas do domínio
     */
    extractAdditionalFeatures(text) {
        const features = {};

        // Comprimento do texto
        features.textLength = text.length;
        features.wordCount = text.split(/\s+/).length;

        // Features de urgência
        const urgencyWords = ['urgente', 'crítico', 'emergencia', 'falha', 'erro'];
        features.urgencyScore = urgencyWords.reduce((score, word) => {
            return score + (text.toLowerCase().includes(word) ? 1 : 0);
        }, 0);

        // Features técnicas
        const technicalTerms = ['mainframe', 'cobol', 'cics', 'db2', 'java', 'api', 'servidor'];
        features.technicalScore = technicalTerms.reduce((score, term) => {
            return score + (text.toLowerCase().includes(term) ? 1 : 0);
        }, 0);

        // Features de sistema
        const systemTypes = ['web', 'mobile', 'atm', 'core', 'payment'];
        features.systemIndicators = systemTypes.map(system =>
            text.toLowerCase().includes(system) ? 1 : 0
        );

        // Features de tempo
        const timeWords = ['ontem', 'hoje', 'agora', 'recente', 'desde'];
        features.timeRelevance = timeWords.reduce((score, word) => {
            return score + (text.toLowerCase().includes(word) ? 1 : 0);
        }, 0);

        // Features de impacto
        const impactWords = ['usuários', 'clientes', 'sistema', 'produção', 'ambiente'];
        features.impactScore = impactWords.reduce((score, word) => {
            return score + (text.toLowerCase().includes(word) ? 1 : 0);
        }, 0);

        return features;
    }

    /**
     * Combina features TF-IDF com features adicionais
     */
    combineFeatures(tfidfFeatures, additionalFeatures) {
        // Converte features adicionais para array
        const additionalArray = [];
        additionalArray.push(additionalFeatures.textLength / 1000); // Normaliza
        additionalArray.push(additionalFeatures.wordCount / 100); // Normaliza
        additionalArray.push(additionalFeatures.urgencyScore);
        additionalArray.push(additionalFeatures.technicalScore);
        additionalArray.push(...additionalFeatures.systemIndicators);
        additionalArray.push(additionalFeatures.timeRelevance);
        additionalArray.push(additionalFeatures.impactScore);

        // Combina arrays
        return [...tfidfFeatures, ...additionalArray];
    }

    /**
     * Formata resultados da predição
     */
    async formatPredictionResults(probabilities, originalText, options) {
        const results = [];

        // Obtém classes do label encoder
        const classes = this.labelEncoder.classes_;

        // Combina probabilidades com classes
        for (let i = 0; i < classes.length; i++) {
            const confidence = probabilities[i];

            if (confidence > 0.1) { // Filtra resultados muito baixos
                results.push({
                    category: classes[i],
                    confidence: confidence,
                    features: options.includeFeatures ? await this.extractFeatures(this.preprocessText(originalText)) : undefined,
                    explanation: this.generateExplanation(originalText, classes[i], confidence)
                });
            }
        }

        // Ordena por confiança
        results.sort((a, b) => b.confidence - a.confidence);

        return results.slice(0, 5); // Retorna top 5
    }

    /**
     * Gera explicação para a predição
     */
    generateExplanation(text, category, confidence) {
        const explanation = {
            confidence: Math.round(confidence * 100),
            reasoning: [],
            keyFeatures: []
        };

        // Identifica palavras-chave relevantes
        const lowerText = text.toLowerCase();

        // Mapeamento categoria -> palavras-chave
        const categoryKeywords = {
            'mainframe': ['mainframe', 'cobol', 'cics', 'db2', 'jcl', 'mvs'],
            'mobile-banking': ['mobile', 'app', 'smartphone', 'android', 'ios'],
            'internet-banking': ['web', 'portal', 'internet', 'browser', 'site'],
            'payment-systems': ['pix', 'pagamento', 'transferencia', 'ted', 'doc'],
            'core-banking': ['core', 'conta', 'saldo', 'transacao', 'processamento'],
            'infrastructure': ['servidor', 'rede', 'conexao', 'hardware', 'sistema']
        };

        const keywords = categoryKeywords[category] || [];
        const foundKeywords = keywords.filter(keyword => lowerText.includes(keyword));

        if (foundKeywords.length > 0) {
            explanation.keyFeatures = foundKeywords;
            explanation.reasoning.push(`Encontradas palavras-chave relevantes: ${foundKeywords.join(', ')}`);
        }

        // Adiciona contexto de confiança
        if (confidence > 0.8) {
            explanation.reasoning.push('Alta confiança baseada em múltiplos indicadores');
        } else if (confidence > 0.6) {
            explanation.reasoning.push('Confiança moderada baseada em alguns indicadores');
        } else {
            explanation.reasoning.push('Confiança baixa, classificação incerta');
        }

        return explanation;
    }

    /**
     * Avalia performance do modelo
     */
    async evaluateModel(features, labels) {
        try {
            // Split para validação (80/20)
            const splitIndex = Math.floor(features.length * 0.8);
            const trainFeatures = features.slice(0, splitIndex);
            const testFeatures = features.slice(splitIndex);
            const trainLabels = labels.slice(0, splitIndex);
            const testLabels = labels.slice(splitIndex);

            if (testFeatures.length === 0) {
                console.log('Insufficient data for evaluation');
                return;
            }

            // Faz predições no conjunto de teste
            const predictions = await this.model.predict(testFeatures);

            // Calcula métricas
            this.metrics.accuracy = this.calculateAccuracy(predictions, testLabels);
            this.metrics.precision = this.calculatePrecision(predictions, testLabels);
            this.metrics.recall = this.calculateRecall(predictions, testLabels);
            this.metrics.f1Score = this.calculateF1Score(this.metrics.precision, this.metrics.recall);

            console.log(`Model evaluation - Accuracy: ${(this.metrics.accuracy * 100).toFixed(2)}%`);

        } catch (error) {
            console.error('Error evaluating model:', error);
        }
    }

    /**
     * Calcula acurácia
     */
    calculateAccuracy(predictions, actual) {
        if (predictions.length !== actual.length) return 0;

        const correct = predictions.reduce((count, pred, i) => {
            return count + (pred === actual[i] ? 1 : 0);
        }, 0);

        return correct / predictions.length;
    }

    /**
     * Calcula precisão
     */
    calculatePrecision(predictions, actual) {
        // Implementação simplificada para múltiplas classes
        const classes = [...new Set(actual)];
        let totalPrecision = 0;

        for (const cls of classes) {
            const truePositives = predictions.reduce((count, pred, i) => {
                return count + (pred === cls && actual[i] === cls ? 1 : 0);
            }, 0);

            const falsePositives = predictions.reduce((count, pred, i) => {
                return count + (pred === cls && actual[i] !== cls ? 1 : 0);
            }, 0);

            const precision = truePositives / (truePositives + falsePositives) || 0;
            totalPrecision += precision;
        }

        return totalPrecision / classes.length;
    }

    /**
     * Calcula recall
     */
    calculateRecall(predictions, actual) {
        // Implementação simplificada para múltiplas classes
        const classes = [...new Set(actual)];
        let totalRecall = 0;

        for (const cls of classes) {
            const truePositives = predictions.reduce((count, pred, i) => {
                return count + (pred === cls && actual[i] === cls ? 1 : 0);
            }, 0);

            const falseNegatives = predictions.reduce((count, pred, i) => {
                return count + (pred !== cls && actual[i] === cls ? 1 : 0);
            }, 0);

            const recall = truePositives / (truePositives + falseNegatives) || 0;
            totalRecall += recall;
        }

        return totalRecall / classes.length;
    }

    /**
     * Calcula F1-Score
     */
    calculateF1Score(precision, recall) {
        if (precision + recall === 0) return 0;
        return 2 * (precision * recall) / (precision + recall);
    }

    /**
     * Salva modelo treinado
     */
    async saveModel() {
        try {
            await fs.mkdir(this.options.modelPath, { recursive: true });

            const modelData = {
                algorithm: this.options.algorithm,
                version: this.modelVersion,
                timestamp: new Date().toISOString(),
                metrics: this.metrics,
                model: this.serializeModel(),
                vectorizer: this.serializeVectorizer(),
                labelEncoder: this.serializeLabelEncoder(),
                featureSelector: this.featureSelector ? this.serializeFeatureSelector() : null
            };

            const modelPath = path.join(this.options.modelPath, 'model.json');
            await fs.writeFile(modelPath, JSON.stringify(modelData, null, 2));

            console.log(`Model saved to ${modelPath}`);

        } catch (error) {
            console.error('Error saving model:', error);
            throw error;
        }
    }

    /**
     * Carrega modelo salvo
     */
    async loadModel() {
        try {
            const modelPath = path.join(this.options.modelPath, 'model.json');
            const data = await fs.readFile(modelPath, 'utf8');
            const modelData = JSON.parse(data);

            // Restaura componentes
            this.modelVersion = modelData.version;
            this.metrics = modelData.metrics;
            this.model = this.deserializeModel(modelData.model);
            this.vectorizer = this.deserializeVectorizer(modelData.vectorizer);
            this.labelEncoder = this.deserializeLabelEncoder(modelData.labelEncoder);

            if (modelData.featureSelector) {
                this.featureSelector = this.deserializeFeatureSelector(modelData.featureSelector);
            }

            this.isModelLoaded = true;
            console.log(`Model loaded from ${modelPath} (version: ${this.modelVersion})`);

            return true;

        } catch (error) {
            console.log('Could not load existing model:', error.message);
            return false;
        }
    }

    // ============= MÉTODOS DE SERIALIZAÇÃO =============

    serializeModel() {
        // Em implementação real, usar bibliotecas específicas como pickle para Python
        // Aqui vamos simular uma serialização básica
        return {
            type: this.options.algorithm,
            parameters: this.model.getParameters ? this.model.getParameters() : {},
            state: this.model.getState ? this.model.getState() : {}
        };
    }

    deserializeModel(data) {
        // Recria modelo baseado nos dados salvos
        const model = this.createModel(data.type);

        if (model.setParameters && data.parameters) {
            model.setParameters(data.parameters);
        }

        if (model.setState && data.state) {
            model.setState(data.state);
        }

        return model;
    }

    serializeVectorizer() {
        return {
            vocabulary: this.vectorizer.vocabulary || {},
            idf: this.vectorizer.idf || {},
            maxFeatures: this.vectorizer.maxFeatures,
            nGramRange: this.vectorizer.nGramRange
        };
    }

    deserializeVectorizer(data) {
        const vectorizer = new TFIDFVectorizer({
            maxFeatures: data.maxFeatures,
            nGramRange: data.nGramRange
        });

        vectorizer.vocabulary = data.vocabulary;
        vectorizer.idf = data.idf;
        vectorizer.isFitted = true;

        return vectorizer;
    }

    serializeLabelEncoder() {
        return {
            classes: this.labelEncoder.classes_ || [],
            classToIndex: this.labelEncoder.classToIndex || {}
        };
    }

    deserializeLabelEncoder(data) {
        const encoder = new LabelEncoder();
        encoder.classes_ = data.classes;
        encoder.classToIndex = data.classToIndex;
        encoder.isFitted = true;
        return encoder;
    }

    serializeFeatureSelector() {
        if (!this.featureSelector) return null;

        return {
            selectedFeatures: this.featureSelector.selectedFeatures || [],
            scores: this.featureSelector.scores || [],
            method: this.featureSelector.method
        };
    }

    deserializeFeatureSelector(data) {
        if (!data) return null;

        const selector = new FeatureSelector({ method: data.method });
        selector.selectedFeatures = data.selectedFeatures;
        selector.scores = data.scores;
        selector.isFitted = true;
        return selector;
    }

    // ============= MÉTODOS AUXILIARES =============

    preprocessText(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\sáàâãéèêíìîóòôõúùûç]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    generatePredictionCacheKey(text, options) {
        const textHash = this.hashString(text);
        const optionsHash = this.hashString(JSON.stringify(options));
        return `${textHash}_${optionsHash}_${this.modelVersion}`;
    }

    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }

    updateAverageConfidence(results) {
        if (results.length > 0) {
            const avgConf = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
            this.metrics.averageConfidence = (this.metrics.averageConfidence + avgConf) / 2;
        }
    }

    // ============= GETTERS =============

    isModelLoaded() {
        return this.isModelLoaded;
    }

    getModelVersion() {
        return this.modelVersion;
    }

    getAccuracy() {
        return this.metrics.accuracy;
    }

    getMetrics() {
        return { ...this.metrics };
    }
}

// ============= CLASSES AUXILIARES SIMPLIFICADAS =============

/**
 * TF-IDF Vectorizer simplificado
 */
class TFIDFVectorizer {
    constructor(options = {}) {
        this.maxFeatures = options.maxFeatures || 10000;
        this.minDocumentFreq = options.minDocumentFreq || 2;
        this.maxDocumentFreq = options.maxDocumentFreq || 0.95;
        this.nGramRange = options.nGramRange || [1, 2];

        this.vocabulary = {};
        this.idf = {};
        this.isFitted = false;
    }

    async fit(documents) {
        // Implementação simplificada do TF-IDF
        console.log('Fitting TF-IDF vectorizer...');

        // Extrai vocabulário
        const allTerms = new Set();
        const termDocCounts = new Map();

        for (const doc of documents) {
            const terms = this.extractTerms(doc);
            const uniqueTerms = new Set(terms);

            for (const term of uniqueTerms) {
                allTerms.add(term);
                termDocCounts.set(term, (termDocCounts.get(term) || 0) + 1);
            }
        }

        // Filtra termos por frequência
        const filteredTerms = Array.from(allTerms).filter(term => {
            const docFreq = termDocCounts.get(term) / documents.length;
            return docFreq >= this.minDocumentFreq / documents.length &&
                   docFreq <= this.maxDocumentFreq;
        });

        // Limita número de features
        const sortedTerms = filteredTerms
            .sort((a, b) => termDocCounts.get(b) - termDocCounts.get(a))
            .slice(0, this.maxFeatures);

        // Constrói vocabulário
        this.vocabulary = {};
        sortedTerms.forEach((term, index) => {
            this.vocabulary[term] = index;
        });

        // Calcula IDF
        for (const term of Object.keys(this.vocabulary)) {
            const docFreq = termDocCounts.get(term);
            this.idf[term] = Math.log(documents.length / docFreq);
        }

        this.isFitted = true;
    }

    async transform(documents) {
        if (!this.isFitted) {
            throw new Error('Vectorizer not fitted');
        }

        const vectors = [];

        for (const doc of documents) {
            const terms = this.extractTerms(doc);
            const termFreq = new Map();

            // Conta frequência dos termos
            for (const term of terms) {
                termFreq.set(term, (termFreq.get(term) || 0) + 1);
            }

            // Constrói vetor TF-IDF
            const vector = new Array(Object.keys(this.vocabulary).length).fill(0);

            for (const [term, freq] of termFreq.entries()) {
                if (this.vocabulary.hasOwnProperty(term)) {
                    const index = this.vocabulary[term];
                    const tf = freq / terms.length;
                    const idf = this.idf[term] || 0;
                    vector[index] = tf * idf;
                }
            }

            vectors.push(vector);
        }

        return vectors;
    }

    extractTerms(document) {
        const words = document.toLowerCase().match(/\b\w+\b/g) || [];
        const terms = [];

        // N-gramas
        for (let n = this.nGramRange[0]; n <= this.nGramRange[1]; n++) {
            for (let i = 0; i <= words.length - n; i++) {
                const ngram = words.slice(i, i + n).join(' ');
                terms.push(ngram);
            }
        }

        return terms;
    }
}

/**
 * Label Encoder simplificado
 */
class LabelEncoder {
    constructor() {
        this.classes_ = [];
        this.classToIndex = {};
        this.isFitted = false;
    }

    async fitTransform(labels) {
        const uniqueLabels = [...new Set(labels)];
        this.classes_ = uniqueLabels;

        this.classToIndex = {};
        uniqueLabels.forEach((label, index) => {
            this.classToIndex[label] = index;
        });

        this.isFitted = true;

        return labels.map(label => this.classToIndex[label]);
    }

    async transform(labels) {
        if (!this.isFitted) {
            throw new Error('LabelEncoder not fitted');
        }

        return labels.map(label => {
            if (!this.classToIndex.hasOwnProperty(label)) {
                throw new Error(`Unknown label: ${label}`);
            }
            return this.classToIndex[label];
        });
    }
}

/**
 * Feature Selector simplificado
 */
class FeatureSelector {
    constructor(options = {}) {
        this.method = options.method || 'chi2';
        this.k = options.k || 1000;
        this.selectedFeatures = [];
        this.scores = [];
        this.isFitted = false;
    }

    async fitTransform(features, labels) {
        // Implementação simplificada de seleção de features
        console.log(`Selecting top ${this.k} features using ${this.method}...`);

        // Por simplicidade, seleciona features com maior variância
        const numFeatures = features[0].length;
        const featureScores = [];

        for (let i = 0; i < numFeatures; i++) {
            const values = features.map(sample => sample[i]);
            const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
            const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;

            featureScores.push({ index: i, score: variance });
        }

        // Seleciona top k features
        featureScores.sort((a, b) => b.score - a.score);
        this.selectedFeatures = featureScores.slice(0, this.k).map(f => f.index);
        this.scores = featureScores.map(f => f.score);

        this.isFitted = true;

        // Aplica seleção
        return features.map(sample =>
            this.selectedFeatures.map(index => sample[index])
        );
    }

    async transform(features) {
        if (!this.isFitted) {
            throw new Error('FeatureSelector not fitted');
        }

        return features.map(sample =>
            this.selectedFeatures.map(index => sample[index] || 0)
        );
    }
}

/**
 * Naive Bayes Multinomial simplificado
 */
class MultinomialNaiveBayes {
    constructor(options = {}) {
        this.alpha = options.alpha || 1.0;
        this.fitPrior = options.fitPrior !== false;

        this.classProb = new Map();
        this.featureProb = new Map();
        this.classes = [];
        this.isFitted = false;
    }

    async fit(features, labels) {
        console.log('Training Multinomial Naive Bayes...');

        this.classes = [...new Set(labels)];
        const numSamples = features.length;
        const numFeatures = features[0].length;

        // Calcula probabilidades das classes
        for (const cls of this.classes) {
            const classCount = labels.filter(label => label === cls).length;
            this.classProb.set(cls, classCount / numSamples);
        }

        // Calcula probabilidades das features
        for (const cls of this.classes) {
            const classIndices = labels
                .map((label, index) => label === cls ? index : -1)
                .filter(index => index !== -1);

            const classFeatures = classIndices.map(index => features[index]);

            // Soma features por classe
            const featureSums = new Array(numFeatures).fill(0);
            let totalSum = 0;

            for (const sample of classFeatures) {
                for (let i = 0; i < numFeatures; i++) {
                    featureSums[i] += sample[i];
                    totalSum += sample[i];
                }
            }

            // Calcula probabilidades com suavização Laplace
            const classFeatureProb = featureSums.map(sum =>
                (sum + this.alpha) / (totalSum + this.alpha * numFeatures)
            );

            this.featureProb.set(cls, classFeatureProb);
        }

        this.isFitted = true;
    }

    async predict(features) {
        if (!this.isFitted) {
            throw new Error('Model not fitted');
        }

        return features.map(sample => {
            let bestClass = null;
            let bestProb = -Infinity;

            for (const cls of this.classes) {
                let logProb = Math.log(this.classProb.get(cls));
                const featureProbs = this.featureProb.get(cls);

                for (let i = 0; i < sample.length; i++) {
                    if (sample[i] > 0) {
                        logProb += sample[i] * Math.log(featureProbs[i]);
                    }
                }

                if (logProb > bestProb) {
                    bestProb = logProb;
                    bestClass = cls;
                }
            }

            return bestClass;
        });
    }

    async predictProba(features) {
        if (!this.isFitted) {
            throw new Error('Model not fitted');
        }

        return features.map(sample => {
            const probabilities = [];

            for (const cls of this.classes) {
                let logProb = Math.log(this.classProb.get(cls));
                const featureProbs = this.featureProb.get(cls);

                for (let i = 0; i < sample.length; i++) {
                    if (sample[i] > 0) {
                        logProb += sample[i] * Math.log(featureProbs[i]);
                    }
                }

                probabilities.push(Math.exp(logProb));
            }

            // Normaliza probabilidades
            const sum = probabilities.reduce((s, p) => s + p, 0);
            return probabilities.map(p => p / sum);
        });
    }

    getParameters() {
        return {
            alpha: this.alpha,
            fitPrior: this.fitPrior
        };
    }

    setParameters(params) {
        this.alpha = params.alpha || this.alpha;
        this.fitPrior = params.fitPrior !== undefined ? params.fitPrior : this.fitPrior;
    }

    getState() {
        return {
            classProb: Object.fromEntries(this.classProb),
            featureProb: Object.fromEntries(this.featureProb),
            classes: this.classes
        };
    }

    setState(state) {
        this.classProb = new Map(Object.entries(state.classProb));
        this.featureProb = new Map(Object.entries(state.featureProb).map(([k, v]) => [k, Array.isArray(v) ? v : Object.values(v)]));
        this.classes = state.classes;
        this.isFitted = true;
    }
}

// Exportar classes auxiliares para uso em outros módulos se necessário
class SupportVectorMachine {
    constructor(options = {}) {
        this.kernel = options.kernel || 'linear';
        this.C = options.C || 1.0;
        this.probability = options.probability !== false;
        // Implementação simplificada - em produção usar biblioteca especializada
    }

    async fit(features, labels) {
        console.log('Training SVM (simplified implementation)...');
        // Implementação básica para demonstração
        this.isFitted = true;
    }

    async predict(features) {
        // Implementação básica
        return features.map(() => 0);
    }

    async predictProba(features) {
        // Implementação básica
        return features.map(() => [0.5, 0.5]);
    }
}

class RandomForestClassifier {
    constructor(options = {}) {
        this.nEstimators = options.nEstimators || 100;
        this.maxDepth = options.maxDepth || 20;
        // Implementação simplificada
    }

    async fit(features, labels) {
        console.log('Training Random Forest (simplified implementation)...');
        this.isFitted = true;
    }

    async predict(features) {
        return features.map(() => 0);
    }

    async predictProba(features) {
        return features.map(() => [0.5, 0.5]);
    }
}

class MLPClassifier {
    constructor(options = {}) {
        this.hiddenLayerSizes = options.hiddenLayerSizes || [100];
        this.maxIter = options.maxIter || 200;
        // Implementação simplificada
    }

    async fit(features, labels) {
        console.log('Training MLP Neural Network (simplified implementation)...');
        this.isFitted = true;
    }

    async predict(features) {
        return features.map(() => 0);
    }

    async predictProba(features) {
        return features.map(() => [0.5, 0.5]);
    }
}

module.exports = MLClassifier;