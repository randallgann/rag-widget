# Minikube Deployment Guide

This guide provides step-by-step instructions for deploying the RAG Widget application on Minikube for local development and testing.

## Prerequisites

- [Minikube](https://minikube.sigs.k8s.io/docs/start/) installed
- [kubectl](https://kubernetes.io/docs/tasks/tools/) installed
- [Docker](https://docs.docker.com/get-docker/) installed
- Access to the project repository

## Starting Minikube

Start Minikube with the Docker driver:

```bash
minikube start
```

If you encounter API server issues or other errors, a complete reset often resolves them:

```bash
minikube delete && minikube start
```

Verify Minikube is running properly:

```bash
minikube status
```

## Setting Up Secrets

The application requires both GCP and Auth0 secrets to function properly.

### 1. Set up GCP Secrets

```bash
cd /home/rgann/rag-widget
bash scripts/prepare-gcp-secret.sh
kubectl apply -f kubernetes/gcp-secrets-with-key.yml
```

### 2. Set up Auth0 Secrets

```bash
cd /home/rgann/rag-widget
source scripts/set-auth0-env.sh
bash scripts/setup-auth0-secrets.sh
```

## Building Docker Images for Minikube

The application consists of several components that need to be built as Docker images inside Minikube's Docker environment:

1. First, connect to Minikube's Docker environment:

```bash
eval $(minikube -p minikube docker-env)
```

2. Build all images using the provided script (may take some time):

```bash
cd /home/rgann/rag-widget
bash scripts/build-minikube-images.sh
```

If the script is interrupted or fails, you can build the images individually:

```bash
# Switch to Minikube's Docker environment
eval $(minikube -p minikube docker-env)

# Build admin-portal image
cd /home/rgann/rag-widget
docker build -t rag-widget-admin-portal:latest \
  --build-arg PORT=3000 \
  --build-arg APP_TYPE=admin-portal \
  -f Dockerfile .

# Build auth-server image
docker build -t rag-widget-auth-server:latest \
  --build-arg PORT=3001 \
  --build-arg APP_TYPE=auth-server \
  -f Dockerfile .

# Build postgres image
docker build -t rag-widget-postgres:latest -f database/Dockerfile database

# Build frontend image (if you have the frontend repository)
docker build -t rag-widget-frontend:latest -f /home/rgann/test-landing-page/Dockerfile /home/rgann/test-landing-page
```

3. Verify that the images were successfully built:

```bash
docker images | grep rag-widget
```

## Deploying to Kubernetes

Apply the Kubernetes manifests for each component:

```bash
kubectl apply -f kubernetes/postgres.yml
kubectl apply -f kubernetes/auth-server.yml
kubectl apply -f kubernetes/admin-portal.yml
kubectl apply -f kubernetes/frontend.yml
```

Check that all pods are running:

```bash
kubectl get pods
```

You should see all pods with a "Running" status after a few minutes:

```
NAME                            READY   STATUS    RESTARTS   AGE
admin-portal-xxxxxxxx-xxxxx     1/1     Running   0          2m
auth-server-xxxxxxxx-xxxxx      1/1     Running   0          2m
frontend-xxxxxxxx-xxxxx         1/1     Running   0          2m
postgres-xxxxxxxx-xxxxx         1/1     Running   0          2m
```

## Accessing the Application

The services are configured as LoadBalancer type, which requires the Minikube tunnel feature to access from your local machine:

1. Start a Minikube tunnel in a separate terminal (this needs to keep running):

```bash
minikube tunnel
```

2. Verify that the services have received external IPs:

```bash
kubectl get services
```

You should see something like:

```
NAME           TYPE           CLUSTER-IP       EXTERNAL-IP   PORT(S)          AGE
admin-portal   LoadBalancer   10.98.22.251     127.0.0.1     3000:31253/TCP   10m
auth-server    LoadBalancer   10.99.167.2      127.0.0.1     3001:31951/TCP   10m
frontend       LoadBalancer   10.109.70.237    127.0.0.1     3003:32517/TCP   10m
kubernetes     ClusterIP      10.96.0.1        <none>        443/TCP          20m
postgres       ClusterIP      10.108.145.161   <none>        5432/TCP         10m
```

3. Access the application in your web browser:

- Frontend: http://127.0.0.1:3003
- Admin Portal: http://127.0.0.1:3000
- Auth Server: http://127.0.0.1:3001

## Troubleshooting

### Image Pull Errors

If pods show "ErrImageNeverPull" or "ImagePullBackOff" status, it means Kubernetes cannot find the required images. Common fixes:

1. Ensure you've built the images in Minikube's Docker environment:

```bash
eval $(minikube -p minikube docker-env)
docker images | grep rag-widget
```

2. Make sure the image names in the Kubernetes manifests match the built images

3. Verify that `imagePullPolicy: Never` is set in the Kubernetes manifests to use local images

### Pod Startup Issues

If pods are not starting properly:

1. Check detailed pod status:

```bash
kubectl describe pod <pod-name>
```

2. View pod logs:

```bash
kubectl logs <pod-name>
```

### Networking Issues

If you cannot access the services:

1. Ensure Minikube tunnel is running
2. Check service status:

```bash
kubectl get services
minikube service list
```

## Cleaning Up

To stop the application and clean up resources:

1. Stop the Minikube tunnel (Ctrl+C in the tunnel terminal)
2. Delete all resources:

```bash
kubectl delete -f kubernetes/frontend.yml
kubectl delete -f kubernetes/admin-portal.yml
kubectl delete -f kubernetes/auth-server.yml
kubectl delete -f kubernetes/postgres.yml
kubectl delete -f kubernetes/gcp-secrets-with-key.yml
kubectl delete -f kubernetes/auth0-secrets-applied.yml
```

3. Stop Minikube:

```bash
minikube stop
```

Or completely delete the Minikube cluster:

```bash
minikube delete
```