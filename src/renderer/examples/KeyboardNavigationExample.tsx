/**
 * Keyboard Navigation System Example
 * Demonstrates complete integration and usage of the keyboard navigation system
 */

import React, { useState } from 'react';
import { KeyboardProvider, useKeyboard, useKeyboardShortcuts } from '../contexts/KeyboardContext';
import { useKeyboardNavigation, useModalNavigation, useFormNavigation } from '../hooks/useKeyboardNavigation';
import { Button, ButtonGroup } from '../components/common/Button';
import { GlobalKeyboardHelp, KeyboardHelpButton } from '../components/KeyboardHelp';
import KeyboardEnabledSearchBar from '../components/KeyboardEnabledSearchBar';
import KeyboardEnabledEntryList from '../components/KeyboardEnabledEntryList';
import '../styles/keyboard-navigation.css';

// Sample data
const sampleEntries = [
  {
    id: '1',
    title: 'VSAM Status 35 - File Not Found',
    problem: 'Job abends with VSAM status code 35. The program cannot open the VSAM file.',
    solution: 'Verify the dataset exists and check DD statement in JCL.',
    category: 'VSAM',
    tags: ['vsam', 'status-35', 'file-not-found'],
    usage_count: 15,
    success_count: 12,
    score: 95
  },
  {
    id: '2',
    title: 'S0C7 Data Exception in COBOL',
    problem: 'Program abends with S0C7 data exception during arithmetic operations.',
    solution: 'Check for non-numeric data in numeric fields and initialize properly.',
    category: 'Batch',
    tags: ['s0c7', 'data-exception', 'cobol'],
    usage_count: 8,
    success_count: 7,
    score: 88
  },
  {
    id: '3',
    title: 'JCL Dataset Not Found (IEF212I)',
    problem: 'JCL fails with IEF212I dataset not found error',
    solution: 'Verify dataset name spelling and check if dataset exists.',
    category: 'JCL',
    tags: ['jcl', 'dataset', 'not-found'],
    usage_count: 12,
    success_count: 10,
    score: 92
  }
];

const suggestions = [
  { text: 'VSAM Status', type: 'recent' as const },
  { text: 'JCL Error', type: 'recent' as const },
  { text: 'DB2', type: 'category' as const },
  { text: 'Batch', type: 'category' as const },
  { text: 'error-handling', type: 'tag' as const }
];

/**
 * Modal Dialog Example
 */
function ExampleModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const modalNavigation = useModalNavigation(isOpen, onClose);
  const [formData, setFormData] = useState({ title: '', description: '' });

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={modalNavigation.containerRef}
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          padding: '2rem',
          width: '500px',
          maxHeight: '80vh',
          overflow: 'auto'
        }}
      >
        <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Add New Entry</h2>
          <Button
            variant="ghost"
            onClick={onClose}
            aria-label="Close dialog"
            shortcut={{ key: 'Escape', description: 'Close dialog' }}
          >
            ✕
          </Button>
        </header>

        <form className="form-navigation" onSubmit={(e) => e.preventDefault()}>
          <div className="form-field">
            <label htmlFor="title">Title:</label>
            <input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter title..."
            />
          </div>

          <div className="form-field">
            <label htmlFor="description">Description:</label>
            <textarea
              id="description"
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter description..."
            />
          </div>

          <ButtonGroup label="Form actions" className="mt-4">
            <Button
              variant="primary"
              type="submit"
              shortcut={{ key: 'Enter', ctrlKey: true, description: 'Save entry' }}
            >
              Save Entry
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </ButtonGroup>
        </form>
      </div>
    </div>
  );
}

/**
 * Toolbar Example
 */
function ExampleToolbar({ onAction }: { onAction: (action: string) => void }) {
  const toolbarNavigation = useKeyboardNavigation({
    orientation: 'horizontal',
    wrap: true,
    shortcuts: [
      {
        key: 'n',
        ctrlKey: true,
        description: 'New entry',
        action: () => onAction('new')
      },
      {
        key: 's',
        ctrlKey: true,
        description: 'Save',
        action: () => onAction('save')
      },
      {
        key: 'f',
        ctrlKey: true,
        description: 'Find',
        action: () => onAction('find')
      }
    ]
  });

  return (
    <div
      ref={toolbarNavigation.containerRef}
      className="navigation-list"
      data-orientation="horizontal"
      style={{
        display: 'flex',
        gap: '0.5rem',
        padding: '1rem',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        border: '1px solid #e5e7eb'
      }}
      role="toolbar"
      aria-label="Main toolbar"
    >
      <Button
        variant="primary"
        icon="+"
        onClick={() => onAction('new')}
        shortcut={{ key: 'n', ctrlKey: true, description: 'New entry' }}
      >
        New Entry
      </Button>

      <Button
        variant="secondary"
        icon="💾"
        onClick={() => onAction('save')}
        shortcut={{ key: 's', ctrlKey: true, description: 'Save changes' }}
      >
        Save
      </Button>

      <Button
        variant="secondary"
        icon="🔍"
        onClick={() => onAction('find')}
        shortcut={{ key: 'f', ctrlKey: true, description: 'Find entries' }}
      >
        Find
      </Button>

      <Button
        variant="ghost"
        icon="❓"
        onClick={() => window.dispatchEvent(new CustomEvent('keyboard-help-toggle'))}
        shortcut={{ key: 'F1', description: 'Show help' }}
      >
        Help
      </Button>
    </div>
  );
}

/**
 * Settings Panel Example
 */
function ExampleSettingsPanel() {
  const { state, setActiveScope } = useKeyboard();
  const [settings, setSettings] = useState({
    keyboardHints: true,
    focusIndicators: true,
    skipLinks: true,
    announcements: true
  });

  const settingsNavigation = useKeyboardNavigation({
    orientation: 'vertical',
    scope: 'settings'
  });

  return (
    <div
      ref={settingsNavigation.containerRef}
      style={{
        padding: '1.5rem',
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        maxWidth: '400px'
      }}
    >
      <h3 style={{ margin: '0 0 1rem 0' }}>Keyboard Settings</h3>

      <div className="form-navigation">
        <div className="form-field">
          <label>
            <input
              type="checkbox"
              checked={settings.keyboardHints}
              onChange={(e) => setSettings({ ...settings, keyboardHints: e.target.checked })}
            />
            <span style={{ marginLeft: '0.5rem' }}>Show keyboard hints</span>
          </label>
        </div>

        <div className="form-field">
          <label>
            <input
              type="checkbox"
              checked={settings.focusIndicators}
              onChange={(e) => setSettings({ ...settings, focusIndicators: e.target.checked })}
            />
            <span style={{ marginLeft: '0.5rem' }}>Enhanced focus indicators</span>
          </label>
        </div>

        <div className="form-field">
          <label>
            <input
              type="checkbox"
              checked={settings.skipLinks}
              onChange={(e) => setSettings({ ...settings, skipLinks: e.target.checked })}
            />
            <span style={{ marginLeft: '0.5rem' }}>Enable skip links</span>
          </label>
        </div>

        <div className="form-field">
          <label>
            <input
              type="checkbox"
              checked={settings.announcements}
              onChange={(e) => setSettings({ ...settings, announcements: e.target.checked })}
            />
            <span style={{ marginLeft: '0.5rem' }}>Screen reader announcements</span>
          </label>
        </div>
      </div>

      <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f3f4f6', borderRadius: '4px' }}>
        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem' }}>Current State:</h4>
        <ul style={{ margin: 0, padding: '0 0 0 1rem', fontSize: '0.75rem', color: '#6b7280' }}>
          <li>Keyboard mode: {state.isKeyboardMode ? 'Active' : 'Inactive'}</li>
          <li>Active scope: {state.activeScope || 'Global'}</li>
          <li>Shortcuts registered: {state.registeredShortcuts.size}</li>
          <li>Help visible: {state.showKeyboardHelp ? 'Yes' : 'No'}</li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Main Example Application
 */
function ExampleApp() {
  const [searchResults, setSearchResults] = useState(sampleEntries);
  const [selectedEntry, setSelectedEntry] = useState<typeof sampleEntries[0] | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [lastAction, setLastAction] = useState<string>('');

  const handleSearch = (query: string, results: typeof sampleEntries) => {
    // Simulate search filtering
    const filtered = sampleEntries.filter(entry =>
      entry.title.toLowerCase().includes(query.toLowerCase()) ||
      entry.problem.toLowerCase().includes(query.toLowerCase()) ||
      entry.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
    );
    setSearchResults(filtered);
    setSelectedEntry(null);
  };

  const handleToolbarAction = (action: string) => {
    setLastAction(action);

    switch (action) {
      case 'new':
        setShowModal(true);
        break;
      case 'save':
        alert('Save action triggered');
        break;
      case 'find':
        const searchInput = document.querySelector('[data-search-input]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        break;
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', padding: '2rem' }}>
      {/* Header */}
      <header style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h1 style={{ margin: 0 }}>🎹 Keyboard Navigation Example</h1>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <KeyboardHelpButton variant="full" />
            <Button
              variant="secondary"
              onClick={() => setShowSettings(!showSettings)}
            >
              Settings
            </Button>
          </div>
        </div>
        <p style={{ margin: 0, color: '#6b7280' }}>
          Comprehensive example of keyboard navigation system in action.
          {lastAction && ` Last action: ${lastAction}`}
        </p>
      </header>

      {/* Toolbar */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Toolbar (Horizontal Navigation)</h2>
        <ExampleToolbar onAction={handleToolbarAction} />
      </div>

      {/* Main Content */}
      <div style={{ display: 'grid', gridTemplateColumns: showSettings ? '1fr 400px' : '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        {/* Left Panel - Search and Results */}
        <div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Search & List Navigation</h2>

          <div style={{ marginBottom: '1.5rem' }}>
            <KeyboardEnabledSearchBar
              onSearch={handleSearch}
              suggestions={suggestions}
              placeholder="Search entries... (Press / or Ctrl+K to focus)"
            />
          </div>

          <KeyboardEnabledEntryList
            entries={searchResults}
            onEntrySelect={setSelectedEntry}
            selectedEntryId={selectedEntry?.id}
            showNumbers={true}
          />
        </div>

        {/* Right Panel - Settings or Entry Details */}
        {showSettings ? (
          <div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Settings Panel</h2>
            <ExampleSettingsPanel />
          </div>
        ) : selectedEntry ? (
          <div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Entry Details</h2>
            <div style={{
              padding: '1.5rem',
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              position: 'sticky',
              top: '2rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.125rem' }}>{selectedEntry.title}</h3>
                <Button
                  variant="ghost"
                  onClick={() => setSelectedEntry(null)}
                  aria-label="Clear selection"
                  shortcut={{ key: 'Escape', description: 'Clear selection' }}
                >
                  ✕
                </Button>
              </div>

              <p style={{ marginBottom: '1rem', color: '#6b7280' }}>
                {selectedEntry.problem}
              </p>

              <div style={{
                padding: '1rem',
                backgroundColor: '#f0fdf4',
                borderRadius: '6px',
                border: '1px solid #bbf7d0',
                marginBottom: '1rem'
              }}>
                <strong>Solution:</strong>
                <p style={{ margin: '0.5rem 0 0 0', whiteSpace: 'pre-wrap' }}>
                  {selectedEntry.solution}
                </p>
              </div>

              <ButtonGroup label="Entry actions">
                <Button variant="primary" icon="👍">Helpful</Button>
                <Button variant="secondary" icon="👎">Not Helpful</Button>
                <Button variant="ghost" icon="📋">Copy</Button>
              </ButtonGroup>
            </div>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '3rem',
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            color: '#6b7280'
          }}>
            Select an entry to view details
          </div>
        )}
      </div>

      {/* Instructions */}
      <div style={{
        padding: '1.5rem',
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #e5e7eb'
      }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Keyboard Navigation Instructions</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Global Shortcuts</h3>
            <ul style={{ margin: 0, padding: '0 0 0 1rem', fontSize: '0.875rem' }}>
              <li><kbd>F1</kbd> - Toggle help dialog</li>
              <li><kbd>/</kbd> or <kbd>Ctrl+K</kbd> - Focus search</li>
              <li><kbd>Ctrl+N</kbd> - New entry</li>
              <li><kbd>Ctrl+R</kbd> - Refresh</li>
              <li><kbd>Esc</kbd> - Close dialogs/clear selection</li>
            </ul>
          </div>

          <div>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Navigation</h3>
            <ul style={{ margin: 0, padding: '0 0 0 1rem', fontSize: '0.875rem' }}>
              <li><kbd>Tab</kbd>/<kbd>Shift+Tab</kbd> - Move between elements</li>
              <li><kbd>↑↓</kbd> - Navigate lists</li>
              <li><kbd>←→</kbd> - Navigate toolbars</li>
              <li><kbd>Enter</kbd>/<kbd>Space</kbd> - Activate</li>
              <li><kbd>1-9</kbd> - Quick select list items</li>
            </ul>
          </div>

          <div>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Search</h3>
            <ul style={{ margin: 0, padding: '0 0 0 1rem', fontSize: '0.875rem' }}>
              <li><kbd>↑↓</kbd> - Navigate suggestions</li>
              <li><kbd>Enter</kbd> - Select suggestion</li>
              <li><kbd>Tab</kbd> - Accept suggestion</li>
              <li><kbd>Esc</kbd> - Close suggestions</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Modal */}
      <ExampleModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}

/**
 * Complete Example with Provider
 */
export default function KeyboardNavigationExample() {
  return (
    <KeyboardProvider
      enableSkipLinks={true}
      skipLinks={[
        { href: '#main-content', text: 'Skip to main content' },
        { href: '#search', text: 'Skip to search' },
        { href: '#toolbar', text: 'Skip to toolbar' }
      ]}
    >
      <ExampleApp />
      <GlobalKeyboardHelp />
    </KeyboardProvider>
  );
}