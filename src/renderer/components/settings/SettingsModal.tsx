/**
 * Settings Modal Component
 * Enhanced modal for settings with accessibility, mobile optimization, and improved UX
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
  ModalClose
} from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SettingsNavigation } from './SettingsNavigation';

// Import all Settings components
import ProfileSettings from './ProfileSettings';
import APISettings from './APISettings';
import AISettings from './AISettings';
import NotificationSettings from './NotificationSettings';
import SecuritySettings from './SecuritySettings';
import DatabaseSettings from './DatabaseSettings';
import PreferencesSettings from './PreferencesSettings';
import LayoutSettings from './LayoutSettings';
import PerformanceSettings from './PerformanceSettings';
import CostManagementSettings from './CostManagementSettings';
import DeveloperSettings from './DeveloperSettings';
import IntegrationsSettings from './IntegrationsSettings';
import WidgetConfigurationSettings from './WidgetConfigurationSettings';
import FloatingWidgetSettings from './FloatingWidgetSettings';

import {
  Settings,
  Search,
  X,
  ChevronLeft,
  Home,
  Loader,
  Check,
  AlertCircle,
  Menu,
  DollarSign,
  Brain,
  Shield,
  User,
  Palette,
  BarChart3
} from 'lucide-react';
import { cn } from '../../utils/className';
import type { SettingsSection, SettingsCategory, BreadcrumbItem } from '../../types/settings';

// Enhanced toast notification system
interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPath?: string;
  onNavigate?: (path: string) => void;
  sections?: SettingsSection[];
  categories?: SettingsCategory[];
  isMobile?: boolean;
}

/**
 * Toast Component with auto-dismiss and accessibility
 */
const Toast: React.FC<{
  toast: ToastNotification;
  onDismiss: (id: string) => void;
}> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, toast.duration || 4000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <Check className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-amber-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-blue-500" />;
    }
  };

  const getBgColor = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-amber-50 border-amber-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 rounded-lg border shadow-lg transition-all duration-300',
        'animate-in slide-in-from-right-full',
        getBgColor()
      )}
      role="alert"
      aria-live="polite"
    >
      {getIcon()}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900">{toast.title}</div>
        {toast.message && (
          <div className="text-sm text-gray-600 mt-1">{toast.message}</div>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

/**
 * Loading Skeleton for Settings Content
 */
const SettingsLoadingSkeleton: React.FC = () => (
  <div className="animate-pulse space-y-6 p-6">
    <div className="h-8 bg-gray-200 rounded w-1/3"></div>
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
);

/**
 * Enhanced Breadcrumb Navigation
 */
const EnhancedBreadcrumb: React.FC<{
  breadcrumbs: BreadcrumbItem[];
  onNavigate: (path: string) => void;
  isMobile?: boolean;
}> = ({ breadcrumbs, onNavigate, isMobile }) => {
  if (breadcrumbs.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center space-x-2 px-4 py-2 border-b bg-gray-50">
      {isMobile ? (
        // Mobile: Show only back button and current page
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate(breadcrumbs[breadcrumbs.length - 2]?.path || '/settings')}
            className="p-1"
            aria-label="Go back"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium text-gray-900">
            {breadcrumbs[breadcrumbs.length - 1]?.title}
          </span>
        </div>
      ) : (
        // Desktop: Show full breadcrumb trail
        <ol className="flex items-center space-x-2">
          {breadcrumbs.map((crumb, index) => (
            <li key={crumb.id} className="flex items-center">
              {index > 0 && <span className="text-gray-400 mx-2">/</span>}
              <button
                onClick={() => !crumb.isActive && onNavigate(crumb.path)}
                className={cn(
                  'flex items-center space-x-1 px-2 py-1 rounded text-sm transition-colors',
                  crumb.isActive
                    ? 'text-purple-600 font-medium'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                )}
                disabled={crumb.isActive}
                aria-current={crumb.isActive ? 'page' : undefined}
              >
                {crumb.icon}
                <span>{crumb.title}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </nav>
  );
};

/**
 * Main Settings Modal Component
 */
// Default settings sections and categories
const defaultCategories: SettingsCategory[] = [
  {
    id: 'general',
    title: 'General',
    description: 'General application settings and preferences',
    icon: <Settings className="w-4 h-4" />,
    color: 'blue',
    order: 1
  },
  {
    id: 'cost',
    title: 'Cost Management',
    description: 'Budget limits and cost tracking settings',
    icon: <DollarSign className="w-4 h-4" />,
    color: 'green',
    order: 2
  },
  {
    id: 'ai',
    title: 'AI Configuration',
    description: 'AI models and behavior settings',
    icon: <Brain className="w-4 h-4" />,
    color: 'purple',
    order: 3
  },
  {
    id: 'security',
    title: 'Security',
    description: 'Security and privacy settings',
    icon: <Shield className="w-4 h-4" />,
    color: 'red',
    order: 4
  }
];

const defaultSections: SettingsSection[] = [
  {
    id: 'profile',
    title: 'Profile',
    description: 'Manage your user profile and account information',
    icon: <User className="w-4 h-4" />,
    path: '/settings/general/profile',
    category: defaultCategories[0],
    keywords: ['profile', 'account', 'user', 'personal', 'info']
  },
  {
    id: 'preferences',
    title: 'Preferences',
    description: 'Customize your application preferences and appearance',
    icon: <Palette className="w-4 h-4" />,
    path: '/settings/general/preferences',
    category: defaultCategories[0],
    keywords: ['preferences', 'theme', 'appearance', 'ui', 'interface']
  },
  {
    id: 'budget',
    title: 'Budget Limits',
    description: 'Set and manage your budget limits and spending controls',
    icon: <BarChart3 className="w-4 h-4" />,
    path: '/settings/cost/budget',
    category: defaultCategories[1],
    keywords: ['budget', 'limits', 'cost', 'spending', 'money', 'finance']
  },
  {
    id: 'models',
    title: 'AI Models',
    description: 'Configure AI models and their behavior settings',
    icon: <Brain className="w-4 h-4" />,
    path: '/settings/ai/models',
    category: defaultCategories[2],
    keywords: ['ai', 'models', 'artificial', 'intelligence', 'behavior']
  }
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onOpenChange,
  currentPath = '/settings',
  onNavigate,
  sections = defaultSections,
  categories = defaultCategories,
  isMobile = false
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [activeSection, setActiveSection] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Auto-detect mobile based on viewport
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setViewportWidth(window.innerWidth);
      // Auto-collapse sidebar on mobile, but don't auto-expand on desktop
      if (window.innerWidth < 768 && !sidebarCollapsed) {
        setSidebarCollapsed(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarCollapsed]);

  const isMobileView = viewportWidth < 768;

  // Generate breadcrumbs
  const breadcrumbs = useMemo((): BreadcrumbItem[] => {
    const crumbs: BreadcrumbItem[] = [
      {
        id: 'home',
        title: 'Settings',
        path: '/settings',
        icon: <Settings className="w-4 h-4" />
      }
    ];

    if (currentPath && currentPath !== '/settings') {
      const section = sections.find(s => currentPath.startsWith(s.path));
      if (section) {
        crumbs.push({
          id: section.category.id,
          title: section.category.title,
          path: `/settings/${section.category.id}`,
          icon: section.category.icon
        });

        crumbs.push({
          id: section.id,
          title: section.title,
          path: section.path,
          icon: section.icon,
          isActive: true
        });
      }
    }

    return crumbs;
  }, [currentPath, sections]);

  // Toast management
  const addToast = useCallback((toast: Omit<ToastNotification, 'id'>) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { ...toast, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Navigation with loading states
  const handleNavigate = useCallback(async (path: string) => {
    try {
      setIsLoading(true);

      // Simulate async navigation (if needed for data loading)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Update local state immediately
      setActiveSection(path);
      console.log('[SettingsModal] Navigation clicked, setting activeSection to:', path);

      // Also call parent's onNavigate if provided
      if (onNavigate) {
        onNavigate(path);
      }

      // Auto-collapse sidebar on mobile after navigation
      if (isMobileView) {
        setSidebarCollapsed(true);
      }

      addToast({
        type: 'success',
        title: 'Settings Updated',
        message: 'Navigation completed successfully',
        duration: 2000
      });
    } catch (error) {
      console.error('Navigation error:', error);
      addToast({
        type: 'error',
        title: 'Navigation Error',
        message: 'Failed to navigate to the selected section'
      });
    } finally {
      setIsLoading(false);
    }
  }, [onNavigate, isMobileView, addToast]);

  // Render settings content based on current path
  const renderSettingsContent = useCallback(() => {
    // IMPORTANT: Use activeSection as primary source since currentPath isn't updating
    const effectivePath = activeSection || currentPath || '/settings';

    // Debug log to track state
    if (typeof window !== 'undefined') {
      console.log('[SettingsModal] Rendering content for path:', effectivePath);
    }

    // Default welcome screen when no specific section is selected
    if (!effectivePath || effectivePath === '/settings' || effectivePath === '') {
      return (
        <div className="space-y-6">
          <div className="text-center py-12">
            <Settings className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Settings Panel
            </h3>
            <p className="text-gray-600 mb-6">
              Select a category from the sidebar to configure your settings.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl mx-auto">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 cursor-pointer transition-colors"
                  onClick={() => {
                    const firstSection = sections.find(s => s.category.id === category.id);
                    if (firstSection) {
                      handleNavigate(firstSection.path);
                    }
                  }}
                >
                  <div className="flex items-center space-x-3 mb-2">
                    <div style={{ color: category.color }}>
                      {category.icon}
                    </div>
                    <h4 className="font-medium text-gray-900">{category.title}</h4>
                  </div>
                  <p className="text-sm text-gray-600">{category.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // Render specific settings component based on path
    // Check both full path and partial matches for better reliability
    if (effectivePath.includes('profile') || effectivePath === '/settings/general/profile') {
      console.log('[SettingsModal] Rendering ProfileSettings component');
      return <ProfileSettings />;
    }
    if (effectivePath.includes('preferences') || effectivePath === '/settings/general/preferences') {
      console.log('[SettingsModal] Rendering PreferencesSettings component');
      return <PreferencesSettings />;
    }
    if (effectivePath.includes('/api/ai')) {
      console.log('[SettingsModal] Rendering AISettings component');
      return <AISettings />;
    }
    if (effectivePath.includes('/api')) {
      return <APISettings />;
    }
    if (effectivePath.includes('/cost')) {
      return <CostManagementSettings />;
    }
    if (effectivePath.includes('/dashboard/widgets')) {
      return <WidgetConfigurationSettings />;
    }
    if (effectivePath.includes('/dashboard/floating')) {
      return <FloatingWidgetSettings />;
    }
    if (effectivePath.includes('/dashboard/layout')) {
      return <LayoutSettings />;
    }
    if (effectivePath.includes('/advanced/performance')) {
      return <PerformanceSettings />;
    }
    if (effectivePath.includes('/advanced/security')) {
      return <SecuritySettings />;
    }
    if (effectivePath.includes('/advanced/developer')) {
      return <DeveloperSettings />;
    }
    if (effectivePath.includes('/database')) {
      return <DatabaseSettings />;
    }
    if (effectivePath.includes('/notifications')) {
      return <NotificationSettings />;
    }
    if (effectivePath.includes('/integrations')) {
      return <IntegrationsSettings />;
    }

    // Fallback for unknown paths
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Settings Section Not Found
          </h3>
          <p className="text-gray-600 mb-4">
            The requested settings section could not be found.
          </p>
          <Button
            onClick={() => handleNavigate('/settings')}
            variant="outline"
          >
            Return to Settings Home
          </Button>
        </div>
      </div>
    );
  }, [currentPath, activeSection, categories, sections, handleNavigate]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + K for search
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        document.getElementById('settings-search')?.focus();
      }

      // Ctrl/Cmd + Shift + S for home
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'S') {
        event.preventDefault();
        handleNavigate('/settings');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleNavigate]);

  // Swipe-to-close for mobile
  useEffect(() => {
    if (!open || !isMobileView) return;

    let startY = 0;
    let currentY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      currentY = e.touches[0].clientY;
      const diff = currentY - startY;

      // Only allow downward swipes from top third of screen
      if (startY < window.innerHeight / 3 && diff > 100) {
        onOpenChange(false);
      }
    };

    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchmove', handleTouchMove);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, [open, isMobileView, onOpenChange]);

  const modalSize = isMobileView ? 'mobile' : '5xl';

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        closeOnOverlayClick={!isMobileView} // Prevent accidental closes on mobile
        closeOnEscape={true}
        preventBodyScroll={true}
      >
        <ModalContent size={modalSize} open={open} className="h-full max-h-[95vh] flex flex-col">
          {/* Header */}
          <ModalHeader className="flex-shrink-0 flex items-center justify-between p-4 border-b">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-2"
                aria-label={isMobileView ? "Toggle menu" : "Toggle sidebar"}
              >
                <Menu className="w-5 h-5" />
              </Button>
              <div className="flex items-center space-x-2">
                <Settings className="w-6 h-6 text-purple-600" />
                <ModalTitle>Settings</ModalTitle>
              </div>
            </div>

            {/* Search bar for desktop */}
            {!isMobileView && (
              <div className="flex-1 max-w-md mx-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="settings-search"
                    type="text"
                    placeholder="Search settings... (Ctrl+K)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4"
                  />
                </div>
              </div>
            )}

            <ModalClose />
          </ModalHeader>

          {/* Breadcrumb - Show on all devices */}
          <EnhancedBreadcrumb
            breadcrumbs={breadcrumbs}
            onNavigate={handleNavigate}
            isMobile={isMobileView}
          />

          {/* Body */}
          <ModalBody className="flex-1 flex overflow-hidden p-0">
            {/* Sidebar Navigation */}
            <div className={cn(
              'transition-all duration-300 ease-in-out',
              isMobileView ? (
                sidebarCollapsed
                  ? 'w-0 overflow-hidden'
                  : 'w-full'
              ) : (
                sidebarCollapsed
                  ? 'w-16'
                  : 'w-80'
              ),
              'flex-shrink-0 border-r border-gray-200 bg-gray-50'
            )}>
              {!sidebarCollapsed && (
                <>
                  {/* Mobile search */}
                  {isMobileView && (
                    <div className="p-4 border-b">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          type="text"
                          placeholder="Search..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto">
                    {/* Error boundary for SettingsNavigation */}
                    {(() => {
                      try {
                        return (
                          <SettingsNavigation
                            sections={sections}
                            categories={categories}
                            currentPath={currentPath}
                            onNavigate={handleNavigate}
                            isMobile={isMobileView}
                          />
                        );
                      } catch (error) {
                        console.error('SettingsNavigation error:', error);
                        return (
                          <div className="p-4 text-center">
                            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
                            <p className="text-sm text-gray-600">Navigation component error</p>
                            <button
                              onClick={() => window.location.reload()}
                              className="mt-2 text-xs text-blue-600 hover:underline"
                            >
                              Reload page
                            </button>
                          </div>
                        );
                      }
                    })()}
                  </div>
                </>
              )}
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <SettingsLoadingSkeleton />
              ) : (
                <div className="p-6">
                  <div className="max-w-4xl mx-auto">
                    {renderSettingsContent()}
                  </div>
                </div>
              )}
            </div>
          </ModalBody>

          {/* Footer */}
          <ModalFooter className="flex-shrink-0 flex items-center justify-between p-4 border-t bg-gray-50">
            <div className="text-sm text-gray-500">
              Tip: Use Ctrl+K to search settings
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button variant="gradient" onClick={() => {
                addToast({
                  type: 'success',
                  title: 'Settings Saved',
                  message: 'Your preferences have been updated successfully'
                });
              }}>
                Save Changes
              </Button>
            </div>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[10000] space-y-2 max-w-sm w-full">
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} onDismiss={removeToast} />
        ))}
      </div>
    </>
  );
};

export default SettingsModal;