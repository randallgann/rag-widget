# Channel Deletion Bug Fix Implementation Plan

## Bug Description

**Bug ID**: BUG-002  
**Priority**: High  
**Status**: Open

When deleting a channel from the dashboard, the channel is removed from the UI but persists in the database, reappearing on page refresh. The issue occurs because:

1. The frontend correctly sends a DELETE request to the API endpoint with proper authentication
2. The backend controller method (`deleteChannel` in `channelController.ts`) is merely a stub that returns a success message
3. No actual deletion is performed in the database

## Fix Implementation Plan

### Step 1: Implement `deleteChannel` Controller Method

Update the `deleteChannel` method in `src/api/controllers/channelController.ts`:

```typescript
/**
 * Delete a channel
 * @route DELETE /api/channels/:id
 */
export const deleteChannel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !req.user.userId) {
      throw new AppError('Unauthorized', 401);
    }
    
    const { id } = req.params;
    
    if (!id) {
      throw new AppError('Channel ID is required', 400);
    }
    
    // Get user from our database
    const user = await userService.getUserByAuth0Id(req.user.userId);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Find the channel to make sure it exists and belongs to the user
    const channel = await Channel.findOne({
      where: { 
        id,
        userId: user.id // Ensure the channel belongs to the user
      }
    });
    
    if (!channel) {
      throw new AppError('Channel not found', 404);
    }
    
    // Get associated data to be deleted
    const videoCount = await Video.count({
      where: { channelId: id }
    });

    const widgetCount = await Widget.count({
      where: { channelId: id }
    });
    
    // Log the deletion attempt
    logger.info(`Deleting channel ${id} with ${videoCount} videos and ${widgetCount} widgets`, {
      userId: user.id,
      channelId: id
    });
    
    // Delete the channel (cascading delete will remove videos and other related records)
    await channel.destroy();
    
    // Return success response
    return res.status(200).json({
      status: 'success',
      message: `Channel deleted successfully along with ${videoCount} videos and ${widgetCount} widgets`
    });
  } catch (error) {
    logger.error('Delete channel error:', error);
    next(error);
  }
};
```

### Step 2: Add Cascade Delete Database Configuration

Ensure cascade delete is properly configured in the database for efficient removal of related records. 

This should already be in place as described in the `database/init.sql` file, where the channels table has references with ON DELETE CASCADE:

```sql
CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  youtube_id VARCHAR(255) NOT NULL UNIQUE,
  title VARCHAR(255),
  description TEXT,
  channel_id UUID NOT NULL REFERENCES channels(id) ON UPDATE CASCADE ON DELETE CASCADE,
  -- other fields...
);
```

### Step 3: Add Error Handling in the Frontend

Enhance the frontend error handling to provide more detailed feedback to the user:

```typescript
// Function to delete a channel
const handleDeleteChannel = async (channelId: string) => {
  if (!confirm('Are you sure you want to delete this channel? This action cannot be undone and will remove all videos and data associated with this channel.')) {
    return;
  }
  
  try {
    logger.debug(`Deleting channel ${channelId}`);
    
    // Show loading state
    // setLoading(true); // If you have a loading state
    
    const response = await authenticatedFetch(`/api/channels/${channelId}`, {
      method: 'DELETE'
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      throw new Error(responseData.message || `Failed to delete channel: ${response.status} ${response.statusText}`);
    }
    
    // Remove the deleted channel from state
    setChannels(channels.filter(channel => channel.id !== channelId));
    
    // Show success message
    alert('Channel deleted successfully');
  } catch (error) {
    logger.error(`Error deleting channel ${channelId}`, error);
    alert(`Failed to delete channel: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    // setLoading(false); // If you have a loading state
  }
};
```

### Step 4: Add Confirmation Dialog Component (Optional Enhancement)

Replace the basic `confirm` dialog with a more sophisticated modal confirmation dialog:

```tsx
// In src/components/confirmation-dialog.tsx
import React from 'react';
import { Dialog, DialogBody, DialogActions, DialogTitle } from '@/components/dialog';
import { Button } from '@/components/button';
import { Text } from '@/components/text';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false
}) => {
  return (
    <Dialog open={isOpen} onClose={onClose}>
      <DialogBody className="sm:max-w-md">
        <DialogTitle>{title}</DialogTitle>
        <Text className="mt-2">{message}</Text>
        <DialogActions className="mt-4">
          <Button onClick={onClose}>{cancelText}</Button>
          <Button 
            color={danger ? 'red' : 'blue'} 
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmText}
          </Button>
        </DialogActions>
      </DialogBody>
    </Dialog>
  );
};
```

Then update the channel deletion to use this component:

```tsx
// In the channels page
const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
const [channelToDelete, setChannelToDelete] = useState<string | null>(null);

// Function to handle delete button click
const handleDeleteClick = (channelId: string) => {
  setChannelToDelete(channelId);
  setDeleteDialogOpen(true);
};

// Function to perform actual deletion
const confirmDeleteChannel = async () => {
  if (!channelToDelete) return;
  
  try {
    // ... existing deletion logic ...
  } catch (error) {
    // ... error handling ...
  } finally {
    setChannelToDelete(null);
  }
};

// In the JSX:
<Button 
  color="red"
  onClick={() => handleDeleteClick(channel.id)}
>
  <TrashIcon className="w-4 h-4 mr-1" />
  Delete
</Button>

{/* Add confirmation dialog */}
<ConfirmationDialog
  isOpen={deleteDialogOpen}
  onClose={() => setDeleteDialogOpen(false)}
  onConfirm={confirmDeleteChannel}
  title="Delete Channel"
  message="Are you sure you want to delete this channel? This action cannot be undone and will remove all videos and data associated with this channel."
  confirmText="Delete Channel"
  cancelText="Cancel"
  danger={true}
/>
```

### Step 5: Testing Plan

1. **Unit Tests**:
   - Add tests for the `deleteChannel` controller method
   - Verify that related videos and widgets are properly deleted
   - Test error handling for various scenarios (unauthorized, channel not found, etc.)

2. **Integration Tests**:
   - Test the DELETE API endpoint with various scenarios
   - Verify cascading deletes work correctly

3. **Manual Testing**:
   - Test deleting a channel from the UI
   - Verify the channel is properly removed from the database
   - Verify related videos and widgets are properly removed
   - Check edge cases (e.g., deleting a channel with a large number of videos)

### Step 6: Deploy and Verify

1. Deploy the changes to the development environment
2. Verify the fix works correctly in the deployed environment
3. Update the bug status in the BUGS.md file

## Conclusion

By implementing this fix, the channel deletion functionality will work as expected, properly removing channels and their associated data from the database when the user clicks the delete button. This will prevent the issue of channels reappearing on page refresh and ensure data integrity in the system.