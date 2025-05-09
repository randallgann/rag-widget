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
  // Function to completely remove a video from the processing context (for "Remove" action)
  removeVideoFromContext: (videoId: string) => void;
  // Function to subscribe to status change events
  onStatusChange: (callback: (event: StatusChangeEvent) => void) => () => void;
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
  // Additional identifiers to support multiple ID formats
  databaseId?: string;   // Database UUID when available
  youtubeId?: string;    // YouTube ID when available
}

export interface StatusChangeEvent {
  videoId: string;
  oldStatus?: string;
  newStatus: string;
  databaseId?: string;
  youtubeId?: string;
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
  const [statusChangeCallbacks] = useState<Set<(event: StatusChangeEvent) => void>>(new Set());
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

  // Function to subscribe to status change events
  const onStatusChange = (callback: (event: StatusChangeEvent) => void) => {
    // Add the callback to our set
    statusChangeCallbacks.add(callback);
    
    // Return a cleanup function to remove the callback
    return () => {
      statusChangeCallbacks.delete(callback);
    };
  };
  
  // Helper to notify all callbacks about a status change
  const notifyStatusChange = (event: StatusChangeEvent) => {
    statusChangeCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in status change callback:', error);
      }
    });
  };

  // Function to update the status of a processing video
  const updateProcessingStatus = (videoId: string, status: Partial<VideoProcessingStatus>) => {
    // Log the update attempt for debugging
    console.log(`updateProcessingStatus called for ${videoId} with:`, status);
    
    // Check if we have a database ID in the status update (from our enhanced WebSocket message)
    const databaseId = status.databaseId;
    
    // If we have a database ID, use that instead of the videoId from the message
    // This handles the case where videoId is a YouTube ID but we track by database UUID
    const lookupId = databaseId || videoId;
    
    console.log(`Using lookup ID: ${lookupId} ${databaseId ? '(from databaseId)' : '(from videoId)'}`);
    
    setProcessingVideos(prev => {
      // First try with the preferred ID (database UUID)
      if (prev[lookupId]) {
        console.log(`Found video in processing state with ID: ${lookupId}`);
        
        // Update using the database ID
        const updatedVideo = {
          ...prev[lookupId],
          ...status,
          // These properties might come from the original videoId
          videoId: lookupId, // Keep the database ID as primary ID
          // Store additional identifiers if available for future reference
          youtubeId: status.youtubeId,
          databaseId: databaseId,
          // Make sure processingProgress is always a number
          processingProgress: typeof status.processingProgress === 'number' ? 
            status.processingProgress : prev[lookupId].processingProgress,
          // Automatically update last update time if not provided
          processingLastUpdated: status.processingLastUpdated || new Date()
        };
        
        console.log(`Updating state for ${lookupId}, current:`, prev[lookupId]);
        
        return {
          ...prev,
          [lookupId]: updatedVideo
        };
      }
      
      // If not found with preferred ID, try alternative ID formats
      // This is for backward compatibility and edge cases
      if (!prev[lookupId]) {
        // Check if we have any key in the state that corresponds to this video
        // This could happen if we registered with different ID format
        // e.g., registered with UUID but receiving updates with YouTube ID
        
        if (databaseId && prev[videoId]) {
          // Case: we have prev[youtubeId] but received a message with databaseId
          console.log(`Found video with original videoId ${videoId} instead of databaseId ${databaseId}`);
          
          const updatedVideo = {
            ...prev[videoId],
            ...status,
            processingProgress: typeof status.processingProgress === 'number' ? 
              status.processingProgress : prev[videoId].processingProgress,
            processingLastUpdated: status.processingLastUpdated || new Date(),
            youtubeId: status.youtubeId,
            databaseId: databaseId
          };
          
          return {
            ...prev,
            [videoId]: updatedVideo
          };
        }
        
        console.log(`Video ${lookupId} not found in processing state, ignoring update`);
        return prev;
      }
      
      console.log(`Updating state for ${lookupId}, current:`, prev[lookupId]);
      
      // If the status is completed or failed, update state and keep it permanently
      if (status.processingStatus === 'completed' || status.processingStatus === 'failed') {
        console.log(`Video ${videoId} ${status.processingStatus}. Updating with final state.`);
        
        // Notify subscribers about the status change to completed/failed
        notifyStatusChange({
          videoId: lookupId,
          oldStatus: prev[lookupId] ? (prev[lookupId] as VideoProcessingStatus).processingStatus : undefined,
          newStatus: status.processingStatus as string,
          databaseId: databaseId,
          youtubeId: status.youtubeId
        });
        
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
      // Explicitly handle each field to ensure consistent updates
      const updatedVideo = {
        ...prev[videoId],
        ...status,
        // Make sure processingProgress is always a number
        processingProgress: typeof status.processingProgress === 'number' ? 
          status.processingProgress : prev[videoId].processingProgress,
        // Automatically update last update time if not provided
        processingLastUpdated: status.processingLastUpdated || new Date()
      };
      
      console.log(`State update for ${videoId} - Before:`, {
        oldProgress: prev[videoId].processingProgress,
        newProgress: updatedVideo.processingProgress,
        oldStatus: prev[videoId].processingStatus,
        newStatus: updatedVideo.processingStatus
      });
      
      const result = {
        ...prev,
        [videoId]: updatedVideo
      };
      
      return result;
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
        const removedIds: string[] = [];
        
        Object.entries(newState).forEach(([id, status]) => {
          if (!status.processingLastUpdated || 
              (now - status.processingLastUpdated.getTime() > staleThreshold)) {
            delete newState[id];
            removedIds.push(id);
          }
        });
        
        if (removedIds.length > 0) {
          console.log(`Removed ${removedIds.length} stale processing videos from context:`, removedIds);
        }
        
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
          const rawData = event.data;
          console.log(`Raw WebSocket message received:`, rawData);
          
          const statusUpdate = JSON.parse(rawData);
          
          // First message might be a connection confirmation
          if (statusUpdate.type === 'connection') {
            console.log(`WebSocket connection confirmed (ID: ${statusUpdate.connectionId})`);
            return;
          }
          
          // Ensure we have a valid videoId
          if (!statusUpdate || !statusUpdate.videoId) {
            console.warn(`Received WebSocket message without videoId:`, statusUpdate);
            return;
          }
          
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
          
          // Format might vary between server implementations
          // Make sure we have all required fields in the expected format
          const normalizedUpdate = {
            videoId: statusUpdate.videoId,
            // Include the database UUID and YouTube ID if available (from our enhanced server)
            databaseId: statusUpdate.databaseId,
            youtubeId: statusUpdate.youtubeId,
            // Handle different status field names
            processingStatus: statusUpdate.processingStatus !== undefined ? 
              statusUpdate.processingStatus : statusUpdate.status,
            // Handle different progress field names
            processingProgress: statusUpdate.processingProgress !== undefined ? 
              statusUpdate.processingProgress : (statusUpdate.progress || 0),
            // Handle different stage field names  
            processingStage: statusUpdate.processingStage !== undefined ? 
              statusUpdate.processingStage : statusUpdate.stage,
            // Handle different error field names
            processingError: statusUpdate.processingError !== undefined ? 
              statusUpdate.processingError : statusUpdate.error,
            // Use server timestamp if available
            processingLastUpdated: statusUpdate.serverTimestamp ? 
              new Date(statusUpdate.serverTimestamp) : new Date(),
            // Pass through estimated time remaining
            estimatedTimeRemaining: statusUpdate.estimatedTimeRemaining
          };
          
          // Log the IDs we're dealing with
          console.log(`WebSocket message contains IDs - videoId: ${normalizedUpdate.videoId}, databaseId: ${normalizedUpdate.databaseId}, youtubeId: ${normalizedUpdate.youtubeId}`);
          
          // DEBUG: Always log the progress value to see if it's coming through
          console.log(`Progress value for ${statusUpdate.videoId}: Original=${statusUpdate.progress || 'undefined'}, Processing=${statusUpdate.processingProgress || 'undefined'}, Normalized=${normalizedUpdate.processingProgress || 0}`);
          
          
          console.log(`Normalized update for video ${normalizedUpdate.videoId}:`, normalizedUpdate);
          
          // Before updating, log the current state for comparison
          if (processingVideos[normalizedUpdate.videoId]) {
            const currentState = processingVideos[normalizedUpdate.videoId];
            console.log(`COMPARING: Current state vs new state for ${normalizedUpdate.videoId}:`, {
              currentProgress: currentState.processingProgress,
              newProgress: normalizedUpdate.processingProgress,
              currentStatus: currentState.processingStatus,
              newStatus: normalizedUpdate.processingStatus,
              willUpdate: currentState.processingProgress !== normalizedUpdate.processingProgress || 
                         currentState.processingStatus !== normalizedUpdate.processingStatus
            });
          }

          // Update processing status with normalized data
          updateProcessingStatus(normalizedUpdate.videoId, normalizedUpdate);
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
  
  // Set up a periodic cleanup for stale processing videos
  useEffect(() => {
    // Run cleanup every 5 minutes to prevent videos getting stuck in processing state
    const cleanupInterval = 5 * 60 * 1000; // 5 minutes
    
    // Initial cleanup when component mounts (after a short delay to prevent React errors)
    const initialCleanupTimeout = setTimeout(() => {
      clearStaleProcessingVideos();
    }, 1000);
    
    // Set up interval for regular cleanup
    const intervalId = setInterval(() => {
      // Only run if we have processing videos
      if (Object.keys(processingVideos).length > 0) {
        console.log('Running periodic cleanup of stale processing videos...');
        clearStaleProcessingVideos();
      }
    }, cleanupInterval);
    
    // Clean up interval on unmount
    return () => {
      clearTimeout(initialCleanupTimeout);
      clearInterval(intervalId);
    };
  }, []); // Empty dependency array to run only once on mount

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

  // Function to completely remove a video from the context when "Remove" is clicked
  const removeVideoFromContext = (videoId: string) => {
    console.log(`Removing video ${videoId} completely from processing context`);
    
    setProcessingVideos(prev => {
      // Create a new state object without the specified video
      const newState = { ...prev };
      
      // Check if this video exists in our state with this ID
      if (newState[videoId]) {
        delete newState[videoId];
        console.log(`Deleted video ${videoId} from processing context`);
      } else {
        // Try to find the video by scanning all entries (in case it's tracked by a different ID)
        let foundKey = null;
        Object.entries(newState).forEach(([key, value]) => {
          // Check if this entry matches our target video by database ID or YouTube ID
          if ((value.databaseId && value.databaseId === videoId) || 
              (value.youtubeId && value.youtubeId === videoId)) {
            foundKey = key;
          }
        });
        
        if (foundKey) {
          console.log(`Found video ${videoId} in context under key ${foundKey}, removing it`);
          delete newState[foundKey];
        } else {
          console.log(`Video ${videoId} not found in processing context`);
        }
      }
      
      // Save the updated state to localStorage
      try {
        if (Object.keys(newState).length > 0) {
          localStorage.setItem(VIDEO_PROCESSING_STORAGE_KEY, JSON.stringify(newState));
        } else {
          // If there are no videos left, remove the item from localStorage
          localStorage.removeItem(VIDEO_PROCESSING_STORAGE_KEY);
        }
      } catch (error) {
        console.error('Error updating localStorage after removing video:', error);
      }
      
      return newState;
    });
  };

  // Value to be provided to consuming components
  const value = {
    processingVideos,
    registerProcessingVideo,
    updateProcessingStatus,
    clearStaleProcessingVideos,
    deselectCompletedVideos,
    removeVideoFromContext,
    onStatusChange
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