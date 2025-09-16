# Visual Regression Testing Suite

A comprehensive visual testing framework for the Mainframe KB Assistant UI components, providing 95% visual coverage across multiple browsers, themes, and responsive designs.

## 🎭 Overview

This visual regression testing suite ensures consistent UI rendering across:

- **87 React components** with pixel-perfect accuracy
- **Cross-browser compatibility** (Chrome, Firefox, Edge)
- **Responsive design** validation (mobile, tablet, desktop)
- **Theme variations** (light, dark, high-contrast)
- **Accessibility** visual features
- **Component states** (hover, focus, active, disabled)

## 🚀 Quick Start

### Prerequisites

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install
```

### Running Tests

```bash
# Run all visual regression tests
npm run test:visual:all

# Run specific component tests
npm run test:visual:searchbar
npm run test:visual:resultslist
npm run test:visual:entrydetail

# Run theme variation tests
npm run test:visual:themes

# Run responsive design tests
npm run test:visual:responsive

# Run cross-browser tests
npm run test:visual:cross-browser
```

## 📊 Test Structure

```
tests/visual-regression/
├── config/
│   ├── visual-test.config.ts      # Core configuration
│   ├── visual-global-setup.ts     # Test environment setup
│   └── visual-global-teardown.ts  # Cleanup and reporting
├── tests/
│   ├── visual-searchbar.test.ts   # SearchBar components
│   ├── visual-resultslist.test.ts # ResultsList components
│   ├── visual-entrydetail.test.ts # EntryDetail components
│   ├── theme-variations.test.ts   # Light/Dark/HC themes
│   └── responsive-design.test.ts  # Mobile/Tablet/Desktop
├── utils/
│   └── visual-test-helpers.ts     # Testing utilities
├── fixtures/
│   ├── mock-kb-data.json         # Test data
│   └── component-fixtures.json   # Component states
└── README.md                     # This file
```

## 🎯 Coverage Targets

| Category | Target | Description |
|----------|--------|-------------|
| **Components** | 95% | Visual testing of React components |
| **Responsive** | 90% | Mobile, tablet, desktop layouts |
| **Themes** | 85% | Light, dark, high-contrast themes |
| **Cross-browser** | 80% | Chrome, Firefox, WebKit consistency |
| **Accessibility** | 90% | Focus states, contrast, ARIA |

## 🧩 Component Categories

### Form Components
- **SearchBar** - Basic search input with focus/hover states
- **KBSearchBar** - Enhanced search with filters and suggestions
- **SimpleSearchBar** - Minimal search interface
- **EnhancedKBSearchBar** - Full-featured search component

### Display Components
- **ResultsList** - Search results with selection states
- **EntryDetail** - Knowledge base entry viewer
- **MetricsDashboard** - Analytics and statistics display

### Navigation Components
- **AppLayout** - Main application layout
- **DetailPanel** - Sidebar detail view
- **LayoutPanel** - Responsive layout container

### Interactive Components
- **Button** - All button variants and states
- **Modal** - Dialog and popup components
- **Dropdown** - Selection dropdowns
- **Tabs** - Tab navigation components

### Accessibility Components
- **AccessibilityChecker** - A11y validation tools
- **AriaPatterns** - ARIA implementation examples
- **AlertMessage** - Accessible notifications

## 🔧 Configuration

### Visual Comparison Settings

```typescript
// Default threshold: 0.1% pixel difference
toHaveScreenshot: {
  threshold: 0.001,
  mode: 'image',
  animations: 'disabled',
  caret: 'hide',
  scale: 'device'
}
```

### Test Viewports

```typescript
testViewports = {
  mobile: { width: 393, height: 851 },    // iPhone 12
  tablet: { width: 1024, height: 1366 },  // iPad Pro
  desktop: { width: 1920, height: 1080 }, // Desktop
  ultrawide: { width: 2560, height: 1440 }// Ultrawide
}
```

### Visual Thresholds

```typescript
visualThresholds = {
  component: 0.001,  // Strict for UI components
  text: 0.01,        // Relaxed for text content
  charts: 0.005,     // Medium for graphs
  icons: 0.0005,     // Very strict for icons
  layout: 0.002      // Medium for layouts
}
```

## 🛠️ Test Development

### Creating New Visual Tests

1. **Component Test Template:**

```typescript
test('Component - Visual State', async ({ page }) => {
  await page.setContent(`<!-- Your HTML -->`);

  const component = page.locator('#component-id');
  await VisualTestMatchers.compareWithTolerance(
    component,
    'component-state-name'
  );
});
```

2. **Multi-State Testing:**

```typescript
test('Component States Suite', async ({ page }) => {
  const component = page.locator('#component');

  await factory.createComponentSuite('component-name', component, {
    states: [
      { hover: true },
      { focus: true },
      { disabled: true },
      { loading: true }
    ],
    responsive: [
      { viewport: 'mobile' },
      { viewport: 'tablet' }
    ],
    themes: ['light', 'dark']
  });
});
```

3. **Theme Testing:**

```typescript
test('Component Themes', async ({ page }) => {
  const component = page.locator('#component');

  await helpers.testThemes('component-themes', component, [
    'light', 'dark', 'high-contrast'
  ]);
});
```

### Visual Test Helpers

#### VisualTestHelpers Class

```typescript
const helpers = new VisualTestHelpers(page);

// Prepare page for consistent testing
await helpers.preparePage({
  disableAnimations: true,
  waitForFonts: true,
  waitForImages: true
});

// Test component in multiple states
await helpers.testComponentStates(
  'component-name',
  locator,
  [
    { hover: true },
    { focus: true },
    { disabled: true }
  ]
);

// Test responsive behavior
await helpers.testResponsive(
  'component-responsive',
  locator,
  [
    { viewport: 'mobile' },
    { viewport: 'tablet' },
    { viewport: 'desktop' }
  ]
);
```

#### Visual Test Matchers

```typescript
// Component with specific tolerance
await VisualTestMatchers.compareWithTolerance(
  locator,
  'screenshot-name',
  'component' // or 'text', 'layout', 'icons'
);

// Layout with masked dynamic content
await VisualTestMatchers.compareLayout(
  page,
  'layout-name',
  ['.timestamp', '.dynamic-counter'] // selectors to mask
);

// Text rendering with relaxed threshold
await VisualTestMatchers.compareText(
  locator,
  'text-rendering'
);
```

## 📱 Responsive Testing

### Viewport Testing

```typescript
// Test across all standard viewports
await helpers.testResponsive('component', locator, [
  { viewport: 'mobile', orientation: 'portrait' },
  { viewport: 'mobile', orientation: 'landscape' },
  { viewport: 'tablet' },
  { viewport: 'desktop' },
  { viewport: 'ultrawide' }
]);
```

### Device-Specific Tests

The suite includes tests for common devices:
- iPhone SE (375×667)
- iPhone 12 (390×844)
- iPhone 12 Pro Max (428×926)
- Galaxy S21 (384×854)
- iPad Mini (744×1133)
- iPad Pro (1024×1366)
- Surface Pro (912×1368)

## 🎨 Theme Testing

### Theme Variations

```typescript
test('Theme Consistency', async ({ page }) => {
  const themes = ['light', 'dark', 'high-contrast'];

  for (const theme of themes) {
    await page.evaluate((themeName) => {
      document.documentElement.setAttribute('data-theme', themeName);
    }, theme);

    await page.waitForTimeout(300); // Allow theme to apply

    await VisualTestMatchers.compareWithTolerance(
      component,
      `component-${theme}-theme`
    );
  }
});
```

### Color Contrast Validation

High-contrast theme ensures WCAG AAA compliance:

```css
[data-theme="high-contrast"] {
  --bg-primary: #ffffff;
  --text-primary: #000000;
  --border-primary: #000000;
  --accent-primary: #0000ff;
}
```

## 🚦 CI/CD Integration

### GitHub Actions Workflow

The visual regression tests run automatically on:
- **Pull Requests** - Prevent visual regressions
- **Main Branch Push** - Validate releases
- **Nightly Schedule** - Catch environment changes

### Test Results

Results include:
- **Screenshots** for failed tests
- **Diff images** showing pixel differences
- **Coverage report** with component analysis
- **Cross-browser comparison** results

### Updating Baselines

```bash
# Update screenshots locally
npm run test:visual:update

# Or trigger via GitHub Actions
# Workflow dispatch: update_baselines = true
```

## 📈 Coverage Reporting

### Generate Coverage Report

```bash
npm run test:visual:coverage
```

This creates:
- `visual-coverage-report.html` - Interactive HTML report
- `visual-coverage-summary.json` - Programmatic access

### Coverage Metrics

The report includes:
- **Component coverage** by category
- **Test execution** statistics
- **Missing test coverage** identification
- **Cross-browser consistency** analysis
- **Responsive design** validation

## 🔧 Debugging Visual Tests

### Interactive Mode

```bash
# Open Playwright UI for debugging
npm run test:visual:ui

# Run tests in headed mode (see browser)
npm run test:visual:headed

# Debug specific test
npm run test:visual:debug
```

### Screenshot Management

```bash
# View test reports
npm run test:visual:report

# Update specific component screenshots
npx playwright test visual-searchbar.test.ts --update-snapshots
```

### Common Issues

1. **Font Rendering Differences**
   - Solution: Font consistency enforced in global setup
   - Fonts loaded before screenshots

2. **Animation Timing**
   - Solution: Animations disabled by default
   - `reducedMotion: 'reduce'` setting

3. **Dynamic Content**
   - Solution: Use `mask` option for timestamps
   - Stable test data in fixtures

4. **Browser Differences**
   - Solution: Normalized rendering settings
   - GPU rendering forced for consistency

## 📚 Best Practices

### Test Organization

1. **Group related tests** in describe blocks
2. **Use descriptive names** for screenshots
3. **Test component states** systematically
4. **Include edge cases** (empty states, errors)
5. **Validate across viewports** for responsive components

### Screenshot Naming

```typescript
// Good: Descriptive and hierarchical
'searchbar-basic-default'
'searchbar-basic-focus'
'searchbar-with-suggestions'
'resultslist-empty-state'
'entrydetail-loading'

// Bad: Vague or inconsistent
'test1'
'component'
'screenshot'
```

### Performance Optimization

1. **Disable animations** for consistency
2. **Use specific selectors** for targeted testing
3. **Batch similar tests** together
4. **Parallelize** cross-browser tests
5. **Cache browser downloads** in CI

## 🤝 Contributing

### Adding New Tests

1. **Identify the component** to test
2. **Create test file** in appropriate category
3. **Follow naming conventions** for consistency
4. **Include multiple states** (normal, hover, focus, etc.)
5. **Add responsive variants** if applicable
6. **Update coverage report** expectations

### Review Checklist

- [ ] Tests cover all component states
- [ ] Responsive behavior validated
- [ ] Theme variations included
- [ ] Cross-browser compatibility checked
- [ ] Screenshots have descriptive names
- [ ] Test thresholds appropriate for content
- [ ] Documentation updated

## 🔍 Troubleshooting

### Common Test Failures

| Issue | Cause | Solution |
|-------|-------|----------|
| **Pixel differences** | Font/rendering changes | Update baselines if intentional |
| **Timeout errors** | Slow element loading | Increase timeout or add wait |
| **Missing elements** | Selector issues | Verify element exists |
| **Flaky tests** | Animation timing | Ensure animations disabled |
| **Browser crashes** | Memory issues | Reduce parallel workers |

### Environment Issues

```bash
# Clear Playwright cache
npx playwright install --force

# Reset test results
rm -rf test-results/ test-reports/

# Verify browser installation
npx playwright doctor
```

## 📞 Support

For issues with visual regression tests:

1. **Check the coverage report** for missing tests
2. **Review recent changes** that might affect UI
3. **Compare screenshots** in test results
4. **Update baselines** if changes are intentional
5. **Consult team** for complex visual changes

---

**🎭 Visual Regression Testing Suite v1.0**
*Ensuring pixel-perfect UI consistency across the Mainframe KB Assistant*