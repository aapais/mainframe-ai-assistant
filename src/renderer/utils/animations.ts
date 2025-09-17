/**
 * Animation utilities for Settings components
 * Provides smooth transitions and micro-interactions
 */

// CSS transition classes for smooth animations
export const transitions = {
  // Base transition for all animations
  base: 'transition-all duration-300 ease-in-out',

  // Fast transitions for micro-interactions
  fast: 'transition-all duration-150 ease-out',

  // Slow transitions for major state changes
  slow: 'transition-all duration-500 ease-in-out',

  // Bounce effect for buttons
  bounce: 'transition-transform duration-200 hover:scale-105 active:scale-95',

  // Fade animations
  fadeIn: 'animate-fadeIn',
  fadeOut: 'animate-fadeOut',

  // Slide animations
  slideDown: 'animate-slideDown',
  slideUp: 'animate-slideUp',
  slideLeft: 'animate-slideLeft',
  slideRight: 'animate-slideRight',

  // Category expand/collapse
  expand: 'transition-[max-height,opacity] duration-300 ease-out',
  collapse: 'transition-[max-height,opacity] duration-300 ease-in',

  // Loading skeleton animation
  skeleton: 'animate-pulse bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200'
};

// Ripple effect for button clicks
export const createRipple = (event: React.MouseEvent<HTMLElement>) => {
  const button = event.currentTarget;
  const ripple = document.createElement('span');
  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = event.clientX - rect.left - size / 2;
  const y = event.clientY - rect.top - size / 2;

  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  ripple.classList.add('ripple');

  button.appendChild(ripple);

  setTimeout(() => {
    ripple.remove();
  }, 600);
};

// Smooth scroll to element
export const smoothScrollTo = (elementId: string, offset = 100) => {
  const element = document.getElementById(elementId);
  if (element) {
    const top = element.offsetTop - offset;
    window.scrollTo({
      top,
      behavior: 'smooth'
    });
  }
};

// Stagger animation for list items
export const staggerChildren = (delay = 50) => {
  return {
    hidden: { opacity: 0 },
    visible: (i: number) => ({
      opacity: 1,
      transition: {
        delay: i * delay / 1000,
        duration: 0.3
      }
    })
  };
};

// Hover effect with scale and shadow
export const hoverEffect = {
  rest: {
    scale: 1,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)'
  },
  hover: {
    scale: 1.02,
    boxShadow: '0 4px 6px rgba(161, 0, 255, 0.1)'
  }
};

// Accessibility: Respect prefers-reduced-motion
export const getPrefersReducedMotion = () => {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// Apply animations conditionally based on user preference
export const getAnimationClass = (animationClass: string) => {
  return getPrefersReducedMotion() ? '' : animationClass;
};

// Spring animations for Framer Motion (if available)
export const springConfig = {
  type: 'spring',
  stiffness: 300,
  damping: 30
};

// Category expand/collapse animation
export const categoryAnimation = {
  collapsed: {
    height: 0,
    opacity: 0,
    overflow: 'hidden',
    transition: {
      duration: 0.3,
      ease: 'easeInOut'
    }
  },
  expanded: {
    height: 'auto',
    opacity: 1,
    overflow: 'visible',
    transition: {
      duration: 0.3,
      ease: 'easeInOut',
      staggerChildren: 0.05
    }
  }
};

// Search modal animation
export const modalAnimation = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: 0.2
    }
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.2,
      ease: 'easeOut'
    }
  }
};

// Quick Access widget animations
export const widgetAnimation = {
  initial: {
    opacity: 0,
    y: -20
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      staggerChildren: 0.1
    }
  }
};

// Success/Error state animations
export const statusAnimation = {
  success: {
    backgroundColor: '#10b981',
    scale: [1, 1.05, 1],
    transition: {
      duration: 0.3
    }
  },
  error: {
    backgroundColor: '#ef4444',
    x: [0, -10, 10, -10, 10, 0],
    transition: {
      duration: 0.5
    }
  },
  warning: {
    backgroundColor: '#f59e0b',
    scale: [1, 1.02, 1],
    transition: {
      duration: 0.4
    }
  }
};