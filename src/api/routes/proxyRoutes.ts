import { Router } from 'express';
import { proxyThumbnail } from '../controllers/proxyController';

const router = Router();

// Route to proxy YouTube thumbnails
router.get('/thumbnail/:videoId', proxyThumbnail);

export default router;