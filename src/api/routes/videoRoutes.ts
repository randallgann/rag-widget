import { Router } from 'express';
import { validateAuth0Token, requireAuth } from '../middlewares/auth';
import {
  updateVideoSelection,
  updateBatchVideoSelection,
  processChannelVideos,
  getVideoProcessingStatus,
  getBatchVideoProcessingStatus
} from '../controllers/videoController';

const router = Router();

/**
 * @route   PUT /api/videos/:id/select
 * @desc    Update a video's selection status
 * @access  Private
 */
router.put('/:id/select', validateAuth0Token, requireAuth, updateVideoSelection);

/**
 * @route   PUT /api/videos/select-batch
 * @desc    Update selection status for multiple videos
 * @access  Private
 */
router.put('/select-batch', validateAuth0Token, requireAuth, updateBatchVideoSelection);

/**
 * @route   POST /api/channels/:channelId/process
 * @desc    Process selected videos in a channel
 * @access  Private
 */
router.post('/channels/:channelId/process', validateAuth0Token, requireAuth, processChannelVideos);

/**
 * @route   GET /api/videos/:id/status
 * @desc    Get processing status for a video
 * @access  Private
 */
router.get('/:id/status', validateAuth0Token, requireAuth, getVideoProcessingStatus);

/**
 * @route   POST /api/videos/status-batch
 * @desc    Get processing status for multiple videos
 * @access  Private
 */
router.post('/status-batch', validateAuth0Token, requireAuth, getBatchVideoProcessingStatus);

export default router;