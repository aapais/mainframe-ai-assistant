# Manual do Usuário - Sistema de Gestão de Incidentes
## Versão 2.0 - Atualizado em 24/09/2024

### 📋 Índice
1. [Introdução](#introdução)
2. [Acesso ao Sistema](#acesso-ao-sistema)
3. [Interface Principal](#interface-principal)
4. [Gestão de Incidentes](#gestão-de-incidentes)
5. [Sistema de Busca](#sistema-de-busca)
6. [Base de Conhecimento](#base-de-conhecimento)
7. [Relatórios e Dashboard](#relatórios-e-dashboard)
8. [Configurações](#configurações)
9. [Solução de Problemas](#solução-de-problemas)

## Introdução

O Sistema de Gestão de Incidentes com Conhecimento Integrado é uma aplicação desktop desenvolvida para facilitar o gerenciamento eficiente de incidentes técnicos e organizacionais, integrando automaticamente incidentes resolvidos à base de conhecimento.

### Principais Funcionalidades
- ✅ **Gestão Completa de Incidentes** - Ciclo completo de vida dos incidentes
- ✅ **Base de Conhecimento Automática** - Conversão automática de resoluções
- ✅ **Busca Unificada** - Pesquisa em incidentes ativos e conhecimento
- ✅ **Dashboard Integrado** - Métricas e indicadores em tempo real
- ✅ **IA Integrada** - Sugestões automáticas e categorização
- ✅ **Interface Responsiva** - Design adaptável a diferentes telas

## Acesso ao Sistema

### Requisitos Mínimos
- **Sistema Operacional:** Windows 10+, macOS 10.15+, Ubuntu 18.04+
- **RAM:** 4GB mínimo, 8GB recomendado
- **Armazenamento:** 500MB livre
- **Conectividade:** Internet para funcionalidades de IA

### Instalação
1. Faça download do instalador apropriado para seu sistema operacional
2. Execute o instalador com privilégios administrativos
3. Siga as instruções na tela
4. Inicie a aplicação através do atalho criado

### Primeiro Acesso
1. **Configuração Inicial:** Defina suas preferências de sistema
2. **Importação de Dados:** (Opcional) Importe dados existentes
3. **Teste de Conectividade:** Verifique conexões com serviços externos

## Interface Principal

### Layout Geral
A interface é dividida em cinco áreas principais:

#### 1. Barra de Navegação Superior
- **Logo e Título:** Identificação do sistema
- **Menu Principal:** Acesso às funcionalidades
- **Perfil:** Configurações do usuário
- **Notificações:** Alertas e atualizações

#### 2. Menu Lateral Esquerdo
- **Dashboard:** Visão geral e métricas
- **Incidentes:** Gestão de incidentes ativos
- **Base de Conhecimento:** Artigos e soluções
- **Relatórios:** Análises e estatísticas
- **Configurações:** Personalização do sistema

#### 3. Área de Conteúdo Central
- **Exibição Principal:** Conteúdo da seção selecionada
- **Formulários:** Criação e edição de registros
- **Listas:** Visualização de dados tabulares
- **Detalhes:** Informações expandidas

#### 4. Painel de Busca
- **Campo de Pesquisa:** Busca unificada
- **Filtros Avançados:** Refinamento de resultados
- **Histórico:** Pesquisas recentes

#### 5. Barra de Status Inferior
- **Conexão:** Status de conectividade
- **Sincronização:** Estado da sincronização de dados
- **Recursos:** Uso de CPU e memória

## Gestão de Incidentes

### Criando um Novo Incidente

#### Passo a Passo
1. **Acesse:** Menu Lateral > Incidentes > "Novo Incidente"
2. **Título:** Informe um título claro e descritivo
3. **Descrição:** Detalhe o problema encontrado
4. **Categorização:**
   - **Área Técnica:** Selecione a área responsável
   - **Área de Negócio:** Defina o impacto no negócio
   - **Prioridade:** Baixa, Média, Alta, Crítica
   - **Severidade:** Mínima, Moderada, Maior, Crítica

#### Campos Obrigatórios
- ✅ **Título** - Resumo do incidente
- ✅ **Descrição** - Detalhamento do problema
- ✅ **Área Técnica** - Categoria técnica
- ⚪ **Área de Negócio** - Impacto organizacional
- ⚪ **Prioridade** - Urgência de resolução
- ⚪ **Severidade** - Impacto no sistema

#### Funcionalidades Automáticas
- **Sugestão de Categoria:** IA sugere categoria baseada na descrição
- **Detecção de Duplicatas:** Sistema identifica incidentes similares
- **Assignação Automática:** Direcionamento baseado na categoria
- **UUID Único:** Identificador único gerado automaticamente

### Estados do Incidente

#### Fluxo de Estados
```
NOVO → EM_PROGRESSO → RESOLVIDO
  ↓         ↓            ↓
FECHADO ← REABERTO ← CONHECIMENTO
```

#### Descrição dos Estados
- **NOVO** - Incidente recém criado
- **EM_PROGRESSO** - Sendo trabalhado pela equipe
- **RESOLVIDO** - Solução implementada
- **FECHADO** - Confirmado como resolvido
- **REABERTO** - Problema reincidente
- **CONHECIMENTO** - Automaticamente na base de conhecimento

### Atualizando Incidentes

#### Campos Editáveis
- **Status:** Mudança de estado do incidente
- **Assignado Para:** Responsável atual
- **Resolução:** Descrição da solução implementada
- **Comentários:** Notas e atualizações
- **Anexos:** Documentos e imagens de apoio

#### Histórico de Alterações
- **Quem:** Usuário que fez a alteração
- **Quando:** Timestamp da mudança
- **O Que:** Campos alterados
- **De/Para:** Valores anterior e novo

## Sistema de Busca

### Busca Unificada

#### Características
- **Busca Única:** Pesquisa simultânea em incidentes e conhecimento
- **Busca Semântica:** Compreende contexto e sinônimos
- **Busca Full-Text:** Pesquisa em todo o conteúdo
- **Pesquisa Vetorial:** IA para resultados mais precisos

#### Como Usar
1. **Digite:** Termo ou frase na barra de busca
2. **Filtros:** Use filtros para refinar resultados
3. **Resultados:** Visualize resultados ranqueados por relevância
4. **Detalhes:** Clique para ver informações completas

#### Operadores de Busca
- **"frase exata"** - Busca por frase literal
- **palavra1 AND palavra2** - Ambas as palavras
- **palavra1 OR palavra2** - Qualquer uma das palavras
- **-palavra** - Exclui palavra dos resultados
- **palavra*** - Busca por prefixo

### Filtros Avançados

#### Por Categoria
- **Área Técnica:** Filtro por categoria técnica
- **Área de Negócio:** Filtro por impacto organizacional
- **Status:** Filtro por estado atual
- **Prioridade:** Filtro por nível de prioridade

#### Por Data
- **Data de Criação:** Quando foi criado
- **Data de Atualização:** Última modificação
- **Data de Resolução:** Quando foi resolvido
- **Período Personalizado:** Range de datas específico

#### Por Conteúdo
- **Tipo de Registro:** Incidente vs Conhecimento
- **Confiabilidade:** Score de confiança (conhecimento)
- **Fonte:** Origem da informação
- **Tags:** Palavras-chave associadas

### Histórico de Buscas
- **Pesquisas Recentes:** Últimas 10 buscas realizadas
- **Termos Populares:** Buscas mais frequentes
- **Buscas Salvas:** Filtros personalizados salvos
- **Sugestões:** Termos relacionados baseados em IA

## Base de Conhecimento

### Como Funciona

#### Processo Automático
1. **Incidente Resolvido:** Status mudado para "RESOLVIDO"
2. **Análise de IA:** Sistema analisa qualidade da resolução
3. **Conversão Automática:** Criação de artigo na base de conhecimento
4. **Categorização:** Automaticamente categorizado
5. **Disponibilização:** Imediatamente disponível para busca

#### Critérios de Qualidade
- **Resolução Detalhada:** Mínimo de 50 caracteres
- **Passos Claros:** Instruções passo-a-passo
- **Resultado Verificável:** Solução testada
- **Informações Completas:** Context suficiente

### Artigos de Conhecimento

#### Estrutura dos Artigos
- **Título:** Problema ou questão tratada
- **Resumo:** Breve descrição da solução
- **Conteúdo Completo:** Resolução detalhada
- **Categoria:** Classificação técnica
- **Tags:** Palavras-chave relevantes
- **Score de Confiança:** Qualidade da informação
- **Fonte:** Incidente original
- **Uso:** Frequência de acesso

#### Informações Complementares
- **Data de Criação:** Quando foi gerado
- **Última Utilização:** Quando foi acessado
- **Criado Por:** Usuário responsável pela resolução
- **Atualizado Por:** Últimas modificações
- **Metadados:** Informações técnicas adicionais

### Gestão Manual

#### Criação Manual de Artigos
1. **Acesse:** Base de Conhecimento > "Novo Artigo"
2. **Preencha:** Título, conteúdo e categoria
3. **Configure:** Tags e nível de confiança
4. **Salve:** Disponibilize para a equipe

#### Edição de Artigos
- **Conteúdo:** Melhoria de descrições
- **Categorização:** Ajuste de categoria
- **Tags:** Adição de palavras-chave
- **Status:** Ativação/desativação

## Relatórios e Dashboard

### Dashboard Principal

#### Métricas em Tempo Real
- **Incidentes Ativos:** Total de incidentes não resolvidos
- **Resolvidos Hoje:** Incidentes fechados no dia
- **Tempo Médio de Resolução:** KPI principal
- **Taxa de Resolução:** Percentual de sucesso
- **Artigos de Conhecimento:** Total na base

#### Gráficos e Indicadores
- **Tendência de Incidentes:** Gráfico de linha temporal
- **Distribuição por Área:** Gráfico de pizza por categoria
- **Performance da Equipe:** Ranking de resolução
- **Reincidência:** Taxa de reabertura
- **Utilização do Conhecimento:** Acessos aos artigos

### Relatórios Detalhados

#### Relatório de Incidentes
- **Período:** Seleção de range de datas
- **Filtros:** Por área, status, prioridade
- **Dados:** Lista detalhada com métricas
- **Exportação:** PDF, Excel, CSV

#### Relatório de Performance
- **SLA:** Cumprimento de acordos de nível de serviço
- **MTTR:** Mean Time To Resolution por categoria
- **Volume:** Quantidade de incidentes por período
- **Tendências:** Análise de padrões temporais

#### Relatório de Conhecimento
- **Criação:** Artigos gerados automaticamente
- **Utilização:** Frequência de acesso
- **Qualidade:** Score médio de confiança
- **ROI:** Retorno do investimento em conhecimento

### Exportação e Compartilhamento

#### Formatos Disponíveis
- **PDF:** Relatórios formatados para impressão
- **Excel:** Dados para análise complementar
- **CSV:** Importação em outras ferramentas
- **JSON:** Integração com sistemas externos

#### Agendamento Automático
- **Frequência:** Diário, semanal, mensal
- **Destinatários:** Lista de e-mails
- **Conteúdo:** Seleção de métricas
- **Formato:** Escolha do formato de saída

## Configurações

### Configurações Gerais

#### Interface
- **Tema:** Claro, escuro, automático
- **Idioma:** Português, inglês, espanhol
- **Densidade:** Compacta, normal, espaçosa
- **Animações:** Habilitadas/desabilitadas

#### Notificações
- **Novos Incidentes:** Alertas para incidentes críticos
- **Status Updates:** Mudanças de estado
- **Lembretes:** SLA próximo do vencimento
- **Conhecimento:** Novos artigos relevantes

### Configurações de Integração

#### Integrações de IA
- **OpenAI:** Configuração de API key
- **Gemini:** Configuração do Google AI
- **Claude:** Configuração da Anthropic
- **Azure OpenAI:** Configuração Microsoft

#### Configurações de Banco
- **PostgreSQL:** Configuração de conexão
- **Backup Automático:** Agendamento de backups
- **Retenção:** Política de retenção de dados
- **Performance:** Otimizações de consulta

### Configurações de Usuário

#### Perfil
- **Nome:** Nome completo do usuário
- **Email:** Contato principal
- **Papel:** Admin, Gestor, Analista, Usuário
- **Preferências:** Configurações personalizadas

#### Segurança
- **Senha:** Alteração de senha
- **2FA:** Autenticação de dois fatores
- **Sessões:** Gestão de sessões ativas
- **Logs:** Histórico de acesso

## Solução de Problemas

### Problemas Comuns

#### Sistema Lento
**Sintomas:**
- Interface responsiva lenta
- Pesquisas demoram mais que 5 segundos
- Carregamento de páginas lento

**Soluções:**
1. **Verificar Recursos:** Task Manager para uso de CPU/RAM
2. **Limpar Cache:** Configurações > Limpar Cache
3. **Otimizar Banco:** Executar rotina de manutenção
4. **Fechar Aplicações:** Liberar recursos do sistema

#### Problemas de Conexão
**Sintomas:**
- Erro "Servidor não disponível"
- Funcionalidades de IA não funcionam
- Sincronização falha

**Soluções:**
1. **Verificar Internet:** Testar conectividade
2. **Firewall:** Verificar bloqueios de rede
3. **Proxy:** Configurar proxy se necessário
4. **DNS:** Testar resolução de nomes

#### Problemas de Busca
**Sintomas:**
- Busca não retorna resultados
- Resultados irrelevantes
- Erro na pesquisa

**Soluções:**
1. **Reindexar:** Configurações > Recriar Índices
2. **Verificar Sintaxe:** Usar operadores corretos
3. **Limpar Filtros:** Remover filtros desnecessários
4. **Reiniciar:** Fechar e reabrir aplicação

### Códigos de Erro

#### Códigos de Sistema
- **SYS001:** Erro de inicialização
- **SYS002:** Falha de conectividade
- **SYS003:** Erro de permissão
- **SYS004:** Recurso indisponível

#### Códigos de Dados
- **DB001:** Erro de conexão com banco
- **DB002:** Timeout de consulta
- **DB003:** Violação de integridade
- **DB004:** Falha na transação

#### Códigos de API
- **API001:** Chave de API inválida
- **API002:** Limite de requisições excedido
- **API003:** Serviço temporariamente indisponível
- **API004:** Erro de autenticação

### Contato para Suporte

#### Canais de Suporte
- **Email:** suporte@sistema-incidentes.com
- **Telefone:** +55 (11) 9999-9999
- **Chat:** Disponível 8h-18h, Segunda a Sexta
- **Documentação:** https://docs.sistema-incidentes.com

#### Informações para Suporte
Ao contatar o suporte, tenha em mãos:
1. **Versão do Sistema:** Encontrada em Sobre
2. **Sistema Operacional:** Windows/Mac/Linux + versão
3. **Descrição do Problema:** Detalhada
4. **Passos para Reproduzir:** Sequência que causa o erro
5. **Mensagens de Erro:** Screenshots ou texto completo

---

**Manual do Usuário - Versão 2.0**
**Última Atualização:** 24/09/2024
**Próxima Revisão:** 24/12/2024
**Responsável:** Equipe de Documentação