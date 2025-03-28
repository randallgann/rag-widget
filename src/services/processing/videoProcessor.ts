import { pubSubService } from '../messaging/pubSubService';
import { logger } from '../../config/logger';
import Video from '../../db/models/Video';
import Channel from '../../db/models/Channel';

/**
 * Service for handling video processing tasks
 */
export class VideoProcessorService {
  /**
   * Queues videos for processing via Google Cloud Pub/Sub
   * @param videoIds Array of video IDs to process
   * @returns Number of videos successfully queued
   */
  async queueVideosForProcessing(videoIds: string[]): Promise<number> {
    try {
      // Filter out any undefined, null, or empty values
      const validVideoIds = videoIds.filter(id => id && id.trim().length > 0);
      
      if (validVideoIds.length === 0) {
        logger.warn('No valid video IDs provided');
        return 0;
      }
      
      logger.info(`Queueing ${validVideoIds.length} videos for processing`);
      
      // Get videos with their channel information
      const videos = await Video.findAll({
        where: { id: validVideoIds },
        include: [{
          model: Channel,
          as: 'channel',
          attributes: ['id', 'userId', 'name'],
          required: true // Ensure only videos with valid channel associations are returned
        }]
      });
      
      // Log the video IDs that were successfully found
      logger.info(`Found ${videos.length} videos with valid channel associations out of ${validVideoIds.length} requested IDs`);
      
      if (videos.length === 0) {
        logger.warn('No videos found for the provided IDs');
        return 0;
      }
      
      let queuedCount = 0;
      
      // Queue each video for processing
      for (const video of videos) {
        try {
          if (!video.channel) {
            logger.warn(`Video ${video.id} is not associated with a channel`);
            continue;
          }
          
          // Create video URL from ID
          const videoUrl = `https://www.youtube.com/watch?v=${video.youtubeId}`;
          
          // Log the values being used for processing
          logger.info(`Processing video - ID: ${video.id}, YouTube ID: ${video.youtubeId}, Channel ID: ${video.channel.id}, User ID: ${video.channel.userId}`);
          
          // Publish message to Pub/Sub
          await pubSubService.publishVideoProcessingMessage({
            video: {
              id: video.id, // Use the database ID instead of youtubeId
              url: videoUrl,
              title: video.title,
              duration: video.duration
            },
            channel: {
              id: video.channel.id,
              name: video.channel.name
            },
            user: {
              id: video.channel.userId
            }
          });
          
          // Update video status to processing
          await video.update({
            processingStatus: 'processing',
            processingProgress: 0
          });
          
          queuedCount++;
        } catch (error: any) {
          logger.error(`Error queueing video ${video.id} for processing:`, error);
          // Continue with other videos even if one fails
        }
      }
      
      logger.info(`Successfully queued ${queuedCount} videos for processing`);
      return queuedCount;
    } catch (error: any) {
      logger.error('Error in queueVideosForProcessing:', error);
      throw new Error(`Failed to queue videos for processing: ${error.message}`);
    }
  }
}

// Export singleton instance
export const videoProcessorService = new VideoProcessorService();