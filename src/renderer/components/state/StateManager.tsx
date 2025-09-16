import React, { createContext, useContext, useReducer, useCallback, useMemo, ReactNode } from 'react';
import { produce } from 'immer';

/**
 * Advanced State Management Patterns for Complex Components
 */

// Generic state manager types
export interface StateAction<T = any> {
  type: string;
  payload?: T;
  meta?: {
    timestamp: number;
    source?: string;
    undo?: boolean;
  };
}

export interface StateManagerConfig<T> {
  initialState: T;
  actions: Record<string, (state: T, action: StateAction) => T>;
  middleware?: StateMiddleware<T>[];
  devTools?: boolean;
  persistence?: {
    key: string;
    storage?: 'localStorage' | 'sessionStorage';
    serialize?: (state: T) => string;
    deserialize?: (data: string) => T;
  };
}

export type StateMiddleware<T> = (
  store: { getState: () => T; dispatch: (action: StateAction) => void }
) => (next: (action: StateAction) => void) => (action: StateAction) => void;

/**
 * Enhanced State Manager with middleware support
 */
export class EnhancedStateManager<T> {
  private state: T;
  private listeners: Set<(state: T) => void> = new Set();
  private history: { state: T; action: StateAction }[] = [];
  private middleware: StateMiddleware<T>[] = [];
  private config: StateManagerConfig<T>;

  constructor(config: StateManagerConfig<T>) {
    this.config = config;
    this.state = this.loadPersistedState() || config.initialState;
    this.middleware = config.middleware || [];
    
    if (config.devTools && (window as any).__REDUX_DEVTOOLS_EXTENSION__) {
      this.setupDevTools();
    }
  }

  private loadPersistedState(): T | null {
    if (!this.config.persistence) return null;
    
    try {
      const { key, storage = 'localStorage', deserialize } = this.config.persistence;
      const stored = window[storage].getItem(key);
      
      if (stored) {
        return deserialize ? deserialize(stored) : JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load persisted state:', error);
    }
    
    return null;
  }

  private persistState(state: T) {
    if (!this.config.persistence) return;
    
    try {
      const { key, storage = 'localStorage', serialize } = this.config.persistence;
      const data = serialize ? serialize(state) : JSON.stringify(state);
      window[storage].setItem(key, data);
    } catch (error) {
      console.warn('Failed to persist state:', error);
    }
  }

  private setupDevTools() {
    // Redux DevTools integration
    const devTools = (window as any).__REDUX_DEVTOOLS_EXTENSION__;
    if (devTools) {
      devTools.connect({
        name: 'Enhanced State Manager',
        trace: true
      });
    }
  }

  getState(): T {
    return this.state;
  }

  dispatch = (action: StateAction): void => {
    const enhancedAction = {
      ...action,
      meta: {
        timestamp: Date.now(),
        ...action.meta
      }
    };

    // Apply middleware chain
    let dispatch: (action: StateAction) => void = (finalAction: StateAction) => {
      const actionHandler = this.config.actions[finalAction.type];
      
      if (actionHandler) {
        const newState = produce(this.state, draft => {
          return actionHandler(draft as T, finalAction);
        });
        
        // Store history for undo/redo
        this.history.push({ state: this.state, action: finalAction });
        if (this.history.length > 50) {
          this.history.shift();
        }
        
        this.state = newState;
        this.persistState(newState);
        this.notifyListeners();
      } else {
        console.warn(`Unknown action type: ${finalAction.type}`);
      }
    };

    // Apply middleware in reverse order
    for (let i = this.middleware.length - 1; i >= 0; i--) {
      dispatch = this.middleware[i]({
        getState: this.getState.bind(this),
        dispatch: this.dispatch
      })(dispatch);
    }

    dispatch(enhancedAction);
  };

  subscribe(listener: (state: T) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.state));
  }

  // Undo/Redo functionality
  undo(): void {
    if (this.history.length > 0) {
      const { state: previousState } = this.history.pop()!;
      this.state = previousState;
      this.notifyListeners();
    }
  }

  // Time travel debugging
  jumpToState(index: number): void {
    if (index >= 0 && index < this.history.length) {
      this.state = this.history[index].state;
      this.notifyListeners();
    }
  }
}

/**
 * Middleware implementations
 */
export const createLoggerMiddleware = <T,>(): StateMiddleware<T> => 
  () => next => action => {
    console.group(`%c${action.type}`, 'color: #03A9F4');
    console.log('Action:', action);
    console.log('Timestamp:', new Date(action.meta?.timestamp || Date.now()).toISOString());
    next(action);
    console.groupEnd();
  };

export const createThunkMiddleware = <T,>(): StateMiddleware<T> =>
  ({ dispatch, getState }) => next => action => {
    if (typeof action === 'function') {
      return action(dispatch, getState);
    }
    return next(action);
  };

export const createAsyncMiddleware = <T,>(): StateMiddleware<T> =>
  ({ dispatch }) => next => action => {
    if (action.type.endsWith('_REQUEST')) {
      // Handle async actions
      const baseType = action.type.replace('_REQUEST', '');
      
      Promise.resolve(action.payload)
        .then(result => {
          dispatch({ type: `${baseType}_SUCCESS`, payload: result });
        })
        .catch(error => {
          dispatch({ type: `${baseType}_ERROR`, payload: error });
        });
    }
    
    return next(action);
  };

/**
 * React hooks for state management
 */
export function useEnhancedState<T,>(
  config: StateManagerConfig<T>
): [T, (action: StateAction) => void, EnhancedStateManager<T>] {
  const managerRef = React.useRef<EnhancedStateManager<T> | null>(null);
  const [state, setState] = React.useState<T>(config.initialState);

  if (!managerRef.current) {
    managerRef.current = new EnhancedStateManager(config);
  }

  React.useEffect(() => {
    const manager = managerRef.current!;
    const unsubscribe = manager.subscribe(setState);
    setState(manager.getState());
    return unsubscribe;
  }, []);

  const dispatch = React.useCallback((action: StateAction) => {
    managerRef.current?.dispatch(action);
  }, []);

  return [state, dispatch, managerRef.current];
}

/**
 * Context-based state management for component trees
 */
export interface StateProviderProps<T> {
  children: ReactNode;
  config: StateManagerConfig<T>;
  debug?: boolean;
}

export function createStateProvider<T,>() {
  const StateContext = createContext<{
    state: T;
    dispatch: (action: StateAction) => void;
    manager: EnhancedStateManager<T>;
  } | null>(null);

  const StateProvider: React.FC<StateProviderProps<T>> = ({ 
    children, 
    config, 
    debug = false 
  }) => {
    const [state, dispatch, manager] = useEnhancedState({
      ...config,
      middleware: [
        ...(config.middleware || []),
        ...(debug ? [createLoggerMiddleware<T>()] : [])
      ]
    });

    const contextValue = useMemo(() => ({
      state,
      dispatch,
      manager
    }), [state, dispatch, manager]);

    return (
      <StateContext.Provider value={contextValue}>
        {children}
      </StateContext.Provider>
    );
  };

  const useStateContext = () => {
    const context = useContext(StateContext);
    if (!context) {
      throw new Error('useStateContext must be used within StateProvider');
    }
    return context;
  };

  return { StateProvider, useStateContext, StateContext };
}

/**
 * Selector hook for optimized subscriptions
 */
export function useSelector<T, R>(
  manager: EnhancedStateManager<T>,
  selector: (state: T) => R,
  equalityFn?: (prev: R, next: R) => boolean
): R {
  const [selectedState, setSelectedState] = React.useState(() => 
    selector(manager.getState())
  );

  const selectorRef = React.useRef(selector);
  const equalityFnRef = React.useRef(equalityFn);
  
  React.useEffect(() => {
    selectorRef.current = selector;
    equalityFnRef.current = equalityFn;
  });

  React.useEffect(() => {
    const unsubscribe = manager.subscribe((state) => {
      const newSelectedState = selectorRef.current(state);
      const areEqual = equalityFnRef.current 
        ? equalityFnRef.current(selectedState, newSelectedState)
        : selectedState === newSelectedState;
      
      if (!areEqual) {
        setSelectedState(newSelectedState);
      }
    });

    return unsubscribe;
  }, [manager, selectedState]);

  return selectedState;
}

/**
 * Component state manager for complex components
 */
export function useComponentState<T extends Record<string, any>,>(
  initialState: T,
  actions?: Record<string, (state: T, payload: any) => Partial<T>>
) {
  const [state, setState] = React.useState(initialState);
  const stateRef = React.useRef(state);
  
  React.useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const dispatch = useCallback((type: string, payload?: any) => {
    if (actions && actions[type]) {
      setState(prevState => {
        const updates = actions[type](prevState, payload);
        return { ...prevState, ...updates };
      });
    } else {
      console.warn(`Unknown action: ${type}`);
    }
  }, [actions]);

  const updateState = useCallback((updates: Partial<T> | ((prevState: T) => Partial<T>)) => {
    setState(prevState => {
      const newUpdates = typeof updates === 'function' ? updates(prevState) : updates;
      return { ...prevState, ...newUpdates };
    });
  }, []);

  const resetState = useCallback(() => {
    setState(initialState);
  }, [initialState]);

  return {
    state,
    dispatch,
    updateState,
    resetState,
    getState: () => stateRef.current
  };
}

/**
 * Optimistic updates hook
 */
export function useOptimisticUpdates<T,>(
  currentValue: T,
  updateFn: (value: T) => Promise<T>
) {
  const [optimisticValue, setOptimisticValue] = React.useState(currentValue);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    setOptimisticValue(currentValue);
  }, [currentValue]);

  const performUpdate = useCallback(async (newValue: T) => {
    setOptimisticValue(newValue);
    setIsUpdating(true);
    setError(null);

    try {
      const result = await updateFn(newValue);
      setOptimisticValue(result);
    } catch (err) {
      setOptimisticValue(currentValue); // Revert on error
      setError(err as Error);
    } finally {
      setIsUpdating(false);
    }
  }, [currentValue, updateFn]);

  return {
    value: optimisticValue,
    isUpdating,
    error,
    performUpdate
  };
}
