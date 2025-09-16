/**
 * Tag Cloud Visualization Component
 *
 * Interactive tag cloud with frequency-based sizing, color coding,
 * filtering capabilities, and responsive design.
 *
 * Features:
 * - Frequency-based tag sizing
 * - Color-coded categories
 * - Interactive filtering
 * - Search and highlight
 * - Responsive layout
 * - Accessibility support
 * - Export capabilities
 *
 * @author Swarm Architecture Team
 * @version 1.0.0
 */

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  memo
} from 'react';
import { Tag } from '../../services/EnhancedTagService';
import './TagCloudVisualization.css';

// ===========================
// TYPES & INTERFACES
// ===========================

export interface TagCloudItem {
  tag: Tag;
  weight: number; // 0-1 normalized weight
  size: number; // Font size in pixels
  x?: number; // Position for layout
  y?: number;
  color?: string;
}

export interface TagCloudVisualizationProps {
  className?: string;
  width?: number;
  height?: number;

  // Data
  tags: Array<{ tag: Tag; weight: number }>;
  loading?: boolean;
  error?: string;

  // Display options
  minFontSize?: number;
  maxFontSize?: number;
  colorScheme?: 'category' | 'frequency' | 'custom';
  layout?: 'spiral' | 'grid' | 'random' | 'force';
  shape?: 'rectangle' | 'circle' | 'heart' | 'star';

  // Interaction
  searchQuery?: string;
  selectedCategory?: string;
  selectedTags?: string[];
  enableSearch?: boolean;
  enableFilter?: boolean;
  enableSelection?: boolean;

  // Event handlers
  onTagClick?: (tag: Tag) => void;
  onTagHover?: (tag: Tag | null) => void;
  onSelectionChange?: (selectedTags: Tag[]) => void;
  onSearchChange?: (query: string) => void;
  onCategoryFilter?: (category: string | null) => void;

  // Export
  enableExport?: boolean;
  exportFormats?: ('png' | 'svg' | 'pdf' | 'json')[];

  // Accessibility
  ariaLabel?: string;
  announceChanges?: boolean;
}

// ===========================
// MAIN COMPONENT
// ===========================

export const TagCloudVisualization: React.FC<TagCloudVisualizationProps> = memo(({
  className = '',
  width = 800,
  height = 600,
  tags = [],
  loading = false,
  error,
  minFontSize = 12,
  maxFontSize = 48,
  colorScheme = 'category',
  layout = 'spiral',
  shape = 'rectangle',
  searchQuery = '',
  selectedCategory,
  selectedTags = [],
  enableSearch = true,
  enableFilter = true,
  enableSelection = true,
  enableExport = false,
  exportFormats = ['png', 'svg'],
  ariaLabel = 'Tag cloud visualization',
  announceChanges = true,
  onTagClick,
  onTagHover,
  onSelectionChange,
  onSearchChange,
  onCategoryFilter
}) => {
  // State
  const [hoveredTag, setHoveredTag] = useState<Tag | null>(null);
  const [internalSelectedTags, setInternalSelectedTags] = useState<string[]>(selectedTags);
  const [layoutCalculated, setLayoutCalculated] = useState(false);
  const [filteredTags, setFilteredTags] = useState<TagCloudItem[]>([]);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Color schemes
  const colorSchemes = {
    category: {
      'JCL': '#FF6B6B',
      'VSAM': '#4ECDC4',
      'DB2': '#45B7D1',
      'Batch': '#96CEB4',
      'CICS': '#FFEAA7',
      'IMS': '#DDA0DD',
      'System': '#98D8C8',
      'Other': '#F7DC6F',
      'default': '#BDC3C7'
    },
    frequency: {
      high: '#E74C3C',
      medium: '#F39C12',
      low: '#27AE60',
      default: '#95A5A6'
    }
  };

  // Process and filter tags
  const processedTags = useMemo(() => {
    let processed = tags.map(({ tag, weight }) => {
      const size = minFontSize + (maxFontSize - minFontSize) * weight;

      let color = colorSchemes.category.default;
      if (colorScheme === 'category' && tag.category_id) {
        // Find category name from tag's category_id
        color = colorSchemes.category[tag.category_id as keyof typeof colorSchemes.category] || colorSchemes.category.default;
      } else if (colorScheme === 'frequency') {
        if (weight > 0.7) color = colorSchemes.frequency.high;
        else if (weight > 0.4) color = colorSchemes.frequency.medium;
        else color = colorSchemes.frequency.low;
      }

      return {
        tag,
        weight,
        size,
        color
      } as TagCloudItem;
    });

    // Apply filters
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      processed = processed.filter(item =>
        item.tag.name.toLowerCase().includes(query) ||
        item.tag.description?.toLowerCase().includes(query)
      );
    }

    if (selectedCategory) {
      processed = processed.filter(item => item.tag.category_id === selectedCategory);
    }

    // Sort by weight (largest first for better layout)
    return processed.sort((a, b) => b.weight - a.weight);
  }, [tags, searchQuery, selectedCategory, minFontSize, maxFontSize, colorScheme]);

  // Calculate layout
  useEffect(() => {
    if (processedTags.length === 0) {
      setFilteredTags([]);
      setLayoutCalculated(false);
      return;
    }

    const calculateLayout = async () => {
      let layoutTags: TagCloudItem[];

      switch (layout) {
        case 'spiral':
          layoutTags = calculateSpiralLayout(processedTags, width, height);
          break;
        case 'grid':
          layoutTags = calculateGridLayout(processedTags, width, height);
          break;
        case 'random':
          layoutTags = calculateRandomLayout(processedTags, width, height);
          break;
        case 'force':
          layoutTags = await calculateForceLayout(processedTags, width, height);
          break;
        default:
          layoutTags = calculateSpiralLayout(processedTags, width, height);
      }

      setFilteredTags(layoutTags);
      setLayoutCalculated(true);
    };

    calculateLayout();
  }, [processedTags, width, height, layout]);

  // Event handlers
  const handleTagClick = useCallback((tag: Tag, event: React.MouseEvent) => {
    event.stopPropagation();

    if (enableSelection) {
      const newSelected = internalSelectedTags.includes(tag.id)
        ? internalSelectedTags.filter(id => id !== tag.id)
        : [...internalSelectedTags, tag.id];

      setInternalSelectedTags(newSelected);

      const selectedTagObjects = filteredTags
        .filter(item => newSelected.includes(item.tag.id))
        .map(item => item.tag);

      onSelectionChange?.(selectedTagObjects);
    }

    onTagClick?.(tag);
  }, [enableSelection, internalSelectedTags, filteredTags, onTagClick, onSelectionChange]);

  const handleTagHover = useCallback((tag: Tag | null) => {
    setHoveredTag(tag);
    onTagHover?.(tag);
  }, [onTagHover]);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value;
    onSearchChange?.(query);
  }, [onSearchChange]);

  const handleExport = useCallback(async (format: 'png' | 'svg' | 'pdf' | 'json') => {
    if (!svgRef.current) return;

    switch (format) {
      case 'svg':
        await exportAsSVG(svgRef.current);
        break;
      case 'png':
        await exportAsPNG(svgRef.current, width, height);
        break;
      case 'pdf':
        await exportAsPDF(svgRef.current);
        break;
      case 'json':
        await exportAsJSON(filteredTags);
        break;
    }
  }, [filteredTags, width, height]);

  // Render loading state
  if (loading) {
    return (
      <div className={`tag-cloud-loading ${className}`}>
        <div className="loading-spinner" />
        <p>Loading tag cloud...</p>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className={`tag-cloud-error ${className}`} role="alert">
        <h3>Error Loading Tags</h3>
        <p>{error}</p>
      </div>
    );
  }

  // Render empty state
  if (filteredTags.length === 0) {
    return (
      <div className={`tag-cloud-empty ${className}`}>
        <div className="empty-state">
          <h3>No tags to display</h3>
          {searchQuery ? (
            <p>No tags match your search criteria.</p>
          ) : (
            <p>No tags available for visualization.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`tag-cloud-visualization ${className}`}
      role="img"
      aria-label={ariaLabel}
    >
      {/* Controls */}
      <div className="tag-cloud-controls">
        {enableSearch && (
          <div className="search-control">
            <input
              type="text"
              placeholder="Search tags..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="search-input"
              aria-label="Search tags"
            />
          </div>
        )}

        {enableFilter && (
          <div className="filter-controls">
            <select
              value={selectedCategory || ''}
              onChange={(e) => onCategoryFilter?.(e.target.value || null)}
              className="category-filter"
              aria-label="Filter by category"
            >
              <option value="">All Categories</option>
              <option value="JCL">JCL</option>
              <option value="VSAM">VSAM</option>
              <option value="DB2">DB2</option>
              <option value="Batch">Batch Processing</option>
              <option value="CICS">CICS</option>
              <option value="IMS">IMS</option>
              <option value="System">System</option>
              <option value="Other">Other</option>
            </select>
          </div>
        )}

        {enableExport && (
          <div className="export-controls">
            <button
              className="export-dropdown-toggle"
              aria-label="Export options"
            >
              📤 Export
            </button>
            <div className="export-dropdown">
              {exportFormats.map(format => (
                <button
                  key={format}
                  onClick={() => handleExport(format)}
                  className="export-option"
                >
                  Export as {format.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tag Cloud */}
      <div className="tag-cloud-container">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          className="tag-cloud-svg"
          viewBox={`0 0 ${width} ${height}`}
        >
          {/* Background shapes for different shapes */}
          {shape === 'circle' && (
            <circle
              cx={width / 2}
              cy={height / 2}
              r={Math.min(width, height) / 2 - 20}
              fill="none"
              stroke="#E0E0E0"
              strokeDasharray="5,5"
              opacity={0.3}
            />
          )}

          {/* Tags */}
          {layoutCalculated && filteredTags.map((item, index) => {
            const isSelected = internalSelectedTags.includes(item.tag.id);
            const isHovered = hoveredTag?.id === item.tag.id;

            return (
              <g key={item.tag.id}>
                {/* Tag background (for selection/hover) */}
                <rect
                  x={(item.x || 0) - 4}
                  y={(item.y || 0) - item.size}
                  width={item.tag.name.length * (item.size * 0.6) + 8}
                  height={item.size + 8}
                  fill={isSelected ? 'rgba(0, 123, 255, 0.2)' : 'transparent'}
                  stroke={isHovered ? '#007bff' : 'transparent'}
                  strokeWidth={2}
                  rx={4}
                  className="tag-background"
                />

                {/* Tag text */}
                <text
                  x={item.x || 0}
                  y={item.y || 0}
                  fontSize={item.size}
                  fill={item.color}
                  fontWeight={isSelected ? 'bold' : 'normal'}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className={`tag-text ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
                  style={{
                    cursor: 'pointer',
                    userSelect: 'none',
                    opacity: searchQuery && !item.tag.name.toLowerCase().includes(searchQuery.toLowerCase()) ? 0.3 : 1,
                  }}
                  onClick={(e) => handleTagClick(item.tag, e as any)}
                  onMouseEnter={() => handleTagHover(item.tag)}
                  onMouseLeave={() => handleTagHover(null)}
                  role="button"
                  aria-label={`Tag: ${item.tag.name} (used ${item.tag.usage_count || 0} times)`}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleTagClick(item.tag, e as any);
                    }
                  }}
                >
                  {item.tag.name}
                </text>

                {/* Usage indicator */}
                {item.tag.usage_count && item.tag.usage_count > 10 && (
                  <circle
                    cx={(item.x || 0) + (item.tag.name.length * (item.size * 0.3)) + 8}
                    cy={(item.y || 0) - item.size / 2}
                    r={3}
                    fill="#FF6B6B"
                    className="usage-indicator"
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Tag details tooltip */}
      {hoveredTag && (
        <div className="tag-tooltip">
          <h4>{hoveredTag.name}</h4>
          {hoveredTag.description && <p>{hoveredTag.description}</p>}
          <div className="tag-stats">
            <span>Usage: {hoveredTag.usage_count || 0}</span>
            {hoveredTag.trending_score && (
              <span>Trending: {Math.round(hoveredTag.trending_score)}%</span>
            )}
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className="tag-cloud-stats">
        <span className="stats-item">
          Total Tags: {filteredTags.length}
        </span>
        {selectedCategory && (
          <span className="stats-item">
            Category: {selectedCategory}
          </span>
        )}
        {internalSelectedTags.length > 0 && (
          <span className="stats-item">
            Selected: {internalSelectedTags.length}
          </span>
        )}
      </div>

      {/* Screen reader announcements */}
      {announceChanges && (
        <div
          className="sr-only"
          aria-live="polite"
          aria-atomic="false"
        >
          {searchQuery && `Showing ${filteredTags.length} tags matching "${searchQuery}"`}
          {selectedCategory && `Filtered to ${selectedCategory} category`}
          {hoveredTag && `Viewing tag: ${hoveredTag.name}`}
        </div>
      )}
    </div>
  );
});

TagCloudVisualization.displayName = 'TagCloudVisualization';

// ===========================
// LAYOUT ALGORITHMS
// ===========================

function calculateSpiralLayout(tags: TagCloudItem[], width: number, height: number): TagCloudItem[] {
  const center = { x: width / 2, y: height / 2 };
  const layoutTags = [...tags];

  layoutTags.forEach((item, index) => {
    const angle = index * 0.5; // Golden angle approximation
    const radius = Math.sqrt(index + 1) * 8;

    item.x = center.x + Math.cos(angle) * radius;
    item.y = center.y + Math.sin(angle) * radius;

    // Keep within bounds
    item.x = Math.max(item.size, Math.min(width - item.size, item.x));
    item.y = Math.max(item.size, Math.min(height - item.size, item.y));
  });

  return layoutTags;
}

function calculateGridLayout(tags: TagCloudItem[], width: number, height: number): TagCloudItem[] {
  const layoutTags = [...tags];
  const cols = Math.ceil(Math.sqrt(tags.length * (width / height)));
  const rows = Math.ceil(tags.length / cols);
  const cellWidth = width / cols;
  const cellHeight = height / rows;

  layoutTags.forEach((item, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);

    item.x = (col + 0.5) * cellWidth;
    item.y = (row + 0.5) * cellHeight;
  });

  return layoutTags;
}

function calculateRandomLayout(tags: TagCloudItem[], width: number, height: number): TagCloudItem[] {
  const layoutTags = [...tags];

  layoutTags.forEach(item => {
    item.x = Math.random() * (width - item.size * 2) + item.size;
    item.y = Math.random() * (height - item.size * 2) + item.size;
  });

  return layoutTags;
}

async function calculateForceLayout(tags: TagCloudItem[], width: number, height: number): Promise<TagCloudItem[]> {
  // Simplified force-directed layout
  const layoutTags = [...tags];
  const iterations = 50;
  const centerX = width / 2;
  const centerY = height / 2;

  // Initialize random positions
  layoutTags.forEach(item => {
    item.x = centerX + (Math.random() - 0.5) * width * 0.5;
    item.y = centerY + (Math.random() - 0.5) * height * 0.5;
  });

  // Simulate forces
  for (let iter = 0; iter < iterations; iter++) {
    layoutTags.forEach((item, i) => {
      let fx = 0, fy = 0;

      // Repulsion from other tags
      layoutTags.forEach((other, j) => {
        if (i !== j) {
          const dx = (item.x || 0) - (other.x || 0);
          const dy = (item.y || 0) - (other.y || 0);
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 100) { // Minimum distance
            const force = (item.size + other.size) / distance;
            fx += dx * force;
            fy += dy * force;
          }
        }
      });

      // Attraction to center (weighted by importance)
      const dx = centerX - (item.x || 0);
      const dy = centerY - (item.y || 0);
      fx += dx * 0.01 * item.weight;
      fy += dy * 0.01 * item.weight;

      // Apply forces
      item.x = (item.x || 0) + fx * 0.1;
      item.y = (item.y || 0) + fy * 0.1;

      // Keep within bounds
      item.x = Math.max(item.size, Math.min(width - item.size, item.x!));
      item.y = Math.max(item.size, Math.min(height - item.size, item.y!));
    });

    // Add small delay for animation effect if needed
    if (iter % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 1));
    }
  }

  return layoutTags;
}

// ===========================
// EXPORT FUNCTIONS
// ===========================

async function exportAsSVG(svgElement: SVGSVGElement): Promise<void> {
  const svgData = new XMLSerializer().serializeToString(svgElement);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(svgBlob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `tag-cloud-${Date.now()}.svg`;
  link.click();

  URL.revokeObjectURL(url);
}

async function exportAsPNG(svgElement: SVGSVGElement, width: number, height: number): Promise<void> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const svgData = new XMLSerializer().serializeToString(svgElement);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = () => {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const pngUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = pngUrl;
      link.download = `tag-cloud-${Date.now()}.png`;
      link.click();

      URL.revokeObjectURL(pngUrl);
    });

    URL.revokeObjectURL(url);
  };

  img.src = url;
}

async function exportAsPDF(svgElement: SVGSVGElement): Promise<void> {
  // This would require a PDF library like jsPDF
  // For now, we'll export as SVG and let the user convert
  await exportAsSVG(svgElement);
}

async function exportAsJSON(tags: TagCloudItem[]): Promise<void> {
  const data = {
    version: '1.0',
    exported_at: new Date().toISOString(),
    tags: tags.map(item => ({
      id: item.tag.id,
      name: item.tag.name,
      weight: item.weight,
      size: item.size,
      color: item.color,
      position: { x: item.x, y: item.y },
      usage_count: item.tag.usage_count,
      category: item.tag.category_id
    }))
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `tag-cloud-data-${Date.now()}.json`;
  link.click();

  URL.revokeObjectURL(url);
}

export default TagCloudVisualization;