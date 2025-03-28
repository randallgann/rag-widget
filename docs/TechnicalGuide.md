# Technical Guide

## System Requirements

- Node.js 18+
- Docker and Docker Compose
- PostgreSQL 14+
- Auth0 account
- YouTube API credentials

## Development Setup

1. **Clone the repositories**
   ```bash
   git clone <repo-url>/rag-widget.git
   git clone <repo-url>/test-landing-page.git
   ```

2. **Install dependencies**
   ```bash
   # For rag-widget
   cd rag-widget
   npm install

   # For test-landing-page
   cd ../test-landing-page
   npm install
   ```

3. **Environment Setup**
   
   Create `.env` files in both project roots based on the provided `.env.example` files.

   **Required environment variables for rag-widget:**
   - `PORT` - API server port (default: 3000)
   - `NODE_ENV` - Environment (development, production)
   - `DB_HOST` - PostgreSQL host
   - `DB_PORT` - PostgreSQL port
   - `DB_USERNAME` - Database username
   - `DB_PASSWORD` - Database password
   - `DB_NAME` - Database name
   - `AUTH0_DOMAIN` - Auth0 domain
   - `AUTH0_AUDIENCE` - Auth0 API audience identifier

   **Required environment variables for test-landing-page:**
   - `PORT` - Auth server port (default: 3001)
   - `AUTH0_SECRET` - Auth0 secret
   - `AUTH0_CLIENT_ID` - Auth0 client ID
   - `AUTH0_DOMAIN` - Auth0 domain
   - `AUTH0_CLIENT_SECRET` - Auth0 client secret
   - `ADMIN_PORTAL_URL` - URL to admin portal (default: http://localhost:3001)
   - `REACT_APP_URL` - URL to landing page (default: http://localhost:3003)

4. **Database Setup**
   
   The PostgreSQL database schema will be initialized when running with Docker Compose. For local development, run the migration:
   
   ```bash
   cd rag-widget
   npx sequelize-cli db:migrate
   ```

5. **Running the Application**

   Using Docker Compose (recommended):
   ```bash
   cd rag-widget
   docker-compose up
   ```

   For local development:
   ```bash
   # In rag-widget directory
   npm run dev

   # In test-landing-page directory
   npm run dev
   ```

## Project Structure

### RAG Widget

```
/rag-widget
├── src/
│   ├── api/             # API controllers, routes, middlewares
│   ├── config/          # Configuration and environment
│   ├── db/              # Database models and migrations
│   ├── services/        # Business logic services
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Helper functions
│   ├── views/           # React components for admin portal
│   └── app.ts           # Main application entry
├── public/              # Static assets and embeddable widget
│   └── widget/          # Embeddable widget assets
└── tests/               # Test suite
```

### Landing Page

```
/test-landing-page
├── src/                # React application source
│   ├── components/     # UI components
│   ├── contexts/       # React contexts (Auth)
│   ├── pages/          # Page components
│   └── styles/         # CSS and styling
├── server/             # Auth server implementation
│   └── server.js       # Express auth server
└── public/             # Static assets
```

## Key Design Patterns

1. **Model-View-Controller (MVC)**
   - Models: Sequelize models in `src/db/models/`
   - Views: React components in `src/views/`
   - Controllers: Express controllers in `src/api/controllers/`

2. **Service Pattern**
   - Business logic encapsulated in services (`src/services/`)
   - Controllers utilize services rather than implementing logic directly

3. **Repository Pattern**
   - Database access through models with consistent interfaces
   - Vector database access through specialized services

## Authentication

The application uses Auth0 for authentication:

1. Users navigate to the landing page
2. Authentication flow begins using Express-OpenID-Connect
3. Auth0 handles user login/registration
4. After successful authentication, tokens are passed to the Admin Portal
5. Admin Portal uses these tokens to authenticate API requests

## Widget Integration

Content creators can embed the widget on their websites by adding the following script:

```html
<script 
  src="https://your-domain.com/widget/js/widget.js" 
  data-widget-id="YOUR_WIDGET_ID">
</script>
```

## Development Workflow

1. **Adding New Features**
   - Create feature branch
   - Implement changes with appropriate tests
   - Submit PR for review

2. **API Changes**
   - Update TypeScript interfaces in `src/types/`
   - Update API controllers and routes
   - Update corresponding service implementations

3. **Testing**
   - Unit tests: `npm test`
   - Integration tests: `npm run test:integration`
   - End-to-end tests: `npm run test:e2e`

## Common Troubleshooting

1. **Docker Issues**
   - Ensure ports 3000, 3001, 3003, and 5432 are available
   - Check Docker logs with `docker-compose logs`

2. **Authentication Problems**
   - Verify Auth0 configuration in both applications
   - Check CORS settings if cross-origin issues occur

3. **Database Connectivity**
   - Ensure PostgreSQL is running and accessible
   - Verify database credentials and connection string