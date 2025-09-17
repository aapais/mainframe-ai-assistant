import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Card, CardContent, CardHeader, CardTitle,
  Input, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Checkbox, Badge, Separator, Collapsible, CollapsibleContent, CollapsibleTrigger,
  DatePicker, Slider, Tabs, TabsContent, TabsList, TabsTrigger,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Alert, AlertDescription, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger
} from '@/components/ui';
import {
  Search, Filter, X, Plus, Save, Upload, ChevronDown, ChevronRight,
  Calendar, Clock, User, Tag, Target, Zap, BookOpen, History,
  SlidersHorizontal, Download, RefreshCw, Info, AlertCircle
} from 'lucide-react';

// Types for advanced search
interface SearchFilter {
  field: string;
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than' | 'between' | 'in' | 'not_in';
  value: any;
  label?: string;
}

interface SearchCriteria {
  query?: string;
  filters: SearchFilter[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  dateRange?: {
    start: Date;
    end: Date;
  };
  includeResolved: boolean;
  includeArchived: boolean;
}

interface SavedSearch {
  id: string;
  name: string;
  description?: string;
  criteria: SearchCriteria;
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
  usageCount: number;
}

interface AdvancedIncidentSearchProps {
  onSearch: (criteria: SearchCriteria) => void;
  onSearchSave?: (search: Omit<SavedSearch, 'id' | 'createdAt' | 'usageCount'>) => void;
  savedSearches?: SavedSearch[];
  loading?: boolean;
  initialCriteria?: Partial<SearchCriteria>;
}

// Field configurations for search filters
const SEARCH_FIELDS = [
  {
    key: 'title',
    label: 'Title',
    type: 'text',
    operators: ['contains', 'starts_with', 'ends_with', 'equals'],
    icon: Tag
  },
  {
    key: 'description',
    label: 'Description',
    type: 'text',
    operators: ['contains', 'starts_with', 'ends_with'],
    icon: BookOpen
  },
  {
    key: 'category',
    label: 'Category',
    type: 'select',
    operators: ['equals', 'in', 'not_in'],
    options: ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'CICS', 'IMS', 'Security', 'Network', 'Hardware', 'Software', 'Other'],
    icon: Target
  },
  {
    key: 'severity',
    label: 'Severity',
    type: 'select',
    operators: ['equals', 'in', 'not_in'],
    options: ['critical', 'high', 'medium', 'low'],
    icon: AlertCircle
  },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    operators: ['equals', 'in', 'not_in'],
    options: ['open', 'in_progress', 'resolved', 'closed', 'reopened'],
    icon: Target
  },
  {
    key: 'assigned_team',
    label: 'Assigned Team',
    type: 'select',
    operators: ['equals', 'in', 'not_in'],
    options: ['Mainframe Core', 'Database Team', 'Network Operations', 'Security Team', 'Application Support'],
    icon: User
  },
  {
    key: 'assigned_to',
    label: 'Assigned To',
    type: 'text',
    operators: ['equals', 'contains'],
    icon: User
  },
  {
    key: 'reporter',
    label: 'Reporter',
    type: 'text',
    operators: ['equals', 'contains'],
    icon: User
  },
  {
    key: 'created_at',
    label: 'Created Date',
    type: 'date',
    operators: ['greater_than', 'less_than', 'between'],
    icon: Calendar
  },
  {
    key: 'resolved_at',
    label: 'Resolved Date',
    type: 'date',
    operators: ['greater_than', 'less_than', 'between'],
    icon: Calendar
  },
  {
    key: 'resolution_time_hours',
    label: 'Resolution Time (hours)',
    type: 'number',
    operators: ['greater_than', 'less_than', 'between'],
    icon: Clock
  },
  {
    key: 'sla_breach',
    label: 'SLA Breach',
    type: 'boolean',
    operators: ['equals'],
    icon: AlertCircle
  },
  {
    key: 'escalation_count',
    label: 'Escalation Count',
    type: 'number',
    operators: ['equals', 'greater_than', 'less_than'],
    icon: Zap
  },
  {
    key: 'tags',
    label: 'Tags',
    type: 'text',
    operators: ['contains', 'in'],
    icon: Tag
  },
  {
    key: 'related_kb_entries',
    label: 'Has KB Links',
    type: 'boolean',
    operators: ['equals'],
    icon: BookOpen
  }
];

const OPERATORS = [
  { value: 'equals', label: 'Equals', description: 'Exact match' },
  { value: 'contains', label: 'Contains', description: 'Contains text' },
  { value: 'starts_with', label: 'Starts with', description: 'Begins with text' },
  { value: 'ends_with', label: 'Ends with', description: 'Ends with text' },
  { value: 'greater_than', label: 'Greater than', description: 'Greater than value' },
  { value: 'less_than', label: 'Less than', description: 'Less than value' },
  { value: 'between', label: 'Between', description: 'Between two values' },
  { value: 'in', label: 'In list', description: 'In comma-separated list' },
  { value: 'not_in', label: 'Not in list', description: 'Not in comma-separated list' }
];

const SORT_OPTIONS = [
  { value: 'created_at', label: 'Created Date' },
  { value: 'updated_at', label: 'Updated Date' },
  { value: 'resolved_at', label: 'Resolved Date' },
  { value: 'severity', label: 'Severity' },
  { value: 'priority', label: 'Priority' },
  { value: 'resolution_time_hours', label: 'Resolution Time' },
  { value: 'title', label: 'Title' },
  { value: 'category', label: 'Category' },
  { value: 'status', label: 'Status' }
];

export const AdvancedIncidentSearch: React.FC<AdvancedIncidentSearchProps> = ({
  onSearch,
  onSearchSave,
  savedSearches = [],
  loading = false,
  initialCriteria
}) => {
  const [searchCriteria, setSearchCriteria] = useState<SearchCriteria>({
    query: '',
    filters: [],
    sortBy: 'created_at',
    sortOrder: 'desc',
    includeResolved: true,
    includeArchived: false,
    ...initialCriteria
  });

  const [activeTab, setActiveTab] = useState<'basic' | 'advanced' | 'saved'>('basic');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState('');
  const [saveSearchDescription, setSaveSearchDescription] = useState('');
  const [isPublicSearch, setIsPublicSearch] = useState(false);

  // Advanced filter state
  const [newFilter, setNewFilter] = useState<Partial<SearchFilter>>({
    field: 'title',
    operator: 'contains',
    value: ''
  });

  const [expandedSections, setExpandedSections] = useState({
    filters: true,
    options: false,
    sorting: false
  });

  // Quick search presets
  const QUICK_SEARCHES = [
    {
      name: 'Critical Open',
      criteria: {
        filters: [
          { field: 'severity', operator: 'equals' as const, value: 'critical' },
          { field: 'status', operator: 'in' as const, value: 'open,in_progress' }
        ]
      }
    },
    {
      name: 'SLA Breaches',
      criteria: {
        filters: [
          { field: 'sla_breach', operator: 'equals' as const, value: true }
        ]
      }
    },
    {
      name: 'Recent Escalations',
      criteria: {
        filters: [
          { field: 'escalation_count', operator: 'greater_than' as const, value: 0 },
          { field: 'created_at', operator: 'greater_than' as const, value: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        ]
      }
    },
    {
      name: 'Unassigned High Priority',
      criteria: {
        filters: [
          { field: 'severity', operator: 'in' as const, value: 'critical,high' },
          { field: 'assigned_to', operator: 'equals' as const, value: null }
        ]
      }
    },
    {
      name: 'Long Running',
      criteria: {
        filters: [
          { field: 'resolution_time_hours', operator: 'greater_than' as const, value: 48 },
          { field: 'status', operator: 'not_in' as const, value: 'resolved,closed' }
        ]
      }
    }
  ];

  // Handle search execution
  const handleSearch = useCallback(() => {
    onSearch(searchCriteria);
  }, [searchCriteria, onSearch]);

  // Auto-search when criteria changes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(handleSearch, 500);
    return () => clearTimeout(timeoutId);
  }, [handleSearch]);

  // Add new filter
  const addFilter = () => {
    if (newFilter.field && newFilter.operator && newFilter.value !== '') {
      const filter: SearchFilter = {
        field: newFilter.field,
        operator: newFilter.operator,
        value: newFilter.value,
        label: generateFilterLabel(newFilter as SearchFilter)
      };

      setSearchCriteria(prev => ({
        ...prev,
        filters: [...prev.filters, filter]
      }));

      setNewFilter({
        field: 'title',
        operator: 'contains',
        value: ''
      });
    }
  };

  // Remove filter
  const removeFilter = (index: number) => {
    setSearchCriteria(prev => ({
      ...prev,
      filters: prev.filters.filter((_, i) => i !== index)
    }));
  };

  // Generate human-readable filter label
  const generateFilterLabel = (filter: SearchFilter): string => {
    const field = SEARCH_FIELDS.find(f => f.key === filter.field);
    const operator = OPERATORS.find(o => o.value === filter.operator);

    let valueStr = filter.value;
    if (Array.isArray(filter.value)) {
      valueStr = filter.value.join(', ');
    } else if (filter.value instanceof Date) {
      valueStr = filter.value.toLocaleDateString();
    }

    return `${field?.label} ${operator?.label} ${valueStr}`;
  };

  // Apply quick search
  const applyQuickSearch = (quickSearch: typeof QUICK_SEARCHES[0]) => {
    setSearchCriteria(prev => ({
      ...prev,
      ...quickSearch.criteria,
      filters: [...prev.filters, ...quickSearch.criteria.filters]
    }));
  };

  // Apply saved search
  const applySavedSearch = (savedSearch: SavedSearch) => {
    setSearchCriteria(savedSearch.criteria);
    setActiveTab('basic');
  };

  // Save current search
  const handleSaveSearch = () => {
    if (!saveSearchName.trim()) return;

    const savedSearch: Omit<SavedSearch, 'id' | 'createdAt' | 'usageCount'> = {
      name: saveSearchName,
      description: saveSearchDescription,
      criteria: searchCriteria,
      isPublic: isPublicSearch,
      createdBy: 'current_user' // Replace with actual user
    };

    onSearchSave?.(savedSearch);
    setShowSaveDialog(false);
    setSaveSearchName('');
    setSaveSearchDescription('');
    setIsPublicSearch(false);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchCriteria({
      query: '',
      filters: [],
      sortBy: 'created_at',
      sortOrder: 'desc',
      includeResolved: true,
      includeArchived: false
    });
  };

  // Export search criteria
  const exportSearchCriteria = () => {
    const blob = new Blob([JSON.stringify(searchCriteria, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `incident-search-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Get field configuration
  const getFieldConfig = (fieldKey: string) => {
    return SEARCH_FIELDS.find(f => f.key === fieldKey);
  };

  // Render filter value input
  const renderFilterValueInput = (filter: Partial<SearchFilter>) => {
    const fieldConfig = getFieldConfig(filter.field || '');
    if (!fieldConfig) return null;

    switch (fieldConfig.type) {
      case 'select':
        if (filter.operator === 'in' || filter.operator === 'not_in') {
          return (
            <Input
              placeholder="value1,value2,value3"
              value={filter.value || ''}
              onChange={(e) => setNewFilter(prev => ({ ...prev, value: e.target.value }))}
            />
          );
        }
        return (
          <Select
            value={filter.value || ''}
            onValueChange={(value) => setNewFilter(prev => ({ ...prev, value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select value" />
            </SelectTrigger>
            <SelectContent>
              {fieldConfig.options?.map(option => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'boolean':
        return (
          <Select
            value={filter.value?.toString() || ''}
            onValueChange={(value) => setNewFilter(prev => ({ ...prev, value: value === 'true' }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select value" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Yes</SelectItem>
              <SelectItem value="false">No</SelectItem>
            </SelectContent>
          </Select>
        );

      case 'date':
        if (filter.operator === 'between') {
          return (
            <div className="flex gap-2">
              <DatePicker
                selected={filter.value?.start}
                onChange={(date) => setNewFilter(prev => ({
                  ...prev,
                  value: { ...prev.value, start: date }
                }))}
                placeholderText="Start date"
              />
              <DatePicker
                selected={filter.value?.end}
                onChange={(date) => setNewFilter(prev => ({
                  ...prev,
                  value: { ...prev.value, end: date }
                }))}
                placeholderText="End date"
              />
            </div>
          );
        }
        return (
          <DatePicker
            selected={filter.value}
            onChange={(date) => setNewFilter(prev => ({ ...prev, value: date }))}
            placeholderText="Select date"
          />
        );

      case 'number':
        if (filter.operator === 'between') {
          return (
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Min value"
                value={filter.value?.min || ''}
                onChange={(e) => setNewFilter(prev => ({
                  ...prev,
                  value: { ...prev.value, min: parseFloat(e.target.value) }
                }))}
              />
              <Input
                type="number"
                placeholder="Max value"
                value={filter.value?.max || ''}
                onChange={(e) => setNewFilter(prev => ({
                  ...prev,
                  value: { ...prev.value, max: parseFloat(e.target.value) }
                }))}
              />
            </div>
          );
        }
        return (
          <Input
            type="number"
            placeholder="Enter number"
            value={filter.value || ''}
            onChange={(e) => setNewFilter(prev => ({ ...prev, value: parseFloat(e.target.value) }))}
          />
        );

      default:
        return (
          <Input
            placeholder="Enter value"
            value={filter.value || ''}
            onChange={(e) => setNewFilter(prev => ({ ...prev, value: e.target.value }))}
          />
        );
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Search className="h-5 w-5" />
          Advanced Incident Search
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportSearchCriteria}
          >
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSaveDialog(true)}
            disabled={searchCriteria.filters.length === 0 && !searchCriteria.query}
          >
            <Save className="h-4 w-4 mr-1" />
            Save Search
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearFilters}
          >
            <X className="h-4 w-4 mr-1" />
            Clear All
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic">Basic Search</TabsTrigger>
          <TabsTrigger value="advanced">Advanced Filters</TabsTrigger>
          <TabsTrigger value="saved">Saved Searches ({savedSearches.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          {/* Basic Search */}
          <Card>
            <CardContent className="p-4 space-y-4">
              {/* Main Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search incidents by title, description, or ID..."
                  value={searchCriteria.query}
                  onChange={(e) => setSearchCriteria(prev => ({ ...prev, query: e.target.value }))}
                  className="pl-10"
                />
              </div>

              {/* Quick Search Buttons */}
              <div className="flex flex-wrap gap-2">
                <span className="text-sm font-medium text-gray-600">Quick searches:</span>
                {QUICK_SEARCHES.map(quickSearch => (
                  <Button
                    key={quickSearch.name}
                    variant="outline"
                    size="sm"
                    onClick={() => applyQuickSearch(quickSearch)}
                  >
                    {quickSearch.name}
                  </Button>
                ))}
              </div>

              {/* Active Filters */}
              {searchCriteria.filters.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    <span className="text-sm font-medium">Active Filters:</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {searchCriteria.filters.map((filter, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => removeFilter(index)}
                      >
                        {filter.label}
                        <X className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          {/* Advanced Filters */}
          <Card>
            <CardHeader>
              <Collapsible
                open={expandedSections.filters}
                onOpenChange={() => toggleSection('filters')}
              >
                <CollapsibleTrigger className="flex items-center gap-2 w-full">
                  {expandedSections.filters ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <CardTitle className="text-base">Filters</CardTitle>
                </CollapsibleTrigger>
              </Collapsible>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                {/* Add New Filter */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                  <div>
                    <label className="text-sm font-medium">Field</label>
                    <Select
                      value={newFilter.field}
                      onValueChange={(value) => setNewFilter(prev => ({ ...prev, field: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SEARCH_FIELDS.map(field => (
                          <SelectItem key={field.key} value={field.key}>
                            <div className="flex items-center gap-2">
                              <field.icon className="h-4 w-4" />
                              {field.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Operator</label>
                    <Select
                      value={newFilter.operator}
                      onValueChange={(value) => setNewFilter(prev => ({ ...prev, operator: value as any }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATORS
                          .filter(op => {
                            const fieldConfig = getFieldConfig(newFilter.field || '');
                            return fieldConfig?.operators.includes(op.value as any);
                          })
                          .map(operator => (
                            <SelectItem key={operator.value} value={operator.value}>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>{operator.label}</TooltipTrigger>
                                  <TooltipContent>{operator.description}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Value</label>
                    {renderFilterValueInput(newFilter)}
                  </div>

                  <Button onClick={addFilter} disabled={!newFilter.field || !newFilter.operator || newFilter.value === ''}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Filter
                  </Button>
                </div>

                {/* Current Filters */}
                {searchCriteria.filters.length > 0 && (
                  <div className="space-y-2">
                    <Separator />
                    <h4 className="text-sm font-medium">Current Filters</h4>
                    <div className="space-y-2">
                      {searchCriteria.filters.map((filter, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="text-sm">{filter.label}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFilter(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>

          {/* Search Options */}
          <Card>
            <CardHeader>
              <Collapsible
                open={expandedSections.options}
                onOpenChange={() => toggleSection('options')}
              >
                <CollapsibleTrigger className="flex items-center gap-2 w-full">
                  {expandedSections.options ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <CardTitle className="text-base">Search Options</CardTitle>
                </CollapsibleTrigger>
              </Collapsible>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={searchCriteria.includeResolved}
                      onCheckedChange={(checked) =>
                        setSearchCriteria(prev => ({ ...prev, includeResolved: !!checked }))
                      }
                    />
                    <label className="text-sm">Include resolved incidents</label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={searchCriteria.includeArchived}
                      onCheckedChange={(checked) =>
                        setSearchCriteria(prev => ({ ...prev, includeArchived: !!checked }))
                      }
                    />
                    <label className="text-sm">Include archived incidents</label>
                  </div>
                </div>

                {/* Date Range */}
                {searchCriteria.dateRange && (
                  <div>
                    <label className="text-sm font-medium">Date Range</label>
                    <div className="flex gap-2">
                      <DatePicker
                        selected={searchCriteria.dateRange.start}
                        onChange={(date) =>
                          setSearchCriteria(prev => ({
                            ...prev,
                            dateRange: { ...prev.dateRange!, start: date! }
                          }))
                        }
                        placeholderText="Start date"
                      />
                      <DatePicker
                        selected={searchCriteria.dateRange.end}
                        onChange={(date) =>
                          setSearchCriteria(prev => ({
                            ...prev,
                            dateRange: { ...prev.dateRange!, end: date! }
                          }))
                        }
                        placeholderText="End date"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>

          {/* Sorting */}
          <Card>
            <CardHeader>
              <Collapsible
                open={expandedSections.sorting}
                onOpenChange={() => toggleSection('sorting')}
              >
                <CollapsibleTrigger className="flex items-center gap-2 w-full">
                  {expandedSections.sorting ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <CardTitle className="text-base">Sorting</CardTitle>
                </CollapsibleTrigger>
              </Collapsible>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Sort By</label>
                    <Select
                      value={searchCriteria.sortBy}
                      onValueChange={(value) => setSearchCriteria(prev => ({ ...prev, sortBy: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SORT_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Order</label>
                    <Select
                      value={searchCriteria.sortOrder}
                      onValueChange={(value) => setSearchCriteria(prev => ({ ...prev, sortOrder: value as any }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="desc">Descending</SelectItem>
                        <SelectItem value="asc">Ascending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </TabsContent>

        <TabsContent value="saved" className="space-y-4">
          {/* Saved Searches */}
          <Card>
            <CardHeader>
              <CardTitle>Saved Searches</CardTitle>
            </CardHeader>
            <CardContent>
              {savedSearches.length === 0 ? (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    No saved searches yet. Create and save searches from the Advanced Filters tab.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  {savedSearches.map(savedSearch => (
                    <div
                      key={savedSearch.id}
                      className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                      onClick={() => applySavedSearch(savedSearch)}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{savedSearch.name}</h4>
                          {savedSearch.isPublic && <Badge variant="outline">Public</Badge>}
                        </div>
                        {savedSearch.description && (
                          <p className="text-sm text-gray-600 mt-1">{savedSearch.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                          <span>By {savedSearch.createdBy}</span>
                          <span>{savedSearch.createdAt.toLocaleDateString()}</span>
                          <span>Used {savedSearch.usageCount} times</span>
                          <span>{savedSearch.criteria.filters.length} filters</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm">
                          Apply
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Search Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Search</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Search Name</label>
              <Input
                placeholder="Enter a name for this search"
                value={saveSearchName}
                onChange={(e) => setSaveSearchName(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Description (Optional)</label>
              <Input
                placeholder="Describe what this search is for"
                value={saveSearchDescription}
                onChange={(e) => setSaveSearchDescription(e.target.value)}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                checked={isPublicSearch}
                onCheckedChange={(checked) => setIsPublicSearch(!!checked)}
              />
              <label className="text-sm">Make this search public (visible to all users)</label>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                This search includes {searchCriteria.filters.length} filters and will be saved with your current criteria.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSearch} disabled={!saveSearchName.trim()}>
              Save Search
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Search Action Button */}
      <div className="flex justify-center">
        <Button
          onClick={handleSearch}
          disabled={loading}
          className="min-w-32"
        >
          {loading ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Search className="h-4 w-4 mr-2" />
          )}
          Search Incidents
        </Button>
      </div>
    </div>
  );
};

export default AdvancedIncidentSearch;