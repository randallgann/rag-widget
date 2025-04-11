# CHANGELOG

## IMPORTANT NOTE TO CONTRIBUTORS
Please update this file with all significant code changes and feature additions.
Each entry should include:
- Date of change
- Brief description of what was changed
- Why it was changed (bug fix, feature, improvement)
- Who made the change (if applicable)

## Changes

### 2025-04-11 (Video Processing Message Format Compatibility Fix and UI Improvements)
- **Fixed Video Processing Status Updates**:
  - Added support for handling different message formats from the processing service
  - Fixed field name mapping between received messages and expected format (`video_id` → `videoId`, `progress_percent` → `progress`, `current_stage` → `stage`)
  - Enhanced video lookup to work with both database IDs and YouTube IDs
  - Fixed UUID validation to prevent database errors when using YouTube IDs
  - Added proper error handling to safely process messages with invalid formats
  - Improved debug logging to capture raw message data for troubleshooting
  - Added acknowledgment for error cases to prevent message redelivery loops
  - Fixed topic configuration to correctly connect to Google Cloud Pub/Sub
  - Added configurable model type selection via environment variable GCP_PROCESSING_MODEL_TYPE

- **Fixed Channel Details UI Issues**:
  - Fixed issue where completed videos remained in the selected videos state
  - Added clearing of selected videos after processing to prevent reprocessing of completed videos
  - Improved user experience by removing completed videos from selection interface

### 2025-04-08 (WebSocket Connection Management and UI Improvements)
- **Fixed WebSocket Connection Leak**:
  - Relocated VideoProcessingProvider to App.tsx to prevent multiple connections
  - Enhanced WebSocket cleanup logic to properly close connections in all states
  - Added unique identifiers for WebSocket connections to enable better tracking
  - Implemented permanent storage of completed/failed videos in state to maintain persistent status
  - Added comprehensive debugging tools for WebSocket connection monitoring
  - Created browser console testing utilities for status update simulation
  - Added visual debug panel in development environment for real-time connection stats
  - Enhanced status update logging for better visibility of completion events
  - Added detailed documentation on WebSocket architecture and testing procedures
  - Fixed issue where UI would revert to "processing" status after completion animation
  - Modified animation handling to maintain final status while removing temporary animation effects

- **Improved Video Status UI**:
  - Enhanced completed video appearance with green background
  - Replaced checkbox with checkmark icon for completed videos
  - Changed "Reprocess" button to "Remove" button (red) for completed videos
  - Made completed videos non-selectable in the selection interface
  - Modified "Select all" checkbox to exclude completed videos
  - Improved visual distinction between processing, completed, and pending videos

### 2025-04-07 (Video Processing UI Robustness Improvements)
- **Enhanced Video Processing UI Robustness**:
  - Added capability to clear stale processing states with `clearStaleProcessingVideos` function
  - Improved video status tracking by automatically removing completed/failed videos from active processing
  - Added time-based staleness detection for processing videos (10-minute threshold)
  - Enhanced updateProcessingStatus to properly handle completed and failed states
  - Created comprehensive design document for video processing improvements
  - Added localStorage persistence for video processing state across page refreshes
  - Implemented status verification on page load to detect and fix stale processing states
  - Added new API endpoint for resetting completed/failed video processing status
  - Enhanced video selection to prevent selecting/modifying videos that are processing
  - Improved Process Selected Videos button to properly handle videos already in processing
  - Added refresh animation and visual feedback during loading states
  - Fixed issue where UI could get stuck with videos in processing state after inactivity
  - Fixed TypeScript 'Property does not exist on type never' error with explicit type assertions
  - Added localStorage persistence for processing state across page refreshes
  - Fixed excessive polling by switching to one-time status check and WebSocket updates
  - Optimized resource usage by eliminating repeated status-batch API calls

### 2025-04-06 (Google Cloud Pub/Sub Permission and Topic Configuration Fix)
- **Fixed Google Cloud Pub/Sub Connectivity Issues**:
  - Fixed PERMISSION_DENIED error by adding Pub/Sub Editor and Pub/Sub Subscriber roles to service account
  - Created missing 'video-processing-status' topic in Google Cloud Pub/Sub
  - Fixed invalid subscription name format when using full resource paths with 'projects/' prefix
  - Enhanced videoProcStatusSubscriber.ts to properly handle both simple topic names and full resource paths
  - Added topic name extraction to ensure subscription names are always correctly formatted

### 2025-03-28 (Video Processing Status UI & Real-time Updates)
- **Implemented Real-Time Video Processing Status Updates**:
  - Added WebSocket server for live status updates without polling
  - Created React context for video processing status management
  - Built VideoProcessingStatus component with progress visualization
  - Enhanced video processing subscriber to emit real-time events
  - Implemented estimated time remaining calculation
  - Added visual differentiation for videos being processed
  - Disabled selection of videos during processing
  - Optimized video list rendering with status context integration
  - Enhanced status display with processing stage information
  
### 2025-03-28 (Video Processing Status Tracking & Environment Fixes)
- **Implemented Video Processing Status Tracking**:
  - Added `videoProcStatusSubscriber` service to receive real-time status updates from processing cluster
  - Enhanced database schema with new fields (`processing_stage` and `processing_last_updated`)
  - Added detailed video status endpoint at `/api/videos/:id/status-detailed`
  - Updated existing status endpoints to include additional status fields
  - Implemented time remaining estimation based on processing progress
  - Added automatic subscription management for Pub/Sub status updates
  - Enhanced Video model with additional processing status data

- **Fixed Video Processing Errors**:
  - Fixed "WHERE parameter 'id' has invalid 'undefined' value" error during video processing by correcting parameter name mismatch
  - Changed `channelId` to `id` in `processChannelVideos` function to match route parameter naming
  - Added enhanced logging for improved debugging of video processing
  - Fixed authentication issue with Google Cloud Pub/Sub by properly setting the credentials path
  - Implemented robust GCP authentication that works in both development and Docker environments
  - Added automatic detection of service account key files in multiple locations
  - Enhanced error logging for Pub/Sub authentication issues

- **Development Environment Improvements**:
  - Fixed inconsistent port use between development and production environments
  - Updated dev script to use port 3001 consistently across all environments
  - Modified nodemon configuration to respect the PORT environment variable
  - Updated app.ts to consistently use the same port

### 2025-03-27 (Service Consolidation)
- **Consolidated Architecture**:
  - Merged auth-server and admin-portal services into a single api-service
  - Simplified deployment by reducing from 3 to 2 services (api-service + frontend)
  - Standardized on port 3001 for all backend operations
  - Removed duplicate configuration and dependencies
  - Updated Docker Compose configuration with consolidated service
  - Updated Kubernetes manifests to reflect new architecture
  - Refactored build scripts for consolidated image building
  - Created comprehensive documentation of the new architecture
  - Added ServiceConsolidationPlan.md with implementation details
  - Updated all environment variable references to use the new service

### 2025-03-21 (Kubernetes Deployment Improvements)
- **Enhanced Kubernetes Deployment Configuration**:
  - Fixed port mismatch in frontend service (changed containerPort from 3003 to 80 and service port configuration)
  - Improved database connection reliability with readiness/liveness probes and init containers
  - Enhanced Auth0 configuration management with centralized secrets
  - Created setup script for Auth0 secrets with multiple methods for providing credentials (direct, env file, GCP Secret Manager)
  - Fixed port forwarding commands to match service configurations
  - Added comprehensive troubleshooting guide for common Kubernetes deployment issues
  - Updated deployment documentation with detailed steps for applying changes to existing clusters
  - Enhanced service startup sequence to prevent initial database connection failures

### 2025-03-19 (Video Processing Queue Implementation and Bugfixes)
- **Added Google Cloud Pub/Sub Integration for Video Processing**:
  - Implemented messaging queue for offloading video processing to external servers
  - Created Pub/Sub service for publishing video processing messages
  - Added secure authentication using GCP Secret Manager 
  - Implemented video processor service to queue videos for processing
  - Enhanced video controller with new status update endpoints
  - Created polling mechanism in UI to display processing status
  - Added visual progress indicators for videos being processed
  - Updated API routes with new status endpoint endpoints
  - Added comprehensive documentation for the messaging queue architecture
  - Updated environment configuration with new GCP settings

- **Fixed Error Handling in Video Processing**:
  - Fixed "WHERE parameter 'id' has invalid 'undefined' value" error in video processing
  - Added robust validation of video IDs before database operations
  - Improved error handling in videoProcessorService and videoController
  - Enhanced UI components to handle potential undefined values
  - Added null checks throughout the video processing workflow
  - Improved error messages to provide more detailed feedback
  - Fixed TypeScript error handlers to properly specify error types

### 2025-03-19 (YouTube Thumbnail Proxy Implementation)
- **Fixed YouTube Thumbnail Display Issue**:
  - Created proxy server route to fetch YouTube thumbnails server-side
  - Added server-side image proxy controller for secure image fetching
  - Updated Content Security Policy to allow YouTube image domains
  - Implemented client-side helper function to extract video IDs from YouTube URLs
  - Modified channel detail page to use proxy URLs for all thumbnails
  - Fixed issue with thumbnails failing to load due to YouTube's referrer policy restrictions
  - Added proper caching headers for proxied images
  - Enhanced error handling for image proxy requests

### 2025-03-19 (Channel Detail Page Implementation)
- **Channel Detail Page and Video Management**:
  - Created channel detail view accessible from dashboard and channels list
  - Added ability to view all videos for a specific channel
  - Implemented video selection interface with individual and batch selection
  - Added video processing functionality for selected videos
  - Created backend API endpoints for video selection and processing:
    - Added video controller with selection status update endpoints
    - Added batch selection endpoint for multiple videos
    - Implemented process endpoint for initiating video processing
  - Enhanced UI with search, sort, and pagination capabilities
  - Added optimistic UI updates with error handling fallbacks
  - Implemented security measures to ensure users can only access their own data

### Development Notes
- **Component Usage Guidelines**:
  - Button component: Do not use the `size` attribute directly. The Button component in this project does not support a size prop unlike many UI libraries. Use className for sizing instead.
  - When using Checkbox component, note that its onChange handler receives a boolean rather than an event object, requiring adapter functions in some cases.

- **TypeScript Error Handling**:
  - Always specify the error type in catch blocks: `catch (error: any) { ... }` or use a more specific type when appropriate.
  - Failing to specify the error type will cause TypeScript compilation errors (implicit any type).

### 2025-03-18 (YouTube API Performance and Error Handling)
- **Fixed YouTube Video Fetching and Database Insertion**:
  - Fixed "Bad Request" error when fetching video details from YouTube API
  - Implemented batched video fetching to handle large channels (50 videos per batch)
  - Fixed duplicate key violations when inserting videos into database
  - Implemented upsert logic to update existing videos instead of failing on duplicates
  - Added individual processing fallback for error recovery
  - Enhanced error handling and logging throughout the fetching and insertion process
  - Added delay between batch requests to avoid YouTube API rate limiting

### 2025-03-18 (Model Association Fix)
- **Fixed Channel-Video Association Error**:
  - Fixed "Video is not associated to Channel!" error when accessing channels page
  - Added model association initialization in app.ts to properly set up relationships between models
  - Updated Video model to include missing fields referenced in the controller:
    - thumbnailUrl, description, publishedAt, duration, durationSeconds, viewCount, etc.
  - Fixed attribute interfaces and model property definitions
  - Ensured proper model loading sequence to avoid dependency issues
  - Enhanced type definitions for better TypeScript type safety
  - Fixed database field naming convention alignment with snake_case

### 2025-03-18 (Channel Management Implementation)
- **Channel Management Page Implementation**:
  - Added new channels page for managing YouTube channels
  - Implemented UI for viewing and managing channel details
  - Created channel listing with video statistics
  - Enhanced channelController to return channel data with video counts
  - Added type definitions for videoStats in API responses
  - Implemented route to fix 404 error when accessing /channels endpoint
  - Added actions for channel refresh and deletion
  - Fixed TypeScript compilation errors for proper type safety
  - Fixed path alias imports in backend code to ensure proper module resolution
  - Added universal fallback route to support client-side routing with React Router

### 2025-03-18 (Channel Creation User ID Fix)
- **Channel Creation User ID Fix**:
  - Fixed issue in channelOnboarding where userId was hardcoded as 'currentUser'
  - Updated channelController to properly retrieve the Auth0 user ID from request
  - Added logic to convert Auth0 ID to internal UUID for proper database foreign key relationships
  - Improved error handling for cases where a user may not exist in the database
  - Removed client-side user ID passing for better security

### 2025-03-14 (YouTube Integration & Channel Onboarding)
- **YouTube API Integration & Public Channel Onboarding Flow**:
  - Implemented YouTube API service for channel validation and metadata retrieval
  - Created backend endpoint for validating YouTube channels (`/api/channels/validate`)
  - Added comprehensive error handling for YouTube API requests
  - Implemented channel URL parsing to support multiple input formats:
    - Direct channel IDs (e.g., `UCBR8-60-B28hp2BmDPdntcQ`)
    - Channel handles (e.g., `@Mikey-and-Me`) 
    - YouTube URLs (e.g., `https://www.youtube.com/@Mikey-and-Me`)
    - Custom URLs (e.g., `https://www.youtube.com/c/ChannelName`)
  - Enhanced channel onboarding modal with validation feedback
  - Improved user experience with loading states during API calls
  - Created helper utility to format subscriber counts (e.g., 1.5K, 1.2M)
  - Added robust unit and integration tests for YouTube API service and validation endpoint

### 2025-03-09 (Authentication Improvements & UX Enhancement)
- **Smart Token Refresh Implementation**:
  - Fixed disruptive UI flashes caused by periodic authentication checks
  - Implemented JWT token decode for expiration time extraction 
  - Replaced fixed 30-second interval with intelligent token expiration detection
  - Added preemptive token refresh 5 minutes before expiration
  - Optimized state updates to only occur when auth status changes
  - Enhanced debugging tools with token expiration information
  - Improved user experience with seamless authentication maintenance
  - Added proper cleanup of refresh timers to prevent memory leaks

- **Database-Driven User Authentication**:
  - Removed dependency on session-stored user data 
  - Modified auth controller to retrieve all user information from database
  - Updated token exchange process to use database as single source of truth
  - Enhanced security by minimizing sensitive data in session storage
  - Added type safety improvements for Auth0 ID handling
  - Implemented database storage of refresh tokens for improved reliability
  - Updated database timestamps for accurate last login tracking
  - Fixed TypeScript compilation errors related to JWT payload types

### 2025-03-09 (Auth0 Docker Environment Fix)
- **Auth0 Docker Authentication Fix**:
  - Fixed authentication issues when running in Docker containers
  - Updated docker-compose.yml to include missing Auth0 environment variables:
    - Added AUTH0_CLIENT_ID for client identification
    - Added AUTH0_CLIENT_SECRET for secure client authentication
    - Added AUTH0_CALLBACK_URL for proper redirect handling
  - Modified user creation flow to prevent duplicate database entries:
    - Improved UserService.findOrCreateUser to handle race conditions
    - Added better error handling for duplicate users
    - Fixed case where name and email might be swapped
    - Enhanced TypeScript type safety for the user model
  - Removed dependency on Auth0 Management API:
    - Updated user service to store user info during authentication instead of querying Management API
    - Eliminated "unauthorized_client" errors by removing Management API dependency
    - Simplified user creation process
  - Fixed docker environment parity with local development

### 2025-03-07 (Authentication Fix - Token Exchange Implementation)
- **Authentication Token Exchange Fix**:
  - Fixed 401 unauthorized errors on dashboard API endpoints after login
  - Implemented proper state token to access token exchange in frontend
  - Created authenticatedFetch utility to automatically include token in API requests
  - Updated all dashboard components to use authenticatedFetch for API calls
  - Ensures Authorization header is properly set with Bearer token for all requests
  - Eliminates 401 errors by meeting validateAuth0Token middleware requirements

### 2025-03-07 (Auth Sessions & Database Migration System)
- **Authentication Session Storage**: 
  - Fixed MongoDB connection error by converting session storage to PostgreSQL
  - Created Sequelize Session model with proper field mapping (camelCase to snake_case)
  - Added database migration for Sessions table using TypeScript
  - Updated sessionService.ts to use Sequelize for storing Auth0 refresh tokens
  - Eliminated MongoDB dependency for simpler tech stack
- **Automated Database Migration System**:
  - Implemented automatic TypeScript migrations in app.ts
  - Added migration tracking via migration_history table
  - Created transaction-based migration execution for safety
  - Migrations run automatically at application startup
  - Error handling with graceful recovery in development mode

### 2025-03-05 (Security Enhancement: Simplified Authentication Flow)
- **Authentication Flow Security Enhancement**:
  - Simplified authentication flow between test-landing-page and rag-widget app
  - Eliminated complex token exchange mechanism in favor of direct PKCE authentication
  - Updated test-landing-page login buttons to point directly to rag-widget's auth endpoints
  - Removed unused code and complex state token exchange logic
  - Added full documentation of the authentication flow in LoginFlow.md
  - Key security improvements:
    - Reduced complexity and potential attack surface
    - No sensitive tokens in URLs, browser history, or server logs
    - Direct utilization of secure PKCE flow already implemented in rag-widget
    - Clear separation of responsibilities between landing page and admin portal

### 2025-03-03 (Security Enhancement: PKCE with Refresh Token Rotation)
- **Authentication Security Enhancement**:
  - Added PKCE support to prevent authorization code interception attacks
  - Implemented refresh token rotation for enhanced security
  - Created secure token exchange flow to avoid tokens in URLs
  - Added secure token storage using HttpOnly cookies
  - Implemented fallback mechanisms for browsers with strict privacy controls
  - Created server-side session storage for token backup
  - Added utils and services:
    - PKCE utilities (generateCodeVerifier, generateCodeChallenge)
    - Enhanced Auth0 service with PKCE and token rotation support
    - Session service for fallback token storage
    - Updated auth controller and routes

### 2025-03-02 (Frontend Build Configuration)
- **Frontend Build Enhancement**: 
  - Added webpack configuration for bundling React frontend code
  - Fixed bundle.js not found error by adding proper bundling process
  - Configured CSS and TypeScript loaders for webpack
  - Updated package.json scripts for concurrent backend/frontend development
  - Fixed CSS import paths in frontend code
  - Added development mode with automatic rebuilding of client-side assets
  - Updated scripts to build both client and server code

### 2025-03-02 (Refactoring Plan for Security and Best Practices)
- **Architectural Refactoring Plan**: Created plan to align application with TypeScript, React, and Tailwind CSS best practices

  #### Backend Security Improvements Planned
  - Replace URL hash tokens with secure HttpOnly cookies
  - Update auth controller to set and clear cookies properly
  - Add proper token verification with JWKS-RSA
  - Update app.ts to serve static files correctly
  - Configure CSP headers to improve security
  - Add proper SPA fallback routes
  - Remove inline scripts in HTML responses
  - Add `/api/auth/check` endpoint to verify authentication status
  - Update logout flow to clear cookies
  - Improve error handling in auth middleware

  #### Frontend Architecture Improvements Planned
  - Create proper React application entry point (App.tsx)
  - Implement client-side routing with react-router
  - Add authentication guards for protected routes
  - Update existing dashboard components to match best practices
  - Remove localStorage token storage
  - Update API calls to include credentials for cookie-based auth
  - Add proper authentication state management
  - Implement logout functionality
  - Add user profile dropdown menu
  - Improve responsive styling
  - Use Tailwind CSS classes consistently

  #### Next Steps for Implementation
  - ✅ Configure webpack for TypeScript and React
  - Set up Tailwind CSS processing
  - Configure path aliases (@/ imports)
  - Add production and development build modes
  - Add tests for authentication flow and React components
  - Update Docker configuration to build frontend assets
  - Configure proper CORS for production
  - Set secure cookie options for production
  - Complete feature implementation for channels, widgets, and queries

### 2025-03-02
- **Database Enhancement**: Added pgvector extension to PostgreSQL for vector embeddings support
- **User Authentication Enhancements**: 
  - Updated User model to store Auth0 user information securely following best practices
  - Added tracking of last login timestamp
  - Added user roles (admin/user) and user preferences storage
  - Updated SQL schema to match the enhanced User model
  - Improved user profile data returned by API
  - **IMPORTANT**: Schema changes required database reset (see DB Migration note below)
- **Database Migration Process**:
  - When changing database schema, existing volumes need to be reset:
    ```bash
    docker-compose down
    docker volume rm rag-widget_postgres_data
    docker-compose up --build
    ```
  - Useful SQL commands for verifying user data:
    ```sql
    psql -U postgres -d youtube_rag
    -- View table structure
    \d users
    
    -- List all users
    SELECT id, auth0_id, email, name, role, last_login, is_active, created_at FROM users;
    
    -- Count users
    SELECT COUNT(*) FROM users;
    
    -- Find user by email
    SELECT * FROM users WHERE email = 'your-email@example.com';
    
    -- Check recent logins
    SELECT name, email, last_login FROM users WHERE last_login IS NOT NULL ORDER BY last_login DESC LIMIT 5;
    
    -- Check user roles
    SELECT role, COUNT(*) FROM users GROUP BY role;
    ```
- **Configuration Fix**: Updated docker-compose.yml to use individual database environment variables (DB_HOST, DB_PORT, etc.) instead of DATABASE_URL to properly connect to the PostgreSQL container from the admin portal service.
- **Docker Build Fix**: Modified Dockerfile to use the correct entry point (dist/app.js) matching the package.json configuration.
- **Auth0 Configuration**: Fixed Auth0 integration by adding AUTH0_SECRET environment variable for cookie signing/encryption in express-openid-connect library.

### Initial Development (Pre-changelog)
- Created core application structure with TypeScript
- Set up Express server with middleware configuration
- Implemented Auth0 authentication integration
- Established PostgreSQL database connection
- Added Docker configuration for all services
- Created basic API routes for auth, channels, queries, and widgets