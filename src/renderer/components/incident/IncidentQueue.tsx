/**
 * Incident Queue Component
 * List view with status columns, priority badges, filters, and bulk actions
 */

import React, { useState, useEffect, useMemo } from 'react';
import PriorityBadge from './PriorityBadge';
import StatusBadge from './StatusBadge';
import RelatedIncidentsPanel from './RelatedIncidentsPanel';
import BulkUploadModal from './BulkUploadModal';
import EditIncidentModal from './EditIncidentModal';
import { useSearchDebounce } from '../../hooks/useSmartDebounce';
import { useGlobalKeyboardShortcuts } from '../../hooks/useGlobalKeyboardShortcuts';
import IncidentService from '../../services/IncidentService';
import {
  IncidentQueueProps,
  IncidentKBEntry,
  IncidentFilter,
  IncidentSort,
  BulkOperation,
  QuickAction,
  IncidentStatus
} from '../../../types/incident';

interface EnhancedIncidentQueueProps extends IncidentQueueProps {
  showKnowledgeColumns?: boolean;
  showActiveOnly?: boolean;
}

const IncidentQueue: React.FC<EnhancedIncidentQueueProps> = ({
  filters = {},
  config,
  onIncidentSelect,
  onBulkAction,
  height = 600,
  showKnowledgeColumns = false,
  showActiveOnly = false
}) => {
  const [incidents, setIncidents] = useState<IncidentKBEntry[]>([]);
  const [selectedIncidents, setSelectedIncidents] = useState<Set<string>>(new Set());
  const [currentFilters, setCurrentFilters] = useState<IncidentFilter>(filters);
  const [sort, setSort] = useState<IncidentSort>({ field: 'priority', direction: 'desc' });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [internalShowActiveOnly, setInternalShowActiveOnly] = useState(true); // Internal state for toggle

  // Use external prop if provided, otherwise use internal state
  const activeShowActiveOnly = showActiveOnly !== undefined ? showActiveOnly : internalShowActiveOnly;
  const [selectedIncident, setSelectedIncident] = useState<IncidentKBEntry | null>(null);
  const [showRelatedPanel, setShowRelatedPanel] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  // Modal states
  const [openViewModal, setOpenViewModal] = useState(false);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [selectedIncidentForModal, setSelectedIncidentForModal] = useState<IncidentKBEntry | null>(null);

  // Enhanced search with smart debouncing
  const {
    debouncedValue: searchValue,
    autocompleteValue,
    isSearchPending,
    flush: flushSearch,
    updateImmediate: setSearchImmediate
  } = useSearchDebounce(searchQuery, {
    autocompleteDelay: 150,
    searchDelay: 300,
    minQueryLength: 1,
    minSearchLength: 1
  });

  // INTEGRATED APPROACH: Load comprehensive mainframe knowledge base
  useEffect(() => {
    // Import and load knowledge base
    const loadKnowledgeBase = async () => {
      try {
        const { KnowledgeBaseMigrationService } = await import('../../../services/KnowledgeBaseMigration');
        const knowledgeIncidents = KnowledgeBaseMigrationService.getAllKnowledgeAsIncidents();

        // Add some current active incidents
        const activeIncidents: IncidentKBEntry[] = [
          {
            id: 'active-001',
            title: 'New JCL Job Failing with S0C4 ABEND',
            problem: 'Production JCL job failing with system completion code S0C4',
            solution: 'Under investigation - checking program for array bounds violation',
            category: 'JCL',
            tags: ['production', 'abend', 's0c4', 'urgent'],
            created_at: new Date('2024-01-15T10:30:00'),
            updated_at: new Date('2024-01-15T11:00:00'),
            created_by: 'system',
            usage_count: 0,
            success_count: 0,
            failure_count: 0,
            version: 1,
            status: 'aberto',
            priority: 'P1',
            escalation_level: 'none',
            assigned_to: undefined,
            business_impact: 'critical',
            customer_impact: true,
            incident_number: 'INC-2024-100',
            reporter: 'ops.team@accenture.com'
          },
          {
            id: 'active-002',
            title: 'DB2 Connection Pool Issues',
            problem: 'Application experiencing intermittent DB2 connection failures',
            solution: 'Investigating connection pool configuration and monitoring',
            category: 'DB2',
            tags: ['database', 'connections', 'pool', 'performance'],
            created_at: new Date('2024-01-15T09:15:00'),
            updated_at: new Date('2024-01-15T10:45:00'),
            created_by: 'dba.team',
            usage_count: 0,
            success_count: 0,
            failure_count: 0,
            version: 1,
            status: 'em_tratamento',
            priority: 'P2',
            escalation_level: 'none',
            assigned_to: 'john.doe@accenture.com',
            business_impact: 'high',
            customer_impact: false,
            incident_number: 'INC-2024-101',
            reporter: 'app.team@accenture.com'
          },
          {
            id: 'active-003',
            title: 'CICS Region Memory Issues',
            problem: 'CICS region experiencing frequent short-on-storage conditions',
            solution: 'Analyzing storage usage and optimizing memory allocation',
            category: 'CICS',
            tags: ['cics', 'memory', 'storage', 'performance'],
            created_at: new Date('2024-01-15T14:00:00'),
            updated_at: new Date('2024-01-15T14:30:00'),
            created_by: 'cics.admin',
            usage_count: 0,
            success_count: 0,
            failure_count: 0,
            version: 1,
            status: 'em_tratamento',
            priority: 'P2',
            escalation_level: 'none',
            assigned_to: 'cics.specialist@accenture.com',
            business_impact: 'medium',
            customer_impact: true,
            incident_number: 'INC-2024-102',
            reporter: 'monitoring@accenture.com'
          }
        ];

        // Combine active incidents with knowledge base
        const allIncidents = [...activeIncidents, ...knowledgeIncidents];
        setIncidents(allIncidents);
        setLoading(false);

      } catch (error) {
        console.error('Error loading knowledge base:', error);
        // Fallback to basic mock data if import fails
        const basicIncidents: IncidentKBEntry[] = [
        {
          id: '3',
          title: 'VSAM File Corruption Detected',
          problem: 'VSAM dataset showing logical record length inconsistencies during batch processing',
          solution: 'Run IDCAMS VERIFY utility to check file integrity, then use IDCAMS REBUILD to reconstruct indexes if corruption is detected',
          category: 'VSAM',
          tags: ['vsam', 'corruption', 'data', 'batch'],
          created_at: new Date('2024-01-10T08:00:00'),
          updated_at: new Date('2024-01-10T09:30:00'),
          created_by: 'storage.team',
          usage_count: 15,
          success_count: 14,
          failure_count: 1,
          version: 1,
          status: 'resolvido',
          priority: 'P2',
          escalation_level: 'none',
          assigned_to: 'jane.smith@company.com',
          business_impact: 'medium',
          customer_impact: false,
          incident_number: 'INC-2024-003',
          reporter: 'storage.team@company.com',
          resolution_time: 90,
          resolver: 'jane.smith@company.com'
        },
        {
          id: '4',
          title: 'COBOL Program ABEND-0C7 Data Exception',
          problem: 'COBOL program terminating with S0C7 abend due to invalid numeric data',
          solution: 'Add data validation checks before numeric operations and use NUMVAL function to validate packed decimal fields',
          category: 'COBOL',
          tags: ['cobol', 'abend', 's0c7', 'numeric'],
          created_at: new Date('2024-01-08T14:30:00'),
          updated_at: new Date('2024-01-08T16:00:00'),
          created_by: 'dev.team',
          usage_count: 22,
          success_count: 21,
          failure_count: 1,
          version: 1,
          status: 'resolvido',
          priority: 'P1',
          escalation_level: 'none',
          assigned_to: 'senior.dev@company.com',
          business_impact: 'high',
          customer_impact: true,
          incident_number: 'INC-2024-004',
          reporter: 'qa.team@company.com',
          resolution_time: 90,
          resolver: 'senior.dev@company.com'
        },
        {
          id: '5',
          title: 'CICS Transaction ABEND ASRA',
          problem: 'CICS transaction failing with ASRA abend in customer update program',
          solution: 'Check for null pointer references and add proper error handling for COMMAREA validation',
          category: 'CICS',
          tags: ['cics', 'asra', 'transaction', 'pointer'],
          created_at: new Date('2024-01-05T11:15:00'),
          updated_at: new Date('2024-01-05T13:45:00'),
          created_by: 'cics.admin',
          usage_count: 8,
          success_count: 8,
          failure_count: 0,
          version: 1,
          status: 'resolvido',
          priority: 'P2',
          escalation_level: 'none',
          assigned_to: 'cics.expert@company.com',
          business_impact: 'medium',
          customer_impact: true,
          incident_number: 'INC-2024-005',
          reporter: 'business.team@company.com',
          resolution_time: 150,
          resolver: 'cics.expert@company.com'
        },
        {
          id: '6',
          title: 'JCL STEP ABEND S222 Time Limit Exceeded',
          problem: 'Batch job step exceeding time limit and getting S222 abend',
          solution: 'Increase TIME parameter in JCL step or add TIME=NOLIMIT for long-running processes',
          category: 'JCL',
          tags: ['jcl', 's222', 'time', 'batch'],
          created_at: new Date('2024-01-03T16:20:00'),
          updated_at: new Date('2024-01-03T16:45:00'),
          created_by: 'ops.team',
          usage_count: 12,
          success_count: 12,
          failure_count: 0,
          version: 1,
          status: 'resolvido',
          priority: 'P3',
          escalation_level: 'none',
          assigned_to: 'jcl.specialist@company.com',
          business_impact: 'low',
          customer_impact: false,
          incident_number: 'INC-2024-006',
          reporter: 'scheduler@company.com',
          resolution_time: 25,
          resolver: 'jcl.specialist@company.com'
        },
        {
          id: '7',
          title: 'DB2 Deadlock on Customer Table',
          problem: 'Multiple transactions causing deadlocks on CUSTOMER table during peak hours',
          solution: 'Implement lock timeout and retry logic, consider table partitioning for high-volume operations',
          category: 'DB2',
          tags: ['db2', 'deadlock', 'locking', 'performance'],
          created_at: new Date('2024-01-02T09:30:00'),
          updated_at: new Date('2024-01-02T12:00:00'),
          created_by: 'dba.team',
          usage_count: 18,
          success_count: 17,
          failure_count: 1,
          version: 1,
          status: 'resolvido',
          priority: 'P2',
          escalation_level: 'none',
          assigned_to: 'senior.dba@company.com',
          business_impact: 'high',
          customer_impact: true,
          incident_number: 'INC-2024-007',
          reporter: 'app.team@company.com',
          resolution_time: 150,
          resolver: 'senior.dba@company.com'
        },
        {
          id: '8',
          title: 'IMS Database Segment Not Found',
          problem: 'IMS application getting GE status code when accessing hierarchical database',
          solution: 'Check segment sequence and parent-child relationships, verify PCB mask definitions',
          category: 'IMS',
          tags: ['ims', 'database', 'hierarchy', 'segment'],
          created_at: new Date('2023-12-28T13:45:00'),
          updated_at: new Date('2023-12-28T15:30:00'),
          created_by: 'ims.admin',
          usage_count: 6,
          success_count: 6,
          failure_count: 0,
          version: 1,
          status: 'resolvido',
          priority: 'P3',
          escalation_level: 'none',
          assigned_to: 'ims.specialist@company.com',
          business_impact: 'medium',
          customer_impact: false,
          incident_number: 'INC-2023-045',
          reporter: 'legacy.app@company.com',
          resolution_time: 105,
          resolver: 'ims.specialist@company.com'
        },
        {
          id: '1',
          title: 'JCL Job Failing with S0C4 ABEND',
          problem: 'Production JCL job failing with system completion code S0C4',
          solution: 'Check program for array bounds violation and recompile',
          category: 'JCL',
          tags: ['production', 'abend', 's0c4'],
          created_at: new Date('2024-01-15T10:30:00'),
          updated_at: new Date('2024-01-15T11:00:00'),
          created_by: 'system',
          usage_count: 5,
          success_count: 4,
          failure_count: 1,
          version: 1,
          status: 'aberto',
          priority: 'P1',
          escalation_level: 'none',
          assigned_to: undefined,
          business_impact: 'critical',
          customer_impact: true,
          incident_number: 'INC-2024-001',
          reporter: 'ops.team@company.com'
        },
        {
          id: '2',
          title: 'DB2 Connection Pool Exhausted',
          problem: 'Application unable to connect to DB2, connection pool shows all connections in use',
          solution: 'Increase connection pool size and implement connection recycling',
          category: 'DB2',
          tags: ['database', 'connections', 'pool'],
          created_at: new Date('2024-01-15T09:15:00'),
          updated_at: new Date('2024-01-15T10:45:00'),
          created_by: 'dba.team',
          usage_count: 3,
          success_count: 3,
          failure_count: 0,
          version: 1,
          status: 'em_tratamento',
          priority: 'P2',
          escalation_level: 'none',
          assigned_to: 'john.doe@company.com',
          business_impact: 'high',
          customer_impact: false,
          incident_number: 'INC-2024-002',
          reporter: 'app.team@company.com'
        },
        // MORE KNOWLEDGE BASE ENTRIES
        {
          id: '9',
          title: 'CICS Storage Shortage ASRD',
          problem: 'CICS region experiencing storage shortage causing ASRD abends',
          solution: 'Increase EDSALIM and DSA storage settings, monitor storage usage with CEDF',
          category: 'CICS',
          tags: ['cics', 'storage', 'asrd', 'memory'],
          created_at: new Date('2023-12-20T10:15:00'),
          updated_at: new Date('2023-12-20T14:30:00'),
          created_by: 'cics.admin',
          usage_count: 25,
          success_count: 24,
          failure_count: 1,
          version: 1,
          status: 'resolvido',
          priority: 'P1',
          escalation_level: 'none',
          assigned_to: 'cics.performance@company.com',
          business_impact: 'critical',
          customer_impact: true,
          incident_number: 'INC-2023-038',
          reporter: 'monitoring@company.com',
          resolution_time: 260,
          resolver: 'cics.performance@company.com'
        },
        {
          id: '10',
          title: 'Batch Job Queue Backlog',
          problem: 'JES2 job queue experiencing excessive backlog during peak processing',
          solution: 'Adjust job class priorities and implement job scheduling optimization',
          category: 'Batch',
          tags: ['jes2', 'queue', 'scheduling', 'performance'],
          created_at: new Date('2023-12-15T22:00:00'),
          updated_at: new Date('2023-12-16T06:30:00'),
          created_by: 'ops.team',
          usage_count: 9,
          success_count: 9,
          failure_count: 0,
          version: 1,
          status: 'resolvido',
          priority: 'P2',
          escalation_level: 'none',
          assigned_to: 'systems.admin@company.com',
          business_impact: 'high',
          customer_impact: false,
          incident_number: 'INC-2023-031',
          reporter: 'scheduler@company.com',
          resolution_time: 510,
          resolver: 'systems.admin@company.com'
        },

        // CURRENT ACTIVE INCIDENTS
        {
          id: '11',
          title: 'Network Connectivity Issues to Mainframe',
          problem: 'Intermittent network timeouts when connecting to mainframe from distributed systems',
          solution: 'Under investigation - checking network infrastructure and firewall configurations',
          category: 'Network',
          tags: ['network', 'timeout', 'connectivity'],
          created_at: new Date('2024-01-15T14:00:00'),
          updated_at: new Date('2024-01-15T14:30:00'),
          created_by: 'network.team',
          usage_count: 0,
          success_count: 0,
          failure_count: 0,
          version: 1,
          status: 'em_tratamento',
          priority: 'P2',
          escalation_level: 'none',
          assigned_to: 'network.specialist@company.com',
          business_impact: 'medium',
          customer_impact: true,
          incident_number: 'INC-2024-008',
          reporter: 'app.support@company.com'
        },
        {
          id: '12',
          title: 'Security Violation RACF Access Denied',
          problem: 'Multiple users experiencing RACF access denied errors for production datasets',
          solution: 'Under review - checking user profiles and dataset permissions',
          category: 'Security',
          tags: ['racf', 'security', 'access', 'permissions'],
          created_at: new Date('2024-01-15T13:45:00'),
          updated_at: new Date('2024-01-15T14:15:00'),
          created_by: 'security.team',
          usage_count: 0,
          success_count: 0,
          failure_count: 0,
          version: 1,
          status: 'aberto',
          priority: 'P2',
          escalation_level: 'none',
          assigned_to: undefined,
          business_impact: 'high',
          customer_impact: true,
          incident_number: 'INC-2024-009',
          reporter: 'user.support@company.com'
        }
        ];
        setIncidents(activeIncidents);
        setLoading(false);
      }
    };

    // Load the knowledge base
    loadKnowledgeBase();
  }, [currentFilters, sort]);

  // Global keyboard shortcuts for incident queue
  useGlobalKeyboardShortcuts({
    onGlobalSearch: () => {
      // Focus search input when global search is triggered
      const searchInput = document.querySelector('[data-search-input="true"]') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
      }
    },
    onEscape: () => {
      // Clear search and selected incidents on escape
      if (searchQuery) {
        setSearchQuery('');
        setSearchImmediate('');
      } else if (selectedIncidents.size > 0) {
        setSelectedIncidents(new Set());
      }
    },
    onQuickNav: (direction) => {
      // Handle quick navigation through incidents
      if (direction === 'down' || direction === 'up') {
        // Could implement incident selection navigation
        console.log('Quick nav:', direction);
      }
    }
  });

  // Priority sort mapping for proper ordering
  const priorityOrder = { 'P1': 4, 'P2': 3, 'P3': 2, 'P4': 1 };

  // Function to handle status update for treatment
  const handleStartTreatment = async (incidentId: string) => {
    try {
      await IncidentService.updateStatus(
        incidentId,
        'em_tratamento',
        'Iniciado tratamento pelo usuário',
        'current.user@company.com'
      );

      // Update local state
      setIncidents(prev => prev.map(incident =>
        incident.id === incidentId
          ? { ...incident, status: 'em_tratamento' as IncidentStatus, assigned_to: 'current.user@company.com' }
          : incident
      ));
    } catch (error) {
      console.error('Error starting treatment:', error);
      // Could add toast notification here
    }
  };

  // Handle View modal
  const handleView = (incident: IncidentKBEntry, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setSelectedIncidentForModal(incident);
    setOpenViewModal(true);
  };

  // Handle Edit modal
  const handleEdit = (incident: IncidentKBEntry, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setSelectedIncidentForModal(incident);
    setOpenEditModal(true);
  };

  // Handle incident update from edit modal
  const handleIncidentUpdate = async (id: string, changes: Partial<IncidentKBEntry>, auditInfo: any) => {
    try {
      // Update the incident in the local state
      setIncidents(prev => prev.map(incident =>
        incident.id === id
          ? { ...incident, ...changes, updated_at: new Date() }
          : incident
      ));

      // In a real app, this would call the API
      console.log('Incident updated:', { id, changes, auditInfo });

      // Close the modal
      setOpenEditModal(false);
      setSelectedIncidentForModal(null);
    } catch (error) {
      console.error('Error updating incident:', error);
      throw error;
    }
  };

  // Filter and sort incidents using debounced search value
  const filteredIncidents = useMemo(() => {
    let filtered = incidents;

    // INTEGRATED APPROACH: Apply view filter based on integrated mode
    const viewMode = (filters as any)?.viewMode || 'all';

    if (viewMode === 'active') {
      // Show only active incidents (open, assigned, in progress)
      filtered = filtered.filter(incident =>
        ['aberto', 'em_tratamento', 'em_revisao'].includes(incident.status)
      );
    } else if (viewMode === 'knowledge') {
      // Show only resolved incidents with solutions (knowledge base)
      filtered = filtered.filter(incident =>
        ['resolvido', 'fechado'].includes(incident.status) &&
        incident.solution &&
        incident.solution.trim().length > 0
      );
    } else if (activeShowActiveOnly) {
      // Legacy behavior - hide resolved/closed
      filtered = filtered.filter(incident =>
        !['resolvido', 'fechado'].includes(incident.status)
      );
    }

    // Apply search query with enhanced matching using debounced value
    if (searchValue && searchValue.trim().length > 0) {
      const trimmedQuery = searchValue.trim().toLowerCase();
      filtered = filtered.filter(incident =>
        incident.title.toLowerCase().includes(trimmedQuery) ||
        incident.problem.toLowerCase().includes(trimmedQuery) ||
        incident.incident_number?.toLowerCase().includes(trimmedQuery) ||
        incident.category.toLowerCase().includes(trimmedQuery) ||
        incident.tags.some(tag => tag.toLowerCase().includes(trimmedQuery)) ||
        incident.reporter?.toLowerCase().includes(trimmedQuery) ||
        incident.assigned_to?.toLowerCase().includes(trimmedQuery)
      );
    }

    // Apply filters
    if (currentFilters.status && currentFilters.status.length > 0) {
      filtered = filtered.filter(incident => currentFilters.status!.includes(incident.status));
    }

    if (currentFilters.priority && currentFilters.priority.length > 0) {
      filtered = filtered.filter(incident => currentFilters.priority!.includes(incident.priority));
    }

    if (currentFilters.assigned_to && currentFilters.assigned_to.length > 0) {
      filtered = filtered.filter(incident =>
        incident.assigned_to && currentFilters.assigned_to!.includes(incident.assigned_to)
      );
    }

    // Apply sorting with special handling for priority
    filtered.sort((a, b) => {
      if (sort.field === 'priority') {
        const aPriorityValue = priorityOrder[a.priority as keyof typeof priorityOrder];
        const bPriorityValue = priorityOrder[b.priority as keyof typeof priorityOrder];

        if (aPriorityValue !== bPriorityValue) {
          return sort.direction === 'desc' ? bPriorityValue - aPriorityValue : aPriorityValue - bPriorityValue;
        }

        // Secondary sort by created_at if priorities are equal
        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();
        return bTime - aTime; // Always newest first for secondary sort
      } else {
        const aValue = a[sort.field as keyof IncidentKBEntry];
        const bValue = b[sort.field as keyof IncidentKBEntry];

        if (aValue < bValue) return sort.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sort.direction === 'asc' ? 1 : -1;

        // Secondary sort by created_at for other fields
        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();
        return bTime - aTime;
      }
    });

    return filtered;
  }, [incidents, searchValue, currentFilters, sort, showActiveOnly]);

  const handleSelectAll = () => {
    if (selectedIncidents.size === filteredIncidents.length) {
      setSelectedIncidents(new Set());
    } else {
      setSelectedIncidents(new Set(filteredIncidents.map(i => i.id)));
    }
  };

  const handleSelectIncident = (incidentId: string) => {
    const newSelected = new Set(selectedIncidents);
    if (newSelected.has(incidentId)) {
      newSelected.delete(incidentId);
    } else {
      newSelected.add(incidentId);
    }
    setSelectedIncidents(newSelected);
  };

  const handleBulkAction = (action: string, value?: any) => {
    if (selectedIncidents.size === 0) return;

    const bulkOp: BulkOperation = {
      action: action as any,
      target_value: value,
      incident_ids: Array.from(selectedIncidents),
      performed_by: 'current.user@company.com'
    };

    if (onBulkAction) {
      onBulkAction(bulkOp);
    }

    // Clear selection after action
    setSelectedIncidents(new Set());
  };

  const handleBulkUploadSuccess = (importedCount: number) => {
    // Refresh the incident list after successful bulk upload
    setTimeout(() => {
      setLoading(true);
      // Trigger re-fetch of incidents
      setCurrentFilters(prev => ({ ...prev }));
    }, 500);

    setShowBulkUpload(false);

    // Show success message (you might want to implement a toast notification)
    console.log(`Successfully imported ${importedCount} incidents`);
  };

  const handleSort = (field: string) => {
    setSort(prev => ({
      field: field as any,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header with search and filters */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Incident Queue</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowBulkUpload(true)}
              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center space-x-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span>Importação em Massa</span>
            </button>
            <button className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
              Refresh
            </button>
            <button className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50">
              Export
            </button>
          </div>
        </div>

        {/* INTEGRATED VIEW: Show toggle only if not controlled externally */}
        {showActiveOnly === undefined && (
          <div className="mb-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={internalShowActiveOnly}
                onChange={(e) => setInternalShowActiveOnly(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Mostrar apenas incidentes ativos</span>
              <span className="text-xs text-gray-500">(ocultar resolvidos e fechados)</span>
            </label>
          </div>
        )}

        {/* Search and quick filters */}
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search incidents... (Press / to focus, Escape to clear)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchQuery('');
                  setSearchImmediate('');
                } else if (e.key === 'Enter' && searchQuery.trim()) {
                  // Immediate search on Enter
                  e.preventDefault();
                  flushSearch();
                }
              }}
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              data-search-input="true"
              aria-label="Search incidents"
              aria-describedby="search-help"
            />
            <div id="search-help" className="sr-only">
              Type to search incidents by title, problem, incident number, category, tags, reporter, or assignee. Press slash to focus search, Escape to clear.
            </div>
            {/* Loading indicator for search */}
            {isSearchPending && (
              <div className="absolute right-8 top-1/2 transform -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}

            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchImmediate('');
                }}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded transition-colors duration-150"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          
          <select
            onChange={(e) => setCurrentFilters(prev => ({
              ...prev,
              status: e.target.value ? [e.target.value as any] : undefined
            }))}
            className="px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="">Todos os Status</option>
            <option value="aberto">Aberto</option>
            <option value="em_tratamento">Em Tratamento</option>
            <option value="em_revisao">Em Revisão</option>
            <option value="resolvido">Resolvido</option>
            <option value="fechado">Fechado</option>
          </select>

          <select 
            onChange={(e) => setCurrentFilters(prev => ({
              ...prev,
              priority: e.target.value ? [e.target.value as any] : undefined
            }))}
            className="px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="">All Priority</option>
            <option value="P1">P1 - Critical</option>
            <option value="P2">P2 - High</option>
            <option value="P3">P3 - Medium</option>
            <option value="P4">P4 - Low</option>
          </select>
        </div>
      </div>

      {/* Bulk actions toolbar */}
      {selectedIncidents.size > 0 && (
        <div className="px-4 py-3 bg-blue-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-700">
              {selectedIncidents.size} incident{selectedIncidents.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => handleBulkAction('assign', 'john.doe@company.com')}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Assign
              </button>
              <button 
                onClick={() => handleBulkAction('change_status', 'in_progress')}
                className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700"
              >
                Start Progress
              </button>
              <button 
                onClick={() => handleBulkAction('change_priority', 'P2')}
                className="px-3 py-1.5 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700"
              >
                Change Priority
              </button>
              <button 
                onClick={() => setSelectedIncidents(new Set())}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Incidents table */}
      <div style={{ height }} className="overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-500">
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-lg font-medium">No incidents found</p>
              <p className="text-sm">
                {searchQuery ? `No incidents match "${searchQuery}"` : 'No incidents available'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
                >
                  Clear search to see all incidents
                </button>
              )}
            </div>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="w-8 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIncidents.size === filteredIncidents.length && filteredIncidents.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button 
                    onClick={() => handleSort('incident_number')}
                    className="flex items-center hover:text-gray-700"
                  >
                    Incident #
                    <svg className="ml-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('priority')}
                    className="flex items-center hover:text-gray-700"
                  >
                    Priority
                    {sort.field === 'priority' && (
                      <svg className="ml-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d={sort.direction === 'desc' ? "M19 14l-7 7m0 0l-7-7m7 7V3" : "M5 10l7-7m0 0l7 7m-7-7v18"}
                        />
                      </svg>
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button 
                    onClick={() => handleSort('title')}
                    className="flex items-center hover:text-gray-700"
                  >
                    Title
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assigned To
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('created_at')}
                    className="flex items-center hover:text-gray-700"
                  >
                    Created
                  </button>
                </th>
                {/* INTEGRATED VIEW: Show knowledge-specific columns when in knowledge mode */}
                {showKnowledgeColumns && (
                  <>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Success Rate
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Usage Count
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Resolution Time
                    </th>
                  </>
                )}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredIncidents.map((incident) => (
                <tr 
                  key={incident.id} 
                  className={`hover:bg-gray-50 cursor-pointer ${
                    selectedIncidents.has(incident.id) ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => {
                    setSelectedIncident(incident);
                    setShowRelatedPanel(true);
                    onIncidentSelect && onIncidentSelect(incident);
                  }}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIncidents.has(incident.id)}
                      onChange={() => handleSelectIncident(incident.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {incident.incident_number}
                  </td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={incident.priority} size="sm" showLabel={false} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={incident.status} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900 truncate max-w-xs" title={incident.title}>
                      {incident.title}
                    </div>
                    <div className="text-xs text-gray-500">
                      {incident.category} • {incident.business_impact}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {incident.assigned_to || (
                      <span className="text-gray-400 italic">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatDate(incident.created_at)}
                  </td>
                  {/* INTEGRATED VIEW: Knowledge-specific columns */}
                  {showKnowledgeColumns && (
                    <>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        <div className="flex items-center space-x-1">
                          <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                            (incident.success_count / Math.max(incident.usage_count, 1)) >= 0.9
                              ? 'bg-green-100 text-green-800'
                              : (incident.success_count / Math.max(incident.usage_count, 1)) >= 0.7
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {Math.round((incident.success_count / Math.max(incident.usage_count, 1)) * 100)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        <span className="font-medium">{incident.usage_count}</span>
                        <span className="text-xs text-gray-400 ml-1">uses</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {incident.resolution_time ? (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                            {incident.resolution_time}m
                          </span>
                        ) : '-'}
                      </td>
                    </>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      {/* Standard View and Edit buttons for all incidents */}
                      <button
                        onClick={(e) => handleView(incident, e)}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                        title="Ver detalhes do incidente"
                      >
                        Ver
                      </button>
                      <button
                        onClick={(e) => handleEdit(incident, e)}
                        className="text-green-600 hover:text-green-800 text-xs font-medium"
                        title="Editar incidente"
                      >
                        Editar
                      </button>

                      {/* INTEGRATED VIEW: Additional actions for different modes */}
                      {showKnowledgeColumns ? (
                        // Knowledge base actions
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Handle reuse solution action
                            }}
                            className="text-purple-600 hover:text-purple-800 text-xs"
                            title="Reutilizar solução"
                          >
                            Reutilizar
                          </button>
                        </>
                      ) : (
                        // Active incident actions
                        <>
                          {incident.status === 'aberto' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartTreatment(incident.id);
                              }}
                              className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                              title="Iniciar tratamento"
                            >
                              Tratar
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Handle assign action
                            }}
                            className="text-gray-600 hover:text-gray-800 text-xs"
                            title="Atribuir responsável"
                          >
                            Assign
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer with pagination */}
      <div className="px-4 py-3 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {filteredIncidents.length} of {incidents.length}
            {showKnowledgeColumns ? 'knowledge entries' : 'incidents'}
            {(filters as any)?.viewMode === 'active' && ' (active only)'}
            {(filters as any)?.viewMode === 'knowledge' && ' (resolved with solutions)'}
          </div>
          <div className="flex items-center space-x-2">
            <button className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50">
              Previous
            </button>
            <button className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50">
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Related Incidents Panel */}
      {showRelatedPanel && selectedIncident && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Incident Details & Related Incidents
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedIncident.incident_number} - {selectedIncident.title}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowRelatedPanel(false);
                  setSelectedIncident(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex h-[calc(90vh-120px)]">
              {/* Left Panel - Incident Details */}
              <div className="w-1/2 p-6 overflow-y-auto border-r border-gray-200">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Problem Description
                    </label>
                    <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded">
                      {selectedIncident.problem}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Solution
                    </label>
                    <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded">
                      {selectedIncident.solution}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Priority
                      </label>
                      <PriorityBadge priority={selectedIncident.priority} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Status
                      </label>
                      <StatusBadge status={selectedIncident.status} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Category
                      </label>
                      <p className="text-sm text-gray-900">{selectedIncident.category}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Business Impact
                      </label>
                      <p className="text-sm text-gray-900 capitalize">{selectedIncident.business_impact}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tags
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {selectedIncident.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Panel - Related Incidents */}
              <div className="w-1/2 overflow-y-auto">
                <RelatedIncidentsPanel
                  currentIncident={selectedIncident}
                  allIncidents={incidents}
                  onIncidentSelect={(incident) => {
                    setSelectedIncident(incident);
                  }}
                  className="h-full border-none rounded-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        isOpen={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        onSuccess={handleBulkUploadSuccess}
      />

      {/* View Modal */}
      {openViewModal && selectedIncidentForModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Visualizar Incidente
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedIncidentForModal.incident_number} - {selectedIncidentForModal.title}
                </p>
              </div>
              <button
                onClick={() => {
                  setOpenViewModal(false);
                  setSelectedIncidentForModal(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="space-y-6">
                {/* Incident Details */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Título
                    </label>
                    <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded">
                      {selectedIncidentForModal.title}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Número do Incidente
                    </label>
                    <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded">
                      {selectedIncidentForModal.incident_number}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descrição do Problema
                  </label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded">
                    {selectedIncidentForModal.problem}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Solução
                  </label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded">
                    {selectedIncidentForModal.solution}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Prioridade
                    </label>
                    <PriorityBadge priority={selectedIncidentForModal.priority} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <StatusBadge status={selectedIncidentForModal.status} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Categoria
                    </label>
                    <p className="text-sm text-gray-900 capitalize">{selectedIncidentForModal.category}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Impacto nos Negócios
                    </label>
                    <p className="text-sm text-gray-900 capitalize">{selectedIncidentForModal.business_impact}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Atribuído Para
                    </label>
                    <p className="text-sm text-gray-900">
                      {selectedIncidentForModal.assigned_to || 'Não atribuído'}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {selectedIncidentForModal.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Criado em
                    </label>
                    <p className="text-sm text-gray-900">
                      {selectedIncidentForModal.created_at.toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reportado por
                    </label>
                    <p className="text-sm text-gray-900">
                      {selectedIncidentForModal.reporter || selectedIncidentForModal.created_by}
                    </p>
                  </div>
                </div>

                {selectedIncidentForModal.resolution_time && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tempo de Resolução
                    </label>
                    <p className="text-sm text-gray-900">
                      {selectedIncidentForModal.resolution_time} minutos
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setOpenViewModal(false);
                  setSelectedIncidentForModal(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  setOpenViewModal(false);
                  setOpenEditModal(true);
                  // selectedIncidentForModal já está definido
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Editar Incidente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {openEditModal && selectedIncidentForModal && (
        <EditIncidentModal
          isOpen={openEditModal}
          onClose={() => {
            setOpenEditModal(false);
            setSelectedIncidentForModal(null);
          }}
          onSubmit={handleIncidentUpdate}
          onError={(error) => {
            console.error('Error in edit modal:', error);
            // You could show a toast notification here
          }}
          incident={{
            id: selectedIncidentForModal.id,
            title: selectedIncidentForModal.title,
            description: selectedIncidentForModal.problem,
            impact: 'média' as any, // Convert from business_impact
            category: selectedIncidentForModal.category,
            priority: selectedIncidentForModal.priority,
            status: selectedIncidentForModal.status,
            affected_system: 'Sistema Principal', // Default value
            assigned_to: selectedIncidentForModal.assigned_to || '',
            reported_by: selectedIncidentForModal.reporter || selectedIncidentForModal.created_by,
            incident_date: selectedIncidentForModal.created_at.toISOString().split('T')[0],
            tags: selectedIncidentForModal.tags,
            created_at: selectedIncidentForModal.created_at,
            updated_at: selectedIncidentForModal.updated_at,
            resolution_notes: selectedIncidentForModal.solution
          }}
        />
      )}
    </div>
  );
};

export default IncidentQueue;
