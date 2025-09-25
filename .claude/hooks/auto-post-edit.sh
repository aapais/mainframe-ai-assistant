#!/bin/bash
# Executado após qualquer edição de arquivo
FILE_PATH="$1"
if [ -n "$FILE_PATH" ]; then
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BASENAME=$(basename "$FILE_PATH")
    npx claude-flow@alpha hooks post-edit --file "$FILE_PATH" --memory-key "auto/$TIMESTAMP" >/dev/null 2>&1 &
    npx claude-flow@alpha hooks notify --message "Arquivo modificado: $BASENAME em $TIMESTAMP" --memory-key "edicoes/$TIMESTAMP" >/dev/null 2>&1 &
fi