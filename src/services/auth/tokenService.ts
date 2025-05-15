import { config } from '../../config/environment';
import { auth0Service } from './auth0Service';
import { logger } from '../../config/logger';
import { getSessionForUser } from '../sessionService';

/**
 * Token management service for backend-to-backend communication
 * This service handles getting and caching access tokens for use in backend services
 * where there is no browser session or user-initiated requests
 */
class TokenService {
  private cachedToken: string | null = null;
  private tokenExpiry: number = 0;
  private refreshing: boolean = false;
  private refreshPromise: Promise<string> | null = null;
  
  // Service account details - for a real production app, these would likely
  // come from environment variables or a secure secret management system
  private readonly serviceUserId: string = config.auth?.serviceAccount?.userId || 'service-account';
  
  constructor() {
    logger.info('TokenService initialized');
  }
  
  /**
   * Get a valid access token for service-to-service communication
   * If a cached token exists and is valid, it will be returned
   * Otherwise, a new token will be fetched
   * 
   * @returns Promise resolving to an access token
   */
  async getToken(): Promise<string> {
    // Check if we already have a valid token
    if (this.cachedToken && Date.now() < this.tokenExpiry) {
      logger.debug('Using cached token');
      return this.cachedToken;
    }
    
    // If we're already refreshing, wait for that to complete
    if (this.refreshing && this.refreshPromise) {
      logger.debug('Token refresh in progress, waiting for completion');
      return this.refreshPromise;
    }
    
    // Otherwise, start a new refresh
    this.refreshing = true;
    this.refreshPromise = this.fetchNewToken();
    
    try {
      const token = await this.refreshPromise;
      return token;
    } finally {
      this.refreshing = false;
      this.refreshPromise = null;
    }
  }
  
  /**
   * Fetch a new access token
   * Uses different methods depending on the configuration and availability of tokens:
   * 1. Try to use refresh token from session
   * 2. For kernel API specifically, use kernelAuthType from config
   * 
   * @returns Promise resolving to an access token
   */
  private async fetchNewToken(): Promise<string> {
    try {
      logger.debug('Fetching new access token for service-to-service communication');
      
      // Check if we're specifically configured for the kernel API
      if (config.kernelApi?.authType) {
        const authType = config.kernelApi.authType.toLowerCase();
        
        // Handle different auth types for kernel API
        if (authType === 'none' || authType === 'noauth') {
          // For development/testing, return empty string if no auth required
          logger.debug('Using no authentication for kernel API (development mode)');
          this.cachedToken = '';
          this.tokenExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
          return this.cachedToken;
        } else if (authType === 'apikey' && config.kernelApi.apiKey) {
          // For API key authentication
          logger.debug('Using API key authentication for kernel API');
          this.cachedToken = config.kernelApi.apiKey;
          this.tokenExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
          return this.cachedToken;
        }
        // Fall through to regular OAuth flow if not handled above
      }
      
      // Try to get the service user session from the database
      const serviceSession = await getSessionForUser(this.serviceUserId);
      
      if (!serviceSession || !serviceSession.refreshToken) {
        // Use direct refresh token from environment variables if available
        const directRefreshToken = config.auth?.serviceAccount?.refreshToken || 
                                   process.env.SERVICE_ACCOUNT_REFRESH_TOKEN;
        
        if (!directRefreshToken) {
          logger.warn('No refresh token available for service account. Consider setting SERVICE_ACCOUNT_REFRESH_TOKEN');
          
          // For development purposes only, return empty token if we're in dev mode
          if (process.env.NODE_ENV === 'development') {
            logger.debug('Returning empty token for development environment');
            this.cachedToken = '';
            this.tokenExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
            return this.cachedToken;
          }
          
          throw new Error('Service account session not found or missing refresh token');
        }
        
        logger.debug('Using refresh token from environment variable');
        
        // Use the direct refresh token to get a new access token
        const tokenResponse = await auth0Service.refreshToken(directRefreshToken);
        
        if (!tokenResponse.access_token) {
          throw new Error('Failed to get access token from Auth0 using direct refresh token');
        }
        
        // Cache the token
        this.cachedToken = tokenResponse.access_token;
        
        // Set expiry time (subtract 5 minutes to allow for clock skew and network latency)
        const expiresIn = tokenResponse.expires_in || 3600; // Default to 1 hour if not specified
        this.tokenExpiry = Date.now() + (expiresIn * 1000) - (5 * 60 * 1000);
        
        return this.cachedToken;
      }
      
      // Use the refresh token from the session to get a new access token
      logger.debug('Using refresh token from database session');
      const tokenResponse = await auth0Service.refreshToken(serviceSession.refreshToken);
      
      if (!tokenResponse.access_token) {
        throw new Error('Failed to get access token from Auth0');
      }
      
      // Cache the token
      this.cachedToken = tokenResponse.access_token;
      
      // Set expiry time (subtract 5 minutes to allow for clock skew and network latency)
      const expiresIn = tokenResponse.expires_in || 3600; // Default to 1 hour if not specified
      this.tokenExpiry = Date.now() + (expiresIn * 1000) - (5 * 60 * 1000);
      
      logger.debug('Successfully fetched new access token');
      return this.cachedToken;
    } catch (error) {
      logger.error('Error fetching access token:', error);
      throw new Error('Failed to fetch access token for service-to-service communication');
    }
  }
  
  /**
   * Force refresh the token regardless of expiry
   * Useful when a token is rejected by the API
   * 
   * @returns Promise resolving to a new access token
   */
  async forceRefreshToken(): Promise<string> {
    // Clear the cache
    this.cachedToken = null;
    this.tokenExpiry = 0;
    
    // Get a new token
    return this.getToken();
  }
  
  /**
   * Check if we have a valid cached token
   * 
   * @returns true if a valid token exists, false otherwise
   */
  hasValidToken(): boolean {
    return !!this.cachedToken && Date.now() < this.tokenExpiry;
  }
}

// Export a singleton instance
export const tokenService = new TokenService();