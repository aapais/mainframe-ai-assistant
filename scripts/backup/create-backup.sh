#!/bin/bash

# Comprehensive Backup Script for SSO System
# Usage: ./create-backup.sh <environment> [backup_type]

set -euo pipefail

ENVIRONMENT=${1:-staging}
BACKUP_TYPE=${2:-full}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "$(dirname "$SCRIPT_DIR")/deployment/common.sh"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="${ENVIRONMENT}_${BACKUP_TYPE}_${TIMESTAMP}"
TEMP_DIR="/tmp/backups/$BACKUP_NAME"
S3_BUCKET="s3://mainframe-ai-backups"

log_info "Starting $BACKUP_TYPE backup for $ENVIRONMENT environment"
log_info "Backup name: $BACKUP_NAME"

mkdir -p "$TEMP_DIR"

# 1. Database Backup
backup_database() {
    log_info "Creating database backup..."

    local db_url=""
    if [[ "$ENVIRONMENT" == "production" ]]; then
        db_url="${PRODUCTION_DATABASE_URL:-}"
    else
        db_url="${STAGING_DATABASE_URL:-}"
    fi

    if [[ -z "$db_url" ]]; then
        log_error "Database URL not found for $ENVIRONMENT"
        return 1
    fi

    # Full database backup
    log_info "Creating full database dump..."
    pg_dump "$db_url" --verbose --format=custom --compress=9 > "$TEMP_DIR/database_full.dump"

    # Schema-only backup for faster restores
    log_info "Creating schema-only backup..."
    pg_dump "$db_url" --schema-only --format=plain > "$TEMP_DIR/database_schema.sql"

    # Data-only backup
    log_info "Creating data-only backup..."
    pg_dump "$db_url" --data-only --format=custom --compress=9 > "$TEMP_DIR/database_data.dump"

    # Critical tables backup (for quick recovery)
    log_info "Creating critical tables backup..."
    pg_dump "$db_url" --table=users --table=user_sessions --table=sso_configurations \
        --table=audit_logs --format=custom --compress=9 > "$TEMP_DIR/database_critical.dump"

    # Database statistics
    psql "$db_url" -c "
        SELECT
            schemaname,
            tablename,
            attname,
            inherited,
            null_frac,
            avg_width,
            n_distinct,
            most_common_vals,
            most_common_freqs,
            histogram_bounds
        FROM pg_stats
        WHERE schemaname = 'public';
    " > "$TEMP_DIR/database_statistics.txt"

    log_success "Database backup completed"
}

# 2. Kubernetes Configuration Backup
backup_kubernetes_config() {
    log_info "Creating Kubernetes configuration backup..."

    local namespace="mainframe-ai-$ENVIRONMENT"

    # All resources in namespace
    kubectl get all -n "$namespace" -o yaml > "$TEMP_DIR/k8s_all_resources.yaml"

    # Secrets (encrypted)
    kubectl get secrets -n "$namespace" -o yaml > "$TEMP_DIR/k8s_secrets.yaml"

    # ConfigMaps
    kubectl get configmaps -n "$namespace" -o yaml > "$TEMP_DIR/k8s_configmaps.yaml"

    # PersistentVolumes and PersistentVolumeClaims
    kubectl get pv,pvc -n "$namespace" -o yaml > "$TEMP_DIR/k8s_storage.yaml"

    # Network policies
    kubectl get networkpolicies -n "$namespace" -o yaml > "$TEMP_DIR/k8s_network_policies.yaml" 2>/dev/null || true

    # Service accounts and RBAC
    kubectl get serviceaccounts,roles,rolebindings -n "$namespace" -o yaml > "$TEMP_DIR/k8s_rbac.yaml"

    # Custom Resource Definitions
    kubectl get crd -o yaml > "$TEMP_DIR/k8s_crds.yaml" 2>/dev/null || true

    # Ingress configurations
    kubectl get ingress -n "$namespace" -o yaml > "$TEMP_DIR/k8s_ingress.yaml" 2>/dev/null || true

    log_success "Kubernetes configuration backup completed"
}

# 3. Application Configuration Backup
backup_application_config() {
    log_info "Creating application configuration backup..."

    local config_dir="$TEMP_DIR/application_config"
    mkdir -p "$config_dir"

    # Environment-specific configurations
    if [[ -f "config/environments/$ENVIRONMENT.json" ]]; then
        cp "config/environments/$ENVIRONMENT.json" "$config_dir/"
    fi

    # SSL certificates (metadata only, not private keys)
    kubectl get certificates -n "mainframe-ai-$ENVIRONMENT" -o yaml > "$config_dir/ssl_certificates.yaml" 2>/dev/null || true

    # External service configurations
    kubectl get services -n "mainframe-ai-$ENVIRONMENT" -o yaml > "$config_dir/services.yaml"

    # Load balancer configurations
    kubectl get ingress -n "mainframe-ai-$ENVIRONMENT" -o yaml > "$config_dir/load_balancers.yaml" 2>/dev/null || true

    log_success "Application configuration backup completed"
}

# 4. Security Backup
backup_security_config() {
    log_info "Creating security configuration backup..."

    local security_dir="$TEMP_DIR/security"
    mkdir -p "$security_dir"

    # RBAC configurations (anonymized)
    kubectl get clusterroles,clusterrolebindings -o yaml > "$security_dir/cluster_rbac.yaml"

    # Network policies
    kubectl get networkpolicies --all-namespaces -o yaml > "$security_dir/network_policies.yaml" 2>/dev/null || true

    # Pod security policies
    kubectl get psp -o yaml > "$security_dir/pod_security_policies.yaml" 2>/dev/null || true

    # Security contexts (from deployments)
    kubectl get deployments -n "mainframe-ai-$ENVIRONMENT" -o yaml | \
        yq eval '.items[].spec.template.spec.securityContext' > "$security_dir/security_contexts.yaml" 2>/dev/null || true

    log_success "Security configuration backup completed"
}

# 5. Monitoring and Logs Backup
backup_monitoring_logs() {
    log_info "Creating monitoring and logs backup..."

    local logs_dir="$TEMP_DIR/logs"
    mkdir -p "$logs_dir"

    # Application logs (last 7 days)
    local pods=$(kubectl get pods -n "mainframe-ai-$ENVIRONMENT" -l app=mainframe-ai -o jsonpath='{.items[*].metadata.name}')

    for pod in $pods; do
        if kubectl get pod "$pod" -n "mainframe-ai-$ENVIRONMENT" &>/dev/null; then
            kubectl logs "$pod" -n "mainframe-ai-$ENVIRONMENT" --since=168h > "$logs_dir/${pod}_logs.txt" 2>/dev/null || true
        fi
    done

    # Audit logs if available
    if [[ -d "/var/log/audit" ]]; then
        find /var/log/audit -name "*.log" -mtime -7 -exec cp {} "$logs_dir/" \; 2>/dev/null || true
    fi

    # Metrics snapshots (if Prometheus is available)
    if kubectl get pods -n monitoring -l app=prometheus &>/dev/null; then
        kubectl exec -n monitoring prometheus-0 -- promtool query instant 'up' > "$logs_dir/prometheus_up.txt" 2>/dev/null || true
        kubectl exec -n monitoring prometheus-0 -- promtool query instant 'rate(http_requests_total[5m])' > "$logs_dir/http_request_rates.txt" 2>/dev/null || true
    fi

    log_success "Monitoring and logs backup completed"
}

# 6. File System Backup (if using persistent volumes)
backup_persistent_storage() {
    log_info "Creating persistent storage backup..."

    local storage_dir="$TEMP_DIR/storage"
    mkdir -p "$storage_dir"

    # Get persistent volume claims
    local pvcs=$(kubectl get pvc -n "mainframe-ai-$ENVIRONMENT" -o jsonpath='{.items[*].metadata.name}')

    for pvc in $pvcs; do
        if [[ -n "$pvc" ]]; then
            log_info "Backing up PVC: $pvc"

            # Create a backup job for the PVC
            cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: backup-$pvc-$TIMESTAMP
  namespace: mainframe-ai-$ENVIRONMENT
spec:
  template:
    spec:
      containers:
      - name: backup
        image: alpine:latest
        command: ["/bin/sh", "-c"]
        args:
        - |
          apk add --no-cache rsync tar gzip
          cd /data
          tar czf /backup/${pvc}_backup.tar.gz .
        volumeMounts:
        - name: data
          mountPath: /data
        - name: backup
          mountPath: /backup
      restartPolicy: Never
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: $pvc
      - name: backup
        emptyDir: {}
EOF

            # Wait for backup job to complete
            kubectl wait --for=condition=complete job/backup-$pvc-$TIMESTAMP -n "mainframe-ai-$ENVIRONMENT" --timeout=300s

            # Copy backup file from pod
            local backup_pod=$(kubectl get pods -n "mainframe-ai-$ENVIRONMENT" -l job-name=backup-$pvc-$TIMESTAMP -o jsonpath='{.items[0].metadata.name}')
            kubectl cp "$backup_pod":/backup/${pvc}_backup.tar.gz "$storage_dir/${pvc}_backup.tar.gz" -n "mainframe-ai-$ENVIRONMENT"

            # Cleanup backup job
            kubectl delete job backup-$pvc-$TIMESTAMP -n "mainframe-ai-$ENVIRONMENT"
        fi
    done

    log_success "Persistent storage backup completed"
}

# Main backup execution
main() {
    log_info "Starting backup process..."

    case "$BACKUP_TYPE" in
        "full")
            backup_database
            backup_kubernetes_config
            backup_application_config
            backup_security_config
            backup_monitoring_logs
            backup_persistent_storage
            ;;
        "database")
            backup_database
            ;;
        "config")
            backup_kubernetes_config
            backup_application_config
            backup_security_config
            ;;
        "logs")
            backup_monitoring_logs
            ;;
        "storage")
            backup_persistent_storage
            ;;
        *)
            log_error "Unknown backup type: $BACKUP_TYPE"
            log_info "Available types: full, database, config, logs, storage"
            exit 1
            ;;
    esac

    # Create backup manifest
    cat > "$TEMP_DIR/backup_manifest.json" << EOF
{
    "backup_name": "$BACKUP_NAME",
    "environment": "$ENVIRONMENT",
    "backup_type": "$BACKUP_TYPE",
    "timestamp": "$TIMESTAMP",
    "created_by": "$(whoami)",
    "hostname": "$(hostname)",
    "files": $(find "$TEMP_DIR" -type f -exec basename {} \; | jq -R . | jq -s .),
    "total_size": "$(du -sh "$TEMP_DIR" | cut -f1)"
}
EOF

    # Compress entire backup
    log_info "Compressing backup..."
    tar czf "/tmp/${BACKUP_NAME}.tar.gz" -C "/tmp/backups" "$BACKUP_NAME"

    # Upload to S3
    if command -v aws &> /dev/null && [[ -n "${AWS_ACCESS_KEY_ID:-}" ]]; then
        log_info "Uploading backup to S3..."
        aws s3 cp "/tmp/${BACKUP_NAME}.tar.gz" "$S3_BUCKET/$ENVIRONMENT/$(date +%Y/%m)/"

        # Set lifecycle policy for automatic cleanup
        aws s3api put-object-tagging \
            --bucket "${S3_BUCKET#s3://}" \
            --key "$ENVIRONMENT/$(date +%Y/%m)/${BACKUP_NAME}.tar.gz" \
            --tagging "TagSet=[{Key=Environment,Value=$ENVIRONMENT},{Key=BackupType,Value=$BACKUP_TYPE},{Key=AutoDelete,Value=true}]"

        log_success "Backup uploaded to S3: $S3_BUCKET/$ENVIRONMENT/$(date +%Y/%m)/${BACKUP_NAME}.tar.gz"
    else
        log_warning "AWS CLI not available or not configured, backup saved locally at /tmp/${BACKUP_NAME}.tar.gz"
    fi

    # Cleanup temporary directory
    rm -rf "$TEMP_DIR"

    # Verify backup integrity
    if tar tzf "/tmp/${BACKUP_NAME}.tar.gz" &>/dev/null; then
        log_success "Backup integrity verified"
    else
        log_error "Backup integrity check failed"
        exit 1
    fi

    log_success "Backup completed successfully: $BACKUP_NAME"

    # Output backup information for CI/CD
    echo "BACKUP_NAME=$BACKUP_NAME" >> "$GITHUB_OUTPUT" 2>/dev/null || true
    echo "BACKUP_SIZE=$(du -h "/tmp/${BACKUP_NAME}.tar.gz" | cut -f1)" >> "$GITHUB_OUTPUT" 2>/dev/null || true
}

# Cleanup function for unexpected exits
cleanup() {
    local exit_code=$?
    log_info "Cleaning up temporary files..."
    rm -rf "$TEMP_DIR" 2>/dev/null || true
    exit $exit_code
}

trap cleanup EXIT

# Run main function
main "$@"