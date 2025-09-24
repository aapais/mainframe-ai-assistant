# 🎯 PLANO COMPLETO DE IMPLEMENTAÇÃO - SISTEMA IA INTEGRADO

**Data:** 23/09/2025
**Versão:** 3.0 - Completa e Consolidada
**Objetivo:** Implementar sistema híbrido de gestão de incidentes com IA empresarial

---

## 📋 VISÃO GERAL DO SISTEMA

### Arquitetura Híbrida
- **Modo Dual:** Sistema funciona COM ou SEM IA (toggle on/off)
- **Dois Fluxos Principais:**
  1. **Inserção:** Enriquecimento de contexto durante criação
  2. **Resolução:** Busca inteligente de soluções similares
- **Integração com LLMs Empresariais:** Gemini, OpenAI, Azure, GitHub Copilot
- **Sanitização:** Proteção de dados sensíveis antes de enviar para LLMs
- **Validação Única:** Confirmação pelo usuário apenas no final

---

## 🚀 FASE 1: FUNDAÇÃO - CAMPOS DE CONTEXTO (Dia 1)

### 1.1 Adicionar Campos ao CreateIncidentModal
**Arquivo:** `Accenture-Mainframe-AI-Assistant-Integrated.html`
**Tempo:** 2-3 horas

```javascript
// Estado inicial (linha ~681)
const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    assignee: 'Auto-atribuir',
    useAI: true,
    // NOVOS CAMPOS
    technical_area: '',        // OBRIGATÓRIO
    business_area: '',         // OPCIONAL (inferido)
    // Campos dinâmicos baseados em technical_area
    mainframe_job: '',
    mainframe_program: '',
    mainframe_abend: '',
    java_class: '',
    java_exception: '',
    csharp_namespace: '',
    csharp_error: '',
    database_query: '',
    database_error: '',
    network_protocol: '',
    network_port: ''
});

// Componente UI (após campo description)
<div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-2">
        Área Técnica <span className="text-red-500">*</span>
    </label>
    <select
        value={formData.technical_area}
        onChange={(e) => handleTechnicalAreaChange(e.target.value)}
        className="w-full p-2 border rounded"
        required
    >
        <option value="">Selecione...</option>
        <option value="mainframe">Mainframe</option>
        <option value="java">Java</option>
        <option value="csharp">C#</option>
        <option value="database">Database</option>
        <option value="network">Network</option>
    </select>
</div>

<div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-2">
        Área de Negócio {formData.business_area &&
            <span className="text-green-500 ml-2">(inferido: {formData.business_area})</span>
        }
    </label>
    <select
        value={formData.business_area}
        onChange={(e) => setFormData({...formData, business_area: e.target.value})}
        className="w-full p-2 border rounded"
    >
        <option value="">Sistema irá inferir...</option>
        <option value="pagamentos">Pagamentos</option>
        <option value="cobranca">Cobrança</option>
        <option value="cadastro">Cadastro</option>
        <option value="compliance">Compliance</option>
        <option value="contabilidade">Contabilidade</option>
    </select>
</div>

{/* Campos dinâmicos baseados em technical_area */}
{formData.technical_area === 'mainframe' && (
    <>
        <input placeholder="Job Name (ex: COBPG001)"
               value={formData.mainframe_job}
               onChange={(e) => setFormData({...formData, mainframe_job: e.target.value})} />
        <input placeholder="Program (ex: PGMCOB01)"
               value={formData.mainframe_program}
               onChange={(e) => setFormData({...formData, mainframe_program: e.target.value})} />
        <input placeholder="ABEND Code (ex: S0C7)"
               value={formData.mainframe_abend}
               onChange={(e) => setFormData({...formData, mainframe_abend: e.target.value})} />
    </>
)}
```

### 1.2 Implementar Inferência de Área de Negócio
**Novo arquivo:** `/mnt/c/mainframe-ai-assistant/scripts/inference-service.js`
**Tempo:** 1-2 horas

```javascript
class InferenceService {
    // Mapa de keywords para áreas de negócio
    static businessAreaPatterns = {
        pagamentos: [
            'pagamento', 'pix', 'ted', 'doc', 'transferência', 'qr code',
            'débito', 'crédito', 'cartão', 'saldo', 'extrato', 'movimento'
        ],
        cobranca: [
            'cobrança', 'boleto', 'dívida', 'inadimplência', 'vencimento',
            'juros', 'multa', 'protesto', 'negativação', 'acordo'
        ],
        cadastro: [
            'cadastro', 'cliente', 'cpf', 'cnpj', 'endereço', 'telefone',
            'email', 'dados pessoais', 'atualização', 'registro'
        ],
        compliance: [
            'compliance', 'lavagem', 'pld', 'kyc', 'auditoria', 'bacen',
            'regulatório', 'suspeita', 'conformidade', 'risco'
        ],
        contabilidade: [
            'contábil', 'balanço', 'razão', 'diário', 'lançamento',
            'conciliação', 'fechamento', 'demonstrativo', 'dre', 'balancete'
        ]
    };

    static inferBusinessArea(incident) {
        const text = `${incident.title} ${incident.description}`.toLowerCase();
        const scores = {};

        // Calcular scores para cada área
        for (const [area, keywords] of Object.entries(this.businessAreaPatterns)) {
            scores[area] = keywords.filter(keyword =>
                text.includes(keyword)
            ).length;
        }

        // Retornar área com maior score
        const topArea = Object.entries(scores)
            .sort(([,a], [,b]) => b - a)[0];

        return topArea && topArea[1] > 0 ? topArea[0] : '';
    }

    // Inferir com base no contexto técnico também
    static inferFromTechnicalContext(incident) {
        const { technical_area, mainframe_job, mainframe_program } = incident;

        // Padrões específicos por sistema
        if (technical_area === 'mainframe') {
            if (mainframe_job?.startsWith('PAG') || mainframe_program?.startsWith('PAG')) {
                return 'pagamentos';
            }
            if (mainframe_job?.startsWith('COB') || mainframe_program?.startsWith('COB')) {
                return 'cobranca';
            }
            if (mainframe_job?.startsWith('CAD') || mainframe_program?.startsWith('CAD')) {
                return 'cadastro';
            }
        }

        // Fallback para inferência por texto
        return this.inferBusinessArea(incident);
    }
}

export default InferenceService;
```

---

## 🔐 FASE 2: SANITIZAÇÃO DE DADOS (Dia 2)

### 2.1 Serviço de Sanitização
**Novo arquivo:** `/mnt/c/mainframe-ai-assistant/scripts/data-sanitizer.js`
**Tempo:** 3-4 horas

```javascript
class DataSanitizer {
    // Patterns para dados sensíveis
    static patterns = {
        cpf: /\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11}/g,
        cnpj: /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14}/g,
        conta: /\d{4,6}-\d{1}|\d{5,7}/g,
        cartao: /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g,
        email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        telefone: /\(\d{2}\)\s?\d{4,5}-?\d{4}|\d{10,11}/g,
        nome_proprio: null, // Será carregado de lista
        valor_monetario: /R\$\s?\d+[\.\d]*,\d{2}/g
    };

    static sanitize(data) {
        const mapping = {};
        let sanitized = JSON.parse(JSON.stringify(data));
        let counter = 1;

        // Sanitizar cada campo de texto
        const fieldsToSanitize = ['title', 'description', 'mainframe_job',
                                   'mainframe_program', 'java_class'];

        for (const field of fieldsToSanitize) {
            if (!sanitized[field]) continue;

            let text = sanitized[field];

            // CPF
            text = text.replace(this.patterns.cpf, (match) => {
                const key = `[CPF_${counter++}]`;
                mapping[key] = match;
                return key;
            });

            // CNPJ
            text = text.replace(this.patterns.cnpj, (match) => {
                const key = `[CNPJ_${counter++}]`;
                mapping[key] = match;
                return key;
            });

            // Conta Bancária
            text = text.replace(this.patterns.conta, (match) => {
                const key = `[CONTA_${counter++}]`;
                mapping[key] = match;
                return key;
            });

            // Cartão
            text = text.replace(this.patterns.cartao, (match) => {
                const key = `[CARTAO_${counter++}]`;
                mapping[key] = match;
                return key;
            });

            // Email
            text = text.replace(this.patterns.email, (match) => {
                const key = `[EMAIL_${counter++}]`;
                mapping[key] = match;
                return key;
            });

            // Valores monetários (opcional - manter para contexto)
            // text = text.replace(this.patterns.valor_monetario, '[VALOR]');

            sanitized[field] = text;
        }

        // Adicionar metadados
        sanitized._sanitized = true;
        sanitized._timestamp = new Date().toISOString();

        // Registrar em log de auditoria
        this.logSanitization(data, sanitized, mapping);

        return { sanitized, mapping };
    }

    static restore(data, mapping) {
        if (!data._sanitized) return data;

        let restored = JSON.parse(JSON.stringify(data));

        // Restaurar cada campo
        for (const [key, value] of Object.entries(mapping)) {
            for (const field in restored) {
                if (typeof restored[field] === 'string') {
                    restored[field] = restored[field].replace(key, value);
                }
            }
        }

        delete restored._sanitized;
        delete restored._timestamp;

        return restored;
    }

    static logSanitization(original, sanitized, mapping) {
        const log = {
            timestamp: new Date().toISOString(),
            action: 'sanitization',
            fields_affected: Object.keys(mapping).length,
            patterns_found: Object.keys(mapping).map(k => k.split('_')[0]),
            user: localStorage.getItem('currentUser') || 'anonymous'
        };

        // Armazenar log (não inclui dados sensíveis)
        const logs = JSON.parse(localStorage.getItem('sanitization_logs') || '[]');
        logs.push(log);
        localStorage.setItem('sanitization_logs', JSON.stringify(logs));

        console.log('🔒 Dados sanitizados:', log);
    }
}

export default DataSanitizer;
```

---

## 🤖 FASE 3: INTEGRAÇÃO COM LLMs (Dias 3-4)

### 3.1 Serviço de LLM Unificado
**Novo arquivo:** `/mnt/c/mainframe-ai-assistant/scripts/llm-service.js`
**Tempo:** 1 dia

```javascript
import DataSanitizer from './data-sanitizer.js';

class LLMService {
    constructor() {
        this.providers = {
            gemini: this.callGemini.bind(this),
            openai: this.callOpenAI.bind(this),
            azure: this.callAzure.bind(this),
            github: this.callGitHubCopilot.bind(this)
        };
    }

    async analyzeIncident(incident, settings) {
        const { llmProvider, apiKey, useAI } = settings;

        if (!useAI) {
            console.log('IA desabilitada');
            return incident;
        }

        try {
            // 1. Sanitizar dados
            const { sanitized, mapping } = DataSanitizer.sanitize(incident);

            // 2. Preparar prompt
            const prompt = this.buildPrompt(sanitized);

            // 3. Chamar LLM apropriado
            const enrichedData = await this.providers[llmProvider](
                prompt,
                apiKey,
                sanitized
            );

            // 4. Restaurar dados sensíveis
            const restored = DataSanitizer.restore(enrichedData, mapping);

            // 5. Adicionar metadados
            restored._ai_enriched = true;
            restored._ai_provider = llmProvider;
            restored._ai_timestamp = new Date().toISOString();

            return restored;

        } catch (error) {
            console.error('Erro na análise com IA:', error);
            // Retornar dados originais em caso de erro
            return { ...incident, _ai_error: error.message };
        }
    }

    buildPrompt(incident) {
        return `
Você é um assistente especializado em análise de incidentes de TI bancária.

CONTEXTO DO INCIDENTE:
- Título: ${incident.title}
- Descrição: ${incident.description}
- Área Técnica: ${incident.technical_area}
- Área de Negócio: ${incident.business_area || 'não especificada'}
${incident.mainframe_job ? `- Job Mainframe: ${incident.mainframe_job}` : ''}
${incident.mainframe_program ? `- Programa: ${incident.mainframe_program}` : ''}
${incident.mainframe_abend ? `- ABEND: ${incident.mainframe_abend}` : ''}

TAREFAS:
1. Identificar a causa raiz provável
2. Sugerir solução imediata
3. Recomendar ações preventivas
4. Classificar severidade real (crítico/alto/médio/baixo)
5. Estimar tempo de resolução

IMPORTANTE:
- Seja específico e técnico
- Considere o contexto bancário
- Priorize estabilidade e segurança
- Mantenha conformidade regulatória

Retorne um JSON com os campos:
{
    "root_cause": "descrição da causa raiz",
    "immediate_solution": "passos para resolver",
    "preventive_actions": ["ação 1", "ação 2"],
    "severity": "crítico|alto|médio|baixo",
    "estimated_time": "tempo em horas",
    "technical_details": "detalhes técnicos adicionais",
    "business_impact": "impacto no negócio"
}`;
    }

    async callGemini(prompt, apiKey, data) {
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1024
                }
            })
        });

        const result = await response.json();
        const aiResponse = result.candidates[0].content.parts[0].text;

        // Parsear JSON da resposta
        const enrichment = JSON.parse(aiResponse);

        return { ...data, ...enrichment };
    }

    async callOpenAI(prompt, apiKey, data) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4',
                messages: [
                    { role: 'system', content: 'Você é um especialista em incidentes de TI bancária.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                response_format: { type: "json_object" }
            })
        });

        const result = await response.json();
        const enrichment = JSON.parse(result.choices[0].message.content);

        return { ...data, ...enrichment };
    }

    async callAzure(prompt, apiKey, data) {
        // Configuração específica do Azure
        const endpoint = localStorage.getItem('azure_endpoint');
        const deployment = localStorage.getItem('azure_deployment');

        const response = await fetch(`${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2023-05-15`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey
            },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: 'Você é um especialista em incidentes de TI bancária.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7
            })
        });

        const result = await response.json();
        const enrichment = JSON.parse(result.choices[0].message.content);

        return { ...data, ...enrichment };
    }

    async callGitHubCopilot(prompt, apiKey, data) {
        // GitHub Copilot for Business API
        const response = await fetch('https://api.github.com/copilot/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.copilot-preview+json'
            },
            body: JSON.stringify({
                prompt: prompt,
                max_tokens: 1000,
                temperature: 0.7
            })
        });

        const result = await response.json();
        const enrichment = JSON.parse(result.choices[0].text);

        return { ...data, ...enrichment };
    }
}

export default new LLMService();
```

---

## ✅ FASE 4: TELA DE VALIDAÇÃO (Dia 5)

### 4.1 Componente ValidationModal
**Adicionar em:** `Accenture-Mainframe-AI-Assistant-Integrated.html`
**Tempo:** 1 dia

```javascript
const ValidationModal = ({ isOpen, onClose, originalData, enrichedData, onConfirm }) => {
    const [editedData, setEditedData] = useState(enrichedData);
    const [showComparison, setShowComparison] = useState(true);

    if (!isOpen) return null;

    const handleConfirm = () => {
        onConfirm(editedData);
        onClose();
    };

    const getDifferences = () => {
        const diffs = [];
        const aiFields = ['root_cause', 'immediate_solution', 'preventive_actions',
                         'severity', 'estimated_time', 'business_impact'];

        for (const field of aiFields) {
            if (enrichedData[field] && enrichedData[field] !== originalData[field]) {
                diffs.push({
                    field,
                    original: originalData[field] || 'Não informado',
                    enriched: enrichedData[field]
                });
            }
        }
        return diffs;
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4">
                <div className="fixed inset-0 bg-black opacity-50" onClick={onClose}></div>

                <div className="relative bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
                    <div className="sticky top-0 bg-white border-b px-6 py-4">
                        <h2 className="text-2xl font-bold text-purple-800">
                            ✅ Validação de Dados Enriquecidos com IA
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">
                            Revise e confirme os dados antes de salvar o incidente
                        </p>
                    </div>

                    <div className="p-6">
                        {/* Toggle de visualização */}
                        <div className="mb-4">
                            <button
                                onClick={() => setShowComparison(!showComparison)}
                                className="px-4 py-2 bg-purple-100 text-purple-700 rounded"
                            >
                                {showComparison ? '📊 Ocultar Comparação' : '📊 Mostrar Comparação'}
                            </button>
                        </div>

                        {/* Comparação lado a lado */}
                        {showComparison && (
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="border rounded p-4 bg-gray-50">
                                    <h3 className="font-semibold mb-3 text-gray-700">
                                        📝 Dados Originais
                                    </h3>
                                    <div className="space-y-2">
                                        <div><strong>Título:</strong> {originalData.title}</div>
                                        <div><strong>Descrição:</strong> {originalData.description}</div>
                                        <div><strong>Prioridade:</strong> {originalData.priority}</div>
                                        <div><strong>Área Técnica:</strong> {originalData.technical_area}</div>
                                        <div><strong>Área Negócio:</strong> {originalData.business_area || 'Não informada'}</div>
                                    </div>
                                </div>

                                <div className="border rounded p-4 bg-green-50">
                                    <h3 className="font-semibold mb-3 text-green-700">
                                        🤖 Dados Enriquecidos com IA
                                    </h3>
                                    <div className="space-y-2">
                                        <div><strong>Título:</strong> {enrichedData.title}</div>
                                        <div><strong>Descrição:</strong> {enrichedData.description}</div>
                                        <div><strong>Prioridade:</strong> {enrichedData.priority}</div>
                                        <div><strong>Área Técnica:</strong> {enrichedData.technical_area}</div>
                                        <div><strong>Área Negócio:</strong> {enrichedData.business_area}</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Campos enriquecidos pela IA (editáveis) */}
                        <div className="border rounded p-4 bg-blue-50">
                            <h3 className="font-semibold mb-3 text-blue-700">
                                🎯 Análise da IA (Editável)
                            </h3>

                            <div className="space-y-4">
                                {/* Causa Raiz */}
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Causa Raiz Identificada:
                                    </label>
                                    <textarea
                                        value={editedData.root_cause || ''}
                                        onChange={(e) => setEditedData({...editedData, root_cause: e.target.value})}
                                        className="w-full p-2 border rounded"
                                        rows="2"
                                    />
                                </div>

                                {/* Solução Imediata */}
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Solução Sugerida:
                                    </label>
                                    <textarea
                                        value={editedData.immediate_solution || ''}
                                        onChange={(e) => setEditedData({...editedData, immediate_solution: e.target.value})}
                                        className="w-full p-2 border rounded"
                                        rows="3"
                                    />
                                </div>

                                {/* Severidade */}
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Severidade Real:
                                    </label>
                                    <select
                                        value={editedData.severity || 'medium'}
                                        onChange={(e) => setEditedData({...editedData, severity: e.target.value})}
                                        className="w-full p-2 border rounded"
                                    >
                                        <option value="critical">Crítico</option>
                                        <option value="high">Alto</option>
                                        <option value="medium">Médio</option>
                                        <option value="low">Baixo</option>
                                    </select>
                                </div>

                                {/* Tempo Estimado */}
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Tempo Estimado de Resolução:
                                    </label>
                                    <input
                                        type="text"
                                        value={editedData.estimated_time || ''}
                                        onChange={(e) => setEditedData({...editedData, estimated_time: e.target.value})}
                                        className="w-full p-2 border rounded"
                                        placeholder="Ex: 2 horas"
                                    />
                                </div>

                                {/* Impacto no Negócio */}
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Impacto no Negócio:
                                    </label>
                                    <textarea
                                        value={editedData.business_impact || ''}
                                        onChange={(e) => setEditedData({...editedData, business_impact: e.target.value})}
                                        className="w-full p-2 border rounded"
                                        rows="2"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Metadados da IA */}
                        {enrichedData._ai_provider && (
                            <div className="mt-4 p-3 bg-purple-100 rounded text-sm">
                                <span className="font-semibold">ℹ️ Análise realizada por:</span>{' '}
                                {enrichedData._ai_provider.toUpperCase()} em{' '}
                                {new Date(enrichedData._ai_timestamp).toLocaleString('pt-BR')}
                            </div>
                        )}
                    </div>

                    {/* Botões de ação */}
                    <div className="sticky bottom-0 bg-white border-t px-6 py-4">
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => onConfirm(originalData)}
                                className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                            >
                                Salvar Sem IA
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                            >
                                ✅ Confirmar e Salvar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
```

---

## 📚 FASE 5: BASE DE CONHECIMENTO (Dias 6-7)

### 5.1 Estrutura da Knowledge Base
**Novo arquivo:** `/mnt/c/mainframe-ai-assistant/scripts/database/knowledge-base-schema.sql`
**Tempo:** 1 dia

```sql
-- Tabela separada para Base de Conhecimento
CREATE TABLE knowledge_base (
    id SERIAL PRIMARY KEY,
    kb_type VARCHAR(50) NOT NULL, -- 'manual', 'runbook', 'best_practice', 'error_code'
    technical_area VARCHAR(50) NOT NULL,
    business_area VARCHAR(50),

    -- Metadados do conhecimento
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT[],
    keywords TEXT[],

    -- Informação específica por tipo
    error_codes TEXT[], -- Para kb_type = 'error_code'
    commands TEXT[],    -- Comandos relacionados
    prerequisites TEXT[],

    -- Solução estruturada
    problem_description TEXT,
    root_cause TEXT,
    solution_steps JSONB, -- Array de passos
    verification_steps JSONB,
    rollback_procedure TEXT,

    -- Metadados de gestão
    version INTEGER DEFAULT 1,
    created_by VARCHAR(100),
    approved_by VARCHAR(100),
    last_used TIMESTAMP,
    usage_count INTEGER DEFAULT 0,
    effectiveness_score DECIMAL(3,2), -- 0.00 a 1.00

    -- Vetorização para busca
    embedding vector(1536),

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_kb_type CHECK (
        kb_type IN ('manual', 'runbook', 'best_practice', 'error_code', 'troubleshooting')
    )
);

-- Índices para performance
CREATE INDEX idx_kb_technical_area ON knowledge_base(technical_area);
CREATE INDEX idx_kb_type ON knowledge_base(kb_type);
CREATE INDEX idx_kb_tags ON knowledge_base USING GIN(tags);
CREATE INDEX idx_kb_keywords ON knowledge_base USING GIN(keywords);
CREATE INDEX idx_kb_embedding ON knowledge_base USING ivfflat (embedding vector_cosine_ops);

-- Tabela de relacionamento KB <-> Incidentes
CREATE TABLE kb_incident_usage (
    id SERIAL PRIMARY KEY,
    kb_id INTEGER REFERENCES knowledge_base(id),
    incident_id INTEGER,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    was_helpful BOOLEAN,
    feedback TEXT,
    applied_by VARCHAR(100)
);

-- View para KB mais relevantes
CREATE VIEW kb_relevance AS
SELECT
    kb.*,
    COALESCE(kb.effectiveness_score, 0.5) * COALESCE(kb.usage_count, 0) as relevance_score,
    CASE
        WHEN kb.last_used > NOW() - INTERVAL '7 days' THEN 'recent'
        WHEN kb.last_used > NOW() - INTERVAL '30 days' THEN 'active'
        ELSE 'stale'
    END as freshness
FROM knowledge_base kb;
```

### 5.2 Serviço de Knowledge Base
**Novo arquivo:** `/mnt/c/mainframe-ai-assistant/scripts/knowledge-base-service.js`
**Tempo:** 1 dia

```javascript
class KnowledgeBaseService {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL
        });
    }

    // Buscar conhecimento relevante para um incidente
    async findRelevantKnowledge(incident, limit = 5) {
        const { technical_area, business_area, description,
                mainframe_abend, java_exception } = incident;

        // Construir query complexa
        const query = `
            WITH kb_scores AS (
                SELECT
                    kb.*,

                    -- Score por área técnica (peso: 30%)
                    CASE WHEN kb.technical_area = $1 THEN 0.30 ELSE 0 END as tech_score,

                    -- Score por área de negócio (peso: 20%)
                    CASE
                        WHEN kb.business_area = $2 THEN 0.20
                        WHEN kb.business_area IS NULL THEN 0.10
                        ELSE 0
                    END as business_score,

                    -- Score por código de erro (peso: 30%)
                    CASE
                        WHEN $3 = ANY(kb.error_codes) THEN 0.30
                        WHEN $4 = ANY(kb.error_codes) THEN 0.30
                        ELSE 0
                    END as error_score,

                    -- Score por similaridade vetorial (peso: 15%)
                    CASE
                        WHEN kb.embedding IS NOT NULL
                        THEN (1 - (kb.embedding <=> $5::vector)) * 0.15
                        ELSE 0
                    END as vector_score,

                    -- Score por efetividade histórica (peso: 5%)
                    COALESCE(kb.effectiveness_score, 0.5) * 0.05 as effectiveness_score

                FROM knowledge_base kb
                WHERE kb.technical_area = $1
            )
            SELECT
                *,
                (tech_score + business_score + error_score +
                 vector_score + effectiveness_score) as total_score
            FROM kb_scores
            ORDER BY total_score DESC
            LIMIT $6;
        `;

        const embedding = await this.generateEmbedding(description);

        const result = await this.pool.query(query, [
            technical_area,
            business_area,
            mainframe_abend,
            java_exception,
            embedding,
            limit
        ]);

        return result.rows;
    }

    // Adicionar novo conhecimento à base
    async addKnowledge(knowledge) {
        const {
            kb_type, technical_area, business_area,
            title, content, tags, keywords,
            error_codes, solution_steps, verification_steps
        } = knowledge;

        const embedding = await this.generateEmbedding(
            `${title} ${content} ${tags?.join(' ')}`
        );

        const query = `
            INSERT INTO knowledge_base (
                kb_type, technical_area, business_area,
                title, content, tags, keywords,
                error_codes, solution_steps, verification_steps,
                embedding, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id
        `;

        const values = [
            kb_type, technical_area, business_area,
            title, content, tags, keywords,
            error_codes,
            JSON.stringify(solution_steps),
            JSON.stringify(verification_steps),
            embedding,
            knowledge.created_by || 'system'
        ];

        const result = await this.pool.query(query, values);
        return result.rows[0].id;
    }

    // Registrar uso de KB em incidente
    async recordUsage(kbId, incidentId, wasHelpful, feedback) {
        // Registrar uso
        await this.pool.query(`
            INSERT INTO kb_incident_usage (kb_id, incident_id, was_helpful, feedback)
            VALUES ($1, $2, $3, $4)
        `, [kbId, incidentId, wasHelpful, feedback]);

        // Atualizar estatísticas
        await this.pool.query(`
            UPDATE knowledge_base
            SET
                usage_count = usage_count + 1,
                last_used = NOW(),
                effectiveness_score = (
                    SELECT AVG(CASE WHEN was_helpful THEN 1.0 ELSE 0.0 END)
                    FROM kb_incident_usage
                    WHERE kb_id = $1
                )
            WHERE id = $1
        `, [kbId]);
    }

    // Importar documentação existente
    async importDocumentation(filePath, metadata) {
        const content = await fs.readFile(filePath, 'utf-8');

        // Parser para diferentes formatos
        let parsed;
        if (filePath.endsWith('.md')) {
            parsed = this.parseMarkdown(content);
        } else if (filePath.endsWith('.json')) {
            parsed = JSON.parse(content);
        } else {
            parsed = { content };
        }

        // Extrair informações
        const knowledge = {
            kb_type: metadata.kb_type || 'manual',
            technical_area: metadata.technical_area,
            business_area: metadata.business_area,
            title: parsed.title || metadata.title,
            content: parsed.content,
            tags: this.extractTags(parsed.content),
            keywords: this.extractKeywords(parsed.content),
            error_codes: this.extractErrorCodes(parsed.content),
            solution_steps: parsed.steps || [],
            created_by: 'import'
        };

        return await this.addKnowledge(knowledge);
    }

    // Métodos auxiliares
    extractTags(content) {
        // Extrair tags do conteúdo
        const tagPattern = /#(\w+)/g;
        const tags = [];
        let match;
        while ((match = tagPattern.exec(content)) !== null) {
            tags.push(match[1]);
        }
        return tags;
    }

    extractKeywords(content) {
        // Extrair palavras-chave importantes
        const keywords = [];
        const patterns = [
            /ABEND\s+\w+/gi,
            /error\s+\w+/gi,
            /exception:\s*\w+/gi,
            /comando:\s*\w+/gi
        ];

        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                keywords.push(match[0]);
            }
        });

        return keywords;
    }

    extractErrorCodes(content) {
        // Extrair códigos de erro específicos
        const codes = [];
        const patterns = [
            /S0C[0-9A-F]/g,  // ABEND codes
            /SQL-?\d{3,5}/g,  // SQL codes
            /[A-Z]{3}\d{4}/g  // Generic error codes
        ];

        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                codes.push(match[0]);
            }
        });

        return codes;
    }

    async generateEmbedding(text) {
        // Usar mesma função do VectorSearchService
        return VectorSearchService.generateEmbedding(text);
    }
}

export default new KnowledgeBaseService();
```

### 5.3 Integração KB com Resolução
**Atualizar:** `IncidentResolutionPanel` para incluir KB
**Tempo:** 4 horas

```javascript
// Adicionar ao searchSimilarIncidents()
const searchSimilarIncidents = async () => {
    setIsSearching(true);
    try {
        const settings = JSON.parse(localStorage.getItem('apiSettings') || '{}');

        // 1. Buscar incidentes similares
        const similarResponse = await fetch('/api/incidents/similar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ incident, limit: 10 })
        });
        const similar = await similarResponse.json();
        setSimilarIncidents(similar);

        // 2. Buscar conhecimento relevante na KB
        const kbResponse = await fetch('/api/knowledge/relevant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ incident, limit: 5 })
        });
        const kbArticles = await kbResponse.json();
        setRelevantKnowledge(kbArticles);

        // 3. Se IA habilitada, combinar tudo para sugestão
        if (settings.useAI && settings.apiKey) {
            const suggestion = await LLMService.suggestResolution(
                incident,
                similar,
                kbArticles, // Adicionar KB ao contexto
                settings
            );
            setAiSuggestion(suggestion);
            setShowAIAnalysis(true);
        }

    } catch (error) {
        console.error('Erro ao buscar soluções:', error);
    } finally {
        setIsSearching(false);
    }
};
```

---

## 🔍 FASE 6: BUSCA INTELIGENTE (Dias 8-9)

### 5.1 PostgreSQL com pgvector
**Novo arquivo:** `/mnt/c/mainframe-ai-assistant/scripts/database/postgresql-setup.sql`
**Tempo:** 1 dia

```sql
-- Criar extensão para vetores
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabela principal de incidentes
CREATE TABLE incidents_v2 (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    technical_area VARCHAR(50) NOT NULL,
    business_area VARCHAR(50),
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'open',

    -- Campos específicos por área
    mainframe_job VARCHAR(100),
    mainframe_program VARCHAR(100),
    mainframe_abend VARCHAR(10),
    java_class VARCHAR(255),
    java_exception VARCHAR(255),

    -- Campos enriquecidos pela IA
    root_cause TEXT,
    immediate_solution TEXT,
    preventive_actions JSONB,
    severity VARCHAR(20),
    estimated_time VARCHAR(50),
    business_impact TEXT,

    -- Embedding para busca vetorial
    embedding vector(1536),

    -- Metadados
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    ai_enriched BOOLEAN DEFAULT FALSE,
    ai_provider VARCHAR(50),

    -- Índices para performance
    CONSTRAINT valid_technical_area CHECK (
        technical_area IN ('mainframe', 'java', 'csharp', 'database', 'network')
    )
);

-- Índices otimizados
CREATE INDEX idx_technical_area ON incidents_v2(technical_area);
CREATE INDEX idx_business_area ON incidents_v2(business_area);
CREATE INDEX idx_status ON incidents_v2(status);
CREATE INDEX idx_created_at ON incidents_v2(created_at DESC);
CREATE INDEX idx_embedding ON incidents_v2 USING ivfflat (embedding vector_cosine_ops);

-- Tabela de histórico
CREATE TABLE incident_history (
    id SERIAL PRIMARY KEY,
    incident_id INTEGER REFERENCES incidents_v2(id),
    action VARCHAR(50),
    old_value JSONB,
    new_value JSONB,
    changed_by VARCHAR(100),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- View para busca otimizada
CREATE VIEW incident_search AS
SELECT
    i.*,
    COALESCE(i.severity, i.priority) as effective_priority,
    EXTRACT(EPOCH FROM (NOW() - i.created_at))/3600 as hours_old
FROM incidents_v2 i;
```

### 5.2 Serviço de Busca Vetorial
**Novo arquivo:** `/mnt/c/mainframe-ai-assistant/scripts/vector-search.js`
**Tempo:** 1 dia

```javascript
import { Pool } from 'pg';

class VectorSearchService {
    constructor() {
        this.pool = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'incidents_db',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD
        });
    }

    async findSimilarIncidents(incident, limit = 10) {
        const { technical_area, business_area, description } = incident;

        // Gerar embedding do incidente atual
        const embedding = await this.generateEmbedding(description);

        // Query complexa com pesos
        const query = `
            WITH similarity_scores AS (
                SELECT
                    i.*,
                    -- Similaridade vetorial (25%)
                    (1 - (i.embedding <=> $1::vector)) * 0.25 as vector_score,

                    -- Match de área de negócio (45%)
                    CASE
                        WHEN i.business_area = $3 THEN 0.45
                        WHEN i.business_area IS NULL OR $3 IS NULL THEN 0.20
                        ELSE 0
                    END as business_score,

                    -- Match de códigos de erro (20%)
                    CASE
                        WHEN i.mainframe_abend = $4 AND $4 IS NOT NULL THEN 0.20
                        WHEN i.java_exception = $5 AND $5 IS NOT NULL THEN 0.20
                        ELSE 0
                    END as error_score,

                    -- Recência (10%)
                    CASE
                        WHEN i.created_at > NOW() - INTERVAL '7 days' THEN 0.10
                        WHEN i.created_at > NOW() - INTERVAL '30 days' THEN 0.05
                        ELSE 0
                    END as recency_score

                FROM incidents_v2 i
                WHERE
                    i.technical_area = $2
                    AND i.status = 'resolved'
                    AND i.embedding IS NOT NULL
            )
            SELECT
                *,
                (vector_score + business_score + error_score + recency_score) as total_relevance
            FROM similarity_scores
            ORDER BY total_relevance DESC
            LIMIT $6;
        `;

        const result = await this.pool.query(query, [
            embedding,
            technical_area,
            business_area,
            incident.mainframe_abend,
            incident.java_exception,
            limit
        ]);

        return result.rows.map(row => ({
            ...row,
            relevance_percentage: Math.round(row.total_relevance * 100),
            relevance_breakdown: {
                similarity: Math.round(row.vector_score * 100),
                business: Math.round(row.business_score * 100),
                error_match: Math.round(row.error_score * 100),
                recency: Math.round(row.recency_score * 100)
            }
        }));
    }

    async generateEmbedding(text) {
        // Usar API de embeddings (OpenAI, Cohere, etc.)
        const settings = JSON.parse(localStorage.getItem('apiSettings') || '{}');

        if (settings.llmProvider === 'openai' && settings.apiKey) {
            const response = await fetch('https://api.openai.com/v1/embeddings', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${settings.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'text-embedding-ada-002',
                    input: text
                })
            });

            const data = await response.json();
            return data.data[0].embedding;
        }

        // Fallback: embedding local simples (não recomendado para produção)
        return this.generateLocalEmbedding(text);
    }

    generateLocalEmbedding(text) {
        // Embedding simples baseado em hash para testes
        // Em produção, usar modelo real de embeddings
        const vector = new Array(1536).fill(0);
        const words = text.toLowerCase().split(/\s+/);

        words.forEach((word, i) => {
            const hash = this.hashCode(word);
            const index = Math.abs(hash) % 1536;
            vector[index] = (vector[index] + 1) / words.length;
        });

        return vector;
    }

    hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash;
    }
}

export default new VectorSearchService();
```

---

## 🔄 FASE 6: MIGRAÇÃO DE DADOS (Dia 8)

### 6.1 Script de Migração SQLite → PostgreSQL
**Novo arquivo:** `/mnt/c/mainframe-ai-assistant/scripts/migrate-to-postgresql.js`
**Tempo:** 4 horas

```javascript
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const LLMService = require('./llm-service');
const VectorSearchService = require('./vector-search');

class DataMigration {
    constructor() {
        this.sqliteDb = new sqlite3.Database('./data/incidents.db');
        this.pgPool = new Pool({
            connectionString: process.env.DATABASE_URL
        });
    }

    async migrate() {
        console.log('🚀 Iniciando migração SQLite → PostgreSQL...');

        try {
            // 1. Ler todos os incidentes do SQLite
            const incidents = await this.readFromSQLite();
            console.log(`📊 ${incidents.length} incidentes encontrados`);

            // 2. Enriquecer com IA (opcional)
            const enriched = await this.enrichIncidents(incidents);

            // 3. Gerar embeddings
            const withEmbeddings = await this.generateEmbeddings(enriched);

            // 4. Inserir no PostgreSQL
            await this.insertToPostgreSQL(withEmbeddings);

            console.log('✅ Migração concluída com sucesso!');

        } catch (error) {
            console.error('❌ Erro na migração:', error);
            throw error;
        }
    }

    readFromSQLite() {
        return new Promise((resolve, reject) => {
            this.sqliteDb.all(`
                SELECT * FROM incidents
                ORDER BY created_date DESC
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    async enrichIncidents(incidents) {
        const settings = JSON.parse(localStorage.getItem('apiSettings') || '{}');

        if (!settings.useAI) {
            console.log('⏭️ IA desabilitada, pulando enriquecimento');
            return incidents;
        }

        console.log('🤖 Enriquecendo incidentes com IA...');
        const enriched = [];

        for (let i = 0; i < incidents.length; i++) {
            console.log(`Processando ${i + 1}/${incidents.length}...`);

            try {
                const enrichedIncident = await LLMService.analyzeIncident(
                    incidents[i],
                    settings
                );
                enriched.push(enrichedIncident);
            } catch (error) {
                console.warn(`Erro ao enriquecer incidente ${incidents[i].id}:`, error);
                enriched.push(incidents[i]);
            }

            // Rate limiting
            if (i % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        return enriched;
    }

    async generateEmbeddings(incidents) {
        console.log('🧮 Gerando embeddings...');
        const withEmbeddings = [];

        for (const incident of incidents) {
            const text = `${incident.title} ${incident.description}`;
            const embedding = await VectorSearchService.generateEmbedding(text);

            withEmbeddings.push({
                ...incident,
                embedding
            });
        }

        return withEmbeddings;
    }

    async insertToPostgreSQL(incidents) {
        console.log('💾 Inserindo no PostgreSQL...');

        for (const incident of incidents) {
            const query = `
                INSERT INTO incidents_v2 (
                    title, description, technical_area, business_area,
                    priority, status, mainframe_job, mainframe_program,
                    mainframe_abend, root_cause, immediate_solution,
                    severity, estimated_time, business_impact,
                    embedding, created_at, ai_enriched
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                    $11, $12, $13, $14, $15, $16, $17
                )
            `;

            const values = [
                incident.title,
                incident.description,
                incident.technical_area || 'mainframe',
                incident.business_area,
                incident.priority,
                incident.status,
                incident.mainframe_job,
                incident.mainframe_program,
                incident.mainframe_abend,
                incident.root_cause,
                incident.immediate_solution,
                incident.severity,
                incident.estimated_time,
                incident.business_impact,
                incident.embedding,
                incident.created_date || new Date(),
                incident._ai_enriched || false
            ];

            await this.pgPool.query(query, values);
        }

        console.log(`✅ ${incidents.length} incidentes migrados`);
    }
}

// Executar migração
if (require.main === module) {
    const migration = new DataMigration();
    migration.migrate()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = DataMigration;
```

---

## 🔧 FASE 7: INTERFACE DE RESOLUÇÃO DE INCIDENTES (Dias 9-10)

### 7.1 Interface de Busca e Resolução
**Adicionar em:** `Accenture-Mainframe-AI-Assistant-Integrated.html`
**Tempo:** 1 dia

```javascript
const IncidentResolutionPanel = ({ incident, isOpen, onClose }) => {
    const [similarIncidents, setSimilarIncidents] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedSolution, setSelectedSolution] = useState(null);
    const [aiSuggestion, setAiSuggestion] = useState(null);
    const [showAIAnalysis, setShowAIAnalysis] = useState(false);

    useEffect(() => {
        if (isOpen && incident) {
            searchSimilarIncidents();
        }
    }, [isOpen, incident]);

    const searchSimilarIncidents = async () => {
        setIsSearching(true);
        try {
            const settings = JSON.parse(localStorage.getItem('apiSettings') || '{}');

            // 1. Buscar incidentes similares
            const response = await fetch('/api/incidents/similar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    incident,
                    limit: 10,
                    useAI: settings.useAI
                })
            });

            const similar = await response.json();
            setSimilarIncidents(similar);

            // 2. Se IA habilitada, obter sugestão de resolução
            if (settings.useAI && settings.apiKey) {
                const suggestion = await LLMService.suggestResolution(
                    incident,
                    similar,
                    settings
                );
                setAiSuggestion(suggestion);
                setShowAIAnalysis(true);
            }

        } catch (error) {
            console.error('Erro ao buscar soluções:', error);
        } finally {
            setIsSearching(false);
        }
    };

    const applySelectedSolution = async () => {
        if (!selectedSolution) return;

        const updates = {
            status: 'in_progress',
            resolution: selectedSolution.solution,
            estimated_time: selectedSolution.estimated_time,
            assigned_to: localStorage.getItem('currentUser'),
            resolution_source: selectedSolution.source // 'similar', 'ai', 'manual'
        };

        await updateIncident(incident.id, updates);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4">
                <div className="fixed inset-0 bg-black opacity-50" onClick={onClose}></div>

                <div className="relative bg-white rounded-lg max-w-7xl w-full max-h-[90vh] overflow-hidden">
                    {/* Header */}
                    <div className="sticky top-0 bg-white border-b px-6 py-4">
                        <h2 className="text-2xl font-bold text-purple-800">
                            🔍 Resolução de Incidente
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">
                            {incident.title} - {incident.technical_area}
                        </p>
                    </div>

                    <div className="flex h-[80vh]">
                        {/* Painel Esquerdo - Detalhes do Incidente */}
                        <div className="w-1/3 border-r overflow-y-auto p-6">
                            <h3 className="font-semibold mb-3">📋 Detalhes do Incidente</h3>

                            <div className="space-y-3 text-sm">
                                <div>
                                    <strong>Descrição:</strong>
                                    <p className="mt-1">{incident.description}</p>
                                </div>
                                <div>
                                    <strong>Área Técnica:</strong> {incident.technical_area}
                                </div>
                                <div>
                                    <strong>Área de Negócio:</strong> {incident.business_area}
                                </div>
                                <div>
                                    <strong>Prioridade:</strong>
                                    <span className={`ml-2 px-2 py-1 rounded text-white
                                        ${incident.priority === 'critical' ? 'bg-red-500' :
                                          incident.priority === 'high' ? 'bg-orange-500' :
                                          incident.priority === 'medium' ? 'bg-yellow-500' :
                                          'bg-green-500'}`}>
                                        {incident.priority}
                                    </span>
                                </div>

                                {incident.mainframe_abend && (
                                    <div>
                                        <strong>ABEND:</strong> {incident.mainframe_abend}
                                    </div>
                                )}
                                {incident.java_exception && (
                                    <div>
                                        <strong>Exception:</strong> {incident.java_exception}
                                    </div>
                                )}
                            </div>

                            {/* Sugestão da IA */}
                            {aiSuggestion && showAIAnalysis && (
                                <div className="mt-6 p-4 bg-purple-50 rounded">
                                    <h4 className="font-semibold mb-2 text-purple-800">
                                        🤖 Análise da IA
                                    </h4>
                                    <div className="space-y-2 text-sm">
                                        <div>
                                            <strong>Causa Raiz:</strong>
                                            <p>{aiSuggestion.root_cause}</p>
                                        </div>
                                        <div>
                                            <strong>Solução Recomendada:</strong>
                                            <p>{aiSuggestion.recommended_solution}</p>
                                        </div>
                                        <div>
                                            <strong>Confiança:</strong>
                                            <div className="w-full bg-gray-200 rounded mt-1">
                                                <div
                                                    className="bg-purple-600 text-xs text-white text-center py-1 rounded"
                                                    style={{width: `${aiSuggestion.confidence}%`}}
                                                >
                                                    {aiSuggestion.confidence}%
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setSelectedSolution({
                                                solution: aiSuggestion.recommended_solution,
                                                estimated_time: aiSuggestion.estimated_time,
                                                source: 'ai'
                                            })}
                                            className="mt-2 px-3 py-1 bg-purple-600 text-white rounded text-sm"
                                        >
                                            Usar Esta Solução
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Painel Central - Incidentes Similares */}
                        <div className="w-2/3 p-6 overflow-y-auto">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-semibold">
                                    🔄 Incidentes Similares Resolvidos
                                </h3>
                                {isSearching && (
                                    <span className="text-sm text-gray-500">Buscando...</span>
                                )}
                            </div>

                            {similarIncidents.length === 0 && !isSearching ? (
                                <div className="text-center py-8 text-gray-500">
                                    Nenhum incidente similar encontrado
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {similarIncidents.map((similar, idx) => (
                                        <div
                                            key={similar.id}
                                            className="border rounded p-4 hover:bg-gray-50 cursor-pointer"
                                            onClick={() => setSelectedSolution({
                                                solution: similar.resolution,
                                                estimated_time: similar.resolution_time,
                                                source: 'similar'
                                            })}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <h4 className="font-medium text-purple-700">
                                                        #{similar.id} - {similar.title}
                                                    </h4>
                                                    <p className="text-sm text-gray-600 mt-1">
                                                        {similar.description}
                                                    </p>
                                                </div>
                                                <div className="ml-4 text-right">
                                                    <div className="text-lg font-bold text-purple-600">
                                                        {similar.relevance_percentage}%
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        relevância
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Breakdown da Relevância */}
                                            {similar.relevance_breakdown && (
                                                <div className="mt-3 flex space-x-4 text-xs">
                                                    <span className="text-gray-600">
                                                        Negócio: {similar.relevance_breakdown.business}%
                                                    </span>
                                                    <span className="text-gray-600">
                                                        Semântica: {similar.relevance_breakdown.similarity}%
                                                    </span>
                                                    <span className="text-gray-600">
                                                        Erro: {similar.relevance_breakdown.error_match}%
                                                    </span>
                                                    <span className="text-gray-600">
                                                        Recência: {similar.relevance_breakdown.recency}%
                                                    </span>
                                                </div>
                                            )}

                                            {/* Solução Aplicada */}
                                            <div className="mt-3 p-3 bg-green-50 rounded">
                                                <div className="text-sm">
                                                    <strong className="text-green-700">Solução Aplicada:</strong>
                                                    <p className="mt-1">{similar.resolution}</p>
                                                </div>
                                                <div className="mt-2 flex justify-between text-xs text-gray-600">
                                                    <span>Resolvido em: {similar.resolution_time}</span>
                                                    <span>Por: {similar.resolved_by}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer - Solução Selecionada */}
                    {selectedSolution && (
                        <div className="sticky bottom-0 bg-white border-t px-6 py-4">
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <h4 className="font-semibold text-purple-700">
                                        ✅ Solução Selecionada
                                    </h4>
                                    <p className="text-sm mt-1">{selectedSolution.solution}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Fonte: {selectedSolution.source === 'ai' ? '🤖 IA' : '📚 Histórico'} |
                                        Tempo estimado: {selectedSolution.estimated_time}
                                    </p>
                                </div>
                                <div className="flex space-x-3">
                                    <button
                                        onClick={onClose}
                                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={applySelectedSolution}
                                        className="px-4 py-2 bg-purple-600 text-white rounded"
                                    >
                                        Aplicar Solução
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
```

### 7.2 Serviço de Sugestão de Resolução com IA
**Adicionar em:** `/mnt/c/mainframe-ai-assistant/scripts/llm-service.js`
**Tempo:** 4 horas

```javascript
// Adicionar método ao LLMService
async suggestResolution(incident, similarIncidents, kbArticles, settings) {
    const { llmProvider, apiKey } = settings;

    const prompt = `
Você é um especialista em resolução de incidentes de TI bancária.

INCIDENTE ATUAL:
${JSON.stringify(incident, null, 2)}

BASE DE CONHECIMENTO RELEVANTE:
${kbArticles.slice(0, 3).map((kb, i) => `
${i + 1}. [${kb.kb_type.toUpperCase()}] ${kb.title}
   Conteúdo: ${kb.content.substring(0, 500)}...
   Códigos de Erro: ${kb.error_codes?.join(', ') || 'N/A'}
   Passos de Solução: ${kb.solution_steps?.length || 0} passos documentados
   Taxa de Sucesso: ${Math.round(kb.effectiveness_score * 100)}%
   Usado ${kb.usage_count} vezes
`).join('\n')}

INCIDENTES SIMILARES RESOLVIDOS:
${similarIncidents.slice(0, 5).map((s, i) => `
${i + 1}. Título: ${s.title}
   Problema: ${s.description}
   Solução: ${s.resolution}
   Tempo: ${s.resolution_time}
   Relevância: ${s.relevance_percentage}%
`).join('\n')}

TAREFA:
Baseando-se nos incidentes similares e seu conhecimento, sugira:
1. A causa raiz mais provável
2. A melhor solução a ser aplicada
3. Passos detalhados para resolução
4. Tempo estimado
5. Nível de confiança na solução (0-100%)

Retorne JSON:
{
    "root_cause": "descrição",
    "recommended_solution": "solução detalhada",
    "steps": ["passo 1", "passo 2", ...],
    "estimated_time": "tempo",
    "confidence": 85,
    "risks": ["risco 1", "risco 2"],
    "preventive_measures": ["medida 1", "medida 2"]
}`;

    const enrichedData = await this.providers[llmProvider](
        prompt,
        apiKey,
        {}
    );

    return enrichedData;
}
```

---

## 🎨 FASE 8: INTEGRAÇÃO FINAL (Dia 11)

### 7.1 Atualizar Fluxo do CreateIncidentModal
**Arquivo:** `Accenture-Mainframe-AI-Assistant-Integrated.html`
**Tempo:** 4 horas

```javascript
// Adicionar imports no início
import InferenceService from './scripts/inference-service.js';
import LLMService from './scripts/llm-service.js';

// Atualizar handleSubmit
const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
        // 1. Inferir área de negócio se não informada
        if (!formData.business_area) {
            const inferred = InferenceService.inferFromTechnicalContext(formData);
            if (inferred) {
                formData.business_area = inferred;
                console.log(`📊 Área de negócio inferida: ${inferred}`);
            }
        }

        // 2. Obter configurações de API
        const settings = JSON.parse(localStorage.getItem('apiSettings') || '{}');

        // 3. Se IA habilitada, enriquecer dados
        let finalData = formData;
        if (settings.useAI && settings.apiKey) {
            console.log('🤖 Analisando com IA...');

            const enrichedData = await LLMService.analyzeIncident(formData, settings);

            // 4. Mostrar tela de validação
            setShowValidation(true);
            setEnrichedData(enrichedData);

            // Aguardar confirmação do usuário (via callback)
            return;
        }

        // 5. Se IA desabilitada, salvar direto
        await saveIncident(finalData);

    } catch (error) {
        console.error('Erro ao processar incidente:', error);
        alert('Erro ao processar incidente: ' + error.message);
    } finally {
        setIsSubmitting(false);
    }
};

// Callback para confirmação da validação
const handleValidationConfirm = async (confirmedData) => {
    try {
        await saveIncident(confirmedData);
        setShowValidation(false);
        setEnrichedData(null);
        resetForm();
        alert('✅ Incidente salvo com sucesso!');
    } catch (error) {
        console.error('Erro ao salvar:', error);
        alert('Erro ao salvar incidente: ' + error.message);
    }
};

// Função para salvar incidente
const saveIncident = async (data) => {
    const response = await fetch('http://localhost:3001/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        throw new Error('Erro ao salvar incidente');
    }

    const saved = await response.json();

    // Atualizar lista local
    setIncidents(prev => [saved, ...prev]);

    return saved;
};
```

---

## 📊 CRONOGRAMA RESUMIDO

| Dia | Fase | Entregável |
|-----|------|------------|
| **1** | Campos de Contexto | CreateIncidentModal com technical/business area |
| **2** | Sanitização | DataSanitizer funcionando |
| **3-4** | Integração LLMs | LLMService com 4 providers |
| **5** | Tela Validação | ValidationModal completo |
| **6-7** | Base de Conhecimento | Knowledge Base estrutura + serviço |
| **8-9** | Busca Vetorial | PostgreSQL + pgvector + busca |
| **10** | Migração | SQLite → PostgreSQL + importar KB |
| **11-12** | Interface Resolução | IncidentResolutionPanel com KB + IA |
| **13** | Integração | Sistema completo funcionando |
| **14** | Testes | Testes e ajustes finais |

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1 - Fundação
- [ ] Adicionar campos technical_area e business_area
- [ ] Implementar campos dinâmicos por área técnica
- [ ] Criar serviço de inferência
- [ ] Validar campo obrigatório technical_area

### Fase 2 - Sanitização
- [ ] Implementar patterns de dados sensíveis
- [ ] Criar método sanitize()
- [ ] Criar método restore()
- [ ] Adicionar log de auditoria

### Fase 3 - LLMs
- [ ] Integrar Gemini API
- [ ] Integrar OpenAI API
- [ ] Integrar Azure OpenAI
- [ ] Integrar GitHub Copilot
- [ ] Implementar prompt engineering

### Fase 4 - Validação
- [ ] Criar ValidationModal
- [ ] Implementar comparação visual
- [ ] Permitir edição de campos
- [ ] Integrar fluxo de confirmação

### Fase 5 - Base de Conhecimento
- [ ] Criar schema KB no PostgreSQL
- [ ] Implementar KnowledgeBaseService
- [ ] Importar documentação existente
- [ ] Criar APIs de busca na KB
- [ ] Tracking de efetividade

### Fase 6 - Busca Vetorial
- [ ] Setup PostgreSQL
- [ ] Instalar pgvector
- [ ] Criar schema
- [ ] Implementar busca com pesos

### Fase 6 - Migração
- [ ] Exportar SQLite
- [ ] Gerar embeddings
- [ ] Importar PostgreSQL
- [ ] Validar integridade

### Fase 7 - Interface de Resolução
- [ ] Criar IncidentResolutionPanel
- [ ] Implementar busca de similares
- [ ] Integrar sugestões da IA
- [ ] Permitir seleção de solução
- [ ] Aplicar solução ao incidente
- [ ] Tracking de fonte da solução (IA/histórico)

### Fase 8 - Integração
- [ ] Atualizar CreateIncidentModal
- [ ] Integrar todos os serviços
- [ ] Testar fluxo completo
- [ ] Documentar APIs

---

## 🎯 MÉTRICAS DE SUCESSO

1. **Funcionalidade**
   - ✅ Sistema funciona com e sem IA
   - ✅ Dados sensíveis protegidos
   - ✅ Inferência funciona em 80%+ dos casos
   - ✅ Busca retorna resultados relevantes

2. **Performance**
   - ⚡ Busca < 200ms
   - ⚡ Análise IA < 3s
   - ⚡ Inferência < 100ms
   - ⚡ UI responsiva

3. **Qualidade**
   - 🎯 Relevância > 70% nas buscas
   - 🎯 Sanitização 100% efetiva
   - 🎯 Zero vazamento de dados
   - 🎯 Fallbacks funcionando

---

**Status:** Plano Completo e Pronto para Execução
**Tempo Total:** 10 dias úteis
**Próximo Passo:** Começar pela Fase 1 - Adicionar campos de contexto