import { PubSub, Subscription, Message } from '@google-cloud/pubsub';
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
export class VideoProcStatusSubscriber {
  private pubSubClient: PubSub;
  private statusTopic: string;
  private subscription: Subscription;
  private isRunning: boolean = false;

  constructor() {
    this.pubSubClient = new PubSub({
      projectId: config.gcp.projectId,
    });
    this.statusTopic = config.gcp.pubsub.videoProcessingStatusTopic;
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
          logger.info(`Creating subscription ${this.statusTopic}-subscription`);
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
      
      logger.info(`Received status update for video ${statusUpdate.videoId}:`, { 
        jobId: statusUpdate.jobId,
        status: statusUpdate.status,
        progress: statusUpdate.progress,
        stage: statusUpdate.stage
      });
      
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
      
      logger.info(`Updated status for video ${videoId} to ${processingStatus} (${progress}%)`);
    } catch (error) {
      logger.error(`Error updating video status in database:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const videoProcStatusSubscriber = new VideoProcStatusSubscriber();