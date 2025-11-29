import Vehicle from '../models/Vehicle.js';

// Return JSON responses following the format: { status: 'ok', data: ... } or { error: 'message' }
export const getVehicles = async (req, res) => {
  try {
    const vehicles = await Vehicle.find().lean();
    return res.json({ status: 'ok', data: vehicles });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const getVehicleById = async (req, res) => {
  try {
    const v = await Vehicle.findById(req.params.id).lean();
    if (!v) return res.status(404).json({ error: 'Vehicle not found' });
    return res.json({ status: 'ok', data: v });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const createVehicle = async (req, res) => {
  try {
    const vehicle = new Vehicle(req.body);
    await vehicle.save();
    return res.status(201).json({ status: 'ok', data: vehicle });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

export const updateVehicle = async (req, res) => {
  try {
    const updated = await Vehicle.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).lean();
    return res.json({ status: 'ok', data: updated });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

export const deleteVehicle = async (req, res) => {
  try {
    await Vehicle.findByIdAndDelete(req.params.id);
    return res.json({ status: 'ok', data: { message: 'Deleted' } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
