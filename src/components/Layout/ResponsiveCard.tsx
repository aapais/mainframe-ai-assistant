/**
 * ResponsiveCard - Adaptive card component with aspect ratio preservation
 *
 * Features:
 * - CSS aspect-ratio for consistent proportions
 * - Container queries for component-level responsiveness
 * - CSS containment for optimal performance
 * - CSS logical properties for international support
 * - Intrinsic sizing with flexible content layouts
 * - Touch-optimized interaction patterns
 * - Skeleton loading states
 *
 * @version 3.0.0
 * @performance Optimized for 60fps interactions
 */

import React, {
  forwardRef,
  useMemo,
  useState,
  useRef,
  useEffect,
  CSSProperties,
  HTMLAttributes,
  ReactNode,
  MouseEvent,
  KeyboardEvent
} from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

// =========================
// TYPES & INTERFACES
// =========================

export interface ResponsiveCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Card content areas */
  header?: ReactNode;
  media?: ReactNode;
  content?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;

  /** Layout variant */
  variant?: 'default' | 'outlined' | 'elevated' | 'filled' | 'transparent';

  /** Size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl';

  /** Aspect ratio for consistent proportions */
  aspectRatio?: 'square' | 'video' | 'wide' | 'portrait' | 'golden' | number | string;

  /** Media aspect ratio (separate from card) */
  mediaAspectRatio?: 'square' | 'video' | 'wide' | 'portrait' | 'golden' | number | string;

  /** Orientation for different layouts */
  orientation?: 'vertical' | 'horizontal' | 'auto';

  /** Padding variant */
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'responsive';

  /** Border radius */
  borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';

  /** Interactive behavior */
  interactive?: boolean;
  clickable?: boolean;
  href?: string;
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;

  /** Loading state */
  loading?: boolean;

  /** Container query name */
  containerName?: string;

  /** Enable overflow handling */
  allowOverflow?: boolean;

  /** Accessibility */
  ariaLabel?: string;
  role?: string;

  /** Performance optimizations */
  containment?: 'layout' | 'style' | 'paint' | 'strict' | 'none';
  enableGPU?: boolean;

  /** Animation preferences */
  enableAnimations?: boolean;
  hoverEffect?: 'none' | 'lift' | 'scale' | 'glow' | 'border';

  /** Element type */
  as?: keyof JSX.IntrinsicElements;
}

// =========================
// UTILITY FUNCTIONS
// =========================

/**
 * Generate aspect ratio value
 */
const getAspectRatio = (aspectRatio?: ResponsiveCardProps['aspectRatio']): string | undefined => {
  if (typeof aspectRatio === 'number') {
    return aspectRatio.toString();
  }

  if (typeof aspectRatio === 'string' && aspectRatio.includes('/')) {
    return aspectRatio;
  }

  const ratioMap = {
    square: '1',
    video: '16 / 9',
    wide: '21 / 9',
    portrait: '3 / 4',
    golden: '1.618',
  };

  return ratioMap[aspectRatio as keyof typeof ratioMap];
};

/**
 * Get responsive padding using clamp()
 */
const getResponsivePadding = (padding: ResponsiveCardProps['padding'] = 'md'): string => {
  const paddingMap = {
    none: '0',
    sm: 'clamp(0.75rem, 2vw, 1rem)',     // 12px - 16px
    md: 'clamp(1rem, 3vw, 1.5rem)',      // 16px - 24px
    lg: 'clamp(1.5rem, 4vw, 2rem)',      // 24px - 32px
    xl: 'clamp(2rem, 5vw, 3rem)',        // 32px - 48px
    responsive: 'clamp(1rem, 4vw, 2rem)', // Adaptive padding
  };

  return paddingMap[padding];
};

/**
 * Get border radius classes
 */
const getBorderRadiusClass = (borderRadius: ResponsiveCardProps['borderRadius'] = 'md'): string => {
  const radiusMap = {
    none: 'rounded-none',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    full: 'rounded-full',
  };

  return radiusMap[borderRadius];
};

// =========================
// COMPONENT VARIANTS
// =========================

const cardVariants = cva(
  [
    'responsive-card',
    'contain-layout',
    'overflow-hidden',
    'transition-all',
    'duration-200',
    'ease-out',
  ],
  {
    variants: {
      variant: {
        default: 'bg-white border border-gray-200',
        outlined: 'bg-transparent border-2 border-gray-300',
        elevated: 'bg-white shadow-lg border-0',
        filled: 'bg-gray-50 border-0',
        transparent: 'bg-transparent border-0',
      },
      size: {
        sm: 'card-sm text-sm',
        md: 'card-md text-base',
        lg: 'card-lg text-lg',
        xl: 'card-xl text-xl',
      },
      orientation: {
        vertical: 'flex flex-col',
        horizontal: 'flex flex-row',
        auto: 'flex flex-col lg:flex-row',
      },
      interactive: {
        true: 'cursor-pointer focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-opacity-50',
        false: '',
      },
      clickable: {
        true: 'hover:shadow-md active:scale-[0.98]',
        false: '',
      },
      hoverEffect: {
        none: '',
        lift: 'hover:shadow-lg hover:-translate-y-1',
        scale: 'hover:scale-105',
        glow: 'hover:shadow-xl hover:shadow-blue-500/25',
        border: 'hover:border-blue-500',
      },
      containment: {
        layout: 'contain-layout',
        style: 'contain-style',
        paint: 'contain-paint',
        strict: 'contain-strict',
        none: '',
      },
      enableGPU: {
        true: 'gpu-layer',
        false: '',
      },
      enableAnimations: {
        true: '',
        false: 'motion-reduce:transition-none motion-reduce:transform-none',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
      orientation: 'vertical',
      interactive: false,
      clickable: false,
      hoverEffect: 'none',
      containment: 'layout',
      enableGPU: false,
      enableAnimations: true,
    },
  }
);

const mediaContainerVariants = cva(
  [
    'card-media-container',
    'overflow-hidden',
    'flex-shrink-0',
  ],
  {
    variants: {
      orientation: {
        vertical: 'w-full',
        horizontal: 'w-1/3',
        auto: 'w-full lg:w-1/3',
      },
    },
    defaultVariants: {
      orientation: 'vertical',
    },
  }
);

const contentContainerVariants = cva(
  [
    'card-content-container',
    'flex',
    'flex-col',
    'flex-1',
    'min-w-0', // Prevent flex item overflow
  ],
  {
    variants: {
      padding: {
        none: '',
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-6',
        xl: 'p-8',
        responsive: '', // Handled via CSS custom properties
      },
    },
    defaultVariants: {
      padding: 'md',
    },
  }
);

// =========================
// SUB-COMPONENTS
// =========================

const CardSkeleton = ({ aspectRatio }: { aspectRatio?: string }) => (
  <div className="card-skeleton animate-pulse">
    <div
      className="bg-gray-200 w-full"
      style={{ aspectRatio }}
    />
    <div className="p-4 space-y-3">
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
      <div className="space-y-2">
        <div className="h-3 bg-gray-200 rounded"></div>
        <div className="h-3 bg-gray-200 rounded w-5/6"></div>
      </div>
    </div>
  </div>
);

const CardMedia = ({
  media,
  aspectRatio,
  orientation,
}: {
  media: ReactNode;
  aspectRatio?: string;
  orientation: ResponsiveCardProps['orientation'];
}) => {
  if (!media) return null;

  const containerClasses = mediaContainerVariants({ orientation });

  return (
    <div
      className={containerClasses}
      style={{ aspectRatio }}
    >
      <div className="w-full h-full object-cover">
        {media}
      </div>
    </div>
  );
};

const CardContent = ({
  header,
  content,
  actions,
  footer,
  padding,
}: {
  header?: ReactNode;
  content?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  padding: ResponsiveCardProps['padding'];
}) => {
  const containerClasses = contentContainerVariants({ padding });

  return (
    <div className={containerClasses}>
      {header && (
        <div className="card-header flex-shrink-0 mb-3">
          {header}
        </div>
      )}

      {content && (
        <div className="card-content flex-1 min-h-0">
          {content}
        </div>
      )}

      {actions && (
        <div className="card-actions flex-shrink-0 mt-4 flex gap-2 justify-end">
          {actions}
        </div>
      )}

      {footer && (
        <div className="card-footer flex-shrink-0 mt-3 pt-3 border-t border-gray-200">
          {footer}
        </div>
      )}
    </div>
  );
};

// =========================
// MAIN COMPONENT
// =========================

export const ResponsiveCard = forwardRef<HTMLDivElement, ResponsiveCardProps>(
  ({
    header,
    media,
    content,
    actions,
    footer,
    variant = 'default',
    size = 'md',
    aspectRatio,
    mediaAspectRatio,
    orientation = 'vertical',
    padding = 'md',
    borderRadius = 'md',
    interactive = false,
    clickable = false,
    href,
    onClick,
    loading = false,
    containerName,
    allowOverflow = false,
    ariaLabel,
    role,
    containment = 'layout',
    enableGPU = false,
    enableAnimations = true,
    hoverEffect = 'none',
    as: Component = 'div',
    className = '',
    style,
    children,
    ...props
  }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    // Handle click events
    const handleClick = (event: MouseEvent<HTMLDivElement>) => {
      if (!clickable && !onClick && !href) return;

      onClick?.(event);

      if (href && !event.defaultPrevented) {
        window.location.href = href;
      }
    };

    // Handle keyboard events
    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleClick(event as any);
      }
    };

    // Focus management
    const handleFocus = () => setIsFocused(true);
    const handleBlur = () => setIsFocused(false);

    // Generate CSS classes
    const cardClasses = useMemo(() => {
      const baseClasses = cardVariants({
        variant,
        size,
        orientation,
        interactive: interactive || clickable || !!onClick || !!href,
        clickable: clickable || !!onClick || !!href,
        hoverEffect,
        containment,
        enableGPU,
        enableAnimations,
      });

      const borderClasses = getBorderRadiusClass(borderRadius);

      return [
        baseClasses,
        borderClasses,
        allowOverflow ? '' : 'overflow-hidden',
        className
      ].filter(Boolean).join(' ');
    }, [
      variant,
      size,
      orientation,
      interactive,
      clickable,
      onClick,
      href,
      hoverEffect,
      containment,
      enableGPU,
      enableAnimations,
      borderRadius,
      allowOverflow,
      className
    ]);

    // Generate inline styles
    const cardStyles = useMemo((): CSSProperties => {
      const baseStyles: CSSProperties = {
        // Aspect ratio for the entire card
        ...(aspectRatio && { aspectRatio: getAspectRatio(aspectRatio) }),

        // Container queries
        ...(containerName && {
          containerName,
          containerType: 'inline-size',
        }),

        // Responsive padding via CSS custom properties
        ...(padding === 'responsive' && {
          paddingInline: getResponsivePadding(padding),
          paddingBlock: getResponsivePadding(padding),
        }),

        // Performance optimizations
        ...(enableGPU && {
          willChange: 'transform',
          transform: 'translateZ(0)',
        }),

        // User styles override
        ...style,
      };

      return baseStyles;
    }, [aspectRatio, containerName, padding, enableGPU, style]);

    // Loading state
    if (loading) {
      return (
        <div
          ref={ref}
          className={cardClasses}
          style={cardStyles}
          {...props}
        >
          <CardSkeleton aspectRatio={getAspectRatio(aspectRatio)} />
        </div>
      );
    }

    // Determine if the card should be interactive
    const isInteractive = interactive || clickable || !!onClick || !!href;

    return (
      <Component
        ref={ref}
        className={cardClasses}
        style={cardStyles}
        onClick={isInteractive ? handleClick : undefined}
        onKeyDown={isInteractive ? handleKeyDown : undefined}
        onFocus={isInteractive ? handleFocus : undefined}
        onBlur={isInteractive ? handleBlur : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        role={role || (isInteractive ? 'button' : undefined)}
        aria-label={ariaLabel}
        data-container={containerName}
        data-interactive={isInteractive}
        data-focused={isFocused}
        {...props}
      >
        {/* Media section */}
        <CardMedia
          media={media}
          aspectRatio={getAspectRatio(mediaAspectRatio)}
          orientation={orientation}
        />

        {/* Content section */}
        <CardContent
          header={header}
          content={content}
          actions={actions}
          footer={footer}
          padding={padding}
        />

        {/* Additional children */}
        {children}
      </Component>
    );
  }
);

ResponsiveCard.displayName = 'ResponsiveCard';

// =========================
// SPECIALIZED VARIANTS
// =========================

export const MediaCard = forwardRef<HTMLDivElement, Omit<ResponsiveCardProps, 'media'> & { media: ReactNode }>(
  ({ media, ...props }, ref) => (
    <ResponsiveCard
      ref={ref}
      media={media}
      mediaAspectRatio="video"
      {...props}
    />
  )
);

MediaCard.displayName = 'MediaCard';

export const ActionCard = forwardRef<HTMLDivElement, Omit<ResponsiveCardProps, 'clickable' | 'hoverEffect'>>(
  (props, ref) => (
    <ResponsiveCard
      ref={ref}
      clickable
      hoverEffect="lift"
      {...props}
    />
  )
);

ActionCard.displayName = 'ActionCard';

export const CompactCard = forwardRef<HTMLDivElement, Omit<ResponsiveCardProps, 'size' | 'padding'>>(
  (props, ref) => (
    <ResponsiveCard
      ref={ref}
      size="sm"
      padding="sm"
      {...props}
    />
  )
);

CompactCard.displayName = 'CompactCard';

export const FeatureCard = forwardRef<HTMLDivElement, Omit<ResponsiveCardProps, 'variant' | 'hoverEffect'>>(
  (props, ref) => (
    <ResponsiveCard
      ref={ref}
      variant="elevated"
      hoverEffect="glow"
      {...props}
    />
  )
);

FeatureCard.displayName = 'FeatureCard';

export const AspectCard = forwardRef<HTMLDivElement, Omit<ResponsiveCardProps, 'aspectRatio'> & { ratio: NonNullable<ResponsiveCardProps['aspectRatio']> }>(
  ({ ratio, ...props }, ref) => (
    <ResponsiveCard
      ref={ref}
      aspectRatio={ratio}
      {...props}
    />
  )
);

AspectCard.displayName = 'AspectCard';

// =========================
// EXPORTS
// =========================

export default ResponsiveCard;
export type { ResponsiveCardProps };