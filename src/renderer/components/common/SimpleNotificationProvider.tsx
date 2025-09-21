import React from 'react';

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <div>{children}</div>;
};

export const useNotificationSystem = () => {
  return {
    info: (message: string) => console.log('[INFO]', message),
    success: (message: string) => console.log('[SUCCESS]', message),
    error: (message: string) => console.error('[ERROR]', message),
    warning: (message: string) => console.warn('[WARNING]', message)
  };
};