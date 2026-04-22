import TransferSession from '../models/TransferSession.js';
import User from '../models/User.js';
import Vehicle from '../models/Vehicle.js';
import Telemetry from '../models/Telemetry.js';
import TelemetryHistory from '../models/TelemetryHistory.js';
import Notification from '../models/Notification.js';
import { generateKey, hashKey, compareKeys } from '../utils/keyGenerator.js';
import { logAction } from '../utils/auditLogger.js';
import { getIo } from '../socket.js';
import { getDistanceFromLatLonInMeters } from '../utils/geoUtils.js';
import * as routeService from '../services/routeService.js';

/**
 * Initiate a new transfer session
 * POST /api/transfer/initiate
 */
export const initiateTransfer = async (req, res) => {
    try {
        const { vehicleId, receiverId, notes, amount } = req.body;
        const senderId = req.user._id;

        // Validate required fields
        if (!vehicleId || !receiverId) {
            return res.status(400).json({ error: 'vehicleId and receiverId are required' });
        }

        // Verify sender role
        if (req.user.role !== 'sender' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only senders can initiate transfers' });
        }

        // Check if vehicle exists
        const vehicle = await Vehicle.findById(vehicleId);
        if (!vehicle) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }

        // Check if receiver exists and has correct role
        const receiver = await User.findById(receiverId);
        if (!receiver) {
            return res.status(404).json({ error: 'Receiver not found' });
        }
        if (receiver.role !== 'receiver' && receiver.role !== 'admin') {
            return res.status(400).json({ error: 'Receiver must have receiver or admin role' });
        }

        // Check for existing active session for this vehicle
        const existingSession = await TransferSession.findOne({
            vehicleId,
            status: { $in: ['pending', 'in-progress'] }
        });

        if (existingSession) {
            return res.status(400).json({
                error: 'An active transfer session already exists for this vehicle',
                sessionId: existingSession._id
            });
        }
        
        // --- NEW REQUIREMENT: ACTIVE ROUTE CHECK ---
        const activeRoute = await routeService.getActiveRoute(vehicle.vehicleId);
        if (!activeRoute) {
            return res.status(400).json({
                error: 'Route Required',
                message: 'No active safe route found for this vehicle. please Assign a route before initiating a transfer.'
            });
        }
        // ----------------------------------------

        // Generate sender key
        const senderKey = generateKey();
        const hashedSenderKey = await hashKey(senderKey);

        // Create transfer session
        const session = new TransferSession({
            vehicleId,
            senderId,
            receiverId,
            senderKey: hashedSenderKey,
            temporaryKey: senderKey, // Store plain key for automated arrival notification
            status: 'in-progress',
            notes,
            amount
        });

        await session.save();

        // Log action
        await logAction(
            session._id,
            senderId,
            'session_created',
            { vehicleId, receiverId, amount },
            req.ip
        );

        // Emit socket event
        const io = getIo();
        if (io) {
            io.emit('transfer_initiated', {
                sessionId: session._id,
                vehicleId,
                senderId,
                receiverId,
                status: 'in-progress'
            });
        }

        // Create Automated Notification for Receiver
        try {
            const notification = new Notification({
                userId: receiverId,
                title: 'New Vehicle Transfer',
                message: `You have been assigned as the receiver for vehicle ${vehicle.registrationNumber || vehicleId}. Use the key below when at the destination.`,
                type: 'transfer',
                data: {
                    sessionId: session._id,
                    vehicleId: vehicleId,
                    vehicleReg: vehicle.registrationNumber,
                    // keyDisclosed: false // Key is hidden until arrival
                }
            });
            await notification.save();

            // Emit notification to specific user
            if (io) {
                io.emit('notification', {
                    userId: receiverId.toString(), // Ensure string for frontend comparison
                    title: notification.title,
                    message: notification.message
                });
            }
        } catch (notificationErr) {
            console.error('[Transfer] Notification creation failed:', notificationErr);
        }

        // Return session with plain sender key (only time it's visible)
        return res.status(201).json({
            status: 'ok',
            data: {
                session: {
                    id: session._id,
                    vehicleId: session.vehicleId,
                    senderId: session.senderId,
                    receiverId: session.receiverId,
                    status: session.status,
                    startTime: session.startTime,
                    notes: session.notes,
                    amount: session.amount
                },
                senderKey // Plain key - sender must share this with receiver
            },
            message: 'Transfer session initiated. Share the sender key with the receiver.'
        });
    } catch (error) {
        console.error('[Transfer] Initiate error:', error);
        return res.status(500).json({ error: error.message });
    }
};

/**
 * Verify transfer with receiver key
 * POST /api/transfer/verify
 */
export const verifyTransfer = async (req, res) => {
    try {
        const { sessionId, receiverKey, password } = req.body;
        const userId = req.user._id?.toString();

        // Validate required fields
        if (!sessionId || !receiverKey || !password) {
            return res.status(400).json({ error: 'sessionId, receiverKey, and password are required' });
        }

        // Get session
        const session = await TransferSession.findById(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Transfer session not found' });
        }

        // Check if session is in correct status
        if (session.status !== 'in-progress') {
            return res.status(400).json({
                error: `Cannot verify session with status: ${session.status}`
            });
        }

        // --- STEP 0: PASSWORD VERIFICATION ---
        try {
            const currentUser = await User.findById(req.user._id);
            if (!currentUser) throw new Error('User not found');
            const isPasswordMatch = await currentUser.comparePassword(password);
            if (!isPasswordMatch) {
                return res.status(401).json({ error: 'Invalid password', message: 'The confirmation password you entered is incorrect.' });
            }
        } catch (pwErr) {
            return res.status(500).json({ error: 'Internal identity check error' });
        }
        // -------------------------------------

        // Verify user is the receiver (strictly, as per request)
        if (session.receiverId?.toString() !== userId) {
            if (req.user.role === 'admin') {
                console.log('[Transfer] Admin override for verification');
            } else {
                return res.status(403).json({ error: 'Only the assigned receiver can verify this transfer. Senders are not allowed to verify.' });
            }
        }

        // Compare keys (normalize input)
        const normalizedKey = String(receiverKey).trim();
        if (normalizedKey.length !== 6) {
            return res.status(400).json({ error: 'Receiver key must be 6 digits' });
        }

        // PROXIMITY CHECK (100 Meters)
        try {
            const vehicle = await Vehicle.findById(session.vehicleId);
            if (!vehicle) throw new Error('Vehicle not found related to this session');

            // 1. Get Active Route for this vehicle to find destination
            const activeRoute = await routeService.getActiveRoute(vehicle.vehicleId);
            if (!activeRoute || !activeRoute.destination) {
                return res.status(403).json({ 
                    error: 'Location verification failed', 
                    message: 'No active route or destination found for this vehicle. Secure handoff requires a defined destination.'
                });
            }

            // 2. Get Latest Telemetry for vehicle
            const latestTelemetry = await Telemetry.findOne({ vehicleId: vehicle.vehicleId }).sort({ timestamp: -1 });
            if (!latestTelemetry || !latestTelemetry.location) {
                return res.status(403).json({ 
                    error: 'Location verification failed', 
                    message: 'No recent telemetry data available for vehicle. Unable to verify proximity.'
                });
            }

            // 3. Calculate Distance
            const distance = getDistanceFromLatLonInMeters(
                latestTelemetry.location.lat,
                latestTelemetry.location.lng,
                activeRoute.destination.lat,
                activeRoute.destination.lng
            );

            const ALLOWED_RADIUS = 100; // 100 Meters
            if (distance > ALLOWED_RADIUS) {
                return res.status(403).json({ 
                    error: 'Proximity Check Failed', 
                    message: `Vehicle is currently ${Math.round(distance)}m away from the authorized destination. Verification is only allowed within ${ALLOWED_RADIUS}m.`,
                    distance: Math.round(distance)
                });
            }
            console.log(`[Transfer] Proximity Verified: ${Math.round(distance)}m`);
        } catch (proximityErr) {
            console.error('[Transfer] Proximity check error:', proximityErr);
            return res.status(500).json({ error: 'Proximity verification system error: ' + proximityErr.message });
        }

        const isMatch = await compareKeys(normalizedKey, session.senderKey);
        console.log(`[Transfer] verify key attempt session=${sessionId} receiver=${session.receiverId} key=**${normalizedKey.slice(-2)} match=${isMatch}`);

        if (!isMatch) {
            // Log failed verification
            await logAction(
                session._id,
                userId,
                'key_verification_failed',
                { attemptedKey: receiverKey.substring(0, 2) + '****' },
                req.ip
            );

            return res.status(400).json({
                error: 'Invalid key',
                message: 'The receiver key does not match the sender key'
            });
        }

        // Update session
        session.verified = true;
        session.status = 'completed';
        session.endTime = new Date();
        session.receiverKey = await hashKey(receiverKey);
        await session.save();

        // --- AUTOMATIC ROUTE COMPLETION ---
        try {
            const vehicle = await Vehicle.findById(session.vehicleId);
            const activeRoute = await routeService.getActiveRoute(vehicle.vehicleId);
            if (activeRoute) {
                await routeService.completeRoute(activeRoute._id);
                console.log(`[Transfer] Automatically completed route ${activeRoute._id} on transfer success`);
            }
        } catch (routeErr) {
            console.error('[Transfer] Failed to auto-complete route:', routeErr);
        }
        // ----------------------------------

        // Log successful verification
        await logAction(
            session._id,
            userId,
            'key_verified',
            { vehicleId: session.vehicleId },
            req.ip
        );

        // Log unlock trigger
        await logAction(
            session._id,
            userId,
            'unlock_triggered',
            { vehicleId: session.vehicleId },
            req.ip
        );

        // Update telemetry door status to open for this vehicle
        try {
            const vehicle = await Vehicle.findById(session.vehicleId).lean();
            if (vehicle?.vehicleId) {
                const doorUpdate = {
                    vehicleId: vehicle.vehicleId,
                    doorStatus: 'open',
                    timestamp: new Date()
                };
                await Telemetry.findOneAndUpdate(
                    { vehicleId: vehicle.vehicleId },
                    { $set: doorUpdate },
                    { new: true, upsert: true }
                );
                await TelemetryHistory.create(doorUpdate);
            }
        } catch (err) {
            console.error('[Transfer] Telemetry door update failed:', err.message || err);
        }

        // Emit unlock event to IoT device
        const io = getIo();
        if (io) {
            io.emit('unlock', {
                vehicleId: session.vehicleId,
                sessionId: session._id,
                timestamp: new Date()
            });

            io.emit('transfer_verified', {
                sessionId: session._id,
                vehicleId: session.vehicleId,
                status: 'completed',
                verified: true
            });
        }

        return res.json({
            status: 'ok',
            data: {
                session: {
                    id: session._id,
                    vehicleId: session.vehicleId,
                    verified: session.verified,
                    status: session.status,
                    startTime: session.startTime,
                    endTime: session.endTime
                }
            },
            message: 'Transfer verified successfully. Unlock signal sent to vehicle.'
        });
    } catch (error) {
        console.error('[Transfer] Verify error:', error);
        return res.status(500).json({ error: error.message });
    }
};

/**
 * Get transfer session details
 * GET /api/transfer/:sessionId
 */
export const getTransferSession = async (req, res) => {
    try {
        const session = await TransferSession.findById(req.params.sessionId)
            .populate('vehicleId', 'vehicleId registrationNumber model')
            .populate('senderId', 'name email role')
            .populate('receiverId', 'name email role')
            .lean();

        if (!session) {
            return res.status(404).json({ error: 'Transfer session not found' });
        }

        // Remove hashed keys from response
        delete session.senderKey;
        delete session.receiverKey;

        return res.json({
            status: 'ok',
            data: session
        });
    } catch (error) {
        console.error('[Transfer] Get session error:', error);
        return res.status(500).json({ error: error.message });
    }
};

/**
 * Get transfer history for a vehicle
 * GET /api/transfer/history/:vehicleId
 */
export const getTransferHistory = async (req, res) => {
    try {
        const { vehicleId } = req.params;
        const { status, limit = 50 } = req.query;

        const filter = { vehicleId };
        if (status) filter.status = status;

        const sessions = await TransferSession.find(filter)
            .populate('senderId', 'name email role')
            .populate('receiverId', 'name email role')
            .sort({ startTime: -1 })
            .limit(parseInt(limit))
            .select('-senderKey -receiverKey')
            .lean();

        return res.json({
            status: 'ok',
            data: sessions
        });
    } catch (error) {
        console.error('[Transfer] Get history error:', error);
        return res.status(500).json({ error: error.message });
    }
};

/**
 * Cancel a transfer session
 * POST /api/transfer/cancel/:sessionId
 */
export const cancelTransfer = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.user._id;

        const session = await TransferSession.findById(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Transfer session not found' });
        }

        // Only sender or admin can cancel
        if (session.senderId.toString() !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only the sender or admin can cancel this transfer' });
        }

        if (session.status === 'completed') {
            return res.status(400).json({ error: 'Cannot cancel a completed transfer' });
        }

        session.status = 'failed';
        session.endTime = new Date();
        await session.save();

        // Log cancellation
        await logAction(
            session._id,
            userId,
            'session_cancelled',
            { reason: req.body.reason || 'User cancelled' },
            req.ip
        );

        // Emit socket event
        const io = getIo();
        if (io) {
            io.emit('transfer_status', {
                sessionId: session._id,
                status: 'failed',
                message: 'Transfer cancelled'
            });
        }

        return res.json({
            status: 'ok',
            data: session,
            message: 'Transfer session cancelled'
        });
    } catch (error) {
        console.error('[Transfer] Cancel error:', error);
        return res.status(500).json({ error: error.message });
    }
};

/**
 * Get all active transfer sessions
 * GET /api/transfer/active
 */
export const getActiveSessions = async (req, res) => {
    try {
        const sessions = await TransferSession.find({
            status: { $in: ['pending', 'in-progress'] }
        })
            .populate('vehicleId', 'vehicleId registrationNumber model')
            .populate('senderId', 'name email role')
            .populate('receiverId', 'name email role')
            .sort({ startTime: -1 })
            .select('-senderKey -receiverKey')
            .lean();

        return res.json({
            status: 'ok',
            data: sessions
        });
    } catch (error) {
        console.error('[Transfer] Get active sessions error:', error);
        return res.status(500).json({ error: error.message });
    }
};

/**
 * Get active sessions for current user (sender or receiver)
 * GET /api/transfer/my
 */
export const getMyActiveSessions = async (req, res) => {
    try {
        const userId = req.user._id;
        const sessions = await TransferSession.find({
            status: { $in: ['pending', 'in-progress'] },
            $or: [{ senderId: userId }, { receiverId: userId }]
        })
            .populate('vehicleId', 'vehicleId registrationNumber model')
            .populate('senderId', 'name email role')
            .populate('receiverId', 'name email role')
            .sort({ startTime: -1 })
            .select('-senderKey -receiverKey')
            .lean();

        return res.json({
            status: 'ok',
            data: sessions
        });
    } catch (error) {
        console.error('[Transfer] Get my active sessions error:', error);
        return res.status(500).json({ error: error.message });
    }
};
