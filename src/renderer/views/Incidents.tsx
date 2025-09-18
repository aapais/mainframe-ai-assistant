import React, { useState, useCallback, useEffect } from 'react';
import { AlertTriangle, Database, Brain, Clock, FileText, Settings, Users, Tag, Plus, Upload } from 'lucide-react';
import LocalSearchTab from '../components/search/LocalSearchTab';
import AISearchTab from '../components/search/AISearchTab';
import BulkUploadModal from '../components/incident/BulkUploadModal';
import { searchService } from '../services/searchService';

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
  const [activeTab, setActiveTab] = useState<'local' | 'ai'>('local');
  const [searchQuery, setSearchQuery] = useState('');
  const [localResults, setLocalResults] = useState<IncidentResult[]>([]);
  const [aiResults, setAIResults] = useState<IncidentResult[]>([]);
  const [isLocalSearching, setIsLocalSearching] = useState(false);
  const [isAISearching, setIsAISearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);

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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'ai') {
      performAISearch(searchQuery);
    }
  };

  const getTabIcon = (tab: 'local' | 'ai') => {
    return tab === 'local' ? Database : Brain;
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
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
        <div className="max-w-4xl mx-auto">
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

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="mb-6">
            <div className="relative">
              <AlertTriangle className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeTab === 'local' ? "Pesquisar incidentes, soluções, padrões..." : "Perguntar à IA para analisar incidentes e encontrar soluções..."}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full"></div>
                </div>
              )}
            </div>
          </form>

          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
            {(['local', 'ai'] as const).map((tab) => {
              const Icon = getTabIcon(tab);
              const isActive = activeTab === tab;

              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center px-4 py-2 rounded-md transition-all duration-200 ${
                    isActive
                      ? 'bg-white dark:bg-gray-600 text-red-600 dark:text-red-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {tab === 'local' ? 'Busca Local' : 'Análise com IA'}
                  {currentResults.length > 0 && (
                    <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                      isActive
                        ? 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400'
                        : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                    }`}>
                      {currentResults.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-4xl mx-auto p-6 h-full">
          {/* Results Grid */}
          <div className="space-y-4">
            {isSearching ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                <p className="mt-2 text-gray-600">Pesquisando incidentes...</p>
              </div>
            ) : currentResults.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                {searchQuery ? (
                  <>Nenhum incidente encontrado para "{searchQuery}". Tente palavras-chave diferentes ou reporte um novo incidente.</>
                ) : (
                  <>Digite para pesquisar incidentes, ou clique no botão + para adicionar um novo.</>
                )}
              </div>
            ) : (
              currentResults.map((result) => {
                const Icon = getResultTypeIcon(result.type);
                return (
                  <div
                    key={result.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 border-l-4 border-red-500"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <Icon className="w-5 h-5 text-red-600" />
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {result.title}
                        </h3>
                      </div>
                      <div className="flex space-x-2">
                        {result.priority && (
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(result.priority)}`}>
                            {getPriorityLabel(result.priority)}
                          </span>
                        )}
                        {result.status && (
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(result.status)}`}>
                            {result.status === 'aberto' ? 'Aberto' :
                             result.status === 'em_tratamento' ? 'Em Tratamento' :
                             result.status === 'resolvido' ? 'Resolvido' :
                             result.status === 'fechado' ? 'Fechado' : result.status}
                          </span>
                        )}
                        {result.impact && (
                          <span className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-full">
                            Impacto {result.impact === 'crítica' ? 'Crítico' : result.impact === 'alta' ? 'Alto' : result.impact === 'média' ? 'Médio' : 'Baixo'}
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-gray-700 dark:text-gray-300 mb-3 line-clamp-2">
                      {result.content}
                    </p>

                    {result.highlights && result.highlights.length > 0 && (
                      <div className="mb-3">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1">Destaques Principais:</h4>
                        <div className="flex flex-wrap gap-1">
                          {result.highlights.slice(0, 3).map((highlight, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded"
                            >
                              {highlight}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <div className="flex items-center space-x-4">
                        <span className="capitalize">{result.type}</span>
                        {result.lastModified && (
                          <span>Atualizado em {result.lastModified.toLocaleDateString('pt-BR')}</span>
                        )}
                      </div>
                      {result.relevanceScore && (
                        <span className="text-green-600">
                          {Math.round(result.relevanceScore * 100)}% de correspondência
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6">
        <button
          className="bg-red-600 hover:bg-red-700 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          title="Reportar Novo Incidente"
          onClick={() => {
            // This would trigger the report incident modal
            console.log('Report new incident');
          }}
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        open={isBulkUploadModalOpen}
        onOpenChange={setIsBulkUploadModalOpen}
      />
    </div>
  );
};

export default Incidents;