import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Plus,
  Filter,
  Download,
  Upload,
  Settings,
  Grid,
  List,
  BookOpen,
  Tag,
  Calendar,
  TrendingUp,
  RefreshCw,
  Archive,
  Star,
  MoreVertical,
  FileText,
  Database,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  BarChart3,
  X,
  ChevronDown,
  SortAsc,
  SortDesc
} from 'lucide-react';
import { KBEntryCard, KBEntry } from '../kb-entry/KBEntryCard';
import { KBEntryDetail } from '../kb-entry/KBEntryDetail';
import { EditKBEntryModal } from '../modals/EditKBEntryModal';
import { CategoryBadge, Category } from '../kb-entry/indicators/CategoryBadge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { useDebounce } from '../../hooks/useDebounce';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { generateSampleKBData } from './sampleKBData';
import './ComprehensiveKnowledgeBase.css';

interface FilterState {
  category: Category | 'all';
  tags: string[];
  severity: 'all' | 'critical' | 'high' | 'medium' | 'low';
  dateRange: 'all' | 'week' | 'month' | 'year';
  successRate: 'all' | 'high' | 'medium' | 'low';
  status: 'all' | 'active' | 'archived';
}

interface SortConfig {
  field: 'title' | 'updated_at' | 'usage_count' | 'success_rate' | 'created_at';
  direction: 'asc' | 'desc';
}

interface ViewConfig {
  layout: 'grid' | 'list' | 'table';
  density: 'comfortable' | 'compact' | 'spacious';
  showMetadata: boolean;
  showPreview: boolean;
}

export interface ComprehensiveKnowledgeBaseProps {
  className?: string;
  onCreateEntry?: () => void;
  onImport?: (file: File) => void;
  onExport?: (format: 'json' | 'csv' | 'pdf') => void;
  onNavigateToEntry?: (entryId: string) => void;
  enableAdvancedFeatures?: boolean;
  readOnly?: boolean;
  maxDisplayEntries?: number;
  customCategories?: Array<{ value: Category; label: string; color: string }>;
}

export const ComprehensiveKnowledgeBase: React.FC<ComprehensiveKnowledgeBaseProps> = ({
  className = '',
  onCreateEntry,
  onImport,
  onExport,
  onNavigateToEntry,
  enableAdvancedFeatures = true,
  readOnly = false,
  maxDisplayEntries = 50,
  customCategories
}) => {
  // Core state
  const [entries, setEntries] = useState<KBEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<KBEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<KBEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [showFilters, setShowFilters] = useState(false);
  const [showEntryDetail, setShowEntryDetail] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Configuration state
  const [filters, setFilters] = useLocalStorage<FilterState>('kb-filters', {
    category: 'all',
    tags: [],
    severity: 'all',
    dateRange: 'all',
    successRate: 'all',
    status: 'all'
  });

  const [sortConfig, setSortConfig] = useLocalStorage<SortConfig>('kb-sort', {
    field: 'updated_at',
    direction: 'desc'
  });

  const [viewConfig, setViewConfig] = useLocalStorage<ViewConfig>('kb-view', {
    layout: 'grid',
    density: 'comfortable',
    showMetadata: true,
    showPreview: true
  });

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debounced search
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Load sample data on mount
  useEffect(() => {
    const loadSampleData = async () => {
      setIsLoading(true);
      try {
        const sampleData = generateSampleKBData();
        setEntries(sampleData);
        setError(null);
      } catch (err) {
        setError('Failed to load knowledge base data');
        console.error('Error loading KB data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSampleData();
  }, []);

  // Filter and search entries
  useEffect(() => {
    let filtered = [...entries];

    // Apply search filter
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(entry =>
        entry.title.toLowerCase().includes(query) ||
        entry.problem.toLowerCase().includes(query) ||
        entry.solution.toLowerCase().includes(query) ||
        entry.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply category filter
    if (filters.category !== 'all') {
      filtered = filtered.filter(entry => entry.category === filters.category);
    }

    // Apply tag filter
    if (filters.tags.length > 0) {
      filtered = filtered.filter(entry =>
        filters.tags.some(tag => entry.tags.includes(tag))
      );
    }

    // Apply success rate filter
    if (filters.successRate !== 'all') {
      filtered = filtered.filter(entry => {
        const successRate = entry.usage_count > 0
          ? (entry.success_count / entry.usage_count) * 100
          : 0;

        switch (filters.successRate) {
          case 'high': return successRate >= 80;
          case 'medium': return successRate >= 50 && successRate < 80;
          case 'low': return successRate < 50;
          default: return true;
        }
      });
    }

    // Apply date range filter
    if (filters.dateRange !== 'all') {
      const now = new Date();
      const cutoffDate = new Date();

      switch (filters.dateRange) {
        case 'week':
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          cutoffDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          cutoffDate.setFullYear(now.getFullYear() - 1);
          break;
      }

      filtered = filtered.filter(entry =>
        new Date(entry.updated_at) >= cutoffDate
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue, bValue;

      switch (sortConfig.field) {
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'updated_at':
          aValue = new Date(a.updated_at).getTime();
          bValue = new Date(b.updated_at).getTime();
          break;
        case 'usage_count':
          aValue = a.usage_count;
          bValue = b.usage_count;
          break;
        case 'success_rate':
          aValue = a.usage_count > 0 ? (a.success_count / a.usage_count) : 0;
          bValue = b.usage_count > 0 ? (b.success_count / b.usage_count) : 0;
          break;
        case 'created_at':
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        default:
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
      }

      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });

    // Limit results if specified
    if (maxDisplayEntries > 0) {
      filtered = filtered.slice(0, maxDisplayEntries);
    }

    setFilteredEntries(filtered);
  }, [entries, debouncedSearchQuery, filters, sortConfig, maxDisplayEntries]);

  // Get available tags from all entries
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    entries.forEach(entry => {
      entry.tags.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [entries]);

  // Statistics
  const stats = useMemo(() => {
    const total = entries.length;
    const categories = entries.reduce((acc, entry) => {
      acc[entry.category] = (acc[entry.category] || 0) + 1;
      return acc;
    }, {} as Record<Category, number>);

    const totalUsage = entries.reduce((sum, entry) => sum + entry.usage_count, 0);
    const totalSuccess = entries.reduce((sum, entry) => sum + entry.success_count, 0);
    const overallSuccessRate = totalUsage > 0 ? Math.round((totalSuccess / totalUsage) * 100) : 0;

    const recentlyUpdated = entries.filter(entry =>
      new Date(entry.updated_at).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
    ).length;

    return {
      total,
      categories,
      overallSuccessRate,
      totalUsage,
      recentlyUpdated,
      filtered: filteredEntries.length
    };
  }, [entries, filteredEntries]);

  // Event handlers
  const handleEntrySelect = useCallback((entry: KBEntry) => {
    setSelectedEntry(entry);
    setShowEntryDetail(true);
    onNavigateToEntry?.(entry.id);
  }, [onNavigateToEntry]);

  const handleEntryEdit = useCallback((entry: KBEntry) => {
    setSelectedEntry(entry);
    setShowEditModal(true);
  }, []);

  const handleEntryRate = useCallback((entryId: string, success: boolean) => {
    setEntries(prev => prev.map(entry => {
      if (entry.id === entryId) {
        return {
          ...entry,
          usage_count: entry.usage_count + 1,
          success_count: success ? entry.success_count + 1 : entry.success_count
        };
      }
      return entry;
    }));
  }, []);

  const handleSortChange = useCallback((field: SortConfig['field']) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, [setSortConfig]);

  const handleFilterChange = useCallback((key: keyof FilterState, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, [setFilters]);

  const handleClearFilters = useCallback(() => {
    setFilters({
      category: 'all',
      tags: [],
      severity: 'all',
      dateRange: 'all',
      successRate: 'all',
      status: 'all'
    });
    setSearchQuery('');
  }, [setFilters]);

  const handleExport = useCallback((format: 'json' | 'csv' | 'pdf') => {
    if (onExport) {
      onExport(format);
    } else {
      // Default export implementation
      const data = filteredEntries.map(entry => ({
        id: entry.id,
        title: entry.title,
        category: entry.category,
        problem: entry.problem,
        solution: entry.solution,
        tags: entry.tags.join(', '),
        usage_count: entry.usage_count,
        success_rate: entry.usage_count > 0 ? Math.round((entry.success_count / entry.usage_count) * 100) : 0,
        created_at: entry.created_at.toISOString(),
        updated_at: entry.updated_at.toISOString()
      }));

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kb-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setShowExportModal(false);
  }, [filteredEntries, onExport]);

  const handleImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onImport) {
      onImport(file);
    }
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onImport]);

  // Get layout classes
  const getLayoutClasses = () => {
    const base = 'kb-entries-container';
    const layout = `kb-entries-container--${viewConfig.layout}`;
    const density = `kb-entries-container--${viewConfig.density}`;
    return `${base} ${layout} ${density}`;
  };

  // Render entry based on layout
  const renderEntry = useCallback((entry: KBEntry) => {
    const variant = viewConfig.layout === 'list' ? 'compact' :
                   viewConfig.layout === 'table' ? 'summary' : 'detailed';

    return (
      <KBEntryCard
        key={entry.id}
        entry={entry}
        variant={variant}
        onRate={handleEntryRate}
        onNavigate={handleEntrySelect}
        searchQuery={debouncedSearchQuery}
        showActions={!readOnly}
      />
    );
  }, [viewConfig.layout, handleEntryRate, handleEntrySelect, debouncedSearchQuery, readOnly]);

  return (
    <div className={`comprehensive-kb ${className}`}>
      {/* Header */}
      <header className="kb-header">
        <div className="kb-header__title-section">
          <h1 className="kb-header__title">
            <BookOpen size={24} />
            Knowledge Base
          </h1>
          <div className="kb-header__stats">
            <Badge variant="outline">
              <FileText size={12} />
              {stats.total} entries
            </Badge>
            <Badge variant="outline">
              <TrendingUp size={12} />
              {stats.overallSuccessRate}% success rate
            </Badge>
            <Badge variant="outline">
              <Clock size={12} />
              {stats.recentlyUpdated} updated this week
            </Badge>
          </div>
        </div>

        <div className="kb-header__actions">
          {!readOnly && (
            <>
              <Button
                onClick={() => setShowCreateModal(true)}
                variant="primary"
                size="small"
              >
                <Plus size={16} />
                New Entry
              </Button>

              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="secondary"
                size="small"
              >
                <Upload size={16} />
                Import
              </Button>
            </>
          )}

          <Button
            onClick={() => setShowExportModal(true)}
            variant="secondary"
            size="small"
          >
            <Download size={16} />
            Export
          </Button>

          <Button
            onClick={() => setShowSettings(true)}
            variant="ghost"
            size="small"
          >
            <Settings size={16} />
          </Button>
        </div>
      </header>

      {/* Search and filters */}
      <div className="kb-controls">
        <div className="kb-search">
          <Search className="kb-search__icon" size={16} />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search knowledge base..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="kb-search__input"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="kb-search__clear"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="kb-toolbar">
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant={showFilters ? 'primary' : 'ghost'}
            size="small"
            className="kb-toolbar__filter-toggle"
          >
            <Filter size={16} />
            Filters
            {(filters.category !== 'all' || filters.tags.length > 0 ||
              filters.successRate !== 'all' || filters.dateRange !== 'all') && (
              <Badge variant="destructive" className="kb-toolbar__filter-count">
                {[
                  filters.category !== 'all' ? 1 : 0,
                  filters.tags.length,
                  filters.successRate !== 'all' ? 1 : 0,
                  filters.dateRange !== 'all' ? 1 : 0
                ].reduce((a, b) => a + b, 0)}
              </Badge>
            )}
          </Button>

          <div className="kb-toolbar__view-controls">
            <Button
              onClick={() => setViewConfig(prev => ({ ...prev, layout: 'grid' }))}
              variant={viewConfig.layout === 'grid' ? 'primary' : 'ghost'}
              size="small"
            >
              <Grid size={16} />
            </Button>
            <Button
              onClick={() => setViewConfig(prev => ({ ...prev, layout: 'list' }))}
              variant={viewConfig.layout === 'list' ? 'primary' : 'ghost'}
              size="small"
            >
              <List size={16} />
            </Button>
          </div>

          <div className="kb-toolbar__sort">
            <select
              value={`${sortConfig.field}-${sortConfig.direction}`}
              onChange={(e) => {
                const [field, direction] = e.target.value.split('-') as [SortConfig['field'], SortConfig['direction']];
                setSortConfig({ field, direction });
              }}
              className="kb-toolbar__sort-select"
            >
              <option value="updated_at-desc">Recently Updated</option>
              <option value="created_at-desc">Recently Created</option>
              <option value="usage_count-desc">Most Used</option>
              <option value="success_rate-desc">Highest Success Rate</option>
              <option value="title-asc">Title A-Z</option>
              <option value="title-desc">Title Z-A</option>
            </select>
          </div>
        </div>
      </div>

      {/* Advanced filters panel */}
      {showFilters && (
        <div className="kb-filters">
          <div className="kb-filters__group">
            <label className="kb-filters__label">Category</label>
            <select
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              className="kb-filters__select"
            >
              <option value="all">All Categories</option>
              <option value="JCL">JCL</option>
              <option value="VSAM">VSAM</option>
              <option value="DB2">DB2</option>
              <option value="Batch">Batch</option>
              <option value="Functional">Functional</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="kb-filters__group">
            <label className="kb-filters__label">Success Rate</label>
            <select
              value={filters.successRate}
              onChange={(e) => handleFilterChange('successRate', e.target.value)}
              className="kb-filters__select"
            >
              <option value="all">All Rates</option>
              <option value="high">High (80%+)</option>
              <option value="medium">Medium (50-79%)</option>
              <option value="low">Low (&lt;50%)</option>
            </select>
          </div>

          <div className="kb-filters__group">
            <label className="kb-filters__label">Date Range</label>
            <select
              value={filters.dateRange}
              onChange={(e) => handleFilterChange('dateRange', e.target.value)}
              className="kb-filters__select"
            >
              <option value="all">All Time</option>
              <option value="week">Past Week</option>
              <option value="month">Past Month</option>
              <option value="year">Past Year</option>
            </select>
          </div>

          <div className="kb-filters__group">
            <label className="kb-filters__label">Tags</label>
            <div className="kb-filters__tags">
              {availableTags.slice(0, 10).map(tag => (
                <button
                  key={tag}
                  onClick={() => {
                    const newTags = filters.tags.includes(tag)
                      ? filters.tags.filter(t => t !== tag)
                      : [...filters.tags, tag];
                    handleFilterChange('tags', newTags);
                  }}
                  className={`kb-filters__tag ${filters.tags.includes(tag) ? 'kb-filters__tag--active' : ''}`}
                >
                  <Tag size={12} />
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="kb-filters__actions">
            <Button onClick={handleClearFilters} variant="ghost" size="small">
              Clear All
            </Button>
            <Button onClick={() => setShowFilters(false)} variant="primary" size="small">
              Apply Filters
            </Button>
          </div>
        </div>
      )}

      {/* Results summary */}
      <div className="kb-results-summary">
        <div className="kb-results__info">
          {filteredEntries.length !== stats.total ? (
            <>
              Showing {filteredEntries.length} of {stats.total} entries
              {debouncedSearchQuery && ` for "${debouncedSearchQuery}"`}
            </>
          ) : (
            `${stats.total} entries total`
          )}
        </div>

        {filteredEntries.length !== stats.total && (
          <Button onClick={handleClearFilters} variant="ghost" size="small">
            <X size={14} />
            Clear filters
          </Button>
        )}
      </div>

      {/* Loading and error states */}
      {isLoading && (
        <div className="kb-loading">
          <RefreshCw className="kb-loading__spinner" size={24} />
          <span>Loading knowledge base...</span>
        </div>
      )}

      {error && (
        <div className="kb-error">
          <AlertTriangle size={20} />
          <span>{error}</span>
          <Button onClick={() => setError(null)} variant="ghost" size="small">
            Dismiss
          </Button>
        </div>
      )}

      {/* Entries grid/list */}
      {!isLoading && !error && (
        <div className={getLayoutClasses()}>
          {filteredEntries.length > 0 ? (
            filteredEntries.map(renderEntry)
          ) : (
            <div className="kb-empty">
              <FileText size={48} className="kb-empty__icon" />
              <h3>No entries found</h3>
              <p>
                {debouncedSearchQuery ? (
                  <>No entries match your search criteria. Try adjusting your filters or search query.</>
                ) : (
                  <>Get started by creating your first knowledge base entry.</>
                )}
              </p>
              {!readOnly && !debouncedSearchQuery && (
                <Button onClick={() => setShowCreateModal(true)} variant="primary">
                  <Plus size={16} />
                  Create First Entry
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Entry detail modal */}
      {showEntryDetail && selectedEntry && (
        <KBEntryDetail
          entry={selectedEntry}
          isModal={true}
          onClose={() => setShowEntryDetail(false)}
          onEdit={() => {
            setShowEntryDetail(false);
            setShowEditModal(true);
          }}
          onRate={handleEntryRate}
          canEdit={!readOnly}
          canDelete={!readOnly}
          canRate={true}
        />
      )}

      {/* Edit entry modal */}
      {showEditModal && selectedEntry && (
        <EditKBEntryModal
          isOpen={showEditModal}
          entry={selectedEntry}
          onClose={() => setShowEditModal(false)}
          onSave={async (entryId, data) => {
            setEntries(prev => prev.map(entry =>
              entry.id === entryId
                ? { ...entry, ...data, updated_at: new Date() }
                : entry
            ));
            setShowEditModal(false);
          }}
          onDelete={async (entryId) => {
            setEntries(prev => prev.filter(entry => entry.id !== entryId));
            setShowEditModal(false);
          }}
          canDelete={!readOnly}
          canArchive={!readOnly}
          enableAutoSave={true}
        />
      )}

      {/* Export modal */}
      <Modal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Export Knowledge Base"
      >
        <div className="kb-export-modal">
          <p>Export {filteredEntries.length} entries to:</p>
          <div className="kb-export-options">
            <Button onClick={() => handleExport('json')} variant="secondary">
              <FileText size={16} />
              JSON Format
            </Button>
            <Button onClick={() => handleExport('csv')} variant="secondary">
              <Database size={16} />
              CSV Format
            </Button>
            <Button onClick={() => handleExport('pdf')} variant="secondary">
              <FileText size={16} />
              PDF Report
            </Button>
          </div>
        </div>
      </Modal>

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.csv"
        onChange={handleImport}
        style={{ display: 'none' }}
      />
    </div>
  );
};