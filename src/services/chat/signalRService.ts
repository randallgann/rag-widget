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
  createHubConnection(authToken: string): HubConnection {
    return new HubConnectionBuilder()
      .withUrl(this.hubUrl, {
        accessTokenFactory: () => authToken,
        withCredentials: false
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: retryContext => {
          // Implement exponential backoff for reconnection attempts
          if (retryContext.previousRetryCount === 0) {
            return 0; // No delay for first retry
          }
          
          // Exponential backoff with a maximum of 30 seconds
          const delay = Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000);
          console.debug(`SignalR reconnecting with delay: ${delay}ms`);
          return delay;
        }
      })
      .build();
  }
  
  /**
   * Start the SignalR connection
   * @param connection The connection to start
   */
  async startConnection(connection: HubConnection): Promise<void> {
    if (connection.state === HubConnectionState.Disconnected) {
      await connection.start();
    }
  }
  
  /**
   * Join a chat group for receiving updates for a specific chat session
   * @param connection The active SignalR connection
   * @param chatId The ID of the chat session to join
   */
  async joinChatGroup(connection: HubConnection, chatId: string): Promise<void> {
    if (connection.state !== HubConnectionState.Connected) {
      throw new Error('Cannot join chat group: SignalR connection is not connected');
    }
    
    await connection.invoke('AddClientToGroupAsync', chatId);
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
   * Stop the SignalR connection
   * @param connection The connection to stop
   */
  async stopConnection(connection: HubConnection): Promise<void> {
    if (connection.state !== HubConnectionState.Disconnected) {
      await connection.stop();
    }
  }
}

// Export a singleton instance
export const signalRService = new SignalRService();