# Duplicate Channel Bug Fix Implementation Plan

## Bug Description

**Bug ID**: BUG-001  
**Priority**: High  
**Status**: Open

Users can create multiple channels with the same YouTube channel for a single user. The issue occurs because:

1. The YouTube channel ID is stored in the JSONB `config` column under the `youtubeChannelId` field
2. No uniqueness check is performed at creation time to prevent duplicate YouTube channels per user
3. The channel name and ID are not stored in dedicated indexed columns for easy uniqueness validation

## Fix Implementation Plan

### Step 1: Modify `createChannel` in `channelController.ts`

Add a check before channel creation to verify if the user already has a channel with the same YouTube channel ID:

```typescript
// Check if this user already has a channel with this YouTube channel ID
const existingChannels = await Channel.findAll({ 
  where: { 
    userId: userId 
  }
});

// Check if any of the existing channels has this YouTube channel ID in their config
const duplicateChannel = existingChannels.find(ch => {
  // Convert to plain object to access JSONB fields reliably
  const config = ch.get('config') as any;
  return config?.youtubeChannelId === channelDetails.id;
});

if (duplicateChannel) {
  return res.status(409).json({
    status: 'error',
    message: 'You have already added this YouTube channel',
    data: {
      channelId: duplicateChannel.id
    }
  });
}
```

This should be added after retrieving the user by Auth0 ID and before getting the YouTube API key.

### Step 2: Update Frontend Error Handling

Modify the channel creation frontend code in `src/views/channelOnboarding/index.tsx` to handle the 409 Conflict status:

```typescript
try {
  // Create the channel and retrieve video metadata
  const response = await authenticatedFetch('/api/channels', {
    // Existing code...
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    
    // Handle duplicate channel specifically
    if (response.status === 409) {
      // Possibly redirect to the existing channel
      if (errorData.data?.channelId) {
        // Option 1: Redirect to the existing channel
        window.location.href = `/channels/${errorData.data.channelId}`;
        return;
      }
    }
    
    throw new Error(errorData.message || 'Failed to create channel');
  }
  
  // Existing success handling...
} catch (error) {
  // Existing error handling...
}
```

### Step 3: Add Database Schema Improvement (Long-term Fix)

For a more robust solution, update the database schema to store the YouTube channel ID in a dedicated column with a unique constraint per user:

1. Create a migration script to add a new column:

```sql
-- Add a dedicated column for YouTube channel ID
ALTER TABLE channels ADD COLUMN youtube_channel_id VARCHAR(255);

-- Populate the new column from the existing JSONB data
UPDATE channels 
SET youtube_channel_id = (config->>'youtubeChannelId')::VARCHAR
WHERE config->>'youtubeChannelId' IS NOT NULL;

-- Add a unique constraint for user_id + youtube_channel_id
CREATE UNIQUE INDEX idx_unique_user_youtube_channel 
ON channels(user_id, youtube_channel_id)
WHERE youtube_channel_id IS NOT NULL;
```

2. Update the Channel model in `src/db/models/Channel.ts` to include the new field:

```typescript
// Add to ChannelAttributes interface
youtubeChannelId?: string;

// Add to the model definition
Channel.init(
  {
    // existing fields...
    
    youtubeChannelId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'youtube_channel_id'
    },
    
    // other fields...
  },
  {
    // existing configuration...
  }
);
```

3. Update the channel creation code to use this new field:

```typescript
// In channelService.ts
const channel = await Channel.create({
  name: channelDetails.name,
  description: channelDetails.description,
  userId: userId,
  youtubeChannelId: channelDetails.id, // Add this line
  config: {
    youtubeChannelId: channelDetails.id, // Keep for backward compatibility
    thumbnailUrl: channelDetails.thumbnailUrl,
    // other config fields...
  },
  // other fields...
});
```

### Step 4: Testing Plan

1. **Unit Tests**:
   - Add tests for the duplicate channel validation logic
   - Test with different YouTube channel IDs for the same user
   - Test with the same YouTube channel ID for different users (should be allowed)

2. **Integration Tests**:
   - Test the API endpoint with duplicate channel creation scenarios
   - Verify 409 status code and appropriate error message

3. **Manual Testing**:
   - Test channel creation in the UI with an existing YouTube channel
   - Verify appropriate error messages are displayed
   - Check database integrity to ensure no duplicates exist

### Step 5: Cleanup of Existing Duplicate Data

After implementing the fix, run a script to identify and resolve existing duplicate channels:

```javascript
// Find duplicate YouTube channel IDs per user
const findDuplicates = async () => {
  const allChannels = await Channel.findAll();
  const channelsByUser = {};
  
  // Group channels by user
  allChannels.forEach(channel => {
    const userId = channel.userId;
    const config = channel.config || {};
    const youtubeChannelId = config.youtubeChannelId;
    
    if (youtubeChannelId) {
      if (!channelsByUser[userId]) {
        channelsByUser[userId] = {};
      }
      
      if (!channelsByUser[userId][youtubeChannelId]) {
        channelsByUser[userId][youtubeChannelId] = [];
      }
      
      channelsByUser[userId][youtubeChannelId].push({
        id: channel.id,
        name: channel.name,
        createdAt: channel.createdAt
      });
    }
  });
  
  // Find users with duplicate channel IDs
  const duplicates = {};
  Object.keys(channelsByUser).forEach(userId => {
    const userChannels = channelsByUser[userId];
    
    Object.keys(userChannels).forEach(youtubeId => {
      if (userChannels[youtubeId].length > 1) {
        if (!duplicates[userId]) {
          duplicates[userId] = {};
        }
        duplicates[userId][youtubeId] = userChannels[youtubeId];
      }
    });
  });
  
  return duplicates;
};

// Process duplicates - keep the newest one
const cleanupDuplicates = async (duplicates) => {
  for (const userId in duplicates) {
    for (const youtubeId in duplicates[userId]) {
      const channels = duplicates[userId][youtubeId];
      
      // Sort by creation date, newest first
      channels.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      // Keep the first one (newest), delete the rest
      for (let i = 1; i < channels.length; i++) {
        await Channel.destroy({ where: { id: channels[i].id } });
        console.log(`Deleted duplicate channel: ${channels[i].id} (${channels[i].name})`);
      }
    }
  }
};
```

## Conclusion

By implementing this fix, users will be prevented from creating duplicate YouTube channels, improving data integrity and user experience. The immediate solution prevents duplicates at creation time, while the long-term database schema change provides a more robust and efficient solution for the future.