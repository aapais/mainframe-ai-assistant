# Accenture Mainframe AI Assistant

## 🚀 Automated Build Recovery System

Este projeto está equipado com um sistema robusto de recuperação automática de build através do GitHub Actions.

## 📋 Estado do Projeto

- ✅ **Sistema de Build**: Configurado e funcional
- ✅ **GitHub Actions**: Workflows automáticos prontos
- ✅ **Scripts de Correção**: Disponíveis para Windows e Unix
- ✅ **TypeScript**: Configurações corrigidas
- ✅ **Dependências**: Sistema de instalação automática

## 🔧 Configuração Inicial

### 1. Criar Repositório no GitHub

```bash
# 1. Vá para https://github.com/new
# 2. Nome do repositório: mainframe-ai-assistant
# 3. Descrição: Accenture Mainframe AI Assistant with Automated Build Recovery
# 4. Visibilidade: Private (recomendado) ou Public
# 5. NÃO inicialize com README, .gitignore ou licença
```

### 2. Conectar Repositório Local

```bash
# Adicionar o remote do GitHub
git remote add origin https://github.com/SEU_USERNAME/mainframe-ai-assistant.git

# Verificar a configuração
git remote -v

# Push do código
git push -u origin master
```

### 3. Ativar GitHub Actions

Após o push, os workflows serão automaticamente detectados. Para executar manualmente:

1. Vá para a aba "Actions" no GitHub
2. Selecione "Emergency Build Fix"
3. Clique em "Run workflow"

## 🛠️ Correção Automática de Problemas

### Correção Local

```bash
# Linux/Mac
npm run fix:all

# Windows
npm run fix:all:windows

# Apenas dependências
npm run fix:dependencies

# Apenas TypeScript
npm run fix:typescript
```

### Correção via GitHub Actions

Os seguintes workflows estão disponíveis:

- **Emergency Build Fix**: Correção completa de emergência
- **Fix Dependencies**: Instala e corrige todas as dependências
- **Auto-Fix Build**: Correção agendada diária

## 📦 Estrutura de Scripts

```
scripts/
├── fix-all-dependencies.sh      # Script Unix completo
├── fix-all-dependencies.bat     # Script Windows completo
├── fix-typescript-config.js     # Corretor de TypeScript
└── ...
```

## 🎯 Comandos Disponíveis

```bash
# Build
npm run build             # Build completo
npm run build:main        # Build do processo principal
npm run build:renderer    # Build do renderer

# Correções
npm run fix:all          # Corrige todos os problemas
npm run fix:dependencies # Corrige dependências
npm run fix:typescript   # Corrige configurações TypeScript
npm run fix:rebuild      # Reconstrói módulos nativos

# Desenvolvimento
npm run dev              # Modo desenvolvimento
npm run start            # Iniciar aplicação
```

## 🔄 Workflows GitHub Actions

### 1. Emergency Build Fix (`emergency-fix.yml`)
- Execução manual ou automática em push
- Corrige dependências e configurações
- Testa com Node.js 18.x e 20.x
- Gera relatório de build

### 2. Fix Dependencies (`fix-dependencies.yml`)
- Instala todas as dependências ausentes
- Reconstrói módulos nativos
- Corrige vulnerabilidades
- Commit automático de correções

### 3. Auto-Fix Build (`auto-fix-build.yml`)
- Execução agendada diária
- Diagnóstico automático de problemas
- Correção e teste de build
- Criação de issue se falhar

## 🚨 Resolução de Problemas

### Erro: "No inputs were found in config file"
```bash
npm run fix:typescript
```

### Erro: Dependências ausentes
```bash
npm run fix:dependencies
```

### Erro: Módulos nativos quebrados
```bash
npm run fix:rebuild
```

### Correção completa
```bash
npm run fix:all
```

## 📊 Monitoramento

Após configurar o GitHub:
- ✅ Builds automáticos em cada push
- ✅ Correções automáticas diárias
- ✅ Relatórios de build disponíveis
- ✅ Issues criadas automaticamente para falhas

## 🤝 Contribuindo

1. Clone o repositório
2. Execute `npm run fix:all` para configurar o ambiente
3. Faça suas alterações
4. Execute `npm test` antes de commitar
5. Push para sua branch
6. Crie um Pull Request

## 📝 Licença

Propriedade da Accenture. Todos os direitos reservados.

---

**Desenvolvido com sistema de recuperação automática de build via GitHub Actions**