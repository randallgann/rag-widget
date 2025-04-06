import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface VideoProcessingContextType {
  // Videos currently being processed with their detailed status
  processingVideos: Record<string, VideoProcessingStatus>;
  // Function to register a video for processing (called after API response)
  registerProcessingVideo: (videoId: string, initialStatus: VideoProcessingStatus) => void;
  // Function to update a video's processing status (called when status message received)
  updateProcessingStatus: (videoId: string, status: Partial<VideoProcessingStatus>) => void;
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

  // Setup WebSocket for real-time status updates
  useEffect(() => {
    // Create WebSocket connection
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/api/status-updates`;
    
    console.log(`Connecting to WebSocket at ${wsUrl}`);
    const newSocket = new WebSocket(wsUrl);
    
    // Connection opened
    newSocket.addEventListener('open', (event) => {
      console.log('Connected to status updates WebSocket');
    });
    
    // Listen for status update messages
    newSocket.addEventListener('message', (event) => {
      try {
        const statusUpdate = JSON.parse(event.data);
        if (statusUpdate && statusUpdate.videoId) {
          console.log('Received status update via WebSocket:', statusUpdate);
          updateProcessingStatus(statusUpdate.videoId, statusUpdate);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    // Connection closed or error
    newSocket.addEventListener('close', (event) => {
      console.log('Disconnected from status updates WebSocket');
      
      // Try to reconnect after a delay
      setTimeout(() => {
        console.log('Attempting to reconnect WebSocket...');
        setSocket(null);
      }, 5000);
    });
    
    newSocket.addEventListener('error', (event) => {
      console.error('WebSocket error:', event);
    });
    
    // Set the socket in state
    setSocket(newSocket);
    
    // Clean up on unmount
    return () => {
      if (newSocket.readyState === WebSocket.OPEN) {
        newSocket.close();
      }
    };
  }, []);

  // Value to be provided to consuming components
  const value = {
    processingVideos,
    registerProcessingVideo,
    updateProcessingStatus
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