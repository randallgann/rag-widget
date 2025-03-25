# YouTube Channel Onboarding Documentation

This document outlines the complete implementation plan for YouTube channel onboarding in the RAG Widget application, covering both owned and public YouTube channels.

## User Journey Overview

### 1. Initial Dashboard View
From the dashboard, users see the "Add Channel" button prominently displayed.

### 2. Channel Type Selection
When users click "Add Channel," present a modal or new page with two clear paths:
- My Own YouTube Channel
- Public YouTube Channel

### 3. Path A: Own Channel Flow

1. **YouTube Authentication**
   - Integrate with YouTube OAuth
   - Request permissions to access channel metadata and content
   - Explain clearly what permissions are needed and why

2. **Channel Selection**
   - If user has multiple channels, show selection interface
   - Show channel avatar, name, and basic stats (video count, subscriber count)

3. **Configuration**
   - Content selection:
     - All videos
     - Selected playlists
     - Individual videos
     - Date range filter
   - Processing options:
     - Standard or high-quality transcription
     - Language settings
   - Refresh settings:
     - Auto-update when new videos are published
     - Manual updates only

4. **Confirmation**
   - Summary of selected content
   - Estimated processing time
   - Usage implications (storage, API calls)

### 4. Path B: Public Channel Flow

1. **Channel Identification**
   - Input field for channel URL, name, or ID
   - Preview with channel avatar and name for confirmation

2. **Legal Acknowledgment**
   - Clear terms explaining:
     - User responsibility for respecting copyright
     - Attribution requirements
     - Potential takedown process if content owners object
     - Checkbox to confirm understanding

3. **Content Selection**
   - Similar to own channel but with limits:
     - Maximum number of videos (to prevent abuse)
     - Focus on educational/informational content
     - Option to exclude monetized content

4. **Attribution Setup**
   - Configure how attribution will appear in widget
   - Preview of attribution display
   - Links back to original content

### 5. Processing Status

For both paths:

1. **Initialization**
   - Create channel record in database
   - Queue videos for processing
   - Show progress indicator

2. **Processing Dashboard**
   - Real-time status updates
   - Videos queued/processed/failed
   - Estimated completion time

3. **Completion**
   - Notification when processing is complete
   - Summary of processed content
   - Next steps for widget creation

## Policy Considerations

### Owned YouTube Channels
- Users have full rights to repurpose their own content
- Standard YouTube API rate limits apply
- Content creators control their own content

### Public YouTube Channels
- Implement proper attribution mechanisms
- Include clear terms of service for widget users
- Provide content takedown process
- Comply with YouTube Terms of Service
- Respect copyright and intellectual property rights
- Consider implementing:
  - Rate limiting for public channels
  - Maximum video limits
  - Content filtering options

## Channel Data Model Refinement

Based on our onboarding flow, we should refine the Channel model to better support both use cases:

```typescript
// Additional fields for Channel model
channelType: 'own' | 'public',              // Distinguish between owned and public channels
youtubeChannelId: string,                   // YouTube's channel ID
youtubeUsername: string | null,             // YouTube's channel username/handle
attributionText: string | null,             // Attribution text for public channels
attributionDisplay: 'footer' | 'responses' | 'both', // Where to display attribution
contentSelectionType: 'all' | 'recent' | 'popular' | 'playlists' | 'individual', // Content selection method
contentSelectionConfig: object,             // Specific selection criteria (video IDs, date ranges, etc.)
processingOptions: {                        // Processing configuration
  highQualityTranscription: boolean,
  autoUpdate: boolean,
  updateFrequency: 'daily' | 'weekly' | 'monthly' | null
},
processingStatus: {                         // Extended processing details
  videosTotal: number,
  videosProcessed: number,
  videosSuccessful: number,
  videosFailed: number,
  lastProcessed: Date | null,
  lastUpdated: Date | null
}
```

## Database Schema Updates

```sql
-- Update channels table with new fields
ALTER TABLE channels ADD COLUMN channel_type VARCHAR(10) NOT NULL DEFAULT 'own' CHECK (channel_type IN ('own', 'public'));
ALTER TABLE channels ADD COLUMN youtube_channel_id VARCHAR(255);
ALTER TABLE channels ADD COLUMN youtube_username VARCHAR(255);
ALTER TABLE channels ADD COLUMN attribution_text TEXT;
ALTER TABLE channels ADD COLUMN attribution_display VARCHAR(10) CHECK (attribution_display IN ('footer', 'responses', 'both'));
ALTER TABLE channels ADD COLUMN content_selection_type VARCHAR(20) NOT NULL DEFAULT 'all' CHECK (content_selection_type IN ('all', 'recent', 'popular', 'playlists', 'individual'));
ALTER TABLE channels ADD COLUMN content_selection_config JSONB DEFAULT '{}';
ALTER TABLE channels ADD COLUMN processing_options JSONB DEFAULT '{"highQualityTranscription": true, "autoUpdate": false, "updateFrequency": null}';
ALTER TABLE channels ADD COLUMN processing_status JSONB DEFAULT '{"videosTotal": 0, "videosProcessed": 0, "videosSuccessful": 0, "videosFailed": 0, "lastProcessed": null, "lastUpdated": null}';
```

## Backend Implementation Requirements

### 1. YouTube API Integration

#### OAuth for Owned Channels
- Register application with Google Developer Console
- Set up OAuth 2.0 credentials
- Implement OAuth flow with appropriate scopes:
  - `https://www.googleapis.com/auth/youtube.readonly`
  - `https://www.googleapis.com/auth/youtube.force-ssl` (for private videos)

#### YouTube Data API v3 Integration
- Channel information retrieval
- Video listing and filtering
- Metadata extraction

### 2. API Endpoints Implementation

```typescript
// Channel controller methods

// Create new channel
export const createChannel = async (req: Request, res: Response) => {
  const { channelType, youtubeChannelId, name, contentSelectionType, processingOptions } = req.body;
  const userId = req.user.id;
  
  try {
    // Create channel record
    const channel = await Channel.create({
      name,
      userId,
      channelType,
      youtubeChannelId,
      contentSelectionType,
      processingOptions
    });
    
    // Queue processing job
    await queueChannelProcessing(channel.id);
    
    return res.status(201).json({
      success: true,
      data: { channel }
    });
  } catch (error) {
    logger.error('Error creating channel:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create channel'
    });
  }
};

// Get channel processing status
export const getChannelProcessingStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  
  try {
    const channel = await Channel.findOne({ where: { id, userId: req.user.id } });
    
    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }
    
    // Get latest processing status
    const processingStatus = channel.processingStatus;
    
    return res.status(200).json({
      success: true,
      data: { processingStatus }
    });
  } catch (error) {
    logger.error('Error getting processing status:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get processing status'
    });
  }
};
```

### 3. Processing Queue System

Implement a background processing system using a queue such as Bull or similar:

```typescript
// Processing queue setup
import Queue from 'bull';
import { transcribeVideo, generateEmbeddings } from './videoProcessing';

const videoProcessingQueue = new Queue('video-processing', {
  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379')
  }
});

// Queue processing function
export const queueChannelProcessing = async (channelId: string) => {
  try {
    // Get channel and video information
    const channel = await Channel.findByPk(channelId);
    
    if (!channel) {
      throw new Error(`Channel not found: ${channelId}`);
    }
    
    // Fetch videos based on content selection criteria
    const videos = await fetchYouTubeVideos(channel);
    
    // Update channel with video count
    await channel.update({
      processingStatus: {
        ...channel.processingStatus,
        videosTotal: videos.length,
        lastProcessed: new Date()
      }
    });
    
    // Queue each video for processing
    for (const video of videos) {
      await videoProcessingQueue.add(
        {
          channelId,
          videoId: video.id,
          youtubeId: video.youtubeId,
          title: video.title,
          highQuality: channel.processingOptions.highQualityTranscription
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 60000 // 1 minute
          }
        }
      );
    }
    
    return videos.length;
  } catch (error) {
    logger.error('Error queueing channel processing:', error);
    throw error;
  }
};

// Process queue items
videoProcessingQueue.process(async (job) => {
  const { channelId, videoId, youtubeId, title, highQuality } = job.data;
  
  try {
    // 1. Download video audio
    const audioPath = await downloadVideoAudio(youtubeId);
    
    // 2. Transcribe audio
    const transcription = await transcribeVideo(audioPath, highQuality);
    
    // 3. Process transcription into chunks
    const chunks = processTranscription(transcription);
    
    // 4. Generate embeddings for chunks
    const embeddedChunks = await generateEmbeddings(chunks);
    
    // 5. Store chunks in vector database
    await storeEmbeddings(channelId, videoId, embeddedChunks);
    
    // 6. Update processing status
    await updateVideoProcessingStatus(channelId, videoId, 'completed');
    
    return { success: true, videoId };
  } catch (error) {
    logger.error(`Error processing video ${videoId}:`, error);
    
    // Update processing status to failed
    await updateVideoProcessingStatus(channelId, videoId, 'failed');
    
    throw error;
  }
});
```

## Frontend Implementation Approach

### Modal Component Design

The modal approach offers several advantages:
- Keeps users in context without navigating away from the dashboard
- Progressive disclosure of only relevant information at each step
- Immediate feedback through real-time status updates
- Flexibility for both quick channel additions and detailed configuration

### State Management

The modal flow requires tracking multiple pieces of state:
- Current step in the wizard
- Selected channel type (own vs public)
- Channel configuration options
- Processing status
- Validation states for forms

### Integration with Dashboard

- Add a "+" button in the channels section of the dashboard
- Trigger the modal when clicked
- Update the dashboard when new channels are created
- Real-time updates for processing status

## Testing Considerations

### API Testing
- Test YouTube API integration with both valid and invalid credentials
- Verify error handling for rate limits and API failures
- Test permission handling for different scopes

### UI Testing
- Verify wizard flow for both channel types
- Test form validation for all input fields
- Test error states and recovery paths
- Verify accessibility of the modal flow

### Processing Testing
- Test queue handling with various video types and lengths
- Verify processing status updates
- Test recovery from failed processing attempts

## Performance Considerations

### YouTube API Rate Limits
- Implement rate limiting to stay within YouTube API quotas
- Use caching for frequently accessed metadata
- Batch requests when possible

### Processing Queue Optimization
- Consider parallelizing processing for multiple videos
- Implement timeout and retry logic for long-running processes
- Add monitoring for queue performance

### Database Optimization
- Add indexes for frequent query patterns:
  ```sql
  CREATE INDEX idx_channels_user_id_status ON channels(user_id, status);
  CREATE INDEX idx_videos_channel_id_processing_status ON videos(channel_id, processing_status);
  ```
- Consider partitioning for large volumes of data

## Security Considerations

### OAuth Token Management
- Securely store OAuth refresh tokens
- Implement token rotation
- Handle expired/revoked tokens gracefully

### User Permissions
- Ensure users can only access their own channels
- Implement proper access controls for all API endpoints
- Validate all user input

### Attribution and Copyright
- Properly store and display attribution information
- Implement takedown request handling
- Respect YouTube Terms of Service