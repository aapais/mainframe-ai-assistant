# 🌐 Servidor Web Alternativo - Mainframe AI Assistant

## ✅ Servidor Python Ativo na Porta 8080!

A aplicação está agora disponível através de um servidor HTTP simples.

## 📍 Como Aceder:

### Opção 1: Navegador Local
Abra o seu navegador e acesse:
```
http://localhost:8080
```

### Opção 2: Se estiver em WSL/Remote
```
http://127.0.0.1:8080
```

### Opção 3: Via IP da Máquina
Descubra o IP com:
```bash
hostname -I
```
Depois acesse:
```
http://[SEU_IP]:8080
```

## 🎨 O Que Verá:

- **Interface Principal** com gradiente roxo/azul
- **Dashboard** com 6 funcionalidades principais:
  - 📚 Knowledge Base
  - 🔍 Smart Search
  - 📊 Analytics
  - ⚡ Performance
  - 🎨 Themes
  - ♿ Accessibility

## 🔧 Comandos Úteis:

### Parar o Servidor
```bash
# Encontrar o processo
ps aux | grep "python3 -m http.server"

# Matar o processo (substitua PID pelo número do processo)
kill [PID]
```

### Reiniciar o Servidor
```bash
cd /mnt/c/mainframe-ai-assistant
python3 -m http.server 8080
```

### Usar Porta Diferente
```bash
python3 -m http.server 9000  # Usa porta 9000
```

## 📁 Ficheiros Servidos:

- `/` - index.html (Interface principal)
- `/dist/renderer/` - Ficheiros compilados do React
- `/src/` - Código fonte (desenvolvimento)
- `/docs/` - Documentação

## 🚀 Próximos Passos:

1. **Desenvolvimento React**
   - Instalar dependências: `npm install --force`
   - Compilar React: `npm run build:renderer`

2. **Aplicação Desktop (Electron)**
   - Instalar Electron: `npm install electron --save-dev`
   - Executar: `npm run electron`

3. **Servidor Vite (Desenvolvimento)**
   - Instalar Vite: `npm install vite --save-dev --force`
   - Executar: `npm run dev`

## ✨ Status: Aplicação Acessível!

O servidor está ativo e a servir a interface da aplicação.
Pode agora visualizar e interagir com o Mainframe AI Assistant!