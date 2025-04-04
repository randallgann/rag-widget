import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { UserProfileResponse, ChannelResponse, VideoResponse } from '@/types/api';
import { SidebarLayout } from '@/components/sidebar-layout';
import { 
  Sidebar, 
  SidebarHeader, 
  SidebarBody, 
  SidebarFooter, 
  SidebarItem, 
  SidebarLabel,
  SidebarSection,
  SidebarSpacer
} from '@/components/sidebar';
import { Navbar, NavbarItem, NavbarSection, NavbarSpacer } from '@/components/navbar';
import { Dropdown, DropdownButton, DropdownMenu, DropdownItem, DropdownLabel, DropdownDivider } from '@/components/dropdown';
import { Avatar } from '@/components/avatar';
import { Heading } from '@/components/heading';
import { Text } from '@/components/text';
import { Button } from '@/components/button';
import { Badge } from '@/components/badge';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/table';
import { Checkbox } from '@/components/checkbox';
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
  
  // Initialize selected videos from the server data when videos are loaded
  useEffect(() => {
    if (videos.length > 0) {
      const initiallySelected = new Set<string>();
      videos.forEach(video => {
        if (video.selectedForProcessing) {
          initiallySelected.add(video.id);
        }
      });
      setSelectedVideos(initiallySelected);
      logger.debug(`Initialized ${initiallySelected.size} selected videos from server data`);
    }
  }, [videos]);

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
    const videosOnPage = filteredVideos.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    
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
      logger.debug(`Refreshing channel ${channelId}`);
      
      // Placeholder for actual implementation
      alert('Channel refresh functionality to be implemented');
      
      // After refreshing, fetch channel details again to get updated data
      await fetchChannelDetails();
    } catch (error) {
      logger.error(`Error refreshing channel ${channelId}`, error);
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
                  processingError: statusVideo.processingError
                };
              }
            }
          });
          
          return updatedVideos;
        });
      }
    } catch (error: any) {
      logger.error('Error checking processing status:', error);
    }
  };

  // Set up polling for processing status
  useEffect(() => {
    // Get IDs of videos that are currently processing
    const processingVideoIds = videos
      .filter(video => video.processingStatus === 'processing')
      .map(video => video.id);
    
    if (processingVideoIds.length === 0) return;
    
    // Set up polling interval to check status every 10 seconds
    const statusInterval = setInterval(() => {
      checkProcessingStatus(processingVideoIds);
    }, 10000);
    
    // Clean up interval on unmount
    return () => clearInterval(statusInterval);
  }, [videos]);

  // Function to process selected videos
  const handleProcessSelectedVideos = async () => {
    try {
      if (selectedVideos.size === 0) {
        alert('Please select at least one video to process');
        return;
      }

      logger.debug(`Processing ${selectedVideos.size} selected videos`);
      
      // Convert Set to Array for the API request
      const videoIds = Array.from(selectedVideos);
      
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
      
      alert(`Processing started for ${data.data.processingCount} videos. This may take some time.`);
      
      // After processing is initiated, refresh the channel details
      await fetchChannelDetails();
      
      // Immediately check status of the videos that were just queued
      await checkProcessingStatus(videoIds);
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

  // Check if all videos on the current page are selected
  const areAllVideosOnPageSelected = paginatedVideos.length > 0 && 
    paginatedVideos.every(video => selectedVideos.has(video.id));

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
            <Button color="blue" onClick={handleRefreshChannel}>
              <ArrowPathIcon className="w-5 h-5 mr-2" />
              Refresh Channel
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
            {selectedVideos.size} video{selectedVideos.size !== 1 ? 's' : ''} selected
          </Text>
          <Button 
            color="blue" 
            disabled={
              selectedVideos.size === 0 || 
              // Disable if any selected video is already processing
              Array.from(selectedVideos).some(id => 
                videos.find(v => v.id === id)?.processingStatus === 'processing'
              )
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
              {paginatedVideos.map((video) => (
                <TableRow key={video.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedVideos.has(video.id)}
                      onChange={() => handleVideoSelection(video.id)}
                    />
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
                    <div className="flex flex-col">
                      <Badge 
                        color={
                          video.processingStatus === 'completed' ? 'green' : 
                          video.processingStatus === 'processing' ? 'blue' : 
                          video.processingStatus === 'failed' ? 'red' : 'yellow'
                        }
                      >
                        {video.processingStatus}
                      </Badge>
                      
                      {video.processingStatus === 'processing' && (
                        <div className="mt-1">
                          <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${video.processingProgress || 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {video.processingProgress || 0}%
                          </span>
                        </div>
                      )}
                      
                      {video.processingStatus === 'failed' && video.processingError && (
                        <div className="mt-1">
                          <span className="text-xs text-red-500 truncate block max-w-xs" title={video.processingError}>
                            {video.processingError}
                          </span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button 
                        color="blue"
                        disabled={video.processingStatus === 'processing'}
                        onClick={() => {
                          // Individual video processing
                          alert(`Process video ${video.id} functionality to be implemented`);
                        }}
                      >
                        {video.processingStatus === 'completed' ? 'Reprocess' : 'Process'}
                      </Button>
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
              ))}
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