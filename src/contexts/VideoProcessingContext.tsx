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
}

export interface VideoProcessingStatus {
  videoId: string;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  processingProgress: number;
  processingStage?: string | null;
  processingError?: string | null;
  processingLastUpdated?: Date;
  estimatedTimeRemaining?: number;
}

const VideoProcessingContext = createContext<VideoProcessingContextType | undefined>(undefined);

export const VideoProcessingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [processingVideos, setProcessingVideos] = useState<Record<string, VideoProcessingStatus>>({});
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  
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
      
      // If the status is completed or failed, we remove it from active processing
      if (status.processingStatus === 'completed' || status.processingStatus === 'failed') {
        const newState = { ...prev };
        delete newState[videoId];
        return newState;
      }
      
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
      
      // Connection opened
      newSocket.addEventListener('open', (event) => {
        console.log('Connected to status updates WebSocket');
        setIsReconnecting(false);
      });
      
      // Listen for status update messages
      newSocket.addEventListener('message', (event) => {
        try {
          const statusUpdate = JSON.parse(event.data);
          if (statusUpdate && statusUpdate.videoId) {
            console.log('Received status update via WebSocket:', statusUpdate);
            updateProcessingStatus(statusUpdate.videoId, statusUpdate);
          }
        } catch (error: any) {
          console.error('Error processing WebSocket message:', error);
        }
      });
      
      // Connection closed or error
      newSocket.addEventListener('close', (event) => {
        console.log('Disconnected from status updates WebSocket');
        
        // Try to reconnect after a delay
        setSocket(null);
        
        if (!isReconnecting) {
          setIsReconnecting(true);
          setTimeout(() => {
            console.log('Attempting to reconnect WebSocket...');
            setIsReconnecting(false);
          }, 5000);
        }
      });
      
      newSocket.addEventListener('error', (event) => {
        console.error('WebSocket error:', event);
      });
      
      // Set the socket in state
      setSocket(newSocket);
    };
    
    connectWebSocket();
    
    // Clean up on unmount
    return () => {
      if (socket && (socket as WebSocket).readyState === WebSocket.OPEN) {
      (socket as WebSocket).close();
    }
    };
  }, [socket, isReconnecting]);
  
  // On socket reconnection, verify processing statuses
  useEffect(() => {
    if (socket && Object.keys(processingVideos).length > 0) {
      console.log('Socket reconnected. Verifying processing statuses for existing videos...');
      // We'll let the channel detail component handle verification
      // since it has access to the authenticatedFetch method
    }
  }, [socket]);

  // Value to be provided to consuming components
  const value = {
    processingVideos,
    registerProcessingVideo,
    updateProcessingStatus,
    clearStaleProcessingVideos
  };

  return (
    <VideoProcessingContext.Provider value={value}>
      {children}
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