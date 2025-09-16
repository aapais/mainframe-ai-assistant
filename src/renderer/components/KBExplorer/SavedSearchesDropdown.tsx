/**
 * SavedSearchesDropdown Component
 *
 * A comprehensive saved searches management component with:
 * - Save current search/filter configuration
 * - Load saved searches
 * - Delete saved searches
 * - Rename saved searches
 * - Export/Import saved searches
 * - Folder organization for searches
 * - Search within saved searches
 * - Recent searches tracking
 *
 * @author Frontend Developer
 * @version 1.0.0
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { FilterState, SortConfig, SavedSearch } from './index';

// =====================
// Types & Interfaces
// =====================

export interface SavedSearchesDropdownProps {
  currentFilters: FilterState;
  currentSort: SortConfig[];
  onLoadSearch: (savedSearch: SavedSearch) => void;
  className?: string;
}

interface SavedSearchFolder {
  id: string;
  name: string;
  searches: SavedSearch[];
  isExpanded: boolean;
}

interface SaveSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, folder?: string) => void;
  folders: SavedSearchFolder[];
  initialName?: string;
}

interface DeleteConfirmModalProps {
  isOpen: boolean;
  searchToDelete: SavedSearch | null;
  onConfirm: () => void;
  onCancel: () => void;
}

interface RenameModalProps {
  isOpen: boolean;
  searchToRename: SavedSearch | null;
  onRename: (newName: string) => void;
  onCancel: () => void;
}

// =====================
// Mock Data & Storage
// =====================

const DEFAULT_FOLDERS: SavedSearchFolder[] = [
  {
    id: 'recent',
    name: 'Recent Searches',
    searches: [],
    isExpanded: true,
  },
  {
    id: 'favorites',
    name: 'Favorites',
    searches: [],
    isExpanded: true,
  },
  {
    id: 'general',
    name: 'General',
    searches: [],
    isExpanded: true,
  },
];

// Utility functions for localStorage
const STORAGE_KEY = 'kb-explorer-saved-searches';

const loadSavedSearches = (): SavedSearchFolder[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Ensure dates are properly parsed
      return parsed.map((folder: any) => ({
        ...folder,
        searches: folder.searches.map((search: any) => ({
          ...search,
          createdAt: new Date(search.createdAt),
          lastUsed: search.lastUsed ? new Date(search.lastUsed) : undefined,
        })),
      }));
    }
  } catch (error) {
    console.error('Failed to load saved searches:', error);
  }
  return DEFAULT_FOLDERS;
};

const saveSavedSearches = (folders: SavedSearchFolder[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
  } catch (error) {
    console.error('Failed to save searches:', error);
  }
};

// =====================
// Sub-components
// =====================

const SaveSearchModal: React.FC<SaveSearchModalProps> = ({
  isOpen,
  onClose,
  onSave,
  folders,
  initialName = '',
}) => {
  const [name, setName] = useState(initialName);
  const [selectedFolder, setSelectedFolder] = useState('general');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, initialName]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim(), selectedFolder);
      setName('');
      onClose();
    }
  }, [name, selectedFolder, onSave, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Save Current Search
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="search-name" className="block text-sm font-medium text-gray-700 mb-1">
                Search Name
              </label>
              <input
                id="search-name"
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter a descriptive name..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label htmlFor="folder-select" className="block text-sm font-medium text-gray-700 mb-1">
                Save to Folder
              </label>
              <select
                id="folder-select"
                value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {folders.filter(f => f.id !== 'recent').map(folder => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Save Search
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  searchToDelete,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen || !searchToDelete) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Delete Saved Search
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to delete "<strong>{searchToDelete.name}</strong>"? This action cannot be undone.
        </p>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

const RenameModal: React.FC<RenameModalProps> = ({
  isOpen,
  searchToRename,
  onRename,
  onCancel,
}) => {
  const [newName, setNewName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && searchToRename) {
      setNewName(searchToRename.name);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, searchToRename]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      onRename(newName.trim());
    }
  }, [newName, onRename]);

  if (!isOpen || !searchToRename) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Rename Saved Search
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="new-name" className="block text-sm font-medium text-gray-700 mb-1">
              New Name
            </label>
            <input
              id="new-name"
              ref={inputRef}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Rename
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =====================
// Main Component
// =====================

export const SavedSearchesDropdown: React.FC<SavedSearchesDropdownProps> = ({
  currentFilters,
  currentSort,
  onLoadSearch,
  className = '',
}) => {
  // =====================
  // State Management
  // =====================

  const [isOpen, setIsOpen] = useState(false);
  const [folders, setFolders] = useState<SavedSearchFolder[]>(() => loadSavedSearches());
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [searchToDelete, setSearchToDelete] = useState<SavedSearch | null>(null);
  const [searchToRename, setSearchToRename] = useState<SavedSearch | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);

  // =====================
  // Effects
  // =====================

  // Save to localStorage whenever folders change
  useEffect(() => {
    saveSavedSearches(folders);
  }, [folders]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // =====================
  // Computed Values
  // =====================

  const filteredFolders = useMemo(() => {
    if (!searchFilter.trim()) return folders;

    return folders.map(folder => ({
      ...folder,
      searches: folder.searches.filter(search =>
        search.name.toLowerCase().includes(searchFilter.toLowerCase())
      ),
    })).filter(folder => folder.searches.length > 0);
  }, [folders, searchFilter]);

  const hasActiveFilters = useMemo(() => {
    return (
      currentFilters.categories.length > 0 ||
      currentFilters.tags.length > 0 ||
      currentFilters.dateRange.start ||
      currentFilters.dateRange.end ||
      currentFilters.successRateRange.min > 0 ||
      currentFilters.successRateRange.max < 100 ||
      currentFilters.usageRange.min > 0 ||
      currentFilters.usageRange.max < 1000 ||
      currentFilters.searchQuery.trim().length > 0
    );
  }, [currentFilters]);

  // =====================
  // Event Handlers
  // =====================

  const handleSaveSearch = useCallback((name: string, folderId: string = 'general') => {
    const newSearch: SavedSearch = {
      id: Date.now().toString(),
      name,
      filters: currentFilters,
      sortConfig: currentSort,
      createdAt: new Date(),
    };

    setFolders(prev => prev.map(folder => {
      if (folder.id === folderId) {
        return {
          ...folder,
          searches: [...folder.searches, newSearch],
        };
      }
      return folder;
    }));

    // Also add to recent searches (limit to 10)
    setFolders(prev => prev.map(folder => {
      if (folder.id === 'recent') {
        const recentSearches = [newSearch, ...folder.searches.filter(s => s.id !== newSearch.id)];
        return {
          ...folder,
          searches: recentSearches.slice(0, 10),
        };
      }
      return folder;
    }));
  }, [currentFilters, currentSort]);

  const handleLoadSearch = useCallback((search: SavedSearch) => {
    // Update last used timestamp
    setFolders(prev => prev.map(folder => ({
      ...folder,
      searches: folder.searches.map(s =>
        s.id === search.id
          ? { ...s, lastUsed: new Date() }
          : s
      ),
    })));

    // Add to recent searches
    setFolders(prev => prev.map(folder => {
      if (folder.id === 'recent') {
        const updatedSearch = { ...search, lastUsed: new Date() };
        const recentSearches = [
          updatedSearch,
          ...folder.searches.filter(s => s.id !== search.id)
        ];
        return {
          ...folder,
          searches: recentSearches.slice(0, 10),
        };
      }
      return folder;
    }));

    onLoadSearch(search);
    setIsOpen(false);
  }, [onLoadSearch]);

  const handleDeleteSearch = useCallback((search: SavedSearch) => {
    setSearchToDelete(search);
    setShowDeleteModal(true);
  }, []);

  const confirmDeleteSearch = useCallback(() => {
    if (searchToDelete) {
      setFolders(prev => prev.map(folder => ({
        ...folder,
        searches: folder.searches.filter(s => s.id !== searchToDelete.id),
      })));
      setSearchToDelete(null);
      setShowDeleteModal(false);
    }
  }, [searchToDelete]);

  const handleRenameSearch = useCallback((search: SavedSearch) => {
    setSearchToRename(search);
    setShowRenameModal(true);
  }, []);

  const confirmRenameSearch = useCallback((newName: string) => {
    if (searchToRename) {
      setFolders(prev => prev.map(folder => ({
        ...folder,
        searches: folder.searches.map(s =>
          s.id === searchToRename.id
            ? { ...s, name: newName }
            : s
        ),
      })));
      setSearchToRename(null);
      setShowRenameModal(false);
    }
  }, [searchToRename]);

  const toggleFolder = useCallback((folderId: string) => {
    setFolders(prev => prev.map(folder =>
      folder.id === folderId
        ? { ...folder, isExpanded: !folder.isExpanded }
        : folder
    ));
  }, []);

  const exportSavedSearches = useCallback(() => {
    const dataStr = JSON.stringify(folders, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'kb-saved-searches.json';
    link.click();
    URL.revokeObjectURL(url);
  }, [folders]);

  // =====================
  // Render
  // =====================

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Main Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
        Saved Searches
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Saved Searches</h3>
              <div className="flex space-x-2">
                {hasActiveFilters && (
                  <button
                    onClick={() => setShowSaveModal(true)}
                    className="text-xs text-blue-600 hover:text-blue-800 focus:outline-none focus:underline"
                    title="Save current search"
                  >
                    Save Current
                  </button>
                )}
                <button
                  onClick={exportSavedSearches}
                  className="text-xs text-gray-500 hover:text-gray-700 focus:outline-none focus:underline"
                  title="Export all saved searches"
                >
                  Export
                </button>
              </div>
            </div>

            {/* Search Filter */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search saved searches..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
              <svg className="absolute right-3 top-1.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Folders and Searches */}
          <div className="flex-1 overflow-y-auto">
            {filteredFolders.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-gray-500">
                  {searchFilter.trim() ? 'No matching searches found' : 'No saved searches yet'}
                </p>
              </div>
            ) : (
              filteredFolders.map(folder => (
                <div key={folder.id} className="border-b border-gray-100 last:border-b-0">
                  {/* Folder Header */}
                  <button
                    onClick={() => toggleFolder(folder.id)}
                    className="w-full px-4 py-2 text-left flex items-center justify-between hover:bg-gray-50 focus:outline-none focus:bg-gray-50"
                  >
                    <div className="flex items-center space-x-2">
                      <svg
                        className={`w-4 h-4 text-gray-500 transition-transform ${folder.isExpanded ? 'rotate-90' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="text-sm font-medium text-gray-700">{folder.name}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {folder.searches.length}
                    </span>
                  </button>

                  {/* Folder Contents */}
                  {folder.isExpanded && (
                    <div className="pb-2">
                      {folder.searches.map(search => (
                        <div
                          key={search.id}
                          className="mx-4 mb-1 group hover:bg-gray-50 rounded"
                        >
                          <div className="flex items-center justify-between p-2">
                            <button
                              onClick={() => handleLoadSearch(search)}
                              className="flex-1 text-left focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
                            >
                              <div className="text-sm text-gray-900 truncate">
                                {search.name}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {search.createdAt.toLocaleDateString()}
                                {search.lastUsed && (
                                  <span className="ml-2">
                                    • Last used {search.lastUsed.toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </button>

                            {/* Actions */}
                            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleRenameSearch(search)}
                                className="p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600"
                                title="Rename"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteSearch(search)}
                                className="p-1 text-gray-400 hover:text-red-600 focus:outline-none focus:text-red-600"
                                title="Delete"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <SaveSearchModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveSearch}
        folders={folders}
        initialName=""
      />

      <DeleteConfirmModal
        isOpen={showDeleteModal}
        searchToDelete={searchToDelete}
        onConfirm={confirmDeleteSearch}
        onCancel={() => {
          setShowDeleteModal(false);
          setSearchToDelete(null);
        }}
      />

      <RenameModal
        isOpen={showRenameModal}
        searchToRename={searchToRename}
        onRename={confirmRenameSearch}
        onCancel={() => {
          setShowRenameModal(false);
          setSearchToRename(null);
        }}
      />
    </div>
  );
};

export default SavedSearchesDropdown;