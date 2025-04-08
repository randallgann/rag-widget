# Video Processing Status Architecture

This document explains how the RAG Widget application determines, tracks, and updates the processing status of videos throughout the system, from database persistence to real-time UI updates.

## Overview

The video processing status system uses a multi-layered approach to ensure status information is:

1. Accurately tracked in the database
2. Updated in real-time via WebSockets
3. Persisted across page refreshes
4. Properly cleaned up when stale
5. Verified on application startup

## Status Flow Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│ Video Processor │────▶│  Google Cloud   │────▶│ videoProcStatus │
│    Service      │     │    Pub/Sub      │     │   Subscriber    │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  React Client   │◀────│    WebSocket    │◀────│  PostgreSQL DB  │
│      UI         │     │     Server      │     │   (Videos)      │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Components and Responsibilities

### 1. Database Storage (`/src/db/models/Video.ts`)

The `Video` model includes the following status-related fields:

```typescript
processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
processingProgress: number;
processingStage?: string;
processingError?: string | null;
processingLastUpdated?: Date;
```

These fields provide persistent storage of the processing state.

### 2. Status Subscriber (`/src/services/processing/videoProcStatusSubscriber.ts`)

This service:
- Connects to Google Cloud Pub/Sub topic `video-processing-status`
- Listens for messages containing status updates
- Updates the database when new status information is received
- Emits events for WebSocket broadcasting
- Maps Pub/Sub status messages to database fields

Key implementation:

```typescript
private async handleMessage(message: Message) {
  try {
    const data = JSON.parse(Buffer.from(message.data).toString());
    const statusUpdate = data as StatusMessage;
    
    // Update video in database
    await this.updateVideoStatus(statusUpdate);
    
    // Acknowledge the message
    message.ack();
  } catch (error: any) {
    logger.error('Error processing status message:', error);
    message.nack();
  }
}

private async updateVideoStatus(statusUpdate: StatusMessage) {
  // Find video by ID and update status
  const video = await Video.findByPk(statusUpdate.videoId);
  
  if (!video) return;
  
  // Map status message to database fields
  await video.update({
    processingStatus,  // mapped from statusUpdate.status
    processingProgress: statusUpdate.progress,
    processingError: statusUpdate.error || null,
    processingStage: statusUpdate.stage,
    processingLastUpdated: new Date()
  });
  
  // Emit event for WebSocket to broadcast
  this.emit('statusUpdate', {
    videoId: statusUpdate.videoId,
    processingStatus,
    processingProgress: statusUpdate.progress,
    // Other fields...
  });
}
```

### 3. WebSocket Server (`/src/api/controllers/statusController.ts`)

The WebSocket server:
- Creates a WebSocket endpoint at `/api/status-updates`
- Listens for `statusUpdate` events from the subscriber
- Broadcasts updates to all connected clients
- Handles client connections and disconnections

```typescript
videoProcStatusSubscriber.on('statusUpdate', (statusUpdate) => {
  // Broadcast status update to all connected WebSocket clients
  const payload = JSON.stringify(statusUpdate);
  
  connections.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
});
```

### 4. Client-side Context (`/src/contexts/VideoProcessingContext.tsx`)

The React context:
- Maintains the current processing state of videos
- Receives real-time updates via WebSocket
- Persists state to localStorage for resilience
- Provides functions to register, update, and clear processing videos
- Automatically removes videos that complete processing

Key implementation:

```typescript
// Update processing state
const updateProcessingStatus = (videoId: string, status: Partial<VideoProcessingStatus>) => {
  setProcessingVideos(prev => {
    // If status is completed or failed, remove from active processing
    if (status.processingStatus === 'completed' || status.processingStatus === 'failed') {
      const newState = { ...prev };
      delete newState[videoId];
      return newState;
    }
    
    return {
      ...prev,
      [videoId]: {
        ...prev[videoId],
        ...status,
        processingLastUpdated: status.processingLastUpdated || new Date()
      }
    };
  });
};
```

### 5. UI Status Verification (`/src/views/channels/detail.tsx`)

The UI implements multiple safeguards:

1. **Initial Verification**:
```typescript
useEffect(() => {
  const checkAndResetStaleProcessingVideos = async () => {
    // Identify videos that appear to be processing
    const processingVideoIds = videos
      .filter(video => video.processingStatus === 'processing')
      .map(video => video.id);
    
    // Check their actual status from the server
    await checkProcessingStatus(processingVideoIds);
  };
  
  if (videos.length > 0 && !loading) {
    checkAndResetStaleProcessingVideos();
  }
}, [videos, loading]);
```

2. **Status Determination in UI**:
```typescript
// For determining if a video is currently processing
const isProcessing = video.processingStatus === 'processing' || 
                   processingVideos[video.id]?.processingStatus === 'processing';
```

3. **Stale Status Cleanup**:
```typescript
// If a video shows as not processing in DB but is in context, remove it
const staleProcessingIds = data.data.videos
  .filter((v: any) => v.processingStatus !== 'processing')
  .map((v: any) => v.id);
  
if (staleProcessingIds.length > 0) {
  clearStaleProcessingVideos(staleProcessingIds);
}
```

### 6. Reset Processing Capability

The application provides an API endpoint to reset processing status:

```typescript
// Reset video processing status
export const resetVideoProcessing = async (req: Request, res: Response, next: NextFunction) => {
  // Validation and permission checks...
  
  // Only allow resetting videos that are in completed or failed state
  if (video.processingStatus !== 'completed' && video.processingStatus !== 'failed') {
    throw new AppError('Cannot reset video in current state', 400);
  }
  
  // Update the video to reset processing state
  await video.update({
    processingStatus: 'pending',
    processingProgress: 0,
    processingError: null,
    processingStage: null,
    processingLastUpdated: null
  });
}
```

## Time-Based Status Management

The system includes time-based staleness detection:

```typescript
const clearStaleProcessingVideos = (videoIds?: string[]) => {
  if (videoIds) {
    // Clear specific videos
  } else {
    // If no IDs provided, clear videos that haven't been updated recently
    const staleThreshold = 10 * 60 * 1000; // 10 minutes in milliseconds
    const now = new Date().getTime();
    
    setProcessingVideos(prev => {
      const newState = { ...prev };
      Object.entries(newState).forEach(([id, status]) => {
        if (!status.processingLastUpdated || 
            (now - status.processingLastUpdated.getTime() > staleThreshold)) {
          delete newState[id];
        }
      });
      return newState;
    });
  }
};
```

## Conclusion

The video processing status system is designed to be robust, resilient to application restarts, and reflective of the true state of video processing. The multi-layered approach ensures that:

1. Status is accurately persisted in the database
2. Real-time updates are delivered via WebSockets
3. UI state is preserved across page refreshes
4. Stale processing states are automatically cleaned up
5. Status is verified when the application starts
6. Users can manually reset videos that have completed or failed processing

This architecture provides a reliable way to track the processing status of videos throughout their lifecycle, from selection through processing to completion.