import AuditLog from '../models/AuditLog.js';

/**
 * Create an audit log entry for transfer-related actions
 * @param {string} sessionId - Transfer session ID
 * @param {string} userId - User performing the action
 * @param {string} action - Action being performed
 * @param {object} metadata - Additional context data
 * @param {string} ipAddress - Optional IP address
 * @returns {Promise<object>} Created audit log entry
 */
export const logAction = async (sessionId, userId, action, metadata = {}, ipAddress = null) => {
    try {
        const auditLog = new AuditLog({
            sessionId,
            userId,
            action,
            metadata,
            ipAddress,
            timestamp: new Date()
        });

        await auditLog.save();
        console.log(`[Audit] ${action} - Session: ${sessionId}, User: ${userId}`);
        return auditLog;
    } catch (error) {
        console.error('[Audit] Error creating audit log:', error);
        throw error;
    }
};

/**
 * Get audit logs for a specific session
 * @param {string} sessionId - Transfer session ID
 * @returns {Promise<Array>} Array of audit log entries
 */
export const getSessionLogs = async (sessionId) => {
    try {
        return await AuditLog.find({ sessionId })
            .populate('userId', 'name email role')
            .sort({ timestamp: -1 })
            .lean();
    } catch (error) {
        console.error('[Audit] Error fetching session logs:', error);
        throw error;
    }
};

/**
 * Get audit logs for a specific user
 * @param {string} userId - User ID
 * @param {number} limit - Maximum number of logs to return
 * @returns {Promise<Array>} Array of audit log entries
 */
export const getUserLogs = async (userId, limit = 50) => {
    try {
        return await AuditLog.find({ userId })
            .populate('sessionId')
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean();
    } catch (error) {
        console.error('[Audit] Error fetching user logs:', error);
        throw error;
    }
};
