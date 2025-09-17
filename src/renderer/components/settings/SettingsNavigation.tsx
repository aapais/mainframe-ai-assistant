/**
 * Settings Navigation System
 * Comprehensive navigation component for settings with hierarchical menu,
 * search functionality, and mobile responsiveness
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Settings,
  User,
  Sliders,
  Key,
  Cloud,
  DollarSign,
  AlertTriangle,
  FileText,
  BarChart3,
  Layout,
  Zap,
  Shield,
  Code,
  Search,
  X,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Menu,
  Home,
  Filter,
  Star,
  Clock,
  HelpCircle,
  Monitor,
  Smartphone,
  Database,
  Globe,
  Lock,
  Activity,
  Bell,
  Palette,
  GitBranch,
  Terminal,
  Eye,
  Wrench
} from 'lucide-react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import type {
  SettingsSection,
  SettingsCategory,
  SettingsNavigationProps,
  SettingsSearchResult,
  BreadcrumbItem
} from '../../types/settings';

// Accenture theme colors
const accentureTheme = {
  primary: '#A100FF',
  secondary: '#7F39FB',
  accent: '#E8D5FF',
  background: '#F5F5F5',
  surface: '#FFFFFF',
  text: '#333333',
  textSecondary: '#666666',
  border: '#E0E0E0',
  hover: '#F0F0F0',
  active: '#E8D5FF',
  disabled: '#CCCCCC',
  success: '#00B050',
  warning: '#FF8C00',
  error: '#E74C3C'
};

// Settings categories configuration
const settingsCategories: SettingsCategory[] = [
  {
    id: 'general',
    title: 'General Settings',
    description: 'Basic application preferences and user profile',
    icon: <Settings className="w-5 h-5" />,
    color: accentureTheme.primary,
    order: 1
  },
  {
    id: 'api',
    title: 'API Configuration',
    description: 'API keys and provider settings',
    icon: <Cloud className="w-5 h-5" />,
    color: '#2563EB',
    order: 2
  },
  {
    id: 'cost',
    title: 'Cost Management',
    description: 'Budget, alerts, and usage monitoring',
    icon: <DollarSign className="w-5 h-5" />,
    color: '#059669',
    order: 3
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    description: 'Layout and widget configuration',
    icon: <BarChart3 className="w-5 h-5" />,
    color: '#DC2626',
    order: 4
  },
  {
    id: 'advanced',
    title: 'Advanced',
    description: 'Performance, security, and developer settings',
    icon: <Wrench className="w-5 h-5" />,
    color: '#7C2D12',
    order: 5
  }
];

// Settings sections configuration
const settingsSections: SettingsSection[] = [
  // General Settings
  {
    id: 'profile',
    title: 'Profile',
    description: 'Manage your personal information and preferences',
    icon: <User className="w-5 h-5" />,
    path: '/settings/general/profile',
    category: settingsCategories[0],
    keywords: ['profile', 'user', 'personal', 'info', 'name', 'email'],
    subsections: [
      {
        id: 'basic-info',
        title: 'Basic Information',
        description: 'Name, email, and avatar',
        path: '/settings/general/profile/basic',
        keywords: ['name', 'email', 'avatar', 'photo']
      },
      {
        id: 'preferences',
        title: 'User Preferences',
        description: 'Language, timezone, and display options',
        path: '/settings/general/profile/preferences',
        keywords: ['language', 'timezone', 'locale', 'display']
      }
    ]
  },
  {
    id: 'general-preferences',
    title: 'Preferences',
    description: 'Application behavior and interface settings',
    icon: <Sliders className="w-5 h-5" />,
    path: '/settings/general/preferences',
    category: settingsCategories[0],
    keywords: ['preferences', 'settings', 'behavior', 'interface', 'ui', 'theme'],
    subsections: [
      {
        id: 'appearance',
        title: 'Appearance',
        description: 'Theme, colors, and visual preferences',
        path: '/settings/general/preferences/appearance',
        keywords: ['theme', 'dark', 'light', 'colors', 'appearance']
      },
      {
        id: 'notifications',
        title: 'Notifications',
        description: 'Alert preferences and notification settings',
        path: '/settings/general/preferences/notifications',
        keywords: ['notifications', 'alerts', 'sounds', 'email']
      }
    ]
  },

  // API Configuration
  {
    id: 'api-keys',
    title: 'API Keys',
    description: 'Manage API keys for various AI providers',
    icon: <Key className="w-5 h-5" />,
    path: '/settings/api/keys',
    category: settingsCategories[1],
    keywords: ['api', 'keys', 'tokens', 'authentication', 'providers'],
    badge: 'Required'
  },
  {
    id: 'provider-settings',
    title: 'Provider Settings',
    description: 'Configure AI provider-specific options',
    icon: <Cloud className="w-5 h-5" />,
    path: '/settings/api/providers',
    category: settingsCategories[1],
    keywords: ['providers', 'openai', 'anthropic', 'gemini', 'configuration'],
    subsections: [
      {
        id: 'openai',
        title: 'OpenAI',
        description: 'GPT models and configuration',
        path: '/settings/api/providers/openai',
        keywords: ['openai', 'gpt', 'chatgpt', 'models']
      },
      {
        id: 'anthropic',
        title: 'Anthropic',
        description: 'Claude models and settings',
        path: '/settings/api/providers/anthropic',
        keywords: ['anthropic', 'claude', 'models']
      },
      {
        id: 'gemini',
        title: 'Google Gemini',
        description: 'Gemini models and configuration',
        path: '/settings/api/providers/gemini',
        keywords: ['google', 'gemini', 'bard', 'models']
      }
    ]
  },

  // Cost Management
  {
    id: 'budget-settings',
    title: 'Budget Settings',
    description: 'Set spending limits and cost controls',
    icon: <DollarSign className="w-5 h-5" />,
    path: '/settings/cost/budget',
    category: settingsCategories[2],
    keywords: ['budget', 'limits', 'spending', 'cost', 'money', 'financial']
  },
  {
    id: 'alert-configuration',
    title: 'Alert Configuration',
    description: 'Configure cost alerts and notifications',
    icon: <AlertTriangle className="w-5 h-5" />,
    path: '/settings/cost/alerts',
    category: settingsCategories[2],
    keywords: ['alerts', 'notifications', 'warnings', 'thresholds', 'email']
  },
  {
    id: 'cost-reports',
    title: 'Reports',
    description: 'Usage reports and cost analysis',
    icon: <FileText className="w-5 h-5" />,
    path: '/settings/cost/reports',
    category: settingsCategories[2],
    keywords: ['reports', 'analytics', 'usage', 'statistics', 'analysis']
  },

  // Dashboard
  {
    id: 'widget-configuration',
    title: 'Widget Configuration',
    description: 'Customize dashboard widgets and layout',
    icon: <Layout className="w-5 h-5" />,
    path: '/settings/dashboard/widgets',
    category: settingsCategories[3],
    keywords: ['widgets', 'dashboard', 'layout', 'customize', 'display']
  },
  {
    id: 'layout-settings',
    title: 'Layout Settings',
    description: 'Dashboard layout and organization options',
    icon: <Monitor className="w-5 h-5" />,
    path: '/settings/dashboard/layout',
    category: settingsCategories[3],
    keywords: ['layout', 'grid', 'columns', 'rows', 'arrangement', 'responsive']
  },

  // Advanced
  {
    id: 'performance',
    title: 'Performance',
    description: 'Application performance and optimization settings',
    icon: <Zap className="w-5 h-5" />,
    path: '/settings/advanced/performance',
    category: settingsCategories[4],
    keywords: ['performance', 'speed', 'optimization', 'cache', 'memory'],
    subsections: [
      {
        id: 'caching',
        title: 'Caching',
        description: 'Cache settings and optimization',
        path: '/settings/advanced/performance/caching',
        keywords: ['cache', 'storage', 'memory', 'performance']
      },
      {
        id: 'database',
        title: 'Database',
        description: 'Database optimization settings',
        path: '/settings/advanced/performance/database',
        keywords: ['database', 'indexing', 'queries', 'optimization']
      }
    ]
  },
  {
    id: 'security',
    title: 'Security',
    description: 'Security settings and access controls',
    icon: <Shield className="w-5 h-5" />,
    path: '/settings/advanced/security',
    category: settingsCategories[4],
    keywords: ['security', 'privacy', 'encryption', 'access', 'authentication'],
    subsections: [
      {
        id: 'authentication',
        title: 'Authentication',
        description: 'Login and security options',
        path: '/settings/advanced/security/auth',
        keywords: ['authentication', 'login', 'password', '2fa', 'biometric']
      },
      {
        id: 'privacy',
        title: 'Privacy',
        description: 'Data privacy and protection settings',
        path: '/settings/advanced/security/privacy',
        keywords: ['privacy', 'data', 'protection', 'gdpr', 'compliance']
      }
    ]
  },
  {
    id: 'developer',
    title: 'Developer',
    description: 'Developer tools and debugging options',
    icon: <Code className="w-5 h-5" />,
    path: '/settings/advanced/developer',
    category: settingsCategories[4],
    keywords: ['developer', 'debug', 'logging', 'api', 'tools', 'console'],
    subsections: [
      {
        id: 'debugging',
        title: 'Debugging',
        description: 'Debug settings and logging options',
        path: '/settings/advanced/developer/debug',
        keywords: ['debug', 'logging', 'console', 'errors']
      },
      {
        id: 'api-testing',
        title: 'API Testing',
        description: 'API testing and monitoring tools',
        path: '/settings/advanced/developer/api',
        keywords: ['api', 'testing', 'monitoring', 'endpoints']
      }
    ]
  }
];

/**
 * Main Settings Navigation Component
 */
export const SettingsNavigation: React.FC<SettingsNavigationProps> = ({
  sections = settingsSections,
  categories = settingsCategories,
  currentPath = '',
  onNavigate,
  className = '',
  isMobile = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Initialize active section from current path
  useEffect(() => {
    if (currentPath) {
      const section = sections.find(s => currentPath.startsWith(s.path));
      if (section) {
        setActiveSection(section.id);
        setExpandedCategories(prev => new Set([...prev, section.category.id]));
      }
    }
  }, [currentPath, sections]);

  // Search functionality
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase();
    const results: SettingsSearchResult[] = [];

    sections.forEach(section => {
      const sectionScore = calculateRelevanceScore(section, query);
      if (sectionScore > 0) {
        results.push({
          section,
          relevanceScore: sectionScore,
          matchedKeywords: getMatchedKeywords(section, query)
        });
      }

      // Search subsections
      section.subsections?.forEach(subsection => {
        const subsectionScore = calculateRelevanceScore(subsection, query);
        if (subsectionScore > 0) {
          results.push({
            section,
            subsection,
            relevanceScore: subsectionScore,
            matchedKeywords: getMatchedKeywords(subsection, query)
          });
        }
      });
    });

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }, [searchQuery, sections]);

  // Filter sections based on search
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;

    const searchSections = new Set();
    searchResults.forEach(result => {
      searchSections.add(result.section.id);
    });

    return sections.filter(section => searchSections.has(section.id));
  }, [searchQuery, sections, searchResults]);

  // Generate breadcrumbs
  const breadcrumbs = useMemo(() => {
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
          icon: section.icon
        });

        // Check for subsection
        const subsection = section.subsections?.find(sub => currentPath.startsWith(sub.path));
        if (subsection) {
          crumbs.push({
            id: subsection.id,
            title: subsection.title,
            path: subsection.path,
            isActive: true
          });
        } else {
          crumbs[crumbs.length - 1].isActive = true;
        }
      }
    }

    return crumbs;
  }, [currentPath, sections]);

  // Event handlers
  const handleNavigate = useCallback((path: string) => {
    setActiveSection(path);
    if (isMobile) {
      setIsMobileMenuOpen(false);
    }
    onNavigate?.(path);
  }, [isMobile, onNavigate]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (value.trim()) {
      // Expand all categories when searching
      setExpandedCategories(new Set(categories.map(cat => cat.id)));
    }
  }, [categories]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  const toggleCategory = useCallback((categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  }, []);

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(prev => !prev);
  }, []);

  return (
    <div className={`settings-navigation ${className}`}>
      {/* Mobile Header */}
      {isMobile && (
        <div className="mobile-header flex items-center justify-between p-4 bg-white border-b border-gray-200">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleMobileMenu}
            className="p-2"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Settings</h1>
          <div className="w-9" /> {/* Spacer */}
        </div>
      )}

      {/* Breadcrumb Navigation */}
      {!isMobile && breadcrumbs.length > 1 && (
        <SettingsBreadcrumb
          breadcrumbs={breadcrumbs}
          onNavigate={handleNavigate}
        />
      )}

      {/* Navigation Content */}
      <div className={`navigation-content ${isMobile ? 'mobile' : 'desktop'}`}>
        {/* Search Bar */}
        <div className="search-section p-4">
          <SettingsSearch
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            onClearSearch={handleClearSearch}
            placeholder="Search settings..."
          />
        </div>

        {/* Navigation Menu */}
        <div className={`navigation-menu ${isMobile && !isMobileMenuOpen ? 'hidden' : ''}`}>
          {searchQuery.trim() ? (
            <SearchResults
              results={searchResults}
              onNavigate={handleNavigate}
              activeSection={activeSection}
            />
          ) : (
            <CategoryNavigation
              categories={categories}
              sections={filteredSections}
              expandedCategories={expandedCategories}
              activeSection={activeSection}
              onToggleCategory={toggleCategory}
              onNavigate={handleNavigate}
            />
          )}
        </div>
      </div>

      {/* Mobile Overlay */}
      {isMobile && isMobileMenuOpen && (
        <div
          className="mobile-overlay fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={toggleMobileMenu}
        />
      )}
    </div>
  );
};

/**
 * Breadcrumb Navigation Component
 */
interface SettingsBreadcrumbProps {
  breadcrumbs: BreadcrumbItem[];
  onNavigate: (path: string) => void;
}

const SettingsBreadcrumb: React.FC<SettingsBreadcrumbProps> = ({
  breadcrumbs,
  onNavigate
}) => (
  <div className="breadcrumb-navigation flex items-center space-x-2 p-4 bg-gray-50 border-b">
    {breadcrumbs.map((crumb, index) => (
      <React.Fragment key={crumb.id}>
        {index > 0 && <ChevronRight className="w-4 h-4 text-gray-400" />}
        <button
          onClick={() => !crumb.isActive && onNavigate(crumb.path)}
          className={`flex items-center space-x-1 px-2 py-1 rounded hover:bg-gray-200 transition-colors ${
            crumb.isActive ? 'text-purple-600 font-medium' : 'text-gray-600 hover:text-gray-800'
          }`}
          disabled={crumb.isActive}
        >
          {crumb.icon}
          <span className="text-sm">{crumb.title}</span>
        </button>
      </React.Fragment>
    ))}
  </div>
);

/**
 * Settings Search Component
 */
interface SettingsSearchProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
  placeholder?: string;
}

const SettingsSearch: React.FC<SettingsSearchProps> = ({
  searchQuery,
  onSearchChange,
  onClearSearch,
  placeholder = "Search settings..."
}) => (
  <div className="relative">
    <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
      <Search className="w-4 h-4 text-gray-400" />
    </div>
    <Input
      type="text"
      value={searchQuery}
      onChange={(e) => onSearchChange(e.target.value)}
      placeholder={placeholder}
      className="pl-10 pr-10"
    />
    {searchQuery && (
      <button
        onClick={onClearSearch}
        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
      >
        <X className="w-4 h-4" />
      </button>
    )}
  </div>
);

/**
 * Search Results Component
 */
interface SearchResultsProps {
  results: SettingsSearchResult[];
  onNavigate: (path: string) => void;
  activeSection: string;
}

const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  onNavigate,
  activeSection
}) => (
  <div className="search-results p-4">
    <div className="text-sm text-gray-600 mb-3">
      {results.length} result{results.length !== 1 ? 's' : ''} found
    </div>
    <div className="space-y-2">
      {results.map((result, index) => (
        <SearchResultItem
          key={`${result.section.id}-${result.subsection?.id || 'main'}-${index}`}
          result={result}
          isActive={activeSection === result.section.id}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  </div>
);

/**
 * Search Result Item Component
 */
interface SearchResultItemProps {
  result: SettingsSearchResult;
  isActive: boolean;
  onNavigate: (path: string) => void;
}

const SearchResultItem: React.FC<SearchResultItemProps> = ({
  result,
  isActive,
  onNavigate
}) => {
  const { section, subsection } = result;
  const targetPath = subsection?.path || section.path;
  const title = subsection?.title || section.title;
  const description = subsection?.description || section.description;

  return (
    <button
      onClick={() => onNavigate(targetPath)}
      className={`w-full text-left p-3 rounded-lg border transition-all ${
        isActive
          ? 'border-purple-200 bg-purple-50 shadow-sm'
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 mt-0.5" style={{ color: section.category.color }}>
          {subsection ? section.icon : section.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <h4 className="text-sm font-medium text-gray-900 truncate">
              {title}
            </h4>
            {section.badge && (
              <Badge variant="secondary" className="text-xs">
                {section.badge}
              </Badge>
            )}
          </div>
          <p className="text-xs text-gray-600 mt-1 line-clamp-2">
            {description}
          </p>
          <div className="flex items-center space-x-2 mt-2">
            <span className="text-xs text-gray-500">
              {section.category.title}
            </span>
            {subsection && (
              <>
                <ChevronRight className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-500">{section.title}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </button>
  );
};

/**
 * Category Navigation Component
 */
interface CategoryNavigationProps {
  categories: SettingsCategory[];
  sections: SettingsSection[];
  expandedCategories: Set<string>;
  activeSection: string;
  onToggleCategory: (categoryId: string) => void;
  onNavigate: (path: string) => void;
}

const CategoryNavigation: React.FC<CategoryNavigationProps> = ({
  categories,
  sections,
  expandedCategories,
  activeSection,
  onToggleCategory,
  onNavigate
}) => (
  <div className="category-navigation">
    {categories.map(category => {
      const categorySections = sections.filter(section => section.category.id === category.id);
      const isExpanded = expandedCategories.has(category.id);

      return (
        <div key={category.id} className="category-group mb-4">
          <button
            onClick={() => onToggleCategory(category.id)}
            className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0" style={{ color: category.color }}>
                {category.icon}
              </div>
              <div className="text-left">
                <h3 className="text-sm font-medium text-gray-900">
                  {category.title}
                </h3>
                <p className="text-xs text-gray-600">
                  {category.description}
                </p>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${
              isExpanded ? 'transform rotate-180' : ''
            }`} />
          </button>

          {isExpanded && (
            <div className="ml-6 mt-2 space-y-1">
              {categorySections.map(section => (
                <SectionNavigationItem
                  key={section.id}
                  section={section}
                  isActive={activeSection === section.id}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          )}
        </div>
      );
    })}
  </div>
);

/**
 * Section Navigation Item Component
 */
interface SectionNavigationItemProps {
  section: SettingsSection;
  isActive: boolean;
  onNavigate: (path: string) => void;
}

const SectionNavigationItem: React.FC<SectionNavigationItemProps> = ({
  section,
  isActive,
  onNavigate
}) => (
  <div className="section-item">
    <button
      onClick={() => onNavigate(section.path)}
      disabled={section.disabled}
      className={`w-full text-left p-2 rounded-md transition-colors ${
        isActive
          ? 'bg-purple-100 text-purple-700 border border-purple-200'
          : section.disabled
          ? 'text-gray-400 cursor-not-allowed'
          : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="flex-shrink-0">
            {section.icon}
          </div>
          <span className="text-sm font-medium">{section.title}</span>
        </div>
        {section.badge && (
          <Badge
            variant={isActive ? "default" : "secondary"}
            className="text-xs"
          >
            {section.badge}
          </Badge>
        )}
      </div>
      <p className="text-xs text-gray-600 mt-1 ml-6">
        {section.description}
      </p>
    </button>

    {/* Subsections */}
    {section.subsections && isActive && (
      <div className="ml-4 mt-2 space-y-1">
        {section.subsections.map(subsection => (
          <button
            key={subsection.id}
            onClick={() => onNavigate(subsection.path)}
            disabled={subsection.disabled}
            className={`w-full text-left p-2 rounded-md text-sm transition-colors ${
              subsection.disabled
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span>{subsection.title}</span>
              {subsection.badge && (
                <Badge variant="secondary" className="text-xs">
                  {subsection.badge}
                </Badge>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {subsection.description}
            </p>
          </button>
        ))}
      </div>
    )}
  </div>
);

// Helper functions
function calculateRelevanceScore(item: { title: string; description: string; keywords: string[] }, query: string): number {
  let score = 0;
  const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);

  searchTerms.forEach(term => {
    // Title match (highest priority)
    if (item.title.toLowerCase().includes(term)) {
      score += 10;
    }

    // Description match
    if (item.description.toLowerCase().includes(term)) {
      score += 5;
    }

    // Keywords match
    item.keywords.forEach(keyword => {
      if (keyword.toLowerCase().includes(term)) {
        score += 3;
      }
    });

    // Exact keyword match
    if (item.keywords.some(keyword => keyword.toLowerCase() === term)) {
      score += 7;
    }
  });

  return score;
}

function getMatchedKeywords(item: { title: string; keywords: string[] }, query: string): string[] {
  const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
  const matched: string[] = [];

  searchTerms.forEach(term => {
    item.keywords.forEach(keyword => {
      if (keyword.toLowerCase().includes(term) && !matched.includes(keyword)) {
        matched.push(keyword);
      }
    });
  });

  return matched;
}

export default SettingsNavigation;