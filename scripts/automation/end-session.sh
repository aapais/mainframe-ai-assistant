#!/bin/bash
echo "🌙 Finalizando sessão..."
npx claude-flow@alpha hooks session-end --export-metrics --generate-summary --persist-state
echo "💤 Sessão finalizada!"
