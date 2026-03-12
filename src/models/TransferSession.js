import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const TransferSessionSchema = new Schema({
    vehicleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vehicle',
        required: true
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    receiverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    startTime: {
        type: Date,
        default: Date.now
    },
    endTime: {
        type: Date,
        default: null
    },
    status: {
        type: String,
        enum: ['pending', 'in-progress', 'completed', 'failed'],
        default: 'pending'
    },
    senderKey: {
        type: String,
        required: true
    },
    receiverKey: {
        type: String,
        default: null
    },
    verified: {
        type: Boolean,
        default: false
    },
    notes: {
        type: String,
        default: ''
    },
    amount: {
        type: Number,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for faster queries
TransferSessionSchema.index({ vehicleId: 1, status: 1 });
TransferSessionSchema.index({ senderId: 1 });
TransferSessionSchema.index({ receiverId: 1 });

export default model('TransferSession', TransferSessionSchema);
