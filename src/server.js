import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import vehiclesRouter from './routes/vehiclesRoutes.js';
import telemetryRouter from './routes/telemetryRoutes.js';
import alertsRouter from './routes/alertsRoutes.js';
import historyRouter from './routes/historyRoutes.js';
import geofenceRouter from './routes/geofenceRoutes.js';
import { createServer } from 'http';
import { initSocket } from './socket.js';

// Load environment variables
dotenv.config();

// Connect to MongoDB (with retry logic inside)
connectDB();

const app = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: "*" }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use('/api/vehicles', vehiclesRouter);
app.use('/api/telemetry', telemetryRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/history', historyRouter);
app.use('/api/geofences', geofenceRouter);

app.get('/', (req, res) => res.json({ status: 'ok', data: 'Fleet backend is running' }));

const PORT = process.env.PORT || 3000;

// Create HTTP server and attach Socket.IO for local development
const server = createServer(app);

// Initialize Socket.IO on the HTTP server so `/api/socket` works locally
try {
	initSocket(server);
} catch (err) {
	// Non-fatal: continue even if socket init fails
	console.error('Socket initialization error (non-fatal):', err.message || err);
}

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

export default app;
export { server };
