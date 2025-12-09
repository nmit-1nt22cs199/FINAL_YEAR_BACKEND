import Geofence from '../models/Geofence.js';

/**
 * Create a new geofence
 */
const createGeofence = async (req, res) => {
    try {
        const geofenceData = req.body;

        // Validate required fields based on type
        if (geofenceData.type === 'circle') {
            if (!geofenceData.center || !geofenceData.radius) {
                return res.status(400).json({
                    error: 'Circle geofences require center and radius'
                });
            }
        } else if (geofenceData.type === 'polygon') {
            if (!geofenceData.coordinates || geofenceData.coordinates.length < 3) {
                return res.status(400).json({
                    error: 'Polygon geofences require at least 3 coordinates'
                });
            }
        }

        const geofence = new Geofence(geofenceData);
        await geofence.save();

        res.status(201).json({
            message: 'Geofence created successfully',
            geofence
        });
    } catch (error) {
        console.error('Error creating geofence:', error);
        res.status(500).json({
            error: 'Failed to create geofence',
            details: error.message
        });
    }
};

/**
 * Get all geofences
 */
const getAllGeofences = async (req, res) => {
    try {
        const { active } = req.query;
        const filter = {};

        if (active !== undefined) {
            filter.active = active === 'true';
        }

        const geofences = await Geofence.find(filter).sort({ createdAt: -1 });

        res.json({
            count: geofences.length,
            geofences
        });
    } catch (error) {
        console.error('Error fetching geofences:', error);
        res.status(500).json({
            error: 'Failed to fetch geofences',
            details: error.message
        });
    }
};

/**
 * Get a single geofence by ID
 */
const getGeofenceById = async (req, res) => {
    try {
        const { id } = req.params;
        const geofence = await Geofence.findById(id);

        if (!geofence) {
            return res.status(404).json({ error: 'Geofence not found' });
        }

        res.json({ geofence });
    } catch (error) {
        console.error('Error fetching geofence:', error);
        res.status(500).json({
            error: 'Failed to fetch geofence',
            details: error.message
        });
    }
};

/**
 * Update a geofence
 */
const updateGeofence = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const geofence = await Geofence.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!geofence) {
            return res.status(404).json({ error: 'Geofence not found' });
        }

        res.json({
            message: 'Geofence updated successfully',
            geofence
        });
    } catch (error) {
        console.error('Error updating geofence:', error);
        res.status(500).json({
            error: 'Failed to update geofence',
            details: error.message
        });
    }
};

/**
 * Delete a geofence
 */
const deleteGeofence = async (req, res) => {
    try {
        const { id } = req.params;
        const geofence = await Geofence.findByIdAndDelete(id);

        if (!geofence) {
            return res.status(404).json({ error: 'Geofence not found' });
        }

        res.json({
            message: 'Geofence deleted successfully',
            geofence
        });
    } catch (error) {
        console.error('Error deleting geofence:', error);
        res.status(500).json({
            error: 'Failed to delete geofence',
            details: error.message
        });
    }
};

/**
 * Toggle geofence active status
 */
const toggleGeofence = async (req, res) => {
    try {
        const { id } = req.params;
        const geofence = await Geofence.findById(id);

        if (!geofence) {
            return res.status(404).json({ error: 'Geofence not found' });
        }

        geofence.active = !geofence.active;
        await geofence.save();

        res.json({
            message: `Geofence ${geofence.active ? 'activated' : 'deactivated'}`,
            geofence
        });
    } catch (error) {
        console.error('Error toggling geofence:', error);
        res.status(500).json({
            error: 'Failed to toggle geofence',
            details: error.message
        });
    }
};

export {
    createGeofence,
    getAllGeofences,
    getGeofenceById,
    updateGeofence,
    deleteGeofence,
    toggleGeofence
};

