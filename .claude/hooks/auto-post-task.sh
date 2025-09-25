#!/bin/bash
# Executado após tarefas complexas
TASK_ID="$1"
if [ -n "$TASK_ID" ]; then
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    npx claude-flow@alpha hooks post-task --task-id "$TASK_ID" --analyze-performance --generate-insights >/dev/null 2>&1 &
    npx claude-flow@alpha hooks notify --message "Tarefa concluída: $TASK_ID em $TIMESTAMP" --memory-key "tarefas/$TIMESTAMP" >/dev/null 2>&1 &
fi
