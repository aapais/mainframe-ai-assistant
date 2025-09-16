import React, { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/className';

// Typography variant definitions
const typographyVariants = cva('', {
  variants: {
    variant: {
      // Display variants for headings
      'display-2xl': 'scroll-m-20 text-5xl font-extrabold tracking-tight lg:text-6xl',
      'display-xl': 'scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl',
      'display-lg': 'scroll-m-20 text-3xl font-bold tracking-tight lg:text-4xl',
      'display-md': 'scroll-m-20 text-2xl font-bold tracking-tight lg:text-3xl',
      'display-sm': 'scroll-m-20 text-xl font-bold tracking-tight lg:text-2xl',
      
      // Heading variants
      'heading-xl': 'scroll-m-20 text-3xl font-semibold tracking-tight',
      'heading-lg': 'scroll-m-20 text-2xl font-semibold tracking-tight',
      'heading-md': 'scroll-m-20 text-xl font-semibold tracking-tight',
      'heading-sm': 'scroll-m-20 text-lg font-semibold tracking-tight',
      'heading-xs': 'scroll-m-20 text-base font-semibold tracking-tight',
      
      // Body text variants
      'body-lg': 'text-lg leading-7',
      'body-md': 'text-base leading-7',
      'body-sm': 'text-sm leading-6',
      'body-xs': 'text-xs leading-5',
      
      // Specialized variants
      'caption': 'text-xs font-medium text-muted-foreground uppercase tracking-wide',
      'label': 'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
      'code': 'relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm',
      'kbd': 'pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground',
      'link': 'font-medium underline underline-offset-4 hover:no-underline focus:no-underline',
      'muted': 'text-sm text-muted-foreground',
      'lead': 'text-xl text-muted-foreground',
      'blockquote': 'mt-6 border-l-2 pl-6 italic'
    },
    color: {
      default: 'text-foreground',
      primary: 'text-primary',
      secondary: 'text-secondary-foreground',
      success: 'text-success',
      warning: 'text-warning',
      danger: 'text-danger',
      muted: 'text-muted-foreground',
      accent: 'text-accent',
      // Mainframe-specific colors
      'terminal-green': 'text-emerald-400',
      'terminal-amber': 'text-amber-400',
      'ibm-blue': 'text-blue-500'
    },
    weight: {
      light: 'font-light',
      normal: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
      bold: 'font-bold',
      extrabold: 'font-extrabold'
    },
    align: {
      left: 'text-left',
      center: 'text-center',
      right: 'text-right',
      justify: 'text-justify'
    },
    transform: {
      none: 'normal-case',
      uppercase: 'uppercase',
      lowercase: 'lowercase',
      capitalize: 'capitalize'
    }
  },
  defaultVariants: {
    variant: 'body-md',
    color: 'default',
    weight: 'normal',
    align: 'left',
    transform: 'none'
  }
});

export interface TypographyProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof typographyVariants> {
  as?: React.ElementType;
  truncate?: boolean;
  responsive?: boolean;
}

// Main Typography component
const Typography = forwardRef<HTMLElement, TypographyProps>(
  ({ 
    className, 
    variant, 
    color, 
    weight, 
    align, 
    transform, 
    as, 
    truncate = false,
    responsive = false,
    children, 
    ...props 
  }, ref) => {
    // Determine the HTML element based on variant if `as` is not provided
    const getDefaultElement = (variant: string | null | undefined) => {
      if (!variant) return 'p';
      
      if (variant.startsWith('display-')) return 'h1';
      if (variant.startsWith('heading-xl')) return 'h1';
      if (variant.startsWith('heading-lg')) return 'h2';
      if (variant.startsWith('heading-md')) return 'h3';
      if (variant.startsWith('heading-sm')) return 'h4';
      if (variant.startsWith('heading-xs')) return 'h5';
      if (variant === 'blockquote') return 'blockquote';
      if (variant === 'code') return 'code';
      if (variant === 'kbd') return 'kbd';
      if (variant === 'link') return 'a';
      if (variant === 'caption' || variant === 'label') return 'span';
      return 'p';
    };

    const Component = as || getDefaultElement(variant);

    const classes = cn(
      typographyVariants({ variant, color, weight, align, transform }),
      truncate && 'truncate',
      responsive && 'responsive-text',
      className
    );

    return (
      <Component
        ref={ref}
        className={classes}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Typography.displayName = 'Typography';

// Specific typography components for common use cases
export const H1 = forwardRef<HTMLHeadingElement, Omit<TypographyProps, 'as' | 'variant'>>(
  ({ children, className, ...props }, ref) => (
    <Typography
      ref={ref}
      as="h1"
      variant="display-lg"
      className={className}
      {...props}
    >
      {children}
    </Typography>
  )
);
H1.displayName = 'H1';

export const H2 = forwardRef<HTMLHeadingElement, Omit<TypographyProps, 'as' | 'variant'>>(
  ({ children, className, ...props }, ref) => (
    <Typography
      ref={ref}
      as="h2"
      variant="heading-xl"
      className={className}
      {...props}
    >
      {children}
    </Typography>
  )
);
H2.displayName = 'H2';

export const H3 = forwardRef<HTMLHeadingElement, Omit<TypographyProps, 'as' | 'variant'>>(
  ({ children, className, ...props }, ref) => (
    <Typography
      ref={ref}
      as="h3"
      variant="heading-lg"
      className={className}
      {...props}
    >
      {children}
    </Typography>
  )
);
H3.displayName = 'H3';

export const H4 = forwardRef<HTMLHeadingElement, Omit<TypographyProps, 'as' | 'variant'>>(
  ({ children, className, ...props }, ref) => (
    <Typography
      ref={ref}
      as="h4"
      variant="heading-md"
      className={className}
      {...props}
    >
      {children}
    </Typography>
  )
);
H4.displayName = 'H4';

export const H5 = forwardRef<HTMLHeadingElement, Omit<TypographyProps, 'as' | 'variant'>>(
  ({ children, className, ...props }, ref) => (
    <Typography
      ref={ref}
      as="h5"
      variant="heading-sm"
      className={className}
      {...props}
    >
      {children}
    </Typography>
  )
);
H5.displayName = 'H5';

export const H6 = forwardRef<HTMLHeadingElement, Omit<TypographyProps, 'as' | 'variant'>>(
  ({ children, className, ...props }, ref) => (
    <Typography
      ref={ref}
      as="h6"
      variant="heading-xs"
      className={className}
      {...props}
    >
      {children}
    </Typography>
  )
);
H6.displayName = 'H6';

export const Text = forwardRef<HTMLParagraphElement, Omit<TypographyProps, 'as'>>(
  ({ children, className, variant = 'body-md', ...props }, ref) => (
    <Typography
      ref={ref}
      as="p"
      variant={variant}
      className={className}
      {...props}
    >
      {children}
    </Typography>
  )
);
Text.displayName = 'Text';

export const Small = forwardRef<HTMLElement, Omit<TypographyProps, 'as' | 'variant'>>(
  ({ children, className, ...props }, ref) => (
    <Typography
      ref={ref}
      as="small"
      variant="body-sm"
      className={className}
      {...props}
    >
      {children}
    </Typography>
  )
);
Small.displayName = 'Small';

export const Lead = forwardRef<HTMLParagraphElement, Omit<TypographyProps, 'as' | 'variant'>>(
  ({ children, className, ...props }, ref) => (
    <Typography
      ref={ref}
      as="p"
      variant="lead"
      className={className}
      {...props}
    >
      {children}
    </Typography>
  )
);
Lead.displayName = 'Lead';

export const Muted = forwardRef<HTMLParagraphElement, Omit<TypographyProps, 'as' | 'variant'>>(
  ({ children, className, ...props }, ref) => (
    <Typography
      ref={ref}
      as="p"
      variant="muted"
      className={className}
      {...props}
    >
      {children}
    </Typography>
  )
);
Muted.displayName = 'Muted';

export const Code = forwardRef<HTMLElement, Omit<TypographyProps, 'as' | 'variant'>>(
  ({ children, className, ...props }, ref) => (
    <Typography
      ref={ref}
      as="code"
      variant="code"
      className={className}
      {...props}
    >
      {children}
    </Typography>
  )
);
Code.displayName = 'Code';

export const Kbd = forwardRef<HTMLElement, Omit<TypographyProps, 'as' | 'variant'>>(
  ({ children, className, ...props }, ref) => (
    <Typography
      ref={ref}
      as="kbd"
      variant="kbd"
      className={className}
      {...props}
    >
      {children}
    </Typography>
  )
);
Kbd.displayName = 'Kbd';

export const Label = forwardRef<HTMLLabelElement, Omit<TypographyProps, 'as' | 'variant'>>(
  ({ children, className, ...props }, ref) => (
    <Typography
      ref={ref}
      as="label"
      variant="label"
      className={className}
      {...props}
    >
      {children}
    </Typography>
  )
);
Label.displayName = 'Label';

export const Caption = forwardRef<HTMLElement, Omit<TypographyProps, 'as' | 'variant'>>(
  ({ children, className, ...props }, ref) => (
    <Typography
      ref={ref}
      as="span"
      variant="caption"
      className={className}
      {...props}
    >
      {children}
    </Typography>
  )
);
Caption.displayName = 'Caption';

export const Link = forwardRef<HTMLAnchorElement, Omit<TypographyProps, 'as' | 'variant'>>(
  ({ children, className, ...props }, ref) => (
    <Typography
      ref={ref}
      as="a"
      variant="link"
      className={cn('focus-ring cursor-pointer', className)}
      {...props}
    >
      {children}
    </Typography>
  )
);
Link.displayName = 'Link';

export const Blockquote = forwardRef<HTMLQuoteElement, Omit<TypographyProps, 'as' | 'variant'>>(
  ({ children, className, ...props }, ref) => (
    <Typography
      ref={ref}
      as="blockquote"
      variant="blockquote"
      className={className}
      {...props}
    >
      {children}
    </Typography>
  )
);
Blockquote.displayName = 'Blockquote';

// Export the main Typography component and all variants
export { Typography };

// Re-export variant types for external use
export type { TypographyProps };