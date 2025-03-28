# Video Processing Status Tracking Implementation Plan

## Overview

This document outlines the implementation plan for tracking the status of video processing jobs using Google Cloud Pub/Sub. The system will enable real-time status updates from GPU processing clusters to the dashboard, providing users with accurate progress information while videos are being processed.

## Architecture

![Status Tracking Architecture](https://mermaid.ink/img/pako:eNqNkstOwzAQRX_F8qoV6o4FUgtCXbEAFQGVgFWVTTxxrDiObI8RReHfseOUPlhhL-05c-_YfnoWVlIQiTBG4qxKrHLeSY91XbdW5EyZkOtNYmhFrU7rq8GW3KhX5uxBNcYawgtjNnASHYzRsHqy9FWiV8XHyZvI0uXWapX-CvuTcDrx7lKlTAVG0_k-aH8WnS9m7hMuEgdzJWxT7KHIdV3LqvfwPUWEt6dCIXiD9IPqGm3g9Gz8E_0NeI-qcOgGIeXZ5PkUIkl7XxWaKnNncT09n82k6HN-YgSFpfkJHdECbw5X8w9nNLsQXnCPVxZ3lMPX3yPY5d0T38H_rPsXeuSvPA)

### Key Components

1. **Processing Cluster**:
   - GPU-powered cluster on GKE that processes videos
   - Publishes status updates to dedicated Pub/Sub topic

2. **Status Update Topic**:
   - Dedicated Pub/Sub topic for processing status messages
   - Separate from the video processing queue topic

3. **Status Subscriber Service**:
   - Component in the main application that subscribes to status updates
   - Updates database with status information
   - Handles different types of status messages (progress, completion, error)

4. **Dashboard API**:
   - Endpoints to retrieve current processing status
   - Support for both individual video status and batch status retrieval

5. **Dashboard UI**:
   - Components for displaying processing progress
   - Status visualization with progress bars and stage indicators

## Implementation Steps

### 1. Create Status Update Topic

```bash
# Create dedicated Pub/Sub topic for status updates
gcloud pubsub topics create video-processing-status
```

### 2. Implement Status Publisher in GPU Processing Cluster

The GPU processing cluster should publish status updates at the following points:

- When processing starts
- At regular intervals during processing (e.g., every 5% progress)
- When reaching key milestones (e.g., download complete, transcription started)
- When processing completes successfully
- When errors occur

```typescript
// Example publisher code for GPU cluster
import { PubSub } from '@google-cloud/pubsub';

class ProcessingStatusReporter {
  private pubSubClient: PubSub;
  private statusTopic: string;
  private videoId: string;
  private jobId: string;

  constructor(videoId: string, jobId: string) {
    this.pubSubClient = new PubSub();
    this.statusTopic = 'video-processing-status';
    this.videoId = videoId;
    this.jobId = jobId;
  }

  async reportStatus(status: 'started' | 'processing' | 'completed' | 'failed', 
                     progress: number, 
                     stage?: string, 
                     error?: string) {
    const message = {
      videoId: this.videoId,
      jobId: this.jobId,
      status,
      progress,
      stage,
      error,
      timestamp: new Date().toISOString()
    };

    try {
      const messageBuffer = Buffer.from(JSON.stringify(message));
      const messageId = await this.pubSubClient
        .topic(this.statusTopic)
        .publishMessage({ data: messageBuffer });
      
      console.log(`Published status update with ID: ${messageId}`);
      return messageId;
    } catch (error) {
      console.error('Error publishing status update:', error);
      throw error;
    }
  }

  // Convenience methods for common status updates
  async reportStart() {
    return this.reportStatus('started', 0, 'initialization');
  }

  async reportProgress(progress: number, stage: string) {
    return this.reportStatus('processing', progress, stage);
  }

  async reportCompletion() {
    return this.reportStatus('completed', 100, 'finished');
  }

  async reportError(error: string) {
    return this.reportStatus('failed', 0, 'error', error);
  }
}

// Usage in processing code
async function processVideo(videoId: string, jobId: string) {
  const reporter = new ProcessingStatusReporter(videoId, jobId);
  
  try {
    await reporter.reportStart();
    
    // Download video
    await reporter.reportProgress(10, 'downloading');
    // ... download code ...
    
    // Extract audio
    await reporter.reportProgress(20, 'extracting_audio');
    // ... extraction code ...
    
    // Transcribe audio
    await reporter.reportProgress(30, 'transcribing');
    // ... transcription code ...
    // Report progress during transcription
    await reporter.reportProgress(50, 'transcribing');
    await reporter.reportProgress(70, 'transcribing');
    
    // Generate embeddings
    await reporter.reportProgress(80, 'generating_embeddings');
    // ... embedding generation code ...
    
    // Store results
    await reporter.reportProgress(90, 'storing_results');
    // ... storage code ...
    
    // Complete processing
    await reporter.reportCompletion();
    
  } catch (error) {
    await reporter.reportError(error.message);
    // Handle error appropriately
  }
}
```

### 3. Implement Status Subscriber Service

```typescript
// src/services/statusSubscriber.ts
import { PubSub, Subscription, Message } from '@google-cloud/pubsub';
import { logger } from '../config/logger';
import Video from '../db/models/Video';

interface StatusMessage {
  videoId: string;
  jobId: string;
  status: 'started' | 'processing' | 'completed' | 'failed';
  progress: number;
  stage?: string;
  error?: string;
  timestamp: string;
}

export class StatusSubscriberService {
  private pubSubClient: PubSub;
  private statusTopic: string;
  private subscription: Subscription;
  private isRunning: boolean = false;

  constructor() {
    this.pubSubClient = new PubSub();
    this.statusTopic = 'video-processing-status';
    this.subscription = this.pubSubClient.subscription(`${this.statusTopic}-subscription`);
  }

  /**
   * Start listening for status updates
   */
  async start() {
    if (this.isRunning) return;
    
    try {
      logger.info('Starting video processing status subscriber');
      
      // Ensure subscription exists
      try {
        const [exists] = await this.subscription.exists();
        if (!exists) {
          [this.subscription] = await this.pubSubClient
            .topic(this.statusTopic)
            .createSubscription(`${this.statusTopic}-subscription`);
        }
      } catch (error) {
        logger.error('Error checking/creating subscription:', error);
        throw error;
      }
      
      // Set up message handler
      this.subscription.on('message', this.handleMessage.bind(this));
      this.subscription.on('error', (error) => {
        logger.error('Subscription error:', error);
      });
      
      this.isRunning = true;
      logger.info('Video processing status subscriber started successfully');
    } catch (error) {
      logger.error('Failed to start status subscriber:', error);
      throw error;
    }
  }
  
  /**
   * Stop listening for status updates
   */
  async stop() {
    if (!this.isRunning) return;
    
    try {
      logger.info('Stopping video processing status subscriber');
      await this.subscription.close();
      this.isRunning = false;
      logger.info('Video processing status subscriber stopped successfully');
    } catch (error) {
      logger.error('Error stopping status subscriber:', error);
      throw error;
    }
  }
  
  /**
   * Handle incoming status messages
   */
  private async handleMessage(message: Message) {
    try {
      const data = JSON.parse(Buffer.from(message.data).toString());
      const statusUpdate = data as StatusMessage;
      
      logger.info(`Received status update for video ${statusUpdate.videoId}:`, statusUpdate);
      
      // Update video in database
      await this.updateVideoStatus(statusUpdate);
      
      // Acknowledge the message
      message.ack();
    } catch (error) {
      logger.error('Error processing status message:', error);
      // Negative acknowledgment - message will be redelivered
      message.nack();
    }
  }
  
  /**
   * Update video status in database
   */
  private async updateVideoStatus(statusUpdate: StatusMessage) {
    try {
      const { videoId, status, progress, stage, error } = statusUpdate;
      
      // Find video by ID
      const video = await Video.findByPk(videoId);
      
      if (!video) {
        logger.warn(`Video not found for status update: ${videoId}`);
        return;
      }
      
      // Map status to database enum
      let processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
      switch (status) {
        case 'started':
          processingStatus = 'processing';
          break;
        case 'processing':
          processingStatus = 'processing';
          break;
        case 'completed':
          processingStatus = 'completed';
          break;
        case 'failed':
          processingStatus = 'failed';
          break;
        default:
          processingStatus = 'processing';
      }
      
      // Update video
      await video.update({
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
export const statusSubscriberService = new StatusSubscriberService();
```

### 4. Update Video Model

We need to extend the Video model to store additional status information:

```typescript
// Update src/db/models/Video.ts
export interface VideoAttributes {
  // ... existing attributes
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  processingProgress: number;
  processingStage?: string;  // New attribute
  processingError?: string;
  processingLastUpdated?: Date;  // New attribute
}
```

```sql
-- Required database schema update
ALTER TABLE videos 
ADD COLUMN processing_stage VARCHAR(100),
ADD COLUMN processing_last_updated TIMESTAMP;
```

### 5. Initialize Status Subscriber on App Startup

```typescript
// Add to src/app.ts
import { statusSubscriberService } from './services/statusSubscriber';

// After database connection is established
if (process.env.NODE_ENV !== 'test') {
  testDbConnection()
    .then(async () => {
      // Start the server
      app.listen(PORT, () => {
        logger.info(`Server running on port ${PORT}`);
      });
      
      // Start the status subscriber
      try {
        await statusSubscriberService.start();
        logger.info('Video processing status subscriber started');
      } catch (error) {
        logger.error('Failed to start status subscriber:', error);
        // Continue application execution even if subscriber fails
      }
    })
    .catch(/* existing error handling */);
}
```

### 6. Enhance Video Controller with Status Endpoints

```typescript
// Add to src/api/controllers/videoController.ts

/**
 * Get detailed processing status for a video
 * @route GET /api/videos/:id/status-detailed
 */
export const getDetailedVideoProcessingStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !req.user.userId) {
      throw new AppError('Unauthorized', 401);
    }
    
    const { id } = req.params;
    
    // Get user from our database
    const user = await userService.getUserByAuth0Id(req.user.userId);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Find the video with additional status fields
    const video = await Video.findByPk(id, {
      include: [{
        model: Channel,
        as: 'channel',
        attributes: ['id', 'userId'],
      }],
      attributes: [
        'id', 
        'title',
        'processingStatus',
        'processingProgress',
        'processingStage',
        'processingError',
        'processingLastUpdated'
      ]
    });
    
    if (!video) {
      throw new AppError('Video not found', 404);
    }
    
    // Check if the video belongs to a channel owned by the user
    if (!video.channel || video.channel.userId !== user.id) {
      throw new AppError('You do not have permission to access this video', 403);
    }
    
    // Calculate estimated time remaining (if applicable)
    let estimatedTimeRemaining = null;
    if (video.processingStatus === 'processing' && 
        video.processingProgress > 0 && 
        video.processingProgress < 100 && 
        video.processingLastUpdated) {
      
      const elapsedTime = Date.now() - video.processingLastUpdated.getTime();
      const progressPerMs = video.processingProgress / elapsedTime;
      const remainingProgress = 100 - video.processingProgress;
      
      if (progressPerMs > 0) {
        const estimatedMs = remainingProgress / progressPerMs;
        estimatedTimeRemaining = Math.round(estimatedMs / 1000); // Convert to seconds
      }
    }
    
    return res.status(200).json({
      status: 'success',
      data: {
        video: {
          id: video.id,
          title: video.title,
          processingStatus: video.processingStatus,
          processingProgress: video.processingProgress,
          processingStage: video.processingStage,
          processingError: video.processingError,
          processingLastUpdated: video.processingLastUpdated,
          estimatedTimeRemaining
        }
      }
    });
  } catch (error) {
    logger.error('Get detailed video processing status error:', error);
    next(error);
  }
};
```

### 7. Add Routes for Status Endpoints

```typescript
// Update src/api/routes/videoRoutes.ts
import {
  // ... existing imports
  getDetailedVideoProcessingStatus
} from '../controllers/videoController';

// ... existing routes

/**
 * @route   GET /api/videos/:id/status-detailed
 * @desc    Get detailed processing status for a video
 * @access  Private
 */
router.get('/:id/status-detailed', validateAuth0Token, requireAuth, getDetailedVideoProcessingStatus);
```

### 8. Implement UI Components for Status Display

```tsx
// src/components/video-processing-status.tsx
import React, { useState, useEffect } from 'react';
import { authenticatedFetch } from '../utils/auth';

interface VideoStatus {
  id: string;
  title: string;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  processingProgress: number;
  processingStage?: string;
  processingError?: string;
  processingLastUpdated?: string;
  estimatedTimeRemaining?: number;
}

interface VideoProcessingStatusProps {
  videoId: string;
  pollingInterval?: number; // in ms, default: 5000
  onStatusChange?: (status: VideoStatus) => void;
}

export const VideoProcessingStatus: React.FC<VideoProcessingStatusProps> = ({ 
  videoId, 
  pollingInterval = 5000,
  onStatusChange 
}) => {
  const [status, setStatus] = useState<VideoStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    let mounted = true;
    
    const fetchStatus = async () => {
      try {
        setLoading(true);
        const response = await authenticatedFetch(`/api/videos/${videoId}/status-detailed`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch video status: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (mounted) {
          setStatus(data.data.video);
          setError(null);
          
          if (onStatusChange) {
            onStatusChange(data.data.video);
          }
          
          // Stop polling if processing is complete or failed
          if (data.data.video.processingStatus === 'completed' || 
              data.data.video.processingStatus === 'failed') {
            clearInterval(intervalId);
          }
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || 'Failed to fetch video status');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    
    // Fetch initial status
    fetchStatus();
    
    // Set up polling
    intervalId = setInterval(fetchStatus, pollingInterval);
    
    // Clean up
    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [videoId, pollingInterval, onStatusChange]);
  
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
  
  // Helper to get stage label
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
  
  if (loading && !status) {
    return <div className="flex items-center justify-center p-4">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      <span className="ml-3">Loading status...</span>
    </div>;
  }
  
  if (error) {
    return <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
      Error: {error}
    </div>;
  }
  
  if (!status) {
    return <div>No status information available</div>;
  }
  
  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900">
          Processing Status: {status.title}
        </h3>
      </div>
      
      <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
        <dl className="sm:divide-y sm:divide-gray-200">
          <div className="py-3 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Status</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
              {status.processingStatus === 'pending' && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  Pending
                </span>
              )}
              {status.processingStatus === 'processing' && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Processing
                </span>
              )}
              {status.processingStatus === 'completed' && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Completed
                </span>
              )}
              {status.processingStatus === 'failed' && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  Failed
                </span>
              )}
            </dd>
          </div>
          
          {status.processingStatus === 'processing' && (
            <>
              <div className="py-3 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Progress</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  <div className="relative pt-1">
                    <div className="flex mb-2 items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold inline-block text-blue-600">
                          {Math.round(status.processingProgress)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-xs font-semibold inline-block text-blue-600">
                          {formatTimeRemaining(status.estimatedTimeRemaining)} remaining
                        </span>
                      </div>
                    </div>
                    <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-200">
                      <div 
                        style={{ width: `${status.processingProgress}%` }} 
                        className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"
                      ></div>
                    </div>
                  </div>
                </dd>
              </div>
              
              <div className="py-3 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Current Stage</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {getStageName(status.processingStage)}
                </dd>
              </div>
            </>
          )}
          
          {status.processingStatus === 'failed' && status.processingError && (
            <div className="py-3 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Error</dt>
              <dd className="mt-1 text-sm text-red-600 sm:mt-0 sm:col-span-2">
                {status.processingError}
              </dd>
            </div>
          )}
          
          {status.processingLastUpdated && (
            <div className="py-3 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {new Date(status.processingLastUpdated).toLocaleString()}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
};
```

## Deployment Considerations

### 1. Subscription Management

In production, consider creating a dedicated subscription for each application instance (using a unique subscription ID) to allow for proper load balancing when scaling horizontally.

### 2. Error Handling and Retries

Implement proper error handling and retries in both the publisher and subscriber:

- For the publisher: Cache status updates locally and retry publishing if Pub/Sub is temporarily unavailable
- For the subscriber: Use exponential backoff for retries and implement dead-letter queues for unprocessable messages

### 3. Security

Ensure that the Pub/Sub topics and subscriptions have proper IAM controls:

- The GPU cluster should have publish-only permissions to the status topic
- The main application should have subscribe-only permissions to the status topic
- Use service accounts with minimal required permissions

### 4. Monitoring

Set up monitoring for the status tracking system:

- Create alerts for subscription lag or backlog
- Monitor for error rates in status processing
- Set up dashboard for system health visualization

### 5. Testing

Implement thorough testing:

- Unit tests for the StatusSubscriberService
- Integration tests for the end-to-end status update flow
- Load tests to ensure the system can handle high message volumes

## Scaling Considerations

1. **Message Volume**: The Pub/Sub implementation can handle high volumes of status updates, but consider batching status updates for efficiency

2. **Database Load**: Status updates will increase database write load. Consider:
   - Using database connection pooling
   - Implementing rate limiting if necessary
   - Adding database sharding for very high loads

3. **Client Connections**: For polling from many clients, consider:
   - Implementing staggered polling intervals
   - Using client-side caching to reduce load
   - Adding API rate limiting

## Migration Plan

1. **Database Schema Update**:
   - Add new columns to the videos table for the additional status fields
   - Update the Video model with the new fields

2. **Service Deployment**:
   - Deploy the StatusSubscriberService
   - Create the Pub/Sub topic and subscription

3. **API Updates**:
   - Deploy the enhanced video controller with new status endpoints
   - Add new routes to the router

4. **Frontend Updates**:
   - Implement the VideoProcessingStatus component
   - Update existing video-related pages to display status information

5. **GPU Cluster Updates**:
   - Implement the status reporter in the GPU processing code
   - Update processing pipeline to report status at appropriate intervals

## Appendix: Status Message Schema

```typescript
interface StatusMessage {
  videoId: string;          // Database ID of the video
  jobId: string;            // Unique job ID for this processing run
  status: string;           // 'started', 'processing', 'completed', 'failed'
  progress: number;         // Processing progress (0-100)
  stage?: string;           // Current processing stage
  error?: string;           // Error message (if status is 'failed')
  timestamp: string;        // ISO timestamp of when this update was created
  metadata?: {              // Optional additional metadata
    duration?: number;      // Video duration in seconds
    chunkCount?: number;    // Number of chunks processed
    totalChunks?: number;   // Total number of chunks to process
    [key: string]: any;     // Other metadata fields
  }
}
```

---

This implementation plan provides a robust foundation for tracking video processing status using Pub/Sub. By following this approach, you'll have a scalable system that can provide real-time updates to users while maintaining separation of concerns between your GPU processing cluster and your main application.