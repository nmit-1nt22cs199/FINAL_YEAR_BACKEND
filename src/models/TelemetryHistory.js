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
    doorStatus: { type: String, enum: ['open', 'closed', null], default: null },
    vibration: { type: Number, default: 0 },
    motion: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now, index: true },
    extra: { type: Schema.Types.Mixed }
});


TelemetryHistorySchema.index(
    { timestamp: 1 },
    { expireAfterSeconds: 8 * 24 * 60 * 60 }
);

export default model('TelemetryHistory', TelemetryHistorySchema);
