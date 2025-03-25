import { Router } from 'express';
import { 
  getDashboardStats,
  getUserChannels,
  getUserWidgets
} from '../controllers/dashboardController';
import { validateAuth0Token, requireAuth } from '../middlewares/auth';

const router = Router();

/**
 * @route   GET /api/dashboard/stats
 * @desc    Get dashboard stats for a user
 * @access  Private
 */
router.get('/stats', validateAuth0Token, requireAuth, getDashboardStats);

/**
 * @route   GET /api/dashboard/channels
 * @desc    Get channels for a user
 * @access  Private
 */
router.get('/channels', validateAuth0Token, requireAuth, getUserChannels);

/**
 * @route   GET /api/dashboard/widgets
 * @desc    Get widgets for a user
 * @access  Private
 */
router.get('/widgets', validateAuth0Token, requireAuth, getUserWidgets);

export default router;