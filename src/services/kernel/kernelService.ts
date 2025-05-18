import { config } from '../../config/environment';
import Channel from '../../db/models/Channel';
import { tokenService } from '../auth/tokenService';

// Create a simple logger
  const logger = {
    debug: (message: string, data?: any) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[KERNEL DEBUG] ${message}`, data || '');
      }
    },
    error: (message: string, data?: any) => {
      console.error(`[KERNEL ERROR] ${message}`, data || '');
    }
  };

// Type for authentication fetch function
type AuthenticatedFetch = (url: string, options?: RequestInit) => Promise<Response>;

// Define interfaces for request/response types
interface KernelCreateRequest {
  contextId: string;
  userId?: string; // Add userId field
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
  private authenticatedFetch: AuthenticatedFetch | null = null;
  
  constructor() {
    // Use the webapi URL from configuration
    this.apiBaseUrl = config.kernelApi?.baseUrl || 'http://localhost:3080';
    logger.debug(`KernelService initialized with API base URL: ${this.apiBaseUrl}`);
  }
  
  /**
   * Set the authenticated fetch function to use for token retrieval
   * @param fetch The authenticated fetch function to use
   */
  setAuthenticatedFetch(fetch: AuthenticatedFetch) {
    this.authenticatedFetch = fetch;
    logger.debug('Authenticated fetch function set');
  }
  
  /**
   * Get an authentication token for the chat-copilot webapi
   * Uses either frontend authenticatedFetch (if available) or backend tokenService
   * @returns Promise resolving to the access token
   */
  async getAuthToken(): Promise<string> {
    try {
      // If authenticatedFetch is set (frontend context), use it
      if (this.authenticatedFetch) {
        logger.debug('Getting auth token using authenticatedFetch (frontend context)');
        const tokenResponse = await this.authenticatedFetch('/api/auth/token');
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.accessToken;
        
        if (!accessToken) {
          throw new Error('Failed to get access token using authenticatedFetch');
        }
        
        logger.debug('Authentication token obtained from frontend context');
        return accessToken;
      } 
      
      // Otherwise use the backend tokenService (server-side context)
      logger.debug('Getting auth token using tokenService (backend context)');
      
      try {
        const accessToken = await tokenService.getToken();
        
        // In case the token service returns an empty string (for development with auth=none)
        // we should allow it through rather than treating it as an error
        if (accessToken === '') {
          logger.debug('Empty token received from tokenService (likely in development mode)');
          return accessToken;
        }
        
        if (!accessToken) {
          throw new Error('Failed to get access token from tokenService');
        }
        
        logger.debug('Authentication token obtained from tokenService');
        return accessToken;
      } catch (tokenError) {
        // Handle token service errors based on auth type
        if (config.kernelApi?.authType?.toLowerCase() === 'none') {
          logger.debug('Token service failed, but auth type is "none" - proceeding with empty token');
          return '';
        }
        
        // Rethrow if we can't handle this error
        throw tokenError;
      }
    } catch (error) {
      logger.error('Error getting auth token:', error);
      
      // Check if we can proceed without a token
      if (config.kernelApi?.authType?.toLowerCase() === 'none') {
        logger.debug('Returning empty token because auth type is "none"');
        return '';
      }
      
      throw new Error('Failed to get authentication token: ' + (error instanceof Error ? error.message : String(error)));
    }
  }
  
  /**
   * Create a kernel for a channel
   * @param channel The channel to create a kernel for
   * @param authToken Optional manual token override (if not provided, getAuthToken will be used)
   * @returns The kernel response
   */
  async createKernel(channel: Channel, authToken?: string): Promise<KernelResponse> {
    const url = `${this.apiBaseUrl}/api/kernel/create`;
    logger.debug(`Creating kernel for channel ${channel.id} at: ${url}`);
    
    // Update channel status to creating
    await channel.update({
      kernelStatus: 'creating',
      kernelLastUpdated: new Date()
    });
    
    // Prepare request payload
    const payload: KernelCreateRequest = {
      contextId: channel.id,
      userId: channel.userId, // Include the channel's userId
      completionOptions: {
        modelId: config.kernelApi?.defaultModel || 'gpt-4',
        temperature: 0.7,
      },
      enabledPlugins: ['YouTubePlugin']
    };
    
    logger.debug(`Creating kernel with userId ${channel.userId} and contextId ${channel.id}`);
    
    try {
      // Get auth token if not provided
      const token = authToken || await this.getAuthToken();
      
      // Prepare headers with Authorization
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        // Add custom headers for user identification when using pass-through authentication
        'X-User-Id': channel.userId, // Use the channel's userId
        'X-User-Name': 'Channel User' // Default name
      };
      
      // Only add Authorization header if token is not empty
      if (token !== '') {
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        logger.debug('Making request without Authorization header - empty token');
        logger.debug(`Using X-User-Id header: ${channel.userId}`);
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
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
      
      logger.debug(`Successfully created kernel for channel ${channel.id}`);
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
   * @param authToken Optional manual token override (if not provided, getAuthToken will be used)
   * @returns The kernel info
   */
  async getKernelInfo(channelId: string, authToken?: string): Promise<KernelResponse | null> {
    const url = `${this.apiBaseUrl}/api/kernel/info?contextId=${channelId}`;
    logger.debug(`Fetching kernel info for channel ${channelId} at: ${url}`);
    
    try {
      // Look up the channel to get its userId
      const channel = await Channel.findByPk(channelId);
      if (!channel) {
        logger.error(`Channel not found: ${channelId}`);
        return null;
      }
      
      // Get auth token if not provided
      const token = authToken || await this.getAuthToken();
      
      // Prepare headers with Authorization
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        // Add custom headers for user identification when using pass-through authentication
        'X-User-Id': channel.userId, // Use the actual channel's userId
        'X-User-Name': 'Channel User'
      };
      
      // Only add Authorization header if token is not empty
      if (token !== '') {
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        logger.debug('Making request without Authorization header - empty token');
        logger.debug(`Using X-User-Id header: ${channel.userId}`);
      }
      
      const response = await fetch(url, {
        method: 'GET',
        headers
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
   * @param authToken Optional manual token override (if not provided, getAuthToken will be used)
   * @returns Whether the release was successful
   */
  async releaseKernel(channelId: string, authToken?: string): Promise<boolean> {
    const url = `${this.apiBaseUrl}/api/kernel/release?contextId=${channelId}`;
    logger.debug(`Releasing kernel for channel ${channelId} at: ${url}`);
    
    try {
      // Look up the channel to get its userId
      const channel = await Channel.findByPk(channelId);
      if (!channel) {
        logger.error(`Channel not found: ${channelId}`);
        return false;
      }
      
      // Get auth token if not provided
      const token = authToken || await this.getAuthToken();
      
      // Prepare headers with Authorization
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        // Add custom headers for user identification when using pass-through authentication
        'X-User-Id': channel.userId, // Use the actual channel's userId
        'X-User-Name': 'Channel User'
      };
      
      // Only add Authorization header if token is not empty
      if (token !== '') {
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        logger.debug('Making request without Authorization header - empty token');
        logger.debug(`Using X-User-Id header: ${channel.userId}`);
      }
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to release kernel: ${response.status} ${response.statusText}`);
      }
      
      logger.debug(`Successfully released kernel for channel ${channelId}`);
      return true;
    } catch (error) {
      logger.error(`Error releasing kernel for channel ${channelId}:`, error);
      return false;
    }
  }
  
  /**
   * Check and update Qdrant collection status for a channel
   * @param channel The channel to check
   * @param authToken Optional manual token override (if not provided, getAuthToken will be used)
   */
  async checkQdrantCollectionStatus(channel: Channel, authToken?: string): Promise<void> {
    // This would be implemented as part of a webhook or polling mechanism
    // For now, this is a placeholder for future implementation
    logger.debug(`Checking Qdrant collection status for channel ${channel.id}`);
    
    // In a real implementation, this would call an API endpoint to check status
    // or process webhook notifications from the kernel service
    
    // Example of how it might be implemented with token:
    /*
    try {
      // Get auth token if not provided
      const token = authToken || await this.getAuthToken();
      
      // Make API call with token
      // ...
    } catch (error) {
      logger.error(`Error checking Qdrant collection status for channel ${channel.id}:`, error);
    }
    */
  }
  
  /**
   * Retry kernel creation with exponential backoff
   * @param channel The channel to retry kernel creation for
   * @param authToken Optional manual token override (if not provided, getAuthToken will be used)
   */
  async retryKernelCreation(channel: Channel, authToken?: string): Promise<void> {
    if (channel.retryCount >= this.maxRetries) {
      logger.debug(`Maximum retry count (${this.maxRetries}) reached for channel ${channel.id}`);
      return;
    }
    
    // Calculate exponential backoff delay
    const delay = this.initialRetryDelay * Math.pow(2, channel.retryCount);
    
    logger.debug(`Scheduling retry #${channel.retryCount + 1} for channel ${channel.id} in ${delay}ms`);
    
    // Schedule retry
    setTimeout(async () => {
      try {
        // Get a fresh token for the retry if no manual token is provided
        // This is important as the token might expire between retries
        let token: string | undefined = authToken;
        if (!token) {
          try {
            token = await this.getAuthToken();
          } catch (tokenError) {
            logger.error(`Failed to get auth token for retry #${channel.retryCount + 1}:`, tokenError);
            // Continue with the retry attempt without a token
            // The createKernel method will try to get a token again
          }
        }
        
        await this.createKernel(channel, token);
      } catch (error) {
        logger.error(`Retry #${channel.retryCount} failed for channel ${channel.id}:`, error);
      }
    }, delay);
  }
}

// Export a singleton instance
export const kernelService = new KernelService();