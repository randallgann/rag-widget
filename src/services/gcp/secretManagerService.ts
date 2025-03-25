import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { config } from '../../config/environment';
import { logger } from '../../config/logger';

/**
 * Service for interacting with Google Cloud Secret Manager
 */
class SecretManagerService {
  private client: SecretManagerServiceClient;
  private projectId: string;
  private cache: Map<string, { value: string; timestamp: number }> = new Map();
  private cacheTTL = 1000 * 60 * 60; // 1 hour cache TTL

  constructor() {
    // Initialize with projectId explicitly from config
    const options = {
      projectId: config.gcp.projectId,
    };
    
    // Use application default credentials
    // SecretManagerServiceClient will automatically use GOOGLE_APPLICATION_CREDENTIALS env var if set
    this.client = new SecretManagerServiceClient(options);
    this.projectId = config.gcp.projectId;
    
    logger.info(`Secret Manager service initialized for project: ${this.projectId}`);
  }

  /**
   * Gets a secret value from Secret Manager
   * Uses in-memory caching to reduce API calls
   * 
   * @param secretName Name of the secret to retrieve
   * @param version Version of the secret (defaults to 'latest')
   * @param bypassCache Whether to bypass the cache
   * @returns The secret value as a string
   */
  async getSecret(secretName: string, version = 'latest', bypassCache = false): Promise<string> {
    try {
      const cacheKey = `${secretName}:${version}`;

      // Check cache first if not bypassing
      if (!bypassCache) {
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
          logger.debug(`Using cached secret: ${secretName}`);
          return cached.value;
        }
      }

      // Construct the full resource name
      const name = `projects/${this.projectId}/secrets/${secretName}/versions/${version}`;
      
      logger.info(`Accessing secret: ${secretName} (version: ${version})`);
      
      // Access the secret
      const [response] = await this.client.accessSecretVersion({ name });
      
      if (!response.payload || !response.payload.data) {
        throw new Error(`Secret payload is empty: ${secretName}`);
      }
      
      // Get the secret value
      const secretValue = response.payload.data.toString();
      
      // Update cache
      this.cache.set(cacheKey, {
        value: secretValue,
        timestamp: Date.now()
      });
      
      return secretValue;
    } catch (error: any) {
      logger.error(`Error retrieving secret ${secretName}:`, error);
      throw new Error(`Failed to retrieve secret ${secretName}: ${error.message}`);
    }
  }

  /**
   * Gets the service account key JSON from Secret Manager and parses it
   * @returns Service account credentials JSON object
   */
  async getServiceAccountKey(): Promise<any> {
    try {
      const keySecretName = config.gcp.secretManager.serviceAccountKeySecret;
      const keyJson = await this.getSecret(keySecretName);
      
      try {
        return JSON.parse(keyJson);
      } catch (parseError: any) {
        logger.error('Failed to parse service account key JSON:', parseError);
        throw new Error('Invalid service account key format');
      }
    } catch (error: any) {
      logger.error('Error retrieving service account key:', error);
      throw new Error(`Failed to retrieve service account key: ${error.message}`);
    }
  }
}

// Export singleton instance
export const secretManagerService = new SecretManagerService();