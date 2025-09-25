#!/bin/bash

# Blue-Green Deployment Script for Zero-Downtime SSO System
# Usage: ./blue-green-deploy.sh <environment> <image>

set -euo pipefail

ENVIRONMENT=${1:-staging}
IMAGE=${2:-}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

source "$SCRIPT_DIR/common.sh"

if [[ -z "$IMAGE" ]]; then
    log_error "Image parameter is required"
    exit 1
fi

log_info "Starting Blue-Green deployment for $ENVIRONMENT"
log_info "Deploying image: $IMAGE"

# Determine current active deployment
CURRENT_ACTIVE=$(kubectl get service mainframe-ai-service -o jsonpath='{.spec.selector.version}' 2>/dev/null || echo "blue")
if [[ "$CURRENT_ACTIVE" == "blue" ]]; then
    NEW_VERSION="green"
    OLD_VERSION="blue"
else
    NEW_VERSION="blue"
    OLD_VERSION="green"
fi

log_info "Current active: $OLD_VERSION, Deploying to: $NEW_VERSION"

# Deploy new version
cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mainframe-ai-$NEW_VERSION
  namespace: mainframe-ai-$ENVIRONMENT
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mainframe-ai
      version: $NEW_VERSION
  template:
    metadata:
      labels:
        app: mainframe-ai
        version: $NEW_VERSION
    spec:
      containers:
      - name: mainframe-ai
        image: $IMAGE
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "$ENVIRONMENT"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: mainframe-ai-secrets
              key: database-url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: mainframe-ai-secrets
              key: jwt-secret
        - name: SSO_CLIENT_ID
          valueFrom:
            secretKeyRef:
              name: mainframe-ai-secrets
              key: sso-client-id
        - name: SSO_CLIENT_SECRET
          valueFrom:
            secretKeyRef:
              name: mainframe-ai-secrets
              key: sso-client-secret
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "500m"
      imagePullSecrets:
      - name: ghcr-secret
EOF

# Wait for deployment to be ready
log_info "Waiting for $NEW_VERSION deployment to be ready..."
kubectl rollout status deployment/mainframe-ai-$NEW_VERSION -n mainframe-ai-$ENVIRONMENT --timeout=600s

# Verify new deployment health
log_info "Verifying $NEW_VERSION deployment health..."
NEW_POD=$(kubectl get pods -l app=mainframe-ai,version=$NEW_VERSION -n mainframe-ai-$ENVIRONMENT -o jsonpath='{.items[0].metadata.name}')

# Run health checks
for i in {1..30}; do
    if kubectl exec -n mainframe-ai-$ENVIRONMENT $NEW_POD -- curl -f http://localhost:3000/health > /dev/null 2>&1; then
        log_success "$NEW_VERSION deployment is healthy"
        break
    fi
    if [[ $i -eq 30 ]]; then
        log_error "$NEW_VERSION deployment failed health check"
        exit 1
    fi
    sleep 10
done

# Test SSO functionality
log_info "Testing SSO functionality on $NEW_VERSION..."
kubectl exec -n mainframe-ai-$ENVIRONMENT $NEW_POD -- node -e "
const https = require('https');
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/auth/sso/test',
  method: 'GET'
};
const req = https.request(options, (res) => {
  if (res.statusCode === 200 || res.statusCode === 401) {
    console.log('SSO endpoint responding');
    process.exit(0);
  } else {
    process.exit(1);
  }
});
req.end();
"

log_success "$NEW_VERSION deployment verified successfully"
echo "NEW_VERSION=$NEW_VERSION" >> $GITHUB_OUTPUT
echo "OLD_VERSION=$OLD_VERSION" >> $GITHUB_OUTPUT