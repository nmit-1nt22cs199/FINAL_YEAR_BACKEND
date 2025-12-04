import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const AlertSchema = new Schema({
  vehicleId: { type: String },
  type: { type: String },
  message: { type: String },
  level: { type: String, default: 'info' },
  acknowledged: { type: Boolean, default: false },
  acknowledgedBy: { type: String },        // Who acknowledged
  acknowledgedAt: { type: Date },          // When acknowledged
  acknowledgmentNote: { type: String },    // Why/notes
  createdAt: { type: Date, default: Date.now, expires: 100800 }
});

export default model('Alert', AlertSchema);
