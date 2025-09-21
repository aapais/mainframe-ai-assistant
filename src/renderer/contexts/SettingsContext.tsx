/**
 * Settings Context Provider - TASK-001 Implementation
 *
 * Comprehensive settings management for the Mainframe AI Assistant including:
 * 1. API keys configuration and secure storage
 * 2. Cost tracking settings and budgets
 * 3. Dashboard preferences and layouts
 * 4. UI preferences with theme integration
 * 5. Persistent storage with migration support
 * 6. Loading states and error handling
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect, ReactNode } from 'react';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface APIKeySettings {
  id: string;
  providerId: string;
  name: string;
  isActive: boolean;
  maskedKey: string;
  createdAt: Date;
  lastUsed?: Date;
  usageCount: number;
  monthlyLimit?: number;
  costThisMonth: number;
}

export interface CostTrackingSettings {
  enabled: boolean;
  monthlyBudget?: number;
  dailyBudget?: number;
  alertThresholds: {
    percentage: number;
    amount: number;
  }[];
  currency: 'USD' | 'EUR' | 'GBP';
  trackByProvider: boolean;
  includeDataTransfer: boolean;
  autoStopAtLimit: boolean;
  notifications: {
    email: boolean;
    inApp: boolean;
    webhook?: string;
  };
}

export interface DashboardPreferences {
  layout: 'grid' | 'list' | 'compact';
  widgets: {
    id: string;
    enabled: boolean;
    position: { x: number; y: number; w: number; h: number };
    settings: Record<string, any>;
  }[];
  defaultView: 'search' | 'knowledge-base' | 'metrics' | 'settings';
  autoRefresh: boolean;
  refreshInterval: number; // milliseconds
  showWelcomeMessage: boolean;
  compactMode: boolean;
  enableAnimations: boolean;
  maxItemsPerPage: number;
  floatingCostWidget: {
    enabled: boolean;
    position: { x: number; y: number };
    autoHide: boolean;
    autoHideTimeout: number;
    draggable: boolean;
    realTimeUpdates: boolean;
    updateInterval: number;
    defaultExpanded: boolean;
  };
}

export interface UIPreferences {
  theme: 'light' | 'dark' | 'system' | 'high-contrast';
  fontSize: 'small' | 'medium' | 'large' | 'x-large';
  fontFamily: 'system' | 'monospace' | 'serif';
  density: 'comfortable' | 'compact' | 'spacious';
  sidebarPosition: 'left' | 'right';
  sidebarCollapsed: boolean;
  language: string;
  timeFormat: '12h' | '24h';
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  numberFormat: 'US' | 'EU' | 'UK';
  animations: {
    enabled: boolean;
    reducedMotion: boolean;
    duration: 'fast' | 'normal' | 'slow';
  };
  accessibility: {
    highContrast: boolean;
    largeText: boolean;
    screenReader: boolean;
    keyboardNavigation: boolean;
    focusVisible: boolean;
  };
}

export interface PerformanceSettings {
  searchDebounceMs: number;
  maxConcurrentRequests: number;
  cacheSize: number; // MB
  enableOfflineMode: boolean;
  syncSettings: boolean;
  backgroundSync: boolean;
  compressionLevel: 'none' | 'low' | 'medium' | 'high';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface SecuritySettings {
  sessionTimeout: number; // minutes
  requireAuth: boolean;
  encryptLocalStorage: boolean;
  clearOnClose: boolean;
  allowRememberMe: boolean;
  twoFactorAuth: boolean;
  biometricAuth: boolean;
  secureMode: boolean;
  auditLog: boolean;
}

export interface NotificationSettings {
  enabled: boolean;
  types: {
    system: boolean;
    search: boolean;
    costAlerts: boolean;
    errors: boolean;
    updates: boolean;
  };
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  duration: number; // milliseconds
  sound: boolean;
  vibration: boolean;
  doNotDisturb: {
    enabled: boolean;
    startTime: string;
    endTime: string;
  };
}

export interface UserSettings {
  version: string;
  apiKeys: APIKeySettings[];
  costTracking: CostTrackingSettings;
  dashboard: DashboardPreferences;
  ui: UIPreferences;
  performance: PerformanceSettings;
  security: SecuritySettings;
  notifications: NotificationSettings;
  lastModified: Date;
  userId?: string;
  deviceId: string;
}

export interface SettingsState {
  settings: UserSettings;
  isLoading: boolean;
  isSaving: boolean;
  isInitialized: boolean;
  error: string | null;
  unsavedChanges: boolean;
  migrationStatus: 'none' | 'needed' | 'in-progress' | 'completed' | 'failed';
  validationErrors: Record<string, string[]>;
}

export interface SettingsActions {
  // General settings management
  updateSettings: (updates: Partial<UserSettings>) => Promise<boolean>;
  resetSettings: () => Promise<boolean>;
  importSettings: (settings: Partial<UserSettings>) => Promise<boolean>;
  exportSettings: () => UserSettings;

  // Specific setting sections
  updateAPIKeys: (apiKeys: APIKeySettings[]) => Promise<boolean>;
  addAPIKey: (apiKey: Omit<APIKeySettings, 'id' | 'createdAt'>) => Promise<string>;
  removeAPIKey: (id: string) => Promise<boolean>;
  updateAPIKeyStatus: (id: string, isActive: boolean) => Promise<boolean>;

  updateCostTracking: (costTracking: Partial<CostTrackingSettings>) => Promise<boolean>;
  updateDashboard: (dashboard: Partial<DashboardPreferences>) => Promise<boolean>;
  updateUI: (ui: Partial<UIPreferences>) => Promise<boolean>;
  updatePerformance: (performance: Partial<PerformanceSettings>) => Promise<boolean>;
  updateSecurity: (security: Partial<SecuritySettings>) => Promise<boolean>;
  updateNotifications: (notifications: Partial<NotificationSettings>) => Promise<boolean>;

  // Loading and error management
  clearError: () => void;
  saveSettings: () => Promise<boolean>;
  reloadSettings: () => Promise<boolean>;

  // Validation
  validateSettings: (settings?: Partial<UserSettings>) => Record<string, string[]>;
  hasUnsavedChanges: () => boolean;
}

// ============================================================================
// DEFAULT SETTINGS
// ============================================================================

const createDefaultSettings = (): UserSettings => ({
  version: '1.0.0',
  apiKeys: [],
  costTracking: {
    enabled: true,
    monthlyBudget: 100,
    currency: 'USD',
    alertThresholds: [
      { percentage: 50, amount: 50 },
      { percentage: 80, amount: 80 },
      { percentage: 100, amount: 100 }
    ],
    trackByProvider: true,
    includeDataTransfer: true,
    autoStopAtLimit: false,
    notifications: {
      email: false,
      inApp: true
    }
  },
  dashboard: {
    layout: 'grid',
    widgets: [
      {
        id: 'search-stats',
        enabled: true,
        position: { x: 0, y: 0, w: 6, h: 4 },
        settings: {}
      },
      {
        id: 'cost-tracker',
        enabled: true,
        position: { x: 6, y: 0, w: 6, h: 4 },
        settings: {}
      },
      {
        id: 'recent-searches',
        enabled: true,
        position: { x: 0, y: 4, w: 12, h: 6 },
        settings: {}
      }
    ],
    defaultView: 'search',
    autoRefresh: true,
    refreshInterval: 30000,
    showWelcomeMessage: true,
    compactMode: false,
    enableAnimations: true,
    maxItemsPerPage: 50,
    floatingCostWidget: {
      enabled: true,
      position: { x: window.innerWidth - 300, y: 20 },
      autoHide: false,
      autoHideTimeout: 10000,
      draggable: true,
      realTimeUpdates: true,
      updateInterval: 30000,
      defaultExpanded: false
    }
  },
  ui: {
    theme: 'system',
    fontSize: 'medium',
    fontFamily: 'system',
    density: 'comfortable',
    sidebarPosition: 'left',
    sidebarCollapsed: false,
    language: 'en',
    timeFormat: '12h',
    dateFormat: 'MM/DD/YYYY',
    numberFormat: 'US',
    animations: {
      enabled: true,
      reducedMotion: false,
      duration: 'normal'
    },
    accessibility: {
      highContrast: false,
      largeText: false,
      screenReader: false,
      keyboardNavigation: true,
      focusVisible: true
    }
  },
  performance: {
    searchDebounceMs: 300,
    maxConcurrentRequests: 5,
    cacheSize: 100,
    enableOfflineMode: false,
    syncSettings: true,
    backgroundSync: true,
    compressionLevel: 'medium',
    logLevel: 'info'
  },
  security: {
    sessionTimeout: 60,
    requireAuth: false,
    encryptLocalStorage: true,
    clearOnClose: false,
    allowRememberMe: true,
    twoFactorAuth: false,
    biometricAuth: false,
    secureMode: false,
    auditLog: false
  },
  notifications: {
    enabled: true,
    types: {
      system: true,
      search: true,
      costAlerts: true,
      errors: true,
      updates: true
    },
    position: 'top-right',
    duration: 5000,
    sound: false,
    vibration: false,
    doNotDisturb: {
      enabled: false,
      startTime: '22:00',
      endTime: '08:00'
    }
  },
  lastModified: new Date(),
  deviceId: crypto.randomUUID()
});

// ============================================================================
// ACTION TYPES
// ============================================================================

type SettingsAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'SET_INITIALIZED'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_UNSAVED_CHANGES'; payload: boolean }
  | { type: 'SET_MIGRATION_STATUS'; payload: SettingsState['migrationStatus'] }
  | { type: 'SET_VALIDATION_ERRORS'; payload: Record<string, string[]> }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<UserSettings> }
  | { type: 'RESET_SETTINGS' }
  | { type: 'LOAD_SETTINGS'; payload: UserSettings };

// ============================================================================
// REDUCER
// ============================================================================

const initialState: SettingsState = {
  settings: createDefaultSettings(),
  isLoading: true,
  isSaving: false,
  isInitialized: false,
  error: null,
  unsavedChanges: false,
  migrationStatus: 'none',
  validationErrors: {}
};

function settingsReducer(state: SettingsState, action: SettingsAction): SettingsState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_SAVING':
      return { ...state, isSaving: action.payload };

    case 'SET_INITIALIZED':
      return { ...state, isInitialized: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'SET_UNSAVED_CHANGES':
      return { ...state, unsavedChanges: action.payload };

    case 'SET_MIGRATION_STATUS':
      return { ...state, migrationStatus: action.payload };

    case 'SET_VALIDATION_ERRORS':
      return { ...state, validationErrors: action.payload };

    case 'UPDATE_SETTINGS':
      return {
        ...state,
        settings: {
          ...state.settings,
          ...action.payload,
          lastModified: new Date()
        },
        unsavedChanges: true,
        error: null
      };

    case 'RESET_SETTINGS':
      return {
        ...state,
        settings: createDefaultSettings(),
        unsavedChanges: true,
        error: null,
        validationErrors: {}
      };

    case 'LOAD_SETTINGS':
      return {
        ...state,
        settings: action.payload,
        unsavedChanges: false,
        error: null,
        isLoading: false,
        isInitialized: true
      };

    default:
      return state;
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

const STORAGE_KEYS = {
  SETTINGS: 'mainframe-ai-settings',
  BACKUP: 'mainframe-ai-settings-backup',
  VERSION: 'mainframe-ai-settings-version'
} as const;

/**
 * Settings validation function
 */
function validateSettings(settings: Partial<UserSettings>): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  // Validate cost tracking
  if (settings.costTracking) {
    const ct = settings.costTracking;
    if (ct.monthlyBudget !== undefined && ct.monthlyBudget < 0) {
      errors.costTracking = errors.costTracking || [];
      errors.costTracking.push('Monthly budget must be positive');
    }

    if (ct.dailyBudget !== undefined && ct.dailyBudget < 0) {
      errors.costTracking = errors.costTracking || [];
      errors.costTracking.push('Daily budget must be positive');
    }
  }

  // Validate performance settings
  if (settings.performance) {
    const perf = settings.performance;
    if (perf.searchDebounceMs !== undefined && (perf.searchDebounceMs < 0 || perf.searchDebounceMs > 5000)) {
      errors.performance = errors.performance || [];
      errors.performance.push('Search debounce must be between 0 and 5000ms');
    }

    if (perf.maxConcurrentRequests !== undefined && (perf.maxConcurrentRequests < 1 || perf.maxConcurrentRequests > 20)) {
      errors.performance = errors.performance || [];
      errors.performance.push('Max concurrent requests must be between 1 and 20');
    }
  }

  // Validate security settings
  if (settings.security) {
    const sec = settings.security;
    if (sec.sessionTimeout !== undefined && (sec.sessionTimeout < 5 || sec.sessionTimeout > 480)) {
      errors.security = errors.security || [];
      errors.security.push('Session timeout must be between 5 and 480 minutes');
    }
  }

  return errors;
}

/**
 * Settings migration function
 */
function migrateSettings(settings: any, fromVersion: string, toVersion: string): UserSettings {
  // If no migration needed, return as-is
  if (fromVersion === toVersion) {
    return settings;
  }

  const migrated = { ...settings };

  // Migration logic for different versions
  if (fromVersion < '1.0.0') {
    // Add new fields that weren't in older versions
    migrated.deviceId = migrated.deviceId || crypto.randomUUID();
    migrated.security = migrated.security || createDefaultSettings().security;
    migrated.notifications = migrated.notifications || createDefaultSettings().notifications;
  }

  // Update version
  migrated.version = toVersion;
  migrated.lastModified = new Date();

  return migrated;
}

/**
 * Safe JSON parse with fallback
 */
function safeJSONParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;

  try {
    const parsed = JSON.parse(value);
    // Restore Date objects
    if (parsed.lastModified) {
      parsed.lastModified = new Date(parsed.lastModified);
    }
    if (parsed.apiKeys) {
      parsed.apiKeys.forEach((key: any) => {
        if (key.createdAt) key.createdAt = new Date(key.createdAt);
        if (key.lastUsed) key.lastUsed = new Date(key.lastUsed);
      });
    }
    return parsed;
  } catch (error) {
    console.warn('Failed to parse stored settings:', error);
    return fallback;
  }
}

// ============================================================================
// CONTEXT CREATION
// ============================================================================

const SettingsContext = createContext<{
  state: SettingsState;
  actions: SettingsActions;
} | null>(null);

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

export interface SettingsProviderProps {
  children: ReactNode;
  autoSave?: boolean;
  autoSaveDelay?: number;
}

export function SettingsProvider({
  children,
  autoSave = true,
  autoSaveDelay = 1000
}: SettingsProviderProps) {
  const [state, dispatch] = useReducer(settingsReducer, initialState);

  // Auto-save timeout
  const autoSaveTimeoutRef = React.useRef<NodeJS.Timeout>();

  // ============================================================================
  // STORAGE OPERATIONS
  // ============================================================================

  const saveToStorage = useCallback(async (settings: UserSettings): Promise<boolean> => {
    try {
      // Create backup of current settings
      const currentSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (currentSettings) {
        localStorage.setItem(STORAGE_KEYS.BACKUP, currentSettings);
      }

      // Save new settings
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      localStorage.setItem(STORAGE_KEYS.VERSION, settings.version);

      return true;
    } catch (error) {
      console.error('Failed to save settings to storage:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to save settings' });
      return false;
    }
  }, []);

  const loadFromStorage = useCallback((): UserSettings | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      const storedVersion = localStorage.getItem(STORAGE_KEYS.VERSION) || '0.0.0';
      const currentVersion = '1.0.0';

      if (!stored) return null;

      const parsed = safeJSONParse(stored, null);
      if (!parsed) return null;

      // Check if migration is needed
      if (storedVersion !== currentVersion) {
        dispatch({ type: 'SET_MIGRATION_STATUS', payload: 'needed' });
        const migrated = migrateSettings(parsed, storedVersion, currentVersion);
        dispatch({ type: 'SET_MIGRATION_STATUS', payload: 'completed' });
        return migrated;
      }

      return parsed;
    } catch (error) {
      console.error('Failed to load settings from storage:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load settings' });
      return null;
    }
  }, []);

  // ============================================================================
  // ACTIONS IMPLEMENTATION
  // ============================================================================

  const updateSettings = useCallback(async (updates: Partial<UserSettings>): Promise<boolean> => {
    try {
      // Validate updates
      const validationErrors = validateSettings(updates);
      if (Object.keys(validationErrors).length > 0) {
        dispatch({ type: 'SET_VALIDATION_ERRORS', payload: validationErrors });
        return false;
      }

      dispatch({ type: 'UPDATE_SETTINGS', payload: updates });
      dispatch({ type: 'SET_VALIDATION_ERRORS', payload: {} });

      // Auto-save if enabled
      if (autoSave) {
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current);
        }

        autoSaveTimeoutRef.current = setTimeout(async () => {
          await saveSettings();
        }, autoSaveDelay);
      }

      return true;
    } catch (error) {
      console.error('Failed to update settings:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to update settings' });
      return false;
    }
  }, [autoSave, autoSaveDelay]);

  const resetSettings = useCallback(async (): Promise<boolean> => {
    try {
      dispatch({ type: 'RESET_SETTINGS' });
      return await saveToStorage(createDefaultSettings());
    } catch (error) {
      console.error('Failed to reset settings:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to reset settings' });
      return false;
    }
  }, [saveToStorage]);

  const importSettings = useCallback(async (settings: Partial<UserSettings>): Promise<boolean> => {
    try {
      const validationErrors = validateSettings(settings);
      if (Object.keys(validationErrors).length > 0) {
        dispatch({ type: 'SET_VALIDATION_ERRORS', payload: validationErrors });
        return false;
      }

      const merged = { ...state.settings, ...settings, lastModified: new Date() };
      dispatch({ type: 'LOAD_SETTINGS', payload: merged });
      return await saveToStorage(merged);
    } catch (error) {
      console.error('Failed to import settings:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to import settings' });
      return false;
    }
  }, [state.settings, saveToStorage]);

  const exportSettings = useCallback((): UserSettings => {
    return state.settings;
  }, [state.settings]);

  const addAPIKey = useCallback(async (apiKey: Omit<APIKeySettings, 'id' | 'createdAt'>): Promise<string> => {
    const id = crypto.randomUUID();
    const newKey: APIKeySettings = {
      ...apiKey,
      id,
      createdAt: new Date()
    };

    await updateSettings({
      apiKeys: [...state.settings.apiKeys, newKey]
    });

    return id;
  }, [state.settings.apiKeys, updateSettings]);

  const removeAPIKey = useCallback(async (id: string): Promise<boolean> => {
    return await updateSettings({
      apiKeys: state.settings.apiKeys.filter(key => key.id !== id)
    });
  }, [state.settings.apiKeys, updateSettings]);

  const updateAPIKeyStatus = useCallback(async (id: string, isActive: boolean): Promise<boolean> => {
    return await updateSettings({
      apiKeys: state.settings.apiKeys.map(key =>
        key.id === id ? { ...key, isActive } : key
      )
    });
  }, [state.settings.apiKeys, updateSettings]);

  const saveSettings = useCallback(async (): Promise<boolean> => {
    try {
      dispatch({ type: 'SET_SAVING', payload: true });
      const success = await saveToStorage(state.settings);

      if (success) {
        dispatch({ type: 'SET_UNSAVED_CHANGES', payload: false });
      }

      return success;
    } catch (error) {
      console.error('Failed to save settings:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to save settings' });
      return false;
    } finally {
      dispatch({ type: 'SET_SAVING', payload: false });
    }
  }, [state.settings, saveToStorage]);

  const reloadSettings = useCallback(async (): Promise<boolean> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const loaded = loadFromStorage();

      if (loaded) {
        dispatch({ type: 'LOAD_SETTINGS', payload: loaded });
        return true;
      } else {
        // No stored settings, use defaults
        const defaults = createDefaultSettings();
        dispatch({ type: 'LOAD_SETTINGS', payload: defaults });
        await saveToStorage(defaults);
        return true;
      }
    } catch (error) {
      console.error('Failed to reload settings:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to reload settings' });
      return false;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [loadFromStorage, saveToStorage]);

  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null });
  }, []);

  const hasUnsavedChanges = useCallback(() => {
    return state.unsavedChanges;
  }, [state.unsavedChanges]);

  // ============================================================================
  // SECTION-SPECIFIC UPDATE HELPERS
  // ============================================================================

  const updateAPIKeys = useCallback(async (apiKeys: APIKeySettings[]): Promise<boolean> => {
    return await updateSettings({ apiKeys });
  }, [updateSettings]);

  const updateCostTracking = useCallback(async (costTracking: Partial<CostTrackingSettings>): Promise<boolean> => {
    return await updateSettings({
      costTracking: { ...state.settings.costTracking, ...costTracking }
    });
  }, [state.settings.costTracking, updateSettings]);

  const updateDashboard = useCallback(async (dashboard: Partial<DashboardPreferences>): Promise<boolean> => {
    return await updateSettings({
      dashboard: { ...state.settings.dashboard, ...dashboard }
    });
  }, [state.settings.dashboard, updateSettings]);

  const updateUI = useCallback(async (ui: Partial<UIPreferences>): Promise<boolean> => {
    return await updateSettings({
      ui: { ...state.settings.ui, ...ui }
    });
  }, [state.settings.ui, updateSettings]);

  const updatePerformance = useCallback(async (performance: Partial<PerformanceSettings>): Promise<boolean> => {
    return await updateSettings({
      performance: { ...state.settings.performance, ...performance }
    });
  }, [state.settings.performance, updateSettings]);

  const updateSecurity = useCallback(async (security: Partial<SecuritySettings>): Promise<boolean> => {
    return await updateSettings({
      security: { ...state.settings.security, ...security }
    });
  }, [state.settings.security, updateSettings]);

  const updateNotifications = useCallback(async (notifications: Partial<NotificationSettings>): Promise<boolean> => {
    return await updateSettings({
      notifications: { ...state.settings.notifications, ...notifications }
    });
  }, [state.settings.notifications, updateSettings]);

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  useEffect(() => {
    reloadSettings();
  }, [reloadSettings]);

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const actions: SettingsActions = {
    updateSettings,
    resetSettings,
    importSettings,
    exportSettings,
    updateAPIKeys,
    addAPIKey,
    removeAPIKey,
    updateAPIKeyStatus,
    updateCostTracking,
    updateDashboard,
    updateUI,
    updatePerformance,
    updateSecurity,
    updateNotifications,
    clearError,
    saveSettings,
    reloadSettings,
    validateSettings,
    hasUnsavedChanges
  };

  return (
    <SettingsContext.Provider value={{ state, actions }}>
      {children}
    </SettingsContext.Provider>
  );
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Main hook to access settings context
 */
export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

/**
 * Hook to access only settings state
 */
export function useSettingsState() {
  const { state } = useSettings();
  return state;
}

/**
 * Hook to access only settings actions
 */
export function useSettingsActions() {
  const { actions } = useSettings();
  return actions;
}

/**
 * Hook to access specific setting sections with type safety
 */
export function useAPIKeys() {
  const { state, actions } = useSettings();
  return {
    apiKeys: state.settings.apiKeys,
    updateAPIKeys: actions.updateAPIKeys,
    addAPIKey: actions.addAPIKey,
    removeAPIKey: actions.removeAPIKey,
    updateAPIKeyStatus: actions.updateAPIKeyStatus
  };
}

export function useCostTracking() {
  const { state, actions } = useSettings();
  return {
    costTracking: state.settings.costTracking,
    updateCostTracking: actions.updateCostTracking
  };
}

export function useDashboardPreferences() {
  const { state, actions } = useSettings();
  return {
    dashboard: state.settings.dashboard,
    updateDashboard: actions.updateDashboard
  };
}

export function useUIPreferences() {
  const { state, actions } = useSettings();
  return {
    ui: state.settings.ui,
    updateUI: actions.updateUI
  };
}

export function usePerformanceSettings() {
  const { state, actions } = useSettings();
  return {
    performance: state.settings.performance,
    updatePerformance: actions.updatePerformance
  };
}

export function useSecuritySettings() {
  const { state, actions } = useSettings();
  return {
    security: state.settings.security,
    updateSecurity: actions.updateSecurity
  };
}

export function useNotificationSettings() {
  const { state, actions } = useSettings();
  return {
    notifications: state.settings.notifications,
    updateNotifications: actions.updateNotifications
  };
}

export function useFloatingCostWidget() {
  const { state, actions } = useSettings();
  return {
    floatingCostWidget: state.settings.dashboard.floatingCostWidget,
    updateFloatingCostWidget: useCallback(async (updates: Partial<typeof state.settings.dashboard.floatingCostWidget>): Promise<boolean> => {
      return await actions.updateDashboard({
        floatingCostWidget: { ...state.settings.dashboard.floatingCostWidget, ...updates }
      });
    }, [state.settings.dashboard.floatingCostWidget, actions.updateDashboard])
  };
}

/**
 * Hook for settings loading state
 */
export function useSettingsLoading() {
  const { state } = useSettings();
  return {
    isLoading: state.isLoading,
    isSaving: state.isSaving,
    isInitialized: state.isInitialized,
    migrationStatus: state.migrationStatus
  };
}

/**
 * Hook for settings error handling
 */
export function useSettingsError() {
  const { state, actions } = useSettings();
  return {
    error: state.error,
    validationErrors: state.validationErrors,
    clearError: actions.clearError,
    hasUnsavedChanges: state.unsavedChanges
  };
}

export default SettingsContext;