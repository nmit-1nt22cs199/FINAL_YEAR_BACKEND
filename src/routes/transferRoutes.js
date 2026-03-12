import { Router } from 'express';
import {
    initiateTransfer,
    verifyTransfer,
    getTransferSession,
    getTransferHistory,
    cancelTransfer,
    getActiveSessions,
    getMyActiveSessions
} from '../controllers/transferController.js';
import { authenticate, authorize } from '../middleware/authMiddleware.js';

const router = Router();

// All transfer routes require authentication
router.use(authenticate);

// Initiate transfer - sender or admin only
router.post('/initiate', authorize('sender', 'admin'), initiateTransfer);

// Verify transfer - receiver or admin
router.post('/verify', authorize('receiver', 'admin'), verifyTransfer);

// Get transfer history for a vehicle
router.get('/history/:vehicleId', getTransferHistory);

// Cancel transfer - sender or admin
router.post('/cancel/:sessionId', authorize('sender', 'admin'), cancelTransfer);

// Get active sessions - admin only
router.get('/active', authorize('admin'), getActiveSessions);

// Get active sessions for current user
router.get('/my', getMyActiveSessions);

// Get transfer session details (keep last to avoid route conflicts)
router.get('/:sessionId', getTransferSession);

export default router;
