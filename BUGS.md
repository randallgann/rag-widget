# Bugs Tracking Document

This document tracks bugs that need to be fixed during development.

## Active Bugs

### [BUG-001] Duplicate YouTube Channel Creation
- **Status**: Open
- **Priority**: High
- **Description**: Users can create multiple channels with the same YouTube channel name in the dashboard.
- **Expected Behavior**: The system should prevent users from adding the same YouTube channel multiple times.
- **Investigation Notes**: Investigation complete. The issue occurs because YouTube channel IDs are stored in the JSONB config column and no uniqueness check is performed at creation time.
- **Potential Solution**: Add uniqueness validation for YouTube channel IDs per user. A detailed implementation plan has been created in `/docs/DuplicateChannelBugFix.md`.

### [BUG-002] Channel Deletion Not Working
- **Status**: Open
- **Priority**: High
- **Description**: When deleting a channel from the dashboard, the channel is removed from the UI but persists in the database, reappearing on page refresh.
- **Expected Behavior**: The delete button should completely remove the channel from the database along with all associated videos.
- **Investigation Notes**: The frontend correctly calls the DELETE API endpoint with proper authentication, but the backend controller method is a stub that returns success without performing any actual deletion. The `deleteChannel` function in `channelController.ts` is not implemented and only returns a success message.
- **Potential Solution**: Implement the `deleteChannel` controller method to delete the channel and all related records (videos, etc.) from the database.

## Resolved Bugs

*No resolved bugs yet.*

## How to Add New Bugs

When adding a new bug, please follow this template:

```
### [BUG-XXX] Title
- **Status**: Open/In Progress/Resolved
- **Priority**: High/Medium/Low
- **Description**: Brief description of the issue.
- **Expected Behavior**: What should happen instead.
- **Steps to Reproduce**: How to reproduce the issue.
- **Investigation Notes**: Any findings from debugging.
- **Resolution**: How the bug was fixed (once resolved).
```