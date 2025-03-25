#!/bin/bash

# Function to print usage information
print_usage() {
  echo "Usage: $0 [options]"
  echo "Options:"
  echo "  --env-file PATH   Path to environment file containing Auth0 variables"
  echo "  --gcp-secrets     Fetch secrets from GCP Secret Manager (requires GCP setup)"
  echo "  --help            Display this help message"
  echo
  echo "If no options are provided, the script will use environment variables already set in the shell."
}

# Parse command line arguments
ENV_FILE=""
USE_GCP_SECRETS=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    --gcp-secrets)
      USE_GCP_SECRETS=true
      shift
      ;;
    --help)
      print_usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      print_usage
      exit 1
      ;;
  esac
done

# Source environment file if provided
if [[ -n "$ENV_FILE" ]]; then
  if [[ -f "$ENV_FILE" ]]; then
    echo "Loading environment variables from $ENV_FILE"
    source "$ENV_FILE"
  else
    echo "Error: Environment file $ENV_FILE not found."
    exit 1
  fi
fi

# Fetch secrets from GCP Secret Manager if requested
if [[ "$USE_GCP_SECRETS" = true ]]; then
  echo "Fetching Auth0 secrets from GCP Secret Manager..."
  # Check if gcloud is available
  if ! command -v gcloud &> /dev/null; then
    echo "Error: gcloud command not found. Please install Google Cloud SDK."
    exit 1
  fi
  
  # Fetch secrets from GCP Secret Manager
  export AUTH0_DOMAIN=$(gcloud secrets versions access latest --secret="auth0-domain")
  export AUTH0_CLIENT_ID=$(gcloud secrets versions access latest --secret="auth0-client-id")
  export AUTH0_CLIENT_SECRET=$(gcloud secrets versions access latest --secret="auth0-client-secret")
  export AUTH0_CALLBACK_URL=$(gcloud secrets versions access latest --secret="auth0-callback-url")
  export AUTH0_AUDIENCE=$(gcloud secrets versions access latest --secret="auth0-audience")
  export AUTH0_SECRET=$(gcloud secrets versions access latest --secret="auth0-session-key")
  
  echo "Auth0 secrets fetched from GCP Secret Manager."
fi

# Check if required environment variables are set
required_vars=("AUTH0_DOMAIN" "AUTH0_CLIENT_ID" "AUTH0_CLIENT_SECRET" "AUTH0_CALLBACK_URL" "AUTH0_AUDIENCE" "AUTH0_SECRET")
missing_vars=()

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    missing_vars+=("$var")
  fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
  echo "Error: The following required environment variables are not set:"
  for var in "${missing_vars[@]}"; do
    echo "  - $var"
  done
  echo "Please set these variables before running this script or use --env-file or --gcp-secrets options."
  exit 1
fi

# Create a copy of the template
cp kubernetes/auth0-secrets.yml kubernetes/auth0-secrets-applied.yml

# Base64 encode values safely
AUTH0_DOMAIN_B64=$(echo -n "${AUTH0_DOMAIN}" | base64 -w 0)
AUTH0_CLIENT_ID_B64=$(echo -n "${AUTH0_CLIENT_ID}" | base64 -w 0)
AUTH0_CLIENT_SECRET_B64=$(echo -n "${AUTH0_CLIENT_SECRET}" | base64 -w 0)
AUTH0_CALLBACK_URL_B64=$(echo -n "${AUTH0_CALLBACK_URL}" | base64 -w 0)
AUTH0_AUDIENCE_B64=$(echo -n "${AUTH0_AUDIENCE}" | base64 -w 0)
AUTH0_SECRET_B64=$(echo -n "${AUTH0_SECRET}" | base64 -w 0)

# Replace placeholders with base64-encoded values
sed -i "s|__AUTH0_DOMAIN__|${AUTH0_DOMAIN_B64}|g" kubernetes/auth0-secrets-applied.yml
sed -i "s|__AUTH0_CLIENT_ID__|${AUTH0_CLIENT_ID_B64}|g" kubernetes/auth0-secrets-applied.yml
sed -i "s|__AUTH0_CLIENT_SECRET__|${AUTH0_CLIENT_SECRET_B64}|g" kubernetes/auth0-secrets-applied.yml
sed -i "s|__AUTH0_CALLBACK_URL__|${AUTH0_CALLBACK_URL_B64}|g" kubernetes/auth0-secrets-applied.yml
sed -i "s|__AUTH0_AUDIENCE__|${AUTH0_AUDIENCE_B64}|g" kubernetes/auth0-secrets-applied.yml
sed -i "s|__AUTH0_SECRET__|${AUTH0_SECRET_B64}|g" kubernetes/auth0-secrets-applied.yml

# Apply the secret to the Kubernetes cluster
kubectl apply -f kubernetes/auth0-secrets-applied.yml

echo "Auth0 secrets have been applied to the Kubernetes cluster."