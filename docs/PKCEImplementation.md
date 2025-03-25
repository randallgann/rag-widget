# PKCE Implementation Plan

This document outlines the implementation plan for enabling PKCE (Proof Key for Code Exchange) in the RAG Widget authentication flow.

## Overview

PKCE is an extension to the OAuth 2.0 Authorization Code Flow that provides additional security for public clients. It prevents authorization code interception attacks by using a code challenge and verifier mechanism.

## Implementation Phases

### 1. Update Auth0 Configuration

1. **Enable PKCE in Auth0 Dashboard** ⏳ (Pending)
   - In Auth0 dashboard, navigate to your application settings
   - Ensure "Authorization Code Flow with PKCE" is enabled
   - Save changes

2. **Enable and Configure Refresh Token Rotation** ⏳ (Pending)
   - In Auth0 dashboard, navigate to your application settings
   - Enable "Refresh Token Rotation"
   - Configure refresh token expiration:
     - Set "Absolute Expiration" to 30 days (or appropriate value for your use case)
     - Set "Idle Expiration" to 7 days (or appropriate value for your use case)
   - Enable "Use Auth0 stored properties" to maintain consistent refresh token behavior
   - Save changes

### 2. Update Auth0 Service

1. **Modify `auth0Service.ts` to support PKCE code exchange** ✅ (Completed)
   ```typescript
   // Add a new method for code exchange with PKCE
   async exchangeCodeWithPKCE(code: string, redirectUri: string, codeVerifier: string) {
     try {
       return await this.authentication.oauth.authorizationCodeGrant({
         code,
         redirect_uri: redirectUri,
         code_verifier: codeVerifier // Add code verifier for PKCE
       });
     } catch (error) {
       logger.error(`Error exchanging code for tokens with PKCE: ${error}`);
       throw error;
     }
   }
   ```

### 3. Create PKCE Helper Functions

1. **Create a new utility file `pkceUtils.ts` in the utils directory** ✅ (Completed)
   ```typescript
   import crypto from 'crypto';

   // Generate a random string for the code verifier
   export function generateCodeVerifier(length: number = 43): string {
     const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
     let result = '';
     const randomValues = crypto.randomBytes(length);
     for (let i = 0; i < length; i++) {
       result += charset.charAt(randomValues[i] % charset.length);
     }
     return result;
   }

   // Generate code challenge from verifier using S256 method
   export function generateCodeChallenge(codeVerifier: string): string {
     const hash = crypto.createHash('sha256')
       .update(codeVerifier)
       .digest('base64')
       .replace(/\+/g, '-')
       .replace(/\//g, '_')
       .replace(/=/g, '');
     return hash;
   }
   ```

### 4. Update Auth Controller & Middleware

1. **Modify the auth controller to use PKCE when initiating the auth flow**
   ```typescript
   // Create a login route handler that generates PKCE challenge
   export const initiateLogin = (req: Request, res: Response) => {
     const codeVerifier = generateCodeVerifier();
     const codeChallenge = generateCodeChallenge(codeVerifier);
     
     // Store the code verifier in session/secured cookie to use later
     req.session.codeVerifier = codeVerifier;
     
     // Generate state for CSRF protection
     const state = crypto.randomBytes(16).toString('hex');
     req.session.authState = state;
     
     // Construct Auth0 authorization URL with PKCE parameters
     const authUrl = `https://${config.auth.auth0.domain}/authorize?` +
       `response_type=code&` +
       `client_id=${config.auth.auth0.clientId}&` +
       `redirect_uri=${encodeURIComponent(config.auth.auth0.callbackUrl)}&` +
       `scope=openid%20profile%20email&` +
       `state=${state}&` +
       `code_challenge=${codeChallenge}&` +
       `code_challenge_method=S256`;
     
     res.redirect(authUrl);
   };
   ```

2. **Update the callback handler to use PKCE when exchanging the code**
   ```typescript
   export const handleCallback = async (req: Request, res: Response, next: NextFunction) => {
     try {
       const { code, state } = req.query;
       
       // Verify state to prevent CSRF
       if (state !== req.session.authState) {
         throw new AppError('Invalid state parameter', 400);
       }
       
       // Get the code verifier from session
       const codeVerifier = req.session.codeVerifier;
       if (!codeVerifier) {
         throw new AppError('Code verifier not found', 400);
       }
       
       // Exchange code for tokens using PKCE
       const tokenResponse = await auth0Service.exchangeCodeWithPKCE(
         code as string,
         config.auth.auth0.callbackUrl,
         codeVerifier
       );
       
       // Clear the code verifier and state from session
       delete req.session.codeVerifier;
       delete req.session.authState;
       
       // Store refresh token in HttpOnly cookie
       res.cookie('refresh_token', tokenResponse.refresh_token, {
         httpOnly: true,
         secure: process.env.NODE_ENV === 'production',
         sameSite: 'strict',
         maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
       });
       
       // Generate one-time state token for redirect
       const stateToken = crypto.randomBytes(32).toString('hex');
       const stateTokenExp = Date.now() + (5 * 60 * 1000); // 5 minutes
       
       // Store in server-side session
       req.session.stateToken = {
         value: stateToken,
         exp: stateTokenExp,
         accessToken: tokenResponse.access_token
       };
       
       // Redirect to admin portal with only the state token (no sensitive tokens in URL)
       res.redirect(`${frontendUrl}?state_token=${stateToken}`);
     } catch (error) {
       next(error);
     }
   };
   ```

### 5. Create Secure Token Exchange Endpoint

1. **Create a new endpoint for exchanging the state token for access token**
   ```typescript
   export const exchangeStateToken = async (req: Request, res: Response, next: NextFunction) => {
     try {
       const { stateToken } = req.body;
       
       // Verify state token exists in session
       if (!req.session.stateToken || 
           req.session.stateToken.value !== stateToken) {
         throw new AppError('Invalid state token', 401);
       }
       
       // Check expiration
       if (Date.now() > req.session.stateToken.exp) {
         delete req.session.stateToken;
         throw new AppError('State token expired', 401);
       }
       
       // Get access token from session
       const accessToken = req.session.stateToken.accessToken;
       
       // Clear state token after use (one-time use)
       delete req.session.stateToken;
       
       // Return access token
       return res.json({
         accessToken
       });
     } catch (error) {
       next(error);
     }
   };
   ```

### 6. Implement Token Refresh Endpoint with Rotation Support

1. **Create a token refresh endpoint that handles rotating refresh tokens**
   ```typescript
   export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
     try {
       // Get refresh token from HttpOnly cookie
       const refreshToken = req.cookies.refresh_token;
       
       if (!refreshToken) {
         throw new AppError('No refresh token provided', 401);
       }
       
       // Exchange refresh token for new access token and potentially new refresh token
       const tokenResponse = await auth0Service.refreshToken(refreshToken);
       
       // With refresh token rotation enabled, Auth0 will always return a new refresh token
       // Always update the refresh token cookie with the new value
       if (tokenResponse.refresh_token) {
         res.cookie('refresh_token', tokenResponse.refresh_token, {
           httpOnly: true,
           secure: process.env.NODE_ENV === 'production',
           // Use 'lax' instead of 'strict' to support browsers with strict privacy controls
           // 'lax' is more compatible with Safari ITP and other privacy features
           sameSite: 'lax',
           maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days (matching Auth0 absolute expiration)
         });
       } else {
         // If no new refresh token is returned (unexpected with rotation enabled),
         // log the issue and continue with the existing token
         logger.warn('No refresh token returned during token refresh');
       }
       
       // Return new access token
       return res.json({
         accessToken: tokenResponse.access_token
       });
     } catch (error) {
       // If refresh token is invalid, expired, or rotation limit reached
       if (error.name === 'invalid_grant' || error.status === 400) {
         // Clear the invalid refresh token cookie
         res.clearCookie('refresh_token');
         return next(new AppError('Session expired. Please log in again.', 401));
       }
       next(error);
     }
   };
   ```

2. **Add fallback mechanism for browsers with strict cookie policies**
   ```typescript
   export const refreshTokenFallback = async (req: Request, res: Response, next: NextFunction) => {
     try {
       // This endpoint is used when cookies aren't available (e.g., in cross-origin iframes)
       // It requires a more complex validation to prevent misuse
       
       // Get the current access token from the Authorization header
       const authHeader = req.headers.authorization;
       if (!authHeader || !authHeader.startsWith('Bearer ')) {
         throw new AppError('Valid access token required', 401);
       }
       
       const accessToken = authHeader.split(' ')[1];
       
       // Validate the current access token first
       const tokenData = await auth0Service.verifyAccessToken(accessToken);
       
       // If we can validate the identity, check if we have a server-side session for this user
       const userId = tokenData.sub;
       const sessionData = await getSessionForUser(userId);
       
       if (!sessionData || !sessionData.refreshToken) {
         throw new AppError('No active session found', 401);
       }
       
       // Use the server-side stored refresh token to get a new access token
       const tokenResponse = await auth0Service.refreshToken(sessionData.refreshToken);
       
       // Update the server-side stored refresh token
       if (tokenResponse.refresh_token) {
         await updateUserSession(userId, {
           refreshToken: tokenResponse.refresh_token
         });
       }
       
       // Return only the new access token
       return res.json({
         accessToken: tokenResponse.access_token
       });
     } catch (error) {
       next(error);
     }
   };
   ```

### 7. Add Enhanced Support for Refresh Tokens in Auth0Service

1. **Add a method to refresh tokens with proper handling of rotation** ✅ (Completed)
   ```typescript
   async refreshToken(refreshToken: string) {
     try {
       // Request both access_token and refresh_token in the response
       const response = await this.authentication.oauth.refreshToken({
         refresh_token: refreshToken,
         client_id: config.auth.auth0.clientId,
         client_secret: config.auth.auth0.clientSecret
       });
       
       // Log token refresh for monitoring (without sensitive data)
       logger.info('Token refreshed successfully');
       
       return response;
     } catch (error) {
       // Classify and log errors for better debugging
       if (error.name === 'invalid_grant') {
         logger.warn('Refresh token invalid or expired during refresh attempt');
       } else {
         logger.error(`Error refreshing token: ${error.message}`);
       }
       throw error;
     }
   }
   ```

2. **Add helper method to handle token rotation edge cases** ✅ (Completed)
   ```typescript
   async handleTokenRotationFailure(userId: string) {
     try {
       // This method is used when token rotation fails or reaches limits
       // We can trigger a silent re-authentication or notify the user
       
       // Get the existing user session
       const userSession = await getUserSession(userId);
       
       // Mark session for re-authentication
       await updateUserSession(userId, {
         requiresReauth: true,
         reauthReason: 'token_rotation_limit'
       });
       
       // Return info for client-side handling
       return {
         requiresReauth: true,
         message: 'Please re-authenticate to continue'
       };
     } catch (error) {
       logger.error(`Error handling token rotation failure: ${error.message}`);
       throw error;
     }
   }
   ```

### 8. Update Frontend Authentication Flow for Refresh Token Rotation

1. **Update React frontend to exchange state token for access token**
   ```typescript
   // In AuthContext.tsx or similar component
   useEffect(() => {
     // Extract state token from URL query parameter
     const urlParams = new URLSearchParams(window.location.search);
     const stateToken = urlParams.get('state_token');
     
     if (stateToken) {
       // Clear the URL parameter
       window.history.replaceState(null, '', window.location.pathname);
       
       // Exchange for access token
       exchangeStateToken(stateToken);
     }
   }, []);
   
   const exchangeStateToken = async (stateToken) => {
     try {
       const response = await fetch('/api/auth/token-exchange', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ stateToken }),
         credentials: 'include' // Important for cookies
       });
       
       if (!response.ok) throw new Error('Token exchange failed');
       
       const { accessToken } = await response.json();
       setAccessToken(accessToken);
     } catch (error) {
       console.error('Authentication error:', error);
       // Handle authentication failure
     }
   };
   ```

2. **Implement enhanced token refresh mechanism with rotation support**
   ```typescript
   // Token refresh mechanism with rotation support
   useEffect(() => {
     if (!accessToken) return;
     
     // Decode token to get expiration
     const tokenData = decodeJwt(accessToken);
     const expiresAt = tokenData.exp * 1000; // Convert to milliseconds
     const timeUntilExpiry = expiresAt - Date.now();
     
     // Refresh 5 minutes before expiration
     const refreshBuffer = 5 * 60 * 1000;
     const refreshTime = Math.max(0, timeUntilExpiry - refreshBuffer);
     
     const refreshTimer = setTimeout(refreshAccessToken, refreshTime);
     return () => clearTimeout(refreshTimer);
   }, [accessToken]);
   
   const refreshAccessToken = async () => {
     try {
       // First attempt regular refresh with cookies
       const response = await fetch('/api/auth/refresh', {
         method: 'POST',
         credentials: 'include' // Important for sending cookies
       });
       
       if (response.ok) {
         const { accessToken } = await response.json();
         setAccessToken(accessToken);
         return;
       }
       
       // If cookie-based refresh fails, try fallback method
       // This helps in environments with strict cookie policies (Safari ITP, Firefox ETP)
       if (response.status === 401) {
         await attemptFallbackRefresh();
       } else {
         throw new Error(`Refresh failed with status: ${response.status}`);
       }
     } catch (error) {
       console.error('Token refresh failed:', error);
       // Check if we need to re-authenticate
       if (error.message?.includes('re-authenticate')) {
         // Silent re-authentication if possible
         attemptSilentAuth();
       } else {
         // Handle refresh failure - redirect to login
         logout();
       }
     }
   };
   
   // Fallback refresh for browsers with strict cookie policies
   const attemptFallbackRefresh = async () => {
     try {
       if (!accessToken) {
         throw new Error('No access token available for fallback refresh');
       }
       
       const response = await fetch('/api/auth/refresh-fallback', {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${accessToken}`
         }
       });
       
       if (!response.ok) {
         throw new Error('Fallback refresh failed');
       }
       
       const { accessToken: newAccessToken } = await response.json();
       setAccessToken(newAccessToken);
     } catch (error) {
       console.error('Fallback refresh failed:', error);
       throw error;
     }
   };
   
   // Try silent re-authentication for cases where refresh token has rotated too many times
   const attemptSilentAuth = async () => {
     try {
       // Use a hidden iframe to attempt silent auth with Auth0
       // This can work if the user still has an active SSO session with Auth0
       const authClient = await createAuth0Client({
         domain: config.auth0Domain,
         client_id: config.auth0ClientId,
         useRefreshTokens: true
       });
       
       await authClient.checkSession();
       const token = await authClient.getTokenSilently();
       
       // If successful, update the token
       if (token) {
         setAccessToken(token);
         return true;
       }
     } catch (error) {
       console.error('Silent authentication failed:', error);
       // If silent auth fails, redirect to login
       logout();
       return false;
     }
   };
   ```

3. **Store access token in memory only and handle browser privacy behaviors**
   ```typescript
   // In AuthContext.tsx
   const [accessToken, setAccessToken] = useState<string | null>(null);
   
   // Do NOT store in localStorage or sessionStorage
   
   // Detect browser privacy settings that might affect cookies
   useEffect(() => {
     // Test if cookies are working properly
     checkCookieSupport();
   }, []);
   
   const checkCookieSupport = async () => {
     try {
       // Set a test cookie
       document.cookie = "test_cookie=1; SameSite=Lax; Path=/";
       
       // Check if cookie was set successfully
       const hasCookie = document.cookie.includes("test_cookie=1");
       
       if (!hasCookie) {
         console.warn("Cookies may be restricted by browser privacy settings");
         setUsingFallbackMode(true);
       }
       
       // Also check for potential ITP/ETP restrictions
       const isRestrictedBrowser = 
         (navigator.userAgent.includes("Safari") && !navigator.userAgent.includes("Chrome")) ||
         (navigator.userAgent.includes("Firefox") && parseInt(navigator.userAgent.split("Firefox/")[1]) >= 86);
         
       if (isRestrictedBrowser) {
         console.info("Using a browser with potential cookie restrictions, enabling compatibility mode");
         setUsingFallbackMode(true);
       }
     } catch (error) {
       console.error("Error checking cookie support:", error);
     }
   };
   ```

### 9. Update Auth Routes with Refresh Token Rotation Support

1. **Add new routes for token exchange and refresh with fallback support**
   ```typescript
   // In authRoutes.ts
   router.post('/token-exchange', exchangeStateToken);
   router.post('/refresh', refreshToken);
   router.post('/refresh-fallback', refreshTokenFallback);
   
   // Add route for handling token rotation limits
   router.post('/reauth-required', handleReauthRequired);
   ```

2. **Add session storage service for fallback mode** ✅ (Completed)
   ```typescript
   // In sessionService.ts
   
   // Store refresh tokens server-side for fallback mode
   export const storeUserRefreshToken = async (userId: string, refreshToken: string) => {
     try {
       // Use a secure database to store the mapping between user ID and refresh token
       // This is used for browsers where cookies are restricted
       await db.sessions.upsert({
         userId,
         refreshToken,
         lastUsed: new Date(),
         expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
       });
       
       return true;
     } catch (error) {
       logger.error(`Error storing user refresh token: ${error.message}`);
       throw error;
     }
   };
   
   // Get user session for fallback token refresh
   export const getSessionForUser = async (userId: string) => {
     try {
       const session = await db.sessions.findOne({
         userId,
         expiresAt: { $gt: new Date() }
       });
       
       return session;
     } catch (error) {
       logger.error(`Error retrieving user session: ${error.message}`);
       return null;
     }
   };
   
   // Update user session with new refresh token
   export const updateUserSession = async (userId: string, data: any) => {
     try {
       await db.sessions.update(
         { userId },
         { 
           $set: {
             ...data,
             lastUsed: new Date()
           }
         }
       );
       
       return true;
     } catch (error) {
       logger.error(`Error updating user session: ${error.message}`);
       throw error;
     }
   };
   ```

## Testing Plan with Refresh Token Rotation

1. **Unit Tests**
   - ✅ Test PKCE utility functions (Completed)
   - ⏳ Test token validation and refresh logic with rotation (Tests written but need TypeScript fixes)
   - ⏳ Test error handling scenarios for various token rotation cases (Tests written but need TypeScript fixes)
   - ⏳ Test browser compatibility detection logic (Pending)

2. **Integration Tests**
   - Test complete authentication flow from login to token refresh with rotation
   - Test session handling and token storage
   - Test error recovery scenarios
   - Test fallback mechanisms for browsers with strict cookie policies
   - Test silent re-authentication when rotation limits are reached

3. **Browser Compatibility Testing**
   - Test on Safari with Intelligent Tracking Prevention (ITP) enabled
   - Test on Firefox with Enhanced Tracking Protection (ETP) enabled
   - Test on Chrome with third-party cookie blocking enabled
   - Test in cross-origin iframe scenarios
   - Test with various privacy extensions installed

4. **Security Testing**
   - Verify tokens aren't present in URLs or browser storage
   - Test CSRF protection mechanisms
   - Test token expiration handling
   - Test rotation limits and recovery
   - Verify refresh token cannot be reused after rotation

## Implementation Timeline with Refresh Token Rotation

1. **Phase 1: Configuration & Backend Changes (1-2 days)**
   - ⏳ Update Auth0 configuration (Pending)
   - ⏳ Enable and configure Refresh Token Rotation in Auth0 (Pending)
   - ✅ Implement PKCE utilities (Completed)
   - ✅ Update auth0Service.ts with rotation support (Completed)

2. **Phase 2: API Endpoint Implementation (3-4 days)**
   - ✅ Create token exchange endpoint (Completed)
   - ✅ Create token refresh endpoint with rotation support (Completed)
   - ✅ Implement fallback refresh mechanism for privacy-restricted browsers (Completed)
   - ✅ Create session storage service for fallback mode (Completed)
   - ✅ Implement secure token storage (Completed)

3. **Phase 3: Frontend Implementation (3-4 days)**
   - Update authentication flow in frontend
   - Implement token management with rotation support
   - Build browser compatibility detection
   - Implement fallback mechanisms for restricted browsers
   - Update API client for authenticated requests
   - Add silent re-authentication for rotation limit cases

4. **Phase 4: Browser Compatibility Testing (1-2 days)**
   - Test across multiple browsers with various privacy settings
   - Develop and test fallback solutions for problematic browsers
   - Optimize cookie settings for maximum compatibility

5. **Phase 5: Security & Performance Testing (2-3 days)**
   - End-to-end testing of authentication flow with rotation
   - Security testing of token rotation mechanisms
   - Performance testing with simulated high rotation scenarios
   - Verify secure token handling across all flows

Total estimated implementation time: 10-15 days

## Benefits of PKCE Implementation with Refresh Token Rotation

1. **Improved Security**
   - Prevention of authorization code interception attacks
   - No sensitive tokens in URLs or browser history
   - Secure token storage using HttpOnly cookies
   - Protection against CSRF attacks
   - Shorter refresh token lifetimes through rotation
   - Reduced impact if a refresh token is compromised
   - Single refresh token use prevents replay attacks

2. **Better User Experience**
   - Seamless authentication flow with automatic token refresh
   - No session timeouts during active use
   - More robust error handling
   - Better support for modern browsers with privacy controls
   - Graceful fallbacks for restrictive browser environments
   - Silent re-authentication when possible

3. **Browser Compatibility**
   - Works with Safari's Intelligent Tracking Prevention (ITP)
   - Compatible with Firefox's Enhanced Tracking Protection (ETP)
   - Functions correctly with Chrome's third-party cookie restrictions
   - Supports cross-origin scenarios with appropriate fallbacks
   - Future-proof against upcoming browser privacy changes

4. **Compliance**
   - Follows OAuth 2.0 best practices
   - Implements Auth0's recommended patterns for SPAs
   - Improved security posture for compliance requirements
   - Better protection of user data and access tokens
   - Follows principle of least privilege with token expiration

## Conclusion

The implementation of PKCE with Refresh Token Rotation provides a secure, modern authentication solution that works across all browser environments, including those with strict privacy controls. While the implementation requires more effort than a basic PKCE approach, the benefits in security, user experience, and browser compatibility make it worthwhile.

The approach detailed in this plan aligns with Auth0's best practices for SPAs and addresses the specific challenges posed by modern browser privacy features. By implementing both server-side cookie handling and client-side fallback mechanisms, we ensure a seamless experience for all users regardless of their browser choice or privacy settings.

## Current Status

- **Backend Implementation (80% complete)**:
  - ✅ PKCE utilities
  - ✅ Auth0 service with PKCE and token rotation support
  - ✅ Auth controller with PKCE and token rotation support
  - ✅ Session model for fallback token storage
  - ✅ Session service for fallback token storage
  - ✅ Auth routes with PKCE and token rotation support
  - ⏳ Configure Auth0 for PKCE and refresh token rotation

- **Frontend Implementation (0% complete)**:
  - ⏳ Update authentication flow in frontend
  - ⏳ Implement token management with rotation support
  - ⏳ Build browser compatibility detection
  - ⏳ Implement fallback mechanisms for restricted browsers

- **Testing (15% complete)**:
  - ✅ PKCE utility tests
  - ⏳ Auth0 service tests
  - ⏳ Auth controller tests
  - ⏳ Session service tests

## Next Steps

1. Configure Auth0 for PKCE and refresh token rotation
2. Fix TypeScript issues in the tests
3. Implement frontend components and logic
4. Complete testing across different browsers
5. Conduct security review and penetration testing