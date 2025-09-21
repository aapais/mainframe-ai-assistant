import React, { useState, useEffect, useCallback, memo } from 'react';
import { Button } from '../common/Button';
import { TextField, TextAreaField, SelectField } from '../common/FormField';
import { useForm } from '../../hooks/useForm';
import { createIncidentValidationSchema, ErrorMessages } from '../../utils/validation';
import { Incident } from '../../types';
import './IncidentForm.css';

interface IncidentFormData {
  title: string;
  description: string;
  impact: string;
  category: 'System Outage' | 'Performance' | 'Database' | 'Application' | 'Security' | 'Network' | 'Hardware' | 'Other';
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  status: 'Open' | 'In Progress' | 'Pending' | 'Resolved' | 'Closed';
  assignee?: string;
  tags: string[];
}

interface IncidentFormProps {
  initialData?: Partial<IncidentFormData>;
  onSubmit: (data: IncidentFormData) => Promise<void>;
  onCancel: () => void;
  onError?: (error: Error) => void;
  mode?: 'create' | 'edit';
  autoSave?: boolean;
  enableDrafts?: boolean;
  showAdvancedOptions?: boolean;
}

const CATEGORY_OPTIONS = [
  { value: 'System Outage', label: 'Falha do Sistema - Falha completa do sistema' },
  { value: 'Performance', label: 'Problema de Performance - Performance degradada' },
  { value: 'Database', label: 'Problema de Banco de Dados - Problemas DB2, IMS, VSAM' },
  { value: 'Application', label: 'Erro de Aplicação - Falhas COBOL, CICS, batch' },
  { value: 'Security', label: 'Incidente de Segurança - RACF, controle de acesso' },
  { value: 'Network', label: 'Problema de Rede - Problemas de conectividade' },
  { value: 'Hardware', label: 'Falha de Hardware - Problemas físicos do sistema' },
  { value: 'Other', label: 'Outros/Diversos' }
];

const PRIORITY_OPTIONS = [
  { value: 'P1', label: 'P1 - Crítica (Ação imediata necessária)' },
  { value: 'P2', label: 'P2 - Alta (Atenção urgente necessária)' },
  { value: 'P3', label: 'P3 - Média (Cronograma normal)' },
  { value: 'P4', label: 'P4 - Baixa (Quando conveniente)' }
];

const STATUS_OPTIONS = [
  { value: 'aberto', label: 'Aberto - Recém-reportado' },
  { value: 'em_tratamento', label: 'Em Tratamento - Sendo trabalhado' },
  { value: 'em_revisao', label: 'Em Revisão - Aguardando entrada' },
  { value: 'resolvido', label: 'Resolvido - Problema corrigido' },
  { value: 'fechado', label: 'Fechado - Completo e verificado' }
];

const IMPACT_LEVELS = [
  { value: 'Critical', label: 'Crítico - Sistemas críticos do negócio afetados' },
  { value: 'High', label: 'Alto - Funções importantes do negócio impactadas' },
  { value: 'Medium', label: 'Médio - Algumas funções do negócio afetadas' },
  { value: 'Low', label: 'Baixo - Impacto menor nas operações' }
];

/**
 * Enhanced Incident Report Form
 *
 * Features:
 * - Priority and status management
 * - Impact assessment
 * - Advanced validation with real-time feedback
 * - Auto-save and draft functionality
 * - Accessibility support (ARIA labels, keyboard navigation)
 * - Enhanced UX (character counts, hints, tooltips)
 * - Error handling with user-friendly messages
 * - Tag management with validation
 * - Keyboard shortcuts
 */
export const IncidentForm = memo<IncidentFormProps>(({
  initialData,
  onSubmit,
  onCancel,
  onError,
  mode = 'create',
  autoSave = false,
  enableDrafts = true,
  showAdvancedOptions = false
}) => {
  // Tag input state
  const [tagInput, setTagInput] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(showAdvancedOptions);

  // Form management with advanced features
  const form = useForm<IncidentFormData>({
    initialValues: {
      title: initialData?.title || '',
      description: initialData?.description || '',
      impact: initialData?.impact || '',
      category: initialData?.category || 'Other',
      priority: initialData?.priority || 'P3',
      status: initialData?.status || 'aberto',
      assignee: initialData?.assignee || '',
      tags: initialData?.tags || []
    },
    validationSchema: createIncidentValidationSchema(mode),
    onSubmit: handleFormSubmit,
    onError: onError,
    validateOnChange: true,
    validateOnBlur: true,
    autoSave: autoSave,
    autoSaveDelay: 2000,
    enableDrafts: enableDrafts,
    draftKey: `incident-${mode}-${initialData?.id || 'new'}`
  });

  async function handleFormSubmit(data: IncidentFormData): Promise<void> {
    try {
      await onSubmit(data);
    } catch (error) {
      console.error('Incident form submission error:', error);
      throw error;
    }
  }

  // Handle draft loading notification
  useEffect(() => {
    if (form.hasDraft && enableDrafts) {
      const shouldLoadDraft = window.confirm(
        'A draft was found for this incident. Would you like to load it?'
      );

      if (shouldLoadDraft) {
        form.loadDraft();
      } else {
        form.clearDraft();
      }
    }
  }, [form.hasDraft, enableDrafts]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        switch (e.key) {
          case 's':
            e.preventDefault();
            if (form.isValid && !form.isSubmitting) {
              form.handleSubmit();
            }
            break;
          case 'Enter':
            e.preventDefault();
            if (form.isValid && !form.isSubmitting) {
              form.handleSubmit();
            }
            break;
          case 'd':
            e.preventDefault();
            if (enableDrafts) {
              form.saveDraft();
            }
            break;
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [form.isValid, form.isSubmitting, form.handleSubmit, form.saveDraft, onCancel, enableDrafts]);

  // Tag management functions
  const handleAddTag = useCallback(() => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !form.values.tags.includes(tag)) {
      const newTags = [...form.values.tags, tag];
      form.setFieldValue('tags', newTags);
      setTagInput('');
    }
  }, [tagInput, form.values.tags, form.setFieldValue]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    const newTags = form.values.tags.filter(tag => tag !== tagToRemove);
    form.setFieldValue('tags', newTags);
  }, [form.values.tags, form.setFieldValue]);

  const handleTagKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  }, [handleAddTag]);

  // Handle form reset with confirmation
  const handleReset = useCallback(() => {
    if (form.isDirty) {
      const shouldReset = window.confirm(
        'Are you sure you want to reset the form? All unsaved changes will be lost.'
      );
      if (shouldReset) {
        form.resetForm();
        setTagInput('');
      }
    } else {
      form.resetForm();
      setTagInput('');
    }
  }, [form.isDirty, form.resetForm]);

  // Auto-set priority based on category
  useEffect(() => {
    if (form.values.category === 'System Outage' && form.values.priority !== 'P1') {
      form.setFieldValue('priority', 'P1');
    } else if (form.values.category === 'Security' && !['P1', 'P2'].includes(form.values.priority)) {
      form.setFieldValue('priority', 'P2');
    }
  }, [form.values.category, form.values.priority, form.setFieldValue]);

  return (
    <form
      className="incident-form"
      onSubmit={form.handleSubmit}
      noValidate
      role="form"
      aria-label={mode === 'create' ? 'Report new incident' : 'Edit incident'}
    >
      <div className="incident-form__header">
        <div className="incident-form__title">
          <h2>🚨 {mode === 'create' ? 'Reportar Novo Incidente' : 'Editar Incidente'}</h2>
          {form.isDirty && (
            <span className="incident-form__unsaved-indicator" title="Alterações não salvas">
              ●
            </span>
          )}
          {form.isAutoSaving && (
            <span className="incident-form__auto-save-indicator">
              Salvando...
            </span>
          )}
        </div>

        {enableDrafts && (
          <div className="incident-form__draft-actions">
            <Button
              type="button"
              variant="ghost"
              size="small"
              onClick={form.saveDraft}
              disabled={!form.isDirty}
              title="Salvar rascunho (Ctrl+D)"
            >
              Salvar Rascunho
            </Button>
            {form.hasDraft && (
              <Button
                type="button"
                variant="ghost"
                size="small"
                onClick={() => form.loadDraft()}
                title="Carregar rascunho salvo"
              >
                Carregar Rascunho
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="incident-form__fields">
        {/* Title Field */}
        <TextField
          {...form.getFieldProps('title')}
          label="Título do Incidente"
          placeholder="Título breve e descritivo (ex: 'Banco de Dados DB2 de Produção Indisponível - SQLCODE -904')"
          required
          maxLength={200}
          showCharacterCount
          error={form.getFieldError('title')}
          hint="Inclua nomes de sistemas, códigos de erro ou sintomas principais para identificação rápida"
          helpText="O título deve ser específico o suficiente para que os responsáveis possam entender rapidamente a natureza e escopo do incidente."
          autoFocus={mode === 'create'}
        />

        {/* Priority and Category Row */}
        <div className="incident-form__row">
          <SelectField
            {...form.getFieldProps('priority')}
            label="Prioridade"
            options={PRIORITY_OPTIONS}
            required
            error={form.getFieldError('priority')}
            hint="Selecione baseado no impacto no negócio e urgência"
            className="incident-form__priority-field"
          />

          <SelectField
            {...form.getFieldProps('category')}
            label="Categoria"
            options={CATEGORY_OPTIONS}
            required
            error={form.getFieldError('category')}
            hint="Selecione o sistema ou componente principal envolvido"
            className="incident-form__category-field"
          />
        </div>

        {/* Status and Assignee Row */}
        <div className="incident-form__row">
          <SelectField
            {...form.getFieldProps('status')}
            label="Status"
            options={STATUS_OPTIONS}
            error={form.getFieldError('status')}
            hint="Estado atual do incidente"
            className="incident-form__status-field"
          />

          <TextField
            {...form.getFieldProps('assignee')}
            label="Atribuir Para"
            placeholder="Nome de usuário ou equipe (opcional)"
            error={form.getFieldError('assignee')}
            hint="Deixe em branco para atribuição automática"
            helpText="O incidente será automaticamente atribuído baseado na categoria e prioridade se deixado em branco"
            className="incident-form__assignee-field"
          />
        </div>

        {/* Incident Description Field */}
        <TextAreaField
          {...form.getFieldProps('description')}
          label="Descrição do Incidente"
          placeholder="Descreva o que aconteceu, quando ocorreu, quais sistemas foram afetados e quaisquer mensagens de erro observadas..."
          required
          rows={4}
          minRows={3}
          maxRows={10}
          maxLength={5000}
          showCharacterCount
          autoResize
          error={form.getFieldError('description')}
          hint="Seja específico sobre cronograma, sistemas afetados e sintomas observados"
          helpText="Inclua: 1) O que aconteceu, 2) Quando começou, 3) Quais sistemas estão afetados, 4) Mensagens de erro ou códigos, 5) Medidas tomadas até agora."
        />

        {/* Business Impact Field */}
        <TextAreaField
          {...form.getFieldProps('impact')}
          label="Impacto no Negócio"
          placeholder="Descreva o impacto no negócio: número de usuários afetados, impacto na receita, processos de negócio afetados..."
          required
          rows={3}
          minRows={2}
          maxRows={8}
          maxLength={2000}
          showCharacterCount
          autoResize
          error={form.getFieldError('impact')}
          hint="Quantifique o impacto nas operações do negócio e usuários"
          helpText="Inclua: Número de usuários afetados, impacto na receita, processos de negócio afetados, impacto no cliente e implicações de SLA."
        />

        {/* Tags Field */}
        <div className="incident-form__tag-section">
          <label className="incident-form__tag-label" id="tags-label">
            Tags
            <span className="incident-form__tag-hint">
              Adicione palavras-chave relevantes para categorização e busca (pressione Enter ou clique em Adicionar)
            </span>
          </label>

          <div className="incident-form__tag-input-container">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={handleTagKeyPress}
              placeholder="Adicionar tag (ex: falha, banco-dados, incidente-p1)..."
              maxLength={30}
              className="incident-form__tag-input"
              disabled={form.isSubmitting}
              aria-labelledby="tags-label"
              aria-describedby="tag-counter tag-hint"
              aria-invalid={!!form.getFieldError('tags')}
            />
            <Button
              type="button"
              onClick={handleAddTag}
              size="small"
              variant="secondary"
              disabled={!tagInput.trim() || form.values.tags.length >= 10}
            >
              Adicionar
            </Button>
          </div>

          {form.values.tags.length > 0 && (
            <div className="incident-form__tags-list" role="list" aria-label="Current tags">
              {form.values.tags.map((tag) => (
                <span key={tag} className="incident-form__tag incident-form__tag--incident" role="listitem">
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="incident-form__tag-remove"
                    aria-label={`Remove tag: ${tag}`}
                    disabled={form.isSubmitting}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {form.getFieldError('tags') && (
            <div className="incident-form__field-error">
              {form.getFieldError('tags')}
            </div>
          )}

          <div className="incident-form__tag-counter" id="tag-counter" aria-live="polite">
            {form.values.tags.length}/10 tags
          </div>
        </div>
      </div>

      {/* Form Status */}
      {ErrorMessages.hasErrors(form.errors) && (
        <div
          className="incident-form__error-summary"
          role="alert"
          aria-live="assertive"
          aria-labelledby="error-summary-title"
        >
          <strong id="error-summary-title">Por favor, corrija os seguintes erros:</strong>
          <ul>
            {Object.entries(form.errors)
              .filter(([, error]) => error)
              .map(([field, error]) => (
                <li key={field}>
                  <button
                    type="button"
                    onClick={() => {
                      const element = document.querySelector(`[name="${field}"]`) as HTMLElement;
                      element?.focus();
                    }}
                    className="incident-form__error-link"
                    aria-label={`Fix error: ${error}`}
                  >
                    {error}
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* Form Actions */}
      <div className="incident-form__actions">
        <div className="incident-form__actions-left">
          <Button
            type="button"
            variant="ghost"
            onClick={handleReset}
            disabled={form.isSubmitting || !form.isDirty}
            title="Resetar formulário para valores iniciais"
          >
            Resetar
          </Button>

          {enableDrafts && form.hasDraft && (
            <Button
              type="button"
              variant="ghost"
              onClick={form.clearDraft}
              disabled={form.isSubmitting}
              title="Limpar rascunho salvo"
            >
              Limpar Rascunho
            </Button>
          )}
        </div>

        <div className="incident-form__actions-right">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={form.isSubmitting}
          >
            Cancelar
          </Button>

          <Button
            type="submit"
            variant="primary"
            loading={form.isSubmitting}
            disabled={!form.isValid || form.isSubmitting}
            title={form.isValid ?
              `${mode === 'create' ? 'Reportar' : 'Salvar'} incidente (Ctrl+S ou Ctrl+Enter)` :
              'Por favor, corrija os erros de validação primeiro'
            }
            className="incident-form__submit-button"
          >
            {form.isSubmitting
              ? (mode === 'create' ? 'Reportando...' : 'Salvando...')
              : (mode === 'create' ? '🚨 Reportar Incidente' : '💾 Salvar Alterações')
            }
          </Button>
        </div>
      </div>

      {/* Keyboard Shortcuts Help */}
      <div className="incident-form__shortcuts">
        <details>
          <summary aria-expanded="false">Atalhos do Teclado</summary>
          <ul role="list" aria-label="Atalhos de teclado disponíveis">
            <li><kbd>Ctrl+S</kbd> ou <kbd>Ctrl+Enter</kbd> - Enviar formulário</li>
            <li><kbd>Ctrl+D</kbd> - Salvar rascunho</li>
            <li><kbd>Escape</kbd> - Cancelar</li>
            <li><kbd>Enter</kbd> no campo de tags - Adicionar tag</li>
          </ul>
        </details>
      </div>
    </form>
  );
});

IncidentForm.displayName = 'IncidentForm';