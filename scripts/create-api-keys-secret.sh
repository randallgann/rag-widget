#\!/bin/bash

# Check if YOUTUBE_API_KEY environment variable is set
if [ -z "$YOUTUBE_API_KEY" ]; then
  echo "Error: YOUTUBE_API_KEY environment variable is not set."
  echo "Please set it with: export YOUTUBE_API_KEY=your-youtube-api-key"
  exit 1
fi

# Base64 encode the YouTube API key
YOUTUBE_API_KEY_B64=$(echo -n "$YOUTUBE_API_KEY" | base64)

# Create a temporary file with the secret
cat > youtube-api-key-secret.yml << EOL
apiVersion: v1
kind: Secret
metadata:
  name: api-keys-secret
type: Opaque
data:
  YOUTUBE_API_KEY: ${YOUTUBE_API_KEY_B64}
EOL

# Apply the secret to the Kubernetes cluster
kubectl apply -f youtube-api-key-secret.yml

echo "API keys secret has been applied to the Kubernetes cluster."
