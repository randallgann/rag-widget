#!/bin/bash

# Connect to Minikube's Docker daemon
eval $(minikube docker-env)

# Check if we're connected to Minikube's Docker
if ! docker info > /dev/null 2>&1; then
  echo "Error: Cannot connect to Minikube's Docker daemon"
  echo "Make sure Minikube is running: minikube status"
  exit 1
fi

echo "Connected to Minikube's Docker daemon"

# Build api-service image (consolidated service)
echo "Building api-service image..."
docker build -t rag-widget-api-service:latest \
  --build-arg PORT=3001 \
  --build-arg APP_TYPE=api-service \
  -f Dockerfile .

# Build frontend image if the directory exists
if [ -d "/home/rgann/test-landing-page" ]; then
  echo "Building frontend image..."
  docker build -t rag-widget-frontend:latest -f /home/rgann/test-landing-page/Dockerfile /home/rgann/test-landing-page
else
  echo "Warning: Frontend directory not found at /home/rgann/test-landing-page"
  echo "Skipping frontend image build"
fi

# Build postgres image
echo "Building postgres image..."
docker build -t rag-widget-postgres:latest -f database/Dockerfile database

# Build chat-copilot-webapi image if the directory exists
if [ -d "/home/rgann/chat-copilot" ]; then
  echo "Building chat-copilot-webapi image..."
  docker build -t chat-copilot-webapi:latest -f /home/rgann/chat-copilot/docker/webapi/Dockerfile /home/rgann/chat-copilot
else
  echo "Warning: Chat-copilot directory not found at /home/rgann/chat-copilot"
  echo "Skipping chat-copilot-webapi image build"
fi

# Verify images were built
echo "Images in Minikube's Docker:"
docker images | grep -E 'rag-widget|chat-copilot'

echo "Image build process complete!"
echo "You can now deploy using:"
echo "kubectl apply -f kubernetes/postgres.yml"
echo "kubectl apply -f kubernetes/api-service.yml"
echo "kubectl apply -f kubernetes/frontend.yml"
echo "kubectl apply -f kubernetes/chat-copilot-webapi.yml"
echo "kubectl apply -f kubernetes/ingress.yml"