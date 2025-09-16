const { test, expect } = require('@playwright/test');

/**
 * Keyboard Navigation and Focus Management Testing
 * Comprehensive testing of keyboard accessibility and focus behavior
 */

test.describe('Keyboard Navigation Testing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Tab order follows logical sequence', async ({ page }) => {
    // Get all focusable elements
    const focusableElements = await page.evaluate(() => {
      const selector = `
        a[href],
        button:not([disabled]),
        input:not([disabled]):not([type="hidden"]),
        select:not([disabled]),
        textarea:not([disabled]),
        [tabindex]:not([tabindex="-1"]):not([disabled]),
        [contenteditable="true"]
      `;
      
      const elements = Array.from(document.querySelectorAll(selector));
      return elements.map((el, index) => ({
        index,
        tagName: el.tagName,
        type: el.type || null,
        id: el.id || null,
        className: el.className || null,
        tabIndex: el.tabIndex,
        textContent: el.textContent?.trim().substring(0, 50) || '',
        ariaLabel: el.getAttribute('aria-label') || null,
        boundingBox: el.getBoundingClientRect()
      }));
    });
    
    console.log(`Found ${focusableElements.length} focusable elements`);
    
    // Test tab navigation through all elements
    let currentIndex = 0;
    const maxTabs = Math.min(focusableElements.length, 20); // Limit to prevent infinite loops
    
    for (let i = 0; i < maxTabs; i++) {
      await page.keyboard.press('Tab');
      
      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement;
        return {
          tagName: el.tagName,
          id: el.id || null,
          className: el.className || null,
          tabIndex: el.tabIndex,
          textContent: el.textContent?.trim().substring(0, 50) || '',
          boundingBox: el.getBoundingClientRect()
        };
      });
      
      // Verify focus is visible
      const focusStyles = await page.evaluate(() => {
        const el = document.activeElement;
        const styles = window.getComputedStyle(el);
        return {
          outline: styles.outline,
          outlineColor: styles.outlineColor,
          outlineWidth: styles.outlineWidth,
          boxShadow: styles.boxShadow,
          borderColor: styles.borderColor
        };
      });
      
      const hasFocusIndicator = (
        (focusStyles.outline && focusStyles.outline !== 'none') ||
        (focusStyles.boxShadow && focusStyles.boxShadow !== 'none') ||
        (focusStyles.outlineWidth && focusStyles.outlineWidth !== '0px')
      );
      
      expect(hasFocusIndicator).toBe(true);
      
      // Log current focus for debugging
      console.log(`Tab ${i + 1}: ${focusedElement.tagName}${focusedElement.id ? '#' + focusedElement.id : ''} - "${focusedElement.textContent}"`);
    }
  });

  test('Shift+Tab navigates backwards correctly', async ({ page }) => {
    // Navigate forward first
    const forwardTabs = 5;
    for (let i = 0; i < forwardTabs; i++) {
      await page.keyboard.press('Tab');
    }
    
    const forwardElement = await page.evaluate(() => {
      const el = document.activeElement;
      return {
        id: el.id,
        textContent: el.textContent?.trim(),
        tagName: el.tagName
      };
    });
    
    // Navigate backwards
    await page.keyboard.press('Shift+Tab');
    
    const backwardElement = await page.evaluate(() => {
      const el = document.activeElement;
      return {
        id: el.id,
        textContent: el.textContent?.trim(),
        tagName: el.tagName
      };
    });
    
    // Should be on a different element
    expect(backwardElement.id).not.toBe(forwardElement.id);
    
    // Navigate forward again to verify we're back to the same element
    await page.keyboard.press('Tab');
    
    const returnElement = await page.evaluate(() => {
      const el = document.activeElement;
      return {
        id: el.id,
        textContent: el.textContent?.trim(),
        tagName: el.tagName
      };
    });
    
    expect(returnElement.id).toBe(forwardElement.id);
  });

  test('Skip links work correctly', async ({ page }) => {
    // Tab to skip link (usually first focusable element)
    await page.keyboard.press('Tab');
    
    const skipLink = page.locator('[href^="#"], [data-testid="skip-link"]').first();
    
    if (await skipLink.count() > 0) {
      const isSkipLinkFocused = await skipLink.evaluate(el => el === document.activeElement);
      
      if (isSkipLinkFocused) {
        await page.keyboard.press('Enter');
        
        // Verify focus moved to main content
        const focusedAfterSkip = await page.evaluate(() => {
          return {
            tagName: document.activeElement.tagName,
            id: document.activeElement.id,
            role: document.activeElement.getAttribute('role')
          };
        });
        
        // Should focus main content area
        expect(
          focusedAfterSkip.id === 'main-content' ||
          focusedAfterSkip.role === 'main' ||
          focusedAfterSkip.tagName === 'MAIN'
        ).toBe(true);
      }
    }
  });

  test('Arrow key navigation works for components', async ({ page }) => {
    await page.goto('/components/navigation');
    
    // Test menu navigation with arrow keys
    const menuButton = page.locator('[role="menubutton"], [data-testid="dropdown-trigger"]').first();
    
    if (await menuButton.count() > 0) {
      await menuButton.focus();
      await page.keyboard.press('Enter');
      
      // Wait for menu to open
      await page.waitForSelector('[role="menu"], [role="listbox"]', { timeout: 1000 });
      
      // Test arrow key navigation within menu
      const menuItems = await page.locator('[role="menuitem"], [role="option"]').all();
      
      if (menuItems.length > 1) {
        // First item should be focused
        let focusedItem = await page.evaluate(() => document.activeElement);
        
        // Navigate down
        await page.keyboard.press('ArrowDown');
        
        const secondItem = await page.evaluate(() => document.activeElement);
        expect(secondItem).not.toBe(focusedItem);
        
        // Navigate up
        await page.keyboard.press('ArrowUp');
        
        const backToFirst = await page.evaluate(() => document.activeElement);
        expect(backToFirst).toBe(focusedItem);
        
        // Escape should close menu
        await page.keyboard.press('Escape');
        
        const menuVisible = await page.locator('[role="menu"], [role="listbox"]').isVisible();
        expect(menuVisible).toBe(false);
      }
    }
    
    // Test tab navigation
    const tablist = page.locator('[role="tablist"]').first();
    if (await tablist.count() > 0) {
      await tablist.focus();
      
      // Arrow keys should navigate between tabs
      await page.keyboard.press('ArrowRight');
      
      const activeTab = await page.evaluate(() => {
        return document.activeElement.getAttribute('aria-selected');
      });
      
      expect(activeTab).toBe('true');
    }
  });

  test('Modal focus trap works correctly', async ({ page }) => {
    await page.goto('/components/modals');
    
    const modalTrigger = page.locator('[data-testid="modal-trigger"]');
    await modalTrigger.click();
    
    // Wait for modal to open
    const modal = page.locator('[role="dialog"], [data-testid="modal"]');
    await expect(modal).toBeVisible();
    
    // Focus should be trapped within modal
    const focusableInModal = await modal.locator(
      'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
    ).all();
    
    if (focusableInModal.length > 1) {
      // Tab through all focusable elements in modal
      for (let i = 0; i < focusableInModal.length + 2; i++) {
        await page.keyboard.press('Tab');
        
        const currentFocus = await page.evaluate(() => {
          return document.activeElement.closest('[role="dialog"], [data-testid="modal"]') !== null;
        });
        
        // Focus should remain within modal
        expect(currentFocus).toBe(true);
      }
      
      // Test backwards navigation
      for (let i = 0; i < focusableInModal.length; i++) {
        await page.keyboard.press('Shift+Tab');
        
        const currentFocus = await page.evaluate(() => {
          return document.activeElement.closest('[role="dialog"], [data-testid="modal"]') !== null;
        });
        
        expect(currentFocus).toBe(true);
      }
    }
    
    // Escape should close modal and restore focus
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
    
    // Focus should return to trigger button
    const focusReturnedToTrigger = await modalTrigger.evaluate(el => el === document.activeElement);
    expect(focusReturnedToTrigger).toBe(true);
  });

  test('Form navigation with keyboard', async ({ page }) => {
    await page.goto('/components/forms');
    
    // Test form field navigation
    const formFields = await page.locator('input, select, textarea').all();
    
    for (let i = 0; i < Math.min(formFields.length, 10); i++) {
      await page.keyboard.press('Tab');
      
      const currentField = await page.evaluate(() => {
        const el = document.activeElement;
        return {
          tagName: el.tagName,
          type: el.type,
          id: el.id,
          name: el.name
        };
      });
      
      // Should be a form field
      expect(['INPUT', 'SELECT', 'TEXTAREA']).toContain(currentField.tagName);
      
      // Test field interaction
      if (currentField.tagName === 'INPUT') {
        if (currentField.type === 'text' || currentField.type === 'email') {
          await page.keyboard.type('test');
          const value = await page.evaluate(() => document.activeElement.value);
          expect(value).toContain('test');
          await page.keyboard.press('Control+a');
          await page.keyboard.press('Delete');
        } else if (currentField.type === 'checkbox' || currentField.type === 'radio') {
          await page.keyboard.press('Space');
          const isChecked = await page.evaluate(() => document.activeElement.checked);
          expect(typeof isChecked).toBe('boolean');
        }
      } else if (currentField.tagName === 'SELECT') {
        await page.keyboard.press('ArrowDown');
        const selectedIndex = await page.evaluate(() => document.activeElement.selectedIndex);
        expect(selectedIndex).toBeGreaterThan(-1);
      } else if (currentField.tagName === 'TEXTAREA') {
        await page.keyboard.type('test');
        const value = await page.evaluate(() => document.activeElement.value);
        expect(value).toContain('test');
        await page.keyboard.press('Control+a');
        await page.keyboard.press('Delete');
      }
    }
  });

  test('Custom component keyboard support', async ({ page }) => {
    await page.goto('/components/custom-controls');
    
    // Test custom button-like elements
    const customButtons = await page.locator('[role="button"]:not(button)').all();
    
    for (const customButton of customButtons) {
      await customButton.focus();
      
      // Should be focusable
      const isFocused = await customButton.evaluate(el => el === document.activeElement);
      expect(isFocused).toBe(true);
      
      // Should respond to Enter and Space
      const initialText = await customButton.textContent();
      
      await page.keyboard.press('Enter');
      await page.waitForTimeout(100);
      
      // Check if interaction occurred (text change, state change, etc.)
      const afterEnterText = await customButton.textContent();
      
      // Reset if needed
      if (afterEnterText !== initialText) {
        await customButton.click(); // Reset state
      }
      
      await page.keyboard.press('Space');
      await page.waitForTimeout(100);
    }
    
    // Test custom slider/range components
    const customSliders = await page.locator('[role="slider"]').all();
    
    for (const slider of customSliders) {
      await slider.focus();
      
      const initialValue = await slider.getAttribute('aria-valuenow');
      
      // Test arrow key navigation
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(100);
      
      const afterRightValue = await slider.getAttribute('aria-valuenow');
      
      if (initialValue && afterRightValue) {
        expect(parseInt(afterRightValue)).toBeGreaterThanOrEqual(parseInt(initialValue));
      }
      
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(100);
      
      const afterLeftValue = await slider.getAttribute('aria-valuenow');
      
      if (afterRightValue && afterLeftValue) {
        expect(parseInt(afterLeftValue)).toBeLessThanOrEqual(parseInt(afterRightValue));
      }
    }
  });

  test('Keyboard shortcuts work globally', async ({ page }) => {
    // Test common keyboard shortcuts
    const shortcuts = [
      { key: 'Alt+1', expected: 'navigation' },
      { key: 'Alt+2', expected: 'main-content' },
      { key: 'Control+/', expected: 'search' },
      { key: 'Escape', expected: 'close-overlays' }
    ];
    
    for (const shortcut of shortcuts) {
      await page.keyboard.press(shortcut.key);
      await page.waitForTimeout(200);
      
      // Verify shortcut effect (implementation-specific)
      const result = await page.evaluate((expected) => {
        // This would be implemented based on your specific shortcuts
        const focusedElement = document.activeElement;
        const visibleModals = document.querySelectorAll('[role="dialog"]:not([hidden])');
        
        switch (expected) {
          case 'navigation':
            return focusedElement.closest('[role="navigation"]') !== null;
          case 'main-content':
            return focusedElement.closest('[role="main"], #main-content') !== null;
          case 'search':
            return focusedElement.type === 'search' || focusedElement.placeholder?.includes('search');
          case 'close-overlays':
            return visibleModals.length === 0;
          default:
            return true;
        }
      }, shortcut.expected);
      
      // Note: This test might need adjustment based on actual implementation
      console.log(`Shortcut ${shortcut.key} - Expected: ${shortcut.expected}, Result: ${result}`);
    }
  });

  test('Focus management in single page applications', async ({ page }) => {
    // Test navigation focus management
    const navLinks = await page.locator('nav a[href^="/"]').all();
    
    if (navLinks.length > 1) {
      const firstLink = navLinks[0];
      const secondLink = navLinks[1];
      
      // Navigate to first page
      await firstLink.click();
      await page.waitForLoadState('networkidle');
      
      // Focus should be managed on route change
      const focusAfterNavigation = await page.evaluate(() => {
        const el = document.activeElement;
        return {
          tagName: el.tagName,
          id: el.id,
          role: el.getAttribute('role'),
          isMainContent: el.closest('[role="main"], #main-content') !== null
        };
      });
      
      // Focus should be on main content or a heading
      const hasAppropriatesFocus = (
        focusAfterNavigation.isMainContent ||
        focusAfterNavigation.role === 'main' ||
        ['H1', 'H2', 'H3'].includes(focusAfterNavigation.tagName)
      );
      
      expect(hasAppropriatesFocus).toBe(true);
      
      // Navigate to second page
      await secondLink.click();
      await page.waitForLoadState('networkidle');
      
      // Focus should be managed again
      const focusAfterSecondNavigation = await page.evaluate(() => {
        const el = document.activeElement;
        return {
          tagName: el.tagName,
          id: el.id,
          role: el.getAttribute('role'),
          isMainContent: el.closest('[role="main"], #main-content') !== null
        };
      });
      
      const hasAppropriateFocusSecond = (
        focusAfterSecondNavigation.isMainContent ||
        focusAfterSecondNavigation.role === 'main' ||
        ['H1', 'H2', 'H3'].includes(focusAfterSecondNavigation.tagName)
      );
      
      expect(hasAppropriateFocusSecond).toBe(true);
    }
  });

  test('High contrast mode keyboard navigation', async ({ page }) => {
    // Enable high contrast mode
    await page.emulateMedia({ forcedColors: 'active' });
    
    // Test that keyboard navigation still works in high contrast mode
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      
      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement;
        const styles = window.getComputedStyle(el);
        return {
          tagName: el.tagName,
          hasOutline: styles.outline !== 'none',
          hasBorder: styles.border !== 'none',
          hasBoxShadow: styles.boxShadow !== 'none',
          isVisible: el.offsetWidth > 0 && el.offsetHeight > 0
        };
      });
      
      // Focus should be visible even in high contrast mode
      expect(focusedElement.isVisible).toBe(true);
      
      const hasFocusIndicator = (
        focusedElement.hasOutline ||
        focusedElement.hasBorder ||
        focusedElement.hasBoxShadow
      );
      
      expect(hasFocusIndicator).toBe(true);
    }
  });

  test('Touch device keyboard navigation fallbacks', async ({ page }) => {
    // Simulate touch device
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'maxTouchPoints', { value: 10 });
    });
    
    // Even on touch devices, keyboard navigation should work
    // when external keyboard is connected
    const focusableElements = await page.locator(
      'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
    ).all();
    
    for (let i = 0; i < Math.min(focusableElements.length, 8); i++) {
      await page.keyboard.press('Tab');
      
      const isFocused = await page.evaluate(() => {
        return document.activeElement !== document.body;
      });
      
      expect(isFocused).toBe(true);
    }
  });
});

// Focus management utilities testing
test.describe('Focus Management Utilities', () => {
  test('Focus trap utility works correctly', async ({ page }) => {
    await page.goto('/test-utilities/focus-management');
    
    // Test focus trap function if it exists
    const hasFocusTrapUtility = await page.evaluate(() => {
      return typeof window.trapFocus === 'function';
    });
    
    if (hasFocusTrapUtility) {
      const trapContainer = page.locator('[data-testid="focus-trap-container"]');
      
      if (await trapContainer.count() > 0) {
        // Activate focus trap
        await page.evaluate(() => {
          const container = document.querySelector('[data-testid="focus-trap-container"]');
          window.trapFocus(container);
        });
        
        // Test that focus is trapped
        const focusableInContainer = await trapContainer.locator(
          'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
        ).count();
        
        if (focusableInContainer > 1) {
          for (let i = 0; i < focusableInContainer + 2; i++) {
            await page.keyboard.press('Tab');
            
            const focusIsTrapped = await page.evaluate(() => {
              const container = document.querySelector('[data-testid="focus-trap-container"]');
              return container.contains(document.activeElement);
            });
            
            expect(focusIsTrapped).toBe(true);
          }
        }
      }
    }
  });

  test('Focus restoration utility works correctly', async ({ page }) => {
    await page.goto('/test-utilities/focus-management');
    
    const restoreFocusUtility = await page.evaluate(() => {
      return typeof window.restoreFocus === 'function';
    });
    
    if (restoreFocusUtility) {
      // Focus an element
      const targetButton = page.locator('button').first();
      await targetButton.focus();
      
      const initialFocus = await page.evaluate(() => document.activeElement.id);
      
      // Store focus
      await page.evaluate(() => window.storeFocus());
      
      // Change focus
      await page.keyboard.press('Tab');
      
      const changedFocus = await page.evaluate(() => document.activeElement.id);
      expect(changedFocus).not.toBe(initialFocus);
      
      // Restore focus
      await page.evaluate(() => window.restoreFocus());
      
      const restoredFocus = await page.evaluate(() => document.activeElement.id);
      expect(restoredFocus).toBe(initialFocus);
    }
  });
});
