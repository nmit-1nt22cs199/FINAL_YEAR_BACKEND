import { Router } from 'express';
import { getVehicleStatus, updateVehicleStatus } from '../controllers/vehicleStatusController.js';

const router = Router();

router.get('/:vehicleId/status', getVehicleStatus);
router.put('/:vehicleId/status', updateVehicleStatus);

export default router;
