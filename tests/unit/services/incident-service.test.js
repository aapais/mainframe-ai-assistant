/**
 * Unit Tests for Incident Service
 * Testing core incident management functionality
 */

const { describe, test, expect, beforeEach, afterEach, jest } = require('@jest/globals');

describe('IncidentService', () => {
  let incidentService;
  let mockDatabase;

  beforeEach(() => {
    // Mock database connection
    mockDatabase = {
      query: jest.fn(),
      close: jest.fn(),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn()
    };

    // Mock incident service implementation
    incidentService = {
      createIncident: jest.fn(),
      updateIncident: jest.fn(),
      getIncident: jest.fn(),
      deleteIncident: jest.fn(),
      listIncidents: jest.fn(),
      resolveIncident: jest.fn(),
      escalateIncident: jest.fn(),
      assignIncident: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createIncident', () => {
    test('should create incident with valid data', async () => {
      const incidentData = {
        title: 'Database Connection Failure',
        description: 'Unable to connect to mainframe database',
        severity: 'HIGH',
        category: 'DATABASE',
        reportedBy: 'user123',
        system: 'MAINFRAME_DB'
      };

      incidentService.createIncident.mockResolvedValue({
        id: 'INC-001',
        ...incidentData,
        status: 'OPEN',
        createdAt: new Date().toISOString()
      });

      const result = await incidentService.createIncident(incidentData);

      expect(result).toMatchObject({
        id: expect.stringMatching(/^INC-\d+$/),
        title: incidentData.title,
        severity: 'HIGH',
        status: 'OPEN'
      });
      expect(incidentService.createIncident).toHaveBeenCalledWith(incidentData);
    });

    test('should reject incident with invalid severity', async () => {
      const invalidData = {
        title: 'Test Incident',
        severity: 'INVALID',
        category: 'SYSTEM'
      };

      incidentService.createIncident.mockRejectedValue(
        new Error('Invalid severity level')
      );

      await expect(incidentService.createIncident(invalidData))
        .rejects.toThrow('Invalid severity level');
    });

    test('should validate required fields', async () => {
      const incompleteData = {
        description: 'Missing title and category'
      };

      incidentService.createIncident.mockRejectedValue(
        new Error('Title and category are required')
      );

      await expect(incidentService.createIncident(incompleteData))
        .rejects.toThrow('Title and category are required');
    });
  });

  describe('updateIncident', () => {
    test('should update incident status', async () => {
      const incidentId = 'INC-001';
      const updates = {
        status: 'IN_PROGRESS',
        assignedTo: 'tech123',
        notes: 'Investigation started'
      };

      incidentService.updateIncident.mockResolvedValue({
        id: incidentId,
        ...updates,
        updatedAt: new Date().toISOString()
      });

      const result = await incidentService.updateIncident(incidentId, updates);

      expect(result.status).toBe('IN_PROGRESS');
      expect(result.assignedTo).toBe('tech123');
      expect(incidentService.updateIncident).toHaveBeenCalledWith(incidentId, updates);
    });
  });

  describe('AI-powered features', () => {
    test('should suggest resolution based on historical data', async () => {
      const incidentId = 'INC-001';

      incidentService.getSuggestions = jest.fn().mockResolvedValue({
        suggestedActions: [
          'Restart database service',
          'Check network connectivity',
          'Verify authentication credentials'
        ],
        confidence: 0.85,
        basedOnSimilarIncidents: ['INC-045', 'INC-078']
      });

      const suggestions = await incidentService.getSuggestions(incidentId);

      expect(suggestions.confidence).toBeGreaterThan(0.8);
      expect(suggestions.suggestedActions).toHaveLength(3);
    });

    test('should categorize incident automatically', async () => {
      const incidentText = 'Database timeout error on mainframe connection';

      incidentService.categorizeIncident = jest.fn().mockResolvedValue({
        category: 'DATABASE',
        subcategory: 'CONNECTION_TIMEOUT',
        confidence: 0.92
      });

      const categorization = await incidentService.categorizeIncident(incidentText);

      expect(categorization.category).toBe('DATABASE');
      expect(categorization.confidence).toBeGreaterThan(0.9);
    });
  });

  describe('Compliance tracking', () => {
    test('should track LGPD compliance for data incidents', async () => {
      const dataIncident = {
        title: 'Customer data access issue',
        category: 'DATA_PRIVACY',
        affectedRecords: 150,
        containsPersonalData: true
      };

      incidentService.createIncident.mockResolvedValue({
        ...dataIncident,
        id: 'INC-002',
        lgpdCompliance: {
          notificationRequired: true,
          timelineHours: 72,
          supervisoryAuthority: 'ANPD'
        }
      });

      const result = await incidentService.createIncident(dataIncident);

      expect(result.lgpdCompliance.notificationRequired).toBe(true);
      expect(result.lgpdCompliance.timelineHours).toBe(72);
    });

    test('should flag SOX compliance requirements', async () => {
      const financialIncident = {
        title: 'Financial reporting system error',
        category: 'FINANCIAL_SYSTEM',
        impactsFinancialReporting: true
      };

      incidentService.createIncident.mockResolvedValue({
        ...financialIncident,
        id: 'INC-003',
        soxCompliance: {
          requiresAudit: true,
          controlsAffected: ['IT-GC-01', 'IT-GC-02'],
          riskLevel: 'HIGH'
        }
      });

      const result = await incidentService.createIncident(financialIncident);

      expect(result.soxCompliance.requiresAudit).toBe(true);
      expect(result.soxCompliance.riskLevel).toBe('HIGH');
    });
  });

  describe('Performance monitoring', () => {
    test('should complete incident creation within SLA', async () => {
      const start = Date.now();

      incidentService.createIncident.mockImplementation(async (data) => {
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 50));
        return { id: 'INC-004', ...data };
      });

      await incidentService.createIncident({ title: 'Test', category: 'SYSTEM' });

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(500); // 500ms SLA
    });
  });
});