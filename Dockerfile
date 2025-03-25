# Multi-stage build for Admin Portal and Auth Server

# Accept build arguments
ARG PORT=3000
ARG APP_TYPE=admin-portal

# Build stage
FROM node:18-alpine AS build

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript app
RUN npm run build

# Production stage
FROM node:18-alpine

# Pass arguments to the production stage
ARG PORT
ARG APP_TYPE

WORKDIR /app

# Install curl for healthcheck
RUN apk --no-cache add curl

# Copy package files and install production dependencies
COPY package.json package-lock.json ./
RUN npm ci --production

# Copy built files from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/public ./public

# Set labels to identify the image type
LABEL app.type=$APP_TYPE

# Environment variables will be provided by docker-compose or kubernetes
# No need to copy .env.production for local development

EXPOSE $PORT

# Start the Node.js application
CMD ["node", "dist/app.js"]