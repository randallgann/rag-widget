FROM postgres:15

# Install pgvector extension dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       build-essential \
       postgresql-server-dev-15 \
       git \
       ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install pgvector extension
RUN cd /tmp \
    && git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git \
    && cd pgvector \
    && make \
    && make install \
    && cd / \
    && rm -rf /tmp/pgvector

# Environment variables will be set in docker-compose.yml
# POSTGRES_USER=postgres
# POSTGRES_PASSWORD=postgres
# POSTGRES_DB=youtube_rag

# Copy initialization scripts
COPY init.sql /docker-entrypoint-initdb.d/

# Custom PostgreSQL configuration (optional)
# COPY postgresql.conf /etc/postgresql/postgresql.conf

# Expose the PostgreSQL port
EXPOSE 5432

# The base postgres image already includes a CMD to start PostgreSQL