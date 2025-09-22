/**
 * Testes para a funcionalidade "Tratar Incidente" no EditIncidentModal
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditIncidentModal } from '../../../../src/renderer/components/incident/EditIncidentModal';

// Mock data for testing
const mockIncident = {
  id: 'INC-001',
  title: 'Sistema de Produção Indisponível',
  description: 'O sistema principal está fora do ar desde às 14:00',
  impact: 'crítica' as const,
  category: 'Sistema Indisponível',
  priority: 'P1' as const,
  status: 'aberto' as const,
  affected_system: 'CICS Produção',
  assigned_to: 'João Silva',
  reported_by: 'Maria Santos',
  incident_date: '2024-01-15',
  tags: ['cics-crash', 'produção'],
  created_at: new Date('2024-01-15T14:00:00'),
  updated_at: new Date('2024-01-15T14:30:00'),
  resolution_notes: '',
  escalation_level: 1,
  business_impact_rating: 5
};

const mockProps = {
  isOpen: true,
  onClose: jest.fn(),
  onSubmit: jest.fn(),
  onError: jest.fn(),
  loading: false,
  incident: mockIncident
};

describe('EditIncidentModal - Tratamento de Incidente', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve mostrar a seção de tratamento quando o incidente pode ser tratado', () => {
    render(<EditIncidentModal {...mockProps} />);

    // Verifica se a seção de tratamento está presente
    expect(screen.getByText('Tratar Incidente')).toBeInTheDocument();
    expect(screen.getByText('Inicie o tratamento deste incidente preenchendo as informações abaixo')).toBeInTheDocument();
  });

  it('deve expandir/ocultar a seção de tratamento ao clicar no botão', async () => {
    const user = userEvent.setup();
    render(<EditIncidentModal {...mockProps} />);

    const toggleButton = screen.getByRole('button', { name: /mostrar/i });

    // Inicialmente os campos de tratamento não devem estar visíveis
    expect(screen.queryByLabelText(/análise do problema/i)).not.toBeInTheDocument();

    // Clica para mostrar a seção
    await user.click(toggleButton);

    // Agora os campos devem estar visíveis
    expect(screen.getByLabelText(/análise do problema/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ações tomadas/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/próximos passos/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/observações do tratamento/i)).toBeInTheDocument();
  });

  it('deve não mostrar seção de tratamento para incidentes fechados', () => {
    const closedIncident = { ...mockIncident, status: 'fechado' as const };
    render(<EditIncidentModal {...mockProps} incident={closedIncident} />);

    // Deve mostrar mensagem de incidente fechado
    expect(screen.getByText('Incidente Fechado')).toBeInTheDocument();
    expect(screen.getByText('Este incidente não pode ser tratado pois já está fechado.')).toBeInTheDocument();

    // Não deve mostrar seção de tratamento
    expect(screen.queryByText('Tratar Incidente')).not.toBeInTheDocument();
  });

  it('deve não mostrar seção de tratamento para incidentes resolvidos', () => {
    const resolvedIncident = { ...mockIncident, status: 'resolvido' as const };
    render(<EditIncidentModal {...mockProps} incident={resolvedIncident} />);

    // Deve mostrar mensagem de incidente resolvido
    expect(screen.getByText('Incidente Resolvido')).toBeInTheDocument();
    expect(screen.getByText('Este incidente não pode ser tratado pois já está resolvido.')).toBeInTheDocument();
  });

  it('deve validar campos obrigatórios no tratamento', async () => {
    const user = userEvent.setup();
    render(<EditIncidentModal {...mockProps} />);

    // Expande a seção de tratamento
    await user.click(screen.getByRole('button', { name: /mostrar/i }));

    // Tenta iniciar tratamento sem preencher campos obrigatórios
    const treatButton = screen.getByRole('button', { name: /iniciar tratamento/i });
    expect(treatButton).toBeDisabled();

    // Preenche apenas um campo
    const analysisField = screen.getByLabelText(/análise do problema/i);
    await user.type(analysisField, 'Análise inicial do problema');

    // Botão ainda deve estar desabilitado
    expect(treatButton).toBeDisabled();

    // Preenche todos os campos obrigatórios
    await user.type(screen.getByLabelText(/ações tomadas/i), 'Verificação dos logs do sistema');
    await user.type(screen.getByLabelText(/próximos passos/i), 'Reiniciar serviços afetados');

    // Agora o botão deve estar habilitado
    expect(treatButton).toBeEnabled();
  });

  it('deve chamar onSubmit com dados de tratamento corretos', async () => {
    const user = userEvent.setup();
    const mockOnSubmit = jest.fn().mockResolvedValue(undefined);

    render(<EditIncidentModal {...mockProps} onSubmit={mockOnSubmit} />);

    // Expande a seção de tratamento
    await user.click(screen.getByRole('button', { name: /mostrar/i }));

    // Preenche os campos de tratamento
    await user.type(screen.getByLabelText(/análise do problema/i), 'Sistema CICS apresentou falha crítica nos componentes principais');
    await user.type(screen.getByLabelText(/ações tomadas/i), 'Verificação dos logs, identificação da causa raiz, preparação para restart');
    await user.type(screen.getByLabelText(/próximos passos/i), 'Executar restart controlado do CICS durante janela de manutenção');
    await user.type(screen.getByLabelText(/observações do tratamento/i), 'Coordenar com equipe de operações');

    // Clica em "Iniciar Tratamento"
    await user.click(screen.getByRole('button', { name: /iniciar tratamento/i }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        'INC-001',
        expect.objectContaining({
          status: 'em_tratamento',
          treatment_analysis: 'Sistema CICS apresentou falha crítica nos componentes principais',
          actions_taken: 'Verificação dos logs, identificação da causa raiz, preparação para restart',
          next_steps: 'Executar restart controlado do CICS durante janela de manutenção',
          treatment_notes: 'Coordenar com equipe de operações',
          treatment_started_at: expect.any(Date)
        }),
        expect.objectContaining({
          changedFields: expect.arrayContaining(['status', 'treatment_started_at', 'treatment_analysis', 'actions_taken', 'next_steps']),
          changeReason: 'Início do tratamento do incidente',
          criticalChange: true
        })
      );
    });
  });

  it('deve atualizar status para "em_tratamento" ao iniciar tratamento', async () => {
    const user = userEvent.setup();
    const mockOnSubmit = jest.fn().mockResolvedValue(undefined);

    render(<EditIncidentModal {...mockProps} onSubmit={mockOnSubmit} />);

    // Expande a seção de tratamento
    await user.click(screen.getByRole('button', { name: /mostrar/i }));

    // Preenche os campos mínimos
    await user.type(screen.getByLabelText(/análise do problema/i), 'Análise inicial do problema identificado');
    await user.type(screen.getByLabelText(/ações tomadas/i), 'Ações executadas para resolução');
    await user.type(screen.getByLabelText(/próximos passos/i), 'Próximas ações planejadas');

    // Inicia tratamento
    await user.click(screen.getByRole('button', { name: /iniciar tratamento/i }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        'INC-001',
        expect.objectContaining({
          status: 'em_tratamento'
        }),
        expect.any(Object)
      );
    });
  });

  it('deve mostrar indicadores de alteração nos campos de tratamento', async () => {
    const user = userEvent.setup();
    render(<EditIncidentModal {...mockProps} />);

    // Expande a seção de tratamento
    await user.click(screen.getByRole('button', { name: /mostrar/i }));

    // Preenche um campo
    await user.type(screen.getByLabelText(/análise do problema/i), 'Nova análise');

    // Deve mostrar indicador de alteração
    expect(screen.getByText('Alterado')).toBeInTheDocument();
  });

  it('deve limpar campos de tratamento ao resetar formulário', async () => {
    const user = userEvent.setup();
    render(<EditIncidentModal {...mockProps} />);

    // Expande a seção de tratamento
    await user.click(screen.getByRole('button', { name: /mostrar/i }));

    // Preenche campos
    await user.type(screen.getByLabelText(/análise do problema/i), 'Análise teste');
    await user.type(screen.getByLabelText(/ações tomadas/i), 'Ações teste');

    // Clica em reverter
    await user.click(screen.getByRole('button', { name: /reverter/i }));

    // Campos devem estar limpos
    expect(screen.getByLabelText(/análise do problema/i)).toHaveValue('');
    expect(screen.getByLabelText(/ações tomadas/i)).toHaveValue('');
  });

  it('deve fechar modal após iniciar tratamento com sucesso', async () => {
    const user = userEvent.setup();
    const mockOnClose = jest.fn();
    const mockOnSubmit = jest.fn().mockResolvedValue(undefined);

    render(<EditIncidentModal {...mockProps} onClose={mockOnClose} onSubmit={mockOnSubmit} />);

    // Expande a seção de tratamento e preenche campos
    await user.click(screen.getByRole('button', { name: /mostrar/i }));
    await user.type(screen.getByLabelText(/análise do problema/i), 'Análise inicial do problema identificado');
    await user.type(screen.getByLabelText(/ações tomadas/i), 'Ações executadas para resolução');
    await user.type(screen.getByLabelText(/próximos passos/i), 'Próximas ações planejadas');

    // Inicia tratamento
    await user.click(screen.getByRole('button', { name: /iniciar tratamento/i }));

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('deve chamar onError se tratamento falhar', async () => {
    const user = userEvent.setup();
    const mockOnError = jest.fn();
    const mockOnSubmit = jest.fn().mockRejectedValue(new Error('Erro no servidor'));

    render(<EditIncidentModal {...mockProps} onError={mockOnError} onSubmit={mockOnSubmit} />);

    // Expande a seção de tratamento e preenche campos
    await user.click(screen.getByRole('button', { name: /mostrar/i }));
    await user.type(screen.getByLabelText(/análise do problema/i), 'Análise inicial do problema identificado');
    await user.type(screen.getByLabelText(/ações tomadas/i), 'Ações executadas para resolução');
    await user.type(screen.getByLabelText(/próximos passos/i), 'Próximas ações planejadas');

    // Inicia tratamento
    await user.click(screen.getByRole('button', { name: /iniciar tratamento/i }));

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});