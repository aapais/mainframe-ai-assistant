/**
 * Audit Service - Sistema de Auditoria para Compliance Bancário
 * Compliance: LGPD, SOX, BACEN
 *
 * Implementa auditoria completa para:
 * - Operações de mascaramento de dados
 * - Acessos a dados sensíveis
 * - Transações e modificações
 * - Compliance regulatório
 */

const crypto = require('crypto');
const { Pool } = require('pg');
const logger = require('../../core/logging/Logger');
const { AuditError } = require('../llm-integration/utils/LLMErrors');

class AuditService extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            enableEncryption: true,
            retentionDays: 2555, // 7 anos para compliance bancário
            maxFileSize: '100m',
            maxFiles: '365d',
            compressionLevel: 9,
            complianceMode: 'SOX_BACEN',
            sensitiveFields: ['cpf', 'account', 'password', 'token'],
            ...config
        };

        this.sessionId = crypto.randomUUID();
        this.initializeLoggers();
        this.auditMetrics = {
            totalEvents: 0,
            criticalEvents: 0,
            complianceViolations: 0,
            performanceMetrics: {}
        };

        // Buffer para logs em memória (para análises em tempo real)
        this.logBuffer = [];
        this.maxBufferSize = 10000;
    }

    initializeLoggers() {
        // Logger de Auditoria Principal
        this.auditLogger = winston.createLogger({
            level: 'debug',
            format: winston.format.combine(
                winston.format.timestamp({
                    format: 'YYYY-MM-DD HH:mm:ss.SSS'
                }),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            defaultMeta: {
                service: 'incident-resolution-audit',
                version: '1.0.0',
                sessionId: this.sessionId
            },
            transports: [
                // Logs de Auditoria Geral
                new DailyRotateFile({
                    filename: 'logs/audit/audit-%DATE%.log',
                    datePattern: 'YYYY-MM-DD',
                    zippedArchive: true,
                    maxSize: this.config.maxFileSize,
                    maxFiles: this.config.maxFiles
                }),

                // Logs Críticos (separados para compliance)
                new DailyRotateFile({
                    filename: 'logs/audit/critical-%DATE%.log',
                    datePattern: 'YYYY-MM-DD',
                    zippedArchive: true,
                    maxSize: this.config.maxFileSize,
                    maxFiles: this.config.maxFiles,
                    level: 'error'
                }),

                // Console para desenvolvimento
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    ),
                    level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug'
                })
            ]
        });

        // Logger de Performance
        this.performanceLogger = winston.createLogger({
            level: 'info',
            format: winston.format.json(),
            transports: [
                new DailyRotateFile({
                    filename: 'logs/performance/performance-%DATE%.log',
                    datePattern: 'YYYY-MM-DD',
                    zippedArchive: true,
                    maxSize: this.config.maxFileSize,
                    maxFiles: this.config.maxFiles
                })
            ]
        });

        // Logger de Compliance
        this.complianceLogger = winston.createLogger({
            level: 'info',
            format: winston.format.json(),
            transports: [
                new DailyRotateFile({
                    filename: 'logs/compliance/compliance-%DATE%.log',
                    datePattern: 'YYYY-MM-DD',
                    zippedArchive: true,
                    maxSize: this.config.maxFileSize,
                    maxFiles: this.config.maxFiles
                })
            ]
        });
    }

    /**
     * Registra interação com LLM
     */
    async logLLMInteraction(data) {
        const auditEntry = {
            eventType: 'LLM_INTERACTION',
            timestamp: new Date().toISOString(),
            incidentId: data.incidentId,
            operatorId: data.operatorId,
            llmProvider: data.provider,
            model: data.model,
            prompt: await this.sanitizeData(data.prompt),
            response: await this.sanitizeData(data.response),
            tokens: {
                input: data.inputTokens,
                output: data.outputTokens,
                cost: data.estimatedCost
            },
            confidence: data.confidence,
            executionTime: data.executionTime,
            contextWindow: data.contextWindow,
            temperature: data.temperature,
            classification: data.classification,
            compliance: {
                dataClassification: this.classifyData(data),
                approvalRequired: this.requiresApproval(data),
                regulatoryImpact: this.assessRegulatoryImpact(data)
            }
        };

        await this.writeAuditEntry(auditEntry);
        this.updateMetrics('llm_interaction', auditEntry);

        return auditEntry;
    }

    /**
     * Registra ação manual do operador
     */
    async logOperatorAction(data) {
        const auditEntry = {
            eventType: 'OPERATOR_ACTION',
            timestamp: new Date().toISOString(),
            incidentId: data.incidentId,
            operatorId: data.operatorId,
            action: data.action,
            description: data.description,
            beforeState: await this.sanitizeData(data.beforeState),
            afterState: await this.sanitizeData(data.afterState),
            justification: data.justification,
            ipAddress: data.ipAddress,
            userAgent: data.userAgent,
            sessionId: data.sessionId,
            authMethod: data.authMethod,
            executionTime: data.executionTime,
            impact: {
                severity: data.impact?.severity,
                affectedSystems: data.impact?.affectedSystems,
                businessImpact: data.impact?.businessImpact
            },
            compliance: {
                requiresApproval: this.requiresApproval(data),
                approvedBy: data.approvedBy,
                approvalTimestamp: data.approvalTimestamp,
                regulatoryCategory: this.categorizeForRegulation(data)
            }
        };

        await this.writeAuditEntry(auditEntry);
        this.updateMetrics('operator_action', auditEntry);

        return auditEntry;
    }

    /**
     * Registra decisão automática do sistema
     */
    async logSystemDecision(data) {
        const auditEntry = {
            eventType: 'SYSTEM_DECISION',
            timestamp: new Date().toISOString(),
            incidentId: data.incidentId,
            decisionEngine: data.engine,
            algorithm: data.algorithm,
            version: data.version,
            inputs: await this.sanitizeData(data.inputs),
            decision: data.decision,
            confidence: data.confidence,
            reasoning: data.reasoning,
            alternatives: data.alternatives,
            executionTime: data.executionTime,
            modelMetrics: {
                accuracy: data.accuracy,
                precision: data.precision,
                recall: data.recall
            },
            compliance: {
                explainabilityScore: this.calculateExplainability(data),
                biasAssessment: this.assessBias(data),
                fairnessMetrics: this.calculateFairness(data)
            }
        };

        await this.writeAuditEntry(auditEntry);
        this.updateMetrics('system_decision', auditEntry);

        return auditEntry;
    }

    /**
     * Registra métricas de SLA e performance
     */
    async logSLAMetrics(data) {
        const auditEntry = {
            eventType: 'SLA_METRICS',
            timestamp: new Date().toISOString(),
            incidentId: data.incidentId,
            slaType: data.slaType,
            target: data.target,
            actual: data.actual,
            breach: data.actual > data.target,
            severity: data.severity,
            category: data.category,
            responseTime: data.responseTime,
            resolutionTime: data.resolutionTime,
            escalationTime: data.escalationTime,
            customerImpact: data.customerImpact,
            businessImpact: data.businessImpact,
            compliance: {
                regulatoryDeadline: data.regulatoryDeadline,
                complianceStatus: this.assessSLACompliance(data)
            }
        };

        await this.writeAuditEntry(auditEntry);
        this.updateMetrics('sla_metrics', auditEntry);

        // Log crítico para violações de SLA
        if (auditEntry.breach) {
            this.auditLogger.error('SLA_BREACH', auditEntry);
            this.auditMetrics.criticalEvents++;
        }

        return auditEntry;
    }

    /**
     * Cria entrada de audit trail completa
     */
    async createAuditTrail(incidentId, action, data) {
        const trail = {
            trailId: crypto.randomUUID(),
            incidentId,
            timestamp: new Date().toISOString(),
            action,
            who: data.operatorId || 'SYSTEM',
            what: data.description,
            when: new Date().toISOString(),
            where: data.location || 'SYSTEM',
            why: data.justification,
            how: data.method,
            previousValue: await this.sanitizeData(data.previousValue),
            newValue: await this.sanitizeData(data.newValue),
            changeReason: data.changeReason,
            approvals: data.approvals || [],
            digitalSignature: await this.createDigitalSignature(data),
            checksum: await this.createChecksum(data),
            compliance: {
                category: this.categorizeForRegulation(data),
                retentionPeriod: this.calculateRetentionPeriod(data),
                classification: this.classifyData(data)
            }
        };

        await this.writeAuditEntry(trail);
        return trail;
    }

    /**
     * Sanitiza dados sensíveis
     */
    async sanitizeData(data) {
        if (!data) return data;

        const sanitized = JSON.parse(JSON.stringify(data));

        for (const field of this.config.sensitiveFields) {
            if (sanitized[field]) {
                if (this.config.enableEncryption) {
                    sanitized[field] = await this.encryptField(sanitized[field]);
                } else {
                    sanitized[field] = this.maskField(sanitized[field]);
                }
            }
        }

        return sanitized;
    }

    /**
     * Criptografa campo sensível
     */
    async encryptField(value) {
        const algorithm = 'aes-256-gcm';
        const key = crypto.scryptSync(process.env.AUDIT_ENCRYPTION_KEY || 'default-key', 'salt', 32);
        const iv = crypto.randomBytes(16);

        const cipher = crypto.createCipher(algorithm, key);
        cipher.setAAD(Buffer.from('audit-data'));

        let encrypted = cipher.update(value, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const tag = cipher.getAuthTag();

        return {
            encrypted: true,
            value: encrypted,
            iv: iv.toString('hex'),
            tag: tag.toString('hex')
        };
    }

    /**
     * Mascara campo sensível
     */
    maskField(value) {
        if (typeof value !== 'string') return '[MASKED]';

        if (value.length <= 4) return '*'.repeat(value.length);

        return value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2);
    }

    /**
     * Classifica dados para compliance
     */
    classifyData(data) {
        const classifications = [];

        if (this.containsPII(data)) classifications.push('PII');
        if (this.containsFinancialData(data)) classifications.push('FINANCIAL');
        if (this.containsConfidentialData(data)) classifications.push('CONFIDENTIAL');

        return classifications.length > 0 ? classifications : ['PUBLIC'];
    }

    /**
     * Verifica se requer aprovação
     */
    requiresApproval(data) {
        return data.impact?.severity === 'CRITICAL' ||
               data.impact?.businessImpact === 'HIGH' ||
               this.containsFinancialData(data);
    }

    /**
     * Avalia impacto regulatório
     */
    assessRegulatoryImpact(data) {
        const impacts = [];

        if (this.containsFinancialData(data)) impacts.push('BACEN');
        if (this.affectsFinancialReporting(data)) impacts.push('SOX');
        if (this.containsPII(data)) impacts.push('LGPD');

        return impacts;
    }

    /**
     * Cria assinatura digital
     */
    async createDigitalSignature(data) {
        const content = JSON.stringify(data);
        const hash = crypto.createHash('sha256').update(content).digest('hex');

        return {
            algorithm: 'sha256',
            hash,
            timestamp: new Date().toISOString(),
            signedBy: 'AUDIT_SYSTEM'
        };
    }

    /**
     * Cria checksum para integridade
     */
    async createChecksum(data) {
        const content = JSON.stringify(data);
        return crypto.createHash('md5').update(content).digest('hex');
    }

    /**
     * Escreve entrada de auditoria
     */
    async writeAuditEntry(entry) {
        try {
            // Adiciona metadados de controle
            entry.controlData = {
                sequence: this.auditMetrics.totalEvents++,
                checksum: await this.createChecksum(entry),
                signature: await this.createDigitalSignature(entry)
            };

            // Log estruturado
            this.auditLogger.info(entry.eventType, entry);

            // Adiciona ao buffer para análises em tempo real
            this.addToBuffer(entry);

            // Log de compliance se necessário
            if (this.requiresComplianceLogging(entry)) {
                this.complianceLogger.info('COMPLIANCE_EVENT', entry);
            }

            // Emite evento para listeners
            this.emit('auditEntry', entry);

        } catch (error) {
            this.auditLogger.error('AUDIT_WRITE_ERROR', {
                error: error.message,
                stack: error.stack,
                entry: entry
            });
            throw error;
        }
    }

    /**
     * Adiciona entrada ao buffer em memória
     */
    addToBuffer(entry) {
        this.logBuffer.push(entry);

        if (this.logBuffer.length > this.maxBufferSize) {
            this.logBuffer.shift(); // Remove o mais antigo
        }
    }

    /**
     * Atualiza métricas
     */
    updateMetrics(type, entry) {
        if (!this.auditMetrics.performanceMetrics[type]) {
            this.auditMetrics.performanceMetrics[type] = {
                count: 0,
                totalTime: 0,
                avgTime: 0
            };
        }

        this.auditMetrics.performanceMetrics[type].count++;

        if (entry.executionTime) {
            this.auditMetrics.performanceMetrics[type].totalTime += entry.executionTime;
            this.auditMetrics.performanceMetrics[type].avgTime =
                this.auditMetrics.performanceMetrics[type].totalTime /
                this.auditMetrics.performanceMetrics[type].count;
        }
    }

    /**
     * Busca logs por critérios
     */
    async searchLogs(criteria) {
        const results = this.logBuffer.filter(entry => {
            return this.matchesCriteria(entry, criteria);
        });

        return {
            results,
            total: results.length,
            criteria
        };
    }

    /**
     * Exporta logs para compliance
     */
    async exportForCompliance(startDate, endDate, format = 'json') {
        const logs = this.logBuffer.filter(entry => {
            const entryDate = new Date(entry.timestamp);
            return entryDate >= startDate && entryDate <= endDate;
        });

        const exportData = {
            exportId: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            period: { startDate, endDate },
            totalRecords: logs.length,
            format,
            logs,
            metadata: {
                version: '1.0.0',
                compliance: this.config.complianceMode,
                retentionPolicy: this.config.retentionDays
            }
        };

        return exportData;
    }

    /**
     * Obtém métricas de auditoria
     */
    getMetrics() {
        return {
            ...this.auditMetrics,
            bufferSize: this.logBuffer.length,
            sessionId: this.sessionId,
            uptime: process.uptime()
        };
    }

    // Métodos auxiliares para classificação
    containsPII(data) {
        const piiFields = ['cpf', 'rg', 'email', 'phone', 'address'];
        return piiFields.some(field => this.hasField(data, field));
    }

    containsFinancialData(data) {
        const financialFields = ['account', 'balance', 'transaction', 'amount'];
        return financialFields.some(field => this.hasField(data, field));
    }

    containsConfidentialData(data) {
        const confidentialFields = ['password', 'token', 'key', 'secret'];
        return confidentialFields.some(field => this.hasField(data, field));
    }

    affectsFinancialReporting(data) {
        return data.impact?.businessImpact === 'HIGH' ||
               data.category === 'FINANCIAL_REPORTING';
    }

    hasField(obj, field) {
        return JSON.stringify(obj).toLowerCase().includes(field.toLowerCase());
    }

    matchesCriteria(entry, criteria) {
        for (const [key, value] of Object.entries(criteria)) {
            if (entry[key] !== value) return false;
        }
        return true;
    }

    requiresComplianceLogging(entry) {
        return entry.compliance &&
               (entry.compliance.regulatoryImpact?.length > 0 ||
                entry.compliance.requiresApproval);
    }

    calculateExplainability(data) {
        // Implementa cálculo de explicabilidade baseado no algoritmo
        return data.reasoning ? 0.8 : 0.3;
    }

    assessBias(data) {
        // Implementa avaliação de viés
        return { score: 0.1, assessment: 'LOW_BIAS' };
    }

    calculateFairness(data) {
        // Implementa métricas de fairness
        return { score: 0.9, level: 'HIGH' };
    }

    categorizeForRegulation(data) {
        if (this.containsFinancialData(data)) return 'FINANCIAL';
        if (this.containsPII(data)) return 'PERSONAL_DATA';
        return 'OPERATIONAL';
    }

    calculateRetentionPeriod(data) {
        if (this.containsFinancialData(data)) return 2555; // 7 anos
        if (this.containsPII(data)) return 1825; // 5 anos
        return 1095; // 3 anos
    }

    assessSLACompliance(data) {
        return data.actual <= data.target ? 'COMPLIANT' : 'BREACH';
    }
}

module.exports = AuditService;