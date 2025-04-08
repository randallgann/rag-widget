# WebSocket Connection Leak Issue

## Problem Statement

The RAG Widget application is experiencing a WebSocket connection leak. When users interact with the channel detail page, multiple WebSocket connections are being established and not properly cleaned up. Logs show messages like:

```
New WebSocket connection established. Total connections: 1
New WebSocket connection established. Total connections: 2
New WebSocket connection established. Total connections: 3
New WebSocket connection established. Total connections: 4
```

This results in several issues:

1. **Memory leaks**: Each connection consumes resources that are not being properly released
2. **UI synchronization issues**: Status updates (particularly completion statuses) sometimes don't appear in the UI until page refresh
3. **Unnecessary server load**: Multiple active connections receive the same messages, wasting bandwidth
4. **Potential instability**: As connections accumulate, the application may become unstable

## Root Cause Analysis

After reviewing the code, we've identified several potential causes for the WebSocket connection leak:

### 1. Multiple Provider Instances

- The `VideoProcessingProvider` is wrapped around each `ChannelDetailPage` component
- If the channel detail page remounts multiple times, or if it's included in multiple routes, this could create multiple WebSocket connections

```tsx
const ChannelDetailPageWithProvider: React.FC<ChannelDetailPageProps> = (props) => {
  return (
    <VideoProcessingProvider>
      <ChannelDetailPage {...props} />
    </VideoProcessingProvider>
  );
};
```

### 2. Incomplete Cleanup in useEffect

The WebSocket cleanup logic in `VideoProcessingContext.tsx` has potential issues:

```tsx
// Clean up on unmount
return () => {
  if (socket && (socket as WebSocket).readyState === WebSocket.OPEN) {
    (socket as WebSocket).close();
  }
};
```

Issues with this code:
- The cleanup function is indented incorrectly (may be a code linting issue)
- It only closes the socket if it's in OPEN state, but not if it's in CONNECTING state
- There's a type assertion that may be masking issues

### 3. Reconnection Logic Issues

The reconnection logic includes complex state management:

```tsx
if (!isReconnecting) {
  setIsReconnecting(true);
  setTimeout(() => {
    console.log('Attempting to reconnect WebSocket...');
    setIsReconnecting(false);
  }, 5000);
}
```

This could lead to race conditions where new connections are established before old ones complete their lifecycle.

### 4. Authentication/Loading Races

The logs show 401 authentication errors occurring at the same time as WebSocket connections:

```
warn: GET /api/channels/17430419-6d3c-4ad2-82f8-31b12f1e8f74 - No authHeader or no bearer found
info: New WebSocket connection established. Total connections: 1
warn: GET /api/channels/17430419-6d3c-4ad2-82f8-31b12f1e8f74 - No authHeader or no bearer found
info: New WebSocket connection established. Total connections: 2
```

This suggests component remounting during auth state changes, potentially creating new providers/connections.

## Completion Status Not Updating UI Issue

Additionally, there's an issue with "completed" status updates not being reflected in the UI. In `updateProcessingStatus`, items are completely removed from state when completed:

```tsx
// If the status is completed or failed, we remove it from active processing
if (status.processingStatus === 'completed' || status.processingStatus === 'failed') {
  const newState = { ...prev };
  delete newState[videoId];
  return newState;
}
```

This removes them from `processingVideos` without updating the UI with the final status.

## Proposed Solutions

### 1. Move Provider Higher in Component Tree

Place the `VideoProcessingProvider` at the application level (in App.tsx) rather than at the channel detail page level to ensure only one provider instance exists:

```tsx
// In App.tsx
return (
  <AuthProvider>
    <VideoProcessingProvider>
      <Router>
        {/* Routes */}
      </Router>
    </VideoProcessingProvider>
  </AuthProvider>
);
```

### 2. Improve WebSocket Cleanup

Enhance the cleanup logic to handle all WebSocket states and ensure proper cleanup:

```tsx
return () => {
  if (socket) {
    console.log(`Cleaning up WebSocket connection (state: ${socket.readyState})`);
    // Close regardless of state
    socket.close();
    setSocket(null);
  }
};
```

### 3. Add Connection IDs and Logging

Add unique IDs to each WebSocket connection for better tracking:

```tsx
// On the server
wss.on('connection', (ws: WebSocket) => {
  const connectionId = generateUniqueId();
  (ws as any).connectionId = connectionId;
  
  logger.info(`WebSocket connection ${connectionId} established. Total: ${connections.length}`);
  // Rest of the code...
});
```

### 4. Modify Completed/Failed State Handling

Change how completed/failed statuses are handled to ensure the UI updates:

```tsx
// If the status is completed or failed, keep it briefly before removing
if (status.processingStatus === 'completed' || status.processingStatus === 'failed') {
  // Update the state to show completion/failure
  const updatedState = {
    ...prev,
    [videoId]: {
      ...prev[videoId],
      ...status,
      processingLastUpdated: status.processingLastUpdated || new Date()
    }
  };
  
  // Schedule removal after a brief delay to allow UI to update
  setTimeout(() => {
    setProcessingVideos(current => {
      const nextState = { ...current };
      delete nextState[videoId];
      return nextState;
    });
  }, 5000);
  
  return updatedState;
}
```

### 5. Add Debugging Tools

Add more verbose logging and debugging capabilities to track WebSocket lifecycle:

```tsx
// In VideoProcessingContext.tsx
newSocket.addEventListener('open', (event) => {
  console.log(`WebSocket connected (ID: ${socketId})`);
  // Rest of code...
});

// Track all socket state changes
if (process.env.NODE_ENV !== 'production') {
  ['open', 'close', 'error', 'message'].forEach(evt => {
    newSocket.addEventListener(evt, () => {
      console.log(`WebSocket ${socketId} state: ${getReadyStateString(newSocket.readyState)}`);
    });
  });
}
```

## Implementation Plan

1. Add more detailed logging to precisely identify when and why multiple connections are being created
2. Fix the VideoProcessingProvider placement in the component hierarchy
3. Enhance WebSocket cleanup logic to ensure proper connection termination
4. Modify the completed/failed state handling to ensure UI updates
5. Add uniquely identifiable connection tracking
6. Implement comprehensive testing to verify the fixes

This approach addresses both the WebSocket connection leak and the UI update issues while maintaining the real-time nature of the status updates.

## Manual Testing in Browser Console

You can now test the WebSocket connection and status updates directly from the browser console. The following commands are available:

```javascript
// Get information about the WebSocket connections
window.__VIDEO_PROCESSING_DEBUG__

// Get current processing videos
window.__VIDEO_PROCESSING_CONTEXT__.getStatus()

// Simulate a status update for a video
// Replace "your-video-id" with an actual video ID
window.__VIDEO_PROCESSING_DEBUG__.simulateMessage("your-video-id", "completed")  // Status can be "processing", "completed", or "failed"

// Test connection leak fix by counting active connections
// Note: This should always be 1 after our fix
window.__VIDEO_PROCESSING_DEBUG__.connections.active
```

To validate that our fix works:

1. Navigate to the channel detail page
2. Open the browser console (F12 or Ctrl+Shift+J)
3. Navigate to different pages and back to the channel detail page
4. Check the connection count - it should remain at 1
5. The debug panel should show the socket state and stats
6. Test status updates using the simulateMessage function