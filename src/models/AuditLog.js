import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const AuditLogSchema = new Schema({
    sessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TransferSession',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    action: {
        type: String,
        required: true,
        enum: [
            'session_created',
            'session_started',
            'key_verified',
            'key_verification_failed',
            'unlock_triggered',
            'session_completed',
            'session_failed',
            'session_cancelled'
        ]
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    metadata: {
        type: Schema.Types.Mixed,
        default: {}
    },
    ipAddress: {
        type: String,
        default: null
    }
});

// Index for faster queries
AuditLogSchema.index({ sessionId: 1, timestamp: -1 });
AuditLogSchema.index({ userId: 1, timestamp: -1 });

export default model('AuditLog', AuditLogSchema);
