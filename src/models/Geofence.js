import mongoose from 'mongoose';

const geofenceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['circle', 'polygon'],
        default: 'circle'
    },
    // For circular geofences
    center: {
        lat: {
            type: Number,
            required: function () { return this.type === 'circle'; }
        },
        lng: {
            type: Number,
            required: function () { return this.type === 'circle'; }
        }
    },
    radius: {
        type: Number, // in meters
        required: function () { return this.type === 'circle'; }
    },
    // For polygon geofences
    coordinates: [{
        lat: Number,
        lng: Number
    }],
    color: {
        type: String,
        default: '#3b82f6' // blue
    },
    alertOnEntry: {
        type: Boolean,
        default: true
    },
    alertOnExit: {
        type: Boolean,
        default: true
    },
    active: {
        type: Boolean,
        default: true
    },
    description: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

// Index for faster queries
geofenceSchema.index({ active: 1 });
geofenceSchema.index({ createdAt: -1 });

export default mongoose.model('Geofence', geofenceSchema);

