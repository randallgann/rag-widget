import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { config } from '../../config/environment';
import { AppError } from './errorHandler';
import { logger } from '../../config/logger';
import { auth0Service } from '../../services/auth/auth0Service';

// Extend Express Request type to include user property
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        [key: string]: any;
      };
    }
  }
}

// Initialize the JWKS client to fetch Auth0 public keys
const jwksClientInstance = jwksClient({
  jwksUri: `https://${config.auth.auth0.domain}/.well-known/jwks.json`,
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 5
});

// Function to get signing key used to verify JWTs
const getSigningKey = (kid: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    jwksClientInstance.getSigningKey(kid, (err, key) => {
      if (err) {
        return reject(err);
      }
      
      if (!key) {
        return reject(new Error('No signing key found'));
      }
      
      // Get the public key
      const signingKey = key.getPublicKey();
      resolve(signingKey);
    });
  });
};

/**
 * Middleware to validate Auth0 JWT tokens
 * This validates tokens received from Auth0 after user login
 */
export const validateAuth0Token = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No authHeader or no bearer found - in validateAuth0Token', 401);
    }
    
    const token = authHeader.split(' ')[1];

    if (!token) {
      throw new AppError('Token undefined or null in validateAuth0Token', 401);
    }
    
    // Use the existing auth0Service to verify the token
    const decoded = await auth0Service.verifyAccessToken(token);

    if (typeof decoded === 'object' && decoded !== null) {
      // Set the user object on the request
      req.user = {
        userId: decoded.sub as string,
        // Only include email if it exists in the token
        ...(decoded.email && { email: decoded.email as string })
      };
    } else {
      throw new AppError('Invalid token payload', 401);
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to check if user is authenticated
 * Use this middleware for routes that require authentication
 */
export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401));
  }
  next();
};