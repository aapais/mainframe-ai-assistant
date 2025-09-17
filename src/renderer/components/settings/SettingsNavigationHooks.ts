/**
 * Settings Navigation Hooks
 * Custom React hooks for settings navigation functionality
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type {
  SettingsSection,
  SettingsCategory,
  SettingsNavigationState,
  SettingsSearchResult,
  BreadcrumbItem
} from '../../types/settings';

/**
 * Hook for managing settings navigation state
 */
export function useSettingsNavigation(
  sections: SettingsSection[],
  categories: SettingsCategory[]
) {
  const location = useLocation();
  const navigate = useNavigate();

  const [state, setState] = useState<SettingsNavigationState>({
    activeSection: '',
    activeSubsection: undefined,
    searchQuery: '',
    isSearching: false,
    isMobileMenuOpen: false,
    breadcrumbs: [],
    filteredSections: sections
  });

  // Update active section based on current path
  useEffect(() => {
    const currentPath = location.pathname;
    const section = sections.find(s => currentPath.startsWith(s.path));

    if (section) {
      const subsection = section.subsections?.find(sub => currentPath.startsWith(sub.path));

      setState(prev => ({
        ...prev,
        activeSection: section.id,
        activeSubsection: subsection?.id,
        breadcrumbs: generateBreadcrumbs(currentPath, sections, categories)
      }));
    }
  }, [location.pathname, sections, categories]);

  // Navigation actions
  const actions = {
    setActiveSection: useCallback((sectionId: string, subsectionId?: string) => {
      const section = sections.find(s => s.id === sectionId);
      if (!section) return;

      let targetPath = section.path;
      if (subsectionId) {
        const subsection = section.subsections?.find(sub => sub.id === subsectionId);
        if (subsection) {
          targetPath = subsection.path;
        }
      }

      navigate(targetPath);
    }, [sections, navigate]),

    setSearchQuery: useCallback((query: string) => {
      setState(prev => ({
        ...prev,
        searchQuery: query,
        isSearching: query.trim().length > 0,
        filteredSections: query.trim()
          ? filterSectionsBySearch(sections, query)
          : sections
      }));
    }, [sections]),

    clearSearch: useCallback(() => {
      setState(prev => ({
        ...prev,
        searchQuery: '',
        isSearching: false,
        filteredSections: sections
      }));
    }, [sections]),

    toggleMobileMenu: useCallback(() => {
      setState(prev => ({
        ...prev,
        isMobileMenuOpen: !prev.isMobileMenuOpen
      }));
    }, []),

    navigateToSection: useCallback((path: string) => {
      navigate(path);
      setState(prev => ({
        ...prev,
        isMobileMenuOpen: false
      }));
    }, [navigate]),

    goBack: useCallback(() => {
      navigate(-1);
    }, [navigate])
  };

  return { state, actions };
}

/**
 * Hook for settings search functionality
 */
export function useSettingsSearch(sections: SettingsSection[]) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SettingsSearchResult[]>([]);

  // Perform search when query changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const results = performSearch(sections, searchQuery);
    setSearchResults(results);
  }, [searchQuery, sections]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    clearSearch,
    hasResults: searchResults.length > 0
  };
}

/**
 * Hook for managing expanded categories
 */
export function useExpandedCategories(
  categories: SettingsCategory[],
  activeSection: string,
  sections: SettingsSection[]
) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Auto-expand category containing active section
  useEffect(() => {
    const section = sections.find(s => s.id === activeSection);
    if (section) {
      setExpandedCategories(prev => new Set([...prev, section.category.id]));
    }
  }, [activeSection, sections]);

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

  const expandAllCategories = useCallback(() => {
    setExpandedCategories(new Set(categories.map(cat => cat.id)));
  }, [categories]);

  const collapseAllCategories = useCallback(() => {
    setExpandedCategories(new Set());
  }, []);

  return {
    expandedCategories,
    toggleCategory,
    expandAllCategories,
    collapseAllCategories
  };
}

/**
 * Hook for responsive design detection
 */
export function useResponsiveNavigation() {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const checkResponsive = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      setIsTablet(width >= 768 && width < 1024);
    };

    checkResponsive();
    window.addEventListener('resize', checkResponsive);
    return () => window.removeEventListener('resize', checkResponsive);
  }, []);

  return { isMobile, isTablet, isDesktop: !isMobile && !isTablet };
}

/**
 * Hook for keyboard navigation
 */
export function useKeyboardNavigation(
  sections: SettingsSection[],
  onNavigate: (path: string) => void,
  searchQuery: string
) {
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Get navigable items based on current state
  const navigableItems = useMemo(() => {
    if (searchQuery.trim()) {
      // Return search results
      return performSearch(sections, searchQuery).map(result => ({
        id: result.subsection?.id || result.section.id,
        path: result.subsection?.path || result.section.path,
        title: result.subsection?.title || result.section.title
      }));
    } else {
      // Return all sections
      return sections.map(section => ({
        id: section.id,
        path: section.path,
        title: section.title
      }));
    }
  }, [sections, searchQuery]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle keyboard navigation when not in an input field
      if (event.target && (event.target as Element).tagName === 'INPUT') {
        return;
      }

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setFocusedIndex(prev =>
            prev < navigableItems.length - 1 ? prev + 1 : 0
          );
          break;

        case 'ArrowUp':
          event.preventDefault();
          setFocusedIndex(prev =>
            prev > 0 ? prev - 1 : navigableItems.length - 1
          );
          break;

        case 'Enter':
          event.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < navigableItems.length) {
            onNavigate(navigableItems[focusedIndex].path);
          }
          break;

        case 'Escape':
          event.preventDefault();
          setFocusedIndex(-1);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, navigableItems, onNavigate]);

  return { focusedIndex, setFocusedIndex };
}

/**
 * Hook for settings navigation analytics
 */
export function useNavigationAnalytics() {
  const [analytics, setAnalytics] = useState({
    pageViews: new Map<string, number>(),
    searchQueries: new Map<string, number>(),
    popularSections: new Map<string, number>(),
    sessionStartTime: Date.now()
  });

  const trackPageView = useCallback((path: string) => {
    setAnalytics(prev => {
      const newPageViews = new Map(prev.pageViews);
      newPageViews.set(path, (newPageViews.get(path) || 0) + 1);
      return { ...prev, pageViews: newPageViews };
    });
  }, []);

  const trackSearch = useCallback((query: string) => {
    if (!query.trim()) return;

    setAnalytics(prev => {
      const newSearchQueries = new Map(prev.searchQueries);
      newSearchQueries.set(query.toLowerCase(), (newSearchQueries.get(query.toLowerCase()) || 0) + 1);
      return { ...prev, searchQueries: newSearchQueries };
    });
  }, []);

  const trackSectionAccess = useCallback((sectionId: string) => {
    setAnalytics(prev => {
      const newPopularSections = new Map(prev.popularSections);
      newPopularSections.set(sectionId, (newPopularSections.get(sectionId) || 0) + 1);
      return { ...prev, popularSections: newPopularSections };
    });
  }, []);

  const getAnalyticsSummary = useCallback(() => {
    const sessionDuration = Date.now() - analytics.sessionStartTime;
    const totalPageViews = Array.from(analytics.pageViews.values()).reduce((sum, count) => sum + count, 0);
    const totalSearches = Array.from(analytics.searchQueries.values()).reduce((sum, count) => sum + count, 0);

    return {
      sessionDuration,
      totalPageViews,
      totalSearches,
      mostViewedPages: Array.from(analytics.pageViews.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5),
      topSearchQueries: Array.from(analytics.searchQueries.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5),
      popularSections: Array.from(analytics.popularSections.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
    };
  }, [analytics]);

  return {
    trackPageView,
    trackSearch,
    trackSectionAccess,
    getAnalyticsSummary
  };
}

// Helper functions
function generateBreadcrumbs(
  currentPath: string,
  sections: SettingsSection[],
  categories: SettingsCategory[]
): BreadcrumbItem[] {
  const breadcrumbs: BreadcrumbItem[] = [
    {
      id: 'settings',
      title: 'Settings',
      path: '/settings'
    }
  ];

  const section = sections.find(s => currentPath.startsWith(s.path));
  if (section) {
    breadcrumbs.push({
      id: section.category.id,
      title: section.category.title,
      path: `/settings/${section.category.id}`,
      icon: section.category.icon
    });

    breadcrumbs.push({
      id: section.id,
      title: section.title,
      path: section.path,
      icon: section.icon
    });

    const subsection = section.subsections?.find(sub => currentPath.startsWith(sub.path));
    if (subsection) {
      breadcrumbs.push({
        id: subsection.id,
        title: subsection.title,
        path: subsection.path,
        isActive: true
      });
    } else {
      breadcrumbs[breadcrumbs.length - 1].isActive = true;
    }
  }

  return breadcrumbs;
}

function filterSectionsBySearch(sections: SettingsSection[], query: string): SettingsSection[] {
  const searchResults = performSearch(sections, query);
  const sectionIds = new Set(searchResults.map(result => result.section.id));
  return sections.filter(section => sectionIds.has(section.id));
}

function performSearch(sections: SettingsSection[], query: string): SettingsSearchResult[] {
  const searchTerms = query.toLowerCase().trim().split(' ').filter(term => term.length > 0);
  const results: SettingsSearchResult[] = [];

  sections.forEach(section => {
    const sectionScore = calculateSearchScore(section, searchTerms);
    if (sectionScore > 0) {
      results.push({
        section,
        relevanceScore: sectionScore,
        matchedKeywords: getMatchedKeywords(section, searchTerms)
      });
    }

    section.subsections?.forEach(subsection => {
      const subsectionScore = calculateSearchScore(subsection, searchTerms);
      if (subsectionScore > 0) {
        results.push({
          section,
          subsection,
          relevanceScore: subsectionScore,
          matchedKeywords: getMatchedKeywords(subsection, searchTerms)
        });
      }
    });
  });

  return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

function calculateSearchScore(
  item: { title: string; description: string; keywords: string[] },
  searchTerms: string[]
): number {
  let score = 0;

  searchTerms.forEach(term => {
    // Title matches (highest priority)
    if (item.title.toLowerCase().includes(term)) {
      score += 10;
      if (item.title.toLowerCase().startsWith(term)) {
        score += 5; // Bonus for starting with term
      }
    }

    // Description matches
    if (item.description.toLowerCase().includes(term)) {
      score += 5;
    }

    // Keyword matches
    item.keywords.forEach(keyword => {
      if (keyword.toLowerCase().includes(term)) {
        score += 3;
        if (keyword.toLowerCase() === term) {
          score += 4; // Bonus for exact match
        }
      }
    });
  });

  return score;
}

function getMatchedKeywords(
  item: { keywords: string[] },
  searchTerms: string[]
): string[] {
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