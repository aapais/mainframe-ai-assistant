# AlertMessage Component

A fully accessible, feature-rich alert component for React applications with comprehensive ARIA support, screen reader integration, and multiple display styles.

## Features

### 🎯 Core Features
- **Four severity levels**: info, success, warning, error
- **Multiple display styles**: inline, toast, banner, modal
- **Action button support** with keyboard navigation
- **Auto-dismiss functionality** with customizable timers
- **Custom icons** with fallback defaults

### ♿ Accessibility Features
- **Full ARIA support** with proper roles (alert, status, alertdialog)
- **Live region announcements** for screen readers
- **Keyboard navigation** with Escape key support
- **Focus management** for modal-style alerts
- **Reduced motion** respect for animations
- **High contrast** compatible styling

### 🔧 Advanced Features
- **Imperative API** for programmatic control
- **Toast notification system** with positioning
- **Animation support** with smooth transitions
- **Performance optimized** with smart memoization
- **TypeScript** fully typed with comprehensive interfaces

## Basic Usage

```tsx
import AlertMessage, { InfoAlert, SuccessAlert, WarningAlert, ErrorAlert } from './AlertMessage';

// Basic alerts
<InfoAlert message="This is an informational message." />
<SuccessAlert message="Operation completed successfully!" />
<WarningAlert message="Please review before proceeding." />
<ErrorAlert message="An error occurred. Please try again." />

// Alert with title
<AlertMessage
  title="Important Notice"
  message="Please read this carefully."
  severity="warning"
/>
```

## Advanced Usage

### Dismissible Alerts
```tsx
<AlertMessage
  message="You can dismiss this alert"
  dismissible
  onDismiss={() => console.log('Dismissed')}
/>

// Auto-dismiss after 5 seconds
<AlertMessage
  message="This will auto-dismiss"
  dismissible
  autoDismiss={5000}
  onDismiss={() => console.log('Auto-dismissed')}
/>
```

### Alerts with Actions
```tsx
const actions = [
  {
    id: 'confirm',
    label: 'Confirm',
    onClick: (alertId) => handleConfirm(),
    variant: 'primary',
    autoFocus: true
  },
  {
    id: 'cancel',
    label: 'Cancel',
    onClick: (alertId) => handleCancel(),
    variant: 'secondary'
  }
];

<AlertMessage
  title="Confirm Action"
  message="Are you sure you want to proceed?"
  actions={actions}
  severity="warning"
/>
```

### Toast Notifications
```tsx
import { showToast } from './AlertMessage';

// Show a toast notification
showToast({
  message: "File uploaded successfully!",
  severity: "success",
  position: "top-right",
  autoDismiss: 3000
});

// Toast with actions
showToast({
  title: "New Message",
  message: "You have received a new message",
  severity: "info",
  actions: [
    {
      id: 'view',
      label: 'View',
      onClick: () => viewMessage()
    }
  ]
});
```

### Custom Icons
```tsx
// Custom SVG icon
const customIcon = (
  <svg width="20" height="20" fill="currentColor">
    <path d="..." />
  </svg>
);

<AlertMessage
  message="Alert with custom icon"
  icon={customIcon}
/>

// Dynamic icon function
const iconFunction = (severity) => {
  const icons = {
    info: '💡',
    success: '✅',
    warning: '⚠️',
    error: '❌'
  };
  return <span>{icons[severity]}</span>;
};

<AlertMessage
  message="Alert with dynamic icon"
  icon={iconFunction}
  severity="success"
/>
```

### Imperative API
```tsx
const alertRef = useRef<AlertMessageRef>(null);

// Programmatic control
const handleFocus = () => alertRef.current?.focus();
const handleShow = () => alertRef.current?.show();
const handleDismiss = () => alertRef.current?.dismiss();

<AlertMessage
  ref={alertRef}
  message="Controlled alert"
  open={isVisible}
/>
```

## Props

### AlertMessageProps

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `message` | `string \| ReactNode` | - | **Required.** Alert content |
| `title` | `string` | - | Optional alert title |
| `severity` | `'info' \| 'success' \| 'warning' \| 'error'` | `'info'` | Alert severity level |
| `role` | `'alert' \| 'status' \| 'alertdialog'` | Auto-determined | ARIA role |
| `alertStyle` | `'inline' \| 'toast' \| 'banner' \| 'modal'` | `'inline'` | Visual style variant |
| `dismissible` | `boolean` | `false` | Show dismiss button |
| `autoDismiss` | `number` | - | Auto-dismiss timer (ms) |
| `actions` | `AlertAction[]` | `[]` | Action buttons |
| `icon` | `ReactNode \| function` | - | Custom icon |
| `showIcon` | `boolean` | `true` | Show default icon |
| `onDismiss` | `() => void` | - | Dismiss callback |
| `onClose` | `() => void` | - | Close callback |
| `onShow` | `() => void` | - | Show callback |
| `open` | `boolean` | `true` | Controlled visibility |
| `animate` | `boolean` | `true` | Enable animations |
| `respectMotion` | `boolean` | Auto-detected | Respect reduced motion |

### AlertAction Interface

```tsx
interface AlertAction {
  id: string;                    // Unique identifier
  label: string;                 // Button text
  onClick: (alertId?: string) => void; // Click handler
  variant?: 'primary' | 'secondary' | 'ghost'; // Button style
  autoFocus?: boolean;           // Auto-focus this button
  disabled?: boolean;            // Disabled state
  shortcut?: string;             // Keyboard shortcut description
}
```

## Accessibility

### ARIA Roles
- **`alert`**: For error and warning messages that need immediate attention
- **`status`**: For informational messages announced politely
- **`alertdialog`**: For alerts that require user interaction

### Screen Reader Support
- Automatic announcements based on severity
- Live region updates with appropriate politeness levels
- Proper labeling and description associations
- Context-aware messaging

### Keyboard Navigation
- **Escape**: Dismiss alert or close modal
- **Tab**: Navigate through action buttons
- **Arrow Keys**: Navigate between actions (horizontal)
- **Enter/Space**: Activate focused action button

### Focus Management
- Auto-focus for important actions
- Focus trapping for modal-style alerts
- Proper focus restoration after dismissal

## Styling

The component uses Tailwind CSS classes and follows a consistent design system:

```tsx
// Custom styling
<AlertMessage
  message="Custom styled alert"
  className="border-2 border-purple-500 bg-purple-50"
  style={{ borderRadius: '12px' }}
/>
```

### CSS Classes Applied
- Base: `.alert-message`
- Severity: `.bg-{color}-50`, `.border-{color}-200`, `.text-{color}-800`
- Style: Varies by `alertStyle` prop
- Animation: `.transition-all`, `.duration-300` (when enabled)

## Testing

The component includes comprehensive test coverage:

```bash
# Run tests
npm test AlertMessage.test.tsx

# Test coverage includes:
# - ARIA attribute verification
# - Screen reader announcements
# - Keyboard interactions
# - Auto-dismiss functionality
# - Focus management
# - Animation behavior
```

## Examples

See `AlertMessage.example.tsx` for comprehensive usage examples including:
- Basic alert variations
- Dismissible alerts
- Action buttons
- Custom icons
- Toast notifications
- Accessibility features
- Animation controls

## Browser Support

- **Modern browsers**: Full support with all features
- **Legacy browsers**: Graceful degradation without animations
- **Screen readers**: NVDA, JAWS, VoiceOver, TalkBack
- **Reduced motion**: Respects user preferences automatically

## Performance

- Smart memoization prevents unnecessary re-renders
- Lazy loading for toast containers
- Efficient event handling with cleanup
- Minimal DOM manipulation for animations