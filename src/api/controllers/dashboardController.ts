import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middlewares/errorHandler';
import { logger } from '../../config/logger';
import { userService } from '../../services/userService';
import Channel from '../../db/models/Channel';
import Widget from '../../db/models/Widget';
import Video from '../../db/models/Video';

/**
 * Get dashboard stats for a user
 */
export const getDashboardStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user || !req.user.userId) {
      throw new AppError('Unauthorized', 401);
    }
    
    // Get user from our database
    const user = await userService.getUserByAuth0Id(req.user.userId);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Get channel count
    const channelCount = await Channel.count({
      where: { userId: user.id }
    });
    
    // Get channel IDs for this user
    const channels = await Channel.findAll({
      where: { userId: user.id },
      attributes: ['id']
    });
    
    const channelIds = channels.map(channel => channel.id);
    
    // Get widget count
    const widgetCount = channelIds.length > 0 ? 
      await Widget.count({
        where: { channelId: channelIds }
      }) : 0;
    
    // Get video count
    const videoCount = channelIds.length > 0 ? 
      await Video.count({
        where: { channelId: channelIds }
      }) : 0;
    
    // TODO: Get total queries count from analytics service
    const totalQueries = 0;
    
    // TODO: Get actual recent activity from logs/events
    const recentActivity = [
      {
        timestamp: new Date().toISOString(),
        action: 'Login',
        details: `User ${user.email} logged in`
      }
    ];
    
    return res.status(200).json({
      status: 'success',
      data: {
        channelCount,
        widgetCount,
        videoCount,
        totalQueries,
        recentActivity
      }
    });
  } catch (error) {
    logger.error('Get dashboard stats error:', error);
    next(error);
  }
};

/**
 * Get channels for a user
 */
export const getUserChannels = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user || !req.user.userId) {
      throw new AppError('Unauthorized', 401);
    }
    
    // Get user from our database
    const user = await userService.getUserByAuth0Id(req.user.userId);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Get channels for this user
    const channels = await Channel.findAll({
      where: { userId: user.id }
    });
    
    return res.status(200).json({
      status: 'success',
      data: { channels }
    });
  } catch (error) {
    logger.error('Get user channels error:', error);
    next(error);
  }
};

/**
 * Get widgets for a user
 */
export const getUserWidgets = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user || !req.user.userId) {
      throw new AppError('Unauthorized', 401);
    }
    
    // Get user from our database
    const user = await userService.getUserByAuth0Id(req.user.userId);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Get channel IDs for this user
    const channels = await Channel.findAll({
      where: { userId: user.id },
      attributes: ['id']
    });
    
    const channelIds = channels.map(channel => channel.id);
    
    // Get widgets for these channels
    const widgets = channelIds.length > 0 ? 
      await Widget.findAll({
        where: { channelId: channelIds }
      }) : [];
    
    return res.status(200).json({
      status: 'success',
      data: { widgets }
    });
  } catch (error) {
    logger.error('Get user widgets error:', error);
    next(error);
  }
};