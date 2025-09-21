/**
 * useSearchState - Centralized Search State Management
 * Part of HIVE Claude Flow improvements
 */

import { useState, useCallback } from 'react';

export interface SearchSuggestion {
  id: string;
  text: string;
  type: 'recent' | 'popular' | 'quick-action';
  icon?: string;
  action?: () => void;
}

export interface SearchState {
  query: string;
  useAI: boolean;
  showSuggestions: boolean;
  showFilters: boolean;
  suggestions: SearchSuggestion[];
  selectedSuggestionIndex: number;
  selectedCategory: string;
  selectedTags: string[];
  recentSearches: string[];
  isLoading: boolean;
}

export interface SearchActions {
  setQuery: (query: string) => void;
  setUseAI: (useAI: boolean) => void;
  setShowSuggestions: (show: boolean) => void;
  setShowFilters: (show: boolean) => void;
  setSuggestions: (suggestions: SearchSuggestion[]) => void;
  setSelectedSuggestionIndex: (index: number) => void;
  setSelectedCategory: (category: string) => void;
  setSelectedTags: (tags: string[]) => void;
  addRecentSearch: (search: string) => void;
  clearFilters: () => void;
  setLoading: (loading: boolean) => void;
}

const initialState: SearchState = {
  query: '',
  useAI: false,
  showSuggestions: false,
  showFilters: false,
  suggestions: [
    {
      id: '1',
      text: 'S0C4 ABEND em programa COBOL',
      type: 'popular',
      icon: '🔴'
    },
    {
      id: '2',
      text: 'IMS deadlock de transação',
      type: 'popular',
      icon: '⚠️'
    }
  ],
  selectedSuggestionIndex: -1,
  selectedCategory: 'all',
  selectedTags: [],
  recentSearches: [],
  isLoading: false
};

export function useSearchState(): [SearchState, SearchActions] {
  const [state, setState] = useState<SearchState>(initialState);

  const actions: SearchActions = {
    setQuery: useCallback((query: string) => {
      setState(prev => ({ ...prev, query }));
    }, []),

    setUseAI: useCallback((useAI: boolean) => {
      setState(prev => ({ ...prev, useAI }));
    }, []),

    setShowSuggestions: useCallback((showSuggestions: boolean) => {
      setState(prev => ({ ...prev, showSuggestions }));
    }, []),

    setShowFilters: useCallback((showFilters: boolean) => {
      setState(prev => ({ ...prev, showFilters }));
    }, []),

    setSuggestions: useCallback((suggestions: SearchSuggestion[]) => {
      setState(prev => ({ ...prev, suggestions }));
    }, []),

    setSelectedSuggestionIndex: useCallback((selectedSuggestionIndex: number) => {
      setState(prev => ({ ...prev, selectedSuggestionIndex }));
    }, []),

    setSelectedCategory: useCallback((selectedCategory: string) => {
      setState(prev => ({ ...prev, selectedCategory }));
    }, []),

    setSelectedTags: useCallback((selectedTags: string[]) => {
      setState(prev => ({ ...prev, selectedTags }));
    }, []),

    addRecentSearch: useCallback((search: string) => {
      setState(prev => ({
        ...prev,
        recentSearches: [search, ...prev.recentSearches.filter(s => s !== search)].slice(0, 10)
      }));
    }, []),

    clearFilters: useCallback(() => {
      setState(prev => ({
        ...prev,
        selectedCategory: 'all',
        selectedTags: []
      }));
    }, []),

    setLoading: useCallback((isLoading: boolean) => {
      setState(prev => ({ ...prev, isLoading }));
    }, [])
  };

  return [state, actions];
}
