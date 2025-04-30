import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { HubConnection } from '@microsoft/signalr';
import { chatService, signalRService, ChatSession, ChatMessage, ConnectionStatus } from '../../services/chat';
import { UserProfileResponse, ChannelResponse } from '../../types/api';
import { SidebarLayout } from '../../components/sidebar-layout';
import { 
  Sidebar, 
  SidebarHeader, 
  SidebarBody, 
  SidebarFooter, 
  SidebarItem, 
  SidebarLabel,
  SidebarSection,
  SidebarSpacer
} from '../../components/sidebar';
import { Navbar, NavbarItem, NavbarSection, NavbarSpacer } from '../../components/navbar';
import { Dropdown, DropdownButton, DropdownMenu, DropdownItem, DropdownLabel, DropdownDivider } from '../../components/dropdown';
import { Avatar } from '../../components/avatar';
import { Heading } from '../../components/heading';
import { Text } from '../../components/text';
import { Button } from '../../components/button';
import { Badge } from '../../components/badge';
import {
  ArrowRightStartOnRectangleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Cog8ToothIcon,
  LightBulbIcon,
  ShieldCheckIcon,
  UserCircleIcon,
  VideoCameraIcon,
  CodeBracketIcon,
  ChevronLeftIcon,
  PaperAirplaneIcon
} from '@heroicons/react/16/solid';
import {
  Cog6ToothIcon,
  HomeIcon,
  QuestionMarkCircleIcon,
  SparklesIcon,
} from '@heroicons/react/20/solid';

interface ChannelChatProps {
  authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>;
  user?: UserProfileResponse['user'] | null;
}

function AccountDropdownMenu({ 
  anchor, 
  userName,
  onLogout 
}: { 
  anchor: 'top start' | 'bottom end'; 
  userName?: string;
  onLogout?: () => void;
}) {
  return (
    <DropdownMenu className="min-w-64" anchor={anchor}>
      <DropdownItem href="/settings/account">
        <UserCircleIcon />
        <DropdownLabel>My Account</DropdownLabel>
      </DropdownItem>
      <DropdownDivider />
      <DropdownItem href="/settings/preferences">
        <Cog8ToothIcon />
        <DropdownLabel>Preferences</DropdownLabel>
      </DropdownItem>
      <DropdownDivider />
      <DropdownItem href="#">
        <ShieldCheckIcon />
        <DropdownLabel>Privacy policy</DropdownLabel>
      </DropdownItem>
      <DropdownItem href="#">
        <LightBulbIcon />
        <DropdownLabel>Share feedback</DropdownLabel>
      </DropdownItem>
      <DropdownDivider />
      <DropdownItem onClick={onLogout}>
        <ArrowRightStartOnRectangleIcon />
        <DropdownLabel>Sign out</DropdownLabel>
      </DropdownItem>
    </DropdownMenu>
  )
}

// Local message interface for UI display
interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

const ChannelChat: React.FC<ChannelChatProps> = ({ authenticatedFetch, user: initialUser }) => {
  const { channelId } = useParams<{ channelId: string }>();
  const [user, setUser] = useState<UserProfileResponse['user'] | null>(initialUser || null);
  const [channel, setChannel] = useState<ChannelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingChat, setLoadingChat] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [isTyping, setIsTyping] = useState(false);
  const [chatSession, setChatSession] = useState<ChatSession | null>(null);
  
  // SignalR connection ref
  const connectionRef = useRef<HubConnection | null>(null);
  
  // Chat messages state
  const [messages, setMessages] = useState<Message[]>([]);

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
  
  // Get an authentication token for the chat-copilot webapi
  const getAuthToken = async (): Promise<string> => {
    try {
      const tokenResponse = await authenticatedFetch('/api/auth/token');
      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.accessToken;
      
      if (!accessToken) {
        throw new Error('Failed to get access token');
      }
      
      return accessToken;
    } catch (error) {
      logger.error('Error getting auth token:', error);
      throw error;
    }
  };

  // Initialize chat session and load chat history
  const initializeChatSession = useCallback(async () => {
    try {
      setLoadingChat(true);
      logger.debug(`Initializing chat session for channel ${channelId}`);
      
      // Get authentication token
      const accessToken = await getAuthToken();
      logger.debug('Authentication token obtained');
      
      // Get or create chat session for this channel
      logger.debug(`Getting or creating chat session for channel ${channelId}`);
      const session = await chatService.getOrCreateChatSession(channelId, accessToken);
      setChatSession(session);
      logger.debug('Chat session initialized:', session);
      
      // Load chat messages with pagination parameters
      logger.debug(`Loading messages for chat session ${session.id}`);
      const chatMessages = await chatService.getChatMessages(session.id, accessToken, 0, -1);
      logger.debug(`Loaded ${chatMessages?.length || 0} messages`);
      
      // Convert API messages to our local format if any exist
      const formattedMessages: Message[] = [];
      if (chatMessages && chatMessages.length > 0) {
        chatMessages.forEach(msg => {
          if (msg && msg.id && msg.content) {
            formattedMessages.push({
              id: msg.id,
              content: msg.content,
              sender: msg.role === 'user' ? 'user' : 'assistant',
              timestamp: new Date(msg.createdOn)
            });
          }
        });
      }
      
      setMessages(formattedMessages);
      setLoadingChat(false);
      
      return session;
    } catch (error: any) {
      // More detailed error logging and handling
      logger.error(`Error initializing chat session: ${error.message}`, error);
      
      // Show more specific error messages based on the error
      if (error.message?.includes('404')) {
        setError('Chat service endpoint not found. Please check if the chat-copilot service is running.');
      } else if (error.message?.includes('401')) {
        setError('Authentication error connecting to chat service. Please try logging out and back in.');
      } else if (error.message?.includes('Failed to fetch')) {
        setError('Network error connecting to chat service. Please check your connection and try again.');
      } else {
        setError(`Failed to initialize chat session: ${error.message}`);
      }
      
      setLoadingChat(false);
      throw error;
    }
  }, [channelId, authenticatedFetch]);
  
  // Initialize SignalR connection
  const initializeSignalRConnection = useCallback(async (chatSessionId: string) => {
    try {
      logger.debug('Initializing SignalR connection to chat-copilot webapi');
      
      // Validate chat session ID to prevent ArgumentNullException
      if (!chatSessionId || chatSessionId.trim() === '') {
        throw new Error('Cannot initialize SignalR connection: chat session ID is missing or empty');
      }
      
      setConnectionStatus('connecting');
      
      // Get access token for authenticating with SignalR
      const accessToken = await getAuthToken();
      
      // Create the connection
      const connection = signalRService.createHubConnection(accessToken);
      
      // Set up connection event handlers
      connection.onclose((error) => {
        logger.debug('SignalR connection closed', error);
        setConnectionStatus('disconnected');
      });
      
      connection.onreconnecting((error) => {
        logger.debug('SignalR reconnecting', error);
        setConnectionStatus('reconnecting');
      });
      
      connection.onreconnected((connectionId) => {
        logger.debug('SignalR reconnected', connectionId);
        setConnectionStatus('connected');
      });
      
      // Set up message handlers
      // Handle incoming messages from the bot
      connection.on('ReceiveMessage', (chatId, senderId, message) => {
        logger.debug('Received message from SignalR:', { chatId, senderId, message });
        
        // Only process messages for our chat session
        if (chatId !== chatSessionId) return;
        
        // Add message to our local state
        if (message && message.content) {
          const newMessage: Message = {
            id: message.id || Math.random().toString(36).substring(2, 9),
            content: message.content,
            sender: 'assistant',
            timestamp: new Date()
          };
          
          setMessages(prev => [...prev, newMessage]);
          setIsTyping(false);
        }
      });
      
      // Handle bot response status (generating/typing)
      connection.on('ReceiveBotResponseStatus', (chatId, status) => {
        logger.debug('Received bot status:', { chatId, status });
        
        // Only process status updates for our chat session
        if (chatId !== chatSessionId) return;
        
        // Update typing indicator based on status
        setIsTyping(status === 'generating');
      });
      
      // Store the connection in ref
      connectionRef.current = connection;
      
      // Start the connection
      await signalRService.startConnection(connection);
      logger.debug('SignalR connection established successfully');
      
      // Double-check that we have a valid chat session ID before joining group
      if (chatSessionId && chatSessionId.trim() !== '') {
        // Join the chat group to receive updates for this specific chat
        await signalRService.joinChatGroup(connection, chatSessionId);
        logger.debug(`Joined chat group for session ${chatSessionId}`);
      } else {
        logger.error('Could not join chat group: invalid chat session ID');
      }
      
      setConnectionStatus('connected');
      
    } catch (error) {
      logger.error('Error establishing SignalR connection:', error);
      setConnectionStatus('error');
      setError('Failed to connect to chat service. Please try refreshing the page.');
    }
  }, [getAuthToken]);
  
  // Track connection attempts to prevent race conditions
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const hasInitializedRef = useRef<boolean>(false);
  
  // Initialize chat session and SignalR connection
  useEffect(() => {
    // Prevent multiple initializations if already in progress
    if (isConnecting) {
      logger.debug('Connection initialization already in progress, skipping');
      return;
    }
    
    // Prevent re-initialization if already completed successfully
    if (hasInitializedRef.current && connectionRef.current && connectionStatus === 'connected') {
      logger.debug('Connection already established, skipping initialization');
      return;
    }
    
    const initializeChat = async () => {
      try {
        setIsConnecting(true);
        logger.debug('Starting connection initialization process');
        
        // First initialize the chat session
        const session = await initializeChatSession();
        
        // Verify we have a valid session with an ID before attempting SignalR connection
        if (session && session.id && session.id.trim() !== '') {
          logger.debug(`Valid chat session obtained with ID: ${session.id}`);
          await initializeSignalRConnection(session.id);
          hasInitializedRef.current = true;
        } else {
          logger.error('Failed to initialize SignalR: Invalid chat session or missing session ID');
          setError('Could not establish chat session. Please try refreshing the page.');
        }
      } catch (error) {
        logger.error('Error initializing chat:', error);
      } finally {
        setIsConnecting(false);
      }
    };
    
    initializeChat();
    
    // Clean up connection on unmount
    return () => {
      // Use a debounced cleanup to prevent race conditions with connection attempts
      const connection = connectionRef.current;
      if (connection) {
        logger.debug('Stopping SignalR connection on unmount');
        // Small timeout to ensure we don't close during negotiation
        setTimeout(() => {
          if (connectionRef.current === connection) {
            signalRService.stopConnection(connection)
              .then(() => {
                connectionRef.current = null;
                logger.debug('SignalR connection successfully stopped');
              })
              .catch(err => {
                logger.error('Error stopping SignalR connection:', err);
              });
          }
        }, 100);
      }
    };
  }, [channelId]); // Only re-run when channelId changes

  // Function to handle user logout
  const handleLogout = async (): Promise<void> => {
    try {
      await authenticatedFetch('/api/auth/logout', {
        method: 'POST'
      });
      
      // Redirect to test landing page after logout
      window.location.href = 'http://localhost:3003';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Function to send a message using the HTTP API
  const handleSendMessage = async () => {
    if (!inputValue.trim() || !chatSession) return;
    
    // Check if we have an active chat session
    if (!chatSession) {
      logger.error('Cannot send message: No active chat session');
      setError('No active chat session. Please refresh the page.');
      return;
    }
    
    try {
      // Create message object with a temporary ID
      const messageId = Math.random().toString(36).substring(2, 9);
      const userMessage: Message = {
        id: messageId,
        content: inputValue,
        sender: 'user',
        timestamp: new Date()
      };
      
      // Add to UI immediately (optimistic update)
      setMessages(prev => [...prev, userMessage]);
      setInputValue('');
      
      // Show typing indicator while waiting for response
      setIsTyping(true);
      
      // Get auth token
      const accessToken = await getAuthToken();
      
      // Send message via HTTP API
      await chatService.sendChatMessage(
        chatSession.id,
        userMessage.content,
        channelId, // Use channel ID as context
        accessToken
      );
      
      logger.debug('Message sent via HTTP API', messageId);
      
      // Note: We don't need to handle the bot response here
      // The bot's response will come through the SignalR connection
      
    } catch (error) {
      logger.error('Error sending message:', error);
      setError('Failed to send message. Please try again.');
      setIsTyping(false);
    }
  };

  // Handle input enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <SidebarLayout
      sidebar={
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center">
              <img src="/logo.svg" alt="RAG Widget" className="h-8 w-8 mr-2" />
              <span className="text-lg font-bold">RAG Widget</span>
            </div>
          </SidebarHeader>

          <SidebarBody>
            <SidebarSection>
              <SidebarItem href="/dashboard">
                <HomeIcon />
                <SidebarLabel>Dashboard</SidebarLabel>
              </SidebarItem>
              <SidebarItem current href="/channels">
                <VideoCameraIcon />
                <SidebarLabel>Channels</SidebarLabel>
              </SidebarItem>
              <SidebarItem href="/widgets">
                <CodeBracketIcon />
                <SidebarLabel>Widgets</SidebarLabel>
              </SidebarItem>
              <SidebarItem href="/settings">
                <Cog6ToothIcon />
                <SidebarLabel>Settings</SidebarLabel>
              </SidebarItem>
            </SidebarSection>

            <SidebarSpacer />

            <SidebarSection>
              <SidebarItem href="#">
                <QuestionMarkCircleIcon />
                <SidebarLabel>Support</SidebarLabel>
              </SidebarItem>
              <SidebarItem href="#">
                <SparklesIcon />
                <SidebarLabel>Changelog</SidebarLabel>
              </SidebarItem>
            </SidebarSection>
          </SidebarBody>

          <SidebarFooter className="max-lg:hidden">
            <Dropdown>
              <DropdownButton as={SidebarItem}>
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar 
                    src={user?.picture}
                    className="size-6"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm/5 font-medium text-zinc-950 dark:text-white">{user?.name}</span>
                    <span className="block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400">
                      {user?.email}
                    </span>
                  </span>
                </span>
                <ChevronUpIcon />
              </DropdownButton>
              <AccountDropdownMenu anchor="top start" onLogout={handleLogout} />
            </Dropdown>
          </SidebarFooter>
        </Sidebar>
      }
      navbar={
        <Navbar>
          <NavbarSection>
            <div className="flex items-center">
              <Link to={`/channels/${channelId}`} className="mr-2">
                <Button color="zinc">
                  <ChevronLeftIcon className="w-4 h-4 mr-1" />
                  Back to Channel
                </Button>
              </Link>
              <Heading level={1} className="text-lg font-medium">Channel Chat</Heading>
            </div>
          </NavbarSection>
          <NavbarSpacer />
          <NavbarSection>
            <Dropdown>
              <DropdownButton as={NavbarItem}>
                <Avatar 
                  src={user?.picture}
                  className="size-6" 
                />
              </DropdownButton>
              <AccountDropdownMenu anchor="bottom end" userName={user?.name} onLogout={handleLogout} />
            </Dropdown>
          </NavbarSection>
        </Navbar>
      }
    >
      {/* Chat Interface */}
      <div className="flex flex-col h-[calc(100vh-10rem)]">
        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto mb-4 p-4 border rounded-lg bg-gray-50 dark:bg-zinc-800">
          {loading || loadingChat ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-pulse text-gray-500">Loading chat history...</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex justify-center items-center h-full">
              <div className="text-gray-500">No messages yet. Start a conversation!</div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div 
                  key={message.id} 
                  className={`mb-4 ${message.sender === 'user' ? 'text-right' : ''}`}
                >
                  <div 
                    className={`inline-block max-w-[80%] p-3 rounded-lg ${
                      message.sender === 'user' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-white text-gray-800 dark:bg-zinc-700 dark:text-gray-100'
                    }`}
                  >
                    <p>{message.content}</p>
                    <div className={`text-xs mt-1 ${
                      message.sender === 'user'
                        ? 'text-blue-100'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Typing indicator */}
              {isTyping && (
                <div className="mb-4">
                  <div className="inline-block max-w-[80%] p-3 rounded-lg bg-white text-gray-800 dark:bg-zinc-700 dark:text-gray-100">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '600ms' }}></div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Message Input */}
        <div className="flex flex-col">
          {/* Connection status message */}
          {connectionStatus !== 'connected' && (
            <div className={`mb-2 text-sm text-center ${
              connectionStatus === 'connecting' || connectionStatus === 'reconnecting' 
                ? 'text-yellow-500' 
                : 'text-red-500'
            }`}>
              {connectionStatus === 'connecting' && 'Connecting to chat service...'}
              {connectionStatus === 'reconnecting' && 'Reconnecting to chat service...'}
              {connectionStatus === 'error' && 'Error connecting to chat service. Please refresh.'}
              {connectionStatus === 'disconnected' && 'Disconnected from chat service. Please refresh.'}
            </div>
          )}
          
          {/* Error message */}
          {error && (
            <div className="mb-2 text-sm text-center text-red-500">
              {error}
            </div>
          )}
          
          <div className="flex items-center">
            <textarea
              className="flex-1 p-3 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
              placeholder={
                connectionStatus !== 'connected' 
                  ? 'Connecting to chat service...' 
                  : 'Ask a question about this channel...'
              }
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              style={{ resize: 'none' }}
              disabled={connectionStatus !== 'connected' || loading || loadingChat || isTyping}
            />
            <Button 
              color="blue" 
              className="rounded-l-none"
              onClick={handleSendMessage}
              disabled={
                !inputValue.trim() || 
                connectionStatus !== 'connected' || 
                loading || 
                loadingChat || 
                isTyping ||
                !chatSession
              }
            >
              {isTyping ? (
                <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
              ) : (
                <PaperAirplaneIcon className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
};

export default ChannelChat;