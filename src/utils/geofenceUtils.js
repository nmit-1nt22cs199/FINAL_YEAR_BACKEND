/**
 * Geofence utility functions for geospatial calculations
 */

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lng1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lng2 - Longitude of second point
 * @returns {number} Distance in meters
 */
function getDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
}

/**
 * Check if a point is inside a circular geofence
 * @param {number} pointLat - Latitude of the point
 * @param {number} pointLng - Longitude of the point
 * @param {number} centerLat - Latitude of circle center
 * @param {number} centerLng - Longitude of circle center
 * @param {number} radius - Radius in meters
 * @returns {boolean} True if point is inside circle
 */
function isPointInCircle(pointLat, pointLng, centerLat, centerLng, radius) {
    const distance = getDistance(pointLat, pointLng, centerLat, centerLng);
    return distance <= radius;
}

/**
 * Check if a point is inside a polygon using ray casting algorithm
 * @param {number} pointLat - Latitude of the point
 * @param {number} pointLng - Longitude of the point
 * @param {Array} coordinates - Array of {lat, lng} objects defining polygon
 * @returns {boolean} True if point is inside polygon
 */
function isPointInPolygon(pointLat, pointLng, coordinates) {
    if (!coordinates || coordinates.length < 3) return false;

    let inside = false;
    for (let i = 0, j = coordinates.length - 1; i < coordinates.length; j = i++) {
        const xi = coordinates[i].lng;
        const yi = coordinates[i].lat;
        const xj = coordinates[j].lng;
        const yj = coordinates[j].lat;

        const intersect =
            yi > pointLat !== yj > pointLat &&
            pointLng < ((xj - xi) * (pointLat - yi)) / (yj - yi) + xi;

        if (intersect) inside = !inside;
    }

    return inside;
}

/**
 * Check if a point is inside a geofence
 * @param {number} lat - Latitude of the point
 * @param {number} lng - Longitude of the point
 * @param {Object} geofence - Geofence object
 * @returns {boolean} True if point is inside geofence
 */
function isPointInGeofence(lat, lng, geofence) {
    if (!geofence.active) return false;

    if (geofence.type === 'circle') {
        return isPointInCircle(
            lat,
            lng,
            geofence.center.lat,
            geofence.center.lng,
            geofence.radius
        );
    } else if (geofence.type === 'polygon') {
        return isPointInPolygon(lat, lng, geofence.coordinates);
    }

    return false;
}

/**
 * Check geofence violations for a vehicle
 * @param {number} lat - Current latitude
 * @param {number} lng - Current longitude
 * @param {Array} geofences - Array of geofence objects
 * @param {Array} previousGeofences - Array of geofence IDs vehicle was in previously
 * @returns {Object} Object containing entry and exit events
 */
function checkGeofenceViolations(lat, lng, geofences, previousGeofences = []) {
    const currentGeofences = [];
    const entries = [];
    const exits = [];

    // Check which geofences the vehicle is currently in
    geofences.forEach((geofence) => {
        if (isPointInGeofence(lat, lng, geofence)) {
            currentGeofences.push(geofence._id.toString());

            // Check if this is a new entry
            if (!previousGeofences.includes(geofence._id.toString())) {
                if (geofence.alertOnEntry) {
                    entries.push(geofence);
                }
            }
        }
    });

    // Check for exits
    previousGeofences.forEach((prevGeofenceId) => {
        if (!currentGeofences.includes(prevGeofenceId)) {
            const geofence = geofences.find(
                (g) => g._id.toString() === prevGeofenceId
            );
            if (geofence && geofence.alertOnExit) {
                exits.push(geofence);
            }
        }
    });

    return {
        currentGeofences,
        entries,
        exits
    };
}

export {
    getDistance,
    isPointInCircle,
    isPointInPolygon,
    isPointInGeofence,
    checkGeofenceViolations
};

