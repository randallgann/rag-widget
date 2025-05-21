# Implementation Plan: Fix API_SERVICE_URL Redirection in Kubernetes Environment

## Problem Statement
When using the application through the ingress at `http://rag-widget.local`, the login button redirects to `http://localhost:3001/api/auth/login` instead of `http://rag-widget.local/api/auth/login`. This happens because:

1. The `API_SERVICE_URL` environment variable is correctly set in the Kubernetes deployment to `http://rag-widget.local/api`
2. The frontend React code in `App.tsx` hardcodes the login URL with `window.location.href = '/api/auth/login'`
3. There is no mechanism to pass the server's environment variables to the frontend React application at runtime

## Solution Approach
We need to create a mechanism to expose certain environment variables from the server to the frontend at runtime. This can be achieved with these steps:

### Step 1: Create a Config API Endpoint
Create a new API endpoint that will provide environment configuration to the frontend:

**File: `/src/api/controllers/configController.ts`**
```typescript
import { Request, Response } from 'express';
import { config } from '../../config/environment';

// This controller provides frontend-safe environment variables to the browser
export const getFrontendConfig = (_req: Request, res: Response) => {
  // Only expose the variables that are safe for the frontend
  const frontendConfig = {
    apiServiceUrl: process.env.API_SERVICE_URL || 'http://localhost:3001/api',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3003',
    auth: {
      domain: config.auth.auth0.domain,
      clientId: config.auth.auth0.clientId,
      audience: config.auth.auth0.audience,
    },
    environment: process.env.NODE_ENV || 'development'
  };
  
  res.json(frontendConfig);
};
```

### Step 2: Create Config API Routes
Add a route to expose the configuration endpoint:

**File: `/src/api/routes/configRoutes.ts`**
```typescript
import { Router } from 'express';
import { getFrontendConfig } from '../controllers/configController';

const router = Router();

/**
 * @route   GET /api/config
 * @desc    Get frontend configuration
 * @access  Public
 */
router.get('/', getFrontendConfig);

export default router;
```

### Step 3: Add Config Routes to App.ts
Register the new routes in the main application:

**File: `/src/app.ts`** (add after other routes)
```typescript
import configRoutes from './api/routes/configRoutes';
// ...

// Add this with the other API routes
app.use('/api/config', configRoutes);
```

### Step 4: Create a Frontend Config Context
Create a React context to provide configuration throughout the application:

**File: `/src/contexts/ConfigContext.tsx`**
```typescript
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Config {
  apiServiceUrl: string;
  frontendUrl: string;
  auth: {
    domain: string;
    clientId: string;
    audience: string;
  };
  environment: string;
  isLoading: boolean;
}

const defaultConfig: Config = {
  apiServiceUrl: '/api', // Default for relative URLs
  frontendUrl: '',
  auth: {
    domain: '',
    clientId: '',
    audience: '',
  },
  environment: 'development',
  isLoading: true
};

const ConfigContext = createContext<Config>(defaultConfig);

export const useConfig = () => useContext(ConfigContext);

interface ConfigProviderProps {
  children: ReactNode;
}

export const ConfigProvider: React.FC<ConfigProviderProps> = ({ children }) => {
  const [config, setConfig] = useState<Config>(defaultConfig);

  useEffect(() => {
    // Fetch configuration from the backend
    fetch('/api/config')
      .then(response => response.json())
      .then(data => {
        setConfig({
          ...data,
          isLoading: false
        });
      })
      .catch(error => {
        console.error('Failed to load configuration:', error);
        // Set isLoading to false even on error to let the app continue with defaults
        setConfig(prev => ({ ...prev, isLoading: false }));
      });
  }, []);

  return (
    <ConfigContext.Provider value={config}>
      {children}
    </ConfigContext.Provider>
  );
};
```

### Step 5: Wrap Application with Config Provider
Modify the main App.tsx to use the ConfigProvider:

**File: `/src/views/index.tsx`** (ensure the ConfigProvider wraps the App)
```typescript
import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import { ConfigProvider } from '../contexts/ConfigContext';
import '../css/index.css';

ReactDOM.render(
  <React.StrictMode>
    <ConfigProvider>
      <App />
    </ConfigProvider>
  </React.StrictMode>,
  document.getElementById('root')
);
```

### Step 6: Update Login Handler to Use Config
Modify the login handler in App.tsx to use the API service URL from config:

**File: `/src/views/App.tsx`** (update the HomePage component)
```typescript
import { useConfig } from '../contexts/ConfigContext';

// Home page component
const HomePage: React.FC = () => {
  const config = useConfig();
  
  const handleLogin = () => {
    window.location.href = `${config.apiServiceUrl}/auth/login`;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="max-w-md w-full px-6 py-8 bg-white shadow-md rounded-lg">
        <h1 className="text-3xl font-bold text-center mb-6">YouTube RAG Widget</h1>
        <p className="text-gray-600 text-center mb-8">
          A SaaS service that enables YouTube content creators to add an AI-powered Q&A widget to their websites.
        </p>
        <div className="flex justify-center">
          <button
            onClick={handleLogin}
            className="btn btn-primary px-8 py-3 text-lg"
          >
            Log In / Sign Up
          </button>
        </div>
      </div>
    </div>
  );
};
```

### Step 7: Update Debug Bar Logout Redirect
Also update the debug bar logout redirect in App.tsx:

**File: `/src/views/App.tsx`** (in debug bar section)
```typescript
const config = useConfig();

// In the debug bar
<button 
  onClick={() => {
    clearTokenRefreshTimer();
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
      .then(() => window.location.href = config.frontendUrl)
      .catch(err => console.error('Logout failed:', err));
  }} 
  style={{ textDecoration: 'underline' }}
>
  Logout
</button>
```

### Step 8: Update CORS Configuration
Make sure the CORS configuration in app.ts includes the domain we're using:

**File: `/src/app.ts`**
```typescript
// Update CORS configuration to include rag-widget.local
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3080', 'http://rag-widget.local'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
```

### Step 9: Update CSP for Chat Copilot
Update the Content Security Policy to include rag-widget.local:

**File: `/src/app.ts`**
```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], 
      imgSrc: ["'self'", "data:", "https://s.gravatar.com", "https://*.gravatar.com", "https://*.auth0.com", "https://cdn.auth0.com", "https://*.wp.com", "https://i0.wp.com", "https://i1.wp.com", "https://i2.wp.com", "https://i3.wp.com", "https://i.ytimg.com"],
      connectSrc: ["'self'", "https://*.auth0.com", "http://localhost:3080", "ws://localhost:3080", "http://rag-widget.local", "ws://rag-widget.local"]
    }
  }
}));
```

### Step 10: Build and Deploy
After making these changes:

1. Build the application:
   ```bash
   npm run build
   ```

2. Build a new Docker image:
   ```bash
   eval $(minikube -p minikube docker-env)
   docker build -t rag-widget-api-service:latest --build-arg PORT=3001 --build-arg APP_TYPE=api-service -f Dockerfile .
   ```

3. Deploy the updated service:
   ```bash
   kubectl delete deployment api-service
   kubectl apply -f kubernetes/api-service.yml
   ```

## Benefits of This Solution
1. **Adaptability**: The application will automatically use the correct URLs based on environment, making it work in any environment (local development, Kubernetes, production).
2. **Centralized Configuration**: All configuration is managed in one place and passed to the frontend.
3. **Runtime Flexibility**: No hardcoded URLs means the same frontend build works in multiple environments.
4. **Better Developer Experience**: Clear separation of backend and frontend configuration.

## Potential Challenges
1. **Initial Load Delay**: There might be a slight delay before the config is loaded, consider showing a loading state.
2. **Auth0 Configuration**: Ensure Auth0 callback URLs are configured for all environments.
3. **Caching**: The config API response should be set with proper cache headers to avoid frequent requests.

This solution provides a permanent fix that will work across different environments without requiring port forwarding or other manual steps.