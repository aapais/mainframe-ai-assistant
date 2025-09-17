/**
 * Status Badge Component
 * Displays incident status with color coding and optional interactive dropdown
 */

import React, { useState } from 'react';
import { StatusBadgeProps, IncidentStatus, STATUS_COLORS, STATUS_LABELS } from '../../../types/incident';

const StatusBadge: React.FC<StatusBadgeProps> = ({ 
  status, 
  size = 'md', 
  interactive = false,
  onStatusChange 
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base'
  };

  const color = STATUS_COLORS[status];
  const label = STATUS_LABELS[status];

  const statusOptions: IncidentStatus[] = [
    'open', 'assigned', 'in_progress', 'pending_review', 'resolved', 'closed', 'reopened'
  ];

  const handleStatusChange = (newStatus: IncidentStatus) => {
    if (onStatusChange) {
      onStatusChange(newStatus);
    }
    setIsOpen(false);
  };

  if (interactive && onStatusChange) {
    return (
      <div className="relative">
        <button
          className={`inline-flex items-center rounded-full font-medium text-white hover:opacity-80 transition-opacity ${
            sizeClasses[size]
          }`}
          style={{ backgroundColor: color }}
          onClick={() => setIsOpen(!isOpen)}
          title={`Status: ${label} (click to change)`}
        >
          {label}
          <svg className="ml-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-20">
              <div className="py-1">
                {statusOptions.map((statusOption) => (
                  <button
                    key={statusOption}
                    className={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${
                      statusOption === status ? 'bg-gray-50 font-medium' : ''
                    }`}
                    onClick={() => handleStatusChange(statusOption)}
                  >
                    <span
                      className="inline-block w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: STATUS_COLORS[statusOption] }}
                    />
                    {STATUS_LABELS[statusOption]}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium text-white ${
        sizeClasses[size]
      }`}
      style={{ backgroundColor: color }}
      title={`Status: ${label}`}
    >
      {label}
    </span>
  );
};

export default StatusBadge;
