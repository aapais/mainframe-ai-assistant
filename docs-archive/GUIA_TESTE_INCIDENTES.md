# 🧪 GUIA DE TESTE - Sistema de Gestão de Incidentes

## 📌 Como Acessar

Abra no seu navegador:
```
http://localhost:8080/test-incident-features.html
```

## ✅ Funcionalidades Implementadas

### 1️⃣ **Filtro de Incidentes Ativos**
- **Localização**: Checkbox no topo "Mostrar apenas incidentes ativos"
- **Comportamento**:
  - ✅ LIGADO por padrão
  - Mostra apenas: `aberto`, `em_tratamento`, `em_revisao`
  - Esconde: `resolvido` e `fechado`
- **Como testar**:
  1. Observe que inicialmente mostra 5 incidentes (sem resolvidos/fechados)
  2. Desmarque o checkbox
  3. Verá TODOS os 7 incidentes aparecer

### 2️⃣ **Ordenação por Prioridade**
- **Localização**: Botão azul "↓ Ordenar por Prioridade"
- **Comportamento**:
  - Ordena por prioridade (P1 → P4)
  - P1 (vermelho) sempre no topo
- **Como testar**:
  1. Clique no botão "Ordenar por Prioridade"
  2. Observe a ordem mudar
  3. Clique novamente para inverter

### 3️⃣ **Botão "Iniciar Tratamento"**
- **Localização**: Coluna "Ações" da tabela
- **Comportamento**:
  - Aparece APENAS para incidentes com status `aberto`
  - Muda status de `aberto` → `em_tratamento`
- **Como testar**:
  1. Encontre um incidente com status "aberto"
  2. Clique em "Iniciar Tratamento" (botão verde)
  3. Veja o status mudar e o botão desaparecer

### 4️⃣ **Incidentes Relacionados**
- **Localização**: Botão azul "Ver Relacionados" em cada linha
- **Comportamento**:
  - Abre modal com incidente atual à esquerda
  - Mostra Top 5 incidentes similares resolvidos à direita
  - Cada um com % de similaridade
- **Como testar**:
  1. Clique em "Ver Relacionados" em qualquer incidente
  2. Veja o modal split-screen
  3. Observe os scores de similaridade (95%, 87%, etc.)

### 5️⃣ **Importação em Massa**
- **Localização**: Botão roxo "📁 Importação em Massa" no topo direito
- **Comportamento**:
  - Suporta: PDF, Word, Excel, TXT, CSV
  - Até 10 arquivos de uma vez
  - Todos criados com status `em_revisao`
- **Como testar**:
  1. Clique em "Importação em Massa"
  2. Arraste arquivos ou clique em "Selecionar Arquivos"
  3. Veja a preview dos arquivos
  4. Clique em "Importar"
  5. Novos incidentes aparecem com status "em_revisao"

## 🎯 Fluxo de Teste Completo

### Teste 1: Filtro e Visualização
1. ✅ Página carrega com filtro ativo (5 incidentes)
2. ✅ Desmarque "Mostrar apenas incidentes ativos"
3. ✅ Agora mostra 7 incidentes (incluindo resolvidos)
4. ✅ Marque novamente para voltar a 5

### Teste 2: Workflow de Tratamento
1. ✅ Encontre incidente "aberto" (ex: INC001)
2. ✅ Clique "Iniciar Tratamento"
3. ✅ Status muda para "em_tratamento"
4. ✅ Botão desaparece

### Teste 3: Busca Inteligente
1. ✅ Clique "Ver Relacionados" em qualquer incidente
2. ✅ Modal mostra incidente atual
3. ✅ Lista 5 similares com % match
4. ✅ Feche o modal

### Teste 4: Import em Bulk
1. ✅ Clique "Importação em Massa"
2. ✅ Selecione múltiplos arquivos
3. ✅ Confirme importação
4. ✅ Novos incidentes aparecem como "em_revisao"

## 📊 Estados em Português

- `aberto` - Incidente novo
- `em_tratamento` - Sendo resolvido
- `em_revisao` - Importado, aguarda revisão
- `resolvido` - Solucionado
- `fechado` - Arquivado

## 🚀 Próximos Passos

Após testar no HTML standalone, as funcionalidades estão prontas para:
1. Integração com a aplicação principal
2. Testes com dados reais do banco
3. Validação com usuários finais

---

**Arquivo de teste**: `/test-incident-features.html`
**Status**: ✅ PRONTO PARA TESTE