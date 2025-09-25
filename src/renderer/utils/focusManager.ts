/**
 * Focus Management Utilities for Keyboard Navigation
 * Provides comprehensive focus management, trap utilities, and visual indicators
 */

export interface FocusableElement extends HTMLElement {
  focus(): void;
}

export interface FocusManagerConfig {
  trapFocus?: boolean;
  initialFocus?: string | HTMLElement;
  returnFocus?: HTMLElement;
  onEscape?: () => void;
  skipLinks?: boolean;
}

export interface RovingTabindexConfig {
  orientation?: 'horizontal' | 'vertical' | 'both';
  wrap?: boolean;
  activateOnFocus?: boolean;
}

/**
 * Core focus management utilities
 */
export class FocusManager {
  private static instance: FocusManager;
  private focusHistory: HTMLElement[] = [];
  private currentTrap: FocusTrap | null = null;
  private visualFocusEnabled = true;
  private keyboardOnlyMode = false;
  private lastInteractionType: 'mouse' | 'keyboard' | 'touch' = 'keyboard';

  static getInstance(): FocusManager {
    if (!FocusManager.instance) {
      FocusManager.instance = new FocusManager();
    }
    return FocusManager.instance;
  }

  private constructor() {
    this.initializeGlobalListeners();
    this.detectKeyboardOnlyMode();
  }

  /**
   * Initialize global event listeners for focus management
   */
  private initializeGlobalListeners(): void {
    // Track interaction types
    document.addEventListener('mousedown', () => {
      this.lastInteractionType = 'mouse';
      this.keyboardOnlyMode = false;
    });

    document.addEventListener('keydown', () => {
      this.lastInteractionType = 'keyboard';
      this.keyboardOnlyMode = true;
    });

    document.addEventListener('touchstart', () => {
      this.lastInteractionType = 'touch';
      this.keyboardOnlyMode = false;
    });

    // Global keyboard shortcuts
    document.addEventListener('keydown', event => {
      this.handleGlobalKeydown(event);
    });

    // Apply visual focus styles based on interaction type
    document.addEventListener('focusin', event => {
      const target = event.target as HTMLElement;
      if (this.keyboardOnlyMode) {
        target.classList.add('keyboard-focused');
      } else {
        target.classList.remove('keyboard-focused');
      }
    });

    document.addEventListener('focusout', event => {
      const target = event.target as HTMLElement;
      target.classList.remove('keyboard-focused');
    });
  }

  /**
   * Detect if user is navigating primarily with keyboard
   */
  private detectKeyboardOnlyMode(): void {
    let keyboardEvents = 0;
    let mouseEvents = 0;
    let touchEvents = 0;

    const checkMode = () => {
      const total = keyboardEvents + mouseEvents + touchEvents;
      if (total > 10) {
        this.keyboardOnlyMode = keyboardEvents > mouseEvents + touchEvents;
        // Reset counters
        keyboardEvents = mouseEvents = touchEvents = 0;
      }
    };

    document.addEventListener('keydown', () => {
      keyboardEvents++;
      setTimeout(checkMode, 1000);
    });

    document.addEventListener('mousedown', () => {
      mouseEvents++;
      setTimeout(checkMode, 1000);
    });

    document.addEventListener('touchstart', () => {
      touchEvents++;
      setTimeout(checkMode, 1000);
    });
  }

  /**
   * Handle global keyboard shortcuts
   */
  private handleGlobalKeydown(event: KeyboardEvent): void {
    const { key, ctrlKey, altKey, metaKey, shiftKey } = event;
    const modKey = ctrlKey || metaKey;

    // Skip if user is typing in an input
    const target = event.target as HTMLElement;
    const isInput =
      target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

    if (isInput && !modKey) return;

    // Global shortcuts
    switch (key) {
      case 'Escape':
        if (this.currentTrap) {
          this.currentTrap.handleEscape();
          event.preventDefault();
        }
        break;

      case 'F1':
        // Show keyboard help
        window.dispatchEvent(new CustomEvent('keyboard-help-toggle'));
        event.preventDefault();
        break;

      case '/':
        if (!isInput && !modKey) {
          // Quick search
          window.dispatchEvent(new CustomEvent('quick-search-focus'));
          event.preventDefault();
        }
        break;

      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight':
        if (this.currentTrap && this.currentTrap.isActive()) {
          // Let the trap handle arrow keys
          return;
        }
        break;
    }
  }

  /**
   * Get all focusable elements within a container
   */
  getFocusableElements(container: HTMLElement = document.body): FocusableElement[] {
    const focusableSelectors = [
      'button:not([disabled]):not([aria-hidden="true"])',
      'input:not([disabled]):not([type="hidden"]):not([aria-hidden="true"])',
      'select:not([disabled]):not([aria-hidden="true"])',
      'textarea:not([disabled]):not([aria-hidden="true"])',
      'a[href]:not([aria-hidden="true"])',
      '[tabindex]:not([tabindex="-1"]):not([disabled]):not([aria-hidden="true"])',
      'details > summary:not([disabled]):not([aria-hidden="true"])',
      '[contenteditable]:not([contenteditable="false"]):not([aria-hidden="true"])',
    ].join(', ');

    const elements = Array.from(
      container.querySelectorAll(focusableSelectors)
    ) as FocusableElement[];

    return elements.filter(element => {
      // Additional visibility checks
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
      }

      // Check if element is actually focusable
      const tabIndex = element.tabIndex;
      return (
        tabIndex >= 0 ||
        element.matches('input, select, textarea, button, a[href], [contenteditable]')
      );
    });
  }

  /**
   * Create a focus trap for modals and dialogs
   */
  createFocusTrap(container: HTMLElement, config: FocusManagerConfig = {}): FocusTrap {
    if (this.currentTrap) {
      this.currentTrap.destroy();
    }

    this.currentTrap = new FocusTrap(container, config);
    return this.currentTrap;
  }

  /**
   * Destroy the current focus trap
   */
  destroyCurrentTrap(): void {
    if (this.currentTrap) {
      this.currentTrap.destroy();
      this.currentTrap = null;
    }
  }

  /**
   * Save current focus to history
   */
  saveFocus(element: HTMLElement): void {
    this.focusHistory.push(element);
    // Keep only last 10 focused elements
    if (this.focusHistory.length > 10) {
      this.focusHistory.shift();
    }
  }

  /**
   * Restore focus from history
   */
  restoreFocus(): HTMLElement | null {
    const lastElement = this.focusHistory.pop();
    if (lastElement && document.contains(lastElement)) {
      lastElement.focus();
      return lastElement;
    }
    return null;
  }

  /**
   * Focus the first focusable element in a container
   */
  focusFirst(container: HTMLElement = document.body): HTMLElement | null {
    const focusable = this.getFocusableElements(container);
    if (focusable.length > 0) {
      focusable[0].focus();
      return focusable[0];
    }
    return null;
  }

  /**
   * Focus the last focusable element in a container
   */
  focusLast(container: HTMLElement = document.body): HTMLElement | null {
    const focusable = this.getFocusableElements(container);
    if (focusable.length > 0) {
      const last = focusable[focusable.length - 1];
      last.focus();
      return last;
    }
    return null;
  }

  /**
   * Check if keyboard-only mode is active
   */
  isKeyboardOnlyMode(): boolean {
    return this.keyboardOnlyMode;
  }

  /**
   * Get the last interaction type
   */
  getLastInteractionType(): 'mouse' | 'keyboard' | 'touch' {
    return this.lastInteractionType;
  }
}

/**
 * Focus trap implementation for modals and dialogs
 */
export class FocusTrap {
  private container: HTMLElement;
  private config: FocusManagerConfig;
  private previouslyFocusedElement: HTMLElement | null = null;
  private isActive = false;
  private keydownListener: (event: KeyboardEvent) => void;

  constructor(container: HTMLElement, config: FocusManagerConfig = {}) {
    this.container = container;
    this.config = { trapFocus: true, ...config };

    this.keydownListener = this.handleKeydown.bind(this);
    this.activate();
  }

  activate(): void {
    if (this.isActive) return;

    this.isActive = true;
    this.previouslyFocusedElement = document.activeElement as HTMLElement;

    // Add event listener
    document.addEventListener('keydown', this.keydownListener, true);

    // Focus initial element
    this.focusInitialElement();

    // Add visual indicator
    this.container.classList.add('focus-trapped');
  }

  private focusInitialElement(): void {
    const { initialFocus } = this.config;

    if (typeof initialFocus === 'string') {
      const element = this.container.querySelector(initialFocus) as HTMLElement;
      if (element) {
        element.focus();
        return;
      }
    } else if (initialFocus instanceof HTMLElement) {
      initialFocus.focus();
      return;
    }

    // Focus first focusable element
    const focusManager = FocusManager.getInstance();
    focusManager.focusFirst(this.container);
  }

  private handleKeydown(event: KeyboardEvent): void {
    if (!this.config.trapFocus) return;

    const { key, shiftKey } = event;

    if (key === 'Escape') {
      this.handleEscape();
      event.preventDefault();
      return;
    }

    if (key === 'Tab') {
      this.handleTab(event, shiftKey);
    }
  }

  handleEscape(): void {
    if (this.config.onEscape) {
      this.config.onEscape();
    } else {
      this.destroy();
    }
  }

  private handleTab(event: KeyboardEvent, shiftKey: boolean): void {
    const focusManager = FocusManager.getInstance();
    const focusableElements = focusManager.getFocusableElements(this.container);

    if (focusableElements.length === 0) {
      event.preventDefault();
      return;
    }

    const currentIndex = focusableElements.indexOf(document.activeElement as FocusableElement);

    if (shiftKey) {
      // Shift+Tab - move backwards
      if (currentIndex <= 0) {
        focusableElements[focusableElements.length - 1].focus();
        event.preventDefault();
      }
    } else {
      // Tab - move forwards
      if (currentIndex >= focusableElements.length - 1) {
        focusableElements[0].focus();
        event.preventDefault();
      }
    }
  }

  destroy(): void {
    if (!this.isActive) return;

    this.isActive = false;

    // Remove event listener
    document.removeEventListener('keydown', this.keydownListener, true);

    // Remove visual indicator
    this.container.classList.remove('focus-trapped');

    // Restore focus
    const returnFocus = this.config.returnFocus || this.previouslyFocusedElement;
    if (returnFocus && document.contains(returnFocus)) {
      returnFocus.focus();
    }
  }

  isActiveTrap(): boolean {
    return this.isActive;
  }
}

/**
 * Roving tabindex implementation for complex widgets
 */
export class RovingTabindex {
  private container: HTMLElement;
  private config: RovingTabindexConfig;
  private items: HTMLElement[] = [];
  private activeIndex = 0;
  private keydownListener: (event: KeyboardEvent) => void;

  constructor(container: HTMLElement, config: RovingTabindexConfig = {}) {
    this.container = container;
    this.config = {
      orientation: 'horizontal',
      wrap: true,
      activateOnFocus: true,
      ...config,
    };

    this.keydownListener = this.handleKeydown.bind(this);
    this.initialize();
  }

  private initialize(): void {
    this.updateItems();
    this.container.addEventListener('keydown', this.keydownListener);
    this.container.addEventListener('focusin', this.handleFocusIn.bind(this));

    // Set initial tabindex values
    this.updateTabindexes();
  }

  private updateItems(): void {
    const selector =
      '[role="tab"], [role="menuitem"], [role="option"], [role="gridcell"], .roving-item';
    this.items = Array.from(this.container.querySelectorAll(selector));

    if (this.items.length === 0) {
      // Fallback to direct children
      this.items = Array.from(this.container.children).filter(
        child => !child.hasAttribute('aria-hidden') && child.getAttribute('inert') !== ''
      ) as HTMLElement[];
    }
  }

  private updateTabindexes(): void {
    this.items.forEach((item, index) => {
      if (index === this.activeIndex) {
        item.tabIndex = 0;
        item.setAttribute('aria-selected', 'true');
      } else {
        item.tabIndex = -1;
        item.setAttribute('aria-selected', 'false');
      }
    });
  }

  private handleKeydown(event: KeyboardEvent): void {
    const { key } = event;
    let handled = false;

    switch (key) {
      case 'ArrowLeft':
        if (this.config.orientation === 'horizontal' || this.config.orientation === 'both') {
          this.moveToPrevious();
          handled = true;
        }
        break;

      case 'ArrowRight':
        if (this.config.orientation === 'horizontal' || this.config.orientation === 'both') {
          this.moveToNext();
          handled = true;
        }
        break;

      case 'ArrowUp':
        if (this.config.orientation === 'vertical' || this.config.orientation === 'both') {
          this.moveToPrevious();
          handled = true;
        }
        break;

      case 'ArrowDown':
        if (this.config.orientation === 'vertical' || this.config.orientation === 'both') {
          this.moveToNext();
          handled = true;
        }
        break;

      case 'Home':
        this.moveToFirst();
        handled = true;
        break;

      case 'End':
        this.moveToLast();
        handled = true;
        break;

      case 'Enter':
      case ' ':
        if (this.config.activateOnFocus) {
          this.activateCurrent();
          handled = true;
        }
        break;
    }

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  private handleFocusIn(event: FocusEvent): void {
    const target = event.target as HTMLElement;
    const index = this.items.indexOf(target);

    if (index !== -1) {
      this.activeIndex = index;
      this.updateTabindexes();

      if (this.config.activateOnFocus) {
        this.activateCurrent();
      }
    }
  }

  private moveToNext(): void {
    if (this.items.length === 0) return;

    let newIndex = this.activeIndex + 1;
    if (newIndex >= this.items.length) {
      newIndex = this.config.wrap ? 0 : this.items.length - 1;
    }

    this.moveTo(newIndex);
  }

  private moveToPrevious(): void {
    if (this.items.length === 0) return;

    let newIndex = this.activeIndex - 1;
    if (newIndex < 0) {
      newIndex = this.config.wrap ? this.items.length - 1 : 0;
    }

    this.moveTo(newIndex);
  }

  private moveToFirst(): void {
    this.moveTo(0);
  }

  private moveToLast(): void {
    this.moveTo(this.items.length - 1);
  }

  private moveTo(index: number): void {
    if (index < 0 || index >= this.items.length) return;

    this.activeIndex = index;
    this.items[index].focus();
    this.updateTabindexes();
  }

  private activateCurrent(): void {
    const currentItem = this.items[this.activeIndex];
    if (currentItem) {
      currentItem.click();
      currentItem.dispatchEvent(new CustomEvent('activate', { bubbles: true }));
    }
  }

  refresh(): void {
    this.updateItems();
    this.updateTabindexes();
  }

  destroy(): void {
    this.container.removeEventListener('keydown', this.keydownListener);
  }
}

/**
 * Skip links utility for accessibility
 */
export class SkipLinks {
  private static created = false;

  static createSkipLinks(links: Array<{ href: string; text: string }>): void {
    if (SkipLinks.created) return;

    const skipNav = document.createElement('nav');
    skipNav.className = 'skip-links';
    skipNav.setAttribute('aria-label', 'Skip links');

    links.forEach(link => {
      const skipLink = document.createElement('a');
      skipLink.href = link.href;
      skipLink.textContent = link.text;
      skipLink.className = 'skip-link';
      skipNav.appendChild(skipLink);
    });

    document.body.insertBefore(skipNav, document.body.firstChild);
    SkipLinks.created = true;
  }
}

// Export singleton instance
export const focusManager = FocusManager.getInstance();
