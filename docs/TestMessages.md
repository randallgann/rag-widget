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

gcloud pubsub topics publish video-processing-requests --message='{
    "jobId": "ALDSJKAFASD",
    "timestamp": "04/02/2025",
    "video": {
      "id": "your-video-db-id",
      "url": "https://www.youtube.com/watch?v=PGkoz6FNg8s",
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