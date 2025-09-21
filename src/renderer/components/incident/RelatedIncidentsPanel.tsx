import React, { useState, useEffect } from 'react';
import { Incident } from '../../../types/incident';
import { RelatedIncident, relatedIncidentService } from '../../services/RelatedIncidentService';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface RelatedIncidentsPanelProps {
  currentIncident: Incident;
  allIncidents: Incident[];
  onIncidentSelect?: (incident: Incident) => void;
  className?: string;
}

export const RelatedIncidentsPanel: React.FC<RelatedIncidentsPanelProps> = ({
  currentIncident,
  allIncidents,
  onIncidentSelect,
  className = ''
}) => {
  const [relatedIncidents, setRelatedIncidents] = useState<RelatedIncident[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const searchRelated = async () => {
      setIsLoading(true);
      try {
        // Only search if we have a title or description
        if (!currentIncident.title && !currentIncident.description) {
          setRelatedIncidents([]);
          return;
        }

        const related = relatedIncidentService.searchRelatedIncidents(
          currentIncident,
          allIncidents,
          5
        );
        setRelatedIncidents(related);
      } catch (error) {
        console.error('Error searching for related incidents:', error);
        setRelatedIncidents([]);
      } finally {
        setIsLoading(false);
      }
    };

    searchRelated();
  }, [currentIncident, allIncidents]);

  const handleIncidentClick = (incident: Incident) => {
    if (onIncidentSelect) {
      onIncidentSelect(incident);
    }
  };

  const getSuccessColor = (indicator: 'high' | 'medium' | 'low') => {
    switch (indicator) {
      case 'high': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSimilarityColor = (score: number) => {
    if (score >= 0.7) return 'bg-green-100 text-green-800';
    if (score >= 0.4) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  if (isLoading) {
    return (
      <div className={`related-incidents-panel ${className}`}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-900">Incidentes Relacionados</h3>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (relatedIncidents.length === 0) {
    return (
      <div className={`related-incidents-panel ${className}`}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-900">Incidentes Relacionados</h3>
          <Badge variant="outline" className="text-xs">
            Nenhum encontrado
          </Badge>
        </div>
      </div>
    );
  }

  return (
    <div className={`related-incidents-panel bg-white border border-gray-200 rounded-lg ${className}`}>
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-900">Incidentes Relacionados</h3>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-xs">
            {relatedIncidents.length} encontrado{relatedIncidents.length !== 1 ? 's' : ''}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 h-6 w-6"
          >
            <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-3">
          {relatedIncidents.map((relatedItem, index) => {
            const { incident, similarityScore, matchedTerms } = relatedItem;
            const resolutionTime = relatedIncidentService.calculateResolutionTime(incident);
            const successIndicator = relatedIncidentService.getSuccessIndicator(incident);

            return (
              <div
                key={incident.id}
                onClick={() => handleIncidentClick(incident)}
                className="related-incident-card p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-xs font-mono text-gray-500">#{incident.id}</span>
                      <Badge
                        className={`text-xs px-2 py-0.5 ${getSimilarityColor(similarityScore)}`}
                      >
                        {Math.round(similarityScore * 100)}% similar
                      </Badge>
                    </div>
                    <h4 className="text-sm font-medium text-gray-900 line-clamp-2">
                      {incident.title}
                    </h4>
                    {incident.description && (
                      <p className="text-xs text-gray-600 line-clamp-2 mt-1">
                        {incident.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-500">Resolvido em:</span>
                    <span className="font-medium text-gray-700">{resolutionTime}</span>
                    <Badge
                      className={`px-2 py-0.5 ${getSuccessColor(successIndicator)}`}
                    >
                      {successIndicator === 'high' ? 'Rápido' :
                       successIndicator === 'medium' ? 'Médio' : 'Lento'}
                    </Badge>
                  </div>
                  {incident.category && (
                    <Badge variant="outline" className="text-xs">
                      {incident.category}
                    </Badge>
                  )}
                </div>

                {matchedTerms.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <div className="flex flex-wrap gap-1">
                      <span className="text-xs text-gray-500">Termos em comum:</span>
                      {matchedTerms.slice(0, 5).map((term, termIndex) => (
                        <span
                          key={termIndex}
                          className="inline-block px-1.5 py-0.5 bg-blue-100 text-blue-800 text-xs rounded"
                        >
                          {term}
                        </span>
                      ))}
                      {matchedTerms.length > 5 && (
                        <span className="text-xs text-gray-500">
                          +{matchedTerms.length - 5} mais
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Compact view when collapsed */}
      {!isExpanded && (
        <div className="p-3">
          <div className="space-y-2">
            {relatedIncidents.slice(0, 2).map((relatedItem, index) => {
              const { incident, similarityScore } = relatedItem;
              const resolutionTime = relatedIncidentService.calculateResolutionTime(incident);
              const successIndicator = relatedIncidentService.getSuccessIndicator(incident);

              return (
                <div
                  key={incident.id}
                  onClick={() => handleIncidentClick(incident)}
                  className="flex items-center justify-between p-2 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-mono text-gray-500">#{incident.id}</span>
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {incident.title}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-2">
                    <Badge
                      className={`text-xs px-2 py-0.5 ${getSimilarityColor(similarityScore)}`}
                    >
                      {Math.round(similarityScore * 100)}%
                    </Badge>
                    <Badge
                      className={`text-xs px-2 py-0.5 ${getSuccessColor(successIndicator)}`}
                    >
                      {resolutionTime}
                    </Badge>
                  </div>
                </div>
              );
            })}
            {relatedIncidents.length > 2 && (
              <div className="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(true)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Ver mais {relatedIncidents.length - 2} incidente{relatedIncidents.length - 2 !== 1 ? 's' : ''}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RelatedIncidentsPanel;