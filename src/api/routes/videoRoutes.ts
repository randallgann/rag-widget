import { Router } from 'express';
import { validateAuth0Token, requireAuth } from '../middlewares/auth';
import {
  updateVideoSelection,
  updateBatchVideoSelection,
  processChannelVideos,
  getVideoProcessingStatus,
  getBatchVideoProcessingStatus,
  getDetailedVideoProcessingStatus,
  resetVideoProcessing
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

/**
 * @route   GET /api/videos/:id/status-detailed
 * @desc    Get detailed processing status for a video
 * @access  Private
 */
router.get('/:id/status-detailed', validateAuth0Token, requireAuth, getDetailedVideoProcessingStatus);

/**
 * @route   PUT /api/videos/:id/reset-processing
 * @desc    Reset the processing status of a video to pending
 * @access  Private
 */
router.put('/:id/reset-processing', validateAuth0Token, requireAuth, resetVideoProcessing);

export default router;