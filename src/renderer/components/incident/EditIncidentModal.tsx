import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  X,
  Save,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Tag,
  FileText,
  AlertCircle,
  Brain,
  User,
  Calendar,
  TrendingUp,
  Edit,
  Clock,
  Shield,
  Activity,
  Diff,
  ArrowRight,
  RotateCcw,
  MessageSquare,
  FileWarning,
  Wrench,
  ClipboardList,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Target,
  TrendingDown
} from 'lucide-react';
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

// Types for the incident data structure (Portuguese states)
export type IncidentStatus = 'aberto' | 'em_tratamento' | 'resolvido' | 'fechado' | 'em_revisao';
export type IncidentPriority = 'P1' | 'P2' | 'P3' | 'P4';
export type IncidentImpact = 'crítica' | 'alta' | 'média' | 'baixa';

interface IncidentData {
  id: string;
  title: string;
  description: string;
  impact: IncidentImpact;
  category: string;
  priority: IncidentPriority;
  status: IncidentStatus;
  affected_system: string;
  assigned_to: string;
  reported_by: string;
  incident_date: string;
  tags: string[];
  created_at: Date;
  updated_at: Date;
  resolution_notes?: string;
  escalation_level?: number;
  sla_deadline?: Date;
  business_impact_rating?: number;
  estimated_resolution?: Date;
  // Campos para tratamento de incidente
  treatment_analysis?: string;
  actions_taken?: string;
  next_steps?: string;
  treatment_started_at?: Date;
  treatment_notes?: string;
}

interface AIProposal {
  id: string;
  confidence: number;
  estimated_resolution_time: string;
  risk_level: 'baixo' | 'medio' | 'alto';
  analysis: string;
  actions_taken: string;
  next_steps: string;
  treatment_notes?: string;
  reasoning: string;
  success_probability: number;
  generated_at: Date;
}

interface EditIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (id: string, changes: Partial<IncidentData>, auditInfo: AuditInfo) => Promise<void>;
  onError?: (error: Error) => void;
  loading?: boolean;
  incident: IncidentData;
}

interface AuditInfo {
  changedFields: string[];
  changeReason: string;
  changedBy: string;
  previousValues: Record<string, any>;
  newValues: Record<string, any>;
  timestamp: Date;
  requiresApproval?: boolean;
  criticalChange?: boolean;
}

interface ValidationErrors {
  title?: string;
  description?: string;
  impact?: string;
  category?: string;
  affected_system?: string;
  reported_by?: string;
  tags?: string;
  change_reason?: string;
  treatment_analysis?: string;
  actions_taken?: string;
  next_steps?: string;
}

interface FieldChange {
  field: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
  critical: boolean;
}

// Status transition rules with Portuguese states
const STATUS_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  'aberto': ['em_tratamento', 'em_revisao', 'fechado'],
  'em_revisao': ['aberto', 'em_tratamento'],
  'em_tratamento': ['resolvido', 'aberto', 'em_revisao'],
  'resolvido': ['fechado', 'aberto'], // Can reopen or close
  'fechado': ['aberto'] // Can only reopen
};

// Critical fields that require confirmation
const CRITICAL_FIELDS = ['status', 'priority', 'category', 'assigned_to'];

// Incident categories for Brazilian Portuguese
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
const STATUS_OPTIONS: Array<{value: IncidentStatus, label: string, description: string, color: string}> = [
  { value: 'aberto', label: 'Aberto', description: 'Incidente registrado', color: 'text-red-600' },
  { value: 'em_revisao', label: 'Em Revisão', description: 'Aguardando classificação', color: 'text-yellow-600' },
  { value: 'em_tratamento', label: 'Em Tratamento', description: 'Sendo investigado/resolvido', color: 'text-blue-600' },
  { value: 'resolvido', label: 'Resolvido', description: 'Solução implementada', color: 'text-green-600' },
  { value: 'fechado', label: 'Fechado', description: 'Validado e finalizado', color: 'text-gray-600' }
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

export const EditIncidentModal: React.FC<EditIncidentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onError,
  loading = false,
  incident
}) => {
  // Form state initialized with current incident data
  const [formData, setFormData] = useState<IncidentData>({ ...incident });
  const [originalData] = useState<IncidentData>({ ...incident });

  // UI state
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [filteredTags, setFilteredTags] = useState<string[]>([]);
  const [showAISuggestion, setShowAISuggestion] = useState(false);
  const [aiSuggestionLoading, setAISuggestionLoading] = useState(false);

  // Edit-specific state
  const [changedFields, setChangedFields] = useState<Set<string>>(new Set());
  const [fieldChanges, setFieldChanges] = useState<FieldChange[]>([]);
  const [changeReason, setChangeReason] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Partial<IncidentData> | null>(null);
  const [showAuditTrail, setShowAuditTrail] = useState(false);
  const [criticalChange, setCriticalChange] = useState(false);

  // Treatment-specific state
  const [showTreatmentSection, setShowTreatmentSection] = useState(false);
  const [treatmentStarted, setTreatmentStarted] = useState(false);

  // AI Proposal state
  const [aiProposal, setAIProposal] = useState<AIProposal | null>(null);
  const [generatingProposal, setGeneratingProposal] = useState(false);
  const [showProposal, setShowProposal] = useState(false);
  const [proposalError, setProposalError] = useState<string | null>(null);

  // Refs
  const formRef = useRef<HTMLFormElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // Reset form when modal opens/closes or incident changes
  useEffect(() => {
    if (isOpen && incident) {
      setFormData({ ...incident });
      setValidationErrors({});
      setTagInput('');
      setShowAISuggestion(false);
      setChangedFields(new Set());
      setFieldChanges([]);
      setChangeReason('');
      setShowConfirmDialog(false);
      setPendingChanges(null);
      setCriticalChange(false);
      setShowTreatmentSection(false);
      setTreatmentStarted(false);
      setAIProposal(null);
      setGeneratingProposal(false);
      setShowProposal(false);
      setProposalError(null);
    }
  }, [isOpen, incident]);

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

  // Track field changes
  const trackFieldChange = useCallback((field: string, newValue: any, oldValue: any) => {
    if (JSON.stringify(newValue) !== JSON.stringify(oldValue)) {
      const newChangedFields = new Set(changedFields);
      newChangedFields.add(field);
      setChangedFields(newChangedFields);

      const change: FieldChange = {
        field,
        oldValue,
        newValue,
        timestamp: new Date(),
        critical: CRITICAL_FIELDS.includes(field)
      };

      setFieldChanges(prev => {
        const filtered = prev.filter(c => c.field !== field);
        return [...filtered, change];
      });

      // Check if this is a critical change
      if (CRITICAL_FIELDS.includes(field)) {
        setCriticalChange(true);
      }
    } else {
      const newChangedFields = new Set(changedFields);
      newChangedFields.delete(field);
      setChangedFields(newChangedFields);

      setFieldChanges(prev => prev.filter(c => c.field !== field));
    }
  }, [changedFields]);

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

    // Validate status transitions
    if (formData.status !== originalData.status) {
      const validTransitions = STATUS_TRANSITIONS[originalData.status] || [];
      if (!validTransitions.includes(formData.status)) {
        errors.impact = `Transição de status de '${STATUS_OPTIONS.find(s => s.value === originalData.status)?.label}' para '${STATUS_OPTIONS.find(s => s.value === formData.status)?.label}' não é permitida`;
      }
    }

    // Require change reason for critical changes
    if (criticalChange && !changeReason.trim()) {
      errors.change_reason = 'Motivo da mudança é obrigatório para alterações críticas';
    }

    // Validation for treatment fields
    if (treatmentStarted || showTreatmentSection) {
      if (!formData.treatment_analysis?.trim()) {
        errors.treatment_analysis = 'Análise do problema é obrigatória para iniciar o tratamento';
      } else if (formData.treatment_analysis.length < 20) {
        errors.treatment_analysis = 'Análise deve ter pelo menos 20 caracteres';
      }

      if (!formData.actions_taken?.trim()) {
        errors.actions_taken = 'Ações tomadas são obrigatórias';
      } else if (formData.actions_taken.length < 10) {
        errors.actions_taken = 'Ações tomadas devem ter pelo menos 10 caracteres';
      }

      if (!formData.next_steps?.trim()) {
        errors.next_steps = 'Próximos passos são obrigatórios';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, originalData, criticalChange, changeReason]);

  // Handle AI suggestion for categorization
  const handleAISuggestion = useCallback(async () => {
    if (!formData.title.trim() && !formData.description.trim()) {
      return;
    }

    setAISuggestionLoading(true);
    setShowAISuggestion(true);

    try {
      // This would call your incident AI service
      // const aiResult = await window.electron.ipc.invokeIncidentAI('recategorize', {
      //   id: incident.id,
      //   title: formData.title,
      //   description: formData.description,
      //   currentCategory: formData.category
      // });

      // Mock AI suggestion for demo
      setTimeout(() => {
        const mockSuggestion = {
          category: formData.description.toLowerCase().includes('db2') ? 'Base de Dados' :
                   formData.description.toLowerCase().includes('cics') ? 'CICS' :
                   formData.description.toLowerCase().includes('performance') ? 'Performance' : 'Sistema Indisponível',
          priority: formData.title.toLowerCase().includes('crítico') || formData.title.toLowerCase().includes('produção') ? 'P1' :
                   formData.title.toLowerCase().includes('erro') ? 'P2' : formData.priority,
          impact: formData.description.toLowerCase().includes('produção') ? 'crítica' :
                 formData.description.toLowerCase().includes('lento') ? 'média' : formData.impact,
          suggestedTags: formData.description.toLowerCase().includes('db2') ? ['db2-error', 'sql'] :
                        formData.description.toLowerCase().includes('cics') ? ['cics-crash', 'online'] :
                        ['sistema-lento', 'performance'],
          confidence: 0.85,
          reasoning: 'Baseado na análise do título e descrição, sugiro estas atualizações de classificação.'
        };

        // Only suggest changes if they're different from current values
        const updates: Partial<IncidentData> = {};
        if (mockSuggestion.category !== formData.category) {
          updates.category = mockSuggestion.category;
          trackFieldChange('category', mockSuggestion.category, formData.category);
        }
        if (mockSuggestion.priority !== formData.priority) {
          updates.priority = mockSuggestion.priority as IncidentPriority;
          trackFieldChange('priority', mockSuggestion.priority, formData.priority);
        }
        if (mockSuggestion.impact !== formData.impact) {
          updates.impact = mockSuggestion.impact as IncidentImpact;
          trackFieldChange('impact', mockSuggestion.impact, formData.impact);
        }

        // Add new tags that aren't already present
        const newTags = mockSuggestion.suggestedTags.filter(tag => !formData.tags.includes(tag));
        if (newTags.length > 0) {
          const updatedTags = [...formData.tags, ...newTags];
          updates.tags = updatedTags;
          trackFieldChange('tags', updatedTags, formData.tags);
        }

        setFormData(prev => ({ ...prev, ...updates }));
        setAISuggestionLoading(false);
      }, 1500);
    } catch (error) {
      console.error('AI suggestion failed:', error);
      setAISuggestionLoading(false);
    }
  }, [formData.title, formData.description, formData.category, formData.priority, formData.impact, formData.tags, trackFieldChange]);

  // Handle incident treatment
  const handleTreatIncident = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Mark treatment as started and update status
      const treatmentData: Partial<IncidentData> = {
        status: 'em_tratamento',
        treatment_started_at: new Date(),
        treatment_analysis: formData.treatment_analysis,
        actions_taken: formData.actions_taken,
        next_steps: formData.next_steps,
        treatment_notes: formData.treatment_notes
      };

      // Track the treatment fields as changed
      Object.keys(treatmentData).forEach(field => {
        trackFieldChange(field, (treatmentData as any)[field], (originalData as any)[field]);
      });

      // Update form data
      setFormData(prev => ({ ...prev, ...treatmentData }));

      // Build audit info for treatment
      const auditInfo: AuditInfo = {
        changedFields: ['status', 'treatment_started_at', 'treatment_analysis', 'actions_taken', 'next_steps'],
        changeReason: 'Início do tratamento do incidente',
        changedBy: 'current-user', // This should come from auth context
        previousValues: {
          status: originalData.status,
          treatment_started_at: originalData.treatment_started_at,
          treatment_analysis: originalData.treatment_analysis,
          actions_taken: originalData.actions_taken,
          next_steps: originalData.next_steps
        },
        newValues: treatmentData,
        timestamp: new Date(),
        requiresApproval: false,
        criticalChange: true
      };

      await onSubmit(incident.id, treatmentData, auditInfo);
      setTreatmentStarted(true);
      onClose();
    } catch (error) {
      console.error('Error starting incident treatment:', error);
      onError?.(error as Error);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, originalData, incident.id, validateForm, trackFieldChange, onSubmit, onClose, onError]);

  // Generate AI proposal for resolution
  const handleGenerateAIProposal = useCallback(async () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      setProposalError('Título e descrição são obrigatórios para gerar proposta com IA');
      return;
    }

    setGeneratingProposal(true);
    setProposalError(null);

    try {
      // Mock AI proposal generation - in production, this would call the AIResolverService
      // const aiResolverService = new AIResolverService(incidentService, aiService);
      // const proposal = await aiResolverService.generateResolutionProposal(formData);

      // Mock proposal for demonstration
      setTimeout(() => {
        const mockProposal: AIProposal = {
          id: `proposal-${Date.now()}`,
          confidence: 0.85,
          estimated_resolution_time: '2-4 horas',
          risk_level: 'medio',
          analysis: `Análise automática do incidente "${formData.title}" indica problema similar a casos anteriores na categoria ${formData.category}.

Baseado em 8 incidentes similares com 87% de taxa de sucesso, o problema parece estar relacionado a configuração ou falha de componente específico.

Recomenda-se verificação inicial dos logs do sistema e aplicação de correção padrão conforme procedimentos já validados.`,

          actions_taken: `1. Verificar logs do sistema para identificar erros específicos
2. Analisar configurações atuais vs. configurações padrão
3. Executar script de diagnóstico automático
4. Aplicar correção baseada em padrão identificado
5. Realizar teste de funcionalidade após correção`,

          next_steps: `1. Monitorar sistema por 1 hora após aplicação da correção
2. Validar funcionamento com usuários afetados
3. Documentar solução aplicada para referência futura
4. Agendar revisão preventiva em 30 dias`,

          treatment_notes: `Proposta baseada em análise de 8 casos similares. Taxa de sucesso histórica: 87%.
Tempo médio de resolução: 2.5 horas. Recomenda-se execução durante horário comercial para facilitar validação com usuários.`,

          reasoning: `Esta proposta foi gerada analisando incidentes similares com características parecidas:
- Mesma categoria (${formData.category})
- Sintomas similares no título/descrição
- Histórico de resoluções bem-sucedidas
- Tempo de resolução médio compatível com SLA`,

          success_probability: 0.87,
          generated_at: new Date()
        };

        setAIProposal(mockProposal);
        setShowProposal(true);
        setGeneratingProposal(false);
      }, 2500);

    } catch (error) {
      console.error('Error generating AI proposal:', error);
      setProposalError('Erro ao gerar proposta com IA. Tente novamente.');
      setGeneratingProposal(false);
    }
  }, [formData.title, formData.description, formData.category]);

  // Accept AI proposal
  const handleAcceptProposal = useCallback(() => {
    if (!aiProposal) return;

    // Auto-fill treatment fields with AI proposal
    const treatmentData = {
      treatment_analysis: aiProposal.analysis,
      actions_taken: aiProposal.actions_taken,
      next_steps: aiProposal.next_steps,
      treatment_notes: aiProposal.treatment_notes || ''
    };

    // Update form data
    setFormData(prev => ({ ...prev, ...treatmentData }));

    // Track changes
    Object.entries(treatmentData).forEach(([field, value]) => {
      trackFieldChange(field, value, (formData as any)[field]);
    });

    setShowProposal(false);

    // Show treatment section if not already shown
    if (!showTreatmentSection) {
      setShowTreatmentSection(true);
    }
  }, [aiProposal, formData, trackFieldChange, showTreatmentSection]);

  // Reject AI proposal
  const handleRejectProposal = useCallback(() => {
    setShowProposal(false);
    setAIProposal(null);
  }, []);

  // Check if incident can be treated
  const canTreatIncident = () => {
    return formData.status !== 'fechado' && formData.status !== 'resolvido';
  };

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || isSubmitting) {
      return;
    }

    if (changedFields.size === 0) {
      onError?.(new Error('Nenhuma alteração foi feita no incidente'));
      return;
    }

    // Check if critical changes require confirmation
    if (criticalChange && !showConfirmDialog) {
      setPendingChanges(formData);
      setShowConfirmDialog(true);
      return;
    }

    setIsSubmitting(true);

    try {
      // Build changes object with only modified fields
      const changes: Partial<IncidentData> = {};
      changedFields.forEach(field => {
        (changes as any)[field] = (formData as any)[field];
      });

      // Build audit info
      const auditInfo: AuditInfo = {
        changedFields: Array.from(changedFields),
        changeReason: changeReason.trim() || 'Atualização de incidente',
        changedBy: 'current-user', // This should come from auth context
        previousValues: {},
        newValues: {},
        timestamp: new Date(),
        requiresApproval: criticalChange,
        criticalChange
      };

      // Populate audit values
      changedFields.forEach(field => {
        auditInfo.previousValues[field] = (originalData as any)[field];
        auditInfo.newValues[field] = (formData as any)[field];
      });

      await onSubmit(incident.id, changes, auditInfo);
      setShowConfirmDialog(false);
      setPendingChanges(null);
      onClose();
    } catch (error) {
      console.error('Error updating incident:', error);
      onError?.(error as Error);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, originalData, incident.id, validateForm, isSubmitting, changedFields, criticalChange, changeReason, showConfirmDialog, onSubmit, onClose, onError]);

  // Handle input changes
  const handleInputChange = useCallback((field: keyof IncidentData, value: any) => {
    const oldValue = (formData as any)[field];
    setFormData(prev => ({ ...prev, [field]: value }));
    trackFieldChange(field, value, oldValue);

    // Clear validation error for this field
    if (validationErrors[field as keyof ValidationErrors]) {
      setValidationErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }, [formData, trackFieldChange, validationErrors]);

  // Tag management
  const handleAddTag = useCallback((tag: string) => {
    const trimmedTag = tag.trim().toLowerCase();
    if (trimmedTag && !formData.tags.includes(trimmedTag) && formData.tags.length < 10) {
      const newTags = [...formData.tags, trimmedTag];
      handleInputChange('tags', newTags);
      setTagInput('');
      setShowTagSuggestions(false);
    }
  }, [formData.tags, handleInputChange]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    const newTags = formData.tags.filter(tag => tag !== tagToRemove);
    handleInputChange('tags', newTags);
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

  // Get available status transitions
  const getAvailableStatusTransitions = () => {
    return STATUS_TRANSITIONS[formData.status] || [];
  };

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

  // Render field change indicator
  const renderFieldChangeIndicator = (fieldName: string) => {
    const isChanged = changedFields.has(fieldName);
    const change = fieldChanges.find(c => c.field === fieldName);

    if (!isChanged) return null;

    return (
      <div className="flex items-center space-x-1 text-xs">
        <Diff className="h-3 w-3 text-blue-600" />
        <span className="text-blue-600">Alterado</span>
        {change?.critical && (
          <AlertTriangle className="h-3 w-3 text-orange-500" title="Alteração crítica" />
        )}
      </div>
    );
  };

  // Render confirmation dialog
  const renderConfirmDialog = () => {
    if (!showConfirmDialog || !pendingChanges) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Confirmar Alterações Críticas</h3>
              <p className="text-sm text-gray-600">
                As seguintes alterações críticas serão aplicadas:
              </p>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            {fieldChanges.filter(c => c.critical).map((change, index) => (
              <div key={index} className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">
                    {change.field === 'status' ? 'Status' :
                     change.field === 'priority' ? 'Prioridade' :
                     change.field === 'category' ? 'Categoria' :
                     change.field === 'assigned_to' ? 'Responsável' :
                     change.field}
                  </span>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                </div>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-sm text-gray-600 bg-white px-2 py-1 rounded">
                    {String(change.oldValue)}
                  </span>
                  <ArrowRight className="h-3 w-3 text-gray-400" />
                  <span className="text-sm text-gray-900 bg-blue-100 px-2 py-1 rounded font-medium">
                    {String(change.newValue)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex space-x-3">
            <button
              onClick={() => {
                setShowConfirmDialog(false);
                setPendingChanges(null);
              }}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin inline" />
                  Aplicando...
                </>
              ) : (
                'Confirmar Alterações'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Modal open={isOpen} onOpenChange={onClose}>
        <ModalContent size="4xl" open={isOpen} className="max-h-[95vh] overflow-hidden">
          <ModalHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <Edit className="h-5 w-5 text-white" />
                </div>
                <div>
                  <ModalTitle className="text-xl font-semibold text-gray-900">
                    Editar Incidente
                  </ModalTitle>
                  <ModalDescription className="text-sm text-gray-600">
                    {incident.id} - Atualizar informações do incidente
                  </ModalDescription>
                </div>
              </div>
              <div className="text-xs text-gray-500 text-right">
                <div className="font-medium">#{incident.id}</div>
                <div>Criado: {incident.created_at.toLocaleDateString('pt-BR')}</div>
                <div>Atualizado: {incident.updated_at.toLocaleDateString('pt-BR')}</div>
              </div>
            </div>
            <ModalClose />
          </ModalHeader>

          <ModalBody className="overflow-y-auto px-6">
            {/* Change Summary */}
            {changedFields.size > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Activity className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">
                      Alterações Pendentes ({changedFields.size})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAuditTrail(!showAuditTrail)}
                    className="text-xs text-blue-700 hover:text-blue-800"
                  >
                    {showAuditTrail ? 'Ocultar' : 'Ver'} Detalhes
                  </button>
                </div>

                {showAuditTrail && (
                  <div className="mt-3 space-y-2">
                    {fieldChanges.map((change, index) => (
                      <div key={index} className="flex items-center justify-between text-xs bg-white rounded p-2">
                        <span className="font-medium">{change.field}</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-600">{String(change.oldValue)}</span>
                          <ArrowRight className="h-3 w-3" />
                          <span className="text-blue-700 font-medium">{String(change.newValue)}</span>
                          {change.critical && <Shield className="h-3 w-3 text-orange-500" />}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
              {/* AI Suggestion Button */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Brain className="h-5 w-5 text-purple-600" />
                    <span className="text-sm font-medium text-purple-900">
                      Sugestão Inteligente de Recategorização
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAISuggestion}
                    disabled={aiSuggestionLoading || (!formData.title.trim() && !formData.description.trim())}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-100 border border-purple-300 rounded-md hover:bg-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                  >
                    {aiSuggestionLoading ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Analisando...
                      </>
                    ) : (
                      <>
                        <Brain className="h-3 w-3 mr-1" />
                        Sugerir Melhorias
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-purple-700 mt-1">
                  A IA analisará as alterações para sugerir melhorias na classificação
                </p>
              </div>

              {/* Title Field */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                    Título <span className="text-red-500">*</span>
                  </label>
                  {renderFieldChangeIndicator('title')}
                </div>
                <input
                  id="title"
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Descrição breve do incidente"
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    validationErrors.title ? 'border-red-300' :
                    changedFields.has('title') ? 'border-blue-300 bg-blue-50' : 'border-gray-300'
                  }`}
                  maxLength={200}
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
                  <div className="flex items-center justify-between">
                    <label htmlFor="priority" className="block text-sm font-medium text-gray-700">
                      <TrendingUp className="inline h-4 w-4 mr-1" />
                      Prioridade
                    </label>
                    {renderFieldChangeIndicator('priority')}
                  </div>
                  <select
                    id="priority"
                    value={formData.priority}
                    onChange={(e) => handleInputChange('priority', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      changedFields.has('priority') ? 'border-blue-300 bg-blue-50' : 'border-gray-300'
                    }`}
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
                  <div className="flex items-center justify-between">
                    <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                      Status
                    </label>
                    {renderFieldChangeIndicator('status')}
                  </div>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      changedFields.has('status') ? 'border-blue-300 bg-blue-50' : 'border-gray-300'
                    }`}
                  >
                    {STATUS_OPTIONS.map(status => {
                      const isValid = status.value === formData.status || STATUS_TRANSITIONS[originalData.status]?.includes(status.value);
                      return (
                        <option key={status.value} value={status.value} disabled={!isValid}>
                          {status.label} {!isValid ? '(Transição inválida)' : ''}
                        </option>
                      );
                    })}
                  </select>
                  <p className="text-xs text-gray-500">
                    {STATUS_OPTIONS.find(s => s.value === formData.status)?.description}
                  </p>
                </div>

                {/* Impact Field */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="impact" className="block text-sm font-medium text-gray-700">
                      Impacto
                    </label>
                    {renderFieldChangeIndicator('impact')}
                  </div>
                  <select
                    id="impact"
                    value={formData.impact}
                    onChange={(e) => handleInputChange('impact', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      changedFields.has('impact') ? 'border-blue-300 bg-blue-50' : 'border-gray-300'
                    }`}
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
                <div className="flex items-center justify-between">
                  <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                    <FileText className="inline h-4 w-4 mr-1" />
                    Categoria <span className="text-red-500">*</span>
                  </label>
                  {renderFieldChangeIndicator('category')}
                </div>
                <select
                  id="category"
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    changedFields.has('category') ? 'border-blue-300 bg-blue-50' : 'border-gray-300'
                  }`}
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
                  <div className="flex items-center justify-between">
                    <label htmlFor="affected_system" className="block text-sm font-medium text-gray-700">
                      Sistema Afetado <span className="text-red-500">*</span>
                    </label>
                    {renderFieldChangeIndicator('affected_system')}
                  </div>
                  <input
                    id="affected_system"
                    type="text"
                    value={formData.affected_system}
                    onChange={(e) => handleInputChange('affected_system', e.target.value)}
                    placeholder="Ex: CICS Produção, DB2 Subsystem, Batch Jobs"
                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      validationErrors.affected_system ? 'border-red-300' :
                      changedFields.has('affected_system') ? 'border-blue-300 bg-blue-50' : 'border-gray-300'
                    }`}
                  />
                  {validationErrors.affected_system && (
                    <span className="text-sm text-red-600">{validationErrors.affected_system}</span>
                  )}
                </div>

                {/* Assigned To */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="assigned_to" className="block text-sm font-medium text-gray-700">
                      <User className="inline h-4 w-4 mr-1" />
                      Atribuído Para
                    </label>
                    {renderFieldChangeIndicator('assigned_to')}
                  </div>
                  <input
                    id="assigned_to"
                    type="text"
                    value={formData.assigned_to}
                    onChange={(e) => handleInputChange('assigned_to', e.target.value)}
                    placeholder="Nome do responsável"
                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      changedFields.has('assigned_to') ? 'border-blue-300 bg-blue-50' : 'border-gray-300'
                    }`}
                  />
                </div>
              </div>

              {/* Reported By and Date Row */}
              <div className="grid grid-cols-2 gap-4">
                {/* Reported By */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="reported_by" className="block text-sm font-medium text-gray-700">
                      Reportado Por <span className="text-red-500">*</span>
                    </label>
                    {renderFieldChangeIndicator('reported_by')}
                  </div>
                  <input
                    id="reported_by"
                    type="text"
                    value={formData.reported_by}
                    onChange={(e) => handleInputChange('reported_by', e.target.value)}
                    placeholder="Nome do usuário que reportou"
                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      validationErrors.reported_by ? 'border-red-300' :
                      changedFields.has('reported_by') ? 'border-blue-300 bg-blue-50' : 'border-gray-300'
                    }`}
                  />
                  {validationErrors.reported_by && (
                    <span className="text-sm text-red-600">{validationErrors.reported_by}</span>
                  )}
                </div>

                {/* Incident Date */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="incident_date" className="block text-sm font-medium text-gray-700">
                      <Calendar className="inline h-4 w-4 mr-1" />
                      Data do Incidente
                    </label>
                    {renderFieldChangeIndicator('incident_date')}
                  </div>
                  <input
                    id="incident_date"
                    type="date"
                    value={formData.incident_date}
                    onChange={(e) => handleInputChange('incident_date', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      changedFields.has('incident_date') ? 'border-blue-300 bg-blue-50' : 'border-gray-300'
                    }`}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                    Descrição Detalhada <span className="text-red-500">*</span>
                  </label>
                  {renderFieldChangeIndicator('description')}
                </div>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Descreva o incidente em detalhes..."
                  rows={5}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y ${
                    validationErrors.description ? 'border-red-300' :
                    changedFields.has('description') ? 'border-blue-300 bg-blue-50' : 'border-gray-300'
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
              </div>

              {/* Tags Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="tagInput" className="block text-sm font-medium text-gray-700">
                    <Tag className="inline h-4 w-4 mr-1" />
                    Tags ({formData.tags.length}/10)
                  </label>
                  {renderFieldChangeIndicator('tags')}
                </div>
                <div className="relative">
                  <input
                    ref={tagInputRef}
                    id="tagInput"
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyPress}
                    placeholder="Adicione palavras-chave (pressione Enter)"
                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      changedFields.has('tags') ? 'border-blue-300 bg-blue-50' : 'border-gray-300'
                    }`}
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
                        className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-1 hover:text-blue-600 focus:outline-none"
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
              </div>

              {/* Treatment Section */}
              {canTreatIncident() && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <Wrench className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-green-900">
                          Tratar Incidente
                        </h3>
                        <p className="text-xs text-green-700">
                          Inicie o tratamento deste incidente preenchendo as informações abaixo
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {/* AI Proposal Button */}
                      <button
                        type="button"
                        onClick={handleGenerateAIProposal}
                        disabled={generatingProposal || !formData.title.trim() || !formData.description.trim()}
                        className="flex items-center px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-100 border border-purple-300 rounded-md hover:bg-purple-200 disabled:opacity-50"
                      >
                        {generatingProposal ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Gerando...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3 w-3 mr-1" />
                            Gerar Proposta com IA
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowTreatmentSection(!showTreatmentSection)}
                        className="flex items-center px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 border border-green-300 rounded-md hover:bg-green-200"
                      >
                        {showTreatmentSection ? (
                          <>
                            <ChevronUp className="h-3 w-3 mr-1" />
                            Ocultar
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3 w-3 mr-1" />
                            Mostrar
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Error message for AI proposal */}
                  {proposalError && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-3">
                      <div className="flex items-center">
                        <XCircle className="h-4 w-4 text-red-600 mr-2" />
                        <span className="text-sm text-red-800">{proposalError}</span>
                      </div>
                    </div>
                  )}

                  {/* AI Proposal Display */}
                  {showProposal && aiProposal && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="p-2 bg-purple-100 rounded-lg">
                            <Lightbulb className="h-5 w-5 text-purple-600" />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-purple-900">
                              Proposta de Resolução Gerada por IA
                            </h4>
                            <div className="flex items-center space-x-4 text-xs text-purple-700 mt-1">
                              <span className="flex items-center">
                                <Target className="h-3 w-3 mr-1" />
                                Confiança: {Math.round(aiProposal.confidence * 100)}%
                              </span>
                              <span className="flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                Tempo estimado: {aiProposal.estimated_resolution_time}
                              </span>
                              <span className="flex items-center">
                                <Shield className={`h-3 w-3 mr-1 ${
                                  aiProposal.risk_level === 'baixo' ? 'text-green-600' :
                                  aiProposal.risk_level === 'medio' ? 'text-yellow-600' : 'text-red-600'
                                }`} />
                                Risco: {aiProposal.risk_level}
                              </span>
                              <span className="flex items-center">
                                <TrendingDown className="h-3 w-3 mr-1" />
                                Sucesso: {Math.round(aiProposal.success_probability * 100)}%
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowProposal(false)}
                          className="text-purple-600 hover:text-purple-800"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {/* AI Proposal Content */}
                      <div className="space-y-3">
                        {/* Analysis */}
                        <div className="bg-white rounded-md p-3">
                          <h5 className="text-xs font-medium text-gray-700 mb-2">Análise do Problema:</h5>
                          <p className="text-sm text-gray-900 whitespace-pre-line">{aiProposal.analysis}</p>
                        </div>

                        {/* Actions */}
                        <div className="bg-white rounded-md p-3">
                          <h5 className="text-xs font-medium text-gray-700 mb-2">Ações Recomendadas:</h5>
                          <p className="text-sm text-gray-900 whitespace-pre-line">{aiProposal.actions_taken}</p>
                        </div>

                        {/* Next Steps */}
                        <div className="bg-white rounded-md p-3">
                          <h5 className="text-xs font-medium text-gray-700 mb-2">Próximos Passos:</h5>
                          <p className="text-sm text-gray-900 whitespace-pre-line">{aiProposal.next_steps}</p>
                        </div>

                        {/* Reasoning */}
                        <div className="bg-white rounded-md p-3">
                          <h5 className="text-xs font-medium text-gray-700 mb-2">Justificativa:</h5>
                          <p className="text-sm text-gray-600 whitespace-pre-line">{aiProposal.reasoning}</p>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex justify-end space-x-3 pt-3 border-t border-purple-200">
                        <button
                          type="button"
                          onClick={handleRejectProposal}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Rejeitar
                        </button>
                        <button
                          type="button"
                          onClick={handleAcceptProposal}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Aceitar e Preencher
                        </button>
                      </div>
                    </div>
                  )}

                  {showTreatmentSection && (
                    <div className="space-y-4 mt-4">
                      {/* Treatment Analysis */}
                      <div className="space-y-2">
                        <label htmlFor="treatment_analysis" className="block text-sm font-medium text-gray-700">
                          <ClipboardList className="inline h-4 w-4 mr-1" />
                          Análise do Problema <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          id="treatment_analysis"
                          value={formData.treatment_analysis || ''}
                          onChange={(e) => handleInputChange('treatment_analysis', e.target.value)}
                          placeholder="Descreva sua análise inicial do problema, possíveis causas e impactos identificados..."
                          rows={3}
                          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                            validationErrors.treatment_analysis ? 'border-red-300' :
                            changedFields.has('treatment_analysis') ? 'border-green-300 bg-green-50' : 'border-gray-300'
                          }`}
                          maxLength={2000}
                        />
                        {validationErrors.treatment_analysis && (
                          <span className="text-sm text-red-600 flex items-center">
                            <AlertTriangle className="h-4 w-4 mr-1" />
                            {validationErrors.treatment_analysis}
                          </span>
                        )}
                      </div>

                      {/* Actions Taken */}
                      <div className="space-y-2">
                        <label htmlFor="actions_taken" className="block text-sm font-medium text-gray-700">
                          <Activity className="inline h-4 w-4 mr-1" />
                          Ações Tomadas <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          id="actions_taken"
                          value={formData.actions_taken || ''}
                          onChange={(e) => handleInputChange('actions_taken', e.target.value)}
                          placeholder="Liste as ações já realizadas ou que serão executadas imediatamente..."
                          rows={3}
                          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                            validationErrors.actions_taken ? 'border-red-300' :
                            changedFields.has('actions_taken') ? 'border-green-300 bg-green-50' : 'border-gray-300'
                          }`}
                          maxLength={2000}
                        />
                        {validationErrors.actions_taken && (
                          <span className="text-sm text-red-600 flex items-center">
                            <AlertTriangle className="h-4 w-4 mr-1" />
                            {validationErrors.actions_taken}
                          </span>
                        )}
                      </div>

                      {/* Next Steps */}
                      <div className="space-y-2">
                        <label htmlFor="next_steps" className="block text-sm font-medium text-gray-700">
                          <ArrowUpRight className="inline h-4 w-4 mr-1" />
                          Próximos Passos <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          id="next_steps"
                          value={formData.next_steps || ''}
                          onChange={(e) => handleInputChange('next_steps', e.target.value)}
                          placeholder="Defina os próximos passos para resolução do incidente..."
                          rows={3}
                          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                            validationErrors.next_steps ? 'border-red-300' :
                            changedFields.has('next_steps') ? 'border-green-300 bg-green-50' : 'border-gray-300'
                          }`}
                          maxLength={1000}
                        />
                        {validationErrors.next_steps && (
                          <span className="text-sm text-red-600 flex items-center">
                            <AlertTriangle className="h-4 w-4 mr-1" />
                            {validationErrors.next_steps}
                          </span>
                        )}
                      </div>

                      {/* Treatment Notes (Optional) */}
                      <div className="space-y-2">
                        <label htmlFor="treatment_notes" className="block text-sm font-medium text-gray-700">
                          <MessageSquare className="inline h-4 w-4 mr-1" />
                          Observações do Tratamento (Opcional)
                        </label>
                        <textarea
                          id="treatment_notes"
                          value={formData.treatment_notes || ''}
                          onChange={(e) => handleInputChange('treatment_notes', e.target.value)}
                          placeholder="Observações adicionais sobre o tratamento..."
                          rows={2}
                          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                            changedFields.has('treatment_notes') ? 'border-green-300 bg-green-50' : 'border-gray-300'
                          }`}
                          maxLength={1000}
                        />
                      </div>

                      {/* Treatment Action Button */}
                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          onClick={handleTreatIncident}
                          disabled={isSubmitting || !formData.treatment_analysis?.trim() || !formData.actions_taken?.trim() || !formData.next_steps?.trim()}
                          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Iniciando Tratamento...
                            </>
                          ) : (
                            <>
                              <Wrench className="h-4 w-4 mr-2" />
                              Iniciar Tratamento
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Status Alert for Closed/Resolved Incidents */}
              {!canTreatIncident() && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">
                      Incidente {formData.status === 'fechado' ? 'Fechado' : 'Resolvido'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Este incidente não pode ser tratado pois já está {formData.status === 'fechado' ? 'fechado' : 'resolvido'}.
                  </p>
                </div>
              )}

              {/* Change Reason (required for critical changes) */}
              {criticalChange && (
                <div className="space-y-2">
                  <label htmlFor="change_reason" className="block text-sm font-medium text-gray-700">
                    <MessageSquare className="inline h-4 w-4 mr-1" />
                    Motivo da Alteração <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="change_reason"
                    value={changeReason}
                    onChange={(e) => setChangeReason(e.target.value)}
                    placeholder="Descreva o motivo das alterações críticas..."
                    rows={3}
                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
                      validationErrors.change_reason ? 'border-red-300' : 'border-orange-300'
                    }`}
                    maxLength={500}
                  />
                  {validationErrors.change_reason && (
                    <span className="text-sm text-red-600 flex items-center">
                      <AlertTriangle className="h-4 w-4 mr-1" />
                      {validationErrors.change_reason}
                    </span>
                  )}
                  <p className="text-xs text-orange-600 flex items-center">
                    <FileWarning className="h-3 w-3 mr-1" />
                    Alterações críticas requerem justificativa e podem necessitar aprovação
                  </p>
                </div>
              )}
            </form>
          </ModalBody>

          <ModalFooter>
            <div className="flex justify-between items-center w-full">
              <div className="text-xs text-gray-500">
                {changedFields.size > 0 ? (
                  <span className="text-blue-600">
                    {changedFields.size} campo(s) alterado(s)
                  </span>
                ) : (
                  'Nenhuma alteração feita'
                )}
              </div>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormData({ ...originalData });
                    setChangedFields(new Set());
                    setFieldChanges([]);
                    setChangeReason('');
                    setCriticalChange(false);
                  }}
                  disabled={isSubmitting || changedFields.size === 0}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reverter
                </button>
                {/* Treatment Button (if treatment section is shown and valid) */}
                {showTreatmentSection && canTreatIncident() && (
                  <button
                    type="button"
                    onClick={handleTreatIncident}
                    disabled={isSubmitting || !formData.treatment_analysis?.trim() || !formData.actions_taken?.trim() || !formData.next_steps?.trim()}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Tratando...
                      </>
                    ) : (
                      <>
                        <Wrench className="h-4 w-4 mr-2" />
                        Tratar Incidente
                      </>
                    )}
                  </button>
                )}
                <button
                  type="submit"
                  onClick={handleSubmit}
                  disabled={isSubmitting || loading || changedFields.size === 0}
                  className={`inline-flex items-center px-4 py-2 text-sm font-medium text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${
                    criticalChange
                      ? 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-500'
                      : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      {criticalChange ? 'Salvar Alterações Críticas' : 'Salvar Alterações'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Confirmation Dialog */}
      {renderConfirmDialog()}
    </>
  );
};

export default EditIncidentModal;