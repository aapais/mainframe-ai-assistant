# 📦 Pacote Windows - Accenture Mainframe AI Assistant

## 🚀 Como Executar no Windows

### Opção 1: Versão Web (Mais Simples)
1. Abra o arquivo: `src/mainframe-knowledge-base.html`
2. Clique com botão direito → "Abrir com" → Seu browser preferido
3. A aplicação abre instantaneamente

### Opção 2: Aplicação Electron Desktop

#### Pré-requisitos:
- Node.js instalado (https://nodejs.org/)
- Windows 10 ou superior

#### Passos:
1. **Abra o Command Prompt/PowerShell na pasta do projeto**
2. **Instale as dependências:**
   ```cmd
   npm install
   ```

3. **Execute a aplicação:**
   ```cmd
   npm start
   ```

## 📁 Estrutura do Pacote

```
accenture-mainframe-ai-assistant/
├── src/
│   ├── mainframe-knowledge-base.html  (Interface completa)
│   ├── main/
│   │   └── electron-simple.js         (Aplicação desktop)
│   └── assets/
│       └── icons/                     (Ícones Accenture)
├── package.json                       (Configuração)
└── WINDOWS_PACKAGE.md                 (Este ficheiro)
```

## ✨ Funcionalidades Disponíveis

- ✅ **Interface Accenture**: Logo e branding corporativo
- ✅ **Base de Conhecimento**: 25+ soluções mainframe
- ✅ **Pesquisa em Tempo Real**: Filtros instantâneos
- ✅ **Categorias**: VSAM, JCL, COBOL, DB2, CICS, IMS
- ✅ **Design Responsivo**: Adapta-se ao tamanho da janela

## 🔍 Como Usar

1. **Pesquisar Erros:**
   - Digite o código do erro (ex: S0C7, VSAM 35)
   - Resultados aparecem instantaneamente

2. **Navegar por Categoria:**
   - Veja estatísticas por sistema
   - Clique nos cards para detalhes

3. **Soluções Detalhadas:**
   - Cada erro tem passos de resolução
   - Códigos e comandos incluídos

## 🛠️ Para Desenvolvimento

### Criar Instalador Windows (Futuro):
```cmd
npm run build:win
npm run dist:win
```

### Executar em Modo Debug:
```cmd
npm run dev
```

## 📞 Suporte

- **Documentação**: docs/MVP1-IMPLEMENTATION-PLAN-DETAILED.md
- **Base de Conhecimento**: assets/kb-templates/
- **Interface Web**: src/mainframe-knowledge-base.html

## 🏢 Copyright

© 2025 Accenture. All rights reserved.
Enterprise Mainframe AI Assistant v1.0.0