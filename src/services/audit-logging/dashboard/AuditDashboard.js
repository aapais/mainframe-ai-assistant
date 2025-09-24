/**
 * Dashboard de Auditoria em Tempo Real
 * Interface web para monitoramento de logs e compliance
 * Visualizações interativas e alertas em tempo real
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

class AuditDashboard {
    constructor(auditService, logAnalytics, complianceReporter, config = {}) {
        this.auditService = auditService;
        this.logAnalytics = logAnalytics;
        this.complianceReporter = complianceReporter;
        this.config = {
            port: process.env.AUDIT_DASHBOARD_PORT || 3001,
            host: process.env.AUDIT_DASHBOARD_HOST || 'localhost',
            refreshInterval: 5000, // 5 segundos
            maxDataPoints: 100,
            enableAuth: process.env.NODE_ENV === 'production',
            sessionSecret: process.env.DASHBOARD_SESSION_SECRET || 'audit-dashboard-secret',
            ...config
        };

        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });

        this.connectedClients = new Set();
        this.realtimeData = {
            metrics: {},
            alerts: [],
            incidents: [],
            compliance: {},
            performance: {}
        };

        this.setupExpress();
        this.setupSocketHandlers();
        this.setupDataStreaming();
    }

    /**
     * Configura Express.js
     */
    setupExpress() {
        // Middleware básico
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        this.app.use(express.static(path.join(__dirname, 'public')));

        // Configuração de sessão para autenticação
        if (this.config.enableAuth) {
            const session = require('express-session');
            this.app.use(session({
                secret: this.config.sessionSecret,
                resave: false,
                saveUninitialized: false,
                cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 horas
            }));
        }

        // Rotas da API
        this.setupAPIRoutes();

        // Rota principal do dashboard
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });
    }

    /**
     * Configura rotas da API
     */
    setupAPIRoutes() {
        // Métricas gerais
        this.app.get('/api/metrics', async (req, res) => {
            try {
                const metrics = this.auditService.getMetrics();
                const analytics = await this.logAnalytics.exportAnalyticsReport();

                res.json({
                    audit: metrics,
                    analytics: analytics.summary,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Dados de compliance
        this.app.get('/api/compliance', async (req, res) => {
            try {
                const report = this.complianceReporter.generateRetentionReport();
                res.json(report);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Logs recentes
        this.app.get('/api/logs/recent', async (req, res) => {
            try {
                const limit = parseInt(req.query.limit) || 50;
                const logs = this.auditService.logBuffer.slice(-limit);
                res.json(logs);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Busca de logs
        this.app.post('/api/logs/search', async (req, res) => {
            try {
                const criteria = req.body;
                const results = await this.auditService.searchLogs(criteria);
                res.json(results);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Alertas ativos
        this.app.get('/api/alerts', async (req, res) => {
            try {
                const alerts = this.logAnalytics.analytics.alerts;
                res.json(alerts);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Insights
        this.app.get('/api/insights', async (req, res) => {
            try {
                const insights = this.logAnalytics.generateInsights();
                res.json(insights);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Relatórios de compliance
        this.app.get('/api/reports/:regulation', async (req, res) => {
            try {
                const { regulation } = req.params;
                const period = {
                    start: req.query.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                    end: req.query.end || new Date().toISOString()
                };

                let report;
                switch (regulation.toUpperCase()) {
                    case 'SOX':
                        report = await this.complianceReporter.generateSOXReport(period);
                        break;
                    case 'BACEN':
                        report = await this.complianceReporter.generateBACENReport(period);
                        break;
                    case 'LGPD':
                        report = await this.complianceReporter.generateLGPDReport(period);
                        break;
                    default:
                        return res.status(400).json({ error: 'Invalid regulation' });
                }

                res.json(report);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Dashboard status
        this.app.get('/api/status', (req, res) => {
            res.json({
                status: 'operational',
                uptime: process.uptime(),
                connectedClients: this.connectedClients.size,
                lastUpdate: new Date().toISOString(),
                version: '1.0.0'
            });
        });
    }

    /**
     * Configura handlers do Socket.IO
     */
    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`Client connected: ${socket.id}`);
            this.connectedClients.add(socket.id);

            // Envia dados iniciais
            socket.emit('initialData', this.realtimeData);

            // Handler para solicitação de dados específicos
            socket.on('requestData', async (dataType) => {
                try {
                    let data;
                    switch (dataType) {
                        case 'metrics':
                            data = this.auditService.getMetrics();
                            break;
                        case 'analytics':
                            data = await this.logAnalytics.exportAnalyticsReport();
                            break;
                        case 'alerts':
                            data = this.logAnalytics.analytics.alerts;
                            break;
                        case 'compliance':
                            data = this.complianceReporter.generateRetentionReport();
                            break;
                        default:
                            data = this.realtimeData[dataType];
                    }
                    socket.emit('dataUpdate', { type: dataType, data });
                } catch (error) {
                    socket.emit('error', { message: error.message });
                }
            });

            // Handler para filtros de logs
            socket.on('applyLogFilter', async (filter) => {
                try {
                    const results = await this.auditService.searchLogs(filter);
                    socket.emit('filteredLogs', results);
                } catch (error) {
                    socket.emit('error', { message: error.message });
                }
            });

            // Handler para exportação de dados
            socket.on('exportData', async (exportConfig) => {
                try {
                    const data = await this.generateExportData(exportConfig);
                    socket.emit('exportReady', data);
                } catch (error) {
                    socket.emit('error', { message: error.message });
                }
            });

            // Cleanup na desconexão
            socket.on('disconnect', () => {
                console.log(`Client disconnected: ${socket.id}`);
                this.connectedClients.delete(socket.id);
            });
        });
    }

    /**
     * Configura streaming de dados em tempo real
     */
    setupDataStreaming() {
        // Escuta eventos do AuditService
        this.auditService.on('auditEntry', (entry) => {
            this.realtimeData.incidents.push(entry);
            if (this.realtimeData.incidents.length > this.config.maxDataPoints) {
                this.realtimeData.incidents.shift();
            }
            this.broadcastUpdate('newAuditEntry', entry);
        });

        // Escuta análises do LogAnalytics
        this.logAnalytics.on('analysisCompleted', (analysis) => {
            this.realtimeData.performance = analysis;
            this.broadcastUpdate('analysisUpdate', analysis);
        });

        this.logAnalytics.on('anomaliesDetected', (anomalies) => {
            this.realtimeData.alerts.push(...anomalies);
            this.broadcastUpdate('newAnomalies', anomalies);
        });

        this.logAnalytics.on('alertsGenerated', (alerts) => {
            this.realtimeData.alerts.push(...alerts);
            this.broadcastUpdate('newAlerts', alerts);
        });

        // Atualização periódica de métricas
        setInterval(async () => {
            try {
                await this.updateRealtimeMetrics();
                this.broadcastUpdate('metricsUpdate', this.realtimeData.metrics);
            } catch (error) {
                console.error('Failed to update realtime metrics:', error);
            }
        }, this.config.refreshInterval);
    }

    /**
     * Atualiza métricas em tempo real
     */
    async updateRealtimeMetrics() {
        const auditMetrics = this.auditService.getMetrics();
        const analyticsReport = await this.logAnalytics.exportAnalyticsReport();

        this.realtimeData.metrics = {
            audit: auditMetrics,
            analytics: analyticsReport.summary,
            compliance: await this.getComplianceMetrics(),
            system: {
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                connectedClients: this.connectedClients.size
            },
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Obtém métricas de compliance
     */
    async getComplianceMetrics() {
        try {
            const retentionReport = this.complianceReporter.generateRetentionReport();
            return {
                retentionCompliance: retentionReport.status,
                totalArchives: retentionReport.archives.totalFiles,
                compressionRatio: retentionReport.status.compressionRatio,
                recommendations: retentionReport.recommendations.length
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Transmite atualizações para todos os clientes conectados
     */
    broadcastUpdate(eventType, data) {
        this.io.emit(eventType, {
            type: eventType,
            data,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Gera dados para exportação
     */
    async generateExportData(config) {
        const { type, format, period } = config;

        let data;
        switch (type) {
            case 'audit_logs':
                data = await this.auditService.exportForCompliance(
                    new Date(period.start),
                    new Date(period.end),
                    format
                );
                break;
            case 'analytics_report':
                data = await this.logAnalytics.exportAnalyticsReport(format);
                break;
            case 'compliance_report':
                data = await this.complianceReporter.generateSOXReport(period);
                break;
            default:
                throw new Error(`Unknown export type: ${type}`);
        }

        return {
            exportId: require('crypto').randomUUID(),
            type,
            format,
            data,
            generatedAt: new Date().toISOString()
        };
    }

    /**
     * Inicia o servidor do dashboard
     */
    start() {
        return new Promise((resolve, reject) => {
            this.server.listen(this.config.port, this.config.host, (error) => {
                if (error) {
                    reject(error);
                } else {
                    console.log(`Audit Dashboard running on http://${this.config.host}:${this.config.port}`);
                    resolve();
                }
            });
        });
    }

    /**
     * Para o servidor do dashboard
     */
    stop() {
        return new Promise((resolve) => {
            this.server.close(() => {
                console.log('Audit Dashboard stopped');
                resolve();
            });
        });
    }

    /**
     * Obtém estatísticas do dashboard
     */
    getStats() {
        return {
            connectedClients: this.connectedClients.size,
            uptime: process.uptime(),
            dataPoints: {
                incidents: this.realtimeData.incidents.length,
                alerts: this.realtimeData.alerts.length
            },
            lastUpdate: this.realtimeData.metrics.timestamp,
            config: {
                port: this.config.port,
                host: this.config.host,
                refreshInterval: this.config.refreshInterval
            }
        };
    }
}

module.exports = AuditDashboard;