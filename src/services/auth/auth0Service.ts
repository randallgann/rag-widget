import { AuthenticationClient, TokenResponse } from 'auth0';
import jwt, { Jwt, JwtPayload } from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import axios from 'axios';
import { config } from '../../config/environment';
import { logger } from '../../config/logger';
import { getSessionForUser, updateUserSession } from '../sessionService';
import { userService } from '../userService';

/**
 * Service for interacting with Auth0 Authentication API and local user management
 */
class Auth0Service {
  private authentication: AuthenticationClient;
  private jwksClient: jwksClient.JwksClient;

  constructor() {
    const domain = config.auth.auth0.domain || 'your-tenant.auth0.com';
    const clientId = config.auth.auth0.clientId || 'your-client-id';
    
    if (!domain || domain === 'your-auth0-domain.auth0.com') {
      logger.warn('Auth0 domain not properly configured. Using fallback value for testing.');
    }
    
    // Initialize Auth0 authentication client
    this.authentication = new AuthenticationClient({
      domain,
      clientId,
      // Don't include clientSecret to avoid client_credentials grant attempts
    });
    
    // Initialize JWKS client for token verification
    this.jwksClient = jwksClient({
      jwksUri: `https://${domain}/.well-known/jwks.json`,
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 5
    });
    
    logger.info(`Auth0 service initialized with domain: ${domain}`);
  }

  /**
   * Get user profile from local database
   * @param userId Auth0 user ID
   */
  async getUserProfile(userId: string) {
    try {
      // Fetch the user from the local database instead of Auth0
      const user = await userService.findUserById(userId);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }
      return user;
    } catch (error) {
      logger.error(`Error fetching user profile: ${error}`);
      throw error;
    }
  }

  /**
   * Update user metadata in local database
   * @param userId Auth0 user ID
   * @param metadata User metadata to update
   */
  // async updateUserMetadata(userId: string, metadata: any) {
  //   try {
  //     // Update the user metadata in your local database
  //     return await userService.updateUserMetadata(userId, metadata);
  //   } catch (error) {
  //     logger.error(`Error updating user metadata: ${error}`);
  //     throw error;
  //   }
  // }
  
  /**
   * Exchange Auth0 authorization code for tokens using PKCE
   * @param code Authorization code from Auth0 redirect
   * @param redirectUri Redirect URI used in the initial authorization request
   * @param codeVerifier PKCE code verifier to exchange with code challenge
   */
  async exchangeCodeWithPKCE(code: string, redirectUri: string, codeVerifier: string): Promise<TokenResponse> {
    try {
      logger.debug('Exchanging authorization code for tokens with PKCE', {
        codeLength: code.length,
        redirectUri,
        codeVerifierLength: codeVerifier.length,
      });

      // Create request options exactly as in the Auth0 example
      const options = {
        method: 'POST',
        url: `https://${config.auth.auth0.domain}/oauth/token`,
        headers: {'content-type': 'application/x-www-form-urlencoded'},
        data: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: config.auth.auth0.clientId,
          code_verifier: codeVerifier,
          code: code,
          redirect_uri: redirectUri,
          audience: `https://${config.auth.auth0.audience}`
        })
      };

      // Use axios.request as shown in the Auth0 example
      const response = await axios.request(options);

      logger.debug('Token exchange successful', {
        hasAccessToken: !!response.data.access_token,
        hasIdToken: !!response.data.id_token,
        hasRefreshToken: !!response.data.refresh_token,
        expiresIn: response.data.expires_in
      });

      return response.data;
    } catch (error) {
      // Enhanced error logging
      if (axios.isAxiosError(error) && error.response) {
        logger.error('Token exchange failed with response', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
      } else {
        logger.error(`Error exchanging code for tokens with PKCE: ${error}`);
      }
      throw error;
    }
  }
  
  /**
   * Refresh tokens using a refresh token
   * With Refresh Token Rotation enabled, this returns a new refresh token
   * @param refreshToken The refresh token
   */
  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    try {
      // Request both access_token and refresh_token in the response
      const response = await this.authentication.oauth.refreshToken({
        refresh_token: refreshToken,
        //client_id: config.auth.auth0.clientId,
        //client_secret: config.auth.auth0.clientSecret
      });
      
      // Log token refresh for monitoring (without sensitive data)
      logger.info('Token refreshed successfully');
      
      return response;
    } catch (error: any) {
      // Classify and log errors for better debugging
      if (error.name === 'invalid_grant') {
        logger.warn('Refresh token invalid or expired during refresh attempt');
      } else {
        logger.error(`Error refreshing token: ${error.message}`);
      }
      throw error;
    }
  }
  
  /**
   * Handle token rotation failure cases
   * @param userId The user ID
   */
  async handleTokenRotationFailure(userId: string) {
    try {
      // This method is used when token rotation fails or reaches limits
      // We can trigger a silent re-authentication or notify the user
      
      // Get the existing user session
      const userSession = await getSessionForUser(userId);
      
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
    } catch (error: any) {
      logger.error(`Error handling token rotation failure: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get signing key from JWKS endpoint
   * @param kid Key ID from token header
   */
  private getSigningKey(kid: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.jwksClient.getSigningKey(kid, (err, key) => {
        if (err) {
          return reject(err);
        }
        
        if (!key) {
          return reject(new Error('No signing key found'));
        }
        
        const signingKey = key.getPublicKey();
        resolve(signingKey);
      });
    });
  }

  async extractIdToken(token: TokenResponse): Promise<JwtPayload | string> {
    try {
      let decodedToken: null | Jwt = null;

      if (token.id_token !== undefined) {
        decodedToken = jwt.decode(token.id_token, { complete: true});
      }

      if (!decodedToken || typeof decodedToken !== 'object' || !decodedToken.header || !decodedToken.header.kid) {
        throw new Error('Invalid token format');
      }

      return decodedToken.payload;
    } catch (error) {
      logger.error(`Error extracting ID from token: ${error}`);
      throw error;
    }
  }

  /**
   * Verify Auth0 ID token properly using JWKS
   * @param token ID token to verify
   */
  // async verifyIdToken(token: TokenResponse): Promise<JwtPayload | string> {
  //   try {
  //     let decodedToken: null | Jwt = null;
  //     // First decode the token to get the key ID (kid)
  //     if (token.id_token !== undefined) {
  //       decodedToken = jwt.decode(token.id_token, { complete: true });
  //     }

  //     if (!decodedToken || typeof decodedToken !== 'object' || !decodedToken.header || !decodedToken.header.kid) {
  //         throw new Error('Invalid token format');
  //       }
      
      
      
  //     // Get the signing key matching the kid
  //     const signingKey = await this.getSigningKey(decodedToken.header.kid);
      
  //     // Verify the token with the correct signing key
  //     const verified = jwt.verify(token, signingKey, {
  //       audience: config.auth.auth0.clientId,
  //       issuer: `https://${config.auth.auth0.domain}/`,
  //       algorithms: ['RS256']
  //     });
      
  //     return verified;
  //   } catch (error) {
  //     logger.error(`Error verifying ID token: ${error}`);
  //     throw error;
  //   }
  // }

  /**
   * Verify Auth0 access token
   * @param token Access token to verify
   */
  async verifyAccessToken(token: string) {
    try {
      // First decode the token to get the key ID (kid)
      const decoded = jwt.decode(token, { complete: true });
      
      if (!decoded || typeof decoded !== 'object' || !decoded.header || !decoded.header.kid) {
        throw new Error('Invalid token format');
      }
      
      // Get the signing key matching the kid
      const signingKey = await this.getSigningKey(decoded.header.kid);
      
      // Verify the token with the correct signing key
      const verified = jwt.verify(token, signingKey, {
        audience: `https://${config.auth.auth0.audience}`,
        issuer: `https://${config.auth.auth0.domain}/`,
        algorithms: ['RS256']
      });
      
      return verified;
    } catch (error) {
      logger.error(`Error verifying access token: ${error}`);
      throw error;
    }
  }
}

export const auth0Service = new Auth0Service();