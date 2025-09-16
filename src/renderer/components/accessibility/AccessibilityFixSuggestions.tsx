/**
 * Automated Accessibility Fix Suggestions Component
 *
 * Analyzes accessibility violations and provides automated fix suggestions
 * with code examples and implementation guidance.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Result } from 'axe-core';

interface FixSuggestion {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  effort: 'low' | 'medium' | 'high';
  codeExample?: string;
  autoFixAvailable: boolean;
  steps: string[];
  resources: Array<{
    title: string;
    url: string;
    type: 'documentation' | 'example' | 'tool';
  }>;
}

interface AccessibilityFixSuggestionsProps {
  violations: Result[];
  onApplyFix?: (violationId: string, fixId: string) => void;
  onDismiss?: (violationId: string) => void;
  showCodeExamples?: boolean;
  autoApplySimpleFixes?: boolean;
}

const AccessibilityFixSuggestions: React.FC<AccessibilityFixSuggestionsProps> = ({
  violations,
  onApplyFix,
  onDismiss,
  showCodeExamples = true,
  autoApplySimpleFixes = false,
}) => {
  const [suggestions, setSuggestions] = useState<Map<string, FixSuggestion[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const [expandedViolations, setExpandedViolations] = useState<Set<string>>(new Set());

  // Generate fix suggestions for violations
  const generateFixSuggestions = useCallback((violation: Result): FixSuggestion[] => {
    const fixes: FixSuggestion[] = [];

    switch (violation.id) {
      case 'color-contrast':
        fixes.push({
          id: 'increase-contrast',
          title: 'Increase Color Contrast',
          description: 'Adjust foreground or background colors to meet WCAG AA standards (4.5:1 ratio for normal text, 3:1 for large text).',
          severity: 'serious',
          effort: 'low',
          autoFixAvailable: true,
          codeExample: `
/* Before - insufficient contrast */
.text-element {
  color: #999; /* Only 2.8:1 contrast */
  background: #fff;
}

/* After - WCAG AA compliant */
.text-element {
  color: #555; /* 4.6:1 contrast */
  background: #fff;
}
          `.trim(),
          steps: [
            'Use a color contrast checker tool',
            'Darken the text color or lighten the background',
            'Ensure ratio is at least 4.5:1 for normal text',
            'Test with users who have color vision differences'
          ],
          resources: [
            {
              title: 'WebAIM Color Contrast Checker',
              url: 'https://webaim.org/resources/contrastchecker/',
              type: 'tool'
            },
            {
              title: 'WCAG Color Contrast Guidelines',
              url: 'https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html',
              type: 'documentation'
            }
          ]
        });
        break;

      case 'button-name':
        fixes.push({
          id: 'add-accessible-name',
          title: 'Add Accessible Button Name',
          description: 'Provide an accessible name using aria-label, aria-labelledby, or visible text content.',
          severity: 'serious',
          effort: 'low',
          autoFixAvailable: true,
          codeExample: `
<!-- Before - no accessible name -->
<button onclick="save()">
  <svg>...</svg>
</button>

<!-- After - with accessible name -->
<button onclick="save()" aria-label="Save document">
  <svg aria-hidden="true">...</svg>
</button>
          `.trim(),
          steps: [
            'Add aria-label attribute with descriptive text',
            'Or use aria-labelledby to reference existing text',
            'Or add visible text content inside the button',
            'Mark decorative icons with aria-hidden="true"'
          ],
          resources: [
            {
              title: 'Button Accessibility Guide',
              url: 'https://www.w3.org/WAI/ARIA/apg/patterns/button/',
              type: 'documentation'
            }
          ]
        });
        break;

      case 'form-field-multiple-labels':
      case 'label':
        fixes.push({
          id: 'fix-form-labels',
          title: 'Fix Form Field Labels',
          description: 'Ensure each form field has exactly one properly associated label.',
          severity: 'serious',
          effort: 'low',
          autoFixAvailable: true,
          codeExample: `
<!-- Before - missing or incorrect labels -->
<input type="text" placeholder="Enter your name">

<!-- After - proper label association -->
<label for="name-field">Name (required)</label>
<input id="name-field" type="text" required aria-describedby="name-help">
<div id="name-help">Enter your full name</div>
          `.trim(),
          steps: [
            'Add a <label> element for each form field',
            'Use the "for" attribute to associate label with input',
            'Ensure each input has a unique "id" attribute',
            'Add aria-describedby for additional help text'
          ],
          resources: [
            {
              title: 'Form Labels Tutorial',
              url: 'https://www.w3.org/WAI/tutorials/forms/labels/',
              type: 'documentation'
            }
          ]
        });
        break;

      case 'link-name':
        fixes.push({
          id: 'add-link-text',
          title: 'Add Descriptive Link Text',
          description: 'Provide clear, descriptive text that explains the link\'s purpose and destination.',
          severity: 'serious',
          effort: 'low',
          autoFixAvailable: false,
          codeExample: `
<!-- Before - vague link text -->
<a href="/report.pdf">Click here</a>
<a href="/about">Read more</a>

<!-- After - descriptive link text -->
<a href="/report.pdf">Download 2024 Annual Report (PDF)</a>
<a href="/about">Read more about our services</a>
          `.trim(),
          steps: [
            'Replace vague text like "click here" or "read more"',
            'Describe the link\'s destination or purpose',
            'Keep link text concise but meaningful',
            'Consider the context when read by screen readers'
          ],
          resources: [
            {
              title: 'Writing Good Link Text',
              url: 'https://www.w3.org/WAI/tips/writing/#write-meaningful-text-alternatives-for-images',
              type: 'documentation'
            }
          ]
        });
        break;

      case 'heading-order':
        fixes.push({
          id: 'fix-heading-structure',
          title: 'Fix Heading Hierarchy',
          description: 'Ensure headings follow a logical order (h1, h2, h3) without skipping levels.',
          severity: 'moderate',
          effort: 'medium',
          autoFixAvailable: true,
          codeExample: `
<!-- Before - incorrect heading order -->
<h1>Main Title</h1>
<h3>Subsection</h3> <!-- Skips h2 -->
<h2>Section</h2>    <!-- Out of order -->

<!-- After - correct heading hierarchy -->
<h1>Main Title</h1>
<h2>Section</h2>
<h3>Subsection</h3>
          `.trim(),
          steps: [
            'Start with one h1 per page (main title)',
            'Use h2 for main sections',
            'Use h3 for subsections under h2',
            'Don\'t skip heading levels',
            'Consider using CSS for visual styling instead of changing heading levels'
          ],
          resources: [
            {
              title: 'Heading Structure Tutorial',
              url: 'https://www.w3.org/WAI/tutorials/page-structure/headings/',
              type: 'documentation'
            }
          ]
        });
        break;

      case 'landmark-one-main':
      case 'region':
        fixes.push({
          id: 'add-landmarks',
          title: 'Add Landmark Roles',
          description: 'Structure your page with proper landmarks (main, nav, header, footer) for screen reader navigation.',
          severity: 'moderate',
          effort: 'medium',
          autoFixAvailable: true,
          codeExample: `
<!-- Before - no landmarks -->
<div class="header">...</div>
<div class="content">...</div>
<div class="sidebar">...</div>

<!-- After - with proper landmarks -->
<header role="banner">...</header>
<main role="main">...</main>
<nav role="navigation" aria-label="Main navigation">...</nav>
<aside role="complementary">...</aside>
          `.trim(),
          steps: [
            'Add <main> element for primary content',
            'Use <nav> for navigation areas',
            'Add <header> and <footer> elements',
            'Use <aside> for complementary content',
            'Ensure only one main landmark per page'
          ],
          resources: [
            {
              title: 'Page Landmarks Guide',
              url: 'https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/',
              type: 'documentation'
            }
          ]
        });
        break;

      case 'bypass':
        fixes.push({
          id: 'add-skip-links',
          title: 'Add Skip Links',
          description: 'Provide skip links to allow keyboard users to bypass navigation and go directly to main content.',
          severity: 'serious',
          effort: 'low',
          autoFixAvailable: true,
          codeExample: `
<!-- Add at the very beginning of <body> -->
<div class="skip-links">
  <a href="#main-content" class="skip-link">Skip to main content</a>
  <a href="#navigation" class="skip-link">Skip to navigation</a>
</div>

<!-- CSS for skip links -->
.skip-link {
  position: absolute;
  top: -40px;
  left: 6px;
  background: #000;
  color: #fff;
  padding: 8px;
  text-decoration: none;
  z-index: 100;
}

.skip-link:focus {
  top: 6px;
}
          `.trim(),
          steps: [
            'Add skip links as the first focusable elements',
            'Link to main content and navigation areas',
            'Hide links visually but show on focus',
            'Ensure links actually work when activated'
          ],
          resources: [
            {
              title: 'Skip Links Implementation',
              url: 'https://webaim.org/techniques/skipnav/',
              type: 'documentation'
            }
          ]
        });
        break;

      default:
        // Generic fix suggestion
        fixes.push({
          id: 'generic-fix',
          title: `Fix ${violation.id}`,
          description: violation.description || 'Address this accessibility issue',
          severity: violation.impact as any || 'moderate',
          effort: 'medium',
          autoFixAvailable: false,
          steps: [
            'Review the violation description',
            'Check the affected elements',
            'Apply the recommended solution',
            'Test with assistive technologies'
          ],
          resources: [
            {
              title: 'WCAG Guidelines',
              url: `https://www.w3.org/WAI/WCAG21/Understanding/${violation.id}.html`,
              type: 'documentation'
            }
          ]
        });
    }

    return fixes;
  }, []);

  // Generate suggestions when violations change
  useEffect(() => {
    if (violations.length === 0) {
      setSuggestions(new Map());
      return;
    }

    setLoading(true);
    const newSuggestions = new Map<string, FixSuggestion[]>();

    violations.forEach(violation => {
      const fixes = generateFixSuggestions(violation);
      newSuggestions.set(violation.id, fixes);
    });

    setSuggestions(newSuggestions);
    setLoading(false);

    // Auto-apply simple fixes if enabled
    if (autoApplySimpleFixes) {
      newSuggestions.forEach((fixes, violationId) => {
        fixes.forEach(fix => {
          if (fix.autoFixAvailable && fix.effort === 'low') {
            setTimeout(() => {
              onApplyFix?.(violationId, fix.id);
            }, 100);
          }
        });
      });
    }
  }, [violations, generateFixSuggestions, onApplyFix, autoApplySimpleFixes]);

  const toggleExpansion = (violationId: string) => {
    const newExpanded = new Set(expandedViolations);
    if (newExpanded.has(violationId)) {
      newExpanded.delete(violationId);
    } else {
      newExpanded.add(violationId);
    }
    setExpandedViolations(newExpanded);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'status-danger';
      case 'serious':
        return 'status-warning';
      case 'moderate':
        return 'status-info';
      case 'minor':
        return 'text-foreground-muted';
      default:
        return 'text-foreground';
    }
  };

  const getEffortIndicator = (effort: string) => {
    switch (effort) {
      case 'low':
        return '🟢 Quick Fix';
      case 'medium':
        return '🟡 Moderate';
      case 'high':
        return '🔴 Complex';
      default:
        return effort;
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center" role="status" aria-live="polite">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
        <span>Analyzing accessibility issues...</span>
      </div>
    );
  }

  if (violations.length === 0) {
    return (
      <div className="p-6 text-center status-success" role="status" aria-live="polite">
        <h3 className="text-lg font-semibold mb-2">No Accessibility Issues Found!</h3>
        <p>All analyzed elements meet WCAG 2.1 AA guidelines.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" role="region" aria-label="Accessibility fix suggestions">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Fix Suggestions</h2>
        <div className="text-sm text-foreground-muted">
          {violations.length} issue{violations.length !== 1 ? 's' : ''} found
        </div>
      </div>

      {violations.map(violation => {
        const fixes = suggestions.get(violation.id) || [];
        const isExpanded = expandedViolations.has(violation.id);

        return (
          <div
            key={violation.id}
            className="component-surface p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <h3 className="font-semibold">{violation.help || violation.id}</h3>
                  <span className={`px-2 py-1 text-xs rounded ${getSeverityColor(violation.impact || 'moderate')}`}>
                    {violation.impact || 'moderate'}
                  </span>
                </div>
                <p className="text-sm text-foreground-muted mt-1">
                  {violation.description}
                </p>
                <div className="text-xs text-foreground-muted mt-1">
                  Affects {violation.nodes.length} element{violation.nodes.length !== 1 ? 's' : ''}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => toggleExpansion(violation.id)}
                  className="interactive-element px-3 py-1 text-sm rounded"
                  aria-expanded={isExpanded}
                  aria-controls={`fixes-${violation.id}`}
                >
                  {isExpanded ? 'Hide' : 'Show'} Fixes
                </button>
                {onDismiss && (
                  <button
                    type="button"
                    onClick={() => onDismiss(violation.id)}
                    className="interactive-element px-3 py-1 text-sm rounded"
                    aria-label={`Dismiss ${violation.id} violation`}
                  >
                    Dismiss
                  </button>
                )}
              </div>
            </div>

            {isExpanded && (
              <div id={`fixes-${violation.id}`} className="space-y-4">
                {fixes.map(fix => (
                  <div
                    key={fix.id}
                    className="border border-border-secondary rounded-md p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{fix.title}</h4>
                        <p className="text-sm text-foreground-muted">
                          {fix.description}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-foreground-muted">
                          {getEffortIndicator(fix.effort)}
                        </div>
                        {fix.autoFixAvailable && (
                          <button
                            type="button"
                            onClick={() => onApplyFix?.(violation.id, fix.id)}
                            className="mt-2 interactive-element px-3 py-1 text-sm rounded bg-primary text-primary-foreground"
                          >
                            Auto-fix
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <h5 className="text-sm font-medium mb-2">Steps to fix:</h5>
                        <ol className="text-sm space-y-1 list-decimal list-inside pl-4">
                          {fix.steps.map((step, index) => (
                            <li key={index} className="text-foreground-muted">
                              {step}
                            </li>
                          ))}
                        </ol>
                      </div>

                      {showCodeExamples && fix.codeExample && (
                        <details className="group">
                          <summary className="cursor-pointer text-sm font-medium text-primary hover:text-primary-hover">
                            Show code example
                          </summary>
                          <pre className="mt-2 p-3 bg-background-muted rounded text-xs overflow-x-auto">
                            <code>{fix.codeExample}</code>
                          </pre>
                        </details>
                      )}

                      {fix.resources.length > 0 && (
                        <div>
                          <h6 className="text-sm font-medium mb-2">Resources:</h6>
                          <ul className="text-sm space-y-1">
                            {fix.resources.map((resource, index) => (
                              <li key={index}>
                                <a
                                  href={resource.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-link hover:text-link-hover underline"
                                >
                                  {resource.title}
                                </a>
                                <span className="text-foreground-muted ml-2">
                                  ({resource.type})
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default AccessibilityFixSuggestions;