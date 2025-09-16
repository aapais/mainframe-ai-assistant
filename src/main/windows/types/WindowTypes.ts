/**
 * Window Management Type Definitions
 * 
 * Comprehensive type system for progressive window management
 * supporting Knowledge-First MVP development approach
 */

import { BrowserWindow, Rectangle } from 'electron';

// Window Types by MVP Level
export type WindowType = 
  // MVP1: Knowledge Base Core
  | 'main'
  
  // MVP2: Pattern Detection & Enrichment  
  | 'pattern-dashboard'
  | 'alert'
  | 'pattern-viewer'
  
  // MVP3: Code Analysis Integration
  | 'code-viewer'
  | 'debug-context'
  | 'code-search'
  
  // MVP4: IDZ Integration & Templates
  | 'project-workspace'
  | 'template-editor'
  | 'export-manager'
  | 'import-wizard'
  
  // MVP5: Enterprise Intelligence Platform
  | 'analytics-dashboard'
  | 'ai-assistant'
  | 'auto-resolution-monitor'
  | 'predictive-dashboard';

// Window Configuration
export interface WindowConfig {
  type: WindowType;
  title: string;
  width: number;
  height: number;
  x?: number;
  y?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  resizable?: boolean;
  minimizable?: boolean;
  maximizable?: boolean;
  closable?: boolean;
  show?: boolean;
  modal?: boolean;
  parent?: string; // Parent window ID
  alwaysOnTop?: boolean;
  skipTaskbar?: boolean;
  webPreferences?: {
    nodeIntegration?: boolean;
    contextIsolation?: boolean;
    enableRemoteModule?: boolean;
    preload?: string;
    webSecurity?: boolean;
    allowRunningInsecureContent?: boolean;
  };
  // Custom properties
  workspace?: string;
  persistent?: boolean; // Save state across sessions
  singleton?: boolean;   // Only one instance allowed
  autoFocus?: boolean;   // Auto focus when created
  theme?: 'light' | 'dark' | 'auto';
}

// Window Instance
export interface WindowInstance {
  id: string;
  type: WindowType;
  window: BrowserWindow;
  config: WindowConfig;
  created: Date;
  lastAccessed?: Date;
  focused: boolean;
  state?: WindowState;
  metadata?: Record<string, any>;
}

// Window State for Persistence
export interface WindowState {
  id: string;
  type: WindowType;
  bounds: Rectangle;
  maximized: boolean;
  minimized: boolean;
  visible: boolean;
  focused: boolean;
  workspace?: string;
  displayId?: number; // Monitor ID
  zIndex?: number;
  customData?: Record<string, any>;
  lastSaved: Date;
}

// Workspace Configuration (MVP4+)
export interface WindowWorkspace {
  id: string;
  name: string;
  description?: string;
  windows: WorkspaceWindowConfig[];
  layout: WorkspaceLayout;
  created: Date;
  lastUsed?: Date;
  active: boolean;
  mvpLevel: number;
}

export interface WorkspaceWindowConfig extends WindowConfig {
  required: boolean;    // Must be open in this workspace
  autoCreate: boolean;  // Create automatically when switching to workspace
  position: 'relative' | 'absolute';
  relationships?: WindowRelationship[];
}

export interface WindowRelationship {
  type: 'parent' | 'child' | 'sibling' | 'modal';
  targetWindowId: string;
  constraint?: 'position' | 'size' | 'visibility' | 'focus';
}

export interface WorkspaceLayout {
  type: 'grid' | 'stack' | 'cascade' | 'custom';
  columns?: number;
  rows?: number;
  margin?: number;
  padding?: number;
  distribution?: 'equal' | 'weighted' | 'custom';
  customPositions?: Array<{
    windowType: WindowType;
    bounds: Rectangle;
  }>;
}

// Window Registry Entry
export interface WindowRegistryEntry {
  instance: WindowInstance;
  relationships: WindowRelationship[];
  dependencies: string[]; // Other windows this depends on
  dependents: string[];   // Windows that depend on this
  health: WindowHealth;
}

export interface WindowHealth {
  responsive: boolean;
  memoryUsage?: number;
  cpuUsage?: number;
  lastHealthCheck: Date;
  errors: string[];
  warnings: string[];
}

// IPC Message Types
export interface WindowIPCMessage {
  id: string;
  sourceWindowId: string;
  targetWindowId?: string; // undefined for broadcast
  channel: string;
  data: any;
  timestamp: Date;
  priority: 'low' | 'normal' | 'high' | 'critical';
  requiresResponse?: boolean;
  responseTimeout?: number;
}

export interface WindowIPCResponse {
  messageId: string;
  success: boolean;
  data?: any;
  error?: string;
  timestamp: Date;
}

// Window Events
export type WindowEvent = 
  | 'created'
  | 'destroyed'
  | 'focused'
  | 'blurred'
  | 'minimized'
  | 'maximized'
  | 'restored'
  | 'moved'
  | 'resized'
  | 'closed'
  | 'hidden'
  | 'shown'
  | 'ready-to-show'
  | 'unresponsive'
  | 'responsive';

export interface WindowEventData {
  windowId: string;
  windowType: WindowType;
  event: WindowEvent;
  timestamp: Date;
  data?: any;
}

// Window Factory Configuration
export interface WindowFactoryConfig {
  mvpLevel: number;
  defaultTheme: string;
  preloadPaths: Record<WindowType, string>;
  rendererPaths: Record<WindowType, string>;
  iconPaths: Record<string, string>;
  defaultConfigs: Record<WindowType, Partial<WindowConfig>>;
}

// Window Manager Statistics
export interface WindowManagerStats {
  totalWindows: number;
  windowsByType: Record<WindowType, number>;
  activeWindows: number;
  memoryUsage: number;
  averageResponseTime: number;
  errorCount: number;
  warningCount: number;
  uptime: number;
  lastHealthCheck: Date;
  workspaces: {
    total: number;
    active: string | null;
    switching: boolean;
  };
}

// Progressive Window Capabilities by MVP
export const MVP_WINDOW_CAPABILITIES: Record<number, {
  maxWindows: number;
  availableTypes: WindowType[];
  features: string[];
  workspaceSupport: boolean;
  multiMonitorSupport: boolean;
}> = {
  1: {
    maxWindows: 1,
    availableTypes: ['main'],
    features: ['basic-window-management', 'state-persistence'],
    workspaceSupport: false,
    multiMonitorSupport: false
  },
  2: {
    maxWindows: 3,
    availableTypes: ['main', 'pattern-dashboard', 'alert', 'pattern-viewer'],
    features: ['multi-window', 'window-coordination', 'alert-popups'],
    workspaceSupport: false,
    multiMonitorSupport: true
  },
  3: {
    maxWindows: 5,
    availableTypes: ['main', 'pattern-dashboard', 'alert', 'pattern-viewer', 'code-viewer', 'debug-context', 'code-search'],
    features: ['code-integration', 'context-windows', 'synchronized-scrolling'],
    workspaceSupport: false,
    multiMonitorSupport: true
  },
  4: {
    maxWindows: 8,
    availableTypes: [
      'main', 'pattern-dashboard', 'alert', 'pattern-viewer',
      'code-viewer', 'debug-context', 'code-search',
      'project-workspace', 'template-editor', 'export-manager', 'import-wizard'
    ],
    features: ['workspaces', 'project-management', 'template-editing', 'idz-integration'],
    workspaceSupport: true,
    multiMonitorSupport: true
  },
  5: {
    maxWindows: 10,
    availableTypes: [
      'main', 'pattern-dashboard', 'alert', 'pattern-viewer',
      'code-viewer', 'debug-context', 'code-search',
      'project-workspace', 'template-editor', 'export-manager', 'import-wizard',
      'analytics-dashboard', 'ai-assistant', 'auto-resolution-monitor', 'predictive-dashboard'
    ],
    features: [
      'enterprise-analytics', 'ai-integration', 'auto-resolution', 
      'predictive-analysis', 'advanced-workspaces', 'role-based-windows'
    ],
    workspaceSupport: true,
    multiMonitorSupport: true
  }
};

// Default Window Configurations by Type
export const DEFAULT_WINDOW_CONFIGS: Record<WindowType, WindowConfig> = {
  // MVP1
  'main': {
    type: 'main',
    title: 'Mainframe Knowledge Assistant',
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    resizable: true,
    show: false,
    persistent: true,
    singleton: true,
    autoFocus: true
  },

  // MVP2
  'pattern-dashboard': {
    type: 'pattern-dashboard',
    title: 'Pattern Detection Dashboard',
    width: 1200,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    resizable: true,
    show: false,
    persistent: true,
    singleton: true
  },

  'alert': {
    type: 'alert',
    title: 'System Alert',
    width: 400,
    height: 300,
    minWidth: 350,
    minHeight: 250,
    maxWidth: 600,
    maxHeight: 400,
    resizable: true,
    modal: true,
    alwaysOnTop: true,
    show: true,
    persistent: false,
    singleton: false
  },

  'pattern-viewer': {
    type: 'pattern-viewer',
    title: 'Pattern Analysis',
    width: 800,
    height: 600,
    minWidth: 600,
    minHeight: 400,
    resizable: true,
    show: false,
    persistent: false,
    singleton: false
  },

  // MVP3
  'code-viewer': {
    type: 'code-viewer',
    title: 'COBOL Code Viewer',
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 500,
    resizable: true,
    show: false,
    persistent: true,
    singleton: false
  },

  'debug-context': {
    type: 'debug-context',
    title: 'Debug Context',
    width: 600,
    height: 400,
    minWidth: 400,
    minHeight: 300,
    resizable: true,
    show: false,
    persistent: false,
    singleton: false
  },

  'code-search': {
    type: 'code-search',
    title: 'Code Search',
    width: 500,
    height: 600,
    minWidth: 400,
    minHeight: 400,
    resizable: true,
    show: false,
    persistent: false,
    singleton: true
  },

  // MVP4
  'project-workspace': {
    type: 'project-workspace',
    title: 'Project Workspace',
    width: 1300,
    height: 800,
    minWidth: 1000,
    minHeight: 600,
    resizable: true,
    show: false,
    persistent: true,
    singleton: false
  },

  'template-editor': {
    type: 'template-editor',
    title: 'Template Editor',
    width: 900,
    height: 600,
    minWidth: 700,
    minHeight: 500,
    resizable: true,
    show: false,
    persistent: true,
    singleton: false
  },

  'export-manager': {
    type: 'export-manager',
    title: 'Export Manager',
    width: 700,
    height: 500,
    minWidth: 600,
    minHeight: 400,
    resizable: true,
    show: false,
    persistent: false,
    singleton: true
  },

  'import-wizard': {
    type: 'import-wizard',
    title: 'Import Wizard',
    width: 800,
    height: 600,
    minWidth: 700,
    minHeight: 500,
    resizable: true,
    modal: true,
    show: true,
    persistent: false,
    singleton: true
  },

  // MVP5
  'analytics-dashboard': {
    type: 'analytics-dashboard',
    title: 'Analytics Dashboard',
    width: 1400,
    height: 800,
    minWidth: 1200,
    minHeight: 700,
    resizable: true,
    show: false,
    persistent: true,
    singleton: true
  },

  'ai-assistant': {
    type: 'ai-assistant',
    title: 'AI Assistant',
    width: 400,
    height: 600,
    minWidth: 350,
    minHeight: 400,
    resizable: true,
    show: false,
    persistent: true,
    singleton: true,
    alwaysOnTop: false
  },

  'auto-resolution-monitor': {
    type: 'auto-resolution-monitor',
    title: 'Auto-Resolution Monitor',
    width: 900,
    height: 500,
    minWidth: 700,
    minHeight: 400,
    resizable: true,
    show: false,
    persistent: true,
    singleton: true
  },

  'predictive-dashboard': {
    type: 'predictive-dashboard',
    title: 'Predictive Analytics',
    width: 1200,
    height: 700,
    minWidth: 1000,
    minHeight: 600,
    resizable: true,
    show: false,
    persistent: true,
    singleton: true
  }
};

// Validation Functions
export function isValidWindowType(type: string): type is WindowType {
  return Object.keys(DEFAULT_WINDOW_CONFIGS).includes(type as WindowType);
}

export function getAvailableWindowTypes(mvpLevel: number): WindowType[] {
  return MVP_WINDOW_CAPABILITIES[mvpLevel]?.availableTypes || [];
}

export function isWindowTypeAvailable(type: WindowType, mvpLevel: number): boolean {
  return getAvailableWindowTypes(mvpLevel).includes(type);
}

export function getMaxWindowsForMVP(mvpLevel: number): number {
  return MVP_WINDOW_CAPABILITIES[mvpLevel]?.maxWindows || 1;
}