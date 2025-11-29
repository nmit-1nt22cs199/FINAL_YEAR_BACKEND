import express from 'express';
import { getVehicleHistory, getVehicleHistorySummary } from '../controllers/historyController.js';

const router = express.Router();

// Get vehicle location history
router.get('/:vehicleId', getVehicleHistory);

// Get vehicle history summary (stats)
router.get('/:vehicleId/summary', getVehicleHistorySummary);

export default router;
