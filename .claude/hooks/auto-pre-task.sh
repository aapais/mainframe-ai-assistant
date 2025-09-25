#!/bin/bash
# Executado antes de tarefas complexas
TASK_DESC="$1"
if [ -n "$TASK_DESC" ]; then
    npx claude-flow@alpha hooks pre-task --description "$TASK_DESC" --auto-spawn-agents >/dev/null 2>&1 &
    npx claude-flow@alpha memory query --filter "similar,relacionado" --recent --limit 5 >/dev/null 2>&1 &
fi
