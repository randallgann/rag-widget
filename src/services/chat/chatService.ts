import { ChatSession, ChatMessage } from './types';

/**
 * Service for interacting with the chat-copilot webapi
 */
class ChatService {
  private readonly apiBaseUrl: string;
  
  constructor() {
    // Use the webapi URL from docker-compose
    this.apiBaseUrl = 'http://localhost:3080';
  }
  
  /**
   * Create a new chat session for a channel
   * @param channelId The ID of the channel to create a chat session for
   * @param authToken Authentication token for the API
   * @returns The created chat session
   */
  async createChatSession(channelId: string, authToken: string): Promise<ChatSession> {
    const response = await fetch(`${this.apiBaseUrl}/chats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        title: `Channel Chat - ${channelId}`,
        contextId: channelId // Use channel ID as context ID
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create chat session: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }
  
  /**
   * Get chat sessions for a specific channel
   * @param channelId The ID of the channel to get chat sessions for
   * @param authToken Authentication token for the API
   * @returns Array of chat sessions for the channel
   */
  async getChatSessionsByChannel(channelId: string, authToken: string): Promise<ChatSession[]> {
    const response = await fetch(`${this.apiBaseUrl}/chats/context/${channelId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get chat sessions: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }
  
  /**
   * Get messages for a chat session
   * @param chatId The ID of the chat session to get messages for
   * @param authToken Authentication token for the API
   * @returns Array of messages in the chat session
   */
  async getChatMessages(chatId: string, authToken: string): Promise<ChatMessage[]> {
    const response = await fetch(`${this.apiBaseUrl}/chats/${chatId}/messages`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get chat messages: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
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
    const response = await fetch(`${this.apiBaseUrl}/chats/${chatId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        input: message,
        contextId: channelId // Use channel ID as context ID
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
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
    try {
      // Try to get existing chat sessions for the channel
      const sessions = await this.getChatSessionsByChannel(channelId, authToken);
      
      // If there are existing sessions, return the most recent one
      if (sessions && sessions.length > 0) {
        // Sort by creation date (newest first)
        sessions.sort((a, b) => 
          new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime()
        );
        
        return sessions[0];
      }
    } catch (error) {
      console.error('Failed to get existing chat sessions:', error);
      // Continue to create a new session if we couldn't retrieve existing ones
    }
    
    // Create a new chat session if none exists or if we couldn't retrieve them
    return this.createChatSession(channelId, authToken);
  }
}

// Export a singleton instance
export const chatService = new ChatService();