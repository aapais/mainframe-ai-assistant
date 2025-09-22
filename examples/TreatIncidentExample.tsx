/**
 * Exemplo de uso da funcionalidade "Tratar Incidente"
 * Demonstra como a modal de edição permite iniciar o tratamento de incidentes
 */

import React, { useState } from 'react';
import { EditIncidentModal } from '../src/renderer/components/incident/EditIncidentModal';

// Exemplo de dados de incidente
const sampleIncident = {
  id: 'INC-20240115-001',
  title: 'Sistema CICS de Produção Indisponível',
  description: 'O sistema CICS principal está fora do ar desde às 14:00. Usuários não conseguem acessar as aplicações online. Mensagens de erro S0C4 aparecem nos logs.',
  impact: 'crítica' as const,
  category: 'Sistema Indisponível',
  priority: 'P1' as const,
  status: 'aberto' as const,
  affected_system: 'CICS PROD - Região CICSPROD',
  assigned_to: 'João Silva',
  reported_by: 'Maria Santos - Operações',
  incident_date: '2024-01-15',
  tags: ['cics-crash', 'produção', 's0c4', 'sistema-crítico'],
  created_at: new Date('2024-01-15T14:00:00'),
  updated_at: new Date('2024-01-15T14:30:00'),
  resolution_notes: '',
  escalation_level: 1,
  business_impact_rating: 5,
  sla_deadline: new Date('2024-01-15T15:00:00'), // SLA de 1 hora para P1
  estimated_resolution: new Date('2024-01-15T16:00:00')
};

// Exemplo de incidente que não pode ser tratado (já fechado)
const closedIncident = {
  ...sampleIncident,
  id: 'INC-20240114-005',
  title: 'Erro de Impressão no Sistema de Relatórios',
  status: 'fechado' as const,
  priority: 'P3' as const,
  resolution_notes: 'Problema resolvido. Driver de impressora foi atualizado.',
  updated_at: new Date('2024-01-14T16:45:00')
};

export const TreatIncidentExample: React.FC = () => {
  const [selectedIncident, setSelectedIncident] = useState(sampleIncident);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  // Simula o handler de submissão
  const handleSubmit = async (id: string, changes: any, auditInfo: any) => {
    console.log('=== TRATAMENTO DE INCIDENTE ===');
    console.log('ID do Incidente:', id);
    console.log('Alterações:', changes);
    console.log('Informações de Auditoria:', auditInfo);

    // Simula delay de API
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Simula sucesso
    if (Math.random() > 0.1) { // 90% chance de sucesso
      setMessage(`Incidente ${id} foi atualizado com sucesso. Status alterado para: ${changes.status}`);
      setMessageType('success');

      // Atualiza o incidente localmente para refletir as mudanças
      setSelectedIncident(prev => ({
        ...prev,
        ...changes,
        updated_at: new Date()
      }));
    } else {
      throw new Error('Erro simulado na atualização do incidente');
    }
  };

  // Handler de erro
  const handleError = (error: Error) => {
    console.error('Erro no tratamento:', error);
    setMessage(`Erro ao tratar incidente: ${error.message}`);
    setMessageType('error');
  };

  const openModalWithIncident = (incident: typeof sampleIncident) => {
    setSelectedIncident(incident);
    setIsModalOpen(true);
    setMessage(null);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Exemplo: Funcionalidade "Tratar Incidente"
      </h1>

      <div className="space-y-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-blue-900 mb-2">Como funciona:</h2>
          <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
            <li>A funcionalidade aparece apenas para incidentes que podem ser tratados (não fechados/resolvidos)</li>
            <li>Clique em "Mostrar" para expandir a seção de tratamento</li>
            <li>Preencha os campos obrigatórios: Análise do Problema, Ações Tomadas e Próximos Passos</li>
            <li>Opcionalmente, adicione observações no campo "Observações do Tratamento"</li>
            <li>Clique em "Iniciar Tratamento" para salvar e alterar o status para "Em Tratamento"</li>
            <li>O sistema registra automaticamente quando o tratamento foi iniciado</li>
          </ol>
        </div>

        {/* Mensagem de feedback */}
        {message && (
          <div className={`border rounded-lg p-4 ${
            messageType === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <p className="text-sm">{message}</p>
          </div>
        )}
      </div>

      {/* Lista de incidentes de exemplo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Incidente que pode ser tratado */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-gray-500">#{sampleIncident.id}</span>
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                sampleIncident.priority === 'P1' ? 'bg-red-100 text-red-800' :
                sampleIncident.priority === 'P2' ? 'bg-orange-100 text-orange-800' :
                sampleIncident.priority === 'P3' ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              }`}>
                {sampleIncident.priority}
              </span>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                sampleIncident.status === 'aberto' ? 'bg-red-100 text-red-800' :
                sampleIncident.status === 'em_tratamento' ? 'bg-blue-100 text-blue-800' :
                sampleIncident.status === 'resolvido' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {sampleIncident.status.replace('_', ' ')}
              </span>
            </div>
          </div>
          <h3 className="font-medium text-gray-900 mb-2">{sampleIncident.title}</h3>
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{sampleIncident.description}</p>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">Sistema: {sampleIncident.affected_system}</span>
            <button
              onClick={() => openModalWithIncident(sampleIncident)}
              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Editar / Tratar
            </button>
          </div>
          <div className="mt-2 text-xs text-green-600 font-medium">
            ✓ Pode ser tratado
          </div>
        </div>

        {/* Incidente que não pode ser tratado */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm opacity-75">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-gray-500">#{closedIncident.id}</span>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                {closedIncident.priority}
              </span>
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                {closedIncident.status}
              </span>
            </div>
          </div>
          <h3 className="font-medium text-gray-900 mb-2">{closedIncident.title}</h3>
          <p className="text-sm text-gray-600 mb-3">{closedIncident.resolution_notes}</p>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">Sistema: {closedIncident.affected_system}</span>
            <button
              onClick={() => openModalWithIncident(closedIncident)}
              className="px-3 py-1.5 text-xs font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700"
            >
              Visualizar
            </button>
          </div>
          <div className="mt-2 text-xs text-gray-500 font-medium">
            ✗ Não pode ser tratado (fechado)
          </div>
        </div>
      </div>

      {/* Exemplos de campos de tratamento */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-3">Exemplo de Preenchimento dos Campos de Tratamento:</h3>
        <div className="space-y-3 text-sm">
          <div>
            <strong className="text-gray-700">Análise do Problema:</strong>
            <p className="text-gray-600 mt-1">
              "Sistema CICS apresentou falha S0C4 (Storage Protection Exception) na região CICSPROD às 14:00.
              Análise inicial dos logs indica possível corrupção de memória ou problema em programa COBOL específico.
              Impacto crítico afetando 200+ usuários online."
            </p>
          </div>
          <div>
            <strong className="text-gray-700">Ações Tomadas:</strong>
            <p className="text-gray-600 mt-1">
              "1. Análise dos logs CICS e JES2 para identificar causa raiz
              2. Verificação do programa que causou ABEND S0C4
              3. Coordenação com equipe de desenvolvimento para correção
              4. Preparação para restart da região CICS"
            </p>
          </div>
          <div>
            <strong className="text-gray-700">Próximos Passos:</strong>
            <p className="text-gray-600 mt-1">
              "1. Aplicar correção no programa COBOL identificado
              2. Executar restart controlado da região CICS
              3. Verificar funcionamento com usuários de teste
              4. Monitorar sistema por 2 horas pós-correção
              5. Comunicar resolução para usuários afetados"
            </p>
          </div>
        </div>
      </div>

      {/* Modal de edição */}
      <EditIncidentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        onError={handleError}
        incident={selectedIncident}
        loading={false}
      />
    </div>
  );
};

export default TreatIncidentExample;