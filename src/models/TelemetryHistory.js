import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const TelemetryHistorySchema = new Schema({
    vehicleId: { type: String, required: true, index: true },
    location: {
        lat: { type: Number },
        lng: { type: Number }
    },
    speed: { type: Number },
    temperature: { type: Number },
    fuel: { type: Number },
    ignition: { type: Boolean },
    timestamp: { type: Date, default: Date.now, index: true },
    extra: { type: Schema.Types.Mixed }
});

// Compound index for efficient history queries
TelemetryHistorySchema.index({ vehicleId: 1, timestamp: -1 });

export default model('TelemetryHistory', TelemetryHistorySchema);
