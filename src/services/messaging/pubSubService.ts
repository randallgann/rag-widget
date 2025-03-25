import { PubSub } from '@google-cloud/pubsub';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/environment';
import { logger } from '../../config/logger';
import { secretManagerService } from '../gcp/secretManagerService';

/**
 * Service for interacting with Google Cloud Pub/Sub
 */
export class PubSubService {
  private pubSubClient: PubSub | null = null;
  private videoProcessingTopic: string;
  private initialized = false;
  private initializing = false;

  constructor() {
    this.videoProcessingTopic = config.gcp.pubsub.videoProcessingTopic;
  }

  /**
   * Initialize the PubSub client with authentication
   * This is done lazily on first use to handle async service account key retrieval
   */
  private async initialize(): Promise<void> {
    if (this.initialized || this.initializing) return;
    
    try {
      this.initializing = true;
      logger.info('Initializing PubSub client');
      
      const options: any = {
        projectId: config.gcp.projectId,
      };

      // In Kubernetes, we'll use the mounted service account key via GOOGLE_APPLICATION_CREDENTIALS 
      // environment variable. The PubSub client will automatically use it.
      logger.info('Using application default credentials from GOOGLE_APPLICATION_CREDENTIALS');
      
      // The following code is kept for backwards compatibility with non-Kubernetes environments
      if (config.gcp.secretManager.enabled && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        try {
          logger.info('Getting service account key from Secret Manager');
          const credentials = await secretManagerService.getServiceAccountKey();
          options.credentials = credentials;
          logger.info('Successfully retrieved service account key from Secret Manager');
        } catch (error: any) {
          logger.error('Error getting service account key from Secret Manager, falling back to application default credentials:', error);
        }
      }

      this.pubSubClient = new PubSub(options);
      this.initialized = true;
      logger.info('PubSub client initialized successfully');
    } catch (error: any) {
      logger.error('Failed to initialize PubSub client:', error);
      throw error;
    } finally {
      this.initializing = false;
    }
  }

  /**
   * Publishes a video processing message to Pub/Sub
   * @param videoData Video data to be processed
   * @returns Message ID if successful
   */
  async publishVideoProcessingMessage(videoData: {
    video: {
      id: string;
      url: string;
      title: string;
      duration: string;
    };
    channel: {
      id: string;
      name: string;
    };
    user: {
      id: string;
    };
  }): Promise<string> {
    try {
      // Ensure client is initialized
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!this.pubSubClient) {
        throw new Error('PubSub client not initialized');
      }

      const jobId = uuidv4();
      const timestamp = new Date().toISOString();

      const message = {
        jobId,
        timestamp,
        ...videoData,
        storage: {
          outputBucket: config.gcp.storage.bucket,
          outputPrefix: `channels/${videoData.channel.id}/videos/${videoData.video.id}/`
        }
      };

      logger.info(`Publishing message to Pub/Sub topic: ${this.videoProcessingTopic}`, { jobId });
      
      // Convert message to Buffer
      const messageBuffer = Buffer.from(JSON.stringify(message));
      
      // Publish message
      const messageId = await this.pubSubClient
        .topic(this.videoProcessingTopic)
        .publishMessage({ data: messageBuffer });

      logger.info(`Message published to Pub/Sub with ID: ${messageId}`, { jobId });
      return messageId;
    } catch (error: any) {
      logger.error('Error publishing message to Pub/Sub:', error);
      throw new Error(`Failed to publish message to Pub/Sub: ${error.message}`);
    }
  }
}

// Export singleton instance
export const pubSubService = new PubSubService();