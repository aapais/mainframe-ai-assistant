import React, { useState, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronUp, Filter, X, Save, Download, Calendar, User, Tag, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';

// Types for filtering
export interface IncidentFilters {
  status: string[];
  priority: string[];
  dateRange: {
    type: 'created' | 'updated' | 'resolved';
    startDate: string;
    endDate: string;
  } | null;
  assignedTo: string[];
  category: string[];
  impactLevel: string[];
  tags: string[];
  slaStatus: string[];
  searchText: string;
}

export interface FilterPreset {
  id: string;
  name: string;
  filters: IncidentFilters;
  isDefault?: boolean;
}

interface AdvancedFiltersPanelProps {
  filters: IncidentFilters;
  onFiltersChange: (filters: IncidentFilters) => void;
  onExport: (filters: IncidentFilters) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
}

// Mock data for dropdowns (in real app, these would come from props or API)
const MOCK_DATA = {
  statuses: [
    { value: 'open', label: 'Aberto', color: 'bg-red-500' },
    { value: 'in-progress', label: 'Em Andamento', color: 'bg-yellow-500' },
    { value: 'resolved', label: 'Resolvido', color: 'bg-green-500' },
    { value: 'closed', label: 'Fechado', color: 'bg-gray-500' },
    { value: 'pending', label: 'Pendente', color: 'bg-blue-500' }
  ],
  priorities: [
    { value: 'P1', label: 'P1 - Crítico', color: 'bg-red-600' },
    { value: 'P2', label: 'P2 - Alto', color: 'bg-orange-500' },
    { value: 'P3', label: 'P3 - Médio', color: 'bg-yellow-500' },
    { value: 'P4', label: 'P4 - Baixo', color: 'bg-green-500' }
  ],
  users: [
    { value: 'user1', label: 'João Silva' },
    { value: 'user2', label: 'Maria Santos' },
    { value: 'user3', label: 'Pedro Oliveira' },
    { value: 'user4', label: 'Ana Costa' }
  ],
  categories: [
    { value: 'infrastructure', label: 'Infraestrutura' },
    { value: 'application', label: 'Aplicação' },
    { value: 'network', label: 'Rede' },
    { value: 'security', label: 'Segurança' },
    { value: 'database', label: 'Banco de Dados' }
  ],
  impactLevels: [
    { value: 'critical', label: 'Crítico', color: 'bg-red-600' },
    { value: 'high', label: 'Alto', color: 'bg-orange-500' },
    { value: 'medium', label: 'Médio', color: 'bg-yellow-500' },
    { value: 'low', label: 'Baixo', color: 'bg-green-500' }
  ],
  slaStatuses: [
    { value: 'on-time', label: 'No Prazo', color: 'bg-green-500' },
    { value: 'at-risk', label: 'Em Risco', color: 'bg-yellow-500' },
    { value: 'breached', label: 'Violado', color: 'bg-red-500' }
  ]
};

const QUICK_FILTERS = [
  {
    id: 'my-incidents',
    name: 'Meus Incidentes',
    icon: User,
    filters: { assignedTo: ['current-user'] }
  },
  {
    id: 'critical-open',
    name: 'Críticos Abertos',
    icon: AlertTriangle,
    filters: { priority: ['P1'], status: ['open', 'in-progress'] }
  },
  {
    id: 'today',
    name: 'Hoje',
    icon: Calendar,
    filters: {
      dateRange: {
        type: 'created' as const,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
      }
    }
  },
  {
    id: 'sla-risk',
    name: 'SLA em Risco',
    icon: Clock,
    filters: { slaStatus: ['at-risk', 'breached'] }
  }
];

export const AdvancedFiltersPanel: React.FC<AdvancedFiltersPanelProps> = ({
  filters,
  onFiltersChange,
  onExport,
  isCollapsed = false,
  onToggleCollapse,
  className = ''
}) => {
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [savedPresets, setSavedPresets] = useState<FilterPreset[]>([]);

  // Multi-select component for various filter types
  const MultiSelect: React.FC<{
    options: Array<{ value: string; label: string; color?: string }>;
    selected: string[];
    onChange: (selected: string[]) => void;
    placeholder: string;
    icon?: React.ComponentType<any>;
  }> = ({ options, selected, onChange, placeholder, icon: Icon }) => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleOption = (value: string) => {
      const newSelected = selected.includes(value)
        ? selected.filter(item => item !== value)
        : [...selected, value];
      onChange(newSelected);
    };

    return (
      <div className="relative">
        <div
          className="min-h-[38px] p-2 border border-gray-300 rounded-md cursor-pointer bg-white flex items-center justify-between"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex items-center gap-2 flex-wrap">
            {Icon && <Icon className="w-4 h-4 text-gray-500" />}
            {selected.length === 0 ? (
              <span className="text-gray-500">{placeholder}</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {selected.map(value => {
                  const option = options.find(opt => opt.value === value);
                  return (
                    <Badge
                      key={value}
                      variant="secondary"
                      className={`text-xs ${option?.color ? `${option.color} text-white` : ''}`}
                    >
                      {option?.label || value}
                      <X
                        className="w-3 h-3 ml-1 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleOption(value);
                        }}
                      />
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {options.map(option => (
              <div
                key={option.value}
                className={`p-2 cursor-pointer hover:bg-gray-50 flex items-center gap-2 ${
                  selected.includes(option.value) ? 'bg-blue-50' : ''
                }`}
                onClick={() => toggleOption(option.value)}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(option.value)}
                  onChange={() => {}}
                  className="w-4 h-4"
                />
                {option.color && (
                  <div className={`w-3 h-3 rounded-full ${option.color}`}></div>
                )}
                <span>{option.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Date range picker component
  const DateRangePicker: React.FC = () => {
    const [dateType, setDateType] = useState<'created' | 'updated' | 'resolved'>(
      filters.dateRange?.type || 'created'
    );

    const updateDateRange = (field: string, value: string) => {
      const current = filters.dateRange || { type: dateType, startDate: '', endDate: '' };
      onFiltersChange({
        ...filters,
        dateRange: {
          ...current,
          [field]: value
        }
      });
    };

    return (
      <div className="space-y-2">
        <select
          value={dateType}
          onChange={(e) => {
            const newType = e.target.value as 'created' | 'updated' | 'resolved';
            setDateType(newType);
            onFiltersChange({
              ...filters,
              dateRange: filters.dateRange ? { ...filters.dateRange, type: newType } : null
            });
          }}
          className="w-full p-2 border border-gray-300 rounded-md"
        >
          <option value="created">Data de Criação</option>
          <option value="updated">Data de Atualização</option>
          <option value="resolved">Data de Resolução</option>
        </select>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="date"
            placeholder="Data Início"
            value={filters.dateRange?.startDate || ''}
            onChange={(e) => updateDateRange('startDate', e.target.value)}
          />
          <Input
            type="date"
            placeholder="Data Fim"
            value={filters.dateRange?.endDate || ''}
            onChange={(e) => updateDateRange('endDate', e.target.value)}
          />
        </div>
      </div>
    );
  };

  // Quick filter buttons
  const applyQuickFilter = (quickFilter: typeof QUICK_FILTERS[0]) => {
    const newFilters = { ...filters };

    Object.entries(quickFilter.filters).forEach(([key, value]) => {
      if (key in newFilters) {
        (newFilters as any)[key] = value;
      }
    });

    onFiltersChange(newFilters);
  };

  // Clear all filters
  const clearAllFilters = () => {
    onFiltersChange({
      status: [],
      priority: [],
      dateRange: null,
      assignedTo: [],
      category: [],
      impactLevel: [],
      tags: [],
      slaStatus: [],
      searchText: ''
    });
  };

  // Save filter preset
  const savePreset = () => {
    if (!presetName.trim()) return;

    const newPreset: FilterPreset = {
      id: Date.now().toString(),
      name: presetName,
      filters: { ...filters }
    };

    setSavedPresets(prev => [...prev, newPreset]);
    setPresetName('');
    setShowPresetModal(false);
  };

  // Apply saved preset
  const applyPreset = (preset: FilterPreset) => {
    onFiltersChange(preset.filters);
  };

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.status.length > 0) count++;
    if (filters.priority.length > 0) count++;
    if (filters.dateRange) count++;
    if (filters.assignedTo.length > 0) count++;
    if (filters.category.length > 0) count++;
    if (filters.impactLevel.length > 0) count++;
    if (filters.tags.length > 0) count++;
    if (filters.slaStatus.length > 0) count++;
    if (filters.searchText.trim()) count++;
    return count;
  }, [filters]);

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Filtros Avançados</h3>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              {activeFilterCount} ativo{activeFilterCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onExport(filters)}
            className="flex items-center gap-1"
          >
            <Download className="w-4 h-4" />
            Exportar
          </Button>
          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleCollapse}
              className="p-1"
            >
              {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <div className="p-4 space-y-6">
          {/* Quick Filters */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Filtros Rápidos</h4>
            <div className="flex flex-wrap gap-2">
              {QUICK_FILTERS.map(quickFilter => {
                const Icon = quickFilter.icon;
                return (
                  <Button
                    key={quickFilter.id}
                    variant="outline"
                    size="sm"
                    onClick={() => applyQuickFilter(quickFilter)}
                    className="flex items-center gap-1"
                  >
                    <Icon className="w-4 h-4" />
                    {quickFilter.name}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Search Text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Busca por Texto
            </label>
            <Input
              type="text"
              placeholder="Buscar por título, descrição..."
              value={filters.searchText}
              onChange={(e) => onFiltersChange({ ...filters, searchText: e.target.value })}
            />
          </div>

          {/* Main Filters Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <MultiSelect
                options={MOCK_DATA.statuses}
                selected={filters.status}
                onChange={(selected) => onFiltersChange({ ...filters, status: selected })}
                placeholder="Selecionar status"
              />
            </div>

            {/* Priority Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade</label>
              <MultiSelect
                options={MOCK_DATA.priorities}
                selected={filters.priority}
                onChange={(selected) => onFiltersChange({ ...filters, priority: selected })}
                placeholder="Selecionar prioridades"
                icon={AlertTriangle}
              />
            </div>

            {/* Assigned To Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Atribuído Para</label>
              <MultiSelect
                options={MOCK_DATA.users}
                selected={filters.assignedTo}
                onChange={(selected) => onFiltersChange({ ...filters, assignedTo: selected })}
                placeholder="Selecionar usuários"
                icon={User}
              />
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoria/Sistema</label>
              <MultiSelect
                options={MOCK_DATA.categories}
                selected={filters.category}
                onChange={(selected) => onFiltersChange({ ...filters, category: selected })}
                placeholder="Selecionar categorias"
              />
            </div>

            {/* Impact Level Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nível de Impacto</label>
              <MultiSelect
                options={MOCK_DATA.impactLevels}
                selected={filters.impactLevel}
                onChange={(selected) => onFiltersChange({ ...filters, impactLevel: selected })}
                placeholder="Selecionar impactos"
              />
            </div>

            {/* SLA Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status SLA</label>
              <MultiSelect
                options={MOCK_DATA.slaStatuses}
                selected={filters.slaStatus}
                onChange={(selected) => onFiltersChange({ ...filters, slaStatus: selected })}
                placeholder="Selecionar status SLA"
                icon={Clock}
              />
            </div>
          </div>

          {/* Date Range Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Intervalo de Datas</label>
            <DateRangePicker />
          </div>

          {/* Tags Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
            <Input
              type="text"
              placeholder="Digite tags separadas por vírgula"
              value={filters.tags.join(', ')}
              onChange={(e) => {
                const tags = e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag);
                onFiltersChange({ ...filters, tags });
              }}
            />
          </div>

          {/* Saved Presets */}
          {savedPresets.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Presets Salvos</h4>
              <div className="flex flex-wrap gap-2">
                {savedPresets.map(preset => (
                  <Button
                    key={preset.id}
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset(preset)}
                    className="flex items-center gap-1"
                  >
                    <Filter className="w-4 h-4" />
                    {preset.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={clearAllFilters}
                disabled={activeFilterCount === 0}
              >
                Limpar Filtros
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowPresetModal(true)}
                disabled={activeFilterCount === 0}
              >
                <Save className="w-4 h-4 mr-1" />
                Salvar Preset
              </Button>
            </div>
            <div className="text-sm text-gray-500">
              {activeFilterCount} filtro{activeFilterCount !== 1 ? 's' : ''} ativo{activeFilterCount !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      )}

      {/* Save Preset Modal */}
      {showPresetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Salvar Preset de Filtros</h3>
            <Input
              type="text"
              placeholder="Nome do preset"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              className="mb-4"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowPresetModal(false)}>
                Cancelar
              </Button>
              <Button onClick={savePreset} disabled={!presetName.trim()}>
                Salvar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedFiltersPanel;