#!/bin/bash
echo "🔧 Executando manutenção automática semanal..."

claude --prompt "
MANUTENÇÃO AUTOMÁTICA SEMANAL

Execute uma manutenção completa do projeto:

1. AUDITORIA RÁPIDA:
   - Verificar se há regressão na organização
   - Identificar novos arquivos temporários ou código morto
   - Detectar duplicações que possam ter sido criadas

2. LIMPEZA PREVENTIVA:
   - Remover arquivos temporários acumulados
   - Otimizar imports e dependências  
   - Limpar caches e logs antigos

3. OTIMIZAÇÃO CONTÍNUA:
   - Verificar performance de componentes novos/modificados
   - Atualizar documentação conforme mudanças
   - Validar que padrões estabelecidos estão sendo seguidos

4. RELATÓRIO:
   - Gerar relatório do estado atual vs semana anterior
   - Identificar tendências de melhoria ou degradação
   - Sugerir ações preventivas se necessário

Execute de forma coordenada e eficiente. Foque em manter a organização conquistada.
" --non-interactive

echo "✅ Manutenção semanal automática concluída!"
echo "📊 Relatório salvo automaticamente na memória persistente"
