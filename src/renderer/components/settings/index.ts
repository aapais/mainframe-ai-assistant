/**
 * Settings Components Index
 * Centralized exports for all settings-related components
 */

// Core Settings Components
export { default as SettingsModal } from './SettingsModal';
export { default as SettingsNavigation } from './SettingsNavigation';
export { default as EnhancedFloatingWidget } from './EnhancedFloatingWidget';
export { default as AccessibilityProvider, useAccessibility, useAccessibilityClasses, ColorContrast } from './AccessibilityProvider';

// Individual Settings Panels
export { default as APISettings } from './APISettings';
export { default as ProfileSettings } from './ProfileSettings';
export { default as PreferencesSettings } from './PreferencesSettings';
export { default as CostManagementSettings } from './CostManagementSettings';
export { default as SecuritySettings } from './SecuritySettings';
export { default as PerformanceSettings } from './PerformanceSettings';
export { default as LayoutSettings } from './LayoutSettings';
export { default as DeveloperSettings } from './DeveloperSettings';
export { default as DatabaseSettings } from './DatabaseSettings';
export { default as NotificationSettings } from './NotificationSettings';
export { default as IntegrationsSettings } from './IntegrationsSettings';
export { default as WidgetConfigurationSettings } from './WidgetConfigurationSettings';

// Utility Components
export { default as QuickAccessWidget } from './QuickAccessWidget';
export { SearchCommand } from './SearchCommand';
export { default as SearchCommandExample, useSearchCommand } from './SearchCommandExample';
export { default as AccessibleSettingsNavigation } from './AccessibleSettingsNavigation';

// Lazy Loading Components
export { default as LazySettingsPanel } from './LazySettingsPanel';

// Hooks
export {
  useSettingsNavigation,
  useSettingsSearch,
  useExpandedCategories,
  useResponsiveNavigation,
  useKeyboardNavigation,
  useNavigationAnalytics
} from './SettingsNavigationHooks';

// Types
export type {
  SettingsSection,
  SettingsSubsection,
  SettingsCategory,
  SettingsNavigationState,
  SettingsSearchResult,
  BreadcrumbItem,
  SettingsNavigationContext,
  SettingsNavigationProps,
  SettingsSidebarProps,
  SettingsBreadcrumbProps,
  SettingsSearchProps,
  SettingsTheme
} from '../../types/settings';

// CSS
import './SettingsNavigationCSS.css';