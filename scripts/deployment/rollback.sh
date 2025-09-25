#!/bin/bash

# Automated Rollback Script for Zero-Downtime Recovery
# Usage: ./rollback.sh <environment> [version]

set -euo pipefail

ENVIRONMENT=${1:-staging}
TARGET_VERSION=${2:-}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "$SCRIPT_DIR/common.sh"

NAMESPACE="mainframe-ai-$ENVIRONMENT"
ROLLBACK_REASON="${ROLLBACK_REASON:-Manual rollback requested}"

log_info "Starting rollback process for $ENVIRONMENT"
log_info "Reason: $ROLLBACK_REASON"

# Verify prerequisites
check_required_tools kubectl jq

# Check if namespace exists
if ! kubectl get namespace "$NAMESPACE" &>/dev/null; then
    log_error "Namespace $NAMESPACE does not exist"
    exit 1
fi

# Get deployment information
DEPLOYMENT_NAME="mainframe-ai"
if ! kubectl get deployment "$DEPLOYMENT_NAME" -n "$NAMESPACE" &>/dev/null; then
    log_error "Deployment $DEPLOYMENT_NAME not found in namespace $NAMESPACE"
    exit 1
fi

# Create emergency backup before rollback
log_info "Creating emergency backup before rollback..."
BACKUP_NAME=$(./scripts/backup/emergency-backup.sh "$ENVIRONMENT")
log_success "Emergency backup created: $BACKUP_NAME"

# Get current deployment status
CURRENT_REVISION=$(kubectl rollout history deployment/"$DEPLOYMENT_NAME" -n "$NAMESPACE" --output=json | jq -r '.items[-1].revision')
CURRENT_IMAGE=$(kubectl get deployment "$DEPLOYMENT_NAME" -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].image}')

log_info "Current deployment revision: $CURRENT_REVISION"
log_info "Current image: $CURRENT_IMAGE"

# Determine target revision
if [[ -n "$TARGET_VERSION" ]]; then
    # Find revision with specific version/image
    REVISIONS=$(kubectl rollout history deployment/"$DEPLOYMENT_NAME" -n "$NAMESPACE" --output=json | jq -r '.items[].revision')
    TARGET_REVISION=""

    for rev in $REVISIONS; do
        REV_IMAGE=$(kubectl rollout history deployment/"$DEPLOYMENT_NAME" -n "$NAMESPACE" --revision="$rev" --output=json | jq -r '.spec.template.spec.containers[0].image')
        if [[ "$REV_IMAGE" == *"$TARGET_VERSION"* ]]; then
            TARGET_REVISION="$rev"
            break
        fi
    done

    if [[ -z "$TARGET_REVISION" ]]; then
        log_error "Could not find revision with version: $TARGET_VERSION"
        exit 1
    fi
else
    # Get last known good revision (previous to current)
    REVISIONS=$(kubectl rollout history deployment/"$DEPLOYMENT_NAME" -n "$NAMESPACE" --output=json | jq -r '.items[].revision' | sort -n)
    TARGET_REVISION=""

    for rev in $REVISIONS; do
        if [[ "$rev" != "$CURRENT_REVISION" ]]; then
            TARGET_REVISION="$rev"
        fi
    done

    if [[ -z "$TARGET_REVISION" ]]; then
        log_error "No previous revision found for rollback"
        exit 1
    fi
fi

TARGET_IMAGE=$(kubectl rollout history deployment/"$DEPLOYMENT_NAME" -n "$NAMESPACE" --revision="$TARGET_REVISION" --output=json | jq -r '.spec.template.spec.containers[0].image')

log_info "Rolling back to revision: $TARGET_REVISION"
log_info "Target image: $TARGET_IMAGE"

# Create rollback audit entry
ROLLBACK_ID="rollback_$(date +%Y%m%d_%H%M%S)"
cat > "/tmp/${ROLLBACK_ID}_info.json" << EOF
{
    "rollback_id": "$ROLLBACK_ID",
    "environment": "$ENVIRONMENT",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "reason": "$ROLLBACK_REASON",
    "current_revision": "$CURRENT_REVISION",
    "current_image": "$CURRENT_IMAGE",
    "target_revision": "$TARGET_REVISION",
    "target_image": "$TARGET_IMAGE",
    "initiated_by": "$(whoami)",
    "backup_created": "$BACKUP_NAME"
}
EOF

# Scale down current deployment to minimize impact
log_info "Scaling down current deployment..."
ORIGINAL_REPLICAS=$(kubectl get deployment "$DEPLOYMENT_NAME" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}')
kubectl scale deployment "$DEPLOYMENT_NAME" -n "$NAMESPACE" --replicas=1

# Wait for scale down
sleep 10

# Check for blue-green deployment pattern
CURRENT_ACTIVE=$(get_current_version mainframe-ai-service "$NAMESPACE" 2>/dev/null || echo "")

if [[ -n "$CURRENT_ACTIVE" && ("$CURRENT_ACTIVE" == "blue" || "$CURRENT_ACTIVE" == "green") ]]; then
    log_info "Detected blue-green deployment pattern"

    # Determine inactive version
    if [[ "$CURRENT_ACTIVE" == "blue" ]]; then
        INACTIVE_VERSION="green"
    else
        INACTIVE_VERSION="blue"
    fi

    # Check if inactive deployment exists and is ready
    if kubectl get deployment "mainframe-ai-$INACTIVE_VERSION" -n "$NAMESPACE" &>/dev/null; then
        INACTIVE_READY=$(kubectl get deployment "mainframe-ai-$INACTIVE_VERSION" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}')

        if [[ "$INACTIVE_READY" -gt 0 ]]; then
            log_info "Using blue-green rollback to $INACTIVE_VERSION"

            # Switch service to inactive version
            kubectl patch service mainframe-ai-service -n "$NAMESPACE" -p '{"spec":{"selector":{"version":"'$INACTIVE_VERSION'"}}}'

            # Wait for DNS propagation
            sleep 30

            # Verify rollback
            if health_check "http://mainframe-ai-service.$NAMESPACE.svc.cluster.local" 5 10; then
                log_success "Blue-green rollback successful"

                # Scale down old version
                kubectl scale deployment "mainframe-ai-$CURRENT_ACTIVE" -n "$NAMESPACE" --replicas=0

                send_notification "✅ Rollback successful for $ENVIRONMENT (blue-green)" "#deployments" "success"
                exit 0
            else
                log_error "Blue-green rollback failed health check, reverting..."
                kubectl patch service mainframe-ai-service -n "$NAMESPACE" -p '{"spec":{"selector":{"version":"'$CURRENT_ACTIVE'"}}}'
            fi
        fi
    fi
fi

# Standard rollback using kubectl rollout undo
log_info "Performing standard rollback..."

if kubectl rollout undo deployment/"$DEPLOYMENT_NAME" -n "$NAMESPACE" --to-revision="$TARGET_REVISION"; then
    log_info "Rollback command executed, waiting for completion..."
else
    log_error "Rollback command failed"
    exit 1
fi

# Wait for rollback to complete
if wait_for_deployment "$DEPLOYMENT_NAME" "$NAMESPACE" 300; then
    log_success "Rollback deployment completed"
else
    log_error "Rollback deployment failed"

    # Emergency restore from backup
    log_info "Attempting emergency restore from backup..."
    if ./scripts/backup/restore-backup.sh "$ENVIRONMENT" "$BACKUP_NAME"; then
        log_success "Emergency restore completed"
    else
        log_error "Emergency restore failed - manual intervention required"
        send_notification "🚨 CRITICAL: Rollback and emergency restore failed for $ENVIRONMENT. Manual intervention required immediately!" "#incidents" "error"
        exit 1
    fi
fi

# Scale back to original replica count
log_info "Scaling back to original replica count: $ORIGINAL_REPLICAS"
kubectl scale deployment "$DEPLOYMENT_NAME" -n "$NAMESPACE" --replicas="$ORIGINAL_REPLICAS"

wait_for_deployment "$DEPLOYMENT_NAME" "$NAMESPACE" 180

# Verify rollback health
log_info "Performing post-rollback health checks..."

# Wait for all pods to be ready
kubectl wait --for=condition=ready pod -l app=mainframe-ai -n "$NAMESPACE" --timeout=300s

# Health check
SERVICE_URL="http://mainframe-ai-service.$NAMESPACE.svc.cluster.local"
if health_check "$SERVICE_URL" 10 15; then
    log_success "Post-rollback health check passed"
else
    log_error "Post-rollback health check failed"
    send_notification "⚠️ Rollback completed but health checks failing for $ENVIRONMENT" "#incidents" "warning"
    exit 1
fi

# Test critical SSO functionality
log_info "Testing SSO functionality after rollback..."
SSO_POD=$(kubectl get pods -n "$NAMESPACE" -l app=mainframe-ai -o jsonpath='{.items[0].metadata.name}')

if kubectl exec -n "$NAMESPACE" "$SSO_POD" -- curl -f -s "http://localhost:3000/auth/health" > /dev/null; then
    log_success "SSO functionality test passed"
else
    log_warning "SSO functionality test failed - may need manual verification"
fi

# Database connectivity test
log_info "Testing database connectivity..."
if kubectl exec -n "$NAMESPACE" "$SSO_POD" -- node -e "
const { Pool } = require('pg');
const pool = new Pool({connectionString: process.env.DATABASE_URL});
pool.query('SELECT NOW()').then(() => {
    console.log('Database connection successful');
    process.exit(0);
}).catch(err => {
    console.error('Database connection failed:', err.message);
    process.exit(1);
});
" &>/dev/null; then
    log_success "Database connectivity test passed"
else
    log_warning "Database connectivity test failed"
fi

# Update rollback audit log
jq --arg status "completed" --arg completed_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
   '.status = $status | .completed_at = $completed_at' \
   "/tmp/${ROLLBACK_ID}_info.json" > "/tmp/${ROLLBACK_ID}_final.json"

# Upload rollback log
if command -v aws &> /dev/null; then
    aws s3 cp "/tmp/${ROLLBACK_ID}_final.json" "s3://mainframe-ai-audit-logs/$ENVIRONMENT/rollbacks/"
fi

# Verify current deployment
FINAL_REVISION=$(kubectl rollout history deployment/"$DEPLOYMENT_NAME" -n "$NAMESPACE" --output=json | jq -r '.items[-1].revision')
FINAL_IMAGE=$(kubectl get deployment "$DEPLOYMENT_NAME" -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].image}')

log_success "Rollback completed successfully!"
log_info "Final revision: $FINAL_REVISION"
log_info "Final image: $FINAL_IMAGE"

# Send success notification
send_notification "✅ Rollback completed successfully for $ENVIRONMENT
• From: $CURRENT_IMAGE (rev $CURRENT_REVISION)
• To: $FINAL_IMAGE (rev $FINAL_REVISION)
• Reason: $ROLLBACK_REASON
• Backup: $BACKUP_NAME" "#deployments" "success"

# Output for CI/CD
echo "ROLLBACK_ID=$ROLLBACK_ID" >> "$GITHUB_OUTPUT" 2>/dev/null || true
echo "FINAL_REVISION=$FINAL_REVISION" >> "$GITHUB_OUTPUT" 2>/dev/null || true
echo "FINAL_IMAGE=$FINAL_IMAGE" >> "$GITHUB_OUTPUT" 2>/dev/null || true

log_success "Rollback process completed successfully"