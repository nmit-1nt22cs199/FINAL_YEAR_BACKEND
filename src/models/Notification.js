import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const NotificationSchema = new Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['transfer', 'alert', 'system'],
        default: 'system'
    },
    data: {
        type: Schema.Types.Mixed,
        default: {}
    },
    read: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Auto-delete notifications after 7 days
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

export default model('Notification', NotificationSchema);
