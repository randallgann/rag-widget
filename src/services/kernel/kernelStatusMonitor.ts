import { logger } from '../../config/logger';
import Channel from '../../db/models/Channel';
import { kernelService } from './kernelService';
import { Op } from 'sequelize';

class KernelStatusMonitor {
  private readonly checkInterval: number = 5000; // 5 seconds
  private timer: NodeJS.Timeout | null = null;
  private startupSyncCompleted: boolean = false;
  
  /**
   * Start the monitor service
   */
  start(): void {
    if (this.timer) {
      return;
    }
    
    logger.info('Starting kernel status monitor service');
    
    // First, run a startup sync to check all 'created' kernels against the API
    this.syncCreatedKernels().catch(error => {
      logger.error('Error in initial kernel sync:', error);
    }).finally(() => {
      this.startupSyncCompleted = true;
      logger.info('Initial kernel sync completed');
    });
    
    // Run immediately once 
    this.checkPendingKernels().catch(error => {
      logger.error('Error in initial kernel status check:', error);
    });
    
    // Then schedule regular checks
    this.timer = setInterval(() => {
      // Only run regular checks after the startup sync has completed
      if (this.startupSyncCompleted) {
        this.checkPendingKernels().catch(error => {
          logger.error('Error in scheduled kernel status check:', error);
        });
      }
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
   * Sync all 'created' kernels with the webapi
   * This handles the case where the webapi was restarted and lost all kernels
   */
  private async syncCreatedKernels(): Promise<void> {
    logger.info('Starting sync of all created kernels on startup');
    
    // Find all channels with 'created' kernel status
    const createdChannels = await Channel.findAll({
      where: { kernelStatus: 'created' }
    });
    
    if (createdChannels.length === 0) {
      logger.info('No channels with created kernel status found during startup sync');
      return;
    }
    
    logger.info(`Found ${createdChannels.length} channels with created kernel status to verify`);
    
    // Use empty string for auth token in development
    // This matches how chatService is configured
    const authToken = '';
    
    // Check each 'created' kernel to see if it actually exists in the webapi
    for (const channel of createdChannels) {
      try {
        logger.info(`Verifying kernel existence for channel ${channel.id}`);
        const kernelInfo = await kernelService.getKernelInfo(channel.id, authToken);
        
        if (!kernelInfo) {
          // Kernel is marked as created in the database but doesn't exist in the webapi
          // This is likely due to a webapi restart - we need to recreate it
          logger.warn(`Channel ${channel.id} is marked as created but kernel not found in API, recreating...`);
          
          // Reset to pending state so we can recreate
          await channel.update({
            kernelStatus: 'pending',
            kernelLastUpdated: new Date()
          });
          
          // Create the kernel
          await kernelService.createKernel(channel, authToken);
          logger.info(`Successfully recreated kernel for channel ${channel.id}`);
        } else {
          // Kernel exists - update last updated time
          logger.info(`Verified kernel for channel ${channel.id} exists in API`);
          await channel.update({
            kernelLastUpdated: new Date()
          });
        }
      } catch (error) {
        logger.error(`Error verifying kernel for channel ${channel.id}:`, error);
      }
    }
    
    logger.info('Completed startup sync of created kernels');
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