import React, { forwardRef, memo } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn, focusRing, transition } from '../../utils/className';

// Button variant definitions with comprehensive styling
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium',
    'transition-colors transition-transform duration-200 ease-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    'active:scale-[0.98] hover:scale-[1.02]',
    'select-none'
  ],
  {
    variants: {
      variant: {
        default: [
          'bg-primary text-primary-foreground shadow hover:bg-primary/90',
          'border border-primary'
        ],
        destructive: [
          'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
          'border border-destructive'
        ],
        outline: [
          'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
          'text-foreground'
        ],
        secondary: [
          'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
          'border border-secondary'
        ],
        ghost: [
          'hover:bg-accent hover:text-accent-foreground',
          'text-foreground border-transparent'
        ],
        link: [
          'text-primary underline-offset-4 hover:underline',
          'bg-transparent border-transparent shadow-none px-0'
        ],
        // Enhanced variants with glassmorphism and gradients
        success: [
          'bg-success text-success-foreground shadow hover:bg-success/90',
          'border border-success'
        ],
        warning: [
          'bg-warning text-warning-foreground shadow hover:bg-warning/90',
          'border border-warning'
        ],
        glass: [
          'backdrop-blur-md bg-white/10 border border-white/20 text-white',
          'hover:bg-white/20 hover:border-white/30',
          'shadow-lg hover:shadow-xl'
        ],
        gradient: [
          'bg-gradient-to-r from-violet-600 to-purple-600 text-white border-0',
          'hover:from-violet-700 hover:to-purple-700',
          'shadow-lg hover:shadow-xl hover:scale-[1.02]'
        ],
        'gradient-success': [
          'bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0',
          'hover:from-emerald-600 hover:to-green-700',
          'shadow-lg hover:shadow-xl'
        ],
        'gradient-danger': [
          'bg-gradient-to-r from-red-500 to-rose-600 text-white border-0',
          'hover:from-red-600 hover:to-rose-700',
          'shadow-lg hover:shadow-xl'
        ],
        // Terminal-style variants for mainframe theme
        terminal: [
          'bg-black text-mainframe-green border border-mainframe-green',
          'hover:bg-mainframe-green hover:text-black font-mono',
          'shadow-[0_0_10px_rgb(0,255,0,0.3)] hover:shadow-[0_0_15px_rgb(0,255,0,0.5)]'
        ],
        'terminal-amber': [
          'bg-black text-mainframe-amber border border-mainframe-amber',
          'hover:bg-mainframe-amber hover:text-black font-mono',
          'shadow-[0_0_10px_rgb(255,176,0,0.3)] hover:shadow-[0_0_15px_rgb(255,176,0,0.5)]'
        ]
      },
      size: {
        xs: 'h-7 px-2 py-1 text-xs min-w-[44px]',
        sm: 'h-8 px-3 py-1 text-xs min-w-[44px]',
        default: 'h-10 px-4 py-2 min-w-[44px]',
        lg: 'h-12 px-8 py-3 text-base min-w-[44px]',
        xl: 'h-14 px-10 py-4 text-lg min-w-[44px]',
        icon: 'h-10 w-10 p-0 min-w-[44px]',
        'icon-xs': 'h-7 w-7 p-0 min-w-[44px]',
        'icon-sm': 'h-8 w-8 p-0 min-w-[44px]',
        'icon-lg': 'h-12 w-12 p-0 min-w-[44px]',
        'icon-xl': 'h-14 w-14 p-0 min-w-[44px]'
      },
      fullWidth: {
        true: 'w-full',
        false: ''
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      fullWidth: false
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loadingText?: string;
  tooltip?: string;
  badge?: string | number;
  ripple?: boolean;
  shine?: boolean;
  pulse?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    className,
    variant,
    size,
    fullWidth,
    asChild = false,
    loading = false,
    leftIcon,
    rightIcon,
    loadingText,
    disabled,
    ripple = false,
    shine = false,
    pulse = false,
    children,
    onClick,
    ...props
  }, ref) => {
    const isDisabled = disabled || loading;
    const isIconOnly = !children && (leftIcon || rightIcon);
    const [ripples, setRipples] = React.useState<Array<{ id: number; x: number; y: number }>>([]);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (ripple && !isDisabled) {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const id = Date.now();

        setRipples(prev => [...prev, { id, x, y }]);

        setTimeout(() => {
          setRipples(prev => prev.filter(r => r.id !== id));
        }, 600);
      }

      if (!isDisabled) {
        onClick?.(event);
      }
    };

    const LoadingSpinner = () => (
      <svg
        className="animate-spin h-4 w-4"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
        role="img"
        aria-label="Loading"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="m4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    );

    if (asChild) {
      // This would require Slot from @radix-ui/react-slot for proper implementation
      // For now, we'll render as a regular button
    }

    const buttonContent = (
      <>
        {/* Loading state */}
        {loading && (
          <span className="flex items-center justify-center gap-2">
            <LoadingSpinner />
            {loadingText && <span>{loadingText}</span>}
          </span>
        )}

        {/* Normal state */}
        {!loading && (
          <>
            {leftIcon && (
              <span className={cn('flex-shrink-0', children && 'mr-2')} aria-hidden="true">
                {leftIcon}
              </span>
            )}
            
            {children && <span className="flex-1">{children}</span>}
            
            {rightIcon && (
              <span className={cn('flex-shrink-0', children && 'ml-2')} aria-hidden="true">
                {rightIcon}
              </span>
            )}
          </>
        )}
      </>
    );

    return (
      <button
        className={cn(
          buttonVariants({ variant, size, fullWidth }),
          ripple && 'relative overflow-hidden',
          shine && 'relative overflow-hidden group',
          pulse && 'animate-pulse',
          className
        )}
        ref={ref}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={loading}
        onClick={handleClick}
        {...props}
      >
        {/* Shine Effect */}
        {shine && (
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        )}

        {/* Button Content */}
        {buttonContent}

        {/* Ripple Effects */}
        {ripples.map(({ id, x, y }) => (
          <div
            key={id}
            className="absolute pointer-events-none"
            style={{
              left: x - 2,
              top: y - 2,
              width: 4,
              height: 4,
            }}
          >
            <div className="absolute inset-0 bg-white/30 rounded-full animate-[ripple_0.6s_ease-out]" />
          </div>
        ))}
      </button>
    );
  }
);

Button.displayName = 'Button';

// Icon Button - specialized button for icon-only usage
export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'leftIcon' | 'rightIcon'> {
  icon: React.ReactNode;
  'aria-label': string;
}

const IconButton = memo(forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, size = 'icon', ...props }, ref) => {
    return (
      <Button
        ref={ref}
        size={size}
        {...props}
      >
        {icon}
      </Button>
    );
  }
));

IconButton.displayName = 'IconButton';

// Button Group - for grouping related buttons
export interface ButtonGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  spacing?: 'none' | 'sm' | 'md' | 'lg';
  attached?: boolean;
}

const ButtonGroup = memo(forwardRef<HTMLDivElement, ButtonGroupProps>(
  ({
    className,
    orientation = 'horizontal',
    spacing = 'sm',
    attached = false,
    children,
    ...props
  }, ref) => {
    const isHorizontal = orientation === 'horizontal';
    
    const spacingClasses = {
      none: '',
      sm: isHorizontal ? 'gap-1' : 'gap-1',
      md: isHorizontal ? 'gap-2' : 'gap-2',
      lg: isHorizontal ? 'gap-4' : 'gap-4'
    };

    return (
      <div
        ref={ref}
        className={cn(
          'flex',
          isHorizontal ? 'flex-row' : 'flex-col',
          attached ? 'isolate' : spacingClasses[spacing],
          attached && isHorizontal && '[&>button:not(:first-child)]:rounded-l-none [&>button:not(:first-child)]:-ml-px [&>button:not(:last-child)]:rounded-r-none',
          attached && !isHorizontal && '[&>button:not(:first-child)]:rounded-t-none [&>button:not(:first-child)]:-mt-px [&>button:not(:last-child)]:rounded-b-none',
          className
        )}
        role="group"
        aria-label="Button group"
        {...props}
      >
        {children}
      </div>
    );
  }
));

ButtonGroup.displayName = 'ButtonGroup';

// Floating Action Button
export interface FABProps extends Omit<ButtonProps, 'variant' | 'size'> {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  size?: 'default' | 'lg';
  extended?: boolean;
}

const FAB = memo(forwardRef<HTMLButtonElement, FABProps>(
  ({
    className,
    position = 'bottom-right',
    size = 'default',
    extended = false,
    children,
    ...props
  }, ref) => {
    const positionClasses = {
      'bottom-right': 'fixed bottom-4 right-4',
      'bottom-left': 'fixed bottom-4 left-4',
      'top-right': 'fixed top-4 right-4',
      'top-left': 'fixed top-4 left-4'
    };

    const fabSize = extended ? 'lg' : (size === 'lg' ? 'icon-lg' : 'icon');

    return (
      <Button
        ref={ref}
        variant="default"
        size={fabSize}
        className={cn(
          'rounded-full shadow-lg hover:shadow-xl z-50',
          'transition-all duration-200 ease-out',
          positionClasses[position],
          extended && 'px-6',
          className
        )}
        {...props}
      >
        {children}
      </Button>
    );
  }
));

FAB.displayName = 'FAB';

// Toggle Button
export interface ToggleButtonProps extends Omit<ButtonProps, 'variant'> {
  pressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
  'aria-label'?: string;
}

const ToggleButton = memo(forwardRef<HTMLButtonElement, ToggleButtonProps>(
  ({
    pressed = false,
    onPressedChange,
    onClick,
    className,
    ...props
  }, ref) => {
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      onPressedChange?.(!pressed);
      onClick?.(event);
    };

    return (
      <Button
        ref={ref}
        variant={pressed ? 'default' : 'outline'}
        onClick={handleClick}
        aria-pressed={pressed}
        className={cn(
          pressed && 'bg-accent text-accent-foreground',
          className
        )}
        {...props}
      />
    );
  }
));

ToggleButton.displayName = 'ToggleButton';

// Copy Button - specialized button for copying text
export interface CopyButtonProps extends Omit<ButtonProps, 'onClick'> {
  textToCopy: string;
  onCopy?: (text: string) => void;
  copiedText?: string;
  timeout?: number;
}

const CopyButton = memo(forwardRef<HTMLButtonElement, CopyButtonProps>(
  ({
    textToCopy,
    onCopy,
    copiedText = 'Copied!',
    timeout = 2000,
    children = 'Copy',
    variant = 'outline',
    size = 'sm',
    ...props
  }, ref) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        onCopy?.(textToCopy);
        
        setTimeout(() => {
          setCopied(false);
        }, timeout);
      } catch (err) {
        console.error('Failed to copy text:', err);
      }
    };

    return (
      <Button
        ref={ref}
        variant={copied ? 'success' : variant}
        size={size}
        onClick={handleCopy}
        {...props}
      >
        {copied ? (
          <>
            <svg
              className="h-4 w-4 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            {copiedText}
          </>
        ) : (
          <>
            <svg
              className="h-4 w-4 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            {children}
          </>
        )}
      </Button>
    );
  }
));

CopyButton.displayName = 'CopyButton';

export { 
  Button, 
  IconButton, 
  ButtonGroup, 
  FAB, 
  ToggleButton, 
  CopyButton 
};

export type {
  ButtonProps,
  IconButtonProps,
  ButtonGroupProps,
  FABProps,
  ToggleButtonProps,
  CopyButtonProps
};