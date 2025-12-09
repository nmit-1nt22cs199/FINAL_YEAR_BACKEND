import Telemetry from '../models/Telemetry.js';
import TelemetryHistory from '../models/TelemetryHistory.js';
import Alert from '../models/Alert.js';
import Vehicle from '../models/Vehicle.js';
import { getIo } from '../socket.js';

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

    if (!vehicleId)
      return res.status(400).json({ error: "vehicleId is required" });

    // -----------------------------------------
    // 1️ CHECK OR CREATE VEHICLE
    // -----------------------------------------
    let vehicle = await Vehicle.findOne({ vehicleId });

    if (!vehicle) {
      vehicle = await Vehicle.create({
        vehicleId,
        name: `Vehicle ${vehicleId}`,
        createdAt: new Date()
      });

      console.log(`🚗 New vehicle created: ${vehicleId}`);
    }

    // -----------------------------------------
    // 2 CREATE OR UPDATE TELEMETRY (UPSERT)
    // -----------------------------------------
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

    const telemetry = await Telemetry.findOneAndUpdate(
      { vehicleId },
      telemetryData,
      { new: true, upsert: true }  // update if exists, insert if not
    );

    console.log(`📡 Telemetry updated for ${vehicleId}`);

    // -----------------------------------------
    // 3️ SAVE TO HISTORY (for tracking)
    // -----------------------------------------
    await TelemetryHistory.create(telemetryData);
    console.log(`📚 History record saved for ${vehicleId}`);

    // -----------------------------------------
    // 3.5 CHECK GEOFENCES (New)
    // -----------------------------------------
    try {
      const { processGeofenceForVehicle } = await import('../services/geofenceService.js');
      await processGeofenceForVehicle(vehicleId, telemetryData.location);
    } catch (err) {
      console.error('Error checking geofences:', err);
    }

    // -----------------------------------------
    // 4️ SEND SOCKET UPDATES
    // -----------------------------------------
    try {
      const io = getIo();
      if (io) {
        io.emit("vehicle:location", {
          vehicleId,
          location: telemetry.location,
          speed: telemetry.speed,
          timestamp: telemetry.timestamp
        });

        io.emit("vehicle:telemetry", telemetry);
      }
    } catch (e) { }

    // -----------------------------------------
    // 5️⃣ ALERT GENERATION
    // -----------------------------------------
    const alerts = [];

    if (typeof speed === "number" && speed > 80) {
      alerts.push({
        vehicleId,
        type: "overspeed",
        message: `Overspeed detected: ${speed} km/h`,
        level: "high",
        createdAt: new Date()
      });
    }

    if (typeof temperature === "number" && temperature > 80) {
      alerts.push({
        vehicleId,
        type: "high_temperature",
        message: `High temperature detected: ${temperature}°C`,
        level: "high",
        createdAt: new Date()
      });
    }

    if (typeof fuel === "number" && fuel < 15) {
      alerts.push({
        vehicleId,
        type: "low_fuel",
        message: `Low fuel level: ${fuel}%`,
        level: "medium",
        createdAt: new Date()
      });
    }

    let createdAlerts = [];
    if (alerts.length > 0) {
      createdAlerts = await Alert.insertMany(alerts);

      const io = getIo();
      if (io) {
        createdAlerts.forEach(alert => io.emit("vehicle:alert", alert));
      }
    }

    // -----------------------------------------
    // 6️ RESPONSE
    // -----------------------------------------
    return res.status(200).json({
      status: "ok",
      data: { telemetry, alerts: createdAlerts }
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
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

    // Query from TelemetryHistory collection (not Telemetry)
    const data = await TelemetryHistory.find(filter).sort({ timestamp: 1 }).lean();
    return res.json({ status: 'ok', data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
