/**
 * Preload Script for Electron IPC
 * Exposes safe IPC methods to renderer process
 */

import { contextBridge, ipcRenderer } from 'electron';

// Define the API interface
export interface ElectronAPI {
  kb: {
    search: (query: string) => Promise<any>;
    getEntry: (id: string) => Promise<any>;
    addEntry: (entry: any) => Promise<any>;
    updateEntry: (id: string, entry: any) => Promise<any>;
    rateEntry: (id: string, successful: boolean) => Promise<any>;
    getMetrics: () => Promise<any>;
  };
}

// Expose the API to the renderer process
const electronAPI: ElectronAPI = {
  kb: {
    search: (query: string) => ipcRenderer.invoke('kb:search', query),
    getEntry: (id: string) => ipcRenderer.invoke('kb:getEntry', id),
    addEntry: (entry: any) => ipcRenderer.invoke('kb:addEntry', entry),
    updateEntry: (id: string, entry: any) => ipcRenderer.invoke('kb:updateEntry', id, entry),
    rateEntry: (id: string, successful: boolean) => ipcRenderer.invoke('kb:rateEntry', id, successful),
    getMetrics: () => ipcRenderer.invoke('kb:getMetrics'),
  },
};

// Expose the API safely
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Type declaration for TypeScript
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}