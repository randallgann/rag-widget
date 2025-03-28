# Kubernetes Deployment Guide

## Current Setup

As of March 21, 2025, our Kubernetes deployment in Minikube consists of:

- **Running Pods**:
  - `api-service-57f8694948-xq6zj` (Status: Running)
  - `frontend-7584dc57bc-bffsx` (Status: Running)
  - `postgres-5748b759b6-q5mlb` (Status: Running)

- **Services**:
  - `api-service` - LoadBalancer - ClusterIP: 10.97.157.156 - NodePort: 32740
  - `frontend` - LoadBalancer - ClusterIP: 10.110.144.87 - NodePort: 31169
  - `postgres` - ClusterIP - ClusterIP: 10.98.211.254

## Issues to Address

1. **Port Mismatch in Frontend Service**: 
   - The logs from the frontend pod show it's running on port 3001
   - The service is configured to target port 3003
   - This port mismatch prevents successful connection to the frontend service

2. **Database Connection Delays**: 
   - Both admin-portal and auth-server logs show initial database connection failures
   - They eventually connect successfully after multiple retries
   - Need to implement proper connection handling or startup sequencing

3. **Auth0 Configuration**: 
   - Auth0 service is initialized with placeholder domain: "your-auth0-domain"
   - Actual domain values need to be properly set in Kubernetes secrets
   - Auth0 proper configuration is critical for authentication functionality

## Deployment Steps

1. Build images within Minikube:
```bash
./build-minikube-images.sh
```

2. Set up Auth0 secrets:

There are several ways to provide Auth0 credentials:

**Option A: Directly in the shell (Development)**
```bash
# Set environment variables directly
export AUTH0_DOMAIN=your-auth0-domain.auth0.com
export AUTH0_CLIENT_ID=your-client-id
export AUTH0_CLIENT_SECRET=your-client-secret
export AUTH0_CALLBACK_URL=http://localhost:3001/callback
export AUTH0_AUDIENCE=your-audience
export AUTH0_SECRET=your-session-secret

# Run the setup script
./scripts/setup-auth0-secrets.sh
```

**Auth0 Callback URL Configuration:**

The Auth0 callback URL is critical for proper authentication. Set it based on your environment:

1. **Development (Minikube with port-forwarding)**:
   ```
   http://localhost:3001/callback
   ```
   
   This works when you're using port-forwarding to access your auth-server service locally.

2. **Production with Domain Name**:
   ```
   https://auth.yourdomain.com/callback
   ```
   
   Use your actual domain if you've set up DNS for your Kubernetes services.

3. **Production with Load Balancer IP**:
   ```
   http://<load-balancer-ip>:3001/callback
   ```
   
   Use your actual load balancer IP if you don't have a domain.

**Important Auth0 Setup Notes:**
- Add all your callback URLs to the "Allowed Callback URLs" list in your Auth0 application settings
- Add all your application URLs to "Allowed Web Origins" for CORS support
- Add all your logout URLs to "Allowed Logout URLs"
- The same URL must be configured in both Auth0 dashboard and your Kubernetes secrets
- For production, use HTTPS URLs with valid certificates

**Option B: Using an environment file (Recommended for production)**
```bash
# Create a secure .env file with your Auth0 credentials
# Then run:
./scripts/setup-auth0-secrets.sh --env-file /path/to/auth0.env
```

**Option C: Using GCP Secret Manager (Production)**
```bash
# Ensure Auth0 secrets are stored in GCP Secret Manager
# Then run:
./scripts/setup-auth0-secrets.sh --gcp-secrets
```

For help and more options:
```bash
./scripts/setup-auth0-secrets.sh --help
```

3. Set up API Keys Secret:
```bash
# Set your YouTube API key
export YOUTUBE_API_KEY=your-youtube-api-key

# Create and apply the API keys secret
./scripts/setup-api-keys.sh
```

4. Apply Kubernetes resources:
```bash
kubectl apply -f kubernetes/postgres.yml
kubectl apply -f kubernetes/api-service.yml
kubectl apply -f kubernetes/frontend.yml
```

5. Port forwarding for accessing services:
```bash
# For API service
kubectl port-forward service/api-service 3001:3001

# For frontend/landing page
kubectl port-forward service/frontend 3003:3003
```

## Access URLs
- API Service: http://localhost:3001
- Landing Page: http://localhost:3003

## Applying Changes to Existing Cluster

If you've made changes to your Kubernetes configuration files, you don't need to restart your Minikube cluster. Instead, follow these steps to apply the changes to your running cluster:

1. Apply the updated configurations:
```bash
kubectl apply -f kubernetes/postgres.yml
kubectl apply -f kubernetes/api-service.yml
kubectl apply -f kubernetes/frontend.yml
```

Kubernetes will detect the differences between the current state and the desired state in the updated YAML files and will perform a rolling update of the affected resources.

2. (Optional) Force an immediate redeployment:
```bash
kubectl rollout restart deployment/api-service
kubectl rollout restart deployment/frontend
kubectl rollout restart deployment/postgres
```

3. Check the status of your deployments:
```bash
kubectl get pods
kubectl get services
```

4. View logs of a specific pod for troubleshooting:
```bash
# Replace POD_NAME with the actual pod name from kubectl get pods
kubectl logs POD_NAME
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Port Mismatch
If services cannot connect to each other, verify the ports are correctly configured in both the deployment (containerPort) and service (port, targetPort).

**Solution**: Ensure containerPort matches the port your application listens on, and service targetPort matches containerPort.

#### 2. Database Connection Issues
If services cannot connect to the database despite the init containers:

**Solution**:
- Check that postgres service is running: `kubectl get svc postgres`
- Verify database credentials in secrets: `kubectl get secret postgres-secret -o yaml`
- Test database connection from a pod: 
  ```bash
  kubectl exec -it <pod-name> -- psql -h postgres -U postgres -d youtube_rag
  ```

#### 3. Auth0 Configuration Issues
If authentication is not working properly:

**Solution**:
- Verify Auth0 secrets are correctly set: `kubectl get secret auth0-secret -o yaml`
- Check that the application is using the right callback URLs
- Ensure Auth0 domain is accessible from your cluster

#### 4. Service Discovery Issues
If services cannot find each other by name:

**Solution**:
- Services in the same namespace should be able to resolve each other by name
- Check DNS resolution within a pod:
  ```bash
  kubectl exec -it <pod-name> -- nslookup auth-server
  ```

#### 5. Image Pull Errors
If pods can't start because they can't pull the images:

**Solution**:
- For Minikube, ensure images are built within the Minikube environment:
  ```bash
  eval $(minikube docker-env)
  ./build-minikube-images.sh
  ```
- Verify `imagePullPolicy: Never` is set for local images

#### 6. minikube urls
For specific services mentioned in the docs:
- minikube service api-service --url
- minikube service frontend --url

#### 7. Then update the deployment
- kubectl rollout restart deployment frontend