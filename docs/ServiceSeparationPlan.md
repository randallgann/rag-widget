# Service Separation Plan

## Current Issue

The project currently runs the same codebase in two different containers (`auth-server` and `admin-portal`), leading to:
- Duplicate log messages
- Inefficient resource usage
- Lack of clear service boundaries
- Maintenance challenges

## Proposed Architecture: Monorepo Structure

```
/
├── packages/
│   ├── common/          # Shared utilities, types, configs
│   ├── auth-server/     # Authentication service 
│   └── admin-portal/    # Admin UI and business logic
├── docker/              # Docker configs for each service
└── kubernetes/          # Kubernetes deployment files
```

## 1. Code Separation Strategy

### Package: common
- Shared utilities, types, database models
- Logging with service identifier
- Environment configuration
- Database connection management
- Auth middleware (for reuse)
- Error handling utilities

### Package: auth-server
Responsibilities:
- Authentication/authorization flows
- Auth routes and controllers
- Auth0 integration
- Session management
- User profile handling
- Token validation/refresh

Core files to include:
- `/api/routes/authRoutes.ts`
- `/api/controllers/authController.ts`
- `/api/middlewares/auth.ts`
- `/services/auth/auth0Service.ts`
- `/services/sessionService.ts`
- `/utils/pkceUtils.ts`

### Package: admin-portal
Responsibilities:
- Dashboard functionality
- Channel/video management
- Widget configuration
- Content processing
- Query handling
- YouTube integration

Core files to include:
- `/api/routes/dashboardRoutes.ts`
- `/api/routes/channelRoutes.ts`
- `/api/routes/widgetRoutes.ts`
- `/api/routes/videoRoutes.ts`
- `/api/routes/queryRoutes.ts`
- `/services/youtube/*`
- `/services/processing/*`
- `/services/vector/*`

## 2. Implementation Steps

1. **Set up npm workspace configuration**
   ```json
   // root package.json
   {
     "name": "rag-widget-monorepo",
     "private": true,
     "workspaces": [
       "packages/*"
     ],
     "scripts": {
       "build": "npm run build --workspaces",
       "start:auth": "npm run start --workspace=packages/auth-server",
       "start:admin": "npm run start --workspace=packages/admin-portal",
       "dev:auth": "npm run dev --workspace=packages/auth-server",
       "dev:admin": "npm run dev --workspace=packages/admin-portal",
       "test": "npm run test --workspaces"
     }
   }
   ```

2. **Create package structure**
   ```bash
   mkdir -p packages/{common,auth-server,admin-portal}
   # Initialize package.json in each directory with appropriate dependencies
   ```

3. **Extract shared code to common package**
   - Database models
   - Shared types
   - Utility functions
   - Configuration framework
   - Enhanced logger

4. **Enhanced logger implementation**
   ```typescript
   // packages/common/src/config/logger.ts
   import winston from 'winston';
   import { config } from './environment';

   export const createLogger = (serviceName: string) => {
     const options = {
       console: {
         level: config.logLevel,
         handleExceptions: true,
         format: winston.format.combine(
           winston.format.colorize(),
           winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
           winston.format.printf(
             (info) => `${info.timestamp} ${info.level} [${serviceName}]: ${info.message}`
           )
         ),
       },
     };

     return winston.createLogger({
       level: config.logLevel,
       levels: winston.config.npm.levels,
       format: winston.format.combine(
         winston.format.timestamp({
           format: 'YYYY-MM-DD HH:mm:ss',
         }),
         winston.format.errors({ stack: true }),
         winston.format.splat(),
         winston.format.json()
       ),
       defaultMeta: { service: serviceName },
       transports: [
         new winston.transports.Console(options.console),
       ],
       exitOnError: false,
     });
   };
   ```

5. **Service-specific application entry points**
   ```typescript
   // packages/auth-server/src/app.ts
   import { createLogger } from '@rag-widget/common/config/logger';
   const logger = createLogger('auth-server');
   
   // Auth-specific routes and configuration
   // ...
   ```

   ```typescript
   // packages/admin-portal/src/app.ts
   import { createLogger } from '@rag-widget/common/config/logger';
   const logger = createLogger('admin-portal');
   
   // Admin-specific routes and configuration
   // ...
   ```

6. **Docker configuration update**
   ```dockerfile
   # docker/auth-server/Dockerfile
   FROM node:18-alpine AS build
   WORKDIR /app
   COPY package*.json ./
   COPY packages/common/package*.json ./packages/common/
   COPY packages/auth-server/package*.json ./packages/auth-server/
   RUN npm ci
   COPY . .
   RUN npm run build --workspace=packages/auth-server

   FROM node:18-alpine
   WORKDIR /app
   COPY --from=build /app/package*.json ./
   COPY --from=build /app/packages/common/package*.json ./packages/common/
   COPY --from=build /app/packages/auth-server/package*.json ./packages/auth-server/
   RUN npm ci --production --workspace=packages/auth-server
   COPY --from=build /app/packages/common/dist ./packages/common/dist
   COPY --from=build /app/packages/auth-server/dist ./packages/auth-server/dist
   EXPOSE 3001
   CMD ["node", "packages/auth-server/dist/app.js"]
   ```

   Create similar Dockerfile for admin-portal

7. **Update docker-compose.yml**
   ```yaml
   version: '3'

   services:
     frontend:
       # ... unchanged ...

     auth-server:
       build:
         context: .
         dockerfile: docker/auth-server/Dockerfile
       ports:
         - "3001:3001"
       # ... other config ...
       
     admin-portal:
       build:
         context: .
         dockerfile: docker/admin-portal/Dockerfile
       ports:
         - "3000:3000"
       # ... other config ...
       
     postgres:
       # ... unchanged ...
   ```

8. **Update Kubernetes configuration**
   - Update deployment files to use the new Docker images
   - Ensure service dependencies are correctly configured

## 3. Database Access Strategy

Both services will connect to the same database but focus on different tables:
- Auth server: Users, Sessions
- Admin portal: Channels, Videos, Widgets

Consider:
- Implementing database access through a shared library
- Using proper indexing for tables frequently used by both services
- Monitoring query performance after separation

## 4. Testing Strategy

1. **Unit tests**
   - Organize tests to match the new package structure
   - Create shared test utilities in the common package

2. **Integration tests**
   - Test service boundaries
   - Ensure proper communication between services

3. **End-to-end tests**
   - Verify complete user flows across service boundaries

## 5. Migration Strategy

1. **Incremental approach**
   - Start by extracting the common package
   - Then separate auth-server
   - Finally, refactor admin-portal

2. **Parallel development**
   - Keep the monolithic version working while developing the separated version
   - Use feature flags to gradually transition

3. **Validation**
   - Comprehensive testing at each stage
   - Compare performance metrics before and after separation

## 6. Benefits of the New Architecture

- **Clear service boundaries**: Each service has a specific responsibility
- **Independent scaling**: Scale each service based on its specific load
- **Focused development**: Teams can work on different services without conflicts
- **Better resource utilization**: Allocate resources based on service needs
- **Enhanced logging**: Clear identification of log sources
- **Improved maintainability**: Smaller, focused codebases
- **Better testing**: More targeted unit and integration tests

## 7. Potential Challenges

- **Increased complexity**: Managing multiple services requires more orchestration
- **Communication overhead**: Services need to communicate effectively
- **Deployment complexity**: More pieces to deploy and monitor
- **Development setup**: More complex local development environment

## 8. Timeline Estimate

1. **Planning and setup**: 1 week
   - Create monorepo structure
   - Set up build pipelines

2. **Common package**: 1-2 weeks
   - Extract shared code
   - Implement enhanced logger
   - Update configuration management

3. **Auth server**: 1-2 weeks
   - Separate authentication logic
   - Update routes and controllers
   - Configure Docker and Kubernetes

4. **Admin portal**: 2-3 weeks
   - Refactor remaining functionality
   - Ensure proper integration with auth server
   - Update frontend dependencies

5. **Testing and validation**: 1-2 weeks
   - Comprehensive testing
   - Performance benchmarking
   - Bug fixing

Total estimated time: 6-10 weeks depending on team size and familiarity with the codebase.