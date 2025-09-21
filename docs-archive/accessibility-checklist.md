# Accessibility Standards Checklist
## WCAG 2.1 AA Compliance for Component Library

## Overview

This checklist ensures all components in the Mainframe AI Assistant component library meet WCAG 2.1 Level AA accessibility standards. Each component must pass all applicable criteria before being considered production-ready.

## 1. Universal Requirements (All Components)

### 1.1 Perceivable Requirements

#### Color and Contrast
- [ ] **4.5:1 contrast ratio** for normal text (14px and above)
- [ ] **3:1 contrast ratio** for large text (18px+ or 14px+ bold)
- [ ] **3:1 contrast ratio** for non-text elements (icons, borders, focus indicators)
- [ ] **Color is not the sole method** of conveying information
- [ ] **Focus indicators** are clearly visible with sufficient contrast
- [ ] **Disabled states** maintain readability standards

#### Text and Typography
- [ ] **Text can be resized** up to 200% without loss of functionality
- [ ] **Text reflows properly** when zoomed or on small screens
- [ ] **Line height** minimum 1.5x font size for body text
- [ ] **Paragraph spacing** minimum 2x font size
- [ ] **Letter spacing** minimum 0.12x font size
- [ ] **Word spacing** minimum 0.16x font size

#### Images and Icons
- [ ] **Meaningful images** have descriptive alt text
- [ ] **Decorative images** have empty alt attributes (alt="")
- [ ] **Icon-only buttons** have accessible names via aria-label or sr-only text
- [ ] **Complex images** have detailed descriptions when needed

#### Media Content
- [ ] **Auto-playing media** can be paused, stopped, or controlled
- [ ] **Audio controls** are keyboard accessible
- [ ] **Volume controls** are available for any audio content

### 1.2 Operable Requirements

#### Keyboard Navigation
- [ ] **All interactive elements** are keyboard accessible
- [ ] **Tab order** is logical and intuitive
- [ ] **Focus is clearly visible** on all interactive elements
- [ ] **Focus is not trapped** unless in a modal/dialog context
- [ ] **Keyboard shortcuts** don't interfere with assistive technology
- [ ] **Custom controls** follow standard keyboard conventions

#### Timing and Motion
- [ ] **No time limits** or users can extend/disable them
- [ ] **Auto-updating content** can be paused or controlled
- [ ] **Motion animations** can be disabled (respects prefers-reduced-motion)
- [ ] **Parallax effects** can be disabled
- [ ] **Moving content** pauses on hover or focus

#### Seizures and Physical Reactions
- [ ] **No content flashes** more than 3 times per second
- [ ] **Large flashing areas** are avoided
- [ ] **Motion triggers** can be disabled for vestibular disorders

### 1.3 Understandable Requirements

#### Readable Text
- [ ] **Language is identified** in HTML (lang attribute)
- [ ] **Changes in language** are marked up appropriately
- [ ] **Abbreviations** have explanations on first use
- [ ] **Reading level** is appropriate for content

#### Predictable Interface
- [ ] **Navigation is consistent** across all pages/views
- [ ] **Components behave predictably** and consistently
- [ ] **Context changes** only occur on user request
- [ ] **Focus changes** are logical and expected

#### Input Assistance
- [ ] **Form errors** are clearly identified and described
- [ ] **Labels and instructions** are provided for all inputs
- [ ] **Error suggestions** are provided when possible
- [ ] **Required fields** are clearly marked

### 1.4 Robust Requirements

#### Technical Implementation
- [ ] **Valid HTML** markup (no parsing errors)
- [ ] **ARIA attributes** are used correctly
- [ ] **Semantic markup** is used appropriately
- [ ] **Assistive technology compatibility** is tested
- [ ] **Progressive enhancement** provides fallbacks

## 2. Component-Specific Requirements

### 2.1 Form Components

#### Button Component
- [ ] **Accessible name** via text content, aria-label, or aria-labelledby
- [ ] **Role="button"** for non-button elements acting as buttons
- [ ] **Disabled state** communicated to screen readers (aria-disabled)
- [ ] **Loading state** announced to screen readers
- [ ] **Toggle buttons** use aria-pressed attribute
- [ ] **Icon-only buttons** have descriptive labels
- [ ] **Button groups** are properly labeled

```typescript
// Example Button accessibility implementation
<button
  type="button"
  aria-label={iconOnly ? accessibleName : undefined}
  aria-pressed={isToggle ? pressed : undefined}
  aria-disabled={disabled}
  aria-describedby={hasError ? `${id}-error` : undefined}
>
  {loading && <span aria-hidden="true">Loading...</span>}
  {loading && <span className="sr-only">Loading, please wait</span>}
  {children}
</button>
```

#### Input Component
- [ ] **Labels** are programmatically associated (id/for or aria-labelledby)
- [ ] **Required fields** marked with aria-required="true"
- [ ] **Error states** linked with aria-describedby
- [ ] **Placeholder text** is not the only label
- [ ] **Input type** is semantically appropriate
- [ ] **Autocomplete attributes** for common fields
- [ ] **Character limits** announced to screen readers

```typescript
// Example Input accessibility implementation
<div className="form-field">
  <label htmlFor={id} className={required ? 'required' : ''}>
    {label}
    {required && <span aria-label="required">*</span>}
  </label>
  <input
    id={id}
    type={type}
    aria-required={required}
    aria-invalid={hasError}
    aria-describedby={`${id}-help ${hasError ? `${id}-error` : ''}`}
    autoComplete={autoComplete}
  />
  <div id={`${id}-help`} className="help-text">{helpText}</div>
  {hasError && (
    <div id={`${id}-error`} className="error-text" role="alert">
      {errorMessage}
    </div>
  )}
</div>
```

#### Select/Dropdown Component
- [ ] **Options** are keyboard navigable (arrow keys)
- [ ] **Selected option** is clearly announced
- [ ] **Expandable state** uses aria-expanded
- [ ] **Listbox role** for custom dropdowns
- [ ] **Option groups** use proper ARIA grouping
- [ ] **Multi-select** states are clear

#### Checkbox/Radio Components
- [ ] **Fieldset and legend** for grouped checkboxes/radios
- [ ] **Checked state** communicated properly
- [ ] **Indeterminate state** for tri-state checkboxes
- [ ] **Mixed state** for group selection
- [ ] **Descriptions** linked with aria-describedby

### 2.2 Navigation Components

#### Menu/Dropdown Component
- [ ] **Menu role** for popup menus
- [ ] **Menuitem role** for menu options
- [ ] **Keyboard navigation** (arrow keys, Enter, Escape)
- [ ] **Focus management** when opening/closing
- [ ] **Submenus** properly nested and navigable
- [ ] **Menu button** has aria-haspopup and aria-expanded

```typescript
// Example Menu accessibility implementation
<div className="menu-container">
  <button
    aria-haspopup="true"
    aria-expanded={isOpen}
    onClick={toggleMenu}
    onKeyDown={handleKeyDown}
  >
    Menu
  </button>
  {isOpen && (
    <ul role="menu" className="menu-list">
      <li role="menuitem" tabIndex={0}>
        Option 1
      </li>
      <li role="menuitem" tabIndex={0}>
        Option 2
      </li>
    </ul>
  )}
</div>
```

#### Breadcrumb Component
- [ ] **Navigation landmark** or nav element
- [ ] **Ordered list** structure for breadcrumb items
- [ ] **Current page** marked with aria-current="page"
- [ ] **Separators** are decorative (aria-hidden="true")

#### Tab Component
- [ ] **Tab list** uses role="tablist"
- [ ] **Tab items** use role="tab"
- [ ] **Tab panels** use role="tabpanel"
- [ ] **Selected tab** has aria-selected="true"
- [ ] **Tab panels** linked with aria-labelledby
- [ ] **Keyboard navigation** (arrow keys between tabs)

### 2.3 Data Display Components

#### Table Component
- [ ] **Table headers** properly associated with data cells
- [ ] **Complex tables** use scope attributes
- [ ] **Table caption** describes table purpose
- [ ] **Sortable columns** indicate sort state
- [ ] **Row selection** states are announced
- [ ] **Empty states** are properly announced

```typescript
// Example DataTable accessibility implementation
<table role="table">
  <caption>Knowledge Base Entries</caption>
  <thead>
    <tr>
      <th scope="col">
        <button onClick={sort} aria-label="Sort by title">
          Title
          {sortState === 'asc' && <span aria-hidden="true">↑</span>}
          {sortState === 'desc' && <span aria-hidden="true">↓</span>}
        </button>
      </th>
      <th scope="col">Category</th>
      <th scope="col">Last Updated</th>
    </tr>
  </thead>
  <tbody>
    {data.map(item => (
      <tr key={item.id} aria-selected={selectedItems.includes(item.id)}>
        <td>{item.title}</td>
        <td>{item.category}</td>
        <td>{item.lastUpdated}</td>
      </tr>
    ))}
  </tbody>
</table>
```

#### Card Component
- [ ] **Semantic structure** with proper headings
- [ ] **Interactive cards** are keyboard accessible
- [ ] **Card actions** are clearly labeled
- [ ] **Content hierarchy** is logical

### 2.4 Feedback Components

#### Alert Component
- [ ] **Alert role** for important messages
- [ ] **Status role** for status updates
- [ ] **Assertive announcements** for critical alerts
- [ ] **Dismissible alerts** have accessible close buttons

```typescript
// Example Alert accessibility implementation
<div
  role="alert" // or "status" for less urgent
  className={`alert alert-${variant}`}
>
  <Icon aria-hidden="true" />
  <div className="alert-content">
    <strong>{title}</strong>
    {message && <p>{message}</p>}
  </div>
  {dismissible && (
    <button
      onClick={onDismiss}
      aria-label="Dismiss alert"
      className="alert-close"
    >
      ×
    </button>
  )}
</div>
```

#### Modal/Dialog Component
- [ ] **Focus management** (trap focus within modal)
- [ ] **Escape key** closes modal
- [ ] **Background clicks** close modal (optional)
- [ ] **Modal title** linked with aria-labelledby
- [ ] **Modal description** linked with aria-describedby
- [ ] **Focus returns** to trigger element on close

#### Loading/Progress Component
- [ ] **Status updates** announced to screen readers
- [ ] **Progress values** communicated with aria-valuenow
- [ ] **Indeterminate progress** properly labeled
- [ ] **Loading states** don't break keyboard navigation

### 2.5 Specialized Components

#### Code Editor Component
- [ ] **Syntax highlighting** doesn't rely solely on color
- [ ] **Line numbers** are not included in selection
- [ ] **Error indicators** have text descriptions
- [ ] **Code completion** is keyboard accessible

#### Search Component
- [ ] **Search suggestions** are navigable with keyboard
- [ ] **Results count** announced to screen readers
- [ ] **Search filters** are accessible
- [ ] **No results** state is clearly communicated

## 3. Testing Requirements

### 3.1 Automated Testing Tools
- [ ] **axe-core** integration in unit tests
- [ ] **Pa11y** command-line testing
- [ ] **WAVE** browser extension validation
- [ ] **Lighthouse** accessibility scoring
- [ ] **jest-axe** for React Testing Library tests

### 3.2 Manual Testing Checklist
- [ ] **Keyboard-only navigation** testing
- [ ] **Screen reader testing** (NVDA, JAWS, VoiceOver)
- [ ] **High contrast mode** testing
- [ ] **Zoom testing** up to 200%
- [ ] **Color blindness simulation** testing

### 3.3 Browser Support Testing
- [ ] **Chrome** with ChromeVox
- [ ] **Firefox** with NVDA
- [ ] **Safari** with VoiceOver
- [ ] **Edge** with Narrator
- [ ] **Mobile browsers** with TalkBack/VoiceOver

### 3.4 Responsive Testing
- [ ] **All breakpoints** maintain accessibility
- [ ] **Touch targets** minimum 44x44 pixels
- [ ] **Mobile navigation** is accessible
- [ ] **Orientation changes** don't break functionality

## 4. Documentation Requirements

### 4.1 Component Documentation
- [ ] **Accessibility features** documented
- [ ] **ARIA patterns** explained
- [ ] **Keyboard interactions** described
- [ ] **Screen reader behavior** documented
- [ ] **Known limitations** listed

### 4.2 Implementation Guidelines
- [ ] **Usage examples** show accessible patterns
- [ ] **Anti-patterns** are documented
- [ ] **Testing guidance** provided
- [ ] **Migration notes** for accessibility improvements

## 5. Quality Gates

### 5.1 Pre-Release Checklist
- [ ] **All automated tests** pass
- [ ] **Manual testing** completed
- [ ] **Accessibility review** approved
- [ ] **Documentation** updated
- [ ] **Breaking changes** communicated

### 5.2 Performance and Accessibility Balance
- [ ] **Accessibility features** don't significantly impact performance
- [ ] **Screen reader announcements** are optimized
- [ ] **ARIA attributes** are used judiciously
- [ ] **Focus management** is efficient

## 6. Maintenance and Updates

### 6.1 Regular Audits
- [ ] **Monthly accessibility audits** scheduled
- [ ] **User feedback** collected and addressed
- [ ] **Assistive technology updates** tested
- [ ] **WCAG updates** monitored and implemented

### 6.2 Training and Guidelines
- [ ] **Team training** on accessibility standards
- [ ] **Design review** process includes accessibility
- [ ] **Code review** checklist includes accessibility
- [ ] **User testing** includes accessibility participants

## 7. Success Metrics

### 7.1 Quantitative Metrics
- [ ] **0 axe-core violations** in production
- [ ] **Lighthouse accessibility score** of 100
- [ ] **100% keyboard navigation** coverage
- [ ] **WCAG 2.1 AA compliance** verified

### 7.2 Qualitative Metrics
- [ ] **Positive user feedback** from accessibility community
- [ ] **Successful task completion** by users with disabilities
- [ ] **Efficient navigation** with assistive technology
- [ ] **Inclusive design** principles followed

This accessibility checklist ensures that every component in the library provides an excellent experience for all users, including those with disabilities, while maintaining compliance with legal and industry standards.