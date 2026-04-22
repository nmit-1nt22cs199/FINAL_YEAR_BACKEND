import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import * as notificationController from '../controllers/notificationController.js';

const router = express.Router();

// All notification routes are protected
router.use(authenticate);

router.get('/', notificationController.getMyNotifications);
router.put('/:id/read', notificationController.markAsRead);
router.delete('/:id', notificationController.deleteNotification);

export default router;
