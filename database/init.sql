-- Initialize the YouTube RAG database

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ENUM types (need to be created before tables that use them)
DROP TYPE IF EXISTS user_role_enum CASCADE;
DROP TYPE IF EXISTS status_enum CASCADE;
DROP TYPE IF EXISTS processing_status_enum CASCADE;

CREATE TYPE user_role_enum AS ENUM ('admin', 'user');
CREATE TYPE status_enum AS ENUM ('active', 'inactive', 'pending');
CREATE TYPE processing_status_enum AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Create basic tables
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    auth0_id VARCHAR(255) NOT NULL UNIQUE,
    last_login TIMESTAMP WITH TIME ZONE,
    role user_role_enum DEFAULT 'user',
    picture VARCHAR(255),
    preferences JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Channels table
CREATE TABLE IF NOT EXISTS channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    user_id UUID NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
    config JSONB DEFAULT '{}',
    status status_enum DEFAULT 'active',
    kernel_status VARCHAR(20) DEFAULT 'pending' CHECK (kernel_status IN ('pending', 'creating', 'created', 'failed')),
    kernel_error TEXT,
    kernel_created_at TIMESTAMP WITH TIME ZONE,
    kernel_last_updated TIMESTAMP WITH TIME ZONE,
    qdrant_collection_status VARCHAR(20) DEFAULT 'pending' CHECK (qdrant_collection_status IN ('pending', 'creating', 'created', 'failed')),
    qdrant_collection_error TEXT,
    qdrant_collection_created_at TIMESTAMP WITH TIME ZONE,
    qdrant_collection_last_updated TIMESTAMP WITH TIME ZONE,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Widgets table
CREATE TABLE IF NOT EXISTS widgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    channel_id UUID NOT NULL REFERENCES channels(id) ON UPDATE CASCADE ON DELETE CASCADE,
    config JSONB DEFAULT '{}',
    status status_enum DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Videos table
CREATE TABLE IF NOT EXISTS videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    youtube_id VARCHAR(255) NOT NULL UNIQUE,
    title VARCHAR(255),
    description TEXT,
    channel_id UUID NOT NULL REFERENCES channels(id) ON UPDATE CASCADE ON DELETE CASCADE,
    thumbnail_url VARCHAR(255),
    duration VARCHAR(50),
    duration_seconds INTEGER,
    view_count INTEGER,
    like_count INTEGER,
    published_at TIMESTAMP WITH TIME ZONE,
    selected_for_processing BOOLEAN DEFAULT FALSE,
    processing_progress FLOAT DEFAULT 0,
    processing_error TEXT,
    processing_stage VARCHAR(100),
    processing_last_updated TIMESTAMP WITH TIME ZONE,
    status status_enum DEFAULT 'active',
    processing_status processing_status_enum DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Video segments table
CREATE TABLE IF NOT EXISTS video_segments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    start_time INTEGER NOT NULL,
    end_time INTEGER NOT NULL,
    transcript TEXT NOT NULL,
    embedding VECTOR(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL,
    refresh_token TEXT NOT NULL,
    last_used TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    requires_reauth BOOLEAN DEFAULT FALSE,
    reauth_reason VARCHAR(255),
    custom_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient searches
CREATE INDEX IF NOT EXISTS idx_video_segments_video_id ON video_segments(video_id);
CREATE INDEX IF NOT EXISTS idx_videos_youtube_id ON videos(youtube_id);
CREATE INDEX IF NOT EXISTS idx_videos_channel_id ON videos(channel_id);
CREATE INDEX IF NOT EXISTS idx_widgets_channel_id ON widgets(channel_id);
CREATE INDEX IF NOT EXISTS idx_channels_user_id ON channels(user_id);

-- Add a GIN index for text search on transcripts
CREATE INDEX IF NOT EXISTS idx_video_segments_transcript_trgm ON video_segments USING GIN (transcript gin_trgm_ops);

-- Indexes for sessions table
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id_expires_at ON sessions(user_id, expires_at);

-- Indexes for kernel-related fields
CREATE INDEX IF NOT EXISTS idx_channels_kernel_status ON channels(kernel_status);
CREATE INDEX IF NOT EXISTS idx_channels_qdrant_collection_status ON channels(qdrant_collection_status);

-- Add sample data for testing (optional, can be removed for production)
INSERT INTO users (auth0_id, email, name, role) 
VALUES ('auth0|123456789', 'admin@example.com', 'Admin User', 'admin')
ON CONFLICT (auth0_id) DO NOTHING;