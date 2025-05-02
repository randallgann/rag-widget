import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter as Router, Route, Redirect, Switch } from 'react-router-dom';
import { UserProfileResponse } from '@/types/api';
import { VideoProcessingProvider } from '../contexts/VideoProcessingContext';
import { SignalRProvider } from '../contexts/SignalRContext';
import Dashboard from './dashboard';
import AddChannelButton from './channelOnboarding';

// Create a simple logger that respects environment
const logger = {
  debug: (message: string, data?: any) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEBUG] ${message}`, data || '');
    }
  },
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${message}`, data || '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[WARN] ${message}`, data || '');
  },
  error: (message: string, data?: any) => {
    console.error(`[ERROR] ${message}`, data || '');
  }
};

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserProfileResponse['user'] | null;
  accessToken: string | null;
  tokenExpiresAt: number | null;
}

// Function to decode JWT and extract expiration time
const getTokenExpiration = (token: string): number | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }
    
    // Base64 decode the payload (middle part)
    // Handle base64url format by replacing chars and adding padding
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - base64.length % 4) % 4);
    const jsonPayload = atob(base64 + padding);
    
    const payload = JSON.parse(jsonPayload);
    if (payload.exp) {
      return payload.exp * 1000; // Convert to milliseconds
    }
    return null;
  } catch (error) {
    logger.error('Failed to decode token:', error);
    return null;
  }
};

const App: React.FC = () => {
  // Use a ref to track the latest access token
  const latestAccessToken = useRef<string | null>(null);
  // Use ref for token refresh timer
  const tokenRefreshTimer = useRef<number | null>(null);
  
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    accessToken: null,
    tokenExpiresAt: null
  });

  // Track URL changes for state_token
  const [location, setLocation] = useState(window.location.href);

  // Clear token refresh timer
  const clearTokenRefreshTimer = useCallback(() => {
    if (tokenRefreshTimer.current !== null) {
      window.clearTimeout(tokenRefreshTimer.current);
      tokenRefreshTimer.current = null;
    }
  }, []);

  // Schedule token refresh based on expiration time
  const scheduleTokenRefresh = useCallback((expiresAt: number) => {
    // Clear any existing timer first
    clearTokenRefreshTimer();
    
    // Calculate time until refresh (5 minutes before expiration)
    const timeUntilRefresh = expiresAt - Date.now() - (5 * 60 * 1000);
    
    // Only schedule if the refresh time is in the future
    if (timeUntilRefresh > 0) {
      logger.debug(`Scheduling token refresh in ${Math.round(timeUntilRefresh / 1000)}s`);
      tokenRefreshTimer.current = window.setTimeout(() => {
        logger.debug('Executing scheduled token refresh');
        refreshToken();
      }, timeUntilRefresh);
    } else {
      // Token is already expired or about to expire, refresh immediately
      logger.debug('Token expired or about to expire, refreshing immediately');
      refreshToken();
    }
  }, []);

  // Listen for URL changes
  useEffect(() => {
    const handleUrlChange = () => {
      logger.debug('URL changed, updating location state');
      setLocation(window.location.href);
    };

    // Listen for popstate events (browser back/forward)
    window.addEventListener('popstate', handleUrlChange);
    
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, []);

  // Cleanup token refresh timer on unmount
  useEffect(() => {
    return () => clearTokenRefreshTimer();
  }, [clearTokenRefreshTimer]);

    const setAccessToken = useCallback((token: string) => {
    logger.debug('Setting access token:', { 
      tokenReceived: !!token,
      tokenLength: token?.length || 0,
      tokenPrefix: token ? token.substring(0, 5) + '...' : 'none'
    });
    
    // Update the ref immediately so it's available to authenticatedFetch
    latestAccessToken.current = token;
    
    // Get token expiration time
    const expiresAt = getTokenExpiration(token);
    
    if (expiresAt) {
      logger.debug('Token expiration time decoded:', { 
        expiresAt: new Date(expiresAt).toISOString(),
        timeUntilExpiration: Math.round((expiresAt - Date.now()) / 1000) + 's'
      });
      
      // Schedule token refresh
      scheduleTokenRefresh(expiresAt);
    } else {
      logger.warn('Could not decode token expiration time');
    }
    
    // Then update the state
    setAuthState(prevState => {
      const newState = {
        ...prevState,
        accessToken: token,
        tokenExpiresAt: expiresAt,
        isAuthenticated: true
      };
      
      logger.debug('New auth state after setting token:', {
        isAuthenticated: newState.isAuthenticated,
        hasToken: !!newState.accessToken,
        tokenLength: newState.accessToken?.length || 0,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : 'unknown'
      });
      
      return newState;
    });
  }, [scheduleTokenRefresh]);

  // Check if there's a state_token in the URL (added for debugging)
  useEffect(() => {
    logger.debug('Checking URL for state_token', { currentUrl: location });
    
    const urlParams = new URLSearchParams(window.location.search);
    const stateToken = urlParams.get('state_token');
    
    if (stateToken) {
      logger.debug('State token found in URL', { 
        stateTokenLength: stateToken.length,
        stateTokenPrefix: stateToken.substring(0, 5) + '...'
      });
      
      // Exchange state token for access token
      (async () => {
        try {
          logger.debug('Starting token exchange with state token');
          
          const response = await fetch('/api/auth/token-exchange', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ stateToken })
          });

          if (!response.ok) {
            logger.error(`Token exchange failed with status ${response.status}:`, { statusText: response.statusText });
            throw new Error(`Failed to exchange token: ${response.status}`);
          }

          const data = await response.json();
          logger.debug('State-To-Access token exchange response received', { 
            success: !!data.accessToken,
            accessTokenLength: data.accessToken ? data.accessToken.length : 0,
            hasUserData: !!data.user
          });
          
          // Store the access token in memory and check its expiration
          if (data.accessToken) {
            setAccessToken(data.accessToken);
            logger.debug('Successfully exchanged state token for access token');
          }
          
          // If user data is included in the response, update the auth state
          if (data.user) {
            logger.debug('User data received from database via token exchange response', {
              userId: data.user.id.substring(0, 6) + '...',
              auth0Id: data.user.auth0Id?.substring(0, 6) + '...',
              hasEmail: !!data.user.email,
              role: data.user.role
            });
            
            setAuthState(prevState => ({
              ...prevState,
              user: data.user,
              isAuthenticated: true,
              isLoading: false
            }));
          }
        } catch (error) {
          logger.error('Failed to exchange state token:', error);
          setAuthState(prevState => ({
            ...prevState,
            isLoading: false
          }));
        }
      })();
      
      // Clean up the URL to avoid confusion
      const url = new URL(window.location.href);
      url.searchParams.delete('state_token');
      window.history.replaceState({}, document.title, url.toString());
      
      // After token exchange, fetch user profile information immediately
      // to ensure it's available when rendering Dashboard component
      // (async () => {
      //   try {
      //     if (latestAccessToken.current) {
      //       logger.debug('Fetching user profile after token exchange');
      //       const response = await fetch('/api/auth/profile', {
      //         headers: {
      //           'Authorization': `Bearer ${latestAccessToken.current}`
      //         },
      //         credentials: 'include'
      //       });
            
      //       if (response.ok) {
      //         const data = await response.json();
      //         logger.debug('User profile fetched successfully', {
      //           hasUserData: !!data?.data?.user
      //         });
              
      //         // Update auth state with user information
      //         setAuthState(prevState => ({
      //           ...prevState,
      //           user: data?.data?.user || null
      //         }));
      //       }
      //     }
      //   } catch (error) {
      //     logger.error('Failed to fetch user profile after token exchange:', error);
      //   }
      // })();
    }
  }, [location, setAccessToken]); // This will re-run whenever the URL changes

  const checkAuth = async () => {
    logger.debug('Checking authentication status');
    try {
      // First, check if we have cookies - show actual cookie content in dev mode
      const cookiesAvailable = document.cookie ? 'Yes' : 'No';
      logger.debug('Cookies available:', cookiesAvailable);
      
      if (process.env.NODE_ENV !== 'production') {
        const cookies = document.cookie.split(';').map(c => c.trim());
        logger.debug('Cookie details:', { 
          count: cookies.length,
          names: cookies.map(c => c.split('=')[0])
        });
      }
      
      const response = await fetch('/api/auth/check', {
        credentials: 'include', // Include cookies in the request
        headers: {
          'Cache-Control': 'no-cache' // Prevent caching
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to check authentication status: ${response.status}`);
      }
      
      const jsonResponse = await response.json();
      
      // Log the full response in development mode
      if (process.env.NODE_ENV !== 'production') {
        logger.debug('Auth check full response:', JSON.stringify(jsonResponse, null, 2));
      } else {
        logger.debug('Auth check response:', jsonResponse);
      }
      
      const { data } = jsonResponse;
      
      // Show more detailed debug info
      logger.debug('Auth check details:', {
        hasRefreshToken: data?.hasRefreshToken || false,
        tokenValid: data?.tokenValid || false,
        isAuthenticated: data?.isAuthenticated || false
      });
      
      const isAuthenticated = data?.isAuthenticated || false;
      
      // Only update state if authentication status has changed
      setAuthState(prevState => {
        // Check if auth status has changed or user data has changed
        const authChanged = prevState.isAuthenticated !== isAuthenticated;
        const userChanged = JSON.stringify(prevState.user) !== JSON.stringify(data?.user);
        
        if (authChanged || userChanged || prevState.isLoading) {
          logger.info(`Authentication status ${authChanged ? 'changed' : 'unchanged'}: ${isAuthenticated ? 'Authenticated' : 'Not authenticated'}`);
          
          return {
            isAuthenticated,
            isLoading: false,
            user: data?.user || null,
            accessToken: prevState.accessToken,
            tokenExpiresAt: prevState.tokenExpiresAt
          };
        }
        
        // No change, return previous state to avoid re-renders
        return prevState;
      });

      return isAuthenticated;
    } catch (error) {
      logger.error('Auth check failed:', error);
      // Preserve the access token when auth check fails
      setAuthState(prevState => {
        // Only update if we're changing from authenticated to not authenticated
        if (prevState.isAuthenticated || prevState.isLoading) {
          return {
            isAuthenticated: false,
            isLoading: false,
            user: null,
            accessToken: prevState.accessToken, // Keep existing token
            tokenExpiresAt: prevState.tokenExpiresAt
          };
        }
        return prevState;
      });
      return false;
    }
  };

  useEffect(() => {
    // Check authentication status on component mount
    checkAuth();
  }, []);

  // Refresh token function
  const refreshToken = async (): Promise<boolean> => {
    try {
      logger.debug('Attempting to refresh token');
      
      // Clear any existing refresh timer since we're refreshing now
      clearTokenRefreshTimer();
      
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        logger.error(`Token refresh failed with status ${response.status}`);
        return false;
      }

      const data = await response.json();
      if (data.accessToken) {
        logger.debug('Token refreshed successfully');
        setAccessToken(data.accessToken);
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Error refreshing token:', error);
      return false;
    }
  };

  // Enhanced authenticated fetch with token refresh capability
  const authenticatedFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    // Start with the provided options or empty object
    const fetchOptions: RequestInit = { ...options };

    // Add credentials to include cookies
    fetchOptions.credentials = 'include';

    // Initialize headers if not provided
    if (!fetchOptions.headers) {
      fetchOptions.headers = {};
    }

    // Use the ref for the latest token instead of state to avoid closure issues
    const token = latestAccessToken.current;

    // Log state for debugging
    logger.debug('authenticatedFetch called:', {
      url,
      hasAccessToken: !!token,
      accessTokenLength: token ? token.length : 0,
      stateAccessToken: authState.accessToken ? 'present' : 'missing',
      isAuthenticated: authState.isAuthenticated
    });

    // Add Authorization header if we have a token
    if (token) {
      (fetchOptions.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
      logger.debug(`Adding Authorization header for request to ${url}`);
    } else {
      logger.warn(`No access token available for request to ${url}`);
    }

    try {
      // Check if token is expired before making the request
      if (authState.tokenExpiresAt && Date.now() > authState.tokenExpiresAt - (60 * 1000)) {
        logger.debug('Token expired or about to expire, refreshing before request');
        await refreshToken();
        
        // Update the token in the request headers
        const newToken = latestAccessToken.current;
        if (newToken) {
          (fetchOptions.headers as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
        }
      }
      
      // Make the request
      const response = await fetch(url, fetchOptions);
      
      // If the response is unauthorized and we haven't already tried to refresh
      if (response.status === 401 && !url.includes('/api/auth/refresh')) {
        logger.debug('Received 401, attempting token refresh');
        
        // Try to refresh the token
        const refreshed = await refreshToken();
        
        if (refreshed) {
          // Update the token in the headers with the new one
          const newToken = latestAccessToken.current;
          if (newToken) {
            logger.debug('Retrying request with new token');
            (fetchOptions.headers as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
            
            // Retry the request with the new token
            return fetch(url, fetchOptions);
          }
        }
      }
      
      return response;
    } catch (error) {
      logger.error(`Fetch error for ${url}:`, error);
      throw error;
    }
  };

  // Redirect to login if not authenticated
  const ProtectedRoute = ({ component: Component, ...rest }: any) => {
    logger.debug(`ProtectedRoute (${rest.path}) - auth state:`, {
      isLoading: authState.isLoading,
      isAuthenticated: authState.isAuthenticated,
      hasAccessToken: !!authState.accessToken,
      accessTokenLength: authState.accessToken ? authState.accessToken.length : 0
    });
    
    return (
      <Route
        {...rest}
        render={(props) => {
          if (authState.isLoading) {
            logger.debug(`Loading state for protected route: ${rest.path}`);
            return <div className="loading">Loading authentication status...</div>;
          }
          
          if (authState.isAuthenticated) {
            logger.debug(`User authenticated, rendering protected route: ${rest.path} with accessToken:`, {
              hasToken: !!authState.accessToken,
              tokenLength: authState.accessToken ? authState.accessToken.length : 0
            });
            // Make sure we're passing a user object that matches UserProfileResponse['user']
            return <Component 
              {...props} 
              authenticatedFetch={authenticatedFetch} 
              user={authState.user} 
            />;
          }
          
          logger.debug(`User not authenticated, redirecting to homepage from: ${rest.path}`);
          return <Redirect to={{ pathname: "/", state: { from: props.location } }} />;
        }}
      />
    );
  };

  // Redirect to dashboard if already authenticated
  const GuestRoute = ({ component: Component, ...rest }: any) => {
    logger.debug(`GuestRoute (${rest.path}) - auth state:`, {
      isLoading: authState.isLoading, 
      isAuthenticated: authState.isAuthenticated
    });
    
    return (
      <Route
        {...rest}
        render={(props) => {
          if (authState.isLoading) {
            logger.debug(`Loading state for guest route: ${rest.path}`);
            return <div className="loading">Loading authentication status...</div>;
          }
          
          if (!authState.isAuthenticated) {
            logger.debug(`User not authenticated, rendering guest route: ${rest.path}`);
            return <Component {...props} />;
          }
          
          logger.debug(`User authenticated, redirecting to dashboard from: ${rest.path}`);
          return <Redirect to="/dashboard" />;
        }}
      />
    );
  };

  // Home page component
  const HomePage: React.FC = () => {
    const handleLogin = () => {
      window.location.href = '/api/auth/login';
    };

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="max-w-md w-full px-6 py-8 bg-white shadow-md rounded-lg">
          <h1 className="text-3xl font-bold text-center mb-6">YouTube RAG Widget</h1>
          <p className="text-gray-600 text-center mb-8">
            A SaaS service that enables YouTube content creators to add an AI-powered Q&A widget to their websites.
          </p>
          <div className="flex justify-center">
            <button
              onClick={handleLogin}
              className="btn btn-primary px-8 py-3 text-lg"
            >
              Log In / Sign Up
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <Router>
      {/* Debug bar in development mode */}
      {process.env.NODE_ENV !== 'production' && (
        <div style={{ 
          position: 'fixed', 
          bottom: 0, 
          left: 0, 
          right: 0, 
          backgroundColor: '#f0f0f0',
          padding: '5px 10px',
          fontSize: '12px',
          zIndex: 9999
        }}>
          Auth status: {authState.isLoading ? 'Loading...' : (authState.isAuthenticated ? 'Authenticated' : 'Not authenticated')}
          &nbsp;|&nbsp;
          Token expires: {authState.tokenExpiresAt ? new Date(authState.tokenExpiresAt).toLocaleTimeString() : 'N/A'}
          &nbsp;|&nbsp;
          Path: {window.location.pathname}
          &nbsp;|&nbsp;
          <button onClick={() => checkAuth()} style={{ textDecoration: 'underline' }}>
            Refresh auth
          </button>
          &nbsp;|&nbsp;
          <button onClick={refreshToken} style={{ textDecoration: 'underline' }}>
            Refresh token
          </button>
          &nbsp;|&nbsp;
          <button 
            onClick={() => {
              clearTokenRefreshTimer();
              fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
                .then(() => window.location.href = 'http://localhost:3003')
                .catch(err => console.error('Logout failed:', err));
            }} 
            style={{ textDecoration: 'underline' }}
          >
            Logout
          </button>
        </div>
      )}
      
      {/* Wrap the entire application with providers to ensure shared connections */}
      <VideoProcessingProvider>
        {/* Add SignalRProvider with getAuthToken function */}
        <SignalRProvider getAuthToken={async () => {
          // Try to use the existing access token from state/ref
          if (latestAccessToken.current) {
            return latestAccessToken.current;
          }
          
          // If no token, try to refresh
          logger.debug('No token available for SignalR, refreshing');
          const success = await refreshToken();
          if (success && latestAccessToken.current) {
            return latestAccessToken.current;
          }
          
          // If refresh failed, try auth check as fallback
          logger.debug('Token refresh failed, trying auth check');
          await checkAuth();
          
          // Return whatever token we have now, might still be null
          return latestAccessToken.current || '';
        }}>
          <Switch>
            <GuestRoute exact path="/" component={HomePage} />
            <ProtectedRoute exact path="/dashboard" component={Dashboard} />
            <ProtectedRoute exact path="/channels" component={() => {
              const ChannelsPage = React.lazy(() => import('./channels'));
              return (
                <React.Suspense fallback={<div>Loading channels page...</div>}>
                  <ChannelsPage authenticatedFetch={authenticatedFetch} user={authState.user} />
                </React.Suspense>
              );
            }} />
            <ProtectedRoute path="/channels/new" component={AddChannelButton} />
            <ProtectedRoute exact path="/channels/:channelId" component={(props: any) => {
              const ChannelDetailPage = React.lazy(() => import('./channels/detail'));
              return (
                <React.Suspense fallback={<div>Loading channel details...</div>}>
                  <ChannelDetailPage 
                    {...props} 
                    authenticatedFetch={authenticatedFetch} 
                    user={authState.user} 
                  />
                </React.Suspense>
              );
            }} />

            <ProtectedRoute path="/channels/:channelId/chat" component={(props: any) => {
              const ChannelChat = React.lazy(() => import('./channels/chat'));
              return (
                <React.Suspense fallback={<div>Loading channel chat...</div>}>
                  <ChannelChat 
                    {...props} 
                    authenticatedFetch={authenticatedFetch} 
                    user={authState.user} 
                  />
                </React.Suspense>
              );
            }} />
            
            {/* Catch all route - useful for debugging */}
            <Route path="*" render={props => {
              logger.warn(`Accessed unknown route: ${props.location.pathname}`);
              return <Redirect to="/" />;
            }} />
          </Switch>
        </SignalRProvider>
      </VideoProcessingProvider>
    </Router>
  );
};

export default App;