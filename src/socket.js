// Centralized Socket.IO helper (ES Module)
// Provides initSocket(server) and getIo()
import { Server } from 'socket.io';

let io = null;

// Initialize Socket.IO server on an existing Node.js server instance
export const initSocket = (server, opts = {}) => {
  if (io) return io;

  // Create a new Socket.IO server
  io = new Server(server, {
    path: '/api/socket',
    cors: { origin: '*' },
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
    socket.on('vehicle_update', (data) => {
      // console.log(`[socket] broadcasting vehicle_update for ${data.vehicleId || data.id}`);
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
