/**
 * Incident AI Service
 * Specialized AI operations for incident management using existing GeminiService
 */

import { GeminiService, MatchResult } from './GeminiService';
import type { KBEntry } from '../database/KnowledgeDB';
import { INCIDENT_AI_PROMPTS } from '../config/incident-ai-prompts';

export interface IncidentAnalysisResult {
  /** Semantic analysis of the incident */
  analysis: {
    severity: 'critico' | 'alto' | 'medio' | 'baixo';
    category: string;
    confidence: number;
    keywords: string[];
    estimatedResolutionTime: string;
    businessImpact: string;
  };
  /** Similar incidents found */
  relatedIncidents: Array<{
    entry: KBEntry;
    similarity: number;
    reasoning: string;
  }>;
  /** AI-suggested solutions */
  suggestedSolutions: Array<{
    description: string;
    confidence: number;
    steps: string[];
    estimatedTime: string;
    riskLevel: 'baixo' | 'medio' | 'alto';
  }>;
  /** Expanded context for better searches */
  expandedContext: {
    semanticTerms: string[];
    synonyms: string[];
    relatedConcepts: string[];
  };
}

export interface SemanticSearchOptions {
  /** Maximum number of results */
  maxResults?: number;
  /** Minimum similarity threshold (0-1) */
  minSimilarity?: number;
  /** Focus on specific categories */
  categoryFilter?: string[];
  /** Include closed/resolved incidents */
  includeResolved?: boolean;
}

export interface SolutionSuggestionContext {
  /** Current incident details */
  incident: KBEntry;
  /** Previous attempts or actions taken */
  previousAttempts?: string[];
  /** Additional context information */
  context?: string;
  /** Urgency level */
  urgency?: 'baixa' | 'media' | 'alta' | 'critica';
}

/**
 * Incident-specific AI service that extends GeminiService capabilities
 * for incident management operations with Portuguese language support
 */
export class IncidentAIService {
  private geminiService: GeminiService;

  constructor(geminiService: GeminiService) {
    this.geminiService = geminiService;
  }

  /**
   * Perform comprehensive AI analysis of an incident
   */
  async analyzeIncident(incident: KBEntry): Promise<IncidentAnalysisResult> {
    try {
      const analysisPrompt = INCIDENT_AI_PROMPTS.ANALYSIS_TEMPLATE.replace(
        '{{title}}',
        incident.title
      )
        .replace('{{problem}}', incident.problem)
        .replace('{{category}}', incident.category || 'Other')
        .replace('{{existingSolution}}', incident.solution || 'Não há solução documentada');

      const response = await this.generateContent(analysisPrompt);
      const analysis = this.parseAnalysisResponse(response);

      // Get related incidents with semantic search
      const relatedIncidents = await this.findRelatedIncidents(incident, {
        maxResults: 5,
        minSimilarity: 0.6,
      });

      // Generate solution suggestions
      const suggestedSolutions = await this.suggestSolution({
        incident,
        urgency: this.mapSeverityToUrgency(incident.severity || 'medium'),
      });

      // Expand semantic context
      const expandedContext = await this.expandSemanticContext(
        `${incident.title} ${incident.problem}`
      );

      return {
        analysis,
        relatedIncidents,
        suggestedSolutions,
        expandedContext,
      };
    } catch (error) {
      console.error('Error analyzing incident:', error);
      return this.getFallbackAnalysis(incident);
    }
  }

  /**
   * Find semantically similar incidents using AI
   */
  async findRelatedIncidents(
    incident: KBEntry,
    options: SemanticSearchOptions = {}
  ): Promise<Array<{ entry: KBEntry; similarity: number; reasoning: string }>> {
    try {
      const {
        maxResults = 10,
        minSimilarity = 0.5,
        categoryFilter = [],
        includeResolved = true,
      } = options;

      // Create semantic search query
      const searchQuery = `${incident.title} ${incident.problem}`;

      // Use existing GeminiService but with incident-specific prompts
      const prompt = INCIDENT_AI_PROMPTS.SIMILARITY_SEARCH_TEMPLATE.replace(
        '{{searchQuery}}',
        searchQuery
      )
        .replace('{{currentCategory}}', incident.category || '')
        .replace('{{maxResults}}', maxResults.toString());

      const response = await this.generateContent(prompt);
      const similarities = this.parseSimilarityResponse(response);

      return similarities
        .filter(result => result.similarity >= minSimilarity)
        .filter(result => {
          if (!includeResolved && result.entry.incident_status === 'fechado') {
            return false;
          }
          if (categoryFilter.length > 0 && !categoryFilter.includes(result.entry.category)) {
            return false;
          }
          return true;
        })
        .slice(0, maxResults);
    } catch (error) {
      console.error('Error finding related incidents:', error);
      return [];
    }
  }

  /**
   * Generate AI-powered solution suggestions
   */
  async suggestSolution(context: SolutionSuggestionContext): Promise<
    Array<{
      description: string;
      confidence: number;
      steps: string[];
      estimatedTime: string;
      riskLevel: 'baixo' | 'medio' | 'alto';
    }>
  > {
    try {
      const {
        incident,
        previousAttempts = [],
        context: additionalContext = '',
        urgency = 'media',
      } = context;

      const prompt = INCIDENT_AI_PROMPTS.SOLUTION_SUGGESTION_TEMPLATE.replace(
        '{{title}}',
        incident.title
      )
        .replace('{{problem}}', incident.problem)
        .replace('{{category}}', incident.category || 'Other')
        .replace('{{previousAttempts}}', previousAttempts.join('\n- '))
        .replace('{{additionalContext}}', additionalContext)
        .replace('{{urgency}}', urgency);

      const response = await this.generateContent(prompt);
      return this.parseSolutionSuggestions(response);
    } catch (error) {
      console.error('Error suggesting solutions:', error);
      return this.getFallbackSolutions(context.incident);
    }
  }

  /**
   * Expand semantic context for better search results
   */
  async expandSemanticContext(text: string): Promise<{
    semanticTerms: string[];
    synonyms: string[];
    relatedConcepts: string[];
  }> {
    try {
      const prompt = INCIDENT_AI_PROMPTS.CONTEXT_EXPANSION_TEMPLATE.replace('{{text}}', text);

      const response = await this.generateContent(prompt);
      return this.parseContextExpansion(response);
    } catch (error) {
      console.error('Error expanding semantic context:', error);
      return {
        semanticTerms: [],
        synonyms: [],
        relatedConcepts: [],
      };
    }
  }

  /**
   * Check if AI service is available
   */
  isAvailable(): boolean {
    return this.geminiService !== null;
  }

  // Private helper methods

  private async generateContent(prompt: string): Promise<any> {
    // Use the existing GeminiService's private method through reflection
    // or create a public method in GeminiService for this
    return (this.geminiService as any).generateContent(prompt);
  }

  private parseAnalysisResponse(response: any): IncidentAnalysisResult['analysis'] {
    try {
      const text = this.extractTextResponse(response);
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          severity: parsed.severity || 'medio',
          category: parsed.category || 'Other',
          confidence: parsed.confidence || 0.5,
          keywords: parsed.keywords || [],
          estimatedResolutionTime: parsed.estimatedResolutionTime || 'Não estimado',
          businessImpact: parsed.businessImpact || 'Impacto não determinado',
        };
      }

      throw new Error('Could not parse analysis response');
    } catch (error) {
      return {
        severity: 'medio',
        category: 'Other',
        confidence: 0.5,
        keywords: [],
        estimatedResolutionTime: 'Não estimado',
        businessImpact: 'Análise AI não disponível',
      };
    }
  }

  private parseSimilarityResponse(response: any): Array<{
    entry: KBEntry;
    similarity: number;
    reasoning: string;
  }> {
    try {
      const text = this.extractTextResponse(response);
      const lines = text
        .trim()
        .split('\n')
        .filter(line => line.trim());

      const results: Array<{ entry: KBEntry; similarity: number; reasoning: string }> = [];

      for (const line of lines) {
        const match = line.match(/^(\d+):(\d+):(.*)$/);
        if (match) {
          const [, indexStr, similarityStr, reasoning] = match;
          const similarity = parseInt(similarityStr) / 100; // Convert to 0-1 scale

          // This would need to be implemented with actual entry lookup
          // For now, using placeholder
          const entry: KBEntry = {} as KBEntry;

          if (similarity >= 0.5) {
            results.push({
              entry,
              similarity,
              reasoning: reasoning.trim(),
            });
          }
        }
      }

      return results;
    } catch (error) {
      console.error('Error parsing similarity response:', error);
      return [];
    }
  }

  private parseSolutionSuggestions(response: any): Array<{
    description: string;
    confidence: number;
    steps: string[];
    estimatedTime: string;
    riskLevel: 'baixo' | 'medio' | 'alto';
  }> {
    try {
      const text = this.extractTextResponse(response);
      const jsonMatch = text.match(/\[[\s\S]*\]/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.map((solution: any) => ({
          description: solution.description || 'Solução sugerida',
          confidence: solution.confidence || 0.5,
          steps: solution.steps || [],
          estimatedTime: solution.estimatedTime || 'Não estimado',
          riskLevel: solution.riskLevel || 'medio',
        }));
      }

      throw new Error('Could not parse solution suggestions');
    } catch (error) {
      return [];
    }
  }

  private parseContextExpansion(response: any): {
    semanticTerms: string[];
    synonyms: string[];
    relatedConcepts: string[];
  } {
    try {
      const text = this.extractTextResponse(response);
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          semanticTerms: parsed.semanticTerms || [],
          synonyms: parsed.synonyms || [],
          relatedConcepts: parsed.relatedConcepts || [],
        };
      }

      throw new Error('Could not parse context expansion');
    } catch (error) {
      return {
        semanticTerms: [],
        synonyms: [],
        relatedConcepts: [],
      };
    }
  }

  private extractTextResponse(response: any): string {
    if (response?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return response.candidates[0].content.parts[0].text;
    }
    throw new Error('Invalid response format from Gemini API');
  }

  private mapSeverityToUrgency(severity: string): 'baixa' | 'media' | 'alta' | 'critica' {
    const mapping: Record<string, 'baixa' | 'media' | 'alta' | 'critica'> = {
      low: 'baixa',
      medium: 'media',
      high: 'alta',
      critical: 'critica',
    };
    return mapping[severity] || 'media';
  }

  private getFallbackAnalysis(incident: KBEntry): IncidentAnalysisResult {
    return {
      analysis: {
        severity: 'medio',
        category: incident.category || 'Other',
        confidence: 0.3,
        keywords: [],
        estimatedResolutionTime: 'Análise AI não disponível',
        businessImpact: 'Impacto não determinado - serviço AI indisponível',
      },
      relatedIncidents: [],
      suggestedSolutions: this.getFallbackSolutions(incident),
      expandedContext: {
        semanticTerms: [],
        synonyms: [],
        relatedConcepts: [],
      },
    };
  }

  private getFallbackSolutions(incident: KBEntry): Array<{
    description: string;
    confidence: number;
    steps: string[];
    estimatedTime: string;
    riskLevel: 'baixo' | 'medio' | 'alto';
  }> {
    return [
      {
        description: 'Consultar documentação técnica relevante',
        confidence: 0.6,
        steps: [
          'Identificar o componente ou sistema envolvido',
          'Consultar manuais técnicos específicos',
          'Verificar procedimentos padrão de troubleshooting',
        ],
        estimatedTime: '30-60 minutos',
        riskLevel: 'baixo',
      },
      {
        description: 'Contactar suporte especializado',
        confidence: 0.5,
        steps: [
          'Coletar informações detalhadas do erro',
          'Documentar passos já executados',
          'Abrir chamado com equipe especializada',
        ],
        estimatedTime: '2-4 horas',
        riskLevel: 'baixo',
      },
    ];
  }
}
