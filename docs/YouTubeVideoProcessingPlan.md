# YouTube Video Processing Implementation Plan

## Overview

This document outlines the implementation plan for retrieving, storing, and processing YouTube video metadata and content for the RAG Widget system. The plan follows a Test-Driven Development (TDD) approach where each component is developed with corresponding test cases to ensure functionality.

## System Context

The RAG Widget application allows users to:
1. Add YouTube channels for content processing
2. Create AI-powered Q&A widgets based on video content
3. Embed these widgets on their websites

The video processing workflow is a core component that enables:
- Retrieving video metadata from YouTube
- Storing this metadata in a PostgreSQL database
- Processing selected videos (transcription, embedding generation)
- Creating searchable knowledge bases from video content

This document focuses specifically on implementing the video metadata retrieval and processing functionality, following a user-centric approach where:
1. Video metadata is retrieved immediately after channel validation
2. Users can select which videos to process fully
3. Processing status is tracked and displayed to users

## Design Philosophy

1. **Early Metadata Retrieval**: Store video metadata in the database upon channel discovery
2. **Deferred Processing**: Allow users to select which videos to process
3. **Progress Tracking**: Track processing status in the database
4. **Scalable Processing**: Design for handling large numbers of videos

## Implementation Phases

### Phase 1: Video Metadata Storage

#### 1.1 Channel Creation Service

The service will create a channel and immediately retrieve all available video metadata.

**Function**: `createChannelWithMetadata(channelDetails, userId, apiKey)`
- Test: Verify channel creation in database
- Test: Verify YouTube API is called to get videos
- Test: Verify video metadata is stored correctly

#### 1.2 Video Metadata Storage Service

**Function**: `storeVideoMetadata(channelId, videos)`
- Test: Verify bulk insert of video metadata
- Test: Verify handling of duplicate videos
- Test: Verify correct default values (status = 'active', processingStatus = 'pending')

#### 1.3 Pagination Support for Large Channels

**Function**: `fetchAllChannelVideos(channelId, apiKey)`
- Test: Verify handling of pagination tokens
- Test: Verify aggregation of results across multiple pages
- Test: Verify error handling when API limits are reached

### Phase 2: Video Selection and Management Interface

#### 2.1 Video Listing Service

**Function**: `getChannelVideos(channelId, filters, pagination)`
- Test: Verify filtering by status, date, views, etc.
- Test: Verify pagination of results
- Test: Verify sorting options

#### 2.2 Video Selection API

**Function**: `updateVideoSelections(videoIds, updates)`
- Test: Verify batch status updates
- Test: Verify validation of allowed status transitions
- Test: Verify authorization checks

#### 2.3 Bulk Operations API

**Function**: `performBulkOperation(channelId, operation, filters)`
- Test: Verify "select all" functionality
- Test: Verify "process all" functionality
- Test: Verify filter-based selection

### Phase 3: Video Processing Implementation

#### 3.1 Processing Queue Service

**Function**: `queueVideosForProcessing(videoIds)`
- Test: Verify videos are added to processing queue
- Test: Verify status updates in database
- Test: Verify duplicate handling in queue

#### 3.2 Video Transcription Service

**Function**: `transcribeVideo(videoId, options)`
- Test: Verify YouTube video download
- Test: Verify audio extraction
- Test: Verify transcription quality
- Test: Verify segment creation with timestamps

#### 3.3 Embedding Generation Service

**Function**: `generateEmbeddings(transcriptSegments)`
- Test: Verify vector dimensions
- Test: Verify batch processing capability
- Test: Verify error handling for failed embeddings

#### 3.4 Processing Status Tracking

**Function**: `updateProcessingStatus(videoId, status, progress)`
- Test: Verify status updates
- Test: Verify progress percentage tracking
- Test: Verify error logging

### Phase 4: Integration and UI Implementation

#### 4.1 Processing Status Webhooks

**Function**: `notifyProcessingComplete(videoId, status)`
- Test: Verify webhook delivery
- Test: Verify real-time UI updates
- Test: Verify error handling for failed notifications

#### 4.2 Video Management UI Components

**Function**: `renderVideoManagementUI(channelId)`
- Test: Verify UI renders correctly with video data
- Test: Verify interactive elements function properly
- Test: Verify status indicators update dynamically

#### 4.3 Processing Analytics

**Function**: `getProcessingAnalytics(channelId)`
- Test: Verify statistics calculation
- Test: Verify performance metrics
- Test: Verify visualization data formatting

## Database Schema Updates

The following database schema updates will be implemented:

### Channel Model Updates

```typescript
// Add to Channel model
interface ChannelAttributes {
  // ... existing fields
  
  // New fields
  lastMetadataFetch: Date;     // Timestamp of last video metadata fetch
  videoCount: number;          // Total number of videos in the channel
  totalProcessed: number;      // Count of videos that completed processing
  processingStatus: 'idle' | 'processing' | 'completed' | 'error';
}
```

### Video Model Updates

```typescript
// Add to Video model
interface VideoAttributes {
  // ... existing fields
  
  // New fields
  description: string;           // Video description from YouTube
  publishedAt: Date;             // Publication date from YouTube
  thumbnailUrl: string;          // URL to video thumbnail
  duration: string;              // Duration in ISO 8601 format (PT1H2M3S)
  durationSeconds: number;       // Duration in seconds for easier querying
  viewCount: number;             // View count from YouTube
  likeCount: number;             // Like count from YouTube
  processingProgress: number;    // Progress percentage (0-100)
  selectedForProcessing: boolean; // Flag for user selection
  processingError: string;       // Error message if processing failed
  size: number;                  // Size in bytes (if available)
}
```

### Schema Migration Strategy

1. Create migration files for schema updates
2. Add non-breaking changes first (nullable fields)
3. Update model TypeScript interfaces
4. Add database indexes for frequently queried fields:
   ```sql
   CREATE INDEX idx_videos_channel_id ON videos(channel_id);
   CREATE INDEX idx_videos_processing_status ON videos(processing_status);
   CREATE INDEX idx_videos_published_at ON videos(published_at);
   ```

Migration will be applied using Sequelize migration scripts to ensure database consistency.

## Testing Strategy

### Unit Tests

For each function, write unit tests that:
- Verify correct behavior with valid inputs
- Verify error handling with invalid inputs
- Test edge cases (empty lists, large numbers of videos, etc.)

### Integration Tests

- Test the flow from channel creation to video processing
- Test database interactions across services
- Test error recovery across module boundaries

### End-to-End Tests

- Test the complete user journey from adding a channel to viewing processed videos
- Test UI interactions and real-time updates
- Test performance with realistic data volumes

## Implementation Strategy

### TDD Implementation Flow

For each function:

1. Write test cases first:
   ```typescript
   describe('createChannelWithMetadata', () => {
     it('should create a channel in the database', async () => {
       // Test implementation
     });
     
     it('should call YouTube API to retrieve videos', async () => {
       // Test implementation
     });
     
     it('should store video metadata for all retrieved videos', async () => {
       // Test implementation
     });
   });
   ```

2. Implement the minimum code to make tests pass:
   ```typescript
   async function createChannelWithMetadata(channelDetails, userId, apiKey) {
     // Implementation that satisfies tests
   }
   ```

3. Refactor the code while keeping tests passing

4. Document the implementation with JSDoc comments

### Dependency Injection

To make testing easier, use dependency injection for services:

```typescript
// Example of a testable service
export class VideoMetadataService {
  constructor(
    private videoRepository, 
    private youtubeApiService
  ) {}
  
  async storeVideoMetadata(channelId, videos) {
    // Implementation
  }
}
```

This allows for mocking dependencies in tests.

## Next Steps

1. Begin implementation of Phase 1 functions:
   - Create test files for each function
   - Implement minimal versions of each function
   - Integrate with existing channel validation flow

2. Phase 1 Deliverables:
   - Updated Channel model with metadata fetching
   - Video metadata storage service
   - Tests for all Phase 1 functionality
   - Integration with channel creation flow

3. Phase 2 Planning:
   - Design video selection UI wireframes
   - Define API contracts for video selection endpoints
   - Create test cases for Phase 2 functions