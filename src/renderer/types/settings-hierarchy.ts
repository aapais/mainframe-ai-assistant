/**
 * Settings Hierarchy Types - New 4-Tier Information Architecture
 * Defines the complete type system for the restructured settings
 */

import { ReactNode } from 'react';

// ============================================================================
// TIER 1: Main Categories (4 categories)
// ============================================================================

export type SettingsMainCategory = 'essentials' | 'workspace' | 'system' | 'account';

export interface SettingsCategoryDefinition {
  id: SettingsMainCategory;
  title: string;
  description: string;
  icon: ReactNode;
  color: string;
  order: number;
  requiredRole?: UserRole[];
}

// ============================================================================
// TIER 2: Subcategories (2-4 per main category)
// ============================================================================

export type EssentialsSubcategory = 'quick-setup' | 'ai-services' | 'notifications' | 'preferences';

export type WorkspaceSubcategory = 'appearance' | 'layout' | 'productivity' | 'accessibility';

export type SystemSubcategory = 'api-config' | 'performance' | 'database' | 'developer';

export type AccountSubcategory = 'profile' | 'security' | 'data-privacy' | 'billing';

export type SettingsSubcategory =
  | EssentialsSubcategory
  | WorkspaceSubcategory
  | SystemSubcategory
  | AccountSubcategory;

export interface SettingsSubcategoryDefinition {
  id: SettingsSubcategory;
  title: string;
  description: string;
  icon: ReactNode;
  category: SettingsMainCategory;
  order: number;
  requiredRole?: UserRole[];
  badge?: string;
}

// ============================================================================
// TIER 3: Setting Groups (3-6 per subcategory)
// ============================================================================

export interface SettingsGroup {
  id: string;
  title: string;
  description: string;
  subcategory: SettingsSubcategory;
  order: number;
  settings: SettingsItem[];
  collapsible?: boolean;
  defaultExpanded?: boolean;
  requiredRole?: UserRole[];
}

// ============================================================================
// TIER 4: Individual Settings
// ============================================================================

export type SettingsInputType =
  | 'toggle'
  | 'text'
  | 'number'
  | 'email'
  | 'password'
  | 'select'
  | 'multiSelect'
  | 'slider'
  | 'color'
  | 'file'
  | 'date'
  | 'time'
  | 'textarea'
  | 'json'
  | 'keyValue';

export interface SettingsItem {
  id: string;
  title: string;
  description: string;
  type: SettingsInputType;
  defaultValue: any;
  currentValue?: any;
  required?: boolean;
  validation?: SettingsValidation;
  options?: SettingsOption[];
  group: string;
  order: number;
  helpText?: string;
  warningText?: string;
  dependsOn?: string; // ID of another setting
  requiredRole?: UserRole[];
  experimental?: boolean;
}

export interface SettingsOption {
  value: any;
  label: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SettingsValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  custom?: (value: any) => string | null;
}

// ============================================================================
// URL Routing and Navigation
// ============================================================================

export interface SettingsRoute {
  category: SettingsMainCategory;
  subcategory?: SettingsSubcategory;
  group?: string;
  setting?: string;
}

export type SettingsPath =
  | `/settings/${SettingsMainCategory}/${SettingsSubcategory}`
  | `/settings/${SettingsMainCategory}/${SettingsSubcategory}#${string}`;

// ============================================================================
// User Roles and Permissions
// ============================================================================

export type UserRole =
  | 'business_analyst'
  | 'technical_consultant'
  | 'project_manager'
  | 'developer'
  | 'administrator'
  | 'viewer';

export interface UserRoleDefinition {
  id: UserRole;
  title: string;
  description: string;
  permissions: string[];
  defaultPreset: SettingsPreset;
}

// ============================================================================
// Presets and Quick Setup
// ============================================================================

export interface SettingsPreset {
  id: string;
  name: string;
  description: string;
  role: UserRole;
  settings: Record<string, any>;
  features: string[];
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuickSetupStep {
  id: string;
  title: string;
  description: string;
  component: ReactNode;
  order: number;
  required: boolean;
  estimatedTime: number; // seconds
  dependencies?: string[];
}

export interface QuickSetupWizard {
  id: string;
  title: string;
  description: string;
  steps: QuickSetupStep[];
  targetRole?: UserRole;
  estimatedTotalTime: number;
}

// ============================================================================
// Search and Filtering
// ============================================================================

export interface SettingsSearchResult {
  item: SettingsItem | SettingsGroup | SettingsSubcategoryDefinition;
  type: 'setting' | 'group' | 'subcategory';
  relevanceScore: number;
  matchedKeywords: string[];
  path: SettingsPath;
  breadcrumbs: string[];
}

export interface SettingsFilter {
  category?: SettingsMainCategory[];
  subcategory?: SettingsSubcategory[];
  role?: UserRole[];
  type?: SettingsInputType[];
  experimental?: boolean;
  modified?: boolean;
  searchQuery?: string;
}

// ============================================================================
// State Management
// ============================================================================

export interface SettingsState {
  // Navigation state
  currentRoute: SettingsRoute;
  breadcrumbs: BreadcrumbItem[];

  // UI state
  sidebarCollapsed: boolean;
  mobileMenuOpen: boolean;
  searchQuery: string;
  activeFilters: SettingsFilter;

  // Data state
  settings: Record<string, any>;
  presets: SettingsPreset[];
  userRole: UserRole;
  hasUnsavedChanges: boolean;

  // Loading states
  loading: boolean;
  saving: boolean;
  error: string | null;

  // Quick setup
  quickSetupCompleted: boolean;
  currentWizard?: QuickSetupWizard;
  currentStep?: number;
}

export interface BreadcrumbItem {
  id: string;
  title: string;
  path: SettingsPath;
  icon?: ReactNode;
  active?: boolean;
}

// ============================================================================
// Component Props
// ============================================================================

export interface SettingsPageProps {
  initialRoute?: SettingsRoute;
  userRole?: UserRole;
  onRouteChange?: (route: SettingsRoute) => void;
  onSettingsChange?: (settings: Record<string, any>) => void;
}

export interface SettingsNavigationProps {
  currentRoute: SettingsRoute;
  userRole: UserRole;
  collapsed?: boolean;
  onRouteChange: (route: SettingsRoute) => void;
  onToggleCollapse?: () => void;
}

export interface SettingsContentProps {
  route: SettingsRoute;
  settings: Record<string, any>;
  userRole: UserRole;
  onSettingsChange: (key: string, value: any) => void;
  onBulkSettingsChange: (settings: Record<string, any>) => void;
}

export interface SettingsBreadcrumbProps {
  breadcrumbs: BreadcrumbItem[];
  onNavigate: (route: SettingsRoute) => void;
}

export interface SettingsSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  onResultSelect: (result: SettingsSearchResult) => void;
  placeholder?: string;
}

export interface QuickSetupWizardProps {
  wizard: QuickSetupWizard;
  currentStep: number;
  onStepChange: (step: number) => void;
  onComplete: (settings: Record<string, any>) => void;
  onCancel: () => void;
}

// ============================================================================
// Analytics and Tracking
// ============================================================================

export interface SettingsAnalytics {
  pageViews: Record<SettingsPath, number>;
  settingChanges: Record<string, number>;
  searchQueries: string[];
  userJourneys: SettingsUserJourney[];
  errors: SettingsError[];
}

export interface SettingsUserJourney {
  sessionId: string;
  userRole: UserRole;
  startTime: Date;
  endTime: Date;
  paths: SettingsPath[];
  settingsChanged: string[];
  completed: boolean;
}

export interface SettingsError {
  id: string;
  timestamp: Date;
  route: SettingsRoute;
  error: string;
  userRole: UserRole;
  userAgent: string;
}

// ============================================================================
// API Interfaces
// ============================================================================

export interface SettingsAPI {
  // Settings CRUD
  getSettings: (keys?: string[]) => Promise<Record<string, any>>;
  updateSetting: (key: string, value: any) => Promise<void>;
  updateBulkSettings: (settings: Record<string, any>) => Promise<void>;
  resetSettings: (keys?: string[]) => Promise<void>;

  // Presets
  getPresets: (role?: UserRole) => Promise<SettingsPreset[]>;
  applyPreset: (presetId: string) => Promise<void>;
  savePreset: (
    preset: Omit<SettingsPreset, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<SettingsPreset>;
  deletePreset: (presetId: string) => Promise<void>;

  // Import/Export
  exportSettings: (format: 'json' | 'yaml') => Promise<string>;
  importSettings: (data: string, format: 'json' | 'yaml') => Promise<void>;

  // Validation
  validateSetting: (key: string, value: any) => Promise<string | null>;
  validateBulkSettings: (settings: Record<string, any>) => Promise<Record<string, string | null>>;

  // Search
  searchSettings: (query: string, filters?: SettingsFilter) => Promise<SettingsSearchResult[]>;

  // Analytics
  trackPageView: (path: SettingsPath) => Promise<void>;
  trackSettingChange: (key: string, oldValue: any, newValue: any) => Promise<void>;
  trackUserJourney: (journey: Omit<SettingsUserJourney, 'sessionId'>) => Promise<void>;
}

// ============================================================================
// Theme and Styling
// ============================================================================

export interface SettingsTheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  hover: string;
  active: string;
  success: string;
  warning: string;
  error: string;
  info: string;
}

export interface SettingsSpacing {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  xxl: string;
}

export interface SettingsBreakpoints {
  mobile: string;
  tablet: string;
  desktop: string;
  wide: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export type SettingsChangeHandler = (key: string, value: any) => void;
export type SettingsBulkChangeHandler = (settings: Record<string, any>) => void;
export type SettingsRouteChangeHandler = (route: SettingsRoute) => void;
export type SettingsSearchHandler = (query: string) => void;

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type SettingsConfig = DeepPartial<{
  categories: SettingsCategoryDefinition[];
  subcategories: SettingsSubcategoryDefinition[];
  groups: SettingsGroup[];
  items: SettingsItem[];
  presets: SettingsPreset[];
  theme: SettingsTheme;
  spacing: SettingsSpacing;
  breakpoints: SettingsBreakpoints;
}>;
