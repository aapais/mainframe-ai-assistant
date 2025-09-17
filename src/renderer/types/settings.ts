/**
 * Settings Navigation Types
 * TypeScript interfaces for the settings navigation system
 */

import { ReactNode } from 'react';

// Settings navigation structure
export interface SettingsSection {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  path: string;
  category: SettingsCategory;
  keywords: string[];
  subsections?: SettingsSubsection[];
  badge?: string;
  disabled?: boolean;
}

export interface SettingsSubsection {
  id: string;
  title: string;
  description: string;
  path: string;
  keywords: string[];
  badge?: string;
  disabled?: boolean;
}

export interface SettingsCategory {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  color: string;
  order: number;
}

// Navigation state
export interface SettingsNavigationState {
  activeSection: string;
  activeSubsection?: string;
  searchQuery: string;
  isSearching: boolean;
  isMobileMenuOpen: boolean;
  breadcrumbs: BreadcrumbItem[];
  filteredSections: SettingsSection[];
}

export interface BreadcrumbItem {
  id: string;
  title: string;
  path: string;
  icon?: ReactNode;
  isActive?: boolean;
}

// Search functionality
export interface SettingsSearchResult {
  section: SettingsSection;
  subsection?: SettingsSubsection;
  relevanceScore: number;
  matchedKeywords: string[];
}

// Navigation context
export interface SettingsNavigationContext {
  state: SettingsNavigationState;
  actions: {
    setActiveSection: (sectionId: string, subsectionId?: string) => void;
    setSearchQuery: (query: string) => void;
    clearSearch: () => void;
    toggleMobileMenu: () => void;
    navigateToSection: (path: string) => void;
    goBack: () => void;
  };
}

// Component props
export interface SettingsNavigationProps {
  sections: SettingsSection[];
  categories: SettingsCategory[];
  currentPath?: string;
  onNavigate?: (path: string) => void;
  className?: string;
  isMobile?: boolean;
}

export interface SettingsSidebarProps extends SettingsNavigationProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export interface SettingsBreadcrumbProps {
  breadcrumbs: BreadcrumbItem[];
  onNavigate: (path: string) => void;
  className?: string;
}

export interface SettingsSearchProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
  placeholder?: string;
  className?: string;
}

// Theme and styling
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
  disabled: string;
}