/**
 * SearchCommand Usage Example
 * Demonstrates how to integrate the SearchCommand component with the settings system
 */

import React, { useState, useCallback } from 'react';
import { Search, Command } from 'lucide-react';
import { Button } from '../ui/Button';
import { SearchCommand } from './SearchCommand';
import { SettingsNavigation } from './SettingsNavigation';

interface SearchCommandExampleProps {
  onNavigate?: (path: string) => void;
  className?: string;
}

export const SearchCommandExample: React.FC<SearchCommandExampleProps> = ({
  onNavigate,
  className = ''
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState('/settings');

  // Handle navigation from search
  const handleSearchNavigate = useCallback((path: string) => {
    setCurrentPath(path);
    setIsSearchOpen(false);
    onNavigate?.(path);

    // You could also use react-router here:
    // navigate(path);

    console.log('Navigating to:', path);
  }, [onNavigate]);

  // Handle navigation from settings nav
  const handleSettingsNavigate = useCallback((path: string) => {
    setCurrentPath(path);
    onNavigate?.(path);
    console.log('Settings navigation to:', path);
  }, [onNavigate]);

  return (
    <div className={`settings-with-search ${className}`}>
      {/* Header with Search Button */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

        <div className="flex items-center space-x-2">
          {/* Search Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center space-x-2"
          >
            <Search className="w-4 h-4" />
            <span>Search settings</span>
            <kbd className="hidden sm:inline-flex px-2 py-1 bg-gray-100 text-xs rounded">
              ⌘K
            </kbd>
          </Button>
        </div>
      </div>

      {/* Settings Content */}
      <div className="flex h-full">
        {/* Settings Navigation */}
        <div className="w-80 border-r border-gray-200 bg-gray-50 overflow-y-auto">
          <SettingsNavigation
            currentPath={currentPath}
            onNavigate={handleSettingsNavigate}
            className="h-full"
          />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 p-6 overflow-y-auto">
          <SettingsContentExample currentPath={currentPath} />
        </div>
      </div>

      {/* Search Command Modal */}
      <SearchCommand
        isOpen={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        onNavigate={handleSearchNavigate}
      />
    </div>
  );
};

// Example settings content component
interface SettingsContentExampleProps {
  currentPath: string;
}

const SettingsContentExample: React.FC<SettingsContentExampleProps> = ({
  currentPath
}) => {
  const getContentTitle = () => {
    switch (currentPath) {
      case '/settings/general/profile':
        return 'Profile Settings';
      case '/settings/general/preferences/appearance':
        return 'Appearance';
      case '/settings/api/keys':
        return 'API Keys';
      case '/settings/cost/budget':
        return 'Budget Settings';
      case '/settings/dashboard/widgets':
        return 'Widget Configuration';
      case '/settings/advanced/performance':
        return 'Performance Settings';
      case '/settings/advanced/security':
        return 'Security Settings';
      case '/settings/advanced/developer':
        return 'Developer Tools';
      default:
        return 'Settings Overview';
    }
  };

  const getContentDescription = () => {
    switch (currentPath) {
      case '/settings/general/profile':
        return 'Manage your personal information, name, email, and avatar.';
      case '/settings/general/preferences/appearance':
        return 'Customize the application theme, colors, and visual preferences.';
      case '/settings/api/keys':
        return 'Configure API keys for various AI providers like OpenAI, Anthropic, and Google.';
      case '/settings/cost/budget':
        return 'Set spending limits and cost controls for API usage.';
      case '/settings/dashboard/widgets':
        return 'Customize dashboard widgets and layout preferences.';
      case '/settings/advanced/performance':
        return 'Configure performance settings and optimization options.';
      case '/settings/advanced/security':
        return 'Manage security settings and access controls.';
      case '/settings/advanced/developer':
        return 'Access developer tools and debugging options.';
      default:
        return 'Welcome to settings. Use the search (⌘K) to quickly find what you need.';
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          {getContentTitle()}
        </h2>
        <p className="text-lg text-gray-600">
          {getContentDescription()}
        </p>
      </div>

      {/* Search Shortcut Reminder */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <Command className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-blue-800">
              Quick Tip: Use Search
            </h3>
            <p className="text-sm text-blue-600 mt-1">
              Press <kbd className="px-2 py-1 bg-blue-100 rounded text-xs">⌘K</kbd> (or <kbd className="px-2 py-1 bg-blue-100 rounded text-xs">Ctrl+K</kbd> on Windows)
              to quickly search and navigate to any setting.
            </p>
          </div>
        </div>
      </div>

      {/* Example Content */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <p className="text-gray-600">
          This is where the actual settings content would appear.
          The current path is: <code className="bg-gray-100 px-2 py-1 rounded text-sm">{currentPath}</code>
        </p>

        <div className="mt-4 space-y-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
        </div>
      </div>
    </div>
  );
};

// Hook for integrating SearchCommand into existing apps
export const useSearchCommand = (onNavigate?: (path: string) => void) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleNavigate = useCallback((path: string) => {
    setIsOpen(false);
    onNavigate?.(path);
  }, [onNavigate]);

  const SearchCommandComponent = useCallback(() => (
    <SearchCommand
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      onNavigate={handleNavigate}
    />
  ), [isOpen, handleNavigate]);

  return {
    isOpen,
    setIsOpen,
    SearchCommand: SearchCommandComponent
  };
};

export default SearchCommandExample;