/**
 * IPC Context Provider
 * Provides IPC services and global state management with error boundaries
 */

import React, { createContext, useContext, useEffect, useReducer, useCallback, ReactNode, useMemo } from 'react';
import { IPCClient, ipcClient } from '../ipc/IPCClient';
import { IPCBridge, ipcBridge } from '../ipc/IPCBridge';
import type { AppError, AppErrorType } from '../../types';

// Context state interface
export interface IPCContextState {
  // Connection status
  isConnected: boolean;
  isOnline: boolean;
  connectionError: string | null;
  
  // Application status
  aiServiceAvailable: boolean;
  databaseConnected: boolean;
  appVersion: string;
  theme: 'light' | 'dark';
  
  // Performance metrics
  ipcPerformance: {
    averageLatency: number;
    errorRate: number;
    cacheHitRate: number;
  };
  
  // Global loading state
  globalLoading: boolean;
  pendingOperations: number;
  
  // Error state
  errors: AppError[];
  criticalError: AppError | null;
}

// Context actions
export type IPCContextAction =
  | { type: 'SET_CONNECTION_STATUS'; payload: { connected: boolean; error?: string } }
  | { type: 'SET_ONLINE_STATUS'; payload: boolean }
  | { type: 'SET_AI_SERVICE_STATUS'; payload: boolean }
  | { type: 'SET_DATABASE_STATUS'; payload: boolean }
  | { type: 'SET_APP_VERSION'; payload: string }
  | { type: 'SET_THEME'; payload: 'light' | 'dark' }
  | { type: 'UPDATE_PERFORMANCE'; payload: Partial<IPCContextState['ipcPerformance']> }
  | { type: 'SET_GLOBAL_LOADING'; payload: boolean }
  | { type: 'INCREMENT_PENDING_OPERATIONS' }
  | { type: 'DECREMENT_PENDING_OPERATIONS' }
  | { type: 'ADD_ERROR'; payload: AppError }
  | { type: 'REMOVE_ERROR'; payload: string }
  | { type: 'CLEAR_ERRORS' }
  | { type: 'SET_CRITICAL_ERROR'; payload: AppError | null };

// Context value interface
export interface IPCContextValue extends IPCContextState {
  // IPC clients
  client: IPCClient;
  bridge: IPCBridge;
  
  // Connection management
  reconnect: () => Promise<void>;
  checkConnection: () => Promise<boolean>;
  
  // Error management
  addError: (error: AppError) => void;
  removeError: (errorId: string) => void;
  clearErrors: () => void;
  reportError: (error: Error, type?: AppErrorType) => void;
  
  // Theme management
  toggleTheme: () => Promise<void>;
  
  // Performance monitoring
  trackOperation: <T>(operation: () => Promise<T>) => Promise<T>;
  
  // Status checks
  performHealthCheck: () => Promise<void>;
}

// Initial state
const initialState: IPCContextState = {
  isConnected: false,
  isOnline: true,
  connectionError: null,
  aiServiceAvailable: false,
  databaseConnected: false,
  appVersion: '1.0.0-mvp1',
  theme: 'light',
  ipcPerformance: {
    averageLatency: 0,
    errorRate: 0,
    cacheHitRate: 0
  },
  globalLoading: false,
  pendingOperations: 0,
  errors: [],
  criticalError: null
};

// Reducer
function ipcContextReducer(state: IPCContextState, action: IPCContextAction): IPCContextState {
  switch (action.type) {
    case 'SET_CONNECTION_STATUS':
      return {
        ...state,
        isConnected: action.payload.connected,
        connectionError: action.payload.error || null
      };

    case 'SET_ONLINE_STATUS':
      return {
        ...state,
        isOnline: action.payload
      };

    case 'SET_AI_SERVICE_STATUS':
      return {
        ...state,
        aiServiceAvailable: action.payload
      };

    case 'SET_DATABASE_STATUS':
      return {
        ...state,
        databaseConnected: action.payload
      };

    case 'SET_APP_VERSION':
      return {
        ...state,
        appVersion: action.payload
      };

    case 'SET_THEME':
      return {
        ...state,
        theme: action.payload
      };

    case 'UPDATE_PERFORMANCE':
      return {
        ...state,
        ipcPerformance: {
          ...state.ipcPerformance,
          ...action.payload
        }
      };

    case 'SET_GLOBAL_LOADING':
      return {
        ...state,
        globalLoading: action.payload
      };

    case 'INCREMENT_PENDING_OPERATIONS':
      return {
        ...state,
        pendingOperations: state.pendingOperations + 1,
        globalLoading: state.pendingOperations + 1 > 0
      };

    case 'DECREMENT_PENDING_OPERATIONS':
      const newPendingCount = Math.max(0, state.pendingOperations - 1);
      return {
        ...state,
        pendingOperations: newPendingCount,
        globalLoading: newPendingCount > 0
      };

    case 'ADD_ERROR':
      return {
        ...state,
        errors: [...state.errors, action.payload]
      };

    case 'REMOVE_ERROR':
      return {
        ...state,
        errors: state.errors.filter(error => error.timestamp.getTime().toString() !== action.payload)
      };

    case 'CLEAR_ERRORS':
      return {
        ...state,
        errors: [],
        criticalError: null
      };

    case 'SET_CRITICAL_ERROR':
      return {
        ...state,
        criticalError: action.payload
      };

    default:
      return state;
  }
}

// Create context
const IPCContext = createContext<IPCContextValue | null>(null);

// Props interface
export interface IPCProviderProps {
  children: ReactNode;
  client?: IPCClient;
  bridge?: IPCBridge;
}

/**
 * IPC Provider Component with error boundaries and global state
 */
export function IPCProvider({ children, client = ipcClient, bridge = ipcBridge }: IPCProviderProps) {
  const [state, dispatch] = useReducer(ipcContextReducer, initialState);

  // Connection management
  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      const isHealthy = await client.healthCheck();
      dispatch({ 
        type: 'SET_CONNECTION_STATUS', 
        payload: { connected: isHealthy } 
      });
      return isHealthy;
    } catch (error) {
      dispatch({ 
        type: 'SET_CONNECTION_STATUS', 
        payload: { 
          connected: false, 
          error: error instanceof Error ? error.message : 'Connection failed' 
        } 
      });
      return false;
    }
  }, [client]);

  const reconnect = useCallback(async (): Promise<void> => {
    dispatch({ type: 'SET_GLOBAL_LOADING', payload: true });
    
    try {
      // Wait a bit before reconnecting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await checkConnection();
      
      // If reconnected, perform health check
      if (state.isConnected) {
        await performHealthCheck();
      }
    } finally {
      dispatch({ type: 'SET_GLOBAL_LOADING', payload: false });
    }
  }, [checkConnection, state.isConnected]);

  // Error management
  const createAppError = useCallback((error: Error, type: AppErrorType = 'UNKNOWN_ERROR'): AppError => {
    return {
      type,
      message: error.message,
      code: (error as any).code || 'UNKNOWN',
      timestamp: new Date(),
      stack: error.stack
    };
  }, []);

  const addError = useCallback((error: AppError) => {
    dispatch({ type: 'ADD_ERROR', payload: error });
    
    // Set as critical error if it's a critical type
    if (error.type === 'DATABASE_ERROR' || error.type === 'PERMISSION_ERROR') {
      dispatch({ type: 'SET_CRITICAL_ERROR', payload: error });
    }
  }, []);

  const removeError = useCallback((errorId: string) => {
    dispatch({ type: 'REMOVE_ERROR', payload: errorId });
  }, []);

  const clearErrors = useCallback(() => {
    dispatch({ type: 'CLEAR_ERRORS' });
  }, []);

  const reportError = useCallback((error: Error, type?: AppErrorType) => {
    const appError = createAppError(error, type);
    addError(appError);
    console.error('IPC Error reported:', appError);
  }, [createAppError, addError]);

  // Theme management
  const toggleTheme = useCallback(async () => {
    const newTheme = state.theme === 'light' ? 'dark' : 'light';
    
    try {
      await client.setTheme(newTheme);
      dispatch({ type: 'SET_THEME', payload: newTheme });
    } catch (error) {
      reportError(error as Error, 'UNKNOWN_ERROR');
    }
  }, [state.theme, client, reportError]);

  // Performance tracking
  const trackOperation = useCallback(async <T,>(operation: () => Promise<T>): Promise<T> => {
    dispatch({ type: 'INCREMENT_PENDING_OPERATIONS' });
    const startTime = performance.now();
    
    try {
      const result = await operation();
      
      // Update performance metrics
      const duration = performance.now() - startTime;
      dispatch({ 
        type: 'UPDATE_PERFORMANCE', 
        payload: { 
          averageLatency: (state.ipcPerformance.averageLatency + duration) / 2
        }
      });
      
      return result;
    } catch (error) {
      // Update error rate
      const newErrorRate = state.ipcPerformance.errorRate * 0.9 + 0.1; // Exponential moving average
      dispatch({ 
        type: 'UPDATE_PERFORMANCE', 
        payload: { errorRate: newErrorRate }
      });
      
      throw error;
    } finally {
      dispatch({ type: 'DECREMENT_PENDING_OPERATIONS' });
    }
  }, [state.ipcPerformance]);

  // Health check
  const performHealthCheck = useCallback(async () => {
    try {
      // Check connection
      const isConnected = await checkConnection();
      
      if (isConnected) {
        // Check AI service
        const aiResponse = await client.checkAIService();
        if (aiResponse.success) {
          dispatch({ type: 'SET_AI_SERVICE_STATUS', payload: aiResponse.data?.available || false });
        }
        
        // Check database
        const dbResponse = await client.checkDatabase();
        if (dbResponse.success) {
          dispatch({ type: 'SET_DATABASE_STATUS', payload: dbResponse.data?.connected || false });
        }
        
        // Get app version
        const versionResponse = await client.getAppVersion();
        if (versionResponse.success) {
          dispatch({ type: 'SET_APP_VERSION', payload: versionResponse.data || '1.0.0-mvp1' });
        }
        
        // Get theme
        const themeResponse = await client.getTheme();
        if (themeResponse.success) {
          dispatch({ type: 'SET_THEME', payload: themeResponse.data || 'light' });
        }
      }
    } catch (error) {
      reportError(error as Error, 'NETWORK_ERROR');
    }
  }, [checkConnection, client, reportError]);

  // Set up event listeners
  useEffect(() => {
    // Online/offline detection
    const handleOnline = () => dispatch({ type: 'SET_ONLINE_STATUS', payload: true });
    const handleOffline = () => dispatch({ type: 'SET_ONLINE_STATUS', payload: false });

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      
      // Set initial online status
      dispatch({ type: 'SET_ONLINE_STATUS', payload: navigator.onLine });
    }

    // IPC Bridge events
    const handleCacheHit = () => {
      dispatch({ 
        type: 'UPDATE_PERFORMANCE', 
        payload: { 
          cacheHitRate: Math.min(1, state.ipcPerformance.cacheHitRate + 0.01)
        }
      });
    };

    const handleCacheMiss = () => {
      dispatch({ 
        type: 'UPDATE_PERFORMANCE', 
        payload: { 
          cacheHitRate: Math.max(0, state.ipcPerformance.cacheHitRate - 0.005)
        }
      });
    };

    const handleOfflineDetected = () => {
      dispatch({ type: 'SET_ONLINE_STATUS', payload: false });
    };

    const handleOnlineDetected = () => {
      dispatch({ type: 'SET_ONLINE_STATUS', payload: true });
      // Perform health check when coming back online
      performHealthCheck();
    };

    const handleBridgeError = (error: Error) => {
      reportError(error, 'NETWORK_ERROR');
    };

    // Listen to bridge events
    bridge.on('cache:hit', handleCacheHit);
    bridge.on('cache:miss', handleCacheMiss);
    bridge.on('offline:detected', handleOfflineDetected);
    bridge.on('online:detected', handleOnlineDetected);
    bridge.on('error', handleBridgeError);

    return () => {
      // Clean up event listeners
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }

      bridge.removeAllListeners('cache:hit');
      bridge.removeAllListeners('cache:miss');
      bridge.removeAllListeners('offline:detected');
      bridge.removeAllListeners('online:detected');
      bridge.removeAllListeners('error');
    };
  }, [bridge, state.ipcPerformance.cacheHitRate, performHealthCheck, reportError]);

  // Initial health check
  useEffect(() => {
    performHealthCheck();
  }, [performHealthCheck]);

  // Memoize context value
  const contextValue = useMemo<IPCContextValue>(() => ({
    // State
    ...state,
    
    // Clients
    client,
    bridge,
    
    // Connection management
    reconnect,
    checkConnection,
    
    // Error management
    addError,
    removeError,
    clearErrors,
    reportError,
    
    // Theme management
    toggleTheme,
    
    // Performance monitoring
    trackOperation,
    
    // Status checks
    performHealthCheck
  }), [
    state,
    client,
    bridge,
    reconnect,
    checkConnection,
    addError,
    removeError,
    clearErrors,
    reportError,
    toggleTheme,
    trackOperation,
    performHealthCheck
  ]);

  return (
    <IPCContext.Provider value={contextValue}>
      {children}
    </IPCContext.Provider>
  );
}

/**
 * Hook to use IPC Context
 */
export function useIPC(): IPCContextValue {
  const context = useContext(IPCContext);
  
  if (!context) {
    throw new Error('useIPC must be used within an IPCProvider');
  }
  
  return context;
}

// Higher-order component for IPC error boundary
export interface IPCErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: AppError) => ReactNode;
  onError?: (error: AppError) => void;
}

interface IPCErrorBoundaryState {
  hasError: boolean;
  error: AppError | null;
}

export class IPCErrorBoundary extends React.Component<IPCErrorBoundaryProps, IPCErrorBoundaryState> {
  constructor(props: IPCErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): IPCErrorBoundaryState {
    return {
      hasError: true,
      error: {
        type: 'UNKNOWN_ERROR',
        message: error.message,
        code: 'COMPONENT_ERROR',
        timestamp: new Date(),
        stack: error.stack
      }
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('IPC Error Boundary caught error:', error, errorInfo);
    
    if (this.props.onError && this.state.error) {
      this.props.onError(this.state.error);
    }
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error);
      }

      return (
        <div className="error-boundary">
          <h2>Something went wrong with IPC communication</h2>
          <p>{this.state.error.message}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default IPCProvider;