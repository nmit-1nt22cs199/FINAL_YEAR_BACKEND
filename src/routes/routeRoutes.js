import { Router } from 'express';
import {
    assignRoute,
    getActiveRoute,
    getRoutes,
    completeRoute,
    cancelRoute
} from '../controllers/routeController.js';

const router = Router();

router.post('/assign', assignRoute);
router.get('/active/:vehicleId', getActiveRoute);
router.get('/', getRoutes);
router.put('/:id/complete', completeRoute);
router.put('/:id/cancel', cancelRoute);

export default router;
