/**
 * FluidContainer - Adaptive container with intrinsic sizing
 *
 * Features:
 * - Fluid sizing with clamp() for responsive typography and spacing
 * - CSS logical properties for international support (RTL/LTR)
 * - Container queries for component-level responsiveness
 * - CSS containment for performance optimization
 * - Aspect ratio preservation with modern CSS
 * - Intrinsic sizing with min/max constraints
 *
 * @version 3.0.0
 * @performance Optimized for minimal layout thrashing
 */

import React, { forwardRef, useMemo, CSSProperties, HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

// =========================
// TYPES & INTERFACES
// =========================

export interface FluidContainerProps extends HTMLAttributes<HTMLDivElement> {
  /** Container size variants using fluid scaling */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full' | 'prose' | 'content';

  /** Padding using responsive clamp() values */
  padding?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'responsive';

  /** Margin using logical properties */
  margin?: 'none' | 'auto' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

  /** Aspect ratio for consistent proportions */
  aspectRatio?: 'square' | 'video' | 'wide' | 'portrait' | 'golden' | number | string;

  /** Container query name for nested responsiveness */
  containerName?: string;

  /** CSS containment level for performance */
  containment?: 'layout' | 'style' | 'paint' | 'strict' | 'none';

  /** Breakout behavior for full-width sections */
  breakout?: boolean;

  /** Center content within container */
  centered?: boolean;

  /** Enable smooth scrolling */
  smoothScroll?: boolean;

  /** Content alignment */
  align?: 'start' | 'center' | 'end';

  /** Enable GPU acceleration */
  enableGPU?: boolean;

  /** Element semantic type */
  as?: keyof JSX.IntrinsicElements;

  /** Accessibility role */
  role?: string;
}

// =========================
// UTILITY FUNCTIONS
// =========================

/**
 * Generate fluid size values using clamp()
 */
const getFluidSize = (size: FluidContainerProps['size'] = 'md'): string => {
  const sizeMap = {
    xs: 'clamp(16rem, 90vw, 20rem)',     // 256px - 320px
    sm: 'clamp(20rem, 90vw, 36rem)',     // 320px - 576px
    md: 'clamp(36rem, 90vw, 48rem)',     // 576px - 768px
    lg: 'clamp(48rem, 90vw, 64rem)',     // 768px - 1024px
    xl: 'clamp(64rem, 90vw, 80rem)',     // 1024px - 1280px
    '2xl': 'clamp(80rem, 90vw, 96rem)',  // 1280px - 1536px
    full: '100%',
    prose: 'clamp(45ch, 50vw, 75ch)',    // Optimal reading width
    content: 'max-content',               // Intrinsic sizing
  };

  return sizeMap[size];
};

/**
 * Generate responsive padding using clamp()
 */
const getFluidPadding = (padding: FluidContainerProps['padding'] = 'md'): string => {
  const paddingMap = {
    none: '0',
    xs: 'clamp(0.5rem, 2vw, 0.75rem)',   // 8px - 12px
    sm: 'clamp(0.75rem, 3vw, 1rem)',     // 12px - 16px
    md: 'clamp(1rem, 4vw, 1.5rem)',      // 16px - 24px
    lg: 'clamp(1.5rem, 5vw, 2rem)',      // 24px - 32px
    xl: 'clamp(2rem, 6vw, 3rem)',        // 32px - 48px
    responsive: 'clamp(1rem, 5vw, 2rem)', // Adaptive padding
  };

  return paddingMap[padding];
};

/**
 * Generate logical margin values
 */
const getLogicalMargin = (margin: FluidContainerProps['margin'] = 'none'): Record<string, string> => {
  const marginMap = {
    none: { marginInline: '0', marginBlock: '0' },
    auto: { marginInline: 'auto', marginBlock: '0' },
    xs: { marginInline: 'auto', marginBlock: 'clamp(0.5rem, 2vw, 0.75rem)' },
    sm: { marginInline: 'auto', marginBlock: 'clamp(0.75rem, 3vw, 1rem)' },
    md: { marginInline: 'auto', marginBlock: 'clamp(1rem, 4vw, 1.5rem)' },
    lg: { marginInline: 'auto', marginBlock: 'clamp(1.5rem, 5vw, 2rem)' },
    xl: { marginInline: 'auto', marginBlock: 'clamp(2rem, 6vw, 3rem)' },
  };

  return marginMap[margin];
};

/**
 * Generate aspect ratio value
 */
const getAspectRatio = (aspectRatio: FluidContainerProps['aspectRatio']): string | undefined => {
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

// =========================
// CONTAINER VARIANTS
// =========================

const containerVariants = cva(
  [
    'fluid-container',
    'contain-layout', // CSS containment for performance
  ],
  {
    variants: {
      centered: {
        true: 'mx-auto',
        false: '',
      },
      breakout: {
        true: 'breakout-container',
        false: '',
      },
      smoothScroll: {
        true: 'scroll-smooth',
        false: '',
      },
      align: {
        start: 'text-start',
        center: 'text-center',
        end: 'text-end',
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
    },
    defaultVariants: {
      centered: true,
      breakout: false,
      smoothScroll: false,
      align: 'start',
      containment: 'layout',
      enableGPU: false,
    },
  }
);

// =========================
// MAIN COMPONENT
// =========================

export const FluidContainer = forwardRef<HTMLDivElement, FluidContainerProps>(
  ({
    size = 'md',
    padding = 'md',
    margin = 'auto',
    aspectRatio,
    containerName,
    containment = 'layout',
    breakout = false,
    centered = true,
    smoothScroll = false,
    align = 'start',
    enableGPU = false,
    as: Component = 'div',
    className = '',
    style,
    children,
    role,
    ...props
  }, ref) => {
    // Generate CSS classes
    const containerClasses = useMemo(() => {
      const baseClasses = containerVariants({
        centered,
        breakout,
        smoothScroll,
        align,
        containment,
        enableGPU,
      });

      return [baseClasses, className].filter(Boolean).join(' ');
    }, [centered, breakout, smoothScroll, align, containment, enableGPU, className]);

    // Generate inline styles
    const containerStyles = useMemo((): CSSProperties => {
      const baseStyles: CSSProperties = {
        // Fluid sizing
        maxInlineSize: getFluidSize(size),

        // Responsive padding using logical properties
        paddingInline: getFluidPadding(padding),
        paddingBlock: getFluidPadding(padding),

        // Logical margins
        ...getLogicalMargin(margin),

        // Container queries
        ...(containerName && {
          containerName,
          containerType: 'inline-size',
        }),

        // Aspect ratio
        ...(aspectRatio && {
          aspectRatio: getAspectRatio(aspectRatio),
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
    }, [size, padding, margin, containerName, aspectRatio, enableGPU, style]);

    return (
      <Component
        ref={ref}
        className={containerClasses}
        style={containerStyles}
        role={role}
        data-container={containerName}
        data-size={size}
        data-breakout={breakout}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

FluidContainer.displayName = 'FluidContainer';

// =========================
// SPECIALIZED VARIANTS
// =========================

export const ArticleContainer = forwardRef<HTMLDivElement, Omit<FluidContainerProps, 'size' | 'as'>>(
  (props, ref) => (
    <FluidContainer
      ref={ref}
      as="article"
      size="prose"
      padding="responsive"
      {...props}
    />
  )
);

ArticleContainer.displayName = 'ArticleContainer';

export const SectionContainer = forwardRef<HTMLDivElement, Omit<FluidContainerProps, 'as' | 'margin'>>(
  (props, ref) => (
    <FluidContainer
      ref={ref}
      as="section"
      margin="lg"
      {...props}
    />
  )
);

SectionContainer.displayName = 'SectionContainer';

export const ContentContainer = forwardRef<HTMLDivElement, Omit<FluidContainerProps, 'size' | 'centered'>>(
  (props, ref) => (
    <FluidContainer
      ref={ref}
      size="content"
      centered={false}
      {...props}
    />
  )
);

ContentContainer.displayName = 'ContentContainer';

export const BreakoutContainer = forwardRef<HTMLDivElement, Omit<FluidContainerProps, 'breakout' | 'size'>>(
  (props, ref) => (
    <FluidContainer
      ref={ref}
      breakout
      size="full"
      {...props}
    />
  )
);

BreakoutContainer.displayName = 'BreakoutContainer';

export const AspectContainer = forwardRef<HTMLDivElement, Omit<FluidContainerProps, 'aspectRatio'> & { ratio: NonNullable<FluidContainerProps['aspectRatio']> }>(
  ({ ratio, ...props }, ref) => (
    <FluidContainer
      ref={ref}
      aspectRatio={ratio}
      {...props}
    />
  )
);

AspectContainer.displayName = 'AspectContainer';

// =========================
// EXPORTS
// =========================

export default FluidContainer;
export type { FluidContainerProps };