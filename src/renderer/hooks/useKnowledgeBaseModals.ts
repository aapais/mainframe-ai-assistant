/**
 * Knowledge Base Modals Hook
 * Manages all CRUD modal operations with state management and error handling
 */

import { useState, useCallback, useRef } from 'react';
import { KBEntry, CreateKBEntry, UpdateKBEntry } from '../../backend/core/interfaces/ServiceInterfaces';
import { knowledgeBaseService } from '../services/KnowledgeBaseService';

interface NotificationState {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
}

interface LoadingStates {
  creating: boolean;
  updating: boolean;
  deleting: boolean;
  archiving: boolean;
  duplicating: boolean;
  loadingHistory: boolean;
}

interface ModalStates {
  addEntry: boolean;
  editEntry: boolean;
  deleteConfirm: boolean;
  entryHistory: boolean;
}

interface UseKnowledgeBaseModalsReturn {
  // Modal states
  modals: ModalStates;

  // Loading states
  loading: LoadingStates;

  // Current entry being operated on
  currentEntry: KBEntry | null;

  // Entry history data
  entryHistory: any[];

  // Notifications
  notifications: NotificationState[];

  // Modal control functions
  openAddEntryModal: () => void;
  openEditEntryModal: (entry: KBEntry) => void;
  openDeleteConfirmModal: (entry: KBEntry) => void;
  openEntryHistoryModal: (entry: KBEntry) => void;
  closeModals: () => void;

  // CRUD operations
  createEntry: (data: CreateKBEntry) => Promise<void>;
  updateEntry: (id: string, data: UpdateKBEntry) => Promise<void>;
  deleteEntry: () => Promise<void>;
  archiveEntry: () => Promise<void>;
  duplicateEntry: (entry: KBEntry) => Promise<void>;

  // Utility functions
  addNotification: (notification: Omit<NotificationState, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;

  // Error handling
  handleError: (error: Error, operation: string) => void;
}

export const useKnowledgeBaseModals = (): UseKnowledgeBaseModalsReturn => {
  // Modal states
  const [modals, setModals] = useState<ModalStates>({
    addEntry: false,
    editEntry: false,
    deleteConfirm: false,
    entryHistory: false
  });

  // Loading states
  const [loading, setLoading] = useState<LoadingStates>({
    creating: false,
    updating: false,
    deleting: false,
    archiving: false,
    duplicating: false,
    loadingHistory: false
  });

  // Current entry and data
  const [currentEntry, setCurrentEntry] = useState<KBEntry | null>(null);
  const [entryHistory, setEntryHistory] = useState<any[]>([]);

  // Notifications
  const [notifications, setNotifications] = useState<NotificationState[]>([]);

  // Refs for tracking
  const notificationIdRef = useRef(0);

  // Modal control functions
  const openAddEntryModal = useCallback(() => {
    setModals(prev => ({ ...prev, addEntry: true }));
    setCurrentEntry(null);
  }, []);

  const openEditEntryModal = useCallback((entry: KBEntry) => {
    setCurrentEntry(entry);
    setModals(prev => ({ ...prev, editEntry: true }));
  }, []);

  const openDeleteConfirmModal = useCallback((entry: KBEntry) => {
    setCurrentEntry(entry);
    setModals(prev => ({ ...prev, deleteConfirm: true }));
  }, []);

  const openEntryHistoryModal = useCallback(async (entry: KBEntry) => {
    setCurrentEntry(entry);
    setLoading(prev => ({ ...prev, loadingHistory: true }));

    try {
      const history = await knowledgeBaseService.getEntryHistory(entry.id);
      setEntryHistory(history);
      setModals(prev => ({ ...prev, entryHistory: true }));
    } catch (error) {
      handleError(error as Error, 'loading entry history');
    } finally {
      setLoading(prev => ({ ...prev, loadingHistory: false }));
    }
  }, []);

  const closeModals = useCallback(() => {
    setModals({
      addEntry: false,
      editEntry: false,
      deleteConfirm: false,
      entryHistory: false
    });
    setCurrentEntry(null);
    setEntryHistory([]);
  }, []);

  // Notification functions
  const addNotification = useCallback((notification: Omit<NotificationState, 'id'>) => {
    const id = `notification-${++notificationIdRef.current}`;
    const newNotification: NotificationState = {
      ...notification,
      id,
      duration: notification.duration || 5000
    };

    setNotifications(prev => [...prev, newNotification]);

    // Auto-remove notification after duration
    if (newNotification.duration) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Error handling
  const handleError = useCallback((error: Error, operation: string) => {
    console.error(`Error ${operation}:`, error);

    addNotification({
      type: 'error',
      title: 'Operation Failed',
      message: `Failed to ${operation}: ${error.message}`,
      duration: 7000
    });
  }, [addNotification]);

  // CRUD operations
  const createEntry = useCallback(async (data: CreateKBEntry) => {
    setLoading(prev => ({ ...prev, creating: true }));

    try {
      const newEntry = await knowledgeBaseService.createEntry(data);

      addNotification({
        type: 'success',
        title: 'Entry Created',
        message: `"${newEntry.title}" has been successfully created.`,
        duration: 4000
      });

      // Record usage for analytics
      await knowledgeBaseService.recordUsage(newEntry.id, 'created', {
        category: newEntry.category,
        tagCount: newEntry.tags?.length || 0
      });

      closeModals();
    } catch (error) {
      handleError(error as Error, 'create entry');
      throw error; // Re-throw so the modal can handle it
    } finally {
      setLoading(prev => ({ ...prev, creating: false }));
    }
  }, [addNotification, handleError, closeModals]);

  const updateEntry = useCallback(async (id: string, data: UpdateKBEntry) => {
    setLoading(prev => ({ ...prev, updating: true }));

    try {
      const updatedEntry = await knowledgeBaseService.updateEntry(id, data);

      addNotification({
        type: 'success',
        title: 'Entry Updated',
        message: `"${updatedEntry.title}" has been successfully updated.`,
        duration: 4000
      });

      // Record usage for analytics
      await knowledgeBaseService.recordUsage(id, 'updated', {
        fieldsChanged: Object.keys(data).length
      });

      closeModals();
    } catch (error) {
      handleError(error as Error, 'update entry');
      throw error;
    } finally {
      setLoading(prev => ({ ...prev, updating: false }));
    }
  }, [addNotification, handleError, closeModals]);

  const deleteEntry = useCallback(async () => {
    if (!currentEntry) return;

    setLoading(prev => ({ ...prev, deleting: true }));

    try {
      await knowledgeBaseService.deleteEntry(currentEntry.id);

      addNotification({
        type: 'success',
        title: 'Entry Deleted',
        message: `"${currentEntry.title}" has been permanently deleted.`,
        duration: 4000
      });

      // Record usage for analytics
      await knowledgeBaseService.recordUsage(currentEntry.id, 'deleted', {
        category: currentEntry.category,
        usageCount: currentEntry.usage_count
      });

      closeModals();
    } catch (error) {
      handleError(error as Error, 'delete entry');
      throw error;
    } finally {
      setLoading(prev => ({ ...prev, deleting: false }));
    }
  }, [currentEntry, addNotification, handleError, closeModals]);

  const archiveEntry = useCallback(async () => {
    if (!currentEntry) return;

    setLoading(prev => ({ ...prev, archiving: true }));

    try {
      const archivedEntry = await knowledgeBaseService.archiveEntry(currentEntry.id);

      addNotification({
        type: 'success',
        title: 'Entry Archived',
        message: `"${archivedEntry.title}" has been moved to the archive.`,
        duration: 4000
      });

      // Record usage for analytics
      await knowledgeBaseService.recordUsage(currentEntry.id, 'archived', {
        category: currentEntry.category
      });

      closeModals();
    } catch (error) {
      handleError(error as Error, 'archive entry');
      throw error;
    } finally {
      setLoading(prev => ({ ...prev, archiving: false }));
    }
  }, [currentEntry, addNotification, handleError, closeModals]);

  const duplicateEntry = useCallback(async (entry: KBEntry) => {
    setLoading(prev => ({ ...prev, duplicating: true }));

    try {
      const duplicatedEntry = await knowledgeBaseService.duplicateEntry(entry);

      addNotification({
        type: 'success',
        title: 'Entry Duplicated',
        message: `"${duplicatedEntry.title}" has been created as a copy.`,
        duration: 4000
      });

      // Record usage for analytics
      await knowledgeBaseService.recordUsage(entry.id, 'duplicated', {
        newEntryId: duplicatedEntry.id
      });

      // Optionally open the edit modal for the new entry
      setTimeout(() => {
        openEditEntryModal(duplicatedEntry);
      }, 500);

    } catch (error) {
      handleError(error as Error, 'duplicate entry');
      throw error;
    } finally {
      setLoading(prev => ({ ...prev, duplicating: false }));
    }
  }, [addNotification, handleError, openEditEntryModal]);

  return {
    // Modal states
    modals,

    // Loading states
    loading,

    // Current entry and data
    currentEntry,
    entryHistory,

    // Notifications
    notifications,

    // Modal control functions
    openAddEntryModal,
    openEditEntryModal,
    openDeleteConfirmModal,
    openEntryHistoryModal,
    closeModals,

    // CRUD operations
    createEntry,
    updateEntry,
    deleteEntry,
    archiveEntry,
    duplicateEntry,

    // Utility functions
    addNotification,
    removeNotification,
    clearNotifications,

    // Error handling
    handleError
  };
};

export default useKnowledgeBaseModals;