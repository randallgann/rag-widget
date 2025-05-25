# Revised Minikube Deployment Guide

This guide provides comprehensive step-by-step instructions for deploying the RAG Widget application on Minikube for local development and testing.

## Prerequisites

- [Minikube](https://minikube.sigs.k8s.io/docs/start/) installed
- [kubectl](https://kubernetes.io/docs/tasks/tools/) installed
- [Docker](https://docs.docker.com/get-docker/) installed
- Access to the project repository

## 1. Starting Minikube

Start Minikube with the Docker driver and sufficient resources:

```bash
# Start with explicit driver and memory allocation
minikube start --driver=docker --memory=4096
```

If you encounter API server issues or other errors, a complete reset often resolves them:

```bash
# Complete reset of Minikube
minikube delete
minikube start --driver=docker --memory=4096
```

Verify Minikube is running properly:

```bash
minikube status
```

## 2. Enable the Ingress Add-on

Enable the Nginx Ingress Controller:

```bash
minikube addons enable ingress
```

If you encounter validation errors like:
```
error: error validating "/etc/kubernetes/addons/storageclass.yaml": error validating data: failed to download openapi: Get "https://localhost:8443/openapi/v2?timeout=32s": dial tcp [::1]:8443: connect: connection refused
```

Try the following solutions:

- Complete reset of Minikube (as described in step 1)
- Try enabling the addon with validation disabled:
  ```bash
  kubectl apply --validate=false -f /etc/kubernetes/addons/ingress.yaml
  ```
- Restart the Minikube API server:
  ```bash
  minikube stop
  minikube start
  ```

## 3. Setting Up Secrets

The application requires multiple secrets to function properly.

### 3.1 Auth0 Secrets

```bash
# Set Auth0 environment variables (if not already in your .env file)
export AUTH0_DOMAIN="your-auth0-domain"
export AUTH0_CLIENT_ID="your-auth0-client-id"
export AUTH0_CLIENT_SECRET="your-auth0-client-secret"
export AUTH0_CALLBACK_URL="http://rag-widget.local/api/auth/callback"
export AUTH0_AUDIENCE="your-auth0-audience"
export AUTH0_SECRET="your-auth0-secret"

# Run the setup script
bash scripts/setup-auth0-secrets.sh
```

### 3.2 GCP Secrets (for video processing)

```bash
# Run the script to prepare GCP secrets
bash scripts/prepare-gcp-secret.sh

# Apply the generated GCP secrets
kubectl apply -f kubernetes/gcp-secrets-with-key.yml
```

### 3.3 API Keys Secret

```bash
# Set up API keys (primarily YouTube API key)
bash scripts/setup-api-keys.sh
```

### 3.4 Chat Copilot Secret

Modify the chat-copilot-secret.yml file with your actual secrets:

```bash
# Edit the file with your secrets
# nano kubernetes/chat-copilot-secret.yml

# Apply the secret
# kubectl apply -f kubernetes/chat-copilot-secret.yml
```

## 4. Building Docker Images for Minikube

### 4.1 Connect to Minikube's Docker Environment

```bash
# This ensures images are built within Minikube's context
eval $(minikube -p minikube docker-env)
```

### 4.2 Build All Images

```bash
# Build all images with the provided script
bash scripts/build-minikube-images.sh
```

If you need to build images individually:

```bash
# Build api-service image (consolidated service)
docker build -t rag-widget-api-service:latest \
  --build-arg PORT=3001 \
  --build-arg APP_TYPE=api-service \
  -f Dockerfile .

# Build postgres image
docker build -t rag-widget-postgres:latest -f database/Dockerfile database

# Build frontend image (if you have the frontend repository)
docker build -t rag-widget-frontend:latest -f /home/rgann/test-landing-page/Dockerfile /home/rgann/test-landing-page

# Build chat-copilot-webapi image (if you have the repository)
docker build -t chat-copilot-webapi:latest -f /home/rgann/chat-copilot/docker/webapi/Dockerfile /home/rgann/chat-copilot
```

### 4.3 Verify Images

```bash
# Check that all images were built successfully
docker images | grep -E 'rag-widget|chat-copilot'
```

## 5. Deploying to Kubernetes

### 5.1 Deploy Components in Order

```bash
# Deploy PostgreSQL database first
kubectl apply -f kubernetes/postgres.yml

# Wait for PostgreSQL to be running before continuing
kubectl wait --for=condition=Ready pod -l app=postgres --timeout=120s

# Deploy API service
kubectl apply -f kubernetes/api-service.yml

# Deploy Qdrant vector database
kubectl apply -f kubernetes/qdrant.yml

# Deploy Frontend
kubectl apply -f kubernetes/frontend.yml

# Deploy Chat Copilot WebAPI
kubectl apply -f kubernetes/chat-copilot-webapi.yml

# Finally, deploy the Ingress controller
kubectl apply -f kubernetes/ingress.yml
```

### 5.2 Check Deployment Status

```bash
# Check pod status
kubectl get pods

# Check services
kubectl get services

# Check ingress configuration
kubectl get ingress
```

All pods should show "Running" status after a few minutes:

```
NAME                              READY   STATUS    RESTARTS   AGE
api-service-xxxxxxxx-xxxxx        1/1     Running   0          2m
frontend-xxxxxxxx-xxxxx           1/1     Running   0          2m
postgres-xxxxxxxx-xxxxx           1/1     Running   0          2m
chat-copilot-webapi-xxxxx-xxxxx   1/1     Running   0          2m
qdrant-xxxxxxxx-xxxxx             1/1     Running   0          2m
```

## 6. Accessing the Application

### 6.1 Set Up Local DNS (Recommended)

```bash
# Get the Minikube IP
minikube ip

# Add to your hosts file (requires sudo/admin privileges)
sudo sh -c "echo '$(minikube ip) rag-widget.local' >> /etc/hosts"
```

### 6.2 Access the Application

With hosts entry:
- Main Application: http://rag-widget.local/
- API Service: http://rag-widget.local/api
- Chat Service: http://rag-widget.local/chat

With Minikube IP directly:
- Main Application: http://<minikube-ip>/
- API Service: http://<minikube-ip>/api
- Chat Service: http://<minikube-ip>/chat

### 6.3 Alternative: Port Forwarding

If you're having trouble with Ingress, use port forwarding:

```bash
# For API service
kubectl port-forward service/api-service 3001:3001

# For frontend
kubectl port-forward service/frontend 3003:3003

# For chat-copilot-webapi
kubectl port-forward service/chat-copilot-webapi 3080:3080

# For qdrant
kubectl port-forward service/qdrant 6333:6333
```

Then access:
- Frontend: http://127.0.0.1:3003
- API Service: http://127.0.0.1:3001
- Chat Service: http://127.0.0.1:3080

## 7. Troubleshooting

### 7.1 Image Pull Errors

If pods show "ErrImageNeverPull" or "ImagePullBackOff":

```bash
# Verify you're connected to Minikube's Docker
eval $(minikube -p minikube docker-env)

# Check if images exist
docker images | grep -E 'rag-widget|chat-copilot'

# Check pod events for specific error
kubectl describe pod <pod-name>
```

Key points:
- Ensure image names match between build script and Kubernetes manifests
- Confirm `imagePullPolicy: Never` is set in all deployments
- Rebuild images if necessary

### 7.2 Pod Startup Issues

```bash
# View detailed pod status
kubectl describe pod <pod-name>

# Check logs for errors
kubectl logs <pod-name>

# Check events across the cluster
kubectl get events --sort-by='.lastTimestamp'
```

### 7.3 Networking Issues

If services are not accessible:

```bash
# Verify ingress controller is running
kubectl get pods -n ingress-nginx

# Check ingress configuration
kubectl describe ingress rag-widget-ingress

# For direct service access, try running a minikube tunnel
minikube tunnel
```

### 7.4 Database Connection Issues

If the API service can't connect to PostgreSQL:

```bash
# Check if PostgreSQL is running
kubectl get pods -l app=postgres

# View PostgreSQL logs
kubectl logs $(kubectl get pods -l app=postgres -o name)

# Force a restart of the API service
kubectl rollout restart deployment api-service
```

## 8. Cleaning Up

```bash
# Delete all deployed resources
kubectl delete -f kubernetes/ingress.yml
kubectl delete -f kubernetes/chat-copilot-webapi.yml
kubectl delete -f kubernetes/frontend.yml
kubectl delete -f kubernetes/qdrant.yml
kubectl delete -f kubernetes/api-service.yml
kubectl delete -f kubernetes/postgres.yml

# Delete secrets
kubectl delete -f kubernetes/chat-copilot-secret.yml
kubectl delete -f kubernetes/gcp-secrets-with-key.yml
kubectl delete -f kubernetes/auth0-secrets-applied.yml

# Stop Minikube
minikube stop

# To completely delete the Minikube cluster
minikube delete
```

## 9. Known Issues and Solutions

### 9.1 Auth0 Callback URL Issues

If you encounter authentication problems:
- Ensure Auth0 callback URL matches your ingress setup (e.g., `http://rag-widget.local/api/auth/callback`)
- For local development, you may need to update Auth0 allowed callback URLs

### 9.2 Chat Copilot Authentication

The chat-copilot-webapi service may have authentication issues:
- Check that `Authentication__Type=None` is set in the environment
- Verify that API keys are properly configured in the chat-copilot-secret

### 9.3 Ingress Controller Problems

If the ingress controller fails to start:
- Try a different Minikube version
- Use `--driver=docker` explicitly when starting Minikube
- As a last resort, skip ingress and use port forwarding instead

### 10 Troubleshooting commands
- `kubectl describe pod api-service`
- `kubectl get secrets`
- `kubectl get all`
- `kubectl delete deployment -all`
- `kubectl delete service --all --ignore-not-found=true`
- `kubectl delete pod --all --force --grace-period=0`
- `minikube delete`
- `kubectl get services`
- `kubectl get ingress`
- `minikube ip`