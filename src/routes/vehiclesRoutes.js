import { Router } from 'express';
import {
	getVehicles,
	getVehicleById,
	createVehicle,
	updateVehicle,
	deleteVehicle
} from '../controllers/vehiclesController.js';

const router = Router();

router.get('/', getVehicles);
router.get('/:id', getVehicleById);
router.post('/', createVehicle);
router.put('/:id', updateVehicle);
router.delete('/:id', deleteVehicle);

export default router;
