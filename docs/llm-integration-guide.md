# Guia de Integração LLM - Sistema Bancário

## Visão Geral

Este guia detalha a implementação da integração com Large Language Models (LLMs) para análise inteligente de incidentes bancários. O sistema utiliza OpenAI, Claude e Azure OpenAI para fornecer sugestões automáticas de resolução baseadas em incidentes similares e knowledge base.

## Arquitetura do Sistema

### Componentes Principais

```
LLMService (Orquestrador)
├── PromptTemplates (Estratégias de prompt engineering)
├── RAGService (Retrieval Augmented Generation)
├── SimilaritySearch (Busca vetorial)
├── OpenAIProvider (Integração OpenAI)
└── VectorDatabase (ChromaDB)
```

### Fluxo de Processamento

1. **Validação e Sanitização** → Entrada segura de dados
2. **Extração de Contexto** → Entidades técnicas e metadados
3. **Enriquecimento Histórico** → Dados estatísticos e padrões
4. **Busca Similar** → Incidentes relacionados via embeddings
5. **Consulta RAG** → Knowledge base relevante
6. **Geração LLM** → Análise e sugestões com fallback
7. **Resposta Estruturada** → JSON padronizado

## Configuração

### Variáveis de Ambiente

```bash
# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_ORG_ID=org-... (opcional)

# Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-...

# Azure OpenAI
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=https://...
```

### Configuração de Inicialização

```javascript
const LLMService = require('./src/services/llm-integration/LLMService');

const config = {
  // Providers LLM
  openai: {
    enabled: true,
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4-turbo-preview',
    maxTokens: 4000,
    temperature: 0.3
  },
  claude: {
    enabled: true,
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-3-sonnet-20240229',
    maxTokens: 4000,
    temperature: 0.3
  },
  azure: {
    enabled: false,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    deploymentName: 'gpt-4'
  },

  // Configurações RAG
  rag: {
    vectorDB: {
      host: 'localhost',
      port: 8000,
      collectionName: 'banking_knowledge'
    },
    embeddings: {
      provider: 'openai',
      model: 'text-embedding-3-small'
    },
    retrieval: {
      defaultLimit: 10,
      similarityThreshold: 0.7
    }
  },

  // Fallback e rate limiting
  fallback: {
    enabled: true,
    providerOrder: ['openai', 'claude', 'azure'],
    maxRetries: 3
  },
  rateLimit: {
    maxRequestsPerMinute: 20
  }
};

const llmService = new LLMService(config);
```

## ChromaDB Setup

### Instalação via Docker

```bash
docker run -d \
  --name chroma \
  -p 8000:8000 \
  -v chroma-data:/chroma/chroma \
  chromadb/chroma:latest
```

### Verificação de Conectividade

```bash
curl http://localhost:8000/api/v1/heartbeat
```

## Uso Básico

### Análise de Incidente

```javascript
const incident = {
  id: 'INC-2024-001',
  title: 'Database Connection Timeout',
  description: 'Unable to connect to primary database server',
  type: 'database',
  priority: 'High',
  category: 'infrastructure',
  affectedSystems: ['database', 'api'],
  errorMessages: ['Connection timeout after 30 seconds'],
  technicalDetails: {
    database: 'PostgreSQL 13',
    server: 'db-primary-01',
    port: 5432
  }
};

try {
  const analysis = await llmService.analyzeIncident(incident);

  console.log('Root Cause:', analysis.analysis.rootCause);
  console.log('Confidence:', analysis.confidence);
  console.log('Suggested Actions:', analysis.analysis.suggestedActions);
  console.log('Estimated Resolution Time:', analysis.analysis.estimatedResolutionTime);

} catch (error) {
  console.error('Analysis failed:', error.message);
}
```

### Resposta Exemplo

```json
{
  "incidentId": "INC-2024-001",
  "analysis": {
    "rootCause": "Database connection pool exhaustion due to connection leak",
    "severity": "High",
    "confidence": 0.85,
    "suggestedActions": [
      {
        "action": "Restart PostgreSQL connection pool manager",
        "priority": "Immediate",
        "estimatedTime": "5 minutes",
        "risk": "Baixo",
        "prerequisites": ["Notify active users"]
      },
      {
        "action": "Increase connection pool size temporarily",
        "priority": "High",
        "estimatedTime": "10 minutes",
        "risk": "Médio"
      }
    ],
    "estimatedResolutionTime": "30 minutes",
    "riskAssessment": {
      "businessImpact": "High - Core banking services affected",
      "affectedUsers": "~50,000 customers",
      "financialRisk": "alto",
      "reputationalRisk": "médio"
    },
    "preventionMeasures": [
      "Implement connection leak detection",
      "Set up proactive connection pool monitoring",
      "Regular connection pool health checks"
    ],
    "monitoringRecommendations": [
      "Alert on connection pool utilization > 80%",
      "Monitor database connection response times",
      "Track connection leak patterns"
    ],
    "escalationRecommendation": false,
    "relatedDocumentation": [
      "PostgreSQL Connection Pool Best Practices",
      "Database Incident Response Playbook"
    ]
  },
  "confidence": 0.85,
  "processingTime": 2847,
  "sources": {
    "similarIncidents": 3,
    "knowledgeBase": 5
  }
}
```

## Prompt Engineering

### Templates Especializados

O sistema inclui templates otimizados para diferentes tipos de incidentes:

#### 1. **System Outage** (Crítico)
- Chain-of-thought para análise rápida
- Foco em contenção e recuperação
- Priorização de ações por impacto

#### 2. **Performance Issues**
- Análise de gargalos
- Métricas de baseline
- Otimizações imediatas vs. longo prazo

#### 3. **Security Incidents**
- Protocolos de contenção
- Análise forense
- Compliance e notificação

#### 4. **Database Problems**
- Troubleshooting SQL específico
- Verificação de integridade
- Estratégias de recovery

#### 5. **Network Issues**
- Diagnóstico de conectividade
- Análise de latência
- Configurações de segurança

### Templates por Área Tecnológica

- **Mainframe**: COBOL, CICS, JCL, z/OS
- **Mobile Banking**: iOS, Android, APIs mobile
- **Payment Gateway**: PIX, TED, PCI-DSS
- **Core Banking**: Contas, regulamentação
- **ATM Network**: ISO 8583, switching

### Exemplo de Template Customizado

```javascript
const customTemplate = {
  systemPrompt: "Você é um especialista em [ÁREA ESPECÍFICA]...",

  chainOfThoughtInstructions: `
  ## Processo de Análise:
  1. **DIAGNÓSTICO**: [passos específicos]
  2. **ANÁLISE**: [critérios técnicos]
  3. **SOLUÇÃO**: [abordagens recomendadas]
  4. **PREVENÇÃO**: [medidas futuras]
  `,

  fewShotExamples: [
    {
      incident: "Exemplo de incidente similar",
      analysis: "Análise realizada",
      solution: "Solução aplicada",
      resolutionTime: "Tempo de resolução"
    }
  ],

  responseFormat: "Formato JSON esperado"
};

// Registrar template
llmService.promptTemplates.registerTemplate('custom-type', 'high', customTemplate);
```

## RAG (Retrieval Augmented Generation)

### Adicionando Documentos à Knowledge Base

```javascript
const ragService = new RAGService(config.rag);

// Documento individual
await ragService.addDocument({
  id: 'kb-001',
  content: 'PostgreSQL connection troubleshooting guide...',
  metadata: {
    title: 'PostgreSQL Troubleshooting',
    category: 'database',
    source: 'official_documentation',
    verified: true
  }
});

// Múltiplos documentos
const documents = [
  {
    id: 'kb-002',
    content: 'API Gateway error handling procedures...',
    metadata: { category: 'api', source: 'kb_article' }
  },
  // ... mais documentos
];

await Promise.all(
  documents.map(doc => ragService.addDocument(doc))
);
```

### Query da Knowledge Base

```javascript
const results = await ragService.query('database connection timeout', {
  limit: 5,
  threshold: 0.8,
  filters: { category: 'database' },
  rerank: true
});

results.forEach(result => {
  console.log(`${result.title} (${result.confidence})`);
  console.log(result.content.substring(0, 200) + '...');
});
```

## Busca por Similaridade

### Busca de Incidentes Similares

```javascript
const similaritySearch = new SimilaritySearch(config.similarity);

const searchQuery = {
  text: 'database connection timeout error',
  filters: {
    type: 'database',
    resolved: true,
    timeRange: '30d'
  },
  threshold: 0.75,
  limit: 5,
  algorithms: ['cosine', 'euclidean'],
  weightingStrategy: 'adaptive'
};

const similarIncidents = await similaritySearch.search(searchQuery);

similarIncidents.forEach(incident => {
  console.log(`${incident.title} - Similaridade: ${incident.score.toFixed(2)}`);
  console.log(`Solução: ${incident.solution}`);
  console.log(`Tempo de resolução: ${incident.resolutionTime}`);
});
```

### Análise de Padrões

```javascript
const patterns = await similaritySearch.findPatterns({
  systems: ['database', 'api'],
  timeRange: '90d',
  errorCodes: ['TIMEOUT', 'CONNECTION_FAILED']
});

console.log('Padrões de Frequência:', patterns.frequency);
console.log('Padrões Temporais:', patterns.temporal);
console.log('Padrões de Sistema:', patterns.system);
```

## Error Handling e Fallback

### Estratégias de Fallback

1. **Provider Fallback**: OpenAI → Claude → Azure
2. **Model Fallback**: GPT-4 → GPT-3.5-turbo
3. **Timeout Handling**: Retry com backoff exponencial
4. **Rate Limiting**: Queue de requests

### Tratamento de Erros

```javascript
const { ErrorHandler, LLMError, RateLimitError } = require('./utils/LLMErrors');

try {
  const analysis = await llmService.analyzeIncident(incident);
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log(`Rate limit hit. Retry after: ${error.retryAfter}ms`);
    await new Promise(resolve => setTimeout(resolve, error.retryAfter));
    // Retry logic
  } else if (ErrorHandler.isRetryable(error)) {
    const analysis = await ErrorHandler.withRetry(
      () => llmService.analyzeIncident(incident),
      3, // max attempts
      1000 // base delay
    );
  } else {
    console.error('Non-retryable error:', error.message);
    // Fallback manual analysis
  }
}
```

## Monitoramento e Métricas

### Health Checks

```javascript
// Verificar saúde dos serviços
const healthChecks = await Promise.all([
  llmService.healthCheck(),
  ragService.healthCheck(),
  similaritySearch.healthCheck()
]);

healthChecks.forEach((health, index) => {
  const service = ['LLM', 'RAG', 'Similarity'][index];
  console.log(`${service}: ${health.status}`);
  if (health.status === 'unhealthy') {
    console.error(`${service} Error:`, health.error);
  }
});
```

### Métricas de Performance

```javascript
// Estatísticas do serviço
const stats = {
  llm: llmService.getStats(),
  rag: ragService.getStats(),
  similarity: similaritySearch.getStats()
};

console.log('Cache Hit Rate (RAG):',
  stats.rag.cache.hits / (stats.rag.cache.hits + stats.rag.cache.misses)
);

console.log('Average Processing Time:', stats.llm.averageProcessingTime);
```

### Logs Estruturados

```javascript
const logger = require('./core/logging/Logger');

// Logs automáticos incluem:
logger.info('LLM analysis completed', {
  incidentId: 'INC-001',
  provider: 'openai',
  confidence: 0.85,
  processingTime: 2847,
  tokensUsed: 1250
});
```

## Segurança e Compliance

### Sanitização de Entrada

```javascript
const { validateIncident, sanitizeInput } = require('./utils/InputValidator');

// Automática no LLMService
const validatedIncident = validateIncident(incident);
const sanitizedInput = sanitizeInput(validatedIncident);
```

### Detecção de Conteúdo Malicioso

```javascript
const { detectMaliciousContent, cleanMaliciousContent } = require('./utils/InputValidator');

if (detectMaliciousContent(userInput)) {
  const cleanedInput = cleanMaliciousContent(userInput);
  logger.warn('Malicious content detected and cleaned', {
    original: userInput.substring(0, 100),
    cleaned: cleanedInput.substring(0, 100)
  });
}
```

### Rate Limiting

```javascript
// Configuração por provider
const rateLimits = {
  openai: { maxRequestsPerMinute: 20, burstLimit: 5 },
  claude: { maxRequestsPerMinute: 15, burstLimit: 3 },
  azure: { maxRequestsPerMinute: 25, burstLimit: 8 }
};
```

## Otimização e Performance

### Context Window Optimization

```javascript
// RAG Service otimiza automaticamente
const optimizedResults = ragService.optimizeContextWindow(results, {
  maxContextLength: 4000,
  preserveImportant: true
});
```

### Embedding Cache

```javascript
// Cache automático de embeddings
const embedding = await similaritySearch.generateQueryEmbedding(text);
// Segunda chamada usa cache automaticamente
```

### Batch Processing

```javascript
// Processamento em lote para múltiplos incidentes
const incidents = [...]; // Array de incidentes

const analyses = await Promise.all(
  incidents.map(incident =>
    llmService.analyzeIncident(incident)
      .catch(error => ({ error: error.message, incidentId: incident.id }))
  )
);
```

## Extensibilidade

### Adicionando Novo Provider

```javascript
class CustomLLMProvider {
  constructor(config) {
    this.config = config;
  }

  async chatCompletion(messages, options) {
    // Implementar integração
  }

  async createEmbedding(input, options) {
    // Implementar geração de embedding
  }

  async healthCheck() {
    // Implementar verificação de saúde
  }
}

// Registrar no LLMService
llmService.providers.custom = new CustomLLMProvider(config);
```

### Templates Personalizados

```javascript
// Criar template para novo domínio
const mobileTemplate = {
  systemPrompt: "Especialista em aplicações mobile banking...",
  chainOfThoughtInstructions: "...",
  fewShotExamples: [...],
  responseFormat: "..."
};

llmService.promptTemplates.registerTemplate('mobile', 'critical', mobileTemplate);
```

## Troubleshooting

### Problemas Comuns

#### 1. ChromaDB Connection Failed
```bash
# Verificar se ChromaDB está rodando
docker ps | grep chroma

# Verificar logs
docker logs chroma

# Restart se necessário
docker restart chroma
```

#### 2. OpenAI Rate Limit
```javascript
// Configurar rate limiting mais conservador
config.rateLimit.maxRequestsPerMinute = 10;
config.fallback.retryDelay = 2000;
```

#### 3. Embedding Dimension Mismatch
```javascript
// Verificar modelo de embedding
config.embeddings.model = 'text-embedding-3-small'; // 1536 dimensions
// ou
config.embeddings.model = 'text-embedding-ada-002'; // 1536 dimensions
```

#### 4. Context Window Exceeded
```javascript
// Reduzir maxTokens ou otimizar prompt
config.openai.maxTokens = 2000;
config.rag.retrieval.maxContextLength = 2000;
```

### Logs de Debug

```javascript
// Habilitar debug detalhado
process.env.LOG_LEVEL = 'debug';

// Logs específicos
logger.debug('LLM request details', {
  provider: 'openai',
  model: 'gpt-4',
  promptLength: prompt.length,
  maxTokens: 4000
});
```

## Custos e Limites

### Estimativa de Custos (USD)

| Operação | OpenAI GPT-4 | Claude 3 | Azure OpenAI |
|----------|--------------|----------|--------------|
| Análise de incidente | ~$0.08 | ~$0.06 | ~$0.08 |
| Embedding (1K tokens) | ~$0.00002 | N/A | ~$0.00002 |
| Query RAG (típica) | ~$0.02 | ~$0.015 | ~$0.02 |

### Limites de Rate

| Provider | Requests/min | Tokens/min |
|----------|--------------|------------|
| OpenAI GPT-4 | 20 | 40,000 |
| Claude 3 | 15 | 25,000 |
| Azure OpenAI | 25 | 50,000 |

## Roadmap

### Próximas Funcionalidades

1. **Fine-tuning Models**: Modelos especializados para domínio bancário
2. **Multi-modal Analysis**: Análise de logs e screenshots
3. **Workflow Automation**: Execução automática de ações sugeridas
4. **Advanced Analytics**: Dashboard de insights e tendências
5. **Federation Search**: Busca federada em múltiplas bases

### Melhorias Planejadas

- [ ] Suporte para Claude 3.5 Sonnet
- [ ] Integração com Pinecone/Weaviate
- [ ] Cache distribuído (Redis)
- [ ] Métricas avançadas (Prometheus)
- [ ] Interface web para configuração
- [ ] API GraphQL para queries complexas

## Suporte

Para dúvidas ou problemas:

1. **Logs**: Verificar logs em `/logs/llm-integration.log`
2. **Health Checks**: Usar endpoints de status
3. **Documentation**: Consultar JSDoc nos arquivos fonte
4. **Issues**: Reportar problemas no repositório Git

## Conclusão

Este sistema de integração LLM fornece uma base robusta para análise inteligente de incidentes bancários, com foco em:

- **Confiabilidade**: Múltiplos providers e fallbacks
- **Segurança**: Validação e sanitização rigorosas
- **Performance**: Cache, batching e otimizações
- **Extensibilidade**: Arquitetura modular
- **Observabilidade**: Logs e métricas detalhadas

A implementação segue as melhores práticas de engenharia de software e pode ser adaptada para diferentes necessidades e escalas de operação.