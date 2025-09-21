/**
 * Unified Service Test Suite
 * Tests the unified service API and backward compatibility
 */

import {
  unifiedService,
  knowledgeBaseService,
  incidentService,
  UnifiedEntry,
  CreateUnifiedEntry,
  UpdateUnifiedEntry,
  getUnifiedService,
  getKnowledgeBaseService,
  getIncidentService,
  isKnowledgeBaseEntry,
  isIncidentEntry,
  ServiceFactory
} from '../../renderer/services';

// Mock IPC renderer
const mockIpcRenderer = {
  invoke: jest.fn()
};

// Mock window.api
(global as any).window = {
  api: mockIpcRenderer,
  electronAPI: mockIpcRenderer
};

describe('UnifiedService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIpcRenderer.invoke.mockClear();
  });

  describe('Service Instantiation', () => {
    test('should create singleton instance', () => {
      const service1 = getUnifiedService();
      const service2 = getUnifiedService();
      expect(service1).toBe(service2);
    });

    test('should provide backward compatible service instances', () => {
      const kbService = getKnowledgeBaseService();
      const incidentSvc = getIncidentService();

      expect(kbService).toBeDefined();
      expect(incidentSvc).toBeDefined();
      expect(typeof kbService.createEntry).toBe('function');
      expect(typeof incidentSvc.getIncidents).toBe('function');
    });
  });

  describe('Unified Entry Operations', () => {
    const mockKBEntry: UnifiedEntry = {
      id: 'test-kb-1',
      title: 'Test KB Entry',
      problem: 'Test problem',
      solution: 'Test solution',
      category: 'JCL',
      tags: ['test', 'example'],
      created_at: new Date(),
      updated_at: new Date(),
      created_by: 'test-user',
      usage_count: 0,
      success_count: 0,
      failure_count: 0,
      version: 1,
      entry_type: 'knowledge_base'
    };

    const mockIncidentEntry: UnifiedEntry = {
      id: 'test-incident-1',
      title: 'Test Incident',
      problem: 'System error',
      solution: 'Restart service',
      category: 'System',
      tags: ['critical', 'system'],
      created_at: new Date(),
      updated_at: new Date(),
      created_by: 'test-user',
      usage_count: 0,
      success_count: 0,
      failure_count: 0,
      version: 1,
      entry_type: 'incident',
      status: 'aberto',
      priority: 'P1',
      assigned_to: 'admin',
      reporter: 'user1'
    };

    test('should create KB entry through unified service', async () => {
      mockIpcRenderer.invoke.mockResolvedValueOnce({
        success: true,
        data: mockKBEntry,
        metadata: { executionTime: 100, operationId: 'op-1' }
      });

      const createData: CreateUnifiedEntry = {
        title: 'Test KB Entry',
        problem: 'Test problem',
        solution: 'Test solution',
        category: 'JCL',
        entry_type: 'knowledge_base'
      };

      const result = await unifiedService.createEntry(createData);

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('unified:create-entry', createData);
      expect(result.id).toBe('test-kb-1');
      expect(result.isKBEntry()).toBe(true);
      expect(result.isIncidentEntry()).toBe(false);
    });

    test('should create incident entry through unified service', async () => {
      mockIpcRenderer.invoke.mockResolvedValueOnce({
        success: true,
        data: mockIncidentEntry,
        metadata: { executionTime: 150, operationId: 'op-2' }
      });

      const createData: CreateUnifiedEntry = {
        title: 'Test Incident',
        problem: 'System error',
        solution: 'Restart service',
        category: 'System',
        entry_type: 'incident',
        status: 'aberto',
        priority: 'P1',
        reporter: 'user1'
      };

      const result = await unifiedService.createEntry(createData);

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('unified:create-entry', createData);
      expect(result.id).toBe('test-incident-1');
      expect(result.isIncidentEntry()).toBe(true);
      expect(result.isKBEntry()).toBe(false);
    });

    test('should get entry by ID', async () => {
      mockIpcRenderer.invoke.mockResolvedValueOnce({
        success: true,
        data: mockKBEntry
      });

      const result = await unifiedService.getEntry('test-kb-1');

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('unified:get-entry', { id: 'test-kb-1' });
      expect(result.id).toBe('test-kb-1');
      expect(result.isKBEntry()).toBe(true);
    });

    test('should update entry', async () => {
      const updatedEntry = { ...mockKBEntry, title: 'Updated Title' };
      mockIpcRenderer.invoke.mockResolvedValueOnce({
        success: true,
        data: updatedEntry,
        metadata: { executionTime: 120, operationId: 'op-3' }
      });

      const updateData: UpdateUnifiedEntry = {
        title: 'Updated Title'
      };

      const result = await unifiedService.updateEntry('test-kb-1', updateData);

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('unified:update-entry', {
        id: 'test-kb-1',
        data: updateData
      });
      expect(result.title).toBe('Updated Title');
    });

    test('should delete entry', async () => {
      mockIpcRenderer.invoke.mockResolvedValueOnce({
        success: true,
        metadata: { executionTime: 80, operationId: 'op-4' }
      });

      await unifiedService.deleteEntry('test-kb-1');

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('unified:delete-entry', { id: 'test-kb-1' });
    });

    test('should search entries with type filtering', async () => {
      mockIpcRenderer.invoke.mockResolvedValueOnce({
        success: true,
        data: {
          entries: [mockKBEntry],
          total: 1
        }
      });

      const result = await unifiedService.searchEntries('test query', {
        entry_type: 'knowledge_base',
        limit: 10
      });

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('unified:search-entries', {
        query: 'test query',
        options: {
          entry_type: 'knowledge_base',
          limit: 10
        }
      });
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].isKBEntry()).toBe(true);
    });
  });

  describe('Type-Safe Accessors', () => {
    test('should convert unified entry to KB entry', async () => {
      const mockEntry: UnifiedEntry = {
        id: 'test-1',
        title: 'Test Entry',
        problem: 'Test problem',
        solution: 'Test solution',
        category: 'JCL',
        tags: ['test'],
        created_at: new Date(),
        updated_at: new Date(),
        created_by: 'test-user',
        usage_count: 0,
        success_count: 0,
        failure_count: 0,
        version: 1,
        entry_type: 'knowledge_base'
      };

      mockIpcRenderer.invoke.mockResolvedValueOnce({
        success: true,
        data: mockEntry
      });

      const result = await unifiedService.getEntry('test-1');
      const kbEntry = result.asKBEntry();

      expect(kbEntry.title).toBe('Test Entry');
      expect(kbEntry.category).toBe('JCL');
      expect('status' in kbEntry).toBe(false); // Should not have incident fields
    });

    test('should convert unified entry to incident entry', async () => {
      const mockEntry: UnifiedEntry = {
        id: 'test-2',
        title: 'Test Incident',
        problem: 'System error',
        solution: 'Restart service',
        category: 'System',
        tags: ['critical'],
        created_at: new Date(),
        updated_at: new Date(),
        created_by: 'test-user',
        usage_count: 0,
        success_count: 0,
        failure_count: 0,
        version: 1,
        entry_type: 'incident',
        status: 'aberto',
        priority: 'P1'
      };

      mockIpcRenderer.invoke.mockResolvedValueOnce({
        success: true,
        data: mockEntry
      });

      const result = await unifiedService.getEntry('test-2');
      const incidentEntry = result.asIncidentEntry();

      expect(incidentEntry.title).toBe('Test Incident');
      expect(incidentEntry.status).toBe('aberto');
      expect(incidentEntry.priority).toBe('P1');
    });

    test('should throw error when accessing wrong type', async () => {
      const mockEntry: UnifiedEntry = {
        id: 'test-3',
        title: 'Test Entry',
        problem: 'Test problem',
        solution: 'Test solution',
        category: 'JCL',
        tags: ['test'],
        created_at: new Date(),
        updated_at: new Date(),
        created_by: 'test-user',
        usage_count: 0,
        success_count: 0,
        failure_count: 0,
        version: 1,
        entry_type: 'knowledge_base'
      };

      mockIpcRenderer.invoke.mockResolvedValueOnce({
        success: true,
        data: mockEntry
      });

      const result = await unifiedService.getEntry('test-3');

      expect(() => result.asIncidentEntry()).toThrow('Entry is not an incident entry');
    });
  });

  describe('Backward Compatibility', () => {
    test('should maintain KB service compatibility', async () => {
      mockIpcRenderer.invoke.mockResolvedValueOnce({
        success: true,
        data: {
          id: 'test-kb-1',
          title: 'Test KB Entry',
          problem: 'Test problem',
          solution: 'Test solution',
          category: 'JCL',
          tags: ['test'],
          created_at: new Date(),
          updated_at: new Date(),
          created_by: 'test-user',
          usage_count: 0,
          success_count: 0,
          failure_count: 0,
          version: 1,
          entry_type: 'knowledge_base'
        },
        metadata: { executionTime: 100, operationId: 'op-1' }
      });

      const createData = {
        title: 'Test KB Entry',
        problem: 'Test problem',
        solution: 'Test solution',
        category: 'JCL' as const
      };

      const result = await knowledgeBaseService.createEntry(createData);

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('unified:create-entry', {
        ...createData,
        entry_type: 'knowledge_base'
      });
      expect(result.title).toBe('Test KB Entry');
    });

    test('should maintain incident service compatibility', async () => {
      mockIpcRenderer.invoke.mockResolvedValueOnce({
        id: 'test-incident-1'
      });

      const result = await incidentService.createIncident(
        {
          title: 'Test Incident',
          problem: 'System error',
          solution: 'Restart service',
          category: 'System'
        },
        'P1',
        'admin',
        'user1'
      );

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('unified:create-entry', {
        title: 'Test Incident',
        problem: 'System error',
        solution: 'Restart service',
        category: 'System',
        entry_type: 'incident',
        status: 'aberto',
        priority: 'P1',
        assigned_to: 'admin',
        reporter: 'user1'
      });
      expect(result).toBe('test-incident-1');
    });
  });

  describe('Type Guards', () => {
    const kbEntry: UnifiedEntry = {
      id: 'kb-1',
      title: 'KB Entry',
      problem: 'Problem',
      solution: 'Solution',
      category: 'JCL',
      tags: [],
      created_at: new Date(),
      updated_at: new Date(),
      created_by: 'user',
      usage_count: 0,
      success_count: 0,
      failure_count: 0,
      version: 1,
      entry_type: 'knowledge_base'
    };

    const incidentEntry: UnifiedEntry = {
      ...kbEntry,
      id: 'incident-1',
      entry_type: 'incident',
      status: 'aberto',
      priority: 'P1'
    };

    test('should correctly identify KB entries', () => {
      expect(isKnowledgeBaseEntry(kbEntry)).toBe(true);
      expect(isKnowledgeBaseEntry(incidentEntry)).toBe(false);
    });

    test('should correctly identify incident entries', () => {
      expect(isIncidentEntry(incidentEntry)).toBe(true);
      expect(isIncidentEntry(kbEntry)).toBe(false);
    });
  });

  describe('Service Factory', () => {
    test('should create service instances via factory', () => {
      const unifiedSvc = ServiceFactory.getService('unified');
      const kbSvc = ServiceFactory.getService('kb');
      const incidentSvc = ServiceFactory.getService('incident');

      expect(unifiedSvc).toBeDefined();
      expect(kbSvc).toBeDefined();
      expect(incidentSvc).toBeDefined();
    });

    test('should throw error for unknown service', () => {
      expect(() => ServiceFactory.getService('unknown')).toThrow('Unknown service: unknown');
    });

    test('should return same instance for multiple calls', () => {
      const service1 = ServiceFactory.getService('unified');
      const service2 = ServiceFactory.getService('unified');
      expect(service1).toBe(service2);
    });
  });

  describe('Utility Methods', () => {
    test('should validate status transitions', () => {
      expect(unifiedService.isValidStatusTransition('aberto', 'em_tratamento')).toBe(true);
      expect(unifiedService.isValidStatusTransition('fechado', 'aberto')).toBe(false);
      expect(unifiedService.isValidStatusTransition('resolvido', 'reaberto')).toBe(true);
    });

    test('should calculate SLA deadline', () => {
      const createdAt = new Date('2024-01-01T10:00:00Z');
      const deadline = unifiedService.calculateSLADeadline('P1', createdAt);

      const expectedDeadline = new Date(createdAt.getTime() + (60 * 60 * 1000)); // P1 = 1 hour
      expect(deadline).toEqual(expectedDeadline);
    });

    test('should get priority info', () => {
      const p1Info = unifiedService.getPriorityInfo('P1');
      expect(p1Info.label).toBe('Critical');
      expect(p1Info.color).toBe('#ef4444');

      const invalidInfo = unifiedService.getPriorityInfo('INVALID');
      expect(invalidInfo.label).toBe('Medium'); // Should default to P3
    });

    test('should get status info', () => {
      const statusInfo = unifiedService.getStatusInfo('aberto');
      expect(statusInfo.label).toBe('Aberto');
      expect(statusInfo.color).toBe('#6b7280');
    });
  });

  describe('Error Handling', () => {
    test('should handle IPC errors gracefully', async () => {
      mockIpcRenderer.invoke.mockRejectedValueOnce(new Error('IPC Error'));

      await expect(unifiedService.getEntry('invalid-id')).rejects.toThrow('IPC Error');
    });

    test('should handle unsuccessful IPC responses', async () => {
      mockIpcRenderer.invoke.mockResolvedValueOnce({
        success: false,
        error: { message: 'Entry not found' }
      });

      await expect(unifiedService.getEntry('not-found')).rejects.toThrow('Entry not found');
    });

    test('should throw error when IPC not available', async () => {
      // Temporarily remove IPC
      const originalApi = (global as any).window.api;
      (global as any).window.api = null;

      // Create new service instance
      const { unifiedService: newService } = require('../../renderer/services/UnifiedService');

      await expect(newService.getEntry('test')).rejects.toThrow('IPC not available');

      // Restore IPC
      (global as any).window.api = originalApi;
    });
  });
});