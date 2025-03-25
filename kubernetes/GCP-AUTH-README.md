# GCP Authentication with Kubernetes

This document explains how to set up GCP authentication for the RAG Widget application in a Kubernetes environment.

## Prerequisites

- Kubernetes cluster (GKE recommended for GCP services)
- kubectl configured to communicate with your cluster
- GCP Service Account Key file (`rag-widget-1b0f63fa8b77.json`)

## Setup Instructions

### 1. Create the GCP Secrets

The application uses a GCP service account key to authenticate with Google Cloud services like Pub/Sub. The key is securely stored as a Kubernetes Secret.

```bash
# Encode your GCP service account key file as base64
KEY_DATA=$(cat /path/to/rag-widget-1b0f63fa8b77.json | base64 -w 0)

# Edit the gcp-secrets.yml file and replace REPLACE_WITH_BASE64_ENCODED_SA_KEY with the output
# from the above command
```

Then apply the secret to your Kubernetes cluster:

```bash
kubectl apply -f kubernetes/gcp-secrets.yml
```

### 2. Deploy the Application

Deploy the application components with the GCP authentication configured:

```bash
kubectl apply -f kubernetes/postgres.yml
kubectl apply -f kubernetes/admin-portal.yml
kubectl apply -f kubernetes/auth-server.yml
kubectl apply -f kubernetes/landing-page.yml
```

## How it Works

1. The service account key JSON file is stored as a Kubernetes Secret
2. The secret is mounted as a file at `/var/secrets/google/gcp-sa-key.json` in the containers
3. The `GOOGLE_APPLICATION_CREDENTIALS` environment variable points to this file
4. When the application starts, the Google Cloud client libraries automatically use this file for authentication

## Configuration

You can modify the GCP configuration by editing the ConfigMap in `gcp-secrets.yml`:

- `GCP_PROJECT_ID`: Your Google Cloud project ID
- `GCP_PUBSUB_TOPIC`: The Pub/Sub topic for video processing
- `GCP_STORAGE_BUCKET`: GCS bucket for storing processed video data

## Security Considerations

- The service account key is stored as a Kubernetes Secret, which is encrypted at rest (when using etcd v3)
- The key file is mounted as read-only inside the containers
- Consider using GKE Workload Identity for production environments to avoid storing service account keys

## Troubleshooting

If you encounter authentication issues:

1. Check if the secret was created properly:
   ```bash
   kubectl get secret gcp-secrets
   ```

2. Verify the pod has the volume mounted:
   ```bash
   kubectl describe pod [pod-name]
   ```

3. Check for errors in the application logs:
   ```bash
   kubectl logs [pod-name]
   ```