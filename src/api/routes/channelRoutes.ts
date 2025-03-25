import { Router } from 'express';
import { validateAuth0Token, requireAuth } from '../middlewares/auth';
import {
  validateChannel,
  getAllChannels,
  createChannel,
  getChannelById,
  updateChannel,
  deleteChannel
} from '../controllers/channelController';
import { processChannelVideos } from '../controllers/videoController';

const router = Router();

/**
 * @route   POST /api/channels/validate
 * @desc    Validate a YouTube channel
 * @access  Public - No auth required for validation
 */
router.post('/validate', validateChannel);

/**
 * @route   GET /api/channels
 * @desc    Get all channels for the authenticated user
 * @access  Private
 */
router.get('/', validateAuth0Token, requireAuth, getAllChannels);

/**
 * @route   POST /api/channels
 * @desc    Create a new channel
 * @access  Private
 */
router.post('/', validateAuth0Token, requireAuth, createChannel);

/**
 * @route   GET /api/channels/:id
 * @desc    Get a channel by ID
 * @access  Private
 */
router.get('/:id', validateAuth0Token, requireAuth, getChannelById);

/**
 * @route   PUT /api/channels/:id
 * @desc    Update a channel
 * @access  Private
 */
router.put('/:id', validateAuth0Token, requireAuth, updateChannel);

/**
 * @route   DELETE /api/channels/:id
 * @desc    Delete a channel
 * @access  Private
 */
router.delete('/:id', validateAuth0Token, requireAuth, deleteChannel);

/**
 * @route   POST /api/channels/:id/process
 * @desc    Process selected videos for a channel
 * @access  Private
 */
router.post('/:id/process', validateAuth0Token, requireAuth, processChannelVideos);

export default router;