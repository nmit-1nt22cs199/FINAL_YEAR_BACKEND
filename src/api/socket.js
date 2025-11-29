import { Server } from 'socket.io';
import { initSocket, getIo } from '../socket.js';

// Vercel serverless handler for Socket.IO
// Attaches a single io instance to res.socket.server.io so it survives cold starts
export default async function handler(req, res) {
  // If io is already attached to the server, reuse it
  // `res.socket.server` is provided by Vercel Node runtime
  if (res.socket.server.io) {
    // Already initialized
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', message: 'Socket already running' }));
    return;
  }

  // Create a lightweight HTTP server wrapper expected by socket.io
  // In Vercel, res.socket.server is the underlying Node server
  const io = new Server(res.socket.server, {
    path: '/api/socket',
    cors: { origin: '*' }
  });

  // Attach to res.socket.server so future invocations reuse it
  res.socket.server.io = io;

  // Basic handlers
  io.on('connection', (socket) => {
    socket.emit('welcome', { message: 'Socket connected', id: socket.id });

    socket.on('ping', (payload) => {
      socket.emit('pong', payload);
    });
  });

  // Also wire our helper initSocket/getIo if desired
  try {
    // If the helper is used elsewhere, set its internal reference
    initSocket(res.socket.server, { path: '/api/socket', cors: { origin: '*' } });
  } catch (err) {
    // ignore if helper already initialized
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', message: 'Socket initialized' }));
}
