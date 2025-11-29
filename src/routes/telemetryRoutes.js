import { Router } from 'express';
import { postTelemetry, getLatestTelemetry, getTelemetryHistory } from '../controllers/telemetryController.js';

const router = Router();

router.post('/', postTelemetry);
router.get('/', getLatestTelemetry);
router.get('/history', getTelemetryHistory);

export default router;
