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
    serviceAccount?: {
      userId: string;
      refreshToken?: string;
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
  kernelApi?: {
    baseUrl: string;
    defaultModel: string;
    authType: string;
    apiKey?: string;
    required?: boolean;
  };
  gcp: {
    projectId: string;
    pubsub: {
      videoProcessingTopic: string;
      videoProcessingStatusTopic: string;
    };
    storage: {
      bucket: string;
    };
    secretManager: {
      enabled: boolean;
      serviceAccountKeySecret: string;
    };
    processing: {
      defaultModelType: string;
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
    serviceAccount: {
      userId: process.env.SERVICE_ACCOUNT_USER_ID || 'service-account',
      refreshToken: process.env.SERVICE_ACCOUNT_REFRESH_TOKEN
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
  kernelApi: {
    baseUrl: process.env.KERNEL_API_URL || 'http://localhost:3080',
    defaultModel: process.env.KERNEL_DEFAULT_MODEL || 'gpt-4',
    authType: process.env.KERNEL_AUTH_TYPE || 'none',
    apiKey: process.env.KERNEL_API_KEY,
    required: process.env.KERNEL_API_REQUIRED === 'true',
  },
  gcp: {
    projectId: process.env.GCP_PROJECT_ID || 'rag-widget',
    pubsub: {
      videoProcessingTopic: process.env.GCP_PUBSUB_TOPIC || 'video-processing-queue',
      videoProcessingStatusTopic: process.env.GCP_PUBSUB_STATUS_TOPIC || 'video-processing-status',
    },
    storage: {
      bucket: process.env.GCP_STORAGE_BUCKET || 'rag-widget-processed-videos',
    },
    // For backwards compatibility with non-Kubernetes environments
    secretManager: {
      enabled: process.env.GCP_SECRET_MANAGER_ENABLED === 'true' && !process.env.GOOGLE_APPLICATION_CREDENTIALS,
      serviceAccountKeySecret: process.env.GCP_SERVICE_ACCOUNT_KEY_SECRET || 'rag-widget-service-account-key',
    },
    processing: {
      defaultModelType: process.env.GCP_PROCESSING_MODEL_TYPE || 'fast',
    },
  },
};