#!/bin/bash
# Executado antes de qualquer edição de arquivo
FILE_PATH="$1"
if [ -n "$FILE_PATH" ]; then
    BASENAME=$(basename "$FILE_PATH")
    npx claude-flow@alpha memory query --filter "$BASENAME,$(dirname $FILE_PATH)" --recent --limit 3 >/dev/null 2>&1 &
fi
