import Alert from '../models/Alert.js';
import { getIo } from '../socket.js';

export const createAlert = async (req, res) => {
  try {
    const a = new Alert(req.body);
    await a.save();
    return res.status(201).json({ status: 'ok', data: a });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

export const getAlerts = async (req, res) => {
  try {
    const alerts = await Alert.find().sort({ createdAt: -1 }).lean();
    return res.json({ status: 'ok', data: alerts });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const acknowledgeAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Alert.findByIdAndUpdate(id, { acknowledged: true }, { new: true }).lean();
    if (!updated) return res.status(404).json({ error: 'Alert not found' });
    // Emit acknowledgement event
    try {
      const io = getIo();
      if (io) {
        io.emit('alert:acked', { alertId: updated._id, vehicleId: updated.vehicleId });
      }
    } catch (err) {
      // ignore
    }

    return res.json({ status: 'ok', data: updated });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};
