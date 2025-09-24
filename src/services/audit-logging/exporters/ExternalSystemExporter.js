/**
 * Exportador para Sistemas Externos
 * Automatiza envio de dados de auditoria para sistemas regulatórios e de compliance
 * Integração com SISBACEN, ANPD, SIEM e sistemas GRC
 */

const crypto = require('crypto');
const https = require('https');
const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');

class ExternalSystemExporter extends EventEmitter {
    constructor(auditService, config = {}) {
        super();
        this.auditService = auditService;
        this.config = {
            enabledSystems: {
                sisbacen: process.env.SISBACEN_ENABLED === 'true',
                anpd: process.env.ANPD_ENABLED === 'true',
                siem: process.env.SIEM_INTEGRATION === 'true',
                grc: process.env.GRC_INTEGRATION === 'true',
                erp: process.env.ERP_INTEGRATION === 'true'
            },
            endpoints: {
                sisbacen: {
                    url: process.env.SISBACEN_ENDPOINT,
                    cert: process.env.SISBACEN_CERT_PATH,
                    key: process.env.SISBACEN_KEY_PATH,
                    format: 'XML',
                    timeout: 30000
                },
                anpd: {
                    url: process.env.ANPD_ENDPOINT,
                    apiKey: process.env.ANPD_API_KEY,
                    format: 'JSON',
                    timeout: 15000
                },
                siem: {
                    url: process.env.SIEM_ENDPOINT,
                    port: process.env.SIEM_PORT || 514,
                    format: 'CEF',
                    protocol: 'TCP',
                    timeout: 10000
                },
                grc: {
                    url: process.env.GRC_ENDPOINT,
                    apiKey: process.env.GRC_API_KEY,
                    format: 'JSON',
                    timeout: 20000
                },
                erp: {
                    url: process.env.ERP_ENDPOINT,
                    apiKey: process.env.ERP_API_KEY,
                    format: 'JSON',
                    timeout: 25000
                }
            },
            schedules: {
                sisbacen: 'monthly', // Relatórios mensais BACEN
                anpd: 'on-breach', // Notificação de vazamentos
                siem: 'real-time', // Logs em tempo real
                grc: 'weekly', // Relatórios semanais
                erp: 'daily' // Sincronização diária
            },
            retryPolicy: {
                maxRetries: 3,
                backoffMultiplier: 2,
                initialDelay: 1000
            },
            batchSize: 1000,
            enableCompression: true,
            enableEncryption: true,
            ...config
        };

        this.exportQueue = new Map();
        this.activeExports = new Set();
        this.exportHistory = [];
        this.scheduledExports = new Map();

        this.initializeSchedules();
    }

    /**
     * Inicializa agendamentos automáticos
     */
    initializeSchedules() {
        Object.entries(this.config.schedules).forEach(([system, schedule]) => {
            if (!this.config.enabledSystems[system]) return;

            switch (schedule) {
                case 'real-time':
                    this.setupRealTimeExport(system);
                    break;
                case 'daily':
                    this.setupPeriodicExport(system, 24 * 60 * 60 * 1000);
                    break;
                case 'weekly':
                    this.setupPeriodicExport(system, 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'monthly':
                    this.setupMonthlyExport(system);
                    break;
                case 'on-breach':
                    this.setupBreachNotification(system);
                    break;
            }
        });
    }

    /**
     * Exporta dados para SISBACEN (Banco Central)
     */
    async exportToSISBACEN(period, reportType = 'operational_risk') {
        const exportId = crypto.randomUUID();
        const startTime = Date.now();

        try {
            console.log(`Starting SISBACEN export ${exportId} for ${reportType}`);

            // Coleta dados do período
            const auditData = await this.auditService.exportForCompliance(
                new Date(period.start),
                new Date(period.end),
                'json'
            );

            // Converte para formato XML SISBACEN
            const xmlData = await this.convertToSISBACENFormat(auditData, reportType);

            // Valida estrutura XML
            await this.validateSISBACENXML(xmlData);

            // Assina digitalmente
            const signedData = await this.signSISBACENDocument(xmlData);

            // Envia para SISBACEN
            const response = await this.sendToSISBACEN(signedData, reportType);

            const result = {
                exportId,
                system: 'SISBACEN',
                reportType,
                period,
                status: 'SUCCESS',
                records: auditData.totalRecords,
                protocolNumber: response.protocolNumber,
                timestamp: new Date().toISOString(),
                executionTime: Date.now() - startTime
            };

            this.exportHistory.push(result);
            this.emit('exportCompleted', result);

            await this.auditService.logSystemDecision({
                incidentId: 'EXPORT_SISBACEN',
                engine: 'ExternalSystemExporter',
                algorithm: 'SISBACEN_Export',
                version: '1.0.0',
                inputs: { period, reportType, records: auditData.totalRecords },
                decision: 'EXPORT_SUCCESS',
                confidence: 1.0,
                reasoning: `SISBACEN export completed successfully with protocol ${response.protocolNumber}`,
                executionTime: Date.now() - startTime
            });

            return result;

        } catch (error) {
            const result = {
                exportId,
                system: 'SISBACEN',
                reportType,
                period,
                status: 'ERROR',
                error: error.message,
                timestamp: new Date().toISOString(),
                executionTime: Date.now() - startTime
            };

            this.exportHistory.push(result);
            this.emit('exportFailed', result);

            await this.auditService.logSystemDecision({
                incidentId: 'EXPORT_ERROR',
                engine: 'ExternalSystemExporter',
                algorithm: 'SISBACEN_Export',
                version: '1.0.0',
                inputs: { period, reportType, error: error.message },
                decision: 'EXPORT_FAILED',
                confidence: 0.0,
                reasoning: `SISBACEN export failed: ${error.message}`,
                executionTime: Date.now() - startTime
            });

            throw error;
        }
    }

    /**
     * Exporta notificação de vazamento para ANPD
     */
    async notifyANPDDataBreach(breachData) {
        const exportId = crypto.randomUUID();
        const startTime = Date.now();

        try {
            console.log(`Starting ANPD breach notification ${exportId}`);

            // Valida dados obrigatórios LGPD
            this.validateBreachData(breachData);

            // Formata notificação conforme ANPD
            const notification = await this.formatANPDNotification(breachData);

            // Envia para ANPD
            const response = await this.sendToANPD(notification);

            const result = {
                exportId,
                system: 'ANPD',
                type: 'DATA_BREACH_NOTIFICATION',
                breachId: breachData.breachId,
                status: 'SUCCESS',
                protocolNumber: response.protocolNumber,
                timestamp: new Date().toISOString(),
                executionTime: Date.now() - startTime
            };

            this.exportHistory.push(result);
            this.emit('exportCompleted', result);

            await this.auditService.logSystemDecision({
                incidentId: 'ANPD_NOTIFICATION',
                engine: 'ExternalSystemExporter',
                algorithm: 'ANPD_BreachNotification',
                version: '1.0.0',
                inputs: { breachId: breachData.breachId, affectedSubjects: breachData.affectedSubjects },
                decision: 'NOTIFICATION_SUCCESS',
                confidence: 1.0,
                reasoning: `ANPD breach notification sent successfully with protocol ${response.protocolNumber}`,
                executionTime: Date.now() - startTime
            });

            return result;

        } catch (error) {
            const result = {
                exportId,
                system: 'ANPD',
                type: 'DATA_BREACH_NOTIFICATION',
                breachId: breachData.breachId,
                status: 'ERROR',
                error: error.message,
                timestamp: new Date().toISOString(),
                executionTime: Date.now() - startTime
            };

            this.exportHistory.push(result);
            this.emit('exportFailed', result);

            await this.auditService.logSystemDecision({
                incidentId: 'ANPD_ERROR',
                engine: 'ExternalSystemExporter',
                algorithm: 'ANPD_BreachNotification',
                version: '1.0.0',
                inputs: { breachId: breachData.breachId, error: error.message },
                decision: 'NOTIFICATION_FAILED',
                confidence: 0.0,
                reasoning: `ANPD notification failed: ${error.message}`,
                executionTime: Date.now() - startTime
            });

            throw error;
        }
    }

    /**
     * Exporta logs para SIEM em tempo real
     */
    async exportToSIEM(auditEntries) {
        const exportId = crypto.randomUUID();
        const startTime = Date.now();

        try {
            // Converte para formato CEF
            const cefLogs = auditEntries.map(entry => this.convertToCEF(entry));

            // Envia via TCP
            await this.sendToSIEM(cefLogs);

            const result = {
                exportId,
                system: 'SIEM',
                type: 'REAL_TIME_LOGS',
                records: auditEntries.length,
                status: 'SUCCESS',
                timestamp: new Date().toISOString(),
                executionTime: Date.now() - startTime
            };

            this.emit('exportCompleted', result);
            return result;

        } catch (error) {
            const result = {
                exportId,
                system: 'SIEM',
                type: 'REAL_TIME_LOGS',
                records: auditEntries.length,
                status: 'ERROR',
                error: error.message,
                timestamp: new Date().toISOString(),
                executionTime: Date.now() - startTime
            };

            this.emit('exportFailed', result);
            throw error;
        }
    }

    /**
     * Exporta relatórios para sistema GRC
     */
    async exportToGRC(reportData, reportType) {
        const exportId = crypto.randomUUID();
        const startTime = Date.now();

        try {
            console.log(`Starting GRC export ${exportId} for ${reportType}`);

            // Formata para GRC
            const grcData = await this.formatForGRC(reportData, reportType);

            // Envia para GRC
            const response = await this.sendToGRC(grcData, reportType);

            const result = {
                exportId,
                system: 'GRC',
                reportType,
                status: 'SUCCESS',
                records: grcData.totalRecords,
                grcId: response.reportId,
                timestamp: new Date().toISOString(),
                executionTime: Date.now() - startTime
            };

            this.exportHistory.push(result);
            this.emit('exportCompleted', result);

            return result;

        } catch (error) {
            const result = {
                exportId,
                system: 'GRC',
                reportType,
                status: 'ERROR',
                error: error.message,
                timestamp: new Date().toISOString(),
                executionTime: Date.now() - startTime
            };

            this.exportHistory.push(result);
            this.emit('exportFailed', result);
            throw error;
        }
    }

    /**
     * Converte dados para formato XML SISBACEN
     */
    async convertToSISBACENFormat(auditData, reportType) {
        const template = await this.loadSISBACENTemplate(reportType);

        const xmlData = {
            header: {
                reportType,
                institution: process.env.INSTITUTION_CODE,
                period: auditData.period,
                generatedAt: new Date().toISOString(),
                version: '1.0'
            },
            operationalRisk: {
                totalEvents: auditData.totalRecords,
                lossEvents: this.extractLossEvents(auditData.logs),
                riskIndicators: this.calculateRiskIndicators(auditData.logs),
                controlAssessment: this.assessControls(auditData.logs)
            },
            compliance: {
                violations: this.extractViolations(auditData.logs),
                remediation: this.extractRemediation(auditData.logs)
            }
        };

        return this.generateXMLFromTemplate(template, xmlData);
    }

    /**
     * Formata notificação para ANPD
     */
    async formatANPDNotification(breachData) {
        return {
            notification: {
                type: 'DATA_BREACH',
                institution: {
                    name: process.env.INSTITUTION_NAME,
                    cnpj: process.env.INSTITUTION_CNPJ,
                    contact: process.env.DPO_CONTACT
                },
                breach: {
                    id: breachData.breachId,
                    discoveredAt: breachData.discoveredAt,
                    occurredAt: breachData.occurredAt,
                    nature: breachData.nature,
                    categoriesOfData: breachData.categoriesOfData,
                    numberOfSubjects: breachData.numberOfSubjects,
                    likelyConsequences: breachData.likelyConsequences,
                    measuresTaken: breachData.measuresTaken,
                    riskLevel: this.assessBreachRisk(breachData)
                },
                notification: {
                    submittedAt: new Date().toISOString(),
                    submittedBy: process.env.DPO_NAME,
                    contactEmail: process.env.DPO_EMAIL
                }
            }
        };
    }

    /**
     * Converte para formato CEF (Common Event Format)
     */
    convertToCEF(auditEntry) {
        const timestamp = new Date(auditEntry.timestamp).toISOString();
        const severity = this.mapSeverityToCEF(auditEntry.impact?.severity || 'LOW');

        return [
            'CEF:0',
            'BankAuditSystem',
            'IncidentResolution',
            '1.0',
            auditEntry.eventType,
            auditEntry.description || auditEntry.action || 'Audit Event',
            severity,
            `rt=${timestamp}`,
            `src=${auditEntry.ipAddress || 'unknown'}`,
            `suser=${auditEntry.operatorId || 'system'}`,
            `act=${auditEntry.action || auditEntry.eventType}`,
            `outcome=${auditEntry.compliance?.complianceStatus || 'unknown'}`,
            `cs1=${auditEntry.incidentId}`,
            `cs1Label=IncidentID`,
            `cs2=${auditEntry.classification || 'OPERATIONAL'}`,
            `cs2Label=DataClassification`
        ].join('|');
    }

    /**
     * Configura exportação em tempo real
     */
    setupRealTimeExport(system) {
        this.auditService.on('auditEntry', async (entry) => {
            try {
                if (system === 'siem') {
                    await this.exportToSIEM([entry]);
                }
            } catch (error) {
                console.error(`Real-time export to ${system} failed:`, error);
            }
        });
    }

    /**
     * Configura exportação periódica
     */
    setupPeriodicExport(system, interval) {
        const exportInterval = setInterval(async () => {
            try {
                const period = this.calculatePeriod(interval);

                switch (system) {
                    case 'grc':
                        const grcReport = await this.generateGRCReport(period);
                        await this.exportToGRC(grcReport, 'weekly_compliance');
                        break;
                    case 'erp':
                        const erpData = await this.generateERPData(period);
                        await this.exportToERP(erpData);
                        break;
                }
            } catch (error) {
                console.error(`Periodic export to ${system} failed:`, error);
            }
        }, interval);

        this.scheduledExports.set(system, exportInterval);
    }

    /**
     * Configura exportação mensal
     */
    setupMonthlyExport(system) {
        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const timeUntilNextMonth = nextMonth.getTime() - now.getTime();

        setTimeout(() => {
            // Primeira execução no início do próximo mês
            this.executeMonthlyExport(system);

            // Agenda execuções mensais subsequentes
            const monthlyInterval = setInterval(() => {
                this.executeMonthlyExport(system);
            }, 30 * 24 * 60 * 60 * 1000); // Aproximadamente 30 dias

            this.scheduledExports.set(system, monthlyInterval);
        }, timeUntilNextMonth);
    }

    /**
     * Executa exportação mensal
     */
    async executeMonthlyExport(system) {
        try {
            const lastMonth = new Date();
            lastMonth.setMonth(lastMonth.getMonth() - 1);

            const period = {
                start: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1).toISOString(),
                end: new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0).toISOString()
            };

            if (system === 'sisbacen') {
                await this.exportToSISBACEN(period, 'operational_risk');
            }
        } catch (error) {
            console.error(`Monthly export to ${system} failed:`, error);
        }
    }

    /**
     * Configura notificação de vazamentos
     */
    setupBreachNotification(system) {
        this.auditService.on('auditEntry', async (entry) => {
            if (this.isDataBreach(entry)) {
                try {
                    const breachData = this.extractBreachData(entry);
                    if (system === 'anpd') {
                        await this.notifyANPDDataBreach(breachData);
                    }
                } catch (error) {
                    console.error(`Breach notification to ${system} failed:`, error);
                }
            }
        });
    }

    /**
     * Envia dados para SISBACEN
     */
    async sendToSISBACEN(data, reportType) {
        const endpoint = this.config.endpoints.sisbacen;

        // Carrega certificado cliente
        const cert = await fs.readFile(endpoint.cert);
        const key = await fs.readFile(endpoint.key);

        const options = {
            hostname: new URL(endpoint.url).hostname,
            port: new URL(endpoint.url).port || 443,
            path: `/sisbacen/upload/${reportType}`,
            method: 'POST',
            cert,
            key,
            headers: {
                'Content-Type': 'application/xml',
                'Content-Length': Buffer.byteLength(data),
                'X-Institution-Code': process.env.INSTITUTION_CODE
            },
            timeout: endpoint.timeout
        };

        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let responseData = '';

                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode === 200) {
                        try {
                            const response = JSON.parse(responseData);
                            resolve(response);
                        } catch (error) {
                            resolve({ protocolNumber: 'UNKNOWN', status: 'SUCCESS' });
                        }
                    } else {
                        reject(new Error(`SISBACEN error: ${res.statusCode} - ${responseData}`));
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => reject(new Error('SISBACEN request timeout')));

            req.write(data);
            req.end();
        });
    }

    /**
     * Envia notificação para ANPD
     */
    async sendToANPD(notification) {
        const endpoint = this.config.endpoints.anpd;

        const options = {
            hostname: new URL(endpoint.url).hostname,
            port: new URL(endpoint.url).port || 443,
            path: '/anpd/breach-notification',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${endpoint.apiKey}`,
                'X-Institution-CNPJ': process.env.INSTITUTION_CNPJ
            },
            timeout: endpoint.timeout
        };

        const data = JSON.stringify(notification);

        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let responseData = '';

                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode === 200 || res.statusCode === 201) {
                        try {
                            const response = JSON.parse(responseData);
                            resolve(response);
                        } catch (error) {
                            resolve({ protocolNumber: 'UNKNOWN', status: 'SUCCESS' });
                        }
                    } else {
                        reject(new Error(`ANPD error: ${res.statusCode} - ${responseData}`));
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => reject(new Error('ANPD request timeout')));

            req.write(data);
            req.end();
        });
    }

    /**
     * Envia logs para SIEM
     */
    async sendToSIEM(cefLogs) {
        const endpoint = this.config.endpoints.siem;
        const net = require('net');

        return new Promise((resolve, reject) => {
            const client = new net.Socket();

            client.connect(endpoint.port, new URL(endpoint.url).hostname, () => {
                cefLogs.forEach(log => {
                    client.write(log + '\n');
                });
                client.end();
            });

            client.on('error', reject);
            client.on('close', () => resolve({ status: 'SUCCESS' }));

            setTimeout(() => {
                client.destroy();
                reject(new Error('SIEM connection timeout'));
            }, endpoint.timeout);
        });
    }

    /**
     * Obtém histórico de exportações
     */
    getExportHistory(system = null, limit = 100) {
        let history = this.exportHistory;

        if (system) {
            history = history.filter(export_ => export_.system === system);
        }

        return history
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);
    }

    /**
     * Obtém status das exportações
     */
    getExportStatus() {
        return {
            enabledSystems: this.config.enabledSystems,
            activeExports: Array.from(this.activeExports),
            queueSize: this.exportQueue.size,
            totalExports: this.exportHistory.length,
            successfulExports: this.exportHistory.filter(e => e.status === 'SUCCESS').length,
            failedExports: this.exportHistory.filter(e => e.status === 'ERROR').length,
            lastExportTimestamp: this.exportHistory.length > 0 ?
                Math.max(...this.exportHistory.map(e => new Date(e.timestamp).getTime())) :
                null
        };
    }

    // Métodos auxiliares

    validateBreachData(breachData) {
        const required = ['breachId', 'discoveredAt', 'nature', 'categoriesOfData', 'numberOfSubjects'];
        for (const field of required) {
            if (!breachData[field]) {
                throw new Error(`Missing required breach field: ${field}`);
            }
        }
    }

    isDataBreach(auditEntry) {
        return auditEntry.eventType === 'SECURITY_EVENT' &&
               auditEntry.category === 'DATA_BREACH';
    }

    extractBreachData(auditEntry) {
        return {
            breachId: auditEntry.incidentId,
            discoveredAt: auditEntry.timestamp,
            occurredAt: auditEntry.occurredAt || auditEntry.timestamp,
            nature: auditEntry.breachNature || 'UNAUTHORIZED_ACCESS',
            categoriesOfData: auditEntry.categoriesOfData || ['PERSONAL_DATA'],
            numberOfSubjects: auditEntry.numberOfSubjects || 0,
            likelyConsequences: auditEntry.likelyConsequences || 'POTENTIAL_PRIVACY_IMPACT',
            measuresTaken: auditEntry.measuresTaken || 'INCIDENT_CONTAINMENT'
        };
    }

    mapSeverityToCEF(severity) {
        const mapping = {
            'LOW': '3',
            'MEDIUM': '5',
            'HIGH': '7',
            'CRITICAL': '9'
        };
        return mapping[severity] || '3';
    }

    calculatePeriod(interval) {
        const end = new Date();
        const start = new Date(end.getTime() - interval);
        return {
            start: start.toISOString(),
            end: end.toISOString()
        };
    }

    /**
     * Para o serviço de exportação
     */
    stop() {
        this.scheduledExports.forEach((interval) => {
            clearInterval(interval);
        });
        this.scheduledExports.clear();
    }
}

module.exports = ExternalSystemExporter;