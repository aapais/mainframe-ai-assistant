import { BulkOperationsService, BulkTagOperation, BulkCategoryOperation } from '../../../src/services/BulkOperationsService';

// Mock the KnowledgeBaseService
jest.mock('../../../src/services/KnowledgeBaseService');

describe('BulkOperationsService', () => {
  let service: BulkOperationsService;
  let mockKnowledgeBaseService: any;

  beforeEach(() => {
    mockKnowledgeBaseService = {
      getEntry: jest.fn(),
      updateEntry: jest.fn(),
      findEntries: jest.fn(),
    };
    service = new BulkOperationsService(mockKnowledgeBaseService);
  });

  afterEach(() => {
    service.removeAllListeners();
    jest.clearAllMocks();
  });

  describe('addTagsToEntries', () => {
    it('should add tags to multiple entries successfully', async () => {
      const operation: BulkTagOperation = {
        entry_ids: ['entry1', 'entry2', 'entry3'],
        tags: ['new-tag1', 'new-tag2'],
        action: 'add',
        batch_size: 2,
      };

      // Mock existing entries
      mockKnowledgeBaseService.getEntry
        .mockResolvedValueOnce({ id: 'entry1', tags: ['existing-tag'] })
        .mockResolvedValueOnce({ id: 'entry2', tags: ['another-tag'] })
        .mockResolvedValueOnce({ id: 'entry3', tags: [] });

      mockKnowledgeBaseService.updateEntry.mockResolvedValue(true);

      const operationId = await service.addTagsToEntries(operation);

      expect(operationId).toBeDefined();

      // Wait for operation to complete
      await new Promise(resolve => {
        service.once('operation_completed', (event) => {
          if (event.operation_id === operationId) {
            expect(event.result.processed_entries).toBe(3);
            expect(event.result.successful_updates).toBe(3);
            expect(event.result.failed_updates).toBe(0);
            resolve(true);
          }
        });
      });

      // Verify updateEntry was called correctly
      expect(mockKnowledgeBaseService.updateEntry).toHaveBeenCalledWith('entry1', {
        tags: ['existing-tag', 'new-tag1', 'new-tag2']
      });
      expect(mockKnowledgeBaseService.updateEntry).toHaveBeenCalledWith('entry2', {
        tags: ['another-tag', 'new-tag1', 'new-tag2']
      });
      expect(mockKnowledgeBaseService.updateEntry).toHaveBeenCalledWith('entry3', {
        tags: ['new-tag1', 'new-tag2']
      });
    });

    it('should remove tags from entries', async () => {
      const operation: BulkTagOperation = {
        entry_ids: ['entry1', 'entry2'],
        tags: ['remove-me', 'also-remove'],
        action: 'remove',
        batch_size: 10,
      };

      mockKnowledgeBaseService.getEntry
        .mockResolvedValueOnce({
          id: 'entry1',
          tags: ['keep-this', 'remove-me', 'also-keep']
        })
        .mockResolvedValueOnce({
          id: 'entry2',
          tags: ['remove-me', 'also-remove', 'keep-this-too']
        });

      mockKnowledgeBaseService.updateEntry.mockResolvedValue(true);

      const operationId = await service.addTagsToEntries(operation);

      await new Promise(resolve => {
        service.once('operation_completed', () => resolve(true));
      });

      expect(mockKnowledgeBaseService.updateEntry).toHaveBeenCalledWith('entry1', {
        tags: ['keep-this', 'also-keep']
      });
      expect(mockKnowledgeBaseService.updateEntry).toHaveBeenCalledWith('entry2', {
        tags: ['keep-this-too']
      });
    });

    it('should replace tags on entries', async () => {
      const operation: BulkTagOperation = {
        entry_ids: ['entry1', 'entry2'],
        tags: ['replacement-tag1', 'replacement-tag2'],
        action: 'replace',
        batch_size: 10,
      };

      mockKnowledgeBaseService.getEntry
        .mockResolvedValueOnce({
          id: 'entry1',
          tags: ['old-tag1', 'old-tag2']
        })
        .mockResolvedValueOnce({
          id: 'entry2',
          tags: ['different-old-tag']
        });

      mockKnowledgeBaseService.updateEntry.mockResolvedValue(true);

      const operationId = await service.addTagsToEntries(operation);

      await new Promise(resolve => {
        service.once('operation_completed', () => resolve(true));
      });

      expect(mockKnowledgeBaseService.updateEntry).toHaveBeenCalledWith('entry1', {
        tags: ['replacement-tag1', 'replacement-tag2']
      });
      expect(mockKnowledgeBaseService.updateEntry).toHaveBeenCalledWith('entry2', {
        tags: ['replacement-tag1', 'replacement-tag2']
      });
    });

    it('should handle partial failures gracefully', async () => {
      const operation: BulkTagOperation = {
        entry_ids: ['entry1', 'entry2', 'entry3'],
        tags: ['new-tag'],
        action: 'add',
        batch_size: 1,
      };

      mockKnowledgeBaseService.getEntry
        .mockResolvedValueOnce({ id: 'entry1', tags: [] })
        .mockRejectedValueOnce(new Error('Entry not found'))
        .mockResolvedValueOnce({ id: 'entry3', tags: [] });

      mockKnowledgeBaseService.updateEntry
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      const operationId = await service.addTagsToEntries(operation);

      await new Promise(resolve => {
        service.once('operation_completed', (event) => {
          expect(event.result.processed_entries).toBe(3);
          expect(event.result.successful_updates).toBe(2);
          expect(event.result.failed_updates).toBe(1);
          expect(event.result.errors).toHaveLength(1);
          expect(event.result.errors[0].entry_id).toBe('entry2');
          resolve(true);
        });
      });
    });

    it('should emit progress events during operation', async () => {
      const operation: BulkTagOperation = {
        entry_ids: ['entry1', 'entry2', 'entry3'],
        tags: ['new-tag'],
        action: 'add',
        batch_size: 1,
      };

      mockKnowledgeBaseService.getEntry.mockResolvedValue({ tags: [] });
      mockKnowledgeBaseService.updateEntry.mockResolvedValue(true);

      const progressEvents: any[] = [];
      service.on('operation_progress', (event) => {
        progressEvents.push(event);
      });

      const operationId = await service.addTagsToEntries(operation);

      await new Promise(resolve => {
        service.once('operation_completed', () => resolve(true));
      });

      // Should have progress events for each processed entry
      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[0].operation_id).toBe(operationId);
      expect(progressEvents[0].progress.processed).toBeGreaterThan(0);
      expect(progressEvents[0].progress.total).toBe(3);
    });
  });

  describe('changeCategoryForEntries', () => {
    it('should change category for multiple entries', async () => {
      const operation: BulkCategoryOperation = {
        entry_ids: ['entry1', 'entry2', 'entry3'],
        new_category: 'VSAM',
        batch_size: 2,
      };

      mockKnowledgeBaseService.getEntry
        .mockResolvedValueOnce({ id: 'entry1', category: 'JCL' })
        .mockResolvedValueOnce({ id: 'entry2', category: 'DB2' })
        .mockResolvedValueOnce({ id: 'entry3', category: 'Batch' });

      mockKnowledgeBaseService.updateEntry.mockResolvedValue(true);

      const operationId = await service.changeCategoryForEntries(operation);

      await new Promise(resolve => {
        service.once('operation_completed', (event) => {
          expect(event.result.processed_entries).toBe(3);
          expect(event.result.successful_updates).toBe(3);
          resolve(true);
        });
      });

      expect(mockKnowledgeBaseService.updateEntry).toHaveBeenCalledWith('entry1', {
        category: 'VSAM'
      });
      expect(mockKnowledgeBaseService.updateEntry).toHaveBeenCalledWith('entry2', {
        category: 'VSAM'
      });
      expect(mockKnowledgeBaseService.updateEntry).toHaveBeenCalledWith('entry3', {
        category: 'VSAM'
      });
    });

    it('should only update entries with different categories when specified', async () => {
      const operation: BulkCategoryOperation = {
        entry_ids: ['entry1', 'entry2', 'entry3'],
        new_category: 'VSAM',
        only_if_different: true,
        batch_size: 10,
      };

      mockKnowledgeBaseService.getEntry
        .mockResolvedValueOnce({ id: 'entry1', category: 'JCL' })
        .mockResolvedValueOnce({ id: 'entry2', category: 'VSAM' }) // Already VSAM
        .mockResolvedValueOnce({ id: 'entry3', category: 'DB2' });

      mockKnowledgeBaseService.updateEntry.mockResolvedValue(true);

      const operationId = await service.changeCategoryForEntries(operation);

      await new Promise(resolve => {
        service.once('operation_completed', (event) => {
          expect(event.result.processed_entries).toBe(3);
          expect(event.result.successful_updates).toBe(2); // Only entry1 and entry3
          expect(event.result.skipped_entries).toBe(1); // entry2 was skipped
          resolve(true);
        });
      });

      expect(mockKnowledgeBaseService.updateEntry).toHaveBeenCalledTimes(2);
      expect(mockKnowledgeBaseService.updateEntry).not.toHaveBeenCalledWith('entry2', expect.anything());
    });
  });

  describe('getOperationStatus', () => {
    it('should return current operation status', async () => {
      const operation: BulkTagOperation = {
        entry_ids: ['entry1', 'entry2'],
        tags: ['test-tag'],
        action: 'add',
        batch_size: 1,
      };

      mockKnowledgeBaseService.getEntry.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ tags: [] }), 100))
      );
      mockKnowledgeBaseService.updateEntry.mockResolvedValue(true);

      const operationId = await service.addTagsToEntries(operation);

      // Check status while operation is running
      const status = service.getOperationStatus(operationId);
      expect(status).toMatchObject({
        id: operationId,
        status: 'running',
        progress: expect.objectContaining({
          total: 2,
          processed: expect.any(Number),
        }),
        started_at: expect.any(Date),
      });

      // Wait for completion
      await new Promise(resolve => {
        service.once('operation_completed', () => resolve(true));
      });

      const finalStatus = service.getOperationStatus(operationId);
      expect(finalStatus?.status).toBe('completed');
    });

    it('should return null for non-existent operation', () => {
      const status = service.getOperationStatus('non-existent-id');
      expect(status).toBeNull();
    });
  });

  describe('cancelOperation', () => {
    it('should cancel running operation', async () => {
      const operation: BulkTagOperation = {
        entry_ids: Array.from({length: 100}, (_, i) => `entry${i}`), // Large batch
        tags: ['test-tag'],
        action: 'add',
        batch_size: 1,
      };

      mockKnowledgeBaseService.getEntry.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ tags: [] }), 50))
      );
      mockKnowledgeBaseService.updateEntry.mockResolvedValue(true);

      const operationId = await service.addTagsToEntries(operation);

      // Cancel after a short delay
      setTimeout(() => {
        service.cancelOperation(operationId);
      }, 150);

      await new Promise(resolve => {
        service.once('operation_cancelled', (event) => {
          expect(event.operation_id).toBe(operationId);
          expect(event.progress.processed).toBeLessThan(100);
          resolve(true);
        });
      });

      const status = service.getOperationStatus(operationId);
      expect(status?.status).toBe('cancelled');
    });

    it('should not affect completed operations', async () => {
      const operation: BulkTagOperation = {
        entry_ids: ['entry1'],
        tags: ['test-tag'],
        action: 'add',
        batch_size: 1,
      };

      mockKnowledgeBaseService.getEntry.mockResolvedValue({ tags: [] });
      mockKnowledgeBaseService.updateEntry.mockResolvedValue(true);

      const operationId = await service.addTagsToEntries(operation);

      await new Promise(resolve => {
        service.once('operation_completed', () => resolve(true));
      });

      const cancelResult = service.cancelOperation(operationId);
      expect(cancelResult).toBe(false); // Cannot cancel completed operation
    });
  });

  describe('rollbackOperation', () => {
    it('should rollback completed operation', async () => {
      const operation: BulkTagOperation = {
        entry_ids: ['entry1', 'entry2'],
        tags: ['added-tag'],
        action: 'add',
        batch_size: 10,
      };

      // Mock original states
      const originalEntry1 = { id: 'entry1', tags: ['original-tag1'] };
      const originalEntry2 = { id: 'entry2', tags: ['original-tag2'] };

      mockKnowledgeBaseService.getEntry
        .mockResolvedValueOnce(originalEntry1)
        .mockResolvedValueOnce(originalEntry2)
        // For rollback
        .mockResolvedValueOnce({ id: 'entry1', tags: ['original-tag1', 'added-tag'] })
        .mockResolvedValueOnce({ id: 'entry2', tags: ['original-tag2', 'added-tag'] });

      mockKnowledgeBaseService.updateEntry.mockResolvedValue(true);

      const operationId = await service.addTagsToEntries(operation);

      await new Promise(resolve => {
        service.once('operation_completed', () => resolve(true));
      });

      // Perform rollback
      const rollbackResult = await service.rollbackOperation(operationId);

      expect(rollbackResult.successful_rollbacks).toBe(2);
      expect(rollbackResult.failed_rollbacks).toBe(0);

      // Verify rollback calls
      expect(mockKnowledgeBaseService.updateEntry).toHaveBeenCalledWith('entry1', {
        tags: ['original-tag1']
      });
      expect(mockKnowledgeBaseService.updateEntry).toHaveBeenCalledWith('entry2', {
        tags: ['original-tag2']
      });
    });

    it('should handle rollback failures gracefully', async () => {
      const operation: BulkTagOperation = {
        entry_ids: ['entry1'],
        tags: ['added-tag'],
        action: 'add',
        batch_size: 10,
      };

      mockKnowledgeBaseService.getEntry
        .mockResolvedValueOnce({ tags: [] })
        .mockRejectedValueOnce(new Error('Entry not found during rollback'));

      mockKnowledgeBaseService.updateEntry
        .mockResolvedValueOnce(true) // Original operation
        .mockRejectedValueOnce(new Error('Rollback failed')); // Rollback failure

      const operationId = await service.addTagsToEntries(operation);

      await new Promise(resolve => {
        service.once('operation_completed', () => resolve(true));
      });

      const rollbackResult = await service.rollbackOperation(operationId);

      expect(rollbackResult.successful_rollbacks).toBe(0);
      expect(rollbackResult.failed_rollbacks).toBe(1);
      expect(rollbackResult.errors).toHaveLength(1);
    });

    it('should reject rollback of non-existent operation', async () => {
      await expect(service.rollbackOperation('non-existent-id'))
        .rejects.toThrow('Operation not found');
    });

    it('should reject rollback of running operation', async () => {
      const operation: BulkTagOperation = {
        entry_ids: ['entry1', 'entry2'],
        tags: ['test-tag'],
        action: 'add',
        batch_size: 1,
      };

      mockKnowledgeBaseService.getEntry.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ tags: [] }), 100))
      );
      mockKnowledgeBaseService.updateEntry.mockResolvedValue(true);

      const operationId = await service.addTagsToEntries(operation);

      // Try to rollback while operation is still running
      await expect(service.rollbackOperation(operationId))
        .rejects.toThrow('Cannot rollback running operation');

      // Cleanup
      service.cancelOperation(operationId);
    });
  });

  describe('getActiveOperations', () => {
    it('should return list of active operations', async () => {
      const operation1: BulkTagOperation = {
        entry_ids: ['entry1'],
        tags: ['tag1'],
        action: 'add',
        batch_size: 1,
      };

      const operation2: BulkTagOperation = {
        entry_ids: ['entry2'],
        tags: ['tag2'],
        action: 'add',
        batch_size: 1,
      };

      mockKnowledgeBaseService.getEntry.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ tags: [] }), 100))
      );
      mockKnowledgeBaseService.updateEntry.mockResolvedValue(true);

      const operationId1 = await service.addTagsToEntries(operation1);
      const operationId2 = await service.addTagsToEntries(operation2);

      const activeOps = service.getActiveOperations();
      expect(activeOps).toHaveLength(2);
      expect(activeOps.map(op => op.id)).toContain(operationId1);
      expect(activeOps.map(op => op.id)).toContain(operationId2);

      // Cleanup
      service.cancelOperation(operationId1);
      service.cancelOperation(operationId2);
    });

    it('should not include completed operations', async () => {
      const operation: BulkTagOperation = {
        entry_ids: ['entry1'],
        tags: ['tag1'],
        action: 'add',
        batch_size: 1,
      };

      mockKnowledgeBaseService.getEntry.mockResolvedValue({ tags: [] });
      mockKnowledgeBaseService.updateEntry.mockResolvedValue(true);

      const operationId = await service.addTagsToEntries(operation);

      // Check active operations before completion
      let activeOps = service.getActiveOperations();
      expect(activeOps.some(op => op.id === operationId)).toBe(true);

      await new Promise(resolve => {
        service.once('operation_completed', () => resolve(true));
      });

      // Check active operations after completion
      activeOps = service.getActiveOperations();
      expect(activeOps.some(op => op.id === operationId)).toBe(false);
    });
  });

  describe('validation and error handling', () => {
    it('should validate bulk tag operations', async () => {
      await expect(service.addTagsToEntries({
        entry_ids: [], // Empty array
        tags: ['tag1'],
        action: 'add',
        batch_size: 10,
      })).rejects.toThrow('Entry IDs cannot be empty');

      await expect(service.addTagsToEntries({
        entry_ids: ['entry1'],
        tags: [], // Empty tags
        action: 'add',
        batch_size: 10,
      })).rejects.toThrow('Tags cannot be empty');

      await expect(service.addTagsToEntries({
        entry_ids: ['entry1'],
        tags: ['tag1'],
        action: 'add',
        batch_size: 0, // Invalid batch size
      })).rejects.toThrow('Batch size must be greater than 0');
    });

    it('should validate bulk category operations', async () => {
      await expect(service.changeCategoryForEntries({
        entry_ids: [],
        new_category: 'VSAM',
        batch_size: 10,
      })).rejects.toThrow('Entry IDs cannot be empty');

      await expect(service.changeCategoryForEntries({
        entry_ids: ['entry1'],
        new_category: '', // Empty category
        batch_size: 10,
      })).rejects.toThrow('Category cannot be empty');
    });

    it('should handle database connection errors', async () => {
      const operation: BulkTagOperation = {
        entry_ids: ['entry1'],
        tags: ['tag1'],
        action: 'add',
        batch_size: 1,
      };

      mockKnowledgeBaseService.getEntry.mockRejectedValue(new Error('Database connection failed'));

      const operationId = await service.addTagsToEntries(operation);

      await new Promise(resolve => {
        service.once('operation_completed', (event) => {
          expect(event.result.failed_updates).toBe(1);
          expect(event.result.errors[0].error.message).toBe('Database connection failed');
          resolve(true);
        });
      });
    });
  });

  describe('performance and memory management', () => {
    it('should process large batches efficiently', async () => {
      const largeEntryList = Array.from({length: 1000}, (_, i) => `entry${i}`);
      const operation: BulkTagOperation = {
        entry_ids: largeEntryList,
        tags: ['bulk-tag'],
        action: 'add',
        batch_size: 50,
      };

      mockKnowledgeBaseService.getEntry.mockResolvedValue({ tags: [] });
      mockKnowledgeBaseService.updateEntry.mockResolvedValue(true);

      const startTime = Date.now();
      const operationId = await service.addTagsToEntries(operation);

      await new Promise(resolve => {
        service.once('operation_completed', (event) => {
          const duration = Date.now() - startTime;

          expect(event.result.processed_entries).toBe(1000);
          expect(event.result.successful_updates).toBe(1000);
          expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

          resolve(true);
        });
      });
    });

    it('should clean up completed operations from memory', async () => {
      const operation: BulkTagOperation = {
        entry_ids: ['entry1'],
        tags: ['tag1'],
        action: 'add',
        batch_size: 1,
      };

      mockKnowledgeBaseService.getEntry.mockResolvedValue({ tags: [] });
      mockKnowledgeBaseService.updateEntry.mockResolvedValue(true);

      const operationId = await service.addTagsToEntries(operation);

      await new Promise(resolve => {
        service.once('operation_completed', () => resolve(true));
      });

      // Simulate cleanup after retention period
      (service as any).cleanupCompletedOperations(0); // 0 retention time for testing

      const status = service.getOperationStatus(operationId);
      expect(status).toBeNull(); // Should be cleaned up
    });
  });
});