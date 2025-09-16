import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function to merge Tailwind CSS classes with proper precedence
 * Uses clsx for conditional classes and tailwind-merge for conflicting classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Create responsive class name based on breakpoints
 */
export function createResponsiveClass(
  base: string,
  sm?: string,
  md?: string,
  lg?: string,
  xl?: string
) {
  const classes = [base];
  
  if (sm) classes.push(`sm:${sm}`);
  if (md) classes.push(`md:${md}`);
  if (lg) classes.push(`lg:${lg}`);
  if (xl) classes.push(`xl:${xl}`);
  
  return classes.join(' ');
}

/**
 * Generate focus ring classes based on variant
 */
export function focusRing(variant?: 'default' | 'danger' | 'success') {
  switch (variant) {
    case 'danger':
      return 'focus:outline-none focus:ring-2 focus:ring-danger-500 focus:ring-offset-2';
    case 'success':
      return 'focus:outline-none focus:ring-2 focus:ring-success-500 focus:ring-offset-2';
    default:
      return 'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2';
  }
}

/**
 * Generate state-based classes for interactive elements
 */
export function stateClasses(state?: 'default' | 'hover' | 'active' | 'disabled') {
  const classes = [];
  
  switch (state) {
    case 'hover':
      classes.push('hover:opacity-90', 'hover:scale-[1.02]');
      break;
    case 'active':
      classes.push('active:scale-[0.98]');
      break;
    case 'disabled':
      classes.push('disabled:opacity-50', 'disabled:cursor-not-allowed', 'disabled:pointer-events-none');
      break;
  }
  
  return classes.join(' ');
}

/**
 * Generate size-based padding/margin classes
 */
export function sizeClasses(size: 'xs' | 'sm' | 'md' | 'lg' | 'xl', type: 'padding' | 'margin' = 'padding') {
  const prefix = type === 'padding' ? 'p' : 'm';
  
  switch (size) {
    case 'xs':
      return `${prefix}-1`;
    case 'sm':
      return `${prefix}-2`;
    case 'md':
      return `${prefix}-3`;
    case 'lg':
      return `${prefix}-4`;
    case 'xl':
      return `${prefix}-6`;
  }
}

/**
 * Generate color variant classes for components
 */
export function colorVariant(
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'neutral',
  intensity?: 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900
) {
  const intensityValue = intensity || 500;
  return `${color}-${intensityValue}`;
}

/**
 * Generate shadow classes based on elevation
 */
export function elevation(level: 0 | 1 | 2 | 3 | 4) {
  const shadows = {
    0: 'shadow-none',
    1: 'shadow-sm',
    2: 'shadow',
    3: 'shadow-md',
    4: 'shadow-lg'
  };
  
  return shadows[level];
}

/**
 * Generate transition classes
 */
export function transition(
  properties?: string[],
  duration?: 'fast' | 'normal' | 'slow',
  easing?: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out'
) {
  const classes = ['transition'];
  
  if (properties && properties.length > 0) {
    classes.push(`transition-[${properties.join(',')}]`);
  } else {
    classes.push('transition-all');
  }
  
  switch (duration) {
    case 'fast':
      classes.push('duration-150');
      break;
    case 'slow':
      classes.push('duration-500');
      break;
    default:
      classes.push('duration-200');
  }
  
  switch (easing) {
    case 'linear':
      classes.push('ease-linear');
      break;
    case 'ease-in':
      classes.push('ease-in');
      break;
    case 'ease-out':
      classes.push('ease-out');
      break;
    case 'ease-in-out':
      classes.push('ease-in-out');
      break;
    default:
      classes.push('ease-out');
  }
  
  return classes.join(' ');
}

/**
 * Check if user prefers reduced motion
 */
export function respectsReducedMotion() {
  return typeof window !== 'undefined' && 
         window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Apply animation classes with reduced motion support
 */
export function animationWithReducedMotion(animationClass: string) {
  if (respectsReducedMotion()) {
    return 'motion-reduce:animate-none';
  }
  return animationClass;
}