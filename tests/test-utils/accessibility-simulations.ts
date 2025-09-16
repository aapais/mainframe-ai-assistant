/**
 * Accessibility Simulation Utilities
 *
 * Provides tools to simulate various disabilities and impairments for testing
 * inclusive design principles.
 */

export type ColorBlindnessType = 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia';

/**
 * Simulates different types of color blindness by applying CSS filters
 */
export function simulateColorBlindness(type: ColorBlindnessType): void {
  const filters = {
    protanopia: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\'><defs><filter id=\'protanopia\'><feColorMatrix type=\'matrix\' values=\'0.567, 0.433, 0,     0, 0 0.558, 0.442, 0,     0, 0 0,     0.242, 0.758, 0, 0 0,     0,     0,     1, 0\'/></filter></defs></svg>#protanopia")',
    deuteranopia: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\'><defs><filter id=\'deuteranopia\'><feColorMatrix type=\'matrix\' values=\'0.625, 0.375, 0,   0, 0 0.7,   0.3,   0,   0, 0 0,     0.3,   0.7, 0, 0 0,     0,     0,   1, 0\'/></filter></defs></svg>#deuteranopia")',
    tritanopia: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\'><defs><filter id=\'tritanopia\'><feColorMatrix type=\'matrix\' values=\'0.95, 0.05,  0,     0, 0 0,    0.433, 0.567, 0, 0 0,    0.475, 0.525, 0, 0 0,    0,     0,     1, 0\'/></filter></defs></svg>#tritanopia")',
    achromatopsia: 'grayscale(100%)'
  };

  document.body.style.filter = filters[type];
  document.body.setAttribute('data-color-blind-sim', type);
}

/**
 * Simulates low vision conditions
 */
export function simulateLowVision(options: {
  blur?: number;
  contrast?: number;
  brightness?: number;
}): void {
  const { blur = 0, contrast = 100, brightness = 100 } = options;

  const filterParts = [];

  if (blur > 0) {
    filterParts.push(`blur(${blur}px)`);
  }

  if (contrast !== 100) {
    filterParts.push(`contrast(${contrast}%)`);
  }

  if (brightness !== 100) {
    filterParts.push(`brightness(${brightness}%)`);
  }

  document.body.style.filter = filterParts.join(' ');
  document.body.setAttribute('data-low-vision-sim', 'true');
}

/**
 * Simulates reduced motion preferences
 */
export function simulateReducedMotion(enabled: boolean): void {
  if (enabled) {
    document.body.setAttribute('data-reduced-motion', 'true');

    // Override matchMedia for prefers-reduced-motion
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    // Apply CSS to disable animations
    const style = document.createElement('style');
    style.textContent = `
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }
    `;
    document.head.appendChild(style);
  } else {
    document.body.removeAttribute('data-reduced-motion');
  }
}

/**
 * Simulates high contrast mode
 */
export function simulateHighContrast(enabled: boolean): void {
  if (enabled) {
    document.body.setAttribute('data-high-contrast', 'true');

    // Override matchMedia for prefers-contrast
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-contrast: high)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  } else {
    document.body.removeAttribute('data-high-contrast');
  }
}

/**
 * Simulates motor impairments by limiting interaction methods
 */
export function simulateMotorImpairment(type: 'limited-fine-motor' | 'one-handed' | 'tremor'): void {
  document.body.setAttribute('data-motor-impairment', type);

  switch (type) {
    case 'limited-fine-motor':
      // Simulate difficulty with precise movements
      document.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        const rect = target.getBoundingClientRect();

        // If target is smaller than minimum touch target, make it harder to hit
        if (rect.width < 44 || rect.height < 44) {
          if (Math.random() > 0.7) { // 30% success rate for small targets
            event.stopPropagation();
            event.preventDefault();
          }
        }
      });
      break;

    case 'tremor':
      // Simulate hand tremor affecting precise interactions
      document.addEventListener('mousemove', (event) => {
        // Add random offset to mouse position (simulated in testing)
        const tremor = Math.random() * 10 - 5;
        event.stopPropagation();
      });
      break;
  }
}

/**
 * Simulates cognitive load limitations
 */
export function simulateCognitiveLimitations(options: {
  memoryIssues?: boolean;
  attentionDeficit?: boolean;
  processingSpeed?: 'slow' | 'normal' | 'fast';
}): void {
  const { memoryIssues = false, attentionDeficit = false, processingSpeed = 'normal' } = options;

  document.body.setAttribute('data-cognitive-sim', 'true');

  if (memoryIssues) {
    // Clear form data more frequently to simulate memory issues
    setInterval(() => {
      const forms = document.querySelectorAll('form');
      forms.forEach(form => {
        const inputs = form.querySelectorAll('input[type="text"], textarea');
        inputs.forEach(input => {
          if (Math.random() > 0.8) { // 20% chance of "forgetting" content
            (input as HTMLInputElement).value = '';
          }
        });
      });
    }, 30000); // Every 30 seconds
  }

  if (attentionDeficit) {
    // Simulate attention issues by occasionally preventing focus
    document.addEventListener('focus', (event) => {
      if (Math.random() > 0.9) { // 10% chance of losing focus
        setTimeout(() => {
          (event.target as HTMLElement).blur();
        }, 1000);
      }
    });
  }

  if (processingSpeed === 'slow') {
    // Add delays to interactions to simulate slow processing
    document.addEventListener('click', (event) => {
      event.stopPropagation();
      event.preventDefault();

      setTimeout(() => {
        const newEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        });
        event.target?.dispatchEvent(newEvent);
      }, 2000); // 2 second delay
    });
  }
}

/**
 * Simulates temporary situational impairments
 */
export function simulateSituationalImpairment(type: 'bright-sunlight' | 'noisy-environment' | 'one-handed-temporary'): void {
  document.body.setAttribute('data-situational-impairment', type);

  switch (type) {
    case 'bright-sunlight':
      document.body.style.filter = 'brightness(2) contrast(0.8)';
      break;

    case 'noisy-environment':
      // Disable any audio features
      if ('AudioContext' in window) {
        Object.defineProperty(window, 'AudioContext', {
          value: undefined
        });
      }
      break;

    case 'one-handed-temporary':
      // Simulate using only one hand (affects two-handed keyboard shortcuts)
      document.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.shiftKey) {
          // Block two-handed shortcuts
          event.preventDefault();
          event.stopPropagation();
        }
      });
      break;
  }
}

/**
 * Reset all simulations
 */
export function resetSimulations(): void {
  document.body.style.filter = '';
  document.body.removeAttribute('data-color-blind-sim');
  document.body.removeAttribute('data-low-vision-sim');
  document.body.removeAttribute('data-reduced-motion');
  document.body.removeAttribute('data-high-contrast');
  document.body.removeAttribute('data-motor-impairment');
  document.body.removeAttribute('data-cognitive-sim');
  document.body.removeAttribute('data-situational-impairment');

  // Remove any added styles
  const simStyles = document.querySelectorAll('style[data-simulation]');
  simStyles.forEach(style => style.remove());

  // Reset event listeners (would need more sophisticated cleanup in real implementation)
}

/**
 * Get current simulation state
 */
export function getSimulationState(): {
  colorBlindness?: ColorBlindnessType;
  lowVision?: boolean;
  reducedMotion?: boolean;
  highContrast?: boolean;
  motorImpairment?: string;
  cognitive?: boolean;
  situational?: string;
} {
  return {
    colorBlindness: document.body.getAttribute('data-color-blind-sim') as ColorBlindnessType,
    lowVision: document.body.hasAttribute('data-low-vision-sim'),
    reducedMotion: document.body.hasAttribute('data-reduced-motion'),
    highContrast: document.body.hasAttribute('data-high-contrast'),
    motorImpairment: document.body.getAttribute('data-motor-impairment') || undefined,
    cognitive: document.body.hasAttribute('data-cognitive-sim'),
    situational: document.body.getAttribute('data-situational-impairment') || undefined
  };
}