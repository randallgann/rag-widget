# Video Processing UI Robustness Improvements

## Problem Statement

The current video processing UI has the following issues:

1. **Stale Processing States**: Videos remain in "Processing" state after app restarts or when processing was interrupted
2. **Stuck UI State**: Unable to modify selections for videos that appear to be processing
3. **Missing State Verification**: Application doesn't verify if videos are actually still processing on startup
4. **No Recovery Mechanism**: No way to reset videos stuck in processing state
5. **Poor State Management**: UI state is maintained only in memory and gets lost on app refresh

## Design Goals

1. Make video processing UI robust after application restarts
2. Provide ability to reset stuck processing status
3. Prevent videos from getting "stuck" in processing state
4. Improve user experience when managing video processing
5. Ensure processing state remains accurate across sessions

## Technical Design

### 1. Verify Processing States on Load

When the channel detail page loads, we need to verify that videos marked as "processing" are actually still processing on the server:

```typescript
// In ChannelDetailPage component
useEffect(() => {
  const checkAndResetStaleProcessingVideos = async () => {
    // Identify videos that appear to be processing in the UI
    const processingVideoIds = videos
      .filter(video => video.processingStatus === 'processing')
      .map(video => video.id);
    
    if (processingVideoIds.length > 0) {
      // Check their actual status from the server
      await checkProcessingStatus(processingVideoIds);
    }
  };
  
  // Check for stale processing when the component mounts
  if (videos.length > 0 && !loading) {
    checkAndResetStaleProcessingVideos();
  }
}, [videos, loading]);
```

### 2. Enhance Video Processing Context

Add support for clearing stale processing states and better handling of reconnection:

```typescript
// Add to VideoProcessingContext interface
interface VideoProcessingContextType {
  // Existing methods...
  clearStaleProcessingVideos: (videoIds?: string[]) => void;
}

// Implementation in VideoProcessingProvider
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
```

### 3. Add Persistent Storage for Processing States

Use localStorage to maintain processing state across page refreshes:

```typescript
// In VideoProcessingProvider
const VIDEO_PROCESSING_STORAGE_KEY = 'rag-widget-processing-videos';

// Initialize from localStorage
useEffect(() => {
  try {
    const storedData = localStorage.getItem(VIDEO_PROCESSING_STORAGE_KEY);
    if (storedData) {
      const parsedData = JSON.parse(storedData);
      // Validate and restore date objects
      // Set to state if valid
    }
  } catch (error) {
    console.error('Error loading processing videos from localStorage:', error);
    localStorage.removeItem(VIDEO_PROCESSING_STORAGE_KEY);
  }
}, []);

// Save to localStorage when state changes
useEffect(() => {
  try {
    if (Object.keys(processingVideos).length > 0) {
      localStorage.setItem(VIDEO_PROCESSING_STORAGE_KEY, JSON.stringify(processingVideos));
    } else {
      localStorage.removeItem(VIDEO_PROCESSING_STORAGE_KEY);
    }
  } catch (error) {
    console.error('Error saving processing videos to localStorage:', error);
  }
}, [processingVideos]);
```

### 4. Prevent Selection of Processing Videos

Enhance video selection handling to prevent modifying processing videos:

```typescript
// In ChannelDetailPage
const handleVideoSelection = async (videoId: string) => {
  // Check if video is currently processing - if so, don't allow selection changes
  const isProcessing = videos.find(v => v.id === videoId)?.processingStatus === 'processing';
  if (isProcessing) {
    return;
  }
  
  // Rest of the existing selection logic...
};

// Update UI to disable checkboxes for processing videos
<Checkbox
  checked={selectedVideos.has(video.id)}
  onChange={() => handleVideoSelection(video.id)}
  disabled={isProcessing}
/>
```

### 5. Improve "Select All" Functionality

Modify batch selection to only work with non-processing videos:

```typescript
const handleSelectAllOnPage = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const isSelected = event.target.checked;
  const videosOnPage = filteredVideos
    .slice((currentPage - 1) * pageSize, currentPage * pageSize)
    // Exclude videos that are already processing
    .filter(video => video.processingStatus !== 'processing');
  
  if (videosOnPage.length === 0) {
    return; // No selectable videos on this page
  }
  
  // Rest of the batch selection logic...
};

// Update UI to disable "select all" checkbox when no selectable videos exist
const selectableVideosOnPage = paginatedVideos.filter(video => video.processingStatus !== 'processing');
const areAllVideosOnPageSelected = selectableVideosOnPage.length > 0 && 
  selectableVideosOnPage.every(video => selectedVideos.has(video.id));

<Checkbox
  checked={areAllVideosOnPageSelected}
  onChange={(checked) => {
    handleSelectAllOnPage({ target: { checked } } as React.ChangeEvent<HTMLInputElement>);
  }}
  disabled={selectableVideosOnPage.length === 0}
/>
```

### 6. Add "Reset Processing" Functionality

Implement the ability to reset processing status for videos:

```typescript
// Add new API endpoint in videoRoutes.ts
router.put('/:id/reset-processing', validateAuth0Token, requireAuth, resetVideoProcessing);

// Add controller method in videoController.ts
export const resetVideoProcessing = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    // Get user and verify permissions
    // ...
    
    // Find the video
    const video = await Video.findByPk(id);
    if (!video) {
      throw new AppError('Video not found', 404);
    }
    
    // Update to reset processing state
    await video.update({
      processingStatus: 'pending',
      processingProgress: 0,
      processingError: null,
      processingStage: null,
      processingLastUpdated: null
    });
    
    return res.status(200).json({
      status: 'success',
      message: 'Video processing status has been reset'
    });
  } catch (error) {
    next(error);
  }
};

// In ChannelDetailPage component
const handleResetVideoProcessing = async (videoId: string) => {
  try {
    const video = videos.find(v => v.id === videoId);
    if (!video) return;
    
    // Only allow resetting videos that are in a failed or completed state
    if (video.processingStatus !== 'failed' && video.processingStatus !== 'completed') {
      return;
    }
    
    const response = await authenticatedFetch(`/api/videos/${videoId}/reset-processing`, {
      method: 'PUT'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to reset processing status: ${response.status} ${response.statusText}`);
    }
    
    // Refresh videos to update UI
    await fetchChannelDetails();
    
  } catch (error) {
    logger.error('Error resetting video processing status:', error);
    alert('Failed to reset video processing status. Please try again.');
  }
};
```

### 7. Improve Process Button Logic

Enhance the "Process Selected Videos" button to handle stale processing states:

```typescript
const handleProcessSelectedVideos = async () => {
  try {
    if (selectedVideos.size === 0) {
      alert('Please select at least one video to process');
      return;
    }

    // Convert Set to Array for the API request
    const videoIds = Array.from(selectedVideos);
    
    // Check if any of the selected videos are already processing
    const alreadyProcessingIds = videoIds.filter(id => 
      videos.find(v => v.id === id)?.processingStatus === 'processing'
    );
    
    if (alreadyProcessingIds.length > 0) {
      // Remove already processing videos from the list
      const filteredIds = videoIds.filter(id => !alreadyProcessingIds.includes(id));
      
      if (filteredIds.length === 0) {
        alert('All selected videos are already processing.');
        return;
      }
      
      const continueProcessing = window.confirm(
        `${alreadyProcessingIds.length} out of ${videoIds.length} selected videos are already processing. Continue with processing the remaining ${filteredIds.length} videos?`
      );
      
      if (!continueProcessing) return;
      
      // Proceed with the filtered list
    }
    
    // Rest of the processing logic
  } catch (error) {
    // Error handling
  }
};

// Update process button in UI
<Button 
  color="blue" 
  disabled={
    selectedVideos.size === 0 || 
    // Disable if ALL selected videos are already processing
    Array.from(selectedVideos).every(id => 
      videos.find(v => v.id === id)?.processingStatus === 'processing'
    )
  }
  onClick={handleProcessSelectedVideos}
>
  Process Selected Videos
</Button>
```

### 8. Add Visual Refresh Indicator

Improve UI feedback during refresh operations:

```typescript
// Add isRefreshing state
const [isRefreshing, setIsRefreshing] = useState(false);

// Enhanced refresh function
const handleRefreshChannel = async () => {
  try {
    setIsRefreshing(true);
    await fetchChannelDetails();
    // Reset any stale processing states
    clearStaleProcessingVideos();
    setIsRefreshing(false);
  } catch (error) {
    setIsRefreshing(false);
  }
};

// Updated refresh button in UI
<Button 
  color="blue" 
  onClick={handleRefreshChannel}
  disabled={isRefreshing}
>
  <ArrowPathIcon className={`w-5 h-5 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
  {isRefreshing ? 'Refreshing...' : 'Refresh Channel'}
</Button>
```

### 9. Update Processing Status Sync

When loading video data from the server, ensure processing status is properly synchronized:

```typescript
// In fetchChannelDetails function
const fetchChannelDetails = async () => {
  try {
    // Existing code to fetch channel data...
    
    if (data.status === 'success' && data.data.channel) {
      setChannel(data.data.channel);
      
      // Extract videos from the channel data
      if (data.data.channel.videos) {
        setVideos(data.data.channel.videos);
        
        // Check for stale processing states
        const processingVideos = data.data.channel.videos.filter(
          (v: VideoResponse) => v.processingStatus === 'processing'
        );
        
        if (processingVideos.length > 0) {
          await checkProcessingStatus(processingVideos.map((v: VideoResponse) => v.id));
        } else {
          // If no videos are processing, clear any stale processing states in the context
          clearStaleProcessingVideos();
        }
      }
    }
    
    // Rest of the function...
  } catch (error) {
    // Error handling...
  }
};
```

## Implementation Plan

1. First: Add `clearStaleProcessingVideos` to `VideoProcessingContext`
2. Second: Add support for loading/saving processing state to localStorage
3. Third: Implement the reset processing API endpoint
4. Fourth: Update video selection handling to prevent modifying processing videos
5. Fifth: Implement status verification on channel detail page load
6. Sixth: Update UI to provide enhanced feedback during operations
7. Last: Add comprehensive error handling for all processing scenarios

## Expected Results

After implementing these improvements:

1. Users will be able to reliably manage video processing even after restarting the app
2. The UI will clearly indicate which videos are actually processing
3. Users can reset and recover from stuck processing states
4. Videos marked as "processing" will be verified against the server state
5. Selections will be preserved where appropriate and cleared when processing
6. Stale processing states will be automatically cleaned up