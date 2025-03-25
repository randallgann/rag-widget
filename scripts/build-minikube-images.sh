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

# Build admin-portal image
echo "Building admin-portal image..."
docker build -t rag-widget-admin-portal:latest \
  --build-arg PORT=3000 \
  --build-arg APP_TYPE=admin-portal \
  -f Dockerfile .

# Build auth-server image
echo "Building auth-server image..."
docker build -t rag-widget-auth-server:latest \
  --build-arg PORT=3001 \
  --build-arg APP_TYPE=auth-server \
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

# Verify images were built
echo "Images in Minikube's Docker:"
docker images | grep rag-widget

echo "Image build process complete!"
echo "You can now deploy using:"
echo "kubectl apply -f kubernetes/postgres.yml"
echo "kubectl apply -f kubernetes/auth-server.yml"
echo "kubectl apply -f kubernetes/admin-portal.yml"
echo "kubectl apply -f kubernetes/landing-page.yml"