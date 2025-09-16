const { test, expect } = require('@playwright/test');

/**
 * Screen Reader Compatibility Testing
 * Comprehensive testing for screen reader accessibility
 */

test.describe('Screen Reader Compatibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Semantic HTML structure for screen readers', async ({ page }) => {
    // Test document structure
    const documentStructure = await page.evaluate(() => {
      const structure = {
        hasTitle: !!document.title && document.title.trim().length > 0,
        hasLang: !!document.documentElement.getAttribute('lang'),
        hasMainElement: !!document.querySelector('main, [role="main"]'),
        hasNavigation: !!document.querySelector('nav, [role="navigation"]'),
        hasHeadings: document.querySelectorAll('h1, h2, h3, h4, h5, h6').length > 0,
        hasLandmarks: document.querySelectorAll('[role="banner"], [role="main"], [role="navigation"], [role="contentinfo"], [role="complementary"]').length > 0
      };
      
      return structure;
    });
    
    expect(documentStructure.hasTitle).toBe(true);
    expect(documentStructure.hasLang).toBe(true);
    expect(documentStructure.hasMainElement).toBe(true);
    expect(documentStructure.hasNavigation).toBe(true);
    expect(documentStructure.hasHeadings).toBe(true);
  });

  test('ARIA labels and descriptions are properly implemented', async ({ page }) => {
    // Test interactive elements have accessible names
    const interactiveElements = await page.evaluate(() => {
      const elements = document.querySelectorAll(
        'button, input, select, textarea, a[href], [role="button"], [role="link"], [role="textbox"]'
      );
      
      return Array.from(elements).map(el => {
        const ariaLabel = el.getAttribute('aria-label');
        const ariaLabelledBy = el.getAttribute('aria-labelledby');
        const ariaDescribedBy = el.getAttribute('aria-describedby');
        const title = el.getAttribute('title');
        const innerText = el.innerText?.trim();
        const placeholder = el.getAttribute('placeholder');
        const altText = el.getAttribute('alt');
        
        // Check if element has an associated label
        let hasLabel = false;
        if (el.id) {
          const associatedLabel = document.querySelector(`label[for="${el.id}"]`);
          hasLabel = !!associatedLabel;
        }
        
        const accessibleName = ariaLabel || ariaLabelledBy || innerText || placeholder || altText || hasLabel;
        
        return {
          tagName: el.tagName,
          type: el.type || null,
          role: el.getAttribute('role'),
          id: el.id || null,
          ariaLabel,
          ariaLabelledBy,
          ariaDescribedBy,
          title,
          innerText,
          placeholder,
          altText,
          hasLabel,
          hasAccessibleName: !!accessibleName,
          boundingBox: el.getBoundingClientRect()
        };
      }).filter(el => el.boundingBox.width > 0 && el.boundingBox.height > 0); // Only visible elements
    });
    
    for (const element of interactiveElements) {
      expect(element.hasAccessibleName).toBe(true);
    }
    
    console.log(`Tested ${interactiveElements.length} interactive elements for accessible names`);
  });

  test('Form elements are properly labeled for screen readers', async ({ page }) => {
    await page.goto('/components/forms');
    
    const formElements = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input, select, textarea');
      
      return Array.from(inputs).map(input => {
        const id = input.id;
        const ariaLabel = input.getAttribute('aria-label');
        const ariaLabelledBy = input.getAttribute('aria-labelledby');
        const placeholder = input.getAttribute('placeholder');
        
        // Find associated label
        let associatedLabel = null;
        if (id) {
          associatedLabel = document.querySelector(`label[for="${id}"]`);
        }
        if (!associatedLabel) {
          associatedLabel = input.closest('label');
        }
        
        // Check for fieldset/legend context
        const fieldset = input.closest('fieldset');
        const legend = fieldset?.querySelector('legend');
        
        return {
          tagName: input.tagName,
          type: input.type,
          id,
          name: input.name,
          required: input.required,
          ariaRequired: input.getAttribute('aria-required'),
          ariaInvalid: input.getAttribute('aria-invalid'),
          ariaLabel,
          ariaLabelledBy,
          placeholder,
          hasAssociatedLabel: !!associatedLabel,
          labelText: associatedLabel?.textContent?.trim(),
          hasFieldsetContext: !!fieldset,
          legendText: legend?.textContent?.trim(),
          ariaDescribedBy: input.getAttribute('aria-describedby')
        };
      });
    });
    
    for (const element of formElements) {
      // Each form element should have an accessible name
      const hasAccessibleName = (
        element.ariaLabel ||
        element.ariaLabelledBy ||
        element.hasAssociatedLabel ||
        element.placeholder ||
        (element.hasFieldsetContext && element.legendText)
      );
      
      expect(hasAccessibleName).toBe(true);
      
      // Required fields should be properly marked
      if (element.required) {
        expect(element.ariaRequired === 'true' || element.labelText?.includes('*')).toBe(true);
      }
    }
  });

  test('Heading hierarchy is logical for screen readers', async ({ page }) => {
    const headingStructure = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
      
      return headings.map(heading => ({
        level: parseInt(heading.tagName.charAt(1)),
        text: heading.textContent?.trim(),
        id: heading.id,
        ariaLevel: heading.getAttribute('aria-level'),
        role: heading.getAttribute('role')
      }));
    });
    
    if (headingStructure.length > 0) {
      // Should start with h1
      expect(headingStructure[0].level).toBe(1);
      
      // Check hierarchy doesn't skip levels
      for (let i = 1; i < headingStructure.length; i++) {
        const currentLevel = headingStructure[i].level;
        const previousLevel = headingStructure[i - 1].level;
        
        // Should not jump more than one level
        expect(currentLevel - previousLevel).toBeLessThanOrEqual(1);
      }
    }
  });

  test('Tables have proper headers and captions for screen readers', async ({ page }) => {
    await page.goto('/components/tables');
    
    const tables = await page.evaluate(() => {
      const tableElements = document.querySelectorAll('table');
      
      return Array.from(tableElements).map(table => {
        const caption = table.querySelector('caption');
        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');
        const headers = table.querySelectorAll('th');
        
        // Check if headers have scope attributes
        const headerInfo = Array.from(headers).map(th => ({
          text: th.textContent?.trim(),
          scope: th.getAttribute('scope'),
          id: th.id,
          abbr: th.getAttribute('abbr')
        }));
        
        // Check for data cells with headers attribute
        const dataCells = table.querySelectorAll('td');
        const dataCellsWithHeaders = Array.from(dataCells).filter(td => td.getAttribute('headers'));
        
        return {
          hasCaption: !!caption,
          captionText: caption?.textContent?.trim(),
          hasThead: !!thead,
          hasTbody: !!tbody,
          headerCount: headers.length,
          headerInfo,
          dataCellsWithHeaders: dataCellsWithHeaders.length,
          totalDataCells: dataCells.length
        };
      });
    });
    
    for (const table of tables) {
      // Tables should have captions for screen readers
      expect(table.hasCaption || table.captionText).toBeTruthy();
      
      // Tables should have proper structure
      expect(table.hasThead || table.headerCount > 0).toBe(true);
      
      // Column headers should have scope="col", row headers scope="row"
      const hasProperScopes = table.headerInfo.every(header => 
        !header.scope || ['col', 'row', 'colgroup', 'rowgroup'].includes(header.scope)
      );
      expect(hasProperScopes).toBe(true);
    }
  });

  test('Images have proper alt text for screen readers', async ({ page }) => {
    const images = await page.evaluate(() => {
      const imageElements = document.querySelectorAll('img, svg, [role="img"]');
      
      return Array.from(imageElements).map(img => {
        const isDecorative = img.getAttribute('role') === 'presentation' || 
                            img.getAttribute('alt') === '' ||
                            img.getAttribute('aria-hidden') === 'true';
        
        return {
          tagName: img.tagName,
          src: img.src || null,
          alt: img.getAttribute('alt'),
          role: img.getAttribute('role'),
          ariaLabel: img.getAttribute('aria-label'),
          ariaLabelledBy: img.getAttribute('aria-labelledby'),
          ariaHidden: img.getAttribute('aria-hidden'),
          title: img.getAttribute('title'),
          isDecorative,
          isVisible: img.offsetWidth > 0 && img.offsetHeight > 0
        };
      }).filter(img => img.isVisible);
    });
    
    for (const image of images) {
      if (!image.isDecorative) {
        // Non-decorative images should have alt text or aria-label
        const hasAccessibleName = (
          image.alt ||
          image.ariaLabel ||
          image.ariaLabelledBy ||
          image.title
        );
        
        expect(hasAccessibleName).toBe(true);
      } else {
        // Decorative images should be hidden from screen readers
        expect(
          image.alt === '' ||
          image.ariaHidden === 'true' ||
          image.role === 'presentation'
        ).toBe(true);
      }
    }
  });

  test('Live regions work correctly for dynamic content', async ({ page }) => {
    await page.goto('/components/live-regions');
    
    // Test aria-live regions
    const liveRegions = await page.evaluate(() => {
      const regions = document.querySelectorAll('[aria-live]');
      
      return Array.from(regions).map(region => ({
        ariaLive: region.getAttribute('aria-live'),
        ariaAtomic: region.getAttribute('aria-atomic'),
        ariaRelevant: region.getAttribute('aria-relevant'),
        role: region.getAttribute('role'),
        id: region.id,
        initialContent: region.textContent?.trim()
      }));
    });
    
    // Verify live regions have proper values
    for (const region of liveRegions) {
      expect(['polite', 'assertive', 'off']).toContain(region.ariaLive);
      
      if (region.ariaAtomic) {
        expect(['true', 'false']).toContain(region.ariaAtomic);
      }
      
      if (region.ariaRelevant) {
        const validValues = ['additions', 'removals', 'text', 'all'];
        const relevantValues = region.ariaRelevant.split(' ');
        expect(relevantValues.every(value => validValues.includes(value))).toBe(true);
      }
    }
    
    // Test status messages
    const statusMessages = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('[role="status"], [role="alert"]')).map(element => ({
        role: element.getAttribute('role'),
        ariaLive: element.getAttribute('aria-live'),
        content: element.textContent?.trim()
      }));
    });
    
    for (const status of statusMessages) {
      // Status should have implicit or explicit live region behavior
      const hasLiveBehavior = (
        status.role === 'status' || // Implicit aria-live="polite"
        status.role === 'alert' ||  // Implicit aria-live="assertive"
        status.ariaLive
      );
      
      expect(hasLiveBehavior).toBe(true);
    }
  });

  test('Navigation landmarks are properly structured', async ({ page }) => {
    const landmarks = await page.evaluate(() => {
      const landmarkElements = document.querySelectorAll(`
        [role="banner"], header,
        [role="navigation"], nav,
        [role="main"], main,
        [role="complementary"], aside,
        [role="contentinfo"], footer,
        [role="search"],
        [role="form"],
        [role="region"]
      `);
      
      return Array.from(landmarkElements).map(element => {
        const computedRole = element.getAttribute('role') || {
          'HEADER': 'banner',
          'NAV': 'navigation',
          'MAIN': 'main',
          'ASIDE': 'complementary',
          'FOOTER': 'contentinfo'
        }[element.tagName] || element.tagName.toLowerCase();
        
        return {
          tagName: element.tagName,
          role: computedRole,
          ariaLabel: element.getAttribute('aria-label'),
          ariaLabelledBy: element.getAttribute('aria-labelledby'),
          id: element.id,
          hasMultipleOfSameType: false // Will be calculated
        };
      });
    });
    
    // Count occurrences of each landmark type
    const landmarkCounts = {};
    landmarks.forEach(landmark => {
      landmarkCounts[landmark.role] = (landmarkCounts[landmark.role] || 0) + 1;
    });
    
    // Update landmarks with multiple occurrence info
    landmarks.forEach(landmark => {
      landmark.hasMultipleOfSameType = landmarkCounts[landmark.role] > 1;
    });
    
    // Verify landmark structure
    for (const landmark of landmarks) {
      // Multiple landmarks of the same type should be distinguishable
      if (landmark.hasMultipleOfSameType) {
        const hasDistinguishingLabel = (
          landmark.ariaLabel ||
          landmark.ariaLabelledBy ||
          landmark.id
        );
        
        expect(hasDistinguishingLabel).toBe(true);
      }
    }
    
    // Should have at least main content landmark
    const hasMainLandmark = landmarks.some(l => l.role === 'main');
    expect(hasMainLandmark).toBe(true);
  });

  test('Custom components have proper ARIA implementation', async ({ page }) => {
    await page.goto('/components/custom-aria');
    
    // Test custom dropdown/combobox
    const dropdowns = await page.evaluate(() => {
      const elements = document.querySelectorAll('[role="combobox"], [role="listbox"], [role="menu"]');
      
      return Array.from(elements).map(element => {
        const role = element.getAttribute('role');
        const expanded = element.getAttribute('aria-expanded');
        const hasPopup = element.getAttribute('aria-haspopup');
        const controls = element.getAttribute('aria-controls');
        const owns = element.getAttribute('aria-owns');
        const activedescendant = element.getAttribute('aria-activedescendant');
        
        return {
          role,
          ariaExpanded: expanded,
          ariaHaspopup: hasPopup,
          ariaControls: controls,
          ariaOwns: owns,
          ariaActivedescendant: activedescendant,
          id: element.id
        };
      });
    });
    
    for (const dropdown of dropdowns) {
      if (dropdown.role === 'combobox') {
        // Combobox should have aria-expanded
        expect(['true', 'false']).toContain(dropdown.ariaExpanded);
        
        // Should control or own another element
        expect(dropdown.ariaControls || dropdown.ariaOwns).toBeTruthy();
      }
      
      if (dropdown.ariaHaspopup) {
        const validPopupTypes = ['true', 'false', 'menu', 'listbox', 'tree', 'grid', 'dialog'];
        expect(validPopupTypes).toContain(dropdown.ariaHaspopup);
      }
    }
    
    // Test custom tabs
    const tabComponents = await page.evaluate(() => {
      const tablists = document.querySelectorAll('[role="tablist"]');
      
      return Array.from(tablists).map(tablist => {
        const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
        const panels = Array.from(document.querySelectorAll('[role="tabpanel"]'));
        
        return {
          tablistId: tablist.id,
          tablistLabel: tablist.getAttribute('aria-label'),
          tabs: tabs.map(tab => ({
            id: tab.id,
            selected: tab.getAttribute('aria-selected'),
            controls: tab.getAttribute('aria-controls'),
            disabled: tab.getAttribute('aria-disabled')
          })),
          panels: panels.map(panel => ({
            id: panel.id,
            labelledby: panel.getAttribute('aria-labelledby'),
            hidden: panel.hasAttribute('hidden')
          }))
        };
      });
    });
    
    for (const tabComponent of tabComponents) {
      // Each tab should control a panel
      for (const tab of tabComponent.tabs) {
        expect(tab.controls).toBeTruthy();
        expect(['true', 'false']).toContain(tab.selected);
        
        // Find corresponding panel
        const correspondingPanel = tabComponent.panels.find(panel => panel.id === tab.controls);
        if (correspondingPanel) {
          expect(correspondingPanel.labelledby).toBe(tab.id);
        }
      }
      
      // Exactly one tab should be selected
      const selectedTabs = tabComponent.tabs.filter(tab => tab.selected === 'true');
      expect(selectedTabs.length).toBe(1);
    }
  });

  test('Error messages and validation are screen reader accessible', async ({ page }) => {
    await page.goto('/components/form-validation');
    
    // Trigger form validation
    const submitButton = page.locator('[type="submit"]').first();
    await submitButton.click();
    
    // Wait for validation messages
    await page.waitForTimeout(500);
    
    const validationMessages = await page.evaluate(() => {
      const errorElements = document.querySelectorAll(
        '[role="alert"], .error-message, [aria-invalid="true"] + *, [aria-describedby]'
      );
      
      return Array.from(errorElements).map(element => {
        const role = element.getAttribute('role');
        const ariaLive = element.getAttribute('aria-live');
        const id = element.id;
        const content = element.textContent?.trim();
        
        // Find associated form field
        let associatedField = null;
        if (id) {
          associatedField = document.querySelector(`[aria-describedby*="${id}"]`);
        }
        
        return {
          role,
          ariaLive,
          id,
          content,
          hasAssociatedField: !!associatedField,
          isVisible: element.offsetWidth > 0 && element.offsetHeight > 0
        };
      }).filter(msg => msg.content && msg.isVisible);
    });
    
    for (const message of validationMessages) {
      // Error messages should be announced to screen readers
      const isAccessibleError = (
        message.role === 'alert' ||
        message.ariaLive === 'assertive' ||
        message.ariaLive === 'polite' ||
        message.hasAssociatedField
      );
      
      expect(isAccessibleError).toBe(true);
      expect(message.content.length).toBeGreaterThan(0);
    }
  });

  test('Screen reader only content is properly implemented', async ({ page }) => {
    const srOnlyContent = await page.evaluate(() => {
      const elements = document.querySelectorAll('.sr-only, .visually-hidden, .screen-reader-only');
      
      return Array.from(elements).map(element => {
        const styles = window.getComputedStyle(element);
        
        return {
          content: element.textContent?.trim(),
          isVisuallyHidden: (
            styles.position === 'absolute' &&
            (styles.left === '-9999px' || styles.left === '-10000px') &&
            styles.width === '1px' &&
            styles.height === '1px'
          ) || (
            styles.clip === 'rect(0px, 0px, 0px, 0px)' ||
            styles.clipPath === 'inset(50%)'
          ),
          isAccessible: styles.visibility !== 'hidden' && styles.display !== 'none',
          tagName: element.tagName
        };
      });
    });
    
    for (const content of srOnlyContent) {
      // Should be visually hidden but accessible to screen readers
      expect(content.isVisuallyHidden).toBe(true);
      expect(content.isAccessible).toBe(true);
      expect(content.content.length).toBeGreaterThan(0);
    }
  });
});
