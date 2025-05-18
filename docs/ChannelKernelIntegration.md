# Channel-Kernel Integration: Detailed Implementation Document

## Overview

This document outlines the implementation plan for integrating channel creation with semantic kernel creation in the RAG Widget application. The solution ensures each YouTube channel has a corresponding kernel in the chat-copilot-webapi service, with proper status tracking and error handling.

**IMPORTANT UPDATE (2025-05-15)**: The initial plan called for direct kernel creation from the channel service, but the actual implementation uses a more robust approach with the `KernelStatusMonitor` service. This document has been updated to reflect the actual implementation.

## 1. Database Schema and Model Updates

### 1.1 Update Database Schema

Update the `database/init.sql` file to add kernel tracking fields to the channels table:

```sql
-- Add to CREATE TABLE channels in database/init.sql
CREATE TABLE IF NOT EXISTS channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    user_id UUID NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
    config JSONB DEFAULT '{}',
    status status_enum DEFAULT 'active',
    kernel_status VARCHAR(20) DEFAULT 'pending' CHECK (kernel_status IN ('pending', 'creating', 'created', 'failed')),
    kernel_error TEXT,
    kernel_created_at TIMESTAMP WITH TIME ZONE,
    kernel_last_updated TIMESTAMP WITH TIME ZONE,
    qdrant_collection_status VARCHAR(20) DEFAULT 'pending' CHECK (qdrant_collection_status IN ('pending', 'creating', 'created', 'failed')),
    qdrant_collection_error TEXT,
    qdrant_collection_created_at TIMESTAMP WITH TIME ZONE,
    qdrant_collection_last_updated TIMESTAMP WITH TIME ZONE,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add these indexes after all other CREATE INDEX statements
CREATE INDEX IF NOT EXISTS idx_channels_kernel_status ON channels(kernel_status);
CREATE INDEX IF NOT EXISTS idx_channels_qdrant_collection_status ON channels(qdrant_collection_status);
```

### 1.2 TypeScript Model Updates

Update the Channel model in `src/db/models/Channel.ts`:

```typescript
// Add to interface ChannelAttributes
kernelStatus: 'pending' | 'creating' | 'created' | 'failed';
kernelError: string | null;
kernelCreatedAt: Date | null;
kernelLastUpdated: Date | null;
qdrantCollectionStatus: 'pending' | 'creating' | 'created' | 'failed';
qdrantCollectionError: string | null;
qdrantCollectionCreatedAt: Date | null;
qdrantCollectionLastUpdated: Date | null;
retryCount: number;

// Add to class Channel implementation
public kernelStatus!: 'pending' | 'creating' | 'created' | 'failed';
public kernelError!: string | null;
public kernelCreatedAt!: Date | null;
public kernelLastUpdated!: Date | null;
public qdrantCollectionStatus!: 'pending' | 'creating' | 'created' | 'failed';
public qdrantCollectionError!: string | null;
public qdrantCollectionCreatedAt!: Date | null;
public qdrantCollectionLastUpdated!: Date | null;
public retryCount!: number;

// Add to Channel.init()
kernelStatus: {
  type: DataTypes.ENUM('pending', 'creating', 'created', 'failed'),
  defaultValue: 'pending',
  field: 'kernel_status'
},
kernelError: {
  type: DataTypes.TEXT,
  allowNull: true,
  field: 'kernel_error'
},
kernelCreatedAt: {
  type: DataTypes.DATE,
  allowNull: true,
  field: 'kernel_created_at'
},
kernelLastUpdated: {
  type: DataTypes.DATE,
  allowNull: true,
  field: 'kernel_last_updated'
},
qdrantCollectionStatus: {
  type: DataTypes.ENUM('pending', 'creating', 'created', 'failed'),
  defaultValue: 'pending',
  field: 'qdrant_collection_status'
},
qdrantCollectionError: {
  type: DataTypes.TEXT,
  allowNull: true,
  field: 'qdrant_collection_error'
},
qdrantCollectionCreatedAt: {
  type: DataTypes.DATE,
  allowNull: true,
  field: 'qdrant_collection_created_at'
},
qdrantCollectionLastUpdated: {
  type: DataTypes.DATE,
  allowNull: true,
  field: 'qdrant_collection_last_updated'
},
retryCount: {
  type: DataTypes.INTEGER,
  defaultValue: 0,
  field: 'retry_count'
}
```

## 2. Kernel Service Implementation

### 2.1 Create KernelService

Create a new file `src/services/kernel/kernelService.ts`:

```typescript
import fetch from 'node-fetch';
import { logger } from '../../config/logger';
import { config } from '../../config/environment';
import Channel from '../../db/models/Channel';

// Define interfaces for request/response types
interface KernelCreateRequest {
  contextId: string;
  completionOptions?: {
    modelId?: string;
    temperature?: number;
    maxTokens?: number;
  };
  embeddingOptions?: {
    modelId?: string;
    temperature?: number;
    maxTokens?: number;
  };
  enabledPlugins?: string[];
}

interface KernelResponse {
  userId: string;
  contextId: string;
  lastAccessTime: string;
  plugins: Array<{
    name: string;
    functions: string[];
  }>;
  modelInfo: {
    completionModelId: string;
    temperature: number;
    maxTokens: number;
  };
}

class KernelService {
  private readonly apiBaseUrl: string;
  private readonly maxRetries: number = 5;
  private readonly initialRetryDelay: number = 3000; // 3 seconds
  
  constructor() {
    // Use the webapi URL from configuration
    this.apiBaseUrl = config.kernelApi?.baseUrl || 'http://localhost:3080';
    logger.info(`KernelService initialized with API base URL: ${this.apiBaseUrl}`);
  }
  
  /**
   * Create a kernel for a channel
   * @param channel The channel to create a kernel for
   * @param authToken Authentication token for the kernel API
   * @returns The kernel response
   */
  async createKernel(channel: Channel, authToken: string): Promise<KernelResponse> {
    const url = `${this.apiBaseUrl}/api/kernel/create`;
    logger.info(`Creating kernel for channel ${channel.id} at: ${url}`);
    
    // Update channel status to creating
    await channel.update({
      kernelStatus: 'creating',
      kernelLastUpdated: new Date()
    });
    
    // Prepare request payload
    const payload: KernelCreateRequest = {
      contextId: channel.id,
      completionOptions: {
        modelId: config.kernelApi?.defaultModel || 'gpt-4',
        temperature: 0.7,
      },
      enabledPlugins: ['YouTubePlugin']
    };
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create kernel: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data: KernelResponse = await response.json();
      
      // Update channel with success status
      await channel.update({
        kernelStatus: 'created',
        kernelCreatedAt: new Date(),
        kernelLastUpdated: new Date(),
        kernelError: null
      });
      
      logger.info(`Successfully created kernel for channel ${channel.id}`);
      return data;
    } catch (error: any) {
      // Update channel with error status
      await channel.update({
        kernelStatus: 'failed',
        kernelLastUpdated: new Date(),
        kernelError: error.message || 'Unknown error',
        retryCount: channel.retryCount + 1
      });
      
      logger.error(`Error creating kernel for channel ${channel.id}:`, error);
      throw error;
    }
  }
  
  /**
   * Get information about a kernel
   * @param channelId The channel ID (used as context ID)
   * @param authToken Authentication token for the kernel API
   * @returns The kernel info
   */
  async getKernelInfo(channelId: string, authToken: string): Promise<KernelResponse | null> {
    const url = `${this.apiBaseUrl}/api/kernel/info?contextId=${channelId}`;
    logger.debug(`Fetching kernel info for channel ${channelId} at: ${url}`);
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Accept': 'application/json'
        }
      });
      
      if (response.status === 404) {
        logger.debug(`No kernel found for channel ${channelId}`);
        return null;
      }
      
      if (!response.ok) {
        throw new Error(`Failed to get kernel info: ${response.status} ${response.statusText}`);
      }
      
      const data: KernelResponse = await response.json();
      return data;
    } catch (error) {
      logger.error(`Error fetching kernel info for channel ${channelId}:`, error);
      return null;
    }
  }
  
  /**
   * Release a kernel
   * @param channelId The channel ID (used as context ID)
   * @param authToken Authentication token for the kernel API
   * @returns Whether the release was successful
   */
  async releaseKernel(channelId: string, authToken: string): Promise<boolean> {
    const url = `${this.apiBaseUrl}/api/kernel/release?contextId=${channelId}`;
    logger.debug(`Releasing kernel for channel ${channelId} at: ${url}`);
    
    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to release kernel: ${response.status} ${response.statusText}`);
      }
      
      logger.info(`Successfully released kernel for channel ${channelId}`);
      return true;
    } catch (error) {
      logger.error(`Error releasing kernel for channel ${channelId}:`, error);
      return false;
    }
  }
  
  /**
   * Check and update Qdrant collection status for a channel
   * @param channel The channel to check
   * @param authToken Authentication token for the kernel API
   */
  async checkQdrantCollectionStatus(channel: Channel, authToken: string): Promise<void> {
    // This would be implemented as part of a webhook or polling mechanism
    // For now, this is a placeholder for future implementation
    logger.info(`Checking Qdrant collection status for channel ${channel.id}`);
    
    // In a real implementation, this would call an API endpoint to check status
    // or process webhook notifications from the kernel service
  }
  
  /**
   * Retry kernel creation with exponential backoff
   * @param channel The channel to retry kernel creation for
   * @param authToken Authentication token for the API
   */
  async retryKernelCreation(channel: Channel, authToken: string): Promise<void> {
    if (channel.retryCount >= this.maxRetries) {
      logger.warn(`Maximum retry count (${this.maxRetries}) reached for channel ${channel.id}`);
      return;
    }
    
    // Calculate exponential backoff delay
    const delay = this.initialRetryDelay * Math.pow(2, channel.retryCount);
    
    logger.info(`Scheduling retry #${channel.retryCount + 1} for channel ${channel.id} in ${delay}ms`);
    
    // Schedule retry
    setTimeout(async () => {
      try {
        await this.createKernel(channel, authToken);
      } catch (error) {
        logger.error(`Retry #${channel.retryCount} failed for channel ${channel.id}:`, error);
      }
    }, delay);
  }
}

// Export a singleton instance
export const kernelService = new KernelService();
```

### 2.2 Create Kernel Service Index File

Create `src/services/kernel/index.ts`:

```typescript
export { kernelService } from './kernelService';
```

## 3. Kernel Creation Approach

### 3.1 Automated Kernel Creation with Monitor Service

**IMPORTANT UPDATE (2025-05-15)**: Instead of modifying the `channelService.ts` file to explicitly create kernels, the application uses a more robust background monitoring approach:

1. New channels are created with a default `kernelStatus: 'pending'` in the database schema
2. The `KernelStatusMonitor` service (running in the background) periodically checks for channels with pending or creating status
3. The monitor automatically attempts to create kernels for pending channels and retry creation for failed ones

This approach offers several advantages:
- **Decoupling**: Channel creation and kernel creation are cleanly separated
- **Reliability**: If kernel creation fails temporarily, the monitor will keep trying
- **Batching**: The monitor can process multiple pending channels in batches
- **Simplicity**: The channel service doesn't need to know about kernel creation details

The implementation of the `KernelStatusMonitor` service is as follows:

```typescript
// src/services/kernel/kernelStatusMonitor.ts
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
    
    // Process each pending channel...
    // (implementation continued in the actual file)
  }
}

// Export singleton instance
export const kernelStatusMonitor = new KernelStatusMonitor();
```

The monitor is started in `app.ts`:

```typescript
// In app.ts, after database initialization
// Start kernel status monitor
try {
  kernelStatusMonitor.start();
  logger.info('Kernel status monitor started');
} catch (error) {
  logger.error('Failed to start kernel status monitor:', error);
  // Continue application execution even if monitor fails
}
```

## 4. Configuration Updates

### 4.1 Update Environment Configuration

Add kernel API configuration to `src/config/environment.ts`:

```typescript
// Inside the Config interface
kernelApi: {
  baseUrl: string;
  defaultModel: string;
  authType: string;
};

// Inside the config object
kernelApi: {
  baseUrl: process.env.KERNEL_API_URL || 'http://localhost:3080',
  defaultModel: process.env.KERNEL_DEFAULT_MODEL || 'gpt-4',
  authType: process.env.KERNEL_AUTH_TYPE || 'none',
},
```

## 5. API Controller Updates

### 5.1 Update Channel Controller Response

Modify `src/api/controllers/channelController.ts` to include kernel status in responses:

```typescript
// In the createChannel method, update the response
res.status(201).json({
  id: newChannel.id,
  name: newChannel.name,
  description: newChannel.description,
  status: newChannel.status,
  kernelStatus: newChannel.kernelStatus,
  qdrantCollectionStatus: newChannel.qdrantCollectionStatus,
  // other fields...
});

// Add a new method to get channel status
export const getChannelStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    // Get channel with kernel status fields
    const channel = await Channel.findByPk(id);
    
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }
    
    return res.status(200).json({
      id: channel.id,
      name: channel.name,
      kernelStatus: channel.kernelStatus,
      kernelError: channel.kernelError,
      kernelCreatedAt: channel.kernelCreatedAt,
      qdrantCollectionStatus: channel.qdrantCollectionStatus,
      qdrantCollectionError: channel.qdrantCollectionError,
      qdrantCollectionCreatedAt: channel.qdrantCollectionCreatedAt,
      retryCount: channel.retryCount,
    });
  } catch (error) {
    next(error);
  }
};

// Add a method to manually retry kernel creation
export const retryKernelCreation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const channel = await Channel.findByPk(id);
    
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }
    
    if (channel.kernelStatus !== 'failed') {
      return res.status(400).json({ message: 'Kernel is not in failed status' });
    }
    
    // Reset status to pending
    await channel.update({
      kernelStatus: 'pending',
      kernelLastUpdated: new Date()
    });
    
    // Get auth token
    const authToken = await getAuthToken();
    
    // Trigger background retry
    kernelService.createKernel(channel, authToken).catch(error => {
      logger.error(`Error in manual kernel retry for channel ${channel.id}:`, error);
    });
    
    return res.status(202).json({
      message: 'Kernel creation retry initiated',
      id: channel.id,
      kernelStatus: 'pending'
    });
  } catch (error) {
    next(error);
  }
};
```

### 5.2 Update Channel Routes

Update `src/api/routes/channelRoutes.ts`:

```typescript
// Add new routes
router.get('/:id/status', auth.authenticate(), channelController.getChannelStatus);
router.post('/:id/kernel/retry', auth.authenticate(), channelController.retryKernelCreation);
```

## 6. Status Monitoring Service

### 6.1 Create KernelStatusMonitor

Create `src/services/kernel/kernelStatusMonitor.ts`:

```typescript
import { logger } from '../../config/logger';
import Channel from '../../db/models/Channel';
import { kernelService } from './kernelService';
import { getAuthToken } from '../auth/auth0Service';
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
    
    // Get auth token for kernel API calls
    const authToken = await getAuthToken().catch(error => {
      logger.error('Failed to get auth token for kernel status check:', error);
      return null;
    });
    
    if (!authToken) {
      return;
    }
    
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
```

### 6.2 Start Monitor Service with App

Update `src/app.ts` to start the kernel status monitor:

```typescript
// Add import
import { kernelStatusMonitor } from './services/kernel/kernelStatusMonitor';

// In the server startup section, after database connection
// Start kernel status monitor
kernelStatusMonitor.start();

// Add a cleanup handler
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received.');
  kernelStatusMonitor.stop();
  // Other cleanup...
  process.exit(0);
});
```

## 7. Webhook for Qdrant Collection Status

### 7.1 Create Webhook Controller

Create `src/api/controllers/webhookController.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { logger } from '../../config/logger';
import Channel from '../../db/models/Channel';

/**
 * Handle webhook notifications from the kernel service about Qdrant collection status
 */
export const handleKernelWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { channelId, event, status, error } = req.body;
    
    if (!channelId || !event) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    logger.info(`Received kernel webhook for channel ${channelId}, event: ${event}, status: ${status}`);
    
    // Find the channel
    const channel = await Channel.findByPk(channelId);
    
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
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
        break;
        
      case 'qdrant-collection-failed':
        await channel.update({
          qdrantCollectionStatus: 'failed',
          qdrantCollectionLastUpdated: new Date(),
          qdrantCollectionError: error || 'Unknown error'
        });
        break;
        
      default:
        logger.warn(`Unknown webhook event: ${event}`);
    }
    
    // Return success
    return res.status(200).json({ message: 'Webhook processed successfully' });
  } catch (error) {
    logger.error('Error processing kernel webhook:', error);
    next(error);
  }
};
```

### 7.2 Add Webhook Route

Create `src/api/routes/webhookRoutes.ts`:

```typescript
import express from 'express';
import * as webhookController from '../controllers/webhookController';

const router = express.Router();

router.post('/kernel', webhookController.handleKernelWebhook);

export default router;
```

Add to `src/api/index.ts`:

```typescript
import webhookRoutes from './routes/webhookRoutes';

// Add to routes section
app.use('/api/webhooks', webhookRoutes);
```

## 8. Testing Strategy

### 8.1 Unit Tests for KernelService

Create `tests/unit/services/kernel/kernelService.test.ts`:

```typescript
import { kernelService } from '../../../../src/services/kernel/kernelService';
import Channel from '../../../../src/db/models/Channel';
import fetch from 'node-fetch';

// Mock fetch
jest.mock('node-fetch', () => jest.fn());

// Mock Channel model
jest.mock('../../../../src/db/models/Channel', () => ({
  update: jest.fn().mockResolvedValue(true)
}));

describe('KernelService', () => {
  let mockChannel: any;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock channel
    mockChannel = {
      id: 'test-channel-id',
      update: jest.fn().mockResolvedValue(true),
      retryCount: 0
    };
  });
  
  describe('createKernel', () => {
    it('should successfully create a kernel', async () => {
      // Mock successful API response
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          userId: 'user-123',
          contextId: 'test-channel-id',
          lastAccessTime: '2023-05-13T12:34:56.789Z'
        })
      });
      
      const result = await kernelService.createKernel(mockChannel, 'test-token');
      
      // Check channel was updated with creating status
      expect(mockChannel.update).toHaveBeenCalledWith({
        kernelStatus: 'creating',
        kernelLastUpdated: expect.any(Date)
      });
      
      // Check fetch was called with correct params
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/kernel/create'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token'
          }),
          body: expect.stringContaining('"contextId":"test-channel-id"')
        })
      );
      
      // Check channel was updated with success status
      expect(mockChannel.update).toHaveBeenCalledWith({
        kernelStatus: 'created',
        kernelCreatedAt: expect.any(Date),
        kernelLastUpdated: expect.any(Date),
        kernelError: null
      });
      
      // Check result
      expect(result).toEqual({
        userId: 'user-123',
        contextId: 'test-channel-id',
        lastAccessTime: '2023-05-13T12:34:56.789Z'
      });
    });
    
    it('should handle API errors', async () => {
      // Mock failed API response
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: jest.fn().mockResolvedValue('API Error')
      });
      
      await expect(kernelService.createKernel(mockChannel, 'test-token')).rejects.toThrow();
      
      // Check channel was updated with error status
      expect(mockChannel.update).toHaveBeenCalledWith({
        kernelStatus: 'failed',
        kernelLastUpdated: expect.any(Date),
        kernelError: expect.stringContaining('500 Internal Server Error'),
        retryCount: 1
      });
    });
  });
  
  // Additional tests for getKernelInfo, releaseKernel, etc.
});
```

### 8.2 Integration Tests

Create `tests/integration/api/controllers/channelController.test.ts` with additional tests for kernel integration.

## 9. Deployment Guide

### 9.1 Database Setup

Since the application is not in production yet, the database schema changes are included directly in the `database/init.sql` file. When deploying:

```bash
# Rebuild the postgres container with updated schema
docker-compose down
docker-compose up -d postgres

# Or for a completely fresh database (this will delete all existing data):
docker volume rm rag-widget_postgres_data
docker-compose up -d postgres
```

### 9.2 Environment Variables

Add the following environment variables to your deployment:

```
KERNEL_API_URL=http://chat-copilot-webapi:8080
KERNEL_DEFAULT_MODEL=gpt-4
KERNEL_AUTH_TYPE=none
```

### 9.3 Deployment Order

Follow this order to deploy the components:

1. Deploy database migration
2. Deploy updated API service
3. Deploy or update chat-copilot-webapi 
4. Configure Qdrant (if needed)

### 9.4 Verification Steps

After deployment, verify the integration is working:

1. Create a new channel through the API
2. Check the channel status endpoint to verify kernel creation
3. Test the chat functionality to ensure it's using the kernel