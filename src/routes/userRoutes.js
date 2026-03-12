import { Router } from 'express';
import {
    register,
    login,
    assignUserToVehicle,
    unassignUser,
    getUsers,
    getUserById,
    updateUser
} from '../controllers/userController.js';
import '../controllers/alertsController.js'
import { authenticate, authorize } from '../middleware/authMiddleware.js';

const router = Router();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes - require authentication
router.get('/', authenticate, authorize('admin'), getUsers);
router.get('/:id', authenticate, getUserById);
router.put('/:id', authenticate, updateUser);

// Admin only routes
router.post('/assign', authenticate, authorize('admin'), assignUserToVehicle);
router.post('/unassign/:id', authenticate, authorize('admin'), unassignUser);

export default router;
