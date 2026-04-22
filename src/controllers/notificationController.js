import Notification from '../models/Notification.js';

/**
 * Get all notifications for current user
 * GET /api/notifications
 */
export const getMyNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();
        
        return res.json({ status: 'ok', data: notifications });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

/**
 * Mark notification as read
 * PUT /api/notifications/:id/read
 */
export const markAsRead = async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { $set: { read: true } },
            { new: true }
        );
        
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        
        return res.json({ status: 'ok', data: notification });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

/**
 * Delete a notification
 * DELETE /api/notifications/:id
 */
export const deleteNotification = async (req, res) => {
    try {
        const result = await Notification.deleteOne({ _id: req.params.id, userId: req.user._id });
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        return res.json({ status: 'ok', message: 'Notification deleted' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
