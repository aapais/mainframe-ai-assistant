# Accessibility Testing Guide

## WCAG 2.1 AA Compliance Framework

This document provides comprehensive guidance for testing and maintaining WCAG 2.1 AA compliance in the mainframe-ai-assistant project.

## Table of Contents

1. [Overview](#overview)
2. [Testing Framework](#testing-framework)
3. [Automated Testing](#automated-testing)
4. [Runtime Validation](#runtime-validation)
5. [Manual Testing Checklists](#manual-testing-checklists)
6. [CI/CD Integration](#cicd-integration)
7. [Common Issues and Solutions](#common-issues-and-solutions)
8. [Resources](#resources)

## Overview

Our accessibility testing framework ensures compliance with WCAG 2.1 AA standards through:

- **Automated testing** with axe-core and custom validators
- **Runtime validation** during development
- **Component-level testing** for individual React components
- **Full-page audits** for complete accessibility assessment
- **Manual testing checklists** for complex scenarios

## Testing Framework

### Core Components

1. **WCAGValidator** (`src/renderer/utils/wcagValidator.ts`)
   - Runtime accessibility validation
   - WCAG 2.1 AA compliance checking
   - Color contrast analysis
   - Focus management validation

2. **AccessibilityTestFramework** (`src/renderer/testing/accessibilityTests.ts`)
   - Jest-based testing utilities
   - Component accessibility testing
   - Keyboard navigation testing
   - Form accessibility validation

3. **AccessibilityAudit** (`src/renderer/components/AccessibilityAudit.tsx`)
   - Runtime audit interface
   - Visual violation reporting
   - Element highlighting
   - Export functionality

### Setup

Install required dependencies:

```bash
npm install --save-dev jest-axe @testing-library/jest-dom
npm install --save-dev @axe-core/react  # Optional for React integration
```

## Automated Testing

### Running Tests

```bash
# Run all accessibility tests
npm run test:accessibility

# Run specific test suites
npm test -- tests/accessibility/wcag-compliance.test.ts

# Run with coverage
npm run test:coverage -- --testPathPattern=accessibility
```

### Component Testing

```typescript
import { runAccessibilityTest } from '../src/renderer/testing/accessibilityTests';

test('MyComponent is accessible', async () => {
  const result = await runAccessibilityTest(<MyComponent />);

  expect(result.passed).toBe(true);
  expect(result.violationCount).toBe(0);
});
```

### Custom Matchers

```typescript
// Available custom Jest matchers
expect(result).toBeAccessible();
expect(contrastResult).toHaveNoColorContrastViolations();
expect(keyboardResult).toHaveValidKeyboardNavigation();
```

## Runtime Validation

### Enable Development Validation

```typescript
import WCAGValidator from './utils/wcagValidator';

// Enable in development mode
if (process.env.NODE_ENV === 'development') {
  const validator = WCAGValidator.getInstance();
  validator.startRuntimeValidation();
}
```

### Using the Accessibility Audit Component

```typescript
import AccessibilityAudit from './components/AccessibilityAudit';

function App() {
  const [showAudit, setShowAudit] = useState(false);

  return (
    <div>
      {/* Your app content */}

      {/* Debug panel for development */}
      {process.env.NODE_ENV === 'development' && (
        <button onClick={() => setShowAudit(true)}>
          Accessibility Audit
        </button>
      )}

      <AccessibilityAudit
        isVisible={showAudit}
        onClose={() => setShowAudit(false)}
        enableRuntimeValidation={true}
        autoRun={true}
      />
    </div>
  );
}
```

## Manual Testing Checklists

### 1. Keyboard Navigation Checklist

- [ ] All interactive elements are focusable with Tab key
- [ ] Focus order is logical and intuitive
- [ ] No keyboard traps (can always escape)
- [ ] Custom components respond to Enter/Space keys
- [ ] Skip links work correctly
- [ ] Modal dialogs trap focus appropriately
- [ ] Dropdown menus are keyboard accessible

**Testing Steps:**
1. Use only the keyboard to navigate
2. Tab through all interactive elements
3. Test Enter/Space on buttons and links
4. Test Escape key functionality
5. Verify focus indicators are visible

### 2. Screen Reader Testing Checklist

- [ ] All content is announced correctly
- [ ] Form fields have proper labels
- [ ] Buttons have descriptive names
- [ ] Links describe their purpose
- [ ] Status messages are announced
- [ ] Error messages are associated with fields
- [ ] Tables have proper headers

**Testing Steps:**
1. Use NVDA (Windows) or VoiceOver (Mac)
2. Navigate using screen reader commands
3. Test form filling workflow
4. Verify announcements for dynamic content

### 3. Visual/Color Contrast Checklist

- [ ] Text meets minimum contrast ratios (4.5:1 for normal text, 3:1 for large text)
- [ ] UI components have sufficient contrast
- [ ] Information is not conveyed by color alone
- [ ] Focus indicators are visible
- [ ] Links are distinguishable from regular text

**Testing Tools:**
- Color Contrast Analyzer
- WebAIM Contrast Checker
- Browser DevTools accessibility features

### 4. Zoom and Reflow Checklist

- [ ] Content is usable at 200% zoom
- [ ] No horizontal scrolling at 320px width
- [ ] Text spacing can be increased without loss of functionality
- [ ] Content reflows properly on mobile devices

**Testing Steps:**
1. Zoom to 200% in browser
2. Resize window to 320px width
3. Test with increased line-height and letter-spacing
4. Verify all functionality remains accessible

### 5. Forms Accessibility Checklist

- [ ] All form fields have labels
- [ ] Required fields are clearly marked
- [ ] Error messages are descriptive and helpful
- [ ] Errors are associated with relevant fields
- [ ] Form validation provides suggestions
- [ ] Fieldsets group related fields
- [ ] Instructions are provided where needed

**Testing Steps:**
1. Navigate form with keyboard only
2. Submit with invalid data to test error handling
3. Use screen reader to verify all associations
4. Test autocomplete functionality

### 6. Dynamic Content Checklist

- [ ] Loading states are announced
- [ ] Success/error messages use live regions
- [ ] Dynamic content updates don't break focus
- [ ] AJAX updates are announced appropriately
- [ ] Progressive disclosure is keyboard accessible

**Testing Steps:**
1. Test all interactive features
2. Verify screen reader announcements
3. Check focus management during updates
4. Test error and success scenarios

## CI/CD Integration

### GitHub Actions Configuration

```yaml
name: Accessibility Tests

on: [push, pull_request]

jobs:
  accessibility:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run accessibility tests
        run: npm run test:accessibility

      - name: Generate accessibility report
        run: npm run test:accessibility -- --reporters=default --reporters=jest-html-reporters

      - name: Upload accessibility report
        uses: actions/upload-artifact@v3
        with:
          name: accessibility-report
          path: accessibility-report.html
```

### Pre-commit Hook

```bash
#!/bin/sh
# .git/hooks/pre-commit

echo "Running accessibility tests..."
npm run test:accessibility

if [ $? -ne 0 ]; then
  echo "Accessibility tests failed. Please fix violations before committing."
  exit 1
fi
```

### Package.json Scripts

```json
{
  "scripts": {
    "test:accessibility": "jest --testPathPattern=accessibility",
    "test:accessibility:watch": "jest --testPathPattern=accessibility --watch",
    "test:accessibility:coverage": "jest --testPathPattern=accessibility --coverage",
    "audit:accessibility": "node scripts/run-accessibility-audit.js",
    "validate:wcag": "node scripts/validate-wcag-compliance.js"
  }
}
```

## Common Issues and Solutions

### 1. Missing Alt Text

**Issue:** Images without alt attributes
```html
<!-- ❌ Incorrect -->
<img src="chart.png">

<!-- ✅ Correct -->
<img src="chart.png" alt="Sales increased 25% in Q2">
<img src="decoration.png" alt="" role="presentation">
```

### 2. Inadequate Color Contrast

**Issue:** Text with insufficient contrast ratio
```css
/* ❌ Insufficient contrast */
color: #999;
background: #fff; /* Only 2.85:1 ratio */

/* ✅ Sufficient contrast */
color: #666;
background: #fff; /* 5.74:1 ratio */
```

### 3. Missing Form Labels

**Issue:** Form controls without proper labels
```html
<!-- ❌ Incorrect -->
<input type="text" placeholder="Name">

<!-- ✅ Correct -->
<label for="name">Name</label>
<input type="text" id="name" placeholder="Enter your full name">
```

### 4. Poor Focus Management

**Issue:** Lost or invisible focus
```css
/* ❌ Removes focus indicator */
:focus { outline: none; }

/* ✅ Custom focus indicator */
:focus {
  outline: 2px solid #0066cc;
  outline-offset: 2px;
}
```

### 5. Inaccessible Custom Components

**Issue:** Div elements acting as buttons
```html
<!-- ❌ Incorrect -->
<div onclick="handleClick()">Click me</div>

<!-- ✅ Correct -->
<button onclick="handleClick()">Click me</button>

<!-- ✅ Or with proper ARIA -->
<div role="button" tabindex="0" onclick="handleClick()"
     onkeydown="handleKeyDown(event)"
     aria-label="Click me">
  Click me
</div>
```

### 6. Missing Error Associations

**Issue:** Error messages not linked to form fields
```html
<!-- ❌ Incorrect -->
<input type="email" id="email">
<div class="error">Invalid email format</div>

<!-- ✅ Correct -->
<input type="email" id="email" aria-invalid="true"
       aria-describedby="email-error">
<div id="email-error" role="alert">Invalid email format</div>
```

## Testing Tools and Resources

### Browser Extensions

- **axe DevTools** - Free accessibility testing
- **WAVE** - Web accessibility evaluation
- **Lighthouse** - Built-in Chrome accessibility audit
- **Color Contrast Analyzer** - Contrast ratio checking

### Screen Readers

- **NVDA** (Windows) - Free screen reader
- **VoiceOver** (Mac) - Built-in screen reader
- **JAWS** (Windows) - Commercial screen reader
- **Orca** (Linux) - Free screen reader

### Online Tools

- **WebAIM Contrast Checker** - Color contrast validation
- **axe Accessibility Checker** - Online accessibility testing
- **WAVE Web Accessibility Evaluator** - Page analysis
- **Color Oracle** - Color blindness simulator

### Documentation

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [MDN Accessibility Guide](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [WebAIM Resources](https://webaim.org/resources/)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)

## Reporting Issues

### Accessibility Bug Report Template

```markdown
## Accessibility Issue

**WCAG Criterion:** [e.g., 1.4.3 Contrast (Minimum)]
**Severity:** [Critical/High/Medium/Low]
**Assistive Technology:** [Screen reader, keyboard navigation, etc.]

### Description
Brief description of the accessibility barrier.

### Steps to Reproduce
1. Step one
2. Step two
3. Step three

### Expected Behavior
What should happen for accessibility compliance.

### Actual Behavior
What actually happens that creates the barrier.

### Impact
Who is affected and how severely.

### Suggested Solution
Proposed fix or improvement.
```

## Conclusion

This accessibility testing framework ensures that the mainframe-ai-assistant meets WCAG 2.1 AA compliance standards. Regular testing, both automated and manual, helps maintain accessibility throughout the development process.

For questions or support, consult the [Web Content Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/) or reach out to the development team.

---

**Last Updated:** January 2025
**Framework Version:** 1.0.0
**WCAG Version:** 2.1 AA