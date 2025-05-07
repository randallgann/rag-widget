#!/bin/bash

# Test Qdrant connectivity and basic operations
# This script helps verify that the Qdrant service is running correctly

echo "Testing Qdrant connectivity..."
echo

# 1. Check if Qdrant is accessible
echo "1. Checking health endpoint:"
curl -s http://localhost:6333/healthz
echo -e "\n"

# 2. List existing collections
echo "2. Listing collections:"
curl -s http://localhost:6333/collections | jq
echo -e "\n"

# 3. Create a test collection
echo "3. Creating test collection:"
curl -X PUT 'http://localhost:6333/collections/test_collection' \
    -H 'Content-Type: application/json' \
    --data-raw '{
        "vectors": {
            "size": 4,
            "distance": "Cosine"
        }
    }'
echo -e "\n"

# 4. Verify collection was created
echo "4. Verifying test_collection:"
curl -s http://localhost:6333/collections/test_collection | jq
echo -e "\n"

# 5. Upload a test point
echo "5. Uploading test point:"
curl -X PUT 'http://localhost:6333/collections/test_collection/points' \
    -H 'Content-Type: application/json' \
    --data-raw '{
        "points": [
            {
                "id": 1,
                "vector": [0.1, 0.2, 0.3, 0.4],
                "payload": {"text": "This is a test vector"}
            }
        ]
    }'
echo -e "\n"

# 6. Search for the point to verify
echo "6. Searching for similar vectors:"
curl -X POST 'http://localhost:6333/collections/test_collection/points/search' \
    -H 'Content-Type: application/json' \
    --data-raw '{
        "vector": [0.1, 0.2, 0.3, 0.4],
        "limit": 1
    }' | jq
echo -e "\n"

echo "Qdrant test complete. If all steps returned successfully, your Qdrant setup is working."
echo "You can also visit the Qdrant dashboard at http://localhost:6333/dashboard"