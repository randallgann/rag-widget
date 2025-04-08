# Test Messages for Video Processing Status

Use these gcloud commands to manually test the video processing status updates. Copy and paste the commands into your terminal to simulate different parts of the processing lifecycle.

## Video ID to Test
```
545b5984-f3f8-4b1e-a788-7835f39b627f
```

## Starting a Processing Job

```bash
gcloud pubsub topics publish video-processing-status --message='{
  "videoId": "545b5984-f3f8-4b1e-a788-7835f39b627f",
  "jobId": "test-job-123",
  "status": "started",
  "progress": 0,
  "stage": "initialization",
  "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
}'
```

## Stage: Downloading (25% Progress)

```bash
gcloud pubsub topics publish video-processing-status --message='{
  "videoId": "545b5984-f3f8-4b1e-a788-7835f39b627f",
  "jobId": "test-job-123",
  "status": "processing",
  "progress": 25,
  "stage": "downloading",
  "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
}'
```

## Stage: Extracting Audio (40% Progress)

```bash
gcloud pubsub topics publish video-processing-status --message='{
  "videoId": "545b5984-f3f8-4b1e-a788-7835f39b627f",
  "jobId": "test-job-123",
  "status": "processing",
  "progress": 40,
  "stage": "extracting_audio",
  "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
}'
```

## Stage: Transcribing (60% Progress)

```bash
gcloud pubsub topics publish video-processing-status --message='{
  "videoId": "545b5984-f3f8-4b1e-a788-7835f39b627f",
  "jobId": "test-job-123",
  "status": "processing",
  "progress": 60,
  "stage": "transcribing",
  "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
}'
```

## Stage: Generating Embeddings (80% Progress)

```bash
gcloud pubsub topics publish video-processing-status --message='{
  "videoId": "545b5984-f3f8-4b1e-a788-7835f39b627f",
  "jobId": "test-job-123",
  "status": "processing",
  "progress": 80,
  "stage": "generating_embeddings",
  "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
}'
```

## Stage: Storing Results (95% Progress)

```bash
gcloud pubsub topics publish video-processing-status --message='{
  "videoId": "545b5984-f3f8-4b1e-a788-7835f39b627f",
  "jobId": "test-job-123",
  "status": "processing",
  "progress": 95,
  "stage": "storing_results",
  "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
}'
```

## Completed Successfully (100% Progress)

```bash
gcloud pubsub topics publish video-processing-status --message='{
  "videoId": "545b5984-f3f8-4b1e-a788-7835f39b627f",
  "jobId": "test-job-123",
  "status": "completed",
  "progress": 100,
  "stage": "finished",
  "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
}'
```

## Failed Processing (Error State)

```bash
gcloud pubsub topics publish video-processing-status --message='{
  "videoId": "545b5984-f3f8-4b1e-a788-7835f39b627f",
  "jobId": "test-job-123",
  "status": "failed",
  "progress": 45,
  "stage": "error",
  "error": "Failed to process video: transcription service timeout",
  "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
}'
```

## Original Test Messages

```bash
gcloud pubsub topics publish video-processing-requests --message='{
    "jobId": "ALDSJKAFASD",
    "timestamp": "04/02/2025",
    "video": {
      "id": "your-video-db-id",
      "url": "https://www.youtube.com/watch?v=AqJnK9Dh-eQ",
      "title": "Your Video Title",
      "duration": "PT1H30M15S"
    },
    "channel": {
      "id": "your-channel-db-id",
      "name": "Your Channel Name"
    },
    "user": {
      "id": "your-user-id"
    },
    "storage": {
      "outputBucket": "rag-widget-processed-videos",
      "outputPrefix": "channels/your-channel-db-id/videos/your-video-db-id/"
    }
  }'
```