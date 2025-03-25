import Channel from '../../db/models/Channel';
import Video, { VideoCreationAttributes } from '../../db/models/Video';
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
      
      logger.info(`Found ${allVideoIds.length} videos for channel ${channelDetails.name}. Fetching details...`);
      
      // Fetch detailed information for all videos in batches (max 50 per request)
      const videoDetails = await fetchVideoDetails(allVideoIds, apiKey);
      
      if (!videoDetails || !videoDetails.items || videoDetails.items.length === 0) {
        logger.warn(`Failed to fetch video details for channel ${channelDetails.name} despite finding ${allVideoIds.length} video IDs`);
        
        // Store basic video records even without details
        if (allVideoIds.length > 0) {
          logger.info(`Creating ${allVideoIds.length} basic video records without detailed information`);
          
          const basicVideos = allVideoIds.map(id => ({
            youtubeId: id,
            channelId: channel.id,
            title: 'Video details pending',
            status: 'active' as 'active',
            processingStatus: 'pending' as 'pending'
          } as unknown as VideoCreationAttributes));
          
          try {
            // First check for existing videos
            const existingBasicIds = await Video.findAll({
              where: {
                youtubeId: basicVideos.map(v => v.youtubeId),
                channelId: channel.id
              },
              attributes: ['youtubeId']
            }).then(videos => videos.map(v => v.get('youtubeId')));
            
            if (existingBasicIds.length > 0) {
              logger.info(`Found ${existingBasicIds.length} basic videos that already exist in the database`, {
                channelId: channel.id
              });
            }
            
            // Use updateOnDuplicate to handle existing records
            const createdBasicVideos = await Video.bulkCreate(basicVideos, {
              updateOnDuplicate: ['title', 'updatedAt', 'status', 'processingStatus']
            });
            
            logger.info(`Created or updated ${createdBasicVideos.length} basic video records for channel ${channelDetails.name}`, {
              newVideos: createdBasicVideos.length - existingBasicIds.length,
              updatedVideos: existingBasicIds.length
            });
            
            // Verify count
            const basicVideoCount = await Video.count({ where: { channelId: channel.id } });
            logger.info(`Channel now has ${basicVideoCount} total videos in database`);
          } catch (error) {
            logger.error(`Failed to create basic video records: ${error instanceof Error ? error.message : String(error)}`);
            
            // Try individual processing as fallback
            logger.info(`Attempting to insert basic videos individually`);
            let successBasicCount = 0;
            
            for (const video of basicVideos) {
              try {
                await Video.upsert(video);
                successBasicCount++;
              } catch (singleError) {
                logger.error(`Failed to insert/update basic video ${video.youtubeId}: ${singleError instanceof Error ? singleError.message : String(singleError)}`);
              }
            }
            
            logger.info(`Individually processed ${successBasicCount} out of ${basicVideos.length} basic videos`);
          }
        }
        
        await this.updateChannelMetadataTimestamp(channel.id);
        return channel;
      }
      
      logger.info(`Successfully fetched details for ${videoDetails.items.length} out of ${allVideoIds.length} videos`);
      
      
      // Prepare video data for database insertion
      logger.info(`Processing ${videoDetails.items.length} videos for database insertion`, {
        channelId: channel.id,
        channelName: channelDetails.name
      });
      
      const videosToCreate = videoDetails.items.map((item, index) => {
        try {
          // Parse duration string to seconds (e.g., "PT1H2M3S" -> 3723 seconds)
          const durationSeconds = parseDuration(item.contentDetails.duration);
          
          // Log detailed info for first and last video only to avoid excessive logging
          if (index === 0 || index === videoDetails.items.length - 1) {
            logger.info(`Video data preparation (${index === 0 ? 'first' : 'last'} of ${videoDetails.items.length})`, {
              youtubeId: item.id,
              title: `${item.snippet.title.substring(0, 30)}${item.snippet.title.length > 30 ? '...' : ''}`,
              channelId: channel.id,
              hasThumbnail: !!item.snippet.thumbnails?.default?.url,
              publishedAt: item.snippet.publishedAt,
              duration: item.contentDetails.duration,
              durationSeconds,
              viewCount: item.statistics?.viewCount || 'unavailable',
              likeCount: item.statistics?.likeCount || 'unavailable'
            });
          }
          
          // Cast to any to ensure compatibility with VideoCreationAttributes
          return {
            youtubeId: item.id,
            title: item.snippet.title,
            channelId: channel.id,
            description: item.snippet.description,
            thumbnailUrl: item.snippet.thumbnails?.default?.url || '',
            status: 'active' as 'active',
            processingStatus: 'pending' as 'pending',
            selectedForProcessing: false,
            publishedAt: new Date(item.snippet.publishedAt),
            duration: item.contentDetails.duration,
            durationSeconds,
            viewCount: parseInt(item.statistics?.viewCount || '0', 10) || 0,
            likeCount: parseInt(item.statistics?.likeCount || '0', 10) || 0,
            processingProgress: 0,
            processingError: null
          } as unknown as VideoCreationAttributes;
        } catch (error) {
          logger.error(`Error processing video at index ${index}`, {
            error: error instanceof Error ? error.message : String(error),
            youtubeId: item?.id || 'unknown',
            channelId: channel.id
          });
          
          // Return minimal valid object if there's an error with proper typing
          return {
            youtubeId: item.id,
            title: item.snippet?.title || 'Unknown title',
            channelId: channel.id,
            status: 'active' as 'active',
            processingStatus: 'pending' as 'pending'
          } as unknown as VideoCreationAttributes;
        }
      });
      
      logger.info(`Attempting to create ${videosToCreate.length} video records in database`, {
        channelId: channel.id,
        channelName: channelDetails.name
      });
      
      try {
        // First check if any of these videos already exist
        const existingYoutubeIds = await Video.findAll({
          where: {
            youtubeId: videosToCreate.map(v => v.youtubeId),
            channelId: channel.id
          },
          attributes: ['youtubeId']
        }).then(videos => videos.map(v => v.get('youtubeId')));
        
        if (existingYoutubeIds.length > 0) {
          logger.info(`Found ${existingYoutubeIds.length} videos that already exist in the database`, {
            channelId: channel.id,
            channelName: channelDetails.name
          });
        }
        
        // Store videos in database with update on duplicate to handle existing records
        const createdVideos = await Video.bulkCreate(videosToCreate, {
          updateOnDuplicate: [
            'title', 'description', 'thumbnailUrl', 'duration', 'durationSeconds',
            'viewCount', 'likeCount', 'publishedAt', 'status', 'processingStatus', 
            'updatedAt'
          ]
        });
        
        // Log success details
        logger.info(`Successfully created or updated ${createdVideos.length} video records for channel ${channelDetails.name}`, {
          channelId: channel.id,
          firstVideoId: createdVideos.length > 0 ? createdVideos[0].get('id') : 'none',
          newVideos: createdVideos.length - existingYoutubeIds.length,
          updatedVideos: existingYoutubeIds.length
        });
        
        // Verify videos were created by counting them
        const videoCount = await Video.count({ where: { channelId: channel.id } });
        logger.info(`Verified ${videoCount} videos in database for channel ${channelDetails.name}`, {
          channelId: channel.id,
          expectedCount: videosToCreate.length
        });
      } catch (dbError) {
        logger.error(`Database error creating videos for channel ${channelDetails.name}`, {
          error: dbError instanceof Error ? dbError.message : String(dbError),
          channelId: channel.id,
          videoCount: videosToCreate.length
        });
        
        // If there's an error, let's try to create the videos one by one to identify which ones are causing issues
        logger.info(`Attempting to insert videos individually to bypass errors`);
        let successCount = 0;
        
        for (const video of videosToCreate) {
          try {
            await Video.upsert(video);
            successCount++;
          } catch (singleError) {
            logger.error(`Failed to insert/update video ${video.youtubeId}: ${singleError instanceof Error ? singleError.message : String(singleError)}`);
          }
        }
        
        logger.info(`Individually processed ${successCount} out of ${videosToCreate.length} videos`);
        
        if (successCount === 0) {
          // If nothing worked, propagate the original error
          throw dbError;
        }
      }
      
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