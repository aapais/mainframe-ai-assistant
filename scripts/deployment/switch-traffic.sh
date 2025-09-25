#!/bin/bash

# Traffic Switching Script for Blue-Green Deployment
# Usage: ./switch-traffic.sh <environment>

set -euo pipefail

ENVIRONMENT=${1:-staging}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "$SCRIPT_DIR/common.sh"

NEW_VERSION=${NEW_VERSION:-}
OLD_VERSION=${OLD_VERSION:-}

if [[ -z "$NEW_VERSION" || -z "$OLD_VERSION" ]]; then
    log_error "NEW_VERSION and OLD_VERSION environment variables must be set"
    exit 1
fi

log_info "Switching traffic from $OLD_VERSION to $NEW_VERSION in $ENVIRONMENT"

# Create canary service for gradual traffic shift
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Service
metadata:
  name: mainframe-ai-canary
  namespace: mainframe-ai-$ENVIRONMENT
spec:
  selector:
    app: mainframe-ai
    version: $NEW_VERSION
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP
EOF

# Gradual traffic shift using Istio VirtualService (if available)
if kubectl get crd virtualservices.networking.istio.io &> /dev/null; then
    log_info "Using Istio for gradual traffic shift"

    # 10% traffic to new version
    cat <<EOF | kubectl apply -f -
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: mainframe-ai-traffic
  namespace: mainframe-ai-$ENVIRONMENT
spec:
  http:
  - match:
    - headers:
        canary:
          exact: "true"
    route:
    - destination:
        host: mainframe-ai-canary
      weight: 100
  - route:
    - destination:
        host: mainframe-ai-service
      weight: 90
    - destination:
        host: mainframe-ai-canary
      weight: 10
EOF

    log_info "10% traffic routed to $NEW_VERSION, monitoring..."
    sleep 60

    # Check metrics and errors
    ERROR_RATE=$(kubectl exec -n monitoring prometheus-0 -- promtool query instant 'rate(http_requests_total{job="mainframe-ai",status=~"5.."}[5m])' | grep -o '[0-9.]*' || echo "0")

    if (( $(echo "$ERROR_RATE < 0.01" | bc -l) )); then
        log_success "Error rate acceptable, increasing traffic to 50%"

        # 50% traffic to new version
        cat <<EOF | kubectl apply -f -
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: mainframe-ai-traffic
  namespace: mainframe-ai-$ENVIRONMENT
spec:
  http:
  - route:
    - destination:
        host: mainframe-ai-service
      weight: 50
    - destination:
        host: mainframe-ai-canary
      weight: 50
EOF

        sleep 60

        # Final check before full switch
        ERROR_RATE=$(kubectl exec -n monitoring prometheus-0 -- promtool query instant 'rate(http_requests_total{job="mainframe-ai",status=~"5.."}[5m])' | grep -o '[0-9.]*' || echo "0")

        if (( $(echo "$ERROR_RATE < 0.01" | bc -l) )); then
            log_success "Error rate still acceptable, switching to 100%"
        else
            log_error "High error rate detected, rolling back"
            ./rollback.sh $ENVIRONMENT
            exit 1
        fi
    else
        log_error "High error rate detected during canary, rolling back"
        ./rollback.sh $ENVIRONMENT
        exit 1
    fi
fi

# Switch main service to new version
kubectl patch service mainframe-ai-service -n mainframe-ai-$ENVIRONMENT -p '{"spec":{"selector":{"version":"'$NEW_VERSION'"}}}'

log_success "Traffic successfully switched to $NEW_VERSION"

# Wait for DNS propagation
log_info "Waiting for DNS propagation..."
sleep 30

# Verify switch was successful
for i in {1..10}; do
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://mainframe-ai-service.mainframe-ai-$ENVIRONMENT.svc.cluster.local/health)
    if [[ "$RESPONSE" == "200" ]]; then
        log_success "Service responding correctly after traffic switch"
        break
    fi
    if [[ $i -eq 10 ]]; then
        log_error "Service not responding after traffic switch"
        exit 1
    fi
    sleep 10
done

# Clean up canary service
kubectl delete service mainframe-ai-canary -n mainframe-ai-$ENVIRONMENT 2>/dev/null || true

log_success "Traffic switch completed successfully"