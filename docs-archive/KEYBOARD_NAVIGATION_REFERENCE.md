# KEYBOARD NAVIGATION REFERENCE GUIDE
## Mainframe AI Assistant - Complete Keyboard Access Documentation

**Last Updated:** September 15, 2025
**Version:** 1.2
**Compliance:** WCAG 2.1 AA Level
**Target Users:** Keyboard-only users, Screen reader users, Power users

---

## 🎹 QUICK REFERENCE CARD

### **GLOBAL SHORTCUTS (Available Everywhere)**

| **Shortcut** | **Action** | **Notes** |
|--------------|------------|-----------|
| `/` | Focus search input | Works from any page |
| `Ctrl+N` | Add new entry | Opens modal dialog |
| `Ctrl+R` | Refresh current view | Reloads data |
| `F1` | Show this help guide | Context-sensitive help |
| `Escape` | Close modal/Clear selection | Universal dismiss |
| `Alt+M` | Main navigation menu | Skip to primary navigation |
| `Alt+S` | Search and filters | Skip to search section |
| `Alt+R` | Results and content | Skip to main content area |

### **NAVIGATION SHORTCUTS**

| **Shortcut** | **Action** | **Context** |
|--------------|------------|-------------|
| `Tab` | Next interactive element | Universal |
| `Shift+Tab` | Previous interactive element | Universal |
| `Enter` | Activate button/link | Buttons, links |
| `Space` | Activate button/checkbox | Buttons, checkboxes |
| `Arrow Keys` | Navigate within components | Lists, menus, tabs |
| `Home` | First item in list | Lists, tables |
| `End` | Last item in list | Lists, tables |
| `Page Up` | Scroll up by page | Long lists |
| `Page Down` | Scroll down by page | Long lists |

---

## 🔍 SEARCH INTERFACE NAVIGATION

### **Search Input and Suggestions**

#### **Basic Search**
```
Tab Order:
1. Search input field
2. Clear search button (if text present)
3. Advanced search toggle
4. Search suggestions (if visible)
```

#### **Keyboard Interactions**
| **Key** | **Action** |
|---------|------------|
| `↓` | Next search suggestion |
| `↑` | Previous search suggestion |
| `Enter` | Select suggestion or search |
| `Escape` | Clear suggestions and return to input |
| `Ctrl+A` | Select all text in search input |
| `Ctrl+X` | Cut search text |
| `Ctrl+V` | Paste into search |

#### **Search Suggestions Navigation**
```
Example workflow:
1. Type "VSAM" in search input
2. Press ↓ to enter suggestions list
3. Use ↑/↓ to navigate suggestions
4. Press Enter to select
5. Press Escape to return to input
```

### **Advanced Search Panel**

#### **Filter Categories**
```
Tab Order:
1. Category filter buttons
2. Date range selector
3. Priority dropdown
4. Tags input field
5. Clear filters button
6. Apply filters button
```

#### **Category Filter Navigation**
| **Key** | **Action** |
|---------|------------|
| `Tab` | Focus next category |
| `Shift+Tab` | Focus previous category |
| `Space` | Toggle category selection |
| `Enter` | Apply category filter |
| `Ctrl+A` | Select all categories |
| `Ctrl+D` | Deselect all categories |

---

## 📋 RESULTS LIST NAVIGATION

### **Results Table Structure**

#### **Column Headers (Interactive)**
```
Sortable Columns:
1. Title (aria-sort: none|ascending|descending)
2. Category (aria-sort: none|ascending|descending)
3. Priority (aria-sort: none|ascending|descending)
4. Last Modified (aria-sort: none|ascending|descending)
5. Success Rate (aria-sort: none|ascending|descending)
```

#### **Sorting Shortcuts**
| **Key** | **Action** |
|---------|------------|
| `Enter` or `Space` | Toggle sort direction |
| `1` | Sort by Title |
| `2` | Sort by Category |
| `3` | Sort by Priority |
| `4` | Sort by Date |
| `5` | Sort by Success Rate |

### **Results Row Navigation**

#### **Row Selection**
```
Navigation Pattern:
1. Use ↑/↓ to move between rows
2. Use Space to select/deselect row
3. Use Ctrl+Space for multi-select
4. Use Shift+↑/↓ for range selection
5. Use Enter to open selected entry
```

#### **Row Action Shortcuts**
| **Key** | **Action** |
|---------|------------|
| `Enter` | Open entry details |
| `Space` | Toggle row selection |
| `Ctrl+Space` | Add to selection |
| `Shift+Space` | Range select |
| `Delete` | Delete selected entries (with confirmation) |
| `Ctrl+C` | Copy entry data |
| `Ctrl+D` | Duplicate entry |

### **Entry Rating Interface**

#### **Rating Controls**
```
Rating Component Structure:
- 5 radio buttons (1-5 stars)
- Current rating announced
- Change announcements
```

#### **Rating Shortcuts**
| **Key** | **Action** |
|---------|------------|
| `1-5` | Set rating (1-5 stars) |
| `0` | Clear rating |
| `↑/→` | Increase rating |
| `↓/←` | Decrease rating |
| `Enter` | Confirm rating |
| `Escape` | Cancel rating change |

---

## 📝 FORM NAVIGATION

### **Add/Edit Entry Modal**

#### **Form Field Tab Order**
```
Standard Tab Sequence:
1. Modal close button (×)
2. Entry title input
3. Problem description textarea
4. Solution textarea
5. Category dropdown
6. Priority dropdown
7. Tags input field
8. Advanced options toggle
9. Save button
10. Cancel button
```

#### **Field-Specific Shortcuts**
| **Field** | **Shortcut** | **Action** |
|-----------|--------------|------------|
| **Any field** | `Ctrl+S` | Quick save |
| **Any field** | `Escape` | Cancel without saving |
| **Text areas** | `Ctrl+Enter` | Insert line break |
| **Dropdowns** | `Space` | Open dropdown |
| **Dropdowns** | `↑/↓` | Navigate options |
| **Tags** | `Tab` | Add new tag |
| **Tags** | `Backspace` | Delete last tag |

### **Tags Input Component**

#### **Tag Management**
```
Tag Input Workflow:
1. Type tag name
2. Press Tab or Enter to add
3. Use ← → to navigate existing tags
4. Press Delete to remove focused tag
5. Press Escape to exit tag editing
```

#### **Tag Navigation Shortcuts**
| **Key** | **Action** |
|---------|------------|
| `Tab` | Add current tag and focus next field |
| `Enter` | Add current tag and stay in input |
| `←` | Focus previous tag |
| `→` | Focus next tag |
| `Delete` | Remove focused tag |
| `Backspace` | Remove last tag (if input empty) |
| `,` | Add tag separator |

### **Form Validation and Errors**

#### **Error Navigation**
```
Error Handling Pattern:
1. Form submission triggers validation
2. Focus moves to first error field
3. Screen reader announces error count
4. Each field announces its error
5. Use Tab to navigate between errors
```

#### **Error Recovery Shortcuts**
| **Key** | **Action** |
|---------|------------|
| `F5` | Review all errors |
| `Ctrl+E` | Jump to next error |
| `Ctrl+Shift+E` | Jump to previous error |
| `Ctrl+R` | Reset form |
| `Ctrl+Z` | Undo last change |

---

## 📱 MODAL DIALOG NAVIGATION

### **Modal Focus Management**

#### **Standard Modal Behavior**
```
Modal Lifecycle:
1. Opening: Focus moves to first interactive element
2. Navigation: Tab cycles within modal only
3. Closing: Focus returns to trigger element
4. Escape: Always available to close
```

#### **Modal Navigation Pattern**
| **Key** | **Action** |
|---------|------------|
| `Tab` | Next element within modal |
| `Shift+Tab` | Previous element within modal |
| `Escape` | Close modal |
| `Enter` | Activate focused element |
| `Space` | Activate buttons/checkboxes |

### **Confirmation Dialogs**

#### **Confirmation Pattern**
```
Confirmation Dialog Structure:
1. Modal title (announced)
2. Description text
3. Primary action button (focused)
4. Secondary action button
5. Close button (×)
```

#### **Confirmation Shortcuts**
| **Key** | **Action** |
|---------|------------|
| `Enter` | Confirm action (primary button) |
| `Escape` | Cancel action |
| `Tab` | Navigate between options |
| `Space` | Activate focused button |
| `Y` | Quick "Yes" confirmation |
| `N` | Quick "No" cancellation |

---

## 🔄 DYNAMIC CONTENT NAVIGATION

### **Loading States**

#### **Loading Indicators**
```
Loading Announcement Pattern:
1. "Loading..." announced when starting
2. Progress updates for long operations
3. "Loading complete" or result count when finished
4. Error messages if loading fails
```

#### **Loading State Shortcuts**
| **Key** | **Action** |
|---------|------------|
| `Escape` | Cancel loading (if possible) |
| `R` | Retry loading |
| `S` | Skip to results (if partial load) |

### **Real-time Updates**

#### **Live Region Announcements**
```
Update Types:
- New entries added: "1 new entry added"
- Entries modified: "Entry 'VSAM Error' updated"
- Entries deleted: "Entry deleted"
- Search results: "5 results found"
- Status changes: "Entry status changed to resolved"
```

#### **Update Navigation**
| **Key** | **Action** |
|---------|------------|
| `Ctrl+U` | Check for updates |
| `Ctrl+L` | View update log |
| `Ctrl+Shift+R` | Force refresh all data |

---

## 📊 DATA TABLE NAVIGATION

### **Table Structure and Headers**

#### **Table Semantics**
```
Accessible Table Structure:
- Column headers (th) with scope="col"
- Row headers (th) with scope="row" where applicable
- Caption for table description
- Summary for complex tables
```

#### **Table Navigation Shortcuts**
| **Key** | **Action** |
|---------|------------|
| `Tab` | Next interactive cell |
| `Shift+Tab` | Previous interactive cell |
| `↑/↓` | Navigate rows |
| `←/→` | Navigate columns |
| `Home` | First cell in row |
| `End` | Last cell in row |
| `Ctrl+Home` | First cell in table |
| `Ctrl+End` | Last cell in table |

### **Cell Content Interaction**

#### **Cell Types and Actions**
```
Cell Content Types:
1. Text cells (read-only)
2. Link cells (navigable)
3. Button cells (actionable)
4. Edit cells (input fields)
5. Selection cells (checkboxes)
```

#### **Cell Interaction Shortcuts**
| **Key** | **Action** |
|---------|------------|
| `Enter` | Activate cell content |
| `Space` | Select/toggle (checkboxes) |
| `F2` | Edit cell (if editable) |
| `Escape` | Cancel cell edit |
| `Ctrl+Enter` | Save cell edit |

---

## 🎛️ SETTINGS AND PREFERENCES

### **Accessibility Preferences Panel**

#### **Preference Categories**
```
Settings Tab Order:
1. High contrast mode toggle
2. Reduced motion toggle
3. Screen reader optimizations
4. Keyboard shortcuts customization
5. Text size adjustment
6. Color theme selection
```

#### **Preference Shortcuts**
| **Key** | **Action** |
|---------|------------|
| `Ctrl+,` | Open preferences |
| `Ctrl+1-6` | Quick jump to preference tab |
| `Space` | Toggle setting |
| `Enter` | Apply changes |
| `Escape` | Cancel changes |
| `Ctrl+R` | Reset to defaults |

### **Keyboard Shortcut Customization**

#### **Shortcut Configuration**
```
Customization Workflow:
1. Navigate to shortcut in list
2. Press Enter to edit
3. Press desired key combination
4. Press Enter to confirm
5. Press Escape to cancel
```

#### **Customization Shortcuts**
| **Key** | **Action** |
|---------|------------|
| `Enter` | Edit selected shortcut |
| `Delete` | Remove custom shortcut |
| `Ctrl+D` | Duplicate shortcut |
| `Ctrl+R` | Reset shortcut to default |
| `Ctrl+S` | Save all changes |

---

## 🏃‍♂️ QUICK ACTIONS AND POWER USER FEATURES

### **Bulk Operations**

#### **Multi-Select Actions**
```
Bulk Selection Workflow:
1. Select first item (Space)
2. Hold Ctrl and select additional items
3. Or use Shift for range selection
4. Use bulk action shortcuts
```

#### **Bulk Action Shortcuts**
| **Key** | **Action** |
|---------|------------|
| `Ctrl+A` | Select all items |
| `Ctrl+Shift+A` | Deselect all items |
| `Ctrl+I` | Invert selection |
| `Delete` | Delete selected items |
| `Ctrl+C` | Copy selected items |
| `Ctrl+V` | Paste items |
| `Ctrl+X` | Cut selected items |

### **Search and Filter Combinations**

#### **Advanced Search Shortcuts**
| **Key** | **Action** |
|---------|------------|
| `Ctrl+F` | Advanced search |
| `Ctrl+Shift+F` | Search in results |
| `Ctrl+L` | Clear all filters |
| `Ctrl+H` | Search history |
| `Ctrl+B` | Bookmark search |
| `Ctrl+Shift+B` | Browse bookmarks |

### **Expert Mode Features**

#### **Developer/Admin Shortcuts**
| **Key** | **Action** |
|---------|------------|
| `Ctrl+Shift+I` | Open debug info |
| `Ctrl+Shift+D` | Download data export |
| `Ctrl+Shift+L` | View audit log |
| `Ctrl+Shift+S` | System status |
| `F12` | Developer tools (if enabled) |

---

## 🔧 TROUBLESHOOTING KEYBOARD NAVIGATION

### **Common Issues and Solutions**

#### **Focus Issues**
```
Problem: Focus gets trapped or lost
Solutions:
1. Press Escape to reset focus
2. Use Alt+Tab to cycle between applications
3. Refresh page if focus is completely lost
4. Use skip links to jump to main content
```

#### **Shortcut Conflicts**
```
Problem: Shortcuts don't work as expected
Solutions:
1. Check browser shortcut conflicts
2. Disable browser extensions temporarily
3. Use F1 to view current context shortcuts
4. Reset shortcuts in preferences
```

### **Browser-Specific Notes**

#### **Chrome**
- Some shortcuts may conflict with browser shortcuts
- Use Ctrl+Shift+C for Chrome DevTools instead of app shortcuts
- Extensions may intercept keyboard events

#### **Firefox**
- F7 toggles caret browsing (useful for text selection)
- Some shortcuts need to be enabled in accessibility preferences
- Reader mode may affect keyboard navigation

#### **Safari**
- Tab navigation must be enabled in system preferences
- Some shortcuts require Full Keyboard Access enabled
- VoiceOver integration works best with Safari

#### **Edge**
- Similar to Chrome behavior
- Some legacy shortcuts may behave differently
- Collections feature may intercept some shortcuts

---

## 📚 SCREEN READER SPECIFIC GUIDANCE

### **NVDA (Windows)**

#### **Recommended Settings**
```
NVDA Configuration:
- Browse mode: On (default)
- Forms mode: Auto-switch enabled
- Speech rate: Comfortable level (not too fast)
- Punctuation level: Some (recommended)
```

#### **NVDA Specific Shortcuts**
| **NVDA Key** | **Action** |
|--------------|------------|
| `H` | Next heading |
| `Shift+H` | Previous heading |
| `L` | Next link |
| `B` | Next button |
| `F` | Next form field |
| `T` | Next table |
| `K` | Next link |

### **JAWS (Windows)**

#### **Recommended Settings**
```
JAWS Configuration:
- Virtual cursor: On
- Forms mode: Auto
- Verbosity: Medium
- Reading speed: Moderate
```

#### **JAWS Specific Shortcuts**
| **JAWS Key** | **Action** |
|--------------|------------|
| `Insert+F7` | Links list |
| `Insert+F5` | Form fields list |
| `Insert+F6` | Headings list |
| `Insert+Ctrl+;` | Element list |
| `Insert+Z` | Read from cursor |

### **VoiceOver (macOS)**

#### **Recommended Settings**
```
VoiceOver Configuration:
- Web rotor: Enabled
- Quick Nav: On (VO+Q+Q)
- Verbosity: High
- Navigation: By element
```

#### **VoiceOver Specific Shortcuts**
| **VO Key** | **Action** |
|------------|------------|
| `VO+U` | Open rotor |
| `VO+H` | Next heading |
| `VO+L` | Next link |
| `VO+B` | Next button |
| `VO+J` | Next form control |

---

## 🎯 ACCESSIBILITY TESTING CHECKLIST

### **Manual Testing Steps**

#### **Basic Keyboard Testing**
```
Testing Checklist:
□ Disconnect mouse/trackpad
□ Tab through entire interface
□ Verify all interactive elements reachable
□ Test all documented shortcuts
□ Verify focus indicators visible
□ Check escape key functionality
□ Test form completion workflow
□ Verify modal focus trapping
```

#### **Screen Reader Testing**
```
Screen Reader Checklist:
□ Navigate by headings
□ Navigate by landmarks
□ Navigate by links
□ Navigate by buttons
□ Test form completion
□ Verify error announcements
□ Check live region updates
□ Test table navigation
```

### **Automated Testing Commands**

#### **Accessibility Validation**
```bash
# Run automated accessibility tests
npm run test:a11y

# Generate keyboard navigation report
npm run test:keyboard

# Test focus management
npm run test:focus

# Validate ARIA implementation
npm run test:aria
```

---

## 📞 SUPPORT AND FEEDBACK

### **Getting Help**

If you encounter keyboard navigation issues:

**Immediate Help:**
- Press `F1` for context-sensitive help
- Use `Alt+H` for general help menu
- Contact support via `Ctrl+Shift+H`

**Contact Information:**
- **Email:** keyboard-support@mainframe-assistant.com
- **Phone:** +1 (555) 123-4567 ext. 2
- **Chat:** Available in application (Ctrl+Shift+C)

### **Feedback and Suggestions**

We welcome feedback on keyboard navigation:
- Feature requests: features@mainframe-assistant.com
- Bug reports: Include browser, OS, and steps to reproduce
- Accessibility improvements: accessibility@mainframe-assistant.com

---

**This guide is regularly updated based on user feedback and application changes. Last update: September 15, 2025**

**For the most current version, press F1 in the application or visit: help.mainframe-assistant.com/keyboard-navigation**