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
  /**
   * Subscribe to a SignalR event.
   * @param eventName The name of the event to subscribe to
   * @param callback The callback function to handle the event data
   * @returns A function to unsubscribe from the event
   * 
   * Note: The callback will be wrapped to handle both:
   * - Multiple parameter format: connection.on('MyEvent', (param1, param2) => {...})
   * - Single tuple format: connection.on('MyEvent', (tupleData) => {...})
   */
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

  const initializeConnectionRef = useRef<() => Promise<void>>(() => 
    Promise.reject(new Error('Connection not initialized'))
  );

  const initializeConnection = useCallback(
    () => initializeConnectionRef.current(),
    []
  );

  
  // Forward declarations of functions to avoid circular dependencies
  let rejoinGroups: (connection: HubConnection) => Promise<void>;
  //let initializeConnection: () => Promise<void>;
  
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
        // Currently no explicit method to leave groups
        // TODO: Implement when leaveChatGroup is added to signalRService
        
        // For now, we can just remove the subscription
        groupSubscriptions.current.delete(groupName);
        logger.debug(`Removed subscription for group ${groupName}`);
      } catch (error) {
        logger.error(`Error leaving group ${groupName}`, error);
      }
    }
  }, []);
  
  // Subscribe to an event
  // We need to handle both direct parameters and tuple data formats
  const subscribe = useCallback(<T,>(eventName: string, callback: (data: T) => void) => {
    if (!connectionRef.current) {
      logger.debug(`Attempted to subscribe to ${eventName} before connection was established`);
      return () => {}; // Return no-op cleanup
    }
    
    logger.debug(`Subscribing to event: ${eventName}`);
    
    // Create a wrapper function that handles both parameter formats
    // SignalR can call callbacks with multiple args OR a single tuple
    const wrapperFn = (...args: any[]) => {
      if (args.length === 1) {
        // Single argument format (tuple)
        callback(args[0] as T);
      } else {
        // Multiple arguments format
        callback(args as unknown as T);
      }
    };
    
    // Store the wrapper function reference for removal
    connectionRef.current.on(eventName, wrapperFn);
    
    // Return unsubscribe function
    return () => {
      if (connectionRef.current) {
        logger.debug(`Unsubscribing from event: ${eventName}`);
        connectionRef.current.off(eventName, wrapperFn);
      }
    };
  }, []);
  
  // Ping interval ref to keep the connection alive
  const pingIntervalRef = useRef<number | null>(null);
  
  // Function to manually send a ping to the server
  const sendPing = (connection: HubConnection) => {
    try {
      if (connection && connection.state === HubConnectionState.Connected) {
        logger.debug('Sending connection ping to prevent timeout');
        // Use a no-op method that doesn't need to exist on the server
        // This is just to reset the server timeout
        connection.invoke('KeepAlive').catch(() => {
          // Ignore failures - the server doesn't need to implement this method
          // It just needs to receive a message to reset the timeout
        });
      }
    } catch (error) {
      // Ignore any errors - we'll let the automatic reconnection handle them
    }
  };
  
  // Create a function to start sending pings to keep the connection alive
  const startPingInterval = useCallback(() => {
    // Clear any existing interval
    if (pingIntervalRef.current !== null) {
      window.clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    
    // Only start if we have a connection
    if (!connectionRef.current) return;
    
    // Send a ping every 10 seconds to keep the connection alive
    pingIntervalRef.current = window.setInterval(() => {
      if (connectionRef.current) {
        sendPing(connectionRef.current);
      }
    }, 10000); // 10 seconds
  }, []);
  
  // Define the rejoinGroups function (previously forward-declared)
  rejoinGroups = async (connection: HubConnection) => {
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
  
  // Define initializeConnection (previously forward-declared)
  const initializeConnectionImplementation = async () => {
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
        
        // Restart ping interval to keep connection alive
        startPingInterval();
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
  };

  // Assign to ref after definition
  initializeConnectionRef.current = initializeConnectionImplementation;
  
  // Initialize connection on mount
  useEffect(() => {
    initializeConnection().then(() => {
      // Start the ping interval after connection is established
      startPingInterval();
    });
    
    // Cleanup on unmount
    return () => {
      // Clean up ping interval
      if (pingIntervalRef.current !== null) {
        window.clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      
      // Clean up all subscriptions
      if (connectionRef.current) {
        logger.debug('Stopping SignalR connection on provider unmount');
        signalRService.stopConnection(connectionRef.current);
        connectionRef.current = null;
      }
    };
  }, [initializeConnection, startPingInterval]);
  
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