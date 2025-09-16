/**
 * KB Manager and Form Component Interaction Tests
 *
 * Tests for knowledge base management interface interactions,
 * including ComprehensiveKBManager, form components, and modal interactions.
 *
 * @author UI Testing Specialist
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest } from '@jest/globals';

import { ComprehensiveKBManager } from '../../../src/components/KB/ComprehensiveKBManager';
import { EnhancedSmartEntryForm } from '../../../src/components/forms/EnhancedSmartEntryForm';
import { ConflictResolutionModal } from '../../../src/components/forms/ConflictResolutionModal';
import { VersionHistoryModal } from '../../../src/components/KB/VersionHistoryModal';

import {
  ComponentInteractionTester,
  ComponentCommunicationTester
} from './ComponentInteractionTestSuite';

// Mock KB Database
const createMockDB = () => ({
  async search() { return []; },
  async add() { return 'new-id'; },
  async update() { return true; },
  async delete() { return true; },
  async get() { return null; },
  async getAll() { return []; },
  async getStats() { return { totalEntries: 0, searchesToday: 0, averageSuccessRate: 0 }; }
});

// Mock data
const mockKBEntry = {
  id: '1',
  title: 'Test Entry',
  problem: 'Test problem description',
  solution: 'Test solution description',
  category: 'Test' as const,
  tags: ['test', 'example'],
  usage_count: 5,
  created_at: '2024-01-01',
  updated_at: '2024-01-01'
};

const mockVersionHistory = {
  entryId: '1',
  versions: [
    {
      version: 1,
      entry: mockKBEntry,
      createdAt: '2024-01-01',
      createdBy: 'user1',
      changeSummary: 'Initial version'
    }
  ],
  totalVersions: 1
};

describe('KB Manager and Form Component Interactions', () => {
  let tester: ComponentInteractionTester;
  let communicationTester: ComponentCommunicationTester;
  let user: ReturnType<typeof userEvent.setup>;
  let mockDB: any;

  beforeEach(() => {
    tester = new ComponentInteractionTester();
    communicationTester = new ComponentCommunicationTester();
    user = userEvent.setup();
    mockDB = createMockDB();
  });

  afterEach(() => {
    tester.resetMocks();
    jest.clearAllMocks();
  });

  describe('KB Manager Entry Creation Flow', () => {
    it('should handle entry creation workflow', async () => {
      const onEntryCreate = tester.createMock('onEntryCreate');
      const mockAdd = jest.fn().mockResolvedValue('new-entry-id');
      mockDB.add = mockAdd;

      render(
        <ComprehensiveKBManager
          db={mockDB}
          onEntryCreate={onEntryCreate}
          data-testid="kb-manager"
        />
      );

      // Click new entry button
      const newEntryButton = screen.getByRole('button', { name: /new entry/i });
      await user.click(newEntryButton);

      // Assert create form modal opened
      const modal = screen.getByRole('dialog');
      expect(modal).toBeInTheDocument();

      // Fill out form
      const titleInput = screen.getByLabelText(/title/i);
      const problemInput = screen.getByLabelText(/problem/i);
      const solutionInput = screen.getByLabelText(/solution/i);

      await user.type(titleInput, 'New Test Entry');
      await user.type(problemInput, 'New problem description');
      await user.type(solutionInput, 'New solution description');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /create entry/i });
      await user.click(submitButton);

      // Assert entry creation
      await waitFor(() => {
        expect(mockAdd).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'New Test Entry',
            problem: 'New problem description',
            solution: 'New solution description'
          })
        );
      });

      await waitFor(() => {
        expect(onEntryCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'new-entry-id',
            title: 'New Test Entry'
          })
        );
      });
    });

    it('should handle form validation errors', async () => {
      render(
        <ComprehensiveKBManager
          db={mockDB}
          data-testid="kb-manager"
        />
      );

      // Open create form
      const newEntryButton = screen.getByRole('button', { name: /new entry/i });
      await user.click(newEntryButton);

      // Try to submit empty form
      const submitButton = screen.getByRole('button', { name: /create entry/i });
      await user.click(submitButton);

      // Assert validation errors displayed
      await waitFor(() => {
        expect(screen.getByText(/title is required/i)).toBeInTheDocument();
        expect(screen.getByText(/problem is required/i)).toBeInTheDocument();
        expect(screen.getByText(/solution is required/i)).toBeInTheDocument();
      });
    });

    it('should handle form cancellation', async () => {
      render(
        <ComprehensiveKBManager
          db={mockDB}
          data-testid="kb-manager"
        />
      );

      // Open create form
      const newEntryButton = screen.getByRole('button', { name: /new entry/i });
      await user.click(newEntryButton);

      // Cancel form
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Assert modal closed
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Entry Editing Flow', () => {
    it('should handle entry edit workflow', async () => {
      const onEntryUpdate = tester.createMock('onEntryUpdate');
      const mockUpdate = jest.fn().mockResolvedValue(true);
      const mockGetAll = jest.fn().mockResolvedValue([mockKBEntry]);

      mockDB.update = mockUpdate;
      mockDB.getAll = mockGetAll;

      render(
        <ComprehensiveKBManager
          db={mockDB}
          onEntryUpdate={onEntryUpdate}
          data-testid="kb-manager"
        />
      );

      // Wait for entries to load
      await waitFor(() => {
        expect(screen.getByText('Test Entry')).toBeInTheDocument();
      });

      // Click edit button (assuming it exists in the entry list)
      const editButton = screen.getByRole('button', { name: /edit.*test entry/i });
      await user.click(editButton);

      // Assert edit modal opened
      const modal = screen.getByRole('dialog');
      expect(modal).toBeInTheDocument();

      // Update title
      const titleInput = screen.getByDisplayValue('Test Entry');
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Test Entry');

      // Submit changes
      const updateButton = screen.getByRole('button', { name: /update/i });
      await user.click(updateButton);

      // Assert update called
      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith(
          '1',
          expect.objectContaining({
            title: 'Updated Test Entry'
          })
        );
      });

      await waitFor(() => {
        expect(onEntryUpdate).toHaveBeenCalled();
      });
    });

    it('should handle version control during editing', async () => {
      const mockVersionService = {
        createVersion: jest.fn().mockResolvedValue(true),
        getVersionHistory: jest.fn().mockResolvedValue(mockVersionHistory)
      };

      const mockUpdate = jest.fn().mockResolvedValue(true);
      const mockGetAll = jest.fn().mockResolvedValue([mockKBEntry]);

      mockDB.update = mockUpdate;
      mockDB.getAll = mockGetAll;

      render(
        <ComprehensiveKBManager
          db={mockDB}
          enableAdvancedFeatures={true}
          data-testid="kb-manager"
        />
      );

      // Wait for entries to load
      await waitFor(() => {
        expect(screen.getByText('Test Entry')).toBeInTheDocument();
      });

      // Open version history
      const versionButton = screen.getByRole('button', { name: /version.*history/i });
      await user.click(versionButton);

      // Assert version history modal opened
      const versionModal = screen.getByRole('dialog', { name: /version history/i });
      expect(versionModal).toBeInTheDocument();
    });
  });

  describe('Batch Operations', () => {
    it('should handle batch selection and operations', async () => {
      const onBatchOperation = tester.createMock('onBatchOperation');
      const mockGetAll = jest.fn().mockResolvedValue([
        mockKBEntry,
        { ...mockKBEntry, id: '2', title: 'Second Entry' }
      ]);

      mockDB.getAll = mockGetAll;

      render(
        <ComprehensiveKBManager
          db={mockDB}
          onBatchOperation={onBatchOperation}
          data-testid="kb-manager"
        />
      );

      // Wait for entries to load
      await waitFor(() => {
        expect(screen.getByText('Test Entry')).toBeInTheDocument();
        expect(screen.getByText('Second Entry')).toBeInTheDocument();
      });

      // Select entries using checkboxes
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]); // First entry
      await user.click(checkboxes[1]); // Second entry

      // Assert batch toolbar appeared
      const batchToolbar = screen.getByTestId('batch-toolbar');
      expect(batchToolbar).toBeInTheDocument();

      // Perform batch delete
      const batchDeleteButton = screen.getByRole('button', { name: /delete selected/i });
      await user.click(batchDeleteButton);

      // Confirm deletion
      const confirmButton = screen.getByRole('button', { name: /delete all/i });
      await user.click(confirmButton);

      // Assert batch operation callback
      await waitFor(() => {
        expect(onBatchOperation).toHaveBeenCalledWith('delete', 2);
      });
    });

    it('should handle batch export', async () => {
      const mockGetAll = jest.fn().mockResolvedValue([mockKBEntry]);
      mockDB.getAll = mockGetAll;

      // Mock URL.createObjectURL
      global.URL.createObjectURL = jest.fn().mockReturnValue('blob:mock-url');
      global.URL.revokeObjectURL = jest.fn();

      render(
        <ComprehensiveKBManager
          db={mockDB}
          data-testid="kb-manager"
        />
      );

      // Wait for entries to load
      await waitFor(() => {
        expect(screen.getByText('Test Entry')).toBeInTheDocument();
      });

      // Select entry
      const checkbox = screen.getAllByRole('checkbox')[0];
      await user.click(checkbox);

      // Export selected
      const exportButton = screen.getByRole('button', { name: /export selected/i });
      await user.click(exportButton);

      // Assert download was triggered
      await waitFor(() => {
        expect(global.URL.createObjectURL).toHaveBeenCalled();
      });
    });
  });

  describe('Smart Form Interactions', () => {
    it('should handle AI-powered form assistance', async () => {
      const onAIAssist = tester.createMock('onAIAssist');

      render(
        <EnhancedSmartEntryForm
          title="Create Entry"
          submitLabel="Create"
          onSubmit={() => {}}
          onCancel={() => {}}
          enableAIAssistance={true}
          onAIAssist={onAIAssist}
          data-testid="smart-form"
        />
      );

      // Type problem description
      const problemInput = screen.getByLabelText(/problem/i);
      await user.type(problemInput, 'User cannot access VSAM file');

      // Click AI assist button
      const aiButton = screen.getByRole('button', { name: /ai assist/i });
      await user.click(aiButton);

      // Assert AI assistance was requested
      expect(onAIAssist).toHaveBeenCalledWith(
        expect.objectContaining({
          problem: 'User cannot access VSAM file'
        })
      );
    });

    it('should handle conflict resolution', async () => {
      const onResolveConflict = tester.createMock('onResolveConflict');

      const conflictData = {
        entryId: '1',
        currentVersion: { ...mockKBEntry, title: 'Current Title' },
        conflictingVersion: { ...mockKBEntry, title: 'Conflicting Title' },
        conflictFields: ['title']
      };

      render(
        <ConflictResolutionModal
          conflict={conflictData}
          onResolve={onResolveConflict}
          onCancel={() => {}}
          isOpen={true}
          data-testid="conflict-modal"
        />
      );

      // Choose resolution strategy
      const keepCurrentButton = screen.getByRole('button', { name: /keep current/i });
      await user.click(keepCurrentButton);

      // Assert conflict resolution
      expect(onResolveConflict).toHaveBeenCalledWith(
        expect.objectContaining({
          strategy: 'keep-current',
          resolvedEntry: conflictData.currentVersion
        })
      );
    });
  });

  describe('Modal Interactions', () => {
    it('should handle modal stacking and focus management', async () => {
      const mockGetAll = jest.fn().mockResolvedValue([mockKBEntry]);
      mockDB.getAll = mockGetAll;

      render(
        <ComprehensiveKBManager
          db={mockDB}
          enableAdvancedFeatures={true}
          data-testid="kb-manager"
        />
      );

      // Wait for entries to load
      await waitFor(() => {
        expect(screen.getByText('Test Entry')).toBeInTheDocument();
      });

      // Open first modal (edit)
      const editButton = screen.getByRole('button', { name: /edit.*test entry/i });
      await user.click(editButton);

      const editModal = screen.getByRole('dialog');
      expect(editModal).toBeInTheDocument();

      // Open second modal (version history) from within edit modal
      const versionButton = screen.getByRole('button', { name: /version history/i });
      await user.click(versionButton);

      // Assert both modals present
      const modals = screen.getAllByRole('dialog');
      expect(modals).toHaveLength(2);

      // Close version history modal with escape
      await user.keyboard('{Escape}');

      // Assert only edit modal remains
      await waitFor(() => {
        const remainingModals = screen.getAllByRole('dialog');
        expect(remainingModals).toHaveLength(1);
      });
    });

    it('should handle modal backdrop clicks', async () => {
      render(
        <ComprehensiveKBManager
          db={mockDB}
          data-testid="kb-manager"
        />
      );

      // Open create modal
      const newEntryButton = screen.getByRole('button', { name: /new entry/i });
      await user.click(newEntryButton);

      const modal = screen.getByRole('dialog');
      expect(modal).toBeInTheDocument();

      // Click modal overlay (backdrop)
      const overlay = screen.getByTestId('modal-overlay');
      await user.click(overlay);

      // Assert modal closed
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Real-time Updates and Synchronization', () => {
    it('should handle real-time entry updates', async () => {
      const mockGetAll = jest.fn().mockResolvedValue([mockKBEntry]);
      mockDB.getAll = mockGetAll;

      const { rerender } = render(
        <ComprehensiveKBManager
          db={mockDB}
          realTimeUpdates={true}
          autoRefresh={100}
          data-testid="kb-manager"
        />
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Test Entry')).toBeInTheDocument();
      });

      // Simulate external update to the entry
      const updatedEntry = { ...mockKBEntry, title: 'Updated by External Source' };
      mockGetAll.mockResolvedValue([updatedEntry]);

      // Wait for auto-refresh
      await waitFor(() => {
        expect(screen.getByText('Updated by External Source')).toBeInTheDocument();
      }, { timeout: 200 });
    });

    it('should handle concurrent editing conflicts', async () => {
      const onError = tester.createMock('onError');

      // Mock update to throw conflict error
      const mockUpdate = jest.fn().mockRejectedValue(
        new Error('Conflict: Entry has been modified by another user')
      );

      const mockGetAll = jest.fn().mockResolvedValue([mockKBEntry]);

      mockDB.update = mockUpdate;
      mockDB.getAll = mockGetAll;

      render(
        <ComprehensiveKBManager
          db={mockDB}
          onError={onError}
          data-testid="kb-manager"
        />
      );

      // Simulate editing conflict scenario
      await waitFor(() => {
        expect(screen.getByText('Test Entry')).toBeInTheDocument();
      });

      const editButton = screen.getByRole('button', { name: /edit.*test entry/i });
      await user.click(editButton);

      const titleInput = screen.getByDisplayValue('Test Entry');
      await user.clear(titleInput);
      await user.type(titleInput, 'Conflicting Update');

      const updateButton = screen.getByRole('button', { name: /update/i });
      await user.click(updateButton);

      // Assert error handling
      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('Conflict')
          })
        );
      });
    });
  });

  describe('Keyboard Shortcuts and Accessibility', () => {
    it('should handle keyboard shortcuts for KB management', async () => {
      const mockGetAll = jest.fn().mockResolvedValue([mockKBEntry]);
      mockDB.getAll = mockGetAll;

      render(
        <ComprehensiveKBManager
          db={mockDB}
          data-testid="kb-manager"
        />
      );

      // Test Ctrl+N for new entry
      await user.keyboard('{Control>}n{/Control}');

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Close modal with Escape
      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      // Test Ctrl+F for search focus
      await user.keyboard('{Control>}f{/Control}');

      const searchInput = screen.getByRole('textbox', { name: /search/i });
      expect(searchInput).toHaveFocus();
    });

    it('should provide proper ARIA labels and descriptions', async () => {
      render(
        <ComprehensiveKBManager
          db={mockDB}
          data-testid="kb-manager"
        />
      );

      const manager = screen.getByTestId('kb-manager');
      expect(manager).toHaveAttribute('role', 'main');

      const newEntryButton = screen.getByRole('button', { name: /new entry/i });
      expect(newEntryButton).toHaveAttribute('title', expect.stringContaining('Ctrl+N'));

      const searchInput = screen.getByRole('textbox', { name: /search/i });
      expect(searchInput).toHaveAttribute('aria-describedby');
    });
  });
});