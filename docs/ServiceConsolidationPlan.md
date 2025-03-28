# Service Consolidation Plan: Auth-Server and Admin-Portal

## Overview

This document outlines the plan to consolidate the currently separated auth-server and admin-portal services into a single unified service running on port 3001. This consolidation will simplify the architecture, reduce deployment complexity, and improve maintainability.

## Background

The codebase initially separated authentication and admin portal functionality into two distinct services:
- **auth-server**: Runs on port 3001, handles authentication flows
- **admin-portal**: Runs on port 3000, handles dashboard and admin functionalities

Analysis shows that this separation adds unnecessary complexity, as both services:
- Share the same codebase
- Access the same database
- Have similar dependencies
- Reference each other frequently

## Implementation Plan

### Part 1: Codebase Changes

#### 1. Update Environment Configuration
- Modify `/src/config/environment.ts` to:
  - Remove any service-specific configuration branches
  - Set default port to 3001
  - Ensure all environment variables from both services are properly loaded

#### 2. Update App Entry Point
- Modify `/src/app.ts` to:
  - Remove any conditional logic that separates services
  - Ensure all routes and middlewares from both services are properly loaded
  - Set port to 3001 consistently

#### 3. Audit and Update Routes
- Review all route handlers to ensure they work with consolidated service
- Check for any hardcoded URLs referencing admin-portal (port 3000)
- Update any cross-service references to use single service URLs

#### 4. Update Frontend Configuration
- Modify `/src/config/frontend-config.ts` (if exists) to:
  - Use consolidated service URL (port 3001)
  - Update API endpoint references

#### 5. Session and Authentication Updates
- Review all authentication-related code to ensure session handling works in consolidated service
- Update any redirect URLs to point to the consolidated service endpoints

#### 6. Client-Side Code Updates
- Update any hardcoded API URLs in React components
- Update any environment variables referenced in client code

### Part 2: Deployment Changes

#### 1. Docker Compose Updates
- Modify `docker-compose.yml` to:
  - Remove the admin-portal service
  - Ensure auth-server service has all necessary environment variables
  - Update service dependencies
  - Update volume mounts if there were any differences

#### 2. Kubernetes Configuration Updates
- Modify Kubernetes deployment files:
  - Remove `admin-portal.yml`
  - Update `auth-server.yml` to include all necessary environment variables
  - Update any service references in other Kubernetes configs
  - Update service discovery and networking configurations

#### 3. Environment Variables and Secrets
- Ensure all environment variables from both services are consolidated
- Update any secret references to include all needed values

#### 4. Update Documentation
- Update `Architecture.md` to reflect new consolidated architecture
- Update `README.md` and other documentation to remove references to separate services
- Update deployment guides to reflect consolidation

### Part 3: Testing Strategy

#### 1. Functional Testing
- Test authentication flow end-to-end
- Test admin portal functionality
- Test widget embedding and interactions
- Test all API endpoints with Postman or similar tool

#### 2. Deployment Testing
- Test local development setup with Docker Compose
- Test Kubernetes deployment in minikube
- Test GKE deployment if applicable

#### 3. Performance Testing
- Benchmark response times for key endpoints
- Verify the consolidated service can handle the combined load

## Benefits of Consolidation

1. **Simplified Architecture**: Single service means clearer code organization
2. **Reduced Deployment Complexity**: Fewer services to maintain and deploy
3. **Improved Developer Experience**: Simpler setup for local development
4. **Reduced Resource Usage**: Lower overhead from running a single service
5. **Elimination of Cross-Service Communication**: No need for service discovery or internal networking
6. **Streamlined Configuration**: Single set of environment variables and secrets

## Potential Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Service downtime during transition | Deploy during off-hours with a rollback plan |
| Unexpected authentication issues | Thorough testing of auth flows before deployment |
| Performance degradation | Load testing the consolidated service |
| Configuration conflicts | Audit all environment variables for conflicts |
| Database connection pool issues | Increase connection pool size if needed |

## Timeline

1. Code changes: 1-2 days
2. Deployment configuration updates: 1 day
3. Testing: 1-2 days
4. Documentation updates: 1 day
5. Final review and deployment: 1 day

Total estimated time: 5-7 days