import { logger } from '../../config/logger';
import Channel from '../../db/models/Channel';
import { kernelService } from './kernelService';
import { Op } from 'sequelize';

class KernelStatusMonitor {
  private readonly checkInterval: number = 60000; // 1 minute
  private timer: NodeJS.Timeout | null = null;
  
  /**
   * Start the monitor service
   */
  start(): void {
    if (this.timer) {
      return;
    }
    
    logger.info('Starting kernel status monitor service');
    
    // Run immediately once
    this.checkPendingKernels().catch(error => {
      logger.error('Error in initial kernel status check:', error);
    });
    
    // Then schedule regular checks
    this.timer = setInterval(() => {
      this.checkPendingKernels().catch(error => {
        logger.error('Error in scheduled kernel status check:', error);
      });
    }, this.checkInterval);
  }
  
  /**
   * Stop the monitor service
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('Stopped kernel status monitor service');
    }
  }
  
  /**
   * Check for channels with pending kernel creation
   */
  private async checkPendingKernels(): Promise<void> {
    // Find channels with pending or creating kernel status
    const pendingChannels = await Channel.findAll({
      where: {
        [Op.or]: [
          { kernelStatus: 'pending' },
          { kernelStatus: 'creating' }
        ]
      }
    });
    
    if (pendingChannels.length === 0) {
      return;
    }
    
    logger.info(`Found ${pendingChannels.length} channels with pending kernel status`);
    
    // Use empty string for auth token in development
    // This matches how chatService is configured
    const authToken = '';
    
    // Check status for each channel
    for (const channel of pendingChannels) {
      try {
        const kernelInfo = await kernelService.getKernelInfo(channel.id, authToken);
        
        if (kernelInfo) {
          // Kernel exists - update channel status
          await channel.update({
            kernelStatus: 'created',
            kernelCreatedAt: new Date(kernelInfo.lastAccessTime) || new Date(),
            kernelLastUpdated: new Date(),
            kernelError: null
          });
          logger.info(`Updated channel ${channel.id} with created kernel status`);
        } else if (channel.kernelStatus === 'creating' && 
                  channel.kernelLastUpdated && 
                  Date.now() - channel.kernelLastUpdated.getTime() > 300000) {
          // If status has been 'creating' for more than 5 minutes, consider it failed
          await channel.update({
            kernelStatus: 'failed',
            kernelLastUpdated: new Date(),
            kernelError: 'Kernel creation timed out',
            retryCount: channel.retryCount + 1
          });
          logger.warn(`Kernel creation timed out for channel ${channel.id}`);
          
          // Schedule a retry
          await kernelService.retryKernelCreation(channel, authToken);
        }
      } catch (error) {
        logger.error(`Error checking kernel status for channel ${channel.id}:`, error);
      }
    }
  }
}

// Export singleton instance
export const kernelStatusMonitor = new KernelStatusMonitor();