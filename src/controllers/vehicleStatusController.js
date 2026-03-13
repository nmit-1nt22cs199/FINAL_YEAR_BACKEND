import Telemetry from '../models/Telemetry.js';

export const getVehicleStatus = async (req, res) => {
  try {
    const { vehicleId } = req.params;

    // Find the latest telemetry record for that vehicleId
    const latestTelemetry = await Telemetry.findOne({ vehicleId })
      .sort({ timestamp: -1 });

    if (!latestTelemetry) {
      return res.status(200).json({ doorStatus: "closed" });
    }

    return res.status(200).json({
      doorStatus: latestTelemetry.doorStatus || "closed"
    });
  } catch (error) {
    console.error('Error fetching vehicle door status:', error);
    return res.status(500).json({ message: 'Server error retrieving status' });
  }
};

export const updateVehicleStatus = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { doorStatus } = req.body;

    if (!['open', 'closed'].includes(doorStatus)) {
      return res.status(400).json({ message: 'Invalid doorStatus. Must be "open" or "closed".' });
    }

    const latestTelemetry = await Telemetry.findOne({ vehicleId }).sort({ timestamp: -1 });

    if (latestTelemetry) {
      latestTelemetry.doorStatus = doorStatus;
      await latestTelemetry.save();
    } else {
      await Telemetry.create({
        vehicleId,
        doorStatus,
        timestamp: new Date()
      });
    }

    return res.status(200).json({ message: 'Door status updated successfully', doorStatus });
  } catch (error) {
    console.error('Error updating vehicle door status:', error);
    return res.status(500).json({ message: 'Server error updating status' });
  }
};
