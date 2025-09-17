/**
 * Incident Queue Component
 * List view with status columns, priority badges, filters, and bulk actions
 */

import React, { useState, useEffect, useMemo } from 'react';
import PriorityBadge from './PriorityBadge';
import StatusBadge from './StatusBadge';
import {
  IncidentQueueProps,
  IncidentKBEntry,
  IncidentFilter,
  IncidentSort,
  BulkOperation,
  QuickAction
} from '../../../types/incident';

const IncidentQueue: React.FC<IncidentQueueProps> = ({
  filters = {},
  config,
  onIncidentSelect,
  onBulkAction,
  height = 600
}) => {
  const [incidents, setIncidents] = useState<IncidentKBEntry[]>([]);
  const [selectedIncidents, setSelectedIncidents] = useState<Set<string>>(new Set());
  const [currentFilters, setCurrentFilters] = useState<IncidentFilter>(filters);
  const [sort, setSort] = useState<IncidentSort>({ field: 'created_at', direction: 'desc' });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Mock data for demonstration
  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      const mockIncidents: IncidentKBEntry[] = [
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
          status: 'open',
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
          status: 'in_progress',
          priority: 'P2',
          escalation_level: 'none',
          assigned_to: 'john.doe@company.com',
          business_impact: 'high',
          customer_impact: false,
          incident_number: 'INC-2024-002',
          reporter: 'app.team@company.com'
        },
        {
          id: '3',
          title: 'VSAM File Corruption Detected',
          problem: 'VSAM dataset showing logical record length inconsistencies',
          solution: 'Run IDCAMS VERIFY and rebuild indexes if necessary',
          category: 'VSAM',
          tags: ['vsam', 'corruption', 'data'],
          created_at: new Date('2024-01-15T08:00:00'),
          updated_at: new Date('2024-01-15T08:30:00'),
          created_by: 'system',
          usage_count: 2,
          success_count: 2,
          failure_count: 0,
          version: 1,
          status: 'resolved',
          priority: 'P3',
          escalation_level: 'none',
          assigned_to: 'jane.smith@company.com',
          business_impact: 'medium',
          customer_impact: false,
          incident_number: 'INC-2024-003',
          reporter: 'storage.team@company.com',
          resolution_time: 30
        }
      ];
      setIncidents(mockIncidents);
      setLoading(false);
    }, 1000);
  }, [currentFilters, sort]);

  // Filter and sort incidents
  const filteredIncidents = useMemo(() => {
    let filtered = incidents;

    // Apply search query
    if (searchQuery) {
      filtered = filtered.filter(incident => 
        incident.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        incident.problem.toLowerCase().includes(searchQuery.toLowerCase()) ||
        incident.incident_number?.toLowerCase().includes(searchQuery.toLowerCase())
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

    // Apply sorting
    filtered.sort((a, b) => {
      const aValue = a[sort.field as keyof IncidentKBEntry];
      const bValue = b[sort.field as keyof IncidentKBEntry];
      
      if (aValue < bValue) return sort.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sort.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [incidents, searchQuery, currentFilters, sort]);

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
            <button className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
              Refresh
            </button>
            <button className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50">
              Export
            </button>
          </div>
        </div>

        {/* Search and quick filters */}
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search incidents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <select 
            onChange={(e) => setCurrentFilters(prev => ({
              ...prev,
              status: e.target.value ? [e.target.value as any] : undefined
            }))}
            className="px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
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
                  Priority
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
                  onClick={() => onIncidentSelect && onIncidentSelect(incident)}
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
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          // Handle assign action
                        }}
                        className="text-blue-600 hover:text-blue-800 text-xs"
                      >
                        Assign
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          // Handle comment action
                        }}
                        className="text-green-600 hover:text-green-800 text-xs"
                      >
                        Comment
                      </button>
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
            Showing {filteredIncidents.length} of {incidents.length} incidents
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
    </div>
  );
};

export default IncidentQueue;
