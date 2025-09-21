# Lista de Micro-Tarefas - Sistema de Gestão de Incidentes
## Baseada na Validação de Requisitos e Análise de Implementação

**Data de Criação:** 18 de setembro de 2025
**Baseado nos Documentos:**
- Validação de Requisitos dos Incidentes (`INCIDENT_REQUIREMENTS_VALIDATION.md`)
- Relatório de Validação Abrangente (`COMPREHENSIVE_VALIDATION_REPORT.md`)
- Relatório de Validação de Funcionalidades MVP (`MVP_FEATURE_VALIDATION_REPORT.md`)
- Implementação atual: `IncidentService.ts`, `IncidentHandler.ts`, `incident-schema.sql`

---

## 📊 RESUMO EXECUTIVO

**Total de Micro-Tarefas:** 78 tarefas
- **BLOQUEADORAS:** 18 tarefas (devem ser feitas primeiro)
- **ALTA PRIORIDADE:** 24 tarefas
- **MÉDIA PRIORIDADE:** 22 tarefas
- **BAIXA PRIORIDADE:** 14 tarefas

**Estimativa Total:** 380+ horas de desenvolvimento

---

## 🚨 TAREFAS BLOQUEADORAS (18 tarefas - 85 horas)

### B01. Estados em Português - CRÍTICO ⚡
- **Descrição:** Alinhar estados do sistema com nomenclatura portuguesa dos requisitos
- **Arquivos:** `src/renderer/services/IncidentService.ts` linha 351-362, `src/main/ipc/handlers/IncidentHandler.ts`
- **Horas:** 4h
- **Dependências:** Nenhuma
- **Detalhes:**
  - ❌ ATUAL: 'open', 'assigned', 'in_progress', 'resolved', 'closed'
  - ✅ REQUERIDO: 'aberto', 'em_revisao', 'resolvido', 'fechado'

### B02. Mapeamento de Estados Automático
- **Descrição:** Implementar atribuição automática de estados baseada no método de criação
- **Arquivos:** `src/main/ipc/handlers/IncidentHandler.ts` linha 592-627
- **Horas:** 6h
- **Dependências:** B01
- **Detalhes:**
  - Bulk upload → "em_revisao"
  - Manual/único → "aberto"
  - Integração API → "em_revisao"

### B03. Botão de Tratamento Condicional
- **Descrição:** Adicionar botão "Tratamento" APENAS para incidentes no estado "aberto"
- **Arquivos:** `src/renderer/components/incident/IncidentQueue.tsx`, novos componentes
- **Horas:** 5h
- **Dependências:** B01, B02

### B04. Sistema de Upload em Massa - CRÍTICO ⚡
- **Descrição:** Criar sistema completo de carregamento de múltiplos arquivos
- **Arquivos:** Novo `src/services/BulkUploadService.ts`, `src/renderer/components/forms/BulkUploadForm.tsx`
- **Horas:** 12h
- **Dependências:** Nenhuma
- **Detalhes:**
  - Suporte: PDF, Word, Excel, TXT
  - Interface de drag-and-drop
  - Preview antes do upload
  - Processamento em lote

### B05. Handler IPC para Upload em Massa
- **Descrição:** Adicionar handler 'incident:bulk:upload' no main process
- **Arquivos:** `src/main/ipc/handlers/IncidentHandler.ts` (adicionar método)
- **Horas:** 4h
- **Dependências:** B04

### B06. Validação de Transições de Estado
- **Descrição:** Implementar validação de transições com estados portugueses
- **Arquivos:** `src/renderer/services/IncidentService.ts` linha 350-362
- **Horas:** 3h
- **Dependências:** B01, B02

### B07. Busca Inteligente Automática
- **Descrição:** Implementar busca automática quando incidente muda para "aberto"
- **Arquivos:** Novo `src/services/AutoSearchService.ts`, triggers no banco
- **Horas:** 8h
- **Dependências:** B01, B02, B03

### B08. Integração com Sistema de Ticketing
- **Descrição:** Criar API endpoints para integração externa
- **Arquivos:** Novo `src/api/TicketingIntegration.ts`, `src/main/api/`
- **Horas:** 10h
- **Dependências:** B01, B02

### B09. Workflow de Análise Inteligente
- **Descrição:** Implementar fluxo completo de análise via IA
- **Arquivos:** Novo `src/services/AIAnalysisService.ts`, integração com Gemini
- **Horas:** 8h
- **Dependências:** B03

### B10. Sistema de Comentários Ativos/Inativos
- **Descrição:** Adicionar estados ativo/inativo para comentários
- **Arquivos:** `src/database/incident-schema.sql` (alterar tabela), `IncidentHandler.ts`
- **Horas:** 4h
- **Dependências:** Nenhuma
- **SQL:** `ALTER TABLE incident_comments ADD COLUMN active BOOLEAN DEFAULT TRUE`

### B11. Inativação de Comentários com Log
- **Descrição:** Implementar inativação com log da ação original
- **Arquivos:** `src/main/ipc/handlers/IncidentHandler.ts`, novos métodos
- **Horas:** 5h
- **Dependências:** B10

### B12. Proposta de Solução LLM
- **Descrição:** Implementar geração de propostas via LLM configurado
- **Arquivos:** Novo `src/services/SolutionProposalService.ts`
- **Horas:** 6h
- **Dependências:** B09

### B13. Interface Aceitar/Rejeitar Solução
- **Descrição:** Criar UI para classificação de soluções propostas
- **Arquivos:** Novo `src/renderer/components/incident/SolutionProposalPanel.tsx`
- **Horas:** 5h
- **Dependências:** B12

### B14. Workflow de Rejeição com Nova Análise
- **Descrição:** Implementar fluxo de rejeição → questionamento → nova análise
- **Arquivos:** Extensão de `SolutionProposalPanel.tsx`, novo modal
- **Horas:** 4h
- **Dependências:** B13

### B15. Contexto de Incidentes Relacionados
- **Descrição:** Passar contexto de incidentes relacionados para LLM
- **Arquivos:** `SolutionProposalService.ts`, `src/services/ContextBuilderService.ts`
- **Horas:** 5h
- **Dependências:** B12

### B16. Log de Ações do Utilizador - Específico
- **Descrição:** Implementar logs específicos para TODAS as ações mencionadas nos requisitos
- **Arquivos:** `src/database/incident-schema.sql`, novo `src/services/ActionLogService.ts`
- **Horas:** 6h
- **Dependências:** Nenhuma
- **Detalhes:**
  - Log de visualização de incidentes relacionados (Req #11)
  - Log de início de análise inteligente (Req #12)
  - Log de classificação de soluções (Req #16)

### B17. Alargamento Semântico LLM
- **Descrição:** Implementar expansão semântica do contexto via LLM
- **Arquivos:** Novo `src/services/SemanticExpansionService.ts`
- **Horas:** 7h
- **Dependências:** B09, B15

### B18. Referências a Incidentes na Solução
- **Descrição:** Incluir referências aos incidentes fonte na proposta de solução
- **Arquivos:** `SolutionProposalService.ts`, template de resposta
- **Horas:** 3h
- **Dependências:** B12, B15

---

## 🔥 ALTA PRIORIDADE (24 tarefas - 120 horas)

### A01. Correção de Acessibilidade WCAG
- **Descrição:** Corrigir contraste de cores para cumprir WCAG 2.1 AA
- **Arquivos:** `src/renderer/styles/`, todos os componentes CSS
- **Horas:** 8h
- **Dependências:** Nenhuma
- **Detalhes:** Atual 2.8:1 → Requerido 4.5:1

### A02. Responsividade Mobile
- **Descrição:** Implementar design responsivo para tablets e mobile
- **Arquivos:** Todos os componentes de incident/, novos breakpoints CSS
- **Horas:** 15h
- **Dependências:** Nenhuma

### A03. Skip Links para Navegação
- **Descrição:** Adicionar links "pular para conteúdo" para acessibilidade
- **Arquivos:** Layout principal, componentes base
- **Horas:** 2h
- **Dependências:** Nenhuma

### A04. Associação de Labels em Formulários
- **Descrição:** Corrigir associação programática label/input com ARIA
- **Arquivos:** `src/renderer/components/forms/IncidentForm.tsx`, todos os forms
- **Horas:** 4h
- **Dependências:** Nenhuma

### A05. Processamento de Arquivos PDF
- **Descrição:** Implementar extração de texto de arquivos PDF
- **Arquivos:** `BulkUploadService.ts`, nova lib pdf-parse
- **Horas:** 6h
- **Dependências:** B04

### A06. Processamento de Arquivos Word
- **Descrição:** Implementar extração de texto de arquivos .docx
- **Arquivos:** `BulkUploadService.ts`, lib mammoth.js
- **Horas:** 4h
- **Dependências:** B04

### A07. Processamento de Arquivos Excel
- **Descrição:** Implementar leitura de planilhas Excel
- **Arquivos:** `BulkUploadService.ts`, lib xlsx
- **Horas:** 5h
- **Dependências:** B04

### A08. Sistema de Preview de Upload
- **Descrição:** Criar preview dos dados antes de confirmar upload
- **Arquivos:** `src/renderer/components/forms/BulkUploadPreview.tsx`
- **Horas:** 6h
- **Dependências:** A05, A06, A07

### A09. Validação de Dados de Upload
- **Descrição:** Implementar validação robusta dos dados extraídos
- **Arquivos:** `BulkUploadService.ts`, schemas de validação
- **Horas:** 4h
- **Dependências:** A05, A06, A07

### A10. Queue de Processamento em Lote
- **Descrição:** Implementar fila de processamento para uploads grandes
- **Arquivos:** Novo `src/services/BatchProcessingQueue.ts`
- **Horas:** 5h
- **Dependências:** B04

### A11. Indicadores de Progresso
- **Descrição:** Mostrar progresso em tempo real do upload/processamento
- **Arquivos:** `BulkUploadForm.tsx`, componente de progresso
- **Horas:** 3h
- **Dependências:** A10

### A12. Detalhes de Incidentes Relacionados
- **Descrição:** Implementar visualização detalhada de incidentes relacionados
- **Arquivos:** `src/renderer/components/incident/IncidentRelationshipViewer.tsx` (expandir)
- **Horas:** 5h
- **Dependências:** B07

### A13. Sistema de Notificações
- **Descrição:** Implementar notificações para eventos importantes
- **Arquivos:** Novo `src/services/NotificationService.ts`
- **Horas:** 4h
- **Dependências:** Nenhuma

### A14. Configuração de LLM (Gemini/Outros)
- **Descrição:** Interface para configurar qual LLM usar
- **Arquivos:** `src/renderer/components/settings/LLMConfigurationPanel.tsx`
- **Horas:** 4h
- **Dependências:** B09

### A15. Cache de Respostas LLM
- **Descrição:** Implementar cache para evitar chamadas duplicadas ao LLM
- **Arquivos:** Novo `src/services/LLMCacheService.ts`
- **Horas:** 3h
- **Dependências:** B09

### A16. Métricas de Performance LLM
- **Descrição:** Rastrear tempos de resposta e qualidade das respostas LLM
- **Arquivos:** `src/services/LLMMetricsService.ts`
- **Horas:** 3h
- **Dependências:** B09

### A17. Histórico de Versões de Comentários
- **Descrição:** Manter histórico quando comentários são editados
- **Arquivos:** Nova tabela `incident_comment_versions`, triggers
- **Horas:** 4h
- **Dependências:** B10

### A18. Interface de Gestão de Comentários
- **Descrição:** Painel para gerenciar comentários ativos/inativos
- **Arquivos:** `src/renderer/components/incident/CommentManagementPanel.tsx`
- **Horas:** 5h
- **Dependências:** B10, B11

### A19. Webhook para Integrações Externas
- **Descrição:** Sistema de webhooks para notificar sistemas externos
- **Arquivos:** `src/main/api/WebhookService.ts`
- **Horas:** 6h
- **Dependências:** B08

### A20. Autenticação para API Externa
- **Descrição:** Sistema de autenticação para endpoints de integração
- **Arquivos:** `src/main/api/AuthenticationService.ts`
- **Horas:** 5h
- **Dependências:** B08

### A21. Rate Limiting para API
- **Descrição:** Implementar rate limiting para proteger a API
- **Arquivos:** Middleware em `src/main/api/`
- **Horas:** 3h
- **Dependências:** B08

### A22. Dashboard de Métricas de Incidentes
- **Descrição:** Expandir dashboard com métricas específicas dos requisitos
- **Arquivos:** `src/renderer/components/incident/IncidentAnalytics.tsx` (expandir)
- **Horas:** 6h
- **Dependências:** Nenhuma

### A23. Exportação de Relatórios
- **Descrição:** Implementar exportação de dados de incidentes (CSV, PDF)
- **Arquivos:** Novo `src/services/ReportExportService.ts`
- **Horas:** 5h
- **Dependências:** Nenhuma

### A24. Filtros Avançados de Busca
- **Descrição:** Implementar filtros avançados para busca de incidentes
- **Arquivos:** `src/renderer/components/incident/AdvancedIncidentSearch.tsx` (expandir)
- **Horas:** 4h
- **Dependências:** Nenhuma

---

## 📋 MÉDIA PRIORIDADE (22 tarefas - 110 horas)

### M01. Otimização de Performance de Busca
- **Descrição:** Otimizar queries de busca para grandes volumes
- **Arquivos:** `src/database/incident-schema.sql`, novos índices
- **Horas:** 5h
- **Dependências:** Nenhuma

### M02. Paginação Inteligente
- **Descrição:** Implementar paginação com loading incremental
- **Arquivos:** `IncidentQueue.tsx`, virtualized scrolling
- **Horas:** 4h
- **Dependências:** Nenhuma

### M03. Sistema de Tags Inteligentes
- **Descrição:** Auto-sugestão de tags baseada em conteúdo
- **Arquivos:** Novo `src/services/TagSuggestionService.ts`
- **Horas:** 5h
- **Dependências:** Nenhuma

### M04. Análise de Sentimento
- **Descrição:** Análise de sentimento em descrições de incidentes
- **Arquivos:** Novo `src/services/SentimentAnalysisService.ts`
- **Horas:** 6h
- **Dependências:** B09

### M05. Clustering de Incidentes Similares
- **Descrição:** Agrupar incidentes similares automaticamente
- **Arquivos:** Novo `src/services/IncidentClusteringService.ts`
- **Horas:** 8h
- **Dependências:** B07

### M06. Previsão de Tempo de Resolução
- **Descrição:** IA para prever tempo de resolução baseado no histórico
- **Arquivos:** Novo `src/services/ResolutionTimePredictionService.ts`
- **Horas:** 7h
- **Dependências:** Dados históricos

### M07. Sistema de Escalação Automática
- **Descrição:** Escalação automática baseada em SLA e prioridade
- **Arquivos:** Novo `src/services/AutoEscalationService.ts`
- **Horas:** 6h
- **Dependências:** Nenhuma

### M08. Interface de Configuração de SLA
- **Descrição:** Painel para configurar SLAs por categoria/prioridade
- **Arquivos:** `src/renderer/components/settings/SLAConfigurationPanel.tsx`
- **Horas:** 5h
- **Dependências:** Nenhuma

### M09. Alertas de Violação de SLA
- **Descrição:** Sistema de alertas em tempo real para violações
- **Arquivos:** `src/services/SLAMonitoringService.ts`
- **Horas:** 4h
- **Dependências:** M08

### M10. Histórico de Alterações Completo
- **Descrição:** Auditoria completa de todas as alterações em incidentes
- **Arquivos:** Nova tabela `incident_audit_log`, triggers
- **Horas:** 5h
- **Dependências:** Nenhuma

### M11. Templates de Resposta
- **Descrição:** Templates reutilizáveis para respostas comuns
- **Arquivos:** Novo `src/services/ResponseTemplateService.ts`
- **Horas:** 4h
- **Dependências:** Nenhuma

### M12. Sistema de Aprovação
- **Descrição:** Workflow de aprovação para certas ações
- **Arquivos:** Novo `src/services/ApprovalWorkflowService.ts`
- **Horas:** 6h
- **Dependências:** Nenhuma

### M13. Integração com Email
- **Descrição:** Envio de notificações por email
- **Arquivos:** `src/services/EmailService.ts`
- **Horas:** 4h
- **Dependências:** A13

### M14. Interface Mobile Nativa
- **Descrição:** App mobile complementar (opcional)
- **Arquivos:** Novo projeto React Native
- **Horas:** 20h
- **Dependências:** A02

### M15. Sincronização Offline
- **Descrição:** Capacidade de trabalhar offline com sincronização
- **Arquivos:** `src/services/OfflineSyncService.ts`
- **Horas:** 8h
- **Dependências:** Nenhuma

### M16. Backup Automático
- **Descrição:** Sistema de backup automático da base de dados
- **Arquivos:** `src/services/BackupService.ts`
- **Horas:** 3h
- **Dependências:** Nenhuma

### M17. Importação de Dados Legados
- **Descrição:** Ferramenta para importar dados de sistemas antigos
- **Arquivos:** `src/tools/LegacyDataImporter.ts`
- **Horas:** 6h
- **Dependências:** B04

### M18. API GraphQL
- **Descrição:** API GraphQL para integrações flexíveis
- **Arquivos:** Novo `src/main/graphql/`
- **Horas:** 8h
- **Dependências:** B08

### M19. Sistema de Permissões
- **Descrição:** Controle granular de permissões por usuário/equipe
- **Arquivos:** `src/services/PermissionService.ts`
- **Horas:** 7h
- **Dependências:** Nenhuma

### M20. Logs de Sistema Estruturados
- **Descrição:** Sistema de logging estruturado para debugging
- **Arquivos:** `src/utils/StructuredLogger.ts`
- **Horas:** 3h
- **Dependências:** Nenhuma

### M21. Métricas de Utilização
- **Descrição:** Rastreamento de como o sistema é utilizado
- **Arquivos:** `src/services/UsageMetricsService.ts`
- **Horas:** 4h
- **Dependências:** Nenhuma

### M22. Testes de Integração Completos
- **Descrição:** Suite completa de testes de integração
- **Arquivos:** `tests/integration/incident-workflow/`
- **Horas:** 8h
- **Dependências:** Todas as funcionalidades principais

---

## 🔧 BAIXA PRIORIDADE (14 tarefas - 65 horas)

### L01. Temas Personalizáveis
- **Descrição:** Sistema de temas claro/escuro personalizáveis
- **Arquivos:** `src/renderer/styles/themes/`
- **Horas:** 5h
- **Dependências:** Nenhuma

### L02. Atalhos de Teclado
- **Descrição:** Atalhos de teclado para ações comuns
- **Arquivos:** `src/renderer/hooks/useKeyboardShortcuts.ts`
- **Horas:** 3h
- **Dependências:** Nenhuma

### L03. Widget de Desktop
- **Descrição:** Widget pequeno para desktop com estatísticas
- **Arquivos:** Novo window type Electron
- **Horas:** 6h
- **Dependências:** Nenhuma

### L04. Integração com Slack
- **Descrição:** Notificações via Slack
- **Arquivos:** `src/integrations/SlackIntegration.ts`
- **Horas:** 4h
- **Dependências:** A13

### L05. Integração com Teams
- **Descrição:** Notificações via Microsoft Teams
- **Arquivos:** `src/integrations/TeamsIntegration.ts`
- **Horas:** 4h
- **Dependências:** A13

### L06. Charts Interativos
- **Descrição:** Gráficos interativos para análise de dados
- **Arquivos:** `src/renderer/components/charts/`
- **Horas:** 6h
- **Dependências:** A22

### L07. Exportação para Excel Avançada
- **Descrição:** Exportação com formatação e gráficos
- **Arquivos:** `ReportExportService.ts` (expandir)
- **Horas:** 4h
- **Dependências:** A23

### L08. Sistema de Favoritos
- **Descrição:** Marcar incidentes como favoritos
- **Arquivos:** Nova coluna, UI components
- **Horas:** 2h
- **Dependências:** Nenhuma

### L09. Busca por Voz
- **Descrição:** Interface de busca por comando de voz
- **Arquivos:** `src/renderer/components/search/VoiceSearch.tsx`
- **Horas:** 5h
- **Dependências:** Nenhuma

### L10. Análise de Texto com NLP
- **Descrição:** Processamento de linguagem natural avançado
- **Arquivos:** `src/services/NLPService.ts`
- **Horas:** 8h
- **Dependências:** B09

### L11. Gamificação
- **Descrição:** Sistema de pontos e achievements para usuários
- **Arquivos:** `src/services/GamificationService.ts`
- **Horas:** 6h
- **Dependências:** Nenhuma

### L12. Relatórios Automatizados
- **Descrição:** Geração e envio automático de relatórios
- **Arquivos:** `src/services/AutoReportService.ts`
- **Horas:** 5h
- **Dependências:** A23

### L13. Plugin System
- **Descrição:** Sistema de plugins para extensibilidade
- **Arquivos:** `src/plugins/PluginManager.ts`
- **Horas:** 10h
- **Dependências:** Nenhuma

### L14. Modo Offline Completo
- **Descrição:** Funcionalidade completa offline
- **Arquivos:** Service workers, local storage avançado
- **Horas:** 7h
- **Dependências:** M15

---

## 📈 PLANO DE EXECUÇÃO RECOMENDADO

### FASE 1: Bloqueadores Críticos (2-3 semanas)
1. **Semana 1:** B01-B06 (Estados, upload, validação)
2. **Semana 2:** B07-B12 (Busca, API, análise IA)
3. **Semana 3:** B13-B18 (Interface solução, logging)

### FASE 2: Alta Prioridade (4-5 semanas)
1. **Semanas 4-5:** A01-A11 (Acessibilidade, processamento arquivos)
2. **Semanas 6-7:** A12-A19 (Funcionalidades relacionadas, API)
3. **Semana 8:** A20-A24 (Segurança, relatórios)

### FASE 3: Funcionalidades Médias (3-4 semanas)
1. **Semanas 9-10:** M01-M11 (Performance, templates)
2. **Semanas 11-12:** M12-M22 (Workflow, testes)

### FASE 4: Polimento (2 semanas)
1. **Semana 13:** L01-L07 (UX, integração)
2. **Semana 14:** L08-L14 (Recursos avançados)

---

## 🎯 INDICADORES DE SUCESSO

### Métricas de Conformidade
- ✅ 100% dos requisitos portugueses implementados
- ✅ Estados corretamente mapeados
- ✅ Upload em massa funcional
- ✅ Análise inteligente operacional

### Métricas de Qualidade
- ✅ 90%+ conformidade WCAG 2.1 AA
- ✅ Responsive design em todas as telas
- ✅ Tempos de resposta <1s para operações comuns
- ✅ 95%+ cobertura de testes

### Métricas de Funcionalidade
- ✅ Integração LLM operacional
- ✅ API externa funcional
- ✅ Sistema de logs completo
- ✅ Workflow de aprovação/rejeição implementado

---

## 📋 CHECKLIST DE VALIDAÇÃO

### Requisitos Obrigatórios
- [ ] Estados em português implementados
- [ ] Upload em massa (PDF, Word, Excel, TXT)
- [ ] Busca inteligente automática
- [ ] Análise via IA com contexto
- [ ] Sistema de comentários ativo/inativo
- [ ] Proposta de solução LLM
- [ ] Workflow aceitar/rejeitar
- [ ] Logging detalhado de ações

### Qualidade e Performance
- [ ] Acessibilidade WCAG 2.1 AA
- [ ] Design responsivo
- [ ] Performance otimizada
- [ ] Testes abrangentes
- [ ] Documentação completa

### Integração e API
- [ ] API para sistemas externos
- [ ] Webhooks funcionais
- [ ] Autenticação segura
- [ ] Rate limiting implementado

---

**Nota:** Esta lista foi gerada com base na análise detalhada dos requisitos em português e gaps identificados na implementação atual. Cada tarefa inclui arquivos específicos e estimativas realistas de tempo.

**Próximos Passos:**
1. Revisar e priorizar com stakeholders
2. Atribuir tarefas à equipe de desenvolvimento
3. Configurar ambiente de desenvolvimento
4. Iniciar com tarefas bloqueadoras (B01-B06)