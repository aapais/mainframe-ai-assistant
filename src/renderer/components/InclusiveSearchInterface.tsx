/**
 * Inclusive Search Interface Component
 *
 * Demonstrates comprehensive inclusive design principles across all accessibility dimensions:
 * - Cognitive: Simple, clear interactions with contextual help
 * - Motor: Large touch targets, multiple input methods, gesture support
 * - Visual: High contrast support, scalable text, motion control
 * - Auditory: Screen reader optimization, visual alternatives for audio
 * - Situational: Works in various environments and conditions
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Mic, X, Settings, HelpCircle, Volume2, VolumeX } from 'lucide-react';
import {
  useFocusManagement,
  useAnnouncements,
  useReducedMotion,
  useHighContrast,
  VisuallyHidden,
  LiveRegion
} from '../utils/accessibility';

interface SearchResult {
  id: string;
  title: string;
  description: string;
  category: string;
  relevance: number;
}

interface InclusiveSearchProps {
  onSearch?: (query: string) => Promise<SearchResult[]>;
  placeholder?: string;
  helpText?: string;
  enableVoice?: boolean;
  enableGestures?: boolean;
  simpleMode?: boolean;
  onModeChange?: (simple: boolean) => void;
}

export const InclusiveSearchInterface: React.FC<InclusiveSearchProps> = ({
  onSearch,
  placeholder = "Search knowledge base...",
  helpText = "Enter keywords to search for mainframe documentation and solutions",
  enableVoice = true,
  enableGestures = true,
  simpleMode = false,
  onModeChange
}) => {
  // State management
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [highContrastMode, setHighContrastMode] = useState(false);

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const voiceButtonRef = useRef<HTMLButtonElement>(null);
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);

  // Accessibility hooks
  const { announce, announceImmediate } = useAnnouncements();
  const { pushFocus, popFocus } = useFocusManagement();
  const prefersReducedMotion = useReducedMotion();
  const prefersHighContrast = useHighContrast();

  // Voice recognition setup
  useEffect(() => {
    if (enableVoice && 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      speechRecognitionRef.current = new SpeechRecognition();

      const recognition = speechRecognitionRef.current;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsVoiceActive(true);
        announce('Voice recognition started. Speak your search query.');
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setQuery(transcript);
        announce(`Voice input received: ${transcript}`);
        handleSearch(transcript);
      };

      recognition.onerror = (event) => {
        setIsVoiceActive(false);
        setError('Voice recognition error. Please try typing your search.');
        announce('Voice recognition failed. Please use the text input instead.');
      };

      recognition.onend = () => {
        setIsVoiceActive(false);
      };
    }
  }, [enableVoice]);

  // Handle search with error management and loading states
  const handleSearch = useCallback(async (searchQuery: string = query) => {
    if (!searchQuery.trim()) {
      setError('Please enter a search term');
      searchInputRef.current?.focus();
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      announce(`Searching for: ${searchQuery}`);

      const searchResults = onSearch ? await onSearch(searchQuery) : [];
      setResults(searchResults);

      // Announce results
      const resultCount = searchResults.length;
      if (resultCount === 0) {
        announceImmediate('No results found. Try different keywords or check spelling.');
      } else {
        announce(`Found ${resultCount} result${resultCount === 1 ? '' : 's'}`);
      }

      // Play sound feedback if enabled
      if (soundEnabled && resultCount > 0) {
        playSearchCompleteSound();
      }

    } catch (err) {
      const errorMessage = 'Search failed. Please try again or contact support.';
      setError(errorMessage);
      announceImmediate(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [query, onSearch, announce, announceImmediate, soundEnabled]);

  // Voice search activation
  const startVoiceSearch = useCallback(() => {
    if (speechRecognitionRef.current && !isVoiceActive) {
      speechRecognitionRef.current.start();
    }
  }, [isVoiceActive]);

  // Clear search
  const clearSearch = useCallback(() => {
    setQuery('');
    setResults([]);
    setError(null);
    searchInputRef.current?.focus();
    announce('Search cleared');
  }, [announce]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + K to focus search
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
        announce('Search focused');
      }

      // Escape to clear search or close help
      if (event.key === 'Escape') {
        if (showHelp) {
          setShowHelp(false);
          announce('Help closed');
        } else if (query) {
          clearSearch();
        }
      }

      // F1 for help
      if (event.key === 'F1') {
        event.preventDefault();
        setShowHelp(!showHelp);
        announce(showHelp ? 'Help closed' : 'Help opened');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [query, showHelp, clearSearch, announce]);

  // Touch/gesture support
  const handleTouchStart = useRef<{ x: number; y: number; time: number } | null>(null);

  const onTouchStart = (event: React.TouchEvent) => {
    if (!enableGestures) return;

    const touch = event.touches[0];
    handleTouchStart.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    if (!enableGestures || !handleTouchStart.current) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - handleTouchStart.current.x;
    const deltaY = touch.clientY - handleTouchStart.current.y;
    const deltaTime = Date.now() - handleTouchStart.current.time;

    // Swipe right to clear (if swipe is long enough and quick enough)
    if (deltaX > 100 && Math.abs(deltaY) < 50 && deltaTime < 500) {
      clearSearch();
      announce('Swipe right detected - search cleared');
    }

    // Double tap to activate voice search
    if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10 && deltaTime < 200) {
      // This would need more sophisticated double-tap detection
      if (enableVoice) {
        startVoiceSearch();
      }
    }

    handleTouchStart.current = null;
  };

  // Audio feedback
  const playSearchCompleteSound = () => {
    if (soundEnabled && 'AudioContext' in window) {
      try {
        const audioContext = new AudioContext();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
      } catch (error) {
        console.warn('Audio feedback not available:', error);
      }
    }
  };

  // Dynamic styles based on preferences
  const containerClasses = [
    'search-interface',
    prefersHighContrast || highContrastMode ? 'high-contrast' : '',
    prefersReducedMotion ? 'reduced-motion' : '',
    simpleMode ? 'simple-mode' : '',
    isLoading ? 'loading' : ''
  ].filter(Boolean).join(' ');

  return (
    <div
      className={containerClasses}
      role="search"
      aria-label="Knowledge base search"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        '--search-container-padding': simpleMode ? '20px' : '16px',
        '--touch-target-size': '44px',
        '--font-size-base': simpleMode ? '18px' : '16px'
      } as React.CSSProperties}
    >
      {/* Skip link for keyboard users */}
      <a
        href="#search-results"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          resultsContainerRef.current?.focus();
        }}
      >
        Skip to search results
      </a>

      {/* Search controls header */}
      <div className="search-header">
        <h2 id="search-heading" className="search-title">
          {simpleMode ? 'Simple Search' : 'Knowledge Base Search'}
        </h2>

        <div className="search-controls" role="toolbar" aria-label="Search options">
          {/* Simple mode toggle */}
          <button
            className="control-button"
            aria-pressed={simpleMode}
            onClick={() => {
              const newMode = !simpleMode;
              onModeChange?.(newMode);
              announce(`${newMode ? 'Simple' : 'Advanced'} mode activated`);
            }}
            title={simpleMode ? "Switch to advanced mode" : "Switch to simple mode"}
            style={{ minWidth: '44px', minHeight: '44px' }}
          >
            <Settings size={20} />
            <VisuallyHidden>
              {simpleMode ? 'Switch to advanced mode' : 'Switch to simple mode'}
            </VisuallyHidden>
          </button>

          {/* High contrast toggle */}
          <button
            className="control-button"
            aria-pressed={highContrastMode}
            onClick={() => {
              setHighContrastMode(!highContrastMode);
              announce(`High contrast ${!highContrastMode ? 'enabled' : 'disabled'}`);
            }}
            title="Toggle high contrast mode"
            style={{ minWidth: '44px', minHeight: '44px' }}
          >
            <span style={{ fontSize: '20px' }}>⚫⚪</span>
            <VisuallyHidden>Toggle high contrast mode</VisuallyHidden>
          </button>

          {/* Sound toggle */}
          <button
            className="control-button"
            aria-pressed={soundEnabled}
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              announce(`Sound feedback ${!soundEnabled ? 'enabled' : 'disabled'}`);
            }}
            title="Toggle sound feedback"
            style={{ minWidth: '44px', minHeight: '44px' }}
          >
            {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            <VisuallyHidden>Toggle sound feedback</VisuallyHidden>
          </button>

          {/* Help button */}
          <button
            className="control-button"
            aria-pressed={showHelp}
            onClick={() => setShowHelp(!showHelp)}
            title="Toggle help information"
            style={{ minWidth: '44px', minHeight: '44px' }}
          >
            <HelpCircle size={20} />
            <VisuallyHidden>Toggle help information</VisuallyHidden>
          </button>
        </div>
      </div>

      {/* Help panel */}
      {showHelp && (
        <div
          className="help-panel"
          role="region"
          aria-labelledby="help-heading"
          id="search-help"
        >
          <h3 id="help-heading">Search Help</h3>
          <div className="help-content">
            <p>{helpText}</p>

            <div className="help-section">
              <h4>Keyboard Shortcuts:</h4>
              <ul>
                <li><kbd>Ctrl+K</kbd> or <kbd>Cmd+K</kbd> - Focus search</li>
                <li><kbd>Enter</kbd> - Start search</li>
                <li><kbd>Escape</kbd> - Clear search or close help</li>
                <li><kbd>F1</kbd> - Toggle this help</li>
              </ul>
            </div>

            {enableGestures && (
              <div className="help-section">
                <h4>Touch Gestures:</h4>
                <ul>
                  <li>Swipe right - Clear search</li>
                  {enableVoice && <li>Double tap - Voice search</li>}
                </ul>
              </div>
            )}

            <div className="help-section">
              <h4>Search Tips:</h4>
              <ul>
                <li>Use specific keywords for better results</li>
                <li>Try different terms if no results found</li>
                <li>Check spelling and try common synonyms</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Main search input */}
      <div className="search-input-container">
        <label htmlFor="search-input" className="search-label">
          {simpleMode ? 'Search:' : 'Enter search terms:'}
        </label>

        <div className="input-wrapper" role="combobox" aria-expanded={results.length > 0}>
          <Search
            className="search-icon"
            size={20}
            aria-hidden="true"
          />

          <input
            ref={searchInputRef}
            id="search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch();
              }
            }}
            placeholder={placeholder}
            aria-describedby="search-description search-help"
            aria-invalid={error ? true : false}
            aria-busy={isLoading}
            className="search-input"
            autoComplete="off"
            spellCheck="true"
            style={{
              minHeight: '44px',
              fontSize: simpleMode ? '18px' : '16px',
              padding: simpleMode ? '12px 60px 12px 48px' : '8px 60px 8px 40px'
            }}
          />

          {/* Voice search button */}
          {enableVoice && (
            <button
              ref={voiceButtonRef}
              className={`voice-button ${isVoiceActive ? 'active' : ''}`}
              onClick={startVoiceSearch}
              disabled={isVoiceActive}
              aria-label="Start voice search"
              title="Click to search by voice"
              style={{ minWidth: '44px', minHeight: '44px' }}
            >
              <Mic size={20} />
              {isVoiceActive && (
                <span className="voice-indicator" aria-hidden="true">
                  🎤
                </span>
              )}
            </button>
          )}

          {/* Clear button */}
          {query && (
            <button
              className="clear-button"
              onClick={clearSearch}
              aria-label="Clear search"
              title="Clear search input"
              style={{ minWidth: '44px', minHeight: '44px' }}
            >
              <X size={20} />
            </button>
          )}
        </div>

        <div id="search-description" className="search-description">
          {simpleMode ? 'Type your question and press Enter' : helpText}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div
          className="error-message"
          role="alert"
          aria-live="assertive"
          id="search-error"
        >
          <span className="error-icon" aria-hidden="true">⚠️</span>
          {error}
          <button
            className="error-dismiss"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div
          className="loading-indicator"
          role="status"
          aria-live="polite"
          aria-label="Searching..."
        >
          <div className="spinner" aria-hidden="true"></div>
          <span>Searching...</span>
        </div>
      )}

      {/* Search results */}
      <div
        ref={resultsContainerRef}
        id="search-results"
        className="search-results"
        role="region"
        aria-label="Search results"
        aria-live="polite"
        tabIndex={-1}
      >
        {results.length > 0 && (
          <>
            <h3 id="results-heading">
              Search Results ({results.length} found)
            </h3>

            <ul className="results-list" role="list">
              {results.map((result, index) => (
                <li
                  key={result.id}
                  className="result-item"
                  role="listitem"
                >
                  <button
                    className="result-button"
                    onClick={() => {
                      announce(`Selected: ${result.title}`);
                      // Handle result selection
                    }}
                    style={{ minHeight: '44px', width: '100%' }}
                  >
                    <div className="result-content">
                      <h4 className="result-title">{result.title}</h4>
                      <p className="result-description">{result.description}</p>
                      <span className="result-category">
                        Category: {result.category}
                      </span>
                    </div>
                    <div className="result-relevance" aria-label={`Relevance: ${result.relevance}%`}>
                      {result.relevance}%
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {results.length === 0 && !isLoading && query && (
          <div className="no-results" role="status">
            <h3>No Results Found</h3>
            <p>Try different keywords, check spelling, or browse categories below.</p>
            <div className="suggested-actions">
              <button
                className="suggestion-button"
                onClick={() => {
                  setQuery('');
                  searchInputRef.current?.focus();
                }}
                style={{ minHeight: '44px' }}
              >
                Clear and try again
              </button>
              <button
                className="suggestion-button"
                onClick={() => setShowHelp(true)}
                style={{ minHeight: '44px' }}
              >
                View search tips
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Live region for announcements */}
      <LiveRegion
        message={isLoading ? 'Searching...' : ''}
        priority="polite"
      />

      <style jsx>{`
        .search-interface {
          max-width: 800px;
          margin: 0 auto;
          padding: var(--search-container-padding);
          font-family: system-ui, -apple-system, sans-serif;
          font-size: var(--font-size-base);
        }

        .search-interface.simple-mode {
          max-width: 600px;
        }

        .search-interface.high-contrast {
          background: #000;
          color: #fff;
          border: 2px solid #fff;
        }

        .search-interface.high-contrast button {
          background: #fff;
          color: #000;
          border: 2px solid #fff;
        }

        .search-interface.high-contrast input {
          background: #000;
          color: #fff;
          border: 2px solid #fff;
        }

        .search-interface.reduced-motion * {
          animation-duration: 0.01ms !important;
          transition-duration: 0.01ms !important;
        }

        .skip-link {
          position: absolute;
          top: -40px;
          left: 6px;
          background: #000;
          color: #fff;
          padding: 8px;
          text-decoration: none;
          border-radius: 4px;
          z-index: 1000;
        }

        .skip-link:focus {
          top: 6px;
        }

        .search-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .search-title {
          margin: 0;
          font-size: 1.5em;
          font-weight: 600;
        }

        .search-controls {
          display: flex;
          gap: 8px;
        }

        .control-button {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: var(--touch-target-size);
          min-height: var(--touch-target-size);
          background: #f5f5f5;
          border: 1px solid #ddd;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .control-button:hover {
          background: #e5e5e5;
        }

        .control-button:focus {
          outline: 2px solid #0066cc;
          outline-offset: 2px;
        }

        .control-button[aria-pressed="true"] {
          background: #0066cc;
          color: white;
          border-color: #0066cc;
        }

        .help-panel {
          background: #f9f9f9;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .help-section {
          margin: 16px 0;
        }

        .help-section h4 {
          margin: 0 0 8px 0;
          font-weight: 600;
        }

        .help-section ul {
          margin: 0;
          padding-left: 20px;
        }

        .help-section li {
          margin: 4px 0;
        }

        kbd {
          background: #f0f0f0;
          border: 1px solid #ccc;
          border-radius: 3px;
          padding: 2px 6px;
          font-family: monospace;
          font-size: 0.9em;
        }

        .search-input-container {
          margin-bottom: 20px;
        }

        .search-label {
          display: block;
          font-weight: 600;
          margin-bottom: 8px;
          font-size: 1.1em;
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .search-icon {
          position: absolute;
          left: 12px;
          color: #666;
          z-index: 1;
        }

        .search-input {
          width: 100%;
          border: 2px solid #ddd;
          border-radius: 8px;
          outline: none;
          transition: border-color 0.2s ease;
        }

        .search-input:focus {
          border-color: #0066cc;
          box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.2);
        }

        .search-input[aria-invalid="true"] {
          border-color: #dc2626;
        }

        .voice-button, .clear-button {
          position: absolute;
          right: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f5f5f5;
          border: 1px solid #ddd;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .voice-button {
          right: 52px;
        }

        .voice-button:hover, .clear-button:hover {
          background: #e5e5e5;
        }

        .voice-button:focus, .clear-button:focus {
          outline: 2px solid #0066cc;
          outline-offset: 2px;
        }

        .voice-button.active {
          background: #dc2626;
          color: white;
          border-color: #dc2626;
        }

        .voice-indicator {
          position: absolute;
          top: -8px;
          right: -8px;
          animation: pulse 1s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .search-description {
          margin-top: 8px;
          color: #666;
          font-size: 0.9em;
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 16px;
          color: #dc2626;
        }

        .error-dismiss {
          margin-left: auto;
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
        }

        .loading-indicator {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: #f9f9f9;
          border-radius: 8px;
          margin-bottom: 16px;
        }

        .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid #f3f3f3;
          border-top: 2px solid #0066cc;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .search-results h3 {
          margin: 0 0 16px 0;
          font-size: 1.2em;
          font-weight: 600;
        }

        .results-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .result-item {
          margin-bottom: 12px;
        }

        .result-button {
          width: 100%;
          text-align: left;
          background: #f9f9f9;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 16px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .result-button:hover {
          background: #f0f0f0;
          border-color: #ccc;
        }

        .result-button:focus {
          outline: 2px solid #0066cc;
          outline-offset: 2px;
        }

        .result-content {
          flex: 1;
        }

        .result-title {
          margin: 0 0 8px 0;
          font-size: 1.1em;
          font-weight: 600;
          color: #0066cc;
        }

        .result-description {
          margin: 0 0 8px 0;
          color: #666;
          line-height: 1.4;
        }

        .result-category {
          font-size: 0.9em;
          color: #888;
        }

        .result-relevance {
          font-weight: 600;
          color: #0066cc;
          margin-left: 16px;
        }

        .no-results {
          text-align: center;
          padding: 40px 20px;
          color: #666;
        }

        .no-results h3 {
          margin: 0 0 16px 0;
          color: #333;
        }

        .suggested-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
          margin-top: 20px;
          flex-wrap: wrap;
        }

        .suggestion-button {
          background: #0066cc;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 12px 20px;
          cursor: pointer;
          font-weight: 600;
          transition: background-color 0.2s ease;
        }

        .suggestion-button:hover {
          background: #0052a3;
        }

        .suggestion-button:focus {
          outline: 2px solid #0066cc;
          outline-offset: 2px;
        }

        /* Mobile responsive adjustments */
        @media (max-width: 768px) {
          .search-interface {
            padding: 16px;
          }

          .search-header {
            flex-direction: column;
            gap: 16px;
            align-items: stretch;
          }

          .search-controls {
            justify-content: center;
          }

          .suggested-actions {
            flex-direction: column;
            align-items: center;
          }

          .suggestion-button {
            width: 100%;
            max-width: 200px;
          }
        }
      `}</style>
    </div>
  );
};