/**
 * KB Navigation Component
 * Provides intelligent navigation optimized for KB workflows
 * Features breadcrumbs, quick actions, and context-aware navigation
 */

import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronRight, Search, Plus, BarChart3, History, Settings, ArrowLeft, Share2 } from 'lucide-react';
import { useKBRouter, useKBNavigation, useSearchURL, useNavigationHistory } from '../routing/KBRouter';
import { useSearch } from '../contexts/SearchContext';
import { useApp } from '../context/AppContext';
import { KBCategory } from '../../types';

// ========================
// Navigation Types
// ========================

interface BreadcrumbItem {
  label: string;
  path: string;
  icon?: React.ReactNode;
  active?: boolean;
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  badge?: string;
  disabled?: boolean;
}

// ========================
// Main Navigation Component
// ========================

export const KBNavigation: React.FC = () => {
  const location = useLocation();
  const { state: routerState } = useKBRouter();
  const nav = useKBNavigation();
  const { getCurrentSearchURL } = useSearchURL();
  const { state: searchState } = useSearch();
  const { state: appState } = useApp();
  
  const [showShareMenu, setShowShareMenu] = useState(false);

  // Generate breadcrumbs based on current route
  const breadcrumbs = generateBreadcrumbs(location.pathname, {
    searchQuery: searchState.query,
    selectedEntry: appState.selectedEntry,
  });

  // Generate quick actions based on context
  const quickActions = generateQuickActions({
    currentRoute: location.pathname,
    hasSearchResults: searchState.results.length > 0,
    selectedEntry: appState.selectedEntry,
    navigation: nav,
  });

  return (
    <nav className="kb-navigation" role="navigation" aria-label="Knowledge Base Navigation">
      {/* Primary Navigation Bar */}
      <div className="nav-primary">
        <div className="nav-left">
          <BreadcrumbNav items={breadcrumbs} />
        </div>
        
        <div className="nav-center">
          <SearchQuickAccess />
        </div>
        
        <div className="nav-right">
          <QuickActionsMenu actions={quickActions} />
          <ShareButton 
            currentURL={getCurrentSearchURL()}
            show={showShareMenu}
            onToggle={setShowShareMenu}
          />
        </div>
      </div>

      {/* Context Bar (appears based on current route) */}
      <ContextBar />
    </nav>
  );
};

// ========================
// Breadcrumb Navigation
// ========================

interface BreadcrumbNavProps {
  items: BreadcrumbItem[];
}

const BreadcrumbNav: React.FC<BreadcrumbNavProps> = ({ items }) => {
  const nav = useKBNavigation();

  if (items.length <= 1) return null;

  return (
    <div className="breadcrumb-nav" role="navigation" aria-label="Breadcrumb">
      <ol className="breadcrumb-list">
        {items.map((item, index) => (
          <li key={`${item.path}-${index}`} className="breadcrumb-item">
            {item.active ? (
              <span className="breadcrumb-current" aria-current="page">
                {item.icon && <span className="breadcrumb-icon">{item.icon}</span>}
                {item.label}
              </span>
            ) : (
              <>
                <button
                  className="breadcrumb-link"
                  onClick={() => {
                    if (item.path === '/back') {
                      nav.back();
                    } else {
                      // Handle navigation based on path
                      if (item.path.startsWith('/search')) {
                        nav.toSearch();
                      } else if (item.path === '/') {
                        nav.toSearch();
                      }
                    }
                  }}
                  aria-label={`Navigate to ${item.label}`}
                >
                  {item.icon && <span className="breadcrumb-icon">{item.icon}</span>}
                  {item.label}
                </button>
                {index < items.length - 1 && (
                  <ChevronRight size={16} className="breadcrumb-separator" aria-hidden="true" />
                )}
              </>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
};

// ========================
// Search Quick Access
// ========================

const SearchQuickAccess: React.FC = () => {
  const { state } = useSearch();
  const nav = useKBNavigation();
  const location = useLocation();
  
  // Only show on non-search pages
  if (location.pathname.startsWith('/search')) return null;

  return (
    <div className="search-quick-access">
      <button
        className="quick-search-btn"
        onClick={() => nav.toSearch(state.query)}
        aria-label="Quick search"
      >
        <Search size={16} />
        <span className="search-hint">
          {state.query || 'Search knowledge base...'}
        </span>
        <kbd className="keyboard-shortcut">Ctrl+K</kbd>
      </button>
    </div>
  );
};

// ========================
// Quick Actions Menu
// ========================

interface QuickActionsMenuProps {
  actions: QuickAction[];
}

const QuickActionsMenu: React.FC<QuickActionsMenuProps> = ({ actions }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="quick-actions-menu">
      <button
        className="quick-actions-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label="Quick actions menu"
      >
        <Plus size={18} />
        <span>Actions</span>
      </button>

      {isOpen && (
        <div className="quick-actions-dropdown">
          <ul role="menu">
            {actions.map(action => (
              <li key={action.id}>
                <button
                  role="menuitem"
                  className={`quick-action ${action.disabled ? 'disabled' : ''}`}
                  onClick={() => {
                    action.action();
                    setIsOpen(false);
                  }}
                  disabled={action.disabled}
                >
                  <span className="action-icon">{action.icon}</span>
                  <span className="action-label">{action.label}</span>
                  {action.badge && <span className="action-badge">{action.badge}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// ========================
// Share Button
// ========================

interface ShareButtonProps {
  currentURL: string;
  show: boolean;
  onToggle: (show: boolean) => void;
}

const ShareButton: React.FC<ShareButtonProps> = ({ currentURL, show, onToggle }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentURL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };

  return (
    <div className="share-button">
      <button
        className="share-trigger"
        onClick={() => onToggle(!show)}
        aria-label="Share current view"
      >
        <Share2 size={16} />
      </button>

      {show && (
        <div className="share-dropdown">
          <div className="share-url">
            <input
              type="text"
              value={currentURL}
              readOnly
              className="share-url-input"
              aria-label="Shareable URL"
            />
            <button
              onClick={handleCopy}
              className={`copy-btn ${copied ? 'copied' : ''}`}
              aria-label={copied ? 'URL copied' : 'Copy URL'}
            >
              {copied ? '✓' : 'Copy'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ========================
// Context Bar
// ========================

const ContextBar: React.FC = () => {
  const location = useLocation();
  const { state: searchState } = useSearch();
  const { history } = useNavigationHistory();
  const nav = useKBNavigation();

  // Show context based on current route
  const getContextContent = () => {
    if (location.pathname.startsWith('/search')) {
      return (
        <SearchContextBar
          query={searchState.query}
          resultCount={searchState.results.length}
          isLoading={searchState.isSearching}
        />
      );
    }

    if (location.pathname.startsWith('/entry')) {
      return (
        <EntryContextBar
          onBack={() => nav.back()}
        />
      );
    }

    return null;
  };

  const contextContent = getContextContent();
  
  if (!contextContent) return null;

  return (
    <div className="context-bar" role="complementary">
      {contextContent}
    </div>
  );
};

// ========================
// Context Bar Components
// ========================

interface SearchContextBarProps {
  query: string;
  resultCount: number;
  isLoading: boolean;
}

const SearchContextBar: React.FC<SearchContextBarProps> = ({ query, resultCount, isLoading }) => {
  return (
    <div className="search-context">
      <div className="search-summary">
        {isLoading ? (
          <span>Searching...</span>
        ) : (
          <span>
            {resultCount > 0 
              ? `${resultCount} results${query ? ` for "${query}"` : ''}`
              : query 
                ? `No results for "${query}"`
                : 'Browse all entries'
            }
          </span>
        )}
      </div>
    </div>
  );
};

interface EntryContextBarProps {
  onBack: () => void;
}

const EntryContextBar: React.FC<EntryContextBarProps> = ({ onBack }) => {
  return (
    <div className="entry-context">
      <button className="context-back-btn" onClick={onBack}>
        <ArrowLeft size={16} />
        Back
      </button>
    </div>
  );
};

// ========================
// Helper Functions
// ========================

function generateBreadcrumbs(
  pathname: string,
  context: {
    searchQuery?: string;
    selectedEntry?: any;
  }
): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [
    { label: 'KB Assistant', path: '/', icon: <Search size={14} /> }
  ];

  if (pathname.startsWith('/search')) {
    items.push({
      label: context.searchQuery ? `Search: ${context.searchQuery}` : 'Search',
      path: '/search',
      icon: <Search size={14} />,
      active: !pathname.includes('/entry')
    });
  }

  if (pathname.includes('/entry/')) {
    if (context.selectedEntry) {
      items.push({
        label: context.selectedEntry.title || 'Entry Details',
        path: pathname,
        active: true
      });
    }
    
    if (pathname.endsWith('/edit')) {
      items.push({
        label: 'Edit',
        path: pathname,
        active: true
      });
    }
  }

  if (pathname === '/add') {
    items.push({
      label: 'Add Entry',
      path: '/add',
      icon: <Plus size={14} />,
      active: true
    });
  }

  if (pathname === '/metrics') {
    items.push({
      label: 'Analytics',
      path: '/metrics',
      icon: <BarChart3 size={14} />,
      active: true
    });
  }

  if (pathname === '/history') {
    items.push({
      label: 'History',
      path: '/history',
      icon: <History size={14} />,
      active: true
    });
  }

  return items;
}

function generateQuickActions(context: {
  currentRoute: string;
  hasSearchResults: boolean;
  selectedEntry?: any;
  navigation: any;
}): QuickAction[] {
  const actions: QuickAction[] = [];

  // Always available
  actions.push({
    id: 'add-entry',
    label: 'Add Entry',
    icon: <Plus size={16} />,
    action: () => context.navigation.toAddEntry(),
  });

  actions.push({
    id: 'search',
    label: 'Advanced Search',
    icon: <Search size={16} />,
    action: () => context.navigation.toSearch(),
  });

  // Context-specific actions
  if (context.currentRoute !== '/metrics') {
    actions.push({
      id: 'metrics',
      label: 'View Analytics',
      icon: <BarChart3 size={16} />,
      action: () => context.navigation.toMetrics(),
    });
  }

  if (context.currentRoute !== '/history') {
    actions.push({
      id: 'history',
      label: 'Search History',
      icon: <History size={16} />,
      action: () => context.navigation.toHistory(),
    });
  }

  return actions;
}

// ========================
// Keyboard Shortcuts Hook
// ========================

export const useKBKeyboardShortcuts = () => {
  const nav = useKBNavigation();
  
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + K for search
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        nav.toSearch();
      }
      
      // Ctrl/Cmd + N for new entry
      if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
        event.preventDefault();
        nav.toAddEntry();
      }
      
      // Escape to go back
      if (event.key === 'Escape') {
        nav.back();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [nav]);
};

export default KBNavigation;