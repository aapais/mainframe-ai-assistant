import React, { memo } from 'react';
import { Database, FileCode, Server, Cpu, Settings, HelpCircle } from 'lucide-react';

export type Category = 'JCL' | 'VSAM' | 'DB2' | 'Batch' | 'Functional' | 'Other';

export interface CategoryBadgeProps {
  category: Category;
  size?: 'small' | 'medium' | 'large';
  showIcon?: boolean;
  interactive?: boolean;
  onClick?: (category: Category) => void;
}

const categoryConfig: Record<Category, { icon: React.ElementType; color: string; label: string }> = {
  JCL: { icon: FileCode, color: 'blue', label: 'JCL' },
  VSAM: { icon: Database, color: 'purple', label: 'VSAM' },
  DB2: { icon: Database, color: 'green', label: 'DB2' },
  Batch: { icon: Server, color: 'orange', label: 'Batch' },
  Functional: { icon: Cpu, color: 'teal', label: 'Functional' },
  Other: { icon: HelpCircle, color: 'gray', label: 'Other' }
};

export const CategoryBadge = memo(function CategoryBadge({
  category,
  size = 'medium',
  showIcon = true,
  interactive = false,
  onClick
}: CategoryBadgeProps) {
  const config = categoryConfig[category] || categoryConfig.Other;
  const Icon = config.icon;
  
  const handleClick = () => {
    if (interactive && onClick) {
      onClick(category);
    }
  };
  
  const Component = interactive ? 'button' : 'span';
  
  return (
    <Component
      className={`
        ${styles.badge} 
        ${styles[size]} 
        ${styles[config.color]}
        ${interactive ? styles.interactive : ''}
      `}
      onClick={interactive ? handleClick : undefined}
      aria-label={`Category: ${config.label}`}
      title={`Category: ${config.label}`}
    >
      {showIcon && <Icon className={styles.icon} size={size === 'small' ? 12 : size === 'large' ? 18 : 14} />}
      <span className={styles.label}>{config.label}</span>
    </Component>
  );
});