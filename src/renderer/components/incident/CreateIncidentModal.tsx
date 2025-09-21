import React, { useState, useCallback, useRef, useEffect } from 'react';
import { X, Save, AlertTriangle, CheckCircle, Loader2, Tag, FileText, AlertCircle, Brain, User, Calendar, TrendingUp } from 'lucide-react';
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
import { IncidentStatus, IncidentPriority } from '../../../types/incident';
import { CreateIncident } from '../../../backend/core/interfaces/ServiceInterfaces';

interface CreateIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateIncident) => Promise<void>;
  onError?: (error: Error) => void;
  loading?: boolean;
}

interface IncidentFormData {
  title: string;
  description: string;
  impact: 'crítica' | 'alta' | 'média' | 'baixa';
  category: string;
  priority: IncidentPriority;
  status: IncidentStatus;
  affected_system: string;
  assigned_to: string;
  reported_by: string;
  incident_date: string;
  tags: string[];
}

interface ValidationErrors {
  title?: string;
  description?: string;
  impact?: string;
  category?: string;
  affected_system?: string;
  reported_by?: string;
  tags?: string;
}

// Incident-specific categories for Brazilian Portuguese
const INCIDENT_CATEGORIES = [
  { value: 'Sistema Indisponível', label: 'Sistema Indisponível', description: 'Falha total do sistema ou aplicação' },
  { value: 'Performance', label: 'Performance', description: 'Problemas de desempenho e lentidão' },
  { value: 'Base de Dados', label: 'Base de Dados', description: 'Problemas com DB2, IMS ou outros bancos' },
  { value: 'Aplicação', label: 'Aplicação', description: 'Erros em programas COBOL ou aplicações' },
  { value: 'Segurança', label: 'Segurança', description: 'Problemas de acesso e RACF' },
  { value: 'Rede', label: 'Rede', description: 'Conectividade e comunicação' },
  { value: 'Hardware', label: 'Hardware', description: 'Falhas de equipamento' },
  { value: 'Capacidade', label: 'Capacidade', description: 'Limitações de recursos' },
  { value: 'Dados', label: 'Dados', description: 'Corrupção ou perda de dados' },
  { value: 'Configuração', label: 'Configuração', description: 'Problemas de configuração' },
  { value: 'JCL', label: 'JCL', description: 'Problemas em jobs e JCL' },
  { value: 'CICS', label: 'CICS', description: 'Problemas no ambiente CICS' },
  { value: 'Outro', label: 'Outro', description: 'Outros tipos de incidentes' }
];

// Status options in Portuguese
const STATUS_OPTIONS: Array<{value: IncidentStatus, label: string, description: string}> = [
  { value: 'em_revisao', label: 'Em Revisão', description: 'Aguardando classificação' },
  { value: 'aberto', label: 'Aberto', description: 'Incidente registrado' },
  { value: 'em_tratamento', label: 'Em Tratamento', description: 'Sendo investigado/resolvido' },
  { value: 'resolvido', label: 'Resolvido', description: 'Solução implementada' },
  { value: 'fechado', label: 'Fechado', description: 'Validado e finalizado' }
];

// Priority levels with Portuguese descriptions
const PRIORITY_LEVELS = [
  { value: 'P1', label: 'P1 - Crítica', color: 'text-red-600', description: 'Sistema principal indisponível' },
  { value: 'P2', label: 'P2 - Alta', color: 'text-orange-600', description: 'Impacto significativo nos negócios' },
  { value: 'P3', label: 'P3 - Média', color: 'text-yellow-600', description: 'Impacto moderado' },
  { value: 'P4', label: 'P4 - Baixa', color: 'text-green-600', description: 'Impacto mínimo' }
];

// Impact levels
const IMPACT_LEVELS = [
  { value: 'crítica', label: 'Crítica', color: 'text-red-600', description: 'Parada total de produção' },
  { value: 'alta', label: 'Alta', color: 'text-orange-600', description: 'Impacto significativo' },
  { value: 'média', label: 'Média', color: 'text-yellow-600', description: 'Funcionalidade limitada' },
  { value: 'baixa', label: 'Baixa', color: 'text-green-600', description: 'Impacto mínimo' }
];

// Common incident tags in Portuguese
const COMMON_INCIDENT_TAGS = [
  'abend', 'erro-sql', 'timeout', 'memory', 'performance', 'conexao',
  'batch-job', 'online', 'cics-crash', 'db2-lock', 'vsam-error',
  'jcl-error', 'cobol-abend', 'sistema-lento', 'acesso-negado',
  'backup-falhou', 'espaco-disco', 'cpu-alto', 'deadlock'
];

// Generate auto incident number
const generateIncidentNumber = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const time = String(now.getTime()).slice(-6); // Last 6 digits for uniqueness
  return `INC${year}${month}${day}${time}`;
};

export const CreateIncidentModal: React.FC<CreateIncidentModalProps> = ({
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
    impact: 'média',
    category: 'Outro',
    priority: 'P3',
    status: 'em_revisao',
    affected_system: '',
    assigned_to: '',
    reported_by: '',
    incident_date: new Date().toISOString().split('T')[0],
    tags: []
  });

  // UI state
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [filteredTags, setFilteredTags] = useState<string[]>([]);
  const [showAISuggestion, setShowAISuggestion] = useState(false);
  const [aiSuggestionLoading, setAISuggestionLoading] = useState(false);
  const [incidentNumber] = useState(generateIncidentNumber());

  // Refs
  const formRef = useRef<HTMLFormElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      const currentUser = 'system-user'; // This should come from auth context
      setFormData({
        title: '',
        description: '',
        impact: 'média',
        category: 'Outro',
        priority: 'P3',
        status: 'em_revisao',
        affected_system: '',
        assigned_to: '',
        reported_by: currentUser,
        incident_date: new Date().toISOString().split('T')[0],
        tags: []
      });
      setValidationErrors({});
      setTagInput('');
      setShowAISuggestion(false);
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
      errors.title = 'Título é obrigatório';
    } else if (formData.title.length < 10) {
      errors.title = 'Título deve ter pelo menos 10 caracteres';
    } else if (formData.title.length > 200) {
      errors.title = 'Título deve ter menos de 200 caracteres';
    }

    if (!formData.description.trim()) {
      errors.description = 'Descrição é obrigatória';
    } else if (formData.description.length < 20) {
      errors.description = 'Descrição deve ter pelo menos 20 caracteres';
    } else if (formData.description.length > 5000) {
      errors.description = 'Descrição deve ter menos de 5000 caracteres';
    }

    if (!formData.affected_system.trim()) {
      errors.affected_system = 'Sistema afetado é obrigatório';
    }

    if (!formData.reported_by.trim()) {
      errors.reported_by = 'Responsável pelo reporte é obrigatório';
    }

    if (formData.tags.length > 10) {
      errors.tags = 'Máximo de 10 tags permitidas';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  // Handle AI suggestion for categorization
  const handleAISuggestion = useCallback(async () => {
    if (!formData.title.trim() && !formData.description.trim()) {
      return;
    }

    setAISuggestionLoading(true);
    setShowAISuggestion(true);

    try {
      // This would call your incident AI service
      // const aiResult = await window.electron.ipc.invokeIncidentAI('categorize', {
      //   title: formData.title,
      //   description: formData.description
      // });

      // Mock AI suggestion for demo
      setTimeout(() => {
        const mockSuggestion = {
          category: formData.description.toLowerCase().includes('db2') ? 'Base de Dados' :
                   formData.description.toLowerCase().includes('cics') ? 'CICS' :
                   formData.description.toLowerCase().includes('performance') ? 'Performance' : 'Sistema Indisponível',
          priority: formData.title.toLowerCase().includes('crítico') || formData.title.toLowerCase().includes('produção') ? 'P1' :
                   formData.title.toLowerCase().includes('erro') ? 'P2' : 'P3',
          impact: formData.description.toLowerCase().includes('produção') ? 'crítica' :
                 formData.description.toLowerCase().includes('lento') ? 'média' : 'baixa',
          suggestedTags: formData.description.toLowerCase().includes('db2') ? ['db2-error', 'sql'] :
                        formData.description.toLowerCase().includes('cics') ? ['cics-crash', 'online'] :
                        ['sistema-lento', 'performance']
        };

        setFormData(prev => ({
          ...prev,
          category: mockSuggestion.category,
          priority: mockSuggestion.priority as IncidentPriority,
          impact: mockSuggestion.impact as any,
          tags: [...prev.tags, ...mockSuggestion.suggestedTags.filter(tag => !prev.tags.includes(tag))]
        }));

        setAISuggestionLoading(false);
      }, 1500);
    } catch (error) {
      console.error('AI suggestion failed:', error);
      setAISuggestionLoading(false);
    }
  }, [formData.title, formData.description]);

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
        impact: formData.impact,
        category: formData.category as any,
        priority: formData.priority,
        status: formData.status,
        assignee: formData.assigned_to || undefined,
        tags: formData.tags,
        reported_by: formData.reported_by,
        reported_at: formData.incident_date,
        affected_systems: formData.affected_system ? [formData.affected_system] : undefined
      };

      await onSubmit(incidentData);
      onClose();
    } catch (error) {
      console.error('Error creating incident:', error);
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

  return (
    <Modal open={isOpen} onOpenChange={onClose}>
      <ModalContent size="3xl" open={isOpen} className="max-h-[90vh] overflow-hidden flex flex-col">
        <ModalHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-red-600 rounded-lg">
                <AlertCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <ModalTitle className="text-xl font-semibold text-gray-900">
                  Criar Novo Incidente
                </ModalTitle>
                <ModalDescription className="text-sm text-gray-600">
                  Registro de novo incidente no sistema de gestão
                </ModalDescription>
              </div>
            </div>
            <div className="text-xs text-gray-500 text-right">
              <div className="font-medium">#{incidentNumber}</div>
              <div>Accenture Technology Solutions</div>
            </div>
          </div>
          <ModalClose onClose={onClose} />
        </ModalHeader>

        <ModalBody className="overflow-y-auto px-6 flex-1 min-h-0">
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
            {/* AI Suggestion Button */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Brain className="h-5 w-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">
                    Sugestão Inteligente de Classificação
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAISuggestion}
                  disabled={aiSuggestionLoading || (!formData.title.trim() && !formData.description.trim())}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 border border-blue-300 rounded-md hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {aiSuggestionLoading ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Analisando...
                    </>
                  ) : (
                    <>
                      <Brain className="h-3 w-3 mr-1" />
                      Sugerir Classificação
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-blue-700 mt-1">
                A IA analisará o título e descrição para sugerir categoria, prioridade e tags relevantes
              </p>
            </div>

            {/* Title Field */}
            <div className="space-y-2">
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                Título <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Descrição breve do incidente (ex: 'DB2 SQL0904 - Recurso Indisponível')"
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
            </div>

            {/* Priority, Status and Impact Row */}
            <div className="grid grid-cols-3 gap-4">
              {/* Priority Field */}
              <div className="space-y-2">
                <label htmlFor="priority" className="block text-sm font-medium text-gray-700">
                  <TrendingUp className="inline h-4 w-4 mr-1" />
                  Prioridade
                </label>
                <select
                  id="priority"
                  value={formData.priority}
                  onChange={(e) => handleInputChange('priority', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  {PRIORITY_LEVELS.map(level => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  {PRIORITY_LEVELS.find(p => p.value === formData.priority)?.description}
                </p>
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
                <p className="text-xs text-gray-500">
                  {STATUS_OPTIONS.find(s => s.value === formData.status)?.description}
                </p>
              </div>

              {/* Impact Field */}
              <div className="space-y-2">
                <label htmlFor="impact" className="block text-sm font-medium text-gray-700">
                  Impacto
                </label>
                <select
                  id="impact"
                  value={formData.impact}
                  onChange={(e) => handleInputChange('impact', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  {IMPACT_LEVELS.map(impact => (
                    <option key={impact.value} value={impact.value}>
                      {impact.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  {IMPACT_LEVELS.find(i => i.value === formData.impact)?.description}
                </p>
              </div>
            </div>

            {/* Category Field */}
            <div className="space-y-2">
              <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                <FileText className="inline h-4 w-4 mr-1" />
                Categoria <span className="text-red-500">*</span>
              </label>
              <select
                id="category"
                value={formData.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                {INCIDENT_CATEGORIES.map(category => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500">
                {INCIDENT_CATEGORIES.find(c => c.value === formData.category)?.description}
              </p>
            </div>

            {/* Affected System and Assignment Row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Affected System */}
              <div className="space-y-2">
                <label htmlFor="affected_system" className="block text-sm font-medium text-gray-700">
                  Sistema Afetado <span className="text-red-500">*</span>
                </label>
                <input
                  id="affected_system"
                  type="text"
                  value={formData.affected_system}
                  onChange={(e) => handleInputChange('affected_system', e.target.value)}
                  placeholder="Ex: CICS Produção, DB2 Subsystem, Batch Jobs"
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 ${
                    validationErrors.affected_system ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {validationErrors.affected_system && (
                  <span className="text-sm text-red-600">{validationErrors.affected_system}</span>
                )}
              </div>

              {/* Assigned To */}
              <div className="space-y-2">
                <label htmlFor="assigned_to" className="block text-sm font-medium text-gray-700">
                  <User className="inline h-4 w-4 mr-1" />
                  Atribuído Para
                </label>
                <input
                  id="assigned_to"
                  type="text"
                  value={formData.assigned_to}
                  onChange={(e) => handleInputChange('assigned_to', e.target.value)}
                  placeholder="Nome do responsável (opcional)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
            </div>

            {/* Reported By and Date Row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Reported By */}
              <div className="space-y-2">
                <label htmlFor="reported_by" className="block text-sm font-medium text-gray-700">
                  Reportado Por <span className="text-red-500">*</span>
                </label>
                <input
                  id="reported_by"
                  type="text"
                  value={formData.reported_by}
                  onChange={(e) => handleInputChange('reported_by', e.target.value)}
                  placeholder="Nome do usuário que reportou"
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 ${
                    validationErrors.reported_by ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {validationErrors.reported_by && (
                  <span className="text-sm text-red-600">{validationErrors.reported_by}</span>
                )}
              </div>

              {/* Incident Date */}
              <div className="space-y-2">
                <label htmlFor="incident_date" className="block text-sm font-medium text-gray-700">
                  <Calendar className="inline h-4 w-4 mr-1" />
                  Data do Incidente
                </label>
                <input
                  id="incident_date"
                  type="date"
                  value={formData.incident_date}
                  onChange={(e) => handleInputChange('incident_date', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Descrição Detalhada <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Descreva o incidente em detalhes. Inclua mensagens de erro, sintomas e contexto quando o problema ocorre..."
                rows={5}
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
                Inclua: 1) O que estava tentando fazer, 2) O que aconteceu, 3) Mensagens de erro, 4) Quando/onde ocorre
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
                  placeholder="Adicione palavras-chave (pressione Enter)"
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
                        aria-label={`Remover tag: ${tag}`}
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
                Adicione palavras-chave relevantes para facilitar a busca
              </p>
            </div>
          </form>
        </ModalBody>

        <ModalFooter>
          <div className="flex justify-between items-center w-full">
            <div className="text-xs text-gray-500">
              Campos marcados com * são obrigatórios
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
                    Criando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Criar Incidente
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

export default CreateIncidentModal;