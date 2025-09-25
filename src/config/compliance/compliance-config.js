/**
 * Configurações de Compliance para Regulamentações Bancárias
 * Define parâmetros específicos para SOX, BACEN e LGPD
 */

module.exports = {
  // Configurações gerais de compliance
  general: {
    enableAuditTrail: true,
    enableEncryption: true,
    enableDigitalSignature: true,
    defaultRetentionDays: 2555, // 7 anos
    maxLogFileSize: '100MB',
    compressionLevel: 9,
    auditLogLevel: 'debug',
    realTimeMonitoring: true,
    alertingEnabled: true,
  },

  // Configurações específicas para Sarbanes-Oxley (SOX)
  sox: {
    enabled: true,
    scope: {
      financialReporting: true,
      internalControls: true,
      executiveCertification: true,
      criminalLiability: true,
    },
    reporting: {
      frequency: 'quarterly',
      sections: ['302', '404', '906'],
      automaticGeneration: true,
      reminderDays: [30, 15, 7, 1], // Dias antes do vencimento
    },
    controls: {
      requireApprovalFor: [
        'FINANCIAL_DATA_ACCESS',
        'SYSTEM_CONFIGURATION_CHANGE',
        'USER_PRIVILEGE_ESCALATION',
        'FINANCIAL_REPORTING_MODIFICATION',
      ],
      mandatoryDualApproval: [
        'CRITICAL_SYSTEM_CHANGE',
        'FINANCIAL_STATEMENT_UPDATE',
        'AUDIT_LOG_MODIFICATION',
      ],
      segregationOfDuties: {
        enabled: true,
        conflicts: [
          ['FINANCIAL_ENTRY', 'FINANCIAL_APPROVAL'],
          ['SYSTEM_ADMIN', 'AUDIT_REVIEW'],
          ['USER_CREATION', 'PRIVILEGE_ASSIGNMENT'],
        ],
      },
    },
    certification: {
      officers: {
        ceo: {
          name: 'Chief Executive Officer',
          email: process.env.CEO_EMAIL,
          requiredCertifications: ['302', '906'],
        },
        cfo: {
          name: 'Chief Financial Officer',
          email: process.env.CFO_EMAIL,
          requiredCertifications: ['302', '404'],
        },
        cto: {
          name: 'Chief Technology Officer',
          email: process.env.CTO_EMAIL,
          requiredCertifications: ['404'],
        },
      },
      deadlines: {
        quarterly: 35, // Dias após o fim do trimestre
        annual: 60, // Dias após o fim do ano fiscal
      },
    },
    penalties: {
      section302Violation: {
        fine: 1000000, // $1M
        imprisonment: 10, // anos
      },
      section404Violation: {
        fine: 5000000, // $5M
        imprisonment: 20, // anos
      },
      section906Violation: {
        fine: 5000000, // $5M
        imprisonment: 25, // anos
      },
    },
  },

  // Configurações específicas para BACEN
  bacen: {
    enabled: true,
    scope: {
      operationalRisk: true,
      cybersecurity: true,
      businessContinuity: true,
      dataGovernance: true,
    },
    reporting: {
      frequency: 'monthly',
      circulars: ['3909', '3978', '4018', '4019'],
      automaticGeneration: true,
      submissionDeadline: 15, // Dias após o fim do mês
    },
    riskManagement: {
      categories: {
        OPERATIONAL_RISK: {
          subcategories: ['PEOPLE', 'PROCESSES', 'SYSTEMS', 'EXTERNAL_EVENTS'],
          reportingThreshold: 100000, // R$ 100k
          escalationThreshold: 1000000, // R$ 1M
        },
        CYBER_RISK: {
          subcategories: ['DATA_BREACH', 'SYSTEM_INTRUSION', 'MALWARE', 'SOCIAL_ENGINEERING'],
          reportingThreshold: 0, // Qualquer valor
          escalationThreshold: 50000, // R$ 50k
        },
        BUSINESS_CONTINUITY: {
          subcategories: [
            'SYSTEM_UNAVAILABILITY',
            'FACILITY_DAMAGE',
            'SUPPLIER_FAILURE',
            'KEY_PERSONNEL_LOSS',
          ],
          reportingThreshold: 10000, // R$ 10k
          escalationThreshold: 500000, // R$ 500k
        },
      },
      lossDataCollection: {
        enabled: true,
        minimumThreshold: 1000, // R$ 1k
        dataRetentionYears: 7,
        requiredFields: [
          'EVENT_DATE',
          'DISCOVERY_DATE',
          'LOSS_AMOUNT',
          'RECOVERY_AMOUNT',
          'BUSINESS_LINE',
          'EVENT_TYPE',
          'DESCRIPTION',
        ],
      },
    },
    indicators: {
      keyRiskIndicators: [
        {
          name: 'SYSTEM_AVAILABILITY',
          threshold: 99.5, // %
          measurement: 'percentage',
          frequency: 'daily',
        },
        {
          name: 'INCIDENT_RESOLUTION_TIME',
          threshold: 4, // horas
          measurement: 'hours',
          frequency: 'per_incident',
        },
        {
          name: 'FAILED_TRANSACTIONS_RATE',
          threshold: 0.1, // %
          measurement: 'percentage',
          frequency: 'daily',
        },
      ],
    },
    compliance: {
      circular3909: {
        riskAppetite: {
          financialLoss: 10000000, // R$ 10M anuais
          operationalImpact: 'MEDIUM',
          reputationalRisk: 'LOW',
        },
        governanceStructure: {
          riskCommittee: true,
          cro: true, // Chief Risk Officer
          riskPolicies: true,
        },
      },
      circular3978: {
        operationalRiskFramework: {
          selfAssessment: true,
          lossData: true,
          scenarios: true,
          kris: true, // Key Risk Indicators
        },
        minimumCapital: {
          basicIndicator: true,
          standardized: false,
          advanced: false,
        },
      },
    },
  },

  // Configurações específicas para LGPD
  lgpd: {
    enabled: true,
    scope: {
      dataProcessing: true,
      dataSubjectRights: true,
      dataProtectionOfficer: true,
      dataBreachNotification: true,
    },
    reporting: {
      frequency: 'annual',
      automaticGeneration: true,
      dpoReports: true, // Data Protection Officer
    },
    dataClassification: {
      categories: {
        PERSONAL_DATA: {
          retention: 1825, // 5 anos
          encryption: 'required',
          accessControl: 'strict',
          examples: ['name', 'email', 'phone', 'address'],
        },
        SENSITIVE_PERSONAL_DATA: {
          retention: 1095, // 3 anos
          encryption: 'required',
          accessControl: 'strict',
          examples: ['cpf', 'health_data', 'biometric_data'],
        },
        FINANCIAL_DATA: {
          retention: 2555, // 7 anos
          encryption: 'required',
          accessControl: 'strict',
          examples: ['account_number', 'balance', 'transaction_history'],
        },
      },
      anonymization: {
        enabled: true,
        techniques: ['MASKING', 'PSEUDONYMIZATION', 'GENERALIZATION'],
        retentionAfterAnonymization: 3650, // 10 anos
      },
    },
    rights: {
      dataSubjectRights: [
        'ACCESS',
        'RECTIFICATION',
        'ERASURE',
        'RESTRICTION',
        'PORTABILITY',
        'OBJECTION',
      ],
      responseTimeLimit: 15, // dias
      freeRequestsPerYear: 2,
      chargeAfterLimit: 50, // R$ por solicitação adicional
    },
    breachNotification: {
      authorityNotification: 72, // horas
      dataSubjectNotification: 'when_high_risk',
      anpdEmail: process.env.ANPD_NOTIFICATION_EMAIL,
      requiredElements: [
        'NATURE_OF_BREACH',
        'CATEGORIES_OF_DATA',
        'NUMBER_OF_SUBJECTS',
        'LIKELY_CONSEQUENCES',
        'MEASURES_TAKEN',
      ],
    },
    consent: {
      types: ['EXPLICIT', 'IMPLICIT', 'LEGITIMATE_INTEREST'],
      granularity: 'purpose_specific',
      withdrawal: {
        enabled: true,
        mechanism: 'online_portal',
        effectiveImmediately: true,
      },
      documentation: {
        whenObtained: true,
        legalBasis: true,
        purposeSpecification: true,
        retentionPeriod: true,
      },
    },
    penalties: {
      warning: true,
      publicization: true,
      simpleFineBand1: 50000000, // R$ 50M ou 2% do faturamento
      simpleFineBand2: 50000000, // R$ 50M ou 2% do faturamento
      dailyFine: 200000, // R$ 200k por dia
      partialSuspension: true,
      totalSuspension: true,
      prohibition: true,
    },
  },

  // Configurações de alertas e notificações
  alerting: {
    channels: {
      email: {
        enabled: true,
        smtp: {
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT,
          secure: true,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        },
        recipients: {
          compliance: process.env.COMPLIANCE_EMAIL,
          legal: process.env.LEGAL_EMAIL,
          security: process.env.SECURITY_EMAIL,
          management: process.env.MANAGEMENT_EMAIL,
        },
      },
      slack: {
        enabled: process.env.SLACK_ENABLED === 'true',
        webhook: process.env.SLACK_WEBHOOK,
        channels: {
          compliance: process.env.SLACK_COMPLIANCE_CHANNEL,
          security: process.env.SLACK_SECURITY_CHANNEL,
          alerts: process.env.SLACK_ALERTS_CHANNEL,
        },
      },
      sms: {
        enabled: false,
        provider: 'twilio',
        numbers: {
          emergency: process.env.EMERGENCY_SMS_NUMBER,
        },
      },
    },
    rules: {
      soxViolation: {
        severity: 'CRITICAL',
        channels: ['email', 'slack'],
        escalation: true,
        escalationTime: 300000, // 5 minutos
      },
      bacenBreach: {
        severity: 'HIGH',
        channels: ['email', 'slack'],
        escalation: true,
        escalationTime: 900000, // 15 minutos
      },
      lgpdBreach: {
        severity: 'HIGH',
        channels: ['email'],
        escalation: true,
        escalationTime: 3600000, // 1 hora
      },
      slaViolation: {
        severity: 'MEDIUM',
        channels: ['slack'],
        escalation: false,
      },
    },
  },

  // Configurações de integração
  integrations: {
    externalSystems: {
      erp: {
        enabled: process.env.ERP_INTEGRATION === 'true',
        endpoint: process.env.ERP_ENDPOINT,
        apiKey: process.env.ERP_API_KEY,
        syncFrequency: 'daily',
      },
      siem: {
        enabled: process.env.SIEM_INTEGRATION === 'true',
        endpoint: process.env.SIEM_ENDPOINT,
        format: 'CEF', // Common Event Format
        protocol: 'TCP',
      },
      grc: {
        enabled: process.env.GRC_INTEGRATION === 'true',
        endpoint: process.env.GRC_ENDPOINT,
        apiKey: process.env.GRC_API_KEY,
        reportingFrequency: 'weekly',
      },
    },
    regulatoryReporting: {
      bacenSisbacen: {
        enabled: process.env.SISBACEN_ENABLED === 'true',
        endpoint: process.env.SISBACEN_ENDPOINT,
        certificate: process.env.SISBACEN_CERT_PATH,
        automaticSubmission: false, // Sempre manual para validação
      },
      anpdSistema: {
        enabled: process.env.ANPD_ENABLED === 'true',
        endpoint: process.env.ANPD_ENDPOINT,
        apiKey: process.env.ANPD_API_KEY,
        automaticSubmission: false,
      },
    },
  },

  // Configurações de teste e validação
  testing: {
    compliance: {
      enabled: process.env.NODE_ENV !== 'production',
      mockData: {
        generateSampleIncidents: true,
        sampleSize: 100,
        timeRange: 90, // dias
      },
      validation: {
        schemaValidation: true,
        integrityChecks: true,
        performanceTests: true,
      },
    },
  },

  // Configurações de backup e recuperação
  backup: {
    enabled: true,
    frequency: 'daily',
    retention: 90, // dias
    compression: true,
    encryption: true,
    destinations: [
      {
        type: 'local',
        path: '/backup/compliance',
      },
      {
        type: 's3',
        bucket: process.env.BACKUP_S3_BUCKET,
        region: process.env.BACKUP_S3_REGION,
      },
    ],
    verification: {
      enabled: true,
      frequency: 'weekly',
      checksumValidation: true,
      restoreTest: true,
    },
  },
};
