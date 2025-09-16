/**
 * Comprehensive Screen Reader Utilities
 * Advanced live region management, announcements, and screen reader optimizations
 */

import { LiveRegionManager } from './accessibility';

// Screen Reader Priority Levels
export type ScreenReaderPriority = 'polite' | 'assertive' | 'off';

// Common Screen Reader Messages
export interface ScreenReaderMessages {
  loading: string;
  loaded: string;
  saving: string;
  saved: string;
  error: string;
  success: string;
  searching: string;
  searchComplete: string;
  noResults: string;
  resultsFound: string;
  formInvalid: string;
  formValid: string;
  pageChanged: string;
  selectionChanged: string;
  menuOpened: string;
  menuClosed: string;
  modalOpened: string;
  modalClosed: string;
  tableUpdated: string;
  progressStarted: string;
  progressComplete: string;
}

const defaultMessages: ScreenReaderMessages = {
  loading: 'Loading content, please wait...',
  loaded: 'Content loaded successfully',
  saving: 'Saving changes...',
  saved: 'Changes saved successfully',
  error: 'An error occurred',
  success: 'Operation completed successfully',
  searching: 'Searching knowledge base...',
  searchComplete: 'Search complete',
  noResults: 'No results found',
  resultsFound: 'results found',
  formInvalid: 'Form contains errors. Please review and correct.',
  formValid: 'All form fields are valid',
  pageChanged: 'Page content has changed',
  selectionChanged: 'Selection changed',
  menuOpened: 'Menu opened',
  menuClosed: 'Menu closed',
  modalOpened: 'Dialog opened',
  modalClosed: 'Dialog closed',
  tableUpdated: 'Table data updated',
  progressStarted: 'Operation started',
  progressComplete: 'Operation completed'
};

/**
 * Enhanced Live Region Manager with better announcement control
 */
export class EnhancedLiveRegionManager {
  private static instance: EnhancedLiveRegionManager;
  private regions: Map<string, HTMLElement> = new Map();
  private announcementQueue: Array<{ message: string; priority: ScreenReaderPriority; delay: number }> = [];
  private isProcessingQueue = false;
  private messages: ScreenReaderMessages;

  private constructor(customMessages?: Partial<ScreenReaderMessages>) {
    this.messages = { ...defaultMessages, ...customMessages };
    this.createLiveRegions();
  }

  static getInstance(customMessages?: Partial<ScreenReaderMessages>): EnhancedLiveRegionManager {
    if (!this.instance) {
      this.instance = new EnhancedLiveRegionManager(customMessages);
    }
    return this.instance;
  }

  private createLiveRegions(): void {
    // Create multiple specialized regions
    const regionConfigs = [
      { id: 'sr-status-polite', priority: 'polite', atomic: 'true' },
      { id: 'sr-status-assertive', priority: 'assertive', atomic: 'true' },
      { id: 'sr-progress-polite', priority: 'polite', atomic: 'false' },
      { id: 'sr-navigation-polite', priority: 'polite', atomic: 'true' },
      { id: 'sr-form-errors-assertive', priority: 'assertive', atomic: 'false' }
    ];

    regionConfigs.forEach(config => {
      const region = this.createRegion(config.id, config.priority as ScreenReaderPriority, config.atomic === 'true');
      this.regions.set(config.id, region);
      document.body.appendChild(region);
    });
  }

  private createRegion(id: string, priority: ScreenReaderPriority, atomic: boolean): HTMLElement {
    const region = document.createElement('div');
    region.id = id;
    region.setAttribute('aria-live', priority);
    region.setAttribute('aria-atomic', atomic.toString());
    region.setAttribute('aria-relevant', 'additions text');
    region.className = 'sr-only';

    // Add specific role for certain regions
    if (id.includes('status')) {
      region.setAttribute('role', 'status');
    } else if (id.includes('progress')) {
      region.setAttribute('role', 'progressbar');
    }

    return region;
  }

  /**
   * Announce message with smart timing and deduplication
   */
  public announce(
    message: string,
    priority: ScreenReaderPriority = 'polite',
    options: {
      delay?: number;
      dedupe?: boolean;
      regionId?: string;
      clearPrevious?: boolean;
    } = {}
  ): void {
    const { delay = 100, dedupe = true, regionId, clearPrevious = false } = options;

    // Skip if priority is off
    if (priority === 'off') return;

    // Deduplicate messages
    if (dedupe && this.announcementQueue.some(item => item.message === message)) {
      return;
    }

    // Clear previous announcements if requested
    if (clearPrevious) {
      this.clearAllRegions();
    }

    this.announcementQueue.push({ message, priority, delay });
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.announcementQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.announcementQueue.length > 0) {
      const announcement = this.announcementQueue.shift();
      if (!announcement) continue;

      const regionId = this.selectOptimalRegion(announcement.priority, announcement.message);
      const region = this.regions.get(regionId);

      if (region) {
        await this.makeAnnouncement(region, announcement.message, announcement.delay);
      }
    }

    this.isProcessingQueue = false;
  }

  private selectOptimalRegion(priority: ScreenReaderPriority, message: string): string {
    if (message.includes('error') || message.includes('invalid')) {
      return 'sr-form-errors-assertive';
    }
    if (message.includes('progress') || message.includes('loading') || message.includes('saving')) {
      return 'sr-progress-polite';
    }
    if (message.includes('page') || message.includes('navigation')) {
      return 'sr-navigation-polite';
    }

    return priority === 'assertive' ? 'sr-status-assertive' : 'sr-status-polite';
  }

  private async makeAnnouncement(region: HTMLElement, message: string, delay: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        region.textContent = message;

        // Clear after announcement to prevent repeated reading
        setTimeout(() => {
          region.textContent = '';
          resolve();
        }, Math.max(1000, message.length * 50)); // Adaptive clear time
      }, delay);
    });
  }

  /**
   * Announce predefined messages
   */
  public announceLoading(customMessage?: string): void {
    this.announce(customMessage || this.messages.loading, 'polite', { regionId: 'sr-progress-polite' });
  }

  public announceLoaded(customMessage?: string): void {
    this.announce(customMessage || this.messages.loaded, 'polite', { clearPrevious: true });
  }

  public announceSaving(customMessage?: string): void {
    this.announce(customMessage || this.messages.saving, 'polite', { regionId: 'sr-progress-polite' });
  }

  public announceSaved(customMessage?: string): void {
    this.announce(customMessage || this.messages.saved, 'polite', { clearPrevious: true });
  }

  public announceError(error: string): void {
    this.announce(`${this.messages.error}: ${error}`, 'assertive', { regionId: 'sr-form-errors-assertive' });
  }

  public announceSuccess(customMessage?: string): void {
    this.announce(customMessage || this.messages.success, 'polite');
  }

  public announceSearching(query?: string): void {
    const message = query ? `Searching for "${query}"` : this.messages.searching;
    this.announce(message, 'polite', { regionId: 'sr-progress-polite' });
  }

  public announceSearchResults(count: number, query?: string): void {
    let message: string;
    if (count === 0) {
      message = query ? `No results found for "${query}"` : this.messages.noResults;
    } else {
      message = query
        ? `${count} ${this.messages.resultsFound} for "${query}"`
        : `${count} ${this.messages.resultsFound}`;
    }
    this.announce(message, 'polite', { clearPrevious: true });
  }

  public announceFormValidation(isValid: boolean, errorCount?: number): void {
    const message = isValid
      ? this.messages.formValid
      : errorCount
        ? `Form has ${errorCount} errors. Please review and correct.`
        : this.messages.formInvalid;

    this.announce(message, 'assertive', { regionId: 'sr-form-errors-assertive' });
  }

  public announcePageChange(pageName: string): void {
    this.announce(`Navigated to ${pageName}`, 'polite', { regionId: 'sr-navigation-polite' });
  }

  public announceSelectionChange(selectedItem: string, totalItems?: number): void {
    let message = `Selected: ${selectedItem}`;
    if (totalItems) {
      message += `. ${totalItems} items total`;
    }
    this.announce(message, 'polite');
  }

  public announceModalOpen(modalTitle: string): void {
    this.announce(`${modalTitle} dialog opened`, 'assertive');
  }

  public announceModalClose(modalTitle?: string): void {
    const message = modalTitle ? `${modalTitle} dialog closed` : this.messages.modalClosed;
    this.announce(message, 'polite');
  }

  public announceTableUpdate(rowCount: number, description?: string): void {
    let message = `Table updated with ${rowCount} rows`;
    if (description) {
      message += `. ${description}`;
    }
    this.announce(message, 'polite');
  }

  public announceProgress(current: number, total: number, operation?: string): void {
    const percentage = Math.round((current / total) * 100);
    const message = operation
      ? `${operation}: ${percentage}% complete (${current} of ${total})`
      : `Progress: ${percentage}% complete (${current} of ${total})`;

    this.announce(message, 'polite', {
      regionId: 'sr-progress-polite',
      dedupe: false // Allow progress updates
    });
  }

  public announceProgressComplete(operation?: string): void {
    const message = operation
      ? `${operation} completed successfully`
      : this.messages.progressComplete;

    this.announce(message, 'polite', { clearPrevious: true });
  }

  private clearAllRegions(): void {
    this.regions.forEach(region => {
      region.textContent = '';
    });
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    this.regions.forEach(region => {
      if (region.parentNode) {
        region.parentNode.removeChild(region);
      }
    });
    this.regions.clear();
    this.announcementQueue = [];
    EnhancedLiveRegionManager.instance = null as any;
  }
}

/**
 * Heading Hierarchy Manager
 */
export class HeadingManager {
  private static currentLevel = 1;
  private static headingStack: number[] = [];

  /**
   * Get the appropriate heading level for the current context
   */
  static getNextLevel(): number {
    return Math.min(6, this.currentLevel + 1);
  }

  /**
   * Set the current heading level
   */
  static setLevel(level: number): void {
    this.currentLevel = Math.max(1, Math.min(6, level));
  }

  /**
   * Push current level onto stack and set new level
   */
  static pushLevel(newLevel: number): void {
    this.headingStack.push(this.currentLevel);
    this.setLevel(newLevel);
  }

  /**
   * Pop previous level from stack
   */
  static popLevel(): void {
    const previousLevel = this.headingStack.pop();
    if (previousLevel) {
      this.currentLevel = previousLevel;
    }
  }

  /**
   * Reset to h1 level
   */
  static reset(): void {
    this.currentLevel = 1;
    this.headingStack = [];
  }

  /**
   * Get heading component for current level
   */
  static getHeadingTag(): 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' {
    return `h${this.currentLevel}` as any;
  }
}

/**
 * Screen Reader Text Utilities
 */
export class ScreenReaderTextUtils {
  /**
   * Create descriptive text for loading states
   */
  static createLoadingDescription(context: string, progress?: number): string {
    if (progress !== undefined) {
      return `Loading ${context}, ${Math.round(progress)}% complete`;
    }
    return `Loading ${context}, please wait`;
  }

  /**
   * Create descriptive text for interactive elements
   */
  static createInteractiveDescription(
    element: string,
    action: string,
    state?: string
  ): string {
    let description = `${element}, ${action}`;
    if (state) {
      description += `, ${state}`;
    }
    return description;
  }

  /**
   * Create table cell description
   */
  static createTableCellDescription(
    content: string,
    rowIndex: number,
    colIndex: number,
    rowHeader?: string,
    colHeader?: string
  ): string {
    let description = content;

    if (rowHeader || colHeader) {
      description += ', ';
      if (rowHeader) description += `row: ${rowHeader}`;
      if (rowHeader && colHeader) description += ', ';
      if (colHeader) description += `column: ${colHeader}`;
    } else {
      description += `, row ${rowIndex + 1}, column ${colIndex + 1}`;
    }

    return description;
  }

  /**
   * Create form field error description
   */
  static createErrorDescription(fieldName: string, errors: string[]): string {
    if (errors.length === 0) return '';

    const errorText = errors.length === 1
      ? errors[0]
      : `${errors.length} errors: ${errors.join(', ')}`;

    return `${fieldName} has errors: ${errorText}`;
  }

  /**
   * Create search results description
   */
  static createSearchResultsDescription(
    count: number,
    query: string,
    totalTime?: number
  ): string {
    let description = `Search for "${query}" found ${count} result${count !== 1 ? 's' : ''}`;

    if (totalTime) {
      description += ` in ${totalTime.toFixed(2)} seconds`;
    }

    return description;
  }

  /**
   * Create navigation description
   */
  static createNavigationDescription(
    currentPage: string,
    totalPages?: number,
    currentIndex?: number
  ): string {
    let description = `Current page: ${currentPage}`;

    if (totalPages && currentIndex !== undefined) {
      description += `, page ${currentIndex + 1} of ${totalPages}`;
    }

    return description;
  }

  /**
   * Truncate text for screen readers while preserving meaning
   */
  static truncateForScreenReader(text: string, maxLength: number = 150): string {
    if (text.length <= maxLength) return text;

    // Try to break at sentence boundary
    const sentences = text.split('. ');
    let truncated = '';

    for (const sentence of sentences) {
      if ((truncated + sentence).length <= maxLength - 10) {
        truncated += sentence + '. ';
      } else {
        break;
      }
    }

    if (truncated.length === 0) {
      // If no complete sentences fit, truncate at word boundary
      const words = text.split(' ');
      for (const word of words) {
        if ((truncated + word).length <= maxLength - 10) {
          truncated += word + ' ';
        } else {
          break;
        }
      }
    }

    return truncated.trim() + '...';
  }
}

// Global instance
let globalScreenReaderManager: EnhancedLiveRegionManager | null = null;

/**
 * Get the global screen reader manager instance
 */
export function getScreenReaderManager(customMessages?: Partial<ScreenReaderMessages>): EnhancedLiveRegionManager {
  if (!globalScreenReaderManager) {
    globalScreenReaderManager = EnhancedLiveRegionManager.getInstance(customMessages);
  }
  return globalScreenReaderManager;
}

/**
 * Quick announcement function for simple use cases
 */
export function announceToScreenReader(
  message: string,
  priority: ScreenReaderPriority = 'polite'
): void {
  getScreenReaderManager().announce(message, priority);
}

// Initialize on module load if in browser environment
if (typeof window !== 'undefined') {
  // Delay initialization to ensure DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      getScreenReaderManager();
    });
  } else {
    getScreenReaderManager();
  }
}

export default {
  EnhancedLiveRegionManager,
  HeadingManager,
  ScreenReaderTextUtils,
  getScreenReaderManager,
  announceToScreenReader
};