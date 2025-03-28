#!/bin/bash

# Script to set up API keys for Kubernetes deployment

# Check if YOUTUBE_API_KEY environment variable is set
if [ -z "$YOUTUBE_API_KEY" ]; then
  echo "Error: YOUTUBE_API_KEY environment variable is not set."
  echo "Please set it with: export YOUTUBE_API_KEY=your-youtube-api-key"
  exit 1
fi

# Base64 encode the YouTube API key
YOUTUBE_API_KEY_B64=$(echo -n "$YOUTUBE_API_KEY" | base64 -w 0)

# Create a copy of the template
cp kubernetes/api-keys-secret.yml kubernetes/api-keys-secret-applied.yml

# Replace the placeholder with the base64-encoded value
sed -i "s|__YOUTUBE_API_KEY__|${YOUTUBE_API_KEY_B64}|g" kubernetes/api-keys-secret-applied.yml

# Apply the secret to the Kubernetes cluster
kubectl apply -f kubernetes/api-keys-secret-applied.yml

echo "API keys secret has been applied to the Kubernetes cluster."
echo "Remember to remove kubernetes/api-keys-secret-applied.yml as it contains sensitive information."