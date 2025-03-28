# Kubernetes Deployment for RAG Widget

This directory contains Kubernetes configuration files for deploying the RAG Widget application.

## Components

The application consists of the following components:

1. **postgres.yml** - PostgreSQL database
2. **api-service.yml** - Consolidated API service (handles both authentication and admin portal functionality)
3. **frontend.yml** - Public landing page
4. **gcp-secrets.yml** - GCP authentication configuration

## GCP Authentication

The application uses GCP services like Pub/Sub for video processing. See [GCP-AUTH-README.md](./GCP-AUTH-README.md) for detailed instructions on setting up GCP authentication.

## Deployment Instructions

### 1. Create Kubernetes Secrets

Before deploying the application components, you need to set up the required secrets:

```bash
# Set up GCP credentials
./scripts/prepare-gcp-secret.sh
kubectl apply -f kubernetes/gcp-secrets-with-key.yml
```

### 2. Deploy Components

```bash
kubectl apply -f kubernetes/postgres.yml
kubectl apply -f kubernetes/api-service.yml
kubectl apply -f kubernetes/frontend.yml
```

### 3. Access the Application

Once deployed, you can access the components:

```bash
# Get the service URLs
kubectl get services
```

## Configuration

The application is configured using environment variables defined in the Kubernetes YAML files. Review and update these as needed for your specific deployment environment.