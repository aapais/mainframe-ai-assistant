# 🚀 Como Executar a Aplicação Mainframe AI Assistant

## Opção 1: Modo Desenvolvimento (Recomendado) 🔧

### 1. Instalar Dependências
```bash
# Instalar todas as dependências incluindo Electron
npm install

# Se houver erros, tente:
npm install --legacy-peer-deps
```

### 2. Executar em Modo Dev
```bash
# Opção A: Usar Vite (desenvolvimento web)
npm run dev

# Depois abra o navegador em: http://localhost:5173
```

### 3. Executar como Aplicação Desktop (Electron)
```bash
# Primeiro, garantir que o Electron está instalado
npm install electron --save-dev

# Criar um build mínimo
npm run build:renderer

# Executar o Electron
npm run electron
```

## Opção 2: Build Completo e Execução 📦

### 1. Criar Build de Produção
```bash
# Build completo
npm run build

# Ou apenas o renderer para teste rápido
npm run build:renderer
```

### 2. Executar Aplicação Desktop
```bash
# Executar Electron após o build
npm run electron
```

## Opção 3: Criar Instalador 💿

### Para Windows
```bash
npm run dist:win
# O instalador estará em dist/
```

### Para macOS
```bash
npm run dist:mac
# O .app estará em dist/
```

### Para Linux
```bash
npm run dist:linux
# O AppImage/deb estará em dist/
```

## Solução de Problemas 🔨

### Erro: "electron: not found"
```bash
npm install electron --save-dev
```

### Erro: "Cannot find module"
```bash
npm install
npm run build
```

### Erro de TypeScript
```bash
# Executar com fallback (ignora erros TS)
npm run build:renderer
npm run electron
```

### Tela Branca no Electron
1. Abra o DevTools (F12)
2. Verifique erros no console
3. Certifique-se que dist/renderer/index.html existe

## Estrutura da Aplicação 📁

```
mainframe-ai-assistant/
├── src/
│   ├── main/          # Processo principal Electron
│   ├── renderer/       # Interface React
│   └── components/     # Componentes UI
├── dist/
│   ├── main/          # JS compilado do processo principal
│   └── renderer/      # HTML/JS da interface
└── package.json       # Scripts e dependências
```

## Scripts Disponíveis 📝

- `npm run dev` - Servidor de desenvolvimento Vite
- `npm run build` - Build completo
- `npm run electron` - Executar Electron
- `npm run dist` - Criar instalador
- `npm run preview` - Preview do build

## Acesso Rápido - Desenvolvimento Web 🌐

Para testar rapidamente a interface web sem Electron:

```bash
# Terminal 1 - Iniciar servidor dev
npm run dev

# Terminal 2 (opcional) - Ver logs
tail -f logs/*.log
```

Acesse: **http://localhost:5173**

## Features da Aplicação ✨

- **Knowledge Base Management** - Gestão de base de conhecimento
- **Search Interface** - Interface de pesquisa avançada
- **Performance Monitoring** - Monitorização de performance
- **Cache System** - Sistema de cache otimizado
- **Dark/Light Theme** - Temas claro e escuro

## Requisitos Mínimos 💻

- Node.js 18+
- npm 9+
- RAM: 4GB (recomendado 8GB)
- Espaço: 500MB

---

**Dica:** Para desenvolvimento rápido, use `npm run dev` e acesse pelo navegador. Para testar como aplicação desktop, use `npm run electron` após o build.