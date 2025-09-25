/**
 * useLayoutState Hook
 *
 * Layout state persistence and management
 * Handles saving/loading layout configurations with validation
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { BreakpointKey } from './useResponsive';

// =========================
// TYPE DEFINITIONS
// =========================

export interface LayoutConfig {
  /** Unique layout identifier */
  id: string;
  /** Layout name */
  name: string;
  /** Layout description */
  description?: string;
  /** Created timestamp */
  createdAt: number;
  /** Last modified timestamp */
  modifiedAt: number;
  /** Layout version for migration */
  version: string;
  /** Panel configurations */
  panels: PanelConfig[];
  /** Grid settings */
  grid?: GridConfig;
  /** Responsive overrides */
  responsive?: Partial<Record<BreakpointKey, Partial<LayoutConfig>>>;
  /** Custom metadata */
  metadata?: Record<string, any>;
}

export interface PanelConfig {
  /** Panel identifier */
  id: string;
  /** Panel type */
  type: string;
  /** Panel title */
  title?: string;
  /** Position and size */
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Grid position (if using grid layout) */
  gridPosition?: {
    colStart: number;
    rowStart: number;
    colSpan: number;
    rowSpan: number;
  };
  /** Panel state */
  state: {
    visible: boolean;
    collapsed: boolean;
    pinned: boolean;
    zIndex: number;
  };
  /** Panel-specific configuration */
  config?: Record<string, any>;
  /** Responsive visibility */
  responsive?: Partial<Record<BreakpointKey, boolean>>;
}

export interface GridConfig {
  /** Number of columns */
  columns: number;
  /** Row height */
  rowHeight: number | 'auto';
  /** Gap size */
  gap: number;
  /** Enable auto-placement */
  autoPlace: boolean;
  /** Dense packing */
  dense: boolean;
}

export interface LayoutStateOptions {
  /** Storage key prefix */
  storageKey?: string;
  /** Enable automatic saving */
  autoSave?: boolean;
  /** Auto-save debounce delay */
  autoSaveDelay?: number;
  /** Default layout configuration */
  defaultLayout?: Partial<LayoutConfig>;
  /** Layout validation function */
  validator?: (layout: LayoutConfig) => boolean;
  /** Migration functions for version updates */
  migrations?: Record<string, (layout: any) => LayoutConfig>;
  /** Maximum number of saved layouts */
  maxLayouts?: number;
  /** Enable compression for storage */
  compress?: boolean;
  /** Callback when layout changes */
  onChange?: (layout: LayoutConfig) => void;
  /** Callback when layout is saved */
  onSave?: (layout: LayoutConfig) => void;
  /** Callback when layout is loaded */
  onLoad?: (layout: LayoutConfig) => void;
}

export interface UseLayoutStateReturn {
  /** Current layout configuration */
  layout: LayoutConfig | null;
  /** All saved layouts */
  savedLayouts: LayoutConfig[];
  /** Whether layout has unsaved changes */
  hasUnsavedChanges: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
  /** Create new layout */
  createLayout: (name: string, description?: string) => LayoutConfig;
  /** Save current layout */
  saveLayout: (layout?: LayoutConfig) => Promise<void>;
  /** Load layout by ID */
  loadLayout: (layoutId: string) => Promise<LayoutConfig | null>;
  /** Delete layout */
  deleteLayout: (layoutId: string) => Promise<void>;
  /** Duplicate layout */
  duplicateLayout: (layoutId: string, newName: string) => Promise<LayoutConfig>;
  /** Update current layout */
  updateLayout: (updates: Partial<LayoutConfig>) => void;
  /** Update panel configuration */
  updatePanel: (panelId: string, updates: Partial<PanelConfig>) => void;
  /** Add panel to layout */
  addPanel: (panel: Omit<PanelConfig, 'id'> & { id?: string }) => void;
  /** Remove panel from layout */
  removePanel: (panelId: string) => void;
  /** Reset to default layout */
  resetLayout: () => void;
  /** Export layout as JSON */
  exportLayout: (layoutId?: string) => string;
  /** Import layout from JSON */
  importLayout: (json: string) => Promise<LayoutConfig>;
  /** Clear all saved layouts */
  clearAllLayouts: () => Promise<void>;
}

// =========================
// DEFAULT CONFIGURATION
// =========================

const DEFAULT_LAYOUT_CONFIG: Partial<LayoutConfig> = {
  version: '1.0.0',
  panels: [],
  grid: {
    columns: 12,
    rowHeight: 'auto',
    gap: 16,
    autoPlace: true,
    dense: false,
  },
  metadata: {},
};

const CURRENT_VERSION = '1.0.0';

// =========================
// UTILITY FUNCTIONS
// =========================

/**
 * Generate unique ID
 */
const generateId = (): string => {
  return `layout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Validate layout configuration
 */
const validateLayout = (layout: any): layout is LayoutConfig => {
  return (
    layout &&
    typeof layout.id === 'string' &&
    typeof layout.name === 'string' &&
    typeof layout.version === 'string' &&
    Array.isArray(layout.panels) &&
    typeof layout.createdAt === 'number' &&
    typeof layout.modifiedAt === 'number'
  );
};

/**
 * Compress JSON string
 */
const compressJson = (json: string): string => {
  // Simple compression: remove whitespace and common patterns
  return json
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}[\]:,])\s*/g, '$1')
    .trim();
};

/**
 * Decompress JSON string
 */
const decompressJson = (compressed: string): string => {
  return compressed; // No actual decompression needed for simple approach
};

/**
 * Get storage key
 */
const getStorageKey = (baseKey: string, suffix: string = ''): string => {
  return suffix ? `${baseKey}_${suffix}` : baseKey;
};

/**
 * Load from localStorage
 */
const loadFromStorage = (key: string, compress: boolean = false): any => {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;

    const json = compress ? decompressJson(stored) : stored;
    return JSON.parse(json);
  } catch (error) {
    console.warn(`Failed to load from storage (${key}):`, error);
    return null;
  }
};

/**
 * Save to localStorage
 */
const saveToStorage = (key: string, data: any, compress: boolean = false): void => {
  if (typeof window === 'undefined') return;

  try {
    const json = JSON.stringify(data);
    const toStore = compress ? compressJson(json) : json;
    localStorage.setItem(key, toStore);
  } catch (error) {
    console.warn(`Failed to save to storage (${key}):`, error);
  }
};

/**
 * Remove from localStorage
 */
const removeFromStorage = (key: string): void => {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn(`Failed to remove from storage (${key}):`, error);
  }
};

/**
 * Get all layout keys from localStorage
 */
const getLayoutKeys = (storageKey: string): string[] => {
  if (typeof window === 'undefined') return [];

  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`${storageKey}_layout_`)) {
        keys.push(key);
      }
    }
    return keys;
  } catch (error) {
    console.warn('Failed to get layout keys:', error);
    return [];
  }
};

/**
 * Debounce function
 */
const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// =========================
// MAIN HOOK
// =========================

/**
 * useLayoutState Hook
 *
 * Manages layout state persistence and operations
 *
 * @param options - Configuration options
 * @returns Layout state utilities
 *
 * @example
 * ```tsx
 * const {
 *   layout,
 *   savedLayouts,
 *   createLayout,
 *   saveLayout,
 *   loadLayout,
 *   updatePanel
 * } = useLayoutState({
 *   autoSave: true,
 *   defaultLayout: {
 *     name: 'Default Layout',
 *     panels: [...]
 *   }
 * });
 * ```
 */
export const useLayoutState = (options: LayoutStateOptions = {}): UseLayoutStateReturn => {
  const {
    storageKey = 'mainframe-kb-layouts',
    autoSave = true,
    autoSaveDelay = 1000,
    defaultLayout,
    validator = validateLayout,
    migrations = {},
    maxLayouts = 10,
    compress = false,
    onChange,
    onSave,
    onLoad,
  } = options;

  // State
  const [layout, setLayout] = useState<LayoutConfig | null>(null);
  const [savedLayouts, setSavedLayouts] = useState<LayoutConfig[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  const onLoadRef = useRef(onLoad);

  // Update callback refs
  onChangeRef.current = onChange;
  onSaveRef.current = onSave;
  onLoadRef.current = onLoad;

  // Auto-save debounced function
  const debouncedAutoSave = useMemo(() => {
    return debounce((layoutToSave: LayoutConfig) => {
      if (autoSave) {
        saveLayout(layoutToSave);
      }
    }, autoSaveDelay);
  }, [autoSave, autoSaveDelay]);

  // Load saved layouts from storage
  const loadSavedLayouts = useCallback(async (): Promise<LayoutConfig[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const layoutKeys = getLayoutKeys(storageKey);
      const layouts: LayoutConfig[] = [];

      for (const key of layoutKeys) {
        const stored = loadFromStorage(key, compress);
        if (stored && validator(stored)) {
          // Apply migrations if needed
          let migratedLayout = stored;
          if (stored.version !== CURRENT_VERSION && migrations[stored.version]) {
            migratedLayout = migrations[stored.version](stored);
          }

          layouts.push(migratedLayout);
        }
      }

      // Sort by modified date (most recent first)
      layouts.sort((a, b) => b.modifiedAt - a.modifiedAt);

      setSavedLayouts(layouts);
      return layouts;
    } catch (error) {
      const errorMsg = `Failed to load layouts: ${error instanceof Error ? error.message : 'Unknown error'}`;
      setError(errorMsg);
      console.error(errorMsg, error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [storageKey, compress, validator, migrations]);

  // Initialize hook
  useEffect(() => {
    const initialize = async () => {
      const layouts = await loadSavedLayouts();

      // Load last used layout or create default
      if (layouts.length > 0) {
        const lastLayout = layouts[0];
        setLayout(lastLayout);
        onLoadRef.current?.(lastLayout);
      } else if (defaultLayout) {
        const newLayout = createLayout(defaultLayout.name || 'Default Layout');
        Object.assign(newLayout, defaultLayout);
        setLayout(newLayout);
      }
    };

    initialize();
  }, [loadSavedLayouts, defaultLayout]);

  // Create new layout
  const createLayout = useCallback((name: string, description?: string): LayoutConfig => {
    const now = Date.now();
    const newLayout: LayoutConfig = {
      id: generateId(),
      name,
      description,
      createdAt: now,
      modifiedAt: now,
      ...DEFAULT_LAYOUT_CONFIG,
      version: CURRENT_VERSION,
    } as LayoutConfig;

    return newLayout;
  }, []);

  // Save layout
  const saveLayout = useCallback(
    async (layoutToSave?: LayoutConfig): Promise<void> => {
      const targetLayout = layoutToSave || layout;
      if (!targetLayout) return;

      try {
        const updatedLayout: LayoutConfig = {
          ...targetLayout,
          modifiedAt: Date.now(),
        };

        // Save to storage
        const key = getStorageKey(storageKey, targetLayout.id);
        saveToStorage(key, updatedLayout, compress);

        // Update state
        if (targetLayout === layout) {
          setLayout(updatedLayout);
          setHasUnsavedChanges(false);
        }

        // Update saved layouts list
        setSavedLayouts(prev => {
          const filtered = prev.filter(l => l.id !== updatedLayout.id);
          const updated = [updatedLayout, ...filtered];

          // Limit number of saved layouts
          if (updated.length > maxLayouts) {
            const toRemove = updated.slice(maxLayouts);
            toRemove.forEach(l => {
              const key = getStorageKey(storageKey, l.id);
              removeFromStorage(key);
            });
            return updated.slice(0, maxLayouts);
          }

          return updated;
        });

        onSaveRef.current?.(updatedLayout);
      } catch (error) {
        const errorMsg = `Failed to save layout: ${error instanceof Error ? error.message : 'Unknown error'}`;
        setError(errorMsg);
        console.error(errorMsg, error);
      }
    },
    [layout, storageKey, compress, maxLayouts]
  );

  // Load layout
  const loadLayout = useCallback(
    async (layoutId: string): Promise<LayoutConfig | null> => {
      try {
        const key = getStorageKey(storageKey, layoutId);
        const stored = loadFromStorage(key, compress);

        if (stored && validator(stored)) {
          // Apply migrations if needed
          let migratedLayout = stored;
          if (stored.version !== CURRENT_VERSION && migrations[stored.version]) {
            migratedLayout = migrations[stored.version](stored);
          }

          setLayout(migratedLayout);
          setHasUnsavedChanges(false);
          onLoadRef.current?.(migratedLayout);

          return migratedLayout;
        }

        throw new Error('Invalid layout data');
      } catch (error) {
        const errorMsg = `Failed to load layout: ${error instanceof Error ? error.message : 'Unknown error'}`;
        setError(errorMsg);
        console.error(errorMsg, error);
        return null;
      }
    },
    [storageKey, compress, validator, migrations]
  );

  // Delete layout
  const deleteLayout = useCallback(
    async (layoutId: string): Promise<void> => {
      try {
        const key = getStorageKey(storageKey, layoutId);
        removeFromStorage(key);

        setSavedLayouts(prev => prev.filter(l => l.id !== layoutId));

        // If current layout was deleted, reset
        if (layout?.id === layoutId) {
          setLayout(null);
          setHasUnsavedChanges(false);
        }
      } catch (error) {
        const errorMsg = `Failed to delete layout: ${error instanceof Error ? error.message : 'Unknown error'}`;
        setError(errorMsg);
        console.error(errorMsg, error);
      }
    },
    [layout, storageKey]
  );

  // Duplicate layout
  const duplicateLayout = useCallback(
    async (layoutId: string, newName: string): Promise<LayoutConfig> => {
      const sourceLayout = savedLayouts.find(l => l.id === layoutId);
      if (!sourceLayout) {
        throw new Error('Source layout not found');
      }

      const duplicated = createLayout(newName, `Copy of ${sourceLayout.name}`);
      Object.assign(duplicated, {
        ...sourceLayout,
        id: duplicated.id,
        name: newName,
        description: `Copy of ${sourceLayout.name}`,
        createdAt: duplicated.createdAt,
        modifiedAt: duplicated.modifiedAt,
      });

      await saveLayout(duplicated);
      return duplicated;
    },
    [savedLayouts, createLayout, saveLayout]
  );

  // Update layout
  const updateLayout = useCallback(
    (updates: Partial<LayoutConfig>) => {
      if (!layout) return;

      const updatedLayout = { ...layout, ...updates };
      setLayout(updatedLayout);
      setHasUnsavedChanges(true);

      onChangeRef.current?.(updatedLayout);
      debouncedAutoSave(updatedLayout);
    },
    [layout, debouncedAutoSave]
  );

  // Update panel
  const updatePanel = useCallback(
    (panelId: string, updates: Partial<PanelConfig>) => {
      if (!layout) return;

      const updatedPanels = layout.panels.map(panel =>
        panel.id === panelId ? { ...panel, ...updates } : panel
      );

      updateLayout({ panels: updatedPanels });
    },
    [layout, updateLayout]
  );

  // Add panel
  const addPanel = useCallback(
    (panel: Omit<PanelConfig, 'id'> & { id?: string }) => {
      if (!layout) return;

      const newPanel: PanelConfig = {
        id: panel.id || generateId(),
        ...panel,
      };

      updateLayout({
        panels: [...layout.panels, newPanel],
      });
    },
    [layout, updateLayout]
  );

  // Remove panel
  const removePanel = useCallback(
    (panelId: string) => {
      if (!layout) return;

      const updatedPanels = layout.panels.filter(panel => panel.id !== panelId);
      updateLayout({ panels: updatedPanels });
    },
    [layout, updateLayout]
  );

  // Reset layout
  const resetLayout = useCallback(() => {
    if (defaultLayout) {
      const newLayout = createLayout(defaultLayout.name || 'Default Layout');
      Object.assign(newLayout, defaultLayout);
      setLayout(newLayout);
      setHasUnsavedChanges(false);
    } else {
      setLayout(null);
      setHasUnsavedChanges(false);
    }
  }, [defaultLayout, createLayout]);

  // Export layout
  const exportLayout = useCallback(
    (layoutId?: string): string => {
      const targetLayout = layoutId ? savedLayouts.find(l => l.id === layoutId) : layout;

      if (!targetLayout) {
        throw new Error('No layout to export');
      }

      return JSON.stringify(targetLayout, null, 2);
    },
    [layout, savedLayouts]
  );

  // Import layout
  const importLayout = useCallback(
    async (json: string): Promise<LayoutConfig> => {
      try {
        const parsed = JSON.parse(json);

        if (!validator(parsed)) {
          throw new Error('Invalid layout format');
        }

        // Generate new ID to avoid conflicts
        const imported: LayoutConfig = {
          ...parsed,
          id: generateId(),
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        };

        await saveLayout(imported);
        return imported;
      } catch (error) {
        const errorMsg = `Failed to import layout: ${error instanceof Error ? error.message : 'Unknown error'}`;
        throw new Error(errorMsg);
      }
    },
    [validator, saveLayout]
  );

  // Clear all layouts
  const clearAllLayouts = useCallback(async (): Promise<void> => {
    try {
      const layoutKeys = getLayoutKeys(storageKey);
      layoutKeys.forEach(key => removeFromStorage(key));

      setSavedLayouts([]);
      setLayout(null);
      setHasUnsavedChanges(false);
    } catch (error) {
      const errorMsg = `Failed to clear layouts: ${error instanceof Error ? error.message : 'Unknown error'}`;
      setError(errorMsg);
      console.error(errorMsg, error);
    }
  }, [storageKey]);

  return {
    layout,
    savedLayouts,
    hasUnsavedChanges,
    isLoading,
    error,
    createLayout,
    saveLayout,
    loadLayout,
    deleteLayout,
    duplicateLayout,
    updateLayout,
    updatePanel,
    addPanel,
    removePanel,
    resetLayout,
    exportLayout,
    importLayout,
    clearAllLayouts,
  };
};

export default useLayoutState;
