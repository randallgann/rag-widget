# Auth0 Service Account Implementation Roadmap

## Overview

This document outlines the implementation plan for creating a dedicated Auth0 service account for backend-to-backend communication, specifically for the Kernel Service to securely authenticate with the chat-copilot-webapi.

## Current Limitations

The current token handling has several limitations:

1. Backend services rely on user tokens or empty strings for development
2. The tokenService falls back to environment variables or returns empty strings
3. No proper machine-to-machine (M2M) authentication flow is implemented
4. Background processes and scheduled tasks have no reliable authentication mechanism

## Benefits of Service Account Implementation

1. **Separation of Concerns**: 
   - Distinguishes between user authentication and service authentication
   - Prevents mixing of permission contexts

2. **Enhanced Security**:
   - Service credentials never exposed to frontend
   - Precise control over service permissions
   - Regularly rotatable credentials without affecting users

3. **Operational Reliability**:
   - Works with scheduled tasks and background jobs
   - Independent of user sessions
   - Consistent across all environments

4. **Simplified Backend Architecture**:
   - Standardized authentication for all service-to-service communication
   - Eliminates dependency on frontend authentication flows
   - Centralized token management

## Implementation Plan

### Phase 1: Auth0 Configuration

1. **Create Machine-to-Machine Application in Auth0**:
   - Name: "RAG-Widget-Backend-Services"
   - Type: Machine to Machine
   - API: Select the chat-copilot-webapi as the target API
   - Permissions: Assign minimal required permissions for kernel creation

2. **Configure CORS and Token Settings**:
   - Set appropriate token lifetime (24 hours recommended)
   - Configure proper CORS settings for development and production
   - Enable refresh token rotation if applicable

3. **Document Credentials**:
   - Create secure documentation for credential management
   - Establish rotation schedule and procedure
   - Document credential storage requirements

### Phase 2: Backend Service Implementation

1. **Update Environment Configuration**:
   ```typescript
   // In environment.ts
   export const config = {
     // ...existing config
     auth: {
       // ...existing auth config
       serviceAccount: {
         clientId: process.env.SERVICE_ACCOUNT_CLIENT_ID,
         clientSecret: process.env.SERVICE_ACCOUNT_CLIENT_SECRET,
         audience: process.env.SERVICE_ACCOUNT_AUDIENCE || 'https://api.chat-copilot.com',
       }
     }
   };
   ```

2. **Update TokenService Implementation**:
   ```typescript
   // In src/services/auth/tokenService.ts
   private async fetchNewToken(): Promise<string> {
     try {
       logger.debug('Fetching new access token using client credentials flow');
       
       // Implement client credentials OAuth flow for service account
       const tokenResponse = await fetch(`https://${config.auth.auth0.domain}/oauth/token`, {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json'
         },
         body: JSON.stringify({
           client_id: config.auth.serviceAccount.clientId,
           client_secret: config.auth.serviceAccount.clientSecret,
           audience: config.auth.serviceAccount.audience,
           grant_type: 'client_credentials'
         })
       });
       
       const data = await tokenResponse.json();
       
       if (!data.access_token) {
         throw new Error('Failed to get access token using client credentials');
       }
       
       // Cache the token
       this.cachedToken = data.access_token;
       
       // Set expiry time with buffer for clock skew
       const expiresIn = data.expires_in || 86400; // Default to 24 hours
       this.tokenExpiry = Date.now() + (expiresIn * 1000) - (5 * 60 * 1000);
       
       logger.debug('Successfully obtained service account token');
       return this.cachedToken;
     } catch (error) {
       logger.error('Error fetching service account token:', error);
       throw new Error('Failed to fetch token for service-to-service communication');
     }
   }
   ```

3. **Create Fallback Strategy**:
   - Implement environment-specific fallbacks for development
   - Add comprehensive error handling with detailed logs
   - Create circuit breaker pattern for token fetch failures

### Phase 3: Deployment and Environment Setup

1. **Local Development Environment**:
   - Create .env.local file with development service account credentials
   - Document setup in README.md and CONTRIBUTING.md
   - Implement mock responses for tests and offline development

2. **CI/CD Pipeline Integration**:
   - Add secure credential storage in CI/CD pipeline
   - Implement environment-specific configuration in deployment
   - Add validation steps for credential presence and validity

3. **Production Deployment**:
   - Use secure secret management (GCP Secret Manager, Azure Key Vault, etc.)
   - Set up monitoring for token usage and errors
   - Implement alerting for credential expiration

### Phase 4: Testing and Validation

1. **Unit Tests**:
   - Test token fetching logic with mock responses
   - Test error handling and fallbacks
   - Test token caching and expiration handling

2. **Integration Tests**:
   - Test actual Auth0 communication with test credentials
   - Test full kernel creation flow with service account authentication
   - Test background processes that require authentication

3. **Production Validation**:
   - Monitor token usage patterns and error rates
   - Validate service account permissions are correct
   - Perform security review of implementation

## Security Considerations

1. **Credential Storage**:
   - Never commit credentials to the repository
   - Use environment variables or secure secrets management
   - Implement credential rotation procedure

2. **Access Control**:
   - Limit service account permissions to only what's needed
   - Regularly audit permissions and usage
   - Implement IP restrictions if applicable

3. **Token Handling**:
   - Never log full tokens, only the first few characters for identification
   - Implement secure token caching
   - Add appropriate timeouts and error handling

## Timeline and Prioritization

1. **Phase 1**: 1-2 days - Auth0 configuration and documentation
2. **Phase 2**: 2-3 days - Backend service implementation and testing
3. **Phase 3**: 1-2 days - Environment configuration and deployment updates
4. **Phase 4**: 2-3 days - Testing, validation, and security review

Total estimated effort: 6-10 days

## Future Enhancements

1. **Token Monitoring Dashboard**:
   - Create monitoring for token usage and errors
   - Add metrics for token lifetimes and refresh counts

2. **Multiple Service Accounts**:
   - Implement different service accounts for different services
   - Create granular permissions based on service needs

3. **Token Rotation**:
   - Implement automatic credential rotation
   - Set up monitoring for credential expiration

4. **Audit Logging**:
   - Add comprehensive audit logging for service account usage
   - Implement alerts for suspicious activities