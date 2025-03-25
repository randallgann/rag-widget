# GKE Deployment Guide

This document outlines the necessary steps to deploy our application to Google Kubernetes Engine (GKE) Autopilot.

## Deployment Roadmap

### 1. Container Registry Setup
- [ ] Set up Google Container Registry (GCR) or Artifact Registry
- [ ] Authenticate with Google Cloud:
  ```bash
  # Install Google Cloud CLI if not already installed
  # https://cloud.google.com/sdk/docs/install
  
  # Login to Google Cloud
  gcloud auth login
  
  # Configure Docker to use gcloud credentials
  gcloud auth configure-docker
  
  # For Artifact Registry, use region-specific authentication
  gcloud auth configure-docker us-docker.pkg.dev
  ```
- [ ] Create Artifact Registry repository (if not using GCR):
  ```bash
  gcloud artifacts repositories create rag-widget \
    --repository-format=docker \
    --location=us \
    --description="Docker repository for RAG Widget"
  ```
- [ ] Build and tag images for each component:
  ```bash
  # For Artifact Registry (recommended)
  # Auth server
  docker build -t us-docker.pkg.dev/rag-widget/rag-widget/auth-server:latest .
  
  # Admin portal
  docker build -t us-docker.pkg.dev/rag-widget/rag-widget/admin-portal:latest .
  
  # Frontend
  docker build -t us-docker.pkg.dev/rag-widget/rag-widget/frontend:latest /path/to/frontend
  
  # PostgreSQL with pgvector
  docker build -t us-docker.pkg.dev/rag-widget/rag-widget/postgres:latest ./database
  
  # Or for GCR
  # Auth server
  docker build -t gcr.io/rag-widget/auth-server:latest .
  
  # Admin portal
  docker build -t gcr.io/rag-widget/admin-portal:latest .
  
  # Frontend
  docker build -t gcr.io/rag-widget/frontend:latest /path/to/frontend
  
  # PostgreSQL with pgvector
  docker build -t gcr.io/rag-widget/postgres:latest ./database
  ```
- [ ] Push images:
  ```bash
  # For Artifact Registry
  docker push us-docker.pkg.dev/rag-widget/rag-widget/auth-server:latest
  docker push us-docker.pkg.dev/rag-widget/rag-widget/admin-portal:latest
  docker push us-docker.pkg.dev/rag-widget/rag-widget/frontend:latest
  docker push us-docker.pkg.dev/rag-widget/rag-widget/postgres:latest
  
  # Or for GCR
  docker push gcr.io/rag-widget/auth-server:latest
  docker push gcr.io/rag-widget/admin-portal:latest
  docker push gcr.io/rag-widget/frontend:latest
  docker push gcr.io/rag-widget/postgres:latest
  ```
- [ ] Update Kubernetes manifests with correct image paths

### 2. Environment Configuration
- [ ] Create actual base64-encoded secrets for Auth0:
  ```bash
  echo -n 'your-auth0-domain' | base64
  echo -n 'your-auth0-client-id' | base64
  # Repeat for each required secret
  ```
- [ ] Update URL configurations to match GKE environment:
  - [ ] Set FRONTEND_URL to frontend service URL or domain
  - [ ] Set AUTH_SERVER_URL to auth-server service URL or domain
  - [ ] Set ADMIN_PORTAL_URL to admin-portal service URL or domain

### 3. Resource Requirements
- [ ] Add CPU/memory requests and limits to all deployments:
  ```yaml
  resources:
    requests:
      cpu: "100m"
      memory: "256Mi"
    limits:
      cpu: "500m"
      memory: "512Mi"
  ```

### 4. Health Checks
- [ ] Add readiness and liveness probes to all deployments:
  ```yaml
  livenessProbe:
    httpGet:
      path: /health
      port: [container-port]
    initialDelaySeconds: 30
    periodSeconds: 10
  readinessProbe:
    httpGet:
      path: /health
      port: [container-port]
    initialDelaySeconds: 5
    periodSeconds: 10
  ```
- [ ] Implement health check endpoints in each service if not already available

### 5. Network Configuration
- [ ] Reserve static IP addresses:
  ```bash
  # Create a global static IP for the main application
  gcloud compute addresses create rag-widget-ip --global
  
  # Get the assigned IP address
  gcloud compute addresses describe rag-widget-ip --global --format="value(address)"
  ```

- [ ] Set up DNS records:
  ```bash
  # After getting the IP, update your DNS provider with:
  # app.yourdomain.com -> [your-static-ip]
  ```

- [ ] Set up an Ingress controller:
  ```yaml
  apiVersion: networking.k8s.io/v1
  kind: Ingress
  metadata:
    name: app-ingress
    annotations:
      kubernetes.io/ingress.class: "gce"
      kubernetes.io/ingress.global-static-ip-name: "rag-widget-ip"
      networking.gke.io/managed-certificates: "app-certificate"
      kubernetes.io/ingress.allow-http: "false"  # Force HTTPS
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
        - path: /api
          pathType: Prefix
          backend:
            service:
              name: auth-server
              port:
                number: 80
        - path: /admin
          pathType: Prefix
          backend:
            service:
              name: admin-portal
              port:
                number: 80
  ```

- [ ] Update Service types:
  ```yaml
  # Change all frontend-facing services from LoadBalancer to ClusterIP
  # Example for auth-server:
  apiVersion: v1
  kind: Service
  metadata:
    name: auth-server
  spec:
    type: ClusterIP  # Changed from LoadBalancer
    selector:
      app: auth-server
    ports:
    - port: 80
      targetPort: 3001
  ```

- [ ] Set up HTTPS with managed certificates:
  ```bash
  kubectl apply -f - <<EOF
  apiVersion: networking.gke.io/v1
  kind: ManagedCertificate
  metadata:
    name: app-certificate
  spec:
    domains:
    - app.yourdomain.com
  EOF
  ```

- [ ] Configure Auth0 callback URLs:
  ```bash
  # Don't forget to update your Auth0 configuration with new URLs:
  # - Allowed Callback URLs: https://app.yourdomain.com/api/auth/callback
  # - Allowed Logout URLs: https://app.yourdomain.com
  # - Allowed Web Origins: https://app.yourdomain.com
  ```

### 6. Storage Configuration
- [ ] Specify appropriate storage class for PostgreSQL PVC:
  ```yaml
  apiVersion: v1
  kind: PersistentVolumeClaim
  metadata:
    name: postgres-data
  spec:
    accessModes:
      - ReadWriteOnce
    storageClassName: standard-rwo
    resources:
      requests:
        storage: 10Gi
  ```

### 7. Database Considerations
- [ ] Option 1: Enhance self-managed PostgreSQL with pgvector
  - [ ] Add proper backup strategy:
    ```yaml
    # Add a CronJob to backup Postgres data
    apiVersion: batch/v1
    kind: CronJob
    metadata:
      name: postgres-backup
    spec:
      schedule: "0 1 * * *"  # Daily at 1:00 AM
      jobTemplate:
        spec:
          template:
            spec:
              containers:
              - name: postgres-backup
                image: us-docker.pkg.dev/rag-widget/rag-widget/postgres:latest
                command:
                - /bin/sh
                - -c
                - |
                  pg_dump -h postgres -U postgres -d youtube_rag | gzip > /backups/youtube_rag-$(date +%Y%m%d).sql.gz
                  gsutil cp /backups/youtube_rag-$(date +%Y%m%d).sql.gz gs://rag-widget-backups/
                env:
                - name: PGPASSWORD
                  valueFrom:
                    secretKeyRef:
                      name: postgres-secret
                      key: POSTGRES_PASSWORD
                volumeMounts:
                - name: backup-volume
                  mountPath: /backups
              volumes:
              - name: backup-volume
                emptyDir: {}
              restartPolicy: OnFailure
    ```
  - [ ] Configure high availability with StatefulSet:
    ```yaml
    apiVersion: apps/v1
    kind: StatefulSet
    metadata:
      name: postgres
    spec:
      serviceName: "postgres"
      replicas: 1  # Consider increasing to 2+ for HA
      selector:
        matchLabels:
          app: postgres
      template:
        metadata:
          labels:
            app: postgres
        spec:
          terminationGracePeriodSeconds: 60
          containers:
          - name: postgres
            image: us-docker.pkg.dev/rag-widget/rag-widget/postgres:latest
            # Rest of the configuration...
    ```
  
- [ ] Option 2 (Recommended): Migrate to Cloud SQL
  - [ ] Create Cloud SQL PostgreSQL instance with pgvector support:
    ```bash
    # Create the Cloud SQL instance
    gcloud sql instances create youtube-rag \
      --database-version=POSTGRES_15 \
      --tier=db-g1-small \
      --region=us-central1 \
      --root-password=<secure-password> \
      --storage-type=SSD \
      --storage-size=10GB \
      --availability-type=REGIONAL
      
    # Create the database
    gcloud sql databases create youtube_rag --instance=youtube-rag
    
    # Note: You'll need to manually install pgvector extension in Cloud SQL
    # using SQL commands through Cloud Console or Cloud SQL Auth Proxy
    ```
  - [ ] Migrate database schema and data:
    ```bash
    # Export data from existing Postgres
    pg_dump -h localhost -U postgres -d youtube_rag > youtube_rag_backup.sql
    
    # Import to Cloud SQL (using Cloud SQL Auth Proxy)
    gcloud sql connect youtube-rag --user=postgres < youtube_rag_backup.sql
    ```
  - [ ] Update connection strings in Kubernetes manifests
  - [ ] Set up Cloud SQL proxy sidecar:
    ```yaml
    - name: cloud-sql-proxy
      image: gcr.io/cloudsql-docker/gce-proxy:1.28.0
      command:
        - "/cloud_sql_proxy"
        - "-instances=[INSTANCE_CONNECTION_NAME]=tcp:5432"
      securityContext:
        runAsNonRoot: true
      resources:
        requests:
          memory: "256Mi"
          cpu: "100m"
    ```
  - [ ] Install pgvector extension in Cloud SQL:
    ```sql
    -- Connect to Cloud SQL instance and run:
    CREATE EXTENSION IF NOT EXISTS vector;
    ```

### 8. Secret Management
- [ ] Create secrets in Google Secret Manager:
  ```bash
  echo -n "your-secret-value" | \
  gcloud secrets create auth0-domain --data-file=-
  
  # Repeat for all secrets
  ```
- [ ] Update Kubernetes manifests to use Secret Manager:
  ```yaml
  apiVersion: kubernetes-client.io/v1
  kind: ExternalSecret
  metadata:
    name: auth0-credentials
  spec:
    backendType: gcpSecretsManager
    projectId: your-gcp-project
    data:
      - key: auth0-domain
        name: AUTH0_DOMAIN
      # Add other secrets similarly
  ```

### 9. CI/CD Setup
- [ ] Set up Cloud Build or other CI/CD pipeline
- [ ] Create build triggers for automatic deployments
- [ ] Configure deployment validation and rollback strategies

### 10. Monitoring and Logging
- [ ] Set up Cloud Monitoring
- [ ] Configure custom dashboards for key metrics
- [ ] Set up alerting for critical issues
- [ ] Ensure proper log collection with Cloud Logging

## Post-Deployment Checklist
- [ ] Verify all services are running correctly
- [ ] Test authentication flow end-to-end
- [ ] Verify database connectivity and persistence
- [ ] Test public endpoints and API accessibility
- [ ] Monitor resource utilization and adjust limits if needed

## References
- [GKE Autopilot Documentation](https://cloud.google.com/kubernetes-engine/docs/concepts/autopilot-overview)
- [Cloud SQL for PostgreSQL](https://cloud.google.com/sql/docs/postgres)
- [Secret Manager](https://cloud.google.com/secret-manager)
- [GKE Ingress](https://cloud.google.com/kubernetes-engine/docs/concepts/ingress)