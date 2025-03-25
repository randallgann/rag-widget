# Multi-Environment Deployment Strategy

This document outlines our implementation plan for creating a consistent deployment approach across multiple environments: local Docker Compose, Minikube, and production Kubernetes.

## Current State Analysis

After reviewing the current deployment approach, we've identified several issues:

1. **Inconsistent Environment Configuration**:
   - Hardcoded URLs in Auth0 configuration
   - Different URLs between Docker Compose (localhost) and Kubernetes (service names or 127.0.0.1)
   - Manual configuration changes required when switching environments

2. **Authentication Flow Fragility**:
   - Auth callback URLs are environment-dependent
   - Cookies and sessions tied to specific domains
   - Redirection logic assumes specific endpoint structure

3. **Service Discovery Issues**:
   - Frontend-to-backend communication uses different patterns across environments
   - Internal service references inconsistent (host.docker.internal vs service names)

4. **Infrastructure Management**:
   - No clear boundary between environment-specific and shared configuration
   - Direct service exposure instead of unified routing
   - Initialization and startup sequences differ between environments

## Implementation Plan

### 1. Create a Unified Environment Configuration System

**a. Create Environment-Specific Config Maps**
```yaml
# config/local.yaml (for docker-compose)
environment: local
base_url: http://localhost
services:
  frontend:
    port: 3003
    internal_url: http://frontend
    external_url: http://localhost:3003
  auth_server:
    port: 3001
    internal_url: http://auth-server:3001
    external_url: http://localhost:3001
  admin_portal:
    port: 3000
    internal_url: http://admin-portal:3000
    external_url: http://localhost:3000
auth0:
  callback_url: "{{base_url}}:3001/callback"
  logout_url: "{{base_url}}:3003"
```

```yaml
# config/minikube.yaml
environment: minikube
base_url: http://127.0.0.1
services:
  frontend:
    port: 3003
    internal_url: http://frontend
    external_url: http://127.0.0.1:3003
  auth_server:
    port: 3001
    internal_url: http://auth-server:3001
    external_url: http://127.0.0.1:3001
  admin_portal:
    port: 3000
    internal_url: http://admin-portal:3000
    external_url: http://127.0.0.1:3000
auth0:
  callback_url: "{{base_url}}:3001/callback"
  logout_url: "{{base_url}}:3003"
```

```yaml
# config/production.yaml
environment: production
base_url: https://app.yourdomain.com
services:
  frontend:
    port: 80
    internal_url: http://frontend
    external_url: https://app.yourdomain.com
  auth_server:
    port: 3001
    internal_url: http://auth-server:3001
    external_url: https://app.yourdomain.com/auth
  admin_portal:
    port: 3000
    internal_url: http://admin-portal:3000
    external_url: https://app.yourdomain.com/admin
auth0:
  callback_url: "{{base_url}}/auth/callback"
  logout_url: "{{base_url}}"
```

**b. Create a Configuration Loader**
- Build a Node.js module that loads the appropriate config based on NODE_ENV
- Include template string interpolation for dynamic values
- Provide fallback values for missing properties

### 2. Implement Environment Detection & Deployment Scripts

**a. Create a `deploy.sh` Script**
```bash
#!/bin/bash
# Usage: ./deploy.sh [local|minikube|production]

ENV=${1:-local}
CONFIG_FILE="./config/${ENV}.yaml"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Error: Configuration file not found: $CONFIG_FILE"
  exit 1
fi

# Extract values from config file using yq or similar tool
BASE_URL=$(yq eval '.base_url' "$CONFIG_FILE")
CALLBACK_URL=$(yq eval '.auth0.callback_url' "$CONFIG_FILE" | envsubst)

# Update Auth0 secrets
./scripts/create-auth0-secrets.sh --callback-url="$CALLBACK_URL"

# Deploy to appropriate environment
case "$ENV" in
  local)
    docker-compose up --build
    ;;
  minikube)
    # Build images in Minikube's Docker daemon
    eval $(minikube -p minikube docker-env)
    ./scripts/build-minikube-images.sh
    
    # Apply Kubernetes manifests
    kubectl apply -f kubernetes/configmap-${ENV}.yml
    kubectl apply -f kubernetes/postgres.yml
    kubectl apply -f kubernetes/auth-server.yml
    kubectl apply -f kubernetes/admin-portal.yml
    kubectl apply -f kubernetes/frontend.yml
    ;;
  production)
    # Production deployment logic
    # Could use Helm or direct kubectl with production configs
    ;;
esac
```

**b. Create Environment Detection in Application**
- Update application code to detect environment
- Implement environment-specific behavior when necessary
- Use feature flags for environment-specific functionality

### 3. Refactor Application for Environment Agnosticism

**a. Frontend Updates**
- Use relative URLs for all API endpoints
- Implement a configuration endpoint that returns environment-specific settings
- Add environment-aware service discovery

```javascript
// frontend/src/config.js
export async function getConfig() {
  const response = await fetch('/api/config');
  return response.json();
}

// Usage
import { getConfig } from './config';

async function initApp() {
  const config = await getConfig();
  // Use config.apiBaseUrl for API calls
  // Use config.auth.callbackUrl for Auth0 configuration
}
```

**b. API Gateway Pattern**
- Implement an API gateway pattern in the frontend container
- Use Nginx as a reverse proxy to route API requests
- Configure based on environment variables

```nginx
# nginx.conf.template
server {
    listen 80;
    
    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass ${API_URL};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /config {
        default_type application/json;
        return 200 '${APP_CONFIG_JSON}';
    }
}
```

**c. Database Access and Initialization**
- Implement robust database connection retry logic
- Create a database initialization job separate from application startup
- Use readiness probes for proper orchestration

### 4. Kubernetes Resource Updates

**a. ConfigMaps for Environment Configuration**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  ENVIRONMENT: "minikube"
  BASE_URL: "http://127.0.0.1"
  FRONTEND_EXTERNAL_URL: "http://127.0.0.1:3003"
  AUTH_SERVER_EXTERNAL_URL: "http://127.0.0.1:3001"
  ADMIN_PORTAL_EXTERNAL_URL: "http://127.0.0.1:3000"
  API_URL: "http://auth-server:3001"
```

**b. Ingress Controller for Production**
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /$1
spec:
  rules:
  - host: app.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 80
      - path: /auth
        pathType: Prefix
        backend:
          service:
            name: auth-server
            port:
              number: 3001
      - path: /admin
        pathType: Prefix
        backend:
          service:
            name: admin-portal
            port:
              number: 3000
```

**c. Update Deployment Templates**
- Add proper health checks and readiness probes
- Ensure consistent environment variable injection
- Standardize startup procedures

### 5. Future Evolution: Helm Charts

```
rag-widget/
├── charts/
│   ├── Chart.yaml
│   ├── values.yaml           # Default values
│   ├── values-local.yaml     # Local override values
│   ├── values-minikube.yaml  # Minikube override values
│   ├── values-production.yaml # Production override values
│   └── templates/
│       ├── configmap.yaml
│       ├── postgres.yaml
│       ├── auth-server.yaml
│       ├── admin-portal.yaml
│       ├── frontend.yaml
│       └── ingress.yaml
```

**Deploy with:**
```bash
helm install rag-widget ./charts -f ./charts/values-minikube.yaml
```

## Implementation Roadmap

### Phase 1: Configuration System (1-2 days)
- Create environment config files
- Build configuration loader module
- Update deployment scripts

### Phase 2: Application Refactoring (2-3 days)
- Update frontend to use dynamic configuration
- Implement API gateway pattern
- Enhance database connection handling

### Phase 3: Kubernetes Resources (1-2 days)
- Create environment-specific ConfigMaps
- Update deployment templates
- Test across environments

### Phase 4: Documentation & Training (1 day)
- Document new development workflow
- Create troubleshooting guide
- Train team on new approach

### Phase 5: Helm Migration (Optional, 2-3 days)
- Convert Kubernetes resources to Helm templates
- Create environment-specific values files
- Test and document Helm-based deployment

## Benefits of New Approach

1. **Environment Consistency**: Same code works across all environments
2. **Simplified Onboarding**: Clear development workflow for new team members
3. **Reduced Configuration Errors**: Automated configuration generation
4. **Deployment Flexibility**: Easy deployment to any environment
5. **Future-Proof**: Ready for additional environments or cloud providers