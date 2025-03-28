  Step 1: Set up Auth0 Secrets

  1. Set Auth0 Environment Variables (if not already done)
  # Option 1: Use the set-auth0-env.sh script
  source ./scripts/set-local-env.sh

  # Option 2: Use your own environment file
  # Create a .env.auth0 file with the required variables
  2. Create and Apply Auth0 Secrets to Kubernetes
  # If you used set-auth0-env.sh
  ./scripts/setup-auth0-secrets.sh

  # If you have your own env file
  ./scripts/setup-auth0-secrets.sh --env-file .env.auth0

  # Or use GCP Secret Manager (if set up)
  ./scripts/setup-auth0-secrets.sh --gcp-secrets

  Step 2: Set up GCP Secrets (if needed for GCP services)

  ./scripts/prepare-gcp-secret.sh

  # Run Setup API Keys script
  ./scripts/setup-api-keys.sh

  Step 3: Build Docker Images for Minikube

  # Start Minikube if not already running
  minikube start

  # Connect to Minikube's Docker daemon and build images
  ./scripts/build-minikube-images.sh

  Step 4: Deploy to Kubernetes

  # Apply Configs
  kubectl apply -f kubernetes/gcp-secrets-with-key.yml
  kubectl apply -f kubernetes/auth0-secrets-applied.yml

  # Apply Kubernetes manifests
  kubectl apply -f kubernetes/postgres.yml
  kubectl apply -f kubernetes/api-service.yml
  kubectl apply -f kubernetes/frontend.yml

  Step 5: Access the Services

  # Option 1: Port forwarding
  kubectl port-forward service/api-service 3001:3001
  kubectl port-forward service/frontend 3003:3003

  # Option 2: Get Minikube URLs
  minikube service api-service --url
  minikube service frontend --url

  Optional: Seed Database (if needed)

  # If you need to seed the database with initial data
  # Note: We couldn't see the content of seed.js, but this would be the place to run it
  npm run build
  node scripts/seed.js

  Additional Notes:

  1. The build.js file appears to be empty, and the actual build process is defined in the npm scripts, so use npm run build instead.
  2. Always ensure Minikube is running before executing the build-minikube-images.sh script.
  3. The set-auth0-env.sh script seems to contain actual Auth0 credentials, which is not a good security practice. Consider replacing these with placeholder values before committing
  to version control.
  4. After applying gcp-secrets-with-key.yml, consider deleting it as it contains sensitive information.

  Following this sequence will ensure that all the necessary components are set up correctly for local Kubernetes development.

  # Delete Existing Pods and Images
        # Delete all pods
      kubectl delete pods --all

      # Delete all deployments
      kubectl delete deployments --all

      # Delete all services (except kubernetes service)
      kubectl get services | grep -v 'kubernetes' | awk '{print $1}' | xargs kubectl delete service

      # Verify all resources are deleted
      kubectl get all

    eval $(minikube docker-env)
    docker images -f "dangling=true" -q | xargs docker rmi
    docker rmi rag-widget-postgres:latest

    kubectl describe pod api-service-8445c4dd5d-7xjhq
    kubectl logs api-service-8445c4dd5d-7xjhq -c check-db-ready

    kubectl get pods -w