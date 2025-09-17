import React, { useState, Suspense, useCallback, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

// Import Quick Access and Search components
import QuickAccessWidget from '../components/settings/QuickAccessWidget';
import SearchCommand from '../components/settings/SearchCommand';

// Eager load lightweight components that are frequently accessed
import APISettings from '../components/settings/APISettings';
import ProfileSettings from '../components/settings/ProfileSettings';
import PreferencesSettings from '../components/settings/PreferencesSettings';
import WidgetConfigurationSettings from '../components/settings/WidgetConfigurationSettings';

// Lazy load new settings components
const DatabaseSettings = React.lazy(() =>
  import('../components/settings/DatabaseSettings')
    .then(module => ({ default: module.default }))
    .catch(() => ({ default: () => <div className="p-8 text-center text-red-500">Failed to load Database Settings</div> }))
);

const NotificationSettings = React.lazy(() =>
  import('../components/settings/NotificationSettings')
    .then(module => ({ default: module.default }))
    .catch(() => ({ default: () => <div className="p-8 text-center text-red-500">Failed to load Notification Settings</div> }))
);

const IntegrationsSettings = React.lazy(() =>
  import('../components/settings/IntegrationsSettings')
    .then(module => ({ default: module.default }))
    .catch(() => ({ default: () => <div className="p-8 text-center text-red-500">Failed to load Integrations Settings</div> }))
);

// Lazy load heavy components for performance optimization (32KB+ each)
const CostManagementSettings = React.lazy(() =>
  import('../components/settings/CostManagementSettings')
    .then(module => ({ default: module.default }))
    .catch(() => ({ default: () => <div className="p-8 text-center text-red-500">Failed to load Cost Management Settings</div> }))
);

const SecuritySettings = React.lazy(() =>
  import('../components/settings/SecuritySettings')
    .then(module => ({ default: module.default }))
    .catch(() => ({ default: () => <div className="p-8 text-center text-red-500">Failed to load Security Settings</div> }))
);

const PerformanceSettings = React.lazy(() =>
  import('../components/settings/PerformanceSettings')
    .then(module => ({ default: module.default }))
    .catch(() => ({ default: () => <div className="p-8 text-center text-red-500">Failed to load Performance Settings</div> }))
);

const LayoutSettings = React.lazy(() =>
  import('../components/settings/LayoutSettings')
    .then(module => ({ default: module.default }))
    .catch(() => ({ default: () => <div className="p-8 text-center text-red-500">Failed to load Layout Settings</div> }))
);

const DeveloperSettings = React.lazy(() =>
  import('../components/settings/DeveloperSettings')
    .then(module => ({ default: module.default }))
    .catch(() => ({ default: () => <div className="p-8 text-center text-red-500">Failed to load Developer Settings</div> }))
);

import {
  Settings,
  Key,
  Database,
  Shield,
  Monitor,
  Palette,
  Bell,
  Globe,
  DollarSign,
  User,
  Layout,
  Code,
  ChevronDown,
  ChevronRight,
  Star,
  Briefcase,
  Cpu,
  Zap,
  Loader
} from 'lucide-react';

// Accenture color palette
const accentureColors = {
  purple: '#A100FF',
  darkPurple: '#7F39FB',
  lightPurple: '#E8D5FF',
  gray: '#666666',
  lightGray: '#F5F5F5',
  white: '#FFFFFF'
};

interface SettingsSection {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  component?: React.ReactNode;
  isLazy?: boolean;
  estimatedSize?: string;
}

interface SettingsCategory {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  sections: SettingsSection[];
}

// Loading skeleton component for lazy-loaded sections
const SettingsLoadingSkeleton: React.FC = () => (
  <Card className="border-0 shadow-lg">
    <CardContent className="p-4 sm:p-8">
      <div className="animate-pulse space-y-6">
        <div className="h-6 bg-gray-200 rounded w-1/3"></div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
        <div className="h-10 bg-gray-200 rounded w-32"></div>
      </div>
    </CardContent>
  </Card>
);

// Error boundary for lazy-loaded components
class SettingsErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): {hasError: boolean} {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="border-0 shadow-lg">
          <CardContent className="p-4 sm:p-8 text-center">
            <div className="text-red-500">
              <Shield className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4" />
              <h3 className="text-base sm:text-lg font-medium mb-2">Settings Panel Error</h3>
              <p className="text-sm sm:text-base mb-4">This settings panel failed to load properly.</p>
              <Button
                onClick={() => window.location.reload()}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                Reload Page
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

interface SettingsPageProps {
  currentPath?: string;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ currentPath = '/settings/general/profile' }) => {
  const [activeSection, setActiveSection] = useState<string>('api-settings');
  const [preloadedComponents, setPreloadedComponents] = useState<Set<string>>(new Set());
  const [loadTimes, setLoadTimes] = useState<{[key: string]: number}>({});

  // Path to section mapping function
  const getActiveSectionFromPath = useCallback((path: string): string => {
    // Define the complete path mapping based on SettingsNavigation paths
    const pathMappings: { [key: string]: string } = {
      // General Settings
      '/settings/general/profile': 'profile',
      '/settings/general/profile/basic': 'profile',
      '/settings/general/profile/preferences': 'profile',
      '/settings/general/preferences': 'preferences',
      '/settings/general/preferences/appearance': 'preferences',
      '/settings/general/preferences/notifications': 'preferences',

      // API Configuration
      '/settings/api/keys': 'api-settings',
      '/settings/api/providers': 'api-settings',
      '/settings/api/providers/openai': 'api-settings',
      '/settings/api/providers/anthropic': 'api-settings',
      '/settings/api/providers/gemini': 'api-settings',

      // Cost Management
      '/settings/cost/budget': 'cost-management',
      '/settings/cost/alerts': 'cost-management',
      '/settings/cost/reports': 'cost-management',

      // Dashboard
      '/settings/dashboard/widgets': 'widgets',
      '/settings/dashboard/layout': 'layout',

      // Advanced Settings
      '/settings/advanced/performance': 'performance',
      '/settings/advanced/performance/caching': 'performance',
      '/settings/advanced/performance/database': 'performance',
      '/settings/advanced/security': 'security',
      '/settings/advanced/security/auth': 'security',
      '/settings/advanced/security/privacy': 'security',
      '/settings/advanced/developer': 'developer',
      '/settings/advanced/developer/debug': 'developer',
      '/settings/advanced/developer/api': 'developer'
    };

    // Try exact match first
    if (pathMappings[path]) {
      return pathMappings[path];
    }

    // Try partial matching for nested paths (longest match first)
    const sortedPaths = Object.keys(pathMappings).sort((a, b) => b.length - a.length);
    for (const pathPrefix of sortedPaths) {
      if (path.startsWith(pathPrefix)) {
        return pathMappings[pathPrefix];
      }
    }

    // Try mapping based on section keywords in path
    if (path.includes('/api/')) return 'api-settings';
    if (path.includes('/profile')) return 'profile';
    if (path.includes('/preferences')) return 'preferences';
    if (path.includes('/cost/')) return 'cost-management';
    if (path.includes('/widgets')) return 'widgets';
    if (path.includes('/layout')) return 'layout';
    if (path.includes('/performance')) return 'performance';
    if (path.includes('/security')) return 'security';
    if (path.includes('/developer')) return 'developer';
    if (path.includes('/database')) return 'database';
    if (path.includes('/notifications')) return 'notifications';
    if (path.includes('/integrations')) return 'integrations';

    // Default fallback - start with profile for better UX
    return 'profile';
  }, []);

  // Update activeSection when currentPath changes
  useEffect(() => {
    const newActiveSection = getActiveSectionFromPath(currentPath);
    console.log('Settings.tsx: Path changed', { currentPath, newActiveSection, previousActiveSection: activeSection });
    setActiveSection(newActiveSection);
  }, [currentPath, getActiveSectionFromPath]);

  // Preload component on hover for better UX
  const handlePreload = useCallback((sectionId: string, isLazy: boolean) => {
    if (!isLazy || preloadedComponents.has(sectionId)) return;

    const startTime = performance.now();

    // Preload the component
    switch (sectionId) {
      case 'cost-management':
        import('../components/settings/CostManagementSettings').then(() => {
          setPreloadedComponents(prev => new Set([...prev, sectionId]));
          setLoadTimes(prev => ({...prev, [sectionId]: performance.now() - startTime}));
        });
        break;
      case 'security':
        import('../components/settings/SecuritySettings').then(() => {
          setPreloadedComponents(prev => new Set([...prev, sectionId]));
          setLoadTimes(prev => ({...prev, [sectionId]: performance.now() - startTime}));
        });
        break;
      case 'performance':
        import('../components/settings/PerformanceSettings').then(() => {
          setPreloadedComponents(prev => new Set([...prev, sectionId]));
          setLoadTimes(prev => ({...prev, [sectionId]: performance.now() - startTime}));
        });
        break;
      case 'layout':
        import('../components/settings/LayoutSettings').then(() => {
          setPreloadedComponents(prev => new Set([...prev, sectionId]));
          setLoadTimes(prev => ({...prev, [sectionId]: performance.now() - startTime}));
        });
        break;
      case 'developer':
        import('../components/settings/DeveloperSettings').then(() => {
          setPreloadedComponents(prev => new Set([...prev, sectionId]));
          setLoadTimes(prev => ({...prev, [sectionId]: performance.now() - startTime}));
        });
        break;
    }
  }, [preloadedComponents]);

  // Settings categories and sections - NO MENU HERE, just for component mapping
  const settingsCategories: SettingsCategory[] = [
    {
      id: 'essentials',
      title: 'Essentials',
      description: 'Core settings',
      icon: <Star className="w-5 h-5" />,
      sections: [
        {
          id: 'api-settings',
          title: 'API Settings',
          description: 'Manage API keys and endpoints',
          icon: <Key className="w-5 h-5" />,
          component: <APISettings />
        },
        {
          id: 'profile',
          title: 'Profile',
          description: 'Personal information and preferences',
          icon: <User className="w-5 h-5" />,
          component: <ProfileSettings />
        },
        {
          id: 'preferences',
          title: 'Preferences',
          description: 'Customize your experience',
          icon: <Star className="w-5 h-5" />,
          component: <PreferencesSettings />
        },
        {
          id: 'widgets',
          title: 'Widget Configuration',
          description: 'Configure dashboard widgets and displays',
          icon: <Layout className="w-5 h-5" />,
          component: <WidgetConfigurationSettings />
        }
      ]
    },
    {
      id: 'system',
      title: 'System',
      description: 'System configuration',
      icon: <Cpu className="w-5 h-5" />,
      sections: [
        {
          id: 'database',
          title: 'Database',
          description: 'Database connections and optimization',
          icon: <Database className="w-5 h-5" />,
          isLazy: true,
          estimatedSize: '15KB',
          component: (
            <SettingsErrorBoundary>
              <Suspense fallback={<SettingsLoadingSkeleton />}>
                <DatabaseSettings />
              </Suspense>
            </SettingsErrorBoundary>
          )
        },
        {
          id: 'notifications',
          title: 'Notifications',
          description: 'Alert preferences and notification channels',
          icon: <Bell className="w-5 h-5" />,
          isLazy: true,
          estimatedSize: '18KB',
          component: (
            <SettingsErrorBoundary>
              <Suspense fallback={<SettingsLoadingSkeleton />}>
                <NotificationSettings />
              </Suspense>
            </SettingsErrorBoundary>
          )
        },
        {
          id: 'integrations',
          title: 'Integrations',
          description: 'Third-party integrations and external services',
          icon: <Globe className="w-5 h-5" />,
          isLazy: true,
          estimatedSize: '30KB',
          component: (
            <SettingsErrorBoundary>
              <Suspense fallback={<SettingsLoadingSkeleton />}>
                <IntegrationsSettings />
              </Suspense>
            </SettingsErrorBoundary>
          )
        }
      ]
    },
    {
      id: 'enterprise',
      title: 'Enterprise',
      description: 'Enterprise features',
      icon: <Briefcase className="w-5 h-5" />,
      sections: [
        {
          id: 'cost-management',
          title: 'Cost Management',
          description: 'Track and optimize AI usage costs',
          icon: <DollarSign className="w-5 h-5" />,
          isLazy: true,
          estimatedSize: '45KB',
          component: (
            <SettingsErrorBoundary>
              <Suspense fallback={<SettingsLoadingSkeleton />}>
                <CostManagementSettings />
              </Suspense>
            </SettingsErrorBoundary>
          )
        },
        {
          id: 'security',
          title: 'Security',
          description: 'Security settings and access controls',
          icon: <Shield className="w-5 h-5" />,
          isLazy: true,
          estimatedSize: '38KB',
          component: (
            <SettingsErrorBoundary>
              <Suspense fallback={<SettingsLoadingSkeleton />}>
                <SecuritySettings />
              </Suspense>
            </SettingsErrorBoundary>
          )
        },
        {
          id: 'performance',
          title: 'Performance',
          description: 'Performance monitoring and optimization',
          icon: <Zap className="w-5 h-5" />,
          isLazy: true,
          estimatedSize: '32KB',
          component: (
            <SettingsErrorBoundary>
              <Suspense fallback={<SettingsLoadingSkeleton />}>
                <PerformanceSettings />
              </Suspense>
            </SettingsErrorBoundary>
          )
        },
        {
          id: 'layout',
          title: 'Layout & Theme',
          description: 'Customize appearance and layout',
          icon: <Palette className="w-5 h-5" />,
          isLazy: true,
          estimatedSize: '26KB',
          component: (
            <SettingsErrorBoundary>
              <Suspense fallback={<SettingsLoadingSkeleton />}>
                <LayoutSettings />
              </Suspense>
            </SettingsErrorBoundary>
          )
        },
        {
          id: 'developer',
          title: 'Developer Tools',
          description: 'Advanced tools and debugging',
          icon: <Code className="w-5 h-5" />,
          isLazy: true,
          estimatedSize: '28KB',
          component: (
            <SettingsErrorBoundary>
              <Suspense fallback={<SettingsLoadingSkeleton />}>
                <DeveloperSettings />
              </Suspense>
            </SettingsErrorBoundary>
          )
        }
      ]
    }
  ];

  // Flatten all sections for easy lookup
  const allSections = settingsCategories.flatMap(category => category.sections);

  const activeSettingsSection = allSections.find(section => section.id === activeSection);

  return (
    <div className="h-full overflow-x-hidden" style={{ backgroundColor: accentureColors.lightGray }}>
      {/* Mobile Header - Show only on mobile */}
      <div className="md:hidden border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="px-4 py-3">
          <div className="flex items-center space-x-3">
            <Settings className="w-6 h-6" style={{ color: accentureColors.purple }} />
            <div>
              <h1 className="text-lg font-bold text-gray-900">Settings</h1>
              <p className="text-sm text-gray-600">Configure your assistant</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Access Widget - Always visible at top */}
      <div className="border-b border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-700">
        <QuickAccessWidget />
      </div>

      {/* Desktop Header - Show only on desktop */}
      <div className="hidden md:block border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Settings className="w-8 h-8" style={{ color: accentureColors.purple }} />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                <p className="text-gray-600">Configure your Accenture Mainframe AI Assistant</p>
              </div>
            </div>
            <SearchCommand />
          </div>
        </div>
      </div>

      {/* Main Content Area - No internal navigation, uses SettingsNavigation from App.tsx */}
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-3 sm:py-6">
        <div className="grid grid-cols-1 gap-3 sm:gap-6">
          {/* Settings Content Panel - Full width */}
          <div className="col-span-1">
            {activeSettingsSection ? (
              activeSettingsSection.component
            ) : (
              <Card className="border-0 shadow-lg">
                <CardContent className="p-8 text-center">
                  <Shield className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-medium mb-2">Select a Settings Panel</h3>
                  <p>Choose a section from the menu to configure your settings</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;