# SignalR Connection Testing Guide

This guide outlines steps to verify that the race condition fixes for SignalR connections are working correctly.

## Background

We identified and fixed several race conditions in the SignalR connection logic that were causing "connection stopped during negotiation" errors. The fixes included:

1. Adding an `isConnecting` state to prevent multiple concurrent connection attempts
2. Updating the `useEffect` dependency array to only trigger on channel ID changes
3. Implementing debounced cleanup for SignalR connections
4. Enhancing the exponential backoff retry mechanism
5. Adding better error handling and connection state management

## Testing Scenarios

### Test 1: Basic Connection

1. Navigate to a channel's chat page
2. Verify that the connection status shows "connected" after a moment
3. Send a message and confirm it appears in the chat
4. Verify that the bot responds to the message

### Test 2: Connection Recovery on Network Issues

1. Open the browser dev tools and go to the Network tab
2. Navigate to a channel's chat page and wait for connection to establish
3. In Network tab, right-click and select "Block request URL" on any SignalR request
4. Observe that the connection attempts to reconnect
5. Remove the block and verify the connection recovers

### Test 3: Fast Navigation Between Pages

1. Open the application and navigate to the dashboard
2. Quickly navigate to a channel's chat page then immediately back to dashboard
3. Navigate back to the chat page and wait for connection
4. Verify no connection errors appear in the console
5. Repeat this process several times, navigating quickly between pages
6. Verify the application remains stable with no connection errors

### Test 4: Multiple Window/Tab Test

1. Open the application in two browser tabs
2. Navigate to the same channel's chat in both tabs
3. Send messages in both tabs
4. Verify that messages appear correctly in both tabs
5. Close one tab and verify the other continues to function properly

### Test 5: Refresh During Connection

1. Navigate to a channel's chat page
2. Immediately refresh the page before the connection completes
3. Verify the connection establishes properly after refresh
4. Send a message to confirm functionality

### Test 6: Connection Under Load

1. Open the browser console
2. Add this code to simulate multiple rapid connection attempts:
   ```javascript
   // Run this in browser console to stress test connection handling
   let navigations = 0;
   const interval = setInterval(() => {
     if (navigations >= 5) {
       clearInterval(interval);
       console.log("Stress test complete");
       return;
     }
     console.log(`Navigation ${navigations + 1}/5`);
     window.location.hash = `/channels/${Date.now()}`;
     navigations++;
   }, 500);
   ```
3. Observe console logs for connection errors
4. Verify the application recovers and can establish a connection after the test

## What to Look For

### Positive Indicators
- No "connection stopped during negotiation" errors in console
- Connection status shows "connected" after navigation
- Smooth transitions between connection states
- Connection successfully recovers after network issues
- No duplicate connections being created

### Error Indicators
- Multiple connection attempts showing in console logs
- Connection errors, especially during navigation
- Failure to reconnect after network disruption
- WebSocket connection leaks (multiple connections open simultaneously)

## Logging Helpers

Add these temporary console logging statements to verify connection behavior:

```javascript
// Add to window object for debugging in browser console
window._logSignalRStatus = true;

// Add to signalRService.ts createHubConnection method
if (window._logSignalRStatus) {
  console.log(`[${new Date().toISOString()}] Creating new SignalR connection`);
}

// Add to startConnection method
if (window._logSignalRStatus) {
  console.log(`[${new Date().toISOString()}] Starting connection, attempt: ${attempts + 1}`);
}

// Add to stopConnection method
if (window._logSignalRStatus) {
  console.log(`[${new Date().toISOString()}] Stopping connection`);
}
```

## Restoring Original Behavior for Comparison

To compare with the original behavior (to confirm the race condition is fixed):

1. Temporarily revert the dependency array change in chat.tsx:
   ```javascript
   // Change this line
   }, [channelId]);
   
   // Back to original
   }, [initializeChatSession, initializeSignalRConnection]);
   ```

2. Run the tests again to observe the race condition errors
3. Restore the fixed code after confirming the issue

## Troubleshooting Common Issues

### Connection Never Establishes
- Check browser console for CORS errors
- Verify the chat-copilot webapi service is running
- Check that authentication token is being provided correctly

### Connection Randomly Disconnects
- Look for network interruptions or timeout errors
- Check for server-side disconnection messages
- Verify that token expiration isn't causing disconnects

### Multiple Connections Being Created
- Check for multiple HubConnection instances in the browser memory
- Look for duplicate connection creation messages in logs
- Verify that cleanup is happening properly when navigating away

## Reporting Results

After testing, document:
1. Which tests passed/failed
2. Any error messages observed
3. Browser and environment information
4. Suggestions for further improvements