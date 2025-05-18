import { Request, Response, NextFunction } from 'express';
import { logger } from '../../config/logger';
import Channel from '../../db/models/Channel';

/**
 * Handle webhook notifications from the kernel service about Qdrant collection status
 * @route POST /api/webhooks/kernel
 */
export const handleKernelWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { channelId, event, status, error } = req.body;
    
    if (!channelId || !event) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields'
      });
    }
    
    logger.info(`Received kernel webhook for channel ${channelId}, event: ${event}, status: ${status}`);
    
    // Find the channel
    const channel = await Channel.findByPk(channelId);
    
    if (!channel) {
      return res.status(404).json({
        status: 'error',
        message: 'Channel not found'
      });
    }
    
    // Update based on the event type
    switch (event) {
      case 'qdrant-collection-created':
        await channel.update({
          qdrantCollectionStatus: 'created',
          qdrantCollectionCreatedAt: new Date(),
          qdrantCollectionLastUpdated: new Date(),
          qdrantCollectionError: null
        });
        logger.info(`Updated channel ${channelId} with Qdrant collection created status`);
        break;
        
      case 'qdrant-collection-failed':
        await channel.update({
          qdrantCollectionStatus: 'failed',
          qdrantCollectionLastUpdated: new Date(),
          qdrantCollectionError: error || 'Unknown error'
        });
        logger.info(`Updated channel ${channelId} with Qdrant collection failed status`);
        break;
        
      case 'kernel-status-update':
        if (status === 'created') {
          await channel.update({
            kernelStatus: 'created',
            kernelCreatedAt: new Date(),
            kernelLastUpdated: new Date(),
            kernelError: null
          });
          logger.info(`Updated channel ${channelId} with kernel created status`);
        } else if (status === 'failed') {
          await channel.update({
            kernelStatus: 'failed',
            kernelLastUpdated: new Date(),
            kernelError: error || 'Unknown error'
          });
          logger.info(`Updated channel ${channelId} with kernel failed status`);
        }
        break;
        
      default:
        logger.warn(`Unknown webhook event: ${event}`);
    }
    
    // Return success
    return res.status(200).json({
      status: 'success',
      message: 'Webhook processed successfully'
    });
  } catch (error) {
    logger.error('Error processing kernel webhook:', error);
    next(error);
  }
};