import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Storage key for localStorage
const VIDEO_PROCESSING_STORAGE_KEY = 'rag-widget-processing-videos';

interface VideoProcessingContextType {
  // Videos currently being processed with their detailed status
  processingVideos: Record<string, VideoProcessingStatus>;
  // Function to register a video for processing (called after API response)
  registerProcessingVideo: (videoId: string, initialStatus: VideoProcessingStatus) => void;
  // Function to update a video's processing status (called when status message received)
  updateProcessingStatus: (videoId: string, status: Partial<VideoProcessingStatus>) => void;
  // Function to clear stale processing videos (videos that are no longer processing)
  clearStaleProcessingVideos: (videoIds?: string[]) => void;
  // Function to deselect completed videos in the database
  deselectCompletedVideos: (videoIds: string[]) => Promise<boolean>;
}

export interface VideoProcessingStatus {
  videoId: string;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  processingProgress: number;
  processingStage?: string | null;
  processingError?: string | null;
  processingLastUpdated?: Date;
  estimatedTimeRemaining?: number;
  finalState?: boolean;  // Flag to indicate item is in final state before removal
}

const VideoProcessingContext = createContext<VideoProcessingContextType | undefined>(undefined);

// Add a debug global for WebSocket tracking
interface DebugInfo {
  connections: {
    count: number;
    active: number;
    ids: string[];
    lastMessage?: Date;
    lastError?: Date;
  };
  messages: {
    received: number;
    completedCount: number;
    failedCount: number;
  };
}

// Add a test function to simulate receiving a status message
const simulateStatusUpdate = (
  videoId: string, 
  status: 'pending' | 'processing' | 'completed' | 'failed',
  progress: number,
  stage?: string,
  error?: string
) => {
  const message = {
    videoId,
    processingStatus: status,
    processingProgress: progress,
    processingStage: stage,
    processingError: error,
    processingLastUpdated: new Date(),
    timestamp: new Date().toISOString()
  };
  
  console.log('Simulating WebSocket message:', message);
  
  // Create a fake message event
  const event = new MessageEvent('message', {
    data: JSON.stringify(message)
  });
  
  // Get active WebSocket instance if available
  const activeSocket = window.__VIDEO_PROCESSING_DEBUG__?.connections?.ids?.[0];
  
  if (activeSocket) {
    console.log(`Dispatching to socket ${activeSocket}`);
  }
  
  // Dispatch the event to the active WebSocket if any
  if (window.__VIDEO_PROCESSING_DEBUG__) {
    window.__VIDEO_PROCESSING_DEBUG__.simulateMessage = (videoId: string, status: string) => {
      simulateStatusUpdate(videoId, status as any, status === 'completed' ? 100 : status === 'failed' ? 50 : 75);
    };
  }
  
  // Call the update function directly
  if (window.__VIDEO_PROCESSING_CONTEXT__?.updateProcessingStatus) {
    window.__VIDEO_PROCESSING_CONTEXT__.updateProcessingStatus(message.videoId, message);
    console.log('Status update simulated successfully');
    return true;
  } else {
    console.error('Video processing context not available for simulation');
    return false;
  }
};

// Create global debug info that can be accessed in dev tools
declare global {
  interface Window {
    __VIDEO_PROCESSING_DEBUG__: DebugInfo & {
      simulateMessage?: (videoId: string, status: string) => void;
    };
    __VIDEO_PROCESSING_CONTEXT__?: {
      updateProcessingStatus: (videoId: string, status: any) => void;
      getStatus: () => Record<string, any>;
    };
  }
}

// Initialize debug info
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  window.__VIDEO_PROCESSING_DEBUG__ = {
    connections: {
      count: 0,
      active: 0,
      ids: []
    },
    messages: {
      received: 0,
      completedCount: 0,
      failedCount: 0
    }
  };
}

export const VideoProcessingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [processingVideos, setProcessingVideos] = useState<Record<string, VideoProcessingStatus>>({});
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo>(
    window.__VIDEO_PROCESSING_DEBUG__ || {
      connections: { count: 0, active: 0, ids: [] },
      messages: { received: 0, completedCount: 0, failedCount: 0 }
    }
  );
  
  // Initialize state from localStorage, if available
  useEffect(() => {
    try {
      const storedData = localStorage.getItem(VIDEO_PROCESSING_STORAGE_KEY);
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        
        // Validate the parsed data - ensure it's an object with valid videos
        if (typeof parsedData === 'object' && parsedData !== null) {
          // Restore Date objects
          const restoredData: Record<string, VideoProcessingStatus> = {};
          
          Object.entries(parsedData).forEach(([key, value]: [string, any]) => {
            if (value && value.videoId && value.processingStatus) {
              restoredData[key] = {
                ...value,
                processingLastUpdated: value.processingLastUpdated ? new Date(value.processingLastUpdated) : new Date()
              };
            }
          });
          
          setProcessingVideos(restoredData);
          console.log(`Restored ${Object.keys(restoredData).length} processing videos from local storage`);
        }
      }
    } catch (error: any) {
      console.error('Error loading processing videos from localStorage:', error);
      // If there's an error, clear the storage to prevent future errors
      localStorage.removeItem(VIDEO_PROCESSING_STORAGE_KEY);
    }
  }, []);
  
  // Save to localStorage whenever processing videos change
  useEffect(() => {
    try {
      if (Object.keys(processingVideos).length > 0) {
        localStorage.setItem(VIDEO_PROCESSING_STORAGE_KEY, JSON.stringify(processingVideos));
      } else {
        localStorage.removeItem(VIDEO_PROCESSING_STORAGE_KEY);
      }
    } catch (error: any) {
      console.error('Error saving processing videos to localStorage:', error);
    }
  }, [processingVideos]);

  // Function to register a video that's being processed
  const registerProcessingVideo = (videoId: string, initialStatus: VideoProcessingStatus) => {
    console.log(`Registering video ${videoId} for processing status tracking`, initialStatus);
    setProcessingVideos(prev => ({
      ...prev,
      [videoId]: initialStatus
    }));
  };

  // Function to update the status of a processing video
  const updateProcessingStatus = (videoId: string, status: Partial<VideoProcessingStatus>) => {
    setProcessingVideos(prev => {
      if (!prev[videoId]) return prev;
      
      // If the status is completed or failed, update state and keep it permanently
      if (status.processingStatus === 'completed' || status.processingStatus === 'failed') {
        console.log(`Video ${videoId} ${status.processingStatus}. Updating with final state.`);
        
        // Make API call to deselect the video if it completed successfully
        if (status.processingStatus === 'completed') {
          // Use a separate function to avoid blocking the state update
          (async () => {
            try {
              console.log(`Auto-deselecting completed video ${videoId}`);
              const response = await fetch(`/api/videos/${videoId}/select`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json'
                },
                credentials: 'include', // Important for auth cookies
                body: JSON.stringify({ selectedForProcessing: false })
              });
              
              if (response.ok) {
                console.log(`Successfully deselected completed video ${videoId}`);
              } else {
                console.error(`Failed to deselect completed video ${videoId}:`, await response.text());
              }
            } catch (error) {
              console.error(`Error deselecting completed video ${videoId}:`, error);
            }
          })();
        }
        
        // Update the state with the final status
        const updatedState = {
          ...prev,
          [videoId]: {
            ...prev[videoId],
            ...status,
            processingLastUpdated: status.processingLastUpdated || new Date(),
            // Add a flag to indicate this is the final state (for temporary visual effects)
            finalState: true
          }
        };
        
        // After 5 seconds, change finalState to false to stop animation, but keep the video in state
        setTimeout(() => {
          console.log(`Keeping ${status.processingStatus} video ${videoId} in state, removing animation`);
          setProcessingVideos(current => {
            // Only update if the video is still in state
            if (!current[videoId]) return current;
            
            const newState = {
              ...current,
              [videoId]: {
                ...current[videoId],
                finalState: false  // Just turn off animation, but keep the video status
              }
            };
            
            // Persist the updated state to localStorage
            try {
              localStorage.setItem(VIDEO_PROCESSING_STORAGE_KEY, JSON.stringify(newState));
            } catch (error) {
              console.error('Error saving updated processing videos to localStorage:', error);
            }
            
            return newState;
          });
        }, 5000); // Keep animation for 5 seconds
        
        return updatedState;
      }
      
      // For normal updates, just update the state
      return {
        ...prev,
        [videoId]: {
          ...prev[videoId],
          ...status,
          // Automatically update last update time if not provided
          processingLastUpdated: status.processingLastUpdated || new Date()
        }
      };
    });
  };
  
  // Function to clear stale processing videos
  const clearStaleProcessingVideos = (videoIds?: string[]) => {
    if (videoIds && videoIds.length > 0) {
      // If specific video IDs are provided, only clear those
      setProcessingVideos(prev => {
        const newState = { ...prev };
        videoIds.forEach(id => {
          if (newState[id]) {
            delete newState[id];
          }
        });
        return newState;
      });
    } else {
      // If no IDs provided, clear videos that haven't been updated recently
      const staleThreshold = 10 * 60 * 1000; // 10 minutes in milliseconds
      const now = new Date().getTime();
      
      setProcessingVideos(prev => {
        const newState = { ...prev };
        Object.entries(newState).forEach(([id, status]) => {
          if (!status.processingLastUpdated || 
              (now - status.processingLastUpdated.getTime() > staleThreshold)) {
            delete newState[id];
          }
        });
        return newState;
      });
    }
  };

  // Setup WebSocket for real-time status updates
  useEffect(() => {
    if (socket || isReconnecting) return;
    
    // Connect to WebSocket
    const connectWebSocket = () => {
      // Create WebSocket connection
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/api/status-updates`;
      
      console.log(`Connecting to WebSocket at ${wsUrl}`);
      const newSocket = new WebSocket(wsUrl);
      
      // Generate a unique ID for this socket for better tracking
      const socketId = `socket_${Date.now()}`;
      (newSocket as any).socketId = socketId;
      
      // Connection opened
      newSocket.addEventListener('open', (event) => {
        console.log(`WebSocket connection established (ID: ${socketId})`);
        setIsReconnecting(false);
        
        // Update debug info
        if (process.env.NODE_ENV !== 'production') {
          const updatedDebugInfo = {
            ...debugInfo,
            connections: {
              ...debugInfo.connections,
              count: debugInfo.connections.count + 1,
              active: debugInfo.connections.active + 1,
              ids: [...debugInfo.connections.ids, socketId]
            }
          };
          setDebugInfo(updatedDebugInfo);
          window.__VIDEO_PROCESSING_DEBUG__ = updatedDebugInfo;
        }
      });
      
      // Listen for status update messages
      newSocket.addEventListener('message', (event) => {
        try {
          const statusUpdate = JSON.parse(event.data);
          if (statusUpdate && statusUpdate.videoId) {
            console.log(`Received status update for video ${statusUpdate.videoId} via WebSocket (ID: ${socketId}):`, statusUpdate);
            
            // Update debug info
            if (process.env.NODE_ENV !== 'production') {
              const isCompleted = statusUpdate.processingStatus === 'completed';
              const isFailed = statusUpdate.processingStatus === 'failed';
              
              const updatedDebugInfo = {
                ...debugInfo,
                connections: {
                  ...debugInfo.connections,
                  lastMessage: new Date()
                },
                messages: {
                  received: debugInfo.messages.received + 1,
                  completedCount: isCompleted ? debugInfo.messages.completedCount + 1 : debugInfo.messages.completedCount,
                  failedCount: isFailed ? debugInfo.messages.failedCount + 1 : debugInfo.messages.failedCount
                }
              };
              setDebugInfo(updatedDebugInfo);
              window.__VIDEO_PROCESSING_DEBUG__ = updatedDebugInfo;
              
              // Log more details for completed/failed messages
              if (isCompleted || isFailed) {
                console.log(`🚨 Received ${statusUpdate.processingStatus.toUpperCase()} status for video ${statusUpdate.videoId}`);
                console.table({
                  videoId: statusUpdate.videoId,
                  status: statusUpdate.processingStatus,
                  progress: statusUpdate.processingProgress,
                  stage: statusUpdate.processingStage,
                  timestamp: new Date().toISOString()
                });
              }
            }
            
            // Update processing status
            updateProcessingStatus(statusUpdate.videoId, statusUpdate);
          }
        } catch (error: any) {
          console.error(`Error processing WebSocket message on socket ${socketId}:`, error);
          
          // Update debug error info
          if (process.env.NODE_ENV !== 'production') {
            const updatedDebugInfo = {
              ...debugInfo,
              connections: {
                ...debugInfo.connections,
                lastError: new Date()
              }
            };
            setDebugInfo(updatedDebugInfo);
            window.__VIDEO_PROCESSING_DEBUG__ = updatedDebugInfo;
          }
        }
      });
      
      // Connection closed or error
      newSocket.addEventListener('close', (event) => {
        console.log(`WebSocket connection closed (ID: ${socketId})`);
        
        // Update debug info for closed connection
        if (process.env.NODE_ENV !== 'production') {
          const updatedDebugInfo = {
            ...debugInfo,
            connections: {
              ...debugInfo.connections,
              active: Math.max(0, debugInfo.connections.active - 1),
              ids: debugInfo.connections.ids.filter(id => id !== socketId)
            }
          };
          setDebugInfo(updatedDebugInfo);
          window.__VIDEO_PROCESSING_DEBUG__ = updatedDebugInfo;
        }
        
        // Try to reconnect after a delay
        setSocket(null);
        
        if (!isReconnecting) {
          setIsReconnecting(true);
          setTimeout(() => {
            console.log(`Attempting to reconnect WebSocket after socket ${socketId} closed...`);
            setIsReconnecting(false);
          }, 5000);
        }
      });
      
      newSocket.addEventListener('error', (event) => {
        console.error(`WebSocket error on socket ${socketId}:`, event);
        
        // Update debug info for error
        if (process.env.NODE_ENV !== 'production') {
          const updatedDebugInfo = {
            ...debugInfo,
            connections: {
              ...debugInfo.connections,
              lastError: new Date()
            }
          };
          setDebugInfo(updatedDebugInfo);
          window.__VIDEO_PROCESSING_DEBUG__ = updatedDebugInfo;
        }
      });
      
      // Set the socket in state
      setSocket(newSocket);
    };
    
    connectWebSocket();
    
    // Clean up on unmount - improved cleanup logic
    return () => {
      if (socket) {
        const socketId = (socket as any).socketId || 'unknown';
        const readyStateString = getReadyStateString((socket as any).readyState);
        
        console.log(`Cleaning up WebSocket connection (ID: ${socketId}, state: ${readyStateString})`);
        
        // Close the socket regardless of its current state
        try {
          (socket as any).close();
        } catch (err) {
          console.error(`Error closing WebSocket (ID: ${socketId}):`, err);
        }
        
        // Clear the socket from state
        setSocket(null);
      }
    };
  }, [socket, isReconnecting]);
  
  // Helper function to get human-readable WebSocket state
  const getReadyStateString = (readyState: number): string => {
    switch (readyState) {
      case WebSocket.CONNECTING: return 'CONNECTING';
      case WebSocket.OPEN: return 'OPEN';
      case WebSocket.CLOSING: return 'CLOSING';
      case WebSocket.CLOSED: return 'CLOSED';
      default: return `UNKNOWN (${readyState})`;
    }
  };
  
  // On socket reconnection, verify processing statuses
  useEffect(() => {
    if (socket && Object.keys(processingVideos).length > 0) {
      console.log('Socket reconnected. Verifying processing statuses for existing videos...');
      // We'll let the channel detail component handle verification
      // since it has access to the authenticatedFetch method
    }
  }, [socket]);

  // Function to deselect completed videos in the database
  const deselectCompletedVideos = async (videoIds: string[]): Promise<boolean> => {
    if (!videoIds || videoIds.length === 0) return false;
    
    try {
      console.log(`Batch deselecting ${videoIds.length} completed videos`);
      const response = await fetch('/api/videos/select-batch', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Important for auth cookies
        body: JSON.stringify({
          videoIds,
          selectedForProcessing: false
        })
      });
      
      if (response.ok) {
        console.log(`Successfully deselected ${videoIds.length} completed videos`);
        return true;
      } else {
        console.error(`Failed to batch deselect completed videos:`, await response.text());
        return false;
      }
    } catch (error) {
      console.error(`Error deselecting completed videos:`, error);
      return false;
    }
  };

  // Value to be provided to consuming components
  const value = {
    processingVideos,
    registerProcessingVideo,
    updateProcessingStatus,
    clearStaleProcessingVideos,
    deselectCompletedVideos
  };
  
  // Add direct access to the context for testing in development
  if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
    window.__VIDEO_PROCESSING_CONTEXT__ = {
      updateProcessingStatus,
      getStatus: () => processingVideos
    };
  }

  // Create debug panel component that's only rendered in development
  const DebugPanel = () => {
    if (process.env.NODE_ENV === 'production') return null;
    
    const activeVideos = Object.keys(processingVideos).length;
    
    return (
      <div style={{
        position: 'fixed',
        bottom: '30px', // Higher than the auth debug panel
        right: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '8px',
        borderRadius: '4px 0 0 4px',
        fontSize: '11px',
        fontFamily: 'monospace',
        zIndex: 9998,
        maxWidth: '300px',
        transition: 'all 0.3s',
        boxShadow: '0 0 10px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ borderBottom: '1px solid #444', paddingBottom: '4px', marginBottom: '4px' }}>
          <strong>WebSocket Debug</strong>
          {socket ? (
            <span style={{ 
              display: 'inline-block', 
              width: '8px', 
              height: '8px', 
              backgroundColor: 'green',
              borderRadius: '50%',
              margin: '0 5px'
            }}></span>
          ) : (
            <span style={{ 
              display: 'inline-block', 
              width: '8px', 
              height: '8px', 
              backgroundColor: 'red',
              borderRadius: '50%',
              margin: '0 5px'
            }}></span>
          )}
        </div>
        <div style={{ marginBottom: '4px' }}>
          <div><strong>Connection:</strong> {socket ? 'Active' : 'Disconnected'}</div>
          <div><strong>Socket ID:</strong> {(socket as any)?.socketId || 'None'}</div>
          <div><strong>State:</strong> {socket ? getReadyStateString(socket.readyState) : 'N/A'}</div>
          <div><strong>Total Created:</strong> {debugInfo.connections.count}</div>
        </div>
        <div style={{ marginBottom: '4px' }}>
          <div><strong>Processing Videos:</strong> {activeVideos}</div>
          <div><strong>Messages Received:</strong> {debugInfo.messages.received}</div>
          <div><strong>Completed Videos:</strong> {debugInfo.messages.completedCount}</div>
          <div><strong>Failed Videos:</strong> {debugInfo.messages.failedCount}</div>
        </div>
        <div style={{ fontSize: '10px', color: '#aaa' }}>
          Last message: {debugInfo.connections.lastMessage ? new Date(debugInfo.connections.lastMessage).toLocaleTimeString() : 'Never'}
        </div>
      </div>
    );
  };

  return (
    <VideoProcessingContext.Provider value={value}>
      {children}
      {process.env.NODE_ENV !== 'production' && <DebugPanel />}
    </VideoProcessingContext.Provider>
  );
};

// Custom hook to use the video processing context
export const useVideoProcessing = () => {
  const context = useContext(VideoProcessingContext);
  if (context === undefined) {
    throw new Error('useVideoProcessing must be used within a VideoProcessingProvider');
  }
  return context;
};