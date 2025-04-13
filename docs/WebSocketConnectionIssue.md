# WebSocket Connection Issue Analysis

## Problem Description
The channel details page has an issue where video processing status updates are not properly displayed:
1. Initial update to 5% shows in the UI
2. Subsequent updates don't appear, though API logs show status updates being sent
3. Upon page refresh, a new status (e.g., 20%) appears but doesn't continue updating
4. Components flash/re-render when messages are received (observable in DevTools) but UI doesn't update
5. No console logs are visible despite multiple logging statements in the code

## Root Cause Investigation

### Component Tree Analysis
Looking at the application structure reveals potential issues with the VideoProcessingContext:

1. **Multiple Context Provider Imports**:
   - App.tsx: `import { VideoProcessingProvider } from '../contexts/VideoProcessingContext';`
   - detail.tsx: `import { VideoProcessingProvider, useVideoProcessing } from '../../contexts/VideoProcessingContext';`

2. **Provider Hierarchy**:
   - VideoProcessingProvider was moved to App.tsx (line 619) to prevent multiple WebSocket connections (mentioned in comment on line 151 of detail.tsx)
   - However, detail.tsx still imports VideoProcessingProvider and useVideoProcessing

3. **Console Logs**:
   - Many console.log statements exist in VideoProcessingContext
   - Logs appear for Dashboard but not Channel Details page

### WebSocket Message Flow

1. **Server Side** (working correctly):
   - videoProcStatusSubscriber.ts receives updates via PubSub
   - Updates get emitted as events with fields like videoId, processingStatus, processingProgress
   - statusController.ts listens for these events and broadcasts to WebSocket clients
   - Server logs confirm messages are being sent with updated progress percentages

2. **Client Side** (problematic):
   - VideoProcessingContext.tsx establishes WebSocket connection
   - Messages are received, normalized, and should update React state
   - Components like VideoProcessingStatus.tsx read from this state to render UI
   - The fact that components flash in DevTools suggests messages are being received

### State Management

1. **State Updates**:
   - VideoProcessingContext maintains a `processingVideos` state object
   - Updates happen in `updateProcessingStatus` function
   - State is persisted to localStorage

2. **Field Normalization**:
   - Attempts to normalize message fields with different names (processingStatus vs status)
   - This normalization may not be correctly handling all cases

## Action Items Checklist

1. **Fix Context Hierarchy**:
   - [ ] Remove VideoProcessingProvider import from detail.tsx if not used
   - [ ] Ensure only one VideoProcessingProvider exists in the entire app (in App.tsx)
   - [ ] Verify that channels/detail.tsx only imports and uses useVideoProcessing

2. **Add Debug Logging**:
   - [ ] Add explicit console.log in the VideoProcessingStatus component:
     ```jsx
     // In VideoProcessingStatus.tsx
     useEffect(() => {
       console.log(`[DEBUG][${videoId}] Status: ${processingStatus}, Progress: ${processingProgress}`);
     }, [videoId, processingStatus, processingProgress]);
     ```

3. **Fix Field Normalization**:
   - [ ] Enhance the normalization in VideoProcessingContext.tsx:
     ```jsx
     // Ensure correct mapping between different message formats
     const normalizedUpdate = {
       videoId: statusUpdate.videoId,
       processingStatus: statusUpdate.processingStatus || statusUpdate.status,
       processingProgress: typeof statusUpdate.processingProgress === 'number' 
         ? statusUpdate.processingProgress 
         : (typeof statusUpdate.progress === 'number' ? statusUpdate.progress : 0),
       // ... other fields
     };
     ```

4. **Check localStorage Persistence**:
   - [ ] Clear localStorage and test to see if stale state might be persisting:
     ```js
     localStorage.removeItem('rag-widget-processing-videos');
     ```

5. **Inspect WebSocket Connection**:
   - [ ] Use browser DevTools Network tab to verify WebSocket connection is active
   - [ ] Check if messages are actually arriving by adding a WebSocket message handler:
     ```jsx
     // In App.tsx, add temporary debug code
     useEffect(() => {
       const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
       const wsUrl = `${wsProtocol}//${window.location.host}/api/status-updates`;
       const debugWs = new WebSocket(wsUrl);
       
       debugWs.onmessage = (event) => {
         console.log('[DEBUG WS MESSAGE]', event.data);
       };
       
       return () => debugWs.close();
     }, []);
     ```

6. **Check React Re-Rendering**:
   - [ ] Add a key prop to the VideoProcessingStatus component to force re-render:
     ```jsx
     <VideoProcessingStatus 
       key={`${videoId}-${Date.now()}`} // Force re-render on each render cycle
       videoId={video.id}
       initialStatus={video.processingStatus}
       initialProgress={video.processingProgress}
       initialStage={video.processingStage}
     />
     ```

7. **Verify Module Bundling**:
   - [ ] Check if there might be multiple instances of the context due to bundling issues
   - [ ] Verify that React is properly shared between components

8. **Test Simple Solution First**:
   - [ ] Try a simplified approach by bypassing the context and directly updating the component:
     ```jsx
     // In the video component, add direct WebSocket connection
     useEffect(() => {
       const ws = new WebSocket('ws://localhost:3001/api/status-updates');
       ws.onmessage = (event) => {
         const data = JSON.parse(event.data);
         if (data.videoId === videoId) {
           console.log('Direct update:', data);
           // Update local state
         }
       };
       return () => ws.close();
     }, [videoId]);
     ```

## Technical Analysis

### VideoProcessingContext WebSocket Setup
The context establishes a WebSocket connection and handles messages:

```typescript
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
    // ...message handling logic
  };
  
  connectWebSocket();
}, [socket, isReconnecting]);
```

### Server-Side WebSocket Broadcasting
The server broadcasts updates to all connected clients:

```typescript
// Set up event listener for status updates from videoProcStatusSubscriber
videoProcStatusSubscriber.on('statusUpdate', (statusUpdate) => {
  // Broadcast status update to all connected WebSocket clients
  const payload = JSON.stringify({
    ...statusUpdate,
    serverTimestamp: new Date().toISOString()
  });
  
  // Check for completed or failed statuses to log them more prominently
  if (statusUpdate.processingStatus === 'completed' || statusUpdate.processingStatus === 'failed') {
    logger.info(`Broadcasting ${statusUpdate.processingStatus.toUpperCase()} status for video ${statusUpdate.videoId} to ${connections.length} clients:`, statusUpdate);
  } else {
    logger.debug(`Broadcasting status update for video ${statusUpdate.videoId} to ${connections.length} clients:`, statusUpdate);
  }
  
  let sentCount = 0;
  connections.forEach(client => {
    const connectionId = (client as any).connectionId || 'unknown';
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
      sentCount++;
    } else {
      // Log connections that are not in OPEN state
      logger.debug(`Skipping send to connection ${connectionId} - state: ${getWebSocketStateString(client.readyState)}`);
    }
  });
});
```

### Status Update Normalization
The context attempts to normalize different message formats:

```typescript
// Format might vary between server implementations
// Make sure we have all required fields in the expected format
const normalizedUpdate = {
  videoId: statusUpdate.videoId,
  processingStatus: statusUpdate.processingStatus,
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
```

## Conclusion

The most likely cause is that the VideoProcessingContext is not properly shared between App.tsx and the channel details component. When the fix to move VideoProcessingProvider to App.tsx was implemented, it may have created a situation where there are multiple instances of the context or where the state updates aren't properly propagating to child components.

Focus on ensuring there is only one VideoProcessingProvider in the app and that all components properly consume from it.