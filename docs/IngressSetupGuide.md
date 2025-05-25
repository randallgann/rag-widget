# Ingress Controller Setup Guide

This guide provides instructions for setting up an Ingress controller for the RAG Widget application in Minikube and Kubernetes environments.

## Prerequisites

- Minikube or Kubernetes cluster running
- kubectl installed and configured
- All application services deployed (api-service, frontend, postgres, chat-copilot-webapi)

## Minikube Ingress Controller Setup

1. **Enable the Ingress addon in Minikube**:

```bash
minikube addons enable ingress
```

2. **Verify the Ingress controller is running**:

```bash
kubectl get pods -n ingress-nginx
```

You should see the Nginx controller pod running.

3. **Apply the Ingress configuration**:

```bash
kubectl apply -f kubernetes/ingress.yml
```

4. **Add a local hosts entry for development** (Optional if using minikube IP directly):

First, get the Minikube IP:

```bash
minikube ip
```

Then add an entry to your `/etc/hosts` file (requires sudo access):

```bash
sudo sh -c "echo '$(minikube ip) rag-widget.local' >> /etc/hosts"
```

### Special Instructions for WSL (Windows Subsystem for Linux)

**IMPORTANT**: If you're running Minikube on WSL, direct access to the Minikube IP address will not work due to WSL's network isolation. You must use `minikube tunnel`:

```bash
# In a separate terminal, run (requires sudo):
sudo minikube tunnel

# Keep this running while accessing the application
```

Then add the following to your `/etc/hosts` file:
```bash
echo "127.0.0.1 rag-widget.local" | sudo tee -a /etc/hosts
```

Now you can access the application at http://rag-widget.local

## Accessing the Application

Once the Ingress controller is set up, you can access the application at:

- Frontend UI: http://rag-widget.local/
- API Service: http://rag-widget.local/api
- Chat Copilot WebAPI: http://rag-widget.local/chat

## Kubernetes Cluster Setup (non-Minikube)

For non-Minikube Kubernetes clusters (like GKE, EKS, etc.), you'll need to install an Ingress controller:

1. **Install NGINX Ingress Controller**:

```bash
# For Helm users
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm install nginx-ingress ingress-nginx/ingress-nginx

# Alternatively, using kubectl
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.0/deploy/static/provider/cloud/deploy.yaml
```

2. **Apply the Ingress configuration**:

```bash
kubectl apply -f kubernetes/ingress.yml
```

3. **Get the external IP or hostname**:

```bash
kubectl get ingress rag-widget-ingress
```

## TLS/HTTPS Configuration

To enable HTTPS:

1. **Create a TLS secret** (use your own cert and key or LetsEncrypt):

```bash
kubectl create secret tls rag-widget-tls-secret --key /path/to/tls.key --cert /path/to/tls.crt
```

2. **Update the Ingress configuration** by uncommenting the TLS section in `kubernetes/ingress.yml`:

```yaml
tls:
- hosts:
  - rag-widget.local
  secretName: rag-widget-tls-secret
```

3. **Apply the updated Ingress configuration**:

```bash
kubectl apply -f kubernetes/ingress.yml
```

## Troubleshooting

### Ingress Not Working

1. Check that the Ingress resource is created:

```bash
kubectl get ingress
kubectl describe ingress rag-widget-ingress
```

2. Verify the Ingress controller is running:

```bash
kubectl get pods -n ingress-nginx
```

3. Check Ingress controller logs:

```bash
kubectl logs -n ingress-nginx $(kubectl get pods -n ingress-nginx -o jsonpath='{.items[0].metadata.name}')
```

### Service Connectivity Issues

If the Ingress controller can't connect to your services:

1. Verify services are running and have correct endpoints:

```bash
kubectl get services
kubectl get endpoints
```

2. Test service connectivity from within the cluster:

```bash
kubectl run curl --image=curlimages/curl -i --rm --restart=Never -- curl http://frontend:3003
kubectl run curl --image=curlimages/curl -i --rm --restart=Never -- curl http://api-service:3001
kubectl run curl --image=curlimages/curl -i --rm --restart=Never -- curl http://chat-copilot-webapi:3080
```

## Additional Configuration Options

### Rate Limiting

Add these annotations to the Ingress resource:

```yaml
nginx.ingress.kubernetes.io/limit-rps: "10"
nginx.ingress.kubernetes.io/limit-connections: "5"
```

### CORS Configuration

For Cross-Origin Resource Sharing:

```yaml
nginx.ingress.kubernetes.io/enable-cors: "true"
nginx.ingress.kubernetes.io/cors-allow-methods: "GET, PUT, POST, DELETE, PATCH, OPTIONS"
nginx.ingress.kubernetes.io/cors-allow-origin: "*"
```

### Session Affinity

For sticky sessions:

```yaml
nginx.ingress.kubernetes.io/affinity: "cookie"
nginx.ingress.kubernetes.io/session-cookie-name: "route"
nginx.ingress.kubernetes.io/session-cookie-max-age: "172800"
```