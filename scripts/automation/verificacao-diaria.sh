#!/bin/bash
echo "🏥 Verificação diária automática..."

# Verificar organização básica
TEMP_FILES=$(find . -name "*.tmp" -o -name "*.bak" -o -name "*~" 2>/dev/null | wc -l)
OLD_LOGS=$(find . -name "*.log" -mtime +7 2>/dev/null | wc -l)
LARGE_FILES=$(find . -size +100M 2>/dev/null | wc -l)

if [ $TEMP_FILES -gt 0 ] || [ $OLD_LOGS -gt 5 ] || [ $LARGE_FILES -gt 3 ]; then
    echo "⚠️ ALERTA: Possível degradação detectada!"
    echo "   - Arquivos temporários: $TEMP_FILES"
    echo "   - Logs antigos: $OLD_LOGS"  
    echo "   - Arquivos grandes: $LARGE_FILES"
    echo "💡 Considere executar: ./manutencao-semanal.sh"
else
    echo "✅ Projeto mantém organização"
fi

# Verificar sistema Claude Flow
npx claude-flow@alpha memory stats >/dev/null 2>&1 && echo "✅ Sistema de memória ativo" || echo "⚠️ Problema com sistema de memória"
claude mcp status >/dev/null 2>&1 && echo "✅ MCP servers ativos" || echo "⚠️ Problema com MCP servers"

echo "📈 Status geral: $(date)"
