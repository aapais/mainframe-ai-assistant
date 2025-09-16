/**
 * Screen Reader Compatibility Validator
 * WCAG 2.1 AA Screen Reader Accessibility Testing
 *
 * This validator provides comprehensive screen reader support testing including:
 * - ARIA labels and descriptions validation
 * - Landmark structure testing
 * - Heading hierarchy validation
 * - Live regions testing
 * - Table accessibility
 * - Form labeling validation
 */

import { screen, waitFor } from '@testing-library/react';

export interface ScreenReaderTestResult {
  passed: boolean;
  ariaImplementation: AriaImplementationResult;
  landmarkStructure: LandmarkStructureResult;
  headingHierarchy: HeadingHierarchyResult;
  liveRegions: LiveRegionResult[];
  tableAccessibility: TableAccessibilityResult[];
  formLabeling: FormLabelingResult;
  alternativeText: AlternativeTextResult;
  issues: ScreenReaderIssue[];
}

export interface AriaImplementationResult {
  totalElements: number;
  labeledElements: number;
  missingLabels: string[];
  invalidAriaAttributes: AriaAttributeIssue[];
  roleImplementation: RoleImplementationResult[];
}

export interface AriaAttributeIssue {
  element: string;
  attribute: string;
  value: string;
  issue: string;
  suggestion: string;
}

export interface RoleImplementationResult {
  element: string;
  role: string;
  isValid: boolean;
  requiredAttributes: string[];
  missingAttributes: string[];
  hasRequiredChildren: boolean;
  hasRequiredParent: boolean;
}

export interface LandmarkStructureResult {
  hasMain: boolean;
  hasBanner: boolean;
  hasNavigation: boolean;
  hasContentInfo: boolean;
  landmarks: LandmarkInfo[];
  duplicateLandmarks: string[];
  missingLabels: string[];
}

export interface LandmarkInfo {
  type: string;
  element: HTMLElement;
  label: string | null;
  isTopLevel: boolean;
}

export interface HeadingHierarchyResult {
  hasH1: boolean;
  headings: HeadingInfo[];
  hierarchyIssues: string[];
  missingHeadings: string[];
}

export interface HeadingInfo {
  level: number;
  text: string;
  element: HTMLElement;
  hasContent: boolean;
}

export interface LiveRegionResult {
  element: HTMLElement;
  ariaLive: string;
  isPolite: boolean;
  isAssertive: boolean;
  hasRelevantContent: boolean;
  isAnnounced: boolean;
}

export interface TableAccessibilityResult {
  element: HTMLElement;
  hasCaption: boolean;
  hasHeaders: boolean;
  headersHaveScope: boolean;
  cellsReferenceHeaders: boolean;
  isAccessible: boolean;
  issues: string[];
}

export interface FormLabelingResult {
  totalInputs: number;
  labeledInputs: number;
  missingLabels: string[];
  fieldsets: FieldsetInfo[];
  errorAssociation: ErrorAssociationInfo[];
}

export interface FieldsetInfo {
  element: HTMLElement;
  hasLegend: boolean;
  legendText: string | null;
  groupsRelatedFields: boolean;
}

export interface ErrorAssociationInfo {
  input: string;
  hasErrorMessage: boolean;
  isAssociated: boolean;
  isAnnounced: boolean;
}

export interface AlternativeTextResult {
  images: ImageAccessibilityInfo[];
  decorativeImages: number;
  informativeImages: number;
  missingAlt: string[];
  redundantAlt: string[];
}

export interface ImageAccessibilityInfo {
  element: HTMLElement;
  hasAlt: boolean;
  altText: string | null;
  isDecorative: boolean;
  isInformative: boolean;
  hasCaption: boolean;
}

export interface ScreenReaderIssue {
  severity: 'critical' | 'warning' | 'info';
  type: 'aria' | 'landmark' | 'heading' | 'liveRegion' | 'table' | 'form' | 'image';
  element: string;
  description: string;
  wcagCriterion: string;
  suggestion: string;
}

/**
 * Screen Reader Compatibility Validator Class
 */
export class ScreenReaderValidator {
  private container: HTMLElement;
  private issues: ScreenReaderIssue[] = [];

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * Run comprehensive screen reader compatibility tests
   */
  async validateScreenReaderSupport(): Promise<ScreenReaderTestResult> {
    console.log('📢 Validating screen reader support...');

    const [
      ariaImplementation,
      landmarkStructure,
      headingHierarchy,
      liveRegions,
      tableAccessibility,
      formLabeling,
      alternativeText
    ] = await Promise.all([
      this.validateAriaImplementation(),
      this.validateLandmarkStructure(),
      this.validateHeadingHierarchy(),
      this.validateLiveRegions(),
      this.validateTableAccessibility(),
      this.validateFormLabeling(),
      this.validateAlternativeText()
    ]);

    return {
      passed: this.issues.filter(issue => issue.severity === 'critical').length === 0,
      ariaImplementation,
      landmarkStructure,
      headingHierarchy,
      liveRegions,
      tableAccessibility,
      formLabeling,
      alternativeText,
      issues: this.issues
    };
  }

  /**
   * Validate ARIA implementation
   */
  private async validateAriaImplementation(): Promise<AriaImplementationResult> {
    const interactiveElements = this.container.querySelectorAll(
      'button, input, select, textarea, a, [role="button"], [role="link"], [role="textbox"], [role="combobox"], [role="listbox"], [role="option"], [role="tab"], [role="tabpanel"], [role="menu"], [role="menuitem"]'
    );

    const missingLabels: string[] = [];
    const invalidAriaAttributes: AriaAttributeIssue[] = [];
    const roleImplementation: RoleImplementationResult[] = [];
    let labeledElements = 0;

    // Validate each interactive element
    interactiveElements.forEach(element => {
      const htmlElement = element as HTMLElement;
      const accessibleName = this.getAccessibleName(htmlElement);
      const description = this.getElementDescription(htmlElement);

      // Check for accessible name
      if (!accessibleName) {
        missingLabels.push(description);
        this.addIssue({
          severity: 'critical',
          type: 'aria',
          element: description,
          description: 'Interactive element lacks accessible name',
          wcagCriterion: '4.1.2 Name, Role, Value',
          suggestion: 'Add aria-label, aria-labelledby, or visible text content'
        });
      } else {
        labeledElements++;
      }

      // Validate ARIA attributes
      this.validateAriaAttributes(htmlElement, invalidAriaAttributes);

      // Validate role implementation
      const role = htmlElement.getAttribute('role');
      if (role) {
        const roleResult = this.validateRoleImplementation(htmlElement, role);
        roleImplementation.push(roleResult);
      }
    });

    return {
      totalElements: interactiveElements.length,
      labeledElements,
      missingLabels,
      invalidAriaAttributes,
      roleImplementation
    };
  }

  /**
   * Validate landmark structure
   */
  private async validateLandmarkStructure(): Promise<LandmarkStructureResult> {
    const landmarks: LandmarkInfo[] = [];
    const duplicateLandmarks: string[] = [];
    const missingLabels: string[] = [];

    // Find all landmarks
    const landmarkSelectors = [
      { selector: 'main, [role="main"]', type: 'main' },
      { selector: 'header, [role="banner"]', type: 'banner' },
      { selector: 'nav, [role="navigation"]', type: 'navigation' },
      { selector: 'footer, [role="contentinfo"]', type: 'contentinfo' },
      { selector: 'aside, [role="complementary"]', type: 'complementary' },
      { selector: '[role="search"]', type: 'search' },
      { selector: 'form, [role="form"]', type: 'form' },
      { selector: 'section, [role="region"]', type: 'region' }
    ];

    const landmarkCounts: { [key: string]: number } = {};

    landmarkSelectors.forEach(({ selector, type }) => {
      const elements = this.container.querySelectorAll(selector);
      landmarkCounts[type] = elements.length;

      elements.forEach(element => {
        const htmlElement = element as HTMLElement;
        const label = this.getLandmarkLabel(htmlElement);
        const isTopLevel = this.isTopLevelLandmark(htmlElement);

        landmarks.push({
          type,
          element: htmlElement,
          label,
          isTopLevel
        });

        // Check for missing labels on multiple landmarks of same type
        if (elements.length > 1 && !label) {
          missingLabels.push(`${type} landmark: ${this.getElementDescription(htmlElement)}`);
          this.addIssue({
            severity: 'warning',
            type: 'landmark',
            element: this.getElementDescription(htmlElement),
            description: `Multiple ${type} landmarks should have distinguishing labels`,
            wcagCriterion: '1.3.6 Identify Purpose',
            suggestion: 'Add aria-label or aria-labelledby to distinguish landmarks'
          });
        }

        // Check for non-top-level landmarks
        if (['banner', 'main', 'contentinfo'].includes(type) && !isTopLevel) {
          this.addIssue({
            severity: 'warning',
            type: 'landmark',
            element: this.getElementDescription(htmlElement),
            description: `${type} landmark should be at top level`,
            wcagCriterion: '1.3.1 Info and Relationships',
            suggestion: `Move ${type} landmark outside of other landmarks`
          });
        }
      });

      // Check for duplicate landmarks
      if (type === 'main' && landmarkCounts[type] > 1) {
        duplicateLandmarks.push('main');
        this.addIssue({
          severity: 'critical',
          type: 'landmark',
          element: 'page',
          description: 'Page has multiple main landmarks',
          wcagCriterion: '1.3.1 Info and Relationships',
          suggestion: 'Use only one main landmark per page'
        });
      }

      if (['banner', 'contentinfo'].includes(type) && landmarkCounts[type] > 1) {
        duplicateLandmarks.push(type);
        this.addIssue({
          severity: 'warning',
          type: 'landmark',
          element: 'page',
          description: `Page has multiple ${type} landmarks`,
          wcagCriterion: '1.3.1 Info and Relationships',
          suggestion: `Consider using only one ${type} landmark or provide distinguishing labels`
        });
      }
    });

    // Check for missing main landmark
    if (!landmarkCounts.main) {
      this.addIssue({
        severity: 'warning',
        type: 'landmark',
        element: 'page',
        description: 'Page lacks main landmark',
        wcagCriterion: '1.3.1 Info and Relationships',
        suggestion: 'Add main element or role="main" to identify main content'
      });
    }

    return {
      hasMain: landmarkCounts.main > 0,
      hasBanner: landmarkCounts.banner > 0,
      hasNavigation: landmarkCounts.navigation > 0,
      hasContentInfo: landmarkCounts.contentinfo > 0,
      landmarks,
      duplicateLandmarks,
      missingLabels
    };
  }

  /**
   * Validate heading hierarchy
   */
  private async validateHeadingHierarchy(): Promise<HeadingHierarchyResult> {
    const headingElements = this.container.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]');
    const headings: HeadingInfo[] = [];
    const hierarchyIssues: string[] = [];
    const missingHeadings: string[] = [];

    let previousLevel = 0;
    let hasH1 = false;

    headingElements.forEach((element, index) => {
      const htmlElement = element as HTMLElement;
      const level = this.getHeadingLevel(htmlElement);
      const text = htmlElement.textContent?.trim() || '';
      const hasContent = text.length > 0;

      if (level === 1) hasH1 = true;

      headings.push({
        level,
        text,
        element: htmlElement,
        hasContent
      });

      // Check for empty headings
      if (!hasContent) {
        this.addIssue({
          severity: 'critical',
          type: 'heading',
          element: this.getElementDescription(htmlElement),
          description: 'Heading has no content',
          wcagCriterion: '1.3.1 Info and Relationships',
          suggestion: 'Provide meaningful heading text'
        });
      }

      // Check heading hierarchy
      if (level > previousLevel + 1) {
        const issue = `Heading level jumps from h${previousLevel} to h${level}`;
        hierarchyIssues.push(issue);
        this.addIssue({
          severity: 'warning',
          type: 'heading',
          element: this.getElementDescription(htmlElement),
          description: issue,
          wcagCriterion: '1.3.1 Info and Relationships',
          suggestion: 'Use sequential heading levels (h1, h2, h3, etc.)'
        });
      }

      previousLevel = level;
    });

    // Check for missing h1
    if (headingElements.length > 0 && !hasH1) {
      missingHeadings.push('h1');
      this.addIssue({
        severity: 'warning',
        type: 'heading',
        element: 'page',
        description: 'Page lacks h1 heading',
        wcagCriterion: '1.3.1 Info and Relationships',
        suggestion: 'Add h1 heading to identify main topic of page'
      });
    }

    return {
      hasH1,
      headings,
      hierarchyIssues,
      missingHeadings
    };
  }

  /**
   * Validate live regions
   */
  private async validateLiveRegions(): Promise<LiveRegionResult[]> {
    const liveRegionElements = this.container.querySelectorAll(
      '[aria-live], [role="status"], [role="alert"], [role="log"], [role="marquee"], [role="timer"]'
    );

    const results: LiveRegionResult[] = [];

    liveRegionElements.forEach(element => {
      const htmlElement = element as HTMLElement;
      const ariaLive = htmlElement.getAttribute('aria-live') ||
                     this.getImplicitAriaLive(htmlElement);
      const isPolite = ariaLive === 'polite';
      const isAssertive = ariaLive === 'assertive';
      const hasRelevantContent = this.hasRelevantContent(htmlElement);
      const isAnnounced = this.isContentAnnounced(htmlElement);

      // Validate live region implementation
      if (!ariaLive) {
        this.addIssue({
          severity: 'warning',
          type: 'liveRegion',
          element: this.getElementDescription(htmlElement),
          description: 'Element may need aria-live attribute',
          wcagCriterion: '4.1.3 Status Messages',
          suggestion: 'Add aria-live="polite" or aria-live="assertive" as appropriate'
        });
      }

      if (hasRelevantContent && !isAnnounced) {
        this.addIssue({
          severity: 'warning',
          type: 'liveRegion',
          element: this.getElementDescription(htmlElement),
          description: 'Live region content may not be announced',
          wcagCriterion: '4.1.3 Status Messages',
          suggestion: 'Ensure content changes are announced to screen readers'
        });
      }

      results.push({
        element: htmlElement,
        ariaLive,
        isPolite,
        isAssertive,
        hasRelevantContent,
        isAnnounced
      });
    });

    return results;
  }

  /**
   * Validate table accessibility
   */
  private async validateTableAccessibility(): Promise<TableAccessibilityResult[]> {
    const tables = this.container.querySelectorAll('table, [role="table"]');
    const results: TableAccessibilityResult[] = [];

    tables.forEach(table => {
      const htmlTable = table as HTMLElement;
      const issues: string[] = [];

      const hasCaption = this.tableHasCaption(htmlTable);
      const hasHeaders = this.tableHasHeaders(htmlTable);
      const headersHaveScope = this.tableHeadersHaveScope(htmlTable);
      const cellsReferenceHeaders = this.tableCellsReferenceHeaders(htmlTable);

      // Check for caption
      if (!hasCaption) {
        issues.push('Table lacks caption or accessible description');
        this.addIssue({
          severity: 'warning',
          type: 'table',
          element: this.getElementDescription(htmlTable),
          description: 'Table lacks caption or accessible description',
          wcagCriterion: '1.3.1 Info and Relationships',
          suggestion: 'Add caption element or aria-label to describe table purpose'
        });
      }

      // Check for headers
      if (!hasHeaders) {
        issues.push('Table lacks proper headers');
        this.addIssue({
          severity: 'critical',
          type: 'table',
          element: this.getElementDescription(htmlTable),
          description: 'Table lacks proper headers',
          wcagCriterion: '1.3.1 Info and Relationships',
          suggestion: 'Add th elements or role="columnheader"/"rowheader" to identify headers'
        });
      }

      // Check header scope
      if (hasHeaders && !headersHaveScope) {
        issues.push('Table headers lack scope attributes');
        this.addIssue({
          severity: 'warning',
          type: 'table',
          element: this.getElementDescription(htmlTable),
          description: 'Table headers lack scope attributes',
          wcagCriterion: '1.3.1 Info and Relationships',
          suggestion: 'Add scope="col" or scope="row" to header cells'
        });
      }

      // Check cell-header association
      if (hasHeaders && !cellsReferenceHeaders) {
        issues.push('Table cells do not reference headers');
        this.addIssue({
          severity: 'warning',
          type: 'table',
          element: this.getElementDescription(htmlTable),
          description: 'Complex table cells should reference headers',
          wcagCriterion: '1.3.1 Info and Relationships',
          suggestion: 'Use headers attribute on td elements for complex tables'
        });
      }

      results.push({
        element: htmlTable,
        hasCaption,
        hasHeaders,
        headersHaveScope,
        cellsReferenceHeaders,
        isAccessible: issues.length === 0,
        issues
      });
    });

    return results;
  }

  /**
   * Validate form labeling
   */
  private async validateFormLabeling(): Promise<FormLabelingResult> {
    const inputs = this.container.querySelectorAll(
      'input:not([type="hidden"]), textarea, select, [role="textbox"], [role="combobox"], [role="listbox"]'
    );

    const fieldsets = this.container.querySelectorAll('fieldset');
    const missingLabels: string[] = [];
    const fieldsetInfo: FieldsetInfo[] = [];
    const errorAssociation: ErrorAssociationInfo[] = [];
    let labeledInputs = 0;

    // Validate input labeling
    inputs.forEach(input => {
      const htmlInput = input as HTMLElement;
      const hasLabel = this.inputHasLabel(htmlInput);
      const description = this.getElementDescription(htmlInput);

      if (hasLabel) {
        labeledInputs++;
      } else {
        missingLabels.push(description);
        this.addIssue({
          severity: 'critical',
          type: 'form',
          element: description,
          description: 'Form control lacks accessible label',
          wcagCriterion: '3.3.2 Labels or Instructions',
          suggestion: 'Add label element, aria-label, or aria-labelledby'
        });
      }

      // Check error message association
      const hasErrorMessage = this.inputHasErrorMessage(htmlInput);
      const isAssociated = this.errorMessageIsAssociated(htmlInput);
      const isAnnounced = this.errorMessageIsAnnounced(htmlInput);

      errorAssociation.push({
        input: description,
        hasErrorMessage,
        isAssociated,
        isAnnounced
      });

      if (hasErrorMessage && !isAssociated) {
        this.addIssue({
          severity: 'critical',
          type: 'form',
          element: description,
          description: 'Error message is not associated with form control',
          wcagCriterion: '3.3.1 Error Identification',
          suggestion: 'Use aria-describedby to associate error message with input'
        });
      }
    });

    // Validate fieldsets
    fieldsets.forEach(fieldset => {
      const htmlFieldset = fieldset as HTMLElement;
      const legend = fieldset.querySelector('legend');
      const hasLegend = legend !== null;
      const legendText = legend?.textContent?.trim() || null;
      const groupsRelatedFields = this.fieldsetGroupsRelatedFields(htmlFieldset);

      fieldsetInfo.push({
        element: htmlFieldset,
        hasLegend,
        legendText,
        groupsRelatedFields
      });

      if (!hasLegend) {
        this.addIssue({
          severity: 'warning',
          type: 'form',
          element: this.getElementDescription(htmlFieldset),
          description: 'Fieldset lacks legend',
          wcagCriterion: '1.3.1 Info and Relationships',
          suggestion: 'Add legend element to describe grouped fields'
        });
      }
    });

    return {
      totalInputs: inputs.length,
      labeledInputs,
      missingLabels,
      fieldsets: fieldsetInfo,
      errorAssociation
    };
  }

  /**
   * Validate alternative text
   */
  private async validateAlternativeText(): Promise<AlternativeTextResult> {
    const images = this.container.querySelectorAll('img, [role="img"], svg');
    const imageInfo: ImageAccessibilityInfo[] = [];
    const missingAlt: string[] = [];
    const redundantAlt: string[] = [];
    let decorativeImages = 0;
    let informativeImages = 0;

    images.forEach(image => {
      const htmlImage = image as HTMLElement;
      const hasAlt = this.imageHasAlt(htmlImage);
      const altText = this.getImageAltText(htmlImage);
      const isDecorative = this.imageIsDecorative(htmlImage);
      const isInformative = this.imageIsInformative(htmlImage);
      const hasCaption = this.imageHasCaption(htmlImage);
      const description = this.getElementDescription(htmlImage);

      if (isDecorative) {
        decorativeImages++;
        if (altText && altText.trim() !== '') {
          this.addIssue({
            severity: 'warning',
            type: 'image',
            element: description,
            description: 'Decorative image has unnecessary alt text',
            wcagCriterion: '1.1.1 Non-text Content',
            suggestion: 'Use alt="" for decorative images'
          });
        }
      } else {
        informativeImages++;
        if (!hasAlt || !altText) {
          missingAlt.push(description);
          this.addIssue({
            severity: 'critical',
            type: 'image',
            element: description,
            description: 'Informative image lacks alt text',
            wcagCriterion: '1.1.1 Non-text Content',
            suggestion: 'Provide descriptive alt text for informative images'
          });
        } else if (this.isRedundantAltText(htmlImage, altText)) {
          redundantAlt.push(description);
          this.addIssue({
            severity: 'warning',
            type: 'image',
            element: description,
            description: 'Image alt text is redundant with surrounding text',
            wcagCriterion: '1.1.1 Non-text Content',
            suggestion: 'Avoid redundant alt text or use alt="" if context is clear'
          });
        }
      }

      imageInfo.push({
        element: htmlImage,
        hasAlt,
        altText,
        isDecorative,
        isInformative,
        hasCaption
      });
    });

    return {
      images: imageInfo,
      decorativeImages,
      informativeImages,
      missingAlt,
      redundantAlt
    };
  }

  /**
   * Helper methods
   */
  private getElementDescription(element: HTMLElement): string {
    const tagName = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : '';
    const className = element.className ? `.${element.className.split(' ')[0]}` : '';
    const role = element.getAttribute('role') ? `[role="${element.getAttribute('role')}"]` : '';
    const text = element.textContent?.slice(0, 30) || '';

    return `${tagName}${id}${className}${role} "${text}"`.trim();
  }

  private getAccessibleName(element: HTMLElement): string | null {
    // Check aria-labelledby first
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelElements = labelledBy.split(' ')
        .map(id => document.getElementById(id))
        .filter(Boolean);
      if (labelElements.length > 0) {
        return labelElements.map(el => el!.textContent?.trim()).join(' ') || null;
      }
    }

    // Check aria-label
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel.trim();

    // Check associated label
    const id = element.id;
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) return label.textContent?.trim() || null;
    }

    // Check parent label
    const parentLabel = element.closest('label');
    if (parentLabel) return parentLabel.textContent?.trim() || null;

    // Check text content for certain elements
    if (['button', 'a'].includes(element.tagName.toLowerCase())) {
      return element.textContent?.trim() || null;
    }

    // Check title as last resort
    const title = element.getAttribute('title');
    if (title) return title.trim();

    // Check alt for images
    const alt = element.getAttribute('alt');
    if (alt !== null) return alt.trim();

    return null;
  }

  private validateAriaAttributes(element: HTMLElement, issues: AriaAttributeIssue[]): void {
    const attributes = element.attributes;

    for (let i = 0; i < attributes.length; i++) {
      const attr = attributes[i];

      if (attr.name.startsWith('aria-')) {
        const validation = this.validateAriaAttribute(attr.name, attr.value, element);
        if (!validation.isValid) {
          issues.push({
            element: this.getElementDescription(element),
            attribute: attr.name,
            value: attr.value,
            issue: validation.issue,
            suggestion: validation.suggestion
          });
        }
      }
    }
  }

  private validateAriaAttribute(attrName: string, attrValue: string, element: HTMLElement): { isValid: boolean; issue: string; suggestion: string } {
    // Validate common ARIA attributes
    switch (attrName) {
      case 'aria-expanded':
        if (!['true', 'false'].includes(attrValue)) {
          return {
            isValid: false,
            issue: 'aria-expanded must be "true" or "false"',
            suggestion: 'Use aria-expanded="true" or aria-expanded="false"'
          };
        }
        break;

      case 'aria-hidden':
        if (!['true', 'false'].includes(attrValue)) {
          return {
            isValid: false,
            issue: 'aria-hidden must be "true" or "false"',
            suggestion: 'Use aria-hidden="true" or aria-hidden="false"'
          };
        }
        if (attrValue === 'true' && this.isFocusable(element)) {
          return {
            isValid: false,
            issue: 'Focusable element should not be aria-hidden="true"',
            suggestion: 'Remove aria-hidden or make element non-focusable'
          };
        }
        break;

      case 'aria-labelledby':
        const ids = attrValue.split(/\s+/);
        const missingIds = ids.filter(id => !document.getElementById(id));
        if (missingIds.length > 0) {
          return {
            isValid: false,
            issue: `Referenced IDs not found: ${missingIds.join(', ')}`,
            suggestion: 'Ensure all referenced IDs exist in the document'
          };
        }
        break;

      case 'aria-describedby':
        const descIds = attrValue.split(/\s+/);
        const missingDescIds = descIds.filter(id => !document.getElementById(id));
        if (missingDescIds.length > 0) {
          return {
            isValid: false,
            issue: `Referenced IDs not found: ${missingDescIds.join(', ')}`,
            suggestion: 'Ensure all referenced IDs exist in the document'
          };
        }
        break;

      case 'aria-live':
        if (!['off', 'polite', 'assertive'].includes(attrValue)) {
          return {
            isValid: false,
            issue: 'aria-live must be "off", "polite", or "assertive"',
            suggestion: 'Use valid aria-live values'
          };
        }
        break;
    }

    return { isValid: true, issue: '', suggestion: '' };
  }

  private validateRoleImplementation(element: HTMLElement, role: string): RoleImplementationResult {
    const requiredAttributes = this.getRequiredAttributesForRole(role);
    const missingAttributes = requiredAttributes.filter(attr => !element.hasAttribute(attr));
    const hasRequiredChildren = this.hasRequiredChildren(element, role);
    const hasRequiredParent = this.hasRequiredParent(element, role);

    return {
      element: this.getElementDescription(element),
      role,
      isValid: missingAttributes.length === 0 && hasRequiredChildren && hasRequiredParent,
      requiredAttributes,
      missingAttributes,
      hasRequiredChildren,
      hasRequiredParent
    };
  }

  private getRequiredAttributesForRole(role: string): string[] {
    const roleRequirements: { [key: string]: string[] } = {
      'button': [],
      'link': [],
      'textbox': ['aria-label'],
      'combobox': ['aria-expanded'],
      'listbox': [],
      'option': ['aria-selected'],
      'tab': ['aria-selected'],
      'tabpanel': ['aria-labelledby'],
      'menu': [],
      'menuitem': [],
      'dialog': ['aria-labelledby'],
      'alertdialog': ['aria-labelledby'],
      'progressbar': ['aria-valuenow'],
      'slider': ['aria-valuenow', 'aria-valuemin', 'aria-valuemax']
    };

    return roleRequirements[role] || [];
  }

  private hasRequiredChildren(element: HTMLElement, role: string): boolean {
    const childRequirements: { [key: string]: string[] } = {
      'listbox': ['option'],
      'menu': ['menuitem'],
      'tablist': ['tab'],
      'radiogroup': ['radio']
    };

    const requiredChildren = childRequirements[role];
    if (!requiredChildren) return true;

    return requiredChildren.some(childRole =>
      element.querySelector(`[role="${childRole}"]`) !== null
    );
  }

  private hasRequiredParent(element: HTMLElement, role: string): boolean {
    const parentRequirements: { [key: string]: string[] } = {
      'option': ['listbox', 'combobox'],
      'menuitem': ['menu'],
      'tab': ['tablist'],
      'tabpanel': ['tablist']
    };

    const requiredParents = parentRequirements[role];
    if (!requiredParents) return true;

    return requiredParents.some(parentRole =>
      element.closest(`[role="${parentRole}"]`) !== null
    );
  }

  private getLandmarkLabel(element: HTMLElement): string | null {
    return element.getAttribute('aria-label') ||
           element.getAttribute('aria-labelledby') ||
           element.querySelector('h1, h2, h3, h4, h5, h6')?.textContent?.trim() ||
           null;
  }

  private isTopLevelLandmark(element: HTMLElement): boolean {
    const landmarkRoles = ['banner', 'main', 'navigation', 'contentinfo', 'complementary', 'search', 'form', 'region'];
    const parent = element.parentElement;

    while (parent && parent !== document.body) {
      const parentRole = parent.getAttribute('role');
      const parentTagName = parent.tagName.toLowerCase();

      if (landmarkRoles.includes(parentRole || '') ||
          ['main', 'nav', 'header', 'footer', 'aside', 'section'].includes(parentTagName)) {
        return false;
      }

      parent.parentElement;
    }

    return true;
  }

  private getHeadingLevel(element: HTMLElement): number {
    const ariaLevel = element.getAttribute('aria-level');
    if (ariaLevel) return parseInt(ariaLevel, 10);

    const tagName = element.tagName.toLowerCase();
    if (tagName.startsWith('h') && tagName.length === 2) {
      return parseInt(tagName.charAt(1), 10);
    }

    return 1; // Default to h1 if role="heading" without aria-level
  }

  private getImplicitAriaLive(element: HTMLElement): string {
    const role = element.getAttribute('role');

    switch (role) {
      case 'alert':
        return 'assertive';
      case 'status':
      case 'log':
        return 'polite';
      default:
        return '';
    }
  }

  private hasRelevantContent(element: HTMLElement): boolean {
    const text = element.textContent?.trim();
    return Boolean(text && text.length > 0);
  }

  private isContentAnnounced(element: HTMLElement): boolean {
    // This would require actual screen reader testing
    // For now, check if element has proper live region setup
    const ariaLive = element.getAttribute('aria-live');
    const role = element.getAttribute('role');

    return Boolean(ariaLive || ['alert', 'status', 'log'].includes(role || ''));
  }

  private tableHasCaption(table: HTMLElement): boolean {
    return Boolean(
      table.querySelector('caption') ||
      table.getAttribute('aria-label') ||
      table.getAttribute('aria-labelledby')
    );
  }

  private tableHasHeaders(table: HTMLElement): boolean {
    return Boolean(
      table.querySelector('th') ||
      table.querySelector('[role="columnheader"]') ||
      table.querySelector('[role="rowheader"]')
    );
  }

  private tableHeadersHaveScope(table: HTMLElement): boolean {
    const headers = table.querySelectorAll('th');
    if (headers.length === 0) return false;

    return Array.from(headers).every(header =>
      header.hasAttribute('scope') ||
      header.hasAttribute('id')
    );
  }

  private tableCellsReferenceHeaders(table: HTMLElement): boolean {
    const cells = table.querySelectorAll('td');
    const complexTable = table.querySelectorAll('th').length > 3; // Heuristic for complex table

    if (!complexTable) return true;

    return Array.from(cells).some(cell =>
      cell.hasAttribute('headers')
    );
  }

  private inputHasLabel(input: HTMLElement): boolean {
    return Boolean(this.getAccessibleName(input));
  }

  private inputHasErrorMessage(input: HTMLElement): boolean {
    const ariaInvalid = input.getAttribute('aria-invalid');
    const describedBy = input.getAttribute('aria-describedby');

    if (ariaInvalid === 'true' && describedBy) {
      const errorElement = document.getElementById(describedBy);
      return Boolean(errorElement);
    }

    return false;
  }

  private errorMessageIsAssociated(input: HTMLElement): boolean {
    const describedBy = input.getAttribute('aria-describedby');
    return Boolean(describedBy && document.getElementById(describedBy));
  }

  private errorMessageIsAnnounced(input: HTMLElement): boolean {
    const describedBy = input.getAttribute('aria-describedby');
    if (describedBy) {
      const errorElement = document.getElementById(describedBy);
      if (errorElement) {
        const role = errorElement.getAttribute('role');
        const ariaLive = errorElement.getAttribute('aria-live');
        return role === 'alert' || Boolean(ariaLive);
      }
    }
    return false;
  }

  private fieldsetGroupsRelatedFields(fieldset: HTMLElement): boolean {
    const inputs = fieldset.querySelectorAll('input, textarea, select');
    return inputs.length > 1; // Heuristic: fieldset should group multiple related fields
  }

  private imageHasAlt(image: HTMLElement): boolean {
    return image.hasAttribute('alt') ||
           image.hasAttribute('aria-label') ||
           image.hasAttribute('aria-labelledby');
  }

  private getImageAltText(image: HTMLElement): string | null {
    return image.getAttribute('alt') ||
           image.getAttribute('aria-label') ||
           null;
  }

  private imageIsDecorative(image: HTMLElement): boolean {
    const alt = image.getAttribute('alt');
    const role = image.getAttribute('role');

    return alt === '' || role === 'presentation' || role === 'none';
  }

  private imageIsInformative(image: HTMLElement): boolean {
    return !this.imageIsDecorative(image);
  }

  private imageHasCaption(image: HTMLElement): boolean {
    const figure = image.closest('figure');
    return Boolean(figure && figure.querySelector('figcaption'));
  }

  private isRedundantAltText(image: HTMLElement, altText: string): boolean {
    const parent = image.parentElement;
    if (!parent) return false;

    const parentText = parent.textContent?.replace(altText, '').trim() || '';
    return parentText.toLowerCase().includes(altText.toLowerCase());
  }

  private isFocusable(element: HTMLElement): boolean {
    const tabindex = element.getAttribute('tabindex');
    const focusableTags = ['button', 'input', 'select', 'textarea', 'a'];

    return focusableTags.includes(element.tagName.toLowerCase()) ||
           element.hasAttribute('href') ||
           (tabindex !== null && tabindex !== '-1');
  }

  private addIssue(issue: ScreenReaderIssue): void {
    this.issues.push(issue);
  }
}

export default ScreenReaderValidator;