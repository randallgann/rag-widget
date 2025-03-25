# YouTube RAG Widget - Setup Guide

This guide will help you set up the YouTube RAG Widget project for development.

## Prerequisites

- Node.js (v16+)
- npm or yarn
- PostgreSQL (v13+)
- TypeScript knowledge

## Initial Setup

1. **Clone the repository**

```bash
git clone <your-repository-url>
cd youtube-rag-widget
```

2. **Install dependencies**

```bash
npm install
# or
yarn install
```

3. **Set up environment variables**

```bash
cp .env.example .env
```

Edit the `.env` file with your specific configuration:
- Database credentials
- API keys (YouTube, OpenAI)
- Auth0 credentials
- Vector database credentials (Pinecone/Qdrant)

4. **Database setup**

Create a PostgreSQL database:

```bash
createdb youtube_rag_widget
```

Note: Database migrations will be implemented in a later phase.

## Development

To start the development server with hot reloading:

```bash
npm run dev
# or
yarn dev
```

The server will start on http://localhost:3000 (or the port specified in your .env file).

## Project Structure

```
src/
├── api/               # API endpoints, controllers, middlewares
├── config/            # Configuration files
├── db/                # Database models and migrations
├── services/          # Business logic services
├── types/             # TypeScript type definitions
├── utils/             # Utility functions
└── app.ts             # Main application entry point
```

## Building for Production

```bash
npm run build
# or
yarn build
```

This will compile TypeScript to JavaScript in the `dist` directory.

## Running Tests

```bash
npm test
# or
yarn test
```

## Linting

```bash
npm run lint
# or
yarn lint
```

## Next Steps

Now that the project structure is set up, the next tasks according to the roadmap are:

1. Implement basic authentication using Auth0
2. Create database schemas
3. Set up vector database
4. Implement YouTube API integration