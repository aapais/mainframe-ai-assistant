/**
 * Status Workflow Component
 * Visual workflow for incident status transitions with validation
 */

import React, { useState, useEffect } from 'react';
import { IncidentStatus, StatusTransition, IncidentKBEntry } from '../../../types/incident';
import StatusBadge from './StatusBadge';
import IncidentService from '../../services/IncidentService';

interface StatusWorkflowProps {
  incident: IncidentKBEntry;
  onStatusChange?: (newStatus: IncidentStatus) => void;
  showHistory?: boolean;
}

const StatusWorkflow: React.FC<StatusWorkflowProps> = ({
  incident,
  onStatusChange,
  showHistory = false
}) => {
  const [statusHistory, setStatusHistory] = useState<StatusTransition[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<IncidentStatus | null>(null);
  const [transitionReason, setTransitionReason] = useState('');

  // Status workflow configuration
  const statusWorkflow = {
    aberto: {
      next: ['em_tratamento', 'resolvido', 'fechado'],
      color: '#6b7280',
      icon: 'open'
    },
    em_tratamento: {
      next: ['em_revisao', 'resolvido', 'aberto', 'fechado'],
      color: '#f59e0b',
      icon: 'play'
    },
    em_revisao: {
      next: ['resolvido', 'em_tratamento', 'fechado'],
      color: '#8b5cf6',
      icon: 'clock'
    },
    resolvido: {
      next: ['fechado', 'reaberto'],
      color: '#10b981',
      icon: 'check'
    },
    fechado: {
      next: ['reaberto'],
      color: '#6b7280',
      icon: 'lock'
    },
    reaberto: {
      next: ['em_tratamento', 'resolvido'],
      color: '#ef4444',
      icon: 'refresh'
    }
  };

  useEffect(() => {
    if (showHistory) {
      loadStatusHistory();
    }
  }, [incident.id, showHistory]);

  const loadStatusHistory = async () => {
    try {
      const history = await IncidentService.getStatusHistory(incident.id);
      setStatusHistory(history);
    } catch (error) {
      console.error('Error loading status history:', error);
    }
  };

  const handleStatusTransition = async () => {
    if (!selectedStatus || loading) return;

    setLoading(true);
    try {
      await IncidentService.updateStatus(
        incident.id,
        selectedStatus,
        transitionReason,
        'current.user@company.com' // TODO: Get from auth context
      );

      if (onStatusChange) {
        onStatusChange(selectedStatus);
      }

      // Reload history
      if (showHistory) {
        await loadStatusHistory();
      }

      setShowTransitionModal(false);
      setSelectedStatus(null);
      setTransitionReason('');
    } catch (error) {
      console.error('Error updating status:', error);
      // TODO: Show error notification
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: IncidentStatus) => {
    const iconType = statusWorkflow[status]?.icon || 'circle';
    
    switch (iconType) {
      case 'open':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      case 'user':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      case 'play':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293H15" />
          </svg>
        );
      case 'clock':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'check':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'lock':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        );
      case 'refresh':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
          </svg>
        );
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  const availableTransitions = statusWorkflow[incident.status]?.next || [];

  return (
    <div className="space-y-4">
      {/* Current Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div 
            className="p-2 rounded-full text-white"
            style={{ backgroundColor: statusWorkflow[incident.status]?.color }}
          >
            {getStatusIcon(incident.status)}
          </div>
          <div>
            <StatusBadge status={incident.status} size="md" />
            <p className="text-xs text-gray-500 mt-1">
              {incident.last_status_change ? 
                `Changed ${formatTimeAgo(incident.last_status_change)}` :
                'No status changes'
              }
            </p>
          </div>
        </div>
        
        {availableTransitions.length > 0 && (
          <button
            onClick={() => setShowTransitionModal(true)}
            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Change Status
          </button>
        )}
      </div>

      {/* Available Transitions */}
      {availableTransitions.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-3">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Available Actions:</h4>
          <div className="flex flex-wrap gap-2">
            {availableTransitions.map(status => (
              <button
                key={status}
                onClick={() => {
                  setSelectedStatus(status);
                  setShowTransitionModal(true);
                }}
                className="flex items-center space-x-1 px-2 py-1 text-xs border border-gray-300 rounded hover:bg-white transition-colors"
              >
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: statusWorkflow[status]?.color }}
                />
                <span className="capitalize">{status.replace('_', ' ')}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Status History */}
      {showHistory && statusHistory.length > 0 && (
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Status History</h4>
          <div className="space-y-2">
            {statusHistory.map((transition, index) => (
              <div key={transition.id} className="flex items-start space-x-3 text-sm">
                <div className="flex-shrink-0 mt-1">
                  <div 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: statusWorkflow[transition.to_status]?.color }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900">
                    <span className="font-medium">{transition.changed_by}</span>
                    {' changed status from '}
                    <span className="capitalize font-medium">{transition.from_status.replace('_', ' ')}</span>
                    {' to '}
                    <span className="capitalize font-medium">{transition.to_status.replace('_', ' ')}</span>
                  </p>
                  {transition.change_reason && (
                    <p className="text-gray-600 mt-1">{transition.change_reason}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {formatTimeAgo(transition.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status Transition Modal */}
      {showTransitionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              Change Status {selectedStatus && `to ${selectedStatus.replace('_', ' ')}`}
            </h3>
            
            {!selectedStatus && (
              <div className="space-y-2 mb-4">
                {availableTransitions.map(status => (
                  <button
                    key={status}
                    onClick={() => setSelectedStatus(status)}
                    className="w-full flex items-center space-x-3 p-3 border border-gray-200 rounded hover:bg-gray-50"
                  >
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: statusWorkflow[status]?.color }}
                    />
                    <span className="capitalize font-medium">{status.replace('_', ' ')}</span>
                  </button>
                ))}
              </div>
            )}

            {selectedStatus && (
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div 
                    className="p-2 rounded-full text-white"
                    style={{ backgroundColor: statusWorkflow[selectedStatus]?.color }}
                  >
                    {getStatusIcon(selectedStatus)}
                  </div>
                  <StatusBadge status={selectedStatus} size="md" />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for status change (optional)
                  </label>
                  <textarea
                    value={transitionReason}
                    onChange={(e) => setTransitionReason(e.target.value)}
                    placeholder="Provide details about this status change..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            )}
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowTransitionModal(false);
                  setSelectedStatus(null);
                  setTransitionReason('');
                }}
                className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              {selectedStatus && (
                <button
                  onClick={handleStatusTransition}
                  disabled={loading}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Update Status'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusWorkflow;
