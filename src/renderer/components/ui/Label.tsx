/**
 * Label Component
 * Accessible label component for form inputs
 */

import React from 'react';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: React.ReactNode;
  required?: boolean;
  error?: boolean;
}

export const Label: React.FC<LabelProps> = ({
  children,
  required = false,
  error = false,
  className = '',
  ...props
}) => {
  const baseClasses = 'block text-sm font-medium leading-6';
  const colorClasses = error
    ? 'text-red-700'
    : 'text-gray-900';

  const classes = `${baseClasses} ${colorClasses} ${className}`.trim();

  return (
    <label className={classes} {...props}>
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
};

export default Label;