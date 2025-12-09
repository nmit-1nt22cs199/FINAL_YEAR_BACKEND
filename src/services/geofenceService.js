import Geofence from '../models/Geofence.js';
import Alert from '../models/Alert.js';
import { checkGeofenceViolations } from '../utils/geofenceUtils.js';
import { getIo } from '../socket.js';

// Store vehicle geofence states (vehicleId -> array of geofence IDs)
// This state needs to be persisted in memory across requests
const vehicleGeofenceStates = new Map();

/**
 * Process vehicle location to check for geofence violations
 * @param {string} vehicleId - The ID of the vehicle
 * @param {Object} location - { lat, lng }
 */
export const processGeofenceForVehicle = async (vehicleId, location) => {
    if (!location || !location.lat || !location.lng) return;

    try {
        // Fetch all active geofences
        const geofences = await Geofence.find({ active: true });

        // Get previous geofence state for this vehicle
        const previousGeofences = vehicleGeofenceStates.get(vehicleId) || [];

        // Check for violations
        const { currentGeofences, entries, exits } = checkGeofenceViolations(
            location.lat,
            location.lng,
            geofences,
            previousGeofences
        );

        // Update vehicle geofence state
        vehicleGeofenceStates.set(vehicleId, currentGeofences);

        const io = getIo();

        // Create alerts for entries
        for (const geofence of entries) {
            const alert = new Alert({
                vehicleId,
                type: 'geofence_entry',
                level: 'info',
                message: `Vehicle entered geofence: ${geofence.name}`,
                metadata: {
                    geofenceId: geofence._id,
                    geofenceName: geofence.name,
                    location: location
                }
            });
            await alert.save();

            // Emit geofence event
            if (io) {
                io.emit('geofence:violation', {
                    type: 'entry',
                    vehicleId,
                    geofence: {
                        id: geofence._id,
                        name: geofence.name,
                        color: geofence.color
                    },
                    location: location,
                    timestamp: new Date()
                });

                // Emit alert
                io.emit('alert_triggered', alert);
            }
        }

        // Create alerts for exits
        for (const geofence of exits) {
            const alert = new Alert({
                vehicleId,
                type: 'geofence_exit',
                level: 'info',
                message: `Vehicle exited geofence: ${geofence.name}`,
                metadata: {
                    geofenceId: geofence._id,
                    geofenceName: geofence.name,
                    location: location
                }
            });
            await alert.save();

            // Emit geofence event
            if (io) {
                io.emit('geofence:violation', {
                    type: 'exit',
                    vehicleId,
                    geofence: {
                        id: geofence._id,
                        name: geofence.name,
                        color: geofence.color
                    },
                    location: location,
                    timestamp: new Date()
                });

                // Emit alert
                io.emit('alert_triggered', alert);
            }
        }
    } catch (error) {
        console.error('[GeofenceService] Error checking geofences:', error);
    }
};
