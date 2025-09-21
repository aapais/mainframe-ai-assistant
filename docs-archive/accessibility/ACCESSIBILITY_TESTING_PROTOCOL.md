# ACCESSIBILITY TESTING PROTOCOL
## WCAG 2.1 AA Compliance Testing
### Mainframe KB Assistant

---

## OVERVIEW

This protocol ensures comprehensive accessibility testing for the Knowledge Base interface, focusing on WCAG 2.1 AA compliance and support for assistive technologies.

## PRE-TESTING SETUP

### Required Tools
```
Screen Readers:
- NVDA (free) - Primary testing tool
- JAWS (trial) - Enterprise standard
- VoiceOver (macOS) - For Mac testing

Browser Extensions:
- axe DevTools
- WAVE Web Accessibility Evaluator
- Colour Contrast Analyser

Hardware:
- Standard keyboard (no mouse)
- High contrast monitor setting
- Mobile devices for touch testing
```

### Test Environment
```
Browsers: Chrome, Firefox, Edge
Operating Systems: Windows 10/11, macOS
Screen Resolutions: 1920x1080, 1366x768, mobile viewports
Zoom Levels: 100%, 200%, 400%
```

---

## TESTING CHECKLIST

### A. PERCEIVABLE (WCAG Principle 1)

#### 1.1 Text Alternatives
```
□ All images have appropriate alt text
□ Decorative images have empty alt attributes
□ Complex images have detailed descriptions
□ Icon buttons have accessible names
□ Success rate indicators have text equivalents

Test Steps:
1. Turn off images in browser
2. Navigate with screen reader
3. Verify all content still accessible
```

#### 1.3 Adaptable Content
```
□ Proper heading hierarchy (h1 → h2 → h3)
□ Form labels programmatically associated
□ Content readable without CSS
□ Meaningful sequence maintained
□ Instructions not solely color/shape dependent

Test Steps:
1. Disable CSS stylesheets
2. Check content reading order
3. Verify form label associations
4. Test with screen reader navigation
```

#### 1.4 Distinguishable
```
□ Color contrast ratio ≥ 4.5:1 (normal text)
□ Color contrast ratio ≥ 3:1 (large text)
□ Text resizable up to 200% without loss
□ No information conveyed by color alone
□ Audio/video controls accessible

Test Steps:
1. Use Colour Contrast Analyser tool
2. Test zoom functionality
3. Verify color-blind accessibility
4. Check focus indicators visibility
```

### B. OPERABLE (WCAG Principle 2)

#### 2.1 Keyboard Accessible
```
□ All functionality available via keyboard
□ No keyboard traps (can navigate away)
□ Logical tab order throughout interface
□ Keyboard shortcuts don't conflict
□ Custom shortcuts documented

Test Steps:
1. Disconnect mouse
2. Tab through entire interface
3. Test all interactive elements
4. Verify escape key functionality
5. Test custom shortcuts (/, Ctrl+N, etc.)
```

#### 2.2 Enough Time
```
□ No time limits on form completion
□ Search results don't auto-refresh
□ User can extend time limits if any exist
□ No auto-advancing content

Test Steps:
1. Fill form slowly
2. Leave search results open
3. Check for timeout warnings
```

#### 2.4 Navigable
```
□ Skip links present and functional
□ Page titles descriptive
□ Focus order logical
□ Link purpose clear from context
□ Multiple ways to find information
□ Headings and labels descriptive

Test Steps:
1. Test skip links with keyboard
2. Navigate with headings (H key in screen reader)
3. Test search and browse functionality
4. Verify modal focus management
```

### C. UNDERSTANDABLE (WCAG Principle 3)

#### 3.1 Readable
```
□ Page language identified (lang attribute)
□ Language changes identified
□ Technical terms explained
□ Abbreviations expanded on first use

Test Steps:
1. Check HTML lang attributes
2. Review technical terminology
3. Test with screen reader pronunciation
```

#### 3.2 Predictable
```
□ Navigation consistent across pages
□ Interface components behave predictably
□ Context changes don't happen unexpectedly
□ Form submission requires explicit user action

Test Steps:
1. Navigate between different sections
2. Test form interactions
3. Verify modal behaviors
4. Check search result interactions
```

#### 3.3 Input Assistance
```
□ Form validation errors clearly identified
□ Error suggestions provided where possible
□ Labels/instructions provided for user input
□ Errors associated with specific fields
□ Success confirmations provided

Test Steps:
1. Submit empty form
2. Test invalid input formats
3. Verify error announcements
4. Check success messages
5. Test error recovery process
```

### D. ROBUST (WCAG Principle 4)

#### 4.1 Compatible
```
□ Valid HTML markup
□ ARIA attributes used correctly
□ Screen reader compatibility tested
□ Voice control software compatible
□ Custom elements properly labeled

Test Steps:
1. Validate HTML markup
2. Test with multiple screen readers
3. Test with Dragon NaturallySpeaking
4. Check ARIA implementation
```

---

## SCREEN READER TESTING PROCEDURES

### NVDA Testing Protocol

#### Setup
```
1. Download latest NVDA version
2. Configure speech rate to normal
3. Enable browse mode
4. Test in Chrome and Firefox
```

#### Test Scenarios

**Scenario 1: Search Workflow**
```
Steps:
1. Navigate to search input (should announce "Search knowledge base, edit")
2. Type search query
3. Navigate to results (should announce result count)
4. Select first result (should announce title and category)
5. Navigate to solution details

Expected Announcements:
- "Search knowledge base, edit text"
- "Searching knowledge base" (during search)
- "10 results found for VSAM Status 35"
- "VSAM Status 35 - File Not Found, VSAM category, 95% match"
- "Problem: Job abends with VSAM status code 35..."
```

**Scenario 2: Form Completion**
```
Steps:
1. Open add entry modal
2. Navigate through all form fields
3. Submit with missing data
4. Fix validation errors
5. Submit successfully

Expected Announcements:
- "Add Knowledge Entry dialog"
- "Title, edit text, required"
- "Error: Title is required"
- "Entry saved successfully"
```

### JAWS Testing Protocol

#### Setup
```
1. Use JAWS trial version
2. Configure for web browsing
3. Enable forms mode
4. Test virtual cursor navigation
```

#### Focus Areas
- Form navigation and completion
- Error identification and recovery
- Table/list navigation
- Button and link identification

---

## KEYBOARD NAVIGATION TESTING

### Full Keyboard Test

#### Tab Order Verification
```
Expected Tab Order:
1. Skip links
2. Search input
3. Category filters
4. Results list items
5. Selected entry details
6. Rating buttons
7. Add entry button

Test Steps:
1. Press Tab from page load
2. Verify logical progression
3. Ensure no focus traps
4. Test Shift+Tab backwards
```

#### Keyboard Shortcuts Test
```
Shortcuts to Test:
- "/" - Focus search input
- "Ctrl+N" - Add new entry
- "Escape" - Close modals/clear selection
- "Ctrl+R" - Refresh entries
- "F1" - Show keyboard help

Test Steps:
1. Test each shortcut from different contexts
2. Verify shortcuts work in forms
3. Check conflict with browser shortcuts
```

#### Focus Indicator Test
```
Requirements:
- Visible focus indicators on all interactive elements
- High contrast focus indicators
- Focus indicators work with high contrast mode
- Focus remains visible during interactions

Test Steps:
1. Tab through all elements
2. Enable high contrast mode
3. Test focus visibility at 200% zoom
4. Verify focus during mouse interactions
```

---

## MOBILE ACCESSIBILITY TESTING

### Touch Target Testing
```
Requirements:
- Minimum 44px x 44px touch targets
- Adequate spacing between targets
- Touch targets work with switch control
- Gestures have keyboard alternatives

Test Steps:
1. Test on iOS/Android devices
2. Enable switch control/assistive touch
3. Verify touch target sizes
4. Test gesture alternatives
```

### Mobile Screen Reader Testing
```
iOS VoiceOver:
- Test swipe navigation
- Verify rotor controls
- Test voice control commands

Android TalkBack:
- Test gesture navigation
- Verify reading order
- Test voice commands
```

---

## AUTOMATED TESTING INTEGRATION

### axe-core Integration
```javascript
// Add to test suite
const axe = require('axe-core');

describe('Accessibility Tests', () => {
  test('should have no accessibility violations', async () => {
    const results = await axe.run();
    expect(results.violations).toHaveLength(0);
  });
});
```

### Lighthouse Accessibility Audit
```bash
# Command line testing
lighthouse http://localhost:3000 --only-categories=accessibility --output=html
```

---

## REPORTING TEMPLATE

### Issue Report Format
```
Issue ID: ACC-001
WCAG Reference: 1.4.3 (Color Contrast)
Severity: High
Browser: Chrome 120
Assistive Technology: NVDA

Description:
Secondary text color #6b7280 on white background fails WCAG AA contrast requirements (2.8:1 ratio, requires 4.5:1).

Location:
- Entry list usage statistics
- Form help text
- Modal secondary information

Reproduction Steps:
1. Open KB Assistant
2. Search for any entry
3. Use Colour Contrast Analyser on usage statistics text

Expected Result:
Text color should meet 4.5:1 contrast ratio

Actual Result:
Current ratio is 2.8:1

Recommended Fix:
Change color to #4b5563 (meets 7:1 ratio)

Priority: High (affects readability for visually impaired users)
```

---

## COMPLIANCE VERIFICATION

### Final Checklist
```
□ All automated tests pass
□ Manual testing completed
□ Screen reader testing verified
□ Keyboard navigation functional
□ Mobile accessibility confirmed
□ Color contrast requirements met
□ Form accessibility validated
□ Error handling accessible
□ Documentation updated
□ Training materials prepared
```

### Sign-off Requirements
```
□ Accessibility specialist approval
□ Development team verification
□ User testing with disabled users completed
□ Legal compliance review (if required)
□ Final audit report generated
```

This protocol ensures comprehensive accessibility testing that meets enterprise accessibility standards while supporting the critical workflows of mainframe support teams.