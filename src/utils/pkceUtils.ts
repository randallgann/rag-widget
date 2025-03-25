import crypto from 'crypto';
import { Jwt, JwtPayload } from 'jsonwebtoken';

/**
 * Generates a random code verifier for PKCE flow
 * @param length Length of the code verifier (43-128 chars per PKCE spec)
 * @returns Random string to be used as code verifier
 */
export function generateCodeVerifier(length: number = 43): string {
  // Per PKCE spec, code verifier should use only unreserved URL chars: A-Z, a-z, 0-9, '-', '.', '_', '~'
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  const randomValues = crypto.randomBytes(length);
  
  for (let i = 0; i < length; i++) {
    result += charset.charAt(randomValues[i] % charset.length);
  }
  
  return result;
}

/**
 * Generates a code challenge from a code verifier using SHA-256
 * @param codeVerifier The code verifier to hash
 * @returns Base64URL-encoded string to be used as code challenge
 */
export function generateCodeChallenge(codeVerifier: string): string {
  // PKCE spec requires S256 method (SHA-256 hash, base64url-encoded)
  const hash = crypto.createHash('sha256')
    .update(codeVerifier)
    .digest('base64')
    // Convert base64 to base64url by replacing '+' with '-', '/' with '_', and removing '='
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  return hash;
}

// Function to extract payload attributes
// Function to extract payload attributes with return type
export function extractPayloadAttributes(token: JwtPayload | string): {
  nickname?: string;
  name?: string;
  picture?: string;
  updated_at?: string;
  email?: string;
  // Standard JWT claims
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  jti?: string;
  // For any additional properties
  [key: string]: any;
} {
  // First, check if payload is a string and parse it if needed
  const payload = typeof token === 'string' 
    ? JSON.parse(token) as JwtPayload
    : token as JwtPayload;
  
  // Now destructure the payload
  const { 
    nickname, 
    name, 
    picture, 
    updated_at, 
    email,
    // Include the standard JWT claims that might be present
    iss, 
    sub, 
    aud, 
    exp, 
    nbf, 
    iat, 
    jti,
    ...restAttributes 
  } = payload;

  // Return the extracted values
  return {
    // Custom attributes
    nickname,
    name,
    picture,
    updated_at,
    email,
    // Standard JWT claims
    iss,
    sub,
    aud,
    exp,
    nbf,
    iat,
    jti,
    // Any other attributes
    ...restAttributes
  };
}