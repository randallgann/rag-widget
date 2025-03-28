import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface Config {
  session: {
    secret: string;
  };
  nodeEnv: string;
  port: number;
  logLevel: string;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
  auth: {
    jwtSecret: string;
    jwtExpiresIn: string;
    auth0: {
      domain: string;
      clientId: string;
      clientSecret: string;
      audience: string;
      callbackUrl: string;
    };
  };
  youtube: {
    apiKey: string;
  };
  openai: {
    apiKey: string;
  };
  vectorDb: {
    type: 'pinecone' | 'qdrant';
    apiKey: string;
    environment?: string;
    url?: string;
  };
  gcp: {
    projectId: string;
    pubsub: {
      videoProcessingTopic: string;
    };
    storage: {
      bucket: string;
    };
    secretManager: {
      enabled: boolean;
      serviceAccountKeySecret: string;
    };
  };
}

export const config: Config = {
  session: { 
    secret: process.env.SESSION_KEY || 'your_session_key'
  },
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'youtube_rag',
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
    auth0: {
      domain: process.env.AUTH0_DOMAIN || '',
      clientId: process.env.AUTH0_CLIENT_ID || '',
      clientSecret: process.env.AUTH0_CLIENT_SECRET || '',
      audience: process.env.AUTH0_AUDIENCE || '',
      callbackUrl: process.env.AUTH0_CALLBACK_URL || 'http://localhost:3001/api/auth/callback',
    },
  },
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY || '',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },
  vectorDb: {
    type: (process.env.VECTOR_DB_TYPE as 'pinecone' | 'qdrant') || 'pinecone',
    apiKey: process.env.VECTOR_DB_API_KEY || '',
    environment: process.env.VECTOR_DB_ENVIRONMENT,
    url: process.env.VECTOR_DB_URL,
  },
  gcp: {
    projectId: process.env.GCP_PROJECT_ID || 'rag-widget',
    pubsub: {
      videoProcessingTopic: process.env.GCP_PUBSUB_TOPIC || 'video-processing-queue',
    },
    storage: {
      bucket: process.env.GCP_STORAGE_BUCKET || 'rag-widget-processed-videos',
    },
    // For backwards compatibility with non-Kubernetes environments
    secretManager: {
      enabled: process.env.GCP_SECRET_MANAGER_ENABLED === 'true' && !process.env.GOOGLE_APPLICATION_CREDENTIALS,
      serviceAccountKeySecret: process.env.GCP_SERVICE_ACCOUNT_KEY_SECRET || 'rag-widget-service-account-key',
    },
  },
};