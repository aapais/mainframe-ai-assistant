# Instruções de Build - Accenture Mainframe AI Assistant

## 🚀 Executáveis Disponíveis

### ✅ Linux (AppImage) - PRONTO
- **Arquivo**: `dist/Accenture Mainframe AI Assistant-2.0.0.AppImage`
- **Tamanho**: 98 MB
- **Como usar**:
  ```bash
  chmod +x "dist/Accenture Mainframe AI Assistant-2.0.0.AppImage"
  ./dist/Accenture\ Mainframe\ AI\ Assistant-2.0.0.AppImage
  ```

### 🪟 Windows - Instruções de Build

#### Opção 1: Build em máquina Windows
Para criar o executável Windows (.exe), execute numa máquina Windows:

1. **Instalar dependências**:
   ```bash
   npm install
   ```

2. **Executar build Windows**:
   ```bash
   npm run build:win
   ```

3. **Localização do executável**:
   - Instalador: `dist/Accenture Mainframe AI Assistant Setup 2.0.0.exe`
   - Pasta descompactada: `dist/win-unpacked/`

#### Opção 2: Cross-compilation no Linux (requer Wine)
Para compilar para Windows a partir do Linux:

1. **Instalar Wine** (necessário para cross-compilation):
   ```bash
   sudo dpkg --add-architecture i386
   sudo apt update
   sudo apt install wine wine32 wine64
   ```

2. **Executar build**:
   ```bash
   npm run build:win
   ```

### 📱 macOS
Para criar o executável macOS (.dmg):
```bash
npm run build:mac
```

## 📋 Pré-requisitos

### Para desenvolvimento:
- Node.js 18+
- Python 3.8+
- npm ou yarn

### Para execução:
- **Linux**: Qualquer distribuição moderna (Ubuntu 20.04+, Fedora 34+, etc.)
- **Windows**: Windows 10/11
- **macOS**: macOS 10.14+

## 🔧 Scripts de Build Disponíveis

```json
{
  "build": "electron-builder",           // Build para plataforma atual
  "build:win": "electron-builder --win",  // Build Windows
  "build:mac": "electron-builder --mac",  // Build macOS
  "build:linux": "electron-builder --linux", // Build Linux
  "dist": "electron-builder --publish=never" // Build sem publicar
}
```

## 📦 Estrutura dos Executáveis

### Linux AppImage
- Executável único e portável
- Não requer instalação
- Inclui todas as dependências

### Windows NSIS
- Instalador .exe
- Cria atalhos no menu Iniciar
- Desinstalador incluído

### macOS DMG
- Imagem de disco montável
- Arrastar para Applications
- Assinatura de código opcional

## ⚙️ Configuração Personalizada

Para personalizar o build, edite a seção `build` no `package.json`:

```json
{
  "build": {
    "appId": "com.accenture.mainframe.assistant",
    "productName": "Accenture Mainframe AI Assistant",
    "directories": {
      "output": "dist"
    },
    "win": {
      "target": "nsis",
      "icon": "assets/icon.ico"
    },
    "mac": {
      "category": "public.app-category.developer-tools",
      "icon": "assets/icon.icns"
    },
    "linux": {
      "target": "AppImage",
      "icon": "assets/icon.png"
    }
  }
}
```

## 🐛 Troubleshooting

### Erro: "wine is required"
- **Solução**: Instale o Wine ou faça o build numa máquina Windows

### Erro: "Application entry file does not exist"
- **Solução**: Certifique-se que o arquivo `main.js` existe na raiz do projeto

### Erro: "electron is only allowed in devDependencies"
- **Solução**: Mova `electron` de `dependencies` para `devDependencies` no package.json

## 📞 Suporte

Para problemas ou dúvidas:
- Abra uma issue no repositório
- Contate a equipe de desenvolvimento

---

**Versão atual**: 2.0.0
**Data**: Setembro 2025