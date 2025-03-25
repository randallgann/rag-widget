# User Guide

## Introduction

Welcome to the YouTube RAG Widget platform! This guide will help you get started with our service, which allows you to create an AI-powered Q&A widget based on your YouTube content.

## Getting Started

### 1. Sign Up / Login

1. Visit our landing page at [http://localhost:3003](http://localhost:3003) (development) or [https://yourdomain.com](https://yourdomain.com) (production).
2. Click "Sign Up" to create a new account, or "Login" if you already have one.
3. You can sign up using your email or Google account.

### 2. Dashboard Overview

After logging in, you'll be redirected to the Admin Portal dashboard, which displays:

- Your connected YouTube channels
- Created widgets
- Usage statistics
- Recent queries

## Managing YouTube Channels

### Adding a Channel

1. Click "Add Channel" on the dashboard.
2. Enter your YouTube channel ID or URL.
3. The system will fetch your channel information and start processing videos.

### Channel Details

Click on any channel to view:
- Channel statistics
- List of videos
- Processing status
- Video-specific metrics

### Removing a Channel

1. Go to the Channels page.
2. Find the channel you want to remove.
3. Click the "Delete" button and confirm.

> **Note**: Removing a channel will delete all associated video data and remove it from any widgets.

## Creating Widgets

### New Widget Setup

1. Navigate to the Widgets page.
2. Click "Create New Widget".
3. Configure your widget:
   - Name: Internal reference name
   - Theme: Light or Dark
   - Channels: Select which YouTube channels to include

### Widget Customization

Customize your widget appearance:
- Color scheme
- Size and positioning
- Question input placeholder
- Branding options

### Getting the Embed Code

Once your widget is created:
1. Copy the generated embed code from the widget details page.
2. Paste the code into your website's HTML where you want the widget to appear.

Example embed code:
```html
<script 
  src="https://yourdomain.com/widget/js/widget.js" 
  data-widget-id="your_widget_id">
</script>
```

## Widget Integration

### Website Integration

Add the widget to your website by:
1. Accessing your website's HTML.
2. Placing the embed code where you want the widget to appear.
3. The widget will automatically load and render.

### WordPress Integration

For WordPress sites:
1. Edit the page or post where you want to add the widget.
2. Switch to the "Text" or "HTML" editor view.
3. Paste the embed code.
4. Save and publish.

### Testing Your Widget

After embedding the widget:
1. Visit your website.
2. The widget should appear where you placed the embed code.
3. Try asking questions about your YouTube content.
4. The widget will provide answers based on your videos.

## Analytics and Monitoring

### Query Statistics

The dashboard provides analytics on:
- Total queries
- Query trends over time
- Popular questions
- Channel performance

### User Engagement

Monitor how users interact with your widget:
- Average session duration
- Questions asked per session
- Satisfaction ratings (if enabled)

## Troubleshooting

### Common Issues

**Widget Not Appearing**
- Verify your website allows third-party scripts
- Check browser console for errors
- Ensure your account is active

**Incorrect Answers**
- Add more content to improve the knowledge base
- Rephrase questions to be more specific
- Report incorrect answers through the dashboard

**Video Processing Issues**
- Ensure videos have accurate captions
- Check if videos are public or unlisted
- Verify YouTube API access is working

### Getting Support

If you encounter any issues:
1. Check our FAQ section
2. Contact support through the Help button in the dashboard
3. Email support@yourdomain.com