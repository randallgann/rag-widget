import React from 'react';
import { Badge } from './badge';
import { Text } from './text';
import { useVideoProcessing } from '../contexts/VideoProcessingContext';

interface VideoProcessingStatusProps {
  videoId: string;
  initialStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  initialProgress?: number;
  initialStage?: string;
  className?: string;
}

export const VideoProcessingStatus: React.FC<VideoProcessingStatusProps> = ({
  videoId,
  initialStatus = 'pending',
  initialProgress = 0,
  initialStage,
  className = '',
}) => {
  // Force an alert to see if this component is rendering at all
  // if (videoId.includes('FIRST')) {
  //   alert(`VideoProcessingStatus rendering for first video: ${videoId}`);
  // }
  
  // Try different console methods
  // console.warn(`[WARNING] VideoProcessingStatus rendering for: ${videoId}`);
  // console.error(`[ERROR] VideoProcessingStatus check for: ${videoId}`);
  
  // Check if we're getting the context
  const { processingVideos } = useVideoProcessing();
  
  // Add debug logging with useEffect to track status changes
  React.useEffect(() => {
    // Get the current status from context or initial props
    const status = processingVideos[videoId] ? 
      processingVideos[videoId].processingStatus : initialStatus;
    
    // Get the current progress from context or initial props
    const progress = processingVideos[videoId] ? 
      processingVideos[videoId].processingProgress : initialProgress;

    // console.log(`[DEBUG][${videoId}] Status: ${status}, Progress: ${progress}`);
  }, [videoId, processingVideos, initialStatus, initialProgress]);
  
  // Helper to format time remaining
  const formatTimeRemaining = (seconds?: number) => {
    if (!seconds) return 'Calculating...';
    
    if (seconds < 60) {
      return `${seconds} seconds`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
  };
  
  // Helper to get stage name
  const getStageName = (stage?: string | null) => {
    if (!stage) return 'Processing';
    
    const stageMap: Record<string, string> = {
      'initialization': 'Initializing',
      'downloading': 'Downloading Video',
      'extracting_audio': 'Extracting Audio',
      'transcribing': 'Transcribing Audio',
      'generating_embeddings': 'Generating Embeddings',
      'storing_results': 'Storing Results',
      'finished': 'Processing Complete',
      'error': 'Error'
    };
    
    return stageMap[stage] || stage;
  };
  
  // Get the current status from context or use initial props
  const videoStatus = processingVideos[videoId] || {
    processingStatus: initialStatus,
    processingProgress: initialProgress,
    processingStage: initialStage,
  };
  
  //Debug logging - uncomment if needed
  // console.log(`VideoProcessingStatus for ${videoId}:`, {
  //   fromContext: processingVideos[videoId] ? true : false,
  //   status: videoStatus.processingStatus,
  //   progress: videoStatus.processingProgress,
  //   initialStatus,
  //   initialProgress
  // });
  
  // Check if this is a final state (completed/failed but still in the processing state)
  const isFinalState = videoStatus.finalState === true;
  
  const { 
    processingStatus, 
    processingProgress, 
    processingStage, 
    processingError,
    estimatedTimeRemaining 
  } = videoStatus;
  
  return (
    <div className={`flex flex-col ${className}`}>
      <Badge 
        color={
          processingStatus === 'completed' ? 'green' : 
          processingStatus === 'processing' ? 'blue' : 
          processingStatus === 'failed' ? 'red' : 'yellow'
        }
        className={isFinalState ? 'transition-all animate-pulse duration-500' : ''}
      >
        {processingStatus}
        {/* Always show the indicators for completed/failed statuses, but only animate when finalState is true */}
        {(processingStatus === 'completed' ? ' ✓' : processingStatus === 'failed' ? ' ✗' : '')}
      </Badge>
      
      {processingStatus === 'processing' && (
        <div className="mt-1">
          <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-500" 
              style={{ width: `${Math.max(0, Math.min(100, processingProgress || 0))}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>{Math.max(0, Math.min(100, processingProgress || 0))}%</span>
            {processingStage && (
              <span className="text-blue-500">{getStageName(processingStage)}</span>
            )}
          </div>
          {estimatedTimeRemaining !== undefined && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatTimeRemaining(estimatedTimeRemaining)} remaining
            </span>
          )}
        </div>
      )}
      
      {processingStatus === 'failed' && processingError && (
        <div className="mt-1">
          <span className="text-xs text-red-500 truncate block max-w-xs" title={processingError}>
            {processingError}
          </span>
        </div>
      )}
    </div>
  );
};