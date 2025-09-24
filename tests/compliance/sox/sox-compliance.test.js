/**
 * SOX Compliance Testing Suite
 * Testing Sarbanes-Oxley compliance for IT controls and financial reporting
 */

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');

describe('SOX Compliance Tests', () => {
  let itControlsManager;
  let auditTrailManager;
  let accessControlManager;
  let changeManagementSystem;

  beforeEach(() => {
    itControlsManager = {
      validateITGC: jest.fn(), // IT General Controls
      assessControlEffectiveness: jest.fn(),
      documentControlDeficiency: jest.fn(),
      trackRemediation: jest.fn()
    };

    auditTrailManager = {
      logSystemAccess: jest.fn(),
      logDataModification: jest.fn(),
      logPrivilegedAction: jest.fn(),
      generateAuditReport: jest.fn(),
      validateAuditTrailIntegrity: jest.fn()
    };

    accessControlManager = {
      validateUserAccess: jest.fn(),
      enforceSegregationOfDuties: jest.fn(),
      reviewAccessRights: jest.fn(),
      detectUnauthorizedAccess: jest.fn()
    };

    changeManagementSystem = {
      validateChangeApproval: jest.fn(),
      trackSystemChanges: jest.fn(),
      assessChangeImpact: jest.fn(),
      documentEmergencyChanges: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('IT General Controls (ITGC)', () => {
    test('should validate access controls for financial systems', async () => {
      const accessRequest = {
        userId: 'finance_user_001',
        systemId: 'FINANCIAL_REPORTING_SYSTEM',
        requestedActions: ['READ_FINANCIAL_DATA', 'GENERATE_REPORTS'],
        businessJustification: 'Monthly financial reporting',
        approver: 'finance_manager_001'
      };

      accessControlManager.validateUserAccess.mockResolvedValue({
        accessGranted: true,
        controlsValidated: {
          userAuthentication: 'STRONG_MFA',
          authorizationLevel: 'APPROPRIATE',
          businessJustification: 'DOCUMENTED',
          approvalWorkflow: 'COMPLETED'
        },
        segregationOfDuties: {
          conflicts: [],
          compliant: true
        },
        auditTrail: 'ACCESS-LOG-001'
      });

      const validation = await accessControlManager.validateUserAccess(accessRequest);

      expect(validation.accessGranted).toBe(true);
      expect(validation.controlsValidated.userAuthentication).toBe('STRONG_MFA');
      expect(validation.segregationOfDuties.compliant).toBe(true);
    });

    test('should enforce segregation of duties in incident management', async () => {
      const incidentResolutionRequest = {
        incidentId: 'INC-FIN-001',
        category: 'FINANCIAL_SYSTEM',
        requestedActions: ['MODIFY_FINANCIAL_DATA', 'APPROVE_CHANGES'],
        userId: 'tech_support_001'
      };

      accessControlManager.enforceSegregationOfDuties.mockResolvedValue({
        sodViolationDetected: true,
        violations: [
          {
            type: 'SAME_USER_MODIFY_AND_APPROVE',
            risk: 'HIGH',
            description: 'User cannot both modify and approve financial data changes'
          }
        ],
        requiredApprovals: [
          {
            role: 'FINANCIAL_CONTROLLER',
            reason: 'Financial data modification approval'
          }
        ],
        actionTaken: 'REQUEST_BLOCKED'
      });

      const sodCheck = await accessControlManager.enforceSegregationOfDuties(incidentResolutionRequest);

      expect(sodCheck.sodViolationDetected).toBe(true);
      expect(sodCheck.actionTaken).toBe('REQUEST_BLOCKED');
      expect(sodCheck.requiredApprovals).toHaveLength(1);
    });

    test('should validate data backup and recovery controls', async () => {
      const backupScenario = {
        systemId: 'FINANCIAL_DATABASE',
        backupType: 'DAILY_INCREMENTAL',
        retentionPeriod: '7_YEARS', // SOX requirement
        encryptionStatus: 'ENCRYPTED',
        testRestoreFrequency: 'QUARTERLY'
      };

      itControlsManager.validateITGC.mockResolvedValue({
        controlType: 'DATA_BACKUP_AND_RECOVERY',
        effectivenessRating: 'EFFECTIVE',
        complianceStatus: 'COMPLIANT',
        controlTests: {
          backupIntegrity: 'PASSED',
          restoreCapability: 'VERIFIED',
          retentionCompliance: 'COMPLIANT',
          encryptionValidation: 'STRONG'
        },
        lastTested: new Date().toISOString(),
        nextTestDue: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
      });

      const validation = await itControlsManager.validateITGC(backupScenario);

      expect(validation.effectivenessRating).toBe('EFFECTIVE');
      expect(validation.controlTests.retentionCompliance).toBe('COMPLIANT');
      expect(validation.controlTests.encryptionValidation).toBe('STRONG');
    });
  });

  describe('Change Management Controls', () => {
    test('should validate system change approval workflow', async () => {
      const systemChange = {
        changeId: 'CHG-SOX-001',
        systemsAffected: ['FINANCIAL_REPORTING', 'GENERAL_LEDGER'],
        changeType: 'APPLICATION_UPDATE',
        impactAssessment: 'MEDIUM',
        businessJustification: 'Security patch for financial systems',
        requestedBy: 'it_security_team',
        implementationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };

      changeManagementSystem.validateChangeApproval.mockResolvedValue({
        approvalStatus: 'APPROVED',
        approvalWorkflow: {
          itManager: { approved: true, timestamp: '2024-01-15T10:00:00Z' },
          financeManager: { approved: true, timestamp: '2024-01-15T14:30:00Z' },
          complianceOfficer: { approved: true, timestamp: '2024-01-16T09:15:00Z' }
        },
        riskAssessment: {
          financialReportingImpact: 'LOW',
          dataIntegrityRisk: 'MINIMAL',
          controlImpact: 'NONE'
        },
        testingRequirements: {
          userAcceptanceTesting: 'REQUIRED',
          regressionTesting: 'REQUIRED',
          rollbackPlan: 'DOCUMENTED'
        }
      });

      const approval = await changeManagementSystem.validateChangeApproval(systemChange);

      expect(approval.approvalStatus).toBe('APPROVED');
      expect(approval.approvalWorkflow.complianceOfficer.approved).toBe(true);
      expect(approval.testingRequirements.rollbackPlan).toBe('DOCUMENTED');
    });

    test('should track emergency changes to financial systems', async () => {
      const emergencyChange = {
        changeId: 'EMG-CHG-001',
        reason: 'CRITICAL_SECURITY_VULNERABILITY',
        systemsAffected: ['PAYMENT_PROCESSING'],
        urgency: 'CRITICAL',
        implementedBy: 'emergency_response_team',
        implementedAt: new Date().toISOString(),
        businessImpact: 'FINANCIAL_TRANSACTION_SECURITY'
      };

      changeManagementSystem.documentEmergencyChanges.mockResolvedValue({
        emergencyChangeDocumented: true,
        postImplementationReview: {
          scheduled: true,
          reviewDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          reviewers: ['IT_MANAGER', 'COMPLIANCE_OFFICER', 'FINANCE_MANAGER']
        },
        retroactiveApproval: {
          required: true,
          deadline: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
          approvers: ['CIO', 'CFO']
        },
        auditNotification: {
          internalAudit: 'NOTIFIED',
          externalAuditor: 'PENDING_NOTIFICATION'
        }
      });

      const documentation = await changeManagementSystem.documentEmergencyChanges(emergencyChange);

      expect(documentation.emergencyChangeDocumented).toBe(true);
      expect(documentation.retroactiveApproval.required).toBe(true);
      expect(documentation.auditNotification.internalAudit).toBe('NOTIFIED');
    });
  });

  describe('Audit Trail and Logging Controls', () => {
    test('should maintain comprehensive audit trails for financial data access', async () => {
      const financialDataAccess = {
        userId: 'accountant_001',
        action: 'FINANCIAL_DATA_QUERY',
        systemId: 'GENERAL_LEDGER',
        dataAccessed: ['REVENUE_ACCOUNTS', 'EXPENSE_ACCOUNTS'],
        queryDetails: 'Monthly P&L report generation',
        timestamp: new Date().toISOString(),
        sessionId: 'FIN-SES-001'
      };

      auditTrailManager.logSystemAccess.mockResolvedValue({
        auditLogCreated: true,
        logEntry: {
          ...financialDataAccess,
          ipAddress: '192.168.10.50',
          userAgent: 'FinanceApp/2.1',
          authenticationMethod: 'MFA_SMARTCARD',
          dataClassification: 'CONFIDENTIAL_FINANCIAL',
          retentionPeriod: '7_YEARS'
        },
        integrityHash: 'SHA256:a1b2c3d4e5f6...',
        tamperProtection: 'ENABLED'
      });

      const auditLog = await auditTrailManager.logSystemAccess(financialDataAccess);

      expect(auditLog.auditLogCreated).toBe(true);
      expect(auditLog.logEntry.retentionPeriod).toBe('7_YEARS');
      expect(auditLog.tamperProtection).toBe('ENABLED');
    });

    test('should detect and log privileged actions in financial systems', async () => {
      const privilegedAction = {
        userId: 'database_admin_001',
        action: 'FINANCIAL_DATA_MODIFICATION',
        systemId: 'FINANCIAL_DATABASE',
        targetData: 'REVENUE_TRANSACTION_001',
        oldValue: '[ENCRYPTED]',
        newValue: '[ENCRYPTED]',
        businessJustification: 'Correction of posting error per journal entry JE-2024-001',
        approvalReference: 'APPROVAL-FIN-001'
      };

      auditTrailManager.logPrivilegedAction.mockResolvedValue({
        privilegedActionLogged: true,
        riskAssessment: {
          financialImpact: 'MATERIAL',
          auditAttention: 'REQUIRED',
          notificationTriggers: ['INTERNAL_AUDIT', 'EXTERNAL_AUDITOR', 'CFO']
        },
        additionalControls: {
          dualApprovalRequired: true,
          independentVerification: 'SCHEDULED',
          riskMitigation: 'ENHANCED_MONITORING'
        },
        auditFlags: ['FINANCIAL_DATA_MODIFICATION', 'PRIVILEGED_USER_ACTION']
      });

      const privilegedLog = await auditTrailManager.logPrivilegedAction(privilegedAction);

      expect(privilegedLog.privilegedActionLogged).toBe(true);
      expect(privilegedLog.riskAssessment.auditAttention).toBe('REQUIRED');
      expect(privilegedLog.additionalControls.dualApprovalRequired).toBe(true);
    });

    test('should validate audit trail integrity and completeness', async () => {
      const auditPeriod = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        systemsInScope: ['FINANCIAL_REPORTING', 'GENERAL_LEDGER', 'ACCOUNTS_PAYABLE']
      };

      auditTrailManager.validateAuditTrailIntegrity.mockResolvedValue({
        integrityValidation: 'PASSED',
        completenessCheck: {
          expectedLogs: 45678,
          actualLogs: 45678,
          missingLogs: 0,
          completenessRate: 1.0
        },
        integrityTests: {
          hashValidation: 'PASSED',
          timestampValidation: 'PASSED',
          sequenceValidation: 'PASSED',
          tamperDetection: 'NO_TAMPERING_DETECTED'
        },
        archivalStatus: {
          archivedLogs: 40000,
          retentionCompliance: 'COMPLIANT',
          accessControls: 'ENFORCED'
        }
      });

      const validation = await auditTrailManager.validateAuditTrailIntegrity(auditPeriod);

      expect(validation.integrityValidation).toBe('PASSED');
      expect(validation.completenessCheck.completenessRate).toBe(1.0);
      expect(validation.integrityTests.tamperDetection).toBe('NO_TAMPERING_DETECTED');
    });
  });

  describe('Application Controls for Financial Reporting', () => {
    test('should validate data integrity controls in financial calculations', async () => {
      const financialCalculation = {
        reportType: 'MONTHLY_P_AND_L',
        period: '2024-01',
        inputData: {
          revenueAccounts: 15,
          expenseAccounts: 25,
          transactionCount: 12500
        },
        calculationEngine: 'FINANCIAL_CALC_v2.1'
      };

      itControlsManager.assessControlEffectiveness.mockResolvedValue({
        controlType: 'DATA_INTEGRITY_FINANCIAL_CALC',
        effectiveness: 'EFFECTIVE',
        controlTests: {
          inputValidation: 'PASSED',
          calculationAccuracy: 'VERIFIED',
          balanceReconciliation: 'BALANCED',
          roundingValidation: 'APPROPRIATE'
        },
        exceptions: [],
        compensatingControls: [],
        riskRating: 'LOW'
      });

      const assessment = await itControlsManager.assessControlEffectiveness(financialCalculation);

      expect(assessment.effectiveness).toBe('EFFECTIVE');
      expect(assessment.controlTests.balanceReconciliation).toBe('BALANCED');
      expect(assessment.exceptions).toHaveLength(0);
    });

    test('should document control deficiencies and remediation plans', async () => {
      const controlDeficiency = {
        controlId: 'ITGC-ACCESS-001',
        deficiencyType: 'USER_ACCESS_REVIEW',
        severity: 'SIGNIFICANT_DEFICIENCY',
        description: 'Quarterly user access reviews not performed for Q3 2023',
        potentialImpact: 'Unauthorized access to financial data',
        rootCause: 'Manual process oversight',
        affectedSystems: ['FINANCIAL_REPORTING', 'GENERAL_LEDGER']
      };

      itControlsManager.documentControlDeficiency.mockResolvedValue({
        deficiencyDocumented: true,
        deficiencyId: 'DEF-2024-001',
        managementResponse: {
          acknowledged: true,
          targetRemediationDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          remediationPlan: 'Implement automated quarterly access review process',
          responsibleParty: 'IT_SECURITY_MANAGER',
          interimControls: ['Enhanced monitoring of financial system access']
        },
        auditCommunication: {
          internalAuditNotified: true,
          externalAuditorNotified: true,
          boardNotificationRequired: false // Not material weakness
        }
      });

      const documentation = await itControlsManager.documentControlDeficiency(controlDeficiency);

      expect(documentation.deficiencyDocumented).toBe(true);
      expect(documentation.managementResponse.acknowledged).toBe(true);
      expect(documentation.auditCommunication.internalAuditNotified).toBe(true);
    });
  });

  describe('Compliance Reporting and Certification', () => {
    test('should generate SOX compliance assessment report', async () => {
      const assessmentScope = {
        reportingPeriod: 'FY2024',
        systemsInScope: ['FINANCIAL_REPORTING', 'GENERAL_LEDGER', 'REVENUE_RECOGNITION'],
        controlTypes: ['ITGC', 'APPLICATION_CONTROLS', 'ENTITY_LEVEL_CONTROLS']
      };

      auditTrailManager.generateAuditReport.mockResolvedValue({
        reportId: 'SOX-ASSESSMENT-FY2024',
        executiveSummary: {
          overallAssessment: 'EFFECTIVE',
          materialWeaknesses: 0,
          significantDeficiencies: 2,
          controlsOperated: 45,
          controlsEffective: 43
        },
        controlsByCategory: {
          itgc: {
            total: 15,
            effective: 14,
            deficient: 1,
            effectivenessRate: 0.93
          },
          applicationControls: {
            total: 20,
            effective: 19,
            deficient: 1,
            effectivenessRate: 0.95
          },
          entityLevelControls: {
            total: 10,
            effective: 10,
            deficient: 0,
            effectivenessRate: 1.0
          }
        },
        keyFindings: [
          'User access review process requires automation',
          'Change management documentation needs enhancement'
        ],
        managementCertification: {
          ceoSignoff: 'PENDING',
          cfoSignoff: 'PENDING',
          certificationDeadline: '2024-03-15'
        }
      });

      const assessment = await auditTrailManager.generateAuditReport(assessmentScope);

      expect(assessment.executiveSummary.overallAssessment).toBe('EFFECTIVE');
      expect(assessment.executiveSummary.materialWeaknesses).toBe(0);
      expect(assessment.controlsByCategory.itgc.effectivenessRate).toBeGreaterThan(0.9);
    });
  });

  describe('Incident Response for Financial Systems', () => {
    test('should handle financial system incidents with SOX controls', async () => {
      const financialIncident = {
        incidentId: 'INC-FIN-SOX-001',
        system: 'REVENUE_RECOGNITION_SYSTEM',
        impactType: 'FINANCIAL_REPORTING_ACCURACY',
        severity: 'HIGH',
        estimatedFinancialImpact: 'MATERIAL',
        affectedReportingPeriods: ['2024-Q1'],
        discoveredBy: 'INTERNAL_AUDIT'
      };

      itControlsManager.assessControlEffectiveness.mockResolvedValue({
        incidentClassification: 'SOX_SIGNIFICANT',
        requiredNotifications: [
          'CFO_IMMEDIATE',
          'AUDIT_COMMITTEE_24H',
          'EXTERNAL_AUDITOR_24H',
          'SEC_IF_MATERIAL'
        ],
        controlImpact: {
          controlsAffected: ['REV-REC-001', 'REV-REC-005'],
          controlEffectivenessImpact: 'DEFICIENT',
          compensatingControls: 'REQUIRED'
        },
        remediationRequirements: {
          immediateActions: 'Isolate affected system',
          forensicAnalysis: 'REQUIRED',
          managementTesting: 'ENHANCED',
          documentationUpdates: 'REQUIRED'
        }
      });

      const assessment = await itControlsManager.assessControlEffectiveness(financialIncident);

      expect(assessment.incidentClassification).toBe('SOX_SIGNIFICANT');
      expect(assessment.requiredNotifications).toContain('AUDIT_COMMITTEE_24H');
      expect(assessment.remediationRequirements.forensicAnalysis).toBe('REQUIRED');
    });
  });
});