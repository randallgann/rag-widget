import Channel from '../../db/models/Channel';
import Video from '../../db/models/Video';
import { 
  fetchChannelVideos, 
  fetchVideoDetails,
  extractVideoIdsFromSearchResults 
} from './videoFetcher';
import { logger } from '../../config/logger';
import { parseDuration } from '../../utils/helpers';

/**
 * Interface for channel details from YouTube API validation
 */
export interface YouTubeChannelDetails {
  id: string;
  name: string;
  description: string;
  thumbnailUrl: string;
  videoCount: number;
  subscriberCount: string;
  viewCount: string;
}

/**
 * Service for managing YouTube channels and their videos
 */
export class ChannelService {
  /**
   * Creates a channel and retrieves all its video metadata
   * 
   * @param channelDetails - Details of the YouTube channel
   * @param userId - User ID of the channel owner
   * @param apiKey - YouTube API key
   * @returns Created channel with metadata
   */
  async createChannelWithMetadata(
    channelDetails: YouTubeChannelDetails,
    userId: string,
    apiKey: string
  ) {
    try {
      logger.info(`Creating channel with metadata: ${channelDetails.name}`, { userId });
      
      // Create the channel in the database
      const channel = await Channel.create({
        name: channelDetails.name,
        description: channelDetails.description,
        userId: userId,
        config: {
          youtubeChannelId: channelDetails.id,
          thumbnailUrl: channelDetails.thumbnailUrl,
          subscriberCount: channelDetails.subscriberCount,
          viewCount: channelDetails.viewCount,
          videoCount: channelDetails.videoCount,
          totalProcessed: 0,
          processingStatus: 'idle'
        },
        status: 'active',
      });
      
      // Fetch all videos for the channel
      const allVideoIds = await this.fetchAllVideoIdsForChannel(channelDetails.id, apiKey);
      
      if (allVideoIds.length === 0) {
        logger.info(`No videos found for channel ${channelDetails.name}`);
        await this.updateChannelMetadataTimestamp(channel.id);
        return channel;
      }
      
      // Fetch detailed information for all videos
      const videoDetails = await fetchVideoDetails(allVideoIds, apiKey);
      
      if (!videoDetails || !videoDetails.items || videoDetails.items.length === 0) {
        logger.info(`No video details found for channel ${channelDetails.name}`);
        await this.updateChannelMetadataTimestamp(channel.id);
        return channel;
      }
      
      // Prepare video data for database insertion
      const videosToCreate = videoDetails.items.map(item => {
        // Parse duration string to seconds (e.g., "PT1H2M3S" -> 3723 seconds)
        const durationSeconds = parseDuration(item.contentDetails.duration);
        
        return {
          youtubeId: item.id,
          title: item.snippet.title,
          channelId: channel.id,
          description: item.snippet.description,
          thumbnailUrl: item.snippet.thumbnails?.default?.url || '',
          status: 'active',
          processingStatus: 'pending',
          selectedForProcessing: false,
          publishedAt: new Date(item.snippet.publishedAt),
          duration: item.contentDetails.duration,
          durationSeconds,
          viewCount: parseInt(item.statistics.viewCount, 10) || 0,
          likeCount: parseInt(item.statistics.likeCount, 10) || 0,
          processingProgress: 0,
          processingError: null
        } as unknown as any;
      });
      
      // Store videos in database
      await Video.bulkCreate(videosToCreate);
      
      logger.info(`Created ${videosToCreate.length} video records for channel ${channelDetails.name}`);
      
      // Update channel with the timestamp of metadata fetch
      await this.updateChannelMetadataTimestamp(channel.id);
      
      return channel;
    } catch (error: any) {
      logger.error('Error creating channel with metadata', {
        error: error.message,
        channelId: channelDetails.id,
        userId
      });
      throw error;
    }
  }
  
  /**
   * Fetches all video IDs for a YouTube channel, handling pagination
   * 
   * @param channelId - YouTube channel ID
   * @param apiKey - YouTube API key
   * @param maxResults - Maximum results per page
   * @returns Array of video IDs
   */
  private async fetchAllVideoIdsForChannel(
    channelId: string, 
    apiKey: string,
    maxResults = 50
  ): Promise<string[]> {
    try {
      let videoIds: string[] = [];
      let nextPageToken: string | undefined;
      
      do {
        // Fetch a page of videos
        const searchResponse = await fetchChannelVideos(
          channelId,
          apiKey,
          maxResults,
          nextPageToken
        );
        
        if (!searchResponse || !searchResponse.items) {
          break;
        }
        
        // Extract video IDs from this page
        const pageVideoIds =  extractVideoIdsFromSearchResults(searchResponse);
        videoIds = [...videoIds, ...pageVideoIds];
        
        // Check if there are more pages
        nextPageToken = searchResponse.nextPageToken;
      } while (nextPageToken);
      
      logger.info(`Fetched ${videoIds.length} video IDs for channel ${channelId}`);
      return videoIds;
    } catch (error: any) {
      logger.error('Error fetching all video IDs for channel', {
        error: error.message,
        channelId
      });
      throw error;
    }
  }
  
  /**
   * Updates the channel's lastMetadataFetch timestamp
   * 
   * @param channelId - Database ID of the channel
   */
  private async updateChannelMetadataTimestamp(channelId: string): Promise<void> {
    try {
      await Channel.update(
        { updatedAt: new Date() },
        { where: { id: channelId } }
      );
    } catch (error: any) {
      logger.error('Error updating channel metadata timestamp', {
        error: error.message,
        channelId
      });
      // Don't rethrow - this is a non-critical error
    }
  }
}