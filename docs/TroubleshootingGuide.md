# RAG Widget Troubleshooting Guide

This document tracks issues encountered during development and their resolutions. It serves as a reference for common problems and their solutions.

## Authentication Issues

### 1. 401 Unauthorized Errors on Dashboard API Endpoints

**Issue:** After successful authentication with Auth0, API requests to dashboard endpoints like `/api/dashboard/stats` return 401 Unauthorized errors:

```
GET http://localhost:3000/api/dashboard/stats 401 (Unauthorized)
```

**Root Cause:**
The issue stems from the authentication flow not properly completing the token exchange process:

1. The backend successfully authenticates with Auth0 using PKCE
2. The backend stores the refresh token in HttpOnly cookies
3. The backend generates a state token and references the access token in the session
4. The frontend receives the state token in the URL
5. **MISSING STEP:** The frontend doesn't exchange the state token for an access token
6. API calls are made without the required Authorization Bearer header
7. The `validateAuth0Token` middleware rejects the requests with 401

**Solution:**
Implement a complete token exchange flow:

1. Frontend extracts the state token from URL:
```javascript
const urlParams = new URLSearchParams(window.location.search);
const stateToken = urlParams.get('state_token');
```

2. Exchange this token for an access token via a secure POST request:
```javascript
const response = await fetch('/api/auth/exchange-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ stateToken })
});
```

3. Store the access token in memory:
```javascript
const data = await response.json();
setAccessToken(data.accessToken);
```

4. Create a utility function to automatically include the token in API requests:
```javascript
const authenticatedFetch = async (url, options = {}) => {
  const fetchOptions = { ...options, credentials: 'include' };
  if (!fetchOptions.headers) fetchOptions.headers = {};
  
  if (accessToken) {
    fetchOptions.headers['Authorization'] = `Bearer ${accessToken}`;
  }
  
  return fetch(url, fetchOptions);
};
```

5. Use this utility for all API requests:
```javascript
const response = await authenticatedFetch('/api/dashboard/stats');
```

**Status:** Implemented and verified working

### 2. PKCE Authentication Flow Error - Missing `code_verifier` Parameter

**Issue:** When attempting to debug the authentication flow in VSCode, accessing `/api/auth/login` results in the following error:

```json
{
  "status": "error",
  "statusCode": 400,
  "message": "Something went wrong",
  "stack": "invalid_request: {\"error\":\"invalid_request\",\"error_description\":\"Parameter 'code_verifier' is required\"}\n    at fn (/home/rgann/rag-widget/node_modules/rest-facade/src/Client.js:402:25)\n    at Request.callback (/home/rgann/rag-widget/node_modules/superagent/src/node/index.js:924:3)\n    at fn (/home/rgann/rag-widget/node_modules/superagent/src/node/index.js:1153:18)\n    at IncomingMessage.<anonymous> (/home/rgann/rag-widget/node_modules/superagent/src/node/parsers/json.js:19:7)\n    at IncomingMessage.emit (node:events:536:35)\n    at IncomingMessage.emit (node:domain:489:12)\n    at endReadableNT (node:internal/streams/readable:1698:12)\n    at processTicksAndRejections (node:internal/process/task_queues:90:21)"
}
```

**Root Cause:**
The current implementation is not following Auth0's recommended PKCE flow correctly. Two key issues were identified:

1. The `exchangeCodeWithPKCE` method in the Auth0 service is not properly accepting and passing the codeVerifier parameter.

2. More fundamentally, we're using the Auth0 SDK's `authentication.oauth.authorizationCodeGrant` method, but according to the Auth0 documentation, we should be making a direct POST request to the token endpoint with specific parameters.

**Authentication Flow Methods:**
When accessing `/api/auth/login`, the following methods are called in order:

1. Express middleware chain processes the request:
   - Session middleware
   - CORS middleware
   - Helmet security middleware 
   - Request body parsers
   - Cookie parser

2. Route handling:
   - `app.use('/api/auth', authRoutes)` in app.ts
   - `router.get('/login', initiateLogin)` in authRoutes.ts

3. Authentication initialization in authController.ts:
   - `initiateLogin()` - Main handler for the login route
   - `generateCodeVerifier()` - Creates random string for PKCE
   - `generateCodeChallenge()` - Creates SHA-256 hash of verifier
   - Session is updated with code verifier and state
   - Auth0 URL constructed with necessary parameters
   - User redirected to Auth0 login page

4. Callback handling:
   - `handleCallback()` - Processes Auth0 response
   - Code verifier retrieved from session
   - `auth0Service.exchangeCodeWithPKCE()` - Exchanges code for tokens
   - This is where the error occurs since codeVerifier isn't passed

**Solution:**
We need to completely revise the token exchange process to match Auth0's documentation:

1. Replace the `exchangeCodeWithPKCE` method in auth0Service.ts with a direct POST request to the token endpoint:

```typescript
async exchangeCodeWithPKCE(code: string, redirectUri: string, codeVerifier: string): Promise<SignInToken> {
  try {
    // Make a direct POST request to Auth0's token endpoint
    const response = await axios.post(`https://${config.auth.auth0.domain}/oauth/token`, 
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.auth.auth0.clientId,
        code_verifier: codeVerifier,
        code: code,
        redirect_uri: redirectUri
      }), 
      {
        headers: { 'content-type': 'application/x-www-form-urlencoded' }
      }
    );
    
    return response.data;
  } catch (error) {
    logger.error(`Error exchanging code for tokens with PKCE: ${error}`);
    throw error;
  }
}
```

2. Update the call in authController.ts to pass the codeVerifier:

```typescript
const tokenResponse = await auth0Service.exchangeCodeWithPKCE(
  code as string,
  config.auth.auth0.callbackUrl,
  codeVerifier
);
```

**Status:** Pending implementation and verification

---

## VSCode Debugging Issues

### 1. Routes Not Accessible in Debug Mode

**Issue:** When running the application in VSCode debug mode using the "Debug RAG Widget" configuration, routes like `/api/auth/login` return 404 errors, but they work correctly when running with `npm run dev`.

**Root Cause:**
The VSCode debug configuration wasn't properly setting up the application environment for server execution.

**Solution:**
Use the built in vscode Node.js debugging config

## Authentication Debugging Tips

### 1. Checking Authentication Status

If you're encountering authentication issues, the following techniques can help diagnose the problem:

**1. Check Authentication Status Endpoint**
```javascript
const checkAuth = async () => {
  const response = await fetch('/api/auth/check', {
    credentials: 'include'
  });
  const data = await response.json();
  console.log('Auth status:', data);
};
```

**2. Inspect Browser Cookies**
```javascript
// In browser console
document.cookie.split(';').forEach(cookie => console.log(cookie.trim()));
```

**3. Check Request Headers in Browser Dev Tools**
- Open Network tab in Developer Tools
- Make an API request
- Check Request Headers for Authorization header
- Check Response Headers and Status Code

**4. Debug Token Exchange Process**

If you're having issues with token exchange, add this debug code to App.tsx where state_token is extracted:

```javascript
// Debug state token exchange process
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const stateToken = urlParams.get('state_token');
  
  if (stateToken) {
    console.log('State token found:', stateToken);
    
    // Log token exchange process
    (async () => {
      try {
        console.log('Attempting to exchange state token...');
        const response = await fetch('/api/auth/exchange-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ stateToken })
        });
        
        if (!response.ok) {
          console.error('Token exchange failed:', response.status, response.statusText);
          const errorText = await response.text();
          console.error('Error response:', errorText);
          return;
        }
        
        const data = await response.json();
        console.log('Token exchange successful, received access token');
      } catch (error) {
        console.error('Token exchange error:', error);
      }
    })();
  }
}, []);
```

### 2. Authenticating API Requests

Common issues with API authentication can be diagnosed by checking:

**1. Missing Authorization Header**
The most common issue is not including the token in the Authorization header.

**Solution:** Use the authenticatedFetch utility for all API requests:
```javascript
// Always use this pattern for API requests:
const response = await authenticatedFetch('/api/endpoint');
```

**2. Token Expiration**
Access tokens have a limited lifetime (typically 1 hour). If you get 401 errors after a period of use, it may indicate token expiration.

**Solution:** Implement token refresh logic:
```javascript
const refreshAccessToken = async () => {
  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Refresh failed');
    
    const data = await response.json();
    setAccessToken(data.accessToken);
    return data.accessToken;
  } catch (error) {
    console.error('Token refresh failed', error);
    // Redirect to login
    window.location.href = '/api/auth/login';
  }
};
```

**3. Session Issues**
If authentication suddenly fails, it could be due to server-side session expiration.

**Solution:** 
- Check sessionStorage configuration in app.ts
- Increase session lifetime if needed
- Implement automatic re-authentication on session expiration