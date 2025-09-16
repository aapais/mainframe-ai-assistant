# Screen Reader Optimization Guide

This guide provides comprehensive documentation for the screen reader optimization system implemented in the mainframe-ai-assistant project.

## Overview

The screen reader optimization system provides:

- **Live region management** for dynamic content announcements
- **Proper heading hierarchy** across all pages
- **Screen reader-only content** where needed
- **Optimized announcement strategies** for updates
- **Accessible loading and progress indicators**
- **Proper form validation announcements**

## Components Overview

### Core Utilities

#### 1. Screen Reader Utils (`screenReaderUtils.ts`)

The core utility module providing:

```typescript
import {
  EnhancedLiveRegionManager,
  HeadingManager,
  ScreenReaderTextUtils,
  getScreenReaderManager
} from '../utils/screenReaderUtils';
```

**Key Features:**
- Multiple specialized live regions
- Smart announcement queuing and deduplication
- Predefined message templates
- Heading hierarchy management
- Text utility functions for screen readers

#### 2. Accessibility Hook (`useScreenReaderAnnouncements.ts`)

React hook for easy screen reader integration:

```typescript
import { useScreenReaderAnnouncements } from '../hooks/useScreenReaderAnnouncements';

const {
  announce,
  announceLoading,
  announceSearchResults
} = useScreenReaderAnnouncements();
```

### Components

#### 1. ScreenReaderOnly Component

For content only visible to screen readers:

```tsx
import { ScreenReaderOnly, ScreenReaderAlert, ScreenReaderStatus } from './ScreenReaderOnly';

// Basic hidden content
<ScreenReaderOnly>
  This text is only for screen readers
</ScreenReaderOnly>

// Status announcements
<ScreenReaderStatus>
  Form saved successfully
</ScreenReaderStatus>

// Alert announcements
<ScreenReaderAlert>
  Error: Form validation failed
</ScreenReaderAlert>
```

#### 2. LiveRegion Component

For managed ARIA live regions:

```tsx
import { LiveRegion, StatusLiveRegion, AlertLiveRegion } from './LiveRegion';

// Basic live region
<LiveRegion priority="polite" autoClear={true}>
  {dynamicMessage}
</LiveRegion>

// Specialized regions
<StatusLiveRegion>{statusMessage}</StatusLiveRegion>
<AlertLiveRegion>{errorMessage}</AlertLiveRegion>
```

#### 3. AccessibleLoadingIndicator Component

Screen reader optimized loading states:

```tsx
import { AccessibleLoadingIndicator } from './AccessibleLoadingIndicator';

<AccessibleLoadingIndicator
  loading={isLoading}
  message="Loading knowledge base"
  progress={completionPercentage}
  announceProgress={true}
  context="search results"
/>
```

#### 4. AccessibleFormValidation Component

Comprehensive form accessibility:

```tsx
import { AccessibleFormValidation, AccessibleFormField } from './AccessibleFormValidation';

<AccessibleFormValidation
  errors={validationErrors}
  showSummary={true}
  announceImmediately={true}
>
  <AccessibleFormField
    name="title"
    label="Entry Title"
    required={true}
    validation={fieldValidation}
    announceValidation={true}
  />
</AccessibleFormValidation>
```

## Implementation Guide

### Step 1: Basic Setup

1. **Import core utilities:**

```typescript
import { getScreenReaderManager } from '../utils/screenReaderUtils';
import { useScreenReaderAnnouncements } from '../hooks/useScreenReaderAnnouncements';
```

2. **Initialize in your app:**

```tsx
// In your main App component
import { LiveRegionProvider } from './components/LiveRegion';

function App() {
  return (
    <LiveRegionProvider>
      {/* Your app content */}
    </LiveRegionProvider>
  );
}
```

### Step 2: Adding Announcements

#### Simple Announcements

```tsx
const { announce } = useScreenReaderAnnouncements();

// Basic announcement
announce("Search completed", "polite");

// Urgent announcement
announce("Error occurred", "assertive");
```

#### Specialized Announcements

```tsx
const {
  announceLoading,
  announceSearchResults,
  announceError
} = useScreenReaderAnnouncements();

// Loading state
announceLoading("Searching knowledge base...");

// Search results
announceSearchResults(25, "error codes");

// Errors
announceError("Connection failed");
```

### Step 3: Form Accessibility

```tsx
import { useAccessibleFormValidation } from './components/AccessibleFormValidation';

const {
  errors,
  setFieldError,
  validateForm,
  hasErrors
} = useAccessibleFormValidation();

// Set field error
setFieldError('email', {
  field: 'Email',
  message: 'Please enter a valid email address'
});

// Validate entire form
const isValid = validateForm({
  email: [{ field: 'Email', message: 'Required field' }]
});
```

### Step 4: Loading States

```tsx
import { useAccessibleLoading } from './components/AccessibleLoadingIndicator';

const {
  loading,
  startLoading,
  updateProgress,
  stopLoading
} = useAccessibleLoading();

// Start loading
startLoading("Processing request...");

// Update progress
updateProgress(50, 100, "Processing files");

// Complete
stopLoading("Processing complete");
```

### Step 5: Table Accessibility

```tsx
import { AccessibleKBTable } from './components/AccessibleKBTable';

<AccessibleKBTable
  entries={kbEntries}
  selectedEntryId={selectedId}
  onEntrySelect={handleSelect}
  caption="Knowledge Base Search Results"
  announceUpdates={true}
  sortConfig={{ key: 'title', direction: 'asc' }}
  onSortChange={handleSort}
/>
```

## Best Practices

### 1. Announcement Timing

- Use **"polite"** for non-urgent updates (search results, form saves)
- Use **"assertive"** for urgent alerts (errors, critical status changes)
- Avoid announcement spam - debounce rapid updates

### 2. Content Guidelines

- Keep announcements **concise and clear**
- Use **consistent terminology** throughout the app
- Provide **contextual information** (e.g., "3 of 10 results")
- Avoid **redundant information** already visible to screen readers

### 3. Form Accessibility

- Always provide **field labels**
- Use **error summary** components for multiple errors
- Announce **validation changes** immediately
- Group **related fields** with fieldset/legend

### 4. Table Accessibility

- Always provide **table captions**
- Use **column and row headers** appropriately
- Announce **table updates** when content changes
- Provide **keyboard navigation** instructions

### 5. Loading States

- Announce **loading start** and completion
- For **determinate progress**, announce percentage milestones
- Provide **context** about what's loading
- Allow **cancellation** when possible

## Advanced Usage

### Custom Live Regions

```tsx
import { EnhancedLiveRegionManager } from '../utils/screenReaderUtils';

// Create custom manager with specific messages
const customManager = EnhancedLiveRegionManager.getInstance({
  loading: 'Processing your mainframe request...',
  error: 'Mainframe operation failed'
});

// Use custom announcements
customManager.announceLoading();
customManager.announceError('Connection timeout');
```

### Heading Management

```tsx
import { HeadingManager } from '../utils/screenReaderUtils';

// Set current page heading level
HeadingManager.setLevel(1);

// Get appropriate heading tag
const HeadingTag = HeadingManager.getHeadingTag(); // h1

// Push/pop for nested sections
HeadingManager.pushLevel(2);
const SubHeading = HeadingManager.getHeadingTag(); // h2
HeadingManager.popLevel();
```

### Screen Reader Text Utilities

```tsx
import { ScreenReaderTextUtils } from '../utils/screenReaderUtils';

// Create descriptive text
const loadingText = ScreenReaderTextUtils.createLoadingDescription(
  "search results",
  75 // progress percentage
);

// Create search results description
const resultsText = ScreenReaderTextUtils.createSearchResultsDescription(
  42, // count
  "error codes", // query
  1.23 // time in seconds
);

// Create error description
const errorText = ScreenReaderTextUtils.createErrorDescription(
  "Email field",
  ["Please enter a valid email", "Email is required"]
);
```

## Testing

### Manual Testing with Screen Readers

1. **NVDA (Windows)** - Free, most common
2. **JAWS (Windows)** - Popular commercial option
3. **VoiceOver (macOS)** - Built into Mac
4. **Orca (Linux)** - Built into most Linux distributions

### Testing Checklist

- [ ] All dynamic content is announced
- [ ] Form errors are clearly communicated
- [ ] Loading states provide progress information
- [ ] Tables are navigable and well-described
- [ ] Keyboard navigation works throughout
- [ ] No announcement spam or redundancy
- [ ] Urgent vs. non-urgent content is properly prioritized

### Automated Testing

The system includes built-in validation:

```typescript
import { AccessibilityTester } from '../utils/accessibility';

// Run accessibility audit
const audit = AccessibilityTester.audit(document.body);
console.log(`Accessibility score: ${audit.score}/100`);
console.log('Errors:', audit.errors);
console.log('Warnings:', audit.warnings);
```

## Troubleshooting

### Common Issues

1. **Announcements not heard**
   - Check if live regions are properly initialized
   - Verify ARIA attributes are correct
   - Ensure content changes trigger announcements

2. **Too many announcements**
   - Enable deduplication in announcement settings
   - Use appropriate timing delays
   - Group related announcements

3. **Form validation not announced**
   - Verify error IDs are properly linked to fields
   - Check ARIA attributes on form elements
   - Ensure validation triggers are working

4. **Table navigation issues**
   - Verify column and row headers
   - Check ARIA attributes on table elements
   - Ensure keyboard handlers are working

### Debug Mode

Enable debug logging:

```typescript
// In development, enable detailed logging
const manager = getScreenReaderManager({
  debug: process.env.NODE_ENV === 'development'
});
```

## Performance Considerations

- Live regions are **lightweight** and optimized for performance
- Announcements are **debounced** to prevent spam
- Components use **React.memo()** and **useMemo()** for optimization
- Large tables support **virtualization** for better performance

## Browser Support

The system supports all modern browsers and screen readers:

- **Windows**: NVDA, JAWS, Dragon NaturallySpeaking
- **macOS**: VoiceOver
- **Linux**: Orca
- **Mobile**: iOS VoiceOver, Android TalkBack

## Contributing

When adding new components or features:

1. **Always consider screen reader impact**
2. **Add appropriate ARIA attributes**
3. **Test with actual screen readers**
4. **Update this documentation**
5. **Include accessibility tests**

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Screen Reader Testing](https://webaim.org/articles/screenreader_testing/)
- [Screen Reader User Survey](https://webaim.org/projects/screenreadersurvey9/)

---

For questions or issues with the screen reader optimization system, please check the existing documentation or create an issue in the project repository.