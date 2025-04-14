# WebSocket ID Mismatch Issue

## Problem Description

The video processing status updates sent via WebSocket are not being properly applied to videos in the UI. The UI shows videos in "processing" state but does not update their progress bars or status changes in real-time.

## Symptoms

When monitoring the browser console, we observe the following pattern:

1. WebSocket connection is established successfully
2. Status updates are received via WebSocket for video IDs (YouTube IDs)
3. The VideoProcessingContext attempts to update the video status
4. Update fails with message: "Video [ID] not found in processing state, ignoring update"
5. Progress bars in the UI remain stuck at 0%

Example log excerpt:
```
Raw WebSocket message received: {"videoId":"3H7L_792u1Y","processingStatus":"processing","processingProgress":0,"processingStage":"download"...}
Received status update for video 3H7L_792u1Y via WebSocket (ID: socket_1744570763460): Object
Progress value for 3H7L_792u1Y: Original=undefined, Processing=undefined, Normalized=0
Normalized update for video 3H7L_792u1Y: Object
updateProcessingStatus called for 3H7L_792u1Y with: Object
Video 3H7L_792u1Y not found in processing state, ignoring update
```

Meanwhile, we can see that the UI is registering a different ID for the video:
```
Registering video f2d0b117-011b-49e0-af2a-8184a439a736 for processing status tracking Object
```

## Root Cause Analysis

The issue stems from an ID mismatch between how videos are registered in the frontend and how their updates are received:

1. In the channel details component, videos are registered in the VideoProcessingContext using their **database UUIDs** (e.g., "f2d0b117-011b-49e0-af2a-8184a439a736")

2. The WebSocket server sends updates based on messages received from the Pub/Sub system containing **YouTube IDs** (e.g., "3H7L_792u1Y")

3. The VideoProcessingContext's `updateProcessingStatus` function checks if the video exists in the state using the ID from the WebSocket message, but since the IDs don't match, it ignores the update with the message "Video [ID] not found in processing state, ignoring update"

This creates a situation where the frontend knows videos are processing but never receives the progress updates.

### Data Flow Examination

Looking at the involved components:

1. **Frontend (`VideoProcessingContext.tsx`)**: 
   - Registers videos with database UUIDs
   - Attempts to update videos based on IDs received in WebSocket messages

2. **Backend (`videoProcStatusSubscriber.ts`)**: 
   - Receives messages from Google Cloud Pub/Sub
   - Can identify videos by both YouTube ID and database UUID (lines 170-199)
   - Emits 'statusUpdate' events containing only the ID used in the incoming message

3. **WebSocket server (`statusController.ts`)**: 
   - Listens for 'statusUpdate' events from the Pub/Sub subscriber
   - Broadcasts them verbatim to connected clients

## Solution Approach

To resolve this issue, we need to ensure consistent ID usage or create a mapping between database UUIDs and YouTube IDs in the status update flow.

### Option 1: Include Both IDs in WebSocket Messages (Recommended)

Modify the backend's statusController.ts to include both the database UUID and the YouTube ID in the WebSocket messages. Then update the frontend to use the correct ID for updating the video processing state.

Benefits:
- Maintains the current registration approach using UUIDs
- Minimizes changes to frontend logic
- Provides more context in status messages for debugging

### Option 2: Use YouTube IDs for Registration

Modify the frontend to register videos using YouTube IDs instead of database UUIDs, to match what the WebSocket is sending.

Drawbacks:
- Would require more extensive changes to the frontend code
- May introduce inconsistency with other parts of the application

## Implementation Plan for Option 1

1. **Update `videoProcStatusSubscriber.ts`**:
   - Modify the `updateVideoStatus` method to include both IDs in the statusUpdate event
   - Add the database UUID (video.id) and YouTube ID (video.youtubeId) to the emitted event

2. **Update `statusController.ts`**:
   - Ensure the WebSocket broadcast includes both IDs
   - Keep the existing 'videoId' field for backward compatibility
   - Add a new 'databaseId' field with the UUID

3. **Update `VideoProcessingContext.tsx`**:
   - Modify the message handling to check for and use databaseId if available
   - Keep support for videoId for backward compatibility
   - Implement a mapping mechanism to handle messages that come with only one type of ID

4. **Add Logging**:
   - Add clear logging at each step to track the ID translation
   - Log both IDs when messages are received or processed

## Expected Results

After implementing these changes:
- The VideoProcessingContext will recognize incoming updates and apply them to the registered videos
- Progress bars in the UI will update in real-time
- Status changes (completed, failed) will propagate correctly
- The console logs will no longer show "Video not found in processing state" errors

## Testing Plan

1. Process a video and monitor both server and client console logs
2. Verify that WebSocket messages contain both IDs
3. Confirm that the VideoProcessingContext successfully updates the video status
4. Check that the UI updates with progress information in real-time
5. Verify that the video shows as completed when processing finishes