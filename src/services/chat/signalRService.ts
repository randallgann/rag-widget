import { HubConnection, HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr';
import { ConnectionStatus } from './types';

/**
 * Service for managing SignalR connections to the chat-copilot webapi
 */
class SignalRService {
  private readonly hubUrl: string;
  
  constructor() {
    // Use the webapi hub URL from docker-compose
    this.hubUrl = 'http://localhost:3080/messageRelayHub';
  }
  
  /**
   * Initialize a SignalR connection to the message relay hub
   * @param authToken Authentication token for the connection
   * @returns The initialized connection (not started)
   */
  /**
   * Maximum number of retry attempts for connection
   */
  private readonly MAX_RETRY_ATTEMPTS = 10;
  
  /**
   * Create a new SignalR hub connection with enhanced retry mechanism
   * @param authToken Authentication token for the connection
   * @returns The initialized connection (not started)
   */
  createHubConnection(authToken: string): HubConnection {
    return new HubConnectionBuilder()
      .withUrl(this.hubUrl, {
        accessTokenFactory: () => authToken,
        withCredentials: false
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: retryContext => {
          // Stop retrying after MAX_RETRY_ATTEMPTS
          if (retryContext.previousRetryCount >= this.MAX_RETRY_ATTEMPTS) {
            console.warn(`SignalR connection failed after ${this.MAX_RETRY_ATTEMPTS} retry attempts`);
            return null; // Stop retrying
          }
          
          // Immediate first retry
          if (retryContext.previousRetryCount === 0) {
            return 0;
          }
          
          // Enhanced exponential backoff with jitter to prevent thundering herd
          // Start with 1 second, double each time with 25% jitter, max 30 seconds
          const baseDelay = 1000 * Math.pow(2, retryContext.previousRetryCount - 1);
          const maxDelay = 30000; // 30 seconds max
          
          // Add jitter (±25% of the delay)
          const jitterFactor = 0.25;
          const jitter = baseDelay * jitterFactor * (Math.random() * 2 - 1);
          
          // Calculate final delay with jitter, capped at maxDelay
          const delay = Math.min(baseDelay + jitter, maxDelay);
          
          console.debug(`SignalR reconnecting (attempt ${retryContext.previousRetryCount}/${this.MAX_RETRY_ATTEMPTS}) with delay: ${delay.toFixed(0)}ms`);
          return delay;
        }
      })
      .build();
  }
  
  /**
   * Start the SignalR connection with retry logic
   * @param connection The connection to start
   * @param maxRetryAttempts Maximum number of retry attempts (defaults to 3)
   * @param initialDelayMs Initial delay between retries in milliseconds (defaults to 1000)
   */
  async startConnection(
    connection: HubConnection, 
    maxRetryAttempts: number = 3,
    initialDelayMs: number = 1000
  ): Promise<void> {
    // Only attempt to connect if disconnected
    if (connection.state !== HubConnectionState.Disconnected) {
      console.debug(`SignalR connection already in state: ${connection.state}, skipping start`);
      return;
    }
    
    let attempts = 0;
    let lastError: Error | null = null;
    
    while (attempts <= maxRetryAttempts) {
      try {
        // If already connected, return immediately
        if (connection.state !== HubConnectionState.Disconnected) {
          return;
        }
        
        console.debug(`SignalR connection attempt ${attempts + 1}/${maxRetryAttempts + 1}`);
        await connection.start();
        console.debug('SignalR connection started successfully');
        return; // Success, exit the retry loop
      } catch (error) {
        // Track the error
        lastError = error as Error;
        attempts++;
        
        // If we've exceeded max attempts, throw the last error
        if (attempts > maxRetryAttempts) {
          console.error(`SignalR connection failed after ${maxRetryAttempts + 1} attempts`, lastError);
          throw lastError;
        }
        
        // Calculate delay with exponential backoff
        const delayMs = initialDelayMs * Math.pow(2, attempts - 1);
        console.debug(`SignalR connection failed, retrying in ${delayMs}ms`, error);
        
        // Wait before trying again
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  /**
   * Join a chat group for receiving updates for a specific chat session
   * @param connection The active SignalR connection
   * @param chatId The ID of the chat session to join
   * @throws Error if the chatId is null, undefined or empty
   * @throws Error if the connection is not in Connected state
   */
  async joinChatGroup(connection: HubConnection, chatId: string): Promise<void> {
    // Validate connection state
    if (connection.state !== HubConnectionState.Connected) {
      throw new Error('Cannot join chat group: SignalR connection is not connected');
    }
    
    // Validate chatId parameter to prevent ArgumentNullException
    if (!chatId || chatId.trim() === '') {
      throw new Error('Cannot join chat group: chatId parameter cannot be null or empty');
    }
    
    // Join the chat group on the server
    try {
      await connection.invoke('AddClientToGroupAsync', chatId);
      console.debug(`Successfully joined chat group: ${chatId}`);
    } catch (error) {
      console.error(`Error joining chat group ${chatId}:`, error);
      throw error; // Re-throw the error for the caller to handle
    }
  }
  
  /**
   * Map the hub connection state to our connection status type
   * @param state The SignalR connection state
   * @returns The mapped connection status
   */
  mapConnectionState(state: HubConnectionState): ConnectionStatus {
    switch (state) {
      case HubConnectionState.Connected:
        return 'connected';
      case HubConnectionState.Connecting:
        return 'connecting';
      case HubConnectionState.Reconnecting:
        return 'reconnecting';
      case HubConnectionState.Disconnected:
      case HubConnectionState.Disconnecting:
      default:
        return 'disconnected';
    }
  }
  
  /**
   * Stop the SignalR connection safely
   * @param connection The connection to stop
   * @param timeoutMs Maximum time to wait for clean disconnection in milliseconds
   */
  async stopConnection(connection: HubConnection, timeoutMs: number = 5000): Promise<void> {
    // If already disconnected, no action needed
    if (connection.state === HubConnectionState.Disconnected) {
      console.debug('SignalR connection already disconnected');
      return;
    }
    
    // If currently connecting, wait a moment to prevent stopping during negotiation
    if (connection.state === HubConnectionState.Connecting) {
      console.debug('SignalR connection is currently connecting, waiting before stopping');
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Create a promise that resolves when the connection is stopped
    const stopPromise = connection.stop()
      .then(() => {
        console.debug('SignalR connection stopped successfully');
      })
      .catch(error => {
        console.error('Error stopping SignalR connection:', error);
        // Even if there's an error, we consider it stopped for our purposes
      });
    
    // Create a timeout promise
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        console.warn(`SignalR connection stop timed out after ${timeoutMs}ms`);
        resolve();
      }, timeoutMs);
    });
    
    // Wait for either the stop to complete or the timeout
    await Promise.race([stopPromise, timeoutPromise]);
  }
}

// Export a singleton instance
export const signalRService = new SignalRService();