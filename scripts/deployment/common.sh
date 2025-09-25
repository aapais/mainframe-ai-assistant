#!/bin/bash

# Common functions and utilities for deployment scripts

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Check if required tools are installed
check_required_tools() {
    local tools=("$@")
    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "Required tool '$tool' is not installed"
            return 1
        fi
    done
    return 0
}

# Wait for deployment to be ready
wait_for_deployment() {
    local deployment=$1
    local namespace=${2:-default}
    local timeout=${3:-300}

    log_info "Waiting for deployment $deployment to be ready..."

    if kubectl rollout status deployment/"$deployment" -n "$namespace" --timeout="${timeout}s"; then
        log_success "Deployment $deployment is ready"
        return 0
    else
        log_error "Deployment $deployment failed to become ready within ${timeout}s"
        return 1
    fi
}

# Health check function
health_check() {
    local url=$1
    local max_attempts=${2:-30}
    local sleep_time=${3:-10}

    log_info "Performing health check on $url"

    for ((i=1; i<=max_attempts; i++)); do
        if curl -f -s -o /dev/null "$url/health"; then
            log_success "Health check passed for $url"
            return 0
        fi

        if [[ $i -eq $max_attempts ]]; then
            log_error "Health check failed for $url after $max_attempts attempts"
            return 1
        fi

        log_info "Health check attempt $i/$max_attempts failed, retrying in ${sleep_time}s..."
        sleep "$sleep_time"
    done
}

# Get current active version (for blue-green deployment)
get_current_version() {
    local service=$1
    local namespace=${2:-default}

    kubectl get service "$service" -n "$namespace" -o jsonpath='{.spec.selector.version}' 2>/dev/null || echo "blue"
}

# Rollback deployment
rollback_deployment() {
    local deployment=$1
    local namespace=${2:-default}
    local revision=${3:-}

    log_warning "Rolling back deployment $deployment"

    if [[ -n "$revision" ]]; then
        kubectl rollout undo deployment/"$deployment" -n "$namespace" --to-revision="$revision"
    else
        kubectl rollout undo deployment/"$deployment" -n "$namespace"
    fi

    wait_for_deployment "$deployment" "$namespace"
}

# Create backup
create_backup() {
    local environment=$1
    local backup_type=${2:-full}

    log_info "Creating $backup_type backup for $environment"

    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_name="${environment}_${backup_type}_${timestamp}"

    # Database backup
    if [[ -n "${DATABASE_URL:-}" ]]; then
        pg_dump "$DATABASE_URL" | gzip > "/tmp/${backup_name}_db.sql.gz"

        # Upload to S3
        if command -v aws &> /dev/null; then
            aws s3 cp "/tmp/${backup_name}_db.sql.gz" "s3://mainframe-ai-backups/$environment/database/"
            rm "/tmp/${backup_name}_db.sql.gz"
        fi
    fi

    # Configuration backup
    kubectl get configmaps,secrets -n "mainframe-ai-$environment" -o yaml > "/tmp/${backup_name}_config.yaml"

    if command -v aws &> /dev/null; then
        aws s3 cp "/tmp/${backup_name}_config.yaml" "s3://mainframe-ai-backups/$environment/config/"
        rm "/tmp/${backup_name}_config.yaml"
    fi

    log_success "Backup $backup_name created successfully"
    echo "$backup_name"
}

# Verify deployment
verify_deployment() {
    local environment=$1
    local expected_version=${2:-}

    log_info "Verifying deployment for $environment"

    # Check if pods are running
    local running_pods=$(kubectl get pods -n "mainframe-ai-$environment" -l app=mainframe-ai --field-selector=status.phase=Running -o json | jq '.items | length')

    if [[ $running_pods -lt 2 ]]; then
        log_error "Not enough pods running ($running_pods < 2)"
        return 1
    fi

    # Check service endpoints
    local ready_endpoints=$(kubectl get endpoints -n "mainframe-ai-$environment" mainframe-ai-service -o json | jq '.subsets[0].addresses | length // 0')

    if [[ $ready_endpoints -lt 2 ]]; then
        log_error "Not enough ready endpoints ($ready_endpoints < 2)"
        return 1
    fi

    # Check if correct version is deployed
    if [[ -n "$expected_version" ]]; then
        local current_version=$(get_current_version mainframe-ai-service "mainframe-ai-$environment")
        if [[ "$current_version" != "$expected_version" ]]; then
            log_error "Version mismatch: expected $expected_version, got $current_version"
            return 1
        fi
    fi

    log_success "Deployment verification passed"
    return 0
}

# Send notification
send_notification() {
    local message=$1
    local channel=${2:-#deployments}
    local status=${3:-info}

    if [[ -n "${SLACK_WEBHOOK:-}" ]]; then
        local color="good"
        case "$status" in
            error|failed) color="danger" ;;
            warning) color="warning" ;;
        esac

        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"channel\": \"$channel\",
                \"text\": \"$message\",
                \"color\": \"$color\"
            }" \
            "$SLACK_WEBHOOK"
    fi

    # Also log the message
    case "$status" in
        error|failed) log_error "$message" ;;
        warning) log_warning "$message" ;;
        success) log_success "$message" ;;
        *) log_info "$message" ;;
    esac
}

# Get secret from Kubernetes
get_k8s_secret() {
    local secret_name=$1
    local key=$2
    local namespace=${3:-default}

    kubectl get secret "$secret_name" -n "$namespace" -o jsonpath="{.data.$key}" | base64 -d
}

# Update deployment image
update_deployment_image() {
    local deployment=$1
    local image=$2
    local namespace=${3:-default}

    log_info "Updating deployment $deployment with image $image"

    kubectl set image deployment/"$deployment" -n "$namespace" mainframe-ai="$image"

    wait_for_deployment "$deployment" "$namespace"
}

# Check resource usage
check_resource_usage() {
    local namespace=$1

    log_info "Checking resource usage for namespace $namespace"

    kubectl top pods -n "$namespace" --sort-by=cpu
    kubectl top pods -n "$namespace" --sort-by=memory
}

# Cleanup old deployments
cleanup_old_deployments() {
    local environment=$1
    local keep_revisions=${2:-5}

    log_info "Cleaning up old deployments, keeping last $keep_revisions revisions"

    # Get deployment history and cleanup old revisions
    kubectl get replicasets -n "mainframe-ai-$environment" -o json | \
        jq -r ".items[] | select(.metadata.labels.app==\"mainframe-ai\") | .metadata.name" | \
        sort -V | head -n -"$keep_revisions" | \
        while IFS= read -r rs; do
            if [[ -n "$rs" ]]; then
                kubectl delete replicaset "$rs" -n "mainframe-ai-$environment"
                log_info "Deleted old replicaset: $rs"
            fi
        done
}

# Export functions for use in other scripts
export -f log_info log_success log_warning log_error
export -f check_required_tools wait_for_deployment health_check
export -f get_current_version rollback_deployment create_backup
export -f verify_deployment send_notification get_k8s_secret
export -f update_deployment_image check_resource_usage cleanup_old_deployments