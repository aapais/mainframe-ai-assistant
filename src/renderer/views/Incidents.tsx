import React, { useState, useCallback, useEffect } from 'react';
import { AlertTriangle, Brain, Settings, Plus, Upload, List, BarChart3, FileText, Users, Tag } from 'lucide-react';
import BulkUploadModal from '../components/incident/BulkUploadModal';
import CreateIncidentModal from '../components/incident/CreateIncidentModal';
import { IncidentManagementDashboard } from '../components/incident/IncidentManagementDashboard';
import IncidentQueue from '../components/incident/IncidentQueue';
import AdvancedFiltersPanel from '../components/incident/AdvancedFiltersPanel';
import { searchService } from '../services/searchService';
import { useToastHelpers } from '../components/ui/Toast';
import { CreateIncident } from '../../backend/core/interfaces/ServiceInterfaces';

export interface IncidentResult {
  id: string;
  title: string;
  content: string;
  type: 'incident' | 'solution' | 'analysis' | 'pattern' | 'recommendation' | 'insight';
  priority?: 'P1' | 'P2' | 'P3' | 'P4';
  status?: 'aberto' | 'em_tratamento' | 'resolvido' | 'fechado';
  impact?: 'crítica' | 'alta' | 'média' | 'baixa';
  path?: string;
  lastModified?: Date;
  relevanceScore?: number;
  highlights?: string[];
}

const Incidents: React.FC = () => {
  // Main view state
  const [currentView, setCurrentView] = useState<'dashboard' | 'list'>('dashboard');

  // INTEGRATED APPROACH: Unified view filter state
  const [viewFilter, setViewFilter] = useState<'active' | 'all'>('all');


  // Search-related states (kept for future use)
  const [activeTab, setActiveTab] = useState<'local' | 'ai'>('local');
  const [searchQuery, setSearchQuery] = useState('');
  const [localResults, setLocalResults] = useState<IncidentResult[]>([]);
  const [aiResults, setAIResults] = useState<IncidentResult[]>([]);
  const [isLocalSearching, setIsLocalSearching] = useState(false);
  const [isAISearching, setIsAISearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // Modal states
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
  const [isCreateIncidentModalOpen, setIsCreateIncidentModalOpen] = useState(false);
  const [isCreatingIncident, setIsCreatingIncident] = useState(false);

  // Detail view states
  const [selectedIncident, setSelectedIncident] = useState<IncidentResult | null>(null);
  const [showIncidentDetail, setShowIncidentDetail] = useState(false);

  // List and filter states
  const [allIncidents, setAllIncidents] = useState<IncidentResult[]>([]);
  const [filters, setFilters] = useState<any>({});
  const [showFilters, setShowFilters] = useState(false);

  const [breadcrumbs, setBreadcrumbs] = useState([{ label: 'Incidentes', href: '/incidents' }]);

  // Toast notifications
  const { success, error: showError, info } = useToastHelpers();

  // Debounced local search for real-time results
  const performLocalSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setLocalResults([]);
      return;
    }

    setIsLocalSearching(true);
    try {
      const results = await searchService.searchLocal(query);
      // Transform SearchResult to IncidentResult
      const incidentResults: IncidentResult[] = results.map(result => ({
        ...result,
        type: result.type as IncidentResult['type'],
        priority: 'P3' as const,
        status: 'aberto' as const,
        impact: 'média' as const
      }));
      setLocalResults(incidentResults);
    } catch (error) {
      console.error('Local incident search error:', error);
      setLocalResults([]);
    } finally {
      setIsLocalSearching(false);
    }
  }, []);

  // AI-enhanced incident search
  const performAISearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setAIResults([]);
      return;
    }

    setIsAISearching(true);
    try {
      const results = await searchService.searchAI(query);
      // Transform SearchResult to IncidentResult
      const incidentResults: IncidentResult[] = results.map(result => ({
        ...result,
        type: result.type as IncidentResult['type'],
        priority: 'P2' as const,
        status: 'em_tratamento' as const,
        impact: 'alta' as const
      }));
      setAIResults(incidentResults);

      // Add to search history
      setSearchHistory(prev => {
        const newHistory = [query, ...prev.filter(q => q !== query)].slice(0, 10);
        return newHistory;
      });
    } catch (error) {
      console.error('AI incident search error:', error);
      setAIResults([]);
    } finally {
      setIsAISearching(false);
    }
  }, []);

  // Handle search input changes
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (activeTab === 'local') {
        performLocalSearch(searchQuery);
      }
    }, 200); // 200ms debounce for real-time local search

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, activeTab, performLocalSearch]);

  // Handle incident creation
  const handleCreateIncident = useCallback(async (incidentData: CreateIncident) => {
    setIsCreatingIncident(true);

    try {
      // Call the IPC handler for incident creation
      const result = await window.api.invoke('incident:create', incidentData);

      if (result.success) {
        success(
          'Incidente Criado com Sucesso!',
          `Incidente "${incidentData.title}" foi registrado no sistema.`
        );

        // Refresh the incident list by performing a new search
        if (searchQuery.trim()) {
          if (activeTab === 'local') {
            performLocalSearch(searchQuery);
          } else {
            performAISearch(searchQuery);
          }
        }

        // Close the modal
        setIsCreateIncidentModalOpen(false);
      } else {
        throw new Error(result.error || 'Falha ao criar incidente');
      }
    } catch (err) {
      console.error('Erro ao criar incidente:', err);
      showError(
        'Erro ao Criar Incidente',
        err instanceof Error ? err.message : 'Ocorreu um erro inesperado ao criar o incidente.'
      );
    } finally {
      setIsCreatingIncident(false);
    }
  }, [searchQuery, activeTab, performLocalSearch, performAISearch, success, showError]);

  // Handle AI analysis for incidents
  const handleAIAnalysis = useCallback(async (incidentId?: string, incidentData?: any) => {
    try {
      info('Análise de IA Iniciada', 'Processando análise inteligente do incidente...');

      if (incidentId) {
        // Request AI analysis for existing incident
        const analysisResult = await window.api.invoke('incident:requestAIAnalysis', {
          incidentId,
          analysisType: 'comprehensive',
          includeRecommendations: true
        });

        if (analysisResult.success) {
          success(
            'Análise de IA Concluída',
            'A análise inteligente foi concluída com recomendações.'
          );

          // Execute the AI analysis to get insights
          const executionResult = await window.api.invoke('incident:executeAIAnalysis', {
            analysisId: analysisResult.analysisId,
            incidentId
          });

          if (executionResult.success && executionResult.insights) {
            info(
              'Insights Gerados',
              `${executionResult.insights.length} insights foram identificados pela IA.`
            );
          }
        }
      } else if (incidentData) {
        // Perform semantic search for similar incidents
        const searchResult = await window.api.invoke('incident:semanticSearch', {
          query: `${incidentData.title} ${incidentData.description}`,
          limit: 5,
          threshold: 0.7
        });

        if (searchResult.success && searchResult.similar_incidents?.length > 0) {
          info(
            'Incidentes Similares Encontrados',
            `${searchResult.similar_incidents.length} incidentes similares foram identificados.`
          );
        }
      }
    } catch (err) {
      console.error('Erro na análise de IA:', err);
      showError(
        'Erro na Análise de IA',
        err instanceof Error ? err.message : 'Falha ao executar análise inteligente.'
      );
    }
  }, [info, success, showError]);

  // Handle incident creation error
  const handleCreateIncidentError = useCallback((error: Error) => {
    console.error('Erro detalhado ao criar incidente:', error);
    showError(
      'Falha na Criação do Incidente',
      `Detalhes do erro: ${error.message}`
    );
  }, [showError]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'ai') {
      performAISearch(searchQuery);
    }
  };

  const getResultTypeIcon = (type: IncidentResult['type']) => {
    switch (type) {
      case 'incident': return AlertTriangle;
      case 'solution': return FileText;
      case 'analysis': return Settings;
      case 'pattern': return Users;
      default: return Tag;
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'P1': return 'text-red-600 bg-red-100';
      case 'P2': return 'text-orange-600 bg-orange-100';
      case 'P3': return 'text-yellow-600 bg-yellow-100';
      case 'P4': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getPriorityLabel = (priority?: string) => {
    switch (priority) {
      case 'P1': return 'P1 - Crítica';
      case 'P2': return 'P2 - Alta';
      case 'P3': return 'P3 - Média';
      case 'P4': return 'P4 - Baixa';
      default: return priority;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'aberto': return 'text-red-600 bg-red-100';
      case 'em_tratamento': return 'text-blue-600 bg-blue-100';
      case 'resolvido': return 'text-green-600 bg-green-100';
      case 'fechado': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const currentResults = activeTab === 'local' ? localResults : aiResults;
  const isSearching = activeTab === 'local' ? isLocalSearching : isAISearching;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
              <AlertTriangle className="w-7 h-7 mr-3 text-red-600 dark:text-red-400" />
              Gestão de Incidentes
            </h1>

            {/* Toolbar */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setIsBulkUploadModalOpen(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#A100FF] hover:bg-[#8000CC] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#A100FF] transition-all duration-200 shadow-sm"
                title="Funcionalidade em desenvolvimento - Clique para ver preview"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload em Massa
              </button>
            </div>
          </div>

          {/* Main Navigation Tabs */}
          <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg mb-6">
            {[
              { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
              { key: 'list', label: 'Lista Unificada', icon: List }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = currentView === tab.key;

              return (
                <button
                  key={tab.key}
                  onClick={() => setCurrentView(tab.key as 'dashboard' | 'list')}
                  className={`flex items-center px-4 py-2 rounded-md transition-all duration-200 ${
                    isActive
                      ? 'bg-white dark:bg-gray-600 text-red-600 dark:text-red-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* INTEGRATED VIEW FILTER - Only show in list view */}
          {currentView === 'list' && (
            <div className="flex space-x-1 bg-blue-50 dark:bg-blue-900/20 p-1 rounded-lg mb-6 border border-blue-200 dark:border-blue-800">
              {[
                { key: 'active', label: 'Incidentes Ativos', count: 12, description: 'Incidentes abertos e em tratamento' },
                { key: 'all', label: 'Todos os Incidentes', count: 247, description: 'Todos os incidentes incluindo resolvidos' }
              ].map((filter) => {
                const isActive = viewFilter === filter.key;
                return (
                  <button
                    key={filter.key}
                    onClick={() => setViewFilter(filter.key as 'active' | 'all')}
                    className={`flex items-center px-4 py-2 rounded-md transition-all duration-200 ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 hover:bg-blue-100 dark:hover:bg-blue-800/50'
                    }`}
                    title={filter.description}
                  >
                    <span className="font-medium">{filter.label}</span>
                    <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                      isActive
                        ? 'bg-blue-500 text-white'
                        : 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200'
                    }`}>
                      {filter.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

        </div>
      </div>

      {/* Content */}
      <div className="flex-1">
        <div className="max-w-6xl mx-auto p-6">
          {/* Render different views based on currentView */}
          {currentView === 'dashboard' && (
            <IncidentManagementDashboard />
          )}

          {currentView === 'list' && (
            <div className="space-y-4">

              {/* Filters Panel */}
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {viewFilter === 'active' ? 'Incidentes Ativos' : 'Todos os Incidentes'}
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    {viewFilter === 'active' && 'Incidentes que requerem atenção'}
                    {viewFilter === 'all' && 'Incluindo histórico completo e incidentes resolvidos'}
                  </span>
                </h2>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Filtros
                  </button>
                </div>
              </div>

              {showFilters && (
                <AdvancedFiltersPanel
                  filters={filters}
                  onFiltersChange={setFilters}
                  onExport={(filters) => console.log('Export with filters:', filters)}
                />
              )}

              {/* Incident Queue with Integrated Filter */}
              <IncidentQueue
                filters={{...filters, viewMode: viewFilter}} // Pass view filter to queue
                onIncidentSelect={(incident) => {
                  setSelectedIncident(incident);
                  setShowIncidentDetail(true);
                }}
                onBulkAction={(action, incidents) => {
                  console.log('Bulk action:', action, incidents);
                }}
                showKnowledgeColumns={false}
                showActiveOnly={viewFilter === 'active'}
              />
            </div>
          )}

        </div>
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6">
        <button
          className="bg-red-600 hover:bg-red-700 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          title="Reportar Novo Incidente"
          onClick={() => setIsCreateIncidentModalOpen(true)}
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        open={isBulkUploadModalOpen}
        onOpenChange={setIsBulkUploadModalOpen}
      />

      {/* Create Incident Modal */}
      <CreateIncidentModal
        isOpen={isCreateIncidentModalOpen}
        onClose={() => setIsCreateIncidentModalOpen(false)}
        onSubmit={handleCreateIncident}
        onError={handleCreateIncidentError}
        loading={isCreatingIncident}
      />

      {/* Incident Detail View */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {selectedIncident.title}
                </h2>
                <button
                  onClick={() => {
                    setShowIncidentDetail(false);
                    setSelectedIncident(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Fechar</span>
                  ×
                </button>
              </div>
              <div className="space-y-4">
                <div className="flex space-x-2">
                  {selectedIncident.priority && (
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(selectedIncident.priority)}`}>
                      {getPriorityLabel(selectedIncident.priority)}
                    </span>
                  )}
                  {selectedIncident.status && (
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(selectedIncident.status)}`}>
                      {selectedIncident.status === 'aberto' ? 'Aberto' :
                       selectedIncident.status === 'em_tratamento' ? 'Em Tratamento' :
                       selectedIncident.status === 'resolvido' ? 'Resolvido' :
                       selectedIncident.status === 'fechado' ? 'Fechado' : selectedIncident.status}
                    </span>
                  )}
                </div>
                <div className="text-gray-700 dark:text-gray-300">
                  {selectedIncident.content}
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => {
                      setShowIncidentDetail(false);
                      setSelectedIncident(null);
                    }}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Incidents;