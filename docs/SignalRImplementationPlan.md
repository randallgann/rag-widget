# SignalR Connection Management Refactoring Plan

## Implementation Plan

This document outlines the step-by-step plan to implement the lifted SignalR connection management architecture.

### Step 1: Create the SignalR Context

Create a new file `src/contexts/SignalRContext.tsx`:

```typescript
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { HubConnection, HubConnectionState } from '@microsoft/signalr';
import { signalRService, ConnectionStatus } from '../services/chat';

// Define the context type
interface SignalRContextType {
  connection: HubConnection | null;
  connectionStatus: ConnectionStatus;
  error: Error | null;
  joinGroup: (groupName: string) => Promise<void>;
  leaveGroup: (groupName: string) => Promise<void>;
  subscribe: <T>(eventName: string, callback: (data: T) => void) => () => void;
}

// Create the context with undefined initial value
const SignalRContext = createContext<SignalRContextType | undefined>(undefined);

// Props for the provider
interface SignalRProviderProps {
  children: React.ReactNode;
  getAuthToken: () => Promise<string>;
}

export const SignalRProvider: React.FC<SignalRProviderProps> = ({ 
  children, 
  getAuthToken
}) => {
  // State to track connection status
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<Error | null>(null);
  
  // Refs to track connection and initialization state
  const connectionRef = useRef<HubConnection | null>(null);
  const isConnectingRef = useRef<boolean>(false);
  
  // Track group subscriptions with reference counting
  const groupSubscriptions = useRef<Map<string, number>>(new Map());
  
  // Logger function
  const logger = {
    debug: (message: string, data?: any) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[SIGNALR CONTEXT] ${message}`, data || '');
      }
    },
    error: (message: string, data?: any) => {
      console.error(`[SIGNALR CONTEXT] ${message}`, data || '');
    }
  };

  // Initialize connection
  const initializeConnection = useCallback(async () => {
    // Skip if already connecting
    if (isConnectingRef.current) {
      logger.debug('Already attempting to connect, skipping initialization');
      return;
    }
    
    // Skip if already connected
    if (connectionRef.current && connectionRef.current.state === HubConnectionState.Connected) {
      logger.debug('Connection already established, skipping initialization');
      return;
    }
    
    try {
      isConnectingRef.current = true;
      setConnectionStatus('connecting');
      
      // Get auth token
      const token = await getAuthToken();
      
      // Create connection
      const connection = signalRService.createHubConnection(token);
      
      // Set up event handlers
      connection.onclose((err) => {
        logger.debug('SignalR connection closed', err);
        setConnectionStatus('disconnected');
        if (err) setError(err instanceof Error ? err : new Error(String(err)));
      });
      
      connection.onreconnecting((err) => {
        logger.debug('SignalR reconnecting', err);
        setConnectionStatus('reconnecting');
        if (err) setError(err instanceof Error ? err : new Error(String(err)));
      });
      
      connection.onreconnected(() => {
        logger.debug('SignalR reconnected');
        setConnectionStatus('connected');
        setError(null);
        
        // Rejoin all groups after reconnection
        rejoinGroups(connection);
      });
      
      // Start connection
      logger.debug('Starting SignalR connection');
      await signalRService.startConnection(connection);
      
      // Store connection in ref
      connectionRef.current = connection;
      setConnectionStatus('connected');
      setError(null);
      
      logger.debug('SignalR connection successfully established');
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to initialize SignalR connection', error);
      setConnectionStatus('error');
      setError(error);
    } finally {
      isConnectingRef.current = false;
    }
  }, [getAuthToken]);
  
  // Rejoin all previously joined groups after reconnection
  const rejoinGroups = async (connection: HubConnection) => {
    // Skip if no groups to rejoin
    if (groupSubscriptions.current.size === 0) return;
    
    logger.debug(`Rejoining ${groupSubscriptions.current.size} groups after reconnection`);
    
    for (const [groupName] of groupSubscriptions.current) {
      try {
        await signalRService.joinChatGroup(connection, groupName);
        logger.debug(`Rejoined group ${groupName} after reconnection`);
      } catch (error) {
        logger.error(`Failed to rejoin group ${groupName} after reconnection`, error);
      }
    }
  };
  
  // Join a group
  const joinGroup = useCallback(async (groupName: string) => {
    // Validate group name
    if (!groupName || groupName.trim() === '') {
      throw new Error('Group name cannot be empty');
    }
    
    logger.debug(`Requesting to join group: ${groupName}`);
    
    // Initialize connection if needed
    if (!connectionRef.current || connectionRef.current.state !== HubConnectionState.Connected) {
      await initializeConnection();
    }
    
    // Skip if no connection (initialization failed)
    if (!connectionRef.current || connectionRef.current.state !== HubConnectionState.Connected) {
      throw new Error('Cannot join group: SignalR connection is not established');
    }
    
    // Get current count for this group or 0 if not joined yet
    const currentCount = groupSubscriptions.current.get(groupName) || 0;
    
    // Only perform the join operation if this is the first subscription
    if (currentCount === 0) {
      try {
        await signalRService.joinChatGroup(connectionRef.current, groupName);
        logger.debug(`Successfully joined group: ${groupName}`);
      } catch (error) {
        logger.error(`Failed to join group ${groupName}`, error);
        throw error;
      }
    } else {
      logger.debug(`Group ${groupName} already joined, increasing reference count`);
    }
    
    // Increment the subscription count for this group
    groupSubscriptions.current.set(groupName, currentCount + 1);
  }, [initializeConnection]);
  
  // Leave a group
  const leaveGroup = useCallback(async (groupName: string) => {
    // Skip if no connection
    if (!connectionRef.current || connectionRef.current.state !== HubConnectionState.Connected) {
      logger.debug(`Skipping leave group ${groupName}: no active connection`);
      return;
    }
    
    // Skip if group not joined
    if (!groupSubscriptions.current.has(groupName)) {
      logger.debug(`Group ${groupName} not joined, nothing to leave`);
      return;
    }
    
    // Get current count for this group
    const currentCount = groupSubscriptions.current.get(groupName) || 0;
    
    // Decrement the subscription count
    if (currentCount > 1) {
      groupSubscriptions.current.set(groupName, currentCount - 1);
      logger.debug(`Decremented reference count for group ${groupName} to ${currentCount - 1}`);
      return;
    }
    
    // If this is the last subscription, leave the group
    if (currentCount === 1) {
      try {
        // This would need to be implemented in signalRService
        // await signalRService.leaveChatGroup(connectionRef.current, groupName);
        
        // For now, we can just remove the subscription since there's no explicit leave method
        groupSubscriptions.current.delete(groupName);
        logger.debug(`Removed subscription for group ${groupName}`);
      } catch (error) {
        logger.error(`Error leaving group ${groupName}`, error);
      }
    }
  }, []);
  
  // Subscribe to an event
  const subscribe = useCallback(<T,>(eventName: string, callback: (data: T) => void) => {
    if (!connectionRef.current) {
      logger.warn(`Attempted to subscribe to ${eventName} before connection was established`);
      return () => {}; // Return no-op cleanup
    }
    
    logger.debug(`Subscribing to event: ${eventName}`);
    connectionRef.current.on(eventName, callback);
    
    // Return unsubscribe function
    return () => {
      if (connectionRef.current) {
        logger.debug(`Unsubscribing from event: ${eventName}`);
        connectionRef.current.off(eventName, callback);
      }
    };
  }, []);
  
  // Initialize connection on mount
  useEffect(() => {
    initializeConnection();
    
    // Cleanup on unmount
    return () => {
      // Clean up all subscriptions
      if (connectionRef.current) {
        logger.debug('Stopping SignalR connection on provider unmount');
        signalRService.stopConnection(connectionRef.current);
        connectionRef.current = null;
      }
    };
  }, [initializeConnection]);
  
  // Context value
  const value: SignalRContextType = {
    connection: connectionRef.current,
    connectionStatus,
    error,
    joinGroup,
    leaveGroup,
    subscribe
  };
  
  return (
    <SignalRContext.Provider value={value}>
      {children}
    </SignalRContext.Provider>
  );
};

// Custom hook to use the context
export const useSignalR = () => {
  const context = useContext(SignalRContext);
  
  if (context === undefined) {
    throw new Error('useSignalR must be used within a SignalRProvider');
  }
  
  return context;
};
```

### Step 2: Add Leave Group Method to SignalR Service

Enhance the SignalR service with a method to leave groups:

```typescript
// In src/services/chat/signalRService.ts

/**
 * Leave a chat group
 * @param connection The active SignalR connection
 * @param chatId The ID of the chat session to leave
 */
async leaveChatGroup(connection: HubConnection, chatId: string): Promise<void> {
  if (!chatId || chatId.trim() === '') {
    throw new Error('Cannot leave chat group: chatId parameter cannot be null or empty');
  }
  
  if (connection.state !== HubConnectionState.Connected) {
    return; // No need to throw if already disconnected
  }
  
  try {
    // If the hub has a method to leave groups, call it
    // await connection.invoke('RemoveClientFromGroupAsync', chatId);
    console.debug(`Left chat group: ${chatId}`);
  } catch (error) {
    console.error(`Error leaving chat group ${chatId}:`, error);
    throw error;
  }
}
```

### Step 3: Add the Provider to App.tsx

```typescript
// In src/views/App.tsx

import React from 'react';
import { SignalRProvider } from '../contexts/SignalRContext';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
// Other imports...

// Authentication token getter function
const getAuthToken = async (): Promise<string> => {
  try {
    const response = await fetch('/api/auth/token');
    const data = await response.json();
    return data.accessToken;
  } catch (error) {
    console.error('Failed to get auth token:', error);
    throw error;
  }
};

const App: React.FC = () => {
  return (
    <SignalRProvider getAuthToken={getAuthToken}>
      <Router>
        <Routes>
          {/* Your routes */}
        </Routes>
      </Router>
    </SignalRProvider>
  );
};

export default App;
```

### Step 4: Refactor Channel Chat Component to Use Context

Modify the channel chat component to use the SignalR context instead of directly managing the connection:

```typescript
// In src/views/channels/chat.tsx

// Import the hook
import { useSignalR } from '../../contexts/SignalRContext';

// Replace SignalR connection management code with:
const ChannelChat: React.FC<ChannelChatProps> = ({ authenticatedFetch, user: initialUser }) => {
  const { channelId } = useParams<{ channelId: string }>();
  const [user, setUser] = useState<UserProfileResponse['user'] | null>(initialUser || null);
  const [chatSession, setChatSession] = useState<ChatSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingChat, setLoadingChat] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  
  // Get SignalR context
  const { connectionStatus, joinGroup, subscribe } = useSignalR();
  
  // Initialize chat session and get messages
  const initializeChatSession = useCallback(async () => {
    try {
      // Implementation similar to original, but without SignalR connection logic
      // ...
      return session;
    } catch (error: any) {
      // Error handling...
      throw error;
    }
  }, [channelId, authenticatedFetch]);
  
  // Set up chat session and SignalR subscriptions
  useEffect(() => {
    const setupChat = async () => {
      try {
        setLoading(true);
        
        // Initialize chat session
        const session = await initializeChatSession();
        if (!session || !session.id) {
          throw new Error('Failed to initialize chat session');
        }
        
        // Join the chat group
        await joinGroup(session.id);
        
        // Set loading to false
        setLoading(false);
      } catch (error) {
        console.error('Error setting up chat:', error);
        setError('Failed to initialize chat. Please try refreshing the page.');
        setLoading(false);
      }
    };
    
    setupChat();
  }, [channelId, initializeChatSession, joinGroup]);
  
  // Subscribe to SignalR events
  useEffect(() => {
    if (!chatSession || !chatSession.id) return;
    
    // Subscribe to message events
    const unsubscribeMessage = subscribe('ReceiveMessage', 
      (chatId: string, senderId: string, message: any) => {
        // Only process messages for our chat session
        if (chatId !== chatSession.id) return;
        
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
      }
    );
    
    // Subscribe to bot status events
    const unsubscribeStatus = subscribe('ReceiveBotResponseStatus',
      (chatId: string, status: string) => {
        // Only process status updates for our chat session
        if (chatId !== chatSession.id) return;
        
        // Update typing indicator based on status
        setIsTyping(status === 'generating');
      }
    );
    
    // Cleanup subscriptions on unmount or when chat session changes
    return () => {
      unsubscribeMessage();
      unsubscribeStatus();
    };
  }, [chatSession, subscribe]);
  
  // The rest of the component remains largely the same
  // ...
  
  return (
    // Component JSX
  );
};
```

### Step 5: Update Additional Components That Use SignalR

Any other components that need real-time updates should be modified to use the SignalR context instead of directly managing connections.

### Step 6: Update SignalR Service to Support Group Leaving

If the backend SignalR hub supports explicit group leaving, implement the leaveChatGroup method in the SignalRService class.

### Step 7: Testing

1. **Basic Functionality Testing**:
   - Verify chat messages flow correctly
   - Verify proper group joining/leaving
   - Verify connection state management

2. **Edge Case Testing**:
   - Test multiple simultaneous chats
   - Test rapid navigation between chat screens
   - Test reconnection after network disruption
   - Test application restart/refresh

3. **Performance Testing**:
   - Verify reduced network overhead with single connection
   - Measure connection establishment time
   - Check for memory leaks

### Step 8: Logging and Monitoring

Enhance logging to track connection sharing metrics:

- Number of active chat groups
- Connection establishment time
- Reconnection events
- Group join/leave operations

## Advantages of this Approach

1. **Resource Efficiency**: Single connection shared across all components
2. **Simplified Components**: Components only worry about their specific chat logic
3. **Robust Error Handling**: Centralized error recovery
4. **Cleaner Code**: Clear separation between connection management and UI logic
5. **Automatic Reconnection**: Shared reconnection logic with group rejoining
6. **Ref Counting**: Proper management of group subscriptions

## Potential Challenges

1. **State Synchronization**: Ensuring connection state is properly synchronized across components
2. **Error Propagation**: Making sure components are aware of connection errors
3. **Auth Token Refresh**: Handling token expiration and refresh
4. **Testing**: More complex testing scenarios to verify connection sharing