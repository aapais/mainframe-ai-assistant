/**
 * Schemas de Validação para Logs de Auditoria
 * Define estruturas de dados padronizadas para compliance bancário
 */

const Joi = require('joi');

class AuditSchema {
  static get baseAuditEntry() {
    return Joi.object({
      eventType: Joi.string()
        .valid(
          'LLM_INTERACTION',
          'OPERATOR_ACTION',
          'SYSTEM_DECISION',
          'SLA_METRICS',
          'COMPLIANCE_EVENT',
          'SECURITY_EVENT',
          'PERFORMANCE_EVENT'
        )
        .required(),
      timestamp: Joi.string().isoDate().required(),
      incidentId: Joi.string().uuid().required(),
      sessionId: Joi.string().uuid().optional(),
      operatorId: Joi.string().when('eventType', {
        is: 'OPERATOR_ACTION',
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
      executionTime: Joi.number().min(0).optional(),
      controlData: Joi.object({
        sequence: Joi.number().integer().min(0).required(),
        checksum: Joi.string().hex().length(64).required(),
        signature: Joi.object({
          algorithm: Joi.string().required(),
          hash: Joi.string().hex().required(),
          timestamp: Joi.string().isoDate().required(),
          signedBy: Joi.string().required(),
        }).required(),
      }).required(),
    });
  }

  static get llmInteractionSchema() {
    return this.baseAuditEntry.concat(
      Joi.object({
        llmProvider: Joi.string().valid('openai', 'anthropic', 'google', 'azure', 'aws').required(),
        model: Joi.string().required(),
        prompt: Joi.alternatives().try(Joi.string(), Joi.object()).required(),
        response: Joi.alternatives().try(Joi.string(), Joi.object()).required(),
        tokens: Joi.object({
          input: Joi.number().integer().min(0).required(),
          output: Joi.number().integer().min(0).required(),
          cost: Joi.number().min(0).optional(),
        }).required(),
        confidence: Joi.number().min(0).max(1).required(),
        contextWindow: Joi.number().integer().min(0).optional(),
        temperature: Joi.number().min(0).max(2).optional(),
        classification: Joi.string()
          .valid('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED')
          .required(),
        compliance: Joi.object({
          dataClassification: Joi.array().items(Joi.string()).required(),
          approvalRequired: Joi.boolean().required(),
          regulatoryImpact: Joi.array()
            .items(Joi.string().valid('SOX', 'BACEN', 'LGPD'))
            .required(),
        }).required(),
      })
    );
  }

  static get operatorActionSchema() {
    return this.baseAuditEntry.concat(
      Joi.object({
        operatorId: Joi.string().required(),
        action: Joi.string().required(),
        description: Joi.string().required(),
        beforeState: Joi.alternatives().try(Joi.string(), Joi.object()).optional(),
        afterState: Joi.alternatives().try(Joi.string(), Joi.object()).optional(),
        justification: Joi.string().required(),
        ipAddress: Joi.string().ip().required(),
        userAgent: Joi.string().optional(),
        authMethod: Joi.string().valid('PASSWORD', 'MFA', 'SSO', 'TOKEN').required(),
        impact: Joi.object({
          severity: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL').required(),
          affectedSystems: Joi.array().items(Joi.string()).optional(),
          businessImpact: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL').optional(),
        }).required(),
        compliance: Joi.object({
          requiresApproval: Joi.boolean().required(),
          approvedBy: Joi.string().when('requiresApproval', {
            is: true,
            then: Joi.required(),
            otherwise: Joi.optional(),
          }),
          approvalTimestamp: Joi.string().isoDate().when('requiresApproval', {
            is: true,
            then: Joi.required(),
            otherwise: Joi.optional(),
          }),
          regulatoryCategory: Joi.string()
            .valid('FINANCIAL', 'PERSONAL_DATA', 'OPERATIONAL')
            .required(),
        }).required(),
      })
    );
  }

  static get systemDecisionSchema() {
    return this.baseAuditEntry.concat(
      Joi.object({
        decisionEngine: Joi.string().required(),
        algorithm: Joi.string().required(),
        version: Joi.string().required(),
        inputs: Joi.alternatives().try(Joi.string(), Joi.object(), Joi.array()).required(),
        decision: Joi.string().required(),
        confidence: Joi.number().min(0).max(1).required(),
        reasoning: Joi.string().required(),
        alternatives: Joi.array().items(Joi.object()).optional(),
        modelMetrics: Joi.object({
          accuracy: Joi.number().min(0).max(1).optional(),
          precision: Joi.number().min(0).max(1).optional(),
          recall: Joi.number().min(0).max(1).optional(),
        }).optional(),
        compliance: Joi.object({
          explainabilityScore: Joi.number().min(0).max(1).required(),
          biasAssessment: Joi.object({
            score: Joi.number().min(0).max(1).required(),
            assessment: Joi.string().valid('LOW_BIAS', 'MEDIUM_BIAS', 'HIGH_BIAS').required(),
          }).required(),
          fairnessMetrics: Joi.object({
            score: Joi.number().min(0).max(1).required(),
            level: Joi.string().valid('LOW', 'MEDIUM', 'HIGH').required(),
          }).required(),
        }).required(),
      })
    );
  }

  static get slaMetricsSchema() {
    return this.baseAuditEntry.concat(
      Joi.object({
        slaType: Joi.string()
          .valid('RESPONSE_TIME', 'RESOLUTION_TIME', 'ESCALATION_TIME', 'AVAILABILITY')
          .required(),
        target: Joi.number().min(0).required(),
        actual: Joi.number().min(0).required(),
        breach: Joi.boolean().required(),
        severity: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL').required(),
        category: Joi.string().required(),
        responseTime: Joi.number().min(0).optional(),
        resolutionTime: Joi.number().min(0).optional(),
        escalationTime: Joi.number().min(0).optional(),
        customerImpact: Joi.string().valid('NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL').required(),
        businessImpact: Joi.string().valid('NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL').required(),
        compliance: Joi.object({
          regulatoryDeadline: Joi.string().isoDate().optional(),
          complianceStatus: Joi.string().valid('COMPLIANT', 'BREACH').required(),
        }).required(),
      })
    );
  }

  static get auditTrailSchema() {
    return Joi.object({
      trailId: Joi.string().uuid().required(),
      incidentId: Joi.string().uuid().required(),
      timestamp: Joi.string().isoDate().required(),
      action: Joi.string().required(),
      who: Joi.string().required(),
      what: Joi.string().required(),
      when: Joi.string().isoDate().required(),
      where: Joi.string().required(),
      why: Joi.string().required(),
      how: Joi.string().required(),
      previousValue: Joi.alternatives().try(Joi.string(), Joi.object()).optional(),
      newValue: Joi.alternatives().try(Joi.string(), Joi.object()).optional(),
      changeReason: Joi.string().required(),
      approvals: Joi.array()
        .items(
          Joi.object({
            approvedBy: Joi.string().required(),
            approvalTimestamp: Joi.string().isoDate().required(),
            approvalReason: Joi.string().required(),
          })
        )
        .optional(),
      digitalSignature: Joi.object({
        algorithm: Joi.string().required(),
        hash: Joi.string().hex().required(),
        timestamp: Joi.string().isoDate().required(),
        signedBy: Joi.string().required(),
        version: Joi.string().required(),
      }).required(),
      checksum: Joi.string().hex().length(32).required(),
      compliance: Joi.object({
        category: Joi.string().valid('FINANCIAL', 'PERSONAL_DATA', 'OPERATIONAL').required(),
        retentionPeriod: Joi.number().integer().min(0).required(),
        classification: Joi.array().items(Joi.string()).required(),
      }).required(),
    });
  }

  static get complianceReportSchema() {
    return Joi.object({
      reportId: Joi.string().uuid().required(),
      regulation: Joi.string().valid('SOX', 'BACEN', 'LGPD').required(),
      period: Joi.object({
        start: Joi.string().isoDate().required(),
        end: Joi.string().isoDate().required(),
      }).required(),
      generatedAt: Joi.string().isoDate().required(),
      preparedBy: Joi.string().required(),
      executiveSummary: Joi.object().required(),
      metadata: Joi.object({
        version: Joi.string().required(),
        checksum: Joi.string().hex().required(),
        digitalSignature: Joi.object().required(),
        encryptionStatus: Joi.string().valid('ENCRYPTED', 'PLAIN').required(),
        retentionUntil: Joi.string().isoDate().required(),
      }).required(),
    });
  }

  static get retentionPolicySchema() {
    return Joi.object({
      dataClassification: Joi.string()
        .valid('FINANCIAL', 'PERSONAL_DATA', 'OPERATIONAL', 'SYSTEM', 'DEBUG')
        .required(),
      retentionDays: Joi.number().integer().min(30).max(3650).required(), // 30 dias a 10 anos
      archiveThreshold: Joi.number().integer().min(0).required(),
      compressionEnabled: Joi.boolean().required(),
      encryptionRequired: Joi.boolean().required(),
      secureDeleteRequired: Joi.boolean().required(),
    });
  }

  static get analyticsReportSchema() {
    return Joi.object({
      reportId: Joi.string().uuid().required(),
      timestamp: Joi.string().isoDate().required(),
      period: Joi.object({
        start: Joi.string().isoDate().required(),
        end: Joi.string().isoDate().required(),
      }).required(),
      format: Joi.string().valid('json', 'xml', 'csv').required(),
      data: Joi.object({
        realTimeMetrics: Joi.object().required(),
        trendData: Joi.object().required(),
        patterns: Joi.object().required(),
        insights: Joi.array()
          .items(
            Joi.object({
              type: Joi.string().valid('PERFORMANCE', 'LLM', 'COMPLIANCE', 'SECURITY').required(),
              severity: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL').required(),
              title: Joi.string().required(),
              description: Joi.string().required(),
              recommendation: Joi.string().required(),
              timestamp: Joi.string().isoDate().required(),
            })
          )
          .required(),
        alerts: Joi.array().items(Joi.object()).required(),
      }).required(),
      summary: Joi.object({
        totalIncidents: Joi.number().integer().min(0).required(),
        avgResolutionTime: Joi.number().min(0).required(),
        slaCompliance: Joi.number().min(0).max(1).required(),
        llmSuccessRate: Joi.number().min(0).max(1).required(),
        complianceScore: Joi.number().min(0).max(1).required(),
        totalAlerts: Joi.number().integer().min(0).required(),
        criticalInsights: Joi.number().integer().min(0).required(),
      }).required(),
    });
  }

  /**
   * Valida entrada de auditoria baseada no tipo
   */
  static validateAuditEntry(entry) {
    const baseValidation = this.baseAuditEntry.validate(entry);
    if (baseValidation.error) {
      throw new Error(`Base validation failed: ${baseValidation.error.message}`);
    }

    let specificSchema;
    switch (entry.eventType) {
      case 'LLM_INTERACTION':
        specificSchema = this.llmInteractionSchema;
        break;
      case 'OPERATOR_ACTION':
        specificSchema = this.operatorActionSchema;
        break;
      case 'SYSTEM_DECISION':
        specificSchema = this.systemDecisionSchema;
        break;
      case 'SLA_METRICS':
        specificSchema = this.slaMetricsSchema;
        break;
      default:
        return baseValidation.value;
    }

    const specificValidation = specificSchema.validate(entry);
    if (specificValidation.error) {
      throw new Error(`Specific validation failed: ${specificValidation.error.message}`);
    }

    return specificValidation.value;
  }

  /**
   * Valida audit trail
   */
  static validateAuditTrail(trail) {
    const validation = this.auditTrailSchema.validate(trail);
    if (validation.error) {
      throw new Error(`Audit trail validation failed: ${validation.error.message}`);
    }
    return validation.value;
  }

  /**
   * Valida relatório de compliance
   */
  static validateComplianceReport(report) {
    const validation = this.complianceReportSchema.validate(report);
    if (validation.error) {
      throw new Error(`Compliance report validation failed: ${validation.error.message}`);
    }
    return validation.value;
  }

  /**
   * Valida política de retenção
   */
  static validateRetentionPolicy(policy) {
    const validation = this.retentionPolicySchema.validate(policy);
    if (validation.error) {
      throw new Error(`Retention policy validation failed: ${validation.error.message}`);
    }
    return validation.value;
  }

  /**
   * Valida relatório de analytics
   */
  static validateAnalyticsReport(report) {
    const validation = this.analyticsReportSchema.validate(report);
    if (validation.error) {
      throw new Error(`Analytics report validation failed: ${validation.error.message}`);
    }
    return validation.value;
  }

  /**
   * Sanitiza dados para remoção de informações sensíveis
   */
  static sanitizeForLogging(
    data,
    sensitiveFields = ['password', 'token', 'secret', 'key', 'cpf', 'account']
  ) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sanitized = JSON.parse(JSON.stringify(data));

    const sanitizeObject = obj => {
      for (const [key, value] of Object.entries(obj)) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
          obj[key] = '[SANITIZED]';
        } else if (typeof value === 'object' && value !== null) {
          sanitizeObject(value);
        }
      }
    };

    sanitizeObject(sanitized);
    return sanitized;
  }

  /**
   * Cria template de entrada de auditoria
   */
  static createAuditEntryTemplate(eventType, baseData = {}) {
    const template = {
      eventType,
      timestamp: new Date().toISOString(),
      incidentId: require('crypto').randomUUID(),
      ...baseData,
    };

    switch (eventType) {
      case 'LLM_INTERACTION':
        return {
          ...template,
          llmProvider: '',
          model: '',
          prompt: '',
          response: '',
          tokens: { input: 0, output: 0, cost: 0 },
          confidence: 0,
          classification: 'INTERNAL',
          compliance: {
            dataClassification: [],
            approvalRequired: false,
            regulatoryImpact: [],
          },
        };

      case 'OPERATOR_ACTION':
        return {
          ...template,
          operatorId: '',
          action: '',
          description: '',
          justification: '',
          ipAddress: '',
          authMethod: 'PASSWORD',
          impact: {
            severity: 'LOW',
            affectedSystems: [],
            businessImpact: 'LOW',
          },
          compliance: {
            requiresApproval: false,
            regulatoryCategory: 'OPERATIONAL',
          },
        };

      case 'SYSTEM_DECISION':
        return {
          ...template,
          decisionEngine: '',
          algorithm: '',
          version: '1.0.0',
          inputs: {},
          decision: '',
          confidence: 0,
          reasoning: '',
          compliance: {
            explainabilityScore: 0,
            biasAssessment: { score: 0, assessment: 'LOW_BIAS' },
            fairnessMetrics: { score: 1, level: 'HIGH' },
          },
        };

      case 'SLA_METRICS':
        return {
          ...template,
          slaType: 'RESPONSE_TIME',
          target: 0,
          actual: 0,
          breach: false,
          severity: 'LOW',
          category: '',
          customerImpact: 'NONE',
          businessImpact: 'NONE',
          compliance: {
            complianceStatus: 'COMPLIANT',
          },
        };

      default:
        return template;
    }
  }
}

module.exports = AuditSchema;
