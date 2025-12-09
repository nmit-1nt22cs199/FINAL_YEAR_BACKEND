// Centralized Socket.IO helper (ES Module)
// Provides initSocket(server) and getIo()
import { Server } from 'socket.io';
import Geofence from './models/Geofence.js';
import Alert from './models/Alert.js';
import { checkGeofenceViolations } from './utils/geofenceUtils.js';

let io = null;

// Store vehicle geofence states (vehicleId -> array of geofence IDs)
const vehicleGeofenceStates = new Map();

// Initialize Socket.IO server on an existing Node.js server instance
export const initSocket = (server, opts = {}) => {
  if (io) return io;

  // Create a new Socket.IO server with Render-compatible settings
  io = new Server(server, {
    path: '/api/socket',
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    },
    transports: ['polling', 'websocket'], // Polling first for Render
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000,
    ...opts
  });

  // Basic connection handler
  io.on('connection', (socket) => {
    // Emit welcome and log
    socket.emit('welcome', { message: 'Socket connected', id: socket.id });

    // Log the new connection to help with debugging handshake/connect issues
    try {
      const remote = socket.handshake && socket.handshake.address ? socket.handshake.address : 'unknown';
      console.log(`[socket] connection: id=${socket.id} from=${remote}`);
    } catch (e) {
      console.log(`[socket] connection: id=${socket.id}`);
    }

    socket.on('disconnect', (reason) => {
      // Lightweight logging for disconnects
      console.log(`[socket] disconnect: id=${socket.id} reason=${reason}`);
    });

    // Broadcast vehicle updates to all connected clients
    socket.on('vehicle_update', async (data) => {
      // console.log(`[socket] broadcasting vehicle_update for ${data.vehicleId || data.id}`);

      // Check geofence violations if location data is present
      if (data.location && data.location.lat && data.location.lng) {
        try {
          const vehicleId = data.vehicleId || data.id;

          // Fetch all active geofences
          const geofences = await Geofence.find({ active: true });

          // Get previous geofence state for this vehicle
          const previousGeofences = vehicleGeofenceStates.get(vehicleId) || [];

          // Check for violations
          const { currentGeofences, entries, exits } = checkGeofenceViolations(
            data.location.lat,
            data.location.lng,
            geofences,
            previousGeofences
          );

          // Update vehicle geofence state
          vehicleGeofenceStates.set(vehicleId, currentGeofences);

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
                location: data.location
              }
            });
            await alert.save();

            // Emit geofence event
            io.emit('geofence:violation', {
              type: 'entry',
              vehicleId,
              geofence: {
                id: geofence._id,
                name: geofence.name,
                color: geofence.color
              },
              location: data.location,
              timestamp: new Date()
            });

            // Emit alert
            io.emit('alert_triggered', alert);
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
                location: data.location
              }
            });
            await alert.save();

            // Emit geofence event
            io.emit('geofence:violation', {
              type: 'exit',
              vehicleId,
              geofence: {
                id: geofence._id,
                name: geofence.name,
                color: geofence.color
              },
              location: data.location,
              timestamp: new Date()
            });

            // Emit alert
            io.emit('alert_triggered', alert);
          }
        } catch (error) {
          console.error('[socket] Error checking geofences:', error);
        }
      }

      io.emit('vehicle_update', data);
    });

    // Broadcast alerts
    socket.on('alert_triggered', (data) => {
      console.log(`[socket] broadcasting alert_triggered for ${data.vehicleId}`);
      io.emit('alert_triggered', data);
    });
  });

  return io;
};

export const getIo = () => io;

export default { initSocket, getIo };
