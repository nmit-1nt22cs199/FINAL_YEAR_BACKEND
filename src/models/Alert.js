import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const AlertSchema = new Schema({
  vehicleId: { type: String },
  type: { type: String },
  message: { type: String },
  level: { type: String, default: 'info' },
  acknowledged: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now,expires: 100800 }
});

export default model('Alert', AlertSchema);
