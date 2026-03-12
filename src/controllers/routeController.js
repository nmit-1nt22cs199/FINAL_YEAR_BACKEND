import * as routeService from '../services/routeService.js';

/**
 * POST /api/routes/assign
 * Assign a route to a vehicle
 */
export const assignRoute = async (req, res) => {
    try {
        const { vehicleId, origin, destination, waypoints, assignedBy, encodedPolyline, distance, duration } = req.body;

        if (!vehicleId || !origin || !destination) {
            return res.status(400).json({ error: 'vehicleId, origin, and destination are required' });
        }

        if (!origin.lat || !origin.lng || !destination.lat || !destination.lng) {
            return res.status(400).json({ error: 'origin and destination must have lat and lng' });
        }

        let route;
        if (encodedPolyline) {
            route = await routeService.assignRouteWithDetails({
                vehicleId,
                origin,
                destination,
                waypoints: waypoints || [],
                assignedBy: assignedBy || '',
                encodedPolyline,
                distance,
                duration
            });
        } else {
            route = await routeService.assignRoute(vehicleId, origin, destination, waypoints || [], assignedBy || '');
        }
        return res.status(201).json({ status: 'ok', data: route });
    } catch (err) {
        console.error('[RouteController] assignRoute error:', err);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * GET /api/routes/active/:vehicleId
 * Get active route for a vehicle
 */
export const getActiveRoute = async (req, res) => {
    try {
        const { vehicleId } = req.params;
        const route = await routeService.getActiveRoute(vehicleId);

        if (!route) {
            return res.json({ status: 'ok', data: null, message: 'No active route' });
        }

        return res.json({ status: 'ok', data: route });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

/**
 * GET /api/routes
 * List all routes (optionally filter by vehicleId, status)
 */
export const getRoutes = async (req, res) => {
    try {
        const { vehicleId, status } = req.query;
        const routes = await routeService.getAllRoutes({ vehicleId, status });
        return res.json({ status: 'ok', data: routes });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

/**
 * PUT /api/routes/:id/complete
 */
export const completeRoute = async (req, res) => {
    try {
        const route = await routeService.completeRoute(req.params.id);
        if (!route) return res.status(404).json({ error: 'Route not found' });
        return res.json({ status: 'ok', data: route });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

/**
 * PUT /api/routes/:id/cancel
 */
export const cancelRoute = async (req, res) => {
    try {
        const route = await routeService.cancelRoute(req.params.id);
        if (!route) return res.status(404).json({ error: 'Route not found' });
        return res.json({ status: 'ok', data: route });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
