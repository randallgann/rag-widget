# Qdrant Vector Database Usage Guide

## Overview
Qdrant is a vector similarity search engine used in this project for vector storage and retrieval. It's designed for building AI applications with semantic search, recommendations, and other ML-powered features.

## Access and Management

### Using the Web UI
Qdrant comes with a built-in web dashboard that can be accessed when the service is running:

1. Start the Docker Compose stack or Kubernetes deployment
2. Access the Qdrant Dashboard at http://localhost:6333/dashboard
3. The dashboard allows you to:
   - View collections
   - Create new collections
   - Perform vector searches
   - View cluster stats and configuration

### REST API Access
Qdrant exposes a REST API on port 6333:

- API Base URL: http://localhost:6333
- Healthcheck: http://localhost:6333/healthz
- API Documentation: http://localhost:6333/docs

### gRPC API
For high-performance applications, Qdrant also provides a gRPC API on port 6334.

## Creating a Collection

Using the REST API:

```bash
curl -X PUT 'http://localhost:6333/collections/my_collection' \
    -H 'Content-Type: application/json' \
    --data-raw '{
        "vectors": {
            "size": 1536,
            "distance": "Cosine"
        }
    }'
```

Using the Web UI:
1. Navigate to http://localhost:6333/dashboard
2. Click "Collections" in the sidebar
3. Click "Create Collection"
4. Fill in the form with your vector parameters (size and distance metric)

## Testing Your Qdrant Installation

You can run a simple test with:

```bash
# Health check
curl http://localhost:6333/healthz

# List collections
curl http://localhost:6333/collections
```

## External Management Tools

Unlike PostgreSQL (which has pgAdmin), Qdrant doesn't have many third-party management tools. The built-in dashboard is the primary management interface. However, there are a few options:

1. **Qdrant Client Libraries**: Available for Python, JavaScript, Rust, and other languages
2. **LangChain Integration**: If using LangChain, it includes a Qdrant vector store integration
3. **Haystack Integration**: Haystack also provides a Qdrant document store

## Common Operations

### Create a collection
```bash
curl -X PUT 'http://localhost:6333/collections/my_collection' \
    -H 'Content-Type: application/json' \
    --data-raw '{
        "vectors": {
            "size": 1536,
            "distance": "Cosine"
        }
    }'
```

### Upload vectors
```bash
curl -X PUT 'http://localhost:6333/collections/my_collection/points' \
    -H 'Content-Type: application/json' \
    --data-raw '{
        "points": [
            {
                "id": 1,
                "vector": [0.1, 0.2, 0.3, ...],
                "payload": {"text": "sample text"}
            }
        ]
    }'
```

### Search for similar vectors
```bash
curl -X POST 'http://localhost:6333/collections/my_collection/points/search' \
    -H 'Content-Type: application/json' \
    --data-raw '{
        "vector": [0.1, 0.2, 0.3, ...],
        "limit": 10
    }'
```