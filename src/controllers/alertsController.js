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
    const { acknowledgedBy, note } = req.body;

    const updated = await Alert.findByIdAndUpdate(
      id,
      {
        acknowledged: true,
        acknowledgedBy: acknowledgedBy || 'Operator', // Default if not provided
        acknowledgedAt: new Date(),
        acknowledgmentNote: note
      },
      { new: true }
    ).lean();

    if (!updated) return res.status(404).json({ error: 'Alert not found' });

    // Emit acknowledgement event
    try {
      const io = getIo();
      if (io) {
        // Emit full updated alert so frontend can show details immediately
        io.emit('alert:acked', updated);
      }
    } catch (err) {
      // ignore
    }

    return res.json({ status: 'ok', data: updated });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};
