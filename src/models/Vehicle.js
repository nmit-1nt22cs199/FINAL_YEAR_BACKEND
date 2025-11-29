import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const VehicleSchema = new Schema({
  vehicleId: { type: String, required: true, unique: true },
  registrationNumber: { type: String },
  model: { type: String },
  driverName: { type: String },
  driverPhone: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export default model('Vehicle', VehicleSchema);
