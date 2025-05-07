# YouTube RAG Widget

A SaaS service that enables YouTube content creators to add an AI-powered Q&A widget to their websites, allowing visitors to ask questions about their video content.

## Project Overview

The YouTube RAG Widget is a service that:

1. Processes YouTube channel content (videos)
2. Transcribes the audio to text
3. Chunks and embeds the content into a vector database
4. Provides a customizable widget that content creators can embed on their websites
5. Enables website visitors to ask questions about the creator's content and receive accurate, contextualized answers

## MVP Phase Architecture

### Core Components

#### 1. Data Ingestion Pipeline

- **YouTube Fetcher Service**
  - Interfaces with YouTube API to retrieve channel and video metadata
  - Handles pagination and API rate limits
  - Stores metadata in database

- **Video Processor Service**
  - Downloads video content
  - Extracts audio tracks
  - Manages download queue and retries

- **Transcription Service**
  - Processes audio files using OpenAI Whisper API
  - Converts speech to text with timestamps
  - Handles chunking of transcriptions into semantic units
  - Preprocesses text for embedding

- **Embedding Service**
  - Generates vector embeddings for text chunks
  - Stores embeddings and metadata in vector database
  - Updates existing embeddings when content changes

#### 2. Vector Database

- Vector store using Pinecone or Qdrant
- Storage schema:
  - Embedding vectors
  - Metadata (video ID, title, timestamps, chunk ID)
  - Reference text chunks

#### 3. API Layer

- **Authentication Service**
  - Creator account management
  - API key generation and validation
  - Basic rate limiting

- **Query Service**
  - Processes incoming questions
  - Converts questions to embeddings
  - Retrieves relevant context from vector database
  - Constructs prompts for LLM
  - Returns formatted responses

#### 4. Widget Framework

- **iFrame Widget**
  - Simple chat interface
  - Responsive design
  - Basic customization options (colors, size)
  - Secure communication with backend

#### 5. Admin Portal

- **Channel Management**
  - YouTube channel connection
  - Processing status monitoring
  - Content refresh requests

- **Widget Configuration**
  - Customization settings
  - Widget embed code generation
  - Basic usage statistics

### Technology Stack

- **Languages/Frameworks**:
  - TypeScript for backend
  - Python (optional) for ML/AI components

- **Backend**:
  - Node.js / Express.js in Typescript
  - Python for ML/AI components
  - PostgreSQL for relational data
  - Pinecone/Qdrant for vector storage

- **Frontend**:
  - React for Admin Portal
  - React for Widget (compiled to standalone bundle)
  - TailwindCSS for styling

- **Infrastructure**:
  - Docker for containerization
  - AWS/GCP for hosting
  - Redis for caching and queue management

### Data Flow

1. **Onboarding Flow**:
   - Creator signs up
   - Creator connects YouTube channel
   - System fetches video metadata
   - System queues videos for processing
   - Creator configures widget
   - Creator embeds widget on their website

2. **Query Flow**:
   - User visits creator's website
   - User interacts with embedded widget
   - User submits question
   - Question is sent to backend API
   - API converts question to embedding
   - API retrieves relevant chunks from vector DB
   - API constructs prompt with context for LLM
   - LLM generates response
   - Response is returned to widget
   - Widget displays response to user

## Development Roadmap

### Phase 1: Core Infrastructure (Weeks 1-2)

- [x] Set up project repository and structure in TypeScript
- [x] Implement basic authentication using Auth0
- [x] Create database schemas (PostgreSQL)
- [x] Create user dashboard
- [x] Implement YouTube API integration for channel/video metadata
- [ ] Setup messaging queue for processing video
- [x] Set up vector database (Qdrant)
- [ ] Set up payment processing
- [ ] Set up cost tracking

### Phase 2: Content Processing Pipeline (Weeks 3-4)

- [ ] Implement video download service
- [ ] Implement audio extraction
- [ ] Set up transcription with Whisper API
- [ ] Create chunking and preprocessing logic
- [ ] Implement embedding generation and storage

### Phase 3: API & Query System (Weeks 5-6)

- [ ] Develop authentication and authorization middleware
- [ ] Implement query processing endpoints
- [ ] Create context retrieval system
- [ ] Set up LLM integration for response generation
- [ ] Implement basic rate limiting and usage tracking

### Phase 4: Widget & Admin UI (Weeks 7-8)

- [ ] Design and implement widget UI components
- [ ] Create widget configuration system
- [ ] Develop admin dashboard for channel management
- [ ] Implement widget embed code generator
- [ ] Design and implement basic analytics

## API Documentation

### Authentication

```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
```

### Channel Management

```
POST /api/channels
GET /api/channels
GET /api/channels/:id
PUT /api/channels/:id
DELETE /api/channels/:id
POST /api/channels/:id/refresh
```

### Widget Configuration

```
POST /api/widgets
GET /api/widgets
GET /api/widgets/:id
PUT /api/widgets/:id
GET /api/widgets/:id/embed-code
```

### Query Endpoint

```
POST /api/query
Parameters:
- question: string
- widgetId: string
- sessionId: string (optional)
```

## Deployment

### Local Development

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your API keys and configurations

# Run development server
npm run dev

# Start the full stack with Docker Compose
docker-compose up -d
```

### Services

The project includes the following services:

1. **Frontend** - Landing page and user interface
2. **API Service** - Main backend service handling API requests
3. **PostgreSQL** - Relational database for structured data
4. **Qdrant** - Vector database for embeddings and similarity search
5. **Chat Copilot WebAPI** - Semantic Kernel service for AI processing

### Accessing Services

- Frontend: http://localhost:3003
- API Service: http://localhost:3001
- PostgreSQL: localhost:5432
- Qdrant: http://localhost:6333 (REST API) and http://localhost:6333/dashboard (UI)
- Chat Copilot WebAPI: http://localhost:3080

### Production Deployment

```bash
# Build frontend assets
npm run build

# Deploy with Docker Compose
docker-compose -f docker-compose.prod.yml up -d

# For Kubernetes deployment
kubectl apply -f kubernetes/
```

See [docs/QdrantUsage.md](docs/QdrantUsage.md) for information on using the Qdrant vector database.

## Future Enhancements (Post-MVP)

- Multiple platform-specific widget versions
- Advanced customization options
- Multi-modal support (image/video frames)
- Analytics dashboard
- Conversation history
- Fine-tuning based on creator content

## License

MIT

## Contributing

This is a private project in development. Contributing guidelines will be added when the project is ready for collaboration.