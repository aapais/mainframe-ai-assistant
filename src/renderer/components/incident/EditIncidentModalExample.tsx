import React, { useState, useCallback } from 'react';
import { Edit, Eye, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import EditIncidentModal from './EditIncidentModal';

// Example usage component for EditIncidentModal
export const EditIncidentModalExample: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Mock incident data - in real app this would come from your incident service
  const mockIncident = {
    id: 'INC-2025-123456',
    title: 'DB2 SQL0904 - Recurso Indisponível em CICS Produção',
    description: 'Sistema CICS apresentando erro SQL0904 ao tentar acessar tabela CUSTOMER. Erro ocorre intermitentemente durante picos de transação. Usuários reportam timeout em transações de consulta.',
    impact: 'alta' as const,
    category: 'Base de Dados',
    priority: 'P2' as const,
    status: 'em_tratamento' as const,
    affected_system: 'CICS Produção DB2',
    assigned_to: 'João Silva',
    reported_by: 'Maria Santos',
    incident_date: '2025-01-15',
    tags: ['db2-error', 'sql0904', 'cics', 'timeout', 'produção'],
    created_at: new Date('2025-01-15T09:30:00'),
    updated_at: new Date('2025-01-15T14:22:00'),
    resolution_notes: '',
    escalation_level: 1,
    business_impact_rating: 7
  };

  // Handle incident update submission
  const handleUpdateIncident = useCallback(async (
    incidentId: string,
    changes: any,
    auditInfo: any
  ) => {
    setLoading(true);
    setMessage(null);

    try {
      // Call the IPC handler to update the incident
      const result = await window.electron.ipc.invoke('incident:update', {
        incidentId,
        changes,
        auditInfo
      });

      if (result.success) {
        setMessage({
          type: 'success',
          text: `Incidente ${incidentId} atualizado com sucesso! ${auditInfo.criticalChange ? 'Alterações críticas registradas para aprovação.' : ''}`
        });

        // In a real app, you would refresh the incident data or update your state
        console.log('Incident updated successfully:', {
          incidentId,
          changes,
          auditId: result.auditId,
          auditInfo
        });
      }
    } catch (error) {
      console.error('Failed to update incident:', error);
      setMessage({
        type: 'error',
        text: `Erro ao atualizar incidente: ${error.message}`
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle errors from the modal
  const handleError = useCallback((error: Error) => {
    setMessage({
      type: 'error',
      text: `Erro na validação: ${error.message}`
    });
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Exemplo de Edição de Incidente
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Demonstração do componente EditIncidentModal com dados de exemplo
          </p>
        </div>

        <div className="p-6">
          {/* Message Display */}
          {message && (
            <div className={`mb-6 p-4 rounded-md flex items-center space-x-2 ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              <span className={`text-sm ${
                message.type === 'success' ? 'text-green-800' : 'text-red-800'
              }`}>
                {message.text}
              </span>
            </div>
          )}

          {/* Mock Incident Card */}
          <div className="border rounded-lg p-4 mb-6 bg-gray-50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${
                  mockIncident.status === 'aberto' ? 'bg-red-100' :
                  mockIncident.status === 'em_tratamento' ? 'bg-blue-100' :
                  mockIncident.status === 'resolvido' ? 'bg-green-100' :
                  'bg-gray-100'
                }`}>
                  <AlertCircle className={`h-5 w-5 ${
                    mockIncident.status === 'aberto' ? 'text-red-600' :
                    mockIncident.status === 'em_tratamento' ? 'text-blue-600' :
                    mockIncident.status === 'resolvido' ? 'text-green-600' :
                    'text-gray-600'
                  }`} />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    {mockIncident.title}
                  </h3>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span>#{mockIncident.id}</span>
                    <span>{mockIncident.priority}</span>
                    <span className="capitalize">{mockIncident.status.replace('_', ' ')}</span>
                    <span>{mockIncident.category}</span>
                  </div>
                </div>
              </div>
              <div className="text-right text-sm text-gray-500">
                <div>Criado: {mockIncident.created_at.toLocaleDateString('pt-BR')}</div>
                <div>Atualizado: {mockIncident.updated_at.toLocaleDateString('pt-BR')}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Sistema Afetado:</span>
                <span className="ml-2 text-gray-600">{mockIncident.affected_system}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Responsável:</span>
                <span className="ml-2 text-gray-600">{mockIncident.assigned_to}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Reportado por:</span>
                <span className="ml-2 text-gray-600">{mockIncident.reported_by}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Impacto:</span>
                <span className="ml-2 text-gray-600 capitalize">{mockIncident.impact}</span>
              </div>
            </div>

            {mockIncident.tags.length > 0 && (
              <div className="mt-3">
                <span className="font-medium text-gray-700 text-sm">Tags:</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {mockIncident.tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-gray-200">
              <span className="font-medium text-gray-700 text-sm">Descrição:</span>
              <p className="mt-1 text-sm text-gray-600">
                {mockIncident.description}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={() => setIsModalOpen(true)}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <Edit className="h-4 w-4 mr-2" />
              Editar Incidente
            </button>

            <button
              onClick={() => {
                console.log('View incident details:', mockIncident);
                setMessage({
                  type: 'success',
                  text: 'Detalhes do incidente exibidos no console'
                });
              }}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Eye className="h-4 w-4 mr-2" />
              Ver Detalhes
            </button>

            <button
              onClick={() => {
                setMessage(null);
              }}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Limpar Mensagens
            </button>
          </div>

          {/* Usage Instructions */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-2">
              Instruções de Uso
            </h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Clique em "Editar Incidente" para abrir o modal de edição</li>
              <li>• Modifique os campos necessários (campos alterados serão destacados)</li>
              <li>• Use a IA para sugestões de recategorização</li>
              <li>• Alterações críticas (status, prioridade, responsável) requerem confirmação</li>
              <li>• Forneça um motivo para alterações críticas</li>
              <li>• O sistema mantém um histórico completo de auditoria</li>
            </ul>
          </div>

          {/* Technical Features */}
          <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">
              Características Técnicas
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-700">
              <div>
                <strong>Validação:</strong>
                <ul className="mt-1 space-y-1">
                  <li>• Transições de status válidas</li>
                  <li>• Campos obrigatórios</li>
                  <li>• Limites de caracteres</li>
                  <li>• Formato de dados</li>
                </ul>
              </div>
              <div>
                <strong>Auditoria:</strong>
                <ul className="mt-1 space-y-1">
                  <li>• Rastro completo de alterações</li>
                  <li>• Valores anteriores e novos</li>
                  <li>• Motivo das mudanças</li>
                  <li>• Timestamp e responsável</li>
                </ul>
              </div>
              <div>
                <strong>IA:</strong>
                <ul className="mt-1 space-y-1">
                  <li>• Sugestões de categorização</li>
                  <li>• Análise de prioridade</li>
                  <li>• Tags automáticas</li>
                  <li>• Detecção de padrões</li>
                </ul>
              </div>
              <div>
                <strong>UX:</strong>
                <ul className="mt-1 space-y-1">
                  <li>• Indicadores visuais de mudanças</li>
                  <li>• Confirmação para ações críticas</li>
                  <li>• Feedback em tempo real</li>
                  <li>• Interface responsiva</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Incident Modal */}
      <EditIncidentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleUpdateIncident}
        onError={handleError}
        loading={loading}
        incident={mockIncident}
      />
    </div>
  );
};

export default EditIncidentModalExample;