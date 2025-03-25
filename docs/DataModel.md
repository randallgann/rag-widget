# Data Model Documentation

## Overview

This document describes the data models used in the YouTube RAG Widget application. The system uses a PostgreSQL database for structured data and a vector database for embedding storage and similarity search.

## Entity Relationship Diagram

```
+---------------+       +---------------+       +---------------+
|               |       |               |       |               |
|     User      |-------|    Widget     |-------|   Channel     |
|               |       |               |       |               |
+---------------+       +---------------+       +---------------+
                                |                       |
                                |                       |
                        +-------v-------+       +-------v-------+
                        |               |       |               |
                        |  WidgetConfig |       |     Video     |
                        |               |       |               |
                        +---------------+       +---------------+
                                                       |
                                                       |
                                                +------v------+
                                                |             |
                                                | VideoSegment|
                                                |             |
                                                +-------------+
```

## Database Schema

### User

Stores information about authenticated users.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| auth0Id | String | Auth0 user identifier |
| email | String | User's email address |
| name | String | User's display name |
| createdAt | Timestamp | Account creation date |
| updatedAt | Timestamp | Last update timestamp |

### Channel

Represents a YouTube channel connected to a user account.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| userId | UUID | Reference to User |
| youtubeId | String | YouTube channel identifier |
| name | String | Channel display name |
| description | Text | Channel description |
| thumbnailUrl | String | URL to channel thumbnail |
| subscriberCount | Integer | Number of subscribers |
| videoCount | Integer | Number of videos |
| status | Enum | Processing status |
| lastSyncedAt | Timestamp | Last synchronization date |
| createdAt | Timestamp | Record creation date |
| updatedAt | Timestamp | Last update timestamp |

### Video

Represents a YouTube video from a channel.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| channelId | UUID | Reference to Channel |
| youtubeId | String | YouTube video identifier |
| title | String | Video title |
| description | Text | Video description |
| thumbnailUrl | String | URL to video thumbnail |
| duration | Integer | Duration in seconds |
| viewCount | Integer | Number of views |
| publishedAt | Timestamp | Publication date |
| status | Enum | Processing status |
| transcriptStatus | Enum | Transcript processing status |
| embedStatus | Enum | Embedding processing status |
| createdAt | Timestamp | Record creation date |
| updatedAt | Timestamp | Last update timestamp |

### VideoSegment

Represents a segment of a video with vector embeddings for RAG.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| videoId | UUID | Reference to Video |
| startTime | Float | Segment start time (seconds) |
| endTime | Float | Segment end time (seconds) |
| transcript | Text | Segment transcript text |
| embeddingId | String | Vector database identifier |
| createdAt | Timestamp | Record creation date |
| updatedAt | Timestamp | Last update timestamp |

### Widget

Represents a configurable widget created by a user.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| userId | UUID | Reference to User |
| name | String | Widget display name |
| description | Text | Widget description |
| theme | String | Widget theme (light/dark) |
| status | Enum | Widget status |
| createdAt | Timestamp | Record creation date |
| updatedAt | Timestamp | Last update timestamp |

### WidgetConfig

Stores widget configuration and customization options.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| widgetId | UUID | Reference to Widget |
| key | String | Configuration key |
| value | JSON | Configuration value |
| createdAt | Timestamp | Record creation date |
| updatedAt | Timestamp | Last update timestamp |

### WidgetChannel

Junction table for many-to-many relationship between widgets and channels.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| widgetId | UUID | Reference to Widget |
| channelId | UUID | Reference to Channel |
| createdAt | Timestamp | Record creation date |
| updatedAt | Timestamp | Last update timestamp |

## Vector Database Schema

The vector database stores embeddings generated from video segments to enable semantic search.

### Embedding Collection

| Field | Type | Description |
|-------|------|-------------|
| id | String | Unique identifier (matches VideoSegment.embeddingId) |
| vector | Vector | Embedding vector (1536 dimensions) |
| videoId | String | Reference to video |
| segmentId | String | Reference to video segment |
| startTime | Float | Segment start time |
| endTime | Float | Segment end time |
| text | String | Segment transcript text |

## Data Relationships

1. **User to Channel**: One-to-many (a user can have multiple channels)
2. **User to Widget**: One-to-many (a user can create multiple widgets)
3. **Channel to Video**: One-to-many (a channel can have multiple videos)
4. **Video to VideoSegment**: One-to-many (a video is divided into multiple segments)
5. **Widget to Channel**: Many-to-many (a widget can include multiple channels, and a channel can be in multiple widgets)

## Data Flow

1. **Video Processing Flow**:
   - YouTube channel is added by user
   - Videos are fetched from YouTube API
   - Each video is processed for transcription
   - Transcripts are segmented and embedded
   - Embeddings are stored in vector database
   - Segments are stored in PostgreSQL with reference to embedding

2. **Query Processing Flow**:
   - User query is received from widget
   - Query is embedded using same embedding model
   - Vector similarity search finds relevant segments
   - Results are formatted and returned to widget