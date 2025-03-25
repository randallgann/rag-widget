# API Documentation

## Base URL

All API endpoints are relative to the base URL:

```
/api/v1
```

## Authentication

Most API endpoints require authentication using Auth0-issued JWT tokens. Include the token in the Authorization header:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

## Error Handling

All errors follow a consistent format:

```json
{
  "status": "error",
  "statusCode": 400,
  "message": "Error message description"
}
```

Common error codes:
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 429: Too Many Requests
- 500: Internal Server Error

## Rate Limiting

API endpoints are rate-limited to prevent abuse. Current limits:
- 100 requests per minute per authenticated user
- 20 requests per minute for anonymous queries

## Endpoints

### Authentication

#### GET /auth/status
Check authentication status

**Response:**
```json
{
  "isAuthenticated": true,
  "user": {
    "sub": "auth0|user_id",
    "email": "user@example.com",
    "name": "User Name"
  }
}
```

#### GET /auth/profile
Get authenticated user profile

**Response:**
```json
{
  "id": "user_id",
  "email": "user@example.com",
  "name": "User Name",
  "createdAt": "2025-01-01T00:00:00Z"
}
```

### Dashboard

#### GET /dashboard/stats
Get dashboard statistics

**Response:**
```json
{
  "channels": 5,
  "videos": 102,
  "widgets": 3,
  "queries": 1520,
  "queryTrends": [
    { "date": "2025-02-01", "count": 123 },
    { "date": "2025-02-02", "count": 145 }
  ]
}
```

### Channels

#### GET /channels
Get all channels for authenticated user

**Response:**
```json
{
  "channels": [
    {
      "id": "channel_id_1",
      "name": "Channel Name",
      "youtubeId": "youtube_channel_id",
      "thumbnailUrl": "https://example.com/thumbnail.jpg",
      "videoCount": 42,
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

#### POST /channels
Add a new YouTube channel

**Request:**
```json
{
  "youtubeId": "youtube_channel_id"
}
```

**Response:**
```json
{
  "id": "channel_id",
  "name": "Channel Name",
  "youtubeId": "youtube_channel_id",
  "thumbnailUrl": "https://example.com/thumbnail.jpg",
  "videoCount": 0,
  "createdAt": "2025-03-01T00:00:00Z"
}
```

#### GET /channels/:channelId
Get channel details

**Response:**
```json
{
  "id": "channel_id",
  "name": "Channel Name",
  "youtubeId": "youtube_channel_id",
  "thumbnailUrl": "https://example.com/thumbnail.jpg",
  "videoCount": 42,
  "videos": [
    {
      "id": "video_id",
      "title": "Video Title",
      "youtubeId": "youtube_video_id",
      "thumbnailUrl": "https://example.com/video_thumbnail.jpg",
      "duration": 1234,
      "publishedAt": "2025-01-15T00:00:00Z",
      "status": "processed"
    }
  ],
  "createdAt": "2025-01-01T00:00:00Z"
}
```

#### DELETE /channels/:channelId
Delete a channel

**Response:**
```json
{
  "success": true,
  "message": "Channel deleted successfully"
}
```

### Widgets

#### GET /widgets
Get all widgets for authenticated user

**Response:**
```json
{
  "widgets": [
    {
      "id": "widget_id",
      "name": "Widget Name",
      "theme": "light",
      "channels": ["channel_id_1", "channel_id_2"],
      "embedCode": "<script src=\"https://example.com/widget.js\" data-widget-id=\"widget_id\"></script>",
      "createdAt": "2025-01-10T00:00:00Z"
    }
  ]
}
```

#### POST /widgets
Create a new widget

**Request:**
```json
{
  "name": "Widget Name",
  "theme": "light",
  "channels": ["channel_id_1", "channel_id_2"]
}
```

**Response:**
```json
{
  "id": "widget_id",
  "name": "Widget Name",
  "theme": "light",
  "channels": ["channel_id_1", "channel_id_2"],
  "embedCode": "<script src=\"https://example.com/widget.js\" data-widget-id=\"widget_id\"></script>",
  "createdAt": "2025-03-01T00:00:00Z"
}
```

#### PUT /widgets/:widgetId
Update a widget

**Request:**
```json
{
  "name": "Updated Widget Name",
  "theme": "dark",
  "channels": ["channel_id_1", "channel_id_3"]
}
```

**Response:**
```json
{
  "id": "widget_id",
  "name": "Updated Widget Name",
  "theme": "dark",
  "channels": ["channel_id_1", "channel_id_3"],
  "embedCode": "<script src=\"https://example.com/widget.js\" data-widget-id=\"widget_id\"></script>",
  "updatedAt": "2025-03-01T12:00:00Z"
}
```

#### DELETE /widgets/:widgetId
Delete a widget

**Response:**
```json
{
  "success": true,
  "message": "Widget deleted successfully"
}
```

### Query

#### POST /query
Process a RAG query (public endpoint, requires widget ID)

**Request:**
```json
{
  "widgetId": "widget_id",
  "query": "How do I implement a RAG system?",
  "context": {
    "pageUrl": "https://example.com/page"
  }
}
```

**Response:**
```json
{
  "answer": "To implement a RAG system, you need to...",
  "sources": [
    {
      "videoId": "video_id",
      "title": "Video Title",
      "thumbnailUrl": "https://example.com/thumbnail.jpg",
      "url": "https://youtube.com/watch?v=video_id",
      "timestamp": 123
    }
  ]
}
```