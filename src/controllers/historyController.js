import Telemetry from '../models/Telemetry.js';

/**
 * Get vehicle location history
 * Query params:
 *  - startDate: ISO date string (optional)
 *  - endDate: ISO date string (optional)
 *  - days: number of days to look back (default: 1 for today)
 */
export const getVehicleHistory = async (req, res) => {
    try {
        const { vehicleId } = req.params;
        const { startDate, endDate, days = 1 } = req.query;

        if (!vehicleId) {
            return res.status(400).json({ error: 'vehicleId is required' });
        }

        // Calculate date range
        let start, end;

        if (startDate && endDate) {
            // Use provided date range
            start = new Date(startDate);
            end = new Date(endDate);
        } else {
            // Calculate based on days parameter
            end = new Date(); // Now
            start = new Date();
            start.setDate(start.getDate() - parseInt(days));
            start.setHours(0, 0, 0, 0); // Start of day
        }

        // Query telemetry data for this vehicle in the date range
        const history = await Telemetry.find({
            vehicleId,
            timestamp: { $gte: start, $lte: end },
            'location.lat': { $exists: true },
            'location.lng': { $exists: true }
        })
            .select('location timestamp speed')
            .sort({ timestamp: 1 }) // Ascending order for route
            .limit(1000) // Limit to prevent huge responses
            .lean();

        // Format response
        const locations = history.map(item => ({
            lat: item.location.lat,
            lng: item.location.lng,
            timestamp: item.timestamp,
            speed: item.speed
        }));

        res.json({
            vehicleId,
            startDate: start,
            endDate: end,
            count: locations.length,
            locations
        });

    } catch (error) {
        console.error('Error fetching vehicle history:', error);
        res.status(500).json({ error: 'Failed to fetch vehicle history' });
    }
};

/**
 * Get summary of vehicle history (distance, duration, etc.)
 */
export const getVehicleHistorySummary = async (req, res) => {
    try {
        const { vehicleId } = req.params;
        const { days = 1 } = req.query;

        // Calculate date range
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - parseInt(days));
        start.setHours(0, 0, 0, 0);

        const history = await Telemetry.find({
            vehicleId,
            timestamp: { $gte: start, $lte: end },
            'location.lat': { $exists: true }
        })
            .select('location timestamp speed')
            .sort({ timestamp: 1 })
            .lean();

        if (history.length === 0) {
            return res.json({
                vehicleId,
                hasData: false,
                message: 'No history data available for this period'
            });
        }

        // Calculate statistics
        const firstPoint = history[0];
        const lastPoint = history[history.length - 1];

        // Calculate approximate distance using Haversine formula
        let totalDistance = 0;
        for (let i = 1; i < history.length; i++) {
            const prev = history[i - 1].location;
            const curr = history[i].location;
            totalDistance += calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);
        }

        const duration = new Date(lastPoint.timestamp) - new Date(firstPoint.timestamp);
        const avgSpeed = history.reduce((sum, h) => sum + (h.speed || 0), 0) / history.length;

        res.json({
            vehicleId,
            hasData: true,
            startTime: firstPoint.timestamp,
            endTime: lastPoint.timestamp,
            duration: duration, // milliseconds
            durationFormatted: formatDuration(duration),
            distance: Math.round(totalDistance * 100) / 100, // km, rounded to 2 decimals
            pointsCount: history.length,
            averageSpeed: Math.round(avgSpeed * 10) / 10,
            startLocation: firstPoint.location,
            endLocation: lastPoint.location
        });

    } catch (error) {
        console.error('Error fetching history summary:', error);
        res.status(500).json({ error: 'Failed to fetch history summary' });
    }
};

// Helper: Calculate distance between two lat/lng points (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(degrees) {
    return degrees * (Math.PI / 180);
}

// Helper: Format duration in human-readable format
function formatDuration(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}
