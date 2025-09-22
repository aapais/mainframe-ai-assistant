/**
 * Tests for AIResolverService
 */

import { AIResolverService, ResolutionProposal, SimilarIncident } from '../aiResolver';
import { IncidentService } from '../IncidentService';
import { IncidentAIService } from '../IncidentAIService';
import { GeminiService } from '../GeminiService';
import type { KBEntry } from '../../database/KnowledgeDB';

// Mock dependencies
jest.mock('../IncidentService');
jest.mock('../IncidentAIService');
jest.mock('../GeminiService');

describe('AIResolverService', () => {
  let aiResolverService: AIResolverService;
  let mockIncidentService: jest.Mocked<IncidentService>;
  let mockAIService: jest.Mocked<IncidentAIService>;
  let mockGeminiService: jest.Mocked<GeminiService>;

  beforeEach(() => {
    // Create mock services
    mockGeminiService = new GeminiService() as jest.Mocked<GeminiService>;
    mockAIService = new IncidentAIService(mockGeminiService) as jest.Mocked<IncidentAIService>;
    mockIncidentService = new IncidentService({} as any) as jest.Mocked<IncidentService>;

    // Initialize AIResolverService with mocks
    aiResolverService = new AIResolverService(mockIncidentService, mockAIService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateResolutionProposal', () => {
    it('should generate a comprehensive resolution proposal', async () => {
      // Arrange
      const currentIncident = {
        id: 'INC-001',
        title: 'DB2 Connection Timeout Error',
        description: 'Database connection timeout occurring in production CICS transaction ABCD',
        category: 'Base de Dados'
      };

      const mockSimilarIncidents: Array<{ entry: KBEntry; similarity: number; reasoning: string }> = [
        {
          entry: {
            id: 'KB-001',
            title: 'DB2 Timeout Resolution',
            problem: 'DB2 connection timeouts in CICS',
            solution: 'Increase connection pool size and timeout values',
            category: 'Base de Dados',
            incident_id: 'INC-HIST-001',
            incident_status: 'resolvido',
            time_to_resolve: 2.5,
            helpful_count: 8,
            not_helpful_count: 1
          } as KBEntry,
          similarity: 0.92,
          reasoning: 'Same database and transaction type'
        }
      ];

      const mockSuggestions = [
        {
          description: 'Increase DB2 connection pool timeout values',
          confidence: 0.85,
          steps: [
            'Review current DB2 connection pool settings',
            'Increase timeout from 30s to 60s',
            'Restart CICS region',
            'Monitor for timeout reduction'
          ],
          estimatedTime: '2-3 hours',
          riskLevel: 'medio' as const
        }
      ];

      // Setup mocks
      mockAIService.findRelatedIncidents.mockResolvedValue(mockSimilarIncidents);
      mockAIService.suggestSolution.mockResolvedValue(mockSuggestions);
      mockAIService.isAvailable.mockReturnValue(true);

      // Act
      const proposal = await aiResolverService.generateResolutionProposal(currentIncident);

      // Assert
      expect(proposal).toBeDefined();
      expect(proposal.id).toContain('resolution-');
      expect(proposal.confidence).toBeGreaterThan(0);
      expect(proposal.estimated_resolution_time).toBeDefined();
      expect(proposal.risk_level).toMatch(/^(baixo|medio|alto)$/);
      expect(proposal.analysis).toContain('DB2 Connection Timeout Error');
      expect(proposal.actions_taken).toContain('1.');
      expect(proposal.next_steps).toContain('1.');
      expect(proposal.reasoning).toContain('incidentes similares');
      expect(proposal.success_probability).toBeGreaterThan(0);
      expect(proposal.similar_incidents).toHaveLength(1);
      expect(proposal.resolution_patterns).toBeDefined();
      expect(proposal.generated_at).toBeInstanceOf(Date);
      expect(proposal.generated_by).toBe('AI-Resolver-v1.0');
    });

    it('should handle incidents with no similar cases', async () => {
      // Arrange
      const currentIncident = {
        id: 'INC-002',
        title: 'Unusual Mainframe Error',
        description: 'Very specific error that has never occurred before',
        category: 'Outro'
      };

      // Setup mocks to return no similar incidents
      mockAIService.findRelatedIncidents.mockResolvedValue([]);
      mockAIService.suggestSolution.mockResolvedValue([]);
      mockAIService.isAvailable.mockReturnValue(true);

      // Act
      const proposal = await aiResolverService.generateResolutionProposal(currentIncident);

      // Assert
      expect(proposal).toBeDefined();
      expect(proposal.confidence).toBeLessThan(0.7); // Lower confidence for unknown issues
      expect(proposal.similar_incidents).toHaveLength(0);
      expect(proposal.analysis).toContain('Unusual Mainframe Error');
      expect(proposal.risk_level).toBe('alto'); // Higher risk for unknown issues
    });

    it('should return fallback proposal when AI service is unavailable', async () => {
      // Arrange
      const currentIncident = {
        title: 'Test Incident',
        description: 'Test description',
        category: 'Other'
      };

      // Setup mocks to simulate AI service failure
      mockAIService.isAvailable.mockReturnValue(false);
      mockAIService.findRelatedIncidents.mockRejectedValue(new Error('AI service unavailable'));

      // Act
      const proposal = await aiResolverService.generateResolutionProposal(currentIncident);

      // Assert
      expect(proposal).toBeDefined();
      expect(proposal.generated_by).toBe('AI-Resolver-Fallback');
      expect(proposal.confidence).toBe(0.3);
      expect(proposal.analysis).toContain('Serviço de IA indisponível');
      expect(proposal.actions_taken).toContain('Revisar documentação técnica');
    });

    it('should calculate metrics correctly from similar incidents', async () => {
      // Arrange
      const currentIncident = {
        title: 'Performance Issue',
        description: 'System running slowly',
        category: 'Performance'
      };

      const mockSimilarIncidents = [
        {
          entry: {
            id: 'KB-001',
            time_to_resolve: 1.5,
            helpful_count: 9,
            not_helpful_count: 1,
            incident_status: 'resolvido'
          } as KBEntry,
          similarity: 0.9,
          reasoning: 'Similar performance issue'
        },
        {
          entry: {
            id: 'KB-002',
            time_to_resolve: 2.5,
            helpful_count: 7,
            not_helpful_count: 3,
            incident_status: 'resolvido'
          } as KBEntry,
          similarity: 0.8,
          reasoning: 'Related performance problem'
        }
      ];

      mockAIService.findRelatedIncidents.mockResolvedValue(mockSimilarIncidents);
      mockAIService.suggestSolution.mockResolvedValue([{
        description: 'Test solution',
        confidence: 0.8,
        steps: ['Step 1'],
        estimatedTime: '2 hours',
        riskLevel: 'baixo' as const
      }]);
      mockAIService.isAvailable.mockReturnValue(true);

      // Act
      const proposal = await aiResolverService.generateResolutionProposal(currentIncident);

      // Assert
      expect(proposal.estimated_resolution_time).toContain('hora'); // Should be around 2 hours average
      expect(proposal.success_probability).toBeGreaterThan(0.7); // High success rate from helpful_count
      expect(proposal.similar_incidents).toHaveLength(2);
    });

    it('should identify resolution patterns correctly', async () => {
      // Arrange
      const currentIncident = {
        title: 'CICS Transaction Abend',
        description: 'Transaction ABCD is abending with code 0C4',
        category: 'CICS'
      };

      const mockSimilarIncidents = [
        {
          entry: {
            id: 'KB-001',
            description: 'CICS transaction abend 0C4',
            solution: 'Restart CICS region and check log files',
            category: 'CICS',
            time_to_resolve: 1.0
          } as KBEntry,
          similarity: 0.95,
          reasoning: 'Same CICS abend pattern'
        },
        {
          entry: {
            id: 'KB-002',
            description: 'CICS memory violation',
            solution: 'Restart CICS region and increase storage',
            category: 'CICS',
            time_to_resolve: 1.5
          } as KBEntry,
          similarity: 0.87,
          reasoning: 'Similar CICS issue'
        }
      ];

      mockAIService.findRelatedIncidents.mockResolvedValue(mockSimilarIncidents);
      mockAIService.suggestSolution.mockResolvedValue([{
        description: 'Restart CICS and investigate',
        confidence: 0.9,
        steps: ['Check logs', 'Restart CICS'],
        estimatedTime: '1 hour',
        riskLevel: 'baixo' as const
      }]);
      mockAIService.isAvailable.mockReturnValue(true);

      // Act
      const proposal = await aiResolverService.generateResolutionProposal(currentIncident);

      // Assert
      expect(proposal.resolution_patterns).toBeDefined();
      expect(proposal.resolution_patterns.length).toBeGreaterThan(0);
      expect(proposal.resolution_patterns[0].pattern_name).toContain('CICS');
      expect(proposal.analysis).toContain('CICS');
    });
  });

  describe('isAvailable', () => {
    it('should return true when AI service is available', () => {
      mockAIService.isAvailable.mockReturnValue(true);
      expect(aiResolverService.isAvailable()).toBe(true);
    });

    it('should return false when AI service is unavailable', () => {
      mockAIService.isAvailable.mockReturnValue(false);
      expect(aiResolverService.isAvailable()).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty incident title gracefully', async () => {
      const currentIncident = {
        title: '',
        description: 'Some description',
        category: 'Other'
      };

      mockAIService.findRelatedIncidents.mockResolvedValue([]);
      mockAIService.suggestSolution.mockResolvedValue([]);
      mockAIService.isAvailable.mockReturnValue(true);

      const proposal = await aiResolverService.generateResolutionProposal(currentIncident);

      expect(proposal).toBeDefined();
      expect(proposal.analysis).toBeDefined();
    });

    it('should handle very long descriptions', async () => {
      const longDescription = 'A'.repeat(10000);
      const currentIncident = {
        title: 'Test',
        description: longDescription,
        category: 'Other'
      };

      mockAIService.findRelatedIncidents.mockResolvedValue([]);
      mockAIService.suggestSolution.mockResolvedValue([]);
      mockAIService.isAvailable.mockReturnValue(true);

      const proposal = await aiResolverService.generateResolutionProposal(currentIncident);

      expect(proposal).toBeDefined();
      expect(proposal.analysis).toBeDefined();
    });

    it('should handle special characters in incident data', async () => {
      const currentIncident = {
        title: 'Test with special chars: ñáéíóú & symbols @#$%',
        description: 'Description with "quotes" and <tags>',
        category: 'Other'
      };

      mockAIService.findRelatedIncidents.mockResolvedValue([]);
      mockAIService.suggestSolution.mockResolvedValue([]);
      mockAIService.isAvailable.mockReturnValue(true);

      const proposal = await aiResolverService.generateResolutionProposal(currentIncident);

      expect(proposal).toBeDefined();
      expect(proposal.analysis).toContain('special chars');
    });
  });
});

describe('Integration Tests', () => {
  let aiResolverService: AIResolverService;

  beforeEach(() => {
    // For integration tests, we might want to use real services or more sophisticated mocks
    const mockGeminiService = new GeminiService() as jest.Mocked<GeminiService>;
    const mockAIService = new IncidentAIService(mockGeminiService) as jest.Mocked<IncidentAIService>;
    const mockIncidentService = new IncidentService({} as any) as jest.Mocked<IncidentService>;

    aiResolverService = new AIResolverService(mockIncidentService, mockAIService);
  });

  it('should generate realistic proposals for common incident types', async () => {
    // This test could be expanded to test against a realistic dataset
    const incidents = [
      {
        title: 'DB2 Deadlock Detected',
        description: 'Multiple transactions creating deadlock in DB2 subsystem',
        category: 'Base de Dados'
      },
      {
        title: 'JCL Job Failing with S0C4',
        description: 'Batch job PAYBATCH failing with system completion code S0C4',
        category: 'JCL'
      },
      {
        title: 'VSAM File Corruption',
        description: 'VSAM cluster showing signs of corruption after system crash',
        category: 'Dados'
      }
    ];

    for (const incident of incidents) {
      const proposal = await aiResolverService.generateResolutionProposal(incident);

      expect(proposal).toBeDefined();
      expect(proposal.confidence).toBeGreaterThan(0);
      expect(proposal.analysis).toContain(incident.title);
      expect(proposal.actions_taken).toMatch(/^\d+\./); // Should start with numbered steps
      expect(proposal.next_steps).toMatch(/^\d+\./);
    }
  });
});