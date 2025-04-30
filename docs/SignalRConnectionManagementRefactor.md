# SignalR Connection Management Refactoring Plan

## Current Issue

The current implementation of SignalR connection management in the chat component has several limitations:

1. Connection management is tightly coupled to individual chat components
2. Connection logic is duplicated across components that need real-time updates
3. Race conditions can occur during connection/disconnection cycles
4. No centralized error handling or reconnection strategy

## Proposed Solution

We recommend lifting the SignalR connection management to a parent component or context provider that would:

1. Manage a single, shared connection to SignalR
2. Handle connection lifecycle (connect, disconnect, reconnect)
3. Provide a simple API for components to subscribe to messages
4. Centralize error handling and reconnection logic

## Implementation Steps

1. Create a new `SignalRContext.tsx` file in the `/src/contexts/` directory
2. Implement a context provider that manages the connection lifecycle
3. Create hook(s) for components to consume the context
4. Refactor existing components to use the new context instead of direct connection management

## Benefits

1. Reduced connection overhead (single connection shared by multiple components)
2. Centralized error handling and reconnection logic
3. Simplified component code (connection details abstracted away)
4. Better testability (connection logic can be mocked at context level)
5. Eliminates race conditions by having a single source of truth for connection state

## Implementation Example

```tsx
// src/contexts/SignalRContext.tsx
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { HubConnection } from '@microsoft/signalr';
import { signalRService, ConnectionStatus } from '../services/chat';

interface SignalRContextType {
  connection: HubConnection | null;
  connectionStatus: ConnectionStatus;
  joinGroup: (groupName: string) => Promise<void>;
  leaveGroup: (groupName: string) => Promise<void>;
  subscribe: <T>(eventName: string, callback: (data: T) => void) => () => void;
  error: Error | null;
}

const SignalRContext = createContext<SignalRContextType | undefined>(undefined);

export const SignalRProvider: React.FC<{
  children: React.ReactNode;
  getAuthToken: () => Promise<string>;
}> = ({ children, getAuthToken }) => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<Error | null>(null);
  const connectionRef = useRef<HubConnection | null>(null);
  const isConnectingRef = useRef(false);

  // Initialize connection
  useEffect(() => {
    const initializeConnection = async () => {
      if (isConnectingRef.current || connectionRef.current) return;
      
      try {
        isConnectingRef.current = true;
        setConnectionStatus('connecting');
        
        const token = await getAuthToken();
        const connection = signalRService.createHubConnection(token);
        
        // Set up event handlers
        connection.onclose(error => {
          setConnectionStatus('disconnected');
          if (error) setError(error);
        });
        
        connection.onreconnecting(error => {
          setConnectionStatus('reconnecting');
          if (error) setError(error);
        });
        
        connection.onreconnected(() => {
          setConnectionStatus('connected');
          setError(null);
        });
        
        // Start the connection
        await signalRService.startConnection(connection);
        connectionRef.current = connection;
        setConnectionStatus('connected');
        setError(null);
      } catch (error) {
        setError(error as Error);
        setConnectionStatus('error');
      } finally {
        isConnectingRef.current = false;
      }
    };
    
    initializeConnection();
    
    // Cleanup
    return () => {
      const connection = connectionRef.current;
      if (connection) {
        signalRService.stopConnection(connection);
        connectionRef.current = null;
      }
    };
  }, [getAuthToken]);
  
  // Join a group
  const joinGroup = async (groupName: string) => {
    if (!connectionRef.current || connectionStatus !== 'connected') {
      throw new Error('Cannot join group: connection not established');
    }
    
    await signalRService.joinChatGroup(connectionRef.current, groupName);
  };
  
  // Leave a group (to be implemented in signalRService)
  const leaveGroup = async (groupName: string) => {
    if (!connectionRef.current || connectionStatus !== 'connected') {
      return; // No need to throw if already disconnected
    }
    
    // This would need to be implemented in the signalRService
    // await signalRService.leaveChatGroup(connectionRef.current, groupName);
  };
  
  // Subscribe to events
  const subscribe = <T,>(eventName: string, callback: (data: T) => void) => {
    if (!connectionRef.current) {
      console.warn('Attempted to subscribe before connection was established');
      return () => {}; // No-op cleanup
    }
    
    connectionRef.current.on(eventName, callback);
    
    // Return cleanup function
    return () => {
      if (connectionRef.current) {
        connectionRef.current.off(eventName, callback);
      }
    };
  };
  
  const value = {
    connection: connectionRef.current,
    connectionStatus,
    joinGroup,
    leaveGroup,
    subscribe,
    error
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

## Usage in Components

```tsx
// In App.tsx or other high-level component
<SignalRProvider getAuthToken={getAuthToken}>
  {/* Other components that need SignalR */}
  <ChannelChat />
</SignalRProvider>

// In ChannelChat.tsx
const { connectionStatus, joinGroup, subscribe } = useSignalR();

useEffect(() => {
  if (connectionStatus === 'connected' && chatSession) {
    // Join the chat group
    joinGroup(chatSession.id).catch(error => {
      console.error('Error joining chat group:', error);
    });
    
    // Subscribe to messages
    const unsubscribeMessage = subscribe('ReceiveMessage', 
      (chatId: string, senderId: string, message: any) => {
        // Handle incoming messages
      }
    );
    
    const unsubscribeStatus = subscribe('ReceiveBotResponseStatus',
      (chatId: string, status: string) => {
        // Handle status updates
      }
    );
    
    return () => {
      unsubscribeMessage();
      unsubscribeStatus();
    };
  }
}, [connectionStatus, chatSession, joinGroup, subscribe]);
```

## Next Steps

1. Implement the `SignalRContext` as described above
2. Refactor the chat component to use the context
3. Add support for joining multiple chat groups
4. Enhance error handling and recovery mechanisms
5. Add automatic token refresh if needed