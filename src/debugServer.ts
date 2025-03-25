import express, { Application, Request, Response, Router } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import path from 'path';

const app: Application = express();
const PORT = 3002; // Different port to avoid conflicts

// Create a router for auth routes
const authRouter = Router();

// Simple login handler that you can set breakpoints in
authRouter.get('/login', (req: Request, res: Response) => {
  console.log('Login endpoint accessed');
  
  // This is where you can set breakpoints
  const codeVerifier = crypto.randomBytes(32).toString('hex');
  const state = crypto.randomBytes(16).toString('hex');
  
  // Generate a mock auth URL
  const authUrl = `https://example.auth0.com/authorize?response_type=code&client_id=your_client_id&redirect_uri=http://localhost:3002/api/auth/callback&state=${state}`;
  
  // Redirect to the auth URL (as your real handler does)
  res.redirect(authUrl);
});

// Define a simple callback handler
authRouter.get('/callback', (req: Request, res: Response) => {
  console.log('Callback endpoint accessed');
  res.redirect('/dashboard');
});

// Mount the auth router at /api/auth - THIS IS KEY!
app.use('/api/auth', authRouter);

// Middleware - similar to your real app
app.use(session({
  secret: 'debug-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));
app.use(cors());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

// Simple handler for the root path
app.get('/', (req: Request, res: Response) => {
  res.send(`
    <h1>Debug Auth Server</h1>
    <p>Try accessing <a href="/api/auth/login">/api/auth/login</a></p>
  `);
});

// SPA fallback route
app.get('/dashboard', (req: Request, res: Response) => {
  res.send('Dashboard page');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Debug auth server running at http://localhost:${PORT}`);
  console.log(`Try accessing http://localhost:${PORT}/api/auth/login`);
});