# Keyboard Navigation Guide

## Overview

This guide documents all keyboard navigation patterns, shortcuts, and accessibility features implemented in the Mainframe Knowledge Base Assistant. The application follows WCAG 2.1 AA guidelines and WAI-ARIA best practices for keyboard accessibility.

## Universal Keyboard Shortcuts

### Application-Wide Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `Tab` | Move focus to next interactive element | Global |
| `Shift + Tab` | Move focus to previous interactive element | Global |
| `Enter` | Activate focused element | Buttons, links, form controls |
| `Space` | Activate buttons, toggle checkboxes | Buttons, checkboxes |
| `Escape` | Cancel current action, close modals | Modals, dropdowns, forms |
| `Ctrl + S` | Save current form or entry | Forms |
| `Ctrl + Z` | Undo last action | Forms with undo support |
| `Ctrl + F` | Focus search input | Global |
| `F1` | Open help dialog | Global |
| `?` | Show keyboard shortcuts help | Global |

### Navigation Shortcuts

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl + Home` | Go to top of page | Moves focus to first interactive element |
| `Ctrl + End` | Go to bottom of page | Moves focus to last interactive element |
| `Alt + 1` | Skip to main content | Bypass navigation |
| `Alt + 2` | Skip to search | Jump directly to search |
| `Alt + 3` | Skip to navigation | Jump to main navigation |

## Component-Specific Keyboard Patterns

### Search Interface

#### Search Input
- **Focus**: `Tab` to search input
- **Search**: Type query and press `Enter`
- **Clear**: `Escape` clears current input
- **Suggestions**: `Arrow Down/Up` to navigate, `Enter` to select

#### Search Filters
- **Open filters**: `Tab` to filter button, press `Enter` or `Space`
- **Navigate categories**: `Arrow keys` within filter panel
- **Select category**: `Enter` or `Space`
- **Close filters**: `Escape`

#### Search Results
- **Navigate results**: `Tab` through result items
- **Open result**: `Enter` on focused result
- **Sort options**: `Tab` to sort dropdown, `Arrow keys` to change

### Forms

#### Knowledge Base Entry Form
- **Quick save**: `Ctrl + S`
- **Quick submit**: `Ctrl + Enter`
- **Save draft**: `Ctrl + D`
- **Cancel**: `Escape`
- **Reset form**: `Ctrl + R`

#### Field Navigation
- **Next field**: `Tab`
- **Previous field**: `Shift + Tab`
- **Multi-line fields**: `Tab` to exit, `Ctrl + Tab` for tab character

#### Tag Management
- **Add tag**: Type in tag input, press `Enter`
- **Remove tag**: `Tab` to tag remove button, press `Enter`
- **Navigate tags**: `Arrow keys` between tag remove buttons

### Data Tables

#### Grid Navigation
| Shortcut | Action | Description |
|----------|--------|-------------|
| `Arrow keys` | Navigate cells | Move focus between adjacent cells |
| `Home` | First cell in row | Move to beginning of current row |
| `End` | Last cell in row | Move to end of current row |
| `Ctrl + Home` | First cell in table | Move to top-left cell |
| `Ctrl + End` | Last cell in table | Move to bottom-right cell |
| `Page Up` | Previous page | Scroll up one page |
| `Page Down` | Next page | Scroll down one page |
| `Enter` | Activate cell | Open cell for editing or trigger action |
| `F2` | Edit cell | Enter edit mode for current cell |

#### Column Operations
- **Sort column**: `Tab` to column header, press `Enter`
- **Resize column**: Focus header, use `Arrow keys` with `Shift`
- **Select all**: `Ctrl + A` (if selection is supported)

### Modal Dialogs

#### Focus Management
- **Open modal**: Focus automatically moves to first interactive element
- **Navigate within modal**: `Tab` and `Shift + Tab` cycle through modal elements only
- **Close modal**: `Escape` key
- **Confirm action**: `Enter` on confirm button
- **Cancel action**: `Escape` or `Tab` to cancel button, press `Enter`

#### Modal Types
1. **Confirmation Dialogs**
   - Default focus on confirm button
   - `Enter` confirms, `Escape` cancels

2. **Form Dialogs**
   - Focus on first input field
   - Standard form navigation applies

3. **Information Dialogs**
   - Focus on first actionable element (usually "OK" button)
   - `Enter` or `Escape` closes dialog

### Custom Components

#### Dropdown/Combobox
- **Open dropdown**: `Arrow Down` or `Enter`
- **Navigate options**: `Arrow Up/Down`
- **Select option**: `Enter`
- **Close dropdown**: `Escape`
- **Type-ahead**: Start typing to filter options
- **Jump to option**: Type first letter(s) of option

#### Tab Panels
- **Navigate tabs**: `Arrow Left/Right`
- **First tab**: `Home`
- **Last tab**: `End`
- **Activate tab**: `Enter` or `Space`
- **Navigate to panel**: `Tab` after activating tab

#### Menu Systems
- **Open menu**: `Enter` or `Space` on menu button
- **Navigate items**: `Arrow Up/Down`
- **Open submenu**: `Arrow Right`
- **Close submenu**: `Arrow Left`
- **Close menu**: `Escape`
- **Select item**: `Enter`

## Focus Management

### Focus Indicators
All interactive elements display visible focus indicators that meet WCAG AA contrast requirements (minimum 3:1 ratio).

#### Focus Styles
- **Default**: 2px solid blue outline with 2px offset
- **High contrast mode**: Enhanced outline with increased thickness
- **Error states**: Red outline for invalid fields
- **Success states**: Green outline for successful actions

### Focus Order
Focus moves in logical reading order:
1. **Skip links** (if present)
2. **Header navigation**
3. **Main content area**
4. **Primary actions**
5. **Secondary actions**
6. **Footer links**

### Focus Trapping
Modal dialogs and dropdowns implement focus trapping:
- Focus cannot leave the component via `Tab` navigation
- `Shift + Tab` from first element moves to last element
- `Tab` from last element moves to first element
- `Escape` exits the component and restores previous focus

## Skip Navigation

### Skip Links
The application provides skip links for keyboard users:

| Skip Link | Target | Purpose |
|-----------|--------|---------|
| Skip to main content | `#main-content` | Bypass header and navigation |
| Skip to search | `#search-input` | Quick access to search |
| Skip to navigation | `#main-nav` | Access navigation menu |

Skip links are:
- Visually hidden until focused
- First focusable elements on the page
- Clearly labeled with destination
- Functional for both keyboard and screen reader users

## Accessibility Features

### Screen Reader Support
- **Live regions** announce dynamic content changes
- **ARIA labels** provide context for interactive elements
- **Landmark roles** structure page for navigation
- **Heading hierarchy** provides content outline

### Error Handling
Error messages are:
- Announced via `aria-live` regions
- Associated with form fields via `aria-describedby`
- Keyboard accessible for correction
- Clearly worded with correction instructions

### Loading States
Loading indicators:
- Announced to screen readers via `aria-live="polite"`
- Do not interfere with keyboard navigation
- Provide clear completion notifications

## Browser Compatibility

### Supported Browsers
- Chrome 90+ (Windows, Mac, Linux)
- Firefox 88+ (Windows, Mac, Linux)
- Safari 14+ (Mac)
- Edge 90+ (Windows)

### Known Limitations
- Internet Explorer: Limited support for modern ARIA patterns
- Safari: Some focus management differences in modals
- Mobile browsers: Touch and keyboard combinations vary

## Testing

### Automated Testing
- **Playwright tests** validate keyboard navigation paths
- **axe-core integration** checks ARIA compliance
- **Focus order testing** ensures logical progression
- **Keyboard shortcut validation** confirms functionality

### Manual Testing Checklist

#### Basic Navigation
- [ ] Can navigate entire application using only keyboard
- [ ] Focus indicators are always visible
- [ ] Focus order is logical and predictable
- [ ] No keyboard traps (except intentional focus trapping)

#### Component Testing
- [ ] All buttons activate with `Enter` and `Space`
- [ ] Form fields accept appropriate input methods
- [ ] Dropdowns open and navigate with arrow keys
- [ ] Modal dialogs trap focus correctly
- [ ] Tables support grid navigation patterns

#### Error Scenarios
- [ ] Form validation errors are keyboard accessible
- [ ] Error messages are announced to screen readers
- [ ] Users can navigate to and correct errors
- [ ] Error states don't break keyboard navigation

## Implementation Notes

### Code Examples

#### Focus Management
```typescript
// Trap focus within modal
const trapFocus = (container: HTMLElement) => {
  const focusableElements = container.querySelectorAll(
    'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
  );

  const firstElement = focusableElements[0] as HTMLElement;
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

  container.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  });
};
```

#### Keyboard Shortcuts
```typescript
// Global keyboard shortcut handler
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey) {
    switch (e.key) {
      case 's':
        e.preventDefault();
        handleSave();
        break;
      case 'f':
        e.preventDefault();
        focusSearch();
        break;
    }
  }
});
```

#### ARIA Live Regions
```typescript
// Announce dynamic content changes
const announceToScreenReader = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
};
```

## Troubleshooting

### Common Issues

1. **Focus not visible**
   - Check CSS focus styles
   - Verify outline is not being removed
   - Test in high contrast mode

2. **Tab order incorrect**
   - Review HTML structure
   - Check tabindex values
   - Consider CSS positioning effects

3. **Keyboard shortcuts not working**
   - Verify event listeners are attached
   - Check for conflicting browser shortcuts
   - Ensure proper scope and context

4. **Screen reader announcements missing**
   - Validate ARIA live regions
   - Check aria-label and aria-describedby
   - Test with actual screen readers

### Debug Commands

```javascript
// Check current focus
console.log('Focused element:', document.activeElement);

// List all focusable elements
const focusable = document.querySelectorAll(
  'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
);
console.log('Focusable elements:', focusable);

// Test focus order
let index = 0;
const testFocus = () => {
  if (index < focusable.length) {
    focusable[index].focus();
    console.log(`Focused element ${index}:`, focusable[index]);
    index++;
    setTimeout(testFocus, 1000);
  }
};
testFocus();
```

## Resources

### Documentation
- [WAI-ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Keyboard Navigation](https://webaim.org/articles/keyboard/)

### Testing Tools
- [axe-core](https://github.com/dequelabs/axe-core) - Automated accessibility testing
- [NVDA](https://www.nvaccess.org/) - Free screen reader for testing
- [Lighthouse](https://developers.google.com/web/tools/lighthouse) - Accessibility auditing

### Browser Extensions
- [axe DevTools](https://www.deque.com/axe/devtools/) - Browser accessibility testing
- [WAVE](https://wave.webaim.org/extension/) - Web accessibility evaluation
- [Accessibility Insights](https://accessibilityinsights.io/) - Microsoft accessibility testing

---

*Last updated: September 15, 2025*
*Version: 1.0.0*