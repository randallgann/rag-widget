import express from 'express';
import * as webhookController from '../controllers/webhookController';

const router = express.Router();

/**
 * @route   POST /api/webhooks/kernel
 * @desc    Handle webhook notifications from the kernel service
 * @access  Public - Secured with API key
 */
router.post('/kernel', webhookController.handleKernelWebhook);

export default router;