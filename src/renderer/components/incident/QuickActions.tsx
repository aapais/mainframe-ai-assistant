/**
 * Quick Actions Component
 * Provides quick action buttons for incident management
 */

import React, { useState } from 'react';
import { IncidentKBEntry, BulkOperation } from '../../../types/incident';
import IncidentService from '../../services/IncidentService';

interface QuickActionsProps {
  selectedIncidents: IncidentKBEntry[];
  onActionComplete: () => void;
  onClearSelection: () => void;
}

const QuickActions: React.FC<QuickActionsProps> = ({
  selectedIncidents,
  onActionComplete,
  onClearSelection
}) => {
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showPriorityModal, setShowPriorityModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleBulkAction = async (action: string, value?: any) => {
    if (selectedIncidents.length === 0) return;

    setLoading(true);
    try {
      const operation: BulkOperation = {
        action: action as any,
        target_value: value,
        incident_ids: selectedIncidents.map(i => i.id),
        performed_by: 'current.user@company.com' // TODO: Get from auth context
      };

      await IncidentService.bulkOperation(operation);
      onActionComplete();
      onClearSelection();
    } catch (error) {
      console.error('Bulk action failed:', error);
      // TODO: Show error notification
    } finally {
      setLoading(false);
    }
  };

  const canChangeStatus = (newStatus: string) => {
    return selectedIncidents.every(incident => 
      IncidentService.isValidStatusTransition(incident.status, newStatus)
    );
  };

  if (selectedIncidents.length === 0) {
    return null;
  }

  return (
    <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-blue-800">
            {selectedIncidents.length} incident{selectedIncidents.length !== 1 ? 's' : ''} selected
          </span>
          <div className="text-xs text-blue-600">
            {selectedIncidents.filter(i => i.priority === 'P1').length > 0 && (
              <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full mr-1">
                {selectedIncidents.filter(i => i.priority === 'P1').length} P1
              </span>
            )}
            {selectedIncidents.filter(i => i.priority === 'P2').length > 0 && (
              <span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full mr-1">
                {selectedIncidents.filter(i => i.priority === 'P2').length} P2
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Assign Action */}
          <div className="relative">
            <button
              onClick={() => setShowAssignModal(!showAssignModal)}
              disabled={loading}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Assign
            </button>
            
            {showAssignModal && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-20">
                <div className="py-1">
                  <button
                    onClick={() => {
                      handleBulkAction('assign', 'john.doe@company.com');
                      setShowAssignModal(false);
                    }}
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                  >
                    John Doe
                  </button>
                  <button
                    onClick={() => {
                      handleBulkAction('assign', 'jane.smith@company.com');
                      setShowAssignModal(false);
                    }}
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                  >
                    Jane Smith
                  </button>
                  <button
                    onClick={() => {
                      handleBulkAction('assign', 'ops.team@company.com');
                      setShowAssignModal(false);
                    }}
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                  >
                    Ops Team
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Status Actions */}
          <div className="relative">
            <button
              onClick={() => setShowStatusModal(!showStatusModal)}
              disabled={loading}
              className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Status
            </button>
            
            {showStatusModal && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-20">
                <div className="py-1">
                  <button
                    onClick={() => {
                      handleBulkAction('change_status', 'in_progress');
                      setShowStatusModal(false);
                    }}
                    disabled={!canChangeStatus('in_progress')}
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Start Progress
                  </button>
                  <button
                    onClick={() => {
                      handleBulkAction('change_status', 'pending_review');
                      setShowStatusModal(false);
                    }}
                    disabled={!canChangeStatus('pending_review')}
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Pending Review
                  </button>
                  <button
                    onClick={() => {
                      handleBulkAction('change_status', 'resolved');
                      setShowStatusModal(false);
                    }}
                    disabled={!canChangeStatus('resolved')}
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Mark Resolved
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Priority Actions */}
          <div className="relative">
            <button
              onClick={() => setShowPriorityModal(!showPriorityModal)}
              disabled={loading}
              className="px-3 py-1.5 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50 flex items-center"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              Priority
            </button>
            
            {showPriorityModal && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-20">
                <div className="py-1">
                  <button
                    onClick={() => {
                      handleBulkAction('change_priority', 'P1');
                      setShowPriorityModal(false);
                    }}
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                  >
                    <span className="inline-block w-3 h-3 bg-red-500 rounded-full mr-2"></span>
                    P1 - Critical
                  </button>
                  <button
                    onClick={() => {
                      handleBulkAction('change_priority', 'P2');
                      setShowPriorityModal(false);
                    }}
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                  >
                    <span className="inline-block w-3 h-3 bg-orange-500 rounded-full mr-2"></span>
                    P2 - High
                  </button>
                  <button
                    onClick={() => {
                      handleBulkAction('change_priority', 'P3');
                      setShowPriorityModal(false);
                    }}
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                  >
                    <span className="inline-block w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
                    P3 - Medium
                  </button>
                  <button
                    onClick={() => {
                      handleBulkAction('change_priority', 'P4');
                      setShowPriorityModal(false);
                    }}
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                  >
                    <span className="inline-block w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                    P4 - Low
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Escalate Action */}
          <button
            onClick={() => handleBulkAction('escalate', 'level_1')}
            disabled={loading}
            className="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            Escalate
          </button>

          {/* Add Comment Action */}
          <button
            onClick={() => {
              const comment = prompt('Add comment to selected incidents:');
              if (comment) {
                handleBulkAction('add_comment', comment);
              }
            }}
            disabled={loading}
            className="px-3 py-1.5 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Comment
          </button>

          {/* Clear Selection */}
          <button
            onClick={onClearSelection}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear
          </button>
        </div>
      </div>

      {loading && (
        <div className="mt-2 flex items-center text-sm text-blue-600">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
          Processing bulk action...
        </div>
      )}
    </div>
  );
};

export default QuickActions;
