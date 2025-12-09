import express from 'express';
import {
    createGeofence,
    getAllGeofences,
    getGeofenceById,
    updateGeofence,
    deleteGeofence,
    toggleGeofence
} from '../controllers/geofenceController.js';

const router = express.Router();

// Create a new geofence
router.post('/', createGeofence);

// Get all geofences
router.get('/', getAllGeofences);

// Get a single geofence by ID
router.get('/:id', getGeofenceById);

// Update a geofence
router.put('/:id', updateGeofence);

// Delete a geofence
router.delete('/:id', deleteGeofence);

// Toggle geofence active status
router.patch('/:id/toggle', toggleGeofence);

export default router;
