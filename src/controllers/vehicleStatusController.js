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
