import { Request, Response } from 'express';
import fetch from 'node-fetch';
import { logger } from '../../config/logger';

export const proxyThumbnail = async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;
    const thumbnailSize = req.query.size || 'default';
    
    if (!videoId) {
      return res.status(400).json({
        status: 'error',
        message: 'Video ID is required'
      });
    }
    
    const url = `https://i.ytimg.com/vi/${videoId}/${thumbnailSize}.jpg`;
    
    logger.debug(`Proxying thumbnail for video ${videoId} at size ${thumbnailSize}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      logger.error(`Failed to fetch thumbnail for video ${videoId}: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({
        status: 'error',
        message: 'Failed to fetch thumbnail'
      });
    }
    
    // Set appropriate headers
    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    
    // Stream the image data to the client
    response.body.pipe(res);
  } catch (error) {
    logger.error('Error proxying thumbnail:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};