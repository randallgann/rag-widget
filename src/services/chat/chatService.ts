import { ChatSession, ChatMessage } from './types';

  // Create a simple logger
  const logger = {
    debug: (message: string, data?: any) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[CHAT DEBUG] ${message}`, data || '');
      }
    },
    error: (message: string, data?: any) => {
      console.error(`[CHAT ERROR] ${message}`, data || '');
    }
  };

/**
 * Service for interacting with the chat-copilot webapi
 */
class ChatService {
  private readonly apiBaseUrl: string;
  
  constructor() {
    // Use the webapi URL from docker-compose
    this.apiBaseUrl = 'http://localhost:3080';
    
    // Log the API base URL for debugging
    console.debug(`ChatService initialized with API base URL: ${this.apiBaseUrl}`);
  }
  
  /**
   * Create a new chat session for a channel
   * @param channelId The ID of the channel to create a chat session for
   * @param authToken Authentication token for the API
   * @returns The created chat session
   */
  async createChatSession(channelId: string, authToken: string): Promise<ChatSession> {
    const url = `${this.apiBaseUrl}/chats`;
    console.debug(`Creating chat session for channel ${channelId} at: ${url}`);
    
    const payload = {
      title: `Channel Chat - ${channelId}`,
      contextId: channelId // Use channel ID as context ID
    };
    
    console.debug('Request payload:', payload);
    
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
      
      console.debug(`Create chat session response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to create chat session: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`Failed to create chat session: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      console.debug('Successfully created chat session:', data);
      return data;
    } catch (error) {
      console.error(`Error creating chat session:`, error);
      throw error;
    }
  }
  
  /**
   * Get chat sessions for a specific channel
   * @param channelId The ID of the channel to get chat sessions for
   * @param authToken Authentication token for the API
   * @param skip Number of sessions to skip (default: 0)
   * @param count Maximum number of sessions to return (default: -1 for all sessions)
   * @returns Array of chat sessions for the channel
   */
  async getChatSessionsByChannel(channelId: string, authToken: string, skip: number = 0, count: number = -1): Promise<ChatSession[]> {
    const url = `${this.apiBaseUrl}/chats/context/${channelId}?skip=${skip}&count=${count}`;
    console.debug(`Fetching chat sessions from: ${url}`);
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      console.debug(`Chat sessions response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.debug(`No chat sessions found for channel ${channelId}`);
          // Return empty array instead of throwing error for 404
          return [];
        }
        throw new Error(`Failed to get chat sessions: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.debug(`Successfully retrieved ${data.length || 0} chat sessions`);
      return data;
    } catch (error) {
      console.error(`Error fetching chat sessions:`, error);
      throw error;
    }
  }
  
  /**
   * Get messages for a chat session
   * @param chatId The ID of the chat session to get messages for
   * @param authToken Authentication token for the API
   * @param skip Number of messages to skip (default: 0)
   * @param count Maximum number of messages to return (default: -1 for all messages)
   * @returns Array of messages in the chat session
   */
  async getChatMessages(chatId: string, authToken: string, skip: number = 0, count: number = -1): Promise<ChatMessage[]> {
    logger.debug(`Inside getChatMessages() for chatId: ${chatId}`);
    const url = `${this.apiBaseUrl}/chats/${chatId}/messages?skip=${skip}&count=${count}`;
    console.debug(`Fetching chat messages from: ${url}`);
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      console.debug(`Chat messages response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.error(`Chat session with ID ${chatId} not found or no messages available`);
          // Return empty array instead of throwing error for 404
          return [];
        }
        throw new Error(`Failed to get chat messages: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.debug(`Successfully retrieved ${data.length || 0} chat messages`);
      return data;
    } catch (error) {
      console.error(`Error fetching chat messages:`, error);
      throw error;
    }
  }
  
  /**
   * Send a message to a chat session
   * @param chatId The ID of the chat session to send the message to
   * @param message The message content to send
   * @param channelId The channel ID to use as context
   * @param authToken Authentication token for the API
   * @returns The result of sending the message
   */
  async sendChatMessage(chatId: string, message: string, channelId: string, authToken: string): Promise<any> {
    const url = `${this.apiBaseUrl}/chats/${chatId}/messages`;
    console.debug(`Sending message to chat session ${chatId} at: ${url}`);
    
    const payload = {
      input: message,
      contextId: channelId // Use channel ID as context ID
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
      
      console.debug(`Send message response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to send message: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`Failed to send message: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.debug('Successfully sent message, response:', data);
      return data;
    } catch (error) {
      console.error(`Error sending message:`, error);
      throw error;
    }
  }
  
  /**
   * Create or get an existing chat session for a channel
   * This is a convenience function that either gets the most recent chat session
   * for a channel or creates a new one if none exists
   * 
   * @param channelId The ID of the channel to get/create a chat session for
   * @param authToken Authentication token for the API
   * @returns The chat session to use
   */
  async getOrCreateChatSession(channelId: string, authToken: string): Promise<ChatSession> {
    console.debug(`Getting or creating chat session for channel: ${channelId}`);
    
    try {
      // Try to get existing chat sessions for the channel
      const sessions = await this.getChatSessionsByChannel(channelId, authToken, 0, -1);
      console.debug(`Found ${sessions?.length || 0} existing sessions for channel ${channelId}`);
      
      // If there are existing sessions, return the most recent one
      if (sessions && sessions.length > 0) {
        // Sort by creation date (newest first)
        sessions.sort((a, b) => 
          new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime()
        );
        
        console.debug(`Using existing chat session: ${sessions[0].id}`);
        return sessions[0];
      }
      
      console.debug(`No existing sessions found, creating new session for channel ${channelId}`);
    } catch (error) {
      console.error('Failed to get existing chat sessions:', error);
      console.debug('Proceeding to create a new chat session due to error');
      // Continue to create a new session if we couldn't retrieve existing ones
    }
    
    // Create a new chat session if none exists or if we couldn't retrieve them
    try {
      const newSession = await this.createChatSession(channelId, authToken);
      console.debug(`Successfully created new chat session: ${newSession.id}`);
      return newSession;
    } catch (error: any) {
      console.error('Failed to create new chat session:', error);
      throw new Error(`Unable to create or retrieve chat session: ${error.message}`);
    }
  }
}

// Export a singleton instance
export const chatService = new ChatService();