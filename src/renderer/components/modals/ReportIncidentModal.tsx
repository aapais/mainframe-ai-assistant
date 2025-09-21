import React, { useState, useCallback, useRef, useEffect } from 'react';
import { X, Save, AlertTriangle, CheckCircle, Loader2, Tag, FileText, FolderOpen, Clock, Users } from 'lucide-react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
  ModalClose
} from '../ui/Modal';
import { IncidentFormData } from '../../types/form';
import { CreateIncident } from '../../../backend/core/interfaces/ServiceInterfaces';

interface ReportIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateIncident) => Promise<void>;
  onError?: (error: Error) => void;
  loading?: boolean;
}

interface ValidationErrors {
  title?: string;
  description?: string;
  impact?: string;
  category?: string;
  priority?: string;
  tags?: string;
}

// Incident-specific categories
const INCIDENT_CATEGORIES = [
  { value: 'System Outage', label: 'Falha do Sistema', description: 'Falha completa do sistema ou serviço' },
  { value: 'Performance', label: 'Problema de Performance', description: 'Tempos de resposta lentos ou performance degradada' },
  { value: 'Database', label: 'Problema de Banco de Dados', description: 'Problemas relacionados a DB2, IMS ou VSAM' },
  { value: 'Application', label: 'Erro de Aplicação', description: 'Falhas em COBOL, CICS ou jobs batch' },
  { value: 'Security', label: 'Incidente de Segurança', description: 'RACF, controle de acesso ou violações de segurança' },
  { value: 'Network', label: 'Problema de Rede', description: 'Problemas de conectividade ou comunicação' },
  { value: 'Hardware', label: 'Falha de Hardware', description: 'Problemas físicos do sistema ou armazenamento' },
  { value: 'Capacity', label: 'Problema de Capacidade', description: 'Limites de armazenamento, memória ou processamento' },
  { value: 'Data', label: 'Problema de Dados', description: 'Corrupção, perda ou problemas de integridade de dados' },
  { value: 'Configuration', label: 'Erro de Configuração', description: 'Problemas de configuração do sistema ou aplicação' },
  { value: 'Other', label: 'Outros/Diversos', description: 'Outros tipos de incidentes' }
];

const PRIORITY_LEVELS = [
  { value: 'P1', label: 'P1 - Crítica', color: 'text-red-600', description: 'Falha completa do serviço, ação imediata necessária' },
  { value: 'P2', label: 'P2 - Alta', color: 'text-orange-600', description: 'Impacto significativo, requer atenção urgente' },
  { value: 'P3', label: 'P3 - Média', color: 'text-yellow-600', description: 'Impacto moderado, cronograma normal' },
  { value: 'P4', label: 'P4 - Baixa', color: 'text-green-600', description: 'Impacto menor, pode ser resolvido quando conveniente' }
];

const IMPACT_LEVELS = [
  { value: 'Critical', label: 'Crítico', description: 'Sistemas críticos para o negócio afetados, grande impacto na receita' },
  { value: 'High', label: 'Alto', description: 'Funções importantes do negócio impactadas' },
  { value: 'Medium', label: 'Médio', description: 'Algumas funções do negócio afetadas' },
  { value: 'Low', label: 'Baixo', description: 'Impacto menor nas operações do negócio' }
];

const STATUS_OPTIONS = [
  { value: 'aberto', label: 'Aberto', description: 'Incidente recém-reportado' },
  { value: 'em_tratamento', label: 'Em Tratamento', description: 'Incidente está sendo trabalhado' },
  { value: 'em_revisao', label: 'Em Revisão', description: 'Aguardando entrada externa ou recursos' },
  { value: 'resolvido', label: 'Resolvido', description: 'Problema foi corrigido' },
  { value: 'fechado', label: 'Fechado', description: 'Incidente completo e verificado' }
];

// Common incident tags for auto-suggestions
const COMMON_INCIDENT_TAGS = [
  'falha', 'performance', 'timeout', 'conexao-falhou', 'abend', 'codigo-erro',
  'falha-batch', 'online-inativo', 'erro-banco-dados', 'corrupcao-arquivo', 'problema-memoria',
  'capacidade-excedida', 'violacao-seguranca', 'acesso-negado', 'problema-rede',
  'falha-hardware', 'erro-configuracao', 'problema-deploy', 'emergencia',
  'manutencao-programada', 'downtime-nao-planejado', 'rollback-necessario'
];

export const ReportIncidentModal: React.FC<ReportIncidentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onError,
  loading = false
}) => {
  // Form state
  const [formData, setFormData] = useState<IncidentFormData>({
    title: '',
    description: '',
    impact: '',
    category: 'Other',
    priority: 'P3',
    status: 'Open',
    assignee: '',
    tags: []
  });

  // UI state
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [filteredTags, setFilteredTags] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Refs
  const formRef = useRef<HTMLFormElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        title: '',
        description: '',
        impact: '',
        category: 'Other',
        priority: 'P3',
        status: 'aberto',
        assignee: '',
        tags: []
      });
      setValidationErrors({});
      setTagInput('');
      setShowAdvanced(false);
    }
  }, [isOpen]);

  // Filter tag suggestions based on input
  useEffect(() => {
    if (tagInput.trim()) {
      const filtered = COMMON_INCIDENT_TAGS.filter(tag =>
        tag.toLowerCase().includes(tagInput.toLowerCase()) &&
        !formData.tags.includes(tag)
      ).slice(0, 8);
      setFilteredTags(filtered);
      setShowTagSuggestions(filtered.length > 0);
    } else {
      setShowTagSuggestions(false);
    }
  }, [tagInput, formData.tags]);

  // Validation
  const validateForm = useCallback((): boolean => {
    const errors: ValidationErrors = {};

    if (!formData.title.trim()) {
      errors.title = 'Título do incidente é obrigatório';
    } else if (formData.title.length < 10) {
      errors.title = 'Título deve ter pelo menos 10 caracteres';
    } else if (formData.title.length > 200) {
      errors.title = 'Título deve ter menos de 200 caracteres';
    }

    if (!formData.description.trim()) {
      errors.description = 'Descrição do incidente é obrigatória';
    } else if (formData.description.length < 20) {
      errors.description = 'Descrição deve ter pelo menos 20 caracteres';
    } else if (formData.description.length > 5000) {
      errors.description = 'Descrição deve ter menos de 5000 caracteres';
    }

    if (!formData.impact.trim()) {
      errors.impact = 'Avaliação de impacto é obrigatória';
    } else if (formData.impact.length < 10) {
      errors.impact = 'Descrição do impacto deve ter pelo menos 10 caracteres';
    }

    if (!formData.category) {
      errors.category = 'Categoria é obrigatória';
    }

    if (!formData.priority) {
      errors.priority = 'Prioridade é obrigatória';
    }

    if (formData.tags.length > 10) {
      errors.tags = 'Máximo de 10 tags permitidas';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const incidentData: CreateIncident = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        impact: formData.impact.trim(),
        category: formData.category as any,
        priority: formData.priority as any,
        status: formData.status as any,
        assignee: formData.assignee || 'unassigned',
        tags: formData.tags,
        reported_by: 'current-user', // This should come from auth context
        reported_at: new Date().toISOString()
      };

      await onSubmit(incidentData);
      onClose();
    } catch (error) {
      console.error('Error reporting incident:', error);
      onError?.(error as Error);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateForm, isSubmitting, onSubmit, onClose, onError]);

  // Handle input changes
  const handleInputChange = useCallback((field: keyof IncidentFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear validation error for this field
    if (validationErrors[field as keyof ValidationErrors]) {
      setValidationErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }, [validationErrors]);

  // Tag management
  const handleAddTag = useCallback((tag: string) => {
    const trimmedTag = tag.trim().toLowerCase();
    if (trimmedTag && !formData.tags.includes(trimmedTag) && formData.tags.length < 10) {
      handleInputChange('tags', [...formData.tags, trimmedTag]);
      setTagInput('');
      setShowTagSuggestions(false);
    }
  }, [formData.tags, handleInputChange]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    handleInputChange('tags', formData.tags.filter(tag => tag !== tagToRemove));
  }, [formData.tags, handleInputChange]);

  const handleTagKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (tagInput.trim()) {
        handleAddTag(tagInput);
      }
    } else if (e.key === 'Escape') {
      setShowTagSuggestions(false);
    }
  }, [tagInput, handleAddTag]);

  // Character count helper
  const getCharacterCount = (text: string, max: number) => ({
    current: text.length,
    max,
    percentage: (text.length / max) * 100,
    isNearLimit: text.length > max * 0.8,
    isOverLimit: text.length > max
  });

  const titleCount = getCharacterCount(formData.title, 200);
  const descriptionCount = getCharacterCount(formData.description, 5000);
  const impactCount = getCharacterCount(formData.impact, 1000);

  return (
    <Modal open={isOpen} onOpenChange={onClose}>
      <ModalContent size="3xl" open={isOpen} className="max-h-[90vh] overflow-hidden flex flex-col">
        <ModalHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-red-600 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-white" />
              </div>
              <div>
                <ModalTitle className="text-xl font-semibold text-gray-900">
                  Reportar Novo Incidente
                </ModalTitle>
                <ModalDescription className="text-sm text-gray-600">
                  Criar um novo relatório de incidente para o Sistema Mainframe Accenture
                </ModalDescription>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              Sistema de Gestão de Incidentes
            </div>
          </div>
          <ModalClose onClose={onClose} />
        </ModalHeader>

        <ModalBody className="overflow-y-auto px-6 flex-1 min-h-0">
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
            {/* Title Field */}
            <div className="space-y-2">
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                Título do Incidente <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Título breve e descritivo (ex: 'Banco de Dados DB2 de Produção Indisponível - SQLCODE -904')"
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 ${
                  validationErrors.title ? 'border-red-300' : 'border-gray-300'
                }`}
                maxLength={200}
                autoFocus
              />
              <div className="flex justify-between items-center">
                {validationErrors.title && (
                  <span className="text-sm text-red-600 flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    {validationErrors.title}
                  </span>
                )}
                <span className={`text-xs ${titleCount.isOverLimit ? 'text-red-600' : titleCount.isNearLimit ? 'text-yellow-600' : 'text-gray-500'}`}>
                  {titleCount.current}/{titleCount.max}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Inclua nomes de sistemas, códigos de erro ou sintomas principais para identificação rápida
              </p>
            </div>

            {/* Priority, Category, and Status Row */}
            <div className="grid grid-cols-3 gap-4">
              {/* Priority Field */}
              <div className="space-y-2">
                <label htmlFor="priority" className="block text-sm font-medium text-gray-700">
                  <AlertTriangle className="inline h-4 w-4 mr-1" />
                  Prioridade <span className="text-red-500">*</span>
                </label>
                <select
                  id="priority"
                  value={formData.priority}
                  onChange={(e) => handleInputChange('priority', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  {PRIORITY_LEVELS.map(priority => (
                    <option key={priority.value} value={priority.value}>
                      {priority.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  {PRIORITY_LEVELS.find(p => p.value === formData.priority)?.description}
                </p>
              </div>

              {/* Category Field */}
              <div className="space-y-2">
                <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                  <FolderOpen className="inline h-4 w-4 mr-1" />
                  Categoria <span className="text-red-500">*</span>
                </label>
                <select
                  id="category"
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 ${
                    validationErrors.category ? 'border-red-300' : 'border-gray-300'
                  }`}
                >
                  {INCIDENT_CATEGORIES.map(category => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Field */}
              <div className="space-y-2">
                <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                  Status
                </label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  {STATUS_OPTIONS.map(status => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Incident Description */}
            <div className="space-y-2">
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Descrição do Incidente <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Descreva o que aconteceu, quando ocorreu, quais sistemas foram afetados e quaisquer mensagens de erro observadas..."
                rows={4}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-y ${
                  validationErrors.description ? 'border-red-300' : 'border-gray-300'
                }`}
                maxLength={5000}
              />
              <div className="flex justify-between items-center">
                {validationErrors.description && (
                  <span className="text-sm text-red-600 flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    {validationErrors.description}
                  </span>
                )}
                <span className={`text-xs ${descriptionCount.isOverLimit ? 'text-red-600' : descriptionCount.isNearLimit ? 'text-yellow-600' : 'text-gray-500'}`}>
                  {descriptionCount.current}/{descriptionCount.max}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Inclua: Cronograma, sistemas afetados, mensagens de erro, impacto no usuário e medidas tomadas até agora
              </p>
            </div>

            {/* Impact Assessment */}
            <div className="space-y-2">
              <label htmlFor="impact" className="block text-sm font-medium text-gray-700">
                Impacto no Negócio <span className="text-red-500">*</span>
              </label>
              <div className="mb-2">
                <select
                  value={formData.impact.split(' - ')[0] || ''}
                  onChange={(e) => {
                    const selectedLevel = IMPACT_LEVELS.find(level => level.value === e.target.value);
                    if (selectedLevel) {
                      handleInputChange('impact', `${selectedLevel.value} - ${selectedLevel.description}`);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 mb-2"
                >
                  <option value="">Selecionar Nível de Impacto</option>
                  {IMPACT_LEVELS.map(level => (
                    <option key={level.value} value={level.value}>
                      {level.label} - {level.description}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                id="impact"
                value={formData.impact}
                onChange={(e) => handleInputChange('impact', e.target.value)}
                placeholder="Descreva o impacto no negócio: número de usuários afetados, impacto na receita, processos de negócio afetados..."
                rows={3}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-y ${
                  validationErrors.impact ? 'border-red-300' : 'border-gray-300'
                }`}
                maxLength={1000}
              />
              <div className="flex justify-between items-center">
                {validationErrors.impact && (
                  <span className="text-sm text-red-600 flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    {validationErrors.impact}
                  </span>
                )}
                <span className={`text-xs ${impactCount.isOverLimit ? 'text-red-600' : impactCount.isNearLimit ? 'text-yellow-600' : 'text-gray-500'}`}>
                  {impactCount.current}/{impactCount.max}
                </span>
              </div>
            </div>

            {/* Assignee Field */}
            <div className="space-y-2">
              <label htmlFor="assignee" className="block text-sm font-medium text-gray-700">
                <Users className="inline h-4 w-4 mr-1" />
                Atribuir Para (Opcional)
              </label>
              <input
                id="assignee"
                type="text"
                value={formData.assignee}
                onChange={(e) => handleInputChange('assignee', e.target.value)}
                placeholder="Nome de usuário ou equipe (deixe em branco para atribuição automática)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
              <p className="text-xs text-gray-500">
                Deixe em branco para atribuição automática baseada na categoria e prioridade
              </p>
            </div>

            {/* Tags Section */}
            <div className="space-y-2">
              <label htmlFor="tagInput" className="block text-sm font-medium text-gray-700">
                <Tag className="inline h-4 w-4 mr-1" />
                Tags ({formData.tags.length}/10)
              </label>
              <div className="relative">
                <input
                  ref={tagInputRef}
                  id="tagInput"
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyPress}
                  placeholder="Adicione palavras-chave relevantes (pressione Enter)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  maxLength={30}
                  disabled={formData.tags.length >= 10}
                />

                {/* Tag Suggestions */}
                {showTagSuggestions && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                    {filteredTags.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleAddTag(tag)}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Current Tags */}
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 hover:text-red-600 focus:outline-none"
                        aria-label={`Remove tag: ${tag}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {validationErrors.tags && (
                <span className="text-sm text-red-600">{validationErrors.tags}</span>
              )}
              <p className="text-xs text-gray-500">
                Adicione palavras-chave relevantes para ajudar a categorizar e buscar este incidente
              </p>
            </div>
          </form>
        </ModalBody>

        <ModalFooter>
          <div className="flex justify-between items-center w-full">
            <div className="text-xs text-gray-500">
              Todos os campos marcados com * são obrigatórios
            </div>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={isSubmitting || loading}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Reportando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Reportar Incidente
                  </>
                )}
              </button>
            </div>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ReportIncidentModal;