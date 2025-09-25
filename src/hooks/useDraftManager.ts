/**
 * Draft Manager Hook
 *
 * Comprehensive draft management system with:
 * - Auto-save with configurable intervals
 * - Draft versioning and recovery
 * - Conflict detection and resolution
 * - Local storage persistence
 * - Visual feedback for save states
 * - Background synchronization
 *
 * @author Swarm Coordinator
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { debounce } from 'lodash';
import { v4 as uuidv4 } from 'uuid';

// ========================
// Types & Interfaces
// ========================

export interface DraftData {
  id?: string;
  title: string;
  problem: string;
  solution: string;
  category: string;
  tags: string[];
  [key: string]: any;
}

export interface DraftVersion {
  id: string;
  timestamp: Date;
  data: DraftData;
  autoSave: boolean;
  editor: string;
  checksum: string;
}

export interface DraftMetadata {
  id: string;
  entryId?: string; // If editing existing entry
  created: Date;
  updated: Date;
  versions: DraftVersion[];
  isActive: boolean;
  editor: string;
  title: string;
}

export interface SaveState {
  status: 'idle' | 'saving' | 'saved' | 'error';
  lastSaved?: Date;
  error?: string;
  hasUnsavedChanges: boolean;
  conflictDetected: boolean;
}

export interface UseDraftManagerOptions {
  autoSaveInterval?: number; // milliseconds
  maxVersions?: number;
  enableConflictDetection?: boolean;
  storageKey?: string;
  editor?: string;
  onSave?: (data: DraftData) => Promise<void>;
  onError?: (error: Error) => void;
  onConflict?: (localVersion: DraftVersion, remoteVersion: DraftVersion) => void;
}

export interface UseDraftManagerReturn {
  // Draft data
  draftData: DraftData;
  saveState: SaveState;
  metadata: DraftMetadata | null;

  // Actions
  updateDraft: (updates: Partial<DraftData>) => void;
  saveDraft: () => Promise<void>;
  loadDraft: (draftId: string) => Promise<void>;
  createDraft: (initialData?: Partial<DraftData>) => void;
  deleteDraft: (draftId: string) => Promise<void>;

  // Versioning
  versions: DraftVersion[];
  restoreVersion: (versionId: string) => void;

  // Conflict resolution
  resolveConflict: (resolution: 'local' | 'remote' | 'merge') => void;

  // Utilities
  clearDraft: () => void;
  getDraftsList: () => DraftMetadata[];
  exportDraft: () => string;
  importDraft: (jsonData: string) => void;
}

// ========================
// Constants
// ========================

const DEFAULT_OPTIONS: Required<UseDraftManagerOptions> = {
  autoSaveInterval: 30000, // 30 seconds
  maxVersions: 10,
  enableConflictDetection: true,
  storageKey: 'kb-drafts',
  editor: 'User',
  onSave: async () => {},
  onError: () => {},
  onConflict: () => {},
};

const STORAGE_KEYS = {
  DRAFTS: 'kb-drafts',
  METADATA: 'kb-drafts-metadata',
  ACTIVE: 'kb-active-draft',
};

// ========================
// Hook Implementation
// ========================

export const useDraftManager = (options: UseDraftManagerOptions = {}): UseDraftManagerReturn => {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // State management
  const [draftData, setDraftData] = useState<DraftData>({
    title: '',
    problem: '',
    solution: '',
    category: '',
    tags: [],
  });

  const [saveState, setSaveState] = useState<SaveState>({
    status: 'idle',
    hasUnsavedChanges: false,
    conflictDetected: false,
  });

  const [metadata, setMetadata] = useState<DraftMetadata | null>(null);
  const [versions, setVersions] = useState<DraftVersion[]>([]);

  // Refs
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const lastSavedDataRef = useRef<string>('');
  const conflictVersionRef = useRef<DraftVersion | null>(null);

  // Generate checksum for data
  const generateChecksum = useCallback((data: DraftData): string => {
    return btoa(JSON.stringify(data)).slice(0, 16);
  }, []);

  // Load drafts from localStorage
  const loadFromStorage = useCallback((draftId: string): DraftMetadata | null => {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEYS.DRAFTS}-${draftId}`);
      if (!stored) return null;

      const parsed = JSON.parse(stored);
      return {
        ...parsed,
        created: new Date(parsed.created),
        updated: new Date(parsed.updated),
        versions: parsed.versions.map((v: any) => ({
          ...v,
          timestamp: new Date(v.timestamp),
        })),
      };
    } catch (error) {
      console.error('Failed to load draft from storage:', error);
      return null;
    }
  }, []);

  // Save draft to localStorage
  const saveToStorage = useCallback((metadata: DraftMetadata) => {
    try {
      localStorage.setItem(`${STORAGE_KEYS.DRAFTS}-${metadata.id}`, JSON.stringify(metadata));

      // Update metadata index
      const metadataList = getDraftsList();
      const existingIndex = metadataList.findIndex(m => m.id === metadata.id);

      if (existingIndex >= 0) {
        metadataList[existingIndex] = metadata;
      } else {
        metadataList.push(metadata);
      }

      localStorage.setItem(STORAGE_KEYS.METADATA, JSON.stringify(metadataList));
      localStorage.setItem(STORAGE_KEYS.ACTIVE, metadata.id);
    } catch (error) {
      console.error('Failed to save draft to storage:', error);
      opts.onError(error as Error);
    }
  }, []);

  // Get list of all drafts
  const getDraftsList = useCallback((): DraftMetadata[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.METADATA);
      if (!stored) return [];

      return JSON.parse(stored).map((m: any) => ({
        ...m,
        created: new Date(m.created),
        updated: new Date(m.updated),
      }));
    } catch (error) {
      console.error('Failed to load drafts list:', error);
      return [];
    }
  }, []);

  // Create new version
  const createVersion = useCallback(
    (data: DraftData, autoSave: boolean = false): DraftVersion => {
      return {
        id: uuidv4(),
        timestamp: new Date(),
        data: { ...data },
        autoSave,
        editor: opts.editor,
        checksum: generateChecksum(data),
      };
    },
    [opts.editor, generateChecksum]
  );

  // Update draft data
  const updateDraft = useCallback((updates: Partial<DraftData>) => {
    setDraftData(prev => ({ ...prev, ...updates }));
    setSaveState(prev => ({ ...prev, hasUnsavedChanges: true, status: 'idle' }));
  }, []);

  // Save draft
  const saveDraft = useCallback(async () => {
    if (!metadata) return;

    setSaveState(prev => ({ ...prev, status: 'saving' }));

    try {
      // Check for conflicts if enabled
      if (opts.enableConflictDetection && metadata.entryId) {
        const currentMetadata = loadFromStorage(metadata.id);
        if (currentMetadata && currentMetadata.updated > metadata.updated) {
          setSaveState(prev => ({ ...prev, conflictDetected: true }));
          conflictVersionRef.current = currentMetadata.versions[0];
          opts.onConflict(versions[0], currentMetadata.versions[0]);
          return;
        }
      }

      // Create new version
      const newVersion = createVersion(draftData, false);
      const updatedVersions = [newVersion, ...versions].slice(0, opts.maxVersions);

      // Update metadata
      const updatedMetadata: DraftMetadata = {
        ...metadata,
        updated: new Date(),
        versions: updatedVersions,
        title: draftData.title || 'Untitled Draft',
      };

      // Save to storage
      saveToStorage(updatedMetadata);

      // Update state
      setMetadata(updatedMetadata);
      setVersions(updatedVersions);
      setSaveState({
        status: 'saved',
        lastSaved: new Date(),
        hasUnsavedChanges: false,
        conflictDetected: false,
      });

      lastSavedDataRef.current = JSON.stringify(draftData);

      // Call external save handler
      await opts.onSave(draftData);
    } catch (error) {
      console.error('Failed to save draft:', error);
      setSaveState(prev => ({
        ...prev,
        status: 'error',
        error: (error as Error).message,
      }));
      opts.onError(error as Error);
    }
  }, [draftData, metadata, versions, opts, loadFromStorage, createVersion, saveToStorage]);

  // Auto-save functionality
  const autoSave = useCallback(async () => {
    if (!metadata || saveState.status === 'saving') return;

    const currentDataString = JSON.stringify(draftData);
    if (currentDataString === lastSavedDataRef.current) return;

    try {
      const autoSaveVersion = createVersion(draftData, true);
      const updatedVersions = [autoSaveVersion, ...versions].slice(0, opts.maxVersions);

      const updatedMetadata: DraftMetadata = {
        ...metadata,
        updated: new Date(),
        versions: updatedVersions,
        title: draftData.title || 'Untitled Draft',
      };

      saveToStorage(updatedMetadata);
      setMetadata(updatedMetadata);
      setVersions(updatedVersions);

      setSaveState(prev => ({
        ...prev,
        status: 'saved',
        lastSaved: new Date(),
        hasUnsavedChanges: false,
      }));

      lastSavedDataRef.current = currentDataString;
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, [draftData, metadata, versions, saveState, opts, createVersion, saveToStorage]);

  // Debounced auto-save
  const debouncedAutoSave = useMemo(() => debounce(autoSave, 2000), [autoSave]);

  // Set up auto-save interval
  useEffect(() => {
    if (saveState.hasUnsavedChanges && metadata) {
      debouncedAutoSave();

      if (autoSaveTimeoutRef.current) {
        clearInterval(autoSaveTimeoutRef.current);
      }

      autoSaveTimeoutRef.current = setInterval(() => {
        autoSave();
      }, opts.autoSaveInterval);
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearInterval(autoSaveTimeoutRef.current);
      }
    };
  }, [saveState.hasUnsavedChanges, metadata, opts.autoSaveInterval, autoSave, debouncedAutoSave]);

  // Load draft
  const loadDraft = useCallback(
    async (draftId: string) => {
      const loadedMetadata = loadFromStorage(draftId);
      if (!loadedMetadata) {
        throw new Error(`Draft ${draftId} not found`);
      }

      const latestVersion = loadedMetadata.versions[0];
      setDraftData(latestVersion.data);
      setMetadata(loadedMetadata);
      setVersions(loadedMetadata.versions);
      setSaveState({
        status: 'saved',
        lastSaved: latestVersion.timestamp,
        hasUnsavedChanges: false,
        conflictDetected: false,
      });

      lastSavedDataRef.current = JSON.stringify(latestVersion.data);
    },
    [loadFromStorage]
  );

  // Create new draft
  const createDraft = useCallback(
    (initialData: Partial<DraftData> = {}) => {
      const draftId = uuidv4();
      const now = new Date();

      const newData: DraftData = {
        title: '',
        problem: '',
        solution: '',
        category: '',
        tags: [],
        ...initialData,
      };

      const initialVersion = createVersion(newData, false);

      const newMetadata: DraftMetadata = {
        id: draftId,
        entryId: initialData.id,
        created: now,
        updated: now,
        versions: [initialVersion],
        isActive: true,
        editor: opts.editor,
        title: newData.title || 'New Draft',
      };

      setDraftData(newData);
      setMetadata(newMetadata);
      setVersions([initialVersion]);
      setSaveState({
        status: 'idle',
        hasUnsavedChanges: false,
        conflictDetected: false,
      });

      saveToStorage(newMetadata);
      lastSavedDataRef.current = JSON.stringify(newData);
    },
    [opts.editor, createVersion, saveToStorage]
  );

  // Delete draft
  const deleteDraft = useCallback(
    async (draftId: string) => {
      try {
        localStorage.removeItem(`${STORAGE_KEYS.DRAFTS}-${draftId}`);

        const metadataList = getDraftsList().filter(m => m.id !== draftId);
        localStorage.setItem(STORAGE_KEYS.METADATA, JSON.stringify(metadataList));

        if (metadata && metadata.id === draftId) {
          setMetadata(null);
          setDraftData({
            title: '',
            problem: '',
            solution: '',
            category: '',
            tags: [],
          });
          setVersions([]);
          setSaveState({
            status: 'idle',
            hasUnsavedChanges: false,
            conflictDetected: false,
          });
        }
      } catch (error) {
        console.error('Failed to delete draft:', error);
        opts.onError(error as Error);
      }
    },
    [metadata, getDraftsList, opts]
  );

  // Restore version
  const restoreVersion = useCallback(
    (versionId: string) => {
      const version = versions.find(v => v.id === versionId);
      if (!version) return;

      setDraftData(version.data);
      setSaveState(prev => ({ ...prev, hasUnsavedChanges: true }));
    },
    [versions]
  );

  // Resolve conflict
  const resolveConflict = useCallback((resolution: 'local' | 'remote' | 'merge') => {
    if (!conflictVersionRef.current) return;

    const remoteVersion = conflictVersionRef.current;

    switch (resolution) {
      case 'local':
        // Keep current data, just clear conflict
        break;
      case 'remote':
        setDraftData(remoteVersion.data);
        break;
      case 'merge':
        // Simple merge strategy - could be enhanced
        setDraftData(prev => ({
          ...prev,
          title: prev.title || remoteVersion.data.title,
          problem: prev.problem || remoteVersion.data.problem,
          solution: prev.solution || remoteVersion.data.solution,
          category: prev.category || remoteVersion.data.category,
          tags: Array.from(new Set([...prev.tags, ...remoteVersion.data.tags])),
        }));
        break;
    }

    setSaveState(prev => ({
      ...prev,
      conflictDetected: false,
      hasUnsavedChanges: resolution !== 'local',
    }));

    conflictVersionRef.current = null;
  }, []);

  // Clear current draft
  const clearDraft = useCallback(() => {
    setDraftData({
      title: '',
      problem: '',
      solution: '',
      category: '',
      tags: [],
    });
    setMetadata(null);
    setVersions([]);
    setSaveState({
      status: 'idle',
      hasUnsavedChanges: false,
      conflictDetected: false,
    });
    lastSavedDataRef.current = '';
  }, []);

  // Export draft as JSON
  const exportDraft = useCallback((): string => {
    if (!metadata) throw new Error('No active draft to export');

    return JSON.stringify(
      {
        metadata,
        versions,
        currentData: draftData,
      },
      null,
      2
    );
  }, [metadata, versions, draftData]);

  // Import draft from JSON
  const importDraft = useCallback(
    (jsonData: string) => {
      try {
        const imported = JSON.parse(jsonData);
        const importedMetadata = {
          ...imported.metadata,
          id: uuidv4(), // Generate new ID
          created: new Date(imported.metadata.created),
          updated: new Date(imported.metadata.updated),
          versions: imported.versions.map((v: any) => ({
            ...v,
            timestamp: new Date(v.timestamp),
          })),
        };

        setMetadata(importedMetadata);
        setVersions(importedMetadata.versions);
        setDraftData(imported.currentData);
        setSaveState({
          status: 'idle',
          hasUnsavedChanges: true,
          conflictDetected: false,
        });

        saveToStorage(importedMetadata);
      } catch (error) {
        console.error('Failed to import draft:', error);
        opts.onError(error as Error);
      }
    },
    [saveToStorage, opts]
  );

  // Load active draft on mount
  useEffect(() => {
    const activeDraftId = localStorage.getItem(STORAGE_KEYS.ACTIVE);
    if (activeDraftId) {
      loadDraft(activeDraftId).catch(() => {
        // If loading fails, create a new draft
        createDraft();
      });
    } else {
      createDraft();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearInterval(autoSaveTimeoutRef.current);
      }
      debouncedAutoSave.cancel();
    };
  }, [debouncedAutoSave]);

  return {
    draftData,
    saveState,
    metadata,
    versions,
    updateDraft,
    saveDraft,
    loadDraft,
    createDraft,
    deleteDraft,
    restoreVersion,
    resolveConflict,
    clearDraft,
    getDraftsList,
    exportDraft,
    importDraft,
  };
};

export default useDraftManager;
