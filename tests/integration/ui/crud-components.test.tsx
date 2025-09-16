/**
 * CRUD Components Integration Tests
 * Tests KBEntryDetail, EditKBEntryModal, DeleteConfirmationDialog
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { KBEntryDetail } from '../../../src/renderer/components/KB/KBEntryDetail';
import { EditKBEntryModal } from '../../../src/renderer/components/modals/EditKBEntryModal';
import { DeleteConfirmationDialog } from '../../../src/renderer/components/dialogs/DeleteConfirmationDialog';

// Mock IPC communication
const mockIpcRenderer = {
  invoke: jest.fn(),
  on: jest.fn(),
  removeAllListeners: jest.fn(),
};

Object.defineProperty(window, 'electronAPI', {
  value: mockIpcRenderer,
  writable: true,
});

// Mock KB entry data
const mockKBEntry = {
  id: 'kb-entry-123',
  title: 'Mainframe COBOL Best Practices',
  content: 'This document outlines the best practices for COBOL development...',
  summary: 'Guidelines for effective COBOL programming',
  tags: ['COBOL', 'Mainframe', 'Best Practices'],
  category: 'Development',
  author: 'John Smith',
  lastModified: '2024-01-15T10:30:00Z',
  version: 2,
  status: 'published',
  metadata: {
    wordCount: 1250,
    readingTime: 5,
    difficulty: 'intermediate',
  },
  attachments: [
    { id: 'att-1', name: 'example.cbl', size: 2048, type: 'text/plain' },
    { id: 'att-2', name: 'diagram.png', size: 102400, type: 'image/png' },
  ],
};

describe('CRUD Components Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIpcRenderer.invoke.mockImplementation((channel, ...args) => {
      switch (channel) {
        case 'kb:get-entry':
          return Promise.resolve(mockKBEntry);
        case 'kb:update-entry':
          return Promise.resolve({ success: true, entry: { ...mockKBEntry, ...args[1] } });
        case 'kb:delete-entry':
          return Promise.resolve({ success: true });
        case 'kb:get-attachments':
          return Promise.resolve(mockKBEntry.attachments);
        default:
          return Promise.resolve();
      }
    });
  });

  describe('KBEntryDetail Component', () => {
    test('should display entry details correctly', async () => {
      render(<KBEntryDetail entryId="kb-entry-123" />);

      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('kb:get-entry', 'kb-entry-123');
      });

      // Check title and content
      expect(screen.getByText('Mainframe COBOL Best Practices')).toBeInTheDocument();
      expect(screen.getByText(/This document outlines the best practices/)).toBeInTheDocument();

      // Check metadata
      expect(screen.getByText('John Smith')).toBeInTheDocument();
      expect(screen.getByText('Development')).toBeInTheDocument();
      expect(screen.getByText('Version 2')).toBeInTheDocument();

      // Check tags
      expect(screen.getByText('COBOL')).toBeInTheDocument();
      expect(screen.getByText('Mainframe')).toBeInTheDocument();
      expect(screen.getByText('Best Practices')).toBeInTheDocument();
    });

    test('should display reading time and word count', async () => {
      render(<KBEntryDetail entryId="kb-entry-123" />);

      await waitFor(() => {
        expect(screen.getByText('1,250 words')).toBeInTheDocument();
        expect(screen.getByText('5 min read')).toBeInTheDocument();
        expect(screen.getByText('Intermediate')).toBeInTheDocument();
      });
    });

    test('should display attachments with proper file info', async () => {
      render(<KBEntryDetail entryId="kb-entry-123" />);

      await waitFor(() => {
        expect(screen.getByText('example.cbl')).toBeInTheDocument();
        expect(screen.getByText('2.0 KB')).toBeInTheDocument();
        expect(screen.getByText('diagram.png')).toBeInTheDocument();
        expect(screen.getByText('100.0 KB')).toBeInTheDocument();
      });
    });

    test('should handle edit button click', async () => {
      const onEdit = jest.fn();
      render(<KBEntryDetail entryId="kb-entry-123" onEdit={onEdit} />);

      await waitFor(() => {
        const editBtn = screen.getByRole('button', { name: /edit/i });
        fireEvent.click(editBtn);
      });

      expect(onEdit).toHaveBeenCalledWith(mockKBEntry);
    });

    test('should handle delete button click', async () => {
      const onDelete = jest.fn();
      render(<KBEntryDetail entryId="kb-entry-123" onDelete={onDelete} />);

      await waitFor(() => {
        const deleteBtn = screen.getByRole('button', { name: /delete/i });
        fireEvent.click(deleteBtn);
      });

      expect(onDelete).toHaveBeenCalledWith(mockKBEntry);
    });

    test('should display version history button', async () => {
      render(<KBEntryDetail entryId="kb-entry-123" />);

      await waitFor(() => {
        const versionBtn = screen.getByRole('button', { name: /version history/i });
        expect(versionBtn).toBeInTheDocument();
      });
    });
  });

  describe('EditKBEntryModal Component', () => {
    test('should populate form with existing entry data', async () => {
      render(
        <EditKBEntryModal
          isOpen={true}
          onClose={jest.fn()}
          onSave={jest.fn()}
          entry={mockKBEntry}
        />
      );

      await waitFor(() => {
        const titleInput = screen.getByDisplayValue('Mainframe COBOL Best Practices');
        const contentTextarea = screen.getByDisplayValue(/This document outlines the best practices/);
        const categorySelect = screen.getByDisplayValue('Development');

        expect(titleInput).toBeInTheDocument();
        expect(contentTextarea).toBeInTheDocument();
        expect(categorySelect).toBeInTheDocument();
      });
    });

    test('should validate required fields', async () => {
      render(
        <EditKBEntryModal
          isOpen={true}
          onClose={jest.fn()}
          onSave={jest.fn()}
          entry={mockKBEntry}
        />
      );

      await waitFor(() => {
        const titleInput = screen.getByDisplayValue('Mainframe COBOL Best Practices');
        fireEvent.change(titleInput, { target: { value: '' } });
      });

      const saveBtn = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(screen.getByText(/title is required/i)).toBeInTheDocument();
      });
    });

    test('should handle tag addition and removal', async () => {
      render(
        <EditKBEntryModal
          isOpen={true}
          onClose={jest.fn()}
          onSave={jest.fn()}
          entry={mockKBEntry}
        />
      );

      await waitFor(() => {
        // Check existing tags
        expect(screen.getByText('COBOL')).toBeInTheDocument();
        expect(screen.getByText('Mainframe')).toBeInTheDocument();

        // Add new tag
        const tagInput = screen.getByTestId('tag-input');
        fireEvent.change(tagInput, { target: { value: 'Enterprise' } });
        fireEvent.keyDown(tagInput, { key: 'Enter' });

        expect(screen.getByText('Enterprise')).toBeInTheDocument();

        // Remove existing tag
        const removeTagBtn = screen.getByTestId('remove-tag-COBOL');
        fireEvent.click(removeTagBtn);

        expect(screen.queryByText('COBOL')).not.toBeInTheDocument();
      });
    });

    test('should handle file attachment upload', async () => {
      render(
        <EditKBEntryModal
          isOpen={true}
          onClose={jest.fn()}
          onSave={jest.fn()}
          entry={mockKBEntry}
        />
      );

      await waitFor(() => {
        const fileInput = screen.getByTestId('file-upload-input');
        const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });

        fireEvent.change(fileInput, { target: { files: [mockFile] } });
      });

      await waitFor(() => {
        expect(screen.getByText('test.txt')).toBeInTheDocument();
      });
    });

    test('should save entry with updated data', async () => {
      const onSave = jest.fn();

      render(
        <EditKBEntryModal
          isOpen={true}
          onClose={jest.fn()}
          onSave={onSave}
          entry={mockKBEntry}
        />
      );

      await waitFor(() => {
        const titleInput = screen.getByDisplayValue('Mainframe COBOL Best Practices');
        fireEvent.change(titleInput, { target: { value: 'Updated COBOL Best Practices' } });

        const contentTextarea = screen.getByDisplayValue(/This document outlines the best practices/);
        fireEvent.change(contentTextarea, { target: { value: 'Updated content...' } });
      });

      const saveBtn = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Updated COBOL Best Practices',
            content: 'Updated content...',
          })
        );
      });
    });

    test('should handle draft saving', async () => {
      render(
        <EditKBEntryModal
          isOpen={true}
          onClose={jest.fn()}
          onSave={jest.fn()}
          entry={mockKBEntry}
        />
      );

      await waitFor(() => {
        const titleInput = screen.getByDisplayValue('Mainframe COBOL Best Practices');
        fireEvent.change(titleInput, { target: { value: 'Draft Title' } });

        const saveDraftBtn = screen.getByRole('button', { name: /save draft/i });
        fireEvent.click(saveDraftBtn);
      });

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
        'kb:save-draft',
        expect.objectContaining({
          title: 'Draft Title',
          status: 'draft',
        })
      );
    });

    test('should show unsaved changes warning', async () => {
      const onClose = jest.fn();

      render(
        <EditKBEntryModal
          isOpen={true}
          onClose={onClose}
          onSave={jest.fn()}
          entry={mockKBEntry}
        />
      );

      await waitFor(() => {
        const titleInput = screen.getByDisplayValue('Mainframe COBOL Best Practices');
        fireEvent.change(titleInput, { target: { value: 'Changed Title' } });

        const closeBtn = screen.getByRole('button', { name: /cancel/i });
        fireEvent.click(closeBtn);
      });

      await waitFor(() => {
        expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /discard changes/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /keep editing/i })).toBeInTheDocument();
      });
    });
  });

  describe('DeleteConfirmationDialog Component', () => {
    test('should display entry information to be deleted', () => {
      render(
        <DeleteConfirmationDialog
          isOpen={true}
          onClose={jest.fn()}
          onConfirm={jest.fn()}
          entry={mockKBEntry}
        />
      );

      expect(screen.getByText('Mainframe COBOL Best Practices')).toBeInTheDocument();
      expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument();
    });

    test('should require confirmation input for destructive action', async () => {
      render(
        <DeleteConfirmationDialog
          isOpen={true}
          onClose={jest.fn()}
          onConfirm={jest.fn()}
          entry={mockKBEntry}
        />
      );

      const deleteBtn = screen.getByRole('button', { name: /delete entry/i });
      expect(deleteBtn).toBeDisabled();

      const confirmInput = screen.getByPlaceholderText(/type "DELETE" to confirm/i);
      fireEvent.change(confirmInput, { target: { value: 'DELETE' } });

      expect(deleteBtn).not.toBeDisabled();
    });

    test('should handle deletion confirmation', async () => {
      const onConfirm = jest.fn();

      render(
        <DeleteConfirmationDialog
          isOpen={true}
          onClose={jest.fn()}
          onConfirm={onConfirm}
          entry={mockKBEntry}
        />
      );

      const confirmInput = screen.getByPlaceholderText(/type "DELETE" to confirm/i);
      fireEvent.change(confirmInput, { target: { value: 'DELETE' } });

      const deleteBtn = screen.getByRole('button', { name: /delete entry/i });
      fireEvent.click(deleteBtn);

      expect(onConfirm).toHaveBeenCalledWith(mockKBEntry);
    });

    test('should show related entries warning', () => {
      const entryWithRelations = {
        ...mockKBEntry,
        relatedEntries: ['kb-entry-456', 'kb-entry-789'],
      };

      render(
        <DeleteConfirmationDialog
          isOpen={true}
          onClose={jest.fn()}
          onConfirm={jest.fn()}
          entry={entryWithRelations}
        />
      );

      expect(screen.getByText(/this entry is referenced by 2 other entries/i)).toBeInTheDocument();
    });

    test('should handle cancellation', () => {
      const onClose = jest.fn();

      render(
        <DeleteConfirmationDialog
          isOpen={true}
          onClose={onClose}
          onConfirm={jest.fn()}
          entry={mockKBEntry}
        />
      );

      const cancelBtn = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelBtn);

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Integration Flow Testing', () => {
    test('should handle complete edit-save-delete workflow', async () => {
      const TestWrapper = () => {
        const [showEdit, setShowEdit] = React.useState(false);
        const [showDelete, setShowDelete] = React.useState(false);
        const [currentEntry, setCurrentEntry] = React.useState(mockKBEntry);

        return (
          <div>
            <KBEntryDetail
              entryId="kb-entry-123"
              onEdit={() => setShowEdit(true)}
              onDelete={() => setShowDelete(true)}
            />
            {showEdit && (
              <EditKBEntryModal
                isOpen={true}
                onClose={() => setShowEdit(false)}
                onSave={(updatedEntry) => {
                  setCurrentEntry(updatedEntry);
                  setShowEdit(false);
                }}
                entry={currentEntry}
              />
            )}
            {showDelete && (
              <DeleteConfirmationDialog
                isOpen={true}
                onClose={() => setShowDelete(false)}
                onConfirm={() => setShowDelete(false)}
                entry={currentEntry}
              />
            )}
          </div>
        );
      };

      render(<TestWrapper />);

      // Wait for entry to load
      await waitFor(() => {
        expect(screen.getByText('Mainframe COBOL Best Practices')).toBeInTheDocument();
      });

      // Test edit flow
      const editBtn = screen.getByRole('button', { name: /edit/i });
      fireEvent.click(editBtn);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        const titleInput = screen.getByDisplayValue('Mainframe COBOL Best Practices');
        fireEvent.change(titleInput, { target: { value: 'Updated Title' } });

        const saveBtn = screen.getByRole('button', { name: /save/i });
        fireEvent.click(saveBtn);
      });

      // Modal should close, entry should update
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility and UX', () => {
    test('should have proper ARIA labels and keyboard support', async () => {
      render(<KBEntryDetail entryId="kb-entry-123" />);

      await waitFor(() => {
        const editBtn = screen.getByRole('button', { name: /edit/i });
        const deleteBtn = screen.getByRole('button', { name: /delete/i });

        expect(editBtn).toHaveAttribute('aria-label');
        expect(deleteBtn).toHaveAttribute('aria-label');

        // Test keyboard navigation
        editBtn.focus();
        fireEvent.keyDown(editBtn, { key: 'Tab' });
        expect(deleteBtn).toHaveFocus();
      });
    });

    test('should support screen reader announcements', async () => {
      render(<KBEntryDetail entryId="kb-entry-123" />);

      await waitFor(() => {
        const liveRegion = screen.getByTestId('sr-announcements');
        expect(liveRegion).toHaveAttribute('aria-live', 'polite');
      });
    });
  });

  describe('Accenture Branding', () => {
    test('should apply Accenture styling to action buttons', async () => {
      render(<KBEntryDetail entryId="kb-entry-123" />);

      await waitFor(() => {
        const editBtn = screen.getByRole('button', { name: /edit/i });
        const computedStyle = window.getComputedStyle(editBtn);
        expect(computedStyle.borderColor).toBe('rgb(161, 0, 255)'); // #A100FF
      });
    });
  });
});