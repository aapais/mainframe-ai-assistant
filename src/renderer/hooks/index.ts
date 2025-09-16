/**
 * Hooks Module Exports
 * Centralized exports for all React hooks
 */

// Knowledge Base hooks
export { useKnowledgeBase } from './useKnowledgeBase';
export type { 
  UseKnowledgeBaseState, 
  UseKnowledgeBaseReturn, 
  UseKnowledgeBaseOptions 
} from './useKnowledgeBase';

// Search hooks
export { useSearch } from './useSearch';
export type { 
  UseSearchState, 
  UseSearchOptions, 
  UseSearchReturn 
} from './useSearch';

// Metrics hooks
export { useMetrics } from './useMetrics';
export type { 
  UseMetricsState, 
  UseMetricsOptions, 
  UseMetricsReturn, 
  ExtendedMetrics 
} from './useMetrics';

// Focus Management hooks
export {
  useFocusManagement,
  useFocusTrapSimple,
  useFocusRestore
} from './useFocusManagement';
export type {
  FocusManagementConfig,
  FocusManagementReturn,
  TypeaheadConfig,
  TypeaheadReturn
} from './useFocusManagement';

// Enhanced Keyboard Navigation hooks
export {
  useKeyboardNavigation,
  useListNavigation,
  useModalNavigation,
  useFormNavigation,
  useGridNavigation,
  useTypeahead,
  useArrowKeyNavigation,
  useMenuNavigation,
  useTabNavigation
} from './useKeyboardNavigation';
export type {
  NavigationConfig,
  KeyboardNavigationResult
} from './useKeyboardNavigation';

// UX Enhancement hooks
export { useUXEnhancements } from './useUXEnhancements';
export type {
  UXEnhancementsOptions,
  UXEnhancementsReturn,
  AnimationPreference,
  MotionPreference
} from './useUXEnhancements';

// Form hooks
export { useForm } from './useForm';
export type {
  UseFormState,
  UseFormOptions,
  UseFormReturn,
  ValidationRule,
  FormData
} from './useForm';

// KB Data hooks
export { useKBData } from './useKBData';
export type {
  UseKBDataState,
  UseKBDataReturn,
  UseKBDataOptions
} from './useKBData';

// Screen Reader hooks
export { useScreenReaderAnnouncements } from './useScreenReaderAnnouncements';
export type {
  UseScreenReaderOptions,
  UseScreenReaderReturn,
  AnnouncementPriority,
  AnnouncementOptions
} from './useScreenReaderAnnouncements';

// Context hooks
export { useIPC, IPCProvider, IPCErrorBoundary } from '../context/IPCContext';
export type {
  IPCContextState,
  IPCContextValue,
  IPCProviderProps,
  IPCErrorBoundaryProps
} from '../context/IPCContext';