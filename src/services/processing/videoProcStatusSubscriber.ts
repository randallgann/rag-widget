import { PubSub, Subscription, Message } from '@google-cloud/pubsub';
import { EventEmitter } from 'events';
import { logger } from '../../config/logger';
import Video from '../../db/models/Video';
import { config } from '../../config/environment';

/**
 * Interface for status messages received from the processing cluster
 */
interface StatusMessage {
  videoId: string;
  jobId: string;
  status: 'started' | 'processing' | 'completed' | 'failed';
  progress: number;
  stage?: string;
  error?: string;
  timestamp: string;
}

/**
 * Service for subscribing to video processing status updates
 */
export class VideoProcStatusSubscriber extends EventEmitter {
  private pubSubClient: PubSub;
  private statusTopic: string;
  private subscription: Subscription;
  private isRunning: boolean = false;

  constructor() {
    super(); // Initialize EventEmitter
    this.pubSubClient = new PubSub({
      projectId: config.gcp.projectId,
    });
    this.statusTopic = config.gcp.pubsub.videoProcessingStatusTopic;
    
    // Extract just the topic name without full path if it contains 'projects/'
    const topicName = this.statusTopic.includes('projects/') 
      ? this.statusTopic.split('/').pop() 
      : this.statusTopic;
    
    // Create subscription with simple name
    this.subscription = this.pubSubClient.subscription(`${topicName}-subscription`);
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
          // Extract just the topic name without full path if it contains 'projects/'
          const topicName = this.statusTopic.includes('projects/') 
            ? this.statusTopic.split('/').pop() 
            : this.statusTopic;
            
          logger.info(`Creating subscription ${topicName}-subscription`);
          
          // Get a reference to the topic using the full topic path
          const topic = this.pubSubClient.topic(this.statusTopic);
          
          // Create subscription with simple name
          [this.subscription] = await topic.createSubscription(`${topicName}-subscription`);
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
      // Parse the message data
      const messageStr = Buffer.from(message.data).toString();
      logger.debug(`Raw message data: ${messageStr}`);
      
      const data = JSON.parse(messageStr);
      
      // Log the exact structure of the incoming message for debugging
      logger.debug('Parsed message data structure:', JSON.stringify(data, null, 2));
      
      // Map the incoming message format to the expected StatusMessage format
      const statusUpdate: StatusMessage = {
        // Map fields from the received message format to our expected format
        videoId: data.video_id || data.videoId,
        jobId: data.message_id || data.jobId || `job-${Date.now()}`,
        status: data.status || 'processing',
        progress: data.progress_percent || data.progress || 0,
        stage: data.current_stage || data.stage,
        error: data.error,
        timestamp: data.timestamp || new Date().toISOString()
      };
      
      logger.info(`Received status update for video ${statusUpdate.videoId}:`, { 
        jobId: statusUpdate.jobId,
        status: statusUpdate.status,
        progress: statusUpdate.progress,
        stage: statusUpdate.stage
      });
      
      if (!statusUpdate.videoId) {
        logger.error('Received message with missing videoId:', data);
        // Acknowledge this message to prevent redelivery of invalid messages
        message.ack();
        return;
      }
      
      // Update video in database
      await this.updateVideoStatus(statusUpdate);
      
      // Acknowledge the message
      message.ack();
    } catch (error: any) {
      logger.error(`Error processing status message: ${error.message}`);
      logger.error(`Message data: ${Buffer.from(message.data).toString()}`);
      // Acknowledge the message to prevent infinite redelivery of problematic messages
      message.ack();
    }
  }
  
  /**
   * Update video status in database and emit event
   */
  private async updateVideoStatus(statusUpdate: StatusMessage) {
    try {
      const { videoId, status, progress, stage, error } = statusUpdate;
      
      let video;
      
      // Check if videoId is a valid UUID (database ID)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(videoId);
      
      if (isUUID) {
        // If it's a valid UUID, try to find by database ID
        try {
          video = await Video.findByPk(videoId);
          if (video) {
            logger.info(`Found video by database ID: ${videoId}`);
          }
        } catch (err: any) {
          logger.error(`Error looking up video by database ID: ${err.message}`);
        }
      }
      
      // If not found or not a UUID, try to find by YouTube ID
      if (!video) {
        try {
          video = await Video.findOne({ where: { youtubeId: videoId } });
          
          if (video) {
            logger.info(`Found video by YouTube ID: ${videoId}, Database ID: ${video.id}`);
          } else {
            logger.warn(`Video not found for status update. Tried YouTube ID: ${videoId}`);
            return;
          }
        } catch (err: any) {
          logger.error(`Error looking up video by YouTube ID: ${err.message}`);
          return;
        }
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
      const updateData: any = {
        processingStatus,
        processingProgress: progress,
        processingError: error || null
      };
      
      // Add any new fields (will be null until database schema is updated)
      if (stage) {
        updateData.processingStage = stage;
      }
      
      updateData.processingLastUpdated = new Date();
      
      await video.update(updateData);
      
      // Calculate estimated time remaining (simplified version - could be more complex in production)
      // For now, let's just use a simple linear projection
      let estimatedTimeRemaining: number | undefined = undefined;
      if (processingStatus === 'processing' && progress > 0 && progress < 100) {
        // If we have a last updated timestamp, calculate time remaining
        if (video.processingLastUpdated) {
          const elapsedTime = (new Date().getTime() - video.processingLastUpdated.getTime()) / 1000;
          const progressDelta = progress - (video.processingProgress || 0);
          
          // Only calculate if we've made progress and have elapsed time
          if (progressDelta > 0 && elapsedTime > 0) {
            // Time per percentage point
            const timePerPercent = elapsedTime / progressDelta;
            // Remaining percentage points
            const remainingPercent = 100 - progress;
            // Estimated time remaining in seconds
            estimatedTimeRemaining = Math.round(timePerPercent * remainingPercent);
          }
        }
      }
      
      // Emit event for WebSocket to broadcast - include both database ID and YouTube ID
      this.emit('statusUpdate', {
        videoId,  // Keep this for backward compatibility - this could be either a UUID or YouTube ID
        youtubeId: video.youtubeId, // Always the YouTube ID
        databaseId: video.id,       // Always the database UUID
        processingStatus,
        processingProgress: progress,
        processingStage: stage || null,
        processingError: error || null,
        processingLastUpdated: new Date(),
        estimatedTimeRemaining
      });
      
      logger.info(`Updated status for video ${videoId} (DB ID: ${video.id}, YouTube ID: ${video.youtubeId}) to ${processingStatus} (${progress}%)`);
    } catch (error) {
      logger.error(`Error updating video status in database:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const videoProcStatusSubscriber = new VideoProcStatusSubscriber();