#!/bin/bash
# Executado quando Claude Code termina
echo "💾 Salvando estado da sessão..." >&2
npx claude-flow@alpha hooks session-end --export-metrics --generate-summary --persist-state >/dev/null 2>&1 &
echo "✅ Estado salvo automaticamente" >&2
