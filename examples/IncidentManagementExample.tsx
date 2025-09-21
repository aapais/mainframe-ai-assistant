/**
 * Incident Management Integration Example
 * Demonstrates Phase 2: UX Enhancement implementation
 *
 * This example shows how to integrate all incident management components
 * for a complete workflow experience.
 */

import React, { useState, useEffect } from 'react';
import {
  IncidentQueue,
  IncidentDashboard,
  PriorityBadge,
  StatusBadge,
  QuickActions,
  StatusWorkflow,
  IncidentKBEntry,
  IncidentFilter,
  BulkOperation
} from '../src/renderer/components/incident';
import IncidentService from '../src/renderer/services/IncidentService';

const IncidentManagementExample: React.FC = () => {
  const [currentView, setCurrentView] = useState<'dashboard' | 'queue' | 'detail'>('dashboard');
  const [selectedIncident, setSelectedIncident] = useState<IncidentKBEntry | null>(null);
  const [selectedIncidents, setSelectedIncidents] = useState<IncidentKBEntry[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Example filters
  const [filters, setFilters] = useState<IncidentFilter>({
    status: [],
    priority: [],
    assigned_to: []
  });

  const handleIncidentSelect = (incident: IncidentKBEntry) => {
    setSelectedIncident(incident);
    setCurrentView('detail');
  };

  const handleBulkAction = async (operation: BulkOperation) => {
    try {
      await IncidentService.bulkOperation(operation);
      // Refresh the view
      setRefreshKey(prev => prev + 1);
      setSelectedIncidents([]);
    } catch (error) {
      console.error('Bulk action failed:', error);
    }
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (selectedIncident) {
      try {
        await IncidentService.updateStatus(
          selectedIncident.id,
          newStatus,
          'Status updated from detail view'
        );
        // Update local state
        setSelectedIncident({
          ...selectedIncident,
          status: newStatus as any,
          last_status_change: new Date()
        });
        setRefreshKey(prev => prev + 1);
      } catch (error) {
        console.error('Status update failed:', error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">
                Incident Management System
              </h1>
              <span className="text-sm text-gray-500">Phase 2: UX Enhancement</span>
            </div>

            <nav className="flex space-x-4">
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`px-3 py-2 text-sm rounded-md transition-colors ${
                  currentView === 'dashboard'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setCurrentView('queue')}
                className={`px-3 py-2 text-sm rounded-md transition-colors ${
                  currentView === 'queue'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Incident Queue
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Dashboard View */}
        {currentView === 'dashboard' && (
          <div>
            <IncidentDashboard
              timeframe="24h"
              auto_refresh={true}
              refresh_interval={30}
            />

            {/* Quick Actions Demo */}
            <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Component Examples</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Priority Badges */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Priority Badges</h3>
                  <div className="space-y-2">
                    <PriorityBadge priority="P1" size="sm" />
                    <PriorityBadge priority="P2" size="md" />
                    <PriorityBadge priority="P3" size="lg" showLabel={true} />
                    <PriorityBadge priority="P4" size="md" showLabel={false} />
                  </div>
                </div>

                {/* Status Badges */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Status Badges</h3>
                  <div className="space-y-2">
                    <StatusBadge status="open" size="sm" />
                    <StatusBadge status="assigned" size="md" />
                    <StatusBadge status="in_progress" size="md" />
                    <StatusBadge status="resolved" size="md" />
                  </div>
                </div>

                {/* Interactive Status Badge */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Interactive Status</h3>
                  <StatusBadge
                    status="assigned"
                    interactive={true}
                    onStatusChange={(newStatus) => {
                      console.log('Status changed to:', newStatus);
                    }}
                  />
                </div>

                {/* Filter Examples */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Filters</h3>
                  <div className="space-y-2">
                    <select
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        status: e.target.value ? [e.target.value as any] : []
                      }))}
                    >
                      <option value="">All Status</option>
                      <option value="open">Open</option>
                      <option value="assigned">Assigned</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                    </select>

                    <select
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        priority: e.target.value ? [e.target.value as any] : []
                      }))}
                    >
                      <option value="">All Priority</option>
                      <option value="P1">P1 - Critical</option>
                      <option value="P2">P2 - High</option>
                      <option value="P3">P3 - Medium</option>
                      <option value="P4">P4 - Low</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Queue View */}
        {currentView === 'queue' && (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Incident Queue</h2>
              <button
                onClick={handleRefresh}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Refresh
              </button>
            </div>

            <IncidentQueue
              key={refreshKey}
              filters={filters}
              onIncidentSelect={handleIncidentSelect}
              onBulkAction={handleBulkAction}
              height={600}
            />
          </div>
        )}

        {/* Detail View */}
        {currentView === 'detail' && selectedIncident && (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <button
                  onClick={() => setCurrentView('queue')}
                  className="text-blue-600 hover:text-blue-800 text-sm mb-2"
                >
                  ← Back to Queue
                </button>
                <h2 className="text-xl font-semibold text-gray-900">
                  {selectedIncident.incident_number}: {selectedIncident.title}
                </h2>
              </div>
              <div className="flex items-center space-x-3">
                <PriorityBadge priority={selectedIncident.priority} />
                <StatusBadge status={selectedIncident.status} />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Content */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold mb-4">Problem Description</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {selectedIncident.problem}
                  </p>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold mb-4">Solution</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {selectedIncident.solution}
                  </p>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold mb-4">Incident Details</h3>
                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Category</dt>
                      <dd className="text-sm text-gray-900">{selectedIncident.category}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Business Impact</dt>
                      <dd className="text-sm text-gray-900 capitalize">{selectedIncident.business_impact}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Customer Impact</dt>
                      <dd className="text-sm text-gray-900">
                        {selectedIncident.customer_impact ? 'Yes' : 'No'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Assigned To</dt>
                      <dd className="text-sm text-gray-900">
                        {selectedIncident.assigned_to || 'Unassigned'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Reporter</dt>
                      <dd className="text-sm text-gray-900">
                        {selectedIncident.reporter || 'Unknown'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Created</dt>
                      <dd className="text-sm text-gray-900">
                        {selectedIncident.created_at.toLocaleString()}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold mb-4">Status Workflow</h3>
                  <StatusWorkflow
                    incident={selectedIncident}
                    onStatusChange={handleStatusChange}
                    showHistory={true}
                  />
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
                  <div className="space-y-3">
                    <button className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
                      Assign to Me
                    </button>
                    <button className="w-full px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
                      Add Comment
                    </button>
                    <button className="w-full px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
                      Escalate
                    </button>
                    <button className="w-full px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700">
                      Mark Resolved
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold mb-4">SLA Information</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Deadline:</span>
                      <span className="text-gray-900">
                        {selectedIncident.sla_deadline?.toLocaleString() || 'Not set'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Time Remaining:</span>
                      <span className="text-orange-600 font-medium">
                        2h 15m
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Status:</span>
                      <span className="text-yellow-600 font-medium">At Risk</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default IncidentManagementExample;