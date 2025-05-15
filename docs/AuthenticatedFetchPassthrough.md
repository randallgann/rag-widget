# Authenticated Fetch Passthrough Implementation

## Overview
This document outlines the implementation plan for passing the `authenticatedFetch` function through React components to fix the current token issue in the Kernel Service.

## Problem Statement
Currently, the Kernel Service fails to obtain a valid token when creating a kernel during channel creation. The issue occurs because:

1. In React components (TSX), the `authenticatedFetch` function automatically includes the user's auth token
2. In backend services (TS), a different approach using `tokenService` is used, which currently returns an empty string
3. The kernelService is called from channelService during channel creation, but no valid token is passed

## Implementation Plan

### 1. Update ChannelService Interface

Modify the `createChannelWithMetadata` method in `src/services/youtube/channelService.ts` to accept an `authenticatedFetch` function:

```typescript
async createChannelWithMetadata(
  channelDetails: YouTubeChannelDetails,
  userId: string,
  apiKey: string,
  authenticatedFetch?: (url: string, options?: RequestInit) => Promise<Response>
) {
  try {
    // ... existing implementation ...
    
    // Pass authenticatedFetch to kernelService if available
    if (authenticatedFetch) {
      kernelService.setAuthenticatedFetch(authenticatedFetch);
    }
    
    // ... rest of implementation ...
    
    // Create kernel
    this.createChannelKernel(channel).catch(error => {
      logger.error(`Error in background kernel creation for channel ${channel.id}:`, error);
    });
    
    return channel;
  } catch (error: any) {
    // ... error handling ...
  }
}
```

### 2. Update ChannelOnboardingModal

Modify the `startProcessing` method in `src/views/channelOnboarding/index.tsx` to include the authenticatedFetch in the request:

```typescript
const response = await authenticatedFetch('/api/channels', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    channelDetails: selectedChannel,
    // Send additional flag to indicate authenticatedFetch is available
    hasAuthenticatedFetch: true
  })
});
```

### 3. Update ChannelController

Modify the `createChannel` controller in `src/api/controllers/channelController.ts` to extract the authenticatedFetch from the request:

```typescript
export const createChannel = async (req: Request, res: Response) => {
  try {
    const { channelDetails, hasAuthenticatedFetch } = req.body;
    
    // ... existing code ...
    
    // Import service dynamically to avoid circular dependencies
    const { ChannelService } = await import('../../services/youtube/channelService');
    const channelService = new ChannelService();
    
    // Create a proxy authenticated fetch function if frontend indicates it's available
    let authenticatedFetchProxy = undefined;
    if (hasAuthenticatedFetch) {
      authenticatedFetchProxy = async (url: string, options?: RequestInit) => {
        // Use the user's token from the request
        const token = req.headers.authorization?.split(' ')[1];
        
        // Create a fetch function that adds the authorization header
        const fetchOptions = {
          ...options,
          headers: {
            ...options?.headers,
            'Authorization': `Bearer ${token}`
          }
        };
        
        return fetch(url, fetchOptions);
      };
    }
    
    // Create the channel and fetch video metadata
    const channel = await channelService.createChannelWithMetadata(
      channelDetails,
      userId,
      apiKey,
      authenticatedFetchProxy
    );
    
    // ... rest of implementation ...
  } catch (error) {
    // ... error handling ...
  }
};
```

### 4. Testing Plan

To test this implementation:

1. Add debug logging in kernelService.getAuthToken() to confirm token source
2. Create a new channel through the UI and verify in logs that authenticatedFetch is being used
3. Verify kernel creation succeeds with a valid token
4. Check database to ensure the kernel status is updated correctly

### 5. Limitations

This approach has some limitations:

1. It depends on the user's authentication token, so background processes won't work
2. The token in the backend will have the same expiry as the user session
3. If the user logs out during processing, background operations might fail

These limitations will be addressed in the long-term solution using a dedicated Auth0 service account.

## Code Flow Diagram

```
User -> ChannelOnboardingModal
  -> POST /api/channels with hasAuthenticatedFetch flag
    -> ChannelController creates proxy fetch with user's token
      -> ChannelService receives proxy fetch
        -> Passes proxy fetch to KernelService via setAuthenticatedFetch()
          -> KernelService uses proxy fetch to get token
            -> Kernel creation API call succeeds with valid token
```