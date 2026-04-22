import TransferSession from '../models/TransferSession.js';
import Vehicle from '../models/Vehicle.js';
import Notification from '../models/Notification.js';
import * as routeService from './routeService.js';
import { getDistanceFromLatLonInMeters } from '../utils/geoUtils.js';
import { getIo } from '../socket.js';

const PROXIMITY_THRESHOLD = 100; // 100 meters

/**
 * Check if the vehicle is near its destination and disclose the transfer key if needed.
 * This is called for every telemetry update.
 */
export const processProximityForTransfer = async (vehicleIdString, currentCoords) => {
    try {
        if (!currentCoords || !currentCoords.lat || !currentCoords.lng) return;

        // 1. Find the DB record for this vehicle string (e.g. VH001)
        const vehicle = await Vehicle.findOne({ vehicleId: vehicleIdString });
        if (!vehicle) return;

        // 2. Find any active transfer session for this vehicle that needs key disclosure
        const session = await TransferSession.findOne({
            vehicleId: vehicle._id,
            status: 'in-progress',
            keyDisclosed: false
        });

        if (!session || !session.temporaryKey) return;

        // 3. Get the active route to find the destination
        const activeRoute = await routeService.getActiveRoute(vehicleIdString);
        if (!activeRoute || !activeRoute.destination) return;

        // 4. Calculate distance to destination
        const distance = getDistanceFromLatLonInMeters(
            currentCoords.lat,
            currentCoords.lng,
            activeRoute.destination.lat,
            activeRoute.destination.lng
        );

        // 5. Trigger disclosure if within threshold
        if (distance <= PROXIMITY_THRESHOLD) {
            console.log(`[ProximityService] 🎯 Vehicle ${vehicleIdString} arrived at destination (${Math.round(distance)}m). Disclosing key.`);

            const io = getIo();
            const keyToDisclose = session.temporaryKey;

            // Update session so we don't spam notifications
            session.keyDisclosed = true;
            session.temporaryKey = null; // Wipe plain key after disclosure
            await session.save();

            // Create Automated Notification for Receiver
            try {
                const notification = new Notification({
                    userId: session.receiverId,
                    title: 'Vehicle Arrived! Verify Now',
                    message: `Vehicle ${vehicle.registrationNumber || vehicleIdString} has reached the destination. Use the verification key provided below.`,
                    type: 'transfer',
                    data: {
                        sessionId: session._id,
                        vehicleId: vehicle._id,
                        vehicleReg: vehicle.registrationNumber,
                        senderKey: keyToDisclose // THE AUTOMATED DISCLOSURE
                    }
                });
                await notification.save();

                // Emit real-time notification
                if (io) {
                    io.emit('notification', {
                        userId: session.receiverId.toString(),
                        title: notification.title,
                        message: notification.message
                    });
                }
            } catch (notificationErr) {
                console.error('[ProximityService] Notification failed:', notificationErr);
            }
        }
    } catch (error) {
        console.error('[ProximityService] Error in proximity processor:', error);
    }
};
