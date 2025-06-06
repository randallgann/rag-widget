import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { UserProfileResponse, ChannelResponse, VideoResponse } from '../../types/api';
import { StatusChangeEvent, useVideoProcessing } from '../../contexts/VideoProcessingContext';
import { VideoProcessingStatus } from '../../components/video-processing-status';
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
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '../../components/table';
import { Checkbox } from '../../components/checkbox';
import {
  ArrowRightStartOnRectangleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Cog8ToothIcon,
  LightBulbIcon,
  PlusIcon,
  ShieldCheckIcon,
  UserCircleIcon,
  VideoCameraIcon,
  ArrowRightIcon,
  DocumentTextIcon,
  CodeBracketIcon,
  TrashIcon,
  PencilIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/16/solid';
import {
  Cog6ToothIcon,
  HomeIcon,
  QuestionMarkCircleIcon,
  SparklesIcon,
} from '@heroicons/react/20/solid';

interface ChannelDetailPageProps {
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

// Helper to format duration (PT1H2M3S -> 1:02:03)
const formatDuration = (duration: string): string => {
  if (!duration) return '';
  
  // Convert ISO 8601 duration to human-readable format
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return duration;
  
  const hours = match[1] ? parseInt(match[1]) : 0;
  const minutes = match[2] ? parseInt(match[2]) : 0;
  const seconds = match[3] ? parseInt(match[3]) : 0;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
};

// Helper to format view count (1234567 -> 1.2M)
const formatViewCount = (count: number): string => {
  if (!count && count !== 0) return '';
  
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  } else {
    return count.toString();
  }
};

// Helper to extract video ID from YouTube thumbnail URL and create a proxied URL
const getProxiedThumbnailUrl = (url: string): string => {
  if (!url) return '';
  
  // Extract video ID from YouTube URL
  // Example URL: https://i.ytimg.com/vi/r9z-HeW_9OY/default.jpg
  const regex = /\/vi\/([^/]+)\//;
  const match = url.match(regex);
  
  if (match && match[1]) {
    const videoId = match[1];
    const size = url.includes('default.jpg') ? 'default' : 
                 url.includes('mqdefault.jpg') ? 'mqdefault' :
                 url.includes('hqdefault.jpg') ? 'hqdefault' : 'default';
                 
    return `/api/proxy/thumbnail/${videoId}?size=${size}`;
  }
  
  // If we can't extract the ID, return the original URL as fallback
  return url;
};

// The VideoProcessingProvider has been moved to App.tsx
// to prevent multiple WebSocket connections

const ChannelDetailPage: React.FC<ChannelDetailPageProps> = ({ authenticatedFetch, user: initialUser }) => {
  const { channelId } = useParams<{ channelId: string }>();
  const [user, setUser] = useState<UserProfileResponse['user'] | null>(initialUser || null);
  const [channel, setChannel] = useState<ChannelResponse | null>(null);
  const [videos, setVideos] = useState<VideoResponse[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<string>('publishedAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Get video processing status context
  const { processingVideos, registerProcessingVideo, clearStaleProcessingVideos, deselectCompletedVideos, removeVideoFromContext, onStatusChange } = useVideoProcessing();
  
  // Add direct console debug to check if context is working
  // console.warn('CHANNEL DETAIL: processingVideos from context:', processingVideos);
  // Force an alert to see if this code is running
  // alert(`Channel Detail loaded with ${Object.keys(processingVideos).length} videos in processing context`);

  // Create a simple logger for the channel detail page
  const logger = {
    debug: (message: string, data?: any) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[CHANNEL DETAIL DEBUG] ${message}`, data || '');
      }
    },
    error: (message: string, data?: any) => {
      console.error(`[CHANNEL DETAIL ERROR] ${message}`, data || '');
    }
  };

  useEffect(() => {
    fetchChannelDetails();
  }, [channelId]);
  
  // Set up status change listener to update the videos when a video completes
  useEffect(() => {
    // This will be called when a video status changes to completed/failed
    const handleStatusChange = (event: StatusChangeEvent) => {
      if (event.newStatus === 'completed' || event.newStatus === 'failed') {
        logger.debug(`Received status change to ${event.newStatus} for video ${event.videoId}`, event);
        
        // Find the video in our videos array and update its status
        setVideos(currentVideos => {
          return currentVideos.map(video => {
            // Match by database ID or video ID
            if (video.id === event.videoId || video.id === event.databaseId) {
              logger.debug(`Updating video ${video.id} status to ${event.newStatus} in videos array`);
              return {
                ...video,
                processingStatus: event.newStatus as 'completed' | 'failed' | 'processing' | 'pending',
                processingProgress: event.newStatus === 'completed' ? 100 : video.processingProgress,
                processingStage: event.newStatus === 'completed' ? 'complete' : 
                                event.newStatus === 'failed' ? 'failed' : 
                                video.processingStage,
                processingLastUpdated: new Date().toISOString()
              };
            }
            return video;
          });
        });
      }
    };
    
    // Register our status change listener
    const unsubscribe = onStatusChange(handleStatusChange);
    
    // Cleanup function to unsubscribe when component unmounts
    return () => {
      unsubscribe();
    };
  }, [onStatusChange]);
  
  // Clean up any completed videos and deselect non-processing videos on page load
  useEffect(() => {
    if (videos.length > 0) {
      // 1. Find completed videos that are still marked as selected
      const completedButSelectedIds = videos
        .filter(video => 
          video.processingStatus === 'completed' && 
          video.selectedForProcessing === true
        )
        .map(video => video.id);
      
      // 2. Find all videos that are selected but not processing (these should be deselected on page load)
      const selectedNonProcessingIds = videos
        .filter(video => 
          video.selectedForProcessing === true && 
          video.processingStatus !== 'processing'
        )
        .map(video => video.id);
      
      // 3. Combine the lists, removing duplicates
      const idsToDeselect = Array.from(new Set([...completedButSelectedIds, ...selectedNonProcessingIds]));
      
      if (idsToDeselect.length > 0) {
        logger.debug(`Deselecting ${completedButSelectedIds.length} completed videos and ${selectedNonProcessingIds.length - completedButSelectedIds.length} non-processing videos that were still selected...`);
        
        // Use our own deselection function with proper authentication
        (async () => {
          try {
            const response = await authenticatedFetch('/api/videos/select-batch', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                videoIds: idsToDeselect,
                selectedForProcessing: false
              })
            });
            
            if (response.ok) {
              logger.debug(`Successfully deselected ${idsToDeselect.length} videos in database`);
            } else {
              logger.error(`Failed to deselect videos in database: ${response.status} ${response.statusText}`);
            }
          } catch (error) {
            logger.error('Error deselecting videos in database:', error);
          }
        })();
        
        // Also clear them from local state immediately for better UI responsiveness
        setSelectedVideos(prev => {
          const newSelected = new Set(prev);
          idsToDeselect.forEach(id => newSelected.delete(id));
          return newSelected;
        });
      }
    }
  }, [videos]);
  
  // Initialize selected videos from the server data when videos are loaded
  // Only include videos that are actively processing - all other selections are cleared on page load
  useEffect(() => {
    if (videos.length > 0) {
      const initiallySelected = new Set<string>();
      
      // ONLY add videos that are in 'processing' state
      videos.forEach(video => {
        if (video.processingStatus === 'processing') {
          initiallySelected.add(video.id);
        }
      });
      
      setSelectedVideos(initiallySelected);
      
      // Log details about what would have been selected vs what we actually selected
      const selectedInDb = videos.filter(v => v.selectedForProcessing).length;
      const processingVideosCount = videos.filter(v => v.processingStatus === 'processing').length;
      const nonProcessingSelected = videos.filter(v => 
        v.selectedForProcessing && v.processingStatus !== 'processing'
      ).length;
      
      logger.debug(`Initialized ${initiallySelected.size} processing videos as selected (out of ${selectedInDb} marked as selected in DB)`);
      if (nonProcessingSelected > 0) {
        logger.debug(`Filtered out ${nonProcessingSelected} videos that were selected but not actively processing`);
      }
    }
  }, [videos]);
  
  // Create a ref to track if we've already checked processing status
  const processingCheckedRef = useRef(false);

  // Verify that videos in processing status are still actually processing - but only once when the component mounts
  useEffect(() => {
    const checkAndResetStaleProcessingVideos = async () => {
      try {
        // Identify videos that appear to be processing in the UI
        const processingVideoIds = videos
          .filter(video => video.processingStatus === 'processing')
          .map(video => video.id);
        
        if (processingVideoIds.length === 0) return;
        
        logger.debug(`Verifying ${processingVideoIds.length} videos in processing state (one-time check)`);
        
        // Check their actual status from the server (just once when component mounts)
        await checkProcessingStatus(processingVideoIds);
        
        // Check for stale processing videos (processing for too long)
        // Threshold for how long a video can be in processing state before considered stale (3 hours)
        const staleThresholdMs = 3 * 60 * 60 * 1000; 
        const now = new Date().getTime();
        
        // Find videos that have been processing for too long
        const staleVideos = videos.filter(video => {
          if (video.processingStatus !== 'processing') return false;
          
          // If we have a lastUpdated timestamp, use it to check staleness
          if (video.processingLastUpdated) {
            const lastUpdated = new Date(video.processingLastUpdated).getTime();
            return (now - lastUpdated) > staleThresholdMs;
          }
          
          // If there's no timestamp but status is processing, consider it stale too
          return true;
        });
        
        if (staleVideos.length > 0) {
          logger.debug(`Found ${staleVideos.length} stale processing videos, resetting their status...`);
          
          // Reset each stale video
          for (const video of staleVideos) {
            try {
              const response = await authenticatedFetch(`/api/videos/${video.id}/reset-processing`, {
                method: 'PUT'
              });
              
              if (response.ok) {
                logger.debug(`Successfully reset stale processing status for video ${video.id}`);
                // Clear it from the processing context
                clearStaleProcessingVideos([video.id]);
                
                // Also remove it from selected videos state
                setSelectedVideos(prevSelected => {
                  const newSelected = new Set(prevSelected);
                  newSelected.delete(video.id);
                  return newSelected;
                });
              } else {
                // Try to get more detailed error message
                try {
                  const errorData = await response.json();
                  logger.error(`Failed to reset stale video ${video.id}: ${errorData.message || response.statusText}`);
                } catch {
                  logger.error(`Failed to reset stale video ${video.id}: ${response.status} ${response.statusText}`);
                }
              }
            } catch (resetError) {
              logger.error(`Error while trying to reset stale processing video ${video.id}:`, resetError);
            }
          }
          
          // Refresh the videos list to update UI
          await fetchChannelDetails();
        }
      } catch (error: any) {
        logger.error('Error checking stale processing videos:', error);
      }
    };
    
    // Only check once when the component first mounts with videos loaded
    if (videos.length > 0 && !loading && !processingCheckedRef.current) {
      checkAndResetStaleProcessingVideos();
      processingCheckedRef.current = true;
    }
  }, [videos, loading]);

  // Fetch channel details and videos
  const fetchChannelDetails = async () => {
    try {
      setLoading(true);
      logger.debug(`Fetching channel details for ID: ${channelId}`);
      
      const response = await authenticatedFetch(`/api/channels/${channelId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch channel details: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      logger.debug('Channel data received', data);
      
      if (data.status === 'success' && data.data.channel) {
        setChannel(data.data.channel);
        
        // Extract videos from the channel data
        if (data.data.channel.videos) {
          setVideos(data.data.channel.videos);
          
          // Register processing videos in WebSocket context without polling
          const processingVideos = data.data.channel.videos.filter(
            (v: VideoResponse) => v.processingStatus === 'processing'
          );
          
          if (processingVideos.length > 0) {
            logger.debug(`Found ${processingVideos.length} videos with processing status, registering with WebSocket context...`);
            // Don't call checkProcessingStatus here - let WebSocket handle updates
            // Just clear any stale processing that might be leftover
            clearStaleProcessingVideos();
          } else {
            // If no videos are processing, clear any stale processing states in the context
            clearStaleProcessingVideos();
          }
        }
      } else {
        throw new Error('Invalid channel data received');
      }
      
      setLoading(false);
    } catch (error) {
      logger.error('Error fetching channel details', error);
      setError('Failed to load channel details. Please try again.');
      setLoading(false);
    }
  };

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

  // Function to handle video selection
  const handleVideoSelection = async (videoId: string) => {
    if (!videoId) {
      logger.error('Attempted to select video with invalid ID');
      return;
    }
    
    // Check if video is currently processing - if so, don't allow selection changes
    const video = videos.find(v => v.id === videoId);
    const isProcessing = video?.processingStatus === 'processing' || 
                         processingVideos[videoId]?.processingStatus === 'processing';
    
    if (isProcessing) {
      logger.debug(`Cannot change selection for video ${videoId} as it is currently processing`);
      return;
    }
    
    try {
      const isCurrentlySelected = selectedVideos.has(videoId);
      const newSelectionState = !isCurrentlySelected;
      
      // Optimistically update the UI
      setSelectedVideos(prevSelected => {
        const newSelected = new Set(prevSelected);
        if (isCurrentlySelected) {
          newSelected.delete(videoId);
        } else {
          newSelected.add(videoId);
        }
        return newSelected;
      });
      
      // Make API call to update selection status
      const response = await authenticatedFetch(`/api/videos/${videoId}/select`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ selectedForProcessing: newSelectionState })
      });
      
      if (!response.ok) {
        // Revert to previous state if the API call fails
        setSelectedVideos(prevSelected => {
          const newSelected = new Set(prevSelected);
          if (newSelectionState) {
            newSelected.delete(videoId);
          } else {
            newSelected.add(videoId);
          }
          return newSelected;
        });
        
        throw new Error(`Failed to update video selection: ${response.status} ${response.statusText}`);
      }
      
      logger.debug(`Video ${videoId} selection updated to ${newSelectionState}`);
    } catch (error: any) {
      logger.error('Error updating video selection', error);
    }
  };

  // Function to handle selecting all videos on the current page
  const handleSelectAllOnPage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const isSelected = event.target.checked;
    const videosOnPage = filteredVideos
      .slice((currentPage - 1) * pageSize, currentPage * pageSize)
      // Exclude videos that are already processing
      .filter(video => {
        const isProcessing = video.processingStatus === 'processing' || 
                            processingVideos[video.id]?.processingStatus === 'processing';
        return !isProcessing;
      });
    
    if (videosOnPage.length === 0) {
      logger.debug('No selectable videos on this page (all are processing or page is empty)');
      return;
    }
    
    try {
      // Optimistically update UI
      if (isSelected) {
        // Add all videos on current page
        const newSelected = new Set(selectedVideos);
        videosOnPage.forEach(video => newSelected.add(video.id));
        setSelectedVideos(newSelected);
      } else {
        // Remove all videos on current page
        const newSelected = new Set(selectedVideos);
        videosOnPage.forEach(video => newSelected.delete(video.id));
        setSelectedVideos(newSelected);
      }
      
      // Make API call to update selection status for all videos on this page
      const videoIds = videosOnPage.map(video => video.id);
      const response = await authenticatedFetch('/api/videos/select-batch', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          videoIds,
          selectedForProcessing: isSelected
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update batch selection: ${response.status} ${response.statusText}`);
      }
      
      logger.debug(`Batch selection updated for ${videoIds.length} videos to ${isSelected}`);
    } catch (error: any) {
      logger.error('Error updating batch selection', error);
      
      // Revert UI on error
      if (isSelected) {
        // Remove all videos on current page
        const newSelected = new Set(selectedVideos);
        videosOnPage.forEach(video => {
          if (video && video.id) {
            newSelected.delete(video.id);
          }
        });
        setSelectedVideos(newSelected);
      } else {
        // Add all videos on current page
        const newSelected = new Set(selectedVideos);
        videosOnPage.forEach(video => {
          if (video && video.id) {
            newSelected.add(video.id);
          }
        });
        setSelectedVideos(newSelected);
      }
    }
  };

  // Function to handle refreshing a channel
  const handleRefreshChannel = async () => {
    try {
      setIsRefreshing(true);
      logger.debug(`Refreshing channel ${channelId}`);
      
      // Refresh channel details and videos
      await fetchChannelDetails();
      
      // Reset any stale processing states
      clearStaleProcessingVideos();
      
      setIsRefreshing(false);
    } catch (error: any) {
      logger.error(`Error refreshing channel ${channelId}`, error);
      setIsRefreshing(false);
    }
  };
  
  // Function to reset a failed or completed video processing status
  const handleResetVideoProcessing = async (videoId: string) => {
    try {
      logger.debug(`Resetting processing status for video ${videoId}`);
      
      const video = videos.find(v => v.id === videoId);
      if (!video) {
        logger.error(`Cannot find video with ID ${videoId}`);
        return;
      }
      
      // Only allow resetting videos that are in a failed or completed state
      if (video.processingStatus !== 'failed' && video.processingStatus !== 'completed') {
        logger.debug(`Cannot reset video in ${video.processingStatus} state`);
        return;
      }
      
      // Check if trying to remove a completed video
      const isRemovingCompletedVideo = video.processingStatus === 'completed';
      
      if (isRemovingCompletedVideo) {
        const confirmed = window.confirm(
          `Are you sure you want to remove this processed video? All processed transcripts and data for this video will be removed.`
        );
        
        if (!confirmed) {
          return;
        }
      }
      
      const response = await authenticatedFetch(`/api/videos/${videoId}/reset-processing`, {
        method: 'PUT'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to reset processing status: ${response.status} ${response.statusText}`);
      }
      
      // Note: When removing a completed video, we should also remove data from the vector database
      // This functionality will be implemented server-side in the future
      // The current reset-processing endpoint only resets the video status in the regular database
      
      /* 
       * TODO: Future implementation for vector database cleanup
       * This would involve adding code to the resetVideoProcessing controller function to:
       * 1. Check if the video being reset was in 'completed' state
       * 2. If so, delete all related vector embeddings:
       *    - Execute SQL: DELETE FROM video_segments WHERE video_id = videoId;
       *    - or use a VectorService/QueryService method like:
       *      await vectorDbService.removeVideoEmbeddings(videoId);
       */
      
      logger.debug(`Successfully reset processing status for video ${videoId}`);
      
      // Remove the video from the processing context to ensure it doesn't show as completed
      // This is crucial when removing completed videos
      if (isRemovingCompletedVideo) {
        logger.debug(`Removing video ${videoId} from processing context after reset`);
        removeVideoFromContext(videoId);
      }
      
      // Refresh videos to update UI
      await fetchChannelDetails();
      
    } catch (error: any) {
      logger.error('Error resetting video processing status:', error);
      alert('Failed to reset video processing status. Please try again.');
    }
  };

  // Function to check processing status of videos
  const checkProcessingStatus = async (videoIds: string[]) => {
    try {
      // Filter any invalid or empty IDs
      const validVideoIds = videoIds.filter(id => id && id.trim().length > 0);
      
      if (validVideoIds.length === 0) return;
      
      logger.debug(`Checking processing status for ${validVideoIds.length} videos`);
      
      const response = await authenticatedFetch(`/api/videos/status-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ videoIds: validVideoIds })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get processing status: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'success' && data.data.videos) {
        // Update videos with the latest status
        setVideos(prevVideos => {
          const updatedVideos = [...prevVideos];
          
          data.data.videos.forEach((statusVideo: any) => {
            if (statusVideo && statusVideo.id) {
              const videoIndex = updatedVideos.findIndex(v => v.id === statusVideo.id);
              if (videoIndex !== -1) {
                updatedVideos[videoIndex] = {
                  ...updatedVideos[videoIndex],
                  processingStatus: statusVideo.processingStatus,
                  processingProgress: statusVideo.processingProgress,
                  processingStage: statusVideo.processingStage,
                  processingError: statusVideo.processingError
                };
              }
            }
          });
          
          return updatedVideos;
        });
        
        // Keep processing context in sync with database
        // If a video shows as not processing in DB but is in our context, remove it
        const staleProcessingIds = data.data.videos
          .filter((v: any) => v.processingStatus !== 'processing')
          .map((v: any) => v.id);
          
        if (staleProcessingIds.length > 0) {
          clearStaleProcessingVideos(staleProcessingIds);
        }
      }
    } catch (error: any) {
      logger.error('Error checking processing status:', error);
    }
  };

  // We've removed the polling effect since we now use WebSockets for real-time updates
  // Register any videos that are already processing when the component mounts
  useEffect(() => {
    // Get videos that are currently processing
    const processingVideos = videos
      .filter(video => video.processingStatus === 'processing');
    
    if (processingVideos.length === 0) return;
    
    // Register them in the context
    processingVideos.forEach(video => {
      registerProcessingVideo(video.id, {
        videoId: video.id,
        processingStatus: video.processingStatus,
        processingProgress: video.processingProgress || 0,
        processingStage: video.processingStage,
        processingError: video.processingError,
      });
    });
    
    logger.debug(`Registered ${processingVideos.length} videos that are already processing`);
  }, [videos]);

  // Function to process selected videos
  const handleProcessSelectedVideos = async () => {
    try {
      // Filter out any non-pending videos from selection
      const pendingSelectedIds = Array.from(selectedVideos).filter(id => {
        const video = videos.find(v => v.id === id);
        // Check if video is in real-time processing state but not yet reflected in DB
        const isProcessing = videos.find(v => v.id === id)?.processingStatus === 'processing' || 
                           processingVideos[id]?.processingStatus === 'processing';
        // Only include truly pending videos
        return video && video.processingStatus === 'pending' && !isProcessing;
      });
      
      if (pendingSelectedIds.length === 0) {
        alert('Please select at least one video to process. Only videos in pending state can be processed.');
        return;
      }

      logger.debug(`Processing ${pendingSelectedIds.length} selected videos (only pending videos)`);
      
      // Use the filtered array for the API request
      const videoIds = pendingSelectedIds;
      
      // Our filtering above should already have removed any completed videos,
      // but we'll double-check just to be safe
      const completedVideoIds = videoIds.filter(id => {
        const video = videos.find(v => v.id === id);
        return video?.processingStatus === 'completed' || 
               processingVideos[id]?.processingStatus === 'completed';
      });
      
      // If we have any completed videos (which shouldn't happen with our new filtering), deselect them
      if (completedVideoIds.length > 0) {
        logger.debug(`Found ${completedVideoIds.length} already completed videos that slipped through, deselecting them`);
        await deselectCompletedVideos(completedVideoIds);
        
        // Remove completed videos from the list to process
        const remainingIds = videoIds.filter(id => !completedVideoIds.includes(id));
        if (remainingIds.length === 0) {
          alert('No videos left to process after filtering completed videos. Please select different videos.');
          // Clear UI selections to match database state
          setSelectedVideos(new Set());
          return;
        }
        // Update the videoIds list to only include non-completed videos
        videoIds.length = 0;
        videoIds.push(...remainingIds);
      }
      
      // Our filtering above should already have removed any processing videos,
      // but we'll double-check just to be safe
      const alreadyProcessingIds = videoIds.filter(id => {
        const isProcessing = videos.find(v => v.id === id)?.processingStatus === 'processing' || 
                            processingVideos[id]?.processingStatus === 'processing';
        return isProcessing;
      });
      
      if (alreadyProcessingIds.length > 0) {
        logger.debug(`Found ${alreadyProcessingIds.length} videos already processing that slipped through our filters`);
        // Remove already processing videos from the list
        const filteredIds = videoIds.filter(id => !alreadyProcessingIds.includes(id));
        
        if (filteredIds.length === 0) {
          alert('No videos left to process after filtering videos already in processing.');
          return;
        }
        
        // Proceed with the filtered list without asking confirmation since we're already filtering
        logger.debug(`Continuing with ${filteredIds.length} truly pending videos`);
        // Update the videoIds to only include non-processing videos
        videoIds.length = 0;
        videoIds.push(...filteredIds);
      }
      
      if (videoIds.length === 0) {
        alert('No videos to process after filtering completed and processing videos.');
        // Clear UI selections to match actual processable state
        setSelectedVideos(prevSelected => {
          const newSelected = new Set<string>();
          // Keep only videos that are neither completed nor processing
          Array.from(prevSelected).forEach(id => {
            const video = videos.find(v => v.id === id);
            const isCompleted = video?.processingStatus === 'completed' || 
                              processingVideos[id]?.processingStatus === 'completed';
            const isProcessing = video?.processingStatus === 'processing' || 
                               processingVideos[id]?.processingStatus === 'processing';
            if (!isCompleted && !isProcessing) {
              newSelected.add(id);
            }
          });
          return newSelected;
        });
        return;
      }
      
      // Call the API to start processing
      const response = await authenticatedFetch(`/api/channels/${channelId}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ videoIds })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to start processing: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      logger.debug('Processing started successfully', data);
      
      // Register started videos in the context
      if (data.data.videos) {
        data.data.videos.forEach((video: any) => {
          registerProcessingVideo(video.id, {
            videoId: video.id,
            processingStatus: 'processing',
            processingProgress: 0,
            processingStage: 'initialization'
          });
        });
      } else {
        // If videos aren't returned in the response, register all selected videos
        videoIds.forEach(videoId => {
          registerProcessingVideo(videoId, {
            videoId,
            processingStatus: 'processing',
            processingProgress: 0,
            processingStage: 'initialization'
          });
        });
      }
      
      alert(`Processing started for ${data.data.processingCount} videos. This may take some time.`);
      
      // After processing is initiated, refresh the channel details
      await fetchChannelDetails();
      
      // Clear selected videos to prevent reprocessing - both in UI and database
      setSelectedVideos(new Set());
    } catch (error: any) {
      logger.error('Error processing selected videos', error);
      
      let errorMessage = 'Failed to start processing videos. Please try again.';
      
      // Try to extract more specific error message from response
      if (error.message && error.message.includes('response')) {
        try {
          const response = await error.response?.json();
          if (response && response.message) {
            errorMessage = response.message;
          }
        } catch (parseError) {
          // If we can't parse the response, use the original error message
          if (error.message) {
            errorMessage = `Error: ${error.message}`;
          }
        }
      }
      
      alert(errorMessage);
    }
  };

  // Filter and sort videos
  const filteredVideos = videos.filter(video => {
    if (!searchTerm) return true;
    
    // Search in title and description
    return (
      video.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      video.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }).sort((a, b) => {
    // Handle sort field
    let valA: any = a[sortField as keyof VideoResponse];
    let valB: any = b[sortField as keyof VideoResponse];
    
    // Handle null or undefined values
    if (valA === undefined || valA === null) valA = '';
    if (valB === undefined || valB === null) valB = '';
    
    // Compare based on sort direction
    if (sortDirection === 'asc') {
      return valA > valB ? 1 : valA < valB ? -1 : 0;
    } else {
      return valA < valB ? 1 : valA > valB ? -1 : 0;
    }
  });

  // Calculate pagination
  const totalPages = Math.ceil(filteredVideos.length / pageSize);
  const paginatedVideos = filteredVideos.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Get list of selectable videos (non-processing and non-completed) for the current page
  const selectableVideosOnPage = paginatedVideos.filter(video => {
    const isProcessing = video.processingStatus === 'processing' || 
                         processingVideos[video.id]?.processingStatus === 'processing';
    const isCompleted = video.processingStatus === 'completed' || 
                        processingVideos[video.id]?.processingStatus === 'completed';
    return !isProcessing && !isCompleted;
  });

  // Check if all selectable videos on the current page are selected
  const areAllVideosOnPageSelected = selectableVideosOnPage.length > 0 && 
    selectableVideosOnPage.every(video => selectedVideos.has(video.id));

  if (loading) {
    return <div className="loading">Loading channel details...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  if (!channel) {
    return <div className="error">Channel not found</div>;
  }

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
            <Heading level={1} className="text-lg font-medium">Channel Details</Heading>
          </NavbarSection>
          <NavbarSpacer />
          <NavbarSection>
            <Button 
              color="blue" 
              onClick={handleRefreshChannel}
              disabled={isRefreshing}
            >
              <ArrowPathIcon className={`w-5 h-5 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh Channel'}
            </Button>
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
      {/* Channel Header */}
      <div className="mb-6 flex flex-col md:flex-row items-start md:items-center gap-4">
        {channel.config?.thumbnailUrl && (
          <img 
            src={getProxiedThumbnailUrl(channel.config.thumbnailUrl)} 
            alt={channel.name} 
            className="h-20 w-20 rounded-full"
          />
        )}
        <div>
          <Heading level={2} className="mb-1">{channel.name}</Heading>
          <Text color="subtle" className="mb-2">
            {channel.description && channel.description.substring(0, 200)}
            {channel.description && channel.description.length > 200 && '...'}
          </Text>
          <div className="flex flex-wrap gap-2">
            <Badge color="zinc">
              Status: {channel.status}
            </Badge>
            {channel.config?.subscriberCount && (
              <Badge color="blue">
                Subscribers: {formatViewCount(Number(channel.config.subscriberCount))}
              </Badge>
            )}
            <Badge color="green">
              Videos: {videos.length}
            </Badge>
          </div>
        </div>
        <div className="ml-auto flex space-x-2">
          <Link to={`/channels/${channelId}/chat`}>
            <Button color="blue">
              <SparklesIcon className="w-4 h-4 mr-1" />
              Chat with this Channel
            </Button>
          </Link>
          <Button color="zinc">
            <PencilIcon className="w-4 h-4 mr-1" />
            Edit
          </Button>
          <Button color="red">
            <TrashIcon className="w-4 h-4 mr-1" />
            Delete
          </Button>
        </div>
      </div>

      {/* Video Management Controls */}
      <div className="mb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search videos..."
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:border-zinc-700"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Dropdown>
            <DropdownButton as="div">
              <Button color="zinc">
                <FunnelIcon className="w-4 h-4 mr-1" />
                Sort By
                <ChevronDownIcon className="ml-1 h-4 w-4" />
              </Button>
            </DropdownButton>
            <DropdownMenu className="min-w-48" anchor="bottom start">
              <DropdownItem onClick={() => { setSortField('publishedAt'); setSortDirection('desc'); }}>
                <DropdownLabel className={sortField === 'publishedAt' && sortDirection === 'desc' ? 'font-bold' : ''}>
                  Newest First
                </DropdownLabel>
              </DropdownItem>
              <DropdownItem onClick={() => { setSortField('publishedAt'); setSortDirection('asc'); }}>
                <DropdownLabel className={sortField === 'publishedAt' && sortDirection === 'asc' ? 'font-bold' : ''}>
                  Oldest First
                </DropdownLabel>
              </DropdownItem>
              <DropdownItem onClick={() => { setSortField('title'); setSortDirection('asc'); }}>
                <DropdownLabel className={sortField === 'title' && sortDirection === 'asc' ? 'font-bold' : ''}>
                  Title (A-Z)
                </DropdownLabel>
              </DropdownItem>
              <DropdownItem onClick={() => { setSortField('title'); setSortDirection('desc'); }}>
                <DropdownLabel className={sortField === 'title' && sortDirection === 'desc' ? 'font-bold' : ''}>
                  Title (Z-A)
                </DropdownLabel>
              </DropdownItem>
              <DropdownItem onClick={() => { setSortField('viewCount'); setSortDirection('desc'); }}>
                <DropdownLabel className={sortField === 'viewCount' && sortDirection === 'desc' ? 'font-bold' : ''}>
                  Most Views
                </DropdownLabel>
              </DropdownItem>
              <DropdownItem onClick={() => { setSortField('durationSeconds'); setSortDirection('desc'); }}>
                <DropdownLabel className={sortField === 'durationSeconds' && sortDirection === 'desc' ? 'font-bold' : ''}>
                  Longest
                </DropdownLabel>
              </DropdownItem>
              <DropdownItem onClick={() => { setSortField('durationSeconds'); setSortDirection('asc'); }}>
                <DropdownLabel className={sortField === 'durationSeconds' && sortDirection === 'asc' ? 'font-bold' : ''}>
                  Shortest
                </DropdownLabel>
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <Text color="subtle">
            {/* Filter out any non-pending videos from the count, even if they're in the selectedVideos set */}
            {(() => {
              const filteredCount = Array.from(selectedVideos).filter(id => {
                const video = videos.find(v => v.id === id);
                // Only count videos that are in 'pending' state (not processing, completed, or failed)
                const isProcessing = video?.processingStatus === 'processing' || 
                                    processingVideos[id]?.processingStatus === 'processing';
                return video && video.processingStatus === 'pending' && !isProcessing;
              }).length;
              return `${filteredCount} video${filteredCount !== 1 ? 's' : ''} selected`;
            })()}
          </Text>
          <Button 
            color="blue" 
            disabled={
              (() => {
                // Filter to only include pending videos
                const pendingSelectedIds = Array.from(selectedVideos).filter(id => {
                  const video = videos.find(v => v.id === id);
                  // Check if video is in real-time processing state but not yet reflected in DB
                  const isProcessing = videos.find(v => v.id === id)?.processingStatus === 'processing' || 
                                     processingVideos[id]?.processingStatus === 'processing';
                  // Only include truly pending videos
                  return video && video.processingStatus === 'pending' && !isProcessing;
                });
                
                // No selectable videos
                return pendingSelectedIds.length === 0;
              })()
            }
            onClick={handleProcessSelectedVideos}
          >
            Process Selected Videos
          </Button>
        </div>
      </div>

      {/* Video List */}
      {videos.length > 0 ? (
        <div className="bg-white rounded-lg shadow dark:bg-zinc-900">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader className="w-12">
                  <Checkbox
                    checked={areAllVideosOnPageSelected}
                    onChange={(checked) => {
                      // Create a synthetic event to match the expected signature
                      handleSelectAllOnPage({ target: { checked } } as React.ChangeEvent<HTMLInputElement>);
                    }}
                    disabled={selectableVideosOnPage.length === 0}
                  />
                </TableHeader>
                <TableHeader>Video</TableHeader>
                <TableHeader>Duration</TableHeader>
                <TableHeader>Published</TableHeader>
                <TableHeader>Views</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedVideos.map((video) => {
                // Check realtime status from both DB and context
                const realTimeStatus = processingVideos[video.id]?.processingStatus || video.processingStatus;
                
                // Check if video is processing
                const isProcessing = video.processingStatus === 'processing' || 
                                     processingVideos[video.id]?.processingStatus === 'processing';
                
                // Check if video is completed (from database or real-time context)
                const isCompleted = video.processingStatus === 'completed' || 
                                    processingVideos[video.id]?.processingStatus === 'completed';
                
                return (
                  <TableRow 
                    key={video.id}
                    className={isProcessing ? 'bg-blue-50 dark:bg-blue-900/20' : 
                               isCompleted ? 'bg-green-50 dark:bg-green-900/20' : ''}
                  >
                    <TableCell>
                      {isCompleted ? (
                        <div className="w-4 h-4 flex items-center justify-center text-green-500">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                          </svg>
                        </div>
                      ) : (
                        <Checkbox
                          checked={selectedVideos.has(video.id)}
                          onChange={() => handleVideoSelection(video.id)}
                          disabled={isProcessing || isCompleted}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        {video.thumbnailUrl && (
                          <img 
                            src={getProxiedThumbnailUrl(video.thumbnailUrl)} 
                            alt={video.title} 
                            className="h-16 w-28 object-cover rounded"
                          />
                        )}
                        <div>
                          <Text className="font-medium">{video.title}</Text>
                          <Text color="subtle" className="text-sm line-clamp-2">
                            {video.description?.substring(0, 100)}
                            {video.description && video.description.length > 100 && '...'}
                          </Text>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Text>{formatDuration(video.duration || '')}</Text>
                    </TableCell>
                    <TableCell>
                      <Text color="subtle">
                        {video.publishedAt ? new Date(video.publishedAt).toLocaleDateString() : 'Unknown'}
                      </Text>
                    </TableCell>
                    <TableCell>
                      <Text>{formatViewCount(video.viewCount || 0)}</Text>
                    </TableCell>
                    <TableCell>
                      <VideoProcessingStatus 
                        videoId={video.id}
                        initialStatus={video.processingStatus}
                        initialProgress={video.processingProgress}
                        initialStage={video.processingStage}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        {isCompleted ? (
                          <Button 
                            color="red"
                            onClick={() => handleResetVideoProcessing(video.id)}
                          >
                            Remove
                          </Button>
                        ) : realTimeStatus === 'failed' ? (
                          <Button 
                            color="blue"
                            onClick={() => handleResetVideoProcessing(video.id)}
                          >
                            Reprocess
                          </Button>
                        ) : (
                          <Button 
                            color="blue"
                            disabled={isProcessing}
                            onClick={() => {
                              // Process this single video
                              if (!selectedVideos.has(video.id)) {
                                setSelectedVideos(prev => {
                                  const newSelected = new Set(prev);
                                  newSelected.add(video.id);
                                  return newSelected;
                                });
                              }
                              handleProcessSelectedVideos();
                            }}
                          >
                            Process
                          </Button>
                        )}
                        <Button 
                          color="zinc"
                          onClick={() => {
                            // Video details
                            alert(`View video ${video.id} details to be implemented`);
                          }}
                        >
                          Details
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-8 text-center dark:bg-zinc-900 dark:border-zinc-700">
          <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
          <Heading level={3} className="mt-2 font-medium">No videos found</Heading>
          <Text color="subtle" className="mt-1">
            {searchTerm 
              ? 'No videos match your search criteria. Try a different search term.'
              : 'This channel does not have any videos yet.'}
          </Text>
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center">
            <Text color="subtle">
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredVideos.length)} of {filteredVideos.length} videos
            </Text>
            <div className="ml-4">
              <Dropdown>
                <DropdownButton as="div">
                  <Button color="zinc">
                    {pageSize} per page
                    <ChevronDownIcon className="ml-1 h-4 w-4" />
                  </Button>
                </DropdownButton>
                <DropdownMenu className="min-w-32" anchor="bottom start">
                  {[10, 25, 50, 100].map((size) => (
                    <DropdownItem 
                      key={size}
                      onClick={() => {
                        setPageSize(size);
                        setCurrentPage(1);
                      }}
                    >
                      <DropdownLabel className={pageSize === size ? 'font-bold' : ''}>
                        {size} per page
                      </DropdownLabel>
                    </DropdownItem>
                  ))}
                </DropdownMenu>
              </Dropdown>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              color="zinc"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
            >
              <ChevronLeftIcon className="h-4 w-4" />
              Previous
            </Button>
            <div className="flex items-center">
              <input
                type="number"
                min={1}
                max={totalPages}
                value={currentPage}
                onChange={(e) => {
                  const page = parseInt(e.target.value);
                  if (!isNaN(page) && page >= 1 && page <= totalPages) {
                    setCurrentPage(page);
                  }
                }}
                className="w-12 text-center border border-gray-300 rounded-md p-1 dark:bg-zinc-800 dark:border-zinc-700"
              />
              <Text color="subtle" className="mx-2">
                of {totalPages}
              </Text>
            </div>
            <Button
              color="zinc"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
            >
              Next
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </SidebarLayout>
  );
};

export default ChannelDetailPage;