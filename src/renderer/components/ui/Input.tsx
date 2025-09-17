import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'default' | 'outline';
  className?: string;
}

export const Input: React.FC<InputProps> = ({
  variant = 'default',
  className = '',
  ...props
}) => {
  const baseClasses = 'w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors';

  const variantClasses = {
    default: 'border-gray-300 bg-white',
    outline: 'border-gray-300 bg-transparent'
  };

  return (
    <input
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
};

export default Input;