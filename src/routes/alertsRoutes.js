import { Router } from 'express';
import { createAlert, getAlerts, acknowledgeAlert } from '../controllers/alertsController.js';

const router = Router();

router.post('/', createAlert);
router.get('/', getAlerts);
router.post('/ack/:id', acknowledgeAlert);

export default router;
