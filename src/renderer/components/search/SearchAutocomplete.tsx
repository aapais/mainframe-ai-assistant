/**
 * SearchAutocomplete - High-Performance Autocomplete with Trie Data Structure
 *
 * Features:
 * - Sub-50ms autocomplete response time
 * - Trie-based client-side search for instant results
 * - Fuzzy matching for typo tolerance
 * - Recent searches with localStorage persistence
 * - Popular searches display
 * - Context-aware suggestions
 * - Keyboard navigation (arrow keys, tab, enter)
 * - Advanced search syntax highlighting
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  memo,
  KeyboardEvent,
  ChangeEvent,
  FocusEvent
} from 'react';
import { debounce } from 'lodash';
import './SearchAutocomplete.css';

// Trie Node for optimized prefix searching
class TrieNode {
  children: Map<string, TrieNode> = new Map();
  isEndOfWord: boolean = false;
  suggestions: string[] = [];
  frequency: number = 0;
  metadata?: any;
}

// High-performance Trie implementation
class AutocompleteTrie {
  private root: TrieNode = new TrieNode();
  private maxSuggestions: number = 10;

  insert(word: string, frequency: number = 1, metadata?: any): void {
    let current = this.root;
    const normalizedWord = word.toLowerCase().trim();

    for (const char of normalizedWord) {
      if (!current.children.has(char)) {
        current.children.set(char, new TrieNode());
      }
      current = current.children.get(char)!;
    }

    current.isEndOfWord = true;
    current.frequency = frequency;
    current.metadata = metadata;
  }

  search(prefix: string, limit: number = 10): string[] {
    const normalizedPrefix = prefix.toLowerCase().trim();
    if (!normalizedPrefix) return [];

    let current = this.root;
    for (const char of normalizedPrefix) {
      if (!current.children.has(char)) {
        return [];
      }
      current = current.children.get(char)!;
    }

    const suggestions: Array<{ word: string; frequency: number }> = [];
    this.collectSuggestions(current, normalizedPrefix, suggestions);

    return suggestions
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, limit)
      .map(s => s.word);
  }

  private collectSuggestions(
    node: TrieNode,
    prefix: string,
    suggestions: Array<{ word: string; frequency: number }>
  ): void {
    if (node.isEndOfWord) {
      suggestions.push({ word: prefix, frequency: node.frequency });
    }

    if (suggestions.length >= this.maxSuggestions) return;

    for (const [char, childNode] of node.children) {
      this.collectSuggestions(childNode, prefix + char, suggestions);
    }
  }

  // Fuzzy search with Levenshtein distance
  fuzzySearch(query: string, maxDistance: number = 2, limit: number = 10): string[] {
    const results: Array<{ word: string; distance: number; frequency: number }> = [];
    this.fuzzySearchHelper(this.root, '', query, 0, maxDistance, results);

    return results
      .filter(r => r.distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance || b.frequency - a.frequency)
      .slice(0, limit)
      .map(r => r.word);
  }

  private fuzzySearchHelper(
    node: TrieNode,
    prefix: string,
    target: string,
    distance: number,
    maxDistance: number,
    results: Array<{ word: string; distance: number; frequency: number }>
  ): void {
    if (distance > maxDistance) return;

    if (node.isEndOfWord && prefix.length >= target.length - maxDistance) {
      const finalDistance = this.levenshteinDistance(prefix, target);
      if (finalDistance <= maxDistance) {
        results.push({
          word: prefix,
          distance: finalDistance,
          frequency: node.frequency
        });
      }
    }

    for (const [char, childNode] of node.children) {
      // Exact match
      if (prefix.length < target.length && target[prefix.length] === char) {
        this.fuzzySearchHelper(childNode, prefix + char, target, distance, maxDistance, results);
      } else {
        // Insertion
        this.fuzzySearchHelper(childNode, prefix + char, target, distance + 1, maxDistance, results);

        // Deletion
        if (prefix.length < target.length) {
          this.fuzzySearchHelper(node, prefix, target.slice(1), distance + 1, maxDistance, results);
        }

        // Substitution
        if (prefix.length < target.length) {
          this.fuzzySearchHelper(childNode, prefix + char, target.slice(1), distance + 1, maxDistance, results);
        }
      }
    }
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + cost
        );
      }
    }

    return matrix[str2.length][str1.length];
  }
}

export interface AutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: (query: string) => void;
  onSuggestionSelect?: (suggestion: string) => void;
  placeholder?: string;
  recentSearches?: string[];
  popularSearches?: Array<{ query: string; count: number }>;
  suggestions?: string[];
  loading?: boolean;
  disabled?: boolean;
  maxSuggestions?: number;
  enableFuzzySearch?: boolean;
  enableSyntaxHighlighting?: boolean;
  autoFocus?: boolean;
  className?: string;
  debounceMs?: number;
  onFocus?: () => void;
  onBlur?: () => void;
}

interface AutocompleteSuggestion {
  text: string;
  type: 'recent' | 'popular' | 'suggestion' | 'fuzzy';
  frequency?: number;
  metadata?: any;
}

const SearchAutocomplete = memo<AutocompleteProps>(({
  value,
  onChange,
  onSearch,
  onSuggestionSelect,
  placeholder = 'Search knowledge base...',
  recentSearches = [],
  popularSearches = [],
  suggestions = [],
  loading = false,
  disabled = false,
  maxSuggestions = 10,
  enableFuzzySearch = true,
  enableSyntaxHighlighting = true,
  autoFocus = false,
  className = '',
  debounceMs = 150,
  onFocus,
  onBlur
}) => {
  // State
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [localSuggestions, setLocalSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [highlightedQuery, setHighlightedQuery] = useState('');

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const trieRef = useRef<AutocompleteTrie>();
  const suggestionRefs = useRef<Array<HTMLDivElement | null>>([]);

  // Initialize Trie with data
  useEffect(() => {
    const trie = new AutocompleteTrie();

    // Add recent searches
    recentSearches.forEach((search, index) => {
      trie.insert(search, recentSearches.length - index + 100, { type: 'recent' });
    });

    // Add popular searches
    popularSearches.forEach(({ query, count }) => {
      trie.insert(query, count + 200, { type: 'popular' });
    });

    // Add general suggestions
    suggestions.forEach((suggestion, index) => {
      trie.insert(suggestion, suggestions.length - index + 50, { type: 'suggestion' });
    });

    // Add common mainframe terms
    const mainframeTerms = [
      'jcl error', 'vsam status', 'db2 sqlcode', 'cobol abend',
      'cics transaction', 'ims database', 'batch job', 'tso command',
      'ispf panel', 'dataset allocation', 'catalog error', 'racf security',
      's0c7', 's0c4', 'u0778', 'ief212i', 'wer027a', 'sqlcode -803',
      'vsam status 35', 'vsam status 37', 'jcl syntax error'
    ];

    mainframeTerms.forEach((term, index) => {
      trie.insert(term, mainframeTerms.length - index + 10, { type: 'common' });
    });

    trieRef.current = trie;
  }, [recentSearches, popularSearches, suggestions]);

  // Debounced suggestion generation
  const generateSuggestions = useCallback(
    debounce((query: string) => {
      if (!query.trim() || !trieRef.current) {
        setLocalSuggestions([]);
        return;
      }

      const startTime = performance.now();
      const results: AutocompleteSuggestion[] = [];

      // Exact prefix matches from Trie
      const exactMatches = trieRef.current.search(query, maxSuggestions);
      exactMatches.forEach(match => {
        results.push({
          text: match,
          type: 'suggestion'
        });
      });

      // Fuzzy matches if enabled and we need more results
      if (enableFuzzySearch && results.length < maxSuggestions) {
        const fuzzyMatches = trieRef.current.fuzzySearch(
          query,
          2,
          maxSuggestions - results.length
        );

        fuzzyMatches
          .filter(match => !results.some(r => r.text === match))
          .forEach(match => {
            results.push({
              text: match,
              type: 'fuzzy'
            });
          });
      }

      // Add recent searches if query is empty or very short
      if (query.length <= 2 && results.length < maxSuggestions) {
        recentSearches
          .slice(0, maxSuggestions - results.length)
          .filter(recent => !results.some(r => r.text === recent))
          .forEach(recent => {
            results.push({
              text: recent,
              type: 'recent'
            });
          });
      }

      // Add popular searches
      if (results.length < maxSuggestions) {
        popularSearches
          .filter(popular =>
            popular.query.toLowerCase().includes(query.toLowerCase()) &&
            !results.some(r => r.text === popular.query)
          )
          .slice(0, maxSuggestions - results.length)
          .forEach(popular => {
            results.push({
              text: popular.query,
              type: 'popular',
              frequency: popular.count
            });
          });
      }

      setLocalSuggestions(results.slice(0, maxSuggestions));

      // Performance logging
      const endTime = performance.now();
      if (endTime - startTime > 50) {
        console.warn(`Autocomplete took ${(endTime - startTime).toFixed(2)}ms (target: <50ms)`);
      }
    }, debounceMs),
    [maxSuggestions, enableFuzzySearch, recentSearches, popularSearches, debounceMs]
  );

  // Handle input change
  const handleInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    onChange(newValue);

    if (enableSyntaxHighlighting) {
      setHighlightedQuery(highlightSearchSyntax(newValue));
    }

    generateSuggestions(newValue);
    setSelectedIndex(-1);
    setIsOpen(true);
  }, [onChange, generateSuggestions, enableSyntaxHighlighting]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || localSuggestions.length === 0) {
      if (event.key === 'Enter') {
        onSearch(value);
        setIsOpen(false);
        return;
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedIndex(prev =>
          prev < localSuggestions.length - 1 ? prev + 1 : 0
        );
        break;

      case 'ArrowUp':
        event.preventDefault();
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : localSuggestions.length - 1
        );
        break;

      case 'Enter':
        event.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < localSuggestions.length) {
          const selected = localSuggestions[selectedIndex];
          handleSuggestionSelect(selected.text);
        } else {
          onSearch(value);
        }
        setIsOpen(false);
        break;

      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;

      case 'Tab':
        if (selectedIndex >= 0 && selectedIndex < localSuggestions.length) {
          event.preventDefault();
          const selected = localSuggestions[selectedIndex];
          handleSuggestionSelect(selected.text);
          setIsOpen(false);
        }
        break;
    }
  }, [isOpen, localSuggestions, selectedIndex, value, onSearch]);

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback((suggestion: string) => {
    onChange(suggestion);
    onSuggestionSelect?.(suggestion);
    setIsOpen(false);
    setSelectedIndex(-1);

    // Save to recent searches
    const recent = JSON.parse(localStorage.getItem('kb-recent-searches') || '[]');
    const updated = [suggestion, ...recent.filter((s: string) => s !== suggestion)].slice(0, 20);
    localStorage.setItem('kb-recent-searches', JSON.stringify(updated));

    // Trigger search
    setTimeout(() => onSearch(suggestion), 0);
  }, [onChange, onSuggestionSelect, onSearch]);

  // Handle focus
  const handleFocus = useCallback((event: FocusEvent<HTMLInputElement>) => {
    setIsOpen(true);
    if (value.trim()) {
      generateSuggestions(value);
    } else {
      // Show recent searches when focused with empty input
      const recentSuggestions: AutocompleteSuggestion[] = recentSearches
        .slice(0, maxSuggestions)
        .map(search => ({ text: search, type: 'recent' as const }));
      setLocalSuggestions(recentSuggestions);
    }
    onFocus?.();
  }, [value, generateSuggestions, recentSearches, maxSuggestions, onFocus]);

  // Handle blur with delay to allow for click events
  const handleBlur = useCallback(() => {
    setTimeout(() => {
      setIsOpen(false);
      setSelectedIndex(-1);
      onBlur?.();
    }, 150);
  }, [onBlur]);

  // Scroll to selected item
  useEffect(() => {
    if (selectedIndex >= 0 && suggestionRefs.current[selectedIndex]) {
      suggestionRefs.current[selectedIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }, [selectedIndex]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Syntax highlighting helper
  const highlightSearchSyntax = (query: string): string => {
    if (!query) return '';

    return query
      .replace(/category:(\w+)/gi, '<span class="syntax-category">category:$1</span>')
      .replace(/tag:(\w+)/gi, '<span class="syntax-tag">tag:$1</span>')
      .replace(/"([^"]+)"/gi, '<span class="syntax-phrase">"$1"</span>')
      .replace(/AND|OR|NOT/gi, '<span class="syntax-operator">$&</span>');
  };

  // Get suggestion icon
  const getSuggestionIcon = (type: AutocompleteSuggestion['type']): string => {
    switch (type) {
      case 'recent': return '🕐';
      case 'popular': return '🔥';
      case 'fuzzy': return '🔍';
      default: return '💡';
    }
  };

  // Get suggestion label
  const getSuggestionLabel = (type: AutocompleteSuggestion['type']): string => {
    switch (type) {
      case 'recent': return 'Recent';
      case 'popular': return 'Popular';
      case 'fuzzy': return 'Did you mean?';
      default: return 'Suggestion';
    }
  };

  return (
    <div className={`search-autocomplete ${className}`}>
      <div className="search-autocomplete__input-container">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className={`search-autocomplete__input ${loading ? 'loading' : ''}`}
          autoComplete="off"
          spellCheck={false}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-activedescendant={
            selectedIndex >= 0 ? `autocomplete-option-${selectedIndex}` : undefined
          }
          role="combobox"
        />

        {loading && (
          <div className="search-autocomplete__spinner">
            <div className="spinner"></div>
          </div>
        )}

        {enableSyntaxHighlighting && highlightedQuery && (
          <div
            className="search-autocomplete__highlight"
            dangerouslySetInnerHTML={{ __html: highlightedQuery }}
            aria-hidden="true"
          />
        )}
      </div>

      {isOpen && localSuggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="search-autocomplete__dropdown"
          role="listbox"
          aria-label="Search suggestions"
        >
          {localSuggestions.map((suggestion, index) => (
            <div
              key={`${suggestion.type}-${index}`}
              ref={el => (suggestionRefs.current[index] = el)}
              className={`search-autocomplete__suggestion ${
                index === selectedIndex ? 'selected' : ''
              } search-autocomplete__suggestion--${suggestion.type}`}
              onClick={() => handleSuggestionSelect(suggestion.text)}
              role="option"
              aria-selected={index === selectedIndex}
              id={`autocomplete-option-${index}`}
            >
              <div className="search-autocomplete__suggestion-content">
                <span className="search-autocomplete__suggestion-icon">
                  {getSuggestionIcon(suggestion.type)}
                </span>
                <span className="search-autocomplete__suggestion-text">
                  {suggestion.text}
                </span>
                {suggestion.frequency && (
                  <span className="search-autocomplete__suggestion-frequency">
                    {suggestion.frequency}
                  </span>
                )}
              </div>
              <span className="search-autocomplete__suggestion-label">
                {getSuggestionLabel(suggestion.type)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

SearchAutocomplete.displayName = 'SearchAutocomplete';

export default SearchAutocomplete;