#!/bin/bash
# Script to prepare GCP service account key for Kubernetes

# Ensure the script is executable:
# chmod +x scripts/prepare-gcp-secret.sh

# Check if service account key file exists
SA_KEY_FILE="rag-widget-1b0f63fa8b77.json"
if [ ! -f "$SA_KEY_FILE" ]; then
  echo "Error: Service account key file '$SA_KEY_FILE' not found!"
  echo "Make sure you're running this script from the project root directory."
  exit 1
fi

# Base64 encode the service account key (with no line breaks)
KEY_DATA=$(cat "$SA_KEY_FILE" | base64 -w 0)

# Create a copy of the gcp-secrets.yml template with the actual key
cp kubernetes/gcp-secrets.yml kubernetes/gcp-secrets-with-key.yml

# Replace the placeholder with the actual base64-encoded key
sed -i "s|REPLACE_WITH_BASE64_ENCODED_SA_KEY|$KEY_DATA|g" kubernetes/gcp-secrets-with-key.yml

echo "Created kubernetes/gcp-secrets-with-key.yml with your encoded service account key"
echo ""
echo "IMPORTANT: This file contains sensitive credentials. Do not commit it to version control!"
echo "Apply it to your Kubernetes cluster with:"
echo "kubectl apply -f kubernetes/gcp-secrets-with-key.yml"
echo ""
echo "After applying, you should delete this file:"
echo "rm kubernetes/gcp-secrets-with-key.yml"