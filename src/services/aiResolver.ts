/**
 * AI Resolver Service
 * Provides intelligent resolution proposals based on historical incidents and patterns
 */

import { IncidentService } from './IncidentService';
import { IncidentAIService } from './IncidentAIService';
import type { KBEntry } from '../database/KnowledgeDB';

export interface SimilarIncident {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  status: string;
  resolution?: string;
  resolution_type?: string;
  root_cause?: string;
  resolution_time_hours?: number;
  success_rate: number;
  similarity_score: number;
  actions_taken?: string;
  next_steps?: string;
  treatment_analysis?: string;
}

export interface ResolutionPattern {
  pattern_name: string;
  frequency: number;
  success_rate: number;
  average_resolution_time: number;
  common_actions: string[];
  risk_factors: string[];
  prerequisites: string[];
}

export interface ResolutionProposal {
  id: string;
  confidence: number;
  estimated_resolution_time: string;
  risk_level: 'baixo' | 'medio' | 'alto';

  // Análise baseada em incidentes similares
  similar_incidents: SimilarIncident[];
  resolution_patterns: ResolutionPattern[];

  // Proposta de resolução
  analysis: string;
  actions_taken: string;
  next_steps: string;
  treatment_notes?: string;

  // Métricas e justificativas
  reasoning: string;
  success_probability: number;
  alternative_approaches: Array<{
    description: string;
    estimated_time: string;
    risk_level: 'baixo' | 'medio' | 'alto';
    confidence: number;
  }>;

  // Metadata
  generated_at: Date;
  generated_by: string;
  ai_model_version: string;
}

export interface ResolutionGenerationOptions {
  max_similar_incidents?: number;
  min_similarity_threshold?: number;
  include_in_progress?: boolean;
  prefer_recent?: boolean;
  category_filter?: string[];
  time_range_days?: number;
}

/**
 * Service for generating AI-powered resolution proposals
 */
export class AIResolverService {
  private incidentService: IncidentService;
  private aiService: IncidentAIService;

  constructor(incidentService: IncidentService, aiService: IncidentAIService) {
    this.incidentService = incidentService;
    this.aiService = aiService;
  }

  /**
   * Generate a comprehensive resolution proposal based on current incident and historical data
   */
  async generateResolutionProposal(
    currentIncident: Partial<KBEntry> & { id?: string; title: string; description: string; category?: string },
    options: ResolutionGenerationOptions = {}
  ): Promise<ResolutionProposal> {
    const {
      max_similar_incidents = 10,
      min_similarity_threshold = 0.6,
      include_in_progress = true,
      prefer_recent = true,
      time_range_days = 365
    } = options;

    try {
      // 1. Find similar incidents from historical data
      const similarIncidents = await this.findSimilarIncidents(currentIncident, {
        maxResults: max_similar_incidents,
        minSimilarity: min_similarity_threshold,
        includeInProgress: include_in_progress,
        timeRangeDays: time_range_days
      });

      // 2. Analyze resolution patterns
      const resolutionPatterns = await this.analyzeResolutionPatterns(similarIncidents, currentIncident.category);

      // 3. Calculate metrics
      const metrics = this.calculateResolutionMetrics(similarIncidents);

      // 4. Generate AI-powered proposal
      const aiProposal = await this.generateAIProposal(currentIncident, similarIncidents, resolutionPatterns);

      // 5. Build comprehensive proposal
      const proposal: ResolutionProposal = {
        id: `resolution-${Date.now()}`,
        confidence: aiProposal.confidence,
        estimated_resolution_time: metrics.averageResolutionTime,
        risk_level: this.assessRiskLevel(metrics, aiProposal),

        similar_incidents: similarIncidents,
        resolution_patterns: resolutionPatterns,

        analysis: aiProposal.analysis,
        actions_taken: aiProposal.actions_taken,
        next_steps: aiProposal.next_steps,
        treatment_notes: aiProposal.treatment_notes,

        reasoning: aiProposal.reasoning,
        success_probability: metrics.successRate,
        alternative_approaches: aiProposal.alternatives,

        generated_at: new Date(),
        generated_by: 'AI-Resolver-v1.0',
        ai_model_version: '1.0.0'
      };

      return proposal;

    } catch (error) {
      console.error('Error generating resolution proposal:', error);

      // Return fallback proposal
      return this.getFallbackProposal(currentIncident);
    }
  }

  /**
   * Find similar incidents based on semantic analysis and categorization
   */
  private async findSimilarIncidents(
    currentIncident: Partial<KBEntry> & { title: string; description: string; category?: string },
    options: {
      maxResults: number;
      minSimilarity: number;
      includeInProgress: boolean;
      timeRangeDays: number;
    }
  ): Promise<SimilarIncident[]> {
    try {
      // Use existing AI service to find related incidents
      const kbEntry: KBEntry = {
        id: currentIncident.id || 'temp-id',
        title: currentIncident.title,
        problem: currentIncident.description,
        solution: '',
        category: currentIncident.category || 'Other',
        tags: '',
        created_at: '',
        updated_at: '',
        created_by: '',
        priority: 'medium',
        status: 'open',
        difficulty: 'medium',
        time_to_resolve: 0,
        resolution_count: 0,
        last_used_at: null,
        helpful_count: 0,
        not_helpful_count: 0,
        category_confidence: 0,
        search_vector: '',
        incident_id: currentIncident.id,
        incident_status: 'aberto'
      };

      const relatedIncidents = await this.aiService.findRelatedIncidents(kbEntry, {
        maxResults: options.maxResults,
        minSimilarity: options.minSimilarity,
        includeResolved: true
      });

      // Convert to SimilarIncident format
      const similarIncidents: SimilarIncident[] = [];

      for (const related of relatedIncidents) {
        // Mock getting full incident data - in real implementation,
        // you'd query the database for complete incident information
        const similarity: SimilarIncident = {
          id: related.entry.incident_id || related.entry.id,
          title: related.entry.title,
          description: related.entry.problem,
          category: related.entry.category,
          severity: this.mapPriorityToSeverity(related.entry.priority),
          status: related.entry.incident_status || 'unknown',
          resolution: related.entry.solution,
          resolution_type: 'manual',
          resolution_time_hours: related.entry.time_to_resolve,
          success_rate: this.calculateSuccessRate(related.entry),
          similarity_score: related.similarity,
          actions_taken: this.extractActionsFromSolution(related.entry.solution),
          next_steps: this.extractNextStepsFromSolution(related.entry.solution),
          treatment_analysis: this.extractAnalysisFromSolution(related.entry.solution)
        };

        similarIncidents.push(similarity);
      }

      return similarIncidents.sort((a, b) => b.similarity_score - a.similarity_score);

    } catch (error) {
      console.error('Error finding similar incidents:', error);
      return [];
    }
  }

  /**
   * Analyze common resolution patterns from similar incidents
   */
  private async analyzeResolutionPatterns(
    similarIncidents: SimilarIncident[],
    category?: string
  ): Promise<ResolutionPattern[]> {
    const patterns: Map<string, ResolutionPattern> = new Map();

    for (const incident of similarIncidents) {
      const patternKey = this.identifyPattern(incident);

      if (patterns.has(patternKey)) {
        const pattern = patterns.get(patternKey)!;
        pattern.frequency += 1;
        pattern.average_resolution_time =
          (pattern.average_resolution_time + (incident.resolution_time_hours || 0)) / 2;
        pattern.success_rate = (pattern.success_rate + incident.success_rate) / 2;
      } else {
        patterns.set(patternKey, {
          pattern_name: patternKey,
          frequency: 1,
          success_rate: incident.success_rate,
          average_resolution_time: incident.resolution_time_hours || 0,
          common_actions: this.extractActions(incident),
          risk_factors: this.identifyRiskFactors(incident),
          prerequisites: this.identifyPrerequisites(incident)
        });
      }
    }

    return Array.from(patterns.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5);
  }

  /**
   * Calculate resolution metrics from historical data
   */
  private calculateResolutionMetrics(similarIncidents: SimilarIncident[]) {
    if (similarIncidents.length === 0) {
      return {
        averageResolutionTime: 'Não determinado',
        successRate: 0.5,
        confidenceLevel: 0.3
      };
    }

    const totalTime = similarIncidents.reduce((sum, inc) => sum + (inc.resolution_time_hours || 0), 0);
    const avgTimeHours = totalTime / similarIncidents.length;

    const successfulIncidents = similarIncidents.filter(inc => inc.success_rate > 0.7);
    const successRate = successfulIncidents.length / similarIncidents.length;

    return {
      averageResolutionTime: this.formatTime(avgTimeHours),
      successRate: successRate,
      confidenceLevel: Math.min(0.9, 0.5 + (similarIncidents.length * 0.05))
    };
  }

  /**
   * Generate AI-powered proposal using the AI service
   */
  private async generateAIProposal(
    currentIncident: Partial<KBEntry> & { title: string; description: string },
    similarIncidents: SimilarIncident[],
    patterns: ResolutionPattern[]
  ) {
    try {
      // Create context for AI generation
      const context = {
        incident: {
          title: currentIncident.title,
          problem: currentIncident.description,
          category: currentIncident.category || 'Other'
        } as KBEntry,
        previousAttempts: this.extractPreviousAttempts(similarIncidents),
        context: this.buildContextFromPatterns(patterns)
      };

      // Get AI suggestions
      const suggestions = await this.aiService.suggestSolution(context);

      if (suggestions.length === 0) {
        throw new Error('No AI suggestions available');
      }

      const primarySuggestion = suggestions[0];
      const alternatives = suggestions.slice(1, 4);

      return {
        confidence: primarySuggestion.confidence,
        analysis: this.buildAnalysisFromSuggestion(primarySuggestion, patterns),
        actions_taken: this.buildActionsFromSteps(primarySuggestion.steps),
        next_steps: this.buildNextStepsFromSuggestion(primarySuggestion, patterns),
        treatment_notes: this.buildTreatmentNotes(similarIncidents, patterns),
        reasoning: this.buildReasoning(primarySuggestion, similarIncidents, patterns),
        alternatives: alternatives.map(alt => ({
          description: alt.description,
          estimated_time: alt.estimatedTime,
          risk_level: alt.riskLevel,
          confidence: alt.confidence
        }))
      };

    } catch (error) {
      console.error('Error generating AI proposal:', error);
      return this.getFallbackAIProposal(currentIncident, similarIncidents, patterns);
    }
  }

  /**
   * Assess risk level based on metrics and AI analysis
   */
  private assessRiskLevel(
    metrics: { successRate: number; confidenceLevel: number },
    aiProposal: any
  ): 'baixo' | 'medio' | 'alto' {
    if (metrics.successRate > 0.8 && metrics.confidenceLevel > 0.7) {
      return 'baixo';
    } else if (metrics.successRate > 0.6 && metrics.confidenceLevel > 0.5) {
      return 'medio';
    } else {
      return 'alto';
    }
  }

  // Helper methods for data extraction and formatting

  private mapPriorityToSeverity(priority: string): string {
    const mapping: Record<string, string> = {
      'critical': 'crítica',
      'high': 'alta',
      'medium': 'média',
      'low': 'baixa'
    };
    return mapping[priority] || 'média';
  }

  private calculateSuccessRate(entry: KBEntry): number {
    if (entry.helpful_count + entry.not_helpful_count === 0) return 0.7;
    return entry.helpful_count / (entry.helpful_count + entry.not_helpful_count);
  }

  private extractActionsFromSolution(solution: string): string {
    // Extract action-oriented content from solution text
    const actionKeywords = ['execute', 'restart', 'check', 'verify', 'update', 'configure'];
    const sentences = solution.split('.').filter(sentence =>
      actionKeywords.some(keyword => sentence.toLowerCase().includes(keyword))
    );
    return sentences.slice(0, 3).join('. ') + (sentences.length > 3 ? '.' : '');
  }

  private extractNextStepsFromSolution(solution: string): string {
    // Extract next steps or follow-up actions
    const lines = solution.split('\n');
    const nextStepsLine = lines.find(line =>
      line.toLowerCase().includes('próximo') ||
      line.toLowerCase().includes('next') ||
      line.toLowerCase().includes('seguir')
    );
    return nextStepsLine || 'Acompanhar resolução e validar resultado';
  }

  private extractAnalysisFromSolution(solution: string): string {
    // Extract analytical content from solution
    const firstSentences = solution.split('.').slice(0, 2).join('.');
    return firstSentences || 'Análise baseada em padrões similares';
  }

  private identifyPattern(incident: SimilarIncident): string {
    // Simple pattern identification based on category and common terms
    const category = incident.category.toLowerCase();
    const description = incident.description.toLowerCase();

    if (description.includes('db2') || description.includes('database')) {
      return 'Database Issues';
    } else if (description.includes('performance') || description.includes('slow')) {
      return 'Performance Problems';
    } else if (description.includes('cics') || description.includes('transaction')) {
      return 'CICS Transaction Issues';
    } else if (description.includes('network') || description.includes('connection')) {
      return 'Network Connectivity';
    } else {
      return `${category} General Issues`;
    }
  }

  private extractActions(incident: SimilarIncident): string[] {
    if (!incident.actions_taken) return [];
    return incident.actions_taken.split('.').map(action => action.trim()).filter(Boolean);
  }

  private identifyRiskFactors(incident: SimilarIncident): string[] {
    const riskFactors: string[] = [];
    const text = `${incident.description} ${incident.resolution || ''}`.toLowerCase();

    if (text.includes('production') || text.includes('produção')) {
      riskFactors.push('Ambiente de produção');
    }
    if (text.includes('critical') || text.includes('crítico')) {
      riskFactors.push('Sistema crítico');
    }
    if (text.includes('data') || text.includes('dados')) {
      riskFactors.push('Risco de perda de dados');
    }

    return riskFactors;
  }

  private identifyPrerequisites(incident: SimilarIncident): string[] {
    const prerequisites: string[] = [];
    const text = `${incident.description} ${incident.resolution || ''}`.toLowerCase();

    if (text.includes('backup')) {
      prerequisites.push('Backup recente disponível');
    }
    if (text.includes('maintenance') || text.includes('window')) {
      prerequisites.push('Janela de manutenção');
    }
    if (text.includes('approval') || text.includes('aprovação')) {
      prerequisites.push('Aprovação necessária');
    }

    return prerequisites;
  }

  private formatTime(hours: number): string {
    if (hours < 1) return 'Menos de 1 hora';
    if (hours < 24) return `${Math.round(hours)} horas`;
    const days = Math.round(hours / 24);
    return `${days} dia${days > 1 ? 's' : ''}`;
  }

  private extractPreviousAttempts(similarIncidents: SimilarIncident[]): string[] {
    return similarIncidents
      .filter(inc => inc.actions_taken)
      .map(inc => inc.actions_taken!)
      .slice(0, 3);
  }

  private buildContextFromPatterns(patterns: ResolutionPattern[]): string {
    return patterns
      .map(pattern => `${pattern.pattern_name}: ${pattern.common_actions.join(', ')}`)
      .join('; ');
  }

  private buildAnalysisFromSuggestion(suggestion: any, patterns: ResolutionPattern[]): string {
    const patternContext = patterns.length > 0
      ? `Baseado em ${patterns[0].frequency} casos similares com ${Math.round(patterns[0].success_rate * 100)}% de sucesso.`
      : '';

    return `${suggestion.description} ${patternContext} Análise inicial indica que o problema pode ser resolvido seguindo os padrões identificados em incidentes similares.`;
  }

  private buildActionsFromSteps(steps: string[]): string {
    return steps.slice(0, 4).map((step, index) => `${index + 1}. ${step}`).join('\n');
  }

  private buildNextStepsFromSuggestion(suggestion: any, patterns: ResolutionPattern[]): string {
    const standardSteps = [
      'Executar ações de resolução conforme planejado',
      'Monitorar sistema para garantir estabilidade',
      'Documentar resolução para futura referência',
      'Validar com usuários afetados'
    ];

    return standardSteps.join('\n');
  }

  private buildTreatmentNotes(similarIncidents: SimilarIncident[], patterns: ResolutionPattern[]): string {
    const noteElements = [];

    if (similarIncidents.length > 0) {
      noteElements.push(`Baseado em análise de ${similarIncidents.length} incidentes similares`);
    }

    if (patterns.length > 0) {
      const topPattern = patterns[0];
      noteElements.push(`Padrão principal: ${topPattern.pattern_name} (${topPattern.frequency} ocorrências)`);
    }

    return noteElements.join('. ') + '.';
  }

  private buildReasoning(suggestion: any, similarIncidents: SimilarIncident[], patterns: ResolutionPattern[]): string {
    return `Esta proposta foi gerada analisando ${similarIncidents.length} incidentes similares e ${patterns.length} padrões de resolução. A confiança de ${Math.round(suggestion.confidence * 100)}% é baseada na similaridade com casos bem-sucedidos anteriores.`;
  }

  private getFallbackAIProposal(currentIncident: any, similarIncidents: SimilarIncident[], patterns: ResolutionPattern[]) {
    return {
      confidence: 0.5,
      analysis: 'Análise automática não disponível. Recomenda-se análise manual baseada em incidentes similares.',
      actions_taken: '1. Analisar logs e sintomas\n2. Identificar causa raiz\n3. Implementar correção\n4. Validar resolução',
      next_steps: 'Monitorar sistema e documentar resolução',
      treatment_notes: 'Proposta gerada com base em padrões gerais devido à indisponibilidade do serviço de IA.',
      reasoning: 'Proposta baseada em processos padrão de resolução de incidentes.',
      alternatives: [
        {
          description: 'Escalar para equipe especializada',
          estimated_time: '2-4 horas',
          risk_level: 'baixo' as const,
          confidence: 0.7
        }
      ]
    };
  }

  private getFallbackProposal(currentIncident: any): ResolutionProposal {
    return {
      id: `fallback-${Date.now()}`,
      confidence: 0.3,
      estimated_resolution_time: 'Não determinado',
      risk_level: 'medio',

      similar_incidents: [],
      resolution_patterns: [],

      analysis: 'Serviço de IA indisponível. Análise manual recomendada.',
      actions_taken: '1. Revisar documentação técnica\n2. Analisar logs do sistema\n3. Contactar suporte especializado',
      next_steps: 'Coletar mais informações e escalar se necessário',
      treatment_notes: 'Proposta básica gerada devido à indisponibilidade do serviço de IA.',

      reasoning: 'Proposta de fallback baseada em procedimentos padrão.',
      success_probability: 0.5,
      alternative_approaches: [],

      generated_at: new Date(),
      generated_by: 'AI-Resolver-Fallback',
      ai_model_version: '1.0.0-fallback'
    };
  }

  /**
   * Check if the AI Resolver service is available
   */
  isAvailable(): boolean {
    return this.aiService.isAvailable();
  }
}

export default AIResolverService;