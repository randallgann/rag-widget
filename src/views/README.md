# RAG Widget Frontend

This directory contains the frontend React components for the RAG Widget application.

## Structure

- `/App.tsx` - Main application component with routing
- `/index.tsx` - Entry point that renders the App into the DOM
- `/dashboard/` - Dashboard module
  - `/index.tsx` - Dashboard page component
  - `/components/` - Reusable dashboard components
    - `DashboardHeader.tsx` - Header with user profile and actions
    - `StatsSection.tsx` - Dashboard statistics
    - `ChannelList.tsx` - Lists YouTube channels
    - `WidgetList.tsx` - Lists widgets
    - `UserSettings.tsx` - User preference settings

## Authentication Flow

The application uses Auth0 for authentication with secure HttpOnly cookies:

1. User clicks "Log In" button on the homepage
2. Auth0 redirects to the auth callback URL after authentication
3. Backend stores tokens in HttpOnly cookies and redirects to dashboard
4. Frontend checks authentication status with `/api/auth/check` endpoint
5. API requests include cookies via `credentials: 'include'`
6. Protected routes redirect to homepage if user is not authenticated

## Styling

The application uses Tailwind CSS for styling:

- Tailwind classes for component styling
- Custom components defined in `@layer components`
- Responsive design with Tailwind's responsive utilities
- Custom colors and spacing follow the project's design system