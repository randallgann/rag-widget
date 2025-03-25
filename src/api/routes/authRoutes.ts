import { Router } from 'express';
import { 
  initiateLogin,
  handleCallback,
  exchangeStateToken,
  refreshToken,
  refreshTokenFallback,
  handleReauthRequired,
  // Keep existing controller methods
  getUserProfile,
  handleTokenValidation,
  checkAuth,
  logout
} from '../controllers/authController';
import { validateAuth0Token, requireAuth } from '../middlewares/auth';

const router = Router();

/**
 * @route   GET /api/auth/login
 * @desc    Initiate login with PKCE
 * @access  Public
 */
router.get('/login', initiateLogin);

/**
 * @route   GET /api/auth/callback
 * @desc    Handle Auth0 callback after login with PKCE
 * @access  Public
 */
router.get('/callback', handleCallback);

/**
 * @route   POST /api/auth/token-exchange
 * @desc    Exchange state token for access token
 * @access  Public
 */
router.post('/token-exchange', exchangeStateToken);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token from cookies
 * @access  Public
 */
router.post('/refresh', refreshToken);

/**
 * @route   POST /api/auth/refresh-fallback
 * @desc    Fallback refresh endpoint for browsers with strict cookie policies
 * @access  Public
 */
router.post('/refresh-fallback', refreshTokenFallback);

/**
 * @route   POST /api/auth/reauth-required
 * @desc    Handle cases where re-authentication is required
 * @access  Public
 */
router.post('/reauth-required', handleReauthRequired);

/**
 * @route   POST /api/auth/validate-token
 * @desc    Validate token from cookies or Auth header
 * @access  Public
 */
router.post('/validate-token', handleTokenValidation);

/**
 * @route   GET /api/auth/check
 * @desc    Check if user is authenticated
 * @access  Public
 */
router.get('/check', checkAuth);

/**
 * @route   GET /api/auth/profile
 * @desc    Get user profile
 * @access  Private
 */
router.get('/profile', validateAuth0Token, requireAuth, getUserProfile);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout and clear auth cookies
 * @access  Public
 */
router.post('/logout', logout);

export default router;