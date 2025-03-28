import { Request, Response, NextFunction, CookieOptions } from 'express';
import crypto from 'crypto';
import { config } from '../../config/environment';
import { auth0Service } from '../../services/auth/auth0Service';
import { AppError } from '../middlewares/errorHandler';
//import { logger } from '../../config/logger';
import { generateCodeVerifier, generateCodeChallenge, extractPayloadAttributes } from '../../utils/pkceUtils';
import { getSessionForUser, updateUserSession, storeUserRefreshToken } from '../../services/sessionService';
import { userService } from '../../services/userService';

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

declare module "express-session" {
  interface SessionData {
    codeVerifier?: string;
    authState?: string;
    stateToken?: {
      value: string;
      exp: number;
      accessToken: string;
    };
    passport?: {
      user: string;
    };
    user?: {
      id: string;
      nickname: string;
      name: string;
      email: string;
      picture: string;
    }
  }
}

// API service URL for redirecting after authentication
const apiServiceUrl = process.env.API_SERVICE_URL || 'http://localhost:3001';

/**
 * Initialize login flow with PKCE
 */
export const initiateLogin = (req: Request, res: Response) => {
  // Generate PKCE code verifier and challenge
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  
  // Store the code verifier in session to use during callback
  req.session!.codeVerifier = codeVerifier;
  
  // Generate state parameter to prevent CSRF attacks
  const state = crypto.randomBytes(16).toString('hex');
  req.session!.authState = state;
  
  // Construct Auth0 authorization URL with PKCE parameters
  const authUrl = `https://${config.auth.auth0.domain}/authorize?` +
    `response_type=code&` +
    `code_challenge=${codeChallenge}&` +
    `code_challenge_method=S256&` +
    `client_id=${config.auth.auth0.clientId}&` +
    `redirect_uri=${encodeURIComponent(config.auth.auth0.callbackUrl)}&` +
    `scope=openid%20profile%20email%20offline_access&` + // Include offline_access for refresh tokens
    `audience=https://${config.auth.auth0.audience}&` +
    `state=${state}`;
  
  // Redirect user to Auth0 login
  res.redirect(authUrl);
};

/**
 * Handle Auth0 callback after user authentication
 */
export const handleCallback = async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('Auth0 callback received');
    const { code, state } = req.query;
    
    // Log session details for debugging
    logger.debug('Session details', { 
      sessionID: req.sessionID?.substring(0, 6) || 'none',
      hasAuthState: !!req.session?.authState,
      hasCodeVerifier: !!req.session?.codeVerifier
    });
    
    // Verify state to prevent CSRF
    if (state !== req.session?.authState) {
      logger.warn('Invalid state parameter', { 
        receivedState: (state as string)?.substring(0, 6) || 'none',
        expectedState: req.session?.authState?.substring(0, 6) || 'none',
        sessionID: req.sessionID?.substring(0, 6) || 'none'
      });
      throw new AppError('Invalid state parameter', 400);
    }
    
    // Get the code verifier from session
    const codeVerifier = req.session?.codeVerifier;
    if (!codeVerifier) {
      logger.warn('Code verifier not found in session');
      throw new AppError('Code verifier not found', 400);
    }
    
    // Exchange code for tokens using PKCE
    logger.debug('Exchanging authorization code for tokens with codeVerifier');
    const tokenResponse = await auth0Service.exchangeCodeWithPKCE(
      code as string,
      config.auth.auth0.callbackUrl,
      codeVerifier
    );
    
    // Log token received (without sensitive data)
    logger.debug('Token response received', { 
      hasAccessToken: !!tokenResponse.access_token,
      accessToken: tokenResponse.access_token,
      hasIdToken: !!tokenResponse.id_token,
      hasRefreshToken: !!tokenResponse.refresh_token,
      expiresIn: tokenResponse.expires_in || 'not specified'
    });
    
    // Clean up session data
    delete req.session!.codeVerifier;
    delete req.session!.authState;
    
    // Get user ID from the token
    const idTokenPayload = await auth0Service.extractIdToken(tokenResponse);
    const payloadAttributes = extractPayloadAttributes(idTokenPayload);
    
    // Extract user info with fallbacks and ensure it's a string
    const userId = typeof payloadAttributes.sub === 'function' 
      ? payloadAttributes.sub 
      : String(payloadAttributes.sub);
    const userNickName = payloadAttributes.nickname as string || '';
    const userName = payloadAttributes.name as string || userNickName || 'User';
    const userEmail = payloadAttributes.email as string || '';
    const userPicture = payloadAttributes.picture as string || '';
    
    // Debug log auth data
    logger.debug('Auth0 user data extracted:', {
      userId: userId.substring(0, 6) + '...',
      userNickName,
      userName,
      userEmail: userEmail.replace(/(.{3})(.*)(@.*)/, '$1***$3'),
      hasPicture: !!userPicture
    });

    // Log user info (masked)
    logger.debug('User authenticated', {
      userId: userId.substring(0, 6) + '...',
      email: userEmail.replace(/(.{3})(.*)(@.*)/, '$1***$3')
    });
    
    // Store refresh token in HttpOnly cookie
    if (tokenResponse.refresh_token) {
      logger.debug('Setting refresh_token cookie');
      
      // Critical: Ensure cookie settings are correct for browser compatibility
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60 * 1000
      } as CookieOptions;
      
      res.cookie('refresh_token', tokenResponse.refresh_token, cookieOptions);
      logger.debug('Cookie options', cookieOptions);
      
      // Also store in database for fallback mode
      try {
        await storeUserRefreshToken(userId, tokenResponse.refresh_token);
        logger.debug('Refresh token stored in database for user', { userId: userId.substring(0, 6) + '...' });
      } catch (tokenStoreError) {
        logger.error('Failed to store refresh token in database:', tokenStoreError);
        // Continue even if storing fails
      }
    } else {
      logger.warn('No refresh token received from Auth0');
    }
    
    // Generate one-time state token for redirect
    const stateToken = crypto.randomBytes(32).toString('hex');
    const stateTokenExp = Date.now() + (5 * 60 * 1000); // 5 minutes
    
    // Store ONLY the state token in session to support token exchange
    // Do not store user data in session
    req.session!.stateToken = {
      value: stateToken,
      exp: stateTokenExp,
      accessToken: tokenResponse.access_token
    };
    
    
    // Create or update user in our database
    try {
      const user = await userService.findOrCreateUser(userId, userEmail, userName, userPicture);
      logger.info(`User created/updated in database: ${userEmail}`);

    } catch (dbError) {
      logger.error('Failed to create/update user in database:', dbError);
      // Continue the auth flow even if database update fails
    }
    
    // Save session explicitly to ensure it's persisted
    req.session!.save((err) => {
      if (err) {
        logger.error('Error saving session', err);
      } else {
        logger.debug('Session saved successfully');
      }
      
      // Redirect to the dashboard with state token
      const redirectUrl = `${apiServiceUrl}/dashboard?state_token=${stateToken}`;
      logger.info('Redirecting to', { url: redirectUrl });
      res.redirect(redirectUrl);
    });
  } catch (error) {
    logger.error('Error in Auth0 callback', error);
    next(error);
  }
};

/**
 * Exchange state token for access token
 * This allows frontend to securely obtain access token without exposing it in URL
 */
export const exchangeStateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { stateToken } = req.body;
    
    logger.debug('Received token exchange request', { 
      sessionID: req.sessionID?.substring(0, 6) || 'none',
      stateTokenLength: stateToken?.length || 0,
      hasSessionStateToken: !!req.session?.stateToken,
      cookies: Object.keys(req.cookies || {})
    });
    
    // Verify state token exists in session
    if (!req.session!.stateToken || 
        req.session!.stateToken.value !== stateToken) {
      
      logger.error('State token validation failed', {
        sessionHasStateToken: !!req.session?.stateToken,
        sessionTokenValue: req.session?.stateToken?.value?.substring(0, 5) || 'none',
        requestedTokenValue: stateToken?.substring(0, 5) || 'none',
        match: req.session?.stateToken?.value === stateToken
      });
      
      throw new AppError('Invalid state token', 401);
    }
    
    // Check expiration
    if (Date.now() > req.session!.stateToken.exp) {
      logger.error('State token expired', {
        expiration: new Date(req.session!.stateToken.exp).toISOString(),
        now: new Date().toISOString()
      });
      
      delete req.session!.stateToken;
      throw new AppError('State token expired', 401);
    }
    
    // Get access token from session
    const accessToken = req.session!.stateToken.accessToken;
    
    // Validate the access token format before sending it
    logger.debug('Validating access token format');

    // Verify the access token to get the user ID
    const tokenData = await auth0Service.verifyAccessToken(accessToken);
    // Ensure userId is a string by explicitly converting it
    const userId = typeof tokenData.sub === 'function' 
      ? tokenData.sub() 
      : String(tokenData.sub);
    
    logger.debug('Token exchange successful', {
      hasAccessToken: !!accessToken,
      accessTokenLength: accessToken?.length || 0,
      accessTokenPrefix: accessToken ? accessToken.substring(0, 10) + '...' : 'none',
      userId: userId.substring(0, 6) + '...'
    });
    
    // Clear state token after use (one-time use)
    delete req.session!.stateToken;
    
    // Retrieve user data from database instead of session
    const user = await userService.getUserByAuth0Id(userId);

    if (!user) {
      logger.error('User not found in database during token exchange', { 
        userId: userId.substring(0, 6) + '...' 
      });
      throw new AppError('User not found', 404);
    }

    logger.debug('User data retrieved from database', { 
      userId: user.id.substring(0, 6) + '...',
      email: user.email.replace(/(.{3})(.*)(@.*)/, '$1***$3')
    });

    // Prepare user data response (sanitize before sending to client)
    const userData = {
      id: user.id,
      auth0Id: user.auth0Id,
      name: user.name,
      email: user.email,
      role: user.role,
      // Include other fields as needed
      lastLogin: user.lastLogin
    };
    
    // Return access token and user data
    return res.json({
      accessToken,
      user: userData
    });
  } catch (error) {
    logger.error('Token exchange error', { error });
    next(error);
  }
};

/**
 * Refresh access token using refresh token from cookies
 * Supports refresh token rotation
 */
export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined> => {
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
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days (matching Auth0 absolute expiration)
      });
      
      // Also update the server-side stored token for fallback mode
      // Get user ID from access token
      const tokenData = await auth0Service.verifyAccessToken(tokenResponse.access_token);
      if (tokenData && tokenData.sub) {
        await updateUserSession(tokenData.sub as string, {
          refreshToken: tokenResponse.refresh_token
        });
      }
    } else {
      // If no new refresh token is returned (unexpected with rotation enabled),
      // log the issue and continue with the existing token
      logger.warn('No refresh token returned during token refresh');
    }
    
    // Return new access token
    return res.json({
      accessToken: tokenResponse.access_token
    });
  } catch (error: any) {
    // If refresh token is invalid, expired, or rotation limit reached
    if (error.name === 'invalid_grant' || error.status === 400) {
      // Clear the invalid refresh token cookie
      res.clearCookie('refresh_token');
      next(new AppError('Session expired. Please log in again.', 401));
    }
    next(error);
  }
};

/**
 * Fallback refresh token endpoint for browsers with strict cookie policies
 * Uses server-side stored refresh token instead of cookies
 */
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
    const userId = tokenData.sub as string;
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

/**
 * Handle cases where re-authentication is required
 * (e.g., when refresh token rotation limit is reached)
 */
export const handleReauthRequired = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Clean up any existing session data
    res.clearCookie('refresh_token');
    
    // Return a specific response code that the client can detect
    return res.status(401).json({
      status: 'error',
      code: 'REAUTH_REQUIRED',
      message: 'Re-authentication required'
    });
  } catch (error) {
    next(error);
  }
};

// Legacy auth handler for backward compatibility
// Will be deprecated in favor of handleCallback with PKCE
export const handleAuth0Callback = async (req: Request, res: Response, next: NextFunction) => {
  // Redirect to new PKCE handler for now
  logger.warn('Legacy Auth0 callback used, redirecting to PKCE flow');
  return handleCallback(req, res, next);
};

/**
 * Get user profile
 * Keep existing controller method for backward compatibility
 */
export const getUserProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // User ID should be attached by validateAuth0Token middleware
    const userId = req.user!.userId;
    
    // Fetch user profile from Auth0
    const userProfile = await auth0Service.getUserProfile(userId);
    
    // Log the profile structure for debugging
    logger.debug('User profile fetched:', {
      userId: userId.substring(0, 6) + '...',
      hasProfile: !!userProfile,
      profileKeys: userProfile ? Object.keys(userProfile) : []
    });
    
    // Ensure we return a consistent format
    res.json({
      status: 'success',
      data: {
        user: userProfile
      }
    });
  } catch (error) {
    logger.error('Error in getUserProfile:', error);
    next(error);
  }
};

/**
 * Validate token from cookies or Auth header
 * Keep existing controller method for backward compatibility
 */
export const handleTokenValidation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token = '';
    
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
    
    if (!token) {
      throw new AppError('No token provided in handleTokenValidation', 401);
    }
    
    // Verify token
    const tokenData = await auth0Service.verifyAccessToken(token);
    
    res.json({
      status: 'success',
      data: {
        isValid: true,
        user: {
          userId: tokenData.sub,
        }
      }
    });
  } catch (error) {
    // Don't throw an error, just return invalid status
    res.json({
      status: 'success',
      data: {
        isValid: false
      }
    });
  }
};

/**
 * Check if user is authenticated
 * Enhanced to provide more detailed information and ensure proper cookie checking
 */
export const checkAuth = async (req: Request, res: Response) => {
  // Get all cookies from the request
  const allCookies = req.cookies;
  const cookieKeys = Object.keys(allCookies);
  
  // Check for refresh token in cookies
  const hasRefreshToken = !!allCookies.refresh_token;
  const refreshToken = allCookies.refresh_token;
  
  // Log authentication check (debug level only)
  logger.debug(`Auth check called: hasRefreshToken=${hasRefreshToken}, sessionID=${req.sessionID?.substring(0, 6) || 'none'}`);
  logger.debug(`Available cookies: ${cookieKeys.join(', ')}`);
  
  // If we have a refresh token, we should also validate it
  let user = null;
  let tokenValid = false;
  
  if (hasRefreshToken) {
    try {
      // Log partial token for debugging (only first 10 chars)
      const tokenPreview = refreshToken.substring(0, 10) + '...';
      logger.debug(`Found refresh token: ${tokenPreview}, length: ${refreshToken.length}`);
      
      // Check if the session has stateToken (additional evidence of authentication)
      const hasStateToken = !!req.session?.stateToken;
      
      // Basic validation - in production you'd verify the token with Auth0
      tokenValid = refreshToken.length > 20;

      let auth0Id = null;

      // Try to get from Authorization header
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.split(' ')[1];
          const tokenData = await auth0Service.verifyAccessToken(token);
          auth0Id = tokenData.sub;
          // Safe logging with proper type handling
          const auth0IdForLogging = typeof auth0Id === 'function' ? auth0Id() : String(auth0Id);
          logger.debug('Extracted auth0Id from Authorization header', { 
            auth0Id: auth0IdForLogging.substring(0, 6) + '...'
          });
        } catch (err) {
          logger.debug('Could not extract auth0Id from Authorization header', { error: err });
        }
      }

      // If we have an auth0Id, get the user from the database
      if (auth0Id) {
        // Ensure auth0Id is a string (TypeScript type narrowing)
        const auth0IdString = typeof auth0Id === 'function' ? auth0Id() : String(auth0Id);
        user = await userService.getUserByAuth0Id(auth0IdString);
        
        if (user) {
          logger.debug('Found user in database based on auth0Id', {
            userId: user.id,
            email: user.email.replace(/(.{3})(.*)(@.*)/, '$1***$3'),
            userName: user.name,
            picture: user.picture
          });
          
          // Update last login time in the database
          try {
            await userService.updateUser(user.id, { lastLogin: new Date() });
          } catch (updateError) {
            logger.error('Failed to update last login time', updateError);
          }
        }
      }

      logger.debug(`Auth validation: token valid=${tokenValid}, hasUserData=${!!user}`);
    } catch (error) {
      logger.error('Error validating refresh token:', error);
      // Continue with tokenValid = false
    }
  } else {
    // Special debugging for when refresh token is missing
    logger.debug('Missing refresh_token cookie. Request headers:', {
      cookie: req.headers.cookie,
      'set-cookie': req.headers['set-cookie']
    });
    
    // Log all cookie-related headers
    const cookieHeaders: Record<string, string> = {};
    for (const key in req.headers) {
      if (key.toLowerCase().includes('cookie')) {
        const headerValue = req.headers[key];
        if (headerValue) {
          if (Array.isArray(headerValue)) {
            cookieHeaders[key] = headerValue.join("; ")
          } else {
            cookieHeaders[key] = headerValue;
          }
        }
      }
    }
    logger.debug('Cookie-related headers:', cookieHeaders);
  }

  // Sanitize user data before sending it to the client
  const safeUserData = user ? {
    id: user.id,
    auth0Id: user.auth0Id,
    name: user.name,
    email: user.email,
    role: user.role,
    lastLogin: user.lastLogin
    // Add other fields as needed
  } : null;
  
  // Normal response with detailed information
  res.json({
    status: 'success',
    data: {
      isAuthenticated: hasRefreshToken && tokenValid,
      hasRefreshToken,
      tokenValid,
      cookies: cookieKeys,
      user: safeUserData
    }
  });
};

/**
 * Logout and clear auth cookies
 * Keep existing controller method for backward compatibility
 */
export const logout = (req: Request, res: Response) => {
  // Clear cookies
  res.clearCookie('refresh_token');
  
  // Clear session data if any
  if (req.session && typeof req.session.destroy === 'function') {
    req.session.destroy((err: any) => {
      if (err) {
        logger.error(`Error destroying session: ${err}`);
      }
    });
  }
  
  res.json({
    status: 'success',
    message: 'Logged out successfully'
  });
};
