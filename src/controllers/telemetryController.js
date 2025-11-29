import Telemetry from '../models/Telemetry.js';
import Alert from '../models/Alert.js';
import { getIo } from '../socket.js';
import Vehicle from '../models/Vehicle.js';
// POST /api/telemetry
export const postTelemetry = async (req, res) => {
  try {
    const {
      vehicleId,
      location,
      speed,
      temperature,
      fuel,
      ignition,
      timestamp,
      extra
    } = req.body;
    console.log(req.body)
    if (!vehicleId) return res.status(400).json({ error: 'vehicleId is required' });

    // Check if vehicle is registered
    const vehicle = await Vehicle.findOne({ vehicleId });
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    const telemetryData = {
      vehicleId,
      location,
      speed,
      temperature,
      fuel,
      ignition,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      extra
    };

    // INSERT new telemetry record (don't update - we want history!)
    // This ensures every location update is saved for history tracking
    const telemetry = await Telemetry.create(telemetryData);

    console.log(`📍 Saved telemetry for ${vehicleId} at ${telemetry.location?.lat}, ${telemetry.location?.lng}`);

    // Emit Socket.IO events
    try {
      const io = getIo();
      if (io) {
        io.emit('vehicle:location', {
          vehicleId,
          location: telemetry.location,
          speed: telemetry.speed,
          timestamp: telemetry.timestamp
        });
        io.emit('vehicle:telemetry', telemetry);
      }
    } catch (err) { }

    // Evaluate alerts
    const alertsToCreate = [];

    if (typeof speed === 'number' && speed > 80) {
      alertsToCreate.push({
        vehicleId,
        type: 'overspeed',
        message: `Overspeed detected: ${speed} km/h`,
        level: 'high'
      });
    }

    if (typeof temperature === 'number' && temperature > 80) {
      alertsToCreate.push({
        vehicleId,
        type: 'high_temperature',
        message: `High temperature detected: ${temperature} C`,
        level: 'high'
      });
    }

    if (typeof fuel === 'number' && fuel < 15) {
      alertsToCreate.push({
        vehicleId,
        type: 'low_fuel',
        message: `Low fuel level: ${fuel}%`,
        level: 'medium'
      });
    }

    let createdAlerts = [];
    if (alertsToCreate.length > 0) {
      createdAlerts = await Alert.insertMany(alertsToCreate.map(a => ({ ...a, createdAt: new Date() })));

      try {
        const io = getIo();
        if (io && createdAlerts.length > 0) {
          for (const a of createdAlerts) {
            io.emit('vehicle:alert', a);
          }
        }
      } catch (err) { }
    }

    return res.status(201).json({ status: 'ok', data: { telemetry, alerts: createdAlerts } });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

// GET /api/telemetry
export const getLatestTelemetry = async (req, res) => {
  try {
    const latest = await Telemetry.aggregate([
      { $sort: { vehicleId: 1, timestamp: -1 } },
      { $group: { _id: '$vehicleId', doc: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$doc' } }
    ]);

    return res.json({ status: 'ok', data: latest });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// GET /api/telemetry/history?vehicleId=...&from=...&to=...
export const getTelemetryHistory = async (req, res) => {
  try {
    const { vehicleId, from, to } = req.query;
    if (!vehicleId) return res.status(400).json({ error: 'vehicleId is required' });

    const filter = { vehicleId };
    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = new Date(from);
      if (to) filter.timestamp.$lte = new Date(to);
    }

    const data = await Telemetry.find(filter).sort({ timestamp: 1 }).lean();
    return res.json({ status: 'ok', data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
