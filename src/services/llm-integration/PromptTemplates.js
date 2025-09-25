/**
 * Prompt Templates - Estratégias de prompt engineering para diferentes tipos de incidentes
 * Implementa Chain-of-Thought, Few-shot learning e templates especializados
 */

const logger = require('../../core/logging/Logger');

class PromptTemplates {
  constructor() {
    this.templates = new Map();
    this.initializeTemplates();
  }

  /**
   * Inicializa todos os templates de prompt
   */
  initializeTemplates() {
    // Templates por tipo de incidente
    this.registerTemplate('system-outage', 'critical', this.createSystemOutageTemplate());
    this.registerTemplate('performance', 'high', this.createPerformanceTemplate());
    this.registerTemplate('security', 'critical', this.createSecurityTemplate());
    this.registerTemplate('database', 'medium', this.createDatabaseTemplate());
    this.registerTemplate('network', 'high', this.createNetworkTemplate());
    this.registerTemplate('application', 'medium', this.createApplicationTemplate());
    this.registerTemplate('integration', 'medium', this.createIntegrationTemplate());
    this.registerTemplate('capacity', 'low', this.createCapacityTemplate());

    // Templates especializados por área tecnológica
    this.registerTemplate('mainframe', 'critical', this.createMainframeTemplate());
    this.registerTemplate('mobile-banking', 'high', this.createMobileBankingTemplate());
    this.registerTemplate('payment-gateway', 'critical', this.createPaymentGatewayTemplate());
    this.registerTemplate('core-banking', 'critical', this.createCoreBankingTemplate());
    this.registerTemplate('atm-network', 'high', this.createATMNetworkTemplate());

    logger.info('Templates de prompt inicializados', {
      totalTemplates: this.templates.size,
    });
  }

  /**
   * Registra um template de prompt
   */
  registerTemplate(type, category, template) {
    const key = `${type}-${category}`;
    this.templates.set(key, template);
  }

  /**
   * Obtém template baseado no tipo e categoria do incidente
   */
  getTemplate(type, category = 'medium') {
    const key = `${type}-${category}`;
    const template =
      this.templates.get(key) || this.templates.get(`${type}-medium`) || this.getDefaultTemplate();

    logger.debug('Template selecionado', { type, category, key });
    return template;
  }

  /**
   * Constrói prompt final com contexto
   */
  buildPrompt(template, context) {
    try {
      let prompt = template.systemPrompt + '\n\n';

      // Adiciona contexto do incidente
      prompt += this.buildIncidentContext(context.incident);

      // Adiciona exemplos few-shot se disponíveis
      if (template.fewShotExamples && template.fewShotExamples.length > 0) {
        prompt += '\n## Exemplos de Incidentes Similares Resolvidos:\n';
        prompt += this.buildFewShotExamples(template.fewShotExamples);
      }

      // Adiciona incidentes similares encontrados
      if (context.similarIncidents && context.similarIncidents.length > 0) {
        prompt += '\n## Incidentes Similares da Base de Dados:\n';
        prompt += this.buildSimilarIncidentsContext(context.similarIncidents);
      }

      // Adiciona conhecimento da knowledge base
      if (context.knowledgeBase && context.knowledgeBase.length > 0) {
        prompt += '\n## Documentação Relevante:\n';
        prompt += this.buildKnowledgeBaseContext(context.knowledgeBase);
      }

      // Adiciona contexto histórico se disponível
      if (context.context && context.context.enrichment) {
        prompt += '\n## Contexto Histórico:\n';
        prompt += this.buildHistoricalContext(context.context.enrichment);
      }

      // Adiciona instruções de Chain-of-Thought
      prompt += '\n' + template.chainOfThoughtInstructions;

      // Adiciona formato de resposta esperado
      prompt += '\n' + template.responseFormat;

      return prompt;
    } catch (error) {
      logger.error('Erro ao construir prompt', { error: error.message });
      return this.buildFallbackPrompt(context);
    }
  }

  /**
   * Template para interrupções de sistema críticas
   */
  createSystemOutageTemplate() {
    return {
      systemPrompt: `Você é um especialista sênior em análise de incidentes de sistemas bancários críticos.
            Sua especialidade é identificar rapidamente a causa raiz de interrupções de sistema e fornecer
            planos de ação imediatos para minimizar o impacto nos negócios.`,

      chainOfThoughtInstructions: `
## Processo de Análise (Chain-of-Thought):

1. **ANÁLISE INICIAL (2 min)**:
   - Identifique sistemas críticos afetados
   - Avalie o escopo do impacto (usuários, transações, serviços)
   - Determine se há riscos de segurança imediatos

2. **INVESTIGAÇÃO DA CAUSA RAIZ (5 min)**:
   - Analise padrões nos logs e mensagens de erro
   - Correlacione com incidentes similares históricos
   - Identifique possíveis pontos de falha (rede, hardware, software, processo)

3. **PLANO DE RECUPERAÇÃO (3 min)**:
   - Priorize ações por impacto na restauração do serviço
   - Considere rollbacks, failovers ou bypass temporários
   - Defina critérios de sucesso para cada ação

4. **PREVENÇÃO E MONITORAMENTO**:
   - Identifique melhorias de monitoramento
   - Sugira medidas preventivas
   - Recomende ajustes na arquitetura se necessário`,

      fewShotExamples: [
        {
          incident: 'Core Banking indisponível - Erro de conectividade com mainframe',
          analysis:
            'Falha na conexão MQ Series entre middleware e mainframe. Pool de conexões esgotado.',
          solution:
            '1. Restart do MQ Manager, 2. Aumento temporário do pool, 3. Verificação de memory leaks',
          resolutionTime: '15 minutos',
        },
        {
          incident: 'ATM Network down - Falha na autenticação',
          analysis: 'Certificado SSL expirado no servidor de autenticação central',
          solution:
            '1. Renovação emergencial do certificado, 2. Deploy imediato, 3. Teste de conectividade',
          resolutionTime: '30 minutos',
        },
      ],

      responseFormat: `
## RESPOSTA OBRIGATÓRIA EM JSON:

{
  "rootCause": "Causa raiz identificada ou hipótese mais provável",
  "severity": "Critical|High|Medium|Low",
  "confidence": 0.0-1.0,
  "suggestedActions": [
    {
      "action": "Ação específica",
      "priority": "Immediate|High|Medium|Low",
      "estimatedTime": "tempo estimado",
      "risk": "Baixo|Médio|Alto",
      "prerequisites": ["pré-requisitos se houver"]
    }
  ],
  "estimatedResolutionTime": "tempo total estimado",
  "riskAssessment": {
    "businessImpact": "descrição do impacto",
    "affectedUsers": "número estimado",
    "financialRisk": "baixo|médio|alto",
    "reputationalRisk": "baixo|médio|alto"
  },
  "preventionMeasures": [
    "medidas preventivas específicas"
  ],
  "monitoringRecommendations": [
    "alertas e métricas recomendadas"
  ],
  "escalationRecommendation": true|false,
  "relatedDocumentation": [
    "links ou referências relevantes"
  ]
}`,
    };
  }

  /**
   * Template para problemas de performance
   */
  createPerformanceTemplate() {
    return {
      systemPrompt: `Você é um especialista em performance de sistemas bancários.
            Sua especialidade é diagnosticar gargalos de performance, otimizar recursos
            e garantir SLAs de resposta em ambientes de alta demanda.`,

      chainOfThoughtInstructions: `
## Processo de Análise de Performance:

1. **BASELINE E MÉTRICAS**:
   - Compare performance atual vs. baseline histórico
   - Identifique métricas fora do padrão (CPU, memória, I/O, rede)
   - Analise throughput e latência por componente

2. **ANÁLISE DE GARGALOS**:
   - Identifique o componente mais limitante
   - Analise queries SQL lentas se aplicável
   - Verifique saturação de recursos
   - Examine padrões de acesso e carga

3. **OTIMIZAÇÃO IMEDIATA**:
   - Sugira ajustes de configuração rápidos
   - Identifique processes que podem ser terminados
   - Considere rebalanceamento de carga

4. **PLANO DE MELHORIA**:
   - Otimizações de médio prazo
   - Necessidade de recursos adicionais
   - Refatoração de código crítico`,

      fewShotExamples: [
        {
          incident: 'Transações PIX com latência alta (>5s)',
          analysis: 'Gargalo na validação de CPF - query sem índice em tabela de 50M registros',
          solution: '1. Criar índice composto, 2. Cache em Redis, 3. Otimizar query',
          resolutionTime: '2 horas',
        },
      ],

      responseFormat: `
{
  "rootCause": "Gargalo identificado",
  "severity": "High|Medium|Low",
  "confidence": 0.0-1.0,
  "suggestedActions": [
    {
      "action": "Ação de otimização",
      "type": "immediate|short-term|long-term",
      "impact": "Alto|Médio|Baixo",
      "effort": "1-5 pontos",
      "risks": ["riscos associados"]
    }
  ],
  "performanceMetrics": {
    "currentThroughput": "valor atual",
    "expectedThroughput": "valor esperado",
    "bottleneck": "componente limitante",
    "resourceUtilization": {
      "cpu": "percentage",
      "memory": "percentage",
      "disk": "percentage",
      "network": "percentage"
    }
  },
  "estimatedResolutionTime": "tempo estimado",
  "preventionMeasures": ["medidas preventivas"],
  "monitoringRecommendations": ["alertas recomendados"]
}`,
    };
  }

  /**
   * Template para incidentes de segurança
   */
  createSecurityTemplate() {
    return {
      systemPrompt: `Você é um especialista em segurança cibernética para sistemas bancários.
            Sua prioridade é identificar e conter ameaças de segurança, proteger dados sensíveis
            e manter a conformidade regulatória.`,

      chainOfThoughtInstructions: `
## Processo de Análise de Segurança:

1. **CONTENÇÃO IMEDIATA**:
   - Isole sistemas comprometidos
   - Bloqueie acessos suspeitos
   - Preserve evidências para investigação

2. **AVALIAÇÃO DE IMPACTO**:
   - Determine dados potencialmente expostos
   - Identifique usuários afetados
   - Avalie violações de conformidade

3. **INVESTIGAÇÃO FORENSE**:
   - Analise logs de segurança
   - Trace origem do incidente
   - Identifique vetores de ataque

4. **RECUPERAÇÃO E HARDENING**:
   - Remova ameaças identificadas
   - Implemente controles adicionais
   - Atualize políticas de segurança`,

      fewShotExamples: [
        {
          incident: 'Tentativas de login suspeitas em contas administrativas',
          analysis: 'Ataque de força bruta coordenado de múltiplos IPs. Possível botnet.',
          solution: '1. Bloqueio de IPs, 2. Reset de senhas admin, 3. MFA obrigatório',
          resolutionTime: '1 hora',
        },
      ],

      responseFormat: `
{
  "rootCause": "Tipo de ameaça identificada",
  "severity": "Critical|High|Medium|Low",
  "confidence": 0.0-1.0,
  "securityClassification": "Confidential|Internal|Public",
  "threatVector": "descrição do vetor de ataque",
  "suggestedActions": [
    {
      "action": "Ação de segurança",
      "priority": "Immediate|High|Medium|Low",
      "type": "containment|investigation|recovery|prevention",
      "riskLevel": "Alto|Médio|Baixo"
    }
  ],
  "complianceImpact": {
    "regulations": ["LGPD", "PCI-DSS", "BACEN"],
    "notificationRequired": true|false,
    "reportingDeadline": "prazo se aplicável"
  },
  "affectedAssets": [
    "sistemas e dados afetados"
  ],
  "forensicRecommendations": [
    "ações para preservar evidências"
  ],
  "preventionMeasures": [
    "controles de segurança recomendados"
  ]
}`,
    };
  }

  /**
   * Template para problemas de banco de dados
   */
  createDatabaseTemplate() {
    return {
      systemPrompt: `Você é um DBA especialista em sistemas bancários.
            Sua expertise inclui otimização de queries, troubleshooting de conexões,
            recovery de dados e manutenção de alta disponibilidade.`,

      chainOfThoughtInstructions: `
## Processo de Análise de Database:

1. **DIAGNÓSTICO INICIAL**:
   - Verifique status de conexões ativas
   - Analise wait events e locks
   - Examine logs de erro do SGBD

2. **ANÁLISE DE PERFORMANCE**:
   - Identifique queries lentas ou problemáticas
   - Verifique uso de índices
   - Analise planos de execução

3. **VERIFICAÇÃO DE INTEGRIDADE**:
   - Consistência de dados
   - Espaço disponível em tablespaces
   - Status de backups

4. **PLANO DE CORREÇÃO**:
   - Otimizações imediatas possíveis
   - Necessidade de manutenção
   - Estratégias de recovery se necessário`,

      fewShotExamples: [
        {
          incident: 'Timeout em consultas de saldo - Oracle 19c',
          analysis: 'Estatísticas de tabela desatualizadas causando plano de execução ineficiente',
          solution:
            '1. Gather stats em tabelas críticas, 2. Hint de força de índice, 3. Rebuild de índice fragmentado',
          resolutionTime: '45 minutos',
        },
      ],

      responseFormat: `
{
  "rootCause": "Problema específico do database",
  "severity": "High|Medium|Low",
  "confidence": 0.0-1.0,
  "dbmsType": "Oracle|SQL Server|PostgreSQL|MySQL|DB2",
  "suggestedActions": [
    {
      "action": "Ação específica do DB",
      "category": "optimization|maintenance|recovery|configuration",
      "downtime": "tempo de indisponibilidade",
      "validation": "como validar sucesso"
    }
  ],
  "performanceImpact": {
    "affectedQueries": "queries impactadas",
    "currentResponseTime": "tempo atual",
    "targetResponseTime": "objetivo"
  },
  "dataIntegrityRisk": "Alto|Médio|Baixo|Nenhum",
  "backupRecommendation": "necessidade de backup antes da correção",
  "preventionMeasures": [
    "manutenções preventivas recomendadas"
  ]
}`,
    };
  }

  /**
   * Template para problemas de rede
   */
  createNetworkTemplate() {
    return {
      systemPrompt: `Você é um especialista em infraestrutura de rede bancária.
            Sua especialidade inclui conectividade, latência, throughput, VPNs,
            firewalls e segurança de rede em ambientes críticos.`,

      chainOfThoughtInstructions: `
## Processo de Análise de Rede:

1. **VERIFICAÇÃO DE CONECTIVIDADE**:
   - Teste conectividade entre pontos críticos
   - Analise routing e switching
   - Verifique status de interfaces

2. **ANÁLISE DE PERFORMANCE**:
   - Latência entre pontos
   - Utilização de banda
   - Perda de pacotes

3. **SEGURANÇA DE REDE**:
   - Regras de firewall
   - Configurações de VPN
   - Detecção de intrusão

4. **OTIMIZAÇÃO**:
   - Balanceamento de carga
   - QoS para tráfego crítico
   - Redundância e failover`,

      fewShotExamples: [],
      responseFormat: this.getStandardResponseFormat(),
    };
  }

  /**
   * Template para aplicações
   */
  createApplicationTemplate() {
    return {
      systemPrompt: `Você é um especialista em aplicações bancárias.
            Foco em debugging de código, análise de logs, gerenciamento de memória
            e otimização de aplicações Java, .NET e mainframe.`,

      chainOfThoughtInstructions: `
## Processo de Análise de Aplicação:

1. **ANÁLISE DE LOGS**:
   - Examine stack traces e exceções
   - Correlacione eventos temporalmente
   - Identifique padrões de erro

2. **VERIFICAÇÃO DE RECURSOS**:
   - Uso de CPU e memória da aplicação
   - Pool de conexões
   - Thread dumps se necessário

3. **CÓDIGO E CONFIGURAÇÃO**:
   - Mudanças recentes no código
   - Configurações de ambiente
   - Dependências e versões

4. **SOLUÇÃO E TESTE**:
   - Correções ou workarounds
   - Plano de teste
   - Rollback se necessário`,

      fewShotExamples: [],
      responseFormat: this.getStandardResponseFormat(),
    };
  }

  /**
   * Template para integrações
   */
  createIntegrationTemplate() {
    return {
      systemPrompt: `Você é um especialista em integrações bancárias.
            APIs, web services, mensageria, EDI e comunicação entre sistemas
            heterogêneos são sua especialidade.`,

      chainOfThoughtInstructions: `
## Processo de Análise de Integração:

1. **MAPEAMENTO DO FLUXO**:
   - Trace o fluxo de dados entre sistemas
   - Identifique ponto de falha na cadeia
   - Verifique transformações de dados

2. **ANÁLISE DE PROTOCOLOS**:
   - HTTP status codes, timeouts
   - Mensageria (MQ, Kafka)
   - Formatos de dados (JSON, XML, EDI)

3. **AUTENTICAÇÃO E AUTORIZAÇÃO**:
   - Tokens, certificados
   - Permissões de acesso
   - Configurações de segurança

4. **RESILIÊNCIA**:
   - Retry policies
   - Circuit breakers
   - Fallback mechanisms`,

      fewShotExamples: [],
      responseFormat: this.getStandardResponseFormat(),
    };
  }

  /**
   * Template para capacidade
   */
  createCapacityTemplate() {
    return {
      systemPrompt: `Você é um especialista em planejamento de capacidade bancária.
            Análise de crescimento, dimensionamento de recursos e otimização
            de infraestrutura para suportar demanda crescente.`,

      chainOfThoughtInstructions: `
## Processo de Análise de Capacidade:

1. **ANÁLISE DE TENDÊNCIAS**:
   - Crescimento histórico de demanda
   - Padrões sazonais
   - Projeções futuras

2. **GARGALOS ATUAIS**:
   - Recursos mais utilizados
   - Pontos de saturação
   - Limites técnicos

3. **DIMENSIONAMENTO**:
   - Recursos adicionais necessários
   - Timing de expansão
   - Alternativas de arquitetura

4. **OTIMIZAÇÃO**:
   - Melhor utilização de recursos existentes
   - Consolidação possível
   - Automação de scaling`,

      fewShotExamples: [],
      responseFormat: this.getStandardResponseFormat(),
    };
  }

  /**
   * Template especializado para mainframe
   */
  createMainframeTemplate() {
    return {
      systemPrompt: `Você é um especialista em sistemas mainframe bancários.
            COBOL, CICS, DB2, JCL, TSO/ISPF e z/OS são sua especialidade.
            Foco em alta disponibilidade e processamento batch crítico.`,

      chainOfThoughtInstructions: `
## Processo de Análise Mainframe:

1. **VERIFICAÇÃO DE JOBS**:
   - Status de jobs batch críticos
   - SYSLOG e JESLOG analysis
   - Dependências entre jobs

2. **ANÁLISE CICS/IMS**:
   - Transaction response times
   - Pool utilization
   - Deadlocks e timeouts

3. **RECURSOS SISTEMA**:
   - CPU utilization por LPAR
   - Storage (real, auxiliary, expanded)
   - I/O subsystem performance

4. **RECOVERY PROCEDURES**:
   - IPL requirements
   - Restart procedures
   - Backup/restore options`,

      fewShotExamples: [
        {
          incident: 'CICS região PROD1 com ASRA abends em massa',
          analysis:
            'Storage violation em programa COBOL após mudança recente. Array bounds exceeded.',
          solution: '1. Emergency shutdown CICS, 2. Rollback program, 3. Cold start com dumps',
          resolutionTime: '30 minutos',
        },
      ],

      responseFormat: this.getMainframeResponseFormat(),
    };
  }

  /**
   * Template para mobile banking
   */
  createMobileBankingTemplate() {
    return {
      systemPrompt: `Você é um especialista em aplicações mobile banking.
            iOS, Android, APIs mobile, push notifications, biometria
            e experiência do usuário são sua especialidade.`,

      chainOfThoughtInstructions: `
## Processo de Análise Mobile:

1. **PLATAFORMA E VERSÃO**:
   - Versão do app afetada
   - OS version compatibility
   - Device-specific issues

2. **CONECTIVIDADE**:
   - API endpoints health
   - Network connectivity issues
   - CDN performance

3. **FUNCIONALIDADES**:
   - Login/authentication flows
   - Transaction processing
   - Push notifications
   - Biometric validation

4. **USER EXPERIENCE**:
   - Performance metrics
   - Crash reports
   - User feedback patterns`,

      fewShotExamples: [],
      responseFormat: this.getStandardResponseFormat(),
    };
  }

  /**
   * Template para payment gateway
   */
  createPaymentGatewayTemplate() {
    return {
      systemPrompt: `Você é um especialista em payment gateways bancários.
            PIX, TED, DOC, cartões, processamento de pagamentos
            e compliance PCI-DSS são sua especialidade.`,

      chainOfThoughtInstructions: `
## Processo de Análise Payment Gateway:

1. **TRANSACTION FLOW**:
   - Trace da transação fim-a-fim
   - Response codes e timeouts
   - Reconciliação financeira

2. **COMPLIANCE**:
   - PCI-DSS requirements
   - Tokenização adequada
   - Logs sensíveis

3. **PERFORMANCE**:
   - TPS (Transactions Per Second)
   - Latência por canal
   - Success rates

4. **INTEGRAÇÃO**:
   - Conectividade com acquirers
   - APIs de third parties
   - Callback mechanisms`,

      fewShotExamples: [],
      responseFormat: this.getPaymentResponseFormat(),
    };
  }

  /**
   * Template para core banking
   */
  createCoreBankingTemplate() {
    return {
      systemPrompt: `Você é um especialista em core banking systems.
            Contas, empréstimos, investimentos, contabilidade
            e regulatory reporting são sua especialidade.`,

      chainOfThoughtInstructions: `
## Processo de Análise Core Banking:

1. **TRANSACTIONAL INTEGRITY**:
   - Double-entry bookkeeping
   - Saldos e conciliação
   - Locks e deadlocks

2. **REGULATORY COMPLIANCE**:
   - BACEN requirements
   - Reporting obligations
   - Audit trails

3. **BATCH PROCESSING**:
   - EOD (End of Day) jobs
   - Interest calculations
   - Statement generation

4. **REAL-TIME OPERATIONS**:
   - Account updates
   - Balance inquiries
   - Transaction posting`,

      fewShotExamples: [],
      responseFormat: this.getStandardResponseFormat(),
    };
  }

  /**
   * Template para ATM network
   */
  createATMNetworkTemplate() {
    return {
      systemPrompt: `Você é um especialista em redes ATM bancárias.
            Switching, ISO 8583, network routing, cash management
            e disponibilidade ATM são sua especialidade.`,

      chainOfThoughtInstructions: `
## Processo de Análise ATM Network:

1. **NETWORK CONNECTIVITY**:
   - Switch communication
   - Line status e throughput
   - Routing tables

2. **TRANSACTION PROCESSING**:
   - ISO 8583 message flow
   - Response codes analysis
   - Settlement procedures

3. **ATM STATUS**:
   - Device health monitoring
   - Cash levels
   - Dispenser status

4. **SECURITY**:
   - Encryption key management
   - Fraud detection
   - Physical security alerts`,

      fewShotExamples: [],
      responseFormat: this.getStandardResponseFormat(),
    };
  }

  /**
   * Template padrão para casos não específicos
   */
  getDefaultTemplate() {
    return {
      systemPrompt: `Você é um especialista em sistemas bancários com amplo conhecimento
            em infraestrutura, aplicações, segurança e operações. Forneça análise
            técnica detalhada e sugestões práticas de resolução.`,

      chainOfThoughtInstructions: `
## Processo Geral de Análise:

1. **COLETA DE INFORMAÇÕES**:
   - Analise todos os dados fornecidos
   - Identifique informações faltantes críticas
   - Correlacione com padrões conhecidos

2. **DIAGNÓSTICO**:
   - Formule hipóteses baseadas em evidências
   - Priorize causas mais prováveis
   - Considere fatores ambientais

3. **PLANO DE AÇÃO**:
   - Ações imediatas vs. de longo prazo
   - Avalie riscos de cada abordagem
   - Defina critérios de sucesso

4. **PREVENÇÃO**:
   - Identifique melhorias preventivas
   - Sugira monitoramento adicional
   - Documente lições aprendidas`,

      fewShotExamples: [],
      responseFormat: this.getStandardResponseFormat(),
    };
  }

  /**
   * Formatos de resposta especializados
   */
  getStandardResponseFormat() {
    return `
{
  "rootCause": "Causa raiz identificada",
  "severity": "Critical|High|Medium|Low",
  "confidence": 0.0-1.0,
  "suggestedActions": [
    {
      "action": "Ação específica",
      "priority": "Immediate|High|Medium|Low",
      "estimatedTime": "tempo estimado",
      "risk": "Baixo|Médio|Alto"
    }
  ],
  "estimatedResolutionTime": "tempo total estimado",
  "riskAssessment": {
    "businessImpact": "descrição",
    "technicalRisk": "avaliação"
  },
  "preventionMeasures": ["medidas preventivas"],
  "monitoringRecommendations": ["alertas recomendados"],
  "escalationRecommendation": true|false,
  "relatedDocumentation": ["referências"]
}`;
  }

  getMainframeResponseFormat() {
    return `
{
  "rootCause": "Causa raiz mainframe",
  "severity": "Critical|High|Medium|Low",
  "confidence": 0.0-1.0,
  "systemComponents": {
    "cics": "status e recomendações",
    "db2": "status e recomendações",
    "batch": "jobs afetados",
    "storage": "utilização"
  },
  "suggestedActions": [
    {
      "action": "Ação mainframe específica",
      "jcl": "JCL necessário se aplicável",
      "downtime": "tempo de indisponibilidade",
      "rollback": "procedimento de rollback"
    }
  ],
  "ipl_required": true|false,
  "backup_recommendation": "necessidade de backup",
  "performance_impact": "impacto na performance"
}`;
  }

  getPaymentResponseFormat() {
    return `
{
  "rootCause": "Causa raiz do payment issue",
  "severity": "Critical|High|Medium|Low",
  "confidence": 0.0-1.0,
  "paymentChannels": {
    "affected": ["PIX", "TED", "DOC", "Cards"],
    "impact": "descrição do impacto"
  },
  "financialImpact": {
    "transactionsAffected": "número estimado",
    "revenueRisk": "valor estimado",
    "reconciliationImpact": "impacto na conciliação"
  },
  "complianceRisk": {
    "pci_dss": "impacto PCI",
    "bacen": "regulamentações BACEN",
    "reporting": "necessidade de reportar"
  },
  "suggestedActions": [
    {
      "action": "Ação específica para payments",
      "acquirer_impact": "impacto em acquirers",
      "rollback_procedure": "procedimento de rollback"
    }
  ]
}`;
  }

  /**
   * Constrói contexto do incidente
   */
  buildIncidentContext(incident) {
    return `
## Detalhes do Incidente:

**ID**: ${incident.id}
**Título**: ${incident.title}
**Descrição**: ${incident.description}
**Tipo**: ${incident.type}
**Prioridade**: ${incident.priority}
**Categoria**: ${incident.category}

**Sistemas Afetados**: ${incident.affectedSystems?.join(', ') || 'Não especificado'}
**Mensagens de Erro**: ${incident.errorMessages?.join('; ') || 'Nenhuma'}
**Impacto no Negócio**: ${incident.businessImpact || 'Não especificado'}

**Detalhes Técnicos**:
${JSON.stringify(incident.technicalDetails || {}, null, 2)}`;
  }

  /**
   * Constrói exemplos few-shot
   */
  buildFewShotExamples(examples) {
    return examples
      .map(
        (example, index) => `
### Exemplo ${index + 1}:
**Incidente**: ${example.incident}
**Análise**: ${example.analysis}
**Solução**: ${example.solution}
**Tempo de Resolução**: ${example.resolutionTime}
`
      )
      .join('\n');
  }

  /**
   * Constrói contexto de incidentes similares
   */
  buildSimilarIncidentsContext(similarIncidents) {
    return similarIncidents
      .map(
        (incident, index) => `
### Incidente Similar ${index + 1} (Similaridade: ${(incident.similarity * 100).toFixed(1)}%):
**Título**: ${incident.title}
**Solução**: ${incident.solution}
**Tempo de Resolução**: ${incident.resolutionTime}
**Complexidade**: ${incident.complexity}
`
      )
      .join('\n');
  }

  /**
   * Constrói contexto da knowledge base
   */
  buildKnowledgeBaseContext(knowledgeBase) {
    return knowledgeBase
      .map(
        (doc, index) => `
### Documento ${index + 1} (Relevância: ${(doc.relevance * 100).toFixed(1)}%):
**Título**: ${doc.title}
**Categoria**: ${doc.category}
**Fonte**: ${doc.source}
**Conteúdo**: ${doc.content.substring(0, 300)}...
`
      )
      .join('\n');
  }

  /**
   * Constrói contexto histórico
   */
  buildHistoricalContext(enrichment) {
    let context = '';

    if (enrichment.historicalPattern) {
      context += `
**Padrão Histórico**:
- Frequência: ${enrichment.historicalPattern.frequency || 'N/A'}
- Última ocorrência: ${enrichment.historicalPattern.lastOccurrence || 'N/A'}
`;
    }

    if (enrichment.resolutionStats) {
      context += `
**Estatísticas de Resolução**:
- Tempo médio: ${enrichment.resolutionStats.averageResolutionTime}
- Taxa de sucesso: ${(enrichment.resolutionStats.successRate * 100).toFixed(1)}%
- Taxa de escalação: ${(enrichment.resolutionStats.escalationRate * 100).toFixed(1)}%
`;
    }

    if (enrichment.riskFactors?.length > 0) {
      context += `
**Fatores de Risco**: ${enrichment.riskFactors.join(', ')}
`;
    }

    return context;
  }

  /**
   * Constrói prompt de fallback
   */
  buildFallbackPrompt(context) {
    return `
Analise o seguinte incidente bancário e forneça recomendações:

${this.buildIncidentContext(context.incident)}

Forneça sua análise em formato JSON com as seguintes informações:
- rootCause
- severity
- confidence
- suggestedActions
- estimatedResolutionTime
- riskAssessment
- preventionMeasures
- escalationRecommendation

Seja específico e prático nas recomendações.`;
  }
}

module.exports = PromptTemplates;
