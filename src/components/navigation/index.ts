/**
 * Navigation Components Export Index
 * Centralized exports for all navigation components
 */

// Core Navigation Components
export { BreadcrumbNavigation } from './BreadcrumbNavigation';
export type { BreadcrumbNavigationProps, BreadcrumbItem } from './BreadcrumbNavigation';

export { CategoryFilters } from './CategoryFilters';
export type { CategoryFiltersProps, FilterOption, FilterPreset } from './CategoryFilters';

export { QuickAccessPatterns } from './QuickAccessPatterns';
export type {
  QuickAccessPatternsProps,
  QuickAccessItem,
  AccessPattern
} from './QuickAccessPatterns';

export { SearchResultNavigation } from './SearchResultNavigation';
export type {
  SearchResultNavigationProps,
  SearchResult,
  SearchContext,
  ResultCluster
} from './SearchResultNavigation';

export { RecentlyViewedSidebar } from './RecentlyViewedSidebar';
export type {
  RecentlyViewedSidebarProps,
  RecentEntry,
  TimeGroup
} from './RecentlyViewedSidebar';

export { NavigationShortcuts } from './NavigationShortcuts';
export type {
  NavigationShortcutsProps,
  KeyBinding,
  ShortcutAction,
  ShortcutCategory
} from './NavigationShortcuts';

// Integrated System
export { IntegratedNavigationSystem } from './IntegratedNavigationSystem';
export type {
  IntegratedNavigationSystemProps,
  NavigationContext,
  NavigationConfig
} from './IntegratedNavigationSystem';

// Navigation Icons
export * from '../icons/NavigationIcons';

// CSS Imports (for proper styling)
import './BreadcrumbNavigation.css';
import './CategoryFilters.css';
import './QuickAccessPatterns.css';
import './SearchResultNavigation.css';
import './RecentlyViewedSidebar.css';
import './NavigationShortcuts.css';
import './IntegratedNavigationSystem.css';