import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middlewares/errorHandler';
import Video from '../../db/models/Video';
import Channel from '../../db/models/Channel';
import { userService } from '../../services/userService';
import { logger } from '../../config/logger';
import { videoProcessorService } from '../../services/processing/videoProcessor';

/**
 * Update video selection status
 * @route PUT /api/videos/:id/select
 */
export const updateVideoSelection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !req.user.userId) {
      throw new AppError('Unauthorized', 401);
    }
    
    const { id } = req.params;
    const { selectedForProcessing } = req.body;
    
    if (selectedForProcessing === undefined) {
      throw new AppError('Selected for processing status is required', 400);
    }
    
    // Get user from our database
    const user = await userService.getUserByAuth0Id(req.user.userId);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Find the video
    const video = await Video.findByPk(id, {
      include: [{
        model: Channel,
        as: 'channel',
        attributes: ['id', 'userId'],
      }]
    });
    
    if (!video) {
      throw new AppError('Video not found', 404);
    }
    
    // Check if the video belongs to a channel owned by the user
    if (!video.channel || video.channel.userId !== user.id) {
      throw new AppError('You do not have permission to update this video', 403);
    }
    
    // Update the video selection status
    await video.update({ selectedForProcessing });
    
    return res.status(200).json({
      status: 'success',
      data: {
        video: {
          id: video.id,
          selectedForProcessing: video.selectedForProcessing
        }
      },
      message: 'Video selection status updated successfully'
    });
  } catch (error) {
    logger.error('Update video selection error:', error);
    next(error);
  }
};

/**
 * Update multiple videos selection status
 * @route PUT /api/videos/select-batch
 */
export const updateBatchVideoSelection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !req.user.userId) {
      throw new AppError('Unauthorized', 401);
    }
    
    const { videoIds, selectedForProcessing } = req.body;
    
    if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
      throw new AppError('Video IDs are required', 400);
    }
    
    if (selectedForProcessing === undefined) {
      throw new AppError('Selected for processing status is required', 400);
    }
    
    // Get user from our database
    const user = await userService.getUserByAuth0Id(req.user.userId);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Get all channels owned by the user
    const userChannels = await Channel.findAll({
      where: { userId: user.id },
      attributes: ['id']
    });
    
    const userChannelIds = userChannels.map(channel => channel.id);
    
    // Find the videos that belong to the user's channels
    const videos = await Video.findAll({
      where: {
        id: videoIds,
        channelId: userChannelIds
      }
    });
    
    if (videos.length === 0) {
      throw new AppError('No valid videos found', 404);
    }
    
    // Update the videos
    await Promise.all(videos.map(video => {
      return video.update({ selectedForProcessing });
    }));
    
    return res.status(200).json({
      status: 'success',
      data: {
        updatedCount: videos.length,
        totalRequested: videoIds.length
      },
      message: `Updated selection status for ${videos.length} videos`
    });
  } catch (error) {
    logger.error('Batch update video selection error:', error);
    next(error);
  }
};

/**
 * Get video processing status
 * @route GET /api/videos/:id/status
 */
export const getVideoProcessingStatus = async (req: Request, res: Response, next: NextFunction) => {
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
    
    // Find the video
    const video = await Video.findByPk(id, {
      include: [{
        model: Channel,
        as: 'channel',
        attributes: ['id', 'userId'],
      }]
    });
    
    if (!video) {
      throw new AppError('Video not found', 404);
    }
    
    // Check if the video belongs to a channel owned by the user
    if (!video.channel || video.channel.userId !== user.id) {
      throw new AppError('You do not have permission to access this video', 403);
    }
    
    return res.status(200).json({
      status: 'success',
      data: {
        video: {
          id: video.id,
          title: video.title,
          processingStatus: video.processingStatus,
          processingProgress: video.processingProgress,
          processingError: video.processingError,
          processingStage: video.processingStage,
          processingLastUpdated: video.processingLastUpdated
        }
      }
    });
  } catch (error) {
    logger.error('Get video processing status error:', error);
    next(error);
  }
};

/**
 * Get processing status for multiple videos
 * @route POST /api/videos/status-batch
 */
export const getBatchVideoProcessingStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !req.user.userId) {
      throw new AppError('Unauthorized', 401);
    }
    
    const { videoIds } = req.body;
    
    if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
      throw new AppError('Video IDs are required', 400);
    }
    
    // Get user from our database
    const user = await userService.getUserByAuth0Id(req.user.userId);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Get all channels owned by the user
    const userChannels = await Channel.findAll({
      where: { userId: user.id },
      attributes: ['id']
    });
    
    const userChannelIds = userChannels.map(channel => channel.id);
    
    // Find the videos that belong to the user's channels
    const videos = await Video.findAll({
      where: {
        id: videoIds,
        channelId: userChannelIds
      },
      attributes: ['id', 'title', 'processingStatus', 'processingProgress', 'processingError', 'processingStage', 'processingLastUpdated']
    });
    
    return res.status(200).json({
      status: 'success',
      data: {
        videos: videos,
        totalFound: videos.length,
        totalRequested: videoIds.length
      }
    });
  } catch (error) {
    logger.error('Batch get video processing status error:', error);
    next(error);
  }
};

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

/**
 * Initiate processing for selected videos in a channel
 * @route POST /api/channels/:channelId/process
 */
export const processChannelVideos = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !req.user.userId) {
      throw new AppError('Unauthorized', 401);
    }
    
    // Extract channel ID from route params
    // The parameter is named 'id' in the routes (:id/process), not 'channelId'
    const { id } = req.params;
    const { videoIds } = req.body;
    
    // Log the channel ID for debugging
    logger.info(`Processing videos for channel ID: ${id}`);
    
    // Get user from our database
    const user = await userService.getUserByAuth0Id(req.user.userId);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Check if the channel belongs to the user
    const channel = await Channel.findOne({
      where: { 
        id,
        userId: user.id
      }
    });
    
    if (!channel) {
      throw new AppError('Channel not found or access denied', 404);
    }
    
    // If videoIds are provided, use them to filter videos from this channel
    // Otherwise, get all selected videos for this channel
    let videos;
    if (videoIds && Array.isArray(videoIds) && videoIds.length > 0) {
      videos = await Video.findAll({
        where: {
          id: videoIds,
          channelId: id
        }
      });
    } else {
      videos = await Video.findAll({
        where: {
          channelId: id,
          selectedForProcessing: true
        }
      });
    }
    
    if (videos.length === 0) {
      throw new AppError('No videos selected for processing', 400);
    }
    
    // Queue videos for processing using Pub/Sub
    try {
      // Extract valid video IDs, ensuring they are not undefined
      const videoIdsToProcess = videos.map(video => video.id).filter(Boolean);
      
      if (videoIdsToProcess.length === 0) {
        throw new AppError('No valid video IDs to process', 400);
      }
      
      logger.info(`Attempting to queue ${videoIdsToProcess.length} videos for processing`);
      
      const queuedCount = await videoProcessorService.queueVideosForProcessing(videoIdsToProcess);
      
      logger.info(`Queued ${queuedCount} videos for processing via Pub/Sub for channel ${id}`);
      
      if (queuedCount === 0) {
        throw new AppError('Failed to queue any videos for processing', 500);
      }
    } catch (error: any) {
      logger.error(`Error queueing videos for processing: ${error.message}`);
      throw new AppError(`Failed to queue videos for processing: ${error.message}`, 500);
    }
    
    return res.status(200).json({
      status: 'success',
      data: {
        processingCount: videos.length,
        videos: videos.map(video => ({
          id: video.id,
          title: video.title,
          processingStatus: video.processingStatus
        }))
      },
      message: `Started processing ${videos.length} videos`
    });
  } catch (error) {
    logger.error('Process channel videos error:', error);
    next(error);
  }
};

/**
 * Reset video processing status
 * @route PUT /api/videos/:id/reset-processing
 */
export const resetVideoProcessing = async (req: Request, res: Response, next: NextFunction) => {
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
    
    // Find the video with its channel info to check permissions
    const video = await Video.findByPk(id, {
      include: [{
        model: Channel,
        as: 'channel',
        attributes: ['id', 'userId'],
      }]
    });
    
    if (!video) {
      throw new AppError('Video not found', 404);
    }
    
    // Check if the video belongs to a channel owned by the user
    if (!video.channel || video.channel.userId !== user.id) {
      throw new AppError('You do not have permission to reset this video', 403);
    }
    
    // Only allow resetting videos that are in completed or failed state
    if (video.processingStatus !== 'completed' && video.processingStatus !== 'failed') {
      throw new AppError(`Cannot reset video in '${video.processingStatus}' state. Only completed or failed videos can be reset.`, 400);
    }
    
    // Update the video to reset processing state
    await video.update({
      processingStatus: 'pending',
      processingProgress: 0,
      processingError: null,
      processingStage: null,
      processingLastUpdated: null
    });
    
    logger.info(`Reset processing status for video ${id} to pending state`);
    
    return res.status(200).json({
      status: 'success',
      data: {
        video: {
          id: video.id,
          title: video.title,
          processingStatus: 'pending'
        }
      },
      message: 'Video processing status has been reset'
    });
  } catch (error: any) {
    logger.error('Reset video processing error:', error);
    next(error);
  }
};