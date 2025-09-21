/**
 * IncidentDetailView Example Usage
 * Demonstrates how to integrate and use the IncidentDetailView component
 */

import React, { useState } from 'react';
import { IncidentKBEntry } from '../../../types/incident';
import IncidentDetailView from './IncidentDetailView';
import { Button } from '../ui';

// Mock incident data for demonstration
const mockIncident: IncidentKBEntry = {
  id: 'inc-001',
  title: 'Sistema de Login Fora do Ar',
  problem: 'Usuários relatam que não conseguem fazer login no sistema principal. O erro apresentado é "Conexão com o servidor falhou". O problema começou às 14:30 e afeta aproximadamente 300 usuários ativos.\n\nPassos para reproduzir:\n1. Acessar a tela de login\n2. Inserir credenciais válidas\n3. Clicar em "Entrar"\n4. Erro é exibido\n\nAmbiente: Produção\nNavegadores afetados: Chrome, Firefox, Safari\nSistemas operacionais: Windows, macOS, iOS, Android',
  solution: 'Reinicializado o serviço de autenticação no servidor principal. Verificado que o banco de dados estava sobrecarregado devido a consultas não otimizadas. Aplicado patch de otimização e aumentado pool de conexões.',
  category: 'Infraestrutura',
  tags: ['login', 'autenticação', 'servidor', 'produção', 'crítico'],
  priority: 'P1',
  status: 'em_tratamento',
  assigned_to: 'suporte.ti@empresa.com',
  escalation_level: 'none',
  resolution_time: undefined,
  sla_deadline: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
  last_status_change: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
  affected_systems: ['Sistema Principal', 'API Gateway', 'Load Balancer'],
  business_impact: 'high',
  customer_impact: true,
  reporter: 'usuario.final@empresa.com',
  resolver: undefined,
  incident_number: 'INC-2024-001',
  external_ticket_id: undefined,
  created_at: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
  updated_at: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
  created_by: 'sistema.automatico@empresa.com'
};

const IncidentDetailViewExample: React.FC = () => {
  const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);
  const [currentIncident, setCurrentIncident] = useState<IncidentKBEntry>(mockIncident);

  const handleIncidentUpdate = (updatedIncident: IncidentKBEntry) => {
    setCurrentIncident(updatedIncident);
    console.log('Incident updated:', updatedIncident);
  };

  const handleOpenDetailView = () => {
    setIsDetailViewOpen(true);
  };

  const handleCloseDetailView = () => {
    setIsDetailViewOpen(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Exemplo de Uso - IncidentDetailView
        </h1>

        <p className="text-gray-600 mb-6">
          Este exemplo demonstra como usar o componente IncidentDetailView com dados de teste.
          Clique no botão abaixo para abrir a visualização detalhada do incidente.
        </p>

        {/* Incident Summary Card */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold text-gray-900">{currentIncident.title}</h3>
              <p className="text-sm text-gray-600">{currentIncident.incident_number}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 text-xs rounded-full text-white ${
                currentIncident.priority === 'P1' ? 'bg-red-500' :
                currentIncident.priority === 'P2' ? 'bg-orange-500' :
                currentIncident.priority === 'P3' ? 'bg-yellow-500' :
                'bg-green-500'
              }`}>
                {currentIncident.priority}
              </span>
              <span className={`px-2 py-1 text-xs rounded-full text-white ${
                currentIncident.status === 'aberto' ? 'bg-gray-500' :
                currentIncident.status === 'em_tratamento' ? 'bg-blue-500' :
                currentIncident.status === 'resolvido' ? 'bg-green-500' :
                'bg-gray-600'
              }`}>
                {currentIncident.status === 'aberto' ? 'Aberto' :
                 currentIncident.status === 'em_tratamento' ? 'Em Tratamento' :
                 currentIncident.status === 'resolvido' ? 'Resolvido' :
                 currentIncident.status}
              </span>
            </div>
          </div>

          <p className="text-sm text-gray-700 mb-3">
            {currentIncident.problem.length > 150
              ? `${currentIncident.problem.substring(0, 150)}...`
              : currentIncident.problem
            }
          </p>

          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>Criado: {currentIncident.created_at.toLocaleString('pt-BR')}</span>
            {currentIncident.assigned_to && (
              <span>Responsável: {currentIncident.assigned_to}</span>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-center">
          <Button
            onClick={handleOpenDetailView}
            size="lg"
            className="px-8 py-3"
          >
            Abrir Visualização Detalhada
          </Button>
        </div>

        {/* Features List */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Funcionalidades Incluídas:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>✅ Visualização completa de informações do incidente</li>
              <li>✅ Timeline de mudanças de status</li>
              <li>✅ Sistema de comentários (interno/externo)</li>
              <li>✅ Incidentes relacionados via IA</li>
              <li>✅ Seção de anexos e logs</li>
              <li>✅ Botões de ação (Editar, Atribuir, Escalar, Fechar)</li>
              <li>✅ Visualização do fluxo de status</li>
              <li>✅ Log de atividades do usuário</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Recursos Adicionais:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>✅ Acompanhamento de SLA</li>
              <li>✅ Análise de impacto</li>
              <li>✅ Design responsivo para mobile</li>
              <li>✅ Atualizações em tempo real</li>
              <li>✅ Labels em português</li>
              <li>✅ Integração com handlers IPC</li>
              <li>✅ Detalhes de resolução</li>
              <li>✅ Ações rápidas na barra lateral</li>
            </ul>
          </div>
        </div>

        {/* Integration Notes */}
        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-semibold text-blue-900 mb-2">📝 Notas de Integração:</h4>
          <div className="text-sm text-blue-800 space-y-1">
            <p><strong>Props necessárias:</strong> incident, isOpen, onClose</p>
            <p><strong>Props opcionais:</strong> onIncidentUpdate</p>
            <p><strong>Dependências:</strong> UI components (Modal, Button, Input, etc.)</p>
            <p><strong>IPC Handlers:</strong> incident:get, incident:updateStatus, incident:assign, etc.</p>
            <p><strong>Real-time:</strong> Atualiza automaticamente a cada 30 segundos</p>
          </div>
        </div>
      </div>

      {/* IncidentDetailView Component */}
      <IncidentDetailView
        incident={currentIncident}
        isOpen={isDetailViewOpen}
        onClose={handleCloseDetailView}
        onIncidentUpdate={handleIncidentUpdate}
      />
    </div>
  );
};

export default IncidentDetailViewExample;