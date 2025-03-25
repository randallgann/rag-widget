# Video Processing Queue Design

## Overview

This document outlines the design for implementing a message queue system using Google Cloud Pub/Sub for video processing in the RAG Widget application. The system will allow the main application to offload CPU-intensive video processing tasks to an external high-powered AI machine (hosted on VAST.AI), enabling efficient processing of YouTube videos.

## Architecture

```
                                   +----------------+
                                   |                |
+--------------------+  Publish   |   Google Cloud  |   Subscribe    +------------------+
|                    |----------->|     Pub/Sub     |--------------->|                  |
|  RAG Widget Server |  Messages  |                 |   Messages     |  VAST.AI Server  |
|                    |            |                 |                |  (Ubuntu)        |
+--------------------+            +----------------+                 +------------------+
        |                                                                     |
        | Update video                                                        |
        | status                                                              |
        v                                                                     v
+--------------------+                                               +------------------+
|                    |                                               |                  |
|  PostgreSQL DB     |                                               |  GCP Cloud       |
|                    |                                               |  Storage         |
+--------------------+                                               +------------------+
                                                                             ^
                                                                             |
                                                                      RAG Widget Server
                                                                      checks for results
```

## Message Structure

Messages published to GCP Pub/Sub will use the following JSON structure:

```json
{
  "jobId": "job-12345-67890",
  "timestamp": "2025-03-19T14:30:00Z",
  "video": {
    "id": "dQw4w9WgXcQ",
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "title": "Sample Video Title",
    "duration": "PT3M30S"
  },
  "channel": {
    "id": "channel-12345",
    "name": "Sample Channel"
  },
  "user": {
    "id": "user-12345"
  },
  "storage": {
    "outputBucket": "your-processing-results-bucket",
    "outputPrefix": "channels/channel-12345/videos/dQw4w9WgXcQ/"
  }
}
```

### Message Fields Explanation

1. **Job Information**:
   - `jobId`: Unique identifier for this processing job
   - `timestamp`: When the job was submitted

2. **Video Information**:
   - `video.id`: YouTube video ID (for retrieval via YouTube API)
   - `video.url`: Complete YouTube URL
   - `video.title`: Video title for reference/logging
   - `video.duration`: Duration information (useful for estimating processing time)

3. **Context Information**:
   - `channel.id`: ID of the channel this video belongs to
   - `channel.name`: Name of the channel (for logging/reference)
   - `user.id`: ID of the user who owns this channel

4. **Storage Information**:
   - `storage.outputBucket`: GCP Cloud Storage bucket to store results
   - `storage.outputPrefix`: Path prefix within the bucket for this specific video

## Implementation Steps

### 1. RAG Widget Server

1. Install GCP Pub/Sub client library
2. Create a message queue service for Pub/Sub
3. Update environment configuration to include GCP credentials and Pub/Sub topic name
4. Modify the video controller to publish messages to Pub/Sub when videos are selected for processing
5. Update UI to show processing status for videos

### 2. VAST.AI Ubuntu Server

1. Set up a subscriber for the Pub/Sub topic
2. Implement video processing pipeline:
   - Download YouTube videos
   - Transcribe audio
   - Process and embed content
   - Store results in GCP Cloud Storage

### 3. Processing Status Feedback

#### Initial Implementation (Phase 1)
- RAG Widget server will check GCP Cloud Storage for completed results
- When results are found, update the video status to "completed"

#### Future Enhancement (Phase 2)
- Implement a status update Pub/Sub topic for real-time progress updates
- Add more granular processing status display in the UI

## Security Considerations

1. Ensure GCP service account has minimal required permissions
2. Store GCP credentials securely using environment variables
3. Implement authentication between the RAG Widget server and VAST.AI server
4. Validate message payloads before processing

## Environment Variables

The following environment variables will be needed:

```
# GCP Configuration
GCP_PROJECT_ID=your-gcp-project-id
GCP_PUBSUB_TOPIC=video-processing-queue
GCP_STORAGE_BUCKET=processed-videos-bucket

# Secret Manager Configuration
GCP_SECRET_MANAGER_ENABLED=true
GCP_SERVICE_ACCOUNT_KEY_SECRET=rag-widget-service-account-key

# Fallback for local development (not needed if using Secret Manager)
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account-key.json
```

## Setting Up GCP Secret Manager

1. Create a service account with the following roles:
   - `roles/pubsub.publisher` - For publishing to Pub/Sub topics
   - `roles/secretmanager.secretAccessor` - For accessing secrets

2. Create a key for the service account and download the JSON key file

3. Store the service account key in Secret Manager:
   ```bash
   # Create the secret
   gcloud secrets create rag-widget-service-account-key --replication-policy="automatic"
   
   # Add the key file as a secret version
   gcloud secrets versions add rag-widget-service-account-key --data-file="/path/to/service-account-key.json"
   ```

4. Grant the service account access to the secret:
   ```bash
   gcloud secrets add-iam-policy-binding rag-widget-service-account-key \
     --member="serviceAccount:your-service-account@your-project.iam.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"
   ```

5. Configure environment variables in your application:
   ```
   GCP_SECRET_MANAGER_ENABLED=true
   GCP_SERVICE_ACCOUNT_KEY_SECRET=rag-widget-service-account-key
   ```

## Testing Strategy

1. Create a mock Pub/Sub service for local development and testing
2. Implement unit tests for the message publishing service
3. Develop integration tests using the GCP Pub/Sub emulator