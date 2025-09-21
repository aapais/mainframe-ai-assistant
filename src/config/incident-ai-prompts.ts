/**
 * Incident AI Prompts Configuration
 * Portuguese prompts for incident analysis and management AI operations
 */

export const INCIDENT_AI_PROMPTS = {
  /**
   * Template for comprehensive incident analysis
   */
  ANALYSIS_TEMPLATE: `Você é um especialista em sistemas mainframe e gestão de incidentes. Analise o seguinte incidente e forneça uma análise detalhada em português.

DETALHES DO INCIDENTE:
Título: {{title}}
Descrição do Problema: {{problem}}
Categoria: {{category}}
Solução Existente: {{existingSolution}}

INSTRUÇÕES:
1. Avalie a severidade do incidente (critico, alto, medio, baixo)
2. Classifique o incidente na categoria mais apropriada
3. Extraia palavras-chave técnicas relevantes
4. Estime o tempo de resolução baseado na complexidade
5. Avalie o impacto no negócio
6. Forneça um nível de confiança da sua análise (0-1)

Retorne sua análise no seguinte formato JSON exato:
{
  "severity": "critico|alto|medio|baixo",
  "category": "categoria específica do mainframe",
  "confidence": 0.85,
  "keywords": ["palavra1", "palavra2", "palavra3"],
  "estimatedResolutionTime": "estimativa de tempo para resolução",
  "businessImpact": "descrição do impacto no negócio"
}

Considere que este é um ambiente mainframe empresarial onde:
- Incidentes críticos afetam produção inteira
- Incidentes altos afetam sistemas importantes
- Incidentes médios afetam funcionalidades específicas
- Incidentes baixos são melhorias ou problemas menores

Forneça apenas o JSON, sem explicações adicionais.`,

  /**
   * Template for finding similar incidents using semantic search
   */
  SIMILARITY_SEARCH_TEMPLATE: `Você é um especialista em sistemas mainframe. Encontre incidentes similares baseado na consulta semântica fornecida.

CONSULTA DE BUSCA: "{{searchQuery}}"
CATEGORIA ATUAL: {{currentCategory}}
MÁXIMO DE RESULTADOS: {{maxResults}}

INSTRUÇÕES:
1. Considere similaridade semântica, não apenas palavras-chave
2. Priorize incidentes da mesma categoria se relevante
3. Considere sinônimos e conceitos relacionados no mainframe
4. Avalie padrões de erro e componentes envolvidos
5. Considere o contexto técnico mainframe (JCL, VSAM, DB2, CICS, etc.)

Para cada incidente similar encontrado, retorne no formato:
indice:pontuacao_similaridade:explicacao_breve

Exemplo:
0:95:Erro S0C7 idêntico com mesma causa raiz em VSAM
3:85:Problema similar de alocação de dataset com solução comprovada
7:75:Erro relacionado de JCL com componente similar

Pontuação de similaridade deve ser 0-100, onde:
- 90-100: Praticamente idêntico
- 75-89: Muito similar, mesma categoria de problema
- 60-74: Similar, componentes ou sintomas relacionados
- 50-59: Relacionado, pode ter soluções aplicáveis
- Abaixo de 50: Não incluir

Considere terminologia mainframe específica:
- Códigos de erro (S0C4, S0C7, U0778, etc.)
- Componentes (VSAM, DB2, CICS, IMS, JCL)
- Operações (batch, online, allocation, cataloging)
- Mensagens de sistema (IEF, IGZ, IKJ, etc.)

Retorne apenas as linhas formatadas, sem explicações adicionais.`,

  /**
   * Template for generating solution suggestions
   */
  SOLUTION_SUGGESTION_TEMPLATE: `Você é um especialista senior em sistemas mainframe. Sugira soluções para o seguinte incidente considerando o contexto fornecido.

DETALHES DO INCIDENTE:
Título: {{title}}
Problema: {{problem}}
Categoria: {{category}}
Urgência: {{urgency}}

TENTATIVAS ANTERIORES:
{{previousAttempts}}

CONTEXTO ADICIONAL:
{{additionalContext}}

INSTRUÇÕES:
1. Sugira 2-4 soluções ordenadas por probabilidade de sucesso
2. Para cada solução, forneça passos detalhados e práticos
3. Estime tempo de implementação e nível de risco
4. Considere o ambiente mainframe empresarial
5. Priorize soluções menos invasivas quando apropriado

Retorne suas sugestões no seguinte formato JSON:
[
  {
    "description": "Descrição clara da solução",
    "confidence": 0.85,
    "steps": [
      "Passo 1: ação específica",
      "Passo 2: ação específica",
      "Passo 3: verificação"
    ],
    "estimatedTime": "tempo estimado (ex: 30-45 minutos)",
    "riskLevel": "baixo|medio|alto"
  }
]

CRITÉRIOS DE AVALIAÇÃO:
- Confidence: 0.9+ = Solução comprovada e direta
- Confidence: 0.7-0.9 = Solução provável com boa base técnica
- Confidence: 0.5-0.7 = Solução possível que vale tentar
- Confidence: <0.5 = Não incluir

NÍVEIS DE RISCO:
- Baixo: Não afeta produção, facilmente reversível
- Médio: Pode afetar performance, requer cuidado
- Alto: Pode afetar produção, requer aprovação

CONSIDERAÇÕES MAINFRAME:
- Sempre considere impacto em produção
- Inclua passos de verificação e rollback quando necessário
- Considere dependências entre sistemas
- Mencione necessidade de backups quando apropriado
- Considere janelas de manutenção para mudanças críticas

Forneça apenas o array JSON, sem explicações adicionais.`,

  /**
   * Template for expanding semantic context
   */
  CONTEXT_EXPANSION_TEMPLATE: `Você é um especialista em sistemas mainframe. Expanda o contexto semântico do seguinte texto para melhorar buscas e análises.

TEXTO: "{{text}}"

INSTRUÇÕES:
1. Identifique termos técnicos específicos do mainframe
2. Encontre sinônimos e variações de terminologia
3. Identifique conceitos relacionados que poderiam estar envolvidos
4. Considere diferentes formas de expressar o mesmo problema
5. Inclua códigos de erro e mensagens relacionadas quando relevante

Expanda o contexto considerando:
- Terminologia mainframe (JCL, VSAM, DB2, CICS, IMS, TSO, ISPF)
- Códigos de erro do sistema (S0C4, S0C7, U0778, IEF, IGZ, etc.)
- Operações comuns (allocation, cataloging, batch processing)
- Componentes de sistema (datasets, procedures, programs)
- Mensagens e códigos de retorno

Retorne a expansão no seguinte formato JSON:
{
  "semanticTerms": [
    "termos técnicos específicos extraídos",
    "códigos de erro identificados",
    "componentes de sistema mencionados"
  ],
  "synonyms": [
    "sinônimos e variações de terminologia",
    "formas alternativas de expressar conceitos",
    "abreviações e nomes completos"
  ],
  "relatedConcepts": [
    "conceitos relacionados que podem estar envolvidos",
    "componentes que frequentemente interagem",
    "procedimentos ou operações relacionadas"
  ]
}

EXEMPLOS DE EXPANSÃO:
- "erro de dados" -> "S0C7", "data exception", "COMP-3", "packed decimal"
- "arquivo VSAM" -> "dataset", "KSDS", "ESDS", "RRDS", "cluster", "catalog"
- "job falhou" -> "JCL error", "abend", "step failure", "return code"

Forneça apenas o JSON, sem explicações adicionais.`,

  /**
   * System instructions for consistent AI behavior
   */
  SYSTEM_INSTRUCTIONS: {
    LANGUAGE: 'pt-BR',
    TONE: 'professional',
    DOMAIN: 'mainframe systems',
    FOCUS: 'practical solutions',
    CONTEXT: 'enterprise environment'
  },

  /**
   * Category-specific prompt templates
   */
  CATEGORY_PROMPTS: {
    JCL: `Contexto específico JCL: Considere sintaxe JCL, parâmetros de job, procedures,
          allocation de datasets, códigos de retorno, e mensagens IEF. Foque em problemas de
          sintaxe, allocation failures, step conditions, e dependency issues.`,

    VSAM: `Contexto específico VSAM: Considere tipos de dataset (KSDS, ESDS, RRDS),
           catalog entries, access methods, buffer pools, e códigos de status VSAM.
           Foque em problemas de catalog, corruption, access failures, e performance.`,

    DB2: `Contexto específico DB2: Considere SQL syntax, bind processes, deadlocks,
          tablespace issues, catalog tables, e códigos SQL. Foque em performance,
          locking issues, access path problems, e utility failures.`,

    CICS: `Contexto específico CICS: Considere transaction processing, program loading,
           file access, terminal handling, e CICS messages. Foque em abends,
           performance issues, resource contention, e connectivity problems.`,

    IMS: `Contexto específico IMS: Considere database segments, program scheduling,
          transaction processing, e checkpoint/restart. Foque em database issues,
          scheduling problems, e performance degradation.`,

    BATCH: `Contexto específico Batch: Considere job scheduling, resource allocation,
            program execution, e dependency management. Foque em timing issues,
            resource conflicts, e processing failures.`,

    SYSTEM: `Contexto específico Sistema: Considere IPL, system parameters, storage
             management, e system messages. Foque em system availability,
             performance issues, e configuration problems.`
  },

  /**
   * Emergency response templates for critical incidents
   */
  EMERGENCY_TEMPLATES: {
    CRITICAL_SYSTEM_DOWN: `INCIDENTE CRÍTICO - SISTEMA PARADO
    Prioridade máxima na restauração do serviço.
    Considere primeiro procedimentos de restart rápido antes de investigação detalhada.`,

    PRODUCTION_IMPACT: `IMPACTO EM PRODUÇÃO
    Avalie impacto no negócio e considere soluções de contorno (workarounds)
    enquanto desenvolve solução definitiva.`,

    DATA_INTEGRITY: `PROBLEMA DE INTEGRIDADE DE DADOS
    Priorize proteção de dados. Considere backups e procedimentos de recovery
    antes de tentar correções que possam afetar dados.`
  }
} as const;

/**
 * Helper function to get category-specific prompt
 */
export function getCategoryPrompt(category: string): string {
  const categoryKey = category.toUpperCase() as keyof typeof INCIDENT_AI_PROMPTS.CATEGORY_PROMPTS;
  return INCIDENT_AI_PROMPTS.CATEGORY_PROMPTS[categoryKey] || '';
}

/**
 * Helper function to get emergency template
 */
export function getEmergencyTemplate(type: keyof typeof INCIDENT_AI_PROMPTS.EMERGENCY_TEMPLATES): string {
  return INCIDENT_AI_PROMPTS.EMERGENCY_TEMPLATES[type];
}