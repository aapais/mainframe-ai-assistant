# 📝 Instruções para Commits Sem Erros

## 🚀 Solução Automática

Criei scripts que **corrigem automaticamente** todos os erros antes de fazer commit!

### No Windows:
```bash
npm run commit:win "sua mensagem de commit"
```
ou simplesmente:
```bash
scripts\auto-fix-commit.bat
```

### No Linux/Mac/WSL:
```bash
npm run commit "sua mensagem de commit"
```
ou:
```bash
bash scripts/auto-fix-commit.sh
```

## ✨ O que o Script Faz:

1. **Formata automaticamente** o código com Prettier
2. **Corrige erros** do ESLint automaticamente
3. **Adiciona** os arquivos corrigidos
4. **Faz o commit** com sua mensagem
5. **Pergunta** se você quer fazer push

## 🔧 Comandos Úteis:

### Corrigir Manualmente (se preferir):
```bash
# Corrigir tudo de uma vez
npm run fix

# Ou separadamente:
npm run lint:fix    # Corrige erros do ESLint
npm run format      # Formata com Prettier
```

### Fazer Commit Normal (sem correção automática):
```bash
git add .
git commit -m "sua mensagem"
git push
```

## 📋 Configuração do ESLint

O `.eslintrc.js` está configurado para:
- ✅ React é reconhecido globalmente (sem erros de "React not defined")
- ✅ Console.log permitido em desenvolvimento
- ✅ Variáveis não usadas apenas avisam (não dão erro)
- ✅ Prettier integrado (formatação automática)

## 🎯 Resumo

**Você nunca mais precisa corrigir erros manualmente!**

Apenas use:
- **Windows**: `npm run commit:win "mensagem"`
- **Linux/Mac**: `npm run commit "mensagem"`

O script faz todo o trabalho chato para você! 🎉