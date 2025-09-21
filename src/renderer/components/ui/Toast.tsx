/**
 * Toast Notification System
 * Accessible toast notifications with auto-dismiss and position management
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Check,
  AlertCircle,
  Info,
  AlertTriangle
} from 'lucide-react';
import { cn } from '../../utils/className';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  removeAllToasts: () => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

/**
 * Individual Toast Component
 */
const ToastItem: React.FC<{
  toast: Toast;
  onRemove: (id: string) => void;
}> = ({ toast, onRemove }) => {
  useEffect(() => {
    if (toast.duration !== 0) {
      const timer = setTimeout(() => {
        onRemove(toast.id);
      }, toast.duration || 5000);

      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, onRemove]);

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <Check className="w-5 h-5 text-green-600" aria-hidden="true" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" aria-hidden="true" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-600" aria-hidden="true" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-600" aria-hidden="true" />;
      default:
        return null;
    }
  };

  const getStyles = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200';
      case 'warning':
        return 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-200';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800 dark:bg-gray-900/20 dark:border-gray-800 dark:text-gray-200';
    }
  };

  return (
    <div
      className={cn(
        'relative flex items-start gap-3 p-4 rounded-lg border shadow-lg backdrop-blur-sm',
        'animate-in slide-in-from-right-full duration-300',
        'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right-full',
        getStyles()
      )}
      role="alert"
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">
        {getIcon()}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">
          {toast.title}
        </div>
        {toast.description && (
          <div className="text-sm mt-1 opacity-90">
            {toast.description}
          </div>
        )}
        {toast.action && (
          <button
            onClick={toast.action.onClick}
            className="text-sm font-medium underline mt-2 hover:no-underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-current rounded"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      {/* Close Button */}
      <button
        onClick={() => onRemove(toast.id)}
        className={cn(
          'flex-shrink-0 text-current/60 hover:text-current transition-colors',
          'rounded-md p-1 hover:bg-current/10 focus:outline-none focus:ring-2 focus:ring-current'
        )}
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

/**
 * Toast Container Component
 */
const ToastContainer: React.FC<{
  toasts: Toast[];
  onRemove: (id: string) => void;
}> = ({ toasts, onRemove }) => {
  if (toasts.length === 0) return null;

  return createPortal(
    <div
      className="fixed top-4 right-4 z-[10000] space-y-2 max-w-sm w-full pointer-events-none"
      aria-label="Notifications"
    >
      <div className="space-y-2 pointer-events-auto">
        {toasts.map(toast => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onRemove={onRemove}
          />
        ))}
      </div>
    </div>,
    document.body
  );
};

/**
 * Toast Provider Component
 */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { ...toast, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const removeAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={{
      toasts,
      addToast,
      removeToast,
      removeAllToasts
    }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

/**
 * Hook for easy toast creation
 */
export const useToastHelpers = () => {
  const { addToast } = useToast();

  return {
    success: useCallback((title: string, description?: string) => {
      addToast({ type: 'success', title, description });
    }, [addToast]),

    error: useCallback((title: string, description?: string) => {
      addToast({ type: 'error', title, description });
    }, [addToast]),

    warning: useCallback((title: string, description?: string) => {
      addToast({ type: 'warning', title, description });
    }, [addToast]),

    info: useCallback((title: string, description?: string) => {
      addToast({ type: 'info', title, description });
    }, [addToast]),

    custom: addToast
  };
};

export default ToastProvider;