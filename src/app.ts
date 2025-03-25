import express, { Application, NextFunction, Request, Response } from 'express';
import session from 'express-session';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import cookieParser from 'cookie-parser';
import { config } from './config/environment';
import { logger } from './config/logger';
import { errorHandler } from './api/middlewares/errorHandler';
import { testDbConnection } from './config/db';
import sequelize from './config/db';
import fs from 'fs';

// Initialize GCP environment if Secret Manager is enabled
if (config.gcp.secretManager.enabled) {
  try {
    // During development/bootstrap, use temporary key file to access Secret Manager
    // In production, this would use workload identity or other secure methods
    if (process.env.NODE_ENV === 'development' && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const bootstrapPath = path.join(__dirname, '../bootstrap-gcp.js');
      if (fs.existsSync(bootstrapPath)) {
        logger.info('Loading GCP bootstrap configuration...');
        require(bootstrapPath);
        logger.info('GCP bootstrap configuration loaded successfully');
      } else {
        logger.warn('GCP Secret Manager is enabled but bootstrap-gcp.js not found');
      }
    }
  } catch (error) {
    logger.error('Failed to initialize GCP environment:', error);
  }
}
import { DataTypes } from 'sequelize';

// Import models for association initialization
import Channel from './db/models/Channel';
import Video from './db/models/Video';
import User from './db/models/User';
import Widget from './db/models/Widget';

// Import routes
import authRoutes from './api/routes/authRoutes';
import dashboardRoutes from './api/routes/dashboardRoutes';
import channelRoutes from './api/routes/channelRoutes';
import widgetRoutes from './api/routes/widgetRoutes';
import queryRoutes from './api/routes/queryRoutes';
import videoRoutes from './api/routes/videoRoutes';
import proxyRoutes from './api/routes/proxyRoutes';

const app: Application = express();
const PORT = config.port || 3000;

// Middleware
app.use(session({
  secret: config.session.secret || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
app.use(cors());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for React-generated styles
      imgSrc: ["'self'", "data:", "https://s.gravatar.com", "https://*.gravatar.com", "https://*.auth0.com", "https://cdn.auth0.com", "https://*.wp.com", "https://i0.wp.com", "https://i1.wp.com", "https://i2.wp.com", "https://i3.wp.com", "https://i.ytimg.com"],
      connectSrc: ["'self'", "https://*.auth0.com"] // Allow connections to Auth0
    }
  }
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Add cookie parser middleware

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Serve the widget files from the public directory
app.use('/widget', express.static(path.join(__dirname, '../public/widget')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/widgets', widgetRoutes);
app.use('/api/query', queryRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/proxy', proxyRoutes);

// SPA fallback routes
// This sends the index.html for any route except API and static files,
// allowing React Router to handle client-side routing
app.get(['/', '/dashboard', '/dashboard/*', '/channels', '/channels/*', '/widgets', '/widgets/*', '/settings', '/settings/*'], (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Universal fallback for React Router
// This should be placed after all API routes but before the error handler
app.get('*', (req: Request, res: Response, next: NextFunction) => {
  // Skip API routes and static files
  if (req.path.startsWith('/api/') || req.path.startsWith('/widget/') || req.path.includes('.')) {
    return next();
  }
  // For all other routes, serve the index.html file
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handler middleware (should be last)
app.use(errorHandler);

// Initialize model associations
const models = { User, Channel, Video, Widget };
Object.values(models).forEach(model => {
  if ('associate' in model && typeof model.associate === 'function') {
    model.associate(models);
  }
});

// Start server
if (process.env.NODE_ENV !== 'test') {
  // Test database connection before starting server - no migrations needed as init.sql handles table creation
  testDbConnection()
    .then(() => {
      // Start the server after successful database connection
      app.listen(PORT, () => {
        logger.info(`Server running on port ${PORT}`);
        logger.info(`Auth routes enabled - Auth0 integration active`);
      });
    })
    .catch(err => {
      // Log the error but continue in development mode
      logger.error('Failed to connect to the database.', err);
      
      if (process.env.NODE_ENV === 'production') {
        logger.error('Terminating server in production mode.');
        process.exit(1);
      } else {
        logger.warn('Continuing in development mode without database connection.');
        // Still start the server for UI testing purposes
        app.listen(PORT, () => {
          logger.info(`Server running on port ${PORT} (WITHOUT DATABASE CONNECTION)`);
          logger.info(`Auth routes enabled - Auth0 integration active (UI only)`);
        });
      }
    });
}

export default app;