/**
 * Global Application Context
 * Manages high-level application state including theme, notifications, and current view
 */

import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';

// Types
export type ViewType = 'search' | 'knowledge-base' | 'metrics' | 'settings';
export type ThemeType = 'light' | 'dark' | 'system';
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title?: string;
  message: string;
  duration?: number;
  dismissible?: boolean;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  label: string;
  action: () => void;
  variant?: 'primary' | 'secondary';
}

export interface AppState {
  // UI State
  currentView: ViewType;
  theme: ThemeType;
  isLoading: boolean;
  
  // Notifications
  notifications: Notification[];
  
  // Accessibility
  accessibility: {
    isScreenReaderActive: boolean;
    isHighContrastMode: boolean;
    isReducedMotionMode: boolean;
    fontSize: 'small' | 'medium' | 'large';
  };
  
  // Application Status
  status: {
    isOnline: boolean;
    isDatabaseConnected: boolean;
    isAIServiceAvailable: boolean;
    lastActivity: Date;
  };
}

// Initial state
const initialState: AppState = {
  currentView: 'search',
  theme: 'system',
  isLoading: false,
  notifications: [],
  accessibility: {
    isScreenReaderActive: false,
    isHighContrastMode: false,
    isReducedMotionMode: false,
    fontSize: 'medium',
  },
  status: {
    isOnline: true,
    isDatabaseConnected: false,
    isAIServiceAvailable: false,
    lastActivity: new Date(),
  },
};

// Action types
type AppAction =
  | { type: 'SET_CURRENT_VIEW'; payload: ViewType }
  | { type: 'SET_THEME'; payload: ThemeType }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'CLEAR_NOTIFICATIONS' }
  | { type: 'UPDATE_ACCESSIBILITY'; payload: Partial<AppState['accessibility']> }
  | { type: 'UPDATE_STATUS'; payload: Partial<AppState['status']> }
  | { type: 'UPDATE_LAST_ACTIVITY' };

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_CURRENT_VIEW':
      return {
        ...state,
        currentView: action.payload,
        status: { ...state.status, lastActivity: new Date() },
      };

    case 'SET_THEME':
      return { ...state, theme: action.payload };

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [...state.notifications, action.payload],
      };

    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload),
      };

    case 'CLEAR_NOTIFICATIONS':
      return { ...state, notifications: [] };

    case 'UPDATE_ACCESSIBILITY':
      return {
        ...state,
        accessibility: { ...state.accessibility, ...action.payload },
      };

    case 'UPDATE_STATUS':
      return {
        ...state,
        status: { ...state.status, ...action.payload },
      };

    case 'UPDATE_LAST_ACTIVITY':
      return {
        ...state,
        status: { ...state.status, lastActivity: new Date() },
      };

    default:
      return state;
  }
}

// Context value interface
export interface AppContextValue {
  // State
  state: AppState;
  
  // View management
  setCurrentView: (view: ViewType) => void;
  
  // Theme management
  setTheme: (theme: ThemeType) => void;
  
  // Loading state
  setLoading: (isLoading: boolean) => void;
  
  // Notification management
  addNotification: (notification: Omit<Notification, 'id'>) => string;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  
  // Accessibility
  updateAccessibility: (updates: Partial<AppState['accessibility']>) => void;
  toggleHighContrast: () => void;
  toggleReducedMotion: () => void;
  setFontSize: (size: AppState['accessibility']['fontSize']) => void;
  
  // Status management
  updateStatus: (updates: Partial<AppState['status']>) => void;
  updateLastActivity: () => void;
}

// Create context
const AppContext = createContext<AppContextValue | null>(null);

// Provider component
export interface AppProviderProps {
  children: ReactNode;
  initialState?: Partial<AppState>;
}

export const AppProvider: React.FC<AppProviderProps> = ({
  children,
  initialState: providedInitialState,
}) => {
  const [state, dispatch] = useReducer(
    appReducer,
    { ...initialState, ...providedInitialState }
  );

  // View management
  const setCurrentView = useCallback((view: ViewType) => {
    dispatch({ type: 'SET_CURRENT_VIEW', payload: view });
  }, []);

  // Theme management
  const setTheme = useCallback((theme: ThemeType) => {
    dispatch({ type: 'SET_THEME', payload: theme });
    
    // Apply theme to document
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, []);

  // Loading state management
  const setLoading = useCallback((isLoading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: isLoading });
  }, []);

  // Notification management
  const addNotification = useCallback((notification: Omit<Notification, 'id'>): string => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fullNotification: Notification = {
      id,
      duration: 5000,
      dismissible: true,
      ...notification,
    };

    dispatch({ type: 'ADD_NOTIFICATION', payload: fullNotification });

    // Auto-remove notification if duration is set
    if (fullNotification.duration && fullNotification.duration > 0) {
      setTimeout(() => {
        dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
      }, fullNotification.duration);
    }

    return id;
  }, []);

  const removeNotification = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
  }, []);

  const clearNotifications = useCallback(() => {
    dispatch({ type: 'CLEAR_NOTIFICATIONS' });
  }, []);

  // Accessibility management
  const updateAccessibility = useCallback((updates: Partial<AppState['accessibility']>) => {
    dispatch({ type: 'UPDATE_ACCESSIBILITY', payload: updates });
  }, []);

  const toggleHighContrast = useCallback(() => {
    const newValue = !state.accessibility.isHighContrastMode;
    updateAccessibility({ isHighContrastMode: newValue });
    document.body.classList.toggle('high-contrast', newValue);
  }, [state.accessibility.isHighContrastMode, updateAccessibility]);

  const toggleReducedMotion = useCallback(() => {
    const newValue = !state.accessibility.isReducedMotionMode;
    updateAccessibility({ isReducedMotionMode: newValue });
    document.body.classList.toggle('reduce-motion', newValue);
  }, [state.accessibility.isReducedMotionMode, updateAccessibility]);

  const setFontSize = useCallback((size: AppState['accessibility']['fontSize']) => {
    updateAccessibility({ fontSize: size });
    document.body.className = document.body.className
      .replace(/font-size-\w+/, '')
      .concat(` font-size-${size}`);
  }, [updateAccessibility]);

  // Status management
  const updateStatus = useCallback((updates: Partial<AppState['status']>) => {
    dispatch({ type: 'UPDATE_STATUS', payload: updates });
  }, []);

  const updateLastActivity = useCallback(() => {
    dispatch({ type: 'UPDATE_LAST_ACTIVITY' });
  }, []);

  // Context value
  const contextValue: AppContextValue = {
    state,
    setCurrentView,
    setTheme,
    setLoading,
    addNotification,
    removeNotification,
    clearNotifications,
    updateAccessibility,
    toggleHighContrast,
    toggleReducedMotion,
    setFontSize,
    updateStatus,
    updateLastActivity,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

// Hook to use the context
export const useApp = (): AppContextValue => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

// Convenience hooks for specific parts of the state
export const useCurrentView = () => {
  const { state, setCurrentView } = useApp();
  return [state.currentView, setCurrentView] as const;
};

export const useTheme = () => {
  const { state, setTheme } = useApp();
  return [state.theme, setTheme] as const;
};

export const useNotifications = () => {
  const { state, addNotification, removeNotification, clearNotifications } = useApp();
  return {
    notifications: state.notifications,
    addNotification,
    removeNotification,
    clearNotifications,
  };
};

export const useAccessibility = () => {
  const {
    state,
    updateAccessibility,
    toggleHighContrast,
    toggleReducedMotion,
    setFontSize,
  } = useApp();

  return {
    accessibility: state.accessibility,
    updateAccessibility,
    toggleHighContrast,
    toggleReducedMotion,
    setFontSize,
  };
};

export const useAppStatus = () => {
  const { state, updateStatus } = useApp();
  return {
    status: state.status,
    updateStatus,
  };
};

export default AppContext;