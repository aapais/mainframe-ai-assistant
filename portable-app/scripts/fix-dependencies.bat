@echo off
REM Script para correção completa das dependências no Windows
REM Accenture Mainframe AI Assistant

echo 🔧 Iniciando correção das dependências...

REM 1. Limpar cache e node_modules
echo 📦 Limpando cache e node_modules...
call npm cache clean --force
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del package-lock.json

REM 2. Verificar versões do Node e NPM
echo 🔍 Verificando versões...
node --version
npm --version

REM 3. Instalar dependências principais primeiro
echo 📦 Instalando dependências principais...
call npm install react@^18.3.1 react-dom@^18.3.1 --save
call npm install typescript@^5.7.3 vite@^5.4.11 --save-dev

REM 4. Instalar Electron e build tools
echo ⚡ Instalando Electron e ferramentas de build...
call npm install electron@^33.3.0 electron-builder@^25.2.1 --save-dev

REM 5. Instalar dependências de desenvolvimento TypeScript
echo 🔧 Instalando dependências TypeScript...
call npm install @types/react@^18.3.12 @types/react-dom@^18.3.1 @types/node@^22.10.6 --save-dev

REM 6. Instalar ferramentas de lint e test
echo 🧪 Instalando ferramentas de teste e lint...
call npm install eslint@^8.57.1 jest@^29.7.0 ts-jest@^29.2.5 --save-dev
call npm install @typescript-eslint/parser@^6.21.0 @typescript-eslint/eslint-plugin@^6.21.0 --save-dev
call npm install eslint-plugin-react@^7.37.2 eslint-plugin-react-hooks@^4.6.2 --save-dev

REM 7. Instalar dependências específicas do projeto
echo 🎨 Instalando dependências do projeto...
call npm install lucide-react@^0.460.0 clsx@^2.1.1 tailwind-merge@^2.5.4 --save
call npm install tailwindcss@^3.4.17 autoprefixer@^10.4.20 postcss@^8.5.4 --save-dev

REM 8. Instalar dependências backend
echo 🗄️ Instalando dependências backend...
call npm install better-sqlite3@^11.6.0 axios@^1.7.9 express@^4.21.2 --save
call npm install @types/better-sqlite3@^7.6.12 @types/express@^5.0.0 --save-dev

REM 9. Rebuild dependências nativas
echo 🔨 Rebuild de dependências nativas...
call npm rebuild better-sqlite3

REM 10. Verificar instalação
echo ✅ Verificando instalação...
call npm ls --depth=0

echo 🎉 Correção de dependências concluída!
echo 📋 Próximos passos:
echo    1. Execute: npm run typecheck
echo    2. Execute: npm run lint
echo    3. Execute: npm run build
echo    4. Execute: npm run electron:dev para testar

pause