import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const TelemetrySchema = new Schema({
  vehicleId: { type: String, required: true, index: true },
  location: {
    lat: { type: Number },
    lng: { type: Number }
  },
  speed: { type: Number },
  temperature: { type: Number },
  fuel: { type: Number },
  ignition: { type: Boolean },
  timestamp: { type: Date, default: Date.now },
  extra: { type: Schema.Types.Mixed }
});

// Compound/index as required
TelemetrySchema.index({ vehicleId: 1, timestamp: -1 });

export default model('Telemetry', TelemetrySchema);
