# Video Processing Status UI Updates Implementation Plan

## Overview

This document outlines the implementation plan for enhancing the UI to display real-time video processing status updates. The goal is to improve user experience by providing visual feedback on processing progress without relying on polling.

## Current State

- Status updates are fetched via polling every 10 seconds
- Basic status information is displayed (status, progress percentage, errors)
- Limited visual feedback during processing
- Videos being processed can still be selected/deselected
- No real-time updates from Pub/Sub

## Desired Behavior

- Real-time status updates based on Pub/Sub messages
- Enhanced visual differentiation for videos being processed
- Disabled selection for videos in processing
- Visual indication of current processing stage
- Estimated time remaining display
- Smooth progress bar updates

## Implementation Steps

### 1. Create Real-Time Status Update Context and Provider

```typescript
// src/contexts/VideoProcessingContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface VideoProcessingContextType {
  // Videos currently being processed with their detailed status
  processingVideos: Record<string, VideoProcessingStatus>;
  // Function to register a video for processing (called after API response)
  registerProcessingVideo: (videoId: string, initialStatus: VideoProcessingStatus) => void;
  // Function to update a video's processing status (called when status message received)
  updateProcessingStatus: (videoId: string, status: Partial<VideoProcessingStatus>) => void;
}

interface VideoProcessingStatus {
  videoId: string;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  processingProgress: number;
  processingStage?: string;
  processingError?: string;
  processingLastUpdated?: Date;
  estimatedTimeRemaining?: number;
}

const VideoProcessingContext = createContext<VideoProcessingContextType | undefined>(undefined);

export const VideoProcessingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [processingVideos, setProcessingVideos] = useState<Record<string, VideoProcessingStatus>>({});

  // Function to register a video that's being processed
  const registerProcessingVideo = (videoId: string, initialStatus: VideoProcessingStatus) => {
    setProcessingVideos(prev => ({
      ...prev,
      [videoId]: initialStatus
    }));
  };

  // Function to update the status of a processing video
  const updateProcessingStatus = (videoId: string, status: Partial<VideoProcessingStatus>) => {
    setProcessingVideos(prev => {
      if (!prev[videoId]) return prev;
      
      return {
        ...prev,
        [videoId]: {
          ...prev[videoId],
          ...status,
          // Automatically update last update time
          processingLastUpdated: new Date()
        }
      };
    });
  };

  // Setup WebSocket for real-time status updates
  useEffect(() => {
    // Create WebSocket connection
    const socket = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/status-updates`);
    
    // Connection opened
    socket.addEventListener('open', (event) => {
      console.log('Connected to status updates WebSocket');
    });
    
    // Listen for status update messages
    socket.addEventListener('message', (event) => {
      try {
        const statusUpdate = JSON.parse(event.data);
        if (statusUpdate && statusUpdate.videoId) {
          updateProcessingStatus(statusUpdate.videoId, statusUpdate);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    // Connection closed
    socket.addEventListener('close', (event) => {
      console.log('Disconnected from status updates WebSocket');
    });
    
    // Clean up on unmount
    return () => {
      socket.close();
    };
  }, []);

  // Value to be provided to consuming components
  const value = {
    processingVideos,
    registerProcessingVideo,
    updateProcessingStatus
  };

  return (
    <VideoProcessingContext.Provider value={value}>
      {children}
    </VideoProcessingContext.Provider>
  );
};

// Custom hook to use the video processing context
export const useVideoProcessing = () => {
  const context = useContext(VideoProcessingContext);
  if (context === undefined) {
    throw new Error('useVideoProcessing must be used within a VideoProcessingProvider');
  }
  return context;
};
```

### 2. Create WebSocket API Endpoint for Status Updates

```typescript
// src/api/controllers/statusController.ts
import { Request, Response } from 'express';
import WebSocket from 'ws';
import { Server } from 'http';
import { logger } from '../../config/logger';
import { videoProcStatusSubscriber } from '../../services/processing/videoProcStatusSubscriber';

// Store WebSocket connections
let connections: WebSocket[] = [];

// Function to set up WebSocket server
export const setupWebSocketServer = (server: Server) => {
  const wss = new WebSocket.Server({ noServer: true });
  
  // Handle WebSocket connection
  wss.on('connection', (ws: WebSocket) => {
    // Add new connection to array
    connections.push(ws);
    
    logger.info(`New WebSocket connection established. Total connections: ${connections.length}`);
    
    // Handle disconnection
    ws.on('close', () => {
      connections = connections.filter(conn => conn !== ws);
      logger.info(`WebSocket connection closed. Remaining connections: ${connections.length}`);
    });
  });
  
  // Handle upgrade request
  server.on('upgrade', (request, socket, head) => {
    // Check if the request is for our WebSocket endpoint
    if (request.url === '/api/status-updates') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });
  
  // Set up event listener for status updates from videoProcStatusSubscriber
  videoProcStatusSubscriber.on('statusUpdate', (statusUpdate) => {
    // Broadcast status update to all connected WebSocket clients
    connections.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(statusUpdate));
      }
    });
  });
  
  logger.info('WebSocket server for status updates initialized');
};
```

### 3. Modify Video Processing Status Subscriber to Emit Events

```typescript
// src/services/processing/videoProcStatusSubscriber.ts
import { PubSub, Subscription, Message } from '@google-cloud/pubsub';
import { EventEmitter } from 'events';
import { logger } from '../../config/logger';
import Video from '../../db/models/Video';
import { config } from '../../config/environment';

// Update the class to extend EventEmitter
export class VideoProcStatusSubscriber extends EventEmitter {
  // ... existing code ...
  
  /**
   * Update video status in database and emit event
   */
  private async updateVideoStatus(statusUpdate: StatusMessage) {
    try {
      // ... existing code ...
      
      // After updating database, emit event for WebSocket to broadcast
      this.emit('statusUpdate', {
        videoId,
        processingStatus,
        processingProgress: progress,
        processingStage: stage || null,
        processingError: error || null,
        processingLastUpdated: new Date()
      });
      
      logger.info(`Updated status for video ${videoId} to ${processingStatus} (${progress}%)`);
    } catch (error) {
      logger.error(`Error updating video status in database:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const videoProcStatusSubscriber = new VideoProcStatusSubscriber();
```

### 4. Initialize WebSocket Server in App.ts

```typescript
// src/app.ts
import { setupWebSocketServer } from './api/controllers/statusController';

// ... existing imports and code ...

// Create HTTP server instance explicitly
const server = require('http').createServer(app);

// ... existing code ...

if (process.env.NODE_ENV !== 'test') {
  testDbConnection()
    .then(async () => {
      // Start the server after successful database connection
      server.listen(PORT, () => {
        logger.info(`Server running on port ${PORT}`);
        logger.info(`Auth routes enabled - Auth0 integration active`);
      });
      
      // Set up WebSocket server for status updates
      setupWebSocketServer(server);
      
      // Start the video processing status subscriber
      try {
        await videoProcStatusSubscriber.start();
        logger.info('Video processing status subscriber started');
      } catch (error) {
        logger.error('Failed to start video processing status subscriber:', error);
      }
    })
    .catch(/* ... existing error handling ... */);
}
```

### 5. Create Video Processing Status Component

```typescript
// src/components/video-processing-status.tsx
import React, { useEffect, useState } from 'react';
import { Badge } from './badge';
import { Text } from './text';
import { useVideoProcessing } from '../contexts/VideoProcessingContext';

interface VideoProcessingStatusProps {
  videoId: string;
  initialStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  initialProgress?: number;
  initialStage?: string;
  className?: string;
}

export const VideoProcessingStatus: React.FC<VideoProcessingStatusProps> = ({
  videoId,
  initialStatus = 'pending',
  initialProgress = 0,
  initialStage,
  className = '',
}) => {
  const { processingVideos } = useVideoProcessing();
  
  // Helper to format time remaining
  const formatTimeRemaining = (seconds?: number) => {
    if (!seconds) return 'Calculating...';
    
    if (seconds < 60) {
      return `${seconds} seconds`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
  };
  
  // Helper to get stage name
  const getStageName = (stage?: string) => {
    if (!stage) return 'Processing';
    
    const stageMap: Record<string, string> = {
      'initialization': 'Initializing',
      'downloading': 'Downloading Video',
      'extracting_audio': 'Extracting Audio',
      'transcribing': 'Transcribing Audio',
      'generating_embeddings': 'Generating Embeddings',
      'storing_results': 'Storing Results',
      'finished': 'Processing Complete',
      'error': 'Error'
    };
    
    return stageMap[stage] || stage;
  };
  
  // Get the current status from context or use initial props
  const videoStatus = processingVideos[videoId] || {
    processingStatus: initialStatus,
    processingProgress: initialProgress,
    processingStage: initialStage,
  };
  
  const { 
    processingStatus, 
    processingProgress, 
    processingStage, 
    processingError,
    estimatedTimeRemaining 
  } = videoStatus;
  
  return (
    <div className={`flex flex-col ${className}`}>
      <Badge 
        color={
          processingStatus === 'completed' ? 'green' : 
          processingStatus === 'processing' ? 'blue' : 
          processingStatus === 'failed' ? 'red' : 'yellow'
        }
      >
        {processingStatus}
      </Badge>
      
      {processingStatus === 'processing' && (
        <div className="mt-1">
          <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-500" 
              style={{ width: `${processingProgress || 0}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>{processingProgress || 0}%</span>
            {processingStage && (
              <span className="text-blue-500">{getStageName(processingStage)}</span>
            )}
          </div>
          {estimatedTimeRemaining !== undefined && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatTimeRemaining(estimatedTimeRemaining)} remaining
            </span>
          )}
        </div>
      )}
      
      {processingStatus === 'failed' && processingError && (
        <div className="mt-1">
          <span className="text-xs text-red-500 truncate block max-w-xs" title={processingError}>
            {processingError}
          </span>
        </div>
      )}
    </div>
  );
};
```

### 6. Update Channel Detail Page to Use New Components

```typescript
// Updates to src/views/channels/detail.tsx

// Add imports
import { VideoProcessingProvider, useVideoProcessing } from '../../contexts/VideoProcessingContext';
import { VideoProcessingStatus } from '../../components/video-processing-status';

// Wrap the component with provider
const ChannelDetailPageWithContext: React.FC<ChannelDetailPageProps> = (props) => {
  return (
    <VideoProcessingProvider>
      <ChannelDetailPage {...props} />
    </VideoProcessingProvider>
  );
};

// Inside the ChannelDetailPage component
const ChannelDetailPage: React.FC<ChannelDetailPageProps> = ({ authenticatedFetch, user: initialUser }) => {
  // ... existing code ...
  
  // Add context
  const { processingVideos, registerProcessingVideo } = useVideoProcessing();
  
  // Update the processSelectedVideos function to register videos
  const handleProcessSelectedVideos = async () => {
    try {
      // ... existing code ...
      
      const data = await response.json();
      logger.debug('Processing started successfully', data);
      
      // Register started videos in the context
      if (data.data.videos) {
        data.data.videos.forEach((video: any) => {
          registerProcessingVideo(video.id, {
            videoId: video.id,
            processingStatus: 'processing',
            processingProgress: 0,
            processingStage: 'initialization'
          });
        });
      }
      
      alert(`Processing started for ${data.data.processingCount} videos. This may take some time.`);
      
      // After processing is initiated, refresh the channel details
      await fetchChannelDetails();
    } catch (error) {
      // ... existing error handling ...
    }
  };
  
  // Remove the polling effect since we'll use WebSockets now
  // Delete the useEffect that sets up polling (lines 423-438)
  
  // Update the table row rendering to disable selection and add background color
  // Replace the existing table row with this:
  {paginatedVideos.map((video) => {
    const isProcessing = video.processingStatus === 'processing' || 
                         processingVideos[video.id]?.processingStatus === 'processing';
    
    return (
      <TableRow 
        key={video.id}
        className={isProcessing ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
      >
        <TableCell>
          <Checkbox
            checked={selectedVideos.has(video.id)}
            onChange={() => handleVideoSelection(video.id)}
            disabled={isProcessing}
          />
        </TableCell>
        {/* ... other cells ... */}
        <TableCell>
          <VideoProcessingStatus 
            videoId={video.id}
            initialStatus={video.processingStatus}
            initialProgress={video.processingProgress}
            initialStage={video.processingStage}
          />
        </TableCell>
        {/* ... other cells ... */}
      </TableRow>
    );
  })}
  
  // ... rest of the existing code ...
};

// Export the wrapped component
export default ChannelDetailPageWithContext;
```

### 7. Add Missing Types and WebSocket Client

```typescript
// Add new types to src/types/api.ts
export interface VideoProcessingStatus {
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  processingProgress: number;
  processingStage?: string;
  processingError?: string | null;
  processingLastUpdated?: string;
  estimatedTimeRemaining?: number;
}

// Add the new fields to the existing VideoResponse
export interface VideoResponse {
  // ... existing fields ...
  processingStage?: string;
  processingLastUpdated?: string;
  // ... existing fields ...
}
```

### 8. Install WebSocket Packages

```bash
npm install ws @types/ws
```

## Implementation Order

1. Install WebSocket packages
2. Create the WebSocket controller
3. Modify the videoProcStatusSubscriber to emit events
4. Update app.ts to initialize the WebSocket server 
5. Create the VideoProcessingContext
6. Create the VideoProcessingStatus component
7. Update the Channel Detail page to use the new components
8. Update the types and interfaces

## Testing Plan

1. Verify WebSocket connections are established when visiting the Channel Detail page
2. Confirm that videos being processed have the correct visual treatment
   - Background color change
   - Disabled checkbox
   - Processing status indicator
3. Test real-time updates by processing a video and verifying status updates appear without refresh
4. Confirm that stage information is displayed
5. Test time remaining estimation
6. Verify error status display 
7. Check that completed videos return to normal state
8. Test multiple videos processing simultaneously

## Rollout Strategy

1. Implement and test in a development environment
2. Deploy to staging for final review
3. Deploy to production
4. Monitor WebSocket connections and performance
5. Add analytics to track user engagement with the new interface

## Potential Enhancements for Future

1. Add sound notification when processing completes
2. Allow users to filter videos by processing status
3. Add detailed processing logs viewable in a modal
4. Create a dedicated processing queue management page
5. Add the ability to pause/resume processing
6. Implement batch processing priority settings