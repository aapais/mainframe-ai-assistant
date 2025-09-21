# 🧪 CreateIncidentModal - Testes E2E Playwright

Testes abrangentes de UI/UX e acessibilidade para o componente CreateIncidentModal do Accenture Mainframe Knowledge Base Assistant.

## 📋 Visão Geral

Este conjunto de testes fornece cobertura completa para:

- ✅ **Funcionalidade do Modal**: Abertura, fechamento, navegação
- ✅ **Formulário**: Validação, preenchimento, submissão
- ✅ **Sistema de Tags**: Adição, remoção, sugestões
- ✅ **Sugestões de IA**: Classificação automática de incidentes
- ✅ **Acessibilidade**: Conformidade WCAG 2.1 AA
- ✅ **Navegação por Teclado**: Tab, Enter, Escape, setas
- ✅ **Design Responsivo**: Desktop, tablet, mobile
- ✅ **Tradução Portuguesa**: Labels, mensagens, validações
- ✅ **Performance**: Tempos de carregamento e resposta

## 🚀 Execução Rápida

### Executar Todos os Testes

```bash
# Executar toda a suíte de testes
./tests/e2e/run-incident-modal-tests.sh

# Ou usando npm
npm run test:e2e:incident-modal
```

### Executar Testes Específicos

```bash
# Apenas testes de desktop
./tests/e2e/run-incident-modal-tests.sh desktop

# Apenas testes de acessibilidade
./tests/e2e/run-incident-modal-tests.sh accessibility

# Apenas testes mobile
./tests/e2e/run-incident-modal-tests.sh mobile

# Testes de performance
./tests/e2e/run-incident-modal-tests.sh performance

# Execução rápida (smoke tests)
./tests/e2e/run-incident-modal-tests.sh quick
```

### Modo Debug

```bash
# Debug com interface visual
./tests/e2e/run-incident-modal-tests.sh debug

# Executar com browser visível
./tests/e2e/run-incident-modal-tests.sh headed
```

## 📁 Estrutura dos Arquivos

```
tests/e2e/
├── incident-modal.test.ts           # Testes principais
├── incident-modal.config.ts         # Configuração Playwright
├── run-incident-modal-tests.sh      # Script de execução
├── helpers/
│   └── incident-modal-helpers.ts    # Utilitários e Page Objects
├── reporters/
│   └── accessibility-reporter.ts    # Relatório de acessibilidade
├── setup/
│   ├── global-setup.ts             # Configuração inicial
│   └── global-teardown.ts          # Limpeza final
└── README.md                       # Esta documentação
```

## 🎯 Categorias de Testes

### 1. Funcionalidade Básica
- ✅ Abertura e fechamento do modal
- ✅ Preenchimento de campos obrigatórios
- ✅ Geração automática de número do incidente
- ✅ Validação de dados de entrada
- ✅ Submissão de formulário válido

### 2. Sistema de Tags
- ✅ Adição de tags via input
- ✅ Remoção de tags existentes
- ✅ Sugestões automáticas de tags
- ✅ Limite máximo de 10 tags
- ✅ Validação de caracteres especiais

### 3. Sugestão de IA
- ✅ Habilitação do botão baseada em conteúdo
- ✅ Estado de carregamento durante análise
- ✅ Aplicação automática de classificações
- ✅ Sugestão de tags relevantes
- ✅ Tratamento de erros da IA

### 4. Validação de Formulário
- ✅ Campos obrigatórios
- ✅ Comprimento mínimo/máximo
- ✅ Formatos específicos (data, email)
- ✅ Limpeza de erros após correção
- ✅ Contador de caracteres em tempo real

### 5. Acessibilidade (WCAG 2.1 AA)
- ✅ Estrutura ARIA adequada
- ✅ Navegação por teclado completa
- ✅ Contraste de cores conforme
- ✅ Labels associados aos campos
- ✅ Indicadores de campos obrigatórios
- ✅ Mensagens de erro acessíveis
- ✅ Foco visual adequado

### 6. Design Responsivo
- ✅ Layout desktop (1280px+)
- ✅ Layout tablet (768px - 1023px)
- ✅ Layout mobile (320px - 767px)
- ✅ Tela grande (1920px+)
- ✅ Orientação portrait/landscape

### 7. Tradução Portuguesa
- ✅ Labels de campos em português
- ✅ Mensagens de validação
- ✅ Opções de seleção (prioridade, impacto)
- ✅ Textos de botões e ações
- ✅ Formatação de data brasileira

### 8. Performance
- ✅ Tempo de abertura do modal < 1s
- ✅ Responsividade do formulário
- ✅ Carregamento de sugestões de IA
- ✅ Processamento de múltiplas tags

## 📊 Relatórios Gerados

### 1. Relatório HTML Principal
Localização: `tests/playwright/reports/incident-modal/index.html`

Contém:
- Resultados detalhados de cada teste
- Screenshots de falhas
- Vídeos de execução
- Timeline de execução
- Filtros por status e projeto

### 2. Relatório de Acessibilidade
Localização: `tests/playwright/reports/accessibility/accessibility-report.html`

Contém:
- Score de conformidade WCAG 2.1 AA
- Detalhamento por critério
- Recomendações de melhoria
- Status de compatibilidade com leitores de tela
- Análise de navegação por teclado

### 3. Resumo Executivo
Localização: `tests/playwright/reports/TEST_SUMMARY.md`

Contém:
- Visão geral dos resultados
- Métricas de performance
- Status de acessibilidade
- Recomendações principais

### 4. Screenshots
Localização: `tests/playwright/screenshots/`

Screenshots capturados:
- `incident-modal-opened.png` - Modal aberto
- `incident-modal-validation-errors.png` - Erros de validação
- `incident-modal-ai-suggestions.png` - Sugestões aplicadas
- `incident-modal-tags.png` - Sistema de tags
- `incident-modal-mobile.png` - Layout mobile
- `incident-modal-tablet.png` - Layout tablet
- `incident-modal-desktop.png` - Layout desktop
- `incident-modal-loading.png` - Estado de carregamento

## 🔧 Configuração do Ambiente

### Pré-requisitos
- Node.js 16+ instalado
- Aplicação rodando em `http://localhost:5173`
- Playwright instalado (`npm install @playwright/test`)

### Variáveis de Ambiente
```bash
export BASE_URL="http://localhost:5173"  # URL da aplicação
export API_URL="http://localhost:3001/api"  # URL da API
export NODE_ENV="test"  # Ambiente de teste
```

### Instalação dos Browsers
```bash
npx playwright install chromium firefox webkit
```

## 🐛 Debugging e Troubleshooting

### Problemas Comuns

1. **Aplicação não está rodando**
   ```bash
   # Verificar se a aplicação está acessível
   curl http://localhost:5173
   # Iniciar a aplicação se necessário
   npm run dev
   ```

2. **Browsers não instalados**
   ```bash
   npx playwright install
   ```

3. **Timeouts em testes**
   - Aumentar timeout na configuração
   - Verificar performance da máquina
   - Usar `--headed` para debug visual

4. **Falhas de acessibilidade**
   - Verificar contraste de cores
   - Validar estrutura ARIA
   - Testar navegação por teclado

### Debug Avançado

```bash
# Executar com debug trace
npx playwright test --trace on

# Executar teste específico
npx playwright test --grep "deve abrir e fechar o modal"

# Executar em modo slow-mo
npx playwright test --slowMo 1000

# Gerar trace viewer
npx playwright show-trace trace.zip
```

## 📈 Métricas e KPIs

### Critérios de Sucesso
- ✅ 100% dos testes funcionais passando
- ✅ Acessibilidade ≥ 90% WCAG 2.1 AA
- ✅ Performance: Modal aberto em < 1s
- ✅ Responsividade: Suporte a todos os breakpoints
- ✅ Compatibilidade: Chrome, Firefox, Safari

### Métricas Monitoradas
- Taxa de sucesso dos testes
- Tempo de execução total
- Conformidade com padrões de acessibilidade
- Cobertura de funcionalidades
- Performance de carregamento

## 🚀 Integração Contínua

### GitHub Actions
```yaml
name: CreateIncidentModal E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install
      - run: ./tests/e2e/run-incident-modal-tests.sh all
      - uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: tests/playwright/reports/
```

### Scripts NPM
Adicionar ao `package.json`:
```json
{
  "scripts": {
    "test:e2e:incident-modal": "./tests/e2e/run-incident-modal-tests.sh",
    "test:e2e:incident-modal:quick": "./tests/e2e/run-incident-modal-tests.sh quick",
    "test:e2e:incident-modal:accessibility": "./tests/e2e/run-incident-modal-tests.sh accessibility",
    "test:e2e:incident-modal:mobile": "./tests/e2e/run-incident-modal-tests.sh mobile"
  }
}
```

## 📚 Recursos Adicionais

### Documentação Playwright
- [Playwright Docs](https://playwright.dev/)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Page Object Model](https://playwright.dev/docs/pom)

### Padrões de Acessibilidade
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Guidelines](https://webaim.org/)

### Testing Best Practices
- [Testing Trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)
- [UI Testing Best Practices](https://github.com/NoriSte/ui-testing-best-practices)

---

## 🤝 Contribuição

Para contribuir com os testes:

1. Fork o repositório
2. Crie uma branch para sua feature (`git checkout -b feature/new-test`)
3. Adicione seus testes seguindo os padrões existentes
4. Execute a suíte completa para verificar compatibilidade
5. Commit suas mudanças (`git commit -am 'Add new test for X'`)
6. Push para a branch (`git push origin feature/new-test`)
7. Abra um Pull Request

### Padrões de Código
- Use Page Object Model para elementos de UI
- Escreva testes descritivos em português
- Inclua screenshots para falhas visuais
- Mantenha timeouts consistentes
- Documente casos de teste complexos

---

*Documentação gerada para Accenture Mainframe Knowledge Base Assistant*