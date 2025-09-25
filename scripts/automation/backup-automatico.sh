#!/bin/bash
echo "💾 Criando backup automático..."

BACKUP_DIR="../backups_automaticos"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PROJECT_NAME=$(basename "$PWD")
BACKUP_FILE="$BACKUP_DIR/${PROJECT_NAME}_${TIMESTAMP}.tar.gz"

tar -czf "$BACKUP_FILE" \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='venv' \
    --exclude='__pycache__' \
    --exclude='*.log' \
    --exclude='*.tmp' \
    .

# Manter apenas últimos 10 backups
cd "$BACKUP_DIR"
ls -t ${PROJECT_NAME}_*.tar.gz | tail -n +11 | xargs rm -f 2>/dev/null || true

echo "✅ Backup criado: $BACKUP_FILE"
echo "📦 Backups mantidos: $(ls -1 ${PROJECT_NAME}_*.tar.gz 2>/dev/null | wc -l)"
