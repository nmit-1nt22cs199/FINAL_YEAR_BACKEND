import Alert from '../models/Alert.js';
import Route from '../models/Route.js';
import { getIo } from '../socket.js';

// -------------------------------------------------------
// In-memory state for anomaly detection
// -------------------------------------------------------
const vehicleStopTimestamps = new Map();   // vehicleId -> Date when speed first hit 0
const vehiclePrevDoorStatus = new Map();   // vehicleId -> previous doorStatus

// Configurable thresholds
const UNEXPECTED_STOP_MINUTES = 5;
const ROUTE_DEVIATION_METERS = 500;
const VIBRATION_THRESHOLD = 80;

/**
 * Main anomaly processing function — called on every telemetry update
 */
export const processTelemetryAnomalies = async (vehicleId, telemetryData) => {
    if (!vehicleId || !telemetryData) return;

    const alerts = [];

    try {
        // 1. Unexpected Stop Detection
        const stopAlert = detectUnexpectedStop(vehicleId, telemetryData);
        if (stopAlert) alerts.push(stopAlert);

        // 2. Route Deviation Detection
        const deviationAlert = await detectRouteDeviation(vehicleId, telemetryData);
        if (deviationAlert) alerts.push(deviationAlert);

        // 3. Unauthorized Door Opening
        const doorAlert = detectUnauthorizedDoor(vehicleId, telemetryData);
        if (doorAlert) alerts.push(doorAlert);

        // 4. Tamper / Vibration Detection
        const tamperAlert = detectTampering(vehicleId, telemetryData);
        if (tamperAlert) alerts.push(tamperAlert);

        // Save and emit all alerts
        if (alerts.length > 0) {
            const savedAlerts = await Alert.insertMany(alerts);
            const io = getIo();
            if (io) {
                savedAlerts.forEach(alert => {
                    io.emit('alert_triggered', alert);
                    io.emit('vehicle:alert', alert);
                });
            }
        }
    } catch (error) {
        console.error('[AnomalyService] Error processing anomalies:', error);
    }

    return alerts;
};

// -------------------------------------------------------
// 1. UNEXPECTED STOP DETECTION
// -------------------------------------------------------
function detectUnexpectedStop(vehicleId, data) {
    const speed = data.speed ?? -1;

    if (speed <= 0) {
        // Vehicle is stopped
        if (!vehicleStopTimestamps.has(vehicleId)) {
            vehicleStopTimestamps.set(vehicleId, new Date());
        } else {
            const stoppedSince = vehicleStopTimestamps.get(vehicleId);
            const minutesStopped = (Date.now() - stoppedSince.getTime()) / (1000 * 60);

            if (minutesStopped >= UNEXPECTED_STOP_MINUTES) {
                // Clear so we don't repeatedly alert for the same stop
                vehicleStopTimestamps.delete(vehicleId);

                return {
                    vehicleId,
                    type: 'unexpected_stop',
                    message: `Vehicle stopped unexpectedly for ${Math.round(minutesStopped)} minutes`,
                    level: 'high',
                    metadata: {
                        location: data.location,
                        minutesStopped: Math.round(minutesStopped),
                        stoppedSince: stoppedSince.toISOString()
                    },
                    createdAt: new Date()
                };
            }
        }
    } else {
        // Vehicle is moving — clear the stop tracker
        vehicleStopTimestamps.delete(vehicleId);
    }

    return null;
}

// -------------------------------------------------------
// 2. ROUTE DEVIATION DETECTION
// -------------------------------------------------------
async function detectRouteDeviation(vehicleId, data) {
    if (!data.location?.lat || !data.location?.lng) return null;

    try {
        // Find active route for this vehicle
        const activeRoute = await Route.findOne({
            vehicleId,
            status: { $in: ['assigned', 'in-progress'] }
        });

        if (!activeRoute || !activeRoute.decodedPath || activeRoute.decodedPath.length < 2) {
            return null;
        }

        // Auto-transition from assigned to in-progress
        if (activeRoute.status === 'assigned') {
            activeRoute.status = 'in-progress';
            activeRoute.updatedAt = new Date();
            await activeRoute.save();
        }

        // Calculate minimum distance to the route polyline
        const minDistance = distanceToPolyline(
            data.location.lat,
            data.location.lng,
            activeRoute.decodedPath
        );

        if (minDistance > ROUTE_DEVIATION_METERS) {
            return {
                vehicleId,
                type: 'route_deviation',
                message: `Vehicle deviated ${Math.round(minDistance)}m from assigned route`,
                level: 'high',
                metadata: {
                    location: data.location,
                    deviationMeters: Math.round(minDistance),
                    routeId: activeRoute._id,
                    threshold: ROUTE_DEVIATION_METERS
                },
                createdAt: new Date()
            };
        }
    } catch (error) {
        console.error('[AnomalyService] Route deviation check error:', error);
    }

    return null;
}

// -------------------------------------------------------
// 3. UNAUTHORIZED DOOR OPENING
// -------------------------------------------------------
function detectUnauthorizedDoor(vehicleId, data) {
    const currentDoor = data.doorStatus;
    const previousDoor = vehiclePrevDoorStatus.get(vehicleId);

    // Update tracked state
    if (currentDoor) {
        vehiclePrevDoorStatus.set(vehicleId, currentDoor);
    }

    // Door changed from closed to open
    if (previousDoor === 'closed' && currentDoor === 'open') {
        const speed = data.speed ?? 0;

        // Suspicious if door opens while moving
        if (speed > 5) {
            return {
                vehicleId,
                type: 'unauthorized_door',
                message: `Door opened while vehicle in motion (${Math.round(speed)} km/h)`,
                level: 'high',
                metadata: {
                    location: data.location,
                    speed: speed,
                    doorStatus: currentDoor
                },
                createdAt: new Date()
            };
        }
    }

    return null;
}

// -------------------------------------------------------
// 4. TAMPER / VIBRATION DETECTION
// -------------------------------------------------------
function detectTampering(vehicleId, data) {
    const vibration = data.vibration ?? 0;
    const speed = data.speed ?? 0;

    // High vibration while parked = potential tampering
    if (vibration > VIBRATION_THRESHOLD && speed <= 2) {
        return {
            vehicleId,
            type: 'tamper_detected',
            message: `Unusual vibration (${vibration}) detected while vehicle parked`,
            level: 'high',
            metadata: {
                location: data.location,
                vibration,
                speed,
                threshold: VIBRATION_THRESHOLD
            },
            createdAt: new Date()
        };
    }

    return null;
}

// -------------------------------------------------------
// GEOMETRY HELPERS
// -------------------------------------------------------

/**
 * Calculate minimum distance (in meters) from a point to a polyline
 * @param {number} lat - Point latitude
 * @param {number} lng - Point longitude
 * @param {Array} polyline - Array of [lng, lat] pairs
 * @returns {number} Distance in meters
 */
function distanceToPolyline(lat, lng, polyline) {
    let minDist = Infinity;

    for (let i = 0; i < polyline.length - 1; i++) {
        const [lng1, lat1] = polyline[i];
        const [lng2, lat2] = polyline[i + 1];

        const dist = pointToSegmentDistance(lat, lng, lat1, lng1, lat2, lng2);
        if (dist < minDist) minDist = dist;
    }

    return minDist;
}

/**
 * Distance from point to line segment (Haversine-based)
 */
function pointToSegmentDistance(pLat, pLng, aLat, aLng, bLat, bLng) {
    const dAB = haversineDistance(aLat, aLng, bLat, bLng);
    if (dAB < 1) return haversineDistance(pLat, pLng, aLat, aLng);

    // Project point onto segment
    const t = Math.max(0, Math.min(1, (
        (pLat - aLat) * (bLat - aLat) + (pLng - aLng) * (bLng - aLng)
    ) / (dAB * dAB / (111320 * 111320))));

    const projLat = aLat + t * (bLat - aLat);
    const projLng = aLng + t * (bLng - aLng);

    return haversineDistance(pLat, pLng, projLat, projLng);
}

/**
 * Haversine distance in meters
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
