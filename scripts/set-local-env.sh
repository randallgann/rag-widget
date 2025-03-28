#!/bin/bash

# Set Auth0 environment variables
# Replace the placeholder values with your actual Auth0 credentials

# Auth0 Domain (e.g., your-tenant.auth0.com)
export AUTH0_DOMAIN="rapid-rag.us.auth0.com"

# Auth0 Client ID
export AUTH0_CLIENT_ID="8GBnfBNKhsDwUgy5r8bLJjKCKi2OUUA3"

# Auth0 Client Secret
export AUTH0_CLIENT_SECRET="lfFrlBEBfG9kl4ei3_uc9yqiDlMglHF0ifv-zYbS0KHt1GKc3CFUX2yYpOd925sI"

# Auth0 Callback URL
export AUTH0_CALLBACK_URL="http://localhost:3001/api/auth/callback"

# Auth0 API Audience
export AUTH0_AUDIENCE="rapid-rag.com/api"

# Session Secret Key (can be any secure random string)
export AUTH0_SECRET="a-long-random-string-for-cookie-encryption"

export YOUTUBE_API_KEY="AIzaSyBYg1_GEYPnj9IBuU4KjU07CZX9kIvPD_s"

echo "Auth0 and API Key environment variables set."
echo "You can now run ./scripts/setup-auth0-secrets.sh to create the Kubernetes secrets."
echo "You can now run ./scripts/setup-api-keys.sh to create the Kubernetes secrets."