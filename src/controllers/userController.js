import User from '../models/User.js';
import Vehicle from '../models/Vehicle.js';
import { generateToken } from '../middleware/authMiddleware.js';

/**
 * Register a new user
 * POST /api/users/register
 */
export const register = async (req, res) => {
    try {
        const { name, email, password, role, phone } = req.body;

        // Validate required fields
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }

        // Create new user
        const user = new User({
            name,
            email,
            password,
            role: role || 'driver',
            phone
        });

        await user.save();

        // Generate token
        const token = generateToken(user);

        // Return user without password
        const userResponse = {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone,
            assignedVehicle: user.assignedVehicle,
            createdAt: user.createdAt
        };

        return res.status(201).json({
            status: 'ok',
            data: {
                user: userResponse,
                token
            }
        });
    } catch (error) {
        console.error('[User] Registration error:', error);
        return res.status(500).json({ error: error.message });
    }
};

/**
 * Login user
 * POST /api/users/login
 */
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate token
        const token = generateToken(user);

        // Return user without password
        const userResponse = {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone,
            assignedVehicle: user.assignedVehicle,
            createdAt: user.createdAt
        };

        return res.json({
            status: 'ok',
            data: {
                user: userResponse,
                token
            }
        });
    } catch (error) {
        console.error('[User] Login error:', error);
        return res.status(500).json({ error: error.message });
    }
};

/**
 * Assign user to vehicle (Admin only)
 * POST /api/users/assign
 */
export const assignUserToVehicle = async (req, res) => {
    try {
        const { userId, vehicleId } = req.body;

        if (!userId || !vehicleId) {
            return res.status(400).json({ error: 'userId and vehicleId are required' });
        }

        // Check if vehicle exists
        let vehicle = null;
        if (typeof vehicleId === 'string' && vehicleId.length === 24) {
            vehicle = await Vehicle.findById(vehicleId);
        }
        if (!vehicle) {
            vehicle = await Vehicle.findOne({ vehicleId });
        }
        if (!vehicle) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }

        // Update user
        const user = await User.findByIdAndUpdate(
            userId,
            { assignedVehicle: vehicle._id, updatedAt: Date.now() },
            { new: true, runValidators: true }
        ).select('-password').lean();

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        return res.json({
            status: 'ok',
            data: user
        });
    } catch (error) {
        console.error('[User] Assignment error:', error);
        return res.status(500).json({ error: error.message });
    }
};

/**
 * Unassign user from vehicle
 * POST /api/users/unassign/:id
 */
export const unassignUser = async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { assignedVehicle: null, updatedAt: Date.now() },
            { new: true }
        ).select('-password').lean();

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        return res.json({
            status: 'ok',
            data: user
        });
    } catch (error) {
        console.error('[User] Unassignment error:', error);
        return res.status(500).json({ error: error.message });
    }
};

/**
 * Get all users (Admin only)
 * GET /api/users
 */
export const getUsers = async (req, res) => {
    try {
        const { role, assignedVehicle } = req.query;
        const filter = {};

        if (role) filter.role = role;
        if (assignedVehicle) filter.assignedVehicle = assignedVehicle;

        let users;
        try {
            users = await User.find(filter)
                .select('-password')
                .populate('assignedVehicle', 'vehicleId registrationNumber model')
                .lean();
        } catch (populateErr) {
            console.warn('[User] Populate assignedVehicle failed, returning raw users:', populateErr.message);
            users = await User.find(filter)
                .select('-password')
                .lean();
        }

        return res.json({
            status: 'ok',
            data: users
        });
    } catch (error) {
        console.error('[User] Get users error:', error);
        return res.status(500).json({ error: error.message });
    }
};

/**
 * Get user by ID
 * GET /api/users/:id
 */
export const getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('-password')
            .populate('assignedVehicle', 'vehicleId registrationNumber model')
            .lean();

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        return res.json({
            status: 'ok',
            data: user
        });
    } catch (error) {
        console.error('[User] Get user error:', error);
        return res.status(500).json({ error: error.message });
    }
};

/**
 * Update user
 * PUT /api/users/:id
 */
export const updateUser = async (req, res) => {
    try {
        const { name, phone, role } = req.body;
        const updateData = { updatedAt: Date.now() };

        if (name) updateData.name = name;
        if (phone) updateData.phone = phone;
        if (role) updateData.role = role;

        const user = await User.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).select('-password').lean();

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        return res.json({
            status: 'ok',
            data: user
        });
    } catch (error) {
        console.error('[User] Update error:', error);
        return res.status(500).json({ error: error.message });
    }
};
