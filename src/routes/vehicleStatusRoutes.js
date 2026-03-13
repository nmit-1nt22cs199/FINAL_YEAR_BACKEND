import { Router } from 'express';
import { getVehicleStatus } from '../controllers/vehicleStatusController.js';

const router = Router();

router.get('/:vehicleId/status', getVehicleStatus);

export default router;
