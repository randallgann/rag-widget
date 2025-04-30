/**
 * Represents a chat session with the AI assistant
 */
export interface ChatSession {
  id: string;
  title: string;
  createdOn: string;
  systemDescription?: string;
  memoryBalance?: number;
  enabledPlugins?: string[];
  contextId?: string;
}

/**
 * Represents a single message in a chat session
 */
export interface ChatMessage {
  id: string;
  chatId: string;
  role: 'user' | 'bot' | 'system';
  content: string;
  createdOn: string;
  timestamp?: string;
}

/**
 * Input parameters for sending a chat message
 */
export interface ChatMessageRequest {
  input: string;
  contextId?: string;
  variables?: { key: string, value: string }[];
}

/**
 * Response from sending a chat message
 */
export interface ChatMessageResponse {
  value: string;
  variables?: { key: string, value: string }[];
}

/**
 * Status of the SignalR connection to the chat service
 */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

/**
 * Parameters for creating a new chat session
 */
export interface CreateChatSessionRequest {
  title: string;
  contextId?: string;
}

/**
 * Response from creating a chat session
 */
export interface CreateChatSessionResponse {
  chatSession: ChatSession;
  initialBotMessage?: ChatMessage;
}