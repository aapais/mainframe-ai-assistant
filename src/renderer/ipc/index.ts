/**
 * IPC Module Exports
 * Centralized exports for all IPC-related components
 */

// Core IPC classes
export { IPCClient, ipcClient } from './IPCClient';
export { IPCBridge, ipcBridge } from './IPCBridge';

// Types
export type { IPCError, IPCOptions, IPCResponse } from './IPCClient';
export type { BridgeEvents } from './IPCBridge';

// Re-export shared types for convenience
export type {
  KBEntry,
  KBEntryInput,
  KBEntryUpdate,
  SearchResult,
  SearchQuery,
  DatabaseMetrics,
  ElectronAPI,
  AppError,
  AppErrorType,
} from '../../types';
