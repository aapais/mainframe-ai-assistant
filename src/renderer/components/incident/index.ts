/**
 * Incident Management Components
 * Export all incident-related components
 */

export { default as IncidentQueue } from './IncidentQueue';
export { default as IncidentDashboard } from '../../views/IncidentDashboard';
export { default as PriorityBadge } from './PriorityBadge';
export { default as StatusBadge } from './StatusBadge';
export { default as QuickActions } from './QuickActions';
export { default as StatusWorkflow } from './StatusWorkflow';

// Re-export types for convenience
export type {
  IncidentKBEntry,
  IncidentStatus,
  IncidentPriority,
  IncidentFilter,
  IncidentMetrics,
  BulkOperation,
  StatusTransition,
  IncidentComment,
  IncidentQueueProps,
  IncidentDashboardProps,
  PriorityBadgeProps,
  StatusBadgeProps
} from '../../../types/incident';
