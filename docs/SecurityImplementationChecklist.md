# Security Implementation Checklist

This document provides a systematic checklist for implementing security enhancements to the YouTube RAG Widget application. Each phase contains specific tasks that should be completed sequentially.

## Phase 1: Assessment and Planning

- [x] Identify security vulnerabilities
- [x] Document current authentication flow
- [x] Create security enhancement plan
- [ ] Review plan with team
- [ ] Set up project tracking
- [ ] Establish testing environments

## Phase 2: Server-Side Auth Improvements

### Auth Server Changes (test-landing-page)

- [ ] Update Auth0 configuration
  - [ ] Enable PKCE
  - [ ] Configure appropriate token lifetimes
  - [ ] Review callback URLs

- [ ] Modify Auth0 callback handler
  - [ ] Store refresh tokens in HttpOnly cookies
    ```javascript
    // Set secure HttpOnly cookie for refresh token
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    ```
  - [ ] Generate one-time state token for redirect
    ```javascript
    // Generate state token with expiration
    const stateToken = crypto.randomBytes(32).toString('hex');
    const stateTokenExp = Date.now() + (5 * 60 * 1000); // 5 minutes
    
    // Store in server-side session
    req.session.stateToken = {
      value: stateToken,
      exp: stateTokenExp
    };
    ```
  - [ ] Remove tokens from URL redirect

- [ ] Create secure token exchange endpoint
  - [ ] Create `/api/auth/token-exchange` endpoint
  - [ ] Implement one-time state token validation
  - [ ] Return short-lived access token via secure response

- [ ] Implement token refresh endpoint
  - [ ] Create `/api/auth/refresh` endpoint
  - [ ] Use HttpOnly refresh token cookie
  - [ ] Implement Auth0 token refresh flow
  - [ ] Return new access token

- [ ] Add CSRF protection middleware
  - [ ] Generate CSRF tokens
  - [ ] Add validation middleware
  - [ ] Include CSRF token in responses

- [ ] Update server.js with appropriate security headers
  - [ ] Content-Security-Policy
  - [ ] X-Content-Type-Options
  - [ ] X-Frame-Options
  - [ ] Referrer-Policy

## Phase 3: API Security Enhancements

### Enhanced Token Validation (rag-widget)

- [ ] Update JWT validation middleware
  - [ ] Enhance signature verification
    ```typescript
    // Update JWT middleware configuration
    const validateJwt = jwt({
      secret: jwksRsa.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`
      }),
      audience: process.env.AUTH0_AUDIENCE,
      issuer: `https://${process.env.AUTH0_DOMAIN}/`,
      algorithms: ['RS256']
    });
    ```
  - [ ] Add comprehensive validation checks
    ```typescript
    // Additional validation middleware
    const validateTokenClaims = (req, res, next) => {
      // Check expiration explicitly
      const tokenData = req.auth;
      const now = Math.floor(Date.now() / 1000);
      
      if (!tokenData.exp || tokenData.exp < now) {
        return res.status(401).json({
          status: 'error',
          message: 'Token expired'
        });
      }
      
      // Validate scopes based on route
      const path = req.path;
      const method = req.method;
      
      // Add route-specific scope validation
      // ...
      
      next();
    };
    ```

- [ ] Implement proper CORS configuration
  - [ ] Update CORS settings in app.ts
    ```typescript
    const corsOptions = {
      origin: [
        process.env.ADMIN_PORTAL_URL,
        process.env.WIDGET_DOMAIN
      ],
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
      credentials: true,
      maxAge: 86400
    };
    app.use(cors(corsOptions));
    ```

- [ ] Add CSRF protection
  - [ ] Create CSRF middleware
  - [ ] Add CSRF validation to state-changing routes
  - [ ] Implement double-submit cookie pattern

- [ ] Add rate limiting
  - [ ] Implement rate limiting middleware
  - [ ] Configure appropriate limits for different endpoints
  - [ ] Add response headers for rate limit info

## Phase 4: Client-Side Security Improvements

### Admin Portal Authentication (rag-widget)

- [ ] Update authentication flow
  - [ ] Remove URL hash extraction logic
    ```typescript
    // Remove this code
    useEffect(() => {
      const hash = window.location.hash;
      if (hash) {
        const tokens = hash.substring(1).split('&').reduce((result, item) => {
          const parts = item.split('=');
          result[parts[0]] = parts[1];
          return result;
        }, {});
        
        if (tokens.access_token) {
          setAuthToken(tokens.access_token);
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
    }, []);
    ```
  
  - [ ] Implement token exchange with one-time state token
    ```typescript
    // New code to exchange state token for access token
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
  
  - [ ] Store access tokens only in memory
    ```typescript
    // In AuthContext.tsx
    const [accessToken, setAccessToken] = useState<string | null>(null);
    // Do NOT store in localStorage
    ```

- [ ] Implement token refresh mechanism
  - [ ] Create automatic refresh based on token expiration
    ```typescript
    // Token refresh mechanism
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
        const response = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include' // Important for sending cookies
        });
        
        if (!response.ok) throw new Error('Refresh failed');
        
        const { accessToken } = await response.json();
        setAccessToken(accessToken);
      } catch (error) {
        console.error('Token refresh failed:', error);
        // Handle refresh failure - redirect to login
        logout();
      }
    };
    ```

- [ ] Add CSRF token handling
  - [ ] Fetch CSRF token on app initialization
  - [ ] Include CSRF token in all state-changing requests
    ```typescript
    // Fetch CSRF token
    const fetchCsrfToken = async () => {
      try {
        const response = await fetch('/api/auth/csrf-token', {
          credentials: 'include'
        });
        
        if (!response.ok) throw new Error('Failed to fetch CSRF token');
        
        const { csrfToken } = await response.json();
        setCsrfToken(csrfToken);
      } catch (error) {
        console.error('CSRF token fetch failed:', error);
      }
    };
    
    // Use CSRF token in requests
    const apiClient = axios.create({
      baseURL: '/api',
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Add interceptor to include CSRF token
    apiClient.interceptors.request.use(config => {
      // Add CSRF token to mutation requests
      if (['post', 'put', 'delete', 'patch'].includes(config.method?.toLowerCase() || '')) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
      
      // Add auth token to all requests
      if (accessToken) {
        config.headers['Authorization'] = `Bearer ${accessToken}`;
      }
      
      return config;
    });
    ```

## Phase 5: Testing and Validation

### Security Testing

- [ ] Create authentication flow tests
  - [ ] Test token exchange flow
  - [ ] Test token refresh mechanism
  - [ ] Test authentication persistence

- [ ] Implement security vulnerability tests
  - [ ] Test for URL history leakage
  - [ ] Simulate XSS attacks
  - [ ] Simulate CSRF attacks

- [ ] Validate security headers
  - [ ] Use security scanning tools
  - [ ] Verify HTTP headers manually

### Functional Testing

- [ ] Test login flow end-to-end
  - [ ] New user registration
  - [ ] Existing user login
  - [ ] Edge cases (expired tokens, invalid tokens)

- [ ] Test API access with new auth flow
  - [ ] Protected routes
  - [ ] Public routes
  - [ ] Permission-based access

- [ ] Test widget embedding
  - [ ] With authenticated users
  - [ ] Cross-origin functionality

## Phase 6: Deployment Strategy

### Staged Rollout

- [ ] Deploy to development environment
  - [ ] Update Auth Server
  - [ ] Update Admin Portal
  - [ ] Update API services

- [ ] Deploy to staging environment
  - [ ] Conduct security testing
  - [ ] Validate all functionality
  - [ ] Collect feedback

- [ ] Production deployment
  - [ ] Prepare rollback plan
  - [ ] Deploy during low-traffic period
  - [ ] Monitor authentication metrics

### Post-Deployment

- [ ] Monitor for issues
  - [ ] Set up authentication failure alerts
  - [ ] Watch for unusual patterns
  - [ ] Monitor performance impact

- [ ] Document changes
  - [ ] Update API documentation
  - [ ] Update security documentation
  - [ ] Create internal implementation guide

- [ ] Plan security review cycle
  - [ ] Schedule regular security audits
  - [ ] Set up automated vulnerability scanning