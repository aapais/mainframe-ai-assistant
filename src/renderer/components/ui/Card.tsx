import React, { forwardRef, memo } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/className';

// Card variant definitions
const cardVariants = cva(
  [
    'rounded-lg border bg-card text-card-foreground',
    'transition-all duration-200 ease-out'
  ],
  {
    variants: {
      variant: {
        default: 'border-border bg-card shadow-sm',
        outlined: 'border-2 border-border bg-card',
        elevated: 'border-border bg-card shadow-md hover:shadow-lg',
        filled: 'border-transparent bg-muted',
        ghost: 'border-transparent bg-transparent',
        // Mainframe-specific variants
        terminal: [
          'bg-black border border-mainframe-green text-mainframe-green',
          'shadow-[0_0_10px_rgb(0,255,0,0.1)] font-mono'
        ],
        'terminal-amber': [
          'bg-black border border-mainframe-amber text-mainframe-amber',
          'shadow-[0_0_10px_rgb(255,176,0,0.1)] font-mono'
        ]
      },
      padding: {
        none: 'p-0',
        sm: 'p-3',
        md: 'p-6',
        lg: 'p-8'
      },
      hover: {
        none: '',
        lift: 'hover:shadow-md hover:-translate-y-1',
        glow: 'hover:shadow-lg hover:shadow-primary/20',
        scale: 'hover:scale-[1.02]'
      },
      clickable: {
        true: 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        false: ''
      }
    },
    defaultVariants: {
      variant: 'default',
      padding: 'md',
      hover: 'none',
      clickable: false
    }
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  asChild?: boolean;
}

const Card = memo(forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, hover, clickable, asChild = false, role, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(cardVariants({ variant, padding, hover, clickable }), className)}
        role={role || (clickable ? 'button' : 'region')}
        tabIndex={clickable ? 0 : undefined}
        {...props}
      />
    );
  }
));

Card.displayName = 'Card';

// Card Header Component
export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
}

const CardHeader = memo(forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, asChild = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex flex-col space-y-1.5 p-6', className)}
        {...props}
      />
    );
  }
));

CardHeader.displayName = 'CardHeader';

// Card Title Component
export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  asChild?: boolean;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

const CardTitle = memo(forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, asChild = false, as: Component = 'h3', ...props }, ref) => {
    return (
      <Component
        ref={ref}
        className={cn('font-semibold leading-none tracking-tight', className)}
        {...props}
      />
    );
  }
));

CardTitle.displayName = 'CardTitle';

// Card Description Component
export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  asChild?: boolean;
}

const CardDescription = memo(forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, asChild = false, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={cn('text-sm text-muted-foreground', className)}
        {...props}
      />
    );
  }
));

CardDescription.displayName = 'CardDescription';

// Card Content Component
export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
}

const CardContent = memo(forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, asChild = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('p-6 pt-0', className)}
        {...props}
      />
    );
  }
));

CardContent.displayName = 'CardContent';

// Card Footer Component
export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
}

const CardFooter = memo(forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, asChild = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex items-center p-6 pt-0', className)}
        {...props}
      />
    );
  }
));

CardFooter.displayName = 'CardFooter';

// Complex Card Components

// Statistics Card
export interface StatCardProps extends Omit<CardProps, 'children'> {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
    label?: string;
  };
  loading?: boolean;
}

const StatCard = memo(forwardRef<HTMLDivElement, StatCardProps>(
  ({
    title,
    value,
    subtitle,
    icon,
    trend,
    loading = false,
    className,
    ...props
  }, ref) => {
    return (
      <Card ref={ref} className={cn('relative overflow-hidden', className)} {...props}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          {icon && (
            <div className="text-muted-foreground">
              {icon}
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-1">
            {loading ? (
              <div className="h-8 w-24 bg-muted animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-bold">{value}</div>
            )}
            
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
            
            {trend && (
              <div className="flex items-center text-xs">
                <span
                  className={cn(
                    'inline-flex items-center',
                    trend.isPositive ? 'text-success' : 'text-danger'
                  )}
                >
                  {trend.isPositive ? (
                    <svg className="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M14.707 12.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                  {trend.value}%
                </span>
                {trend.label && (
                  <span className="ml-1 text-muted-foreground">{trend.label}</span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
));

StatCard.displayName = 'StatCard';

// Feature Card
export interface FeatureCardProps extends Omit<CardProps, 'children'> {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  badge?: string;
}

const FeatureCard = memo(forwardRef<HTMLDivElement, FeatureCardProps>(
  ({
    title,
    description,
    icon,
    action,
    badge,
    className,
    ...props
  }, ref) => {
    return (
      <Card 
        ref={ref} 
        className={cn('relative', className)} 
        hover="lift"
        {...props}
      >
        {badge && (
          <div className="absolute top-3 right-3">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
              {badge}
            </span>
          </div>
        )}
        
        <CardHeader>
          <div className="flex items-start space-x-3">
            {icon && (
              <div className="flex-shrink-0 p-2 bg-primary/10 rounded-lg">
                <div className="text-primary">
                  {icon}
                </div>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <CardTitle>{title}</CardTitle>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <CardDescription>{description}</CardDescription>
        </CardContent>
        
        {action && (
          <CardFooter>
            {action}
          </CardFooter>
        )}
      </Card>
    );
  }
));

FeatureCard.displayName = 'FeatureCard';

// Knowledge Base Entry Card (MVP1 specific)
export interface KBEntryCardProps extends Omit<CardProps, 'children'> {
  title: string;
  problem: string;
  solution: string;
  category: string;
  tags: string[];
  usageCount: number;
  successRate: number;
  onView?: () => void;
  onEdit?: () => void;
  onRate?: (rating: boolean) => void;
}

const KBEntryCard = memo(forwardRef<HTMLDivElement, KBEntryCardProps>(
  ({
    title,
    problem,
    solution,
    category,
    tags,
    usageCount,
    successRate,
    onView,
    onEdit,
    onRate,
    className,
    ...props
  }, ref) => {
    const cardId = `kb-entry-${Math.random().toString(36).substr(2, 9)}`;
    const titleId = `${cardId}-title`;
    const problemId = `${cardId}-problem`;
    const solutionId = `${cardId}-solution`;
    const truncateText = (text: string, maxLength: number = 150) => {
      return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
    };

    const getCategoryColor = (category: string) => {
      const colors = {
        'JCL': 'bg-blue-100 text-blue-800',
        'VSAM': 'bg-green-100 text-green-800',
        'DB2': 'bg-purple-100 text-purple-800',
        'Batch': 'bg-orange-100 text-orange-800',
        'Functional': 'bg-indigo-100 text-indigo-800',
        'Other': 'bg-gray-100 text-gray-800'
      };
      return colors[category as keyof typeof colors] || colors['Other'];
    };

    return (
      <Card
        ref={ref}
        className={cn('relative', className)}
        hover="lift"
        clickable={!!onView}
        onClick={onView}
        role="article"
        aria-labelledby={titleId}
        aria-describedby={`${problemId} ${solutionId}`}
        {...props}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <CardTitle
                className="text-lg mb-2 line-clamp-2"
                id={titleId}
              >
                {title}
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                  getCategoryColor(category)
                )}>
                  {category}
                </span>
                <span className="text-xs text-muted-foreground">
                  {usageCount} uses • {Math.round(successRate * 100)}% success
                </span>
              </div>
            </div>
            
            {onEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="p-1 text-muted-foreground hover:text-foreground rounded focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                aria-label={`Edit ${title}`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Problem</h4>
              <p className="text-sm" id={problemId}>{truncateText(problem)}</p>
            </div>

            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Solution</h4>
              <p className="text-sm" id={solutionId}>{truncateText(solution)}</p>
            </div>
            
            {tags.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Tags</h4>
                <div className="flex flex-wrap gap-1" role="list" aria-label={`Tags for ${title}`}>
                  {tags.slice(0, 5).map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-muted text-muted-foreground"
                      role="listitem"
                    >
                      {tag}
                    </span>
                  ))}
                  {tags.length > 5 && (
                    <span className="text-xs text-muted-foreground">
                      +{tags.length - 5} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
        
        {onRate && (
          <CardFooter className="pt-3 border-t">
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-muted-foreground">Was this helpful?</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRate(true);
                  }}
                  className="p-1 text-muted-foreground hover:text-success rounded focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  aria-label={`Mark ${title} as helpful`}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRate(false);
                  }}
                  className="p-1 text-muted-foreground hover:text-danger rounded focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  aria-label={`Mark ${title} as not helpful`}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.7m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                  </svg>
                </button>
              </div>
            </div>
          </CardFooter>
        )}
      </Card>
    );
  }
));

KBEntryCard.displayName = 'KBEntryCard';

// Export all card components
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  StatCard,
  FeatureCard,
  KBEntryCard
};

export type {
  CardProps,
  CardHeaderProps,
  CardTitleProps,
  CardDescriptionProps,
  CardContentProps,
  CardFooterProps,
  StatCardProps,
  FeatureCardProps,
  KBEntryCardProps
};