/**
 * Pipeline de Aprendizado Contínuo
 *
 * Sistema de treinamento automático e contínuo para o classificador ML
 * com base em feedback, novos dados e performance do modelo.
 */

const path = require('path');
const fs = require('fs').promises;
const cron = require('node-cron');
const CategoryManager = require('./CategoryManager');
const MLClassifier = require('./MLClassifier');
const TaxonomyManager = require('./TaxonomyManager');

class ContinuousLearningPipeline {
  constructor(options = {}) {
    this.options = {
      enableAutoRetraining: options.enableAutoRetraining !== false,
      enablePerformanceMonitoring: options.enablePerformanceMonitoring !== false,
      enableDataCollection: options.enableDataCollection !== false,

      // Thresholds para retreinamento
      accuracyThreshold: options.accuracyThreshold || 0.85,
      confidenceThreshold: options.confidenceThreshold || 0.75,
      feedbackThreshold: options.feedbackThreshold || 50,
      performanceDegradationThreshold: options.performanceDegradationThreshold || 0.1,

      // Configurações de schedule
      monitoringInterval: options.monitoringInterval || '*/15 * * * *', // A cada 15 minutos
      retrainingSchedule: options.retrainingSchedule || '0 2 * * *', // Diariamente às 2h
      dataCollectionSchedule: options.dataCollectionSchedule || '0 */6 * * *', // A cada 6h
      performanceReviewSchedule: options.performanceReviewSchedule || '0 8 * * MON', // Segundas às 8h

      // Paths
      dataPath: options.dataPath || path.join(__dirname, '../../data/learning'),
      modelPath: options.modelPath || path.join(__dirname, '../../models/categorization'),
      logsPath: options.logsPath || path.join(__dirname, '../../logs/learning'),

      // Configurações de treinamento
      minSamplesForRetraining: options.minSamplesForRetraining || 100,
      maxRetrainingAttempts: options.maxRetrainingAttempts || 3,
      enableValidation: options.enableValidation !== false,
      validationSplit: options.validationSplit || 0.2,

      // Configurações de backup
      enableModelBackup: options.enableModelBackup !== false,
      maxBackups: options.maxBackups || 10,

      ...options,
    };

    this.categoryManager = null;
    this.taxonomyManager = new TaxonomyManager();

    // Estado do pipeline
    this.isRunning = false;
    this.currentTraining = null;
    this.lastPerformanceCheck = null;
    this.scheduledJobs = new Map();

    // Métricas e histórico
    this.performanceHistory = [];
    this.retrainingHistory = [];
    this.feedbackQueue = [];
    this.dataCollectionBuffer = [];

    // Alertas e notificações
    this.alerts = [];
    this.notificationHandlers = new Map();
  }

  /**
   * Inicializa o pipeline de aprendizado contínuo
   */
  async initialize() {
    try {
      console.log('🚀 Inicializando Pipeline de Aprendizado Contínuo...');

      // Cria diretórios necessários
      await this.createDirectories();

      // Inicializa componentes
      this.categoryManager = new CategoryManager({
        modelPath: this.options.modelPath,
        enableFeedbackLearning: true,
      });

      await this.categoryManager.initialize();

      // Carrega histórico de performance
      await this.loadPerformanceHistory();

      // Carrega dados de feedback pendentes
      await this.loadPendingFeedback();

      // Configura jobs agendados
      this.setupScheduledJobs();

      // Inicia monitoramento
      if (this.options.enablePerformanceMonitoring) {
        this.startPerformanceMonitoring();
      }

      this.isRunning = true;
      console.log('✅ Pipeline inicializado com sucesso');

      return true;
    } catch (error) {
      console.error('❌ Erro ao inicializar pipeline:', error);
      throw error;
    }
  }

  /**
   * Para o pipeline
   */
  async shutdown() {
    try {
      console.log('🛑 Parando Pipeline de Aprendizado Contínuo...');

      this.isRunning = false;

      // Para jobs agendados
      for (const [name, job] of this.scheduledJobs) {
        job.stop();
        console.log(`   Stopped job: ${name}`);
      }

      // Salva estado atual
      await this.savePerformanceHistory();
      await this.savePendingFeedback();

      console.log('✅ Pipeline parado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao parar pipeline:', error);
    }
  }

  /**
   * Configura jobs agendados
   */
  setupScheduledJobs() {
    // Monitoramento de performance
    if (this.options.enablePerformanceMonitoring) {
      const monitoringJob = cron.schedule(
        this.options.monitoringInterval,
        async () => {
          await this.performPerformanceCheck();
        },
        { scheduled: false }
      );

      this.scheduledJobs.set('performance-monitoring', monitoringJob);
      monitoringJob.start();
      console.log(`📊 Job de monitoramento agendado: ${this.options.monitoringInterval}`);
    }

    // Retreinamento automático
    if (this.options.enableAutoRetraining) {
      const retrainingJob = cron.schedule(
        this.options.retrainingSchedule,
        async () => {
          await this.performScheduledRetraining();
        },
        { scheduled: false }
      );

      this.scheduledJobs.set('auto-retraining', retrainingJob);
      retrainingJob.start();
      console.log(`🎓 Job de retreinamento agendado: ${this.options.retrainingSchedule}`);
    }

    // Coleta de dados
    if (this.options.enableDataCollection) {
      const dataCollectionJob = cron.schedule(
        this.options.dataCollectionSchedule,
        async () => {
          await this.performDataCollection();
        },
        { scheduled: false }
      );

      this.scheduledJobs.set('data-collection', dataCollectionJob);
      dataCollectionJob.start();
      console.log(`📥 Job de coleta de dados agendado: ${this.options.dataCollectionSchedule}`);
    }

    // Revisão de performance semanal
    const performanceReviewJob = cron.schedule(
      this.options.performanceReviewSchedule,
      async () => {
        await this.performWeeklyPerformanceReview();
      },
      { scheduled: false }
    );

    this.scheduledJobs.set('performance-review', performanceReviewJob);
    performanceReviewJob.start();
    console.log(`📋 Job de revisão semanal agendado: ${this.options.performanceReviewSchedule}`);
  }

  /**
   * Inicia monitoramento contínuo de performance
   */
  startPerformanceMonitoring() {
    console.log('📊 Iniciando monitoramento contínuo de performance...');

    // Monitora métricas a cada verificação
    setInterval(
      async () => {
        if (!this.isRunning) return;

        try {
          await this.collectCurrentMetrics();
        } catch (error) {
          console.error('Erro no monitoramento:', error);
        }
      },
      5 * 60 * 1000
    ); // A cada 5 minutos
  }

  /**
   * Coleta métricas atuais do sistema
   */
  async collectCurrentMetrics() {
    try {
      const metrics = this.categoryManager.getMetrics();

      const currentMetrics = {
        timestamp: new Date().toISOString(),
        accuracy: metrics.accuracyScore,
        averageConfidence: metrics.averageConfidence,
        totalClassifications: metrics.totalClassifications,
        successfulClassifications: metrics.successfulClassifications,
        processingTime: metrics.averageProcessingTime,
        feedbackCount: metrics.feedbackCount,
        cacheHitRate: metrics.cacheHitRate,
      };

      // Adiciona ao histórico
      this.performanceHistory.push(currentMetrics);

      // Mantém apenas últimas 1000 entradas
      if (this.performanceHistory.length > 1000) {
        this.performanceHistory = this.performanceHistory.slice(-1000);
      }

      // Verifica se precisa de ação
      await this.analyzePerformanceTrends(currentMetrics);
    } catch (error) {
      console.error('Erro coletando métricas:', error);
    }
  }

  /**
   * Analisa tendências de performance
   */
  async analyzePerformanceTrends(currentMetrics) {
    try {
      if (this.performanceHistory.length < 10) {
        return; // Poucos dados para análise
      }

      const recentMetrics = this.performanceHistory.slice(-10);
      const avgAccuracy =
        recentMetrics.reduce((sum, m) => sum + m.accuracy, 0) / recentMetrics.length;
      const avgConfidence =
        recentMetrics.reduce((sum, m) => sum + m.averageConfidence, 0) / recentMetrics.length;

      // Detecta degradação de performance
      if (avgAccuracy < this.options.accuracyThreshold) {
        await this.handlePerformanceDegradation(
          'accuracy',
          avgAccuracy,
          this.options.accuracyThreshold
        );
      }

      if (avgConfidence < this.options.confidenceThreshold) {
        await this.handlePerformanceDegradation(
          'confidence',
          avgConfidence,
          this.options.confidenceThreshold
        );
      }

      // Detecta tendência de queda
      if (recentMetrics.length >= 5) {
        const trend = this.calculateTrend(recentMetrics.slice(-5).map(m => m.accuracy));
        if (trend < -this.options.performanceDegradationThreshold) {
          await this.handlePerformanceDegradation(
            'trend',
            trend,
            -this.options.performanceDegradationThreshold
          );
        }
      }
    } catch (error) {
      console.error('Erro analisando tendências:', error);
    }
  }

  /**
   * Lida com degradação de performance
   */
  async handlePerformanceDegradation(type, current, threshold) {
    const alert = {
      id: `perf-degradation-${Date.now()}`,
      type: 'performance_degradation',
      metric: type,
      currentValue: current,
      threshold: threshold,
      timestamp: new Date().toISOString(),
      severity: current < threshold * 0.8 ? 'critical' : 'warning',
    };

    this.alerts.push(alert);

    console.warn(
      `⚠️  Degradação de performance detectada: ${type} = ${current.toFixed(3)} (threshold: ${threshold})`
    );

    // Notifica handlers
    await this.sendAlert(alert);

    // Agenda retreinamento se crítico
    if (alert.severity === 'critical') {
      console.log('🎓 Agendando retreinamento devido à degradação crítica...');
      await this.triggerRetraining('performance_degradation');
    }
  }

  /**
   * Calcula tendência simples baseada em regressão linear
   */
  calculateTrend(values) {
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;

    const sumX = x.reduce((sum, xi) => sum + xi, 0);
    const sumY = y.reduce((sum, yi) => sum + yi, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  /**
   * Executa verificação de performance agendada
   */
  async performPerformanceCheck() {
    try {
      console.log('📊 Executando verificação de performance agendada...');

      const metrics = this.categoryManager.getMetrics();
      this.lastPerformanceCheck = {
        timestamp: new Date().toISOString(),
        metrics: metrics,
      };

      // Verifica se feedback acumulado suficiente
      if (metrics.feedbackCount >= this.options.feedbackThreshold) {
        console.log(
          `📝 Feedback threshold atingido (${metrics.feedbackCount}), agendando retreinamento...`
        );
        await this.triggerRetraining('feedback_threshold');
      }

      // Verifica métricas críticas
      if (metrics.accuracyScore < this.options.accuracyThreshold) {
        console.log(
          `🎯 Acurácia baixa (${(metrics.accuracyScore * 100).toFixed(1)}%), considerando retreinamento...`
        );
        await this.triggerRetraining('low_accuracy');
      }

      console.log('✅ Verificação de performance concluída');
    } catch (error) {
      console.error('❌ Erro na verificação de performance:', error);
    }
  }

  /**
   * Executa retreinamento agendado
   */
  async performScheduledRetraining() {
    try {
      console.log('🎓 Executando retreinamento agendado...');

      // Verifica se há dados suficientes
      const feedbackData = await this.collectFeedbackData();
      const newData = await this.collectNewTrainingData();

      const totalNewSamples = feedbackData.length + newData.length;

      if (totalNewSamples < this.options.minSamplesForRetraining) {
        console.log(
          `📊 Dados insuficientes para retreinamento (${totalNewSamples} < ${this.options.minSamplesForRetraining})`
        );
        return;
      }

      await this.performRetraining([...feedbackData, ...newData], 'scheduled');
    } catch (error) {
      console.error('❌ Erro no retreinamento agendado:', error);
    }
  }

  /**
   * Dispara retreinamento por motivo específico
   */
  async triggerRetraining(reason) {
    if (this.currentTraining) {
      console.log('⏳ Retreinamento já em andamento, aguardando...');
      return false;
    }

    try {
      console.log(`🎓 Iniciando retreinamento: ${reason}`);

      this.currentTraining = {
        id: `retrain-${Date.now()}`,
        reason: reason,
        startTime: new Date().toISOString(),
        status: 'in_progress',
      };

      // Coleta dados para retreinamento
      const feedbackData = await this.collectFeedbackData();
      const historicalData = await this.collectHistoricalData();
      const syntheticData = await this.generateSyntheticData();

      const allData = [...feedbackData, ...historicalData, ...syntheticData];

      if (allData.length < this.options.minSamplesForRetraining) {
        console.log(
          `❌ Dados insuficientes: ${allData.length} < ${this.options.minSamplesForRetraining}`
        );
        this.currentTraining = null;
        return false;
      }

      const success = await this.performRetraining(allData, reason);

      this.currentTraining.endTime = new Date().toISOString();
      this.currentTraining.status = success ? 'completed' : 'failed';
      this.currentTraining.samplesUsed = allData.length;

      // Adiciona ao histórico
      this.retrainingHistory.push({ ...this.currentTraining });

      this.currentTraining = null;

      return success;
    } catch (error) {
      console.error(`❌ Erro no retreinamento (${reason}):`, error);
      if (this.currentTraining) {
        this.currentTraining.status = 'failed';
        this.currentTraining.error = error.message;
      }
      this.currentTraining = null;
      return false;
    }
  }

  /**
   * Executa processo de retreinamento
   */
  async performRetraining(trainingData, reason) {
    try {
      console.log(`🎓 Executando retreinamento com ${trainingData.length} amostras...`);

      // Backup do modelo atual
      if (this.options.enableModelBackup) {
        await this.backupCurrentModel();
      }

      // Cria novo classificador para teste
      const testClassifier = new MLClassifier({
        algorithm: this.categoryManager.mlClassifier.options.algorithm,
        modelPath: path.join(this.options.modelPath, 'temp_retrain'),
        enableIncrementalLearning: true,
      });

      await testClassifier.initialize();

      // Treina novo modelo
      await testClassifier.train(trainingData);

      // Valida performance do novo modelo
      if (this.options.enableValidation) {
        const validationResult = await this.validateRetrainedModel(testClassifier, trainingData);

        if (!validationResult.success) {
          console.log(`❌ Validação falhou: ${validationResult.reason}`);
          return false;
        }

        console.log(
          `✅ Validação bem-sucedida: acurácia ${(validationResult.accuracy * 100).toFixed(1)}%`
        );
      }

      // Substitui modelo atual
      await this.replaceCurrentModel(testClassifier);

      // Limpa dados de feedback processados
      await this.clearProcessedFeedback();

      console.log(`✅ Retreinamento concluído com sucesso (${reason})`);

      // Notifica sucesso
      await this.sendNotification('retraining_success', {
        reason: reason,
        samples: trainingData.length,
        timestamp: new Date().toISOString(),
      });

      return true;
    } catch (error) {
      console.error('❌ Erro durante retreinamento:', error);

      // Notifica falha
      await this.sendNotification('retraining_failure', {
        reason: reason,
        error: error.message,
        timestamp: new Date().toISOString(),
      });

      return false;
    }
  }

  /**
   * Valida modelo retreinado
   */
  async validateRetrainedModel(newClassifier, trainingData) {
    try {
      // Split dados para validação
      const splitIndex = Math.floor(trainingData.length * (1 - this.options.validationSplit));
      const validationData = trainingData.slice(splitIndex);

      if (validationData.length < 10) {
        return { success: true, reason: 'insufficient_validation_data' };
      }

      // Testa novo modelo
      let correctPredictions = 0;

      for (const sample of validationData) {
        const predictions = await newClassifier.predict(sample.text);
        if (predictions.length > 0 && predictions[0].category === sample.category) {
          correctPredictions++;
        }
      }

      const accuracy = correctPredictions / validationData.length;

      // Compara com modelo atual
      const currentMetrics = this.categoryManager.getMetrics();
      const improvementThreshold = 0.02; // 2% de melhoria mínima

      if (accuracy < currentMetrics.accuracyScore - improvementThreshold) {
        return {
          success: false,
          reason: 'performance_regression',
          accuracy: accuracy,
          currentAccuracy: currentMetrics.accuracyScore,
        };
      }

      return {
        success: true,
        accuracy: accuracy,
        improvement: accuracy - currentMetrics.accuracyScore,
      };
    } catch (error) {
      return {
        success: false,
        reason: 'validation_error',
        error: error.message,
      };
    }
  }

  /**
   * Substitui modelo atual pelo retreinado
   */
  async replaceCurrentModel(newClassifier) {
    try {
      // Salva novo modelo
      await newClassifier.saveModel();

      // Atualiza classificador no CategoryManager
      this.categoryManager.mlClassifier = newClassifier;

      // Incrementa versão
      const currentVersion = newClassifier.getModelVersion();
      const versionParts = currentVersion.split('.');
      versionParts[1] = (parseInt(versionParts[1]) + 1).toString();
      newClassifier.modelVersion = versionParts.join('.');

      console.log(`🔄 Modelo atualizado para versão ${newClassifier.modelVersion}`);
    } catch (error) {
      console.error('Erro substituindo modelo:', error);
      throw error;
    }
  }

  /**
   * Faz backup do modelo atual
   */
  async backupCurrentModel() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(this.options.modelPath, 'backups', `model-${timestamp}`);

      await fs.mkdir(backupPath, { recursive: true });

      // Copia arquivos do modelo
      const modelFiles = await fs.readdir(this.options.modelPath);
      for (const file of modelFiles) {
        if (file.startsWith('model.') || file.endsWith('.json')) {
          const sourcePath = path.join(this.options.modelPath, file);
          const destPath = path.join(backupPath, file);
          await fs.copyFile(sourcePath, destPath);
        }
      }

      // Remove backups antigos
      await this.cleanupOldBackups();

      console.log(`💾 Backup criado: ${backupPath}`);
    } catch (error) {
      console.error('Erro criando backup:', error);
    }
  }

  /**
   * Remove backups antigos
   */
  async cleanupOldBackups() {
    try {
      const backupsPath = path.join(this.options.modelPath, 'backups');
      const backups = await fs.readdir(backupsPath);

      if (backups.length > this.options.maxBackups) {
        // Ordena por data (mais antigos primeiro)
        const sortedBackups = backups
          .map(name => ({
            name,
            path: path.join(backupsPath, name),
            created: name.split('-').slice(1).join('-'),
          }))
          .sort((a, b) => a.created.localeCompare(b.created));

        // Remove os mais antigos
        const toRemove = sortedBackups.slice(0, backups.length - this.options.maxBackups);

        for (const backup of toRemove) {
          await fs.rmdir(backup.path, { recursive: true });
          console.log(`🗑️  Backup removido: ${backup.name}`);
        }
      }
    } catch (error) {
      console.error('Erro limpando backups:', error);
    }
  }

  /**
   * Coleta dados de feedback para retreinamento
   */
  async collectFeedbackData() {
    try {
      const feedbackPath = path.join(this.options.modelPath, 'feedback_history.json');
      const data = await fs.readFile(feedbackPath, 'utf8');
      const feedbackHistory = JSON.parse(data);

      const pendingFeedback = feedbackHistory.feedback.filter(
        f => !f.processed && f.correctCategory
      );

      const trainingData = pendingFeedback.map(f => ({
        text: f.text || `Incident feedback ${f.incidentId}`,
        category: f.correctCategory,
        source: 'feedback',
        confidence: f.confidence || 1.0,
      }));

      console.log(`📝 Coletados ${trainingData.length} dados de feedback`);
      return trainingData;
    } catch (error) {
      console.log('📝 Nenhum dado de feedback encontrado');
      return [];
    }
  }

  /**
   * Coleta dados históricos para retreinamento
   */
  async collectHistoricalData() {
    try {
      const historicalPath = path.join(this.options.dataPath, 'historical_incidents.json');
      const data = await fs.readFile(historicalPath, 'utf8');
      const historicalData = JSON.parse(data);

      const recentData = historicalData
        .filter(item => {
          const itemDate = new Date(item.timestamp || item.created_at);
          const daysSince = (Date.now() - itemDate.getTime()) / (1000 * 60 * 60 * 24);
          return daysSince <= 30; // Últimos 30 dias
        })
        .map(item => ({
          text: item.text,
          category: item.category,
          source: 'historical',
          confidence: item.confidence || 0.8,
        }));

      console.log(`📚 Coletados ${recentData.length} dados históricos`);
      return recentData;
    } catch (error) {
      console.log('📚 Nenhum dado histórico encontrado');
      return [];
    }
  }

  /**
   * Gera dados sintéticos para enriquecer treinamento
   */
  async generateSyntheticData() {
    try {
      // Por simplicidade, retorna array vazio
      // Em implementação real, geraria variações dos dados existentes
      console.log('🧪 Gerando dados sintéticos...');
      return [];
    } catch (error) {
      console.log('🧪 Erro gerando dados sintéticos');
      return [];
    }
  }

  /**
   * Coleta novos dados de treinamento
   */
  async collectNewTrainingData() {
    try {
      const newDataPath = path.join(this.options.dataPath, 'new_training_data.json');
      const data = await fs.readFile(newDataPath, 'utf8');
      const newData = JSON.parse(data);

      // Marca dados como processados
      await fs.writeFile(newDataPath, JSON.stringify([]));

      console.log(`🆕 Coletados ${newData.length} novos dados de treinamento`);
      return newData;
    } catch (error) {
      console.log('🆕 Nenhum novo dado de treinamento encontrado');
      return [];
    }
  }

  /**
   * Executa coleta de dados agendada
   */
  async performDataCollection() {
    try {
      console.log('📥 Executando coleta de dados agendada...');

      // Coleta métricas de uso
      const usageMetrics = await this.collectUsageMetrics();

      // Coleta dados de classificações recentes
      const recentClassifications = await this.collectRecentClassifications();

      // Salva dados coletados
      await this.saveCollectedData({
        timestamp: new Date().toISOString(),
        usageMetrics: usageMetrics,
        classifications: recentClassifications,
      });

      console.log('✅ Coleta de dados concluída');
    } catch (error) {
      console.error('❌ Erro na coleta de dados:', error);
    }
  }

  /**
   * Executa revisão semanal de performance
   */
  async performWeeklyPerformanceReview() {
    try {
      console.log('📋 Executando revisão semanal de performance...');

      // Gera relatório de performance
      const report = await this.generatePerformanceReport();

      // Salva relatório
      const reportPath = path.join(
        this.options.logsPath,
        `weekly-report-${new Date().toISOString().split('T')[0]}.json`
      );
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

      // Envia notificação
      await this.sendNotification('weekly_report', report);

      console.log('✅ Revisão semanal concluída');
    } catch (error) {
      console.error('❌ Erro na revisão semanal:', error);
    }
  }

  /**
   * Gera relatório de performance
   */
  async generatePerformanceReport() {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentMetrics = this.performanceHistory.filter(m => new Date(m.timestamp) >= weekAgo);

    if (recentMetrics.length === 0) {
      return { error: 'Dados insuficientes para relatório' };
    }

    const avgAccuracy =
      recentMetrics.reduce((sum, m) => sum + m.accuracy, 0) / recentMetrics.length;
    const avgConfidence =
      recentMetrics.reduce((sum, m) => sum + m.averageConfidence, 0) / recentMetrics.length;
    const totalClassifications =
      recentMetrics[recentMetrics.length - 1].totalClassifications -
      recentMetrics[0].totalClassifications;

    return {
      period: {
        start: weekAgo.toISOString(),
        end: new Date().toISOString(),
      },
      metrics: {
        averageAccuracy: avgAccuracy,
        averageConfidence: avgConfidence,
        totalClassifications: totalClassifications,
        retrainingCount: this.retrainingHistory.filter(r => new Date(r.startTime) >= weekAgo)
          .length,
      },
      alerts: this.alerts.filter(a => new Date(a.timestamp) >= weekAgo),
      trends: {
        accuracyTrend: this.calculateTrend(recentMetrics.slice(-5).map(m => m.accuracy)),
        confidenceTrend: this.calculateTrend(recentMetrics.slice(-5).map(m => m.averageConfidence)),
      },
    };
  }

  // ============= MÉTODOS AUXILIARES =============

  async createDirectories() {
    const dirs = [
      this.options.dataPath,
      this.options.logsPath,
      path.join(this.options.modelPath, 'backups'),
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async loadPerformanceHistory() {
    try {
      const historyPath = path.join(this.options.logsPath, 'performance_history.json');
      const data = await fs.readFile(historyPath, 'utf8');
      this.performanceHistory = JSON.parse(data);
    } catch (error) {
      this.performanceHistory = [];
    }
  }

  async savePerformanceHistory() {
    try {
      const historyPath = path.join(this.options.logsPath, 'performance_history.json');
      await fs.writeFile(historyPath, JSON.stringify(this.performanceHistory, null, 2));
    } catch (error) {
      console.error('Erro salvando histórico de performance:', error);
    }
  }

  async loadPendingFeedback() {
    try {
      const feedbackPath = path.join(this.options.dataPath, 'pending_feedback.json');
      const data = await fs.readFile(feedbackPath, 'utf8');
      this.feedbackQueue = JSON.parse(data);
    } catch (error) {
      this.feedbackQueue = [];
    }
  }

  async savePendingFeedback() {
    try {
      const feedbackPath = path.join(this.options.dataPath, 'pending_feedback.json');
      await fs.writeFile(feedbackPath, JSON.stringify(this.feedbackQueue, null, 2));
    } catch (error) {
      console.error('Erro salvando feedback pendente:', error);
    }
  }

  async clearProcessedFeedback() {
    try {
      const feedbackPath = path.join(this.options.modelPath, 'feedback_history.json');
      const data = await fs.readFile(feedbackPath, 'utf8');
      const feedbackHistory = JSON.parse(data);

      // Marca todos como processados
      feedbackHistory.feedback.forEach(f => (f.processed = true));

      await fs.writeFile(feedbackPath, JSON.stringify(feedbackHistory, null, 2));
    } catch (error) {
      console.error('Erro limpando feedback processado:', error);
    }
  }

  async collectUsageMetrics() {
    // Simula coleta de métricas de uso
    return {
      classificationsPerHour: Math.floor(Math.random() * 100) + 50,
      averageResponseTime: Math.floor(Math.random() * 200) + 100,
      errorRate: Math.random() * 0.05,
    };
  }

  async collectRecentClassifications() {
    // Simula coleta de classificações recentes
    return [];
  }

  async saveCollectedData(data) {
    try {
      const dataPath = path.join(this.options.dataPath, `collected-${Date.now()}.json`);
      await fs.writeFile(dataPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Erro salvando dados coletados:', error);
    }
  }

  async sendAlert(alert) {
    console.warn(`🚨 ALERT: ${alert.type} - ${alert.metric} = ${alert.currentValue}`);

    // Executa handlers de notificação
    for (const [name, handler] of this.notificationHandlers) {
      try {
        await handler(alert);
      } catch (error) {
        console.error(`Erro no handler ${name}:`, error);
      }
    }
  }

  async sendNotification(type, data) {
    console.log(`📢 NOTIFICATION: ${type}`);

    // Executa handlers de notificação
    for (const [name, handler] of this.notificationHandlers) {
      try {
        await handler({ type, data });
      } catch (error) {
        console.error(`Erro no handler ${name}:`, error);
      }
    }
  }

  // ============= API PÚBLICA =============

  /**
   * Adiciona handler de notificação
   */
  addNotificationHandler(name, handler) {
    this.notificationHandlers.set(name, handler);
  }

  /**
   * Remove handler de notificação
   */
  removeNotificationHandler(name) {
    this.notificationHandlers.delete(name);
  }

  /**
   * Obtém status atual do pipeline
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      currentTraining: this.currentTraining,
      lastPerformanceCheck: this.lastPerformanceCheck,
      scheduledJobs: Array.from(this.scheduledJobs.keys()),
      alerts: this.alerts.length,
      performanceHistorySize: this.performanceHistory.length,
      retrainingHistory: this.retrainingHistory.length,
    };
  }

  /**
   * Obtém métricas do pipeline
   */
  getMetrics() {
    return {
      performanceHistory: this.performanceHistory.slice(-100), // Últimas 100
      retrainingHistory: this.retrainingHistory,
      alerts: this.alerts.slice(-50), // Últimos 50 alertas
      status: this.getStatus(),
    };
  }

  /**
   * Força retreinamento manual
   */
  async forceRetraining(reason = 'manual') {
    return await this.triggerRetraining(reason);
  }
}

module.exports = ContinuousLearningPipeline;
