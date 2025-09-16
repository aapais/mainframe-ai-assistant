import React, { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/className';

// Container Component
const containerVariants = cva('mx-auto px-4', {
  variants: {
    size: {
      sm: 'max-w-screen-sm',
      md: 'max-w-screen-md',
      lg: 'max-w-screen-lg',
      xl: 'max-w-screen-xl',
      '2xl': 'max-w-screen-2xl',
      full: 'max-w-full',
      prose: 'max-w-prose'
    },
    padding: {
      none: 'px-0',
      sm: 'px-4 sm:px-6',
      md: 'px-4 sm:px-6 lg:px-8',
      lg: 'px-6 sm:px-8 lg:px-12'
    }
  },
  defaultVariants: {
    size: 'xl',
    padding: 'md'
  }
});

export interface ContainerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof containerVariants> {
  as?: React.ElementType;
  centerContent?: boolean;
}

const Container = forwardRef<HTMLDivElement, ContainerProps>(
  ({ className, size, padding, as: Component = 'div', centerContent = false, children, ...props }, ref) => {
    return (
      <Component
        ref={ref}
        className={cn(
          containerVariants({ size, padding }),
          centerContent && 'flex items-center justify-center min-h-screen',
          className
        )}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Container.displayName = 'Container';

// Grid Component
const gridVariants = cva('grid', {
  variants: {
    cols: {
      1: 'grid-cols-1',
      2: 'grid-cols-2',
      3: 'grid-cols-3',
      4: 'grid-cols-4',
      5: 'grid-cols-5',
      6: 'grid-cols-6',
      12: 'grid-cols-12',
      none: 'grid-cols-none'
    },
    gap: {
      0: 'gap-0',
      1: 'gap-1',
      2: 'gap-2',
      3: 'gap-3',
      4: 'gap-4',
      6: 'gap-6',
      8: 'gap-8',
      12: 'gap-12'
    },
    responsive: {
      true: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
      false: ''
    }
  },
  defaultVariants: {
    cols: 1,
    gap: 4,
    responsive: false
  }
});

export interface GridProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof gridVariants> {
  as?: React.ElementType;
  // Responsive column configuration
  smCols?: 1 | 2 | 3 | 4 | 6 | 12;
  mdCols?: 1 | 2 | 3 | 4 | 6 | 12;
  lgCols?: 1 | 2 | 3 | 4 | 6 | 12;
  xlCols?: 1 | 2 | 3 | 4 | 6 | 12;
}

const Grid = forwardRef<HTMLDivElement, GridProps>(
  ({ 
    className, 
    cols, 
    gap, 
    responsive, 
    as: Component = 'div', 
    smCols,
    mdCols,
    lgCols,
    xlCols,
    children, 
    ...props 
  }, ref) => {
    // Build responsive classes
    const responsiveClasses = [];
    if (smCols) responsiveClasses.push(`sm:grid-cols-${smCols}`);
    if (mdCols) responsiveClasses.push(`md:grid-cols-${mdCols}`);
    if (lgCols) responsiveClasses.push(`lg:grid-cols-${lgCols}`);
    if (xlCols) responsiveClasses.push(`xl:grid-cols-${xlCols}`);

    return (
      <Component
        ref={ref}
        className={cn(
          gridVariants({ cols, gap, responsive }),
          responsiveClasses.join(' '),
          className
        )}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Grid.displayName = 'Grid';

// Grid Item Component
export interface GridItemProps extends React.HTMLAttributes<HTMLDivElement> {
  colSpan?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 'full';
  rowSpan?: 1 | 2 | 3 | 4 | 5 | 6 | 'full';
  colStart?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;
  colEnd?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;
  rowStart?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  rowEnd?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  as?: React.ElementType;
}

const GridItem = forwardRef<HTMLDivElement, GridItemProps>(
  ({ 
    className, 
    colSpan, 
    rowSpan, 
    colStart, 
    colEnd, 
    rowStart, 
    rowEnd,
    as: Component = 'div', 
    children, 
    ...props 
  }, ref) => {
    const classes = [];
    
    if (colSpan) {
      classes.push(colSpan === 'full' ? 'col-span-full' : `col-span-${colSpan}`);
    }
    if (rowSpan) {
      classes.push(rowSpan === 'full' ? 'row-span-full' : `row-span-${rowSpan}`);
    }
    if (colStart) {
      classes.push(`col-start-${colStart}`);
    }
    if (colEnd) {
      classes.push(`col-end-${colEnd}`);
    }
    if (rowStart) {
      classes.push(`row-start-${rowStart}`);
    }
    if (rowEnd) {
      classes.push(`row-end-${rowEnd}`);
    }

    return (
      <Component
        ref={ref}
        className={cn(classes.join(' '), className)}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

GridItem.displayName = 'GridItem';

// Flex Component
const flexVariants = cva('flex', {
  variants: {
    direction: {
      row: 'flex-row',
      'row-reverse': 'flex-row-reverse',
      col: 'flex-col',
      'col-reverse': 'flex-col-reverse'
    },
    wrap: {
      wrap: 'flex-wrap',
      nowrap: 'flex-nowrap',
      'wrap-reverse': 'flex-wrap-reverse'
    },
    justify: {
      start: 'justify-start',
      end: 'justify-end',
      center: 'justify-center',
      between: 'justify-between',
      around: 'justify-around',
      evenly: 'justify-evenly'
    },
    align: {
      start: 'items-start',
      end: 'items-end',
      center: 'items-center',
      baseline: 'items-baseline',
      stretch: 'items-stretch'
    },
    gap: {
      0: 'gap-0',
      1: 'gap-1',
      2: 'gap-2',
      3: 'gap-3',
      4: 'gap-4',
      6: 'gap-6',
      8: 'gap-8',
      12: 'gap-12'
    }
  },
  defaultVariants: {
    direction: 'row',
    wrap: 'nowrap',
    justify: 'start',
    align: 'stretch',
    gap: 0
  }
});

export interface FlexProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof flexVariants> {
  as?: React.ElementType;
}

const Flex = forwardRef<HTMLDivElement, FlexProps>(
  ({ 
    className, 
    direction, 
    wrap, 
    justify, 
    align, 
    gap,
    as: Component = 'div', 
    children, 
    ...props 
  }, ref) => {
    return (
      <Component
        ref={ref}
        className={cn(flexVariants({ direction, wrap, justify, align, gap }), className)}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Flex.displayName = 'Flex';

// Stack Component (Vertical flex with gap)
export interface StackProps extends Omit<FlexProps, 'direction'> {
  spacing?: 0 | 1 | 2 | 3 | 4 | 6 | 8 | 12;
  divider?: React.ReactNode;
}

const Stack = forwardRef<HTMLDivElement, StackProps>(
  ({ 
    className, 
    spacing = 4, 
    divider, 
    children, 
    ...props 
  }, ref) => {
    const childrenArray = React.Children.toArray(children);
    
    return (
      <Flex
        ref={ref}
        direction="col"
        gap={spacing}
        className={className}
        {...props}
      >
        {divider
          ? childrenArray.map((child, index) => (
              <React.Fragment key={index}>
                {child}
                {index < childrenArray.length - 1 && (
                  <div className="flex-shrink-0">
                    {divider}
                  </div>
                )}
              </React.Fragment>
            ))
          : children
        }
      </Flex>
    );
  }
);

Stack.displayName = 'Stack';

// HStack Component (Horizontal flex with gap)
export interface HStackProps extends Omit<FlexProps, 'direction'> {
  spacing?: 0 | 1 | 2 | 3 | 4 | 6 | 8 | 12;
  divider?: React.ReactNode;
}

const HStack = forwardRef<HTMLDivElement, HStackProps>(
  ({ 
    className, 
    spacing = 4, 
    divider, 
    children, 
    ...props 
  }, ref) => {
    const childrenArray = React.Children.toArray(children);
    
    return (
      <Flex
        ref={ref}
        direction="row"
        gap={spacing}
        className={className}
        {...props}
      >
        {divider
          ? childrenArray.map((child, index) => (
              <React.Fragment key={index}>
                {child}
                {index < childrenArray.length - 1 && (
                  <div className="flex-shrink-0">
                    {divider}
                  </div>
                )}
              </React.Fragment>
            ))
          : children
        }
      </Flex>
    );
  }
);

HStack.displayName = 'HStack';

// Center Component
export interface CenterProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: React.ElementType;
  inline?: boolean;
}

const Center = forwardRef<HTMLDivElement, CenterProps>(
  ({ className, as: Component = 'div', inline = false, children, ...props }, ref) => {
    return (
      <Component
        ref={ref}
        className={cn(
          inline ? 'inline-flex' : 'flex',
          'items-center justify-center',
          className
        )}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Center.displayName = 'Center';

// Spacer Component
export interface SpacerProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: React.ElementType;
}

const Spacer = forwardRef<HTMLDivElement, SpacerProps>(
  ({ className, as: Component = 'div', ...props }, ref) => {
    return (
      <Component
        ref={ref}
        className={cn('flex-1', className)}
        {...props}
      />
    );
  }
);

Spacer.displayName = 'Spacer';

// Box Component (generic container)
const boxVariants = cva('', {
  variants: {
    p: {
      0: 'p-0',
      1: 'p-1',
      2: 'p-2',
      3: 'p-3',
      4: 'p-4',
      6: 'p-6',
      8: 'p-8',
      12: 'p-12'
    },
    m: {
      0: 'm-0',
      1: 'm-1',
      2: 'm-2',
      3: 'm-3',
      4: 'm-4',
      6: 'm-6',
      8: 'm-8',
      12: 'm-12'
    }
  }
});

export interface BoxProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof boxVariants> {
  as?: React.ElementType;
}

const Box = forwardRef<HTMLDivElement, BoxProps>(
  ({ className, p, m, as: Component = 'div', children, ...props }, ref) => {
    return (
      <Component
        ref={ref}
        className={cn(boxVariants({ p, m }), className)}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Box.displayName = 'Box';

// Divider Component
export interface DividerProps extends React.HTMLAttributes<HTMLHRElement> {
  orientation?: 'horizontal' | 'vertical';
  variant?: 'solid' | 'dashed' | 'dotted';
  thickness?: 'thin' | 'medium' | 'thick';
  color?: 'border' | 'muted' | 'primary' | 'secondary';
}

const Divider = forwardRef<HTMLHRElement, DividerProps>(
  ({ 
    className, 
    orientation = 'horizontal',
    variant = 'solid',
    thickness = 'thin',
    color = 'border',
    ...props 
  }, ref) => {
    const isVertical = orientation === 'vertical';
    
    const thicknessClasses = {
      thin: isVertical ? 'w-px' : 'h-px',
      medium: isVertical ? 'w-0.5' : 'h-0.5',
      thick: isVertical ? 'w-1' : 'h-1'
    };
    
    const colorClasses = {
      border: 'border-border',
      muted: 'border-muted',
      primary: 'border-primary',
      secondary: 'border-secondary'
    };
    
    const variantClasses = {
      solid: 'border-solid',
      dashed: 'border-dashed',
      dotted: 'border-dotted'
    };

    return (
      <hr
        ref={ref}
        className={cn(
          'border-0 bg-current',
          thicknessClasses[thickness],
          colorClasses[color],
          variantClasses[variant],
          isVertical ? 'h-auto self-stretch' : 'w-full',
          className
        )}
        {...props}
      />
    );
  }
);

Divider.displayName = 'Divider';

// Export all components
export {
  Container,
  Grid,
  GridItem,
  Flex,
  Stack,
  HStack,
  Center,
  Spacer,
  Box,
  Divider
};

export type {
  ContainerProps,
  GridProps,
  GridItemProps,
  FlexProps,
  StackProps,
  HStackProps,
  CenterProps,
  SpacerProps,
  BoxProps,
  DividerProps
};