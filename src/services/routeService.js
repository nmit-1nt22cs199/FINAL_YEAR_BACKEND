import Route from '../models/Route.js';

const OLA_API_KEY = process.env.OLA_MAPS_API_KEY || '';

/**
 * Decode Google Encoded Polyline
 */
function decodePolyline(encoded) {
    let index = 0, lat = 0, lng = 0, coordinates = [];

    while (index < encoded.length) {
        let b, shift = 0, result = 0;

        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);

        const deltaLat = (result & 1) ? ~(result >> 1) : result >> 1;
        lat += deltaLat;

        shift = 0;
        result = 0;

        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);

        const deltaLng = (result & 1) ? ~(result >> 1) : result >> 1;
        lng += deltaLng;

        coordinates.push([lng / 1e5, lat / 1e5]);
    }

    return coordinates;
}

/**
 * Assign a route to a vehicle by calling OLA Maps Directions API
 */
export const assignRoute = async (vehicleId, origin, destination, waypoints = [], assignedBy = '') => {
    if (!OLA_API_KEY) {
        throw new Error('OLA_MAPS_API_KEY missing on backend');
    }
    // Build the OLA Directions API URL
    const wp = waypoints.map(w => `${w.lat},${w.lng}`).join('%7C');
    const url = `https://api.olamaps.io/routing/v1/directions/basic?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}${wp ? `&waypoints=${wp}` : ''}&api_key=${OLA_API_KEY}`;

    // Call OLA Directions API
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'X-Request-Id': `route-${vehicleId}-${Date.now()}`
        }
    });

    const data = await res.json();

    if (!data.routes || !data.routes[0]) {
        throw new Error('No route found from OLA Maps API');
    }

    const routeData = data.routes[0];
    const encodedPolyline = routeData.overview_polyline;
    const decodedPath = decodePolyline(encodedPolyline);

    // Extract distance and duration from legs
    let totalDistance = 0;
    let totalDuration = 0;
    if (routeData.legs) {
        routeData.legs.forEach(leg => {
            const legDistance = leg.distance?.value ?? leg.distance ?? 0;
            const legDuration = leg.duration?.value ?? leg.duration ?? 0;
            totalDistance += legDistance;
            totalDuration += legDuration;
        });
    }

    // Cancel any existing active routes for this vehicle
    await Route.updateMany(
        { vehicleId, status: { $in: ['assigned', 'in-progress'] } },
        { status: 'cancelled', updatedAt: new Date() }
    );

    // Create new route
    const route = new Route({
        vehicleId,
        origin: { lat: origin.lat, lng: origin.lng, address: origin.address || '' },
        destination: { lat: destination.lat, lng: destination.lng, address: destination.address || '' },
        waypoints,
        encodedPolyline,
        decodedPath,
        distance: totalDistance,
        duration: totalDuration,
        status: 'assigned',
        assignedBy,
        createdAt: new Date(),
        updatedAt: new Date()
    });

    await route.save();
    console.log(`🛣️ Route assigned for vehicle ${vehicleId}`);

    return route;
};

/**
 * Assign a route using client-provided route details (no external API call)
 */
export const assignRouteWithDetails = async ({
    vehicleId,
    origin,
    destination,
    waypoints = [],
    assignedBy = '',
    encodedPolyline,
    distance = 0,
    duration = 0
}) => {
    if (!encodedPolyline) {
        throw new Error('encodedPolyline is required');
    }

    const decodedPath = decodePolyline(encodedPolyline);

    // Cancel any existing active routes for this vehicle
    await Route.updateMany(
        { vehicleId, status: { $in: ['assigned', 'in-progress'] } },
        { status: 'cancelled', updatedAt: new Date() }
    );

    const route = new Route({
        vehicleId,
        origin: { lat: origin.lat, lng: origin.lng, address: origin.address || '' },
        destination: { lat: destination.lat, lng: destination.lng, address: destination.address || '' },
        waypoints,
        encodedPolyline,
        decodedPath,
        distance: Number(distance) || 0,
        duration: Number(duration) || 0,
        status: 'assigned',
        assignedBy,
        createdAt: new Date(),
        updatedAt: new Date()
    });

    await route.save();
    console.log(`ðŸ›£ï¸ Route assigned (client details) for vehicle ${vehicleId}`);

    return route;
};

/**
 * Get the currently active route for a vehicle
 */
export const getActiveRoute = async (vehicleId) => {
    return Route.findOne({
        vehicleId,
        status: { $in: ['assigned', 'in-progress'] }
    }).sort({ createdAt: -1 });
};

/**
 * Get all routes, optionally filtered
 */
export const getAllRoutes = async (filters = {}) => {
    const query = {};
    if (filters.vehicleId) query.vehicleId = filters.vehicleId;
    if (filters.status) query.status = filters.status;

    return Route.find(query).sort({ createdAt: -1 });
};

/**
 * Complete a route
 */
export const completeRoute = async (routeId) => {
    return Route.findByIdAndUpdate(
        routeId,
        { status: 'completed', updatedAt: new Date() },
        { new: true }
    );
};

/**
 * Cancel a route
 */
export const cancelRoute = async (routeId) => {
    return Route.findByIdAndUpdate(
        routeId,
        { status: 'cancelled', updatedAt: new Date() },
        { new: true }
    );
};
