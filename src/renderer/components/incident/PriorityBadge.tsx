/**
 * Priority Badge Component
 * Displays incident priority with appropriate color coding and styling
 */

import React from 'react';
import { PriorityBadgeProps, PRIORITY_COLORS, PRIORITY_LABELS } from '../../../types/incident';

const PriorityBadge: React.FC<PriorityBadgeProps> = ({ 
  priority, 
  size = 'md', 
  showLabel = true 
}) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base'
  };

  const color = PRIORITY_COLORS[priority];
  const label = PRIORITY_LABELS[priority];

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold text-white ${
        sizeClasses[size]
      }`}
      style={{ backgroundColor: color }}
      title={`Priority: ${label}`}
    >
      {priority}
      {showLabel && size !== 'sm' && (
        <span className="ml-1">{label}</span>
      )}
    </span>
  );
};

export default PriorityBadge;
