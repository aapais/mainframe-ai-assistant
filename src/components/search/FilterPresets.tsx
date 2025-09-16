/**
 * FilterPresets Component - Clean version
 * Advanced filter preset management with categories, search, and import/export
 */

import React, {
  memo,
  useState,
  useMemo,
  useCallback
} from 'react';

import {
  Search,
  X,
  Star,
  Bookmark,
  Download,
  Upload,
  Edit3,
  Trash2,
  ChevronRight,
  Clock,
  User,
  Globe,
  Settings,
  Archive
} from 'lucide-react';

import { BaseComponentProps } from '../types/BaseComponent';

// =========================
// TYPES
// =========================

export interface FilterPreset {
  id: string;
  name: string;
  description?: string;
  filters: Record<string, any>;
  category?: string;
  tags?: string[];
  isDefault?: boolean;
  isGlobal?: boolean;
  createdAt: Date;
  updatedAt?: Date;
  usageCount?: number;
  author?: string;
}

export interface PresetCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  presets: FilterPreset[];
}

export interface FilterPresetsProps extends BaseComponentProps {
  presets: FilterPreset[];
  onSelect?: (preset: FilterPreset) => void;
  onDelete?: (presetId: string) => void;
  onEdit?: (preset: FilterPreset) => void;
  onExport?: (presets: FilterPreset[]) => void;
  onImport?: (presets: FilterPreset[]) => void;
  onClose?: () => void;
  showManagement?: boolean;
  compact?: boolean;
}

// =========================
// UTILITY FUNCTIONS
// =========================

const getCategoryIcon = (categoryId: string): React.ReactNode => {
  const iconMap: Record<string, React.ReactNode> = {
    recent: <Clock size={16} className="text-blue-600" />,
    personal: <User size={16} className="text-green-600" />,
    global: <Globe size={16} className="text-purple-600" />,
    system: <Settings size={16} className="text-gray-600" />,
    archived: <Archive size={16} className="text-gray-400" />
  };
  return iconMap[categoryId] || <Bookmark size={16} className="text-gray-600" />;
};

const categorizePresets = (presets: FilterPreset[]): PresetCategory[] => {
  const categories: Record<string, PresetCategory> = {
    recent: {
      id: 'recent',
      name: 'Recently Used',
      icon: getCategoryIcon('recent'),
      presets: []
    },
    personal: {
      id: 'personal',
      name: 'Personal',
      icon: getCategoryIcon('personal'),
      presets: []
    },
    global: {
      id: 'global',
      name: 'Global',
      icon: getCategoryIcon('global'),
      presets: []
    },
    system: {
      id: 'system',
      name: 'System',
      icon: getCategoryIcon('system'),
      presets: []
    }
  };

  // Sort presets by usage and recency
  const sortedPresets = [...presets].sort((a, b) => {
    const aUsage = a.usageCount || 0;
    const bUsage = b.usageCount || 0;
    const aTime = new Date(a.updatedAt || a.createdAt).getTime();
    const bTime = new Date(b.updatedAt || b.createdAt).getTime();

    if (aUsage !== bUsage) return bUsage - aUsage;
    return bTime - aTime;
  });

  // Categorize presets
  sortedPresets.forEach(preset => {
    const categoryId = preset.category || (preset.isGlobal ? 'global' : 'personal');

    if (categories[categoryId]) {
      categories[categoryId].presets.push(preset);
    }

    // Add to recent if used recently
    const daysSinceUpdate = preset.updatedAt
      ? (Date.now() - new Date(preset.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
      : Infinity;

    if (daysSinceUpdate <= 7 && (preset.usageCount || 0) > 0) {
      if (!categories.recent.presets.some(p => p.id === preset.id)) {
        categories.recent.presets.push(preset);
      }
    }
  });

  return Object.values(categories).filter(category => category.presets.length > 0);
};

// =========================
// PRESET ITEM COMPONENT
// =========================

const PresetItem = memo<{
  preset: FilterPreset;
  onSelect?: (preset: FilterPreset) => void;
  onEdit?: (preset: FilterPreset) => void;
  onDelete?: (presetId: string) => void;
  showManagement?: boolean;
  compact?: boolean;
}>(({ preset, onSelect, onEdit, onDelete, showManagement = false, compact = false }) => {
  const handleSelect = useCallback(() => {
    if (onSelect) {
      onSelect(preset);
    }
  }, [preset, onSelect]);

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit(preset);
    }
  }, [preset, onEdit]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete && confirm(`Delete preset "${preset.name}"?`)) {
      onDelete(preset.id);
    }
  }, [preset, onDelete]);

  return (
    <div
      onClick={handleSelect}
      className={`
        preset-item p-2 rounded border border-gray-200 hover:border-blue-300 hover:bg-blue-50
        cursor-pointer transition-all duration-150 group
        ${compact ? 'text-sm' : ''}
      `}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Star
              size={compact ? 12 : 14}
              className={`${preset.isDefault ? 'text-yellow-500 fill-current' : 'text-gray-400'}`}
            />
            <span className={`font-medium text-gray-900 truncate ${compact ? 'text-sm' : ''}`}>
              {preset.name}
            </span>
            {preset.isGlobal && (
              <Globe size={10} className="text-purple-500" />
            )}
          </div>

          {preset.description && (
            <p className={`text-gray-600 truncate mt-1 ${compact ? 'text-xs' : 'text-sm'}`}>
              {preset.description}
            </p>
          )}

          <div className="flex items-center gap-3 mt-1">
            {preset.tags && preset.tags.length > 0 && (
              <div className="flex gap-1">
                {preset.tags.slice(0, 3).map(tag => (
                  <span
                    key={tag}
                    className={`
                      px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs
                      ${compact ? 'text-xs' : ''}
                    `}
                  >
                    {tag}
                  </span>
                ))}
                {preset.tags.length > 3 && (
                  <span className="text-xs text-gray-500">+{preset.tags.length - 3}</span>
                )}
              </div>
            )}

            {preset.usageCount !== undefined && preset.usageCount > 0 && (
              <span className="text-xs text-gray-500">
                Used {preset.usageCount} times
              </span>
            )}
          </div>
        </div>

        {showManagement && (
          <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {onEdit && (
              <button
                onClick={handleEdit}
                className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-100 rounded transition-colors"
                title="Edit preset"
              >
                <Edit3 size={12} />
              </button>
            )}
            {onDelete && !preset.isDefault && (
              <button
                onClick={handleDelete}
                className="p-1 text-gray-600 hover:text-red-600 hover:bg-red-100 rounded transition-colors"
                title="Delete preset"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

PresetItem.displayName = 'PresetItem';

// =========================
// PRESET CATEGORY COMPONENT
// =========================

const PresetCategory = memo<{
  category: PresetCategory;
  onSelect?: (preset: FilterPreset) => void;
  onEdit?: (preset: FilterPreset) => void;
  onDelete?: (presetId: string) => void;
  showManagement?: boolean;
  compact?: boolean;
  defaultExpanded?: boolean;
}>(({ category, onSelect, onEdit, onDelete, showManagement = false, compact = false, defaultExpanded = true }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (category.presets.length === 0) return null;

  return (
    <div className="preset-category">
      {/* Category Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-2 text-left hover:bg-gray-50 rounded transition-colors"
      >
        <div className="flex items-center gap-2">
          {category.icon}
          <span className={`font-medium text-gray-700 ${compact ? 'text-sm' : ''}`}>
            {category.name}
          </span>
          <span className="text-xs text-gray-500">({category.presets.length})</span>
        </div>

        <ChevronRight
          size={14}
          className={`text-gray-400 transition-transform ${
            isExpanded ? 'transform rotate-90' : ''
          }`}
        />
      </button>

      {/* Category Presets */}
      {isExpanded && (
        <div className="space-y-2 mt-2 ml-6">
          {category.presets.map(preset => (
            <PresetItem
              key={preset.id}
              preset={preset}
              onSelect={onSelect}
              onEdit={onEdit}
              onDelete={onDelete}
              showManagement={showManagement}
              compact={compact}
            />
          ))}
        </div>
      )}
    </div>
  );
});

PresetCategory.displayName = 'PresetCategory';

// =========================
// MAIN FILTERPRESETS COMPONENT
// =========================

export const FilterPresets = memo<FilterPresetsProps>(({
  presets,
  onSelect,
  onDelete,
  onEdit,
  onExport,
  onImport,
  onClose,
  showManagement = false,
  compact = false,
  className = ''
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPresets = useMemo(() => {
    if (!searchTerm) return presets;

    const term = searchTerm.toLowerCase();
    return presets.filter(preset =>
      preset.name.toLowerCase().includes(term) ||
      preset.description?.toLowerCase().includes(term) ||
      preset.tags?.some(tag => tag.toLowerCase().includes(term)) ||
      preset.category?.toLowerCase().includes(term)
    );
  }, [presets, searchTerm]);

  const categories = useMemo(() =>
    categorizePresets(filteredPresets),
    [filteredPresets]
  );

  const handleExportAll = useCallback(() => {
    if (onExport) {
      onExport(presets);
    }
  }, [presets, onExport]);

  const handleImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onImport) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedPresets = JSON.parse(e.target?.result as string);
        onImport(importedPresets);
      } catch (error) {
        alert('Failed to import presets. Please check the file format.');
      }
    };
    reader.readAsText(file);
  }, [onImport]);

  return (
    <div className={`filter-presets border-b border-gray-200 bg-white ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Bookmark size={18} className="text-gray-600" />
          <h3 className="font-semibold text-gray-900">Filter Presets</h3>
          <span className="text-xs text-gray-500">({presets.length})</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Export/Import */}
          {showManagement && (
            <>
              <button
                onClick={handleExportAll}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                title="Export all presets"
              >
                <Download size={14} />
              </button>

              <label className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors cursor-pointer" title="Import presets">
                <Upload size={14} />
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>
            </>
          )}

          {/* Close */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
              title="Close presets"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      {presets.length > 5 && (
        <div className="p-3 border-b border-gray-100">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search presets..."
              className={`
                w-full px-3 py-2 pl-8 border border-gray-300 rounded-lg
                ${compact ? 'text-sm' : ''}
                focus:ring-2 focus:ring-blue-500 focus:border-transparent
              `}
            />
            <Search size={14} className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Presets List */}
      <div className="max-h-96 overflow-y-auto p-3">
        {categories.length > 0 ? (
          <div className="space-y-4">
            {categories.map(category => (
              <PresetCategory
                key={category.id}
                category={category}
                onSelect={onSelect}
                onEdit={onEdit}
                onDelete={onDelete}
                showManagement={showManagement}
                compact={compact}
                defaultExpanded={category.id === 'recent' || category.id === 'personal'}
              />
            ))}
          </div>
        ) : searchTerm ? (
          <div className="text-center py-8 text-gray-500">
            <Search size={24} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No presets found for "{searchTerm}"</p>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Bookmark size={24} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No saved filter presets</p>
            <p className="text-xs mt-1">Create some filters and save them as presets for quick access</p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      {categories.length > 0 && (
        <div className="p-3 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>
              {filteredPresets.length} preset{filteredPresets.length !== 1 ? 's' : ''}
              {searchTerm && ` matching "${searchTerm}"`}
            </span>

            <div className="flex items-center gap-2">
              <Star size={12} className="text-yellow-500" />
              <span>Click to apply preset</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

FilterPresets.displayName = 'FilterPresets';

export default FilterPresets;