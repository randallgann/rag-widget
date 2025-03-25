# PostgreSQL Database for RAG Widget

This directory contains the PostgreSQL database configuration for the RAG Widget application.

## Files

- `Dockerfile`: Configuration for the PostgreSQL container
- `init.sql`: Database initialization script that creates tables and indexes

## Schema

The database includes the following tables:

- `users`: User information with Auth0 integration
- `videos`: Information about YouTube videos
- `video_segments`: Transcript segments from videos with vector embeddings for semantic search

## Development

To modify the database schema:

1. Update the `init.sql` file with your changes
2. Rebuild the Docker container:
   ```
   docker-compose build postgres
   docker-compose up -d postgres
   ```

## Connecting to the Database

From another service in the docker-compose network:
```
DATABASE_URL=postgres://postgres:postgres@postgres:5432/youtube_rag
```

From your local machine:
```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/youtube_rag
```