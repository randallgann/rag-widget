import { Request, Response, NextFunction } from 'express';
import { validateYouTubeChannel } from '../../services/youtube/fetcher';
import { config } from '../../config/environment';
import { VideoResponse } from '../../types/api';
import { AppError } from '../middlewares/errorHandler';
import { userService } from '../../services/userService';
import Channel from '../../db/models/Channel';
import Video from '../../db/models/Video';
import { logger } from '../../config/logger';

/**
 * Validates a YouTube channel by URL, ID, or handle
 * @route POST /api/channels/validate
 */
export const validateChannel = async (req: Request, res: Response) => {
  try {
    const { channelIdentifier } = req.body;

    if (!channelIdentifier) {
      return res.status(400).json({
        status: 'error',
        message: 'Channel identifier is required'
      });
    }

    // Get API key from server config
    const apiKey = config.youtube.apiKey;
    if (!apiKey) {
      return res.status(500).json({
        status: 'error',
        message: 'YouTube API key is not configured on the server'
      });
    }

    // Validate the channel
    const channelResponse = await validateYouTubeChannel(channelIdentifier, apiKey);

    if (!channelResponse || !channelResponse.items || channelResponse.items.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Channel not found'
      });
    }

    // Extract relevant channel info
    const channel = channelResponse.items[0];
    const formattedChannel = {
      id: channel.id,
      name: channel.snippet.title,
      description: channel.snippet.description,
      thumbnailUrl: channel.snippet.thumbnails.default.url,
      videoCount: parseInt(channel.statistics.videoCount, 10),
      subscriberCount: channel.statistics.subscriberCount,
      viewCount: channel.statistics.viewCount
    };

    return res.status(200).json({
      status: 'success',
      data: {
        channel: formattedChannel
      }
    });
  } catch (error) {
    console.error('Error validating channel:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to validate channel'
    });
  }
};

/**
 * Get all channels for the authenticated user
 * @route GET /api/channels
 */
export const getAllChannels = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !req.user.userId) {
      throw new AppError('Unauthorized', 401);
    }
    
    // Get user from our database
    const user = await userService.getUserByAuth0Id(req.user.userId);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Get channels for this user with video counts
    const channels = await Channel.findAll({
      where: { userId: user.id },
      include: [
        {
          model: Video,
          as: 'videos',
          attributes: ['id', 'title', 'processingStatus', 'thumbnailUrl', 'youtubeId', 'status', 'publishedAt'],
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    // Format the response
    const formattedChannels = channels.map(channel => {
      // Use type assertion to include the videos association
      const channelJson = channel.toJSON() as (ReturnType<typeof channel.toJSON> & { videos?: VideoResponse[] });
      const videos = channelJson.videos || [];
      
      // Count videos by processing status
      const videoStats = {
        total: videos.length,
        processed: videos.filter((v: Pick<VideoResponse, 'processingStatus'>) => v.processingStatus === 'completed').length,
        processing: videos.filter((v: Pick<VideoResponse, 'processingStatus'>) => v.processingStatus === 'processing').length,
        pending: videos.filter((v: Pick<VideoResponse, 'processingStatus'>) => v.processingStatus === 'pending').length,
        failed: videos.filter((v: Pick<VideoResponse, 'processingStatus'>) => v.processingStatus === 'failed').length
      };
      
      // Return channel with counts but without the full video objects
      return {
        ...channelJson,
        videoStats,
        videos: undefined // Remove the full videos array to reduce payload size
      };
    });
    
    return res.status(200).json({
      status: 'success',
      data: {
        channels: formattedChannels
      }
    });
  } catch (error) {
    logger.error('Get all channels error:', error);
    next(error);
  }
};

/**
 * Create a new channel with video metadata
 * @route POST /api/channels
 */
export const createChannel = async (req: Request, res: Response) => {
  try {
    const { channelDetails } = req.body;
    
    if (!channelDetails) {
      return res.status(400).json({
        status: 'error',
        message: 'Channel details are required'
      });
    }
    
    // Get Auth0 ID from the authenticated request
    const auth0Id = req.user?.userId;
    
    if (!auth0Id) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }
    
    // Import userService to get the internal UUID
    const { userService } = await import('../../services/userService');
    
    // Get the user by Auth0 ID to retrieve their internal UUID
    const user = await userService.getUserByAuth0Id(auth0Id);
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
    
    // Now we have the internal UUID that matches our database schema
    const userId = user.id;
    
    // Get API key from server config
    const apiKey = config.youtube.apiKey;
    if (!apiKey) {
      return res.status(500).json({
        status: 'error',
        message: 'YouTube API key is not configured on the server'
      });
    }
    
    // Import service dynamically to avoid circular dependencies
    const { ChannelService } = await import('../../services/youtube/channelService');
    const channelService = new ChannelService();
    
    // Create the channel and fetch video metadata
    const channel = await channelService.createChannelWithMetadata(
      channelDetails,
      userId,
      apiKey,
    );
    
    // Include kernel status in the response
    return res.status(201).json({
      status: 'success',
      data: {
        channel: {
          id: channel.id,
          name: channel.name,
          description: channel.description,
          status: channel.status,
          kernelStatus: channel.kernelStatus,
          qdrantCollectionStatus: channel.qdrantCollectionStatus,
          config: channel.config,
          createdAt: channel.createdAt,
          updatedAt: channel.updatedAt
        }
      },
      message: 'Channel created successfully with video metadata'
    });
  } catch (error) {
    console.error('Error creating channel:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to create channel'
    });
  }
};

/**
 * Get a channel by ID
 * @route GET /api/channels/:id
 */
export const getChannelById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !req.user.userId) {
      throw new AppError('Unauthorized', 401);
    }
    
    const { id } = req.params;
    
    if (!id) {
      throw new AppError('Channel ID is required', 400);
    }
    
    // Get user from our database
    const user = await userService.getUserByAuth0Id(req.user.userId);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Find the channel
    const channel = await Channel.findOne({
      where: { 
        id,
        userId: user.id // Ensure the channel belongs to the user
      },
      attributes: [
        'id', 
        'name', 
        'description', 
        'userId', 
        'config', 
        'status',
        'kernelStatus',
        'kernelError',
        'kernelCreatedAt',
        'kernelLastUpdated',
        'qdrantCollectionStatus',
        'qdrantCollectionError',
        'qdrantCollectionCreatedAt',
        'qdrantCollectionLastUpdated',
        'retryCount',
        'createdAt',
        'updatedAt'
      ],
      include: [
        {
          model: Video,
          as: 'videos',
          attributes: [
            'id', 
            'title', 
            'description',
            'thumbnailUrl', 
            'youtubeId', 
            'processingStatus', 
            'publishedAt',
            'duration',
            'durationSeconds',
            'viewCount',
            'likeCount',
            'status',
            'selectedForProcessing',
            'processingProgress'
          ],
          order: [['publishedAt', 'DESC']]
        }
      ]
    });
    
    if (!channel) {
      throw new AppError('Channel not found', 404);
    }
    
    return res.status(200).json({
      status: 'success',
      data: {
        channel
      }
    });
  } catch (error) {
    logger.error('Get channel by ID error:', error);
    next(error);
  }
};

/**
 * Update a channel
 * @route PUT /api/channels/:id
 */
export const updateChannel = (req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    data: {
      channel: {}
    },
    message: 'Update channel to be implemented'
  });
};

/**
 * Delete a channel
 * @route DELETE /api/channels/:id
 */
export const deleteChannel = (req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    message: 'Delete channel to be implemented'
  });
};

/**
 * Get channel status including kernel status
 * @route GET /api/channels/:id/status
 */
export const getChannelStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !req.user.userId) {
      throw new AppError('Unauthorized', 401);
    }
    
    const { id } = req.params;
    
    if (!id) {
      throw new AppError('Channel ID is required', 400);
    }
    
    // Get user from our database
    const user = await userService.getUserByAuth0Id(req.user.userId);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Get channel with kernel status fields
    const channel = await Channel.findOne({
      where: { 
        id,
        userId: user.id // Ensure the channel belongs to the user
      },
      attributes: [
        'id',
        'name',
        'kernelStatus',
        'kernelError',
        'kernelCreatedAt',
        'kernelLastUpdated',
        'qdrantCollectionStatus',
        'qdrantCollectionError',
        'qdrantCollectionCreatedAt',
        'qdrantCollectionLastUpdated',
        'retryCount',
        'updatedAt'
      ]
    });
    
    if (!channel) {
      throw new AppError('Channel not found', 404);
    }
    
    return res.status(200).json({
      status: 'success',
      data: {
        channel
      }
    });
  } catch (error) {
    logger.error('Get channel status error:', error);
    next(error);
  }
};

/**
 * Retry kernel creation for a channel
 * @route POST /api/channels/:id/kernel/retry
 */
export const retryKernelCreation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !req.user.userId) {
      throw new AppError('Unauthorized', 401);
    }
    
    const { id } = req.params;
    
    if (!id) {
      throw new AppError('Channel ID is required', 400);
    }
    
    // Get user from our database
    const user = await userService.getUserByAuth0Id(req.user.userId);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Get channel
    const channel = await Channel.findOne({
      where: { 
        id,
        userId: user.id // Ensure the channel belongs to the user
      }
    });
    
    if (!channel) {
      throw new AppError('Channel not found', 404);
    }
    
    if (channel.kernelStatus !== 'failed') {
      throw new AppError('Kernel is not in failed status', 400);
    }
    
    // Reset status to pending
    await channel.update({
      kernelStatus: 'pending',
      kernelLastUpdated: new Date()
    });
    
    // Import dynamically to avoid circular dependencies
    const { kernelService } = await import('../../services/kernel');
    
    // Use empty string for auth token in development
    // This matches how chatService is configured
    const authToken = '';
    
    // Trigger background retry
    kernelService.createKernel(channel, authToken).catch(error => {
      logger.error(`Error in manual kernel retry for channel ${channel.id}:`, error);
    });
    
    return res.status(202).json({
      status: 'success',
      data: {
        id: channel.id,
        kernelStatus: 'pending'
      },
      message: 'Kernel creation retry initiated'
    });
  } catch (error) {
    logger.error('Retry kernel creation error:', error);
    next(error);
  }
};