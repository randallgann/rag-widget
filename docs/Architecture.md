# YouTube RAG Widget - System Architecture

## Overview

The YouTube RAG Widget is a Software-as-a-Service (SaaS) application that enables YouTube content creators to add an AI-powered Q&A widget to their websites. The system processes YouTube videos, generates embeddings from transcripts, and provides a query interface for website visitors to ask questions about the video content.

## System Components

![System Architecture](./diagrams/system-architecture.png)

### Core Components

1. **Landing Page** (`/test-landing-page`)
   - Public-facing website for user signup/login
   - Authentication gateway using Auth0
   - Redirects to API Service after successful authentication

2. **API Service** (`/rag-widget`)
   - Consolidated backend service handling both authentication and admin functionality
   - Serves the admin dashboard UI
   - Provides RESTful API endpoints for all functionality
   - Manages database interactions and business logic
   - Handles YouTube data processing and vector operations

3. **Widget** (`/rag-widget/public/widget`)
   - Embeddable JavaScript component for third-party websites
   - Provides Q&A interface for end users
   - Communicates with API Service for query processing

4. **Backend Functionality**
   - Authentication and user management
   - YouTube data fetching and processing
   - Transcription services
   - Embedding generation
   - Vector database integration
   - Query processing

### Database Structure

- **PostgreSQL**: Relational database for user data, configurations, and metadata
- **Vector Database**: Specialized database for storing and querying embeddings

## Technology Stack

### Frontend
- React 19
- TypeScript
- Tailwind CSS (Landing Page)
- Webpack for bundling

### Backend
- Node.js with Express
- TypeScript
- Sequelize ORM
- Auth0 for authentication

### Data Processing
- YouTube API for video data
- Transcription services
- Embedding generation (OpenAI compatible)
- Vector database for RAG queries

### Infrastructure
- Docker containerization
- Docker Compose for local development

## Authentication Flow

```mermaid
sequenceDiagram
    User->>Landing Page: Visits landing page
    User->>Landing Page: Clicks Login
    Landing Page->>API Service: Redirects to /api/auth/login
    API Service->>Auth0: Redirects to Auth0 login
    Auth0->>API Service: Callback with authorization code
    API Service->>Auth0: Exchanges code for tokens
    API Service->>Dashboard: Redirects to dashboard with state token
    Dashboard->>API Service: Exchanges state token for access token
    Dashboard->>API Service: Makes authenticated API requests
```

## Data Flow

1. **Video Processing Pipeline**
   ```mermaid
   graph LR
       A[YouTube Channel] --> B[Fetch Videos]
       B --> C[Process Transcripts]
       C --> D[Generate Embeddings]
       D --> E[Store in Vector DB]
   ```

2. **Query Processing**
   ```mermaid
   graph LR
       A[User Question] --> B[Widget Frontend]
       B --> C[Query API]
       C --> D[Vector Search]
       D --> E[Format Response]
       E --> B
   ```

## Communication Interfaces

| Component | Exposes | Consumes |
|-----------|---------|----------|
| Landing Page | User authentication UI | API Service |
| API Service | Authentication & Data APIs | Auth0, YouTube, Vector DB services, PostgreSQL |
| Widget | Embeddable script | API Service |
| PostgreSQL | Structured data storage | API Service queries |

## Deployment Architecture

For production deployment, the system uses containerized services orchestrated with Docker:

- Frontend container (Landing Page)
- API Service container (consolidated backend)
- Database containers (PostgreSQL, Vector DB)

## Security Considerations

- Auth0 for identity management and JWT-based authentication
- CORS configuration to prevent unauthorized API access
- Rate limiting to prevent abuse
- Secure cookie handling for session management
- Environment-based configuration for secrets