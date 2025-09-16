#!/usr/bin/env node

/**
 * WCAG 2.1 AA Compliance Validation Script
 * Validates all components against WCAG accessibility standards
 */

const fs = require('fs');
const path = require('path');

// WCAG 2.1 AA Success Criteria
const WCAG_CRITERIA = {
  // Perceivable
  '1.1.1': {
    name: 'Non-text Content',
    level: 'A',
    description: 'All images, form image buttons, and image map hot spots have alt text',
    checks: ['alt-text', 'aria-label', 'aria-labelledby']
  },
  '1.3.1': {
    name: 'Info and Relationships',
    level: 'A',
    description: 'Semantic markup is used to designate headings and regions',
    checks: ['semantic-markup', 'headings', 'landmarks']
  },
  '1.3.2': {
    name: 'Meaningful Sequence',
    level: 'A',
    description: 'Reading order is logical and meaningful',
    checks: ['tab-order', 'source-order']
  },
  '1.3.3': {
    name: 'Sensory Characteristics',
    level: 'A',
    description: 'Instructions do not rely on sensory characteristics alone',
    checks: ['not-color-only', 'not-shape-only']
  },
  '1.4.1': {
    name: 'Use of Color',
    level: 'A',
    description: 'Color is not used as the sole method of conveying content',
    checks: ['color-independence']
  },
  '1.4.3': {
    name: 'Contrast (Minimum)',
    level: 'AA',
    description: 'Text has contrast ratio of at least 4.5:1',
    checks: ['color-contrast']
  },
  '1.4.4': {
    name: 'Resize text',
    level: 'AA',
    description: 'Text can be resized up to 200% without loss of content',
    checks: ['text-resize']
  },
  '1.4.10': {
    name: 'Reflow',
    level: 'AA',
    description: 'Content reflows to single column at 400% zoom',
    checks: ['responsive-design']
  },
  '1.4.11': {
    name: 'Non-text Contrast',
    level: 'AA',
    description: 'UI components have contrast ratio of at least 3:1',
    checks: ['ui-contrast']
  },

  // Operable
  '2.1.1': {
    name: 'Keyboard',
    level: 'A',
    description: 'All content is operable through keyboard interface',
    checks: ['keyboard-accessible']
  },
  '2.1.2': {
    name: 'No Keyboard Trap',
    level: 'A',
    description: 'Keyboard users are not trapped in subsections',
    checks: ['no-keyboard-trap']
  },
  '2.1.4': {
    name: 'Character Key Shortcuts',
    level: 'A',
    description: 'Single key shortcuts can be turned off or remapped',
    checks: ['key-shortcuts']
  },
  '2.4.1': {
    name: 'Bypass Blocks',
    level: 'A',
    description: 'Skip links or other mechanisms to bypass repetitive content',
    checks: ['skip-links']
  },
  '2.4.2': {
    name: 'Page Titled',
    level: 'A',
    description: 'Web pages have titles that describe topic or purpose',
    checks: ['page-title']
  },
  '2.4.3': {
    name: 'Focus Order',
    level: 'A',
    description: 'Focus order preserves meaning and operability',
    checks: ['focus-order']
  },
  '2.4.4': {
    name: 'Link Purpose (In Context)',
    level: 'A',
    description: 'Purpose of each link can be determined from link text',
    checks: ['link-purpose']
  },
  '2.4.6': {
    name: 'Headings and Labels',
    level: 'AA',
    description: 'Headings and labels describe topic or purpose',
    checks: ['descriptive-labels']
  },
  '2.4.7': {
    name: 'Focus Visible',
    level: 'AA',
    description: 'Keyboard focus indicator is visible',
    checks: ['focus-visible']
  },

  // Understandable
  '3.1.1': {
    name: 'Language of Page',
    level: 'A',
    description: 'Primary language of page is programmatically determined',
    checks: ['html-lang']
  },
  '3.2.1': {
    name: 'On Focus',
    level: 'A',
    description: 'Focus does not cause unexpected context changes',
    checks: ['no-focus-change']
  },
  '3.2.2': {
    name: 'On Input',
    level: 'A',
    description: 'Input does not cause unexpected context changes',
    checks: ['no-input-change']
  },
  '3.3.1': {
    name: 'Error Identification',
    level: 'A',
    description: 'Errors are identified and described in text',
    checks: ['error-identification']
  },
  '3.3.2': {
    name: 'Labels or Instructions',
    level: 'A',
    description: 'Labels or instructions are provided for user input',
    checks: ['form-labels']
  },
  '3.3.3': {
    name: 'Error Suggestion',
    level: 'AA',
    description: 'Suggestions are provided for input errors',
    checks: ['error-suggestions']
  },
  '3.3.4': {
    name: 'Error Prevention (Legal, Financial, Data)',
    level: 'AA',
    description: 'Submissions are reversible, checked, or confirmed',
    checks: ['error-prevention']
  },

  // Robust
  '4.1.1': {
    name: 'Parsing',
    level: 'A',
    description: 'Markup has complete start/end tags and proper nesting',
    checks: ['valid-html']
  },
  '4.1.2': {
    name: 'Name, Role, Value',
    level: 'A',
    description: 'Custom UI components have proper name, role, and value',
    checks: ['aria-roles', 'aria-properties']
  },
  '4.1.3': {
    name: 'Status Messages',
    level: 'AA',
    description: 'Status messages are programmatically determinable',
    checks: ['status-messages']
  }
};

// Component Analysis Functions
const analyzeComponent = (componentPath, componentName) => {
  console.log(`\n🔍 Analyzing: ${componentName}`);
  console.log(`📁 Path: ${componentPath}`);

  const content = fs.readFileSync(componentPath, 'utf8');
  const results = {
    component: componentName,
    path: componentPath,
    wcagCompliance: {},
    score: 0,
    issues: [],
    recommendations: []
  };

  // Check each WCAG criteria
  for (const [criterion, details] of Object.entries(WCAG_CRITERIA)) {
    results.wcagCompliance[criterion] = checkCriterion(content, criterion, details);
  }

  // Calculate overall score
  const totalChecks = Object.keys(WCAG_CRITERIA).length;
  const passedChecks = Object.values(results.wcagCompliance).filter(check => check.status === 'pass').length;
  results.score = Math.round((passedChecks / totalChecks) * 100);

  return results;
};

const checkCriterion = (content, criterion, details) => {
  const result = {
    name: details.name,
    level: details.level,
    status: 'unknown',
    evidence: [],
    issues: [],
    recommendations: []
  };

  // Check for specific patterns based on criterion
  switch (criterion) {
    case '1.1.1': // Non-text Content
      result.status = checkAltText(content, result);
      break;
    case '1.3.1': // Info and Relationships
      result.status = checkSemanticMarkup(content, result);
      break;
    case '1.4.3': // Contrast (Minimum)
      result.status = checkColorContrast(content, result);
      break;
    case '2.1.1': // Keyboard
      result.status = checkKeyboardSupport(content, result);
      break;
    case '2.4.3': // Focus Order
      result.status = checkFocusOrder(content, result);
      break;
    case '2.4.7': // Focus Visible
      result.status = checkFocusVisible(content, result);
      break;
    case '3.3.1': // Error Identification
      result.status = checkErrorIdentification(content, result);
      break;
    case '3.3.2': // Labels or Instructions
      result.status = checkFormLabels(content, result);
      break;
    case '4.1.2': // Name, Role, Value
      result.status = checkAriaSupport(content, result);
      break;
    case '4.1.3': // Status Messages
      result.status = checkStatusMessages(content, result);
      break;
    default:
      result.status = 'not-tested';
      result.issues.push('Automated test not implemented for this criterion');
  }

  return result;
};

// Specific Check Functions
const checkAltText = (content, result) => {
  // Check for image alt text patterns
  const imgPattern = /<img[^>]+>/gi;
  const svgPattern = /<svg[^>]*>/gi;

  const images = content.match(imgPattern) || [];
  const svgs = content.match(svgPattern) || [];

  let hasAltText = true;
  let hasAriaLabel = true;

  // Check images for alt text
  images.forEach(img => {
    if (!img.includes('alt=')) {
      hasAltText = false;
      result.issues.push('Image found without alt attribute');
    }
  });

  // Check SVGs for accessibility
  svgs.forEach(svg => {
    if (!svg.includes('aria-hidden="true"') && !svg.includes('aria-label') && !svg.includes('role="img"')) {
      hasAriaLabel = false;
      result.issues.push('SVG found without proper accessibility attributes');
    }
  });

  if (hasAltText && hasAriaLabel) {
    result.evidence.push('All images and SVGs have proper accessibility attributes');
    return 'pass';
  }

  if (!hasAltText) result.recommendations.push('Add alt attributes to all images');
  if (!hasAriaLabel) result.recommendations.push('Add aria-label or aria-hidden to decorative SVGs');

  return images.length === 0 && svgs.length === 0 ? 'not-applicable' : 'fail';
};

const checkSemanticMarkup = (content, result) => {
  const semanticElements = ['header', 'nav', 'main', 'section', 'article', 'aside', 'footer'];
  const headingPattern = /<h[1-6][^>]*>/gi;
  const rolePattern = /role=['"][^'"]+['"]/gi;

  const hasHeadings = headingPattern.test(content);
  const hasSemanticElements = semanticElements.some(element =>
    content.includes(`<${element}`) || content.includes(`role="${element}"`)
  );
  const hasRoles = rolePattern.test(content);

  if (hasHeadings) result.evidence.push('Heading elements found');
  if (hasSemanticElements) result.evidence.push('Semantic HTML elements found');
  if (hasRoles) result.evidence.push('ARIA roles properly used');

  if (hasHeadings || hasSemanticElements || hasRoles) {
    return 'pass';
  }

  result.issues.push('No semantic markup found');
  result.recommendations.push('Use semantic HTML elements and proper heading structure');
  return 'fail';
};

const checkColorContrast = (content, result) => {
  // Look for color-related CSS classes and patterns
  const colorClasses = [
    'text-gray-500', 'text-gray-400', 'text-gray-300', // Potentially low contrast
    'bg-blue-', 'bg-green-', 'bg-red-', 'bg-yellow-' // Color backgrounds
  ];

  let hasLowContrastRisk = false;
  let hasColorClasses = false;

  colorClasses.forEach(colorClass => {
    if (content.includes(colorClass)) {
      hasColorClasses = true;
      if (colorClass.includes('300') || colorClass.includes('400')) {
        hasLowContrastRisk = true;
        result.issues.push(`Potential low contrast with ${colorClass}`);
      }
    }
  });

  // Check for contrast-aware design patterns
  const hasContrastClasses = content.includes('focus:ring') || content.includes('focus-within:ring');
  const hasAccessibleColors = content.includes('text-gray-900') || content.includes('text-white');

  if (hasContrastClasses) result.evidence.push('Focus indicators with proper contrast found');
  if (hasAccessibleColors) result.evidence.push('High contrast text colors used');

  if (hasColorClasses && !hasLowContrastRisk) {
    return 'pass';
  }

  if (hasLowContrastRisk) {
    result.recommendations.push('Review color contrast ratios and use darker shades for better accessibility');
    return 'warning';
  }

  return hasColorClasses ? 'pass' : 'not-applicable';
};

const checkKeyboardSupport = (content, result) => {
  const keyboardPatterns = [
    'onKeyDown', 'onKeyUp', 'onKeyPress',
    'tabIndex', 'role="button"',
    'useKeyboardNavigation', 'keyboard'
  ];

  const interactiveElements = [
    'button', 'input', 'select', 'textarea', 'a href'
  ];

  const hasKeyboardHandlers = keyboardPatterns.some(pattern => content.includes(pattern));
  const hasInteractiveElements = interactiveElements.some(element => content.includes(element));
  const hasTabIndex = content.includes('tabIndex');
  const hasAriaHandling = content.includes('aria-') && (content.includes('onKeyDown') || content.includes('onClick'));

  if (hasKeyboardHandlers) result.evidence.push('Keyboard event handlers found');
  if (hasInteractiveElements) result.evidence.push('Interactive elements found');
  if (hasTabIndex) result.evidence.push('Tab index management found');

  // Custom interactive elements need keyboard support
  const customInteractive = content.includes('onClick') && !content.includes('<button') && !content.includes('<a ');

  if (customInteractive && !hasKeyboardHandlers) {
    result.issues.push('Custom interactive elements without keyboard support');
    result.recommendations.push('Add keyboard event handlers (Enter/Space) to custom interactive elements');
    return 'fail';
  }

  if (hasKeyboardHandlers || hasInteractiveElements) {
    return 'pass';
  }

  return 'not-applicable';
};

const checkFocusOrder = (content, result) => {
  const tabIndexPattern = /tabIndex=\{?(-?\d+)\}?/g;
  const tabIndexes = [];
  let match;

  while ((match = tabIndexPattern.exec(content)) !== null) {
    tabIndexes.push(parseInt(match[1]));
  }

  const hasNegativeTabIndex = tabIndexes.some(index => index < 0);
  const hasPositiveTabIndex = tabIndexes.some(index => index > 0);
  const hasZeroTabIndex = tabIndexes.some(index => index === 0);

  if (hasPositiveTabIndex) {
    result.issues.push('Positive tab index found - can disrupt natural tab order');
    result.recommendations.push('Use tabIndex={0} or remove tabIndex to maintain natural tab order');
    return 'warning';
  }

  if (hasNegativeTabIndex || hasZeroTabIndex) {
    result.evidence.push('Proper tab index management found');
  }

  if (tabIndexes.length === 0) {
    result.evidence.push('Relying on natural DOM order for focus');
  }

  return tabIndexes.length === 0 || !hasPositiveTabIndex ? 'pass' : 'fail';
};

const checkFocusVisible = (content, result) => {
  const focusPatterns = [
    'focus:outline', 'focus:ring', 'focus-visible:', 'focus-within:',
    ':focus', 'focus:', 'outline-none'
  ];

  const hasFocusStyles = focusPatterns.some(pattern => content.includes(pattern));
  const hasOutlineNone = content.includes('outline-none');
  const hasFocusRing = content.includes('focus:ring') || content.includes('focus-within:ring');

  if (hasOutlineNone && !hasFocusRing) {
    result.issues.push('outline-none used without alternative focus indicator');
    result.recommendations.push('Provide alternative focus indicators when removing default outline');
    return 'fail';
  }

  if (hasFocusStyles) {
    result.evidence.push('Focus indicators implemented');
    return 'pass';
  }

  result.recommendations.push('Add visible focus indicators for better keyboard navigation');
  return 'warning';
};

const checkErrorIdentification = (content, result) => {
  const errorPatterns = [
    'error', 'Error', 'invalid', 'aria-invalid',
    'aria-describedby.*error', 'role="alert"',
    'ValidationError', 'ErrorMessage'
  ];

  const formElements = ['input', 'select', 'textarea'];

  const hasErrorHandling = errorPatterns.some(pattern => content.includes(pattern));
  const hasFormElements = formElements.some(element => content.includes(element));
  const hasAriaInvalid = content.includes('aria-invalid');
  const hasErrorMessages = content.includes('aria-describedby') && content.includes('error');

  if (hasFormElements && hasErrorHandling) {
    if (hasAriaInvalid) result.evidence.push('aria-invalid used for error states');
    if (hasErrorMessages) result.evidence.push('Error messages linked with aria-describedby');
    return 'pass';
  }

  if (hasFormElements && !hasErrorHandling) {
    result.issues.push('Form elements found without error handling');
    result.recommendations.push('Implement error identification with aria-invalid and descriptive messages');
    return 'fail';
  }

  return 'not-applicable';
};

const checkFormLabels = (content, result) => {
  const labelPatterns = [
    '<label', 'aria-label', 'aria-labelledby',
    'FormField', 'label='
  ];

  const formElements = ['input', 'select', 'textarea', 'button'];

  const hasLabels = labelPatterns.some(pattern => content.includes(pattern));
  const hasFormElements = formElements.some(element => content.includes(element));
  const hasAriaLabels = content.includes('aria-label') || content.includes('aria-labelledby');

  if (hasFormElements) {
    if (hasLabels || hasAriaLabels) {
      result.evidence.push('Form elements have proper labels');
      return 'pass';
    }

    result.issues.push('Form elements found without proper labels');
    result.recommendations.push('Add labels or aria-label to all form elements');
    return 'fail';
  }

  return 'not-applicable';
};

const checkAriaSupport = (content, result) => {
  const ariaPatterns = [
    'aria-label', 'aria-labelledby', 'aria-describedby',
    'role=', 'aria-expanded', 'aria-selected', 'aria-pressed',
    'aria-checked', 'aria-disabled', 'aria-hidden'
  ];

  const customComponents = !content.includes('<button') && !content.includes('<input') && content.includes('onClick');
  const hasAriaSupport = ariaPatterns.some(pattern => content.includes(pattern));
  const hasRole = content.includes('role=');

  if (customComponents && !hasAriaSupport) {
    result.issues.push('Custom interactive elements without ARIA support');
    result.recommendations.push('Add appropriate ARIA attributes to custom components');
    return 'fail';
  }

  if (hasAriaSupport) {
    result.evidence.push('ARIA attributes properly used');
    if (hasRole) result.evidence.push('ARIA roles defined');
    return 'pass';
  }

  return customComponents ? 'fail' : 'not-applicable';
};

const checkStatusMessages = (content, result) => {
  const statusPatterns = [
    'aria-live', 'role="status"', 'role="alert"',
    'useScreenReaderAnnouncements', 'announce'
  ];

  const hasStatusMessages = statusPatterns.some(pattern => content.includes(pattern));
  const hasAlerts = content.includes('AlertMessage') || content.includes('alert');

  if (hasStatusMessages) {
    result.evidence.push('Status messages with live regions found');
    return 'pass';
  }

  if (hasAlerts && !hasStatusMessages) {
    result.issues.push('Alert components without proper aria-live regions');
    result.recommendations.push('Add aria-live regions for dynamic status messages');
    return 'warning';
  }

  return hasAlerts ? 'warning' : 'not-applicable';
};

// Main execution
const runWCAGValidation = () => {
  console.log('🧪 WCAG 2.1 AA Compliance Validation');
  console.log('=====================================\n');

  const componentsDir = path.join(__dirname, '../src');
  const results = [];

  // Find all component files
  const findComponents = (dir) => {
    const files = [];
    if (!fs.existsSync(dir)) return files;

    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      if (fs.statSync(fullPath).isDirectory()) {
        files.push(...findComponents(fullPath));
      } else if (item.endsWith('.tsx') && !item.includes('.test.') && !item.includes('.spec.')) {
        files.push(fullPath);
      }
    }
    return files;
  };

  const componentFiles = findComponents(componentsDir);

  console.log(`Found ${componentFiles.length} component files\n`);

  // Analyze each component
  componentFiles.forEach(filePath => {
    const componentName = path.basename(filePath, '.tsx');
    const result = analyzeComponent(filePath, componentName);
    results.push(result);

    console.log(`✅ Score: ${result.score}%`);

    const issues = Object.values(result.wcagCompliance)
      .filter(check => check.status === 'fail')
      .length;

    const warnings = Object.values(result.wcagCompliance)
      .filter(check => check.status === 'warning')
      .length;

    if (issues > 0) console.log(`⚠️  Issues: ${issues}`);
    if (warnings > 0) console.log(`⚡ Warnings: ${warnings}`);
  });

  // Generate summary report
  const totalComponents = results.length;
  const avgScore = results.reduce((sum, r) => sum + r.score, 0) / totalComponents;
  const fullCompliant = results.filter(r => r.score === 100).length;

  console.log('\n📊 Summary Report');
  console.log('==================');
  console.log(`Total Components: ${totalComponents}`);
  console.log(`Average WCAG Score: ${Math.round(avgScore)}%`);
  console.log(`Fully Compliant: ${fullCompliant}/${totalComponents} (${Math.round(fullCompliant/totalComponents*100)}%)`);

  // Save detailed report
  const reportPath = path.join(__dirname, '../WCAG-COMPLIANCE-REPORT.md');
  generateDetailedReport(results, reportPath);

  console.log(`\n📝 Detailed report saved: ${reportPath}`);

  return results;
};

// Generate detailed markdown report
const generateDetailedReport = (results, outputPath) => {
  const timestamp = new Date().toISOString();
  const totalComponents = results.length;
  const avgScore = results.reduce((sum, r) => sum + r.score, 0) / totalComponents;

  let report = `# WCAG 2.1 AA Compliance Report

**Generated:** ${timestamp}
**Components Analyzed:** ${totalComponents}
**Average Score:** ${Math.round(avgScore)}%

## Executive Summary

This report provides a comprehensive analysis of WCAG 2.1 AA compliance across all components in the Mainframe KB Assistant application. Each component has been evaluated against the applicable success criteria.

### Overall Compliance Status

| Metric | Value |
|--------|--------|
| Total Components | ${totalComponents} |
| Average WCAG Score | ${Math.round(avgScore)}% |
| Fully Compliant Components | ${results.filter(r => r.score === 100).length} |
| Components with Issues | ${results.filter(r => r.score < 100).length} |

### Compliance Distribution

`;

  // Add score distribution
  const scoreRanges = {
    '90-100%': results.filter(r => r.score >= 90).length,
    '75-89%': results.filter(r => r.score >= 75 && r.score < 90).length,
    '50-74%': results.filter(r => r.score >= 50 && r.score < 75).length,
    'Below 50%': results.filter(r => r.score < 50).length
  };

  Object.entries(scoreRanges).forEach(([range, count]) => {
    const percentage = Math.round((count / totalComponents) * 100);
    report += `- **${range}**: ${count} components (${percentage}%)\n`;
  });

  report += `\n## Individual Component Results\n\n`;

  // Add individual component results
  results.sort((a, b) => b.score - a.score);

  results.forEach(result => {
    const statusIcon = result.score === 100 ? '✅' : result.score >= 75 ? '⚠️' : '❌';

    report += `### ${statusIcon} ${result.component} (${result.score}%)\n\n`;

    // Add WCAG criteria results
    const criteriaResults = Object.entries(result.wcagCompliance)
      .filter(([_, check]) => check.status !== 'not-applicable' && check.status !== 'not-tested');

    if (criteriaResults.length > 0) {
      report += `#### WCAG Success Criteria\n\n`;
      report += `| Criterion | Name | Level | Status | Issues |\n`;
      report += `|-----------|------|-------|--------|--------|\n`;

      criteriaResults.forEach(([criterion, check]) => {
        const status = check.status === 'pass' ? '✅ Pass' :
                     check.status === 'fail' ? '❌ Fail' :
                     check.status === 'warning' ? '⚠️ Warning' :
                     '❓ Unknown';
        const issues = check.issues.length > 0 ? check.issues.join('; ') : '-';
        report += `| ${criterion} | ${check.name} | ${check.level} | ${status} | ${issues} |\n`;
      });
      report += `\n`;
    }

    // Add issues and recommendations
    const allIssues = Object.values(result.wcagCompliance)
      .flatMap(check => check.issues)
      .filter(issue => issue);

    const allRecommendations = Object.values(result.wcagCompliance)
      .flatMap(check => check.recommendations)
      .filter(rec => rec);

    if (allIssues.length > 0) {
      report += `#### Issues Found\n\n`;
      allIssues.forEach(issue => {
        report += `- ${issue}\n`;
      });
      report += `\n`;
    }

    if (allRecommendations.length > 0) {
      report += `#### Recommendations\n\n`;
      allRecommendations.forEach(rec => {
        report += `- ${rec}\n`;
      });
      report += `\n`;
    }

    report += `---\n\n`;
  });

  // Add testing methodology
  report += `## Testing Methodology

### Automated Testing
This report is generated through automated static analysis of React component source code. The analysis checks for:

- Proper ARIA attributes and roles
- Semantic HTML usage
- Keyboard interaction patterns
- Focus management
- Color contrast considerations
- Error handling patterns
- Form labeling
- Status message implementations

### Manual Testing Required
The following aspects require manual testing:

1. **Color Contrast**: Automated testing can only identify potential issues. Actual contrast ratios should be measured.
2. **Keyboard Navigation**: Full keyboard testing should be performed on rendered components.
3. **Screen Reader Testing**: Components should be tested with actual screen readers.
4. **Focus Indicators**: Visual verification of focus indicators is required.
5. **Responsive Design**: Testing at different zoom levels and viewport sizes.

### Continuous Monitoring
- Run this validation script before each release
- Include accessibility tests in CI/CD pipeline
- Perform monthly manual accessibility audits
- Update validation criteria as WCAG guidelines evolve

## Remediation Priority

### High Priority (Immediate Action Required)
Components with scores below 75% that contain accessibility barriers affecting core functionality.

### Medium Priority (Address in Next Sprint)
Components with scores 75-89% that have warnings or minor issues.

### Low Priority (Monitor and Improve)
Components with scores above 90% that may benefit from enhancements.

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Color Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [axe DevTools](https://www.deque.com/axe/devtools/)

---

*This report is automatically generated. For questions or issues, please contact the development team.*
`;

  fs.writeFileSync(outputPath, report);
};

// Run if called directly
if (require.main === module) {
  runWCAGValidation();
}

module.exports = { runWCAGValidation, analyzeComponent, WCAG_CRITERIA };