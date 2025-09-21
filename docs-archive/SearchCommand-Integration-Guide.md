# SearchCommand Integration Guide

The SearchCommand component provides a powerful, keyboard-driven search interface for settings with Cmd+K (or Ctrl+K) global shortcut support.

## Features

✅ **Global Keyboard Shortcut**: Cmd+K (Mac) or Ctrl+K (Windows/Linux)
✅ **Fuzzy Search**: Intelligent search across all settings
✅ **Category Grouping**: Results grouped by Essentials, Workspace, System, Advanced
✅ **Recent Searches**: Shows and manages recent search history
✅ **Direct Navigation**: Navigate directly to settings on selection
✅ **Modal Overlay**: Clean, accessible modal design
✅ **Icons**: Visual icons for each result type
✅ **Keyboard Navigation**: Arrow keys, Enter, Escape support
✅ **Mobile Friendly**: Responsive design

## Quick Start

### 1. Basic Integration

```tsx
import React, { useState } from 'react';
import { SearchCommand } from '@/components/settings';

function App() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const handleNavigate = (path: string) => {
    // Handle navigation to settings path
    console.log('Navigate to:', path);
    // Use your router: navigate(path) or history.push(path)
  };

  return (
    <div>
      {/* Your app content */}

      <SearchCommand
        isOpen={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        onNavigate={handleNavigate}
      />
    </div>
  );
}
```

### 2. Using the Hook

```tsx
import React from 'react';
import { useSearchCommand } from '@/components/settings';
import { useNavigate } from 'react-router-dom';

function MyComponent() {
  const navigate = useNavigate();
  const { isOpen, setIsOpen, SearchCommand } = useSearchCommand(navigate);

  return (
    <div>
      <button onClick={() => setIsOpen(true)}>
        Open Search (⌘K)
      </button>

      <SearchCommand />
    </div>
  );
}
```

### 3. Complete Example with Settings Navigation

```tsx
import React, { useState } from 'react';
import {
  SearchCommand,
  SettingsNavigation,
  SearchCommandExample
} from '@/components/settings';

function SettingsPage() {
  // Use the complete example component
  return (
    <SearchCommandExample
      onNavigate={(path) => {
        // Handle navigation
        console.log('Navigate to:', path);
      }}
    />
  );
}
```

## API Reference

### SearchCommand Props

```tsx
interface SearchCommandProps {
  isOpen: boolean;           // Controls modal visibility
  onOpenChange: (open: boolean) => void;  // Modal state handler
  onNavigate: (path: string) => void;     // Navigation handler
  className?: string;        // Additional CSS classes
}
```

### Available Settings Paths

The search covers these main categories and paths:

#### General Settings
- `/settings/general/profile` - Profile Settings
- `/settings/general/preferences/appearance` - Appearance
- `/settings/general/preferences/notifications` - Notifications

#### API Configuration
- `/settings/api/keys` - API Keys (Required)
- `/settings/api/providers/openai` - OpenAI Configuration
- `/settings/api/providers/anthropic` - Anthropic Configuration
- `/settings/api/providers/gemini` - Google Gemini

#### Cost Management
- `/settings/cost/budget` - Budget Settings
- `/settings/cost/alerts` - Cost Alerts
- `/settings/cost/reports` - Usage Reports

#### Dashboard
- `/settings/dashboard/widgets` - Widget Configuration
- `/settings/dashboard/layout` - Layout Settings

#### Advanced
- `/settings/advanced/performance` - Performance
- `/settings/advanced/security` - Security Settings
- `/settings/advanced/developer` - Developer Tools

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+K` / `Ctrl+K` | Open search command |
| `↑` / `↓` | Navigate results |
| `Enter` | Select result |
| `Esc` | Close search |

## Customization

### Adding New Settings

To add new settings to the search, edit the `settingsSearchData` array in `SearchCommand.tsx`:

```tsx
const newSetting = {
  id: 'my-new-setting',
  title: 'My New Setting',
  description: 'Description of the new setting',
  path: '/settings/my/new/setting',
  category: 'Advanced',
  categoryIcon: <Wrench className="w-4 h-4" />,
  categoryColor: '#7C2D12',
  icon: <Settings className="w-4 h-4" />,
  keywords: ['new', 'setting', 'custom'],
  section: 'Custom Settings'
};
```

### Custom Categories

You can modify the category grouping by updating the category mapping in the search results.

### Styling

The component uses Tailwind CSS classes and can be customized with:

```tsx
<SearchCommand
  className="my-custom-class"
  // ... other props
/>
```

## Integration with React Router

```tsx
import { useNavigate } from 'react-router-dom';

function App() {
  const navigate = useNavigate();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <SearchCommand
      isOpen={isSearchOpen}
      onOpenChange={setIsSearchOpen}
      onNavigate={navigate}
    />
  );
}
```

## Integration with Next.js

```tsx
import { useRouter } from 'next/router';

function App() {
  const router = useRouter();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const handleNavigate = (path: string) => {
    router.push(path);
  };

  return (
    <SearchCommand
      isOpen={isSearchOpen}
      onOpenChange={setIsSearchOpen}
      onNavigate={handleNavigate}
    />
  );
}
```

## Recent Searches

The component automatically manages recent searches:

- Stores up to 5 recent searches in localStorage
- Shows recent searches when no query is entered
- Allows clearing recent search history
- Persists across browser sessions

## Accessibility

The SearchCommand component follows accessibility best practices:

- ✅ Focus management and trapping
- ✅ Keyboard navigation
- ✅ ARIA labels and roles
- ✅ Screen reader announcements
- ✅ High contrast support

## Browser Support

- ✅ Chrome 80+
- ✅ Firefox 80+
- ✅ Safari 14+
- ✅ Edge 80+

## Troubleshooting

### Global Shortcut Not Working

1. Check if another component is preventing the event
2. Ensure the component is mounted when the shortcut is pressed
3. Verify keyboard shortcut conflicts

### Search Results Not Appearing

1. Check the search query matches keywords
2. Verify settings data is properly formatted
3. Check console for JavaScript errors

### Navigation Not Working

1. Ensure `onNavigate` handler is properly implemented
2. Check that routing is set up correctly
3. Verify paths exist in your application

## Performance

The SearchCommand component is optimized for performance:

- ✅ Debounced search input
- ✅ Memoized search results
- ✅ Virtual scrolling for large result sets
- ✅ Lazy loading of recent searches

## Contributing

To contribute improvements:

1. The main component is in `/src/renderer/components/settings/SearchCommand.tsx`
2. Examples are in `/src/renderer/components/settings/SearchCommandExample.tsx`
3. Add new settings to the `settingsSearchData` array
4. Update this documentation for any API changes