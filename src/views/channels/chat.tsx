import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChatSession, ChatMessage, ConnectionStatus } from '../../services/chat';
import { chatService } from '../../services/chat';
import { useSignalR } from '../../contexts/SignalRContext';
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
  const [isTyping, setIsTyping] = useState(false);
  const [chatSession, setChatSession] = useState<ChatSession | null>(null);
  
  // Chat messages state
  const [messages, setMessages] = useState<Message[]>([]);
  
  // Use SignalR context instead of managing connection directly
  const { connectionStatus, joinGroup, leaveGroup, subscribe } = useSignalR();

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
      logger.debug('User information for chat session:', {
        userId: user?.id,
        userName: user?.name,
        hasUser: !!user
      });
      const session = await chatService.getOrCreateChatSession(
        channelId, 
        accessToken,
        user?.id, // Pass user ID if available
        user?.name // Pass user name if available
      );
      setChatSession(session);
      logger.debug('Chat session initialized:', session);
      
      // Load chat messages with pagination parameters
      logger.debug(`Loading messages for chat session ${session.id}`);
      const chatMessages = await chatService.getChatMessages(
        session.id, 
        accessToken, 
        0, 
        -1,
        user?.id, // Pass user ID if available
        user?.name // Pass user name if available
      );
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
      
      throw error;
    } finally {
      // Always set loadingChat to false when done, even if there's an error
      setLoadingChat(false);
    }
  }, [channelId, authenticatedFetch]);
  
  // No longer need initializeSignalRConnection - this is handled by the context
  
  // Initialize chat session
  useEffect(() => {
    const initializeChat = async () => {
      try {
        logger.debug('Initializing chat session');
        setLoading(true);
        
        // Verify we have a valid channelId
        if (!channelId) {
          throw new Error('Cannot initialize chat: Missing channelId parameter');
        }
        
        // Wait for connection to be established first
        if (connectionStatus !== 'connected') {
          logger.debug('Waiting for SignalR connection to be established before initializing chat...');
          // We'll continue when the connectionStatus changes to 'connected'
          return;
        }
        
        // Initialize chat session
        const session = await initializeChatSession();
        
        // Log the full session for debugging
        logger.debug('Chat session response:', session);
        
        // Verify we have a valid session with an ID
        if (session && session.id && typeof session.id === 'string' && session.id.trim() !== '') {
          logger.debug(`Valid chat session obtained with ID: ${session.id}`);
          
          // Store the session in state
          setChatSession(session);
          
          // Join chat group using the context
          await joinGroup(session.id);
          logger.debug(`Joined chat group for session ${session.id}`);
        } else {
          logger.error('Failed to initialize chat: Invalid chat session or missing session ID', session);
          setError('Could not establish chat session. Please try refreshing the page.');
        }
      } catch (error) {
        logger.error('Error initializing chat:', error);
        setError('Error initializing chat. Please try refreshing the page.');
      } finally {
        setLoading(false);
      }
    };
    
    initializeChat();
    
    // Leave chat group on unmount
    return () => {
      if (chatSession?.id) {
        logger.debug(`Leaving chat group on unmount: ${chatSession.id}`);
        leaveGroup(chatSession.id).catch(err => {
          logger.error('Error leaving chat group:', err);
        });
      }
    };
  }, [channelId, connectionStatus, joinGroup, leaveGroup, initializeChatSession]); // Re-run when connectionStatus changes
  
  // Auto-scroll reference
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Function to scroll to the bottom of the chat
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);
  
  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);
  
  // Subscribe to SignalR events when chat session is available
  useEffect(() => {
    if (!chatSession || !chatSession.id) {
      logger.debug('No chat session available, skipping event subscriptions');
      return;
    }
    
    logger.debug(`Setting up SignalR subscriptions for chat ${chatSession.id}`);
    
    // When using the subscribe function, we need to handle the data as a tuple
    // since the SignalRContext wraps the callback function to handle multiple parameters
    
    // Subscribe to message events with a proper wrapper function to handle the tuple
    const unsubscribeMessage = subscribe<[string, string, any]>('ReceiveMessage', 
      (data) => {
        // Destructure the tuple data
        const [chatId, senderId, message] = data;
        
        logger.debug('Received message from SignalR:', { chatId, senderId, message });
        
        // Only process messages for our chat session
        if (chatId !== chatSession.id) {
          logger.debug(`Ignoring message for different chat session (received: ${chatId}, current: ${chatSession.id})`);
          return;
        }
        
        // Add message to our local state
        if (message && message.content) {
          const newMessage: Message = {
            id: message.id || Math.random().toString(36).substring(2, 9),
            content: message.content,
            sender: 'assistant',
            timestamp: new Date()
          };
          
          logger.debug('Adding new assistant message to state:', newMessage);
          
          setMessages(prev => [...prev, newMessage]);
          setIsTyping(false);
          
          // Clear any error that might have been shown
          setError(null);
          
          // Scroll to bottom to show new message
          setTimeout(scrollToBottom, 100);
        } else {
          logger.debug('Received message with no content, ignoring');
        }
      }
    );
    
    // Subscribe to bot status events with a proper wrapper function to handle the tuple
    const unsubscribeStatus = subscribe<[string, string]>('ReceiveBotResponseStatus',
      (data) => {
        // Destructure the tuple data
        const [chatId, status] = data;
        
        logger.debug('Received bot status:', { chatId, status });
        
        // Only process status updates for our chat session
        if (chatId !== chatSession.id) {
          logger.debug(`Ignoring status for different chat session (received: ${chatId}, current: ${chatSession.id})`);
          return;
        }
        
        // Update typing indicator based on status
        const isGenerating = status === 'generating';
        logger.debug(`Setting typing indicator to: ${isGenerating}`);
        setIsTyping(isGenerating);
        
        // Scroll to bottom to show typing indicator
        if (isGenerating) {
          setTimeout(scrollToBottom, 100);
        }
      }
    );
    
    // Cleanup subscriptions on unmount or when chat session changes
    return () => {
      logger.debug('Cleaning up SignalR subscriptions');
      unsubscribeMessage();
      unsubscribeStatus();
    };
  }, [chatSession, subscribe, scrollToBottom]); // Re-subscribe when chat session changes

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
    // Log state for debugging
    logger.debug('handleSendMessage called with state:', {
      inputValue: inputValue,
      chatSessionExists: !!chatSession,
      connectionStatus,
      loading,
      loadingChat,
      isTyping
    });
    
    // Pre-condition checks
    if (!inputValue.trim()) {
      logger.debug('Cannot send empty message');
      return;
    }
    
    if (!chatSession) {
      logger.error('Cannot send message: No active chat session');
      setError('No active chat session. Please refresh the page.');
      return;
    }

    if (connectionStatus !== 'connected') {
      logger.error('Cannot send message: Not connected to SignalR');
      setError('Not connected to chat service. Please wait or refresh the page.');
      return;
    }
    
    if (isTyping) {
      logger.debug('Cannot send message: Already processing a message');
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
      
      // Save the message content before clearing the input
      const messageContent = inputValue;
      
      // Add to UI immediately (optimistic update)
      setMessages(prev => [...prev, userMessage]);
      setInputValue(''); // Clear input right away
      
      // Show typing indicator while waiting for response
      setIsTyping(true);
      
      // Get auth token
      logger.debug('Getting auth token for sending message');
      const accessToken = await getAuthToken();
      
      // Send message via HTTP API
      logger.debug(`Sending message to chat session ${chatSession.id}`);
      
      // Log user information for debugging
      logger.debug('User information for chat message:', {
        userId: user?.id,
        userName: user?.name,
        hasUser: !!user
      });
      
      await chatService.sendChatMessage(
        chatSession.id,
        messageContent, // Use saved content
        channelId, // Use channel ID as context
        accessToken,
        'message', // Default message type
        user?.id, // Pass user ID if available
        user?.name // Pass user name if available
      );
      
      logger.debug('Message sent successfully via HTTP API', messageId);
      
      // Note: We don't need to handle the bot response here
      // The bot's response will come through the SignalR connection
      // The typing indicator will be cleared when the bot response comes through
      
    } catch (error: any) {
      logger.error('Error sending message:', error);
      
      // Provide more specific error messages based on the error
      if (error.message?.includes('Failed to fetch')) {
        setError('Network error sending message. Please check your connection and try again.');
      } else if (error.message?.includes('401')) {
        setError('Authentication error sending message. Please refresh the page and try again.');
      } else {
        setError(`Failed to send message: ${error.message || 'Unknown error'}`);
      }
      
      // Clear typing indicator if there was an error
      setIsTyping(false);
      
      // Clear error after 5 seconds
      setTimeout(() => {
        setError(null);
      }, 5000);
    }
  };

  // Handle input enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      logger.debug('Enter key pressed (without shift) - triggering message send');
      handleSendMessage();
    }
  };

  // For debugging purposes - development only
  const [forceEnableInput, setForceEnableInput] = useState(false);
  
  // Debug: Log state variables that affect input disabled state
  useEffect(() => {
    logger.debug('Chat component state:', {
      connectionStatus,
      loading,
      loadingChat,
      isTyping,
      chatSessionExists: !!chatSession,
      inputValueLength: inputValue.length,
      forceEnableInput
    });
  }, [connectionStatus, loading, loadingChat, isTyping, chatSession, inputValue, forceEnableInput]);
  
  // Add a key handler to toggle force enable for testing (Ctrl+Alt+D)
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.key === 'd') {
        setForceEnableInput(prev => !prev);
        logger.debug('Force enable input toggled:', !forceEnableInput);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [forceEnableInput]);
  
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
              
              {/* Invisible element for scrolling to bottom */}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Message Input */}
        <div className="flex flex-col">
          {/* Connection status message - now using the context's connectionStatus */}
          <div className={`mb-2 text-sm text-center ${
            connectionStatus === 'connected'
              ? 'text-green-500'
              : connectionStatus === 'connecting' || connectionStatus === 'reconnecting' 
                ? 'text-yellow-500' 
                : 'text-red-500'
          }`}>
            Status: {connectionStatus} | 
            {loading ? ' Loading: yes |' : ' Loading: no |'}
            {loadingChat ? ' LoadingChat: yes |' : ' LoadingChat: no |'}
            {isTyping ? ' Typing: yes |' : ' Typing: no |'}
            {chatSession ? ' ChatSession: yes' : ' ChatSession: no'}
          </div>
          
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
                connectionStatus !== 'connected' && !forceEnableInput
                  ? 'Connecting to chat service...' 
                  : 'Ask a question about this channel...'
              }
              value={inputValue}
              onChange={(e) => {
                logger.debug('Input onChange triggered', { 
                  newValue: e.target.value,
                  disabled: !forceEnableInput && (connectionStatus !== 'connected' || loading || loadingChat || isTyping)
                });
                setInputValue(e.target.value);
              }}
              onKeyDown={(e) => {
                logger.debug('Input onKeyDown triggered', { key: e.key });
                handleKeyDown(e);
              }}
              rows={1}
              style={{ resize: 'none' }}
              disabled={!forceEnableInput && (connectionStatus !== 'connected' || loading || loadingChat || isTyping)}
            />
            <Button 
              color="blue" 
              className="rounded-l-none"
              onClick={(e: any) => {
                e.preventDefault();
                logger.debug('Send button clicked', {
                  inputValue,
                  forceEnabled: forceEnableInput,
                  disabled: !forceEnableInput && (
                    !inputValue.trim() || 
                    connectionStatus !== 'connected' || 
                    loading || 
                    loadingChat || 
                    isTyping ||
                    !chatSession
                  )
                });
                
                // Either forced enabled or all conditions met
                if (forceEnableInput || (
                    inputValue.trim() && 
                    connectionStatus === 'connected' && 
                    !loading && 
                    !loadingChat && 
                    !isTyping && 
                    chatSession
                  )) {
                  handleSendMessage();
                } else {
                  logger.debug('Send button clicked but conditions not met to send message');
                }
              }}
              disabled={
                !forceEnableInput && (
                  !inputValue.trim() || 
                  connectionStatus !== 'connected' || 
                  loading || 
                  loadingChat || 
                  isTyping ||
                  !chatSession
                )
              }
              aria-label="Send message"
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