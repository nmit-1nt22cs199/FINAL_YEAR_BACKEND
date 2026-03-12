import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const RouteSchema = new Schema({
    vehicleId: { type: String, required: true, index: true },
    origin: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
        address: { type: String }
    },
    destination: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
        address: { type: String }
    },
    waypoints: [{
        lat: { type: Number },
        lng: { type: Number }
    }],
    encodedPolyline: { type: String },
    decodedPath: { type: [[Number]] },  // Array of [lng, lat] pairs
    distance: { type: Number },          // meters
    duration: { type: Number },          // seconds
    status: {
        type: String,
        enum: ['assigned', 'in-progress', 'completed', 'cancelled'],
        default: 'assigned'
    },
    assignedBy: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

RouteSchema.index({ vehicleId: 1, status: 1 });
RouteSchema.index({ createdAt: -1 });

export default model('Route', RouteSchema);
